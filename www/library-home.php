<?php
require_once __DIR__ . '/library/includes/reviewer-session.php';
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
<title>Aghimuan Library</title>
<meta name="description" content="Browse ICT reviewer subjects for PCU-D: programming, systems servicing, media literacy, and more. PCU Gmail sign-in required.">
<meta property="og:image" content="https://aghimuan.online/og-banner.png">
<meta name="twitter:image" content="https://aghimuan.online/og-banner.png">
<link rel="canonical" href="https://aghimuan.online/library-home.php">
<link rel="describedby" href="https://aghimuan.online/llms.txt">
<script src="https://cdn.tailwindcss.com"></script>
<script src="library/js/sfx.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { 
    --bg:#080b14; 
    --bg2:#03037E; 
    --pink:#3096C7; 
    --cyan:#55F1F8; 
    --yellow:#F1F2F5; 
  }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; min-height:100%; width:100%; overscroll-behavior:none; }
  html { background:#03030f; }
  /* No sideways scrolling (clip, not hidden, so the sticky header keeps working). */
  html, body { overflow-x: clip; }
  body { font-family:'Rajdhani',sans-serif; background:radial-gradient(ellipse at 50% 20%, #0a1029 0%, var(--bg) 80%); color:#fff; min-height:100vh; }
  .font-display { font-family:'Orbitron',sans-serif; letter-spacing:0.05em; }
  .neon-pink { color:var(--pink); text-shadow:0 0 8px var(--pink),0 0 16px rgba(48,150,199,0.6); }
  .neon-cyan { color:var(--cyan); text-shadow:0 0 8px var(--cyan),0 0 16px rgba(85,241,248,0.6); }
  
  .bg-grid { 
    background-image:
      linear-gradient(rgba(48,150,199,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(85,241,248,0.05) 1px, transparent 1px); 
    background-size: 32px 32px; 
  }

  .btn-neon { transition: all .2s cubic-bezier(0.16, 1, 0.3, 1); user-select:none; cursor:pointer; }
  .btn-neon:hover { transform: translateY(-2px); filter: brightness(1.25); }
  .btn-neon:active { transform: translateY(1px) scale(.98); }

  .window-card {
    background: rgba(10, 15, 30, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(85, 241, 248, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .folder-item {
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
  }
  
  .folder-item:hover {
    transform: translateX(3px);
    background: rgba(15, 23, 42, 0.85);
  }

  .folder-item:hover .folder-icon {
    transform: scale(1.1) rotate(-3deg);
  }

  .folder-icon {
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  a.folder-item {
    text-decoration: none;
    color: inherit;
  }

  @keyframes fade-up { 
    from { opacity:0; transform: translateY(16px); } 
    to { opacity:1; transform: translateY(0); } 
  }
  .fade-up { animation: fade-up .5s cubic-bezier(.16, 1, .3, 1) both; }
  
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
    .fade-up, .scanline-effect { animation: none !important; } 
    .folder-item:hover { transform: none !important; }
  }
</style>
</head>
<body class="bg-grid relative min-h-screen flex flex-col justify-between">

<div class="scanline-effect"></div>
<div style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,transparent 42%,rgba(2,4,10,.85) 100%);z-index:1"></div>

<div class="relative z-[2]">
  <!-- Standard Header -->
  <header class="sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center justify-between bg-black/70 backdrop-blur-md border-b border-[#3096C7]/30">
    <div class="flex items-center gap-3 min-w-0">
      <a href="index.html" class="btn-neon w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/50 border border-[#3096C7]/40 flex items-center justify-center text-[#3096C7] text-sm flex-shrink-0" title="Back to Aghimuan Network" aria-label="Back to Aghimuan Network">&#8592;</a>
      <span class="hidden sm:flex items-center gap-3 min-w-0">
        <span class="text-lg md:text-2xl font-display font-black neon-pink truncate">AGHIMUAN</span>
        <span class="text-lg md:text-2xl font-display font-black text-white/80 truncate">LIBRARY</span>
      </span>
      <span class="sm:hidden flex items-center gap-1.5 min-w-0" aria-label="Aghimuan Library">
        <span class="text-lg font-display font-black neon-pink truncate">AGHI</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#55F1F8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="flex-shrink-0"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M9 8h7"/></svg>
      </span>
    </div>
    <div class="flex items-center gap-3">
      <?php echo reviewer_account_inline(); ?>
      <div class="text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-white/40 font-display hidden sm:inline">PCU-D &middot; ICT</div>
      <a href="/library/reviewer-logout.php" class="btn-neon w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/50 border border-red-400/40 flex items-center justify-center text-red-400 text-sm" title="Sign out of PCU account" aria-label="Sign out of PCU account">&#9099;</a>
    </div>
  </header>

  <!-- Main Explorer Interface -->
  <main class="px-3 sm:px-6 md:px-8 pt-6 md:pt-10 pb-12 max-w-6xl mx-auto w-full">
    <h1 class="sr-only">Aghimuan Library — reviewer subjects</h1>
    
    <!-- File Explorer Window Frame -->
    <div class="window-card rounded-xl overflow-hidden fade-up">
      
      <!-- Explorer Title Bar -->
      <div class="bg-black/60 px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-display">
        <div class="flex items-center gap-2">
          <div class="flex gap-1.5">
            <span class="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
          </div>
          <span class="ml-2 text-white/60 tracking-wider text-[11px] truncate hidden sm:inline">EXPLORER // AGHIMUAN_LIBRARY</span>
        </div>
        <div class="text-[10px] text-[#55F1F8] tracking-widest uppercase">SYSTEM READY</div>
      </div>

      <!-- Explorer Address Bar -->
      <div class="bg-black/30 px-4 py-2 border-b border-white/5 flex items-center gap-2 text-xs">
        <span class="text-white/40">Path:</span>
        <div class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-white/80 font-mono text-[11px] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
          <span class="text-[#55F1F8]">root</span>
          <span class="text-white/30">/</span>
          <span class="text-white/70">library</span>
          <span class="text-white/30">/</span>
          <span class="text-[#3096C7]">subjects</span>
        </div>
      </div>

      <!-- Main Directory Content -->
      <div class="p-4 sm:p-6 md:p-8">
        <div class="hidden md:grid grid-cols-[1fr,11rem,2rem] gap-4 px-4 pb-2 text-[10px] font-display tracking-widest text-white/40 uppercase">
          <span>Subject</span><span class="text-right">Grade Level</span><span></span>
        </div>
        <div id="subject-grid" class="divide-y divide-white/5"></div>
      </div>

      <!-- Window Status Bar -->
      <div class="bg-black/50 px-4 py-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
        <span>Click subject folder to open</span>
        <span class="hidden sm:inline">AGHIMUAN OS</span>
      </div>

    </div>
  </main>
</div>

<script>

/* ---------------- SUBJECT DATA ---------------- */
const SUBJECTS = [
  { code:'CP',  name:'Computer Programming',        grades:'Grade 11 &middot; Grade 12', icon:'&lt;/&gt;', color:'#55F1F8' },
  { code:'CSS', name:'Computer Systems Servicing',   grades:'Grade 11 &middot; Grade 12', icon:'&#9881;',   color:'#3096C7' },
  { code:'MIL', name:'Media & Information Literacy', grades:'Grade 12',           icon:'&#128225;', color:'#F1F2F5' },
  { code:'ET',  name:'Empowerment Technology',       grades:'Grade 12',           icon:'&#127760;', color:'#55F1F8' },
  { code:'VGD', name:'Visual Graphics Design',       grades:'Grade 11',           icon:'&#9998;',   color:'#3096C7' },
];

function buildSubjectGrid() {
  const grid = document.getElementById('subject-grid');
  if (grid.dataset.built) return;
  grid.dataset.built = '1';
  
  grid.innerHTML = SUBJECTS.map((s, i) => `
    <a data-subject="${s.code}" href="${subjectHref(s.code)}"
            class="folder-item btn-neon group w-full flex md:grid md:grid-cols-[1fr,11rem,2rem] md:items-center gap-3 px-4 py-4 sm:py-5 text-left"
            style="animation-delay:${i * 60}ms"
            aria-label="Open ${s.name}">
      <span class="flex items-center gap-3 min-w-0">
        <span class="relative flex items-center justify-center w-10 h-9 flex-shrink-0">
          <svg class="absolute inset-0 w-full h-full text-white/10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
          </svg>
          <span class="folder-icon relative text-lg font-bold" style="color:${s.color}; text-shadow:0 0 10px ${s.color}aa;">
            ${s.icon}
          </span>
        </span>
        <span class="font-display font-black text-lg w-16 flex-shrink-0" style="color:${s.color};">${s.code}</span>
        <span class="flex-1 min-w-0">
          <span class="block font-medium text-white/80 group-hover:text-white truncate">${s.name}</span>
          <span class="block md:hidden text-[11px] font-mono text-white/40">${s.grades}</span>
        </span>
      </span>
      <span class="hidden md:block text-[11px] font-mono text-white/50 text-right">${s.grades}</span>
      <span class="text-white/30 text-right">&rarr;</span>
    </a>
  `).join('');
}

/* Real links (not buttons) so crawlers and no-JS clients can follow them.
   Logged-out visitors hit the session guard and land on the sign-in gate. */
function subjectHref(code) {
  if (code === 'CSS') return 'library/grade-select.php?subject=CSS';
  if (code === 'CP') return 'library/grade-select.php?subject=CP';
  if (code === 'MIL') return 'library/mil-g12.php';
  if (code === 'ET') return 'library/et-g12.php';
  if (code === 'VGD') return 'library/vgd-g11.php';
  return 'library/grade-select.php?subject=' + encodeURIComponent(code);
}

buildSubjectGrid();
</script>
</body>
</html>