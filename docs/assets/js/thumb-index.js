// The thumb index: a flag names the tab under the pointer or the keyboard's focus; on a touch screen, a thumb pressed
// on a tab scrubs the strip (press to see a tab's name beside the thumb, slide along the edge to run through the
// tabs, let go to go to the one named, or slide away from the edge first to stay); on a page with section tabs, the
// tab of the section being read is marked as the current location.
//
// Mounts itself on every nav.thumb-index once the page has loaded. ThumbIndex.mount(nav, options) mounts one by hand.
// Options (or data- attributes on the nav): away (px from the strip's right edge that count as sliding away, 120),
// flagTop (the scrub flag's highest top, px, 84, under a running head), lift (how far above the thumb the scrub
// flag sits, px, 56), and readingLine (where a section starts counting as read, as a share of the screen, 1/3).
(function () {
  "use strict";

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

  function mount(nav, options) {
    if (!nav || nav.thumbIndex) return nav && nav.thumbIndex;
    var o = options || {}, ds = nav.dataset;
    var AWAY = num(o.away != null ? o.away : ds.away, 120);
    var FLAG_TOP = num(o.flagTop != null ? o.flagTop : ds.flagTop, 84);
    var LIFT = num(o.lift != null ? o.lift : ds.lift, 56);
    var LINE = num(o.readingLine != null ? o.readingLine : ds.readingLine, 1 / 3);
    var root = document.documentElement;
    var tabs = Array.prototype.slice.call(nav.querySelectorAll("a"));
    var flag = document.createElement("span");
    flag.className = "thumb-flag"; flag.setAttribute("aria-hidden", "true"); flag.hidden = true;
    nav.appendChild(flag);

    // The flag's words: "VIII · Folding" sets the numeral in the part's ink (the night ink on the dark day flag, the
    // day ink on the light night flag), then the name. Rebuilt only when they change.
    var said = null, saidInk = null;
    var say = function (text, a) {
      var ink = "";
      if (a) {
        var dark = getComputedStyle(root).colorScheme === "dark";
        ink = (dark ? a.style.getPropertyValue("--c") : a.style.getPropertyValue("--c-night") || a.style.getPropertyValue("--c")).trim();
      }
      if (text === said && ink === saidInk) return;
      said = text; saidInk = ink;
      var parts = text.split(" · ");
      flag.textContent = "";
      if (ink) flag.style.setProperty("--flag-ink", ink); else flag.style.removeProperty("--flag-ink");
      if (parts.length > 1) {
        var no = document.createElement("span");
        no.className = "flag-no"; no.textContent = parts[0];
        var name = document.createElement("span");
        name.className = "flag-name"; name.textContent = parts.slice(1).join(" · ");
        flag.appendChild(no); flag.appendChild(name);
      } else flag.textContent = text;
    };
    var show = function (a) {
      if (!a || !a.dataset.flag) return;
      var r = a.getBoundingClientRect();
      say(a.dataset.flag, a); flag.hidden = false;
      flag.style.top = (r.top + r.height / 2) + "px";
    };

    // A new keyboard focus wins over a pointer parked on another tab; while neither changes, the pointer's tab wins,
    // then the focused tab's. The pointer can rest on the flag itself. Escape puts the flag away, and it stays away
    // until the pointer or the focus reaches another tab.
    var hovered = null, focused = null, latched = false, scrub = null, quiet = null;
    var update = function () {
      if (scrub) return;
      var a = hovered || focused;
      if (a && !latched) show(a); else flag.hidden = true;
    };
    var hover = function (a) { if (a === hovered) return; hovered = a; if (a) latched = false; update(); };
    nav.addEventListener("mouseover", function (e) { if (flag.contains(e.target)) return; hover(e.target.closest("a")); });
    nav.addEventListener("mouseleave", function () { hover(null); });
    nav.addEventListener("focusin", function (e) { var a = e.target.closest("a"); if (a !== focused) latched = false; focused = a; hovered = null; update(); });
    nav.addEventListener("focusout", function () { focused = null; update(); });

    // A thumb on the strip. Touch laptops count: the strip is a touch strip wherever a finger can reach it.
    var touchy = matchMedia("(any-pointer: coarse)");
    var under = function (y) {
      for (var i = 0; i < tabs.length; i++) if (y < tabs[i].getBoundingClientRect().bottom) return tabs[i];
      return tabs[tabs.length - 1];
    };
    var pick = function (a, y) {
      if (a !== scrub.on) {
        // a tick under the thumb at each new tab, once the page has had a tap (before that the browser refuses it)
        var ready = navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive;
        if (scrub.on) { scrub.on.classList.remove("is-on"); if (ready) { try { navigator.vibrate(3); } catch (x) {} } }
        scrub.on = a; a.classList.add("is-on");
      }
      if (scrub.off) say("Let go to stay here", null); else say(a.dataset.flag || "", a);
      flag.hidden = false;
      flag.style.top = Math.max(FLAG_TOP, Math.min(innerHeight - 40, y - LIFT)) + "px";
    };
    // A tab within this page (a section) always goes, even to the place already in the address; another page's tab
    // goes unless it is this page.
    var go = function (a) {
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) === "#") {
        var t = document.getElementById(decodeURIComponent(href.slice(1)));
        if (location.hash === href && t) t.scrollIntoView(); else location.hash = href;
      } else if (a.getAttribute("aria-current") !== "page") location.href = a.href;
    };
    // The browser may follow a handled gesture with a click on the tab under the finger. That one click is the
    // gesture's, so it is dropped: a click from the same pointer (or, where the browser doesn't say which pointer, any
    // pointer click) within 700 ms of the release. A click from a key or a screen reader (detail 0) is the link's own.
    var end = function (going) {
      if (!scrub) return;
      var a = scrub.on, off = scrub.off, id = scrub.id;
      scrub = null;
      if (a) a.classList.remove("is-on");
      flag.classList.remove("is-scrub", "is-off");
      flag.hidden = true; latched = false;
      quiet = { id: id, until: Date.now() + 700 };
      if (going && a && !off) go(a); else update();
    };
    var mine = function (e) { return scrub && e.pointerId === scrub.id; };
    // a second finger anywhere on the page calls the scrub off, and its own click is dropped too
    window.addEventListener("pointerdown", function (e) {
      if (scrub && e.pointerId !== scrub.id) { e.preventDefault(); end(false); quiet = { id: null, until: Date.now() + 700 }; }
    }, true);
    nav.addEventListener("pointerdown", function (e) {
      if (scrub) return;
      // a finger or a pen on a tab, where a finger can reach the strip; a mouse, or a press elsewhere, is a plain click
      var a = e.target.closest && e.target.closest("a");
      if (!a || e.pointerType === "mouse" || !e.isPrimary || !touchy.matches) return;
      e.preventDefault();
      // capture on the tab, so the rest of the gesture comes here wherever the thumb goes; if the browser refuses,
      // the window's listeners below still see the release
      try { a.setPointerCapture(e.pointerId); } catch (x) {}
      scrub = { id: e.pointerId, on: null, off: false };
      flag.classList.add("is-scrub");
      pick(a, e.clientY);
    });
    var track = function (e) {
      // "away" is measured from the strip's own right edge (a classic scrollbar may sit beyond it)
      var off = e.clientX < nav.getBoundingClientRect().right - AWAY;
      if (off !== scrub.off) { scrub.off = off; flag.classList.toggle("is-off", off); }
      pick(under(e.clientY), e.clientY);
    };
    window.addEventListener("pointermove", function (e) { if (mine(e)) track(e); }, true);
    // the thumb's own release decides: where it lifts, not where it last moved
    window.addEventListener("pointerup", function (e) { if (!mine(e)) return; track(e); end(true); }, true);
    window.addEventListener("pointercancel", function (e) { if (mine(e)) end(false); }, true);
    nav.addEventListener("lostpointercapture", function (e) { if (mine(e)) end(false); });
    window.addEventListener("blur", function () { end(false); });
    window.addEventListener("pagehide", function () { end(false); });
    // Escape cancels a scrub, or puts a hover or focus flag away until another tab
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (scrub) end(false);
      else if (!flag.hidden) { latched = true; flag.hidden = true; }
    });
    // a long press during a scrub doesn't open the link's menu; a mouse's right click still does
    nav.addEventListener("contextmenu", function (e) { if (scrub || (quiet && Date.now() < quiet.until)) e.preventDefault(); });
    nav.addEventListener("click", function (e) {
      if (!quiet || Date.now() > quiet.until || e.detail === 0) return;
      if (quiet.id !== null && typeof e.pointerId === "number" && e.pointerId > 0 && e.pointerId !== quiet.id) return;
      e.preventDefault(); quiet = null;
    }, true);

    // Section tabs (a.sec with data-sec naming a heading's id): the section being read is the last whose heading has
    // passed the reading line (never above 72 px, under a running head), or the last section once the page can scroll
    // no further. Its tab stands out and is announced as the current location.
    var marks = tabs.filter(function (a) { return a.dataset.sec; })
      .map(function (a) { return { a: a, h: document.getElementById(a.dataset.sec) }; })
      .filter(function (m) { return m.h; });
    if (marks.length) {
      var shown = null, queued = false;
      var spy = function () {
        queued = false;
        var line = Math.max(innerHeight * LINE, 72), now = null;
        for (var i = 0; i < marks.length; i++) if (marks[i].h.getBoundingClientRect().top < line) now = marks[i];
        var last = marks[marks.length - 1];
        if (scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2 && last.h.getBoundingClientRect().top < innerHeight) now = last;
        if (now === shown) return;
        if (shown) shown.a.removeAttribute("aria-current");
        if (now) now.a.setAttribute("aria-current", "location");
        shown = now;
      };
      var later = function () { if (!queued) { queued = true; setTimeout(spy, 80); } };
      window.addEventListener("scroll", later, { passive: true });
      window.addEventListener("resize", later);
      window.addEventListener("hashchange", later);
      window.addEventListener("pageshow", later);
      // a demo that loads, or a font that arrives, can move the headings without a scroll
      if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);
      spy();
    }

    nav.thumbIndex = { flag: flag, tabs: tabs, cancel: function () { end(false); } };
    return nav.thumbIndex;
  }

  window.ThumbIndex = { mount: mount };
  var all = function () { document.querySelectorAll("nav.thumb-index").forEach(function (n) { mount(n); }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", all); else all();
})();
