/* ==========================================================================
   Network page hero: the Almagest network in motion.
   Earth's limb glows at the lower right; satellites glide along three orbital
   shells. Neighbours within range hold optical crosslinks (thin cyan lines
   with travelling packets); a satellite passing over a ground gateway on the
   horizon opens a soft E-band beam to it. Canvas 2D, DPR capped at 2, pauses
   off-screen / hidden tab, single still frame for prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  var canvas = document.querySelector("canvas[data-network-hero]");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = 1, ex = 0, ey = 0, R = 0, running = false, visible = true, raf = 0, t0 = performance.now();
  var stars = [], sats = [], gateways = [], packets = [], SH = [0.14, 0.27, 0.4], SPAN = 1;

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function build() {
    var r = rng(7);
    var phone = W < 700;
    // Earth: a huge circle whose top edge forms the horizon at the lower right
    R = phone ? W * 1.7 : Math.max(W * 0.95, H * 1.4);
    ex = W * (phone ? 0.5 : 0.7);
    ey = H * (phone ? 0.74 : 0.82) + R;   // horizon sits low; orbits fill the space above
    stars = [];
    for (var i = 0; i < Math.round(W * H / 5200); i++) stars.push({ x: r() * W, y: r() * H * 0.85, a: 0.15 + r() * 0.5, s: r() < 0.08 ? 1.4 : 0.8 });
    // three orbital shells; satellites spread around each
    SPAN = 2 * Math.asin(Math.min(0.98, (W * 0.75) / R));
    SH = phone ? [0.12, 0.22, 0.32] : [0.14, 0.27, 0.40];
    var shells = [
      { h: SH[0], n: 7, w: 0.018, c: "111,230,222" },
      { h: SH[1], n: 6, w: -0.013, c: "124,196,255" },
      { h: SH[2], n: 5, w: 0.010, c: "138,156,255" },
    ];
    sats = [];
    shells.forEach(function (sh, si) {
      for (var k = 0; k < sh.n; k++) sats.push({ shell: si, rr: R + H * sh.h, w: sh.w, a0: -Math.PI / 2 + ((k + 0.5) / sh.n - 0.5) * SPAN + r() * 0.05, c: sh.c });
    });
    gateways = [-0.36, -0.18, 0, 0.18, 0.36].map(function (f) { return -Math.PI / 2 + f * SPAN * 0.9; });
    packets = [];
  }
  function resize() {
    var b = canvas.getBoundingClientRect();
    W = Math.max(1, b.width); H = Math.max(1, b.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    build();
    if (!running) draw(performance.now());
  }
  function polar(rr, a) { return { x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr }; }
  function angle(s, t) { var a = s.a0 + s.w * t; var span = SPAN; return -Math.PI / 2 + ((((a + Math.PI / 2 + span / 2) % span) + span) % span) - span / 2; }

  function draw(now) {
    var t = reduce ? 6 : (now - t0) / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // stars
    stars.forEach(function (s) { ctx.fillStyle = "rgba(233,237,245," + s.a + ")"; ctx.fillRect(s.x, s.y, s.s, s.s); });

    // atmosphere glow + Earth body + limb
    var glow = ctx.createRadialGradient(ex, ey, R * 0.98, ex, ey, R * 1.12);
    glow.addColorStop(0, "rgba(80,140,255,0.38)"); glow.addColorStop(1, "rgba(80,140,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ex, ey, R * 1.12, 0, Math.PI * 2); ctx.fill();
    var body = ctx.createLinearGradient(0, ey - R, 0, ey - R + H * 0.5);
    body.addColorStop(0, "#132a63"); body.addColorStop(0.4, "#0a1736"); body.addColorStop(1, "#04060b");
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(160,200,255,0.9)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ex, ey, R, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();

    // orbital shells (faint)
    SH.forEach(function (h) {
      ctx.strokeStyle = "rgba(233,237,245,0.07)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ex, ey, R + H * h, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    });

    // gateways on the horizon
    var gpts = gateways.map(function (a) { return polar(R, a); });

    // satellite positions
    var pts = sats.map(function (s) { var a = angle(s, t); var p = polar(s.rr, a); p.a = a; p.c = s.c; p.shell = s.shell; return p; });

    // E-band beams: satellite directly over a gateway
    pts.forEach(function (p) {
      gpts.forEach(function (g, gi) {
        var da = Math.abs(p.a - gateways[gi]);
        var lim = 26 / R;
        if (da < lim) {
          var k = 1 - da / lim;
          var grad = ctx.createLinearGradient(p.x, p.y, g.x, g.y);
          grad.addColorStop(0, "rgba(111,230,222," + (0.55 * k) + ")"); grad.addColorStop(1, "rgba(111,230,222," + (0.05 * k) + ")");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.moveTo(p.x - 1.5, p.y); ctx.lineTo(g.x - 14, g.y); ctx.lineTo(g.x + 14, g.y); ctx.lineTo(p.x + 1.5, p.y); ctx.closePath(); ctx.fill();
          if (!reduce && Math.random() < 0.08 * k) packets.push({ a: p, b: g, p: 0, s: 1.6 });
        }
      });
    });

    // optical crosslinks between neighbours in range
    var reach = Math.min(W, H) * 0.32;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        if (Math.abs(pts[i].shell - pts[j].shell) > 1) continue;
        var d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d > reach) continue;
        var k = 1 - d / reach;
        ctx.strokeStyle = "rgba(111,230,222," + (0.12 + k * 0.45) + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        if (!reduce && k > 0.4 && Math.random() < 0.006) packets.push({ a: pts[i], b: pts[j], p: 0, s: 0.8 + Math.random() * 0.5 });
      }
    }

    // packets (positions captured at spawn; short-lived so drift is invisible)
    packets = packets.filter(function (pk) { return pk.p < 1; });
    if (packets.length > 60) packets.splice(0, packets.length - 60);
    packets.forEach(function (pk) {
      pk.p += 0.02 * pk.s;
      var x = pk.a.x + (pk.b.x - pk.a.x) * pk.p, y = pk.a.y + (pk.b.y - pk.a.y) * pk.p;
      ctx.fillStyle = "rgba(233,255,255," + (1 - pk.p * 0.6) + ")";
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    });

    // gateways
    gpts.forEach(function (g) {
      ctx.fillStyle = "rgba(111,230,222,0.9)"; ctx.beginPath(); ctx.arc(g.x, g.y, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(111,230,222,0.35)"; ctx.beginPath(); ctx.arc(g.x, g.y, 6, 0, Math.PI * 2); ctx.stroke();
    });

    // satellites
    pts.forEach(function (p) {
      if (p.y > ey - R + 4 && Math.hypot(p.x - ex, p.y - ey) < R) return;
      ctx.fillStyle = "rgba(" + p.c + ",0.18)"; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgb(" + p.c + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(" + p.c + ",0.8)"; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(p.x - 9, p.y); ctx.lineTo(p.x - 5, p.y); ctx.moveTo(p.x + 5, p.y); ctx.lineTo(p.x + 9, p.y); ctx.stroke();
    });
  }

  function frame(now) { if (!running) return; draw(now); raf = requestAnimationFrame(frame); }
  function play() { if (running || reduce || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? play() : stop(); }).observe(canvas);
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : play(); });
  resize(); play();
})();
