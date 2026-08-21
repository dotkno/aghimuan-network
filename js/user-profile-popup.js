/**
 * user-profile-popup.js
 */
window.AghiUserProfile = (function () {
  'use strict';

  // Matches member-list.js's own breakpoint, which matches the site's
  // existing mobile-tab-bar breakpoint -- keeping every "am I mobile?"
  // check in the site consistent with each other.
  const MOBILE_BREAKPOINT = 768;

  let popupEl = null;
  let backdropEl = null;
  let currentData = null;
  let sessionCache = null;
  let isMobileMode = false;

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  const PFP_PRESETS = [
    { id: 'default',      color: '#5F5E5A' },
    { id: 'circuit-blue', color: '#185FA5' },
    { id: 'circuit-cyan', color: '#0F6E56' },
    { id: 'node-teal',    color: '#04342C' },
    { id: 'spark-orange', color: '#993C1D' },
    { id: 'wire-purple',  color: '#534AB7' },
    { id: 'chip-green',   color: '#3B6D11' },
    { id: 'signal-pink',  color: '#993556' },
  ];

  const PRESENCE_META = {
    online:    { label: 'Online',         color: '#3ddc84' },
    away:      { label: 'Away',           color: '#f5c542' },
    dnd:       { label: 'Do Not Disturb', color: '#e05260' },
    invisible: { label: 'Invisible',      color: '#6b8b9a' },
    offline:   { label: 'Offline',        color: '#6b8b9a' },
  };

  function effectivePresence(data) {
    if (!data.online || data.presence === 'invisible') return PRESENCE_META.offline;
    return PRESENCE_META[data.presence] || PRESENCE_META.online;
  }

  const SUBROLE_STYLES = {
    'Dagitab': 'background: #d4a017; color: #fff;',
    'EBDA': 'background: #111111; color: #fff; border: 1px solid #444;',
    'Hiraya': 'background: #ffd700; color: #000;',
    'Lyrico': 'background: #00bfff; color: #fff;',
    'Marahuyo': 'background: #800000; color: #fff;',
    'Padayon': 'background: #4b0082; color: #fff;',
    'Pahina': 'background: #cc0000; color: #fff;',
    'Paraluman': 'background: #ffb6c1; color: #333;',
    'PFG': 'background: linear-gradient(90deg, #ffd700 50%, #111111 50%); color: #fff;',

    'Sibol': 'background: #b76e79; color: #fff;',
    'RISE': 'background: linear-gradient(90deg, #000080, #ffd700); color: #fff;',
    'Dalumat': 'background: #795548; color: #fff;',
    'Numero': 'background: #2e7d32; color: #fff;',
    'Kalakbay': 'background: #ffe4e1; color: #333;',
    'Le Verrier': 'background: #0d47a1; color: #fff;',
    'Nexus': 'background: #1b5e20; color: #fff;',
    'Aghimuan': 'background: #00b0ff; color: #000;',
    'Skill Speak': 'background: linear-gradient(90deg, #8b0000, #ffffff); color: #000;',

    'G12': 'background: #455a64; color: #fff;',
    'G11': 'background: #455a64; color: #fff;',
    'JHS': 'background: #455a64; color: #fff;',

    'STEM': 'background: #3f51b5; color: #fff;',
    'ABM/BE': 'background: #2e7d32; color: #fff;',
    'HUMSS/ASSH': 'background: linear-gradient(90deg, #ffd700, #d32f2f); color: #fff;',
    'HE/HT': 'background: #e91e63; color: #fff;',
    'ICT/ICT Professionals': 'background: #8e24aa; color: #fff;',
    'SPORTS': 'background: linear-gradient(90deg, #00bcd4, #4caf50); color: #fff;'
  };

  function getMainRoleStyle(role) {
    const r = (role || 'MEMBER').toUpperCase();
    if (r === 'CLUB ADVISER') {
      return 'background: linear-gradient(135deg, #00f2fe, #4facfe); color: #060b10; font-weight: 700; border: none; box-shadow: 0 0 10px rgba(0,242,254,0.4);';
    }
    if (r === 'OFFICER') {
      return 'background: linear-gradient(135deg, #00c6ff, #0072ff); color: #fff; font-weight: 700; border: none; box-shadow: 0 0 10px rgba(0,198,255,0.35);';
    }
    if (r === 'COMMITEE MEMBER' || r === 'COMMITTEE MEMBER') {
      return 'background: #1e88e5; color: #fff; font-weight: 600; border: none; box-shadow: 0 0 8px rgba(30,136,229,0.3);';
    }
    return 'background: rgba(85,241,248,0.06); color: #55F1F8; border: 1px solid rgba(85,241,248,0.35); box-shadow: 0 0 8px rgba(85,241,248,0.15);';
  }

  function presetColor(pfpId) {
    const match = PFP_PRESETS.find((p) => p.id === pfpId);
    return (match || PFP_PRESETS[0]).color;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Pulls a single representative hex color out of a "background: #abc..."
  // (or gradient) style string, for the small dot next to each role chip
  // in the mobile sheet's Roles section -- the desktop badges use the
  // full style as a background fill instead, so this only needs to grab
  // the first color, not reproduce the whole gradient.
  function extractDotColor(styleStr) {
    const match = /#[0-9a-fA-F]{3,8}/.exec(styleStr || '');
    return match ? match[0] : '#55F1F8';
  }

  function roleChipHtml(label, styleStr) {
    return `<span class="aghi-up-role-chip"><span class="aghi-up-role-chip-dot" style="background:${extractDotColor(styleStr)}"></span>${escapeHtml(label)}</span>`;
  }

  // Same source fields as the desktop popup's subrolesHtml, just rendered
  // as dot+label chips (matching the reference mobile layout) instead of
  // solid-color badges.
  function buildRoleChipsHtml(data) {
    let html = '';
    if (data.subRole) {
      html += roleChipHtml(data.subRole, 'background:#1e88e5;');
    }
    if (data.club) {
      html += roleChipHtml(data.club, SUBROLE_STYLES[data.club] || 'background:#3096C7;');
    }
    if (data.grade) {
      html += roleChipHtml(data.grade, SUBROLE_STYLES[data.grade] || 'background:#455a64;');
    }
    if (data.strand) {
      html += roleChipHtml(data.strand, SUBROLE_STYLES[data.strand] || 'background:#3096C7;');
    }
    if (Array.isArray(data.customRoles)) {
      data.customRoles.forEach((role) => {
        html += roleChipHtml(role.name, `background:${role.color_css};`);
      });
    }
    return html;
  }

  function injectStyles() {
    if (document.getElementById('aghi-up-styles')) return;
    const style = document.createElement('style');
    style.id = 'aghi-up-styles';
    style.textContent = `
      @keyframes aghi-glow-pulse {
        0%, 100% { box-shadow: 0 0 6px rgba(85,241,248,0.4); border-color: #55F1F8; }
        50% { box-shadow: 0 0 16px rgba(85,241,248,0.85); border-color: #8bf7fc; }
      }
      @keyframes aghi-menu-pop {
        from { opacity: 0; transform: translateY(-8px) scale(0.92); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .aghi-up-popup {
        position: absolute; z-index: 9999; width: 300px;
        background: #0c1620; border: 1px solid rgba(48, 150, 199, 0.35);
        border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        color: #F1F2F5; font-family: 'Rajdhani', sans-serif;
      }
      .aghi-up-banner {
        height: 56px; background: linear-gradient(135deg, #163247, #0a1a26);
        border-radius: 10px 10px 0 0; position: relative;
      }
      .aghi-up-banner::after {
        content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
        background: linear-gradient(90deg, transparent, #55F1F8, #3096C7, transparent);
        box-shadow: 0 0 10px rgba(85,241,248,0.6);
      }
      .aghi-up-body { padding: 0 16px 16px; margin-top: -30px; position: relative; }
      .aghi-up-avatar-wrap {
        width: 64px; height: 64px; border-radius: 50%; position: relative;
        border: 4px solid #0c1620; margin-bottom: 8px;
        box-shadow: 0 0 0 1px rgba(85,241,248,0.4), 0 0 14px rgba(48,150,199,0.35);
      }
      .aghi-up-presence-dot {
        position: absolute; right: -2px; bottom: -2px; width: 15px; height: 15px;
        border-radius: 50%; border: 3px solid #0c1620; box-sizing: content-box;
      }
      .aghi-up-presence-row {
        display: flex; align-items: center; gap: 6px; font-size: 12px;
        color: #a9c2ce; margin: 2px 0 4px;
      }
      .aghi-up-presence-row .aghi-up-presence-dot-inline {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      }
      .aghi-up-avatar {
        width: 100%; height: 100%; border-radius: 50%;
        background-color: #0a1520; background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center; overflow: hidden;
      }
      .aghi-up-avatar span {
        font-family: 'Orbitron', sans-serif; font-size: 22px; color: #F1F2F5; user-select: none;
      }
      .aghi-up-username {
        font-family: 'Orbitron', sans-serif; font-size: 16px; color: #F1F2F5; margin: 2px 0 0;
        text-shadow: 0 0 12px rgba(85,241,248,0.25);
      }
      .aghi-up-role {
        display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
        border-radius: 4px; padding: 2px 8px; margin: 6px 0 10px;
      }
      .aghi-up-status-bubble {
        position: absolute; top: -4px; left: 78px; max-width: 168px;
        background: #1a2733; border: 1px solid rgba(48,150,199,0.3); border-radius: 14px;
        padding: 8px 12px; font-size: 12px; color: #d7dee2;
      }
      .aghi-up-status-bubble.aghi-up-empty { display: none; }
      .aghi-up-section {
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border: 1px solid rgba(48,150,199,0.18);
        border-radius: 8px; padding: 12px 14px; margin: 10px 0;
      }
      .aghi-up-about-label {
        display: flex; align-items: center; gap: 6px;
        font-family: 'Orbitron', sans-serif; font-size: 10px; letter-spacing: 0.08em;
        text-transform: uppercase; color: #55F1F8; margin-bottom: 8px;
      }
      .aghi-up-about-label::before {
        content: ''; width: 3px; height: 10px; border-radius: 2px;
        background: linear-gradient(180deg, #55F1F8, #3096C7);
        box-shadow: 0 0 6px rgba(85,241,248,0.6);
      }
      .aghi-up-about-text { font-size: 13px; color: #d7dee2; white-space: pre-wrap; }
      .aghi-up-about-text.aghi-up-empty { color: #55697a; font-style: italic; }
      .aghi-up-subroles-row {
        display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; margin-bottom: 10px;
      }
      .aghi-subrole-badge {
        font-size: 10px; font-family: 'Rajdhani', sans-serif; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px;
        border-radius: 4px; display: inline-flex; align-items: center;
      }
      .aghi-up-message-btn {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        width: 100%; margin-top: 4px; padding: 8px;
        background: linear-gradient(180deg, #3096C7, #1E5A8A); border: none; border-radius: 6px;
        color: #fff; font-family: 'Orbitron', sans-serif; font-size: 12px; letter-spacing: 0.03em;
        cursor: pointer; transition: all 0.2s ease;
      }
      .aghi-up-message-btn:hover {
        filter: brightness(1.15);
        box-shadow: 0 0 12px rgba(48,150,199,0.5);
      }
      .aghi-up-message-btn svg { width: 14px; height: 14px; }

      /* --- Action row: custom Aghimuan HUD controls --- */
      .aghi-up-action-row {
        position: absolute; top: 10px; right: 10px; z-index: 3;
        display: flex; align-items: center; gap: 8px;
      }
      .aghi-up-action-row[hidden] { display: none; }
      .aghi-up-iconbtn {
        width: 30px; height: 30px; padding: 0;
        display: flex; align-items: center; justify-content: center;
        background: rgba(6, 14, 22, 0.75);
        border: 1px solid rgba(85,241,248,0.35);
        color: #F1F2F5; cursor: pointer;
        backdrop-filter: blur(6px);
        clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, border-color 0.2s, box-shadow 0.2s;
      }
      .aghi-up-iconbtn svg { width: 14px; height: 14px; transition: transform 0.2s; }
      .aghi-up-iconbtn:hover {
        background: rgba(85,241,248,0.22);
        border-color: #55F1F8;
        transform: translateY(-2px) scale(1.08);
        box-shadow: 0 0 12px rgba(85,241,248,0.45);
      }
      .aghi-up-iconbtn:hover svg { transform: scale(1.1); }
      .aghi-up-iconbtn:active { transform: scale(0.92); }

      .aghi-up-friendbtn.is-friends {
        color: #3ddc84; border-color: rgba(61,220,132,0.6);
        background: rgba(61,220,132,0.12);
      }
      .aghi-up-friendbtn.is-friends:hover {
        background: rgba(61,220,132,0.28);
        box-shadow: 0 0 12px rgba(61,220,132,0.45);
      }

      .aghi-up-friendbtn.is-pending {
        color: #f5c542; border-color: rgba(245,197,66,0.6);
        background: rgba(245,197,66,0.12);
      }
      .aghi-up-friendbtn.is-pending:hover {
        background: rgba(245,197,66,0.28);
        box-shadow: 0 0 12px rgba(245,197,66,0.45);
      }

      .aghi-up-friendbtn.is-incoming {
        color: #55F1F8; background: rgba(85,241,248,0.18);
        animation: aghi-glow-pulse 1.8s infinite ease-in-out;
      }

      .aghi-up-menu {
        position: absolute; top: 38px; right: 0; min-width: 140px;
        background: rgba(10, 20, 30, 0.94);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(85,241,248,0.35);
        border-radius: 6px; padding: 4px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.65), 0 0 14px rgba(85,241,248,0.15);
        animation: aghi-menu-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: top right;
      }
      .aghi-up-menu[hidden] { display: none; }
      .aghi-up-menu-item {
        display: flex; align-items: center; width: 100%; text-align: left; padding: 8px 10px;
        background: none; border: none; border-radius: 4px; cursor: pointer;
        color: #d7dee2; font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 13px;
        letter-spacing: 0.03em;
        transition: all 0.15s ease;
      }
      .aghi-up-menu-item:hover {
        background: rgba(85,241,248,0.12);
        color: #55F1F8;
        padding-left: 14px;
      }
      .aghi-up-menu-danger { color: #ff6b7a; }
      .aghi-up-menu-danger:hover {
        background: rgba(255,107,122,0.18);
        color: #ff8593;
        padding-left: 14px;
      }

      /* --- Mobile full-screen sheet (viewport <= 768px) --- */
      .aghi-up-mobile-backdrop {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(4, 9, 14, 0.6);
        opacity: 0; transition: opacity 0.25s ease;
      }
      .aghi-up-mobile-backdrop.aghi-up-mobile-open { opacity: 1; }

      .aghi-up-mobile-sheet {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;
        width: 100%; max-width: 480px; margin: 0 auto;
        height: auto; max-height: 88vh;
        background: #0c1620; color: #F1F2F5; font-family: 'Rajdhani', sans-serif;
        border-radius: 16px 16px 0 0;
        border: 1px solid rgba(48, 150, 199, 0.35); border-bottom: none;
        box-shadow: 0 -10px 40px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; overflow: hidden;
        transform: translateY(100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .aghi-up-mobile-sheet.aghi-up-mobile-open { transform: translateY(0); }

      .aghi-up-mobile-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

      .aghi-up-mobile-draghandle {
        display: flex; justify-content: center; padding: 10px 0 4px; flex-shrink: 0;
      }
      .aghi-up-mobile-draghandle span {
        width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25);
      }

      .aghi-up-mobile-banner {
        height: 100px; margin: 0 16px;
        background: linear-gradient(135deg, #163247, #0a1a26);
        border-radius: 10px; position: relative; flex-shrink: 0;
      }
      .aghi-up-mobile-banner::after {
        content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
        background: linear-gradient(90deg, transparent, #55F1F8, #3096C7, transparent);
        box-shadow: 0 0 10px rgba(85,241,248,0.6);
      }
      .aghi-up-mobile-topbtn {
        position: absolute; top: 10px; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(6, 14, 22, 0.75); border: 1px solid rgba(85,241,248,0.35);
        border-radius: 50%; color: #F1F2F5; cursor: pointer; z-index: 3;
      }
      .aghi-up-mobile-topbtn svg { width: 15px; height: 15px; }
      .aghi-up-mobile-back { left: 10px; }
      .aghi-up-mobile-more { right: 10px; }

      .aghi-up-mobile-body { padding: 0 16px 20px; margin-top: -40px; position: relative; }
      .aghi-up-mobile-avatar-wrap {
        width: 76px; height: 76px; border-radius: 50%; position: relative;
        border: 4px solid #0c1620; margin-bottom: 8px;
        box-shadow: 0 0 0 1px rgba(85,241,248,0.4), 0 0 16px rgba(48,150,199,0.35);
      }
      .aghi-up-mobile-avatar {
        width: 100%; height: 100%; border-radius: 50%;
        background-color: #0a1520; background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center; overflow: hidden;
      }
      .aghi-up-mobile-avatar span {
        font-family: 'Orbitron', sans-serif; font-size: 26px; color: #F1F2F5; user-select: none;
      }
      .aghi-up-mobile-presence-dot {
        position: absolute; right: 0; bottom: 2px; width: 16px; height: 16px;
        border-radius: 50%; border: 3px solid #0c1620; box-sizing: content-box;
      }

      .aghi-up-mobile-username-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .aghi-up-mobile-username {
        font-family: 'Orbitron', sans-serif; font-size: 18px; color: #F1F2F5;
        text-shadow: 0 0 12px rgba(85,241,248,0.25);
      }
      .aghi-up-mobile-role {
        display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
        border-radius: 4px; padding: 2px 8px;
      }
      .aghi-up-mobile-presence-row {
        display: flex; align-items: center; gap: 6px; font-size: 12px;
        color: #a9c2ce; margin: 4px 0 12px;
      }
      .aghi-up-mobile-presence-row .aghi-up-presence-dot-inline {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      }

      .aghi-up-mobile-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
      .aghi-up-primary-btn {
        flex: 1; height: 38px; padding: 0 14px; border: none; border-radius: 6px;
        background: linear-gradient(180deg, #3096C7, #1E5A8A); color: #fff;
        font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 0.04em;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        cursor: pointer; transition: filter 0.2s ease, box-shadow 0.2s ease;
      }
      .aghi-up-primary-btn svg { width: 14px; height: 14px; }
      .aghi-up-primary-btn:hover { filter: brightness(1.12); }
      .aghi-up-primary-btn.is-friends { background: rgba(61,220,132,0.16); color: #3ddc84; border: 1px solid rgba(61,220,132,0.5); }
      .aghi-up-primary-btn.is-pending { background: rgba(245,197,66,0.16); color: #f5c542; border: 1px solid rgba(245,197,66,0.5); }
      .aghi-up-primary-btn.is-incoming { background: rgba(85,241,248,0.18); color: #55F1F8; animation: aghi-glow-pulse 1.8s infinite ease-in-out; }
      .aghi-up-mobile-iconbtn {
        width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(85,241,248,0.3); border-radius: 6px;
        color: #F1F2F5; cursor: pointer;
      }
      .aghi-up-mobile-iconbtn svg { width: 16px; height: 16px; }

      .aghi-up-mobile-section {
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border: 1px solid rgba(48,150,199,0.18); border-radius: 8px;
        padding: 12px 14px; margin-bottom: 12px;
      }
      .aghi-up-mobile-section-label {
        display: flex; align-items: center; gap: 6px;
        font-family: 'Orbitron', sans-serif; font-size: 10px; letter-spacing: 0.08em;
        text-transform: uppercase; color: #55F1F8; margin-bottom: 8px;
      }
      .aghi-up-mobile-section-label::before {
        content: ''; width: 3px; height: 10px; border-radius: 2px;
        background: linear-gradient(180deg, #55F1F8, #3096C7);
        box-shadow: 0 0 6px rgba(85,241,248,0.6);
      }
      .aghi-up-mobile-about-text { font-size: 13px; color: #d7dee2; white-space: pre-wrap; }
      .aghi-up-mobile-about-text.aghi-up-empty { color: #55697a; font-style: italic; }

      .aghi-up-role-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .aghi-up-role-chip {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,0.05); border-radius: 16px;
        padding: 5px 10px 5px 7px; font-size: 12px; font-weight: 600; color: #E6EDF7;
      }
      .aghi-up-role-chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const CLOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`;
  const DOTS_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;

  function friendButtonHtml(status) {
    switch (status) {
      case 'friends':
        return `<button type="button" class="aghi-up-iconbtn aghi-up-friendbtn is-friends" data-action="friend-friends" title="Friends · click to remove">${CHECK_ICON}</button>`;
      case 'pending_sent':
        return `<button type="button" class="aghi-up-iconbtn aghi-up-friendbtn is-pending" data-action="friend-cancel" title="Request sent · click to cancel">${CLOCK_ICON}</button>`;
      case 'pending_received':
        return `<button type="button" class="aghi-up-iconbtn aghi-up-friendbtn is-incoming" data-action="friend-accept" title="Accept friend request">${CHECK_ICON}</button>`;
      default:
        return `<button type="button" class="aghi-up-iconbtn aghi-up-friendbtn" data-action="friend-add" title="Add Friend">${PLUS_ICON}</button>`;
    }
  }

  function buildActionRowHtml(data) {
    if (data.isSelf) {
      return `<div class="aghi-up-action-row" data-el="action-row" hidden></div>`;
    }
    const blocked = !!data.blockedByYou;
    const friendBtn = blocked ? '' : friendButtonHtml(data.friendStatus);
    const blockItem = blocked
      ? `<button type="button" class="aghi-up-menu-item" data-action="unblock">Unblock</button>`
      : `<button type="button" class="aghi-up-menu-item aghi-up-menu-danger" data-action="block">Block</button>`;
    return `
      <div class="aghi-up-action-row" data-el="action-row">
        ${friendBtn}
        <button type="button" class="aghi-up-iconbtn" data-action="menu-toggle" title="More">${DOTS_ICON}</button>
        <div class="aghi-up-menu" data-el="menu" hidden>
          ${blockItem}
          <button type="button" class="aghi-up-menu-item" data-action="report">Report</button>
        </div>
      </div>
    `;
  }

  function mobilePrimaryButtonHtml(status) {
    switch (status) {
      case 'friends':
        return `<button type="button" class="aghi-up-primary-btn is-friends" data-action="friend-friends">${CHECK_ICON}<span>Friends</span></button>`;
      case 'pending_sent':
        return `<button type="button" class="aghi-up-primary-btn is-pending" data-action="friend-cancel">${CLOCK_ICON}<span>Request Sent</span></button>`;
      case 'pending_received':
        return `<button type="button" class="aghi-up-primary-btn is-incoming" data-action="friend-accept">${CHECK_ICON}<span>Accept Request</span></button>`;
      default:
        return `<button type="button" class="aghi-up-primary-btn" data-action="friend-add">${PLUS_ICON}<span>Add Friend</span></button>`;
    }
  }

  // Big-button equivalent of buildActionRowHtml's small friend icon, for
  // the mobile sheet's action row under the avatar. Reuses the exact same
  // data-action values (friend-add/friend-cancel/friend-accept/friend-
  // friends/message), so the existing onPopupClick + handleFriendAction
  // logic handles it with zero new wiring.
  function buildMobilePrimaryHtml(data, canMessage) {
    if (data.isSelf) {
      return `<div class="aghi-up-mobile-actions" data-el="mobile-primary"></div>`;
    }
    const friendBtn = data.blockedByYou ? '' : mobilePrimaryButtonHtml(data.friendStatus);
    const messageBtn = canMessage
      ? `<button type="button" class="aghi-up-mobile-iconbtn" data-action="message" title="Message" aria-label="Message">${CHAT_ICON}</button>`
      : '';
    return `<div class="aghi-up-mobile-actions" data-el="mobile-primary">${friendBtn}${messageBtn}</div>`;
  }

  function updateActionRow() {
    if (!popupEl || !currentData) return;
    const actionRow = popupEl.querySelector('[data-el="action-row"]');
    if (actionRow) actionRow.outerHTML = buildActionRowHtml(currentData);

    const mobilePrimary = popupEl.querySelector('[data-el="mobile-primary"]');
    if (mobilePrimary) {
      const targetId = currentData.id ?? currentData.userId ?? null;
      const widgetApi = window.AghiAccountWidget;
      const canMessage = !!(
        widgetApi && targetId !== null &&
        widgetApi.isLoggedIn && widgetApi.isLoggedIn() &&
        String(widgetApi.getCurrentUserId()) !== String(targetId)
      );
      mobilePrimary.outerHTML = buildMobilePrimaryHtml(currentData, canMessage);
      bindMessageButtons();
    }
  }

  async function getCsrfToken() {
    if (window.AghiAccountWidget && typeof window.AghiAccountWidget.getCsrfToken === 'function') {
      return window.AghiAccountWidget.getCsrfToken();
    }
    if (sessionCache && (sessionCache.csrfToken || sessionCache.csrf_token)) {
      return sessionCache.csrfToken || sessionCache.csrf_token;
    }
    try {
      const res = await fetch('/api/session.php', { credentials: 'same-origin' });
      const data = await res.json();
      sessionCache = data;
      return data && (data.csrfToken || data.csrf_token);
    } catch (err) {
      return null;
    }
  }

  async function postJson(url, body) {
    const csrf = await getCsrfToken();
    let res, data;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, body, { csrf_token: csrf })),
      });
      data = await res.json();
    } catch (err) {
      return { ok: false, data: null };
    }
    return { ok: res.ok, data };
  }

  async function handleFriendAction(action, targetId) {
    let url, body;
    if (action === 'friend-add') {
      url = '/api/friend-request.php'; body = { targetId };
    } else if (action === 'friend-cancel') {
      url = '/api/friend-remove.php'; body = { targetId };
    } else if (action === 'friend-accept') {
      url = '/api/friend-respond.php'; body = { targetId, action: 'accept' };
    } else if (action === 'friend-friends') {
      if (!window.confirm('Remove this friend?')) return;
      url = '/api/friend-remove.php'; body = { targetId };
    } else {
      return;
    }
    const { ok, data } = await postJson(url, body);
    if (ok && data && data.ok && currentData) {
      currentData.friendStatus = data.friendStatus || currentData.friendStatus;
      updateActionRow();
    }
  }

  async function handleBlockAction(action, targetId) {
    const { ok, data } = await postJson('/api/user-block.php', { targetId, action });
    if (ok && data && data.ok && currentData) {
      currentData.blockedByYou = !!data.blocked;
      if (data.blocked) currentData.friendStatus = 'none';
      updateActionRow();
    }
  }

  async function handleReport(targetId) {
    const reason = window.prompt("Tell us why you're reporting this profile:");
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    const { ok, data } = await postJson('/api/user-report.php', { targetId, reason: trimmed });
    if (ok && data && data.ok) {
      window.alert('Report submitted. Thanks for helping keep Aghimuan safe.');
    } else {
      window.alert((data && data.error) || 'Could not submit report.');
    }
  }

  function onPopupClick(e) {
    if (!currentData) return;
    const targetId = currentData.id ?? currentData.userId;
    const menuEl = popupEl.querySelector('[data-el="menu"]');
    const actionEl = e.target.closest('[data-action]');

    if (menuEl && !menuEl.hidden && (!actionEl || actionEl.getAttribute('data-action') !== 'menu-toggle') && !menuEl.contains(e.target)) {
      menuEl.hidden = true;
    }

    if (!actionEl || targetId == null) return;
    const action = actionEl.getAttribute('data-action');

    if (action === 'menu-toggle') {
      e.stopPropagation();
      if (menuEl) menuEl.hidden = !menuEl.hidden;
      return;
    }
    if (action === 'message') return;

    e.stopPropagation();
    if (action === 'block' || action === 'unblock') {
      handleBlockAction(action, targetId);
      return;
    }
    if (action === 'report') {
      handleReport(targetId);
      return;
    }
    handleFriendAction(action, targetId);
  }

  // Binds every [data-action="message"] button currently in the popup --
  // desktop has one (the full-width Message button), mobile has one (the
  // icon button next to the primary friend action) -- to open the DM
  // thread. Re-called after updateActionRow() rebuilds the mobile primary
  // row, since outerHTML replacement drops any previously bound listener.
  function bindMessageButtons() {
    if (!popupEl || !currentData) return;
    const targetId = currentData.id ?? currentData.userId ?? null;
    if (targetId == null) return;
    const username = currentData.username;
    const pfpId = currentData.pfpId;
    popupEl.querySelectorAll('[data-action="message"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
        window.AghiAccountWidget.openDm(targetId, username, pfpId);
      });
    });
  }

  function positionPopup(popup, anchorEl) {
    if (!anchorEl || !anchorEl.getBoundingClientRect) {
      popup.style.top = `${window.scrollY + 80}px`;
      popup.style.left = `${window.scrollX + 16}px`;
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width || 300;
    const popupHeight = popupRect.height || 260;
    const margin = 8;

    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + margin;

    const viewportWidth = document.documentElement.clientWidth;
    if (left + popupWidth > scrollX + viewportWidth - margin) {
      left = scrollX + viewportWidth - popupWidth - margin;
    }
    if (left < scrollX + margin) {
      left = scrollX + margin;
    }

    const viewportHeight = document.documentElement.clientHeight;
    const spaceBelow = (scrollY + viewportHeight) - top;
    if (spaceBelow < popupHeight && rect.top + scrollY - popupHeight - margin > scrollY) {
      top = rect.top + scrollY - popupHeight - margin;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function close() {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeyDown);
    currentData = null;

    if (isMobileMode && popupEl) {
      // Play the slide-down/fade-out before actually removing the nodes,
      // instead of just yanking them off-screen instantly.
      const sheet = popupEl;
      const backdrop = backdropEl;
      sheet.classList.remove('aghi-up-mobile-open');
      if (backdrop) backdrop.classList.remove('aghi-up-mobile-open');
      popupEl = null;
      backdropEl = null;
      document.documentElement.classList.remove('aghi-up-noscroll');
      setTimeout(() => {
        sheet.remove();
        if (backdrop) backdrop.remove();
      }, 280);
      return;
    }

    if (popupEl) { popupEl.remove(); popupEl = null; }
    if (backdropEl) { backdropEl.remove(); backdropEl = null; }
  }

  function onDocClick(e) {
    if (popupEl && !e.composedPath().includes(popupEl)) close();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }

  function openDesktopPopup(anchorEl, data, mainRole, mainRoleStyle, presence, canMessage) {
    let subrolesHtml = '';
    if (data.subRole) {
      subrolesHtml += `<span class="aghi-subrole-badge" style="background:#1e88e5;color:#fff;">${escapeHtml(data.subRole)}</span>`;
    }
    if (data.club) {
      const style = SUBROLE_STYLES[data.club] || 'background:#3096C7;color:#fff;';
      subrolesHtml += `<span class="aghi-subrole-badge" style="${style}">${escapeHtml(data.club)}</span>`;
    }
    if (data.grade) {
      const style = SUBROLE_STYLES[data.grade] || 'background:#455a64;color:#fff;';
      subrolesHtml += `<span class="aghi-subrole-badge" style="${style}">${escapeHtml(data.grade)}</span>`;
    }
    if (data.strand) {
      const style = SUBROLE_STYLES[data.strand] || 'background:#3096C7;color:#fff;';
      subrolesHtml += `<span class="aghi-subrole-badge" style="${style}">${escapeHtml(data.strand)}</span>`;
    }
    if (Array.isArray(data.customRoles)) {
      data.customRoles.forEach((role) => {
        const style = `background:${role.color_css};color:${role.text_color};`;
        subrolesHtml += `<span class="aghi-subrole-badge" style="${style}">${escapeHtml(role.name)}</span>`;
      });
    }

    popupEl = document.createElement('div');
    popupEl.className = 'aghi-up-popup';
    popupEl.innerHTML = `
      <div class="aghi-up-banner">
        ${buildActionRowHtml(data)}
      </div>
      <div class="aghi-up-body">
        <div class="aghi-up-avatar-wrap">
          <div class="aghi-up-avatar" data-el="avatar"></div>
          <div class="aghi-up-presence-dot" style="background:${presence.color};box-shadow:0 0 6px ${presence.color}" title="${escapeHtml(presence.label)}"></div>
        </div>
        <div class="aghi-up-status-bubble ${data.status ? '' : 'aghi-up-empty'}" data-el="status"></div>
        <div class="aghi-up-username" data-el="username"></div>
        <span class="aghi-up-role" style="${mainRoleStyle}">${escapeHtml(mainRole.toUpperCase())}</span>
        <div class="aghi-up-presence-row">
          <span class="aghi-up-presence-dot-inline" style="background:${presence.color}"></span>
          <span>${escapeHtml(presence.label)}</span>
        </div>

        <div class="aghi-up-section">
          <div class="aghi-up-about-label">About Me</div>
          <div class="aghi-up-about-text ${data.bio ? '' : 'aghi-up-empty'}" data-el="bio"></div>
        </div>

        ${subrolesHtml ? `<div class="aghi-up-subroles-row">${subrolesHtml}</div>` : ''}

        ${canMessage ? `<button type="button" class="aghi-up-message-btn" data-action="message">${CHAT_ICON}<span>Message</span></button>` : ''}
      </div>
    `;

    popupEl.querySelector('[data-el="username"]').textContent = data.username;
    popupEl.querySelector('[data-el="status"]').textContent = data.status || '';
    popupEl.querySelector('[data-el="bio"]').textContent = data.bio || 'No bio yet.';

    const avatarEl = popupEl.querySelector('[data-el="avatar"]');
    if (data.avatarUrl) {
      avatarEl.style.backgroundImage = `url('${data.avatarUrl}')`;
    } else {
      avatarEl.style.backgroundColor = presetColor(data.pfpId);
      const mono = document.createElement('span');
      mono.textContent = (data.username || '?').charAt(0).toUpperCase();
      avatarEl.appendChild(mono);
    }

    bindMessageButtons();
    popupEl.addEventListener('click', onPopupClick);

    popupEl.style.visibility = 'hidden';
    document.body.appendChild(popupEl);
    positionPopup(popupEl, anchorEl);
    popupEl.style.visibility = 'visible';

    setTimeout(() => document.addEventListener('click', onDocClick), 10);
    document.addEventListener('keydown', onKeyDown);
  }

  // Full-screen sheet for phones/small screens -- same reference layout as
  // Discord's mobile profile: banner, overlapping avatar, primary friend
  // action + message icon, About Me, then a Roles section as dot+label
  // chips instead of the desktop popup's tiny anchored box (which never
  // scaled right below the panel breakpoint).
  function openMobileSheet(data, mainRole, mainRoleStyle, presence, canMessage) {
    const roleChips = buildRoleChipsHtml(data);

    backdropEl = document.createElement('div');
    backdropEl.className = 'aghi-up-mobile-backdrop';
    backdropEl.addEventListener('click', () => close());
    document.body.appendChild(backdropEl);

    popupEl = document.createElement('div');
    popupEl.className = 'aghi-up-mobile-sheet';
    popupEl.innerHTML = `
      <div class="aghi-up-mobile-draghandle"><span></span></div>
      <div class="aghi-up-mobile-scroll">
        <div class="aghi-up-mobile-banner">
          <button type="button" class="aghi-up-mobile-topbtn aghi-up-mobile-back" data-action="close" aria-label="Close profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          ${!data.isSelf ? `
          <button type="button" class="aghi-up-mobile-topbtn aghi-up-mobile-more" data-action="menu-toggle" title="More" aria-label="More options">${DOTS_ICON}</button>
          <div class="aghi-up-menu" data-el="menu" hidden style="top:48px;right:10px;">
            ${data.blockedByYou
              ? `<button type="button" class="aghi-up-menu-item" data-action="unblock">Unblock</button>`
              : `<button type="button" class="aghi-up-menu-item aghi-up-menu-danger" data-action="block">Block</button>`}
            <button type="button" class="aghi-up-menu-item" data-action="report">Report</button>
          </div>` : ''}
        </div>
        <div class="aghi-up-mobile-body">
          <div class="aghi-up-mobile-avatar-wrap">
            <div class="aghi-up-mobile-avatar" data-el="avatar"></div>
            <div class="aghi-up-mobile-presence-dot" style="background:${presence.color};box-shadow:0 0 8px ${presence.color}" title="${escapeHtml(presence.label)}"></div>
          </div>
          <div class="aghi-up-mobile-username-row">
            <span class="aghi-up-mobile-username" data-el="username"></span>
            <span class="aghi-up-mobile-role" style="${mainRoleStyle}">${escapeHtml(mainRole.toUpperCase())}</span>
          </div>
          <div class="aghi-up-mobile-presence-row">
            <span class="aghi-up-presence-dot-inline" style="background:${presence.color}"></span>
            <span>${escapeHtml(presence.label)}</span>
          </div>

          ${buildMobilePrimaryHtml(data, canMessage)}

          <div class="aghi-up-mobile-section">
            <div class="aghi-up-mobile-section-label">About Me</div>
            <div class="aghi-up-mobile-about-text ${data.bio ? '' : 'aghi-up-empty'}" data-el="bio"></div>
          </div>

          ${roleChips ? `
          <div class="aghi-up-mobile-section">
            <div class="aghi-up-mobile-section-label">Roles</div>
            <div class="aghi-up-role-chips">${roleChips}</div>
          </div>` : ''}
        </div>
      </div>
    `;

    popupEl.querySelector('[data-el="username"]').textContent = data.username;
    popupEl.querySelector('[data-el="bio"]').textContent = data.bio || 'No bio yet.';

    const avatarEl = popupEl.querySelector('[data-el="avatar"]');
    if (data.avatarUrl) {
      avatarEl.style.backgroundImage = `url('${data.avatarUrl}')`;
    } else {
      avatarEl.style.backgroundColor = presetColor(data.pfpId);
      const mono = document.createElement('span');
      mono.textContent = (data.username || '?').charAt(0).toUpperCase();
      avatarEl.appendChild(mono);
    }

    popupEl.querySelector('[data-action="close"]').addEventListener('click', () => close());
    bindMessageButtons();
    popupEl.addEventListener('click', onPopupClick);

    document.body.appendChild(popupEl);
    document.documentElement.classList.add('aghi-up-noscroll');

    // Force layout so the transition actually plays instead of the sheet
    // appearing already in its open position.
    requestAnimationFrame(() => {
      popupEl.classList.add('aghi-up-mobile-open');
      backdropEl.classList.add('aghi-up-mobile-open');
    });

    document.addEventListener('keydown', onKeyDown);
  }

  async function open(anchorEl, { userId, username } = {}) {
    injectStyles();
    close();

    const params = userId ? `id=${encodeURIComponent(userId)}` : `username=${encodeURIComponent(username)}`;
    let data;
    try {
      const res = await fetch(`/api/user-profile.php?${params}`, { credentials: 'same-origin' });
      data = await res.json();
    } catch (err) {
      return;
    }
    if (!data || !data.ok) return;
    currentData = data;

    const mainRole = data.mainRole || data.role || 'MEMBER';
    const mainRoleStyle = getMainRoleStyle(mainRole);
    const presence = effectivePresence(data);

    const targetId = data.id ?? data.userId ?? userId ?? null;
    const widgetApi = window.AghiAccountWidget;
    const canMessage = !!(
      widgetApi &&
      targetId !== null &&
      widgetApi.isLoggedIn && widgetApi.isLoggedIn() &&
      String(widgetApi.getCurrentUserId()) !== String(targetId)
    );

    isMobileMode = isMobileViewport();
    if (isMobileMode) {
      openMobileSheet(data, mainRole, mainRoleStyle, presence, canMessage);
    } else {
      openDesktopPopup(anchorEl, data, mainRole, mainRoleStyle, presence, canMessage);
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-aghi-username], [data-aghi-userid]');
    if (!trigger) return;
    const username = trigger.getAttribute('data-aghi-username');
    const userId = trigger.getAttribute('data-aghi-userid');
    open(trigger, { userId, username });
  });

  return { open, close };
})();