// Appendix B's model: the two reference programs at a constant cost, as pure functions the worker and the checks share.
// The evidence grid is model.js's exactPolicy (the port of the paper's known.backward_induction_x); the belief grid is
// a port of the paper's known.backward_induction (belief_grid, transition_matrix, bound_from_values), at this page's
// time step. tools/checks/appB.mjs holds both to the paper's code at the book's tag (tools/validity/appB.json).
import { exactPolicy, boundForCost } from "./model.js";

export const DT = 0.01, H = 0.02, CAP = 5;   // this page's evidence grid, as chapter 9's
export const LONG = 30;                       // the longest forced choice the page solves
// the cost slider's stops (printed as they are computed); the hero's three costs
export const COST_STOPS = [0.01, 0.012, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1];
export const HERO_COSTS = [0.02, 0.1, 0.5];
export const BINS = [25, 50, 100, 200, 400, 800];
export const EPS = [0.001, 0.01];             // the two gaps the horizon plate measures the reach at

/** The evidence grid's program at a constant cost with the choice forced at `long`: the bound against the time left
 * before the forced choice (bTg[j] at j steps to go). At a constant cost, the backward step is the same at every time,
 * so the bound depends only on the steps left, and one solve gives the bound for every forced choice up to `long`. */
export function horizonRun(c, long = LONG, dt = DT, h = H, cap = CAP) {
  const { bounds } = exactPolicy(() => c, long, dt, h, cap);
  const n = bounds.length - 1;
  const bTg = new Float64Array(n + 1);
  for (let j = 0; j <= n; j++) bTg[j] = bounds[n - j];
  return { bTg, dt, long };
}

/** The bound at time t with the choice forced at T (T <= long, both on the grid), from a horizon run. */
export function boundAt(run, T, t) {
  const j = Math.round((T - t) / run.dt);
  return j < 0 ? NaN : run.bTg[Math.min(j, run.bTg.length - 1)];
}

/** How far back the forced choice reaches: the largest time left at which the bound is more than eps away from its
 * value with the most time left (`long`); with more time left than that, it is within eps. 0 if it never is. */
export function reach(run, eps) {
  const b = run.bTg, last = b[b.length - 1];
  for (let j = b.length - 1; j >= 0; j--) if (!(Math.abs(b[j] - last) <= eps)) return j * run.dt;
  return 0;
}

// ---- the belief grid (known.py) -----------------------------------------------------------------------------------

/** n beliefs at the midpoints of n equal bins on (0, 1). */
export const beliefGrid = (n) => Float64Array.from({ length: n }, (_, i) => (i + 0.5) / n);
export const evidenceOf = (g) => 0.5 * Math.log(g / (1 - g));

/** The transition matrix of known.transition_matrix as rows: P[i][j] for the j in [lo[i], lo[i] + row.length). Entries
 * whose Gaussian factor is below e^-60 are left out (each is less than 1e-20 of its row's total). */
export function transitionRows(g, dt) {
  const n = g.length, x = Float64Array.from(g, evidenceOf), jac = Float64Array.from(g, (gi) => 1 / (gi * (1 - gi)));
  const W = Math.sqrt(120 * dt), lo = new Int32Array(n), rows = [];
  for (let i = 0; i < n; i++) {
    let a = i, b = i;
    while (a > 0 && x[i] - x[a - 1] < W) a--;
    while (b < n - 1 && x[b + 1] - x[i] < W) b++;
    const row = new Float64Array(b - a + 1);
    let sum = 0;
    for (let j = a; j <= b; j++) {
      const d = x[j] - x[i];
      const p = (g[i] * Math.exp(d) + (1 - g[i]) * Math.exp(-d)) * Math.exp(-(d * d) / (2 * dt)) * jac[j];
      row[j - a] = p; sum += p;
    }
    for (let k = 0; k < row.length; k++) row[k] /= sum;
    lo[i] = a; rows.push(row);
  }
  return { lo, rows };
}

/** known.bound_from_values: the first belief above 1/2 where deciding beats waiting, read linearly between bins; 1 if
 * waiting is better at every bin, and 1/2 if deciding is better at the first bin above 1/2. */
export function boundFromValues(g, decide, wait) {
  const up = [];
  for (let i = 0; i < g.length; i++) if (g[i] > 0.5) up.push(i);
  const k = up.findIndex((i) => decide[i] - wait[i] > 0);
  if (k < 0) return 1;
  if (k === 0) return 0.5;
  const i = up[k], p = up[k - 1], di = decide[i] - wait[i], dp = decide[p] - wait[p];
  return g[p] - (dp * (g[i] - g[p])) / (di - dp);
}

/** known.backward_induction at a constant cost c: from the forced choice, `long` time units of steps back, with the
 * same transition matrix as value iteration. Returns the belief bound at the start (t = 0, `long` time units left),
 * its evidence, and the bins' evidence. Each step calls progress(k / steps) every 500 steps if given. */
export function beliefBackward(c, n, long = LONG, dt = DT, progress = null) {
  const steps = Math.round(long / dt), g = beliefGrid(n), { lo, rows } = transitionRows(g, dt);
  const decide = Float64Array.from(g, (gi) => Math.max(gi, 1 - gi));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n), next = new Float64Array(n);
  for (let k = 0; k < steps; k++) {
    for (let i = 0; i < n; i++) {
      const row = rows[i], a = lo[i];
      let acc = 0;
      for (let q = 0; q < row.length; q++) acc += row[q] * v[a + q];
      wait[i] = acc - c * dt;
      next[i] = Math.max(decide[i], wait[i]);
    }
    v.set(next);
    if (progress && k % 500 === 499) progress((k + 1) / steps);
  }
  const gb = boundFromValues(g, decide, wait);
  return { gb, xb: gb >= 1 ? Infinity : evidenceOf(gb), x: Float64Array.from(g, evidenceOf) };
}

/** The state both plates draw from: the answer on show and the cost it was solved at. Asking for a new cost drops
 * the answer on show; an answer is taken only if no newer cost was asked for since. */
export function solveState() {
  let gen = 0, shown = null;
  return {
    ask() { gen++; shown = null; return gen; },
    take(g, c, result) { if (g !== gen) return false; shown = { c, ...result }; return true; },
    get: () => shown,
    live: (g) => g === gen,
  };
}

/** The distance in evidence between the two bins on either side of an evidence bound xb (NaN if it has no bins
 * on both sides). */
export function binGap(x, xb) {
  if (!Number.isFinite(xb)) return NaN;
  for (let i = 1; i < x.length; i++) if (x[i - 1] <= xb && xb <= x[i]) return x[i] - x[i - 1];
  return NaN;
}

export { boundForCost };
