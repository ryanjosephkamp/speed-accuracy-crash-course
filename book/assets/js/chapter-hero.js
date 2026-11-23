// The chapter hero's proof: the chapter's outputs (images or lines of text) or a live miniature, one step after
// another, held a little longer on the last. It runs only while a third of it (or a third of the screen) is in view and
// the page is visible, never when the reader asks for less motion (the step the page printed stays), and its play
// button and steps let the reader stop it or pick a step. The latest request wins: an image still loading when the
// reader pauses or picks another is not shown, and an image that fails to load is never shown.
//
// Mounts itself on every figure.proof once the page has loaded. A live miniature registers its drawing first:
//   ChapterHero.live(figure, { steps: 6, draw(i) { ... }, label(i) { return "..." }, hold(i) { return ms } })
// and the page prints the still step (data-still) in its markup, so the hero reads without the script.
(function () {
  "use strict";
  var HOLD = 2600, HOLD_LAST = 4200;
  var lives = new WeakMap();

  function mount(fig) {
    if (fig.chapterHero) return fig.chapterHero;
    var live = fig.dataset.kind === "live" ? lives.get(fig) : null;
    if (fig.dataset.kind === "live" && !live) return null;   // its drawing registers it later
    var items = Array.prototype.slice.call(fig.querySelectorAll(".proof-item"));
    var count = live ? live.steps : items.length;
    var controls = fig.querySelector(".proof-controls");
    if (count < 2 || !controls) return null;
    var label = fig.querySelector(".proof-label"), play = controls.querySelector(".proof-play");
    var stepsBox = controls.querySelector(".proof-steps");
    // a live miniature's steps are drawn here, one per state, named by its labels
    if (live && stepsBox && !stepsBox.children.length) {
      for (var n = 0; n < count; n++) {
        var b = document.createElement("button");
        b.type = "button"; b.setAttribute("aria-label", "Show " + (live.label ? live.label(n) : "step " + (n + 1)));
        stepsBox.appendChild(b);
      }
    }
    var steps = Array.prototype.slice.call(controls.querySelectorAll(".proof-steps button"));
    var calm = matchMedia("(prefers-reduced-motion: reduce)");
    var still = Math.max(0, Math.min(count - 1, parseInt(fig.dataset.still || "0", 10) || 0));
    var i = live ? still : Math.max(0, items.findIndex(function (el) { return el.classList.contains("is-shown"); }));
    // i is the step on show; at is where autoplay has got to (past any image that failed to load). ask numbers each
    // request to show a step, so only the latest is shown; run numbers each autoplay run, so a run that was paused,
    // went off screen, or was hidden neither shows its step nor schedules another
    var playing = !calm.matches, seen = false, timer = null, ask = 0, run = 0, at = i;
    controls.hidden = false;
    var load = function (el) {
      if (!el || el.tagName !== "IMG") return Promise.resolve(true);
      if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute("data-src"); }
      if (!el.decode) return Promise.resolve(true);
      return el.decode().then(function () { return true; }, function () { return false; });
    };
    var fetchAll = function () { items.forEach(function (el) { if (el.dataset.src) load(el); }); };
    var mark = function () {
      play.classList.toggle("is-paused", !playing);
      play.setAttribute("aria-label", playing ? "Pause the proof" : "Play the proof");
      steps.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
    };
    var show = function (k, inRun) {
      var mineAsk = ++ask;
      return (live ? Promise.resolve(true) : load(items[k])).then(function (ok) {
        if (!ok || mineAsk !== ask || (inRun !== undefined && inRun !== run)) return false;
        if (live) {
          live.draw(k);
          if (label) label.textContent = live.label ? live.label(k) : "";
        } else {
          items[i].classList.remove("is-shown"); items[i].setAttribute("aria-hidden", "true");
          items[k].classList.add("is-shown"); items[k].removeAttribute("aria-hidden");
          if (label) label.textContent = items[k].dataset.label || "";
        }
        i = k;
        fig.dataset.step = String(i);
        mark();
        return true;
      });
    };
    var hold = function (k) { return live && live.hold ? live.hold(k) : k === count - 1 ? HOLD_LAST : HOLD; };
    var going = function () { return playing && seen && !document.hidden; };
    var next = function (r) {
      timer = setTimeout(function () {
        if (r !== run || !going()) return;
        at = (at + 1) % count;
        show(at, r).then(function () { if (r === run && going()) next(r); });
      }, hold(at));
    };
    // start a new run when the proof can play, and end the old one
    var restart = function () { run++; clearTimeout(timer); timer = null; if (going()) next(run); };
    var stop = function () { playing = false; run++; clearTimeout(timer); timer = null; mark(); };
    play.addEventListener("click", function () {
      if (playing) { stop(); return; }
      playing = true; mark(); fetchAll();
      run++; clearTimeout(timer);
      var r = run;
      at = (i + 1) % count;
      show(at, r).then(function () { if (r === run && going()) next(r); });
    });
    steps.forEach(function (b, j) { b.addEventListener("click", function () { stop(); at = j; show(j); }); });
    document.addEventListener("visibilitychange", restart);
    var prefer = function () { if (calm.matches) { stop(); show(still); } };
    if (calm.addEventListener) calm.addEventListener("change", prefer); else if (calm.addListener) calm.addListener(prefer);
    if ("IntersectionObserver" in window) {
      var th = [];
      for (var t = 0; t <= 20; t++) th.push(t / 20);
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1];
        var need = Math.min(e.boundingClientRect.height, innerHeight) / 3;
        var now = e.isIntersecting && e.intersectionRect.height >= need;
        if (now === seen) return;
        seen = now;
        if (seen && playing) fetchAll();
        restart();
      }, { threshold: th }).observe(fig);
    } else { seen = true; restart(); }
    if (live) show(i);
    mark();
    fig.chapterHero = { show: show, stop: stop, state: function () { return { step: i, playing: playing, seen: seen }; } };
    return fig.chapterHero;
  }

  function all() { document.querySelectorAll("figure.proof").forEach(mount); }
  window.ChapterHero = {
    mount: mount,
    live: function (fig, spec) { lives.set(fig, spec); delete fig.chapterHero; return mount(fig); },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", all); else all();
})();
