<?php
/**
 * app-config.php — SINGLE SOURCE OF TRUTH for shared constants.
 *
 * Edit values HERE. Everything else (api/*.php, includes/*.php,
 * js/aghi-config.js) reads from here.
 *
 * Why this file exists: the same 8 avatar ids, online timeouts, and
 * Firebase keys used to be copy-pasted in 15+ files. Change one copy,
 * forget another -> broken avatars / false offline dots. Now there's
 * only one copy.
 *
 * For frontend (.html / .js can't run PHP): run
 *   php scripts/sync-config.php
 * after editing this file. That regenerates www/js/aghi-config.js
 * from the values below, so PHP and JS can never drift apart.
 *
 * Jargon:
 * - `const` = a fixed value set once, never changes while running.
 * - `defined() guard` = "only define if not already defined" check,
 *   prevents PHP fatal error when two files define the same name.
 */

declare(strict_types=1);

// ---------------------------------------------------------------------
// Avatar presets (8 ids). Anything NOT in this list is treated as an
// uploaded filename under /uploads/pfp/.
// ---------------------------------------------------------------------
if (!defined('AGHI_PRESET_IDS')) {
    define('AGHI_PRESET_IDS', [
        'default', 'circuit-blue', 'circuit-cyan', 'node-teal',
        'spark-orange', 'wire-purple', 'chip-green', 'signal-pink',
    ]);
}

// Fill colors for preset avatars (monogram backgrounds).
if (!defined('AGHI_PRESET_COLORS')) {
    define('AGHI_PRESET_COLORS', [
        'default'      => '#5F5E5A',
        'circuit-blue' => '#185FA5',
        'circuit-cyan' => '#0F6E56',
        'node-teal'    => '#04342C',
        'spark-orange' => '#993C1D',
        'wire-purple'  => '#534AB7',
        'chip-green'   => '#3B6D11',
        'signal-pink'  => '#993556',
    ]);
}

// ---------------------------------------------------------------------
// Presence / session timing. IMPORTANT relationship:
// LAST_SEEN throttle (20s) MUST stay shorter than ONLINE threshold (45s),
// or users flicker offline while still browsing.
// ---------------------------------------------------------------------
if (!defined('AGHI_ONLINE_THRESHOLD_SECONDS')) {
    define('AGHI_ONLINE_THRESHOLD_SECONDS', 45);
}
if (!defined('AGHI_LAST_SEEN_THROTTLE_SECONDS')) {
    define('AGHI_LAST_SEEN_THROTTLE_SECONDS', 20);
}
if (!defined('AGHI_SESSION_LIFETIME_DAYS')) {
    define('AGHI_SESSION_LIFETIME_DAYS', 30);
}
if (!defined('AGHI_REVIEWER_SESSION_TTL')) {
    define('AGHI_REVIEWER_SESSION_TTL', 60 * 60 * 8); // 8 hours
}
if (!defined('AGHI_HEARTBEAT_INTERVAL_MS')) {
    define('AGHI_HEARTBEAT_INTERVAL_MS', 15 * 1000);
}
if (!defined('AGHI_TYPING_FRESHNESS_SECONDS')) {
    define('AGHI_TYPING_FRESHNESS_SECONDS', 5);
}

// ---------------------------------------------------------------------
// Firebase (Google sign-in only, no Admin SDK). apiKey here is a public
// browser key (meant to be visible) — security comes from server-side
// ID-token verification, not from hiding this.
// ---------------------------------------------------------------------
if (!defined('AGHI_FIREBASE_API_KEY')) {
    define('AGHI_FIREBASE_API_KEY', 'AIzaSyAavb6fsEoM2r55AIFG2uHZAOQBg2YPGIE');
}
if (!defined('AGHI_FIREBASE_AUTH_DOMAIN')) {
    define('AGHI_FIREBASE_AUTH_DOMAIN', 'aghimuan-network.firebaseapp.com');
}
if (!defined('AGHI_FIREBASE_PROJECT_ID')) {
    define('AGHI_FIREBASE_PROJECT_ID', 'aghimuan-network');
}

// ---------------------------------------------------------------------
// Limits / enums shared by PHP validation + JS UI.
// ---------------------------------------------------------------------
if (!defined('AGHI_MAX_AVATAR_BYTES')) {
    define('AGHI_MAX_AVATAR_BYTES', 2 * 1024 * 1024); // 2MB
}
if (!defined('AGHI_MAX_BIO_LENGTH')) {
    define('AGHI_MAX_BIO_LENGTH', 300);
}
if (!defined('AGHI_MAX_STATUS_LENGTH')) {
    define('AGHI_MAX_STATUS_LENGTH', 60);
}
if (!defined('AGHI_PRESENCE_VALUES')) {
    define('AGHI_PRESENCE_VALUES', ['online', 'away', 'dnd', 'invisible']);
}
if (!defined('AGHI_MAX_DM_BODY_LENGTH')) {
    define('AGHI_MAX_DM_BODY_LENGTH', 2000);
}

// ---------------------------------------------------------------------
// Helpers — so every caller shares the exact same logic, not just values.
// ---------------------------------------------------------------------

if (!function_exists('aghi_preset_ids')) {
    function aghi_preset_ids(): array {
        return AGHI_PRESET_IDS;
    }
}

if (!function_exists('aghi_preset_colors')) {
    function aghi_preset_colors(): array {
        return AGHI_PRESET_COLORS;
    }
}

if (!function_exists('aghi_is_preset')) {
    function aghi_is_preset(?string $pfpId): bool {
        $id = ($pfpId !== null && $pfpId !== '') ? $pfpId : 'default';
        return in_array($id, AGHI_PRESET_IDS, true);
    }
}

if (!function_exists('aghi_preset_color')) {
    function aghi_preset_color(?string $pfpId): string {
        $id = ($pfpId !== null && $pfpId !== '') ? $pfpId : 'default';
        $colors = AGHI_PRESET_COLORS;
        return $colors[$id] ?? $colors['default'];
    }
}

if (!function_exists('aghi_avatar_url')) {
    /**
     * Returns null for presets (render monogram), path for uploads.
     * basename() blocks path-traversal (../../etc) in stored filenames.
     */
    function aghi_avatar_url(?string $pfpId): ?string {
        $id = ($pfpId !== null && $pfpId !== '') ? $pfpId : 'default';
        if (aghi_is_preset($id)) {
            return null;
        }
        return '/uploads/pfp/' . basename($id);
    }
}

if (!function_exists('aghi_is_online')) {
    function aghi_is_online(?int $lastSeen, ?int $now = null): bool {
        if ($lastSeen === null) {
            return false;
        }
        return (time() - $lastSeen) < AGHI_ONLINE_THRESHOLD_SECONDS;
    }
}

if (!function_exists('aghi_firebase_config')) {
    function aghi_firebase_config(): array {
        return [
            'apiKey'     => AGHI_FIREBASE_API_KEY,
            'authDomain' => AGHI_FIREBASE_AUTH_DOMAIN,
            'projectId'  => AGHI_FIREBASE_PROJECT_ID,
        ];
    }
}
