// The figure pop-out: a tap or click on a figure's print lifts it into a full-screen viewer. Pinch, scroll, drag, the
// zoom buttons, or the keyboard (+, -, 0, arrows) zoom and pan, from fitting the screen to six times that; the print
// never opens smaller than it sits on the page, and at least 48 px of the picture stays in view at any zoom. Escape,
// the close button, or a click on the backdrop (at fit) puts it back and returns focus to the print. Focus stays in
// the viewer; a caption too long for its space is a keyboard stop of its own and scrolls with its own keys.
//
// Mounts itself on every figure.plate > button.lift once the page has loaded, creating the viewer if the page has
// none. FigurePopOut.mount(root) mounts the figures under root (a page that adds figures later calls it again);
// FigurePopOut.open(figure) lifts one.
(function () {
  "use strict";
  var MAX = 6, KEEP = 48, STEP = 60;
  var box, sheet, img, title, foot, close, stage, tools, opener = null;
  var s = 1, x = 0, y = 0, pts = new Map(), last = null;

  function viewer() {
    box = document.querySelector(".lifted");
    if (!box) {
      box = document.createElement("div");
      box.className = "lifted"; box.hidden = true;
      box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Figure");
      box.setAttribute("aria-describedby", "lift-keys");
      box.innerHTML = '<p class="vh" id="lift-keys">Plus and minus zoom in and out, the arrow keys look across the figure, 0 fits it to the screen, and Escape puts it back.</p>' +
        '<div class="bar"><span class="title"></span><span class="tools"><button class="zoom-out" type="button" aria-label="Zoom out">−</button>' +
        '<button class="zoom-in" type="button" aria-label="Zoom in">+</button><button class="close" type="button" aria-label="Put the figure back">✕</button></span></div>' +
        '<div class="stage"><div class="sheet"><img alt="" draggable="false"></div></div><p class="lift-cap"></p>';
      document.body.appendChild(box);
    }
    sheet = box.querySelector(".sheet"); img = sheet.querySelector("img"); title = box.querySelector(".title");
    foot = box.querySelector(".lift-cap"); close = box.querySelector(".close"); stage = box.querySelector(".stage");
    tools = Array.prototype.slice.call(box.querySelectorAll(".bar button"));
    wire();
  }

  function apply() { sheet.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")"; }
  // the picture never leaves the stage: at least 48 px of the image itself (not its mount) stays in view
  function set() {
    apply();
    if (box.hidden) return;
    var r = img.getBoundingClientRect(), st = stage.getBoundingClientRect(), dx = 0, dy = 0;
    if (r.right < st.left + KEEP) dx = st.left + KEEP - r.right; else if (r.left > st.right - KEEP) dx = st.right - KEEP - r.left;
    if (r.bottom < st.top + KEEP) dy = st.top + KEEP - r.bottom; else if (r.top > st.bottom - KEEP) dy = st.bottom - KEEP - r.top;
    if (dx || dy) { x += dx; y += dy; apply(); }
  }
  function reset() { s = 1; x = 0; y = 0; set(); }
  // at scale 1 the print fits the stage that is actually there (between the bar and the caption)
  function fitStage() {
    var cs = getComputedStyle(sheet), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    img.style.maxHeight = Math.max(80, stage.clientHeight - pad - 16) + "px";
  }
  function captionStop() { if (foot.scrollHeight > foot.clientHeight + 1) foot.tabIndex = 0; else foot.removeAttribute("tabindex"); }
  function stops() { return foot.hasAttribute("tabindex") ? tools.concat([foot]) : tools; }
  // zoom by k about a point (the stage's center by default), between fitting the screen and six times that
  function zoom(k, cx, cy) {
    if (cx == null) { var st = stage.getBoundingClientRect(); cx = st.left + st.width / 2; cy = st.top + st.height / 2; }
    var r = sheet.getBoundingClientRect(), ns = Math.min(MAX, Math.max(1, s * k)), f = ns / s;
    x = cx - (cx - r.left) * f - (r.left - x); y = cy - (cy - r.top) * f - (r.top - y); s = ns;
    if (s === 1) { x = 0; y = 0; }
    set();
  }
  // a print never opens smaller than it sits on the page: start at that size, centered, its top in view
  function atPageSize(pageWidth) {
    var iw = img.getBoundingClientRect().width;
    if (!iw || iw >= pageWidth - 1) return;
    s = Math.min(MAX, pageWidth / iw); x = 0; y = 0; set();
    var st = stage.getBoundingClientRect(), r = sheet.getBoundingClientRect();
    x = st.left + st.width / 2 - (r.left + r.width / 2);
    y = r.height > st.height ? st.top + 8 - r.top : st.top + st.height / 2 - (r.top + r.height / 2);
    set();
  }

  // opts (optional) lifts a picture the figure doesn't hold as an image, such as a live plate drawn as SVG:
  // { src, alt, opener, night, title, pageWidth }
  function open(fig, opts) {
    opts = opts || {};
    if (!box) viewer();
    // the print on show: a figure drawn for each theme has two, and the page shows one
    var shown = Array.prototype.filter.call(fig.querySelectorAll("button.lift img"), function (im) { return im.getClientRects().length; });
    var src = shown[0] || fig.querySelector("img");
    if (opts.src) { sheet.classList.toggle("is-night", !!opts.night); img.src = opts.src; img.alt = opts.alt || ""; }
    else { sheet.classList.toggle("is-night", src.classList.contains("fig-night")); img.src = src.currentSrc || src.src; img.alt = src.alt; }
    var label = fig.querySelector("figcaption b"), cap = fig.querySelector("figcaption .cap") || fig.querySelector("figcaption");
    title.textContent = opts.title || (label ? label.textContent : "");
    box.setAttribute("aria-label", (title.textContent || "Figure").replace(/\.$/, ""));
    foot.textContent = cap ? (cap === fig.querySelector("figcaption") && label ? cap.textContent.replace(label.textContent, "").trim() : cap.textContent) : "";
    foot.scrollTop = 0;
    opener = opts.opener || fig.querySelector("button.lift");
    var pageWidth = opts.pageWidth || src.getBoundingClientRect().width;
    box.hidden = false; fitStage(); captionStop(); reset(); close.focus();
    document.documentElement.style.overflow = "hidden";
    var fit = function () { atPageSize(pageWidth); };
    if (img.complete && img.naturalWidth) fit(); else img.addEventListener("load", fit, { once: true });
  }
  function shut() {
    box.hidden = true; document.documentElement.style.overflow = "";
    if (opener) opener.focus();
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    close.addEventListener("click", shut);
    window.addEventListener("resize", function () { if (!box.hidden) { fitStage(); captionStop(); reset(); } });
    box.querySelector(".zoom-in").addEventListener("click", function () { zoom(1.25); });
    box.querySelector(".zoom-out").addEventListener("click", function () { zoom(0.8); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); shut(); return; }
      if (e.key === "Tab") {
        // focus stays in the viewer: its buttons, and its caption when the caption scrolls
        e.preventDefault();
        var all = stops(), i = all.indexOf(document.activeElement);
        all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length].focus();
        return;
      }
      if (document.activeElement === foot && /^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) return;
      if (e.key === "+" || e.key === "=") zoom(1.25);
      else if (e.key === "-" || e.key === "_") zoom(0.8);
      else if (e.key === "0") reset();
      else if (e.key === "ArrowLeft") { x += STEP; set(); }
      else if (e.key === "ArrowRight") { x -= STEP; set(); }
      else if (e.key === "ArrowUp") { y += STEP; set(); }
      else if (e.key === "ArrowDown") { y -= STEP; set(); }
      else return;
      e.preventDefault();
    });
    stage.addEventListener("click", function (e) { if (e.target === e.currentTarget && s === 1) shut(); });
    box.addEventListener("wheel", function (e) {
      if (foot.contains(e.target)) return;  // the caption scrolls itself
      e.preventDefault();
      zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    // one finger or the mouse drags (once zoomed, or when the print is taller than the stage); two fingers pinch
    sheet.addEventListener("pointerdown", function (e) { try { sheet.setPointerCapture(e.pointerId); } catch (x_) {} pts.set(e.pointerId, [e.clientX, e.clientY]); last = null; });
    sheet.addEventListener("pointermove", function (e) {
      if (!pts.has(e.pointerId)) return;
      var prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { if (s > 1 || sheet.getBoundingClientRect().height > stage.clientHeight) { x += e.clientX - prev[0]; y += e.clientY - prev[1]; set(); } return; }
      var p = Array.from(pts.values()), d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      var cx = (p[0][0] + p[1][0]) / 2, cy = (p[0][1] + p[1][1]) / 2;
      if (last) {
        var ns = Math.min(MAX, Math.max(1, s * d / last.d)), f = ns / s, r = sheet.getBoundingClientRect();
        x = cx - (cx - r.left) * f - (r.left - x) + (cx - last.cx); y = cy - (cy - r.top) * f - (r.top - y) + (cy - last.cy); s = ns;
        if (s === 1) { x = 0; y = 0; }
        set();
      }
      last = { d: d, cx: cx, cy: cy };
    });
    var up = function (e) { pts.delete(e.pointerId); last = null; };
    sheet.addEventListener("pointerup", up); sheet.addEventListener("pointercancel", up);
    sheet.addEventListener("dblclick", reset);
  }

  function mount(root) {
    (root || document).querySelectorAll(".plate > button.lift").forEach(function (b) {
      if (b.dataset.liftReady) return;
      b.dataset.liftReady = "1";
      b.addEventListener("click", function () { open(b.closest(".plate")); });
    });
  }
  window.FigurePopOut = { mount: mount, open: open, state: function () { return { open: box ? !box.hidden : false, scale: s, x: x, y: y }; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mount(); }); else mount();
})();
