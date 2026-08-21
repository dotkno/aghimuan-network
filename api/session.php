<?php
/**
 * GET /api/session.php
 * Returns the current session state as JSON. This is the endpoint the
 * account-widget on every static page hits on load to decide whether to
 * render "Login / Sign up" links or the avatar + popup.
 *
 * No auth required to call this — it's how guests are told they're guests.
 */

declare(strict_types=1);

// display_errors stays OFF here on purpose: this endpoint's whole contract is
// "always returns valid JSON." A stray PHP warning printed inline (like the
// undefined-array-key one that broke login detection) corrupts the response
// body and makes res.json() throw client-side, which the widget then quietly
// swallows and renders as "logged out" — even though the session was fine.
// Errors still get logged server-side instead of vanishing.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
// This response is per-session (cookie-dependent) — never let a CDN/browser cache it.
header('Cache-Control: no-store');

// Keep in sync with USERNAME_COOLDOWN_DAYS in api/profile.php.
const USERNAME_COOLDOWN_DAYS = 7;

// Same logic as username_change_available_at() in api/profile.php — duplicated
// here rather than required, since profile.php isn't a pure function library
// (it runs its own GET/POST handling as soon as it's included).
function username_change_available_at(array $user): ?string {
    $lastChanged = $user['username_changed_at'] ?? null;
    if (!$lastChanged) {
        return null; // never changed — free to change any time
    }
    $nextAllowed = (new DateTime($lastChanged))->modify('+' . USERNAME_COOLDOWN_DAYS . ' days');
    return $nextAllowed->format(DateTime::ATOM);
}

// Same helper as api/profile.php / api/user-profile.php — snake_case keys
// (color_css, text_color) to match what account-widget.js / user-profile-
// popup.js already read them as.
function fetch_custom_roles(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare(
        'SELECT cr.id, cr.name, cr.color_css, cr.text_color
         FROM custom_roles cr
         JOIN user_custom_roles ucr ON ucr.role_id = cr.id
         WHERE ucr.user_id = :id
         ORDER BY cr.name COLLATE NOCASE'
    );
    $stmt->execute([':id' => $userId]);
    return array_map(fn($r) => [
        'id'         => (int) $r['id'],
        'name'       => $r['name'],
        'color_css'  => $r['color_css'],
        'text_color' => $r['text_color'],
    ], $stmt->fetchAll());
}

$pdo  = get_db();
$user = current_user($pdo);

if (!$user) {
    echo json_encode([
        'loggedIn' => false,
        'user'     => null,
    ]);
    exit;
}

echo json_encode([
    'loggedIn'  => true,
    // Handed to the widget so it can attach this to its own profile-edit POSTs
    // without the page needing a server-rendered csrf_token() call baked in.
    'csrfToken' => csrf_token(),
    'user'      => [
        'id'                        => (int) $user['id'],
        'username'                  => $user['username'],
        'bio'                       => $user['bio'],
        'status'                    => $user['status'],
        'pfpId'                     => $user['pfp_id'],
        // 'role' was renamed to 'main_role' in the role-system migration —
        // this is the field the widget/popup should read from now.
        'mainRole'                  => $user['main_role'] ?? 'MEMBER',
        // Was missing here entirely — same bug as the old profile.php/
        // user-profile.php, so the widget had no subRole/customRoles on
        // initial page load even after those two were fixed.
        'subRole'                   => $user['sub_role'] ?? null,
        'grade'                     => $user['grade'] ?? null,
        'strand'                    => $user['strand'] ?? null,
        'club'                      => $user['club'] ?? null,
        'customRoles'               => fetch_custom_roles($pdo, (int) $user['id']),
        'presence'                  => $user['presence'] ?? 'online',
        'usernameChangeAvailableAt' => username_change_available_at($user),
    ],
]);