// The sentences under chapter 9's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch09.mjs runs these on the plates' numbers and on random ones.
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3), f4 = (x) => x.toFixed(4);
const pct = (x) => `${Math.round(x * 100)}%`;
/** A share as a percent, with a decimal below 10%. */
const pc1 = (x) => (Math.abs(x) < 0.1 ? (x * 100).toFixed(1) : String(Math.round(x * 100))) + "%";
/** A loss in points per 100 trials, to the decimals that show it, with a minus sign for a negative one. */
export const pts = (x) => (Math.abs(x) >= 0.1 ? x.toFixed(3) : Math.abs(x) >= 0.001 ? x.toFixed(4) : x.toFixed(5)).replace(/^-/, "−");
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** A small number as a reader writes it: 5 × 10⁻⁶ (one significant figure), or "under 10⁻⁹". */
export function sci(x) {
  if (!(x >= 1e-9)) return "under 10⁻⁹";
  const [m, e] = x.toExponential(0).split("e");
  return `${m} × 10${String(+e).split("").map((c) => SUP[c]).join("")}`;
}
/** A count in words a reader can say: 1,000, 2.3 million, 470 million, 4.1 billion. */
export function count(n) {
  if (!Number.isFinite(n)) return "–";
  if (n < 1e4) return Math.round(n).toLocaleString("en-US");
  if (n < 1e6) return `${Math.round(n / 1000).toLocaleString("en-US")} thousand`;
  const one = (v) => v.toFixed(1).replace(/\.0$/, "");
  if (n < 1e9) { const m = n / 1e6; return `${m < 10 ? one(m) : Math.round(m)} million`; }
  const b = n / 1e9; return `${b < 10 ? one(b) : Math.round(b).toLocaleString("en-US")} billion`;
}

// ---- the hero ----------------------------------------------------------------------------------------------------
export function heroLabel(t, up, lo) {
  const left = Math.max(0, 1 - up - lo);
  return `By time ${t.toFixed(1)}: ${pct(up)} decided correctly, ${pct(lo)} wrongly, and ${left < 0.005 ? "under 1%" : pct(left)} still deciding`;
}

// ---- backward induction -------------------------------------------------------------------------------------------
/** The sentence under the backward plate, for the slice at time t: b its bound (0, a number, or Infinity past the
 * cap), a0 what waiting adds at x = 0, end the forced choice's time, deadline whether that is a deadline, h the
 * evidence step (a bound between 0 and h is placed between the center and the first step). */
export function backwardSay(t, b, a0, end, deadline, cap = 5, h = 0.02) {
  const at = `time ${t.toFixed(2)}`;
  const forced = deadline ? `the deadline at ${f2(end)}` : `the forced choice at ${f2(end)}`;
  if (Math.abs(t - end) < 1e-9) return `At ${forced}, nobody waits: the value is the chance of being right, max(g, 1 − g), and the bound is 0. Every earlier slice is computed from the one after it.`;
  if (!Number.isFinite(b)) return `At ${at}, waiting beats deciding at every evidence level up to the grid's cap of ${cap}, so the bound reads as above the cap. It was computed from the slice after it, back from ${forced}.`;
  if (b === 0) return `At ${at}, deciding beats waiting even at x = 0, so the bound is 0. It was computed from the slice after it, back from ${forced}.`;
  if (b < h) return `At ${at}, the program still waits at x = 0 but decides at the grid's first step, ${h}, so the bound is placed between them, at ${b.toFixed(4)}, where its own step changes from waiting to deciding; the paper's code reports 0 there. It was computed from the slice after it, back from ${forced}.`;
  return `At ${at}, waiting adds ${f3(a0)} to the value at x = 0 and nothing from the bound, ${f3(b)}, outward. That slice was computed from the one after it, back from ${forced}.`;
}

/** The note under the backward plate: how far the forced choice reaches back into the window. reach: the earliest
 * time from which the bound falls steadily to the end; null if it is past the window. */
export function reachSay(reach, end, deadline, window) {
  if (deadline) return `With a deadline, the program's horizon is the deadline itself: the bound comes down to 0 there.`;
  if (reach === null || reach > window) return `The bound starts down toward 0 only after the window ends (at about time ${f2(Math.max(reach ?? end, window))}), so the forced choice at ${f2(end)} leaves the window alone.`;
  return `Here the bound starts down toward the forced choice at about time ${f2(reach)}, inside the window; the cost is low enough that decisions run long.`;
}

export function floorSay(loss, undecided, paperValue) {
  return `On this page's grid, the constant-cost bound at a cost of 0.02 loses ${pts(loss)} points per 100 trials against the program with the choice forced at 10, with ${pc1(undecided)} of trials still undecided there; the paper's grid gives ${paperValue}.`;
}

// ---- scoring ----------------------------------------------------------------------------------------------------
const POLICY = { best: "the best bound", pm: "the per-moment rule", wb: "the weighted rule" };
/** The sentence under the density plate: by time t, the mass decided correctly and wrongly (forced: the part of it
 * forced to choose at a deadline, once t reaches it); then the whole trial's accuracy, mean decision time, cost, and
 * reward. */
export function densitySay(policy, t, up, lo, total, forced = 0) {
  const left = Math.max(0, 1 - up - lo);
  const by = forced > 0
    ? `Under ${POLICY[policy]}, by the deadline at ${t.toFixed(2)}, every trial has decided, ${pc1(up)} correctly and ${pc1(lo)} wrongly; ${pc1(forced)} of all trials were forced to choose at the deadline itself`
    : `Under ${POLICY[policy]}, by time ${t.toFixed(2)}, ${pc1(up)} of trials have decided correctly, ${pc1(lo)} wrongly, and ${left < 0.0005 ? "under 0.1%" : pc1(left)} are still deciding`;
  return `${by}. Over the whole trial: ${pc1(total.p)} correct, a mean decision time of ${f3(total.rt)}, a mean cost of ${f4(total.paid)}, so a reward of ${f4(total.reward)}, with no sampling error.`;
}

/** The verdict after the reader's guess of how many trials it takes (both as counts). */
export function trialsVerdict(guess, needed) {
  if (!(guess > 0)) return `It takes about ${count(needed)} trials, from the spread of the runs below.`;
  const d = Math.log10(needed / guess);
  if (Math.abs(d) < 0.5) return `About right: it takes about ${count(needed)} trials, from the spread of the runs below; your guess was ${count(guess)}.`;
  const by = Math.abs(d) < 1.5 ? "about ten times" : `about ${Math.round(Math.abs(d))} powers of ten`;
  return `It takes about ${count(needed)} trials, from the spread of the runs below: ${by} ${d > 0 ? "more" : "fewer"} than your ${count(guess)}.`;
}

/** The sentence under the trials plate: exact is the density's score on the page's grid and fine on a grid four
 * times finer (the same bound and time step), both approximations of the trials' continuous-evidence expected reward;
 * needed is null until the reader has guessed or pressed Show me. */
export function trialsSay(n, mean, se, exact, fine, sd, target, needed) {
  const z = (mean - fine) / se, d = fine - exact;
  const move = Math.abs(d) < 1e-9 ? "by less than 10⁻⁹" : `by ${d > 0 ? "+" : "−"}${sci(Math.abs(d))}`;
  let s = `After ${count(n)} simulated trials, the average reward is ${f4(mean)} ± ${f4(2 * se)} (two standard errors, sampling only). The density gives ${f4(exact)} on this page's grid and ${f4(fine)} on one four times finer: at the same bound and time step, refining the evidence step moves the score ${move}. The trials' evidence isn't on a grid; the finer score is an approximation to their expected reward, not that value, and their average is ${Math.abs(z).toFixed(1)} standard errors ${z >= 0 ? "above" : "below"} it. `;
  s += `One trial's reward has a spread of ${f3(sd)}`;
  s += needed === null ? ", and the standard error shrinks like one over the square root of the number of trials." : `, so a standard error of 2 × 10⁻⁵ would take about ${count(needed)} trials.`;
  return s;
}

// ---- the monitoring shift ------------------------------------------------------------------------------------------
const SIDE = { out: "further out", stay: "where it is", in: "further in" };
export function overshootVerdict(guess) {
  const fact = "A rule checked every Δt stops past its bound, on average, so a bound set for continuous watching has to move in to stop where it should.";
  if (guess === "in") return "Right. " + fact;
  if (guess === "stay") return "It has to move. " + fact;
  if (guess === "out") return "The other way. " + fact;
  return "Further in. " + fact;
}

/** The sentence under the overshoot plate: dt, the runs' mean overshoot and its standard error, the number of runs. */
export function overshootSay(dt, mean, se, n) {
  const r = mean / Math.sqrt(dt), e = (2 * se) / Math.sqrt(dt);
  return `Checked every ${dt}, the ${count(n)} runs stop on average ${f4(mean)} past the bound, which is ${f3(r)} ± ${f3(e)} times √Δt (two standard errors, sampling only). The leading-order constant, the limit as Δt shrinks, is 0.5826.`;
}

const between = (a, b) => (f2(a) === f2(b) ? `at ${f2(a)}` : `between ${f2(a)} and ${f2(b)}`);
/** The sentence under the coefficient plate. steady: [lo, hi] of k over the times where the cost holds steady (or
 * null); all: { lo, hi, tLo, tHi } over the window (null where no time has a coefficient); lastK: k at the last check before a deadline (or null). A
 * departure is a value more than 0.03 from 0.5826. */
export function coefSay(steady, all, lastK, constant) {
  const K0 = 0.5826;
  if (!all) return "At every time compared, one of the two bounds is 0 or past the cap, so there is no coefficient to draw.";
  let s = steady ? `Where the cost holds steady, the measured coefficient stays ${between(steady[0], steady[1])}, near ${K0}. ` : "";
  if (constant) return s + "The cost never changes here, so every time is steady.";
  const down = all.lo < K0 - 0.03, up = all.hi > K0 + 0.03;
  if (down || up) {
    const parts = [];
    if (down) parts.push(`falls to ${f2(all.lo)} at time ${f2(all.tLo)}`);
    if (up) parts.push(`rises to ${f2(all.hi)} at time ${f2(all.tHi)}`);
    s += `It ${parts.join(" and ")}: where the bound moves a long way within a few checks, the leading-order shift no longer describes it. `;
  } else s += `Over the whole ${lastK !== null ? "trial" : "window"} it stays ${between(all.lo, all.hi)}, within 0.03 of ${K0}. `;
  if (lastK !== null && Number.isFinite(lastK)) s += `At the last check before the deadline it is ${f2(lastK)}.`;
  return s.trim();
}

/** The sentence under the shift plate: the two rules' losses with and without the shift (points per 100 trials);
 * same when both rules are the constant-cost bound, and horizon the program's forced choice. */
export function shiftSay(L, same, horizon = 8.5) {
  const both = (x) => (pts(x.on) === pts(x.off) ? `${pts(x.on)} with the shift and the same without it`
    : `${pts(x.on)} with the shift and ${pts(x.off)} without it${x.on < x.off ? "" : ", so here the shift makes it worse"}`);
  if (same) {
    const sign = L.pm.on < 0 ? " Here it is negative: the program's bound as scored, read between grid points, earns slightly less than the program's own value, and the rule's bound lands in between." : "";
    return `On this schedule both rules give the constant-cost bound, which loses ${both(L.pm)} (points per 100 trials, against the program on the same grid). The loss left with the shift is a measured difference, not an error estimate: it includes the forced choice at ${f2(horizon)}, which the rule doesn't know about; the shift itself, which is right only to leading order; and the grid.${sign}`;
  }
  return `The per-moment rule loses ${both(L.pm)}; the weighted rule loses ${both(L.wb)} (points per 100 trials, against the program on the same grid).`;
}

// ---- the sinusoid test ----------------------------------------------------------------------------------------------
/** The verdict after the reader's guess (10, 1, or 0.1, in percent): paperWorst is the paper's worst gap in percent
 * (a macro), pageWorst this page's, measured. */
export function fitVerdict(guess, paperWorst, pageWorst) {
  const fact = `The paper's program agrees with the closed form to about ${paperWorst}% on the swing at every frequency; this page's coarser grid, to ${pageWorst.toFixed(1)}% at worst.`;
  if (guess === null || guess === undefined) return fact;
  if (+guess === 0.1) return `Right, for the paper's grid. ${fact}`;
  return `Closer than that. ${fact}`;
}

/** The sentence under the fit plate for one frequency. page: { swing, lead }; paper: [swing, lead] from Table 1;
 * closed: { gain, lead }. */
export function fitSay(om, page, paper, closed) {
  return `At ω = ${om}, the closed form gives a swing of ${f3(closed.gain)} and a lead of ${closed.lead.toFixed(1)}°. The paper's program measured ${paper[0].toFixed(3)} and ${paper[1].toFixed(1)}°; this page's, on its coarser grid, ${f3(page.swing)} and ${page.lead.toFixed(1)}°.`;
}

// ---- the sweep ----------------------------------------------------------------------------------------------------
/** The verdict after the reader's guess of the error at 0.6 (in percent), from 0.3's (in percent, a macro). */
export function sweepVerdict(guess, at03, at06) {
  const r = at06 / at03;
  const fact = `It is at most ${at06}%: ${r.toFixed(1)} times the most at 0.3, near the 4 of a square (doubling the size multiplies a second-order error by 4). These are rounded, printed values.`;
  if (guess === null || guess === undefined) return fact;
  const g = +guess;
  const kind = Math.abs(g - 4 * at03) < 1e-9 ? "second order" : Math.abs(g - 2 * at03) < 1e-9 ? "first order" : "third order";
  if (kind === "second order") return `Right. ${fact}`;
  return `That is what a ${kind} error would give. ${fact}`;
}

/** The sentence under the sweep plate for this page's own runs: rows { rel, ratio, phase }, at the cost and frequency;
 * paperSmall is Table 2's largest swing error, in percent, below 0.3 at that cost. */
export function sweepSay(rows, c0, om, paperSmall) {
  const e = (r) => Math.abs(r.ratio - 1) * 100;
  const big = rows.filter((r) => r.rel >= 0.3), small = rows.filter((r) => r.rel < 0.3);
  let s = `On this page's grid at c₀ = ${c0} and ω = ${om}, the swing is off by ${big.map((r) => `${e(r).toFixed(1)}% at ${r.rel}`).join(" and ")}`;
  if (big.length === 2 && e(big[0]) > 0) s += `, a growth of ${(e(big[1]) / e(big[0])).toFixed(1)}-fold for twice the size`;
  s += ". ";
  if (small.length) {
    const lo = Math.min(...small.map(e)), hi = Math.max(...small.map(e));
    const span = lo.toFixed(1) === hi.toFixed(1) ? `are ${lo.toFixed(1)}%` : `run from ${lo.toFixed(1)}% to ${hi.toFixed(1)}%`;
    s += hi > 2 * paperSmall
      ? `Below 0.3, its errors ${span}, where Table 2's are ${paperSmall.toFixed(1)}% or less: it is the same test on a coarser grid, so the difference is this grid's.`
      : `Below 0.3, its errors ${span}, close to Table 2's (${paperSmall.toFixed(1)}% or less).`;
  }
  return s;
}

// ---- refining the grid ---------------------------------------------------------------------------------------------
/** The verdict after the reader's guess of which losses move more under refinement: pmAbs, wbAbs the paper's largest
 * moves in points (macros, as printed); pmRel, wbRel the largest moves as shares of the loss on the paper's grid,
 * from the unrounded results, over the losses of at least floor points. */
export function gridVerdict(guess, pmAbs, wbAbs, pmRel, wbRel, floor = 0.001) {
  const pts_ = `in points per 100 trials, the per-moment losses move more, by at most ${pmAbs} against ${wbAbs}`;
  const share = `as a share of the loss, the weighted ones move more, by up to ${pct(wbRel)} against ${pc1(pmRel)} (over losses of at least ${floor} points), because they are so small`;
  if (guess === "pm") return `Yes, ${pts_}. But ${share}.`;
  if (guess === "wb") return `Yes, ${share}. But ${pts_}.`;
  const both = `It depends how you measure: ${pts_}; ${share}.`;
  return guess === "same" ? `Not quite. ${both}` : both;
}

/** The sentence under the grid plate for the reader's schedule: rows { dt, h, pm, wb } from coarse to fine. */
export function refineSay(rows, label) {
  const a = rows[0], z = rows[rows.length - 1];
  return `${label}: from this page's grid to the finest of its three, the per-moment loss moves from ${pts(a.pm)} to ${pts(z.pm)} and the weighted loss from ${pts(a.wb)} to ${pts(z.wb)} points per 100 trials.`;
}

/** Why a plate doesn't run, or what it does instead. */
export function scheduleNote(kind, label) {
  if (kind === "deadline") return `${label}: the program's horizon is the deadline, where the choice is forced, and the plate runs up to it.`;
  if (kind === "constant") return `${label}: the cost never changes, so the program's bound is flat until the forced choice pulls it down, and both rules give the constant-cost bound.`;
  return `${label}: the program runs 6 time units past the window, to a forced choice at 8.5.`;
}
