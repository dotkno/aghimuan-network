<?php
/**
 * admin-handlers.php — POST action handlers for the admin panel
 */

declare(strict_types=1);

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/notifications.php';

function sanitize_post_html($html) {
    $allowed = '<div><br><b><i><u><strong><em><font><span><ol><ul><li><p>';
    $html = strip_tags($html, $allowed);
    $html = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);
    $html = preg_replace('/(href|src)\s*=\s*(["\'])\s*javascript:[^"\']*\2/i', '', $html);
    return $html;
}

function handle_create_announcement(PDO $pdo): array {
    $upload_debug = [];
    $text = sanitize_post_html(trim($_POST['content'] ?? ''));
    $images = [];

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

    $uploads_dir = __DIR__ . '/../uploads';
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
        $json_file = __DIR__ . '/../announcements.json';
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
        return ['success' => $success, 'upload_debug' => $upload_debug];
    }
    
    return ['upload_debug' => $upload_debug];
}

function handle_delete_announcement(PDO $pdo): string {
    $delete_id = intval($_POST['post_id'] ?? 0);
    $json_file = __DIR__ . '/../announcements.json';
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
                    $full_path = __DIR__ . '/../' . $img_path;
                    if (file_exists($full_path)) {
                        unlink($full_path);
                    }
                }
            } else {
                $updated_data[] = $post;
            }
        }
        file_put_contents($json_file, json_encode($updated_data, JSON_PRETTY_PRINT));

        $stmt = $pdo->prepare('DELETE FROM comments WHERE post_id = :post_id');
        $stmt->execute([':post_id' => $delete_id]);

        return 'Announcement deleted.';
    }
    return '';
}

function handle_toggle_pin(): string {
    $pin_id = intval($_POST['post_id'] ?? 0);
    $json_file = __DIR__ . '/../announcements.json';
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
            return 'Announcement pin updated.';
        }
    }
    return '';
}

function handle_create_event(): array {
    $ev_title = trim($_POST['event_title'] ?? '');
    $ev_date = trim($_POST['event_date'] ?? '');
    $ev_time = trim($_POST['event_time'] ?? '');
    $ev_location = trim($_POST['event_location'] ?? '');

    if ($ev_title === '' || $ev_date === '') {
        return ['error' => 'Event title and date are required.'];
    } else {
        $events_file = __DIR__ . '/../events.json';
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
        return ['success' => 'Event added successfully.'];
    }
}

function handle_delete_event(): string {
    $delete_event_id = $_POST['event_id'] ?? '';
    $events_file = __DIR__ . '/../events.json';
    $events_data = file_exists($events_file) ? json_decode(file_get_contents($events_file), true) : [];

    if (is_array($events_data)) {
        $events_data = array_values(array_filter($events_data, fn($e) => (string)($e['id'] ?? '') !== (string)$delete_event_id));
        file_put_contents($events_file, json_encode($events_data, JSON_PRETTY_PRINT));
        return 'Event deleted.';
    }
    return '';
}

function handle_create_custom_role(PDO $pdo): array {
    $role_name = trim($_POST['role_name'] ?? '');
    $color1    = trim($_POST['role_color1'] ?? '#3096C7');
    $color2    = trim($_POST['role_color2'] ?? '');
    $isGradient = isset($_POST['role_is_gradient']) && $color2 !== '';
    $textColor = ($_POST['role_text_color'] ?? 'white') === 'black' ? '#111111' : '#ffffff';

    if ($role_name === '') {
        return ['error' => 'Role name is required.'];
    } elseif (!preg_match('/^#[0-9a-fA-F]{6}$/', $color1) || ($isGradient && !preg_match('/^#[0-9a-fA-F]{6}$/', $color2))) {
        return ['error' => 'Invalid color value.'];
    } else {
        $colorCss = $isGradient ? "linear-gradient(90deg, {$color1}, {$color2})" : $color1;
        try {
            $stmt = $pdo->prepare('INSERT INTO custom_roles (name, color_css, text_color) VALUES (:n, :c, :t)');
            $stmt->execute([':n' => $role_name, ':c' => $colorCss, ':t' => $textColor]);
            return ['success' => 'Custom role "' . $role_name . '" created.'];
        } catch (PDOException $e) {
            return ['error' => 'A role with that name already exists.'];
        }
    }
}

function handle_delete_custom_role(PDO $pdo): string {
    $roleId = (int) ($_POST['role_id'] ?? 0);
    if ($roleId > 0) {
        $stmt = $pdo->prepare('DELETE FROM custom_roles WHERE id = :id');
        $stmt->execute([':id' => $roleId]);
        return 'Custom role deleted.';
    }
    return '';
}

function handle_update_user_role(PDO $pdo): array {
    $userId   = (int) ($_POST['user_id'] ?? 0);
    $mainRole = $_POST['main_role'] ?? 'MEMBER';

    if ($userId <= 0) {
        return ['error' => 'No user selected.'];
    } elseif (!in_array($mainRole, MAIN_ROLES, true)) {
        return ['error' => 'Invalid main role.'];
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

        return ['success' => 'Role updated.'];
    }
}

function handle_delete_user(PDO $pdo): array {
    $targetId = (int) ($_POST['user_id'] ?? 0);

    $stmt = $pdo->prepare('SELECT id, username, ip_address FROM users WHERE id = :id');
    $stmt->execute([':id' => $targetId]);
    $target = $stmt->fetch();

    if (!$target) {
        return ['error' => 'That account no longer exists.'];
    } else {
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
            return [
                'success' => 'Account "' . $target['username'] . '" deleted.',
                'deleted_user_ip' => $target['ip_address'],
                'deleted_user_username' => $target['username']
            ];
        } catch (PDOException $e) {
            $pdo->rollBack();
            return ['error' => 'Failed to delete account: ' . $e->getMessage()];
        }
    }
}

function handle_ban_ip(PDO $pdo): array {
    $me_check = current_admin();
    $banIp = trim($_POST['ip_address'] ?? '');
    $banReason = trim($_POST['ban_reason'] ?? '');

    if ($banIp === '' || $banIp === 'Unknown') {
        return ['error' => 'No IP address on file for that account — nothing to ban.'];
    } else {
        try {
            $stmt = $pdo->prepare('INSERT INTO banned_ips (ip_address, reason, banned_by) VALUES (:ip, :r, :b)');
            $stmt->execute([
                ':ip' => $banIp,
                ':r'  => $banReason !== '' ? $banReason : null,
                ':b'  => $me_check['username'] ?? null,
            ]);
            return ['success' => 'IP address ' . htmlspecialchars($banIp) . ' banned from signing up.'];
        } catch (PDOException $e) {
            return ['error' => 'That IP is already banned.'];
        }
    }
}

function handle_unban_ip(PDO $pdo): string {
    $banId = (int) ($_POST['ban_id'] ?? 0);
    $pdo->prepare('DELETE FROM banned_ips WHERE id = :id')->execute([':id' => $banId]);
    return 'IP address unbanned.';
}

function handle_create_admin(PDO $pdo): array {
    $me_check = current_admin();
    if (!$me_check['is_main']) {
        return ['error' => 'Only the main account can add admin accounts.'];
    } else {
        $newUser = trim($_POST['new_admin_username'] ?? '');
        $newPass = $_POST['new_admin_password'] ?? '';

        if ($newUser === '' || $newPass === '') {
            return ['error' => 'Username and password are required.'];
        } elseif (strlen($newPass) < 6) {
            return ['error' => 'Password must be at least 6 characters.'];
        } else {
            try {
                $stmt = $pdo->prepare('INSERT INTO admin_accounts (username, password_hash, is_main) VALUES (:u, :p, 0)');
                $stmt->execute([':u' => $newUser, ':p' => password_hash($newPass, PASSWORD_DEFAULT)]);
                return ['success' => 'Admin account "' . htmlspecialchars($newUser) . '" created.'];
            } catch (PDOException $e) {
                return ['error' => 'That username is already taken.'];
            }
        }
    }
}

function handle_delete_admin(PDO $pdo): array {
    $me_check = current_admin();
    if (!$me_check['is_main']) {
        return ['error' => 'Only the main account can remove admin accounts.'];
    } else {
        $delId = (int) ($_POST['admin_id'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM admin_accounts WHERE id = :id');
        $stmt->execute([':id' => $delId]);
        $target = $stmt->fetch();

        if (!$target) {
            return ['error' => 'Admin account not found.'];
        } elseif ((int) $target['is_main'] === 1) {
            return ['error' => 'The main account cannot be removed.'];
        } else {
            $pdo->prepare('DELETE FROM admin_accounts WHERE id = :id')->execute([':id' => $delId]);
            return ['success' => 'Admin account removed.'];
        }
    }
}

function handle_change_password(PDO $pdo): array {
    $me_check = current_admin();
    $current = $_POST['current_password'] ?? '';
    $new = $_POST['new_password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    $stmt = $pdo->prepare('SELECT password_hash FROM admin_accounts WHERE id = :id');
    $stmt->execute([':id' => $me_check['id']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($current, $row['password_hash'])) {
        return ['error' => 'Current password is incorrect.'];
    } elseif (strlen($new) < 6) {
        return ['error' => 'New password must be at least 6 characters.'];
    } elseif ($new !== $confirm) {
        return ['error' => 'New passwords do not match.'];
    } else {
        $pdo->prepare('UPDATE admin_accounts SET password_hash = :p WHERE id = :id')
            ->execute([':p' => password_hash($new, PASSWORD_DEFAULT), ':id' => $me_check['id']]);
        return ['success' => 'Password updated.'];
    }
}

/**
 * Notify a creation's submitter (+ collaborators, if any) about a review
 * decision. Best-effort: a failed insert must never block moderation.
 */
function notify_creation_people(PDO $pdo, array $row, string $type, string $submitterText, string $collabText, ?string $reason = null): void {
    $targets = [(int) $row['submitted_by'] => $submitterText];
    $decoded = json_decode($row['collaborators'] ?? '[]', true);
    if (is_array($decoded)) {
        foreach ($decoded as $cid) {
            $cid = (int) $cid;
            if ($cid > 0 && $cid !== (int) $row['submitted_by']) {
                $targets[$cid] = $collabText;
            }
        }
    }
    foreach ($targets as $uid => $text) {
        try {
            create_notification($pdo, $uid, $type, null, [
                'text' => $text,
                'title' => $row['title'],
                'reason' => $reason,
                'creationId' => (int) $row['id'],
            ]);
        } catch (PDOException $e) {
        }
    }
}

function handle_creation_review(PDO $pdo): array {
    $creationId = (int) ($_POST['creation_id'] ?? 0);
    $decision = $_POST['decision'] ?? '';
    $reason = trim($_POST['rejection_reason'] ?? '');

    if ($creationId <= 0) {
        return ['error' => 'No creation selected.'];
    }
    if (!in_array($decision, ['approve', 'reject'], true)) {
        return ['error' => 'Invalid review decision.'];
    }

    $stmt = $pdo->prepare('SELECT id, title, status, submitted_by, collaborators FROM creations WHERE id = :id');
    $stmt->execute([':id' => $creationId]);
    $row = $stmt->fetch();
    if (!$row) {
        return ['error' => 'That creation no longer exists.'];
    }

    if ($decision === 'approve') {
        $pdo->prepare(
            "UPDATE creations SET status = 'approved', rejection_reason = NULL, updated_at = datetime('now') WHERE id = :id"
        )->execute([':id' => $creationId]);
        notify_creation_people(
            $pdo,
            $row,
            'creation_approved',
            'Your project "' . $row['title'] . '" was approved and is now live in the Creations Hub.',
            '"' . $row['title'] . '", a project you collaborated on, was approved and is now live in the Creations Hub.'
        );
        return ['success' => 'Creation "' . $row['title'] . '" approved — it is now live in the hub.'];
    }

    $pdo->prepare(
        "UPDATE creations SET status = 'rejected', rejection_reason = :r, updated_at = datetime('now') WHERE id = :id"
    )->execute([':id' => $creationId, ':r' => $reason !== '' ? $reason : null]);
    $reasonSuffix = $reason !== ''
        ? ' Reason given: "' . $reason . '".'
        : ' You can revise and resubmit.';
    notify_creation_people(
        $pdo,
        $row,
        'creation_rejected',
        'Your project "' . $row['title'] . '" was not approved.' . $reasonSuffix,
        '"' . $row['title'] . '", a project you collaborated on, was not approved.' . $reasonSuffix,
        $reason !== '' ? $reason : null
    );
    return ['success' => 'Creation "' . $row['title'] . '" rejected.'];
}

function handle_creation_feature(PDO $pdo): array {
    $creationId = (int) ($_POST['creation_id'] ?? 0);
    $period = $_POST['featured_period'] ?? '';
    $award = trim($_POST['award'] ?? '');

    if ($creationId <= 0) {
        return ['error' => 'No creation selected.'];
    }

    $stmt = $pdo->prepare('SELECT id, title, status FROM creations WHERE id = :id');
    $stmt->execute([':id' => $creationId]);
    $row = $stmt->fetch();
    if (!$row) {
        return ['error' => 'That creation no longer exists.'];
    }
    if ($row['status'] !== 'approved') {
        return ['error' => 'Only approved creations can be featured. Approve it first.'];
    }

    // Empty period = unfeature. Also drop the award label if it was just the
    // auto-derived "Creation of the <Period>" text so it doesn't linger on
    // a non-featured entry; a custom award label is kept.
    if ($period === '' || $period === 'none') {
        $pdo->prepare(
            "UPDATE creations
             SET featured_period = NULL, featured_at = NULL,
                 award = CASE WHEN award LIKE 'Creation of the %' THEN NULL ELSE award END,
                 updated_at = datetime('now')
             WHERE id = :id"
        )->execute([':id' => $creationId]);
        return ['success' => 'Creation "' . $row['title'] . '" removed from the spotlight.'];
    }

    if (!in_array($period, ['week', 'month', 'year'], true)) {
        return ['error' => 'Invalid spotlight period.'];
    }
    if (mb_strlen($award) > 80) {
        return ['error' => 'Award label is too long (max 80 characters).'];
    }

    $pdo->prepare(
        "UPDATE creations
         SET featured_period = :p, featured_at = datetime('now'), award = :a, updated_at = datetime('now')
         WHERE id = :id"
    )->execute([':id' => $creationId, ':p' => $period, ':a' => $award !== '' ? $award : null]);
    return ['success' => 'Creation "' . $row['title'] . '" is now featured as creation of the ' . $period . '.'];
}

function handle_creation_delete(PDO $pdo): array {
    $creationId = (int) ($_POST['creation_id'] ?? 0);
    if ($creationId <= 0) {
        return ['error' => 'No creation selected.'];
    }

    $stmt = $pdo->prepare('SELECT id, title, media_urls FROM creations WHERE id = :id');
    $stmt->execute([':id' => $creationId]);
    $row = $stmt->fetch();
    if (!$row) {
        return ['error' => 'That creation no longer exists.'];
    }

    // Remove orphaned upload files so deleted entries leave nothing behind.
    $mediaUrls = json_decode($row['media_urls'] ?? '[]', true);
    if (is_array($mediaUrls)) {
        foreach ($mediaUrls as $u) {
            if (!is_string($u) || !str_starts_with($u, '/uploads/creations/') || str_contains($u, '..')) {
                continue;
            }
            $uploadsBase = realpath(__DIR__ . '/../uploads/creations');
            $full = $uploadsBase ? realpath($uploadsBase . '/' . basename($u)) : false;
            if ($full && $uploadsBase && str_starts_with($full, $uploadsBase) && is_file($full)) {
                @unlink($full);
            }
        }
    }

    $pdo->prepare('DELETE FROM creations WHERE id = :id')->execute([':id' => $creationId]);
    return ['success' => 'Creation "' . $row['title'] . '" deleted.'];
}

function handle_post_actions(PDO $pdo): array {
    $result = [];
    
    if (isset($_POST['action']) && $_POST['action'] === 'create' && is_logged_in()) {
        $announcement_result = handle_create_announcement($pdo);
        if (isset($announcement_result['success'])) $result['success'] = $announcement_result['success'];
        if (isset($announcement_result['error'])) $result['error'] = $announcement_result['error'];
        if (isset($announcement_result['upload_debug'])) $result['upload_debug'] = $announcement_result['upload_debug'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'delete' && is_logged_in()) {
        $result['success'] = handle_delete_announcement($pdo);
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'toggle_pin' && is_logged_in()) {
        $result['success'] = handle_toggle_pin();
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'create_event' && is_logged_in()) {
        $event_result = handle_create_event();
        if (isset($event_result['success'])) $result['event_success'] = $event_result['success'];
        if (isset($event_result['error'])) $result['event_error'] = $event_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'delete_event' && is_logged_in()) {
        $result['event_success'] = handle_delete_event();
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'create_custom_role' && is_logged_in()) {
        $role_result = handle_create_custom_role($pdo);
        if (isset($role_result['success'])) $result['role_success'] = $role_result['success'];
        if (isset($role_result['error'])) $result['role_error'] = $role_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'delete_custom_role' && is_logged_in()) {
        $result['role_success'] = handle_delete_custom_role($pdo);
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'update_user_role' && is_logged_in()) {
        $user_role_result = handle_update_user_role($pdo);
        if (isset($user_role_result['success'])) $result['user_role_success'] = $user_role_result['success'];
        if (isset($user_role_result['error'])) $result['user_role_error'] = $user_role_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'delete_user' && is_logged_in()) {
        $user_mgmt_result = handle_delete_user($pdo);
        if (isset($user_mgmt_result['success'])) $result['user_mgmt_success'] = $user_mgmt_result['success'];
        if (isset($user_mgmt_result['error'])) $result['user_mgmt_error'] = $user_mgmt_result['error'];
        if (isset($user_mgmt_result['deleted_user_ip'])) $result['deleted_user_ip'] = $user_mgmt_result['deleted_user_ip'];
        if (isset($user_mgmt_result['deleted_user_username'])) $result['deleted_user_username'] = $user_mgmt_result['deleted_user_username'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'ban_ip' && is_logged_in()) {
        $ban_result = handle_ban_ip($pdo);
        if (isset($ban_result['success'])) $result['user_mgmt_success'] = $ban_result['success'];
        if (isset($ban_result['error'])) $result['user_mgmt_error'] = $ban_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'unban_ip' && is_logged_in()) {
        $result['user_mgmt_success'] = handle_unban_ip($pdo);
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'create_admin' && is_logged_in()) {
        $admin_result = handle_create_admin($pdo);
        if (isset($admin_result['success'])) $result['admin_mgmt_success'] = $admin_result['success'];
        if (isset($admin_result['error'])) $result['admin_mgmt_error'] = $admin_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'delete_admin' && is_logged_in()) {
        $admin_result = handle_delete_admin($pdo);
        if (isset($admin_result['success'])) $result['admin_mgmt_success'] = $admin_result['success'];
        if (isset($admin_result['error'])) $result['admin_mgmt_error'] = $admin_result['error'];
    }
    
    if (isset($_POST['action']) && $_POST['action'] === 'change_password' && is_logged_in()) {
        $account_result = handle_change_password($pdo);
        if (isset($account_result['success'])) $result['account_success'] = $account_result['success'];
        if (isset($account_result['error'])) $result['account_error'] = $account_result['error'];
    }

    if (isset($_POST['action']) && $_POST['action'] === 'creation_review' && is_logged_in()) {
        $creation_result = handle_creation_review($pdo);
        if (isset($creation_result['success'])) $result['creation_success'] = $creation_result['success'];
        if (isset($creation_result['error'])) $result['creation_error'] = $creation_result['error'];
    }

    if (isset($_POST['action']) && $_POST['action'] === 'creation_feature' && is_logged_in()) {
        $creation_result = handle_creation_feature($pdo);
        if (isset($creation_result['success'])) $result['creation_success'] = $creation_result['success'];
        if (isset($creation_result['error'])) $result['creation_error'] = $creation_result['error'];
    }

    if (isset($_POST['action']) && $_POST['action'] === 'creation_delete' && is_logged_in()) {
        $creation_result = handle_creation_delete($pdo);
        if (isset($creation_result['success'])) $result['creation_success'] = $creation_result['success'];
        if (isset($creation_result['error'])) $result['creation_error'] = $creation_result['error'];
    }

    return $result;
}
