/* ==========================================================================
   "Want to know more?" inquiry form
   Submits to Netlify Forms (the form is detected at deploy time from the
   data-netlify attribute; no keys or credentials live in this file).
   Email delivery to raghu@ and peter@ is configured in the Netlify dashboard:
   Site > Forms > Form notifications > Email notification (add both addresses).
   Anywhere else (e.g. local preview) the POST fails and the visitor is shown
   the email addresses instead. It never claims success unless the server
   accepted the submission.
   ========================================================================== */
(function () {
  "use strict";
  var form = document.querySelector("form[data-inquiry-form]");
  if (!form) return;

  var status = form.querySelector(".inquiry__status");
  var button = form.querySelector('button[type="submit"]');
  var label = button.querySelector(".btn__label") || button;
  var labelText = label.textContent;
  var FALLBACK = 'Email us directly at <a href="mailto:raghu@almagestspace.com">raghu@almagestspace.com</a> or <a href="mailto:peter@almagestspace.com">peter@almagestspace.com</a>.';

  // Optional ?subject= prefill (used by the Program Partners call to action)
  var preset = new URLSearchParams(window.location.search).get("subject");
  if (preset && form.elements.subject) form.elements.subject.value = preset.slice(0, 120);

  // Links like <a href="#inquiry" data-prefill-subject="..."> fill the subject before jumping to the form
  document.querySelectorAll("[data-prefill-subject]").forEach(function (a) {
    a.addEventListener("click", function () {
      if (form.elements.subject) form.elements.subject.value = a.getAttribute("data-prefill-subject");
      setTimeout(function () { var f = form.elements.name || form.elements.first_name; if (f) f.focus({ preventScroll: true }); }, 600);
    });
  });

  var rules = {
    name: function (v) { return v.trim() ? "" : "Please enter your name."; },
    first_name: function (v) { return v.trim() ? "" : "Please enter your first name."; },
    last_name: function (v) { return v.trim() ? "" : "Please enter your last name."; },
    organization: function (v) { return v.trim() ? "" : "Please enter your organization."; },
    email: function (v) {
      if (!v.trim()) return "Please enter your email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "That email address doesn't look right. Check for typos.";
    },
  };
  function check(input) {
    var fn = rules[input.name]; if (!fn) return true;
    // optional fields (no "required" attribute): empty is fine, but a typed email must still look valid
    var msg = (!input.required && !input.value.trim()) ? "" : fn(input.value), field = input.closest(".field"), err = field.querySelector(".field__error");
    if (msg) { field.setAttribute("data-invalid", ""); input.setAttribute("aria-invalid", "true"); }
    else { field.removeAttribute("data-invalid"); input.removeAttribute("aria-invalid"); }
    err.textContent = msg; return !msg;
  }
  Object.keys(rules).forEach(function (n) {
    var el = form.elements[n]; if (!el) return;
    el.addEventListener("blur", function () { if (el.value) check(el); });
    el.addEventListener("input", function () { if (el.closest(".field").hasAttribute("data-invalid")) check(el); });
  });

  function setStatus(kind, html) {
    status.className = "inquiry__status is-" + kind;
    status.innerHTML = html;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var bad = null;
    Object.keys(rules).forEach(function (n) { var el = form.elements[n]; if (el && !check(el) && !bad) bad = el; });
    if (bad) { bad.focus(); return; }

    var body = new URLSearchParams(new FormData(form)).toString();
    button.setAttribute("aria-busy", "true"); button.disabled = true; label.textContent = "Sending…";
    setStatus("pending", "");
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        setStatus("ok", "<b>Thank you.</b> The Almagest team will be in touch at the email address you provided.");
      })
      .catch(function () {
        setStatus("error", "<b>Your message couldn't be sent right now.</b> " + FALLBACK);
      })
      .then(function () {
        button.removeAttribute("aria-busy"); button.disabled = false; label.textContent = labelText;
        status.focus();
      });
  });
})();
