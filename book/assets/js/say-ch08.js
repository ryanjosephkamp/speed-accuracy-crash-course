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

/** A loss in points per 100 trials, to the digits that mean something on the page's grid. */
export function lossText(x) {
  if (!(x >= 0.0005)) return "less than 0.001";
  return x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3);
}

export function heroLabel(t, share, bound) {
  return `Time ${f2(t)}: ${pct(share)} of its kernel lies before the deadline; the bound is ${f2(bound)}`;
}

// ---- average the costs, or the bounds

export function twoSay(label, loss, deadline, added) {
  const L = lossText;
  if (deadline !== null) {
    return `With ${added ? "a deadline added" : "the deadline"} at ${+deadline.toFixed(2)}, the averaged-cost rule's bound is 0 throughout: it decides at once and loses ${L(loss.avg)} points per 100 trials. ` +
      `The weighted rule's bound comes down toward the deadline and loses ${L(loss.wb)}; the per-moment rule loses ${L(loss.pm)}. ` +
      "On a deadline both rules are heuristics: no theorem covers them there.";
  }
  let s = `On ${label}, the weighted rule loses ${L(loss.wb)} points per 100 trials, the per-moment rule ${L(loss.pm)}, and the averaged-cost rule ${L(loss.avg)}. `;
  if (loss.avg > loss.pm && loss.avg > 0.0005) s += "Here averaging the costs does worse than not looking ahead at all.";
  else if (loss.avg < loss.wb) s += "Here averaging the costs loses a little less than averaging the bounds.";
  else if (loss.pm < 0.0005 && loss.wb < 0.0005) s += "No rule loses anything measurable here.";
  else s += "Here averaging the bounds loses the least of the three.";
  return s;
}

export function twoVerdict(guess, hasDeadline) {
  if (!guess) return "";
  if (!hasDeadline) return "Now add a deadline to see.";
  if (guess === "zero") return "Right: its bound is 0 from the start. The kernel puts weight past the deadline at every earlier time, and the average of a cost that is infinite there is infinite. The weighted rule's bound comes down smoothly instead.";
  if (guess === "smooth") return "That is what the weighted rule does. The averaged-cost rule drops to 0 at once: the kernel puts weight past the deadline, where the cost is infinite, so the average is infinite from the start.";
  return "It doesn't wait for the deadline: its bound is 0 from the start, because at every earlier time the kernel puts weight past the deadline, and the average of a cost that is infinite there is infinite.";
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
  if (settle !== null) s += `From update ${settle} on, no time moves by more than 0.001.`;
  else s += `After 30 updates some times still move by up to ${g3(last)} per update: the iteration hasn't settled there, and this output is what the experiments use.`;
  return s;
}

const BAND = { 3: "about 3", 10: "about 10", 20: "about 20", never: "not within 30" };
export function iterateVerdict(guess, settle, last) {
  const cat = settle === null ? "never" : settle <= 5 ? "3" : settle <= 14 ? "10" : "20";
  const fact = settle === null
    ? `It hasn't settled after 30 updates: the 30th still moves some time by ${g3(last)}.`
    : `It took ${settle} update${settle === 1 ? "" : "s"}.`;
  if (!guess) return fact;
  if (guess === cat) return `Right. ${fact}`;
  if (guess === "never") return `${fact} You guessed it wouldn't settle within 30.`;
  if (settle === null) return `${fact} You guessed ${BAND[guess]}.`;
  const off = Math.abs(settle - +guess);
  return `${fact} You guessed ${BAND[guess]}, ${off} off.`;
}

export function moreSay(move, at, end) {
  const where = `over the times before ${+end.toFixed(2)}`;
  if (move < 1e-4) return `300 updates instead of 30 move this bound by at most ${num(move)} ${where}: the 30th update had settled.`;
  return `300 updates instead of 30 move this bound by at most ${f3(move)}, at time ${f2(at)}, ${where}.`;
}

export function constantNote() {
  return "A constant cost has nothing to look ahead to: every rule gives the constant-cost bound, and the updates don't move it.";
}

// ---- Proposition 13

export function p13Say(step, d) {
  if (step === 0) return `At ε = ${pct(d.eps)}, I = [${f3(d.lo)}, ${f3(d.hi)}], and the map's values run from ${f3(d.min)} to ${f3(d.max)}: inside I, and crossing the diagonal ${d.crossings === 1 ? "once" : d.crossings + " times"}.`;
  if (step === 1) return `Each kernel integrates to 1, so its change in the level has as much area above zero as below: ${(d.above).toFixed(4)} above and ${(d.below).toFixed(4)} below, at b₀.`;
  if (step === 2) return `At ε = ${pct(d.eps)}, the map's steepest slope on I is ${f3(d.slope)}. Divided by ε, the slope runs from ${f3(d.ratios[0])} at the largest size to ${f3(d.ratios[d.ratios.length - 1])} at the smallest: it stays bounded, so the slope shrinks with ε.`;
  if (step === 3) return `At ε = ${pct(d.eps)}, the rule is within ${g3(d.err)} of b₀ + εβ. Divided by ε², that runs from ${f3(d.ratios[0])} at the largest size to ${f3(d.ratios[d.ratios.length - 1])} at the smallest: second order.`;
  if (step === 4) return `Divided by ε, the weighted rule's move is within ${g3(d.wb)} of β at ε = ${pct(d.eps)}, while the per-moment rule's misses β by ${f3(d.pm)}, and that gap doesn't shrink with ε.`;
  return `On this range, |1 − w̃(−iω)| is 0 only at ω = 0, and at least ${f3(d.min)} for ω ≥ 0.5.`;
}

// ---- two levels that both fit

const COUNT = ["no", "one", "two", "three", "four", "five"];
export const countWord = (n) => COUNT[n] ?? String(n);

export function rootsVerdict(guess, roots) {
  if (!guess) return "";
  const n = roots.length;
  const settle = roots.filter((r) => r.slope > -3 && r.slope < 1).length;
  let fact = n === 1 ? "One level fits here." : `${countWord(n)[0].toUpperCase() + countWord(n).slice(1)} levels fit here`;
  if (n > 1) fact += settle < n ? `, and the damped updates can settle at ${countWord(settle)} of them.` : ".";
  const right = (guess === "one" && n === 1) || (guess === "two" && n === 2) || (guess === "more" && n > 2);
  return (right ? "Right. " : guess === "one" ? "More than one. " : "") + fact;
}

export function rootsSay(b, Tb, start, end) {
  const d = Tb - b;
  const fit = Math.abs(d) < 0.005 ? "so this level about fits"
    : d > 0 ? "higher than the level, so it doesn't fit" : "lower than the level, so it doesn't fit";
  return `At the level ${f3(b)}, the per-moment bounds ahead average to ${f3(Tb)}, ${fit}. ` +
    `The 30 damped updates from the per-moment bound, ${f3(start)}, end at ${f3(end)}.`;
}

export function rootRole(slope) {
  return slope > -3 && slope < 1 ? "updates settle here" : "updates move away";
}

// ---- Algorithm 1, one step at a time

export function algoSay(step, v) {
  if (step === 0) return `At time ${f2(v.t)}, the cost is ${g3(v.c)}, and the per-moment bound B(c) is ${f3(v.b)}: the start.`;
  if (step === 1) return `The level ${f3(v.b)} gives ℓ = ${f3(v.l)}. Its kernel's 240 bins reach out to ${f2(v.top)} time units ahead; the first bin, from 0 to 10⁻⁵, holds ${(v.first * 100).toFixed(1)}% of the weight.`;
  if (step === 2) return `Averaged with that kernel, the per-moment bounds ahead give a = ${f3(v.a)}, against the level ${f3(v.b)}; the update moves the level halfway, to ${f3((v.a + v.b) / 2)}.`;
  if (step === 3) return `Moving halfway each time, the level goes from ${f3(v.b0)} to ${f3(v.b30)} in 30 updates, with ${v.kernels} kernel${v.kernels === 1 ? "" : "s"} for this time; the last update moved it by ${g3(v.last)}.`;
  return `Moved in by 0.5826 √0.01 = ${f3(v.shift)}, the rule's bound at time ${f2(v.t)} is ${f3(v.x)}; the dynamic program's is ${f3(v.ex)}.`;
}
