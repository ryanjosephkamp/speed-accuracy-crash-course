// Chapter 9's model, with no DOM. The paper's two methods as this page runs them: model.js's dynamic program and its
// forward scorer (ports of the paper's known.backward_induction_x and evaluate.known_reward), here keeping what each
// step computes so the plates can draw it; trials of the same gridded problem, simulated; the overshoot of a bound
// checked every dt; the paper's two tests of the first-order theory (the sinusoid of Section 6.2 and the wider
// sweep of Table 2), run on this page's grid; and the rules scored with and without the monitoring shift and on
// finer grids. tools/checks/ch09.mjs holds these to model.js, to the paper's tables, and to each other.
import { grid, belief, boundForCost, toDiscrete, OVERSHOOT, exactPolicy, score, perMoment, weightedBound } from "./model.js?v=0648557a87";
import * as K from "./kernel.js?v=0648557a87";

export { OVERSHOOT };
export const DT = 0.01, H = 0.02, CAP = 5;   // this page's grid, as every chapter's program uses it
export const WINDOW = 2.5, SPARE = 6;        // the window the schedules are drawn over, and how far past it the program runs

// ---- the paper's numbers and tables that the plates print or redraw, checked against paper/generated/ ----------------

/** Numbers from paper/generated/numbers.tex that a plate's sentence prints, as the paper prints them. */
export const PAPER = { HorizonFloor: "0.0018", ClosedFormWorstGain: "0.1", SweepSwingThird: 2.2, SweepSwingSixTenths: 9.8 };

/** Table 1 (tab_sinusoid): omega, the closed form's swing and lead, the dynamic program's, and the weighted rule's. */
export const TABLE1 = [
  [0.5, 0.936, 14.5, 0.937, 14.5, 0.936, 14.5],
  [1, 0.813, 24.1, 0.814, 24.0, 0.813, 24.1],
  [2, 0.625, 31.4, 0.626, 31.3, 0.625, 31.4],
  [4, 0.471, 34.2, 0.472, 34.0, 0.471, 34.2],
  [8, 0.358, 36.7, 0.358, 36.4, 0.358, 36.7],
];

/** Table 2 (tab_sweep): eps / c0, then for c0 = 0.03, 0.1, and 0.3 the fitted swing over the predicted swing as the
 * range [low, high] over omega = 1 and 4 (one number when both print alike), and the largest phase error in degrees. */
export const TABLE2_COSTS = [0.03, 0.1, 0.3];
export const TABLE2 = [
  [0.05, [0.999, 1.000], [1.000, 1.001], [1.000, 1.001], 0.15],
  [0.1, [1.001, 1.002], [1.002, 1.002], [1.002, 1.002], 0.15],
  [0.3, [1.020, 1.020], [1.018, 1.020], [1.015, 1.022], 0.36],
  [0.6, [1.094, 1.097], [1.084, 1.092], [1.070, 1.098], 1.37],
];
/** The paper's sweep: its costs, frequencies, sizes, horizon, and fit window. */
export const SWEEP = { costs: [0.03, 0.1, 0.3], omegas: [1, 4], rels: [0.05, 0.1, 0.3, 0.6], horizon: 14, from: 2, to: 2 + 2 * Math.PI };

/** Table 12 (tab_grid): each schedule's per-moment losses on grids 1 to 4, its weighted losses on grids 1 to 4, and
 * the residual, in points per 100 trials. Grid 2 is the paper's. */
export const TABLE12 = [
  ["Smooth 1", [0.223, 0.226, 0.228, 0.229], [0.0607, 0.0627, 0.0637, 0.0642], 0.000],
  ["Smooth 4", [0.125, 0.125, 0.125, 0.125], [0.0000, 0.0000, 0.0000, 0.0000], 0.000],
  ["Smooth 9", [1.445, 1.452, 1.455, 1.457], [0.0112, 0.0107, 0.0104, 0.0103], 0.002],
  ["Step 1", [1.138, 1.139, 1.140, 1.140], [0.0087, 0.0086, 0.0085, 0.0085], 0.000],
  ["Step 10", [0.776, 0.780, 0.782, 0.783], [0.0007, 0.0007, 0.0007, 0.0007], 0.000],
  ["Step 17", [2.409, 2.413, 2.414, 2.416], [0.0831, 0.0826, 0.0823, 0.0822], 0.000],
  ["Deadline 5", [0.358, 0.359, 0.360, 0.360], [0.0047, 0.0041, 0.0041, 0.0043], 0.027],
  ["Deadline 12", [0.253, 0.257, 0.258, 0.258], [0.0118, 0.0097, 0.0112, 0.0113], 0.022],
];
/** Table 12's four grids, (dt, h), from its caption; the paper's is the second. */
export const PAPER_GRIDS = [[0.004, 0.007], [0.002, 0.005], [0.001, 0.0035], [0.0005, 0.0025]];

/** This page's grids for refining a schedule's losses: each halves the time step and divides the evidence step by
 * about the square root of 2, as Table 12's grids do. Every time step divides 0.05, so a deadline on the schedules'
 * 0.05 steps falls on a grid time. */
export const PAGE_GRIDS = [[0.01, 0.02], [0.005, 0.014], [0.0025, 0.01]];

// ---- backward induction, step by step ---------------------------------------------------------------------------

/** model.js's exactPolicy, step for step (the same sums in the same order, so the same bounds), keeping at every
 * `every`-th time what waiting adds over deciding now, V_wait - max(g, 1 - g), at the nodes x = 0, h, ..., up to
 * xmax; the slice at the horizon, where the choice is forced, is kept as zeros. Also the value at x = 0, t = 0. */
export function backward(cost, horizon, { dt = DT, h = H, cap = CAP, every = 2, xmax = 3.2 } = {}) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap);
  const g = Float64Array.from(x, (xi) => belief(xi));
  const decide = Float64Array.from(g, (gi) => Math.max(gi, 1 - gi));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n);
  const bounds = new Float64Array(steps + 1);
  bounds[steps] = 0;
  const M = Math.min(n - 1 - m, Math.round(xmax / h));
  const keepK = [];
  for (let k = steps; k >= 0; k -= every) keepK.push(k);
  if (keepK[keepK.length - 1] !== 0) keepK.push(0);
  const row = new Map(keepK.map((k, j) => [k, j]));
  const adv = new Float32Array(keepK.length * (M + 1));   // the horizon's row stays 0: no waiting there
  for (let k = steps - 1; k >= 0; k--) {
    const ck = Math.min(cost(ts[k]), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      let up = 0, down = 0;
      for (let j = -r; j <= r; j++) {
        const idx = i + j;
        const vj = idx < 0 || idx >= n ? decide[idx < 0 ? 0 : n - 1] : v[idx];
        up += kUp[j + r] * vj;
        down += kDown[j + r] * vj;
      }
      wait[i] = g[i] * up + (1 - g[i]) * down - ck;
    }
    let b = Infinity;
    for (let i = m + 1; i < n; i++) {
      const d = decide[i] - wait[i];
      if (d > 0) {
        if (i === m + 1) { const dc = decide[m] - wait[m]; b = dc < 0 ? x[m] - (dc * (x[i] - x[m])) / (d - dc) : 0; break; }   // as model.js
        const dp = decide[i - 1] - wait[i - 1];
        b = x[i - 1] - (dp * (x[i] - x[i - 1])) / (d - dp);
        break;
      }
    }
    bounds[k] = b > cap ? Infinity : b;
    const j = row.get(k);
    if (j !== undefined) for (let i = 0; i <= M; i++) adv[j * (M + 1) + i] = wait[m + i] - decide[m + i];
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
  }
  return { ts, bounds, dt, h, keepK, M, adv, v0: v[m] };
}

// ---- scoring: the density pushed forward ----------------------------------------------------------------------------

/** model.js's score, step for step (the same sums in the same order), keeping the mass decided at the upper bound
 * (correct, under the drift +1) and at the lower bound at every step, the mass still undecided after each step, and
 * the density (per unit of evidence) on the nodes with |x| <= xmax at every `every`-th step up to step `upto`.
 * Trials still undecided at the last time choose by the sign of the evidence, as in the paper's scorer; that mass
 * is in endUp and endLo. */
export function forward(xb, ts, cost, { h = H, cap = CAP, every = 2, xmax = 3, upto = Infinity } = {}) {
  const dt = ts[1] - ts[0], N = ts.length;
  const { x, m, n, r, kUp } = grid(dt, h, cap);
  const M = Math.min(m, Math.round(xmax / h));
  const upAt = new Float64Array(N), loAt = new Float64Array(N), aliveAt = new Float64Array(N);
  const snapK = [];
  for (let k = 0; k < N && k <= upto; k += every) snapK.push(k);
  const snaps = new Float32Array(snapK.length * (2 * M + 1));
  const keep = (k, p) => { if (k % every || k > upto) return; const j = k / every; for (let i = -M; i <= M; i++) snaps[j * (2 * M + 1) + i + M] = p[m + i] / h; };
  if (!(Math.min(xb[0], cap) > 0)) return { p: 0.5, rt: 0, paid: 0, reward: 0.5, upAt, loAt, aliveAt, endUp: 0.5, endLo: 0.5, snapK, snaps, M, h, atOnce: true };
  let p = new Float64Array(n), q = new Float64Array(n);
  p[m] = 1;
  aliveAt[0] = 1;
  keep(0, p);
  let correct = 0, rt = 0, paid = 0, alive = 1;
  let lo = m, hi = m;
  let k = 1;
  for (; k < N; k++) {
    paid += alive * Math.min(cost(ts[k - 1]), 1e9) * dt;
    const b = Math.min(xb[k], cap);
    const nlo = Math.max(lo - r, 0), nhi = Math.min(hi + r, n - 1);
    q.fill(0, nlo, nhi + 1);
    for (let i = lo; i <= hi; i++) {
      const pi = p[i];
      if (pi === 0) continue;
      for (let j = -r; j <= r; j++) q[i + j] += pi * kUp[j + r];
    }
    let mUp = 0, mLo = 0, total = 0, newLo = n, newHi = -1;
    for (let i = nlo; i <= nhi; i++) {
      const qi = q[i];
      if (qi <= 0) { q[i] = 0; continue; }
      const up = Math.min(Math.max((x[i] + h / 2 - b) / h, 0), 1);
      const dn = Math.min(Math.max((-b - (x[i] - h / 2)) / h, 0), 1);
      mUp += qi * up; mLo += qi * dn;
      const kp = qi * (1 - up - dn);
      q[i] = kp;
      if (kp > 1e-300) { total += kp; if (i < newLo) newLo = i; newHi = i; }
    }
    p.fill(0, lo, hi + 1);
    [p, q] = [q, p];
    correct += mUp;
    rt += (mUp + mLo) * ts[k];
    upAt[k] = mUp; loAt[k] = mLo; aliveAt[k] = total;
    alive = total;
    keep(k, p);
    if (newHi < 0) { lo = m; hi = m; alive = 0; break; }
    lo = newLo; hi = newHi;
  }
  let endUp = 0, endLo = 0;
  if (alive > 0) {
    for (let i = lo; i <= hi; i++) { const s = x[i] > 0 ? p[i] : x[i] === 0 ? 0.5 * p[i] : 0; correct += s; endUp += s; endLo += p[i] - s; }
    rt += alive * ts[ts.length - 1];
  }
  return { p: correct, rt, paid, reward: correct - paid, upAt, loAt, aliveAt, endUp, endLo, snapK, snaps, M, h, atOnce: false };
}

// ---- trials of the same gridded problem, simulated ------------------------------------------------------------------

/** n trials with the drift +1, the evidence continuous and the bound min(xb[k], cap) checked at each time ts[k], the
 * cost paid for each step taken, and a choice by the sign of the evidence for a trial still undecided at the end:
 * the problem the scorer computes, sampled. Adds to the running sums in acc ({ n, sum, sq }). */
export function trials(xb, ts, cost, n, R, acc = { n: 0, sum: 0, sq: 0 }, cap = CAP) {
  const dt = ts[1] - ts[0], sd = Math.sqrt(dt), N = ts.length;
  const cs = acc.cs || (acc.cs = Float64Array.from(ts, (t) => Math.min(cost(t), 1e9) * dt));
  const bs = acc.bs || (acc.bs = Float64Array.from(xb, (b) => Math.min(b, cap)));
  for (let i = 0; i < n; i++) {
    let v;
    if (!(bs[0] > 0)) v = R.next() < 0.5 ? 1 : 0;   // deciding at once is a coin flip
    else {
      let x = 0, paid = 0, k = 1, got = -1;
      for (; k < N; k++) {
        paid += cs[k - 1];
        x += dt + sd * R.normal();
        if (x >= bs[k]) { got = 1; break; }
        if (x <= -bs[k]) { got = 0; break; }
      }
      if (got < 0) got = x > 0 ? 1 : x === 0 ? 0.5 : 0;
      v = got - paid;
    }
    acc.n++; acc.sum += v; acc.sq += v * v;
  }
  return acc;
}

/** The mean of the trials so far, their spread per trial, and the standard error of the mean. */
export function trialStats(acc) {
  const mean = acc.sum / acc.n, sd = Math.sqrt(Math.max(0, acc.sq / acc.n - mean * mean));
  return { mean, sd, se: sd / Math.sqrt(acc.n), n: acc.n };
}

/** How many trials it takes for the standard error of the mean to come down to `target`, for trials with spread sd. */
export const trialsFor = (sd, target) => (sd / target) ** 2;

// ---- the overshoot of a bound checked every dt ----------------------------------------------------------------------

/** n runs of the evidence from 0 with the drift +1, checked every dt against a flat bound b on |X|: how far past the
 * bound each run is when it is first seen there, |X| - b. */
export function overshoots(b, dt, n, R) {
  const sd = Math.sqrt(dt), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let x = 0;
    while (Math.abs(x) < b) x += dt + sd * R.normal();
    out[i] = Math.abs(x) - b;
  }
  return out;
}

/** One run drawn finely (steps of dt / sub) until it is seen past b at a check every dt, for the picture: the fine
 * path's last stretch, the checks, and the overshoot at the stop. */
export function onePath(b, dt, R, sub = 24) {
  const fine = dt / sub, sd = Math.sqrt(fine);
  let x = 0, t = 0, k = 0;
  const path = [[0, 0]], checks = [[0, 0]];
  for (;;) {
    x += fine + sd * R.normal(); t += fine; k++;
    path.push([t, x]);
    if (k % sub === 0) { checks.push([t, x]); if (Math.abs(x) >= b) break; }
    if (t > 60) break;
  }
  // the first time the fine path itself reached the bound
  const first = path.find((p) => Math.abs(p[1]) >= b);
  return { path, checks, stop: checks[checks.length - 1], first: first || path[path.length - 1], side: Math.sign(x) || 1 };
}

// ---- the paper's sinusoid test, on a grid ---------------------------------------------------------------------------

/** The least-squares fit d ~ a sin(om t) + b cos(om t) + c over the times ts. */
export function fitSine(ts, d, om) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
  for (let k = 0; k < ts.length; k++) {
    const r = [Math.sin(om * ts[k]), Math.cos(om * ts[k]), 1];
    for (let i = 0; i < 3; i++) { y[i] += r[i] * d[k]; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; }
  }
  const Mx = A.map((rw, i) => [...rw, y[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let rr = i + 1; rr < 3; rr++) if (Math.abs(Mx[rr][i]) > Math.abs(Mx[p][i])) p = rr;
    [Mx[i], Mx[p]] = [Mx[p], Mx[i]];
    for (let rr = 0; rr < 3; rr++) { if (rr === i) continue; const f = Mx[rr][i] / Mx[i][i]; for (let c = i; c <= 3; c++) Mx[rr][c] -= f * Mx[i][c]; }
  }
  const [a, b, c] = Mx.map((rw, i) => rw[3] / rw[i]);
  return { a, b, c, amp: Math.hypot(a, b), phase: (Math.atan2(b, a) * 180) / Math.PI };
}

/** Section 6.2's window for omega: whole periods from t = 2, at least two and at least 6 time units, with the horizon
 * 6 time units after the end of the fit. */
export function sinusoidWindow(om) {
  const period = (2 * Math.PI) / om;
  const L = period * Math.max(2, Math.ceil(6 / period));
  return { from: 2, to: 2 + L, horizon: 2 + L + 6, periods: Math.round(L / period) };
}

const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** The sinusoid test at one frequency, as the paper runs it (experiments/showcase.py at the tag) but on this page's
 * evidence grid: the program at c0 and at c0 + eps sin(om t), the bound's deviation fitted over the window, and the
 * per-moment rule's deviation fitted the same way; the swing is the ratio of the two amplitudes and the lead their
 * difference of phase. Also the deviations themselves over the window, every `every`-th grid time, for the picture. */
export function sinusoidTest(om, { c0 = 0.1, eps = 0.01, dt = DT, h = H, every = 2 } = {}) {
  const win = sinusoidWindow(om);
  const base = exactPolicy(() => c0, win.horizon, dt, h);
  const pert = exactPolicy((t) => c0 + eps * Math.sin(om * t), win.horizon, dt, h);
  const T = [], D = [], P = [];
  const b0 = boundForCost(c0);
  for (let k = 0; k < base.ts.length; k++) {
    const t = base.ts[k];
    if (t > win.from && t < win.to) { T.push(t); D.push(pert.bounds[k] - base.bounds[k]); P.push(boundForCost(c0 + eps * Math.sin(om * t)) - b0); }
  }
  const fd = fitSine(T, D, om), fp = fitSine(T, P, om);
  const keep = T.map((_, i) => i).filter((i) => i % every === 0);
  return {
    om, ...win, swing: fd.amp / fp.amp, lead: wrap(fd.phase - fp.phase), fit: fd, fitPm: fp,
    t: keep.map((i) => T[i]), dev: keep.map((i) => D[i]), pm: keep.map((i) => P[i]),
  };
}

/** The first-order response eps beta(t) for c0 + eps sin(om t), from the closed-form transfer function:
 * eps B'(c0) Im(W e^{i om t}) = eps B'(c0) (Re W sin(om t) + Im W cos(om t)). */
export function firstOrderSine(om, t, c0, eps) {
  const W = K.transfer(c0, om), k = eps * K.Bprime(c0);
  return k * (W.re * Math.sin(om * t) + W.im * Math.cos(om * t));
}

/** The paper's sweep (experiments/first_order_sweep.py at the tag) for one cost and one frequency, on a grid: for
 * each eps / c0, the fitted swing over the predicted swing eps |B'(c0)| |W|, and the phase error in degrees. */
export function sweepTest(c0, om, rels, { dt = DT, h = H, progress = null } = {}) {
  const base = exactPolicy(() => c0, SWEEP.horizon, dt, h);
  const W = K.transfer(c0, om), Bp = K.Bprime(c0);
  const sel = [];
  for (let k = 0; k < base.ts.length; k++) { const t = base.ts[k]; if (t > SWEEP.from && t < SWEEP.to) sel.push(k); }
  const T = sel.map((k) => base.ts[k]);
  const out = [];
  for (const rel of rels) {
    const eps = rel * c0;
    const pert = exactPolicy((t) => c0 + eps * Math.sin(om * t), SWEEP.horizon, dt, h);
    const f = fitSine(T, sel.map((k) => pert.bounds[k] - base.bounds[k]), om);
    const thA = eps * Bp * W.re, thB = eps * Bp * W.im;
    out.push({ rel, ratio: f.amp / Math.hypot(thA, thB), phase: wrap(f.phase - (Math.atan2(thB, thA) * 180) / Math.PI) });
    if (progress) progress(out.length / rels.length);
  }
  return out;
}

// ---- the monitoring shift ---------------------------------------------------------------------------------------------

/** How far in the program's bound moves when the evidence is checked more often: the program on a grid checked every
 * dtC and on one checked every dtF (same evidence step h), and at each of the coarse grid's times before the horizon
 * k(t) = (b_F(t) - b_C(t)) / (sqrt(dtC) - sqrt(dtF)). If each bound sat 0.5826 sqrt(dt) inside one continuous bound,
 * k would be 0.5826. Times where either bound is 0 or past the cap are left out (NaN). */
export function shiftCoef(cost, horizon, { dtC = 0.01, dtF = 0.0025, h = 0.01, cap = 4, every = 2 } = {}) {
  const C = exactPolicy(cost, horizon, dtC, h, cap), F = exactPolicy(cost, horizon, dtF, h, cap);
  const ratio = Math.round(dtC / dtF), den = Math.sqrt(dtC) - Math.sqrt(dtF);
  const t = [], k = [], bC = [], bF = [];
  for (let i = 0; i < C.ts.length - 1; i += every) {
    const a = C.bounds[i], b = F.bounds[i * ratio];
    t.push(C.ts[i]); bC.push(Number.isFinite(a) ? a : NaN); bF.push(Number.isFinite(b) ? b : NaN);
    k.push(Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 ? (b - a) / den : NaN);
  }
  return { t, k, bC, bF, dtC, dtF, h };
}

/** A rule's bound turned into what is scored: moved in by the monitoring shift for checking every dt (and clipped at
 * 0), or left as it is. */
export const asScored = (b, dt, shifted) => (shifted ? toDiscrete(b, dt) : Math.max(b, 0));

/** The per-moment and weighted rules scored on the grid with and without the shift, against the program's bound
 * scored the same way, as the paper scores its reference: losses in points per 100 trials. Also the bounds every
 * `every`-th time up to `view`, for the picture. The horizon is the program's (a deadline, or the window plus 6). */
export function ruleLosses(cost, horizon, { dt = DT, h = H, cap = CAP, view = WINDOW, every = 2 } = {}) {
  const { ts, bounds } = exactPolicy(cost, horizon, dt, h, cap);
  const T = Array.from(ts);
  const ex = Array.from(bounds, (v) => (Number.isFinite(v) ? v : cap));
  const best = score(ex, T, cost, h, cap);
  const pm = Array.from(perMoment(cost, T)), wb = Array.from(weightedBound(cost, T));
  const loss = (b, on) => 100 * (best.reward - score(b.map((v) => asScored(v, dt, on)), T, cost, h, cap).reward);
  const keep = [];
  let last = 0;
  for (let k = 0; k < T.length && T[k] <= view + 1e-9; k++) { last = k; if (k % every === 0) keep.push(k); }
  if (keep[keep.length - 1] !== last) keep.push(last);
  return {
    best: best.reward,
    loss: { pm: { on: loss(pm, true), off: loss(pm, false) }, wb: { on: loss(wb, true), off: loss(wb, false) } },
    t: keep.map((k) => T[k]), exact: keep.map((k) => bounds[k]), pm: keep.map((k) => pm[k]), wb: keep.map((k) => wb[k]),
    shift: OVERSHOOT * Math.sqrt(dt), dt,
  };
}

// ---- refining the grid --------------------------------------------------------------------------------------------------

/** The per-moment and weighted rules' losses (moved in by the shift for each grid's dt, as in the paper) on each grid,
 * against the program on that grid, in points per 100 trials. */
export function refine(cost, horizon, grids = PAGE_GRIDS, { cap = CAP, progress = null } = {}) {
  const out = [];
  for (const [dt, h] of grids) {
    const r = ruleLosses(cost, horizon, { dt, h, cap });
    out.push({ dt, h, pm: r.loss.pm.on, wb: r.loss.wb.on });
    if (progress) progress(out.length / grids.length);
  }
  return out;
}

/** The forced choice's cost at a constant cost c: the constant-cost bound, moved in for checking every dt, against
 * the program with the choice forced at `horizon`, in points per 100 trials, and the share of trials still undecided
 * at the horizon under that bound. */
export function horizonFloor(c, horizon = 10, { dt = DT, h = H, cap = CAP } = {}) {
  const cost = () => c;
  const { ts, bounds } = exactPolicy(cost, horizon, dt, h, cap);
  const T = Array.from(ts);
  const best = score(Array.from(bounds, (v) => (Number.isFinite(v) ? v : cap)), T, cost, h, cap);
  const flat = T.map(() => toDiscrete(boundForCost(c), dt));
  const f = forward(flat, T, cost, { h, cap, every: T.length + 1 });
  return { loss: 100 * (best.reward - f.reward), undecided: f.endUp + f.endLo };
}
