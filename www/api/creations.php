<?php
/**
 * api/creations.php
 *
 * GET  /api/creations.php              -> list approved creations (bare JSON array, public)
 * GET  /api/creations.php?featured     -> featured set for the spotlight rotation (bare JSON array, public)
 * GET  /api/creations.php?mine=1       -> own submissions incl. pending (login required)
 * GET  /api/creations.php?id=X         -> single normalized creation { ok, creation } (public if approved)
 * POST /api/creations.php              -> create new submission (verified users only)
 *
 * The list/featured endpoints return bare arrays (not { ok, creations })
 * because creations/index.html wraps the decoded body with toArray() and
 * maps each element through normItem(). Field names below match exactly
 * what normItem() reads: id, title, creator, category, tools[], description,
 * media[{type,src}], url, batch, date/submitted_at, award, period.
 *
 * Moderation (approve/reject/feature/delete) lives ONLY in admin.php's
 * Creations tab, which writes to the DB directly under the admin-accounts
 * session. There is deliberately no PATCH/DELETE here so there is exactly
 * one moderation gate.
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/creations-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

$pdo = get_db();
$me = current_user($pdo);
$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: list / featured / mine / single ----

if ($method === 'GET') {
    // Single creation by ID — public when approved; otherwise only the
    // submitter may view it (moderators use the admin panel, not this).
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id > 0) {
        $row = fetch_creation($pdo, $id);

        if (!$row) {
            json_error(404, 'Creation not found.');
        }
        if ($row['status'] !== 'approved') {
            if (!$me || (int) $me['id'] !== (int) $row['submitted_by']) {
                json_error(403, 'Access denied.');
            }
        }

        echo json_encode(['ok' => true, 'creation' => attach_collaborators($pdo, [normalize_creation($row)])[0]]);
        exit;
    }

    // Spotlight rotation — every featured + approved entry; the hub groups
    // them into week/month/year tabs client-side.
    if (isset($_GET['featured'])) {
        $rows = $pdo->query(
            "SELECT c.*, u.username, u.id AS creator_id, u.pfp_id AS creator_pfp
             FROM creations c
             LEFT JOIN users u ON u.id = c.submitted_by
             WHERE c.status = 'approved' AND c.featured_period IS NOT NULL
             ORDER BY c.featured_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(attach_collaborators($pdo, array_map('normalize_creation', $rows)));
        exit;
    }

    // Own submissions (any status) so a student can track pending review.
    if (isset($_GET['mine'])) {
        if (!$me) {
            json_error(401, 'You must be logged in.');
        }
        $stmt = $pdo->prepare(
            'SELECT c.*, u.username, u.id AS creator_id, u.pfp_id AS creator_pfp
             FROM creations c
             LEFT JOIN users u ON u.id = c.submitted_by
             WHERE c.submitted_by = :uid
             ORDER BY c.created_at DESC'
        );
        $stmt->execute([':uid' => $me['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(attach_collaborators($pdo, array_map('normalize_creation', $rows)));
        exit;
    }

    // Public archive — approved only, with optional category/user filters
    // (the hub also filters client-side; these just trim the payload).
    $where = ["c.status = 'approved'"];
    $params = [];

    $category = trim((string) ($_GET['category'] ?? ''));
    if ($category !== '') {
        if (!in_array($category, CREATION_CATEGORIES, true)) {
            json_error(400, 'Invalid category.');
        }
        $where[] = 'c.category = :category';
        $params[':category'] = $category;
    }

    $userId = isset($_GET['user']) ? (int) $_GET['user'] : 0;
    if ($userId > 0) {
        $where[] = 'c.submitted_by = :user_id';
        $params[':user_id'] = $userId;
    }

    $whereClause = implode(' AND ', $where);
    $stmt = $pdo->prepare(
        "SELECT c.*, u.username, u.id AS creator_id, u.pfp_id AS creator_pfp
         FROM creations c
         LEFT JOIN users u ON u.id = c.submitted_by
         WHERE {$whereClause}
         ORDER BY c.created_at DESC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(attach_collaborators($pdo, array_map('normalize_creation', $rows)));
    exit;
}

// ---- POST: create new submission ----

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    // require_csrf() only reads $_POST['csrf_token'], which is empty for
    // JSON requests — merge the decoded body first (same pattern as
    // api/profile.php and api/comments.php).
    $_POST = array_merge($_POST, $body);

    require_csrf();

    if (!$me) {
        json_error(401, 'You must be logged in.');
    }
    if ((int) ($me['is_verified'] ?? 0) !== 1) {
        json_error(403, 'You must verify your PCU Gmail account to submit creations.');
    }

    $title = trim((string) ($body['title'] ?? ''));
    $descriptionRaw = (string) ($body['description'] ?? '');
    $category = trim((string) ($body['category'] ?? ''));
    $toolsUsed = $body['tools_used'] ?? [];
    $mediaUrls = $body['media_urls'] ?? [];
    $externalLink = trim((string) ($body['external_link'] ?? ''));
    $videoUrl = trim((string) ($body['video_url'] ?? ''));
    $linksInput = $body['links'] ?? [];
    $collabsInput = $body['collaborators'] ?? [];
    $coverFocusInput = $body['cover_focus'] ?? null;

    // Cover focal point: optional {x, y} percentages guiding the crop.
    $coverFocus = null;
    if (is_array($coverFocusInput) && isset($coverFocusInput['x'], $coverFocusInput['y'])) {
        $cfx = (float) $coverFocusInput['x'];
        $cfy = (float) $coverFocusInput['y'];
        if ($cfx < 0 || $cfx > 100 || $cfy < 0 || $cfy > 100) {
            json_error(422, 'Invalid cover focus point.');
        }
        $coverFocus = ['x' => $cfx, 'y' => $cfy];
    }

    if ($title === '') {
        json_error(422, 'Title is required.');
    }
    if (mb_strlen($title) > CREATION_MAX_TITLE_LENGTH) {
        json_error(422, 'Title is too long (max ' . CREATION_MAX_TITLE_LENGTH . ' characters).');
    }
    // Description arrives as composer HTML — sanitize to the inline subset,
    // then validate the visible text length (markup itself doesn't count).
    if (mb_strlen($descriptionRaw) > CREATION_DESC_HTML_MAX) {
        json_error(422, 'Description formatting is too large.');
    }
    $description = sanitize_rich_text($descriptionRaw);
    $descLen = rich_text_length($description);
    if ($descLen === 0) {
        json_error(422, 'Description is required.');
    }
    if ($descLen > CREATION_MAX_DESCRIPTION_LENGTH) {
        json_error(422, 'Description is too long (max ' . CREATION_MAX_DESCRIPTION_LENGTH . ' characters).');
    }
    if (!in_array($category, CREATION_CATEGORIES, true)) {
        json_error(422, 'Invalid category.');
    }

    // Tools: optional string array, capped in count and length.
    if (!is_array($toolsUsed)) {
        json_error(422, 'tools_used must be an array.');
    }
    $toolsUsed = array_values(array_filter(array_map(
        fn($t) => mb_substr(trim((string) $t), 0, CREATION_MAX_TOOL_LENGTH),
        array_slice($toolsUsed, 0, CREATION_MAX_TOOLS)
    ), fn($t) => $t !== ''));

    // Media: optional array of paths previously returned by
    // creation-upload.php. Only our own uploads directory is accepted so a
    // submission cannot hotlink arbitrary third-party URLs through us.
    if (!is_array($mediaUrls)) {
        json_error(422, 'media_urls must be an array.');
    }
    $mediaUrls = array_slice($mediaUrls, 0, CREATION_MAX_MEDIA);
    foreach ($mediaUrls as $u) {
        if (!is_string($u) || !str_starts_with($u, '/uploads/creations/') || str_contains($u, '..')) {
            json_error(422, 'Invalid media URL. Upload images via the media uploader first.');
        }
    }

    if ($externalLink !== '') {
        if (mb_strlen($externalLink) > CREATION_MAX_LINK_LENGTH
            || !filter_var($externalLink, FILTER_VALIDATE_URL)
            || !preg_match('#^https?://#i', $externalLink)) {
            json_error(422, 'Project link must be a valid http(s) URL.');
        }
    }

    // Demo video: same URL rules as the project link.
    if ($videoUrl !== '') {
        if (mb_strlen($videoUrl) > CREATION_MAX_LINK_LENGTH
            || !filter_var($videoUrl, FILTER_VALIDATE_URL)
            || !preg_match('#^https?://#i', $videoUrl)) {
            json_error(422, 'Demo video must be a valid http(s) URL.');
        }
    }

    // Labeled links: optional array of {label, url}, capped in count.
    if (!is_array($linksInput)) {
        json_error(422, 'links must be an array.');
    }
    $links = [];
    foreach (array_slice($linksInput, 0, CREATION_MAX_LINKS) as $l) {
        if (!is_array($l)) {
            json_error(422, 'Each link needs a label and a URL.');
        }
        $label = mb_substr(trim((string) ($l['label'] ?? '')), 0, CREATION_MAX_LINK_LABEL_LENGTH);
        $url = trim((string) ($l['url'] ?? ''));
        if ($label === '' || $url === '') {
            json_error(422, 'Each link needs a label and a URL.');
        }
        if (mb_strlen($url) > CREATION_MAX_LINK_LENGTH
            || !filter_var($url, FILTER_VALIDATE_URL)
            || !preg_match('#^https?://#i', $url)) {
            json_error(422, 'Link "' . $label . '" must be a valid http(s) URL.');
        }
        $links[] = ['label' => $label, 'url' => $url];
    }

    // Collaborators: array of user IDs (from autocomplete) and/or usernames.
    // Resolved to real, non-banned accounts; the submitter is dropped.
    if (!is_array($collabsInput)) {
        json_error(422, 'collaborators must be an array.');
    }
    $collabIds = [];
    $collabNames = [];
    foreach (array_slice($collabsInput, 0, CREATION_MAX_COLLABORATORS) as $c) {
        if (is_int($c) || (is_string($c) && ctype_digit($c))) {
            $cid = (int) $c;
            if ($cid > 0 && $cid !== (int) $me['id']) {
                $collabIds[$cid] = true;
            }
        } elseif (is_string($c) && trim($c) !== '') {
            $collabNames[mb_strtolower(trim($c))] = true;
        }
    }
    if (!empty($collabNames)) {
        $placeholders = implode(',', array_fill(0, count($collabNames), '?'));
        $stmt = $pdo->prepare(
            "SELECT id FROM users WHERE username_lower IN ($placeholders) AND is_banned = 0"
        );
        $stmt->execute(array_keys($collabNames));
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $cid) {
            $cid = (int) $cid;
            if ($cid !== (int) $me['id']) {
                $collabIds[$cid] = true;
            }
        }
    }
    // Keep only IDs that still exist (autocomplete results could be stale).
    if (!empty($collabIds)) {
        $placeholders = implode(',', array_fill(0, count($collabIds), '?'));
        $stmt = $pdo->prepare("SELECT id FROM users WHERE id IN ($placeholders) AND is_banned = 0");
        $stmt->execute(array_keys($collabIds));
        $collabIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    } else {
        $collabIds = [];
    }

    $stmt = $pdo->prepare(
        "INSERT INTO creations
            (title, description, category, tools_used, media_urls, external_link,
             video_url, links, collaborators, cover_focus,
             submitted_by, batch, status, created_at, updated_at)
         VALUES (:title, :description, :category, :tools_used, :media_urls,
             :external_link, :video_url, :links, :collaborators, :cover_focus,
             :submitted_by, :batch, 'pending', datetime('now'), datetime('now'))"
    );
    $stmt->execute([
        ':title' => $title,
        ':description' => $description,
        ':category' => $category,
        ':tools_used' => !empty($toolsUsed) ? json_encode($toolsUsed) : null,
        ':media_urls' => !empty($mediaUrls) ? json_encode(array_values($mediaUrls)) : null,
        ':external_link' => $externalLink !== '' ? $externalLink : null,
        ':video_url' => $videoUrl !== '' ? $videoUrl : null,
        ':links' => !empty($links) ? json_encode($links) : null,
        ':collaborators' => !empty($collabIds) ? json_encode(array_values($collabIds)) : null,
        ':cover_focus' => $coverFocus !== null ? json_encode($coverFocus) : null,
        ':submitted_by' => $me['id'],
        ':batch' => current_school_year(),
    ]);

    echo json_encode(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    exit;
}

json_error(405, 'Method not allowed.');
