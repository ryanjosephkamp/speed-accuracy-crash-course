// The sentences chapter 2's plates print, as functions of the numbers they show. Pure: no page, no model.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const num = (x) => Math.round(x).toLocaleString("en-US");
const pct = (x) => `${Math.round(x * 100)}%`;
/** A coherence as the page prints it: 0.064 -> "6.4%". */
export const cohText = (coh) => `${+(coh * 100).toFixed(1)}%`;

/** While a plate samples in slices: how far it has got. */
export const progressSay = (what, k, n) => `${what === "pairs" ? "Running pairs" : "Sampling trials"}… ${num(k)} of ${num(n)}`;

// ---------------------------------------------------------------- the hero
const HERO = [
  "Evidence in the paper's units: drift +1 or −1, noise of size 1",
  "The same axis read as belief: g(x) = 1/(1 + e⁻²ˣ)",
  "Folded at zero: Y = |X| drifts away from 0, at rate tanh Y",
  "Two starts on the same noise keep their order",
];
export const heroLabel = (i) => HERO[i];

// ---------------------------------------------------------------- units
/** The units plate's sentence: what one time unit and one unit of evidence are, for the drift and noise set. */
export function unitsSay(mu, sigma) {
  const T = (sigma * sigma) / (mu * mu), E = (sigma * sigma) / mu;
  return `With drift ${f2(mu)} and noise ${f2(sigma)}, the drift line and the noise curve meet at time ${f3(T)}, at evidence ${f3(E)}: one of the paper's time units and one of its units of evidence. In those units the path is the same for every drift and noise.`;
}
/** After the guess about the Palmer observer: ms is one time unit in milliseconds, computed in the page. */
export function palmerVerdict(guess, ms) {
  const fact = `At 6.4% coherence the drift is 21 × 0.064 per second with noise variance 1 per second, so one time unit is 1/(21 × 0.064)² seconds, ${Math.round(ms)} ms.`;
  if (guess === "half") return "Right, about half a second. " + fact;
  if (guess === "fifty") return "Longer than that: about half a second. " + fact;
  if (guess === "five") return "Shorter than that: about half a second. " + fact;
  return fact;
}

// ---------------------------------------------------------------- your schedule
/** The schedule plate's sentence. unitMs is one time unit in ms, or null for the paper's units. */
export function yoursSay({ label, unitMs, view, b0, b1, deadline, g }) {
  const span = unitMs === null ? `${view} time units` : `${view} time units, ${num(view * unitMs)} ms`;
  let s = `On ${label.toLowerCase()}, the window is ${span}. The best bound starts at ${f2(b0)}, where a decision is right with probability ${f2(g(b0))}, `;
  if (deadline !== null && deadline !== undefined) s += `and falls to ${f2(b1)} at the deadline, where the choice is ${b1 < 0.005 ? "a coin flip" : `right with probability ${f2(g(b1))}`}.`;
  else s += `and is ${f2(b1)} at the end, right with probability ${f2(g(b1))}.`;
  return s;
}
export function costUnitNote(unitMs, coh) {
  if (unitMs === null) return "Costs are per time unit, in units of the reward for a correct choice.";
  return `At ${cohText(coh)} coherence, one time unit is ${num(unitMs)} ms, so a cost of c per time unit is ${f2(1000 / unitMs)}c per second.`;
}

// ---------------------------------------------------------------- belief
export const BELIEF_HEADS = [
  "Step 1: the evidence at time t under each answer. The ratio of the two densities at x is e²ˣ, at every t.",
  "Step 2: sampled trials, with the H = +1 part of each bar in ink. By Bayes' rule, the ink share of a bar estimates the posterior there.",
  "Step 3: the share with H = +1 in each bin (dots, two standard errors) beside g(x).",
  "Step 4: the mean of the next time unit's evidence in each bin (dots, two standard errors) beside tanh x.",
  "Step 5: the innovation, the evidence minus the drift the decision maker expected, for 40 trials (one in ink).",
];
/** After the guess at g(1). */
export function gVerdict(guess, g1) {
  const fact = `g(1) = 1/(1 + e⁻²) = ${f3(g1)}: one unit of evidence makes H = +1 about ${(g1 / (1 - g1)).toFixed(1)} times as likely as H = −1.`;
  if (guess === null || guess === undefined) return fact;
  if (Math.abs(guess - g1) < 0.01) return "Right. " + fact;
  if (Math.abs(guess - 0.731) < 0.01) return "That is 1/(1 + e⁻¹), which takes the log odds to be x; they are 2x. " + fact;
  if (Math.abs(guess - 0.841) < 0.01) return "That is Φ(1), the chance that the evidence at time 1 has the right sign, averaged over all the evidence you might have then. " + fact;
  if (guess > g1) return `Too sure: a belief of ${f2(guess)} takes evidence of about ${f2(0.5 * Math.log(guess / (1 - guess)))}. ` + fact;
  return "Too cautious. " + fact;
}
export function ratioSay(t, ratio) {
  return `At t = ${t}, the density of the evidence at x = 1 is ${f2(ratio)} times as high under H = +1 as under H = −1. That is e² = ${f2(Math.exp(2))}, whatever t is: the ratio depends on where the evidence is, not on when.`;
}
export function barSay(t, n, up, a, b) {
  const ab = `between ${+a.toFixed(3)} and ${+b.toFixed(3)}`;
  if (!n) return `At t = ${t}, no trial landed ${ab}; draw new trials.`;
  return `At t = ${t}, ${num(n)} trials landed ${ab}, and ${num(up)} of them had H = +1: a share of ${f3(up / n)}.`;
}
/** z is the largest miss of the bins (in standard errors of the exact value), of k bins with at least 20 trials. */
export function binSay(t, trialsN, k, z, what) {
  const ok = z < 3 ? "within the spread that chance alone gives" : "a larger miss than chance usually gives; draw new trials to see";
  return `At t = ${t}, over ${num(trialsN)} trials and ${k} bins, the largest miss from the exact ${what} is ${z.toFixed(1)} standard errors, ${ok}. With ${k} bins, the largest of ${k} misses is under 3 about ${pct((1 - 0.0027) ** k)} of the time.`;
}
export function innovationSay(T, v, vSE, r, rSE) {
  return `Over these trials, the innovation at time ${T} has variance ${f3(v)} ± ${f3(2 * vSE)}, against ${T} for a Brownian motion, and its later increment, from time ${T / 2} to ${T}, has correlation ${f3(r)} ± ${f3(2 * rSE)} with tanh X at time ${T / 2}.`;
}

// ---------------------------------------------------------------- the fold
export function foldVerdict(guess) {
  const fact = "Away from 0, Y drifts away from it at rate tanh Y, and at 0 it is pushed back up.";
  if (guess === "away") return "Right. " + fact;
  if (guess === "toward") return "The other way. The sign of X and the sign of its drift tanh X agree, so the size of X grows on average. " + fact;
  if (guess === "none") return "It does drift. " + fact;
  return fact;
}
export function foldSay(h, at0, at1, gapHalf) {
  return `Over h = ${h}, the measured drift at y = 1 is ${f3(at1)}, against tanh 1 = ${f3(Math.tanh(1))}; above y = 0.5 it is within ${gapHalf < 0.0005 ? "0.0005" : f3(gapHalf)} of tanh y. At y = 0 it is ${f2(at0)}, and it grows like √(2/(πh)) as h shrinks: that is the reflection.`;
}
export function pathSay(T, touches, l, steps) {
  if (!touches) return `On this path, X never changes sign before time ${T}, so ℓ stays 0 and Y is X.`;
  return `On this path, X changes sign on ${touches} of the ${num(steps)} steps before time ${T}. ℓ grows only on those steps, to ${f3(l)}, and wherever X is below 0, Y is its mirror image.`;
}

// ---------------------------------------------------------------- the three facts
export const FACT_HEADS = [
  "Step 1: g(1 − g) (dots) on 1/(4 cosh² y) (line).",
  "Step 2: g′(y) = 1/(2 cosh² y) (ink) and central difference quotients of g (dots), beside g (gray).",
  "Step 3: the two terms of 𝓛g, ½g″ (gray) and tanh(y)·g′ (thin), and their sum (ink).",
  "Step 4: both sides of the identity for the test function you pick: (cosh² y·f′)′ by difference quotients (dots), 2 cosh² y·𝓛f (line).",
  "Step 5: the mean time for Y to reach b, b tanh b − y tanh y (line), and sampled runs from four starts (dots, two standard errors).",
];
export function factSay(step, worst, extra = {}) {
  const e = worst.toExponential(1);
  if (step === 0) return `Over y from −3 to 3, the two sides differ by at most ${e}: rounding, not a difference.`;
  if (step === 1) return `The difference quotients with step 0.01 are within ${e} of g′, which is the size of their own error, about h²/6 times g‴.`;
  if (step === 2) return `The two terms cancel: from the closed forms, 𝓛g is at most ${e} in size over y from −3 to 3.`;
  if (step === 3) {
    if (extra.zero) return `For f = g, both sides are 0, since cosh² y·g′ = ½ and 𝓛g = 0: the identity contains step 3. The difference quotients are within ${e} of 0.`;
    return `For f = ${extra.label}, the two sides differ by at most ${e} relative to their size, the error of the difference quotients.`;
  }
  return "";
}
export function exitSay(c, b, m0, mean, se, runs) {
  let s = `At c = ${c}, the flat bound is ${f3(b)}, and from y = 0 the mean time to reach it is b tanh b = ${f3(m0)}.`;
  if (runs > 0) s += ` The ${num(runs)} runs from 0 so far average ${f3(mean)} ± ${f3(2 * se)}.`;
  return s;
}

// ---------------------------------------------------------------- the coupling
export function coupleVerdict(guess) {
  const fact = "On the same noise they can meet, at 0, and from then on they are one path; before that, the one that started higher stays higher.";
  if (guess === "meet") return "Right. " + fact;
  if (guess === "cross") return "Not on the same noise. " + fact;
  if (guess === "never") return "They can meet. " + fact;
  return fact;
}
export const COUPLE_HEADS = [
  "Step 1: the free path U (gray), its reflection Y = U + ℓ (ink), and ℓ, the furthest U has been below 0 (dotted).",
  "Step 2: Picard iterates (gray, darker with each pass) closing on the solution (ink).",
  "Step 3: Y from two starts.",
  "Step 4: the gap between the two paths for 1,000 pairs (gray, 40 drawn) and its smallest value at each time (ink).",
  "Step 5: the local time each path collects at 0.",
];
export function skorokhodSay(grew, n) {
  return `Y never goes below 0: ℓ, the furthest the free path has been below 0 so far, is added back. It grew on ${grew} of ${num(n)} steps, and each of those steps ends with Y at 0.`;
}
export function picardSay(d) {
  return `The largest distance from the solution is ${d.map((v) => v.toExponential(1)).join(", ")} after 1, 2, 4, and 8 passes.`;
}
export function pairSay(same, meet, cross) {
  if (same) return meet === null ? "On this noise path the two never meet before time 3: the lower one stays below." : `They meet at time ${f2(meet)}, when the upper one first reaches 0, and are one path after it.`;
  return cross ? `With independent noise they cross ${cross} ${cross === 1 ? "time" : "times"} before time 3.` : "With independent noise they happen not to cross on this draw; draw new noise.";
}
export function pairsSay(same, n, crossed, merged) {
  if (same) return `Of ${num(n)} pairs on shared noise, ${num(crossed)} crossed, and ${num(merged)} had met and become one path by time 3.`;
  return `With independent noise, ${num(crossed)} of ${num(n)} pairs crossed before time 3.`;
}
export function localSay(same, n, ordered, l1, l2) {
  const pair = `On this pair, the lower start collects ℓ = ${f3(l1)} by time 3 and the upper ${f3(l2)}.`;
  if (same) return `${pair} In ${num(ordered)} of ${num(n)} pairs, the lower start collects at least as much.`;
  return `${pair} With independent noise, the lower start collects at least as much in only ${num(ordered)} of ${num(n)} pairs.`;
}
