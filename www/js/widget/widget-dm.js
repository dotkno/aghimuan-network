/**
 * widget-dm.js — direct-messaging UI for the split account widget.
 *
 * Owns: buildDmPanel, buildDmChatHtml, initDmChat, wireDmComposer,
 * buildDmPanelQuick, buildDmPanelFull, animateDmClose, rerenderDmPanel,
 * fetchDmThreads, renderDmThreads, openDmThread, refreshDmHeader,
 * renderDmHeaderPresence, renderDmMessages, saveDmMessageEdit,
 * deleteDmMessage, scrollDmMessagesToBottom, sendDmMessage, updateReplyPreview.
 * (Polling loops live in widget-dm-poll.js; reactions in widget-dm-reactions.js.)
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-dm] widget-core.js must load before this file');
}

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
  const U = AghiWidgetUtil;
  return `
    <div class="aghi-aw-dm-header">
      <button type="button" class="aghi-aw-dm-back" data-action="dm-back" aria-label="Back to conversations">${U.BACK_ICON}</button>
      <div class="aghi-aw-dm-header-avatar-wrap">
        <div class="aghi-aw-dm-header-avatar" data-el="chat-avatar"></div>
      </div>
      <div class="aghi-aw-dm-header-info">
        <div class="aghi-aw-dm-header-name" data-el="chat-username"></div>
        <div class="aghi-aw-dm-header-status" data-el="status" hidden></div>
      </div>
      ${isQuick ? `
        <div class="aghi-aw-dm-header-actions">
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="expand" aria-label="Open full messaging" title="Expand">${U.EXPAND_ICON}</button>
          <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
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
        <button type="button" class="aghi-aw-dm-reply-cancel" data-action="cancel-reply" aria-label="Cancel reply">${U.X_ICON}</button>
      </div>
      <div class="aghi-aw-dm-composer-row">
        <textarea class="aghi-aw-dm-input" data-el="input" rows="1" maxlength="2000" placeholder="Type a message…"></textarea>
        <button type="button" class="aghi-aw-dm-emoji" data-action="emoji" aria-label="Insert emoji" title="Emoji">🙂</button>
        <button type="button" class="aghi-aw-dm-send" data-action="send" aria-label="Send">${U.SEND_ICON}</button>
      </div>
    </div>
  `;
};

// Wires up an already-mounted conversation block (header presence, message
// list, composer, reply preview).
AccountWidget.prototype.initDmChat = function (panel, isQuick) {
  const U = AghiWidgetUtil;
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

  U.applyAvatar(panel.querySelector('[data-el="chat-avatar"]'), this.dmActiveUser.pfpId, this.dmActiveUser.username);
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
  const U = AghiWidgetUtil;
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
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="expand" aria-label="Open full messaging" title="Expand">${U.EXPAND_ICON}</button>
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
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
  const U = AghiWidgetUtil;
  const panel = document.createElement('div');
  const inThread = this.dmView === 'thread' && this.dmActiveUser;
  panel.className = 'aghi-aw-dm-panel aghi-aw-dm-panel-full' + (inThread ? ' aghi-aw-dm-has-thread' : '');

  panel.innerHTML = `
    <div class="aghi-aw-dm-full-sidebar">
      <div class="aghi-aw-dm-full-sidebar-head">
        <h2 class="aghi-aw-dm-panel-title">Messages</h2>
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
      </div>
      <div class="aghi-aw-dm-full-search">
        ${U.SEARCH_ICON}
        <input type="text" class="aghi-aw-dm-search-input" placeholder="Search conversations…" data-el="thread-search" value="${U.escapeHtml(this.dmThreadFilter || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="aghi-aw-dm-threads" data-el="threads"></div>
    </div>
    <div class="aghi-aw-dm-chat-area">
      ${inThread ? this.buildDmChatHtml(false) : `
        <div class="aghi-aw-dm-chat-empty">
          <div class="aghi-aw-dm-chat-empty-icon">${U.CHAT_ICON}</div>
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
  const U = AghiWidgetUtil;
  if (!el) return;

  if (this.dmThreadsLoading && this.dmThreads.length === 0) {
    el.innerHTML = '<div class="aghi-aw-dm-empty">Loading conversations…</div>';
    return;
  }
  if (this.dmThreadsError && this.dmThreads.length === 0) {
    el.innerHTML = `<div class="aghi-aw-dm-empty">${U.escapeHtml(this.dmThreadsError)}</div>`;
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
            <span class="aghi-aw-dm-thread-name">${U.escapeHtml(t.username)}</span>
            <span class="aghi-aw-dm-thread-time">${U.timeAgo(t.lastMessage.createdAt)}</span>
          </div>
          <div class="aghi-aw-dm-thread-bottom">
            <span class="aghi-aw-dm-thread-preview">${mine}${U.escapeHtml(preview)}</span>
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
    U.applyAvatar(avatarEl, t.pfpId, t.username);
    U.renderPresenceDot(avatarEl, t);
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
  const U = AghiWidgetUtil;
  if (!headerEl) return;
  const data = this.dmOtherUser || this.dmActiveUser;

  const avatarWrap = headerEl.querySelector('.aghi-aw-dm-header-avatar-wrap');
  if (avatarWrap) U.renderPresenceDot(avatarWrap, data);

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
    statusEl.textContent = U.effectiveDmPresence(data).label;
    statusEl.hidden = false;
  }
};

AccountWidget.prototype.renderDmMessages = function (el) {
  const U = AghiWidgetUtil;
  if (!el) return;
  // Messages newer than the last rendered id play the slide-in animation;
  // everything else re-renders silently so poll ticks never replay it.
  const prevLastId = parseInt(el.getAttribute('data-last-id') || '0', 10);

  if (this.dmMessagesLoading && this.dmMessages.length === 0) {
    el.innerHTML = '<div class="aghi-aw-dm-loading">Loading…</div>';
    return;
  }
  if (this.dmMessagesError && this.dmMessages.length === 0) {
    el.innerHTML = `<div class="aghi-aw-dm-empty">${U.escapeHtml(this.dmMessagesError)}</div>`;
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
            <textarea class="aghi-aw-dm-edit-input" data-el="edit-input" rows="2" maxlength="2000">${U.escapeHtml(m.body)}</textarea>
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
        ${canReact ? `<button type="button" class="aghi-aw-dm-msg-action-btn" data-action="react" aria-label="React">${U.REACT_ICON}</button>` : ''}
        <button type="button" class="aghi-aw-dm-msg-action-btn" data-action="reply" aria-label="Reply">${U.BACK_ICON}</button>
        ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn" data-action="edit" aria-label="Edit">${U.PENCIL_ICON}</button>` : ''}
        ${mine ? `<button type="button" class="aghi-aw-dm-msg-action-btn aghi-aw-dm-action-danger" data-action="delete" aria-label="Delete">${U.TRASH_ICON}</button>` : ''}
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
        replyHtml = `<div class="aghi-aw-dm-bubble-reply"><span class="aghi-aw-dm-bubble-reply-label">${U.escapeHtml(replyLabel)}</span><span class="aghi-aw-dm-bubble-reply-text">${U.escapeHtml(repliedMsg.body)}</span></div>`;
      }
    }

    const enterClass = m.id > prevLastId ? 'aghi-aw-dm-msg-enter' : '';
    return `
      <div class="aghi-aw-dm-msg ${mine ? 'aghi-aw-dm-msg-mine' : ''} ${enterClass}" data-msg-id="${m.id}">
        ${actionsHtml}
        <div class="aghi-aw-dm-bubble">${replyHtml}${U.escapeHtml(m.body)}</div>
        <div class="aghi-aw-dm-reactions" data-el="reactions"></div>
        <div class="aghi-aw-dm-msg-meta">
          ${m.editedAt ? '<span class="aghi-aw-dm-msg-edited">(edited)</span>' : ''}
          <span class="aghi-aw-dm-msg-time">${U.timeAgo(m.createdAt)}</span>
          ${mine ? `<span class="aghi-aw-dm-ticks ${seen ? 'aghi-aw-dm-seen' : ''}" title="${seen ? 'Seen' : 'Delivered'}">${U.DOUBLE_CHECK_ICON}</span>` : ''}
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
  const confirmed = await AghiWidgetUtil.showConfirmModal('Delete message?', 'This can\u2019t be undone.');
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
  const U = AghiWidgetUtil;
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
  U.applyAvatar(avatarEl, repliedUser.pfpId, repliedUser.username);
  nameEl.textContent = isSelf ? 'Replying to yourself' : `Replying to ${repliedUser.username}`;
  textEl.textContent = repliedMsg.body;
  previewEl.hidden = false;
};
