// The kernel of chapter 6 in the paper's units, with no DOM: the constant-cost bound and its slope, the
// survival flux n(s) and the kernel w(s) from the series (16), the closed-form Laplace transform of Lemma 6(c),
// the transfer function W(omega) = w~(-i omega), the mean look-ahead, the chance P_x(tau_0 > s) of still being
// undecided, the start law pi_0(y) = 4 c0 cosh^2 y, and the first-order response beta(t) = B'(c0) (w * gamma)(t).
// tools/check_book.mjs holds these to the paper's generated numbers and to each other.

import { boundForCost } from "./model.js?v=3012045bec";

/** The constant-cost bound: the solver's table value, polished by Newton steps on sinh(2b) + 2b = 1/c to machine
 * precision, since the identities below (pi_0 integrating to 1, the transform at 0) amplify any error in b. */
export function B(c) {
  if (!(c > 0)) return Infinity;
  if (!Number.isFinite(c)) return 0;
  let b = boundForCost(c);
  for (let i = 0; i < 4; i++) b -= (Math.sinh(2 * b) + 2 * b - 1 / c) / (2 * Math.cosh(2 * b) + 2);
  return b;
}

/** B'(c) = -1 / (4 c^2 cosh^2 B(c)), from differentiating sinh(2b) + 2b = 1/c. */
export function Bprime(c) {
  const b = B(c);
  return -1 / (4 * c * c * Math.cosh(b) ** 2);
}

export const kappa = (j, b) => ((j + 0.5) * Math.PI) / b;

/** Integral of the flux: tanh b + b sech^2 b, which is 1 / (2 c0 cosh^2 b) at b = B(c0). */
export const fluxTotal = (b) => Math.tanh(b) + b / Math.cosh(b) ** 2;

/** Terms of the series needed for every term past them to be below e^-40 at time s. */
function termsFor(s, b, cap = 20000) {
  if (!(s > 0)) return cap;
  const k = Math.sqrt(80 / s);
  return Math.min(cap, Math.ceil((k * b) / Math.PI) + 4);
}

/** n(s) = (2/b) sum_j kappa_j^2 / (1 + kappa_j^2) e^{-(1 + kappa_j^2) s / 2}, s > 0. */
export function flux(s, b) {
  const J = termsFor(s, b);
  let acc = 0;
  for (let j = 0; j < J; j++) {
    const k2 = kappa(j, b) ** 2;
    const x = ((1 + k2) * s) / 2;
    if (x > 745) break;
    acc += (k2 / (1 + k2)) * Math.exp(-x);
  }
  return (2 / b) * acc;
}

/** The kernel w(s) = n(s) / int n, for the constant cost c0. */
export function kernelAt(s, c0) {
  const b = B(c0);
  return flux(s, b) / fluxTotal(b);
}

/** The kernel's weight on [s1, s2], integrated term by term (exact up to the tail of the series). */
export function kernelMass(s1, s2, b, terms = 6000) {
  let acc = 0;
  for (let j = 0; j < terms; j++) {
    const k2 = kappa(j, b) ** 2;
    const a = (1 + k2) / 2;
    const e1 = a * s1 > 745 ? 0 : Math.exp(-a * s1);
    const e2 = a * s2 > 745 ? 0 : Math.exp(-a * s2);
    if (e1 === 0) break;
    acc += (k2 / (1 + k2)) * (e1 - e2) / a;
  }
  return ((2 / b) * acc) / fluxTotal(b);
}

/** Bins of the kernel for quadrature: edges on a log scale from 1e-5 to where the slowest term has died, and the
 * exact weight in each bin, summing to 1 less the tail past the last edge (below 1e-12). */
const BINS = new Map();
export function kernelBins(c0, bins = 320) {
  const key = c0.toPrecision(10) + ":" + bins;
  if (BINS.has(key)) return BINS.get(key);
  const b = B(c0);
  const slow = (1 + kappa(0, b) ** 2) / 2;
  const top = 28 / slow, first = 1e-5;
  const edges = new Float64Array(bins + 1);
  for (let i = 1; i <= bins; i++) edges[i] = first * Math.pow(top / first, (i - 1) / (bins - 1));
  const w = new Float64Array(bins), mid = new Float64Array(bins);
  // the cumulative weight past each edge, from the series, differenced
  const tailPast = (s) => {
    let acc = 0;
    for (let j = 0; j < 6000; j++) {
      const k2 = kappa(j, b) ** 2;
      const a = (1 + k2) / 2;
      const e = a * s > 745 ? 0 : Math.exp(-a * s);
      if (e === 0 && s > 0) break;
      acc += (k2 / (1 + k2)) * e / a;
    }
    return ((2 / b) * acc) / fluxTotal(b);
  };
  let prev = 1; // all the weight lies past s = 0
  for (let i = 0; i < bins; i++) {
    const next = tailPast(edges[i + 1]);
    w[i] = prev - next;
    mid[i] = 0.5 * (edges[i] + edges[i + 1]);
    prev = next;
  }
  const out = { edges, mid, w, b };
  BINS.set(key, out);
  return out;
}

/** (w * gamma)(t) = int_0^inf w(s) gamma(t + s) ds, by the bins above. */
export function lookAhead(gamma, t, c0) {
  const { mid, w } = kernelBins(c0);
  let acc = 0;
  for (let i = 0; i < w.length; i++) acc += w[i] * gamma(t + mid[i]);
  return acc;
}

/** The first-order response beta(t) = B'(c0) (w * gamma)(t) at each time in ts. */
export function firstOrder(gamma, ts, c0) {
  const k = Bprime(c0);
  return Float64Array.from(ts, (t) => k * lookAhead(gamma, t, c0));
}

/** The per-moment response B'(c0) gamma(t): all the weight at s = 0. */
export function perMomentResponse(gamma, ts, c0) {
  const k = Bprime(c0);
  return Float64Array.from(ts, (t) => k * gamma(t));
}

// ---- the Laplace transform and the transfer function ----------------------------------------------------------

const cx = (re, im = 0) => ({ re, im });
const add = (a, b) => cx(a.re + b.re, a.im + b.im);
const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const csqrt = (a) => { const m = Math.hypot(a.re, a.im); return cx(Math.sqrt((m + a.re) / 2), (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(m - a.re, 0) / 2)); };
// tanh(z) = (1 - e^{-2z}) / (1 + e^{-2z}), stable for Re z >= 0
const ctanh = (z) => {
  const e = Math.exp(-2 * z.re);
  const q = cx(e * Math.cos(-2 * z.im), e * Math.sin(-2 * z.im));
  return div(sub(cx(1), q), add(cx(1), q));
};

/** w~(lambda) = 2 c0 cosh^2 b0 [r tanh(r b0) - tanh b0] / lambda, r = sqrt(2 lambda + 1), for complex lambda
 * with Re(2 lambda + 1) > 0 (lambda = 0 gives 1). */
export function transformC(lam, c0) {
  const b = B(c0);
  if (lam.re === 0 && lam.im === 0) return cx(1);
  const r = csqrt(cx(2 * lam.re + 1, 2 * lam.im));
  const top = sub(mul(r, ctanh(mul(r, cx(b)))), cx(Math.tanh(b)));
  return mul(cx(2 * c0 * Math.cosh(b) ** 2), div(top, lam));
}

export const transform = (lambda, c0) => transformC(cx(lambda), c0).re;

/** The same transform from the series, term by term: (2 c0 cosh^2 b)(2/b) sum kappa^2/(1+kappa^2) / (lambda + (1+kappa^2)/2). */
export function transformSeries(lambda, c0, terms = 200000) {
  const b = B(c0);
  let acc = 0;
  for (let j = 0; j < terms; j++) {
    const k2 = kappa(j, b) ** 2;
    acc += (k2 / (1 + k2)) / (lambda + (1 + k2) / 2);
  }
  return ((2 / b) * acc) / fluxTotal(b);
}

/** W(omega) = w~(-i omega): for gamma = Re(G e^{i omega t}), w * gamma = Re(W G e^{i omega t}). Gain |W| and lead
 * arg W in degrees. */
export function transfer(c0, omega) {
  const W = transformC(cx(0, -omega), c0);
  return { gain: Math.hypot(W.re, W.im), lead: (Math.atan2(W.im, W.re) * 180) / Math.PI, re: W.re, im: W.im };
}

/** The mean look-ahead m(c0) = int s w(s) ds, from the series: sum (2/b) kappa^2/(1+kappa^2) (2/(1+kappa^2))^2,
 * normalized, with the tail of the sum (terms like 1/kappa^4) added in closed form. */
export function meanLookAhead(c0, terms = 4000) {
  const b = B(c0);
  let acc = 0;
  for (let j = 0; j < terms; j++) {
    const k2 = kappa(j, b) ** 2;
    acc += (k2 / (1 + k2)) * (4 / (1 + k2) ** 2);
  }
  // tail: kappa_j^2 ~ ((j + 1/2) pi / b)^2, terms ~ 4 b^4 / (pi^4 (j + 1/2)^4); sum over j >= J ~ 4 b^4 / (3 pi^4 J^3)
  acc += (4 * b ** 4) / (3 * Math.PI ** 4 * terms ** 3);
  return ((2 / b) * acc) / fluxTotal(b);
}

/** Mean decision time from 0 at a constant cost: b tanh b. */
export const meanDecisionTime = (c0) => { const b = B(c0); return b * Math.tanh(b); };

// ---- still undecided ---------------------------------------------------------------------------------------

/** P_x(tau_0 > s) = e^{-s/2} / cosh x * sum_j a_j e^{-kappa_j^2 s / 2} cos(kappa_j x), with
 * a_j = 2 kappa_j cosh b (-1)^j / (b (1 + kappa_j^2)): the h-transform of a Brownian motion killed at +-b. */
export function survival(x, s, b) {
  if (Math.abs(x) >= b) return 0;
  const J = termsFor(s, b, 4000);
  let acc = 0;
  for (let j = 0; j < J; j++) {
    const k = kappa(j, b);
    const e = (k * k * s) / 2;
    if (e > 745) break;
    const a = (2 * k * Math.cosh(b) * (j % 2 ? -1 : 1)) / (b * (1 + k * k));
    acc += a * Math.exp(-e) * Math.cos(k * x);
  }
  return Math.min(1, Math.max(0, (Math.exp(-s / 2) / Math.cosh(x)) * acc));
}

// ---- the start law pi_0 and decisions from it ------------------------------------------------------------------

/** pi_0(y) = 4 c0 cosh^2 y on [0, B(c0)]. */
export const pi0 = (y, c0) => 4 * c0 * Math.cosh(y) ** 2;

/** Its distribution function, c0 (2y + sinh 2y), which reaches 1 at the bound. */
export const pi0Cdf = (y, c0) => c0 * (2 * y + Math.sinh(2 * y));

/** A start drawn from pi_0 by inverting its distribution function at u in (0, 1). */
export function pi0Quantile(u, c0) {
  const b = B(c0);
  let lo = 0, hi = b;
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    if (pi0Cdf(m, c0) < u) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

/** A seeded generator (mulberry32) and standard normals from it (Box-Muller). */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0; while (u === 0) u = next();
    const v = next(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { next, normal };
}

export const OVERSHOOT = 0.5826;

/** One decision: X starts at y and moves by tanh(X) dt + sqrt(dt) Z until |X| reaches the bound, checked every dt
 * against the bound shifted in by 0.5826 sqrt(dt) (the correction for checking every dt). Returns the time and,
 * if asked, the path every `keep` steps. */
export function decide(y, b, R, dt = 0.0025, maxT = 60, keep = 0) {
  const edge = b - OVERSHOOT * Math.sqrt(dt);
  const sd = Math.sqrt(dt);
  let x = y, t = 0, k = 0;
  const path = keep ? [[0, y]] : null;
  while (Math.abs(x) < edge && t < maxT) {
    x += Math.tanh(x) * dt + sd * R.normal();
    t += dt; k++;
    if (keep && k % keep === 0) path.push([t, x]);
  }
  if (keep) path.push([t, Math.sign(x) * b]);
  return { t, path };
}

/** n decision times from starts drawn from pi_0, with the same draws for the same seed. */
export function sampleDecisionTimes(c0, n, seed = 1, dt = 0.0025) {
  const b = B(c0);
  const R = rng(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = decide(pi0Quantile(R.next(), c0), b, R, dt).t;
  return out;
}
