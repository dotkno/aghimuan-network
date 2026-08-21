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
<script src="https://cdn.tailwindcss.com"></script>
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
    transform: translateY(-4px) scale(1.01);
    background: rgba(15, 23, 42, 0.85);
  }

  .folder-item:hover .folder-icon {
    transform: scale(1.1) rotate(-3deg);
  }

  .folder-icon {
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
<body class="bg-grid relative min-h-screen flex flex-col justify-between overflow-x-hidden">

<div class="scanline-effect"></div>

<div>
  <!-- Standard Header -->
  <header class="sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center justify-between bg-black/70 backdrop-blur-md border-b border-[#3096C7]/30">
    <div class="flex items-center gap-3">
      <a href="index.html" class="btn-neon w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/50 border border-[#3096C7]/40 flex items-center justify-center text-[#3096C7] text-sm" title="Back to Aghimuan Network" aria-label="Back to Aghimuan Network">&#8592;</a>
      <div class="text-lg md:text-2xl font-display font-black neon-pink">AGHIMUAN</div>
      <div class="text-lg md:text-2xl font-display font-black text-white/80">LIBRARY</div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-white/40 font-display hidden sm:inline">PCU-D &middot; ICT</div>
      <a href="/library/reviewer-logout.php" class="btn-neon w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/50 border border-red-400/40 flex items-center justify-center text-red-400 text-sm" title="Sign out of PCU account" aria-label="Sign out of PCU account">&#9099;</a>
    </div>
  </header>

  <!-- Main Explorer Interface -->
  <main class="px-3 sm:px-6 md:px-8 pt-6 md:pt-10 pb-12 max-w-6xl mx-auto w-full">
    
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
        <div id="subject-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
      </div>

      <!-- Window Status Bar -->
      <div class="bg-black/50 px-4 py-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
        <span>Click subject folder to launch module selection</span>
        <span class="hidden sm:inline">AGHIMUAN OS</span>
      </div>

    </div>
  </main>
</div>

<!-- Script -->
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
    <button data-subject="${s.code}" 
            class="folder-item btn-neon text-left rounded-lg border bg-black/30 p-4 sm:p-5 flex flex-col justify-between h-full relative overflow-hidden group" 
            style="animation-delay:${i * 60}ms; border-color:${s.color}33;"
            aria-label="Open ${s.name}">
      
      <!-- Subtle top corner glow line -->
      <div class="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style="background:${s.color};"></div>
      
      <div>
        <div class="flex items-center justify-between mb-4">
          <!-- Folder Visual Icon Container -->
          <div class="relative flex items-center justify-center w-12 h-10">
            <svg class="absolute inset-0 w-full h-full text-white/10 group-hover:text-white/20 transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
            </svg>
            <span class="folder-icon relative text-xl font-bold" style="color:${s.color}; text-shadow:0 0 10px ${s.color}aa;">
              ${s.icon}
            </span>
          </div>

          <span class="text-[10px] font-display tracking-wider px-2 py-0.5 rounded border border-white/10 bg-black/40 text-white/50">
            ${s.grades}
          </span>
        </div>

        <div class="font-display font-black text-xl tracking-wide flex items-center gap-2" style="color:${s.color};">
          <span>${s.code}</span>
          <span class="text-xs text-white/20 group-hover:text-white/60 transition-colors">/</span>
        </div>
        
        <div class="text-sm font-medium text-white/70 group-hover:text-white mt-1 leading-snug">
          ${s.name}
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40 group-hover:text-white/70">
        <span>DIRECTORY</span>
        <span class="text-xs group-hover:translate-x-1 transition-transform" style="color:${s.color};">&rarr;</span>
      </div>
    </button>
  `).join('');

  grid.querySelectorAll('[data-subject]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.subject === 'CSS') {
        window.location.href = 'library/grade-select.php?subject=CSS';
        return;
      }
      if (btn.dataset.subject === 'CP') {
        window.location.href = 'library/grade-select.php?subject=CP';
        return;
      }
      if (btn.dataset.subject === 'MIL') {
        window.location.href = 'library/mil-g12.php';
        return;
      }
      if (btn.dataset.subject === 'ET') {
        window.location.href = 'library/et-g12.php';
        return;
      }
      if (btn.dataset.subject === 'VGD') {
        window.location.href = 'library/vgd-g11.php';
        return;
      }
      alert(`${btn.dataset.subject} modules are still being built — coming soon.`);
    });
  });
}

buildSubjectGrid();
</script>
</body>
</html>