// Chapter 2's model: the belief and its derivatives, the generator of Y = |X|, the normal distribution function,
// the evidence paths (exact, filtered, and reflected), and the Palmer time unit. Pure: no page. The plates in
// ch02.js and the checks in tools/checks/ch02.mjs both use these functions.

// ---------------------------------------------------------------- the belief and the generator
/** The posterior probability that H = +1 after evidence x, in the paper's units. */
export const g = (x) => 1 / (1 + Math.exp(-2 * x));
/** g'(y) = 1 / (2 cosh^2 y), and g''(y) = -tanh(y) / cosh^2 y. */
export const g1 = (y) => 1 / (2 * Math.cosh(y) ** 2);
export const g2 = (y) => -Math.tanh(y) / Math.cosh(y) ** 2;
/** The evidence at which the belief is p: half the log odds. */
export const halfLogOdds = (p) => 0.5 * Math.log(p / (1 - p));
/** The generator of Y applied to f, given f'(y) and f''(y): (1/2) f'' + tanh(y) f'. */
export const Lop = (y, f1, f2) => 0.5 * f2 + Math.tanh(y) * f1;
/** E_y of the first time Y reaches a level b >= y: b tanh b - y tanh y. */
export const meanHit = (y, b) => b * Math.tanh(b) - y * Math.tanh(y);

/** Test functions for the cosh^2 identity, each with its first and second derivatives. */
export const TESTS = [
  { id: "sq", label: "y²", f: (y) => y * y, f1: (y) => 2 * y, f2: () => 2 },
  { id: "sin", label: "sin 2y", f: (y) => Math.sin(2 * y), f1: (y) => 2 * Math.cos(2 * y), f2: (y) => -4 * Math.sin(2 * y) },
  { id: "exp", label: "e^(−y)", f: (y) => Math.exp(-y), f1: (y) => -Math.exp(-y), f2: (y) => Math.exp(-y) },
  { id: "g", label: "g(y)", f: g, f1: g1, f2: g2 },
];

// ---------------------------------------------------------------- the normal distribution
const SQPI = Math.sqrt(Math.PI);
/** erfc(x): a positive series for erf below 3 (no cancellation), a continued fraction at and above 3. */
export function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) {
    // erf(x) = (2/sqrt(pi)) e^{-x^2} sum_n (2x^2)^n x / (1 * 3 * ... * (2n + 1))
    let term = x, sum = x;
    for (let n = 1; n < 200; n++) { term *= (2 * x * x) / (2 * n + 1); sum += term; if (term < 1e-17 * sum) break; }
    return 1 - (2 / SQPI) * Math.exp(-x * x) * sum;
  }
  // erfc(x) = e^{-x^2} / sqrt(pi) / (x + (1/2)/(x + 1/(x + (3/2)/(x + ...))))
  let t = x;
  for (let k = 80; k >= 1; k--) t = x + k / 2 / t;
  return Math.exp(-x * x) / SQPI / t;
}
/** The standard normal distribution function. */
export const Phi = (z) => 0.5 * erfc(-z / Math.SQRT2);
/** The normal density with mean m and variance v, at x. */
export const normal = (x, m, v) => Math.exp(-((x - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);
/** E|N(m, s^2)|. */
export const absMean = (m, s) => s * Math.sqrt(2 / Math.PI) * Math.exp(-(m * m) / (2 * s * s)) + m * (1 - 2 * Phi(-m / s));

/** The drift of Y measured over a time h from y: (E_y Y_h - y) / h. From the decision maker's view, X started at y
 * is y + H t + W_t with H = +1 with probability g(y), so E_y |X_h| is a mixture of two normal absolute means. */
export function foldDrift(y, h) {
  const p = g(y), s = Math.sqrt(h);
  return (p * absMean(y + h, s) + (1 - p) * absMean(y - h, s) - y) / h;
}

/** P(H = +1 | X_t in [a, b]) for trials with H = +1 or -1 equally likely and X_t = H t + W_t. */
export function binShare(a, b, t) {
  const s = Math.sqrt(t);
  const up = Phi((b - t) / s) - Phi((a - t) / s), dn = Phi((b + t) / s) - Phi((a + t) / s);
  return up / (up + dn);
}
/** The chance of being right when choosing the sign of X_t: Phi(sqrt t), the same as E g(|X_t|). */
export const rightAt = (t) => Phi(Math.sqrt(t));

// ---------------------------------------------------------------- the Palmer time unit
/** The drift per second per unit of coherence for the mean observer the paper takes from Palmer, Huk, and Shadlen
 * (2005): 21 x 0.064 per second at 6.4% coherence, with noise variance 1 per second. */
export const PALMER_K = 21;
/** One time unit, sigma^2 / mu^2, in seconds, at coherence coh (a fraction): 1 / (21 coh)^2. */
export const unitSeconds = (coh) => 1 / (PALMER_K * coh) ** 2;

// ---------------------------------------------------------------- paths
/** Brownian increments: n steps of size dt, as a Float64Array of n normals times sqrt(dt). */
export function increments(R, n, dt) {
  const s = Math.sqrt(dt), out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = s * R.normal();
  return out;
}
/** The evidence in the paper's units, x0 + H t + W_t, at n + 1 grid times (exact at the grid times). */
export function evidence(H, x0, dW, dt) {
  const x = new Float64Array(dW.length + 1);
  x[0] = x0;
  for (let i = 0; i < dW.length; i++) x[i + 1] = x[i] + H * dt + dW[i];
  return x;
}
/** The filtered diffusion dX = tanh(X) dt + dW-bar from x0, by Euler steps, driven by the increments dW. */
export function filtered(x0, dW, dt) {
  const x = new Float64Array(dW.length + 1);
  x[0] = x0;
  for (let i = 0; i < dW.length; i++) x[i + 1] = x[i] + Math.tanh(x[i]) * dt + dW[i];
  return x;
}
/** Tanaka's formula on a grid: l_{k+1} = l_k + |x_{k+1}| - |x_k| - sign(x_k)(x_{k+1} - x_k), which is >= 0 and
 * is nonzero only on a step where x changes sign. */
export function tanaka(x) {
  const l = new Float64Array(x.length);
  for (let i = 0; i < x.length - 1; i++) l[i + 1] = l[i] + Math.abs(x[i + 1]) - Math.abs(x[i]) - Math.sign(x[i]) * (x[i + 1] - x[i]);
  return l;
}
/** The reflected equation dY = tanh(Y) dt + dB + dl from y0, by Euler steps and Skorokhod's reflection on the grid:
 * U_{k+1} = U_k + tanh(Y_k) dt + dB_k, l_{k+1} = max(l_k, -U_{k+1}), Y = U + l, which is
 * Y_{k+1} = max(0, Y_k + tanh(Y_k) dt + dB_k). */
export function reflected(y0, dB, dt) {
  const n = dB.length, y = new Float64Array(n + 1), u = new Float64Array(n + 1), l = new Float64Array(n + 1);
  y[0] = y0; u[0] = y0;
  for (let i = 0; i < n; i++) {
    u[i + 1] = u[i] + Math.tanh(y[i]) * dt + dB[i];
    l[i + 1] = Math.max(l[i], -u[i + 1]);
    y[i + 1] = u[i + 1] + l[i + 1];
  }
  return { y, u, l };
}
/** Skorokhod's map on a grid: the reflection at 0 of a path u, Y = u + max(0, max_{s <= t} -u_s). */
export function skorokhod(u) {
  const y = new Float64Array(u.length);
  let m = 0;
  for (let i = 0; i < u.length; i++) { m = Math.max(m, -u[i]); y[i] = u[i] + m; }
  return y;
}
/** Picard iterates for the reflected equation on the same grid: Y^0 = y0, Y^{n+1} = Skorokhod(y0 + int tanh(Y^n) + B).
 * The fixed point is reflected()'s path. Returns the iterates 0..iters. */
export function picard(y0, dB, dt, iters) {
  const n = dB.length, out = [new Float64Array(n + 1).fill(y0)];
  for (let k = 0; k < iters; k++) {
    const prev = out[out.length - 1], u = new Float64Array(n + 1);
    u[0] = y0;
    for (let i = 0; i < n; i++) u[i + 1] = u[i] + Math.tanh(prev[i]) * dt + dB[i];
    out.push(skorokhod(u));
  }
  return out;
}
/** The largest absolute difference between two paths. */
export const supDist = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

/** n trials with H = +1 or -1 equally likely: the evidence at time t, X_t = H t + sqrt(t) Z, and over the next h
 * time units, X_{t+h} - X_t = H h + sqrt(h) Z'. Exact draws, no time steps. */
export function trials(R, t, n, h = 1) {
  const H = new Int8Array(n), X = new Float64Array(n), dX = new Float64Array(n);
  const st = Math.sqrt(t), sh = Math.sqrt(h);
  for (let i = 0; i < n; i++) {
    const s = R.next() < 0.5 ? 1 : -1;
    H[i] = s; X[i] = s * t + st * R.normal(); dX[i] = s * h + sh * R.normal();
  }
  return { H, X, dX };
}

/** Bins of width w over [lo, hi]: for each, the count, the share with H = +1 and its standard error, and the mean of
 * the next increment and its standard error. */
export function bins(tr, lo, hi, w) {
  const nb = Math.round((hi - lo) / w), out = [];
  for (let k = 0; k < nb; k++) out.push({ a: lo + k * w, b: lo + (k + 1) * w, n: 0, up: 0, s: 0, q: 0 });
  for (let i = 0; i < tr.X.length; i++) {
    const k = Math.floor((tr.X[i] - lo) / w);
    if (k < 0 || k >= nb) continue;
    const o = out[k]; o.n++; if (tr.H[i] > 0) o.up++; o.s += tr.dX[i]; o.q += tr.dX[i] ** 2;
  }
  for (const o of out) {
    o.share = o.n ? o.up / o.n : NaN;
    o.shareSE = o.n ? Math.sqrt(Math.max(o.share * (1 - o.share), 0.25 / o.n) / o.n) : NaN;
    o.mean = o.n ? o.s / o.n : NaN;
    o.meanSE = o.n > 1 ? Math.sqrt(Math.max(0, o.q / o.n - o.mean ** 2) / (o.n - 1)) : NaN;
  }
  return out;
}

/** The innovation computed from the evidence alone: W-bar_t = X_t - int_0^t tanh(X_s) ds, by left sums on the grid. */
export function innovation(x, dt) {
  const w = new Float64Array(x.length);
  let drift = 0;
  for (let i = 1; i < x.length; i++) { drift += Math.tanh(x[i - 1]) * dt; w[i] = x[i] - x[0] - drift; }
  return w;
}

// ---------------------------------------------------------------- what the plates draw and print
/** A path stored at steps of DT, read at time tp by linear interpolation between its steps. */
export function pathAt(xp, DT, tp) {
  const u = tp / DT, k = Math.min(xp.length - 2, Math.max(0, Math.floor(u))), f = u - k;
  return xp[k] * (1 - f) + xp[k + 1] * f;
}
/** The units plate's raw path: Z(t) = (sigma^2/mu) x(mu^2 t / sigma^2) at the raw times ts, x read by pathAt. */
export const rawSamples = (xp, DT, mu, sigma, ts) => ts.map((t) => ((sigma * sigma) / mu) * pathAt(xp, DT, ((mu * mu) / (sigma * sigma)) * t));
/** A vertical range for the units plate: at least -2 to 6, widened to hold every value drawn, so nothing is clipped. */
export function unitsRange(values) {
  const fin = values.filter(Number.isFinite);
  const lo = Math.min(-2, ...fin), hi = Math.max(6, ...fin);
  const pad = 0.04 * (hi - lo);
  return [lo < -2 ? lo - pad : -2, hi > 6 ? hi + pad : 6];
}

/** The largest standardized miss over bins with at least 20 trials. For shares, the miss is measured in the
 * binomial standard error of the bin's exact share, sqrt(p(1 - p)/n); for the mean change over the next time unit,
 * in the bin's sample standard error. Returns the miss and how many bins entered. */
export function largestMiss(bs, t, kind) {
  let z = 0, k = 0;
  for (const o of bs) {
    if (o.n < 20) continue;
    k++;
    const p = binShare(o.a, o.b, t);
    const miss = kind === "share" ? Math.abs(o.share - p) / Math.sqrt((p * (1 - p)) / o.n) : Math.abs(o.mean - (2 * p - 1)) / o.meanSE;
    if (Number.isFinite(miss)) z = Math.max(z, miss);
  }
  return { z, k };
}

/** The innovation's statistics over trials from the true model (H = +1 or -1, then X = H t + W), computed from
 * the evidence alone on steps of dt to time T: the variance of W-bar_T, and the correlation of W-bar_T - W-bar_{T/2}
 * with tanh X_{T/2}. add(R, count) runs count more trials; the plate calls it in slices, the checks in one go. */
export function innovationRun(T = 2, dt = 0.01, keep = 40) {
  const n = Math.round(T / dt), show = [];
  const acc = { k: 0, s1: 0, s2: 0, a: 0, b: 0, ab: 0, aa: 0, bb: 0 };
  return {
    T, n, show, acc,
    ts: Array.from({ length: n + 1 }, (_, i) => i * dt),
    add(R, count) {
      for (let j = 0; j < count; j++) {
        const H = R.next() < 0.5 ? 1 : -1;
        const x = evidence(H, 0, increments(R, n, dt), dt), w = innovation(x, dt);
        if (acc.k < keep) show.push(w);
        const end = w[n], inc = w[n] - w[n / 2], th = Math.tanh(x[n / 2]);
        acc.s1 += end; acc.s2 += end * end; acc.a += inc; acc.b += th; acc.ab += inc * th; acc.aa += inc * inc; acc.bb += th * th;
        acc.k++;
      }
    },
    summary() {
      const { k: K, s1, s2, a, b, ab, aa, bb } = acc, m = s1 / K, v = s2 / K - m * m;
      const cov = ab / K - (a / K) * (b / K), sa = Math.sqrt(aa / K - (a / K) ** 2), sb = Math.sqrt(bb / K - (b / K) ** 2);
      return { v, vSE: v * Math.sqrt(2 / (K - 1)), r: cov / (sa * sb), rSE: 1 / Math.sqrt(K), K };
    },
  };
}

/** Steps on which the sign of x on the grid changes, counting a step away from 0 (sign 0) as a change; these are
 * the steps on which the grid's Tanaka increment can be positive. */
export function signSteps(x) {
  let c = 0;
  for (let i = 0; i < x.length - 1; i++) if (Math.sign(x[i + 1]) !== Math.sign(x[i])) c++;
  return c;
}
