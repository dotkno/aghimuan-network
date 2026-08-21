<?php
declare(strict_types=1);
/**
 * POST /api/friend-remove.php
 * Removes any friends row between you and targetId, regardless of
 * direction or status — covers unfriending an accepted friend AND
 * cancelling a request you sent. body: JSON { targetId, csrf_token }
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

$stmt = $pdo->prepare(
    'DELETE FROM friends
     WHERE (user_id = :me AND friend_id = :them) OR (user_id = :them AND friend_id = :me)'
);
$stmt->execute([':me' => $me['id'], ':them' => $targetId]);

echo json_encode(['ok' => true, 'friendStatus' => 'none']);
