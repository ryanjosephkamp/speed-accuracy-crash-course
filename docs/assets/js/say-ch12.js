// The sentences under chapter 12's plates, as functions of the numbers the plates compute, and the self-test's
// statements with the paper's answers. Wording can change here without touching a value; tools/checks/ch12.mjs runs
// these on the plates' numbers and holds the self-test's answers to the paper's own sentences.
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const ms = (x) => `${Math.round(x)} ms`;
const deg = (x) => `${Math.round(x)}°`;
const omegaText = (om) => (om >= 10 ? om.toFixed(0) : om >= 1 ? om.toFixed(1) : om.toFixed(2));
const pct = (x) => (x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : "less than 0.1%");
const sizeText = (eps) => (eps >= 1 ? "full size" : eps >= 0.1 ? `${Math.round(eps * 100)}% of its size` : `${(eps * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}% of its size`);

// ---- the hero -------------------------------------------------------------------------------------------------
/** kind: "ramp" or the frequency in Hz; leadMs, degrees, and gain from the page's closed forms. */
export function heroLabel(kind, leadMs, degrees, gain) {
  if (kind === "ramp") return `A slow, steady rise: the urgency signal runs about ${ms(leadMs)} ahead of the cost`;
  return `${kind} Hz: about ${ms(leadMs)} ahead (${deg(degrees)}), with ${f2(gain)} of the per-moment swing`;
}

// ---- ahead of the cost ----------------------------------------------------------------------------------------
/** After the guess for the ramp: guess and lead in time units; m the mean look-ahead. */
export function rampVerdict(guess, lead, m, L) {
  const fact = `For this ramp, U crosses the halfway line ${f2(lead)} time units before the per-moment urgency; the mean look-ahead is ${f2(m)}.`;
  if (!Number.isFinite(guess)) return fact;
  const d = lead - guess;
  if (Math.abs(d) <= 0.05) return `Your guess, ${f2(guess)}, is within 0.05 of it. ` + fact;
  return `Your guess, ${f2(guess)}, is ${f2(Math.abs(d))} ${d > 0 ? "short" : "too far"}. ` + fact;
}

/** The ramp's sentence: L its length, lead the lead at the halfway line, m the mean look-ahead and med the kernel's
 * median at c0. The sentence calls the ramp slow only when its lead is within 5% of m. */
export function rampSay(c0, L, lead, m, med) {
  const short = (m - lead) / m;
  let s = `At c₀ = ${c0}, a ramp lasting ${f2(L)} time units: U crosses the halfway line ${f3(lead)} time units before the per-moment urgency, against a mean look-ahead of ${f3(m)}. `;
  if (short <= 0.05) s += `The ramp is slow next to the kernel: the lead is within 5% of the mean look-ahead, as the paper predicts for slow, nearly linear changes.`;
  else s += `The ramp isn't slow next to the kernel: the lead at the halfway line is ${Math.round(short * 100)}% short of the mean look-ahead, and as the ramp shortens it falls toward the kernel's median, ${f3(med)}. The paper's lead of m(c₀) is for slow changes.`;
  return s;
}

export function waveSay(c0, omega, degrees, timeLead, gain, m) {
  let s = `At c₀ = ${c0} and ω = ${omegaText(omega)}, U swings ${f3(gain)} of the per-moment urgency's swing and runs ${f1(degrees)}° ahead of it, `;
  s += `${f3(timeLead)} time units, against a mean look-ahead of ${f3(m)}.`;
  if (degrees > 45) s += ` The lead is above 45° here: it tends to 45° at high frequency but isn't capped there.`;
  return s;
}

// ---- the argument, step by step -------------------------------------------------------------------------------
export function gateSay(hit) {
  if (!Number.isFinite(hit)) return "This path doesn't reach the bound in the time shown.";
  return `The evidence reaches the moving bound at time ${f3(hit)}, and the gated evidence U·X reaches the fixed level a at the same moment.`;
}
export function mirrorWaveSay(c0, degrees) {
  return `At c₀ = ${c0} and ω = 2, the urgency runs ${f1(degrees)}° ahead of the cost's wave, and the bound's move is the urgency's turned upside down: the bound falls before the cost rises.`;
}
export function mirrorSay(c0, b0) {
  return `At c₀ = ${c0}, b₀ = ${f3(b0)}. Near b₀, a/b falls along its tangent: a bound 1% lower gives an urgency about 1% higher.`;
}
export function linearSay(c0, m) {
  return `At c₀ = ${c0}, the kernel's average of a straight line is the line ${f3(m)} time units later, its mean look-ahead.`;
}
export function phaseSay(c0, peak, m) {
  let s = `At c₀ = ${c0}, the lead in time starts at the mean look-ahead, ${f3(m)}, for slow waves and falls toward 0; the lead in degrees tends to 45°.`;
  if (peak.lead > 45) s += ` Here it passes 45°, to about ${f2(peak.lead)}° near ω = ${Math.round(peak.omega)} (found numerically), and comes back.`;
  return s;
}

// ---- your schedule --------------------------------------------------------------------------------------------
/** gFo, gPm: the largest gaps of the first-order and per-moment urgency from the best bound's, as shares of the
 * constant-cost urgency, at each size in EPS; k the size on show; holes: where the first-order bound is at or below 0;
 * outside: a schedule outside the theorem (the rising cost). */
const gapText = (x) => (x >= 1 ? `up to ${f1(x)} times the constant cost's urgency` : x >= 0.001 ? `up to ${pct(x)} of the constant cost's urgency` : `less than 0.1% of the constant cost's urgency`);
export function yoursSay(EPS, k, gFo, gPm, holes = false, outside = false) {
  const last = EPS.length - 1;
  let s = `At ${sizeText(EPS[k])}${k === last ? ", the smallest" : ""}, the first-order urgency is off the best bound's by ${gapText(gFo[k])}, and the per-moment urgency by ${gapText(gPm[k])}`;
  s += holes ? `; where the first-order bound reaches 0 or below, it has no urgency, and the plate leaves a gap. ` : `. `;
  if (k !== last) s += `At the smallest size, ${sizeText(EPS[last])}, the gaps are ${pct(gFo[last])} and ${pct(gPm[last])}. `;
  if (gFo[last] < gPm[last]) s += `There the first-order urgency, the one the prediction is about, is the closer of the two to the best bound's.`;
  else s += `Even there, on this grid, the first-order urgency is not the closer of the two to the best bound's.`;
  if (outside) s += ` The rising cost grows without bound, so it is outside the theorem: these gaps are a computation, with no theory behind them.`;
  return s;
}

export function outsideNote(kind) {
  if (kind === "deadline") return "A deadline isn't a small change of a constant cost, so the prediction says nothing about it. The plate draws the urgency from the best bound and from the per-moment rule up to the last moment the bound is above 0; at the deadline the bound reaches 0 and a/b has no value.";
  if (kind === "constant") return "This cost doesn't change, so the urgency signal is flat: there is nothing for it to lead. Pick a schedule that moves.";
  return "A rising cost grows without bound, so it is outside the theorem, which needs a bounded change. The page computes it, and the curves are a computation only.";
}
export function insideNote(label) {
  return `${label}: written as c₀ + εγ, with c₀ its average over time 0 to 2.5, at the size ε you pick.`;
}
export function deadlineSay(tLast, deadline, ratio) {
  return `The best bound's urgency is ${f1(ratio)} times the per-moment one at time ${f2(tLast)}, the last moment the plate draws before the deadline at ${f2(deadline)}.`;
}

// ---- in milliseconds ------------------------------------------------------------------------------------------
/** After the two guesses: gMs (ms, slow ramp) and gDeg (degrees, 1 Hz), against the page's leadMs and deg1. */
export function msVerdict(gMs, gDeg, leadMs, deg1, ms1) {
  const parts = [];
  if (Number.isFinite(gMs)) { const d = leadMs - gMs; parts.push(Math.abs(d) <= 25 ? `Your ramp guess, ${ms(gMs)}, is within 25 ms.` : `Your ramp guess, ${ms(gMs)}, is ${ms(Math.abs(d))} ${d > 0 ? "short" : "too long"}.`); }
  if (Number.isFinite(gDeg)) { const d = deg1 - gDeg; parts.push(Math.abs(d) <= 5 ? `Your 1 Hz guess, ${deg(gDeg)}, is within 5°.` : `Your 1 Hz guess, ${deg(gDeg)}, is ${deg(Math.abs(d))} ${d > 0 ? "short" : "too far"}.`); }
  parts.push(`For this observer, a slow ramp is led by about ${ms(leadMs)}, and a 1 Hz wave by about ${deg(deg1)}, which is ${ms(ms1)}.`);
  return parts.join(" ");
}
export function msSay(P) {
  const [a, b, c] = P.waves;
  return `In degrees, the lead grows with the frequency: ${deg(a.deg)}, ${deg(b.deg)}, and ${deg(c.deg)} at 0.5, 1, and 2 Hz. In milliseconds, it shrinks: ${ms(a.ms)}, ${ms(b.ms)}, and ${ms(c.ms)}, all below the slow ramp's ${ms(P.leadMs)}.`;
}
export function trapSay(P, T) {
  return `From the bound as printed, ${f2(T.bPrinted)}, the ramp's lead comes out ${ms(T.fromBound)} instead of ${ms(P.leadMs)}; from the 0.5 Hz phase as printed, ${deg(T.fromDegrees[0].deg)}, it comes out ${ms(T.fromDegrees[0].ms)} instead of ${ms(P.waves[0].ms)}.`;
}

// ---- what control would have to compute ----------------------------------------------------------------------
export function controlSay(t, c0, m, med, q90, avg, pmNow) {
  return `At time ${f2(t)}, the bound is the kernel's average of the constant-cost bounds ahead: ${f3(avg)}, against ${f3(pmNow)} for the cost at that moment alone. Half the weight falls within ${f2(med)} time units, 90% within ${f2(q90)}, and the mean is ${f3(m)} (at c₀ = ${c0}).`;
}

// ---- what is new, and what isn't ------------------------------------------------------------------------------
export const KINDS = [["credited", "Credited to others"], ["proved", "Proved in the paper"], ["new", "New, to the paper's knowledge"]];
/** The self-test: each statement, the paper's answer (key; also: another answer the paper's words support), why,
 * and where main.tex says so (lines, and a phrase from those lines that a check finds there). */
export const ITEMS = [
  { id: "technique", text: "Expanding value matching and smooth fit about the unperturbed bound, to get a first-order formula.",
    key: "credited", why: "A standard formal procedure in the asymptotic analysis of American options (Fouque and colleagues); Stojanovic (1997) establishes the resulting perturbation formula in a weak sense.",
    lines: [1122, 1137], quote: "is a standard formal procedure" },
  { id: "convolution", text: "The first-order correction is a convolution of the future change with the survival flux.",
    key: "credited", why: "Specializing Stojanovic's (1997) formula formally to this model at a constant cost gives it. The paper: what is new is “not the technique itself or the convolution form.”",
    lines: [1131, 1137], quote: "not the technique itself or the convolution form" },
  { id: "identities", text: "The two identities behind the exact equation (Lemma 2).",
    key: "credited", also: "proved", why: "They appear, for smooth terminal losses, in Campbell and Engelund (2026). Their hypotheses exclude the 0-1 loss, which has a kink, so the paper proves them directly.",
    lines: [195, 199], quote: "appear, for smooth terminal losses, in recent work by" },
  { id: "exact", text: "The exact equation for the bound, for the drift-diffusion model's 0-1 loss.",
    key: "proved", why: "The paper proves it directly and lists it among its contributions, but its sentences on what is new don't claim it: with smooth losses, Campbell and Engelund's identities and smooth fit would also give a relation like it.",
    lines: [1166, 1170], quote: "directly for the 0-1 loss and use it to prove the first-order theorem" },
  { id: "kernel", text: "The kernel made explicit, as a distribution of decision times, and its Laplace transform.",
    key: "new", why: "The paper: “the kernel made explicit … and through its Laplace transform.”",
    lines: [1136, 1139], quote: "but the kernel made explicit" },
  { id: "theorem", text: "A proof of the first-order expansion for this model on an infinite horizon, with a rate for Hölder changes.",
    key: "new", why: "Stojanovic's theorem covers finite cylinders; the paper proves the expansion outside them, on an infinite horizon, through an equation with no derivative of the bound.",
    lines: [1139, 1143], quote: "together with a proof of the expansion" },
  { id: "rule", text: "The weighted look-ahead rule.",
    key: "new", why: "It is first-order exact near a constant cost (Proposition 13); on the paper's code, it is not faster than the dynamic program.",
    lines: [1170, 1172], quote: "rule, and the measurements are, to our knowledge, new here" },
  { id: "anticipation", text: "The best bound moves before a known change in the cost of time.",
    key: "credited", why: "Known before, qualitatively: Barendregt and colleagues (2022) find thresholds that anticipate a known drop in reward. What the paper claims, to its knowledge, is an analytic first-order form for small changes of general shape.",
    lines: [1100, 1108], quote: "anticipate a known drop in reward" },
];
const KIND_WORD = Object.fromEntries(KINDS);

/** Whether a mark matches the paper: the key, or the other answer the paper's words support. */
export const marksRight = (item, mark) => mark === item.key || (item.also && mark === item.also);

/** The verdict after the answers are shown: marks is { id: kind } for the statements marked. */
export function noveltyVerdict(marks) {
  const marked = ITEMS.filter((it) => marks[it.id]);
  if (!marked.length) return `The paper's answers are below each statement. Every claim of novelty in the paper carries “to our knowledge.”`;
  const right = marked.filter((it) => marksRight(it, marks[it.id])).length;
  let s = `${right} of your ${marked.length} marks match the paper's own sentences`;
  s += marked.length < ITEMS.length ? ` (${ITEMS.length - marked.length} left unmarked).` : `.`;
  const over = marked.filter((it) => marks[it.id] === "new" && it.key !== "new");
  if (over.length) s += ` ${over.length === 1 ? "One statement" : `${over.length} statements`} you marked new the paper credits to others or doesn't claim as new.`;
  return s + ` Every claim of novelty in the paper carries “to our knowledge.”`;
}
export const answerText = (item) => `${KIND_WORD[item.key]}${item.also ? ` (and ${KIND_WORD[item.also].toLowerCase()} for the 0-1 loss)` : ""}. ${item.why}`;
