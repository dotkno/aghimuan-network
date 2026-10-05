<?php
/**
 * resources-lib.php — shared Resource Hub helpers.
 *
 * Required by api/resources.php (JSON) so list/single/suggest shape rows
 * identically. Mirrors includes/creations-lib.php (taxonomy consts +
 * normalize_* row shaper), minus Creations-only concepts (media uploads,
 * collaborators, batch, rich text, week/month/year periods).
 *
 * Descriptions are PLAIN TEXT (validated by length, escaped at render with
 * the hub's esc()). Do NOT reuse sanitize_rich_text() here.
 */

declare(strict_types=1);

// Canonical taxonomy — keep in sync with the filter pills in
// resources/index.html and the <select>s in resources/suggest.html.
const RESOURCE_CATEGORIES = ['web-dev', 'programming', 'design', 'networking', 'servicing', 'other'];
const RESOURCE_CATEGORY_LABELS = [
    'web-dev'     => 'Web Development',
    'programming' => 'Programming',
    'design'      => 'Graphic Design',
    'networking'  => 'Networking',
    'servicing'   => 'Computer Servicing',
    'other'       => 'Other ICT',
];
const RESOURCE_TYPES = ['website', 'software', 'course', 'docs', 'tool', 'video', 'open-source'];
const RESOURCE_TYPE_LABELS = [
    'website'     => 'Website',
    'software'    => 'Software',
    'course'      => 'Free Course',
    'docs'        => 'Documentation',
    'tool'        => 'Tool',
    'video'       => 'Video',
    'open-source' => 'Open Source',
];

const RESOURCE_MAX_TITLE_LENGTH = 120;
const RESOURCE_MAX_DESCRIPTION_LENGTH = 1000;
const RESOURCE_MAX_URL_LENGTH = 2000;
const RESOURCE_MAX_TAGS = 8;
const RESOURCE_MAX_TAG_LENGTH = 30;
const RESOURCE_MAX_SEARCH_LENGTH = 100;

/**
 * Normalize a raw URL into a canonical dedupe key.
 * Lowercases the host, strips default ports and trailing slashes so
 * https://example.com and https://example.com/ map to one row.
 * Returns null when the URL is not a valid http(s) URL.
 */
function normalize_resource_url(string $url): ?string {
    $url = trim($url);
    if ($url === '' || mb_strlen($url) > RESOURCE_MAX_URL_LENGTH) {
        return null;
    }
    if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host'])) {
        return null;
    }
    $scheme = strtolower($parts['scheme'] ?? 'https');
    $host = strtolower($parts['host']);
    $port = isset($parts['port']) ? (int) $parts['port'] : 0;
    // Drop default ports — they add no identity.
    if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
        $port = 0;
    }
    $path = rtrim($parts['path'] ?? '', '/');
    $norm = $scheme . '://' . $host;
    if ($port > 0) {
        $norm .= ':' . $port;
    }
    $norm .= $path;
    if (!empty($parts['query'])) {
        $norm .= '?' . $parts['query'];
    }
    if (!empty($parts['fragment'])) {
        $norm .= '#' . $parts['fragment'];
    }
    return $norm;
}

/** Shape a resources DB row into exactly what resources/index.html consumes. */
function normalize_resource(array $row): array {
    $tags = json_decode($row['tags'] ?? '[]', true);
    if (!is_array($tags)) {
        $tags = [];
    }
    $tags = array_values(array_filter(
        array_map(fn($t) => mb_substr(trim((string) $t), 0, RESOURCE_MAX_TAG_LENGTH), array_slice($tags, 0, RESOURCE_MAX_TAGS)),
        fn($t) => $t !== ''
    ));

    $category = $row['category'] ?? 'other';
    if (!in_array($category, RESOURCE_CATEGORIES, true)) {
        $category = 'other';
    }
    $type = $row['type'] ?? 'website';
    if (!in_array($type, RESOURCE_TYPES, true)) {
        $type = 'website';
    }

    $url = trim((string) ($row['url'] ?? ''));
    $domain = parse_url($url, PHP_URL_HOST);
    if (!is_string($domain) || $domain === '') {
        $domain = $url;
    }

    $favCount = isset($row['fav_count']) ? (int) $row['fav_count'] : 0;
    $isFavorited = !empty($row['is_favorited']);

    $submittedBy = isset($row['submitted_by']) && $row['submitted_by'] !== null
        ? (int) $row['submitted_by'] : null;

    return [
        'id'           => (int) $row['id'],
        'title'        => (string) ($row['title'] ?? 'Untitled resource'),
        'description'  => (string) ($row['description'] ?? ''),
        'category'     => $category,
        'type'         => $type,
        'url'          => $url,
        'domain'       => (string) $domain,
        'tags'         => $tags,
        'featured'     => !empty($row['featured']),
        'favCount'     => $favCount,
        'isFavorited'  => $isFavorited,
        'submittedBy'  => $submittedBy,
        // NULL submitter = admin-seeded staff pick (submitted_by is nullable
        // with ON DELETE SET NULL, so deleted users' seeds survive).
        'suggester'    => (string) ($row['username'] ?? ($submittedBy === null ? 'Aghimuan Staff' : 'Unknown student')),
        'status'       => (string) ($row['status'] ?? 'approved'),
        'createdAt'    => $row['created_at'] ?? null,
        'updatedAt'    => $row['updated_at'] ?? null,
    ];
}

/** Fetch one resource row with suggester identity, or null. */
function fetch_resource(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare(
        'SELECT r.*, u.username
         FROM resources r
         LEFT JOIN users u ON u.id = r.submitted_by
         WHERE r.id = :id'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}
