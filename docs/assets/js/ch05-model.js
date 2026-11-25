// Chapter 5's numerics, with no DOM: the dynamic program of model.js on the same evidence grid, followed by one
// backward sweep for the expected cost at the moment of decision, u(t, y) = E_y[c(t + tau*)], under the policy the
// program found. From them: the left side of the exact equation at each time, the value V(t, y) at chosen evidence
// levels and times, and the law of the decision time of a rule frozen at one start (for the envelope identity).
//
// The grid is model.js's: evidence spacing h, a step every dt, each step a Gaussian move with mean +dt or -dt mixed
// by the belief g(x), and the choice forced at the horizon. Two savings that change no number: the value and u are
// even in x, so only x >= 0 is stored (a move to -x reads +x); and past B(c_min) + 1, every start decides at once
// (Lemma 1(c) caps the bound at B(c_min)), so the value there is the value of deciding and u is the cost now.
//
// The sweep for u stops exactly where the program's own Bellman step stops (deciding is worth at least waiting), node
// by node. The bound the program reports is read off those choices as model.js reads it: between the last node that
// waits and the first that stops. When the first node past the center stops, the bound is below the grid's first step
// h: model.js, and so this file, places it between the center and that node if the center still waits, and at 0 if the
// center stops too (the paper's backward_induction_x reports 0 in both cases). A bound below h is a value the grid can't
// resolve, so the live plate leaves those times out (isResolved below).
// tools/checks/ch05.mjs compares the bounds with model.js's exactPolicy and the left side with the paper's own test,
// tests/test_exact_equation.py, on its grid, cases, and tolerances.

import { boundForCost } from "./model.js?v=942da027e0";

export const OVERSHOOT = 0.5826; // -zeta(1/2) / sqrt(2 pi): the continuous bound sits this many sqrt(dt) outside the grid's

/** The test schedule from the paper's code (tests/test_exact_equation.py, "smooth step"): 0.1, rising toward 0.4 in a logistic
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

/** The grid on x >= 0: spacing h, out to the largest x where waiting is worked out (or M cells, if given), and the
 * two step kernels (model.js's, normalized over 6 standard deviations of the step). */
export function halfGrid(dt, h, reach, cells = null) {
  const M = cells ?? Math.ceil(reach / h);
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
  // the program's choice at every step and grid point: 1 where deciding is worth at least waiting
  const W1 = M + 1, stop = new Uint8Array((steps + 1) * W1);
  stop.fill(1, steps * W1);
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
        if (i === 1) { const dc = decide[0] - wait[0]; b = dc < 0 ? x[0] - (dc * h) / (d - dc) : 0; break; }
        const dp = decide[i - 1] - wait[i - 1];
        b = x[i - 1] - (dp * h) / (d - dp);
        break;
      }
    }
    bounds[k] = b;
    for (let i = 0; i <= M; i++) { v[i] = Math.max(decide[i], wait[i]); stop[k * W1 + i] = decide[i] >= wait[i] ? 1 : 0; }
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
    for (let i = 0; i <= M; i++) if (stop[k * W1 + i]) nu[i] = c[k];
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
    centerWaits: kept.map((k) => !stop[k * W1]),
    stop, M,
    Vy: Vy.map((arr) => kept.map((k) => arr[k])),
    yGrid: yIdx.map((i) => i * h),
    snaps: snapOut.map((s) => ({ ...s, b: bounds[s.k], x: Array.from(x.subarray(0, snapN + 1)) })),
  };
  return out;
}

/**
 * The rule frozen at the start (t_K, y): stop at step K + n wherever the program stops at step K + n (its stop mask, M
 * grid cells past 0). Returns the law of n (f[n], with the forced choice at the horizon) and A = E[g(|X|) at the stop],
 * on the same grid and steps, by moving the probability of still deciding forward one step at a time.
 */
export function frozenRule(stopMask, M, dt, h, y, K) {
  const W1 = M + 1, steps = stopMask.length / W1 - 1;
  const G = halfGrid(dt, h, 0, M);
  const { r, kUp, kDown, x } = G;
  const L = M + r + 1;
  const g = Float64Array.from(x, belief);
  const stops = (k, i) => i > M || stopMask[k * W1 + i] === 1;
  const iy = Math.round(y / h);
  let p = new Float64Array(L), q = new Float64Array(L);
  const f = [];
  let A = 0, alive = 1;
  if (stops(K, iy)) return { f: [1], A: Math.max(g[iy], 1 - g[iy]), y: x[iy] };
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
    let stop = 0, nl = L, nh = -1;
    alive = 0;
    for (let i = 0; i <= nhi; i++) {
      const qi = q[i];
      if (qi === 0) continue;
      if (stops(k + 1, i)) { stop += qi; A += qi * Math.max(g[i], 1 - g[i]); q[i] = 0; }
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

// ---- small pieces the plates draw with, here so the checks run the same code -------------------------------------

/** The integral from xs[0] to z of the straight-line interpolant through (xs[i], fs[i]): the area a plate shades. */
export function areaTo(xs, fs, z) {
  let s = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] <= z) { s += 0.5 * (fs[i] + fs[i - 1]) * (xs[i] - xs[i - 1]); continue; }
    if (xs[i - 1] < z) { const fz = fs[i - 1] + ((fs[i] - fs[i - 1]) * (z - xs[i - 1])) / (xs[i] - xs[i - 1]); s += 0.5 * (fz + fs[i - 1]) * (z - xs[i - 1]); }
    break;
  }
  return s;
}

/** The value of waiting W = V - g at level y on a snapshot's grid, interpolated between the two nodes that enclose y. */
export function wAt(V, h, y) {
  const j = Math.floor(y / h + 1e-12), w = y / h - j;
  const W = (i) => V[i] - belief(i * h);
  return W(j) * (1 - w) + W(j + 1) * w;
}

/** Chords from the grid's bound b to the grid points nearest b - e for each e: the actual distance, the point, W there,
 * and the size of the chord's slope W/(distance). */
export function chords(V, h, b, list) {
  return list.map((e) => { const j = Math.round((b - e) / h), y = j * h, w = V[j] - belief(y); return { e: b - y, y, w, r: w / (b - y) }; });
}

/** Crossing times with paths still below the bound at the end left out (censored): the time by which half of all n
 * paths have crossed, the smallest s with at least n/2 crossings by s; NaN if fewer than half crossed. */
export function halfCrossed(times, n) {
  const done = times.filter(Number.isFinite).sort((a, b) => a - b), need = Math.ceil(n / 2);
  return done.length >= need ? done[need - 1] : NaN;
}

/** Bounds on a book schedule's cost over all t >= 0, from its formula (not from samples): every preset other than
 * the deadline and the rising cost lies between its lowest and highest level, the logistic joins being convex
 * combinations in log c; Smooth's three sines add to at most 1.1 in size; a drawing is held flat past its last point.
 * Returns null for a schedule with no such pair. */
export function costBounds(choice, params) {
  const p = params;
  switch (choice.id) {
    case "jump": return { lo: 0.1, hi: 0.1 * p.factor };
    case "fall": return { lo: 0.4 / p.factor, hi: 0.4 };
    case "pulse": return { lo: 0.1, hi: 0.1 * p.factor };
    case "wave": return { lo: 0.1 * (1 - p.size), hi: 0.1 * (1 + p.size) };
    case "constant": return { lo: p.c, hi: p.c };
    case "smooth": return { lo: p.c0 * Math.exp(-1.1 * p.size), hi: p.c0 * Math.exp(1.1 * p.size) };
    case "multistep": { const l = [1, 3, 1.2, 4.8].map((m) => m * p.c0); return { lo: Math.min(...l), hi: Math.max(...l) }; }
    case "piecewise": { const l = [0.05, 0.3, 0.08, 0.6, 0.15, 0.03, 0.2].map((m) => m * p.scale); return { lo: Math.min(...l), hi: Math.max(...l) }; }
    case "draw": { const pts = (choice.points || []).map((c) => Math.min(Math.max(c, 0.01), 2)); return pts.length ? { lo: Math.min(...pts), hi: Math.max(...pts) } : null; }
    default: return null;
  }
}

/** What the band plate prints, from the program's kept times and bounds over [0, view]: the largest |db|/sqrt|dt|
 * over all pairs, the largest move of the bound over any `span`, and the cost's largest change by a factor over any
 * `span` (sampled every 0.005). */
export function bandStats(ts, bounds, cost, view, span = 0.05) {
  const idx = [];
  ts.forEach((t, i) => { if (t <= view + 1e-9) idx.push(i); });
  let ratio = 0;
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
    const r = Math.abs(bounds[idx[b]] - bounds[idx[a]]) / Math.sqrt(ts[idx[b]] - ts[idx[a]]);
    if (r > ratio) ratio = r;
  }
  const w = Math.round(span / (ts[1] - ts[0]));
  let fall = 0, fallAt = 0;
  for (let a = 0; a + w < idx.length; a++) { const d = Math.abs(bounds[idx[a + w]] - bounds[idx[a]]); if (d > fall) { fall = d; fallAt = ts[idx[a]]; } }
  let cfac = 1, cAt = 0;
  for (let t = 0; t <= view - span + 1e-9; t += 0.005) { const f = Math.max(cost(t + span) / cost(t), cost(t) / cost(t + span)); if (f > cfac) { cfac = f; cAt = t; } }
  return { ratio, fall, fallAt, cfac, cAt };
}

/** Whether the bound at kept time i is at least the grid's first step h, where the grid can place it. */
export const isResolved = (out, i) => out.bounds[i] >= out.h;

/** The largest |left side - 1/4| over the kept times in [from, to], or over the times listed in `on`; with
 * resolvedOnly, times whose bound is below the grid's first step are left out and counted in `skipped`. n counts
 * the pairs compared, and missing the asked-for times with no finite left side, so a caller can tell that nothing was
 * silently dropped. */
export function worstResidual(out, from, to, on = null, resolvedOnly = false) {
  const at0 = new Map();
  out.ts.forEach((t, i) => at0.set(Math.round(t * 1e6), i));
  const times = on ?? out.ts.filter((t) => t >= from - 1e-9 && t <= to + 1e-9);
  let w = 0, at = NaN, n = 0, missing = 0, skipped = 0;
  for (const t of times) {
    if (t < from - 1e-9 || t > to + 1e-9) continue;
    const i = at0.get(Math.round(t * 1e6));
    if (i === undefined || !Number.isFinite(out.lhs[i])) { missing++; continue; }
    if (resolvedOnly && !isResolved(out, i)) { skipped++; continue; }
    n++;
    const e = Math.abs(out.lhs[i] - 0.25);
    if (n === 1 || e > w) { w = e; at = t; }
  }
  return { w, at, n, missing, skipped };
}

/** What the live plate reports for the grid on show (m), with the two grids' runs (either may be null), using one
 * mask throughout, isResolved, the same one the plate's charts use for their gaps: the window shown (0 to `view`, or to
 * the forced choice when `far`) and how many of its times are unresolved; the largest residual over the resolved times
 * from 0 to `view`; the two grids' largest residuals over the times both resolve; the per-moment version's largest miss
 * over resolved times; the largest miss over the resolved times in the last time unit before the forced choice (NaN if
 * there are none) and how many there it left out; and the cost's range over its run, as a ratio. */
export function liveSummary(m, fine, coarse, far, view) {
  const X = far ? m.horizon : view;
  let unresolved = 0, nWin = 0;
  m.ts.forEach((t, k) => { if (far ? t < X - 1e-9 : t <= X + 1e-9) { nWin++; if (!isResolved(m, k)) unresolved++; } });
  const w = worstResidual(m, 0, view, null, true);
  let wf = NaN, wc = NaN, nBoth = 0;
  const nView = m.ts.filter((t) => t <= view + 1e-9).length;
  if (fine && coarse) {
    const key = (t) => Math.round(t * 1e6), fi = new Map();
    fine.ts.forEach((t, i) => fi.set(key(t), i));
    const on = coarse.ts.filter((t, i) => t <= view + 1e-9 && isResolved(coarse, i) && fi.has(key(t)) && isResolved(fine, fi.get(key(t))));
    nBoth = on.length;
    if (nBoth) { wf = worstResidual(fine, 0, view, on).w; wc = worstResidual(coarse, 0, view, on).w; }
  }
  let pm = 0;
  m.ts.forEach((t, k) => { if (t <= view + 1e-9 && Number.isFinite(m.pm[k]) && isResolved(m, k)) pm = Math.max(pm, Math.abs(m.pm[k] - 0.25)); });
  const tw = worstResidual(m, m.horizon - 1, m.horizon - 1e-6, null, true);
  return { X, unresolved, nWin, nView, w: w.n ? w.w : NaN, at: w.at, nRes: w.n, skipped: w.skipped, wf, wc, nBoth, pm,
    tail: tw.n ? tw.w : NaN, tailSkipped: tw.skipped, fold: m.cMax / m.cMin, h: m.h };
}

/** The live plate's reading at the time on show, from that time's snapshot: unresolved where the bound is below the
 * grid's first step (the same mask as the charts), otherwise the left side and the bound moved out by the shift. */
export function areaReading(m, snap) {
  const i = m.ts.findIndex((t) => Math.abs(t - snap.t) < 1e-9);
  const resolved = i >= 0 && isResolved(m, i) && snap.b >= m.h;
  return { resolved, i, area: resolved ? m.lhs[i] : NaN, bc: resolved ? snap.b + m.shift : NaN };
}
