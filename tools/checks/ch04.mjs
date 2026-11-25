// Chapter 4: the page's program against model.js's, the band of Lemma 1(c) on every schedule that meets the standing
// assumption, the exact comparison on the grid behind it, the schedules' extremes, the coupling, the value of
// waiting, the value's Lipschitz bound in time, the sampled decision and cap times, the martingale of the value
// process, the paper's numbers, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, score } from "../../book/assets/js/model.js";
import { costOf, PRESETS, paramsOf, defaultDrawing, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import * as M from "../../book/assets/js/ch04-model.js";
import * as S from "../../book/assets/js/say-ch04.js";
import { check, N, asPrinted, runWorker, ROOT } from "./lib.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOR = VIEW + SPARE, KV = Math.round(VIEW / M.DT);
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const seOf = (a) => { const m = meanOf(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length / a.length); };

// ---- the paper's numbers the hero quotes -----------------------------------------------------------------------
check("band", "BoundTenth: B(0.1), about the top of Figure 1(a)'s band (its cost starts a little above 0.1, so the true top is a little lower)", asPrinted(K.B(0.1), N.BoundTenth) && costOf(M.FIG1A)(0) > 0.1 && K.B(costOf(M.FIG1A)(0)) < K.B(0.1) && K.B(0.1) - K.B(costOf(M.FIG1A)(0)) < 0.001, `${K.B(0.1).toFixed(4)} vs ${N.BoundTenth}; c(0) = ${costOf(M.FIG1A)(0).toFixed(6)}, B(c(0)) = ${K.B(costOf(M.FIG1A)(0)).toFixed(4)}`);
check("cap", "DecisionTimeTenth: b tanh b at 0.1, about the continuous model's mean cap time from 0 for Figure 1(a)", asPrinted(K.meanDecisionTime(0.1), N.DecisionTimeTenth), `${K.meanDecisionTime(0.1).toFixed(4)} vs ${N.DecisionTimeTenth}`);

// ---- the page's program is model.js's, with its values kept ----------------------------------------------------
const FIG = costOf(M.FIG1A);
const PF = M.program(FIG, HOR, { keep: "all" });
{
  const E = exactPolicy(FIG, HOR);
  let d = 0; for (let k = 0; k < E.bounds.length; k++) d = Math.max(d, Math.abs(E.bounds[k] - PF.bounds[k]));
  check("program", "the page's program gives model.js's bound at every check on Figure 1(a)", d === 0, `largest difference ${d}`);
  let above = 0, below = Infinity;
  for (const t of [0, 0.3, 0.45, 1, 2]) {
    const k = Math.round(t / M.DT), b = PF.bounds[k];
    for (let i = 0; i <= PF.m; i++) {
      const y = i * PF.h, w = M.waitValue(PF, k, y);
      if (y >= b + PF.h) above = Math.max(above, Math.abs(w));
      if (y <= b - PF.h) below = Math.min(below, w);
    }
  }
  check("program", "at grid points at least one step above the bound, the kept value equals the reward for deciding, and at least one step below, it exceeds it (5 times)", above < 1e-6 && below > 0, `|V − g| above ≤ ${above.toExponential(1)}; V − g below ≥ ${below.toExponential(1)}`);
}

// ---- below the grid's first step: the page follows its program's choice at the center (the paper's code reports 0) --
{
  const big = costOf({ id: "jump", params: { at: 0.2, factor: 32 } });
  const P = M.program(big, HOR, { keep: [100] }), E = exactPolicy(big, HOR);
  let d = 0; for (let k = 0; k < E.bounds.length; k++) d = Math.max(d, Math.abs(E.bounds[k] - P.bounds[k]));
  const b = P.bounds[100], v = M.valueAt(P, 100, 0);
  check("program", "the 32-fold jump at 0.2: at time 1 the program waits at the center (V > g there), and the page's bound sits between the center and the first step, as model.js places it",
    d === 0 && v > M.g(0) && b > 0 && b < M.H, `V(1, 0) = ${v.toFixed(6)} > g(0) = 0.5; bound ${b.toFixed(5)}; model.js agrees to ${d}`);
  const D = M.decisions(P, 100, 0, 200, K.rng(4));
  check("decide", "and decisions from evidence 0 there don't stop at once: the sampler follows the same choice", Array.from(D.tau).every((x) => x > 0), `${Array.from(D.tau).filter((x) => x > 0).length} of 200 wait at least one check`);
  const C = M.program(() => 3.2, HOR, { keep: [0] });
  check("band", "at a constant 3.2, the shifted flat bound is below the grid's first step, and the program's bound is placed between the center and that step", M.flatOnGrid(3.2) < M.H && C.bounds[0] > 0 && C.bounds[0] < M.H && M.valueAt(C, 0, 0) > M.g(0),
    `shifted ${M.flatOnGrid(3.2).toFixed(5)}, program ${C.bounds[0].toFixed(5)}`);
  let lo = 1, hi = 10; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (M.flatOnGrid(m) > M.H) lo = m; else hi = m; }
  check("band", "the text's “above about 3.2”: the cost where B(c) moved in falls below the grid's first step is between 3.1 and 3.3", lo > 3.1 && lo < 3.3, `${lo.toFixed(3)}`);
}

// ---- Lemma 1(a): the value of waiting never rises with the evidence, and V is Lipschitz in y -----------------------------
{
  let rise = 0, slope = 0, fall = 0;
  for (let k = 0; k <= KV; k += 5) {
    for (let i = 0; i < PF.m; i++) {
      const y = i * PF.h, w0 = M.waitValue(PF, k, y), w1 = M.waitValue(PF, k, y + PF.h);
      rise = Math.max(rise, w1 - w0);
      const dv = M.valueAt(PF, k, y + PF.h) - M.valueAt(PF, k, y);
      slope = Math.max(slope, dv / PF.h); fall = Math.max(fall, -dv);
    }
  }
  check("coupling", "on the grid, V − g never rises with the evidence (Figure 1(a), every 0.05 time units to 2.5)", rise < 2e-6, `largest rise ${rise.toExponential(1)} (Float32 values)`);
  check("coupling", "on the grid, 0 ≤ V(t, y + h) − V(t, y) ≤ h/2: V is Lipschitz in y with constant ½", slope <= 0.5 + 1e-4 && fall < 2e-6, `largest slope ${slope.toFixed(4)}; largest fall ${fall.toExponential(1)}`);
}

// ---- the coupling ---------------------------------------------------------------------------------------------
{
  let order = 0, local = 0, push = 0, after = 0, met = 0;
  for (let s = 0; s < 200; s++) {
    const c = M.coupled(0.05, 0.5, 2.5, K.rng(100 + s), 0.001, 1);
    for (let i = 0; i < c.t.length; i++) {
      if (c.Y1[i] > c.Y2[i]) order++;
      if (c.L1[i] < c.L2[i] - 1e-9) local++;
      if (i && c.L1[i] > c.L1[i - 1] + 1e-9 && c.Y1[i] !== 0) push++;
      if (Number.isFinite(c.met) && c.t[i] >= c.met && c.Y1[i] !== c.Y2[i]) after++;
    }
    if (Number.isFinite(c.met)) met++;
  }
  check("coupling", "200 coupled pairs: the lower start never rises above the upper one", order === 0, `${order} violations`);
  check("coupling", "200 coupled pairs: the lower start's local time is never below the upper one's", local === 0, `${local} violations`);
  check("coupling", "local time grows only at steps where the path is at 0", push === 0, `${push} violations`);
  check("coupling", "paths that meet move as one afterward", after === 0, `${met} of 200 pairs met; ${after} steps apart after meeting`);
  const c = M.coupled(0.05, 0.5, 2.5, K.rng(2026 + 76), 0.001, 5);
  check("coupling", "the plate's default seed shows what its sentence says: the paths meet, and ℓ¹ ends above ℓ²", Number.isFinite(c.met) && c.L1.at(-1) > c.L2.at(-1) + 0.1, `met at ${c.met.toFixed(3)}; ℓ¹ ${c.L1.at(-1).toFixed(3)}, ℓ² ${c.L2.at(-1).toFixed(3)}`);
}

// ---- the extremes and the band ------------------------------------------------------------------------------------
{
  const e = M.extremes(FIG);
  check("band", "Figure 1(a): the scan finds c_min = c(0) and c_max = 1.6", Math.abs(e.lo - FIG(0)) < 1e-12 && Math.abs(e.hi - 1.6) < 1e-12, `${e.lo} and ${e.hi}`);
  const wave = costOf({ id: "wave", params: paramsOf({ id: "wave" }) }), ew = M.extremes(wave);
  check("band", "Wave: the scan finds 0.1(1 ± 0.3) to within 1e-6", Math.abs(ew.lo - 0.07) < 1e-6 && Math.abs(ew.hi - 0.13) < 1e-6, `${ew.lo.toFixed(7)}, ${ew.hi.toFixed(7)}`);
  const smooth = costOf({ id: "smooth", params: paramsOf({ id: "smooth" }) }), es = M.extremes(smooth);
  let per = 0; for (const t of [0.3, 1.7, 5, 12.2]) per = Math.max(per, Math.abs(smooth(t + 20 * Math.PI) - smooth(t)) / smooth(t));
  check("band", "Smooth repeats every 20π, so a scan to time 100 covers all t ≥ 0", per < 1e-9, `largest relative change over one period ${per.toExponential(1)}`);
  // an independent finer look around each extreme the scan found
  let fine = [Infinity, -Infinity];
  for (const t0 of [es.tMin, es.tMax]) for (let t = t0 - 0.01; t <= t0 + 0.01; t += 1e-6) { const c = smooth(t); fine = [Math.min(fine[0], c), Math.max(fine[1], c)]; }
  check("band", "Smooth: the refined extremes match a scan every 1e-6 near them, and both come after time 18 (the text says so)", Math.abs(fine[0] - es.lo) < 1e-9 && Math.abs(fine[1] - es.hi) < 1e-9 && es.tMin > 18 && es.tMax > 18, `c_min ${es.lo.toFixed(7)} at ${es.tMin.toFixed(3)}, c_max ${es.hi.toFixed(7)} at ${es.tMax.toFixed(3)}`);
  const pw = M.extremes(costOf({ id: "piecewise", params: { scale: 1, length: 0.8 } }));
  check("band", "Piecewise with a hold time of 0.8: the lowest cost comes near time 4.4 (the text says so)", pw.tMin > 4.3 && pw.tMin < 4.5, `c_min ${pw.lo.toFixed(5)} at time ${pw.tMin.toFixed(3)}`);
  const ok = [[0.0335838, "0.0335", S.cLo], [0.2977625, "0.298", S.cHi], [0.04999999999999999, "0.05", S.cLo], [costOf(M.FIG1A)(0), "0.1", S.cLo], [1.6, "1.6", S.cHi], [0.07000000000703725, "0.07", S.cLo]];
  check("band", "printed lowest and highest costs are rounded outward to three figures (an exact value prints as itself)", ok.every(([x, want, f]) => f(x) === want), ok.map(([x, , f]) => `${x} → ${f(x)}`).join(", "));
}
// every slider at its ends and its starting value, for each schedule with a band, and drawings held at 0.01 and 2
const settings = [];
for (const p of PRESETS) {
  if (p.id === "deadline" || p.id === "rising") continue;
  const vals = p.params.map((q) => [q.min, q.value, q.max]);
  const combos = vals.length === 1 ? vals[0].map((v) => [v]) : vals[0].flatMap((x) => vals[1].map((y) => [x, y]));
  for (const v of combos) settings.push({ label: `${p.label} (${p.params.map((q, i) => `${q.id} ${v[i]}`).join(", ")})`, start: p.params.every((q, i) => q.value === v[i]), choice: { id: p.id, params: Object.fromEntries(p.params.map((q, i) => [q.id, v[i]])) } });
}
settings.push({ label: "Draw your own (its default)", start: true, choice: { id: "draw", points: defaultDrawing() } });
for (const c of [0.01, 2]) settings.push({ label: `a drawing held at ${c}`, start: false, choice: { id: "draw", points: new Array(26).fill(c) } });
const flatMemo = new Map();
const flatProg = (c) => { const k = c.toPrecision(15); if (!flatMemo.has(k)) flatMemo.set(k, M.program(() => c, HOR)); return flatMemo.get(k); };
{
  let order = -Infinity, orderAt = "", gapAll = 0, gapAllAt = "", gapStart = 0, gapStartAt = "";
  for (const { label, start, choice } of settings) {
    const cost = costOf(choice), ext = M.extremes(cost), P = M.program(cost, HOR), lo = flatProg(ext.lo), hi = flatProg(ext.hi);
    const upC = M.flatOnGrid(ext.lo), dnC = M.flatOnGrid(ext.hi);
    for (let k = 0; k <= KV; k++) {
      const o = Math.max(P.bounds[k] - lo.bounds[k], hi.bounds[k] - P.bounds[k]);
      if (o > order) { order = o; orderAt = label; }
      const g = Math.max(Math.abs(upC - lo.bounds[k]), Math.abs(dnC - hi.bounds[k]));
      if (g > gapAll) { gapAll = g; gapAllAt = label; }
      if (start && g > gapStart) { gapStart = g; gapStartAt = label; }
    }
  }
  check("band", `on the grid, part (b) holds exactly at all ${settings.length} slider settings: the program's bound lies between its own flat bounds for c_max and c_min over the window`, order <= 1e-12, `largest step outside ${order.toExponential(1)} (${orderAt})`);
  check("band", "the text's “within 0.005”: at the schedules' starting settings, the continuous edges moved in sit within 0.005 of the program's flat bounds", gapStart < 0.005, `largest ${gapStart.toFixed(4)} (${gapStartAt})`);
  check("band", "the text's “up to about 0.02”: over every slider's extremes, the largest distance is between 0.015 and 0.025", gapAll > 0.015 && gapAll < 0.025, `largest ${gapAll.toFixed(4)} (${gapAllAt})`);
  const near = M.program(() => 0.01, 2 * VIEW + 3 * SPARE);
  let far = 0, pull = 0;
  for (let k = 0; k <= KV; k++) { far = Math.max(far, Math.abs(near.bounds[k] - M.flatOnGrid(0.01))); pull = Math.max(pull, M.flatOnGrid(0.01) - flatProg(0.01).bounds[k]); }
  check("band", "the text's reason at the lowest costs: at a constant 0.01, a forced choice at time 23 instead of 8.5 brings the constant-cost program's bound to within 0.001 of the moved-in B at every check of the window, while at 8.5 it is more than 0.01 below somewhere in it", far < 0.001 && pull > 0.01,
    `horizon ${HOR}: up to ${pull.toFixed(4)} below; horizon ${2 * VIEW + 3 * SPARE}: within ${far.toFixed(5)}; moved-in B ${M.flatOnGrid(0.01).toFixed(4)}`);
}
// ---- Lemma 1(b) at time 0, under one cost and its two constants ------------------------------------------------------
{
  const e = M.extremes(FIG);
  const lo = M.program(() => e.lo, HOR, { keep: [0] }), hi = M.program(() => e.hi, HOR, { keep: [0] });
  let bad = 0;
  for (let i = 0; i <= PF.m; i++) { const y = i * PF.h, a = M.valueAt(lo, 0, y), b = M.valueAt(PF, 0, y), c = M.valueAt(hi, 0, y); if (a < b - 1e-7 || b < c - 1e-7) bad++; }
  check("compare", "at time 0, V for c_min ≥ V for Figure 1(a) ≥ V for c_max at every grid point", bad === 0, `${bad} violations of ${PF.m + 1}`);
  check("compare", "and the bounds at time 0 come in the same order", lo.bounds[0] >= PF.bounds[0] && PF.bounds[0] >= hi.bounds[0], `${lo.bounds[0].toFixed(3)} ≥ ${PF.bounds[0].toFixed(3)} ≥ ${hi.bounds[0].toFixed(3)}`);
  const R = K.rng(2026 + 6), d = M.decisions(PF, 0, 0, 1, R, { keepPaths: 1 }).paths[0];
  const paid = [e.lo * d.tau, M.integral(FIG, 0, d.tau), e.hi * d.tau];
  check("compare", "the plate's path is charged in order under c_min, Figure 1(a)'s cost, and c_max", paid[0] <= paid[1] && paid[1] <= paid[2], paid.map((v) => v.toFixed(4)).join(" ≤ "));
}

// ---- Lemma 1(d) on a hard step -----------------------------------------------------------------------------------
{
  const step = M.costFrom({ kind: "step", lo: 0.1, hi: 1.6, at: 0.5 });
  const P = M.program(step, HOR, { keep: Array.from({ length: KV + 1 }, (_, k) => k) });
  let worst = 0, at = 0, atY = 0, ex = 0;
  for (const y of [0, 0.3, 0.6, 1]) {
    for (let k = 0; k < KV; k++) { const s = Math.abs(M.valueAt(P, k + 1, y) - M.valueAt(P, k, y)) / M.DT; if (s > worst) { worst = s; at = k * M.DT; atY = y; } }
    ex = Math.max(ex, Math.abs(M.valueAt(P, 45, y) - M.valueAt(P, 40, y)));
  }
  check("later", "on a hard step from 0.1 to 1.6, the program's value at evidence 0, 0.3, 0.6, and 1 moves by at most 1.5 per unit of start time", worst <= 1.5 + 2e-4, `steepest ${worst.toFixed(7)} at time ${at.toFixed(2)}, evidence ${atY}`);
  check("later", "and reaches that rate to the precision shown (two decimals) just before the jump, from evidence 0, where the program waits at least one check (the text says so)", worst.toFixed(2) === "1.50" && Math.abs(at - 0.49) < 1e-9 && atY === 0 && P.bounds[49] > 0, `${worst.toFixed(7)} at ${at.toFixed(2)}, evidence ${atY}; the bound there is ${P.bounds[49].toFixed(3)}`);
  check("later", "the exercise: |V(0.45, y) − V(0.4, y)| ≤ 0.075 at y = 0, 0.3, 0.6, 1", ex <= 0.075, `largest ${ex.toFixed(4)}`);
  let id = 0;
  for (const [t, D, tau] of [[0.4, 0.05, 0.5], [0.1, 0.25, 0.3], [0.45, 0.1, 1], [0.7, 0.05, 0.3]]) {
    const I = (a, b) => M.stepIntegral(0.1, 1.6, 0.5, a, b);
    id = Math.max(id, Math.abs((I(t + D, t + D + tau) - I(t, t + tau)) - (I(t + tau, t + D + tau) - I(t, t + D))));
    id = Math.max(id, Math.abs(I(t, t + tau) - M.integral(step, t, t + tau)));
  }
  // and when the two decisions don't overlap in time (τ < Δ), as the regrouped identity allows
  for (const [t, D, tau] of [[0.4, 0.05, 0.02], [0.3, 0.25, 0]]) {
    const I = (a, b) => M.stepIntegral(0.1, 1.6, 0.5, a, b) - (b < a ? M.stepIntegral(0.1, 1.6, 0.5, b, a) : 0);
    id = Math.max(id, Math.abs((I(t + D, t + D + tau) - I(t, t + tau)) - (I(t + tau, t + D + tau) - I(t, t + D))));
  }
  check("later", "the cost difference equals the difference of the two stretches, also when the decisions don't overlap; the exact integrals match the midpoint rule", id < 1e-3, `largest gap ${id.toExponential(1)}`);
  check("later", "at t = 0.4, Δ = 0.05, τ = 0.5 the ends differ by exactly the cap, 0.075", Math.abs((M.stepIntegral(0.1, 1.6, 0.5, 0.9, 0.95) - M.stepIntegral(0.1, 1.6, 0.5, 0.4, 0.45)) - 0.075) < 1e-12, "1.6 × 0.05 − 0.1 × 0.05");
}

// ---- decisions sampled against the bound --------------------------------------------------------------------------
{
  const P = M.program(() => 0.1, HOR);
  const d = M.decisions(P, 0, 0, 20000, K.rng(7));
  const tau = Array.from(d.tau), m = meanOf(tau), se = seOf(tau), bt = K.meanDecisionTime(0.1);
  check("decide", "at a constant 0.1, 20,000 sampled decisions from 0 take b tanh b on average (3 standard errors, plus 0.03 for the monitoring shift's next term)", Math.abs(m - bt) < 3 * se + 0.03, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${bt.toFixed(4)}`);
  const atOnce = M.decisions(PF, 100, PF.bounds[100] + 0.01, 200, K.rng(3));
  check("decide", "a start above the bound stops at once on every path", atOnce.tau.every((v) => v === 0), `${atOnce.tau.filter((v) => v === 0).length} of 200`);
  const a = M.decisions(PF, 20, 0, 300, K.rng(2026), { keepPaths: 16 }), b = M.decisions(PF, 20, 0, 300, K.rng(2026));
  check("decide", "the same seed gives the same decisions", a.tau.every((v, i) => v === b.tau[i]), "300 of 300 equal");
  let early = 0;
  for (const p of a.paths) {
    p.pts.forEach((q, i) => { const k = 20 + Math.round(q[0] / M.DT), hit = q[1] >= PF.bounds[k]; if ((i < p.pts.length - 1 && hit) || (i === p.pts.length - 1 && !hit)) early++; });
  }
  check("decide", "each kept path stays below the bound until its last check, where it is at or above it", early === 0, `${early} violations on 16 paths`);
}
// a deadline, through the page's own worker: every bar matches an independent count of the seeded decisions, and the
// decisions forced at the deadline land in the last bar
{
  const choice = { id: "deadline", params: { at: 0.45, c: 0.1 } };
  const m = await runWorker("../../book/assets/js/ch04-worker.js", { job: "decide", spec: { kind: "choice", choice }, t0: 0.4, y0: 0, n: 2000, seed: 2026, keepPaths: 16 });
  const steps = Array.from(m.tau, (v) => 40 + Math.round(v / 0.01));   // each decision's check, as an integer (time × 100)
  const moments = steps.map((k) => k / 100), forced = steps.filter((k) => k === 45).length;
  const { counts, beyond, before } = M.decisionBins(moments, 0.1, 0.45, 0.01);
  // independently: the bar for check k is k - 10, and the last bar (0.44 to 0.45) also takes the deadline's check
  const want = new Array(35).fill(0); for (const k of steps) want[Math.min(34, k - 10)]++;
  check("decide", "deadline 0.45 from time 0.4 (seed 2026): the worker's bound drops to 0 at the deadline, and every one of the 35 bars matches an independent count, the forced decisions in the last", m.ok && m.bounds[45] === 0 && m.bounds.length === 46 && beyond === 0 && before === 0 && counts.length === 35 && counts.every((c, j) => c === want[j]) && counts[34] === want[34] && forced > 1000,
    `${forced} of 2,000 forced at 0.45; last bar ${counts[34]} (independent count ${want[34]}); bars sum to ${counts.reduce((x, y) => x + y, 0)}`);
  const low = await runWorker("../../book/assets/js/ch04-worker.js", { job: "decide", spec: { kind: "choice", choice: { id: "constant", params: { c: 0.01 } } }, t0: 2, y0: 0, n: 2000, seed: 2026, keepPaths: 0 });
  // the chart's edges, as the page sets them
  const b0 = Math.min(low.bounds[low.k0], 5), span = Math.min(5, Math.max(0.8, 2.5 * Math.max(0, b0 * Math.tanh(b0)) + 0.4));
  const xMin = Math.max(0, Math.floor((2 - 0.25 * span) * 10) / 10), xMax = Math.min(VIEW + SPARE - 0.5, Math.ceil((2 + span) * 10) / 10);
  const lm = Array.from(low.tau, (v) => 2 + v), bins = M.decisionBins(lm, xMin, xMax, Math.max(0.01, Math.round((xMax - xMin) / 50 * 100) / 100));
  const past = lm.filter((v) => v > xMax + 1e-9).length, inside = lm.filter((v) => v >= xMin - 1e-9 && v <= xMax + 1e-9).length;
  const say = S.decideSay({ n: 2000, t0: 2, y0: 0, median: 1, mean: 1, se: 0.01, ec: 0.01, c0: 0.01, atOnce: 0, forced: 0, beyond: past, xMax });
  check("decide", "a constant 0.01 from time 2 (seed 2026): the decisions split at the chart's edges as an independent count says, and the sentence gives the number past the right edge", past > 0 && bins.beyond === past && bins.before === 0 && bins.counts.reduce((x, y) => x + y, 0) === inside && inside + past === 2000 && say.includes(`${past.toLocaleString("en-US")} end after time ${xMax.toFixed(2)}`),
    `chart ${xMin} to ${xMax}: ${inside} inside, ${past} past (bins: ${bins.beyond})`);
}

// ---- the cap and the martingale (Figure 1(a), from 0 at time 0, as the plate) -----------------------------------------
{
  const e = M.extremes(FIG), capP = M.program(() => e.lo, HOR);
  const d = M.decisions(PF, 0, 0, 1500, K.rng(2026 + 3), { cap: capP.bounds, track: 300, cost: FIG, keepPaths: 8 });
  const tau = Array.from(d.tau), sig = Array.from(d.sigma);
  check("cap", "τ* ≤ σ on all 1,500 sampled paths", tau.every((v, i) => v <= sig[i] + 1e-12), `${tau.filter((v, i) => v <= sig[i]).length} of 1500`);
  let above = -Infinity; for (let k = 0; k <= PF.steps; k++) above = Math.max(above, PF.bounds[k] - capP.bounds[k]);
  check("cap", "the program's bound is at or below its cap at every check of the horizon", above <= 1e-12, `largest excess ${above.toExponential(1)}`);
  const bb = K.B(e.lo), exact = bb * Math.tanh(bb), ms = meanOf(sig), se = seOf(sig);
  check("cap", "the grid's σ averages near the continuous model's b̄ tanh b̄ (3 standard errors, plus 0.03 for the monitoring shift's next term)", Math.abs(ms - exact) < 3 * se + 0.03, `${ms.toFixed(4)} ± ${se.toFixed(4)} vs ${exact.toFixed(4)}`);
  const V0 = M.valueAt(PF, 0, 0);
  let worst = 0;
  for (const k of [50, 100, 200, 300]) worst = Math.max(worst, Math.abs(d.meanM[k] - V0) / (3 * d.seM[k] + 0.002));
  check("cap", "the sampled mean of the value process stopped at τ* agrees with V(0, 0) at s = 0.5, 1, 2, 3, to 3 standard errors plus 0.002 for the grid", worst < 1, `V(0, 0) = ${V0.toFixed(4)}; means ${[50, 100, 200, 300].map((k) => d.meanM[k].toFixed(4)).join(", ")}`);
  check("cap", "and the sampled mean gain stopped at τ* agrees with it at s = 3, to the same tolerance", Math.abs(d.meanG[300] - V0) < 3 * d.seG[300] + 0.002 && d.meanG[0] === 0.5, `mean gain ${d.meanG[0].toFixed(3)} at 0, ${d.meanG[300].toFixed(4)} at 3`);
  const ts = Float64Array.from({ length: PF.steps + 1 }, (_, k) => k * M.DT), sc = score(PF.bounds, ts, FIG);
  check("cap", "on the grid, scoring the program's bound forward with model.js's scorer, without sampling, gives the program's own value V(0, 0) (within 1e-4)", Math.abs(sc.reward - V0) < 1e-4, `score ${sc.reward.toFixed(6)} vs V(0, 0) ${V0.toFixed(6)}`);
  let over = 0;
  for (const p of d.paths) for (const q of p.gain) if (q[2] > 1 - e.lo * q[0] + 1e-12) over++;
  check("cap", "the unstopped gain stays under 1 − c_min s on the eight kept paths", over === 0, `${over} violations`);
  const rise = d.paths.some((p) => p.gain.some((q, i) => i && q[2] > p.gain[i - 1][2]));
  check("words", "an unstopped gain can rise for a while, so step 1's sentence names only the falling line", rise && !/keeps falling/.test(S.capSay(0, { lo: 0.1, T: 3, maxG: -3 })) && /falls without bound/.test(S.capSay(0, { lo: 0.1, T: 3, maxG: -3 })), S.capSay(0, { lo: 0.1, T: 3, maxG: -3 }));
}
// the cap at the lowest cost a reader can pick, through the page's worker: the cap moves on the grid, and τ* ≤ σ
{
  const m = await runWorker("../../book/assets/js/ch04-worker.js", { job: "cap", spec: { kind: "choice", choice: { id: "smooth", params: { c0: 0.02, size: 1 } } }, t0: 0, y0: 0, n: 300, seed: 2029, track: 300, keepPaths: 8 });
  const ok = Array.from(m.tau).every((v, i) => v <= m.sigma[i] + 1e-12), moved = m.cap[0] - m.cap[350];
  check("cap", "Smooth at c₀ = 0.02, size 1 (c_min about 0.0067): τ* ≤ σ on all 300 paths, and the grid's cap falls by more than 0.01 within 3.5 time units, which is why the plate draws it as a curve", ok && moved > 0.01, `cap ${m.cap[0].toFixed(4)} at 0, ${m.cap[350].toFixed(4)} at 3.5`);
}

// ---- the sentences ------------------------------------------------------------------------------------------------
{
  const R = K.rng(11), r = () => R.next();
  let bad = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const out = [
      S.heroLabel("Cost jumps", 0.01 + r(), 1 + r() * 5),
      S.couplingSay(i % 2, r() * 2, r(), i % 3 ? r() * 2.5 : NaN, 2.5),
      S.waitSay([{ t: 0, b: r() }, { t: 1, b: r() }]),
      S.raySay(r() * 2.5, r() * 2),
      S.extremesNote("Smooth", 0.01 + r(), r() * 60, 0.5 + r(), r() * 60, 2.5),
      S.outsideNote(["deadline", "rising", "constant"][i % 3]),
      S.bandSay({ dn: r(), up: 1 + r(), gapDn: r() * 0.01, atDn: r() * 2.5, gapUp: r(), atUp: r() * 2.5, shiftGap: r() * 0.03, horizonPull: i % 2 === 0, subStep: i % 3 === 0, below: r(), above: r() }),
      S.noBandSay(r(), 1 + r()),
      S.sketchVerdict(i % 4 !== 0, r() * 0.5, r(), i % 2 === 0),
      S.compareSay(i % 4, { tau: r(), paid: [r(), r(), r()], v: [r(), r(), r()], b: [r(), r(), r()], min: r(), max: r(), dn: r(), up: r() }),
      S.laterSay(i % 4, { t: r(), D: 0.05, tau: 0.5, A: r(), B: r(), e1: r(), e2: r(), lo: 0.1, hi: 1.6, dv: r() * 0.1, slope: r() * 1.5, at: r() * 2.5 }),
      S.decideSay({ n: 2000, t0: r() * 2, y0: r() * 2, median: r(), mean: r(), se: r() * 0.01, ec: 0.01 + r(), c0: 0.01 + r(), atOnce: i % 7 ? 0 : 1, forced: i % 2 ? r() : 0, beyond: i % 3 ? Math.round(r() * 100) : 0, xMax: 1 + r() * 5 }),
      S.decideVerdict(i % 5 ? r() * 3 : NaN, r() * 3),
      S.capSay(i % 4, { lo: 0.1, T: 3, maxG: r(), ok: 1500, n: 1500, mTau: r(), mSig: 1 + r(), seSig: r() * 0.02, exact: 1.17, hi: 1.6, V0: 0.7, drift: r() * 0.01, seEnd: r() * 0.01, G0: 0.5, Gend: 0.7 }),
    ];
    for (const s of out) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  // the band sentence on real settings: the distances it prints are the measured ones, and it names the reasons
  for (const [label, choice, want] of [["a constant 0.01", { id: "constant", params: { c: 0.01 } }, "forced choice"], ["the 32-fold jump at 0.2", { id: "jump", params: { at: 0.2, factor: 32 } }, "first step"], ["Figure 1(a)", M.FIG1A, null]]) {
    const cost = costOf(choice), ext = M.extremes(cost), P = M.program(cost, HOR), lo = flatProg(ext.lo), hi = flatProg(ext.hi);
    const ts = Array.from({ length: KV + 1 }, (_, k) => k * M.DT), cut = (Q) => Array.from(Q.bounds.subarray(0, KV + 1));
    const st = M.bandStats(ts, cut(P), cut(lo), cut(hi), M.flatOnGrid(ext.lo), M.flatOnGrid(ext.hi), ts.map((t) => M.flatOnGrid(cost(t))));
    const say = S.bandSay(st);
    const good = st.gapUp >= -1e-12 && st.gapDn >= -1e-12 && say.includes(st.shiftGap < 0.0005 ? "less than 0.0005" : st.shiftGap.toFixed(3)) && (want ? say.includes(want) : !/forced choice|first step/.test(say));
    check("words", `the band sentence for ${label} prints the measured distance from the band's edges (${st.shiftGap.toFixed(3)})${want ? ` and names its reason (“${want}”)` : ", with no reason when the edges agree"}`, good, `gaps ${st.gapDn.toFixed(4)} and ${st.gapUp.toFixed(4)}; ${say.slice(say.indexOf("The continuous"), say.indexOf("Of the checks")).trim()}`);
  }
  {
    const tolSay = [S.sketchVerdict(true, 0.1, 0, true), S.sketchVerdict(true, 0.1, 1, true)];
    check("words", "the sketch verdict (sketchVerdict) states the 0.002 tolerance either way", /to within 0\.002/.test(tolSay[0]) && /more than 0\.002 outside/.test(tolSay[1]), tolSay[1]);
    const pts = new Array(26).fill(0.1); pts[25] = 0.10001;
    const cost = costOf({ id: "draw", points: pts }), e = M.extremes(cost), note = S.extremesNote("Draw your own", e.lo, e.tLo, e.hi, e.tHi, VIEW);
    let first = NaN; for (let i = 0; i <= 100000 && Number.isNaN(first); i++) if (cost(i * 0.001) >= e.hi * 0.995) first = i * 0.001;
    check("words", "a drawing at 0.1 with 0.10001 at 2.5: the note prints the scanned extremes beside the outward-rounded labels, and its time is the first within 0.5% of the scanned value", note.includes("0.10001") && note.includes("highest 0.101") && /within 0\.5% of those scanned values/.test(note) && first === e.tHi, note);
    check("words", "the cap plate's fallback note says a deadline's cost is infinite after it, and the decision sentence charges a forced decision the cost at the deadline itself", /infinite cost after its deadline/.test(S.capFallback("Deadline", "deadline")) && /cost at the deadline itself/.test(S.decideSay({ n: 2000, t0: 0.4, y0: 0, median: 0.05, mean: 0.04, se: 0.001, ec: 0.1, c0: 0.1, atOnce: 0, forced: 0.64, beyond: 0, xMax: 0.45 })), S.capFallback("Deadline", "deadline"));
    check("words", "the constant-cost note calls the band the constant-cost program's bound and says it isn't flat on the grid", /constant-cost program's bound/.test(S.outsideNote("constant")) && /isn't flat/.test(S.outsideNote("constant")) && !/flat bound/.test(S.bandSay({ dn: 1, up: 1, gapDn: 0, atDn: 0, gapUp: 0, atUp: 0, shiftGap: 0.016, horizonPull: true, subStep: false, below: 1, above: 0 })), S.outsideNote("constant"));
  }
  {
    // Constant through the band plate's Show me: the worker's bounds, then bandKind, bandReveal, and revealSay, whose
    // results the plate prints as they come. Constant has a band, collapsed to one curve (c_min = c_max)
    const ch = { id: "constant", params: { c: 0.1 } }, kind = M.bandKind(ch), cost = costOf(ch), ext = M.extremes(cost);
    const W = (spec) => runWorker("../../book/assets/js/ch04-worker.js", { job: "values", spec, keep: "none" });
    const data = await W({ kind: "choice", choice: ch });
    const flats = M.hasBand(kind) ? { lo: await W({ kind: "const", c: ext.lo }), hi: await W({ kind: "const", c: ext.hi }) } : null;
    const n = 51, on = Array.from({ length: n }, (_, i) => data.bounds[Math.round(((i / (n - 1)) * VIEW) / data.dt)]), off = on.map((v) => v + 0.05);
    const rOn = M.bandReveal({ kind, sketch: on, view: VIEW, data, flats, cost, dl: null, ext }), rOff = M.bandReveal({ kind, sketch: off, view: VIEW, data, flats, cost, dl: null, ext });
    const sOn = S.revealSay(rOn, true), sOff = S.revealSay(rOff, true);
    // the band's two edges, as bandSeries gives them to the reveal, are one curve at every plotted check
    const sr = M.bandSeries(data, flats, VIEW, cost, null);
    let split = 0; for (let k = 0; k < sr.ts.length; k++) split = Math.max(split, Math.abs(sr.up[k] - sr.dn[k]));
    check("words", "Constant 0.1 through the band plate's Show me (the worker's bounds, then bandKind, bandSeries, bandReveal, and revealSay, which the plate prints as they come): it gets the band, its two edges equal at all 251 checks in the window, and the constant-cost note; a drawing on the program's bound lies inside it to within 0.002, and one 0.05 above lies outside",
      kind === "constant" && rOn.band && rOn.cnt === n && sr.ts.length === KV + 1 && sr.up.length === KV + 1 && sr.dn.length === KV + 1 && split < 1e-12
      && sOn.startsWith(S.outsideNote("constant")) && /all of it lies inside the band, to within 0\.002\.$/.test(sOn) && /100% of it lies more than 0\.002 outside the band\.$/.test(sOff),
      `edges differ by at most ${split.toExponential(1)} over ${sr.ts.length} checks; ${sOn.slice(-90)} | ${sOff.slice(-70)}`);
  }
  {
    // a schedule without a band (Rising, Deadline): the range tile and the sentence print the bound's lowest value with
    // one formatter (boundText), so a positive minimum below the grid's first step isn't printed as 0, and they say what
    // a 0 or such a minimum means; through the worker, bandReveal, rangeTile, and revealSay, as the plate prints them
    const W = (spec) => runWorker("../../book/assets/js/ch04-worker.js", { job: "values", spec, keep: "none" });
    const rows = [];
    for (const [name, ch] of [["Rising from 0.6 at rate 2", { id: "rising", params: { at: 0.6, rate: 2 } }], ["Rising from 0.55 at rate 2", { id: "rising", params: { at: 0.55, rate: 2 } }], ["a deadline at 1", { id: "deadline", params: { at: 1, c: 0.1 } }]]) {
      const cost = costOf(ch), dl = ch.id === "deadline" ? ch.params.at : null, view = dl ?? VIEW, data = await W({ kind: "choice", choice: ch });
      const r = M.bandReveal({ kind: M.bandKind(ch), sketch: new Array(51).fill(NaN), view, data, flats: null, cost, dl, ext: M.extremes(cost) });
      rows.push({ name, r, tile: S.rangeTile(r), say: S.revealSay(r, false), last: data.bounds[Math.round(view / data.dt)] });
    }
    const [r6, r55, rd] = rows;
    check("words", "the band plate without a band: on Rising from 0.6 at rate 2 the program's lowest bound is positive and below the first step, and the tile and sentence print it as 0.002 and say the program still waits at y = 0; from 0.55 the lowest is 0 and the sentence says the program stops at once; at a deadline at 1 the bound is 0 only at the forced choice, and the sentence says so",
      !r6.r.band && r6.r.lo > 0 && r6.r.lo < 0.02 && r6.tile === `${r6.r.lo.toFixed(3)} to ${r6.r.hi.toFixed(2)}` && r6.tile.startsWith("0.002 to") && r6.say.startsWith(`Over the window, the best bound runs from 0.002 to`) && /Its lowest value, 0\.002, is below the grid's first evidence step, 0\.02: there the program still waits at y = 0/.test(r6.say)
      && r55.r.lo === 0 && r55.tile.startsWith("0.00 to") && /Where it is 0, the program stops at once at every evidence level, y = 0 included\./.test(r55.say) && !/waits/.test(r55.say)
      && rd.r.lo === 0 && rd.last === 0 && rd.r.loOpen > 0.02 && /It is 0 only at the deadline, where the choice is forced\./.test(rd.say) && !/stops at once|waits/.test(rd.say)
      && S.boundText(0.0004) === "< 0.001" && S.boundText(0.0123) === "0.012" && S.boundText(0.5) === "0.50" && S.boundText(0) === "0.00",
      rows.map((x) => `${x.name}: lowest ${x.r.lo.toExponential(3)}, tile ${x.tile}`).join("; "));
  }
  check("words", "a guess after the median reads late, and one before it early", /late/.test(S.decideVerdict(1.2, 0.8)) && /early/.test(S.decideVerdict(0.5, 0.8)) && /within 0.05/.test(S.decideVerdict(0.82, 0.8)), "checked");
  check("words", "the hero names the flat bounds for the highest and the lowest cost", S.heroLabel("Cost jumps", costOf(M.FIG1A)(0), 1.6) === "Cost jumps: the bound stays between B(1.6) and B(0.1)", S.heroLabel("Cost jumps", costOf(M.FIG1A)(0), 1.6));
  check("words", "a deadline's forced decisions are named in the decision sentence, and the deadline note says the cost is infinite after it", /forced at the deadline/.test(S.decideSay({ n: 2000, t0: 0.4, y0: 0, median: 0.05, mean: 0.04, se: 0.001, ec: 0.1, c0: 0.1, atOnce: 0, forced: 0.64, beyond: 0, xMax: 0.45 })) && /infinite after the deadline/.test(S.outsideNote("deadline")), "checked");
}

// ---- the decision time: a fixed threshold once the remaining cost is constant, and the proof's starting condition ----
{
  // on the grid, the bound from a time on depends only on the cost from then on: a drawing that varies to 2.5 and is 0.2
  // after has, at each check from 2.5 to 3, the bound of the constant-0.2 program with the same time left
  const pts = defaultDrawing(); pts[25] = 0.2;
  const P = M.program(costOf({ id: "draw", points: pts }), HOR), Q = M.program(() => 0.2, HOR - VIEW), k0 = Math.round(VIEW / M.DT);
  let d = 0; for (let j = 0; j <= 50; j++) d = Math.max(d, Math.abs(P.bounds[k0 + j] - Q.bounds[j]));
  const moved = Math.abs(P.bounds[0] - P.bounds[k0]) > 0.05;
  check("program", "a drawing that changes until 2.5 and stays at 0.2 after: at each check from 2.5 to 3, the program's bound is the constant-0.2 program's with the same time left (within 1e-9), though it moved before 2.5; the bound depends only on the cost from that time on",
    d < 1e-9 && moved, `largest difference ${d.toExponential(1)}; bound ${P.bounds[0].toFixed(3)} at 0, ${P.bounds[k0].toFixed(3)} at 2.5`);
  const text = readFileSync(join(ROOT, "book/content/ch04.py"), "utf8");
  // the whole constant-tail claim, in the text and in the exercise: the infinite horizon, a constant remaining cost, the
  // threshold B(c) for the whole decision, and the first entry into [B(c), infinity), not the hitting time of B(c)
  const TEXT = String.raw`On the infinite horizon, the bound at a time depends only on the cost from that time on, so when the remaining cost $s \mapsto c(t + s)$ is a constant $c$ (a constant schedule, or a start after a drawing's last change), the threshold is the flat bound $B(c)$ for the whole decision, and $\tau^*$ is the first entry into $[B(c), \infty)$ (0 for a start at or above $B(c)$).`;
  const EXER = String.raw`When the remaining cost $s \mapsto c(t + s)$ is a constant $c$, on the infinite horizon, the bound is $B(c)$ for the whole decision and $\tau^*$ is the first entry into $[B(c), \infty)$: that covers a constant schedule, and a start after a schedule's last change.`;
  check("words", "the decision-time text and its exercise each say the threshold can change during a decision, and that when the remaining cost is a constant c, on the infinite horizon, it is B(c) for the whole decision and the decision is the first entry into [B(c), infinity); the exercise gives the proof's bracketing only for starts below b0 - a|eps|; and the strip names the Snell envelope as what is a martingale",
    /The bound can change while the decision is open/.test(text) && text.includes(TEXT) && text.includes(EXER) && /can change during the decision/.test(text) && /for starts below the lower level, \$y < b_0 - a\|\\varepsilon\|\$/.test(text)
    && /the Snell envelope, stopped there, is a martingale/.test(text) && !/hitting time of \$B\(c\)\$/.test(text) && !/The bound moves while the decision is open/.test(text) && !/the value process stopped there/.test(text), `text: ${text.includes(TEXT)}, exercise: ${text.includes(EXER)}`);
}
