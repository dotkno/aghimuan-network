<?php
declare(strict_types=1);
/**
 * GET  /api/profile.php?username=Ahren   -> public profile, no auth required
 * POST /api/profile.php                  -> edit YOUR OWN bio/status/pfp, auth + CSRF required
 *                                            body: JSON { bio?, status?, pfpId?, csrf_token }
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

set_exception_handler(function ($e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit;
});

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();

// Preset (color monogram) avatar ids — must stay identical to PRESET_IDS in
// api/upload-avatar.php and PFP_PRESETS ids in js/account-widget.js.
// Anything sent here that ISN'T one of these is rejected — real custom
// avatars are set exclusively through /api/upload-avatar.php, never through
// this endpoint, so a client can't just POST an arbitrary filename here and
// point pfp_id at a file that was never actually validated/re-encoded.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

const MAX_BIO_LENGTH    = 300;
const MAX_STATUS_LENGTH = 60;

// Discord-style presence, separate from the free-text "status" message above
// (that's the custom text bubble; this is the colored-dot online/away/dnd/
// invisible indicator).
const PRESENCE_VALUES = ['online', 'away', 'dnd', 'invisible'];

const USERNAME_COOLDOWN_DAYS = 7;
const USERNAME_PATTERN = '/^[a-zA-Z0-9_]{3,20}$/'; // keep identical to signup.php's check

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function username_change_available_at(array $user): ?string {
    $lastChanged = $user['username_changed_at'] ?? null;
    if (!$lastChanged) {
        return null; // never changed — free to change any time
    }
    $nextAllowed = (new DateTime($lastChanged))->modify('+' . USERNAME_COOLDOWN_DAYS . ' days');
    return $nextAllowed->format(DateTime::ATOM);
}

// Discord-style custom roles assigned to this user (name + color, from
// custom_roles/user_custom_roles) — separate from mainRole/subRole.
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
        'id'        => (int) $r['id'],
        'name'      => $r['name'],
        'color_css' => $r['color_css'],
        'text_color' => $r['text_color'],
    ], $stmt->fetchAll());
}

function public_profile(PDO $pdo, array $user): array {
    return [
        'id'                       => (int) $user['id'],
        'username'                 => $user['username'],
        'bio'                      => $user['bio'],
        'status'                  => $user['status'],
        'pfpId'                    => $user['pfp_id'],
        // 'role' was renamed to 'main_role' in the role-system migration —
        // this is the field the widget/popup should read from now.
        'mainRole'                 => $user['main_role'] ?? 'MEMBER',
        // Preset sub-role (Faculty / President / Sgt. at Arms / etc.) — was
        // previously stored but never actually sent to the client, which is
        // why these badges never rendered anywhere outside admin.php.
        'subRole'                  => $user['sub_role'] ?? null,
        'grade'                    => $user['grade'] ?? null,
        'strand'                   => $user['strand'] ?? null,
        'club'                     => $user['club'] ?? null,
        // Same story as subRole above — assigned in admin.php but never
        // included in this response, so custom role badges never showed up.
        'customRoles'              => fetch_custom_roles($pdo, (int) $user['id']),
        'createdAt'                => $user['created_at'],
        'presence'                 => $user['presence'] ?? 'online',
        'usernameChangeAvailableAt' => username_change_available_at($user),
    ];
}

/** JSON-friendly version of require_login() — returns a 401 instead of redirecting. */
function require_login_json(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) {
        json_error(401, 'You must be logged in.');
    }
    return $user;
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: public profile lookup ----
if ($method === 'GET') {
    $username = trim($_GET['username'] ?? '');
    if ($username === '') {
        json_error(400, 'Missing username.');
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username_lower = :u AND is_banned = 0');
    $stmt->execute([':u' => mb_strtolower($username)]);
    $user = $stmt->fetch();

    if (!$user) {
        json_error(404, 'User not found.');
    }

    echo json_encode(['profile' => public_profile($pdo, $user)]);
    exit;
}

// ---- POST: edit own profile ----
if ($method === 'POST') {
    // require_csrf() checks $_POST['csrf_token'], but this endpoint takes a JSON
    // body — decode it and merge into $_POST so require_csrf() works unmodified.
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    $_POST = array_merge($_POST, $body);

    require_csrf();
    $currentUser = require_login_json($pdo);

    $bio    = array_key_exists('bio', $body)    ? trim((string) $body['bio'])    : $currentUser['bio'];
    $status = array_key_exists('status', $body) ? trim((string) $body['status']) : $currentUser['status'];

    // Only validate pfpId when the client is actually asking to change it.
    // Previously this re-validated the ALREADY-STORED pfp_id on every request
    // (even bio/status-only edits), which meant any account whose stored
    // pfp_id wasn't in PRESET_IDS (e.g. drifted out of sync with signup.php's
    // list) got every single profile edit rejected with a 422 — not just
    // avatar changes. Only check the value when it's actually incoming.
    $changingPfp = array_key_exists('pfpId', $body);
    $pfpId       = $changingPfp ? trim((string) $body['pfpId']) : $currentUser['pfp_id'];

    if (mb_strlen($bio) > MAX_BIO_LENGTH) {
        json_error(422, 'Bio is too long (max ' . MAX_BIO_LENGTH . ' characters).');
    }
    if (mb_strlen($status) > MAX_STATUS_LENGTH) {
        json_error(422, 'Status is too long (max ' . MAX_STATUS_LENGTH . ' characters).');
    }
    if ($changingPfp && !in_array($pfpId, PRESET_IDS, true)) {
        json_error(422, "Invalid avatar selection. Use /api/upload-avatar.php to set a custom photo.");
    }

    // ---- username (rate-limited to once every USERNAME_COOLDOWN_DAYS) ----
    $changingUsername = array_key_exists('username', $body);
    $username = $changingUsername ? trim((string) $body['username']) : $currentUser['username'];

    if ($changingUsername && $username !== $currentUser['username']) {
        if (!preg_match(USERNAME_PATTERN, $username)) {
            json_error(422, 'Username must be 3-20 characters: letters, numbers, and underscores only.');
        }

        $availableAt = username_change_available_at($currentUser);
        if ($availableAt !== null && new DateTime() < new DateTime($availableAt)) {
            $secondsLeft = (new DateTime($availableAt))->getTimestamp() - time();
            $daysLeft = max(1, (int) ceil($secondsLeft / 86400));
            json_error(429, "You can change your username again in {$daysLeft} day" . ($daysLeft === 1 ? '' : 's') . ".");
        }

        $usernameLower = mb_strtolower($username);
        $check = $pdo->prepare('SELECT id FROM users WHERE username_lower = :u AND id != :id');
        $check->execute([':u' => $usernameLower, ':id' => $currentUser['id']]);
        if ($check->fetch()) {
            json_error(409, 'That username is already taken.');
        }
    }
    $usernameChanged = $changingUsername && $username !== $currentUser['username'];

    // ---- presence (online/away/dnd/invisible) ----
    $changingPresence = array_key_exists('presence', $body);
    $presence = $changingPresence ? trim((string) $body['presence']) : ($currentUser['presence'] ?? 'online');
    if ($changingPresence && !in_array($presence, PRESENCE_VALUES, true)) {
        json_error(422, 'Invalid presence value.');
    }

    // If they're switching away from a custom uploaded photo to a color preset,
    // clean up the now-orphaned file instead of leaving it on disk forever.
    $previousPfp = (string) $currentUser['pfp_id'];
    if ($previousPfp !== $pfpId && !in_array($previousPfp, PRESET_IDS, true)) {
        $oldPath = __DIR__ . '/../uploads/pfp/' . basename($previousPfp);
        if (is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    // NOTE: if you want bio/status run through automod.php's blocklist filter the
    // same way comments are, hook that check in here before the UPDATE — send me
    // automod.php and I'll wire it in.

    $stmt = $pdo->prepare(
        "UPDATE users SET bio = :bio, status = :status, pfp_id = :pfp, presence = :presence,
         username = :username, username_lower = :username_lower,
         username_changed_at = :username_changed_at, updated_at = datetime('now')
         WHERE id = :id"
    );
    $stmt->execute([
        ':bio'                 => $bio,
        ':status'              => $status,
        ':pfp'                 => $pfpId,
        ':presence'            => $presence,
        ':username'            => $username,
        ':username_lower'      => mb_strtolower($username),
        ':username_changed_at' => $usernameChanged ? (new DateTime())->format('Y-m-d H:i:s') : ($currentUser['username_changed_at'] ?? null),
        ':id'                  => $currentUser['id'],
    ]);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
    $stmt->execute([':id' => $currentUser['id']]);
    $updated = $stmt->fetch();

    echo json_encode(['profile' => public_profile($pdo, $updated)]);
    exit;
}

json_error(405, 'Method not allowed.');