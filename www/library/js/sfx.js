/* ============================================================
   AGHIMUAN LIBRARY — TACTILE UI SOUND (WebAudio, no files)
   ============================================================ */

(function () {
  let ctx = null, master = null;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const VOICE = [
    { freq: 2100, thock: 160, dur: 0.055, g: 0.9, q: 6 },   // snappy tick
    { freq: 1500, thock: 110, dur: 0.07,  g: 1.0, q: 5 },   // deep thock
    { freq: 2600, thock: 190, dur: 0.045, g: 0.7, q: 8 },   // airy click
    { freq: 900,  thock: 80,  dur: 0.09,  g: 1.1, q: 4 },   // woody knock
    { freq: 3000, thock: 240, dur: 0.04,  g: 0.6, q: 10 },  // glass ping-lite
  ];

  function voiceFor(el) {
    const c = (el.className || '').toString();
    if (/rev-tab|tab/i.test(c)) return VOICE[4];
    if (/row-item|file-icon|folder-icon/i.test(c)) return VOICE[1];
    if (/btn-neon|back-btn|lib-back/i.test(c)) return VOICE[0];
    if (el.tagName === 'A') return VOICE[2];
    if (el.tagName === 'BUTTON') return VOICE[3];
    return VOICE[0];
  }

  function play(v, seed) {
    const t0 = ctx.currentTime;
    const det = 0.82 + (Math.sin(seed * 12.9898) * 43758.5453 % 1 + 1) % 1 * 0.36;
    const f = v.freq * det;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(v.thock * det, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, v.thock * 0.5), t0 + v.dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(v.g * 0.5, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);
    o.connect(og); og.connect(master);
    o.start(t0); o.stop(t0 + v.dur + 0.02);
    const n = ctx.createBufferSource();
    const len = Math.max(1, Math.floor(ctx.sampleRate * v.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = v.q;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(v.g, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);
    n.connect(bp); bp.connect(ng); ng.connect(master);
    n.start(t0);
  }

  let lastPitch = 0, counter = 0;
  function trigger(el) {
    if (!ac()) return;
    const v = voiceFor(el);
    counter++;
    let seed = performance.now() / 1000 + counter * 7.13 + (v.freq % 97);
    let det = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    if (det < 0) det += 1;
    if (Math.abs(det * 1000 - lastPitch) < 60) seed += 0.618;
    lastPitch = det * 1000;
    play(v, seed);
  }

  document.addEventListener('pointerdown', function (e) {
    const el = e.target.closest('a,button,[role="button"],label,.btn-neon,.row-item,input[type="checkbox"],input[type="radio"]');
    if (el) trigger(el);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      const el = e.target.closest('a,button,[role="button"]');
      if (el) trigger(el);
    }
  }, true);
})();
