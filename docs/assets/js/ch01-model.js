// Chapter 1's model, with no DOM: Figure 1's four schedules, and the three bounds the chapter draws for any schedule
// on the page's grid: the dynamic program's (model.js exactPolicy), the per-moment rule's B(c(t)), and the weighted
// look-ahead (model.js weightedBound, the paper's Algorithm 1). tools/checks/ch01.mjs holds these to the paper's code
// (tools/validity/paper-code.json) and to the paper's own Figure 1 (tools/validity/ch01.json).
import { exactPolicy, boundForCost, weightedBound, toDiscrete, OVERSHOOT } from "./model.js?v=37a0cf8296";
import { paramsOf, VIEW, SPARE } from "./schedules-book.js?v=37a0cf8296";

export const DT = 0.01, H = 0.02;   // the page's grid: check the evidence every 0.01 time units, evidence step 0.02
export const EVERY = 2;             // keep every second time for the page (every 0.02 time units)
export const SHIFT = OVERSHOOT * Math.sqrt(DT);   // how far the rules move in for checking every DT

/** Figure 1's panels, in the paper's order: the book's preset at its default settings (the paper's values), the
 * paper's panel title (the row of Table 4), and a short title for a narrow panel. */
export const FIG1 = [
  { id: "jump", letter: "a", title: "Cost jumps 16-fold at t = 0.5", short: "16-fold rise" },
  { id: "fall", letter: "b", title: "Cost falls from 0.4 to 0.05 at t = 0.3", short: "Fall, 0.4 to 0.05" },
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
 * the times for the page; `horizon` overrides the program's horizon (the checks use the paper-code reference's). */
export function threeRules(cost, deadline, { dt = DT, h = H, every = EVERY, horizon = null, progress = null } = {}) {
  const view = deadline ?? VIEW;
  const ex = exactPolicy((t) => Math.min(cost(t), 1e9), horizon ?? deadline ?? VIEW + SPARE, dt, h);
  progress?.(0.3);
  const n = Math.round(view / dt) + 1;
  const ts = Array.from(ex.ts.slice(0, n));
  const pm = ts.map((t) => boundForCost(cost(t)));
  const wb = Array.from(weightedBound(cost, ts));
  progress?.(1);
  const keep = [];
  for (let k = 0; k < n; k += every) keep.push(k);
  const pick = (a) => keep.map((k) => a[k]);
  const fin = (v) => (Number.isFinite(v) ? v : null);
  return {
    t: pick(ts), cost: pick(ts.map((t) => fin(cost(t)))), exact: pick(Array.from(ex.bounds.slice(0, n), fin)),
    pm: pick(pm), wb: pick(wb), pmShift: pick(pm.map((v) => toDiscrete(v, dt))), wbShift: pick(wb.map((v) => toDiscrete(v, dt))),
    deadline, view, dt, h, every,
  };
}

/** A curve's value at time t, read linearly between the kept times. */
export function at(r, key, t) {
  const step = r.t[1] - r.t[0];
  const k = Math.max(0, Math.min(r.t.length - 2, Math.floor((t + 1e-9) / step)));
  const u = Math.max(0, Math.min(1, (t - r.t[k]) / step));
  return r[key][k] * (1 - u) + r[key][k + 1] * u;
}

/** What the cost does over the next `span` time units from t: a forced choice ahead, or the cost's mean, least, and
 * most there (sampled every 0.005). */
export function ahead(cost, t, deadline, span = 0.5) {
  if (deadline !== null && deadline !== undefined && t < deadline - 1e-9) return { kind: "deadline", left: deadline - t, now: cost(t) };
  let sum = 0, n = 0, lo = Infinity, hi = -Infinity;
  for (let s = 0.005; s <= span + 1e-9; s += 0.005) { const c = cost(t + s); sum += c; n++; lo = Math.min(lo, c); hi = Math.max(hi, c); }
  return { kind: "cost", now: cost(t), mean: sum / n, lo, hi };
}

