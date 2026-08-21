<?php
declare(strict_types=1);
/**
 * dms.php — direct messages between two users.
 *
 * GET  /api/dms.php?action=unread_count
 *   -> { ok, unreadCount }
 *
 * GET  /api/dms.php?action=threads&limit=20&before=<last message id cursor>
 *   -> { ok, threads: [ { userId, username, pfpId, unreadCount, lastMessage }, ... ], nextCursor }
 *   One row per conversation partner, newest last-message first. `before` is
 *   the last message id of the last thread on the previous page (not a
 *   datetime — DMs are a single source, so an id cursor is simpler and
 *   collision-proof, unlike inbox.php's merged-feed datetime cursor).
 *
 * GET  /api/dms.php?action=thread&userId=<id>&limit=30
 *   -> { ok, messages: [ {id, senderId, body, status, createdAt}, ... ] }
 *   Returns the most recent `limit` messages, oldest -> newest. As a side
 *   effect, marks every unread message FROM that user (i.e. sent to me) as
 *   read — opening a thread is treated as reading it.
 *
 * GET  /api/dms.php?action=poll&userId=<id>&afterId=<last seen id>
 *   -> { ok, messages: [...], otherUser: {...} }  (messages ascending, id > afterId only)
 *   Same read-marking side effect as `thread`, since anything returned here
 *   is being shown live in an open conversation. otherUser is included so a
 *   live-open thread's header (presence dot + status line) stays current
 *   without a separate poll loop.
 *
 * GET  /api/dms.php?action=typing_status&userId=<id>
 *   -> { ok, typing: bool }
 *   Whether <id> is currently typing to me — see TYPING_FRESHNESS_SECONDS.
 *
 * POST /api/dms.php  body: { action: 'send', recipientId, body, csrf_token }
 *   -> { ok, message: {...} }
 *
 * POST /api/dms.php  body: { action: 'edit', messageId, body, csrf_token }
 *   -> { ok, message: {...} }  Sender-only, and only while not deleted.
 *
 * POST /api/dms.php  body: { action: 'delete', messageId, csrf_token }
 *   -> { ok }  Sender-only soft delete (status -> 'deleted'); body is kept
 *   server-side (nothing here is a moderation tool yet) but the client
 *   always renders deleted messages as "Message deleted".
 *
 * POST /api/dms.php  body: { action: 'typing', recipientId, csrf_token }
 *   -> { ok }  Upserts a freshness-windowed "I'm typing to recipientId" row.
 *   Call this throttled (every 2-3s) while the composer has text, not on
 *   every keystroke.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// Keep in sync with PRESET_IDS in account-widget.js / inbox.php / profile.php.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

const MAX_DM_BODY_LENGTH = 2000;

// A typing row older than this is treated as "stopped typing" rather than
// requiring an explicit clear call — simpler than wiring a clear-on-blur/
// clear-on-send request, at the cost of the indicator lagging by up to this
// many seconds after someone actually stops. Client re-sends the upsert
// every TYPING_PING_INTERVAL_MS (see account-widget.js) which must stay
// comfortably shorter than this window or the indicator will flicker off
// mid-typing.
const TYPING_FRESHNESS_SECONDS = 5;

// Keep in sync with LAST_SEEN_WRITE_THROTTLE_SECONDS / ONLINE_THRESHOLD_SECONDS
// in includes/session.php and api/user-profile.php.
const ONLINE_THRESHOLD_SECONDS = 45;

function normalize_pfp(?string $pfpId): string {
    return $pfpId !== null && $pfpId !== '' ? $pfpId : 'default';
}

function format_message(array $row): array {
    return [
        'id'        => (int) $row['id'],
        'senderId'  => (int) $row['sender_id'],
        'body'      => $row['body'],
        'status'    => $row['status'],
        'isRead'    => (bool) $row['is_read'],
        'editedAt'  => $row['edited_at'] ?? null,
        'createdAt' => $row['created_at'],
    ];
}

// Mirrors the online/presence split already used by user-profile.php: `online`
// is a server-computed boolean (never trust the client's clock), `presence`
// is the raw stored value including 'invisible' — collapsing invisible/stale
// into a displayed "Offline" is left to the client, same as everywhere else,
// so nothing here changes that convention or leaks a second implementation of it.
function other_user_info(PDO $pdo, int $userId): ?array {
    $stmt = $pdo->prepare('SELECT id, username, pfp_id, presence, status, last_seen FROM users WHERE id = :id AND is_banned = 0');
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $lastSeen = $row['last_seen'] !== null ? (int) $row['last_seen'] : null;
    $online   = $lastSeen !== null && (time() - $lastSeen) < ONLINE_THRESHOLD_SECONDS;

    return [
        'id'       => (int) $row['id'],
        'username' => $row['username'],
        'pfpId'    => normalize_pfp($row['pfp_id']),
        'presence' => $row['presence'] ?: 'online',
        'status'   => $row['status'] ?: '',
        'online'   => $online,
    ];
}

function read_up_to_id(PDO $pdo, int $myId, int $otherId): int {
    $stmt = $pdo->prepare(
        'SELECT MAX(id) FROM direct_messages WHERE sender_id = :me AND recipient_id = :other AND is_read = 1'
    );
    $stmt->execute([':me' => $myId, ':other' => $otherId]);
    return (int) ($stmt->fetchColumn() ?: 0);
}

$pdo = get_db();
$me  = current_user($pdo);
if (!$me) {
    json_error(401, 'You must be logged in.');
}
$myId = (int) $me['id'];

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'unread_count') {
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM direct_messages
             WHERE recipient_id = :me AND is_read = 0 AND status != 'deleted'"
        );
        $stmt->execute([':me' => $myId]);
        echo json_encode(['ok' => true, 'unreadCount' => (int) $stmt->fetchColumn()]);
        exit;
    }

    if ($action === 'threads') {
        $limit  = max(1, min(50, (int) ($_GET['limit'] ?? 20)));
        $before = isset($_GET['before']) && $_GET['before'] !== '' ? (int) $_GET['before'] : null;

        // One row per conversation partner: whichever side of each message
        // ISN'T me, grouped, keeping the highest message id (= most recent,
        // since ids are monotonic) as that partner's "last message" pointer.
        $sql = 'SELECT other_id, MAX(id) AS last_id
                FROM (
                    SELECT id, CASE WHEN sender_id = :me THEN recipient_id ELSE sender_id END AS other_id
                    FROM direct_messages
                    WHERE sender_id = :me OR recipient_id = :me
                ) x
                GROUP BY other_id';
        $params = [':me' => $myId];
        if ($before !== null) {
            $sql .= ' HAVING last_id < :before';
            $params[':before'] = $before;
        }
        $sql .= ' ORDER BY last_id DESC LIMIT ' . $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $partners = $stmt->fetchAll();

        if (!$partners) {
            echo json_encode(['ok' => true, 'threads' => [], 'nextCursor' => null]);
            exit;
        }

        $threads = [];
        foreach ($partners as $p) {
            $otherId = (int) $p['other_id'];
            $lastId  = (int) $p['last_id'];

            $user = other_user_info($pdo, $otherId);
            if (!$user) continue; // partner banned/removed since the last message

            $mStmt = $pdo->prepare('SELECT id, sender_id, body, status, is_read, edited_at, created_at FROM direct_messages WHERE id = :id');
            $mStmt->execute([':id' => $lastId]);
            $lastMessage = $mStmt->fetch();
            if (!$lastMessage) continue;

            $cStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM direct_messages
                 WHERE sender_id = :other AND recipient_id = :me AND is_read = 0 AND status != 'deleted'"
            );
            $cStmt->execute([':other' => $otherId, ':me' => $myId]);

            $threads[] = [
                'userId'      => $otherId,
                'username'    => $user['username'],
                'pfpId'       => $user['pfpId'],
                'presence'    => $user['presence'],
                'online'      => $user['online'],
                'status'      => $user['status'],
                'unreadCount' => (int) $cStmt->fetchColumn(),
                'lastMessage' => format_message($lastMessage),
            ];
        }

        $nextCursor = count($partners) === $limit ? (int) end($partners)['last_id'] : null;

        echo json_encode(['ok' => true, 'threads' => $threads, 'nextCursor' => $nextCursor]);
        exit;
    }

    if ($action === 'thread') {
        $otherId = (int) ($_GET['userId'] ?? 0);
        $limit   = max(1, min(100, (int) ($_GET['limit'] ?? 30)));
        if ($otherId <= 0) {
            json_error(400, 'Missing userId.');
        }

        $stmt = $pdo->prepare(
            'SELECT id, sender_id, body, status, is_read, edited_at, created_at FROM direct_messages
             WHERE (sender_id = :me AND recipient_id = :other) OR (sender_id = :other AND recipient_id = :me)
             ORDER BY id DESC LIMIT ' . $limit
        );
        $stmt->execute([':me' => $myId, ':other' => $otherId]);
        $rows = array_reverse($stmt->fetchAll()); // oldest -> newest for display

        $upd = $pdo->prepare(
            'UPDATE direct_messages SET is_read = 1
             WHERE sender_id = :other AND recipient_id = :me AND is_read = 0'
        );
        $upd->execute([':other' => $otherId, ':me' => $myId]);

        echo json_encode([
            'ok'         => true,
            'messages'   => array_map('format_message', $rows),
            'otherUser'  => other_user_info($pdo, $otherId),
            'readUpToId' => read_up_to_id($pdo, $myId, $otherId),
        ]);
        exit;
    }

    if ($action === 'poll') {
        $otherId = (int) ($_GET['userId'] ?? 0);
        $afterId = (int) ($_GET['afterId'] ?? 0);
        if ($otherId <= 0) {
            json_error(400, 'Missing userId.');
        }

        $stmt = $pdo->prepare(
            'SELECT id, sender_id, body, status, is_read, edited_at, created_at FROM direct_messages
             WHERE ((sender_id = :me AND recipient_id = :other) OR (sender_id = :other AND recipient_id = :me))
             AND id > :after_id
             ORDER BY id ASC LIMIT 50'
        );
        $stmt->execute([':me' => $myId, ':other' => $otherId, ':after_id' => $afterId]);
        $rows = $stmt->fetchAll();

        $upd = $pdo->prepare(
            'UPDATE direct_messages SET is_read = 1
             WHERE sender_id = :other AND recipient_id = :me AND is_read = 0'
        );
        $upd->execute([':other' => $otherId, ':me' => $myId]);

        echo json_encode([
            'ok'         => true,
            'messages'   => array_map('format_message', $rows),
            'otherUser'  => other_user_info($pdo, $otherId),
            // Highest id of MY messages the other person has read. The client
            // renders a single "seen" boundary (every own message with
            // id <= this is a blue double-check, everything above is a plain
            // delivered double-check) rather than diffing per-message read
            // state on every poll tick.
            'readUpToId' => read_up_to_id($pdo, $myId, $otherId),
        ]);
        exit;
    }

    if ($action === 'typing_status') {
        $otherId = (int) ($_GET['userId'] ?? 0);
        if ($otherId <= 0) {
            json_error(400, 'Missing userId.');
        }
        $stmt = $pdo->prepare(
            "SELECT 1 FROM dm_typing
             WHERE user_id = :other AND other_id = :me
             AND updated_at > datetime('now', :window)"
        );
        $stmt->execute([':other' => $otherId, ':me' => $myId, ':window' => '-' . TYPING_FRESHNESS_SECONDS . ' seconds']);
        echo json_encode(['ok' => true, 'typing' => (bool) $stmt->fetchColumn()]);
        exit;
    }

    json_error(400, 'Unknown action.');
}

// ---------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------
if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    $_POST = array_merge($_POST, $body);
    require_csrf();

    $action = $body['action'] ?? '';

    if ($action === 'send') {
        $recipientId = (int) ($body['recipientId'] ?? 0);
        $text = is_string($body['body'] ?? null) ? trim($body['body']) : '';

        if ($recipientId <= 0) {
            json_error(400, 'Missing recipientId.');
        }
        if ($recipientId === $myId) {
            json_error(400, "You can't message yourself.");
        }
        if ($text === '') {
            json_error(400, "Message can't be empty.");
        }
        if (mb_strlen($text) > MAX_DM_BODY_LENGTH) {
            json_error(400, 'Message is too long.');
        }

        $uStmt = $pdo->prepare('SELECT id FROM users WHERE id = :id AND is_banned = 0');
        $uStmt->execute([':id' => $recipientId]);
        if (!$uStmt->fetch()) {
            json_error(404, 'User not found.');
        }

        $ins = $pdo->prepare(
            "INSERT INTO direct_messages (sender_id, recipient_id, body, status, is_read, created_at)
             VALUES (:sender, :recipient, :body, 'sent', 0, datetime('now'))"
        );
        $ins->execute([
            ':sender'    => $myId,
            ':recipient' => $recipientId,
            ':body'      => $text,
        ]);
        $id = (int) $pdo->lastInsertId();

        $stmt = $pdo->prepare('SELECT id, sender_id, body, status, is_read, edited_at, created_at FROM direct_messages WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        echo json_encode(['ok' => true, 'message' => format_message($row)]);
        exit;
    }

    if ($action === 'edit') {
        $messageId = (int) ($body['messageId'] ?? 0);
        $text = is_string($body['body'] ?? null) ? trim($body['body']) : '';

        if ($messageId <= 0) {
            json_error(400, 'Missing messageId.');
        }
        if ($text === '') {
            json_error(400, "Message can't be empty.");
        }
        if (mb_strlen($text) > MAX_DM_BODY_LENGTH) {
            json_error(400, 'Message is too long.');
        }

        $stmt = $pdo->prepare('SELECT sender_id, status FROM direct_messages WHERE id = :id');
        $stmt->execute([':id' => $messageId]);
        $row = $stmt->fetch();
        if (!$row) {
            json_error(404, 'Message not found.');
        }
        if ((int) $row['sender_id'] !== $myId) {
            json_error(403, "You can't edit this message.");
        }
        if ($row['status'] === 'deleted') {
            json_error(400, "Can't edit a deleted message.");
        }

        $upd = $pdo->prepare(
            "UPDATE direct_messages SET body = :body, edited_at = datetime('now') WHERE id = :id"
        );
        $upd->execute([':body' => $text, ':id' => $messageId]);

        $stmt = $pdo->prepare('SELECT id, sender_id, body, status, is_read, edited_at, created_at FROM direct_messages WHERE id = :id');
        $stmt->execute([':id' => $messageId]);
        echo json_encode(['ok' => true, 'message' => format_message($stmt->fetch())]);
        exit;
    }

    if ($action === 'delete') {
        $messageId = (int) ($body['messageId'] ?? 0);
        if ($messageId <= 0) {
            json_error(400, 'Missing messageId.');
        }

        $stmt = $pdo->prepare('SELECT sender_id FROM direct_messages WHERE id = :id');
        $stmt->execute([':id' => $messageId]);
        $row = $stmt->fetch();
        if (!$row) {
            json_error(404, 'Message not found.');
        }
        if ((int) $row['sender_id'] !== $myId) {
            json_error(403, "You can't delete this message.");
        }

        $upd = $pdo->prepare("UPDATE direct_messages SET status = 'deleted' WHERE id = :id");
        $upd->execute([':id' => $messageId]);

        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'typing') {
        $recipientId = (int) ($body['recipientId'] ?? 0);
        if ($recipientId <= 0) {
            json_error(400, 'Missing recipientId.');
        }
        $upd = $pdo->prepare(
            "INSERT INTO dm_typing (user_id, other_id, updated_at) VALUES (:me, :other, datetime('now'))
             ON CONFLICT (user_id, other_id) DO UPDATE SET updated_at = datetime('now')"
        );
        $upd->execute([':me' => $myId, ':other' => $recipientId]);
        echo json_encode(['ok' => true]);
        exit;
    }

    json_error(400, 'Unknown action.');
}

json_error(405, 'Method not allowed.');