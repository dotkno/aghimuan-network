/**
 * reactions.js
 *
 * Compact icon-based reaction bar for announcement posts: [👍 count] [💬 count]
 * .... [badge pill of top reaction icons]. Self-contained styles, event
 * delegation (no inline onclick=""), session/CSRF from /api/session.php --
 * same pattern comments.js uses.
 *
 * Public API (unchanged so existing post-render code keeps working):
 *   renderPostReactionSection(postId) -> HTML string to insert into a post card
 *   initPostReactions(postId)         -> fetch counts + activate it
 */
(function () {
  'use strict';

  const REACTIONS = [
    { type: 'like',  label: 'Like',  icon: '👍' },
    { type: 'love',  label: 'Love',  icon: '❤️' },
    { type: 'care',  label: 'Care',  icon: '🥰' },
    { type: 'haha',  label: 'Haha',  icon: '😆' },
    { type: 'wow',   label: 'Wow',   icon: '😮' },
    { type: 'sad',   label: 'Sad',   icon: '😢' },
    { type: 'angry', label: 'Angry', icon: '😡' },
  ];
  const REACTION_MAP = new Map(REACTIONS.map((r) => [r.type, r]));
  const POPOVER_HIDE_DELAY_MS = 500;

  // ---- styles -------------------------------------------------------

  function injectStyles() {
    if (document.getElementById('agr-styles')) return;
    const style = document.createElement('style');
    style.id = 'agr-styles';
    style.textContent = `
      .agr-bar {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(48, 150, 199, 0.18);
        font-family: 'Rajdhani', sans-serif;
      }
      .agr-actions { display: flex; align-items: center; gap: 4px; }
      .agr-spacer { flex: 1; }

      .agr-action-btn {
        background: none;
        border: none;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 7px;
        cursor: pointer;
        color: #7a8d99;
        font-family: 'Rajdhani', sans-serif;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .agr-action-btn:hover { background: rgba(85, 241, 248, 0.08); color: #e6f1f5; }
      .agr-icon { font-size: 16px; line-height: 1; }
      .agr-count { font-size: 13.5px; font-weight: 700; letter-spacing: 0.01em; }

      .agr-like-wrap { position: relative; }
      .agr-like-btn.agr-active { color: #55F1F8; }
      .agr-like-btn.agr-active[data-active-type="love"],
      .agr-like-btn.agr-active[data-active-type="care"] { color: #ff6b81; }
      .agr-like-btn.agr-active[data-active-type="haha"],
      .agr-like-btn.agr-active[data-active-type="wow"],
      .agr-like-btn.agr-active[data-active-type="sad"] { color: #f7c948; }
      .agr-like-btn.agr-active[data-active-type="angry"] { color: #ff8b5c; }

      .agr-popover {
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 8px;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        background: rgba(10, 21, 32, 0.97);
        border: 1px solid rgba(85, 241, 248, 0.35);
        border-radius: 24px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(85, 241, 248, 0.12);
        z-index: 10;
        white-space: nowrap;
      }
      .agr-popover.agr-open { display: flex; }
      .agr-emoji-btn {
        background: none;
        border: none;
        font-size: 21px;
        line-height: 1;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .agr-emoji-btn:hover { transform: scale(1.35) translateY(-2px); background: rgba(85, 241, 248, 0.08); }

      .agr-badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(16, 28, 40, 0.6);
        border: 1px solid rgba(48, 150, 199, 0.22);
      }
      .agr-badge-pill:empty { display: none; }
      .agr-badge-pill span { font-size: 14px; line-height: 1; }
      .agr-badge-pill span:not(:first-child) { margin-left: -3px; }

      .agr-toast {
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 8px;
        background: rgba(10, 21, 32, 0.97);
        border: 1px solid rgba(224, 82, 96, 0.4);
        color: #cbd6dc;
        font-size: 12.5px;
        padding: 6px 10px;
        border-radius: 8px;
        white-space: nowrap;
        z-index: 11;
      }
      .agr-toast a { color: #55F1F8; font-weight: 700; }

      @media (max-width: 560px) {
        .agr-action-btn { padding: 5px 8px; gap: 4px; }
        .agr-icon { font-size: 15px; }
        .agr-count { font-size: 12.5px; }
        .agr-emoji-btn { font-size: 19px; padding: 4px; }
        .agr-popover { padding: 5px 6px; gap: 2px; }
        .agr-badge-pill { padding: 3px 8px; }
        .agr-badge-pill span { font-size: 12.5px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- session (shared source of truth with comments.js) ------------

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

  // ---- network --------------------------------------------------------

  async function fetchReactions(targetType, targetId) {
    try {
      const res = await fetch(`/api/reactions.php?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('fetchReactions failed:', e);
      return null;
    }
  }

  // Comment count is read straight from the comments API so this file stays
  // self-contained -- it doesn't need comments.js to have mounted first, or
  // to coordinate with it, to show an accurate number.
  async function fetchCommentCount(postId) {
    try {
      const res = await fetch(`/api/comments.php?post_id=${encodeURIComponent(postId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.comments) ? data.comments.length : null;
    } catch (e) {
      console.error('fetchCommentCount failed:', e);
      return null;
    }
  }

  async function toggleReaction(targetType, targetId, reactionType) {
    const session = await getSession();
    try {
      const res = await fetch('/api/reactions.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          reactionType,
          csrf_token: session.csrfToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('reaction request failed:', res.status, data && data.error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('reaction request threw:', e);
      return null;
    }
  }

  // ---- render -----------------------------------------------------------

  function renderPostReactionSection(postId) {
    injectStyles();
    return `
      <div class="agr-bar" data-post-id="${postId}">
        <div class="agr-actions">
          <div class="agr-like-wrap">
            <div class="agr-popover" data-el="popover">
              ${REACTIONS.map((r) => `<button type="button" class="agr-emoji-btn" data-reaction-emoji="${r.type}" title="${r.label}">${r.icon}</button>`).join('')}
            </div>
            <button type="button" class="agr-action-btn agr-like-btn" data-reaction-like-btn data-el="likebtn">
              <span class="agr-icon" data-el="icon">👍</span>
              <span class="agr-count" data-el="count">0</span>
            </button>
          </div>
          <button type="button" class="agr-action-btn agr-comment-btn" data-scroll-comments>
            <span class="agr-icon">💬</span>
            <span class="agr-count" data-el="commentcount">0</span>
          </button>
          <div class="agr-spacer"></div>
          <div class="agr-badge-pill" data-el="badgepill"></div>
        </div>
      </div>
    `;
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');
  }

  function findBar(postId) {
    return document.querySelector(`.agr-bar[data-post-id="${cssEscape(postId)}"]`);
  }

  function updateReactionUI(bar, counts, userReactions) {
    const countEl = bar.querySelector('[data-el="count"]');
    const iconEl = bar.querySelector('[data-el="icon"]');
    const likeBtn = bar.querySelector('[data-el="likebtn"]');
    const pillEl = bar.querySelector('[data-el="badgepill"]');
    if (!countEl || !iconEl || !likeBtn || !pillEl) return;

    const total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
    countEl.textContent = String(total);

    const userReacted = userReactions && userReactions.length > 0 ? userReactions[0] : null;
    if (userReacted) {
      const match = REACTION_MAP.get(userReacted);
      likeBtn.classList.add('agr-active');
      likeBtn.dataset.activeType = userReacted;
      iconEl.textContent = match ? match.icon : '👍';
    } else {
      likeBtn.classList.remove('agr-active');
      delete likeBtn.dataset.activeType;
      iconEl.textContent = '👍';
    }

    const topTypes = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    pillEl.innerHTML = topTypes.map(([t]) => {
      const match = REACTION_MAP.get(t);
      return match ? `<span>${match.icon}</span>` : '';
    }).join('');
  }

  function updateCommentCountUI(bar, count) {
    const el = bar.querySelector('[data-el="commentcount"]');
    if (el && count !== null) el.textContent = String(count);
  }

  function showGuestPrompt(bar) {
    const wrap = bar.querySelector('.agr-like-wrap');
    if (!wrap || wrap.querySelector('.agr-toast')) return;
    const toast = document.createElement('div');
    toast.className = 'agr-toast';
    toast.innerHTML = `<a href="/login.php">Log in</a> to react to this post.`;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  async function handlePostReaction(postId, reactionType, bar) {
    const session = await getSession();
    if (!session.loggedIn) {
      showGuestPrompt(bar);
      return;
    }
    const res = await toggleReaction('post', postId, reactionType);
    if (res && res.success) {
      updateReactionUI(bar, res.counts, res.userReactions);
    }
    const popover = bar.querySelector('[data-el="popover"]');
    if (popover) closePopover(popover);
  }

  async function initPostReactions(postId) {
    const bar = findBar(postId);
    if (!bar) return;
    const [reactionData, commentCount] = await Promise.all([
      fetchReactions('post', postId),
      fetchCommentCount(postId),
    ]);
    if (reactionData) updateReactionUI(bar, reactionData.counts, reactionData.userReactions);
    updateCommentCountUI(bar, commentCount);
  }

  // ---- popover open/close with a grace-period delay ---------------------

  function openPopover(popover) {
    clearHideTimer(popover);
    popover.classList.add('agr-open');
  }
  function scheduleHide(popover) {
    clearHideTimer(popover);
    popover._agrHideTimer = setTimeout(() => {
      popover.classList.remove('agr-open');
      popover._agrHideTimer = null;
    }, POPOVER_HIDE_DELAY_MS);
  }
  function closePopover(popover) {
    clearHideTimer(popover);
    popover.classList.remove('agr-open');
  }
  function clearHideTimer(popover) {
    if (popover._agrHideTimer) {
      clearTimeout(popover._agrHideTimer);
      popover._agrHideTimer = null;
    }
  }

  // ---- event delegation (bound once, works for posts added later) ------

  let delegationBound = false;
  function bindDelegation() {
    if (delegationBound) return;
    delegationBound = true;

    document.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('[data-reaction-emoji]');
      if (emojiBtn) {
        const bar = emojiBtn.closest('.agr-bar');
        if (!bar) return;
        handlePostReaction(bar.dataset.postId, emojiBtn.dataset.reactionEmoji, bar);
        return;
      }

      const likeBtn = e.target.closest('[data-reaction-like-btn]');
      if (likeBtn) {
        const bar = likeBtn.closest('.agr-bar');
        if (!bar) return;
        // A plain click on the like icon always sends 'like'; the popover
        // (hover, or tap-to-open on touch) is how a specific one gets picked.
        handlePostReaction(bar.dataset.postId, 'like', bar);
        return;
      }

      const commentBtn = e.target.closest('[data-scroll-comments]');
      if (commentBtn) {
        const bar = commentBtn.closest('.agr-bar');
        if (!bar) return;
        const target = document.querySelector(`.fb-comments[data-post-id="${cssEscape(bar.dataset.postId)}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Hover with a grace period: leaving the like button (to move the mouse
    // toward the popover, or just briefly) doesn't instantly close it.
    document.addEventListener('mouseover', (e) => {
      const wrap = e.target.closest('.agr-like-wrap');
      if (!wrap || wrap.contains(e.relatedTarget)) return;
      const popover = wrap.querySelector('[data-el="popover"]');
      if (popover) openPopover(popover);
    });
    document.addEventListener('mouseout', (e) => {
      const wrap = e.target.closest('.agr-like-wrap');
      if (!wrap || wrap.contains(e.relatedTarget)) return;
      const popover = wrap.querySelector('[data-el="popover"]');
      if (popover) scheduleHide(popover);
    });

    // Touch devices don't get :hover -- first tap on the like button opens
    // the popover instead of instantly firing "like".
    const touchArmed = new WeakSet();
    document.addEventListener('touchstart', (e) => {
      const likeBtn = e.target.closest('[data-reaction-like-btn]');
      if (!likeBtn) return;
      const popover = likeBtn.closest('.agr-like-wrap').querySelector('[data-el="popover"]');
      if (popover && !popover.classList.contains('agr-open') && !touchArmed.has(likeBtn)) {
        e.preventDefault();
        openPopover(popover);
        touchArmed.add(likeBtn);
        setTimeout(() => touchArmed.delete(likeBtn), 600);
      }
    }, { passive: false });
  }

  bindDelegation();

  // comments.js dispatches this whenever a comment is created or deleted for
  // a post, so the badge count here stays live without polling or needing
  // comments.js to know anything about reactions.js.
  document.addEventListener('agr:comment-count-changed', (e) => {
    const { postId, count } = e.detail || {};
    if (postId == null || count == null) return;
    const bar = findBar(postId);
    if (bar) updateCommentCountUI(bar, count);
  });

  window.renderPostReactionSection = renderPostReactionSection;
  window.initPostReactions = initPostReactions;
  window.handlePostReaction = function (postId, reactionType) {
    const bar = findBar(postId);
    if (bar) handlePostReaction(postId, reactionType, bar);
  };
})();