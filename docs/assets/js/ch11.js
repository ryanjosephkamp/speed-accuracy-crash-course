// Chapter 11's plates. Every number drawn comes from ch11-model.js (the information clock, the constant-kappa bound,
// the u-kernel, the three rules, the program over beliefs, Appendix B's bounds, each bound's flux and transform, and
// the program with two bounds), from kernel.js (chapter 6's kernel, for the symmetric case), or from the paper's
// Table 10 (as printed, and checked against paper/generated/tab_unknown.tex). The dynamic programs run in
// ch11-worker.js. The words under each plate come from say-ch11.js, which takes numbers and returns sentences.
import * as K from "./kernel.js?v=50386feefc";
import * as M from "./ch11-model.js?v=50386feefc";
import { PRESETS, DRAW, paramsOf, labelOf, defaultDrawing, costOf, deadlineOf, VIEW } from "./schedules-book.js?v=50386feefc";
import { getChoice, setChoice, solve, onVisible, liftReady, seedParam, wireStrips } from "./book.js?v=50386feefc";
import { frame, line, area, axes, svg, fmt, tags, keepDrawn } from "./chart.js?v=50386feefc";
import * as S from "./say-ch11.js?v=50386feefc";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const logRange = (a, b, n) => range(Math.log(a), Math.log(b), n).map(Math.exp);
const WORKER = new URL("./ch11-worker.js?v=50386feefc", import.meta.url);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const setSeg = (el, name, v) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = String(r.value) === String(v); });
const groups = [...new Set(PRESETS.map((p) => p.group))];
const pickHTML = (id) => `<label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
const fromPick = (v) => {
  if (v !== "draw") return { id: v, params: paramsOf({ id: v }) };
  const c = getChoice();
  return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() };
};
const vline = (f, x, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.sx(x).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
const hline = (f, y, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.l} ${f.sy(y).toFixed(1)}H${f.W - f.r}"/>`;
const text = (x, y, s, cls, anchor = "start") => `<text class="${cls}" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" text-anchor="${anchor}">${s}</text>`;
const dot = (f, x, y, cls, r = 4) => `<circle class="${cls}" cx="${f.sx(x).toFixed(1)}" cy="${f.sy(y).toFixed(1)}" r="${r}"/>`;
/** Labels along the top of a chart at data positions xs, pushed apart so none overlap: [{x, text, cls}]. */
function topLabels(f, items, y = null) {
  const Y = y ?? f.t - 6;
  const placed = items.map((d) => ({ ...d, px: f.sx(d.x), w: 7 * d.text.length })).sort((a, b) => a.px - b.px);
  for (let i = 1; i < placed.length; i++) {
    const need = placed[i - 1].px + placed[i - 1].w / 2 + placed[i].w / 2 + 4;
    if (placed[i].px < need) placed[i].px = need;
  }
  const over = placed.length ? placed[placed.length - 1].px + placed[placed.length - 1].w / 2 - (f.W - 2) : 0;
  if (over > 0) placed.forEach((d) => { d.px -= over; });
  for (let i = placed.length - 2; i >= 0; i--) { const lim = placed[i + 1].px - placed[i + 1].w / 2 - placed[i].w / 2 - 4; if (placed[i].px > lim) placed[i].px = lim; }
  return placed.map((d) => text(Math.max(d.w / 2 + 2, d.px), Y, d.text, d.cls, "middle")).join("");
}
const FLAG = {
  clock: "The change of clock is exact. What the paper builds on it, the bound and the kernel for a changing cost, is formal, not proved.",
  belief: "Steps 1 to 4 are exact: a posterior and changes of variable. Step 5 is the paper's calculation for a constant κ. Step 6 is formal, not proved.",
  rules: "Formal, not proved: the rules carry the known-reliability theory over to the information clock. The losses are the paper's measurements.",
  pair: "Part of an extension the paper calls formal: the bounds solve Appendix B's equations, which take the waiting region to be one interval.",
  appb: "Appendix B's derivation, from smooth fit and value matching. The paper states no theorem about it.",
  envelope: "Formal, not proved: the paper has not made the per-bound envelope argument rigorous, and checks it numerically.",
  sine: "Formal, not proved: the first-order curves come from the per-bound argument; the program is the measurement it is checked against.",
};
const flag = (id) => `<p class="conj-flag">${FLAG[id]}</p>`;
const fail = (id, e) => { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); };

// ---------------------------------------------------------------- the hero: one kernel per bound, sliding along a cost
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const c0 = 0.1, size = 0.3, om = 2, T = 4, rm = 0.25;
  const cost = (t) => c0 * (1 + size * Math.sin(om * t));
  const cb = M.constantBounds(c0, 1, rm), xs = M.xStar(1, rm), ft = M.fluxTotals(cb.lo, cb.hi);
  const dH = -ft.hi / (2 * c0), dL = ft.lo / (2 * c0), tr = M.transferAt(om, cb.lo, cb.hi);
  const ts = range(0, T, 161);
  const amp = c0 * size, rad = Math.PI / 180;
  const foH = ts.map((t) => cb.hi + dH * amp * tr.hi.gain * Math.sin(om * t + tr.hi.lead * rad));
  const foL = ts.map((t) => cb.lo + dL * amp * tr.lo.gain * Math.sin(om * t + tr.lo.lead * rad));
  // the per-moment bounds from 31 solutions across the cost's range, read by linear interpolation (for the drawing only)
  const cs = range(c0 * (1 - size), c0 * (1 + size), 31), tab = cs.map((c) => M.constantBounds(c, 1, rm));
  const pmAt = (c) => { const f = ((c - cs[0]) / (cs[30] - cs[0])) * 30, i = Math.max(0, Math.min(29, Math.floor(f))), u = f - i; return { hi: tab[i].hi * (1 - u) + tab[i + 1].hi * u, lo: tab[i].lo * (1 - u) + tab[i + 1].lo * u }; };
  const pmB = ts.map((t) => pmAt(cost(t)));
  const pmH = pmB.map((b) => b.hi), pmL = pmB.map((b) => b.lo);
  const bk = M.boundaryKernels(cb.lo, cb.hi), totH = bk.total("hi"), totL = bk.total("lo");
  const mh = bk.mean("hi"), ml = bk.mean("lo");
  const times = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3];
  let cur = 2;
  const draw = (i) => {
    cur = i;
    const t0 = times[i];
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(340, Math.max(260, W * 0.66)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 12, r = 10, sx = (t) => l + (t / T) * (W - l - r);
    const yc0 = 18, yc1 = Math.round(H * 0.2);                 // the cost strip
    const syC = (c) => yc0 + (1 - (c - c0 * (1 - size)) / (2 * c0 * size)) * (yc1 - yc0);
    const base = Math.round(H * 0.38), reach = Math.round(H * 0.14);   // the kernels, up and down from a line
    const yb0 = Math.round(H * 0.58), yb1 = H - 22;             // the bounds
    const lo = Math.min(...foL, ...pmL) - 0.08, hi = Math.max(...foH, ...pmH) + 0.08;
    const syB = (b) => yb0 + (1 - (b - lo) / (hi - lo)) * (yb1 - yb0);
    const path = (xs_, ys, sy) => xs_.map((x, k) => `${k ? "L" : "M"}${sx(x).toFixed(1)} ${sy(ys[k]).toFixed(1)}`).join("");
    let s = `<path class="cost" d="${path(ts, ts.map(cost), syC)}"/>`;
    s += text(l, 11, `cost, and each bound's weights from time ${t0.toFixed(1)}`, "lab");
    // the two kernels, forward from t0: the upper bound's above the line, the lower bound's below it
    const ss = logRange(0.004, T - t0, 120), cap = 3.2;
    const kh = ss.map((u) => Math.min(bk.flux("hi", u) / totH, cap)), kl = ss.map((u) => Math.min(bk.flux("lo", u) / totL, cap));
    const shape = (ks, sign) => `M${sx(t0).toFixed(1)} ${base}` + ss.map((u, j) => `L${sx(t0 + u).toFixed(1)} ${(base - sign * (ks[j] / cap) * reach).toFixed(1)}`).join("") + `L${sx(T).toFixed(1)} ${base}Z`;
    s += `<path class="wb-fill" d="${shape(kh, 1)}"/><path class="wb-fill" d="${shape(kl, -1)}"/>`;
    s += `<path class="ax" d="M${l} ${base}H${W - r}"/>`;
    s += text(W - r, base - 4, "upper bound's", "tk", "end") + text(W - r, base + 12, "lower bound's", "tk", "end");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${sx(t0).toFixed(1)} ${yc0}V${yb1}"/>`;
    // the bounds
    s += `<path class="dim" stroke-dasharray="4 4" d="M${l} ${syB(xs).toFixed(1)}H${W - r}"/>` + text(W - r, syB(xs) - 4, "x*", "tk", "end");
    s += `<path class="pm" d="${path(ts, pmH, syB)}"/><path class="pm" d="${path(ts, pmL, syB)}"/>`;
    const upto = ts.findIndex((t) => t > t0);
    s += `<path class="wb-thin" d="${path(ts, foH, syB)}"/><path class="wb-thin" d="${path(ts, foL, syB)}"/>`;
    s += `<path class="wb" d="${path(ts.slice(0, upto), foH.slice(0, upto), syB)}"/><path class="wb" d="${path(ts.slice(0, upto), foL.slice(0, upto), syB)}"/>`;
    s += `<circle class="wb-dot" cx="${sx(ts[upto - 1]).toFixed(1)}" cy="${syB(foH[upto - 1]).toFixed(1)}" r="4.5"/><circle class="wb-dot" cx="${sx(ts[upto - 1]).toFixed(1)}" cy="${syB(foL[upto - 1]).toFixed(1)}" r="4.5"/>`;
    s += text(l, yb0 - 6, "the bounds h and ℓ: first order (green), per moment (dashed)", "lab");
    s += text(sx(0), H - 6, "0", "tk") + text(sx(T), H - 6, `time ${T}`, "tk", "end");
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: times.length, draw, label: (i) => S.heroLabel(times[i], mh, ml) });
}

// ---------------------------------------------------------------- plate: your schedule on the information clock
function clockPlate() {
  const fig = plate("clock"), el = rootOf("clock");
  if (!el) return;
  const a = 1, TMAX = 10;
  let choice = getChoice(), guess = null, shown = false;
  el.innerHTML = `${flag("clock")}<div class="controls">${pickHTML("ck-pick")}</div>
    <div class="chart-wrap" id="ck-top"></div>
    <div class="predict"><p>Take a constant cost of time. Per unit of information time, does it stay the same, fall, or rise?</p>
      ${segHTML("ck-guess", [["flat", "Stays the same"], ["falls", "Falls"], ["rises", "Rises without bound"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="ck-show">Show me</button></div>
      <p class="verdict" id="ck-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="ck-bot" hidden></div>
    <ul class="legend" id="ck-legend" hidden><li><span class="key key-cost">κ(θ) = c(t)(t + a) on your schedule</span></li><li><span class="key key-guide">c(0)·a·e^θ, a constant cost</span></li></ul>
    <dl class="reads" id="ck-reads"></dl>`;
  const pick = $("#ck-pick", el), top = $("#ck-top", el), bot = $("#ck-bot", el), reads = $("#ck-reads", el), verdict = $("#ck-verdict", el), legend = $("#ck-legend", el);
  const info = () => { const cost = costOf(choice); return { cost, ...M.clockInfo(cost, deadlineOf(choice), a, TMAX) }; };
  const drawTop = () => {
    const { cost, deadline } = info();
    const ts = range(0, TMAX, 501), cs = ts.map((t) => cost(t)), fin = cs.filter(Number.isFinite);
    let lo = Math.min(...fin), hi = Math.max(...fin); if (hi / lo < 2) { const m = Math.sqrt(hi * lo); lo = m / 1.8; hi = m * 1.8; }
    const f = frame(top, { x: [0, TMAX], y: [lo / 1.25, hi * 1.25], ylog: true, aspect: 0.3, minH: 130, maxH: 190 });
    let g = axes(f, { yl: "cost of time c(t)", xl: "time t", grid: true }) + line(f, ts, cs, "cost");
    if (deadline !== null) g += vline(f, deadline, "acc", 'stroke-dasharray="2 4"') + text(f.sx(deadline) + 4, f.t + 10, "deadline", "tag-acc");
    top.innerHTML = svg(f, g, `The cost of time for ${labelOf(choice)}, from time 0 to 10, on a log scale`);
    liftReady(fig);
  };
  const drawBot = () => {
    if (!shown) { bot.hidden = true; legend.hidden = true; reads.innerHTML = ""; return; }
    bot.hidden = false; legend.hidden = false;
    const I = info();
    const th = I.ts.map((t) => M.thetaOf(t, a)), thMax = M.thetaOf(TMAX, a);
    const thG = range(0, thMax, 200), guide = thG.map((x) => I.k0 * Math.exp(x));
    const fin = [...I.ks, ...guide].filter((v) => Number.isFinite(v) && v > 0);
    const f = frame(bot, { x: [0, thMax], y: [Math.min(...fin) / 1.4, Math.max(...fin) * 1.4], ylog: true, aspect: 0.42, minH: 170, maxH: 250, t: 30 });
    let g = axes(f, { xl: "information time θ", grid: true });
    const marks = [1, 2.5, 5, 10];
    for (const t of marks) g += vline(f, M.thetaOf(t, a), "grid");
    g += topLabels(f, marks.map((t) => ({ x: M.thetaOf(t, a), text: t === 1 ? "t = 1" : String(t), cls: "tk" })), f.t - 8);
    g += line(f, thG, guide, "guide") + line(f, th, I.ks, "cost");
    if (I.deadline !== null) g += vline(f, M.thetaOf(I.deadline, a), "acc", 'stroke-dasharray="2 4"');
    bot.innerHTML = svg(f, g, `The cost per unit of information time for ${labelOf(choice)}, against information time, on a log scale, beside a constant cost`);
    reads.innerHTML = `<div class="k-acc"><dt>κ at the start</dt><dd>${fmt(I.k0, 3)}<small>c(0)·a</small></dd></div>
      <div class="k-acc"><dt>κ at t = ${I.tEnd}</dt><dd>${fmt(I.kEnd, 3)}<small>θ = ${fmt(M.thetaOf(I.tEnd, a), 2)}</small></dd></div>
      <div><dt>A constant cost there</dt><dd>${fmt(I.k0 * (I.tEnd + a) / a, 3)}<small>c(0)·(t + a), for comparison</small></dd></div>`;
    verdict.textContent = S.clockVerdict(guess, I);
    liftReady(fig);
  };
  pick.value = choice.id;
  pick.addEventListener("change", () => setChoice(fromPick(pick.value)));
  window.addEventListener("cc-schedule", (e) => { choice = e.detail; pick.value = choice.id; drawTop(); drawBot(); });
  onSeg(el, "ck-guess", (v) => { guess = v; shown = true; drawBot(); });
  $("#ck-show", el).addEventListener("click", () => { shown = true; drawBot(); });
  keepDrawn(top, drawTop); keepDrawn(bot, drawBot);
}

// ---------------------------------------------------------------- the strip's plate: from the prior to the bound
function beliefPlate() {
  const fig = plate("belief"), el = rootOf("belief");
  if (!el) return;
  const a = 1, DT = 0.005, TMAX = 10, KAPPA = 0.1;
  let step = +(fig.dataset.step || 0);
  // six seeded trials: a drift from the prior, then the evidence in Euler steps
  const R = K.rng(seedParam(2026) + 31);
  const trials = Array.from({ length: 6 }, () => {
    const mu = R.normal() / Math.sqrt(a);
    const t = [0], x = [0]; let X = 0;
    for (let k = 1; k <= Math.round(TMAX / DT); k++) { X += mu * DT + Math.sqrt(DT) * R.normal(); if (k % 10 === 0) { t.push(k * DT); x.push(X); } }
    return { mu, t, x };
  });
  const at = (tr, tq) => tr.x[Math.round(tq / (DT * 10))];
  el.innerHTML = `${flag("belief")}<p class="fine" id="bl-step"></p><div class="chart-wrap" id="bl-chart"></div><dl class="reads" id="bl-reads"></dl><p class="say" id="bl-say"></p>`;
  const chart = $("#bl-chart", el), reads = $("#bl-reads", el), say = $("#bl-say", el), head = $("#bl-step", el);
  // the kernel at the unrounded bound U(0.1); the weighted rule's cache rounds bounds to 0.01, but this step shows U itself
  const U = M.frozenBound(KAPPA), kern = M.survivalKernel((x) => x / 2, U, 240);
  const draw = () => {
    let f, g = "", label = "", n = {};
    reads.innerHTML = "";
    if (step === 0) {
      const tr = trials[0], ms = range(-3.5, 3.5, 281), dens = (m, s) => Math.exp(-0.5 * (m / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
      const post = [0.5, 2, 8].map((tq) => ({ tq, mean: at(tr, tq) / (tq + a), sd: 1 / Math.sqrt(tq + a), p: M.normCdf(at(tr, tq) / Math.sqrt(tq + a)) }));
      const top = Math.max(...post.map((p) => 1 / (p.sd * Math.sqrt(2 * Math.PI)))) * 1.18;
      f = frame(chart, { x: [-3.5, 3.5], y: [0, top], aspect: 0.52, minH: 190, maxH: 270, t: 30 });
      g = axes(f, { xl: "drift μ", grid: true });
      g += line(f, ms, ms.map((m) => dens(m, 1 / Math.sqrt(a))), "path-dim");
      post.forEach((p, k) => { g += line(f, ms, ms.map((m) => dens(m - p.mean, p.sd)), k === 2 ? "ex" : "ex-thin"); });
      g += vline(f, tr.mu, "acc", 'stroke-dasharray="3 3"') + text(f.sx(tr.mu), f.t - 6, "true μ", "tag-acc", "middle");
      n = { mu: tr.mu, p: post.map((p) => p.p) };
      reads.innerHTML = post.map((p) => `<div><dt>P(μ > 0) at t = ${p.tq}</dt><dd>${fmt(p.p, 3)}<small>Φ(X/√(t + a))</small></dd></div>`).join("");
      head.textContent = "Step 1: the prior (gray) and the posterior after one trial's evidence at t = 0.5 and 2 (thin) and t = 8 (ink).";
      label = "The prior density of the drift and the posterior at three times in one seeded trial";
    } else if (step === 1 || step === 2) {
      const ug = step === 2;
      const xsOf = (tr) => (ug ? tr.t.map((t) => M.thetaOf(t, a)) : tr.t);
      const ysOf = (tr) => (ug ? tr.x.map((x, i) => x / Math.sqrt(tr.t[i] + a)) : tr.x);
      const all = trials.flatMap(ysOf), lim = Math.max(...all.map(Math.abs)) * 1.08;
      f = frame(chart, { x: [0, ug ? M.thetaOf(TMAX, a) : TMAX], y: [-lim, lim], aspect: 0.52, minH: 190, maxH: 270 });
      g = axes(f, { yl: ug ? "belief variable u = X/√(t + a)" : "evidence X", xl: ug ? "information time θ" : "time t", grid: true, zero: true });
      trials.forEach((tr, k) => { if (k) g += line(f, xsOf(tr), ysOf(tr), "path-dim"); });
      g += line(f, xsOf(trials[0]), ysOf(trials[0]), "ex");
      n = { thetaEnd: M.thetaOf(TMAX, a) };
      reads.innerHTML = `<div><dt>Drifts drawn</dt><dd style="font-size:1rem">${trials.map((tr) => fmt(tr.mu, 2)).join(", ")}</dd></div>`;
      head.textContent = ug ? "Step 3: the same trials on the information clock, as u against θ." : "Step 2: six trials in real time, the first in ink.";
      label = ug ? "Six seeded trials as the belief variable against information time" : "Six seeded trials of the evidence against time";
    } else if (step === 3) {
      const th = range(0, M.thetaOf(TMAX, a), 120), cs = [0.02, 0.1, 0.4];
      f = frame(chart, { x: [0, M.thetaOf(TMAX, a)], y: [0.01, 8], ylog: true, aspect: 0.52, minH: 190, maxH: 270 });
      g = axes(f, { yl: "κ(θ) for a constant cost", xl: "information time θ", grid: true });
      cs.forEach((c) => { g += line(f, th, th.map((x) => c * a * Math.exp(x)), "cost"); });
      g += tags(f, cs.map((c) => ({ y: c * a * Math.exp(th[th.length - 1]), text: `c = ${c}`, cls: "tag-acc" })));
      n = {};
      head.textContent = "Step 4: a constant cost on the information clock, κ = c·a·e^θ.";
      label = "The cost per unit of information time for three constant costs, on a log scale";
    } else if (step === 4) {
      const X = U * 1.2, us = range(0, X, 160), ys = us.map((u) => 2 * KAPPA * Math.exp(u * u / 2));
      const inside = us.filter((u) => u <= U);
      f = frame(chart, { x: [0, X], y: [0, Math.max(...ys) * 1.1], aspect: 0.52, minH: 190, maxH: 270 });
      g = axes(f, { yl: "κ × speed density, 2κe^(u²/2)", xl: "belief variable u", grid: true });
      g += area(f, [...inside, U], [...inside.map((u) => 2 * KAPPA * Math.exp(u * u / 2)), 2 * KAPPA * Math.exp(U * U / 2)], 0, "wb-fill") + line(f, us, ys, "wb");
      g += vline(f, U, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(U) - 4, f.t + 10, "U(κ)", "tag-ex", "end");
      const N = 400; let A = 0; for (let i = 0; i <= N; i++) { const u = (U * i) / N; A += (i === 0 || i === N ? 0.5 : 1) * 2 * KAPPA * Math.exp(u * u / 2); } A *= U / N;
      n = { kappa: KAPPA, U, area: A, target: 1 / Math.sqrt(2 * Math.PI) };
      reads.innerHTML = `<div><dt>U(κ) at κ = ${KAPPA}</dt><dd>${fmt(U, 4)}</dd></div><div class="k-wb"><dt>Shaded area</dt><dd>${fmt(A, 4)}<small>1/√(2π) = ${fmt(n.target, 4)}</small></dd></div>`;
      head.textContent = "Step 5: for a constant κ, the cost times the speed density, integrated to the bound, is Φ′/s′.";
      label = "The cost times the speed density of the belief variable, shaded from 0 to the constant-kappa bound";
    } else {
      const { s, w, edges } = kern, keep = [];
      for (let i = 0; i < s.length; i++) if (s[i] >= 1e-3) keep.push(i);
      const dens0 = keep.map((i) => w[i] / (edges[i + 1] - edges[i])), sx_ = keep.map((i) => s[i]);
      const mean = M.kernelMean(kern), yMax = Math.max(...dens0) * 1.5, yMin = yMax * 1e-5;
      const dens = dens0.map((v) => (v >= yMin ? v : NaN));
      f = frame(chart, { x: [1e-3, sx_[sx_.length - 1]], y: [yMin, yMax], xlog: true, ylog: true, aspect: 0.52, minH: 190, maxH: 270 });
      g = axes(f, { yl: "kernel weight per unit of θ", xl: "information time ahead, s", grid: true });
      g += line(f, sx_, dens, "wb");
      g += vline(f, mean, "wb", 'stroke-dasharray="3 3"') + text(f.sx(mean) + 5, f.t + 12, `mean ${fmt(mean, 3)}`, "tag-wb");
      n = { U, mean, realAhead: (1 + a) * (Math.exp(mean) - 1) };
      reads.innerHTML = `<div class="k-wb"><dt>Mean look-ahead</dt><dd>${fmt(mean, 3)}<small>units of θ, at U = ${fmt(U, 3)}</small></dd></div>
        <div><dt>From t = 1, θ + mean is</dt><dd>${fmt(n.realAhead, 2)}<small>time units later, (t + a)(e^mean − 1)</small></dd></div>`;
      head.textContent = "Step 6 (formal): the u process's kernel for that bound, from the paper's finite-difference generator.";
      label = "The kernel of the belief variable's decision time for the constant-kappa bound, on log axes";
    }
    chart.innerHTML = svg(f, g, label);
    say.textContent = S.beliefStep(step, n);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: three rules beside the program
function rulesPlate() {
  const fig = plate("rules"), el = rootOf("rules");
  if (!el) return;
  const rows = M.TABLE10.map((r, i) => ({ label: r[0].replace(/\$/g, ""), losses: r.slice(1), choice: M.TABLE10_CHOICES[i] }));
  let sel = 1, gen = 0, data = null;
  const optHTML = () => rows.map((r, i) => `<option value="${i}">${r.label}</option>`).join("") + `<option value="yours">Your schedule: ${labelOf(getChoice())}</option>`;
  el.innerHTML = `${flag("rules")}<div class="controls"><label class="dial pick-dial"><span class="ctl-key">Schedule</span><span></span><select class="pick" id="ru-pick">${optHTML()}</select></label></div>
    <div class="chart-wrap" id="ru-cost"></div><div class="chart-wrap" id="ru-chart"></div>
    <ul class="legend"><li><span class="key key-ex">Program over beliefs</span></li><li><span class="key key-pm">Frozen-time</span></li><li><span class="key key-wb">Weighted, information time</span></li><li><span class="key key-plug">Plug-in</span></li></ul>
    <div class="chart-wrap" id="ru-bars" style="margin-top:14px"></div>
    <dl class="reads" id="ru-reads"></dl><p class="say" id="ru-say"></p><p class="fine" id="ru-state" aria-live="polite"></p>`;
  const pick = $("#ru-pick", el), costEl = $("#ru-cost", el), chart = $("#ru-chart", el), bars = $("#ru-bars", el), reads = $("#ru-reads", el), say = $("#ru-say", el), state = $("#ru-state", el);
  pick.value = String(sel);
  const current = () => (sel === "yours" ? { label: labelOf(getChoice()), losses: null, choice: getChoice() } : rows[sel]);
  const drawCost = () => {
    const cur = current(), cost = costOf(cur.choice), dl = deadlineOf(cur.choice), view = dl ?? VIEW;
    const ts = range(0, view, 251), cs = ts.map((t) => cost(t)), fin = cs.filter(Number.isFinite);
    let lo = Math.min(...fin), hi = Math.max(...fin); if (hi / lo < 2) { const m = Math.sqrt(hi * lo); lo = m / 1.8; hi = m * 1.8; }
    const f = frame(costEl, { x: [0, view], y: [lo / 1.2, hi * 1.2], ylog: true, aspect: 0.2, minH: 90, maxH: 130, b: 22 });
    costEl.innerHTML = svg(f, axes(f, { yl: "cost of time", yt: [] }) + line(f, ts, cs, "cost"), `The cost of time for ${cur.label}`);
  };
  const drawChart = () => {
    if (!data) { chart.innerHTML = ""; return; }
    // before a deadline only: at the deadline every rule's choice is forced, so no curve is drawn there
    const dl = data.deadline, idx = M.shownBefore(data.t, dl), pick = (arr) => idx.map((i) => arr[i]);
    const t = pick(data.t), exact = pick(data.exact), frozen = pick(data.frozen), weighted = pick(data.weighted), plug = pick(data.plug);
    const all = [...exact, ...frozen, ...weighted, ...plug].filter(Number.isFinite);
    const f = frame(chart, { x: [0, dl ?? t[t.length - 1]], y: [0, Math.max(...all) * 1.08], aspect: 0.5, minH: 190, maxH: 290, t: dl === null ? 22 : 30 });
    let g = axes(f, { yl: dl === null ? "evidence bound X(t)" : "", xl: "time t", grid: true });
    g += line(f, t, frozen, "pm") + line(f, t, plug, "plug") + line(f, t, weighted, "wb") + line(f, t, exact, "ex");
    if (dl !== null) g += `<path class="acc" stroke-dasharray="2 4" d="M${f.sx(dl).toFixed(1)} ${f.t}V${f.H - f.b}"/>` + text(f.sx(dl) - 4, f.t - 8, "deadline: every rule decides", "tag-acc", "end");
    chart.innerHTML = svg(f, g, `For ${current().label}: the exact policy's evidence bound beside the frozen-time, weighted, and plug-in rules`);
    liftReady(fig);
  };
  const drawBars = () => {
    const cur = current();
    if (!cur.losses) { bars.innerHTML = ""; bars.hidden = true; return; }
    bars.hidden = false;
    const names = [["Frozen-time", "bar-pm"], ["Weighted", "bar-wb"], ["Plug-in", "bar-plug"], ["Tuned constant", "bar-dim"]];
    const vals = cur.losses.map(Number), top = Math.max(...vals, 1e-3) * 1.15;
    const W = Math.max(260, Math.round(bars.clientWidth || 340)), rowH = 24, H = 22 + rowH * 4 + 6, l = 108, r = 44;
    const sx = (v) => l + (v / top) * (W - l - r);
    let g = text(2, 13, "loss, points per 100 trials (Table 10)", "lab");
    names.forEach(([nm, cls], k) => {
      const y = 22 + k * rowH;
      g += text(l - 6, y + 14, nm, "tk", "end");
      g += `<rect class="${cls}" x="${l}" y="${y + 3}" width="${Math.max(1, sx(vals[k]) - l).toFixed(1)}" height="${rowH - 9}"/>`;
      g += text(sx(vals[k]) + 4, y + 14, cur.losses[k], "tk");
    });
    bars.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The paper's losses for ${cur.label.replace(/"/g, "")}: ${names.map(([nm], k) => `${nm} ${cur.losses[k]}`).join(", ")}">${g}</svg>`;
  };
  const sentence = () => {
    if (!data) return;
    const { exact, frozen, weighted } = data, st = M.rulesStats(data, data.deadline);
    const cur = current();
    say.textContent = S.rulesSay({ ...st, losses: cur.losses });
    reads.innerHTML = `<div class="k-pm"><dt>Frozen-time − program, t = 0</dt><dd>${fmt(frozen[0] - exact[0], 3)}</dd></div>
      <div class="k-wb"><dt>Weighted − program, t = 0</dt><dd>${fmt(weighted[0] - exact[0], 3)}</dd></div>
      <div><dt>Program's bound, t = 0</dt><dd>${fmt(exact[0], 3)}<small>evidence units</small></dd></div>`;
  };
  const run = () => {
    const my = ++gen;
    data = null; drawCost(); drawChart(); drawBars(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the program over beliefs and the rules…";
    solve({ job: "unknown", choice: current().choice }, { key: "rules", worker: WORKER, progress: (p) => { if (my === gen) state.textContent = `Solving the program over beliefs and the rules… ${Math.round(p * 100)}%`; } }).then((m) => {
      if (my !== gen) return;
      data = m;
      state.textContent = "Belief grid of 300, steps of 0.005, forced choice at 10 or the deadline; rules moved in by 0.5826√0.005.";
      drawChart(); sentence();
    }).catch((e) => { if (e.message !== "superseded" && my === gen) state.textContent = "The solver stopped: " + e.message; });
  };
  pick.addEventListener("change", () => { sel = pick.value === "yours" ? "yours" : +pick.value; run(); });
  window.addEventListener("cc-schedule", () => {
    const o = pick.querySelector('option[value="yours"]'); if (o) o.textContent = `Your schedule: ${labelOf(getChoice())}`;
    if (sel === "yours") run();
  });
  keepDrawn(costEl, drawCost); keepDrawn(chart, drawChart); keepDrawn(bars, drawBars);
  run();
}

// ---------------------------------------------------------------- plate: two bounds around the indifference point
function pairPlate() {
  const fig = plate("pair"), el = rootOf("pair");
  if (!el) return;
  let lr = 0, lc = -1, guess = null, told = false;
  el.innerHTML = `${flag("pair")}<div class="predict"><p>If a correct “−” pays a quarter of a correct “+”, which bound moves more from ±B(c)?</p>
      ${segHTML("pa-guess", [["upper", "The upper (“+”)"], ["lower", "The lower (“−”)"], ["same", "About the same"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="pa-show">Show me</button></div>
      <p class="verdict" id="pa-verdict" aria-live="polite"></p></div>
    <div class="controls"><label class="dial" style="flex:1 1 12rem"><span class="ctl-key">Reward for “−” ÷ for “+”</span><output id="pa-rout"></output>
      <input type="range" id="pa-r" min="${Math.log10(0.05)}" max="0" step="0.005" value="${lr}" aria-label="The ratio of the rewards, on a log scale"></label>
      <label class="dial" style="flex:1 1 12rem"><span class="ctl-key">Cost of time c</span><output id="pa-cout"></output>
      <input type="range" id="pa-c" min="-2" max="0" step="0.01" value="${lc}" aria-label="The cost of time, on a log scale"></label></div>
    <div class="chart-wrap" id="pa-value"></div>
    <ul class="legend"><li><span class="key key-ex">Value of waiting V</span></li><li><span class="key key-dim">Reward for deciding G</span></li></ul>
    <div class="chart-wrap" id="pa-ratio"></div>
    <ul class="legend"><li><span class="key key-ex">Bounds h (upper) and ℓ (lower)</span></li><li><span class="key key-xstar">x*</span></li><li><span class="key key-guide">±B(c), equal rewards</span></li></ul>
    <dl class="reads" id="pa-reads"></dl><p class="say" id="pa-say"></p>`;
  const vEl = $("#pa-value", el), rEl = $("#pa-ratio", el), reads = $("#pa-reads", el), say = $("#pa-say", el), verdict = $("#pa-verdict", el);
  const rIn = $("#pa-r", el), cIn = $("#pa-c", el), rOut = $("#pa-rout", el), cOut = $("#pa-cout", el);
  const RATIOS = logRange(0.05, 1, 41);
  const curves = new Map();
  const curveFor = (c) => { const k = c.toFixed(4); if (!curves.has(k)) curves.set(k, RATIOS.map((q) => M.constantBounds(c, 1, q))); return curves.get(k); };
  const now = () => {
    const ratio = 10 ** lr, c = 10 ** lc, cb = M.constantBounds(c, 1, ratio), xs = M.xStar(1, ratio), B = K.B(c);
    return { ratio, c, cb, lo: cb.lo, hi: cb.hi, xs, B, gPlus: M.belief(cb.hi), gMinus: 1 - M.belief(cb.lo) };
  };
  const draw = () => {
    const n = now();
    rOut.textContent = fmt(n.ratio, 2); cOut.textContent = fmt(n.c, 3);
    // the value and the reward for deciding, over the evidence
    const x0 = Math.min(n.lo, -n.B, 0) - 0.5, x1 = Math.max(n.hi, n.B, 0) + 0.5;
    const xs = range(x0, x1, 241), G = xs.map((x) => M.stopReward(x, 1, n.ratio));
    const inside = xs.filter((x) => x > n.lo && x < n.hi), V = [n.lo, ...inside, n.hi].map((x) => M.valueAt(x, n.c, 1, n.ratio, n.cb));
    const yLo = Math.min(...G), yHi = Math.max(...G, ...V);
    const f = frame(vEl, { x: [x0, x1], y: [yLo - 0.04 * (yHi - yLo), yHi + 0.06 * (yHi - yLo)], aspect: 0.5, minH: 190, maxH: 270, t: 30 });
    let g = axes(f, { xl: "evidence x", grid: true });
    g += line(f, xs, G, "path-dim") + line(f, [n.lo, ...inside, n.hi], V, "ex");
    g += vline(f, n.lo, "bound-line", 'stroke-dasharray="3 3"') + vline(f, n.hi, "bound-line", 'stroke-dasharray="3 3"') + vline(f, n.xs, "xstar");
    g += `<path class="acc" d="M${f.sx(0).toFixed(1)} ${f.H - f.b}v-9"/>`;
    g += topLabels(f, [{ x: n.lo, text: "ℓ", cls: "tag-ex" }, { x: n.xs, text: "x*", cls: "tk" }, { x: n.hi, text: "h", cls: "tag-ex" }, { x: 0, text: "start", cls: "tag-acc" }], f.t - 8);
    vEl.innerHTML = svg(f, g, `The value of waiting and the reward for deciding, with the bounds, at a reward ratio of ${fmt(n.ratio, 2)} and a cost of ${fmt(n.c, 3)}`);
    // the bounds against the ratio
    const cv = curveFor(n.c);
    const fr = frame(rEl, { x: [0.05, 1], y: [Math.min(...cv.map((b) => b.lo), -n.B) - 0.15, Math.max(n.B, ...cv.map((b) => b.hi)) + 0.15], xlog: true, aspect: 0.48, minH: 180, maxH: 250 });
    let h = axes(fr, { yl: "bounds h and ℓ", xl: "reward for “−” ÷ reward for “+”", grid: true, zero: true });
    h += line(fr, [0.05, 1], [n.B, n.B], "guide") + line(fr, [0.05, 1], [-n.B, -n.B], "guide");
    h += line(fr, RATIOS, RATIOS.map((q) => M.xStar(1, q)), "xstar");
    h += line(fr, RATIOS, cv.map((b) => b.hi), "ex") + line(fr, RATIOS, cv.map((b) => b.lo), "ex");
    h += dot(fr, n.ratio, n.hi, "acc-dot", 4.5) + dot(fr, n.ratio, n.lo, "acc-dot", 4.5);
    rEl.innerHTML = svg(fr, h, `The two bounds against the ratio of the rewards, at a cost of ${fmt(n.c, 3)}`);
    reads.innerHTML = `<div><dt>Lower bound ℓ</dt><dd>${fmt(n.lo, 3)}<small>chooses “−”; belief in “−” ${fmt(100 * n.gMinus, 1)}%</small></dd></div>
      <div><dt>Indifference x*</dt><dd>${fmt(n.xs, 3)}<small>half the log of the ratio</small></dd></div>
      <div><dt>Upper bound h</dt><dd>${fmt(n.hi, 3)}<small>chooses “+”; belief in “+” ${fmt(100 * n.gPlus, 1)}%</small></dd></div>`;
    say.textContent = S.pairSay(n);
    if (told) verdict.textContent = S.pairVerdict(guess, n);
    liftReady(fig);
  };
  const reveal = () => { told = true; lr = Math.log10(0.25); rIn.value = lr; draw(); };
  rIn.addEventListener("input", () => { lr = +rIn.value; draw(); });
  cIn.addEventListener("input", () => { lc = +cIn.value; draw(); });
  onSeg(el, "pa-guess", (v) => { guess = v; reveal(); });
  $("#pa-show", el).addEventListener("click", reveal);
  keepDrawn(vEl, draw);
}

// ---------------------------------------------------------------- the strip's plate: Appendix B, a step at a time
function appbPlate() {
  const fig = plate("appb"), el = rootOf("appb");
  if (!el) return;
  const c = 0.1;
  let ratio = 0.25, step = +(fig.dataset.step || 0);
  el.innerHTML = `${flag("appb")}<div class="controls">${segHTML("ab-r", [[1, "1"], [0.5, "0.5"], [0.25, "0.25"]], ratio, "Reward for “−” ÷ reward for “+”")}</div>
    <p class="fine" id="ab-step"></p><div class="chart-wrap" id="ab-chart"></div><dl class="reads" id="ab-reads"></dl><p class="say" id="ab-say"></p>`;
  const chart = $("#ab-chart", el), reads = $("#ab-reads", el), say = $("#ab-say", el), head = $("#ab-step", el);
  const draw = () => {
    const rp = 1, rm = ratio, cb = M.constantBounds(c, rp, rm), xs = M.xStar(rp, rm);
    const n = { ratio, rp, rm, K: cb.K, lo: cb.lo, hi: cb.hi, xs, gapS: M.Sfun(cb.hi) - M.Sfun(cb.lo), gapWant: (rp + rm) / (2 * c) };
    let f, g = "", label = "";
    reads.innerHTML = "";
    if (step === 0) {
      const X = range(-2.4, 2, 221), up = X.map((x) => rp * M.belief(x)), dn = X.map((x) => rm * (1 - M.belief(x)));
      f = frame(chart, { x: [-2.4, 2], y: [0, 1.05], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "expected reward for deciding", xl: "evidence x", grid: true });
      g += line(f, X, up, "ex") + line(f, X, dn, "ex-thin") + dot(f, xs, rp * M.belief(xs), "ink-dot", 4.5);
      g += text(f.W - f.r - 2, f.sy(up[up.length - 1]) + 16, "choose “+”", "tag-ex", "end");
      g += text(f.sx(-2.35), f.sy(dn[0]) - 9, "choose “−”", "tag-ex");
      g += vline(f, xs, "dim", 'stroke-dasharray="1 3"') + text(f.sx(xs) + 5, f.H - f.b - 6, "x*", "tk");
      head.textContent = "Step 1: the two rewards for deciding, and where they cross.";
      label = "The expected rewards for choosing plus and choosing minus against the evidence, crossing at the indifference point";
    } else if (step === 1 || step === 2) {
      const x0 = cb.lo - 0.5, x1 = cb.hi + 0.5, X = range(x0, x1, 241), Y = X.map((x) => c * M.Sfun(x) + cb.K);
      const ins = X.map((x) => x >= cb.lo && x <= cb.hi);
      const yl = Math.max(Math.min(...Y), -0.5 * rm - 0.4), yh = Math.min(Math.max(...Y), 0.5 * rp + 0.4);
      f = frame(chart, { x: [x0, x1], y: [yl, yh], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "cosh²x · V′(x) = c S(x) + K", xl: "evidence x", grid: true, zero: true });
      g += line(f, X, Y.map((v) => (v >= yl && v <= yh ? v : NaN)), "ex-thin") + line(f, X.filter((_, i) => ins[i]), Y.filter((_, i) => ins[i]), "ex");
      if (step === 2) {
        g += hline(f, 0.5 * rp, "acc", 'stroke-dasharray="4 3"') + hline(f, -0.5 * rm, "acc", 'stroke-dasharray="4 3"');
        g += text(f.sx(cb.hi) - 8, f.sy(0.5 * rp) - 6, "half the “+” reward", "tag-acc", "end") + text(f.W - f.r - 2, f.sy(-0.5 * rm) + 15, "minus half the “−” reward", "tag-acc", "end");
        g += dot(f, cb.hi, 0.5 * rp, "acc-dot", 4.5) + dot(f, cb.lo, -0.5 * rm, "acc-dot", 4.5);
        g += vline(f, cb.hi, "bound-line", 'stroke-dasharray="3 3"') + vline(f, cb.lo, "bound-line", 'stroke-dasharray="3 3"');
        reads.innerHTML = `<div><dt>S(h) − S(ℓ)</dt><dd>${fmt(n.gapS, 4)}</dd></div><div class="k-acc"><dt>Sum of the rewards ÷ 2c</dt><dd>${fmt(n.gapWant, 4)}</dd></div>`;
      } else reads.innerHTML = `<div><dt>K</dt><dd>${fmt(cb.K, 4)}</dd></div>`;
      head.textContent = step === 1 ? "Step 2: the value's equation, integrated once." : "Step 3: smooth fit sets the curve's value at each bound.";
      label = "Cosh squared times the slope of the value, c S(x) + K, inside the waiting region and continued past it";
    } else if (step === 3) {
      const H = logRange(1e-3, 3, 200).map((d) => xs + d);
      const Rs = H.map((h) => M.matching(h, c, rp, rm).resid);
      const lim = Math.max(...Rs.filter((v, i) => H[i] <= cb.hi + 1).map(Math.abs)) * 1.2;
      f = frame(chart, { x: [xs, xs + 3], y: [-lim, lim], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "value matching's residual", xl: "trial upper bound h", grid: true, zero: true });
      g += line(f, H, Rs.map((v) => (Math.abs(v) <= lim ? v : NaN)), "ex") + dot(f, cb.hi, 0, "acc-dot", 4.5);
      g += text(f.sx(cb.hi) + 6, f.sy(0) - 7, `h = ${fmt(cb.hi, 3)}`, "tag-acc");
      reads.innerHTML = `<div><dt>Root h</dt><dd>${fmt(cb.hi, 4)}</dd></div><div><dt>Then ℓ</dt><dd>${fmt(cb.lo, 4)}</dd></div>`;
      head.textContent = "Step 4: value matching, as a function of the trial bound h.";
      label = "Value matching's residual against a trial upper bound, with its root";
    } else {
      const Rr = logRange(0.25, 4, 120), Bline = Rr.map((r) => K.B(c / r)), Rd = logRange(0.25, 4, 9);
      const Hd = Rd.map((r) => M.constantBounds(c, r, r).hi);
      n.worst = Math.max(...Rd.map((r, i) => Math.abs(Hd[i] - K.B(c / r))));
      f = frame(chart, { x: [0.25, 4], y: [0, Math.max(...Bline) * 1.08], xlog: true, aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "upper bound h", xl: "common reward r", grid: true });
      g += line(f, Rr, Bline, "ex") + Rd.map((r, i) => dot(f, r, Hd[i], "ink-dot", 3.5)).join("");
      reads.innerHTML = `<div><dt>Largest gap to B(c/r)</dt><dd>${n.worst.toExponential(0)}</dd></div>`;
      head.textContent = "Step 5: a common reward r, with B(c/r) for comparison.";
      label = "The upper bound for a common reward r from Appendix B's equations, beside the flat bound at cost c over r";
    }
    chart.innerHTML = svg(f, g, label);
    say.textContent = S.appbSay(step, n);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "ab-r", (v) => { ratio = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- the strip's plate: each bound's kernel
function envelopePlate() {
  const fig = plate("envelope"), el = rootOf("envelope");
  if (!el) return;
  const c0 = 0.1, dc = 0.02;
  let ratio = 0.5, step = +(fig.dataset.step || 0);
  el.innerHTML = `${flag("envelope")}<div class="controls">${segHTML("en-r", [[1, "1"], [0.5, "0.5"], [0.25, "0.25"]], ratio, "Reward for “−” ÷ reward for “+”")}</div>
    <p class="fine" id="en-step"></p><div class="chart-wrap" id="en-chart"></div><dl class="reads" id="en-reads"></dl><p class="say" id="en-say"></p>`;
  const chart = $("#en-chart", el), reads = $("#en-reads", el), say = $("#en-say", el), head = $("#en-step", el);
  const cache = new Map();
  const setup = (q) => {
    if (cache.has(q)) return cache.get(q);
    const cb = M.constantBounds(c0, 1, q), ft = M.fluxTotals(cb.lo, cb.hi), bk = M.boundaryKernels(cb.lo, cb.hi);
    const up = M.constantBounds(c0 + dc, 1, q), hs = 1e-5, p = M.constantBounds(c0 + hs, 1, q), m = M.constantBounds(c0 - hs, 1, q);
    const cd = { hi: (p.hi - m.hi) / (2 * hs), lo: (p.lo - m.lo) / (2 * hs) };
    const slope = { hi: -ft.hi / (2 * c0), lo: ft.lo / (2 * c0) };
    const o = { q, cb, ft, bk, up, cd, slope, mh: bk.mean("hi"), ml: bk.mean("lo"), th: bk.total("hi"), tl: bk.total("lo") };
    cache.set(q, o);
    return o;
  };
  const draw = () => {
    const o = setup(step === 4 ? 1 : ratio), { cb, ft } = o, rp = 1, rm = o.q;
    const V_G = (x) => M.valueAt(x, c0, rp, rm, cb) - M.stopReward(x, rp, rm);
    const X = range(cb.lo, cb.hi, 241);
    let f, g = "", label = "", n = { c0, dc, th: ft.hi, tl: ft.lo, mh: o.mh, ml: o.ml };
    reads.innerHTML = "";
    if (step === 0) {
      const m = X.map((x) => M.meanExit(x, cb.lo, cb.hi));
      let mMax = 0, mAt = 0; m.forEach((v, i) => { if (v > mMax) { mMax = v; mAt = X[i]; } });
      f = frame(chart, { x: [cb.lo - 0.2, cb.hi + 0.2], y: [0, mMax * 1.25], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "mean exit time", xl: "evidence x", grid: true });
      g += line(f, X, m, "ex");
      const d = 0.35 * Math.min(mMax / Math.max(ft.hi, ft.lo), cb.hi - cb.lo);
      g += line(f, [cb.hi - d, cb.hi], [ft.hi * d, 0], "acc") + line(f, [cb.lo, cb.lo + d], [0, ft.lo * d], "acc");
      g += text(f.sx(cb.hi - d) - 4, f.sy(ft.hi * d) - 4, `slope −${fmt(ft.hi, 2)}`, "tag-acc", "end") + text(f.sx(cb.lo + d) + 4, f.sy(ft.lo * d) - 4, `slope ${fmt(ft.lo, 2)}`, "tag-acc");
      n.mMax = mMax; n.mAt = mAt;
      reads.innerHTML = `<div class="k-acc"><dt>Flux total at h₀</dt><dd>${fmt(ft.hi, 4)}<small>−m′(h₀)</small></dd></div><div class="k-acc"><dt>Flux total at ℓ₀</dt><dd>${fmt(ft.lo, 4)}<small>m′(ℓ₀)</small></dd></div>`;
      head.textContent = "Step 1: the mean time to leave the waiting region, from each start.";
      label = "The mean exit time from the waiting region against the start, with its slopes at the two bounds";
    } else if (step === 1) {
      const vg = X.map(V_G), top = Math.max(...vg) * 1.15;
      f = frame(chart, { x: [cb.lo - 0.2, cb.hi + 0.2], y: [0, top], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "V − G", xl: "evidence x", grid: true });
      const w = Math.min(0.6, (cb.hi - cb.lo) / 2);
      const Ph = range(cb.hi - w, cb.hi, 40), Pl = range(cb.lo, cb.lo + w, 40);
      g += line(f, X, vg, "ex") + line(f, Ph, Ph.map((x) => c0 * (x - cb.hi) ** 2), "acc", 'stroke-dasharray="4 3"') + line(f, Pl, Pl.map((x) => c0 * (x - cb.lo) ** 2), "acc", 'stroke-dasharray="4 3"');
      g += text(f.sx(cb.hi) - 4, f.sy(c0 * w * w) - 6, "c₀(x − h₀)²", "tag-acc", "end") + text(f.sx(cb.lo) + 4, f.sy(c0 * w * w) - 6, "c₀(x − ℓ₀)²", "tag-acc");
      head.textContent = "Step 2: waiting minus deciding, and its curvature just inside each bound.";
      label = "The value of waiting minus the reward for deciding over the waiting region, with parabolas of curvature 2 c0 at the bounds";
    } else if (step === 2) {
      // slopes: (V - G)' and (V - G)' - dc m', near each end only (G has a kink at x*, where the slope jumps);
      // where each crosses 0 is a bound
      const dx = 1e-5, xsr = M.xStar(rp, rm);
      const Xh = range(Math.max(cb.hi - 0.55, xsr + 0.04), cb.hi - 0.001, 90), Xl = range(cb.lo + 0.001, Math.min(cb.lo + 0.55, xsr - 0.04), 90);
      const mp = (x) => (M.meanExit(x + dx, cb.lo, cb.hi) - M.meanExit(x - dx, cb.lo, cb.hi)) / (2 * dx);
      const sl = (x) => (V_G(x + dx) - V_G(x - dx)) / (2 * dx);
      const s0h = Xh.map(sl), s0l = Xl.map(sl), s1h = Xh.map((x, i) => s0h[i] - dc * mp(x)), s1l = Xl.map((x, i) => s0l[i] - dc * mp(x));
      const lim = Math.max(...[...s0h, ...s0l, ...s1h, ...s1l].map(Math.abs)) * 1.1;
      f = frame(chart, { x: [cb.lo - 0.2, cb.hi + 0.2], y: [-lim, lim], aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "slope of V − G, near each bound", xl: "evidence x", grid: true, zero: true });
      g += line(f, Xh, s0h, "ex") + line(f, Xl, s0l, "ex") + line(f, Xh, s1h, "wb") + line(f, Xl, s1l, "wb");
      // the straight-line approximation of the green slope at each bound: 2 c0 (x - h0) + dc n_h-total, and
      // 2 c0 (x - l0) - dc n_l-total; these cross 0 exactly at the first-order bounds
      const lin = (X, b0, k) => X.map((x) => Math.max(-lim, Math.min(lim, 2 * c0 * (x - b0) + k)));
      g += line(f, Xh, lin(Xh, cb.hi, dc * ft.hi), "wb", 'stroke-dasharray="5 4" opacity="0.7"') + line(f, Xl, lin(Xl, cb.lo, -dc * ft.lo), "wb", 'stroke-dasharray="5 4" opacity="0.7"');
      const cross = (X, Y) => { for (let i = 1; i < X.length; i++) if (Math.sign(Y[i]) !== Math.sign(Y[i - 1])) return X[i - 1] - (Y[i - 1] * (X[i] - X[i - 1])) / (Y[i] - Y[i - 1]); return NaN; };
      n.dhCurve = cross(Xh, s1h) - cb.hi; n.dlCurve = cross(Xl, s1l) - cb.lo;
      g += vline(f, xsr, "dim", 'stroke-dasharray="1 3"') + text(f.sx(xsr), f.t - 6, "x*", "tk", "middle");
      const hFo = cb.hi + dc * o.slope.hi, lFo = cb.lo + dc * o.slope.lo;
      g += dot(f, cb.hi, 0, "ink-dot", 4) + dot(f, cb.lo, 0, "ink-dot", 4) + dot(f, hFo, 0, "wb-dot", 4) + dot(f, lFo, 0, "wb-dot", 4);
      g += `<path class="acc" d="M${f.sx(o.up.hi).toFixed(1)} ${(f.sy(0) + 6).toFixed(1)}v12M${f.sx(o.up.lo).toFixed(1)} ${(f.sy(0) + 6).toFixed(1)}v12"/>`;
      n.dhFo = hFo - cb.hi; n.dlFo = lFo - cb.lo; n.dhEx = o.up.hi - cb.hi; n.dlEx = o.up.lo - cb.lo;
      n.slopeRel = Math.max(Math.abs(o.cd.hi / o.slope.hi - 1), Math.abs(o.cd.lo / o.slope.lo - 1));
      reads.innerHTML = `<div class="k-wb"><dt>δh, first order</dt><dd>${fmt(n.dhFo, 4)}<small>−δc × flux total at h₀ ÷ 2c₀</small></dd></div>
        <div class="k-acc"><dt>δh, Appendix B</dt><dd>${fmt(n.dhEx, 4)}<small>h(c₀ + δc) − h(c₀)</small></dd></div>
        <div class="k-wb"><dt>δℓ, first order</dt><dd>${fmt(n.dlFo, 4)}</dd></div>
        <div class="k-acc"><dt>δℓ, Appendix B</dt><dd>${fmt(n.dlEx, 4)}</dd></div>`;
      head.textContent = `Step 3: the slope of V − G (ink) and of V − G − δc·E_xτ with δc = ${dc} (green), with its straight-line approximation at each bound (dashed), which crosses 0 at the first-order bound (dot).`;
      label = "Near each bound, the slope of the value of waiting minus the reward for deciding, before and after a small change in the cost; the after-change slope's straight-line approximation at each bound, which crosses 0 at the first-order bound; the old and the first-order bounds (dots); and Appendix B's bounds after the change (ticks)";
    } else {
      const ss = logRange(0.005, 6, 200);
      const kh = ss.map((s) => o.bk.flux("hi", s) / o.th), kl = ss.map((s) => o.bk.flux("lo", s) / o.tl);
      const top = Math.min(3, Math.max(...kh, ...kl) * 1.1);
      f = frame(chart, { x: [0.005, 6], y: [0, top], xlog: true, aspect: 0.52, minH: 190, maxH: 260 });
      g = axes(f, { yl: "kernel w(s)", xl: "time ahead, s", grid: true });
      g += line(f, ss, kh.map((v) => (v <= top ? v : NaN)), "wb") + line(f, ss, kl.map((v) => (v <= top ? v : NaN)), "wb", 'stroke-dasharray="5 4"');
      if (kh.some((v) => v > top) || kl.some((v) => v > top)) g += text(f.sx(0.006), f.t + 10, `w(s) runs above ${fmt(top, 1)} near 0`, "tag-wb");
      g += vline(f, o.mh, "wb", 'stroke-dasharray="1 3"') + vline(f, o.ml, "wb", 'stroke-dasharray="1 3"');
      if (step === 4) {
        const b0 = K.B(c0), dots = logRange(0.01, 4, 14);
        g += dots.filter((s) => K.kernelAt(s, c0) <= top).map((s) => dot(f, s, K.kernelAt(s, c0), "ink-dot", 3)).join("");
        n.gap = Math.max(...dots.map((s) => Math.abs(o.bk.flux("hi", s) / o.th - K.kernelAt(s, c0))));
        n.slope = o.slope.hi; n.Bp = K.Bprime(c0);
        reads.innerHTML = `<div class="k-wb"><dt>−∫n/(2c₀)</dt><dd>${fmt(o.slope.hi, 4)}</dd></div><div><dt>B′(c₀)</dt><dd>${fmt(K.Bprime(c0), 4)}<small>−1/(4c₀² cosh² b₀), b₀ = ${fmt(b0, 3)}</small></dd></div>`;
        head.textContent = "Step 5: equal rewards. The dots are chapter 6's kernel, from the series (16).";
        label = "With equal rewards, the two bounds' kernels on chapter 6's kernel";
      } else {
        reads.innerHTML = `<div class="k-wb"><dt>Upper bound's mean</dt><dd>${fmt(o.mh, 3)}<small>solid</small></dd></div><div class="k-wb"><dt>Lower bound's mean</dt><dd>${fmt(o.ml, 3)}<small>dashed</small></dd></div>`;
        head.textContent = "Step 4: each bound's own kernel: the upper bound's (solid) and the lower bound's (dashed).";
        label = "The two bounds' kernels against the time ahead, on a log scale, with their means";
      }
    }
    chart.innerHTML = svg(f, g, label);
    say.textContent = S.envelopeSay(step, n);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "en-r", (v) => { ratio = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: two bounds, two leads
function sinePlate() {
  const fig = plate("sine"), el = rootOf("sine");
  if (!el) return;
  const OMS = [0.5, 1, 2, 4, 8], c0 = M.SINE.c0;
  let rm = 0.5, om = 2, gen = 0, data = null;
  const runs = new Map();
  el.innerHTML = `${flag("sine")}<div class="controls">${segHTML("si-r", [[0.5, "0.5"], [0.25, "0.25"]], rm, "Reward for “−” ÷ reward for “+”")}${segHTML("si-om", OMS.map((w) => [w, String(w)]), om, "Frequency ω")}</div>
    <div class="chart-wrap" id="si-hi"></div><div class="chart-wrap" id="si-lo"></div>
    <ul class="legend"><li><span class="key key-ex">Program, ÷ ε</span></li><li><span class="key key-wb">First order, own kernel</span></li><li><span class="key key-pm">Per-moment</span></li></ul>
    <dl class="reads" id="si-reads"></dl><p class="say" id="si-say"></p><p class="fine" id="si-state" aria-live="polite"></p>`;
  const hiEl = $("#si-hi", el), loEl = $("#si-lo", el), reads = $("#si-reads", el), say = $("#si-say", el), state = $("#si-state", el);
  const theory = (q, w) => {
    const cb = M.constantBounds(c0, 1, q), ft = M.fluxTotals(cb.lo, cb.hi), tr = M.transferAt(w, cb.lo, cb.hi);
    return { cb, dH: -ft.hi / (2 * c0), dL: ft.lo / (2 * c0), tr };
  };
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const drawOne = (host, which) => {
    if (!data) { host.innerHTML = ""; return; }
    const th = theory(data.rm, data.omega), slope = which === "hi" ? th.dH : th.dL, W = th.tr[which];
    const t = data.t, dp = which === "hi" ? data.dh : data.dl;
    const fo = t.map((x) => slope * W.gain * Math.sin(data.omega * x + (W.lead * Math.PI) / 180));
    const pm = t.map((x) => slope * Math.sin(data.omega * x));
    const lim = Math.max(...[...dp, ...fo, ...pm].map(Math.abs)) * 1.12;
    const f = frame(host, { x: [t[0], t[t.length - 1]], y: [-lim, lim], aspect: 0.34, minH: 150, maxH: 210 });
    let g = axes(f, { yl: which === "hi" ? "upper bound: (h − h₀) ÷ ε" : "lower bound: (ℓ − ℓ₀) ÷ ε", xl: "time", grid: true, zero: true });
    g += line(f, t, pm, "pm") + line(f, t, fo, "wb") + line(f, t, dp, "ex");
    host.innerHTML = svg(f, g, `The ${which === "hi" ? "upper" : "lower"} bound's move divided by epsilon at omega ${data.omega}: the program, the first-order prediction from its own kernel, and the per-moment response`);
  };
  const draw = () => {
    drawOne(hiEl, "hi"); drawOne(loEl, "lo");
    if (!data) return;
    const th = theory(data.rm, data.omega);
    const fitOf = (fit, slope) => ({ gain: fit.amp / Math.abs(slope), lead: wrap(fit.phase - (slope < 0 ? 180 : 0)) });
    const H = fitOf(data.fitH, th.dH), L = fitOf(data.fitL, th.dL);
    const n = { omega: data.omega, rm: data.rm, hi: { foGain: th.tr.hi.gain, foLead: th.tr.hi.lead, dpGain: H.gain, dpLead: H.lead }, lo: { foGain: th.tr.lo.gain, foLead: th.tr.lo.lead, dpGain: L.gain, dpLead: L.lead } };
    reads.innerHTML = `<div class="k-wb"><dt>Upper: first order</dt><dd>${fmt(n.hi.foGain, 3)}<small>swing; lead ${fmt(n.hi.foLead, 1)}°</small></dd></div>
      <div><dt>Upper: program</dt><dd>${fmt(n.hi.dpGain, 3)}<small>swing; lead ${fmt(n.hi.dpLead, 1)}°</small></dd></div>
      <div class="k-wb"><dt>Lower: first order</dt><dd>${fmt(n.lo.foGain, 3)}<small>swing; lead ${fmt(n.lo.foLead, 1)}°</small></dd></div>
      <div><dt>Lower: program</dt><dd>${fmt(n.lo.dpGain, 3)}<small>swing; lead ${fmt(n.lo.dpLead, 1)}°</small></dd></div>`;
    say.textContent = S.sineSay(n);
    liftReady(fig);
  };
  const run = () => {
    const my = ++gen, key = rm + ":" + om;
    if (runs.has(key)) { data = runs.get(key); state.textContent = "Evidence grid 0.02, checked every 0.01; ε = 0.01, c₀ = 0.1."; draw(); return; }
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving two dynamic programs with two bounds…";
    solve({ job: "sine", rm, omega: om }, { key: "sine", worker: WORKER }).then((m) => {
      runs.set(m.rm + ":" + m.omega, m);
      if (my !== gen) return;
      data = m; state.textContent = "Evidence grid 0.02, checked every 0.01; ε = 0.01, c₀ = 0.1."; draw();
    }).catch((e) => { if (e.message !== "superseded" && my === gen) state.textContent = "The solver stopped: " + e.message; });
  };
  onSeg(el, "si-r", (v) => { rm = +v; run(); });
  onSeg(el, "si-om", (v) => { om = +v; run(); });
  keepDrawn(hiEl, draw);
  run();
}

// ---------------------------------------------------------------- start
try { hero(); } catch (e) { console.error(e); }
wireStrips();
const lazy = [["clock", clockPlate], ["belief", beliefPlate], ["rules", rulesPlate], ["pair", pairPlate], ["appb", appbPlate], ["envelope", envelopePlate], ["sine", sinePlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { fail(id, e); } }); }
