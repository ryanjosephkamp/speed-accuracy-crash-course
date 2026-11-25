// The sentences chapter 3's plates print, as pure functions of the numbers they show. tools/checks/ch03.mjs runs them
// over random inputs and on the plates' own numbers.
import { B } from "./kernel.js?v=850f062e96";
const fx = (x, d) => { const s = x.toFixed(d); return /^-0\.?0*$/.test(s) ? s.slice(1) : s; };
const f2 = (x) => fx(x, 2), f3 = (x) => fx(x, 3);
/** A cost as the book prints it: two significant figures, no trailing zeros. */
export const fc = (c) => String(+(+c).toPrecision(2));
/** A time, or a value set on a slider, as set: up to three decimals, no trailing zeros (2.55 stays 2.55). */
export const ft = (t) => String(+(+t).toFixed(3));
const pts = (x) => fx(100 * x, 1);

/** The hero's label for one cost. */
export const heroLabel = (c, b) => `At a cost of ${fc(c)}, the reward of a flat bound peaks at b = ${f2(b)}`;

// ---- what a decision earns ------------------------------------------------------------------------------------

/** One path's outcome, from ch03-model.js's pathOutcome: { tau, x, side, forced, deadline, right, bill }, with right
 * the chance the choice made at that check is right, g(|X|) at the check. */
export function pathSay(o) {
  if (o.forced) {
    const at = Math.abs(o.tau - o.deadline) < 1e-9 ? `at the deadline, time ${ft(o.deadline)}` : `at its last check, time ${f3(o.tau)}, before the deadline at ${ft(o.deadline)}`;
    return `This path is still open ${at}, so the choice is forced there, at X = ${f3(o.x)}: it is right with chance g(|X|) = ${f3(o.right)}, and the time cost ${f3(o.bill)}, so it nets ${f3(o.right - o.bill)}.`;
  }
  return `Checked every 0.001 time units, this path is first at or beyond the bound moved in by ${f3(o.shift ?? 0)} (the plate's threshold) at time ${f3(o.tau)}, with X = ${f3(o.x)}, and chooses ${o.side > 0 ? "+1" : "−1"}: it is right with chance g(|X|) = ${f3(o.right)}, and the time cost ${f3(o.bill)}, so it nets ${f3(o.right - o.bill)}.`;
}

/** After Show me: the reader's flat bound against the best flat bound (both with continuous monitoring), and then, on
 * the dynamic program's own grid, the best threshold held flat against the best bound that moves. flat is the worker's
 * flat job ({ horizon, gridX, grid }); dp is V(0, 0) from the same grid and horizon. */
export function earnVerdict({ b, mine, best, dp, flat, deadline }) {
  const gap = best.net - mine.net;
  let s = `Checking the evidence continuously, your bound, ${f2(b)}, earns ${f3(mine.net)} on average: ${f3(mine.reward)} for being right, minus ${f3(mine.bill)} for time. `;
  s += `The best flat bound${deadline !== null ? " with the forced choice" : ""} is ${f2(best.b)}, earning ${f3(best.net)}`;
  s += gap < 5e-4 ? ", so yours earns within 0.05 points per 100 decisions of it." : `, so yours earns ${pts(gap)} points per 100 decisions less.`;
  if (Number.isFinite(dp) && flat && Number.isFinite(flat.grid)) {
    const more = dp - flat.grid;
    s += ` On the dynamic program's grid, which checks the evidence every 0.01 time units and forces the choice at time ${ft(flat.horizon)}, the best level held flat, ${f2(flat.gridX)}, earns ${f3(flat.grid)}`;
    s += more >= 5e-4 ? `, and the best bound that moves with the cost earns ${f3(dp)}: ${pts(more)} points per 100 decisions more.`
      : `, and the best bound that moves earns ${f3(dp)}: on this schedule, moving gains less than 0.05 points per 100 decisions.`;
  }
  return s;
}

// ---- which costs the theory allows ------------------------------------------------------------------------------

/** The verdict on a schedule. st from ch03-model.js's standing(); label the schedule's name; ratio a drawing's steepest
 * change over 0.1 time units. */
export function standingSay(st, label, ratio = 1) {
  const band = `between ${fc(st.lo)} and ${fc(st.hi)}`;
  switch (st.kind) {
    case "constant":
      return `A constant cost of ${fc(st.lo)}: continuous, and ${band}. The assumption holds, and the best bound is flat: B(c) = ${f3(B(st.lo))}.`;
    case "step":
      return `${label}: its changes are logistic steps${st.joins === "log" ? " in log c" : ""} with scale 0.05 time units, so the cost is continuous, and it stays ${band} for all time. The assumption holds, so the exact equation of chapter 5 covers it. Theorem 7 is about the limit of small changes (chapter 6), so it gives a change this size no guarantee.`;
    case "smooth":
      return `${label}: continuous, and ${band} for all time. The assumption holds, so the exact equation of chapter 5 covers it. Theorem 7 is about the limit of small changes (chapter 6).`;
    case "rising":
      return `${label}: continuous, but it rises without end, so no upper level c_max exists and the assumption fails. The exact equation and Theorem 7 don't cover it; the dynamic program still solves it on its grid, with a last moment.`;
    case "deadline":
      return `${label === "Your drawing" ? "Your drawing, ended with a forced choice at time 2.5" : `A deadline at time ${ft(st.at)}`}: past it the cost is infinite, so it is neither continuous nor bounded, and the assumption fails. The paper's experiments force the choice at the deadline and judge its rules there by measurement (chapters 9 and 10).`;
    case "drawn":
      return `Your drawing is joined by straight lines in log c and held flat after time 2.5, so it is continuous and stays ${band}: the assumption holds. Its steepest change is ${f2(ratio)}-fold over 0.1 time units; even a stroke drawn straight up becomes a ramp that wide.`;
    case "up":
      return `Continued at its last slope, your drawing rises without end after time 2.5: no upper level c_max exists, so the assumption fails, although the cost is continuous.`;
    case "down":
      return `Continued at its last slope, your drawing falls toward 0 after time 2.5: no positive lower level c_min exists, so the assumption fails. As the cost nears 0, the constant-cost bound grows without limit, so nothing caps the bound.`;
    default:
      return `${label}: the page can't classify this schedule.`;
  }
}

// ---- the value of waiting ------------------------------------------------------------------------------------------

/** After Show me on the map. tap: the kept sample nearest the reader's tap, { t, y, W }, or null; best: the largest W
 * over the map's samples, { t, W }, which is at y = 0. */
export function valueVerdict(tap, best) {
  const where = `Of the map's samples, waiting is worth the most at time ${f2(best.t)} with no evidence, y = 0, where W = ${f3(best.W)}.`;
  const why = " At every time, W is largest at y = 0, where deciding is a coin flip, and the paper proves it never rises with the evidence (Lemma 1(a), chapter 4).";
  if (!tap) return where + why;
  return `You tapped near the sample at time ${f2(tap.t)}, evidence ${f2(tap.y)}, where W = ${f3(tap.W)}. ` + where + why;
}

/** Under the slice: the values at y = 0 and where V meets g. forced: the time is the last moment itself. */
export function sliceSay(t, b, V0, W0, forced = false) {
  if (!(b > 0)) return forced ? `At time ${f2(t)}, the choice is forced: the bound is 0, and V = g at every y.`
    : `At time ${f2(t)}, the bound is 0: even at y = 0 the program decides at once, so V = g at every y.`;
  return `At time ${f2(t)}, deciding at y = 0 is a coin flip, worth 0.5; the best rule from there earns V = ${f3(V0)}, so the chance to wait is worth W = ${f3(W0)}. The bound, ${b < 0.1 ? f3(b) : f2(b)}, is where deciding starts to beat waiting, read between the grid's evidence points; at the grid points above it, V = g.`;
}

export function lastNote(last, deadline) {
  if (deadline !== null) return deadline > 2.5 + 1e-9
    ? `A deadline is a last moment already: the choice is forced at time ${ft(deadline)}, past the window, so the map and the bounds stop at 2.5, before the bound falls to 0.`
    : `A deadline is a last moment already: the choice is forced at time ${ft(deadline)}, and the bound falls to 0 there.`;
  if (last === "window") return "The choice is forced at time 2.5, the window's end. With a last moment, the value depends on the time left, so the bound falls toward 0 as that moment nears, as before a deadline.";
  return "The choice is forced 6 time units past the window, as an approximation to no last moment. The forced choice still changes the bound inside the window, and the change grows as time gets cheaper and decisions run longer.";
}

// ---- the flat bound -----------------------------------------------------------------------------------------------

/** After Show me on the reward curve. */
export function peakVerdict(guess, c, b, R, slope) {
  const fact = `The reward of a flat bound peaks at B(${fc(c)}) = ${f3(b)}, where it is ${f3(R)}. There, the chance of being right and the bill rise at the same rate, ${f3(slope)} per unit of evidence.`;
  if (guess === null || !Number.isFinite(guess)) return fact;
  const d = guess - b;
  const how = Math.abs(d) < 0.01 ? "within 0.01 of it" : `${f2(Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
  return `You put the peak at b = ${f2(guess)}, ${how}. ` + fact;
}

/** The line over the strip's plate, one per step. */
export const ROUTES_HEAD = [
  "Step 1: for three flat levels, the value of following that flat rule: it solves L V = c below the level and meets g there.",
  "Step 2: below its own level, cosh² y times each rule's slope is one curve (each piece ends at its dot); g's is ½ everywhere.",
  "Step 3: only the rule at B(c) meets g with a matching slope. Below B, a rule's value meets g at a corner; above it, the value dips under g just below its level.",
  "Step 4: the reward of a flat bound, g(b) − c b tanh b, is the value at y = 0 of following that rule: the dots are the three levels.",
  "Step 5: the reward's slope is sech² b times the bracket ½ − c (b + ½ sinh 2b); both cross 0 at B(c).",
];

export function routesSay(step, c, b) {
  const lhs = Math.sinh(2 * b) + 2 * b;
  if (step <= 2) return `At a cost of ${fc(c)}, the level where the slopes match is ${f3(b)}, and there sinh 2b + 2b = ${lhs.toPrecision(4)}, which is 1/c = ${(1 / c).toPrecision(4)}.`;
  return `At a cost of ${fc(c)}, the reward of a flat bound peaks at ${f3(b)}: the same level, from the same equation.`;
}

// ---- how the bound changes with the cost ----------------------------------------------------------------------------------

/** After Show me: the reader's B(2c) against the true one and the tangent's. */
export function doubleVerdict(guess, c, B1, B2, tan) {
  const fact = `Doubling the cost from ${fc(c)} to ${fc(2 * c)} lowers the bound from ${f3(B1)} to ${f3(B2)}. The tangent at ${fc(c)}, a linear estimate, gives ${f3(tan)}: B is convex, so its slope flattens as the cost grows, and the tangent overstates the drop.`;
  if (guess === null || !Number.isFinite(guess)) return fact;
  const d = guess - B2;
  const dir = guess > B1 + 1e-9 ? " You moved it up; a higher cost lowers the bound." : "";
  const how = Math.abs(d) < 0.01 ? "within 0.01 of it" : `${f2(Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
  return `You put B(${fc(2 * c)}) at ${f2(guess)}, ${how}.${dir} ` + fact;
}

/** As the reader slides the tangent. b01 is B(c + 0.01). */
export function slideSay(c, b, bp, b2, b01) {
  return `At c = ${ft(c)}, B = ${f3(b)} and B′ = ${f3(bp)}. For a cost higher by 0.01, the tangent estimates a drop of ${f3(-bp * 0.01)}; the bound drops by ${f3(b - b01)}. Doubling the cost lowers it by ${f3(b - b2)}, to ${f3(b2)}, or ${Math.round((100 * b2) / b)}% of where it was.`;
}

export const INVERSE_HEAD = [
  "Step 1: F(b) = sinh 2b + 2b rises, so it crosses the line 1/c once, at B(c). A cost 25% higher lowers the line, and the crossing moves left.",
  "Step 2: along the tangent at B, a change of 1/c moves b by that change divided by F′(B).",
  "Step 3: F′(b) = 2 cosh 2b + 2 (line) is 4 cosh² b (dots).",
  "Step 4: B(c) with its tangent of slope B′(c) = −1/(4c² cosh² B), and two points of a difference quotient.",
];

export function inverseSay(step, o) {
  if (step === 0) return `At c = ${fc(o.c)}, the crossing is at B = ${f3(o.b)}; at a cost 25% higher, at ${f3(o.b2)}.`;
  if (step === 1) return `The tangent predicts the bound moves by ${f3(o.dTan)}; it moves by ${f3(o.dTrue)}. For a smaller change of cost the two agree more closely: that is the derivative.`;
  if (step === 2) return `At B = ${f3(o.b)}, 2 cosh 2B + 2 = ${o.Fp.toPrecision(5)} and 4 cosh² B = ${o.fourCosh.toPrecision(5)}.`;
  return `B′(${fc(o.c)}) = ${f3(o.bp)} from the closed form, and ${f3(o.fd)} from a difference quotient over ±0.01% of the cost.`;
}
