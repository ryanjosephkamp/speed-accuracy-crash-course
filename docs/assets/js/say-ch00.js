// The sentences chapter 0's plates print, as functions of the numbers they show. Pure: no page, no model.
const f2 = (x) => (Math.abs(x) < 0.005 ? "0.00" : x.toFixed(2));

/** The moment the guessing plate asks about: the time, on a 0.05 grid from 0.1, after which the per-moment bound
 * changes most over the next 0.3 time units (so the guess is about a change still to come), kept at least 0.1 before
 * the end of the window or a deadline; time 1 when the per-moment bound hardly changes. pmAt(t) is that bound. */
export function guessTime(pmAt, view, deadline) {
  const end = (deadline ?? view) - 0.1;
  let best = 1, most = 0.02;
  for (let t = 0.1; t <= end - 0.3 + 1e-9 || (deadline !== null && deadline !== undefined && t <= end + 1e-9); t += 0.05) {
    const d = Math.abs(pmAt(Math.min(t + 0.3, deadline ?? Infinity)) - pmAt(t));
    if (d > most + 1e-12) { most = d; best = +t.toFixed(2); }
  }
  return Math.min(best, +end.toFixed(2));
}

/** After Show me: where the reader put the bound, where the best bound is, and where the per-moment rule's is. */
export function guessSay(guess, best, pm, t) {
  const at = `at time ${t.toFixed(2).replace(/\.?0+$/, "")}`;
  const gap = best - pm;
  const vsPm = Math.abs(gap) < 0.005 ? `within 0.005 of the per-moment rule's ${f2(pm)}`
    : `${f2(Math.abs(gap))} ${gap < 0 ? "below" : "above"} the per-moment rule's ${f2(pm)}`;
  if (guess === null || !Number.isFinite(guess)) return `The best bound ${at} is ${f2(best)}, ${vsPm}.`;
  const miss = guess - best;
  const how = Math.abs(miss) < 0.005 ? "within 0.005 of it" : `${f2(Math.abs(miss))} too ${miss > 0 ? "high" : "low"}`;
  return `You put the bound at ${f2(guess)} ${at}; the best bound there is ${f2(best)}, so you were ${how}. It is ${vsPm}.`;
}

/** The last step of the flat-bound strip: where waiting and deciding meet, and the equation's two sides there. */
export function flatSay(c, b) {
  const lhs = Math.sinh(2 * b) + 2 * b;
  return `At a cost of ${c}, the two curves meet at y = ${b.toFixed(3)}, and there sinh(2b) + 2b = ${lhs.toPrecision(4)}, which is 1/c = ${(1 / c).toPrecision(4)}.`;
}

/** The hero's label for one of Figure 1's schedules. */
export const heroLabel = (label) => label;
