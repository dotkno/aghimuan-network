<?php
/**
 * api/finish-signup.php
 *
 * POST { username, grade?, strand?, club? }  (JSON, CSRF-protected)
 *
 * Completes the Google signup started by api/auth-google.php: consumes the
 * pending claims stashed in the session (15-min TTL), validates the chosen
 * username + optional grade/strand/club (same whitelists as the old signup
 * wizard), creates the MEMBER account, and logs the user in.
 *
 * @pcu.edu.ph emails are auto-verified (is_verified = 1) at creation —
 * everything else starts unverified and can PCU-verify later through the
 * account settings / profile verification flow.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GOOGLE_PENDING_TTL_SECONDS = 15 * 60;
const USERNAME_PATTERN = '/^[a-zA-Z0-9_]{3,20}$/'; // identical to profile.php

const GRADES  = ['G12', 'G11', 'JHS'];
const STRANDS = ['STEM', 'ABM/BE', 'HUMSS/ASSH', 'HE/HT', 'ICT/ICT Professionals', 'SPORTS'];
const CLUBS = [
    'Dagitab', 'EBDA', 'Hiraya', 'Lyrico', 'Marahuyo', 'Padayon', 'Pahina',
    'Paraluman', 'PFG', 'Sibol', 'RISE', 'Dalumat', 'Numero', 'Kalakbay',
    'Le Verrier', 'Nexus', 'Aghimuan', 'Skill Speak',
];

function json_out(int $code, array $payload): never {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

// Same IP resolution order signup.php uses (Cloudflare tunnel friendly).
function signup_client_ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP'] as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', $_SERVER[$key])[0]);
            if ($ip !== '') return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
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

$pending = $_SESSION['google_signup_pending'] ?? null;
if (!is_array($pending) || empty($pending['firebase_uid']) || empty($pending['email'])) {
    json_out(400, ['ok' => false, 'error' => 'no_pending_signup']);
}
if (time() - (int) ($pending['created_at'] ?? 0) > GOOGLE_PENDING_TTL_SECONDS) {
    unset($_SESSION['google_signup_pending']);
    json_out(400, ['ok' => false, 'error' => 'signup_expired']);
}

// Banned-IP gate, same as the old signup wizard.
$ip = signup_client_ip();
if ($ip !== '') {
    $stmt = $pdo->prepare('SELECT 1 FROM banned_ips WHERE ip_address = :ip');
    $stmt->execute([':ip' => $ip]);
    if ($stmt->fetch()) {
        json_out(403, ['ok' => false, 'error' => 'signup_unavailable']);
    }
}

$username = trim((string) ($body['username'] ?? ''));
if (!preg_match(USERNAME_PATTERN, $username)) {
    json_out(422, ['ok' => false, 'error' => 'Username must be 3-20 characters: letters, numbers, and underscores only.']);
}
$usernameLower = mb_strtolower($username);

$grade  = trim((string) ($body['grade'] ?? ''));
$strand = trim((string) ($body['strand'] ?? ''));
$club   = trim((string) ($body['club'] ?? ''));

if ($grade !== '' && !in_array($grade, GRADES, true))   $grade = '';
if ($strand !== '' && !in_array($strand, STRANDS, true)) $strand = '';
if ($club !== '' && !in_array($club, CLUBS, true))       $club = '';

// Unique username (and unique email, via the index db.php maintains).
// The email is guaranteed unique here in practice: auth-google only stashes
// a pending signup when NO account had that firebase_uid or email — but a
// race between two tabs could still hit the unique index, so both are checked.
$stmt = $pdo->prepare('SELECT id FROM users WHERE username_lower = :u');
$stmt->execute([':u' => $usernameLower]);
if ($stmt->fetch()) {
    json_out(409, ['ok' => false, 'error' => 'That username is already taken.']);
}
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = :e');
$stmt->execute([':e' => $pending['email']]);
if ($stmt->fetch()) {
    json_out(409, ['ok' => false, 'error' => 'That email already has an account — try signing in instead.']);
}

$email = $pending['email'];
$firebaseUid = $pending['firebase_uid'];
$isPcu = str_ends_with($email, '@pcu.edu.ph');

try {
    $stmt = $pdo->prepare(
        "INSERT INTO users (username, username_lower, password_hash, pfp_id, email, firebase_uid,
                            is_verified, verified_at, main_role, grade, strand, club, ip_address)
         VALUES (:u, :ul, '', 'default', :email, :uid, :iv, :vat, 'MEMBER', :g, :s, :c, :ip)"
    );
    $stmt->execute([
        ':u' => $username,
        ':ul' => $usernameLower,
        ':email' => $email,
        ':uid' => $firebaseUid,
        ':iv' => $isPcu ? 1 : 0,
        ':vat' => $isPcu ? date('Y-m-d H:i:s') : null,
        ':g' => $grade !== '' ? $grade : null,
        ':s' => $strand !== '' ? $strand : null,
        ':c' => $club !== '' ? $club : null,
        ':ip' => $ip !== '' ? $ip : null,
    ]);
} catch (PDOException $e) {
    // Unique-index race on username_lower/email lands here.
    $msg = $e->getMessage();
    if (strpos($msg, 'username_lower') !== false) {
        json_out(409, ['ok' => false, 'error' => 'That username is already taken.']);
    }
    if (strpos($msg, 'email') !== false) {
        json_out(409, ['ok' => false, 'error' => 'That email already has an account — try signing in instead.']);
    }
    error_log('finish-signup insert error: ' . $msg);
    json_out(500, ['ok' => false, 'error' => 'Could not create the account. Try again.']);
}

unset($_SESSION['google_signup_pending']);
login_user($pdo, (int) $pdo->lastInsertId());

json_out(200, ['ok' => true, 'status' => 'logged_in', 'is_verified' => $isPcu]);
