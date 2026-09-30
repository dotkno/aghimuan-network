<?php
/**
 * scripts/sync-config.php — regenerate www/js/aghi-config.js from
 * www/includes/app-config.php (the single source of truth).
 *
 * Usage: php scripts/sync-config.php
 * Run this every time you edit app-config.php.
 */

declare(strict_types=1);

require_once __DIR__ . '/../www/includes/app-config.php';

$presets = [];
foreach (AGHI_PRESET_IDS as $id) {
    $colors = AGHI_PRESET_COLORS;
    $presets[] = ['id' => $id, 'color' => $colors[$id] ?? '#5F5E5A'];
}

$config = [
    'presets'                => $presets,
    'presetIds'              => AGHI_PRESET_IDS,
    'presetColors'           => AGHI_PRESET_COLORS,
    'onlineThresholdSeconds' => AGHI_ONLINE_THRESHOLD_SECONDS,
    'lastSeenThrottleSeconds'=> AGHI_LAST_SEEN_THROTTLE_SECONDS,
    'sessionLifetimeDays'    => AGHI_SESSION_LIFETIME_DAYS,
    'reviewerSessionTtl'     => AGHI_REVIEWER_SESSION_TTL,
    'heartbeatIntervalMs'    => AGHI_HEARTBEAT_INTERVAL_MS,
    'typingFreshnessSeconds' => AGHI_TYPING_FRESHNESS_SECONDS,
    'firebase'               => aghi_firebase_config(),
    'maxAvatarBytes'         => AGHI_MAX_AVATAR_BYTES,
    'maxBioLength'           => AGHI_MAX_BIO_LENGTH,
    'maxStatusLength'        => AGHI_MAX_STATUS_LENGTH,
    'presenceValues'         => AGHI_PRESENCE_VALUES,
    'maxDmBodyLength'        => AGHI_MAX_DM_BODY_LENGTH,
];

$jsonInline = json_encode($config, JSON_UNESCAPED_SLASHES);
if ($jsonInline === false) {
    fwrite(STDERR, "Failed to encode config\n");
    exit(1);
}

// Build the JS file from the live PHP values so they can never drift.
$js = <<<'HEADER'
/**
 * aghi-config.js — GENERATED MIRROR of www/includes/app-config.php
 *
 * DO NOT EDIT BY HAND.
 * Edit app-config.php instead, then run:
 *   php scripts/sync-config.php
 *
 * This file exists so pure static pages (.html) and vanilla JS that
 * can't run PHP still read the exact same values as the backend.
 * Load it BEFORE any other aghi script:
 *   <script src="/js/aghi-config.js"></script>
 */
(function () {
  'use strict';

HEADER;

$js .= "  const AGHI_CONFIG = " . json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . ";\n\n";
$js .= <<<'FOOTER'
  function isPreset(pfpId) {
    const id = pfpId != null && pfpId !== '' ? pfpId : 'default';
    return AGHI_CONFIG.presetIds.indexOf(id) !== -1;
  }

  function presetColor(pfpId) {
    const id = pfpId != null && pfpId !== '' ? pfpId : 'default';
    return AGHI_CONFIG.presetColors[id] || AGHI_CONFIG.presetColors['default'];
  }

  function avatarUrl(pfpId) {
    const id = pfpId != null && pfpId !== '' ? pfpId : 'default';
    if (isPreset(id)) return null;
    return '/uploads/pfp/' + String(id).split(/[\\/]/).pop();
  }

  AGHI_CONFIG.isPreset = isPreset;
  AGHI_CONFIG.presetColor = presetColor;
  AGHI_CONFIG.avatarUrl = avatarUrl;

  window.AGHI_CONFIG = AGHI_CONFIG;
})();
FOOTER;

$out = __DIR__ . '/../www/js/aghi-config.js';
file_put_contents($out, $js);
echo "Wrote $out from app-config.php\n";
