// Chapter 8's rules, with no DOM: the weighted look-ahead of Algorithm 1 with every update kept, the averaged-cost
// rule, and the map b -> T(b; t) whose fixed points the weighted rule's equation asks for. The kernels, the
// constant-cost bound B, and the caching of kernels by level come from model.js, which follows the paper's code
// (shortcuts.weighted_bound, weighted_ahead, and boundary_kernel at the tag); tools/checks/ch08.mjs holds these to
// that code's outputs.
import { boundForCost, boundaryKernel, kernelForBound, exactPolicy, score, toDiscrete } from "./model.js?v=89322951a3";
import { costOf, deadlineOf, VIEW, SPARE } from "./schedules-book.js?v=89322951a3";
import { flux, fluxTotal } from "./kernel.js?v=89322951a3";

export const UPDATES = 30;

/** Algorithm 1 without the final shift: from the per-moment bound B(c(t)), `iterations` damped updates
 * b <- (b + a) / 2, where a(t) = sum_j w_j B(c(t + s_j)) with the kernel for the current level, max(b, 0.01) rounded
 * to 0.001. Returns every update (updates[0] is the per-moment start) and the change each update made. The arithmetic
 * is model.js's weightedBound, step for step, so updates[30] equals its output exactly. */
export function weightedHistory(cost, ts, iterations = UPDATES, every = 1) {
  const n = ts.length;
  let ref = Float64Array.from(ts, (t) => boundForCost(cost(t)));
  const futures = new Map();
  const out = new Float64Array(n);
  const keep = (a) => Float64Array.from({ length: Math.ceil(n / every) }, (_, k) => a[k * every]);
  const updates = [keep(ref)], change = [];
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const key = Math.round(Math.max(ref[i], 0.01) * 1000);
      const { s, w } = kernelForBound(key / 1000);
      let fut = futures.get(key);
      if (!fut) { fut = new Map(); futures.set(key, fut); }
      let row = fut.get(i);
      if (!row) {
        row = new Float64Array(s.length);
        for (let j = 0; j < s.length; j++) row[j] = boundForCost(cost(ts[i] + s[j]));
        fut.set(i, row);
      }
      let acc = 0;
      for (let j = 0; j < s.length; j++) acc += w[j] * row[j];
      out[i] = acc;
    }
    let most = 0;
    for (let i = 0; i < n; i++) {
      const next = 0.5 * (ref[i] + out[i]);
      most = Math.max(most, Math.abs(next - ref[i]));
      ref[i] = next;
    }
    change.push(most);
    updates.push(keep(ref));
  }
  return { updates, change, final: ref };
}

// ---- the averaged-cost rule ---------------------------------------------------------------------------------

const COST_KERNELS = new Map();
/** The kernel for a constant cost c, cached on log c rounded to 0.01, for the level B(c) (at least 0.001), as the
 * paper's code builds it for the averaged-cost rule. */
export function kernelForCost(c) {
  const key = Math.round(Math.log(Math.min(Math.max(c, 1e-5), 1e4)) * 100) / 100;
  let k = COST_KERNELS.get(key);
  if (!k) { k = boundaryKernel(Math.max(boundForCost(Math.exp(key)), 1e-3)); COST_KERNELS.set(key, k); }
  return k;
}

/** b_avg(t) = B((w_c(t) * c)(t)): the constant-cost bound for the kernel-weighted average of the coming costs, with
 * the kernel for the current cost. With a deadline ahead, the cost is infinite past it and the kernel is positive at
 * every delay (Lemma 6(a)), so the average is infinite and the rule's bound is B(infinity) = 0 at every time. */
export function averagedCost(cost, ts, deadline = null) {
  if (deadline !== null) return new Float64Array(ts.length);
  return Float64Array.from(ts, (t) => {
    const c = cost(t);
    if (!Number.isFinite(c)) return 0;
    const { s, w } = kernelForCost(c);
    let acc = 0;
    for (let j = 0; j < s.length; j++) acc += w[j] * cost(t + s[j]);
    return boundForCost(acc);
  });
}

// ---- the map whose fixed points the rule's equation asks for -------------------------------------------------

/** T(b; t) = sum_j w_j B(c(t + s_j)) with the kernel for the level b: rounded to 0.001 as Algorithm 1 does, or, with
 * exact = true, built for b itself. Levels below 0.01 use the kernel for 0.01, as the algorithm does. */
export function mapT(b, t, cost, exact = false) {
  const { s, w } = exact ? boundaryKernel(Math.max(b, 0.01)) : kernelForBound(b);
  let acc = 0;
  for (let j = 0; j < s.length; j++) acc += w[j] * boundForCost(cost(t + s[j]));
  return acc;
}

/** The levels where T(b; t) = b on [lo, hi]: sign changes of T(b) - b on a grid of n levels, refined by bisection on
 * the exact-level map. Returns the roots in increasing order, each with the slope of T there. */
export function selfConsistent(t, cost, lo, hi, n = 160) {
  const g = (b) => mapT(b, t, cost, true) - b;
  const bs = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
  const gs = bs.map(g);
  const roots = [];
  for (let i = 1; i < n; i++) {
    if (gs[i] === 0 || Math.sign(gs[i]) !== Math.sign(gs[i - 1])) {
      let a = bs[i - 1], b = bs[i], ga = gs[i - 1];
      for (let k = 0; k < 40; k++) { const m = 0.5 * (a + b), gm = g(m); if (Math.sign(gm) === Math.sign(ga)) { a = m; ga = gm; } else b = m; }
      const r = 0.5 * (a + b), h = 1e-3;
      roots.push({ b: r, slope: (mapT(r + h, t, cost, true) - mapT(r - h, t, cost, true)) / (2 * h) });
    }
  }
  return roots;
}

/** The share of the kernel for the level b (rounded as Algorithm 1 does) that falls at delays below h. */
export function shareBefore(b, h) {
  const { s, w } = kernelForBound(b);
  let acc = 0;
  for (let j = 0; j < s.length; j++) if (s[j] < h) acc += w[j];
  return acc;
}

// ---- the rules side by side on a schedule ---------------------------------------------------------------------

/** The reader's schedule, with a deadline added at `addDeadline` if it has none of its own: past the deadline the
 * cost is infinite, as the paper's experiments code writes a deadline. */
export function scheduleFor(choice, addDeadline = null) {
  const base = costOf(choice), own = deadlineOf(choice);
  if (own !== null || addDeadline === null) return { cost: base, deadline: own, own: own !== null };
  return { cost: (t) => (t <= addDeadline + 1e-12 ? base(t) : Infinity), deadline: addDeadline, own: false };
}

/** The dynamic program and the three rules on one schedule, on the page's grid (time step dt, evidence step h), over
 * the window (to the deadline, or VIEW) with the program run SPARE time units past it. Bounds are continuous-
 * monitoring bounds for the rules; the losses score each rule moved in by 0.5826 sqrt(dt), in points per 100 trials.
 * Every `every`-th grid time up to the window's end is returned, with the weighted rule's every update. */
export function compareRules(cost, deadline, { dt = 0.01, h = 0.02, every = 2, progress = null } = {}) {
  const view = deadline ?? VIEW, horizon = deadline ?? VIEW + SPARE;
  const ex = exactPolicy((t) => Math.min(cost(t), 1e9), horizon, dt, h);
  progress?.(0.25);
  const ts = ex.ts;
  const pm = Float64Array.from(ts, (t) => (deadline !== null && t >= deadline - 1e-9 ? 0 : boundForCost(cost(t))));
  const avg = averagedCost(cost, ts, deadline);
  progress?.(0.35);
  const hist = weightedHistory(cost, ts, UPDATES, every);
  progress?.(0.85);
  const shift = (a) => Float64Array.from(a, (b) => toDiscrete(b, dt));
  const reward = (x) => score(x, ts, cost).reward;
  const best = reward(ex.bounds);
  const loss = { pm: 100 * (best - reward(shift(pm))), avg: 100 * (best - reward(shift(avg))), wb: 100 * (best - reward(shift(hist.final))) };
  const keep = [];
  for (let k = 0; k < ts.length && ts[k] <= view + 1e-9; k += every) keep.push(k);
  const pick = (a) => keep.map((k) => a[k]);
  const m = keep.length;
  return {
    t: pick(ts), cost: pick(Float64Array.from(ts, cost)), exact: pick(ex.bounds), pm: pick(pm), avg: pick(avg),
    wb: pick(hist.final), updates: hist.updates.map((u) => Array.from(u.slice(0, m))), loss, dt, h, deadline, view, horizon,
  };
}

/** How far `iterations` damped updates move the bound from where 30 left it, at the times 0, step, ... before
 * min(6, deadline), as the paper measures it (Appendix C): the largest move and the time where it happens. */
export function moreUpdates(cost, deadline, iterations = 300, step = 0.01) {
  const end = Math.min(6, deadline ?? Infinity);
  const ts = Float64Array.from({ length: Math.ceil(end / step - 1e-9) }, (_, k) => k * step);
  const a = weightedHistory(cost, ts, UPDATES).final, b = weightedHistory(cost, ts, iterations).final;
  let most = 0, at = 0;
  for (let i = 0; i < ts.length; i++) { const d = Math.abs(b[i] - a[i]); if (d > most) { most = d; at = ts[i]; } }
  return { move: most, at, end, count: ts.length };
}

// ---- a cost that is high for a short time, then low ------------------------------------------------------------

/** log c moves from log hi to log lo by a logistic of scale 0.05 (the book's joins) centered at `at`. */
export const SPIKE = { hi: 4, lo: 0.02, at: 0.2 };
export const spikeCost = (t) => Math.exp(Math.log(SPIKE.hi) + (Math.log(SPIKE.lo) - Math.log(SPIKE.hi)) / (1 + Math.exp(-(t - SPIKE.at) / 0.05)));

/** The map T(b; t) on a grid of levels from 0.01 to a little above the largest per-moment bound ahead, its crossings
 * of the diagonal, and where Algorithm 1's 30 damped updates from the per-moment bound end at t. */
export function rootsAt(cost, t, n = 160) {
  let top = 0;
  for (let s = 0; s <= 12; s += 0.01) { const b = boundForCost(cost(t + s)); if (Number.isFinite(b)) top = Math.max(top, b); }
  const lo = 0.01, hi = Math.max(0.2, top * 1.06);
  const bs = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
  const map = bs.map((b) => mapT(b, t, cost, true));
  const roots = selfConsistent(t, cost, lo, hi, n);
  const run = weightedHistory(cost, [t]);
  return { bs, map, roots, start: run.updates[0][0], path: run.updates.map((u) => u[0]), end: run.final[0], lo, hi };
}

// ---- Proposition 13 on a small change ------------------------------------------------------------------------

/** For c(t) = c0 (1 + eps sin(omega t)): the interval I, the map over I at time tStar with each level's own kernel,
 * its largest slope, the rule over time from Algorithm 1, the first-order bound b0 + eps beta with beta from the
 * kernel for b0 (the same 240 bins), and the per-moment bound. */
export const P13 = { c0: 0.1, M: 0.1, omega: 2, tStar: 0.5, EPS: [0.4, 0.2, 0.1, 0.05], step: 0.04, end: 4 };
export function prop13(eps, { c0, M, omega, tStar, step, end } = P13) {
  const gamma = (t) => M * Math.sin(omega * t), cost = (t) => c0 + eps * gamma(t);
  const b0 = boundForCost(c0), Bp = -1 / (4 * c0 * c0 * Math.cosh(b0) ** 2);
  const lo = boundForCost(c0 + eps * M), hi = boundForCost(c0 - eps * M);
  const bs = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
  const map = bs.map((b) => mapT(b, tStar, cost, true));
  let slope = 0;
  for (let i = 1; i < bs.length; i++) slope = Math.max(slope, Math.abs((map[i] - map[i - 1]) / (bs[i] - bs[i - 1])));
  const ts = Array.from({ length: Math.round(end / step) + 1 }, (_, i) => i * step);
  const wb = Array.from(weightedHistory(cost, ts).final);
  const k0 = boundaryKernel(b0);
  const beta = ts.map((t) => { let a = 0; for (let j = 0; j < k0.s.length; j++) a += k0.w[j] * gamma(t + k0.s[j]); return Bp * a; });
  const pm = ts.map((t) => boundForCost(cost(t)));
  let errW = 0, errPm = 0;
  ts.forEach((t, i) => { errW = Math.max(errW, Math.abs(wb[i] - b0 - eps * beta[i])); errPm = Math.max(errPm, Math.abs(pm[i] - b0 - eps * beta[i])); });
  const fixed = selfConsistent(tStar, cost, lo, hi, 41);
  return { eps, b0, Bp, lo, hi, bs, map, slope, ts, wb, beta, pm, errW, errPm, fixed: fixed.length ? fixed[0].b : NaN, crossings: fixed.length };
}

/** The kernel w_b from its series and its derivative in the level, on a log grid of delays from lo to 60, each times
 * s so that areas on a log axis are the true integrals; and the derivative's areas above and below zero, by the
 * trapezoid rule in log s (the stretch [0, lo] is left out). */
export function levelDerivative(b, lo = 1e-8, n = 800, h = 1e-4) {
  const w = (s, x) => flux(s, x) / fluxTotal(x);
  const us = Array.from({ length: n }, (_, i) => Math.log(lo) + ((Math.log(60) - Math.log(lo)) * i) / (n - 1));
  const ss = us.map(Math.exp);
  const sw = ss.map((s) => s * w(s, b)), sd = ss.map((s) => (s * (w(s, b + h) - w(s, b - h))) / (2 * h));
  let above = 0, below = 0;
  for (let i = 1; i < n; i++) { const m = 0.5 * (sd[i] + sd[i - 1]) * (us[i] - us[i - 1]); if (m > 0) above += m; else below -= m; }
  return { ss, sw, sd, above, below };
}
