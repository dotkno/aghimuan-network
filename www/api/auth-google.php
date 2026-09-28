<?php
/**
 * api/auth-google.php
 *
 * POST { idToken }  (JSON, CSRF-protected)
 *
 * The Google sign-in entry point for login.php / signup.php. Verifies the
 * Firebase ID token server-side, then:
 *   1. token's Firebase UID already linked  -> log that account in
 *   2. token's (verified) email on a user   -> link the UID to it, log in
 *   3. nobody matches                       -> stash the verified claims in
 *      $_SESSION['google_signup_pending'] (15-min TTL) and reply
 *      needs_profile so the client shows the username-setup step
 *
 * Accepts ANY Google account (personal Gmail, @pcu.edu.ph, other work
 * accounts) — unlike verify-firebase.php, no domain restriction happens
 * here; @pcu.edu.ph merely auto-verifies a NEW account in finish-signup.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/firebase-verify.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GOOGLE_PENDING_TTL_SECONDS = 15 * 60;

function json_out(int $code, array $payload): never {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

$pdo = get_db();
start_secure_session();

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    json_out(400, ['ok' => false, 'error' => 'invalid_json_body']);
}
$_POST = array_merge($_POST, $body);
require_csrf();

// Throttle: same per-session counter shape login.php uses for passwords.
if (!isset($_SESSION['google_auth_attempts'])) {
    $_SESSION['google_auth_attempts'] = 0;
    $_SESSION['google_auth_locked_until'] = 0;
}
if (time() < (int) ($_SESSION['google_auth_locked_until'] ?? 0)) {
    json_out(429, ['ok' => false, 'error' => 'too_many_attempts']);
}

$idToken = (string) ($body['idToken'] ?? '');
try {
    $claims = verify_firebase_id_token($idToken);
} catch (Exception $e) {
    error_log('Google auth verification error: ' . $e->getMessage());
    $_SESSION['google_auth_attempts']++;
    if ($_SESSION['google_auth_attempts'] >= 5) {
        $_SESSION['google_auth_locked_until'] = time() + 60;
        $_SESSION['google_auth_attempts'] = 0;
    }
    json_out(403, ['ok' => false, 'error' => 'verification_failed']);
}

$email = $claims['email'];
$firebaseUid = $claims['firebase_uid'];

// 1. Existing link by Firebase UID
$stmt = $pdo->prepare('SELECT * FROM users WHERE firebase_uid = :uid AND is_banned = 0');
$stmt->execute([':uid' => $firebaseUid]);
$user = $stmt->fetch();

// 2. Existing account with this (verified) email -> link the UID to it
if (!$user && $claims['email_verified']) {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email AND is_banned = 0');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();
    if ($user) {
        $link = $pdo->prepare('UPDATE users SET firebase_uid = :uid, updated_at = datetime(\'now\') WHERE id = :id');
        $link->execute([':uid' => $firebaseUid, ':id' => $user['id']]);
    }
}

if ($user) {
    $_SESSION['google_auth_attempts'] = 0;
    login_user($pdo, (int) $user['id']);
    json_out(200, ['ok' => true, 'status' => 'logged_in', 'username' => $user['username']]);
}

// 3. Nobody matches -> pending signup. Keep only verified facts.
$_SESSION['google_signup_pending'] = [
    'email' => $email,
    'email_verified' => $claims['email_verified'],
    'firebase_uid' => $firebaseUid,
    'created_at' => time(),
];
$_SESSION['google_auth_attempts'] = 0;

// Suggest a username from the email local part, sanitized to the allowed
// charset (letters/digits/underscore, 3-20 chars). Digits are appended by
// finish-signup when the suggestion is taken.
$local = explode('@', $email)[0];
$suggested = preg_replace('/[^a-zA-Z0-9_]/', '', $local);
if ($suggested === null || $suggested === '') {
    $suggested = 'member';
}
$suggested = substr($suggested, 0, 20);
if (strlen($suggested) < 3) {
    $suggested = str_pad($suggested, 3, '0');
}

json_out(200, [
    'ok' => true,
    'status' => 'needs_profile',
    'email' => $email,
    'suggestedUsername' => $suggested,
]);
