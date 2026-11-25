// The sentences under chapter 10's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch10.mjs runs these on the plates' numbers and on their edge cases.

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** A loss or a small quantity, readable at any size: fixed decimals down to 0.001, then two significant digits. */
export function num(x) {
  if (!Number.isFinite(x)) return "–";
  const a = Math.abs(x), s = x < 0 ? "−" : "";
  if (a === 0) return "0";
  if (a >= 10) return s + a.toFixed(1);
  if (a >= 1) return s + a.toFixed(2);
  if (a >= 0.01) return s + a.toFixed(3);
  if (a >= 0.001) return s + a.toFixed(4);
  let e = Math.floor(Math.log10(a)), m = a / 10 ** e;
  if (+m.toFixed(1) >= 10) { e += 1; m = a / 10 ** e; }
  return `${s}${m.toFixed(1)} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
}
/** A share as a percentage, to d decimals. */
export const pct = (x, d = 1) => (Number.isFinite(x) ? `${(100 * x).toFixed(d)}%` : "–");
const signed = (x, d) => { if (!Number.isFinite(x)) return "–"; const v = x.toFixed(d); return +v === 0 ? (0).toFixed(d) : (x > 0 ? "+" : "−") + Math.abs(x).toFixed(d); };
export { signed };
const FAM = { smooth: "smooth schedules", step: "steps", deadline: "deadlines", pulse: "pulses", ramp: "ramps", "multi-step": "multi-steps", piecewise: "piecewise schedules" };
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const list = (xs) => (xs.length < 2 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);

// ---- the hero -----------------------------------------------------------------------------------------------------
/** fam: a family's name, or null for all of them; med: the median share avoided over the n schedules where the
 * per-moment rule loses at least 0.01. */
export function heroLabel(fam, med, n) {
  return `${fam ? fam : "All families"}: a median of ${pct(med)} of the per-moment loss avoided (${n} schedules)`;
}

// ---- the development schedules ---------------------------------------------------------------------------------------
/** rec: { smooth, step, deadline } shares of each family's total per-moment loss that the weighted rule avoids. */
export function devVerdict(guess, rec) {
  const fams = Object.keys(rec), worst = fams.reduce((a, b) => (rec[b] < rec[a] ? b : a));
  const others = fams.filter((f) => f !== worst).map((f) => `${pct(rec[f])} on ${FAM[f]}`);
  const fact = `The weighted rule recovers the smallest share on ${FAM[worst]}: ${pct(rec[worst])} of the per-moment rule's total loss there, against ${list(others)}.`;
  if (!guess) return fact;
  return (guess === worst ? "Right. " : `Not ${FAM[guess]}. `) + fact;
}

/** One tapped development schedule: its label, the paper's two losses (its grid), and the page's (its own grid). */
export function devTap(label, paper, page) {
  const s = `${label}. On the paper's grid, the per-moment rule loses ${num(paper.pm)} points per 100 trials and the weighted look-ahead ${num(paper.wb)}; on this page's coarser grid, ${num(page.pm)} and ${num(page.wb)}. `;
  const a = within(paper.pm, page.pm), b = within(paper.wb, page.wb);
  if (a !== null && b !== null) return s + `The two grids agree to within ${a}% on the per-moment loss and ${b}% on the weighted loss.`;
  return s + agree("per-moment", paper.pm, page.pm) + " " + agree("weighted", paper.wb, page.wb);
}
/** The whole-percent agreement of two positive losses within half of each other, else null. */
const within = (paper, page) => { const rel = Math.abs(page / paper - 1); return paper > 0 && page > 0 && rel <= 0.5 ? Math.max(1, Math.ceil(rel * 100)) : null; };
/** How a loss on the page's grid compares with the paper's: within a share, or apart; a pair that differs in sign or by
 * more than half is below what the coarser grid resolves (the paper's own reading of two grids that differ widely). */
export function agree(who, paper, page) {
  if (!Number.isFinite(paper) || !Number.isFinite(page)) return "";
  const w = within(paper, page);
  if (w !== null) return `The two grids agree on the ${who} loss to within ${w}%.`;
  return `The two grids disagree on the ${who} loss${Math.sign(paper) !== Math.sign(page) ? " even in sign" : ""}: at ${num(paper)}, it is below what the page's grid resolves.`;
}

// ---- the held-out schedules ------------------------------------------------------------------------------------------
/** guess: a share between 0 and 1 (or null); med, p10, min: the paper's shares; n: how many schedules they cover. */
export function heldVerdict(guess, med, p10, min, n) {
  const fact = `On the ${n} schedules where the per-moment rule loses at least 0.01, the weighted rule avoids a median of ${pct(med)} of that loss, with a 10th percentile of ${pct(p10)} and a minimum of ${pct(min)}.`;
  if (guess === null || !Number.isFinite(guess)) return fact;
  const d = 100 * (guess - med);
  const miss = Math.abs(d) < 0.5 ? "Your guess is within half a point of the median. " : `Your guess, ${pct(guess, 0)}, is ${Math.abs(d).toFixed(1)} points ${d < 0 ? "low" : "high"}. `;
  return miss + fact;
}
/** A tapped held-out schedule: its label, the two losses, and the share avoided where it is defined. */
export function heldTap(label, pm, wb) {
  const share = pm >= 0.01 ? `, so the weighted rule avoids ${pct(1 - wb / pm)} of the per-moment rule's loss` : "; the per-moment loss is under 0.01, where the paper doesn't count the share avoided";
  return `${label}: per-moment ${num(pm)}, weighted ${num(wb)} points per 100 trials${share}.`;
}

// ---- seven rules on the reader's schedule ----------------------------------------------------------------------------
/** run: { rules: { key: { loss } } }; names: key -> the rule's name inside a sentence; flat: the cost doesn't change. */
export function yoursSay(label, run, names, flat = false) {
  const s0 = yoursBody(label, run, names, flat);
  return Object.values(run.rules).some((r) => r.loss < 0) ? s0 + " A negative loss means a rule scored a little above the program on this grid." : s0;
}
function yoursBody(label, run, names, flat) {
  const pm = run.rules.per_moment.loss, wb = run.rules.weighted.loss;
  if (flat) return `${label} doesn't change, so every rule here but the tuned constant gives the per-moment bound, which is optimal on an infinite horizon with continuous checking. The losses this grid scores, about ${num(pm)} points per 100 trials, come from checking only every 0.01 time units and from the forced choice at t = 10.`;
  let s = `On ${label}, on this page's grid, the per-moment rule loses ${num(pm)} points per 100 trials and the weighted look-ahead ${num(wb)}`;
  s += pm >= 0.01 ? `, so the weighted rule avoids ${pct(1 - wb / pm)} of the per-moment rule's loss. ` : `. The per-moment loss is under 0.01, where the paper doesn't count the share avoided. `;
  const others = Object.keys(run.rules).filter((k) => k !== "per_moment" && k !== "weighted");
  const less = others.filter((k) => run.rules[k].loss < pm - 1e-9).map((k) => names[k]);
  const more = others.filter((k) => run.rules[k].loss > pm + 1e-9).map((k) => names[k]);
  const same = others.length - less.length - more.length;
  if (!others.length) return s.trim();
  const n = WORDS[others.length] ?? String(others.length);
  if (!less.length) s += `None of the other ${n} rules loses less than the per-moment rule here.`;
  else if (!more.length && !same) s += `All of the other ${n} rules lose less than the per-moment rule here.`;
  else s += `Of the other ${n}, ${list(less)} ${less.length === 1 ? "loses" : "lose"} less than the per-moment rule here${more.length ? `, and ${list(more)} more` : ""}${same ? `; ${WORDS[same] ?? same} ${same === 1 ? "ties" : "tie"}` : ""}.`;
  return s + " This is one schedule; Table 6 counts the 180 held-out schedules without a deadline.";
}

// ---- close in reward -------------------------------------------------------------------------------------------------
/** guess and med: shares of the reward (0.0016 is 0.16%). */
export function shareVerdict(guess, med) {
  const fact = `The median is ${pct(med, 2)} of the reward.`;
  if (guess === null || !Number.isFinite(guess) || !(guess > 0) || !(med > 0)) return fact;
  const r = guess / med;
  const miss = r >= 0.67 && r <= 1.5 ? "Your guess is within a factor of 1.5 of it. " : `Your guess, ${pct(guess, guess < 0.001 ? 3 : guess < 0.01 ? 2 : 1)}, is about ${(r >= 1 ? r : 1 / r).toFixed(r >= 10 || r <= 0.1 ? 0 : 1)} times too ${r > 1 ? "high" : "low"}. `;
  return miss + fact;
}
/** The reader's schedule: the per-moment rule's largest bound gap (before `until`, "t = 4" or "the deadline"), its loss,
 * and that loss's share of the reward. */
export function shareYours(label, gap, loss, reward, until) {
  const share = loss / (100 * reward);
  let s = `On ${label}, on this page's grid, the per-moment bound strays up to ${gap.toFixed(2)} evidence units from the best bound before ${until}, `;
  if (!(loss > 0)) return s + `and loses ${num(loss)} points per 100 trials: nothing this grid can tell from 0.`;
  return s + `and gives up ${num(loss)} points per 100 trials, ${share >= 0.0001 ? pct(share, 2) : "under 0.01%"} of the best policy's reward.`;
}

// ---- the loss formula ------------------------------------------------------------------------------------------------
/** guess: "over", "under", or "about"; r16: the per-moment rule's predicted / actual for the 16-fold steps. */
export function formulaVerdict(guess, r16, lo, hi) {
  const fact = `For the 16-fold steps, the formula predicts ${r16.toFixed(2)} times the per-moment rule's scored loss; for the five other rows, ${lo.toFixed(2)} to ${hi.toFixed(2)} times.`;
  if (!guess) return fact;
  const truth = r16 > 1.1 ? "over" : r16 < 0.9 ? "under" : "about";
  return (guess === truth ? "Right: it overestimates. " : truth === "over" ? "It overestimates. " : "") + fact;
}
/** The weighted rule's late share at the smallest size of each family. */
export function lateSay(smooth, step) {
  return `At the smallest size of each family, ${pct(smooth, 0)} (smooth, size 0.25) and ${pct(step, 0)} (steps, 1.5-fold) of the weighted rule's prediction comes from times after t = 8, where the optimal bound collapses toward the forced choice.`;
}

// ---- the scaling ----------------------------------------------------------------------------------------------------
const GROWTH = [2, 4, 8, 16];
/** guess: { pm, wb } growth factors per doubling (or null); g: the per-moment growth factors up to a = 0.4; orders:
 * { pm, wbPaper, wbFine } effective orders. */
export function scalingVerdict(guess, g, orders) {
  const lo = Math.min(...g), hi = Math.max(...g);
  const fact = `Up to a = 0.4, each doubling multiplies the per-moment loss by ${lo.toFixed(1)} to ${hi.toFixed(1)} (effective order ${orders.pm.toFixed(1)}); from a = 0.2 to 0.8, the weighted rule's effective order is ${orders.wbPaper.toFixed(1)} on the paper's grid and ${orders.wbFine.toFixed(1)} on the finer one, a growth of about ${(2 ** orders.wbPaper).toFixed(0)} to ${(2 ** orders.wbFine).toFixed(0)} per doubling.`;
  if (!guess || (guess.pm === null && guess.wb === null)) return fact;
  const near = (x, p) => x !== null && Math.abs(Math.log2(x) - p) < 0.5;
  const right = (near(guess.pm, orders.pm) ? 1 : 0) + (near(guess.wb, (orders.wbPaper + orders.wbFine) / 2) ? 1 : 0);
  return (right === 2 ? "Both guesses are the nearest choices. " : right === 1 ? "One guess is the nearest choice. " : "Neither guess is the nearest choice. ") + fact;
}
export const GROWTH_CHOICES = GROWTH;
/** The page's own grid on Table 9's shape: rows [{ a, pm, wb }] with a = 0 the constant cost, and the paper's grid's
 * losses [{ a, pm, wb }] at the same amplitudes. */
export function scalingPage(rows, paper) {
  const floor = rows.find((r) => r.a === 0), amps = rows.filter((r) => r.a > 0);
  const below = amps.filter((r) => Math.abs(r.wb) <= Math.abs(floor.pm)).map((r) => r.a);
  const pmOk = amps.filter((r) => { const p = paper.find((q) => q.a === r.a); return p && Math.abs(r.pm / p.pm - 1) <= 0.1; }).map((r) => r.a);
  let s = `On this page's grid, the per-moment rule scores ${num(floor.pm)} at the constant cost, where it is optimal on an infinite horizon with continuous checking: that is this grid's own error there. `;
  s += below.length ? `The weighted rule's loss is no larger in size than that at a = ${list(below.map(String))}, so this grid can't measure it there` : "The weighted rule's loss is larger in size than that at every amplitude";
  s += pmOk.length ? `; the per-moment loss is within 10% of the paper's grid at a = ${list(pmOk.map(String))}.` : "; the per-moment loss differs from the paper's grid by more than 10% at every amplitude.";
  return s;
}
