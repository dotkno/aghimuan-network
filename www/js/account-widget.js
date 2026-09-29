/**
 * account-widget.js
 *
 * Drop-in nav auth widget for static Aghimuan pages.
 */
(function () {
  'use strict';

  const MOUNT_ID = 'aghi-account-widget';

  // Shared values owned by /js/aghi-config.js (generated from
  // includes/app-config.php). Fallback lists keep old cached pages working
  // if aghi-config.js hasn't loaded yet.
  const FALLBACK_PRESETS = [
    { id: 'default',      color: '#5F5E5A' },
    { id: 'circuit-blue', color: '#185FA5' },
    { id: 'circuit-cyan', color: '#0F6E56' },
    { id: 'node-teal',    color: '#04342C' },
    { id: 'spark-orange', color: '#993C1D' },
    { id: 'wire-purple',  color: '#534AB7' },
    { id: 'chip-green',   color: '#3B6D11' },
    { id: 'signal-pink',  color: '#993556' },
  ];
  const PFP_PRESETS = (window.AGHI_CONFIG && window.AGHI_CONFIG.presets) || FALLBACK_PRESETS;
  const PRESET_IDS = ((window.AGHI_CONFIG && window.AGHI_CONFIG.presetIds) || PFP_PRESETS.map((p) => p.id));

  const PRESENCE_OPTIONS = [
    { id: 'online', label: 'Online',         color: '#3ddc84' },
    { id: 'away',   label: 'Away',           color: '#f5c542' },
    { id: 'dnd',    label: 'Do Not Disturb', color: '#e05260' },
    { id: 'invisible', label: 'Invisible',   color: '#6b8b9a' },
  ];

  const CFG = (window.AGHI_CONFIG || {});
  const MAX_AVATAR_BYTES = CFG.maxAvatarBytes || 2 * 1024 * 1024;
  const MAX_BIO_LENGTH = CFG.maxBioLength || 300;
  const MAX_STATUS_LENGTH = CFG.maxStatusLength || 60;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
  const HEARTBEAT_INTERVAL_MS = CFG.heartbeatIntervalMs || 15 * 1000;

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
    if (r === 'FACULTY') {
      return 'background: linear-gradient(135deg, #5eead4, #0ea5e9); color: #06202a; font-weight: 700; border: none; box-shadow: 0 0 10px rgba(94,234,212,0.35);';
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
  function showConfirmModal(title, message, confirmLabel = 'Delete') {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-aw-modal-backdrop';
      backdrop.innerHTML = `
        <div class="aghi-aw-modal">
          <p class="aghi-aw-modal-title">${escapeHtml(title)}</p>
          <p class="aghi-aw-modal-msg">${escapeHtml(message)}</p>
          <div class="aghi-aw-modal-actions">
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-confirm" data-action="confirm">${escapeHtml(confirmLabel)}</button>
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

  // Discord-style crop editor for avatar/banner uploads: drag to reposition,
  // scroll wheel or slider to zoom, Apply exports exactly the framed region
  // as a PNG and hands it to onApply. The crop happens client-side — the
  // server still re-encodes through GD, it just receives an image that's
  // already the right aspect ratio so its center-crop is a no-op.
  function openImageAdjustModal(opts) {
    const isAvatar = opts.kind === 'avatar';
    const frameW = isAvatar ? 120 : 284; // 284x71 = 4:1, matches modal width
    const frameH = isAvatar ? 120 : 71;
    const outW = isAvatar ? 512 : 1200;
    const outH = isAvatar ? 512 : 300;

    const backdrop = document.createElement('div');
    backdrop.className = 'aghi-aw-modal-backdrop';
    backdrop.innerHTML = `
      <div class="aghi-aw-modal aghi-aw-adjust">
        <p class="aghi-aw-modal-title">Adjust ${isAvatar ? 'avatar' : 'banner'}</p>
        <div class="aghi-aw-adjust-frame ${isAvatar ? 'is-avatar' : 'is-banner'}">
          <img alt="" data-el="img">
        </div>
        <p class="aghi-aw-adjust-hint">Drag to reposition · scroll wheel or slider to zoom</p>
        <div class="aghi-aw-adjust-zoom">
          <span>−</span>
          <input type="range" min="0" max="100" value="0" data-el="zoom" aria-label="Zoom">
          <span>+</span>
        </div>
        <div class="aghi-aw-modal-actions">
          <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-cancel" data-action="cancel">Cancel</button>
          <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-confirm" data-action="apply">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const frame = backdrop.querySelector('.aghi-aw-adjust-frame');
    const img = backdrop.querySelector('[data-el="img"]');
    const zoomSlider = backdrop.querySelector('[data-el="zoom"]');
    const url = URL.createObjectURL(opts.file);
    img.src = url;

    let nw = 0, nh = 0, base = 1, scale = 1, ox = 0, oy = 0;

    const clampOffsets = () => {
      ox = Math.min(0, Math.max(frameW - nw * scale, ox));
      oy = Math.min(0, Math.max(frameH - nh * scale, oy));
    };
    const render = () => {
      img.style.width = (nw * scale) + 'px';
      img.style.transform = `translate(${ox}px, ${oy}px)`;
    };
    // slider 0..100 maps to 1x..4x of the "cover" zoom
    const scaleFromSlider = (t) => base * (1 + (t / 100) * 3);
    const sliderFromScale = () => Math.round(((scale / base - 1) / 3) * 100);

    const setScale = (next, cx, cy) => {
      scale = Math.min(base * 4, Math.max(base, next));
      if (cx === undefined) { cx = frameW / 2; cy = frameH / 2; }
      // keep the image point under the cursor pinned while zooming
      const px = (cx - ox) / scale;
      const py = (cy - oy) / scale;
      ox = cx - px * scale;
      oy = cy - py * scale;
      clampOffsets();
      zoomSlider.value = String(sliderFromScale());
      render();
    };

    img.addEventListener('load', () => {
      nw = img.naturalWidth;
      nh = img.naturalHeight;
      base = Math.max(frameW / nw, frameH / nh);
      scale = base;
      ox = (frameW - nw * scale) / 2;
      oy = (frameH - nh * scale) / 2;
      clampOffsets();
      render();
    });

    // pan — pointer events cover mouse and touch alike
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    frame.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      img.classList.add('is-dragging');
      frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      ox += e.clientX - lastX;
      oy += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      clampOffsets();
      render();
    });
    const endDrag = () => {
      dragging = false;
      img.classList.remove('is-dragging');
    };
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);

    // wheel zoom, anchored at the cursor
    frame.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = frame.getBoundingClientRect();
      setScale(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    zoomSlider.addEventListener('input', () => setScale(scaleFromSlider(Number(zoomSlider.value))));

    function onKey(e) {
      if (e.key === 'Escape') close(false);
    }
    document.addEventListener('keydown', onKey);
    const close = (applied) => {
      document.removeEventListener('keydown', onKey);
      URL.revokeObjectURL(url);
      backdrop.remove();
      if (!applied && opts.onCancel) opts.onCancel();
    };

    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    backdrop.querySelector('[data-action="apply"]').addEventListener('click', () => {
      // Export exactly the framed region, sampled from the natural image.
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -ox / scale, -oy / scale, frameW / scale, frameH / scale, 0, 0, outW, outH);
      canvas.toBlob((blob) => {
        close(true);
        if (!blob) return;
        opts.onApply(new File([blob], (isAvatar ? 'avatar' : 'banner') + '-crop.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }

  function applyAvatar(el, pfpId, username) {
    el.innerHTML = '';
    el.style.backgroundImage = 'none';
    function showMonogram() {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = presetColor(pfpId);
      const span = document.createElement('span');
      span.className = 'aghi-aw-monogram';
      span.textContent = (username || '?').charAt(0).toUpperCase();
      el.appendChild(span);
    }
    if (isCustomAvatar(pfpId)) {
      // Probe first so a ghost file (DB points at a missing upload) falls
      // back to the monogram instead of a dark box + repeat 404s. Results
      // are cached per page load in AghiImgFallback.
      const url = '/uploads/pfp/' + encodeURIComponent(pfpId);
      el.style.backgroundColor = '#0a1520';
      const fb = window.AghiImgFallback;
      if (fb) {
        fb.probe(url, function () {
          el.style.backgroundImage = `url('${url}')`;
        }, showMonogram);
      } else {
        el.style.backgroundImage = `url('${url}')`;
      }
    } else {
      showMonogram();
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
    if (item.kind === 'creation_approved') {
      const title = payload && payload.title ? `“${escapeHtml(payload.title)}”` : 'your project';
      return `<strong>Aghimuan Club</strong> approved <strong>${title}</strong> — now live in the Creations Hub.`;
    }
    if (item.kind === 'creation_rejected') {
      const title = payload && payload.title ? `“${escapeHtml(payload.title)}”` : 'your project';
      const reason = payload && payload.reason ? ` Reason: “${escapeHtml(payload.reason)}”` : '';
      return `<strong>Aghimuan Club</strong> did not approve <strong>${title}</strong>.${reason}`;
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
      .aghi-aw { position: relative; font-family: 'Inter', sans-serif; display: inline-block; flex-shrink: 0; }
      .aghi-aw-guest { display: flex; gap: 14px; align-items: center; }
      .aghi-aw-guest a { color: var(--silver); text-decoration: none; font-size: 14px; letter-spacing: 0.03em; }
      .aghi-aw-guest a:hover { color: var(--cyan); }
      .aghi-aw-guest a.aghi-aw-signup { color: var(--cyan); border: 1px solid var(--glass-border-active); border-radius: 6px; padding: 6px 14px; background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-guest a.aghi-aw-signup:hover { background: var(--glass-bg-hover); }

      .aghi-aw-row { display: flex; align-items: center; gap: 8px; }

      .aghi-aw-inbox-btn { width: 38px; height: 38px; border-radius: 9px; position: relative; display: flex; align-items: center; justify-content: center; color: var(--silver); text-decoration: none; cursor: pointer; background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 0; margin: 0; font: inherit; -webkit-appearance: none; appearance: none; transition: all 0.18s ease; }
      .aghi-aw-inbox-btn:hover { color: var(--white); border-color: rgba(85, 241, 248, 0.55); background: var(--glass-bg-hover); }
      .aghi-aw-inbox-btn svg { width: 20px; height: 20px; }
      .aghi-aw-inbox-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid var(--charcoal); color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      .aghi-aw-avatar-btn { width: 38px; height: 38px; border-radius: 9px; padding: 0; cursor: pointer; border: 1px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; transition: all 0.18s ease; }
      .aghi-aw-monogram { font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--white); user-select: none; }
      .aghi-aw-avatar-btn:hover, .aghi-aw-avatar-btn[aria-expanded="true"] { border-color: var(--glass-border-active); box-shadow: 0 0 10px rgba(85, 241, 248, 0.35); }

      /* (the old .aghi-aw-request-btn squares were replaced by .aghi-aw-pill) */

      /* Shared design tokens for the dropdown panels (same values the DM
        panels set on .aghi-aw-dm-panel — kept in sync by hand). */
      .aghi-aw-popup, .aghi-aw-inbox-panel, .aghi-aw-friends-panel {
        --dm-cyan: var(--cyan, #55F1F8);
        --dm-text: var(--white, #F1F2F5);
        --dm-text-dim: var(--silver, #AEB7C0);
        --dm-text-faint: var(--steel, #767CA1);
        --dm-line: rgba(255, 255, 255, 0.09);
        --dm-line-strong: rgba(85, 241, 248, 0.4);
        --dm-surface-hover: rgba(255, 255, 255, 0.08);
        color: var(--dm-text);
        font-family: 'Inter', sans-serif;
      }

      .aghi-aw-popup { position: absolute; top: calc(100% + 10px); right: 0; width: 316px; max-width: calc(100vw - 24px); max-height: min(660px, 86vh); display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06); z-index: 1000; overflow: hidden; }
      .aghi-aw-popup::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 0%, rgba(85,241,248,0.05), transparent 60%); }
      .aghi-aw-popup > * { position: relative; z-index: 1; }
      .aghi-aw-main { position: relative; display: flex; flex-direction: column; min-height: 0; }
      .aghi-aw-popup-head-actions { position: absolute; top: 8px; right: 8px; z-index: 6; display: flex; gap: 6px; }
      .aghi-aw-banner { height: 92px; flex-shrink: 0; background: linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85)); background-size: cover; background-position: center; position: relative; cursor: pointer; }
      .aghi-aw-banner::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--cyan, #55F1F8), var(--tech, #3096C7), transparent); box-shadow: 0 0 10px rgba(85,241,248,0.6); }
      .aghi-aw-banner-hover { position: absolute; inset: 0; background: rgba(6, 11, 16, 0.65); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.04em; color: var(--white, #F1F2F5); opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
      .aghi-aw-banner-hover svg { width: 14px; height: 14px; }
      .aghi-aw-banner:hover .aghi-aw-banner-hover { opacity: 1; }
      .aghi-aw-popup-body { padding: 0 14px 14px; margin-top: -30px; position: relative; }

      .aghi-aw-avatar-wrap { width: 64px; height: 64px; border-radius: 50%; position: relative; cursor: pointer; border: 4px solid var(--charcoal); margin-bottom: 8px; box-shadow: 0 0 0 1px rgba(85,241,248,0.4), 0 0 14px rgba(48,150,199,0.35); }
      .aghi-aw-popup-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: var(--charcoal); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .aghi-aw-popup-avatar .aghi-aw-monogram { font-size: 22px; }
      .aghi-aw-avatar-hover { position: absolute; inset: 0; border-radius: 50%; background: rgba(6, 11, 16, 0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s; pointer-events: none; }
      .aghi-aw-avatar-wrap:hover .aghi-aw-avatar-hover { opacity: 1; }
      .aghi-aw-avatar-hover svg { width: 20px; height: 20px; }

      /* Main-view status / about rows (click through to Settings) */
      .aghi-aw-status-row { display: flex; align-items: center; gap: 7px; margin: 2px -8px 0; padding: 5px 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-status-row:hover { background: rgba(255, 255, 255, 0.05); }
      .aghi-aw-status-text { flex: 1; min-width: 0; font-size: 12.5px; line-height: 1.35; color: var(--dm-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .aghi-aw-status-text.aghi-aw-empty { color: var(--dm-text-faint); font-style: italic; }
      .aghi-aw-row-pencil { flex-shrink: 0; display: flex; color: var(--dm-text-faint); opacity: 0; transition: opacity 0.15s ease; }
      .aghi-aw-row-pencil svg { width: 12px; height: 12px; }
      .aghi-aw-status-row:hover .aghi-aw-row-pencil, .aghi-aw-main-section:hover .aghi-aw-row-pencil { opacity: 1; }
      .aghi-aw-main-section { margin: 12px 0 4px; padding: 9px 11px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
      .aghi-aw-main-section:hover { border-color: rgba(85, 241, 248, 0.35); background: rgba(255, 255, 255, 0.045); }

      /* Settings view */
      .aghi-aw-settings { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .aghi-aw-settings-head { display: flex; align-items: center; gap: 9px; padding: 10px 12px 9px; border-bottom: var(--dm-line); flex-shrink: 0; }
      .aghi-aw-settings-body { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 14px 14px; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-settings-body::-webkit-scrollbar { width: 6px; }
      .aghi-aw-settings-body::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-settings-body::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-settings-section { margin: 14px 0 4px; }
      .aghi-aw-banner-preview { height: 64px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); background: linear-gradient(135deg, rgba(3, 3, 126, 0.35), rgba(21, 22, 28, 0.8)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--dm-text-faint); margin-bottom: 8px; }

      .aghi-aw-username-row { display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 2px; }
      .aghi-aw-username { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--white); margin: 0; text-shadow: 0 0 12px rgba(85,241,248,0.25); }
      .aghi-aw-username-edit-icon { opacity: 0; transition: opacity 0.15s; display: flex; }
      .aghi-aw-username-row:hover .aghi-aw-username-edit-icon { opacity: 1; }
      .aghi-aw-username-edit-icon svg { width: 13px; height: 13px; color: var(--steel); }
      .aghi-aw-username-row.aghi-aw-locked { cursor: default; }
      .aghi-aw-username-row.aghi-aw-locked:hover .aghi-aw-username-edit-icon { opacity: 0.4; }
      .aghi-aw-username-cooldown { font-size: 10px; color: var(--steel); margin: 2px 0 0; }

      .aghi-aw-role { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; padding: 2px 8px; margin: 6px 0 10px; }

      .aghi-aw-presence-btn { display: flex; align-items: center; gap: 8px; width: 100%; background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; cursor: pointer; color: var(--white); font-size: 13px; font-family: 'Inter', sans-serif; transition: all 0.18s ease; }
      .aghi-aw-presence-btn:hover { border-color: var(--glass-border-active); background: var(--glass-bg-hover); }
      .aghi-aw-presence-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .aghi-aw-presence-btn .aghi-aw-presence-label { flex: 1; text-align: left; }
      .aghi-aw-presence-chevron { color: var(--steel); }

      .aghi-aw-presence-menu { position: absolute; left: 16px; right: 16px; margin-top: -6px; background: var(--glass-bg); backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%); border: 1px solid var(--glass-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); z-index: 1001; overflow: hidden; }
      .aghi-aw-presence-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: none; border: none; color: var(--silver); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; text-align: left; transition: all 0.18s ease; }
      .aghi-aw-presence-option:hover { background: var(--glass-bg-hover); color: var(--white); }
      .aghi-aw-presence-option.aghi-aw-selected { color: var(--cyan); }

      .aghi-aw-input, .aghi-aw-textarea { width: 100%; box-sizing: border-box; background: var(--charcoal); border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px 10px; color: var(--white); font-family: 'Inter', sans-serif; font-size: 13px; resize: vertical; transition: all 0.18s ease; }
      .aghi-aw-input:focus, .aghi-aw-textarea:focus { outline: none; border-color: var(--glass-border-active); box-shadow: 0 0 12px rgba(85,241,248,0.18); }
      .aghi-aw-charcount { font-size: 10px; color: var(--steel); text-align: right; margin-top: 3px; }

      .aghi-aw-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
      .aghi-aw-btn { flex: 1; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; border: none; transition: all 0.18s ease; }
      .aghi-aw-btn-save { background: linear-gradient(180deg, var(--tech), var(--royal)); color: #fff; }
      .aghi-aw-btn-save:hover { filter: brightness(1.15); }
      .aghi-aw-btn-cancel { background: transparent; border: 1px solid var(--glass-border); color: var(--silver); }
      .aghi-aw-btn-cancel:hover { border-color: var(--glass-border-active); color: var(--white); }

      /* (the old glass .aghi-aw-section boxes were replaced by the settings
         view sections above — .aghi-aw-about-label/-text are still shared) */
      .aghi-aw-about-label { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); margin-bottom: 8px; }
      .aghi-aw-about-label::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, var(--cyan), var(--tech)); box-shadow: 0 0 6px rgba(85,241,248,0.6); }
      .aghi-aw-about-text { font-size: 13px; line-height: 1.5; color: var(--silver); white-space: pre-wrap; }
      .aghi-aw-about-text.aghi-aw-empty { color: var(--steel); font-style: italic; }

      .aghi-aw-subroles-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; margin-bottom: 10px; }
      .aghi-aw-subrole-badge { font-size: 10px; font-family: 'JetBrains Mono', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; }

      .aghi-aw-upload-label { display: block; text-align: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; background: rgba(85,241,248,0.08); border: 1px solid var(--glass-border-active); color: var(--cyan); font-size: 12px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; margin-bottom: 8px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-upload-label:hover { background: rgba(85,241,248,0.14); }
      .aghi-aw-upload-hint { font-size: 10px; color: var(--steel); text-align: center; margin: -4px 0 10px; }

      .aghi-aw-reset-link { display: block; width: 100%; text-align: center; background: none; border: none; color: var(--silver); font-size: 11px; cursor: pointer; margin-bottom: 10px; text-decoration: underline; }
      .aghi-aw-reset-link:hover { color: var(--white); }

      .aghi-aw-pfp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .aghi-aw-pfp-option { width: 100%; aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .aghi-aw-pfp-option.aghi-aw-selected { border-color: var(--cyan); box-shadow: 0 0 6px rgba(85,241,248,0.4); }

      .aghi-aw-logout { width: 100%; margin-top: 4px; padding: 8px; background: rgba(217,85,85,0.08); border: 1px solid rgba(217,85,85,0.3); border-radius: 6px; color: #ff8b8b; font-family: 'Space Grotesk', sans-serif; font-size: 12px; letter-spacing: 0.03em; cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-logout:hover { background: rgba(217,85,85,0.15); }

      .aghi-aw-error { font-size: 11px; color: #ff8b8b; margin-top: 6px; }

      /* Shared animated backdrop for the dropdown panels (mobile sheets) */
      .aghi-aw-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(8, 10, 15, 0.62); backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%); animation: aghiDmBackdropIn 0.28s ease both; }
      .aghi-aw-backdrop.aghi-aw-leave { animation: aghiDmBackdropOut 0.2s ease both; pointer-events: none; }

      /* Open/close — enter class only on initial mount, like the DM panels */
      .aghi-aw-popup.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-enter { animation: aghiDmPanelIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-popup.aghi-aw-leave, .aghi-aw-inbox-panel.aghi-aw-leave, .aghi-aw-friends-panel.aghi-aw-leave { animation: aghiDmPanelOut 0.2s cubic-bezier(0.4, 0, 1, 1) both; pointer-events: none; }

      .aghi-aw-dm-icon-btn[disabled] { opacity: 0.4; cursor: default; }

      @media (max-width: 768px) {
        .aghi-aw-popup, .aghi-aw-inbox-panel, .aghi-aw-friends-panel {
          position: fixed; left: 0; right: 0; bottom: 0; top: auto;
          width: auto; max-width: none;
          border-radius: 18px 18px 0 0; border-left: none; border-right: none; border-bottom: none;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .aghi-aw-popup { max-height: 88vh; }
        .aghi-aw-inbox-panel { height: auto; min-height: 320px; max-height: 80vh; }
        .aghi-aw-friends-panel { height: auto; min-height: 320px; max-height: 84vh; }
        .aghi-aw-popup::after, .aghi-aw-inbox-panel::after, .aghi-aw-friends-panel::after {
          content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
          width: 40px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.22); z-index: 7; pointer-events: none;
        }
        .aghi-aw-popup.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-enter { animation-name: aghiDmSheetIn; }
        .aghi-aw-popup.aghi-aw-leave, .aghi-aw-inbox-panel.aghi-aw-leave, .aghi-aw-friends-panel.aghi-aw-leave { animation-name: aghiDmSheetOut; }
      }

      @media (prefers-reduced-motion: reduce) {
        .aghi-aw-popup.aghi-aw-enter, .aghi-aw-popup.aghi-aw-leave,
        .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-leave,
        .aghi-aw-friends-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-leave,
        .aghi-aw-backdrop { animation: none !important; }
      }

      .aghi-aw-inbox-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 340px; max-width: calc(100vw - 24px); height: min(480px, 70vh); display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06); z-index: 1000; overflow: hidden; }

      .aghi-aw-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 12px 10px 16px; border-bottom: var(--dm-line); flex-shrink: 0; }
      .aghi-aw-panel-head-actions { display: flex; align-items: center; gap: 6px; }
      .aghi-aw-panel-chip { min-width: 18px; height: 18px; padding: 0 6px; border-radius: 9px; background: rgba(85, 241, 248, 0.12); border: 1px solid rgba(85, 241, 248, 0.4); color: var(--dm-cyan); font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10.5px; line-height: 16px; text-align: center; }

      .aghi-aw-inbox-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-inbox-list::-webkit-scrollbar { width: 6px; }
      .aghi-aw-inbox-list::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-inbox-list::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-inbox-section { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-cyan); margin: 10px 6px 4px; }
      .aghi-aw-inbox-section::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, var(--dm-cyan), #3096C7); box-shadow: 0 0 6px rgba(85, 241, 248, 0.6); }
      .aghi-aw-inbox-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 10px; border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
      .aghi-aw-inbox-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-inbox-item.aghi-aw-clickable { cursor: pointer; }
      .aghi-aw-inbox-item.aghi-aw-unread { background: rgba(85, 241, 248, 0.05); border-color: rgba(85, 241, 248, 0.18); }
      .aghi-aw-inbox-item.aghi-aw-unread::after { content: ''; position: absolute; top: 12px; right: 10px; width: 7px; height: 7px; border-radius: 50%; background: var(--dm-cyan); box-shadow: 0 0 6px rgba(85, 241, 248, 0.7); }
      .aghi-aw-inbox-avatar-wrap { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
      .aghi-aw-inbox-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-inbox-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-inbox-kind { position: absolute; right: -5px; bottom: -5px; width: 15px; height: 15px; border-radius: 50%; background: #262c39; border: 1.5px solid #14171e; box-sizing: content-box; display: flex; align-items: center; justify-content: center; color: var(--dm-cyan); }
      .aghi-aw-inbox-kind svg { width: 8px; height: 8px; }
      .aghi-aw-inbox-body { flex: 1; min-width: 0; padding-right: 12px; }
      .aghi-aw-inbox-text { font-size: 12.5px; line-height: 1.45; color: var(--dm-text-dim); }
      .aghi-aw-inbox-text strong { color: var(--dm-text); }
      .aghi-aw-inbox-time { font-size: 10px; color: var(--dm-text-faint); margin-top: 3px; font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-inbox-actions { display: flex; gap: 6px; margin-top: 8px; }

      .aghi-aw-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 999px; border: 1px solid transparent; font-family: 'Space Grotesk', sans-serif; font-size: 11px; letter-spacing: 0.03em; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-pill svg { width: 12px; height: 12px; }
      .aghi-aw-pill-accept { background: rgba(61, 220, 132, 0.12); border-color: rgba(61, 220, 132, 0.45); color: #3ddc84; }
      .aghi-aw-pill-accept:hover { background: rgba(61, 220, 132, 0.22); }
      .aghi-aw-pill-decline { background: rgba(224, 82, 96, 0.1); border-color: rgba(224, 82, 96, 0.4); color: #ff9aa4; }
      .aghi-aw-pill-decline:hover { background: rgba(224, 82, 96, 0.2); }

      .aghi-aw-inbox-empty { text-align: center; padding: 36px 16px; color: var(--dm-text-faint); font-size: 12.5px; line-height: 1.5; }
      .aghi-aw-inbox-loading { text-align: center; padding: 24px 16px; color: var(--dm-text-faint); font-size: 12px; }

      .aghi-aw-inbox-loadmore { display: block; width: calc(100% - 12px); margin: 4px 6px 8px; background: none; border: 1px solid rgba(255, 255, 255, 0.12); color: var(--dm-text-dim); padding: 7px; border-radius: 8px; font-size: 11.5px; font-family: 'JetBrains Mono', monospace; cursor: pointer; flex-shrink: 0; transition: all 0.15s ease; }
      .aghi-aw-inbox-loadmore:hover { border-color: var(--dm-line-strong); color: var(--dm-cyan); }
      .aghi-aw-inbox-loadmore[hidden] { display: none; }

      @media (max-width: 768px) {
        .aghi-aw-inbox-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1000; width: auto; max-width: none; max-height: 82vh; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-inbox-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); z-index: 2; }
      }

      /* --- Friends List --- */
      .aghi-aw-friends-panel {
        position: absolute; top: calc(100% + 10px); right: 0; width: 320px; max-width: calc(100vw - 24px);
        height: min(520px, 72vh); display: flex; flex-direction: column;
        background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        z-index: 1000; overflow: hidden;
      }
      .aghi-aw-friends-count { min-width: 18px; height: 18px; padding: 0 7px; border-radius: 9px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--dm-text-dim); font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 600; line-height: 16px; text-align: center; }
      /* Reuses the DM search wrapper/input styles verbatim */
      .aghi-aw-friends-search { position: relative; padding: 8px 12px 8px; flex-shrink: 0; }
      .aghi-aw-friends-search .aghi-aw-dm-search-ic { left: 23px; top: 50%; }

      .aghi-aw-friends-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-friends-list::-webkit-scrollbar { width: 6px; }
      .aghi-aw-friends-list::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-friends-list::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-friends-item { position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-friends-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-friends-avatar-wrap { position: relative; flex-shrink: 0; }
      .aghi-aw-friends-avatar { position: relative; width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-friends-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-friends-body { flex: 1; min-width: 0; }
      .aghi-aw-friends-name { font-size: 13px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-friends-status { font-size: 11px; color: var(--dm-text-dim); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-friends-status.aghi-aw-friends-online { color: #3ddc84; }
      .aghi-aw-friends-status.aghi-aw-friends-away { color: #f5c542; }
      .aghi-aw-friends-status.aghi-aw-friends-dnd { color: #e05260; }
      .aghi-aw-friends-remove { width: 26px; height: 26px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 7px; color: var(--dm-text-faint); cursor: pointer; opacity: 0; transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease; }
      .aghi-aw-friends-item:hover .aghi-aw-friends-remove { opacity: 1; }
      .aghi-aw-friends-remove:hover { background: rgba(224, 82, 96, 0.15); color: #ff9aa4; }
      .aghi-aw-friends-remove svg { width: 13px; height: 13px; }
      @media (hover: none) {
        .aghi-aw-friends-remove { opacity: 0.75; }
      }

      .aghi-aw-friends-empty { text-align: center; padding: 36px 16px; color: var(--dm-text-faint); font-size: 12.5px; line-height: 1.5; }
      .aghi-aw-friends-loading { text-align: center; padding: 24px 16px; color: var(--dm-text-faint); font-size: 12px; }

      @media (max-width: 768px) {
        .aghi-aw-friends-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1000; width: auto; max-width: none; max-height: 82vh; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-friends-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); z-index: 2; }
      }

      /* Confirm modal (message delete etc.) — z-index sits above the
         profile popup (9999) since it's used for unfriend confirms there. */
      .aghi-aw-modal-backdrop { position: fixed; inset: 0; z-index: 11000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(8, 10, 15, 0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: aghiDmBackdropIn 0.2s ease both; }
      .aghi-aw-modal { width: 100%; max-width: 360px; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(17, 19, 26, 0.99)); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 18px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); font-family: 'Inter', sans-serif; animation: aghiDmPanelIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-modal-title { margin: 0 0 6px; font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--white, #F1F2F5); }
      .aghi-aw-modal-msg { margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: var(--silver, #AEB7C0); }
      .aghi-aw-modal-actions { display: flex; gap: 8px; }
      .aghi-aw-modal-btn { flex: 1; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; }
      .aghi-aw-modal-cancel { background: transparent; border-color: rgba(255, 255, 255, 0.14); color: var(--silver, #AEB7C0); }
      .aghi-aw-modal-cancel:hover { color: var(--white, #F1F2F5); border-color: rgba(255, 255, 255, 0.3); }
      .aghi-aw-modal-confirm { background: linear-gradient(135deg, #e05260, #b23448); border: none; color: #fff; font-weight: 600; }
      .aghi-aw-modal-confirm:hover { filter: brightness(1.12); }

      /* Discord-style avatar/banner crop editor */
      .aghi-aw-modal.aghi-aw-adjust { max-width: 320px; }
      .aghi-aw-adjust-frame { position: relative; overflow: hidden; margin-bottom: 10px; background: #0d0f14; touch-action: none; }
      .aghi-aw-adjust-frame.is-avatar { width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 10px; }
      .aghi-aw-adjust-frame.is-banner { width: 100%; height: 71px; border-radius: 8px; }
      .aghi-aw-adjust-frame img { position: absolute; top: 0; left: 0; transform-origin: 0 0; max-width: none; user-select: none; -webkit-user-drag: none; cursor: grab; }
      .aghi-aw-adjust-frame img.is-dragging { cursor: grabbing; }
      .aghi-aw-adjust-hint { font-size: 11px; color: var(--silver, #AEB7C0); text-align: center; margin: 0 0 10px; }
      .aghi-aw-adjust-zoom { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
      .aghi-aw-adjust-zoom span { color: var(--steel, #767CA1); font-family: 'JetBrains Mono', monospace; font-size: 12px; flex-shrink: 0; }
      .aghi-aw-adjust-zoom input[type="range"] { flex: 1; accent-color: #3096C7; cursor: pointer; }

      /* --- Direct Messages -------------------------------------------------
        Both shells are near-opaque on purpose: raw 3.5%-white glass behind
        text made the panels unreadable over busy pages. The glass feel comes
        from the blur, hairline borders and a faint cyan tint instead. ------ */
      .aghi-aw-dm-panel {
        --dm-cyan: var(--cyan, #55F1F8);
        --dm-text: var(--white, #F1F2F5);
        --dm-text-dim: var(--silver, #AEB7C0);
        --dm-text-faint: var(--steel, #767CA1);
        --dm-line: rgba(255, 255, 255, 0.09);
        --dm-line-strong: rgba(85, 241, 248, 0.4);
        --dm-surface-hover: rgba(255, 255, 255, 0.08);
        color: var(--dm-text);
        font-family: 'Inter', sans-serif;
      }

      .aghi-aw-dm-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid var(--charcoal, #15161C); color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      /* Quick dropdown (desktop) / bottom sheet (mobile) */
      .aghi-aw-dm-panel-quick {
        position: absolute; top: calc(100% + 10px); right: 0;
        width: 380px; max-width: calc(100vw - 24px);
        height: min(560px, 76vh);
        display: flex; flex-direction: column;
        background:
          radial-gradient(130% 60% at 50% 0%, rgba(48, 150, 199, 0.1), transparent 62%),
          linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99));
        backdrop-filter: blur(28px) saturate(150%);
        -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 14px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        z-index: 1000; overflow: hidden;
      }

      /* Full messaging window (desktop) / fullscreen (mobile) */
      .aghi-aw-dm-panel-full {
        position: fixed; inset: 0; margin: auto;
        width: min(1080px, calc(100vw - 40px));
        height: min(720px, calc(100vh - 56px));
        display: flex;
        background:
          radial-gradient(90% 55% at 15% 0%, rgba(3, 3, 126, 0.22), transparent 60%),
          radial-gradient(90% 55% at 88% 100%, rgba(48, 150, 199, 0.08), transparent 60%),
          linear-gradient(180deg, rgba(24, 27, 35, 0.99), rgba(14, 16, 22, 0.99));
        backdrop-filter: blur(28px) saturate(150%);
        -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 18px;
        box-shadow: 0 32px 90px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        z-index: 1000; overflow: hidden;
      }

      /* Open/close — the enter class is only added on the initial mount, so
        poll-driven rebuilds of the panel never replay the animation. */
      .aghi-aw-dm-panel.aghi-aw-dm-enter { animation: aghiDmPanelIn 0.34s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-dm-panel.aghi-aw-dm-leave { animation: aghiDmPanelOut 0.2s cubic-bezier(0.4, 0, 1, 1) both; pointer-events: none; }
      @keyframes aghiDmPanelIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
      @keyframes aghiDmPanelOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(10px) scale(0.98); } }
      @keyframes aghiDmSheetIn { from { transform: translateY(100%); } to { transform: none; } }
      @keyframes aghiDmSheetOut { from { transform: none; } to { transform: translateY(100%); } }

      .aghi-aw-dm-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(8, 10, 15, 0.62); backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%); animation: aghiDmBackdropIn 0.28s ease both; }
      .aghi-aw-dm-backdrop.aghi-aw-dm-leave { animation: aghiDmBackdropOut 0.2s ease both; pointer-events: none; }
      @keyframes aghiDmBackdropIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes aghiDmBackdropOut { from { opacity: 1; } to { opacity: 0; } }

      @media (prefers-reduced-motion: reduce) {
        .aghi-aw-dm-panel.aghi-aw-dm-enter, .aghi-aw-dm-panel.aghi-aw-dm-leave,
        .aghi-aw-dm-backdrop, .aghi-aw-dm-msg-enter, .aghi-aw-modal { animation: none !important; }
      }

      /* Sidebar (full window) */
      .aghi-aw-dm-full-sidebar { width: 320px; min-width: 320px; flex-shrink: 0; display: flex; flex-direction: column; background: rgba(10, 12, 17, 0.5); border-right: 1px solid var(--dm-line); }
      .aghi-aw-dm-full-sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 14px 12px 16px; }
      .aghi-aw-dm-panel-title { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-cyan); margin: 0; text-shadow: 0 0 14px rgba(85, 241, 248, 0.3); }
      .aghi-aw-dm-icon-btn { width: 30px; height: 30px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--dm-text-dim); cursor: pointer; border-radius: 8px; transition: all 0.18s ease; }
      .aghi-aw-dm-icon-btn:hover { color: var(--dm-text); border-color: var(--dm-line-strong); background: rgba(85, 241, 248, 0.1); }
      .aghi-aw-dm-icon-btn svg { width: 15px; height: 15px; }

      .aghi-aw-dm-full-search { position: relative; padding: 2px 14px 10px; }
      .aghi-aw-dm-search-ic { position: absolute; left: 25px; top: 21px; transform: translateY(-50%); width: 14px; height: 14px; color: var(--dm-text-faint); pointer-events: none; }
      .aghi-aw-dm-search-input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 9px; padding: 8px 12px 8px 32px; color: var(--dm-text); font-family: 'Inter', sans-serif; font-size: 13px; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
      .aghi-aw-dm-search-input:focus { outline: none; border-color: var(--dm-line-strong); box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.12); }
      .aghi-aw-dm-search-input::placeholder { color: var(--dm-text-faint); }

      /* Conversation list */
      .aghi-aw-dm-threads { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 2px; }
      .aghi-aw-dm-thread-item { display: flex; align-items: center; gap: 11px; padding: 10px; border-radius: 11px; cursor: pointer; border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
      .aghi-aw-dm-thread-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-dm-thread-item.aghi-aw-dm-thread-active { background: rgba(85, 241, 248, 0.08); border-color: rgba(85, 241, 248, 0.22); }
      .aghi-aw-dm-thread-avatar { position: relative; width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-dm-thread-avatar .aghi-aw-monogram { font-size: 15px; }
      .aghi-aw-dm-thread-body { flex: 1; min-width: 0; }
      .aghi-aw-dm-thread-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .aghi-aw-dm-thread-name { font-size: 13.5px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-thread-time { font-size: 10px; color: var(--dm-text-faint); flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-dm-thread-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .aghi-aw-dm-thread-preview { font-size: 12.5px; color: var(--dm-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .aghi-aw-dm-thread-item.aghi-aw-dm-thread-unread .aghi-aw-dm-thread-preview { color: var(--dm-text); }
      .aghi-aw-dm-thread-unread-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; flex-shrink: 0; background: var(--dm-cyan); color: #062027; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10.5px; line-height: 18px; text-align: center; box-shadow: 0 0 10px rgba(85, 241, 248, 0.45); }
      .aghi-aw-dm-presence-dot { position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #14171e; box-sizing: content-box; }

      /* Chat column */
      .aghi-aw-dm-chat-area { flex: 1; min-width: 0; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.015); }
      .aghi-aw-dm-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--dm-text-faint); padding: 24px; text-align: center; }
      .aghi-aw-dm-chat-empty-icon { width: 54px; height: 54px; opacity: 0.35; margin-bottom: 8px; }
      .aghi-aw-dm-chat-empty-icon svg { width: 100%; height: 100%; }
      .aghi-aw-dm-chat-empty-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--dm-text-dim); }
      .aghi-aw-dm-chat-empty-sub { font-size: 12.5px; max-width: 260px; line-height: 1.5; }

      .aghi-aw-dm-header { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 9px 14px; border-bottom: 1px solid var(--dm-line); background: rgba(255, 255, 255, 0.02); flex-shrink: 0; }
      .aghi-aw-dm-back { width: 30px; height: 30px; padding: 0; flex-shrink: 0; display: none; align-items: center; justify-content: center; background: transparent; border: none; color: var(--dm-text-dim); cursor: pointer; border-radius: 8px; transition: all 0.15s ease; }
      .aghi-aw-dm-back:hover { color: var(--dm-text); background: rgba(255, 255, 255, 0.06); }
      .aghi-aw-dm-back svg { width: 18px; height: 18px; }
      .aghi-aw-dm-panel-quick .aghi-aw-dm-back { display: flex; }
      .aghi-aw-dm-header-avatar-wrap { position: relative; width: 38px; height: 38px; flex-shrink: 0; }
      .aghi-aw-dm-header-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.12); }
      .aghi-aw-dm-header-avatar .aghi-aw-monogram { font-size: 14px; }
      .aghi-aw-dm-header-info { flex: 1; min-width: 0; }
      .aghi-aw-dm-header-name { font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-header-status { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dm-text-faint); margin-top: 2px; }
      .aghi-aw-dm-header-status[hidden] { display: none; }
      .aghi-aw-dm-header-actions { display: flex; align-items: center; gap: 6px; }
      .aghi-aw-dm-typing-dots { display: inline-flex; align-items: center; gap: 3px; }
      .aghi-aw-dm-typing-dots span { width: 4px; height: 4px; border-radius: 50%; background: var(--dm-cyan); animation: aghiDmTypingBounce 1.2s infinite ease-in-out; }
      .aghi-aw-dm-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
      .aghi-aw-dm-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes aghiDmTypingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }
      .aghi-aw-dm-typing-label { color: var(--dm-cyan); font-style: italic; }

      /* Messages */
      .aghi-aw-dm-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 14px 10px; display: flex; flex-direction: column; gap: 2px; }
      .aghi-aw-dm-loading, .aghi-aw-dm-empty { margin: auto; text-align: center; padding: 24px 12px; color: var(--dm-text-faint); font-size: 13px; line-height: 1.5; }
      .aghi-aw-dm-msg { position: relative; display: flex; flex-direction: column; max-width: min(78%, 560px); padding-top: 7px; }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) { align-self: flex-start; align-items: flex-start; }
      .aghi-aw-dm-msg-mine { align-self: flex-end; align-items: flex-end; }
      .aghi-aw-dm-msg-enter { animation: aghiDmMsgIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) both; }
      @keyframes aghiDmMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .aghi-aw-dm-bubble { padding: 9px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) .aghi-aw-dm-bubble { background: #262c39; border: 1px solid rgba(255, 255, 255, 0.08); color: var(--dm-text); border-bottom-left-radius: 6px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble { background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); border: 1px solid rgba(85, 241, 248, 0.28); color: #fff; border-bottom-right-radius: 6px; }
      .aghi-aw-dm-deleted { background: transparent !important; border: 1px dashed rgba(255, 255, 255, 0.16) !important; color: var(--dm-text-faint) !important; font-style: italic; box-shadow: none !important; }
      .aghi-aw-dm-bubble-reply { display: block; border-left: 2px solid rgba(85, 241, 248, 0.55); background: rgba(8, 10, 14, 0.28); border-radius: 6px; padding: 5px 8px; margin-bottom: 6px; overflow: hidden; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble-reply { border-left-color: rgba(255, 255, 255, 0.6); background: rgba(0, 0, 0, 0.18); }
      .aghi-aw-dm-bubble-reply-label { display: block; font-size: 10.5px; font-weight: 600; color: var(--dm-cyan); margin-bottom: 1px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble-reply-label { color: #d4ecff; }
      .aghi-aw-dm-bubble-reply-text { display: block; font-size: 12px; color: var(--dm-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; padding: 0 4px; font-size: 10px; color: var(--dm-text-faint); font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-dm-msg-edited { font-style: italic; }
      .aghi-aw-dm-ticks { display: flex; align-items: center; color: var(--dm-text-faint); }
      .aghi-aw-dm-ticks svg { width: 13px; height: 13px; }
      .aghi-aw-dm-ticks.aghi-aw-dm-seen { color: var(--dm-cyan); }

      /* Hover actions (react / reply / edit / delete) — anchored to the
        bubble's inner edge so they grow toward the panel center and never
        clip against the panel boundary on short messages. */
      .aghi-aw-dm-msg-actions { position: absolute; top: -16px; z-index: 3; display: flex; gap: 1px; padding: 3px; background: rgba(20, 23, 31, 0.96); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) .aghi-aw-dm-msg-actions { left: -6px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-msg-actions { right: -6px; }
      .aghi-aw-dm-msg:hover .aghi-aw-dm-msg-actions, .aghi-aw-dm-msg-actions:focus-within { opacity: 1; pointer-events: auto; }
      .aghi-aw-dm-msg-action-btn { width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: var(--dm-text-faint); cursor: pointer; transition: all 0.15s ease; }
      .aghi-aw-dm-msg-action-btn:hover { background: rgba(255, 255, 255, 0.08); color: var(--dm-text); }
      .aghi-aw-dm-msg-action-btn svg { width: 13px; height: 13px; }
      .aghi-aw-dm-action-danger:hover { background: rgba(224, 82, 96, 0.15); color: #ff9aa4; }
      @media (hover: none) {
        .aghi-aw-dm-msg-actions { position: static; opacity: 0.85; pointer-events: auto; margin: 0 0 2px; padding: 0; background: transparent; border: none; box-shadow: none; }
      }

      /* Reaction pills */
      .aghi-aw-dm-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      .aghi-aw-dm-reaction-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
      .aghi-aw-dm-reaction-pill:hover { background: rgba(255, 255, 255, 0.1); }
      .aghi-aw-dm-reaction-pill.aghi-aw-dm-reaction-active { background: rgba(85, 241, 248, 0.12); border-color: rgba(85, 241, 248, 0.5); }
      .aghi-aw-dm-reaction-emoji { width: 15px; height: 15px; display: block; }
      .aghi-aw-dm-reaction-count { font-size: 11px; color: var(--dm-text-dim); font-family: 'JetBrains Mono', monospace; }

      /* Inline edit */
      .aghi-aw-dm-edit-box { width: 100%; }
      .aghi-aw-dm-edit-input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); color: var(--dm-text); border: 1px solid var(--dm-line-strong); border-radius: 12px; padding: 9px 12px; font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.5; resize: vertical; min-height: 60px; }
      .aghi-aw-dm-edit-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.12); }
      .aghi-aw-dm-edit-actions { display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end; }
      .aghi-aw-dm-edit-actions button { padding: 5px 12px; border-radius: 7px; font-size: 11.5px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; }
      .aghi-aw-dm-edit-actions [data-action="save-edit"] { background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); border: none; color: #fff; }
      .aghi-aw-dm-edit-actions [data-action="save-edit"]:hover { filter: brightness(1.15); }
      .aghi-aw-dm-edit-actions [data-action="cancel-edit"] { background: transparent; border-color: rgba(255, 255, 255, 0.14); color: var(--dm-text-dim); }
      .aghi-aw-dm-edit-actions [data-action="cancel-edit"]:hover { color: var(--dm-text); border-color: rgba(255, 255, 255, 0.3); }

      /* Composer */
      .aghi-aw-dm-composer { padding: 10px 12px 12px; border-top: 1px solid var(--dm-line); background: rgba(255, 255, 255, 0.02); flex-shrink: 0; }
      .aghi-aw-dm-reply-preview { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; background: rgba(85, 241, 248, 0.06); border: 1px solid rgba(85, 241, 248, 0.2); border-radius: 10px; padding: 6px 8px; }
      .aghi-aw-dm-reply-preview[hidden] { display: none; }
      .aghi-aw-dm-reply-avatar { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-aw-dm-reply-avatar .aghi-aw-monogram { font-size: 10px; }
      .aghi-aw-dm-reply-texts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .aghi-aw-dm-reply-name { font-size: 11px; font-weight: 600; color: var(--dm-cyan); }
      .aghi-aw-dm-reply-text { font-size: 12px; color: var(--dm-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-reply-cancel { width: 22px; height: 22px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--dm-text-faint); cursor: pointer; border-radius: 6px; transition: all 0.15s ease; }
      .aghi-aw-dm-reply-cancel:hover { color: var(--dm-text); background: rgba(255, 255, 255, 0.08); }
      .aghi-aw-dm-reply-cancel svg { width: 13px; height: 13px; }
      .aghi-aw-dm-composer-row { display: flex; gap: 8px; align-items: flex-end; }
      .aghi-aw-dm-input { flex: 1; resize: none; height: auto; min-height: 42px; max-height: 120px; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 11px 14px; color: var(--dm-text); font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.4; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
      .aghi-aw-dm-input:focus { outline: none; border-color: var(--dm-line-strong); box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.1); }
      .aghi-aw-dm-input::placeholder { color: var(--dm-text-faint); }
      .aghi-aw-dm-input:disabled { opacity: 0.6; }
      .aghi-aw-dm-send { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; border: 1px solid rgba(85, 241, 248, 0.3); background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(21, 145, 196, 0.3); transition: transform 0.15s ease, filter 0.15s ease; }
      .aghi-aw-dm-send:hover { transform: translateY(-1px); filter: brightness(1.12); }
      .aghi-aw-dm-send:active { transform: scale(0.94); }
      .aghi-aw-dm-emoji { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.35); color: var(--dm-text-dim); font-size: 19px; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease; }
      .aghi-aw-dm-emoji:hover { color: #fff; border-color: rgba(255, 255, 255, 0.3); transform: translateY(-1px); }
      .aghi-aw-dm-send svg { width: 16px; height: 16px; }

      /* Quick panel head (conversation list state) */
      .aghi-aw-dm-quick-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 12px 10px 16px; border-bottom: 1px solid var(--dm-line); flex-shrink: 0; }
      .aghi-aw-dm-quick-actions { display: flex; align-items: center; gap: 6px; }

      /* Shared scrollbars */
      .aghi-aw-dm-threads, .aghi-aw-dm-messages { scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-dm-threads::-webkit-scrollbar, .aghi-aw-dm-messages::-webkit-scrollbar { width: 6px; }
      .aghi-aw-dm-threads::-webkit-scrollbar-track, .aghi-aw-dm-messages::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-dm-threads::-webkit-scrollbar-thumb, .aghi-aw-dm-messages::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-dm-threads::-webkit-scrollbar-thumb:hover, .aghi-aw-dm-messages::-webkit-scrollbar-thumb:hover { background: rgba(85, 241, 248, 0.55); }

      @media (max-width: 1000px) {
        .aghi-aw-dm-full-sidebar { width: 272px; min-width: 272px; }
      }

      @media (max-width: 768px) {
        .aghi-aw-dm-panel-quick {
          position: fixed; left: 0; right: 0; bottom: 0; top: auto;
          width: auto; max-width: none; height: auto; max-height: 84vh;
          border-radius: 18px 18px 0 0; border-left: none; border-right: none; border-bottom: none;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .aghi-aw-dm-panel-full { width: 100vw; height: 100vh; height: 100dvh; border-radius: 0; border: none; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-dm-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.22); z-index: 5; pointer-events: none; }
        .aghi-aw-dm-panel.aghi-aw-dm-enter { animation-name: aghiDmSheetIn; }
        .aghi-aw-dm-panel.aghi-aw-dm-leave { animation-name: aghiDmSheetOut; }
        .aghi-aw-dm-panel-full .aghi-aw-dm-back { display: flex; }
        .aghi-aw-dm-panel-full.aghi-aw-dm-has-thread .aghi-aw-dm-full-sidebar { display: none; }
        .aghi-aw-dm-panel-full:not(.aghi-aw-dm-has-thread) .aghi-aw-dm-chat-area { display: none; }
        .aghi-aw-dm-msg { max-width: 86%; }
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
  // Cleaner double-check geometry (lucide "check-check") — the old one turned
  // to mush at icon-button size.
  const MARK_ALL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`;
  const EXPAND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  const SEARCH_ICON = `<svg class="aghi-aw-dm-search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  const USER_PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
  const HEART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const AT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`;

  // Icon shown next to a notification's avatar, driven by its kind — the API
  // accepts free-form kinds, so unknown ones fall back to the bell.
  const NOTIF_KIND_ICONS = {
    friend_request: () => USER_PLUS_ICON,
    friend_accept: () => CHECK_ICON,
    creation_approved: () => CHECK_ICON,
    creation_rejected: () => X_ICON,
    comment: () => CHAT_ICON,
    mention: () => AT_ICON,
    reaction: () => HEART_ICON,
  };
  function notifIcon(kind) {
    const make = NOTIF_KIND_ICONS[kind];
    return make ? make() : BELL_ICON;
  }

  const INBOX_POLL_INTERVAL_MS = 2 * 1000;
  const TYPING_POLL_INTERVAL_MS = 1 * 1000; // separate faster loop, only while a thread is open
  const TYPING_PING_INTERVAL_MS = 2500; // how often we tell the server "still typing" — must stay under dms.php's TYPING_FRESHNESS_SECONDS (5s)
  const REACTION_POLL_INTERVAL_MS = 3 * 1000; // periodic refresh so the other participant's new reactions show up live
  const FRIENDS_POLL_INTERVAL_MS = 5 * 1000; // periodic refresh for friends list

  function AccountWidget(mount) {
    this.mount = mount;
    this.state = { loading: true, loggedIn: false, user: null, csrfToken: null };
    this.popupOpen = false;
    this.settingsOpen = false; // popup's Discord-style settings sub-view
    this.presenceMenuOpen = false;
    this.popupClosing = false; // a leave animation is playing for this panel
    this.notifUnreadCount = 0;

    this.inboxOpen = false;
    this.inboxClosing = false;
    this.inboxItems = [];
    this.inboxNextCursor = null;
    this.inboxLoading = false;
    this.inboxLoadedOnce = false;
    this.inboxError = null;

    this.dmUnreadCount = 0;
    this.dmOpen = false;
    this.dmView = 'threads'; // 'threads' | 'thread'
    this.dmMode = 'quick'; // 'quick' | 'full'
    this.dmThreads = [];
    this.dmNextCursor = null;
    this.dmThreadsLoading = false;
    this.dmThreadsLoadedOnce = false;
    this.dmThreadsError = null;
    this.dmReplyToId = null;
    this.dmClosing = false;   // a close animation is playing — block re-entry
    this.dmThreadFilter = ''; // client-side filter for the full-panel search box

    this.friendsOpen = false;
    this.friendsClosing = false;
    this.friends = [];
    this.friendsLoaded = false;
    this.friendsLoading = false;
    this.friendsError = null;
    this.friendsFilter = ''; // client-side search for the friends panel
    this.friendsPollTimer = null;

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
        // Don't rebuild the thread list out from under the search box — skip
        // the refresh while the user is filtering or focused in it.
        const active = document.activeElement;
        const searchBusy = this.dmThreadFilter || (active && active.classList && active.classList.contains('aghi-aw-dm-search-input'));
        if (!searchBusy) this.fetchDmThreads(true);
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
    if (this.popupOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-popup'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.presenceMenuOpen = false;
        this.settingsOpen = false;
        this.animatePanelClose('popupOpen', '.aghi-aw-popup');
      }
    }
    if (this.inboxOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-inbox-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animatePanelClose('inboxOpen', '.aghi-aw-inbox-panel');
      }
    }
    if (this.dmOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-dm-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animateDmClose();
      }
    }
    if (this.friendsOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-friends-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animatePanelClose('friendsOpen', '.aghi-aw-friends-panel');
      }
    }
  };

  AccountWidget.prototype.render = function () {
    document.querySelectorAll('.aghi-aw-backdrop, .aghi-aw-inbox-backdrop, .aghi-aw-inbox-panel, .aghi-aw-dm-backdrop, .aghi-aw-dm-panel, .aghi-aw-friends-backdrop, .aghi-aw-friends-panel, .aghi-aw-popup').forEach((el) => el.remove());

    // Full render() replaces the DOM, so any open-thread state that isn't
    // currently visible shouldn't keep its typing-poll timer alive — covers
    // every way the DM panel/thread can close (inbox button, avatar button,
    // outside click, mobile backdrop) from one place instead of repeating
    // this at each individual close handler.
    if (!this.dmOpen || this.dmView !== 'thread') {
      this.stopDmTypingPolling();
    }
    if (!this.friendsOpen) {
      this.stopFriendsPolling();
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
      // Only treat as a close when the panel is actually in the DOM — keeps
      // a stuck state from eating clicks (same self-heal as the DM button).
      if (this.inboxOpen && document.querySelector('.aghi-aw-inbox-panel')) {
        this.animatePanelClose('inboxOpen', '.aghi-aw-inbox-panel');
        return;
      }
      this.inboxClosing = false;
      this.inboxOpen = true;
      this.popupOpen = false; this.dmOpen = false; this.friendsOpen = false;
      this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      this.fetchInboxList(true);
    });

    const dmBtn = document.createElement('button');
    dmBtn.type = 'button';
    dmBtn.className = 'aghi-aw-dm-btn aghi-aw-inbox-btn';
    dmBtn.setAttribute('aria-label', 'Direct messages');
    dmBtn.setAttribute('aria-expanded', String(this.dmOpen));
    dmBtn.innerHTML = CHAT_ICON;

    const friendsBtn = document.createElement('button');
    friendsBtn.type = 'button';
    friendsBtn.className = 'aghi-aw-friends-btn aghi-aw-inbox-btn';
    friendsBtn.setAttribute('aria-label', 'Friends');
    friendsBtn.setAttribute('aria-expanded', String(this.friendsOpen));
    friendsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    this.refreshDmBadge(dmBtn);
    dmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only treat this as a close if a panel actually exists — if state and
      // DOM ever disagree (a close raced a rebuild), fall through and open
      // instead of eating the click.
      if (this.dmOpen && document.querySelector('.aghi-aw-dm-panel')) {
        this.animateDmClose();
        return;
      }
      this.dmClosing = false;
      this.dmThreadFilter = '';
      this.dmOpen = true;
      this.popupOpen = false; this.inboxOpen = false; this.friendsOpen = false; this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      if (this.dmView === 'thread' && this.dmActiveUser) {
        this.openDmThread(this.dmActiveUser, false);
      } else {
        this.fetchDmThreads(true);
      }
    });

    friendsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.friendsOpen && document.querySelector('.aghi-aw-friends-panel')) {
        this.animatePanelClose('friendsOpen', '.aghi-aw-friends-panel');
        return;
      }
      this.friendsClosing = false;
      this.friendsFilter = '';
      this.friendsOpen = true;
      this.popupOpen = false; this.inboxOpen = false; this.dmOpen = false;
      this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      this.fetchFriendsList(true);
    });

    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'aghi-aw-avatar-btn';
    applyAvatar(avatarBtn, user.pfpId, user.username);
    avatarBtn.setAttribute('aria-expanded', String(this.popupOpen));
    avatarBtn.setAttribute('aria-label', `Account menu for ${user.username}`);
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.popupOpen && document.querySelector('.aghi-aw-popup')) {
        this.presenceMenuOpen = false;
        this.settingsOpen = false;
        this.animatePanelClose('popupOpen', '.aghi-aw-popup');
        return;
      }
      this.popupClosing = false;
      this.popupOpen = true;
      this.inboxOpen = false; this.dmOpen = false; this.friendsOpen = false;
      this.render();
    });

    const row = document.createElement('div');
    row.className = 'aghi-aw-row';
    row.appendChild(inboxBtn);
    row.appendChild(dmBtn);
    row.appendChild(friendsBtn);
    row.appendChild(avatarBtn);

    this.mount.innerHTML = '';
    this.mount.appendChild(row);

    if (this.popupOpen) {
      this.mountPanel(this.buildPopup(), 'popupOpen', '.aghi-aw-popup');
    }
    if (this.inboxOpen) {
      this.mountPanel(this.buildInboxPanel(), 'inboxOpen', '.aghi-aw-inbox-panel');
    }
    if (this.dmOpen) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      // Quick mode on desktop stays anchored under the chat button; mobile
      // sheets and the full messaging window live on <body>, because the
      // topbar's backdrop-filter creates a containing block that hijacks
      // position:fixed descendants.
      const useOverlay = isMobile || this.dmMode === 'full';
      this.dmClosing = false;
      if (useOverlay) {
        const backdrop = document.createElement('div');
        backdrop.className = 'aghi-aw-dm-backdrop';
        backdrop.addEventListener('click', () => { this.animateDmClose(); });
        document.body.appendChild(backdrop);
      }
      const panel = this.buildDmPanel();
      (useOverlay ? document.body : this.mount).appendChild(panel);
      // Mount hidden, then flip the enter class a frame later so the open
      // animation actually plays instead of snapping straight to open.
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('aghi-aw-dm-enter')));
    }
    if (this.friendsOpen) {
      this.mountPanel(this.buildFriendsPanel(), 'friendsOpen', '.aghi-aw-friends-panel');
    }
  };

  // Mounts one of the dropdown panels (profile popup / notifications /
  // friends): bottom sheet + shared backdrop on mobile, anchored dropdown on
  // desktop, then flips the enter class a frame later so the open animation
  // actually plays. The three are mutually exclusive, so one backdrop class
  // is enough. Closing goes through animatePanelClose.
  AccountWidget.prototype.mountPanel = function (panel, flagName, panelSelector) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    this[flagName.replace('Open', 'Closing')] = false;
    if (isMobile) {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-aw-backdrop';
      backdrop.addEventListener('click', () => { this.animatePanelClose(flagName, panelSelector); });
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
    } else {
      this.mount.appendChild(panel);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('aghi-aw-enter')));
  };

  // Animated close for the popup/inbox/friends panels — same pattern as
  // animateDmClose: the open flag flips to false IMMEDIATELY so polls and
  // outside clicks treat the panel as closed while it animates out (a poll
  // rebuild landing mid-close would otherwise pop it right back open), the
  // leave animation plays, then render() removes the DOM. The closing guard
  // keeps double closes from stacking; finish() bails if the panel was
  // re-opened mid-animation.
  AccountWidget.prototype.animatePanelClose = function (flagName, panelSelector) {
    const closingFlag = flagName.replace('Open', 'Closing');
    if (this[closingFlag]) return;
    this[flagName] = false;
    const panel = document.querySelector(panelSelector);
    if (!panel) {
      this.render();
      return;
    }
    this[closingFlag] = true;
    panel.classList.remove('aghi-aw-enter');
    panel.classList.add('aghi-aw-leave');
    const backdrop = document.querySelector('.aghi-aw-backdrop');
    if (backdrop) backdrop.classList.add('aghi-aw-leave');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this[closingFlag] = false;
      if (this[flagName]) return; // re-opened mid-close; the open rebuilt the UI
      this.render();
    };
    panel.addEventListener('animationend', (e) => { if (e.target === panel) finish(); });
    setTimeout(finish, 380); // fallback (e.g. prefers-reduced-motion disables the animation)
  };

  AccountWidget.prototype.buildPopup = function () {
    const popup = document.createElement('div');
    popup.className = 'aghi-aw-popup';
    popup.appendChild(this.settingsOpen ? this.buildSettingsView() : this.buildMainView());
    return popup;
  };

  // Identity display + quick actions. Editing lives in the Settings view
  // (buildSettingsView) — Discord-style: the popout shows who you are, the
  // gear/pencils jump into settings for the actual editing.
  AccountWidget.prototype.buildMainView = function () {
    const user = this.state.user;
    const mainRole = user.mainRole || user.role || 'MEMBER';
    const mainRoleStyle = getMainRoleStyle(mainRole);

    const main = document.createElement('div');
    main.className = 'aghi-aw-main';
    main.innerHTML = `
      <div class="aghi-aw-banner" data-action="open-settings" title="Change banner">
        <div class="aghi-aw-banner-hover">${CAMERA_ICON}<span>Change banner</span></div>
      </div>
      <div class="aghi-aw-popup-head-actions">
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="open-settings" aria-label="Settings" title="Settings">${GEAR_ICON}</button>
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
      </div>
      <div class="aghi-aw-popup-body">
        <div class="aghi-aw-avatar-wrap" data-action="open-settings" title="Change avatar">
          <div class="aghi-aw-popup-avatar" data-el="popup-avatar"></div>
          <div class="aghi-aw-avatar-hover">${CAMERA_ICON}</div>
        </div>
        <div data-section="status"></div>
        <div data-section="username"></div>
        <span class="aghi-aw-role" style="${mainRoleStyle}">${escapeHtml(mainRole.toUpperCase())}</span>
        <div data-section="presence"></div>
        <div data-section="about"></div>
        <div data-section="subroles"></div>
        <button type="button" class="aghi-aw-logout" data-action="logout">Log out</button>
      </div>
    `;

    if (user.bannerId) {
      main.querySelector('.aghi-aw-banner').style.backgroundImage =
        `url('/uploads/banner/${encodeURIComponent(user.bannerId)}'), linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85))`;
    }

    applyAvatar(main.querySelector('[data-el="popup-avatar"]'), user.pfpId, user.username);
    // Own dot shows the real presence (invisible renders gray, like Discord).
    renderPresenceDot(main.querySelector('.aghi-aw-avatar-wrap'), { presence: user.presence, online: true });

    main.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.presenceMenuOpen = false;
      this.settingsOpen = false;
      this.animatePanelClose('popupOpen', '.aghi-aw-popup');
    });
    main.querySelectorAll('[data-action="open-settings"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.settingsOpen = true;
        this.rerenderPopup();
      });
    });
    main.querySelector('[data-action="logout"]').addEventListener('click', () => {
      window.location.href = '/logout.php';
    });

    this.renderMainStatus(main.querySelector('[data-section="status"]'));
    this.renderMainUsername(main.querySelector('[data-section="username"]'));
    this.renderPresenceSection(main.querySelector('[data-section="presence"]'));
    this.renderMainAbout(main.querySelector('[data-section="about"]'));
    this.renderSubrolesSection(main.querySelector('[data-section="subroles"]'));

    return main;
  };

  // Settings sub-view: every profile editor in one scrollable place. All
  // sections save through the existing saveProfile/uploadImage flows.
  AccountWidget.prototype.buildSettingsView = function () {
    const view = document.createElement('div');
    view.className = 'aghi-aw-settings';
    view.innerHTML = `
      <div class="aghi-aw-settings-head">
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="back" aria-label="Back to profile">${BACK_ICON}</button>
        <h2 class="aghi-aw-panel-title">Settings</h2>
      </div>
      <div class="aghi-aw-settings-body">
        <div class="aghi-aw-settings-section" data-section="avatar"></div>
        <div class="aghi-aw-settings-section" data-section="banner"></div>
        <div class="aghi-aw-settings-section" data-section="status"></div>
        <div class="aghi-aw-settings-section" data-section="about"></div>
        <div class="aghi-aw-settings-section" data-section="username"></div>
        <div class="aghi-aw-settings-section" data-section="verification"></div>
      </div>
    `;

    view.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsOpen = false;
      this.rerenderPopup();
    });

    this.renderPfpSection(view.querySelector('[data-section="avatar"]'));
    this.renderBannerSection(view.querySelector('[data-section="banner"]'));
    this.renderStatusEditor(view.querySelector('[data-section="status"]'));
    this.renderAboutEditor(view.querySelector('[data-section="about"]'));
    this.renderUsernameEditor(view.querySelector('[data-section="username"]'));
    this.renderVerificationSection(view.querySelector('[data-section="verification"]'));

    return view;
  };

  // Firebase is deliberately imported only after the member asks to verify:
  // ordinary browsing and account editing do not pay for the auth SDK.
  AccountWidget.prototype.renderVerificationSection = function (el) {
    const user = this.state.user;
    if (user.is_verified) {
      el.innerHTML = `
        <div class="aghi-aw-about-label">Verification</div>
        <div class="aghi-aw-upload-hint" style="text-align:left;color:#55F1F8">✓ Verified at PCU${user.email ? ` · ${escapeHtml(user.email)}` : ''}</div>`;
      return;
    }
    el.innerHTML = `
      <div class="aghi-aw-about-label">Verification</div>
      <div class="aghi-aw-upload-hint" style="text-align:left;margin:0 0 8px">Verify with your @pcu.edu.ph account to unlock Creations submissions.</div>
      <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="verify">Verify with PCU</button>
      <div class="aghi-aw-error" hidden></div>`;
    el.querySelector('[data-action="verify"]').addEventListener('click', async () => {
      const button = el.querySelector('[data-action="verify"]');
      const errorEl = el.querySelector('.aghi-aw-error');
      button.disabled = true;
      button.textContent = 'Opening Google…';
      try {
        const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
        ]);
        const config = (window.AGHI_CONFIG && window.AGHI_CONFIG.firebase) || { apiKey: 'AIzaSyAavb6fsEoM2r55AIFG2uHZAOQBg2YPGIE', authDomain: 'aghimuan-network.firebaseapp.com', projectId: 'aghimuan-network' };
        const app = getApps().length ? getApps()[0] : initializeApp(config);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ hd: 'pcu.edu.ph' });
        const result = await signInWithPopup(getAuth(app), provider);
        const idToken = await result.user.getIdToken();
        const response = await fetch('/api/verify-firebase.php', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, csrf_token: this.state.csrfToken }),
        });
        const data = await response.json();
        if (!data.ok) throw new Error(data.error === 'verification_failed' ? 'Please choose a verified @pcu.edu.ph account.' : (data.error || 'Verification failed.'));
        this.state.user = { ...this.state.user, is_verified: true, email: data.email };
        this.rerenderPopup();
      } catch (err) {
        errorEl.textContent = err && err.message ? err.message : 'Verification failed. Try again.';
        errorEl.hidden = false;
        button.disabled = false;
        button.textContent = 'Verify with PCU';
      }
    });
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

  AccountWidget.prototype.renderMainStatus = function (el) {
    const user = this.state.user;
    el.innerHTML = `
      <div class="aghi-aw-status-row" data-action="open-settings" title="Edit status">
        <span class="aghi-aw-status-text ${user.status ? '' : 'aghi-aw-empty'}"></span>
        <span class="aghi-aw-row-pencil">${PENCIL_ICON}</span>
      </div>
    `;
    el.querySelector('.aghi-aw-status-text').textContent = user.status || 'Set a status…';
    el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsOpen = true;
      this.rerenderPopup();
    });
  };

  AccountWidget.prototype.renderStatusEditor = function (el) {
    const user = this.state.user;
    el.innerHTML = `
      <div class="aghi-aw-about-label">Status</div>
      <textarea class="aghi-aw-textarea" rows="2" maxlength="${MAX_STATUS_LENGTH}" placeholder="What have you been up to?">${escapeHtml(user.status)}</textarea>
      <div class="aghi-aw-charcount">0/${MAX_STATUS_LENGTH}</div>
      <div class="aghi-aw-edit-actions">
        <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
        <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
      </div>
      <div class="aghi-aw-error" hidden></div>
    `;
    const textarea = el.querySelector('textarea');
    const count = el.querySelector('.aghi-aw-charcount');
    const updateCount = () => { count.textContent = `${textarea.value.length}/${MAX_STATUS_LENGTH}`; };
    updateCount();
    textarea.addEventListener('input', updateCount);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      textarea.value = user.status;
      updateCount();
    });
    el.querySelector('[data-action="save"]').addEventListener('click', () => {
      this.saveProfile({ status: textarea.value }, el);
    });
  };

  AccountWidget.prototype.renderMainAbout = function (el) {
    const user = this.state.user;
    el.innerHTML = `
      <div class="aghi-aw-main-section" data-action="open-settings" title="Edit about">
        <div class="aghi-aw-about-label">About Me</div>
        <div class="aghi-aw-about-text ${user.bio ? '' : 'aghi-aw-empty'}"></div>
      </div>
    `;
    el.querySelector('.aghi-aw-about-text').textContent = user.bio || 'Add a bio…';
    el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsOpen = true;
      this.rerenderPopup();
    });
  };

  AccountWidget.prototype.renderAboutEditor = function (el) {
    const user = this.state.user;
    el.innerHTML = `
      <div class="aghi-aw-about-label">About Me</div>
      <textarea class="aghi-aw-textarea" rows="3" maxlength="${MAX_BIO_LENGTH}" placeholder="Tell people a bit about yourself…">${escapeHtml(user.bio)}</textarea>
      <div class="aghi-aw-charcount">0/${MAX_BIO_LENGTH}</div>
      <div class="aghi-aw-edit-actions">
        <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
        <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
      </div>
      <div class="aghi-aw-error" hidden></div>
    `;
    const textarea = el.querySelector('textarea');
    const count = el.querySelector('.aghi-aw-charcount');
    const updateCount = () => { count.textContent = `${textarea.value.length}/${MAX_BIO_LENGTH}`; };
    updateCount();
    textarea.addEventListener('input', updateCount);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      textarea.value = user.bio;
      updateCount();
    });
    el.querySelector('[data-action="save"]').addEventListener('click', () => {
      this.saveProfile({ bio: textarea.value }, el);
    });
  };

  AccountWidget.prototype.renderMainUsername = function (el) {
    const user = this.state.user;
    const daysLeft = daysUntil(user.usernameChangeAvailableAt);
    const locked = daysLeft > 0;

    el.innerHTML = `
      <div class="aghi-aw-username-row ${locked ? 'aghi-aw-locked' : ''}" data-action="open-settings">
        <p class="aghi-aw-username">${escapeHtml(user.username)}</p>
        <span class="aghi-aw-username-edit-icon" title="${locked ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Change username'}">${PENCIL_ICON}</span>
      </div>
    `;
    el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsOpen = true;
      this.rerenderPopup();
    });
  };

  AccountWidget.prototype.renderUsernameEditor = function (el) {
    const user = this.state.user;
    const daysLeft = daysUntil(user.usernameChangeAvailableAt);
    const locked = daysLeft > 0;

    el.innerHTML = `
      <div class="aghi-aw-about-label">Username</div>
      <input type="text" class="aghi-aw-input" maxlength="20" value="${escapeHtml(user.username)}" placeholder="New username" ${locked ? 'disabled' : ''}>
      ${locked ? `<div class="aghi-aw-upload-hint" style="text-align:left; margin: 4px 0 0;">You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.</div>` : `
      <div class="aghi-aw-edit-actions">
        <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
        <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
      </div>`}
      <div class="aghi-aw-error" hidden></div>
    `;
    if (locked) return;

    const input = el.querySelector('input');
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      input.value = user.username;
    });
    el.querySelector('[data-action="save"]').addEventListener('click', () => {
      const value = input.value.trim();
      const errorEl = el.querySelector('.aghi-aw-error');
      if (!USERNAME_PATTERN.test(value)) {
        errorEl.textContent = 'Username must be 3-20 characters: letters, numbers, and underscores only.';
        errorEl.hidden = false;
        return;
      }
      this.saveProfile({ username: value }, el);
    });
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
      <div class="aghi-aw-panel-head">
        <h2 class="aghi-aw-panel-title">Notifications</h2>
        <div class="aghi-aw-panel-head-actions">
          ${this.notifUnreadCount > 0 ? `<span class="aghi-aw-panel-chip" title="${this.notifUnreadCount} unread">${this.notifUnreadCount}</span>` : ''}
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="mark-all" aria-label="Mark all read" title="Mark all read" ${this.notifUnreadCount === 0 ? 'disabled' : ''}>${MARK_ALL_ICON}</button>
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
      </div>
      <div class="aghi-aw-inbox-list"></div>
      <button type="button" class="aghi-aw-inbox-loadmore" data-action="load-more" hidden>Load more</button>
    `;
    panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.animatePanelClose('inboxOpen', '.aghi-aw-inbox-panel');
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

  // Keeps the header's unread chip + mark-all button in sync without
  // rebuilding the whole panel (marking one item read would otherwise leave
  // a stale chip until the next poll tick).
  AccountWidget.prototype.refreshInboxHeader = function () {
    const headActions = document.querySelector('.aghi-aw-inbox-panel .aghi-aw-panel-head-actions');
    if (!headActions) return;
    let chip = headActions.querySelector('.aghi-aw-panel-chip');
    const markAll = headActions.querySelector('[data-action="mark-all"]');
    if (this.notifUnreadCount > 0) {
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'aghi-aw-panel-chip';
        headActions.insertBefore(chip, headActions.firstChild);
      }
      chip.textContent = this.notifUnreadCount;
      chip.title = `${this.notifUnreadCount} unread`;
      if (markAll) markAll.disabled = false;
    } else {
      if (chip) chip.remove();
      if (markAll) markAll.disabled = true;
    }
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

    // Friend requests stay pinned in their own section; everything else is
    // "Recent" (only labeled when requests exist above it).
    const requests = this.inboxItems.filter((it) => it.kind === 'friend_request');
    const rest = this.inboxItems.filter((it) => it.kind !== 'friend_request');

    const renderItem = (item) => {
      const unread = item.kind === 'friend_request' || !item.isRead;
      const clickable = item.kind !== 'friend_request' && !item.isRead;
      return `
        <div class="aghi-aw-inbox-item ${unread ? 'aghi-aw-unread' : ''} ${clickable ? 'aghi-aw-clickable' : ''}" data-item-id="${escapeHtml(String(item.id))}">
          <div class="aghi-aw-inbox-avatar-wrap">
            <div class="aghi-aw-inbox-avatar" data-el="avatar"></div>
            <span class="aghi-aw-inbox-kind" title="${escapeHtml(item.kind)}">${notifIcon(item.kind)}</span>
          </div>
          <div class="aghi-aw-inbox-body">
            <div class="aghi-aw-inbox-text">${item.kind === 'friend_request'
              ? `<strong>${escapeHtml(item.actorUsername)}</strong> sent you a friend request.`
              : notifText(item)}</div>
            <div class="aghi-aw-inbox-time">${timeAgo(item.createdAt)}</div>
            ${item.kind === 'friend_request' ? `
              <div class="aghi-aw-inbox-actions">
                <button type="button" class="aghi-aw-pill aghi-aw-pill-accept" data-action="accept">${CHECK_ICON}<span>Accept</span></button>
                <button type="button" class="aghi-aw-pill aghi-aw-pill-decline" data-action="decline">${X_ICON}<span>Decline</span></button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    };
    const section = (label, items) => {
      if (!items.length) return '';
      return `${label ? `<div class="aghi-aw-inbox-section">${label}</div>` : ''}${items.map(renderItem).join('')}`;
    };

    listEl.innerHTML = section('Friend requests', requests) + section(requests.length ? 'Recent' : '', rest);

    listEl.querySelectorAll('.aghi-aw-inbox-item').forEach((rowEl) => {
      const id = rowEl.getAttribute('data-item-id');
      const item = this.inboxItems.find((it) => String(it.id) === id);
      if (!item) return;
      // Creations decisions come from the club itself (no user actor), so
      // they render the Aghimuan logo + name instead of a "?" monogram.
      if (item.kind === 'creation_approved' || item.kind === 'creation_rejected') {
        const av = rowEl.querySelector('[data-el="avatar"]');
        av.style.backgroundImage = `url('/favicon-32.png')`;
        av.style.backgroundColor = '#0a1520';
      } else {
        applyAvatar(rowEl.querySelector('[data-el="avatar"]'), item.pfpId, item.actorUsername);
      }

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

    this.refreshInboxHeader();
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
    if (this.dmMode === 'full') {
      return this.buildDmPanelFull();
    }
    return this.buildDmPanelQuick();
  };

  // Shared conversation markup used by both the quick dropdown and the full
  // messaging window, so the header, messages, composer and reply preview
  // behave identically in either view. `isQuick` adds the dropdown's
  // expand/close buttons into the chat header.
  AccountWidget.prototype.buildDmChatHtml = function (isQuick) {
    return `
      <div class="aghi-aw-dm-header">
        <button type="button" class="aghi-aw-dm-back" data-action="dm-back" aria-label="Back to conversations">${BACK_ICON}</button>
        <div class="aghi-aw-dm-header-avatar-wrap">
          <div class="aghi-aw-dm-header-avatar" data-el="chat-avatar"></div>
        </div>
        <div class="aghi-aw-dm-header-info">
          <div class="aghi-aw-dm-header-name" data-el="chat-username"></div>
          <div class="aghi-aw-dm-header-status" data-el="status" hidden></div>
        </div>
        ${isQuick ? `
          <div class="aghi-aw-dm-header-actions">
            <button type="button" class="aghi-aw-dm-icon-btn" data-action="expand" aria-label="Open full messaging" title="Expand">${EXPAND_ICON}</button>
            <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
          </div>
        ` : ''}
      </div>
      <div class="aghi-aw-dm-messages" data-el="messages"></div>
      <div class="aghi-aw-dm-composer">
        <div class="aghi-aw-dm-reply-preview" data-el="reply-preview" hidden>
          <div class="aghi-aw-dm-reply-avatar" data-el="reply-avatar"></div>
          <div class="aghi-aw-dm-reply-texts">
            <span class="aghi-aw-dm-reply-name" data-el="reply-name"></span>
            <span class="aghi-aw-dm-reply-text" data-el="reply-text"></span>
          </div>
          <button type="button" class="aghi-aw-dm-reply-cancel" data-action="cancel-reply" aria-label="Cancel reply">${X_ICON}</button>
        </div>
        <div class="aghi-aw-dm-composer-row">
          <textarea class="aghi-aw-dm-input" data-el="input" rows="1" maxlength="2000" placeholder="Type a message…"></textarea>
          <button type="button" class="aghi-aw-dm-emoji" data-action="emoji" aria-label="Insert emoji" title="Emoji">🙂</button>
          <button type="button" class="aghi-aw-dm-send" data-action="send" aria-label="Send">${SEND_ICON}</button>
        </div>
      </div>
    `;
  };

  // Wires up an already-mounted conversation block (header presence, message
  // list, composer, reply preview).
  AccountWidget.prototype.initDmChat = function (panel, isQuick) {
    const backBtn = panel.querySelector('[data-action="dm-back"]');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dmView = 'threads';
        this.dmEditingMessageId = null;
        this.stopDmTypingPolling();
        this.rerenderDmPanel();
      });
    }
    if (isQuick) {
      const expandBtn = panel.querySelector('[data-action="expand"]');
      const closeBtn = panel.querySelector('[data-action="close"]');
      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dmMode = 'full';
          this.rerenderDmPanel();
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.animateDmClose();
        });
      }
    }

    applyAvatar(panel.querySelector('[data-el="chat-avatar"]'), this.dmActiveUser.pfpId, this.dmActiveUser.username);
    panel.querySelector('[data-el="chat-username"]').textContent = this.dmActiveUser.username;
    this.renderDmHeaderPresence(panel.querySelector('.aghi-aw-dm-header'));
    this.renderDmMessages(panel.querySelector('[data-el="messages"]'));
    this.wireDmComposer(panel);
    this.updateReplyPreview(panel);
  };

  AccountWidget.prototype.wireDmComposer = function (panel) {
    const input = panel.querySelector('[data-el="input"]');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.dmSending) this.sendDmMessage(panel);
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      if (input.value.trim()) this.notifyDmTyping();
    });

    const sendBtn = panel.querySelector('[data-action="send"]');
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.sendDmMessage(panel);
      });
    }

    // Emoji button reuses the shared picker (emoji-picker-core.js). Hidden
    // on pages that don't load the picker script, mirroring the canReact
    // pattern used for message react buttons.
    const emojiBtn = panel.querySelector('[data-action="emoji"]');
    if (emojiBtn) {
      if (!window.AghiEmojiPicker) {
        emojiBtn.style.display = 'none';
      } else {
        emojiBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.AghiEmojiPicker.open(emojiBtn, (emoji) => {
            const start = input.selectionStart != null ? input.selectionStart : input.value.length;
            const end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
            input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
            const caret = start + emoji.length;
            input.focus();
            try { input.selectionStart = input.selectionEnd = caret; } catch (_) {}
            // Reuse the input listener: autoresize + typing ping.
            input.dispatchEvent(new Event('input', { bubbles: true }));
          });
        });
      }
    }

    const cancelReplyBtn = panel.querySelector('[data-action="cancel-reply"]');
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dmReplyToId = null;
        this.updateReplyPreview(panel);
      });
    }
  };

  AccountWidget.prototype.buildDmPanelQuick = function () {
    const panel = document.createElement('div');
    panel.className = 'aghi-aw-dm-panel aghi-aw-dm-panel-quick';

    // Facebook-style: the dropdown shows either the conversation list or the
    // open thread itself (with a back button), so quick mode is fully usable
    // without expanding to the full window.
    if (this.dmView === 'thread' && this.dmActiveUser) {
      panel.innerHTML = this.buildDmChatHtml(true);
      this.initDmChat(panel, true);
      return panel;
    }

    panel.innerHTML = `
      <div class="aghi-aw-dm-quick-head">
        <h2 class="aghi-aw-dm-panel-title">Messages</h2>
        <div class="aghi-aw-dm-quick-actions">
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="expand" aria-label="Open full messaging" title="Expand">${EXPAND_ICON}</button>
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
      </div>
      <div class="aghi-aw-dm-threads" data-el="threads"></div>
    `;

    panel.querySelector('[data-action="expand"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dmMode = 'full';
      this.rerenderDmPanel();
    });

    panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.animateDmClose();
    });

    this.renderDmThreads(panel.querySelector('[data-el="threads"]'));

    return panel;
  };

  AccountWidget.prototype.buildDmPanelFull = function () {
    const panel = document.createElement('div');
    const inThread = this.dmView === 'thread' && this.dmActiveUser;
    panel.className = 'aghi-aw-dm-panel aghi-aw-dm-panel-full' + (inThread ? ' aghi-aw-dm-has-thread' : '');

    panel.innerHTML = `
      <div class="aghi-aw-dm-full-sidebar">
        <div class="aghi-aw-dm-full-sidebar-head">
          <h2 class="aghi-aw-dm-panel-title">Messages</h2>
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
        <div class="aghi-aw-dm-full-search">
          ${SEARCH_ICON}
          <input type="text" class="aghi-aw-dm-search-input" placeholder="Search conversations…" data-el="thread-search" value="${escapeHtml(this.dmThreadFilter || '').replace(/"/g, '&quot;')}">
        </div>
        <div class="aghi-aw-dm-threads" data-el="threads"></div>
      </div>
      <div class="aghi-aw-dm-chat-area">
        ${inThread ? this.buildDmChatHtml(false) : `
          <div class="aghi-aw-dm-chat-empty">
            <div class="aghi-aw-dm-chat-empty-icon">${CHAT_ICON}</div>
            <div class="aghi-aw-dm-chat-empty-title">Your messages</div>
            <div class="aghi-aw-dm-chat-empty-sub">Select a conversation on the left, or open someone's profile and hit message.</div>
          </div>
        `}
      </div>
    `;

    panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dmMode = 'quick';
      this.animateDmClose();
    });

    const searchInput = panel.querySelector('[data-el="thread-search"]');
    searchInput.addEventListener('input', () => {
      this.dmThreadFilter = searchInput.value;
      this.renderDmThreads(panel.querySelector('[data-el="threads"]'));
    });

    this.renderDmThreads(panel.querySelector('[data-el="threads"]'));

    if (inThread) this.initDmChat(panel, false);

    return panel;
  };

  // Plays the leave animation, THEN removes the panel — render() wipes the
  // panels synchronously, so closing without this would cut the animation off
  // before it runs. dmOpen flips to false IMMEDIATELY (not after the
  // animation): every poll/rerender path checks it, and with it still true a
  // poll tick landing mid-close would rebuild the panel and pop it back open.
  // The dmClosing guard keeps double closes (close button + backdrop +
  // outside click) from stacking, and finish() bails if the panel was
  // re-opened mid-animation.
  AccountWidget.prototype.animateDmClose = function () {
    if (this.dmClosing) return;
    this.dmOpen = false;
    const panel = document.querySelector('.aghi-aw-dm-panel');
    if (!panel) {
      this.render();
      return;
    }
    this.dmClosing = true;
    panel.classList.remove('aghi-aw-dm-enter');
    panel.classList.add('aghi-aw-dm-leave');
    const backdrop = document.querySelector('.aghi-aw-dm-backdrop');
    if (backdrop) backdrop.classList.add('aghi-aw-dm-leave');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.dmClosing = false;
      if (this.dmOpen) return; // re-opened mid-close; the open already rebuilt the UI
      this.render();
    };
    panel.addEventListener('animationend', (e) => { if (e.target === panel) finish(); });
    setTimeout(finish, 350); // fallback (e.g. prefers-reduced-motion disables the animation)
  };

  // Re-renders the panel in place without replaying the open animation (used
  // for polling refreshes) — only the initial open in render() adds the enter
  // class. Mode switches also move the panel between the topbar anchor
  // (quick, desktop) and document.body (mobile sheets + full window), and
  // keep the backdrop in sync.
  AccountWidget.prototype.rerenderDmPanel = function () {
    if (!this.dmOpen) return;
    const existing = document.querySelector('.aghi-aw-dm-panel');
    const fresh = this.buildDmPanel();
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const useOverlay = isMobile || this.dmMode === 'full';

    const backdrop = document.querySelector('.aghi-aw-dm-backdrop');
    if (useOverlay && !backdrop) {
      const el = document.createElement('div');
      el.className = 'aghi-aw-dm-backdrop';
      el.addEventListener('click', () => { this.animateDmClose(); });
      document.body.appendChild(el);
    } else if (!useOverlay && backdrop) {
      backdrop.remove();
    }

    const targetParent = useOverlay ? document.body : this.mount;
    if (existing && existing.parentElement === targetParent) {
      existing.replaceWith(fresh);
    } else {
      if (existing) existing.remove();
      targetParent.appendChild(fresh);
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
      el.innerHTML = '<div class="aghi-aw-dm-empty">Loading conversations…</div>';
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

    const filter = (this.dmThreadFilter || '').trim().toLowerCase();
    const threads = filter
      ? this.dmThreads.filter((t) =>
          t.username.toLowerCase().includes(filter) ||
          String((t.lastMessage && t.lastMessage.body) || '').toLowerCase().includes(filter))
      : this.dmThreads;

    if (filter && threads.length === 0) {
      el.innerHTML = '<div class="aghi-aw-dm-empty">No conversations match your search.</div>';
      return;
    }

    el.innerHTML = threads.map((t) => {
      const deleted = t.lastMessage.status === 'deleted';
      const preview = deleted ? 'Message deleted' : t.lastMessage.body;
      const mine = !deleted && String(t.lastMessage.senderId) === String(this.state.user.id) ? 'You: ' : '';
      const active = this.dmView === 'thread' && this.dmActiveUser && String(this.dmActiveUser.id) === String(t.userId)
        ? 'aghi-aw-dm-thread-active' : '';
      const unreadBadge = t.unreadCount > 0
        ? `<span class="aghi-aw-dm-thread-unread-badge">${t.unreadCount > 9 ? '9+' : t.unreadCount}</span>` : '';
      return `
        <div class="aghi-aw-dm-thread-item ${t.unreadCount > 0 ? 'aghi-aw-dm-thread-unread' : ''} ${active}" data-user-id="${t.userId}">
          <div class="aghi-aw-dm-thread-avatar" data-el="avatar"></div>
          <div class="aghi-aw-dm-thread-body">
            <div class="aghi-aw-dm-thread-top">
              <span class="aghi-aw-dm-thread-name">${escapeHtml(t.username)}</span>
              <span class="aghi-aw-dm-thread-time">${timeAgo(t.lastMessage.createdAt)}</span>
            </div>
            <div class="aghi-aw-dm-thread-bottom">
              <span class="aghi-aw-dm-thread-preview">${mine}${escapeHtml(preview)}</span>
              ${unreadBadge}
            </div>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.aghi-aw-dm-thread-item').forEach((rowEl) => {
      const userId = rowEl.getAttribute('data-user-id');
      const t = threads.find((th) => String(th.userId) === userId);
      if (!t) return;
      const avatarEl = rowEl.querySelector('[data-el="avatar"]');
      applyAvatar(avatarEl, t.pfpId, t.username);
      renderPresenceDot(avatarEl, t);
      rowEl.addEventListener('click', (e) => {
        if (e.target.closest('.aghi-aw-dm-presence-dot')) return;
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
      this.startDmReactionPolling();
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
        // Merge by id: brand-new messages append, edited/deleted messages
        // replace their stale copy in place (poll now returns those too).
        // A poll can race an in-flight send: the POST lands on the server
        // between our afterId snapshot and the poll query, so the poll
        // returns the just-sent message before sendDmMessage pushes it.
        // Dedupe by id or the bubble appears twice until refresh.
        const myIdStr = String(this.state.user.id);
        let appendedOther = false;
        const byId = new Map(this.dmMessages.map((m) => [m.id, m]));
        for (const m of data.messages) {
          if (byId.has(m.id)) {
            byId.set(m.id, m);
          } else {
            this.dmMessages.push(m);
            byId.set(m.id, m);
            if (String(m.senderId) !== myIdStr) appendedOther = true;
          }
        }
        // Edited merges keep their position; keep the array chronological.
        this.dmMessages.sort((a, b) => a.id - b.id);
        this.dmLastMessageId = Math.max(this.dmLastMessageId, ...data.messages.map((m) => m.id));
        // Only a genuinely NEW message from the partner pulls the scroll
        // down — their edit to an old bubble must not yank the view.
        if (appendedOther) this.scrollDmMessagesToBottom();
      }
      // A full render() rebuilds every bubble's HTML, which would wipe out an
      // in-progress edit textarea mid-keystroke. Skip the rebuild while
      // editing — the next poll tick after editing ends picks up whatever
      // changed in the meantime.
      if (this.dmEditingMessageId !== null) return;
      this.renderDmMessages(document.querySelector('.aghi-aw-dm-panel .aghi-aw-dm-messages'));
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

  AccountWidget.prototype.startDmReactionPolling = function () {
    this.stopDmReactionPolling();
    this.dmReactionPollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !this.dmActiveUser || this.dmView !== 'thread') return;
      this.refreshDmReactions();
    }, REACTION_POLL_INTERVAL_MS);
  };

  AccountWidget.prototype.stopDmReactionPolling = function () {
    if (this.dmReactionPollTimer) {
      clearInterval(this.dmReactionPollTimer);
      this.dmReactionPollTimer = null;
    }
  };

  AccountWidget.prototype.stopDmTypingPolling = function () {
    if (this.dmTypingPollTimer) {
      clearInterval(this.dmTypingPollTimer);
      this.dmTypingPollTimer = null;
    }
    this.dmOtherTyping = false;
    this.stopDmReactionPolling();
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
      statusEl.innerHTML = '<span class="aghi-aw-dm-typing-dots"><span></span><span></span><span></span></span><span class="aghi-aw-dm-typing-label">typing…</span>';
      statusEl.hidden = false;
    } else if (data && data.status) {
      statusEl.textContent = data.status;
      statusEl.hidden = false;
    } else {
      // No custom status — fall back to the presence label. Invisible or
      // stale sessions read as plain "Offline", same rule as everywhere else.
      statusEl.textContent = effectiveDmPresence(data).label;
      statusEl.hidden = false;
    }
  };

  AccountWidget.prototype.renderDmMessages = function (el) {
    if (!el) return;
    // Messages newer than the last rendered id play the slide-in animation;
    // everything else re-renders silently so poll ticks never replay it.
    const prevLastId = parseInt(el.getAttribute('data-last-id') || '0', 10);

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
      const mine = String(m.senderId) === String(myId);
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
          <button type="button" class="aghi-aw-dm-msg-action-btn" data-action="reply" aria-label="Reply">${BACK_ICON}</button>
          ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn" data-action="edit" aria-label="Edit">${PENCIL_ICON}</button>` : ''}
          ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn aghi-aw-dm-action-danger" data-action="delete" aria-label="Delete">${TRASH_ICON}</button>` : ''}
        </div>
      `;

      // Build reply context if this message is a reply
      let replyHtml = '';
      if (m.replyToId) {
        const repliedMsg = this.dmMessages.find((msg) => msg.id === m.replyToId);
        if (repliedMsg) {
          // IDs are coerced to strings before comparing: this.state.user.id
          // comes from the auth-check endpoint while senderId comes from
          // dms.php, and if one side returns a numeric id and the other a
          // stringified one, every === below silently fails and falls
          // through to the "someone else" branches — which is what was
          // producing your own username in the reply label.
          const myIdStr = String(myId);
          const repliedSenderStr = String(repliedMsg.senderId);
          const replierSenderStr = String(m.senderId);
          const repliedUser = repliedSenderStr === myIdStr ? this.state.user : this.dmActiveUser;
          const replierUser = replierSenderStr === myIdStr ? this.state.user : this.dmActiveUser;
          const repliedToSelf = repliedSenderStr === replierSenderStr;
          const repliedToYou = repliedSenderStr === myIdStr;
          let replyLabel = '';
          if (repliedToSelf) {
            replyLabel = `${repliedUser.username} quoted`;
          } else if (repliedToYou) {
            replyLabel = `${replierUser.username} replied to you`;
          } else {
            replyLabel = `↩ ${repliedUser.username}`;
          }
          replyHtml = `<div class="aghi-aw-dm-bubble-reply"><span class="aghi-aw-dm-bubble-reply-label">${escapeHtml(replyLabel)}</span><span class="aghi-aw-dm-bubble-reply-text">${escapeHtml(repliedMsg.body)}</span></div>`;
        }
      }

      const enterClass = m.id > prevLastId ? 'aghi-aw-dm-msg-enter' : '';
      return `
        <div class="aghi-aw-dm-msg ${mine ? 'aghi-aw-dm-msg-mine' : ''} ${enterClass}" data-msg-id="${m.id}">
          ${actionsHtml}
          <div class="aghi-aw-dm-bubble">${replyHtml}${escapeHtml(m.body)}</div>
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
          if (!window.AghiEmojiPicker) return;
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

      const replyBtn = msgEl.querySelector('[data-action="reply"]');
      if (replyBtn) {
        replyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dmReplyToId = id;
          const dmPanel = el.closest('.aghi-aw-dm-panel') || document.querySelector('.aghi-aw-dm-panel');
          if (dmPanel) {
            this.updateReplyPreview(dmPanel);
            const inputEl = dmPanel.querySelector('[data-el="input"]');
            if (inputEl) inputEl.focus();
          }
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

    const maxId = this.dmMessages.reduce((mx, m) => Math.max(mx, m.id || 0), 0);
    if (maxId) el.setAttribute('data-last-id', String(maxId));
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
      // reactions.php's list endpoint takes target_type/target_id — the old
      // targetType/targetId spelling made every fetch 400 silently, which is
      // why reactions never updated live (only your own toggle rendered).
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

  AccountWidget.prototype.refreshDmReactions = async function () {
    if (!this.dmActiveUser) return;
    try {
      const messagesEl = document.querySelector('.aghi-aw-dm-panel .aghi-aw-dm-messages');
      if (!messagesEl) return;
      
      const messageIds = this.dmMessages.map(m => m.id);
      if (messageIds.length === 0) return;
      
      for (const msgId of messageIds) {
        try {
          const res = await fetch(`/api/reactions.php?target_type=dm_message&target_id=${encodeURIComponent(msgId)}`, {
            credentials: 'same-origin'
          });
          if (!res.ok) continue;
          const data = await res.json();
          this.dmReactionCache.set(msgId, { counts: data.counts || {}, userReactions: data.userReactions || [] });
          const msgEl = messagesEl.querySelector(`[data-msg-id="${msgId}"]`);
          if (msgEl) {
            const reactionsEl = msgEl.querySelector('[data-el="reactions"]');
            if (reactionsEl) this.renderDmReactionPills(reactionsEl, msgId);
          }
        } catch (e) {
        }
      }
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

  // -----------------------------------------------------------------
  // Friends List
  // -----------------------------------------------------------------

  AccountWidget.prototype.fetchFriendsList = async function (force = false) {
    try {
      const res = await fetch('/api/friends.php?action=list', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        this.friends = data.friends || [];
        this.friendsLoaded = true;
        this.friendsLoading = false;
        this.rerenderFriendsPanel();
      }
    } catch (e) {
      this.friendsLoading = false;
      this.friendsError = 'Failed to load friends';
      this.rerenderFriendsPanel();
    }
  };

  AccountWidget.prototype.startFriendsPolling = function () {
    this.stopFriendsPolling();
    this.friendsPollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !this.friendsOpen) return;
      // Skip the refresh while the user is filtering or focused in the
      // search box — a rebuild would steal focus and wipe their input.
      const active = document.activeElement;
      const searchBusy = this.friendsFilter || (active && active.classList && active.classList.contains('aghi-aw-dm-search-input'));
      if (searchBusy) return;
      this.fetchFriendsList(true);
    }, FRIENDS_POLL_INTERVAL_MS);
  };

  AccountWidget.prototype.stopFriendsPolling = function () {
    if (this.friendsPollTimer) {
      clearInterval(this.friendsPollTimer);
      this.friendsPollTimer = null;
    }
  };

  AccountWidget.prototype.buildFriendsPanel = function () {
    const panel = document.createElement('div');
    panel.className = 'aghi-aw-friends-panel';
    panel.innerHTML = `
      <div class="aghi-aw-panel-head">
        <h2 class="aghi-aw-panel-title">Friends</h2>
        <div class="aghi-aw-panel-head-actions">
          <span class="aghi-aw-friends-count">${this.friends.length}</span>
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${X_ICON}</button>
        </div>
      </div>
      <div class="aghi-aw-friends-search">
        ${SEARCH_ICON}
        <input type="text" class="aghi-aw-dm-search-input" placeholder="Search friends…" data-el="friend-search" value="${escapeHtml(this.friendsFilter || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="aghi-aw-friends-list"></div>
    `;
    panel.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.animatePanelClose('friendsOpen', '.aghi-aw-friends-panel');
    });
    const searchInput = panel.querySelector('[data-el="friend-search"]');
    searchInput.addEventListener('input', () => {
      this.friendsFilter = searchInput.value;
      this.renderFriendsList(panel.querySelector('.aghi-aw-friends-list'));
    });
    this.renderFriendsList(panel.querySelector('.aghi-aw-friends-list'));
    this.startFriendsPolling();
    return panel;
  };

  AccountWidget.prototype.renderFriendsList = function (el) {
    if (!el) return;
    if (this.friendsLoading && !this.friendsLoaded) {
      el.innerHTML = '<div class="aghi-aw-friends-loading">Loading…</div>';
      return;
    }
    if (this.friendsError) {
      el.innerHTML = `<div class="aghi-aw-friends-empty">${escapeHtml(this.friendsError)}</div>`;
      return;
    }
    if (!this.friends || this.friends.length === 0) {
      el.innerHTML = '<div class="aghi-aw-friends-empty">No friends yet. Send a friend request to get started!</div>';
      return;
    }

    const filter = (this.friendsFilter || '').trim().toLowerCase();
    const friends = filter
      ? this.friends.filter((f) =>
          f.username.toLowerCase().includes(filter) ||
          String(f.status || '').toLowerCase().includes(filter))
      : this.friends.slice();
    if (filter && friends.length === 0) {
      el.innerHTML = '<div class="aghi-aw-friends-empty">No friends match your search.</div>';
      return;
    }

    // Online friends float to the top, then away/dnd, then everyone else —
    // alphabetical within each group.
    const rank = (f) => (!f.online ? 3 : f.presence === 'away' ? 1 : f.presence === 'dnd' ? 2 : 0);
    friends.sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    el.innerHTML = friends.map((f) => {
      const presenceClass = f.online ? `aghi-aw-friends-${f.presence}` : '';
      // A friend's custom status text wins; otherwise fall back to the
      // colored presence label.
      const statusText = f.status
        || (f.online ? f.presence.charAt(0).toUpperCase() + f.presence.slice(1) : 'Offline');
      return `
        <div class="aghi-aw-friends-item" data-userid="${f.id}">
          <div class="aghi-aw-friends-avatar-wrap">
            <div class="aghi-aw-friends-avatar" data-el="avatar"></div>
          </div>
          <div class="aghi-aw-friends-body">
            <div class="aghi-aw-friends-name">${escapeHtml(f.username)}</div>
            <div class="aghi-aw-friends-status ${f.status ? '' : presenceClass}">${escapeHtml(statusText)}</div>
          </div>
          <button type="button" class="aghi-aw-friends-remove" data-action="remove" aria-label="Remove friend" title="Remove friend">${TRASH_ICON}</button>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.aghi-aw-friends-item').forEach((item) => {
      const userId = parseInt(item.getAttribute('data-userid'), 10);
      const friend = friends.find((f) => f.id === userId);
      if (!friend) return;
      const avatarEl = item.querySelector('[data-el="avatar"]');
      applyAvatar(avatarEl, friend.pfpId, friend.username);
      renderPresenceDot(avatarEl, friend);

      item.querySelector('[data-action="remove"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirmModal(
          'Remove friend?',
          `You and ${friend.username} will no longer be friends.`,
          'Remove'
        );
        if (confirmed) this.removeFriend(friend);
      });

      item.addEventListener('click', () => {
        this.friendsOpen = false;
        this.dmOpen = true;
        this.dmView = 'thread';
        this.dmActiveUser = { id: userId, username: friend.username, pfpId: friend.pfpId };
        this.dmMessages = [];
        this.dmMessagesLoadedOnce = false;
        this.render();
        this.openDmThread(this.dmActiveUser, true);
      });
    });
  };

  AccountWidget.prototype.removeFriend = async function (friend) {
    try {
      const res = await fetch('/api/friend-remove.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: friend.id, csrf_token: this.state.csrfToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      this.friends = this.friends.filter((f) => f.id !== friend.id);
      this.rerenderFriendsPanel();
    } catch (e) {
      // Left minimal on purpose — the row stays so the person can retry.
    }
  };

  AccountWidget.prototype.rerenderFriendsPanel = function () {
    if (!this.friendsOpen) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const existing = document.querySelector('.aghi-aw-friends-panel');
    if (existing) existing.remove();
    const targetParent = isMobile ? document.body : this.mount;
    targetParent.appendChild(this.buildFriendsPanel());
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
      const bodyData = {
        action: 'send',
        recipientId: this.dmActiveUser.id,
        body: text,
        csrf_token: this.state.csrfToken,
      };
      if (this.dmReplyToId) {
        bodyData.replyToId = this.dmReplyToId;
      }

      const res = await fetch('/api/dms.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send.');
      if (!this.dmMessages.some((m) => m.id === data.message.id)) {
        this.dmMessages.push(data.message);
      }
      this.dmLastMessageId = Math.max(this.dmLastMessageId, data.message.id);
      input.value = '';
      input.style.height = '';
      this.dmReplyToId = null;
      this.updateReplyPreview(panel);
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

  AccountWidget.prototype.updateReplyPreview = function (panel) {
    const previewEl = panel.querySelector('[data-el="reply-preview"]');
    if (!previewEl) return;
    
    if (!this.dmReplyToId) {
      previewEl.hidden = true;
      return;
    }

    const repliedMsg = this.dmMessages.find((m) => m.id === this.dmReplyToId);
    if (!repliedMsg) {
      this.dmReplyToId = null;
      previewEl.hidden = true;
      return;
    }

    const avatarEl = panel.querySelector('[data-el="reply-avatar"]');
    const nameEl = panel.querySelector('[data-el="reply-name"]');
    const textEl = panel.querySelector('[data-el="reply-text"]');
    
    if (!avatarEl || !nameEl || !textEl) return;

    const isSelf = String(repliedMsg.senderId) === String(this.state.user.id);
    const repliedUser = isSelf ? this.state.user : this.dmActiveUser;
    applyAvatar(avatarEl, repliedUser.pfpId, repliedUser.username);
    nameEl.textContent = isSelf ? 'Replying to yourself' : `Replying to ${repliedUser.username}`;
    textEl.textContent = repliedMsg.body;
    previewEl.hidden = false;
  };

  AccountWidget.prototype.renderPfpSection = function (el) {
    const user = this.state.user;
    const swatches = PFP_PRESETS.map((p) => `
      <button type="button" class="aghi-aw-pfp-option ${p.id === user.pfpId ? 'aghi-aw-selected' : ''}"
        style="background-color:${p.color}" data-pfp="${p.id}" aria-label="Use ${p.id} color"></button>
    `).join('');

    el.innerHTML = `
      <div class="aghi-aw-about-label">Avatar</div>
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
      e.target.value = '';
      if (file) {
        openImageAdjustModal({
          file,
          kind: 'avatar',
          onApply: (cropped) => this.uploadImage(cropped, 'avatar', el),
        });
      }
    });
  };

  // kind: 'avatar' | 'banner' — mirrors upload-avatar.php's kind field.
  // The response profile patch flows into state.user either way (pfpId or
  // bannerId), and the popup rebuilds so previews update live.
  AccountWidget.prototype.uploadImage = async function (file, kind, sectionEl) {
    const errorEl = sectionEl.querySelector('.aghi-aw-error');
    if (errorEl) errorEl.hidden = true;

    if (file.size > MAX_AVATAR_BYTES) {
      if (errorEl) { errorEl.textContent = 'Image is too large (max 2MB).'; errorEl.hidden = false; }
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('kind', kind);
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
      this.state.user = { ...this.state.user, ...data.profile };
      this.rerenderPopup();
      const avatarBtn = this.mount.querySelector('.aghi-aw-avatar-btn');
      if (avatarBtn && data.profile.pfpId) applyAvatar(avatarBtn, this.state.user.pfpId, this.state.user.username);
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = e.message || 'Upload failed. Try again.';
        errorEl.hidden = false;
      }
    }
  };

  AccountWidget.prototype.renderBannerSection = function (el) {
    const user = this.state.user;
    // Banners are a verified-members perk — unverified accounts get a locked
    // section pointing at verification instead of the uploader.
    if (!user.is_verified) {
      el.innerHTML = `
        <div class="aghi-aw-about-label">Banner</div>
        <div class="aghi-aw-upload-hint" style="text-align:left;margin:0 0 8px">Profile banners unlock after PCU verification — it keeps club spaces identifiably ours.</div>
        <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="goto-verify">Verify to unlock</button>`;
      el.querySelector('[data-action="goto-verify"]').addEventListener('click', () => {
        const v = document.querySelector('[data-section="verification"]');
        if (v) {
          v.scrollIntoView({ behavior: 'smooth', block: 'center' });
          v.style.transition = 'box-shadow .3s ease';
          v.style.boxShadow = '0 0 0 2px rgba(85,241,248,.6)';
          setTimeout(() => { v.style.boxShadow = ''; }, 1400);
        }
      });
      return;
    }
    el.innerHTML = `
      <div class="aghi-aw-about-label">Banner</div>
      <div class="aghi-aw-banner-preview" data-el="banner-preview">${user.bannerId ? '' : 'No banner yet'}</div>
      <label class="aghi-aw-upload-label">
        Upload banner
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-action="banner-input">
      </label>
      ${user.bannerId ? '<button type="button" class="aghi-aw-reset-link" data-action="remove-banner">Remove banner</button>' : ''}
      <div class="aghi-aw-upload-hint">JPEG, PNG, or WebP — max 2MB, center-cropped to 4:1</div>
      <div class="aghi-aw-error" hidden></div>
    `;
    const preview = el.querySelector('[data-el="banner-preview"]');
    if (user.bannerId) {
      preview.style.backgroundImage =
        `url('/uploads/banner/${encodeURIComponent(user.bannerId)}'), linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85))`;
    }
    el.querySelector('[data-action="banner-input"]').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) {
        openImageAdjustModal({
          file,
          kind: 'banner',
          onApply: (cropped) => this.uploadImage(cropped, 'banner', el),
        });
      }
    });
    const removeBtn = el.querySelector('[data-action="remove-banner"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.saveProfile({ bannerId: null }, el);
      });
    }
  };

  AccountWidget.prototype.rerenderPopup = function () {
    if (!this.popupOpen) return;
    const existing = document.querySelector('.aghi-aw-popup');
    const fresh = this.buildPopup();
    // On mobile the popup is a bottom sheet on <body> — rebuilding into the
    // topbar mount would spawn an invisible orphan behind the sheet while the
    // sheet keeps showing stale content (settings/remove-banner "not working").
    const targetParent = window.matchMedia('(max-width: 768px)').matches ? document.body : this.mount;
    if (existing && existing.parentElement === targetParent) {
      existing.replaceWith(fresh);
    } else {
      if (existing) existing.remove();
      targetParent.appendChild(fresh);
    }
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
      // user-profile-popup.js has been calling this since before it was
      // actually exported — exporting it removes their silent fallback path.
      getCsrfToken() {
        return widget.state ? widget.state.csrfToken : null;
      },
      // themed confirm dialog shared with user-profile-popup.js (unfriend).
      // resolves true/false and closes on backdrop click, Escape, or Enter.
      showConfirmModal(title, message, confirmLabel) {
        return showConfirmModal(title, message, confirmLabel);
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
