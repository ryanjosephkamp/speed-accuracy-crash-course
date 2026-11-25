// The sentences under chapter 6's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/check_book.mjs runs these on the plates' numbers.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(x * 100)}%`;

export function heroLabel(t, median) {
  return `From time ${t.toFixed(1)}: half the weight falls within the next ${f2(median)} time units`;
}

export function scaleSay(eps, gFo, gPm, gFoAll, EPS, gPmAll = null) {
  const first = gFoAll[0], last = gFoAll[gFoAll.length - 1];
  const shrink = first > 0 ? last / first : NaN;
  let s = `For a change of ${pct(eps)}, the program's curve is within ${f3(gFo)} of β and ${f3(gPm)} of the per-moment response. `;
  if (Number.isFinite(shrink) && shrink < 1) {
    s += `From ${pct(EPS[0])} to ${pct(EPS[EPS.length - 1])}, the gap to β shrinks from ${f3(first)} to ${f3(last)}`;
    if (gPmAll && last < Math.min(...gPmAll)) s += `, while the gap to the per-moment response stays between ${f3(Math.min(...gPmAll))} and ${f3(Math.max(...gPmAll))}.`;
    else s += last < gPm ? `, while the gap to the per-moment response stays near ${f3(gPm)}.` : ".";
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
const pctE = (e) => (e >= 0.1 ? Math.round(e * 100) + "%" : (e * 100).toFixed(1) + "%");

/** The per-moment error over the first-order error at each size where both are positive. */
export function errorRatios(ePm, eFo) {
  const r = ePm.map((p, k) => (eFo[k] > 0 && p > 0 ? p / eFo[k] : null)).filter((x) => x !== null);
  return r.length ? { lo: Math.min(...r), hi: Math.max(...r), n: r.length, smaller: r.filter((x) => x > 1).length } : { lo: null, hi: null, n: 0, smaller: 0 };
}

/** The verdict under the error chart: what the chart measured, size by size, and the theory's rates as theory. */
export function errorsVerdict(guess, ePm, eFo, EPS, outside = false) {
  const r = errorRatios(ePm, eFo), all = r.smaller === r.n && r.n === EPS.length;
  let s = all
    ? `At every size from ${pctE(EPS[0])} to ${pctE(EPS[EPS.length - 1])}, the first-order error is smaller than the per-moment error, by a factor of ${f2(r.lo)} to ${f2(r.hi)}. `
    : `The first-order error is the smaller of the two at ${r.smaller} of the ${EPS.length} sizes. `;
  s += "Both also carry numerical error from the grid, the finite horizon, and the kernel's series; subtracting the constant-cost run cancels only the part the two runs share, and what remains can change with ε, so the slopes on this chart aren't a test of the theory's rates. ";
  if (outside) return s + "The rising cost grows without bound, so the theorem says nothing about it: these are measurements on this grid only.";
  return gradeOf(guess) + s + THEORY;
}

const THEORY = "The theory, for a bounded Lipschitz change like this one: divided by ε, the per-moment error tends to a function of time that is not identically zero over all times t ≥ 0 (unless γ is constant), so over all times it is of order ε; the corrected one is at most of order ε². This chart measures both only at the times from 0 to 2.5, every 0.02.";
/** The grade of the reader's two guesses against the theory (Order ε for the per-moment rule, at most order ε² for the
 * correction), or nothing when neither was made. */
function gradeOf(guess) {
  if (guess.pm === null && guess.fo === null) return "";
  const right = (guess.pm === 1) + (guess.fo === 2);
  return right === 2 ? "Both guesses match the theory. " : right === 1 ? "One guess matches the theory. " : "Neither guess matches the theory. ";
}

/** The verdict when every error is below the chart's threshold: inside the theorem, the grade of the guesses and the
 * theory's answer still come first, whatever the measurements show; then the largest error and why there is no chart. */
export const tooSmallVerdict = (largest, guess, outside = false) => (outside ? "" : gradeOf(guess) + THEORY + " ") + tooSmallSay(largest);

/** A positive number to three significant figures, rounded down, as 9.96e-8 (so a value below 10⁻⁷ never prints as
 * 1.00e-7); 0 as "0". */
export function sciDown(x) {
  if (!(x > 0)) return "0";
  let e = Math.floor(Math.log10(x));
  if (x / 10 ** e < 1) e -= 1; else if (x / 10 ** e >= 10) e += 1;
  return `${(Math.floor((x / 10 ** e) * 100) / 100).toFixed(2)}e${e}`;
}

export const tooSmallSay = (largest) => `Every error here is below 10⁻⁷: the largest is ${sciDown(largest)}, rounded down. The log chart opens only when at least one error reaches 10⁻⁷, so it stays hidden. Pick a schedule that moves more.`;

/** A guide y = ya (x / xa)^p on log axes, clipped to x in [xLo, xHi] and y in [yLo, yHi] so its slope stays true;
 * null when no part of it is inside. */
export function guideInRange(xa, ya, p, xLo, xHi, yLo, yHi) {
  const xAt = (y) => xa * (y / ya) ** (1 / p);
  let a = Math.max(xLo, Math.min(xAt(yLo), xAt(yHi))), b = Math.min(xHi, Math.max(xAt(yLo), xAt(yHi)));
  if (!(a < b)) return null;
  return [[a, b], [ya * (a / xa) ** p, ya * (b / xa) ** p]];
}

export function outsideNote(kind) {
  if (kind === "deadline") return "A deadline makes the cost infinite at the deadline, so it isn't a small change of a constant cost and the theorem says nothing about it. The plate doesn't run on it; pick another schedule to compare the shortcuts.";
  if (kind === "constant") return "This cost doesn't change, so there is nothing to shrink: every rule gives the constant-cost bound. Pick a schedule that moves.";
  return "A rising cost grows without bound, so it is outside the theorem, which needs a bounded change. The page computes it and compares the two errors, with no theory question.";
}

export function insideNote(label) {
  return `${label}: the page writes it as c₀ + εγ, with c₀ its average over time 0 to 2.5, then shrinks ε.`;
}

/** How far the exact value sits from the runs' mean, in standard errors. */
export function zText(z) {
  const a = Math.abs(z);
  return `${a.toFixed(1)} standard errors from the runs' mean${a > 2 ? "; if the sampling error were normal and the runs unbiased, a gap over 2 would come about one time in twenty" : ""}`;
}
