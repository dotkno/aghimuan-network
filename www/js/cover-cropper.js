/**
 * cover-cropper.js — dependency-free cover-image cropper (crop + zoom).
 *
 * window.AghiCoverCropper.open(file, opts) -> Promise<File|null>
 *   Resolves with a cropped WebP File (16:10, 1280x800) or null when the
 *   user cancels. Rejects nothing — undecodable files resolve null too.
 *
 * Used by the Resource Hub suggest form and the admin Resources tab, which
 * both upload the returned File through their existing (validated,
 * re-encoded) pipelines. All styles are injected — no stylesheet edits.
 */
(function () {
  'use strict';

  var OUT_W = 1280, OUT_H = 800, OUT_TYPE = 'image/webp', OUT_Q = 0.85;
  var MIN_BOX_W = 240, CTX_PAD = 70, MAX_ZOOM = 8;

  var STYLE_ID = 'aghi-cover-cropper-styles';
  var CSS =
    '.aghi-cc-backdrop{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;' +
    'padding:14px;background:rgba(8,10,15,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}' +
    '.aghi-cc-panel{width:min(640px,100%);max-height:94dvh;overflow-y:auto;background:#15161C;' +
    'border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);}' +
    '.aghi-cc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
    'padding:14px 16px 10px;color:#F1F2F5;font:600 15px Inter,Arial,sans-serif;}' +
    '.aghi-cc-x{width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.12);' +
    'background:rgba(255,255,255,.05);color:#AEB7C0;font-size:16px;line-height:1;cursor:pointer;flex:none;}' +
    '.aghi-cc-x:hover{color:#F1F2F5;border-color:rgba(85,241,248,.4);}' +
    '.aghi-cc-canvas{display:block;margin:0 auto;touch-action:none;cursor:grab;background:#0B0D12;}' +
    '.aghi-cc-canvas:active{cursor:grabbing;}' +
    '.aghi-cc-zoom{display:flex;align-items:center;gap:10px;padding:12px 16px 0;}' +
    '.aghi-cc-zoom button{width:32px;height:32px;flex:none;border-radius:8px;border:1px solid rgba(255,255,255,.12);' +
    'background:rgba(255,255,255,.05);color:#F1F2F5;font-size:16px;line-height:1;cursor:pointer;}' +
    '.aghi-cc-zoom button:hover{border-color:rgba(85,241,248,.4);}' +
    '.aghi-cc-zoom input{flex:1;accent-color:#55F1F8;}' +
    '.aghi-cc-hint{padding:8px 16px 0;font:400 12px Inter,Arial,sans-serif;color:#767CA1;}' +
    '.aghi-cc-err{padding:20px 16px;font:400 13px Inter,Arial,sans-serif;color:#ff9a9e;text-align:center;}' +
    '.aghi-cc-foot{display:flex;gap:10px;justify-content:flex-end;padding:14px 16px 16px;flex-wrap:wrap;}' +
    '.aghi-cc-btn{border-radius:10px;padding:10px 18px;font:600 13px Inter,Arial,sans-serif;cursor:pointer;border:1px solid rgba(255,255,255,.12);}' +
    '.aghi-cc-cancel{background:transparent;color:#AEB7C0;}' +
    '.aghi-cc-cancel:hover{color:#F1F2F5;}' +
    '.aghi-cc-ok{background:#55F1F8;border-color:#55F1F8;color:#062a2e;}' +
    '.aghi-cc-ok:hover{filter:brightness(1.07);}';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function loadImage(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function open(file, opts) {
    opts = opts || {};
    var aspect = (opts.aspectW || 16) / (opts.aspectH || 10);
    return Promise.resolve().then(function () {
      if (!file || typeof file.type !== 'string' || file.type.indexOf('image/') !== 0) return null;
      return loadImage(file);
    }).then(function (loaded) {
      if (!loaded || !loaded.img.naturalWidth) return null;
      return new Promise(function (resolve) {
        ensureStyles();
        var img = loaded.img, iw = img.naturalWidth, ih = img.naturalHeight;

        var backdrop = document.createElement('div');
        backdrop.className = 'aghi-cc-backdrop';
        backdrop.innerHTML =
          '<div class="aghi-cc-panel" role="dialog" aria-modal="true" aria-label="Crop cover image">' +
          '<div class="aghi-cc-head"><span>Crop cover · drag to move · scroll or pinch to zoom</span>' +
          '<button type="button" class="aghi-cc-x" aria-label="Cancel">✕</button></div>' +
          '<canvas class="aghi-cc-canvas"></canvas>' +
          '<div class="aghi-cc-zoom"><button type="button" data-z="-" aria-label="Zoom out">−</button>' +
          '<input type="range" min="0" max="1000" value="0" aria-label="Zoom">' +
          '<button type="button" data-z="+" aria-label="Zoom in">+</button></div>' +
          '<div class="aghi-cc-hint">The card shows this exact 16:10 crop.</div>' +
          '<div class="aghi-cc-foot"><button type="button" class="aghi-cc-btn aghi-cc-cancel">Cancel</button>' +
          '<button type="button" class="aghi-cc-btn aghi-cc-ok">Use this crop</button></div></div>';
        document.body.appendChild(backdrop);

        var canvas = backdrop.querySelector('canvas');
        var slider = backdrop.querySelector('input[type="range"]');
        var dpr = Math.min(2, window.devicePixelRatio || 1);

        var boxW = Math.min(560, Math.max(MIN_BOX_W, Math.floor(window.innerWidth * 0.86)));
        var boxH = boxW / aspect;
        var cw = boxW, ch = Math.ceil(boxH + CTX_PAD * 2);
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        var boxX = 0, boxY = CTX_PAD;
        var minScale = Math.max(boxW / iw, boxH / ih);
        var scale = minScale, cx = iw / 2, cy = ih / 2;

        function clampPan() {
          var vw = boxW / scale, vh = boxH / scale;
          cx = Math.min(Math.max(cx, vw / 2), iw - vw / 2);
          cy = Math.min(Math.max(cy, vh / 2), ih - vh / 2);
        }
        function imgToCanvas(ix, iy) {
          return [boxX + boxW / 2 + (ix - cx) * scale, boxY + boxH / 2 + (iy - cy) * scale];
        }
        function draw() {
          ctx.clearRect(0, 0, cw, ch);
          var tl = imgToCanvas(0, 0);
          ctx.globalAlpha = 0.35;
          ctx.drawImage(img, tl[0], tl[1], iw * scale, ih * scale);
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(boxX, boxY, boxW, boxH);
          ctx.clip();
          ctx.drawImage(img, tl[0], tl[1], iw * scale, ih * scale);
          ctx.restore();
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillRect(0, 0, cw, boxY);
          ctx.fillRect(0, boxY + boxH, cw, ch - boxY - boxH);
          ctx.strokeStyle = '#55F1F8';
          ctx.lineWidth = 2;
          ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);
          ctx.strokeStyle = 'rgba(255,255,255,.28)';
          ctx.lineWidth = 1;
          for (var g = 1; g < 3; g++) {
            ctx.beginPath();
            ctx.moveTo(boxX + (boxW * g) / 3, boxY);
            ctx.lineTo(boxX + (boxW * g) / 3, boxY + boxH);
            ctx.moveTo(boxX, boxY + (boxH * g) / 3);
            ctx.lineTo(boxX + boxW, boxY + (boxH * g) / 3);
            ctx.stroke();
          }
        }
        function syncSlider() {
          var t = Math.log(scale / minScale) / Math.log(MAX_ZOOM);
          slider.value = String(Math.round(Math.min(1, Math.max(0, t)) * 1000));
        }
        function zoomAt(factor, px, py) {
          var next = Math.min(minScale * MAX_ZOOM, Math.max(minScale, scale * factor));
          if (next === scale) return;
          var r = canvas.getBoundingClientRect();
          var qx = (px === undefined) ? boxX + boxW / 2 : px - r.left;
          var qy = (py === undefined) ? boxY + boxH / 2 : py - r.top;
          var tl = imgToCanvas(0, 0);
          var ix = (qx - tl[0]) / scale, iy = (qy - tl[1]) / scale;
          cx = ix - (qx - boxX - boxW / 2) / next;
          cy = iy - (qy - boxY - boxH / 2) / next;
          scale = next;
          clampPan();
          draw();
          syncSlider();
        }

        var pointers = new Map(), pinchD0 = 0, pinchS0 = 0, lastX = 0, lastY = 0;
        canvas.addEventListener('pointerdown', function (e) {
          canvas.setPointerCapture(e.pointerId);
          pointers.set(e.pointerId, [e.clientX, e.clientY]);
          lastX = e.clientX; lastY = e.clientY;
          if (pointers.size === 2) {
            var p = Array.from(pointers.values());
            pinchD0 = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
            pinchS0 = scale;
          }
        });
        canvas.addEventListener('pointermove', function (e) {
          if (!pointers.has(e.pointerId)) return;
          pointers.set(e.pointerId, [e.clientX, e.clientY]);
          if (pointers.size === 2) {
            var p = Array.from(pointers.values());
            var d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
            if (pinchD0 > 0) zoomAt(d / pinchD0 / (scale / pinchS0) || 1, (p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
            lastX = e.clientX; lastY = e.clientY;
            return;
          }
          cx -= (e.clientX - lastX) / scale;
          cy -= (e.clientY - lastY) / scale;
          lastX = e.clientX; lastY = e.clientY;
          clampPan();
          draw();
        });
        function endPointer(e) { pointers.delete(e.pointerId); pinchD0 = 0; }
        canvas.addEventListener('pointerup', endPointer);
        canvas.addEventListener('pointercancel', endPointer);
        canvas.addEventListener('wheel', function (e) {
          e.preventDefault();
          zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
        }, { passive: false });
        slider.addEventListener('input', function () {
          var t = (+slider.value) / 1000;
          var next = minScale * Math.pow(MAX_ZOOM, t);
          zoomAt(next / scale);
        });
        backdrop.querySelector('[data-z="+"]').addEventListener('click', function () { zoomAt(1.25); });
        backdrop.querySelector('[data-z="-"]').addEventListener('click', function () { zoomAt(1 / 1.25); });

        var done = false;
        function finish(value) {
          if (done) return;
          done = true;
          document.removeEventListener('keydown', onKey, true);
          URL.revokeObjectURL(loaded.url);
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          resolve(value);
        }
        function onKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
        }
        document.addEventListener('keydown', onKey, true);
        backdrop.querySelector('.aghi-cc-x').addEventListener('click', function () { finish(null); });
        backdrop.querySelector('.aghi-cc-cancel').addEventListener('click', function () { finish(null); });
        backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) finish(null); });
        backdrop.querySelector('.aghi-cc-ok').addEventListener('click', function () {
          var out = document.createElement('canvas');
          out.width = OUT_W; out.height = OUT_H;
          var octx = out.getContext('2d');
          var sw = boxW / scale, sh = boxH / scale;
          octx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, OUT_W, OUT_H);
          if (!out.toBlob) { finish(file); return; }
          out.toBlob(function (blob) {
            if (!blob) { finish(file); return; }
            finish(new File([blob], 'cover.webp', { type: OUT_TYPE }));
          }, OUT_TYPE, OUT_Q);
        });

        clampPan();
        draw();
        syncSlider();
        var okBtn = backdrop.querySelector('.aghi-cc-ok');
        if (okBtn && okBtn.focus) okBtn.focus();
      });
    });
  }

  window.AghiCoverCropper = { open: open };
})();
