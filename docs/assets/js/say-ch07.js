// The sentences under chapter 7's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch07.mjs runs these on the plates' numbers.
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(x * 100)}%`;
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** A number for a sentence: two significant digits, and powers of ten written as 10⁻⁴ (never 1.0e-4). */
const sci = (x) => {
  if (x === 0) return "0";
  if (Math.abs(x) >= 0.001 && Math.abs(x) < 1000) return String(+x.toPrecision(2));
  const e = Math.floor(Math.log10(Math.abs(x))), mant = +(Math.abs(x) / 10 ** e).toFixed(1);
  const p = "10" + String(e).split("").map((c) => SUP[c]).join("");
  return (x < 0 ? "−" : "") + (mant === 1 ? p : `${mant} × ${p}`);
};
/** The same form for a plate's own readings. */
export const num = (x) => (Math.abs(x) >= 0.01 && Math.abs(x) < 1000 ? String(+x.toPrecision(2)) : sci(x));
const frac = (eps) => (eps >= 1 ? "1" : `1/${Math.round(1 / eps)}`);
const omegaText = (om) => (om >= 10 ? om.toFixed(0) : om >= 1 ? om.toFixed(1) : om.toFixed(2));

// ---- the hero and the sinusoid ----------------------------------------------------------------------------------

export function heroLabel(omega, gain, lead) {
  return `ω = ${omegaText(omega)}: the bound's swing is ${f2(gain)} of the per-moment swing, and ${f1(lead)}° ahead`;
}

export function waveVerdict(guess, cfLead, dpLead) {
  const fact = `At ω = 8 and c₀ = 0.1, the closed form puts the bound ${f1(cfLead)}° ahead of the per-moment response, and the paper's dynamic program measures ${f1(dpLead)}°.`;
  if (!Number.isFinite(guess)) return fact;
  const d = cfLead - guess;
  if (Math.abs(d) < 5) return `Your guess, ${Math.round(guess)}°, is within 5° of it. ` + fact;
  return `Your guess, ${Math.round(guess)}°, is ${f1(Math.abs(d))}° ${d > 0 ? "short" : "too far"}. ` + fact;
}

export function waveSay(c0, omega, gain, lead, timeLead, m) {
  let s = `At c₀ = ${c0} and ω = ${omegaText(omega)}, the bound swings ${f3(gain)} of the per-moment swing and runs ${f1(lead)}° ahead of it, `;
  s += `${f3(timeLead)} time units, against a mean look-ahead of ${f3(m)}.`;
  if (lead > 45) s += ` The lead is above 45° here: it tends to 45° at high frequency but isn't capped there.`;
  return s;
}

export const ARROW_HEADS = [
  "Step 1: the running integral of w(s) e^(iωs) turns as it grows and ends at the transform.",
  "Step 2: at ω = 0 the terms lie along the real axis and add up to exactly 1.",
  "Step 3: at ω > 0 every term points up and to the right, so the sum's angle is between 0° and 90°.",
  "Step 4: each term is shorter than at ω = 0, so the sum ends inside the unit circle.",
];

// ---- the look-ahead ------------------------------------------------------------------------------------------

export function lookaheadVerdict(guess, mSmall, cSmall, decSmall) {
  const fact = `At c₀ = ${sci(cSmall)}, the bound looks ${f3(mSmall)} time units ahead, while a decision from 0 takes ${f2(decSmall)} on average: the look-ahead tends to ½ as the decision time grows without bound.`;
  if (guess === "half") return "Right. " + fact;
  if (guess === "zero") return "It stays near half a unit, not 0. " + fact;
  return "Much shorter than a decision. " + fact;
}

export function lookaheadSay(c0, m, dec, maxM, maxC) {
  let s = `At c₀ = ${sci(c0)}, the bound looks ${f3(m)} time units ahead on average, and a decision from 0 takes ${f2(dec)}`;
  s += dec > m ? `, ${f1(dec / m)} times as long. ` : `. `;
  s += `Over costs from 10⁻⁴ to 10, the scan finds the longest look-ahead, ${f3(maxM)}, at c₀ ≈ ${f3(maxC)}; that maximum is numerical, not proved.`;
  return s;
}

export const MEAN_HEADS = [
  "Step 1: the transform is 1 at λ = 0, and its slope there is −m(c₀).",
  "Step 2: the start law times the mean time from each start; the shaded area is m(c₀).",
  "Step 3: the closed form for the mean time from each start, beside decisions sampled from six starts.",
  "Step 4: m(c₀) over all costs, with its limits ½ and 0, and the numerical maximum between.",
];

export function shiftSay(label, G, flat = false) {
  const { maxPm: gapPm, maxSh: gapSh, avgPm, avgSh, apart } = G;
  if (flat) return `${label}: the cost doesn't move, so the per-moment and shifted bounds coincide${apart < 1e-12 ? " exactly" : `, to within ${sci(apart)}`}. The program's bound is on average ${f3(avgPm)} from them, and at most ${f3(gapPm)}: the grid's step and the forced choice at the end of the program's horizon make that difference.`;
  let s = `${label}: over the window, the per-moment bound is on average ${f3(avgPm)} from the best bound and the shifted one ${f3(avgSh)}; their largest gaps are ${f3(gapPm)} and ${f3(gapSh)}. `;
  if (avgSh < avgPm * 0.9) s += "Here the shift helps on average.";
  else if (avgSh > avgPm * 1.1) s += "Here the shift does worse on average than no shift.";
  else s += "Here the shift makes little difference on average.";
  return s;
}

export function shiftNote(kind, label) {
  if (kind === "deadline") return "A deadline makes the cost infinite, so the shifted rule drops to 0 a look-ahead before it; the rule of thumb is for slow, nearly linear changes, so this comparison is outside it.";
  if (kind === "constant") return "A constant cost doesn't move, so the per-moment and shifted bounds coincide; the program's bound differs from them only through the grid and its forced choice. Pick a schedule that moves to compare the shift.";
  return `${label}: the best bound for your schedule as it is, with no scaling.`;
}

// ---- half-integration ------------------------------------------------------------------------------------------

export const HALF_HEADS = [
  "Step 1: the real and imaginary parts of r grow like √ω.",
  "Step 2: tanh(r b₀) approaches 1 exponentially fast.",
  "Step 3: the gain falls along a line of slope −½, and the lead tends to 45°.",
  "Step 4: near s = 0, the kernel falls along a line of slope −½.",
  "Step 5: half an integration: slope −½, against −1 for an exponential kernel with the same mean.",
];

export function leadPeakSay(c0, peak) {
  if (peak.lead > 45.005) return `At c₀ = ${c0}, the lead passes 45°: it reaches ${f2(peak.lead)}° near ω = ${Math.round(peak.omega)} and then comes back toward 45°.`;
  return `At c₀ = ${c0}, the lead rises toward 45° from below over this range (${f2(peak.lead)}° at ω = ${sci(peak.omega)}).`;
}

// ---- the reward of a flat bound --------------------------------------------------------------------------------

export function rewardVerdict(guess, ratioUp, ratioDown, c) {
  const fact = `At c = ${c}, missing the peak by 0.2 loses ${f1(ratioUp)} times what missing by 0.1 loses (above the peak; ${f1(ratioDown)} below it): about the square, as a quadratic loss says.`;
  if (guess === "four") return "Right. " + fact;
  if (guess === "two") return "More than twice. " + fact;
  return "Not the same. " + fact;
}

export function rewardSay(c, delta, loss, cd2) {
  if (Math.abs(delta) < 1e-4) return `At the peak, B(${c}), nothing is lost. Move the bound to see the loss grow.`;
  return `A miss of ${f3(Math.abs(delta))} ${delta > 0 ? "above" : "below"} the peak loses ${sci(loss)} of reward, which is ${loss > 0 ? f2(loss / cd2) : "–"} times c δ² = ${sci(cd2)}.`;
}

// ---- the proof of the loss bound ------------------------------------------------------------------------------

export const BAND_HEADS = [
  "Step 1: whatever the bound does inside the band, the decision comes between two fixed hitting times.",
  "Step 2: the waiting value at the constant cost touches 0 at the bound like a parabola.",
  "Step 3: the waiting value left in the band and the time spent above the bound both shrink like D².",
  "Step 4: the gap between the two fixed hitting times shrinks like D, so ε times it shrinks like ε².",
];

export function bandSay(D, w0, cD2, tAbove) {
  return `With a band of ±${f3(D)}, at most ${sci(w0)} of waiting value is left in it (c₀D² is ${sci(cD2)}), and the expected time above b₀ costs ${sci(tAbove)}: both shrink about fourfold when D halves.`;
}

// ---- losses on the reader's schedule ------------------------------------------------------------------------------

export function lossNote(kind, label, c0) {
  if (kind === "deadline") return "A deadline makes the cost infinite, so it isn't a small change of a constant cost, and Proposition 10 says nothing about it. Pick another schedule to see the losses shrink.";
  if (kind === "constant") return "A constant cost has no change to shrink: every rule earns the same. Pick a schedule that moves.";
  if (kind === "rising") return `A rising cost grows without bound, so it is outside Proposition 10, which needs a bounded change. The page still computes it, around c(0) = ${f3(c0)}.`;
  return `${label}: written around its cost at time 0, c(0) = ${f3(c0)}, as c(0) + ε(c(t) − c(0)).`;
}

const lossWords = (x, res) => (!(x > 1e-12) ? `no reward measurable on this grid (a scored difference of ${sci(x)})` : `${sci(x)} of reward${res ? "" : ", below what the grid resolves"}`);
export function lossSay(eps, lossPm, lossFo, slopePm, slopeFo, resPm, resFo, foZero = false) {
  let s = `At ε = ${frac(eps)}, the per-moment rule loses ${lossWords(lossPm, resPm)}, and the first-order bound ${lossWords(lossFo, resFo)}. `;
  if (foZero) s += "At this size the first-order bound falls to 0 for a while, where every decision is made at once: it is a small-change result. ";
  if (Number.isFinite(slopePm)) s += `Over its three smallest resolved sizes, the per-moment loss falls with a slope of ${f2(slopePm)} on these log axes${slopePm > 1.6 && slopePm < 2.6 ? ", close to the 2 of a second-order loss" : ""}. `;
  else s += "Fewer than three of the per-moment losses are resolved, too few to fit a slope. ";
  if (Number.isFinite(slopeFo)) s += `The first-order bound's loss falls with a slope of ${f2(slopeFo)}${slopeFo > 2.6 ? ", faster than second order" : ""}.`;
  else s += "The first-order bound's loss reaches the grid's resolution too soon to fit a slope over three sizes.";
  return s;
}

export function conjSay(eps, ratioPm, resPm, latePm, ratioFo, resFo, lateFo, lossPm = 1, lossFo = 1) {
  let s = `Conjecture, at ε = ${frac(eps)}: `;
  if (!(lossPm > 1e-12)) s += "the per-moment rule loses nothing measurable on this grid, so there is no ratio";
  else if (resPm && Number.isFinite(ratioPm)) s += `for the per-moment rule, the formula predicts ${f2(ratioPm)} times the scored loss`;
  else s += "the per-moment rule's loss is below what the grid resolves, so the ratio means little";
  s += Number.isFinite(latePm) ? `, with ${pct(latePm)} of the prediction from the last 2 time units. ` : ". ";
  s += "The conjecture doesn't cover the first-order bound, whose miss changes shape with ε; ";
  if (!(lossFo > 1e-12)) s += "it loses nothing measurable here.";
  else if (resFo && Number.isFinite(ratioFo)) s += `the same formula gives ${f2(ratioFo)} times its loss${Number.isFinite(lateFo) ? `, with ${pct(lateFo)} from the last 2 time units` : ""}.`;
  else s += "its loss is below what the grid resolves.";
  return s;
}

export function noLossNote() {
  return "Neither rule loses any reward this grid can measure at any size of the change, so there is nothing to draw on log axes.";
}

export function lossState(horizon, centerWaits, kind) {
  let s = `Time step 0.01, evidence step 0.02, a forced choice at time ${horizon}; the best policy is scored from the program's own stop set, so no rule can score above it on the grid.`;
  if (kind === "conj") s += " The prediction leaves out the last grid time.";
  if (centerWaits) s += " At some times the program waits at 0 but stops at the grid's first step; its bound is drawn between the two there (the paper's code reports 0).";
  return s;
}
