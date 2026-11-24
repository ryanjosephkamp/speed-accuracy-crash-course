// Chapter 7's model, with no DOM: the kernel's transform as a sum of simple terms, the scans for the largest mean
// look-ahead and the largest lead, the closed forms behind the second-order loss (the flat bound's reward, the
// waiting value at a constant cost, the time spent past the bound), and the forward computation that scores a rule
// and gives its decision times, for the losses on the reader's schedule. tools/checks/ch07.mjs holds these to the
// paper's generated numbers and to model.js.
import * as K from "./kernel.js";
import { exactPolicy, score, boundForCost, toDiscrete, belief } from "./model.js";

/** The paper's Table 1 (tab_sinusoid at the tag), c0 = 0.1 and eps = 0.01: omega, then the swing and the lead in
 * degrees for the closed form, the dynamic program, and the weighted look-ahead. Checked cell by cell against
 * paper/generated/tab_sinusoid.tex. */
export const TABLE1 = [
  [0.5, 0.936, 14.5, 0.937, 14.5, 0.936, 14.5],
  [1, 0.813, 24.1, 0.814, 24.0, 0.813, 24.1],
  [2, 0.625, 31.4, 0.626, 31.3, 0.625, 31.4],
  [4, 0.471, 34.2, 0.472, 34.0, 0.471, 34.2],
  [8, 0.358, 36.7, 0.358, 36.4, 0.358, 36.7],
];

// ---- the transform as a sum of simple terms ----------------------------------------------------------------------

/** The series form of the transfer function: w~(-i omega) = sum_j a_j / (alpha_j - i omega), with
 * a_j = (2/b0) kappa_j^2 / (1 + kappa_j^2) / int n and alpha_j = (1 + kappa_j^2) / 2. Returns the first J terms as
 * complex numbers, and the rest of the sum as one more (the closed form minus the first J). */
export function seriesTerms(c0, omega, J = 5) {
  const b = K.B(c0), F = K.fluxTotal(b);
  const terms = [];
  let re = 0, im = 0;
  for (let j = 0; j < J; j++) {
    const k2 = K.kappa(j, b) ** 2;
    const a = ((2 / b) * (k2 / (1 + k2))) / F, al = (1 + k2) / 2;
    const d = al * al + omega * omega;
    const t = { re: (a * al) / d, im: (a * omega) / d, a, alpha: al };
    terms.push(t); re += t.re; im += t.im;
  }
  const W = omega === 0 ? { re: 1, im: 0 } : K.transfer(c0, omega);
  return { terms, rest: { re: W.re - re, im: W.im - im }, W: { re: W.re, im: W.im } };
}

/** The same sum, term by term to many terms, for the checks. */
export function transferSeries(c0, omega, terms = 200000) {
  const b = K.B(c0), F = K.fluxTotal(b);
  let re = 0, im = 0;
  for (let j = 0; j < terms; j++) {
    const k2 = K.kappa(j, b) ** 2;
    const a = ((2 / b) * (k2 / (1 + k2))) / F, al = (1 + k2) / 2, d = al * al + omega * omega;
    re += (a * al) / d; im += (a * omega) / d;
  }
  return { re, im };
}

/** The running integral int_0^S w(s) e^{i omega s} ds, by the kernel's bins, at each bin edge: a curve in the
 * complex plane from 0 to w~(-i omega). */
export function runningTransform(c0, omega) {
  const { edges, mid, w } = K.kernelBins(c0);
  const pts = [{ s: 0, re: 0, im: 0 }];
  let re = 0, im = 0;
  for (let i = 0; i < w.length; i++) {
    re += w[i] * Math.cos(omega * mid[i]); im += w[i] * Math.sin(omega * mid[i]);
    pts.push({ s: edges[i + 1], re, im });
  }
  return pts;
}

// ---- scans ---------------------------------------------------------------------------------------------------

/** The largest mean look-ahead over costs, scanned on a log grid from 1e-4 to 10 (as the paper's figure script
 * does, with 4000 costs): { cost, m }. */
export function maxLookAhead(n = 4000) {
  let best = { cost: NaN, m: -Infinity };
  for (let i = 0; i < n; i++) {
    const c = 10 ** (-4 + (5 * i) / (n - 1));
    const m = lookAheadClosed(c);
    if (m > best.m) best = { cost: c, m };
  }
  return best;
}

/** The mean look-ahead from the closed form (22), second form: 1/2 + 2b(b tanh b - 1)/(sinh 2b + 2b). */
export function lookAheadClosed(c0) {
  const b = K.B(c0);
  return 0.5 + (2 * b * (b * Math.tanh(b) - 1)) / (Math.sinh(2 * b) + 2 * b);
}

/** The first form of (22): c0 [sinh(2b)/2 - b + 2 b^2 tanh b]. */
export function lookAheadFirst(c0) {
  const b = K.B(c0);
  return c0 * (Math.sinh(2 * b) / 2 - b + 2 * b * b * Math.tanh(b));
}

/** The largest lead over frequency for a cost, scanned on a log grid of omega from 0.01 to 1e6: { omega, lead }. */
export function leadPeak(c0, perDecade = 100) {
  let best = { omega: NaN, lead: -Infinity };
  for (let lo = -2; lo <= 6 + 1e-9; lo += 1 / perDecade) {
    const om = 10 ** lo, l = K.transfer(c0, om).lead;
    if (l > best.lead) best = { omega: om, lead: l };
  }
  return best;
}

/** d log f / d log x by a central difference. */
export const logSlope = (f, x, h = 1.01) => (Math.log(f(x * h)) - Math.log(f(x / h))) / (2 * Math.log(h));

/** The kernel's behavior near s = 0: 2 c0 cosh^2 b0 sqrt(2 / (pi s)). */
export const kernelNearZero = (s, c0) => { const b = K.B(c0); return 2 * c0 * Math.cosh(b) ** 2 * Math.sqrt(2 / (Math.PI * s)); };

/** The high-frequency gain: 2 c0 cosh^2 b0 sqrt(2 / omega). */
export const gainAsymptote = (omega, c0) => { const b = K.B(c0); return 2 * c0 * Math.cosh(b) ** 2 * Math.sqrt(2 / omega); };

/** r = sqrt(1 - 2 i omega) and tanh(r b0), as complex numbers. */
export function rAndTanh(c0, omega) {
  const b = K.B(c0);
  const m = Math.hypot(1, 2 * omega);
  const r = { re: Math.sqrt((m + 1) / 2), im: -Math.sqrt((m - 1) / 2) };
  const e = Math.exp(-2 * r.re * b), ang = -2 * r.im * b;
  const q = { re: e * Math.cos(ang), im: e * Math.sin(ang) };
  // tanh z = (1 - q) / (1 + q), q = e^{-2z}
  const nr = 1 - q.re, ni = -q.im, dr = 1 + q.re, di = q.im, d = dr * dr + di * di;
  return { r, tanh: { re: (nr * dr + ni * di) / d, im: (ni * dr - nr * di) / d } };
}

// ---- the mean look-ahead as an average over starts ----------------------------------------------------------------

/** E_y tau_0 = b0 tanh b0 - y tanh y, the mean time to the bound from y. */
export const meanTimeFrom = (y, b0) => b0 * Math.tanh(b0) - y * Math.tanh(y);

/** int_0^{b0} pi_0(y) E_y tau_0 dy by Simpson's rule: the mean look-ahead, a second way. */
export function lookAheadByStarts(c0, n = 2000) {
  const b = K.B(c0), h = b / n;
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const y = i * h, v = K.pi0(y, c0) * meanTimeFrom(y, b);
    acc += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * v;
  }
  return (acc * h) / 3;
}

// ---- the second-order loss at a constant cost ------------------------------------------------------------------

/** The reward of a flat bound b at the constant cost c, from a start at 0: g(b) - c b tanh b. */
export const flatReward = (b, c) => belief(b) - c * b * Math.tanh(b);

/** The waiting value at a constant cost, W_0(y) = V_0(y) - g(y), for 0 <= y <= b0: V_0(y) = g(b0) - c0 E_y tau_0. */
export function waitingValue(y, c0) {
  const b = K.B(c0);
  if (y >= b) return 0;
  return belief(b) - c0 * meanTimeFrom(y, b) - belief(y);
}

/** Expected time Y spends in [b0, b0 + D] before it first reaches b0 + D, from a start below b0: the integral of the
 * Green's function 2 cosh^2 z (tanh L - tanh z) over that band, with L = b0 + D. */
export function timeAbove(b0, D) {
  const L = b0 + D, tL = Math.tanh(L);
  const prim = (z) => tL * (z + Math.sinh(z) * Math.cosh(z)) - Math.sinh(z) ** 2;
  return prim(L) - prim(b0);
}

/** E_{y} sigma_z = z tanh z - y tanh y, the mean time for Y to reach a level z from y < z. */
export const hitMean = (y, z) => z * Math.tanh(z) - y * Math.tanh(y);

// ---- scoring a rule, with its decision times (model.js's score, step for step) ------------------------------------

function grid(dt, h, cap) {
  const half = cap + 8 * Math.sqrt(dt) + 1;
  const m = Math.ceil(half / h);
  const n = 2 * m + 1;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = (i - m) * h;
  const r = Math.ceil((6 * Math.sqrt(dt)) / h);
  const k = new Float64Array(2 * r + 1);
  let sum = 0;
  for (let j = -r; j <= r; j++) { const v = Math.exp(-((j * h - dt) ** 2) / (2 * dt)); k[j + r] = v; sum += v; }
  for (let j = 0; j < k.length; j++) k[j] /= sum;
  return { x, m, n, r, kUp: k };
}

/** The expected reward of a policy (evidence bounds xb at times ts, checked every dt) as model.js's score computes
 * it, and f[k], the chance of deciding at time ts[k] (with any trial still undecided at the end counted at the last
 * time). */
export function forward(xb, ts, cost, h = 0.02, cap = 5) {
  const dt = ts[1] - ts[0];
  const f = new Float64Array(ts.length);
  if (!(Math.min(xb[0], cap) > 0)) { f[0] = 1; return { p: 0.5, rt: 0, paid: 0, reward: 0.5, f }; }
  const { x, m, n, r, kUp } = grid(dt, h, cap);
  let p = new Float64Array(n), q = new Float64Array(n);
  p[m] = 1;
  let correct = 0, rt = 0, paid = 0, alive = 1, lo = m, hi = m;
  for (let k = 1; k < ts.length; k++) {
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
      const keep = qi * (1 - up - dn);
      q[i] = keep;
      if (keep > 1e-300) { total += keep; if (i < newLo) newLo = i; newHi = i; }
    }
    p.fill(0, lo, hi + 1);
    [p, q] = [q, p];
    correct += mUp;
    rt += (mUp + mLo) * ts[k];
    f[k] = mUp + mLo;
    alive = total;
    if (newHi < 0) { lo = m; hi = m; alive = 0; break; }
    lo = newLo; hi = newHi;
  }
  if (alive > 0) {
    for (let i = lo; i <= hi; i++) correct += x[i] > 0 ? p[i] : x[i] === 0 ? 0.5 * p[i] : 0;
    rt += alive * ts[ts.length - 1];
    f[ts.length - 1] += alive;
  }
  return { p: correct, rt, paid, reward: correct - paid, f };
}

/** Conjecture 11's prediction, sum_k f_k c(t_k) eta_k^2 with eta the rule's distance from the program's bound,
 * leaving out the last grid time (where the forced choice makes every bound equal in effect), and its running
 * share at each time. */
export function predictedLoss(F, xb, best, ts, cost) {
  const N = ts.length;
  const cum = new Float64Array(N);
  let acc = 0;
  for (let k = 0; k < N - 1; k++) {
    const e = xb[k] - best[k];
    if (Number.isFinite(e)) acc += F.f[k] * cost(ts[k]) * e * e;
    cum[k] = acc;
  }
  cum[N - 1] = acc;
  return { pred: acc, cum };
}

/** The forced choice for the loss runs: far enough out that, except at the smallest costs, almost every decision is
 * made before it, so the losses are about the rules and not about the end of the horizon. */
export const LOSS_HORIZON = 14;

/** The reader's schedule written around its cost at time 0, c0 + eps (c(t) - c0), for each eps: the program's best
 * bound, the per-moment rule, and the first-order bound b0 + eps beta(t), each scored by the forward computation,
 * with each rule's loss and Conjecture 11's prediction for it. Bounds are evidence bounds checked every dt (the
 * rules moved in by the monitoring shift, as the solver's worker does). */
export function lossRun(cost, EPS, { horizon = LOSS_HORIZON, view = 2.5, dt = 0.01, h = 0.02, every = 2, progress = null } = {}) {
  const c0 = cost(0);
  const gamma = (t) => cost(t) - c0;
  const flat = exactPolicy(() => c0, horizon, dt, h);
  const ts = flat.ts, N = ts.length;
  // the grid's resolution: how much the scored reward moves when the program's own constant-cost bound moves by
  // 0.001 (an exact computation would move it by about c0 times 0.001 squared)
  const R0 = score(flat.bounds, ts, () => c0, h).reward;
  const shifted = (d) => flat.bounds.map((b, k) => (k === N - 1 ? b : b + d));
  const floor = Math.max(...[-0.001, 0.001].map((d) => Math.abs(R0 - score(shifted(d), ts, () => c0, h).reward)));
  const beta = K.firstOrder(gamma, Array.from(ts), c0);
  const b0 = K.B(c0);
  const keepW = [], keepC = [];
  for (let k = 0; k < N; k += every) { if (ts[k] <= view + 1e-9) keepW.push(k); }
  for (let k = 0; k < N; k += ts[k] < 1 ? 1 : 5) keepC.push(k);
  if (keepC[keepC.length - 1] !== N - 1) keepC.push(N - 1);
  const runs = [];
  for (const eps of EPS) {
    const ce = (t) => c0 + eps * gamma(t);
    const dp = exactPolicy(ce, horizon, dt, h);
    const pm = Float64Array.from(ts, (t) => toDiscrete(boundForCost(ce(t)), dt));
    const fo = Float64Array.from(ts, (t, k) => toDiscrete(b0 + eps * beta[k], dt));
    const Rdp = score(dp.bounds, ts, ce, h).reward;
    const Fp = forward(pm, ts, ce, h), Ff = forward(fo, ts, ce, h);
    const Pp = predictedLoss(Fp, pm, dp.bounds, ts, ce), Pf = predictedLoss(Ff, fo, dp.bounds, ts, ce);
    // the share of the prediction from the last 2 time units before the forced choice
    const late = (P) => { let k0 = 0; while (k0 < N - 1 && ts[k0] <= horizon - 2) k0++; const before = k0 > 0 ? P.cum[k0 - 1] : 0; return P.pred > 0 ? (P.pred - before) / P.pred : NaN; };
    runs.push({
      eps, Rdp,
      loss: { pm: Rdp - Fp.reward, fo: Rdp - Ff.reward },
      pred: { pm: Pp.pred, fo: Pf.pred },
      late: { pm: late(Pp), fo: late(Pf) },
      cum: { pm: keepC.map((k) => (Pp.pred > 0 ? Pp.cum[k] / Pp.pred : 0)), fo: keepC.map((k) => (Pf.pred > 0 ? Pf.cum[k] / Pf.pred : 0)) },
      bounds: { dp: keepW.map((k) => dp.bounds[k]), pm: keepW.map((k) => pm[k]), fo: keepW.map((k) => fo[k]) },
      foNegative: fo[0] <= 0,
    });
    if (progress) progress(runs.length / EPS.length);
  }
  return { c0, floor, horizon, t: keepW.map((k) => ts[k]), tc: keepC.map((k) => ts[k]), runs };
}

/** A loss is resolved by the grid when it is at least ten times the grid's resolution. */
export const resolved = (loss, floor) => Number.isFinite(loss) && loss >= 10 * floor;

/** The slope of log y against log x over the n smallest x where keep[i] holds (least squares), where the order of a
 * small-change result shows; NaN with fewer than n such points. xs run from largest to smallest. */
export function lastSlope(xs, ys, keep, n = 3) {
  const idx = xs.map((_, i) => i).filter((i) => keep[i] && ys[i] > 0);
  if (idx.length < n) return NaN;
  const use = idx.slice(-n), k = use.map(() => true);
  return fitSlope(use.map((i) => xs[i]), use.map((i) => ys[i]), k);
}

/** The slope of log y against log x through the points where keep[i] holds (least squares); NaN with fewer than 3. */
export function fitSlope(xs, ys, keep) {
  const X = [], Y = [];
  xs.forEach((x, i) => { if (keep[i] && ys[i] > 0) { X.push(Math.log(x)); Y.push(Math.log(ys[i])); } });
  if (X.length < 3) return NaN;
  const mx = X.reduce((a, b) => a + b) / X.length, my = Y.reduce((a, b) => a + b) / Y.length;
  let num = 0, den = 0;
  X.forEach((x, i) => { num += (x - mx) * (Y[i] - my); den += (x - mx) ** 2; });
  return num / den;
}

/** The per-moment rule shifted ahead by the mean look-ahead at the current cost, B(c(t + m(c(t)))), as an evidence
 * bound checked every dt. */
export function shiftedBound(cost, t, dt = 0.01) {
  const c = cost(t);
  if (!Number.isFinite(c)) return 0;
  const m = K.meanLookAhead(c, 400);
  return toDiscrete(boundForCost(cost(t + m)), dt);
}
