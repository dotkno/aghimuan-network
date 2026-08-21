<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();

// NOTE: the "reactions" table itself is created/migrated in includes/db.php,
// using the shape defined in schema.sql (columns: target_type, target_id,
// user_id, emoji). Do not redefine the table here -- a second, differently
// shaped CREATE TABLE IF NOT EXISTS in this file is what caused every
// reaction request to 500 before (it created a `reaction_type` column that
// none of these queries could see once the schema.sql version already
// existed, or vice versa).

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// DMs are private between two people, unlike posts/comments which are public
// content — so unlike those two target types, 'dm_message' needs an explicit
// participancy check before either reading or writing a reaction, or anyone
// logged in who guessed/enumerated a message id could read or react to a
// conversation they're not part of.
function user_can_access_dm_message(PDO $pdo, int $userId, int $messageId): bool {
    $stmt = $pdo->prepare(
        'SELECT 1 FROM direct_messages WHERE id = :id AND (sender_id = :user OR recipient_id = :user)'
    );
    $stmt->execute([':id' => $messageId, ':user' => $userId]);
    return (bool) $stmt->fetchColumn();
}

// 'post' reactions are single-emoji-per-user (picking a new one replaces the
// old); 'comment' and 'dm_message' are multi-emoji-per-user (each emoji
// toggles independently) — grouped here so both target types share one code
// path instead of drifting apart.
const MULTI_REACTION_TARGET_TYPES = ['comment', 'dm_message'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $targetType = $_GET['target_type'] ?? '';
    $targetId = (int) ($_GET['target_id'] ?? 0);

    if (!in_array($targetType, ['post', 'comment', 'dm_message'], true) || $targetId <= 0) {
        json_error(400, 'invalid target parameters');
    }

    $viewer = current_user($pdo);
    $viewerId = $viewer ? (int) $viewer['id'] : null;

    if ($targetType === 'dm_message') {
        if (!$viewerId || !user_can_access_dm_message($pdo, $viewerId, $targetId)) {
            json_error(403, 'not authorized to view these reactions');
        }
    }

    $stmt = $pdo->prepare("
        SELECT emoji, user_id
        FROM reactions
        WHERE target_type = :target_type AND target_id = :target_id
    ");
    $stmt->execute([':target_type' => $targetType, ':target_id' => $targetId]);
    $rows = $stmt->fetchAll();

    $counts = [];
    $userReactions = [];

    foreach ($rows as $row) {
        $type = $row['emoji'];
        $counts[$type] = ($counts[$type] ?? 0) + 1;
        if ($viewerId && (int)$row['user_id'] === $viewerId) {
            $userReactions[] = $type;
        }
    }

    echo json_encode([
        'counts' => $counts,
        'userReactions' => $userReactions
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'invalid json body');
    }
    $_POST = array_merge($_POST, $body);

    require_csrf();
    $currentUser = current_user($pdo);
    if (!$currentUser) {
        json_error(401, 'you must be logged in');
    }

    $targetType = (string) ($body['targetType'] ?? $body['target_type'] ?? '');
    $targetId = (int) ($body['targetId'] ?? $body['target_id'] ?? 0);
    $reactionType = trim((string) ($body['reactionType'] ?? $body['reaction_type'] ?? ''));

    if (!in_array($targetType, ['post', 'comment', 'dm_message'], true) || $targetId <= 0 || $reactionType === '') {
        json_error(400, 'invalid reaction parameters');
    }

    $userId = (int) $currentUser['id'];

    if ($targetType === 'dm_message' && !user_can_access_dm_message($pdo, $userId, $targetId)) {
        json_error(403, 'not authorized to react to this message');
    }

    if (!in_array($targetType, MULTI_REACTION_TARGET_TYPES, true)) {
        $stmt = $pdo->prepare("
            SELECT emoji FROM reactions
            WHERE user_id = :user_id AND target_type = 'post' AND target_id = :target_id
        ");
        $stmt->execute([':user_id' => $userId, ':target_id' => $targetId]);
        $existing = $stmt->fetch();

        if ($existing) {
            if ($existing['emoji'] === $reactionType) {
                $del = $pdo->prepare("
                    DELETE FROM reactions
                    WHERE user_id = :user_id AND target_type = 'post' AND target_id = :target_id
                ");
                $del->execute([':user_id' => $userId, ':target_id' => $targetId]);
            } else {
                $upd = $pdo->prepare("
                    UPDATE reactions
                    SET emoji = :emoji, created_at = datetime('now')
                    WHERE user_id = :user_id AND target_type = 'post' AND target_id = :target_id
                ");
                $upd->execute([':emoji' => $reactionType, ':user_id' => $userId, ':target_id' => $targetId]);
            }
        } else {
            $ins = $pdo->prepare("
                INSERT INTO reactions (user_id, target_type, target_id, emoji)
                VALUES (:user_id, 'post', :target_id, :emoji)
            ");
            $ins->execute([':user_id' => $userId, ':target_id' => $targetId, ':emoji' => $reactionType]);
        }
    } else {
        // Shared multi-emoji-per-user path for 'comment' and 'dm_message' —
        // parameterized on $targetType instead of hardcoding 'comment' so
        // the two target types stay in lockstep rather than needing a
        // separate near-duplicate branch.
        $stmt = $pdo->prepare("
            SELECT id FROM reactions
            WHERE user_id = :user_id AND target_type = :target_type AND target_id = :target_id AND emoji = :emoji
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':emoji' => $reactionType
        ]);
        $existing = $stmt->fetch();

        if ($existing) {
            $del = $pdo->prepare("DELETE FROM reactions WHERE id = :id");
            $del->execute([':id' => $existing['id']]);
        } else {
            $ins = $pdo->prepare("
                INSERT INTO reactions (user_id, target_type, target_id, emoji)
                VALUES (:user_id, :target_type, :target_id, :emoji)
            ");
            $ins->execute([
                ':user_id' => $userId,
                ':target_type' => $targetType,
                ':target_id' => $targetId,
                ':emoji' => $reactionType
            ]);
        }
    }

    $stmt = $pdo->prepare("
        SELECT emoji, user_id
        FROM reactions
        WHERE target_type = :target_type AND target_id = :target_id
    ");
    $stmt->execute([':target_type' => $targetType, ':target_id' => $targetId]);
    $rows = $stmt->fetchAll();

    $counts = [];
    $userReactions = [];
    foreach ($rows as $row) {
        $type = $row['emoji'];
        $counts[$type] = ($counts[$type] ?? 0) + 1;
        if ((int)$row['user_id'] === $userId) {
            $userReactions[] = $type;
        }
    }

    echo json_encode([
        'ok' => true,
        'success' => true,
        'counts' => $counts,
        'userReactions' => $userReactions
    ]);
    exit;
}

json_error(405, 'method not allowed');