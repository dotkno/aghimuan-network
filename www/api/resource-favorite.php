<?php
/**
 * api/resource-favorite.php — per-user favorites for the Resource Hub.
 *
 * GET  /api/resource-favorite.php?resource_id=X -> { favCount, favorited }
 *        (public count; favorited is false for guests)
 * POST /api/resource-favorite.php               -> toggle, body JSON { resourceId, csrf_token }
 *        -> { ok, favorited, favCount }
 *
 * Toggle path mirrors api/reactions.php: SELECT-then-DELETE/INSERT, then
 * re-query the count. Only approved resources can be favorited — anything
 * else answers 404 (same as missing) so pending rows never leak.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

function fav_count(PDO $pdo, int $resourceId): int {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM resource_favorites WHERE resource_id = :id');
    $stmt->execute([':id' => $resourceId]);
    return (int) $stmt->fetchColumn();
}

$pdo = get_db();
$me = current_user($pdo);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $resourceId = (int) ($_GET['resource_id'] ?? 0);
    if ($resourceId <= 0) {
        json_error(400, 'Invalid resource.');
    }
    $stmt = $pdo->prepare("SELECT id FROM resources WHERE id = :id AND status = 'approved'");
    $stmt->execute([':id' => $resourceId]);
    if (!$stmt->fetchColumn()) {
        json_error(404, 'Resource not found.');
    }
    $favorited = false;
    if ($me) {
        $chk = $pdo->prepare('SELECT 1 FROM resource_favorites WHERE user_id = :u AND resource_id = :r');
        $chk->execute([':u' => (int) $me['id'], ':r' => $resourceId]);
        $favorited = (bool) $chk->fetchColumn();
    }
    echo json_encode([
        'ok' => true,
        'favCount' => fav_count($pdo, $resourceId),
        'favorited' => $favorited,
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    // Same JSON-CSRF merge as api/reactions.php and api/resources.php.
    $_POST = array_merge($_POST, $body);

    require_csrf();

    if (!$me) {
        json_error(401, 'You must be logged in.');
    }
    $userId = (int) $me['id'];

    $resourceId = (int) ($body['resourceId'] ?? $body['resource_id'] ?? 0);
    if ($resourceId <= 0) {
        json_error(400, 'Invalid resource.');
    }

    // Approved-only: pending/rejected rows answer 404, identical to a
    // missing id, so the toggle can never leak unreviewed suggestions.
    $stmt = $pdo->prepare("SELECT id FROM resources WHERE id = :id AND status = 'approved'");
    $stmt->execute([':id' => $resourceId]);
    if (!$stmt->fetchColumn()) {
        json_error(404, 'Resource not found.');
    }

    $chk = $pdo->prepare('SELECT 1 FROM resource_favorites WHERE user_id = :u AND resource_id = :r');
    $chk->execute([':u' => $userId, ':r' => $resourceId]);
    if ($chk->fetchColumn()) {
        $pdo->prepare('DELETE FROM resource_favorites WHERE user_id = :u AND resource_id = :r')
            ->execute([':u' => $userId, ':r' => $resourceId]);
        $favorited = false;
    } else {
        $pdo->prepare(
            "INSERT INTO resource_favorites (user_id, resource_id, created_at)
             VALUES (:u, :r, datetime('now'))"
        )->execute([':u' => $userId, ':r' => $resourceId]);
        $favorited = true;
    }

    echo json_encode([
        'ok' => true,
        'favorited' => $favorited,
        'favCount' => fav_count($pdo, $resourceId),
    ]);
    exit;
}

json_error(405, 'Method not allowed.');
