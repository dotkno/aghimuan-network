/**
 * widget-utils.js — shared helpers for the split account widget.
 *
 * Contract: widget-core.js must load first (it creates window.AghiWidgetUtil
 * and window.AccountWidget). Helpers are registered on the Util object so
 * feature modules never declare page-level globals (index.html and
 * creation.html define their own top-level escapeHtml/presetColor/PFP_PRESETS
 * — a second page-level copy would be a fatal const redeclare or a silent
 * function override).
 */
if (!window.AghiWidgetUtil || typeof AccountWidget === 'undefined') {
  throw new Error('[widget-utils] widget-core.js must load before this file');
}

Object.assign(window.AghiWidgetUtil, {
  getMainRoleStyle(role) {
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
  },

  isCustomAvatar(pfpId) {
    return !AghiWidgetUtil.PRESET_IDS.includes(pfpId);
  },

  presetColor(pfpId) {
    const match = AghiWidgetUtil.PFP_PRESETS.find((p) => p.id === pfpId);
    return (match || AghiWidgetUtil.PFP_PRESETS[0]).color;
  },

  presenceInfo(id) {
    return AghiWidgetUtil.PRESENCE_OPTIONS.find((p) => p.id === id) || AghiWidgetUtil.PRESENCE_OPTIONS[0];
  },

  // Same invisible/stale-collapsing rule used in user-profile-popup.js:
  // invisible (or a stale/expired session) always reads as plain Offline to
  // anyone but the user themselves — never surfaced as online here.
  effectiveDmPresence(data) {
    if (!data || !data.online || data.presence === 'invisible') {
      return { label: 'Offline', color: AghiWidgetUtil.OFFLINE_COLOR };
    }
    return AghiWidgetUtil.presenceInfo(data.presence);
  },

  // Drops (or updates) a corner presence dot into any avatar wrapper with
  // position:relative — used for DM thread-list avatars and the open-thread
  // header avatar. `data` is a { presence, online } shaped object as returned
  // by dms.php's other_user_info().
  renderPresenceDot(wrapEl, data) {
    if (!wrapEl) return;
    let dot = wrapEl.querySelector('.aghi-aw-dm-presence-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'aghi-aw-dm-presence-dot';
      wrapEl.appendChild(dot);
    }
    const info = AghiWidgetUtil.effectiveDmPresence(data);
    dot.style.background = info.color;
    dot.title = info.label;
  },

  // Themed replacement for window.confirm(), same behavior as comments.js's
  // showConfirmModal: resolves true/false, closes on backdrop click, Escape,
  // or Enter.
  showConfirmModal(title, message, confirmLabel = 'Delete') {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-aw-modal-backdrop';
      backdrop.innerHTML = `
        <div class="aghi-aw-modal">
          <p class="aghi-aw-modal-title">${AghiWidgetUtil.escapeHtml(title)}</p>
          <p class="aghi-aw-modal-msg">${AghiWidgetUtil.escapeHtml(message)}</p>
          <div class="aghi-aw-modal-actions">
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-aw-modal-btn aghi-aw-modal-confirm" data-action="confirm">${AghiWidgetUtil.escapeHtml(confirmLabel)}</button>
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
  },

  // Discord-style crop editor for avatar/banner uploads: drag to reposition,
  // scroll wheel or slider to zoom, Apply exports exactly the framed region
  // as a PNG and hands it to onApply. The crop happens client-side — the
  // server still re-encodes through GD, it just receives an image that's
  // already the right aspect ratio so its center-crop is a no-op.
  openImageAdjustModal(opts) {
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
  },

  applyAvatar(el, pfpId, username) {
    el.innerHTML = '';
    el.style.backgroundImage = 'none';
    function showMonogram() {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = AghiWidgetUtil.presetColor(pfpId);
      const span = document.createElement('span');
      span.className = 'aghi-aw-monogram';
      span.textContent = (username || '?').charAt(0).toUpperCase();
      el.appendChild(span);
    }
    if (AghiWidgetUtil.isCustomAvatar(pfpId)) {
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
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  },

  daysUntil(isoDate) {
    if (!isoDate) return 0;
    const ms = new Date(isoDate).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 86400000) : 0;
  },

  timeAgo(dateStr) {
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
  },

  notifText(item) {
    const U = AghiWidgetUtil;
    const name = U.escapeHtml(item.actorUsername || 'Someone');
    if (item.kind === 'friend_accept') {
      return `<strong>${name}</strong> accepted your friend request.`;
    }
    let payload = item.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) { payload = null; }
    }
    if (item.kind === 'creation_approved') {
      const title = payload && payload.title ? `“${U.escapeHtml(payload.title)}”` : 'your project';
      return `<strong>Aghimuan Club</strong> approved <strong>${title}</strong> — now live in the Creations Hub.`;
    }
    if (item.kind === 'creation_rejected') {
      const title = payload && payload.title ? `“${U.escapeHtml(payload.title)}”` : 'your project';
      const reason = payload && payload.reason ? ` Reason: “${U.escapeHtml(payload.reason)}”` : '';
      return `<strong>Aghimuan Club</strong> did not approve <strong>${title}</strong>.${reason}`;
    }
    if (payload && typeof payload.text === 'string' && payload.text) {
      return U.escapeHtml(payload.text);
    }
    return `<strong>${name}</strong> sent you a notification.`;
  },

  notifIcon(kind) {
    const make = AghiWidgetUtil.NOTIF_KIND_ICONS[kind];
    return make ? make() : AghiWidgetUtil.BELL_ICON;
  },
});
