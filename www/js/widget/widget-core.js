/**
 * widget-core.js — foundation of the split account widget (see widget-README).
 *
 * Owns: IIFE scope + all shared constants, the AccountWidget constructor and
 * ALL state fields, shell render (render/renderGuest/renderLoggedIn),
 * panel mount/close primitives, onDocClick, boot() + the public
 * window.AghiAccountWidget contract.
 *
 * MUST load before every other widget-*.js file (they attach prototype
 * methods to the constructor exposed here as window.AccountWidget).
 */
(function () {
  'use strict';

  const MOUNT_ID = 'aghi-account-widget';

  // Shared values owned by /js/aghi-config.js (generated from
  // includes/app-config.php). Fallback lists keep old cached pages working
  // if aghi-config.js hasn't loaded yet.
  const FALLBACK_PRESETS = [
    { id: 'default',      color: '#5F5E5A' },
    { id: 'circuit-blue', color: '#185FA5' },
    { id: 'circuit-cyan', color: '#0F6E56' },
    { id: 'node-teal',    color: '#04342C' },
    { id: 'spark-orange', color: '#993C1D' },
    { id: 'wire-purple',  color: '#534AB7' },
    { id: 'chip-green',   color: '#3B6D11' },
    { id: 'signal-pink',  color: '#993556' },
  ];
  const PFP_PRESETS = (window.AGHI_CONFIG && window.AGHI_CONFIG.presets) || FALLBACK_PRESETS;
  const PRESET_IDS = ((window.AGHI_CONFIG && window.AGHI_CONFIG.presetIds) || PFP_PRESETS.map((p) => p.id));

  const PRESENCE_OPTIONS = [
    { id: 'online', label: 'Online',         color: '#3ddc84' },
    { id: 'away',   label: 'Away',           color: '#f5c542' },
    { id: 'dnd',    label: 'Do Not Disturb', color: '#e05260' },
    { id: 'invisible', label: 'Invisible',   color: '#6b8b9a' },
  ];

  const CFG = (window.AGHI_CONFIG || {});
  const MAX_AVATAR_BYTES = CFG.maxAvatarBytes || 2 * 1024 * 1024;
  const MAX_BIO_LENGTH = CFG.maxBioLength || 300;
  const MAX_STATUS_LENGTH = CFG.maxStatusLength || 60;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
  const HEARTBEAT_INTERVAL_MS = CFG.heartbeatIntervalMs || 15 * 1000;

  const SUBROLE_STYLES = {
    'Dagitab': 'background: #d4a017; color: #fff;',
    'EBDA': 'background: #111111; color: #fff; border: 1px solid #444;',
    'Hiraya': 'background: #ffd700; color: #000;',
    'Lyrico': 'background: #00bfff; color: #fff;',
    'Marahuyo': 'background: #800000; color: #fff;',
    'Padayon': 'background: #4b0082; color: #fff;',
    'Pahina': 'background: #cc0000; color: #fff;',
    'Paraluman': 'background: #ffb6c1; color: #333;',
    'PFG': 'background: linear-gradient(90deg, #ffd700 50%, #111111 50%); color: #fff;',

    'Sibol': 'background: #b76e79; color: #fff;',
    'RISE': 'background: linear-gradient(90deg, #000080, #ffd700); color: #fff;',
    'Dalumat': 'background: #795548; color: #fff;',
    'Numero': 'background: #2e7d32; color: #fff;',
    'Kalakbay': 'background: #ffe4e1; color: #333;',
    'Le Verrier': 'background: #0d47a1; color: #fff;',
    'Nexus': 'background: #1b5e20; color: #fff;',
    'Aghimuan': 'background: #00b0ff; color: #000;',
    'Skill Speak': 'background: linear-gradient(90deg, #8b0000, #ffffff); color: #000;',

    'G12': 'background: #455a64; color: #fff;',
    'G11': 'background: #455a64; color: #fff;',
    'JHS': 'background: #455a64; color: #fff;',

    'STEM': 'background: #3f51b5; color: #fff;',
    'ABM/BE': 'background: #2e7d32; color: #fff;',
    'HUMSS/ASSH': 'background: linear-gradient(90deg, #ffd700, #d32f2f); color: #fff;',
    'HE/HT': 'background: #e91e63; color: #fff;',
    'ICT/ICT Professionals': 'background: #8e24aa; color: #fff;',
    'SPORTS': 'background: linear-gradient(90deg, #00bcd4, #4caf50); color: #fff;'
  };

  const OFFLINE_COLOR = '#6b8b9a';

  const CAMERA_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#F1F2F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const PENCIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
  const CHEVRON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const BELL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
  const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
  const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const REACT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 13c.9 1.2 2.1 2 4 2s3.1-.8 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>`;
  const DOUBLE_CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 12 6 17 13 8"/><polyline points="9 17 22 4"/></svg>`;
  // Cleaner double-check geometry (lucide "check-check") — the old one turned
  // to mush at icon-button size.
  const MARK_ALL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`;
  const EXPAND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  const SEARCH_ICON = `<svg class="aghi-aw-dm-search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  const USER_PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
  const HEART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const AT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`;

  // Icon shown next to a notification's avatar, driven by its kind — the API
  // accepts free-form kinds, so unknown ones fall back to the bell.
  const NOTIF_KIND_ICONS = {
    friend_request: () => USER_PLUS_ICON,
    friend_accept: () => CHECK_ICON,
    creation_approved: () => CHECK_ICON,
    creation_rejected: () => X_ICON,
    comment: () => CHAT_ICON,
    mention: () => AT_ICON,
    reaction: () => HEART_ICON,
  };

  const INBOX_POLL_INTERVAL_MS = 2 * 1000;
  const TYPING_POLL_INTERVAL_MS = 1 * 1000; // separate faster loop, only while a thread is open
  const TYPING_PING_INTERVAL_MS = 2500; // how often we tell the server "still typing" — must stay under dms.php's TYPING_FRESHNESS_SECONDS (5s)
  const REACTION_POLL_INTERVAL_MS = 3 * 1000; // periodic refresh so the other participant's new reactions show up live
  const FRIENDS_POLL_INTERVAL_MS = 5 * 1000; // periodic refresh for friends list

  // Shared constant table for feature modules (they run outside this IIFE,
  // so they read everything through AghiWidgetUtil — never bare globals,
  // which would collide with same-named page scripts, e.g. index.html's
  // own PFP_PRESETS/escapeHtml).
  window.AghiWidgetUtil = window.AghiWidgetUtil || {};
  AghiWidgetUtil.PRESET_IDS = PRESET_IDS;
  AghiWidgetUtil.PFP_PRESETS = PFP_PRESETS;
  AghiWidgetUtil.PRESENCE_OPTIONS = PRESENCE_OPTIONS;
  AghiWidgetUtil.MAX_AVATAR_BYTES = MAX_AVATAR_BYTES;
  AghiWidgetUtil.MAX_BIO_LENGTH = MAX_BIO_LENGTH;
  AghiWidgetUtil.MAX_STATUS_LENGTH = MAX_STATUS_LENGTH;
  AghiWidgetUtil.USERNAME_PATTERN = USERNAME_PATTERN;
  AghiWidgetUtil.HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_MS;
  AghiWidgetUtil.SUBROLE_STYLES = SUBROLE_STYLES;
  AghiWidgetUtil.OFFLINE_COLOR = OFFLINE_COLOR;
  AghiWidgetUtil.NOTIF_KIND_ICONS = NOTIF_KIND_ICONS;
  AghiWidgetUtil.INBOX_POLL_INTERVAL_MS = INBOX_POLL_INTERVAL_MS;
  AghiWidgetUtil.TYPING_POLL_INTERVAL_MS = TYPING_POLL_INTERVAL_MS;
  AghiWidgetUtil.TYPING_PING_INTERVAL_MS = TYPING_PING_INTERVAL_MS;
  AghiWidgetUtil.REACTION_POLL_INTERVAL_MS = REACTION_POLL_INTERVAL_MS;
  AghiWidgetUtil.FRIENDS_POLL_INTERVAL_MS = FRIENDS_POLL_INTERVAL_MS;
  AghiWidgetUtil.CAMERA_ICON = CAMERA_ICON;
  AghiWidgetUtil.PENCIL_ICON = PENCIL_ICON;
  AghiWidgetUtil.CHEVRON_ICON = CHEVRON_ICON;
  AghiWidgetUtil.CHECK_ICON = CHECK_ICON;
  AghiWidgetUtil.X_ICON = X_ICON;
  AghiWidgetUtil.BELL_ICON = BELL_ICON;
  AghiWidgetUtil.CHAT_ICON = CHAT_ICON;
  AghiWidgetUtil.BACK_ICON = BACK_ICON;
  AghiWidgetUtil.SEND_ICON = SEND_ICON;
  AghiWidgetUtil.TRASH_ICON = TRASH_ICON;
  AghiWidgetUtil.REACT_ICON = REACT_ICON;
  AghiWidgetUtil.DOUBLE_CHECK_ICON = DOUBLE_CHECK_ICON;
  AghiWidgetUtil.MARK_ALL_ICON = MARK_ALL_ICON;
  AghiWidgetUtil.EXPAND_ICON = EXPAND_ICON;
  AghiWidgetUtil.SEARCH_ICON = SEARCH_ICON;
  AghiWidgetUtil.GEAR_ICON = GEAR_ICON;
  AghiWidgetUtil.USER_PLUS_ICON = USER_PLUS_ICON;
  AghiWidgetUtil.HEART_ICON = HEART_ICON;
  AghiWidgetUtil.AT_ICON = AT_ICON;

  function AccountWidget(mount) {
    this.mount = mount;
    this.state = { loading: true, loggedIn: false, user: null, csrfToken: null };
    this.popupOpen = false;
    this.settingsOpen = false; // popup's Discord-style settings sub-view
    this.presenceMenuOpen = false;
    this.popupClosing = false; // a leave animation is playing for this panel
    this.notifUnreadCount = 0;

    this.inboxOpen = false;
    this.inboxClosing = false;
    this.inboxItems = [];
    this.inboxNextCursor = null;
    this.inboxLoading = false;
    this.inboxLoadedOnce = false;
    this.inboxError = null;

    this.dmUnreadCount = 0;
    this.dmOpen = false;
    this.dmView = 'threads'; // 'threads' | 'thread'
    this.dmMode = 'quick'; // 'quick' | 'full'
    this.dmThreads = [];
    this.dmNextCursor = null;
    this.dmThreadsLoading = false;
    this.dmThreadsLoadedOnce = false;
    this.dmThreadsError = null;
    this.dmReplyToId = null;
    this.dmClosing = false;   // a close animation is playing — block re-entry
    this.dmThreadFilter = ''; // client-side filter for the full-panel search box

    this.friendsOpen = false;
    this.friendsClosing = false;
    this.friends = [];
    this.friendsLoaded = false;
    this.friendsLoading = false;
    this.friendsError = null;
    this.friendsFilter = ''; // client-side search for the friends panel
    this.friendsPollTimer = null;

    this.dmActiveUser = null;
    this.dmMessages = [];
    this.dmMessagesLoading = false;
    this.dmMessagesLoadedOnce = false;
    this.dmMessagesError = null;
    this.dmLastMessageId = 0; // cursor for incremental poll while a thread is open
    this.dmSending = false;
    this.dmOtherUser = null; // { presence, online, status, ... } for the open thread's partner
    this.dmReadUpToId = 0; // highest own-message id the partner has read
    this.dmOtherTyping = false;
    this.dmTypingPollTimer = null;
    this.dmReactionPollTimer = null;
    this.dmLastTypingPingAt = 0;
    this.dmEditingMessageId = null;
    this.dmReactionCache = new Map(); // messageId -> { counts, userReactions }

    this.onDocClick = this.onDocClick.bind(this);
  }

  // Exposed for feature modules (loaded after this file): they attach
  // AccountWidget.prototype.* methods. Guarded — a loud error beats a
  // silent dead widget if load order breaks.
  window.AccountWidget = AccountWidget;

  AccountWidget.prototype.init = async function () {
    this.mount.innerHTML = '';
    this.mount.className = 'aghi-aw';
    try {
      const res = await fetch('/api/session.php', { credentials: 'same-origin' });
      const data = await res.json();
      this.state = { loading: false, loggedIn: !!data.loggedIn, user: data.user, csrfToken: data.csrfToken || null };
    } catch (e) {
      this.state = { loading: false, loggedIn: false, user: null, csrfToken: null };
    }
    this.render();
    document.addEventListener('click', this.onDocClick);
    if (this.state.loggedIn) {
      this.startPresenceHeartbeat();
      await this.fetchInboxSummary();
      this.startInboxPolling();
      await this.fetchDmUnreadCount();
      this.startDmPolling();
    }
  };

  AccountWidget.prototype.onDocClick = function (e) {
    const path = e.composedPath ? e.composedPath() : [];

    // The shared emoji picker (emoji-picker-core.js) renders its popover by
    // appending it directly to document.body, not inside this.mount or any
    // of our panels — so a click on an emoji cell has to be recognized here
    // explicitly, or it looks identical to a genuine outside click and closes
    // whatever panel opened the picker (e.g. reacting to a DM message).
    const insidePicker = path.some((el) => el.classList && el.classList.contains('cmr-picker'));
    if (insidePicker) return;

    if (this.presenceMenuOpen && this.presenceMenuEl && !path.includes(this.presenceMenuEl) && !path.includes(this.presenceBtnEl)) {
      this.presenceMenuOpen = false;
      this.rerenderPopup();
      return;
    }
    if (this.popupOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-popup'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.presenceMenuOpen = false;
        this.settingsOpen = false;
        this.animatePanelClose('popupOpen', '.aghi-aw-popup');
      }
    }
    if (this.inboxOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-inbox-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animatePanelClose('inboxOpen', '.aghi-aw-inbox-panel');
      }
    }
    if (this.dmOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-dm-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animateDmClose();
      }
    }
    if (this.friendsOpen) {
      const insideWidget = path.includes(this.mount);
      const insidePanel = path.some((el) => el.classList && el.classList.contains('aghi-aw-friends-panel'));
      const insideModal = path.some((el) => el.classList && el.classList.contains('aghi-aw-modal-backdrop'));
      if (!insideWidget && !insidePanel && !insideModal) {
        this.animatePanelClose('friendsOpen', '.aghi-aw-friends-panel');
      }
    }
  };

  AccountWidget.prototype.render = function () {
    document.querySelectorAll('.aghi-aw-backdrop, .aghi-aw-inbox-backdrop, .aghi-aw-inbox-panel, .aghi-aw-dm-backdrop, .aghi-aw-dm-panel, .aghi-aw-friends-backdrop, .aghi-aw-friends-panel, .aghi-aw-popup').forEach((el) => el.remove());

    // Full render() replaces the DOM, so any open-thread state that isn't
    // currently visible shouldn't keep its typing-poll timer alive — covers
    // every way the DM panel/thread can close (inbox button, avatar button,
    // outside click, mobile backdrop) from one place instead of repeating
    // this at each individual close handler.
    if (!this.dmOpen || this.dmView !== 'thread') {
      this.stopDmTypingPolling();
    }
    if (!this.friendsOpen) {
      this.stopFriendsPolling();
    }

    if (this.state.loading) {
      this.mount.innerHTML = '';
      return;
    }
    if (!this.state.loggedIn) {
      this.renderGuest();
    } else {
      this.renderLoggedIn();
    }
  };

  AccountWidget.prototype.renderGuest = function () {
    this.mount.innerHTML = `
      <div class="aghi-aw-guest">
        <a href="/login.php">Log in</a>
        <a href="/signup.php" class="aghi-aw-signup">Sign up</a>
      </div>
    `;
  };

  AccountWidget.prototype.renderLoggedIn = function () {
    const U = AghiWidgetUtil;
    const user = this.state.user;

    const inboxBtn = document.createElement('button');
    inboxBtn.type = 'button';
    inboxBtn.className = 'aghi-aw-inbox-btn';
    inboxBtn.setAttribute('aria-label', 'Notifications');
    inboxBtn.setAttribute('aria-expanded', String(this.inboxOpen));
    inboxBtn.innerHTML = U.BELL_ICON;
    this.refreshInboxBadge(inboxBtn);
    inboxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only treat as a close when the panel is actually in the DOM — keeps
      // a stuck state from eating clicks (same self-heal as the DM button).
      if (this.inboxOpen && document.querySelector('.aghi-aw-inbox-panel')) {
        this.animatePanelClose('inboxOpen', '.aghi-aw-inbox-panel');
        return;
      }
      this.inboxClosing = false;
      this.inboxOpen = true;
      this.popupOpen = false; this.dmOpen = false; this.friendsOpen = false;
      this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      this.fetchInboxList(true);
    });

    const dmBtn = document.createElement('button');
    dmBtn.type = 'button';
    dmBtn.className = 'aghi-aw-dm-btn aghi-aw-inbox-btn';
    dmBtn.setAttribute('aria-label', 'Direct messages');
    dmBtn.setAttribute('aria-expanded', String(this.dmOpen));
    dmBtn.innerHTML = U.CHAT_ICON;

    const friendsBtn = document.createElement('button');
    friendsBtn.type = 'button';
    friendsBtn.className = 'aghi-aw-friends-btn aghi-aw-inbox-btn';
    friendsBtn.setAttribute('aria-label', 'Friends');
    friendsBtn.setAttribute('aria-expanded', String(this.friendsOpen));
    friendsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    this.refreshDmBadge(dmBtn);
    dmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only treat this as a close if a panel actually exists — if state and
      // DOM ever disagree (a close raced a rebuild), fall through and open
      // instead of eating the click.
      if (this.dmOpen && document.querySelector('.aghi-aw-dm-panel')) {
        this.animateDmClose();
        return;
      }
      this.dmClosing = false;
      this.dmThreadFilter = '';
      this.dmOpen = true;
      this.popupOpen = false; this.inboxOpen = false; this.friendsOpen = false; this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      if (this.dmView === 'thread' && this.dmActiveUser) {
        this.openDmThread(this.dmActiveUser, false);
      } else {
        this.fetchDmThreads(true);
      }
    });

    friendsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.friendsOpen && document.querySelector('.aghi-aw-friends-panel')) {
        this.animatePanelClose('friendsOpen', '.aghi-aw-friends-panel');
        return;
      }
      this.friendsClosing = false;
      this.friendsFilter = '';
      this.friendsOpen = true;
      this.popupOpen = false; this.inboxOpen = false; this.dmOpen = false;
      this.presenceMenuOpen = false; this.settingsOpen = false;
      this.render();
      this.fetchFriendsList(true);
    });

    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'aghi-aw-avatar-btn';
    AghiWidgetUtil.applyAvatar(avatarBtn, user.pfpId, user.username);
    avatarBtn.setAttribute('aria-expanded', String(this.popupOpen));
    avatarBtn.setAttribute('aria-label', `Account menu for ${user.username}`);
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.popupOpen && document.querySelector('.aghi-aw-popup')) {
        this.presenceMenuOpen = false;
        this.settingsOpen = false;
        this.animatePanelClose('popupOpen', '.aghi-aw-popup');
        return;
      }
      this.popupClosing = false;
      this.popupOpen = true;
      this.inboxOpen = false; this.dmOpen = false; this.friendsOpen = false;
      this.render();
    });

    const row = document.createElement('div');
    row.className = 'aghi-aw-row';
    row.appendChild(inboxBtn);
    row.appendChild(dmBtn);
    row.appendChild(friendsBtn);
    row.appendChild(avatarBtn);

    this.mount.innerHTML = '';
    this.mount.appendChild(row);

    if (this.popupOpen) {
      this.mountPanel(this.buildPopup(), 'popupOpen', '.aghi-aw-popup');
    }
    if (this.inboxOpen) {
      this.mountPanel(this.buildInboxPanel(), 'inboxOpen', '.aghi-aw-inbox-panel');
    }
    if (this.dmOpen) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      // Quick mode on desktop stays anchored under the chat button; mobile
      // sheets and the full messaging window live on <body>, because the
      // topbar's backdrop-filter creates a containing block that hijacks
      // position:fixed descendants.
      const useOverlay = isMobile || this.dmMode === 'full';
      this.dmClosing = false;
      if (useOverlay) {
        const backdrop = document.createElement('div');
        backdrop.className = 'aghi-aw-dm-backdrop';
        backdrop.addEventListener('click', () => { this.animateDmClose(); });
        document.body.appendChild(backdrop);
      }
      const panel = this.buildDmPanel();
      (useOverlay ? document.body : this.mount).appendChild(panel);
      // Mount hidden, then flip the enter class a frame later so the open
      // animation actually plays instead of snapping straight to open.
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('aghi-aw-dm-enter')));
    }
    if (this.friendsOpen) {
      this.mountPanel(this.buildFriendsPanel(), 'friendsOpen', '.aghi-aw-friends-panel');
    }
  };

  // Mounts one of the dropdown panels (profile popup / notifications /
  // friends): bottom sheet + shared backdrop on mobile, anchored dropdown on
  // desktop, then flips the enter class a frame later so the open animation
  // actually plays. The three are mutually exclusive, so one backdrop class
  // is enough. Closing goes through animatePanelClose.
  AccountWidget.prototype.mountPanel = function (panel, flagName, panelSelector) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    this[flagName.replace('Open', 'Closing')] = false;
    if (isMobile) {
      const backdrop = document.createElement('div');
      backdrop.className = 'aghi-aw-backdrop';
      backdrop.addEventListener('click', () => { this.animatePanelClose(flagName, panelSelector); });
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
    } else {
      this.mount.appendChild(panel);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('aghi-aw-enter')));
  };

  // Animated close for the popup/inbox/friends panels — same pattern as
  // animateDmClose: the open flag flips to false IMMEDIATELY so polls and
  // outside clicks treat the panel as closed while it animates out (a poll
  // rebuild landing mid-close would otherwise pop it right back open), the
  // leave animation plays, then render() removes the DOM. The closing guard
  // keeps double closes from stacking; finish() bails if the panel was
  // re-opened mid-animation.
  AccountWidget.prototype.animatePanelClose = function (flagName, panelSelector) {
    const closingFlag = flagName.replace('Open', 'Closing');
    if (this[closingFlag]) return;
    this[flagName] = false;
    const panel = document.querySelector(panelSelector);
    if (!panel) {
      this.render();
      return;
    }
    this[closingFlag] = true;
    panel.classList.remove('aghi-aw-enter');
    panel.classList.add('aghi-aw-leave');
    const backdrop = document.querySelector('.aghi-aw-backdrop');
    if (backdrop) backdrop.classList.add('aghi-aw-leave');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this[closingFlag] = false;
      if (this[flagName]) return; // re-opened mid-close; the open rebuilt the UI
      this.render();
    };
    panel.addEventListener('animationend', (e) => { if (e.target === panel) finish(); });
    setTimeout(finish, 380); // fallback (e.g. prefers-reduced-motion disables the animation)
  };
})();
