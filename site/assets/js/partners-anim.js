/* ==========================================================================
   Partnerships hero: "Rendezvous"
   Three interlocking orbits (an echo of the Almagest rings), one per
   partnership area. Each carries a spacecraft; when two pass close, a data
   link forms between them and packets flow to the shared Almagest hub.
   Canvas 2D, DPR capped at 2, pauses off-screen / hidden tab, one still
   frame for prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  var canvas = document.querySelector("canvas[data-rendezvous]");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // orbit: radii as a fraction of the stage, tilt (rad), speed (rad/s), phase, colour
  var ORBITS = [
    { rx: 0.44, ry: 0.17, tilt: -0.42, speed: 0.30, phase: 0.6, c: "111,230,222" },  // space tech
    { rx: 0.44, ry: 0.17, tilt: 0.42, speed: -0.24, phase: 2.6, c: "138,156,255" },  // ground tech
    { rx: 0.17, ry: 0.44, tilt: 0.0, speed: 0.19, phase: 4.4, c: "255,107,154" },    // satellite networks
  ];
  var W = 0, H = 0, DPR = 1, S = 0, cx = 0, cy = 0, running = false, visible = true, raf = 0, t0 = performance.now();
  var packets = []; // {a, b, p, speed}

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    S = Math.min(W, H) * 1.0; cx = W / 2; cy = H / 2;
    if (!running) draw(performance.now());
  }
  function pos(o, a) {
    var x = Math.cos(a) * o.rx * S, y = Math.sin(a) * o.ry * S;
    var ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
    return { x: cx + x * ct - y * st, y: cy + x * st + y * ct };
  }
  function ring(o) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.tilt);
    ctx.beginPath(); ctx.ellipse(0, 0, o.rx * S, o.ry * S, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + o.c + ",0.28)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  function craft(p, c, glow) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 10 + glow * 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + c + "," + (0.08 + glow * 0.12) + ")"; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(" + c + ")"; ctx.fill();
    // little solar wings
    ctx.strokeStyle = "rgba(" + c + ",0.85)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x - 6, p.y); ctx.moveTo(p.x + 6, p.y); ctx.lineTo(p.x + 11, p.y); ctx.stroke();
  }
  function line(a, b, alpha, c1, c2) {
    var g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, "rgba(" + c1 + "," + alpha + ")"); g.addColorStop(1, "rgba(" + c2 + "," + alpha + ")");
    ctx.strokeStyle = g; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ORBITS.forEach(ring);

    var hub = { x: cx, y: cy };
    var pts = ORBITS.map(function (o) { return pos(o, o.phase + (reduce ? 0 : t * o.speed)); });
    var reach = S * 0.5;

    // links between partners when close + spokes to the hub
    for (var i = 0; i < pts.length; i++) {
      line(pts[i], hub, 0.16, ORBITS[i].c, "233,237,245");
      for (var j = i + 1; j < pts.length; j++) {
        var d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        var k = Math.max(0, 1 - d / reach);
        if (k > 0) {
          line(pts[i], pts[j], 0.15 + k * 0.6, ORBITS[i].c, ORBITS[j].c);
          if (!reduce && k > 0.35 && Math.random() < 0.03) packets.push({ a: i, b: j, p: 0, s: 0.9 + Math.random() * 0.6 });
        }
      }
      if (!reduce && Math.random() < 0.012) packets.push({ a: i, b: -1, p: 0, s: 0.6 + Math.random() * 0.4 });
    }

    // packets travel along live links (partner→partner, partner→hub)
    packets = packets.filter(function (pk) { return pk.p < 1; });
    if (packets.length > 40) packets.splice(0, packets.length - 40);
    packets.forEach(function (pk) {
      var A = pts[pk.a], B = pk.b < 0 ? hub : pts[pk.b];
      pk.p += 0.016 * pk.s;
      var x = A.x + (B.x - A.x) * pk.p, y = A.y + (B.y - A.y) * pk.p;
      ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(233,237,245," + (0.9 - pk.p * 0.5) + ")"; ctx.fill();
    });

    // Almagest hub
    var pulse = reduce ? 0 : (Math.sin(t * 1.6) + 1) / 2;
    ctx.beginPath(); ctx.arc(hub.x, hub.y, 22 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(233,237,245," + (0.12 + (1 - pulse) * 0.1) + ")"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(hub.x, hub.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#04060b"; ctx.fill();
    ctx.strokeStyle = "rgba(233,237,245,0.85)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(hub.x, hub.y, 4, 0, Math.PI * 2); ctx.fillStyle = "rgb(233,237,245)"; ctx.fill();

    pts.forEach(function (p, i) {
      var near = 0;
      for (var j = 0; j < pts.length; j++) if (j !== i) near = Math.max(near, 1 - Math.hypot(p.x - pts[j].x, p.y - pts[j].y) / reach);
      craft(p, ORBITS[i].c, Math.max(0, near));
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
