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

  const PRESETS = [
    { id: 'default',      color: '#5F5E5A' },
    { id: 'circuit-blue', color: '#185FA5' },
    { id: 'circuit-cyan', color: '#0F6E56' },
    { id: 'node-teal',    color: '#04342C' },
    { id: 'spark-orange', color: '#993C1D' },
    { id: 'wire-purple',   color: '#534AB7' },
    { id: 'chip-green',    color: '#3B6D11' },
    { id: 'signal-pink',   color: '#993556' },
  ];

  const AGHI_CONFIG = {
    presets: PRESETS,
    presetIds: PRESETS.map((p) => p.id),
    presetColors: {
      'default': '#5F5E5A',
      'circuit-blue': '#185FA5',
      'circuit-cyan': '#0F6E56',
      'node-teal': '#04342C',
      'spark-orange': '#993C1D',
      'wire-purple': '#534AB7',
      'chip-green': '#3B6D11',
      'signal-pink': '#993556',
    },
    onlineThresholdSeconds: 45,
    lastSeenThrottleSeconds: 20,
    sessionLifetimeDays: 30,
    reviewerSessionTtl: 28800,
    heartbeatIntervalMs: 15000,
    typingFreshnessSeconds: 5,
    firebase: {
      apiKey: 'AIzaSyAavb6fsEoM2r55AIFG2uHZAOQBg2YPGIE',
      authDomain: 'aghimuan-network.firebaseapp.com',
      projectId: 'aghimuan-network',
    },
    maxAvatarBytes: 2097152,
    maxBioLength: 300,
    maxStatusLength: 60,
    presenceValues: ['online', 'away', 'dnd', 'invisible'],
    maxDmBodyLength: 2000,
  };

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
