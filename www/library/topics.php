<?php
require_once __DIR__ . '/includes/reviewer-session.php';
require_reviewer_access();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Aghimuan Library — Topics</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/library-core.css">
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

  .explorer { display:flex; flex-direction:column; min-height:100vh; }
  .explorer-body { display:flex; flex:1; gap:0; align-items:stretch; position:relative; overflow:hidden; }

  .row-item { display:flex; align-items:center; gap:.75rem; width:100%; text-align:left; padding:.85rem 1rem; transition: background-color 0.2s ease, transform 0.2s ease; }
  .row-item:hover { transform: translateX(3px); }
  .folder-icon, .file-icon { flex-shrink:0; width:1.3rem; height:1.3rem; }

  /* Mobile Drawer Behavior */
  @media (max-width: 767px) {
    #quarter-pane {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 270px;
      max-width: 80vw;
      z-index: 50;
      background: #090e1a;
      border-right: 1px solid rgba(85, 241, 248, 0.3);
      transform: translateX(-100%);
      transition: transform 0.25s ease-in-out;
      box-shadow: 8px 0 24px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
    }
    #quarter-pane.is-open {
      transform: translateX(0);
    }
    #drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 40;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease-in-out;
    }
    #drawer-overlay.is-open {
      opacity: 0;
      pointer-events: enabled;
    }
    #week-pane { width: 100%; }
  }

  /* Desktop Grid Behavior */
  @media (min-width: 768px) {
    #quarter-pane { width:280px; flex-shrink:0; border-right:1px solid color-mix(in srgb, var(--subject) 25%, transparent); display:block !important; transform:none !important; position:static !important; box-shadow:none !important; background:rgba(0,0,0,0.4) !important; }
    #week-pane { flex:1; display:block !important; }
    #drawer-overlay { display:none !important; }
    .mobile-only { display:none !important; }
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
    .row-item:hover { transform: none !important; }
  }
</style>
</head>
<body class="bg-grid relative">

<div class="scanline-effect"></div>

<!-- Mobile Drawer Overlay Background -->
<div id="drawer-overlay"></div>

<div class="explorer min-h-screen flex flex-col p-2 sm:p-4 md:p-6">
  
  <!-- Outer Window Wrapper -->
  <div class="window-card rounded-xl overflow-hidden flex-1 flex flex-col">
    
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
          <h1 id="pageTitle" class="font-display text-sm md:text-base font-bold neon-subject truncate leading-tight">TOPICS</h1>
        </div>
      </div>
      <div id="crumb" class="font-display text-[9px] md:text-[10px] tracking-[0.2em] text-white/50 uppercase truncate ml-2"></div>
    </header>

    <!-- Address / Breadcrumb Bar -->
    <div class="bg-black/30 px-4 py-2 border-b border-white/5 flex items-center justify-between gap-2 text-xs">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-white/40 text-[11px] hidden sm:inline">Path:</span>
        <div class="bg-black/40 border border-white/10 rounded px-2.5 py-1 text-white/80 font-mono text-[11px] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap w-full sm:w-auto">
          <span class="text-[#55F1F8]">root</span>
          <span class="text-white/30">/</span>
          <span class="text-white/70">library</span>
          <span class="text-white/30">/</span>
          <span class="text-white/70">subjects</span>
          <span class="text-white/30">/</span>
          <span id="pathSubject" class="text-white/90 uppercase">subject</span>
          <span class="text-white/30">/</span>
          <span id="pathGrade" class="text-[#3096C7]">grade</span>
        </div>
      </div>
      <button id="openQuarterDrawer" class="mobile-only btn-neon flex items-center gap-1.5 bg-black/50 border border-[#55F1F8]/40 text-[#55F1F8] px-2.5 py-1 rounded font-display text-[11px] flex-shrink-0">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
        </svg>
        <span>QUARTERS</span>
      </button>
    </div>

    <!-- Explorer Body Pane Layout -->
    <div class="explorer-body">
      
      <!-- Quarter Sidebar Pane / Mobile Drawer -->
      <nav id="quarter-pane">
        <div class="px-4 py-3 font-display text-[10px] tracking-[0.3em] text-white/40 border-b border-white/10 flex items-center justify-between bg-black/60">
          <span>DIRECTORIES (QUARTERS)</span>
          <button id="closeQuarterDrawer" class="mobile-only text-white/60 hover:text-white p-1 text-sm font-mono">&times;</button>
        </div>
        <div id="quarterList" class="flex-1 overflow-y-auto"></div>
      </nav>

      <!-- Week Files Pane -->
      <main id="week-pane" class="bg-black/20">
        <div class="px-4 pt-3 pb-2 font-display text-[10px] tracking-[0.3em] text-white/40 border-b border-white/5 flex items-center justify-between" id="weekPaneHeader">
          <span id="weekPaneLabel">SELECT A QUARTER</span>
        </div>
        <div id="weekList"></div>
      </main>

    </div>

    <!-- Status Bar -->
    <div class="bg-black/60 px-4 py-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
      <span id="statusText">Select a module week to view material</span>
      <span class="hidden sm:inline">AGHIMUAN OS</span>
    </div>

  </div>
</div>

<script src="js/shared.js"></script>
<script>
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').toUpperCase();
  const grade = params.get('grade');
  const requestedQuarter = parseInt(params.get('quarter'), 10);

  const theme = AghiLib.applySubjectTheme(subject);
  if (!theme || !grade) {
    document.body.innerHTML = '<p class="font-display neon-pink text-center p-10">Unknown subject or grade.</p>';
  } else {
    document.getElementById('pageTitle').textContent = theme.name.toUpperCase();
    document.getElementById('crumb').textContent = subject + ' \u00B7 GRADE ' + grade;
    document.getElementById('pathSubject').textContent = subject.toLowerCase();
    document.getElementById('pathGrade').textContent = 'g' + grade;
    document.title = 'Aghimuan Library — ' + theme.name + ' G' + grade;

    AghiLib.injectBackNav(AghiLib.subjectBackHref(subject), 'GRADE', document.getElementById('backSlot'));

    const QUARTERS = [1, 2, 3, 4];
    const WEEKS_PER_QUARTER = 6;

    const quarterList = document.getElementById('quarterList');
    const weekList = document.getElementById('weekList');
    const weekPaneLabel = document.getElementById('weekPaneLabel');
    const quarterPane = document.getElementById('quarter-pane');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const openQuarterDrawer = document.getElementById('openQuarterDrawer');
    const closeQuarterDrawer = document.getElementById('closeQuarterDrawer');

    let activeQuarter = null;

    function openDrawer() {
      quarterPane.classList.add('is-open');
      drawerOverlay.classList.add('is-open');
    }

    function closeDrawer() {
      quarterPane.classList.remove('is-open');
      drawerOverlay.classList.remove('is-open');
    }

    openQuarterDrawer.addEventListener('click', openDrawer);
    closeQuarterDrawer.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    function renderQuarters() {
      quarterList.innerHTML = QUARTERS.map((q) => `
        <button data-quarter="${q}" class="row-item btn-neon w-full border-b border-white/5 hover:bg-white/10 ${activeQuarter === q ? 'bg-white/15 border-l-2 border-l-[#55F1F8]' : ''}">
          <svg class="folder-icon neon-subject" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
          </svg>
          <span class="font-display text-xs md:text-sm tracking-wider">QUARTER ${q}</span>
        </button>
      `).join('');

      quarterList.querySelectorAll('[data-quarter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectQuarter(parseInt(btn.dataset.quarter, 10));
          closeDrawer();
        });
      });
    }

    function renderWeeks(q) {
      weekPaneLabel.textContent = 'QUARTER ' + q + ' \u00B7 MODULE FILES';
      weekList.innerHTML = Array.from({ length: WEEKS_PER_QUARTER }, (_, i) => i + 1).map((w) => `
        <a href="reviewer.php?subject=${subject}&grade=${grade}&quarter=${q}&week=${w}"
           class="row-item btn-neon w-full border-b border-white/5 hover:bg-white/10 group">
          <svg class="file-icon neon-subject" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/>
            <path d="M14 2v6h6"/>
          </svg>
          <div class="flex-1 flex items-center justify-between">
            <span class="font-display text-xs md:text-sm tracking-wider">WEEK ${w}</span>
            <span class="text-[10px] font-mono text-white/30 group-hover:text-white/70 transition-colors">&rarr;</span>
          </div>
        </a>
      `).join('');
    }

    function selectQuarter(q) {
      activeQuarter = q;
      renderQuarters();
      renderWeeks(q);
    }

    renderQuarters();
    if (QUARTERS.includes(requestedQuarter)) {
      selectQuarter(requestedQuarter);
    } else {
      selectQuarter(1);
    }
  }
</script>
</body>
</html>
