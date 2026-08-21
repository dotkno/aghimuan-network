/* ============================================================
   AGHIMUAN LIBRARY — CODE DRILL ENGINE
   Typing-based, pattern-checked Java exercises.
   No JVM — structural pattern checks presented as fake
   javac-style compiler output, so it *feels* like compiling.

   Usage (matches FlashcardEngine / QuizEngine / SimEngine):
     CodeDrillEngine.init(mount, section.drills, {
       title: section.title,
       storageKey: section.storageKey,
       backHref: backHref,
     });

   Drill shape:
     {
       id: 'declare-int',
       title: 'Declare a Variable',
       prompt: 'Declare a variable named `age`...',
       starter: '',                 // pre-filled code, optional
       filename: 'Practice.java',   // shown in the fake file tab, optional
       checks: [
         { id: 'has-type', label: 'int, short, byte, or long used',
           errorLabel: "error: no integer type found",
           test: code => /\b(int|short|byte|long)\b/.test(code) },
         ...
       ],
       hints: ['...'],                   // optional, revealed one at a time
       successOutput: ['Hello, Java!'],  // lines "printed" on success, optional
     }
   ============================================================ */

(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function countChar(str, ch) {
    let n = 0;
    for (let i = 0; i < str.length; i++) if (str[i] === ch) n++;
    return n;
  }

  /* ---------------- smart editor behavior (auto-indent, auto-close) ---------------- */

  const OPEN_TO_CLOSE = { '(': ')', '[': ']', '{': '}' };
  const CLOSE_CHARS = { ')': true, ']': true, '}': true };

  function getLineStart(value, pos) {
    return value.lastIndexOf('\n', pos - 1) + 1;
  }

  function getIndent(line) {
    const m = line.match(/^[ \t]*/);
    return m ? m[0] : '';
  }

  function setValueAndCaret(textarea, value, caretStart, caretEnd) {
    textarea.value = value;
    textarea.selectionStart = caretStart;
    textarea.selectionEnd = caretEnd == null ? caretStart : caretEnd;
    textarea.dispatchEvent(new Event('input'));
  }

  /* Enter: match the current line's indent, add one level after an
     opening bracket, and split a just-typed empty pair (e.g. `{|}`)
     across two lines with the closing bracket auto-dedented — the
     same behavior VS Code / IntelliJ use. */
  function handleEnterKey(e, textarea) {
    e.preventDefault();
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lineStart = getLineStart(value, start);
    const currentLine = before.slice(lineStart);
    const indent = getIndent(currentLine);
    const lastChar = currentLine.trim().slice(-1);
    const nextChar = after.charAt(0);
    const opensBlock = lastChar === '{' || lastChar === '(' || lastChar === '[';
    const closesBlock =
      (lastChar === '{' && nextChar === '}') ||
      (lastChar === '(' && nextChar === ')') ||
      (lastChar === '[' && nextChar === ']');

    if (opensBlock && closesBlock) {
      const inner = '\n' + indent + '    ';
      const closing = '\n' + indent;
      setValueAndCaret(textarea, before + inner + closing + after, start + inner.length);
      return;
    }

    const insertion = '\n' + indent + (opensBlock ? '    ' : '');
    setValueAndCaret(textarea, before + insertion + after, start + insertion.length);
  }

  /* Typing an opening bracket/quote inserts the matching close and
     places the caret between them; typing over a selection wraps it. */
  function handleOpenPairKey(e, textarea, openChar, closeChar) {
    e.preventDefault();
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      const selected = value.slice(start, end);
      setValueAndCaret(
        textarea,
        value.slice(0, start) + openChar + selected + closeChar + value.slice(end),
        start + 1,
        end + 1
      );
      return;
    }
    setValueAndCaret(textarea, value.slice(0, start) + openChar + closeChar + value.slice(end), start + 1);
  }

  /* Typing a closing bracket/quote that's already right there just
     moves the caret past it instead of inserting a duplicate. A `}`
     on an otherwise-blank line also auto-dedents one level first. */
  function handleClosePairKey(e, textarea, closeChar) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) return;
    const value = textarea.value;

    if (value.charAt(start) === closeChar) {
      e.preventDefault();
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      return;
    }

    if (closeChar === '}') {
      const lineStart = getLineStart(value, start);
      const linePrefix = value.slice(lineStart, start);
      if (/^[ \t]*$/.test(linePrefix)) {
        e.preventDefault();
        const dedented = linePrefix.replace(/^ {1,4}/, '');
        setValueAndCaret(
          textarea,
          value.slice(0, lineStart) + dedented + closeChar + value.slice(start),
          lineStart + dedented.length + 1
        );
      }
    }
  }

  /* Backspace right between an auto-closed empty pair (e.g. `(|)`)
     deletes both characters together instead of just the open one. */
  function handleBackspaceKey(e, textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end || start === 0) return;
    const value = textarea.value;
    const before = value.charAt(start - 1);
    const after = value.charAt(start);
    if (OPEN_TO_CLOSE[before] === after) {
      e.preventDefault();
      setValueAndCaret(textarea, value.slice(0, start - 1) + value.slice(start + 1), start - 1);
    }
  }

  /* Tab / Shift+Tab: indent or outdent the current line, or every
     line touched by a multi-line selection. */
  function handleTabKey(e, textarea, outdent) {
    e.preventDefault();
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const selStart = getLineStart(value, start);

    if (!hasSelection) {
      if (!outdent) {
        setValueAndCaret(textarea, value.slice(0, start) + '    ' + value.slice(end), start + 4);
        return;
      }
      const line = value.slice(selStart, start);
      const m = line.match(/^( {1,4}|\t)/);
      if (m) {
        setValueAndCaret(
          textarea,
          value.slice(0, selStart) + line.slice(m[0].length) + value.slice(start),
          Math.max(selStart, start - m[0].length)
        );
      }
      return;
    }

    const selEnd = end;
    const block = value.slice(selStart, selEnd);
    const lines = block.split('\n');
    let firstLineDelta = 0;
    const newLines = lines.map((line, i) => {
      if (!outdent) {
        if (i === 0) firstLineDelta = 4;
        return '    ' + line;
      }
      const m = line.match(/^( {1,4}|\t)/);
      const removed = m ? m[0].length : 0;
      if (i === 0) firstLineDelta = -removed;
      return m ? line.slice(removed) : line;
    });
    const newBlock = newLines.join('\n');
    setValueAndCaret(textarea, value.slice(0, selStart) + newBlock + value.slice(selEnd), selStart, selStart + newBlock.length);
  }


  /* Code drills intentionally do NOT persist across a page reload —
     progress lives only in memory for the current page view, so a
     refresh always starts every drill from its starter code. */
  function loadProgress() {
    return {};
  }

  function saveProgress() {
    /* no-op by design */
  }

  function buildDrillDOM(drill, index, total) {
    const wrap = document.createElement('div');
    wrap.className = 'acd-drill';

    wrap.innerHTML = `
      <div class="acd-head">
        <span class="acd-badge">DRILL ${index + 1} / ${total}</span>
        <span class="acd-drill-title">${escapeHtml(drill.title || '')}</span>
      </div>
      <p class="acd-prompt">${drill.prompt || ''}</p>

      <div class="acd-editor-frame">
        <div class="acd-tab-bar">
          <span class="acd-tab">${escapeHtml(drill.filename || 'Practice.java')}</span>
        </div>
        <div class="acd-editor-body">
          <div class="acd-gutter" aria-hidden="true"></div>
          <textarea class="acd-editor" spellcheck="false" autocapitalize="off"
            autocomplete="off" autocorrect="off"
            placeholder="// start typing here"></textarea>
        </div>
      </div>

      <div class="acd-terminal">
        <div class="acd-terminal-head">
          <span class="acd-dot acd-dot-r"></span><span class="acd-dot acd-dot-y"></span><span class="acd-dot acd-dot-g"></span>
          <span class="acd-terminal-label">javac — build output</span>
        </div>
        <ul class="acd-checklist"></ul>
        <div class="acd-console" hidden></div>
      </div>

      <div class="acd-controls">
        <button type="button" class="acd-btn acd-btn-ghost acd-reset">Reset</button>
        <button type="button" class="acd-btn acd-btn-hint">Hint</button>
        <span class="acd-status"></span>
        <button type="button" class="acd-btn acd-btn-next" hidden>Next Drill →</button>
        <a href="#" class="acd-btn acd-finish" hidden>Back to Topics →</a>
      </div>
    `;
    return wrap;
  }

  function CodeDrillSection(container, options) {
    const drills = options.drills || [];
    const storageKey = options.storageKey || null;
    const title = options.title || '';
    const backHref = options.backHref || null;
    const progress = loadProgress(storageKey);
    let current = 0;

    container.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'acd-shell';
    container.appendChild(shell);

    if (title) {
      const heading = document.createElement('h2');
      heading.className = 'acd-section-title';
      heading.textContent = title;
      shell.appendChild(heading);
    }

    const drillMount = document.createElement('div');
    shell.appendChild(drillMount);

    function render() {
      drillMount.innerHTML = '';
      const drill = drills[current];
      if (!drill) return;

      const dom = buildDrillDOM(drill, current, drills.length);
      drillMount.appendChild(dom);

      const textarea = dom.querySelector('.acd-editor');
      const gutter = dom.querySelector('.acd-gutter');
      const checklist = dom.querySelector('.acd-checklist');
      const consoleEl = dom.querySelector('.acd-console');
      const statusEl = dom.querySelector('.acd-status');
      const nextBtn = dom.querySelector('.acd-btn-next');
      const resetBtn = dom.querySelector('.acd-reset');
      const hintBtn = dom.querySelector('.acd-btn-hint');
      const finishEl = dom.querySelector('.acd-finish');

      const savedCode = (progress[drill.id] && progress[drill.id].code) || drill.starter || '';
      textarea.value = savedCode;

      let hintsShown = 0;
      let solved = !!(progress[drill.id] && progress[drill.id].solved);

      function updateGutter() {
        const lines = textarea.value.split('\n').length;
        let out = '';
        for (let i = 1; i <= Math.max(lines, 6); i++) out += i + '\n';
        gutter.textContent = out;
      }

      function runChecks() {
        const code = textarea.value;
        const results = (drill.checks || []).map((check) => ({
          check,
          pass: !!check.test(code),
        }));
        checklist.innerHTML = results
          .map(
            (r) => `
            <li class="acd-check ${r.pass ? 'is-pass' : 'is-fail'}">
              <span class="acd-check-icon">${r.pass ? '✓' : '✗'}</span>
              <span class="acd-check-text">${
                r.pass
                  ? escapeHtml(r.check.label)
                  : escapeHtml(r.check.errorLabel || r.check.label)
              }</span>
            </li>`
          )
          .join('');

        const braceBalance = countChar(code, '{') === countChar(code, '}') || !/[{}]/.test(code);
        const allPass = results.length > 0 && results.every((r) => r.pass) && braceBalance;
        const isLastDrill = current >= drills.length - 1;

        if (allPass) {
          solved = true;
          statusEl.textContent = isLastDrill ? 'BUILD SUCCESSFUL — all drills complete' : 'BUILD SUCCESSFUL';
          statusEl.className = 'acd-status is-success';
          nextBtn.hidden = isLastDrill;
          if (isLastDrill && backHref) {
            finishEl.href = backHref;
            finishEl.hidden = false;
          } else {
            finishEl.hidden = true;
          }
          if (drill.successOutput && drill.successOutput.length) {
            consoleEl.hidden = false;
            consoleEl.innerHTML =
              '<div class="acd-console-label">$ java ' +
              escapeHtml((drill.filename || 'Practice.java').replace(/\.java$/, '')) +
              '</div>' +
              drill.successOutput
                .map((line) => `<div class="acd-console-line">${escapeHtml(line)}</div>`)
                .join('');
          } else {
            consoleEl.hidden = true;
          }
        } else {
          solved = false;
          statusEl.textContent = code.trim() ? 'BUILD FAILED' : '';
          statusEl.className = 'acd-status is-fail';
          nextBtn.hidden = true;
          finishEl.hidden = true;
          consoleEl.hidden = true;
        }

        progress[drill.id] = { code, solved };
        saveProgress(storageKey, progress);
      }

      let debounceTimer = null;
      textarea.addEventListener('input', () => {
        updateGutter();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runChecks, 250);
      });
      textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
      });
      textarea.addEventListener('keydown', (e) => {
        const key = e.key;

        if (key === 'Tab') {
          handleTabKey(e, textarea, e.shiftKey);
          return;
        }
        if (key === 'Enter') {
          handleEnterKey(e, textarea);
          return;
        }
        if (key === 'Backspace') {
          handleBackspaceKey(e, textarea);
          return;
        }
        if (key === '"' || key === "'") {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          if (start === end && textarea.value.charAt(start) === key) {
            e.preventDefault();
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            return;
          }
          handleOpenPairKey(e, textarea, key, key);
          return;
        }
        if (OPEN_TO_CLOSE[key]) {
          handleOpenPairKey(e, textarea, key, OPEN_TO_CLOSE[key]);
          return;
        }
        if (CLOSE_CHARS[key]) {
          handleClosePairKey(e, textarea, key);
          return;
        }
      });

      resetBtn.addEventListener('click', () => {
        textarea.value = drill.starter || '';
        hintsShown = 0;
        const hintBox = dom.querySelector('.acd-hint-box');
        if (hintBox) hintBox.remove();
        hintBtn.disabled = false;
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
      });

      hintBtn.addEventListener('click', () => {
        const hints = drill.hints || [];
        if (!hints.length) return;
        hintsShown = Math.min(hintsShown + 1, hints.length);
        let hintBox = dom.querySelector('.acd-hint-box');
        if (!hintBox) {
          hintBox = document.createElement('div');
          hintBox.className = 'acd-hint-box';
          dom.querySelector('.acd-terminal').after(hintBox);
        }
        hintBox.innerHTML = hints
          .slice(0, hintsShown)
          .map((h, i) => `<div class="acd-hint-line"><b>Hint ${i + 1}:</b> ${escapeHtml(h)}</div>`)
          .join('');
        if (hintsShown >= hints.length) hintBtn.disabled = true;
      });

      nextBtn.addEventListener('click', () => {
        if (current < drills.length - 1) {
          current += 1;
          render();
        }
      });

      updateGutter();
      runChecks();
    }

    render();
  }

  window.CodeDrillEngine = {
    init: function (mount, drills, options) {
      if (!mount) return;
      options = options || {};
      CodeDrillSection(mount, {
        drills: drills || [],
        storageKey: options.storageKey || null,
        title: options.title || '',
        backHref: options.backHref || null,
      });
    },
  };
})();