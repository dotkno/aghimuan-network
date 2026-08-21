<?php
/**
 * GET /api/emoji-data.php -> the emoji picker dataset (categories + emoji lists), public, no auth.
 *
 * The actual data file lives outside the web root at
 * /home/container/data/assets/emoji-data.json (not under www/), so it can't
 * be fetched directly by the browser -- this endpoint just reads it off disk
 * and streams it back. The data is static (curated emoji list, not user
 * data), so this is cached hard: a long Cache-Control plus ETag/
 * Last-Modified based on the file's own mtime, so a browser that already has
 * it just gets a 304 instead of re-downloading ~40KB every visit.
 */

declare(strict_types=1);

const EMOJI_DATA_PATH = '/home/container/data/assets/emoji-data.json';

if (!file_exists(EMOJI_DATA_PATH)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Emoji data not found.']);
    exit;
}

$mtime = filemtime(EMOJI_DATA_PATH);
$etag  = '"' . md5((string) $mtime . EMOJI_DATA_PATH) . '"';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=604800, immutable');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');

$ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? null;
if ($ifNoneMatch !== null && trim($ifNoneMatch) === $etag) {
    http_response_code(304);
    exit;
}

// Stream the file directly rather than json_decode + json_encode -- it's
// already valid JSON on disk, so there's no reason to pay the parse/re-encode
// cost on every request just to pass it through unchanged.
readfile(EMOJI_DATA_PATH);