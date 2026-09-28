/* ============================================================
   AGHIMUAN LIBRARY — SHARED UTILITIES
   Loaded on every subject/grade page, before the engine scripts.
   ============================================================ */

(function (global) {
  const SUBJECT_THEME = {
    CP:  { name: 'Computer Programming',        color: '#55F1F8' },
    CSS: { name: 'Computer Systems Servicing',  color: '#3096C7' },
    MIL: { name: 'Media & Information Literacy', color: '#F1F2F5' },
    ET:  { name: 'Empowerment Technology',      color: '#55F1F8' },
    VGD: { name: 'Visual Graphics Design',      color: '#3096C7' },
  };

  /** Applies a subject's accent color to the --subject CSS variable,
   *  which every shared component (buttons, borders, progress bars) reads from. */
  function applySubjectTheme(code) {
    const theme = SUBJECT_THEME[code];
    if (!theme) return;
    document.documentElement.style.setProperty('--subject', theme.color);
    return theme;
  }

  /** Grade levels each subject actually has. Single-grade subjects (MIL, ET, VGD)
   *  should skip the grade-select screen entirely and go straight to their one page. */
  const SUBJECT_GRADES = {
    CP:  [11, 12],
    CSS: [11, 12],
    MIL: [12],
    ET:  [12],
    VGD: [11],
  };

  /** Builds the filename for a subject+grade page, e.g. gradeHref('CSS', 11) -> 'css-g11.php'. */
  function gradeHref(code, grade) {
    return code.toLowerCase() + '-g' + grade + '.php';
  }

  /** Where the back-nav pill should point when leaving a subject's topic explorer:
   *  grade-select.php for subjects with more than one grade, straight home otherwise. */
  function subjectBackHref(code) {
    const grades = SUBJECT_GRADES[code];
    if (grades && grades.length > 1) return 'grade-select.php?subject=' + code;
    return '../library-home.php';
  }

  /** Injects the standard "back to library" pill button. backHref defaults
   *  to the library home (reviewers.php one level up from /library/).
   *  If a container element is given, the pill is appended inline inside it
   *  (normal document flow, sits next to the title) instead of floating as
   *  a fixed overlay — use this on any page with its own header row so the
   *  pill can't sit on top of the title/crumb text. Omit the container on
   *  pages with no structured header (quiz/flashcard fullscreen engines etc.)
   *  to keep the old fixed top-left behavior. */
  function injectBackNav(backHref, label, container) {
    const a = document.createElement('a');
    a.href = backHref || '../library-home.php';
    a.innerHTML = '&#8592; ' + (label || 'LIBRARY');
    if (container) {
      a.className = 'lib-back-btn lib-back-btn--inline btn-neon';
      container.appendChild(a);
    } else {
      a.className = 'lib-back-btn btn-neon';
      document.body.appendChild(a);
    }
    return a;
  }

  /** Namespaced localStorage wrapper — safe no-op if storage is unavailable
   *  (private browsing, etc.) so the engines never throw over progress saves. */
  const LibraryProgress = {
    _ok: (() => { try { const k = '__aghilib_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } })(),
    get(key, fallback) {
      if (!this._ok) return fallback;
      try {
        const raw = localStorage.getItem('aghilib:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      if (!this._ok) return;
      try { localStorage.setItem('aghilib:' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  global.AghiLib = { SUBJECT_THEME, SUBJECT_GRADES, applySubjectTheme, gradeHref, subjectBackHref, injectBackNav, LibraryProgress, shuffle, clamp };
})(window);