<?php
require_once __DIR__ . '/includes/reviewer-session.php';
require_reviewer_access();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Aghimuan Library — Reviewer</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/library-core.css">
<link rel="stylesheet" href="css/quiz.css">
<link rel="stylesheet" href="css/sim.css">
<link rel="stylesheet" href="css/code-drill.css">
<style>
  :root { 
    --bg:#080b14; 
    --pink:#3096C7; 
    --cyan:#55F1F8; 
  }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; min-height:100%; width:100%; overscroll-behavior:none; }
  html { background:#03030f; }
  body { font-family:'Rajdhani',sans-serif; background:radial-gradient(ellipse at 50% 20%, #0a1029 0%, var(--bg) 80%); color:#fff; min-height:100vh; }
  .font-display { font-family:'Orbitron',sans-serif; letter-spacing:0.05em; }

  .bg-grid { 
    background-image:
      linear-gradient(rgba(48,150,199,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(85,241,248,0.05) 1px, transparent 1px); 
    background-size: 32px 32px; 
  }

  .btn-neon { transition: all .15s cubic-bezier(0.16, 1, 0.3, 1); user-select:none; cursor:pointer; }
  .btn-neon:hover { filter: brightness(1.25); }

  .window-card {
    background: rgba(10, 15, 30, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(85, 241, 248, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .rev-intro {
    max-width: 720px; margin: 1rem auto 0; padding: 0 1rem;
    font-size: .9rem; line-height: 1.6; color: rgba(255,255,255,.7);
  }

  .rev-tabs {
    display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center;
    max-width: 720px; margin: 1rem auto 0; padding: 0 1rem;
  }
  .rev-tab {
    flex: none; white-space: nowrap;
    font-family: 'Orbitron', sans-serif; font-size: .68rem; letter-spacing: .08em;
    padding: .55rem 1rem; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.03); color: rgba(255,255,255,.6);
  }
  @media (max-width: 420px) {
    .rev-tab { font-size: .62rem; padding: .5rem .8rem; }
  }
  .rev-tab.is-active {
    border-color: var(--subject); color: var(--subject);
    background: color-mix(in srgb, var(--subject) 14%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--subject) 35%, transparent);
  }

  .rev-content { flex: 1; padding: 1.5rem 1rem 2rem; width: 100%; max-width: 900px; margin: 0 auto; }

  .rev-placeholder {
    flex: 1; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 3rem 1.5rem; min-height: 320px;
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(1000%); }
  }
  .scanline-effect {
    position: absolute;
    top: 0; left: 0; right: 0; height: 100px;
    background: linear-gradient(to bottom, transparent, rgba(85,241,248,0.03), transparent);
    animation: scanline 8s linear infinite;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) { 
    .scanline-effect { animation: none !important; } 
  }
</style>
</head>
<body class="bg-grid relative min-h-screen flex flex-col p-2 sm:p-4 md:p-6">

<div class="scanline-effect"></div>

<!-- Outer Window Wrapper -->
<div class="window-card rounded-xl overflow-hidden flex-1 flex flex-col w-full max-w-6xl mx-auto my-auto">
  
  <!-- Title Bar -->
  <header class="bg-black/60 px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-display z-20">
    <div class="flex items-center gap-3 min-w-0">
      <div id="backSlot" class="flex-shrink-0"></div>
      <div class="flex gap-1.5 hidden sm:flex">
        <span class="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
        <span class="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
        <span class="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
      </div>
      <div class="min-w-0 pl-1">
        <h1 id="pageTitle" class="font-display text-sm md:text-base font-bold neon-subject truncate leading-tight">REVIEWER</h1>
      </div>
    </div>
    <div id="crumb" class="font-display text-[9px] md:text-[10px] tracking-[0.2em] text-white/50 uppercase truncate ml-2"></div>
  </header>

  <!-- Address / Breadcrumb Bar -->
  <div class="bg-black/30 px-4 py-2 border-b border-white/5 flex items-center gap-2 text-xs">
    <span class="text-white/40 text-[11px]">Path:</span>
    <div class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-white/80 font-mono text-[11px] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
      <span class="text-[#55F1F8]">root</span>
      <span class="text-white/30">/</span>
      <span class="text-white/70">library</span>
      <span class="text-white/30">/</span>
        <span class="text-white/70">subjects</span>
        <span class="text-white/30">/</span>
      <span id="pathSubject" class="text-white/90 uppercase">subject</span>
      <span class="text-white/30">/</span>
      <span id="pathGrade" class="text-[#3096C7]">grade</span>
      <span class="text-white/30">/</span>
      <span id="pathQuarter" class="text-white/80">quarter</span>
      <span class="text-white/30">/</span>
      <span id="pathWeek" class="text-[#55F1F8]">week</span>
    </div>
  </div>

  <!-- Viewer Body -->
  <div class="flex-1 flex flex-col justify-between relative bg-black/20">
    
    <p id="revIntro" class="rev-intro hidden text-center"></p>
    <nav id="revTabs" class="rev-tabs hidden"></nav>
    <main id="revContent" class="rev-content hidden"></main>

    <!-- Shown until content loads -->
    <div id="revPlaceholder" class="rev-placeholder">
      <div class="flex flex-col items-center gap-4 fade-up max-w-md">
        <h2 class="font-display text-xl md:text-2xl neon-yellow font-bold">REVIEWER COMING SOON</h2>
        <p class="text-white/50 text-sm">This topic's flashcards, quiz, and simulation content are still being built.</p>
      </div>
    </div>

  </div>

  <!-- Status Bar -->
  <div class="bg-black/60 px-4 py-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
    <span id="statusText">Active Viewer Session</span>
    <span class="hidden sm:inline">AGHIMUAN OS</span>
  </div>

</div>

<script src="js/shared.js"></script>
<script src="js/engine/flashcard-engine.js"></script>
<script src="js/engine/quiz-engine.js"></script>
<script src="js/engine/code-drill-engine.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="js/engine/sim-engine.js"></script>
<script>
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').toUpperCase();
  const grade = params.get('grade');
  const quarter = params.get('quarter');
  const week = params.get('week');

  const theme = AghiLib.applySubjectTheme(subject);
  const backHref = 'topics.php?subject=' + subject + '&grade=' + grade + '&quarter=' + quarter;

  if (theme) {
    document.getElementById('crumb').textContent =
      subject + ' \u00B7 GRADE ' + grade + ' \u00B7 QUARTER ' + quarter + ' \u00B7 WEEK ' + week;
    
    if (document.getElementById('pathSubject')) document.getElementById('pathSubject').textContent = subject.toLowerCase();
    if (document.getElementById('pathGrade')) document.getElementById('pathGrade').textContent = 'g' + grade;
    if (document.getElementById('pathQuarter')) document.getElementById('pathQuarter').textContent = 'q' + quarter;
    if (document.getElementById('pathWeek')) document.getElementById('pathWeek').textContent = 'w' + week;
  }
  AghiLib.injectBackNav(backHref, 'TOPICS', document.getElementById('backSlot'));

  const introEl = document.getElementById('revIntro');
  const tabsEl = document.getElementById('revTabs');
  const contentEl = document.getElementById('revContent');
  const placeholderEl = document.getElementById('revPlaceholder');
  const titleEl = document.getElementById('pageTitle');

  function mountSection(section) {
    const mountStyle = section.type === 'simulation'
      ? ' style="height:70vh;min-height:420px;"'
      : '';
    contentEl.innerHTML = '<div id="engine-mount" class="fade-up"' + mountStyle + '></div>';
    const mount = document.getElementById('engine-mount');
    if (section.type === 'flashcards') {
      FlashcardEngine.init(mount, section.cards, {
        title: section.title,
        storageKey: section.storageKey,
        shuffle: true,
        backHref: backHref,
      });
    } else if (section.type === 'quiz') {
      QuizEngine.init(mount, section.questions, {
        title: section.title,
        storageKey: section.storageKey,
        shuffleQuestions: section.shuffleQuestions !== false,
        shuffleOptions: section.shuffleOptions !== false,
        backHref: backHref,
      });
    } else if (section.type === 'simulation') {
      SimEngine.init(mount, section.scenario, Object.assign(
        { backHref: backHref },
        section.options || {}
      ));
    } else if (section.type === 'code-drill') {
      CodeDrillEngine.init(mount, section.drills, {
        title: section.title,
        storageKey: section.storageKey,
        backHref: backHref,
      });
    }
  }

  function renderTopic(content) {
    titleEl.textContent = content.title.toUpperCase();
    document.title = 'Aghimuan Library — ' + content.title;
    placeholderEl.classList.add('hidden');

    if (content.intro) {
      introEl.textContent = content.intro;
      introEl.classList.remove('hidden');
    }

    tabsEl.innerHTML = '';
    content.sections.forEach((section, i) => {
      const btn = document.createElement('button');
      btn.className = 'rev-tab btn-neon' + (i === 0 ? ' is-active' : '');
      btn.textContent = section.label;
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.rev-tab').forEach(t => t.classList.remove('is-active'));
        btn.classList.add('is-active');
        mountSection(section);
      });
      tabsEl.appendChild(btn);
    });
    tabsEl.classList.remove('hidden');
    contentEl.classList.remove('hidden');

    mountSection(content.sections[0]);
  }

  if (theme && grade && quarter && week) {
    // Was: 'data/' + subject.toLowerCase() + '/' + subject.toLowerCase() + '-g'+grade+'-q'+quarter+'-w'+week+'.js'
    // Now routed through the gate — there is no direct URL to the real file anymore.
    const dataSrc = 'data-gate.php?subject=' + subject.toLowerCase() +
      '&grade=' + grade + '&quarter=' + quarter + '&week=' + week;
    const script = document.createElement('script');
    script.src = dataSrc;
    script.onload = () => {
      if (window.AghiTopicContent) {
        renderTopic(window.AghiTopicContent);
      } else {
        // The gate request itself succeeded (no network error, so onerror
        // never fires here), but it didn't hand back real content — check
        // the console just above for a [data-gate] message explaining why,
        // or check the Network tab response for this request directly.
        console.warn('[reviewer] data-gate.php loaded but returned no AghiTopicContent for ' + dataSrc);
      }
    };
    script.onerror = () => {
      // Session expired mid-visit, or something went wrong server-side — send back to sign-in.
      window.location.href = '/reviewers.php?next=' + encodeURIComponent(window.location.href);
    };
    document.head.appendChild(script);
  }
</script>
</body>
</html>