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
      :root { --aghi-ml-width: 264px; }

      .aghi-ml-panel {
        display: flex; flex-direction: column;
        background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99));
        backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%);
        border-left: 1px solid rgba(255, 255, 255, 0.11);
        font-family: 'Inter', sans-serif; color: #F1F2F5;
        position: fixed; top: 0; right: 0; height: 100vh;
        width: var(--aghi-ml-width); z-index: 500;
        transform: translateX(0);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .aghi-ml-panel.aghi-ml-drawer {
        transform: translateX(100%);
        box-shadow: -24px 0 70px rgba(0, 0, 0, 0.55);
        z-index: 1000;
      }
      .aghi-ml-panel.aghi-ml-drawer.aghi-ml-open { transform: translateX(0); }
      .aghi-ml-panel.aghi-ml-static.aghi-ml-hidden { transform: translateX(100%); }

      .aghi-ml-backdrop {
        position: fixed; inset: 0; background: rgba(8, 10, 15, 0.62);
        backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%);
        z-index: 999;
        opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
      }
      .aghi-ml-backdrop.aghi-ml-open { opacity: 1; pointer-events: auto; }

      body.aghi-ml-desktop-active { padding-right: var(--aghi-ml-width); transition: padding-right 0.28s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box; }
      html.aghi-ml-noscroll { overflow: hidden; }

      .aghi-ml-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 12px 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.09); flex-shrink: 0; }
      .aghi-ml-title { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #55F1F8; text-shadow: 0 0 14px rgba(85, 241, 248, 0.3); }
      .aghi-ml-header-btn { width: 30px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #AEB7C0; font-size: 14px; line-height: 1; cursor: pointer; transition: all 0.15s ease; }
      .aghi-ml-header-btn:hover { color: #F1F2F5; background: rgba(85, 241, 248, 0.1); border-color: rgba(85, 241, 248, 0.4); }

      .aghi-ml-search {
        margin: 10px 12px 8px; padding: 8px 12px 8px 32px;
        background: rgba(0, 0, 0, 0.35) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23767CA1' stroke-width='2' stroke-linecap='round'><circle cx='11' cy='11' r='7'/><line x1='21' y1='21' x2='16.5' y2='16.5'/></svg>") no-repeat 10px center;
        border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 9px;
        color: #F1F2F5; font-family: 'Inter', sans-serif; font-size: 13px; outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }
      .aghi-ml-search::placeholder { color: #767CA1; }
      .aghi-ml-search:focus { border-color: rgba(85, 241, 248, 0.4); box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.12); }

      .aghi-ml-body { flex: 1; overflow-y: auto; padding: 4px 8px 16px; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-ml-body::-webkit-scrollbar { width: 6px; }
      .aghi-ml-body::-webkit-scrollbar-track { background: transparent; }
      .aghi-ml-body::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }

      .aghi-ml-group { margin-top: 14px; }
      .aghi-ml-group-header { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0 8px 6px; }
      .aghi-ml-group-header::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: currentColor; box-shadow: 0 0 6px currentColor; }
      .aghi-ml-count { opacity: 0.6; font-family: 'JetBrains Mono', monospace; font-weight: 400; }

      .aghi-ml-user-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .aghi-ml-user { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; transition: background 0.15s ease; }
      .aghi-ml-user:hover { background: rgba(255, 255, 255, 0.06); }
      .aghi-ml-user.aghi-ml-dim { opacity: 0.45; }
      .aghi-ml-user.aghi-ml-dim:hover { opacity: 0.85; }

      .aghi-ml-avatar-wrap { position: relative; flex-shrink: 0; width: 36px; height: 36px; }
      .aghi-ml-avatar { width: 36px; height: 36px; border-radius: 50%; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); box-sizing: border-box; }
      .aghi-ml-avatar span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #F1F2F5; user-select: none; }
      .aghi-ml-presence-dot { position: absolute; bottom: -2px; right: -2px; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #14171e; box-sizing: content-box; }

      .aghi-ml-user-meta { display: flex; flex-direction: column; min-width: 0; }
      .aghi-ml-username-line { display:flex; align-items:center; min-width:0; }
      .aghi-ml-username { font-size: 13px; font-weight: 600; color: #F1F2F5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-verified-badge { position:relative; display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; margin-left:5px; border-radius:50%; background:#102b3a; border:1.5px solid #55F1F8; color:#55F1F8; font-size:10px; font-weight:900; line-height:1; vertical-align:1px; cursor:default; box-shadow:0 0 7px rgba(85,241,248,.35); }
      .aghi-verified-badge::after { content:attr(data-tooltip); position:absolute; z-index:10; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%) translateY(3px); width:max-content; max-width:170px; padding:6px 8px; border:1px solid rgba(85,241,248,.32); border-radius:6px; background:#0b1620; color:#e9fbfd; font:500 11px Inter,Arial,sans-serif; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .16s ease,transform .16s ease; box-shadow:0 5px 14px rgba(0,0,0,.28); }
      .aghi-verified-badge:hover::after,.aghi-verified-badge:focus-visible::after { opacity:1; transform:translateX(-50%) translateY(0); }
      .aghi-ml-status { font-size: 11px; color: #AEB7C0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .aghi-ml-empty { text-align: center; color: #767CA1; padding: 24px 10px; font-size: 12.5px; line-height: 1.5; }

      .aghi-ml-trigger { display: none; width: 38px; height: 38px; padding: 0; margin-right: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 9px; color: #AEB7C0; cursor: pointer; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; }
      .aghi-ml-trigger:hover { color: #F1F2F5; background: rgba(85, 241, 248, 0.1); border-color: rgba(85, 241, 248, 0.4); }
      .aghi-ml-trigger svg { width: 18px; height: 18px; }

      /* Pull-tab that reopens the collapsed desktop panel -- lives outside
         the panel itself so it never disappears along with it. */
      .aghi-ml-reopen-tab {
        position: fixed; top: 50%; right: 0; z-index: 480;
        transform: translateY(-50%) translateX(100%);
        background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99));
        color: #55F1F8; cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.11); border-right: none;
        border-radius: 10px 0 0 10px; padding: 14px 6px;
        font-family: 'JetBrains Mono', monospace; font-size: 14px;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: -12px 0 30px rgba(0, 0, 0, 0.45);
      }
      .aghi-ml-reopen-tab:hover { background: rgba(85, 241, 248, 0.1); }
      .aghi-ml-reopen-tab.aghi-ml-visible {
        opacity: 1; pointer-events: auto; transform: translateY(-50%) translateX(0);
      }

      @media (max-width: ${BREAKPOINT}px) {
        .aghi-ml-trigger { display: inline-flex; }
        .aghi-ml-panel.aghi-ml-static { display: none; }
        .aghi-ml-reopen-tab { display: none; }
        body.aghi-ml-desktop-active { padding-right: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .aghi-ml-panel, .aghi-ml-backdrop, .aghi-ml-reopen-tab, body.aghi-ml-desktop-active { transition: none !important; }
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
          <span class="aghi-ml-username-line"><span class="aghi-ml-username">${escapeHtml(user.username)}</span>${user.is_verified ? '<span class="aghi-verified-badge" data-tooltip="Verified at PCU" aria-label="Verified at PCU" tabindex="0">✓</span>' : ''}</span>
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
      const url = '/api/user-list.php' + (this.query ? `?q=${encodeURIComponent(this.query)}` : '');
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
