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
<title>Aghimuan Library — Select Grade</title>
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

  .btn-neon { transition: all .2s cubic-bezier(0.16, 1, 0.3, 1); user-select:none; cursor:pointer; }
  .btn-neon:hover { transform: translateY(-3px) scale(1.02); filter: brightness(1.25); }
  .btn-neon:active { transform: translateY(1px) scale(.98); }

  .window-card {
    background: rgba(10, 15, 30, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(85, 241, 248, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
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
  }
</style>
</head>
<body class="bg-grid relative min-h-screen flex flex-col justify-between overflow-x-hidden">

<div class="scanline-effect"></div>

<div class="w-full flex-1 flex flex-col">
  <!-- Content Area -->
  <main class="px-3 sm:px-6 md:px-8 pt-6 md:pt-12 pb-12 max-w-4xl mx-auto w-full my-auto">
    
    <!-- Window Frame -->
    <div class="window-card rounded-xl overflow-hidden fade-up">
      
      <!-- Title Bar -->
      <div class="bg-black/60 px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-display">
        <div class="flex items-center gap-2">
          <div id="backSlot"></div>
          <div class="flex gap-1.5 ml-2">
            <span class="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
          </div>
          <span class="ml-2 text-white/60 tracking-wider text-[11px] truncate hidden sm:inline">EXPLORER // GRADE_SELECTION</span>
        </div>
        <div class="text-[10px] text-[#55F1F8] tracking-widest uppercase">AGHIMUAN OS</div>
      </div>

      <!-- Address Bar -->
      <div class="bg-black/30 px-4 py-2 border-b border-white/5 flex items-center gap-2 text-xs">
        <span class="text-white/40">Path:</span>
        <div class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-white/80 font-mono text-[11px] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
          <span class="text-[#55F1F8]">root</span>
          <span class="text-white/30">/</span>
          <span class="text-white/70">library</span>
          <span class="text-white/30">/</span>
          <span class="text-white/70">subjects</span>
          <span class="text-white/30">/</span>
          <span id="pathSubject" class="text-white/90 uppercase">subject</span>
          <span class="text-white/30">/</span>
          <span class="text-[#3096C7]">select_grade</span>
        </div>
      </div>

      <!-- Inner Content -->
      <div id="content" class="p-6 sm:p-10 md:p-14 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div class="mb-8">
          <p id="subjectLabel" class="font-display text-sm md:text-base tracking-[0.3em] neon-subject mb-2 uppercase">&nbsp;</p>
          <h1 class="font-display text-2xl md:text-4xl font-black neon-yellow tracking-wide">SELECT GRADE LEVEL</h1>
        </div>

        <div id="gradeGrid" class="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-md justify-center"></div>
      </div>

      <!-- Status Bar -->
      <div class="bg-black/50 px-4 py-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/40">
        <span>Select directory to proceed</span>
        <span>SYSTEM READY</span>
      </div>

    </div>
  </main>
</div>

<script src="js/shared.js"></script>
<script>
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').toUpperCase();
  const theme = AghiLib.applySubjectTheme(subject);
  const grades = AghiLib.SUBJECT_GRADES[subject];

  if (!theme || !grades) {
    document.getElementById('content').innerHTML =
      '<p class="font-display neon-pink text-xl">Unknown subject.</p>';
  } else if (grades.length === 1) {
    window.location.replace(AghiLib.gradeHref(subject, grades[0]));
  } else {
    document.getElementById('subjectLabel').textContent = theme.name.toUpperCase();
    document.getElementById('pathSubject').textContent = subject.toLowerCase();

    const grid = document.getElementById('gradeGrid');
    grades.forEach((g) => {
      const btn = document.createElement('a');
      btn.href = AghiLib.gradeHref(subject, g);
      btn.className = [
        'btn-neon', 'neon-border-subject', 'neon-subject',
        'font-display', 'text-xl', 'md:text-2xl', 'font-bold',
        'px-8', 'py-6', 'rounded-xl', 'w-full',
        'bg-black/50', 'backdrop-blur-sm', 'border',
        'flex', 'items-center', 'justify-center', 'gap-3', 'group'
      ].join(' ');
      
      btn.innerHTML = `
        <svg class="w-6 h-6 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
        </svg>
        <span>GRADE ${g}</span>
      `;
      grid.appendChild(btn);
    });

    AghiLib.injectBackNav('../library-home.php', 'SUBJECTS', document.getElementById('backSlot'));
  }
</script>
</body>
</html>
