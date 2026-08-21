/**
 * account-widget.js
 *
 * Drop-in nav auth widget for static Aghimuan pages.
 */
(function () {
  'use strict';

  const MOUNT_ID = 'aghi-account-widget';

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
  const PRESET_IDS = PFP_PRESETS.map((p) => p.id);

  const PRESENCE_OPTIONS = [
    { id: 'online', label: 'Online',         color: '#3ddc84' },
    { id: 'away',   label: 'Away',           color: '#f5c542' },
    { id: 'dnd',    label: 'Do Not Disturb', color: '#e05260' },
    { id: 'invisible', label: 'Invisible',   color: '#6b8b9a' },
  ];

  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
  const MAX_BIO_LENGTH = 300;
  const MAX_STATUS_LENGTH = 60;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
  const HEARTBEAT_INTERVAL_MS = 15 * 1000;

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

  function isCustomAvatar(pfpId) {
    return !PRESET_IDS.includes(pfpId);
  }

  function presetColor(pfpId) {
    const match = PFP_PRESETS.find((p) => p.id === pfpId);
    return (match || PFP_PRESETS[0]).color;
  }

  function presenceInfo(id) {
    return PRESENCE_OPTIONS.find((p) => p.id === id) || PRESENCE_OPTIONS[0];
  }

  const OFFLINE_COLOR = '#6b8b9a';

  // Same invisible/stale-collapsing rule used in user-profile-popup.js:
  // invisible (or a stale/expired session) always reads as plain Offline to
  // anyone but the user themselves — never surfaced as online here.
  function effectiveDmPresence(data) {
    if (!data || !data.online || data.presence === 'invisible') {
      return { label: 'Offline', color: OFFLINE_COLOR };
    }
    return presenceInfo(data.presence);
  }

  // Drops (or updates) a corner presence dot into any avatar wrapper with
  // position:relative — used for DM thread-list avatars and the open-thread
  // header avatar. `data` is a { presence, online } shaped object as returned
  // by dms.php's other_user_info().
  function renderPresenceDot(wrapEl, data) {
    if (!wrapEl) return;
    let dot = wrapEl.querySelector('.aghi-aw-dm-presence-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'aghi-aw-dm-presence-dot';
      wrapEl.appendChild(dot);
    }
    const info = effectiveDmPresence(data);
    dot.style.background = info.color;
    dot.title = info.label;
  }

  // Themed replacement for window.confirm(), same behavior as comments.js's
  // showConfirmModal: resolves true/false, closes on backdrop click, Escape,
  // or Enter.
  function showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-aw-modal-backdrop';
      backdrop.innerHTML = `
        <div class="aghi-aw-modal">
          <p class="aghi-aw-modal-title">${escapeHtml(title)}</p>
          <p class="aghi-aw-modal-msg">${escapeHtml(message)}</p>
          <div class="aghi-aw-modal-actions">
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-confirm" data-action="confirm">Delete</button>
          </div>
        </div>
      `;
      function close(result) {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter') close(true);
      }
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
      backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
      backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
      document.addEventListener('keydown', onKey);
      document.body.appendChild(backdrop);
    });
  }

  function applyAvatar(el, pfpId, username) {
    el.innerHTML = '';
    if (isCustomAvatar(pfpId)) {
      el.style.backgroundImage = `url('/uploads/pfp/${encodeURIComponent(pfpId)}')`;
      el.style.backgroundColor = '#0a1520';
    } else {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = presetColor(pfpId);
      const span = document.createElement('span');
      span.className = 'aghi-aw-monogram';
      span.textContent = (username || '?').charAt(0).toUpperCase();
      el.appendChild(span);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function daysUntil(isoDate) {
    if (!isoDate) return 0;
    const ms = new Date(isoDate).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 86400000) : 0;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return 'now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 5) return `${diffWeek}w`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function notifText(item) {
    const name = escapeHtml(item.actorUsername || 'Someone');
    if (item.kind === 'friend_accept') {
      return `<strong>${name}</strong> accepted your friend request.`;
    }
    let payload = item.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) { payload = null; }
    }
    if (payload && typeof payload.text === 'string' && payload.text) {
      return escapeHtml(payload.text);
    }
    return `<strong>${name}</strong> sent you a notification.`;
  }

  function injectStyles() {
    if (document.getElementById('aghi-account-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'aghi-account-widget-styles';
    style.textContent = `
      .aghi-aw { position: relative; font-family: 'Rajdhani', sans-serif; display: inline-block; flex-shrink: 0; }
      .aghi-aw-guest { display: flex; gap: 14px; align-items: center; }
      .aghi-aw-guest a { color: #8ab4c4; text-decoration: none; font-size: 14px; letter-spacing: 0.03em; }
      .aghi-aw-guest a:hover { color: #55F1F8; }
      .aghi-aw-guest a.aghi-aw-signup { color: #55F1F8; border: 1px solid rgba(85, 241, 248, 0.4); border-radius: 6px; padding: 6px 14px; }
      .aghi-aw-guest a.aghi-aw-signup:hover { background: rgba(85, 241, 248, 0.08); }

      .aghi-aw-row { display: flex; align-items: center; gap: 8px; }

      .aghi-aw-inbox-btn { width: 38px; height: 38px; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; color: #a9c2ce; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0; margin: 0; font: inherit; -webkit-appearance: none; appearance: none; transition: background 0.15s, color 0.15s; }
      .aghi-aw-inbox-btn:hover { background: rgba(255,255,255,0.08); color: #55F1F8; }
      .aghi-aw-inbox-btn svg { width: 20px; height: 20px; }
      .aghi-aw-inbox-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid #0c1620; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      .aghi-aw-avatar-btn { width: 38px; height: 38px; border-radius: 50%; padding: 0; cursor: pointer; border: 2px solid rgba(48, 150, 199, 0.5); background-color: #0a1520; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, box-shadow 0.15s; }
      .aghi-aw-monogram { font-family: 'Orbitron', sans-serif; font-size: 14px; color: #F1F2F5; user-select: none; }
      .aghi-aw-avatar-btn:hover, .aghi-aw-avatar-btn[aria-expanded="true"] { border-color: #55F1F8; box-shadow: 0 0 10px rgba(85, 241, 248, 0.35); }

      .aghi-aw-request-btn { width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid rgba(48,150,199,0.3); background: rgba(255,255,255,0.03); color: #a9c2ce; cursor: pointer; }
      .aghi-aw-request-btn svg { width: 13px; height: 13px; }
      .aghi-aw-request-btn.aghi-aw-accept:hover { background: rgba(61,220,132,0.16); border-color: rgba(61,220,132,0.5); color: #3ddc84; }
      .aghi-aw-request-btn.aghi-aw-decline:hover { background: rgba(224,82,96,0.16); border-color: rgba(224,82,96,0.5); color: #ff9aa4; }

      .aghi-aw-popup { position: absolute; top: calc(100% + 10px); right: 0; width: 300px; background: #0c1620; border: 1px solid rgba(48, 150, 199, 0.35); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 24px rgba(48,150,199,0.06); z-index: 1000; overflow: visible; color: #F1F2F5; }
      .aghi-aw-popup::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; border-radius: 10px; overflow: hidden; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 0%, rgba(85,241,248,0.05), transparent 60%); }
      .aghi-aw-popup > * { position: relative; z-index: 1; }
      .aghi-aw-banner { height: 56px; background: linear-gradient(135deg, #163247, #0a1a26); border-radius: 10px 10px 0 0; position: relative; }
      .aghi-aw-banner::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: linear-gradient(90deg, transparent, #55F1F8, #3096C7, transparent); box-shadow: 0 0 10px rgba(85,241,248,0.6); }
      .aghi-aw-popup-body { padding: 0 16px 16px; margin-top: -30px; position: relative; }

      .aghi-aw-avatar-wrap { width: 64px; height: 64px; border-radius: 50%; position: relative; cursor: pointer; border: 4px solid #0c1620; margin-bottom: 8px; box-shadow: 0 0 0 1px rgba(85,241,248,0.4), 0 0 14px rgba(48,150,199,0.35); }
      .aghi-aw-popup-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #0a1520; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .aghi-aw-popup-avatar .aghi-aw-monogram { font-size: 22px; }
      .aghi-aw-avatar-hover { position: absolute; inset: 0; border-radius: 50%; background: rgba(6, 11, 16, 0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s; pointer-events: none; }
      .aghi-aw-avatar-wrap:hover .aghi-aw-avatar-hover { opacity: 1; }
      .aghi-aw-avatar-hover svg { width: 20px; height: 20px; }

      .aghi-aw-bio-bubble { position: absolute; top: -4px; left: 78px; max-width: 168px; background: #1a2733; border: 1px solid rgba(48,150,199,0.3); border-radius: 14px; padding: 8px 12px; font-size: 12px; line-height: 1.35; color: #d7dee2; cursor: pointer; }
      .aghi-aw-bio-bubble.aghi-aw-empty { color: #55697a; font-style: italic; }
      .aghi-aw-bio-bubble:hover { border-color: rgba(85,241,248,0.5); }

      .aghi-aw-username-row { display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 2px; }
      .aghi-aw-username { font-family: 'Orbitron', sans-serif; font-size: 16px; color: #F1F2F5; margin: 0; text-shadow: 0 0 12px rgba(85,241,248,0.25); }
      .aghi-aw-username-edit-icon { opacity: 0; transition: opacity 0.15s; display: flex; }
      .aghi-aw-username-row:hover .aghi-aw-username-edit-icon { opacity: 1; }
      .aghi-aw-username-edit-icon svg { width: 13px; height: 13px; color: #6b8b9a; }
      .aghi-aw-username-row.aghi-aw-locked { cursor: default; }
      .aghi-aw-username-row.aghi-aw-locked:hover .aghi-aw-username-edit-icon { opacity: 0.4; }
      .aghi-aw-username-cooldown { font-size: 10px; color: #55697a; margin: 2px 0 0; }

      .aghi-aw-role { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; padding: 2px 8px; margin: 6px 0 10px; }

      .aghi-aw-presence-btn { display: flex; align-items: center; gap: 8px; width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(48,150,199,0.2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; cursor: pointer; color: #F1F2F5; font-size: 13px; font-family: 'Rajdhani', sans-serif; }
      .aghi-aw-presence-btn:hover { border-color: rgba(85,241,248,0.4); }
      .aghi-aw-presence-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .aghi-aw-presence-btn .aghi-aw-presence-label { flex: 1; text-align: left; }
      .aghi-aw-presence-chevron { color: #6b8b9a; }

      .aghi-aw-presence-menu { position: absolute; left: 16px; right: 16px; margin-top: -6px; background: #101d29; border: 1px solid rgba(48,150,199,0.35); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 1001; overflow: hidden; }
      .aghi-aw-presence-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: none; border: none; color: #d7dee2; font-size: 13px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-align: left; }
      .aghi-aw-presence-option:hover { background: rgba(85,241,248,0.08); }
      .aghi-aw-presence-option.aghi-aw-selected { color: #55F1F8; }

      .aghi-aw-input, .aghi-aw-textarea { width: 100%; box-sizing: border-box; background: #0a1520; border: 1px solid rgba(48,150,199,0.4); border-radius: 6px; padding: 8px 10px; color: #F1F2F5; font-family: 'Rajdhani', sans-serif; font-size: 13px; resize: vertical; }
      .aghi-aw-input:focus, .aghi-aw-textarea:focus { outline: none; border-color: #55F1F8; }
      .aghi-aw-charcount { font-size: 10px; color: #55697a; text-align: right; margin-top: 3px; }

      .aghi-aw-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
      .aghi-aw-btn { flex: 1; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Orbitron', sans-serif; letter-spacing: 0.03em; border: none; }
      .aghi-aw-btn-save { background: linear-gradient(180deg, #3096C7, #1E5A8A); color: #fff; }
      .aghi-aw-btn-save:hover { filter: brightness(1.15); }
      .aghi-aw-btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #8ab4c4; }
      .aghi-aw-btn-cancel:hover { border-color: rgba(255,255,255,0.3); }

      .aghi-aw-section { background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(48,150,199,0.18); border-radius: 8px; padding: 12px 14px; margin: 10px 0; transition: border-color 0.15s, box-shadow 0.15s; }
      .aghi-aw-about-label { display: flex; align-items: center; gap: 6px; font-family: 'Orbitron', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #55F1F8; margin-bottom: 8px; }
      .aghi-aw-about-label::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, #55F1F8, #3096C7); box-shadow: 0 0 6px rgba(85,241,248,0.6); }
      .aghi-aw-about-view { cursor: pointer; }
      .aghi-aw-about-view:hover { border-color: rgba(85,241,248,0.45); box-shadow: 0 0 12px rgba(48,150,199,0.15); }
      .aghi-aw-about-text { font-size: 13px; line-height: 1.5; color: #d7dee2; white-space: pre-wrap; }
      .aghi-aw-about-text.aghi-aw-empty { color: #55697a; font-style: italic; }

      .aghi-aw-subroles-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; margin-bottom: 10px; }
      .aghi-aw-subrole-badge { font-size: 10px; font-family: 'Rajdhani', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; }

      .aghi-aw-upload-label { display: block; text-align: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; background: rgba(85,241,248,0.08); border: 1px solid rgba(85,241,248,0.3); color: #55F1F8; font-size: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 0.03em; margin-bottom: 8px; }
      .aghi-aw-upload-label:hover { background: rgba(85,241,248,0.14); }
      .aghi-aw-upload-hint { font-size: 10px; color: #55697a; text-align: center; margin: -4px 0 10px; }

      .aghi-aw-reset-link { display: block; width: 100%; text-align: center; background: none; border: none; color: #8ab4c4; font-size: 11px; cursor: pointer; margin-bottom: 10px; text-decoration: underline; }
      .aghi-aw-reset-link:hover { color: #F1F2F5; }

      .aghi-aw-pfp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .aghi-aw-pfp-option { width: 100%; aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .aghi-aw-pfp-option.aghi-aw-selected { border-color: #55F1F8; box-shadow: 0 0 6px rgba(85,241,248,0.4); }

      .aghi-aw-logout { width: 100%; margin-top: 4px; padding: 8px; background: rgba(217,85,85,0.08); border: 1px solid rgba(217,85,85,0.3); border-radius: 6px; color: #ff8b8b; font-family: 'Orbitron', sans-serif; font-size: 12px; letter-spacing: 0.03em; cursor: pointer; }
      .aghi-aw-logout:hover { background: rgba(217,85,85,0.15); }

      .aghi-aw-error { font-size: 11px; color: #ff8b8b; margin-top: 6px; }

      @media (max-width: 768px) {
        .aghi-aw-popup { position: absolute; top: calc(100% + 10px); right: 0; left: auto; width: calc(100vw - 32px); max-width: 300px; max-height: 85vh; overflow-y: auto; border-radius: 10px; }
      }

      .aghi-aw-inbox-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 340px; max-width: calc(100vw - 32px); max-height: 70vh; display: flex; flex-direction: column; background: #0c1620; border: 1px solid rgba(48, 150, 199, 0.35); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 24px rgba(48,150,199,0.06); z-index: 1000; color: #F1F2F5; overflow: hidden; }
      .aghi-aw-inbox-panel::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 0%, rgba(85,241,248,0.05), transparent 60%); }
      .aghi-aw-inbox-panel > * { position: relative; z-index: 1; }

      .aghi-aw-inbox-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(48,150,199,0.18); flex-shrink: 0; }
      .aghi-aw-inbox-title { font-family: 'Orbitron', sans-serif; font-size: 13px; letter-spacing: 0.04em; color: #55F1F8; text-shadow: 0 0 10px rgba(85,241,248,0.3); margin: 0; }
      .aghi-aw-inbox-header-actions { display: flex; align-items: center; gap: 10px; }
      .aghi-aw-inbox-markall { background: none; border: 1px solid rgba(48, 150, 199, 0.3); color: #8ab4c4; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-family: 'Rajdhani', sans-serif; cursor: pointer; transition: border-color 0.15s, color 0.15s; white-space: nowrap; }
      .aghi-aw-inbox-markall:hover { border-color: #55F1F8; color: #55F1F8; }
      .aghi-aw-inbox-markall[disabled] { opacity: 0.4; cursor: default; }
      .aghi-aw-inbox-close { width: 26px; height: 26px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: none; border: none; color: #6b8b9a; cursor: pointer; border-radius: 6px; }
      .aghi-aw-inbox-close svg { width: 15px; height: 15px; }
      .aghi-aw-inbox-close:hover { background: rgba(255,255,255,0.06); color: #F1F2F5; }

      .aghi-aw-inbox-list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
      .aghi-aw-inbox-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 8px; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(48,150,199,0.12); position: relative; }
      .aghi-aw-inbox-item.aghi-aw-unread { border-color: rgba(48, 150, 199, 0.4); background: linear-gradient(180deg, rgba(85,241,248,0.06), rgba(255,255,255,0.01)); }
      .aghi-aw-inbox-item.aghi-aw-clickable { cursor: pointer; }
      .aghi-aw-inbox-item.aghi-aw-unread::after { content: ''; position: absolute; top: 12px; right: 10px; width: 7px; height: 7px; border-radius: 50%; background: #55F1F8; box-shadow: 0 0 6px rgba(85,241,248,0.7); }
      .aghi-aw-inbox-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background-color: #0a1520; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-aw-inbox-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-inbox-body { flex: 1; min-width: 0; padding-right: 10px; }
      .aghi-aw-inbox-text { font-size: 13px; line-height: 1.4; color: #d7dee2; }
      .aghi-aw-inbox-text strong { color: #F1F2F5; }
      .aghi-aw-inbox-time { font-size: 11px; color: #6b8b9a; margin-top: 3px; }
      .aghi-aw-inbox-actions { display: flex; gap: 6px; margin-top: 8px; }
      .aghi-aw-inbox-actions .aghi-aw-request-btn { width: 26px; height: 26px; }
      .aghi-aw-inbox-actions .aghi-aw-request-btn svg { width: 14px; height: 14px; }

      .aghi-aw-inbox-empty { text-align: center; padding: 36px 12px; color: #6b8b9a; font-size: 13px; }
      .aghi-aw-inbox-loading { text-align: center; padding: 20px 12px; color: #6b8b9a; font-size: 12px; }

      .aghi-aw-inbox-loadmore { display: block; width: calc(100% - 12px); margin: 4px 6px 8px; background: none; border: 1px solid rgba(48,150,199,0.3); color: #8ab4c4; padding: 7px; border-radius: 6px; font-size: 12px; font-family: 'Rajdhani', sans-serif; cursor: pointer; flex-shrink: 0; }
      .aghi-aw-inbox-loadmore:hover { border-color: #55F1F8; color: #55F1F8; }
      .aghi-aw-inbox-loadmore[hidden] { display: none; }

      .aghi-aw-inbox-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(4,8,12,0.55); }

      @media (max-width: 768px) {
        .aghi-aw-inbox-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1000; width: auto; max-width: none; max-height: 82vh; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-inbox-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); z-index: 2; }
      }

      /* --- Direct Messages --- */
      .aghi-aw-dm-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid #0c1620; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      .aghi-aw-dm-panel {
        position: absolute; top: calc(100% + 10px); right: 0; width: 380px; max-width: calc(100vw - 32px);
        height: 520px; max-height: 75vh; display: flex; flex-direction: column;
        background: #0c1620; border: 1px solid rgba(48, 150, 199, 0.35); border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 24px rgba(48,150,199,0.06);
        z-index: 1000; color: #F1F2F5; overflow: hidden;
      }
      .aghi-aw-dm-panel::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 0%, rgba(85,241,248,0.05), transparent 60%); }
      .aghi-aw-dm-panel > * { position: relative; z-index: 1; }

      .aghi-aw-dm-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(48,150,199,0.18); flex-shrink: 0; }
      .aghi-aw-dm-title { font-family: 'Orbitron', sans-serif; font-size: 13px; letter-spacing: 0.04em; color: #55F1F8; text-shadow: 0 0 10px rgba(85,241,248,0.3); margin: 0; flex: 1; }
      .aghi-aw-dm-back, .aghi-aw-dm-close { width: 26px; height: 26px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: none; border: none; color: #6b8b9a; cursor: pointer; border-radius: 6px; }
      .aghi-aw-dm-back svg, .aghi-aw-dm-close svg { width: 15px; height: 15px; }
      .aghi-aw-dm-back:hover, .aghi-aw-dm-close:hover { background: rgba(255,255,255,0.06); color: #F1F2F5; }
      .aghi-aw-dm-header-user { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
      .aghi-aw-dm-header-avatar-wrap { position: relative; flex-shrink: 0; cursor: pointer; }
      .aghi-aw-dm-header-avatar { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; background-color: #0a1520; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-aw-dm-header-avatar .aghi-aw-monogram { font-size: 11px; }
      .aghi-aw-dm-header-user-col { min-width: 0; display: flex; flex-direction: column; justify-content: center; cursor: pointer; }
      .aghi-aw-dm-header-username { font-size: 13px; font-weight: 600; color: #F1F2F5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .aghi-aw-dm-header-status { font-size: 10.5px; color: #7a93a1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; line-height: 1.3; }
      .aghi-aw-dm-header-status[hidden] { display: none; }

      /* Presence dot, corner-anchored on any avatar it's dropped into —
         parent needs position:relative, added per avatar wrapper below. */
      .aghi-aw-dm-presence-dot { position: absolute; right: -1px; bottom: -1px; width: 8px; height: 8px; border-radius: 50%; border: 2px solid #0c1620; box-sizing: content-box; }
      .aghi-aw-dm-thread-avatar-wrap .aghi-aw-dm-presence-dot { width: 9px; height: 9px; }

      .aghi-aw-dm-threads { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
      .aghi-aw-dm-thread-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(48,150,199,0.12); cursor: pointer; }
      .aghi-aw-dm-thread-item:hover { border-color: rgba(85,241,248,0.35); }
      .aghi-aw-dm-thread-item.aghi-aw-unread { border-color: rgba(48, 150, 199, 0.4); background: linear-gradient(180deg, rgba(85,241,248,0.06), rgba(255,255,255,0.01)); }
      .aghi-aw-dm-thread-avatar-wrap { position: relative; flex-shrink: 0; }
      .aghi-aw-dm-thread-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background-color: #0a1520; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-aw-dm-thread-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-dm-thread-body { flex: 1; min-width: 0; }
      .aghi-aw-dm-thread-name { font-size: 13px; font-weight: 600; color: #F1F2F5; }
      .aghi-aw-dm-thread-preview { font-size: 12px; color: #8ab4c4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
      .aghi-aw-dm-thread-preview.aghi-aw-dm-typing-preview { color: #55F1F8; font-style: italic; }
      .aghi-aw-dm-thread-item.aghi-aw-unread .aghi-aw-dm-thread-preview { color: #d7dee2; }
      .aghi-aw-dm-thread-time { font-size: 10.5px; color: #6b8b9a; flex-shrink: 0; }

      /* Thin themed scrollbars instead of the browser default. */
      .aghi-aw-dm-messages, .aghi-aw-dm-threads { scrollbar-width: thin; scrollbar-color: rgba(48,150,199,0.45) transparent; }
      .aghi-aw-dm-messages::-webkit-scrollbar, .aghi-aw-dm-threads::-webkit-scrollbar { width: 6px; }
      .aghi-aw-dm-messages::-webkit-scrollbar-track, .aghi-aw-dm-threads::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-dm-messages::-webkit-scrollbar-thumb, .aghi-aw-dm-threads::-webkit-scrollbar-thumb { background: rgba(48,150,199,0.45); border-radius: 999px; }
      .aghi-aw-dm-messages::-webkit-scrollbar-thumb:hover, .aghi-aw-dm-threads::-webkit-scrollbar-thumb:hover { background: rgba(85,241,248,0.6); }

      .aghi-aw-dm-messages { overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
      .aghi-aw-dm-msg { position: relative; display: flex; flex-direction: column; align-items: flex-start; max-width: 78%; }
      .aghi-aw-dm-msg-mine { align-self: flex-end; align-items: flex-end; }
      .aghi-aw-dm-bubble { background: rgba(255,255,255,0.05); border: 1px solid rgba(48,150,199,0.18); border-radius: 12px; padding: 8px 12px; font-size: 13px; line-height: 1.4; color: #d7dee2; white-space: pre-wrap; word-break: break-word; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble { background: linear-gradient(180deg, #1E5A8A, #163f61); border-color: rgba(85,241,248,0.3); color: #F1F2F5; }
      .aghi-aw-dm-bubble.aghi-aw-dm-deleted { font-style: italic; color: #55697a; background: transparent; }

      .aghi-aw-dm-msg-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; padding: 0 2px; }
      .aghi-aw-dm-msg-time { font-size: 10px; color: #6b8b9a; }
      .aghi-aw-dm-msg-edited { font-size: 10px; color: #6b8b9a; font-style: italic; }
      .aghi-aw-dm-ticks { display: inline-flex; align-items: center; color: #6b8b9a; }
      .aghi-aw-dm-ticks svg { width: 13px; height: 13px; }
      .aghi-aw-dm-ticks.aghi-aw-dm-seen { color: #55F1F8; }

      /* Hover/tap action bar: edit, delete, react — mine gets edit+delete+react,
         others only get react. Anchored to the top corner of the bubble on the
         side the bubble already leans toward. */
      .aghi-aw-dm-msg-actions { position: absolute; top: -13px; display: none; gap: 2px; background: #0c1620; border: 1px solid rgba(48,150,199,0.35); border-radius: 6px; padding: 2px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); z-index: 2; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-msg-actions { right: 0; }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) .aghi-aw-dm-msg-actions { left: 0; }
      .aghi-aw-dm-msg:hover .aghi-aw-dm-msg-actions, .aghi-aw-dm-msg-actions.aghi-aw-dm-actions-pinned { display: flex; }
      .aghi-aw-dm-msg-action-btn { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: #8ab4c4; cursor: pointer; border-radius: 4px; padding: 0; }
      .aghi-aw-dm-msg-action-btn:hover { background: rgba(255,255,255,0.08); color: #55F1F8; }
      .aghi-aw-dm-msg-action-btn.aghi-aw-dm-action-danger:hover { color: #ff9aa4; background: rgba(224,82,96,0.16); }
      .aghi-aw-dm-msg-action-btn svg { width: 13px; height: 13px; }

      .aghi-aw-dm-edit-box { display: flex; flex-direction: column; gap: 6px; width: 100%; }
      .aghi-aw-dm-edit-input { background: #0a1520; border: 1px solid rgba(85,241,248,0.4); border-radius: 8px; padding: 6px 10px; color: #F1F2F5; font-family: 'Rajdhani', sans-serif; font-size: 13px; resize: none; width: 100%; box-sizing: border-box; }
      .aghi-aw-dm-edit-input:focus { outline: none; }
      .aghi-aw-dm-edit-actions { display: flex; gap: 10px; font-size: 11px; }
      .aghi-aw-dm-edit-actions button { background: none; border: none; color: #8ab4c4; cursor: pointer; padding: 0; font-family: 'Rajdhani', sans-serif; }
      .aghi-aw-dm-edit-actions button:hover { color: #55F1F8; }

      /* Reaction pills — same visual language as comment-reactions.js's .cmr-*
         bar but namespaced separately since account-widget.js runs on every
         page and can't assume that stylesheet is present. */
      .aghi-aw-dm-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      .aghi-aw-dm-reactions:empty { display: none; }
      .aghi-aw-dm-reaction-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px; background: rgba(12,22,32,0.75); border: 1px solid rgba(48,150,199,0.3); cursor: pointer; font-family: 'Rajdhani', sans-serif; }
      .aghi-aw-dm-reaction-pill:hover { border-color: rgba(85,241,248,0.65); }
      .aghi-aw-dm-reaction-pill.aghi-aw-dm-reaction-active { background: rgba(85,241,248,0.16); border-color: rgba(85,241,248,0.75); }
      .aghi-aw-dm-reaction-emoji { width: 13px; height: 13px; object-fit: contain; }
      .aghi-aw-dm-reaction-count { font-size: 10.5px; font-weight: 700; color: #cbd6dc; }
      .aghi-aw-dm-reaction-active .aghi-aw-dm-reaction-count { color: #55F1F8; }

      /* Typing indicator: three bouncing dots, swapped in for the status
         line in the open-thread header while the other person is typing. */
      .aghi-aw-dm-typing-dots { display: inline-flex; align-items: center; gap: 3px; height: 12px; }
      .aghi-aw-dm-typing-dots span { width: 4px; height: 4px; border-radius: 50%; background: #55F1F8; opacity: 0.4; animation: aghiAwTypingBounce 1.2s infinite ease-in-out; }
      .aghi-aw-dm-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
      .aghi-aw-dm-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes aghiAwTypingBounce { 0%, 60%, 100% { opacity: 0.4; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

      .aghi-aw-dm-composer { display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px; border-top: 1px solid rgba(48,150,199,0.18); flex-shrink: 0; }
      .aghi-aw-dm-input { flex: 1; resize: none; max-height: 90px; background: #0a1520; border: 1px solid rgba(48,150,199,0.4); border-radius: 8px; padding: 8px 10px; color: #F1F2F5; font-family: 'Rajdhani', sans-serif; font-size: 13px; }
      .aghi-aw-dm-input:focus { outline: none; border-color: #55F1F8; }
      .aghi-aw-dm-send { width: 34px; height: 34px; flex-shrink: 0; border-radius: 8px; border: none; background: linear-gradient(180deg, #3096C7, #1E5A8A); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .aghi-aw-dm-send:hover { filter: brightness(1.15); }
      .aghi-aw-dm-send svg { width: 15px; height: 15px; }

      .aghi-aw-dm-empty { text-align: center; padding: 36px 12px; color: #6b8b9a; font-size: 13px; }
      .aghi-aw-dm-loading { text-align: center; padding: 20px 12px; color: #6b8b9a; font-size: 12px; }

      .aghi-aw-dm-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(4,8,12,0.55); }

      /* Themed confirm modal, same visual language as comments.js's
         .aghi-cm-modal-* (title/message/cancel/confirm), namespaced
         separately since account-widget.js can't assume that stylesheet is
         loaded on every page it runs on. */
      .aghi-aw-modal-backdrop { position: fixed; inset: 0; background: rgba(4,8,12,0.7); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: aghiAwModalFadeIn 0.15s ease; }
      @keyframes aghiAwModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .aghi-aw-modal { background: #0c1620; border: 1px solid rgba(224, 82, 96, 0.35); border-radius: 14px; padding: 22px 24px; width: 310px; max-width: calc(100vw - 40px); box-shadow: 0 10px 40px rgba(0,0,0,0.65), 0 0 24px rgba(224,82,96,0.12); font-family: 'Rajdhani', sans-serif; color: #F1F2F5; }
      .aghi-aw-modal-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #ff8b96; }
      .aghi-aw-modal-msg { font-size: 14px; color: #98a7b0; margin: 0 0 20px; line-height: 1.45; }
      .aghi-aw-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .aghi-aw-modal-btn { border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700; font-family: 'Rajdhani', sans-serif; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
      .aghi-aw-modal-btn.aghi-aw-modal-cancel { background: transparent; border-color: rgba(255,255,255,0.15); color: #98a7b0; }
      .aghi-aw-modal-btn.aghi-aw-modal-cancel:hover { border-color: rgba(255,255,255,0.3); color: #F1F2F5; }
      .aghi-aw-modal-btn.aghi-aw-modal-confirm { background: rgba(224, 82, 96, 0.15); border-color: rgba(224, 82, 96, 0.5); color: #ff8b96; }
      .aghi-aw-modal-btn.aghi-aw-modal-confirm:hover { background: rgba(224, 82, 96, 0.28); }

      /* Desktop stays "just a window" — the same floating-dropdown treatment
         as the notification panel above. Mobile becomes a Discord-style
         drawer sliding in from the left edge instead. */
      @media (max-width: 768px) {
        .aghi-aw-dm-panel {
          position: fixed; top: 0; bottom: 0; left: 0; right: auto; z-index: 1000;
          width: 85vw; max-width: 340px; height: 100%; max-height: none;
          border-radius: 0 16px 16px 0;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          padding-top: env(safe-area-inset-top, 0);
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .aghi-aw-dm-panel.aghi-aw-dm-panel-open { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const CAMERA_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#F1F2F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const PENCIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
  const CHEVRON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const BELL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
  const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
  const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const REACT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 13c.9 1.2 2.1 2 4 2s3.1-.8 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>`;
  const DOUBLE_CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 12 6 17 13 8"/><polyline points="9 17 22 4"/></svg>`;

  const INBOX_POLL_INTERVAL_MS = 5 * 1000;
  const TYPING_POLL_INTERVAL_MS = 2 * 1000; // separate faster loop, only while a thread is open
  const TYPING_PING_INTERVAL_MS = 2500; // how often we tell the server "still typing" — must stay under dms.php's TYPING_FRESHNESS_SECONDS (5s)
  const REACTION_POLL_INTERVAL_MS = 8 * 1000; // periodic refresh so the other participant's new reactions show up live

  function AccountWidget(mount) {
    this.mount = mount;
    this.state = { loading: true, loggedIn: false, user: null, csrfToken: null };
    this.popupOpen = false;
    this.editing = null;
    this.presenceMenuOpen = false;
    this.notifUnreadCount = 0;

    this.inboxOpen = false;
    this.inboxItems = [];
    this.inboxNextCursor = null;
    this.inboxLoading = false;
    this.inboxLoadedOnce = false;
    this.inboxError = null;

    this.dmUnreadCount = 0;
    this.dmOpen = false;
    this.dmView = 'threads'; // 'threads' | 'thread'
    this.dmThreads = [];
    this.dmNextCursor = null;
    this.dmThreadsLoading = false;
    this.dmThreadsLoadedOnce = false;
    this.dmThreadsError = null;
    this.dmActiveUser = null;
    this.dmMessages = [];
    this.dmMessagesLoading = false;
    this.dmMessagesLoadedOnce = false;
    this.dmMessagesError = null;
    this.dmLastMessageId = 0; // cursor for incremental poll while a thread is open
    this.dmSending = false;
    this.dmOtherUser = null; // { presence, online, status, ... } for the open thread's partner
    this.dmReadUpToId = 0; // highest own-message id the partner has read
    this.dmOtherTyping = false;
    this.dmTypingPollTimer = null;
    this.dmReactionPollTimer = null;
    this.dmLastTypingPingAt = 0;
    this.dmEditingMessageId = null;
    this.dmReactionCache = new Map(); // messageId -> { counts, userReactions }

    this.onDocClick = this.onDocClick.bind(this);
  }

  AccountWidget.prototype.init = async function () {
    this.mount.innerHTML = '';
    this.mount.className = 'aghi-aw';
    try {
      const res = await fetch('/api/session.php', { credentials: 'same-origin' });
      const data = await res.json();
      this.state = { loading: false, loggedIn: !!data.loggedIn, user: data.user, csrfToken: data.csrfToken || null };
    } catch (e) {
      this.state = { loading: false, loggedIn: false, user: null, csrfToken: null };
    }
    this.render();
    document.addEventListener('click', this.onDocClick);
    if (this.state.loggedIn) {
      this.startPresenceHeartbeat();
      await this.fetchInboxSummary();
      this.startInboxPolling();
      await this.fetchDmUnreadCount();
      this.startDmPolling();
    }
  };

  AccountWidget.prototype.fetchInboxSummary = async function () {
    try {
      const res = await fetch('/api/inbox.php?action=summary', { credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        const changed = data.unreadCount !== this.notifUnreadCount;
        this.notifUnreadCount = data.unreadCount;
        this.refreshInboxBadge(this.mount.querySelector('.aghi-aw-inbox-btn'));
        if (this.inboxOpen && changed) this.fetchInboxList(true);
      }
    } catch (e) {
    }
  };

  AccountWidget.prototype.refreshInboxBadge = function (inboxBtn) {
    if (!inboxBtn) return;
    let badge = inboxBtn.querySelector('.aghi-aw-inbox-badge');
    if (this.notifUnreadCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'aghi-aw-inbox-badge';
        inboxBtn.appendChild(badge);
      }
      badge.textContent = this.notifUnreadCount > 9 ? '9+' : String(this.notifUnreadCount);
    } else if (badge) {
      badge.remove();
    }
  };

  AccountWidget.prototype.startInboxPolling = function () {
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchInboxSummary();
      }
    }, INBOX_POLL_INTERVAL_MS);
  };

  AccountWidget.prototype.fetchDmUnreadCount = async function () {
    try {
      const res = await fetch('/api/dms.php?action=unread_count', { credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        this.dmUnreadCount = data.unreadCount;
        this.refreshDmBadge(this.mount.querySelector('.aghi-aw-dm-btn'));
      }
    } catch (e) {
    }
  };

  AccountWidget.prototype.refreshDmBadge = function (dmBtn) {
    if (!dmBtn) return;
    let badge = dmBtn.querySelector('.aghi-aw-dm-badge');
    if (this.dmUnreadCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'aghi-aw-dm-badge';
        dmBtn.appendChild(badge);
      }
      badge.textContent = this.dmUnreadCount > 9 ? '9+' : String(this.dmUnreadCount);
    } else if (badge) {
      badge.remove();
    }
  };

  // Same interval as notification polling. While a thread is open this also
  // pulls new messages for it; while the threads list is open it refreshes
  // previews/ordering. Kept as one timer rather than a second setInterval
  // so a background tab isn't running two near-identical polling loops.
  AccountWidget.prototype.startDmPolling = function () {
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.fetchDmUnreadCount();
      if (this.dmOpen && this.dmView === 'thread' && this.dmActiveUser) {
        this.pollDmThread();
      } else if (this.dmOpen && this.dmView === 'threads') {
        this.fetchDmThreads(true);
      }
    }, INBOX_POLL_INTERVAL_MS);
  };

  AccountWidget.prototype.startPresenceHeartbeat = function () {
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/session.php', { credentials: 'same-origin' }).catch(() => {});
    };
    setInterval(ping, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ping();
    });
    window.addEventListener('pagehide', () => {
      if (!this.state.csrfToken) return;
      const body = new Blob(
        [`csrf_token=${encodeURIComponent(this.state.csrfToken)}`],
        { type: 'application/x-www-form-urlencoded' }
      );
      navigator.sendBeacon('/api/mark-offline.php', body);
    });
  };

  AccountWidget.prototype.onDocClick = function (e) {
    const path = e.composedPath ? e.composedPath() : [];

    // The shared emoji picker (emoji-picker-core.js) renders its popover by
    // appending it directly to document.body, not inside this.mount or any
    // of our panels — so a click on an emoji cell has to be recognized here
    // explicitly, or it looks identical to a genuine outside click and closes
    // whatever panel opened the picker (e.g. reacting to a DM message).
    const insidePicker = path.some((el) => el.classList && el.classList.contains('cmr-picker'));
    if (insidePicker) return;

    if (this.presenceMenuOpen && this.presenceMenuEl && !path.includes(this.presenceMenuEl) && !path.includes(this.presenceBtnEl)) {
      this.presenceMenuOpen = false;
      this.rerenderPopup();
      return;
    }
    if (this.popupOpen && !path.includes(this.mount)) {
      this.popupOpen = false;
      this.editing = null;
      this.presenceMenuOpen = false;
      this.render();
    }
    if (this.inboxOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-inbox-panel'));
      if (!insideWidget && !insidePanel) {
        this.inboxOpen = false;
        this.render();
      }
    }
    if (this.dmOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-dm-panel'));
      if (!insideWidget && !insidePanel) {
        this.dmOpen = false;
        this.render();
      }
    }
  };

  AccountWidget.prototype.render = function () {
    document.querySelectorAll('.aghi-aw-inbox-backdrop, .aghi-aw-inbox-panel, .aghi-aw-dm-backdrop, .aghi-aw-dm-panel').forEach((el) => el.remove());

    // Full render() replaces the DOM, so any open-thread state that isn't
    // currently visible shouldn't keep its typing-poll timer alive — covers
    // every way the DM panel/thread can close (inbox button, avatar button,
    // outside click, mobile backdrop) from one place instead of repeating
    // this at each individual close handler.
    if (!this.dmOpen || this.dmView !== 'thread') {
      this.stopDmTypingPolling();
    }

    if (this.state.loading) {
      this.mount.innerHTML = '';
      return;
    }
    if (!this.state.loggedIn) {
      this.renderGuest();
    } else {
      this.renderLoggedIn();
    }
  };

  AccountWidget.prototype.renderGuest = function () {
    this.mount.innerHTML = `
      <div class="aghi-aw-guest">
        <a href="/login.php">Log in</a>
        <a href="/signup.php" class="aghi-aw-signup">Sign up</a>
      </div>
    `;
  };

  AccountWidget.prototype.renderLoggedIn = function () {
    const user = this.state.user;

    const inboxBtn = document.createElement('button');
    inboxBtn.type = 'button';
    inboxBtn.className = 'aghi-aw-inbox-btn';
    inboxBtn.setAttribute('aria-label', 'Notifications');
    inboxBtn.setAttribute('aria-expanded', String(this.inboxOpen));
    inboxBtn.innerHTML = BELL_ICON;
    this.refreshInboxBadge(inboxBtn);
    inboxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !this.inboxOpen;
      this.inboxOpen = opening;
      if (opening) {
        this.popupOpen = false; this.dmOpen = false; this.editing = null; this.presenceMenuOpen = false;
      }
      this.render();
      if (opening) this.fetchInboxList(true);
    });

    const dmBtn = document.createElement('button');
    dmBtn.type = 'button';
    dmBtn.className = 'aghi-aw-dm-btn aghi-aw-inbox-btn';
    dmBtn.setAttribute('aria-label', 'Direct messages');
    dmBtn.setAttribute('aria-expanded', String(this.dmOpen));
    dmBtn.innerHTML = CHAT_ICON;
    this.refreshDmBadge(dmBtn);
    dmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !this.dmOpen;
      this.dmOpen = opening;
      if (opening) {
        this.popupOpen = false; this.inboxOpen = false; this.editing = null; this.presenceMenuOpen = false;
      }
      this.render();
      if (opening) {
        if (this.dmView === 'thread' && this.dmActiveUser) {
          this.openDmThread(this.dmActiveUser, false);
        } else {
          this.fetchDmThreads(true);
        }
      }
    });

    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'aghi-aw-avatar-btn';
    applyAvatar(avatarBtn, user.pfpId, user.username);
    avatarBtn.setAttribute('aria-expanded', String(this.popupOpen));
    avatarBtn.setAttribute('aria-label', `Account menu for ${user.username}`);
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.popupOpen = !this.popupOpen;
      if (this.popupOpen) {
        this.inboxOpen = false; this.dmOpen = false;
      } else {
        this.editing = null; this.presenceMenuOpen = false;
      }
      this.render();
    });

    const row = document.createElement('div');
    row.className = 'aghi-aw-row';
    row.appendChild(inboxBtn);
    row.appendChild(dmBtn);
    row.appendChild(avatarBtn);

    this.mount.innerHTML = '';
    this.mount.appendChild(row);

    if (this.popupOpen) {
      this.mount.appendChild(this.buildPopup());
    }
    if (this.inboxOpen) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        const backdrop = document.createElement('div');
        backdrop.className = 'aghi-aw-inbox-backdrop';
        backdrop.addEventListener('click', () => { this.inboxOpen = false; this.render(); });
        document.body.appendChild(backdrop);
        document.body.appendChild(this.buildInboxPanel());
      } else {
        this.mount.appendChild(this.buildInboxPanel());
      }
    }
    if (this.dmOpen) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        const backdrop = document.createElement('div');
        backdrop.className = 'aghi-aw-dm-backdrop';
        backdrop.addEventListener('click', () => { this.dmOpen = false; this.render(); });
        document.body.appendChild(backdrop);
        const panel = this.buildDmPanel();
        document.body.appendChild(panel);
        // Mount closed, then flip the class a frame later so the transform
        // transition actually plays instead of snapping straight to open.
        requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('aghi-aw-dm-panel-open')));
      } else {
        // Desktop: just a floating window anchored under the button, same
        // treatment as the notification panel — no drawer/slide behavior.
        this.mount.appendChild(this.buildDmPanel());
      }
    }
  };

  AccountWidget.prototype.buildPopup = function () {
    const user = this.state.user;
    const popup = document.createElement('div');
    popup.className = 'aghi-aw-popup';

    const mainRole = user.mainRole || user.role || 'MEMBER';
    const mainRoleStyle = getMainRoleStyle(mainRole);

    popup.innerHTML = `
      <div class="aghi-aw-banner"></div>
      <div class="aghi-aw-popup-body">
        <div class="aghi-aw-avatar-wrap" data-action="edit-avatar">
          <div class="aghi-aw-popup-avatar" data-el="popup-avatar"></div>
          <div class="aghi-aw-avatar-hover">${CAMERA_ICON}</div>
        </div>
        <div data-section="status"></div>
        <div data-section="username"></div>
        <span class="aghi-aw-role" style="${mainRoleStyle}">${escapeHtml(mainRole.toUpperCase())}</span>
        <div data-section="presence"></div>
        <div data-section="about"></div>
        <div data-section="subroles"></div>
        ${this.editing === 'pfp' ? '<div class="aghi-aw-section" data-section="pfp"></div>' : ''}
        <button type="button" class="aghi-aw-logout" data-action="logout">Log out</button>
      </div>
    `;

    applyAvatar(popup.querySelector('[data-el="popup-avatar"]'), user.pfpId, user.username);

    popup.querySelector('[data-action="edit-avatar"]').addEventListener('click', () => {
      this.editing = this.editing === 'pfp' ? null : 'pfp';
      this.rerenderPopup();
    });

    this.renderStatusSection(popup.querySelector('[data-section="status"]'));
    this.renderUsernameSection(popup.querySelector('[data-section="username"]'));
    this.renderPresenceSection(popup.querySelector('[data-section="presence"]'));
    this.renderAboutSection(popup.querySelector('[data-section="about"]'));
    this.renderSubrolesSection(popup.querySelector('[data-section="subroles"]'));
    
    if (this.editing === 'pfp') {
      this.renderPfpSection(popup.querySelector('[data-section="pfp"]'));
    }

    popup.querySelector('[data-action="logout"]').addEventListener('click', () => {
      window.location.href = '/logout.php';
    });

    return popup;
  };

  AccountWidget.prototype.renderSubrolesSection = function (el) {
    const user = this.state.user;
    let subrolesHtml = '';

    // Preset officer/adviser/committee sub-role (e.g. "President", "Faculty")
    // — was being stored and returned by the API, but this function never
    // read it, so it was the only badge that never appeared in the widget.
    if (user.subRole) {
      subrolesHtml += `<span class="aghi-aw-subrole-badge" style="background:#1e88e5;color:#fff;">${escapeHtml(user.subRole)}</span>`;
    }
    if (user.club) {
      const style = SUBROLE_STYLES[user.club] || 'background:#3096C7;color:#fff;';
      subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${escapeHtml(user.club)}</span>`;
    }
    if (user.grade) {
      const style = SUBROLE_STYLES[user.grade] || 'background:#455a64;color:#fff;';
      subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${escapeHtml(user.grade)}</span>`;
    }
    if (user.strand) {
      const style = SUBROLE_STYLES[user.strand] || 'background:#3096C7;color:#fff;';
      subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${escapeHtml(user.strand)}</span>`;
    }
    // Discord-style custom roles, assigned via admin.php's Users tab — same
    // field this function never read, so these never showed up either.
    if (Array.isArray(user.customRoles)) {
      user.customRoles.forEach((role) => {
        const style = `background:${role.color_css};color:${role.text_color};`;
        subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${escapeHtml(role.name)}</span>`;
      });
    }

    el.innerHTML = subrolesHtml ? `<div class="aghi-aw-subroles-row">${subrolesHtml}</div>` : '';
  };

  AccountWidget.prototype.renderStatusSection = function (el) {
    const user = this.state.user;
    if (this.editing === 'status') {
      el.innerHTML = `
        <div class="aghi-aw-section">
          <textarea class="aghi-aw-textarea" rows="2" maxlength="${MAX_STATUS_LENGTH}" placeholder="What have you been up to?">${escapeHtml(user.status)}</textarea>
          <div class="aghi-aw-charcount">0/${MAX_STATUS_LENGTH}</div>
          <div class="aghi-aw-edit-actions">
            <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
          </div>
          <div class="aghi-aw-error" hidden></div>
        </div>
      `;
      const textarea = el.querySelector('textarea');
      const count = el.querySelector('.aghi-aw-charcount');
      const updateCount = () => { count.textContent = `${textarea.value.length}/${MAX_STATUS_LENGTH}`; };
      updateCount();
      textarea.addEventListener('input', updateCount);
      el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        this.editing = null; this.rerenderPopup();
      });
      el.querySelector('[data-action="save"]').addEventListener('click', () => {
        this.saveProfile({ status: textarea.value }, el);
      });
    } else {
      el.innerHTML = `
        <div class="aghi-aw-bio-bubble ${user.status ? '' : 'aghi-aw-empty'}" data-action="edit" data-el="status-text"></div>
      `;
      el.querySelector('[data-el="status-text"]').textContent = user.status || 'Set a status…';
      el.querySelector('[data-action="edit"]').addEventListener('click', () => {
        this.editing = 'status'; this.rerenderPopup();
      });
    }
  };

  AccountWidget.prototype.renderAboutSection = function (el) {
    const user = this.state.user;
    if (this.editing === 'about') {
      el.innerHTML = `
        <div class="aghi-aw-section">
          <div class="aghi-aw-about-label">About Me</div>
          <textarea class="aghi-aw-textarea" rows="3" maxlength="${MAX_BIO_LENGTH}" placeholder="Tell people a bit about yourself…">${escapeHtml(user.bio)}</textarea>
          <div class="aghi-aw-charcount">0/${MAX_BIO_LENGTH}</div>
          <div class="aghi-aw-edit-actions">
            <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
          </div>
          <div class="aghi-aw-error" hidden></div>
        </div>
      `;
      const textarea = el.querySelector('textarea');
      const count = el.querySelector('.aghi-aw-charcount');
      const updateCount = () => { count.textContent = `${textarea.value.length}/${MAX_BIO_LENGTH}`; };
      updateCount();
      textarea.addEventListener('input', updateCount);
      el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        this.editing = null; this.rerenderPopup();
      });
      el.querySelector('[data-action="save"]').addEventListener('click', () => {
        this.saveProfile({ bio: textarea.value }, el);
      });
    } else {
      el.innerHTML = `
        <div class="aghi-aw-section aghi-aw-about-view" data-action="edit">
          <div class="aghi-aw-about-label">About Me</div>
          <div class="aghi-aw-about-text ${user.bio ? '' : 'aghi-aw-empty'}" data-el="about-text"></div>
        </div>
      `;
      el.querySelector('[data-el="about-text"]').textContent = user.bio || 'Add a bio…';
      el.querySelector('[data-action="edit"]').addEventListener('click', () => {
        this.editing = 'about'; this.rerenderPopup();
      });
    }
  };

  AccountWidget.prototype.renderUsernameSection = function (el) {
    const user = this.state.user;
    const daysLeft = daysUntil(user.usernameChangeAvailableAt);
    const locked = daysLeft > 0;

    if (this.editing === 'username') {
      el.innerHTML = `
        <div class="aghi-aw-section">
          <input type="text" class="aghi-aw-input" maxlength="20" value="${escapeHtml(user.username)}" placeholder="New username">
          <div class="aghi-aw-edit-actions">
            <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
          </div>
          <div class="aghi-aw-error" hidden></div>
        </div>
      `;
      el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        this.editing = null; this.rerenderPopup();
      });
      el.querySelector('[data-action="save"]').addEventListener('click', () => {
        const input = el.querySelector('input');
        const value = input.value.trim();
        const errorEl = el.querySelector('.aghi-aw-error');
        if (!USERNAME_PATTERN.test(value)) {
          errorEl.textContent = 'Username must be 3-20 characters: letters, numbers, and underscores only.';
          errorEl.hidden = false;
          return;
        }
        this.saveProfile({ username: value }, el);
      });
    } else {
      el.innerHTML = `
        <div class="aghi-aw-username-row ${locked ? 'aghi-aw-locked' : ''}" data-action="${locked ? '' : 'edit'}">
          <p class="aghi-aw-username">${escapeHtml(user.username)}</p>
          <span class="aghi-aw-username-edit-icon" title="${locked ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Change username'}">${PENCIL_ICON}</span>
        </div>
      `;
      if (!locked) {
        el.querySelector('[data-action="edit"]').addEventListener('click', () => {
          this.editing = 'username'; this.rerenderPopup();
        });
      }
    }
  };

  AccountWidget.prototype.renderPresenceSection = function (el) {
    const user = this.state.user;
    const current = presenceInfo(user.presence);

    el.innerHTML = `
      <button type="button" class="aghi-aw-presence-btn" data-action="toggle">
        <span class="aghi-aw-presence-dot" style="background:${current.color};box-shadow:0 0 6px ${current.color}"></span>
        <span class="aghi-aw-presence-label">${current.label}</span>
        <span class="aghi-aw-presence-chevron">${CHEVRON_ICON}</span>
      </button>
    `;
    const btn = el.querySelector('[data-action="toggle"]');
    this.presenceBtnEl = btn;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.presenceMenuOpen = !this.presenceMenuOpen;
      this.rerenderPopup();
    });

    if (this.presenceMenuOpen) {
      const menu = document.createElement('div');
      menu.className = 'aghi-aw-presence-menu';
      menu.innerHTML = PRESENCE_OPTIONS.map((p) => `
        <button type="button" class="aghi-aw-presence-option ${p.id === user.presence ? 'aghi-aw-selected' : ''}" data-presence="${p.id}">
          <span class="aghi-aw-presence-dot" style="background:${p.color}"></span>
          <span>${p.label}</span>
        </button>
      `).join('');
      el.appendChild(menu);
      this.presenceMenuEl = menu;
      menu.querySelectorAll('[data-presence]').forEach((optBtn) => {
        optBtn.addEventListener('click', () => {
          this.presenceMenuOpen = false;
          this.saveProfile({ presence: optBtn.getAttribute('data-presence') }, el);
        });
      });
    } else {
      this.presenceMenuEl = null;
    }
  };

  AccountWidget.prototype.respondToFriendRequest = async function (requesterId, action) {
    try {
      const res = await fetch('/api/friend-respond.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf_token: this.state.csrfToken, targetId: requesterId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      this.inboxItems = this.inboxItems.filter((it) => !(it.kind === 'friend_request' && it.requesterId === requesterId));
      this.notifUnreadCount = Math.max(0, this.notifUnreadCount - 1);
      this.refreshInboxBadge(this.mount.querySelector('.aghi-aw-inbox-btn'));
      if (this.inboxOpen) {
        const listEl = document.querySelector('.aghi-aw-inbox-panel .aghi-aw-inbox-list');
        if (listEl) this.renderInboxList(listEl);
      }
    } catch (e) {
    }
  };

  AccountWidget.prototype.buildInboxPanel = function () {
    const panel = document.createElement('div');
    panel.className = 'aghi-aw-inbox-panel';
    panel.innerHTML = `
      <div class="aghi-aw-inbox-header">
        <h2 class="aghi-aw-inbox-title">Notifications</h2>
        <div class="aghi-aw-inbox-header-actions">
          <button type="button" class="aghi-aw-inbox-markall" data-action="mark-all">Mark all read</button>
          <button type="button" class="aghi-aw-inbox-close" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
      </div>
      <div class="aghi-aw-inbox-list"></div>
      <button type="button" class="aghi-aw-inbox-loadmore" data-action="load-more" hidden>Load more</button>
    `;
    panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.inboxOpen = false;
      this.render();
    });
    panel.querySelector('[data-action="mark-all"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.markAllNotificationsRead();
    });
    panel.querySelector('[data-action="load-more"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.fetchInboxList(false);
    });
    this.renderInboxList(panel.querySelector('.aghi-aw-inbox-list'));
    return panel;
  };

  AccountWidget.prototype.rerenderInboxPanel = function () {
    if (!this.inboxOpen) return;
    document.querySelectorAll('.aghi-aw-inbox-panel').forEach((el) => el.remove());
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const targetParent = isMobile ? document.body : this.mount;
    targetParent.appendChild(this.buildInboxPanel());
  };

  AccountWidget.prototype.renderInboxList = function (listEl) {
    if (!listEl) return;

    if (this.inboxLoading && this.inboxItems.length === 0) {
      listEl.innerHTML = '<div class="aghi-aw-inbox-loading">Loading…</div>';
      return;
    }
    if (this.inboxError && this.inboxItems.length === 0) {
      listEl.innerHTML = `<div class="aghi-aw-inbox-empty">${escapeHtml(this.inboxError)}</div>`;
      return;
    }
    if (this.inboxLoadedOnce && this.inboxItems.length === 0) {
      listEl.innerHTML = '<div class="aghi-aw-inbox-empty">You\u2019re all caught up.</div>';
      return;
    }

    listEl.innerHTML = this.inboxItems.map((item) => {
      const unread = item.kind === 'friend_request' || !item.isRead;
      const clickable = item.kind !== 'friend_request' && !item.isRead;
      return `
        <div class="aghi-aw-inbox-item ${unread ? 'aghi-aw-unread' : ''} ${clickable ? 'aghi-aw-clickable' : ''}" data-item-id="${escapeHtml(String(item.id))}">
          <div class="aghi-aw-inbox-avatar" data-el="avatar"></div>
          <div class="aghi-aw-inbox-body">
            <div class="aghi-aw-inbox-text">${item.kind === 'friend_request'
              ? `<strong>${escapeHtml(item.actorUsername)}</strong> sent you a friend request.`
              : notifText(item)}</div>
            <div class="aghi-aw-inbox-time">${timeAgo(item.createdAt)}</div>
            ${item.kind === 'friend_request' ? `
              <div class="aghi-aw-inbox-actions">
                <button type="button" class="aghi-aw-request-btn aghi-aw-accept" data-action="accept" aria-label="Accept">${CHECK_ICON}</button>
                <button type="button" class="aghi-aw-request-btn aghi-aw-decline" data-action="decline" aria-label="Decline">${X_ICON}</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.aghi-aw-inbox-item').forEach((rowEl, i) => {
      const item = this.inboxItems[i];
      applyAvatar(rowEl.querySelector('[data-el="avatar"]'), item.pfpId, item.actorUsername);

      if (item.kind === 'friend_request') {
        rowEl.querySelector('[data-action="accept"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.respondToFriendRequest(item.requesterId, 'accept');
        });
        rowEl.querySelector('[data-action="decline"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.respondToFriendRequest(item.requesterId, 'decline');
        });
      } else if (!item.isRead) {
        rowEl.addEventListener('click', () => this.markNotificationRead(item.id));
      }
    });

    const loadMoreBtn = document.querySelector('.aghi-aw-inbox-panel [data-action="load-more"]');
    if (loadMoreBtn) loadMoreBtn.hidden = !this.inboxNextCursor;

    const markAllBtn = document.querySelector('.aghi-aw-inbox-panel [data-action="mark-all"]');
    if (markAllBtn) markAllBtn.disabled = this.notifUnreadCount === 0;
  };

  AccountWidget.prototype.fetchInboxList = async function (reset) {
    this.inboxLoading = true;
    this.inboxError = null;
    if (reset) this.rerenderInboxPanel();
    try {
      const params = new URLSearchParams({ action: 'list', limit: '20' });
      if (!reset && this.inboxNextCursor) params.set('before', this.inboxNextCursor);
      const res = await fetch(`/api/inbox.php?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Failed to load.');
      this.inboxItems = reset ? data.items : this.inboxItems.concat(data.items);
      this.inboxNextCursor = data.nextCursor;
      this.inboxLoadedOnce = true;
    } catch (e) {
      this.inboxError = 'Couldn\u2019t load notifications. Try again later.';
    } finally {
      this.inboxLoading = false;
      this.rerenderInboxPanel();
    }
  };

  AccountWidget.prototype.markNotificationRead = async function (id) {
    const item = this.inboxItems.find((it) => it.id === id);
    if (!item || item.isRead) return;
    item.isRead = true;
    this.notifUnreadCount = Math.max(0, this.notifUnreadCount - 1);
    this.refreshInboxBadge(this.mount.querySelector('.aghi-aw-inbox-btn'));
    const listEl = document.querySelector('.aghi-aw-inbox-panel .aghi-aw-inbox-list');
    if (listEl) this.renderInboxList(listEl);
    try {
      await fetch('/api/inbox.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id, csrf_token: this.state.csrfToken }),
      });
    } catch (e) {
    }
  };

  AccountWidget.prototype.markAllNotificationsRead = async function () {
    if (this.notifUnreadCount === 0) return;

    this.inboxItems = this.inboxItems.map((it) => ({ ...it, isRead: true }));
    this.notifUnreadCount = 0;
    this.refreshInboxBadge(this.mount.querySelector('.aghi-aw-inbox-btn'));

    const listEl = document.querySelector('.aghi-aw-inbox-panel .aghi-aw-inbox-list');
    if (listEl) this.renderInboxList(listEl);

    try {
      await fetch('/api/inbox.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read', csrf_token: this.state.csrfToken }),
      });
    } catch (e) {
    }
  };

  // -----------------------------------------------------------------
  // Direct Messages
  // -----------------------------------------------------------------

  AccountWidget.prototype.buildDmPanel = function () {
    const panel = document.createElement('div');
    panel.className = 'aghi-aw-dm-panel';

    if (this.dmView === 'thread' && this.dmActiveUser) {
      panel.innerHTML = `
        <div class="aghi-aw-dm-header">
          <button type="button" class="aghi-aw-dm-back" data-action="back" aria-label="Back to conversations">${BACK_ICON}</button>
          <div class="aghi-aw-dm-header-user">
            <div class="aghi-aw-dm-header-avatar-wrap" data-aghi-userid="${this.dmActiveUser.id}">
              <div class="aghi-aw-dm-header-avatar" data-el="avatar"></div>
            </div>
            <div class="aghi-aw-dm-header-user-col" data-aghi-userid="${this.dmActiveUser.id}">
              <span class="aghi-aw-dm-header-username"></span>
              <div class="aghi-aw-dm-header-status" data-el="status" hidden></div>
            </div>
          </div>
          <button type="button" class="aghi-aw-dm-close" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
        <div class="aghi-aw-dm-messages"></div>
        <form class="aghi-aw-dm-composer" data-el="composer">
          <textarea class="aghi-aw-dm-input" data-el="input" rows="1" maxlength="2000" placeholder="Message ${escapeHtml(this.dmActiveUser.username)}"></textarea>
          <button type="submit" class="aghi-aw-dm-send" aria-label="Send">${SEND_ICON}</button>
        </form>
      `;
      applyAvatar(panel.querySelector('[data-el="avatar"]'), this.dmActiveUser.pfpId, this.dmActiveUser.username);
      panel.querySelector('.aghi-aw-dm-header-username').textContent = this.dmActiveUser.username;
      this.renderDmHeaderPresence(panel.querySelector('.aghi-aw-dm-header'));

      panel.querySelector('[data-action="back"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopDmTypingPolling();
        this.dmView = 'threads';
        this.dmActiveUser = null;
        this.dmEditingMessageId = null;
        this.rerenderDmPanel();
        this.fetchDmThreads(true);
      });
      panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopDmTypingPolling();
        this.dmOpen = false;
        this.render();
      });

      panel.querySelector('[data-el="composer"]').addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendDmMessage(panel);
      });
      const inputEl = panel.querySelector('[data-el="input"]');
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendDmMessage(panel);
        }
      });
      inputEl.addEventListener('input', () => {
        if (inputEl.value.trim()) this.notifyDmTyping();
      });

      this.renderDmMessages(panel.querySelector('.aghi-aw-dm-messages'));
    } else {
      panel.innerHTML = `
        <div class="aghi-aw-dm-header">
          <h2 class="aghi-aw-dm-title">Messages</h2>
          <button type="button" class="aghi-aw-dm-close" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
        <div class="aghi-aw-dm-threads"></div>
      `;
      panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.dmOpen = false;
        this.render();
      });
      this.renderDmThreads(panel.querySelector('.aghi-aw-dm-threads'));
    }

    return panel;
  };

  // Re-renders the panel in place without replaying the mobile slide-in
  // animation (used for polling refreshes) — only the initial open in
  // render() triggers the transform transition.
  AccountWidget.prototype.rerenderDmPanel = function () {
    if (!this.dmOpen) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const existing = document.querySelector('.aghi-aw-dm-panel');
    const fresh = this.buildDmPanel();
    if (isMobile) fresh.classList.add('aghi-aw-dm-panel-open');
    if (existing) {
      existing.replaceWith(fresh);
    } else {
      (isMobile ? document.body : this.mount).appendChild(fresh);
    }
  };

  AccountWidget.prototype.fetchDmThreads = async function (reset) {
    this.dmThreadsLoading = true;
    this.dmThreadsError = null;
    if (reset) this.rerenderDmPanel();
    try {
      const params = new URLSearchParams({ action: 'threads', limit: '20' });
      if (!reset && this.dmNextCursor) params.set('before', String(this.dmNextCursor));
      const res = await fetch(`/api/dms.php?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Failed to load.');
      this.dmThreads = reset ? data.threads : this.dmThreads.concat(data.threads);
      this.dmNextCursor = data.nextCursor;
      this.dmThreadsLoadedOnce = true;
    } catch (e) {
      this.dmThreadsError = 'Couldn\u2019t load messages. Try again later.';
    } finally {
      this.dmThreadsLoading = false;
      this.rerenderDmPanel();
    }
  };

  AccountWidget.prototype.renderDmThreads = function (el) {
    if (!el) return;

    if (this.dmThreadsLoading && this.dmThreads.length === 0) {
      el.innerHTML = '<div class="aghi-aw-dm-loading">Loading…</div>';
      return;
    }
    if (this.dmThreadsError && this.dmThreads.length === 0) {
      el.innerHTML = `<div class="aghi-aw-dm-empty">${escapeHtml(this.dmThreadsError)}</div>`;
      return;
    }
    if (this.dmThreadsLoadedOnce && this.dmThreads.length === 0) {
      el.innerHTML = '<div class="aghi-aw-dm-empty">No messages yet — visit someone\u2019s profile to say hi.</div>';
      return;
    }

    el.innerHTML = this.dmThreads.map((t) => {
      const deleted = t.lastMessage.status === 'deleted';
      const preview = deleted ? 'Message deleted' : t.lastMessage.body;
      const mine = !deleted && t.lastMessage.senderId === this.state.user.id ? 'You: ' : '';
      return `
        <div class="aghi-aw-dm-thread-item ${t.unreadCount > 0 ? 'aghi-aw-unread' : ''}" data-user-id="${t.userId}">
          <div class="aghi-aw-dm-thread-avatar-wrap" data-el="avatar-wrap" data-aghi-userid="${t.userId}">
            <div class="aghi-aw-dm-thread-avatar" data-el="avatar"></div>
          </div>
          <div class="aghi-aw-dm-thread-body">
            <div class="aghi-aw-dm-thread-name">${escapeHtml(t.username)}</div>
            <div class="aghi-aw-dm-thread-preview">${mine}${escapeHtml(preview)}</div>
          </div>
          <div class="aghi-aw-dm-thread-time">${timeAgo(t.lastMessage.createdAt)}</div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.aghi-aw-dm-thread-item').forEach((rowEl, i) => {
      const t = this.dmThreads[i];
      applyAvatar(rowEl.querySelector('[data-el="avatar"]'), t.pfpId, t.username);
      renderPresenceDot(rowEl.querySelector('[data-el="avatar-wrap"]'), t);
      rowEl.addEventListener('click', (e) => {
        // Avatar click opens the profile popup instead of the thread —
        // user-profile-popup.js listens at the document level for
        // data-aghi-userid clicks, so we just skip opening the thread here
        // and let the click keep bubbling rather than stopPropagation-ing it
        // (which would prevent that document listener from ever seeing it).
        if (e.target.closest('[data-aghi-userid]')) return;
        this.openDmThread({ id: t.userId, username: t.username, pfpId: t.pfpId, presence: t.presence, online: t.online, status: t.status }, true);
      });
    });
  };

  // Opens (or switches to) a thread. Called both from clicking a row in the
  // threads list and from outside code (e.g. a future "Message" button on
  // the profile popup) via window.AghiAccountWidget.openDm — see boot().
  AccountWidget.prototype.openDmThread = async function (user, reset) {
    this.dmView = 'thread';
    this.dmActiveUser = user;
    if (reset) {
      this.dmMessages = [];
      this.dmMessagesLoadedOnce = false;
      this.dmLastMessageId = 0;
      this.dmReadUpToId = 0;
      this.dmOtherTyping = false;
      this.dmEditingMessageId = null;
    }
    this.dmMessagesLoading = true;
    this.dmMessagesError = null;
    this.rerenderDmPanel();

    try {
      const params = new URLSearchParams({ action: 'thread', userId: String(user.id), limit: '30' });
      const res = await fetch(`/api/dms.php?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Failed to load.');
      this.dmMessages = data.messages;
      this.dmMessagesLoadedOnce = true;
      this.dmReadUpToId = data.readUpToId || 0;
      if (data.otherUser) {
        this.dmOtherUser = data.otherUser;
        this.dmActiveUser = { ...this.dmActiveUser, ...data.otherUser };
      }
      if (data.messages.length) {
        this.dmLastMessageId = Math.max(...data.messages.map((m) => m.id));
      }
      // Fetching a thread marks it read server-side — reflect that in the
      // badge immediately instead of waiting for the next poll tick.
      this.fetchDmUnreadCount();
    } catch (e) {
      this.dmMessagesError = 'Couldn\u2019t load this conversation.';
    } finally {
      this.dmMessagesLoading = false;
      this.rerenderDmPanel();
      this.scrollDmMessagesToBottom();
      this.startDmTypingPolling();
    }
  };

  AccountWidget.prototype.pollDmThread = async function () {
    if (!this.dmActiveUser) return;
    try {
      const params = new URLSearchParams({
        action: 'poll',
        userId: String(this.dmActiveUser.id),
        afterId: String(this.dmLastMessageId),
      });
      const res = await fetch(`/api/dms.php?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) return;

      const readChanged = (data.readUpToId || 0) !== this.dmReadUpToId;
      this.dmReadUpToId = data.readUpToId || this.dmReadUpToId;
      if (data.otherUser) {
        const presenceChanged = JSON.stringify(data.otherUser) !== JSON.stringify(this.dmOtherUser);
        this.dmOtherUser = data.otherUser;
        this.dmActiveUser = { ...this.dmActiveUser, ...data.otherUser };
        if (presenceChanged) this.refreshDmHeader();
      }

      if (!data.messages.length && !readChanged) return;

      if (data.messages.length) {
        this.dmMessages = this.dmMessages.concat(data.messages);
        this.dmLastMessageId = Math.max(this.dmLastMessageId, ...data.messages.map((m) => m.id));
      }
      // A full render() rebuilds every bubble's HTML, which would wipe out an
      // in-progress edit textarea mid-keystroke. Skip the rebuild while
      // editing — the next poll tick after editing ends picks up whatever
      // changed in the meantime.
      if (this.dmEditingMessageId !== null) return;
      this.renderDmMessages(document.querySelector('.aghi-aw-dm-panel .aghi-aw-dm-messages'));
      if (data.messages.some((m) => m.senderId !== this.state.user.id)) {
        this.scrollDmMessagesToBottom();
      }
      this.fetchDmUnreadCount();
    } catch (e) {
    }
  };

  // Separate faster-interval loop for the typing indicator — decoupled from
  // the main INBOX_POLL_INTERVAL_MS timer so "typing…" feels responsive
  // without dropping the main poll interval site-wide.
  AccountWidget.prototype.startDmTypingPolling = function () {
    this.stopDmTypingPolling();
    this.dmTypingPollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !this.dmActiveUser || this.dmView !== 'thread') return;
      this.fetchDmTypingStatus();
    }, TYPING_POLL_INTERVAL_MS);
  };

  AccountWidget.prototype.stopDmTypingPolling = function () {
    if (this.dmTypingPollTimer) {
      clearInterval(this.dmTypingPollTimer);
      this.dmTypingPollTimer = null;
    }
    this.dmOtherTyping = false;
  };

  AccountWidget.prototype.fetchDmTypingStatus = async function () {
    if (!this.dmActiveUser) return;
    try {
      const params = new URLSearchParams({ action: 'typing_status', userId: String(this.dmActiveUser.id) });
      const res = await fetch(`/api/dms.php?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      if (data.typing !== this.dmOtherTyping) {
        this.dmOtherTyping = data.typing;
        this.refreshDmHeader();
      }
    } catch (e) {
    }
  };

  // Throttled "I'm typing" ping, called from the composer's input handler.
  AccountWidget.prototype.notifyDmTyping = function () {
    if (!this.dmActiveUser) return;
    const now = Date.now();
    if (now - this.dmLastTypingPingAt < TYPING_PING_INTERVAL_MS) return;
    this.dmLastTypingPingAt = now;
    fetch('/api/dms.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'typing',
        recipientId: this.dmActiveUser.id,
        csrf_token: this.state.csrfToken,
      }),
    }).catch(() => {});
  };

  // Re-renders just the open-thread header (presence dot + status/typing
  // line) without touching the message list or composer — used on typing/
  // presence poll ticks so the input focus and scroll position never move.
  AccountWidget.prototype.refreshDmHeader = function () {
    const header = document.querySelector('.aghi-aw-dm-panel .aghi-aw-dm-header');
    if (!header || this.dmView !== 'thread' || !this.dmActiveUser) return;
    this.renderDmHeaderPresence(header);
  };

  // Updates the open-thread header's presence dot + status/typing line in
  // place. Called on initial build and again on every typing/presence poll
  // tick — kept separate from renderDmMessages so those ticks never touch
  // scroll position or in-progress composer text.
  AccountWidget.prototype.renderDmHeaderPresence = function (headerEl) {
    if (!headerEl) return;
    const data = this.dmOtherUser || this.dmActiveUser;

    const avatarWrap = headerEl.querySelector('.aghi-aw-dm-header-avatar-wrap');
    if (avatarWrap) renderPresenceDot(avatarWrap, data);

    const statusEl = headerEl.querySelector('[data-el="status"]');
    if (!statusEl) return;
    if (this.dmOtherTyping) {
      statusEl.innerHTML = '<span class="aghi-aw-dm-typing-dots" title="Typing…"><span></span><span></span><span></span></span>';
      statusEl.hidden = false;
    } else if (data && data.status) {
      statusEl.textContent = data.status;
      statusEl.hidden = false;
    } else {
      statusEl.textContent = '';
      statusEl.hidden = true;
    }
  };

  AccountWidget.prototype.renderDmMessages = function (el) {
    if (!el) return;

    if (this.dmMessagesLoading && this.dmMessages.length === 0) {
      el.innerHTML = '<div class="aghi-aw-dm-loading">Loading…</div>';
      return;
    }
    if (this.dmMessagesError && this.dmMessages.length === 0) {
      el.innerHTML = `<div class="aghi-aw-dm-empty">${escapeHtml(this.dmMessagesError)}</div>`;
      return;
    }
    if (this.dmMessagesLoadedOnce && this.dmMessages.length === 0) {
      el.innerHTML = '<div class="aghi-aw-dm-empty">No messages yet — say hi!</div>';
      return;
    }

    const myId = this.state.user.id;
    const canReact = !!window.AghiEmojiPicker;

    el.innerHTML = this.dmMessages.map((m) => {
      const mine = m.senderId === myId;
      const deleted = m.status === 'deleted';
      const editing = this.dmEditingMessageId === m.id;
      const seen = mine && !deleted && m.id <= this.dmReadUpToId;

      if (deleted) {
        return `
          <div class="aghi-aw-dm-msg ${mine ? 'aghi-aw-dm-msg-mine' : ''}" data-msg-id="${m.id}">
            <div class="aghi-aw-dm-bubble aghi-aw-dm-deleted">Message deleted</div>
          </div>
        `;
      }

      if (editing) {
        return `
          <div class="aghi-aw-dm-msg ${mine ? 'aghi-aw-dm-msg-mine' : ''}" data-msg-id="${m.id}">
            <div class="aghi-aw-dm-edit-box">
              <textarea class="aghi-aw-dm-edit-input" data-el="edit-input" rows="2" maxlength="2000">${escapeHtml(m.body)}</textarea>
              <div class="aghi-aw-dm-edit-actions">
                <button type="button" data-action="save-edit">Save</button>
                <button type="button" data-action="cancel-edit">Cancel</button>
              </div>
            </div>
          </div>
        `;
      }

      const actionsHtml = `
        <div class="aghi-aw-dm-msg-actions">
          ${canReact ? `<button type="button" class="aghi-aw-dm-msg-action-btn" data-action="react" aria-label="React">${REACT_ICON}</button>` : ''}
          ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn" data-action="edit" aria-label="Edit">${PENCIL_ICON}</button>` : ''}
          ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn aghi-aw-dm-action-danger" data-action="delete" aria-label="Delete">${TRASH_ICON}</button>` : ''}
        </div>
      `;

      return `
        <div class="aghi-aw-dm-msg ${mine ? 'aghi-aw-dm-msg-mine' : ''}" data-msg-id="${m.id}">
          ${actionsHtml}
          <div class="aghi-aw-dm-bubble">${escapeHtml(m.body)}</div>
          <div class="aghi-aw-dm-reactions" data-el="reactions"></div>
          <div class="aghi-aw-dm-msg-meta">
            ${m.editedAt ? '<span class="aghi-aw-dm-msg-edited">(edited)</span>' : ''}
            <span class="aghi-aw-dm-msg-time">${timeAgo(m.createdAt)}</span>
            ${mine ? `<span class="aghi-aw-dm-ticks ${seen ? 'aghi-aw-dm-seen' : ''}" title="${seen ? 'Seen' : 'Delivered'}">${DOUBLE_CHECK_ICON}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.aghi-aw-dm-msg[data-msg-id]').forEach((msgEl) => {
      const id = parseInt(msgEl.getAttribute('data-msg-id'), 10);
      const msg = this.dmMessages.find((m) => m.id === id);
      if (!msg) return;

      const reactionsEl = msgEl.querySelector('[data-el="reactions"]');
      if (reactionsEl) this.initDmMessageReactions(id, reactionsEl);

      const reactBtn = msgEl.querySelector('[data-action="react"]');
      if (reactBtn) {
        reactBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.AghiEmojiPicker.open(reactBtn, (emoji) => {
            this.toggleDmMessageReaction(id, emoji, reactionsEl);
          });
        });
      }

      const editBtn = msgEl.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dmEditingMessageId = id;
          this.renderDmMessages(el);
        });
      }

      const deleteBtn = msgEl.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteDmMessage(id, el);
        });
      }

      const saveBtn = msgEl.querySelector('[data-action="save-edit"]');
      if (saveBtn) {
        const editInput = msgEl.querySelector('[data-el="edit-input"]');
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.saveDmMessageEdit(id, editInput.value, el);
        });
        editInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.saveDmMessageEdit(id, editInput.value, el);
          } else if (e.key === 'Escape') {
            this.dmEditingMessageId = null;
            this.renderDmMessages(el);
          }
        });
        editInput.focus();
        editInput.selectionStart = editInput.value.length;
      }
      const cancelBtn = msgEl.querySelector('[data-action="cancel-edit"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dmEditingMessageId = null;
          this.renderDmMessages(el);
        });
      }
    });
  };

  AccountWidget.prototype.initDmMessageReactions = function (messageId, reactionsEl) {
    if (this.dmReactionCache.has(messageId)) {
      this.renderDmReactionPills(reactionsEl, messageId);
      return;
    }
    this.fetchDmMessageReactions(messageId, reactionsEl);
  };

  // Always hits the network, unlike initDmMessageReactions — used both for
  // the initial cache-miss fetch and by the periodic reaction-refresh loop
  // (see startDmTypingPolling) so other participants' new reactions on an
  // already-open thread show up without reopening it.
  AccountWidget.prototype.fetchDmMessageReactions = async function (messageId, reactionsEl) {
    try {
      const res = await fetch(`/api/reactions.php?target_type=dm_message&target_id=${encodeURIComponent(messageId)}`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      this.dmReactionCache.set(messageId, { counts: data.counts || {}, userReactions: data.userReactions || [] });
      if (reactionsEl && document.contains(reactionsEl)) this.renderDmReactionPills(reactionsEl, messageId);
    } catch (e) {
    }
  };

  AccountWidget.prototype.renderDmReactionPills = function (reactionsEl, messageId) {
    if (!reactionsEl) return;
    const data = this.dmReactionCache.get(messageId) || { counts: {}, userReactions: [] };
    const entries = Object.entries(data.counts).filter(([, n]) => n > 0);
    reactionsEl.innerHTML = entries.map(([emoji, count]) => {
      const active = data.userReactions.includes(emoji);
      const url = window.AghiEmojiPicker ? window.AghiEmojiPicker.getTwemojiUrl(emoji) : '';
      return `
        <button type="button" class="aghi-aw-dm-reaction-pill ${active ? 'aghi-aw-dm-reaction-active' : ''}" data-emoji="${escapeHtml(emoji)}">
          <img class="aghi-aw-dm-reaction-emoji" src="${url}" alt="${escapeHtml(emoji)}" loading="lazy" decoding="async" draggable="false" />
          <span class="aghi-aw-dm-reaction-count">${count}</span>
        </button>
      `;
    }).join('');
    reactionsEl.querySelectorAll('[data-emoji]').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDmMessageReaction(messageId, pill.getAttribute('data-emoji'), reactionsEl);
      });
    });
  };

  AccountWidget.prototype.toggleDmMessageReaction = async function (messageId, emoji, reactionsEl) {
    try {
      const res = await fetch('/api/reactions.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'dm_message',
          targetId: messageId,
          reactionType: emoji,
          csrf_token: this.state.csrfToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) return;
      this.dmReactionCache.set(messageId, { counts: data.counts, userReactions: data.userReactions });
      if (reactionsEl && document.contains(reactionsEl)) this.renderDmReactionPills(reactionsEl, messageId);
    } catch (e) {
    }
  };

  AccountWidget.prototype.saveDmMessageEdit = async function (messageId, text, messagesEl) {
    text = text.trim();
    if (!text) return;
    try {
      const res = await fetch('/api/dms.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', messageId, body: text, csrf_token: this.state.csrfToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to edit.');
      const idx = this.dmMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) this.dmMessages[idx] = data.message;
      this.dmEditingMessageId = null;
      this.renderDmMessages(messagesEl);
    } catch (e) {
      // Leave it in editing mode on failure so the person can retry.
    }
  };

  AccountWidget.prototype.deleteDmMessage = async function (messageId, messagesEl) {
    const confirmed = await showConfirmModal('Delete message?', 'This can\u2019t be undone.');
    if (!confirmed) return;
    try {
      const res = await fetch('/api/dms.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', messageId, csrf_token: this.state.csrfToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      const idx = this.dmMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) this.dmMessages[idx] = { ...this.dmMessages[idx], status: 'deleted' };
      this.renderDmMessages(messagesEl);
    } catch (e) {
    }
  };

  AccountWidget.prototype.scrollDmMessagesToBottom = function () {
    const el = document.querySelector('.aghi-aw-dm-panel .aghi-aw-dm-messages');
    if (el) el.scrollTop = el.scrollHeight;
  };

  AccountWidget.prototype.sendDmMessage = async function (panel) {
    const input = panel.querySelector('[data-el="input"]');
    const text = input.value.trim();
    if (!text || this.dmSending || !this.dmActiveUser) return;

    this.dmSending = true;
    input.disabled = true;
    try {
      const res = await fetch('/api/dms.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          recipientId: this.dmActiveUser.id,
          body: text,
          csrf_token: this.state.csrfToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send.');
      this.dmMessages.push(data.message);
      this.dmLastMessageId = Math.max(this.dmLastMessageId, data.message.id);
      input.value = '';
      this.renderDmMessages(panel.querySelector('.aghi-aw-dm-messages'));
      this.scrollDmMessagesToBottom();
    } catch (e) {
      // Left minimal on purpose — a failed send just leaves the text in the
      // box so the person can hit send again.
    } finally {
      this.dmSending = false;
      input.disabled = false;
      input.focus();
    }
  };

  AccountWidget.prototype.renderPfpSection = function (el) {
    const user = this.state.user;
    const swatches = PFP_PRESETS.map((p) => `
      <button type="button" class="aghi-aw-pfp-option ${p.id === user.pfpId ? 'aghi-aw-selected' : ''}"
        style="background-color:${p.color}" data-pfp="${p.id}" aria-label="Use ${p.id} color"></button>
    `).join('');

    el.innerHTML = `
      <label class="aghi-aw-upload-label">
        Upload photo
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-action="file-input">
      </label>
      <div class="aghi-aw-upload-hint">JPEG, PNG, or WebP — max 2MB</div>
      ${isCustomAvatar(user.pfpId) ? '<button type="button" class="aghi-aw-reset-link" data-action="reset">Remove photo, use a color instead</button>' : ''}
      <div class="aghi-aw-pfp-grid">${swatches}</div>
      <div class="aghi-aw-error" hidden></div>
    `;

    el.querySelectorAll('[data-pfp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.saveProfile({ pfpId: btn.getAttribute('data-pfp') }, el);
      });
    });

    const resetBtn = el.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.saveProfile({ pfpId: 'default' }, el);
      });
    }

    el.querySelector('[data-action="file-input"]').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) this.uploadAvatar(file, el);
    });
  };

  AccountWidget.prototype.uploadAvatar = async function (file, sectionEl) {
    const errorEl = sectionEl.querySelector('.aghi-aw-error');
    if (errorEl) errorEl.hidden = true;

    if (file.size > MAX_AVATAR_BYTES) {
      if (errorEl) { errorEl.textContent = 'Image is too large (max 2MB).'; errorEl.hidden = false; }
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('csrf_token', this.state.csrfToken);

    try {
      const res = await fetch('/api/upload-avatar.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed.');
      }
      this.state.user = { ...this.state.user, pfpId: data.profile.pfpId };
      this.rerenderPopup();
      const avatarBtn = this.mount.querySelector('.aghi-aw-avatar-btn');
      if (avatarBtn) applyAvatar(avatarBtn, this.state.user.pfpId, this.state.user.username);
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = e.message || 'Upload failed. Try again.';
        errorEl.hidden = false;
      }
    }
  };

  AccountWidget.prototype.rerenderPopup = function () {
    const existing = this.mount.querySelector('.aghi-aw-popup');
    if (existing) existing.remove();
    this.mount.appendChild(this.buildPopup());
  };

  AccountWidget.prototype.saveProfile = async function (patch, sectionEl) {
    const errorEl = sectionEl.querySelector('.aghi-aw-error');
    try {
      const res = await fetch('/api/profile.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ csrf_token: this.state.csrfToken }, patch)),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }
      this.state.user = { ...this.state.user, ...data.profile };
      this.editing = null;
      this.rerenderPopup();
      const avatarBtn = this.mount.querySelector('.aghi-aw-avatar-btn');
      if (avatarBtn) applyAvatar(avatarBtn, this.state.user.pfpId, this.state.user.username);
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = e.message || 'Failed to save. Try again.';
        errorEl.hidden = false;
      }
    }
  };

  function boot() {
    injectStyles();
    const mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    const widget = new AccountWidget(mount);
    widget.init();

    // Lets other widget-independent scripts (e.g. a "Message" button in
    // user-profile-popup.js) open a DM thread without duplicating the
    // panel/polling logic above.
    window.AghiAccountWidget = {
      openDm(userId, username, pfpId) {
        widget.popupOpen = false;
        widget.inboxOpen = false;
        widget.dmOpen = true;
        widget.render();
        widget.openDmThread({ id: userId, username, pfpId: pfpId || 'default' }, true);
      },
      isLoggedIn() {
        return !!(widget.state && widget.state.loggedIn);
      },
      getCurrentUserId() {
        return widget.state && widget.state.loggedIn && widget.state.user ? widget.state.user.id : null;
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();