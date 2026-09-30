<?php
/**
 * POST /api/upload-avatar.php
 * multipart/form-data: field "avatar" (the image file), field "csrf_token",
 * optional field "kind": "avatar" (default) or "banner".
 *
 *   kind=avatar -> 256x256 square WebP into uploads/pfp/, sets users.pfp_id,
 *                  responds { profile: { pfpId } }
 *   kind=banner -> 1200x300 (4:1) WebP into uploads/banner/, sets
 *                  users.banner_id, responds { profile: { bannerId } }
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
require_once __DIR__ . '/../includes/app-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB — mirrors AGHI_MAX_AVATAR_BYTES in app-config.php
const WEBP_QUALITY     = 85;

// Preset rule owned by includes/app-config.php —
// anything NOT in aghi_preset_ids() is treated as an uploaded filename on disk.

// Uploaded ids are always generated below as u<userId>_<12hex>.webp —
// profile.php validates bannerId against the same shape.
const BANNER_PATTERN = '/^u\d+_[0-9a-f]{12}\.webp$/';

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// Banner support lives behind a migration (upgrade-add-banner.sql). Detect
// the column instead of assuming it so an un-migrated database gets a clear
// 400 instead of a PDO exception on an unknown column.
function users_column_exists(PDO $pdo, string $column): bool {
    static $cache = [];
    if (!isset($cache[$column])) {
        $cols = $pdo->query('PRAGMA table_info(users)')->fetchAll();
        $cache[$column] = in_array($column, array_column($cols, 'name'), true);
    }
    return $cache[$column];
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

$kind = ($_POST['kind'] ?? 'avatar') === 'banner' ? 'banner' : 'avatar';

// Profile banners are a verified-members perk (mirrors the client-side lock
// in account-widget.js) — avatars stay open to everyone.
if ($kind === 'banner' && (int)($user['is_verified'] ?? 0) !== 1) {
    json_error(403, 'Verify your PCU Gmail account to upload a profile banner.');
}

if ($kind === 'banner' && !users_column_exists($pdo, 'banner_id')) {
    json_error(400, 'Banner support is not enabled on this server yet.');
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

$srcW = imagesx($srcImage);
$srcH = imagesy($srcImage);

if ($kind === 'banner') {
    // Center-crop to the 4:1 banner aspect, then downscale to 1200x300.
    $outW = 1200;
    $outH = 300;
    if ($srcW / $srcH > $outW / $outH) {
        $cropW = (int) round($srcH * $outW / $outH);
        $cropH = $srcH;
    } else {
        $cropW = $srcW;
        $cropH = (int) round($srcW * $outH / $outW);
    }
} else {
    // Center-crop to a square, then downscale to the fixed output size.
    $outW = 256;
    $outH = 256;
    $cropW = min($srcW, $srcH);
    $cropH = $cropW;
}
$srcX = (int) (($srcW - $cropW) / 2);
$srcY = (int) (($srcH - $cropH) / 2);

$dest = imagecreatetruecolor($outW, $outH);
imagealphablending($dest, false);
imagesavealpha($dest, true);
$transparent = imagecolorallocatealpha($dest, 0, 0, 0, 127);
imagefilledrectangle($dest, 0, 0, $outW, $outH, $transparent);

imagecopyresampled(
    $dest, $srcImage,
    0, 0, $srcX, $srcY,
    $outW, $outH, $cropW, $cropH
);
imagedestroy($srcImage);

// Lives inside www/ (unlike the DB) because these files need to be
// web-servable. That's fine — nothing here is sensitive, and every file in
// this folder is one we generated ourselves, not a raw user upload.
$subdir   = $kind === 'banner' ? 'banner' : 'pfp';
$uploadDir = __DIR__ . '/../uploads/' . $subdir;
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

// Clean up the previous custom file (if any) so the upload folder doesn't
// silently accumulate orphaned files every time someone re-uploads.
if ($kind === 'banner') {
    $old = (string) ($user['banner_id'] ?? '');
    if ($old !== '' && preg_match(BANNER_PATTERN, $old)) {
        $oldPath = $uploadDir . '/' . basename($old);
        if (is_file($oldPath)) {
            @unlink($oldPath);
        }
    }
    $stmt = $pdo->prepare('UPDATE users SET banner_id = :banner, updated_at = datetime("now") WHERE id = :id');
    $stmt->execute([':banner' => $filename, ':id' => $user['id']]);
    echo json_encode(['profile' => ['bannerId' => $filename]]);
    exit;
}

$old = (string) $user['pfp_id'];
if (!in_array($old, AGHI_PRESET_IDS, true)) {
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
