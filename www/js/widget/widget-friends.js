/**
 * widget-friends.js — friends panel for the split account widget.
 *
 * Owns: buildFriendsPanel, fetchFriendsList, renderFriendsList,
 * rerenderFriendsPanel, start/stopFriendsPolling, removeFriend,
 * respondToFriendRequest (called from inbox friend-request rows).
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-friends] widget-core.js must load before this file');
}

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
  const U = AghiWidgetUtil;
  this.stopFriendsPolling();
  this.friendsPollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || !this.friendsOpen) return;
    // Skip the refresh while the user is filtering or focused in the
    // search box — a rebuild would steal focus and wipe their input.
    const active = document.activeElement;
    const searchBusy = this.friendsFilter || (active && active.classList && active.classList.contains('aghi-aw-dm-search-input'));
    if (searchBusy) return;
    this.fetchFriendsList(true);
  }, U.FRIENDS_POLL_INTERVAL_MS);
};

AccountWidget.prototype.stopFriendsPolling = function () {
  if (this.friendsPollTimer) {
    clearInterval(this.friendsPollTimer);
    this.friendsPollTimer = null;
  }
};

AccountWidget.prototype.buildFriendsPanel = function () {
  const U = AghiWidgetUtil;
  const panel = document.createElement('div');
  panel.className = 'aghi-aw-friends-panel';
  panel.innerHTML = `
    <div class="aghi-aw-panel-head">
      <h2 class="aghi-aw-panel-title">Friends</h2>
      <div class="aghi-aw-panel-head-actions">
        <span class="aghi-aw-friends-count">${this.friends.length}</span>
        <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
      </div>
    </div>
    <div class="aghi-aw-friends-search">
      ${U.SEARCH_ICON}
      <input type="text" class="aghi-aw-dm-search-input" placeholder="Search friends…" data-el="friend-search" value="${U.escapeHtml(this.friendsFilter || '').replace(/"/g, '&quot;')}">
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
  const U = AghiWidgetUtil;
  if (!el) return;
  if (this.friendsLoading && !this.friendsLoaded) {
    el.innerHTML = '<div class="aghi-aw-friends-loading">Loading…</div>';
    return;
  }
  if (this.friendsError) {
    el.innerHTML = `<div class="aghi-aw-friends-empty">${U.escapeHtml(this.friendsError)}</div>`;
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
          <div class="aghi-aw-friends-name">${U.escapeHtml(f.username)}</div>
          <div class="aghi-aw-friends-status ${f.status ? '' : presenceClass}">${U.escapeHtml(statusText)}</div>
        </div>
        <button type="button" class="aghi-aw-friends-remove" data-action="remove" aria-label="Remove friend" title="Remove friend">${U.TRASH_ICON}</button>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.aghi-aw-friends-item').forEach((item) => {
    const userId = parseInt(item.getAttribute('data-userid'), 10);
    const friend = friends.find((f) => f.id === userId);
    if (!friend) return;
    const avatarEl = item.querySelector('[data-el="avatar"]');
    U.applyAvatar(avatarEl, friend.pfpId, friend.username);
    U.renderPresenceDot(avatarEl, friend);

    item.querySelector('[data-action="remove"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await U.showConfirmModal(
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
