<?php
/**
 * GET /api/user-list.php?q=searchterm
 *
 * Returns all non-banned users grouped by main_role, for the member
 * list panel/drawer. Login-gated, matching the rest of the social layer.
 *
 * Response:
 * {
 *   "ok": true,
 *   "groups": [
 *     { "role": "CLUB ADVISER", "count": 1, "users": [ {...} ] },
 *     { "role": "OFFICER", "count": 6, "users": [ {...} ] },
 *     { "role": "COMMITTEE MEMBER", "count": 5, "users": [ {...} ] },
 *     { "role": "MEMBER", "count": 81, "users": [ {...} ] }
 *   ]
 * }
 *
 * Each user: { id, username, avatarUrl, pfpId, subRole, club, grade,
 *              strand, status, presence, online }
 * `presence` + `online` follow the same effective-presence rule as
 * user-profile.php / user-profile-popup.js: invisible or a stale/expired
 * session both collapse to plain "offline" for anyone but the user
 * themselves.
 */
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// Keep in sync with PRESET_IDS in account-widget.js / user-profile-popup.js / profile.php.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

// Keep in sync with ONLINE_THRESHOLD_SECONDS in user-profile.php.
const ONLINE_THRESHOLD_SECONDS = 45;

// Display order for role groups (top to bottom in the list).
// 'COMMITEE MEMBER' (missing second T) is tolerated as an alias since
// account-widget.js's getMainRoleStyle() already has to guard against it.
const ROLE_GROUPS = [
    'CLUB ADVISER',
    'OFFICER',
    'COMMITTEE MEMBER',
    'MEMBER',
];

function normalize_role(?string $role): string {
    $r = strtoupper(trim((string) $role));
    if ($r === 'COMMITEE MEMBER') {
        return 'COMMITTEE MEMBER';
    }
    return in_array($r, ROLE_GROUPS, true) ? $r : 'MEMBER';
}

function avatar_url(?string $pfpId): ?string {
    $pfpId = $pfpId !== null && $pfpId !== '' ? $pfpId : 'default';
    if (in_array($pfpId, PRESET_IDS, true)) {
        return null;
    }
    return '/uploads/pfp/' . basename($pfpId);
}

$pdo = get_db();
$me = current_user($pdo);
if (!$me) {
    json_error(401, 'You must be logged in.');
}

$q = trim($_GET['q'] ?? '');

$sql = 'SELECT id, username, pfp_id, main_role, sub_role, club, grade, strand,
               status, presence, last_seen
        FROM users
        WHERE is_banned = 0';
$params = [];
if ($q !== '') {
    $sql .= ' AND username LIKE :q';
    $params[':q'] = '%' . $q . '%';
}
$sql .= ' ORDER BY username COLLATE NOCASE';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$now = time();
$buckets = array_fill_keys(ROLE_GROUPS, []);

foreach ($rows as $row) {
    $lastSeen = $row['last_seen'] !== null ? (int) $row['last_seen'] : null;
    $online = $lastSeen !== null && ($now - $lastSeen) < ONLINE_THRESHOLD_SECONDS;
    $rawPresence = $row['presence'] ?: 'online';
    $effectivePresence = (!$online || $rawPresence === 'invisible') ? 'offline' : $rawPresence;

    $roleKey = normalize_role($row['main_role']);
    $buckets[$roleKey][] = [
        'id'        => (int) $row['id'],
        'username'  => $row['username'],
        'avatarUrl' => avatar_url($row['pfp_id']),
        'pfpId'     => $row['pfp_id'] !== null && $row['pfp_id'] !== '' ? $row['pfp_id'] : 'default',
        'subRole'   => $row['sub_role'] ?: null,
        'club'      => $row['club'] ?: null,
        'grade'     => $row['grade'] ?: null,
        'strand'    => $row['strand'] ?: null,
        'status'    => $row['status'] ?: '',
        'presence'  => $effectivePresence,
        'online'    => $online && $rawPresence !== 'invisible',
        '_sortKey'  => $effectivePresence === 'offline' ? 1 : 0, // online/away/dnd first
    ];
}

$groups = [];
foreach (ROLE_GROUPS as $roleKey) {
    $users = $buckets[$roleKey];
    if (!$users) {
        continue; // no adviser assigned yet, etc. -- don't show a "— 0" header
    }
    usort($users, function ($a, $b) {
        if ($a['_sortKey'] !== $b['_sortKey']) {
            return $a['_sortKey'] <=> $b['_sortKey'];
        }
        return strcasecmp($a['username'], $b['username']);
    });
    foreach ($users as &$u) {
        unset($u['_sortKey']);
    }
    unset($u);
    $groups[] = ['role' => $roleKey, 'count' => count($users), 'users' => $users];
}

echo json_encode(['ok' => true, 'groups' => $groups]);
