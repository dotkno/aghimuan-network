<?php
declare(strict_types=1);
/**
 * POST /api/friend-respond.php
 * Accept or decline a friend request THAT WAS SENT TO YOU.
 * body: JSON { targetId, action: 'accept'|'decline', csrf_token }
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
$action   = isset($body['action']) ? (string) $body['action'] : '';
if ($targetId <= 0) {
    json_error(400, 'Missing targetId.');
}
if (!in_array($action, ['accept', 'decline'], true)) {
    json_error(400, 'Invalid action.');
}

// Must be a pending row that THEY sent to ME — otherwise there's nothing
// for this viewer to respond to.
$stmt = $pdo->prepare(
    'SELECT user_id, friend_id, status, requested_by FROM friends
     WHERE user_id = :them AND friend_id = :me'
);
$stmt->execute([':them' => $targetId, ':me' => $me['id']]);
$row = $stmt->fetch();

if (!$row || $row['status'] !== 'pending' || (int) $row['requested_by'] !== $targetId) {
    json_error(404, 'No pending request from this user.');
}

if ($action === 'accept') {
    $stmt = $pdo->prepare('UPDATE friends SET status = :status WHERE user_id = :uid AND friend_id = :fid');
    $stmt->execute([':status' => 'accepted', ':uid' => $row['user_id'], ':fid' => $row['friend_id']]);
    echo json_encode(['ok' => true, 'friendStatus' => 'friends']);
    exit;
}

// decline -> just remove the row
$stmt = $pdo->prepare('DELETE FROM friends WHERE user_id = :uid AND friend_id = :fid');
$stmt->execute([':uid' => $row['user_id'], ':fid' => $row['friend_id']]);
echo json_encode(['ok' => true, 'friendStatus' => 'none']);
