<?php
/**
 * data-gate.php
 *
 * Serves the actual PCU-module-derived reviewer content, which lives
 * OUTSIDE the web root (see step 1 of the deployment plan). This is
 * the file that closes the "type the URL directly" bypass — there is
 * no direct URL to the real .js files anymore, only to this gate.
 */

require __DIR__ . '/includes/reviewer-session.php';
require_reviewer_access();

$base = '/home/container/data/library-content/';
$allowedSubjects = ['et', 'css', 'cp', 'mil', 'vgd'];

$subject = strtolower($_GET['subject'] ?? '');
$grade   = $_GET['grade'] ?? '';
$quarter = $_GET['quarter'] ?? '';
$week    = $_GET['week'] ?? '';

header('Content-Type: application/javascript');
header('Cache-Control: private, no-store');

// Strict whitelist + digit-only checks — this is what prevents path
// traversal (../) or requesting arbitrary files off the server.
if (
    !in_array($subject, $allowedSubjects, true) ||
    !preg_match('/^\d{1,2}$/', $grade) ||
    !preg_match('/^\d{1,2}$/', $quarter) ||
    !preg_match('/^\d{1,2}$/', $week)
) {
    http_response_code(400);
    exit('console.error("[data-gate] 400 invalid params — subject=' . addslashes($subject) . ' grade=' . addslashes($grade) . ' quarter=' . addslashes($quarter) . ' week=' . addslashes($week) . '");');
}

$filename = $subject . '-g' . $grade . '-q' . $quarter . '-w' . $week . '.js';
$path     = realpath($base . $subject . '/' . $filename);
$baseReal = realpath($base);

// Confirm the resolved path is still inside $base — a second layer
// against traversal even if the regex above were somehow bypassed.
if ($path === false || $baseReal === false || strpos($path, $baseReal) !== 0) {
    http_response_code(404);
    exit('console.error("[data-gate] 404 not found — expected file at ' . addslashes($base . $subject . '/' . $filename) . '");');
}

readfile($path);