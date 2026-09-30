<?php
/**
 * creations-lib.php — shared Creations Hub helpers.
 *
 * Required by api/creations.php (JSON) and creations/creation.html
 * (server-rendered deep link) so both shape rows identically.
 */

declare(strict_types=1);

require_once __DIR__ . '/app-config.php';

// Canonical taxonomy — keep in sync with the filter buttons in
// creations/index.html and the <select> in creations/submit.html.
const CREATION_CATEGORIES = ['web', 'games', 'art', 'design', 'robotics', 'video', '3d', 'other'];
const CREATION_CATEGORY_LABELS = [
    'web'      => 'Web & Apps',
    'games'    => 'Games',
    'art'      => 'Digital Art',
    'design'   => 'Graphic Design',
    'robotics' => 'Robotics & Hardware',
    'video'    => 'Video & Animation',
    '3d'       => '3D & Motion',
    'other'    => 'Other',
];
const CREATION_PERIODS = ['week', 'month', 'year'];

const CREATION_MAX_TITLE_LENGTH = 100;
const CREATION_MAX_DESCRIPTION_LENGTH = 2000;
const CREATION_MAX_TOOLS = 20;
const CREATION_MAX_TOOL_LENGTH = 50;
const CREATION_MAX_MEDIA = 10;
const CREATION_MAX_LINK_LENGTH = 500;
const CREATION_MAX_LINKS = 5;
const CREATION_MAX_LINK_LABEL_LENGTH = 30;
const CREATION_MAX_COLLABORATORS = 10;

// Rich-text description support. The composer only ever needs inline
// formatting — no links/images/headings (those have their own submission
// sections) and no classes/ids (they could leak page styles or anchors).
const CREATION_RICH_TAGS = '<p><div><br><b><strong><i><em><u><s><strike><ul><ol><li><span>';
const CREATION_RICH_FONTS = ['Inter', 'Space Grotesk', 'JetBrains Mono', 'Georgia', 'serif', 'sans-serif', 'monospace'];
const CREATION_DESC_HTML_MAX = 10000; // raw markup cap; text cap stays 2000

// Avatar preset IDs — owned by includes/app-config.php (AGHI_PRESET_IDS).
// Kept as aliases so existing creations code keeps working.
if (!defined('CREATION_PFP_PRESET_IDS')) {
    define('CREATION_PFP_PRESET_IDS', AGHI_PRESET_IDS);
}

// Fill colors for preset avatars — owned by AGHI_PRESET_COLORS.
if (!defined('CREATION_PFP_COLORS')) {
    define('CREATION_PFP_COLORS', AGHI_PRESET_COLORS);
}

/**
 * Resolve a user's pfp_id to something renderable.
 * Returns ['pfpId', 'url' (null for presets), 'color' (null for uploads)].
 */
function creator_avatar(?string $pfpId): array {
    $pid = ($pfpId !== null && $pfpId !== '') ? $pfpId : 'default';
    if (!in_array($pid, CREATION_PFP_PRESET_IDS, true)) {
        return ['pfpId' => $pid, 'url' => '/uploads/pfp/' . basename($pid), 'color' => null];
    }
    return ['pfpId' => $pid, 'url' => null, 'color' => CREATION_PFP_COLORS[$pid]];
}

/**
 * Convert an rgb()/rgba() color to #hex. Browsers serialize
 * span.style.color = '#55F1F8' as 'rgb(85, 241, 248)' in innerHTML,
 * so the composer submits rgb() even though the palette is hex-only.
 * Returns null when the value is not a valid opaque-enough color.
 */
function rgb_to_hex(string $val): ?string {
    if (!preg_match('/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i', trim($val), $m)) {
        return null;
    }
    $r = (int) $m[1];
    $g = (int) $m[2];
    $b = (int) $m[3];
    if ($r > 255 || $g > 255 || $b > 255) {
        return null;
    }
    if (isset($m[4]) && $m[4] !== '' && (float) $m[4] < 0.99) {
        return null; // transparent text is unreadable — drop it
    }
    return sprintf('#%02x%02x%02x', $r, $g, $b);
}

/**
 * Keep only an allowlisted subset of inline style declarations.
 * color: #hex or rgb()/rgba() (browsers normalize hex to rgb in
 * innerHTML); font-size: 10-32px; font-family: allowlisted stacks.
 */
function scrub_rich_style(string $style): string {
    $out = [];
    foreach (explode(';', $style) as $decl) {
        $decl = trim($decl);
        if ($decl === '' || !str_contains($decl, ':')) {
            continue;
        }
        [$prop, $val] = array_map('trim', explode(':', $decl, 2));
        $prop = strtolower($prop);
        if ($prop === 'color') {
            if (preg_match('/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/', $val)) {
                $out[] = 'color: ' . $val;
            } elseif (($hex = rgb_to_hex($val)) !== null) {
                $out[] = 'color: ' . $hex;
            }
        } elseif ($prop === 'font-size' && preg_match('/^(\d+(?:\.\d+)?)px$/', $val, $m)
            && (float) $m[1] >= 10 && (float) $m[1] <= 32) {
            $out[] = 'font-size: ' . $m[1] . 'px';
        } elseif ($prop === 'font-family') {
            $fams = array_map(fn($f) => trim($f, " \t\n\r\"'"), explode(',', $val));
            $safe = array_values(array_intersect($fams, CREATION_RICH_FONTS));
            if (!empty($safe)) {
                $out[] = 'font-family: ' . implode(', ', $safe);
            }
        }
    }
    return implode('; ', $out);
}

/**
 * Sanitize composer HTML down to the inline-formatting subset above.
 * Same strip_tags + attribute-scrub approach as announcements
 * (sanitize_post_html), plus a strict style allowlist for <span>.
 */
function sanitize_rich_text(string $html): string {
    $html = strip_tags($html, CREATION_RICH_TAGS);
    // Non-span allowed tags carry no attributes at all.
    $html = preg_replace('/<(p|div|br|b|strong|i|em|u|s|strike|ul|ol|li)\b[^>]*>/i', '<$1>', $html);
    // Spans keep a scrubbed style attribute only.
    $html = preg_replace_callback('/<span\b([^>]*)>/i', function ($m) {
        $style = '';
        if (preg_match('/\sstyle\s*=\s*("([^"]*)"|\'([^\']*)\')/i', $m[1], $sm)) {
            $style = scrub_rich_style($sm[2] ?? $sm[3] ?? '');
        }
        return $style !== ''
            ? '<span style="' . htmlspecialchars($style, ENT_QUOTES, 'UTF-8') . '">'
            : '<span>';
    }, $html);
    // Belt and braces: no event handlers or javascript: URLs anywhere.
    $html = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);
    $html = preg_replace('/(href|src)\s*=\s*(["\'])\s*javascript:[^"\']*\2/i', '', $html);
    return trim($html);
}

/** Visible character count of rich HTML (tags/entities excluded). */
function rich_text_length(string $html): int {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    if (!is_string($text)) {
        $text = '';
    }
    // Contenteditable empties often serialize as whitespace/BOM only.
    $text = preg_replace('/^[\s\x{FEFF}\x{00A0}]+|[\s\x{FEFF}\x{00A0}]+$/u', '', $text);
    return (int) mb_strlen(is_string($text) ? $text : '');
}

/**
 * Current school year as 'YYYY-YYYY' with a June cutoff, e.g. Aug 2026 ->
 * '2026-2027'. Stored per-row at insert so the batch filter never shifts.
 */
function current_school_year(?int $now = null): string {
    $now ??= time();
    $month = (int) date('n', $now);
    $year = (int) date('Y', $now);
    if ($month >= 6) {
        return $year . '-' . ($year + 1);
    }
    return ($year - 1) . '-' . $year;
}

/** Shape a creations DB row into exactly what creations/index.html normItem() consumes. */
function normalize_creation(array $row): array {
    $tools = json_decode($row['tools_used'] ?? '[]', true);
    if (!is_array($tools)) {
        $tools = [];
    }
    $tools = array_values(array_filter(
        array_map(fn($t) => mb_substr(trim((string) $t), 0, CREATION_MAX_TOOL_LENGTH), $tools),
        fn($t) => $t !== ''
    ));

    $mediaUrls = json_decode($row['media_urls'] ?? '[]', true);
    if (!is_array($mediaUrls)) {
        $mediaUrls = [];
    }
    $media = [];
    foreach ($mediaUrls as $u) {
        if (is_array($u)) {
            $u = $u['src'] ?? $u['url'] ?? '';
        }
        $u = trim((string) $u);
        if ($u !== '') {
            $media[] = ['type' => 'image', 'src' => $u];
        }
    }

    // Demo video (if any) rides along as a video media entry so the existing
    // stage/lightbox/modal viewers pick it up with zero special-casing.
    $videoUrl = trim((string) ($row['video_url'] ?? ''));
    if ($videoUrl !== '') {
        $media[] = ['type' => 'video', 'url' => $videoUrl];
    }

    // Labeled project links: stored as JSON [{label, url}], normalized back
    // to clean pairs (anything malformed is dropped, never fatal).
    $links = [];
    $linksRaw = json_decode($row['links'] ?? '[]', true);
    if (is_array($linksRaw)) {
        foreach (array_slice($linksRaw, 0, CREATION_MAX_LINKS) as $l) {
            if (!is_array($l)) continue;
            $label = mb_substr(trim((string) ($l['label'] ?? '')), 0, CREATION_MAX_LINK_LABEL_LENGTH);
            $url = trim((string) ($l['url'] ?? ''));
            if ($label === '' || $url === '') continue;
            $links[] = ['label' => $label, 'url' => $url];
        }
    }

    // Collaborator user IDs; full profiles are attached afterwards via
    // attach_collaborators() (one batched query, no N+1).
    $collabIds = [];
    $collabRaw = json_decode($row['collaborators'] ?? '[]', true);
    if (is_array($collabRaw)) {
        foreach ($collabRaw as $cid) {
            $cid = (int) $cid;
            if ($cid > 0) $collabIds[] = $cid;
        }
        $collabIds = array_values(array_unique(array_slice($collabIds, 0, CREATION_MAX_COLLABORATORS)));
    }

    // Cover focal point: {x, y} percentages (0-100). Anything malformed
    // falls back to center (null = default).
    $coverFocus = null;
    $cfRaw = json_decode($row['cover_focus'] ?? 'null', true);
    if (is_array($cfRaw) && isset($cfRaw['x'], $cfRaw['y'])) {
        $cfx = (float) $cfRaw['x'];
        $cfy = (float) $cfRaw['y'];
        if ($cfx >= 0 && $cfx <= 100 && $cfy >= 0 && $cfy <= 100) {
            $coverFocus = ['x' => $cfx, 'y' => $cfy];
        }
    }

    $period = $row['featured_period'] ?? null;
    if (!in_array($period, CREATION_PERIODS, true)) {
        $period = null;
    }

    $award = trim((string) ($row['award'] ?? ''));
    if ($award === '' && $period !== null) {
        $award = 'Creation of the ' . ucfirst($period);
    }

    $category = $row['category'] ?? 'other';
    if (!in_array($category, CREATION_CATEGORIES, true)) {
        $category = 'other';
    }

    // Creator identity for avatar + profile-popup wiring. Queries alias the
    // joined user columns as creator_id / creator_pfp (see api/creations.php
    // and fetch_creation() below).
    $avatar = creator_avatar(isset($row['creator_pfp']) && is_string($row['creator_pfp']) ? $row['creator_pfp'] : null);

    return [
        'id'           => (int) $row['id'],
        'title'        => (string) ($row['title'] ?? 'Untitled entry'),
        'creator'      => (string) ($row['username'] ?? 'Unknown student'),
        'creatorId'    => isset($row['creator_id']) && $row['creator_id'] !== null ? (int) $row['creator_id'] : null,
        'creatorPfpId' => $avatar['pfpId'],
        'creatorAvatarUrl' => $avatar['url'],
        'creatorAvatarColor' => $avatar['color'],
        'category'     => $category,
        'tools'        => $tools,
        'description'  => (string) ($row['description'] ?? ''),
        'desc'         => (string) ($row['description'] ?? ''),
        'media'        => $media,
        'url'          => !empty($row['external_link']) ? (string) $row['external_link'] : null,
        'videoUrl'     => $videoUrl !== '' ? $videoUrl : null,
        'links'        => $links,
        'collaboratorIds' => $collabIds,
        'collaborators' => [], // filled by attach_collaborators() below
        'coverFocus' => $coverFocus,
        'batch'        => !empty($row['batch']) ? (string) $row['batch'] : null,
        'date'         => $row['created_at'] ?? null,
        'submitted_at' => $row['created_at'] ?? null,
        'award'        => $award !== '' ? $award : null,
        'period'       => $period,
        'status'       => (string) ($row['status'] ?? 'approved'),
    ];
}

/** Fetch one creation row with submitter identity, or null. */
function fetch_creation(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare(
        'SELECT c.*, u.username, u.id AS creator_id, u.pfp_id AS creator_pfp
         FROM creations c
         LEFT JOIN users u ON u.id = c.submitted_by
         WHERE c.id = :id'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Fill each normalized item's `collaborators` with [{id, username, pfpId,
 * avatarUrl, avatarColor}] via ONE batched query (no N+1). Items without
 * collaborator IDs are returned untouched.
 */
function attach_collaborators(PDO $pdo, array $items): array {
    $ids = [];
    foreach ($items as $it) {
        foreach ($it['collaboratorIds'] ?? [] as $cid) {
            $ids[(int) $cid] = true;
        }
    }
    if (empty($ids)) {
        return $items;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, username, pfp_id FROM users WHERE id IN ($placeholders) AND is_banned = 0"
    );
    $stmt->execute(array_keys($ids));

    $map = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $av = creator_avatar($u['pfp_id'] ?? null);
        $map[(int) $u['id']] = [
            'id' => (int) $u['id'],
            'username' => $u['username'],
            'pfpId' => $av['pfpId'],
            'avatarUrl' => $av['url'],
            'avatarColor' => $av['color'],
        ];
    }

    foreach ($items as &$it) {
        $list = [];
        foreach ($it['collaboratorIds'] ?? [] as $cid) {
            if (isset($map[(int) $cid])) {
                $list[] = $map[(int) $cid];
            }
        }
        $it['collaborators'] = $list;
    }
    unset($it);
    return $items;
}
