<?php
/**
 * www/reviewers.php
 *
 * Front door into the Aghimuan Library. This page is intentionally
 * NOT guarded with require_reviewer_access() — it IS the sign-in
 * gate, so guarding it would create a redirect loop.
 *
 * If the visitor already has a valid PCU-verified session, skip
 * straight through to library-home.php. Otherwise, show sign-in.
 */

require_once __DIR__ . '/library/includes/reviewer-session.php';

if (has_reviewer_access()) {
    header('Location: /library-home.php');
    exit;
}
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<style>
  :root { --bg:#050714; --bg2:#03037E; --pink:#3096C7; --cyan:#55F1F8; --yellow:#F1F2F5; }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; height:100%; width:100%; overflow:hidden; overscroll-behavior:none; }
  html { background:#03030f; }
  body { font-family:'Rajdhani',sans-serif; background:radial-gradient(ellipse at 50% 30%, var(--bg2) 0%, var(--bg) 80%); color:#fff; }
  .font-display { font-family:'Orbitron',sans-serif; letter-spacing:0.05em; }
  .neon-cyan { color:var(--cyan); text-shadow:0 0 8px var(--cyan),0 0 16px rgba(85,241,248,0.6); }
  .neon-border-cyan { border-color:var(--cyan)!important; box-shadow:0 0 14px rgba(85,241,248,0.5), inset 0 0 14px rgba(85,241,248,0.12); }
  
  .bg-grid { 
    background-image:linear-gradient(rgba(48,150,199,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(85,241,248,0.06) 1px,transparent 1px); 
    background-size:40px 40px; 
  }
  
  .scanlines::after { 
    content:''; position:absolute; inset:0; 
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.2) 2px,rgba(0,0,0,0.2) 4px); 
    pointer-events:none; z-index:5; mix-blend-mode:multiply; 
  }
  
  .vignette::before { 
    content:''; position:absolute; inset:0; 
    background:radial-gradient(ellipse at center,transparent 30%,rgba(3,3,15,0.85) 100%); 
    pointer-events:none; z-index:4; 
  }
  
  .btn-neon { transition:transform .15s, filter .15s; user-select:none; cursor:pointer; }
  .btn-neon:hover { transform:translateY(-1px); filter:brightness(1.25); }
  .btn-neon:active { transform:translateY(1px) scale(.96); }
  
  @keyframes pulse-glow { 0%,100%{opacity:.65; filter:brightness(1);} 50%{opacity:1; filter:brightness(1.4);} }
  .pulse-glow { animation:pulse-glow 2s ease-in-out infinite; }
  
  @keyframes flicker { 0%,100%{opacity:1;} 47%{opacity:1;} 48%{opacity:.4;} 49%{opacity:1;} 50%{opacity:.6;} 51%{opacity:1;} }
  .flicker { animation:flicker 5s infinite; }
  
  @keyframes spin-ring { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .spin-ring { animation: spin-ring 12s linear infinite; }
  .spin-ring-reverse { animation: spin-ring 8s linear infinite reverse; }

  @keyframes float-orb { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; } 50% { transform: translateY(-15px) scale(1.1); opacity: 0.6; } }
  .float-orb-1 { animation: float-orb 4s ease-in-out infinite; }
  .float-orb-2 { animation: float-orb 6s ease-in-out infinite 1s; }

  @keyframes fade-up { from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:translateY(0);} }
  .fade-up { animation:fade-up .7s cubic-bezier(.16,1,.3,1) both; }
  
  .hidden { display:none!important; }
  #title-canvas { display:block; width:100%; height:100%; }
  
  #flash-overlay { 
    position:fixed; inset:0; 
    background: radial-gradient(circle at center, #ffffff 0%, #55F1F8 60%, #03030f 100%);
    opacity:0; pointer-events:none; z-index:60; 
    transition: opacity 0.05s linear;
  }

  @media (prefers-reduced-motion: reduce) { .pulse-glow, .flicker, .float-orb-1, .float-orb-2, .spin-ring, .spin-ring-reverse { animation:none!important; } }

  .font-title { font-family:'Orbitron',sans-serif; }
  #main-title {
    font-size: clamp(2rem, 6.5vw, 3.75rem);
    letter-spacing: 0.08em;
    text-shadow: 0 0 8px #55F1F8, 0 0 24px rgba(85,241,248,0.7), 0 0 48px rgba(48,150,199,0.4), 0 2px 12px rgba(0,0,0,0.6);
  }
  #tap-begin {
    letter-spacing: 0.45em;
    text-shadow: 0 0 10px rgba(85,241,248,0.6);
  }
  @keyframes tap-pulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }
  .tap-pulse { animation: tap-pulse 2.2s ease-in-out infinite; }

  #network-badge {
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
</style>
</head>
<body class="bg-grid">

<!-- LOADING SCREEN -->
<div id="loading-screen" class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#03030f] overflow-hidden">
  <div class="absolute w-[350px] h-[350px] rounded-full bg-[#55F1F8]/10 blur-[100px] float-orb-1 pointer-events-none"></div>
  <div class="absolute w-[280px] h-[280px] rounded-full bg-[#3096C7]/15 blur-[90px] float-orb-2 pointer-events-none"></div>

  <div class="relative z-10 flex flex-col items-center">
    <div class="relative w-32 h-32 mb-6 flex items-center justify-center">
      <div class="absolute inset-0 rounded-full border-2 border-dashed border-[#55F1F8]/40 spin-ring"></div>
      <div class="absolute inset-2 rounded-full border border-dotted border-[#3096C7]/60 spin-ring-reverse"></div>
      <div id="loading-pct" class="font-display font-black text-2xl neon-cyan">0%</div>
    </div>

    <div class="font-display font-black text-2xl md:text-4xl neon-cyan flicker mb-4 tracking-widest text-center">AGHIMUAN LIBRARY</div>
    
    <div class="w-64 md:w-80 h-1.5 rounded-full bg-white/10 overflow-hidden border border-[#55F1F8]/40 relative">
      <div id="loading-bar" class="h-full rounded-full transition-all duration-75" style="width:0%;background:linear-gradient(90deg,#3096C7,#55F1F8);box-shadow:0 0 14px #55F1F8;"></div>
    </div>
    
    <div id="loading-label" class="mt-4 text-[11px] md:text-xs uppercase tracking-[0.35em] text-white/70 font-display text-center">INITIALIZING_SYSTEM</div>
  </div>
</div>

<!-- TITLE SCREEN -->
<div id="title-screen" class="fixed inset-0 z-40 hidden">
  <canvas id="title-canvas"></canvas>
  <div class="absolute inset-0 scanlines vignette pointer-events-none"></div>

  <div class="absolute top-4 right-4 z-10 flex flex-col gap-3 items-end">
    <button id="info-btn" class="btn-neon w-10 h-10 rounded-full bg-black/50 border border-[#3096C7]/40 flex items-center justify-center text-[#3096C7] backdrop-blur" aria-label="Information">&#8505;</button>
  </div>

  <!-- Centered title moment -->
  <div id="title-block" class="absolute inset-x-0 top-[42%] -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none px-6 text-center">
    <h1 id="main-title" class="font-title font-black text-white glow">AGHIMUAN LIBRARY</h1>
    <div class="mt-4 flex items-center gap-3 opacity-80">
      <span class="h-px w-10 md:w-16 bg-[#55F1F8]/50"></span>
      <span class="text-[#55F1F8] text-xs">&#10022;</span>
      <span class="h-px w-10 md:w-16 bg-[#55F1F8]/50"></span>
    </div>
    <p id="tap-begin" class="tap-pulse mt-4 font-display text-sm md:text-base font-bold text-[#55F1F8] uppercase">Tap to Open</p>
  </div>

  <!-- Decorative network badge, echoes a server-select pill — informational only -->
  <div id="network-badge" class="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/50 border border-[#55F1F8]/30 rounded-lg px-4 py-2 pointer-events-none">
    <span class="w-4 h-4 rounded-full border border-[#55F1F8]/60 flex items-center justify-center text-[#55F1F8] text-[10px]">&#10003;</span>
    <span class="font-display text-[11px] md:text-xs tracking-[0.15em] text-white/85">AGHIMUAN NETWORK &middot; PCU-D</span>
  </div>

  <!-- Click target for sign-in; the big "TAP TO BEGIN" moment now lives in #title-block above -->
  <div id="click-begin-bar" class="absolute bottom-0 inset-x-0 z-20 bg-black/60 backdrop-blur-md border-t border-[#55F1F8]/30 py-3 text-center btn-neon group cursor-pointer">
    <span class="font-display text-[10px] md:text-xs tracking-[0.35em] text-white/60 group-hover:text-[#55F1F8] transition-colors">PCU GMAIL SIGN-IN</span>
    <p id="status" class="mt-1.5 text-xs text-red-400 min-h-[1em] pointer-events-none tracking-normal font-normal"></p>
  </div>

  <div id="info-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center px-6">
    <div class="absolute inset-0 bg-black/75 backdrop-blur-sm" id="info-modal-backdrop"></div>
    <div class="relative rounded-xl border neon-border-cyan bg-[#03037e]/50 backdrop-blur-md px-6 py-7 md:px-9 md:py-8 max-w-xs md:max-w-sm w-full text-center fade-up">
      <button id="info-modal-close" class="btn-neon absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 border border-[#55F1F8]/40 flex items-center justify-center text-[#55F1F8] text-xs" aria-label="Close">&#10005;</button>
      <p class="font-display text-sm md:text-base neon-cyan tracking-wide leading-relaxed">yes, it's inspired by honkai and genshin.</p>
      <p class="mt-3 text-[10px] md:text-xs text-white/30 tracking-[0.3em] uppercase">- renyuzaki</p>
    </div>
  </div>
</div>

<div id="flash-overlay"></div>

<audio id="bgm-audio" src="/library/audio/library-theme.mp3" preload="auto" loop></audio>

<script>
/* LOADING SCREEN */
const LOAD_LABELS = ['INITIALIZING_MODULES', 'SYNCING_NETWORK_NODES', 'CALIBRATING_GATEWAY', 'ESTABLISHING_LINK'];
function runLoadingScreen(onDone) {
  const bar = document.getElementById('loading-bar');
  const label = document.getElementById('loading-label');
  const pctText = document.getElementById('loading-pct');
  const start = performance.now();
  const minDuration = 1800;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / minDuration);
    const eased = Math.pow(progress, 2); 
    const pct = Math.floor(eased * 100);

    bar.style.width = pct + '%';
    pctText.textContent = pct + '%';
    
    const labelIdx = Math.min(LOAD_LABELS.length - 1, Math.floor(progress * LOAD_LABELS.length));
    label.textContent = LOAD_LABELS[labelIdx];

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      const screen = document.getElementById('loading-screen');
      screen.style.transition = 'opacity .6s cubic-bezier(0.16, 1, 0.3, 1)';
      screen.style.opacity = '0';
      setTimeout(() => { screen.classList.add('hidden'); onDone(); }, 600);
    }
  }
  requestAnimationFrame(tick);
}

/* TITLE SCREEN (3D) */
let scene, camera, renderer, clock;
let skyboxGroup, galaxyClusters = [], megastructureGroup, titanRingInner, celestialOrbGroup;
let pillars = [], holographicArches = [], floatingShapes = [], bridgeSegments = [], clouds = [], particles;
let pcbTextureInstance;
let doorGroup, doorLeftHinge, doorRightHinge, portalCore, portalGlow, doorBurst, outerRing, middleRing, innerRing;

let worldSpeed = 12; 
let phase = 'IDLE'; 
let phaseTimer = 0;

const DECEL_TIME = 0.8;
const FORM_TIME = 1.0;
const OPEN_TIME = 0.8;
const DASH_TIME = 1.0;

const DOOR_Z = -22; 
const FRAME_Y = 3.6;
const PILLAR_COLORS = [0x3096C7, 0x55F1F8, 0xF1F2F5, 0x9370DB];

function randRange(a, b) { return a + Math.random() * (b - a); }

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(85, 241, 248, 0.6)');
  grad.addColorStop(0.6, 'rgba(48, 150, 199, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createPCBTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#020512';
  ctx.fillRect(0, 0, 512, 1024);

  ctx.strokeStyle = 'rgba(48, 150, 199, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y < 1024; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(85, 241, 248, 0.85)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#55F1F8';
  ctx.shadowBlur = 10;

  const traces = 24;
  for (let i = 0; i < traces; i++) {
    let x = (i / traces) * 512 + 10;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);

    while (y < 1024) {
      const stepY = 30 + Math.random() * 50;
      const turn = (Math.random() - 0.5) * 60;
      y += stepY;
      x += turn;
      ctx.lineTo(x, y);

      if (Math.random() > 0.3) {
        ctx.fillStyle = Math.random() > 0.5 ? '#55F1F8' : '#3096C7';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#55F1F8';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 1024);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(85, 241, 248, 0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(32, 0); ctx.lineTo(32, 1024);
  ctx.moveTo(480, 0); ctx.lineTo(480, 1024);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

function createNebulaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#02030d';
  ctx.fillRect(0, 0, 1024, 1024);

  const nebulae = [
    { x: 300, y: 350, r: 480, color: 'rgba(85, 241, 248, 0.32)' },
    { x: 750, y: 300, r: 520, color: 'rgba(48, 150, 199, 0.38)' },
    { x: 500, y: 650, r: 550, color: 'rgba(110, 45, 200, 0.40)' },
    { x: 200, y: 750, r: 420, color: 'rgba(160, 60, 240, 0.28)' },
    { x: 850, y: 800, r: 380, color: 'rgba(85, 241, 248, 0.25)' },
    { x: 512, y: 250, r: 600, color: 'rgba(30, 20, 90, 0.50)' }
  ];

  nebulae.forEach(n => {
    const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
    g.addColorStop(0, n.color);
    g.addColorStop(0.4, n.color.replace(/[\d\.]+\)$/, '0.12)'));
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  });

  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const sz = Math.random() * 1.8 + 0.3;
    ctx.fillStyle = Math.random() > 0.3 ? 'rgba(255,255,255,0.95)' : 'rgba(85,241,248,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createDeepStarfield() {
  const count = 4000;
  const posArr = new Float32Array(count * 3);
  const colorArr = new Float32Array(count * 3);

  const palette = [
    new THREE.Color(0x55F1F8),
    new THREE.Color(0x3096C7),
    new THREE.Color(0xFFFFFF),
    new THREE.Color(0xB19CD9),
    new THREE.Color(0x4169E1)
  ];

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = randRange(650, 1300);

    posArr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    posArr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    posArr[i * 3 + 2] = r * Math.cos(phi);

    const color = palette[Math.floor(Math.random() * palette.length)];
    colorArr[i * 3]     = color.r;
    colorArr[i * 3 + 1] = color.g;
    colorArr[i * 3 + 2] = color.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));

  const mat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
  });

  const starfield = new THREE.Points(geo, mat);
  skyboxGroup.add(starfield);
}

function createCelestialOrb() {
  celestialOrbGroup = new THREE.Group();
  celestialOrbGroup.position.set(220, 160, -950);

  const coreGeo = new THREE.IcosahedronGeometry(85, 4);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a1435 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  celestialOrbGroup.add(core);

  const wireMat = new THREE.MeshBasicMaterial({ color: 0x55F1F8, wireframe: true, transparent: true, opacity: 0.6 });
  const wire = new THREE.Mesh(coreGeo, wireMat);
  wire.scale.set(1.05, 1.05, 1.05);
  celestialOrbGroup.add(wire);

  const auraGeo = new THREE.SphereGeometry(110, 32, 32);
  const auraMat = new THREE.MeshBasicMaterial({ color: 0x3096C7, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  celestialOrbGroup.add(new THREE.Mesh(auraGeo, auraMat));

  const ringGeo = new THREE.RingGeometry(130, 190, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x55F1F8, side: THREE.DoubleSide, transparent: true, opacity: 0.4, wireframe: true });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI * 0.42;
  celestialOrbGroup.add(ring);

  skyboxGroup.add(celestialOrbGroup);
}

function createMegastructure() {
  megastructureGroup = new THREE.Group();
  megastructureGroup.position.set(0, 120, -1100);

  const ringGeo = new THREE.TorusGeometry(680, 18, 24, 120);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0a1226 });
  const outerRingMesh = new THREE.Mesh(ringGeo, ringMat);
  outerRingMesh.userData.isSolidBody = true;
  megastructureGroup.add(outerRingMesh);

  const ringLineGeo = new THREE.EdgesGeometry(ringGeo);
  const ringLineMat = new THREE.LineBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.7 });
  const ringLines = new THREE.LineSegments(ringLineGeo, ringLineMat);
  outerRingMesh.add(ringLines);

  const innerEnergyGeo = new THREE.TorusGeometry(630, 6, 16, 120);
  const innerEnergyMat = new THREE.MeshBasicMaterial({ color: 0x3096C7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
  titanRingInner = new THREE.Mesh(innerEnergyGeo, innerEnergyMat);
  megastructureGroup.add(titanRingInner);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const spireGroup = new THREE.Group();
    spireGroup.rotation.z = angle;

    const spireGeo = new THREE.BoxGeometry(24, 320, 24);
    const spireMat = new THREE.MeshBasicMaterial({ color: 0x060b1a });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 710;
    spireGroup.add(spire);

    const spireEdge = new THREE.LineSegments(new THREE.EdgesGeometry(spireGeo), new THREE.LineBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.75 }));
    spire.add(spireEdge);

    megastructureGroup.add(spireGroup);
  }

  megastructureGroup.rotation.x = Math.PI * 0.32;
  megastructureGroup.rotation.y = -Math.PI * 0.06;

  skyboxGroup.add(megastructureGroup);
}

function createNetworkSkybox() {
  skyboxGroup = new THREE.Group();
  const glowTexture = createGlowTexture();
  const bgNebulaTexture = createNebulaTexture();

  const bgDomeGeo = new THREE.SphereGeometry(1400, 32, 32);
  const bgDomeMat = new THREE.MeshBasicMaterial({
    map: bgNebulaTexture,
    side: THREE.BackSide,
    depthWrite: false
  });
  const bgDome = new THREE.Mesh(bgDomeGeo, bgDomeMat);
  skyboxGroup.add(bgDome);

  createDeepStarfield();
  createCelestialOrb();
  createMegastructure();

  const clusterConfigs = [
    { center: new THREE.Vector3(-160, 70, -240), radius: 60, arms: 2, color: 0x55F1F8, count: 280, pFactor: 0.75 },
    { center: new THREE.Vector3(200, -35, -400), radius: 90, arms: 3, color: 0x3096C7, count: 340, pFactor: 0.5 },
    { center: new THREE.Vector3(-300, 240, -650), radius: 140, arms: 3, color: 0x87CEFA, count: 400, pFactor: 0.28 },
    { center: new THREE.Vector3(400, 280, -920), radius: 220, arms: 4, color: 0x9370DB, count: 480, pFactor: 0.12 },
    { center: new THREE.Vector3(-440, -180, -860), radius: 170, arms: 3, color: 0x55F1F8, count: 360, pFactor: 0.2 }
  ];

  galaxyClusters = [];

  clusterConfigs.forEach(cfg => {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.copy(cfg.center);

    const coreSpriteMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: cfg.color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const coreSprite = new THREE.Sprite(coreSpriteMat);
    coreSprite.scale.set(cfg.radius * 1.2, cfg.radius * 1.2, 1);
    clusterGroup.add(coreSprite);

    const starPositions = [];
    const linePositions = [];
    const nodes = [];

    for (let i = 0; i < cfg.count; i++) {
      const armIndex = i % cfg.arms;
      const armAngle = (armIndex * (2 * Math.PI / cfg.arms));
      const distRatio = Math.pow(Math.random(), 1.4);
      const r = distRatio * cfg.radius;
      const spiralAngle = r * 0.038;
      const finalAngle = armAngle + spiralAngle + (Math.random() - 0.5) * 0.32;

      const x = Math.cos(finalAngle) * r;
      const y = (Math.random() - 0.5) * (cfg.radius * 0.18) * (1 - distRatio * 0.5);
      const z = Math.sin(finalAngle) * r;

      const pt = new THREE.Vector3(x, y, z);
      nodes.push(pt);
      starPositions.push(x, y, z);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMat = new THREE.PointsMaterial({
      color: cfg.color,
      size: 1.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    clusterGroup.add(starPoints);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].distanceTo(nodes[j]);
        if (d < cfg.radius * 0.15) {
          linePositions.push(nodes[i].x, nodes[i].y, nodes[i].z);
          linePositions.push(nodes[j].x, nodes[j].y, nodes[j].z);
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending
    });
    const webLines = new THREE.LineSegments(lineGeo, lineMat);
    clusterGroup.add(webLines);

    clusterGroup.rotation.x = Math.random() * Math.PI;
    clusterGroup.rotation.z = Math.random() * Math.PI;

    skyboxGroup.add(clusterGroup);
    galaxyClusters.push({
      group: clusterGroup,
      rotSpeed: randRange(0.015, 0.035),
      parallaxFactor: cfg.pFactor,
      basePos: cfg.center.clone()
    });
  });

  scene.add(skyboxGroup);
}

function updateNetworkPackets(dt) {
  if (!skyboxGroup) return;
  skyboxGroup.rotation.y += 0.0008 * dt;

  if (megastructureGroup) megastructureGroup.rotation.z += 0.0015 * dt;
  if (titanRingInner) titanRingInner.rotation.z -= 0.003 * dt;
  if (celestialOrbGroup) celestialOrbGroup.rotation.y += 0.006 * dt;

  galaxyClusters.forEach(c => {
    c.group.rotation.y += c.rotSpeed * dt;
    c.group.position.x = c.basePos.x + Math.sin(clock.elapsedTime * 0.2) * (15 * c.parallaxFactor);
  });
}

function applyDistanceFade(obj) {
  const z = obj.position.z;
  
  obj.traverse((child) => {
    if (child.userData.isSolidBody) {
      if (z < -80) {
        child.material.transparent = true;
        child.material.opacity = THREE.MathUtils.clamp((z + 100) / 20, 0, 1);
      } else {
        child.material.transparent = false;
        child.material.opacity = 1.0;
      }
      return;
    }

    let alpha = 1;
    if (z < -60) {
      alpha = THREE.MathUtils.clamp((z + 100) / 40, 0, 1);
    }

    if (child.material) {
      if (child.userData.baseOpacity === undefined) {
        child.userData.baseOpacity = child.material.opacity !== undefined ? child.material.opacity : 1.0;
      }
      child.material.transparent = true;
      child.material.opacity = child.userData.baseOpacity * alpha;
    }
  });
}

function makePillar() {
  const pillarType = Math.floor(Math.random() * 4);
  const color = PILLAR_COLORS[Math.floor(Math.random() * PILLAR_COLORS.length)];
  const group = new THREE.Group();

  if (pillarType === 0) {
    const h = randRange(320, 480);
    const w = randRange(4.5, 6.5);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.35, w, h, 6),
      new THREE.MeshBasicMaterial({ color: 0x020308, transparent: false })
    );
    body.position.y = h / 2 - 40;
    body.userData.isSolidBody = true;
    group.add(body);

    const edges = new THREE.EdgesGeometry(body.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }));
    body.add(line);

    for (let r = 0; r < 7; r++) {
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(w * 1.35, 0.3, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.5 })
      );
      ringMesh.position.y = (r - 3) * 55;
      ringMesh.rotation.x = Math.PI / 2;
      body.add(ringMesh);
    }
  } 
  else if (pillarType === 1) {
    const h = randRange(45, 75);
    const w = randRange(8.0, 11.0);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshBasicMaterial({ color: 0x030510, transparent: false })
    );
    body.position.y = -h / 2 + 5;
    body.userData.isSolidBody = true;
    group.add(body);

    const line = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    body.add(line);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(w * 0.45, 0),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.85 })
    );
    crystal.position.y = 8;
    crystal.userData.isFloatingCrystal = true;
    group.add(crystal);
  } 
  else if (pillarType === 2) {
    const h = randRange(140, 220);
    const radius = randRange(3.8, 5.8);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, h, 6),
      new THREE.MeshBasicMaterial({ color: 0x02040b, transparent: false })
    );
    body.position.y = -h / 2 + 10;
    body.userData.isSolidBody = true;
    group.add(body);

    const line = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
    body.add(line);

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, h * 0.9, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.8 })
      );
      rail.position.set(Math.cos(ang) * (radius + 0.18), 0, Math.sin(ang) * (radius + 0.18));
      body.add(rail);
    }
  } 
  else {
    const h = randRange(130, 210);
    const baseW = randRange(5.2, 7.2);
    const numSegments = 5;
    const segH = h / numSegments;

    const pillarContainer = new THREE.Group();
    pillarContainer.position.y = -h / 2 + 10;
    group.add(pillarContainer);

    for (let s = 0; s < numSegments; s++) {
      const segW = baseW * (1 - s * 0.08);
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(segW, segH * 0.85, segW),
        new THREE.MeshBasicMaterial({ color: 0x03040c, transparent: false })
      );
      seg.position.y = (s - numSegments / 2) * segH;
      seg.userData.isSolidBody = true;
      pillarContainer.add(seg);

      const line = new THREE.LineSegments(new THREE.EdgesGeometry(seg.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }));
      seg.add(line);

      if (s < numSegments - 1) {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(segW * 1.05, 0.3, segW * 1.05),
          new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.9 })
        );
        pad.position.y = (s - numSegments / 2) * segH + segH * 0.45;
        pillarContainer.add(pad);
      }
    }
  }

  return group;
}

function placePillar(group, z) {
  const minSpacing = 24;
  const maxAttempts = 20;
  let bestX = (Math.random() < 0.5 ? -1 : 1) * randRange(24, 65);
  let bestZ = z;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const testX = side * randRange(22, 65);
    const testZ = z + randRange(-6, 6);

    let overlapping = false;
    for (let i = 0; i < pillars.length; i++) {
      const other = pillars[i];
      if (other === group) continue;
      const dx = other.position.x - testX;
      const dz = other.position.z - testZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minSpacing) {
        overlapping = true;
        break;
      }
    }

    if (!overlapping) {
      bestX = testX;
      bestZ = testZ;
      break;
    }
  }

  group.position.set(bestX, 0, bestZ);
}

function makeHolographicArch() {
  const group = new THREE.Group();
  
  const archRadius = 9.5;
  const archGeo = new THREE.TorusGeometry(archRadius, 0.15, 8, 32, Math.PI);
  const archMat = new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
  const archMesh = new THREE.Mesh(archGeo, archMat);
  group.add(archMesh);

  const outerArcGeo = new THREE.TorusGeometry(archRadius + 0.8, 0.08, 6, 24, Math.PI * 0.8);
  const outerArcMat = new THREE.MeshBasicMaterial({ color: 0x3096C7, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
  const outerArc = new THREE.Mesh(outerArcGeo, outerArcMat);
  outerArc.rotation.z = Math.PI * 0.1;
  group.add(outerArc);

  for (let i = 1; i <= 5; i++) {
    const angle = (i / 6) * Math.PI;
    const nodeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.06, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    nodeRing.position.set(Math.cos(angle) * archRadius, Math.sin(angle) * archRadius, 0);
    nodeRing.rotation.y = Math.PI / 2;
    group.add(nodeRing);
  }

  for (let side = -1; side <= 1; side += 2) {
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 8);
    const postMat = new THREE.MeshBasicMaterial({ color: 0x3096C7, transparent: true, opacity: 0.75 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(side * archRadius, -4.0, 0);
    group.add(post);
  }

  group.position.y = 0.5;
  return group;
}

function placeHolographicArch(mesh, z) {
  mesh.position.set(0, 0.5, z);
}

function makeFloatingShape() {
  const geo = new THREE.IcosahedronGeometry(randRange(0.8, 2.0), 0);
  const mat = new THREE.MeshBasicMaterial({ color: PILLAR_COLORS[Math.floor(Math.random() * 3)], wireframe: true, transparent: true, opacity: 0.7 });
  return new THREE.Mesh(geo, mat);
}

function placeShape(mesh, z) {
  mesh.position.set(randRange(-18, 18), randRange(4, 22), z);
  mesh.userData.spinX = randRange(-0.015, 0.015);
  mesh.userData.spinY = randRange(-0.015, 0.015);
}

function makeCloud() {
  const geo = new THREE.IcosahedronGeometry(randRange(35, 75), 0);
  geo.scale(randRange(1.2, 3.5), 0.25, randRange(1.2, 3.5)); 
  const mat = new THREE.MeshBasicMaterial({ color: 0x060918, transparent: true, opacity: 0.55 });
  return new THREE.Mesh(geo, mat);
}

function placeCloud(mesh, z) {
  mesh.position.set(randRange(-90, 90), randRange(-45, -25), z);
}

function makeBridgeSegment(pcbTexture) {
  const group = new THREE.Group();
  const segLength = 20;
  const width = 5.6;

  const baseGeo = new THREE.BoxGeometry(width, 0.6, segLength);
  const baseMat = new THREE.MeshBasicMaterial({ color: 0x030612 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -0.3;
  baseMesh.userData.isSolidBody = true;
  group.add(baseMesh);

  const pcbGeo = new THREE.PlaneGeometry(width * 0.9, segLength);
  const pcbMat = new THREE.MeshBasicMaterial({
    map: pcbTexture,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
  pcbMesh.rotation.x = -Math.PI / 2;
  pcbMesh.position.y = 0.01;
  group.add(pcbMesh);

  const glassGeo = new THREE.BoxGeometry(width * 0.92, 0.04, segLength);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.18 });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.y = 0.03;
  group.add(glassMesh);

  const line = new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo), new THREE.LineBasicMaterial({ color: 0x55F1F8, transparent: true, opacity: 0.8 }));
  line.position.y = -0.3;
  group.add(line);

  for (let side = -1; side <= 1; side += 2) {
    const railGeo = new THREE.BoxGeometry(0.22, 1.2, segLength);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x060f26 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(side * (width / 2), 0.6, 0);
    rail.userData.isSolidBody = true;
    group.add(rail);

    const railEdge = new THREE.LineSegments(new THREE.EdgesGeometry(railGeo), new THREE.LineBasicMaterial({ color: 0x3096C7, transparent: true, opacity: 0.85 }));
    rail.add(railEdge);

    const glowBarGeo = new THREE.BoxGeometry(0.1, 0.1, segLength);
    const glowBar = new THREE.Mesh(glowBarGeo, new THREE.MeshBasicMaterial({ color: 0x55F1F8 }));
    glowBar.position.set(side * (width / 2), 1.22, 0);
    group.add(glowBar);
  }

  return group;
}

function createGateModel() {
  doorGroup = new THREE.Group();

  const cyanColor = 0x55F1F8;
  const blueColor = 0x3096C7;
  const darkAlloy = 0x070b16;

  const DOOR_W = 5.2;
  const DOOR_H = 8.0;

  const frameShape = new THREE.Shape();
  const w = DOOR_W / 2 + 0.8;
  const h = DOOR_H / 2 + 0.8;
  const chamfer = 1.2;

  frameShape.moveTo(-w + chamfer, h);
  frameShape.lineTo(w - chamfer, h);
  frameShape.lineTo(w, h - chamfer);
  frameShape.lineTo(w, -h + chamfer);
  frameShape.lineTo(w - chamfer, -h);
  frameShape.lineTo(-w + chamfer, -h);
  frameShape.lineTo(-w, -h + chamfer);
  frameShape.lineTo(-w, h - chamfer);
  frameShape.closePath();

  const holePath = new THREE.Path();
  const iw = DOOR_W / 2;
  const ih = DOOR_H / 2;
  const ichamfer = 1.0;
  holePath.moveTo(-iw + ichamfer, ih);
  holePath.lineTo(iw - ichamfer, ih);
  holePath.lineTo(iw, ih - ichamfer);
  holePath.lineTo(iw, -ih + ichamfer);
  holePath.lineTo(iw - ichamfer, -ih);
  holePath.lineTo(-iw + ichamfer, -ih);
  holePath.lineTo(-iw, -ih + ichamfer);
  holePath.lineTo(-iw, ih - ichamfer);
  holePath.closePath();
  frameShape.holes.push(holePath);

  const extrudeSettings = { depth: 0.6, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
  const frameMat = new THREE.MeshBasicMaterial({ color: darkAlloy });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.set(0, FRAME_Y, -0.3);
  frameMesh.userData.isSolidBody = true;

  const frameEdges = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: cyanColor }));
  frameMesh.add(frameEdges);
  doorGroup.add(frameMesh);

  const cornerAngles = [
    { x: -w + chamfer / 2, y: h - chamfer / 2 },
    { x: w - chamfer / 2, y: h - chamfer / 2 },
    { x: w - chamfer / 2, y: -h + chamfer / 2 },
    { x: -w + chamfer / 2, y: -h + chamfer / 2 }
  ];

  cornerAngles.forEach(pt => {
    const nodeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.7), new THREE.MeshBasicMaterial({ color: cyanColor }));
    nodeMesh.position.set(pt.x, FRAME_Y + pt.y, 0);
    doorGroup.add(nodeMesh);
  });

  const ringMat1 = new THREE.MeshBasicMaterial({ color: cyanColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ringMat2 = new THREE.MeshBasicMaterial({ color: blueColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

  outerRing = new THREE.Mesh(new THREE.RingGeometry(DOOR_W * 0.65, DOOR_W * 0.68, 16), ringMat1);
  middleRing = new THREE.Mesh(new THREE.RingGeometry(DOOR_W * 0.45, DOOR_W * 0.48, 12), ringMat2);
  innerRing = new THREE.Mesh(new THREE.RingGeometry(DOOR_W * 0.28, DOOR_W * 0.30, 8), ringMat1);

  [outerRing, middleRing, innerRing].forEach(r => {
    r.position.set(0, FRAME_Y, -0.05);
    doorGroup.add(r);
  });

  portalCore = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_W + 0.2, DOOR_H + 0.2), 
    new THREE.MeshBasicMaterial({ color: 0x03037E, transparent: true, opacity: 0.95 })
  );
  portalCore.position.set(0, FRAME_Y, -0.2);
  doorGroup.add(portalCore);

  portalGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_W + 1.8, DOOR_H + 1.8),
    new THREE.MeshBasicMaterial({ color: cyanColor, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  portalGlow.position.set(0, FRAME_Y, -0.25);
  doorGroup.add(portalGlow);

  function buildAirlockPanel(side) {
    const hinge = new THREE.Group();
    hinge.position.set(side * DOOR_W / 2, FRAME_Y, 0);

    const leafShape = new THREE.Shape();
    const pw = DOOR_W / 2;
    const ph = DOOR_H / 2;
    const pchamfer = 0.8;

    leafShape.moveTo(0, ph);
    leafShape.lineTo(-side * (pw - pchamfer), ph);
    leafShape.lineTo(-side * pw, ph - pchamfer);
    leafShape.lineTo(-side * pw, -ph + pchamfer);
    leafShape.lineTo(-side * (pw - pchamfer), -ph);
    leafShape.lineTo(0, -ph);
    leafShape.closePath();

    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
    
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x0b132b, transparent: true, opacity: 0.88 });
    const panel = new THREE.Mesh(leafGeo, glassMat);
    panel.userData.isSolidBody = true;

    const glassEdges = new THREE.LineSegments(new THREE.EdgesGeometry(leafGeo), new THREE.LineBasicMaterial({ color: cyanColor, transparent: true, opacity: 0.9 }));
    panel.add(glassEdges);

    for (let i = -2; i <= 2; i++) {
      const stripGeo = new THREE.BoxGeometry(pw * 0.7, 0.06, 0.16);
      stripGeo.translate(-side * (pw * 0.45), i * 1.2, 0.06);
      const strip = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: cyanColor }));
      panel.add(strip);
    }

    const latchGeo = new THREE.BoxGeometry(0.12, ph * 1.6, 0.18);
    latchGeo.translate(-side * 0.06, 0, 0.06);
    const latch = new THREE.Mesh(latchGeo, new THREE.MeshBasicMaterial({ color: cyanColor }));
    panel.add(latch);

    hinge.add(panel);
    doorGroup.add(hinge);
    return hinge;
  }

  doorLeftHinge = buildAirlockPanel(-1);
  doorRightHinge = buildAirlockPanel(1);

  doorGroup.position.set(0, 0, DOOR_Z);
  doorGroup.scale.set(0, 0, 0);
  doorGroup.visible = false;
  scene.add(doorGroup);
}

function initTitleScene() {
  const canvas = document.getElementById('title-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050714, 0.001); 

  camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, 2.4, 0); 

  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050714, 1);

  pcbTextureInstance = createPCBTexture();

  createNetworkSkybox();
  createGateModel();

  const gridHelper = new THREE.GridHelper(600, 120, 0x3096C7, 0x0c0e20);
  gridHelper.position.set(0, -40, -100);
  scene.add(gridHelper);

  for (let i = 0; i < 14; i++) { const g = makePillar(); placePillar(g, -randRange(0, 100)); scene.add(g); pillars.push(g); }
  for (let i = 0; i < 5; i++) { const arch = makeHolographicArch(); placeHolographicArch(arch, -i * 24 - 10); scene.add(arch); holographicArches.push(arch); }
  for (let i = 0; i < 12; i++) { const m = makeFloatingShape(); placeShape(m, -randRange(0, 100)); scene.add(m); floatingShapes.push(m); }
  for (let i = 0; i < 10; i++) { const m = makeCloud(); placeCloud(m, -randRange(0, 120)); scene.add(m); clouds.push(m); }

  for (let i = 0; i < 6; i++) {
    const seg = makeBridgeSegment(pcbTextureInstance);
    seg.position.z = -i * 20 + 10; 
    scene.add(seg);
    bridgeSegments.push(seg);
  }

  const pCount = 350;
  const posArr = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    posArr[i*3]   = (Math.random() - 0.5) * 120;
    posArr[i*3+1] = Math.random() * 40 - 10; 
    posArr[i*3+2] = -Math.random() * 120;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color:0x9be9ff, size:0.18, transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(particles);

  const BURST_COUNT = 120;
  const burstPos = new Float32Array(BURST_COUNT * 3);
  const burstVel = new Float32Array(BURST_COUNT * 3);
  for (let i = 0; i < BURST_COUNT; i++) {
    burstPos[i*3] = 0; burstPos[i*3+1] = 0; burstPos[i*3+2] = 0;
    const ang = Math.random() * Math.PI * 2;
    const spd = randRange(3, 8);
    burstVel[i*3]   = Math.cos(ang) * spd;
    burstVel[i*3+1] = randRange(-1, 5);
    burstVel[i*3+2] = randRange(2, 7);
  }
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  burstGeo.userData.velocities = burstVel;
  doorBurst = new THREE.Points(burstGeo, new THREE.PointsMaterial({ color: 0x55F1F8, size: 0.2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  doorBurst.position.set(0, FRAME_Y, DOOR_Z);
  doorBurst.userData.active = false;
  scene.add(doorBurst);

  clock = new THREE.Clock();
  animateTitle();
}

function animateTitle() {
  requestAnimationFrame(animateTitle);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;
  phaseTimer += dt;

  let currentSpeed = worldSpeed;
  let camZ = camera.position.z;

  updateNetworkPackets(dt);

  if (pcbTextureInstance) {
    pcbTextureInstance.offset.y -= dt * 0.15;
  }

  if (outerRing) {
    outerRing.rotation.z += 0.3 * dt;
    middleRing.rotation.z -= 0.5 * dt;
    innerRing.rotation.z += 0.8 * dt;
  }

  if (phase === 'IDLE') {
    currentSpeed = 12;
    camera.position.y = 2.4 + Math.sin(t * 0.8) * 0.08;
  } 
  else if (phase === 'DECEL') {
    const p = Math.min(1, phaseTimer / DECEL_TIME);
    const ease = 1 - Math.pow(1 - p, 3);
    currentSpeed = 12 * (1 - ease);
    if (p >= 1) { 
      phase = 'FORM'; 
      phaseTimer = 0; 
      doorGroup.visible = true;
    }
  } 
  else if (phase === 'FORM') {
    currentSpeed = 0;
    const p = Math.min(1, phaseTimer / FORM_TIME);
    const ease = 1 - Math.pow(1 - p, 3);
    doorGroup.scale.set(ease, ease, ease);
    
    if (p >= 1) { 
      phase = 'OPEN'; 
      phaseTimer = 0; 
    }
  } 
  else if (phase === 'OPEN') {
    currentSpeed = 0;
    const p = Math.min(1, phaseTimer / OPEN_TIME);
    const ease = 1 - Math.pow(1 - p, 3);
    const swingAngle = ease * (Math.PI * 0.62);
    doorLeftHinge.rotation.y = -swingAngle;
    doorRightHinge.rotation.y = swingAngle;

    portalGlow.material.opacity = 0.5 + Math.sin(t * 15) * 0.3;

    if (!doorBurst.userData.active) {
      doorBurst.userData.active = true;
      doorBurst.userData.age = 0;
    }

    if (p >= 1) { 
      phase = 'DASH'; 
      phaseTimer = 0; 
    }
  } 
  else if (phase === 'DASH') {
    currentSpeed = 0; 
    const p = Math.min(1, phaseTimer / DASH_TIME);
    const ease = p * p * p; 
    
    camera.fov = 68 + ease * 32;
    camera.updateProjectionMatrix();

    camera.position.z = THREE.MathUtils.lerp(0, DOOR_Z + 0.5, ease); 
    
    if (p > 0.4) {
      const flashAlpha = Math.min(1, (p - 0.4) / 0.5);
      document.getElementById('flash-overlay').style.opacity = String(flashAlpha);
    }
    if (p >= 1) {
      phase = 'DONE';
      finishEnterHome();
    }
  }

  if (doorBurst.userData.active) {
    doorBurst.userData.age += dt;
    const a = doorBurst.userData.age;
    const posAttr = doorBurst.geometry.attributes.position;
    const vel = doorBurst.geometry.userData.velocities;
    for (let i = 0; i < posAttr.count; i++) {
      const ix = i * 3;
      posAttr.array[ix]   += vel[ix]   * dt;
      posAttr.array[ix+1] += vel[ix+1] * dt;
      posAttr.array[ix+2] += vel[ix+2] * dt;
    }
    posAttr.needsUpdate = true;
    doorBurst.material.opacity = Math.max(0, 1 - (a / 1.0));
    if (a >= 1.0) doorBurst.userData.active = false;
  }

  camera.lookAt(0, FRAME_Y + 0.2, camZ - 20);

  const recycleDist = 120;
  
  pillars.forEach(p => { 
    p.position.z += currentSpeed * dt; 
    p.traverse((child) => {
      if (child.userData.isFloatingCrystal) {
        child.rotation.y += 0.02;
        child.rotation.x += 0.01;
      }
    });
    if (p.position.z > camZ + 10) placePillar(p, p.position.z - recycleDist); 
    applyDistanceFade(p);
  });
  
  holographicArches.forEach(arch => { 
    arch.position.z += currentSpeed * dt; 
    if (arch.position.z > camZ + 10) placeHolographicArch(arch, arch.position.z - recycleDist); 
    applyDistanceFade(arch);
  });
  
  floatingShapes.forEach(s => { 
    s.position.z += currentSpeed * dt; 
    s.rotation.x += s.userData.spinX; 
    s.rotation.y += s.userData.spinY; 
    if (s.position.z > camZ + 10) placeShape(s, s.position.z - recycleDist); 
    applyDistanceFade(s);
  });
  
  clouds.forEach(c => { 
    c.position.z += currentSpeed * dt; 
    if (c.position.z > camZ + 40) placeCloud(c, c.position.z - recycleDist - 20); 
    applyDistanceFade(c);
  });
  
  bridgeSegments.forEach(seg => { 
    seg.position.z += currentSpeed * dt; 
    if (seg.position.z > camZ + 20) seg.position.z -= 120; 
    applyDistanceFade(seg);
  });

  const pPos = particles.geometry.attributes.position.array;
  for (let i = 0; i < pPos.length; i += 3) {
    pPos[i+2] += currentSpeed * dt;
    if (pPos[i+2] > camZ + 10) pPos[i+2] -= recycleDist;
  }
  particles.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

function beginFlight() {
  if (phase !== 'IDLE') return;
  phase = 'DECEL';
  phaseTimer = 0;
  document.getElementById('click-begin-bar').classList.add('hidden');
  document.getElementById('info-btn').classList.add('hidden');
  document.getElementById('title-block').classList.add('hidden');
  document.getElementById('network-badge').classList.add('hidden');

  const bgm = document.getElementById('bgm-audio');
  if (bgm && !bgm.paused) {
    const fadeStep = setInterval(() => {
      bgm.volume = Math.max(0, bgm.volume - 0.05);
      if (bgm.volume <= 0) { bgm.pause(); clearInterval(fadeStep); }
    }, 100);
  }
}

function setupInfoModal() {
  const btn = document.getElementById('info-btn');
  const modal = document.getElementById('info-modal');
  const closeBtn = document.getElementById('info-modal-close');
  const backdrop = document.getElementById('info-modal-backdrop');
  const open = (e) => { e.stopPropagation(); modal.classList.remove('hidden'); };
  const close = (e) => { if (e) e.stopPropagation(); modal.classList.add('hidden'); };
  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
}

function finishEnterHome() {
  // Redirect to library-home.php (or the ?next= parameter if provided)
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get('next') || '/library-home.php';
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupTitleInput() {
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('orientationchange', onWindowResize);
  
  // Note: The actual click listeners are attached at the bottom 
  // by the Firebase script to handle the async login flow properly.
  setupInfoModal();
}

/* BACKGROUND MUSIC — starts right as the title screen appears.
   Browsers block autoplay-with-sound unless it follows a user
   gesture, so if the direct play() attempt is blocked, it falls
   back to starting on the visitor's first click/tap/keypress. */
function startBGM() {
  const bgm = document.getElementById('bgm-audio');
  if (!bgm) return;
  bgm.volume = 0.4;

  const playPromise = bgm.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      const resume = () => { bgm.play().catch(() => {}); cleanup(); };
      const cleanup = () => {
        document.removeEventListener('click', resume);
        document.removeEventListener('touchstart', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('click', resume, { once: true });
      document.addEventListener('touchstart', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    });
  }
}

window.addEventListener('load', () => {
  runLoadingScreen(() => {
    document.getElementById('title-screen').classList.remove('hidden');
    initTitleScene();
    setupTitleInput();
    startBGM();
  });
});
</script>

<!-- Firebase Login Logic Integration -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyAavb6fsEoM2r55AIFG2uHZAOQBg2YPGIE",
    authDomain: "aghimuan-network.firebaseapp.com",
    projectId: "aghimuan-network",
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  // Hints Google's consent screen toward pcu.edu.ph accounts.
  // Real enforcement happens server-side in verify-reviewer.php.
  provider.setCustomParameters({ hd: 'pcu.edu.ph' });

  const statusEl = document.getElementById('status');

  // Function to handle the sign-in process
  async function handleSignIn() {
    // If the flight has already started, do nothing
    if (typeof phase !== 'undefined' && phase !== 'IDLE') return;
    
    statusEl.textContent = 'Authenticating...';
    statusEl.style.color = '#ffffffaa'; // White-ish for processing

    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/library/verify-reviewer.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();

      if (data.ok) {
        statusEl.textContent = 'Access Granted. Entering Library...';
        statusEl.style.color = '#55F1F8'; // Cyan for success
        // Trigger the 3D flight animation! 
        // The animation will automatically redirect them when it finishes.
        beginFlight();
      } else {
        statusEl.textContent = 'Access denied — please sign in with your PCU Gmail account.';
        statusEl.style.color = '#ff6b6b'; // Red for error
        await signOut(auth);
      }
    } catch (err) {
      statusEl.textContent = 'Sign-in failed or canceled. Please try again.';
      statusEl.style.color = '#ff6b6b';
    }
  }

  // Attach the sign-in handler to the title screen click events
  window.addEventListener('load', () => {
    document.getElementById('title-canvas').addEventListener('click', handleSignIn);
    document.getElementById('click-begin-bar').addEventListener('click', handleSignIn);
  });
</script>
</body>
</html>