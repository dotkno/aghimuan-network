<?php
/**
 * POST /api/creation-upload.php
 * multipart/form-data: field "media[]" (multiple image files), field "csrf_token"
 *
 * Handles image uploads for Creations Hub submissions. Similar security model
 * to upload-avatar.php: validates actual image data via getimagesize(),
 * re-encodes through GD to strip EXIF/payloads, and saves as WebP.
 *
 * Returns an array of uploaded URLs that can be passed to creations.php.
 */

declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 10; // Maximum 10 images per creation
const MAX_DIMENSION = 4096; // Max width/height
const WEBP_QUALITY = 85;

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
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

if ((int)($user['is_verified'] ?? 0) !== 1) {
    json_error(403, 'You must verify your PCU Gmail account to upload media.');
}

if (!extension_loaded('gd')) {
    json_error(500, 'Image processing is not available on this server (GD extension missing).');
}

if (!isset($_FILES['media']) || !is_array($_FILES['media'])) {
    json_error(400, 'No files uploaded.');
}

$files = $_FILES['media'];

// Handle single file upload (not in array format)
if (!isset($files['tmp_name']) || !is_array($files['tmp_name'])) {
    json_error(400, 'Invalid upload format.');
}

$fileCount = count($files['tmp_name']);
if ($fileCount === 0) {
    json_error(400, 'No files uploaded.');
}
if ($fileCount > MAX_FILES) {
    json_error(422, 'Maximum ' . MAX_FILES . ' files allowed per upload.');
}

$uploadDir = __DIR__ . '/../uploads/creations';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    json_error(500, 'Could not create upload directory.');
}

$uploadedUrls = [];
$loaders = [
    IMAGETYPE_JPEG => 'imagecreatefromjpeg',
    IMAGETYPE_PNG  => 'imagecreatefrompng',
    IMAGETYPE_WEBP => 'imagecreatefromwebp',
];

for ($i = 0; $i < $fileCount; $i++) {
    if ($files['error'][$i] !== UPLOAD_ERR_OK) {
        continue; // Skip errored files
    }

    $tmpName = $files['tmp_name'][$i];
    $fileSize = $files['size'][$i];

    if ($fileSize > MAX_UPLOAD_BYTES) {
        continue; // Skip oversized files
    }

    // Validate actual image data
    $info = @getimagesize($tmpName);
    if ($info === false) {
        continue; // Skip non-images
    }

    $type = $info[2];
    if (!isset($loaders[$type])) {
        continue; // Skip unsupported formats
    }

    // Check dimensions
    if ($info[0] > MAX_DIMENSION || $info[1] > MAX_DIMENSION) {
        continue; // Skip oversized dimensions
    }

    $loaderFn = $loaders[$type];
    $srcImage = @$loaderFn($tmpName);
    if (!$srcImage) {
        continue;
    }

    // Scale down if too large, but preserve aspect ratio
    $srcW = imagesx($srcImage);
    $srcH = imagesy($srcImage);

    $maxSize = 1920; // Max output dimension
    if ($srcW > $maxSize || $srcH > $maxSize) {
        $ratio = min($maxSize / $srcW, $maxSize / $srcH);
        $newW = (int)($srcW * $ratio);
        $newH = (int)($srcH * $ratio);
        $dest = imagecreatetruecolor($newW, $newH);
        imagealphablending($dest, false);
        imagesavealpha($dest, true);
        $transparent = imagecolorallocatealpha($dest, 0, 0, 0, 127);
        imagefilledrectangle($dest, 0, 0, $newW, $newH, $transparent);
        imagecopyresampled($dest, $srcImage, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);
        imagedestroy($srcImage);
        $srcImage = $dest;
    }

    // Generate unique filename
    $filename = 'c' . $user['id'] . '_' . bin2hex(random_bytes(8)) . '_' . $i . '.webp';
    $fullPath = $uploadDir . '/' . $filename;

    if (!imagewebp($srcImage, $fullPath, WEBP_QUALITY)) {
        imagedestroy($srcImage);
        continue;
    }
    imagedestroy($srcImage);

    $uploadedUrls[] = '/uploads/creations/' . $filename;
}

if (empty($uploadedUrls)) {
    json_error(422, 'No valid images were uploaded.');
}

echo json_encode([
    'ok' => true,
    'urls' => $uploadedUrls,
]);
