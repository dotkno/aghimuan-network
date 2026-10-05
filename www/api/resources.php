<?php
/**
 * api/resources.php
 *
 * GET  /api/resources.php                    -> list approved resources (bare JSON array, public)
 * GET  /api/resources.php?featured            -> staff-picked shelf (bare JSON array, public)
 * GET  /api/resources.php?mine=1              -> own suggestions incl. pending (login required)
 * GET  /api/resources.php?favorites=1         -> own favorited resources (login required)
 * GET  /api/resources.php?id=X                -> single normalized resource { ok, resource }
 * POST /api/resources.php                    -> suggest a new resource (verified users only)
 *
 * Filters on the list endpoint: ?category=&type=&q=&sort=new|popular
 * (the hub also filters client-side; these just trim the payload).
 *
 * The list/featured endpoints return bare arrays (not { ok, resources })
 * because resources/index.html wraps the decoded body with toArray(), the
 * same contract as api/creations.php.
 *
 * Moderation (approve/reject/feature/delete/seed) lives ONLY in admin.php's
 * Resources tab, which writes to the DB directly under the admin-accounts
 * session. There is deliberately no PATCH/DELETE here so there is exactly
 * one moderation gate.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/resources-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

$pdo = get_db();
$me = current_user($pdo);
$myId = $me ? (int) $me['id'] : 0;
$method = $_SERVER['REQUEST_METHOD'];

// Base select: one query carries the favorite count plus, when logged in,
// whether the viewer favorited the row — no N+1 from the hub.
function resource_select(string $favJoin): string {
    return "SELECT r.*, u.username,
            (SELECT COUNT(*) FROM resource_favorites f WHERE f.resource_id = r.id) AS fav_count,
            {$favJoin} AS is_favorited
            FROM resources r
            LEFT JOIN users u ON u.id = r.submitted_by";
}

// ---- GET: list / featured / mine / favorites / single ----

if ($method === 'GET') {
    $favExpr = $myId > 0
        ? "EXISTS (SELECT 1 FROM resource_favorites f2 WHERE f2.resource_id = r.id AND f2.user_id = {$myId})"
        : '0';

    // Single resource by ID — public when approved; otherwise only the
    // suggester may view it (moderators use the admin panel, not this).
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id > 0) {
        $row = fetch_resource($pdo, $id);
        if (!$row) {
            json_error(404, 'Resource not found.');
        }
        if ($row['status'] !== 'approved') {
            if (!$me || (int) $row['submitted_by'] !== $myId) {
                // Same 404 as missing — unapproved rows must not leak.
                json_error(404, 'Resource not found.');
            }
        }
        $stmt = $pdo->prepare(resource_select($favExpr) . ' WHERE r.id = :id');
        $stmt->execute([':id' => $id]);
        $full = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$full) {
            json_error(404, 'Resource not found.');
        }
        echo json_encode(['ok' => true, 'resource' => normalize_resource($full)]);
        exit;
    }

    // Staff-picked shelf — every featured + approved entry.
    if (isset($_GET['featured'])) {
        $rows = $pdo->query(
            resource_select($favExpr) .
            " WHERE r.status = 'approved' AND r.featured = 1
              ORDER BY r.featured_at DESC, r.created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(array_map('normalize_resource', $rows));
        exit;
    }

    // Own suggestions (any status) so a student can track pending review.
    if (isset($_GET['mine'])) {
        if (!$me) {
            json_error(401, 'You must be logged in.');
        }
        $stmt = $pdo->prepare(
            resource_select($favExpr) .
            ' WHERE r.submitted_by = :uid
              ORDER BY r.created_at DESC'
        );
        $stmt->execute([':uid' => $myId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(array_map('normalize_resource', $rows));
        exit;
    }

    // Own favorites (approved only — pending rows can never be favorited).
    if (isset($_GET['favorites'])) {
        if (!$me) {
            json_error(401, 'You must be logged in.');
        }
        $stmt = $pdo->prepare(
            resource_select($favExpr) .
            " JOIN resource_favorites mf ON mf.resource_id = r.id AND mf.user_id = :uid
              WHERE r.status = 'approved'
              ORDER BY mf.created_at DESC"
        );
        $stmt->execute([':uid' => $myId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(array_map('normalize_resource', $rows));
        exit;
    }

    // Public archive — approved only, with optional category/type/search
    // filters. sort=popular orders by favorite count.
    $where = ["r.status = 'approved'"];
    $params = [];

    $category = trim((string) ($_GET['category'] ?? ''));
    if ($category !== '') {
        if (!in_array($category, RESOURCE_CATEGORIES, true)) {
            json_error(400, 'Invalid category.');
        }
        $where[] = 'r.category = :category';
        $params[':category'] = $category;
    }

    $type = trim((string) ($_GET['type'] ?? ''));
    if ($type !== '') {
        if (!in_array($type, RESOURCE_TYPES, true)) {
            json_error(400, 'Invalid type.');
        }
        $where[] = 'r.type = :type';
        $params[':type'] = $type;
    }

    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $q = mb_substr($q, 0, RESOURCE_MAX_SEARCH_LENGTH);
        $where[] = '(r.title LIKE :q OR r.description LIKE :q OR r.url LIKE :q)';
        $params[':q'] = '%' . $q . '%';
    }

    $sort = trim((string) ($_GET['sort'] ?? 'new'));
    $orderBy = $sort === 'popular'
        ? 'fav_count DESC, r.created_at DESC'
        : 'r.created_at DESC';

    $whereClause = implode(' AND ', $where);
    $stmt = $pdo->prepare(
        resource_select($favExpr) .
        " WHERE {$whereClause}
          ORDER BY {$orderBy}"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(array_map('normalize_resource', $rows));
    exit;
}

// ---- POST: suggest a new resource ----

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    // require_csrf() only reads $_POST['csrf_token'], which is empty for
    // JSON requests — merge the decoded body first (same pattern as
    // api/creations.php and api/reactions.php).
    $_POST = array_merge($_POST, $body);

    require_csrf();

    if (!$me) {
        json_error(401, 'You must be logged in.');
    }
    if ((int) ($me['is_verified'] ?? 0) !== 1) {
        json_error(403, 'You must verify your PCU Gmail account to suggest resources.');
    }

    $title = trim((string) ($body['title'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $category = trim((string) ($body['category'] ?? 'other'));
    $resType = trim((string) ($body['type'] ?? 'website'));
    $urlInput = trim((string) ($body['url'] ?? ''));
    $tagsInput = $body['tags'] ?? [];

    if ($title === '') {
        json_error(422, 'Title is required.');
    }
    if (mb_strlen($title) > RESOURCE_MAX_TITLE_LENGTH) {
        json_error(422, 'Title is too long (max ' . RESOURCE_MAX_TITLE_LENGTH . ' characters).');
    }
    if ($description === '') {
        json_error(422, 'Description is required.');
    }
    if (mb_strlen($description) > RESOURCE_MAX_DESCRIPTION_LENGTH) {
        json_error(422, 'Description is too long (max ' . RESOURCE_MAX_DESCRIPTION_LENGTH . ' characters).');
    }
    if (!in_array($category, RESOURCE_CATEGORIES, true)) {
        json_error(422, 'Invalid category.');
    }
    if (!in_array($resType, RESOURCE_TYPES, true)) {
        json_error(422, 'Invalid type.');
    }

    // Canonicalize for dedupe: https://x.com vs https://x.com/ is one row.
    $urlNorm = normalize_resource_url($urlInput);
    if ($urlNorm === null) {
        json_error(422, 'Link must be a valid http(s) URL.');
    }
    // Display the canonical form's origin URL, not the raw input.
    $url = $urlInput;

    // Tags: optional string array, capped in count and length.
    if (!is_array($tagsInput)) {
        json_error(422, 'tags must be an array.');
    }
    $tags = array_values(array_filter(array_map(
        fn($t) => mb_substr(trim((string) $t), 0, RESOURCE_MAX_TAG_LENGTH),
        array_slice($tagsInput, 0, RESOURCE_MAX_TAGS)
    ), fn($t) => $t !== ''));

    // Friendly dedupe before the unique index has to enforce it.
    $dup = $pdo->prepare('SELECT id, status FROM resources WHERE url_norm = :n');
    $dup->execute([':n' => $urlNorm]);
    if ($existing = $dup->fetch(PDO::FETCH_ASSOC)) {
        if ($existing['status'] === 'approved') {
            json_error(409, 'That resource is already listed in the hub.');
        }
        json_error(409, 'That resource has already been suggested and is awaiting review.');
    }

    $stmt = $pdo->prepare(
        "INSERT INTO resources
            (title, description, category, type, url, url_norm, tags,
             submitted_by, status, created_at, updated_at)
         VALUES (:title, :description, :category, :type, :url, :url_norm, :tags,
             :submitted_by, 'pending', datetime('now'), datetime('now'))"
    );
    $stmt->execute([
        ':title' => $title,
        ':description' => $description,
        ':category' => $category,
        ':type' => $resType,
        ':url' => $url,
        ':url_norm' => $urlNorm,
        ':tags' => !empty($tags) ? json_encode(array_values($tags)) : null,
        ':submitted_by' => $myId,
    ]);

    echo json_encode(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    exit;
}

json_error(405, 'Method not allowed.');
