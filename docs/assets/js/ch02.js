// Chapter 2's plates: one evidence path in two sets of units, the reader's schedule in milliseconds and in belief,
// the belief from sampled trials, the fold Y = |X| and its measured drift, the three facts about g, and two starts
// on the same noise. Paths and trials are sampled with rng() from kernel.js and ?seed=; every exact curve comes
// from ch02-model.js; the best bound comes from the dynamic program in the worker. Sentences come from say-ch02.js.
import { rng, B, decide } from "./kernel.js?v=9bcb592a71";
import * as M from "./ch02-model.js?v=9bcb592a71";
import { costOf, deadlineOf, labelOf, VIEW } from "./schedules-book.js?v=9bcb592a71";
import { getChoice, solve, onVisible, watchVisible, liftReady, calm, seedParam, wireStrips } from "./book.js?v=9bcb592a71";
import { frame, line, axes, svg, fmt, keepDrawn, ticks, dropAt } from "./chart.js?v=9bcb592a71";
import * as S from "./say-ch02.js?v=9bcb592a71";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const setSeg = (el, name, v) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = String(r.value) === String(v); });
const every = (arr, k) => Array.from(arr).filter((_, i) => i % k === 0 || i === arr.length - 1);
const timesOf = (n, dt, k) => Array.from({ length: n + 1 }, (_, i) => i * dt).filter((_, i) => i % k === 0 || i === n);
const later = (fn) => setTimeout(fn, 0);

// ---------------------------------------------------------------- the hero: evidence, belief, the fold, two starts
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  // seed 2027 is the first from 2026 whose eight paths stay inside the drawn range of ±4.5; the pair's seed is one
  // on which the two starts meet before time 2.5, so the picture shows them becoming one path
  const R = rng(2027), T = 2.5, dt = 0.01, n = Math.round(T / dt);
  const paths = [];
  for (let k = 0; k < 8; k++) { const H = k % 3 === 2 ? -1 : 1; paths.push({ H, x: M.evidence(H, 0, M.increments(R, n, dt), dt) }); }
  const dB = M.increments(rng(2132), n, dt);
  const lo = M.reflected(0.25, dB, dt).y, hi = M.reflected(1.1, dB, dt).y;
  const ts = Array.from({ length: n + 1 }, (_, i) => i * dt);
  const meet = (() => { for (let i = 0; i <= n; i++) if (hi[i] - lo[i] < 1e-12) return ts[i]; return null; })();
  let cur = 0;
  const draw = (i) => {
    cur = i;
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(240, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 30, r = i === 1 ? 40 : 12, t = 24, b = 24;
    const fold = i >= 2;
    const y0 = fold ? 0 : -4.5, y1 = i === 3 ? 2.4 : 4.5;
    const sx = (v) => l + (v / T) * (W - l - r), sy = (v) => t + (1 - (Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0)) * (H - t - b);
    const path = (xs, ys) => { let d = ""; for (let k = 0; k < xs.length; k += 2) d += (k ? "L" : "M") + sx(xs[k]).toFixed(1) + " " + sy(ys[k]).toFixed(1); return d; };
    let s = `<path class="ax" d="M${l} ${H - b}H${W - r}M${l} ${t}V${H - b}"/>`;
    const yt = i === 3 ? [0, 1, 2] : fold ? [0, 1, 2, 3, 4] : [-4, -2, 0, 2, 4];
    for (const v of yt) s += `<text class="tk" x="${l - 5}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    if (i === 1) {
      for (const v of [-2, -1, 0, 1, 2]) {
        s += `<path class="grid" d="M${l} ${sy(v).toFixed(1)}H${W - r}"/>`;
        s += `<text class="tag-ex" x="${W - r + 4}" y="${(sy(v) + 4).toFixed(1)}">${M.g(v).toFixed(2)}</text>`;
      }
      s += `<text class="lab" x="${W - 4}" y="14" text-anchor="end">Belief g</text>`;
    }
    if (i <= 1) {
      s += `<path class="guide" d="M${sx(0)} ${sy(0)}L${sx(T)} ${sy(T)}M${sx(0)} ${sy(0)}L${sx(T)} ${sy(-T)}"/>`;
      s += `<path class="ax" d="M${l} ${sy(0).toFixed(1)}H${W - r}"/>`;
      for (const p of paths) s += `<path class="${p.H > 0 ? "ex" : "path-dim"}" style="stroke-width:${p.H > 0 ? 1.2 : 1.4}" d="${path(ts, p.x)}"/>`;
      s += `<text class="lab" x="${l}" y="14">Evidence X, ${i === 0 ? "H = +1 (ink) and −1 (gray)" : "and the belief it implies"}</text>`;
    } else if (i === 2) {
      for (const p of paths) s += `<path class="${p.H > 0 ? "ex" : "path-dim"}" style="stroke-width:${p.H > 0 ? 1.2 : 1.4}" d="${path(ts, Array.from(p.x, Math.abs))}"/>`;
      s += `<text class="lab" x="${l}" y="14">The size of the evidence, Y = |X|</text>`;
    } else {
      s += `<path class="dim" d="${path(ts, lo)}" style="stroke-width:1.8"/><path class="ex" d="${path(ts, hi)}"/>`;
      if (meet !== null) s += `<path class="guide" d="M${sx(meet).toFixed(1)} ${t}V${H - b}"/><text class="tk" x="${(sx(meet) + 4).toFixed(1)}" y="${t + 10}">One path from here</text>`;
      s += `<text class="lab" x="${l}" y="14">Y from 0.25 and from 1.1, on the same noise</text>`;
    }
    s += `<text class="tk" x="${sx(0)}" y="${H - 8}" text-anchor="middle">0</text><text class="tk" x="${sx(T)}" y="${H - 8}" text-anchor="end">time ${T}</text>`;
    el.innerHTML = s;
  };
  draw(0);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: 4, draw, label: (i) => S.heroLabel(i) });
}

// ---------------------------------------------------------------- plate: one path, two sets of units
function unitsPlate() {
  const fig = plate("units"), el = rootOf("units");
  if (!el) return;
  const DT = 0.0005, TMAX = 64, RAW_T = 4;
  const R = rng(seedParam(2026) + 1);
  const xp = M.evidence(1, 0, M.increments(R, Math.round(TMAX / DT), DT), DT);
  const palmerMu = M.PALMER_K * 0.064;
  let mu = 1, sigma = 1, guess = null, shown = false;
  const lg = (v) => Math.log10(v).toFixed(3);
  el.innerHTML = `<div class="predict"><p>Random dots at 6.4% coherence, for the mean observer of Palmer, Huk, and Shadlen (2005): how long is one of the paper's time units?</p>
      ${segHTML("un-guess", [["fifty", "About 50 ms"], ["half", "About half a second"], ["five", "About 5 seconds"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn" type="button" id="un-show">Show me</button></div>
      <p class="verdict" id="un-verdict" aria-live="polite"></p></div>
    <div class="controls">
      <label class="dial"><span class="ctl-key">Drift, μ</span><output id="un-mu-o"></output><input type="range" id="un-mu" min="${lg(0.5)}" max="${lg(2)}" step="0.005" value="0" aria-label="Drift size, on a log scale"></label>
      <label class="dial"><span class="ctl-key">Noise, σ</span><output id="un-sg-o"></output><input type="range" id="un-sg" min="${lg(0.5)}" max="${lg(2)}" step="0.005" value="0" aria-label="Noise size, on a log scale"></label></div>
    <div class="chart-wrap" id="un-raw"></div><div class="chart-wrap" id="un-paper"></div>
    <ul class="legend"><li><span class="key key-ex">Evidence</span></li><li><span class="key key-acc">Drift, μt</span></li><li><span class="key key-acc-dash">Noise, σ√t</span></li></ul>
    <dl class="reads" id="un-reads"></dl><p class="say" id="un-say" aria-live="polite"></p>`;
  const raw = $("#un-raw", el), pap = $("#un-paper", el), reads = $("#un-reads", el), say = $("#un-say", el), verdict = $("#un-verdict", el);
  const inMu = $("#un-mu", el), inSg = $("#un-sg", el);
  const drawRaw = () => {
    const k = (mu * mu) / (sigma * sigma), E = (sigma * sigma) / mu, T1 = 1 / k;
    const { ts, zs, drift, noise, y } = M.unitsCharts(xp, DT, mu, sigma, RAW_T).raw;
    const f = frame(raw, { x: [0, RAW_T], y, aspect: 0.5, minH: 180, maxH: 250 });
    let s = axes(f, { yl: "evidence Z, raw units", xl: shown && Math.abs(mu - palmerMu) < 1e-9 && sigma === 1 ? "time, seconds" : "time, raw units", grid: true, zero: true });
    s += line(f, ts, zs, "ex");
    s += line(f, ts, drift, "acc") + line(f, ts, noise, "acc", 'stroke-dasharray="5 4"');
    if (T1 <= RAW_T) {
      s += `<circle class="acc-dot" cx="${f.sx(T1).toFixed(1)}" cy="${f.sy(E).toFixed(1)}" r="4.5"/>`;
      const right = f.sx(T1) > f.W * 0.6;
      s += `<text class="tag-acc" x="${(f.sx(T1) + (right ? -8 : 8)).toFixed(1)}" y="${(f.sy(E) + 16).toFixed(1)}" text-anchor="${right ? "end" : "start"}">one time unit: ${fmt(T1, 3)}</text>`;
    } else s += `<text class="tag-acc" x="${f.W - f.r - 4}" y="${f.t + 12}" text-anchor="end">one time unit: ${fmt(T1, 2)}, past the edge</text>`;
    raw.innerHTML = svg(f, s, `One evidence path in raw units for drift ${fmt(mu)} and noise ${fmt(sigma)}, with the drift line and the noise curve, which meet at one time unit, ${T1 <= RAW_T ? `time ${fmt(T1, 3)}, inside the window` : `time ${fmt(T1, 2)}, past the window's edge at ${RAW_T}`}`);
  };
  const drawPaper = () => {
    const k = (mu * mu) / (sigma * sigma), reach = RAW_T * k;
    const { ts, xs, line: diag, sqrt, y } = M.unitsCharts(xp, DT, mu, sigma, RAW_T).paper;
    const f = frame(pap, { x: [0, 4], y, aspect: 0.5, minH: 180, maxH: 250 });
    let s = reach < 4 ? `<rect class="band" x="${f.l}" y="${f.t}" width="${(f.sx(reach) - f.l).toFixed(1)}" height="${f.H - f.t - f.b}"/>` : "";
    s += axes(f, { yl: "evidence x, the paper's units", xl: "time, the paper's units", grid: true, zero: true });
    s += line(f, ts, xs, "ex") + line(f, ts, diag, "dim") + line(f, ts, sqrt, "guide");
    s += `<circle class="ink-dot" cx="${f.sx(1).toFixed(1)}" cy="${f.sy(1).toFixed(1)}" r="4"/><text class="tag-ex" x="${(f.sx(1) + 8).toFixed(1)}" y="${(f.sy(1) + 16).toFixed(1)}">one time unit: 1</text>`;
    s += `<text class="tk" x="${f.W - f.r - 4}" y="${f.H - f.b - 6}" text-anchor="end">${reach < 4 ? "shaded: the top chart's window, to " + fmt(reach, 2) : "the top chart's window covers all of this"}</text>`;
    pap.innerHTML = svg(f, s, "The same path in the paper's units, where drift and noise meet at time 1 for every drift and noise");
  };
  const draw = () => {
    $("#un-mu-o", el).textContent = fmt(mu, 3); $("#un-sg-o", el).textContent = fmt(sigma, 3);
    drawRaw(); drawPaper();
    const T1 = (sigma * sigma) / (mu * mu);
    reads.innerHTML = `<div class="k-acc"><dt>One time unit, σ²/μ²</dt><dd>${fmt(T1, 3)}</dd></div>
      <div class="k-acc"><dt>One unit of evidence, σ²/μ</dt><dd>${fmt((sigma * sigma) / mu, 3)}</dd></div>
      <div><dt>Raw time ${RAW_T}, in the paper's units</dt><dd>${fmt((RAW_T * mu * mu) / (sigma * sigma), 2)}<small>a cost c per raw unit is cσ²/μ² per paper unit</small></dd></div>`;
    say.textContent = S.unitsSay(mu, sigma);
    liftReady(fig);
  };
  const reveal = () => {
    shown = true; mu = palmerMu; sigma = 1; inMu.value = Math.log10(mu); inSg.value = 0;
    verdict.textContent = S.palmerVerdict(guess, 1000 * M.unitSeconds(0.064)); draw();
  };
  inMu.addEventListener("input", () => { mu = 10 ** +inMu.value; draw(); });
  inSg.addEventListener("input", () => { sigma = 10 ** +inSg.value; draw(); });
  onSeg(el, "un-guess", (v) => { guess = v; reveal(); });
  $("#un-show", el).addEventListener("click", reveal);
  keepDrawn(raw, draw);
}

// ---------------------------------------------------------------- plate: your schedule, in milliseconds and in belief
function yoursPlate() {
  const fig = plate("yours"), el = rootOf("yours");
  if (!el) return;
  let choice = getChoice(), res = null, unit = "paper", coh = 0.064;
  const COH = [0.032, 0.064, 0.128, 0.256];
  el.innerHTML = `<div class="controls">${segHTML("yo-unit", [["paper", "The paper's units"], ["ms", "Milliseconds"]], unit, "Time and cost in")}
      ${segHTML("yo-coh", COH.map((c) => [c, S.cohText(c)]), coh, "Coherence")}</div>
    <p class="fine" id="yo-note"></p>
    <div class="chart-wrap" id="yo-cost"></div><div class="chart-wrap" id="yo-bound"></div>
    <ul class="legend"><li><span class="key key-cost">Cost of time</span></li><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment rule</span></li></ul>
    <dl class="reads" id="yo-reads"></dl><p class="say" id="yo-say" aria-live="polite"></p><p class="fine" id="yo-state" aria-live="polite"></p>`;
  const costEl = $("#yo-cost", el), boundEl = $("#yo-bound", el), reads = $("#yo-reads", el), say = $("#yo-say", el), note = $("#yo-note", el), state = $("#yo-state", el);
  const unitMs = () => (unit === "ms" ? 1000 * M.unitSeconds(coh) : null);
  const toX = (t) => (unit === "ms" ? t * unitMs() : t);
  const setCohEnabled = () => { el.querySelectorAll(".seg")[1].hidden = unit !== "ms"; };
  const view = () => deadlineOf(choice) ?? VIEW;
  const drawCost = () => {
    const cost = costOf(choice), v = view(), ts = range(0, v, 251);
    const per = unit === "ms" ? 1000 / unitMs() : 1;
    const cs = ts.map((t) => cost(t) * per), fin = cs.filter(Number.isFinite);
    const f = frame(costEl, { x: [0, toX(v)], y: [Math.min(...fin) / 1.6, Math.max(...fin, 0.2 * per) * 1.6], ylog: true, aspect: 0.26, minH: 110, maxH: 150, b: 26, r: 40 });
    let s = axes(f, { yl: unit === "ms" ? "cost per second" : "cost per time unit" }) + line(f, ts.map(toX), cs, "cost");
    costEl.innerHTML = svg(f, s, `The cost of time for ${labelOf(choice)}, ${unit === "ms" ? "per second" : "per time unit"}`);
  };
  const drawBound = () => {
    const v = view();
    // with a deadline, leave room above the curves for the forced choice's label
    const top = res ? Math.max(1.2, ...res.exact.filter(Number.isFinite), ...res.pm.filter(Number.isFinite)) * (deadlineOf(choice) === null ? 1.1 : 1.25) : 2;
    const f = frame(boundEl, { x: [0, toX(v)], y: [0, top], aspect: 0.55, minH: 200, maxH: 290, r: 40 });
    let s = axes(f, { yl: "bound, evidence", xl: unit === "ms" ? "ms" : "time", grid: true });
    for (const p of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99]) {
      const x = M.halfLogOdds(p); if (x > top) continue;
      s += `<path class="ax" d="M${f.W - f.r} ${f.sy(x).toFixed(1)}h-4"/><text class="tk" x="${f.W - f.r + 4}" y="${(f.sy(x) + 3.5).toFixed(1)}">${p}</text>`;
    }
    s += `<path class="ax" d="M${f.W - f.r} ${f.t}V${f.H - f.b}"/><text class="lab" x="${f.W - 2}" y="${Math.max(11, f.t - 9)}" text-anchor="end">right, deciding at x</text>`;
    const dl = deadlineOf(choice);
    if (dl !== null) s += `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(toX(dl)).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-acc" x="${(f.sx(toX(dl)) - 4).toFixed(1)}" y="${f.t + 10}" text-anchor="end">forced choice</text>`;
    if (res) {
      const [tp, pmp] = dropAt(res.t, res.pm, res.deadline);   // the rule's bound holds until the forced choice, then drops
      s += line(f, tp.map(toX), pmp, "pm") + line(f, res.t.map(toX), res.exact, "ex");
    }
    else s += `<text class="tk" x="${(f.W / 2).toFixed(0)}" y="${(f.H / 2).toFixed(0)}" text-anchor="middle">solving the best bound…</text>`;
    boundEl.innerHTML = svg(f, s, `The best bound and the per-moment bound for ${labelOf(choice)}, with the right axis giving the chance that a decision made at that evidence is right`);
  };
  const readings = () => {
    note.textContent = S.costUnitNote(unitMs(), coh);
    if (!res) { reads.innerHTML = ""; say.textContent = ""; return; }
    const b0 = res.exact[0], b1 = res.exact[res.exact.length - 1], ms = unitMs(), dl = deadlineOf(choice);
    reads.innerHTML = `<div class="k-ex"><dt>Bound at the start</dt><dd>${S.boundText(b0)}<small>${S.boundNote(b0, M.g)}</small></dd></div>
      <div class="k-ex"><dt>${dl === null ? "Bound at the end" : "At the deadline"}</dt><dd>${dl === null ? S.boundText(b1) : "0"}<small>${dl === null ? S.boundNote(b1, M.g) : "the choice is forced"}</small></dd></div>
      <div><dt>One time unit</dt><dd>${ms === null ? "1" : Math.round(ms) + " ms"}<small>${ms === null ? "σ²/μ²" : "at " + S.cohText(coh) + " coherence"}</small></dd></div>`;
    say.textContent = S.yoursSay({ label: labelOf(choice), unitMs: ms, view: view(), b0, b1, deadline: deadlineOf(choice), g: M.g });
    liftReady(fig);
  };
  const drawAll = () => { drawCost(); drawBound(); readings(); };
  const run = () => {
    choice = getChoice(); res = null; drawAll();
    state.textContent = "Solving the best bound…";
    solve({ job: "bounds", choice }, { key: "ch02-yours" }).then((m) => {
      res = m; state.textContent = S.yoursState(m.deadline); drawAll();
    }).catch((e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; });
  };
  onSeg(el, "yo-unit", (v) => { unit = v; setCohEnabled(); drawAll(); });
  onSeg(el, "yo-coh", (v) => { coh = +v; drawAll(); });
  setCohEnabled();
  window.addEventListener("cc-schedule", run);
  keepDrawn(boundEl, drawAll);
  run();
}

// ---------------------------------------------------------------- plate (strip): from evidence to belief
function beliefPlate() {
  const fig = plate("belief"), el = rootOf("belief");
  if (!el) return;
  const N = 6000, W_BIN = 0.25, LO = -2.625, HI = 2.625;
  let step = +(fig.dataset.step || 0), t = 1, guess = null, shownG = false, draws = 0;
  const cache = new Map();
  const trialsAt = (tt) => {
    const k = tt + ":" + draws;
    if (!cache.has(k)) cache.set(k, M.trials(rng(seedParam(2026) + 101 + 7 * draws + Math.round(tt * 100)), tt, N, 1));
    return cache.get(k);
  };
  let innov = null;
  el.innerHTML = `<div class="predict"><p>After one unit of evidence, X = 1, how sure should the decision maker be that H = +1?</p>
      ${segHTML("be-guess", [[0.731, "0.73"], [0.841, "0.84"], [M.g(1).toFixed(3), "0.88"], [0.982, "0.98"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn" type="button" id="be-show">Show me</button></div>
      <p class="verdict" id="be-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("be-t", [[0.25, "0.25"], [1, "1"], [3, "3"]], t, "Time t")}
      <div class="actions"><button class="btn" type="button" id="be-again">New trials</button></div></div>
    <p class="fine" id="be-head"></p><div class="chart-wrap" id="be-chart"></div>
    <dl class="reads" id="be-reads"></dl><p class="say" id="be-say" aria-live="polite"></p>`;
  const chart = $("#be-chart", el), reads = $("#be-reads", el), say = $("#be-say", el), head = $("#be-head", el), verdict = $("#be-verdict", el);
  const draw = () => {
    head.textContent = S.BELIEF_HEADS[step];
    let f, s = "", label = "";
    if (step === 0) {
      const xs = range(-4, 4, 321), up = xs.map((x) => M.normal(x, t, t)), dn = xs.map((x) => M.normal(x, -t, t));
      f = frame(chart, { x: [-4, 4], y: [0, Math.max(...up) * 1.15], aspect: 0.5, minH: 190, maxH: 270 });
      s = axes(f, { yl: "density of X at time t", xl: "evidence x", grid: true });
      s += line(f, xs, dn, "dim") + line(f, xs, up, "ex");
      const pu = M.normal(1, t, t), pd = M.normal(1, -t, t);
      s += `<path class="guide" d="M${f.sx(1).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
      s += `<circle class="ink-dot" cx="${f.sx(1).toFixed(1)}" cy="${f.sy(pu).toFixed(1)}" r="4"/><circle class="ink-dot" cx="${f.sx(1).toFixed(1)}" cy="${f.sy(pd).toFixed(1)}" r="3" style="opacity:.6"/>`;
      s += `<text class="tag-ex" x="${(f.sx(t) + 7).toFixed(1)}" y="${(f.sy(Math.max(...up)) - 4).toFixed(1)}">H = +1</text>`;
      s += `<text class="tk" x="${(f.sx(-t) - 7).toFixed(1)}" y="${(f.sy(Math.max(...dn)) - 4).toFixed(1)}" text-anchor="end">H = −1</text>`;
      reads.innerHTML = `<div class="k-ex"><dt>Under H = +1, at x = 1</dt><dd>${fmt(pu, 4)}</dd></div><div><dt>Under H = −1</dt><dd>${fmt(pd, 4)}</dd></div>
        <div><dt>Ratio</dt><dd>${fmt(pu / pd, 3)}<small>e² = ${fmt(Math.exp(2), 3)}</small></dd></div>`;
      say.textContent = S.ratioSay(t, pu / pd);
      label = `The density of the evidence at time ${t} under each answer`;
    } else if (step === 1 || step === 2 || step === 3) {
      const tr = trialsAt(t), bs = M.bins(tr, LO, HI, W_BIN);
      if (step === 1) {
        const top = Math.max(...bs.map((o) => o.n / N / W_BIN)) * 1.12;
        f = frame(chart, { x: [LO, HI], y: [0, top], aspect: 0.5, minH: 190, maxH: 270 });
        const o1 = bs.find((o) => o.a < 1 && o.b > 1);
        s = `<rect class="band" x="${f.sx(o1.a).toFixed(1)}" y="${f.t}" width="${(f.sx(o1.b) - f.sx(o1.a)).toFixed(1)}" height="${f.H - f.t - f.b}"/>`;
        s += axes(f, { yl: "share of trials per unit of x", xl: "evidence x at time t", grid: true });
        for (const o of bs) {
          if (!o.n) continue;
          const x0 = f.sx(o.a) + 0.5, wd = Math.max(0.5, f.sx(o.b) - f.sx(o.a) - 1);
          const hAll = o.n / N / W_BIN, hUp = o.up / N / W_BIN;
          s += `<rect class="hist" x="${x0.toFixed(1)}" y="${f.sy(hAll).toFixed(1)}" width="${wd.toFixed(1)}" height="${(f.sy(0) - f.sy(hAll)).toFixed(1)}"/>`;
          s += `<rect class="ink-dot" style="opacity:.78" x="${x0.toFixed(1)}" y="${f.sy(hUp).toFixed(1)}" width="${wd.toFixed(1)}" height="${(f.sy(0) - f.sy(hUp)).toFixed(1)}"/>`;
        }
        const inR = tr.X.reduce((a, x) => a + (x >= LO && x < HI ? 1 : 0), 0);
        reads.innerHTML = `<div><dt>Trials</dt><dd>${N.toLocaleString("en-US")}<small>${inR.toLocaleString("en-US")} in the window drawn</small></dd></div>
          <div class="k-ex"><dt>Share with H = +1 near x = 1</dt><dd>${o1.n ? fmt(o1.share, 3) : "–"}<small>${o1.up} of ${o1.n}, between ${o1.a} and ${o1.b}</small></dd></div>`;
        say.textContent = S.barSay(t, o1.n, o1.up, o1.a, o1.b);
        label = `Sampled evidence at time ${t}, with the part of each bar that had H = +1 in ink`;
      } else if (step === 2) {
        const xs = range(LO, HI, 241);
        f = frame(chart, { x: [LO, HI], y: [0, 1], aspect: 0.55, minH: 200, maxH: 280 });
        s = axes(f, { yl: "share with H = +1", xl: "evidence x at time t", grid: true });
        s += line(f, xs, xs.map(M.g), "ex");
        for (const o of bs) {
          if (o.n < 20) continue;
          const xc = f.sx(0.5 * (o.a + o.b));
          s += `<path class="dim" d="M${xc.toFixed(1)} ${f.sy(Math.min(1, o.share + 2 * o.shareSE)).toFixed(1)}V${f.sy(Math.max(0, o.share - 2 * o.shareSE)).toFixed(1)}"/>`;
          s += `<circle class="ink-dot" cx="${xc.toFixed(1)}" cy="${f.sy(o.share).toFixed(1)}" r="2.8"/>`;
        }
        if (guess !== null) s += `<circle class="acc-dot" cx="${f.sx(1).toFixed(1)}" cy="${f.sy(guess).toFixed(1)}" r="5.5"/><text class="tag-acc" x="${(f.sx(1) - 9).toFixed(1)}" y="${(f.sy(guess) - 4).toFixed(1)}" text-anchor="end">your guess</text>`;
        s += `<text class="tag-ex" x="${(f.sx(1) + 8).toFixed(1)}" y="${(f.sy(M.g(1)) + 16).toFixed(1)}">g(1) = ${fmt(M.g(1), 3)}</text>`;
        const { z, k } = M.largestMiss(bs, t, "share");
        reads.innerHTML = `<div class="k-ex"><dt>g(1)</dt><dd>${fmt(M.g(1), 3)}</dd></div>
          <div class="k-acc"><dt>Your guess</dt><dd>${guess === null ? "–" : fmt(guess, 2)}</dd></div>
          <div><dt>Largest miss</dt><dd>${z.toFixed(1)}<small>binomial standard errors of the exact share, over ${k} bins</small></dd></div>`;
        say.textContent = S.binSay(t, N, k, z, "share");
        label = `The share of trials with H = +1 in each bin of evidence at time ${t}, beside the belief g`;
      } else {
        const xs = range(LO, HI, 241);
        f = frame(chart, { x: [LO, HI], y: [-1.6, 1.6], aspect: 0.55, minH: 200, maxH: 280 });
        s = axes(f, { yl: "mean change over the next time unit", xl: "evidence x at time t", grid: true, zero: true });
        s += line(f, xs, xs.map(Math.tanh), "ex");
        for (const o of bs) {
          if (o.n < 20) continue;
          const xc = f.sx(0.5 * (o.a + o.b));
          s += `<path class="dim" d="M${xc.toFixed(1)} ${f.sy(o.mean + 2 * o.meanSE).toFixed(1)}V${f.sy(o.mean - 2 * o.meanSE).toFixed(1)}"/>`;
          s += `<circle class="ink-dot" cx="${xc.toFixed(1)}" cy="${f.sy(o.mean).toFixed(1)}" r="2.8"/>`;
        }
        s += `<text class="tag-ex" x="${(f.W - f.r - 4).toFixed(1)}" y="${(f.sy(Math.tanh(HI)) + 18).toFixed(1)}" text-anchor="end">tanh x</text>`;
        const { z, k } = M.largestMiss(bs, t, "mean");
        reads.innerHTML = `<div class="k-ex"><dt>tanh 1</dt><dd>${fmt(Math.tanh(1), 3)}<small>2g(1) − 1</small></dd></div>
          <div><dt>Largest miss</dt><dd>${z.toFixed(1)}<small>sample standard errors, over ${k} bins</small></dd></div>`;
        say.textContent = S.binSay(t, N, k, z, "expected drift");
        label = `The mean change of the evidence over the next time unit, by bin of evidence at time ${t}, beside tanh x`;
      }
    } else {
      if (!innov || !innov.done) {
        if (!innov) innovations();
        f = frame(chart, { x: [0, 2], y: [-4, 4], aspect: 0.55, minH: 200, maxH: 280 });
        s = axes(f, { yl: "innovation W̄", xl: "time", grid: true, zero: true });
        reads.innerHTML = ""; say.textContent = S.progressSay("trials", innov.k, 4000);
        chart.innerHTML = svg(f, s, "Innovation paths, being sampled");
        return;
      }
      const { ts, show, v, vSE, r, rSE, T } = innov;
      f = frame(chart, { x: [0, T], y: [-4, 4], aspect: 0.55, minH: 200, maxH: 280 });
      s = axes(f, { yl: "innovation W̄", xl: "time", grid: true, zero: true });
      for (const w of show.slice(1)) s += line(f, ts, w, "path-dim");
      s += line(f, ts, show[0], "ex");
      s += line(f, ts, ts.map((u) => 2 * Math.sqrt(u)), "guide") + line(f, ts, ts.map((u) => -2 * Math.sqrt(u)), "guide");
      s += `<text class="tk" x="${(f.W - f.r - 4).toFixed(1)}" y="${(f.sy(-2 * Math.sqrt(T)) + 16).toFixed(1)}" text-anchor="end">dashed: ±2√t</text>`;
      reads.innerHTML = `<div><dt>Variance at time ${T}</dt><dd>${fmt(v, 3)}<small>± ${fmt(2 * vSE, 3)}; a Brownian motion: ${T}</small></dd></div>
        <div><dt>Later increment vs tanh X</dt><dd>${fmt(r, 3)}<small>correlation, ± ${fmt(2 * rSE, 3)}</small></dd></div>`;
      say.textContent = S.innovationSay(T, v, vSE, r, rSE);
      label = "Innovation paths computed from sampled evidence, with dashed guides at plus and minus two standard deviations of a Brownian motion at each time";
    }
    chart.innerHTML = svg(f, s, label);
    liftReady(fig);
  };
  /** 4,000 trials from the true model, the innovation computed from the evidence alone (left sums, step 0.01), in
   * slices of about 20 ms so the page never waits long; draws again when they are all in. */
  function innovations() {
    const K = 4000, R = rng(seedParam(2026) + 211 + draws), run = M.innovationRun(2, 0.01, 40);
    const me = innov = { done: false, k: 0 };
    const slice = () => {
      if (innov !== me) return;
      const t0 = performance.now();
      while (run.acc.k < K && performance.now() - t0 < 20) run.add(R, Math.min(25, K - run.acc.k));
      me.k = run.acc.k;
      if (me.k < K) { setTimeout(slice, 0); return; }
      Object.assign(me, { done: true, ts: run.ts, show: run.show, T: run.T }, run.summary());
      if (step === 4) draw();
    };
    setTimeout(slice, 0);
  }
  const showG = () => { shownG = true; verdict.textContent = S.gVerdict(guess, M.g(1)); draw(); };
  onSeg(el, "be-guess", (v) => { guess = +v; showG(); });
  $("#be-show", el).addEventListener("click", showG);
  onSeg(el, "be-t", (v) => { t = +v; draw(); });
  $("#be-again", el).addEventListener("click", () => { draws++; cache.clear(); innov = null; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: folding at zero
function foldPlate() {
  const fig = plate("fold"), el = rootOf("fold");
  if (!el) return;
  const T = 2, dt = 0.001, n = Math.round(T / dt), X0 = 0;
  let draws = 0, h = 0.01, guess = null, shown = false, path = null;
  const make = () => {
    const x = M.filtered(X0, M.increments(rng(seedParam(2026) + 335 + draws), n, dt), dt);
    const l = M.tanaka(x);
    path = { x, y: Array.from(x, Math.abs), l, touches: M.signSteps(x) };
  };
  el.innerHTML = `<div class="predict"><p>Away from 0, which way does Y = |X| drift?</p>
      ${segHTML("fo-guess", [["toward", "Toward 0"], ["away", "Away from 0"], ["none", "Neither"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn" type="button" id="fo-show">Show me</button></div>
      <p class="verdict" id="fo-verdict" aria-live="polite"></p></div>
    <div class="controls"><div class="actions"><button class="btn" type="button" id="fo-again">New path</button></div></div>
    <div class="chart-wrap" id="fo-path"></div>
    <ul class="legend"><li><span class="key key-dim">X</span></li><li><span class="key key-ex">Y = |X|</span></li><li><span class="key key-ink-dots">Local time ℓ</span></li></ul>
    <p class="say" id="fo-psay"></p>
    <div id="fo-more" hidden><div class="controls" style="margin-top:12px">${segHTML("fo-h", [[0.3, "0.3"], [0.1, "0.1"], [0.01, "0.01"], [0.001, "0.001"]], h, "Over a time h")}</div>
    <div class="chart-wrap" id="fo-drift"></div>
    <ul class="legend"><li><span class="key key-ex">Measured drift of Y</span></li><li><span class="key key-guide">tanh y</span></li></ul>
    <dl class="reads" id="fo-reads"></dl><p class="say" id="fo-say" aria-live="polite"></p></div>`;
  const pathEl = $("#fo-path", el), driftEl = $("#fo-drift", el), reads = $("#fo-reads", el), say = $("#fo-say", el), psay = $("#fo-psay", el), more = $("#fo-more", el), verdict = $("#fo-verdict", el);
  const drawPath = () => {
    if (!path) make();
    const ts = timesOf(n, dt, 5), xs = every(path.x, 5), ys = every(path.y, 5), ls = every(path.l, 5);
    const lo = Math.min(-0.6, ...xs) - 0.2, hi = Math.max(1, ...ys) + 0.2;
    const f = frame(pathEl, { x: [0, T], y: [lo, hi], aspect: 0.55, minH: 200, maxH: 280 });
    let s = axes(f, { yl: "evidence", xl: "time", grid: true, zero: true });
    s += line(f, ts, xs, "dim", 'style="stroke-width:1.4"') + line(f, ts, ys, "ex") + line(f, ts, ls, "ex", 'stroke-dasharray="1.5 3.5" style="stroke-width:2.4;stroke-linecap:round"');
    for (let i = 0; i < n; i++) if (Math.sign(path.x[i + 1]) !== Math.sign(path.x[i])) s += `<path class="ax" d="M${f.sx(i * dt).toFixed(1)} ${(f.sy(0) - 3).toFixed(1)}v6"/>`;
    s += `<text class="tag-ex" x="${(f.W - f.r - 4).toFixed(1)}" y="${(f.sy(ls[ls.length - 1]) - 6).toFixed(1)}" text-anchor="end">ℓ</text>`;
    pathEl.innerHTML = svg(f, s, "One path of the evidence X, its size Y = |X|, and the local time at 0");
    psay.textContent = S.pathSay(T, path.touches, path.l[n], n);
    liftReady(fig);
  };
  const drawDrift = () => {
    if (!shown) return;
    const ys = range(0, 2.5, 251), fd = ys.map((y) => M.foldDrift(y, h));
    const f = frame(driftEl, { x: [0, 2.5], y: [0, 2], aspect: 0.5, minH: 180, maxH: 260 });
    let s = axes(f, { yl: "(E Yₕ − y) ÷ h", xl: "start y", grid: true });
    s += line(f, ys, fd, "ex") + line(f, ys, ys.map(Math.tanh), "guide", 'style="stroke-width:1.6"');
    const at0 = fd[0];
    if (at0 > 2) s += `<text class="tag-ex" x="${f.sx(0.45).toFixed(1)}" y="${f.t + 11}">at y = 0, off the chart: ${fmt(at0, 2)}</text>`;
    driftEl.innerHTML = svg(f, s, `The drift of Y measured over a time ${h}, against the start, beside tanh y`);
    let gap = 0; for (let k = 0; k < ys.length; k++) if (ys[k] >= 0.5) gap = Math.max(gap, Math.abs(fd[k] - Math.tanh(ys[k])));
    const at1 = M.foldDrift(1, h);
    reads.innerHTML = `<div class="k-ex"><dt>At y = 0</dt><dd>${fmt(at0, 2)}<small>√(2/(πh)) = ${fmt(Math.sqrt(2 / (Math.PI * h)), 2)}</small></dd></div>
      <div class="k-ex"><dt>At y = 1</dt><dd>${fmt(at1, 4)}<small>tanh 1 = ${fmt(Math.tanh(1), 4)}</small></dd></div>
      <div><dt>Largest gap above 0.5</dt><dd>${gap < 1e-4 ? gap.toExponential(1) : fmt(gap, 4)}</dd></div>`;
    say.textContent = S.foldSay(h, at0, at1, gap);
  };
  const reveal = () => { shown = true; more.hidden = false; verdict.textContent = S.foldVerdict(guess); keepDrawn(driftEl, drawDrift); };
  onSeg(el, "fo-guess", (v) => { guess = v; reveal(); });
  $("#fo-show", el).addEventListener("click", reveal);
  $("#fo-again", el).addEventListener("click", () => { draws++; path = null; drawPath(); });
  onSeg(el, "fo-h", (v) => { h = +v; drawDrift(); });
  keepDrawn(pathEl, drawPath);
}

// ---------------------------------------------------------------- plate (strip): the three facts about g
function factsPlate() {
  const fig = plate("facts"), el = rootOf("facts");
  if (!el) return;
  let step = +(fig.dataset.step || 0), test = "sin", c = 0.1;
  const runs = new Map(); // c -> { starts, sums } sampled hitting times
  let timer = 0, visible = false;
  el.innerHTML = `<p class="fine" id="fa-head"></p>
    <div class="controls" id="fa-ctl"></div>
    <div class="chart-wrap" id="fa-chart"></div><dl class="reads" id="fa-reads"></dl><p class="say" id="fa-say" aria-live="polite"></p>`;
  const chart = $("#fa-chart", el), reads = $("#fa-reads", el), say = $("#fa-say", el), head = $("#fa-head", el), ctl = $("#fa-ctl", el);
  const ys = range(-3, 3, 601);
  const controls = () => {
    if (step === 3) { ctl.innerHTML = segHTML("fa-f", M.TESTS.map((q) => [q.id, q.label]), test, "Test function f"); onSeg(ctl, "fa-f", (v) => { test = v; draw(); }); }
    else if (step === 4) { ctl.innerHTML = segHTML("fa-c", [[0.03, "0.03"], [0.1, "0.1"], [0.3, "0.3"]], c, "Cost of time, c, for the bound b = B(c)"); onSeg(ctl, "fa-c", (v) => { c = +v; draw(); sample(); }); }
    else ctl.innerHTML = "";
  };
  const exitData = () => {
    if (!runs.has(c)) {
      const b = B(c), starts = [0, 0.25, 0.5, 0.75].map((u) => u * b);
      runs.set(c, { b, starts, n: starts.map(() => 0), s: starts.map(() => 0), q: starts.map(() => 0), R: rng(seedParam(2026) + 401 + Math.round(c * 1000)) });
    }
    return runs.get(c);
  };
  const TARGET = 1000, BATCH = 25;
  const sample = () => {
    clearTimeout(timer); timer = 0;
    if (step !== 4 || !visible) return;
    const d = exitData();
    if (d.n.every((k) => k >= TARGET)) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 25 && d.n.some((k) => k < TARGET)) {
      for (let j = 0; j < d.starts.length; j++) {
        for (let i = 0; i < BATCH && d.n[j] < TARGET; i++) { const tt = decide(d.starts[j], d.b, d.R).t; d.n[j]++; d.s[j] += tt; d.q[j] += tt * tt; }
      }
    }
    draw();
    timer = setTimeout(sample, calm.matches ? 0 : 40);
  };
  const draw = () => {
    head.textContent = S.FACT_HEADS[step];
    let f, s = "", label = "", worst = 0;
    reads.innerHTML = "";
    if (step === 0) {
      f = frame(chart, { x: [-3, 3], y: [0, 0.3], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "value", xl: "y", grid: true });
      s += line(f, ys, ys.map((y) => 1 / (4 * Math.cosh(y) ** 2)), "ex");
      for (let k = 0; k < ys.length; k += 24) s += `<circle class="acc-dot" cx="${f.sx(ys[k]).toFixed(1)}" cy="${f.sy(M.g(ys[k]) * (1 - M.g(ys[k]))).toFixed(1)}" r="3"/>`;
      for (const y of ys) worst = Math.max(worst, Math.abs(M.g(y) * (1 - M.g(y)) - 1 / (4 * Math.cosh(y) ** 2)));
      label = "g times one minus g, and one over four cosh squared, against y";
    } else if (step === 1) {
      const hh = 0.01;
      f = frame(chart, { x: [-3, 3], y: [0, 1], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "value", xl: "y", grid: true });
      s += line(f, ys, ys.map(M.g), "dim") + line(f, ys, ys.map(M.g1), "ex");
      for (let k = 0; k < ys.length; k += 24) { const y = ys[k], d = (M.g(y + hh) - M.g(y - hh)) / (2 * hh); s += `<circle class="acc-dot" cx="${f.sx(y).toFixed(1)}" cy="${f.sy(d).toFixed(1)}" r="3"/>`; }
      for (const y of ys) worst = Math.max(worst, Math.abs((M.g(y + hh) - M.g(y - hh)) / (2 * hh) - M.g1(y)));
      s += `<text class="tk" x="${f.sx(2.2).toFixed(1)}" y="${(f.sy(M.g(2.2)) + 16).toFixed(1)}" text-anchor="middle">g</text><text class="tag-ex" x="${(f.sx(-0.9) - 6).toFixed(1)}" y="${(f.sy(M.g1(-0.9)) - 4).toFixed(1)}" text-anchor="end">g′</text>`;
      label = "g, its derivative, and difference quotients of g";
    } else if (step === 2) {
      // the generator's expression on the state space of Y, y >= 0 (at 0 the reflection, not this expression, acts)
      const yp = range(0, 3, 301);
      const a = yp.map((y) => 0.5 * M.g2(y)), b = yp.map((y) => Math.tanh(y) * M.g1(y)), sum = yp.map((y) => M.Lop(y, M.g1(y), M.g2(y)));
      f = frame(chart, { x: [0, 3], y: [-0.25, 0.25], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "value", xl: "y", grid: true, zero: true });
      s += line(f, yp, a, "dim") + line(f, yp, b, "ex-thin", 'style="opacity:.9;stroke-width:1.6"') + line(f, yp, sum, "ex");
      s += `<text class="tk" x="${f.sx(1.6).toFixed(1)}" y="${(f.sy(a[160]) + 14).toFixed(1)}">½g″</text><text class="tag-ex" x="${f.sx(1.6).toFixed(1)}" y="${(f.sy(b[160]) - 6).toFixed(1)}">tanh(y)·g′</text>`;
      s += `<text class="tag-ex" x="${f.sx(0.4).toFixed(1)}" y="${(f.sy(0) - 6).toFixed(1)}" text-anchor="middle">𝓛g = 0</text>`;
      worst = Math.max(...sum.map(Math.abs));
      label = "The two terms of the generator's expression applied to g for y from 0 to 3, and their sum, zero";
    } else if (step === 3) {
      const q = M.TESTS.find((z) => z.id === test), hh = 1e-4, yy = range(0, 2.5, 251);
      const P = (y) => Math.cosh(y) ** 2 * q.f1(y);
      const lhs = yy.map((y) => (P(y + hh) - P(y - hh)) / (2 * hh)), rhs = yy.map((y) => 2 * Math.cosh(y) ** 2 * M.Lop(y, q.f1(y), q.f2(y)));
      const lo = Math.min(...rhs), hi = Math.max(...rhs), pad = (hi - lo) * 0.1 + 0.05;
      f = frame(chart, { x: [0, 2.5], y: [lo - pad, hi + pad], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "value", xl: "y", grid: true, zero: true });
      s += line(f, yy, rhs, "ex");
      for (let k = 0; k < yy.length; k += 10) s += `<circle class="acc-dot" cx="${f.sx(yy[k]).toFixed(1)}" cy="${f.sy(lhs[k]).toFixed(1)}" r="3"/>`;
      const scale = Math.max(1, ...rhs.map(Math.abs));
      worst = Math.max(...lhs.map((v, k) => Math.abs(v - rhs[k]))) / scale;
      label = `Both sides of the cosh squared identity for f = ${q.label}`;
    } else {
      const d = exitData(), yy = range(0, d.b, 161);
      f = frame(chart, { x: [0, d.b * 1.04], y: [0, M.meanHit(0, d.b) * 1.2 + 0.05], aspect: 0.5, minH: 190, maxH: 260 });
      s = axes(f, { yl: "mean time to reach b", xl: "start y", grid: true });
      s += line(f, yy, yy.map((y) => M.meanHit(y, d.b)), "ex");
      s += `<path class="guide" d="M${f.sx(d.b).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tk" x="${(f.sx(d.b) - 4).toFixed(1)}" y="${f.t + 10}" text-anchor="end">b</text>`;
      d.starts.forEach((y, j) => {
        if (!d.n[j]) return;
        const m = d.s[j] / d.n[j], se = Math.sqrt(Math.max(0, d.q[j] / d.n[j] - m * m) / d.n[j]);
        s += `<path class="acc" d="M${f.sx(y).toFixed(1)} ${f.sy(m + 2 * se).toFixed(1)}V${f.sy(m - 2 * se).toFixed(1)}"/><circle class="acc-dot" cx="${f.sx(y).toFixed(1)}" cy="${f.sy(m).toFixed(1)}" r="3.5"/>`;
      });
      const m0 = d.n[0] ? d.s[0] / d.n[0] : NaN, se0 = d.n[0] ? Math.sqrt(Math.max(0, d.q[0] / d.n[0] - m0 * m0) / d.n[0]) : NaN;
      reads.innerHTML = `<div><dt>Flat bound, B(${c})</dt><dd>${fmt(d.b, 3)}</dd></div><div class="k-ex"><dt>b tanh b</dt><dd>${fmt(M.meanHit(0, d.b), 3)}<small>mean time from 0</small></dd></div>
        <div class="k-acc"><dt>Runs from 0</dt><dd>${d.n[0] ? fmt(m0, 3) : "–"}<small>${d.n[0] ? "± " + fmt(2 * se0, 3) + ", " + d.n[0] + " runs" : "sampling…"}</small></dd></div>`;
      say.textContent = S.exitSay(c, d.b, M.meanHit(0, d.b), m0, se0, d.n[0]);
      label = `The mean time for Y to reach the flat bound at a cost of ${c}, against the start, with sampled runs`;
    }
    if (step < 4) {
      const q = M.TESTS.find((z) => z.id === test);
      reads.innerHTML = `<div><dt>Largest difference</dt><dd>${worst.toExponential(1)}<small>${S.factNote(step, test === "g")}</small></dd></div>`;
      say.textContent = S.factSay(step, worst, { label: q.label, zero: test === "g" });
    }
    chart.innerHTML = svg(f, s, label);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; controls(); draw(); sample(); });
  watchVisible(fig, (v) => { visible = v; if (v) sample(); });
  controls();
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate (strip): two starts on the same noise
function couplePlate() {
  const fig = plate("couple"), el = rootOf("couple");
  if (!el) return;
  const T = 3, dt = 0.002, n = Math.round(T / dt), Y1 = 0.3, Y2 = 1.0, PAIRS = 1000;
  let step = +(fig.dataset.step || 0), draws = 0, same = true, guess = null, pair = null, many = null, building = 0, gen = 0;
  const makePair = () => {
    // the default draw (offset 562) is one on which the lower path is reflected before the two meet, near time 1.2
    const R = rng(seedParam(2026) + 562 + draws), dB = M.increments(R, n, dt), dB2 = M.increments(R, n, dt);
    const lo = M.reflected(Y1, dB, dt), hi = M.reflected(Y2, dB, dt), hiInd = M.reflected(Y2, dB2, dt);
    const it = M.picard(Y1, dB, dt, 8);
    pair = { lo, hi, hiInd, it };
  };
  const firstMeet = (a, b) => { for (let i = 0; i <= n; i++) if (Math.abs(a[i] - b[i]) < 1e-12) return i * dt; return null; };
  const crossings = (a, b) => { let c = 0, s0 = Math.sign(b[0] - a[0]); for (let i = 1; i <= n; i++) { const s = Math.sign(b[i] - a[i]); if (s !== 0 && s0 !== 0 && s !== s0) c++; if (s !== 0) s0 = s; } return c; };
  /** 1,000 pairs for each kind of noise, in batches so the page never waits long. */
  const buildMany = () => {
    if (many || building) return;
    building = 1;
    const mine = ++gen;
    const R = rng(seedParam(2026) + 601 + draws), acc = { same: { gaps: [], minGap: new Float64Array(n + 1).fill(Infinity), crossed: 0, merged: 0, ordered: 0 }, ind: { gaps: [], minGap: new Float64Array(n + 1).fill(Infinity), crossed: 0, merged: 0, ordered: 0 } };
    let k = 0;
    const batch = () => {
      if (mine !== gen) return;
      const t0 = performance.now();
      while (k < PAIRS && performance.now() - t0 < 25) {
        const dB = M.increments(R, n, dt), dB2 = M.increments(R, n, dt);
        const a = M.reflected(Y1, dB, dt), b = M.reflected(Y2, dB, dt), c = M.reflected(Y2, dB2, dt);
        for (const [key, up] of [["same", b], ["ind", c]]) {
          const o = acc[key];
          let cr = false;
          for (let i = 0; i <= n; i++) { const gp = up.y[i] - a.y[i]; if (gp < o.minGap[i]) o.minGap[i] = gp; if (gp < -1e-12) cr = true; }
          if (cr) o.crossed++;
          if (firstMeet(a.y, up.y) !== null) o.merged++;
          if (a.l[n] >= up.l[n] - 1e-12) o.ordered++;
          if (o.gaps.length < 40) o.gaps.push(every(Array.from(up.y, (v, i) => v - a.y[i]), 5));
        }
        k++;
      }
      if (k < PAIRS) { setTimeout(batch, 0); if (step >= 3) headNote(S.progressSay("pairs", k, PAIRS)); }
      else { many = acc; building = 0; if (step >= 3) draw(); }
    };
    batch();
  };
  el.innerHTML = `<div class="predict"><p>Two copies of Y, started at ${Y1} and ${Y2}, driven by the same noise path B: can the two paths cross?</p>
      ${segHTML("co-guess", [["cross", "Yes, they can cross"], ["never", "They never meet"], ["meet", "They can meet, but never cross"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn" type="button" id="co-show">Show me</button></div>
      <p class="verdict" id="co-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("co-noise", [["same", "The same for both"], ["ind", "Independent"]], "same", "Noise")}
      <div class="actions"><button class="btn" type="button" id="co-again">New noise</button></div></div>
    <p class="fine" id="co-head"></p><div class="chart-wrap" id="co-chart"></div>
    <ul class="legend" id="co-legend"></ul><dl class="reads" id="co-reads"></dl><p class="say" id="co-say" aria-live="polite"></p>`;
  const chart = $("#co-chart", el), reads = $("#co-reads", el), say = $("#co-say", el), head = $("#co-head", el), legend = $("#co-legend", el), verdict = $("#co-verdict", el);
  const headNote = (txt) => { say.textContent = txt; };
  const ts = timesOf(n, dt, 5);
  const draw = () => {
    if (!pair) makePair();
    head.textContent = S.COUPLE_HEADS[step] + (step >= 2 ? (same ? " Shared noise." : " Independent noise.") : "");
    let f, s = "", label = "";
    reads.innerHTML = ""; legend.innerHTML = "";
    const up = same ? pair.hi : pair.hiInd;
    if (step === 0) {
      const { y, u, l } = pair.lo;
      const lo = Math.min(...u) - 0.1, hi = Math.max(...y, ...l, 1) + 0.2;
      f = frame(chart, { x: [0, T], y: [lo, hi], aspect: 0.55, minH: 200, maxH: 280 });
      s = axes(f, { yl: "value", xl: "time", grid: true, zero: true });
      s += line(f, ts, every(u, 5), "dim", 'style="stroke-width:1.4"') + line(f, ts, every(y, 5), "ex") + line(f, ts, every(l, 5), "ex", 'stroke-dasharray="1.5 3.5" style="stroke-width:2.4;stroke-linecap:round"');
      legend.innerHTML = `<li><span class="key key-dim">Free path U</span></li><li><span class="key key-ex">Y = U + ℓ</span></li><li><span class="key key-ink-dots">ℓ</span></li>`;
      let atZero = 0; for (let i = 1; i <= n; i++) if (l[i] > l[i - 1]) atZero++;
      reads.innerHTML = `<div><dt>ℓ at time ${T}</dt><dd>${fmt(l[n], 3)}</dd></div><div><dt>Steps where ℓ grew</dt><dd>${atZero}<small>each one ends at Y = 0</small></dd></div>`;
      say.textContent = S.skorokhodSay(atZero, n);
      label = "A free path, its reflection at zero, and the amount added back";
    } else if (step === 1) {
      const sol = pair.lo.y, its = pair.it;
      const lo = -0.1, hi = Math.max(...sol, ...its[1], 1) + 0.1;
      f = frame(chart, { x: [0, T], y: [lo, hi], aspect: 0.55, minH: 200, maxH: 280 });
      s = axes(f, { yl: "Y", xl: "time", grid: true });
      for (let k = 0; k <= 4; k++) s += line(f, ts, every(its[k], 5), "path-dim", `style="opacity:${(0.3 + 0.15 * k).toFixed(2)}"`);
      s += line(f, ts, every(sol, 5), "ex");
      const d = [1, 2, 4, 8].map((k) => M.supDist(its[k], sol));
      reads.innerHTML = [1, 2, 4, 8].map((k, j) => `<div><dt>After ${k} ${k === 1 ? "pass" : "passes"}</dt><dd>${d[j].toExponential(1)}</dd></div>`).join("");
      say.textContent = S.picardSay(d);
      legend.innerHTML = `<li><span class="key key-dim">Passes 0 to 4</span></li><li><span class="key key-ex">Solution</span></li>`;
      label = "Picard iterates of the reflected equation closing on its solution";
    } else if (step === 2 || step === 4) {
      const a = pair.lo, b = up;
      if (step === 2) {
        const hi = Math.max(...a.y, ...b.y, 1.2) + 0.1;
        f = frame(chart, { x: [0, T], y: [0, hi], aspect: 0.55, minH: 200, maxH: 280 });
        s = axes(f, { yl: "Y", xl: "time", grid: true });
        s += line(f, ts, every(a.y, 5), "dim", 'style="stroke-width:1.8"') + line(f, ts, every(b.y, 5), "ex");
        const meet = same ? firstMeet(a.y, b.y) : null, cr = same ? 0 : crossings(a.y, b.y);
        if (meet !== null) s += `<path class="guide" d="M${f.sx(meet).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tk" x="${(f.sx(meet) + 4).toFixed(1)}" y="${f.t + 10}">met</text>`;
        legend.innerHTML = `<li><span class="key key-dim">From ${Y1}</span></li><li><span class="key key-ex">From ${Y2}</span></li>`;
        reads.innerHTML = `<div><dt>Met at</dt><dd>${meet === null ? "–" : fmt(meet, 2)}</dd></div><div><dt>Crossings</dt><dd>${cr}</dd></div>`;
        say.textContent = S.pairSay(same, meet, cr);
        label = `Y from ${Y1} and from ${Y2} on ${same ? "the same" : "independent"} noise`;
      } else {
        const hi = Math.max(...a.l, ...b.l, 0.2) * 1.15;
        f = frame(chart, { x: [0, T], y: [0, hi], aspect: 0.5, minH: 190, maxH: 260 });
        s = axes(f, { yl: "local time ℓ", xl: "time", grid: true });
        s += line(f, ts, every(a.l, 5), "dim", 'style="stroke-width:1.8"') + line(f, ts, every(b.l, 5), "ex");
        legend.innerHTML = `<li><span class="key key-dim">From ${Y1}</span></li><li><span class="key key-ex">From ${Y2}</span></li>`;
        if (many) {
          const o = many[same ? "same" : "ind"];
          reads.innerHTML = `<div><dt>Lower start collects at least as much</dt><dd>${o.ordered.toLocaleString("en-US")}<small>of ${PAIRS.toLocaleString("en-US")} pairs</small></dd></div>`;
          say.textContent = S.localSay(same, PAIRS, o.ordered, a.l[n], b.l[n]);
        } else { buildMany(); say.textContent = S.progressSay("pairs", 0, PAIRS); }
        label = `The local time at zero collected by each path, ${same ? "on the same" : "on independent"} noise`;
      }
    } else {
      if (!many) { buildMany(); f = frame(chart, { x: [0, T], y: [-1, 2], aspect: 0.5, minH: 190, maxH: 260 }); s = axes(f, { yl: "gap", xl: "time", grid: true, zero: true }); chart.innerHTML = svg(f, s, "Pairs are being run"); say.textContent = S.progressSay("pairs", 0, PAIRS); return; }
      const o = many[same ? "same" : "ind"];
      const mg = every(o.minGap, 5);
      const lo = Math.min(-0.2, ...mg) - 0.1, hi = Math.max(...o.gaps.flat()) + 0.1;
      f = frame(chart, { x: [0, T], y: [lo, hi], aspect: 0.55, minH: 200, maxH: 280 });
      s = axes(f, { yl: "upper path − lower path", xl: "time", grid: true, zero: true });
      for (const gp of o.gaps) s += line(f, ts, gp, "path-dim");
      s += line(f, ts, mg, "ex");
      legend.innerHTML = `<li><span class="key key-dim">40 of the pairs</span></li><li><span class="key key-ex">Smallest gap of all ${PAIRS.toLocaleString("en-US")}</span></li>`;
      reads.innerHTML = `<div><dt>Pairs that crossed</dt><dd>${o.crossed.toLocaleString("en-US")}<small>of ${PAIRS.toLocaleString("en-US")}</small></dd></div>` +
        (same ? `<div><dt>Pairs that met</dt><dd>${o.merged.toLocaleString("en-US")}<small>and were one path after, by time ${T}</small></dd></div>` : "");
      say.textContent = S.pairsSay(same, PAIRS, o.crossed, o.merged);
      label = `The gap between two paths for ${PAIRS} pairs on ${same ? "the same" : "independent"} noise, with its smallest value at each time`;
    }
    chart.innerHTML = svg(f, s, label);
    liftReady(fig);
  };
  onSeg(el, "co-guess", (v) => { guess = v; verdict.textContent = S.coupleVerdict(guess); });
  $("#co-show", el).addEventListener("click", () => { verdict.textContent = S.coupleVerdict(guess); });
  onSeg(el, "co-noise", (v) => { same = v === "same"; draw(); });
  $("#co-again", el).addEventListener("click", () => { draws++; gen++; pair = null; many = null; building = 0; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
for (const [id, fn] of [["units", unitsPlate], ["yours", yoursPlate], ["belief", beliefPlate], ["fold", foldPlate], ["facts", factsPlate], ["couple", couplePlate]]) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } });
}
