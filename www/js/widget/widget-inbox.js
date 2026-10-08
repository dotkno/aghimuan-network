/**
 * widget-inbox.js — notifications panel for the split account widget.
 *
 * Owns: buildInboxPanel, refreshInboxHeader, rerenderInboxPanel,
 * renderInboxList, fetchInboxList, markNotificationRead,
 * markAllNotificationsRead, startInboxPolling.
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-inbox] widget-core.js must load before this file');
}

AccountWidget.prototype.startInboxPolling = function () {
  const U = AghiWidgetUtil;
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      this.fetchInboxSummary();
    }
  }, U.INBOX_POLL_INTERVAL_MS);
};

AccountWidget.prototype.buildInboxPanel = function () {
  const U = AghiWidgetUtil;
  const panel = document.createElement('div');
  panel.className = 'aghi-aw-inbox-panel';
  panel.innerHTML = `
    <div class="aghi-aw-panel-head">
      <h2 class="aghi-aw-panel-title">Notifications</h2>
      <div class="aghi-aw-panel-head-actions">
        ${this.notifUnreadCount > 0 ? `<span class="aghi-aw-panel-chip" title="${this.notifUnreadCount} unread">${this.notifUnreadCount}</span>` : ''}
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="mark-all" aria-label="Mark all read" title="Mark all read" ${this.notifUnreadCount === 0 ? 'disabled' : ''}>${U.MARK_ALL_ICON}</button>
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
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
  const U = AghiWidgetUtil;
  if (!listEl) return;

  if (this.inboxLoading && this.inboxItems.length === 0) {
    listEl.innerHTML = '<div class="aghi-aw-inbox-loading">Loading…</div>';
    return;
  }
  if (this.inboxError && this.inboxItems.length === 0) {
    listEl.innerHTML = `<div class="aghi-aw-inbox-empty">${U.escapeHtml(this.inboxError)}</div>`;
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
      <div class="aghi-aw-inbox-item ${unread ? 'aghi-aw-unread' : ''} ${clickable ? 'aghi-aw-clickable' : ''}" data-item-id="${U.escapeHtml(String(item.id))}">
        <div class="aghi-aw-inbox-avatar-wrap">
          <div class="aghi-aw-inbox-avatar" data-el="avatar"></div>
          <span class="aghi-aw-inbox-kind" title="${U.escapeHtml(item.kind)}">${U.notifIcon(item.kind)}</span>
        </div>
        <div class="aghi-aw-inbox-body">
          <div class="aghi-aw-inbox-text">${item.kind === 'friend_request'
            ? `<strong>${U.escapeHtml(item.actorUsername)}</strong> sent you a friend request.`
            : U.notifText(item)}</div>
          <div class="aghi-aw-inbox-time">${U.timeAgo(item.createdAt)}</div>
          ${item.kind === 'friend_request' ? `
            <div class="aghi-aw-inbox-actions">
              <button type="button" class="aghi-aw-pill aghi-aw-pill-accept" data-action="accept">${U.CHECK_ICON}<span>Accept</span></button>
              <button type="button" class="aghi-aw-pill aghi-aw-pill-decline" data-action="decline">${U.X_ICON}<span>Decline</span></button>
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
    // Club decisions come from Aghimuan itself (no user actor), so
    // they render the Aghimuan logo + name instead of a "?" monogram.
    if (item.kind === 'creation_approved' || item.kind === 'creation_rejected'
      || item.kind === 'resource_approved' || item.kind === 'resource_rejected') {
      const av = rowEl.querySelector('[data-el="avatar"]');
      av.style.backgroundImage = `url('/favicon-32.png')`;
      av.style.backgroundColor = '#0a1520';
    } else {
      U.applyAvatar(rowEl.querySelector('[data-el="avatar"]'), item.pfpId, item.actorUsername);
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
