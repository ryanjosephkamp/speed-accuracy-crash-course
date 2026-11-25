// Chapter 11's model, with no DOM: the two extensions of the paper's Section 7, as its code at the tag computes them.
//
// Unknown reliability (src/speed_accuracy/info_time.py and unknown.py): the drift mu ~ N(0, 1/a) is drawn once per
// trial; the belief variable u = X / sqrt(t + a) runs on the information clock theta = log((t + a) / a), where
// du = u/2 dtheta + dW and a cost c(t) per unit time is kappa = c(t) (t + a) per unit of theta. The constant-kappa
// bound U(kappa), the kernel of the u process from a finite-difference generator, the frozen-time, weighted, and
// plug-in rules as evidence bounds, and the dynamic program over a grid of beliefs.
//
// Unequal rewards (src/speed_accuracy/lopsided.py): a correct "+" earns r_plus, a correct "-" earns r_minus. The
// constant-cost bounds (lo, hi) of Appendix B, each bound's survival flux (its total, its Laplace transform, its
// series), the value and the stopping reward, and the dynamic program with two bounds on an evidence grid.
//
// tools/checks/ch11.mjs holds these to the paper's code (tools/validity/ch11.json) and to identities.

import { B as Bknown } from "./kernel.js?v=850f062e96";

export const OVERSHOOT = 0.5826;

// ================================================================ the normal law
const SQ2PI = Math.sqrt(2 * Math.PI);

/** erf(x) by its Taylor series for |x| < 3 and the continued fraction of erfc beyond (absolute error near 1e-14). */
function erf(x) {
  const ax = Math.abs(x);
  if (ax < 3) {
    let term = x, sum = x, n = 0;
    const x2 = x * x;
    while (Math.abs(term) > 1e-17 * Math.abs(sum) && n < 200) { n++; term *= -x2 / n; sum += term / (2 * n + 1); }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  // erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + 1/2/(x + 1/(x + 3/2/(x + ...)))), by Lentz's method
  let f = ax, C = ax, D = 0;
  for (let k = 1; k < 200; k++) {
    const an = k / 2;
    D = ax + an * D; D = D === 0 ? 1e-300 : 1 / D;
    C = ax + an / C; if (C === 0) C = 1e-300;
    const delta = C * D; f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  const erfc = Math.exp(-ax * ax) / (Math.sqrt(Math.PI) * f);
  return x > 0 ? 1 - erfc : erfc - 1;
}
export const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
export const normPdf = (x) => Math.exp(-0.5 * x * x) / SQ2PI;

/** The inverse of the normal distribution function: Acklam's rational approximation and one Halley step. */
export function normPpf(p) {
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const lo = 0.02425;
  let x;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const e = normCdf(x) - p, u = e * SQ2PI * Math.exp(0.5 * x * x);
  return x - u / (1 + 0.5 * x * u);
}

// ================================================================ unknown reliability: the information clock
export const thetaOf = (t, a = 1) => Math.log((t + a) / a);
export const tOf = (theta, a = 1) => a * Math.exp(theta) - a;
/** The cost per unit of information time: kappa = c(t) (t + a) (infinite where the cost is). */
export const kappaOf = (c, t, a = 1) => c * (t + a);

/** int_0^U e^{v^2/2} dv, by its series sum U^{2n+1} / (2^n n! (2n + 1)) (all terms positive). */
export function expIntegral(U) {
  const x2 = (U * U) / 2;
  let term = U, sum = U, n = 0;
  while (term > 1e-17 * sum && n < 400) { n++; term *= x2 / n; sum += term / (2 * n + 1); }
  return sum;
}

/** The constant-kappa bound U(kappa): int_0^U e^{v^2/2} dv = 1 / (2 sqrt(2 pi) kappa) (info_time.frozen_bound). */
export function frozenBound(kappa) {
  if (!(kappa > 0)) return Infinity;
  if (!Number.isFinite(kappa)) return 0;
  const target = 1 / (2 * SQ2PI * kappa);
  let lo = 0, hi = 1;
  while (expIntegral(hi) < target) hi *= 2;
  // Newton from the bracket's middle, kept inside the bracket (the integral is increasing and convex)
  let U = 0.5 * (lo + hi);
  for (let i = 0; i < 100; i++) {
    const f = expIntegral(U) - target;
    if (f > 0) hi = U; else lo = U;
    let nx = U - f / Math.exp(0.5 * U * U);
    if (!(nx > lo && nx < hi)) nx = 0.5 * (lo + hi);
    if (Math.abs(nx - U) < 1e-14) { U = nx; break; }
    U = nx;
  }
  return U;
}

// The paper's vectorized version: a table of 1601 bounds on a grid of log kappa from 1e-4 to 1e4, read by linear
// interpolation in log kappa, with kappa clipped to that range and an infinite kappa giving 0.
const LOGK0 = Math.log(1e-4), LOGK1 = Math.log(1e4), NK = 1601;
let UTAB = null;
export function frozenBounds(kappa) {
  if (kappa === Infinity) return 0;
  if (!UTAB) { UTAB = new Float64Array(NK); for (let i = 0; i < NK; i++) UTAB[i] = frozenBound(Math.exp(LOGK0 + ((LOGK1 - LOGK0) * i) / (NK - 1))); }
  const lk = Math.log(Math.min(Math.max(kappa, 1e-4), 1e4));
  const f = ((lk - LOGK0) / (LOGK1 - LOGK0)) * (NK - 1);
  const i = Math.min(Math.floor(f), NK - 2), u = f - i;
  return UTAB[i] * (1 - u) + UTAB[i + 1] * u;
}

// ---------------------------------------------------------------- the kernel of the u process
/** Eigen-decomposition of a symmetric tridiagonal matrix by the implicit QL method, carrying along only two vectors:
 * the last row of the eigenvector matrix Q and Q^T y. Returns { lam, last, qy }. */
function tridiagEig(diag, off, y) {
  const n = diag.length;
  const d = Float64Array.from(diag), e = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) e[i] = off[i];
  e[n - 1] = 0;
  const last = new Float64Array(n); last[n - 1] = 1;   // row n-1 of Q, which starts as the identity
  const qy = Float64Array.from(y);                     // Q^T y, updated by the same rotations
  for (let l = 0; l < n; l++) {
    let iter = 0, m;
    do {
      for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) <= Number.EPSILON * dd) break; }
      if (m !== l) {
        if (iter++ === 60) throw new Error("the eigenvalue iteration did not converge");
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1, c = 1, p = 0, i;
        for (i = m - 1; i >= l; i--) {
          let f = s * e[i]; const b = c * e[i];
          r = Math.hypot(f, g); e[i + 1] = r;
          if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
          s = f / r; c = g / r; g = d[i + 1] - p; r = (d[i] - g) * s + 2 * c * b; p = s * r; d[i + 1] = g + p; g = c * r - b;
          // columns i and i+1 of Q rotate: Q[:, i+1] <- s Q[:, i] + c Q[:, i+1], Q[:, i] <- c Q[:, i] - s Q[:, i+1]
          f = last[i + 1]; last[i + 1] = s * last[i] + c * f; last[i] = c * last[i] - s * f;
          f = qy[i + 1]; qy[i + 1] = s * qy[i] + c * f; qy[i] = c * qy[i] - s * f;
        }
        if (r === 0 && i >= l) continue;
        d[l] -= p; e[l] = g; e[m] = 0;
      }
    } while (m !== l);
  }
  return { lam: d, last, qy };
}

/** The boundary kernel of du = drift(u) dt + dW between absorbing bounds at -U and U: the survival flux at U,
 * normalized, on log-spaced bins of s (info_time.survival_kernel). The generator is the paper's finite-difference
 * matrix on `points` interior nodes, made symmetric by a diagonal change of scale (same eigenvalues). Returns
 * { s: bin midpoints, w: weights summing to 1, edges, rate: the slowest rate }. */
export function survivalKernel(drift, U, points = 400, bins = 240, tMax = null) {
  const n = points, h = (2 * U) / (n + 1);
  const u = Float64Array.from({ length: n }, (_, i) => -U + h * (i + 1));
  const f = Float64Array.from(u, drift);
  const sup = new Float64Array(n - 1), sub = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) { sup[i] = 0.5 / (h * h) + f[i] / (2 * h); sub[i] = 0.5 / (h * h) - f[i + 1] / (2 * h); }
  // S = D L D^-1 with d[i+1] = d[i] sqrt(sup[i] / sub[i]); then L = D^-1 Q diag(lam) Q^T D
  const dsc = new Float64Array(n); dsc[0] = 1;
  for (let i = 0; i < n - 1; i++) dsc[i + 1] = dsc[i] * Math.sqrt(sup[i] / sub[i]);
  const diag = new Float64Array(n).fill(-1 / (h * h));
  const off = Float64Array.from({ length: n - 1 }, (_, i) => Math.sqrt(sup[i] * sub[i]));
  const { lam, last, qy } = tridiagEig(diag, off, dsc);
  // survival at the node next to U, by mode: (D^-1 Q)[n-1, k] (Q^T D 1)[k]
  const amp = Float64Array.from(lam, (_, k) => (last[k] / dsc[n - 1]) * qy[k]);
  let slow = Infinity; for (const l of lam) slow = Math.min(slow, -l);
  const T = tMax ?? 14 / slow;
  const edges = new Float64Array(bins + 1);
  for (let i = 1; i <= bins; i++) edges[i] = 1e-5 * T * Math.pow(1e5, (i - 1) / (bins - 1));
  const w = new Float64Array(bins);
  for (let k = 0; k < n; k++) {
    const rate = -lam[k], c = amp[k] / rate;
    let prev = 1;
    for (let i = 0; i < bins; i++) { const x = rate * edges[i + 1]; const nx = x > 745 ? 0 : Math.exp(-x); w[i] += c * (prev - nx); prev = nx; if (nx === 0) break; }
  }
  let tot = 0;
  for (let i = 0; i < bins; i++) { w[i] = Math.max(w[i], 0); tot += w[i]; }
  const s = new Float64Array(bins);
  for (let i = 0; i < bins; i++) { w[i] /= tot; s[i] = 0.5 * (edges[i] + edges[i + 1]); }
  return { s, w, edges, slow };
}

const UK = new Map();
/** The u-kernel the paper's rule uses: cached on U rounded to 0.01, with a floor of 0.02, from 240 nodes. */
export function kernelU(U) {
  const key = Math.round(Math.max(U, 0.02) * 100);
  let k = UK.get(key);
  if (!k) { k = survivalKernel((x) => x / 2, key / 100, 240); UK.set(key, k); }
  return k;
}
export const kernelMean = ({ s, w }) => { let m = 0; for (let i = 0; i < s.length; i++) m += s[i] * w[i]; return m; };

// ---------------------------------------------------------------- the rules, as evidence bounds X(t)
const costAt = (cost, t) => { const c = cost(t); return c; };

/** The frozen-time rule: U(kappa(theta)) at each moment, as the evidence bound U sqrt(t + a). */
export function frozenTime(cost, ts, a = 1) {
  return Float64Array.from(ts, (t) => frozenBounds(kappaOf(costAt(cost, t), t, a)) * Math.sqrt(t + a));
}

/** The weighted look-ahead in information time: 30 damped updates of u(t) <- sum_j w_j U(kappa(theta + s_j)), with
 * the u-kernel for the current level, from the frozen-time bound; as evidence bounds (info_time.weighted_bound).
 * Each time is computed on its own, as in the paper's code. */
export function weightedTime(cost, ts, a = 1, iterations = 30) {
  return Float64Array.from(ts, (t) => weightedAt(cost, t, a, iterations) * Math.sqrt(t + a));
}
export function weightedAt(cost, t, a = 1, iterations = 30) {
  const th = thetaOf(t, a);
  const kap = (x) => { const tt = tOf(x, a); return kappaOf(costAt(cost, tt), tt, a); };
  let ref = frozenBounds(kap(th));
  const ahead = new Map();   // U(kappa(theta + s_j)) for each kernel used
  for (let it = 0; it < iterations; it++) {
    const key = Math.round(Math.max(ref, 0.02) * 100);
    const { s, w } = kernelU(key / 100);
    let row = ahead.get(key);
    if (!row) { row = Float64Array.from(s, (sj) => frozenBounds(kap(th + sj))); ahead.set(key, row); }
    let acc = 0; for (let j = 0; j < s.length; j++) acc += w[j] * row[j];
    ref = 0.5 * (ref + acc);
  }
  return ref;
}

/** The known-reliability bound in evidence units for drift 1 and noise variance s2: s2 B(c s2) (ddm.optimal_bound). */
export const knownBound = (c, s2) => s2 * Bknown(c * s2);

/** The plug-in rule: treat the drift estimate |X| / (t + a) as known; the smallest |X| at which it stops, the root
 * of t + a = optimal_bound(c, (t + a)^2 / X^2) (experiments/unknown_reliability.py). */
export function plugInAt(c, t, a = 1) {
  if (!Number.isFinite(c)) return 0;
  const T = t + a;
  const f = (x) => T - knownBound(c, (T * T) / (x * x));
  let lo = 1e-6, hi = 1;
  while (f(hi) < 0 && hi < 1e3) hi *= 2;
  const flo = f(lo), fhi = f(hi);
  if (!(flo < 0 && fhi > 0)) return flo >= 0 ? 0 : hi;
  for (let i = 0; i < 200 && hi - lo > 1e-13 * hi; i++) { const m = 0.5 * (lo + hi); if (f(m) < 0) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
export const plugIn = (cost, ts, a = 1) => Float64Array.from(ts, (t) => plugInAt(costAt(cost, t), t, a));

/** Moved in for checking every dt (info_time.discrete). */
export const shifted = (xs, dt) => Float64Array.from(xs, (x) => Math.max(x - OVERSHOOT * Math.sqrt(dt), 0));

// ---------------------------------------------------------------- the dynamic program over beliefs
/** The exact policy for unknown reliability (unknown.backward_induction): n beliefs at bin midpoints, a step dt,
 * and a forced choice at the horizon. In u = Phi^-1(g), one step moves u to N(u sqrt(1 + e), e) with
 * e = dt / (t + a); the transition rows are the paper's, with entries below e^-40 of a row's largest left out.
 * Returns { ts, g: the upper belief bound, x: the evidence bound Phi^-1(g) sqrt(t + a) }. */
export function unknownProgram(cost, horizon, { n = 300, dt = 0.005, a = 1, progress = null } = {}) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const g = Float64Array.from({ length: n }, (_, i) => (i + 0.5) / n);
  const u = Float64Array.from(g, normPpf), hu = Float64Array.from(u, (x) => 0.5 * x * x);
  const decide = Float64Array.from(g, (x) => Math.max(x, 1 - x));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n), next = new Float64Array(n);
  const gb = new Float64Array(steps + 1);
  gb[steps] = 0.5;
  const half = n >> 1;   // g[half] is the first belief above 1/2 (n even)
  let symGap = 0;
  for (let k = steps - 1; k >= 0; k--) {
    const e = dt / (ts[k] + a), sq = Math.sqrt(1 + e), inv = 1 / (2 * e);
    const ck = Math.min(cost(ts[k]), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      const mu = sq * u[i];
      // the row's largest exponent lies at the grid point nearest the Gaussian's center (the Jacobian is a small tilt)
      let j0 = 0, best = -Infinity;
      { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (u[m] < mu) lo = m; else hi = m; } j0 = lo; }
      for (let j = Math.max(0, j0 - 2); j <= Math.min(n - 1, j0 + 3); j++) { const z = hu[j] - (u[j] - mu) ** 2 * inv; if (z > best) best = z; }
      let num = 0, den = 0;
      for (let j = j0; j >= 0; j--) { const z = hu[j] - (u[j] - mu) ** 2 * inv - best; if (z < -40) break; const p = Math.exp(z); num += p * v[j]; den += p; }
      for (let j = j0 + 1; j < n; j++) { const z = hu[j] - (u[j] - mu) ** 2 * inv - best; if (z < -40) break; const p = Math.exp(z); num += p * v[j]; den += p; }
      wait[i] = num / den - ck;
    }
    // the grid has no point at 1/2: the two nearest, g[half - 1] and g[half], are mirror images, so deciding minus
    // waiting is the same at both, and a stop at g[half] means a stop at 1/2 too (the bound 1/2 is then exact)
    symGap = Math.max(symGap, Math.abs((decide[half] - wait[half]) - (decide[half - 1] - wait[half - 1])));
    // the bound: the first belief above 1/2 where deciding beats waiting, interpolated (known.bound_from_values)
    let bnd = 1;
    for (let i = half; i < n; i++) {
      const df = decide[i] - wait[i];
      if (df > 0) {
        if (i === half) { bnd = 0.5; break; }
        const dp = decide[i - 1] - wait[i - 1];
        bnd = g[i - 1] - (dp * (g[i] - g[i - 1])) / (df - dp);
        break;
      }
    }
    gb[k] = bnd;
    for (let i = 0; i < n; i++) next[i] = Math.max(decide[i], wait[i]);
    v.set(next);
    if (progress && k % 200 === 0) progress(1 - k / steps);
  }
  const x = Float64Array.from(gb, (b, k) => normPpf(Math.min(Math.max(b, 0.5), 1 - 1e-12)) * Math.sqrt(ts[k] + a));
  return { ts, g: gb, x, symGap };
}

// ================================================================ unequal rewards
export const xStar = (rp, rm) => 0.5 * Math.log(rm / rp);
export const belief = (x) => 1 / (1 + Math.exp(-2 * x));
/** S(x) = x + sinh(2x)/2, twice the integral of cosh^2 from 0 to x. */
export const Sfun = (x) => x + 0.5 * Math.sinh(2 * x);
export function Sinv(v) {
  const t = Math.abs(v);
  if (t === 0) return 0;
  // Newton from a start above the root (S is convex on x > 0), so the steps fall monotonically onto it
  let x = Math.max(t / 2, Math.asinh(t)) + 1;
  for (let i = 0; i < 200; i++) {
    const nx = x - (Sfun(x) - t) / (2 * Math.cosh(x) ** 2);
    if (Math.abs(nx - x) <= 1e-15 * Math.max(1, nx)) { x = nx; break; }
    x = nx;
  }
  return Math.sign(v) * x;
}
/** An antiderivative of V'(x) = (c S(x) + K) / cosh^2 x. */
export const Afun = (x, c, K) => c * (Sfun(x) * Math.tanh(x) - 0.5 * Math.cosh(2 * x)) + K * Math.tanh(x);

/** lo from hi, K, and the residual of value matching, for a candidate hi (lopsided.constant_bounds' parts). */
export function matching(hi, c, rp, rm) {
  const gap = (rp + rm) / (2 * c);
  const lo = Sinv(Sfun(hi) - gap);
  const K = 0.5 * rp - c * Sfun(hi);
  const resid = Afun(hi, c, K) - Afun(lo, c, K) - (rp * belief(hi) - rm * (1 - belief(lo)));
  return { lo, K, resid };
}

/** The constant-cost bounds (lo, hi) for rewards rp and rm (lopsided.constant_bounds): scan hi above x* on the
 * paper's grid x* + geomspace(1e-6, 30, 400) for the first sign change of value matching, then bisect. */
export function constantBounds(c, rp = 1, rm = 1) {
  const xs = xStar(rp, rm);
  if (!Number.isFinite(c)) return { lo: xs, hi: xs, K: NaN };
  const N = 400;
  let pa = xs + 1e-6, fa = matching(pa, c, rp, rm).resid;
  for (let i = 1; i < N; i++) {
    const pb = xs + 1e-6 * Math.pow(3e7, i / (N - 1)), fb = matching(pb, c, rp, rm).resid;
    if (fa === 0) { const m = matching(pa, c, rp, rm); return { lo: m.lo, hi: pa, K: m.K }; }
    if (fa * fb < 0) {
      let lo = pa, hi = pb, flo = fa;
      for (let k = 0; k < 200 && hi - lo > 1e-14 * Math.max(1, Math.abs(hi)); k++) {
        const m = 0.5 * (lo + hi), fm = matching(m, c, rp, rm).resid;
        if (fm * flo <= 0) hi = m; else { lo = m; flo = fm; }
      }
      const h = 0.5 * (lo + hi), m = matching(h, c, rp, rm);
      return { lo: m.lo, hi: h, K: m.K };
    }
    pa = pb; fa = fb;
  }
  throw new Error(`no bounds found for c=${c}, rewards ${rp}, ${rm}`);
}

/** The value V on (lo, hi) and the stopping reward G, for a constant cost: V(x) = G(hi) + A(x) - A(hi). */
export const stopReward = (x, rp, rm) => Math.max(rp * belief(x), rm * (1 - belief(x)));
export function valueAt(x, c, rp, rm, cb) {
  if (x >= cb.hi || x <= cb.lo) return stopReward(x, rp, rm);
  return rp * belief(cb.hi) + Afun(x, c, cb.K) - Afun(cb.hi, c, cb.K);
}

/** The mean exit time m(x) from (lo, hi), solving m''/2 + tanh(x) m' = -1 with m = 0 at both ends, and the total
 * survival flux at each bound, -m'(hi) and m'(lo) (lopsided.flux_totals). */
const anti = (x) => Sfun(x) * Math.tanh(x) - 0.5 * Math.cosh(2 * x);
export function fluxTotals(lo, hi) {
  const C = (anti(hi) - anti(lo)) / (Math.tanh(hi) - Math.tanh(lo));
  return { hi: (Sfun(hi) - C) / Math.cosh(hi) ** 2, lo: (C - Sfun(lo)) / Math.cosh(lo) ** 2, C };
}
export function meanExit(x, lo, hi) {
  // m'(x) = (C - S(x)) / cosh^2 x, so m(x) = C tanh x - anti(x) + const, with m(lo) = 0
  const { C } = fluxTotals(lo, hi);
  return (C * Math.tanh(x) - anti(x)) - (C * Math.tanh(lo) - anti(lo));
}

// complex arithmetic for the transforms
const cx = (re, im = 0) => ({ re, im });
const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
const csub = (a, b) => cx(a.re - b.re, a.im - b.im);
const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cscale = (a, k) => cx(a.re * k, a.im * k);
const csqrt = (a) => { const m = Math.hypot(a.re, a.im); return cx(Math.sqrt((m + a.re) / 2), (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(m - a.re, 0) / 2)); };
const ccosh = (z) => cx(Math.cosh(z.re) * Math.cos(z.im), Math.sinh(z.re) * Math.sin(z.im));
const csinh = (z) => cx(Math.sinh(z.re) * Math.cos(z.im), Math.cosh(z.re) * Math.sin(z.im));

/** The Laplace transforms of the survival flux at each bound, at a complex lambda (lopsided.exit_transforms):
 * E_x e^{-lambda tau} = (A cosh(r x) + B sinh(r x)) / cosh x, equal to 1 at both bounds, r = sqrt(2 lambda + 1). */
export function exitTransforms(lam, lo, hi) {
  const L = typeof lam === "number" ? cx(lam) : lam;
  // at lambda = 0 the ratio below is 0/0: its limit is each bound's total flux
  if (L.re === 0 && L.im === 0) { const t = fluxTotals(lo, hi); return { hi: cx(t.hi), lo: cx(t.lo) }; }
  const r = csqrt(cx(2 * L.re + 1, 2 * L.im));
  const rl = cmul(r, cx(lo)), rh = cmul(r, cx(hi));
  const chl = ccosh(rl), shl = csinh(rl), chh = ccosh(rh), shh = csinh(rh);
  const det = csub(cmul(chl, shh), cmul(shl, chh));
  const A = cdiv(csub(cscale(shh, Math.cosh(lo)), cscale(shl, Math.cosh(hi))), det);
  const Bc = cdiv(csub(cscale(chl, Math.cosh(hi)), cscale(chh, Math.cosh(lo))), det);
  const du = (x) => {
    const rx = cmul(r, cx(x)), ch = ccosh(rx), sh = csinh(rx);
    const f = cadd(cmul(A, ch), cmul(Bc, sh));
    const fp = cmul(r, cadd(cmul(A, sh), cmul(Bc, ch)));
    return cscale(csub(cscale(fp, Math.cosh(x)), cscale(f, Math.sinh(x))), 1 / Math.cosh(x) ** 2);
  };
  return { hi: cdiv(du(hi), L), lo: cscale(cdiv(du(lo), L), -1) };
}

/** The normalized kernels' transforms (w_hi(lambda), w_lo(lambda)), 1 at lambda = 0 (lopsided.transfer). */
export function transfer(lam, lo, hi) {
  const n = exitTransforms(lam, lo, hi), t = fluxTotals(lo, hi);
  return { hi: cscale(n.hi, 1 / t.hi), lo: cscale(n.lo, 1 / t.lo) };
}
/** Gain and lead (degrees) of each bound's kernel at frequency omega: W = w~(-i omega). */
export function transferAt(omega, lo, hi) {
  const w = transfer(cx(0, -omega), lo, hi);
  const g = (z) => ({ gain: Math.hypot(z.re, z.im), lead: (Math.atan2(z.im, z.re) * 180) / Math.PI, re: z.re, im: z.im });
  return { hi: g(w.hi), lo: g(w.lo) };
}

/** The survival flux at each bound as a series (lopsided.boundary_kernels): for Brownian motion with drift a killed
 * outside an interval of width L, the flux at the upper end is (2/L) sum_n k_n^2/(a^2 + k_n^2)
 * (1 - (-1)^n e^{-aL}) e^{-(k_n^2 + a^2) s / 2}, k_n = n pi / L; at the lower end the sign of a flips; the decision
 * maker's own process mixes drift +1 and -1 with the belief at that bound. flux(side, s) is the density;
 * bins() gives the paper's 240 log-spaced bins, each bound's weights summing to 1. */
export function boundaryKernels(lo, hi, terms = 4000, bins = 240) {
  const L = hi - lo;
  const lamSlow = 0.5 * ((Math.PI / L) ** 2 + 1);
  const parts = { hi: [], lo: [] };
  for (const [side, xb, sg] of [["hi", hi, 1], ["lo", lo, -1]]) {
    const g = belief(xb);
    for (const [mu, pw] of [[1, g], [-1, 1 - g]]) {
      const a = sg * mu, eaL = Math.exp(-a * L);
      const amp = new Float64Array(terms), rate = new Float64Array(terms);
      for (let n = 1; n <= terms; n++) {
        const k = (n * Math.PI) / L;
        amp[n - 1] = pw * (2 / L) * (k * k) / (a * a + k * k) * (1 - (n % 2 ? -1 : 1) * eaL);
        rate[n - 1] = 0.5 * (k * k + a * a);
      }
      parts[side].push({ amp, rate });
    }
  }
  const total = (side) => parts[side].reduce((acc, { amp, rate }) => { for (let i = 0; i < amp.length; i++) acc += amp[i] / rate[i]; return acc; }, 0);
  const flux = (side, s) => {
    let acc = 0;
    for (const { amp, rate } of parts[side]) for (let i = 0; i < amp.length; i++) { const x = rate[i] * s; if (x > 745) break; acc += amp[i] * Math.exp(-x); }
    return acc;
  };
  const mean = (side) => parts[side].reduce((acc, { amp, rate }) => { for (let i = 0; i < amp.length; i++) acc += amp[i] / (rate[i] * rate[i]); return acc; }, 0) / total(side);
  const binsOf = () => {
    const edges = new Float64Array(bins + 1);
    for (let i = 1; i <= bins; i++) edges[i] = 1e-5 * Math.pow((14 / lamSlow) / 1e-5, (i - 1) / (bins - 1));
    const out = {};
    for (const side of ["hi", "lo"]) {
      const w = new Float64Array(bins);
      for (const { amp, rate } of parts[side]) {
        for (let n = 0; n < amp.length; n++) {
          const c = amp[n] / rate[n];
          let prev = 1;
          for (let i = 0; i < bins; i++) { const x = rate[n] * edges[i + 1]; const nx = x > 745 ? 0 : Math.exp(-x); w[i] += c * (prev - nx); prev = nx; if (nx === 0) break; }
        }
      }
      let tot = 0; for (const v of w) tot += v;
      for (let i = 0; i < bins; i++) w[i] /= tot;
      out[side] = w;
    }
    const s = Float64Array.from({ length: bins }, (_, i) => 0.5 * (edges[i] + edges[i + 1]));
    return { s, edges, hi: out.hi, lo: out.lo };
  };
  return { flux, total, mean, bins: binsOf, lamSlow };
}

// ---------------------------------------------------------------- the dynamic program with two bounds
/** The exact policy with unequal rewards on an evidence grid (lopsided.backward_induction), by direct convolution:
 * each step averages the value over the next evidence under drift +1 and -1, weighted by the belief; beyond |x| =
 * cap the value is the reward for deciding. The forced choice at the horizon puts both bounds at x*. Returns
 * { ts, lo, hi }; a bound that the grid can't place reads as +-Infinity, one at x* as x*. */
export function lopsidedProgram(cost, horizon, rp = 1, rm = 1, dt = 0.01, h = 0.02, cap = 5) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const half = cap + 8 * Math.sqrt(dt) + 1, m = Math.ceil(half / h), n = 2 * m + 1;
  const x = Float64Array.from({ length: n }, (_, i) => (i - m) * h);
  const r = Math.ceil((6 * Math.sqrt(dt)) / h);
  const kern = (mu) => { const k = new Float64Array(2 * r + 1); let s = 0; for (let j = -r; j <= r; j++) { k[j + r] = Math.exp(-((j * h - mu * dt) ** 2) / (2 * dt)); s += k[j + r]; } for (let j = 0; j < k.length; j++) k[j] /= s; return k; };
  const kUp = kern(1), kDn = kern(-1);
  const g = Float64Array.from(x, belief);
  const decide = Float64Array.from(x, (xi, i) => Math.max(rp * g[i], rm * (1 - g[i])));
  const outer = Uint8Array.from(x, (xi) => (Math.abs(xi) > cap ? 1 : 0));
  const xs = xStar(rp, rm);
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n);
  const lo = new Float64Array(steps + 1), hi = new Float64Array(steps + 1);
  lo[steps] = hi[steps] = xs;
  // indices outward from x*, out to cap, in each direction
  const up = [], dn = [];
  for (let i = 0; i < n; i++) if (!outer[i]) (x[i] > xs ? up : dn).push(i);
  dn.reverse();
  const edge = (idx) => {
    let j = -1;
    for (let q = 0; q < idx.length; q++) if (decide[idx[q]] - wait[idx[q]] > 0) { j = q; break; }
    if (j < 0) return Math.sign(x[idx[idx.length - 1]] - x[idx[0]]) * Infinity;
    if (j === 0) return xs;
    const a = idx[j - 1], b = idx[j], da = decide[a] - wait[a], db = decide[b] - wait[b];
    return x[a] - (da * (x[b] - x[a])) / (db - da);
  };
  for (let k = steps - 1; k >= 0; k--) {
    const ck = Math.min(cost(ts[k]), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      let su = 0, sd = 0;
      for (let j = -r; j <= r; j++) {
        const q = i + j, vj = q < 0 ? decide[0] : q >= n ? decide[n - 1] : v[q];
        su += kUp[j + r] * vj; sd += kDn[j + r] * vj;
      }
      wait[i] = g[i] * su + (1 - g[i]) * sd - ck;
    }
    hi[k] = edge(up); lo[k] = edge(dn);
    for (let i = 0; i < n; i++) v[i] = outer[i] ? decide[i] : Math.max(decide[i], wait[i]);
  }
  return { ts, lo, hi };
}

/** Least-squares fit of d(t) by A sin(omega t) + B cos(omega t) + C over the times where keep(t): amplitude and phase
 * (degrees) of A sin + B cos = amp sin(omega t + phase). */
export function fitSine(ts, d, omega, keep) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
  for (let k = 0; k < ts.length; k++) {
    if (!keep(ts[k])) continue;
    const row = [Math.sin(omega * ts[k]), Math.cos(omega * ts[k]), 1];
    for (let i = 0; i < 3; i++) { y[i] += row[i] * d[k]; for (let j = 0; j < 3; j++) M[i][j] += row[i] * row[j]; }
  }
  const A = M.map((row, i) => [...row, y[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i; for (let q = i + 1; q < 3; q++) if (Math.abs(A[q][i]) > Math.abs(A[p][i])) p = q;
    [A[i], A[p]] = [A[p], A[i]];
    for (let q = 0; q < 3; q++) { if (q === i) continue; const f = A[q][i] / A[i][i]; for (let c = i; c <= 3; c++) A[q][c] -= f * A[i][c]; }
  }
  const a = A[0][3] / A[0][0], b = A[1][3] / A[1][1];
  return { amp: Math.hypot(a, b), phase: (Math.atan2(b, a) * 180) / Math.PI };
}

/** The paper's sinusoid window for frequency omega: whole periods from t = 2, at least two and at least 6 time
 * units, with 6 to spare (experiments/lopsided.py). */
export function sineWindow(omega) {
  const period = (2 * Math.PI) / omega;
  const length = period * Math.max(2, Math.ceil(6 / period));
  return { length, horizon: 2 + length + 6 };
}

// ================================================================ the paper's Table 10 and its eight schedules
/** paper/generated/tab_unknown.tex, cell by cell as printed (tools/checks/ch11.mjs checks it against the file):
 * schedule, then the losses of the frozen-time, weighted, plug-in, and tuned-constant rules, points per 100 trials. */
export const TABLE10 = [
  ["Constant 0.02", "0.825", "0.056", "0.391", "0.049"],
  ["Constant 0.05", "0.547", "0.021", "0.863", "0.020"],
  ["Constant 0.1", "0.400", "0.011", "1.469", "0.028"],
  ["Constant 0.2", "0.191", "0.003", "3.287", "0.024"],
  ["Constant 0.4", "0.045", "0.000", "8.437", "0.009"],
  ["Flat 0.1, then rising 0.8 per unit time after $t = 0.5$", "0.888", "0.023", "1.808", "1.391"],
  ["Deadline at $t = 1$, cost 0.05", "0.928", "0.028", "0.730", "0.142"],
  ["Deadline at $t = 2$, cost 0.02", "0.770", "0.034", "0.398", "0.107"],
];
/** The same eight schedules as the book's presets (experiments/unknown_reliability.py), in the table's order. */
export const TABLE10_CHOICES = [
  { id: "constant", params: { c: 0.02 } }, { id: "constant", params: { c: 0.05 } }, { id: "constant", params: { c: 0.1 } },
  { id: "constant", params: { c: 0.2 } }, { id: "constant", params: { c: 0.4 } },
  { id: "rising", params: { at: 0.5, rate: 0.8 } },
  { id: "deadline", params: { at: 1, c: 0.05 } }, { id: "deadline", params: { at: 2, c: 0.02 } },
];
export const UNKNOWN = { n: 300, dt: 0.005, horizon: 10, a: 1, every: 0.02 };

/** The program and the three rules on one schedule, as the rules plate draws them: the program over [0, horizon]
 * (or to the deadline), and every curve at the times 0, 0.02, ... up to `view`, with the last time at or before it
 * kept (a deadline's forced choice). The rules are moved in by 0.5826 sqrt(dt), as the paper scores them. */
export function unknownRun(cost, deadline, view, { progress = null } = {}) {
  const { n, dt, horizon, a, every } = UNKNOWN;
  const H = deadline ?? horizon;
  const P = unknownProgram(cost, H, { n, dt, a, progress: progress ? (p) => progress(0.25 * p) : null });
  const step = Math.round(every / dt), last = Math.round(Math.min(view, H) / dt);
  const ks = []; for (let k = 0; k <= last; k += step) ks.push(k);
  if (ks[ks.length - 1] !== last) ks.push(last);
  const t = ks.map((k) => P.ts[k]);
  const exact = ks.map((k) => P.x[k]);
  const frozen = Array.from(shifted(frozenTime(cost, t, a), dt));
  const plug = Array.from(shifted(plugIn(cost, t, a), dt));
  const wraw = [];
  t.forEach((tt, i) => { wraw.push(weightedAt(cost, tt, a)); if (progress && i % 10 === 0) progress(0.25 + (0.75 * i) / t.length); });
  const weighted = wraw.map((u, i) => Math.max(u * Math.sqrt(t[i] + a) - OVERSHOOT * Math.sqrt(dt), 0));
  return { t, exact, frozen, weighted, plug, cost: t.map((x) => cost(x)) };
}

/** The sinusoid check with unequal rewards on the page's grid: the program at c0 and at c0 + eps sin(omega t), each
 * bound's move divided by eps, and the fits over the paper's window. */
export const SINE = { c0: 0.1, eps: 0.01, dt: 0.01, h: 0.02, cap: 5 };
export function sineRun(rm, omega, { dt = SINE.dt, h = SINE.h, every = 2 } = {}) {
  const { c0, eps, cap } = SINE;
  const { length, horizon } = sineWindow(omega);
  const flat = lopsidedProgram(() => c0, horizon, 1, rm, dt, h, cap);
  const wavy = lopsidedProgram((t) => c0 + eps * Math.sin(omega * t), horizon, 1, rm, dt, h, cap);
  const dh = Array.from(wavy.hi, (v, k) => (v - flat.hi[k]) / eps), dl = Array.from(wavy.lo, (v, k) => (v - flat.lo[k]) / eps);
  const keep = (t) => t > 2 && t < 2 + length;
  const fitH = fitSine(flat.ts, dh, omega, keep), fitL = fitSine(flat.ts, dl, omega, keep);
  const idx = []; for (let k = 0; k < flat.ts.length; k += every) if (flat.ts[k] >= 2 - 1e-9 && flat.ts[k] <= 2 + length + 1e-9) idx.push(k);
  return { omega, rm, length, horizon, t: idx.map((k) => flat.ts[k]), dh: idx.map((k) => dh[k]), dl: idx.map((k) => dl[k]), fitH, fitL,
    h0: flat.hi[Math.round(2 / dt)], l0: flat.lo[Math.round(2 / dt)] };
}

// ================================================================ what the plates say, computed once for the page and the checks
/** The clock plate's numbers: kappa = c(t)(t + a) over t from 0 to tMax (or to the deadline), 1001 times. */
export function clockInfo(cost, deadline, a = 1, tMax = 10) {
  const tEnd = deadline ?? tMax;
  const ts = Array.from({ length: 1001 }, (_, i) => (tEnd * i) / 1000), ks = ts.map((t) => kappaOf(cost(t), t, a));
  let kMin = Infinity, tMin = 0;
  ks.forEach((k, i) => { if (k < kMin) { kMin = k; tMin = ts[i]; } });
  return { ts, ks, k0: ks[0], kEnd: ks[ks.length - 1], tEnd, kMin, tMin, deadline };
}

/** The times the rules plate draws: all of them, or those before a deadline, where every rule's choice is forced. */
export const shownBefore = (t, deadline) => t.map((x, i) => i).filter((i) => deadline === null || deadline === undefined || t[i] < deadline - 1e-9);

/** The rules plate's numbers from a run, over the times it draws: each rule's gap to the program at t = 0 and its
 * largest gap, and every stretch of those times where the plug-in bound is 0 (the rule decides at once), as
 * [from, to] with to = null when the stretch reaches the last time drawn. */
export function rulesStats({ t, exact, frozen, weighted, plug }, deadline) {
  const idx = shownBefore(t, deadline);
  const gap = (arr) => Math.max(...idx.map((i) => Math.abs(arr[i] - exact[i])));
  const runs = []; let from = null;
  idx.forEach((i, k) => {
    if (plug[i] === 0) { if (from === null) from = t[i]; }
    else if (from !== null) { runs.push([from, t[idx[k - 1]]]); from = null; }
  });
  if (from !== null) runs.push([from, null]);
  return { frozenGap0: frozen[0] - exact[0], weightedGap0: weighted[0] - exact[0], frozenGapMax: gap(frozen), weightedGapMax: gap(weighted),
    plugZero: runs, lastShown: t[idx[idx.length - 1]] };
}
