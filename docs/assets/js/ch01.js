// Chapter 1's plates: the per-moment rule read off the constant-cost bound, a guess at the best bound before the
// 16-fold rise, and Figure 1 rebuilt live with the reader's schedule as a fifth panel. The best bound and the weighted
// look-ahead come from ch01-model.js in ch01-worker.js (the dynamic program and Algorithm 1, from model.js); the
// per-moment bound is B(c(t)) from model.js's table. The words under each plate come from say-ch01.js.
import { boundForCost, toDiscrete } from "./model.js?v=e579ee3325";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, defaultDrawing, VIEW, SPARE } from "./schedules-book.js?v=e579ee3325";
import { getChoice, setChoice, solve, onVisible, watchVisible, liftReady, calm } from "./book.js?v=e579ee3325";
import { frame, line, axes, svg, fmt, keepDrawn } from "./chart.js?v=e579ee3325";
import { FIG1, fig1Choice, fig1Of, at, ahead, knotsOf, DT, SHIFT } from "./ch01-model.js?v=e579ee3325";
import { panel, nowMarks, panelReadOut, fifthNote, ROWS } from "./ch01-draw.js?v=e579ee3325";
import * as S from "./say-ch01.js?v=e579ee3325";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const finite = (a) => a.filter(Number.isFinite);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const setSeg = (el, name, v) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = String(r.value) === String(v); });
const groups = [...new Set(PRESETS.map((p) => p.group))];
const pickHTML = (id) => `<label class="dial" style="flex:1 1 13rem"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
const fromPick = (v) => {
  if (v !== "draw") return { id: v, params: paramsOf({ id: v }) };
  const c = getChoice();
  return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() };
};
/** Follow the reader's schedule: the picker sets it for every page, and every plate that uses it redraws. */
function follow(pick, onChange) {
  if (pick) pick.addEventListener("change", () => setChoice(fromPick(pick.value)));
  window.addEventListener("cc-schedule", (e) => onChange(e.detail));
}
const fail = (id, e) => { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); };

// ---------------------------------------------------------------- the solver: one schedule's three bounds, shared
const WORKER = new URL("./ch01-worker.js?v=e579ee3325", import.meta.url);
const SOLVED = new Map();
function three(choice, progress = null) {
  const k = JSON.stringify(choice);
  if (!SOLVED.has(k)) SOLVED.set(k, solve({ job: "three", choice }, { worker: WORKER, progress }).catch((e) => { SOLVED.delete(k); throw e; }));
  return SOLVED.get(k);
}
const pmShifted = (cost, t) => toDiscrete(boundForCost(cost(t)), DT);

// ---------------------------------------------------------------- the hero: Figure 1(b), the bound rises before the fall
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const choice = fig1Choice("fall"), cost = costOf(choice), X = 1;
  const times = [0, 0.1, 0.2, 0.3, 0.4, 0.6];
  const ts = range(0, X, 201), cs = ts.map(cost), pm = ts.map((t) => pmShifted(cost, t));
  let data = null, cur = +(fig.dataset.still || 1);
  const bestAt = (t) => (data ? at(data, "exact", t) : NaN);
  const label = (i) => (data ? S.heroLabel(times[i], cost(times[i]), bestAt(times[i]), pmShifted(cost, times[i])) : `Time ${S.tf(times[i])}: cost ${S.cf(cost(times[i]))}; solving the best bound…`);
  const draw = (i) => {
    cur = i;
    const t0 = times[i];
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 12, r = 10, sx = (t) => l + (t / X) * (W - l - r);
    const split = Math.round(H * 0.34), cT = 22, cB = split - 6;
    const lo = Math.log(Math.min(...cs) / 1.3), hi = Math.log(Math.max(...cs) * 1.3);
    const syC = (c) => cT + (1 - (Math.log(c) - lo) / (hi - lo)) * (cB - cT);
    const yHi = Math.max(...pm, ...(data ? finite(data.exact) : [])) * 1.08;
    const bT = split + 24, bB = H - 22;
    const syB = (b) => bT + (1 - b / yHi) * (bB - bT);
    const path = (xs, ys, sy) => { let d = "", pen = false; xs.forEach((x, k) => { const v = ys[k]; if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(v).toFixed(1); pen = true; }); return d; };
    let s = `<path class="ax" d="M${l} ${cB + 2}H${W - r}M${l} ${bB}H${W - r}"/>`;
    s += `<text class="lab" x="${l}" y="13">cost of time: Figure 1(b), it falls from 0.4 to 0.05</text>`;
    s += `<path class="cost" d="${path(ts, cs, syC)}"/>`;
    s += `<text class="lab" x="${l}" y="${bT - 8}">the bound: best (ink) and per-moment (dashed)</text>`;
    s += `<path class="pm" d="${path(ts, pm, syB)}"/>`;
    const k = Math.round(t0 / (X / 200));
    s += `<path class="dim" stroke-dasharray="2 3" d="M${sx(t0).toFixed(1)} ${cT}V${bB}"/>`;
    s += `<circle class="acc-dot" cx="${sx(t0).toFixed(1)}" cy="${syC(cs[k]).toFixed(1)}" r="4"/>`;
    if (data) {
      const tt = data.t.filter((t) => t <= X + 1e-9);
      s += `<path class="ex" d="${path(tt, data.exact.slice(0, tt.length), syB)}"/>`;
      s += `<circle class="ink-dot" cx="${sx(t0).toFixed(1)}" cy="${syB(bestAt(t0)).toFixed(1)}" r="4.5"/>`;
    } else s += `<text class="tk" x="${(W / 2).toFixed(0)}" y="${((bT + bB) / 2 - 18).toFixed(0)}" text-anchor="middle">solving the best bound…</text>`;
    s += `<circle class="pm-dot" cx="${sx(t0).toFixed(1)}" cy="${syB(pm[k]).toFixed(1)}" r="4"/>`;
    s += `<text class="tk" x="${sx(0)}" y="${H - 6}" text-anchor="start">0</text><text class="tk" x="${sx(0.3).toFixed(1)}" y="${H - 6}" text-anchor="middle">0.3</text><text class="tk" x="${sx(X)}" y="${H - 6}" text-anchor="end">time ${X}</text>`;
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: times.length, draw, label });
  onVisible(fig, () => {
    three(choice).then((r) => {
      data = r; draw(cur);
      const lab = fig.querySelector(".proof-label"); if (lab) lab.textContent = label(cur);
    }).catch((e) => console.warn("hero:", e.message));
  }, "200px");
}

// ---------------------------------------------------------------- plate: read the cost through B
function rulePlate() {
  const fig = plate("rule"), el = rootOf("rule");
  if (!el) return;
  let choice = getChoice(), t = 0.3, auto = !calm.matches, visible = false, raf = 0, t0 = 0;
  el.innerHTML = `<div class="controls">${pickHTML("ru-pick")}<label class="dial"><span class="ctl-key">Time t</span><output id="ru-out"></output>
      <input type="range" id="ru-t" min="0" max="${VIEW}" step="0.01" value="${t}" aria-label="Time t"></label></div>
    <div class="chart-wrap" id="ru-cost"></div><div class="chart-wrap" id="ru-bound"></div><div class="chart-wrap" id="ru-lens"></div>
    <ul class="legend"><li><span class="key key-acc">Cost of time</span></li><li><span class="key key-ex">B(c), the constant-cost bound</span></li><li><span class="key key-pm">Per-moment bound, B(c(t))</span></li></ul>
    <dl class="reads" id="ru-reads"></dl><p class="say" id="ru-say"></p>`;
  const pick = $("#ru-pick", el), inp = $("#ru-t", el), out = $("#ru-out", el), costEl = $("#ru-cost", el), boundEl = $("#ru-bound", el), lensEl = $("#ru-lens", el);
  const reads = $("#ru-reads", el), say = $("#ru-say", el);
  let cost, dl, X, ts, cs, pm, cLo, cHi, yTop, xLo, xHi;
  const setup = () => {
    pick.value = choice.id;
    cost = costOf(choice); dl = deadlineOf(choice);
    // the window reaches past a deadline, so the drop to B(infinity) = 0 is on the chart
    X = Math.max(VIEW, dl !== null ? dl + 0.5 : 0);
    inp.max = String(X); if (t > X) t = X;
    const grid = range(0, X, 251);
    if (dl === null) { ts = grid; cs = ts.map(cost); pm = cs.map((c) => boundForCost(c)); }
    else {
      // up to and at the deadline the cost is finite; just after it, infinite: the bound falls straight down there
      const before = [...grid.filter((u) => u < dl - 1e-9), dl], after = grid.filter((u) => u > dl + 1e-9);
      ts = [...before, dl, ...after];
      cs = [...before.map(cost), Infinity, ...after.map(() => Infinity)];
      pm = [...before.map((u) => boundForCost(cost(u))), 0, ...after.map(() => 0)];
    }
    const fc = finite(cs);
    cLo = Math.min(...fc); cHi = Math.max(...fc);
    xLo = Math.max(0.004, Math.min(cLo / 2, 0.05)); xHi = Math.min(8, Math.max(cHi * 2, 0.5));
    yTop = Math.max(0.4, boundForCost(xLo) * 1.05);
  };
  const costAt = (u) => (dl !== null && u > dl + 1e-9 ? Infinity : cost(u));
  const draw = () => {
    out.textContent = t.toFixed(2);
    const c = costAt(t), b = boundForCost(c), past = !Number.isFinite(c);
    // the cost over time
    const fc = frame(costEl, { x: [0, X], y: [cLo / 1.6, cHi * 1.6], ylog: true, aspect: 0.22, minH: 92, maxH: 130, b: 22 });
    let g = axes(fc, { yl: "cost of time, c(t)", grid: true }) + line(fc, ts, cs, "cost");
    if (dl !== null) g += `<path class="acc" stroke-dasharray="3 3" d="M${fc.sx(dl).toFixed(1)} ${fc.t - 4}V${fc.H - fc.b}"/><text class="tag-acc" x="${(fc.sx(dl) + (fc.sx(dl) + 84 > fc.W - fc.r ? -4 : 4)).toFixed(1)}" y="${fc.t + 8}" text-anchor="${fc.sx(dl) + 84 > fc.W - fc.r ? "end" : "start"}">forced choice</text>`;
    g += `<path class="dim" stroke-dasharray="2 3" d="M${fc.sx(t).toFixed(1)} ${fc.t}V${fc.H - fc.b}"/>`;
    if (!past) g += `<circle class="acc-dot" cx="${fc.sx(t).toFixed(1)}" cy="${fc.sy(c).toFixed(1)}" r="4.5"/>`;
    costEl.innerHTML = svg(fc, g, `The cost of time for ${labelOf(choice)}, on a log scale, with time ${t.toFixed(2)} marked`);
    // the per-moment bound over time
    const fb = frame(boundEl, { x: [0, X], y: [0, yTop], aspect: 0.4, minH: 160, maxH: 240 });
    let h = axes(fb, { yl: "per-moment bound, B(c(t))", xl: "time", grid: true }) + line(fb, ts, pm, "pm");
    h += `<path class="dim" stroke-dasharray="2 3" d="M${fb.sx(t).toFixed(1)} ${fb.t}V${fb.H - fb.b}"/>`;
    h += `<path class="pm-guide" d="M${fb.l} ${fb.sy(b).toFixed(1)}H${fb.sx(t).toFixed(1)}"/><circle class="pm-dot" cx="${fb.sx(t).toFixed(1)}" cy="${fb.sy(b).toFixed(1)}" r="4.5"/>`;
    boundEl.innerHTML = svg(fb, h, `The per-moment bound over time for ${labelOf(choice)}, with time ${t.toFixed(2)} marked`);
    // the lens: B(c) against c, with the schedule's costs and the cost at t
    const fl = frame(lensEl, { x: [xLo, xHi], y: [0, yTop], xlog: true, aspect: 0.46, minH: 170, maxH: 250 });
    const xs = range(Math.log10(xLo), Math.log10(xHi), 160).map((v) => 10 ** v);
    let k = axes(fl, { yl: "bound for a constant cost, B(c)", xl: "cost of time, c", grid: true });
    const reach = xs.filter((x) => x >= cLo * 0.999 && x <= cHi * 1.001);
    if (reach.length > 1) k += line(fl, reach, reach.map(boundForCost), "reach");
    else k += `<circle class="reach-dot" cx="${fl.sx(cLo).toFixed(1)}" cy="${fl.sy(boundForCost(cLo)).toFixed(1)}" r="5"/>`;
    k += line(fl, xs, xs.map(boundForCost), "ex");
    if (!past) {
      const X = fl.sx(c).toFixed(1), Y = fl.sy(b).toFixed(1);
      k += `<path class="acc-guide" d="M${X} ${fl.H - fl.b}V${Y}"/><path class="pm-guide" d="M${X} ${Y}H${fl.l}"/>`;
      k += `<circle class="pm-dot" cx="${X}" cy="${Y}" r="4.5"/>`;
      k += `<text class="tag-acc" x="${(+X + (c > Math.sqrt(xLo * xHi) ? -6 : 6)).toFixed(1)}" y="${fl.H - fl.b - 8}" text-anchor="${c > Math.sqrt(xLo * xHi) ? "end" : "start"}">c(t) = ${S.cf(c)}</text>`;
    } else k += `<text class="tag-acc" x="${fl.W - fl.r - 4}" y="${fl.H - fl.b - 8}" text-anchor="end">c = ∞, so B(∞) = 0</text>`;
    lensEl.innerHTML = svg(fl, k, `The constant-cost bound B(c) against the cost, with the costs your schedule reaches shaded and the cost at time ${t.toFixed(2)} read through it`);
    reads.innerHTML = `<div class="k-acc"><dt>Cost at time ${t.toFixed(2)}</dt><dd>${S.cf(c)}</dd></div>
      <div class="k-pm"><dt>Per-moment bound</dt><dd>${fmt(b, 3)}<small>B(c(t)), for checking continuously</small></dd></div>`;
    say.textContent = S.ruleSay(t, past ? cost(dl) : c, past ? boundForCost(cost(dl)) : b, ahead(costAt, t, dl), dl);
    liftReady(fig);
  };
  const loop = (now) => {
    raf = 0;
    if (!auto || !visible) return;
    if (!t0) t0 = now;
    const ph = ((now - t0) / 11000) % 1;
    t = Math.round(X * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph)) * 100) / 100;
    inp.value = t; draw();
    raf = requestAnimationFrame(loop);
  };
  const stopAuto = () => { auto = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
  inp.addEventListener("input", () => { stopAuto(); t = +inp.value; draw(); });
  follow(pick, (c) => { choice = c; setup(); draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && auto && !raf) raf = requestAnimationFrame(loop); });
  setup();
  keepDrawn(boundEl, draw);
}

// ---------------------------------------------------------------- plate: where is the bound before the rise?
function risePlate() {
  const fig = plate("rise"), el = rootOf("rise");
  if (!el) return;
  const choice = fig1Choice("jump"), cost = costOf(choice), T = 0.4, X = 1.2, yTop = 1.45;
  const c0 = cost(-5), c1 = cost(10);
  const ts = range(0, X, 241), cs = ts.map(cost), pm = ts.map((t) => pmShifted(cost, t));
  const pmT = pmShifted(cost, T);
  let guess = null, shown = false, result = null, waiting = false;
  el.innerHTML = `<div class="chart-wrap" id="rs-cost"></div><div class="chart-wrap pad is-draw" id="rs-bound"></div>
    <div class="controls" style="margin-top:10px"><label class="dial"><span class="ctl-key">Your guess at time ${T}</span><output id="rs-out">–</output>
      <input type="range" id="rs-g" min="0" max="${yTop}" step="0.01" value="${(yTop * 0.75).toFixed(2)}" aria-label="Your guess for the best bound at time ${T}"></label>
      <div class="actions"><button class="btn btn-go" type="button" id="rs-show">Show me</button><button class="btn" type="button" id="rs-again">Guess again</button></div></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment rule, moved in</span></li><li><span class="key key-ex">Best bound</span></li><li><span class="key key-acc">Your guess</span></li></ul>
    <dl class="reads" id="rs-reads"></dl><p class="say" id="rs-say" aria-live="polite"></p><p class="fine" id="rs-state" aria-live="polite"></p>`;
  const costEl = $("#rs-cost", el), boundEl = $("#rs-bound", el), reads = $("#rs-reads", el), say = $("#rs-say", el), state = $("#rs-state", el);
  const inp = $("#rs-g", el), out = $("#rs-out", el);
  const bestT = () => at(result, "exact", T);
  const drawCost = () => {
    const f = frame(costEl, { x: [0, X], y: [c0 / 1.6, c1 * 1.6], ylog: true, aspect: 0.22, minH: 92, maxH: 130, b: 22 });
    let s = axes(f, { yl: "cost of time", grid: true }) + line(f, ts, cs, "cost");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(T).toFixed(1)} ${f.t}V${f.H - f.b}"/><circle class="acc-dot" cx="${f.sx(T).toFixed(1)}" cy="${f.sy(cost(T)).toFixed(1)}" r="4"/>`;
    costEl.innerHTML = svg(f, s, "The cost of time for Figure 1(a): 0.1, rising to 1.6 around time 0.5, on a log scale");
  };
  const drawBound = () => {
    const f = frame(boundEl, { x: [0, X], y: [0, yTop], aspect: 0.52, minH: 200, maxH: 290 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    s += line(f, ts, pm, "pm");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(T).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    const X0 = f.sx(T);
    if (shown && result) {
      const tt = result.t.filter((t) => t <= X + 1e-9);
      s += line(f, tt, result.exact.slice(0, tt.length), "ex");
      const bT = bestT();
      if (guess !== null) s += `<path class="miss" d="M${X0.toFixed(1)} ${f.sy(guess).toFixed(1)}V${f.sy(bT).toFixed(1)}"/>`;
      s += `<circle class="ink-dot" cx="${X0.toFixed(1)}" cy="${f.sy(bT).toFixed(1)}" r="4.5"/>`;
      s += `<text class="tag-ex" x="${(X0 - 8).toFixed(1)}" y="${(f.sy(bT) + 4).toFixed(1)}" text-anchor="end">best ${fmt(bT, 3)}</text>`;
    }
    s += `<circle class="pm-dot" cx="${X0.toFixed(1)}" cy="${f.sy(pmT).toFixed(1)}" r="4"/>`;
    const gy = guess ?? +inp.value;
    s += `<circle class="acc-dot" cx="${X0.toFixed(1)}" cy="${f.sy(gy).toFixed(1)}" r="${guess === null ? 7 : 6}" style="opacity:${guess === null ? 0.55 : 1}"/>`;
    if (guess === null) s += `<text class="tag-acc" x="${(X0 + 11).toFixed(1)}" y="${(f.sy(gy) + 4).toFixed(1)}">drag me</text>`;
    else s += `<text class="tag-acc" x="${(X0 + 10).toFixed(1)}" y="${(f.sy(gy) + 4).toFixed(1)}">you ${fmt(guess)}</text>`;
    s += `<text class="tag-pm" x="${(X0 + 10).toFixed(1)}" y="${(f.sy(pmT) + (Math.abs(f.sy(pmT) - f.sy(gy)) < 16 ? (f.sy(pmT) > f.sy(gy) ? 16 : -10) : 4)).toFixed(1)}">per-moment ${fmt(pmT, 3)}</text>`;
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    boundEl.innerHTML = svg(f, s, shown ? "Your guess beside the best bound and the per-moment bound, on the 16-fold rise" : "The per-moment bound on the 16-fold rise, and a marker for your guess at time 0.4");
    boundEl._f = f;
  };
  const reveal = () => {
    shown = true; drawBound();
    const bT = bestT();
    reads.innerHTML = `<div class="k-acc"><dt>Your guess</dt><dd>${guess === null ? "–" : fmt(guess)}</dd></div>
      <div><dt>Best bound</dt><dd>${fmt(bT, 3)}<small>at time ${T}</small></dd></div>
      <div class="k-pm"><dt>Per-moment</dt><dd>${fmt(pmT, 3)}<small>at time ${T}, moved in by ${fmt(SHIFT, 3)}</small></dd></div>
      <div class="k-acc"><dt>Your miss</dt><dd>${guess === null ? "–" : fmt(Math.abs(guess - bT), 3)}</dd></div>`;
    say.textContent = S.riseSay(guess, bT, pmT, T, cost(T), c0, c1);
    liftReady(fig);
  };
  const setGuess = (v) => {
    guess = Math.max(0, Math.min(yTop, Math.round(v * 100) / 100));
    inp.value = guess; out.textContent = fmt(guess);
    if (shown) { shown = false; reads.innerHTML = ""; say.textContent = "Press Show me when you're ready."; }
    drawBound();
  };
  let down = false;
  const setAt = (e) => {
    const f = boundEl._f, r = boundEl.getBoundingClientRect();
    setGuess(f.iy(((e.clientY - r.top) / r.height) * f.H));
  };
  boundEl.addEventListener("pointerdown", (e) => { down = true; boundEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  boundEl.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  boundEl.addEventListener("pointerup", up); boundEl.addEventListener("pointercancel", up);
  inp.addEventListener("input", () => setGuess(+inp.value));
  $("#rs-show", el).addEventListener("click", () => { if (result) reveal(); else { waiting = true; say.textContent = "Solving the best bound…"; } });
  $("#rs-again", el).addEventListener("click", () => { guess = null; shown = false; out.textContent = "–"; reads.innerHTML = ""; say.textContent = "Drag the orange marker, or use the slider, then press Show me."; drawBound(); });
  say.textContent = `The cost is ${S.cf(cost(T))} at time ${T}, on its way from ${S.cf(c0)} to ${S.cf(c1)}. Drag the orange marker to where you think the best bound sits, then press Show me.`;
  state.textContent = "Solving the dynamic program…";
  three(choice).then((r) => {
    result = r;
    state.textContent = `Time step ${DT}, evidence step 0.02; the program runs to t = ${VIEW + SPARE}, 6 time units past the book's window of ${VIEW}, where the choice is forced.`;
    if (waiting) { waiting = false; reveal(); }
  }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
  keepDrawn(costEl, drawCost); keepDrawn(boundEl, drawBound);
}

// ---------------------------------------------------------------- plate: Figure 1, live
function figurePlate() {
  const fig = plate("figure1"), el = rootOf("figure1");
  if (!el) return;
  let choice = getChoice(), t = 0.3, sel = 0, auto = !calm.matches, visible = false, raf = 0, t0 = 0;
  const panels = FIG1.map((p) => ({ ...p, choice: fig1Choice(p.id), data: null }));
  panels.forEach((p) => { p.cost = costOf(p.choice); p.dl = deadlineOf(p.choice); });
  const yours = { letter: null, data: null };
  // one bound scale for the four, from the per-moment bounds (closed form, so it is known before any solve)
  const yTop4 = Math.max(...panels.map((p) => Math.max(...range(0, p.dl ?? VIEW, 251).map((u) => pmShifted(p.cost, u))))) * 1.1;
  const SEL = [["0", "(a)"], ["1", "(b)"], ["2", "(c)"], ["3", "(d)"], ["4", "Yours"]];
  el.innerHTML = `<div class="controls"><label class="dial"><span class="ctl-key">Time</span><output id="f1-out"></output>
      <input type="range" id="f1-t" min="0" max="${VIEW}" step="0.01" value="${t}" aria-label="Time, across every panel"></label>
      <div class="actions"><button class="btn" type="button" id="f1-play" aria-pressed="false">Play</button></div></div>
    <div class="chart-wrap" id="f1-four"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment, moved in</span></li><li><span class="key key-wb">Weighted look-ahead</span></li><li><span class="key key-acc">Cost of time (log scale)</span></li></ul>
    <div class="controls" style="margin-top:16px">${pickHTML("f1-pick")}</div>
    <p class="fine" id="f1-note" style="margin-bottom:10px"></p>
    <div class="chart-wrap" id="f1-yours"></div>
    <div class="controls" style="margin-top:14px">${segHTML("f1-sel", SEL, sel, "Read out")}</div>
    <dl class="reads" id="f1-reads"></dl><p class="say" id="f1-say"></p><p class="fine" id="f1-state" aria-live="polite"></p>`;
  const four = $("#f1-four", el), mine = $("#f1-yours", el), inp = $("#f1-t", el), out = $("#f1-out", el), play = $("#f1-play", el);
  const pick = $("#f1-pick", el), note = $("#f1-note", el), reads = $("#f1-reads", el), say = $("#f1-say", el), state = $("#f1-state", el);
  let geo4 = [], geoY = null;
  const drawFour = () => {
    const W = Math.max(280, Math.round(four.clientWidth || 340)), gap = 14, w = (W - gap) / 2;
    const bh = Math.round(Math.min(170, Math.max(104, w * 0.62))), ph = ROWS.title + 4 + Math.round(Math.min(40, Math.max(28, bh * 0.26))) + ROWS.gap + 4 + bh + 20;
    const H = 2 * ph + 12;
    const narrow = w < 240;
    let s = "", hits = "";
    geo4 = panels.map((p, k) => {
      const g = panel(p, { x0: (k % 2) * (w + gap), y0: Math.floor(k / 2) * (ph + 12), w, bh, yTop: yTop4, selected: sel === k, title: `(${p.letter}) ${narrow ? p.short : p.title}` });
      s += g.s;
      hits += `<rect class="panel-hit" data-k="${k}" x="${g.hit.x}" y="${g.hit.y}" width="${g.hit.w}" height="${g.hit.h}"/>`;
      return g;
    });
    four.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Figure 1's four schedules: the cost of time in a strip above each panel, and the best bound, the per-moment rule, and the weighted look-ahead, with a line at the chosen time">${s}<g id="f1-now4"></g>${hits}</svg>`;
    four.querySelectorAll(".panel-hit").forEach((r) => r.addEventListener("click", () => choose(+r.dataset.k)));
    moveNow();
  };
  const drawYours = () => {
    const W = Math.max(280, Math.round(mine.clientWidth || 340));
    const y = yours;
    const tsP = range(0, y.dl ?? VIEW, 251);
    const vals = [...tsP.map((u) => pmShifted(y.cost, u)), ...(y.data ? [...finite(y.data.exact), ...y.data.wbShift] : [])];
    const yTop = Math.max(0.4, Math.max(...vals) * 1.1);
    const bh = Math.round(Math.min(200, Math.max(130, W * 0.36)));
    const g = panel(y, { x0: 0, y0: 0, w: W, bh, yTop, selected: sel === 4, title: `Yours: ${labelOf(choice)}` });
    geoY = g;
    mine.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${g.hit.h}" width="${W}" height="${g.hit.h}" role="img" aria-label="Your schedule: the cost of time, the best bound, the per-moment rule, and the weighted look-ahead">${g.s}<g id="f1-nowY"></g><rect class="panel-hit" x="0" y="0" width="${W}" height="${g.hit.h}"/></svg>`;
    mine.querySelector(".panel-hit").addEventListener("click", () => choose(4));
    moveNow();
  };
  const moveNow = () => {
    out.textContent = t.toFixed(2);
    const g4 = four.querySelector("#f1-now4"); if (g4 && geo4.length) g4.innerHTML = panels.map((p, k) => nowMarks(p, geo4[k], t)).join("");
    const gy = mine.querySelector("#f1-nowY"); if (gy && geoY) gy.innerHTML = nowMarks(yours, geoY, t);
    readOut();
  };
  const readOut = () => {
    const p = sel === 4 ? yours : panels[sel];
    const name = sel === 4 ? `Your schedule (${labelOf(choice)})` : `(${p.letter}) ${p.short}`;
    const r = panelReadOut(p, t, name, sel < 4 || !!fig1Of(choice)?.same);
    reads.innerHTML = r.html; say.textContent = r.say;
  };
  const choose = (k) => { sel = k; setSeg(el, "f1-sel", k); drawFour(); drawYours(); };
  const setupYours = () => {
    pick.value = choice.id;
    yours.choice = choice; yours.cost = costOf(choice); yours.dl = deadlineOf(choice); yours.knots = knotsOf(choice); yours.data = null;
    // the time line reaches the end of every panel, a late deadline included
    inp.max = String(Math.max(VIEW, yours.dl ?? 0)); if (t > +inp.max) { t = +inp.max; inp.value = t; }
    // a schedule is flat when its cost doesn't change at all (a constant, a smooth one of size 0, a drawing of equal
    // knots), whatever its preset is called; a drawing that changes in its fifth digit is not flat
    note.textContent = fifthNote(choice);
    drawYours();
    const c = choice;
    three(c).then((r) => { if (c !== choice) return; yours.data = r; drawYours(); liftReady(fig); }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
  };
  const loop = (now) => {
    raf = 0;
    if (!auto || !visible) return;
    if (!t0) t0 = now;
    const ph = ((now - t0) / 8000) % 1;   // a sweep from 0 to 1.2 over six seconds, then a hold
    t = Math.round(Math.min(1, ph / 0.75) * 1.2 * 100) / 100;
    inp.value = t; moveNow();
    raf = requestAnimationFrame(loop);
  };
  const startAuto = () => { auto = true; t0 = 0; play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); if (visible && !raf) raf = requestAnimationFrame(loop); };
  const stopAuto = () => { auto = false; if (raf) cancelAnimationFrame(raf); raf = 0; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); };
  play.addEventListener("click", () => (auto ? stopAuto() : startAuto()));
  inp.addEventListener("input", () => { stopAuto(); t = +inp.value; moveNow(); });
  onSeg(el, "f1-sel", (v) => choose(+v));
  follow(pick, (c) => { choice = c; setupYours(); });
  watchVisible(fig, (v) => { visible = v; if (v && auto && !raf) raf = requestAnimationFrame(loop); });
  if (auto) { play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); }
  keepDrawn(four, drawFour);
  setupYours();
  keepDrawn(mine, drawYours);
  // the four, one after another in the worker; each panel draws when its bounds arrive
  let done = 0;
  state.textContent = "Solving the dynamic program and the rules… 0 of 4";
  panels.forEach((p) => three(p.choice).then((r) => {
    p.data = r; done++;
    state.textContent = done < 4 ? `Solving the dynamic program and the rules… ${done} of 4`
      : `Time step ${DT}, evidence step 0.02, rules moved in by ${fmt(SHIFT, 3)}; the program runs to t = ${VIEW + SPARE}, 6 time units past the book's window of ${VIEW}, or to the deadline.`;
    drawFour(); liftReady(fig);
  }).catch((e) => { state.textContent = "The solver stopped: " + e.message; }));
}

// ---------------------------------------------------------------- start
hero();
for (const [id, fn] of [["rule", rulePlate], ["rise", risePlate], ["figure1", figurePlate]]) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { fail(id, e); } });
}
