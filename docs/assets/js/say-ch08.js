// The sentences under chapter 8's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch08.mjs runs these on many inputs and on the plates' own numbers.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(x * 100)}%`;
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** A small positive number as a reader writes it: 0.123, 0.00016, or 6.3 × 10⁻¹¹. */
export function num(x) {
  const a = Math.abs(x);
  if (a >= 0.01 || a === 0) return x.toFixed(3);
  if (a >= 1e-4) return x.toPrecision(2);
  const [m, e] = x.toExponential(1).split("e");
  return `${m} × 10${String(+e).split("").map((c) => SUP[c]).join("")}`;
}
const g3 = num;

/** A loss in points per 100 trials, signed: the program's reward less the rule's, on the same grid. A small
 * negative value means the rule scored a little above the program there (see gridNote). */
export function lossText(x) {
  const a = Math.abs(x), sign = x < 0 ? "−" : "";
  if (a >= 10) return sign + a.toFixed(1);
  if (a >= 1) return sign + a.toFixed(2);
  if (a >= 0.01 || a === 0) return sign + a.toFixed(3);
  return sign + num(a);
}

/** Said when a loss comes out below zero: what the reference is, and why it can be beaten by a hair. */
export function gridNote(loss) {
  const neg = ["pm", "avg", "wb"].filter((k) => loss[k] < 0);
  if (!neg.length) return "";
  return " A negative loss means the rule scored a little above the dynamic program's bound on this grid. The program chooses the best decision at each of the grid's evidence points, while the scorer reads any bound, the program's own included, by splitting the cell it falls in, so a nearby bound can score slightly higher than the program's.";
}

export function heroLabel(t, share, bound) {
  return `Time ${f2(t)}: ${pct(share)} of its kernel lies before the deadline; the bound is ${f2(bound)}`;
}

// ---- average the costs, or the bounds

/** Plotted stretches [[first, last], ...] as words: "from 0.48 to 1.72", "at time 0.5", joined with "and". */
export function stretchText(st) {
  return st.map(([a, b]) => (Math.abs(b - a) < 1e-9 ? `at time ${f2(a)}` : `from ${f2(a)} to ${f2(b)}`)).join(" and ");
}

/** The paper's code's averaged-cost rule on a deadline, where it differs from the definition's 0. */
function codeText(stretches, avgCodeLoss) {
  return ` The paper's code builds each time's kernel for that time's cost and averages the costs at that kernel's 240 bin midpoints, the last bin ending at 14/λ₁; it gives 0 when any of those midpoints falls past the deadline. Here its averaged-cost bound is above 0 at the plotted times ${stretchText(stretches)}, and it loses ${lossText(avgCodeLoss)}.`;
}

/** stretches: where the paper's code keeps the averaged-cost bound above 0 on a deadline (empty if nowhere). */
export function twoSay(label, loss, deadline, added, stretches = []) {
  const L = lossText;
  if (deadline !== null) {
    let s = `With ${added ? "a deadline added" : "the deadline"} at ${+deadline.toFixed(2)}, the averaged-cost rule's bound, by its definition, is 0 throughout: it decides at once and loses ${L(loss.avg)} points per 100 trials. ` +
      `The weighted rule's bound stays above 0 until the deadline and loses ${L(loss.wb)}; the per-moment rule loses ${L(loss.pm)}. ` +
      "On a deadline the paper treats both rules as heuristics and measures them.";
    if (stretches.length) s += codeText(stretches, loss.avgCode);
    return s + gridNote(loss);
  }
  let s = `On ${label}, the weighted rule loses ${L(loss.wb)} points per 100 trials, the per-moment rule ${L(loss.pm)}, and the averaged-cost rule ${L(loss.avg)}. `;
  if (Math.max(Math.abs(loss.pm), Math.abs(loss.avg), Math.abs(loss.wb)) < 0.001) s += "All three are within a thousandth of a point of the program here.";
  else if (loss.avg > loss.pm) s += "Here averaging the costs does worse than not looking ahead at all.";
  else if (loss.avg < loss.wb) s += "Here averaging the costs loses a little less than averaging the bounds.";
  else s += "Here averaging the bounds loses the least of the three.";
  return s + gridNote(loss);
}

export function twoVerdict(guess, hasDeadline, stretches = []) {
  if (!guess) return "";
  if (!hasDeadline) return "Now add a deadline to see.";
  const code = stretches.length ? ` The paper's code, which averages the costs only at its kernel's bin midpoints, gives a bound above 0 at the plotted times ${stretchText(stretches)} here, where no midpoint falls past the deadline: that is the rule as computed, not as defined.` : "";
  if (guess === "zero") return "Right, by the paper's definition: its bound is 0 from the start. The kernel puts weight past the deadline at every earlier time, and the average of a cost that is infinite there is infinite. The weighted rule's bound stays above 0 until the deadline instead." + code;
  if (guess === "smooth") return "By the paper's definition it doesn't: its bound is 0 from the start, because the kernel puts weight past the deadline, where the cost is infinite, so the average is infinite at every earlier time. Whether the weighted rule's bound comes down smoothly depends on the schedule; the chart shows it on yours." + code;
  return "By the paper's definition it doesn't wait for the deadline: its bound is 0 from the start, because at every earlier time the kernel puts weight past the deadline, and the average of a cost that is infinite there is infinite." + code;
}

// ---- thirty updates

/** The first update from which no later one (up to the last) moves any time by more than tol; null if none. */
export function settledAt(change, tol = 1e-3) {
  let k = change.length;
  while (k > 0 && change[k - 1] <= tol) k--;
  return k < change.length ? k + 1 : null;
}

export function iterateSay(k, move, where, settle, last, reveal = true) {
  let s = k === 0 ? "Update 0 is the per-moment bound, where the iteration starts. "
    : `Update ${k} moved the bound by at most ${g3(move)}, at time ${f2(where)}. `;
  if (!reveal) return s + "Guess how many updates it takes to settle, or show me.";
  if (settle !== null) s += `From update ${settle} through update 30, no time moves by more than 0.001.`;
  else s += `The 30th update still moves some time by ${g3(last)}: the iteration hasn't settled there by update 30, and this output is what the experiments use.`;
  return s;
}

const BAND = { 3: "about 3", 10: "about 10", 20: "about 20", never: "not within 30" };
export function iterateVerdict(guess, settle, last) {
  const cat = settle === null ? "never" : settle <= 5 ? "3" : settle <= 14 ? "10" : "20";
  const fact = settle === null
    ? `It hasn't settled by update 30: the 30th still moves some time by ${g3(last)}.`
    : `From update ${settle} through update 30, no move is above 0.001.`;
  if (!guess) return fact;
  if (guess === cat) return `Right. ${fact}`;
  if (guess === "never") return `${fact} You guessed it wouldn't settle within 30.`;
  if (settle === null) return `${fact} You guessed ${BAND[guess]}.`;
  const off = Math.abs(settle - +guess);
  return `${fact} You guessed ${BAND[guess]}, ${off} off.`;
}

export function moreSay(move, at, end) {
  const where = `over the times 0, 0.01, … before ${+end.toFixed(2)}`;
  if (move === 0) return `300 updates instead of 30 leave this bound where the 30th left it, ${where}.`;
  return `300 updates instead of 30 move this bound by at most ${num(move)}, at time ${f2(at)}, ${where}.`;
}

/** The note over the first plate: its own deadline, an unchanged constant cost, or how to add a deadline. */
export function twoNote(ownDeadline, isConstant, added) {
  if (ownDeadline !== null) return `Your schedule has its own deadline, at ${ownDeadline}.`;
  if (isConstant && added === null) return constantNote();
  if (added !== null) return `A deadline added at ${added}: the cost is infinite after it.`;
  return "Add a deadline to make the cost infinite after it.";
}

export function constantNote() {
  return "A constant cost has nothing to look ahead to: every rule gives the constant-cost bound, and the updates don't move it.";
}

// ---- Proposition 13

export function p13Say(step, d) {
  if (step === 0) return `At ε = ${pct(d.eps)}, I = [${f3(d.lo)}, ${f3(d.hi)}], and at the 41 levels computed the map's values run from ${f3(d.min)} to ${f3(d.max)}: inside I, and crossing the diagonal ${d.crossings === 1 ? "once" : d.crossings + " times"}.`;
  if (step === 1) return `Each kernel integrates to 1, so its change in the level has as much area above zero as below: ${(d.above).toFixed(4)} above and ${(d.below).toFixed(4)} below, at b₀.`;
  if (step === 2) return `At ε = ${pct(d.eps)}, the steepest secant slope between neighboring levels on I is ${f3(d.slope)}. Divided by ε, it runs from ${f3(d.ratios[0])} at the largest of the four sizes to ${f3(d.ratios[d.ratios.length - 1])} at the smallest, as a slope of order ε would.`;
  if (step === 3) return `At ε = ${pct(d.eps)}, Algorithm 1's output is within ${g3(d.err)} of b₀ + εβ. Divided by ε², that runs from ${f3(d.ratios[0])} at the largest of the four sizes to ${f3(d.ratios[d.ratios.length - 1])} at the smallest, as a second-order difference would; the proposition proves it for the equation's exact solution.`;
  if (step === 4) return `Divided by ε, Algorithm 1's move is within ${g3(d.wb)} of β at ε = ${pct(d.eps)}, against ${f3(d.pm)} for the per-moment rule's; over the four sizes, its gap runs from ${f3(d.wbs[0])} to ${f3(d.wbs[d.wbs.length - 1])} and the per-moment rule's from ${f3(d.pms[0])} to ${f3(d.pms[d.pms.length - 1])}.`;
  return `At the frequencies sampled from 0.5 to 20, |1 − w̃(−iω)| is at least ${f3(d.min)}; it is 0 at ω = 0.`;
}

// ---- two levels that both fit

const COUNT = ["no", "one", "two", "three", "four", "five"];
export const countWord = (n) => COUNT[n] ?? String(n);

export function rootsVerdict(guess, roots) {
  if (!guess) return "";
  const n = roots.length;
  const settle = roots.filter((r) => r.slope > -3 && r.slope < 1).length;
  let fact = n === 1 ? "The search finds one crossing in this computed map." : `The search finds ${countWord(n)} crossings in this computed map`;
  if (n > 1) fact += settle < n ? `, and by the local test the damped updates can settle at ${countWord(settle)} of them.` : ".";
  const right = (guess === "one" && n === 1) || (guess === "two" && n === 2) || (guess === "more" && n > 2);
  return (right ? "Right. " : guess === "one" ? "More than one. " : "") + fact;
}

export function rootsSay(b, Tb, start, end) {
  const d = Tb - b;
  const fit = Math.abs(d) < 1e-6 ? "within 10⁻⁶ of the level in this computed map, the threshold this page uses to report a fit"
    : `${num(Math.abs(d))} ${d > 0 ? "above" : "below"} the level, so it doesn't fit`;
  return `At the level ${f3(b)}, the per-moment bounds ahead average to ${f3(Tb)}, ${fit}. ` +
    `The 30 damped updates from the per-moment bound, ${f3(start)}, end at ${f3(end)}.`;
}

/** The local test for the ideal damped update b <- (b + T(b))/2 at a crossing where T has slope s: its own slope is
 * (1 + s)/2, so it moves toward the crossing when -3 < s < 1 and away when s < -3 or s > 1; at s = -3 or 1 the linear
 * test decides nothing. */
export function rootRole(slope) {
  const verdict = slope > -3 && slope < 1 ? "damped updates move toward it" : slope < -3 || slope > 1 ? "damped updates move away" : "the linear test decides nothing";
  // near a boundary, print the slope against it, so the side shows
  const edge = Math.abs(slope - 1) < 0.05 ? 1 : Math.abs(slope + 3) < 0.05 ? -3 : null;
  const shown = edge === null ? slope.toFixed(2) : `${edge} ${slope >= edge ? "+" : "−"} ${num(Math.abs(slope - edge))}`;
  return `slope ${shown}: ${verdict}`;
}

/** Said under the first plate when, at some grid times, the program's bound falls between the center and the grid's
 * first step. */
export function subStepNote(count) {
  if (!count) return "";
  return ` At ${count} of the grid's times, the program waits at 0 evidence but decides at the grid's first step, 0.02; its bound is placed between the two there, where its own step changes from waiting to deciding (the paper's code reports 0 at such times).`;
}

// ---- Algorithm 1, one step at a time

export function algoSay(step, v) {
  if (step === 0) return `At time ${f2(v.t)}, the cost is ${g3(v.c)}, and the per-moment bound B(c) is ${f3(v.b)}: the start.`;
  if (step === 1) return `The level ${f3(v.b)} gives ℓ = ${f3(v.l)}. Its kernel's 240 bins reach out to ${f2(v.top)} time units ahead; the first bin, from 0 to 10⁻⁵, holds ${(v.first * 100).toFixed(1)}% of the weight.`;
  if (step === 2) return `Averaged with that kernel, the per-moment bounds ahead give a = ${f3(v.a)}, against the level ${f3(v.b)}; the update moves the level halfway, to ${f3((v.a + v.b) / 2)}.`;
  if (step === 3) return `Moving halfway each time, the level goes from ${f3(v.b0)} to ${f3(v.b30)} in 30 updates, with ${v.kernels} kernel${v.kernels === 1 ? "" : "s"} for this time; the last update moved it by ${g3(v.last)}.`;
  return `Moved in by 0.5826 √0.01 = ${f3(v.shift)}, the rule's bound at time ${f2(v.t)} is ${f3(v.x)}; the dynamic program's is ${f3(v.ex)}.`;
}
