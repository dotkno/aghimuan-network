<?php
/**
 * includes/reviewer-session.php
 *
 * Session handling for the Aghimuan Library (reviewers) section only.
 * Deliberately separate from the main site's account/session system —
 * this gates PCU-derived content by verified @pcu.edu.ph sign-in, and
 * has nothing to do with a user's Aghimuan profile/account.
 */

session_name('AGHI_REVIEWER_SESS');
session_start();

require_once __DIR__ . '/../../includes/app-config.php';

// How long a verified sign-in is trusted before Firebase must re-verify.
// Owned by includes/app-config.php — AGHI_REVIEWER_SESSION_TTL.
if (!defined('REVIEWER_SESSION_TTL')) {
    define('REVIEWER_SESSION_TTL', AGHI_REVIEWER_SESSION_TTL);
}

function has_reviewer_access(): bool {
    if (empty($_SESSION['reviewer_email']) || empty($_SESSION['reviewer_verified_at'])) {
        return false;
    }
    if (!str_ends_with(strtolower($_SESSION['reviewer_email']), '@pcu.edu.ph')) {
        return false;
    }
    if (time() - $_SESSION['reviewer_verified_at'] > REVIEWER_SESSION_TTL) {
        return false;
    }
    return true;
}

/**
 * Call this at the top of every gated page (grade-select.php, topics.php,
 * reviewer.php, library-home.php, and the per-subject redirect buffers).
 * Redirects to sign-in and stops execution if access isn't valid.
 */
function require_reviewer_access(): void {
    if (!has_reviewer_access()) {
        $next = urlencode($_SERVER['REQUEST_URI'] ?? 'www/library-home.php');
        header('Location: /reviewers.php?next=' . $next);
        exit;
    }
}

/** Verified PCU email for the current session, or null. */
function reviewer_session_email(): ?string {
    $email = $_SESSION['reviewer_email'] ?? null;
    return is_string($email) && $email !== '' ? $email : null;
}

/** Unix timestamp when the current reviewer session expires, or null. */
function reviewer_session_expires_at(): ?int {
    $verifiedAt = $_SESSION['reviewer_verified_at'] ?? null;
    if (!is_numeric($verifiedAt)) {
        return null;
    }
    return (int) $verifiedAt + REVIEWER_SESSION_TTL;
}

/**
 * Inline "Logged in as ..." snippet for merging into each library page's
 * OWN header (one header per page — no separate bar). Pass $with_signout
 * on pages whose header lacks a sign-out control (topics/reviewer);
 * library-home.php already has its red sign-out button, so it omits it.
 * Email is escaped; expiry is relative ("in 5h 23m") — no timezone
 * assumptions about server vs phone.
 */
function reviewer_account_inline(bool $with_signout = false): string {
    $email = reviewer_session_email();
    if ($email === null) {
        return '';
    }
    // Split local/domain so truncation can only ever eat the local part —
    // the "@pcu.edu.ph" trust signal always stays fully visible.
    $at = strrpos($email, '@');
    $local = $at !== false ? substr($email, 0, $at) : $email;
    $domain = $at !== false ? substr($email, $at) : '';
    $safeLocal = htmlspecialchars($local, ENT_QUOTES, 'UTF-8');
    $safeDomain = htmlspecialchars($domain, ENT_QUOTES, 'UTF-8');

    $expiresIn = '';
    $expiresAt = reviewer_session_expires_at();
    if ($expiresAt !== null) {
        $left = $expiresAt - time();
        if ($left > 0) {
            $h = (int) floor($left / 3600);
            $m = (int) floor(($left % 3600) / 60);
            $expiresIn = $h > 0 ? " · expires in {$h}h {$m}m" : " · expires in {$m}m";
        }
    }

    // NOTE: plain CSS, not Tailwind utilities — deterministic regardless of
    // CDN timing. Prefix + expiry drop out on phones so the address itself
    // gets every pixel; the domain is pinned and can never truncate.
    $html = '<style>'
        . '.aghi-rev-inline{display:inline-flex;align-items:baseline;min-width:0;flex:1 1 auto;justify-content:flex-end;'
        . 'font-family:Rajdhani,system-ui,sans-serif;font-size:11px;color:#AEB7C0}'
        . '.aghi-rev-pre{flex-shrink:0}'
        . '.aghi-rev-local{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        . '.aghi-rev-local strong{color:#55F1F8;font-weight:600}'
        . '.aghi-rev-dom{flex-shrink:0}'
        . '.aghi-rev-exp{flex-shrink:0;color:#767CA1}'
        . '.aghi-rev-out{flex-shrink:0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;'
        . 'color:rgba(248,113,113,.8);text-decoration:none;font-family:Rajdhani,system-ui,sans-serif}'
        . '.aghi-rev-out:hover{color:#f87171}'
        . '@media(max-width:767px){.aghi-rev-pre{display:none}.aghi-rev-exp{display:none}'
        . '.aghi-rev-inline{font-size:10px;max-width:52vw}}'
        . '@media(min-width:768px){.aghi-rev-inline{font-size:12px;max-width:360px}}'
        . '</style>'
        . '<span class="aghi-rev-inline"><span class="aghi-rev-pre">Logged in as&nbsp;</span>'
        . '<span class="aghi-rev-local"><strong>' . $safeLocal . '</strong></span>'
        . '<span class="aghi-rev-dom">' . $safeDomain . '</span>'
        . '<span class="aghi-rev-exp">' . htmlspecialchars($expiresIn, ENT_QUOTES, 'UTF-8') . '</span></span>';
    if ($with_signout) {
        $html .= '<a class="aghi-rev-out" href="/library/reviewer-logout.php">Sign out</a>';
    }
    return $html;
}