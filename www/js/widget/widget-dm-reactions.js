/**
 * widget-dm-reactions.js — message reactions for direct messaging.
 *
 * Owns: initDmMessageReactions, fetchDmMessageReactions,
 * renderDmReactionPills, toggleDmMessageReaction, refreshDmReactions,
 * start/stopDmReactionPolling.
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-dm-reactions] widget-core.js must load before this file');
}

AccountWidget.prototype.startDmReactionPolling = function () {
  const U = AghiWidgetUtil;
  this.stopDmReactionPolling();
  this.dmReactionPollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || !this.dmActiveUser || this.dmView !== 'thread') return;
    this.refreshDmReactions();
  }, U.REACTION_POLL_INTERVAL_MS);
};

AccountWidget.prototype.stopDmReactionPolling = function () {
  if (this.dmReactionPollTimer) {
    clearInterval(this.dmReactionPollTimer);
    this.dmReactionPollTimer = null;
  }
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
  const U = AghiWidgetUtil;
  if (!reactionsEl) return;
  const data = this.dmReactionCache.get(messageId) || { counts: {}, userReactions: [] };
  const entries = Object.entries(data.counts).filter(([, n]) => n > 0);
  reactionsEl.innerHTML = entries.map(([emoji, count]) => {
    const active = data.userReactions.includes(emoji);
    const url = window.AghiEmojiPicker ? window.AghiEmojiPicker.getTwemojiUrl(emoji) : '';
    return `
      <button type="button" class="aghi-aw-dm-reaction-pill ${active ? 'aghi-aw-dm-reaction-active' : ''}" data-emoji="${U.escapeHtml(emoji)}">
        <img class="aghi-aw-dm-reaction-emoji" src="${url}" alt="${U.escapeHtml(emoji)}" loading="lazy" decoding="async" draggable="false" />
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
