<?php
declare(strict_types=1);
/**
 * POST /api/user-report.php
 * body: JSON { targetId, reason, csrf_token }
 * Inserts into the shared `reports` table with target_type = 'user',
 * same table admin tooling already reads for comment/dm reports.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_REASON_LENGTH = 500;

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
$reason   = isset($body['reason']) ? trim((string) $body['reason']) : '';

if ($targetId <= 0) {
    json_error(400, 'Missing targetId.');
}
if ($targetId === (int) $me['id']) {
    json_error(400, "You can't report yourself.");
}
if ($reason === '') {
    json_error(422, 'Please describe why you\'re reporting this profile.');
}
if (mb_strlen($reason) > MAX_REASON_LENGTH) {
    json_error(422, 'Reason is too long (max ' . MAX_REASON_LENGTH . ' characters).');
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
$stmt->execute([':id' => $targetId]);
if (!$stmt->fetch()) {
    json_error(404, 'User not found.');
}

$stmt = $pdo->prepare(
    "INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (:reporter, 'user', :target, :reason)"
);
$stmt->execute([
    ':reporter' => $me['id'],
    ':target'   => $targetId,
    ':reason'   => $reason,
]);

echo json_encode(['ok' => true]);
