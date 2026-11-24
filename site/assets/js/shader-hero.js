/* ==========================================================================
   Hero shader background + hero video slot
   Plain-JS port of the "animated-shader-hero" React component's WebGL2 shader
   (shader by Matthias Hurrle, @atzedent), recolored to the Almagest palette.

   Performance: renders at a fraction of CSS resolution (it's a soft nebula, so
   upscaling is invisible), lowers that further on slow devices, pauses when
   off-screen or in a hidden tab, and draws a single still frame for
   prefers-reduced-motion. Without WebGL2 the hero keeps its CSS gradient.
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.querySelector(".hero--scene");

  /* ---------------- Shader ---------------- */
  var canvas = document.querySelector("canvas[data-shader]");
  var gl = canvas && canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });

  if (canvas && !gl) { canvas.remove(); canvas = null; }

  if (gl) {
    var VERT = "#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}";
    var FRAG = [
      "#version 300 es",
      "precision highp float;",
      "out vec4 O;",
      "uniform vec2 resolution;",
      "uniform float time;",
      "uniform vec2 center;",
      "#define FC gl_FragCoord.xy",
      "#define T time",
      "#define R resolution",
      "#define MN min(R.x,R.y)",
      "float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}",
      "float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);",
      "  float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);",
      "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}",
      "float fbm(vec2 p){float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);",
      "  for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}return t;}",
      "float clouds(vec2 p){float d=1.,t=.0;",
      "  for(float i=.0;i<3.;i++){float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);t=mix(t,d,a);d=a;p*=2./(i+1.);}",
      "  return t;}",
      "void main(void){",
      "  vec2 uv=(FC-center*R)/MN,st=uv*vec2(2,1);",
      "  vec3 col=vec3(0);",
      "  float bg=clouds(vec2(st.x+T*.12,-st.y));",          // slower drift than the original (.5)
      "  uv*=1.-.3*(sin(T*.1)*.5+.5);",
      "  vec3 cyan=vec3(.44,.9,.87), violet=vec3(.55,.5,1.);",
      "  for(float i=1.;i<12.;i++){",
      "    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.25+.1*uv.x);",
      "    vec2 p=uv; float d=length(p);",
      "    col+=.00125/d*mix(cyan,violet,.5+.5*sin(i*1.7))*2.;",
      "    float b=noise(i+p+bg*1.731);",
      "    col+=.0016*b/length(max(p,vec2(b*p.x*.02,p.y)))*vec3(.7,.8,1.);",
      "    col=mix(col,vec3(bg*.035,bg*.07,bg*.2),d);",          // deep-space blue instead of orange
      "  }",
      "  O=vec4(col*.68,1);",
      "}"
    ].join("\n");

    var compile = function (type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("Shader:", gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    var prog = vs && fs && gl.createProgram();
    if (prog) {
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); prog = null; }
    }
    if (!prog) { canvas.remove(); canvas = null; gl = null; }
  }

  if (gl) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "resolution");
    var uTime = gl.getUniformLocation(prog, "time");
    var uCenter = gl.getUniformLocation(prog, "center");

    var narrow = window.matchMedia("(max-width: 899px)");
    var scale = narrow.matches ? 0.4 : 0.5;  // fraction of CSS pixels
    var running = false, visible = true, raf = 0, t0 = performance.now(), slowFrames = 0, last = 0;

    var size = function () {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * scale));
      canvas.height = Math.max(1, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    var render = function (now) {
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) * 1e-3 + 12.0);
      // light swirl sits behind the satellites, away from the headline
      if (narrow.matches) gl.uniform2f(uCenter, 0.55, 0.38); else gl.uniform2f(uCenter, 0.7, 0.58);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    var frame = function (now) {
      if (!running) return;
      if (last) {
        // if frames take > 28ms on average, drop resolution once
        if (now - last > 28) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames > 40 && scale > 0.3) { scale = 0.28; slowFrames = 0; size(); }
      }
      last = now;
      render(now);
      raf = requestAnimationFrame(frame);
    };
    var play = function () { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    var stop = function () { running = false; cancelAnimationFrame(raf); };

    size(); render(performance.now());
    hero && hero.classList.add("has-shader");
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); if (!running) render(performance.now()); }, 150); }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? play() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : play(); });
    play();
  }
})();
