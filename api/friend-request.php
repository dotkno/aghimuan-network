<?php
declare(strict_types=1);
/**
 * POST /api/friend-request.php
 * Send a friend request. body: JSON { targetId, csrf_token }
 *
 * If the target already sent YOU a pending request, this auto-accepts it
 * instead of creating a second row (the friends table's PK is an ordered
 * (user_id, friend_id) pair, so A->B and B->A are technically different
 * rows — this keeps us from ever having both directions pending at once).
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

$pdo = get_db();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'Method not allowed.');
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    json_error(400, 'Invalid JSON body.');
}
$_POST = array_merge($_POST, $body);

require_csrf();

$me = current_user($pdo);
if (!$me) {
    json_error(401, 'You must be logged in.');
}

$targetId = isset($body['targetId']) ? (int) $body['targetId'] : 0;
if ($targetId <= 0) {
    json_error(400, 'Missing targetId.');
}
if ($targetId === (int) $me['id']) {
    json_error(400, "You can't add yourself.");
}

$stmt = $pdo->prepare('SELECT id, is_banned FROM users WHERE id = :id');
$stmt->execute([':id' => $targetId]);
$target = $stmt->fetch();
if (!$target || (int) $target['is_banned'] === 1) {
    json_error(404, 'User not found.');
}

// Either direction blocked -> no request allowed.
$stmt = $pdo->prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = :me AND blocked_id = :them)
                             OR (blocker_id = :them AND blocked_id = :me)'
);
$stmt->execute([':me' => $me['id'], ':them' => $targetId]);
if ($stmt->fetch()) {
    json_error(403, "You can't send a friend request to this user.");
}

$stmt = $pdo->prepare(
    'SELECT user_id, friend_id, status, requested_by FROM friends
     WHERE (user_id = :me AND friend_id = :them) OR (user_id = :them AND friend_id = :me)'
);
$stmt->execute([':me' => $me['id'], ':them' => $targetId]);
$existing = $stmt->fetch();

if ($existing) {
    if ($existing['status'] === 'accepted') {
        echo json_encode(['ok' => true, 'friendStatus' => 'friends']);
        exit;
    }
    if ((int) $existing['requested_by'] === (int) $me['id']) {
        // Already sent, nothing to do.
        echo json_encode(['ok' => true, 'friendStatus' => 'pending_sent']);
        exit;
    }
    // They already requested us -> accept it now instead of creating a
    // second pending row in the other direction.
    $stmt = $pdo->prepare(
        'UPDATE friends SET status = :status
         WHERE user_id = :uid AND friend_id = :fid'
    );
    $stmt->execute([
        ':status' => 'accepted',
        ':uid'    => $existing['user_id'],
        ':fid'    => $existing['friend_id'],
    ]);
    echo json_encode(['ok' => true, 'friendStatus' => 'friends']);
    exit;
}

$stmt = $pdo->prepare(
    'INSERT INTO friends (user_id, friend_id, status, requested_by) VALUES (:me, :them, :status, :me)'
);
$stmt->execute([
    ':me'     => $me['id'],
    ':them'   => $targetId,
    ':status' => 'pending',
]);

echo json_encode(['ok' => true, 'friendStatus' => 'pending_sent']);
