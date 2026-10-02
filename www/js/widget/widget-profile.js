/**
 * widget-profile.js — account popup + settings editors for the split widget.
 *
 * Owns: buildPopup, buildMainView, buildSettingsView, renderMainStatus,
 * renderStatusEditor, renderMainAbout, renderAboutEditor, renderMainUsername,
 * renderUsernameEditor, renderPresenceSection, renderSubrolesSection,
 * renderVerificationSection, renderPfpSection, uploadImage,
 * renderBannerSection, rerenderPopup, saveProfile.
 * (respondToFriendRequest lives in widget-friends.js.)
 *
 * Contract: widget-core.js must load first (provides AccountWidget +
 * window.AghiWidgetUtil). Methods attach to the shared prototype; state
 * fields live in core. See widget-README.md for the load order.
 */
if (typeof AccountWidget === 'undefined' || !window.AghiWidgetUtil) {
  throw new Error('[widget-profile] widget-core.js must load before this file');
}

AccountWidget.prototype.buildPopup = function () {
  const popup = document.createElement('div');
  popup.className = 'aghi-aw-popup';
  popup.appendChild(this.settingsOpen ? this.buildSettingsView() : this.buildMainView());
  return popup;
};

// Identity display + quick actions. Editing lives in the Settings view
// (buildSettingsView) — Discord-style: the popout shows who you are, the
// gear/pencils jump into settings for the actual editing.
AccountWidget.prototype.buildMainView = function () {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  const mainRole = user.mainRole || user.role || 'MEMBER';
  const mainRoleStyle = U.getMainRoleStyle(mainRole);

  const main = document.createElement('div');
  main.className = 'aghi-aw-main';
  main.innerHTML = `
    <div class="aghi-aw-banner" data-action="open-settings" title="Change banner">
      <div class="aghi-aw-banner-hover">${U.CAMERA_ICON}<span>Change banner</span></div>
    </div>
    <div class="aghi-aw-popup-head-actions">
      <button type="button" class="aghi-aw-dm-icon-btn" data-action="open-settings" aria-label="Settings" title="Settings">${U.GEAR_ICON}</button>
      <button type="button" class="aghi-aw-dm-icon-btn" data-action="close" aria-label="Close">${U.X_ICON}</button>
    </div>
    <div class="aghi-aw-popup-body">
      <div class="aghi-aw-avatar-wrap" data-action="open-settings" title="Change avatar">
        <div class="aghi-aw-popup-avatar" data-el="popup-avatar"></div>
        <div class="aghi-aw-avatar-hover">${U.CAMERA_ICON}</div>
      </div>
      <div data-section="status"></div>
      <div data-section="username"></div>
      <span class="aghi-aw-role" style="${mainRoleStyle}">${U.escapeHtml(mainRole.toUpperCase())}</span>
      <div data-section="presence"></div>
      <div data-section="about"></div>
      <div data-section="subroles"></div>
      <button type="button" class="aghi-aw-logout" data-action="logout">Log out</button>
    </div>
  `;

  if (user.bannerId) {
    main.querySelector('.aghi-aw-banner').style.backgroundImage =
      `url('/uploads/banner/${encodeURIComponent(user.bannerId)}'), linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85))`;
  }

  U.applyAvatar(main.querySelector('[data-el="popup-avatar"]'), user.pfpId, user.username);
  // Own dot shows the real presence (invisible renders gray, like Discord).
  U.renderPresenceDot(main.querySelector('.aghi-aw-avatar-wrap'), { presence: user.presence, online: true });

  main.querySelector('[data-action="close"]').addEventListener('click', (e) => {
    e.stopPropagation();
    this.presenceMenuOpen = false;
    this.settingsOpen = false;
    this.animatePanelClose('popupOpen', '.aghi-aw-popup');
  });
  main.querySelectorAll('[data-action="open-settings"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsOpen = true;
      this.rerenderPopup();
    });
  });
  main.querySelector('[data-action="logout"]').addEventListener('click', () => {
    window.location.href = '/logout.php';
  });

  this.renderMainStatus(main.querySelector('[data-section="status"]'));
  this.renderMainUsername(main.querySelector('[data-section="username"]'));
  this.renderPresenceSection(main.querySelector('[data-section="presence"]'));
  this.renderMainAbout(main.querySelector('[data-section="about"]'));
  this.renderSubrolesSection(main.querySelector('[data-section="subroles"]'));

  return main;
};

// Settings sub-view: every profile editor in one scrollable place. All
// sections save through the existing saveProfile/uploadImage flows.
AccountWidget.prototype.buildSettingsView = function () {
  const U = AghiWidgetUtil;
  const view = document.createElement('div');
  view.className = 'aghi-aw-settings';
  view.innerHTML = `
    <div class="aghi-aw-settings-head">
      <button type="button" class="aghi-aw-dm-icon-btn" data-action="back" aria-label="Back to profile">${U.BACK_ICON}</button>
      <h2 class="aghi-aw-panel-title">Settings</h2>
    </div>
    <div class="aghi-aw-settings-body">
      <div class="aghi-aw-settings-section" data-section="avatar"></div>
      <div class="aghi-aw-settings-section" data-section="banner"></div>
      <div class="aghi-aw-settings-section" data-section="status"></div>
      <div class="aghi-aw-settings-section" data-section="about"></div>
      <div class="aghi-aw-settings-section" data-section="username"></div>
      <div class="aghi-aw-settings-section" data-section="verification"></div>
    </div>
  `;

  view.querySelector('[data-action="back"]').addEventListener('click', (e) => {
    e.stopPropagation();
    this.settingsOpen = false;
    this.rerenderPopup();
  });

  this.renderPfpSection(view.querySelector('[data-section="avatar"]'));
  this.renderBannerSection(view.querySelector('[data-section="banner"]'));
  this.renderStatusEditor(view.querySelector('[data-section="status"]'));
  this.renderAboutEditor(view.querySelector('[data-section="about"]'));
  this.renderUsernameEditor(view.querySelector('[data-section="username"]'));
  this.renderVerificationSection(view.querySelector('[data-section="verification"]'));

  return view;
};

// Firebase is deliberately imported only after the member asks to verify:
// ordinary browsing and account editing do not pay for the auth SDK.
AccountWidget.prototype.renderVerificationSection = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  if (user.is_verified) {
    el.innerHTML = `
      <div class="aghi-aw-about-label">Verification</div>
      <div class="aghi-aw-upload-hint" style="text-align:left;color:#55F1F8">✓ Verified at PCU${user.email ? ` · ${U.escapeHtml(user.email)}` : ''}</div>`;
    return;
  }
  el.innerHTML = `
    <div class="aghi-aw-about-label">Verification</div>
    <div class="aghi-aw-upload-hint" style="text-align:left;margin:0 0 8px">Verify with your @pcu.edu.ph account to unlock Creations submissions.</div>
    <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="verify">Verify with PCU</button>
    <div class="aghi-aw-error" hidden></div>`;
  el.querySelector('[data-action="verify"]').addEventListener('click', async () => {
    const button = el.querySelector('[data-action="verify"]');
    const errorEl = el.querySelector('.aghi-aw-error');
    button.disabled = true;
    button.textContent = 'Opening Google…';
    try {
      const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
      ]);
      const config = (window.AGHI_CONFIG && window.AGHI_CONFIG.firebase) || { apiKey: 'AIzaSyAavb6fsEoM2r55AIFG2uHZAOQBg2YPGIE', authDomain: 'aghimuan-network.firebaseapp.com', projectId: 'aghimuan-network' };
      const app = getApps().length ? getApps()[0] : initializeApp(config);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'pcu.edu.ph' });
      const result = await signInWithPopup(getAuth(app), provider);
      const idToken = await result.user.getIdToken();
      const response = await fetch('/api/verify-firebase.php', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, csrf_token: this.state.csrfToken }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error === 'verification_failed' ? 'Please choose a verified @pcu.edu.ph account.' : (data.error || 'Verification failed.'));
      this.state.user = { ...this.state.user, is_verified: true, email: data.email };
      this.rerenderPopup();
    } catch (err) {
      errorEl.textContent = err && err.message ? err.message : 'Verification failed. Try again.';
      errorEl.hidden = false;
      button.disabled = false;
      button.textContent = 'Verify with PCU';
    }
  });
};

AccountWidget.prototype.renderSubrolesSection = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  let subrolesHtml = '';

  // Preset officer/adviser/committee sub-role (e.g. "President", "Faculty")
  // — was being stored and returned by the API, but this function never
  // read it, so it was the only badge that never appeared in the widget.
  if (user.subRole) {
    subrolesHtml += `<span class="aghi-aw-subrole-badge" style="background:#1e88e5;color:#fff;">${U.escapeHtml(user.subRole)}</span>`;
  }
  if (user.club) {
    const style = U.SUBROLE_STYLES[user.club] || 'background:#3096C7;color:#fff;';
    subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${U.escapeHtml(user.club)}</span>`;
  }
  if (user.grade) {
    const style = U.SUBROLE_STYLES[user.grade] || 'background:#455a64;color:#fff;';
    subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${U.escapeHtml(user.grade)}</span>`;
  }
  if (user.strand) {
    const style = U.SUBROLE_STYLES[user.strand] || 'background:#3096C7;color:#fff;';
    subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${U.escapeHtml(user.strand)}</span>`;
  }
  // Discord-style custom roles, assigned via admin.php's Users tab — same
  // field this function never read, so these never showed up either.
  if (Array.isArray(user.customRoles)) {
    user.customRoles.forEach((role) => {
      const style = `background:${role.color_css};color:${role.text_color};`;
      subrolesHtml += `<span class="aghi-aw-subrole-badge" style="${style}">${U.escapeHtml(role.name)}</span>`;
    });
  }
 
  el.innerHTML = subrolesHtml ? `<div class="aghi-aw-subroles-row">${subrolesHtml}</div>` : '';
};

AccountWidget.prototype.renderMainStatus = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  el.innerHTML = `
    <div class="aghi-aw-status-row" data-action="open-settings" title="Edit status">
      <span class="aghi-aw-status-text ${user.status ? '' : 'aghi-aw-empty'}"></span>
      <span class="aghi-aw-row-pencil">${U.PENCIL_ICON}</span>
    </div>
  `;
  el.querySelector('.aghi-aw-status-text').textContent = user.status || 'Set a status…';
  el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
    e.stopPropagation();
    this.settingsOpen = true;
    this.rerenderPopup();
  });
};

AccountWidget.prototype.renderStatusEditor = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  el.innerHTML = `
    <div class="aghi-aw-about-label">Status</div>
    <textarea class="aghi-aw-textarea" rows="2" maxlength="${U.MAX_STATUS_LENGTH}" placeholder="What have you been up to?">${U.escapeHtml(user.status)}</textarea>
    <div class="aghi-aw-charcount">0/${U.MAX_STATUS_LENGTH}</div>
    <div class="aghi-aw-edit-actions">
      <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
      <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
    </div>
    <div class="aghi-aw-error" hidden></div>
  `;
  const textarea = el.querySelector('textarea');
  const count = el.querySelector('.aghi-aw-charcount');
  const updateCount = () => { count.textContent = `${textarea.value.length}/${U.MAX_STATUS_LENGTH}`; };
  updateCount();
  textarea.addEventListener('input', updateCount);
  el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    textarea.value = user.status;
    updateCount();
  });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    this.saveProfile({ status: textarea.value }, el);
  });
};

AccountWidget.prototype.renderMainAbout = function (el) {
  const user = this.state.user;
  el.innerHTML = `
    <div class="aghi-aw-main-section" data-action="open-settings" title="Edit about">
      <div class="aghi-aw-about-label">About Me</div>
      <div class="aghi-aw-about-text ${user.bio ? '' : 'aghi-aw-empty'}"></div>
    </div>
  `;
  el.querySelector('.aghi-aw-about-text').textContent = user.bio || 'Add a bio…';
  el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
    e.stopPropagation();
    this.settingsOpen = true;
    this.rerenderPopup();
  });
};

AccountWidget.prototype.renderAboutEditor = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  el.innerHTML = `
    <div class="aghi-aw-about-label">About Me</div>
    <textarea class="aghi-aw-textarea" rows="3" maxlength="${U.MAX_BIO_LENGTH}" placeholder="Tell people a bit about yourself…">${U.escapeHtml(user.bio)}</textarea>
    <div class="aghi-aw-charcount">0/${U.MAX_BIO_LENGTH}</div>
    <div class="aghi-aw-edit-actions">
      <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
      <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
    </div>
    <div class="aghi-aw-error" hidden></div>
  `;
  const textarea = el.querySelector('textarea');
  const count = el.querySelector('.aghi-aw-charcount');
  const updateCount = () => { count.textContent = `${textarea.value.length}/${U.MAX_BIO_LENGTH}`; };
  updateCount();
  textarea.addEventListener('input', updateCount);
  el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    textarea.value = user.bio;
    updateCount();
  });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    this.saveProfile({ bio: textarea.value }, el);
  });
};

AccountWidget.prototype.renderMainUsername = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  const daysLeft = U.daysUntil(user.usernameChangeAvailableAt);
  const locked = daysLeft > 0;

  el.innerHTML = `
    <div class="aghi-aw-username-row ${locked ? 'aghi-aw-locked' : ''}" data-action="open-settings">
      <p class="aghi-aw-username">${U.escapeHtml(user.username)}</p>
      <span class="aghi-aw-username-edit-icon" title="${locked ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Change username'}">${U.PENCIL_ICON}</span>
    </div>
  `;
  el.querySelector('[data-action="open-settings"]').addEventListener('click', (e) => {
    e.stopPropagation();
    this.settingsOpen = true;
    this.rerenderPopup();
  });
};

AccountWidget.prototype.renderUsernameEditor = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  const daysLeft = U.daysUntil(user.usernameChangeAvailableAt);
  const locked = daysLeft > 0;

  el.innerHTML = `
    <div class="aghi-aw-about-label">Username</div>
    <input type="text" class="aghi-aw-input" maxlength="20" value="${U.escapeHtml(user.username)}" placeholder="New username" ${locked ? 'disabled' : ''}>
    ${locked ? `<div class="aghi-aw-upload-hint" style="text-align:left; margin: 4px 0 0;">You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.</div>` : `
    <div class="aghi-aw-edit-actions">
      <button type="button" class="aghi-aw-btn aghi-aw-btn-cancel" data-action="cancel">Cancel</button>
      <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="save">Save</button>
    </div>`}
    <div class="aghi-aw-error" hidden></div>
  `;
  if (locked) return;

  const input = el.querySelector('input');
  el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    input.value = user.username;
  });
  el.querySelector('[data-action="save"]').addEventListener('click', () => {
    const value = input.value.trim();
    const errorEl = el.querySelector('.aghi-aw-error');
    if (!U.USERNAME_PATTERN.test(value)) {
      errorEl.textContent = 'Username must be 3-20 characters: letters, numbers, and underscores only.';
      errorEl.hidden = false;
      return;
    }
    this.saveProfile({ username: value }, el);
  });
};

AccountWidget.prototype.renderPresenceSection = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  const current = U.presenceInfo(user.presence);

  el.innerHTML = `
    <button type="button" class="aghi-aw-presence-btn" data-action="toggle">
      <span class="aghi-aw-presence-dot" style="background:${current.color};box-shadow:0 0 6px ${current.color}"></span>
      <span class="aghi-aw-presence-label">${current.label}</span>
      <span class="aghi-aw-presence-chevron">${U.CHEVRON_ICON}</span>
    </button>
  `;
  const btn = el.querySelector('[data-action="toggle"]');
  this.presenceBtnEl = btn;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.presenceMenuOpen = !this.presenceMenuOpen;
    this.rerenderPopup();
  });

  if (this.presenceMenuOpen) {
    const menu = document.createElement('div');
    menu.className = 'aghi-aw-presence-menu';
    menu.innerHTML = U.PRESENCE_OPTIONS.map((p) => `
      <button type="button" class="aghi-aw-presence-option ${p.id === user.presence ? 'aghi-aw-selected' : ''}" data-presence="${p.id}">
        <span class="aghi-aw-presence-dot" style="background:${p.color}"></span>
        <span>${p.label}</span>
      </button>
    `).join('');
    el.appendChild(menu);
    this.presenceMenuEl = menu;
    menu.querySelectorAll('[data-presence]').forEach((optBtn) => {
      optBtn.addEventListener('click', () => {
        this.presenceMenuOpen = false;
        this.saveProfile({ presence: optBtn.getAttribute('data-presence') }, el);
      });
    });
  } else {
    this.presenceMenuEl = null;
  }
};

AccountWidget.prototype.renderPfpSection = function (el) {
  const U = AghiWidgetUtil;
  const user = this.state.user;
  const swatches = U.PFP_PRESETS.map((p) => `
    <button type="button" class="aghi-aw-pfp-option ${p.id === user.pfpId ? 'aghi-aw-selected' : ''}"
      style="background-color:${p.color}" data-pfp="${p.id}" aria-label="Use ${p.id} color"></button>
  `).join('');

  el.innerHTML = `
    <div class="aghi-aw-about-label">Avatar</div>
    <label class="aghi-aw-upload-label">
      Upload photo
      <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-action="file-input">
    </label>
    <div class="aghi-aw-upload-hint">JPEG, PNG, or WebP — max 2MB</div>
    ${U.isCustomAvatar(user.pfpId) ? '<button type="button" class="aghi-aw-reset-link" data-action="reset">Remove photo, use a color instead</button>' : ''}
    <div class="aghi-aw-pfp-grid">${swatches}</div>
    <div class="aghi-aw-error" hidden></div>
  `;

  el.querySelectorAll('[data-pfp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      this.saveProfile({ pfpId: btn.getAttribute('data-pfp') }, el);
    });
  });

  const resetBtn = el.querySelector('[data-action="reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      this.saveProfile({ pfpId: 'default' }, el);
    });
  }

  el.querySelector('[data-action="file-input"]').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) {
      U.openImageAdjustModal({
        file,
        kind: 'avatar',
        onApply: (cropped) => this.uploadImage(cropped, 'avatar', el),
      });
    }
  });
};

// kind: 'avatar' | 'banner' — mirrors upload-avatar.php's kind field.
// The response profile patch flows into state.user either way (pfpId or
// bannerId), and the popup rebuilds so previews update live.
AccountWidget.prototype.uploadImage = async function (file, kind, sectionEl) {
  const U = AghiWidgetUtil;
  const errorEl = sectionEl.querySelector('.aghi-aw-error');
  if (errorEl) errorEl.hidden = true;

  if (file.size > U.MAX_AVATAR_BYTES) {
    if (errorEl) { errorEl.textContent = 'Image is too large (max 2MB).'; errorEl.hidden = false; }
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('kind', kind);
  formData.append('csrf_token', this.state.csrfToken);

  try {
    const res = await fetch('/api/upload-avatar.php', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Upload failed.');
    }
    this.state.user = { ...this.state.user, ...data.profile };
    this.rerenderPopup();
    const avatarBtn = this.mount.querySelector('.aghi-aw-avatar-btn');
    if (avatarBtn && data.profile.pfpId) U.applyAvatar(avatarBtn, this.state.user.pfpId, this.state.user.username);
  } catch (e) {
    if (errorEl) {
      errorEl.textContent = e.message || 'Upload failed. Try again.';
      errorEl.hidden = false;
    }
  }
};

AccountWidget.prototype.renderBannerSection = function (el) {
  const user = this.state.user;
  // Banners are a verified-members perk — unverified accounts get a locked
  // section pointing at verification instead of the uploader.
  if (!user.is_verified) {
    el.innerHTML = `
      <div class="aghi-aw-about-label">Banner</div>
      <div class="aghi-aw-upload-hint" style="text-align:left;margin:0 0 8px">Profile banners unlock after PCU verification — it keeps club spaces identifiably ours.</div>
      <button type="button" class="aghi-aw-btn aghi-aw-btn-save" data-action="goto-verify">Verify to unlock</button>`;
    el.querySelector('[data-action="goto-verify"]').addEventListener('click', () => {
      const v = document.querySelector('[data-section="verification"]');
      if (v) {
        v.scrollIntoView({ behavior: 'smooth', block: 'center' });
        v.style.transition = 'box-shadow .3s ease';
        v.style.boxShadow = '0 0 0 2px rgba(85,241,248,.6)';
        setTimeout(() => { v.style.boxShadow = ''; }, 1400);
      }
    });
    return;
  }
  el.innerHTML = `
    <div class="aghi-aw-about-label">Banner</div>
    <div class="aghi-aw-banner-preview" data-el="banner-preview">${user.bannerId ? '' : 'No banner yet'}</div>
    <label class="aghi-aw-upload-label">
      Upload banner
      <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-action="banner-input">
    </label>
    ${user.bannerId ? '<button type="button" class="aghi-aw-reset-link" data-action="remove-banner">Remove banner</button>' : ''}
    <div class="aghi-aw-upload-hint">JPEG, PNG, or WebP — max 2MB, center-cropped to 4:1</div>
    <div class="aghi-aw-error" hidden></div>
  `;
  const preview = el.querySelector('[data-el="banner-preview"]');
  if (user.bannerId) {
    preview.style.backgroundImage =
      `url('/uploads/banner/${encodeURIComponent(user.bannerId)}'), linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85))`;
  }
  el.querySelector('[data-action="banner-input"]').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) {
      AghiWidgetUtil.openImageAdjustModal({
        file,
        kind: 'banner',
        onApply: (cropped) => this.uploadImage(cropped, 'banner', el),
      });
    }
  });
  const removeBtn = el.querySelector('[data-action="remove-banner"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      this.saveProfile({ bannerId: null }, el);
    });
  }
};

AccountWidget.prototype.rerenderPopup = function () {
  if (!this.popupOpen) return;
  const existing = document.querySelector('.aghi-aw-popup');
  const fresh = this.buildPopup();
  // On mobile the popup is a bottom sheet on <body> — rebuilding into the
  // topbar mount would spawn an invisible orphan behind the sheet while the
  // sheet keeps showing stale content (settings/remove-banner "not working").
  const targetParent = window.matchMedia('(max-width: 768px)').matches ? document.body : this.mount;
  if (existing && existing.parentElement === targetParent) {
    existing.replaceWith(fresh);
  } else {
    if (existing) existing.remove();
    targetParent.appendChild(fresh);
  }
};

AccountWidget.prototype.saveProfile = async function (patch, sectionEl) {
  const U = AghiWidgetUtil;
  const errorEl = sectionEl.querySelector('.aghi-aw-error');
  try {
    const res = await fetch('/api/profile.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ csrf_token: this.state.csrfToken }, patch)),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }
    this.state.user = { ...this.state.user, ...data.profile };
    this.rerenderPopup();
    const avatarBtn = this.mount.querySelector('.aghi-aw-avatar-btn');
    if (avatarBtn) U.applyAvatar(avatarBtn, this.state.user.pfpId, this.state.user.username);
  } catch (e) {
    if (errorEl) {
      errorEl.textContent = e.message || 'Failed to save. Try again.';
      errorEl.hidden = false;
    }
  }
};

// Boot lives here (last file in the load order) and not in widget-core.js
// on purpose: deferred scripts run while document.readyState is already
// 'interactive', so a boot call inside core would execute before the other
// nine files arrive (this exact bug killed the widget on first deploy —
// AghiWidgetUtil.injectStyles did not exist yet). Here, document order
// guarantees every module ran first; the readyState check then covers all
// cases (loading → wait for DOMContentLoaded, anything else → boot now).
(function () {
  'use strict';

  function boot() {
    AghiWidgetUtil.injectStyles();
    const mount = document.getElementById('aghi-account-widget');
    if (!mount) return;
    const widget = new AccountWidget(mount);
    widget.init();

    // Lets other widget-independent scripts (e.g. a "Message" button in
    // user-profile-popup.js) open a DM thread without duplicating the
    // panel/polling logic above.
    window.AghiAccountWidget = {
      openDm(userId, username, pfpId) {
        widget.popupOpen = false;
        widget.inboxOpen = false;
        widget.dmOpen = true;
        widget.render();
        widget.openDmThread({ id: userId, username, pfpId: pfpId || 'default' }, true);
      },
      isLoggedIn() {
        return !!(widget.state && widget.state.loggedIn);
      },
      getCurrentUserId() {
        return widget.state && widget.state.loggedIn && widget.state.user ? widget.state.user.id : null;
      },
      // user-profile-popup.js has been calling this since before it was
      // actually exported — exporting it removes their silent fallback path.
      getCsrfToken() {
        return widget.state ? widget.state.csrfToken : null;
      },
      // themed confirm dialog shared with user-profile-popup.js (unfriend).
      // resolves true/false and closes on backdrop click, Escape, or Enter.
      showConfirmModal(title, message, confirmLabel) {
        return AghiWidgetUtil.showConfirmModal(title, message, confirmLabel);
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
