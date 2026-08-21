<?php
/**
 * GET  /api/comments.php?post_id=123          -> list comments for a post, no auth required
 * POST /api/comments.php                      -> create/edit/delete a comment, auth + CSRF required
 *                                                 body: JSON { action, postId?, commentId?, parentId?, replyToUser?, body?, csrf_token }
 *
 * action = "create"  { postId, body, parentId?, replyToUser? }
 * action = "edit"    { commentId, body }   -- must own the comment
 * action = "delete"  { commentId }          -- must own the comment; soft-delete (sets deleted_at)
 */

declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();

const MAX_COMMENT_LENGTH = 500;

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

/** JSON-friendly version of require_login() -- returns a 401 instead of redirecting. */
function require_login_json(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) {
        json_error(401, 'You must be logged in.');
    }
    return $user;
}

/**
 * Walks the reply tree and returns every descendant comment ID of $rootId
 * (replies, replies-to-replies, etc.), not including $rootId itself. Used so
 * deleting a comment can cascade to its replies instead of leaving them
 * orphaned and still active in the DB.
 */
function collect_descendant_ids(PDO $pdo, int $rootId): array {
    $ids = [];
    $frontier = [$rootId];
    while (!empty($frontier)) {
        $placeholders = implode(',', array_fill(0, count($frontier), '?'));
        $stmt = $pdo->prepare("SELECT id FROM comments WHERE parent_id IN ($placeholders) AND deleted_at IS NULL");
        $stmt->execute(array_values($frontier));
        $children = array_map(fn($row) => (int) $row['id'], $stmt->fetchAll());
        $newIds = array_values(array_diff($children, $ids));
        $ids = array_merge($ids, $newIds);
        $frontier = $newIds;
    }
    return $ids;
}

/** True if a post with this id currently exists in announcements.json (not deleted by admin). */
function post_exists(int $postId): bool {
    $jsonFile = __DIR__ . '/../announcements.json';
    if (!file_exists($jsonFile)) {
        return false;
    }
    $data = json_decode(file_get_contents($jsonFile), true);
    if (!is_array($data)) {
        return false;
    }
    foreach ($data as $post) {
        if ((int) ($post['id'] ?? 0) === $postId) {
            return true;
        }
    }
    return false;
}

function public_comment(array $c, ?int $viewerUserId): array {
    return [
        'id'          => (int) $c['id'],
        'postId'      => (int) $c['post_id'],
        'parentId'    => $c['parent_id'] !== null ? (int) $c['parent_id'] : null,
        'replyToUser' => $c['reply_to_user'] ?? null,
        'body'        => $c['body'],
        'createdAt'   => $c['created_at'],
        'editedAt'    => $c['edited_at'],
        'user'        => [
            'id'       => (int) $c['user_id'],
            'username' => $c['username'],
            'pfpId'    => $c['pfp_id'],
        ],
        'isOwn' => $viewerUserId !== null && $viewerUserId === (int) $c['user_id'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: list comments for a post (public, no login required) ----
if ($method === 'GET') {
    $postId = (int) ($_GET['post_id'] ?? 0);
    if ($postId <= 0) {
        json_error(400, 'Missing or invalid post_id.');
    }

    $viewer = current_user($pdo); // optional -- just used to flag isOwn for the current viewer
    $viewerId = $viewer ? (int) $viewer['id'] : null;

    $stmt = $pdo->prepare(
        'SELECT c.*, u.username, u.pfp_id
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = :post_id AND c.deleted_at IS NULL
         ORDER BY c.created_at ASC'
    );
    $stmt->execute([':post_id' => $postId]);
    $rows = $stmt->fetchAll();

    $comments = array_map(fn($row) => public_comment($row, $viewerId), $rows);
    echo json_encode(['comments' => $comments]);
    exit;
}

// ---- POST: create / edit / delete ----
if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    $_POST = array_merge($_POST, $body);

    require_csrf();
    $currentUser = require_login_json($pdo);

    $action = (string) ($body['action'] ?? '');

    if ($action === 'create') {
        $postId = (int) ($body['postId'] ?? $body['post_id'] ?? 0);
        $text   = trim((string) ($body['body'] ?? ''));

        $parentIdRaw = $body['parentId'] ?? $body['parent_id'] ?? null;
        $parentId    = ($parentIdRaw !== null && $parentIdRaw !== '') ? (int) $parentIdRaw : null;

        $replyToUserRaw = $body['replyToUser'] ?? $body['reply_to_user'] ?? null;
        $replyToUser    = ($replyToUserRaw !== null && trim((string) $replyToUserRaw) !== '') ? trim((string) $replyToUserRaw) : null;

        if ($postId <= 0) {
            json_error(400, 'Missing or invalid postId.');
        }
        if ($text === '') {
            json_error(422, 'Comment cannot be empty.');
        }
        if (mb_strlen($text) > MAX_COMMENT_LENGTH) {
            json_error(422, 'Comment is too long (max ' . MAX_COMMENT_LENGTH . ' characters).');
        }
        if (!post_exists($postId)) {
            json_error(404, 'This post no longer exists.');
        }

        $stmt = $pdo->prepare(
            'INSERT INTO comments (post_id, user_id, parent_id, reply_to_user, body)
             VALUES (:post_id, :user_id, :parent_id, :reply_to_user, :body)'
        );
        $stmt->execute([
            ':post_id'       => $postId,
            ':user_id'       => $currentUser['id'],
            ':parent_id'     => $parentId,
            ':reply_to_user' => $replyToUser,
            ':body'          => $text,
        ]);

        $newId = (int) $pdo->lastInsertId();
        $stmt = $pdo->prepare(
            'SELECT c.*, u.username, u.pfp_id FROM comments c
             JOIN users u ON u.id = c.user_id WHERE c.id = :id'
        );
        $stmt->execute([':id' => $newId]);
        $comment = $stmt->fetch();

        echo json_encode(['comment' => public_comment($comment, (int) $currentUser['id'])]);
        exit;
    }

    if ($action === 'edit') {
        $commentId = (int) ($body['commentId'] ?? 0);
        $text      = trim((string) ($body['body'] ?? ''));

        if ($commentId <= 0) {
            json_error(400, 'Missing or invalid commentId.');
        }
        if ($text === '') {
            json_error(422, 'Comment cannot be empty.');
        }
        if (mb_strlen($text) > MAX_COMMENT_LENGTH) {
            json_error(422, 'Comment is too long (max ' . MAX_COMMENT_LENGTH . ' characters).');
        }

        $stmt = $pdo->prepare('SELECT * FROM comments WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute([':id' => $commentId]);
        $existing = $stmt->fetch();

        if (!$existing) {
            json_error(404, 'Comment not found.');
        }
        if ((int) $existing['user_id'] !== (int) $currentUser['id']) {
            json_error(403, 'You can only edit your own comments.');
        }

        $stmt = $pdo->prepare(
            'UPDATE comments SET body = :body, edited_at = datetime("now") WHERE id = :id'
        );
        $stmt->execute([':body' => $text, ':id' => $commentId]);

        $stmt = $pdo->prepare(
            'SELECT c.*, u.username, u.pfp_id FROM comments c
             JOIN users u ON u.id = c.user_id WHERE c.id = :id'
        );
        $stmt->execute([':id' => $commentId]);
        $comment = $stmt->fetch();

        echo json_encode(['comment' => public_comment($comment, (int) $currentUser['id'])]);
        exit;
    }

    if ($action === 'delete') {
        $commentId = (int) ($body['commentId'] ?? 0);
        if ($commentId <= 0) {
            json_error(400, 'Missing or invalid commentId.');
        }

        $stmt = $pdo->prepare('SELECT * FROM comments WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute([':id' => $commentId]);
        $existing = $stmt->fetch();

        if (!$existing) {
            json_error(404, 'Comment not found.');
        }
        if ((int) $existing['user_id'] !== (int) $currentUser['id']) {
            json_error(403, 'You can only delete your own comments.');
        }

        $descendantIds = collect_descendant_ids($pdo, $commentId);
        $allIds = array_merge([$commentId], $descendantIds);

        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $stmt = $pdo->prepare("UPDATE comments SET deleted_at = datetime('now') WHERE id IN ($placeholders) AND deleted_at IS NULL");
        $stmt->execute($allIds);

        echo json_encode(['deleted' => true, 'commentId' => $commentId, 'deletedIds' => $allIds]);
        exit;
    }

    json_error(400, 'Unknown action.');
}

json_error(405, 'Method not allowed.');