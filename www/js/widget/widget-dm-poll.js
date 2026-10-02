/**
 * widget-dm-poll.js — polling loops for direct messaging.
 *
 * Owns: startDmPolling (master 2s loop), pollDmThread (merge-by-id live
 * updates), start/stopDmTypingPolling, fetchDmTypingStatus, notifyDmTyping.
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-dm-poll] widget-core.js must load before this file');
}

// Same interval as notification polling. While a thread is open this also
// pulls new messages for it; while the threads list is open it refreshes
// previews/ordering. Kept as one timer rather than a second setInterval
// so a background tab isn't running two near-identical polling loops.
AccountWidget.prototype.startDmPolling = function () {
  const U = AghiWidgetUtil;
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
  }, U.INBOX_POLL_INTERVAL_MS);
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
// the main inbox poll timer so "typing…" feels responsive
// without dropping the main poll interval site-wide.
AccountWidget.prototype.startDmTypingPolling = function () {
  const U = AghiWidgetUtil;
  this.stopDmTypingPolling();
  this.dmTypingPollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || !this.dmActiveUser || this.dmView !== 'thread') return;
    this.fetchDmTypingStatus();
  }, U.TYPING_POLL_INTERVAL_MS);
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
  const U = AghiWidgetUtil;
  if (!this.dmActiveUser) return;
  const now = Date.now();
  if (now - this.dmLastTypingPingAt < U.TYPING_PING_INTERVAL_MS) return;
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
