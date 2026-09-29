<?php
/**
 * admin-data.php — Data loading functions for the admin panel
 */

declare(strict_types=1);

require_once __DIR__ . '/admin-config.php';

function load_announcements(): array {
    $json_file = __DIR__ . '/../announcements.json';
    $existing_posts = file_exists($json_file) ? json_decode(file_get_contents($json_file), true) : [];
    if (!is_array($existing_posts)) $existing_posts = [];

    usort($existing_posts, function ($a, $b) {
        $a_pinned = !empty($a['pinned']);
        $b_pinned = !empty($b['pinned']);
        if ($a_pinned !== $b_pinned) {
            return $a_pinned ? -1 : 1;
        }
        if ($a_pinned) {
            return ($b['pinned_at'] ?? 0) <=> ($a['pinned_at'] ?? 0);
        }
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });

    return $existing_posts;
}

function load_events(): array {
    $events_file = __DIR__ . '/../events.json';
    $existing_events = file_exists($events_file) ? json_decode(file_get_contents($events_file), true) : [];
    if (!is_array($existing_events)) $existing_events = [];
    return $existing_events;
}

function load_custom_roles(PDO $pdo): array {
    $all_custom_roles = $pdo->query('SELECT * FROM custom_roles ORDER BY name COLLATE NOCASE')->fetchAll();
    $custom_roles_by_id = [];
    foreach ($all_custom_roles as $cr) {
        $custom_roles_by_id[(int) $cr['id']] = $cr;
    }
    return [
        'all' => $all_custom_roles,
        'by_id' => $custom_roles_by_id
    ];
}

function load_users(PDO $pdo): array {
    $all_users = $pdo->query(
        "SELECT u.id, u.username, u.main_role, u.sub_role, u.grade, u.strand, u.club,
                u.ip_address, u.created_at,
                GROUP_CONCAT(ucr.role_id) AS custom_role_ids
         FROM users u
         LEFT JOIN user_custom_roles ucr ON ucr.user_id = u.id
         GROUP BY u.id
         ORDER BY u.username COLLATE NOCASE"
    )->fetchAll();

    $all_users_by_id = [];
    foreach ($all_users as $u) {
        $all_users_by_id[(int) $u['id']] = $u;
    }

    return [
        'all' => $all_users,
        'by_id' => $all_users_by_id
    ];
}

function load_postable_users(PDO $pdo): array {
    // POSTABLE_ROLES single-sources the announce gate — FACULTY is
    // intentionally excluded (display-only identity, no posting power).
    // Values are internal constants, so inline quoting is safe.
    $quoted = implode(',', array_map(fn($r) => "'" . str_replace("'", "''", $r) . "'", POSTABLE_ROLES));
    $case = implode(' ', array_map(
        fn($i, $r) => "WHEN '" . str_replace("'", "''", $r) . "' THEN $i",
        array_keys(POSTABLE_ROLES),
        array_values(POSTABLE_ROLES)
    ));
    return $pdo->query(
        "SELECT id, username, main_role
         FROM users
         WHERE main_role IN ($quoted)
         ORDER BY
            CASE main_role
                $case
            END,
            username COLLATE NOCASE"
    )->fetchAll();
}

function load_comments_by_user(PDO $pdo): array {
    $comments_by_user = [];
    $all_comments_raw = $pdo->query(
        "SELECT id, post_id, user_id, parent_id, body, created_at, deleted_at
         FROM comments
         ORDER BY created_at DESC"
    )->fetchAll();
    foreach ($all_comments_raw as $c) {
        $comments_by_user[(int) $c['user_id']][] = $c;
    }
    return $comments_by_user;
}

function load_banned_ips(PDO $pdo): array {
    return $pdo->query('SELECT * FROM banned_ips ORDER BY created_at DESC')->fetchAll();
}

function load_creations(PDO $pdo): array {
    $rows = $pdo->query(
        'SELECT c.*, u.username
         FROM creations c
         LEFT JOIN users u ON u.id = c.submitted_by
         ORDER BY c.created_at DESC'
    )->fetchAll();

    $grouped = ['pending' => [], 'approved' => [], 'rejected' => [], 'featured' => []];
    foreach ($rows as $r) {
        $status = $r['status'] ?? 'pending';
        if (!isset($grouped[$status])) {
            $grouped[$status] = [];
        }
        $grouped[$status][] = $r;
        if ($status === 'approved' && !empty($r['featured_period'])) {
            $grouped['featured'][] = $r;
        }
    }

    // Resolve collaborator IDs to usernames in one batched query so the
    // review cards can credit the team without an N+1.
    $collabIds = [];
    foreach ($rows as $r) {
        $decoded = json_decode($r['collaborators'] ?? '[]', true);
        if (is_array($decoded)) {
            foreach ($decoded as $cid) {
                if ((int) $cid > 0) $collabIds[(int) $cid] = true;
            }
        }
    }
    $collabNames = [];
    if (!empty($collabIds)) {
        $placeholders = implode(',', array_fill(0, count($collabIds), '?'));
        $stmt = $pdo->prepare("SELECT id, username FROM users WHERE id IN ($placeholders)");
        $stmt->execute(array_keys($collabIds));
        foreach ($stmt->fetchAll() as $u) {
            $collabNames[(int) $u['id']] = $u['username'];
        }
    }
    foreach ($grouped as &$list) {
        foreach ($list as &$r) {
            $names = [];
            $decoded = json_decode($r['collaborators'] ?? '[]', true);
            if (is_array($decoded)) {
                foreach ($decoded as $cid) {
                    if (isset($collabNames[(int) $cid])) $names[] = $collabNames[(int) $cid];
                }
            }
            $r['collab_names'] = $names;
        }
        unset($r);
    }
    unset($list);

    return $grouped;
}

function load_admin_accounts(PDO $pdo): array {
    $admin_count = (int) $pdo->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn();
    
    $all_admins = [];
    $me = current_admin();
    if ($me && $me['is_main']) {
        $all_admins = $pdo->query('SELECT id, username, is_main, created_at FROM admin_accounts ORDER BY is_main DESC, username COLLATE NOCASE')->fetchAll();
    }
    
    return [
        'count' => $admin_count,
        'all' => $all_admins
    ];
}

function load_dashboard_data(PDO $pdo): array {
    $existing_posts = load_announcements();
    $existing_events = load_events();
    $custom_roles = load_custom_roles($pdo);
    $users = load_users($pdo);
    $postable_users = load_postable_users($pdo);
    $comments_by_user = load_comments_by_user($pdo);
    $banned_ips = load_banned_ips($pdo);
    $admin_accounts = load_admin_accounts($pdo);
    $creations = load_creations($pdo);

    $upcoming_events = array_values(array_filter($existing_events, fn($e) => ($e['date'] ?? '') >= date('Y-m-d')));
    $recent_posts = array_slice($existing_posts, 0, 5);
    $soonest_events = array_slice($upcoming_events, 0, 5);

    return [
        'posts' => $existing_posts,
        'events' => $existing_events,
        'upcoming_events' => $upcoming_events,
        'recent_posts' => $recent_posts,
        'soonest_events' => $soonest_events,
        'custom_roles' => $custom_roles,
        'users' => $users,
        'postable_users' => $postable_users,
        'comments_by_user' => $comments_by_user,
        'banned_ips' => $banned_ips,
        'admin_accounts' => $admin_accounts,
        'creations' => $creations
    ];
}
