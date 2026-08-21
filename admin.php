<?php
session_start();
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/includes/db.php';

const MAIN_ADMIN_USERNAME = 'rennyrenren';

const MAIN_ROLES = ['CLUB ADVISER', 'OFFICER', 'COMMITTEE MEMBER', 'MEMBER'];

const SUB_ROLES_BY_MAIN = [
    'CLUB ADVISER'     => ['Faculty'],
    'OFFICER'          => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO/PRO'],
    'COMMITTEE MEMBER' => ['Sgt. at Arms', 'Media Tech 1', 'Media Tech 2', 'Media Tech 3', 'Media Tech 4'],
];

const CLUBS = [
    'Non-academic' => [
        'Dagitab', 'EBDA', 'Hiraya', 'Lyrico', 'Marahuyo',
        'Padayon', 'Pahina', 'Paraluman', 'PFG'
    ],
    'Academic' => [
        'Sibol', 'RISE', 'Dalumat', 'Numero', 'Kalakbay',
        'Le Verrier', 'Nexus', 'Aghimuan', 'Skill Speak'
    ]
];

const GRADES = ['G12', 'G11', 'JHS'];
const STRANDS = ['STEM', 'ABM/BE', 'HUMSS/ASSH', 'HE/HT', 'ICT/ICT Professionals', 'SPORTS'];

function ensure_admin_accounts_table(PDO $pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )");

    $count = (int) $pdo->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('INSERT INTO admin_accounts (username, password_hash, is_main) VALUES (:u, :p, 1)');
        $stmt->execute([':u' => MAIN_ADMIN_USERNAME, ':p' => password_hash(MAIN_ADMIN_USERNAME, PASSWORD_DEFAULT)]);
    }
}

$pdo = get_db();
ensure_admin_accounts_table($pdo);

// CSRF protection: one token per session, embedded in every form, checked
// on every POST before any action runs.
function admin_csrf_token(): string {
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['admin_csrf'];
}

function admin_verify_csrf(): void {
    $token = $_POST['csrf_token'] ?? '';
    if (!hash_equals($_SESSION['admin_csrf'] ?? '', $token)) {
        http_response_code(403);
        die('Your session expired or this request could not be verified. Please go back, refresh the page, and try again.');
    }
}

$admin_csrf_token = admin_csrf_token();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();
}

// Login brute-force throttling, same 5-attempts/60-second-lockout pattern
// used by login.php for regular accounts.
$_SESSION['admin_login_attempts'] = $_SESSION['admin_login_attempts'] ?? 0;
$_SESSION['admin_login_locked_until'] = $_SESSION['admin_login_locked_until'] ?? 0;

function current_admin(): ?array {
    if (empty($_SESSION['admin_id'])) return null;
    static $cached = null;
    static $checked = false;
    if ($checked) return $cached;
    $checked = true;

    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT id, username, is_main FROM admin_accounts WHERE id = :id');
    $stmt->execute([':id' => (int) $_SESSION['admin_id']]);
    $row = $stmt->fetch();

    if (!$row) {
        session_destroy();
        $cached = null;
        return null;
    }

    $cached = ['id' => (int) $row['id'], 'username' => $row['username'], 'is_main' => (bool) $row['is_main']];
    return $cached;
}

function is_logged_in(): bool {
    return current_admin() !== null;
}

if (isset($_POST['action']) && $_POST['action'] === 'login') {
    if (time() < $_SESSION['admin_login_locked_until']) {
        $error = 'Too many failed attempts. Try again in a minute.';
    } else {
        $login_username = trim($_POST['username'] ?? '');
        $login_password = $_POST['password'] ?? '';

        $stmt = $pdo->prepare('SELECT * FROM admin_accounts WHERE username = :u');
        $stmt->execute([':u' => $login_username]);
        $acct = $stmt->fetch();

        if ($acct && password_verify($login_password, $acct['password_hash'])) {
            $_SESSION['admin_login_attempts'] = 0;
            // Regenerate the session ID on every successful login so a
            // pre-login session (or a fixated one) can't be reused
            // post-login; keep session data, drop the old session's ID.
            session_regenerate_id(true);
            $_SESSION['admin_id'] = (int) $acct['id'];
            // The old CSRF token belongs to the pre-login session — issue
            // a fresh one so the very next form submit doesn't get rejected.
            unset($_SESSION['admin_csrf']);
            $admin_csrf_token = admin_csrf_token();
        } else {
            $_SESSION['admin_login_attempts']++;
            if ($_SESSION['admin_login_attempts'] >= 5) {
                $_SESSION['admin_login_locked_until'] = time() + 60;
                $_SESSION['admin_login_attempts'] = 0;
            }
            $error = 'Invalid username or password.';
        }
    }
}

if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header('Location: admin.php');
    exit;
}

$upload_debug = [];

function sanitize_post_html($html) {
    $allowed = '<div><br><b><i><u><strong><em><font><span><ol><ul><li><p>';
    $html = strip_tags($html, $allowed);
    $html = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);
    $html = preg_replace('/(href|src)\s*=\s*(["\'])\s*javascript:[^"\']*\2/i', '', $html);
    return $html;
}

if (isset($_POST['action']) && $_POST['action'] === 'create' && is_logged_in()) {
    $text = sanitize_post_html(trim($_POST['content'] ?? ''));
    $images = [];

    // "Post as <user>" — restricted to CLUB ADVISER / OFFICER / COMMITTEE MEMBER,
    // re-checked server-side against the same eligibility rule used to build
    // the dropdown, so a tampered POST value can't smuggle in a MEMBER's id.
    $poster_user_id = null;
    $poster_username = null;
    $poster_pfp_id = null;
    $requested_poster_id = (int) ($_POST['post_as_user_id'] ?? 0);
    if ($requested_poster_id > 0) {
        $poster_check = $pdo->prepare(
            "SELECT id, username, pfp_id FROM users WHERE id = :id AND main_role IN ('CLUB ADVISER', 'OFFICER', 'COMMITTEE MEMBER')"
        );
        $poster_check->execute([':id' => $requested_poster_id]);
        $poster_row = $poster_check->fetch();
        if ($poster_row) {
            $poster_user_id = (int) $poster_row['id'];
            $poster_username = $poster_row['username'];
            $poster_pfp_id = $poster_row['pfp_id'];
        }
    }

    $uploads_dir = __DIR__ . '/uploads';
    if (!is_dir($uploads_dir)) {
        mkdir($uploads_dir, 0755, true);
    }

    if (!is_writable($uploads_dir)) {
        $upload_debug[] = "uploads/ directory is not writable (path: $uploads_dir). Fix folder permissions (chmod 755 or 775) or ownership on the server.";
    }

    if (empty($_FILES['images']) || empty($_FILES['images']['name'][0])) {
        $post_max = ini_get('post_max_size');
        $upload_max = ini_get('upload_max_filesize');
        $upload_debug[] = "No files arrived in \$_FILES at all. This usually means the total upload size exceeded post_max_size (currently: $post_max) or the server's request size limit, even if each individual photo was under upload_max_filesize (currently: $upload_max). If you selected several photos at once, try posting fewer at a time, or raise post_max_size / upload_max_filesize in php.ini.";
    }

    $php_upload_errors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds upload_max_filesize in php.ini',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds MAX_FILE_SIZE specified in the form',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder on the server',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload',
    ];

    if (isset($_FILES['images']) && is_array($_FILES['images']['name'])) {
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $file_count = count($_FILES['images']['name']);

        for ($i = 0; $i < $file_count; $i++) {
            $orig_name = $_FILES['images']['name'][$i];
            $err_code = $_FILES['images']['error'][$i];

            if ($err_code !== UPLOAD_ERR_OK) {
                $reason = $php_upload_errors[$err_code] ?? "Unknown upload error (code $err_code)";
                $upload_debug[] = "\"$orig_name\" failed: $reason";
                continue;
            }

            $tmp = $_FILES['images']['tmp_name'][$i];
            $ext = strtolower(pathinfo($orig_name, PATHINFO_EXTENSION));

            if (!in_array($ext, $allowed)) {
                $upload_debug[] = "\"$orig_name\" skipped: file extension \".$ext\" is not in the allowed list (jpg, jpeg, png, gif, webp).";
                continue;
            }

            $filename = 'announcement_' . time() . '_' . $i . '_' . rand(100, 999) . '.' . $ext;
            $destination = $uploads_dir . '/' . $filename;

            if (move_uploaded_file($tmp, $destination)) {
                $images[] = 'uploads/' . $filename;
            } else {
                $upload_debug[] = "\"$orig_name\" failed: move_uploaded_file() could not write to $destination. Check that uploads/ is writable by the web server user.";
            }
        }
    }

    if ($text !== '' || !empty($images)) {
        $json_file = __DIR__ . '/announcements.json';
        $data = file_exists($json_file) ? json_decode(file_get_contents($json_file), true) : [];
        if (!is_array($data)) $data = [];

        $new_post = [
            'id' => time(),
            'timestamp' => time(),
            'date_formatted' => date('F j, Y, g:i a'),
            'text' => $text,
            'images' => $images,
            'poster_user_id' => $poster_user_id,
            'poster_username' => $poster_username,
            'poster_pfp_id' => $poster_pfp_id
        ];

        array_unshift($data, $new_post);
        file_put_contents($json_file, json_encode($data, JSON_PRETTY_PRINT));
        $success = 'Announcement posted successfully.';
        if (!empty($upload_debug)) {
            $success .= ' (but see upload warnings below — ' . count($images) . ' of ' . (isset($file_count) ? $file_count : 0) . ' photos actually saved)';
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'delete' && is_logged_in()) {
    $delete_id = intval($_POST['post_id'] ?? 0);
    $json_file = __DIR__ . '/announcements.json';
    $data = file_exists($json_file) ? json_decode(file_get_contents($json_file), true) : [];

    if (is_array($data)) {
        $updated_data = [];
        foreach ($data as $post) {
            if ($post['id'] == $delete_id) {
                $imgs_to_delete = [];
                if (!empty($post['images']) && is_array($post['images'])) {
                    $imgs_to_delete = $post['images'];
                } elseif (!empty($post['image'])) {
                    $imgs_to_delete = [$post['image']];
                }

                foreach ($imgs_to_delete as $img_path) {
                    $full_path = __DIR__ . '/' . $img_path;
                    if (file_exists($full_path)) {
                        unlink($full_path);
                    }
                }
            } else {
                $updated_data[] = $post;
            }
        }
        file_put_contents($json_file, json_encode($updated_data, JSON_PRETTY_PRINT));

        $pdo = get_db();
        $stmt = $pdo->prepare('DELETE FROM comments WHERE post_id = :post_id');
        $stmt->execute([':post_id' => $delete_id]);

        $success = 'Announcement deleted.';
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'toggle_pin' && is_logged_in()) {
    $pin_id = intval($_POST['post_id'] ?? 0);
    $json_file = __DIR__ . '/announcements.json';
    $data = file_exists($json_file) ? json_decode(file_get_contents($json_file), true) : [];

    if (is_array($data)) {
        $found = false;
        foreach ($data as &$post) {
            if ($post['id'] == $pin_id) {
                $post['pinned'] = empty($post['pinned']);
                $post['pinned_at'] = $post['pinned'] ? time() : null;
                $found = true;
                break;
            }
        }
        unset($post);

        if ($found) {
            file_put_contents($json_file, json_encode($data, JSON_PRETTY_PRINT));
            $success = 'Announcement pin updated.';
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'create_event' && is_logged_in()) {
    $ev_title = trim($_POST['event_title'] ?? '');
    $ev_date = trim($_POST['event_date'] ?? '');
    $ev_time = trim($_POST['event_time'] ?? '');
    $ev_location = trim($_POST['event_location'] ?? '');

    if ($ev_title === '' || $ev_date === '') {
        $event_error = 'Event title and date are required.';
    } else {
        $events_file = __DIR__ . '/events.json';
        $events_data = file_exists($events_file) ? json_decode(file_get_contents($events_file), true) : [];
        if (!is_array($events_data)) $events_data = [];

        $new_event = [
            'id' => time() . rand(100, 999),
            'title' => $ev_title,
            'date' => $ev_date,
            'time' => $ev_time,
            'location' => $ev_location
        ];

        $events_data[] = $new_event;
        usort($events_data, fn($a, $b) => strcmp($a['date'], $b['date']));
        file_put_contents($events_file, json_encode($events_data, JSON_PRETTY_PRINT));
        $event_success = 'Event added successfully.';
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'delete_event' && is_logged_in()) {
    $delete_event_id = $_POST['event_id'] ?? '';
    $events_file = __DIR__ . '/events.json';
    $events_data = file_exists($events_file) ? json_decode(file_get_contents($events_file), true) : [];

    if (is_array($events_data)) {
        $events_data = array_values(array_filter($events_data, fn($e) => (string)($e['id'] ?? '') !== (string)$delete_event_id));
        file_put_contents($events_file, json_encode($events_data, JSON_PRETTY_PRINT));
        $event_success = 'Event deleted.';
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'create_custom_role' && is_logged_in()) {
    $pdo = get_db();
    $role_name = trim($_POST['role_name'] ?? '');
    $color1    = trim($_POST['role_color1'] ?? '#3096C7');
    $color2    = trim($_POST['role_color2'] ?? '');
    $isGradient = isset($_POST['role_is_gradient']) && $color2 !== '';
    $textColor = ($_POST['role_text_color'] ?? 'white') === 'black' ? '#111111' : '#ffffff';

    if ($role_name === '') {
        $role_error = 'Role name is required.';
    } elseif (!preg_match('/^#[0-9a-fA-F]{6}$/', $color1) || ($isGradient && !preg_match('/^#[0-9a-fA-F]{6}$/', $color2))) {
        $role_error = 'Invalid color value.';
    } else {
        $colorCss = $isGradient ? "linear-gradient(90deg, {$color1}, {$color2})" : $color1;
        try {
            $stmt = $pdo->prepare('INSERT INTO custom_roles (name, color_css, text_color) VALUES (:n, :c, :t)');
            $stmt->execute([':n' => $role_name, ':c' => $colorCss, ':t' => $textColor]);
            $role_success = 'Custom role "' . $role_name . '" created.';
        } catch (PDOException $e) {
            $role_error = 'A role with that name already exists.';
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'delete_custom_role' && is_logged_in()) {
    $pdo = get_db();
    $roleId = (int) ($_POST['role_id'] ?? 0);
    if ($roleId > 0) {
        $stmt = $pdo->prepare('DELETE FROM custom_roles WHERE id = :id');
        $stmt->execute([':id' => $roleId]);
        $role_success = 'Custom role deleted.';
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'update_user_role' && is_logged_in()) {
    $pdo = get_db();
    $userId   = (int) ($_POST['user_id'] ?? 0);
    $mainRole = $_POST['main_role'] ?? 'MEMBER';

    if ($userId <= 0) {
        $user_role_error = 'No user selected.';
    } elseif (!in_array($mainRole, MAIN_ROLES, true)) {
        $user_role_error = 'Invalid main role.';
    } else {
        $subRole = null;
        $grade   = null;
        $strand  = null;
        $club    = null;

        if ($mainRole !== 'MEMBER') {
            $validSubRoles = SUB_ROLES_BY_MAIN[$mainRole] ?? [];
            $requestedSub  = $_POST['sub_role'] ?? '';
            $subRole = in_array($requestedSub, $validSubRoles, true) ? $requestedSub : ($validSubRoles[0] ?? null);
        }

        if ($mainRole !== 'CLUB ADVISER') {
            $grade  = $_POST['grade'] ?? '';
            $strand = $_POST['strand'] ?? '';
            $club   = trim($_POST['club'] ?? '');
            if (!in_array($grade, GRADES, true)) $grade = null;
            if (!in_array($strand, STRANDS, true)) $strand = null;
            $allClubs = array_merge(CLUBS['Non-academic'], CLUBS['Academic']);
            if ($club === '' || !in_array($club, $allClubs, true)) $club = null;
        }

        $stmt = $pdo->prepare(
            'UPDATE users SET main_role = :mr, sub_role = :sr, grade = :g, strand = :s, club = :c, updated_at = datetime(\'now\') WHERE id = :id'
        );
        $stmt->execute([
            ':mr' => $mainRole, ':sr' => $subRole, ':g' => $grade, ':s' => $strand, ':c' => $club, ':id' => $userId,
        ]);

        $pdo->prepare('DELETE FROM user_custom_roles WHERE user_id = :id')->execute([':id' => $userId]);
        $customIds = $_POST['custom_role_ids'] ?? [];
        if (is_array($customIds) && !empty($customIds)) {
            $insertRole = $pdo->prepare('INSERT INTO user_custom_roles (user_id, role_id) VALUES (:u, :r)');
            foreach ($customIds as $rid) {
                $rid = (int) $rid;
                if ($rid > 0) {
                    $insertRole->execute([':u' => $userId, ':r' => $rid]);
                }
            }
        }

        $user_role_success = 'Role updated.';
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'delete_user' && is_logged_in()) {
    $pdo = get_db();
    $targetId = (int) ($_POST['user_id'] ?? 0);

    $stmt = $pdo->prepare('SELECT id, username, ip_address FROM users WHERE id = :id');
    $stmt->execute([':id' => $targetId]);
    $target = $stmt->fetch();

    if (!$target) {
        $user_mgmt_error = 'That account no longer exists.';
    } else {
        // Comments/DMs cascade-delete via the FK on users(id), but reactions
        // reference target_type/target_id generically (not a real FK to
        // comments/direct_messages), so rows left behind on THIS user's own
        // content need to be cleaned up separately. Reactions this user left
        // on other people's content are handled by the FK cascade on
        // reactions.user_id.
        $commentIdsStmt = $pdo->prepare('SELECT id FROM comments WHERE user_id = :id');
        $commentIdsStmt->execute([':id' => $targetId]);
        $commentIds = $commentIdsStmt->fetchAll(PDO::FETCH_COLUMN);

        $dmIdsStmt = $pdo->prepare('SELECT id FROM direct_messages WHERE sender_id = :id OR recipient_id = :id');
        $dmIdsStmt->execute([':id' => $targetId]);
        $dmIds = $dmIdsStmt->fetchAll(PDO::FETCH_COLUMN);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $targetId]);

            if (!empty($commentIds)) {
                $placeholders = implode(',', array_fill(0, count($commentIds), '?'));
                $pdo->prepare("DELETE FROM reactions WHERE target_type = 'comment' AND target_id IN ($placeholders)")
                    ->execute($commentIds);
            }
            if (!empty($dmIds)) {
                $placeholders = implode(',', array_fill(0, count($dmIds), '?'));
                $pdo->prepare("DELETE FROM reactions WHERE target_type = 'dm_message' AND target_id IN ($placeholders)")
                    ->execute($dmIds);
            }

            $pdo->commit();
            $user_mgmt_success = 'Account "' . $target['username'] . '" deleted.';
            $deleted_user_ip = $target['ip_address'];
            $deleted_user_username = $target['username'];
        } catch (PDOException $e) {
            $pdo->rollBack();
            $user_mgmt_error = 'Failed to delete account: ' . $e->getMessage();
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'ban_ip' && is_logged_in()) {
    $pdo = get_db();
    $me_check = current_admin();
    $banIp = trim($_POST['ip_address'] ?? '');
    $banReason = trim($_POST['ban_reason'] ?? '');

    if ($banIp === '' || $banIp === 'Unknown') {
        $user_mgmt_error = 'No IP address on file for that account — nothing to ban.';
    } else {
        try {
            $stmt = $pdo->prepare('INSERT INTO banned_ips (ip_address, reason, banned_by) VALUES (:ip, :r, :b)');
            $stmt->execute([
                ':ip' => $banIp,
                ':r'  => $banReason !== '' ? $banReason : null,
                ':b'  => $me_check['username'] ?? null,
            ]);
            $user_mgmt_success = 'IP address ' . htmlspecialchars($banIp) . ' banned from signing up.';
        } catch (PDOException $e) {
            $user_mgmt_error = 'That IP is already banned.';
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'unban_ip' && is_logged_in()) {
    $pdo = get_db();
    $banId = (int) ($_POST['ban_id'] ?? 0);
    $pdo->prepare('DELETE FROM banned_ips WHERE id = :id')->execute([':id' => $banId]);
    $user_mgmt_success = 'IP address unbanned.';
}

if (isset($_POST['action']) && $_POST['action'] === 'create_admin' && is_logged_in()) {
    $me_check = current_admin();
    if (!$me_check['is_main']) {
        $admin_mgmt_error = 'Only the main account can add admin accounts.';
    } else {
        $pdo = get_db();
        $newUser = trim($_POST['new_admin_username'] ?? '');
        $newPass = $_POST['new_admin_password'] ?? '';

        if ($newUser === '' || $newPass === '') {
            $admin_mgmt_error = 'Username and password are required.';
        } elseif (strlen($newPass) < 6) {
            $admin_mgmt_error = 'Password must be at least 6 characters.';
        } else {
            try {
                $stmt = $pdo->prepare('INSERT INTO admin_accounts (username, password_hash, is_main) VALUES (:u, :p, 0)');
                $stmt->execute([':u' => $newUser, ':p' => password_hash($newPass, PASSWORD_DEFAULT)]);
                $admin_mgmt_success = 'Admin account "' . htmlspecialchars($newUser) . '" created.';
            } catch (PDOException $e) {
                $admin_mgmt_error = 'That username is already taken.';
            }
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'delete_admin' && is_logged_in()) {
    $me_check = current_admin();
    if (!$me_check['is_main']) {
        $admin_mgmt_error = 'Only the main account can remove admin accounts.';
    } else {
        $pdo = get_db();
        $delId = (int) ($_POST['admin_id'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM admin_accounts WHERE id = :id');
        $stmt->execute([':id' => $delId]);
        $target = $stmt->fetch();

        if (!$target) {
            $admin_mgmt_error = 'Admin account not found.';
        } elseif ((int) $target['is_main'] === 1) {
            $admin_mgmt_error = 'The main account cannot be removed.';
        } else {
            $pdo->prepare('DELETE FROM admin_accounts WHERE id = :id')->execute([':id' => $delId]);
            $admin_mgmt_success = 'Admin account removed.';
        }
    }
}

if (isset($_POST['action']) && $_POST['action'] === 'change_password' && is_logged_in()) {
    $me_check = current_admin();
    $pdo = get_db();
    $current = $_POST['current_password'] ?? '';
    $new = $_POST['new_password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    $stmt = $pdo->prepare('SELECT password_hash FROM admin_accounts WHERE id = :id');
    $stmt->execute([':id' => $me_check['id']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($current, $row['password_hash'])) {
        $account_error = 'Current password is incorrect.';
    } elseif (strlen($new) < 6) {
        $account_error = 'New password must be at least 6 characters.';
    } elseif ($new !== $confirm) {
        $account_error = 'New passwords do not match.';
    } else {
        $pdo->prepare('UPDATE admin_accounts SET password_hash = :p WHERE id = :id')
            ->execute([':p' => password_hash($new, PASSWORD_DEFAULT), ':id' => $me_check['id']]);
        $account_success = 'Password updated.';
    }
}

$me = current_admin();

$json_file = __DIR__ . '/announcements.json';
$existing_posts = file_exists($json_file) ? json_decode(file_get_contents($json_file), true) : [];
if (!is_array($existing_posts)) $existing_posts = [];

// Pinned posts float to the top (most recently pinned first), everything
// else keeps the normal newest-first order below them.
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

$events_file = __DIR__ . '/events.json';
$existing_events = file_exists($events_file) ? json_decode(file_get_contents($events_file), true) : [];
if (!is_array($existing_events)) $existing_events = [];

$pdo = get_db();

$all_custom_roles = $pdo->query('SELECT * FROM custom_roles ORDER BY name COLLATE NOCASE')->fetchAll();
$custom_roles_by_id = [];
foreach ($all_custom_roles as $cr) {
    $custom_roles_by_id[(int) $cr['id']] = $cr;
}

$all_users = $pdo->query(
    "SELECT u.id, u.username, u.main_role, u.sub_role, u.grade, u.strand, u.club,
            u.ip_address, u.created_at,
            GROUP_CONCAT(ucr.role_id) AS custom_role_ids
     FROM users u
     LEFT JOIN user_custom_roles ucr ON ucr.user_id = u.id
     GROUP BY u.id
     ORDER BY u.username COLLATE NOCASE"
)->fetchAll();

// Eligible "Post as" list for the Create Announcement form — main roles only,
// same restriction re-checked server-side in the 'create' handler above.
$postable_users = $pdo->query(
    "SELECT id, username, main_role
     FROM users
     WHERE main_role IN ('CLUB ADVISER', 'OFFICER', 'COMMITTEE MEMBER')
     ORDER BY
        CASE main_role
            WHEN 'CLUB ADVISER' THEN 0
            WHEN 'OFFICER' THEN 1
            WHEN 'COMMITTEE MEMBER' THEN 2
        END,
        username COLLATE NOCASE"
)->fetchAll();

// Lookup used to render "Posted as: X" against existing posts below. Built
// from $all_users (not $postable_users) so a post still displays its
// original poster's name correctly even if that user's role later changed
// and they'd no longer show up in the eligibility list.
$all_users_by_id = [];
foreach ($all_users as $u) {
    $all_users_by_id[(int) $u['id']] = $u;
}

// Grouped by user for the User Management tab — small school-club-sized
// dataset, so loading every comment up front (same fully-server-rendered
// approach the rest of this file already uses) is simpler than adding AJAX.
$comments_by_user = [];
$all_comments_raw = $pdo->query(
    "SELECT id, post_id, user_id, parent_id, body, created_at, deleted_at
     FROM comments
     ORDER BY created_at DESC"
)->fetchAll();
foreach ($all_comments_raw as $c) {
    $comments_by_user[(int) $c['user_id']][] = $c;
}

$all_banned_ips = $pdo->query('SELECT * FROM banned_ips ORDER BY created_at DESC')->fetchAll();

$admin_count = (int) $pdo->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn();

$all_admins = [];
if ($me && $me['is_main']) {
    $all_admins = $pdo->query('SELECT id, username, is_main, created_at FROM admin_accounts ORDER BY is_main DESC, username COLLATE NOCASE')->fetchAll();
}

$upcoming_events = array_values(array_filter($existing_events, fn($e) => ($e['date'] ?? '') >= date('Y-m-d')));
$recent_posts = array_slice($existing_posts, 0, 5);
$soonest_events = array_slice($upcoming_events, 0, 5);

$default_tab = 'overview';
if (isset($_POST['action']) && in_array($_POST['action'], ['create', 'delete'])) {
    $default_tab = 'announcements';
}
if (isset($_POST['action']) && in_array($_POST['action'], ['create_event', 'delete_event'])) {
    $default_tab = 'events';
}
if (isset($_POST['action']) && in_array($_POST['action'], ['create_custom_role', 'delete_custom_role', 'update_user_role'])) {
    $default_tab = 'users';
}
if (isset($_POST['action']) && in_array($_POST['action'], ['delete_user', 'ban_ip', 'unban_ip'])) {
    $default_tab = 'moderation';
}
if (isset($_POST['action']) && in_array($_POST['action'], ['create_admin', 'delete_admin'])) {
    $default_tab = 'accounts';
}
if (isset($_POST['action']) && $_POST['action'] === 'change_password') {
    $default_tab = 'account';
}

function admin_icon(string $name): string {
    $icons = [
        'overview'  => '<path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>',
        'announce'  => '<path d="M3 11v2a1 1 0 0 0 1 1h1l3.5 5.5 1.5-.7L7.7 14H11l7 4V6l-7 4H3a1 1 0 0 0 0 2z"/>',
        'events'    => '<g fill="none" stroke-width="1.7"><path d="M7 2v3M17 2v3M3.5 9h17"/><rect x="4" y="5" width="16" height="15" rx="1"/></g>',
        'users'     => '<g><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" fill="none" stroke-width="1.7"/><circle cx="17.5" cy="9" r="2.4" fill="none" stroke-width="1.5"/><path d="M15.3 13.4c2.7.3 4.7 2.5 4.7 5.4" fill="none" stroke-width="1.5"/></g>',
        'accounts'  => '<g fill="none" stroke-width="1.6"><path d="M12 2l7 3.2v5.4c0 4.8-3 8.9-7 10.4-4-1.5-7-5.6-7-10.4V5.2L12 2z"/><path d="M8.7 12l2.3 2.3 4.3-4.6"/></g>',
        'moderation'=> '<g fill="none" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M5.8 5.8l12.4 12.4"/></g>',
        'account'   => '<g fill="none" stroke-width="1.7"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.3-7 7.5-7s7.5 2.9 7.5 7"/></g>',
        'logout'    => '<g fill="none" stroke-width="1.7"><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M13 8l4.5 4-4.5 4M9.3 12h8"/></g>',
        'menu'      => '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke-width="1.8" fill="none"/>',
        'close'     => '<path d="M5 5l14 14M19 5L5 19" stroke-width="1.8" fill="none"/>',
    ];
    $body = $icons[$name] ?? '';
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" class="icon icon-' . htmlspecialchars($name) . '">' . $body . '</svg>';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Aghimuan Control Panel</title>
    <style>
        :root {
            --bg: #0c0e14;
            --bg-soft: #10131c;
            --panel: #161a26;
            --panel-alt: #1b2030;
            --border: #26304a;
            --border-soft: #1e2536;
            --accent: #3096C7;
            --accent2: #55F1F8;
            --text: #F1F2F5;
            --muted: #8891a8;
            --danger: #ff5c6a;
            --danger-bg: #3a1a1e;
            --success: #4dffa0;
            --success-bg: #123321;
            --warning: #ffce6b;
            --warning-bg: #3a2f14;
            --radius: 12px;
            --sidebar-w: 264px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-text-size-adjust: 100%; }
        body {
            background: radial-gradient(circle at 15% 0%, #131a2c 0%, var(--bg) 45%) fixed;
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.5;
            min-height: 100vh;
        }
        a { color: inherit; }
        .icon { width: 18px; height: 18px; flex-shrink: 0; }
        .icon path, .icon circle, .icon rect { vector-effect: non-scaling-stroke; }

        /* ---------- Login screen ---------- */
        .login-shell {
            min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .login-box {
            width: 100%; max-width: 380px; background: linear-gradient(180deg, var(--panel), var(--panel-alt));
            padding: clamp(24px, 5vw, 34px); border-radius: var(--radius); border: 1px solid var(--border);
            box-shadow: 0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(85,241,248,0.04);
            position: relative; overflow: hidden;
        }
        .login-box::before {
            content: ""; position: absolute; top: -60px; right: -60px; width: 180px; height: 180px;
            background: radial-gradient(circle, rgba(85,241,248,0.18), transparent 70%); pointer-events: none;
        }
        .login-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
        .login-brand .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent2); box-shadow: 0 0 10px var(--accent2); }
        .login-brand h2 { color: var(--accent2); font-size: 1.2rem; letter-spacing: 0.3px; }
        .login-sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 22px; }
        .login-box input {
            width: 100%; padding: 12px 14px; background: #05060c; color: #fff; border: 1px solid var(--border);
            border-radius: 8px; margin-bottom: 12px; font-size: 0.95rem; transition: border-color .15s ease;
        }
        .login-box input:focus { outline: none; border-color: var(--accent); }

        /* ---------- Shared bits ---------- */
        .msg { padding: 11px 14px; margin-bottom: 16px; border-radius: 8px; font-size: 0.88rem; border: 1px solid; }
        .error { background: var(--danger-bg); color: #ff9ba3; border-color: #6b2530; }
        .success { background: var(--success-bg); color: #8affc1; border-color: #1f6b3f; }
        .warning { background: var(--warning-bg); color: var(--warning); border-color: #6b571f; }
        .warning ul { margin: 8px 0 0 18px; }
        .warning li { margin-bottom: 4px; font-family: monospace; font-size: 0.82rem; }

        .btn-submit {
            background: linear-gradient(135deg, var(--accent), #2478a3); color: #fff; border: none; padding: 12px;
            width: 100%; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; margin-top: 6px;
            transition: filter .15s ease, transform .1s ease;
        }
        .btn-submit:hover { filter: brightness(1.12); }
        .btn-submit:active { transform: scale(0.99); }
        .btn-ghost {
            background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 11px;
            width: 100%; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer; margin-top: 8px;
        }
        .btn-ghost:hover { color: var(--text); border-color: var(--accent); }
        .delete-btn {
            background: rgba(255,92,106,0.12); color: var(--danger); border: 1px solid rgba(255,92,106,0.35);
            padding: 6px 13px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;
        }
        .delete-btn:hover { background: rgba(255,92,106,0.22); }

        .field-label { display: block; color: var(--muted); font-size: 0.78rem; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
        .field-input {
            width: 100%; padding: 11px 13px; background: #05060c; color: #fff; border: 1px solid var(--border);
            border-radius: 8px; margin-bottom: 14px; font-size: 0.9rem;
        }
        .field-input:focus { outline: none; border-color: var(--accent); }
        .field-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .field-row > div { flex: 1; min-width: 140px; }

        .card {
            background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
            padding: clamp(16px, 3vw, 22px); margin-bottom: 22px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }
        .card h3 { margin-bottom: 14px; color: var(--accent2); font-size: 1rem; display: flex; align-items: center; gap: 8px; }

        /* ---------- App shell ---------- */
        .app-shell { display: flex; min-height: 100vh; }

        .sidebar {
            width: var(--sidebar-w); flex-shrink: 0; background: linear-gradient(180deg, #10131e, #0b0d15);
            border-right: 1px solid var(--border-soft); position: fixed; top: 0; left: 0; height: 100vh;
            display: flex; flex-direction: column; z-index: 110; transition: transform .28s cubic-bezier(.4,0,.2,1);
        }
        .sidebar-header { padding: 20px 18px 16px; border-bottom: 1px solid var(--border-soft); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .sidebar-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .sidebar-brand .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent2); box-shadow: 0 0 8px var(--accent2); flex-shrink: 0; }
        .sidebar-brand-text { min-width: 0; }
        .sidebar-brand-text strong { display: block; color: var(--accent2); font-size: 0.95rem; letter-spacing: 0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-brand-text span { display: block; color: var(--muted); font-size: 0.68rem; }
        .sidebar-close { display: none; background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; }

        .sidebar-nav { flex: 1; overflow-y: auto; padding: 14px 10px; display: flex; flex-direction: column; gap: 3px; }
        .nav-item {
            display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer;
            color: var(--muted); font-size: 0.88rem; font-weight: 600; border: 1px solid transparent; background: none; width: 100%; text-align: left;
            transition: background .15s ease, color .15s ease;
        }
        .nav-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
        .nav-item.active { background: rgba(48,150,199,0.14); color: var(--accent2); border-color: rgba(85,241,248,0.25); }
        .nav-item .icon { opacity: 0.85; }
        .nav-item .count {
            margin-left: auto; background: var(--border-soft); color: var(--muted); font-size: 0.68rem; font-weight: 700;
            padding: 2px 7px; border-radius: 10px;
        }
        .nav-item.active .count { background: var(--accent); color: #fff; }
        .nav-divider { height: 1px; background: var(--border-soft); margin: 10px 6px; }
        .nav-section-label { color: #565f78; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 12px 4px; }

        .sidebar-footer { padding: 14px; border-top: 1px solid var(--border-soft); }
        .sidebar-user { display: flex; align-items: center; gap: 10px; padding: 8px 8px 12px; }
        .sidebar-user-avatar {
            width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2));
            display: flex; align-items: center; justify-content: center; font-weight: 700; color: #05060c; font-size: 0.9rem; flex-shrink: 0;
        }
        .sidebar-user-name { min-width: 0; }
        .sidebar-user-name strong { display: block; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-user-name span { display: block; font-size: 0.68rem; color: var(--muted); }
        .logout-link {
            display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: var(--muted);
            font-size: 0.85rem; font-weight: 600; text-decoration: none; border: 1px solid var(--border-soft);
        }
        .logout-link:hover { color: var(--danger); border-color: rgba(255,92,106,0.3); background: rgba(255,92,106,0.06); }

        .sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: none; backdrop-filter: blur(1px); }

        .main { margin-left: var(--sidebar-w); flex: 1; min-width: 0; padding: 20px clamp(14px, 3vw, 34px) 60px; }
        .topbar { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
        .hamburger {
            display: none; background: var(--panel); border: 1px solid var(--border); color: var(--text);
            width: 40px; height: 40px; border-radius: 8px; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        }
        .page-title { font-size: 1.25rem; font-weight: 700; letter-spacing: 0.2px; }
        .page-sub { color: var(--muted); font-size: 0.82rem; margin-top: 2px; }

        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        /* ---------- Overview ---------- */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .stat-card {
            background: linear-gradient(160deg, var(--panel), var(--panel-alt)); border: 1px solid var(--border);
            border-radius: var(--radius); padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
        }
        .stat-card .stat-icon {
            width: 34px; height: 34px; border-radius: 9px; background: rgba(85,241,248,0.1); color: var(--accent2);
            display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
        }
        .stat-card .stat-value { font-size: 1.7rem; font-weight: 800; color: var(--text); }
        .stat-card .stat-label { color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }

        .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
        .mini-list { display: flex; flex-direction: column; gap: 10px; }
        .mini-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--bg-soft); border: 1px solid var(--border-soft); border-radius: 8px; }
        .mini-item-title { font-size: 0.85rem; font-weight: 600; }
        .mini-item-meta { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
        .empty-hint { color: var(--muted); font-size: 0.85rem; padding: 6px 0; }

        /* ---------- Editor / announcements ---------- */
        .toolbar { display: flex; gap: 6px; background: #05060c; padding: 8px; border: 1px solid var(--border); border-bottom: none; border-radius: 8px 8px 0 0; flex-wrap: wrap; align-items: center; }
        .tool-btn { background: var(--panel-alt); color: var(--accent2); border: 1px solid var(--accent); padding: 5px 11px; border-radius: 5px; cursor: pointer; font-size: 0.82rem; font-weight: 700; }
        .tool-btn:hover { background: var(--accent); color: #fff; }
        .tool-select { background: var(--panel-alt); color: var(--accent2); border: 1px solid var(--accent); padding: 5px 8px; border-radius: 5px; font-size: 0.82rem; outline: none; max-width: 130px; }

        .editor-box { min-height: 120px; max-height: 300px; overflow-y: auto; background: #05060c; color: #fff; padding: 12px; border: 1px solid var(--border); border-radius: 0 0 8px 8px; outline: none; font-size: 0.95rem; line-height: 1.5; }
        .editor-box:empty:before { content: "What's on your mind?"; color: #565f78; }

        .dropzone { border: 2px dashed var(--accent); background: var(--bg-soft); border-radius: 8px; padding: 20px; text-align: center; margin-top: 16px; cursor: pointer; transition: background 0.2s ease; }
        .dropzone:hover { background: #12172a; }
        .dropzone p { color: var(--muted); font-size: 0.9rem; }
        .dropzone span { color: var(--accent2); font-weight: bold; text-decoration: underline; }
        #fileInput { display: none; }

        .preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; margin-top: 14px; }
        .preview-card { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; border: 1px solid var(--accent); background: #000; }
        .preview-card img { width: 100%; height: 100%; object-fit: cover; }
        .remove-img { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.75); color: var(--danger); border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-weight: bold; line-height: 22px; text-align: center; font-size: 14px; }

        .post-card { background: var(--panel); border-left: 3px solid var(--accent2); border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 16px; border-radius: 8px; margin-bottom: 12px; }
        .post-date { color: var(--muted); font-size: 0.78rem; font-family: monospace; }
        .post-body { margin: 10px 0; font-size: 0.92rem; word-break: break-word; }
        .post-thumbs { display: flex; gap: 6px; overflow-x: auto; margin-top: 10px; padding-bottom: 2px; }
        .post-thumbs img { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--accent); flex-shrink: 0; }

        .event-card { background: var(--panel); border-left: 3px solid var(--accent); border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 14px 16px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .event-info-title { font-size: 0.92rem; font-weight: 700; color: var(--text); }
        .event-info-meta { color: var(--muted); font-size: 0.78rem; font-family: monospace; margin-top: 4px; }
        .event-card form { flex-shrink: 0; }

        /* ---------- Users tab ---------- */
        .role-badge-preview { display: inline-block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 9px; border-radius: 5px; white-space: nowrap; }
        .search-input { width: 100%; padding: 11px 13px; background: #05060c; color: #fff; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 14px; font-size: 0.9rem; }
        .search-input:focus { outline: none; border-color: var(--accent); }

        .user-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .user-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 480px; }
        .user-table th { text-align: left; color: #6b7590; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 10px; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
        .user-table td { padding: 10px; border-bottom: 1px solid var(--border-soft); vertical-align: middle; }
        .user-table tr:hover td { background: rgba(255,255,255,0.02); }
        .user-table .sub-roles-cell { display: flex; flex-wrap: wrap; gap: 4px; }
        .user-table .edit-btn { background: var(--panel-alt); color: var(--accent2); border: 1px solid var(--accent); padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; font-weight: 700; white-space: nowrap; }
        .user-table .edit-btn:hover { background: var(--accent); color: #fff; }
        .user-table .mono-cell { font-family: monospace; font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
        .mod-user-detail .post-card { border-left-color: var(--accent); }

        .role-checklist { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; margin: 6px 0 14px; padding: 10px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; }
        .role-checklist label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .role-checklist input[type="checkbox"] { flex-shrink: 0; }
        .role-checklist .empty-hint { color: var(--muted); font-size: 0.85rem; }

        .custom-role-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; flex-wrap: wrap; }

        .color-row { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
        .color-row input[type="color"] { width: 44px; height: 36px; padding: 2px; background: #05060c; border: 1px solid var(--border); border-radius: 5px; cursor: pointer; }
        .color-row label.checkbox-label { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.85rem; cursor: pointer; }

        .subsection-title { color: var(--muted); font-size: 0.9rem; margin: 22px 0 10px; padding-top: 16px; border-top: 1px solid var(--border-soft); }

        /* ---------- Admin accounts / My account ---------- */
        .admin-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; background: var(--bg-soft); border: 1px solid var(--border-soft); border-radius: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .admin-row-name { display: flex; align-items: center; gap: 10px; }
        .admin-row-name strong { font-size: 0.9rem; }
        .admin-row-meta { font-size: 0.72rem; color: var(--muted); }
        .badge-main { background: linear-gradient(135deg, var(--accent2), var(--accent)); color: #05060c; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
        .locked-note { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 0.85rem; padding: 14px; background: var(--bg-soft); border: 1px dashed var(--border); border-radius: 8px; }

        /* ---------- Responsive ---------- */
        @media (max-width: 900px) {
            .sidebar { transform: translateX(-100%); box-shadow: 0 0 40px rgba(0,0,0,0.5); }
            body.sidebar-open .sidebar { transform: translateX(0); }
            body.sidebar-open .sidebar-backdrop { display: block; }
            .sidebar-close { display: inline-flex; align-items: center; justify-content: center; }
            .main { margin-left: 0; padding-top: 16px; }
            .hamburger { display: inline-flex; }
        }
        @media (max-width: 560px) {
            .field-row { flex-direction: column; gap: 0; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .post-card, .card { padding: 14px; }
            .admin-row, .event-card { flex-direction: column; align-items: stretch; }
            .page-title { font-size: 1.1rem; }
        }
    </style>
</head>
<body>

<?php if (!$me): ?>
    <div class="login-shell">
        <div class="login-box">
            <div class="login-brand"><span class="dot"></span><h2>Aghimuan Admin</h2></div>
            <p class="login-sub">Sign in to manage announcements, events, and members.</p>
            <?php if (!empty($error)) echo "<div class='msg error'>" . htmlspecialchars($error) . "</div>"; ?>
            <form method="POST">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                <input type="hidden" name="action" value="login">
                <input type="text" name="username" placeholder="Username" autocomplete="username" required>
                <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
                <button type="submit" class="btn-submit">Log In</button>
            </form>
        </div>
    </div>
<?php else: ?>

    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="closeSidebar()"></div>

    <div class="app-shell">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <span class="dot"></span>
                    <div class="sidebar-brand-text">
                        <strong>Aghimuan</strong>
                        <span>Control Panel</span>
                    </div>
                </div>
                <button type="button" class="sidebar-close" onclick="closeSidebar()"><?php echo admin_icon('close'); ?></button>
            </div>

            <nav class="sidebar-nav">
                <button type="button" class="nav-item" data-tab="overview" onclick="switchTab('overview')">
                    <?php echo admin_icon('overview'); ?> Overview
                </button>
                <button type="button" class="nav-item" data-tab="announcements" onclick="switchTab('announcements')">
                    <?php echo admin_icon('announce'); ?> Announcements <span class="count"><?php echo count($existing_posts); ?></span>
                </button>
                <button type="button" class="nav-item" data-tab="events" onclick="switchTab('events')">
                    <?php echo admin_icon('events'); ?> Events <span class="count"><?php echo count($existing_events); ?></span>
                </button>
                <button type="button" class="nav-item" data-tab="users" onclick="switchTab('users')">
                    <?php echo admin_icon('users'); ?> Users &amp; Roles <span class="count"><?php echo count($all_users); ?></span>
                </button>
                <button type="button" class="nav-item" data-tab="moderation" onclick="switchTab('moderation')">
                    <?php echo admin_icon('moderation'); ?> User Management
                </button>

                <div class="nav-divider"></div>
                <div class="nav-section-label">Account</div>

                <?php if ($me['is_main']): ?>
                <button type="button" class="nav-item" data-tab="accounts" onclick="switchTab('accounts')">
                    <?php echo admin_icon('accounts'); ?> Admin Accounts <span class="count"><?php echo $admin_count; ?></span>
                </button>
                <?php endif; ?>
                <button type="button" class="nav-item" data-tab="account" onclick="switchTab('account')">
                    <?php echo admin_icon('account'); ?> My Account
                </button>
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-user">
                    <div class="sidebar-user-avatar"><?php echo htmlspecialchars(strtoupper(substr($me['username'], 0, 1))); ?></div>
                    <div class="sidebar-user-name">
                        <strong><?php echo htmlspecialchars($me['username']); ?></strong>
                        <span><?php echo $me['is_main'] ? 'Main Admin' : 'Admin'; ?></span>
                    </div>
                </div>
                <a href="?action=logout" class="logout-link"><?php echo admin_icon('logout'); ?> Log Out</a>
            </div>
        </aside>

        <main class="main">
            <div class="topbar">
                <button type="button" class="hamburger" onclick="openSidebar()"><?php echo admin_icon('menu'); ?></button>
                <div>
                    <div class="page-title" id="pageTitle">Overview</div>
                    <div class="page-sub" id="pageSub">Welcome back, <?php echo htmlspecialchars($me['username']); ?>.</div>
                </div>
            </div>

            <?php if (!empty($success)) echo "<div class='msg success'>" . htmlspecialchars($success) . "</div>"; ?>
            <?php if (!empty($error)) echo "<div class='msg error'>" . htmlspecialchars($error) . "</div>"; ?>
            <?php // Shown here (not just inside the accounts tab) so a rejected
                  // create_admin/delete_admin attempt from a non-main account
                  // still surfaces why it failed, even though that tab is
                  // hidden from them. ?>
            <?php if (!$me['is_main'] && !empty($admin_mgmt_error)) echo "<div class='msg error'>" . htmlspecialchars($admin_mgmt_error) . "</div>"; ?>
            <?php if (!empty($upload_debug)): ?>
                <div class="msg warning">
                    <strong>Upload warnings:</strong>
                    <ul>
                        <?php foreach ($upload_debug as $msg): ?>
                            <li><?php echo htmlspecialchars($msg); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>

            <!-- ===================== OVERVIEW ===================== -->
            <div id="tab-overview" class="tab-panel">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><?php echo admin_icon('announce'); ?></div>
                        <div class="stat-value"><?php echo count($existing_posts); ?></div>
                        <div class="stat-label">Announcements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><?php echo admin_icon('events'); ?></div>
                        <div class="stat-value"><?php echo count($upcoming_events); ?></div>
                        <div class="stat-label">Upcoming Events</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><?php echo admin_icon('users'); ?></div>
                        <div class="stat-value"><?php echo count($all_users); ?></div>
                        <div class="stat-label">Members</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><?php echo admin_icon('accounts'); ?></div>
                        <div class="stat-value"><?php echo $admin_count; ?></div>
                        <div class="stat-label">Admin Accounts</div>
                    </div>
                </div>

                <div class="overview-grid">
                    <div class="card">
                        <h3><?php echo admin_icon('announce'); ?> Recent Announcements</h3>
                        <div class="mini-list">
                            <?php if (empty($recent_posts)): ?>
                                <div class="empty-hint">No announcements posted yet.</div>
                            <?php else: ?>
                                <?php foreach ($recent_posts as $post): ?>
                                    <div class="mini-item">
                                        <div>
                                            <div class="mini-item-title"><?php echo !empty($post['pinned']) ? '📌 ' : ''; ?><?php echo htmlspecialchars(mb_strimwidth(trim(strip_tags($post['text'])), 0, 80, '…')); ?></div>
                                            <div class="mini-item-meta"><?php echo htmlspecialchars($post['date_formatted']); ?></div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="card">
                        <h3><?php echo admin_icon('events'); ?> Upcoming Events</h3>
                        <div class="mini-list">
                            <?php if (empty($soonest_events)): ?>
                                <div class="empty-hint">No upcoming events scheduled.</div>
                            <?php else: ?>
                                <?php foreach ($soonest_events as $ev): ?>
                                    <div class="mini-item">
                                        <div>
                                            <div class="mini-item-title"><?php echo htmlspecialchars($ev['title'] ?? 'Untitled event'); ?></div>
                                            <div class="mini-item-meta"><?php echo htmlspecialchars(date('F j, Y', strtotime($ev['date'] ?? 'now'))); ?><?php echo !empty($ev['location']) ? ' · ' . htmlspecialchars($ev['location']) : ''; ?></div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div><!-- /#tab-overview -->

            <!-- ===================== ANNOUNCEMENTS ===================== -->
            <div id="tab-announcements" class="tab-panel">

            <div class="card">
                <h3><?php echo admin_icon('announce'); ?> Create Announcement</h3>
                <form method="POST" enctype="multipart/form-data" id="postForm">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                    <input type="hidden" name="action" value="create">
                    <input type="hidden" name="content" id="hiddenContent">

                    <div class="field-group" style="margin-bottom: 14px;">
                        <label class="field-label" for="postAsSelect">Post as</label>
                        <select class="field-input" name="post_as_user_id" id="postAsSelect">
                            <option value="">Aghimuan Club</option>
                            <?php foreach ($postable_users as $pu): ?>
                                <option value="<?php echo (int) $pu['id']; ?>">
                                    <?php echo htmlspecialchars($pu['username']); ?> (<?php echo htmlspecialchars($pu['main_role']); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="toolbar">
                        <button type="button" class="tool-btn" onclick="execCmd('bold')">B</button>
                        <button type="button" class="tool-btn" style="font-style: italic;" onclick="execCmd('italic')">I</button>
                        <button type="button" class="tool-btn" style="text-decoration: underline;" onclick="execCmd('underline')">U</button>
                        <select class="tool-select" onchange="execCmd('fontSize', this.value)">
                            <option value="3">Normal Size</option>
                            <option value="1">Small</option>
                            <option value="4">Medium</option>
                            <option value="5">Large</option>
                            <option value="6">Extra Large</option>
                        </select>
                        <button type="button" class="tool-btn" onclick="execCmd('removeFormat')">Clear</button>
                    </div>

                    <div id="editor" class="editor-box" contenteditable="true"></div>

                    <div class="dropzone" onclick="document.getElementById('fileInput').click()" id="dropZone">
                        <p>Drag and drop photos here or <span>browse files</span></p>
                        <input type="file" id="fileInput" name="images[]" accept="image/*" multiple onchange="handleFileSelect(this.files)">
                    </div>
                    <div id="uploadStatus" style="color: var(--muted); font-size: 0.8rem; margin-top: 8px;"></div>

                    <div id="previewGrid" class="preview-grid"></div>

                    <button type="submit" class="btn-submit" onclick="prepareSubmit()">Publish Post</button>
                </form>
            </div>

            <h3 style="margin-bottom: 12px; font-size: 1rem; color: var(--muted);">Posted Updates</h3>
            <?php if (empty($existing_posts)): ?>
                <p class="empty-hint">No announcements posted yet.</p>
            <?php else: ?>
                <?php foreach ($existing_posts as $post): ?>
                    <?php $is_pinned = !empty($post['pinned']); ?>
                    <div class="post-card"<?php echo $is_pinned ? ' style="border-color:#55F1F8;"' : ''; ?>>
                        <?php if ($is_pinned): ?>
                            <div style="display:inline-flex;align-items:center;gap:5px;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#55F1F8;margin-bottom:8px;">
                                📌 Pinned
                            </div>
                        <?php endif; ?>
                        <div class="post-date">
                            <?php echo $post['date_formatted']; ?>
                            <?php
                                $posted_as = !empty($post['poster_user_id']) ? ($all_users_by_id[(int) $post['poster_user_id']] ?? null) : null;
                            ?>
                            <?php if ($posted_as): ?>
                                &middot; Posted as <strong><?php echo htmlspecialchars($posted_as['username']); ?></strong>
                            <?php else: ?>
                                &middot; Posted as Aghimuan Club
                            <?php endif; ?>
                        </div>
                        <div class="post-body"><?php echo $post['text']; ?></div>

                        <?php
                            $imgs = !empty($post['images']) ? $post['images'] : (!empty($post['image']) ? [$post['image']] : []);
                            if (!empty($imgs)):
                        ?>
                            <div class="post-thumbs">
                                <?php foreach ($imgs as $img_src): ?>
                                    <img src="<?php echo htmlspecialchars($img_src); ?>" alt="thumbnail">
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>

                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <form method="POST">
                                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                <input type="hidden" name="action" value="toggle_pin">
                                <input type="hidden" name="post_id" value="<?php echo $post['id']; ?>">
                                <button type="submit" class="tool-btn"><?php echo $is_pinned ? '📌 Unpin' : '📌 Pin'; ?></button>
                            </form>
                            <form method="POST" onsubmit="return confirm('Delete this post?');">
                                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="post_id" value="<?php echo $post['id']; ?>">
                                <button type="submit" class="delete-btn">Delete</button>
                            </form>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>

            </div><!-- /#tab-announcements -->

            <!-- ===================== EVENTS ===================== -->
            <div id="tab-events" class="tab-panel">

            <div class="card">
                <h3><?php echo admin_icon('events'); ?> Add Event</h3>
                <?php if (!empty($event_error)) echo "<div class='msg error'>" . htmlspecialchars($event_error) . "</div>"; ?>
                <?php if (!empty($event_success)) echo "<div class='msg success'>" . htmlspecialchars($event_success) . "</div>"; ?>
                <form method="POST">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                    <input type="hidden" name="action" value="create_event">

                    <label class="field-label" for="event_title">Event Title</label>
                    <input class="field-input" type="text" id="event_title" name="event_title" placeholder="e.g. General Assembly" required>

                    <div class="field-row">
                        <div>
                            <label class="field-label" for="event_date">Date</label>
                            <input class="field-input" type="date" id="event_date" name="event_date" required>
                        </div>
                        <div>
                            <label class="field-label" for="event_time">Time (optional)</label>
                            <input class="field-input" type="text" id="event_time" name="event_time" placeholder="e.g. 2:00 PM">
                        </div>
                    </div>

                    <label class="field-label" for="event_location">Location (optional)</label>
                    <input class="field-input" type="text" id="event_location" name="event_location" placeholder="e.g. Room 301 / Covered Court">

                    <button type="submit" class="btn-submit">Add Event</button>
                </form>
            </div>

            <h3 style="margin-bottom: 12px; font-size: 1rem; color: var(--muted);">Scheduled Events</h3>
            <?php if (empty($existing_events)): ?>
                <p class="empty-hint">No events added yet.</p>
            <?php else: ?>
                <?php foreach ($existing_events as $ev): ?>
                    <div class="event-card">
                        <div>
                            <div class="event-info-title"><?php echo htmlspecialchars($ev['title'] ?? 'Untitled event'); ?></div>
                            <div class="event-info-meta">
                                <?php
                                    $meta_parts = [];
                                    if (!empty($ev['date'])) $meta_parts[] = date('F j, Y', strtotime($ev['date']));
                                    if (!empty($ev['time'])) $meta_parts[] = $ev['time'];
                                    if (!empty($ev['location'])) $meta_parts[] = $ev['location'];
                                    echo htmlspecialchars(implode(' · ', $meta_parts));
                                ?>
                            </div>
                        </div>
                        <form method="POST" onsubmit="return confirm('Delete this event?');">
                            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                            <input type="hidden" name="action" value="delete_event">
                            <input type="hidden" name="event_id" value="<?php echo htmlspecialchars($ev['id']); ?>">
                            <button type="submit" class="delete-btn">Delete</button>
                        </form>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>

            </div><!-- /#tab-events -->

            <!-- ===================== USERS & ROLES ===================== -->
            <div id="tab-users" class="tab-panel">

            <?php if (!empty($user_role_error)) echo "<div class='msg error'>" . htmlspecialchars($user_role_error) . "</div>"; ?>
            <?php if (!empty($user_role_success)) echo "<div class='msg success'>" . htmlspecialchars($user_role_success) . "</div>"; ?>
            <?php if (!empty($role_error)) echo "<div class='msg error'>" . htmlspecialchars($role_error) . "</div>"; ?>
            <?php if (!empty($role_success)) echo "<div class='msg success'>" . htmlspecialchars($role_success) . "</div>"; ?>

            <div class="card">
                <h3><?php echo admin_icon('users'); ?> All Members</h3>
                <input type="text" class="search-input" id="userSearchInput" placeholder="Search by username…" oninput="filterUserTable()">

                <div class="user-table-wrap">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Main Role</th>
                                <th>Sub-Roles</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="userTableBody">
                            <?php foreach ($all_users as $u): ?>
                                <?php
                                    $customIds = !empty($u['custom_role_ids']) ? array_map('intval', explode(',', $u['custom_role_ids'])) : [];
                                    $mainRoleStyle = match ($u['main_role']) {
                                        'CLUB ADVISER' => 'background: linear-gradient(135deg, #00f2fe, #4facfe); color: #060b10;',
                                        'OFFICER' => 'background: linear-gradient(135deg, #00c6ff, #0072ff); color: #fff;',
                                        'COMMITTEE MEMBER' => 'background: #1e88e5; color: #fff;',
                                        default => 'background: rgba(85,241,248,0.1); color: #55F1F8; border: 1px solid rgba(85,241,248,0.35);',
                                    };
                                ?>
                                <tr data-user-id="<?php echo (int) $u['id']; ?>"
                                    data-username="<?php echo htmlspecialchars($u['username']); ?>"
                                    data-main-role="<?php echo htmlspecialchars($u['main_role']); ?>"
                                    data-sub-role="<?php echo htmlspecialchars($u['sub_role'] ?? ''); ?>"
                                    data-grade="<?php echo htmlspecialchars($u['grade'] ?? ''); ?>"
                                    data-strand="<?php echo htmlspecialchars($u['strand'] ?? ''); ?>"
                                    data-club="<?php echo htmlspecialchars($u['club'] ?? ''); ?>"
                                    data-custom-role-ids="<?php echo htmlspecialchars(implode(',', $customIds)); ?>">
                                    <td><?php echo htmlspecialchars($u['username']); ?></td>
                                    <td><span class="role-badge-preview" style="<?php echo $mainRoleStyle; ?>"><?php echo htmlspecialchars($u['main_role']); ?></span></td>
                                    <td>
                                        <div class="sub-roles-cell">
                                            <?php if (!empty($u['sub_role'])): ?>
                                                <span class="role-badge-preview" style="background:#1e88e5;color:#fff;"><?php echo htmlspecialchars($u['sub_role']); ?></span>
                                            <?php endif; ?>
                                            <?php foreach (['club', 'grade', 'strand'] as $field): ?>
                                                <?php if (!empty($u[$field])): ?>
                                                    <span class="role-badge-preview" style="background:#455a64;color:#fff;"><?php echo htmlspecialchars($u[$field]); ?></span>
                                                <?php endif; ?>
                                            <?php endforeach; ?>
                                            <?php foreach ($customIds as $cid): ?>
                                                <?php if (isset($custom_roles_by_id[$cid])): $cr = $custom_roles_by_id[$cid]; ?>
                                                    <span class="role-badge-preview" style="background:<?php echo htmlspecialchars($cr['color_css']); ?>;color:<?php echo htmlspecialchars($cr['text_color']); ?>;"><?php echo htmlspecialchars($cr['name']); ?></span>
                                                <?php endif; ?>
                                            <?php endforeach; ?>
                                            <?php if (empty($u['sub_role']) && empty($u['club']) && empty($u['grade']) && empty($u['strand']) && empty($customIds)): ?>
                                                <span style="color:var(--muted);">—</span>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <td><button type="button" class="edit-btn" onclick="openUserEdit(this.closest('tr'))">Edit</button></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card" id="userEditPanel" style="display:none;">
                <h3>Edit Role — <span id="editUsername"></span></h3>
                <form method="POST" id="userEditForm">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                    <input type="hidden" name="action" value="update_user_role">
                    <input type="hidden" name="user_id" id="editUserId">

                    <label class="field-label" for="editMainRole">Main Role</label>
                    <select class="field-input" name="main_role" id="editMainRole" onchange="onMainRoleChange()">
                        <?php foreach (MAIN_ROLES as $mr): ?>
                            <option value="<?php echo htmlspecialchars($mr); ?>"><?php echo htmlspecialchars($mr); ?></option>
                        <?php endforeach; ?>
                    </select>

                    <div id="presetSubRoleWrap" style="display:none;">
                        <label class="field-label" for="editSubRole">Sub-Role</label>
                        <select class="field-input" name="sub_role" id="editSubRole"></select>
                    </div>

                    <div id="memberFieldsWrap" style="display:none;">
                        <label class="field-label" for="editGrade">Grade Level</label>
                        <select class="field-input" name="grade" id="editGrade">
                            <?php foreach (GRADES as $g): ?>
                                <option value="<?php echo $g; ?>"><?php echo $g; ?></option>
                            <?php endforeach; ?>
                        </select>

                        <label class="field-label" for="editStrand">Strand / Course</label>
                        <select class="field-input" name="strand" id="editStrand">
                            <?php foreach (STRANDS as $s): ?>
                                <option value="<?php echo $s; ?>"><?php echo $s; ?></option>
                            <?php endforeach; ?>
                        </select>

                        <label class="field-label" for="editClub">Club (optional)</label>
                        <select class="field-input" name="club" id="editClub">
                            <option value="">None</option>
                            <optgroup label="Non-Academic Clubs">
                                <?php foreach (CLUBS['Non-academic'] as $c): ?>
                                    <option value="<?php echo $c; ?>"><?php echo $c; ?></option>
                                <?php endforeach; ?>
                            </optgroup>
                            <optgroup label="Academic Clubs">
                                <?php foreach (CLUBS['Academic'] as $c): ?>
                                    <option value="<?php echo $c; ?>"><?php echo $c; ?></option>
                                <?php endforeach; ?>
                            </optgroup>
                        </select>
                    </div>

                    <label class="field-label" style="margin-top: 8px;">Custom Roles</label>
                    <div class="role-checklist">
                        <?php if (empty($all_custom_roles)): ?>
                            <span class="empty-hint">No custom roles yet — create one below.</span>
                        <?php else: ?>
                            <?php foreach ($all_custom_roles as $cr): ?>
                                <label>
                                    <input type="checkbox" name="custom_role_ids[]" value="<?php echo (int) $cr['id']; ?>" class="custom-role-checkbox">
                                    <span class="role-badge-preview" style="background:<?php echo htmlspecialchars($cr['color_css']); ?>;color:<?php echo htmlspecialchars($cr['text_color']); ?>;"><?php echo htmlspecialchars($cr['name']); ?></span>
                                </label>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>

                    <button type="submit" class="btn-submit">Save Role Changes</button>
                    <button type="button" class="btn-ghost" onclick="closeUserEdit()">Cancel</button>
                </form>
            </div>

            <div class="card">
                <h3>Create Custom Role</h3>
                <form method="POST">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                    <input type="hidden" name="action" value="create_custom_role">

                    <label class="field-label" for="roleNameInput">Role Name</label>
                    <input class="field-input" type="text" id="roleNameInput" name="role_name" placeholder="e.g. Event Volunteer" required>

                    <label class="field-label">Color</label>
                    <div class="color-row">
                        <input type="color" name="role_color1" value="#3096C7">
                        <label class="checkbox-label">
                            <input type="checkbox" name="role_is_gradient" id="gradientToggle" onchange="document.getElementById('color2Wrap').style.display = this.checked ? 'inline-block' : 'none'">
                            Use gradient
                        </label>
                        <span id="color2Wrap" style="display:none;">
                            <input type="color" name="role_color2" value="#55F1F8">
                        </span>
                    </div>

                    <label class="field-label" for="roleTextColor">Text Color</label>
                    <select class="field-input" name="role_text_color" id="roleTextColor">
                        <option value="white">White text</option>
                        <option value="black">Black text</option>
                    </select>

                    <button type="submit" class="btn-submit">Create Role</button>
                </form>

                <?php if (!empty($all_custom_roles)): ?>
                    <div class="subsection-title">Existing Custom Roles</div>
                    <?php foreach ($all_custom_roles as $cr): ?>
                        <div class="custom-role-row">
                            <span class="role-badge-preview" style="background:<?php echo htmlspecialchars($cr['color_css']); ?>;color:<?php echo htmlspecialchars($cr['text_color']); ?>;"><?php echo htmlspecialchars($cr['name']); ?></span>
                            <form method="POST" onsubmit="return confirm('Delete this role? It will be removed from every user who has it.');">
                                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                <input type="hidden" name="action" value="delete_custom_role">
                                <input type="hidden" name="role_id" value="<?php echo (int) $cr['id']; ?>">
                                <button type="submit" class="delete-btn">Delete</button>
                            </form>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            </div><!-- /#tab-users -->

            <!-- ===================== USER MANAGEMENT / MODERATION ===================== -->
            <div id="tab-moderation" class="tab-panel">

            <?php if (!empty($user_mgmt_error)) echo "<div class='msg error'>" . htmlspecialchars($user_mgmt_error) . "</div>"; ?>
            <?php if (!empty($user_mgmt_success)) echo "<div class='msg success'>" . htmlspecialchars($user_mgmt_success) . "</div>"; ?>

            <?php if (!empty($deleted_user_ip)): ?>
                <div class="card" style="border-left: 3px solid var(--danger);">
                    <h3>Ban this IP address?</h3>
                    <p class="empty-hint" style="margin-bottom: 14px;">
                        "<?php echo htmlspecialchars($deleted_user_username); ?>" signed up from
                        <strong><?php echo htmlspecialchars($deleted_user_ip); ?></strong>.
                        Banning it will stop new accounts from being created from that address.
                    </p>
                    <form method="POST" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                        <input type="hidden" name="action" value="ban_ip">
                        <input type="hidden" name="ip_address" value="<?php echo htmlspecialchars($deleted_user_ip); ?>">
                        <div style="flex: 1; min-width: 180px;">
                            <label class="field-label" for="banReason">Reason (optional)</label>
                            <input class="field-input" type="text" id="banReason" name="ban_reason" placeholder="e.g. repeated harassment">
                        </div>
                        <button type="submit" class="delete-btn">Ban <?php echo htmlspecialchars($deleted_user_ip); ?></button>
                    </form>
                </div>
            <?php endif; ?>

            <div class="card">
                <h3><?php echo admin_icon('moderation'); ?> All Members</h3>
                <input type="text" class="search-input" id="modSearchInput" placeholder="Search by username…" oninput="filterModTable()">

                <div class="user-table-wrap">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Signed Up</th>
                                <th>IP Address</th>
                                <th>Comments</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="modTableBody">
                            <?php foreach ($all_users as $u): ?>
                                <?php $uComments = $comments_by_user[(int) $u['id']] ?? []; ?>
                                <tr data-username="<?php echo htmlspecialchars($u['username']); ?>">
                                    <td><?php echo htmlspecialchars($u['username']); ?></td>
                                    <td class="mono-cell"><?php echo htmlspecialchars($u['created_at'] ?? '—'); ?></td>
                                    <td class="mono-cell"><?php echo htmlspecialchars($u['ip_address'] ?: 'Unknown'); ?></td>
                                    <td><?php echo count($uComments); ?></td>
                                    <td style="display: flex; gap: 6px; flex-wrap: wrap;">
                                        <button type="button" class="edit-btn" onclick="openModUser(<?php echo (int) $u['id']; ?>)">View</button>
                                        <form method="POST" onsubmit="return confirm('Permanently delete &quot;<?php echo htmlspecialchars($u['username'], ENT_QUOTES); ?>&quot;? This removes their comments, DMs, friends, and roles. This cannot be undone.');" style="display: inline;">
                                            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                            <input type="hidden" name="action" value="delete_user">
                                            <input type="hidden" name="user_id" value="<?php echo (int) $u['id']; ?>">
                                            <button type="submit" class="delete-btn">Delete</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <?php foreach ($all_users as $u): ?>
                <?php $uComments = $comments_by_user[(int) $u['id']] ?? []; ?>
                <div class="card mod-user-detail" id="modUser-<?php echo (int) $u['id']; ?>" style="display:none;">
                    <h3>Comments by <?php echo htmlspecialchars($u['username']); ?></h3>
                    <p class="empty-hint" style="margin-bottom: 14px;">
                        Signed up <?php echo htmlspecialchars($u['created_at'] ?? 'unknown'); ?> from
                        <strong><?php echo htmlspecialchars($u['ip_address'] ?: 'Unknown'); ?></strong>.
                    </p>
                    <?php if (empty($uComments)): ?>
                        <p class="empty-hint">No comments posted.</p>
                    <?php else: ?>
                        <?php foreach ($uComments as $c): ?>
                            <div class="post-card" style="margin-bottom: 8px;">
                                <div class="post-date">
                                    Post #<?php echo htmlspecialchars($c['post_id']); ?>
                                    · <?php echo htmlspecialchars($c['created_at']); ?>
                                    <?php if (!empty($c['parent_id'])): ?> · reply<?php endif; ?>
                                    <?php if (!empty($c['deleted_at'])): ?> · <span style="color: var(--danger);">deleted</span><?php endif; ?>
                                </div>
                                <div class="post-body"><?php echo nl2br(htmlspecialchars($c['body'])); ?></div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                    <button type="button" class="btn-ghost" onclick="closeModUser(<?php echo (int) $u['id']; ?>)">Close</button>
                </div>
            <?php endforeach; ?>

            <?php if (!empty($all_banned_ips)): ?>
                <div class="card">
                    <h3>Banned IP Addresses</h3>
                    <?php foreach ($all_banned_ips as $b): ?>
                        <div class="admin-row">
                            <div class="admin-row-name">
                                <div>
                                    <strong><?php echo htmlspecialchars($b['ip_address']); ?></strong>
                                    <div class="admin-row-meta">
                                        <?php echo !empty($b['reason']) ? htmlspecialchars($b['reason']) . ' · ' : ''; ?>banned <?php echo htmlspecialchars($b['created_at']); ?><?php echo !empty($b['banned_by']) ? ' by ' . htmlspecialchars($b['banned_by']) : ''; ?>
                                    </div>
                                </div>
                            </div>
                            <form method="POST" onsubmit="return confirm('Unban this IP address?');">
                                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                <input type="hidden" name="action" value="unban_ip">
                                <input type="hidden" name="ban_id" value="<?php echo (int) $b['id']; ?>">
                                <button type="submit" class="delete-btn">Unban</button>
                            </form>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            </div><!-- /#tab-moderation -->

            <!-- ===================== ADMIN ACCOUNTS (main account only) ===================== -->
            <?php if ($me['is_main']): ?>
            <div id="tab-accounts" class="tab-panel">

                <?php if (!empty($admin_mgmt_error)) echo "<div class='msg error'>" . htmlspecialchars($admin_mgmt_error) . "</div>"; ?>
                <?php if (!empty($admin_mgmt_success)) echo "<div class='msg success'>" . htmlspecialchars($admin_mgmt_success) . "</div>"; ?>

                <div class="card">
                    <h3><?php echo admin_icon('accounts'); ?> Add Admin Account</h3>
                    <p class="empty-hint" style="margin-bottom:14px;">Only the main account (<?php echo htmlspecialchars(MAIN_ADMIN_USERNAME); ?>) can create or remove other admin accounts.</p>
                    <form method="POST">
                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                        <input type="hidden" name="action" value="create_admin">

                        <label class="field-label" for="newAdminUsername">Username</label>
                        <input class="field-input" type="text" id="newAdminUsername" name="new_admin_username" placeholder="e.g. media_admin" required>

                        <label class="field-label" for="newAdminPassword">Password</label>
                        <input class="field-input" type="password" id="newAdminPassword" name="new_admin_password" placeholder="At least 6 characters" minlength="6" required>

                        <button type="submit" class="btn-submit">Create Admin Account</button>
                    </form>
                </div>

                <div class="card">
                    <h3>Existing Admin Accounts</h3>
                    <?php foreach ($all_admins as $a): ?>
                        <div class="admin-row">
                            <div class="admin-row-name">
                                <div class="sidebar-user-avatar" style="width:30px;height:30px;font-size:0.8rem;"><?php echo htmlspecialchars(strtoupper(substr($a['username'], 0, 1))); ?></div>
                                <div>
                                    <strong><?php echo htmlspecialchars($a['username']); ?></strong>
                                    <?php if ((int) $a['is_main'] === 1): ?><span class="badge-main">Main</span><?php endif; ?>
                                    <div class="admin-row-meta">Added <?php echo htmlspecialchars($a['created_at']); ?></div>
                                </div>
                            </div>
                            <?php if ((int) $a['is_main'] !== 1): ?>
                                <form method="POST" onsubmit="return confirm('Remove admin account &quot;<?php echo htmlspecialchars($a['username'], ENT_QUOTES); ?>&quot;?');">
                                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                                    <input type="hidden" name="action" value="delete_admin">
                                    <input type="hidden" name="admin_id" value="<?php echo (int) $a['id']; ?>">
                                    <button type="submit" class="delete-btn">Remove</button>
                                </form>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>

            </div><!-- /#tab-accounts -->
            <?php endif; ?>

            <!-- ===================== MY ACCOUNT ===================== -->
            <div id="tab-account" class="tab-panel">
                <div class="card">
                    <h3><?php echo admin_icon('account'); ?> Signed In As</h3>
                    <div class="sidebar-user" style="padding:0 0 4px;">
                        <div class="sidebar-user-avatar"><?php echo htmlspecialchars(strtoupper(substr($me['username'], 0, 1))); ?></div>
                        <div class="sidebar-user-name">
                            <strong><?php echo htmlspecialchars($me['username']); ?></strong>
                            <span><?php echo $me['is_main'] ? 'Main Admin' : 'Admin'; ?></span>
                        </div>
                    </div>
                    <?php if (!$me['is_main']): ?>
                        <div class="locked-note" style="margin-top:14px;">
                            <?php echo admin_icon('accounts'); ?>
                            Only <?php echo htmlspecialchars(MAIN_ADMIN_USERNAME); ?> can add or remove admin accounts.
                        </div>
                    <?php endif; ?>
                </div>

                <div class="card">
                    <h3>Change Password</h3>
                    <?php if (!empty($account_error)) echo "<div class='msg error'>" . htmlspecialchars($account_error) . "</div>"; ?>
                    <?php if (!empty($account_success)) echo "<div class='msg success'>" . htmlspecialchars($account_success) . "</div>"; ?>
                    <form method="POST">
                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($admin_csrf_token); ?>">
                        <input type="hidden" name="action" value="change_password">

                        <label class="field-label" for="currentPassword">Current Password</label>
                        <input class="field-input" type="password" id="currentPassword" name="current_password" autocomplete="current-password" required>

                        <label class="field-label" for="newPassword">New Password</label>
                        <input class="field-input" type="password" id="newPassword" name="new_password" autocomplete="new-password" minlength="6" required>

                        <label class="field-label" for="confirmPassword">Confirm New Password</label>
                        <input class="field-input" type="password" id="confirmPassword" name="confirm_password" autocomplete="new-password" minlength="6" required>

                        <button type="submit" class="btn-submit">Update Password</button>
                    </form>
                </div>
            </div><!-- /#tab-account -->

        </main>
    </div><!-- /.app-shell -->

<script>
    // ---------- Sidebar (sliding menu on mobile) ----------
    function openSidebar() {
        document.body.classList.add('sidebar-open');
    }
    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    // ---------- Tabs ----------
    const TAB_META = {
        overview:      { title: 'Overview',        sub: 'A quick look at whats happening.' },
        announcements: { title: 'Announcements',   sub: 'Post updates and manage past posts.' },
        events:        { title: 'Events',          sub: 'Schedule and manage upcoming events.' },
        users:         { title: 'Users & Roles',   sub: 'Manage members and role assignments.' },
        moderation:    { title: 'User Management', sub: 'Delete accounts, review comments, and manage IP bans.' },
        accounts:      { title: 'Admin Accounts',  sub: 'Create and remove admin logins.' },
        account:       { title: 'My Account',      sub: 'Manage your own login.' },
    };

    function switchTab(name) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        localStorage.setItem('aghimuanAdminTab', name);

        const meta = TAB_META[name];
        if (meta) {
            document.getElementById('pageTitle').textContent = meta.title;
            document.getElementById('pageSub').textContent = meta.sub;
        }
        closeSidebar();
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }

    (function initTab() {
        const serverDefault = <?php echo json_encode($default_tab); ?>;
        const forced = <?php echo json_encode(isset($_POST['action']) && in_array($_POST['action'], ['create_event', 'delete_event', 'create_custom_role', 'delete_custom_role', 'update_user_role', 'create_admin', 'delete_admin', 'change_password', 'delete_user', 'ban_ip', 'unban_ip'])); ?>;
        const isMain = <?php echo json_encode((bool) $me['is_main']); ?>;
        const remembered = localStorage.getItem('aghimuanAdminTab');
        let initial = forced ? serverDefault : (remembered || serverDefault);
        if (initial === 'accounts' && !isMain) initial = 'overview';
        if (!document.getElementById('tab-' + initial)) initial = 'overview';
        switchTab(initial);
    })();

    const SUB_ROLES_BY_MAIN = <?php echo json_encode(SUB_ROLES_BY_MAIN); ?>;

    function onMainRoleChange() {
        const mainRole = document.getElementById('editMainRole').value;
        const subWrap = document.getElementById('presetSubRoleWrap');
        const memberWrap = document.getElementById('memberFieldsWrap');
        const subSelect = document.getElementById('editSubRole');

        if (mainRole === 'MEMBER') {
            subWrap.style.display = 'none';
        } else {
            const options = SUB_ROLES_BY_MAIN[mainRole] || [];
            subSelect.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
            subWrap.style.display = options.length ? 'block' : 'none';
        }

        memberWrap.style.display = (mainRole === 'CLUB ADVISER') ? 'none' : 'block';
    }

    function openUserEdit(row) {
        const d = row.dataset;
        document.getElementById('editUserId').value = d.userId;
        document.getElementById('editUsername').textContent = d.username;
        document.getElementById('editMainRole').value = d.mainRole;
        onMainRoleChange();

        document.getElementById('editGrade').value = d.grade || '';
        document.getElementById('editStrand').value = d.strand || '';
        document.getElementById('editClub').value = d.club || '';
        if (d.mainRole !== 'MEMBER') {
            document.getElementById('editSubRole').value = d.subRole || '';
        }

        const assigned = (d.customRoleIds || '').split(',').filter(Boolean);
        document.querySelectorAll('.custom-role-checkbox').forEach(cb => {
            cb.checked = assigned.includes(cb.value);
        });

        document.getElementById('userEditPanel').style.display = 'block';
        document.getElementById('userEditPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeUserEdit() {
        document.getElementById('userEditPanel').style.display = 'none';
    }

    function filterUserTable() {
        const q = document.getElementById('userSearchInput').value.trim().toLowerCase();
        document.querySelectorAll('#userTableBody tr').forEach(tr => {
            tr.style.display = tr.dataset.username.toLowerCase().includes(q) ? '' : 'none';
        });
    }

    function openModUser(id) {
        document.querySelectorAll('.mod-user-detail').forEach(el => el.style.display = 'none');
        const panel = document.getElementById('modUser-' + id);
        if (panel) {
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function closeModUser(id) {
        const panel = document.getElementById('modUser-' + id);
        if (panel) panel.style.display = 'none';
    }

    function filterModTable() {
        const q = document.getElementById('modSearchInput').value.trim().toLowerCase();
        document.querySelectorAll('#modTableBody tr').forEach(tr => {
            tr.style.display = tr.dataset.username.toLowerCase().includes(q) ? '' : 'none';
        });
    }

    function execCmd(command, value = null) {
        document.execCommand(command, false, value);
    }

    document.getElementById('editor').addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    async function compressImage(file, maxDim = 1600, quality = 0.82) {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            const blob = await drawToBlob(bitmap, maxDim, quality);
            if (bitmap.close) bitmap.close();
            if (!blob) return file;
            return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
            return compressImageLegacy(file, maxDim, quality);
        }
    }

    function drawToBlob(source, maxDim, quality) {
        let width = source.width;
        let height = source.height;
        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round(height * maxDim / width);
                width = maxDim;
            } else {
                width = Math.round(width * maxDim / height);
                height = maxDim;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(source, 0, 0, width, height);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    }

    function compressImageLegacy(file, maxDim, quality) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    const blob = await drawToBlob(img, maxDim, quality);
                    if (!blob) { resolve(file); return; }
                    resolve(new File(
                        [blob],
                        file.name.replace(/\.\w+$/, '.jpg'),
                        { type: 'image/jpeg' }
                    ));
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    }

    let selectedFiles = [];

    async function handleFileSelect(files) {
        const fileList = Array.from(files);
        const statusEl = document.getElementById('uploadStatus');
        statusEl.textContent = 'Optimizing images...';

        for (const file of fileList) {
            const needsCompression = file.size > 900 * 1024;
            const finalFile = needsCompression ? await compressImage(file) : file;
            selectedFiles.push(finalFile);
        }

        updatePreviews();
        updateFileInput();

        const totalKb = Math.round(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024);
        statusEl.textContent = `${selectedFiles.length} photo${selectedFiles.length === 1 ? '' : 's'} ready · ~${totalKb} KB total`;
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updatePreviews();
        updateFileInput();
        const statusEl = document.getElementById('uploadStatus');
        if (selectedFiles.length === 0) {
            statusEl.textContent = '';
        } else {
            const totalKb = Math.round(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024);
            statusEl.textContent = `${selectedFiles.length} photo${selectedFiles.length === 1 ? '' : 's'} ready · ~${totalKb} KB total`;
        }
    }

    function updateFileInput() {
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        document.getElementById('fileInput').files = dt.files;
    }

    function updatePreviews() {
        const container = document.getElementById('previewGrid');
        container.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const card = document.createElement('div');
                card.className = 'preview-card';
                card.innerHTML = `
                    <img src="${e.target.result}" alt="preview">
                    <button type="button" class="remove-img" onclick="removeFile(${index})">&times;</button>
                `;
                container.appendChild(card);
            };
            reader.readAsDataURL(file);
        });
    }

    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#55F1F8'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#3096C7'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3096C7';
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files);
        }
    });

    function prepareSubmit() {
        const html = document.getElementById('editor').innerHTML;
        document.getElementById('hiddenContent').value = html;
    }

    // Close the sliding sidebar with Escape, for keyboard users.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
</script>
<?php endif; ?>
</body>
</html>