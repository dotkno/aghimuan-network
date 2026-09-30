/**
 * aghi-img-fallback.js — graceful degradation for missing uploads.
 *
 * Problem: a user's DB record can point at an avatar/banner file that no
 * longer exists on disk (deleted out-of-band, lost in a restore, etc.).
 * Every poll re-render then fires a new request for the ghost file, filling
 * the console with 404s and showing broken-image icons.
 *
 * What this file does (tiny, no dependencies — load it early, NOT deferred):
 *   1. Keeps a per-page-load cache of URLs already known to be broken, so a
 *      ghost file is requested ONCE and never again (`isBad` / `probe`).
 *   2. Global capture-phase error listener: any <img> tagged with
 *      data-avatar-name becomes a color monogram on failure; any <img>
 *      tagged with data-fallback="hide" removes itself (gallery/covers).
 *
 * Jargon:
 * - `capture phase` = the error listener runs on the way DOWN to the
 *   image (images don't bubble error events, so we catch them falling).
 * - `monogram` = colored circle with the user's initial, used for presets.
 */
(function () {
  'use strict';

  var DEFAULT_COLOR = '#5F5E5A';
  var badUrls = Object.create(null); // url -> true once it 404s (this page load only)

  function monogramFor(name) {
    var ch = (name || '?').charAt(0) || '?';
    return ch.toUpperCase();
  }

  function isBad(url) {
    return !!url && !!badUrls[url];
  }

  function markBad(url) {
    if (url) badUrls[url] = true;
  }

  // Probe a URL once: ok(url) if it loads, bad() if not. Known-bad URLs
  // skip the network entirely and fail immediately (kills 404 spam from
  // polling renderers that rebuild every few seconds).
  function probe(url, ok, bad) {
    if (!url) { bad(); return; }
    if (isBad(url)) { bad(); return; }
    var img = new Image();
    img.onload = function () { ok(url); };
    img.onerror = function () { markBad(url); bad(); };
    img.src = url;
  }

  function swapImgToMonogram(img) {
    if (!img || !img.parentNode) return;
    var name = img.getAttribute('data-avatar-name') || '?';
    var color = img.getAttribute('data-avatar-color') || DEFAULT_COLOR;
    var w = img.offsetWidth || 32;
    var h = img.offsetHeight || 32;
    var span = document.createElement('span');
    span.className = 'aghi-img-fallback-mono';
    span.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;' +
      'width:' + w + 'px;height:' + h + 'px;background:' + color + ';color:#fff;font-weight:700;';
    try { span.style.borderRadius = getComputedStyle(img).borderRadius; } catch (_) {}
    span.textContent = monogramFor(name);
    markBad(img.currentSrc || img.src);
    img.parentNode.replaceChild(span, img);
  }

  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (t.hasAttribute('data-avatar-name')) {
      swapImgToMonogram(t);
    } else if (t.getAttribute('data-fallback') === 'hide') {
      markBad(t.currentSrc || t.src);
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    // Untagged images (logos, CDN art with their own onerror) are untouched.
  }, true);

  window.AghiImgFallback = {
    isBad: isBad,
    markBad: markBad,
    probe: probe,
  };
})();
