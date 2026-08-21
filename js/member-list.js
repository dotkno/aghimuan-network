/**
 * member-list.js
 *
 * Drop-in Discord-style member list. Self-mounts, self-styles, no markup
 * required anywhere on the page other than a <script> tag.
 *
 * Desktop: persistent panel fixed to the right edge, slides in/out on
 *          collapse; a small pull-tab stays visible on the edge while
 *          collapsed so it can always be reopened.
 * Mobile (<= 768px, matching the site's existing mobile-tab-bar
 *          breakpoint): sliding drawer, opened via an icon auto-inserted
 *          next to #aghi-account-widget in the topbar, closable via
 *          backdrop tap or the in-panel close button.
 *
 * Clicking a row does NOT open a popup directly here -- it just tags the
 * row with data-aghi-username/data-aghi-userid, and the existing global
 * click listener in user-profile-popup.js picks it up (same trigger
 * pattern used site-wide), so profile popups, Message button, etc. all
 * come for free with zero duplicated logic.
 *
 * Render is split into ensureShell() (header/search/frame -- only rebuilt
 * when switching between drawer/static or on first paint) and
 * renderBody() (just the group/user list -- called on every data refresh)
 * so that periodic polling never nukes focus/cursor position out of the
 * search input while someone is typing in it.
 */
(function () {
  'use strict';

  const BREAKPOINT = 768; // matches index.html's mobile-tab-bar breakpoint
  const REFRESH_MS = 5 * 1000; // matches the site's existing DM/notification poll interval

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

  const PRESENCE_META = {
    online:  { label: 'Online',         color: '#3ddc84' },
    away:    { label: 'Away',           color: '#f5c542' },
    dnd:     { label: 'Do Not Disturb', color: '#e05260' },
    offline: { label: 'Offline',        color: '#6b8b9a' },
  };

  const ROLE_HEADER_COLOR = {
    'CLUB ADVISER':     '#4facfe',
    'OFFICER':          '#00c6ff',
    'COMMITTEE MEMBER': '#1e88e5',
    'MEMBER':           '#55F1F8',
  };

  function presetColor(pfpId) {
    const match = PFP_PRESETS.find((p) => p.id === pfpId);
    return (match || PFP_PRESETS[0]).color;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function isMobile() {
    return window.innerWidth <= BREAKPOINT;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function injectStyles() {
    if (document.getElementById('aghi-ml-styles')) return;
    const style = document.createElement('style');
    style.id = 'aghi-ml-styles';
    style.textContent = `
      :root { --aghi-ml-width: 260px; }

      .aghi-ml-panel {
        display: flex; flex-direction: column;
        background: linear-gradient(180deg, #0B1220 0%, #060A12 100%);
        border-left: 1px solid rgba(85,241,248,0.15);
        font-family: 'Rajdhani', sans-serif; color: #E6EDF7;
        position: fixed; top: 0; right: 0; height: 100vh;
        width: var(--aghi-ml-width); z-index: 500;
        transform: translateX(0);
        transition: transform 0.25s ease-out;
      }
      .aghi-ml-panel.aghi-ml-drawer {
        transform: translateX(100%);
        box-shadow: -8px 0 24px rgba(0,0,0,0.5);
        z-index: 1000;
      }
      .aghi-ml-panel.aghi-ml-drawer.aghi-ml-open { transform: translateX(0); }
      .aghi-ml-panel.aghi-ml-static.aghi-ml-hidden { transform: translateX(100%); }

      .aghi-ml-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 999;
        opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
      }
      .aghi-ml-backdrop.aghi-ml-open { opacity: 1; pointer-events: auto; }

      body.aghi-ml-desktop-active { padding-right: var(--aghi-ml-width); transition: padding-right 0.2s ease; box-sizing: border-box; }
      html.aghi-ml-noscroll { overflow: hidden; }

      .aghi-ml-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(85,241,248,0.15); flex-shrink: 0; }
      .aghi-ml-title { font-family: 'Orbitron', sans-serif; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: #55F1F8; text-shadow: 0 0 8px rgba(85,241,248,0.4); }
      .aghi-ml-header-btn { background: none; border: none; color: #A8B3C7; font-size: 1.1rem; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: color 0.15s, background 0.15s; }
      .aghi-ml-header-btn:hover { color: #55F1F8; background: rgba(85,241,248,0.08); }

      .aghi-ml-search { margin: 10px 14px; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(85,241,248,0.15); border-radius: 6px; color: #E6EDF7; font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; outline: none; transition: border-color 0.15s; }
      .aghi-ml-search:focus { border-color: #55F1F8; }

      .aghi-ml-body { flex: 1; overflow-y: auto; padding: 4px 8px 16px; }
      .aghi-ml-body::-webkit-scrollbar { width: 6px; }
      .aghi-ml-body::-webkit-scrollbar-thumb { background: rgba(85,241,248,0.25); border-radius: 3px; }

      .aghi-ml-group { margin-top: 14px; }
      .aghi-ml-group-header { font-family: 'Orbitron', sans-serif; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0 10px 6px; }
      .aghi-ml-count { opacity: 0.6; font-family: 'Rajdhani', sans-serif; }

      .aghi-ml-user-list { list-style: none; margin: 0; padding: 0; }
      .aghi-ml-user { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: background 0.12s; }
      .aghi-ml-user:hover { background: rgba(85,241,248,0.08); }
      .aghi-ml-user.aghi-ml-dim { opacity: 0.5; }

      .aghi-ml-avatar-wrap { position: relative; flex-shrink: 0; width: 32px; height: 32px; }
      .aghi-ml-avatar { width: 32px; height: 32px; border-radius: 50%; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-ml-avatar span { font-family: 'Orbitron', sans-serif; font-size: 13px; color: #F1F2F5; user-select: none; }
      .aghi-ml-presence-dot { position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #0B1220; }

      .aghi-ml-user-meta { display: flex; flex-direction: column; min-width: 0; }
      .aghi-ml-username { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-ml-status { font-size: 0.72rem; color: #8A93A6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .aghi-ml-empty { text-align: center; color: #8A93A6; padding: 24px 10px; font-size: 0.85rem; }

      .aghi-ml-trigger { display: none; background: none; border: none; color: #A8B3C7; cursor: pointer; padding: 6px; margin-right: 6px; border-radius: 6px; align-items: center; justify-content: center; }
      .aghi-ml-trigger:hover { color: #55F1F8; background: rgba(85,241,248,0.08); }

      /* Pull-tab that reopens the collapsed desktop panel -- lives outside
         the panel itself so it never disappears along with it. */
      .aghi-ml-reopen-tab {
        position: fixed; top: 50%; right: 0; z-index: 480;
        transform: translateY(-50%) translateX(100%);
        background: #0B1220; color: #55F1F8; cursor: pointer;
        border: 1px solid rgba(85,241,248,0.35); border-right: none;
        border-radius: 8px 0 0 8px; padding: 14px 6px;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s ease, transform 0.25s ease-out;
        box-shadow: -4px 0 16px rgba(0,0,0,0.4);
      }
      .aghi-ml-reopen-tab:hover { background: rgba(85,241,248,0.12); }
      .aghi-ml-reopen-tab.aghi-ml-visible {
        opacity: 1; pointer-events: auto; transform: translateY(-50%) translateX(0);
      }

      @media (max-width: ${BREAKPOINT}px) {
        .aghi-ml-trigger { display: inline-flex; }
        .aghi-ml-panel.aghi-ml-static { display: none; }
        .aghi-ml-reopen-tab { display: none; }
        body.aghi-ml-desktop-active { padding-right: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function MemberList() {
    this.panelEl = null;
    this.backdropEl = null;
    this.tabEl = null;
    this.bodyEl = null;
    this.searchEl = null;
    this.groups = [];
    this.query = '';
    this.open = false;      // drawer open (mobile)
    this.collapsed = false; // panel hidden (desktop)
    this.shellMobile = null; // which layout the current shell was built for
    this.refreshTimer = null;
  }

  MemberList.prototype.avatarInner = function (user) {
    if (user.avatarUrl) {
      return `<div class="aghi-ml-avatar" style="background-image:url('${user.avatarUrl}');background-color:#0a1520;"></div>`;
    }
    const color = presetColor(user.pfpId);
    const initial = (user.username || '?').charAt(0).toUpperCase();
    return `<div class="aghi-ml-avatar" style="background-color:${color};"><span>${escapeHtml(initial)}</span></div>`;
  };

  MemberList.prototype.renderUserRow = function (user) {
    const presence = PRESENCE_META[user.presence] || PRESENCE_META.offline;
    const dimmed = user.presence === 'offline' ? ' aghi-ml-dim' : '';
    return `
      <li class="aghi-ml-user${dimmed}" data-aghi-userid="${user.id}" data-aghi-username="${escapeHtml(user.username)}">
        <span class="aghi-ml-avatar-wrap">
          ${this.avatarInner(user)}
          <span class="aghi-ml-presence-dot" style="background:${presence.color}" title="${presence.label}"></span>
        </span>
        <span class="aghi-ml-user-meta">
          <span class="aghi-ml-username">${escapeHtml(user.username)}</span>
          ${user.status ? `<span class="aghi-ml-status">${escapeHtml(user.status)}</span>` : ''}
        </span>
      </li>`;
  };

  MemberList.prototype.renderGroup = function (group) {
    const color = ROLE_HEADER_COLOR[group.role] || '#55F1F8';
    return `
      <div class="aghi-ml-group">
        <div class="aghi-ml-group-header" style="color:${color}">
          ${escapeHtml(group.role)} <span class="aghi-ml-count">— ${group.count}</span>
        </div>
        <ul class="aghi-ml-user-list">${group.users.map((u) => this.renderUserRow(u)).join('')}</ul>
      </div>`;
  };

  // Rebuilds header/search/frame. Only actually needed on first paint or
  // when crossing the drawer<->static breakpoint -- NOT on every data
  // refresh, so typing in the search box never gets its focus yanked out
  // from under it by the 5s poll.
  MemberList.prototype.ensureShell = function () {
    const mobile = isMobile();

    if (!this.panelEl) {
      this.panelEl = document.createElement('div');
      document.body.appendChild(this.panelEl);
    }

    if (this.shellMobile !== mobile) {
      this.panelEl.innerHTML = `
        <div class="aghi-ml-header">
          <span class="aghi-ml-title">Members</span>
          <button type="button" class="aghi-ml-header-btn" data-action="close" aria-label="${mobile ? 'Close' : 'Hide'} member list">${mobile ? '&times;' : '&raquo;'}</button>
        </div>
        <input type="text" class="aghi-ml-search" placeholder="Search members...">
        <div class="aghi-ml-body"></div>
      `;
      this.bodyEl = this.panelEl.querySelector('.aghi-ml-body');
      this.searchEl = this.panelEl.querySelector('.aghi-ml-search');
      this.searchEl.value = this.query;

      this.panelEl.querySelector('[data-action="close"]').addEventListener('click', () => {
        if (isMobile()) this.setOpen(false);
        else this.toggleCollapsed();
      });
      this.searchEl.addEventListener('input', debounce((e) => {
        this.query = e.target.value;
        this.load();
      }, 250));

      if (this.bodyEl) this.renderBody();
      this.shellMobile = mobile;
    }

    this.panelEl.className = `aghi-ml-panel ${mobile ? 'aghi-ml-drawer' : 'aghi-ml-static'} ${this.open ? 'aghi-ml-open' : ''} ${!mobile && this.collapsed ? 'aghi-ml-hidden' : ''}`;

    if (mobile) {
      if (!this.backdropEl) {
        this.backdropEl = document.createElement('div');
        this.backdropEl.className = 'aghi-ml-backdrop';
        this.backdropEl.addEventListener('click', () => this.setOpen(false));
        document.body.appendChild(this.backdropEl);
      }
      this.backdropEl.classList.toggle('aghi-ml-open', this.open);
    } else if (this.backdropEl) {
      this.backdropEl.classList.remove('aghi-ml-open');
    }

    if (!this.tabEl) {
      this.tabEl = document.createElement('button');
      this.tabEl.type = 'button';
      this.tabEl.className = 'aghi-ml-reopen-tab';
      this.tabEl.setAttribute('aria-label', 'Show member list');
      this.tabEl.innerHTML = '&laquo;';
      this.tabEl.addEventListener('click', () => this.toggleCollapsed());
      document.body.appendChild(this.tabEl);
    }
    this.tabEl.classList.toggle('aghi-ml-visible', !mobile && this.collapsed);

    document.body.classList.toggle('aghi-ml-desktop-active', !mobile && !this.collapsed);
    document.documentElement.classList.toggle('aghi-ml-noscroll', mobile && this.open);
  };

  MemberList.prototype.renderBody = function () {
    if (!this.bodyEl) return;
    this.bodyEl.innerHTML = this.groups.length
      ? this.groups.map((g) => this.renderGroup(g)).join('')
      : `<div class="aghi-ml-empty">Login to see members.</div>`;
    // Row clicks: only tag/route via data-aghi-* attrs -- the existing
    // global listener in user-profile-popup.js does the rest.
  };

  MemberList.prototype.setOpen = function (open) {
    this.open = open;
    this.ensureShell();
  };

  MemberList.prototype.toggleCollapsed = function () {
    this.collapsed = !this.collapsed;
    this.ensureShell();
  };

  MemberList.prototype.load = async function () {
    try {
      const url = 'api/user-list.php' + (this.query ? `?q=${encodeURIComponent(this.query)}` : '');
      const res = await fetch(url, { credentials: 'same-origin' });
      const data = await res.json();
      this.groups = (data && data.ok) ? data.groups : [];
    } catch (e) {
      this.groups = [];
    }
    this.renderBody();
  };

  MemberList.prototype.insertTrigger = function () {
    if (document.querySelector('.aghi-ml-trigger')) return;
    const mount = document.getElementById('aghi-account-widget');
    if (!mount || !mount.parentNode) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aghi-ml-trigger';
    btn.setAttribute('aria-label', 'Show members');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`;
    btn.addEventListener('click', () => this.setOpen(true));
    mount.parentNode.insertBefore(btn, mount);
  };

  MemberList.prototype.init = function () {
    injectStyles();
    this.insertTrigger();
    this.ensureShell();
    this.load();
    this.refreshTimer = setInterval(() => this.load(), REFRESH_MS);
    window.addEventListener('resize', debounce(() => this.ensureShell(), 200));
  };

  function boot() {
    const instance = new MemberList();
    instance.init();
    window.AghiMemberList = {
      open: () => instance.setOpen(true),
      close: () => instance.setOpen(false),
      toggleCollapsed: () => instance.toggleCollapsed(),
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();