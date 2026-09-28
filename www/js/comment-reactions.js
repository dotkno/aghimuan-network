/**
 * comment-reactions.js
 *
 * Discord-style reactions for comments: a pill row under each comment body
 * (emoji + count, highlighted if you reacted) plus an "add reaction" trigger
 * that opens the shared emoji picker (see emoji-picker-core.js).
 *
 * Uses Twemoji graphics via CDN to replicate Discord's visual style across
 * all operating systems.
 *
 * Requires emoji-picker-core.js to be loaded first.
 */
(function () {
  'use strict';

  const REACTION_POLL_MS = 6000;

  function getTwemojiUrl(emoji) {
    return window.AghiEmojiPicker.getTwemojiUrl(emoji);
  }

  // ---- styles (reaction bar only - picker chrome lives in emoji-picker-core.js) ----

  function injectStyles() {
    if (document.getElementById('cmr-styles')) return;
    const style = document.createElement('style');
    style.id = 'cmr-styles';
    style.textContent = `
      @keyframes cmrPop {
        0% { transform: scale(0.82); opacity: 0; }
        70% { transform: scale(1.06); }
        100% { transform: scale(1); opacity: 1; }
      }

      .cmr-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 8px 0 2px;
      }
      .cmr-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(12, 22, 32, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(48, 150, 199, 0.3);
        cursor: pointer;
        font-family: 'Rajdhani', sans-serif;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        animation: cmrPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
      }
      .cmr-pill:hover {
        border-color: rgba(85, 241, 248, 0.65);
        background: rgba(18, 36, 52, 0.85);
        transform: translateY(-2px) scale(1.04);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 0 10px rgba(85, 241, 248, 0.25);
      }
      .cmr-pill:active {
        transform: translateY(0) scale(0.94);
      }
      .cmr-pill-active {
        background: linear-gradient(135deg, rgba(85, 241, 248, 0.22), rgba(16, 40, 60, 0.85));
        border-color: rgba(85, 241, 248, 0.85);
        box-shadow: 0 0 10px rgba(85, 241, 248, 0.25);
      }
      .cmr-pill-active:hover {
        box-shadow: 0 4px 14px rgba(85, 241, 248, 0.4);
      }
      .cmr-pill-emoji {
        width: 16px;
        height: 16px;
        object-fit: contain;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .cmr-pill:hover .cmr-pill-emoji {
        transform: scale(1.22);
      }
      .cmr-pill-count {
        font-size: 12px;
        font-weight: 700;
        color: #cbd6dc;
        letter-spacing: 0.02em;
      }
      .cmr-pill-active .cmr-pill-count {
        color: #55F1F8;
        text-shadow: 0 0 8px rgba(85, 241, 248, 0.6);
      }

      .cmr-add-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: rgba(12, 22, 32, 0.5);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(48, 150, 199, 0.25);
        color: #7a8d99;
        cursor: pointer;
        opacity: 0.65;
        transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .cmr-bar:hover .cmr-add-btn,
      .cmr-add-btn:hover,
      .cmr-add-btn:focus-visible {
        opacity: 1;
        color: #55F1F8;
        border-color: rgba(85, 241, 248, 0.6);
        background: rgba(18, 36, 54, 0.85);
        transform: rotate(15deg) scale(1.1);
        box-shadow: 0 0 12px rgba(85, 241, 248, 0.3);
      }
      .cmr-bar-empty .cmr-add-btn { opacity: 0.45; }

      .cmr-toast {
        font-size: 12px;
        color: #cbd6dc;
        background: rgba(18, 10, 16, 0.95);
        border: 1px solid rgba(224, 82, 96, 0.5);
        border-radius: 8px;
        padding: 6px 12px;
        margin-top: 4px;
        animation: cmrPop 0.2s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      .cmr-toast a { color: #55F1F8; font-weight: 700; text-decoration: underline; }

      @media (max-width: 560px) {
        .cmr-pill { padding: 4px 8px; gap: 5px; }
        .cmr-pill-emoji { width: 14px; height: 14px; }
        .cmr-pill-count { font-size: 11px; }
        .cmr-add-btn { width: 26px; height: 26px; opacity: 0.75; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- add-reaction trigger icon ----

  const ADD_ICON_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<circle cx="10" cy="12" r="7"/>' +
    '<path d="M7.3 13c.7 1 1.7 1.6 2.7 1.6s2-.6 2.7-1.6"/>' +
    '<path d="M8 10h.01M12 10h.01"/>' +
    '<path d="M17.5 6.5v4M15.5 8.5h4"/>' +
    '</svg>';

  // ---- session ----

  let sessionPromise = null;
  function getSession() {
    if (!sessionPromise) {
      sessionPromise = fetch('/api/session.php', { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((data) => ({ loggedIn: !!data.loggedIn, csrfToken: data.csrfToken || null }))
        .catch(() => ({ loggedIn: false, csrfToken: null }));
    }
    return sessionPromise;
  }

  // ---- reaction data cache + network ----

  const reactionCache = new Map();
  const inFlight = new Map();

  async function fetchReactions(commentId) {
    try {
      const res = await fetch(`/api/reactions.php?target_type=comment&target_id=${encodeURIComponent(commentId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function toggleReaction(commentId, emoji, barEl) {
    const session = await getSession();
    if (!session.loggedIn) {
      showGuestPrompt(barEl);
      return;
    }
    try {
      const res = await fetch('/api/reactions.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'comment',
          targetId: commentId,
          reactionType: emoji,
          csrf_token: session.csrfToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) return;
      reactionCache.set(commentId, { counts: data.counts, userReactions: data.userReactions });
      if (document.contains(barEl)) renderBar(barEl, reactionCache.get(commentId));
    } catch (e) {
      // silent fail
    }
  }

  function showGuestPrompt(barEl) {
    if (barEl.querySelector('.cmr-toast')) return;
    const toast = document.createElement('div');
    toast.className = 'cmr-toast';
    toast.innerHTML = `<a href="/login.php">Log in</a> to react.`;
    barEl.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  // ---- bar render ----

  function renderBar(barEl, data) {
    injectStyles();
    const { counts = {}, userReactions = [] } = data || {};
    const entries = Object.entries(counts).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);

    barEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    entries.forEach(([emoji, count]) => {
      const active = userReactions.includes(emoji);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'cmr-pill' + (active ? ' cmr-pill-active' : '');
      pill.dataset.cmrPill = emoji;
      pill.title = active ? 'Remove your reaction' : 'React';
      pill.innerHTML = `<img class="cmr-pill-emoji" src="${getTwemojiUrl(emoji)}" alt="${emoji}" loading="lazy" decoding="async" draggable="false" /><span class="cmr-pill-count">${count}</span>`;
      frag.appendChild(pill);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cmr-add-btn';
    addBtn.dataset.cmrAdd = '1';
    addBtn.title = 'Add reaction';
    addBtn.innerHTML = ADD_ICON_SVG;
    frag.appendChild(addBtn);

    barEl.appendChild(frag);
    barEl.classList.toggle('cmr-bar-empty', entries.length === 0);
  }

  async function initCommentReactions(commentId, barEl) {
    injectStyles();
    barEl.dataset.commentId = commentId;

    if (reactionCache.has(commentId)) {
      renderBar(barEl, reactionCache.get(commentId));
    } else {
      renderBar(barEl, { counts: {}, userReactions: [] });

      let promise = inFlight.get(commentId);
      if (!promise) {
        promise = fetchReactions(commentId).finally(() => inFlight.delete(commentId));
        inFlight.set(commentId, promise);
      }
      const data = await promise;
      if (data) {
        reactionCache.set(commentId, data);
        if (document.contains(barEl)) renderBar(barEl, reactionCache.get(commentId));
      }
    }

    startPolling();
  }

  // ---- live updates ----

  let pollingStarted = false;

  function startPolling() {
    if (pollingStarted) return;
    pollingStarted = true;
    setInterval(async () => {
      const bars = Array.from(document.querySelectorAll('.cmr-bar[data-comment-id]'));
      if (bars.length === 0) return;

      const idToBars = new Map();
      bars.forEach((el) => {
        const id = el.dataset.commentId;
        if (!id) return;
        if (!idToBars.has(id)) idToBars.set(id, []);
        idToBars.get(id).push(el);
      });

      await Promise.all(
        Array.from(idToBars.entries()).map(async ([commentId, els]) => {
          const data = await fetchReactions(commentId);
          if (!data) return;
          const prev = reactionCache.get(commentId);
          const changed = !prev || JSON.stringify(prev) !== JSON.stringify(data);
          reactionCache.set(commentId, data);
          if (changed) {
            els.forEach((el) => { if (document.contains(el)) renderBar(el, data); });
          }
        })
      );
    }, REACTION_POLL_MS);
  }

  // ---- event delegation ----

  let delegationBound = false;
  function bindDelegation() {
    if (delegationBound) return;
    delegationBound = true;

    document.addEventListener('click', (e) => {
      const pillBtn = e.target.closest('[data-cmr-pill]');
      if (pillBtn) {
        const bar = pillBtn.closest('.cmr-bar');
        if (!bar) return;
        toggleReaction(bar.dataset.commentId, pillBtn.dataset.cmrPill, bar);
        return;
      }
      const addBtn = e.target.closest('[data-cmr-add]');
      if (addBtn) {
        const bar = addBtn.closest('.cmr-bar');
        if (!bar) return;
        window.AghiEmojiPicker.open(addBtn, (emoji) => {
          toggleReaction(bar.dataset.commentId, emoji, bar);
        });
      }
    });
  }

  bindDelegation();

  window.initCommentReactions = initCommentReactions;
})();