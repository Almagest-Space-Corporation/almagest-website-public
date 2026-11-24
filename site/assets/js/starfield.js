/* ==========================================================================
   Twinkling star field for the Services / Team / Contact heroes.
   Canvas2D, a few hundred stars, slow drift. Caps pixel ratio at 2, pauses
   when off-screen or the tab is hidden, and draws one still frame for
   prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PRESETS = {
    services: { density: 1 / 2400, drift: -0.010, tint: 0.16 },
    team:     { density: 1 / 2000, drift:  0.006, tint: 0.10 },
    contact:  { density: 1 / 2800, drift:  0.000, tint: 0.12 },
  };
  var COLORS = ["233,237,245", "111,230,222", "138,156,255"];

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  document.querySelectorAll("canvas[data-stars]").forEach(function (canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var cfg = PRESETS[canvas.getAttribute("data-stars")] || PRESETS.services;
    var W = 0, H = 0, DPR = 1, stars = [], running = false, visible = true, raf = 0, t0 = performance.now();

    function build() {
      var r = rng(2022), count = Math.round(Math.min(650, Math.max(120, W * H * cfg.density)));
      stars = [];
      for (var i = 0; i < count; i++) {
        var z = Math.pow(r(), 2.4); // most stars small and faint
        var c = r() < cfg.tint ? COLORS[1 + Math.floor(r() * 2)] : COLORS[0];
        stars.push({ x: r() * W, y: r() * H, z: z, tw: r() * 6.283, sp: 0.4 + r() * 1.4, c: c });
      }
    }
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      build(); if (!running) draw(performance.now());
    }
    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var x = s.x + (reduce ? 0 : t * cfg.drift * 60 * (0.3 + s.z));
        x = ((x % W) + W) % W;
        var tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * s.sp + s.tw);
        var a = (0.2 + 0.8 * s.z) * tw;
        var size = 0.5 + s.z * 1.5;
        ctx.fillStyle = "rgba(" + s.c + "," + a + ")";
        if (size < 1.2) ctx.fillRect(x, s.y, size, size);
        else {
          ctx.beginPath(); ctx.arc(x, s.y, size * 0.6, 0, 6.283); ctx.fill();
          if (s.z > 0.82) { // soft glint on the brightest few
            ctx.strokeStyle = "rgba(" + s.c + "," + a * 0.3 + ")"; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(x - size * 3, s.y); ctx.lineTo(x + size * 3, s.y);
            ctx.moveTo(x, s.y - size * 3); ctx.lineTo(x, s.y + size * 3); ctx.stroke();
          }
        }
      }
    }
    function frame(now) { if (!running) return; draw(now); raf = requestAnimationFrame(frame); }
    function play() { if (running || reduce || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? play() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : play(); });
    resize(); play();
  });
})();
