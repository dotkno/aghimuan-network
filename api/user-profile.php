<?php
/**
 * GET /api/user-profile.php?username=... | ?id=...
 * Read-only public profile lookup (pfp / name / bio / activity / status)
 * for the profile popup. Gated to logged-in viewers, matching the rest of
 * the social layer.
 */
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Keep in sync with PRESET_IDS in upload-avatar.php / profile.php / account-widget.js
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

// A user counts as "online" if their session touched last_seen within this
// window. Keep this in sync with however often current_user() refreshes it
// (see includes/session.php) — it should comfortably outlast the refresh
// interval so normal polling/page-views don't flicker someone to offline.
// Deliberately short: this is the real fallback for "actually offline"
// detection, since the sendBeacon signal on tab-close isn't guaranteed to
// fire in every browser/extension setup.
const ONLINE_THRESHOLD_SECONDS = 45;

$pdo = get_db();
$me = current_user($pdo);
if (!$me) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'login_required']);
    exit;
}

$username = trim($_GET['username'] ?? '');
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

if ($username === '' && !$id) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_param']);
    exit;
}

if ($id) {
    $stmt = $pdo->prepare('SELECT id, username, bio, status, pfp_id, main_role, sub_role, grade, strand, club, presence, last_seen, is_banned FROM users WHERE id = ?');
    $stmt->execute([$id]);
} else {
    $stmt = $pdo->prepare('SELECT id, username, bio, status, pfp_id, main_role, sub_role, grade, strand, club, presence, last_seen, is_banned FROM users WHERE username_lower = ?');
    $stmt->execute([mb_strtolower($username)]);
}
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || (int)$row['is_banned'] === 1) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'not_found']);
    exit;
}

// A null/empty pfp_id (accounts that predate the preset system, or any gap
// in signup) is NOT a custom-upload filename — treat it as the 'default'
// preset rather than building a broken /uploads/pfp/ URL out of nothing.
$pfpId = $row['pfp_id'] !== null && $row['pfp_id'] !== '' ? $row['pfp_id'] : 'default';
$isPreset = in_array($pfpId, PRESET_IDS, true);
$avatarUrl = $isPreset ? null : '/uploads/pfp/' . basename((string) $pfpId);

$lastSeen = $row['last_seen'] !== null ? (int) $row['last_seen'] : null;
$online = $lastSeen !== null && (time() - $lastSeen) < ONLINE_THRESHOLD_SECONDS;

$targetId = (int) $row['id'];
$isSelf = $targetId === (int) $me['id'];

// Discord-style custom roles for this user (kept identical to the query in
// api/profile.php) — was never fetched here at all, which is why custom
// role badges never appeared in the profile popup.
$crStmt = $pdo->prepare(
    'SELECT cr.id, cr.name, cr.color_css, cr.text_color
     FROM custom_roles cr
     JOIN user_custom_roles ucr ON ucr.role_id = cr.id
     WHERE ucr.user_id = :id
     ORDER BY cr.name COLLATE NOCASE'
);
$crStmt->execute([':id' => $targetId]);
$customRoles = array_map(fn($r) => [
    'id'        => (int) $r['id'],
    'name'      => $r['name'],
    'color_css' => $r['color_css'],
    'text_color' => $r['text_color'],
], $crStmt->fetchAll());

// ---- friendship status between viewer and this profile ----
// none | pending_sent | pending_received | friends
$friendStatus = 'none';
if (!$isSelf) {
    $stmt = $pdo->prepare(
        'SELECT status, requested_by FROM friends
         WHERE (user_id = :me AND friend_id = :them) OR (user_id = :them AND friend_id = :me)'
    );
    $stmt->execute([':me' => $me['id'], ':them' => $targetId]);
    $fr = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($fr) {
        if ($fr['status'] === 'accepted') {
            $friendStatus = 'friends';
        } elseif ((int) $fr['requested_by'] === (int) $me['id']) {
            $friendStatus = 'pending_sent';
        } else {
            $friendStatus = 'pending_received';
        }
    }
}

// Whether the VIEWER has blocked this profile (only direction the popup's
// action row needs — used to hide friend actions and flip Block->Unblock).
$blockedByYou = false;
if (!$isSelf) {
    $stmt = $pdo->prepare('SELECT 1 FROM blocks WHERE blocker_id = :me AND blocked_id = :them');
    $stmt->execute([':me' => $me['id'], ':them' => $targetId]);
    $blockedByYou = (bool) $stmt->fetch();
}

echo json_encode([
    'ok' => true,
    'id' => $targetId,
    'username' => $row['username'],
    'avatarUrl' => $avatarUrl,
    'pfpId' => $pfpId,
    'mainRole' => $row['main_role'] ?? 'MEMBER',
    'subRole' => $row['sub_role'] ?? null,
    'grade' => $row['grade'] ?? null,
    'strand' => $row['strand'] ?? null,
    'club' => $row['club'] ?? null,
    'customRoles' => $customRoles,
    'bio' => $row['bio'] ?? '',
    'status' => $row['status'] ?? '',
    'presence' => $row['presence'] ?? 'online',
    'online' => $online,
    'isSelf' => $isSelf,
    'friendStatus' => $friendStatus,
    'blockedByYou' => $blockedByYou,
]);