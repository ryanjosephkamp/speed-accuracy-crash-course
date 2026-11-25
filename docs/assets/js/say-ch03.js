// The sentences chapter 3's plates print, as pure functions of the numbers they show. tools/checks/ch03.mjs runs them
// over random inputs and on the plates' own numbers.
import { B } from "./kernel.js?v=37a0cf8296";
const fx = (x, d) => { const s = x.toFixed(d); return /^-0\.?0*$/.test(s) ? s.slice(1) : s; };
const f2 = (x) => fx(x, 2), f3 = (x) => fx(x, 3);
/** A cost as the book prints it: two significant figures, no trailing zeros. */
export const fc = (c) => String(+(+c).toPrecision(2));
const pts = (x) => fx(100 * x, 1);

/** The hero's label for one cost. */
export const heroLabel = (c, b) => `At a cost of ${fc(c)}, the reward of a flat bound peaks at b = ${f2(b)}`;

// ---- what a decision earns ------------------------------------------------------------------------------------

/** One path's outcome. o: { b, tau, side, forced, deadline, xT, right, bill } (right is the chance it was right). */
export function pathSay(o) {
  if (o.forced) {
    return `This path is still open at the deadline, time ${fc(o.deadline)}, so the choice is forced at evidence ${f2(o.xT)}: it is right with chance ${f2(o.right)}, and the time cost ${f3(o.bill)}, so it nets ${f3(o.right - o.bill)}.`;
  }
  return `This path reaches ${o.side > 0 ? "+" : "−"}${f2(o.b)} at time ${f2(o.tau)} and chooses ${o.side > 0 ? "+1" : "−1"}: it is right with chance g(b) = ${f2(o.right)}, and the time cost ${f3(o.bill)}, so it nets ${f3(o.right - o.bill)}.`;
}

/** After Show me: the reader's bound against the best flat bound, and the best flat bound against the best bound that
 * moves, both on the dynamic program's grid (dp is V(0, 0) there, flatGrid the best flat bound scored there). */
export function earnVerdict({ b, mine, best, dp, flatGrid, deadline }) {
  const gap = best.net - mine.net;
  let s = `Your bound, ${f2(b)}, earns ${f3(mine.net)} on average: ${f3(mine.reward)} for being right, minus ${f3(mine.bill)} for time. `;
  s += `The best flat bound${deadline !== null ? " with the forced choice" : ""} is ${f2(best.b)}, earning ${f3(best.net)}`;
  s += Math.abs(b - best.b) < 0.02 || gap < 5e-5 ? ", so yours is as good to the plate's precision." : `, so yours earns ${pts(gap)} points per 100 decisions less.`;
  if (Number.isFinite(dp) && Number.isFinite(flatGrid)) {
    const more = dp - flatGrid;
    s += ` On the dynamic program's grid, which checks the evidence every 0.01 time units, the best flat bound earns ${f3(flatGrid)}`;
    s += more >= 0.0005 ? ` and the best bound that moves with the cost earns ${f3(dp)}: ${pts(more)} points per 100 decisions more.`
      : ` and the best bound that moves earns ${f3(dp)}: on this schedule, moving gains less than 0.05 points per 100 decisions.`;
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
      return `${label}: its changes are logistic steps 0.05 time units wide, so the cost is continuous, and it stays ${band} for all time. The assumption holds, so the exact equation of chapter 5 covers it. Theorem 7 needs more: a small change (chapter 6).`;
    case "smooth":
      return `${label}: continuous, and ${band} for all time. The assumption holds, so the exact equation of chapter 5 covers it; Theorem 7 also needs the change to be small (chapter 6).`;
    case "rising":
      return `${label}: continuous, but it rises without end, so no upper level c_max exists and the assumption fails. The exact equation and Theorem 7 don't cover it; the dynamic program still computes its bound.`;
    case "deadline":
      return `${label === "Your drawing" ? "Your drawing, ended with a forced choice at time 2.5" : `A deadline at time ${fc(st.at)}`}: past it the cost is infinite, so it is neither continuous nor bounded, and the assumption fails. The paper's experiments force the choice at the deadline and judge its rules there by measurement (Section 5).`;
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

/** After Show me on the map. guess: { t, y, W } or null; best: { t, W } at y = 0. */
export function valueVerdict(guess, best) {
  const where = `Waiting is worth the most at time ${f2(best.t)} with no evidence, y = 0, where W = ${f3(best.W)}.`;
  const why = " At every time, W is largest at y = 0, where deciding is a coin flip, and the paper proves it never rises with the evidence (Lemma 1(a), chapter 4).";
  if (!guess) return where + why;
  return `You tapped time ${f2(guess.t)}, evidence ${f2(guess.y)}, where W = ${f3(guess.W)}. ` + where + why;
}

/** Under the slice: the values at y = 0 and where V meets g. */
export function sliceSay(t, b, V0, W0) {
  if (!(b > 0)) return `At time ${f2(t)}, the bound is 0: the choice is forced, and V = g at every y.`;
  return `At time ${f2(t)}, deciding at y = 0 is a coin flip, worth 0.5; the best rule from there earns V = ${f3(V0)}, so the chance to wait is worth W = ${f3(W0)}. V meets g at the bound, ${f2(b)}, and the two are equal above it.`;
}

export function lastNote(last, deadline) {
  if (deadline !== null) return `A deadline is a last moment already: the choice is forced at time ${fc(deadline)}, and the bound falls to 0 there.`;
  if (last === "window") return "The choice is forced at time 2.5, the window's end. With a last moment, the value depends on the time left, so the bound falls toward 0 as that moment nears, as before a deadline.";
  return "The choice is forced 6 time units past the window, standing in for no last moment. A forced choice that far off reaches back into the window only when time is very cheap and decisions run long.";
}

// ---- the flat bound -----------------------------------------------------------------------------------------------

/** After Show me on the reward curve. */
export function peakVerdict(guess, c, b, R, slope) {
  const fact = `The reward of a flat bound peaks at B(${fc(c)}) = ${f3(b)}, where it is ${f3(R)}. There, the chance of being right and the bill rise at the same rate, ${f3(slope)} per unit of evidence.`;
  if (guess === null || !Number.isFinite(guess)) return fact;
  const d = guess - b;
  const how = Math.abs(d) < 0.01 ? "right to two decimals" : `${f2(Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
  return `You put the peak at b = ${f2(guess)}, ${how}. ` + fact;
}

/** The line over the strip's plate, one per step. */
export const ROUTES_HEAD = [
  "Step 1: for three flat levels, the value that solves L V = c below the level and meets g there.",
  "Step 2: cosh² y times the value's slope is the same curve for every level; g's is ½ everywhere.",
  "Step 3: only B(c) meets g with a matching slope. Below it the curve meets g at a corner; above it, the curve dips under g.",
  "Step 4: the reward of a flat bound, g(b) − c b tanh b, is the value at y = 0 of the level's curve: the dots are the three levels.",
  "Step 5: the reward's slope is sech² b times the bracket ½ − c (b + ½ sinh 2b); both cross 0 at B(c).",
];

export function routesSay(step, c, b) {
  const lhs = Math.sinh(2 * b) + 2 * b;
  if (step <= 2) return `At a cost of ${fc(c)}, the level where the slopes match is ${f3(b)}, and there sinh 2b + 2b = ${lhs.toPrecision(4)}, which is 1/c = ${(1 / c).toPrecision(4)}.`;
  return `At a cost of ${fc(c)}, the reward of a flat bound peaks at ${f3(b)}: the same level, from the same equation.`;
}

// ---- how the bound answers a cost ----------------------------------------------------------------------------------

/** After Show me: the reader's B(2c) against the true one and the tangent's. */
export function doubleVerdict(guess, c, B1, B2, tan) {
  const fact = `Doubling the cost from ${fc(c)} to ${fc(2 * c)} lowers the bound from ${f3(B1)} to ${f3(B2)}. The tangent at ${fc(c)} would predict ${f3(tan)}: B is convex, so its slope flattens as the cost grows, and the tangent overstates the drop.`;
  if (guess === null || !Number.isFinite(guess)) return fact;
  const d = guess - B2;
  const dir = guess > B1 + 1e-9 ? " You moved it up; a higher cost lowers the bound." : "";
  const how = Math.abs(d) < 0.01 ? "right to two decimals" : `${f2(Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
  return `You put B(${fc(2 * c)}) at ${f2(guess)}, ${how}.${dir} ` + fact;
}

/** As the reader slides the tangent. */
export function slideSay(c, b, bp, b2) {
  return `At c = ${fc(c)}, B = ${f3(b)} and B′ = ${f3(bp)}: a cost higher by 0.01 lowers the bound by about ${f3(-bp * 0.01)}. Doubling the cost lowers it by ${f3(b - b2)}, to ${f3(b2)}, or ${Math.round((100 * b2) / b)}% of where it was.`;
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
