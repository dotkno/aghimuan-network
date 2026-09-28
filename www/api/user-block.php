<?php
declare(strict_types=1);
/**
 * POST /api/user-block.php
 * body: JSON { targetId, action: 'block'|'unblock', csrf_token }
 *
 * Blocking someone also tears down any friend relationship between you two
 * (pending or accepted) — a block shouldn't leave a dangling friends row.
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
$action   = isset($body['action']) ? (string) $body['action'] : '';
if ($targetId <= 0) {
    json_error(400, 'Missing targetId.');
}
if ($targetId === (int) $me['id']) {
    json_error(400, "You can't block yourself.");
}
if (!in_array($action, ['block', 'unblock'], true)) {
    json_error(400, 'Invalid action.');
}

if ($action === 'block') {
    $stmt = $pdo->prepare(
        'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (:me, :them)'
    );
    $stmt->execute([':me' => $me['id'], ':them' => $targetId]);

    $stmt = $pdo->prepare(
        'DELETE FROM friends
         WHERE (user_id = :me AND friend_id = :them) OR (user_id = :them AND friend_id = :me)'
    );
    $stmt->execute([':me' => $me['id'], ':them' => $targetId]);

    echo json_encode(['ok' => true, 'blocked' => true]);
    exit;
}

$stmt = $pdo->prepare('DELETE FROM blocks WHERE blocker_id = :me AND blocked_id = :them');
$stmt->execute([':me' => $me['id'], ':them' => $targetId]);

echo json_encode(['ok' => true, 'blocked' => false]);
