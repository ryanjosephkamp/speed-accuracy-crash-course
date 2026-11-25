// Chapter 0's plates: the reader's schedule (the contents page's plate, mounted here too), a first guess on it, and
// the shortest proof in the paper as a strip. The bounds come from the dynamic program in the worker; the flat-bound
// curves from closed forms in kernel.js. Sentences come from say-ch00.js.
import "./contents.js?v=942da027e0";
import { B } from "./kernel.js?v=942da027e0";
import { boundForCost, toDiscrete, belief } from "./model.js?v=942da027e0";
import { costOf, deadlineOf, labelOf, PRESETS, VIEW, SPARE } from "./schedules-book.js?v=942da027e0";
import { getChoice, solve, onVisible, liftReady, wireStrips } from "./book.js?v=942da027e0";
import { frame, line, axes, svg, fmt, keepDrawn, dropAt } from "./chart.js?v=942da027e0";
import * as S from "./say-ch00.js?v=942da027e0";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const DT = 0.01;

// ---------------------------------------------------------------- the hero: Figure 1's four schedules in turn
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const four = PRESETS.filter((p) => p.group === "Figure 1").map((p) => ({
    p, choice: { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) },
  }));
  const solved = new Array(four.length).fill(null);
  let cur = 0;
  const draw = (i) => {
    cur = i;
    const { p, choice } = four[i];
    const cost = costOf(choice), dl = deadlineOf(choice), view = dl ?? VIEW;
    const ts = range(0, view, 201);
    const cs = ts.map((t) => cost(t));
    const pm = ts.map((t) => (dl !== null && t >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(t)), DT)));
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(240, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const split = Math.round(H * 0.36), l = 12, r = 10;
    const sx = (t) => l + (t / view) * (W - l - r);
    const fin = cs.filter(Number.isFinite), cLo = Math.log(Math.min(...fin) / 1.3), cHi = Math.log(Math.max(...fin, 0.2) * 1.3);
    const syC = (c) => 18 + (1 - (Math.log(c) - cLo) / (cHi - cLo)) * (split - 26);
    const ex = solved[i];
    const top = Math.max(...pm, ...(ex ? ex.exact.filter(Number.isFinite) : [0])) * 1.08 + 0.05;
    const yb0 = split + 18, yb1 = H - 22;
    const syB = (b) => yb0 + (1 - b / top) * (yb1 - yb0);
    const path = (xs, ys, sy) => { let d = "", pen = false; xs.forEach((x, k) => { const v = ys[k]; if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(v).toFixed(1); pen = true; }); return d; };
    let s = `<path class="ax" d="M${l} ${split - 6}H${W - r}M${l} ${yb1}H${W - r}"/>`;
    s += `<path class="cost" d="${path(ts, cs, syC)}"/>`;
    if (dl !== null) s += `<path class="acc" stroke-dasharray="3 3" d="M${sx(dl).toFixed(1)} 14V${yb1}"/>`;
    s += `<text class="lab" x="${l}" y="11">cost of time: ${p.label.toLowerCase()}</text>`;
    const [tp, pmp] = dropAt(ts, pm, dl);
    s += `<path class="pm" d="${path(tp, pmp, syB)}"/>`;
    if (ex) s += `<path class="ex" d="${path(ex.t, ex.exact, syB)}"/>`;
    else s += `<text class="tk" x="${(W / 2).toFixed(0)}" y="${((yb0 + yb1) / 2).toFixed(0)}" text-anchor="middle">solving the best bound…</text>`;
    s += `<text class="lab" x="${l}" y="${yb0 - 4}">the bound: best (ink) and per-moment (dashed)</text>`;
    s += `<text class="tk" x="${sx(0)}" y="${H - 6}" text-anchor="start">0</text><text class="tk" x="${sx(view)}" y="${H - 6}" text-anchor="end">time ${view}</text>`;
    el.innerHTML = s;
  };
  draw(0);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: four.length, draw, label: (i) => S.heroLabel(four[i].p.note.replace(/: Figure 1\(.\)\.$/, "")) });
  onVisible(fig, async () => {
    for (let i = 0; i < four.length; i++) {
      try { solved[i] = await solve({ job: "bounds", choice: four[i].choice }); if (i === cur) draw(cur); } catch (e) { /* the hero keeps the per-moment curve */ }
    }
  }, "200px");
}

// ---------------------------------------------------------------- plate: guess, then look
function guessPlate() {
  const fig = plate("guess"), el = rootOf("guess");
  if (!el) return;
  el.innerHTML = `<div class="chart-wrap" id="gu-cost"></div><div class="chart-wrap pad is-draw" id="gu-bound"></div>
    <div class="controls" style="margin-top:10px"><div class="actions"><button class="btn btn-go" type="button" id="gu-show">Show me</button><button class="btn" type="button" id="gu-again">Guess again</button></div></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment rule</span></li><li><span class="key key-ex">Best bound</span></li><li><span class="key key-cost">Your guess</span></li></ul>
    <dl class="reads" id="gu-reads"></dl><p class="say" id="gu-say" aria-live="polite"></p>`;
  const costEl = $("#gu-cost", el), boundEl = $("#gu-bound", el), reads = $("#gu-reads", el), say = $("#gu-say", el);
  let choice, cost, dl, view, tStar, pmT, pm, ts, yTop, guess = null, shown = false, result = null, waiting = false;
  const reset = () => {
    choice = getChoice(); cost = costOf(choice); dl = deadlineOf(choice); view = dl ?? VIEW;
    const pmAt = (t) => (dl !== null && t >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(t)), DT));
    tStar = S.guessTime(pmAt, view, dl);
    ts = range(0, view, 251);
    pm = ts.map(pmAt);
    pmT = toDiscrete(boundForCost(cost(tStar)), DT);
    // the best bound never sits above the flat bound for the lowest cost (chapter 4), so this range holds it
    let cMin = Infinity; for (let t = 0; t <= view + SPARE; t += 0.01) cMin = Math.min(cMin, cost(t));
    yTop = Math.max(0.4, toDiscrete(B(cMin), DT) * 1.12);
    guess = null; shown = false; result = null; reads.innerHTML = "";
    say.textContent = `Drag the orange marker to where you think the best bound sits at time ${tStar}, on ${labelOf(choice).toLowerCase()}.`;
    solve({ job: "bounds", choice }, { key: "guess" }).then((m) => { result = m; if (waiting) { waiting = false; reveal(); } }).catch(() => {});
    drawAll();
  };
  const drawCost = () => {
    const cs = ts.map((t) => cost(t)), fin = cs.filter(Number.isFinite);
    const f = frame(costEl, { x: [0, view], y: [Math.min(...fin) / 1.6, Math.max(...fin, 0.2) * 1.6], ylog: true, aspect: 0.22, minH: 90, maxH: 130, b: 22 });
    let s = axes(f, { yl: "cost of time", yt: [] }) + line(f, ts, cs, "cost");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tStar).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    costEl.innerHTML = svg(f, s, `The cost of time for ${labelOf(choice)}`);
  };
  const drawBound = () => {
    const f = frame(boundEl, { x: [0, view], y: [0, yTop], aspect: 0.5, minH: 190, maxH: 280 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    const [tp, pmp] = dropAt(ts, pm, dl);
    s += line(f, tp, pmp, "pm");
    if (shown && result) {
      s += line(f, result.t, result.exact, "ex");
      const bT = bestAt();
      s += `<circle class="ink-dot" cx="${f.sx(tStar).toFixed(1)}" cy="${f.sy(bT).toFixed(1)}" r="4.5"/>`;
    }
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tStar).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    const gy = guess ?? yTop * 0.5;
    s += `<circle class="acc-dot" cx="${f.sx(tStar).toFixed(1)}" cy="${f.sy(gy).toFixed(1)}" r="${guess === null ? 7 : 6}" style="opacity:${guess === null ? 0.55 : 1}"/>`;
    if (guess === null) s += `<text class="tag-acc" x="${(f.sx(tStar) + 11).toFixed(1)}" y="${(f.sy(gy) + 4).toFixed(1)}">drag me</text>`;
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    boundEl.innerHTML = svg(f, s, shown ? "Your guess beside the best bound and the per-moment rule's bound" : "The per-moment rule's bound and a marker for your guess");
    boundEl._f = f;
  };
  const drawAll = () => { drawCost(); drawBound(); };
  const bestAt = () => {
    const { t, exact } = result;
    const k = Math.min(t.length - 2, Math.max(0, Math.floor(tStar / (t[1] - t[0]))));
    const u = (tStar - t[k]) / (t[k + 1] - t[k]);
    return exact[k] * (1 - u) + exact[k + 1] * u;
  };
  const reveal = () => {
    shown = true; drawBound();
    const bT = bestAt();
    reads.innerHTML = `<div class="k-acc"><dt>Your guess</dt><dd>${guess === null ? "–" : fmt(guess)}</dd></div>
      <div><dt>Best bound</dt><dd>${fmt(bT)}<small>at time ${tStar}</small></dd></div>
      <div class="k-pm"><dt>Per-moment</dt><dd>${fmt(pmT)}</dd></div>`;
    say.textContent = S.guessSay(guess, bT, pmT, tStar);
    liftReady(fig);
  };
  let down = false;
  const setAt = (e) => {
    const f = boundEl._f, r = boundEl.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * f.H;
    guess = Math.max(0, Math.min(yTop, f.iy(py)));
    if (shown) { shown = false; reads.innerHTML = ""; say.textContent = "Press Show me when you're ready."; }
    drawBound();
  };
  boundEl.addEventListener("pointerdown", (e) => { down = true; boundEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  boundEl.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  boundEl.addEventListener("pointerup", up); boundEl.addEventListener("pointercancel", up);
  $("#gu-show", el).addEventListener("click", () => { if (result) reveal(); else { waiting = true; say.textContent = "Solving the best bound…"; } });
  $("#gu-again", el).addEventListener("click", () => { guess = null; shown = false; reads.innerHTML = ""; say.textContent = "Drag the orange marker, then press Show me."; drawBound(); });
  window.addEventListener("cc-schedule", reset);
  reset();
  keepDrawn(costEl, drawCost); keepDrawn(boundEl, drawBound);
}

// ---------------------------------------------------------------- the strip's plate: waiting meets deciding
function flatPlate() {
  const fig = plate("flat"), el = rootOf("flat");
  if (!el) return;
  let c = 0.1, step = +(fig.dataset.step || 0);
  el.innerHTML = `<div class="controls">${segHTML("fl-c", [[0.03, "0.03"], [0.1, "0.1"], [0.3, "0.3"], [1, "1"]], c, "Cost of time, c")}</div>
    <div class="chart-wrap" id="fl-chart"></div><dl class="reads" id="fl-reads"></dl><p class="say" id="fl-say" aria-live="polite"></p>`;
  const chart = $("#fl-chart", el), reads = $("#fl-reads", el), say = $("#fl-say", el);
  const g = (y) => belief(y);
  const draw = () => {
    const b = B(c);
    if (step === 0) {
      const ys = range(0, b + 0.8, 161);
      const V = ys.map((y) => (y <= b ? g(b) - c * (b * Math.tanh(b) - y * Math.tanh(y)) : g(y)));
      const f = frame(chart, { x: [0, b + 0.8], y: [0.5, 1], aspect: 0.56, minH: 190, maxH: 270 });
      let s = axes(f, { yl: "value", xl: "evidence, y", grid: true });
      s += line(f, ys, ys.map(g), "dim") + line(f, ys.filter((y) => y <= b), V.filter((v, k) => ys[k] <= b), "ex");
      s += `<path class="dim" stroke-dasharray="3 3" d="M${f.sx(b).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-ex" x="${(f.sx(b) - 4).toFixed(1)}" y="${f.t + 10}" text-anchor="end">b = B(c)</text>`;
      s += `<text class="tk" x="${(f.sx(0.6 * b) + 4).toFixed(1)}" y="${(f.sy(g(0.6 * b)) + 16).toFixed(1)}">decide now, g(y)</text>`;
      s += `<text class="tag-ex" x="${(f.sx(0.05)).toFixed(1)}" y="${(f.sy(V[0]) - 7).toFixed(1)}">continue, V(y)</text>`;
      chart.innerHTML = svg(f, s, `The value of deciding now and of continuing until the flat bound, at a cost of ${c}`);
      reads.innerHTML = `<div><dt>Bound, B(c)</dt><dd>${fmt(b, 3)}</dd></div><div><dt>Value at y = 0, continuing</dt><dd>${fmt(V[0], 3)}</dd></div>`;
      say.textContent = "Below the bound, continuing is worth more than deciding; at the bound, the two values meet.";
    } else {
      const ys = range(0, Math.max(1.6 * b, b + 0.5), 161);
      const lhs = ys.map((y) => c * (y + 0.5 * Math.sinh(2 * y)));
      const f = frame(chart, { x: [0, ys[ys.length - 1]], y: [0, 1], aspect: 0.56, minH: 190, maxH: 270 });
      let s = axes(f, { yl: "cosh² y times the slope", xl: "evidence, y", grid: true });
      const inside = ys.map((y) => y <= b), last = inside.lastIndexOf(true);
      s += line(f, ys.slice(last), lhs.slice(last), "ex-thin") + line(f, ys.slice(0, last + 1), lhs.slice(0, last + 1), "ex");
      s += `<text class="tag-ex" x="${(f.W - f.r - 4).toFixed(1)}" y="${(f.sy(Math.min(0.95, lhs[lhs.length - 1])) + 14).toFixed(1)}" text-anchor="end">c (y + ½ sinh 2y)</text>`;
      if (step >= 2) {
        s += `<path class="dim" d="M${f.l} ${f.sy(0.5).toFixed(1)}H${f.W - f.r}"/><text class="tk" x="${f.l + 4}" y="${(f.sy(0.5) - 5).toFixed(1)}">cosh² y · g′(y) = ½</text>`;
        s += `<path class="dim" stroke-dasharray="3 3" d="M${f.sx(b).toFixed(1)} ${f.sy(0.5).toFixed(1)}V${f.H - f.b}"/><circle class="acc-dot" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(0.5).toFixed(1)}" r="4.5"/>`;
        s += `<text class="tag-acc" x="${(f.sx(b) + 6).toFixed(1)}" y="${(f.sy(0.5) + 16).toFixed(1)}">b = ${b.toFixed(3)}</text>`;
        reads.innerHTML = `<div><dt>Bound, B(c)</dt><dd>${fmt(b, 3)}</dd></div><div><dt>sinh 2b + 2b</dt><dd>${(Math.sinh(2 * b) + 2 * b).toPrecision(4)}</dd></div><div class="k-acc"><dt>1/c</dt><dd>${(1 / c).toPrecision(4)}</dd></div>`;
        say.textContent = S.flatSay(c, b);
      } else {
        reads.innerHTML = "";
        say.textContent = "Below the bound, this is cosh² y times the value's slope; past the bound, the value is g and the formula no longer applies (faint).";
      }
      chart.innerHTML = svg(f, s, `c times (y plus half of sinh 2y), which is cosh squared y times the slope of the value below the bound, continued past it faintly, at a cost of ${c}`);
    }
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "fl-c", (v) => { c = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
for (const [id, fn] of [["guess", guessPlate], ["flat", flatPlate]]) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } });
}
