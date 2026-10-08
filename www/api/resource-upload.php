<?php
/**
 * POST /api/resource-upload.php
 * multipart/form-data: field "image" (single image file), field "csrf_token"
 *
 * Handles the optional cover image for Resource Hub suggestions. Same
 * security model as api/creation-upload.php: login + verified PCU Gmail +
 * CSRF, getimagesize() validation, GD re-encode to WebP (strips
 * EXIF/payloads), 5MB cap. Returns { ok, url } for the suggest form to
 * attach to its api/resources.php POST as image_url.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/resources-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'Method not allowed.');
}

$pdo = get_db();
require_csrf();

$user = current_user($pdo);
if (!$user) {
    json_error(401, 'You must be logged in.');
}
if ((int) ($user['is_verified'] ?? 0) !== 1) {
    json_error(403, 'You must verify your PCU Gmail account to upload a cover image.');
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    json_error(400, 'No image uploaded.');
}

try {
    $url = save_resource_image($_FILES['image']);
} catch (RuntimeException $e) {
    json_error(422, $e->getMessage());
}

if ($url === null) {
    json_error(400, 'No image uploaded.');
}

echo json_encode(['ok' => true, 'url' => $url]);
