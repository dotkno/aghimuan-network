/**
 * emoji-picker-core.js
 *
 * Shared, reusable emoji picker: a categorized + searchable popover using
 * Twemoji graphics, with a "recently used" rail. It doesn't know or care
 * *why* an emoji was picked - callers pass a trigger button and an
 * onSelect(emoji) callback.
 *
 * Used by:
 *   - comment-reactions.js  (the "+" add-reaction button)
 *   - comments.js           (the emoji button in the comment/reply composer)
 *
 * Load this file BEFORE comment-reactions.js and comments.js.
 */
(function () {
  'use strict';

  if (window.AghiEmojiPicker) return; // already loaded

  const RECENT_KEY = 'agcr:recent';
  const RECENT_MAX = 24;
  const PICKER_WIDTH = 320;
  const PICKER_MAX_HEIGHT = 430;

  function getTwemojiUrl(emoji) {
    const codePoints = Array.from(emoji)
      .map((c) => c.codePointAt(0).toString(16))
      .filter((c) => c !== 'fe0f')
      .join('-');
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoints}.png`;
  }

  // ---- styles (picker chrome only - reaction pill styles live in comment-reactions.js) ----

  function injectStyles() {
    if (document.getElementById('aep-styles')) return;
    const style = document.createElement('style');
    style.id = 'aep-styles';
    style.textContent = `
      @keyframes cmrPickerIn {
        0% { transform: translateY(6px) scale(0.96); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      .cmr-picker {
        position: fixed;
        width: ${PICKER_WIDTH}px;
        max-height: ${PICKER_MAX_HEIGHT}px;
        display: flex;
        flex-direction: column;
        background: rgba(8, 16, 26, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(85, 241, 248, 0.35);
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(85, 241, 248, 0.15);
        z-index: 1600;
        overflow: hidden;
        font-family: 'Rajdhani', sans-serif;
        animation: cmrPickerIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .cmr-picker-search { padding: 10px 10px 8px; flex-shrink: 0; }
      .cmr-picker-search input {
        width: 100%;
        box-sizing: border-box;
        background: rgba(12, 22, 32, 0.85);
        border: 1px solid rgba(48, 150, 199, 0.35);
        border-radius: 10px;
        padding: 8px 12px;
        color: #F1F2F5;
        font-family: 'Rajdhani', sans-serif;
        font-size: 13.5px;
        outline: none;
        transition: all 0.2s ease;
      }
      .cmr-picker-search input:focus {
        border-color: #55F1F8;
        box-shadow: 0 0 10px rgba(85, 241, 248, 0.25);
        background: rgba(16, 30, 44, 0.95);
      }
      .cmr-picker-rail {
        display: flex;
        gap: 4px;
        padding: 0 10px 8px;
        border-bottom: 1px solid rgba(48, 150, 199, 0.18);
        overflow-x: auto;
        scrollbar-width: none;
        flex-shrink: 0;
      }
      .cmr-picker-rail::-webkit-scrollbar { display: none; }
      .cmr-rail-btn {
        background: none;
        border: none;
        font-size: 16px;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.18s ease;
        opacity: 0.7;
      }
      .cmr-rail-btn:hover {
        background: rgba(85, 241, 248, 0.15);
        opacity: 1;
        transform: translateY(-1px);
      }
      .cmr-picker-grid {
        flex: 1 1 auto;
        min-height: 120px;
        overflow-y: auto;
        padding: 6px 10px;
      }
      .cmr-picker-grid::-webkit-scrollbar { width: 5px; }
      .cmr-picker-grid::-webkit-scrollbar-thumb {
        background: rgba(85, 241, 248, 0.25);
        border-radius: 4px;
      }
      .cmr-picker-grid::-webkit-scrollbar-thumb:hover {
        background: rgba(85, 241, 248, 0.5);
      }
      .cmr-picker-section-header {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #55F1F8;
        padding: 10px 4px 6px;
        text-shadow: 0 0 8px rgba(85, 241, 248, 0.3);
      }
      .cmr-picker-cells {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 2px;
        content-visibility: auto;
        contain-intrinsic-size: 1px 180px;
      }
      .cmr-emoji-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        padding: 6px 0;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .cmr-emoji-cell:hover, .cmr-emoji-cell:focus-visible {
        background: rgba(85, 241, 248, 0.18);
        transform: scale(1.25);
        box-shadow: 0 0 10px rgba(85, 241, 248, 0.2);
      }
      .cmr-emoji-cell img {
        width: 22px;
        height: 22px;
        object-fit: contain;
        pointer-events: none;
        display: block;
      }
      .cmr-picker-footer {
        flex-shrink: 0;
        padding: 10px 12px 12px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
        color: #9ab0bd;
        border-top: 1px solid rgba(48, 150, 199, 0.18);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: rgba(6, 12, 20, 0.7);
      }
      @media (max-width: 560px) {
        .cmr-picker { width: min(${PICKER_WIDTH}px, calc(100vw - 16px)); }
        .cmr-picker-cells { grid-template-columns: repeat(7, 1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- emoji dataset (shared cache across every picker instance) ----

  let emojiDataPromise = null;
  function getEmojiData() {
    if (!emojiDataPromise) {
      emojiDataPromise = fetch('/api/emoji-data.php?v=2', { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((data) => (Array.isArray(data.categories) ? data : { categories: [] }))
        .catch(() => ({ categories: [] }));
    }
    return emojiDataPromise;
  }

  // ---- recently-used (shared between reactions and comment-text picks) ----

  function getRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function recordRecent(emoji) {
    try {
      let arr = getRecent().filter((e) => e !== emoji);
      arr.unshift(emoji);
      if (arr.length > RECENT_MAX) arr = arr.slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
    } catch (e) {
      // storage disabled
    }
  }

  // ---- picker instance ----

  let openPicker = null; // { el, trigger, onKey, id }
  let pickerSeq = 0;

  function closeOpenPicker() {
    if (!openPicker) return;
    openPicker.el.remove();
    document.removeEventListener('keydown', openPicker.onKey);
    openPicker = null;
  }

  function positionPicker(pop, triggerBtn) {
    const rect = triggerBtn.getBoundingClientRect();
    const pw = Math.min(PICKER_WIDTH, window.innerWidth - 16);
    const ph = PICKER_MAX_HEIGHT;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > window.innerHeight - 8) top = rect.top - ph - 6;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  /**
   * Opens the picker anchored to triggerBtn. Calling open() again with the
   * same triggerBtn toggles it closed. onSelect(emojiChar) fires on pick
   * (the picker closes itself after).
   */
  async function open(triggerBtn, onSelect) {
    if (openPicker && openPicker.trigger === triggerBtn) {
      closeOpenPicker();
      return;
    }
    closeOpenPicker();
    injectStyles();

    const id = ++pickerSeq;
    const pop = document.createElement('div');
    pop.className = 'cmr-picker';
    pop.innerHTML = `
      <div class="cmr-picker-search"><input type="text" placeholder="Search emoji" data-el="search" autocomplete="off" /></div>
      <div class="cmr-picker-rail" data-el="rail"></div>
      <div class="cmr-picker-grid" data-el="grid"></div>
      <div class="cmr-picker-footer" data-el="footer">&nbsp;</div>
    `;
    document.body.appendChild(pop);
    positionPicker(pop, triggerBtn);

    const gridEl = pop.querySelector('[data-el="grid"]');
    const railEl = pop.querySelector('[data-el="rail"]');
    const footerEl = pop.querySelector('[data-el="footer"]');
    const searchEl = pop.querySelector('[data-el="search"]');

    function onKey(e) {
      if (e.key === 'Escape') closeOpenPicker();
    }
    document.addEventListener('keydown', onKey);
    openPicker = { el: pop, trigger: triggerBtn, onKey, id };

    const data = await getEmojiData();
    if (!openPicker || openPicker.id !== id) return;
    const categories = data.categories || [];

    function emojiCell(item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmr-emoji-cell';
      btn.innerHTML = `<img src="${getTwemojiUrl(item.char)}" alt="${item.name}" loading="lazy" decoding="async" draggable="false" />`;
      btn.addEventListener('mouseenter', () => { footerEl.textContent = item.name; });
      btn.addEventListener('focus', () => { footerEl.textContent = item.name; });
      btn.addEventListener('click', () => {
        recordRecent(item.char);
        closeOpenPicker();
        onSelect(item.char);
      });
      return btn;
    }

    function buildSections(sections) {
      gridEl.innerHTML = '';
      const frag = document.createDocumentFragment();

      sections.forEach((section) => {
        if (!section.items || section.items.length === 0) return;
        const header = document.createElement('div');
        header.className = 'cmr-picker-section-header';
        header.textContent = section.label;
        header.id = `cmr-sec-${id}-${section.id}`;
        frag.appendChild(header);

        const cells = document.createElement('div');
        cells.className = 'cmr-picker-cells';
        const cellsFrag = document.createDocumentFragment();
        section.items.forEach((item) => cellsFrag.appendChild(emojiCell(item)));
        cells.appendChild(cellsFrag);
        frag.appendChild(cells);
      });

      gridEl.appendChild(frag);
    }

    const byChar = new Map();
    categories.forEach((c) => c.emoji.forEach((e) => byChar.set(e.char, e)));

    function renderDefault() {
      const sections = [];
      const recentChars = getRecent();
      if (recentChars.length > 0) {
        const items = recentChars.map((ch) => byChar.get(ch)).filter(Boolean);
        if (items.length > 0) sections.push({ id: 'recent', label: 'Recently Used', items });
      }
      categories.forEach((c) => sections.push({ id: c.id, label: c.label, items: c.emoji }));
      buildSections(sections);
    }

    function renderSearch(query) {
      const q = query.trim().toLowerCase();
      if (!q) { renderDefault(); return; }
      const matches = [];
      for (let i = 0; i < categories.length; i++) {
        const c = categories[i];
        for (let j = 0; j < c.emoji.length; j++) {
          const e = c.emoji[j];
          if (e.char === query || e.name.includes(q) || e.keywords.some((k) => k.includes(q))) {
            matches.push(e);
            if (matches.length >= 100) break;
          }
        }
        if (matches.length >= 100) break;
      }
      buildSections([{ id: 'results', label: matches.length ? 'Search Results' : 'No matches', items: matches }]);
    }

    const railSections = [{ id: 'recent', icon: '🕘', label: 'Recently Used' }].concat(
      categories.map((c) => ({ id: c.id, icon: c.icon, label: c.label }))
    );
    const railFrag = document.createDocumentFragment();
    railSections.forEach((s) => {
      if (s.id === 'recent' && getRecent().length === 0) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmr-rail-btn';
      btn.textContent = s.icon;
      btn.title = s.label;
      btn.addEventListener('click', () => {
        searchEl.value = '';
        renderDefault();
        const target = gridEl.querySelector(`#cmr-sec-${id}-${s.id}`);
        if (target) target.scrollIntoView({ block: 'start' });
      });
      railFrag.appendChild(btn);
    });
    railEl.appendChild(railFrag);

    let searchTimer = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderSearch(searchEl.value), 120);
    });

    renderDefault();

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) {
      searchEl.focus();
    }
  }

  // ---- outside-click / resize handling (bound once, shared) ----

  let delegationBound = false;
  function bindDelegation() {
    if (delegationBound) return;
    delegationBound = true;

    document.addEventListener('click', (e) => {
      if (!openPicker) return;
      if (openPicker.el.contains(e.target)) return;
      if (openPicker.trigger && openPicker.trigger.contains(e.target)) return;
      closeOpenPicker();
    });

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        if (openPicker) closeOpenPicker();
      }
    });
  }
  bindDelegation();

  window.AghiEmojiPicker = { open, close: closeOpenPicker, getTwemojiUrl, getEmojiData, getRecent, recordRecent };
})();