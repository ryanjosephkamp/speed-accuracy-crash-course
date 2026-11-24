// The sentences under chapter 7's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch07.mjs runs these on the plates' numbers.
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(x * 100)}%`;
const sci = (x) => (Math.abs(x) >= 0.001 && Math.abs(x) < 1000 ? String(+x.toPrecision(2)) : x.toExponential(1));
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
  s += `Over all costs, the scan finds the longest look-ahead, ${f3(maxM)}, at c₀ ≈ ${f3(maxC)}; that maximum is numerical, not proved.`;
  return s;
}

export const MEAN_HEADS = [
  "Step 1: the transform is 1 at λ = 0, and its slope there is −m(c₀).",
  "Step 2: the start law times the mean time from each start; the shaded area is m(c₀).",
  "Step 3: the closed form for the mean time from each start, beside decisions sampled from six starts.",
  "Step 4: m(c₀) over all costs, with its limits ½ and 0, and the numerical maximum between.",
];

export function shiftSay(label, gapPm, gapSh, avgPm, avgSh) {
  let s = `${label}: over the window, the per-moment bound is on average ${f3(avgPm)} from the best bound and the shifted one ${f3(avgSh)}; their largest gaps are ${f3(gapPm)} and ${f3(gapSh)}. `;
  if (avgSh < avgPm * 0.9) s += "Here the shift helps on average.";
  else if (avgSh > avgPm * 1.1) s += "Here the shift does worse on average than no shift.";
  else s += "Here the shift makes little difference on average.";
  return s;
}

export function shiftNote(kind, label) {
  if (kind === "deadline") return "A deadline makes the cost infinite, so the shifted rule drops to 0 a look-ahead before it; the rule of thumb is for slow, nearly linear changes, so this comparison is outside it.";
  if (kind === "constant") return "A constant cost doesn't move, so all three bounds coincide. Pick a schedule that moves.";
  return `${label}: the best bound for your schedule as it is, with no scaling.`;
}

// ---- half-integration ------------------------------------------------------------------------------------------

export const HALF_HEADS = [
  "Step 1: the real and imaginary parts of r grow like √ω.",
  "Step 2: tanh(r b₀) reaches 1 exponentially fast.",
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

export function lossSay(eps, lossPm, lossFo, slopePm, slopeFo, resPm, resFo, foZero = false) {
  let s = `At ε = ${frac(eps)}, the per-moment rule loses ${sci(lossPm)} of reward${resPm ? "" : " (below what the grid resolves)"}, and the first-order bound ${sci(lossFo)}${resFo ? "" : " (below what the grid resolves)"}. `;
  if (foZero) s += "At this size the first-order bound falls to 0 for a while, where every decision is made at once: it is a small-change result. ";
  if (Number.isFinite(slopePm)) s += `Over its three smallest resolved sizes, the per-moment loss falls with a slope of ${f2(slopePm)} on these log axes${slopePm > 1.6 && slopePm < 2.6 ? ", close to the 2 of a second-order loss" : ""}. `;
  else s += "Fewer than three of the per-moment losses are resolved, too few to fit a slope. ";
  if (Number.isFinite(slopeFo)) s += `The first-order bound's falls with a slope of ${f2(slopeFo)}${slopeFo > 2.6 ? ", faster than second order" : ""}.`;
  else s += "The first-order bound's loss reaches the grid's resolution too soon to fit a slope over three sizes.";
  return s;
}

export function conjSay(eps, ratioPm, resPm, latePm, ratioFo, resFo, lateFo) {
  let s = `Conjecture, at ε = ${frac(eps)}: `;
  if (resPm && Number.isFinite(ratioPm)) s += `for the per-moment rule, the formula predicts ${f2(ratioPm)} times the scored loss`;
  else s += "the per-moment rule's loss is below what the grid resolves, so the ratio means little";
  s += Number.isFinite(latePm) ? `, with ${pct(latePm)} of the prediction from the last 2 time units. ` : ". ";
  if (resFo && Number.isFinite(ratioFo)) s += `For the first-order bound it predicts ${f2(ratioFo)} times its loss`;
  else s += "The first-order bound's loss is below what the grid resolves";
  s += Number.isFinite(lateFo) ? `, with ${pct(lateFo)} from the last 2 time units.` : ".";
  return s;
}
