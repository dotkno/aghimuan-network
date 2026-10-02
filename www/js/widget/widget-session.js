/**
 * widget-session.js — auth-adjacent background work for the split account widget.
 *
 * Owns: unread-count fetchers + nav badge refreshers, inbox summary +
 * presence heartbeat (incl. the sendBeacon offline ping).
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-session] widget-core.js must load before this file');
}

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

AccountWidget.prototype.startPresenceHeartbeat = function () {
  const ping = () => {
    if (document.visibilityState !== 'visible') return;
    fetch('/api/session.php', { credentials: 'same-origin' }).catch(() => {});
  };
  setInterval(ping, AghiWidgetUtil.HEARTBEAT_INTERVAL_MS);
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
