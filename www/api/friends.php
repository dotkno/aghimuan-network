<?php
declare(strict_types=1);
/**
 * GET  /api/friends.php?action=list
 *   -> { ok, friends: [ { id, username, pfpId, presence, online, status }, ... ] }
 *   Returns all accepted friends for the current user.
 *
 * GET  /api/friends.php?action=status&targetId=<id>
 *   -> { ok, status: 'none'|'pending_sent'|'pending_received'|'friends' }
 *   Returns the friendship status between current user and targetId.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/app-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// Avatar + online rules owned by includes/app-config.php.

function normalize_pfp(?string $pfpId): string {
    return $pfpId !== null && $pfpId !== '' ? $pfpId : 'default';
}

$pdo = get_db();
$me = current_user($pdo);
if (!$me) {
    json_error(401, 'You must be logged in.');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'list') {
        // Get all accepted friends (both directions)
        $stmt = $pdo->prepare(
            "SELECT u.id, u.username, u.pfp_id, u.presence, u.status, u.last_seen
             FROM friends f
             JOIN users u ON (CASE WHEN f.user_id = :me THEN f.friend_id ELSE f.user_id END) = u.id
             WHERE (f.user_id = :me OR f.friend_id = :me)
             AND f.status = 'accepted'
             AND u.is_banned = 0
             ORDER BY u.username COLLATE NOCASE"
        );
        $stmt->execute([':me' => $me['id']]);
        $rows = $stmt->fetchAll();

        $friends = [];
        foreach ($rows as $row) {
            $lastSeen = $row['last_seen'] !== null ? (int) $row['last_seen'] : null;
            $online = $lastSeen !== null && (time() - $lastSeen) < AGHI_ONLINE_THRESHOLD_SECONDS;

            $friends[] = [
                'id' => (int) $row['id'],
                'username' => $row['username'],
                'pfpId' => normalize_pfp($row['pfp_id']),
                'presence' => $row['presence'] ?: 'online',
                'status' => $row['status'] ?: '',
                'online' => $online,
            ];
        }

        echo json_encode(['ok' => true, 'friends' => $friends]);
        exit;
    }

    if ($action === 'status') {
        $targetId = (int) ($_GET['targetId'] ?? 0);
        if ($targetId <= 0) {
            json_error(400, 'Missing targetId.');
        }

        $stmt = $pdo->prepare(
            'SELECT user_id, friend_id, status, requested_by FROM friends
             WHERE (user_id = :me AND friend_id = :them) OR (user_id = :them AND friend_id = :me)'
        );
        $stmt->execute([':me' => $me['id'], ':them' => $targetId]);
        $row = $stmt->fetch();

        if (!$row) {
            echo json_encode(['ok' => true, 'status' => 'none']);
            exit;
        }

        if ($row['status'] === 'accepted') {
            echo json_encode(['ok' => true, 'status' => 'friends']);
            exit;
        }

        if ((int) $row['requested_by'] === (int) $me['id']) {
            echo json_encode(['ok' => true, 'status' => 'pending_sent']);
            exit;
        }

        echo json_encode(['ok' => true, 'status' => 'pending_received']);
        exit;
    }

    json_error(400, 'Unknown action.');
}

json_error(405, 'Method not allowed.');
