// Chapter 3's plates: what a decision earns on the reader's schedule, which costs the theory allows, the value of
// waiting from the dynamic program, the flat bound two ways, and how the bound answers a cost. The flat-bound numbers
// come from closed forms and kernel.js's series (ch03-model.js), the value from the dynamic program in ch03-worker.js;
// the words under each plate come from say-ch03.js.
import * as M from "./ch03-model.js";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, VIEW, defaultDrawing } from "./schedules-book.js";
import { getChoice, setChoice, solve, onVisible, liftReady, seedParam, wireStrips } from "./book.js";
import { frame, line, area, axes, svg, fmt, keepDrawn, tags, ticks } from "./chart.js";
import * as S from "./say-ch03.js";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const inRange = (v, lo, hi) => (v >= lo && v <= hi ? v : NaN);
const WORKER = new URL("./ch03-worker.js", import.meta.url);

// ---- the reader's schedule, and the dynamic program's value for it (shared by the plates that need it)
const keyOf = (choice) => JSON.stringify({ id: choice.id, params: choice.id === "draw" ? undefined : paramsOf(choice), points: choice.id === "draw" ? choice.points : undefined });
const VALUES = new Map();
function valueFor(choice, last = "far", progress = null) {
  const k = keyOf(choice) + "|" + last;
  if (!VALUES.has(k)) VALUES.set(k, solve({ job: "value", choice, last }, { worker: WORKER, progress }).catch((e) => { VALUES.delete(k); throw e; }));
  return VALUES.get(k);
}
const FLATS = new Map();
function flatFor(choice) {
  const k = keyOf(choice);
  if (!FLATS.has(k)) FLATS.set(k, solve({ job: "flat", choice }, { worker: WORKER }).catch((e) => { FLATS.delete(k); throw e; }));
  return FLATS.get(k);
}
const pickerHTML = (id) => {
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  return `<label class="dial" style="flex:1 1 13rem"><span class="ctl-key">Your schedule</span><span></span>
    <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
};
const choiceFromPick = (v) => {
  if (v === "draw") { const c = getChoice(); return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
  return { id: v, params: paramsOf({ id: v }) };
};

// ---------------------------------------------------------------- the hero: the reward of a flat bound, peaking at B(c)
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const costs = [0.03, 0.06, 0.1, 0.2, 0.4, 0.8];
  let cur = 2;
  const draw = (i) => {
    cur = i;
    const c = costs[i], bc = M.B(c);
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.64)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 12, r = 12, split = Math.round(H * 0.55);
    const X = 2.4, sx = (b) => l + (b / X) * (W - l - r);
    const t0 = 20, t1 = split - 10, sy = (v) => t1 - (v / 1.02) * (t1 - t0);
    const bs = range(0, X, 121);
    const path = (ys, sY) => { let d = "", pen = false; bs.forEach((b, k) => { const v = ys[k]; if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? "L" : "M") + sx(b).toFixed(1) + " " + sY(v).toFixed(1); pen = true; }); return d; };
    const gs = bs.map(M.g), bill = bs.map((b) => inRange(c * M.meanTime(b), 0, 1.02)), net = bs.map((b) => inRange(M.flatReward(b, c), 0, 1.02));
    let s = `<path class="ax" d="M${l} ${t1}H${W - r}"/>`;
    s += `<path class="dim" d="${path(gs, sy)}"/><path class="cost" d="${path(bill, sy)}"/><path class="ex" d="${path(net, sy)}"/>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${sx(bc).toFixed(1)} ${sy(M.flatReward(bc, c)).toFixed(1)}V${t1}"/>`;
    s += `<circle class="ink-dot" cx="${sx(bc).toFixed(1)}" cy="${sy(M.flatReward(bc, c)).toFixed(1)}" r="4.5"/>`;
    s += `<text class="lab" x="${l}" y="12">chance right − cost of time, for a flat bound b</text>`;
    s += `<text class="tk" x="${W - r}" y="${(sy(gs[gs.length - 1]) - 6).toFixed(1)}" text-anchor="end">g(b)</text>`;
    const kb = bill.findIndex((v, k) => !Number.isFinite(v) || bs[k] > X * 0.92);
    const kBill = Math.max(10, (kb < 0 ? bs.length : kb) - 4);
    s += `<text class="tag-acc" x="${sx(bs[kBill]).toFixed(1)}" y="${(sy(bill[kBill]) - 6).toFixed(1)}" text-anchor="end">bill</text>`;
    s += `<text class="tag-ex" x="${sx(bc).toFixed(1)}" y="${t1 + 13}" text-anchor="middle">${fmt(bc, 2)}</text>`;
    // bottom: B(c) against c
    const C = 0.86, b0 = split + 22, b1 = H - 22, cx = (v) => l + (v / C) * (W - l - r), cy = (v) => b1 - (v / 2.2) * (b1 - b0);
    const cs = range(0.022, C, 140);
    let d = ""; cs.forEach((v, k) => { d += (k ? "L" : "M") + cx(v).toFixed(1) + " " + cy(M.B(v)).toFixed(1); });
    s += `<path class="ax" d="M${l} ${b1}H${W - r}"/><path class="ex-thin" d="${d}"/>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${cx(c).toFixed(1)} ${cy(bc).toFixed(1)}V${b1}"/><circle class="ink-dot" cx="${cx(c).toFixed(1)}" cy="${cy(bc).toFixed(1)}" r="4.5"/>`;
    s += `<circle class="acc-dot" cx="${cx(c).toFixed(1)}" cy="${b1}" r="4"/>`;
    s += `<text class="lab" x="${l}" y="${b0 - 6}">the best flat bound B(c), as the cost c rises</text>`;
    s += `<text class="tk" x="${cx(0)}" y="${H - 6}">0</text><text class="tag-acc" x="${cx(c).toFixed(1)}" y="${H - 6}" text-anchor="${cx(c) > W - 60 ? "end" : "middle"}">c = ${S.fc(c)}</text>`;
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: costs.length, draw, label: (i) => S.heroLabel(costs[i], M.B(costs[i])) });
}

// ---------------------------------------------------------------- plate: what a decision earns
function earnPlate() {
  const fig = plate("earn"), el = rootOf("earn");
  if (!el) return;
  let b = 0.8, seed = seedParam(2026), runs = 0, path = null, cum = null, tTop = 2.5, shown = false;
  let choice, cost, dl, dp = NaN, flat = null, best = null, curve = null;
  el.innerHTML = `<div class="controls"><label class="dial"><span class="ctl-key">Flat bound, b</span><output id="ea-out"></output>
      <input type="range" id="ea-b" min="0.05" max="3" step="0.01" value="${b}" aria-label="Flat bound b"></label>
      <div class="actions"><button class="btn" type="button" id="ea-path">Another path</button></div></div>
    <p class="fine" id="ea-note"></p>
    <div class="chart-wrap pad is-draw" id="ea-x"></div><div class="chart-wrap" id="ea-c"></div>
    <dl class="reads" id="ea-reads"></dl><p class="say" id="ea-say" aria-live="polite"></p>
    <div class="predict" style="margin-top:14px"><p>Move the bound to where you think it earns the most on average, then press Show me.</p>
      <div class="actions"><button class="btn btn-go" type="button" id="ea-show">Show me</button></div>
      <p class="verdict" id="ea-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="ea-curve" hidden></div>
    <ul class="legend" id="ea-key" hidden><li><span class="key key-dim">Chance right</span></li><li><span class="key key-cost">Bill</span></li><li><span class="key key-ex">Net, flat bound</span></li><li><span class="key key-ex-thin">Best time-dependent policy, on the program's grid</span></li></ul>`;
  const xEl = $("#ea-x", el), cEl = $("#ea-c", el), reads = $("#ea-reads", el), say = $("#ea-say", el), out = $("#ea-out", el), inp = $("#ea-b", el);
  const note = $("#ea-note", el), verdict = $("#ea-verdict", el), curveEl = $("#ea-curve", el), key = $("#ea-key", el);
  const newPath = () => {
    path = M.samplePath(seed + 7919 * runs, { tMin: VIEW });
    const k3 = M.decideAt(path, 3);
    tTop = Math.min(8, Math.max(VIEW, (k3 < 0 ? path.x.length : k3) * path.dt * 1.04));
    cum = M.cumulativeCost(dl !== null ? (t) => (t <= dl ? cost(t) : cost(dl)) : cost, path.x.length, path.dt);
  };
  const outcome = () => M.pathOutcome(path, b, cum, dl);
  const drawPath = (o) => {
    const view = dl !== null ? dl * 1.15 : Math.max(tTop, o.off ? tTop : Math.min(o.tau * 1.03, 40));
    const f = frame(xEl, { x: [0, view], y: [-3.15, 3.15], aspect: 0.52, minH: 190, maxH: 280 });
    let s = axes(f, { yl: "evidence, X", xl: "time", grid: true, zero: true, yt: [-3, -2, -1, 0, 1, 2, 3] });
    const n = path.x.length, stride = Math.max(1, Math.round(n / 1400));
    const ts = [], xs = [];
    for (let i = 0; i < n && i * path.dt <= view; i += stride) { ts.push(i * path.dt); xs.push(path.x[i]); }
    const kk = Math.floor(o.k / stride) + 1;
    const cut = (v) => inRange(v, -3.15, 3.15);
    s += line(f, ts.slice(kk - 1), xs.slice(kk - 1).map(cut), "path-dim") + line(f, [...ts.slice(0, kk), o.tau], [...xs.slice(0, kk), path.x[o.k]].map(cut), "dim");
    s += `<path class="acc" d="M${f.l} ${f.sy(b).toFixed(1)}H${f.W - f.r}M${f.l} ${f.sy(-b).toFixed(1)}H${f.W - f.r}"/>`;
    const xl = dl !== null ? f.sx(dl) - 6 : f.W - f.r - 2;
    s += `<text class="tag-acc" x="${xl.toFixed(1)}" y="${(f.sy(b) - 6).toFixed(1)}" text-anchor="end">+b = ${fmt(b, 2)}</text><text class="tag-acc" x="${xl.toFixed(1)}" y="${(f.sy(-b) + 15).toFixed(1)}" text-anchor="end">−b</text>`;
    if (dl !== null) s += `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(dl).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-acc" x="${(f.sx(dl) - 6).toFixed(1)}" y="${f.H - f.b - 6}" text-anchor="end">deadline</text>`;
    if (o.tau <= view && !o.off) s += `<circle class="ink-dot" cx="${f.sx(o.tau).toFixed(1)}" cy="${f.sy(o.x).toFixed(1)}" r="4.5"/>`;
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    xEl.innerHTML = svg(f, s, `One path of the evidence, stopped where it first reaches the flat bound ${fmt(b, 2)}`);
    xEl._f = f;
    return view;
  };
  const drawCost = (o, view) => {
    const ts = range(0, view, 241), cs = ts.map((t) => (dl !== null && t > dl ? NaN : cost(t)));
    const top = Math.max(...cs.filter(Number.isFinite)) * 1.15;
    const f = frame(cEl, { x: [0, view], y: [0, top], aspect: 0.3, minH: 120, maxH: 170 });
    let s = axes(f, { yl: "cost of time, c(t)", xl: "time", grid: true, yt: ticks(0, top / 1.08, 3) });
    const tEnd = Math.min(o.tau, view), tb = ts.filter((t) => t <= tEnd).concat([tEnd]);
    s += area(f, tb, tb.map((t) => cost(Math.min(t, dl ?? Infinity))), 0, "band");
    s += line(f, ts, cs, "cost");
    if (dl !== null) s += `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(dl).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    const lx = f.sx(Math.min(tEnd, view)) + 6;
    s += `<text class="tag-acc" x="${Math.min(lx, f.W - f.r - 2).toFixed(1)}" y="${(f.t + 0.55 * (f.H - f.t - f.b)).toFixed(1)}" text-anchor="${lx > f.W - 60 ? "end" : "start"}">← bill</text>`;
    cEl.innerHTML = svg(f, s, `The cost of time for ${labelOf(choice)}, with the area paid up to the decision shaded`);
  };
  const drawCurve = () => {
    if (!shown) { curveEl.hidden = true; key.hidden = true; return; }
    if (!curve) { curveEl.hidden = true; key.hidden = true; verdict.textContent = "Computing the best flat bound…"; return; }
    curveEl.hidden = false; key.hidden = false;
    const f = frame(curveEl, { x: [0, 3], y: [0, 1.02], aspect: 0.52, minH: 190, maxH: 270 });
    let s = axes(f, { yl: "on average, per decision", xl: "flat bound, b", grid: true });
    s += line(f, curve.b, curve.reward, "dim") + line(f, curve.b, curve.bill.map((v) => inRange(v, 0, 1.02)), "cost") + line(f, curve.b, curve.net.map((v) => inRange(v, 0, 1.02)), "ex");
    if (Number.isFinite(dp)) s += `<path class="ex-thin" d="M${f.l} ${f.sy(dp).toFixed(1)}H${f.W - f.r}"/>`;
    const mine = M.flatOnSchedule(cost, b, dl);
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(best.b).toFixed(1)} ${f.sy(best.net).toFixed(1)}V${f.H - f.b}"/><circle class="ink-dot" cx="${f.sx(best.b).toFixed(1)}" cy="${f.sy(best.net).toFixed(1)}" r="4.5"/>`;
    s += `<circle class="acc-dot" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(mine.net).toFixed(1)}" r="5"/>`;
    s += `<text class="tag-ex" x="${(f.sx(best.b) + (f.sx(best.b) > f.W * 0.6 ? -6 : 6)).toFixed(1)}" y="${f.t + 12}" text-anchor="${f.sx(best.b) > f.W * 0.6 ? "end" : "start"}">best flat ${fmt(best.b, 2)}</text>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(best.b).toFixed(1)} ${f.t}V${f.sy(best.net).toFixed(1)}"/>`;
    curveEl.innerHTML = svg(f, s, "Average chance of being right, bill, and net reward against the flat bound, with the reader's bound and the best");
    verdict.textContent = S.earnVerdict({ b, mine, best, dp, flat, deadline: dl });
  };
  const draw = () => {
    out.textContent = fmt(b, 2);
    const o = outcome();
    const view = drawPath(o);
    drawCost(o, view);
    const avg = M.flatOnSchedule(cost, b, dl);
    reads.innerHTML = `<div><dt>This path</dt><dd>${o.off ? "–" : fmt(o.tau, 2)}<small>${o.off ? "still open" : `${o.forced ? "forced at the deadline" : "time it decides"}; right with chance ${fmt(o.right, 3)}, nets ${fmt(o.right - o.bill, 3)}`}</small></dd></div>
      <div><dt>Average chance right</dt><dd>${fmt(avg.reward, 3)}<small>${dl !== null ? `g(b) = ${fmt(M.g(b), 3)} for decisions at the bound, less for forced ones` : "g(b), checking the evidence continuously"}</small></dd></div>
      <div><dt>Average bill</dt><dd>${fmt(avg.bill, 3)}<small>∫ c(s) P(still open at s) ds</small></dd></div>
      <div class="k-acc"><dt>Average net</dt><dd>${fmt(avg.net, 3)}<small>for your bound</small></dd></div>`;
    say.textContent = o.off ? "This path hasn't reached the bound within 40 time units; press Another path." : S.pathSay(o);
    drawCurve();
    liftReady(fig);
  };
  const reset = () => {
    choice = getChoice(); cost = costOf(choice); dl = deadlineOf(choice); dp = NaN; flat = null;
    best = null; curve = null;
    note.textContent = dl !== null ? `${labelOf(choice)}: the cost is infinite past time ${S.ft(dl)}, so every decision must end by then; a path still open there is forced to choose.`
      : `${labelOf(choice)}: the shaded area is what this path pays for its time.`;
    newPath();
    draw();
    const k = keyOf(choice);
    valueFor(choice, "far").then((m) => { if (keyOf(choice) === k) { dp = m.v00; drawCurve(); } }).catch(() => {});
    flatFor(choice).then((m) => { if (keyOf(choice) === k) { flat = m; best = { b: m.b, net: m.net, reward: m.reward, bill: m.bill }; curve = m.curve; drawCurve(); } })
      .catch((e) => { if (keyOf(choice) === k && shown) verdict.textContent = "The solver stopped: " + e.message; });
  };
  inp.addEventListener("input", () => { b = +inp.value; draw(); });
  let down = false;
  const setAt = (e) => { const f = xEl._f, r = xEl.getBoundingClientRect(); const py = ((e.clientY - r.top) / r.height) * f.H; b = Math.max(0.05, Math.min(3, Math.abs(f.iy(py)))); inp.value = b; draw(); };
  xEl.addEventListener("pointerdown", (e) => { down = true; xEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  xEl.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  xEl.addEventListener("pointerup", up); xEl.addEventListener("pointercancel", up);
  $("#ea-path", el).addEventListener("click", () => { runs++; newPath(); draw(); });
  $("#ea-show", el).addEventListener("click", () => { shown = true; draw(); });
  window.addEventListener("cc-schedule", reset);
  reset();
  keepDrawn(xEl, draw);
}

// ---------------------------------------------------------------- plate: which costs the theory allows
function allowsPlate() {
  const fig = plate("allows"), el = rootOf("allows");
  if (!el) return;
  let choice = getChoice(), tail = "flat";
  el.innerHTML = `<div class="controls">${pickerHTML("al-pick")}</div>
    <div class="controls" id="al-tailbox">${segHTML("al-tail", [["flat", "Held flat"], ["slope", "At its last slope"], ["deadline", "Forced to choose"]], tail, "After time 2.5, your drawing is")}</div>
    <p class="fine" id="al-note"></p>
    <div class="chart-wrap" id="al-chart"></div>
    <dl class="reads" id="al-reads"></dl><p class="say" id="al-say" aria-live="polite"></p>`;
  const pick = $("#al-pick", el), chart = $("#al-chart", el), reads = $("#al-reads", el), say = $("#al-say", el), note = $("#al-note", el), tailBox = $("#al-tailbox", el);
  const draw = () => {
    pick.value = choice.id;
    const isDraw = choice.id === "draw";
    tailBox.hidden = !isDraw;
    const st = M.standing(choice, isDraw ? tail : "flat"), ok = M.holds(st);
    const cost = M.costWithTail(choice, isDraw ? tail : "flat"), T = 10;
    note.textContent = isDraw ? "A drawing stops at time 2.5, so the page asks how it goes on; the book holds it flat."
      : "The schedule's formula sets the cost for all time; the chart shows it to time 10.";
    const ts = range(0, T, 501);
    const dl = st.kind === "deadline" ? st.at : null;
    const cs = ts.map((t) => (dl !== null && t > dl + 1e-9 ? NaN : cost(t)));
    const win = ts.filter((t) => t <= VIEW).map((t) => cost(t)).filter(Number.isFinite);
    const wMin = Math.min(...win), wMax = Math.max(...win);
    const fin = cs.filter((v) => Number.isFinite(v) && v > 0);
    const P = M.printedLevels(st);
    const lo = Math.min(...fin, P.lo > 0 ? P.lo : Infinity), hi = Math.max(...fin, Number.isFinite(P.hi) ? P.hi : 0);
    const yLo = Math.max(lo / 2.2, wMin / 60), yHi = Math.min(Math.max(hi * 2.2, dl !== null ? wMax * 8 : 0), wMax * 60);
    const f = frame(chart, { x: [0, T], y: [yLo, yHi], ylog: true, aspect: 0.5, minH: 190, maxH: 280 });
    let s = axes(f, { yl: "cost of time, c(t)", xl: "time", grid: true });
    s += `<rect class="dim-fill" style="opacity:0.12" x="${f.l}" y="${f.t}" width="${(f.sx(VIEW) - f.l).toFixed(1)}" height="${f.H - f.t - f.b}"/>`;
    s += `<text class="tk" x="${(f.sx(VIEW) + 4).toFixed(1)}" y="${dl !== null ? f.H - f.b - 6 : f.t + 12}">${isDraw ? "the drawing ends" : "the book's window ends"}</text>`;
    if (ok) {
      s += `<rect class="band" x="${f.l}" y="${f.sy(P.hi).toFixed(1)}" width="${f.W - f.l - f.r}" height="${Math.max(1, f.sy(P.lo) - f.sy(P.hi)).toFixed(1)}"/>`;
      s += `<path class="guide" d="M${f.l} ${f.sy(P.hi).toFixed(1)}H${f.W - f.r}M${f.l} ${f.sy(P.lo).toFixed(1)}H${f.W - f.r}"/>`;
      s += `<text class="tag-acc" x="${f.W - f.r - 2}" y="${(f.sy(P.hi) - 5).toFixed(1)}" text-anchor="end">c_max ${S.fc(P.hi)}</text>`;
      s += `<text class="tag-acc" x="${f.W - f.r - 2}" y="${(f.sy(P.lo) + 15).toFixed(1)}" text-anchor="end">c_min ${S.fc(P.lo)}</text>`;
    }
    s += line(f, ts, cs.map((v) => (v > yLo / 1.3 && v < yHi * 1.3 ? v : NaN)), "cost");
    if (dl !== null) {
      s += `<path class="cost" d="M${f.sx(dl).toFixed(1)} ${f.sy(cost(dl)).toFixed(1)}V${f.t - 2}"/><path class="cost" d="M${(f.sx(dl) - 4).toFixed(1)} ${f.t + 4}l4 -6l4 6"/>`;
      s += `<text class="tag-acc" x="${(f.sx(dl) + 7).toFixed(1)}" y="${f.t + 12}">infinite after time ${S.ft(dl)}</text>`;
    } else if (st.kind === "rising" || st.kind === "up") {
      s += `<text class="tag-acc" x="${f.W - f.r - 2}" y="${f.t + 12}" text-anchor="end">keeps rising: no c_max</text>`;
    } else if (st.kind === "down") {
      s += `<text class="tag-acc" x="${f.W - f.r - 2}" y="${f.H - f.b - 8}" text-anchor="end">falls toward 0: no c_min</text>`;
    }
    chart.innerHTML = svg(f, s, `The cost of time for ${labelOf(choice)} to time 10, on a log scale, ${ok ? "with the two levels it stays between" : "which the standing assumption doesn't allow"}`);
    const why = st.kind === "deadline" ? "infinite after the deadline" : isDraw ? "straight lines in log c" : st.kind === "step" ? "logistic steps" : st.kind === "rising" ? "a ramp" : "a smooth formula";
    reads.innerHTML = `<div class="${st.continuous ? "" : "k-acc"}"><dt>Continuous</dt><dd>${st.continuous ? "Yes" : "No"}<small>${why}</small></dd></div>
      <div class="${P.lo > 0 ? "" : "k-acc"}"><dt>Lower level, c_min</dt><dd>${P.lo > 0 ? S.fc(P.lo) : "None"}<small>${P.lo > 0 ? "the cost stays at or above it" : "the cost falls toward 0"}</small></dd></div>
      <div class="${Number.isFinite(P.hi) ? "" : "k-acc"}"><dt>Upper level, c_max</dt><dd>${Number.isFinite(P.hi) ? S.fc(P.hi) : "None"}<small>${Number.isFinite(P.hi) ? "the cost stays at or below it" : "no finite level holds for all time"}</small></dd></div>
      ${ok ? `<div><dt>Band for the bound</dt><dd>${P.bandLo.toFixed(2)} to ${P.bandHi.toFixed(2)}<small>B(c_max) to B(c_min), Lemma 1(c), rounded outward</small></dd></div>` : ""}`;
    say.textContent = S.standingSay({ ...st, lo: P.lo, hi: P.hi }, isDraw ? "Your drawing" : labelOf(choice), isDraw ? M.steepest(choice) : 1);
    liftReady(fig);
  };
  pick.addEventListener("change", () => { choice = choiceFromPick(pick.value); setChoice(choice); });
  onSeg(el, "al-tail", (v) => { tail = v; draw(); });
  window.addEventListener("cc-schedule", () => { choice = getChoice(); draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: the value of waiting
function valuePlate() {
  const fig = plate("value"), el = rootOf("value");
  if (!el) return;
  let choice = getChoice(), last = "far", data = null, shown = false, guess = null, tSel = 0, wanted = "";
  el.innerHTML = `<div class="controls">${segHTML("va-last", [["far", "6 past the window"], ["window", "At time 2.5"]], last, "The last moment to decide")}</div>
    <p class="fine" id="va-note"></p>
    <div class="chart-wrap" id="va-cost"></div>
    <div class="chart-wrap pad" id="va-map"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">B(c(t))</span></li><li><span class="key key-acc">Your tap</span></li><li>Shaded, after Show me: W = V − g</li></ul>
    <div class="predict" style="margin-top:12px"><p>Where is waiting worth the most? Tap the map, then press Show me.</p>
      <div class="actions"><button class="btn btn-go" type="button" id="va-show">Show me</button></div>
      <p class="verdict" id="va-verdict" aria-live="polite"></p></div>
    <div id="va-after" hidden><div class="controls"><label class="dial"><span class="ctl-key">Time t</span><output id="va-tout"></output>
      <input type="range" id="va-t" min="0" max="2.5" step="0.05" value="0" aria-label="Time t"></label></div>
      <div class="chart-wrap" id="va-slice"></div>
      <dl class="reads" id="va-reads"></dl><p class="say" id="va-say" aria-live="polite"></p></div>
    <p class="fine" id="va-state" aria-live="polite"></p>`;
  const costEl = $("#va-cost", el), mapEl = $("#va-map", el), sliceEl = $("#va-slice", el), reads = $("#va-reads", el), say = $("#va-say", el);
  const note = $("#va-note", el), state = $("#va-state", el), verdict = $("#va-verdict", el), after = $("#va-after", el), tIn = $("#va-t", el), tOut = $("#va-tout", el);
  const lastRadios = [...el.querySelectorAll('input[name="va-last"]')];
  const W = (i, j) => data.V[i][j] - data.gy[j];
  const yTopOf = () => { const fin = data.b.filter((v) => v !== null); return Math.min(3.2, Math.max(0.6, Math.max(...fin, ...data.pm) * 1.25 + 0.1)); };
  const bestW = () => { let bi = 0, bv = -1; for (let i = 0; i < data.times.length; i++) { const w = W(i, 0); if (w > bv) { bv = w; bi = i; } } return { i: bi, t: data.times[bi], W: bv }; };
  // a tap is snapped to the nearest kept sample, and its W is read from the data on show (so it follows a re-solve)
  const tapAt = () => { if (!guess || !data) return null; const n = M.nearestSample(data.times, data.ys, guess.t, guess.y); return { ...n, W: Math.max(0, W(n.i, n.j)) }; };
  const drawCost = () => {
    const cost = costOf(choice), dl = deadlineOf(choice), view = dl !== null ? Math.min(dl, VIEW) : VIEW;
    const ts = range(0, view, 201), cs = ts.map((t) => cost(t)), fin = cs.filter(Number.isFinite);
    const f = frame(costEl, { x: [0, view], y: [Math.min(...fin) / 1.6, Math.max(...fin, 0.2) * 1.6], ylog: true, aspect: 0.2, minH: 84, maxH: 120, b: 22 });
    costEl.innerHTML = svg(f, axes(f, { yl: "cost of time", yt: [] }) + line(f, ts, cs, "cost") + (shown ? `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tSel).toFixed(1)} ${f.t}V${f.H - f.b}"/>` : ""), `The cost of time for ${labelOf(choice)}`);
  };
  const drawMap = () => {
    if (!data) { mapEl.innerHTML = ""; return; }
    const view = data.view, yTop = yTopOf(), dy = data.ys[1] - data.ys[0];
    const f = frame(mapEl, { x: [0, view], y: [0, yTop], aspect: 0.62, minH: 210, maxH: 320 });
    let s = "";
    if (shown) {
      const wMax = bestW().W || 1;
      const dt = data.times.length > 1 ? data.times[1] - data.times[0] : 0.05;
      // cells with edges on whole pixels, so neighbors share an edge and no seams show
      const px = (v) => Math.round(v);
      for (let i = 0; i < data.times.length; i++) {
        const x0 = px(f.sx(Math.max(0, data.times[i] - dt / 2))), x1 = px(f.sx(Math.min(view, data.times[i] + dt / 2)));
        for (let j = 0; j < data.ys.length && data.ys[j] <= yTop; j++) {
          const w = W(i, j); if (!(w > 1e-5)) continue;
          const y0 = px(f.sy(Math.min(yTop, data.ys[j] + dy / 2))), y1 = px(f.sy(Math.max(0, data.ys[j] - dy / 2)));
          s += `<rect class="heat" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill-opacity="${(0.06 + 0.74 * (w / wMax)).toFixed(3)}"/>`;
        }
      }
    }
    s += axes(f, { yl: "evidence, y = |x|", xl: "start time, t", grid: !shown });
    const cv = M.mapCurves(data);
    s += line(f, ...cv.pm, "pm") + line(f, ...cv.b, "ex");
    if (!shown) {
      s += `<text class="tk" x="${(f.l + 8).toFixed(1)}" y="${(f.H - f.b - 10).toFixed(1)}">wait</text><text class="tk" x="${(f.l + 8).toFixed(1)}" y="${f.t + 12}">decide at once</text>`;
    } else {
      const bw = bestW();
      s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tSel).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
      s += `<circle class="ink-dot" cx="${f.sx(bw.t).toFixed(1)}" cy="${f.sy(0).toFixed(1)}" r="5"/>`;
      s += `<text class="tag-ex" x="${(f.sx(bw.t) + (f.sx(bw.t) > f.W * 0.6 ? -7 : 7)).toFixed(1)}" y="${(f.sy(0) - 9).toFixed(1)}" text-anchor="${f.sx(bw.t) > f.W * 0.6 ? "end" : "start"}">most: ${S.wShown(bw.W)}</text>`;
    }
    const tap = tapAt();
    if (tap) s += `<circle class="acc-dot" cx="${f.sx(tap.t).toFixed(1)}" cy="${f.sy(tap.y).toFixed(1)}" r="5.5"/>`;
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    mapEl.innerHTML = svg(f, s, shown ? `The value of waiting over start time and evidence for ${labelOf(choice)}, darker where it is larger, with the best bound` : `The best bound for ${labelOf(choice)} over start time, with the region below it where the decision maker waits`);
    mapEl._f = f;
  };
  const drawSlice = () => {
    if (!data || !shown) return;
    const i = Math.max(0, Math.min(data.times.length - 1, Math.round(tSel / 0.05))), t = data.times[i];
    tOut.textContent = t.toFixed(2);
    const yTop = yTopOf(), ys = data.ys.filter((y) => y <= yTop), V = data.V[i].slice(0, ys.length), gy = data.gy.slice(0, ys.length);
    const f = frame(sliceEl, { x: [0, yTop], y: [0.48, 1.0], aspect: 0.5, minH: 180, maxH: 260 });
    let s = axes(f, { yl: "value", xl: "evidence, y", grid: true });
    let d = ""; ys.forEach((y, k) => { d += (k ? "L" : "M") + f.sx(y).toFixed(1) + " " + f.sy(V[k]).toFixed(1); });
    for (let k = ys.length - 1; k >= 0; k--) d += "L" + f.sx(ys[k]).toFixed(1) + " " + f.sy(gy[k]).toFixed(1);
    s += `<path class="w-fill" d="${d}Z"/>`;
    s += line(f, ys, gy, "dim") + line(f, ys, V, "ex");
    const bt = data.rowB[i], bw = bestW(), R = S.sliceReads(data, i, bw);
    if (R.marker) s += `<path class="dim" stroke-dasharray="3 3" d="M${f.sx(bt).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-ex" x="${(f.sx(bt) + 5).toFixed(1)}" y="${f.t + 12}">${R.marker}</text>`;
    if (V[0] - gy[0] > 0.03) s += `<text class="tag-ex" x="${(f.sx(0) + 6).toFixed(1)}" y="${(f.sy(V[0]) - 7).toFixed(1)}">V(t, y)</text>`;
    const gx = Math.max(0.12 * yTop, 0.15 * (bt || yTop));
    s += `<text class="tk" x="${f.sx(gx).toFixed(1)}" y="${(f.sy(M.g(gx)) + 18).toFixed(1)}">g(y), deciding now</text>`;
    sliceEl.innerHTML = svg(f, s, `The value V(t, y) at time ${t.toFixed(2)} beside the reward for deciding now, with the gap between them shaded`);
    reads.innerHTML = `<div><dt>V(t, 0)</dt><dd>${R.tiles.V}<small>the best a decision from y = 0 earns</small></dd></div>
      <div><dt>W(t, 0)</dt><dd>${R.tiles.W}<small>V − g at y = 0</small></dd></div>
      <div><dt>Bound at t</dt><dd>${R.tiles.bound}<small>deciding starts to beat waiting, between grid points</small></dd></div>
      <div><dt>Largest W</dt><dd>${R.tiles.most}<small>of the map's samples: time ${bw.t.toFixed(2)}, y = 0</small></dd></div>`;
    say.textContent = R.say;
  };
  const drawAll = () => { drawCost(); drawMap(); drawSlice(); if (data) liftReady(fig); };
  const reveal = () => {
    shown = true; after.hidden = false;
    const bw = bestW();
    const tap = tapAt();
    tSel = tap ? tap.t : bw.t;
    verdict.textContent = S.valueVerdict(tap, { t: bw.t, W: bw.W });
    tIn.value = tSel; drawAll();
  };
  const run = () => {
    const dl = deadlineOf(choice);
    lastRadios.forEach((r) => { r.disabled = dl !== null; });
    note.textContent = S.lastNote(last, dl);
    tIn.max = String(dl !== null ? Math.min(dl, VIEW) : VIEW);
    data = null; drawAll();
    state.textContent = "Solving the dynamic program…";
    const k = (wanted = keyOf(choice) + "|" + last);
    valueFor(choice, dl !== null ? "far" : last, (p) => { if (wanted === k) state.textContent = `Solving the dynamic program… ${Math.round(p * 100)}%`; }).then((m) => {
      if (wanted !== k) return;
      data = m;
      state.textContent = S.valueState(m, m.b.some((v) => M.belowFirstStep(v, m.h)));
      tSel = Math.min(tSel, m.view);
      if (shown) reveal(); else drawAll();
    }).catch((e) => { if (wanted === k) state.textContent = "The solver stopped: " + e.message; });
  };
  mapEl.addEventListener("click", (e) => {
    if (!data || !mapEl._f) return;
    const f = mapEl._f, r = mapEl.getBoundingClientRect();
    const t = Math.max(0, Math.min(data.view, f.ix(((e.clientX - r.left) / r.width) * f.W))), y = Math.max(0, Math.min(yTopOf(), f.iy(((e.clientY - r.top) / r.height) * f.H)));
    guess = { t, y };
    const tap = tapAt();
    if (shown) { tSel = tap.t; tIn.value = tSel; verdict.textContent = S.valueVerdict(tap, bestW()); }
    drawAll();
  });
  tIn.addEventListener("input", () => { tSel = +tIn.value; drawCost(); drawMap(); drawSlice(); });
  $("#va-show", el).addEventListener("click", () => { if (data) reveal(); else { shown = true; after.hidden = false; verdict.textContent = "Solving; the answer appears when the program finishes."; } });
  onSeg(el, "va-last", (v) => { last = v; run(); });
  window.addEventListener("cc-schedule", () => { choice = getChoice(); guess = null; run(); });
  keepDrawn(mapEl, drawAll);
  run();
}

// ---------------------------------------------------------------- plate: where does the reward of a flat bound peak?
function peakPlate() {
  const fig = plate("peak"), el = rootOf("peak");
  if (!el) return;
  let c = 0.1, guess = null, shown = false;
  el.innerHTML = `<div class="controls">${segHTML("pk-c", [[0.03, "0.03"], [0.1, "0.1"], [0.3, "0.3"], [1, "1"]], c, "Cost of time, c")}</div>
    <div class="chart-wrap pad is-draw" id="pk-chart"></div>
    <ul class="legend"><li><span class="key key-dim">Chance right, g(b)</span></li><li><span class="key key-cost">Bill, c b tanh b</span></li><li><span class="key key-ex">Reward minus bill</span></li><li><span class="key key-acc-dash">Your guess</span></li></ul>
    <div class="predict" style="margin-top:12px"><p>Where is the chance of being right minus the bill largest? Drag across the chart to place your guess, then press Show me.</p>
      <div class="actions"><button class="btn btn-go" type="button" id="pk-show">Show me</button><button class="btn" type="button" id="pk-again">Guess again</button></div>
      <p class="verdict" id="pk-verdict" aria-live="polite"></p></div>
    <dl class="reads" id="pk-reads"></dl>`;
  const chart = $("#pk-chart", el), reads = $("#pk-reads", el), verdict = $("#pk-verdict", el);
  const draw = () => {
    const bc = M.B(c), X = Math.max(2.6, bc * 1.45);
    const bs = range(0, X, 181);
    const f = frame(chart, { x: [0, X], y: [0, 1.02], aspect: 0.56, minH: 200, maxH: 290 });
    let s = axes(f, { yl: "per decision", xl: "flat bound, b", grid: true });
    s += line(f, bs, bs.map(M.g), "dim") + line(f, bs, bs.map((b) => inRange(c * M.meanTime(b), 0, 1.02)), "cost");
    const tx = X * 0.97;
    s += `<text class="tk" x="${f.sx(tx).toFixed(1)}" y="${(f.sy(M.g(tx)) - 6).toFixed(1)}" text-anchor="end">g(b)</text>`;
    const kb = bs.findIndex((b) => c * M.meanTime(b) > 0.95);
    if (kb > 0) { const bb = bs[Math.max(0, kb - 8)]; s += `<text class="tag-acc" x="${(f.sx(bb) + 7).toFixed(1)}" y="${(f.sy(c * M.meanTime(bb)) + 4).toFixed(1)}">bill</text>`; }
    else s += `<text class="tag-acc" x="${f.sx(tx).toFixed(1)}" y="${(f.sy(c * M.meanTime(tx)) - 6).toFixed(1)}" text-anchor="end">bill</text>`;
    if (shown) {
      const R = bs.map((b) => inRange(M.flatReward(b, c), 0, 1.02)), Rb = M.flatReward(bc, c), sl = M.gPrime(bc);
      s += line(f, bs, R, "ex");
      s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(bc).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
      // the two tangents at the peak, of the same slope
      const seg = (y0) => { const h = X * 0.12; return `<path class="guide" d="M${f.sx(bc - h).toFixed(1)} ${f.sy(y0 - sl * h).toFixed(1)}L${f.sx(bc + h).toFixed(1)} ${f.sy(y0 + sl * h).toFixed(1)}"/>`; };
      s += seg(M.g(bc)) + seg(c * M.meanTime(bc));
      s += `<circle class="ink-dot" cx="${f.sx(bc).toFixed(1)}" cy="${f.sy(Rb).toFixed(1)}" r="4.5"/>`;
      const right = f.sx(bc) > f.W * 0.62;
      s += `<text class="tag-ex" x="${(f.sx(bc) + (right ? -7 : 7)).toFixed(1)}" y="${(f.sy(Rb) + 17).toFixed(1)}" text-anchor="${right ? "end" : "start"}">peak, B(c) = ${fmt(bc, 3)}</text>`;
    }
    if (guess !== null) {
      s += `<path class="acc" stroke-dasharray="5 4" d="M${f.sx(guess).toFixed(1)} ${f.t}V${f.H - f.b}"/><circle class="acc-dot" cx="${f.sx(guess).toFixed(1)}" cy="${f.H - f.b}" r="6"/>`;
    } else {
      s += `<text class="tag-acc" x="${(f.l + 8).toFixed(1)}" y="${f.t + 12}">drag across to guess</text>`;
    }
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    chart.innerHTML = svg(f, s, shown ? `The reward of a flat bound at a cost of ${c}, peaking at B(c)` : `The chance of being right and the bill for time, against the flat bound, at a cost of ${c}`);
    chart._f = f;
    if (shown) {
      reads.innerHTML = `<div><dt>Peak, B(c)</dt><dd>${fmt(bc, 3)}<small>root of sinh 2b + 2b = 1/c</small></dd></div>
        <div class="k-acc"><dt>Your guess</dt><dd>${guess === null ? "–" : fmt(guess, 2)}</dd></div>
        <div><dt>Reward there</dt><dd>${fmt(M.flatReward(bc, c), 3)}<small>mean decision time ${fmt(M.meanTime(bc), 3)}</small></dd></div>`;
      verdict.textContent = S.peakVerdict(guess, c, bc, M.flatReward(bc, c), M.gPrime(bc));
      liftReady(fig);
    } else reads.innerHTML = "";
  };
  let down = false;
  const setAt = (e) => { const f = chart._f, r = chart.getBoundingClientRect(); guess = Math.max(0, Math.min(f.x[1], f.ix(((e.clientX - r.left) / r.width) * f.W))); if (shown) { shown = false; verdict.textContent = "Press Show me when you're ready."; } draw(); };
  chart.addEventListener("pointerdown", (e) => { down = true; chart.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  chart.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  chart.addEventListener("pointerup", up); chart.addEventListener("pointercancel", up);
  $("#pk-show", el).addEventListener("click", () => { shown = true; draw(); });
  $("#pk-again", el).addEventListener("click", () => { guess = null; shown = false; verdict.textContent = ""; draw(); });
  onSeg(el, "pk-c", (v) => { c = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- the strip's plate: two routes to the flat bound
function routesPlate() {
  const fig = plate("routes"), el = rootOf("routes");
  if (!el) return;
  let c = 0.1, step = +(fig.dataset.step || 0);
  const FACT = [0.7, 1, 1.3];
  el.innerHTML = `<div class="controls">${segHTML("ro-c", [[0.03, "0.03"], [0.1, "0.1"], [0.3, "0.3"], [1, "1"]], c, "Cost of time, c")}</div>
    <p class="fine" id="ro-head"></p><div class="chart-wrap" id="ro-chart"></div><dl class="reads" id="ro-reads"></dl><p class="say" id="ro-say" aria-live="polite"></p>`;
  const chart = $("#ro-chart", el), reads = $("#ro-reads", el), say = $("#ro-say", el), head = $("#ro-head", el);
  const draw = () => {
    const bc = M.B(c), levels = FACT.map((k) => k * bc), X = 1.6 * bc;
    head.textContent = S.ROUTES_HEAD[step];
    let f, s = "", label = "";
    if (step === 0 || step === 2) {
      const ys = range(0, X, 161), Vmin = M.flatReward(levels[0], c);
      const lo = Math.max(0.45, Math.min(Vmin, M.flatReward(levels[2], c)) - 0.06);
      f = frame(chart, { x: [0, X], y: [lo, 1.0], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "value", xl: "evidence, y", grid: true });
      s += line(f, ys, ys.map((y) => inRange(M.g(y), lo, 1)), "dim");
      levels.forEach((b, k) => {
        const yy = ys.filter((y) => y <= b).concat([b]);
        s += line(f, yy, yy.map((y) => M.flatValue(Math.min(y, b - 1e-12), b, c)), k === 1 && step === 2 ? "ex" : "ex-thin");
      });
      levels.forEach((b, k) => {
        const x = f.sx(b), y = f.sy(M.g(b));
        s += `<circle class="${k === 1 && step === 2 ? "ink-dot" : "acc-dot"}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === 1 && step === 2 ? 4.5 : 3.5}"/>`;
        s += `<text class="${k === 1 && step === 2 ? "tag-ex" : "tag-acc"}" x="${(x - 6).toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="end">${step === 2 ? ["corner", "smooth fit", "dips under g"][k] : `b = ${fmt(b, 2)}`}</text>`;
      });
      s += `<text class="tk" x="${(f.W - f.r).toFixed(1)}" y="${(f.sy(M.g(X)) + 16).toFixed(1)}" text-anchor="end">g(y)</text>`;
      label = "The values of following three flat rules, beside the reward for deciding now";
      reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(bc, 3)}</dd></div>` + (step === 2 ? `<div><dt>Slopes at B</dt><dd>${fmt(M.flatValueSlope(bc, c), 4)}<small>V′(B) and g′(B) = ${fmt(M.gPrime(bc), 4)}</small></dd></div>` : `<div><dt>Levels tried</dt><dd>${levels.map((b) => fmt(b, 2)).join(", ")}</dd></div>`);
    } else if (step === 1) {
      // each level's piece runs from 0 to its own level (its dot); above it that rule stops, and its value is g
      // the axis reaches the highest level's dot, so every piece's end shows (at a cost of 0.03 it is near 1.57)
      const yTop = M.slopeAxisTop(c, levels);
      const ys = range(0, levels[2], 161), q = ys.map((y) => inRange(c * (y + 0.5 * Math.sinh(2 * y)), 0, yTop));
      f = frame(chart, { x: [0, X], y: [0, yTop], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "cosh² y times the slope", xl: "evidence, y", grid: true });
      s += `<path class="dim" d="M${f.l} ${f.sy(0.5).toFixed(1)}H${f.W - f.r}"/><text class="tk" x="${f.l + 4}" y="${(f.sy(0.5) - 6).toFixed(1)}">cosh² y · g′(y) = ½</text>`;
      s += line(f, ys, q, "ex");
      levels.forEach((b, k) => { const v = c * (b + 0.5 * Math.sinh(2 * b)); if (v <= yTop) s += `<circle class="${k === 1 ? "ink-dot" : "acc-dot"}" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(v).toFixed(1)}" r="${k === 1 ? 4.5 : 3.5}"/>`; });
      s += `<text class="tag-ex" x="${(f.sx(X * 0.5)).toFixed(1)}" y="${(f.sy(Math.min(1.1, c * (X * 0.5 + 0.5 * Math.sinh(X)))) - 10).toFixed(1)}" text-anchor="end">c (y + ½ sinh 2y)</text>`;
      s += `<text class="tk" x="${(f.l + 6).toFixed(1)}" y="${(f.t + 12).toFixed(1)}">each level's piece ends at its dot</text>`;
      label = "cosh squared y times the slope of each flat rule's value, one curve below every level, against the line one half";
      reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(bc, 3)}</dd></div><div><dt>The curve at B</dt><dd>${fmt(c * (bc + 0.5 * Math.sinh(2 * bc)), 4)}<small>½ there, by step 3</small></dd></div>`;
    } else if (step === 3) {
      const bs = range(0, X, 161);
      f = frame(chart, { x: [0, X], y: [0, 1.02], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "per decision", xl: "flat bound, b", grid: true });
      s += line(f, bs, bs.map(M.g), "dim") + line(f, bs, bs.map((b) => inRange(c * M.meanTime(b), 0, 1.02)), "cost") + line(f, bs, bs.map((b) => inRange(M.flatReward(b, c), 0, 1.02)), "ex");
      levels.forEach((b, k) => { s += `<circle class="${k === 1 ? "ink-dot" : "acc-dot"}" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(M.flatReward(b, c)).toFixed(1)}" r="${k === 1 ? 4.5 : 3.5}"/>`; });
      s += `<text class="tag-ex" x="${(f.sx(bc)).toFixed(1)}" y="${(f.sy(M.flatReward(bc, c)) + 18).toFixed(1)}" text-anchor="middle">R(b) = V_b(0)</text>`;
      s += `<text class="tk" x="${(f.W - f.r).toFixed(1)}" y="${(f.sy(M.g(X)) - 6).toFixed(1)}" text-anchor="end">g(b)</text>`;
      label = "The reward of a flat bound, with the three levels marked, beside the chance of being right and the bill";
      reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(bc, 3)}</dd></div><div><dt>R(B)</dt><dd>${fmt(M.flatReward(bc, c), 3)}<small>mean decision time ${fmt(M.meanTime(bc), 3)}</small></dd></div>`;
    } else {
      const bs = range(0, X, 161), Rp = bs.map((b) => M.flatRewardSlope(b, c)), br = bs.map((b) => M.bracket(b, c));
      const lo = Math.max(-0.6, Math.min(...Rp, ...br)), hi = 0.55;
      f = frame(chart, { x: [0, X], y: [lo, hi], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "slope", xl: "flat bound, b", grid: true, zero: true });
      s += line(f, bs, br.map((v) => (v >= lo ? v : NaN)), "guide") + line(f, bs, Rp.map((v) => (v >= lo ? v : NaN)), "ex");
      s += `<circle class="ink-dot" cx="${f.sx(bc).toFixed(1)}" cy="${f.sy(0).toFixed(1)}" r="4.5"/>`;
      const kBr = br.findIndex((v) => v < lo * 0.55), bBr = kBr > 0 ? bs[kBr] : X * 0.9;
      s += `<text class="tk" x="${(f.sx(bBr) + 8).toFixed(1)}" y="${(f.sy(M.bracket(bBr, c)) + 4).toFixed(1)}">bracket</text>`;
      s += `<text class="tag-ex" x="${(f.W - f.r - 2).toFixed(1)}" y="${(f.sy(Rp[Rp.length - 1]) - 8).toFixed(1)}" text-anchor="end">R′(b)</text>`;
      label = "The slope of the reward of a flat bound and the bracket, both crossing zero at B(c)";
      reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(bc, 3)}</dd></div><div><dt>R′(B)</dt><dd>${fmt(M.flatRewardSlope(bc, c), 4)}<small>zero, to machine precision</small></dd></div>`;
    }
    chart.innerHTML = svg(f, s, label);
    say.textContent = S.routesSay(step, c, bc);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "ro-c", (v) => { c = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: double the cost
function doublePlate() {
  const fig = plate("double"), el = rootOf("double");
  if (!el) return;
  const C0 = 0.1;
  let guess = null, shown = false, c = C0;
  el.innerHTML = `<div class="chart-wrap pad is-draw" id="db-chart"></div>
    <ul class="legend"><li><span class="key key-ex">B(c)</span></li><li><span class="key key-guide">Tangent, slope B′(c)</span></li><li><span class="key key-ring">Tangent's value at 2c</span></li><li><span class="key key-acc">Your guess</span></li></ul>
    <div class="predict" style="margin-top:12px"><p>At a cost of 0.1 the bound is ${fmt(M.B(C0), 3)}. If the cost doubles to 0.2, where is it? Drag the orange marker, then press Show me.</p>
      <div class="actions"><button class="btn btn-go" type="button" id="db-show">Show me</button><button class="btn" type="button" id="db-again">Guess again</button></div>
      <p class="verdict" id="db-verdict" aria-live="polite"></p></div>
    <div id="db-after" hidden><div class="controls"><label class="dial"><span class="ctl-key">Slide the tangent: cost c</span><output id="db-out"></output>
      <input type="range" id="db-c" min="0.02" max="0.3" step="0.005" value="${C0}" aria-label="Cost c where the tangent touches"></label></div>
      <dl class="reads" id="db-reads"></dl><p class="say" id="db-say" aria-live="polite"></p></div>`;
  const chart = $("#db-chart", el), verdict = $("#db-verdict", el), after = $("#db-after", el), reads = $("#db-reads", el), say = $("#db-say", el), inp = $("#db-c", el), out = $("#db-out", el);
  const fd = (x) => { const h = 1e-4 * x; return (M.B(x + h) - M.B(x - h)) / (2 * h); };
  const draw = () => {
    const f = frame(chart, { x: [0, 0.62], y: [0, 2.4], aspect: 0.6, minH: 210, maxH: 300 });
    let s = axes(f, { yl: "bound, B(c)", xl: "cost of time, c", grid: true });
    const at = shown ? c : C0, b1 = M.B(at), bp = M.Bprime(at), b2 = M.B(2 * at);
    if (shown) {
      const cs = range(0.016, 0.62, 200);
      s += line(f, cs, cs.map((v) => M.B(v)), "ex");
      const x0 = Math.max(0.005, at - (2.35 - b1) / -bp), x1 = Math.min(0.62, 2 * at + 0.08, at + (b1 - 0.02) / -bp);
      s += line(f, [x0, x1], [b1 + bp * (x0 - at), b1 + bp * (x1 - at)], "guide");
      const tanAt2 = b1 + bp * at;
      if (tanAt2 > 0) s += `<circle cx="${f.sx(2 * at).toFixed(1)}" cy="${f.sy(tanAt2).toFixed(1)}" r="4.5" class="ring-ex"/>`;
      s += `<circle class="ink-dot" cx="${f.sx(2 * at).toFixed(1)}" cy="${f.sy(b2).toFixed(1)}" r="4.5"/>`;
      s += `<text class="tag-ex" x="${(f.sx(2 * at) + 8).toFixed(1)}" y="${(f.sy(b2) - 8).toFixed(1)}">B(${S.ft(2 * at)}) = ${fmt(b2, 3)}</text>`;
    }
    s += `<circle class="ink-dot" cx="${f.sx(at).toFixed(1)}" cy="${f.sy(b1).toFixed(1)}" r="4.5"/>`;
    s += shown ? `<text class="tag-ex" x="${(f.sx(at) + 8).toFixed(1)}" y="${(f.sy(b1) - 9).toFixed(1)}">B(${S.ft(at)}) = ${fmt(b1, 3)}</text>`
      : `<text class="tag-ex" x="${f.sx(at).toFixed(1)}" y="${(f.sy(b1) - 11).toFixed(1)}" text-anchor="middle">${fmt(b1, 3)}</text>`;
    if (!shown || at === C0) {
      if (!shown) s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(2 * C0).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
      const gy = guess ?? b1;
      s += `<circle class="acc-dot" cx="${f.sx(2 * C0).toFixed(1)}" cy="${f.sy(gy).toFixed(1)}" r="${guess === null ? 7 : 6}" style="opacity:${guess === null ? 0.55 : 1}"/>`;
      if (guess === null) s += `<text class="tag-acc" x="${(f.sx(2 * C0) + 11).toFixed(1)}" y="${(f.sy(gy) + 4).toFixed(1)}">drag me</text>`;
    }
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    chart.innerHTML = svg(f, s, shown ? `The constant-cost bound against the cost, with its tangent at ${at}` : "The bound at a cost of 0.1, and a marker for the reader's guess at 0.2");
    chart._f = f;
    if (shown) {
      out.textContent = S.ft(c);
      reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(b1, 3)}</dd></div>
        <div><dt>B′(c)</dt><dd>${fmt(bp, 3)}<small>difference quotient ${fmt(fd(at), 3)}</small></dd></div>
        <div><dt>B(2c)</dt><dd>${fmt(b2, 3)}<small>${Math.round((100 * b2) / b1)}% of B(c)</small></dd></div>`;
      say.textContent = S.slideSay(at, b1, bp, b2, M.B(at + 0.01));
      liftReady(fig);
    }
  };
  let down = false;
  const setAt = (e) => { const f = chart._f, r = chart.getBoundingClientRect(); guess = Math.max(0, Math.min(2.4, f.iy(((e.clientY - r.top) / r.height) * f.H))); if (shown) { shown = false; after.hidden = true; c = C0; inp.value = C0; verdict.textContent = "Press Show me when you're ready."; } draw(); };
  chart.addEventListener("pointerdown", (e) => { if (shown && c !== C0) return; down = true; chart.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  chart.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  chart.addEventListener("pointerup", up); chart.addEventListener("pointercancel", up);
  $("#db-show", el).addEventListener("click", () => { shown = true; after.hidden = false; c = C0; inp.value = C0; verdict.textContent = S.doubleVerdict(guess, C0, M.B(C0), M.B(2 * C0), M.B(C0) + M.Bprime(C0) * C0); draw(); });
  $("#db-again", el).addEventListener("click", () => { guess = null; shown = false; after.hidden = true; c = C0; inp.value = C0; verdict.textContent = ""; draw(); });
  inp.addEventListener("input", () => { c = +inp.value; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- the strip's plate: differentiating the equation
function inversePlate() {
  const fig = plate("inverse"), el = rootOf("inverse");
  if (!el) return;
  let c = 0.1, step = +(fig.dataset.step || 0);
  el.innerHTML = `<div class="controls">${segHTML("iv-c", [[0.03, "0.03"], [0.1, "0.1"], [0.3, "0.3"], [1, "1"]], c, "Cost of time, c")}</div>
    <p class="fine" id="iv-head"></p><div class="chart-wrap" id="iv-chart"></div><dl class="reads" id="iv-reads"></dl><p class="say" id="iv-say" aria-live="polite"></p>`;
  const chart = $("#iv-chart", el), reads = $("#iv-reads", el), say = $("#iv-say", el), head = $("#iv-head", el);
  const draw = () => {
    const bc = M.B(c), c2 = 1.25 * c, b2 = M.B(c2), X = Math.max(0.4, bc * 1.5);
    head.textContent = S.INVERSE_HEAD[step];
    let f, s = "", label = "", o = { c, b: bc, b2 };
    if (step <= 1) {
      const bs = range(0, X, 161), top = M.F(X);
      f = frame(chart, { x: [0, X], y: [0, top], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "sinh 2b + 2b", xl: "bound, b", grid: true });
      s += line(f, bs, bs.map(M.F), "ex");
      s += `<path class="acc" d="M${f.l} ${f.sy(1 / c).toFixed(1)}H${f.W - f.r}"/><text class="tag-acc" x="${f.l + 4}" y="${(f.sy(1 / c) - 6).toFixed(1)}">1/c = ${fmt(1 / c, 2)}</text>`;
      s += `<path class="acc" stroke-dasharray="4 4" d="M${f.l} ${f.sy(1 / c2).toFixed(1)}H${f.W - f.r}"/><text class="tag-acc" x="${f.l + 4}" y="${(f.sy(1 / c2) + 15).toFixed(1)}">cost 25% higher</text>`;
      s += `<circle class="ink-dot" cx="${f.sx(bc).toFixed(1)}" cy="${f.sy(1 / c).toFixed(1)}" r="4.5"/><circle class="ink-dot" cx="${f.sx(b2).toFixed(1)}" cy="${f.sy(1 / c2).toFixed(1)}" r="3.5"/>`;
      s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(bc).toFixed(1)} ${f.sy(1 / c).toFixed(1)}V${f.H - f.b}M${f.sx(b2).toFixed(1)} ${f.sy(1 / c2).toFixed(1)}V${f.H - f.b}"/>`;
      if (step === 1) {
        const slope = M.Fprime(bc), d1c = 1 / c2 - 1 / c, dTan = d1c / slope;
        const h0 = Math.min(bc, X * 0.35, (1 / c) / slope), h1 = Math.min(X * 0.2, (top - 1 / c) / slope);
        s += `<path class="guide" d="M${f.sx(bc - h0).toFixed(1)} ${f.sy(1 / c - slope * h0).toFixed(1)}L${f.sx(bc + h1).toFixed(1)} ${f.sy(1 / c + slope * h1).toFixed(1)}"/>`;
        s += `<circle class="ring-ex" cx="${f.sx(bc + dTan).toFixed(1)}" cy="${f.sy(1 / c2).toFixed(1)}" r="4"/>`;
        o = { ...o, dTan, dTrue: b2 - bc };
        reads.innerHTML = `<div><dt>F′(B)</dt><dd>${fmt(slope, 3)}</dd></div><div><dt>Move, by the tangent</dt><dd>${fmt(dTan, 3)}</dd></div><div><dt>Move, exact</dt><dd>${fmt(b2 - bc, 3)}</dd></div>`;
      } else reads.innerHTML = `<div><dt>B(c)</dt><dd>${fmt(bc, 3)}</dd></div><div><dt>B(1.25c)</dt><dd>${fmt(b2, 3)}</dd></div>`;
      label = "sinh 2b + 2b against b, with the lines 1/c for two costs, crossing at their bounds";
    } else if (step === 2) {
      const bs = range(0, X, 161), dots = range(0, X, 13);
      const top = M.Fprime(X) * 1.05;
      f = frame(chart, { x: [0, X], y: [0, top], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "slope of sinh 2b + 2b", xl: "bound, b", grid: true });
      s += line(f, bs, bs.map(M.Fprime), "ex");
      s += dots.map((b) => `<circle class="acc-dot" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(4 * Math.cosh(b) ** 2).toFixed(1)}" r="3"/>`).join("");
      s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(bc).toFixed(1)} ${f.sy(M.Fprime(bc)).toFixed(1)}V${f.H - f.b}"/><circle class="ink-dot" cx="${f.sx(bc).toFixed(1)}" cy="${f.sy(M.Fprime(bc)).toFixed(1)}" r="4.5"/>`;
      o = { ...o, Fp: M.Fprime(bc), fourCosh: 4 * Math.cosh(bc) ** 2 };
      reads.innerHTML = `<div><dt>2 cosh 2B + 2</dt><dd>${fmt(o.Fp, 3)}</dd></div><div class="k-acc"><dt>4 cosh² B</dt><dd>${fmt(o.fourCosh, 3)}</dd></div>`;
      label = "The slope of sinh 2b + 2b, drawn as a line, with 4 cosh squared b as dots on it";
    } else {
      const cs = range(Math.max(0.01, c * 0.3), c * 3, 161), bs = cs.map((v) => M.B(v));
      const bp = M.Bprime(c), h = 1e-4 * c, fdv = (M.B(c + h) - M.B(c - h)) / (2 * h);
      f = frame(chart, { x: [cs[0], cs[cs.length - 1]], y: [0, Math.max(...bs) * 1.08], aspect: 0.56, minH: 200, maxH: 290 });
      s = axes(f, { yl: "bound, B(c)", xl: "cost of time, c", grid: true });
      s += line(f, cs, bs, "ex");
      const x0 = Math.max(cs[0], c - c * 0.7), x1 = Math.min(cs[cs.length - 1], c + c * 0.9, c + (0.95 * bc) / -bp);
      s += line(f, [x0, x1], [bc + bp * (x0 - c), bc + bp * (x1 - c)], "guide");
      s += `<circle class="acc-dot" cx="${f.sx(c * 0.9).toFixed(1)}" cy="${f.sy(M.B(c * 0.9)).toFixed(1)}" r="3"/><circle class="acc-dot" cx="${f.sx(c * 1.1).toFixed(1)}" cy="${f.sy(M.B(c * 1.1)).toFixed(1)}" r="3"/>`;
      s += `<circle class="ink-dot" cx="${f.sx(c).toFixed(1)}" cy="${f.sy(bc).toFixed(1)}" r="4.5"/>`;
      s += `<text class="tag-ex" x="${(f.sx(c) + 8).toFixed(1)}" y="${(f.sy(bc) - 8).toFixed(1)}">slope ${fmt(bp, 3)}</text>`;
      o = { ...o, bp, fd: fdv };
      reads.innerHTML = `<div><dt>B′(c), closed form</dt><dd>${fmt(bp, 4)}</dd></div><div class="k-acc"><dt>Difference quotient</dt><dd>${fmt(fdv, 4)}<small>over ±0.01% of c</small></dd></div>`;
      label = "The constant-cost bound against the cost, with its tangent at the chosen cost";
    }
    chart.innerHTML = svg(f, s, label);
    say.textContent = S.inverseSay(step, o);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "iv-c", (v) => { c = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
const lazy = [["earn", earnPlate], ["allows", allowsPlate], ["value", valuePlate], ["peak", peakPlate], ["routes", routesPlate], ["double", doublePlate], ["inverse", inversePlate]];
for (const [id, fn] of lazy) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } });
}
