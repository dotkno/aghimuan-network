<?php
/**
 * POST /api/upload-avatar.php
 * multipart/form-data: field "avatar" (the image file), field "csrf_token"
 *
 * Never trusts the uploaded file's extension or claimed MIME type — reads
 * the actual image data via getimagesize(), then re-encodes it from scratch
 * through GD. That re-encode is what actually matters security-wise: it
 * strips EXIF, any polyglot/embedded payload, and anything that isn't
 * literally pixel data, because the output file is built pixel-by-pixel
 * from what GD decoded, not a copy of the original bytes.
 */

declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
const OUTPUT_SIZE       = 256;             // px, square output
const WEBP_QUALITY      = 85;

// Keep this identical to PRESET_IDS in profile.php / PFP_PRESETS ids in the widget —
// anything NOT in this list is treated as an uploaded filename on disk.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'Method not allowed.');
}

$pdo = get_db();
require_csrf(); // multipart POST still populates $_POST['csrf_token'] normally

$user = current_user($pdo);
if (!$user) {
    json_error(401, 'You must be logged in.');
}

if (!extension_loaded('gd')) {
    json_error(500, 'Image processing is not available on this server (GD extension missing).');
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] === UPLOAD_ERR_NO_FILE) {
    json_error(400, 'No file uploaded.');
}

$file = $_FILES['avatar'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    json_error(400, 'Upload failed (error code ' . $file['error'] . ').');
}

if ($file['size'] > MAX_UPLOAD_BYTES) {
    json_error(422, 'Image is too large (max 2MB).');
}

// Inspect the actual file contents — this also acts as a gate against a
// renamed non-image (e.g. a .png that's actually a script) since getimagesize()
// only succeeds on real image data.
$info = @getimagesize($file['tmp_name']);
if ($info === false) {
    json_error(422, 'File is not a valid image.');
}

$loaders = [
    IMAGETYPE_JPEG => 'imagecreatefromjpeg',
    IMAGETYPE_PNG  => 'imagecreatefrompng',
    IMAGETYPE_WEBP => 'imagecreatefromwebp',
];
$type = $info[2];
if (!isset($loaders[$type])) {
    json_error(422, 'Only JPEG, PNG, or WebP images are allowed.');
}

$loaderFn = $loaders[$type];
$srcImage = @$loaderFn($file['tmp_name']);
if (!$srcImage) {
    json_error(422, 'Could not read image data.');
}

// Center-crop to a square, then downscale to the fixed output size.
$srcW = imagesx($srcImage);
$srcH = imagesy($srcImage);
$cropSize = min($srcW, $srcH);
$srcX = (int) (($srcW - $cropSize) / 2);
$srcY = (int) (($srcH - $cropSize) / 2);

$dest = imagecreatetruecolor(OUTPUT_SIZE, OUTPUT_SIZE);
imagealphablending($dest, false);
imagesavealpha($dest, true);
$transparent = imagecolorallocatealpha($dest, 0, 0, 0, 127);
imagefilledrectangle($dest, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE, $transparent);

imagecopyresampled(
    $dest, $srcImage,
    0, 0, $srcX, $srcY,
    OUTPUT_SIZE, OUTPUT_SIZE, $cropSize, $cropSize
);
imagedestroy($srcImage);

// Lives inside www/ (unlike the DB) because these files need to be
// web-servable. That's fine — nothing here is sensitive, and every file in
// this folder is one we generated ourselves, not a raw user upload.
$uploadDir = __DIR__ . '/../uploads/pfp';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    imagedestroy($dest);
    json_error(500, 'Could not create upload directory.');
}

$filename = 'u' . $user['id'] . '_' . bin2hex(random_bytes(6)) . '.webp';
$fullPath = $uploadDir . '/' . $filename;

if (!imagewebp($dest, $fullPath, WEBP_QUALITY)) {
    imagedestroy($dest);
    json_error(500, 'Failed to save image.');
}
imagedestroy($dest);

// Clean up the previous custom avatar file (if any) so uploads/pfp/ doesn't
// silently accumulate orphaned files every time someone re-uploads.
$old = (string) $user['pfp_id'];
if (!in_array($old, PRESET_IDS, true)) {
    $oldPath = $uploadDir . '/' . basename($old);
    if (is_file($oldPath)) {
        @unlink($oldPath);
    }
}

$stmt = $pdo->prepare('UPDATE users SET pfp_id = :pfp, updated_at = datetime("now") WHERE id = :id');
$stmt->execute([':pfp' => $filename, ':id' => $user['id']]);

echo json_encode([
    'profile' => [
        'pfpId' => $filename,
    ],
]);