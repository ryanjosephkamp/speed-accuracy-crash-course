// Chapter 10's plates. The paper's per-schedule results come from ch10-data.js (written by tools/validity/ch10.py from
// the results files at the tag); every summary a plate prints from them is computed here, as the paper's script
// computes it, and held to the paper's tables by tools/checks/ch10.mjs. What the page solves itself (a tapped schedule,
// the reader's schedule, Table 9's shape on the page's grid) runs in ch10-worker.js with ch10-model.js. The words under
// each plate come from say-ch10.js.
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, defaultDrawing } from "./schedules-book.js?v=0648557a87";
import { getChoice, setChoice, solve, onVisible, liftReady } from "./book.js?v=0648557a87";
import { frame, line, axes, svg, keepDrawn } from "./chart.js?v=0648557a87";
import { rng } from "./kernel.js?v=0648557a87";
import * as M from "./ch10-model.js?v=0648557a87";
import * as S from "./say-ch10.js?v=0648557a87";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const P = (v) => v.toFixed(1);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const txt = (x, y, s, cls = "tk", anchor = "start") => `<text class="${cls}" x="${P(x)}" y="${P(y)}" text-anchor="${anchor}">${s}</text>`;
const failText = (e) => `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`;
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const pow10 = (e) => (e === 0 ? "1" : e === 1 ? "10" : e === -1 ? "0.1" : e === -2 ? "0.01" : e === -3 ? "0.001" : "10" + String(e).split("").map((c) => SUP[c]).join(""));
const tick3 = (v) => String(+v.toPrecision(3));

// ---- the paper's data, loaded once when a plate first needs it ----------------------------------------------------------
let DATA_P = null;
const data = () => (DATA_P ||= import("./ch10-data.js?v=0648557a87").then((m) => m.default));

// ---- the page's own runs, in chapter 10's worker -----------------------------------------------------------------------
const WORKER = new URL("./ch10-worker.js?v=0648557a87", import.meta.url);
const RUNS = new Map();
/** The program and the seven rules on the reader's schedule, once per schedule, shared by every plate that shows it. */
function yoursFor(choice, onProgress) {
  const key = JSON.stringify(choice);
  let e = RUNS.get(key);
  if (!e) {
    e = { listeners: new Set(), done: 0 };
    e.promise = solve({ job: "yours", choice }, { worker: WORKER, progress: (p) => { e.done = p; e.listeners.forEach((f) => f(p)); } });
    e.promise.catch(() => RUNS.delete(key));
    RUNS.set(key, e);
    if (RUNS.size > 6) RUNS.delete(RUNS.keys().next().value);
  }
  if (onProgress) { e.listeners.add(onProgress); onProgress(e.done); }
  return e.promise;
}
const onSchedule = (fn) => window.addEventListener("cc-schedule", (e) => fn(e.detail || getChoice()));
/** A schedule whose cost doesn't change over the run (the Constant preset, a flat drawing, Smooth at size 0). */
function isFlat(choice) {
  if (deadlineOf(choice) !== null) return false;
  const cost = costOf(choice), c0 = cost(0);
  for (let t = 0; t <= M.HORIZON + 1e-9; t += 0.01) if (Math.abs(cost(t) - c0) > 1e-12 * c0) return false;
  return true;
}
const untilOf = (r) => (r.deadline !== null && r.deadline < 4 ? "the deadline" : "4");

// the reader's schedule picker (shared through setChoice and the cc-schedule event)
const GROUPS = [...new Set(PRESETS.map((p) => p.group))];
const pickerHTML = (id) => `<label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${GROUPS.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
function wirePicker(sel) {
  sel.value = getChoice().id;
  sel.addEventListener("change", () => {
    let choice;
    if (sel.value === "draw") { const c = getChoice(); choice = c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
    else choice = { id: sel.value, params: paramsOf({ id: sel.value }) };
    setChoice(choice);
  });
}

// ---- marks ---------------------------------------------------------------------------------------------------------
const GROUP_OF = { smooth: "o", pulse: "o", ramp: "o", step: "t", "multi-step": "t", piecewise: "t", deadline: "s" };
function mark(x, y, shape, cls, r = 3.2) {
  if (shape === "t") return `<path class="${cls}" d="M${P(x)} ${P(y - r * 1.15)}L${P(x + r * 1.1)} ${P(y + r * 0.8)}L${P(x - r * 1.1)} ${P(y + r * 0.8)}Z"/>`;
  if (shape === "s") return `<rect class="${cls}" x="${P(x - r * 0.9)}" y="${P(y - r * 0.9)}" width="${P(r * 1.8)}" height="${P(r * 1.8)}"/>`;
  return `<circle class="${cls}" cx="${P(x)}" cy="${P(y)}" r="${r}"/>`;
}
const ring = (x, y, cls = "you", r = 6.5) => `<circle class="${cls}" cx="${P(x)}" cy="${P(y)}" r="${r}"/>`;
/** The nearest of pts ([{x, y, i}] in the svg's pixels) to a pointer event on el, within `within` pixels. */
function nearest(el, e, pts, within = 16) {
  const s = el.querySelector("svg"); if (!s) return null;
  const r = s.getBoundingClientRect(), vb = s.viewBox.baseVal;
  const px = ((e.clientX - r.left) / r.width) * vb.width, py = ((e.clientY - r.top) / r.height) * vb.height;
  let best = null, bd = within * within * (vb.width / r.width) ** 2;
  for (const p of pts) { const d = (p.x - px) ** 2 + (p.y - py) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
/** Log-scale lines y = k x across a log-log frame, clipped to it. */
function ratioLine(f, k, cls) {
  const x0 = Math.max(f.x[0], f.y[0] / k), x1 = Math.min(f.x[1], f.y[1] / k);
  return x1 > x0 ? `<path class="${cls}" d="M${P(f.sx(x0))} ${P(f.sy(k * x0))}L${P(f.sx(x1))} ${P(f.sy(k * x1))}"/>` : "";
}
/** Labels for the lines of equal loss, 10%, and 1%: each in the right margin, beside its line's end. */
const ratioTags = (f) => [[1, "equal"], [0.1, "10%"], [0.01, "1%"]].map(([k, t]) => { const x = Math.min(f.x[1], f.y[1] / k); return txt(f.sx(x) + 4, f.sy(k * x) + 4, t, "tk"); }).join("");
const powTicks = (lo, hi, step = 2) => { const out = []; for (let e = Math.ceil(Math.log10(lo)); e <= Math.floor(Math.log10(hi)); e += step) out.push(10 ** e); return out; };
const powLabel = (v) => pow10(Math.round(Math.log10(v)));

// ---------------------------------------------------------------- the hero: Figure 5, one family at a time
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  data().then((D) => {
    const sum = M.heldSummary(D), steps = [null, ...M.FAMILIES];
    let cur = 0;
    const draw = (i) => {
      cur = i;
      const fam = steps[i];
      const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.66)));
      el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
      const f = { W, H, l: 40, r: 38, t: 18, b: 30, x: [1e-5, 10], y: [1e-5, 10] };
      const lx = (v) => Math.log10(v);
      f.sx = (v) => f.l + ((lx(v) + 5) / 6) * (W - f.l - f.r);
      f.sy = (v) => f.t + (1 - (lx(v) + 5) / 6) * (H - f.t - f.b);
      let s = `<path class="ax" d="M${f.l} ${H - f.b}H${W - f.r}M${f.l} ${f.t}V${H - f.b}"/>`;
      for (const v of [1e-4, 1e-2, 1]) {
        s += txt(f.sx(v), H - f.b + 15, powLabel(v), "tk", "middle") + txt(f.l - 6, f.sy(v) + 3.5, powLabel(v), "tk", "end");
        s += `<path class="grid" d="M${f.l} ${P(f.sy(v))}H${W - f.r}"/>`;
      }
      s += ratioLine(f, 1, "guide-solid") + ratioLine(f, 0.1, "guide") + ratioLine(f, 0.01, "guide");
      s += ratioTags(f);
      const cl = (v) => Math.max(v, 1e-5);
      const on = [], off = [];
      D.held.forEach((r) => { const m = mark(f.sx(cl(r.r[0][0])), f.sy(cl(r.r[1][0])), GROUP_OF[r.f], !fam || r.f === fam ? "pt" : "pt pt-off", 3); (!fam || r.f === fam ? on : off).push(m); });
      s += off.join("") + on.join("");
      s += txt(W - f.r, H - 4, "per-moment loss", "lab", "end") + txt(4, 11, "weighted loss", "lab");
      el.innerHTML = s;
    };
    draw(cur);
    new ResizeObserver(() => draw(cur)).observe(el.parentElement);
    const label = (i) => { const fam = steps[i], x = fam ? sum.byFam[fam] : sum; return S.heroLabel(fam ? M.FAMILY_NAMES[fam] : null, x.med, x.n); };
    if (window.ChapterHero) window.ChapterHero.live(fig, { steps: steps.length, draw, label });
  }).catch((e) => { el.innerHTML = ""; console.error(e); });
}

// ---------------------------------------------------------------- plate: the development schedules
function devPlate() {
  const fig = plate("dev"), el = rootOf("dev");
  if (!el) return;
  el.innerHTML = `<div class="predict"><p>In which family does the weighted rule recover the smallest share of the per-moment rule's total loss?</p>
      ${segHTML("dv-guess", [["smooth", "Smooth"], ["step", "Step"], ["deadline", "Deadline"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="dv-show">Show me</button></div>
      <p class="verdict" id="dv-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="dv-chart"></div>
    <ul class="legend"><li><span class="key key-dot-pm">Per-moment</span></li><li><span class="key key-dot-wb">Weighted look-ahead</span></li><li><span class="key key-ring">Your schedule, page's grid</span></li></ul>
    <p class="fine">Tap a point to draw its schedule below.</p>
    <div class="chart-wrap" id="dv-cost"></div><div class="chart-wrap" id="dv-bounds"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-wb">Weighted look-ahead</span></li></ul>
    <dl class="reads" id="dv-reads"></dl><p class="say" id="dv-say"></p><p class="fine" id="dv-state" aria-live="polite">Loading the paper's results…</p>`;
  const chart = $("#dv-chart", el), costEl = $("#dv-cost", el), boundsEl = $("#dv-bounds", el), reads = $("#dv-reads", el), say = $("#dv-say", el), state = $("#dv-state", el), verdict = $("#dv-verdict", el);
  let D = null, rec = null, shown = false, guess = null, sel = null, tap = null, tapGen = 0, yours = null, yoursGen = 0, pts = [];
  const FAMS = ["smooth", "step", "deadline"];
  const jit = (() => { const R = rng(11); return Array.from({ length: 180 }, () => (R.next() - 0.5) * 0.14); })();
  const FLOOR = 1e-4;
  const drawScatter = () => {
    if (!D) return;
    const f = frame(chart, { x: [-0.5, 3.5], y: [FLOOR / 1.5, 5], ylog: true, aspect: 0.56, minH: 220, maxH: 320, l: 44, b: 34 });
    let s = axes(f, { xt: [], yl: "loss, points per 100 trials", grid: true, yt: [1e-4, 1e-3, 1e-2, 0.1, 1], fy: (v) => powLabel(v) });
    ["Smooth", "Step", "Deadline", "Yours"].forEach((n, j) => { s += txt(f.sx(j), f.H - f.b + 16, n, j === 3 ? "tag-acc" : "tk", "middle"); });
    s += `<path class="dim" stroke-dasharray="1 3" d="M${P(f.sx(2.5))} ${f.t}V${f.H - f.b}"/>`;
    pts = [];
    D.dev.forEach((r, i) => {
      const j = FAMS.indexOf(r.f), x0 = f.sx(j - 0.17 + jit[i]), x1 = f.sx(j + 0.17 + jit[i + 90]);
      const y0 = f.sy(Math.max(r.pm, FLOOR)), y1 = f.sy(Math.max(r.wb, FLOOR));
      if (i === sel && shown) s += `<path class="dim" d="M${P(x0)} ${P(y0)}L${P(x1)} ${P(y1)}"/>`;
      s += `<circle class="pm-dot" cx="${P(x0)}" cy="${P(y0)}" r="3"/>`;
      pts.push({ x: x0, y: y0, i });
      if (shown) { s += `<circle class="wb-dot" cx="${P(x1)}" cy="${P(y1)}" r="3"/>`; pts.push({ x: x1, y: y1, i }); }
    });
    if (sel !== null) {
      const r = D.dev[sel], j = FAMS.indexOf(r.f);
      s += ring(f.sx(j - 0.17 + jit[sel]), f.sy(Math.max(r.pm, FLOOR)), "pick-ring", 6);
      if (shown) s += ring(f.sx(j + 0.17 + jit[sel + 90]), f.sy(Math.max(r.wb, FLOOR)), "pick-ring", 6);
    }
    if (yours) {
      const a = yours.rules.per_moment.loss, b = yours.rules.weighted.loss;
      s += `<circle class="pm-dot" cx="${P(f.sx(2.83))}" cy="${P(f.sy(Math.max(a, FLOOR)))}" r="3.4"/>` + ring(f.sx(2.83), f.sy(Math.max(a, FLOOR)));
      s += `<circle class="wb-dot" cx="${P(f.sx(3.17))}" cy="${P(f.sy(Math.max(b, FLOOR)))}" r="3.4"/>` + ring(f.sx(3.17), f.sy(Math.max(b, FLOOR)));
    } else s += txt(f.sx(3), f.sy(0.01), "solving…", "tk", "middle");
    chart.innerHTML = svg(f, s, "Each development schedule's loss under the per-moment rule and the weighted look-ahead, by family, on a log scale, with your schedule's");
    liftReady(fig);
  };
  const drawTap = () => {
    if (!tap) { costEl.innerHTML = ""; boundsEl.innerHTML = ""; return; }
    const { r: run } = tap, end = run.t[run.t.length - 1];
    const cs = run.cost.filter((c) => c !== null && c > 0);
    const lo = Math.min(...cs), hi = Math.max(...cs);
    const fc = frame(costEl, { x: [0, end], y: [lo / 1.25, hi * 1.25], ylog: true, aspect: 0.22, minH: 96, maxH: 140, t: 18, b: 22 });
    let g = axes(fc, { yl: "cost of time", grid: false, yt: [lo, hi], fy: tick3 });
    g += line(fc, run.t, run.cost.map((c) => (c === null ? NaN : c)), "cost");
    costEl.innerHTML = svg(fc, g, "The tapped schedule's cost of time, on a log scale");
    const all = [...run.exactBound, ...run.rules.per_moment.curve, ...run.rules.weighted.curve].filter((v) => v !== null && Number.isFinite(v));
    const fb = frame(boundsEl, { x: [0, end], y: [0, Math.max(...all) * 1.1 + 0.02], aspect: 0.4, minH: 160, maxH: 240 });
    let h = axes(fb, { yl: "evidence bound", xl: "time", grid: true });
    const nn = (a) => a.map((v) => (v === null ? NaN : v));
    h += line(fb, run.t, nn(run.rules.per_moment.curve), "pm") + line(fb, run.t, nn(run.rules.weighted.curve), "wb") + line(fb, run.t, nn(run.exactBound), "ex");
    boundsEl.innerHTML = svg(fb, h, "The tapped schedule's best bound, per-moment bound, and weighted bound over time");
  };
  const readTap = () => {
    if (sel === null || !D) return;
    const r = D.dev[sel];
    const page = tap && tap.i === sel ? { pm: tap.r.rules.per_moment.loss, wb: tap.r.rules.weighted.loss } : null;
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment, paper's grid</dt><dd>${S.num(r.pm)}<small>${page ? "this page's grid: " + S.num(page.pm) : "this page's grid: solving…"}</small></dd></div>
      <div class="k-wb"><dt>Weighted, paper's grid</dt><dd>${S.num(r.wb)}<small>${page ? "this page's grid: " + S.num(page.wb) : "this page's grid: solving…"}</small></dd></div>
      <div><dt>Best policy's reward</dt><dd>${r.ex.toFixed(3)}<small>paper's grid, per trial</small></dd></div>`;
    say.textContent = page ? S.devTap(M.familyLabel(r.f, r.p), r, page) : M.familyLabel(r.f, r.p) + ".";
  };
  const choose = (i) => {
    sel = i; drawScatter(); readTap();
    const my = ++tapGen, r = D.dev[i];
    state.textContent = "Solving this schedule on the page's grid…";
    solve({ job: "paper", f: r.f, p: r.p }, { worker: WORKER, key: "dev-tap" }).then((m) => {
      if (my !== tapGen) return;
      tap = { i, r: m };
      state.textContent = `Solved in the page: time step ${m.dt}, evidence step ${m.h}, choice forced at t = ${m.deadline === null ? m.horizon : m.deadline.toFixed(2)}; drawn ${m.horizon >= 4 ? "to t = 4" : "to the deadline"}.`;
      drawTap(); readTap();
    }).catch((e) => { if (e.message !== "superseded" && my === tapGen) state.textContent = "The solver stopped: " + e.message; });
  };
  const reveal = () => { shown = true; verdict.textContent = S.devVerdict(guess, rec); drawScatter(); };
  onSeg(el, "dv-guess", (v) => { guess = v; reveal(); });
  $("#dv-show", el).addEventListener("click", reveal);
  chart.addEventListener("click", (e) => { const p = nearest(chart, e, pts); if (p) choose(p.i); });
  const runYours = (choice) => {
    const my = ++yoursGen; yours = null; drawScatter();
    yoursFor(choice).then((m) => { if (my === yoursGen) { yours = m; drawScatter(); } }).catch((e) => { if (my === yoursGen) console.error(e); });
  };
  onSchedule(runYours);
  data().then((d) => {
    D = d; rec = M.devRecovered(D);
    keepDrawn(chart, drawScatter); keepDrawn(boundsEl, drawTap);
    let worst = 0; D.dev.forEach((r, i) => { if (r.wb > D.dev[worst].wb) worst = i; });
    choose(worst);
    runYours(getChoice());
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- plate: the held-out schedules, two losses each
function heldPlate() {
  const fig = plate("held"), el = rootOf("held");
  if (!el) return;
  const FILTERS = [["all", "All"], ...M.FAMILIES.map((f) => [f, M.FAMILY_NAMES[f]])];
  el.innerHTML = `<div class="predict"><p>On a typical held-out schedule, what share of the per-moment rule's loss does the weighted rule avoid?</p>
      <label class="dial"><span class="ctl-key">Your guess</span><output id="ho-gout">50%</output>
      <input type="range" id="ho-guess" min="0" max="100" step="1" value="50" aria-label="Your guess of the share avoided, in percent"></label>
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="ho-show">Show me</button></div>
      <p class="verdict" id="ho-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("ho-fam", FILTERS, "all", "Family")}</div>
    <div class="chart-wrap" id="ho-chart"></div>
    <ul class="legend"><li>● smooth, pulse, ramp</li><li>▲ step, multi-step, piecewise</li><li>■ deadline</li><li><span class="key key-acc-dash">Your guess</span></li><li><span class="key key-wb">Median</span></li><li><span class="key key-ring">Your schedule</span></li></ul>
    <dl class="reads" id="ho-reads"></dl><p class="say" id="ho-say"></p><p class="fine" id="ho-state" aria-live="polite">Loading the paper's results…</p>`;
  const chart = $("#ho-chart", el), reads = $("#ho-reads", el), say = $("#ho-say", el), state = $("#ho-state", el), verdict = $("#ho-verdict", el);
  const gIn = $("#ho-guess", el), gOut = $("#ho-gout", el);
  let D = null, sum = null, shown = false, guess = 0.5, fam = "all", pts = [], yours = null, gen = 0, picked = null;
  const FLOOR = 1e-5;
  const draw = () => {
    if (!D) return;
    const f = frame(chart, { x: [FLOOR, 10], y: [FLOOR, 10], xlog: true, ylog: true, aspect: 0.86, minH: 260, maxH: 420, l: 44, r: 38, b: 34 });
    const tk = [1e-4, 1e-2, 1];
    let s = axes(f, { xt: tk, yt: tk, fx: powLabel, fy: powLabel, xl: "per-moment loss", yl: "weighted loss", grid: true });
    s += ratioLine(f, 1, "guide-solid") + ratioLine(f, 0.1, "guide") + ratioLine(f, 0.01, "guide");
    s += ratioTags(f);
    if (guess !== null) s += ratioLine(f, Math.max(1 - guess, 1e-4), "guess-line");
    pts = [];
    if (shown) {
      s += ratioLine(f, 1 - sum.med, "med-line");
      const on = [], off = [];
      D.held.forEach((r, i) => {
        const x = f.sx(Math.max(r.r[0][0], FLOOR)), y = f.sy(Math.max(r.r[1][0], FLOOR)), hit = fam === "all" || r.f === fam;
        (hit ? on : off).push(mark(x, y, GROUP_OF[r.f], hit ? "pt" : "pt pt-off", 3.1));
        if (hit) pts.push({ x, y, i });
      });
      s += off.join("") + on.join("");
      if (picked !== null) { const r = D.held[picked]; s += ring(f.sx(Math.max(r.r[0][0], FLOOR)), f.sy(Math.max(r.r[1][0], FLOOR)), "pick-ring", 6); }
    } else s += txt(f.l + 8, f.sy(2), "Points appear on Show me", "tk");
    if (yours) s += ring(f.sx(Math.max(yours.rules.per_moment.loss, FLOOR)), f.sy(Math.max(yours.rules.weighted.loss, FLOOR)));
    chart.innerHTML = svg(f, s, "Each held-out schedule's weighted loss against its per-moment loss on log scales, with lines of equal loss, 10%, and 1%");
    liftReady(fig);
  };
  const readOut = () => {
    if (!D) return;
    const x = fam === "all" ? sum : sum.byFam[fam];
    reads.innerHTML = shown ? `<div class="k-wb"><dt>Median avoided</dt><dd>${S.pct(x.med)}<small>${fam === "all" ? "all families" : M.FAMILY_NAMES[fam]}, ${x.n} schedules with a per-moment loss of at least 0.01</small></dd></div>
      <div><dt>10th percentile</dt><dd>${S.pct(x.p10)}<small>computed from the paper's results</small></dd></div>
      ${fam === "all" ? `<div><dt>Minimum</dt><dd>${S.pct(sum.min)}</dd></div>` : ""}` : "";
  };
  const reveal = () => { shown = true; verdict.textContent = S.heldVerdict(guess, sum.med, sum.p10, sum.min, sum.n); draw(); readOut(); };
  gIn.addEventListener("input", () => { guess = +gIn.value / 100; gOut.textContent = gIn.value + "%"; if (shown) verdict.textContent = S.heldVerdict(guess, sum.med, sum.p10, sum.min, sum.n); draw(); });
  $("#ho-show", el).addEventListener("click", reveal);
  onSeg(el, "ho-fam", (v) => { fam = v; draw(); readOut(); });
  chart.addEventListener("click", (e) => {
    const p = nearest(chart, e, pts); if (!p) return;
    picked = p.i; const r = D.held[p.i];
    say.textContent = S.heldTap(M.familyLabel(r.f, r.p), r.r[0][0], r.r[1][0]);
    draw();
  });
  const runYours = (choice) => {
    const my = ++gen; yours = null; draw();
    yoursFor(choice).then((m) => { if (my === gen) { yours = m; draw(); } }).catch(() => {});
  };
  onSchedule(runYours);
  data().then((d) => {
    D = d; sum = M.heldSummary(D);
    state.textContent = `From the paper's results file at ${D.tag}: ${D.held.length} schedules.`;
    keepDrawn(chart, draw); readOut();
    runYours(getChoice());
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- plate: six rules against the per-moment rule
function sevenPlate() {
  const fig = plate("seven"), el = rootOf("seven");
  if (!el) return;
  el.innerHTML = `<div class="chart-wrap" id="sv-chart"></div>
    <ul class="legend"><li>● no deadline (counted)</li><li>□ deadline</li><li><span class="key key-guide">Equal loss</span></li><li><span class="key key-ring">Your schedule, page's grid</span></li></ul>
    <p class="say" id="sv-say"></p><p class="fine" id="sv-state" aria-live="polite">Loading the paper's results…</p>`;
  const chart = $("#sv-chart", el), say = $("#sv-say", el), state = $("#sv-state", el);
  let D = null, yours = null, gen = 0;
  const LO = 1e-5, HI = 50, ks = [1, 2, 3, 4, 5, 6];
  const draw = () => {
    if (!D) return;
    const W = Math.max(280, Math.round(chart.clientWidth || 340)), cols = W < 560 ? 2 : 3, rows = Math.ceil(ks.length / cols);
    const gapX = 14, left = 34, padTop = 34, padBot = 26, cell = (W - left - gapX * (cols - 1) - 4) / cols, ph = Math.round(cell * 0.92);
    const H = rows * (padTop + ph + padBot) + 16;
    const nodl = D.held.filter((r) => r.f !== "deadline");
    let s = "";
    ks.forEach((k, n) => {
      const cx = n % cols, cy = Math.floor(n / cols);
      const x0 = left + cx * (cell + gapX), y0 = cy * (padTop + ph + padBot) + padTop;
      const lg = (v) => (Math.log10(v) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO));
      const f = { x: [LO, HI], y: [LO, HI], sx: (v) => x0 + lg(Math.min(Math.max(v, LO), HI)) * cell, sy: (v) => y0 + ph - lg(Math.min(Math.max(v, LO), HI)) * ph };
      const wl = M.winsLosses(nodl, k);
      s += txt(x0, y0 - 20, M.RULE_NAMES[M.RULES[k]], "lab") + txt(x0, y0 - 7, `${wl.wins} ${wl.wins === 1 ? "win" : "wins"}, ${wl.losses} ${wl.losses === 1 ? "loss" : "losses"}`, "tk");
      s += `<path class="ax" d="M${P(x0)} ${P(y0 + ph)}H${P(x0 + cell)}M${P(x0)} ${P(y0)}V${P(y0 + ph)}"/>`;
      for (const v of [1e-4, 1e-2, 1]) {
        s += `<path class="grid" d="M${P(x0)} ${P(f.sy(v))}H${P(x0 + cell)}"/>`;
        if (cx === 0) s += txt(x0 - 4, f.sy(v) + 3.5, powLabel(v), "tk", "end");
        s += txt(f.sx(v), y0 + ph + 14, powLabel(v), "tk", "middle");
      }
      s += `<path class="guide" d="M${P(f.sx(LO))} ${P(f.sy(LO))}L${P(f.sx(HI))} ${P(f.sy(HI))}"/>`;
      D.held.forEach((r) => { s += mark(f.sx(M.lossOf(r, 0)), f.sy(M.lossOf(r, k)), r.f === "deadline" ? "s" : "o", r.f === "deadline" ? "pt-hollow" : "pt", r.f === "deadline" ? 2.6 : 2.2); });
      if (yours) s += ring(f.sx(yours.rules.per_moment.loss), f.sy(yours.rules[M.RULES[k]].loss), "you", 5.5);
    });
    s += txt(W - 4, H - 2, "across: per-moment loss · up: the rule's loss", "lab", "end");
    const f = { W, H };
    chart.innerHTML = svg(f, s, "Six panels: each held-out schedule's loss under one rule against its loss under the per-moment rule, on log scales");
    liftReady(fig);
  };
  const runYours = (choice) => {
    const my = ++gen; yours = null; draw();
    yoursFor(choice).then((m) => { if (my === gen) { yours = m; draw(); } }).catch(() => {});
  };
  onSchedule(runYours);
  data().then((d) => {
    D = d;
    const nodl = D.held.filter((r) => r.f !== "deadline"), dl = D.held.filter((r) => r.f === "deadline");
    const avgDl = Math.max(...dl.map((r) => M.lossOf(r, 3)));
    say.textContent = `Wins and losses are counted over the ${nodl.length} schedules without a deadline, as Table 6 counts them. On the ${dl.length} deadlines, the averaged-cost rule loses up to ${S.num(avgDl)} points per 100 trials: the squares along the top of its panel.`;
    state.textContent = `From the paper's results file at ${D.tag}; the counts are computed in the page.`;
    keepDrawn(chart, draw);
    runYours(getChoice());
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- plate: seven rules on your schedule
function yoursPlate() {
  const fig = plate("yours"), el = rootOf("yours");
  if (!el) return;
  const PICK = [["weighted_one_pass", "One pass"], ["averaged_cost", "Averaged cost"], ["shift_mean", "Shift by mean"], ["shift_half", "Shift by 0.5"], ["best_constant", "Tuned constant"]];
  let choice = getChoice(), run = null, alt = "averaged_cost", gen = 0;
  el.innerHTML = `<div class="controls">${pickerHTML("yr-pick")}${segHTML("yr-alt", PICK, alt, "Also draw")}</div>
    <p class="fine" id="yr-note"></p>
    <div class="chart-wrap" id="yr-cost"></div><div class="chart-wrap" id="yr-bounds"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-wb">Weighted look-ahead</span></li><li><span class="key key-alt" id="yr-altkey">Averaged cost</span></li></ul>
    <div class="tbl ch10-rules" id="yr-table"></div>
    <p class="say" id="yr-say"></p><p class="fine" id="yr-state" aria-live="polite"></p>`;
  const pick = $("#yr-pick", el), note = $("#yr-note", el), costEl = $("#yr-cost", el), boundsEl = $("#yr-bounds", el), table = $("#yr-table", el), say = $("#yr-say", el), state = $("#yr-state", el), altKey = $("#yr-altkey", el);
  wirePicker(pick);
  const nn = (a) => a.map((v) => (v === null ? NaN : v));
  const draw = () => {
    if (!run) { costEl.innerHTML = ""; boundsEl.innerHTML = ""; return; }
    const end = run.t[run.t.length - 1];
    const cs = run.cost.filter((c) => c !== null && c > 0), lo = Math.min(...cs), hi = Math.max(...cs);
    const flat = hi <= lo * (1 + 1e-9);
    const fc = frame(costEl, { x: [0, end], y: flat ? [lo / 2, lo * 2] : [lo / 1.25, hi * 1.25], ylog: true, aspect: 0.22, minH: 96, maxH: 140, t: 18, b: 22 });
    let g = axes(fc, { yl: "cost of time", yt: flat ? [lo] : [lo, hi], fy: tick3 });
    g += line(fc, run.t, nn(run.cost), "cost");
    if (run.deadline !== null) g += txt(fc.sx(end) - 2, fc.t + 10, "forced choice", "tag-acc", "end");
    costEl.innerHTML = svg(fc, g, `Your schedule's cost of time, ${labelOf(choice)}`);
    const curves = [run.exactBound, run.rules.per_moment.curve, run.rules.weighted.curve, run.rules[alt].curve];
    const all = curves.flat().filter((v) => v !== null && Number.isFinite(v));
    const fb = frame(boundsEl, { x: [0, end], y: [0, Math.min(4.2, Math.max(...all) * 1.1 + 0.02)], aspect: 0.42, minH: 170, maxH: 250 });
    let h = axes(fb, { yl: "evidence bound", xl: "time", grid: true });
    h += line(fb, run.t, nn(run.rules[alt].curve), "alt") + line(fb, run.t, nn(run.rules.per_moment.curve), "pm") + line(fb, run.t, nn(run.rules.weighted.curve), "wb") + line(fb, run.t, nn(run.exactBound), "ex");
    boundsEl.innerHTML = svg(fb, h, `For ${labelOf(choice)}: the best bound, the per-moment and weighted rules, and the ${M.RULE_NAMES[alt]} rule over time`);
    liftReady(fig);
  };
  const fill = () => {
    const pm = run.rules.per_moment.loss, until = untilOf(run);
    const rows = M.RULES.map((k) => {
      const r = run.rules[k];
      const dp = 100 * (r.p - run.exact.p), drt = r.rt - run.exact.rt;
      return `<tr><th scope="row">${M.RULE_NAMES[k]}${k === "best_constant" ? ` <small>(${run.x.toFixed(3)})</small>` : ""}</th><td>${S.num(r.loss)}</td><td>${r.maxDx.toFixed(3)}</td><td>${S.signed(dp, 2)}</td><td>${S.signed(drt, 3)}</td></tr>`;
    }).join("");
    table.innerHTML = `<div class="tbl-scroll" tabindex="0" role="region" aria-label="Seven rules on your schedule"><table><thead><tr><th scope="col">Rule</th><th scope="col">Loss</th><th scope="col">Bound gap</th><th scope="col">Accuracy</th><th scope="col">Time</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="fine">Loss in points per 100 trials; bound gap: the largest before ${until === "4" ? "t = 4" : "the deadline"}, in evidence units; accuracy in percentage points and mean decision time in units of σ²/μ², each against the program. The tuned constant's bound is in parentheses.</p>`;
    say.textContent = S.yoursSay(labelOf(choice), run, M.SAY_NAMES, isFlat(choice));
  };
  const go = () => {
    const my = ++gen;
    run = null; draw(); table.innerHTML = ""; say.textContent = "";
    pick.value = choice.id;
    const dl = deadlineOf(choice);
    note.textContent = isFlat(choice) ? "This cost doesn't change: every rule but the tuned constant gives the per-moment bound, and the losses show what the grid and the forced choice at t = 10 cost on their own."
      : dl !== null ? `A forced choice at time ${dl.toFixed(2)}: the program and the scorer end there, as the paper's do. The averaged-cost rule is drawn as the paper's code computes it.`
        : choice.id === "rising" ? "The rising cost grows without bound; the paper's held-out families don't include one, and the page scores it the same way." : "";
    state.textContent = "Solving the program and seven rules on the page's grid…";
    yoursFor(choice, (p) => { if (my === gen && !run) state.textContent = `Solving the program and seven rules on the page's grid… ${Math.round(p * 100)}%`; }).then((m) => {
      if (my !== gen) return;
      run = m;
      state.textContent = `Computed in the page: time step ${m.dt}, evidence step ${m.h}, bounds capped at ${m.cap}, choice forced at t = ${m.deadline === null ? m.horizon : m.deadline.toFixed(2)}; drawn ${m.horizon >= 4 ? "to t = 4" : "to the deadline"}.`;
      draw(); fill();
    }).catch((e) => { if (my === gen) state.textContent = "The solver stopped: " + e.message; });
  };
  onSeg(el, "yr-alt", (v) => { alt = v; altKey.textContent = PICK.find((p) => p[0] === v)[1]; draw(); });
  onSchedule((c) => { choice = c; go(); });
  keepDrawn(boundsEl, draw);
  go();
}

// ---------------------------------------------------------------- plate: close in reward, wrong in timing
function sharePlate() {
  const fig = plate("share"), el = rootOf("share");
  if (!el) return;
  el.innerHTML = `<div class="predict"><p>On a typical held-out schedule, what share of the reward does the per-moment rule give up?</p>
      <label class="dial"><span class="ctl-key">Your guess</span><output id="sh-gout">1%</output>
      <input type="range" id="sh-guess" min="-4" max="-1" step="0.05" value="-2" aria-label="Your guess of the share of the reward, on a log scale"></label>
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="sh-show">Show me</button></div>
      <p class="verdict" id="sh-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="sh-top"></div>
    <ul class="legend"><li><span class="key key-dot-pm">A held-out schedule</span></li><li><span class="key key-acc-dash">Your guess</span></li><li><span class="key key-wb">Median</span></li><li><span class="key key-ring">Your schedule</span></li></ul>
    <div class="chart-wrap" id="sh-bot"></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment minus best</span></li><li><span class="key key-wb">Weighted minus best</span></li></ul>
    <dl class="reads" id="sh-reads"></dl><p class="say" id="sh-say"></p><p class="fine" id="sh-state" aria-live="polite">Loading the paper's results…</p>`;
  const top = $("#sh-top", el), bot = $("#sh-bot", el), reads = $("#sh-reads", el), say = $("#sh-say", el), state = $("#sh-state", el), verdict = $("#sh-verdict", el);
  const gIn = $("#sh-guess", el), gOut = $("#sh-gout", el);
  let D = null, med = null, shown = false, guess = 0.01, choice = getChoice(), run = null, gen = 0;
  const FLOOR = 1e-6, share = (r) => r.r[0][0] / (100 * r.ex[0]);
  const showPct = (x) => S.pct(x, x < 0.001 ? 3 : x < 0.01 ? 2 : 1);
  const drawTop = () => {
    if (!D) return;
    const xmax = 2.6;
    const f = frame(top, { x: [0, xmax], y: [FLOOR, 0.1], ylog: true, aspect: 0.62, minH: 220, maxH: 320, l: 52, b: 34 });
    const yt = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1];
    const YL = { 1e-6: "0.0001%", 1e-5: "0.001%", 1e-4: "0.01%", 1e-3: "0.1%", 1e-2: "1%", 0.1: "10%" };
    let s = axes(f, { yt, fy: (v) => YL[v], xl: "largest bound gap, evidence units", yl: "share of the reward given up", grid: true });
    if (guess !== null) s += `<path class="guess-line" d="M${f.l} ${P(f.sy(guess))}H${f.W - f.r}"/>`;
    if (shown) {
      s += `<path class="med-line" d="M${f.l} ${P(f.sy(med))}H${f.W - f.r}"/>` + txt(f.W - f.r - 2, f.sy(med) - 5, "median", "tag-wb", "end");
      s += D.held.map((r) => `<circle class="pm-dot" cx="${P(f.sx(Math.min(r.r[0][3], xmax)))}" cy="${P(f.sy(Math.max(share(r), FLOOR)))}" r="2.6"/>`).join("");
    } else s += txt((f.l + f.W - f.r) / 2, f.sy(3e-5), "Points appear on Show me", "tk", "middle");
    if (run) s += ring(f.sx(Math.min(run.rules.per_moment.maxDx, xmax)), f.sy(Math.max(run.rules.per_moment.loss / (100 * run.exact.reward), FLOOR)));
    top.innerHTML = svg(f, s, "Each held-out schedule's per-moment loss as a share of the reward against the per-moment bound's largest gap from the optimal bound");
    liftReady(fig);
  };
  const drawBot = () => {
    if (!run) { bot.innerHTML = ""; return; }
    const end = run.t[run.t.length - 1];
    const d = (a) => a.map((v, i) => (v === null || run.exactBound[i] === null ? NaN : Math.min(v, 4) - Math.min(run.exactBound[i], 4)));
    const dp = d(run.rules.per_moment.curve), dw = d(run.rules.weighted.curve);
    const all = [...dp, ...dw].filter(Number.isFinite), lim = Math.max(0.05, ...all.map(Math.abs)) * 1.15;
    const f = frame(bot, { x: [0, end], y: [-lim, lim], aspect: 0.4, minH: 160, maxH: 230 });
    let s = axes(f, { yl: "bound minus the best bound", xl: "time", grid: true, zero: true });
    s += line(f, run.t, dp, "pm") + line(f, run.t, dw, "wb");
    bot.innerHTML = svg(f, s, `On ${labelOf(choice)}: how far the per-moment and weighted bounds sit from the best bound over time`);
  };
  const readOut = () => {
    const parts = [];
    if (D && shown) {
      const pm = D.held.map((r) => r.r[0][0]);
      parts.push(`<div class="k-wb"><dt>Median share</dt><dd>${S.pct(med, 2)}<small>of the reward, ${D.held.length} held-out schedules</small></dd></div>`);
      parts.push(`<div><dt>Under 0.1 point</dt><dd>${pm.filter((v) => v < 0.1).length}<small>schedules; 1 or more: ${pm.filter((v) => v >= 1).length}</small></dd></div>`);
    }
    if (run) {
      const sh = run.rules.per_moment.loss / (100 * run.exact.reward);
      parts.push(`<div class="k-acc"><dt>Your schedule</dt><dd>${sh >= 0.0001 ? S.pct(sh, 2) : sh > 0 ? "under 0.01%" : "0%"}<small>of the reward, page's grid; largest gap ${run.rules.per_moment.maxDx.toFixed(2)}</small></dd></div>`);
    }
    reads.innerHTML = parts.join("");
    say.textContent = run ? S.shareYours(labelOf(choice), run.rules.per_moment.maxDx, run.rules.per_moment.loss, run.exact.reward, untilOf(run) === "4" ? "t = 4" : "the deadline") : "";
  };
  const setGuess = () => { guess = 10 ** +gIn.value; gOut.textContent = showPct(guess); };
  gIn.addEventListener("input", () => { setGuess(); if (shown) verdict.textContent = S.shareVerdict(guess, med); drawTop(); });
  $("#sh-show", el).addEventListener("click", () => { shown = true; verdict.textContent = S.shareVerdict(guess, med); drawTop(); readOut(); });
  const go = (c) => {
    choice = c; const my = ++gen; run = null; drawTop(); drawBot(); readOut();
    state.textContent = "Solving your schedule on the page's grid…";
    yoursFor(choice).then((m) => { if (my !== gen) return; run = m; state.textContent = `Your schedule: computed in the page, time step ${m.dt}, evidence step ${m.h}, choice forced at t = ${m.deadline === null ? m.horizon : m.deadline.toFixed(2)}.`; drawTop(); drawBot(); readOut(); })
      .catch((e) => { if (my === gen) state.textContent = "The solver stopped: " + e.message; });
  };
  onSchedule(go);
  data().then((d) => {
    D = d; med = M.median(D.held.map(share));
    keepDrawn(top, drawTop); keepDrawn(bot, drawBot);
    go(getChoice());
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- plate: the loss formula, tested
function formulaPlate() {
  const fig = plate("formula"), el = rootOf("formula");
  if (!el) return;
  el.innerHTML = `<p class="conj-flag">Conjecture: the paper does not prove this formula. This is its test.</p>
    <div class="predict"><p>For the 16-fold steps, does the formula over- or underestimate the per-moment rule's loss?</p>
      ${segHTML("fm-guess", [["over", "Over"], ["about", "About right"], ["under", "Under"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="fm-show">Show me</button></div>
      <p class="verdict" id="fm-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="fm-top"></div>
    <ul class="legend"><li><span class="key key-dot-pm">Per-moment</span></li><li><span class="key key-dot-wb">Weighted look-ahead</span></li><li><span class="key key-guide">Agreement</span></li></ul>
    <div class="chart-wrap" id="fm-bot"></div>
    <dl class="reads" id="fm-reads"></dl><p class="say" id="fm-say"></p><p class="fine" id="fm-state" aria-live="polite">Loading the paper's results…</p>`;
  const top = $("#fm-top", el), bot = $("#fm-bot", el), reads = $("#fm-reads", el), say = $("#fm-say", el), state = $("#fm-state", el), verdict = $("#fm-verdict", el);
  let D = null, rows = null, shown = false, guess = null;
  const LAB = (r) => (r.kind === "smooth" ? String(r.size) : `${r.size}×`);
  const axisCats = (f, s) => {
    rows.forEach((r, j) => { s += txt(f.sx(j), f.H - f.b + 15, LAB(r), "tk", "middle"); });
    s += txt(f.sx(1), f.H - 3, "smooth, size", "lab", "middle") + txt(f.sx(4), f.H - 3, "steps, ratio", "lab", "middle");
    if (shown) s += `<path class="dim" stroke-dasharray="1 3" d="M${P(f.sx(2.5))} ${f.t}V${f.H - f.b}"/>`;
    return s;
  };
  const draw = () => {
    if (!rows) return;
    const f = frame(top, { x: [-0.5, 5.5], y: [0.9, 1.65], aspect: 0.5, minH: 190, maxH: 260, b: 36 });
    let s = axes(f, { xt: [], yt: [1, 1.2, 1.4, 1.6], yl: "predicted ÷ scored loss", grid: true });
    s = axisCats(f, s);
    s += `<path class="guide" d="M${f.l} ${P(f.sy(1))}H${f.W - f.r}"/>`;
    if (shown) rows.forEach((r, j) => {
      s += `<circle class="pm-dot" cx="${P(f.sx(j - 0.13))}" cy="${P(f.sy(r.pmPred / r.pmLoss))}" r="4.2"/>`;
      s += `<circle class="wb-dot" cx="${P(f.sx(j + 0.13))}" cy="${P(f.sy(r.wbPred / r.wbLoss))}" r="4.2"/>`;
    });
    else s += txt((f.l + f.W - f.r) / 2, f.sy(1.42), "Ratios appear on Show me", "tk", "middle");
    top.innerHTML = svg(f, s, "The loss formula's prediction over the scored loss for each row of Table 8, for each rule");
    const fb = frame(bot, { x: [-0.5, 5.5], y: [0, 1], aspect: 0.32, minH: 140, maxH: 190, b: 36 });
    let h = axes(fb, { xt: [], yt: [0, 0.5, 1], fy: (v) => `${Math.round(v * 100)}%`, yl: "weighted prediction from t > 8", grid: true });
    h = axisCats(fb, h);
    if (shown) rows.forEach((r, j) => { const v = r.wbLate / r.wbPred, x = fb.sx(j); h += `<rect class="bar-wb" x="${P(x - 9)}" y="${P(fb.sy(v))}" width="18" height="${P(fb.sy(0) - fb.sy(v))}"/>`; });
    bot.innerHTML = svg(fb, h, "The share of the weighted rule's predicted loss that comes from times after t = 8, for each row");
    liftReady(fig);
  };
  const reveal = () => {
    shown = true;
    const pr = rows.map((r) => r.pmPred / r.pmLoss), moderate = pr.slice(0, 5), wr = rows.map((r) => r.wbPred / r.wbLoss);
    verdict.textContent = S.formulaVerdict(guess, pr[5], Math.min(...moderate), Math.max(...moderate));
    const tot = rows.reduce((a, r) => a + r.pmLoss, 0) / rows.reduce((a, r) => a + r.wbLoss, 0);
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment, five rows</dt><dd>${Math.min(...moderate).toFixed(2)}–${Math.max(...moderate).toFixed(2)}<small>predicted ÷ scored</small></dd></div>
      <div class="k-pm"><dt>Per-moment, 16-fold</dt><dd>${pr[5].toFixed(2)}</dd></div>
      <div class="k-wb"><dt>Weighted, all rows</dt><dd>${Math.min(...wr).toFixed(2)}–${Math.max(...wr).toFixed(2)}<small>its total loss is ${tot.toFixed(0)} times smaller</small></dd></div>`;
    say.textContent = S.lateSay(rows[0].wbLate / rows[0].wbPred, rows[3].wbLate / rows[3].wbPred);
    draw();
  };
  onSeg(el, "fm-guess", (v) => { guess = v; reveal(); });
  $("#fm-show", el).addEventListener("click", reveal);
  data().then((d) => {
    D = d; rows = M.formulaRows(D);
    state.textContent = `From the paper's results file at ${D.tag}: ${D.formula.length} schedules, six per row.`;
    keepDrawn(top, draw);
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- plate: how the loss grows
function scalingPlate() {
  const fig = plate("scaling"), el = rootOf("scaling");
  if (!el) return;
  const G = S.GROWTH_CHOICES.map((g) => [g, `${g}×`]);
  el.innerHTML = `<div class="predict"><p>Double the amplitude a. About how many times larger does each rule's loss get?</p>
      ${segHTML("sc-pm", G, "", "Per-moment rule")}${segHTML("sc-wb", G, "", "Weighted look-ahead")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="sc-show">Show me</button></div>
      <p class="verdict" id="sc-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="sc-chart"></div>
    <ul class="legend"><li><span class="key key-dot-pm">Per-moment, paper's grid</span></li><li><span class="key key-dot-wb">Weighted, paper's grid</span></li><li><span class="key key-ring-wb">Weighted, finer grid</span></li><li>× this page's grid</li><li><span class="key key-guide">Slopes 2 and 4</span></li></ul>
    <div class="actions"><button class="btn" type="button" id="sc-run">Run on this page's grid</button></div>
    <dl class="reads" id="sc-reads"></dl><p class="say" id="sc-say"></p><p class="fine" id="sc-state" aria-live="polite">Loading the paper's results…</p>`;
  const chart = $("#sc-chart", el), reads = $("#sc-reads", el), say = $("#sc-say", el), state = $("#sc-state", el), verdict = $("#sc-verdict", el), runBtn = $("#sc-run", el);
  let D = null, ord = null, shown = false, guess = { pm: null, wb: null }, page = null, running = false;
  const LO = 1e-8, HI = 0.3;
  const draw = () => {
    if (!D) return;
    const f = frame(chart, { x: [0.04, 1], y: [LO, HI], xlog: true, ylog: true, aspect: 0.72, minH: 240, maxH: 340, l: 44, b: 34 });
    const A = M.SCALING.amps;
    let s = axes(f, { xt: A, fx: (v) => String(v), yt: [1e-8, 1e-6, 1e-4, 1e-2], fy: powLabel, xl: "amplitude a", yl: "loss, points per 100 trials", grid: true });
    const sc = D.scaling;
    // guides: slope 2 a quarter of the per-moment loss at a = 0.05, slope 4 a quarter of the weighted loss at a = 0.8
    const p0 = sc.rows[0].paper.per_moment / 4, w4 = sc.rows[4].paper.weighted / 4;
    if (shown) {
      s += line(f, [0.04, 1], [p0 * (0.04 / 0.05) ** 2, p0 * (1 / 0.05) ** 2], "guide") + line(f, [0.04, 1], [w4 * (0.04 / 0.8) ** 4, w4 * (1 / 0.8) ** 4], "guide");
      s += txt(f.sx(0.3) + 4, f.sy(p0 * (0.3 / 0.05) ** 2) + 14, "slope 2", "tk") + txt(f.sx(0.5) + 6, f.sy(w4 * (0.5 / 0.8) ** 4) + 14, "slope 4", "tk");
    }
    const foot = (x, cls) => `<path class="${cls}" d="M${P(x - 4)} ${P(f.H - f.b - 9)}L${P(x + 4)} ${P(f.H - f.b - 9)}L${P(x)} ${P(f.H - f.b - 2)}Z"/>` + txt(x, f.H - f.b - 12, "< 0", "tk", "middle");
    const pt = (a, v, cls, dx = 0) => (v > 0 ? `<circle class="${cls}" cx="${P(f.sx(a) + dx)}" cy="${P(f.sy(Math.max(v, LO)))}" r="4"/>` : foot(f.sx(a) + dx, cls));
    if (shown) {
      sc.rows.forEach((r) => { s += pt(r.amplitude, r.paper.per_moment, "pm-dot") + pt(r.amplitude, r.paper.weighted, "wb-dot", -3) + pt(r.amplitude, r.fine.weighted, "wb-ring", 3); });
    } else s += txt((f.l + f.W - f.r) / 2, f.sy(1e-5), "Points appear on Show me", "tk", "middle");
    if (page) {
      const fl = Math.abs(page.find((r) => r.a === 0).pm);
      s += `<path class="dim" stroke-dasharray="1 3" d="M${f.l} ${P(f.sy(fl))}H${f.W - f.r}"/>` + txt(f.l + 4, f.sy(fl) + 13, "this grid, constant cost", "tk");
      const cross = (a, v, cls) => { if (!(v > 0)) return foot(f.sx(a) + 8, cls); const x = f.sx(a) + 8, y = f.sy(v); return `<path class="${cls}" d="M${P(x - 4)} ${P(y - 4)}l8 8M${P(x + 4)} ${P(y - 4)}l-8 8"/>`; };
      page.filter((r) => r.a > 0).forEach((r) => { s += cross(r.a, r.pm, "cross-pm") + cross(r.a, r.wb, "cross-wb"); });
    }
    chart.innerHTML = svg(f, s, "Each rule's loss against the amplitude on log axes, on the paper's two grids, with guide lines of slopes 2 and 4");
    liftReady(fig);
  };
  const reveal = () => {
    shown = true;
    verdict.textContent = S.scalingVerdict(guess, ord.growth, ord);
    const two = D.scaling.rows.find((r) => r.amplitude === 0.2);
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment order</dt><dd>${ord.pm.toFixed(1)}<small>a from 0.05 to 0.4, paper's grid</small></dd></div>
      <div class="k-wb"><dt>Weighted order</dt><dd>${Math.min(ord.wbPaper, ord.wbFine).toFixed(1)}–${Math.max(ord.wbPaper, ord.wbFine).toFixed(1)}<small>a from 0.2 to 0.8, the two grids</small></dd></div>
      <div><dt>Grids at a = 0.2</dt><dd>${Math.round(100 * Math.abs(two.fine.weighted / two.paper.weighted - 1))}%<small>apart on the weighted loss</small></dd></div>`;
    draw();
  };
  onSeg(el, "sc-pm", (v) => { guess.pm = +v; if (shown) verdict.textContent = S.scalingVerdict(guess, ord.growth, ord); });
  onSeg(el, "sc-wb", (v) => { guess.wb = +v; if (shown) verdict.textContent = S.scalingVerdict(guess, ord.growth, ord); });
  $("#sc-show", el).addEventListener("click", reveal);
  runBtn.addEventListener("click", () => {
    if (running || page) return;
    running = true; runBtn.disabled = true;
    state.textContent = "Solving six programs and scoring both rules on the page's grid…";
    solve({ job: "scaling" }, { worker: WORKER, progress: (p) => { state.textContent = `Solving and scoring on the page's grid… ${Math.round(p * 6)} of 6`; } }).then((m) => {
      page = m.rows; running = false;
      if (!shown) reveal();
      state.textContent = `This page's grid: time step ${M.PAGE_GRID.dt}, evidence step ${M.PAGE_GRID.h}, choice forced at t = ${M.HORIZON}.`;
      say.textContent = S.scalingPage(page, D.scaling.rows.map((r) => ({ a: r.amplitude, pm: r.paper.per_moment, wb: r.paper.weighted })));
      draw();
    }).catch((e) => { running = false; runBtn.disabled = false; state.textContent = "The solver stopped: " + e.message; });
  });
  data().then((d) => {
    D = d; ord = M.scalingOrders(D.scaling);
    state.textContent = `From the paper's results file at ${D.tag}.`;
    keepDrawn(chart, draw);
  }).catch((e) => { state.textContent = "The paper's results could not load: " + e.message; });
}

// ---------------------------------------------------------------- start
hero();
const lazy = [["dev", devPlate], ["held", heldPlate], ["seven", sevenPlate], ["yours", yoursPlate], ["share", sharePlate], ["formula", formulaPlate], ["scaling", scalingPlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = failText(e); console.error(e); } }); }
