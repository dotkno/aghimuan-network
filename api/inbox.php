<?php
declare(strict_types=1);
/**
 * GET  /api/inbox.php?action=summary
 *   -> { ok, unreadCount }  (pending friend requests + unread notifications combined)
 *
 * GET  /api/inbox.php?action=list&limit=20&before=<created_at cursor>
 *   -> { ok, items: [...], nextCursor }
 *   Merges two sources into one feed, newest first:
 *     - pending friend requests (live query against `friends`, same as
 *       friend-requests.php — that table IS the source of truth for
 *       "pending", so we read it directly rather than duplicating it
 *       into `notifications`)
 *     - rows from `notifications` (friend_accept, and future types:
 *       mention, comment, reaction, system, ...)
 *   Friend request items still carry a `requesterId` so the client can
 *   accept/decline them by calling the EXISTING friend-respond.php /
 *   friend-remove.php — this endpoint doesn't duplicate that logic.
 *
 * POST /api/inbox.php  body: { action: 'mark_read', id, csrf_token }
 *   Marks one `notifications` row read. (Friend request items aren't
 *   "read" — they resolve via accept/decline, handled elsewhere.)
 *
 * POST /api/inbox.php  body: { action: 'mark_all_read', csrf_token }
 *   Marks all of the current user's `notifications` rows read.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/notifications.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// Keep in sync with PRESET_IDS in account-widget.js / user-profile-popup.js / profile.php.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

function avatar_url(?string $pfpId): ?string {
    $pfpId = $pfpId !== null && $pfpId !== '' ? $pfpId : 'default';
    if (in_array($pfpId, PRESET_IDS, true)) {
        return null;
    }
    return '/uploads/pfp/' . basename($pfpId);
}

$pdo = get_db();
$me  = current_user($pdo);
if (!$me) {
    json_error(401, 'You must be logged in.');
}

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    if ($action === 'summary') {
        $markedAt = $_SESSION['inbox_marked_read_at'] ?? null;

        $sql = 'SELECT COUNT(*) FROM friends WHERE friend_id = :me AND status = :status';
        $params = [':me' => $me['id'], ':status' => 'pending'];

        if ($markedAt !== null) {
            $sql .= ' AND created_at > :marked_at';
            $params[':marked_at'] = $markedAt;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $pendingRequests = (int) $stmt->fetchColumn();

        $unreadNotifs = get_unread_notification_count($pdo, (int) $me['id']);

        echo json_encode(['ok' => true, 'unreadCount' => $pendingRequests + $unreadNotifs]);
        exit;
    }

    if ($action === 'list') {
        $limit  = max(1, min(50, (int) ($_GET['limit'] ?? 20)));
        $before = $_GET['before'] ?? null; // ISO-ish datetime cursor, string-comparable

        // Pending friend requests -- same query as friend-requests.php.
        $sql = 'SELECT f.user_id AS requester_id, f.created_at, u.username, u.pfp_id
                FROM friends f
                JOIN users u ON u.id = f.user_id
                WHERE f.friend_id = :me AND f.status = :status AND u.is_banned = 0';
        $params = [':me' => $me['id'], ':status' => 'pending'];
        if ($before !== null) {
            $sql .= ' AND f.created_at < :before';
            $params[':before'] = $before;
        }
        $sql .= ' ORDER BY f.created_at DESC LIMIT ' . $limit;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $friendRequestItems = array_map(function (array $row): array {
            return [
                'kind'        => 'friend_request',
                'id'          => 'fr_' . $row['requester_id'], // synthetic, stable string id for the DOM key
                'requesterId' => (int) $row['requester_id'],
                'actorUsername' => $row['username'],
                'avatarUrl'   => avatar_url($row['pfp_id']),
                'pfpId'       => $row['pfp_id'] !== null && $row['pfp_id'] !== '' ? $row['pfp_id'] : 'default',
                'createdAt'   => $row['created_at'],
                'isRead'      => false, // pending requests are always "unread" until acted on
            ];
        }, $stmt->fetchAll());

        // notifications table rows.
        $notifRows = get_notifications($pdo, (int) $me['id'], $limit, null);
        if ($before !== null) {
            $notifRows = array_values(array_filter($notifRows, fn($r) => $r['created_at'] < $before));
        }
        $notifItems = array_map(function (array $row): array {
            return [
                'kind'          => $row['type'],
                'id'            => (int) $row['id'],
                'actorUsername' => $row['actor_username'],
                'avatarUrl'     => avatar_url($row['actor_pfp_id']),
                'pfpId'         => $row['actor_pfp_id'] !== null && $row['actor_pfp_id'] !== '' ? $row['actor_pfp_id'] : 'default',
                'payload'       => $row['payload'],
                'createdAt'     => $row['created_at'],
                'isRead'        => $row['is_read'],
            ];
        }, $notifRows);

        // Merge + sort newest-first, then trim to the page size.
        $merged = array_merge($friendRequestItems, $notifItems);
        usort($merged, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']));
        $page = array_slice($merged, 0, $limit);

        $nextCursor = count($page) === $limit ? end($page)['createdAt'] : null;

        echo json_encode(['ok' => true, 'items' => $page, 'nextCursor' => $nextCursor]);
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

    if ($action === 'mark_read') {
        $id = isset($body['id']) ? (int) $body['id'] : 0;
        if ($id <= 0) {
            json_error(400, 'Missing id.');
        }
        mark_notification_read($pdo, (int) $me['id'], $id);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'mark_all_read') {
        mark_all_notifications_read($pdo, (int) $me['id']);

        $stmt = $pdo->prepare('SELECT MAX(created_at) FROM friends WHERE friend_id = :me AND status = "pending"');
        $stmt->execute([':me' => $me['id']]);
        $latestFr = $stmt->fetchColumn();

        $_SESSION['inbox_marked_read_at'] = $latestFr ?: date('Y-m-d H:i:s');

        echo json_encode(['ok' => true]);
        exit;
    }

    json_error(400, 'Unknown action.');
}

json_error(405, 'Method not allowed.');