<?php
/**
 * notifications.php — create/read helpers for the notifications table.
 * Include AFTER db.php (needs get_db()'s PDO shape, not required directly,
 * but every caller here expects a $pdo from get_db()):
 *   require_once __DIR__ . '/db.php';
 *   require_once __DIR__ . '/notifications.php';
 *
 * Deliberately does NOT cover friend requests themselves — those are still
 * a live query against the friends table (see api/friend-requests.php),
 * which stays the single source of truth for "pending" state. This table
 * is for everything that ISN'T naturally derivable from another table's
 * current state: friend_accept, and future types (mention, comment,
 * reaction, system, ...).
 */

declare(strict_types=1);

/**
 * Record a notification for a user.
 *
 * @param int         $userId  Who the notification is for.
 * @param string      $type    Free-text key: 'friend_accept', 'mention', 'comment', 'reaction', 'system', ...
 * @param int|null    $actorId Who triggered it (null for system notifications with no actor).
 * @param array       $payload Extra type-specific data (JSON-encoded on save). e.g. ['post_id' => 9]
 */
function create_notification(PDO $pdo, int $userId, string $type, ?int $actorId = null, array $payload = []): int {
    $stmt = $pdo->prepare(
        'INSERT INTO notifications (user_id, actor_id, type, payload, created_at)
         VALUES (:user_id, :actor_id, :type, :payload, datetime("now"))'
    );
    $stmt->execute([
        ':user_id'  => $userId,
        ':actor_id' => $actorId,
        ':type'     => $type,
        ':payload'  => $payload ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null,
    ]);
    return (int) $pdo->lastInsertId();
}

/**
 * Fetch a page of notifications for a user, newest first, with the actor's
 * username/pfp joined in so the UI never needs a second lookup per row.
 *
 * @param int|null $beforeId Pagination cursor — only rows with id < beforeId.
 */
function get_notifications(PDO $pdo, int $userId, int $limit = 20, ?int $beforeId = null): array {
    $limit = max(1, min(100, $limit));
    $sql = 'SELECT n.id, n.actor_id, n.type, n.payload, n.is_read, n.created_at,
                   u.username AS actor_username, u.pfp_id AS actor_pfp_id
            FROM notifications n
            LEFT JOIN users u ON u.id = n.actor_id
            WHERE n.user_id = :user_id';
    $params = [':user_id' => $userId];

    if ($beforeId !== null) {
        $sql .= ' AND n.id < :before_id';
        $params[':before_id'] = $beforeId;
    }

    $sql .= " ORDER BY n.id DESC LIMIT $limit";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['payload'] = $row['payload'] ? json_decode((string) $row['payload'], true) : [];
        $row['is_read'] = (bool) $row['is_read'];
    }
    return $rows;
}

function get_unread_notification_count(PDO $pdo, int $userId): int {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = 0');
    $stmt->execute([':user_id' => $userId]);
    return (int) $stmt->fetchColumn();
}

function mark_notification_read(PDO $pdo, int $userId, int $notificationId): bool {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :user_id');
    return $stmt->execute([':id' => $notificationId, ':user_id' => $userId]);
}

function mark_all_notifications_read(PDO $pdo, int $userId): bool {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = :user_id AND is_read = 0');
    return $stmt->execute([':user_id' => $userId]);
}
