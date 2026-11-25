// The sentences under chapter 4's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch04.mjs runs these on random inputs and on the plates' own numbers.
const sign = (s) => s.replace(/^-/, "−");
const f1 = (x) => sign(x.toFixed(1)), f2 = (x) => sign(x.toFixed(2)), f3 = (x) => sign(x.toFixed(3));
/** A time as given: 0, 0.3, 0.45, 1. */
const tt = (x) => String(+x.toFixed(2));
const pct = (x) => `${Math.round(x * 100)}%`;
/** A cost of time, to two significant figures (0.1, 1.6, 0.034). */
export const c2 = (x) => String(+x.toPrecision(2));
/** A lowest or highest cost to three significant figures, rounded outward (down for the lowest, up for the highest)
 * unless it is within 1e-9 of the rounded value, so a printed level never sits inside the true one. */
const outward = (x, dir) => {
  const r = +x.toPrecision(3);
  if (Math.abs(r - x) <= 1e-9 * Math.abs(x) || (dir < 0 ? r <= x : r >= x)) return String(r);
  const e = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2);
  return String(+((dir < 0 ? Math.floor(x / e) : Math.ceil(x / e)) * e).toPrecision(3));
};
export const cLo = (x) => outward(x, -1), cHi = (x) => outward(x, 1);

export function heroLabel(name, lo, hi) {
  return `${name}: the bound stays between B(${cHi(hi)}) and B(${cLo(lo)})`;
}

// ---- one level at each moment
export function couplingSay(step, l1, l2, met, T) {
  if (step === 0) return `By time ${f1(T)}, the path from 0.05 has collected ${f2(l1)} units of local time at 0. Its chance of being right changes on average only through that push.`;
  let s = `By time ${f1(T)}, the lower start has collected ${f2(l1)} units of local time and the upper one ${f2(l2)}. `;
  s += Number.isFinite(met) ? `The paths met at time ${f2(met)}, when the upper one first reached 0, and moved as one after that.`
    : "The paths never met, and the lower one never rose above the upper.";
  return s;
}

export function waitSay(rows) {
  const first = rows[0], last = rows[rows.length - 1];
  return `At each time, the value of waiting never rises as the evidence rises, and it is 0 from the bound up: from ${f2(first.b)} at time ${tt(first.t)} to ${f2(last.b)} at time ${tt(last.t)}, after the rise.`;
}

export function raySay(t, b) {
  return `At time ${f2(t)}, the best rule stops at every evidence level from ${f2(b)} up, and waits below it.`;
}

// ---- the band
export function extremesNote(name, lo, tLo, hi, tHi, view) {
  const at = (t) => (t > view ? `${f1(t)}, after the window` : tt(t));
  const est = (x) => String(+x.toPrecision(5));
  return `${name}: lowest cost ${cLo(lo)}, highest ${cHi(hi)} (rounded outward from the scanned extremes, ${est(lo)} and ${est(hi)}, found by a scan to time 100); the cost first comes within 0.5% of those scanned values at times ${at(tLo)} and ${at(tHi)}.`;
}

/** The cap plate's note when it falls back to Figure 1(a). */
export function capFallback(label, kind) {
  return `${label} has ${kind === "deadline" ? "an infinite cost after its deadline" : "no highest cost"}, so the bound 1 + c_max σ fails; the plate uses Figure 1(a).`;
}

export function outsideNote(kind) {
  if (kind === "deadline") return "A deadline makes the cost infinite after the deadline, so the schedule has no highest cost and part (c) doesn't apply. The program's bound is drawn without a band; the choice is forced at the deadline, where it drops to 0.";
  if (kind === "rising") return "The rising cost grows without bound, so the schedule has no highest cost and part (c) doesn't apply. The program's bound is drawn without a band.";
  return "A constant cost has its lowest and highest values equal, so the band is a single curve: the constant-cost program's bound, which is its best bound. On the grid, that bound isn't flat; it bends down toward the forced choice 6 time units past the window.";
}

/** st: from bandStats in ch04-model.js. */
export function bandSay(st) {
  let s = `The best bound stays between the same program's bounds for the constant costs c_min and c_max, as part (b) requires on the grid too: its closest approach to the lower edge is ${f3(st.gapDn)}, at time ${tt(st.atDn)}, and to the upper edge ${f3(st.gapUp)}, at time ${tt(st.atUp)}. `;
  s += `The continuous edges, B(c) moved in by 0.5826√0.01, differ from those by ${st.shiftGap < 0.0005 ? "less than 0.0005" : `up to ${f3(st.shiftGap)}`} here`;
  const why = [];
  if (st.horizonPull) why.push("the forced choice 6 time units past the window pulls the constant-cost program's bound for the lowest cost down");
  if (st.subStep) why.push("the constant-cost program's bound for the highest cost is below the grid's first step, 0.02, where the page places it between the center and that step (the paper's code reports 0)");
  s += why.length ? `; ${why.join(", and ")}. ` : ". ";
  s += `Of the checks in the window, the best bound is below the per-moment bound by more than 0.002 at ${pct(st.below)} and above it at ${pct(st.above)}.`;
  return s;
}

export function noBandSay(lo, hi) {
  return `Over the window, the best bound runs from ${f2(lo)} to ${f2(hi)}.`;
}

export function sketchVerdict(drew, miss, outside, hasBand) {
  if (!drew) return "You didn't draw a guess. Draw one and press Show me again to compare.";
  let s = `Your drawing is ${f2(miss)} from the best bound on average`;
  if (!hasBand) return s + ".";
  return s + (outside > 0 ? `, and ${pct(outside)} of it lies more than 0.002 outside the band.` : ", and all of it lies inside the band, to within 0.002.");
}

/** The band plate's sentence after Show me, from bandReveal's result r: for Constant the constant-cost note, then the
 * band's measured distances (bandSay) where there is a band, or the bound's range (noBandSay) where there isn't; then
 * the verdict on the drawing, with the band's 0.002 tolerance where there is a band. */
export function revealSay(r, drew) {
  const verdict = sketchVerdict(drew && r.cnt > 0, r.miss, r.outside, r.band);
  if (r.band) return (r.kind === "constant" ? outsideNote("constant") + " " : "") + bandSay(r.st) + " " + verdict;
  return noBandSay(r.lo, r.hi) + " " + verdict;
}

// ---- a higher cost, a lower bound
export function compareSay(step, d) {
  if (step === 0) return `On this path, the decision lasts ${f2(d.tau)} time units. The same decision is charged ${f3(d.paid[0])} under the lowest cost, ${f3(d.paid[1])} under the schedule, and ${f3(d.paid[2])} under the highest.`;
  if (step === 1) return `At evidence 0, the values are ${f3(d.v[0])} under the lowest cost, ${f3(d.v[1])} under the schedule, and ${f3(d.v[2])} under the highest: the higher cost has the lower value.`;
  if (step === 2) return `The value of waiting reaches 0 at ${f2(d.b[0])} under the lowest cost, ${f2(d.b[1])} under the schedule at time 0, and ${f2(d.b[2])} under the highest.`;
  return `Over the window, the program's bound runs from ${f3(d.min)} to ${f3(d.max)}, inside the band of the same program's bounds for the constant costs, ${f3(d.dn)} to ${f3(d.up)}.`;
}

// ---- starting later
export function laterSay(step, d) {
  const t2 = d.t + d.D;
  if (step === 0) return `Started at ${f2(d.t)}, the decision pays ${f3(d.A)}; started at ${f2(t2)}, it pays ${f3(d.B)}.`;
  if (step === 1) return `The shared middle cancels. The ends are ${f3(d.e1)}, paid only from ${f2(d.t)}, and ${f3(d.e2)}, paid only from ${f2(t2)}, so the costs differ by ${f3(d.e2 - d.e1)}.`;
  if (step === 2) return `Each end lies between ${f3(d.lo * d.D)} and ${f3(d.hi * d.D)}, so the two costs differ by at most ${f3((d.hi - d.lo) * d.D)}; here they differ by ${f3(Math.abs(d.e2 - d.e1))}.`;
  return `From ${f2(d.t)} to ${f2(t2)}, the program's value at evidence 0 moves by ${f3(d.dv)}, against the bound of ${f3((d.hi - d.lo) * d.D)}. Its steepest slope in the window is ${f2(d.slope)}, at time ${f2(d.at)}, which matches c_max − c_min = ${f2(d.hi - d.lo)} to the precision shown.`;
}

// ---- decisions on your schedule
export function decideSay(d) {
  if (d.atOnce >= 1) return `A start at or above the bound stops at once: τ* = 0 on every path, and the cost at the moment of decision is the cost now, ${c2(d.c0)}.`;
  let s = `From evidence ${f2(d.y0)} at time ${f2(d.t0)}, half of the ${d.n.toLocaleString("en-US")} decisions have ended by time ${f2(d.t0 + d.median)}. `;
  s += `They take ${f3(d.mean)} time units on average (± ${f3(2 * d.se)}, two standard errors), and the cost at the moment of decision averages ${c2(d.ec)}, against ${c2(d.c0)} at the start`;
  s += d.forced > 0 ? `; ${pct(d.forced)} are forced at the deadline, and those are charged the cost at the deadline itself, which the schedule keeps finite (equal to the rate just before it).` : ".";
  if (d.beyond > 0) s += ` ${d.beyond.toLocaleString("en-US")} end after time ${f2(d.xMax)}, past the right edge of the chart.`;
  return s;
}

export function decideVerdict(guess, at) {
  if (!Number.isFinite(guess)) return "You didn't place a guess; drag the orange line to make one.";
  const d = guess - at;
  if (Math.abs(d) < 0.05) return `Your guess, time ${f2(guess)}, is within 0.05 of it.`;
  return `Your guess, time ${f2(guess)}, is ${f2(Math.abs(d))} time units ${d > 0 ? "late" : "early"}.`;
}

// ---- cap the gain
export function capSay(step, d) {
  if (step === 0) return `Never stopped, every gain stays under the line 1 − c_min s, which is ${f2(1 - d.lo * d.T)} by time ${f1(d.T)} and falls without bound, so every gain does too; the highest of these eight is ${f2(d.maxG)} there.`;
  if (step === 1) return `On ${d.ok.toLocaleString("en-US")} of ${d.n.toLocaleString("en-US")} paths, the decision comes no later than the cap on the grid: τ* ≤ σ. On average, τ* is ${f3(d.mTau)} and σ is ${f3(d.mSig)}.`;
  if (step === 2) return `On the grid, σ averages ${f3(d.mSig)} (± ${f3(2 * d.seSig)}). The paper's formula, b̄ tanh b̄ − y tanh y, is for the continuous model on an infinite horizon and gives ${f3(d.exact)}, so there the bound 1 + c_max σ on the capped gain has the finite mean ${f2(1 + d.hi * d.exact)}.`;
  return `The value process starts at V = ${f3(d.V0)}, and its sampled mean stays within ${f3(d.drift)} of it through time ${f1(d.T)} (two standard errors there: ${f3(2 * d.seEnd)}), which is agreement to sampling and grid error. The mean gain starts at ${f3(d.G0)} and rises to ${f3(d.Gend)} as decisions end.`;
}
