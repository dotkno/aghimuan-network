<?php
/**
 * www/library/reviewer-logout.php
 *
 * Ends the PCU-verified reviewer session (the AGHI_REVIEWER_SESS
 * cookie set in verify-reviewer.php) — separate from the main
 * site's account/login system, which is untouched by this.
 */

session_name('AGHI_REVIEWER_SESS');
session_start();

$_SESSION = [];

// Also clear the cookie itself, not just the server-side session data —
// otherwise the browser keeps sending the old (now-empty) session id.
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();

header('Location: /reviewers.php');
exit;
