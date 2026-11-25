// Chapter 4's plates. The bounds and values come from the dynamic program in ch04-worker.js (model.js's program, with
// its values kept); the decisions are sampled against that bound with a fixed seed; the continuous flat bounds come from
// kernel.js. The words under each plate come from say-ch04.js, which takes numbers and returns sentences.
import { B, rng } from "./kernel.js";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, VIEW, SPARE, defaultDrawing } from "./schedules-book.js";
import { getChoice, setChoice, solve, onVisible, liftReady, seedParam, wireStrips } from "./book.js";
import { frame, line, area, axes, svg, tags, fmt, keepDrawn, dropAt } from "./chart.js";
import * as M from "./ch04-model.js";
import * as S from "./say-ch04.js";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const vline = (f, x, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.sx(x).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
const hline = (f, y, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.l} ${f.sy(y).toFixed(1)}H${f.W - f.r}"/>`;
const dot = (f, x, y, cls = "ink-dot", r = 4) => `<circle class="${cls}" cx="${f.sx(x).toFixed(1)}" cy="${f.sy(y).toFixed(1)}" r="${r}"/>`;
const text = (x, y, s, cls = "tk", anchor = "start") => `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${s}</text>`;
const clean = (s) => String(s).replace(/[<>&]/g, "");
const fail = (id, e) => { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${clean(e && e.message || e)}</p>`; console.error(e); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const seOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length / a.length); };
/** A band between two curves (or levels) over xs, as a filled path. */
const bandPath = (f, xs, lo, hi, cls) => {
  let d = "";
  xs.forEach((x, i) => { d += (i ? "L" : "M") + f.sx(x).toFixed(1) + " " + f.sy(typeof hi === "number" ? hi : hi[i]).toFixed(1); });
  for (let i = xs.length - 1; i >= 0; i--) d += "L" + f.sx(xs[i]).toFixed(1) + " " + f.sy(typeof lo === "number" ? lo : lo[i]).toFixed(1);
  return `<path class="${cls}" d="${d}Z"/>`;
};

/** Labels for the band's two edges: the top one above its line, the bottom one below its line unless that would meet
 * the time axis, then above it. */
const edgeLabels = (f, up, dn, upText, dnText) => {
  const yUp = f.sy(up) - 5, yDn = f.sy(dn) + 13 > f.H - f.b - 3 ? f.sy(dn) - 5 : f.sy(dn) + 13;
  return text(f.W - f.r - 4, yUp, upText, "tk-halo", "end") + text(f.W - f.r - 4, yDn, dnText, "tk-halo", "end");
};
const minus = (s) => String(s).replace(/^-/, "−");

// ---- the worker: one program per schedule and job, shared by the plates that ask for it
const WORKER = new URL("./ch04-worker.js", import.meta.url);
const memo = new Map();
function work(key, job, opts = {}) {
  if (key && memo.has(key)) return memo.get(key);
  const p = solve(job, { ...opts, worker: WORKER });
  if (key) { memo.set(key, p); p.catch(() => memo.delete(key)); }
  return p;
}
const norm = (choice) => (choice.id === "draw" ? { id: "draw", points: Array.isArray(choice.points) ? choice.points : defaultDrawing() } : { id: choice.id, params: paramsOf(choice) });
const keyOf = (choice) => JSON.stringify(norm(choice));
const specOf = (choice) => ({ kind: "choice", choice: norm(choice) });
/** The program for a schedule, with the bound at every check (and V at the steps in keep). */
const bounds = (spec, keep = "none") => work(JSON.stringify([spec, keep]), { job: "values", spec, keep });
const kindOf = (choice) => (deadlineOf(choice) !== null ? "deadline" : choice.id === "rising" ? "rising" : choice.id === "constant" ? "constant" : "ok");

const FIG1A = M.FIG1A, FIG1A_SPEC = specOf(FIG1A), FIG1A_COST = costOf(FIG1A);
const pickerHTML = (id) => {
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  return `<label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
    <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
};
const choiceFromPick = (v) => {
  if (v === "draw") { const c = getChoice(); return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
  return { id: v, params: paramsOf({ id: v }) };
};
/** A cost strip on a log scale over [0, view], with the schedule's lowest and highest cost dotted if asked. */
function costStrip(el, cost, view, { ext = null, mark = null, label = "cost, log scale", minH = 112, x0 = 0 } = {}) {
  const ts = range(x0, view, 251), cs = ts.map((t) => (Number.isFinite(cost(t)) ? Math.min(cost(t), 60) : NaN));
  const fin = cs.filter(Number.isFinite);
  let lo = Math.min(...fin), hi = Math.max(...fin);
  if (ext) { lo = Math.min(lo, ext.lo); if (Number.isFinite(ext.hi)) hi = Math.max(hi, Math.min(ext.hi, 60)); }
  const f = frame(el, { x: [x0, view], y: [Math.max(0.003, lo / 2.8), Math.max(hi * 2.2, lo * 4)], ylog: true, aspect: 0.26, minH, maxH: 150, b: 22, t: 18 });
  let s = axes(f, { yl: label, grid: true });
  if (ext) {
    s += hline(f, ext.lo, "acc", 'stroke-dasharray="2 3"') + text(f.W - f.r - 2, f.sy(ext.lo) + 13, `lowest ${S.cLo(ext.lo)}`, "tag-acc", "end");
    if (Number.isFinite(ext.hi) && ext.hi < 60) s += hline(f, ext.hi, "acc", 'stroke-dasharray="2 3"') + text(f.W - f.r - 2, f.sy(ext.hi) - 5, `highest ${S.cHi(ext.hi)}`, "tag-acc", "end");
  }
  s += line(f, ts, cs, "cost");
  if (mark !== null) s += vline(f, mark, "dim", 'stroke-dasharray="2 3"');
  el.innerHTML = svg(f, s, "The cost of time on a log scale" + (ext ? ", with its lowest and highest values over all time" : ""));
  return f;
}

// ---------------------------------------------------------------- the hero: the band, schedule by schedule
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const four = ["jump", "fall", "pulse", "multistep"].map((id) => {
    const p = PRESETS.find((q) => q.id === id), choice = { id, params: paramsOf({ id }) }, cost = costOf(choice);
    return { p, choice, cost, ext: M.extremes(cost) };
  });
  const solved = new Array(four.length).fill(null);
  let cur = 0;
  const draw = (i) => {
    cur = i;
    const { p, cost, ext } = four[i];
    const view = VIEW, ts = range(0, view, 201);
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const split = Math.round(H * 0.34), l = 12, r = 10;
    const sx = (t) => l + (t / view) * (W - l - r);
    const cLo = Math.log(ext.lo / 1.5), cHi = Math.log(ext.hi * 1.5);
    const syC = (c) => 18 + (1 - (Math.log(c) - cLo) / (cHi - cLo)) * (split - 26);
    const up = M.flatOnGrid(ext.lo), dn = M.flatOnGrid(ext.hi), top = up * 1.12 + 0.05;
    const yb0 = split + 18, yb1 = H - 22;
    const syB = (b) => yb0 + (1 - b / top) * (yb1 - yb0);
    const path = (xs, ys, sy) => { let d = "", pen = false; xs.forEach((x, k) => { const v = ys[k]; if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(v).toFixed(1); pen = true; }); return d; };
    let s = `<path class="ax" d="M${l} ${split - 6}H${W - r}M${l} ${yb1}H${W - r}"/>`;
    s += `<path class="acc" stroke-dasharray="2 3" d="M${l} ${syC(ext.lo).toFixed(1)}H${W - r}M${l} ${syC(ext.hi).toFixed(1)}H${W - r}"/>`;
    s += `<path class="cost" d="${path(ts, ts.map(cost), syC)}"/>`;
    s += `<text class="lab" x="${l}" y="11">cost of time: ${p.label.toLowerCase()}</text>`;
    const ex = solved[i];
    if (ex) { // the band on the grid: the same program's bounds for the constant costs c_min and c_max
      const k = Math.round(view / ex.b.dt), xs = Array.from({ length: k + 1 }, (_, j) => j * ex.b.dt);
      let d = ""; xs.forEach((x, j) => { d += (j ? "L" : "M") + sx(x).toFixed(1) + " " + syB(ex.lo.bounds[j]).toFixed(1); });
      for (let j = k; j >= 0; j--) d += "L" + sx(xs[j]).toFixed(1) + " " + syB(ex.hi.bounds[j]).toFixed(1);
      s += `<path class="band-gray" d="${d}Z"/>`;
    }
    s += `<path class="guide" d="M${l} ${syB(up).toFixed(1)}H${W - r}M${l} ${syB(dn).toFixed(1)}H${W - r}"/>`;
    s += `<text class="tk-halo" x="${W - r - 4}" y="${(syB(up) - 5).toFixed(1)}" text-anchor="end">B(${S.cLo(ext.lo)})</text>`;
    s += `<text class="tk-halo" x="${W - r - 4}" y="${(syB(dn) - 5).toFixed(1)}" text-anchor="end">B(${S.cHi(ext.hi)})</text>`;
    s += `<path class="pm" d="${path(ts, ts.map((t) => M.flatOnGrid(cost(t))), syB)}"/>`;
    if (ex) { const k = Math.round(view / ex.b.dt), xs = Array.from({ length: k + 1 }, (_, j) => j * ex.b.dt); s += `<path class="ex" d="${path(xs, Array.from(ex.b.bounds.subarray(0, k + 1)), syB)}"/>`; }
    else s += `<text class="tk" x="${(W / 2).toFixed(0)}" y="${((yb0 + yb1) / 2).toFixed(0)}" text-anchor="middle">solving the best bound…</text>`;
    s += `<text class="lab" x="${l}" y="${yb0 - 4}">the best bound (ink), inside the band on the grid (gray)</text>`;
    s += `<text class="tk" x="${sx(0)}" y="${H - 6}" text-anchor="start">0</text><text class="tk" x="${sx(view)}" y="${H - 6}" text-anchor="end">time ${view}</text>`;
    el.innerHTML = s;
  };
  draw(0);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: four.length, draw, label: (i) => S.heroLabel(four[i].p.label, four[i].ext.lo, four[i].ext.hi) });
  onVisible(fig, async () => {
    for (let i = 0; i < four.length; i++) {
      try {
        const [b, lo, hi] = await Promise.all([bounds(specOf(four[i].choice)), bounds({ kind: "const", c: four[i].ext.lo }), bounds({ kind: "const", c: four[i].ext.hi })]);
        solved[i] = { b, lo, hi }; if (i === cur) draw(cur);
      } catch (e) { /* the hero keeps the continuous edges and the per-moment curve */ }
    }
  }, "200px");
}

// ---------------------------------------------------------------- strip plate: two starts on the same noise
const W_TIMES = [0, 0.3, 0.45, 1];
function couplingPlate() {
  const fig = plate("coupling"), el = rootOf("coupling");
  if (!el) return;
  const Y1 = 0.05, Y2 = 0.5, T = 2.5;
  let step = +(fig.dataset.step || 0), seed = seedParam(2026) + 76, pair = null, P = null, tRay = 0.3;
  el.innerHTML = `<div class="controls" id="cp-ctl"></div><div class="chart-wrap" id="cp-a"></div><div class="chart-wrap" id="cp-b"></div>
    <ul class="legend" id="cp-key"></ul><dl class="reads" id="cp-reads"></dl><p class="say" id="cp-say" aria-live="polite"></p><p class="fine" id="cp-state"></p>`;
  const ctl = $("#cp-ctl", el), A = $("#cp-a", el), Bc = $("#cp-b", el), key = $("#cp-key", el), reads = $("#cp-reads", el), say = $("#cp-say", el), state = $("#cp-state", el);
  const simulate = () => { pair = M.coupled(Y1, Y2, T, rng(seed), 0.001, 5); };
  const controls = () => {
    if (step <= 1) {
      ctl.innerHTML = `<div class="actions"><button class="btn" type="button" id="cp-new">New noise</button></div>`;
      $("#cp-new", el).addEventListener("click", () => { seed += 1; simulate(); draw(); });
    } else if (step === 3) {
      ctl.innerHTML = `<label class="dial"><span class="ctl-key">Time t</span><output id="cp-out">${tRay.toFixed(2)}</output><input type="range" id="cp-t" min="0" max="2.5" step="0.01" value="${tRay}" aria-label="Time t"></label>`;
      $("#cp-t", el).addEventListener("input", (e) => { tRay = +e.target.value; $("#cp-out", el).textContent = tRay.toFixed(2); draw(); });
    } else ctl.innerHTML = "";
  };
  const drawPaths = () => {
    const { t, Y1: a, Y2: b, L1, L2, met } = pair;
    const both = step === 1;
    const yTop = Math.max(1, ...(both ? b : a)) * 1.08;
    const f = frame(A, { x: [0, T], y: [0, yTop], aspect: 0.44, minH: 170, maxH: 250 });
    let s = axes(f, { yl: "evidence, Y", grid: true });
    if (both) s += line(f, t, b, "ex-thin");
    s += line(f, t, a, "ex");
    if (both && Number.isFinite(met)) s += vline(f, met, "dim", 'stroke-dasharray="2 3"') + text(f.sx(met) + 4, f.t + 10, "paths meet", "tk");
    A.innerHTML = svg(f, s, both ? "Two paths of the evidence from 0.05 and 0.5, driven by the same noise and reflected at 0" : "One path of the evidence from 0.05, reflected at 0");
    const lt = Math.max(0.2, ...L1) * 1.1;
    const g = frame(Bc, { x: [0, T], y: [0, lt], aspect: 0.3, minH: 120, maxH: 170 });
    let h = axes(g, { yl: "local time at 0, ℓ", xl: "time", grid: true });
    if (both) h += line(g, t, L2.map((v) => Math.max(0, v)), "ex-thin");
    h += line(g, t, L1.map((v) => Math.max(0, v)), "ex");
    h += tags(g, [{ y: Math.max(0, L1[L1.length - 1]), text: "ℓ¹", cls: "tag-ex" }, ...(both ? [{ y: Math.max(0, L2[L2.length - 1]), text: "ℓ²", cls: "tag-ex" }] : [])]);
    Bc.innerHTML = svg(g, h, "The local time each path has collected at 0, against time");
    Bc.hidden = false;
    key.innerHTML = both ? `<li><span class="key key-ex">Lower start, y₁ = 0.05</span></li><li><span class="key key-ex-thin">Upper start, y₂ = 0.5</span></li>` : `<li><span class="key key-ex">One path from y₁ = 0.05</span></li>`;
    const l1 = Math.max(0, L1[L1.length - 1]), l2 = Math.max(0, L2[L2.length - 1]);
    reads.innerHTML = `<div><dt>ℓ¹ at time ${T}</dt><dd>${fmt(l1, 2)}</dd></div>` + (both ? `<div><dt>ℓ² at time ${T}</dt><dd>${fmt(l2, 2)}</dd></div><div><dt>Paths meet</dt><dd>${Number.isFinite(met) ? fmt(met, 2) : "–"}<small>${Number.isFinite(met) ? "and move as one after" : "not by time " + T}</small></dd></div>` : `<div><dt>Push at 0 to the reward</dt><dd>${fmt(l1 / 2, 2)}<small>½ℓ, at the rate g′(0) = ½</small></dd></div>`);
    say.textContent = S.couplingSay(step, l1, l2, met, T);
    state.textContent = `Seed ${seed}; Euler steps of 0.001 time units.`;
  };
  const drawWait = () => {
    Bc.hidden = true; Bc.innerHTML = "";
    if (!P) { A.innerHTML = `<p class="fine">Solving the dynamic program for Figure 1(a)…</p>`; return; }
    const ys = range(0, 1.4, 141);
    const rows = W_TIMES.map((t) => { const k = Math.round(t / P.dt); return { t, k, b: P.bounds[k], w: ys.map((y) => Math.max(0, M.waitValue(P, k, y))) }; });
    const top = Math.max(...rows[0].w) * 1.12;
    const f = frame(A, { x: [0, 1.4], y: [0, top], aspect: 0.56, minH: 200, maxH: 280 });
    let s = axes(f, { yl: "value of waiting, V − g", xl: "evidence, y", grid: true });
    rows.forEach((r, i) => { s += line(f, ys, r.w, i === 0 ? "ex" : "ex-thin") + dot(f, r.b, 0, "ink-dot", 3.5); });
    [...rows].sort((a, b) => a.b - b.b).forEach((r, j) => { s += text(f.sx(r.b), f.sy(0) - 9 - (j % 2) * 14, `t = ${r.t}`, "tag-ex", "middle"); });
    A.innerHTML = svg(f, s, "The value of waiting against the evidence at four times on Figure 1(a), each reaching 0 at that time's bound");
    key.innerHTML = `<li><span class="key key-ex">V − g at time 0</span></li><li><span class="key key-ex-thin">At times 0.3, 0.45, and 1</span></li>`;
    reads.innerHTML = rows.map((r) => `<div><dt>Bound at t = ${r.t}</dt><dd>${fmt(r.b, 3)}</dd></div>`).join("");
    say.textContent = S.waitSay(rows);
    state.textContent = "Figure 1(a), time step 0.01, evidence step 0.02, 6 time units past the window.";
  };
  const drawRay = () => {
    Bc.hidden = true; Bc.innerHTML = "";
    if (!P) { A.innerHTML = `<p class="fine">Solving the dynamic program for Figure 1(a)…</p>`; return; }
    const k = Math.round(VIEW / P.dt), xs = Array.from({ length: k + 1 }, (_, j) => j * P.dt), bs = Array.from(P.bounds.subarray(0, k + 1));
    const top = 1.5;
    const f = frame(A, { x: [0, VIEW], y: [0, top], aspect: 0.56, minH: 200, maxH: 280 });
    let s = axes(f, { yl: "evidence, y", xl: "time", grid: true });
    s += bandPath(f, xs, bs, top, "stop-fill") + line(f, xs, bs, "ex");
    s += text(f.sx(1.6), f.sy(0.9), "stop", "lab") + text(f.sx(0.06), f.sy(0.3), "wait", "lab");
    const kt = Math.round(tRay / P.dt), bt = P.bounds[kt];
    s += `<path class="ray" d="M${f.sx(tRay).toFixed(1)} ${f.sy(bt).toFixed(1)}V${f.t}"/>` + dot(f, tRay, bt, "acc-dot", 4.5);
    s += text(f.sx(tRay) + (tRay > 1.9 ? -6 : 6), f.sy(Math.min(top * 0.92, bt + 0.25)), `[b(t), ∞)`, "tag-acc", tRay > 1.9 ? "end" : "start");
    A.innerHTML = svg(f, s, `The set where stopping is best on Figure 1(a): everything at or above the bound, with the ray at time ${tRay.toFixed(2)}`);
    key.innerHTML = `<li><span class="key key-ex">Best bound b(t)</span></li><li><span class="key key-acc">Stopping set at the time on show</span></li>`;
    reads.innerHTML = `<div class="k-acc"><dt>b(t) at t = ${tRay.toFixed(2)}</dt><dd>${fmt(bt, 3)}</dd></div><div><dt>Cost now</dt><dd>${S.c2(FIG1A_COST(tRay))}</dd></div>`;
    say.textContent = S.raySay(tRay, bt);
    state.textContent = "Figure 1(a), time step 0.01, evidence step 0.02, 6 time units past the window.";
  };
  const draw = () => { if (step <= 1) drawPaths(); else if (step === 2) drawWait(); else drawRay(); liftReady(fig); };
  simulate();
  fig.addEventListener("strip-step", (e) => { step = e.detail; controls(); draw(); });
  controls();
  keepDrawn(A, draw);
  bounds(FIG1A_SPEC, W_TIMES.map((t) => Math.round(t / M.DT))).then((m) => { P = m; if (step >= 2) draw(); }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
}

// ---------------------------------------------------------------- plate: where does the best bound run?
function bandPlate() {
  const fig = plate("band"), el = rootOf("band");
  if (!el) return;
  const N = 51;
  let choice = getChoice(), cost, view, dl, ext, kind, sketch, drew, shown = false, data = null, flats = null, yTop = 1;
  el.innerHTML = `<div class="controls">${pickerHTML("bd-pick")}
      <div class="actions"><button class="btn btn-go" type="button" id="bd-show">Show me</button><button class="btn" type="button" id="bd-clear">Clear</button></div></div>
    <p class="fine" id="bd-note"></p>
    <div class="chart-wrap" id="bd-cost"></div><div class="chart-wrap pad is-draw" id="bd-chart"></div>
    <ul class="legend" id="bd-key"></ul>
    <dl class="reads" id="bd-reads"></dl><p class="say" id="bd-say" aria-live="polite"></p><p class="fine" id="bd-state" aria-live="polite"></p>`;
  const pick = $("#bd-pick", el), note = $("#bd-note", el), costEl = $("#bd-cost", el), chart = $("#bd-chart", el);
  const key = $("#bd-key", el), reads = $("#bd-reads", el), say = $("#bd-say", el), state = $("#bd-state", el);
  const xs = range(0, 1, N);
  const hasBand = () => kind === "ok" || kind === "constant";
  const pmAt = (t) => (dl !== null && t >= dl - 1e-9 ? 0 : M.flatOnGrid(cost(t)));
  const series = () => {
    const k = Math.round(view / data.dt), ts = Array.from({ length: k + 1 }, (_, j) => j * data.dt);
    const cut = (P) => (P ? Array.from(P.bounds.subarray(0, k + 1)) : null);
    return { ts, bs: cut(data), pm: ts.map(pmAt), up: cut(flats?.lo), dn: cut(flats?.hi) };
  };
  const stateLine = () => {
    const sub = data && (Array.from(data.bounds).some((v) => v > 0 && v < M.H) || (flats && flats.hi.bounds[0] < M.H));
    const base = dl !== null ? "Time step 0.01, evidence step 0.02, a forced choice at the deadline; the dashed curve is B(c(t)) moved in by 0.5826√0.01, the leading term of the monitoring shift."
      : `Time step 0.01, evidence step 0.02, 6 time units past the window. ${hasBand() ? "The gray band lies between the same program's bounds for the constant costs c_min and c_max, on the same grid and horizon (not flat: they bend down toward the forced choice), drawn at least 1.5 px wide so it shows when the two are equal; the dashed lines are B(c_min) and B(c_max), and the" : "The"} dashed curve is B(c(t)), moved in by 0.5826√0.01, the leading term of the monitoring shift.`;
    return base + (sub ? " Below the grid's first step, 0.02, the page places a bound between the center and that step, where its program still waits at the center; the paper's code reports 0 there." : "");
  };
  const reset = () => {
    cost = costOf(choice); kind = kindOf(choice); dl = deadlineOf(choice); view = dl ?? VIEW;
    ext = M.extremes(cost);
    pick.value = choice.id;
    yTop = M.flatOnGrid(ext.lo) * 1.12 + 0.05;
    sketch = new Array(N).fill(NaN); drew = false; shown = false; data = null; flats = null; reads.innerHTML = "";
    note.textContent = kind === "ok" ? S.extremesNote(labelOf(choice), ext.lo, ext.tLo, ext.hi, ext.tHi, view) : S.outsideNote(kind);
    say.textContent = "Drag across the lower chart to draw where you think the best bound runs, then press Show me.";
    state.textContent = "Solving the dynamic program…";
    const mine = choice, jobs = [bounds(specOf(choice))];
    if (hasBand()) jobs.push(bounds({ kind: "const", c: ext.lo }), bounds({ kind: "const", c: ext.hi }));
    Promise.all(jobs).then(([m, lo, hi]) => {
      if (mine !== choice) return;
      data = m; flats = hasBand() ? { lo, hi } : null; state.textContent = stateLine();
      if (shown) reveal();
    }).catch((e) => { if (mine === choice) state.textContent = "The solver stopped: " + e.message; });
    drawAll();
  };
  const drawCost = () => costStrip(costEl, cost, view, { ext: hasBand() ? ext : null });
  const drawBound = () => {
    const f = frame(chart, { x: [0, view], y: [0, yTop], aspect: 0.5, minH: 200, maxH: 300 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    const ts = range(0, view, 251);
    const upC = M.flatOnGrid(ext.lo), dnC = M.flatOnGrid(ext.hi);
    if (shown && hasBand()) {
      if (data && flats) { const sr = series(); s += bandPath(f, sr.ts, sr.dn, sr.up.map((v, i) => Math.max(v, sr.dn[i] + f.iy(f.sy(0) - 1.5))), "band-gray"); }
      s += hline(f, upC, "guide") + hline(f, dnC, "guide");
      s += kind === "constant" ? text(f.W - f.r - 4, f.sy(upC) - 5, `B(c) = B(${S.c2(ext.lo)})`, "tk-halo", "end") : edgeLabels(f, upC, dnC, `B(c_min) = B(${S.cLo(ext.lo)})`, `B(c_max) = B(${S.cHi(ext.hi)})`);
    }
    s += line(f, ...dropAt(ts, ts.map(pmAt), dl), "pm");
    if (drew) s += line(f, xs.map((u) => u * view), sketch, "sketch");
    if (shown && data) { const { ts: tt, bs } = series(); s += line(f, ...dropAt(tt, bs, dl), "ex"); }
    if (!drew && !shown) s += text((f.l + f.W - f.r) / 2, f.sy(yTop * 0.55), "drag here to draw your guess", "tag-acc", "middle");
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    const what = hasBand() ? ", inside the band of the same program's bounds for the constant costs c_min and c_max, beside the per-moment bound" : ", beside the per-moment bound";
    chart.innerHTML = svg(f, s, shown ? `The best bound for ${labelOf(choice)}${what}` : `The per-moment bound for ${labelOf(choice)}, and your drawing`);
    chart._f = f;
    key.innerHTML = `<li><span class="key key-pm">Per-moment B(c(t))</span></li>${drew ? `<li><span class="key key-acc">Your guess</span></li>` : ""}${shown ? `<li><span class="key key-ex">Best bound</span></li>${hasBand() ? `<li><span class="key key-band">Band: constant-cost bounds, c_max to c_min</span></li><li><span class="key key-guide">B(c_max), B(c_min) moved in</span></li>` : ""}` : ""}`;
  };
  const drawAll = () => { drawCost(); drawBound(); };
  const reveal = () => {
    shown = true; drawBound();
    if (!data) { say.textContent = "Solving the best bound…"; return; }
    const { ts, bs, pm, up, dn } = series();
    // the drawing against the bound, and against the band on the grid, where it was drawn
    let miss = 0, cnt = 0, out = 0;
    xs.forEach((u, i) => {
      if (!Number.isFinite(sketch[i])) return;
      const k = Math.min(bs.length - 1, Math.round((u * view) / data.dt));
      miss += Math.abs(sketch[i] - bs[k]); cnt++;
      if (up && (sketch[i] > up[k] + 0.002 || sketch[i] < dn[k] - 0.002)) out++;
    });
    const verdict = S.sketchVerdict(drew && cnt > 0, cnt ? miss / cnt : NaN, cnt ? out / cnt : 0, hasBand());
    if (hasBand()) {
      const st = M.bandStats(ts, bs, up, dn, M.flatOnGrid(ext.lo), M.flatOnGrid(ext.hi), pm);
      reads.innerHTML = `<div><dt>Band on the grid</dt><dd>${fmt(st.dn, 3)} to ${fmt(st.up, 3)}<small>the constant-cost programs' bounds at time 0</small></dd></div>
        <div><dt>Closest to the lower edge</dt><dd>${fmt(st.gapDn, 3)}<small>at time ${fmt(st.atDn, 2)}</small></dd></div>
        <div><dt>Closest to the upper edge</dt><dd>${fmt(st.gapUp, 3)}<small>at time ${fmt(st.atUp, 2)}</small></dd></div>
        <div><dt>Continuous edges, moved in</dt><dd>${fmt(st.shiftGap, 3)}<small>largest distance from the band's edges</small></dd></div>
        <div class="k-pm"><dt>Below the per-moment bound</dt><dd>${Math.round(st.below * 100)}%<small>of the checks, by more than 0.002; above it at ${Math.round(st.above * 100)}%</small></dd></div>`;
      say.textContent = (kind === "constant" ? S.outsideNote("constant") + " " : "") + S.bandSay(st) + " " + verdict;
    } else {
      reads.innerHTML = `<div><dt>Best bound over the window</dt><dd>${fmt(Math.min(...bs), 2)} to ${fmt(Math.max(...bs), 2)}</dd></div>`;
      say.textContent = S.noBandSay(Math.min(...bs), Math.max(...bs)) + " " + verdict;
    }
    liftReady(fig);
  };
  let down = false, last = null;
  const setAt = (e) => {
    const f = chart._f, r = chart.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * f.W, py = ((e.clientY - r.top) / r.height) * f.H;
    const i = Math.max(0, Math.min(N - 1, Math.round((f.ix(px) / view) * (N - 1))));
    const v = Math.max(0, Math.min(yTop, f.iy(py)));
    if (last && last.i !== i) { const a = Math.min(last.i, i), b = Math.max(last.i, i); for (let j = a; j <= b; j++) sketch[j] = last.v + ((v - last.v) * (j - last.i)) / (i - last.i); }
    sketch[i] = v; last = { i, v }; drew = true;
    if (shown) { shown = false; reads.innerHTML = ""; say.textContent = "Drawing again. Press Show me when you're done."; }
    drawBound();
  };
  chart.addEventListener("pointerdown", (e) => { down = true; last = null; chart.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  chart.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  chart.addEventListener("pointerup", up); chart.addEventListener("pointercancel", up);
  $("#bd-show", el).addEventListener("click", reveal);
  $("#bd-clear", el).addEventListener("click", () => { sketch = new Array(N).fill(NaN); drew = false; shown = false; reads.innerHTML = ""; say.textContent = "Drag across the lower chart to draw your guess, then press Show me."; drawBound(); });
  pick.addEventListener("change", () => setChoice(choiceFromPick(pick.value)));
  window.addEventListener("cc-schedule", () => { if (keyOf(getChoice()) !== keyOf(choice) || !data) { choice = getChoice(); reset(); } });
  reset();
  keepDrawn(costEl, drawCost); keepDrawn(chart, drawBound);
}

// ---------------------------------------------------------------- strip plate: a higher cost, a lower bound
function comparePlate() {
  const fig = plate("compare"), el = rootOf("compare");
  if (!el) return;
  const ext = M.extremes(FIG1A_COST);
  const costs = [() => ext.lo, FIG1A_COST, () => ext.hi];
  const names = ["lowest, c_min", "schedule, c", "highest, c_max"];
  let step = +(fig.dataset.step || 0), progs = null, path = null;
  const seed = seedParam(2026) + 6;
  el.innerHTML = `<div class="chart-wrap" id="cm-chart"></div><ul class="legend" id="cm-key"></ul><dl class="reads" id="cm-reads"></dl><p class="say" id="cm-say" aria-live="polite"></p><p class="fine" id="cm-state" aria-live="polite">Solving three dynamic programs…</p>`;
  const chart = $("#cm-chart", el), key = $("#cm-key", el), reads = $("#cm-reads", el), say = $("#cm-say", el), state = $("#cm-state", el);
  const draw = () => {
    if (!progs) { chart.innerHTML = ""; return; }
    let f, s = "", label = "";
    if (step === 0) {
      const tau = path.tau, X = Math.max(1.2, tau + 0.4);
      f = frame(chart, { x: [0, X], y: [0, ext.hi * 1.12], aspect: 0.56, minH: 200, maxH: 280 });
      s = axes(f, { yl: "cost of time", xl: "time", grid: true });
      const ts = range(0, tau, 120);
      s += `<rect class="box-hi" x="${f.sx(0)}" y="${f.sy(ext.hi).toFixed(1)}" width="${(f.sx(tau) - f.sx(0)).toFixed(1)}" height="${(f.sy(0) - f.sy(ext.hi)).toFixed(1)}"/>`;
      s += area(f, ts, ts.map(FIG1A_COST), 0, "sketch-fill");
      s += `<rect class="box-lo" x="${f.sx(0)}" y="${f.sy(ext.lo).toFixed(1)}" width="${(f.sx(tau) - f.sx(0)).toFixed(1)}" height="${(f.sy(0) - f.sy(ext.lo)).toFixed(1)}"/>`;
      const all = range(0, X, 241);
      s += line(f, all, all.map(FIG1A_COST), "cost") + hline(f, ext.lo, "acc", 'stroke-dasharray="2 3"') + hline(f, ext.hi, "acc", 'stroke-dasharray="2 3"');
      s += vline(f, tau, "ex") + text(f.sx(tau) + 5, f.t + 10, `τ = ${tau.toFixed(2)}`, "tag-ex");
      s += text(f.W - f.r - 2, f.sy(ext.hi) - 5, "c_max", "tag-acc", "end") + text(f.W - f.r - 2, f.sy(ext.lo) - 5, "c_min", "tag-acc", "end");
      label = "One decision's length, and the cost each of the three costs charges for it";
      const paid = [ext.lo * tau, M.integral(FIG1A_COST, 0, tau), ext.hi * tau];
      reads.innerHTML = `<div><dt>This path's τ</dt><dd>${fmt(tau, 2)}</dd></div>` + paid.map((v, i) => `<div class="k-acc"><dt>Charged under ${names[i].split(",")[0]}</dt><dd>${fmt(v, 3)}</dd></div>`).join("");
      key.innerHTML = `<li><span class="key key-cost">Figure 1(a)'s cost c</span></li><li><span class="key key-acc-dash">c_min and c_max</span></li>`;
      say.textContent = S.compareSay(0, { tau, paid });
    } else if (step === 1 || step === 2) {
      const ys = range(0, 1.6, 161);
      const vs = progs.map((P) => ys.map((y) => M.valueAt(P, 0, y)));
      const ws = vs.map((v) => v.map((x, i) => Math.max(0, x - M.g(ys[i]))));
      const bs = progs.map((P) => P.bounds[0]);
      if (step === 1) {
        f = frame(chart, { x: [0, 1.6], y: [0.5, 1], aspect: 0.56, minH: 200, maxH: 280 });
        s = axes(f, { yl: "value at time 0, V(0, y)", xl: "evidence, y", grid: true });
        s += line(f, ys, ys.map(M.g), "dim");
        s += line(f, ys, vs[0], "ex-thin") + line(f, ys, vs[2], "ex-thin") + line(f, ys, vs[1], "ex");
        const at = Math.round(0.3 / 0.01);
        s += text(f.sx(0.3), f.sy(vs[0][at]) - 7, "c_min", "tag-ex", "middle") + text(f.sx(0.3), f.sy(vs[1][at]) - 7, "c", "tag-ex", "middle");
        s += text(f.sx(0.13), f.sy(vs[2][0]) + 4, "c_max", "tag-ex", "start");
        s += text(f.sx(1.25), f.sy(M.g(1.25)) + 15, "g(y)", "tk");
        label = "The value at time 0 against the evidence, under the lowest cost, the schedule, and the highest cost";
        reads.innerHTML = vs.map((v, i) => `<div><dt>V(0, 0), ${names[i].split(",")[0]}</dt><dd>${fmt(v[0], 3)}</dd></div>`).join("");
        say.textContent = S.compareSay(1, { v: vs.map((v) => v[0]) });
      } else {
        f = frame(chart, { x: [0, 1.6], y: [0, Math.max(...ws[0]) * 1.12], aspect: 0.56, minH: 200, maxH: 280 });
        s = axes(f, { yl: "value of waiting, V − g", xl: "evidence, y", grid: true });
        s += line(f, ys, ws[0], "ex-thin") + line(f, ys, ws[2], "ex-thin") + line(f, ys, ws[1], "ex");
        s += bs.map((b) => dot(f, b, 0, "ink-dot", 4)).join("");
        const at = Math.round(0.3 / 0.01);
        s += text(f.sx(0.3), f.sy(ws[0][at]) - 7, "c_min", "tag-ex", "start") + text(f.sx(0.3), f.sy(ws[1][at]) - 7, "c", "tag-ex", "start");
        s += text(f.sx(bs[2]) + 6, f.sy(0) - 8, "c_max", "tag-ex", "start");
        label = "The value of waiting at time 0 under the three costs, with the bound where each reaches 0";
        reads.innerHTML = bs.map((b, i) => `<div><dt>Bound, ${names[i].split(",")[0]}</dt><dd>${fmt(b, 3)}</dd></div>`).join("");
        say.textContent = S.compareSay(2, { b: bs });
      }
      key.innerHTML = `<li><span class="key key-ex">Figure 1(a)'s cost</span></li><li><span class="key key-ex-thin">Constant c_min and c_max</span></li>`;
    } else {
      const P = progs[1], k = Math.round(VIEW / P.dt), xs = Array.from({ length: k + 1 }, (_, j) => j * P.dt), bs = Array.from(P.bounds.subarray(0, k + 1));
      const upC = M.flatOnGrid(ext.lo), dnC = M.flatOnGrid(ext.hi);
      const upG = Array.from(progs[0].bounds.subarray(0, k + 1)), dnG = Array.from(progs[2].bounds.subarray(0, k + 1));
      f = frame(chart, { x: [0, VIEW], y: [0, upC * 1.15], aspect: 0.56, minH: 200, maxH: 280 });
      s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
      s += bandPath(f, xs, dnG, upG, "band-gray") + hline(f, upC, "guide") + hline(f, dnC, "guide");
      s += line(f, xs, bs, "ex");
      s += edgeLabels(f, upC, dnC, "B(c_min)", "B(c_max)");
      label = "The program's bound for Figure 1(a) against time, inside the band of the same program's bounds for the constant costs c_min and c_max";
      const dn = dnG[0], up = upG[0];
      reads.innerHTML = `<div><dt>Band on the grid</dt><dd>${fmt(dn, 3)} to ${fmt(up, 3)}<small>the constant-cost programs' bounds for c_max and c_min</small></dd></div><div><dt>Continuous edges, moved in</dt><dd>${fmt(dnC, 3)} to ${fmt(upC, 3)}<small>B(c_max) and B(c_min), less 0.5826√0.01</small></dd></div><div><dt>Bound over the window</dt><dd>${fmt(Math.min(...bs), 3)} to ${fmt(Math.max(...bs), 3)}</dd></div>`;
      key.innerHTML = `<li><span class="key key-ex">Best bound for Figure 1(a)</span></li><li><span class="key key-band">Band on the grid</span></li><li><span class="key key-guide">Continuous edges, moved in</span></li>`;
      say.textContent = S.compareSay(3, { min: Math.min(...bs), max: Math.max(...bs), dn, up });
    }
    chart.innerHTML = svg(f, s, label);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  Promise.all([{ kind: "const", c: ext.lo }, FIG1A_SPEC, { kind: "const", c: ext.hi }].map((spec) => bounds(spec, [0]))).then((ps) => {
    progs = ps;
    path = M.decisions(ps[1], 0, 0, 1, rng(seed), { keepPaths: 1 }).paths[0];
    state.textContent = `Time step 0.01, evidence step 0.02, 6 time units past the window; the path's seed is ${seed}.`;
    keepDrawn(chart, draw);
  }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
}
// ---------------------------------------------------------------- strip plate: two start times, one rule
function laterPlate() {
  const fig = plate("later"), el = rootOf("later");
  if (!el) return;
  const LO = 0.1, HI = 1.6, AT = 0.5, SPEC = { kind: "step", lo: LO, hi: HI, at: AT }, cost = M.costFrom(SPEC);
  const integral = (_, a, b) => M.stepIntegral(LO, HI, AT, a, b);
  let step = +(fig.dataset.step || 0), t = 0.4, D = 0.05, tau = 0.5, P = null;
  el.innerHTML = `<div class="controls"><label class="dial"><span class="ctl-key">Start time t</span><output id="lt-out"></output>
      <input type="range" id="lt-t" min="0" max="1" step="0.01" value="${t}" aria-label="Start time t"></label>
      ${segHTML("lt-d", [[0.05, "0.05"], [0.1, "0.1"], [0.25, "0.25"]], D, "Later by Δ")}
      ${segHTML("lt-tau", [[0.3, "0.3"], [0.5, "0.5"], [1, "1"]], tau, "Decision lasts τ")}</div>
    <div class="chart-wrap" id="lt-a"></div><div class="chart-wrap" id="lt-b"></div>
    <dl class="reads" id="lt-reads"></dl><p class="say" id="lt-say" aria-live="polite"></p><p class="fine" id="lt-state"></p>`;
  const A = $("#lt-a", el), Bc = $("#lt-b", el), reads = $("#lt-reads", el), say = $("#lt-say", el), out = $("#lt-out", el), state = $("#lt-state", el);
  let X = 1.8;
  const bar = (host, s0, title, ends) => {
    const f = frame(host, { x: [0, X], y: [0, HI * 1.15], aspect: 0.3, minH: 120, maxH: 170 });
    let s = axes(f, { yl: title, grid: true, yt: [LO, HI] });
    const s1 = s0 + tau;
    if (step === 0) s += area(f, range(s0, s1, 120), range(s0, s1, 120).map(cost), 0, "sketch-fill");
    else {
      const mid = [t + D, t + tau];
      if (mid[1] > mid[0]) s += area(f, range(mid[0], mid[1], 120), range(mid[0], mid[1], 120).map(cost), 0, "dim-fill-soft");
      for (const [a, b] of ends) s += area(f, range(a, b, 60), range(a, b, 60).map(cost), 0, "end-fill") + `<path class="acc" d="M${f.sx(a).toFixed(1)} ${f.sy(0)}V${f.sy(cost(a + 1e-9)).toFixed(1)}M${f.sx(b).toFixed(1)} ${f.sy(0)}V${f.sy(cost(b - 1e-9)).toFixed(1)}"/>`;
      if (step === 2) for (const [a, b] of ends) s += `<rect class="box-lo" x="${f.sx(a).toFixed(1)}" y="${f.sy(LO).toFixed(1)}" width="${(f.sx(b) - f.sx(a)).toFixed(1)}" height="${(f.sy(0) - f.sy(LO)).toFixed(1)}"/><rect class="box-hi" x="${f.sx(a).toFixed(1)}" y="${f.sy(HI).toFixed(1)}" width="${(f.sx(b) - f.sx(a)).toFixed(1)}" height="${(f.sy(0) - f.sy(HI)).toFixed(1)}"/>`;
    }
    const all = range(0, X, 361);
    s += line(f, all, all.map(cost), "cost");
    s += `<path class="ex" d="M${f.sx(s0).toFixed(1)} ${f.t + 4}H${f.sx(s1).toFixed(1)}"/>` + dot(f, s0, f.iy(f.t + 4), "ink-dot", 3) + dot(f, s1, f.iy(f.t + 4), "ink-dot", 3);
    host.innerHTML = svg(f, s, `${title}: the decision's span and the cost it pays`);
  };
  const draw = () => {
    out.textContent = t.toFixed(2);
    X = Math.max(1.6, t + D + tau + 0.15);
    const t2 = t + D;
    const A1 = integral(cost, t, t + tau), B1 = integral(cost, t2, t2 + tau);
    const e1 = integral(cost, t, t2), e2 = integral(cost, t + tau, t2 + tau);
    const d = { t, D, tau, A: A1, B: B1, e1, e2, lo: LO, hi: HI };
    if (step <= 2) {
      Bc.hidden = false;
      bar(A, t, "start at t", [[t, t2]]);
      bar(Bc, t2, "start at t′ = t + Δ", [[t + tau, t2 + tau]]);
      if (step === 0) reads.innerHTML = `<div class="k-acc"><dt>Paid from t</dt><dd>${fmt(A1, 3)}</dd></div><div class="k-acc"><dt>Paid from t′</dt><dd>${fmt(B1, 3)}</dd></div>`;
      else if (step === 1) reads.innerHTML = `<div class="k-acc"><dt>End paid only from t</dt><dd>${fmt(e1, 3)}<small>over [${t.toFixed(2)}, ${t2.toFixed(2)}]</small></dd></div><div class="k-acc"><dt>End paid only from t′</dt><dd>${fmt(e2, 3)}<small>over [${(t + tau).toFixed(2)}, ${(t2 + tau).toFixed(2)}]</small></dd></div><div><dt>Difference</dt><dd>${fmt(e2 - e1, 3)}<small>equals ${fmt(B1 - A1, 3)}, the difference in cost</small></dd></div>`;
      else reads.innerHTML = `<div><dt>Each end, at least</dt><dd>${fmt(LO * D, 3)}<small>c_min Δ</small></dd></div><div><dt>Each end, at most</dt><dd>${fmt(HI * D, 3)}<small>c_max Δ</small></dd></div><div class="k-acc"><dt>Cap on the difference</dt><dd>${fmt((HI - LO) * D, 3)}<small>here ${fmt(Math.abs(e2 - e1), 3)}</small></dd></div>`;
      say.textContent = S.laterSay(step, d);
      state.textContent = "The integrals are exact: the cost is 0.1 before time 0.5 and 1.6 from then on.";
    } else {
      Bc.hidden = true; Bc.innerHTML = "";
      if (!P) { A.innerHTML = `<p class="fine">Solving the dynamic program…</p>`; return; }
      const K = 150, ts = Array.from({ length: K + 1 }, (_, k) => k * P.dt), vs = ts.map((_, k) => M.valueAt(P, k, 0));
      const k1 = Math.round(t / P.dt), k2 = Math.round(t2 / P.dt), v1 = vs[k1], v2 = M.valueAt(P, k2, 0);
      const lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo) * 0.2 + 0.01;
      const f = frame(A, { x: [0, 1.5], y: [lo - pad, hi + pad], aspect: 0.56, minH: 200, maxH: 280 });
      let s = axes(f, { yl: "value from evidence 0, V(t, 0)", xl: "start time", grid: true });
      s += vline(f, AT, "dim", 'stroke-dasharray="2 3"') + text(f.sx(AT) + 4, f.H - f.b - 6, "cost jumps", "tk");
      // the lemma's cone from (t, V(t, 0)): every other start time's value lies between its two lines
      const sp = HI - LO, xa = 0, xb = 1.5, Q = (x, y) => `${f.sx(x).toFixed(1)} ${f.sy(y).toFixed(1)}`;
      s += `<clipPath id="lt-clip"><rect x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/></clipPath><g clip-path="url(#lt-clip)">`;
      s += `<path class="acc" d="M${Q(xa, v1 + sp * (t - xa))}L${Q(t, v1)}L${Q(xb, v1 + sp * (xb - t))}M${Q(xa, v1 - sp * (t - xa))}L${Q(t, v1)}L${Q(xb, v1 - sp * (xb - t))}"/></g>`;
      s += line(f, ts, vs, "ex") + dot(f, t, v1, "acc-dot", 4.5) + dot(f, t2, v2, "ink-dot", 4);
      const yl = f.iy(f.t + 12), reach = Math.abs(yl - v1) / sp, right = t + reach < 1.1;
      s += text(f.sx(right ? t + reach + 0.03 : t - reach - 0.03), f.t + 12, "slopes ±1.5", "tag-acc", right ? "start" : "end");
      A.innerHTML = svg(f, s, `The program's value from evidence 0 against the start time, with lines of slope plus and minus 1.5 from time ${t.toFixed(2)}`);
      let slope = 0, at = 0;
      for (let k = 0; k + 1 < 251; k++) { const sl = Math.abs(M.valueAt(P, k + 1, 0) - M.valueAt(P, k, 0)) / P.dt; if (sl > slope) { slope = sl; at = k * P.dt; } }
      Object.assign(d, { dv: Math.abs(v2 - v1), slope, at });
      reads.innerHTML = `<div><dt>|V(t′, 0) − V(t, 0)|</dt><dd>${fmt(d.dv, 3)}</dd></div><div class="k-acc"><dt>Cap, (c_max − c_min)Δ</dt><dd>${fmt((HI - LO) * D, 3)}</dd></div><div><dt>Steepest slope</dt><dd>${fmt(slope, 2)}<small>at time ${fmt(at, 2)}, over 0 to 2.5</small></dd></div>`;
      say.textContent = S.laterSay(3, d);
      state.textContent = "Time step 0.01, evidence step 0.02, 6 time units past the window.";
    }
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  $("#lt-t", el).addEventListener("input", (e) => { t = +e.target.value; draw(); });
  onSeg(el, "lt-d", (v) => { D = +v; draw(); });
  onSeg(el, "lt-tau", (v) => { tau = +v; draw(); });
  keepDrawn(A, draw);
  bounds(SPEC, Array.from({ length: 251 }, (_, k) => k)).then((m) => { P = m; if (step === 3) draw(); }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
}

// ---------------------------------------------------------------- plate: decisions on your schedule
function decidePlate() {
  const fig = plate("decide"), el = rootOf("decide");
  if (!el) return;
  const NRUN = 2000, seed = seedParam(2026);
  let choice = getChoice(), t0 = 0.2, y0 = 0, data = null, guess = NaN, shown = false, xMin = 0, xMax = VIEW;
  el.innerHTML = `<div class="controls">${pickerHTML("dc-pick")}
      <label class="dial"><span class="ctl-key">Start time t</span><output id="dc-tout"></output><input type="range" id="dc-t" min="0" max="2" step="0.05" value="${t0}" aria-label="Start time"></label>
      <label class="dial"><span class="ctl-key">Start evidence y</span><output id="dc-yout"></output><input type="range" id="dc-y" min="0" max="2" step="0.05" value="${y0}" aria-label="Start evidence"></label></div>
    <div class="predict"><p>When will half the decisions from this start have ended? Drag the orange line on the lower chart.</p>
      <div class="actions"><button class="btn btn-go" type="button" id="dc-show">Show me</button><button class="btn" type="button" id="dc-again">Guess again</button></div>
      <p class="verdict" id="dc-verdict" aria-live="polite"></p></div>
    <p class="fine" id="dc-note"></p>
    <div class="chart-wrap" id="dc-cost"></div><div class="chart-wrap pad is-draw" id="dc-chart"></div>
    <ul class="legend" id="dc-key"></ul><dl class="reads" id="dc-reads"></dl><p class="say" id="dc-say" aria-live="polite"></p><p class="fine" id="dc-state" aria-live="polite"></p>`;
  const pick = $("#dc-pick", el), costEl = $("#dc-cost", el), chart = $("#dc-chart", el), key = $("#dc-key", el), reads = $("#dc-reads", el);
  const say = $("#dc-say", el), state = $("#dc-state", el), verdict = $("#dc-verdict", el), note = $("#dc-note", el);
  const tIn = $("#dc-t", el), yIn = $("#dc-y", el);
  const stats = () => {
    const tau = Array.from(data.tau), cost = costOf(choice);
    // a decision forced at a deadline is charged the cost at the deadline itself, which the schedule keeps finite (equal
    // to the rate just before it)
    const ec = mean(tau.map((s) => Math.min(cost(t0 + s), 1e3))), dl = deadlineOf(choice);
    const forced = dl === null ? 0 : tau.filter((s) => t0 + s >= dl - 1e-9).length / tau.length;
    const beyond = tau.filter((s) => t0 + s > xMax + 1e-9).length;
    return { n: tau.length, t0, y0, median: M.quantile(tau, 0.5), mean: mean(tau), se: seOf(tau), ec, c0: cost(t0), atOnce: tau.filter((s) => s === 0).length / tau.length, forced, beyond, xMax };
  };
  const run = () => {
    data = null; drawAll();
    const dl = deadlineOf(choice);
    if (dl !== null && t0 >= dl) { state.textContent = ""; note.textContent = `Your deadline is at time ${dl}; pick a start time before it.`; return; }
    note.textContent = kindOf(choice) === "deadline" || kindOf(choice) === "rising" ? `${labelOf(choice)} is outside the paper's standing assumption; the program's rule is still a stopping rule, and the page samples it, but the paper's results about τ* don't cover it.` : "";
    state.textContent = "Solving the dynamic program and sampling…";
    const mine = [choice, t0, y0];
    solve({ job: "decide", spec: specOf(choice), t0, y0, n: NRUN, seed, keepPaths: 16 }, { key: "decide", worker: WORKER }).then((m) => {
      if (mine[0] !== choice || mine[1] !== t0 || mine[2] !== y0) return;
      data = m;
      const dlv = deadlineOf(choice);
      // the window: from a little before the start to about 2.5 times the flat bound's mean time after it (the bound
      // at the start held fixed), so the range doesn't depend on the sampled decisions
      const b0 = Math.min(m.bounds[m.k0], 5), flatMean = Math.max(0, b0 * Math.tanh(b0) - y0 * Math.tanh(y0));
      const span = Math.min(5, Math.max(0.8, 2.5 * flatMean + 0.4));
      xMin = Math.max(0, Math.floor((t0 - 0.25 * span) * 10) / 10);
      xMax = dlv ?? Math.min(VIEW + SPARE - 0.5, Math.ceil((t0 + span) * 10) / 10);
      if (!Number.isFinite(guess) || guess < t0 || guess > xMax) guess = NaN;
      state.textContent = `${NRUN.toLocaleString("en-US")} decisions with seed ${seed}, checked every 0.01 time units against the program's bound (time step 0.01, evidence step 0.02, ${dlv !== null ? "a forced choice at the deadline" : "6 time units past the window"}).`;
      drawAll();
    }).catch((e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; });
  };
  const drawCost = () => {
    const cost = costOf(choice);
    costStrip(costEl, cost, xMax, { mark: t0, label: "cost, log scale", minH: 96, x0: xMin });
  };
  const drawMain = () => {
    $("#dc-tout", el).textContent = t0.toFixed(2); $("#dc-yout", el).textContent = y0.toFixed(2);
    if (!data) { chart.innerHTML = `<p class="fine">Solving…</p>`; key.innerHTML = ""; reads.innerHTML = ""; return; }
    const k0 = Math.round(xMin / data.dt), k = Math.round(xMax / data.dt), ts = Array.from({ length: k - k0 + 1 }, (_, j) => (k0 + j) * data.dt), bs = Array.from(data.bounds.subarray(k0, k + 1)).map((b) => (Number.isFinite(b) ? b : NaN));
    const top = Math.max(y0, ...bs.filter(Number.isFinite)) * 1.12 + 0.1;
    const f = frame(chart, { x: [xMin, xMax], y: [-top * 0.16, top], aspect: 0.56, minH: 230, maxH: 320 });
    let s = axes(f, { yl: "evidence, Y", xl: "time", grid: true, yt: [0, ...[0.5, 1, 1.5, 2, 2.5].filter((v) => v < top)] });
    const st = stats();
    if (shown) {
      data.paths.forEach((p) => { s += line(f, p.pts.map((q) => t0 + q[0]), p.pts.map((q) => q[1]), "path-dim"); });
      data.paths.forEach((p) => { const q = p.pts[p.pts.length - 1]; s += dot(f, t0 + q[0], q[1], "ink-dot", 2.6); });
      // the moments of decision, counted under the axis; one at the right edge (a deadline) goes in the last bin
      const bw = Math.max(0.01, Math.round((xMax - xMin) / 50 * 100) / 100);
      const { counts } = M.decisionBins(Array.from(data.tau, (v) => t0 + v), xMin, xMax, bw);
      const cMax = Math.max(1, ...counts), base = f.sy(0) + 2, hgt = f.sy(-top * 0.16) - base - 2;
      counts.forEach((c, j) => { if (c) s += `<rect class="hist" x="${(f.sx(xMin + j * bw) + 0.5).toFixed(1)}" y="${(base + hgt * (1 - c / cMax)).toFixed(1)}" width="${Math.max(0.6, f.sx(xMin + bw) - f.sx(xMin) - 1).toFixed(1)}" height="${(hgt * c / cMax).toFixed(1)}"/>`; });
      // the median's label on a second row, on whichever side has room, so it never meets the guess's label
      const med = t0 + st.median, left = med > xMin + 0.55 * (xMax - xMin);
      s += vline(f, med, "ex", 'stroke-dasharray="4 3"') + text(f.sx(med) + (left ? -5 : 5), f.t + 24, "half have ended", "tag-ex", left ? "end" : "start");
    }
    s += line(f, ...dropAt(ts, bs, deadlineOf(choice)), "ex");
    s += dot(f, t0, y0, "acc-dot", 4.5);
    if (Number.isFinite(guess)) {
      const right = guess < xMin + 0.7 * (xMax - xMin);
      s += vline(f, guess, "acc", 'stroke-width="2.2"') + text(f.sx(guess) + (right ? 5 : -5), f.t + (shown ? 10 : 10), "your guess", "tag-acc", right ? "start" : "end");
    } else if (!shown) s += text(f.sx(xMin + 0.62 * (xMax - xMin)), f.t + 10, "drag to guess", "tag-acc", "middle");
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    chart.innerHTML = svg(f, s, shown ? `Decisions from evidence ${y0.toFixed(2)} at time ${t0.toFixed(2)} against the best bound, with the moments of decision counted under the axis` : "The best bound for your schedule, the start, and your guess");
    chart._f = f;
    key.innerHTML = `<li><span class="key key-ex">Best bound b(t)</span></li><li><span class="key key-acc">Your guess</span></li>${shown ? `<li><span class="key key-dim">Paths, each to its decision</span></li>` : ""}`;
    if (shown) {
      reads.innerHTML = `<div><dt>Half have ended by</dt><dd>${fmt(t0 + st.median, 2)}<small>τ* median ${fmt(st.median, 3)}</small></dd></div>
        <div class="k-acc"><dt>Your guess</dt><dd>${fmt(guess, 2)}</dd></div>
        <div><dt>Mean τ*</dt><dd>${fmt(st.mean, 3)}<small>± ${fmt(2 * st.se, 3)} (two standard errors)</small></dd></div>
        <div class="k-acc"><dt>Cost at decision, mean</dt><dd>${S.c2(st.ec)}<small>cost at the start ${S.c2(st.c0)}</small></dd></div>${st.beyond ? `<div><dt>Past the chart</dt><dd>${st.beyond.toLocaleString("en-US")}<small>decisions end after time ${fmt(xMax, 2)}</small></dd></div>` : ""}`;
      say.textContent = S.decideSay(st);
      verdict.textContent = S.decideVerdict(guess, t0 + st.median);
      liftReady(fig);
    } else { reads.innerHTML = ""; say.textContent = ""; }
  };
  const drawAll = () => { drawCost(); drawMain(); };
  let down = false;
  const setAt = (e) => {
    const f = chart._f; if (!f) return;
    const r = chart.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * f.W;
    guess = Math.max(t0, Math.min(xMax, f.ix(px)));
    if (shown) { shown = false; verdict.textContent = "Press Show me when you're ready."; }
    drawMain();
  };
  chart.addEventListener("pointerdown", (e) => { if (!data) return; down = true; chart.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  chart.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  chart.addEventListener("pointerup", up); chart.addEventListener("pointercancel", up);
  $("#dc-show", el).addEventListener("click", () => { shown = true; if (!Number.isFinite(guess)) verdict.textContent = S.decideVerdict(NaN, 0); drawMain(); });
  $("#dc-again", el).addEventListener("click", () => { shown = false; guess = NaN; verdict.textContent = ""; drawMain(); });
  tIn.addEventListener("change", () => { t0 = +tIn.value; run(); });
  tIn.addEventListener("input", () => { $("#dc-tout", el).textContent = (+tIn.value).toFixed(2); });
  yIn.addEventListener("change", () => { y0 = +yIn.value; run(); });
  yIn.addEventListener("input", () => { $("#dc-yout", el).textContent = (+yIn.value).toFixed(2); });
  pick.addEventListener("change", () => setChoice(choiceFromPick(pick.value)));
  window.addEventListener("cc-schedule", () => { if (keyOf(getChoice()) !== keyOf(choice)) { choice = getChoice(); pick.value = choice.id; run(); } });
  pick.value = choice.id;
  keepDrawn(chart, drawMain); keepDrawn(costEl, drawCost);
  run();
}

// ---------------------------------------------------------------- strip plate: cap the gain, then use the theorem
function capPlate() {
  const fig = plate("cap"), el = rootOf("cap");
  if (!el) return;
  const NRUN = 1500, TRACK = 300, seed = seedParam(2026) + 3;
  let step = +(fig.dataset.step || 0), choice = getChoice(), used = null, data = null;
  el.innerHTML = `<p class="fine" id="cap-note"></p><div class="chart-wrap" id="cap-chart"></div><ul class="legend" id="cap-key"></ul>
    <dl class="reads" id="cap-reads"></dl><p class="say" id="cap-say" aria-live="polite"></p><p class="fine" id="cap-state" aria-live="polite"></p>`;
  const note = $("#cap-note", el), chart = $("#cap-chart", el), key = $("#cap-key", el), reads = $("#cap-reads", el), say = $("#cap-say", el), state = $("#cap-state", el);
  const run = () => {
    data = null; draw();
    const k = kindOf(choice);
    used = k === "deadline" || k === "rising" ? FIG1A : choice;
    note.textContent = used === FIG1A && used !== choice ? S.capFallback(labelOf(choice), k) : `${labelOf(used)}, from evidence 0 at time 0.`;
    state.textContent = "Solving the dynamic program and sampling…";
    const mine = used;
    solve({ job: "cap", spec: specOf(used), t0: 0, y0: 0, n: NRUN, seed, track: TRACK, keepPaths: 8 }, { key: "cap", worker: WORKER }).then((m) => {
      if (mine !== used) return;
      data = m;
      state.textContent = `${NRUN.toLocaleString("en-US")} decisions with seed ${seed}, checked every 0.01 time units (time step 0.01, evidence step 0.02, 6 time units past the window).`;
      draw();
    }).catch((e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; });
  };
  const draw = () => {
    if (!data) { chart.innerHTML = `<p class="fine">Solving…</p>`; reads.innerHTML = ""; key.innerHTML = ""; say.textContent = ""; return; }
    const { dt, lo, hi } = data, T = TRACK * dt, bbar = B(lo), exact = bbar * Math.tanh(bbar);
    const tau = Array.from(data.tau), sig = Array.from(data.sigma);
    let f, s = "", label = "";
    if (step === 0) {
      const gs = data.paths.map((p) => p.gain);
      const minG = Math.min(...gs.flat().map((q) => q[2]));
      f = frame(chart, { x: [0, T], y: [Math.min(minG, 1 - lo * T) - 0.05, 1.05], aspect: 0.56, minH: 200, maxH: 280 });
      s = axes(f, { yl: "gain from stopping, G", xl: "time since the start, s", grid: true, zero: true });
      s += line(f, [0, T], [1, 1 - lo * T], "guide") + text(f.W - f.r - 2, f.sy(1 - lo * T) + 14, "1 − c_min s", "tk-halo", "end");
      gs.forEach((g) => { s += line(f, g.map((q) => q[0]), g.map((q) => q[2]), "path-dim"); });
      label = "The gain from stopping along eight paths that are never stopped, under the line one minus the lowest cost times time";
      const maxG = Math.max(...gs.map((g) => g[g.length - 1][2]));
      reads.innerHTML = `<div><dt>Lowest cost, c_min</dt><dd>${S.cLo(lo)}</dd></div><div><dt>Highest gain at s = ${T}</dt><dd>${minus(fmt(maxG, 3))}<small>the line is at ${minus(fmt(1 - lo * T, 3))}</small></dd></div>`;
      key.innerHTML = `<li><span class="key key-dim">G on eight paths, never stopped</span></li>`;
      say.textContent = S.capSay(0, { lo, T, maxG });
    } else if (step === 1) {
      const X = Math.min(VIEW + 1, Math.max(1.5, Math.ceil(M.quantile(sig, 0.9) * 2) / 2));
      const k = Math.round(X / dt), ts = Array.from({ length: k + 1 }, (_, j) => j * dt);
      // the cap the sample uses at each check: the constant-cost program's bound for c_min, on the same horizon
      const bs = Array.from(data.bounds.subarray(0, k + 1)), caps = Array.from(data.cap.subarray(0, k + 1)), cap = caps[0];
      const pathAt = (p, u) => { const q = p.pts.find((r) => Math.abs(r[0] - u) < dt / 2); return q ? q[1] : NaN; };
      const yHi = Math.max(cap, ...data.paths.filter((p) => p.sigma <= X).map((p) => pathAt(p, p.sigma)).filter(Number.isFinite)) * 1.08 + 0.05;
      f = frame(chart, { x: [0, X], y: [0, yHi], aspect: 0.56, minH: 200, maxH: 280 });
      s = axes(f, { yl: "evidence, Y", xl: "time since the start, s", grid: true });
      s += line(f, ts, caps, "guide") + text(f.W - f.r - 2, f.sy(caps[k]) + 14, "cap on the grid", "tk-halo", "end");
      data.paths.forEach((p) => {
        const before = p.pts.filter((q) => q[0] <= Math.min(p.tau, X) + 1e-9), after = p.pts.filter((q) => q[0] >= p.tau - 1e-9 && q[0] <= X + 1e-9);
        s += line(f, before.map((q) => q[0]), before.map((q) => q[1]), "path-dim") + line(f, after.map((q) => q[0]), after.map((q) => q[1]), "path-after");
      });
      s += line(f, ts, bs, "ex");
      data.paths.forEach((p) => {
        if (p.sigma <= X) s += `<circle class="ring" cx="${f.sx(p.sigma).toFixed(1)}" cy="${f.sy(pathAt(p, p.sigma)).toFixed(1)}" r="4"/>`;
        if (p.tau <= X) s += dot(f, p.tau, pathAt(p, p.tau), "ink-dot", 3);
      });
      label = "Eight paths with the bound and the cap, each path's decision time and cap time marked";
      const ok = tau.filter((v, i) => v <= sig[i] + 1e-12).length;
      reads.innerHTML = `<div><dt>τ* ≤ σ</dt><dd>${ok.toLocaleString("en-US")}<small>of ${tau.length.toLocaleString("en-US")} paths</small></dd></div><div><dt>Cap on the grid at s = 0</dt><dd>${fmt(cap, 3)}<small>B(c_min) = ${fmt(bbar, 3)}, less 0.5826√0.01, is ${fmt(M.flatOnGrid(lo), 3)}</small></dd></div><div><dt>Mean τ*</dt><dd>${fmt(mean(tau), 3)}</dd></div><div><dt>Mean σ</dt><dd>${fmt(mean(sig), 3)}</dd></div>`;
      key.innerHTML = `<li><span class="key key-ex">Best bound, and τ*</span></li><li><span class="key key-dim">Paths, to τ*</span></li><li><span class="key key-after">After τ*, to σ</span></li><li><span class="key key-ring">σ, the first check at or above the cap</span></li><li><span class="key key-guide">Cap on the grid</span></li>`;
      say.textContent = S.capSay(1, { ok, n: tau.length, mTau: mean(tau), mSig: mean(sig) });
    } else if (step === 2) {
      const X = Math.max(3, Math.ceil(M.quantile(sig, 0.98)));
      const bw = 0.1, nb = Math.ceil(X / bw), counts = new Array(nb).fill(0);
      for (const v of sig) { const j = Math.floor(v / bw); if (j < nb) counts[j]++; }
      const dens = counts.map((c) => c / sig.length / bw), yTop = Math.max(...dens) * 1.15;
      f = frame(chart, { x: [0, X], y: [0, yTop], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "density of σ", xl: "cap time σ", grid: true });
      dens.forEach((d, j) => { if (d > 0) s += `<rect class="hist" x="${(f.sx(j * bw) + 0.5).toFixed(1)}" y="${f.sy(d).toFixed(1)}" width="${Math.max(0.6, f.sx(bw) - f.sx(0) - 1).toFixed(1)}" height="${(f.sy(0) - f.sy(d)).toFixed(1)}"/>`; });
      const ms = mean(sig);
      s += vline(f, ms, "ex") + vline(f, exact, "acc", 'stroke-dasharray="4 3"');
      s += tags(f, [{ y: yTop * 0.92, text: `sampled mean ${ms.toFixed(2)}`, cls: "tag-ex" }, { y: yTop * 0.92, text: `b̄ tanh b̄ = ${exact.toFixed(2)}`, cls: "tag-acc" }], f.W - f.r - 2);
      label = "The cap times sampled from evidence 0, with their mean beside the closed form";
      reads.innerHTML = `<div><dt>Mean σ on the grid</dt><dd>${fmt(ms, 3)}<small>± ${fmt(2 * seOf(sig), 3)} (two standard errors)</small></dd></div><div class="k-acc"><dt>b̄ tanh b̄ − y tanh y</dt><dd>${fmt(exact, 3)}<small>continuous model; b̄ = B(${S.cLo(lo)}), y = 0</small></dd></div><div><dt>Mean of 1 + c_max σ</dt><dd>${fmt(1 + hi * exact, 2)}<small>continuous model; c_max = ${S.cHi(hi)}</small></dd></div>`;
      key.innerHTML = `<li><span class="key key-ex">Sampled mean, on the grid</span></li><li><span class="key key-acc-dash">The paper's formula: continuous, infinite horizon</span></li>`;
      say.textContent = S.capSay(2, { mSig: ms, seSig: seOf(sig), exact, hi });
    } else {
      const ss = Array.from({ length: TRACK + 1 }, (_, j) => j * dt);
      const one = data.paths[0];
      const oneS = one.gain.map((q) => q[0]).filter((u) => u <= one.tau + 1e-9);
      const vals = [...data.meanM, ...data.meanG, ...one.gain.filter((q) => q[0] <= one.tau + 1e-9).flatMap((q) => [q[1], q[2]])];
      const lo2 = Math.min(...vals), hi2 = Math.max(...vals), pad = (hi2 - lo2) * 0.1 + 0.01;
      const X = Math.min(T, Math.max(1, Math.ceil(M.quantile(tau, 0.99) * 1.3 * 4) / 4));
      f = frame(chart, { x: [0, X], y: [lo2 - pad, hi2 + pad], aspect: 0.56, minH: 200, maxH: 280 });
      s = axes(f, { yl: "mean, stopped at τ*", xl: "time since the start, s", grid: true });
      s += hline(f, data.V0, "guide");
      s += line(f, oneS, one.gain.slice(0, oneS.length).map((q) => q[1]), "ex-thin") + line(f, oneS, one.gain.slice(0, oneS.length).map((q) => q[2]), "path-dim");
      const upto = Math.round(X / dt) + 1;
      s += line(f, ss.slice(0, upto), data.meanG.slice(0, upto), "dim") + line(f, ss.slice(0, upto), data.meanM.slice(0, upto), "ex");
      s += text(f.W - f.r - 2, f.sy(data.V0) - 6, `V(0, 0) = ${data.V0.toFixed(3)}`, "tag-ex", "end");
      label = "The means of the value process and of the gain, both stopped at the decision time, with one path's two curves";
      const drift = Math.max(...data.meanM.map((v) => Math.abs(v - data.V0)));
      const seEnd = data.seM[TRACK];
      reads.innerHTML = `<div><dt>V at the start</dt><dd>${fmt(data.V0, 3)}<small>from the program</small></dd></div><div><dt>Mean value process at s = ${T}</dt><dd>${fmt(data.meanM[TRACK], 3)}<small>± ${fmt(2 * seEnd, 3)}</small></dd></div><div><dt>Mean gain at s = ${T}</dt><dd>${fmt(data.meanG[TRACK], 3)}<small>from ${fmt(data.meanG[0], 3)} at the start</small></dd></div>`;
      key.innerHTML = `<li><span class="key key-ex">Value process, mean</span></li><li><span class="key key-dim">Gain, mean</span></li><li><span class="key key-ex-thin">One path's value process and gain</span></li>`;
      say.textContent = S.capSay(3, { V0: data.V0, drift, T, seEnd, G0: data.meanG[0], Gend: data.meanG[TRACK] });
    }
    chart.innerHTML = svg(f, s, label);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  window.addEventListener("cc-schedule", () => { if (keyOf(getChoice()) !== keyOf(choice)) { choice = getChoice(); run(); } });
  keepDrawn(chart, draw);
  run();
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
for (const [id, fn] of [["coupling", couplingPlate], ["band", bandPlate], ["compare", comparePlate], ["later", laterPlate], ["decide", decidePlate], ["cap", capPlate]]) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { fail(id, e); } });
}
