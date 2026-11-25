// The sentences under chapter 11's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch11.mjs runs these on the plates' numbers and on random ones.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const sig = (x) => String(+x.toPrecision(3));
const tt = (t) => (Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : t.toFixed(2).replace(/0$/, ""));
const signed = (x) => `${x >= 0 ? "+" : "−"}${f3(Math.abs(x))}`;

export function heroLabel(t, mh, ml) {
  return `From time ${t.toFixed(1)}: the upper bound's weights average ${f2(mh)} time units ahead, the lower bound's ${f2(ml)}`;
}

// ---------------------------------------------------------------- the information clock
const GUESS = { flat: "stays the same", falls: "falls", rises: "rises without bound" };
/** info: { k0, kEnd, tEnd, kMin, tMin, kMax, deadline (a time or null), growth: kEnd / k0 } for the reader's schedule
 * over t from 0 to 10 (or to the deadline). */
export function clockVerdict(guess, info) {
  const fact = "A constant cost c becomes κ = c·a·e^θ on the information clock: it rises without bound, by a factor of e for each unit of θ.";
  let head = "";
  if (guess) head = guess === "rises" ? "Right. " : `Not ${GUESS[guess]}: it rises. `;
  return head + fact + " " + clockMine(info);
}
export function clockMine(info) {
  const { k0, kEnd, tEnd, kMin, tMin, deadline } = info;
  let s = `On your schedule, κ goes from ${sig(k0)} at t = 0 to ${sig(kEnd)} at t = ${tt(tEnd)}`;
  if (kMin < k0 * (1 - 1e-6) && tMin > 0 && tMin < tEnd) s += `, after falling to ${sig(kMin)} at t = ${tt(tMin)}`;
  s += kEnd >= k0 ? `: ${sig(kEnd / k0)} times its start.` : `: lower than at the start, because your cost falls faster than t + a grows.`;
  if (deadline !== null && deadline !== undefined) s += ` After the deadline at t = ${tt(deadline)}, the cost is infinite on either clock.`;
  return s;
}

// ---------------------------------------------------------------- the derivation strip for unknown reliability
export function beliefStep(step, n) {
  if (step === 0) return `In this trial the drift is ${signed(n.mu)}. The chance that it is positive goes from 0.5 before any evidence to ${f3(n.p[0])} at t = 0.5, ${f3(n.p[1])} at t = 2, and ${f3(n.p[2])} at t = 8.`;
  if (step === 1) return `Six trials, each with its own drift from the prior. In real time the evidence of a strong drift runs away fast, and a weak one wanders near 0.`;
  if (step === 2) return `The same six trials as u against θ: one rule of motion at every moment, du = ½u dθ + dW. The clock runs from θ = 0 to ${f2(n.thetaEnd)} as t runs from 0 to 10.`;
  if (step === 3) return `On a log scale a constant cost is a straight line of slope 1 in θ: each unit of θ multiplies κ by e, about ${f2(Math.E)}.`;
  if (step === 4) return `At κ = ${n.kappa}, the bound is U = ${f3(n.U)}, and the shaded area, ${f3(n.area)}, matches 1/√(2π) = ${f3(n.target)}.`;
  return `The kernel for U = ${f3(n.U)} averages ${f3(n.mean)} units of information time ahead. From t = 1, with a = 1, moving θ on by that much reaches a time ${f2(n.realAhead)} units later.`;
}

// ---------------------------------------------------------------- the rules on one schedule
/** s: { label, frozenGap0, frozenGapMax, weightedGapMax, plugZeroFrom (time or null), view, losses: [frozen, weighted,
 * plug, tuned] as printed strings, or null for the reader's own schedule }. */
export function rulesSay(s) {
  let out = `At t = 0, the frozen-time bound is ${f3(Math.abs(s.frozenGap0))} ${s.frozenGap0 >= 0 ? "above" : "below"} the program's; over the window, the weighted rule stays within ${f3(s.weightedGapMax)} of it, and the frozen-time rule within ${f3(s.frozenGapMax)}.`;
  if (s.plugZeroFrom !== null && s.plugZeroFrom !== undefined) {
    out += s.plugZeroFrom <= 1e-9 ? " The plug-in bound is 0 from the start: the rule decides at once." : ` The plug-in bound is 0 from t = ${tt(s.plugZeroFrom)} on: from then, the rule decides at once.`;
  }
  if (s.losses) out += ` In the paper's scoring of the whole trial, the frozen-time rule loses ${s.losses[0]} points per 100 trials, the weighted rule ${s.losses[1]}, the plug-in rule ${s.losses[2]}, and the tuned constant bound ${s.losses[3]}.`;
  else out += " The paper scores the rules only on its eight schedules; on yours the page draws the bounds but doesn't score them.";
  return out;
}

// ---------------------------------------------------------------- two bounds around x*
const BOUND = { upper: "the upper bound", lower: "the lower bound", same: "both about the same" };
/** n: { ratio, c, lo, hi, xs, B, gPlus, gMinus } (gPlus: the belief in + at h; gMinus: the belief in - at l). */
export function pairSay(n) {
  const dh = n.hi - n.B, dl = n.lo + n.B;
  let s = `At a cost of ${sig(n.c)}, with “−” paying ${f2(n.ratio)} of what “+” pays, the bounds are ℓ = ${f3(n.lo)} and h = ${f3(n.hi)} around x* = ${f3(n.xs)}. `;
  if (n.ratio > 1 - 1e-9) s += `With equal rewards they are ±B(c) = ±${f3(n.B)}.`;
  else s += `From ±B(c) = ±${f3(n.B)}, the upper bound has moved ${dh <= 0 ? "down" : "up"} by ${f3(Math.abs(dh))} and the lower bound ${dl <= 0 ? "down" : "up"} by ${f3(Math.abs(dl))}. It chooses “+” once its belief in “+” reaches ${pct(n.gPlus)}, and “−” once its belief in “−” reaches ${pct(n.gMinus)}.`;
  if (n.hi < 0) s += " The start, x = 0, is above h: the decision maker chooses “+” at once, without waiting.";
  else if (n.lo > 0) s += " The start, x = 0, is below ℓ: the decision maker chooses “−” at once, without waiting.";
  return s;
}
const pct = (p) => `${(100 * p).toFixed(p > 0.995 ? 1 : 0)}%`;
export function pairVerdict(guess, n) {
  const dh = Math.abs(n.hi - n.B), dl = Math.abs(n.lo + n.B);
  if (dh < 1e-9 && dl < 1e-9) return "With equal rewards neither bound moves. Set the “−” reward below the “+” reward to see the answer.";
  const right = dh > dl ? "upper" : "lower";
  const head = guess === right ? "Right: " : guess === "same" ? "Not the same: " : `The ${right} one: `;
  return `${head}with “−” paying ${f2(n.ratio)} of what “+” pays and a cost of ${sig(n.c)}, the upper bound moves ${f3(dh)} from B(c) and the lower ${f3(dl)} from −B(c).`;
}

// ---------------------------------------------------------------- Appendix B
export function appbSay(step, n) {
  if (step === 0) return `With “−” paying ${f2(n.ratio)} of what “+” pays, the two rewards for deciding are equal at x* = ${f3(n.xs)}${n.ratio > 1 - 1e-9 ? ", the middle" : ""}.`;
  if (step === 1) return `Inside (ℓ, h) the curve is c·S(x) + K with K = ${signed(n.K)}; outside it, the formula no longer describes the value (faint).`;
  if (step === 2) return `It meets half the “+” reward, ${f3(0.5 * n.rp)}, at h = ${f3(n.hi)}, and minus half the “−” reward, ${f3(-0.5 * n.rm)}, at ℓ = ${f3(n.lo)}: S(h) − S(ℓ) = ${f3(n.gapS)}, the sum of the rewards over 2c.`;
  if (step === 3) return `The residual changes sign once above x*, at h = ${f3(n.hi)}; a scan for that change and then bisection find it, as the paper's code does.`;
  return `For a common reward r, the equations give the dots, and B(c/r) the line: they agree to ${n.worst.toExponential(0)} or better over r from 0.25 to 4.`;
}

// ---------------------------------------------------------------- one kernel per bound
export function envelopeSay(step, n) {
  if (step === 0) return `The mean time to leave (ℓ₀, h₀) peaks at ${f3(n.mMax)} near x = ${f2(n.mAt)}; its slopes at the ends are the flux totals, ${f3(n.th)} at h₀ and ${f3(n.tl)} at ℓ₀.`;
  if (step === 1) return `Near each bound, V − G is close to c₀ times the squared distance to the bound: curvature 2c₀ = ${f2(2 * n.c0)}.`;
  if (step === 2) return `With δc = ${n.dc}, the first-order rule moves h by ${signed(n.dhFo)} and ℓ by ${signed(n.dlFo)}; the bounds of Appendix B at c₀ + δc move by ${signed(n.dhEx)} and ${signed(n.dlEx)}. The slopes agree with a central difference of the bounds to ${n.slopeRel.toExponential(0)} (relative).`;
  if (step === 3) return `The upper bound's kernel averages ${f3(n.mh)} time units ahead and the lower bound's ${f3(n.ml)}${Math.abs(n.mh - n.ml) < 5e-4 ? ": with equal rewards they are the same kernel" : ""}.`;
  return `With equal rewards, both kernels lie on chapter 6's (largest gap ${n.gap.toExponential(0)} over the dots), and −∫n/(2c₀) = ${f3(n.slope)} is B′(c₀) = ${f3(n.Bp)}.`;
}

// ---------------------------------------------------------------- two bounds, two leads
/** n: { omega, rm, hi: { foGain, foLead, dpGain, dpLead }, lo: { ... } }, gains relative to the per-moment swing. */
export function sineSay(n) {
  const gErr = (b) => Math.abs(b.dpGain / b.foGain - 1) * 100, lErr = (b) => Math.abs(b.dpLead - b.foLead);
  return `At ω = ${n.omega}, the upper bound's kernel predicts a swing of ${f2(n.hi.foGain)} of the per-moment swing and a lead of ${n.hi.foLead.toFixed(1)}°; the lower bound's, ${f2(n.lo.foGain)} and ${n.lo.foLead.toFixed(1)}°. On this grid, the program's fits are within ${gErr(n.hi).toFixed(1)}% and ${gErr(n.lo).toFixed(1)}% on the swing and ${lErr(n.hi).toFixed(1)}° and ${lErr(n.lo).toFixed(1)}° on the lead. The per-moment rule would have no lead at all.`;
}
