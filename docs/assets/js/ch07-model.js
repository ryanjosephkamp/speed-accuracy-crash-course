// Chapter 7's model, with no DOM: the kernel's transform as a sum of simple terms, the scans for the largest mean
// look-ahead and the largest lead, the closed forms behind the second-order loss (the flat bound's reward, the
// waiting value at a constant cost, the time spent past the bound), and the forward computation that scores a rule
// and gives its decision times, for the losses on the reader's schedule. tools/checks/ch07.mjs holds these to the
// paper's generated numbers and to model.js.
import * as K from "./kernel.js?v=37a0cf8296";
import { boundForCost, toDiscrete, belief } from "./model.js?v=37a0cf8296";

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

/** The running integral int_0^S w(s) e^{i omega s} ds at each edge of the kernel's bins: a curve in the complex
 * plane from 0 to w~(-i omega). Exact, term by term: with the series, the integral is the closed form less the tail
 * sum_j a_j e^{-(alpha_j - i omega) S} / (alpha_j - i omega), whose terms fall like e^{-alpha_j S}. */
export function runningTransform(c0, omega) {
  const { edges } = K.kernelBins(c0);
  const b = K.B(c0), F = K.fluxTotal(b);
  const W = omega === 0 ? { re: 1, im: 0 } : K.transfer(c0, omega);
  const pts = [{ s: 0, re: 0, im: 0 }];
  for (let i = 1; i < edges.length; i++) {
    const S = edges[i];
    let tr = 0, ti = 0;
    for (let j = 0; j < 200000; j++) {
      const k2 = K.kappa(j, b) ** 2, al = (1 + k2) / 2;
      if (al * S > 40) break;
      const a = ((2 / b) * (k2 / (1 + k2))) / F, d = al * al + omega * omega, e = Math.exp(-al * S);
      // a (alpha + i omega) / d times e^{-alpha S} (cos omega S + i sin omega S)
      const pr = (a * al) / d, pi = (a * omega) / d, c = Math.cos(omega * S), s = Math.sin(omega * S);
      tr += e * (pr * c - pi * s); ti += e * (pr * s + pi * c);
    }
    pts.push({ s: S, re: W.re - tr, im: W.im - ti });
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

/** The mean of 400 decisions from each of six starts, 0 to 0.9 b0, seeded: each checked every dt against the bound
 * moved in by 0.5826 sqrt(dt), with dt = 0.0025 or less, so that the shift is at most a quarter of the distance from
 * the nearest start to the bound (0.1 b0); at c0 = 0.5 that takes dt of about 0.0004. */
export function sampleStarts(c0, seed = 2026, n = 400) {
  const b = K.B(c0), R = K.rng(seed + 31 + Math.round(c0 * 1000));
  const dt = Math.min(0.0025, ((0.025 * b) / K.OVERSHOOT) ** 2);
  const starts = [0, 0.2, 0.4, 0.6, 0.8, 0.9].map((u) => {
    const y = u * b;
    let a = 0, q = 0;
    for (let i = 0; i < n; i++) { const t = K.decide(y, b, R, dt).t; a += t; q += t * t; }
    a /= n;
    return { y, mean: a, se: Math.sqrt(Math.max(0, q / n - a * a) / n) };
  });
  return { dt, starts };
}

/** The largest gap between a sampled mean and E_y tau_0, in standard errors (NaN if a start's runs didn't vary). */
export function worstGap(smp, b0) {
  let w = 0;
  for (const p of smp.starts) { if (!(p.se > 0)) return NaN; w = Math.max(w, Math.abs(p.mean - meanTimeFrom(p.y, b0)) / p.se); }
  return w;
}

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

// ---- the program, and scoring a policy with its decision times -------------------------------------------------------

/** The program on the evidence grid, model.js's exactPolicy step for step, keeping what it decides at every node with
 * x >= 0 (the problem is symmetric): stop[k (m + 1) + i] is 1 where deciding beats waiting at time ts[k] and node
 * x = i h. Also its value at the start, and two readings of its bound: exactPolicy's (the first stopping node past
 * 0, interpolated, and 0 when that node is the first one, as the paper's backward_induction_x reports it) and one
 * that interpolates between the center and the first node when the center still waits. At a high cost the first
 * node can stop while the center waits; the stop set keeps that choice, and the policy is scored from it. */
export function gridProgram(cost, horizon, dt = 0.01, h = 0.02, cap = 5) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap);
  const g = Float64Array.from(x, (xi) => belief(xi));
  const decide = Float64Array.from(g, (gi) => Math.max(gi, 1 - gi));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n);
  const bounds = new Float64Array(steps + 1), best = new Float64Array(steps + 1);
  const stop = new Uint8Array((steps + 1) * (m + 1));
  stop.fill(1, steps * (m + 1));
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
    let b = Infinity, bb = Infinity;
    for (let i = m + 1; i < n; i++) {
      const d = decide[i] - wait[i];
      if (d > 0) {
        const dp = decide[i - 1] - wait[i - 1];
        const lin = x[i - 1] - (dp * (x[i] - x[i - 1])) / (d - dp);
        b = i === m + 1 ? 0 : lin;
        bb = i === m + 1 && dp >= 0 ? 0 : lin;
        break;
      }
    }
    bounds[k] = b > cap ? Infinity : b;
    best[k] = bb > cap ? Infinity : bb;
    for (let i = m; i < n; i++) stop[k * (m + 1) + (i - m)] = decide[i] >= wait[i] ? 1 : 0;
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
  }
  return { ts, bounds, best, stop, m, value: v[m], dt };
}

function grid(dt, h, cap) {
  const half = cap + 8 * Math.sqrt(dt) + 1;
  const m = Math.ceil(half / h);
  const n = 2 * m + 1;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = (i - m) * h;
  const r = Math.ceil((6 * Math.sqrt(dt)) / h);
  const kernel = (mu) => {
    const k = new Float64Array(2 * r + 1);
    let sum = 0;
    for (let j = -r; j <= r; j++) { const v = Math.exp(-((j * h - mu * dt) ** 2) / (2 * dt)); k[j + r] = v; sum += v; }
    for (let j = 0; j < k.length; j++) k[j] /= sum;
    return k;
  };
  return { x, m, n, r, kUp: kernel(1), kDown: kernel(-1) };
}

/** The expected reward of a policy with drift +1 (the problem is symmetric), pushed forward on the evidence grid with
 * no sampling, and f[k], the chance of deciding at time ts[k] (a trial still undecided at the end is counted at the
 * last time). The policy is either evidence bounds { bounds } checked every dt, absorbed as model.js's score absorbs
 * them (a fraction of the cell around each node), or the program's own stop set { stop, m }. */
export function forwardPolicy(policy, ts, cost, h = 0.02, cap = 5) {
  const dt = ts[1] - ts[0];
  const f = new Float64Array(ts.length);
  const { x, m, n, r, kUp } = grid(dt, h, cap);
  const xb = policy.bounds, st = policy.stop, M1 = m + 1;
  if (xb ? !(Math.min(xb[0], cap) > 0) : st[0] === 1) { f[0] = 1; return { p: 0.5, rt: 0, paid: 0, reward: 0.5, f }; }
  let p = new Float64Array(n), q = new Float64Array(n);
  p[m] = 1;
  let correct = 0, rt = 0, paid = 0, alive = 1, lo = m, hi = m;
  for (let k = 1; k < ts.length; k++) {
    paid += alive * Math.min(cost(ts[k - 1]), 1e9) * dt;
    const b = xb ? Math.min(xb[k], cap) : 0, base = k * M1;
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
      let up, dn;
      if (xb) {
        up = Math.min(Math.max((x[i] + h / 2 - b) / h, 0), 1);
        dn = Math.min(Math.max((-b - (x[i] - h / 2)) / h, 0), 1);
      } else {
        const s = st[base + Math.abs(i - m)];
        up = i > m ? s : i === m ? 0.5 * s : 0;
        dn = i < m ? s : i === m ? 0.5 * s : 0;
      }
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

/** model.js's score for evidence bounds, with the decision times. */
export const forward = (xb, ts, cost, h = 0.02, cap = 5) => forwardPolicy({ bounds: xb }, ts, cost, h, cap);

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
 * policy, the per-moment rule, and the first-order bound b0 + eps beta(t) (clipped at 0), each scored by the forward
 * computation, with each rule's loss and Conjecture 11's prediction for it. The rules' bounds are evidence bounds
 * checked every dt (moved in by the monitoring shift, as the solver's worker does); the program is scored from its
 * own stop set, so the reference is the program's own value and no rule can score above it on the grid. The grid's
 * resolution is the per-moment rule's loss at the constant cost c0: 0 in the continuous problem, so all of it is
 * the grid's. */
export function lossRun(cost, EPS, { horizon = LOSS_HORIZON, view = 2.5, dt = 0.01, h = 0.02, every = 2, progress = null } = {}) {
  const c0 = cost(0);
  const gamma = (t) => cost(t) - c0;
  const flat = gridProgram(() => c0, horizon, dt, h);
  const ts = flat.ts, N = ts.length;
  const flatPm = Float64Array.from(ts, () => toDiscrete(boundForCost(c0), dt));
  const floor = Math.max(0, flat.value - forward(flatPm, ts, () => c0, h).reward);
  const beta = K.firstOrder(gamma, Array.from(ts), c0);
  const b0 = K.B(c0);
  const keepW = [], keepC = [];
  for (let k = 0; k < N; k += every) { if (ts[k] <= view + 1e-9) keepW.push(k); }
  for (let k = 0; k < N; k += ts[k] < 1 ? 1 : 5) keepC.push(k);
  if (keepC[keepC.length - 1] !== N - 1) keepC.push(N - 1);
  const runs = [];
  for (const eps of EPS) {
    const ce = (t) => c0 + eps * gamma(t);
    const dp = gridProgram(ce, horizon, dt, h);
    const pm = Float64Array.from(ts, (t) => toDiscrete(boundForCost(ce(t)), dt));
    const fo = Float64Array.from(ts, (t, k) => toDiscrete(b0 + eps * beta[k], dt));
    const Rdp = dp.value;
    const Fp = forward(pm, ts, ce, h), Ff = forward(fo, ts, ce, h);
    const Pp = predictedLoss(Fp, pm, dp.best, ts, ce), Pf = predictedLoss(Ff, fo, dp.best, ts, ce);
    // the share of the prediction from the last 2 time units before the forced choice
    const late = (P) => { let k0 = 0; while (k0 < N - 1 && ts[k0] <= horizon - 2) k0++; const before = k0 > 0 ? P.cum[k0 - 1] : 0; return P.pred > 0 ? (P.pred - before) / P.pred : NaN; };
    let foZero = false, centerWaits = 0;
    for (let k = 0; k < N - 1; k++) { if (fo[k] <= 0) foZero = true; if (dp.bounds[k] === 0 && dp.best[k] > 0) centerWaits++; }
    runs.push({
      eps, Rdp,
      loss: { pm: Rdp - Fp.reward, fo: Rdp - Ff.reward },
      pred: { pm: Pp.pred, fo: Pf.pred },
      late: { pm: late(Pp), fo: late(Pf) },
      cum: { pm: keepC.map((k) => (Pp.pred > 0 ? Pp.cum[k] / Pp.pred : 0)), fo: keepC.map((k) => (Pf.pred > 0 ? Pf.cum[k] / Pf.pred : 0)) },
      bounds: { dp: keepW.map((k) => dp.best[k]), pm: keepW.map((k) => pm[k]), fo: keepW.map((k) => fo[k]) },
      foZero, centerWaits,
    });
    if (progress) progress(runs.length / EPS.length);
  }
  return { c0, floor, horizon, t: keepW.map((k) => ts[k]), tc: keepC.map((k) => ts[k]), runs };
}

/** The top of the ratio chart's axis: 2, or the largest ratio rounded up, at most 8. */
export const ratioAxisTop = (ratios) => Math.min(8, Math.max(2, Math.ceil(Math.max(0, ...ratios) * 1.1)));

/** Whether a schedule is flat: within a relative 1e-9 of its cost at time 0 at every 0.01 up to the horizon. */
export function isFlat(cost, horizon = LOSS_HORIZON) {
  const c0 = cost(0);
  if (!Number.isFinite(c0)) return false;
  for (let k = 1; k <= Math.round(horizon / 0.01); k++) { const c = cost(k * 0.01); if (!(Math.abs(c - c0) <= 1e-9 * c0)) return false; }
  return true;
}

/** A display rule, not an error bound: a loss counts as resolved by the grid when it is at least ten times the grid's
 * resolution (the per-moment rule's loss at the constant cost, all of it the grid's). */
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

/** The per-moment rule shifted ahead by the mean look-ahead at the current cost, B(c(t + m(c(t)))), with m from the
 * closed form (22), as an evidence bound checked every dt. */
export function shiftedBound(cost, t, dt = 0.01) {
  const c = cost(t);
  if (!Number.isFinite(c)) return 0;
  return toDiscrete(boundForCost(cost(t + lookAheadClosed(c))), dt);
}

/** Distances from the program's bound over the window, average and largest, for the per-moment and shifted rules,
 * and how far apart the two rules are. */
export function shiftGaps(exact, pm, sh) {
  const gp = [], gs = [];
  let apart = 0;
  for (let i = 0; i < exact.length; i++) {
    if (Number.isFinite(exact[i] - pm[i])) gp.push(Math.abs(exact[i] - pm[i]));
    if (Number.isFinite(exact[i] - sh[i])) gs.push(Math.abs(exact[i] - sh[i]));
    if (Number.isFinite(pm[i] - sh[i])) apart = Math.max(apart, Math.abs(pm[i] - sh[i]));
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return { avgPm: avg(gp), avgSh: avg(gs), maxPm: Math.max(0, ...gp), maxSh: Math.max(0, ...gs), apart };
}
