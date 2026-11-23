// The page turn's direction. Each page of a book says where it sits: <html data-book="<id>" data-leaf="<n>">, with
// the title page 0 and each part after it in order. The page being left records its book and leaf; the page arriving
// turns forward when it comes later in the book, back when it comes earlier, and skips the turn for a page outside
// the book (another book on the same site, say), a reload, or a page that left more than 5 seconds ago.
// Load it in the <head>, before the first paint, on every page of the book.
// After the decision, <html data-turned> is "forward", "back", or "none" (for styling and tests).
(function () {
  "use strict";
  var root = document.documentElement, KEY = "page-turn-from";
  var here = function () {
    var leaf = root.getAttribute("data-leaf");
    return { book: root.getAttribute("data-book") || "", leaf: leaf === null || leaf === "" ? null : Number(leaf) };
  };
  var leaving = function () {
    var h = here();
    if (h.leaf === null || !isFinite(h.leaf)) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ book: h.book, leaf: h.leaf, at: Date.now() })); } catch (e) {}
  };
  window.addEventListener("pageswap", leaving);
  window.addEventListener("pagehide", leaving);
  window.addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition;
    if (!vt) { root.setAttribute("data-turned", "none"); return; }
    // a skipped transition rejects these promises; nothing is waiting on them
    vt.ready.catch(function () {}); vt.finished.catch(function () {});
    var from = null;
    try { from = JSON.parse(sessionStorage.getItem(KEY) || "null"); sessionStorage.removeItem(KEY); } catch (x) {}
    var to = here();
    var fresh = from && Date.now() - from.at < 5000;
    if (!fresh || from.book !== to.book || to.leaf === null || !isFinite(to.leaf) || from.leaf === to.leaf) {
      vt.skipTransition(); root.setAttribute("data-turned", "none"); return;
    }
    var dir = to.leaf > from.leaf ? "forward" : "back";
    if (vt.types) vt.types.add(dir);
    root.setAttribute("data-turned", dir);
  });
})();
