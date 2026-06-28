/* ============================================================================
   CTTX CRUISER — Lead Capture Add-on  (cttx-capture.js)
   ----------------------------------------------------------------------------
   Drop-in lead capture for the CRUISER speed test. No build step, no deps.

   WHAT IT DOES
   - After a speed test completes, shows a branded "Free Connectivity
     Assessment" form.
   - Auto-opens for poor lines (upload < 2 Mbps OR download < 10 Mbps) — your
     hottest leads. Soft "request assessment" button for good lines.
   - POSTs name + contact + the speed numbers to the CTTX funnel webhook.

   HOW TO INSTALL (2 steps)
   1) Add this file to the repo and load it ONCE at the end of index.html,
      AFTER app.js:
         <script src="/cttx-capture.js"></script>
   2) At the very end of your runTest() success path in app.js — right after
      the line `testRunning = false;` — add ONE line:
         window.CTTX_onTestComplete && window.CTTX_onTestComplete(lastResults);

   That's it. Everything else (styles, modal, validation, POST) is self-contained.

   CONFIG: set FUNNEL_URL to your deployed funnel domain once it's published.
   ============================================================================ */
(function () {
  "use strict";

  // 🔧 Set this to your published funnel app URL (the Manus .space domain).
  //    Until then it points at a placeholder; the form still works and will
  //    show a friendly message if the endpoint is unreachable.
  var FUNNEL_URL = "https://cruiserfunnel-35nadese.manus.space/api/cruiser/lead";

  // Scoring thresholds — kept in sync with CRUISER's own rural-SA logic.
  var HOT = function (r) { return (r.up < 2) || (r.down < 10); };

  var submitted = false; // don't double-ask in one session

  function injectStyles() {
    if (document.getElementById("cttx-capture-style")) return;
    var css = ""
      + "#cttx-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(5,7,4,.78);backdrop-filter:blur(4px);padding:16px;font-family:'Courier New',ui-monospace,monospace}"
      + "#cttx-modal.show{display:flex}"
      + ".cttx-card{width:100%;max-width:420px;background:#0f130b;border:1px solid rgba(120,180,150,.25);border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#e8f3ea}"
      + ".cttx-card h3{margin:0 0 4px;font-size:19px;letter-spacing:.04em;color:#1dd6a6}"
      + ".cttx-sub{margin:0 0 16px;font-size:12px;line-height:1.5;color:#9fb3a4}"
      + ".cttx-strip{display:flex;gap:6px;margin:0 0 16px}"
      + ".cttx-chip{flex:1;text-align:center;border:1px solid rgba(120,180,150,.2);border-radius:8px;padding:6px 2px;background:rgba(255,255,255,.02)}"
      + ".cttx-chip b{display:block;font-size:14px;color:#fff}"
      + ".cttx-chip.bad b{color:#ff6b5e}.cttx-chip.bad{border-color:rgba(255,107,94,.5);background:rgba(255,107,94,.08)}"
      + ".cttx-chip span{font-size:9px;color:#8aa090;letter-spacing:.05em}"
      + ".cttx-field{margin-bottom:10px}"
      + ".cttx-field input{width:100%;box-sizing:border-box;background:#0a0d07;border:1px solid rgba(120,180,150,.25);border-radius:8px;padding:11px 12px;color:#e8f3ea;font-size:14px;font-family:inherit}"
      + ".cttx-field input:focus{outline:none;border-color:#1dd6a6}"
      + ".cttx-err{color:#ff6b5e;font-size:11px;margin:2px 0 0;min-height:13px}"
      + ".cttx-btn{width:100%;background:#1dd6a6;color:#06251c;border:none;border-radius:8px;padding:13px;font-size:15px;font-weight:bold;letter-spacing:.04em;cursor:pointer;font-family:inherit;transition:transform .15s cubic-bezier(.23,1,.32,1),opacity .15s}"
      + ".cttx-btn:active{transform:scale(.97)}.cttx-btn:disabled{opacity:.6;cursor:wait}"
      + ".cttx-close{background:none;border:none;color:#7d9486;font-size:12px;width:100%;margin-top:10px;cursor:pointer;font-family:inherit}"
      + ".cttx-ok{text-align:center;padding:8px 0}.cttx-ok .tick{font-size:40px;color:#1dd6a6}"
      + ".cttx-launch{display:block;width:100%;margin-top:14px;background:transparent;border:1px solid #1dd6a6;color:#1dd6a6;border-radius:8px;padding:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:'Courier New',monospace;letter-spacing:.03em;transition:transform .15s}"
      + ".cttx-launch:active{transform:scale(.97)}";
    var s = document.createElement("style");
    s.id = "cttx-capture-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildModal() {
    if (document.getElementById("cttx-modal")) return;
    var m = document.createElement("div");
    m.id = "cttx-modal";
    m.innerHTML =
      '<div class="cttx-card" role="dialog" aria-modal="true">' +
        '<div id="cttx-body">' +
          '<h3>Free Connectivity Assessment</h3>' +
          '<p class="cttx-sub" id="cttx-sub">CTTX builds carrier-grade private lines for farms, reserves & estates. Leave your details and we\'ll show you what your site can really run.</p>' +
          '<div class="cttx-strip" id="cttx-strip"></div>' +
          '<div class="cttx-field"><input id="cttx-name" type="text" placeholder="Your name" autocomplete="name"><p class="cttx-err" id="cttx-name-err"></p></div>' +
          '<div class="cttx-field"><input id="cttx-phone" type="tel" placeholder="Phone / WhatsApp" autocomplete="tel"><p class="cttx-err" id="cttx-phone-err"></p></div>' +
          '<div class="cttx-field"><input id="cttx-email" type="email" placeholder="Email (optional)" autocomplete="email"><p class="cttx-err"></p></div>' +
          '<div class="cttx-field"><input id="cttx-loc" type="text" placeholder="Farm / site name & town"><p class="cttx-err"></p></div>' +
          '<button class="cttx-btn" id="cttx-submit">Request my assessment</button>' +
          '<button class="cttx-close" id="cttx-close">No thanks, just testing</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);

    document.getElementById("cttx-close").addEventListener("click", hide);
    document.getElementById("cttx-submit").addEventListener("click", submit);
    m.addEventListener("click", function (e) { if (e.target === m) hide(); });
  }

  var current = null;

  function fillStrip(r) {
    var strip = document.getElementById("cttx-strip");
    function chip(lbl, val, unit, bad) {
      return '<div class="cttx-chip' + (bad ? ' bad' : '') + '"><b>' + val + '</b><span>' + lbl + ' ' + unit + '</span></div>';
    }
    strip.innerHTML =
      chip("DOWN", (r.down || 0).toFixed(1), "Mbps", r.down < 10) +
      chip("UP", (r.up || 0).toFixed(1), "Mbps", r.up < 2) +
      chip("PING", r.ping || 0, "ms", false);
  }

  function show(r, isHot) {
    injectStyles();
    buildModal();
    current = r;
    fillStrip(r);
    var sub = document.getElementById("cttx-sub");
    if (isHot) {
      sub.innerHTML = "Your line is under-performing for a working site — cameras, cloud backups and calls will struggle. CTTX can fix this. Leave your details and we'll be in touch.";
    }
    document.getElementById("cttx-modal").classList.add("show");
    setTimeout(function () { var n = document.getElementById("cttx-name"); if (n) n.focus(); }, 50);
  }

  function hide() {
    var m = document.getElementById("cttx-modal");
    if (m) m.classList.remove("show");
  }

  function setErr(id, msg) { var e = document.getElementById(id); if (e) e.textContent = msg || ""; }

  function submit() {
    var name = (document.getElementById("cttx-name").value || "").trim();
    var phone = (document.getElementById("cttx-phone").value || "").trim();
    var email = (document.getElementById("cttx-email").value || "").trim();
    var loc = (document.getElementById("cttx-loc").value || "").trim();

    setErr("cttx-name-err"); setErr("cttx-phone-err");
    if (name.length < 2) { setErr("cttx-name-err", "Please enter your name"); return; }
    if (phone.replace(/\D/g, "").length < 7 && email.length < 4) {
      setErr("cttx-phone-err", "Add a phone or email so we can reach you"); return;
    }

    var btn = document.getElementById("cttx-submit");
    btn.disabled = true; btn.textContent = "Sending…";

    var r = current || {};
    var payload = {
      name: name, phone: phone, email: email, location: loc,
      download: +(r.down || 0), upload: +(r.up || 0),
      ping: +(r.ping || 0), jitter: +(r.jitter || 0),
      connType: r.connType || "unknown", source: "cruiser"
    };

    fetch(FUNNEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () { onDone(); })
      .catch(function () { onDone(); }); // fail soft — never block the user
  }

  function onDone() {
    submitted = true;
    var body = document.getElementById("cttx-body");
    if (body) {
      body.innerHTML =
        '<div class="cttx-ok"><div class="tick">✓</div>' +
        '<h3>Sorted — thank you.</h3>' +
        '<p class="cttx-sub">CTTX has your details and your speed results. We\'ll be in touch shortly about a connectivity assessment for your site.</p>' +
        '<button class="cttx-close" id="cttx-close2">Close</button></div>';
      document.getElementById("cttx-close2").addEventListener("click", hide);
    }
  }

  // Public hook called from app.js after each completed test.
  window.CTTX_onTestComplete = function (results) {
    if (submitted) return;
    var r = results || window.lastResults || {};
    if (HOT(r)) {
      // Hot lead — auto-open the form after the result animation settles.
      setTimeout(function () { show(r, true); }, 1400);
    } else {
      // Good line — add a soft "request assessment" button under the results.
      addSoftButton(r);
    }
  };

  function addSoftButton(r) {
    var panel = document.getElementById("resultsPanel");
    if (!panel || document.getElementById("cttx-launch")) return;
    var b = document.createElement("button");
    b.id = "cttx-launch";
    b.className = "cttx-launch";
    b.textContent = "Get a free CTTX connectivity assessment →";
    b.addEventListener("click", function () { injectStyles(); buildModal(); show(r, false); });
    panel.appendChild(b);
  }
})();
