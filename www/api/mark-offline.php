<?php
/**
 * POST /api/mark-offline.php
 * Explicitly clears last_seen so a user shows as offline immediately,
 * instead of waiting out ONLINE_THRESHOLD_SECONDS in user-profile.php.
 * Fired via navigator.sendBeacon() on the 'pagehide' event — see the
 * heartbeat code in account-widget.js. sendBeacon can't set custom headers,
 * so the CSRF token travels in the body as regular form data.
 */
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();
require_csrf();

$user = current_user($pdo);
if (!$user) {
    http_response_code(401);
    echo json_encode(['ok' => false]);
    exit;
}

// Runs after current_user()'s own touch_last_seen() side effect, so this
// explicit NULL always wins and takes effect immediately.
$stmt = $pdo->prepare('UPDATE users SET last_seen = NULL WHERE id = :id');
$stmt->execute([':id' => $user['id']]);

echo json_encode(['ok' => true]);