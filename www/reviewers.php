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
<title>Aghimuan Library — ICT Reviewers for PCU-D Students</title>
<meta name="description" content="Study reviewers for PCU-D ICT tracks: programming, systems servicing, media literacy, and more. PCU Gmail sign-in required.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aghimuan">
<meta property="og:title" content="Aghimuan Library — ICT Reviewers for PCU-D Students">
<meta property="og:description" content="Study reviewers for PCU-D ICT tracks: programming, systems servicing, media literacy, and more.">
<meta property="og:url" content="https://aghimuan.online/reviewers.php">
<meta property="og:image" content="https://aghimuan.online/og-banner.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Aghimuan Library — ICT Reviewers for PCU-D Students">
<meta name="twitter:description" content="Study reviewers for PCU-D ICT tracks: programming, systems servicing, media literacy, and more.">
<meta name="twitter:image" content="https://aghimuan.online/og-banner.png">
<link rel="canonical" href="https://aghimuan.online/reviewers.php">
<link rel="describedby" href="https://aghimuan.online/llms.txt">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Aghimuan Library — ICT Reviewers",
  "description": "Study reviewers for PCU-D ICT tracks: computer programming, computer systems servicing, media and information literacy, empowerment technology, and visual graphics design.",
  "provider": {"@type": "Organization", "name": "Aghimuan", "url": "https://aghimuan.online/"},
  "url": "https://aghimuan.online/reviewers.php"
}
</script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="library/js/sfx.js"></script>
<style>
  :root{ --cyan:#55F1F8; --blue:#3096C7; --ice:#eafcff; --gold:#e8c88a; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden;background:#04060f;overscroll-behavior:none}
  html{background:#02040a}
  body{font-family:'Rajdhani',sans-serif;color:var(--ice);-webkit-font-smoothing:antialiased}
  .font-display{font-family:'Orbitron',sans-serif}

  /* ---------- LOADING ---------- */
  #loading-screen{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 30%,#0a1a3a 0%,#04060f 65%);transition:opacity .6s ease}
  #loading-screen.done{opacity:0;pointer-events:none}
  #load-title{font-size:13px;letter-spacing:.5em;text-indent:.5em;color:var(--cyan);font-weight:700}
  #load-bar-wrap{width:min(300px,64vw);height:2px;background:rgba(85,241,248,.15);margin:22px 0 12px}
  #load-bar{height:100%;width:0%;background:linear-gradient(90deg,var(--blue),var(--cyan));box-shadow:0 0 12px rgba(85,241,248,.8)}
  #load-meta{display:flex;justify-content:space-between;width:min(300px,64vw);font-size:10px;letter-spacing:.3em;color:rgba(234,252,255,.55)}
  #load-label{margin-top:14px;font-size:10px;letter-spacing:.35em;color:rgba(234,252,255,.5);min-height:1.2em}

  /* ---------- TITLE ---------- */
  #title-screen{position:fixed;inset:0;z-index:40;opacity:0;transition:opacity .8s ease}
  #title-screen.on{opacity:1}
  #c3d{position:absolute;inset:0;display:block;width:100%;height:100%}
  .vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,transparent 42%,rgba(2,4,10,.85) 100%)}
  .scanlines{position:absolute;inset:0;pointer-events:none;opacity:.22;
    background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.18) 3px,rgba(0,0,0,.18) 4px)}
  #white-veil{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#ffffff 0%,#d8faff 28%,#55F1F8 60%,rgba(85,241,248,.94) 100%);opacity:0;pointer-events:none}
  #title-block{position:absolute;inset-inline:0;top:50%;z-index:10;text-align:center;padding:28px 24px;pointer-events:none;
    background:radial-gradient(ellipse at center,rgba(2,5,14,.80) 0%,rgba(2,5,14,.42) 55%,transparent 80%);
    opacity:0;transform:translateY(calc(-50% + 14px));transition:opacity 1.2s ease,transform 1.2s cubic-bezier(.16,1,.3,1)}
  #title-screen.ready #title-block{opacity:1;transform:translateY(-50%)}
  .overline{font-size:10px;letter-spacing:.55em;text-indent:.55em;color:var(--cyan);text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.95)}
  #main-title{margin:18px 0 0;font-weight:900;font-size:clamp(1.9rem,6.4vw,3.6rem);letter-spacing:.1em;text-indent:.1em;color:#fff;
    text-shadow:0 2px 6px rgba(0,0,0,.95),0 0 18px rgba(85,241,248,.8),0 0 60px rgba(85,241,248,.4)}
  #main-title .word{display:inline-block;white-space:nowrap}
  #main-title .ch{display:inline-block;opacity:0;transform:translateY(14px);animation:letterIn .8s cubic-bezier(.16,1,.3,1) forwards}
  @keyframes letterIn{to{opacity:1;transform:none}}
  #q2-label{margin:14px 0 0;font-size:12px;font-weight:700;letter-spacing:.55em;text-indent:.55em;color:var(--cyan);text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.95),0 0 16px rgba(85,241,248,.45)}
  .rule{display:flex;align-items:center;gap:14px;justify-content:center;margin:20px auto 0}
  .rule::before,.rule::after{content:'';height:1px;width:min(90px,18vw);display:block}
  .rule::before{background:linear-gradient(90deg,transparent,rgba(85,241,248,.6))}
  .rule::after{background:linear-gradient(90deg,rgba(85,241,248,.6),transparent)}
  .rule i{color:var(--cyan);font-style:normal;font-size:12px}
  #subtitle{margin:14px auto 0;max-width:88vw;font-size:clamp(.9rem,2.4vw,1.05rem);font-weight:500;letter-spacing:.08em;color:rgba(234,252,255,.93);text-shadow:0 1px 10px rgba(0,0,0,.95)}
  #tap-hint{margin:26px 0 0;font-size:11px;letter-spacing:.5em;text-indent:.5em;color:var(--cyan);text-transform:uppercase;text-shadow:0 0 12px rgba(85,241,248,.7),0 1px 8px rgba(0,0,0,.95);animation:tapPulse 2.2s ease-in-out infinite}
  @keyframes tapPulse{0%,100%{opacity:.4}50%{opacity:1}}
  /* after auth: UI gets out of the way for the warp */
  #title-screen.entered #title-block{opacity:0;transform:translateY(calc(-50% - 12px))}
  #title-screen.entered .corner{opacity:0;pointer-events:none}

  /* ---------- SEAL BAR (sign-in) ---------- */
  #seal-bar{position:absolute;bottom:calc(18px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:20;
    display:inline-flex;align-items:center;cursor:pointer;
    padding:9px 26px;border-radius:999px;
    background:rgba(2,5,14,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    border:1px solid rgba(85,241,248,.3);
    opacity:0;translate:0 120%;transition:opacity 1s ease .2s,translate 1s cubic-bezier(.16,1,.3,1) .2s,border-color .2s,box-shadow .2s}
  #seal-bar:hover{border-color:rgba(85,241,248,.6);box-shadow:0 0 18px rgba(85,241,248,.25)}
  #title-screen.ready #seal-bar{opacity:1;translate:0 0}
  #title-screen.entered #seal-bar{opacity:0;pointer-events:none}
  #seal-btn{display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.4em;color:var(--ice);text-transform:uppercase}
  #seal-btn .wax{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bffaff,#1e7d8c 70%);
    display:flex;align-items:center;justify-content:center;color:#03252b;font-size:11px;box-shadow:0 0 12px rgba(85,241,248,.6)}
  #status{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;letter-spacing:.14em;color:rgba(234,252,255,.7);text-align:center}

  .corner{position:absolute;top:16px;right:16px;z-index:20;display:flex;gap:10px;transition:opacity .8s ease}
  .icon-btn{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.45);border:1px solid rgba(85,241,248,.4);
    color:var(--cyan);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px}
  .icon-btn:hover{background:rgba(85,241,248,.12)}
  #info-modal{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:24px}
  #info-modal.open{display:flex}
  #info-card{background:rgba(4,10,26,.94);border:1px solid rgba(85,241,248,.45);border-radius:14px;padding:28px 30px;max-width:320px;text-align:center;position:relative}
  #info-card p{font-size:1.05rem;line-height:1.6;margin:0}
  #info-card small{display:block;margin-top:12px;font-size:9px;letter-spacing:.35em;color:rgba(234,252,255,.4);text-transform:uppercase}
  #info-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.45);border:1px solid rgba(85,241,248,.4);color:var(--cyan);cursor:pointer;font-size:13px;line-height:1}

  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}#main-title .ch{opacity:1;transform:none}#title-block,#seal-bar{opacity:1!important;translate:none!important}}
  @media (max-width:480px){
    #title-block{top:50%}
    #main-title{font-size:clamp(1.5rem,8.5vw,2.1rem);letter-spacing:.06em;text-indent:.06em}
    .overline{letter-spacing:.32em;text-indent:.32em}
  }
</style>
</head>
<body>

<!-- LOADING SCREEN -->
<div id="loading-screen">
  <div id="load-title" class="font-display">Aghimuan Library</div>
  <div id="load-bar-wrap"><div id="load-bar"></div></div>
  <div id="load-meta"><span id="load-pct">0%</span><span>Q2 UPLINK</span></div>
  <div id="load-label">BOOTING KERNEL…</div>
</div>

<!-- TITLE SCREEN -->
<div id="title-screen">
  <canvas id="c3d"></canvas>
  <div class="vignette"></div>
  <div class="scanlines"></div>
  <div id="white-veil"></div>

  <div class="corner">
    <button class="icon-btn" id="info-btn" aria-label="About">i</button>
  </div>

  <div id="title-block">
    <div class="overline font-display">Aghimuan Network · PCU-D</div>
    <h1 id="main-title" class="font-display">AGHIMUAN LIBRARY</h1>
    <div id="q2-label" class="font-display">Quarter 2</div>
    <div class="rule"><i>✦</i></div>
    <p id="subtitle">UPLINK STABLE. BEGIN REVIEW.</p>
    <p id="tap-hint" class="font-display">Tap to enter</p>
  </div>

  <div id="seal-bar">
    <div id="seal-btn" class="font-display"><span class="wax"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.7 5.5 4.5 9.3 10 10-5.5.7-9.3 4.5-10 10-.7-5.5-4.5-9.3-10-10 5.5-.7 9.3-4.5 10-10Z"/></svg></span><span>PCU Gmail Sign-In</span></div>
    <div id="status"></div>
  </div>

  <div id="info-modal">
    <div id="info-card">
      <button id="info-close" aria-label="Close">✕</button>
      <p>season 2? maybe.</p>
      <small>— renyuzaki</small>
    </div>
  </div>
</div>

<audio id="bgm-audio" src="/library/audio/library-theme-q2.mp3" preload="auto" loop></audio>

<script>
(function(){
'use strict';
var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* title letters, word-wrapped so mobile never breaks mid-word */
var h1 = document.getElementById('main-title');
var txt = h1.textContent; h1.textContent = '';
var li = 0;
txt.split(' ').forEach(function(word,wi,arr){
  var w=document.createElement('span');
  w.className='word';
  word.split('').forEach(function(ch){
    var s=document.createElement('span');
    s.className='ch';
    s.textContent=ch;
    s.style.animationDelay=(0.55+li*0.035)+'s';li++;
    w.appendChild(s);
  });
  h1.appendChild(w);
  if(wi<arr.length-1)h1.appendChild(document.createTextNode(' '));
});

/* ---- rotating taglines: one picked per visit, same pattern as 404.html ----
   Add/remove lines freely — keep them short so they fit one line on phones. */
var TAGLINES=[
  'MAY THIS JOURNEY LEAD US STARWARD.',
  'THE EXPRESS RUNS ON TIME. DO YOU?',
  '[SCENARIO: EXAMS APPROACH.]',
  'THE STAR STREAM IS WATCHING YOU STUDY.',
  '[MAIN SCENARIO: REVIEW IN PROGRESS.]',
  'STAY DETERMINED.',
  "DESPITE EVERYTHING, IT'S STILL REVIEW SEASON.",
  '* SAVE YOUR PROGRESS BEFORE EXAMS.',
  'TORCHES UP. THE REVIEW CAVES RUN DEEP.',
  "DON'T DIG STRAIGHT INTO EXAMS.",
  'AT THE CROSSROADS, THE LIBRARY IS STRAIGHT AHEAD.',
  "IF YOU SEE STARS IN THE STACKS, YOU'RE IN DEEP.",
  'I NEVER WRITE A STORY WHERE I FAIL.',
  'THE LIBRARY IS ALL YOURS.',
  'COUNT YOUR HEARTS. THEN YOUR REVIEWERS.',
  'I KNOW WHAT KIND OF STUDENT I NEED TO BE.',
  'THE TVA FLAGGED YOUR PROCRASTINATION AS A NEXUS EVENT.',
  'JAZZ HANDS. THEN BACK TO REVIEW.',
  'FIST BUMP. BACK TO THE BOOKS.',
  "QUESTION: WHY AREN'T YOU REVIEWING?",
  'AD ASTRA ABYSSOSQUE, CRAMMERS.'
];
document.getElementById('subtitle').textContent=TAGLINES[Math.floor(Math.random()*TAGLINES.length)];

/* loading */
var LABELS=['BOOTING KERNEL…','LINKING NODES…','SYNCING REVIEW DATA…','UPLINK READY…'];
var bar=document.getElementById('load-bar'),pct=document.getElementById('load-pct'),
    lab=document.getElementById('load-label'),load=document.getElementById('loading-screen'),
    titleEl=document.getElementById('title-screen');
var start=performance.now(),DUR=reduceMotion?300:2000;
function tick(now){
  var p=Math.min(1,(now-start)/DUR),e=p*p*(3-2*p),v=Math.floor(e*100);
  bar.style.width=v+'%';pct.textContent=v+'%';
  lab.textContent=LABELS[Math.min(LABELS.length-1,Math.floor(p*LABELS.length))];
  if(p<1)requestAnimationFrame(tick);
  else{load.classList.add('done');titleEl.classList.add('on');initScene();setTimeout(function(){load.style.display='none'},700);}
}
/* music starts with the loading bar; browsers that block autoplay
   fall back to starting it on the visitor's first tap */
startBGM();
requestAnimationFrame(tick);

/* ================= THE CORE — network mainframe ================= */
var scene,camera,renderer,clock;
var coreGroup,coreMesh,coreEdges,holoRings=[],shards=[],motes,clouds=[],beamTex,beamPlanes=[],surgeMesh,surgeAge=99,surgeNext=3;
var haloCore,haloWide,beacons=[],mistGroup,streakHead,streakTail,streakT=5,streakAge=99;
var relayGroup,relayNodes=[],spireTips=[],auroras=[];
/* shard traffic: 3 kepler rings — inner fastest, all same direction */
var shardRings=[
  {rad:15,y:1.5,tilt:.10,sp:.24},
  {rad:19.5,y:5.5,tilt:-.08,sp:.17},
  {rad:24,y:9.5,tilt:.16,sp:.12}
];
var phase='INTRO',phaseT=0;
var INTRO_TIME=reduceMotion?1:5.0, DIVE_TIME=2.2;
var orbitAngle=0.6, ORBIT_R=30, ORBIT_H=8.5;
var INTRO_R=64, INTRO_H=22;
var idleMix=0;

function rr(a,b){return a+Math.random()*(b-a);}

function glowTex(){
  var c=document.createElement('canvas');c.width=c.height=128;
  var x=c.getContext('2d');
  var g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.25,'rgba(85,241,248,.6)');
  g.addColorStop(.6,'rgba(48,150,199,.2)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}

/* HUD plate texture: corner brackets + header + traces, no full border */
function hudTex(){
  var c=document.createElement('canvas');c.width=128;c.height=160;
  var x=c.getContext('2d');
  x.fillStyle='rgba(5,14,26,.88)';x.fillRect(0,0,128,160);
  x.strokeStyle='rgba(155,233,255,.95)';x.lineWidth=5;
  x.shadowColor='#55F1F8';x.shadowBlur=6;
  var L=26;
  x.beginPath();
  x.moveTo(4,L+4);x.lineTo(4,4);x.lineTo(L+4,4);
  x.moveTo(128-L-4,4);x.lineTo(124,4);x.lineTo(124,L+4);
  x.moveTo(124,160-L-4);x.lineTo(124,156);x.lineTo(128-L-4,156);
  x.moveTo(L+4,156);x.lineTo(4,156);x.lineTo(4,160-L-4);
  x.stroke();
  x.shadowBlur=0;
  x.fillStyle='rgba(155,233,255,.85)';x.fillRect(16,16,52,7);
  x.fillStyle='rgba(155,233,255,.5)';x.fillRect(74,16,12,7);
  x.strokeStyle='rgba(85,241,248,.6)';x.lineWidth=2;
  var rows=[44,68,92];
  for(var i=0;i<3;i++){
    var y=rows[i];
    x.beginPath();x.moveTo(16,y);x.lineTo(70+i*10,y);x.lineTo(80+i*10,y+10);x.lineTo(112,y+10);x.stroke();
    x.fillStyle='rgba(155,233,255,.9)';x.fillRect(66+i*10,y-3,6,6);
  }
  x.fillStyle='rgba(234,252,255,.4)';x.fillRect(16,128,64,4);x.fillRect(16,136,40,4);
  return new THREE.CanvasTexture(c);
}

/* beam gradient: soft shaft, bright base fading skyward, feathered edges */
function beamTexture(){
  var c=document.createElement('canvas');c.width=128;c.height=256;
  var x=c.getContext('2d');
  var img=x.createImageData(128,256);
  for(var j=0;j<256;j++){
    var v=j/255; /* 0 = canvas top = beam top */
    var vert=Math.pow(v,1.6);
    for(var i=0;i<128;i++){
      var u=i/127;
      var horiz=Math.pow(Math.sin(u*Math.PI),1.5);
      var a=Math.max(0,Math.min(1,vert*horiz));
      var idx=(j*128+i)*4;
      img.data[idx]=220;img.data[idx+1]=250;img.data[idx+2]=255;
      img.data[idx+3]=Math.round(a*255);
    }
  }
  x.putImageData(img,0,0);
  return new THREE.CanvasTexture(c);
}

/* skybox dome gradient (night zenith -> glowing tech horizon) */
function skyTexture(){
  var c=document.createElement('canvas');c.width=1024;c.height=512;
  var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,0,512);
  g.addColorStop(0,'#02030a');
  g.addColorStop(.36,'#061224');
  g.addColorStop(.47,'#134152');
  g.addColorStop(.50,'#1e5f7a');
  g.addColorStop(.53,'#134152');
  g.addColorStop(.62,'#050b18');
  g.addColorStop(1,'#02030a');
  x.fillStyle=g;x.fillRect(0,0,1024,512);
  /* soft horizon breath, no hard line */
  x.fillStyle='rgba(85,241,248,.10)';x.fillRect(0,244,1024,26);
  var blobs=[
    {x:200,y:120,r:220,c:'rgba(110,90,200,.14)'},
    {x:800,y:150,r:260,c:'rgba(48,150,199,.14)'},
    {x:520,y:90,r:180,c:'rgba(85,241,248,.10)'}
  ];
  blobs.forEach(function(n){
    var rg=x.createRadialGradient(n.x,n.y,10,n.x,n.y,n.r);
    rg.addColorStop(0,n.c);rg.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=rg;x.fillRect(0,0,1024,512);
  });
  return new THREE.CanvasTexture(c);
}

/* deterministic RNG so the ranges look identical on every visit */
function mulberry(seed){
  var a=seed>>>0;
  return function(){
    a|=0;a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
/* continuous low-poly terrain band: an open cylinder whose top edge is a
   jagged mountain profile, interior rows jittered into sloped facets —
   one continuous mesh = the refs' rolling mesh, same 3-layer distances. */
function ridgeProfile(seed,nPeaks){
  var rng=mulberry(Math.floor(seed*1000)+7),peaks=[];
  for(var i=0;i<nPeaks;i++)peaks.push({c:((i+.15+rng()*.7)/nPeaks)*Math.PI*2,w:.07+rng()*.14,h:.4+rng()*.95});
  return function(th){
    var h=.05;
    for(var i=0;i<peaks.length;i++){
      var d=Math.atan2(Math.sin(th-peaks[i].c),Math.cos(th-peaks[i].c));
      h+=peaks[i].h*Math.exp(-(d*d)/(2*peaks[i].w*peaks[i].w));
    }
    h+=.02*Math.sin(th*23+seed)+.015*Math.sin(th*47+seed*2.7);
    return Math.max(.02,h);
  };
}
function ridgeRing(radius,height,baseHex,peakHex,seed,nPeaks,wireOp){
  var rng=mulberry(Math.floor(seed*1000)+13);
  var geo=new THREE.CylinderGeometry(radius,radius,height,160,14,true);
  var pos=geo.attributes.position;
  var prof=ridgeProfile(seed,nPeaks);
  for(var i=0;i<pos.count;i++){
    var x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    var th=Math.atan2(z,x);
    var row=(y+height/2)/height; /* 0 bottom, 1 top */
    pos.setY(i,-height/2 + prof(th)*height*Math.pow(row,1.15) + (row>0&&row<0.99 ? (rng()-.5)*height*.05 : 0));
    if(row>0){
      var nt=th+(rng()-.5)*.018,r0=Math.sqrt(x*x+z*z);
      pos.setX(i,Math.cos(nt)*r0);pos.setZ(i,Math.sin(nt)*r0);
    }
  }
  geo.computeVertexNormals();
  var base=new THREE.Color(baseHex),peak=new THREE.Color(peakHex),tmp=new THREE.Color(),cols=[];
  for(var v=0;v<pos.count;v++){
    var t=Math.max(0,Math.min(1,(pos.getY(v)+height/2)/height));
    tmp.copy(base).lerp(peak,Math.pow(t,1.5));
    cols.push(tmp.r,tmp.g,tmp.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  var m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,color:0x8a9bb0,fog:false,side:THREE.BackSide}));
  m.position.y=-8;
  m.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({color:0x55F1F8,transparent:true,opacity:wireOp,fog:false})));
  /* glowing mesh vertices, like the refs */
  var ns=140,np=new Float32Array(ns*3);
  for(var ni=0;ni<ns;ni++){
    var vi=Math.floor(rng()*pos.count)*3;
    np[ni*3]=pos.array[vi];np[ni*3+1]=pos.array[vi+1];np[ni*3+2]=pos.array[vi+2];
  }
  var ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.BufferAttribute(np,3));
  m.add(new THREE.Points(ng,new THREE.PointsMaterial({color:0x9be9ff,size:2.2,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})));
  scene.add(m);
}

/* data rain: faint verticals falling from sky-nodes into the ranges.
   1 line cloud + 1 drop cloud, ~90 drops updated per frame. */
var rainDrops=[],rainPts=null;
function buildDataRain(){
  var N=110,lp=[];
  for(var i=0;i<N;i++){
    var a=Math.random()*Math.PI*2,d=rr(350,900);
    var x=Math.cos(a)*d,z=Math.sin(a)*d;
    var top=rr(300,520),bot=rr(-5,55);
    lp.push(x,top,z,x,bot,z);
    rainDrops.push({x:x,z:z,top:top,bot:bot,y:rr(bot,top),sp:rr(25,60)});
  }
  var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
  scene.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x55F1F8,transparent:true,opacity:.14,fog:false})));
  var pp=new Float32Array(N*3);
  var pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  rainPts=new THREE.Points(pg,new THREE.PointsMaterial({color:0xd8faff,size:2.4,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  scene.add(rainPts);
}

/* network sky: reviewers.php galaxy-cluster idea, scaled up.
   OPT: points = 1 GPU draw call each; web-line matching is init-only with
   squared-distance early-out (no sqrt); per-frame cost is just group rotation. */
var netChoirs=[];
function buildNetworkSky(){
  var glowC=glowTex();
  var cfgs=[
    {c:[-1156,668,-1431],r:225,col:0x55F1F8,n:340},
    {c:[1436,521,-1243],r:272,col:0x3096C7,n:380},
    {c:[-301,839,-1978],r:300,col:0x9be9ff,n:420},
    {c:[1390,662,-1390],r:356,col:0x8f7fd4,n:360},
    {c:[-1807,517,-771],r:252,col:0x55F1F8,n:300},
    {c:[498,1070,-1738],r:318,col:0x3096C7,n:340},
    {c:[-1150,950,-1550],r:300,col:0x9be9ff,n:400},
    {c:[137,467,-2050],r:420,col:0x6fb7ff,n:420}
  ];
  var nScale=(Math.min(innerWidth,innerHeight)<620)?0.6:1;
  cfgs.forEach(function(cfg){
    var grp=new THREE.Group();
    grp.position.set(cfg.c[0],cfg.c[1],cfg.c[2]);
    var core=new THREE.Sprite(new THREE.SpriteMaterial({map:glowC,color:cfg.col,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    core.scale.set(cfg.r*1.4,cfg.r*1.4,1);grp.add(core);
    var total=Math.floor(cfg.n*nScale),sp=[],nodes=[];
    for(var i=0;i<total;i++){
      var ai=i%3,aa=ai*(2*Math.PI/3);
      var dr=Math.pow(Math.random(),1.4),rad=dr*cfg.r;
      var fa=aa+rad*.045+(Math.random()-.5)*.3;
      var px=Math.cos(fa)*rad,py=(Math.random()-.5)*cfg.r*.22*(1-dr*.5),pz=Math.sin(fa)*rad;
      nodes.push([px,py,pz]);sp.push(px,py,pz);
    }
    var sgeo=new THREE.BufferGeometry();sgeo.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
    grp.add(new THREE.Points(sgeo,new THREE.PointsMaterial({color:cfg.col,size:6,sizeAttenuation:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})));
    var lp=[],R=cfg.r*.18,R2=R*R;
    for(var a=0;a<nodes.length;a++){var na=nodes[a];
      for(var b=a+1;b<nodes.length;b++){var nb=nodes[b];
        var dx=na[0]-nb[0],dy=na[1]-nb[1],dz=na[2]-nb[2];
        if(dx*dx+dy*dy+dz*dz<R2){lp.push(na[0],na[1],na[2],nb[0],nb[1],nb[2]);}
      }
    }
    var lgeo=new THREE.BufferGeometry();lgeo.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
    grp.add(new THREE.LineSegments(lgeo,new THREE.LineBasicMaterial({color:cfg.col,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,fog:false})));
    grp.rotation.set(rr(-.3,.3),0,rr(-.3,.3));
    scene.add(grp);
    netChoirs.push({g:grp,rs:rr(.01,.03)});
  });
  /* faint galactic band behind it all */
  var small=(Math.min(innerWidth,innerHeight)<620);
  var BN=small?600:1200,bp=new Float32Array(BN*3);
  for(var k=0;k<BN;k++){
    var along=rr(-900,900);
    bp[k*3]=along;bp[k*3+1]=along*.28+rr(-80,80)+260;bp[k*3+2]=-1800+rr(-120,120);
  }
  var bgeo=new THREE.BufferGeometry();bgeo.setAttribute('position',new THREE.BufferAttribute(bp,3));
  scene.add(new THREE.Points(bgeo,new THREE.PointsMaterial({color:0x8f7fd4,size:1.6,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})));
}

function initScene(){
  var canvas=document.getElementById('c3d');
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x04060f,0.0038);
  /* near=1 (not 0.1): nothing comes closer than ~2 units, and the tight
     near/far ratio is what gives the depth buffer precision at range */
  camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,1,2800);
  var smallScreen=(Math.min(innerWidth,innerHeight)<620);
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,smallScreen?1.5:1.75));
  renderer.setSize(innerWidth,innerHeight);
  renderer.setClearColor(0x04060f,1);

  var glow=glowTex();
  var circ=hudTex();
  beamTex=beamTexture();

  /* --- starfield: dense shell parked past the ridges, single draw call --- */
  var SN=smallScreen?2500:5000,sp=new Float32Array(SN*3);
  for(var i=0;i<SN;i++){
    var u=Math.random(),v=Math.random();
    var th=u*2*Math.PI,ph=Math.acos(2*v-1),r=rr(1700,2050);
    sp[i*3]=r*Math.sin(ph)*Math.cos(th);
    sp[i*3+1]=Math.abs(r*Math.cos(ph))*.8-40;
    sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x9be9ff,size:3,transparent:true,opacity:.9,depthWrite:false,fog:false})));

  /* skybox dome */
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2200,32,24),
    new THREE.MeshBasicMaterial({map:skyTexture(),side:THREE.BackSide,depthWrite:false,fog:false}));
  scene.add(sky);
  buildNetworkSky();

  /* --- relay ring station --- */
  relayGroup=new THREE.Group();
  relayGroup.position.set(-190,150,-420);
  var relay=new THREE.Mesh(new THREE.RingGeometry(52,54,72),
    new THREE.MeshBasicMaterial({color:0x55F1F8,transparent:true,opacity:.4,side:THREE.DoubleSide,fog:false}));
  relayGroup.add(relay);
  var relay2=new THREE.Mesh(new THREE.RingGeometry(38,38.8,64),
    new THREE.MeshBasicMaterial({color:0x3096C7,transparent:true,opacity:.5,side:THREE.DoubleSide,fog:false}));
  relayGroup.add(relay2);
  for(var rn=0;rn<6;rn++){
    var node=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x9be9ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    node.scale.set(7,7,1);
    node.userData.ang=(rn/6)*Math.PI*2;
    relayGroup.add(node);relayNodes.push(node);
  }
  relayGroup.lookAt(0,0,0);scene.add(relayGroup);

  /* --- server mist below --- */
  for(var c=0;c<16;c++){
    var cg=new THREE.IcosahedronGeometry(rr(20,46),0);
    cg.scale(rr(1.6,3.2),.28,rr(1.6,3.2));
    var cm=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({color:0x0a1226,transparent:true,opacity:.62}));
    cm.position.set(rr(-160,160),rr(-26,-14),rr(-160,60));
    cm.userData.drift=rr(.2,.7);
    scene.add(cm);clouds.push(cm);
  }

  /* --- ground grid (data plane the world sits on) --- */
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200),
    new THREE.MeshBasicMaterial({color:0x04070f}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-8.4;scene.add(ground);
  var grid=new THREE.GridHelper(1200,110,0x55F1F8,0x0e1a3a);
  grid.position.y=-8.2;grid.material.transparent=true;grid.material.opacity=.2;scene.add(grid);

  /* --- true-3D mountain massifs (same three layer distances) --- */
  scene.add(new THREE.HemisphereLight(0x4a6a8a,0x05070d,0.85));
  var moonLight=new THREE.DirectionalLight(0xcfeaff,0.75);
  moonLight.position.set(200,320,120);
  scene.add(moonLight);
  /* big = far: low foothills near, the giants live at the horizon */
  ridgeRing(1650,420,0x0a1626,0x22405c,5.5,20,.07); /* backdrop: kills the void */
  ridgeRing(1280,600,0x0c1e32,0x3a5f7d,9.9,14,.18);  /* the giants, far out */
  ridgeRing(820,330,0x0a1a2c,0x2a4f6b,1.7,12,.24);   /* mid-distance range */
  ridgeRing(480,190,0x0a1826,0x16334e,4.2,10,.3);    /* near range */
  buildDataRain();
  /* ground-haze skirt: melts mountain feet into the land, no hard seam */
  var haze=new THREE.Mesh(new THREE.RingGeometry(300,1700,72),
    new THREE.MeshBasicMaterial({color:0x1c5a72,transparent:true,opacity:.08,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  haze.rotation.x=-Math.PI/2;haze.position.y=-7.4;scene.add(haze);

  /* --- distant server spires blinking on the horizon --- */
  for(var si=0;si<9;si++){
    var sa=(si/9)*Math.PI*2+rr(-.1,.1),sd=rr(190,240),sh=rr(28,58);
    var spire=new THREE.Mesh(new THREE.BoxGeometry(2.2,sh,2.2),
      new THREE.MeshBasicMaterial({color:0x080d1e,fog:false}));
    spire.position.set(Math.cos(sa)*sd,sh/2-8,Math.sin(sa)*sd);
    spire.add(new THREE.LineSegments(new THREE.EdgesGeometry(spire.geometry),
      new THREE.LineBasicMaterial({color:0x3096C7,transparent:true,opacity:.5,fog:false})));
    scene.add(spire);
    var stip=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x55F1F8,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    stip.scale.set(4,4,1);
    stip.position.set(Math.cos(sa)*sd,sh-7,Math.sin(sa)*sd);
    stip.userData.ph=Math.random()*6.28;
    scene.add(stip);spireTips.push(stip);
  }

  /* --- aurora veils high in the sky --- */
  var aurCols=[0x8f7fd4,0x55F1F8,0x3096C7];
  for(var ai=0;ai<3;ai++){
    var aur=new THREE.Mesh(new THREE.PlaneGeometry(560,60),
      new THREE.MeshBasicMaterial({color:aurCols[ai],transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    var aa=(ai/3)*Math.PI*2+.5;
    aur.position.set(Math.cos(aa)*420,rr(150,230),Math.sin(aa)*420);
    aur.lookAt(0,60,0);
    aur.userData={ph:Math.random()*6.28,base:.07};
    scene.add(aur);auroras.push(aur);
  }

  /* --- THE CORE --- */
  coreGroup=new THREE.Group();scene.add(coreGroup);

  /* platform */
  var dais=new THREE.Mesh(new THREE.CylinderGeometry(11,13,1.6,24),
    new THREE.MeshBasicMaterial({color:0x080d1e}));
  dais.position.y=-3.4;coreGroup.add(dais);
  dais.add(new THREE.LineSegments(new THREE.EdgesGeometry(dais.geometry),
    new THREE.LineBasicMaterial({color:0x55F1F8,transparent:true,opacity:.5})));
  var ring1=new THREE.Mesh(new THREE.RingGeometry(11.4,11.9,64),
    new THREE.MeshBasicMaterial({color:0x55F1F8,transparent:true,opacity:.38,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  ring1.rotation.x=-Math.PI/2;ring1.position.y=-2.55;coreGroup.add(ring1);
  coreGroup.userData.ring1=ring1;
  var ring2=new THREE.Mesh(new THREE.RingGeometry(9.1,9.35,64),
    new THREE.MeshBasicMaterial({color:0x3096C7,transparent:true,opacity:.3,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  ring2.rotation.x=-Math.PI/2;ring2.position.y=-2.55;coreGroup.add(ring2);
  coreGroup.userData.ring2=ring2;

  /* beacon posts */
  for(var bi=0;bi<8;bi++){
    var ba=(bi/8)*Math.PI*2;
    var post=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,1.4,8),
      new THREE.MeshBasicMaterial({color:0x0e162e}));
    post.position.set(Math.cos(ba)*10.1,-1.9,Math.sin(ba)*10.1);
    post.add(new THREE.LineSegments(new THREE.EdgesGeometry(post.geometry),
      new THREE.LineBasicMaterial({color:0x55F1F8,transparent:true,opacity:.6})));
    coreGroup.add(post);
    var tip=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x55F1F8,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    tip.scale.set(1.5,1.5,1);
    tip.position.set(Math.cos(ba)*10.1,-1.05,Math.sin(ba)*10.1);
    tip.userData.ph=Math.random()*6.28;
    coreGroup.add(tip);beacons.push(tip);
  }

  /* the core: dark polyhedron, cyan edges, hot heart */
  coreMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(4.6,1),
    new THREE.MeshBasicMaterial({color:0x060b1c}));
  coreMesh.position.y=3.4;coreGroup.add(coreMesh);
  coreEdges=new THREE.LineSegments(new THREE.EdgesGeometry(coreMesh.geometry),
    new THREE.LineBasicMaterial({color:0x55F1F8,transparent:true,opacity:.9}));
  coreMesh.add(coreEdges);
  /* inner hot nucleus */
  var nucleus=new THREE.Mesh(new THREE.IcosahedronGeometry(1.7,1),
    new THREE.MeshBasicMaterial({color:0xeafcff,transparent:true,opacity:.95}));
  coreMesh.add(nucleus);
  haloCore=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x9be9ff,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));
  haloCore.scale.set(20,20,1);haloCore.position.y=3.4;coreGroup.add(haloCore);
  haloWide=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x3096C7,transparent:true,opacity:.13,blending:THREE.AdditiveBlending,depthWrite:false}));
  haloWide.scale.set(34,34,1);haloWide.position.y=3.4;coreGroup.add(haloWide);

  /* holo gyro-rings */
  var ringDefs=[
    {r:7.2,tube:.09,op:.8,ax:'x',tilt:.5,sp:.5},
    {r:8.8,tube:.06,op:.55,ax:'y',tilt:.3,sp:-.35},
    {r:10.4,tube:.05,op:.4,ax:'z',tilt:.2,sp:.22}
  ];
  ringDefs.forEach(function(rd){
    var rm=new THREE.Mesh(new THREE.TorusGeometry(rd.r,rd.tube,8,72),
      new THREE.MeshBasicMaterial({color:0x55F1F8,transparent:true,opacity:rd.op,blending:THREE.AdditiveBlending}));
    rm.position.y=3.4;
    rm.rotation.x=rd.tilt;
    rm.userData={ax:rd.ax,sp:rd.sp};
    /* node beads on the ring */
    for(var nb=0;nb<4;nb++){
      var bead=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),
        new THREE.MeshBasicMaterial({color:0xeafcff}));
      var nba=(nb/4)*Math.PI*2;
      bead.position.set(Math.cos(nba)*rd.r,0,Math.sin(nba)*rd.r);
      rm.add(bead);
    }
    coreGroup.add(rm);holoRings.push(rm);
  });

  /* actual light beam: 3 crossed gradient planes = soft volumetric shaft */
  for(var bp2=0;bp2<3;bp2++){
    var bpl=new THREE.Mesh(new THREE.PlaneGeometry(7,90),
      new THREE.MeshBasicMaterial({map:beamTex,color:0xbdf6ff,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    bpl.rotation.y=bp2*Math.PI/3;
    bpl.position.y=46;coreGroup.add(bpl);beamPlanes.push(bpl);
  }
  /* surge band: pressure pulse that fires up the shaft every few seconds */
  surgeMesh=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,6,16,1,true),
    new THREE.MeshBasicMaterial({color:0xeafcff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  surgeMesh.position.y=2;coreGroup.add(surgeMesh);

  /* orbiting holo-shards: even slots on 3 conveyor rings */
  var perRing=[9,9,8],slotIdx=[0,0,0];
  for(var o=0;o<26;o++){
    var sc=rr(.7,1.2);
    var om=new THREE.Mesh(new THREE.PlaneGeometry(1.1*sc,1.4*sc),
      new THREE.MeshBasicMaterial({map:circ,transparent:true,opacity:.6,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
    var ri=o%3;
    var ang=(slotIdx[ri]/perRing[ri])*Math.PI*2;
    slotIdx[ri]++;
    om.userData={ring:ri,ang:ang,tilt:rr(-.15,.15),base:rr(.45,.65),ph:Math.random()*6.28};
    coreGroup.add(om);shards.push(om);
  }

  /* rising motes */
  var EN=smallScreen?150:260,ep=new Float32Array(EN*3);
  for(var k=0;k<EN;k++){ep[k*3]=rr(-8,8);ep[k*3+1]=rr(-1,30);ep[k*3+2]=rr(-6,6);}
  var eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.BufferAttribute(ep,3));
  motes=new THREE.Points(eg,new THREE.PointsMaterial({color:0x9be9ff,size:.18,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
  coreGroup.add(motes);

  /* near-camera mist */
  mistGroup=new THREE.Group();scene.add(mistGroup);
  for(var mg=0;mg<3;mg++){
    var ms=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x3096C7,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false}));
    ms.scale.set(48,26,1);
    var ma=(mg/3)*Math.PI*2;
    ms.position.set(Math.cos(ma)*24,rr(4,10),Math.sin(ma)*24);
    mistGroup.add(ms);
  }

  /* signal streak */
  streakHead=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  streakHead.scale.set(4,4,1);scene.add(streakHead);
  streakTail=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x55F1F8,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  streakTail.scale.set(16,2.4,1);scene.add(streakTail);

  addEventListener('resize',function(){
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  });
  clock=new THREE.Clock();
  animate();
}

function placeCamera(radius,height,angle){
  camera.position.set(Math.sin(angle)*radius,height,Math.cos(angle)*radius);
  camera.lookAt(0,3,0);
}

function animate(){
  requestAnimationFrame(animate);
  var dt=Math.min(clock.getDelta(),.033),t=clock.elapsedTime;
  phaseT+=dt;

  if(phase==='INTRO'){
    /* one continuous spiral-in: constant rotation, radius/height settle under it */
    var p=Math.min(1,phaseT/INTRO_TIME);
    var e=p*p*p*(p*(p*6-15)+10); /* smootherstep: zero velocity at both ends */
    orbitAngle+=dt*.07;
    placeCamera(INTRO_R+(ORBIT_R-INTRO_R)*e, INTRO_H+(ORBIT_H-INTRO_H)*e, orbitAngle);
    if(p>=.45)titleEl.classList.add('ready');
    if(p>=1){phase='IDLE';phaseT=0;idleMix=0;}
  }
  else if(phase==='IDLE'){
    orbitAngle+=dt*(reduceMotion?0:.07);
    /* bob fades in from zero so the handoff stays seamless */
    idleMix=Math.min(1,idleMix+dt/2);
    placeCamera(ORBIT_R,ORBIT_H+Math.sin(t*.5)*.5*idleMix,orbitAngle);
  }
  else if(phase==='DIVE'){
    var p2=Math.min(1,phaseT/DIVE_TIME);
    var e2=p2*p2*p2;
    var r=ORBIT_R+(7-ORBIT_R)*e2, h=ORBIT_H+(14-ORBIT_H)*e2;
    orbitAngle+=dt*.12;
    placeCamera(r,h,orbitAngle);
    camera.fov=60+e2*26;camera.updateProjectionMatrix();
    if(p2>.4)document.getElementById('white-veil').style.opacity=String(Math.min(1,(p2-.4)/.5));
    if(p2>=1){
      phase='DONE';
      var nx=new URLSearchParams(location.search).get('next');
      location.href=nx||'/library-home.php';
    }
  }

  /* core life */
  coreMesh.rotation.y+=dt*.25;
  coreMesh.rotation.x=Math.sin(t*.4)*.12;
  coreMesh.position.y=3.4+Math.sin(t*.8)*.3;
  if(!reduceMotion)holoRings.forEach(function(rg){
    var u=rg.userData;
    if(u.ax==='x')rg.rotation.x+=dt*u.sp;
    else if(u.ax==='y')rg.rotation.y+=dt*u.sp;
    else rg.rotation.z+=dt*u.sp;
  });
  /* beam: slow breathing pulse; surge = pressure wave fired up the shaft */
  var pulse=.36+.12*Math.sin(t*.85);
  for(var bi2=0;bi2<beamPlanes.length;bi2++){beamPlanes[bi2].material.opacity=pulse;}
  surgeNext-=dt;
  if(surgeNext<=0&&surgeAge>2){surgeAge=0;surgeNext=rr(5,9);}
  if(surgeAge<=1.8){
    surgeAge+=dt;
    var sp2=Math.min(1,surgeAge/1.8);
    var se=1-Math.pow(1-sp2,2);
    surgeMesh.position.y=2+se*80;
    surgeMesh.material.opacity=Math.sin(sp2*Math.PI)*.75;
    var ss=1+sp2*.8;
    surgeMesh.scale.set(ss,1,ss);
  } else surgeMesh.material.opacity=0;

  /* shards ride their conveyor rings */
  for(var j=0;j<shards.length;j++){
    var om=shards[j],ou=om.userData,rg2=shardRings[ou.ring];
    ou.ang+=dt*rg2.sp;
    om.position.set(Math.cos(ou.ang)*rg2.rad, rg2.y+Math.sin(ou.ang)*rg2.tilt*rg2.rad+Math.sin(t*.8+ou.ang*2)*.4, Math.sin(ou.ang)*rg2.rad);
    om.rotation.y=-ou.ang+ou.tilt;
    om.rotation.x=Math.sin(t+ou.ang)*.3;
    om.material.opacity=ou.base+.15*Math.sin(t*1.2+ou.ph);
  }
  /* motes rise */
  var arr=motes.geometry.attributes.position.array;
  for(var q=1;q<arr.length;q+=3){
    arr[q]+=dt*1.4;
    if(arr[q]>34){arr[q]=-1;arr[q-1]=rr(-8,8);arr[q+1]=rr(-6,6);}
  }
  motes.geometry.attributes.position.needsUpdate=true;
  /* mist */
  for(var ci=0;ci<clouds.length;ci++){
    clouds[ci].position.x+=clouds[ci].userData.drift*dt;
    if(clouds[ci].position.x>180)clouds[ci].position.x=-180;
  }
  /* halo breath */
  haloCore.material.opacity=.5+.12*Math.sin(t*1.6);
  coreGroup.userData.ring1.material.opacity=.30+.12*Math.sin(t*2);
  coreGroup.userData.ring2.rotation.z+=dt*.15;
  coreGroup.position.y=Math.sin(t*.6)*.25;
  /* beacons blink in sequence */
  for(var fi=0;fi<beacons.length;fi++){
    var bf=beacons[fi];
    bf.material.opacity=.35+.6*Math.max(0,Math.sin(t*2.2-fi*.8));
  }
  if(mistGroup)mistGroup.rotation.y+=dt*.02;
  /* relay nodes */
  relayNodes.forEach(function(nd){
    nd.userData.ang+=dt*.2;
    nd.position.set(Math.cos(nd.userData.ang)*52,Math.sin(nd.userData.ang)*52,0);
  });
  /* network sky drift (cheap: whole-group rotation only) */
  if(!reduceMotion)for(var ni=0;ni<netChoirs.length;ni++){netChoirs[ni].g.rotation.y+=netChoirs[ni].rs*dt;}
  /* data-rain drops fall */
  if(rainPts&&!reduceMotion){
    var ra=rainPts.geometry.attributes.position.array;
    for(var ri2=0;ri2<rainDrops.length;ri2++){
      var rd=rainDrops[ri2];
      rd.y-=rd.sp*dt;
      if(rd.y<rd.bot)rd.y=rd.top;
      ra[ri2*3]=rd.x;ra[ri2*3+1]=rd.y;ra[ri2*3+2]=rd.z;
    }
    rainPts.geometry.attributes.position.needsUpdate=true;
  }
  /* signal streak */
  streakT-=dt;
  if(streakT<=0&&streakAge>2){streakAge=0;streakT=rr(6,11);}
  if(streakAge<=1.6){
    streakAge+=dt;
    var mp=Math.min(1,streakAge/1.6);
    var mx=-260+300*mp,my=190-100*mp,mz=-320-60*mp;
    var mfade=Math.sin(mp*Math.PI);
    streakHead.position.set(mx,my,mz);
    streakTail.position.set(mx-14,my+4.5,mz);
    streakHead.material.opacity=.9*mfade;
    streakTail.material.opacity=.45*mfade;
  } else {
    streakHead.material.opacity=0;streakTail.material.opacity=0;
  }

  renderer.render(scene,camera);
}

/* ---------- gate API (used by the Firebase module below) ---------- */
function beginDive(){
  if(phase!=='IDLE')return;
  phase='DIVE';phaseT=0;blip();fadeBGM();
  titleEl.classList.add('entered');
}
window.AghiGate={
  enter:function(){beginDive();},
  isIdle:function(){return phase==='IDLE';}
};

/* BGM — same handling as before: try autoplay shortly after the
   title lands; browsers that block it fall back to the first tap. */
function startBGM(){
  var bgm=document.getElementById('bgm-audio');
  if(!bgm)return;
  /* fade in from silence over ~2s instead of starting at full volume */
  bgm.volume=0;
  var fadeIn=setInterval(function(){
    bgm.volume=Math.min(0.4,bgm.volume+.02);
    if(bgm.volume>=0.4)clearInterval(fadeIn);
  },100);
  try{
    var pp=bgm.play();
    if(pp!==undefined)pp.catch(function(){
      var resume=function(){bgm.play().catch(function(){});cleanup();};
      var cleanup=function(){
        document.removeEventListener('click',resume);
        document.removeEventListener('touchstart',resume);
        document.removeEventListener('keydown',resume);
      };
      document.addEventListener('click',resume,{once:true});
      document.addEventListener('touchstart',resume,{once:true});
      document.addEventListener('keydown',resume,{once:true});
    });
  }catch(err){}
}
function fadeBGM(){
  var bgm=document.getElementById('bgm-audio');
  if(bgm&&!bgm.paused){
    var step=setInterval(function(){
      bgm.volume=Math.max(0,bgm.volume-.05);
      if(bgm.volume<=0){bgm.pause();clearInterval(step);}
    },100);
  }
}
function blip(){
  try{
    var AC=window.AudioContext||window.webkitAudioContext,ac=new AC(),t0=ac.currentTime;
    [440,660,880].forEach(function(f,i){
      var o=ac.createOscillator(),g=ac.createGain();
      o.type='triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0,t0+i*.1);
      g.gain.linearRampToValueAtTime(.07,t0+i*.1+.04);
      g.gain.exponentialRampToValueAtTime(.0001,t0+i*.1+.5);
      o.connect(g);g.connect(ac.destination);o.start(t0+i*.1);o.stop(t0+i*.1+.6);
    });
  }catch(err){}
}

/* info modal (fenced off so it can never trigger auth) */
var modal=document.getElementById('info-modal');
document.getElementById('info-btn').addEventListener('click',function(e){e.stopPropagation();modal.classList.add('open');});
document.getElementById('info-close').addEventListener('click',function(e){e.stopPropagation();modal.classList.remove('open');});
modal.addEventListener('click',function(e){e.stopPropagation();modal.classList.remove('open');});
})();
</script>

<!-- Firebase Login Logic Integration -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = (window.AGHI_CONFIG && window.AGHI_CONFIG.firebase) || <?php echo json_encode(aghi_firebase_config(), JSON_UNESCAPED_SLASHES); ?>;

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
    if (!window.AghiGate || !window.AghiGate.isIdle()) return;

    statusEl.textContent = 'Authenticating...';
    statusEl.style.color = 'rgba(234,252,255,.7)';

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
        statusEl.textContent = 'Access granted. Entering library...';
        statusEl.style.color = '#55F1F8';
        // Trigger the dive! The animation redirects when it finishes.
        window.AghiGate.enter();
      } else {
        statusEl.textContent = 'Access denied — please sign in with your PCU Gmail account.';
        statusEl.style.color = '#ff6b6b';
        await signOut(auth);
      }
    } catch (err) {
      statusEl.textContent = 'Sign-in failed or canceled. Please try again.';
      statusEl.style.color = '#ff6b6b';
    }
  }

  // Whole screen is tappable (title text is pointer-transparent);
  // the info modal fences off its own clicks.
  window.addEventListener('load', () => {
    document.getElementById('c3d').addEventListener('click', handleSignIn);
    document.getElementById('seal-bar').addEventListener('click', handleSignIn);
  });
</script>
</body>
</html>
