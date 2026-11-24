/* ==========================================================================
   Home hero montage
   - Plays the clips in sequence with soft crossfades and a slow camera drift.
   - Only the first clip loads with the page; each next clip loads while the
     current one plays, so the page stays fast.
   - Pauses when scrolled away or the tab is hidden.
   - Reduced motion or Data Saver: shows the still poster frame only.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.querySelector("[data-montage]");
  if (!root) return;
  var clips = Array.prototype.slice.call(root.querySelectorAll("video"));
  if (!clips.length) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  // 2K source whenever the screen can show it: wide windows, or high-density (Retina) laptop screens
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var wide = window.innerWidth >= 1400 || Math.max(window.innerWidth, 0) * dpr >= 2000;
  var FADE = 2.0;          // crossfade length, seconds of real time
  var z = 1, cur = 0, visible = true, switching = false, raf = 0;

  clips.forEach(function (v) { v.muted = true; v.playsInline = true; v.setAttribute("muted", ""); });
  clips[0].classList.add("is-active");
  if (reduce || saveData) return; // poster frame only

  var srcOf = function (v) { return (wide && v.getAttribute("data-src-lg")) || v.getAttribute("data-src"); };
  var load = function (v) {
    if (!v.getAttribute("src")) { v.preload = "auto"; v.src = srcOf(v); v.load(); }
  };
  var setRate = function (v) {
    var r = parseFloat(v.getAttribute("data-rate") || "1");
    v.defaultPlaybackRate = r; v.playbackRate = r;
  };
  var play = function (v) {
    setRate(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  };

  // Crossfade only once the incoming clip can actually play, so it never
  // freezes or flashes mid-fade. The outgoing clip keeps its zoom while it
  // fades (is-leaving), then rewinds quietly for the next loop.
  var ready = function (v) { return v.readyState >= 3; };
  var advance = function () {
    if (switching) return;
    switching = true;
    var a = clips[cur], ni = (cur + 1) % clips.length, b = clips[ni];
    load(b);
    var go = function () {
      b.removeEventListener("canplay", go); clearTimeout(wait);
      b.style.zIndex = String(++z);
      play(b);
      b.classList.add("is-active");
      a.classList.add("is-leaving");
      a.classList.remove("is-active");
      setTimeout(function () {
        a.classList.remove("is-leaving");
        a.pause();
        try { a.currentTime = 0; } catch (e) {}
        cur = ni; switching = false;
        load(clips[(ni + 1) % clips.length]); // warm up the one after
      }, FADE * 1000 + 100);
    };
    var wait = 0;
    if (ready(b)) go();
    else { b.addEventListener("canplay", go); wait = setTimeout(go, 4000); }
  };

  // the hero is pinned and the next section slides over it: once fully covered, rest the videos
  var hero = root.closest("section");
  var cover = hero && hero.nextElementSibling;
  var tick = function () {
    var v = clips[cur];
    var covered = cover && cover.getBoundingClientRect().top <= 0;
    if (covered) { if (!v.paused) v.pause(); raf = requestAnimationFrame(tick); return; }
    if (v.paused && !switching) play(v);
    if (v.duration && !switching) {
      var left = (v.duration - v.currentTime) / (v.playbackRate || 1); // real seconds remaining
      if (left <= FADE + 0.05) advance();
    }
    raf = requestAnimationFrame(tick);
  };
  clips.forEach(function (v) { v.addEventListener("ended", function () { if (v === clips[cur]) advance(); }); });

  var start = function () {
    if (!visible || document.hidden) return;
    play(clips[cur]);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  };
  var stop = function () { cancelAnimationFrame(raf); clips.forEach(function (v) { v.pause(); }); };

  load(clips[0]);
  if (clips[1]) load(clips[1]);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.01 }).observe(root);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  start();
})();
