<?php
/**
 * pdf-gate.php
 *
 * Serves owner-uploaded offline PDFs, which live OUTSIDE the web root
 * in /data/library-pdfs/ - same pattern as data-gate.php. There is no
 * direct URL to the real .pdf files, only to this gate.
 */

require __DIR__ . '/includes/reviewer-session.php';
require_reviewer_access();

$base = '/home/container/data/library-pdfs/';
$allowedSubjects = ['et', 'css', 'cp', 'mil', 'vgd'];

$subject = strtolower($_GET['subject'] ?? '');
$grade   = $_GET['grade'] ?? '';
$quarter = $_GET['quarter'] ?? '';

// Strict whitelist + digit-only checks - prevents path traversal (../)
// or requesting arbitrary files off the server.
if (
    !in_array($subject, $allowedSubjects, true) ||
    !preg_match('/^\d{1,2}$/', $grade) ||
    !preg_match('/^\d{1,2}$/', $quarter)
) {
    http_response_code(400);
    exit('Invalid download request.');
}

$filename = $subject . '-g' . $grade . '-q' . $quarter . '.pdf';
$path     = realpath($base . $subject . '/' . $filename);
$baseReal = realpath($base);

// Confirm the resolved path is still inside $base - second layer
// against traversal even if the regex above were somehow bypassed.
if ($path === false || $baseReal === false || strpos($path, $baseReal) !== 0) {
    http_response_code(404);
    exit('No offline PDF for this quarter yet.');
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-store');

readfile($path);
exit;
