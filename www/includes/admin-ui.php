<?php
/**
 * admin-ui.php — UI helper functions for the admin panel
 */

declare(strict_types=1);

function admin_icon(string $name): string {
    $icons = [
        'overview'  => '<path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>',
        'announce'  => '<path d="M3 11v2a1 1 0 0 0 1 1h1l3.5 5.5 1.5-.7L7.7 14H11l7 4V6l-7 4H3a1 1 0 0 0 0 2z"/>',
        'events'    => '<g fill="none" stroke-width="1.7"><path d="M7 2v3M17 2v3M3.5 9h17"/><rect x="4" y="5" width="16" height="15" rx="1"/></g>',
        'users'     => '<g><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" fill="none" stroke-width="1.7"/><circle cx="17.5" cy="9" r="2.4" fill="none" stroke-width="1.5"/><path d="M15.3 13.4c2.7.3 4.7 2.5 4.7 5.4" fill="none" stroke-width="1.5"/></g>',
        'accounts'  => '<g fill="none" stroke-width="1.6"><path d="M12 2l7 3.2v5.4c0 4.8-3 8.9-7 10.4-4-1.5-7-5.6-7-10.4V5.2L12 2z"/><path d="M8.7 12l2.3 2.3 4.3-4.6"/></g>',
        'moderation'=> '<g fill="none" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M5.8 5.8l12.4 12.4"/></g>',
        'creations' => '<g fill="none" stroke-width="1.7"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></g>',
        'resources' => '<g fill="none" stroke-width="1.7"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></g>',
        'intervention' => '<g fill="none" stroke-width="1.7"><path d="M9 11l2.2 2.2L15.5 9"/><path d="M6 3h9l4 4v14H6V3z"/><path d="M15 3v4h4"/></g>',
        'feedback' => '<g fill="none" stroke-width="1.7"><path d="M4 5h16v10H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/></g>',
        'account'   => '<g fill="none" stroke-width="1.7"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.3-7 7.5-7s7.5 2.9 7.5 7"/></g>',
        'logout'    => '<g fill="none" stroke-width="1.7"><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M13 8l4.5 4-4.5 4M9.3 12h8"/></g>',
        'menu'      => '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke-width="1.8" fill="none"/>',
        'close'     => '<path d="M5 5l14 14M19 5L5 19" stroke-width="1.8" fill="none"/>',
    ];
    $body = $icons[$name] ?? '';
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" class="icon icon-' . htmlspecialchars($name) . '">' . $body . '</svg>';
}

function get_default_tab(): string {
    $default_tab = 'overview';
    if (isset($_POST['action'])) {
        if (in_array($_POST['action'], ['create', 'delete'])) {
            $default_tab = 'announcements';
        }
        if (in_array($_POST['action'], ['create_event', 'delete_event'])) {
            $default_tab = 'events';
        }
        if (in_array($_POST['action'], ['create_custom_role', 'delete_custom_role', 'update_user_role'])) {
            $default_tab = 'users';
        }
        if (in_array($_POST['action'], ['delete_user', 'ban_ip', 'unban_ip'])) {
            $default_tab = 'moderation';
        }
        if (in_array($_POST['action'], ['create_admin', 'delete_admin'])) {
            $default_tab = 'accounts';
        }
        if ($_POST['action'] === 'change_password') {
            $default_tab = 'account';
        }
        if (in_array($_POST['action'], ['creation_review', 'creation_feature', 'creation_delete'])) {
            $default_tab = 'creations';
        }
        if (in_array($_POST['action'], ['resource_review', 'resource_feature', 'resource_delete', 'resource_seed'])) {
            $default_tab = 'resources';
        }
        if (in_array($_POST['action'], ['intervention_toggle', 'intervention_test_save', 'intervention_test_delete', 'intervention_result_delete', 'intervention_export'])) {
            $default_tab = 'intervention';
        }
        if (in_array($_POST['action'], ['feedback_toggle', 'feedback_delete', 'feedback_export'])) {
            $default_tab = 'feedback';
        }
    }
    return $default_tab;
}

/**
 * Renders one creation submission as a review card for the admin panel's
 * Creations tab. $c is a raw creations row with `username` joined in.
 * Forms post back to admin.php (actions handled in admin-handlers.php).
 */
function creation_admin_card(array $c, string $csrf): string {
    $e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
    $id = (int) $c['id'];
    $status = $c['status'] ?? 'pending';
    $catLabel = CREATION_CATEGORY_LABELS[$c['category'] ?? 'other'] ?? 'Other';

    $tools = json_decode($c['tools_used'] ?? '[]', true);
    if (!is_array($tools)) $tools = [];
    $media = json_decode($c['media_urls'] ?? '[]', true);
    if (!is_array($media)) $media = [];

    $meta = [];
    $meta[] = 'by ' . ($c['username'] ?? 'unknown');
    $meta[] = $catLabel;
    if (!empty($c['batch'])) $meta[] = 'A.Y. ' . $c['batch'];
    if (!empty($c['created_at'])) $meta[] = date('M j, Y', strtotime($c['created_at']));

    $html = '<div class="post-card" style="margin-bottom: 12px;">';
    $html .= '<div class="post-date">' . $e(implode(' · ', $meta)) . ' · <strong>' . $e($status) . '</strong></div>';
    $html .= '<div class="post-body" style="font-weight: 600; font-size: 1.02rem;">' . $e($c['title']) . '</div>';
    // Descriptions are sanitized to inline formatting at submit time, so
    // they render as HTML here (titles stay escaped above).
    $html .= '<div class="post-body">' . ($c['description'] ?? '') . '</div>';

    if (!empty($tools)) {
        $html .= '<div class="post-body" style="color: var(--muted); font-size: .85rem;">Tools: ' . $e(implode(', ', $tools)) . '</div>';
    }
    if (!empty($c['external_link'])) {
        $html .= '<div class="post-body"><a href="' . $e($c['external_link']) . '" target="_blank" rel="noopener">' . $e($c['external_link']) . '</a></div>';
    }
    if (!empty($c['video_url'])) {
        $html .= '<div class="post-body">Demo video: <a href="' . $e($c['video_url']) . '" target="_blank" rel="noopener">' . $e($c['video_url']) . '</a></div>';
    }
    $links = json_decode($c['links'] ?? '[]', true);
    if (is_array($links) && !empty($links)) {
        $pairs = [];
        foreach ($links as $l) {
            if (is_array($l) && !empty($l['label']) && !empty($l['url'])) {
                $pairs[] = $e($l['label']) . ': ' . $e($l['url']);
            }
        }
        if (!empty($pairs)) {
            $html .= '<div class="post-body" style="color: var(--muted); font-size: .85rem;">Links: ' . implode(' · ', $pairs) . '</div>';
        }
    }
    if (!empty($c['collab_names'])) {
        $html .= '<div class="post-body" style="color: var(--muted); font-size: .85rem;">With: ' . $e(implode(', ', $c['collab_names'])) . '</div>';
    }
    if (!empty($media)) {
        $html .= '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">';
        foreach (array_slice($media, 0, 10) as $u) {
            if (!is_string($u) || $u === '') continue;
            $html .= '<a href="' . $e($u) . '" target="_blank" rel="noopener"><img src="' . $e($u) . '" alt="" style="width: 96px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);"></a>';
        }
        $html .= '</div>';
    }
    if ($status === 'rejected' && !empty($c['rejection_reason'])) {
        $html .= '<div class="post-body" style="color: var(--warning);">Rejection reason: ' . $e($c['rejection_reason']) . '</div>';
    }
    if (!empty($c['featured_period'])) {
        $html .= '<div class="post-body" style="color: var(--accent2);">Featured: creation of the ' . $e($c['featured_period']);
        if (!empty($c['award'])) $html .= ' · ' . $e($c['award']);
        $html .= '</div>';
    }

    $html .= '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">';

    if ($status !== 'approved') {
        $html .= '<form method="POST" style="display: inline;">'
            . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
            . '<input type="hidden" name="action" value="creation_review">'
            . '<input type="hidden" name="creation_id" value="' . $id . '">'
            . '<input type="hidden" name="decision" value="approve">'
            . '<button type="submit" class="btn-submit">Approve</button></form>';
        $html .= '<form method="POST" style="display: flex; gap: 6px; flex: 1 1 220px;" onsubmit="return confirm(\'Reject this submission?\');">'
            . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
            . '<input type="hidden" name="action" value="creation_review">'
            . '<input type="hidden" name="creation_id" value="' . $id . '">'
            . '<input type="hidden" name="decision" value="reject">'
            . '<input class="field-input" type="text" name="rejection_reason" placeholder="Reason (optional)" style="flex: 1;">'
            . '<button type="submit" class="delete-btn">Reject</button></form>';
    } else {
        if (empty($c['featured_period'])) {
            $html .= '<form method="POST" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;">'
                . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
                . '<input type="hidden" name="action" value="creation_feature">'
                . '<input type="hidden" name="creation_id" value="' . $id . '">'
                . '<select class="field-input" name="featured_period" style="width: auto;">'
                . '<option value="week">Week</option><option value="month">Month</option><option value="year">Year</option>'
                . '</select>'
                . '<input class="field-input" type="text" name="award" maxlength="80" placeholder="Award label (optional)" style="flex: 1; min-width: 160px;">'
                . '<button type="submit" class="edit-btn">Feature</button></form>';
        } else {
            $html .= '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Remove this from the spotlight?\');">'
                . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
                . '<input type="hidden" name="action" value="creation_feature">'
                . '<input type="hidden" name="creation_id" value="' . $id . '">'
                . '<input type="hidden" name="featured_period" value="none">'
                . '<button type="submit" class="edit-btn">Unfeature</button></form>';
        }
    }

    $html .= '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Permanently delete this creation? Its uploaded images will also be removed. This cannot be undone.\');">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="creation_delete">'
        . '<input type="hidden" name="creation_id" value="' . $id . '">'
        . '<button type="submit" class="delete-btn">Delete</button></form>';

    $html .= '</div></div>';
    return $html;
}

/**
 * Renders one resource as a review card for the admin panel's Resources
 * tab. $r is a raw resources row with `username` joined in (NULL username =
 * staff-seeded). Descriptions are plain text — always escaped. Forms post
 * back to admin.php (actions handled in admin-handlers.php).
 */
function resource_admin_card(array $r, string $csrf): string {
    $e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
    $id = (int) $r['id'];
    $status = $r['status'] ?? 'pending';
    $catLabel = (defined('RESOURCE_CATEGORY_LABELS') ? RESOURCE_CATEGORY_LABELS : [])[$r['category'] ?? 'other'] ?? 'Other ICT';
    $typeLabel = (defined('RESOURCE_TYPE_LABELS') ? RESOURCE_TYPE_LABELS : [])[$r['type'] ?? 'website'] ?? 'Website';

    $tags = json_decode($r['tags'] ?? '[]', true);
    if (!is_array($tags)) $tags = [];

    $suggester = $r['username'] ?? ($r['submitted_by'] === null ? 'Aghimuan Staff' : 'unknown');
    $meta = [];
    $meta[] = 'by ' . $suggester;
    $meta[] = $catLabel . ' · ' . $typeLabel;
    if (!empty($r['created_at'])) $meta[] = date('M j, Y', strtotime($r['created_at']));

    $html = '<div class="post-card" style="margin-bottom: 12px;">';
    $html .= '<div class="post-date">' . $e(implode(' · ', $meta)) . ' · <strong>' . $e($status) . '</strong></div>';
    $html .= '<div class="post-body" style="font-weight: 600; font-size: 1.02rem;">' . $e($r['title']) . '</div>';
    $hasImage = function_exists('is_valid_resource_image_url') && is_valid_resource_image_url($r['image_url'] ?? null);
    if ($hasImage) {
        $html .= '<div class="post-body"><img src="' . $e($r['image_url']) . '" alt="" loading="lazy" style="max-width: 100%; max-height: 160px; border-radius: 8px; border: 1px solid var(--glass-border);"></div>';
    }
    $html .= '<div class="post-body">' . $e($r['description']) . '</div>';

    if (!empty($r['url'])) {
        $html .= '<div class="post-body"><a href="' . $e($r['url']) . '" target="_blank" rel="noopener">' . $e($r['url']) . '</a></div>';
    }
    if (!empty($tags)) {
        $html .= '<div class="post-body" style="color: var(--muted); font-size: .85rem;">Tags: ' . $e(implode(', ', $tags)) . '</div>';
    }
    if ($status === 'rejected' && !empty($r['rejection_reason'])) {
        $html .= '<div class="post-body" style="color: var(--warning);">Rejection reason: ' . $e($r['rejection_reason']) . '</div>';
    }
    if (!empty($r['featured'])) {
        $html .= '<div class="post-body" style="color: var(--accent2);">Staff pick</div>';
    }

    $html .= '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">';

    $html .= '<form method="POST" enctype="multipart/form-data" style="display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap;">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="resource_image">'
        . '<input type="hidden" name="resource_id" value="' . $id . '">'
        . '<input type="hidden" name="image_action" value="replace">'
        . '<input class="field-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" style="max-width: 230px;">'
        . '<button type="submit" class="edit-btn">' . ($hasImage ? 'Replace cover' : 'Add cover') . '</button></form>';
    if ($hasImage) {
        $html .= '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Remove the cover image? The card falls back to its letter tile.\');">'
            . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
            . '<input type="hidden" name="action" value="resource_image">'
            . '<input type="hidden" name="resource_id" value="' . $id . '">'
            . '<input type="hidden" name="image_action" value="remove">'
            . '<button type="submit" class="delete-btn">Remove cover</button></form>';
    }

    if ($status !== 'approved') {
        $html .= '<form method="POST" style="display: inline;">'
            . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
            . '<input type="hidden" name="action" value="resource_review">'
            . '<input type="hidden" name="resource_id" value="' . $id . '">'
            . '<input type="hidden" name="decision" value="approve">'
            . '<button type="submit" class="btn-submit">Approve</button></form>';
        $html .= '<form method="POST" style="display: flex; gap: 6px; flex: 1 1 220px;" onsubmit="return confirm(\'Reject this suggestion?\');">'
            . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
            . '<input type="hidden" name="action" value="resource_review">'
            . '<input type="hidden" name="resource_id" value="' . $id . '">'
            . '<input type="hidden" name="decision" value="reject">'
            . '<input class="field-input" type="text" name="rejection_reason" placeholder="Reason (optional)" style="flex: 1;">'
            . '<button type="submit" class="delete-btn">Reject</button></form>';
    } else {
        if (empty($r['featured'])) {
            $html .= '<form method="POST" style="display: inline;">'
                . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
                . '<input type="hidden" name="action" value="resource_feature">'
                . '<input type="hidden" name="resource_id" value="' . $id . '">'
                . '<input type="hidden" name="featured" value="1">'
                . '<button type="submit" class="edit-btn">Make staff pick</button></form>';
        } else {
            $html .= '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Remove this from staff picks?\');">'
                . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
                . '<input type="hidden" name="action" value="resource_feature">'
                . '<input type="hidden" name="resource_id" value="' . $id . '">'
                . '<input type="hidden" name="featured" value="none">'
                . '<button type="submit" class="edit-btn">Unfeature</button></form>';
        }
    }

    $html .= '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Permanently delete this resource? This cannot be undone.\');">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="resource_delete">'
        . '<input type="hidden" name="resource_id" value="' . $id . '">'
        . '<button type="submit" class="delete-btn">Delete</button></form>';

    $html .= '</div></div>';
    return $html;
}

/**
 * Renders one intervention test as an edit card. $t is a raw
 * intervention_tests row with `qcount` joined in; $questionsText is the
 * textarea serialization from intervention_questions_to_text().
 */
function intervention_test_card(array $t, string $csrf, string $questionsText): string {
    $e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
    $id = (int) $t['id'];
    $active = !empty($t['is_active']);
    $maxa = (int) ($t['max_attempts'] ?? 0);

    $subjectOpts = '';
    foreach (['CP', 'CSS', 'ET'] as $s) {
        $sel = ($t['subject'] ?? '') === $s ? ' selected' : '';
        $subjectOpts .= '<option value="' . $s . '"' . $sel . '>' . $s . '</option>';
    }
    $gradeOpts = '';
    foreach (['G11', 'G12', 'JHS'] as $g) {
        $sel = ($t['grade_label'] ?? '') === $g ? ' selected' : '';
        $gradeOpts .= '<option value="' . $g . '"' . $sel . '>' . $g . '</option>';
    }

    $html = '<div class="post-card" style="margin-bottom: 12px;">';
    $html .= '<div class="post-date">' . $e($t['subject'] ?? '') . ' · ' . $e($t['grade_label'] ?? '')
        . ' · Part ' . (int) ($t['part'] ?? 1) . ' · <strong>' . ($active ? 'active' : 'hidden') . '</strong></div>';
    $html .= '<div class="post-body" style="font-weight: 600; font-size: 1.02rem;">' . $e($t['title']) . '</div>';
    $html .= '<div class="post-body" style="color: var(--muted); font-size: .85rem;">slug: ' . $e($t['slug'] ?? '')
        . ' · ' . (int) ($t['qcount'] ?? 0) . ' item(s) · ' . $e(intervention_band_scale((int) ($t['mcqcount'] ?? $t['qcount'] ?? 0)))
        . ' · attempts: ' . ($maxa > 0 ? $maxa . ' per student' : 'unlimited') . '</div>';

    $html .= '<form method="POST" style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="intervention_test_save">'
        . '<input type="hidden" name="test_id" value="' . $id . '">'
        . '<div style="display: flex; gap: 8px; flex-wrap: wrap;">'
        . '<input class="field-input" type="text" name="title" maxlength="120" value="' . $e($t['title'] ?? '') . '" placeholder="Title" required style="flex: 2; min-width: 200px;">'
        . '<input class="field-input" type="text" name="slug" maxlength="40" value="' . $e($t['slug'] ?? '') . '" placeholder="slug" required style="flex: 1; min-width: 140px;">'
        . '</div>'
        . '<div style="display: flex; gap: 8px; flex-wrap: wrap;">'
        . '<select class="field-input" name="subject" style="flex: 1; min-width: 100px;">' . $subjectOpts . '</select>'
        . '<select class="field-input" name="grade_label" style="flex: 1; min-width: 100px;">' . $gradeOpts . '</select>'
        . '<input class="field-input" type="number" name="part" min="1" max="9" value="' . (int) ($t['part'] ?? 1) . '" title="Part" style="flex: 1; min-width: 80px;">'
        . '<input class="field-input" type="number" name="max_attempts" min="0" max="99" value="' . $maxa . '" title="Max attempts (0 = unlimited)" style="flex: 1; min-width: 120px;">'
        . '</div>'
        . '<label style="font-size: .85rem; color: var(--muted);"><input type="checkbox" name="is_active" value="1"' . ($active ? ' checked' : '') . '> Visible to students (when program is live)</label>'
        . '<textarea class="field-input" name="questions_text" rows="8" style="font-family: monospace; font-size: .8rem;" placeholder="One per line: question || A || B || C || [D] || LETTER. Or: question || written">' . $e($questionsText) . '</textarea>'
        . '<div style="display: flex; gap: 8px; flex-wrap: wrap;">'
        . '<button type="submit" class="btn-submit">Save Test</button>'
        . '</form>'
        . '<form method="POST" style="display: inline;" onsubmit="return confirm(\'Delete this test? Past results are kept, but the test itself is gone.\');">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="intervention_test_delete">'
        . '<input type="hidden" name="test_id" value="' . $id . '">'
        . '<button type="submit" class="delete-btn">Delete</button></form>'
        . '</div></div>';
    return $html;
}

/**
 * One submitted result as a table row. Written free-text answers render
 * beneath the score so teachers can grade them without opening the export.
 */
function intervention_result_row(array $r): string {
    $e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
    $html = '<tr data-test="' . (int) ($r['test_id'] ?? 0) . '">';
    $html .= '<td><input type="checkbox" name="result_ids[]" value="' . (int) $r['id'] . '"></td>';
    $html .= '<td style="white-space: nowrap;">' . $e($r['submitted_at'] ?? '') . '</td>';
    $html .= '<td>' . $e($r['email'] ?? '') . '<br><span style="color: var(--muted);">' . $e($r['full_name'] ?? '') . '</span></td>';
    $html .= '<td>' . $e($r['grade_level'] ?? '') . ' · ' . $e($r['section'] ?? '') . '</td>';
    $html .= '<td><strong>' . (int) ($r['correct'] ?? 0) . '/' . (int) ($r['total'] ?? 0) . '</strong>'
        . ' (' . $e((string) ($r['score_pct'] ?? '')) . '%)<br>';
    $level = intervention_level((int) ($r['correct'] ?? 0), max(1, (int) ($r['total'] ?? 0)))[0];
    $levelColor = $level === 'Mastered' ? 'var(--success)' : ($level === 'Struggling' ? 'var(--danger)' : 'var(--warning)');
    $html .= '<span style="color: ' . $levelColor . '; font-weight: 700;">' . $e($level) . '</span>'
        . ' <span style="color: var(--muted);">(' . (!empty($r['passed']) ? 'passed' : 'failed') . ')</span>';
    $viol = (int) ($r['violations'] ?? 0);
    if ($viol > 0) {
        $html .= '<br><span style="color: var(--warning);">tab-switch ×' . $viol . ' (−' . $viol . ')</span>';
    }
    $html .= '</td>';
    $written = [];
    $decoded = json_decode($r['answers_json'] ?? '', true);
    if (is_array($decoded)) {
        foreach ($decoded as $pos => $val) {
            $text = trim((string) $val);
            if ($text === '') continue;
            if (!(strlen($text) === 1 && in_array(strtoupper($text), ['A', 'B', 'C', 'D'], true))) {
                $written[] = 'Q' . ((int) $pos) . ': ' . mb_substr($text, 0, 300);
            }
        }
    }
    $html .= '<td style="max-width: 320px;">' . ($written ? $e(implode(' | ', $written)) : '<span style="color: var(--muted);">none</span>') . '</td>';
    $html .= '</tr>';
    return $html;
}

/**
 * One feedback response as a table row. Ratings render inline (with an
 * average), written answers hide inside <details> so the table stays
 * scannable. $csrf is the admin CSRF token for the per-row delete form.
 */
function feedback_response_row(array $r, string $csrf): string {
    $e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
    $answers = json_decode($r['answers_json'] ?? '{}', true);
    if (!is_array($answers)) $answers = [];

    $ratings = [];
    $sum = 0;
    foreach (['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10'] as $k) {
        $v = (int) ($answers[$k] ?? 0);
        if ($v >= 1 && $v <= 5) {
            $ratings[] = $v;
            $sum += $v;
        }
    }
    $avg = $ratings ? round($sum / count($ratings), 1) : '–';

    $html = '<tr>';
    $html .= '<td style="white-space: nowrap;">' . $e($r['updated_at'] ?? '') . '</td>';
    $html .= '<td><strong>' . $e($r['username'] !== '' ? $r['username'] : '(blank)') . '</strong>'
        . '<br><span style="color: var(--muted);">' . $e($r['email'] !== '' ? $r['email'] : '(blank)') . '</span></td>';
    $html .= '<td>' . $e(($r['grade'] ?? '') !== '' ? $r['grade'] : '–')
        . ' · ' . $e(($r['strand'] ?? '') !== '' ? $r['strand'] : '–') . '</td>';
    $html .= '<td style="white-space: nowrap;"><strong>avg ' . $e((string) $avg) . '</strong>'
        . '<br><span style="color: var(--muted); font-size: .78rem;">' . $e(implode('·', $ratings)) . '</span></td>';

    $written = [];
    foreach (['q11','q12','q13','q14','q15','q16','q17','q18'] as $k) {
        $text = trim((string) ($answers[$k] ?? ''));
        if ($text !== '') $written[$k] = mb_substr($text, 0, 2000);
    }
    $meta = [];
    foreach (['q19','q20','q23','q24'] as $k) {
        $text = trim((string) ($answers[$k] ?? ''));
        if ($text !== '') $meta[] = strtoupper($k) . ': ' . $text;
    }
    $cell = $meta ? '<div style="color: var(--muted); font-size: .78rem;">' . $e(implode(' · ', $meta)) . '</div>' : '';
    if ($written) {
        $cell .= '<details><summary style="cursor: pointer; color: var(--accent2); font-size: .82rem;">Written (' . count($written) . ')</summary>';
        foreach ($written as $k => $text) {
            $cell .= '<div style="margin-top: 6px;"><strong style="font-size: .78rem;">' . $e(strtoupper($k)) . '</strong>'
                . '<div style="white-space: pre-wrap; font-size: .82rem;">' . nl2br($e($text)) . '</div></div>';
        }
        $cell .= '</details>';
    } else {
        $cell .= '<span style="color: var(--muted);">no written answers</span>';
    }
    $html .= '<td style="max-width: 380px;">' . $cell . '</td>';

    $html .= '<td><form method="POST" onsubmit="return confirm(\'Delete this response? This cannot be undone.\');">'
        . '<input type="hidden" name="csrf_token" value="' . $e($csrf) . '">'
        . '<input type="hidden" name="action" value="feedback_delete">'
        . '<input type="hidden" name="result_id" value="' . (int) $r['id'] . '">'
        . '<button type="submit" class="delete-btn">Delete</button>'
        . '</form></td>';
    $html .= '</tr>';
    return $html;
}
