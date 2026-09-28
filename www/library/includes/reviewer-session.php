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

// How long a verified sign-in is trusted before Firebase must re-verify.
define('REVIEWER_SESSION_TTL', 60 * 60 * 8); // 8 hours

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