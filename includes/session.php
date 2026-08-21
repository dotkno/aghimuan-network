<?php
/**
 * session.php — secure session bootstrap, CSRF tokens, and current-user helpers.
 * Include AFTER db.php, before any output:
 *   require_once __DIR__ . '/db.php';
 *   require_once __DIR__ . '/session.php';
 */

declare(strict_types=1);

const SESSION_LIFETIME_DAYS = 30;

function start_secure_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * SESSION_LIFETIME_DAYS,
        'path'     => '/',
        'secure'   => true,      // HTTPS only — aghimuan.renyuzaki.me should be serving TLS
        'httponly' => true,      // JS can never read the cookie
        'samesite' => 'Lax',     // blocks most CSRF vectors by default; explicit CSRF tokens below cover the rest
    ]);
    session_start();
}

/** Generate (or reuse) a CSRF token for this session and return it. Call this when rendering a form. */
function csrf_token(): string {
    start_secure_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/** Call this at the top of every POST handler before touching the database. */
function require_csrf(): void {
    start_secure_session();
    $sent = $_POST['csrf_token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $sent)) {
        http_response_code(403);
        die('Invalid or expired form submission. Go back and try again.');
    }
}

/**
 * Creates a DB-backed session row + sets the auth cookie.
 * We store a HASH of the token in the DB (never the raw token), same principle
 * as password hashing — if the DB ever leaks, sessions can't be replayed from it.
 */
function login_user(PDO $pdo, int $userId): void {
    start_secure_session();
    session_regenerate_id(true); // prevent session fixation

    $rawToken    = bin2hex(random_bytes(32));
    $tokenHash   = hash('sha256', $rawToken);
    $expiresAt   = (new DateTime("+" . SESSION_LIFETIME_DAYS . " days"))->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'INSERT INTO sessions (token, user_id, user_agent, ip_hash, expires_at)
         VALUES (:token, :user_id, :ua, :ip, :expires)'
    );
    $stmt->execute([
        ':token'   => $tokenHash,
        ':user_id' => $userId,
        ':ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        ':ip'      => hash('sha256', $_SERVER['REMOTE_ADDR'] ?? ''),
        ':expires' => $expiresAt,
    ]);

    $_SESSION['user_id']    = $userId;
    $_SESSION['auth_token'] = $rawToken; // raw token only ever lives in the PHP session, never in the DB
}

function logout_user(PDO $pdo): void {
    start_secure_session();
    if (!empty($_SESSION['auth_token'])) {
        $tokenHash = hash('sha256', $_SESSION['auth_token']);
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = :t');
        $stmt->execute([':t' => $tokenHash]);
    }
    $_SESSION = [];
    session_destroy();
}

/** Returns the logged-in user's row, or null if not authenticated / session invalid. */
function current_user(PDO $pdo): ?array {
    start_secure_session();
    if (empty($_SESSION['user_id']) || empty($_SESSION['auth_token'])) {
        return null;
    }

    $tokenHash = hash('sha256', $_SESSION['auth_token']);
    $stmt = $pdo->prepare(
        'SELECT s.user_id, u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = :t AND s.expires_at > datetime("now") AND u.is_banned = 0'
    );
    $stmt->execute([':t' => $tokenHash]);
    $row = $stmt->fetch();

    if (!$row) {
        $_SESSION = [];
        return null;
    }

    touch_last_seen($pdo, (int) $row['id'], $row['last_seen'] ?? null);

    return $row;
}

// How stale last_seen has to be before we bother writing again. Keeps this
// from turning into a write on every single request — most page loads/polls
// land inside this window and skip the UPDATE entirely. Keep this comfortably
// shorter than ONLINE_THRESHOLD_SECONDS in api/user-profile.php so a user's
// last_seen never goes stale-looking while they're still actively browsing.
// Deliberately short: the sendBeacon offline signal on tab-close isn't
// guaranteed to fire (some privacy extensions block sendBeacon outright), so
// this timeout is the real safety net, not just an optimization.
const LAST_SEEN_WRITE_THROTTLE_SECONDS = 20;

/** Best-effort activity heartbeat — failure here should never break the request. */
function touch_last_seen(PDO $pdo, int $userId, ?int $lastSeen): void {
    if ($lastSeen !== null && (time() - $lastSeen) < LAST_SEEN_WRITE_THROTTLE_SECONDS) {
        return;
    }
    try {
        $stmt = $pdo->prepare('UPDATE users SET last_seen = :now WHERE id = :id');
        $stmt->execute([':now' => time(), ':id' => $userId]);
    } catch (PDOException $e) {
        // Non-critical — presence just won't be perfectly fresh this request.
    }
}

/** Redirects guests to login.php. Call at the top of any account-only page/endpoint. */
function require_login(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) {
        header('Location: /login.php');
        exit;
    }
    return $user;
}