<?php
declare(strict_types=1);
/**
 * GET /api/friend-requests.php
 * Pending friend requests sent TO the current user (not ones you sent).
 * Powers the account-widget's badge count + request list.
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();

$me = current_user($pdo);
if (!$me) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'login_required']);
    exit;
}

// Keep in sync with PRESET_IDS in profile.php / user-profile.php / account-widget.js.
const PRESET_IDS = [
    'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
    'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
];

$stmt = $pdo->prepare(
    'SELECT f.user_id AS requester_id, f.created_at, u.username, u.pfp_id
     FROM friends f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = :me AND f.status = :status AND u.is_banned = 0
     ORDER BY f.created_at DESC'
);
$stmt->execute([':me' => $me['id'], ':status' => 'pending']);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$requests = array_map(function (array $row): array {
    $pfpId = $row['pfp_id'] !== null && $row['pfp_id'] !== '' ? $row['pfp_id'] : 'default';
    $isPreset = in_array($pfpId, PRESET_IDS, true);
    return [
        'id' => (int) $row['requester_id'],
        'username' => $row['username'],
        'pfpId' => $pfpId,
        'avatarUrl' => $isPreset ? null : '/uploads/pfp/' . basename((string) $pfpId),
        'createdAt' => $row['created_at'],
    ];
}, $rows);

echo json_encode(['ok' => true, 'requests' => $requests]);
