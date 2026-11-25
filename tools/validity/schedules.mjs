// The schedules the book's solver is held to the paper's code on: the ten presets at their default settings and the
// default drawing. Both sides read each schedule the same way, so any difference comes from the code: a deadline
// as its closed form, every other schedule as log c tabulated every STEP time units and read linearly between.
import { PRESETS, costOf, defaultDrawing, deadlineOf, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";

export const STEP = 0.002;     // the table's spacing, in time units
export const UNTIL = 26;       // far enough past the window for the longest kernel the presets reach
export const DT = 0.01, H = 0.02, CAP = 5;   // the page's grid: check every 0.01, evidence step 0.02, bounds capped at 5
export const HORIZON = VIEW + SPARE;

export const CHOICES = [
  ...PRESETS.map((p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) })),
  { id: "draw", points: defaultDrawing() },
];

/** What the paper's side needs to rebuild the schedule: a deadline's two numbers, or the log-cost table. */
export function spec(choice) {
  const at = deadlineOf(choice);
  if (at !== null) return { id: choice.id, kind: "deadline", at, c: choice.params.c };
  const cost = costOf(choice);
  const logc = Array.from({ length: Math.round(UNTIL / STEP) + 1 }, (_, i) => Math.log(cost(i * STEP)));
  return { id: choice.id, kind: "table", step: STEP, logc };
}

/** The same schedule as a cost function, read exactly as the paper's side reads it. */
export function costFromSpec(s) {
  if (s.kind === "deadline") return (t) => (t <= s.at + 1e-12 ? s.c : Infinity);
  const L = s.logc, n = L.length;
  return (t) => {
    const x = Math.min(Math.max(t, 0), (n - 1) * s.step) / s.step;
    const i = Math.min(Math.floor(x), n - 2), f = x - i;
    return Math.exp(L[i] + (L[i + 1] - L[i]) * f);
  };
}

/** The comparator's edge cases (tools/checks/paper-code.mjs): constant costs where the grid's first step past the
 * center decides, with a forced choice at EDGE_HORIZON (at 3.2 the center still waits, at 4.2 it stops too), and a
 * cost that falls 40,000-fold at time 1, to 1e-5, below the presets' range, so that its bound passes the cap. */
export const EDGE_CONSTANT = [3.2, 4.2], EDGE_HORIZON = 2;
export const EDGE_CHOICES = { "fall to 1e-5": { id: "fall", params: { at: 1, factor: 40000 } } };
