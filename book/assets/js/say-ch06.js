// The sentences under chapter 6's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/check_book.mjs runs these on the plates' numbers.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(x * 100)}%`;

export function heroLabel(t, median) {
  return `From time ${t.toFixed(1)}: half the weight falls within the next ${f2(median)} time units`;
}

export function scaleSay(eps, gFo, gPm, gFoAll, EPS) {
  const first = gFoAll[0], last = gFoAll[gFoAll.length - 1];
  const shrink = first > 0 ? last / first : NaN;
  let s = `At a ${pct(eps)} change, the program's curve is within ${f3(gFo)} of β and ${f3(gPm)} of the per-moment response. `;
  if (Number.isFinite(shrink) && shrink < 1) {
    s += `From ${pct(EPS[0])} to ${pct(EPS[EPS.length - 1])}, the gap to β shrinks from ${f3(first)} to ${f3(last)}`;
    s += last < gPm ? `, while the gap to the per-moment response stays near ${f3(gPm)}.` : ".";
  } else {
    s += `Over these sizes the gap to β doesn't shrink on this grid.`;
  }
  return s;
}

export function sketchSay(m, yourMean, inHalf, yourHalf, decisionTime) {
  let s = `The kernel's weights average ${f3(m)} time units ahead, against a mean decision time of ${f2(decisionTime)}`;
  s += `, and ${pct(inHalf)} of them fall in the first half unit. `;
  if (!Number.isFinite(yourMean)) return s + "Draw your guess first to compare.";
  const d = yourMean - m;
  if (Math.abs(d) < 0.1) s += `Your drawing's average, ${f2(yourMean)}, is within a tenth of a unit of it.`;
  else s += `Your drawing's average, ${f2(yourMean)}, is ${f2(Math.abs(d))} time units ${d > 0 ? "later" : "earlier"}.`;
  return s;
}

export function startsVerdict(guess, nearShare, c0, decisionTime, m) {
  const fact = `At c₀ = ${c0}, ${pct(nearShare)} of the starts lie within one unit of the bound, so the decisions are short: they average ${f3(m)} time units, against ${f2(decisionTime)} for a decision from 0.`;
  if (guess === "bound") return "Right. " + fact;
  if (guess === "spread") return "They pile up near the bound, not evenly. " + fact;
  return "The other end: they pile up near the bound. " + fact;
}

export function bracketSay(eps, pathGap, egap) {
  return `With a band of ±${f3(eps)}, the two fixed levels are hit ${f3(pathGap)} time units apart on this path; on average the gap is ${f3(egap)}, so it shrinks in proportion to ε.`;
}

const ORDER = ["not at all", "like ε", "like ε²"];
export function ordersVerdict(guess, sPm, sFo) {
  const near = (s) => (s < 0.5 ? 0 : s < 1.5 ? 1 : 2);
  const pm = near(sPm), fo = near(sFo);
  let s = `On this schedule the per-moment error falls with a slope of ${f2(sPm)} (${ORDER[pm]}), and the first-order error with a slope of ${f2(sFo)} (${ORDER[fo]}). `;
  s += "The theory says the per-moment error is of order ε, and the corrected one is o(ε), and O(ε²) for a Lipschitz change.";
  if (guess.pm === null && guess.fo === null) return s;
  const right = (guess.pm === pm) + (guess.fo === fo);
  return (right === 2 ? "Both guesses match. " : right === 1 ? "One guess matches. " : "Neither guess matches. ") + s;
}

export function outsideNote(kind) {
  if (kind === "deadline") return "A deadline makes the cost infinite at the deadline, so it isn't a small change of a constant cost and the theorem says nothing about it. Pick another schedule to compare the shortcuts.";
  if (kind === "constant") return "A constant cost has no change to shrink: every rule gives the constant-cost bound. Pick a schedule that moves.";
  return "A rising cost grows without bound, so it is outside the theorem, which needs a bounded change. The page still computes it.";
}

export function insideNote(label) {
  return `${label}: the page writes it as c₀ + εγ, with c₀ its average over time 0 to 2.5, then shrinks ε.`;
}

/** How far the exact value sits from the runs' mean, in standard errors. */
export function zText(z) {
  const a = Math.abs(z);
  return `${a.toFixed(1)} standard errors from the runs' mean${a > 2 ? "; a sample lands more than 2 away about one time in twenty" : ""}`;
}
