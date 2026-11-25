// Appendix B's hero and plates. The programs run in appB-worker.js (appB-model.js: model.js's evidence-grid program
// and a port of the paper's belief-grid value iteration); tools/checks/appB.mjs holds both to the paper's code at the
// book's tag. The words under each plate come from say-appB.js.
import * as M from "./appB-model.js";
import { solve, onVisible, liftReady } from "./book.js";
import { frame, line, axes, svg, fmt, keepDrawn } from "./chart.js";
import * as S from "./say-appB.js";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const WORKER = new URL("./appB-worker.js", import.meta.url);
const run = (job, opts = {}) => solve(job, { worker: WORKER, ...opts });
const fail = (state, e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; };
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));

const COSTS = M.COST_STOPS;
const costDial = (id, k) => `<label class="dial"><span class="ctl-key">Cost of time, c</span><output id="${id}-out">${S.costLabel(COSTS[k])}</output>
  <input type="range" id="${id}" min="0" max="${COSTS.length - 1}" step="1" value="${k}" aria-label="The constant cost of time"></label>`;
const HORIZONS = new Map();
const horizon = (c) => {
  if (!HORIZONS.has(c)) HORIZONS.set(c, run({ job: "horizon", c }).catch((e) => { HORIZONS.delete(c); throw e; }));
  return HORIZONS.get(c);
};

// ---------------------------------------------------------------- the hero: the forced choice at 10, three costs
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const costs = M.HERO_COSTS, T = 10;
  const runs = [];
  let cur = 0;
  const draw = (i) => {
    cur = i;
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), Hh = Math.round(Math.min(300, Math.max(220, W * 0.58)));
    el.setAttribute("viewBox", `0 0 ${W} ${Hh}`); el.setAttribute("width", W); el.setAttribute("height", Hh);
    const f = { W, H: Hh, l: 34, r: 12, t: 22, b: 26 };
    const sx = (t) => f.l + (t / T) * (W - f.l - f.r), yTop = 2.6, sy = (b) => f.t + (1 - b / yTop) * (Hh - f.t - f.b);
    let s = `<text class="lab" x="${f.l}" y="12">the best bound, with the choice forced at time ${T}</text>`;
    s += `<path class="ax" d="M${f.l} ${Hh - f.b}H${W - f.r}M${f.l} ${f.t}V${Hh - f.b}"/>`;
    for (const v of [0, 1, 2]) s += `<text class="tk" x="${f.l - 6}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    for (const v of [0, 2, 4, 6, 8, 10]) s += `<text class="tk" x="${sx(v).toFixed(1)}" y="${Hh - f.b + 15}" text-anchor="middle">${v}</text>`;
    s += `<text class="lab" x="${W - f.r}" y="${Hh - 2}" text-anchor="end">time</text>`;
    if (runs.length < costs.length) { s += `<text class="tk" x="${(W / 2).toFixed(0)}" y="${(Hh / 2).toFixed(0)}" text-anchor="middle">solving the program…</text>`; el.innerHTML = s; return; }
    costs.forEach((c, k) => {
      const r = runs[k], ts = [], bs = [];
      for (let q = 0; q <= T / r.dt; q += 2) { ts.push(q * r.dt); bs.push(r.bTg[Math.round(T / r.dt) - q]); }
      const d = ts.map((t, q) => `${q ? "L" : "M"}${sx(t).toFixed(1)} ${sy(bs[q]).toFixed(1)}`).join("");
      s += `<path class="${k === i ? "ex" : "dim"}" d="${d}"/>`;
      s += `<text class="${k === i ? "tag-ex" : "tk"}" x="${sx(T * 0.55).toFixed(1)}" y="${(sy(bs[0]) - 5).toFixed(1)}">c = ${c}</text>`;
    });
    const r = runs[i], d1 = r.reach[0], t1 = T - d1;
    s += `<path class="acc" stroke-dasharray="3 3" d="M${sx(t1).toFixed(1)} ${f.t}V${Hh - f.b}"/>`;
    s += `<text class="tag-acc" x="${(sx(t1) + (t1 > T * 0.6 ? -4 : 4)).toFixed(1)}" y="${f.t + 10}" text-anchor="${t1 > T * 0.6 ? "end" : "start"}">0.001 below from here</text>`;
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  const label = (i) => (runs.length < costs.length ? "Solving the program…" : S.heroLabel(costs[i], runs[i].reach[0]));
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: costs.length, draw, label });
  onVisible(fig, () => {
    Promise.all(costs.map(horizon)).then((rs) => {
      runs.push(...rs); draw(cur);
      const lab = fig.querySelector(".proof-label"); if (lab) lab.textContent = label(cur);
    }).catch(() => { /* the hero keeps its note */ });
  }, "200px");
}

// ---------------------------------------------------------------- plate: how far back the forced choice reaches
function horizonPlate() {
  const fig = plate("horizon"), el = rootOf("horizon");
  if (!el) return;
  let k = COSTS.indexOf(0.1), T = 10, data = null, gen = 0, guess = null, shown = false;
  el.innerHTML = `<div class="controls">${costDial("hz-c", k)}
    <label class="dial"><span class="ctl-key">Forced choice at</span><output id="hz-T-out">10</output>
      <input type="range" id="hz-T" min="2" max="20" step="0.5" value="10" aria-label="The time of the forced choice"></label></div>
    <div class="controls">${segHTML("hz-guess", [[0.5, "0.5"], [2, "2"], [5, "5"], [10, "10"]], "", "Guess: over how many time units before it does the forced choice move the bound by more than 0.001?")}
      <div class="actions"><button class="btn" type="button" id="hz-show">Show me</button></div></div>
    <p class="say" id="hz-verdict" aria-live="polite"></p>
    <div class="chart-wrap" id="hz-chart"></div>
    <ul class="legend"><li><span class="key key-ex">The bound, choice forced at your time</span></li><li><span class="key key-guide">Its value with ${M.LONG} time units left</span></li><li><span class="key key-acc-dash">Where it is first 0.001 away, counting back</span></li></ul>
    <dl class="reads" id="hz-reads"></dl><p class="say" id="hz-say" aria-live="polite"></p><p class="fine" id="hz-state" aria-live="polite"></p>`;
  const chart = $("#hz-chart", el), reads = $("#hz-reads", el), say = $("#hz-say", el), state = $("#hz-state", el), verdict = $("#hz-verdict", el);
  const cIn = $("#hz-c", el), cOut = $("#hz-c-out", el), tIn = $("#hz-T", el), tOut = $("#hz-T-out", el);
  const draw = () => {
    if (!data) { chart.innerHTML = ""; return; }
    const r = data, binf = r.bTg[r.bTg.length - 1], d1 = r.reach[0], d2 = r.reach[1];
    const yTop = Math.max(0.3, binf * 1.18);
    const f = frame(chart, { x: [0, 20], y: [0, yTop], aspect: 0.46, minH: 170, maxH: 250 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true, xt: [0, 5, 10, 15, 20] });
    const ts = [], bs = [];
    for (let q = 0; q * r.dt <= T + 1e-9; q++) { ts.push(q * r.dt); bs.push(M.boundAt(r, T, q * r.dt)); }
    s += `<path class="guide" d="M${f.sx(0).toFixed(1)} ${f.sy(binf).toFixed(1)}H${f.sx(20).toFixed(1)}"/>`;
    s += line(f, ts, bs, "ex");
    s += `<path class="acc" d="M${f.sx(T).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-acc" x="${(f.sx(T) + (T > 15 ? -4 : 4)).toFixed(1)}" y="${f.t + 10}" text-anchor="${T > 15 ? "end" : "start"}">forced choice</text>`;
    if (shown) {
      const t1 = T - d1;
      if (t1 > 0) s += `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(t1).toFixed(1)} ${f.t + 14}V${f.H - f.b}"/>`;
      else s += `<text class="tag-acc" x="${(f.l + 4).toFixed(1)}" y="${(f.H - f.b - 6).toFixed(1)}">0.001 away already at t = 0</text>`;
    }
    chart.innerHTML = svg(f, s, `The bound with the choice forced at ${T}, at a cost of ${S.costLabel(COSTS[k])}, against time, beside its value with ${M.LONG} time units left`);
    const b0 = M.boundAt(r, T, 0);
    reads.innerHTML = `<div><dt>Bound, ${M.LONG} left</dt><dd>${fmt(binf, 3)}</dd></div>
      <div><dt>0.001 away, last</dt><dd>${shown ? fmt(d1, 2) : "?"}<small>time units</small></dd></div>
      <div><dt>0.01 away, last</dt><dd>${fmt(d2, 2)}<small>time units</small></dd></div>
      <div><dt>Bound at t = 0</dt><dd>${fmt(b0, 3)}</dd></div>`;
    say.textContent = shown ? S.horizonSay(COSTS[k], T, M.LONG, binf, d1, d2, b0) : "";
    liftReady(fig);
  };
  const reveal = () => { shown = true; if (data) verdict.textContent = guess === null ? "" : S.guessSay(guess, data.reach[0]); draw(); };
  onSeg(el, "hz-guess", (v) => { guess = +v; reveal(); });
  $("#hz-show", el).addEventListener("click", reveal);
  tIn.addEventListener("input", () => { T = +tIn.value; tOut.textContent = String(T); draw(); });
  const go = () => {
    const my = ++gen, c = COSTS[k];
    cOut.textContent = S.costLabel(c);
    state.textContent = "Solving the program…";
    horizon(c).then((m) => {
      if (my !== gen) return;
      data = m;
      state.textContent = `Computed in the page: one program with the choice forced at ${m.long}, checking every ${m.dt} time units on an evidence grid of ${M.H}; at a constant cost, its bound depends only on the time left, so it gives the bound for every forced choice up to ${m.long}.`;
      if (shown && guess !== null) verdict.textContent = S.guessSay(guess, m.reach[0]);
      draw();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  cIn.addEventListener("input", () => { k = +cIn.value; cOut.textContent = S.costLabel(COSTS[k]); });
  cIn.addEventListener("change", go);
  keepDrawn(chart, draw);
  go();
}

// ---------------------------------------------------------------- plate: the belief grid's bins
function binsPlate() {
  const fig = plate("bins"), el = rootOf("bins");
  if (!el) return;
  let k = COSTS.indexOf(0.02), n = 100, data = null, gen = 0;
  el.innerHTML = `<div class="controls">${costDial("bn-c", k)}</div>
    <div class="controls">${segHTML("bn-n", M.BINS.map((b) => [b, String(b)]), n, "Bins on (0, 1)")}</div>
    <div class="chart-wrap" id="bn-top"></div>
    <ul class="legend"><li><span class="key key-ink-dots">Belief grid, by number of bins</span></li><li><span class="key key-ex">Evidence grid (${M.DT}, ${M.H})</span></li><li><span class="key key-guide">B(c), watched continuously</span></li></ul>
    <div class="chart-wrap" id="bn-bot"></div>
    <dl class="reads" id="bn-reads"></dl><p class="say" id="bn-say" aria-live="polite"></p><p class="fine" id="bn-state" aria-live="polite"></p>`;
  const top = $("#bn-top", el), bot = $("#bn-bot", el), reads = $("#bn-reads", el), say = $("#bn-say", el), state = $("#bn-state", el);
  const cIn = $("#bn-c", el), cOut = $("#bn-c-out", el);
  const draw = () => {
    if (!data) { top.innerHTML = ""; bot.innerHTML = ""; return; }
    const fin = data.rows.map((r) => r.xb).filter(Number.isFinite);
    const lo = Math.min(data.xe, ...fin), hi = Math.max(data.B, data.xe, ...fin);
    const pad = Math.max(0.05, (hi - lo) * 0.12);
    const f = frame(top, { x: [20, 1000], y: [Math.max(0, lo - pad), hi + pad], xlog: true, aspect: 0.46, minH: 170, maxH: 240, l: 46 });
    let s = axes(f, { yl: "bound (evidence)", xl: "bins", grid: true, xt: M.BINS, fx: (v) => String(v) });
    s += `<path class="guide" d="M${f.l} ${f.sy(data.B).toFixed(1)}H${f.W - f.r}"/>`;
    s += `<path class="ex" d="M${f.l} ${f.sy(data.xe).toFixed(1)}H${f.W - f.r}"/>`;
    for (const r of data.rows) {
      const y = Number.isFinite(r.xb) ? f.sy(r.xb) : f.t - 2;
      s += `<circle class="${r.n === n ? "ink-dot" : "ink-dot"}" cx="${f.sx(r.n).toFixed(1)}" cy="${y.toFixed(1)}" r="${r.n === n ? 5 : 3.4}"${r.n === n ? "" : ' fill-opacity="0.45"'}/>`;
    }
    top.innerHTML = svg(f, s, `The belief grid's bound for each number of bins at a cost of ${S.costLabel(COSTS[k])}, beside the evidence grid's bound and B(c)`);
    // below: where the chosen number of bins sits in evidence, near the bound
    const row = data.rows.find((r) => r.n === n);
    const xr = Math.min(4, Math.max(1, data.B * 1.35));
    const g = frame(bot, { x: [0, xr], y: [0, 1], h: 84, l: 46, t: 18, b: 30 });
    let u = axes(g, { yt: [], xl: "evidence, x", fy: () => "" });
    u += `<text class="lab" x="${g.l}" y="11">the ${n} bins, placed in evidence (bins above 1/2)</text>`;
    for (const x of row.x) if (x > 0 && x <= xr) u += `<path class="dim" d="M${g.sx(x).toFixed(1)} ${g.sy(0.15).toFixed(1)}V${g.sy(0.75).toFixed(1)}"/>`;
    if (Number.isFinite(row.xb) && row.xb <= xr) u += `<circle class="ink-dot" cx="${g.sx(row.xb).toFixed(1)}" cy="${g.sy(0.45).toFixed(1)}" r="4"/>`;
    u += `<path class="ex" d="M${g.sx(data.xe).toFixed(1)} ${g.sy(0).toFixed(1)}V${g.sy(0.95).toFixed(1)}"/>`;
    bot.innerHTML = svg(g, u, `The ${n} bins' positions in evidence, with the belief grid's bound and the evidence grid's`);
    reads.innerHTML = `<div><dt>Belief grid, ${n} bins</dt><dd>${Number.isFinite(row.xb) ? fmt(row.xb, 3) : "none"}<small>${row.it} iterations</small></dd></div>
      <div><dt>Evidence grid</dt><dd>${fmt(data.xe, 3)}</dd></div>
      <div><dt>B(c)</dt><dd>${fmt(data.B, 3)}</dd></div>
      <div><dt>Bins at the bound</dt><dd>${fmt(row.gap, 3)}<small>apart</small></dd></div>`;
    say.textContent = S.binsSay(COSTS[k], n, row.xb, data.xe, data.B, row.gap);
    liftReady(fig);
  };
  onSeg(el, "bn-n", (v) => { n = +v; draw(); });
  const go = () => {
    const my = ++gen, c = COSTS[k];
    cOut.textContent = S.costLabel(c);
    state.textContent = "Solving the belief grid for six numbers of bins…";
    run({ job: "bins", c }, { key: "appB-bins", progress: (q) => { if (my === gen) state.textContent = `Solving the belief grid… ${Math.round(q * 100)}%`; } }).then((m) => {
      if (my !== gen) return;
      data = m;
      state.textContent = `Computed in the page: value iteration on each belief grid, checking every ${M.DT} time units, until no value changes by more than 0.001 Δt in a step; the evidence grid's program with the choice forced ${m.long} time units ahead.`;
      draw();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  cIn.addEventListener("input", () => { k = +cIn.value; cOut.textContent = S.costLabel(COSTS[k]); });
  cIn.addEventListener("change", go);
  keepDrawn(top, draw);
  go();
}

// ---------------------------------------------------------------- start
hero();
for (const [id, fn] of [["bins", binsPlate], ["horizon", horizonPlate]]) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } });
}
