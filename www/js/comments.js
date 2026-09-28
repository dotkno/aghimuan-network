/**
 * comments.js
 *
 * Mounts a comment list + composer under each announcement post.
 */

(function () {
  'use strict';

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
  const MAX_COMMENT_LENGTH = 500;
  const POLL_INTERVAL_MS = 4000;
  const DRIP_DELAY_MS = 1000;
  const INITIAL_VISIBLE_COMMENTS = 2;

  function isCustomAvatar(pfpId) {
    return !!pfpId && !PRESET_IDS.includes(pfpId);
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
  function monogram(username) {
    return (username || '?').charAt(0).toUpperCase();
  }
  const EMOJI_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M8 13.5c1 1.3 2.2 2 4 2s3-.7 4-2"/>' +
    '<path d="M9 10h.01M15 10h.01"/>' +
    '</svg>';

  function insertEmojiAtCursor(textarea, emoji) {
    const start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length;
    const end = textarea.selectionEnd != null ? textarea.selectionEnd : textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const next = before + emoji + after;
    textarea.value = next.slice(0, MAX_COMMENT_LENGTH);
    const caret = Math.min(start + emoji.length, textarea.value.length);
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function wireEmojiButton(btn, textarea) {
    btn.addEventListener('click', () => {
      if (window.AghiEmojiPicker) {
        window.AghiEmojiPicker.open(btn, (emoji) => insertEmojiAtCursor(textarea, emoji));
      }
    });
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso + 'Z').toLocaleDateString();
  }

  function buildAvatarEl(pfpId, username) {
    const el = document.createElement('div');
    el.className = 'aghi-cm-avatar';
    el.dataset.aghiUsername = username;
    function showMonogram() {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = presetColor(pfpId);
      el.innerHTML = `<span>${escapeHtml(monogram(username))}</span>`;
    }
    if (isCustomAvatar(pfpId)) {
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url('${img.src}')`; el.style.backgroundColor = '#0a1520'; };
      img.onerror = showMonogram;
      img.src = `/uploads/pfp/${encodeURIComponent(pfpId)}`;
    } else {
      showMonogram();
    }
    return el;
  }

  function injectStyles() {
    if (document.getElementById('aghi-cm-styles')) return;
    const style = document.createElement('style');
    style.id = 'aghi-cm-styles';
    style.textContent = `
      .fb-comments {
        margin-top: 18px;
        padding: 18px 20px;
        background: linear-gradient(180deg, rgba(16, 28, 40, 0.4) 0%, rgba(10, 21, 32, 0.65) 100%);
        border: 1px solid rgba(48, 150, 199, 0.22);
        border-radius: 14px;
        box-shadow: inset 0 1px 0 rgba(85, 241, 248, 0.08), 0 8px 24px rgba(0, 0, 0, 0.25);
        font-family: 'Rajdhani', sans-serif;
      }
      .aghi-cm-header {
        font-size: 12px; font-weight: 700; color: #55F1F8; text-transform: uppercase;
        letter-spacing: 0.08em; margin-bottom: 14px; display: flex; align-items: center; gap: 10px;
      }
      .aghi-cm-header::after {
        content: ''; flex: 1; height: 1px;
        background: linear-gradient(90deg, rgba(85, 241, 248, 0.25), transparent);
      }
      .aghi-cm-list { display: flex; flex-direction: column; gap: 14px; }
      .aghi-cm-group { display: flex; flex-direction: column; gap: 10px; }
      .aghi-cm-item { display: flex; gap: 12px; align-items: flex-start; }
      .aghi-cm-item.aghi-cm-item-new { animation: aghiCmFadeIn 0.35s ease; }
      @keyframes aghiCmFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .aghi-cm-avatar {
        width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
        background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center;
        border: 1px solid rgba(85, 241, 248, 0.4);
        box-shadow: 0 0 10px rgba(48, 150, 199, 0.25);
        transition: transform 0.2s ease, border-color 0.2s ease;
        cursor: pointer;
      }
      .aghi-cm-name, .aghi-cm-mention { cursor: pointer; transition: color 0.15s ease; }
      .aghi-cm-name:hover, .aghi-cm-mention:hover { color: #55F1F8; }
      .aghi-cm-avatar:hover { transform: scale(1.05); border-color: #55F1F8; }
      .aghi-cm-avatar span {
        font-family: 'Orbitron', sans-serif; font-size: 13px; color: #F1F2F5;
      }
      .aghi-cm-bubble {
        background: rgba(16, 28, 40, 0.85);
        border: 1px solid rgba(48, 150, 199, 0.28);
        border-left: 3px solid rgba(85, 241, 248, 0.35);
        border-radius: 12px; padding: 12px 16px; flex: 1; min-width: 0;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      }
      .aghi-cm-bubble:hover {
        border-color: rgba(85, 241, 248, 0.45);
        border-left-color: #55F1F8;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 12px rgba(85, 241, 248, 0.08);
        transform: translateY(-1px);
      }
      .aghi-cm-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
      .aghi-cm-name { font-weight: 700; font-size: 14px; color: #e6f1f5; letter-spacing: 0.02em; }
      .aghi-cm-time { font-size: 11px; color: #5c798c; }
      .aghi-cm-edited { font-size: 11px; color: #5c798c; font-style: italic; }
      .aghi-cm-body {
        font-size: 14px; color: #cbd6dc; line-height: 1.5;
        white-space: pre-wrap; word-break: break-word; margin: 6px 0 8px 0;
        display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
      }
      .aghi-cm-body.aghi-cm-expanded { -webkit-line-clamp: unset; overflow: visible; }
      .aghi-cm-mention { color: #55F1F8; font-weight: 700; margin-right: 4px; }
      .aghi-cm-see-more {
        background: none; border: none; padding: 0; margin-top: 4px; cursor: pointer;
        font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #55F1F8;
        transition: opacity 0.15s;
      }
      .aghi-cm-see-more:hover { text-decoration: underline; opacity: 0.85; }
      .aghi-cm-actions {
        display: flex; align-items: center; gap: 8px; margin-top: 8px;
        padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.05);
        flex-wrap: wrap; row-gap: 4px;
      }
      .aghi-cm-action-btn {
        background: none; border: none; cursor: pointer;
        font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 700; color: #7a8d99;
        text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.15s, background 0.15s;
        padding: 3px 8px; border-radius: 5px; margin: -3px -8px;
      }
      .aghi-cm-action-btn:hover { color: #55F1F8; background: rgba(85, 241, 248, 0.08); }
      .aghi-cm-action-dot { width: 3px; height: 3px; border-radius: 50%; background: #2e4150; }
      .aghi-cm-action-btn.aghi-cm-danger { color: #b95d68; }
      .aghi-cm-action-btn.aghi-cm-danger:hover { color: #ff8b96; background: rgba(224, 82, 96, 0.1); }
      .aghi-cm-empty { font-size: 13.5px; color: #5c798c; font-style: italic; padding: 8px 0; }
      .aghi-cm-error { font-size: 12px; color: #e05260; margin-top: 6px; }

      .aghi-cm-reply-list {
        margin-top: 8px; margin-left: 28px; padding-left: 14px;
        border-left: 2px solid rgba(85, 241, 248, 0.25);
        display: flex; flex-direction: column; gap: 10px;
      }
      .aghi-cm-see-more-replies {
        background: none; border: none; padding: 2px 0; margin-top: 2px; cursor: pointer;
        font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; color: #55F1F8;
        text-align: left; transition: opacity 0.15s; display: inline-block; width: fit-content;
      }
      .aghi-cm-see-more-replies:hover { text-decoration: underline; opacity: 0.85; }
      .aghi-cm-reply-box { margin-top: 10px; }

      .aghi-cm-load-more-wrap { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
      .aghi-cm-load-more-btn {
        background: rgba(16, 28, 40, 0.9);
        border: 1px solid rgba(85, 241, 248, 0.35);
        color: #55F1F8; padding: 8px 18px; border-radius: 20px;
        font-family: 'Rajdhani', sans-serif; font-size: 12.5px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
        display: inline-flex; align-items: center; gap: 8px;
        transition: all 0.2s ease; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      }
      .aghi-cm-load-more-btn:hover {
        background: rgba(85, 241, 248, 0.15);
        border-color: #55F1F8; box-shadow: 0 0 14px rgba(85, 241, 248, 0.25);
        transform: translateY(-1px);
      }
      .aghi-cm-count-tag {
        background: rgba(85, 241, 248, 0.2); color: #ffffff;
        padding: 1px 7px; border-radius: 10px; font-size: 11px;
      }

      .aghi-cm-composer { display: flex; gap: 12px; margin-top: 16px; align-items: flex-end; }
      .aghi-cm-composer textarea {
        flex: 1; resize: none; min-height: 42px; max-height: 140px;
        background: #0c1620; border: 1px solid rgba(48, 150, 199, 0.3); border-radius: 12px;
        padding: 11px 15px; color: #F1F2F5; font-family: 'Rajdhani', sans-serif; font-size: 14px;
        outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      }
      .aghi-cm-composer textarea:focus {
        border-color: #55F1F8; background: #101c28;
        box-shadow: 0 0 12px rgba(85,241,248,0.18);
      }
      .aghi-cm-composer-btn {
        background: rgba(85, 241, 248, 0.1); border: 1px solid rgba(85, 241, 248, 0.45);
        color: #55F1F8; border-radius: 10px; padding: 11px 20px; font-size: 13px; font-weight: 700;
        font-family: 'Rajdhani', sans-serif; cursor: pointer; white-space: nowrap;
        transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
      }
      .aghi-cm-composer-btn:hover {
        background: rgba(85, 241, 248, 0.2); box-shadow: 0 0 12px rgba(85,241,248,0.25);
        transform: translateY(-1px);
      }
      .aghi-cm-composer-btn:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
      .aghi-cm-emoji-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; flex-shrink: 0;
        background: rgba(12, 22, 32, 0.6); border: 1px solid rgba(48, 150, 199, 0.3);
        border-radius: 10px; color: #7a8d99; cursor: pointer;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .aghi-cm-emoji-btn:hover, .aghi-cm-emoji-btn:focus-visible {
        color: #55F1F8; border-color: rgba(85, 241, 248, 0.6);
        background: rgba(18, 36, 54, 0.85); transform: translateY(-1px) scale(1.05);
        box-shadow: 0 0 10px rgba(85, 241, 248, 0.25);
      }
      .aghi-cm-guest-prompt { font-size: 13.5px; color: #5c798c; margin-top: 10px; }
      .aghi-cm-guest-prompt a { color: #55F1F8; text-decoration: none; font-weight: 700; }
      .aghi-cm-guest-prompt a:hover { text-decoration: underline; }

      .aghi-cm-edit-row { margin-top: 6px; }
      .aghi-cm-edit-row textarea {
        width: 100%; box-sizing: border-box; resize: none; min-height: 38px;
        background: #081018; border: 1px solid rgba(85, 241, 248, 0.45); border-radius: 10px;
        padding: 8px 12px; color: #F1F2F5; font-family: 'Rajdhani', sans-serif; font-size: 13.5px;
        outline: none; box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
      }

      .aghi-cm-modal-backdrop {
        position: fixed; inset: 0; background: rgba(4, 8, 12, 0.7);
        backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 2000;
        animation: aghiCmFadeIn 0.15s ease;
      }
      .aghi-cm-modal {
        background: #0c1620; border: 1px solid rgba(224, 82, 96, 0.35);
        border-radius: 14px; padding: 22px 24px; width: 310px; max-width: calc(100vw - 40px);
        box-shadow: 0 10px 40px rgba(0,0,0,0.65), 0 0 24px rgba(224,82,96,0.12);
        font-family: 'Rajdhani', sans-serif; color: #F1F2F5;
      }
      .aghi-cm-modal-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #ff8b96; }
      .aghi-cm-modal-msg { font-size: 14px; color: #98a7b0; margin: 0 0 20px; line-height: 1.45; }
      .aghi-cm-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .aghi-cm-modal-btn {
        border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700;
        font-family: 'Rajdhani', sans-serif; cursor: pointer; border: 1px solid transparent;
        transition: all 0.15s;
      }
      .aghi-cm-modal-btn.aghi-cm-modal-cancel {
        background: transparent; border-color: rgba(255,255,255,0.15); color: #98a7b0;
      }
      .aghi-cm-modal-btn.aghi-cm-modal-cancel:hover { border-color: rgba(255,255,255,0.3); color: #F1F2F5; }
      .aghi-cm-modal-btn.aghi-cm-modal-confirm {
        background: rgba(224, 82, 96, 0.15); border-color: rgba(224, 82, 96, 0.5); color: #ff8b96;
      }
      .aghi-cm-modal-btn.aghi-cm-modal-confirm:hover { background: rgba(224, 82, 96, 0.28); }

      @media (max-width: 560px) {
        .fb-comments { padding: 14px 12px; border-radius: 12px; }
        .aghi-cm-item { gap: 10px; }
        .aghi-cm-avatar { width: 36px; height: 36px; }
        .aghi-cm-avatar span { font-size: 12px; }
        .aghi-cm-bubble { padding: 12px; border-radius: 10px; }
        .aghi-cm-name { font-size: 14px; }
        .aghi-cm-body { font-size: 15px; }
        .aghi-cm-reply-list { margin-left: 10px; padding-left: 10px; gap: 10px; }
        .aghi-cm-actions { gap: 10px; padding-top: 8px; }
        .aghi-cm-action-btn { font-size: 12px; padding: 6px 8px; margin: 0; }
        .aghi-cm-composer { flex-wrap: wrap; gap: 10px; align-items: center; }
        .aghi-cm-composer textarea { width: 100%; flex: 1 1 100%; font-size: 16px; padding: 12px; min-height: 52px; }
        .aghi-cm-composer-btn { flex: 1; padding: 11px 16px; font-size: 14px; height: 42px; }
        .aghi-cm-emoji-btn { width: 42px; height: 42px; }
        .aghi-cm-header { font-size: 12px; margin-bottom: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-cm-modal-backdrop';
      backdrop.innerHTML = `
        <div class="aghi-cm-modal">
          <p class="aghi-cm-modal-title">${escapeHtml(title)}</p>
          <p class="aghi-cm-modal-msg">${escapeHtml(message)}</p>
          <div class="aghi-cm-modal-actions">
            <button type="button" class="aghi-cm-modal-btn aghi-cm-modal-cancel" data-action="cancel">Cancel</button>
            <button type="button" class="aghi-cm-modal-btn aghi-cm-modal-confirm" data-action="confirm">Delete</button>
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

  let sessionPromise = null;
  function getSession() {
    if (!sessionPromise) {
      sessionPromise = fetch('/api/session.php', { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((data) => ({ loggedIn: !!data.loggedIn, user: data.user, csrfToken: data.csrfToken || null }))
        .catch(() => ({ loggedIn: false, user: null, csrfToken: null }));
    }
    return sessionPromise;
  }

  function CommentSection(root, postId) {
    this.root = root;
    this.postId = postId;
    this.comments = [];
    this.visibleCount = INITIAL_VISIBLE_COMMENTS;
    this.session = null;
    this.editingId = null;
    this.replyingToTarget = null;
    this.dripQueue = [];
    this.dripping = false;
    this.newlyAddedIds = new Set();
    this.expandedIds = new Set();
    this.expandedReplyParentIds = new Set();
    this.pollTimer = null;
    this.deletedIds = new Set();
  }

  CommentSection.prototype.notifyCountChanged = function () {
    document.dispatchEvent(new CustomEvent('agr:comment-count-changed', {
      detail: { postId: this.postId, count: this.comments.length },
    }));
  };

  CommentSection.prototype.mount = async function () {
    this.root.innerHTML = '<div class="aghi-cm-empty">Loading comments&hellip;</div>';
    const [session, comments] = await Promise.all([getSession(), this.fetchComments()]);
    this.session = session;
    this.comments = comments;
    this.render();
    this.notifyCountChanged();
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  };

  CommentSection.prototype.fetchComments = async function () {
    try {
      const res = await fetch(`/api/comments.php?post_id=${encodeURIComponent(this.postId)}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      const raw = Array.isArray(data.comments) ? data.comments : [];
      return raw.filter((c) => !this.deletedIds.has(c.id));
    } catch (e) {
      return [];
    }
  };

  CommentSection.prototype.poll = async function () {
    const fresh = await this.fetchComments();
    const knownIds = new Set(this.comments.map((c) => c.id));
    const freshIds = new Set(fresh.map((c) => c.id));

    const beforeCount = this.comments.length;
    this.comments = this.comments.filter((c) => freshIds.has(c.id));
    let changed = this.comments.length !== beforeCount;
    if (this.comments.length !== beforeCount) this.notifyCountChanged();

    fresh.forEach((fc) => {
      if (knownIds.has(fc.id) && this.editingId !== fc.id) {
        const idx = this.comments.findIndex((c) => c.id === fc.id);
        if (idx !== -1 && JSON.stringify(this.comments[idx]) !== JSON.stringify(fc)) {
          this.comments[idx] = fc;
          changed = true;
        }
      }
    });

    const newOnes = fresh.filter((fc) => !knownIds.has(fc.id));
    if (newOnes.length > 0) {
      this.dripQueue.push(...newOnes);
      this.processDripQueue();
    } else if (changed) {
      this.renderList();
    }
  };

  CommentSection.prototype.processDripQueue = function () {
    if (this.dripping) return;
    this.dripping = true;
    const step = () => {
      if (this.dripQueue.length === 0) { this.dripping = false; return; }
      const next = this.dripQueue.shift();
      if (!this.comments.find((c) => c.id === next.id)) {
        this.comments.push(next);
        this.newlyAddedIds.add(next.id);
        if (this.visibleCount >= this.comments.length - 1) {
          this.visibleCount++;
        }
        this.renderList();
        this.notifyCountChanged();
      }
      setTimeout(step, DRIP_DELAY_MS);
    };
    step();
  };

  CommentSection.prototype.render = function () {
    this.root.innerHTML = `
      <div class="aghi-cm-header" data-el="header"></div>
      <div class="aghi-cm-list" data-el="list"></div>
      <div data-el="composer"></div>
    `;
    this.renderList();
    this.renderComposer();
  };

  CommentSection.prototype.updateHeader = function () {
    const headerEl = this.root.querySelector('[data-el="header"]');
    if (!headerEl) return;
    const n = this.comments.length;
    headerEl.textContent = n > 0 ? `${n} Comment${n === 1 ? '' : 's'}` : '';
  };

  CommentSection.prototype.renderList = function () {
    const listEl = this.root.querySelector('[data-el="list"]');
    if (!listEl) return;
    this.updateHeader();
    if (this.comments.length === 0) {
      listEl.innerHTML = '<div class="aghi-cm-empty">No comments yet. Be the first to say something.</div>';
      return;
    }
    listEl.innerHTML = '';

    const topComments = [];
    const repliesByParent = new Map();

    this.comments.forEach((c) => {
      const pId = c.parentId || c.parent_id;
      if (!pId) {
        topComments.push(c);
      } else {
        const pIdStr = String(pId);
        if (!repliesByParent.has(pIdStr)) repliesByParent.set(pIdStr, []);
        repliesByParent.get(pIdStr).push(c);
      }
    });

    const visibleTop = topComments.slice(0, this.visibleCount);
    visibleTop.forEach((c) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'aghi-cm-group';
      groupEl.appendChild(this.buildCommentEl(c));

      const childReplies = repliesByParent.get(String(c.id)) || [];
      if (childReplies.length > 0) {
        const replyList = document.createElement('div');
        replyList.className = 'aghi-cm-reply-list';

        const parentIdStr = String(c.id);
        const isExpanded = this.expandedReplyParentIds.has(parentIdStr);
        const visibleReplies = isExpanded ? childReplies : childReplies.slice(0, 1);

        visibleReplies.forEach((rc) => replyList.appendChild(this.buildCommentEl(rc)));

        if (childReplies.length > 1) {
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'aghi-cm-see-more-replies';

          if (isExpanded) {
            toggleBtn.textContent = 'See less replies';
            toggleBtn.addEventListener('click', () => {
              this.expandedReplyParentIds.delete(parentIdStr);
              this.renderList();
            });
          } else {
            const remaining = childReplies.length - 1;
            toggleBtn.textContent = `See ${remaining} more reply${remaining === 1 ? '' : 's'}`;
            toggleBtn.addEventListener('click', () => {
              this.expandedReplyParentIds.add(parentIdStr);
              this.renderList();
            });
          }
          replyList.appendChild(toggleBtn);
        }

        groupEl.appendChild(replyList);
      }

      listEl.appendChild(groupEl);
    });

    if (topComments.length > INITIAL_VISIBLE_COMMENTS) {
      const loadMoreWrap = document.createElement('div');
      loadMoreWrap.className = 'aghi-cm-load-more-wrap';

      let buttonsHtml = '';
      if (topComments.length > this.visibleCount) {
        const remaining = topComments.length - this.visibleCount;
        buttonsHtml += `
          <button type="button" class="aghi-cm-load-more-btn" data-action="more">
            <span>See more comments</span>
            <span class="aghi-cm-count-tag">+${remaining}</span>
          </button>
        `;
      }
      if (this.visibleCount > INITIAL_VISIBLE_COMMENTS) {
        buttonsHtml += `
          <button type="button" class="aghi-cm-load-more-btn" data-action="less">
            <span>See less comments</span>
          </button>
        `;
      }

      loadMoreWrap.innerHTML = buttonsHtml;

      const moreBtn = loadMoreWrap.querySelector('[data-action="more"]');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          this.visibleCount += 5;
          this.renderList();
        });
      }

      const lessBtn = loadMoreWrap.querySelector('[data-action="less"]');
      if (lessBtn) {
        lessBtn.addEventListener('click', () => {
          this.visibleCount = INITIAL_VISIBLE_COMMENTS;
          this.renderList();
        });
      }

      listEl.appendChild(loadMoreWrap);
    }

    this.newlyAddedIds.clear();
    requestAnimationFrame(() => this.setupBodyTruncation());
  };

  CommentSection.prototype.setupBodyTruncation = function () {
    const listEl = this.root.querySelector('[data-el="list"]');
    if (!listEl) return;
    listEl.querySelectorAll('.aghi-cm-body').forEach((el) => {
      const existingBtn = el.nextElementSibling;
      if (existingBtn && existingBtn.classList.contains('aghi-cm-see-more')) existingBtn.remove();

      const commentId = el.getAttribute('data-comment-id');
      const wasExpanded = this.expandedIds.has(commentId);

      el.classList.remove('aghi-cm-expanded');
      const overflows = el.scrollHeight > el.clientHeight + 4;
      if (wasExpanded) el.classList.add('aghi-cm-expanded');

      if (!overflows) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aghi-cm-see-more';
      btn.textContent = wasExpanded ? 'See less' : 'See more';
      btn.addEventListener('click', () => {
        const nowExpanded = el.classList.toggle('aghi-cm-expanded');
        if (nowExpanded) this.expandedIds.add(commentId); else this.expandedIds.delete(commentId);
        btn.textContent = nowExpanded ? 'See less' : 'See more';
      });
      el.insertAdjacentElement('afterend', btn);
    });
  };

  CommentSection.prototype.buildCommentEl = function (c) {
    const item = document.createElement('div');
    item.className = 'aghi-cm-item' + (this.newlyAddedIds.has(c.id) ? ' aghi-cm-item-new' : '');
    item.appendChild(buildAvatarEl(c.user.pfpId, c.user.username));

    const bubble = document.createElement('div');
    bubble.className = 'aghi-cm-bubble';

    if (this.editingId === c.id) {
      bubble.innerHTML = `
        <div class="aghi-cm-head">
          <span class="aghi-cm-name" data-aghi-username="${escapeHtml(c.user.username)}">${escapeHtml(c.user.username)}</span>
        </div>
        <div class="aghi-cm-edit-row">
          <textarea maxlength="${MAX_COMMENT_LENGTH}" data-el="edit-textarea">${escapeHtml(c.body)}</textarea>
        </div>
        <div class="aghi-cm-actions">
          <button type="button" class="aghi-cm-action-btn" data-action="save-edit">Save</button>
          <span class="aghi-cm-action-dot"></span>
          <button type="button" class="aghi-cm-action-btn" data-action="cancel-edit">Cancel</button>
        </div>
        <div class="aghi-cm-error" data-el="error" hidden></div>
      `;
      bubble.querySelector('[data-action="save-edit"]').addEventListener('click', () => {
        const val = bubble.querySelector('[data-el="edit-textarea"]').value.trim();
        this.submitEdit(c.id, val, bubble);
      });
      bubble.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => {
        this.editingId = null;
        this.renderList();
      });
    } else {
      let actionsHtml = '';
      if (this.session && this.session.loggedIn) {
        actionsHtml += `<button type="button" class="aghi-cm-action-btn" data-action="reply">Reply</button>`;
      }
      if (c.isOwn) {
        if (actionsHtml) actionsHtml += `<span class="aghi-cm-action-dot"></span>`;
        actionsHtml += `
          <button type="button" class="aghi-cm-action-btn" data-action="edit">Edit</button>
          <span class="aghi-cm-action-dot"></span>
          <button type="button" class="aghi-cm-action-btn aghi-cm-danger" data-action="delete">Delete</button>
        `;
      }

      const replyUser = c.replyToUser || c.reply_to_user;
      const mentionHtml = replyUser ? `<strong class="aghi-cm-mention" data-aghi-username="${escapeHtml(replyUser)}">@${escapeHtml(replyUser)}</strong> ` : '';

      bubble.innerHTML = `
        <div class="aghi-cm-head">
          <span class="aghi-cm-name" data-aghi-username="${escapeHtml(c.user.username)}">${escapeHtml(c.user.username)}</span>
          <span class="aghi-cm-time" data-iso="${escapeHtml(c.createdAt)}">${timeAgo(c.createdAt)}</span>
          ${c.editedAt ? '<span class="aghi-cm-edited">(edited)</span>' : ''}
        </div>
        <div class="aghi-cm-body${this.expandedIds.has(String(c.id)) ? ' aghi-cm-expanded' : ''}" data-comment-id="${c.id}">${mentionHtml}${escapeHtml(c.body)}</div>
        ${actionsHtml ? `<div class="aghi-cm-actions">${actionsHtml}</div>` : ''}
        <div class="cmr-bar" data-el="reaction-bar"></div>
        <div class="aghi-cm-error" data-el="error" hidden></div>
      `;

      const reactionBarEl = bubble.querySelector('[data-el="reaction-bar"]');
      if (reactionBarEl && typeof window.initCommentReactions === 'function') {
        window.initCommentReactions(c.id, reactionBarEl);
      }

      const replyBtn = bubble.querySelector('[data-action="reply"]');
      if (replyBtn) {
        replyBtn.addEventListener('click', () => {
          if (this.replyingToTarget && this.replyingToTarget.commentId === c.id) {
            this.replyingToTarget = null;
          } else {
            const rootParentId = c.parentId || c.parent_id || c.id;
            this.replyingToTarget = {
              commentId: c.id,
              parentId: rootParentId,
              targetUsername: c.user.username
            };
          }
          this.renderList();
        });
      }

      if (c.isOwn) {
        bubble.querySelector('[data-action="edit"]').addEventListener('click', () => {
          this.editingId = c.id;
          this.renderList();
        });
        bubble.querySelector('[data-action="delete"]').addEventListener('click', () => {
          this.submitDelete(c.id, bubble);
        });
      }

      if (this.replyingToTarget && this.replyingToTarget.commentId === c.id) {
        const replyBox = document.createElement('div');
        replyBox.className = 'aghi-cm-reply-box';
        replyBox.innerHTML = `
          <div class="aghi-cm-composer aghi-cm-reply-composer">
            <textarea placeholder="Reply to @${escapeHtml(c.user.username)}&hellip;" maxlength="${MAX_COMMENT_LENGTH}" data-el="composer-textarea" rows="1"></textarea>
            <button type="button" class="aghi-cm-emoji-btn" data-action="emoji" title="Add emoji" aria-label="Add emoji">${EMOJI_ICON_SVG}</button>
            <button type="button" class="aghi-cm-composer-btn" data-action="post-reply">Reply</button>
          </div>
          <div class="aghi-cm-error" data-el="composer-error" hidden></div>
        `;

        const textarea = replyBox.querySelector('[data-el="composer-textarea"]');
        const btn = replyBox.querySelector('[data-action="post-reply"]');
        const emojiBtn = replyBox.querySelector('[data-action="emoji"]');
        wireEmojiButton(emojiBtn, textarea);

        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
        });

        const targetData = this.replyingToTarget;
        btn.addEventListener('click', () => this.submitCreate(textarea.value.trim(), targetData.parentId, targetData.targetUsername, replyBox));
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.submitCreate(textarea.value.trim(), targetData.parentId, targetData.targetUsername, replyBox);
          }
        });

        bubble.appendChild(replyBox);
      }
    }

    item.appendChild(bubble);
    return item;
  };

  CommentSection.prototype.renderComposer = function () {
    const el = this.root.querySelector('[data-el="composer"]');
    if (!this.session.loggedIn) {
      el.innerHTML = `<div class="aghi-cm-guest-prompt"><a href="/login.php">Log in</a> to leave a comment.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="aghi-cm-composer">
        <textarea placeholder="Write a comment&hellip;" maxlength="${MAX_COMMENT_LENGTH}" data-el="composer-textarea" rows="1"></textarea>
        <button type="button" class="aghi-cm-emoji-btn" data-action="emoji" title="Add emoji" aria-label="Add emoji">${EMOJI_ICON_SVG}</button>
        <button type="button" class="aghi-cm-composer-btn" data-action="post">Post</button>
      </div>
      <div class="aghi-cm-error" data-el="composer-error" hidden></div>
    `;
    const textarea = el.querySelector('[data-el="composer-textarea"]');
    const btn = el.querySelector('[data-action="post"]');
    const emojiBtn = el.querySelector('[data-action="emoji"]');
    wireEmojiButton(emojiBtn, textarea);
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
    });
    btn.addEventListener('click', () => this.submitCreate(textarea.value.trim(), null, null, el));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitCreate(textarea.value.trim(), null, null, el);
      }
    });
  };

  CommentSection.prototype.postJson = async function (payload) {
    const res = await fetch('/api/comments.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ csrf_token: this.session.csrfToken }, payload)),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  };

  CommentSection.prototype.submitCreate = async function (text, parentId, targetUsername, composerEl) {
    const errorEl = composerEl.querySelector('[data-el="composer-error"]');
    if (errorEl) errorEl.hidden = true;
    if (!text) return;
    try {
      const payload = {
        action: 'create',
        postId: this.postId,
        post_id: this.postId,
        body: text
      };
      if (parentId) {
        payload.parentId = parentId;
        payload.parent_id = parentId;
      }
      if (targetUsername) {
        payload.replyToUser = targetUsername;
        payload.reply_to_user = targetUsername;
      }

      const data = await this.postJson(payload);
      this.comments.push(data.comment);
      this.replyingToTarget = null;
      if (parentId) {
        this.expandedReplyParentIds.add(String(parentId));
      }
      this.visibleCount = Math.max(this.visibleCount, this.comments.length);
      this.renderList();
      this.notifyCountChanged();
      const textarea = composerEl.querySelector('[data-el="composer-textarea"]');
      if (textarea) { textarea.value = ''; textarea.style.height = 'auto'; }
    } catch (e) {
      if (errorEl) { errorEl.textContent = e.message; errorEl.hidden = false; }
    }
  };

  CommentSection.prototype.submitEdit = async function (commentId, text, bubbleEl) {
    const errorEl = bubbleEl.querySelector('[data-el="error"]');
    if (errorEl) errorEl.hidden = true;
    if (!text) {
      if (errorEl) { errorEl.textContent = 'Comment cannot be empty.'; errorEl.hidden = false; }
      return;
    }
    try {
      const data = await this.postJson({ action: 'edit', commentId, body: text });
      const idx = this.comments.findIndex((c) => c.id === commentId);
      if (idx !== -1) this.comments[idx] = data.comment;
      this.editingId = null;
      this.renderList();
    } catch (e) {
      if (errorEl) { errorEl.textContent = e.message; errorEl.hidden = false; }
    }
  };

  CommentSection.prototype.collectDescendantIds = function (rootId) {
    const ids = new Set();
    let frontier = [String(rootId)];
    while (frontier.length > 0) {
      const next = [];
      this.comments.forEach((c) => {
        const pId = c.parentId || c.parent_id;
        if (pId != null && frontier.includes(String(pId)) && !ids.has(c.id)) {
          ids.add(c.id);
          next.push(String(c.id));
        }
      });
      frontier = next;
    }
    return ids;
  };

  CommentSection.prototype.submitDelete = async function (commentId, bubbleEl) {
    const ok = await showConfirmModal('Delete comment?', 'This can\u2019t be undone.');
    if (!ok) return;
    const errorEl = bubbleEl.querySelector('[data-el="error"]');
    try {
      const result = await this.postJson({ action: 'delete', commentId });
      const descendantIds = this.collectDescendantIds(commentId);
      const removedIds = Array.isArray(result && result.deletedIds) && result.deletedIds.length > 0
        ? new Set(result.deletedIds)
        : new Set([commentId, ...descendantIds]);
      removedIds.forEach((id) => this.deletedIds.add(id));
      this.comments = this.comments.filter((c) => !removedIds.has(c.id));
      this.renderList();
      this.notifyCountChanged();
    } catch (e) {
      if (errorEl) { errorEl.textContent = e.message; errorEl.hidden = false; }
    }
  };

  let timeTickerStarted = false;
  function startTimeTicker() {
    if (timeTickerStarted) return;
    timeTickerStarted = true;
    setInterval(() => {
      document.querySelectorAll('.aghi-cm-time[data-iso]').forEach((el) => {
        el.textContent = timeAgo(el.getAttribute('data-iso'));
      });
    }, 30000);
  }

  function init() {
    injectStyles();
    startTimeTicker();
    document.querySelectorAll('.fb-comments[data-post-id]').forEach((el) => {
      if (el.dataset.mounted === 'true') return;
      el.dataset.mounted = 'true';
      const postId = el.getAttribute('data-post-id');
      const section = new CommentSection(el, postId);
      section.mount();
    });
  }

  window.AghiComments = { init };
})();