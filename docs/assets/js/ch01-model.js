// Chapter 1's model, with no DOM: Figure 1's four schedules, and the three bounds the chapter draws for any schedule
// on the page's grid: the dynamic program's (model.js exactPolicy), the per-moment rule's B(c(t)), and the weighted
// look-ahead (model.js weightedBound, the paper's Algorithm 1). tools/checks/ch01.mjs holds these to the paper's code
// (tools/validity/paper-code.json) and to the paper's own Figure 1 (tools/validity/ch01.json).
import { exactPolicy, boundForCost, weightedBound, toDiscrete, OVERSHOOT } from "./model.js?v=d73958033e";
import { paramsOf, costOf, defaultDrawing, VIEW, SPARE, DRAW_TIMES, DRAW_MIN, DRAW_MAX } from "./schedules-book.js?v=d73958033e";

export const DT = 0.01, H = 0.02;   // the page's grid: check the evidence every 0.01 time units, evidence step 0.02
export const CAP = 5;               // the program's evidence cap: a bound above it is reported as missing
export const EVERY = 1;             // keep every time the program checks, so a read-out at t = 0.99 is the grid's own value
export const SHIFT = OVERSHOOT * Math.sqrt(DT);   // how far the rules move in for checking every DT

/** Figure 1's panels, in the paper's order: the book's preset at its default settings (the paper's values), a title
 * that names the step's center (the steps are logistic, not jumps), and a short title for a narrow panel. Table 4
 * prints the same four as "Cost jumps 16-fold at t = 0.5" and so on; the checks match the numbers in each. */
export const FIG1 = [
  { id: "jump", letter: "a", title: "Cost rises 16-fold, centered at t = 0.5", short: "16-fold rise" },
  { id: "fall", letter: "b", title: "Cost falls from 0.4 to 0.05, centered at t = 0.3", short: "Fall, 0.4 to 0.05" },
  { id: "rising", letter: "c", title: "Flat, then rising after t = 0.5", short: "Flat, then rising" },
  { id: "deadline", letter: "d", title: "Hard deadline at t = 1", short: "Deadline at 1" },
];
export const fig1Choice = (id) => ({ id, params: paramsOf({ id }) });

/** Which of Figure 1's panels a schedule is: the letter if it is one of the four at the paper's values, the letter
 * with "settings" if it is one of them with other settings, or null. */
export function fig1Of(choice) {
  const f = FIG1.find((p) => p.id === choice?.id);
  if (!f) return null;
  const mine = paramsOf(choice), paper = paramsOf({ id: f.id });
  const same = Object.keys(paper).every((k) => Math.abs(mine[k] - paper[k]) < 1e-9);
  return { letter: f.letter, same };
}

/** The three bounds for a cost schedule over its window (0 to 2.5, or to the deadline), on the page's grid:
 * - exact: the dynamic program's bound, solved backward from a forced choice at the horizon (6 time units past the
 *   window, or the deadline, as the paper's Figure 1 does), checking the evidence every dt on an evidence grid of h;
 * - pm: the per-moment bound B(c(t)) for continuous monitoring, with B(infinity) = 0;
 * - wb: the weighted look-ahead for continuous monitoring, from Algorithm 1's 30 damped updates.
 * pmShift and wbShift are the two rules moved in by 0.5826 sqrt(dt), for comparison with the program. `every` thins
 * the times for the page, always keeping the last one (a deadline's forced choice, where the program's bound is 0);
 * `horizon` overrides the program's horizon. */
export function threeRules(cost, deadline, { dt = DT, h = H, every = EVERY, horizon = null, progress = null } = {}) {
  const view = deadline ?? VIEW;
  const ex = exactPolicy((t) => Math.min(cost(t), 1e9), horizon ?? deadline ?? VIEW + SPARE, dt, h, CAP);
  progress?.(0.3);
  const n = Math.min(Math.round(view / dt) + 1, ex.ts.length);
  const ts = Array.from(ex.ts.slice(0, n));
  const pm = ts.map((t) => boundForCost(cost(t)));
  const wb = Array.from(weightedBound(cost, ts));
  progress?.(1);
  const keep = [];
  for (let k = 0; k < n; k += every) keep.push(k);
  if (keep[keep.length - 1] !== n - 1) keep.push(n - 1);
  const pick = (a) => keep.map((k) => a[k]);
  const fin = (v) => (Number.isFinite(v) ? v : null);
  return {
    t: pick(ts), cost: pick(ts.map((t) => fin(cost(t)))), exact: pick(Array.from(ex.bounds.slice(0, n), fin)),
    pm: pick(pm), wb: pick(wb), pmShift: pick(pm.map((v) => toDiscrete(v, dt))), wbShift: pick(wb.map((v) => toDiscrete(v, dt))),
    deadline, view, dt, h, every,
  };
}

/** A curve's value at time t, read linearly between the kept times (the last interval may be shorter); exactly the
 * kept value when t is one of the kept times. */
export function at(r, key, t) {
  const ts = r.t, n = ts.length;
  if (t >= ts[n - 1] - 1e-9) return r[key][n - 1];
  if (t <= ts[0]) return r[key][0];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t + 1e-9) lo = m; else hi = m; }
  if (Math.abs(ts[lo] - t) < 1e-9) return r[key][lo];
  const u = (t - ts[lo]) / (ts[lo + 1] - ts[lo]);
  return r[key][lo] * (1 - u) + r[key][lo + 1] * u;
}

/** The times a cost strip samples over [0, view]: 181 evenly spaced, plus a drawing's knots (its corners) inside the
 * window, in order. Between a drawing's knots log c is linear in time, so a path through these times on a log scale is
 * the drawing itself. */
export function stripTimes(view, knots = null) {
  const ts = Array.from({ length: 181 }, (_, i) => (view * i) / 180);
  for (const k of knots ?? []) if (k > 0 && k < view && !ts.some((t) => Math.abs(t - k) < 1e-9)) ts.push(k);
  return ts.sort((a, b) => a - b);
}
/** A drawing's knot times (where its cost can turn a corner), or null for a preset. */
export const knotsOf = (choice) => (choice?.id === "draw" ? DRAW_TIMES : null);

/** Where a cost strip puts a cost: 0 at the bottom, 1 at the top, on a log scale padded 35% past the schedule's least
 * and most finite costs at stripTimes(view, knots). Costs and bounds have separate scales; nothing here is clipped to a
 * bound. */
export function costStrip(cost, view, knots = null) {
  const cs = stripTimes(view, knots).map(cost).filter(Number.isFinite);
  const lo = Math.log(Math.min(...cs) / 1.35), hi = Math.log(Math.max(...cs) * 1.35);
  return { lo: Math.exp(lo), hi: Math.exp(hi), y: (c) => (Math.log(c) - lo) / (hi - lo) };
}

/** What the cost does over the next `span` time units from t: the forced choice itself (t at the deadline), past
 * it, a forced choice ahead, or the cost sampled every 0.005 from t to t + span: its least and most values, its mean
 * (by the trapezoid rule, so a straight ramp gets its exact mean), and whether the samples never fall (up) or never
 * rise (down). A sample says nothing about the cost between samples or after t + span. */
export function ahead(cost, t, deadline, span = 0.5) {
  const dl = deadline ?? null;
  if (dl !== null && Math.abs(t - dl) <= 1e-9) return { kind: "forced", now: cost(t) };
  if (dl !== null && t > dl) return { kind: "past" };
  if (dl !== null) return { kind: "deadline", left: dl - t, now: cost(t) };
  const n = Math.round(span / 0.005), cs = Array.from({ length: n + 1 }, (_, i) => cost(t + (span * i) / n));
  let sum = 0, up = true, down = true;
  for (let i = 1; i <= n; i++) {
    sum += 0.5 * (cs[i - 1] + cs[i]);
    if (cs[i] < cs[i - 1] * (1 - 1e-12)) up = false;
    if (cs[i] > cs[i - 1] * (1 + 1e-12)) down = false;
  }
  return { kind: "cost", now: cs[0], mean: sum / n, lo: Math.min(...cs), hi: Math.max(...cs), up, down };
}

/** Whether a schedule's cost doesn't change at all over [0, until]. A drawing is flat when its knots, as the cost uses
 * them (clamped to 0.01 to 2), are all the same number: the cost is then constant, though its interpolated values
 * can differ from the knot in the last binary digit. A preset (a constant, a smooth schedule of size 0) is flat
 * when its cost, sampled every 0.01, is the same number everywhere: no flat preset has that rounding. Not merely the
 * same to the digits printed. */
export function isFlat(choice, until) {
  if (choice?.id === "draw") {
    const k = (Array.isArray(choice.points) ? choice.points : defaultDrawing()).map((c) => Math.min(Math.max(c, DRAW_MIN), DRAW_MAX));
    return k.every((v) => v === k[0]);
  }
  const cost = costOf(choice), n = Math.round(until / 0.01), c0 = cost(0);
  for (let i = 1; i <= n; i++) if (cost(i * 0.01) !== c0) return false;
  return true;
}
