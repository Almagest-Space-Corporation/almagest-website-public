/* ==========================================================================
   Almagest — interactions & motion
   GSAP + ScrollTrigger are progressive enhancements: if they fail to load,
   or the visitor prefers reduced motion, every element is shown in its
   final state.
   ========================================================================== */
(function () {
  "use strict";

  window.__almagest = true;
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  // If motion was requested but GSAP is missing, show everything immediately
  if (!hasGsap || reduce) {
    root.classList.remove("motion");
    if (reduce) root.classList.add("reduced");
  }

  var userMoved = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
    window.addEventListener(ev, function () { userMoved = true; }, { passive: true, once: true });
  });

  /* ---------- A fresh visit starts at the top ----------
     Some hosts (e.g. the claude.ai share viewer, which shows the site inside a
     frame) keep an old scroll position. A fresh visit
     (not Back/Forward, not Reload, no #section) now always starts at the top,
     including bringing the framed site back into view in its host page. */
  (function () {
    var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
    if (window.location.hash || nav.type === "back_forward" || nav.type === "reload") return;
    var toTop = function () {
      window.scrollTo(0, 0);
      if (window.top !== window.self) {
        try { document.documentElement.scrollIntoView({ block: "start" }); } catch (e) {}
      }
    };
    toTop();
    // re-check once everything has loaded, but never once the visitor has started scrolling
    window.addEventListener("load", function () { setTimeout(function () { if (!userMoved) toTop(); }, 0); }, { once: true });
  })();

  /* ---------- Smooth, cinematic scrolling (Lenis) ----------
     Wheel/trackpad scrolling eases instead of jumping; touch devices keep their
     native scrolling. Driven by the GSAP ticker so ScrollTrigger and the hero
     parallax stay in lockstep. Skipped for reduced motion or if Lenis fails to load. */
  var lenis = null;
  if (hasGsap && !reduce && typeof window.Lenis === "function") {
    // lerp 0.12: smooth but responsive (no floaty lag after the wheel stops)
    // smoothWheel off: mouse/trackpad scrolling is the device's own, so the page
    // stops exactly where the visitor stops (no drifting past sections).
    // Lenis is kept only for the gentle glide when a nav link is clicked.
    lenis = new window.Lenis({ smoothWheel: false, syncTouch: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ---------- In-page links (#…) ----------
     Glide to the target (instant jump when smooth scrolling is off), keep the
     heading clear of the fixed header, and move keyboard focus to the target so
     "Skip to content" and section links work for keyboard and screen-reader users. */
  function headerOffset() {
    var h = document.querySelector(".site-header");
    return (h ? h.offsetHeight : 72) + 12;
  }
  function focusTarget(target) {
    if (!target.matches('a, button, input, textarea, select, [tabindex]')) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  /* ---------- One continuous page: glide to sections ----------
     Always takes the shortest route (down for sections below, up for sections
     above). Long trips never "travel" the whole page: the view cuts to just
     short of the destination and glides the final stretch with a gentle
     ease-out, so every jump takes under a second. Section openers (the
     full-height chapter heroes) align to the very top under the transparent
     header; other targets sit just below the header. Any wheel, touch or key
     input interrupts an in-progress glide. */
  function targetTop(target) {
    var off = target.hasAttribute("data-chapter") ? 0 : headerOffset();
    var y = target.getBoundingClientRect().top + window.scrollY - off;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(Math.round(y), max));
  }
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
  function glideTo(target, done) {
    var top = targetTop(target);
    if (!lenis) {
      window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
      if (done) setTimeout(done, reduce ? 0 : 700);
      return;
    }
    var vh = window.innerHeight, cur = lenis.scroll, d = top - cur, far = vh * 1.25;
    if (Math.abs(d) < 2) { if (done) done(); return; }
    if (Math.abs(d) > far) { lenis.scrollTo(top - (d > 0 ? far : -far), { immediate: true, force: true }); d = d > 0 ? far : -far; }
    var duration = Math.max(0.5, Math.min(0.95, 0.4 + Math.abs(d) / vh * 0.45));
    lenis.scrollTo(top, { duration: duration, easing: easeOut, force: true, onComplete: function () { if (done) done(); } });
  }
  window.__glideTo = glideTo;
  var chapterLock = null; // chapter being navigated to: holds the active nav state steady mid-glide
  var lockTimer = 0;
  function releaseLock() { chapterLock = null; clearTimeout(lockTimer); if (window.__updateChapter) window.__updateChapter(); }
  ["wheel", "touchstart", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!chapterLock) return;
      if (ev === "keydown" && ["Tab", "Shift", "Enter", " "].indexOf(e.key) > -1) return;
      releaseLock();
    }, { passive: true });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var url;
    try { url = new URL(a.getAttribute("href"), window.location.href); } catch (err) { return; }
    // only same-page hash links (#id or thispage.html#id)
    if (!url.hash || url.hash.length < 2 || url.pathname !== window.location.pathname || url.search !== window.location.search) return;
    var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    var chapter = target.hasAttribute("data-chapter") ? target : null;
    if (chapter) {
      chapterLock = chapter; clearTimeout(lockTimer);
      lockTimer = setTimeout(releaseLock, 1600);
      if (window.__updateChapter) window.__updateChapter();
    }
    glideTo(target, function () { focusTarget(target); if (chapter) releaseLock(); });
  });

  // Opened with a #section in the address bar: land on it once layout has settled
  if (window.location.hash.length > 1) {
    window.addEventListener("load", function () {
      if (userMoved) return; // never yank the page once the visitor is scrolling
      var t = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!t) return;
      var y = targetTop(t);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    }, { once: true });
  }

  // Late-loading images (team photos, map) shift the layout: keep scroll triggers in the right place
  if (hasGsap && "ResizeObserver" in window) {
    var rfT, lastH = document.body.scrollHeight;
    new ResizeObserver(function () {
      var h = document.body.scrollHeight;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h; clearTimeout(rfT);
      // re-measure only once scrolling has settled, so it never causes a jump mid-scroll
      var settle = function () {
        if (lenis && lenis.isScrolling) { rfT = setTimeout(settle, 250); return; }
        ScrollTrigger.refresh(); if (lenis) lenis.resize();
      };
      rfT = setTimeout(settle, 300);
    }).observe(document.body);
  }

  /* ---------- Home hero parallax ----------
     The video layer drifts at ~60% of scroll speed and the headline at ~88%,
     so the text lifts away from the footage with real depth. Transforms only
     (GPU-composited), and only while the hero is on screen. */
  var heroSec = document.querySelector(".hero--montage");
  var heroVid = heroSec && heroSec.querySelector(".montage");
  var heroTxt = heroSec && heroSec.querySelector(".hero__content");
  if (heroSec && heroVid && heroTxt && !reduce) {
    var pxQueued = false;
    var parallax = function () {
      pxQueued = false;
      var y = window.scrollY, h = heroSec.offsetHeight;
      if (y > h) return;
      heroVid.style.transform = "translate3d(0," + (y * 0.4).toFixed(1) + "px,0)";
      heroTxt.style.transform = "translate3d(0," + (y * 0.12).toFixed(1) + "px,0)";
    };
    window.addEventListener("scroll", function () { if (!pxQueued) { pxQueued = true; requestAnimationFrame(parallax); } }, { passive: true });
    parallax();
  }

  /* ---------- Home hero paragraph: sentence-by-sentence "typed" reveal ----------
     3 s after the page loads, the first sentence fades in character by character
     from left to right; after a short pause the second sentence follows the same
     way. Each character fades softly (no cursor), so it reads as cinematic rather
     than a typewriter. Characters are inline spans, so line breaks are exactly the
     same as the plain text. Screen readers get the full sentence text once (the
     animated copy is aria-hidden). Runs once per page load. */
  var typeP = document.querySelector("[data-type-reveal]");
  if (typeP && root.classList.contains("motion")) {
    var CHAR = 0.028, PAUSE = 0.75; // seconds per character, pause between sentences
    var srText = typeP.textContent.replace(/\s+/g, " ").trim();
    var t = 0;
    typeP.querySelectorAll(".sn").forEach(function (sn, si) {
      if (si > 0) t += PAUSE;
      var text = sn.textContent, frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === " ") { frag.appendChild(document.createTextNode(" ")); t += CHAR * 0.6; continue; }
        var c = document.createElement("span");
        c.className = "c"; c.textContent = ch;
        c.style.transitionDelay = t.toFixed(3) + "s";
        frag.appendChild(c);
        t += CHAR;
      }
      sn.textContent = ""; sn.appendChild(frag);
      sn.setAttribute("aria-hidden", "true");
    });
    var sr = document.createElement("span");
    sr.className = "sr-only"; sr.textContent = srText;
    typeP.appendChild(sr);
    typeP.classList.add("is-split");

    var typeStarted = false;
    var startType = function () {
      if (typeStarted) return; typeStarted = true;
      setTimeout(function () { typeP.classList.add("is-revealed"); }, 3000);
    };
    if (document.readyState === "complete") startType();
    else {
      window.addEventListener("load", startType, { once: true });
      setTimeout(startType, 2000); // a slow asset never holds the text back for long
    }
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header: solid on scroll, hide on scroll down ---------- */
  var header = document.querySelector(".site-header");
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 24);
    }
    lastY = y; ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (lenis) { open ? lenis.stop() : lenis.start(); } // page behind the menu must not scroll
    if (open) {
      var first = menu.querySelector("a.is-active") || menu.querySelector("a");
      if (first) setTimeout(function () { first.focus(); }, 50);
      if (hasGsap && !reduce) {
        gsap.fromTo(menu.querySelectorAll("li"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.05 });
      }
    }
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () { setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
      // simple focus trap
      if (e.key === "Tab" && menu.classList.contains("is-open")) {
        var f = [menuBtn].concat(Array.prototype.slice.call(menu.querySelectorAll("a, button")));
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function (m) { if (m.matches) setMenu(false); });
  }

  /* ---------- HUD clock ---------- */
  var clock = document.querySelector("[data-utc]");
  if (clock) {
    var tickClock = function () {
      var d = new Date();
      clock.textContent = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
    };
    tickClock(); setInterval(tickClock, 1000);
  }

  /* ---------- Active section: nav highlight + indicator at the top ----------
     The section whose area holds a line ~30% down the screen is "current"
     (the last one once the page bottom is reached). Its desktop and mobile
     menu links turn cyan, the small label beside the logo (phones/tablets)
     names it, and a hairline under the header fills as you read the page,
     with ticks where each section begins. */
  var chapters = Array.prototype.slice.call(document.querySelectorAll("main [data-chapter]"));
  if (chapters.length) {
    var navAll = Array.prototype.slice.call(document.querySelectorAll(".nav__links a[href^='#'], .mobile-menu a.mm-link[href^='#']"));
    var label = document.querySelector("[data-chapter-current]");
    var labelNum = label && label.querySelector(".chapter-label__num");
    var labelName = label && label.querySelector(".chapter-label__name");
    var bar = document.querySelector(".chapter-bar");
    var fill = bar && bar.querySelector(".chapter-bar__fill");
    var current = null, tops = [], maxScroll = 1;
    var measure = function () {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      tops = chapters.map(function (c) { return c.getBoundingClientRect().top + window.scrollY; });
      if (bar) {
        bar.querySelectorAll(".chapter-bar__tick").forEach(function (t) { t.remove(); });
        tops.forEach(function (t, i) {
          if (!i) return;
          var tick = document.createElement("i");
          tick.className = "chapter-bar__tick";
          tick.style.left = (Math.min(1, t / maxScroll) * 100).toFixed(2) + "%";
          bar.appendChild(tick);
        });
      }
    };
    var setCurrent = function (c) {
      if (c === current) return;
      current = c;
      var href = "#" + c.id;
      navAll.forEach(function (a) {
        var on = a.getAttribute("href") === href;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
      if (labelNum) labelNum.textContent = c.getAttribute("data-chapter");
      if (labelName) labelName.textContent = c.getAttribute("data-chapter-label");
      if (label) {
        label.classList.remove("is-swap"); void label.offsetWidth; label.classList.add("is-swap");
      }
    };
    var update = function () {
      var y = window.scrollY;
      if (fill) fill.style.transform = "scaleX(" + Math.min(1, Math.max(0, y / maxScroll)).toFixed(4) + ")";
      if (chapterLock) { setCurrent(chapterLock); return; }
      var probe = y + window.innerHeight * 0.3, pick = chapters[0];
      for (var i = 0; i < chapters.length; i++) if (tops[i] <= probe) pick = chapters[i];
      if (y >= maxScroll - 4) pick = chapters[chapters.length - 1]; // short last section
      setCurrent(pick || chapters[0]);
    };
    /* Scroll-spy: the section whose area holds a line 30% down the screen is
       active. Section start positions are measured once (and on resize /
       layout changes); an IntersectionObserver on every block of the page
       re-checks whenever content crosses that line, and every scroll event
       re-checks too, so the highlight never lags behind. */
    if ("IntersectionObserver" in window) {
      var spyIO = new IntersectionObserver(function () { update(); }, { rootMargin: "-30% 0px -69% 0px", threshold: 0 });
      Array.prototype.slice.call(document.querySelectorAll("main > *")).forEach(function (b) { spyIO.observe(b); });
    }
    window.__updateChapter = update;
    window.addEventListener("scroll", update, { passive: true }); // cheap: cached positions only
    var remeasure = function () { measure(); update(); };
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("load", remeasure);
    if ("ResizeObserver" in window) {
      var rmT; new ResizeObserver(function () { clearTimeout(rmT); rmT = setTimeout(remeasure, 120); }).observe(document.body);
    }
    remeasure();
  }

  /* ---------- How-data-moves steps (works with or without GSAP) ---------- */
  var flow = document.querySelector("[data-flow]");
  if (flow) {
    var steps = Array.prototype.slice.call(flow.querySelectorAll(".flow-step"));
    var groups = Array.prototype.slice.call(flow.querySelectorAll(".fg"));
    var segs = Array.prototype.slice.call(flow.querySelectorAll(".progress span"));
    var setStep = function (n) {
      steps.forEach(function (s, i) { s.classList.toggle("is-active", i + 1 === n); });
      groups.forEach(function (g) {
        var k = +g.getAttribute("data-step");
        g.classList.toggle("is-lit", k <= n);
        g.classList.toggle("is-current", k === n);
      });
      segs.forEach(function (s, i) { s.classList.toggle("is-on", i < n); });
    };
    setStep(reduce ? 4 : 1);
    if (!reduce && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) setStep(steps.indexOf(e.target) + 1);
        });
      }, { rootMargin: "-45% 0px -45% 0px" });
      steps.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- Topology SVG: pause SMIL packets for reduced motion ---------- */
  if (reduce) {
    document.querySelectorAll("svg").forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });
  }

  /* ---------- Contact form ---------- */
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    var params = new URLSearchParams(window.location.search);
    var preset = params.get("topic");
    if (preset) {
      var radio = form.querySelector('input[name="topic"][value="' + preset.replace(/[^a-z-]/gi, "") + '"]');
      if (radio) radio.checked = true;
    }
    var validators = {
      name: function (v) { return v.trim() ? "" : "Please enter your name."; },
      email: function (v) {
        if (!v.trim()) return "Please enter your email address.";
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "That email address doesn't look right — check for typos.";
      },
      message: function (v) { return v.trim().length >= 10 ? "" : "Tell us a little more (at least 10 characters)."; },
    };
    var check = function (input) {
      var fn = validators[input.name];
      if (!fn) return true;
      var msg = fn(input.value);
      var field = input.closest(".field");
      var err = field.querySelector(".field__error");
      if (msg) { field.setAttribute("data-invalid", ""); input.setAttribute("aria-invalid", "true"); }
      else { field.removeAttribute("data-invalid"); input.removeAttribute("aria-invalid"); }
      err.textContent = msg;
      return !msg;
    };
    Object.keys(validators).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", function () { if (input.value) check(input); });
      input.addEventListener("input", function () { if (input.closest(".field").hasAttribute("data-invalid")) check(input); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      Object.keys(validators).forEach(function (name) {
        var input = form.elements[name];
        if (input && !check(input) && !firstBad) firstBad = input;
      });
      if (firstBad) { firstBad.focus(); return; }
      var btn = form.querySelector('[type="submit"]');
      btn.setAttribute("aria-busy", "true");
      btn.querySelector(".btn__label").textContent = "Sending…";
      // TODO: connect to a form backend (Formspree, Netlify Forms, or your CRM).
      // Until then, the message is not sent anywhere — we only show the confirmation state.
      setTimeout(function () {
        form.hidden = true;
        var ok = document.querySelector(".form-success");
        ok.classList.add("is-shown");
        ok.setAttribute("tabindex", "-1");
        ok.focus();
      }, 700);
    });
  }

  /* ======================================================================
     GSAP motion
     ====================================================================== */
  if (!hasGsap || reduce) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false }); // some animations only exist in some sections
  gsap.defaults({ ease: "power3.out" });

  /* Hero intro */
  var masks = document.querySelectorAll(".hero .line-mask > span");
  var intro = gsap.timeline({ delay: 0.15 });
  intro
    .to(document.querySelectorAll(".hero [data-intro='1']"), { opacity: 1, duration: 0.9 }, 0)
    .to(masks, { y: 0, duration: 1.25, stagger: 0.09, ease: "expo.out" }, 0.1)
    .fromTo(document.querySelectorAll(".hero [data-intro='2']"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.55)
    .fromTo(document.querySelectorAll(".hero [data-intro='3']"), { opacity: 0 }, { opacity: 1, duration: 1 }, 0.9);

  /* Reveal on scroll, batched for staggering */
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, overwrite: true });
    },
  });

  /* Safety net: if the page opens part-way down (refresh, back button, anchor link)
     or the visitor scrolls fast, anything already above the fold must still appear.
     Without this, content above the landing point stayed invisible on scrolling up. */
  var sweepQueued = false;
  function sweepPassed() {
    sweepQueued = false;
    var limit = window.innerHeight * 0.98;
    ScrollTrigger.getAll().forEach(function (st) {
      var anim = st.animation;
      if (!anim || st.vars.scrub || anim.progress() > 0) return;
      var trig = st.trigger;
      if (trig && trig.getBoundingClientRect().top < limit) anim.play();
    });
    var hidden = [];
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      if (el.getBoundingClientRect().top < limit && parseFloat(getComputedStyle(el).opacity) < 0.05) hidden.push(el);
    });
    if (hidden.length) gsap.to(hidden, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, overwrite: true });
  }
  window.addEventListener("scroll", function () {
    if (!sweepQueued) { sweepQueued = true; setTimeout(sweepPassed, 120); }
  }, { passive: true });
  window.addEventListener("load", function () { setTimeout(sweepPassed, 300); });
  setTimeout(sweepPassed, 900);

  /* Bars that grow (spectrum, phase tracks) */
  gsap.utils.toArray(".band__bar i, .phase__track i").forEach(function (bar) {
    var target = getComputedStyle(bar).getPropertyValue(bar.closest(".band") ? "--w" : "--fill").trim() || "1";
    gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: parseFloat(target), duration: 1.4, ease: "expo.out",
      scrollTrigger: { trigger: bar, start: "top 92%", once: true },
    });
  });

  /* Draw-on lines for SVG diagrams */
  gsap.utils.toArray("[data-draw]").forEach(function (path) {
    if (!path.getTotalLength) return;
    var len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut",
      scrollTrigger: { trigger: path.ownerSVGElement || path, start: "top 85%", once: true },
      onComplete: function () { path.style.strokeDasharray = ""; path.style.strokeDashoffset = ""; },
    });
  });

  /* Statement: words brighten as you scroll through */
  var statement = document.querySelector("[data-scrub-words]");
  if (statement) {
    var html = statement.innerHTML;
    // wrap words in spans while keeping <em> tags intact
    statement.innerHTML = html.replace(/(<[^>]+>)|([^\s<]+)/g, function (m, tag, word) {
      return tag ? tag : '<span class="w">' + word + "</span>";
    });
    gsap.fromTo(statement.querySelectorAll(".w"), { opacity: 0.18 }, {
      opacity: 1, stagger: 0.08, ease: "none",
      scrollTrigger: { trigger: statement, start: "top 80%", end: "bottom 45%", scrub: true },
    });
  }

  /* Astrolabe scroll rotation (About page) */
  var astro = document.querySelector(".astrolabe .rotor--3");
  if (astro) {
    gsap.to(astro, { rotation: 90, svgOrigin: "200 200", ease: "none", scrollTrigger: { trigger: astro.ownerSVGElement, start: "top bottom", end: "bottom top", scrub: true } });
  }

  /* ---------- v6 animations ---------- */

  /* Section titles: slide up out of a mask */
  gsap.utils.toArray(".sec-title").forEach(function (el) {
    var inner = document.createElement("span");
    inner.className = "t-in";
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    gsap.from(inner, {
      yPercent: 105, duration: 1.2, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  /* Lead paragraphs: soft rise (page-head leads already animate in CSS) */
  gsap.utils.toArray(".sec .sec-lead").forEach(function (el) {
    gsap.from(el, { opacity: 0, y: 18, duration: 1, delay: 0.12, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  /* Services: dashed path draws with scroll, icons rise in sequence */
  gsap.utils.toArray("[data-draw-scrub]").forEach(function (path) {
    var len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger: path.closest(".svc-path") || path, start: "top 75%", end: "bottom 70%", scrub: 0.8 },
    });
  });
  var svcNodes = gsap.utils.toArray(".svc-node");
  if (svcNodes.length) {
    gsap.from(svcNodes.map(function (n) { return n.querySelector(".svc-node__icon"); }), {
      scale: 0.6, opacity: 0, duration: 0.9, ease: "back.out(1.6)", stagger: 0.14,
      scrollTrigger: { trigger: ".svc-nodes", start: "top 80%", once: true },
    });
    gsap.from(svcNodes.map(function (n) { return [n.querySelector(".svc-node__title"), n.querySelector("p")]; }).flat(), {
      opacity: 0, y: 14, duration: 0.8, stagger: 0.07, delay: 0.2,
      scrollTrigger: { trigger: ".svc-nodes", start: "top 80%", once: true },
    });
  }

  /* Network: steps cascade along a line that draws across */
  var steps = document.querySelector(".steps");
  if (steps) {
    var tl = gsap.timeline({ scrollTrigger: { trigger: steps, start: "top 82%", once: true } });
    tl.fromTo(steps.querySelector(".steps__line"), { "--p": 0 }, { "--p": 1, duration: 1.6, ease: "power2.inOut" }, 0)
      .from(steps.querySelectorAll(".step__icon"), { scale: 0.5, opacity: 0, duration: 0.8, ease: "back.out(1.7)", stagger: 0.22 }, 0.1)
      .from(steps.querySelectorAll(".step__n, .step__title, .step p"), { opacity: 0, y: 12, duration: 0.7, stagger: 0.06 }, 0.3);
  }

  /* Ground map: pins pop in, launch-wave sites first */
  var map = document.querySelector(".map__svg");
  if (map) {
    var pins = gsap.utils.toArray(map.querySelectorAll(".pin--early")).concat(gsap.utils.toArray(map.querySelectorAll(".pin--later")));
    gsap.from(pins, {
      scale: 0, opacity: 0, transformOrigin: "50% 50%", duration: 0.6, ease: "back.out(2.2)", stagger: 0.06,
      scrollTrigger: { trigger: map, start: "top 80%", once: true },
    });
    gsap.from(map.querySelector(".map__land"), { opacity: 0, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: map, start: "top 85%", once: true } });
  }

  /* Founders: photos ease in with a gentle scale */
  gsap.utils.toArray(".founder__photo").forEach(function (ph, i) {
    gsap.from(ph, { scale: 0.85, opacity: 0, duration: 1.1, delay: i * 0.12, ease: "expo.out", scrollTrigger: { trigger: ph, start: "top 88%", once: true } });
  });

  /* ---------- v8: pitch-deck graphics ---------- */

  /* Stats count up once when they scroll into view */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "";
    var plain = el.hasAttribute("data-plain");
    var start = plain ? Math.max(0, target - 25) : 0; // years tick up from just below
    var obj = { v: start };
    var fmt = function (v) { v = Math.round(v); return pre + (plain ? String(v) : v.toLocaleString("en-US")) + suf; };
    el.textContent = fmt(start);
    gsap.to(obj, {
      v: target, duration: plain ? 1.4 : 2, ease: "power2.out",
      onUpdate: function () { el.textContent = fmt(obj.v); },
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  /* Spectrum: bands rise in low-to-high, E-band last with a lift */
  var spec = document.querySelector(".spec");
  if (spec) {
    var bands = spec.querySelectorAll(".spec__band");
    gsap.timeline({ scrollTrigger: { trigger: spec, start: "top 85%", once: true } })
      .from(bands, { opacity: 0, duration: 0.6, stagger: 0.07, clearProps: "transform,opacity" })
      .fromTo(spec.querySelector(".spec__band--e"), { scale: 1 }, { scale: 1.06, duration: 0.5, yoyo: true, repeat: 1, ease: "power2.inOut" }, "-=0.1");
  }

  /* Roadmap: chevrons slide in left to right */
  var rm = gsap.utils.toArray(".rm__item");
  if (rm.length) {
    gsap.from(rm, { opacity: 0, x: -28, duration: 0.8, stagger: 0.14, ease: "expo.out",
      scrollTrigger: { trigger: ".rm", start: "top 85%", once: true } });
  }

  /* Flywheel: labels fade in around the ring */
  var fly = gsap.utils.toArray(".fly__lbl");
  if (fly.length) {
    gsap.from(fly, { opacity: 0, duration: 0.6, stagger: 0.18, scrollTrigger: { trigger: ".fly", start: "top 80%", once: true } });
  }

  /* Home: the montage eases in slightly as the hero scrolls away (no pinning, nothing covered) */
  var montage = document.querySelector("[data-montage]");
  if (montage) {
    /* scroll-linked zoom removed: re-scaling a playing 2K video on every scroll frame caused jank */
  }

  /* Home: Today vs Almagest rows light up one by one */
  var versus = document.querySelector("[data-versus]");
  if (versus) {
    var rows = gsap.utils.toArray(versus.querySelectorAll(".versus__row"));
    ScrollTrigger.create({ trigger: versus, start: "top 78%", once: true, onEnter: function () {
      rows.forEach(function (r, i) { setTimeout(function () { r.classList.add("is-lit"); }, 250 + i * 380); });
    } });
  }

  /* Home: "A New Lane" section — line draws, cards rise in sequence */
  var lane = document.querySelector(".lane");
  if (lane) ScrollTrigger.create({ trigger: lane, start: "top 75%", once: true, onEnter: function () { lane.classList.add("is-in"); } });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
