// Chapter 5's numerics, with no DOM: the dynamic program of model.js on the same evidence grid, followed by one
// backward sweep for the expected cost at the moment of decision, u(t, y) = E_y[c(t + tau*)], under the policy the
// program found. From them: the left side of the exact equation at each time, the value V(t, y) at chosen evidence
// levels and times, and the law of the decision time of a rule frozen at one start (for the envelope identity).
//
// The grid is model.js's: evidence spacing h, a step every dt, each step a Gaussian move with mean +dt or -dt mixed
// by the belief g(x), and the choice forced at the horizon. Two savings that change no number: the value and u are
// even in x, so only x >= 0 is stored (a move to -x reads +x); and past B(c_min) + 1, every start decides at once
// (Lemma 1(c) caps the bound at B(c_min)), so the value there is the value of deciding and u is the cost now.
// tools/checks/ch05.mjs compares the bounds with model.js's exactPolicy and the left side with the paper's own test,
// tests/test_exact_equation.py, on its grid, cases, and tolerances.

import { boundForCost } from "./model.js?v=3012045bec";

export const OVERSHOOT = 0.5826; // -zeta(1/2) / sqrt(2 pi): the continuous bound sits this many sqrt(dt) outside the grid's

/** The paper's own test schedule (tests/test_exact_equation.py, "smooth step"): 0.1, rising to 0.4 in a logistic
 * step of scale 0.05 centered at time 1.5. */
export const testStep = (t) => 0.1 + 0.3 / (1 + Math.exp(-(t - 1.5) / 0.05));

/** The grid and evidence levels of the plates drawn on that schedule (the worker's "fixed" job). */
export const FIXED = { dt: 0.005, h: 0.01, horizon: 8, ys: [0, 0.25, 0.5] };

export const belief = (x) => 1 / (1 + Math.exp(-2 * x));
export const gPrime = (y) => 1 / (2 * Math.cosh(y) ** 2);

/** The constant-cost bound, polished by Newton steps on sinh(2b) + 2b = 1/c. */
export function B(c) {
  if (!(c > 0)) return Infinity;
  if (!Number.isFinite(c)) return 0;
  let b = boundForCost(c);
  for (let i = 0; i < 4; i++) b -= (Math.sinh(2 * b) + 2 * b - 1 / c) / (2 * Math.cosh(2 * b) + 2);
  return b;
}

/** int_0^b cosh^2 y dy = b/2 + sinh(2b)/4: the exact equation's left side, per unit of a constant cost. */
export const F = (b) => 0.5 * b + 0.25 * Math.sinh(2 * b);

/** The schedule's lowest and highest cost over [0, upto], sampled every 0.001 (and at upto). */
export function costRange(cost, upto) {
  let lo = Infinity, hi = -Infinity;
  const n = Math.max(1, Math.round(upto / 0.001));
  for (let i = 0; i <= n; i++) { const c = cost((i * upto) / n); if (c < lo) lo = c; if (c > hi) hi = c; }
  return { lo, hi };
}

/** The grid on x >= 0: spacing h, out to the largest x where waiting is worked out, and the two step kernels
 * (model.js's, normalized over 6 standard deviations of the step). */
export function halfGrid(dt, h, reach) {
  const M = Math.ceil(reach / h);
  const r = Math.ceil((6 * Math.sqrt(dt)) / h);
  const kernel = (mu) => {
    const k = new Float64Array(2 * r + 1);
    let sum = 0;
    for (let j = -r; j <= r; j++) { const v = Math.exp(-((j * h - mu * dt) ** 2) / (2 * dt)); k[j + r] = v; sum += v; }
    for (let j = 0; j < k.length; j++) k[j] /= sum;
    return k;
  };
  return { M, r, h, x: Float64Array.from({ length: M + r + 1 }, (_, i) => i * h), kUp: kernel(1), kDown: kernel(-1) };
}

/** E[f(x')] at every grid point 0..M for one step from x, with f even (stored on 0..M+r) and the belief-weighted
 * mix of the two kernels. */
function stepMean(f, out, G, g) {
  const { M, r, kUp, kDown } = G;
  for (let i = 0; i <= M; i++) {
    let up = 0, down = 0;
    if (i >= r) {
      const base = i - r;
      for (let j = 0; j <= 2 * r; j++) { const v = f[base + j]; up += kUp[j] * v; down += kDown[j] * v; }
    } else {
      for (let j = -r; j <= r; j++) { const v = f[Math.abs(i + j)]; up += kUp[j + r] * v; down += kDown[j + r] * v; }
    }
    out[i] = g[i] * up + (1 - g[i]) * down;
  }
}

/** The left side of the exact equation from u on the grid (x = i h, i >= 0), up to bc: the trapezoid rule over the
 * grid points below bc and the point bc itself, with u read there by linear interpolation (as the paper's test). */
export function leftSide(u, h, bc) {
  const n = Math.floor(bc / h - 1e-12);   // the last grid point below bc
  let s = 0;
  let px = 0, py = u[0];                  // cosh^2(0) = 1
  for (let i = 1; i <= n; i++) {
    const x = i * h, y = Math.cosh(x) ** 2 * u[i];
    s += 0.5 * (py + y) * (x - px); px = x; py = y;
  }
  const f = bc / h - n, ub = u[n] * (1 - f) + u[n + 1] * f;
  s += 0.5 * (py + Math.cosh(bc) ** 2 * ub) * (bc - px);
  return s;
}

/**
 * The dynamic program and the sweep for u, for a cost schedule on [0, horizon].
 *   dt, h       the grid (the paper's test uses 0.002 and 0.005)
 *   cMin        the schedule's lowest cost, which sets how far out waiting is worked out (B(cMin) + 1)
 *   every       keep every this-many time steps in the outputs
 *   lhsUpto     work out the left side at kept times up to this time
 *   ys          evidence levels (rounded to the grid) whose value V(t, y) is kept at every kept time
 *   snaps       times at which V(t, .) and u(t, .) are kept whole, for x from 0 to snapTo
 *   onProgress  called with the share done
 * Returns { ts, bounds, lhs, pm, cost, Vy, snaps, dt, h, horizon }, where bounds are the grid's (add
 * OVERSHOOT sqrt(dt) for the continuous model's), lhs the left side at the shifted bound, and pm the per-moment
 * version c(t) F(b), the cost now in place of the cost at decision.
 */
export function solveSchedule(cost, horizon, { dt = 0.002, h = 0.005, cMin = null, every = 1, lhsUpto = Infinity,
  ys = [], snaps = [], snapTo = 3, onProgress = null } = {}) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const c = Float64Array.from(ts, (t) => Math.min(cost(t), 1e9));
  const lo = cMin ?? costRange(cost, horizon).lo;
  const G = halfGrid(dt, h, Math.min(B(lo), 12) + 1);
  const { M, r, x } = G;
  const L = M + r + 1;
  const g = Float64Array.from(x, belief);
  const decide = Float64Array.from(g, (gi) => Math.max(gi, 1 - gi));
  const v = Float64Array.from(decide), wait = new Float64Array(L);
  const bounds = new Float64Array(steps + 1);
  const yIdx = ys.map((y) => Math.min(M, Math.round(y / h)));
  const Vy = yIdx.map(() => new Float64Array(steps + 1));
  const snapN = Math.min(M, Math.ceil(snapTo / h));
  const snapOut = snaps.map((t) => { const k = Math.round(t / dt); return { t: k * dt, k, V: null, u: null }; });
  const snapAt = new Map();
  snapOut.forEach((s) => { if (!snapAt.has(s.k)) snapAt.set(s.k, []); snapAt.get(s.k).push(s); });
  const total = 2 * steps;
  yIdx.forEach((i, q) => { Vy[q][steps] = decide[i]; });
  // ---- the value, backward from the forced choice
  bounds[steps] = 0;
  for (let k = steps - 1; k >= 0; k--) {
    stepMean(v, wait, G, g);
    const ck = c[k] * dt;
    let b = Infinity;
    for (let i = 0; i <= M; i++) wait[i] -= ck;
    for (let i = 1; i <= M; i++) {
      const d = decide[i] - wait[i];
      if (d > 0) {
        if (i === 1) { b = 0; break; }
        const dp = decide[i - 1] - wait[i - 1];
        b = x[i - 1] - (dp * h) / (d - dp);
        break;
      }
    }
    bounds[k] = b;
    for (let i = 0; i <= M; i++) v[i] = Math.max(decide[i], wait[i]);
    for (let q = 0; q < yIdx.length; q++) Vy[q][k] = v[yIdx[q]];
    if (snapAt.has(k)) for (const sn of snapAt.get(k)) sn.V = Array.from(v.subarray(0, snapN + 1));
    if (onProgress && k % 200 === 0) onProgress((steps - k) / total);
  }
  // ---- u(t, x) = E_x[c(t + tau*)] under that policy, backward from the forced choice
  const shift = OVERSHOOT * Math.sqrt(dt);
  let u = new Float64Array(L).fill(c[steps]), nu = new Float64Array(L);
  const keep = [];
  for (let k = 0; k <= steps; k += every) keep.push(k);
  const keepSet = new Set(keep);
  const lhs = new Map();
  for (let k = steps - 1; k >= 0; k--) {
    stepMean(u, nu, G, g);
    const bk = bounds[k];
    for (let i = 0; i <= M; i++) if (x[i] >= bk) nu[i] = c[k];
    for (let i = M + 1; i < L; i++) nu[i] = c[k];
    [u, nu] = [nu, u];
    if (keepSet.has(k) && ts[k] <= lhsUpto + 1e-9 && Number.isFinite(bk)) lhs.set(k, leftSide(u, h, bk + shift));
    if (snapAt.has(k)) for (const sn of snapAt.get(k)) sn.u = Array.from(u.subarray(0, snapN + 1));
    if (onProgress && k % 200 === 0) onProgress((2 * steps - k) / total);
  }
  const kept = keep;
  const out = {
    dt, h, horizon, shift,
    ts: kept.map((k) => ts[k]),
    bounds: kept.map((k) => bounds[k]),
    cost: kept.map((k) => c[k]),
    lhs: kept.map((k) => (lhs.has(k) ? lhs.get(k) : NaN)),
    pm: kept.map((k) => (lhs.has(k) ? c[k] * F(bounds[k] + shift) : NaN)),
    Vy: Vy.map((arr) => kept.map((k) => arr[k])),
    yGrid: yIdx.map((i) => i * h),
    snaps: snapOut.map((s) => ({ ...s, b: bounds[s.k], x: Array.from(x.subarray(0, snapN + 1)) })),
  };
  return out;
}

/**
 * The rule frozen at the start (t_K, y): stop at step K + n once |X| reaches the bound the program found for time
 * t_K + n dt. Returns the law of n (f[n], with the forced choice at the horizon) and A = E[g(|X|) at the stop],
 * on the same grid and steps, by moving the probability of still deciding forward one step at a time.
 */
export function frozenRule(bounds, dt, h, y, K, cMin) {
  const steps = bounds.length - 1;
  const G = halfGrid(dt, h, Math.min(B(cMin), 12) + 1);
  const { M, r, kUp, kDown, x } = G;
  const L = M + r + 1;
  const g = Float64Array.from(x, belief);
  const iy = Math.round(y / h);
  let p = new Float64Array(L), q = new Float64Array(L);
  const f = [];
  let A = 0, alive = 1;
  if (x[iy] >= bounds[K]) return { f: [1], A: Math.max(g[iy], 1 - g[iy]), y: x[iy] };
  p[iy] = 1; f.push(0);
  let lo = iy, hi = iy;
  for (let k = K; k < steps && alive > 1e-13; k++) {
    const nhi = Math.min(L - 1, hi + r);
    q.fill(0, 0, nhi + 1);
    for (let i = lo; i <= hi; i++) {
      const pi = p[i];
      if (pi === 0) continue;
      const a = pi * g[i], bb = pi * (1 - g[i]);
      for (let j = -r; j <= r; j++) q[Math.abs(i + j)] += a * kUp[j + r] + bb * kDown[j + r];
    }
    const bk = k + 1 === steps ? -1 : bounds[k + 1];
    let stop = 0, nl = L, nh = -1;
    alive = 0;
    for (let i = 0; i <= Math.min(L - 1, nhi); i++) {
      const qi = q[i];
      if (qi === 0) continue;
      if (x[i] >= bk) { stop += qi; A += qi * Math.max(g[i], 1 - g[i]); q[i] = 0; }
      else { alive += qi; if (i < nl) nl = i; nh = i; }
    }
    f.push(stop);
    p.fill(0, 0, Math.min(L, hi + 1));
    [p, q] = [q, p];
    if (nh < 0) break;
    lo = nl; hi = nh;
  }
  return { f, A, y: x[iy] };
}
