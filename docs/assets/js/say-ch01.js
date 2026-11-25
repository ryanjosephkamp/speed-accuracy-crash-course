// The sentences chapter 1's plates print, as functions of the numbers they show. Pure: no page, no model.
// tools/checks/ch01.mjs runs them over many inputs.
const f2 = (x) => (Math.abs(x) < 0.005 ? "0.00" : x.toFixed(2));
/** Rounded as printed, so a gap the sentence states is the gap between the numbers it prints. */
const r2 = (x) => Math.round(x * 100) / 100;
/** A cost to two significant figures: 0.10, 0.092, 1.4, 16. */
export const cf = (c) => (!Number.isFinite(c) ? "infinite" : c >= 10 ? c.toFixed(0) : c.toPrecision(2));
/** A time to two decimals, without trailing zeros: 0.4, 0.35, 1. */
export const tf = (t) => (+t.toFixed(2)).toString();

/** The hero, one step: the time, the cost, and where the best bound sits against the per-moment bound. */
export function heroLabel(t, c, best, pm) {
  const gap = r2(best) - r2(pm);
  const rel = Math.abs(gap) < 0.01 ? "the best and per-moment bounds have met"
    : `the best bound sits ${f2(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the per-moment bound`;
  return `Time ${tf(t)}: cost ${cf(c)}; ${rel}`;
}

/** Under "read the cost through B": what the rule uses at time t, and what it leaves out. `next` is ahead()'s
 * summary of the coming half time unit; `dl` the deadline or null. */
export function ruleSay(t, c, b, next, dl) {
  if (dl !== null && t > dl + 1e-9) {
    return `At time ${tf(t)}, past the forced choice at ${tf(dl)}, the cost is infinite and B(∞) = 0, so the per-moment bound is 0. Before that it stayed at B(${cf(c)}) = ${f2(b)}: the rule sees the deadline only when it arrives.`;
  }
  let s = `At time ${tf(t)}, the cost is ${cf(c)}, so the per-moment bound is B(${cf(c)}) = ${f2(b)}. `;
  if (next.kind === "deadline") return s + `The forced choice at ${tf(dl)} is ${f2(next.left)} time units ahead, and the rule doesn't use it.`;
  if (next.hi <= c * 1.02 && next.lo >= c / 1.02) return s + "Over the next half time unit, the cost stays within 2% of that.";
  return s + `Over the next half time unit, the cost runs between ${cf(next.lo)} and ${cf(next.hi)}, and the rule uses none of it.`;
}

/** After Show me on the 16-fold rise: the reader's guess, the best bound, and the per-moment bound at time t, where
 * the cost is c on its way from c0 to c1. guess may be null. */
export function riseSay(guess, best, pm, t, c, c0, c1) {
  const gap = r2(pm) - r2(best);
  const where = `At time ${tf(t)}, the cost is ${cf(c)}, on its way from ${cf(c0)} to ${cf(c1)}.`;
  const rel = `The best bound there is ${f2(best)}, ${f2(Math.abs(gap))} ${gap > 0 ? "below" : "above"} the per-moment bound's ${f2(pm)}.`;
  if (guess === null || !Number.isFinite(guess)) return `${where} ${rel}`;
  const miss = r2(guess) - r2(best);
  const how = Math.abs(miss) < 0.005 ? "right to two decimals" : `${f2(Math.abs(miss))} too ${miss > 0 ? "high" : "low"}`;
  return `You put the bound at ${f2(guess)}; the best bound is ${f2(best)}, so your guess was ${how}. ${where} The per-moment bound is ${f2(pm)}, ${f2(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the best bound.`;
}

/** Under Figure 1, for the panel being read out at time t: the cost now and ahead, the three bounds, and, when the
 * gap and the cost ahead agree in direction, why the best bound sits where it does. `next` is ahead()'s summary. */
export function panelSay({ name, t, c, best, pm, wb, next, dl }) {
  if (dl !== null && dl !== undefined && t > dl + 1e-9) {
    return `${name}: time ${tf(t)} is past the forced choice at ${tf(dl)}, so every decision has ended. Move the time back to read the bounds.`;
  }
  let s = `${name}: at time ${tf(t)}, the cost is ${cf(c)}`;
  let dir = 0;   // +1 the cost ahead is higher (or a forced choice is coming), -1 lower, 0 about the same
  if (next.kind === "deadline") { s += `, and the forced choice at ${tf(dl)} is ${f2(next.left)} time units ahead.`; dir = 1; }
  else {
    const r = next.mean / c;
    if (r > 1.1) { s += `, and it averages ${cf(next.mean)} over the next half time unit.`; dir = 1; }
    else if (r < 1 / 1.1) { s += `, and it averages ${cf(next.mean)} over the next half time unit.`; dir = -1; }
    else s += ", and about the same over the next half time unit.";
  }
  s += ` The best bound is ${f2(best)}, the per-moment bound ${f2(pm)}, and the weighted rule ${f2(wb)}.`;
  const gap = r2(best) - r2(pm);
  if (Math.abs(gap) < 0.02) return s + " The best and per-moment bounds agree to within 0.02.";
  const side = `The best bound sits ${f2(Math.abs(gap))} ${gap < 0 ? "lower" : "higher"}`;
  if (gap < 0 && dir === 1) return s + ` ${side}: a decision open now may still be open when ${next.kind === "deadline" ? "the choice is forced" : "the cost is higher"}.`;
  if (gap > 0 && dir === -1) return s + ` ${side}: a decision open now may still be open when the cost is lower.`;
  return s + ` ${side} than the per-moment bound.`;
}

/** The line above the fifth panel: what the reader's schedule is, and what the chapter can say about it. */
export function yoursNote({ label, kind, letter, same, dl }) {
  const which = letter ? (same ? ` This is Figure 1(${letter}) itself.` : ` It is Figure 1(${letter})'s schedule, with your settings.`) : "";
  if (kind === "deadline") {
    return `${label}.${which} The cost is infinite past the forced choice at ${tf(dl)}, so the window ends there. The per-moment rule doesn't see the deadline until it arrives. The weighted rule comes down before it with no special case, but no theorem in the paper covers a deadline: there the rule is a heuristic, judged by measurement (chapter 8).`;
  }
  if (kind === "constant") return `${label}. The cost never changes, so the per-moment bound is the best bound, and the three curves differ only by the grid.`;
  if (letter && same) return `${label}.${which}`;
  return `${label}.${which || " Solved the same way as the four above."} Away from small changes, the weighted rule is a heuristic, and for large, fast changes Algorithm 1's 30 updates need not settle on a solution (chapter 8).`;
}
