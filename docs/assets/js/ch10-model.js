// Chapter 10's model, with no DOM: the paper's random schedules rebuilt from their parameters, the seven rules of
// the held-out test as experiments/held_out.py at the tag defines them, and one run that scores them all against the
// dynamic program on a grid, as that script does (its loss, accuracy, mean decision time, and largest bound error
// before t = min(4, deadline)). The program, the scorer, the per-moment and weighted rules, and the kernels come from
// model.js; the averaged-cost rule as the paper's code computes it (shortcuts.weighted_ahead) from ch08-rule.js.
// tools/checks/ch10.mjs holds every rule and every score here to the paper's code run on the same grid
// (tools/validity/ch10.json), and the rebuilt schedules to the paper's own schedule functions.
import { boundForCost, kernelForBound, weightedBound, exactPolicy, score, toDiscrete } from "./model.js?v=06afe54c9a";
import { averagedCost } from "./ch08-rule.js?v=06afe54c9a";
import { B } from "./kernel.js?v=06afe54c9a";

export const HORIZON = 10;                       // the paper's experiments force the choice at t = 10 (common.HORIZON)
export const PAGE_GRID = { dt: 0.01, h: 0.02, cap: 5 };
export const RULES = ["per_moment", "weighted", "weighted_one_pass", "averaged_cost", "shift_mean", "shift_half", "best_constant"];
export const RULE_NAMES = {
  per_moment: "Per-moment", weighted: "Weighted look-ahead", weighted_one_pass: "Weighted, one pass", averaged_cost: "Averaged cost",
  shift_mean: "Shift by mean look-ahead", shift_half: "Shift by 0.5", best_constant: "Tuned constant (oracle)",
};
/** The rules' names inside a sentence, with no commas of their own. */
export const SAY_NAMES = {
  per_moment: "the per-moment rule", weighted: "the weighted look-ahead", weighted_one_pass: "the one-pass weighted rule", averaged_cost: "the averaged-cost rule",
  shift_mean: "the shift by the mean look-ahead", shift_half: "the shift by 0.5", best_constant: "the tuned constant",
};
export const FAMILIES = ["smooth", "step", "deadline", "pulse", "ramp", "multi-step", "piecewise"];
export const FAMILY_NAMES = { smooth: "Smooth", step: "Step", deadline: "Deadline", pulse: "Pulse", ramp: "Ramp", "multi-step": "Multi-step", piecewise: "Piecewise" };

// ---- the paper's schedules, from their parameters (experiments/common.py and families.py) -------------------------

const logistic = (x) => 1 / (1 + Math.exp(-x));
/** A schedule of the paper's development or held-out set as a cost function of time; a deadline's cost is infinite
 * after it, as common.Schedule writes it. */
export function familyCost(f, p) {
  if (f === "smooth") return (t) => p.c0 * Math.exp(p.a[0] * Math.sin(p.om[0] * t + p.ph[0]) + p.a[1] * Math.sin(p.om[1] * t + p.ph[1]) + p.a[2] * Math.sin(p.om[2] * t + p.ph[2]));
  if (f === "step") return (t) => p.c0 + (p.c1 - p.c0) / (1 + Math.exp(-(t - p.t0) / 0.05));
  if (f === "deadline") return (t) => (t <= p.T + 1e-12 ? p.c0 : Infinity);
  if (f === "pulse") return (t) => p.c0 * Math.exp(p.amp * Math.exp(-0.5 * ((t - p.t0) / p.width) ** 2));
  if (f === "ramp") return (t) => p.c0 * Math.exp(p.total * Math.min(Math.max(t / p.t1, 0), 1));
  if (f === "multi-step") return (t) => { let s = 0; for (let j = 0; j < p.jumps.length; j++) s += p.jumps[j] / (1 + Math.exp(-(t - p.times[j]) / 0.05)); return p.c0 * Math.exp(s); };
  if (f === "piecewise") return (t) => { let s = p.levels[0]; for (let j = 0; j < p.cuts.length; j++) s += (p.levels[j + 1] - p.levels[j]) * logistic((t - p.cuts[j]) / 0.05); return Math.exp(s); };
  throw new Error("unknown family " + f);
}
export const familyDeadline = (f, p) => (f === "deadline" ? p.T : null);

const n3 = (x) => (x >= 0.1 ? x.toFixed(2) : x.toPrecision(2));
/** A short description of one of the paper's schedules, in time units. */
export function familyLabel(f, p) {
  if (f === "smooth") return `Smooth around ${n3(p.c0)}`;
  if (f === "step") return `Step from ${n3(p.c0)} to ${n3(p.c1)} at time ${p.t0.toFixed(2)}`;
  if (f === "deadline") return `Cost ${n3(p.c0)}, forced choice at time ${p.T.toFixed(2)}`;
  if (f === "pulse") return `Pulse from ${n3(p.c0)}, ${Math.exp(p.amp).toFixed(2)} times at time ${p.t0.toFixed(2)}`;
  if (f === "ramp") return `Ramp from ${n3(p.c0)} to ${n3(p.c0 * Math.exp(p.total))} by time ${p.t1.toFixed(2)}`;
  if (f === "multi-step") return `${p.jumps.length} steps from ${n3(p.c0)}`;
  if (f === "piecewise") return `Piecewise, ${p.cuts.length} pieces from ${n3(Math.exp(p.levels[0]))}`;
  return f;
}

// ---- the five more rules (experiments/held_out.py) ------------------------------------------------------------------

/** The closed-form mean look-ahead m(c) = c (sinh(2b)/2 - b + 2 b^2 tanh b), b = B(c), tabulated at 600 points of
 * log c on [log 1e-5, log 1e4] and read linearly between them, with c clipped to that range; 0 where c is infinite. */
const LC = Array.from({ length: 600 }, (_, i) => Math.log(1e-5) + (i * (Math.log(1e4) - Math.log(1e-5))) / 599);
const MT = LC.map((l) => { const c = Math.exp(l), b = B(c); return c * (Math.sinh(2 * b) / 2 - b + 2 * b * b * Math.tanh(b)); });
export function meanLookAheadTable(c) {
  if (c === Infinity) return 0;
  const x = Math.log(Math.min(Math.max(c, 1e-5), 1e4));
  if (x <= LC[0]) return MT[0];
  if (x >= LC[599]) return MT[599];
  const f = ((x - LC[0]) / (LC[599] - LC[0])) * 599, i = Math.min(Math.floor(f), 598);
  // np.interp's form: y_i + (y_{i+1} - y_i) (x - x_i) / (x_{i+1} - x_i)
  return MT[i] + ((MT[i + 1] - MT[i]) * (x - LC[i])) / (LC[i + 1] - LC[i]);
}

/** The weighted rule after a single pass (shortcuts.weighted_bound with self_consistent=False): the per-moment
 * bounds ahead averaged with the kernel for the per-moment bound now, with no iteration and no damping. */
export function onePass(cost, ts) {
  return Float64Array.from(ts, (t) => {
    const { s, w } = kernelForBound(Math.round(Math.max(boundForCost(cost(t)), 0.01) * 1000) / 1000);
    let acc = 0;
    for (let j = 0; j < s.length; j++) acc += w[j] * boundForCost(cost(t + s[j]));
    return acc;
  });
}
/** The per-moment rule shifted ahead: B(c(t + m(c(t)))), or B(c(t + d)) for a fixed d. */
export const shiftMean = (cost, ts) => Float64Array.from(ts, (t) => boundForCost(cost(t + meanLookAheadTable(cost(t)))));
export const shiftBy = (cost, ts, d) => Float64Array.from(ts, (t) => boundForCost(cost(t + d)));

/** SciPy's bounded scalar minimizer (scipy.optimize.minimize_scalar, method "bounded"), step for step, so the tuned
 * constant is searched as experiments/common.py's best_fixed searches it. Returns { x, fun, nfev }. */
export function fminbound(func, x1, x2, xatol = 1e-5, maxfun = 500) {
  const sqrtEps = Math.sqrt(2.2e-16), golden = 0.5 * (3 - Math.sqrt(5));
  let a = x1, b = x2, fulc = a + golden * (b - a), nfc = fulc, xf = fulc, rat = 0, e = 0, x = xf;
  let fx = func(x), num = 1, ffulc = fx, fnfc = fx;
  let xm = 0.5 * (a + b), tol1 = sqrtEps * Math.abs(xf) + xatol / 3, tol2 = 2 * tol1;
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  while (Math.abs(xf - xm) > tol2 - 0.5 * (b - a)) {
    let gold = true;
    if (Math.abs(e) > tol1) {
      gold = false;
      let r = (xf - nfc) * (fx - ffulc), q = (xf - fulc) * (fx - fnfc), p = (xf - fulc) * q - (xf - nfc) * r;
      q = 2 * (q - r);
      if (q > 0) p = -p;
      q = Math.abs(q);
      r = e; e = rat;
      if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (a - xf) && p < q * (b - xf)) {
        rat = (p + 0) / q; x = xf + rat;
        if (x - a < tol2 || b - x < tol2) rat = tol1 * (sign(xm - xf) + (xm - xf === 0 ? 1 : 0));
      } else gold = true;
    }
    if (gold) { e = xf >= xm ? a - xf : b - xf; rat = golden * e; }
    x = xf + (sign(rat) + (rat === 0 ? 1 : 0)) * Math.max(Math.abs(rat), tol1);
    const fu = func(x);
    num++;
    if (fu <= fx) {
      if (x >= xf) a = xf; else b = xf;
      fulc = nfc; ffulc = fnfc; nfc = xf; fnfc = fx; xf = x; fx = fu;
    } else {
      if (x < xf) a = x; else b = x;
      if (fu <= fnfc || nfc === xf) { fulc = nfc; ffulc = fnfc; nfc = x; fnfc = fu; }
      else if (fu <= ffulc || fulc === xf || fulc === nfc) { fulc = x; ffulc = fu; }
    }
    xm = 0.5 * (a + b); tol1 = sqrtEps * Math.abs(xf) + xatol / 3; tol2 = 2 * tol1;
    if (num >= maxfun) break;
  }
  return { x: xf, fun: fx, nfev: num };
}

// ---- one schedule, every rule, scored ---------------------------------------------------------------------------

/** Run the dynamic program and the chosen rules on one schedule, as experiments/held_out.py does, on the grid
 * (dt, h, cap), with the choice forced at the deadline or at HORIZON. Losses are in points per 100 trials against
 * the program scored by the same scorer; accuracy and decision time are the scorer's; maxDx is the largest gap
 * between the rule's bound and the program's, both capped at 4, at the grid times before min(4, deadline). The
 * continuous rules are moved in by 0.5826 sqrt(dt); the tuned constant is a single evidence bound searched on
 * [0.02, 4] with tolerance 0.005. Returns the thinned curves (every `every`-th grid time up to `view`, or to the forced
 * choice) for drawing, and with `raw` every grid time's bounds as well. */
export function runRules(cost, deadline, { rules = RULES, dt = PAGE_GRID.dt, h = PAGE_GRID.h, cap = PAGE_GRID.cap, view = 4, every = 2, progress = null, raw = false } = {}) {
  const horizon = deadline ?? HORIZON;
  const ex = exactPolicy(cost, horizon, dt, h, cap);
  const ts = Array.from(ex.ts);
  progress?.(0.2);
  const sc = (x) => score(x, ts, cost, h, cap);
  const best = sc(ex.bounds);
  const outcome = (x) => {
    const o = sc(x);
    return { loss: 100 * (best.reward - o.reward), p: o.p, rt: o.rt, maxDx: maxGap(ts, x, ex.bounds, horizon) };
  };
  const shift = (a) => Float64Array.from(a, (b) => toDiscrete(b, dt));
  const cont = {};
  const out = { exact: { reward: best.reward, p: best.p, rt: best.rt }, rules: {}, x: null, horizon, deadline, dt, h, cap };
  const steps = rules.length;
  rules.forEach((k, i) => {
    let x;
    if (k === "per_moment") cont[k] = Float64Array.from(ts, (t) => boundForCost(cost(t)));
    else if (k === "weighted") cont[k] = weightedBound(cost, ts);
    else if (k === "weighted_one_pass") cont[k] = onePass(cost, ts);
    else if (k === "averaged_cost") cont[k] = averagedCost(cost, ts, null);
    else if (k === "shift_mean") cont[k] = shiftMean(cost, ts);
    else if (k === "shift_half") cont[k] = shiftBy(cost, ts, 0.5);
    if (k === "best_constant") {
      const r = fminbound((xb) => -sc(new Float64Array(ts.length).fill(xb)).reward, 0.02, 4, 0.005);
      out.x = r.x;
      x = new Float64Array(ts.length).fill(r.x);
    } else x = shift(cont[k]);
    out.rules[k] = { ...outcome(x), bound: x };
    progress?.(0.2 + (0.8 * (i + 1)) / steps);
  });
  // thin the curves for drawing: every `every`-th time up to the view, or to the program's last grid time (a deadline's
  // forced choice, which can sit up to half a step past the deadline, as in the paper's code), and always the last one
  let last = 0;
  const end = Math.min(view, ts[ts.length - 1]);
  while (last + 1 < ts.length && ts[last + 1] <= end + 1e-9) last++;
  const keep = [];
  for (let k = 0; k <= last; k += every) keep.push(k);
  if (keep[keep.length - 1] !== last) keep.push(last);
  const pick = (a) => keep.map((k) => (Number.isFinite(a[k]) ? a[k] : null));
  // for the checks: every grid time, the program's bound, and each rule's bound as scored
  if (raw) out.raw = { ts, exact: Array.from(ex.bounds), rules: Object.fromEntries(rules.map((k) => [k, Array.from(out.rules[k].bound)])) };
  out.t = keep.map((k) => ts[k]);
  out.cost = keep.map((k) => { const c = cost(ts[k]); return Number.isFinite(c) ? c : null; });
  out.exactBound = pick(ex.bounds);
  for (const k of rules) { out.rules[k].curve = pick(out.rules[k].bound); delete out.rules[k].bound; }
  return out;
}

/** The largest bound gap of one rule, as the paper measures it (held_out.py): |min(x, 4) - min(x_ex, 4)| at the grid
 * times before min(4, horizon), against the given reference bounds (the program's own, or another code's). */
export function maxGap(ts, x, xEx, horizon) {
  const early = Math.min(4, horizon);
  let d = 0;
  for (let k = 0; k < ts.length && ts[k] < early; k++) d = Math.max(d, Math.abs(Math.min(x[k], 4) - Math.min(xEx[k], 4)));
  return d;
}

/** The gap curves the share plate draws: each rule's bound minus the program's, both capped at 4, at the drawn times
 * before min(4, deadline), the times the paper's gap statistic covers. A deadline's forced choice is left out: there
 * every undecided trial chooses, whatever either threshold is. */
export function gapCurves(run) {
  const end = Math.min(4, run.horizon), t = [], pm = [], wb = [];
  run.t.forEach((x, i) => {
    if (x >= end - 1e-9) return;
    const e = run.exactBound[i], a = run.rules.per_moment.curve[i], b = run.rules.weighted.curve[i];
    t.push(x);
    pm.push(a === null || e === null ? NaN : Math.min(a, 4) - Math.min(e, 4));
    wb.push(b === null || e === null ? NaN : Math.min(b, 4) - Math.min(e, 4));
  });
  return { t, pm, wb, end, forced: run.deadline !== null && run.deadline < 4 ? run.t[run.t.length - 1] : null };
}

/** The held-out plate's guess line, weighted loss = k times per-moment loss with k = 1 - guess; a guess of 100% has no
 * line on log axes (k = 0), so it gives null. */
export const guessSlope = (g) => (g >= 1 - 1e-12 ? null : 1 - g);

// ---- Table 9's shape ------------------------------------------------------------------------------------------------

export const SCALING = { c0: 0.2, amps: [0.05, 0.1, 0.2, 0.4, 0.8] };
/** experiments/loss_scaling.py's shape: f(t) = 0.6 sin(1.3t + 0.4) + 0.5 sin(3.1t + 2) + 0.4 sin(5.2t + 4). */
export const scalingShape = (t) => 0.6 * Math.sin(1.3 * t + 0.4) + 0.5 * Math.sin(3.1 * t + 2.0) + 0.4 * Math.sin(5.2 * t + 4.0);
export const scalingCost = (a) => (a === 0 ? () => SCALING.c0 : (t) => SCALING.c0 * Math.exp(a * scalingShape(t)));
/** The per-moment and weighted rules' losses for Table 9's shape at amplitude a (0 for the constant cost), scored as
 * loss_scaling.py scores them, on the grid (dt, h, cap). */
export function scalingLosses(a, grid = PAGE_GRID) {
  const r = runRules(scalingCost(a), null, { rules: ["per_moment", "weighted"], ...grid, view: 0 });
  return { pm: r.rules.per_moment.loss, wb: r.rules.weighted.loss };
}

// ---- summaries of the paper's data -----------------------------------------------------------------------------------

/** The median, as numpy computes it. */
export function median(v) {
  const a = [...v].sort((x, y) => x - y), n = a.length;
  return n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2]);
}
/** The q-th percentile with numpy's default (linear) interpolation. */
export function percentile(v, q) {
  const a = [...v].sort((x, y) => x - y), pos = ((a.length - 1) * q) / 100, i = Math.floor(pos), f = pos - i;
  return i + 1 < a.length ? a[i] + (a[i + 1] - a[i]) * f : a[i];
}
/** Share of the per-moment loss the weighted rule avoids, schedule by schedule, where the per-moment loss is at
 * least 0.01 point per 100 trials (make_figures.py's recovery()). */
export function recovered(rows) {
  return rows.filter((r) => r.r[0][0] >= 0.01).map((r) => 1 - r.r[1][0] / r.r[0][0]);
}
/** A rule's loss on a held-out row (index in RULES). */
export const lossOf = (row, k) => (k < 2 ? row.r[k][0] : row.r[k]);
/** Wins and losses against the per-moment rule, as Table 6 counts them (a difference over 1e-9). */
export function winsLosses(rows, k) {
  let w = 0, l = 0;
  for (const r of rows) { const a = lossOf(r, k), pm = lossOf(r, 0); if (a < pm - 1e-9) w++; else if (a > pm + 1e-9) l++; }
  return { wins: w, losses: l };
}

// ---- the paper's tables and figures, from its per-schedule results (as paper/make_figures.py computes them) ----------

/** Figure 5 and Table 5's shares avoided: over all held-out schedules and by family. */
export function heldSummary(D) {
  const rec = recovered(D.held);
  const byFam = Object.fromEntries(FAMILIES.map((f) => { const rc = recovered(D.held.filter((r) => r.f === f)); return [f, { n: rc.length, med: median(rc), p10: percentile(rc, 10) }]; }));
  return { n: rec.length, med: median(rec), p10: percentile(rec, 10), min: Math.min(...rec), byFam };
}
/** Table 3's "Recovered": one minus the ratio of each development family's total losses. */
export function devRecovered(D) {
  return Object.fromEntries(["smooth", "step", "deadline"].map((f) => { const rs = D.dev.filter((r) => r.f === f); return [f, 1 - rs.reduce((a, r) => a + r.wb, 0) / rs.reduce((a, r) => a + r.pm, 0)]; }));
}
/** Table 8's rows: each row's total loss and prediction for both rules, and the weighted rule's prediction from t > 8. */
export function formulaRows(D) {
  const keys = [["smooth", 0.25], ["smooth", 0.5], ["smooth", 1], ["step", 1.5], ["step", 3], ["step", 16]];
  return keys.map(([kind, size]) => {
    const rs = D.formula.filter((r) => r.kind === kind && r.size === size), sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    return { kind, size, n: rs.length, pmLoss: sum((r) => r.per_moment.loss), pmPred: sum((r) => r.per_moment.predicted), wbLoss: sum((r) => r.weighted.loss), wbPred: sum((r) => r.weighted.predicted), wbLate: sum((r) => r.weighted.late) };
  });
}
/** Table 9's effective orders (log ratio of the end losses over log ratio of the amplitudes) and the per-moment growth
 * factors up to a = 0.4, from the file's unrounded losses. */
export function scalingOrders(sc) {
  const rowsIn = (lo, hi) => sc.rows.filter((r) => r.amplitude >= lo && r.amplitude <= hi);
  const order = (grid, key, lo, hi) => { const a = rowsIn(lo, hi); return Math.log(a[a.length - 1][grid][key] / a[0][grid][key]) / Math.log(a[a.length - 1].amplitude / a[0].amplitude); };
  const growth = [];
  for (let i = 1; i < sc.rows.length; i++) if (sc.rows[i].amplitude <= 0.4) growth.push(sc.rows[i].paper.per_moment / sc.rows[i - 1].paper.per_moment);
  return { pm: order("paper", "per_moment", 0, 0.4), wbPaper: order("paper", "weighted", 0.2, 0.8), wbFine: order("fine", "weighted", 0.2, 0.8), growth };
}
