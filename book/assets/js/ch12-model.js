// Chapter 12's model, with no page: the Palmer observer's numbers from the inputs the paper's figure script uses, the
// rounding traps, the first-order urgency signal for a ramp and a sine wave, the kernel's quantiles, the fixed
// kernel's average of the constant-cost bounds ahead, and the urgency gate. tools/checks/ch12.mjs holds these to the
// paper's generated numbers, to its code at the tag, and to the closed forms they rest on.
import * as K from "./kernel.js";

// ---------------------------------------------------------------- the Palmer observer
/** The mean observer of Palmer, Huk, and Shadlen (2005) as the paper's figure script (paper/make_figures.py at the
 * tag) takes it: drift k x coherence per second with noise variance 1 per second, at 6.4% coherence (the paper prints
 * both), and the observer's fitted bound in their units, 0.71 (the script's A_PALMER; the paper prints only the bound
 * in its own units, rounded). tools/validity/ch12.py reads all three from the script, and a check compares them. */
export const PALMER = { k: 21, coherence: 0.064, fittedBound: 0.71 };
export const HZ = [0.5, 1, 2];

/** The cost whose best flat bound is b: 1 / (sinh 2b + 2b). */
export const costForBound = (b) => 1 / (Math.sinh(2 * b) + 2 * b);
/** The mean look-ahead (22) at the bound b = B(c0): c0 [sinh(2b)/2 - b + 2 b^2 tanh b]. */
export const meanLookAheadAt = (c0, b) => c0 * (Math.sinh(2 * b) / 2 - b + 2 * b * b * Math.tanh(b));

/** A sine wave of hz cycles per second, in the paper's units: omega = 2 pi hz times one time unit in seconds. */
export const omegaOf = (hz, unitMs) => (2 * Math.PI * hz * unitMs) / 1000;
/** A phase lead in degrees at hz cycles per second, in milliseconds. */
export const msOfDegrees = (deg, hz) => (1000 * deg) / 360 / hz;

/** The paper's worked example, step for step as its figure script computes it, from unrounded inputs. */
export function palmer(p = PALMER) {
  const mu = p.k * p.coherence;              // drift per second; the noise variance is 1 per second
  const unitMs = 1000 / mu ** 2;             // sigma^2 / mu^2 in milliseconds
  const b = mu * p.fittedBound;              // the fitted bound in the paper's units of evidence
  const c0 = costForBound(b);                // read as the best bound for a constant cost
  const m = meanLookAheadAt(c0, b);          // the mean look-ahead, in time units
  const waves = HZ.map((hz) => {
    const omega = omegaOf(hz, unitMs), t = K.transfer(c0, omega);
    return { hz, omega, deg: t.lead, ms: msOfDegrees(t.lead, hz), gain: t.gain };
  });
  return { mu, unitMs, b, c0, m, leadMs: m * unitMs, waves };
}

/** The lead in degrees and in milliseconds at hz for the observer P, from the closed form. */
export function palmerAt(hz, P) {
  const t = K.transfer(P.c0, omegaOf(hz, P.unitMs));
  return { deg: t.lead, ms: msOfDegrees(t.lead, hz), gain: t.gain };
}

/** The rounding traps: the slow-ramp lead recomputed from the bound as the paper prints it (two decimals), and each
 * wave's lead in milliseconds converted from its phase as printed (whole degrees). */
export function traps(P = palmer()) {
  const bPrinted = +P.b.toFixed(2);
  const c = costForBound(bPrinted);
  return {
    bPrinted,
    fromBound: meanLookAheadAt(c, bPrinted) * P.unitMs,
    fromDegrees: P.waves.map((w) => ({ hz: w.hz, deg: Math.round(w.deg), ms: msOfDegrees(Math.round(w.deg), w.hz) })),
  };
}

// ---------------------------------------------------------------- the kernel, exactly, from its series
/** E(S - a)^+ for S drawn from the kernel at c0: int_a^inf P(S > s) ds, summed term by term from the series (16),
 * with the tail of the sum added in closed form; for a <= 0 it is m(c0) - a. */
export function excessMean(a, c0, terms = 4000) {
  const b = K.B(c0);
  if (a <= 0) return K.meanLookAhead(c0) - a;
  let acc = 0;
  for (let j = 0; j < terms; j++) {
    const k2 = K.kappa(j, b) ** 2, al = (1 + k2) / 2;
    if (al * a > 745) break;
    acc += (k2 / (1 + k2)) * Math.exp(-al * a) / (al * al);
  }
  return ((2 / b) * acc) / K.fluxTotal(b);
}

/** The kernel's weight on [0, s]. */
export const kernelCdf = (s, c0) => (s <= 0 ? 0 : 1 - K.kernelMass(s, Infinity, K.B(c0)));

/** The q-quantile of the kernel at c0, by bisection on its distribution function. */
export function kernelQuantile(q, c0) {
  let lo = 0, hi = 1;
  while (kernelCdf(hi, c0) < q) hi *= 2;
  for (let i = 0; i < 60; i++) { const mid = 0.5 * (lo + hi); if (kernelCdf(mid, c0) < q) lo = mid; else hi = mid; }
  return 0.5 * (lo + hi);
}

// ---------------------------------------------------------------- the first-order urgency signal
/** A ramp of the cost's shape: 0 before t1, rising linearly to 1 over L time units, 1 after. */
export const ramp = (t1, L) => (t) => Math.min(1, Math.max(0, (t - t1) / L));

/** (w * gamma)(t) for the ramp above, term by term from the series: E[min((t + S - t1)^+, L)] / L =
 * [E(S - a)^+ - E(S - a - L)^+] / L with a = t1 - t, each sum cut off after at most 4,000 terms. To first order, delta U / U = -eps B'(c0) (w * gamma) / b0, so this is the urgency's change as a
 * share of the per-moment urgency's full change, which is gamma(t) itself. */
export const rampLookAhead = (t, t1, L, c0) => (excessMean(t1 - t, c0) - excessMean(t1 - t + L, c0)) / L;

/** How much earlier the first-order urgency crosses the halfway line of a ramp than the per-moment urgency does (at
 * t1 + L/2). The response rises with t, so bisection finds its crossing. */
export function rampLead(L, c0, t1 = 0) {
  let lo = t1 - 40, hi = t1 + L;
  for (let i = 0; i < 70; i++) { const mid = 0.5 * (lo + hi); if (rampLookAhead(mid, t1, L, c0) < 0.5) lo = mid; else hi = mid; }
  return t1 + L / 2 - 0.5 * (lo + hi);
}

/** The lead of a sine wave: the transfer function's phase in degrees and in time, and its gain. */
export function waveLead(c0, omega) {
  const t = K.transfer(c0, omega);
  return { deg: t.lead, time: (t.lead * Math.PI) / 180 / omega, gain: t.gain };
}

// ---------------------------------------------------------------- what control would have to compute
/** The fixed kernel's average of the constant-cost bounds ahead: int_0^inf w(s) B(c(t + s)) ds with the kernel for
 * c0, by the kernel's bins. To first order in the size of the change, it is Theorem 7's b0 + eps B'(c0) (w * gamma). */
export function averagedBound(cost, t, c0) {
  const { mid, w } = K.kernelBins(c0);
  let acc = 0;
  for (let i = 0; i < w.length; i++) acc += w[i] * K.B(cost(t + mid[i]));
  return acc;
}

// ---------------------------------------------------------------- the urgency gate (Smith and Ratcliff, 2022)
/** One path of the evidence X(t) = t + W(t) (the correct choice is +1), in Euler steps of dt from 0, until |X| first
 * reaches the bound b(t) or time tMax. Returns the times, the path, the crossing time (read between the two steps by a
 * straight line through |X| - b), and its sign: +1 at the upper level, -1 at the lower. */
export function gatePath(bound, R, dt = 0.002, tMax = 4) {
  const ts = [0], xs = [0], sd = Math.sqrt(dt);
  let x = 0, t = 0, hit = NaN, sign = 0;
  while (t < tMax) {
    const xn = x + dt + sd * R.normal(), tn = t + dt;
    ts.push(tn); xs.push(xn);
    if (Math.abs(xn) >= bound(tn)) {
      const f0 = Math.abs(x) - bound(t), f1 = Math.abs(xn) - bound(tn);
      hit = t + (dt * -f0) / (f1 - f0);
      sign = Math.sign(xn);
      break;
    }
    x = xn; t = tn;
  }
  return { ts, xs, hit, sign };
}

/** What the plate draws of a gate path: every keep-th step before the crossing, then the crossing itself, where the
 * evidence is sign b(hit) and the gated evidence X a / b is sign a (a = 1). Both charts use these same points. */
export function gateDisplay(g, bound, keep = 5) {
  const n = Number.isFinite(g.hit) ? g.xs.length - 1 : g.xs.length;   // the last step is past the bound
  const idx = [];
  for (let i = 0; i < n; i++) if (i % keep === 0) idx.push(i);
  const ts = idx.map((i) => g.ts[i]), xs = idx.map((i) => g.xs[i]);
  if (Number.isFinite(g.hit)) { ts.push(g.hit); xs.push(g.sign * bound(g.hit)); }
  return { ts, xs, gated: xs.map((x, k) => x / bound(ts[k])) };
}

/** The top of the degree axis for a guess: 50, or 90 when the guess is above 50. */
export const degreeAxisTop = (guess) => (Number.isFinite(guess) && guess > 50 ? 90 : 50);

// ---------------------------------------------------------------- the urgency signal on the reader's schedule
/** The urgency a/b from three bounds at each size, each divided by the urgency of the program's own constant-cost
 * bound b0[i], so the boundary a cancels: the best bound (the program's run), the first-order bound b0 + eps beta,
 * and the per-moment bound b0 + B(c0 + eps gamma) - B(c0) (both shortcuts measured from the program's constant-cost
 * bound, as chapter 6 does, so the shift for discrete checking cancels). Where a bound is 0 or below, its urgency is
 * NaN. Returns, for each size, the three curves and whether the first-order curve has a gap, and the largest gaps of
 * the first-order and per-moment urgency from the best bound's. */
export function urgencies(t, b0, runs, cost, c0, EPS) {
  const gamma = (x) => cost(x) - c0, B0 = K.B(c0);
  const beta = K.firstOrder(gamma, t, c0);
  const u = EPS.map((e, k) => {
    const run = runs[k];
    const ratio = (b, i) => (b > 0 ? b0[i] / b : NaN);
    const best = t.map((x, i) => ratio(run[i], i));
    const pmB = t.map((x, i) => b0[i] + (K.B(c0 + e * gamma(x)) - B0));
    const foB = t.map((x, i) => b0[i] + e * beta[i]);
    const fo = foB.map(ratio), pm = pmB.map(ratio);
    // both gaps over the same times: those where all three curves are defined
    const joint = t.map((x, i) => Number.isFinite(best[i]) && Number.isFinite(fo[i]) && Number.isFinite(pm[i]));
    const gap = (a) => Math.max(0, ...a.map((v, i) => (joint[i] ? Math.abs(v - best[i]) : 0)));
    return { best, pm, fo, holes: foB.some((b) => !(b > 0)), used: joint.filter(Boolean).length, total: t.length, gFo: gap(fo), gPm: gap(pm) };
  });
  return { u, gFo: u.map((x) => x.gFo), gPm: u.map((x) => x.gPm) };
}

/** Whether a schedule's cost moves at all over the window and the solver's spare time: a flat drawing or a size of 0
 * has nothing to lead. */
export function moves(cost, c0, view, spare) {
  let d = 0;
  for (let t = 0; t <= view + spare; t += 0.01) d = Math.max(d, Math.abs(cost(t) - c0));
  return d > 1e-9 * c0;
}

/** On a deadline: the times the plate draws (the program's thinned times with the bound above 0, short of the
 * deadline) and the urgency from the best and the per-moment bounds, each divided by the per-moment urgency at 0. */
export function deadlineUrgency(m, dl) {
  const keep = m.t.map((x, i) => i).filter((i) => m.exact[i] > 0 && m.t[i] < dl - 1e-9);
  const u0 = m.pm[0], last = keep[keep.length - 1];
  return { keep, t: keep.map((i) => m.t[i]), best: keep.map((i) => u0 / m.exact[i]), pm: keep.map((i) => u0 / m.pm[i]),
    cost: keep.map((i) => m.cost[i]), tLast: m.t[last], ratio: m.pm[last] / m.exact[last] };
}
