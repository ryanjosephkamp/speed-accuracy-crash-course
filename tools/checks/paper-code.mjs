// The book's solver held to the paper's own code. tools/validity/paper-code.json holds what the paper's code at the
// tag computes on the book's ten schedules, the default drawing, and the comparator's edge cases
// (tools/validity/paper_code.py); chapter 1's tools/validity/ch01.json adds two stress schedules run by the tag's code
// on the page's grid. Here the page's model.js and its worker compute the same things, and every comparison goes
// through one comparator, compare() below, with the tolerance written beside it:
// - the exact bound (known.backward_induction_x against exactPolicy), over the window: within 1e-6 (the two differ
//   only in how they convolve: an FFT against a direct sum cut at six standard deviations; about 1e-8 in practice);
// - the per-moment bound (shortcuts.bound_for_cost against perMoment): within 1e-10, the same table;
// - the weighted look-ahead (shortcuts.weighted_bound against weightedBound): within 1e-10;
// - what each policy earns (evaluate.known_reward against score): within 1e-7 in reward, accuracy, and cost.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exactPolicy, perMoment, weightedBound, toDiscrete, score } from "../../book/assets/js/model.js";
import { deadlineOf } from "../../book/assets/js/schedules-book.js";
import { CHOICES, spec, costFromSpec, HORIZON, EDGE_CONSTANT, EDGE_HORIZON, EDGE_CHOICES } from "../validity/schedules.mjs";
import { check, ROOT, runWorker } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/paper-code.json"), "utf8"));
const STRESS = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch01.json"), "utf8")).subStep;
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
check("schedule", "the reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit,
  `paper-code.json from ${REF.tag} (${REF.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);

/** The one comparator. page and tag are the same quantity at the same times, and both must hold exactly `length`
 * entries. Off the grid's cap the page's program writes Infinity and the fixtures write null: either reads as off the
 * cap, and two off-cap entries agree. With h given (an exact bound), a tag entry of 0 against a page entry strictly
 * between 0 and h is a below-step pair: the tag's code reports 0 wherever the grid's first step past the center
 * decides, and the page places the bound between the center and that step where its center still waits (a genuine
 * center stop is 0 on both sides, an ordinary equal pair). Every other pair must be finite on both sides and within
 * tol. */
function compare(page, tag, { length, tol, h = null }) {
  const off = (v) => v === null || v === Infinity;
  const out = { ok: false, n: 0, worst: 0, offCap: 0, belowStep: 0, bad: 0, first: null };
  if (!page || !tag || page.length !== length || tag.length !== length) {
    out.first = `lengths ${page?.length} and ${tag?.length}, expected ${length}`;
    return out;
  }
  for (let i = 0; i < length; i++) {
    const p = page[i], r = tag[i];
    out.n++;
    if (off(p) && off(r)) { out.offCap++; continue; }
    if (off(p) || off(r) || !Number.isFinite(p) || !Number.isFinite(r)) { out.bad++; out.first ??= `entry ${i}: ${p} against ${r}`; continue; }
    if (h !== null && r === 0 && p > 0 && p < h) { out.belowStep++; continue; }
    const d = Math.abs(p - r);
    out.worst = Math.max(out.worst, d);
    if (!(d <= tol)) { out.bad++; out.first ??= `entry ${i}: ${p} against ${r}`; }
  }
  out.ok = out.bad === 0;
  return out;
}
const said = (c) => `${c.n} entries, largest difference ${c.worst.toExponential(2)}, ${c.offCap} both off the cap, ${c.belowStep} below-step pairs${c.first ? `; ${c.first}` : ""}`;

// ---- the comparator itself (a test of the helper, on made-up series) -----------------------------------------------
{
  const h = REF.h;
  const resolved = compare([0.5 + 2e-6, 0.3], [0.5, 0.3], { length: 2, tol: 1e-6, h });
  const above = compare([0.03], [0], { length: 1, tol: 1e-6, h }), below = compare([0.018], [0], { length: 1, tol: 1e-6, h });
  const noStep = compare([0.018], [0], { length: 1, tol: 1e-6 });
  check("schedule", "the comparator (a helper test): a resolved pair 2e-6 apart fails at a tolerance of 1e-6; a page bound of 0.03 against the tag's 0 fails, since it is above the first step; 0.018 against 0 is a below-step pair for an exact bound and a failure for any other series",
    !resolved.ok && resolved.bad === 1 && !above.ok && below.ok && below.belowStep === 1 && !noStep.ok, `${said(resolved)}; ${said(above)}; ${said(below)}`);
  const offs = compare([Infinity, null, 1], [null, null, 1], { length: 3, tol: 1e-6 });
  const half = compare([Infinity], [0.4], { length: 1, tol: 1e-6 }), half2 = compare([0.4], [null], { length: 1, tol: 1e-6 });
  const nan = compare([NaN], [0.4], { length: 1, tol: 1e-6 }), neg = compare([-Infinity], [null], { length: 1, tol: 1e-6 });
  const short = compare([1, 2], [1, 2], { length: 3, tol: 1e-6 }), uneven = compare([1, 2, 3], [1, 2], { length: 3, tol: 1e-6 });
  check("schedule", "the comparator (a helper test): the page's Infinity and the fixtures' null both read as off the cap and agree; off the cap on one side only fails, as do NaN, minus infinity, and series shorter than the expected length",
    offs.ok && offs.offCap === 2 && !half.ok && !half2.ok && !nan.ok && !neg.ok && !short.ok && !uneven.ok, `${said(offs)}; ${said(short)}`);
}

// ---- model.js against the tag, schedule by schedule --------------------------------------------------------------
let defaultsBelow = 0;
for (const choice of CHOICES) {
  const s = spec(choice), cost = costFromSpec(s), ref = REF.schedules[s.id];
  if (!ref) { check("schedule", `${s.id}: in the reference`, false, "missing; rerun tools/validity/paper_code.py"); continue; }
  // a deadline is solved up to the deadline, as the page's worker does; the window is every dt from 0 to its end
  const end = s.kind === "deadline" ? Math.min(s.at, REF.view) : REF.view, want = Math.round(end / REF.dt) + 1;
  const { ts, bounds, dt } = exactPolicy(cost, s.kind === "deadline" ? s.at : HORIZON, REF.dt, REF.h, REF.cap);
  const tv = Array.from(ts.slice(0, want));
  const ex = compare(Array.from(bounds.slice(0, want)), ref.exact, { length: want, tol: 1e-6, h: REF.h });
  defaultsBelow += ex.belowStep;
  check("schedule", `${s.id}: the page's dynamic program matches the paper's backward_induction_x at all ${want} times of the window (within 1e-6)`, ex.ok, said(ex));
  const pm = compare(Array.from(perMoment(cost, tv)), ref.perMoment, { length: want, tol: 1e-10 });
  check("schedule", `${s.id}: the per-moment bound matches the paper's bound_for_cost at all ${want} times (within 1e-10)`, pm.ok, said(pm));
  const wb = compare(Array.from(weightedBound(cost, tv)), ref.weighted, { length: want, tol: 1e-10 });
  check("schedule", `${s.id}: the weighted look-ahead matches the paper's weighted_bound at all ${want} times (within 1e-10)`, wb.ok, said(wb));
  // what each policy earns, over the solver's span (a deadline up to the deadline)
  const tAll = Array.from(ts);
  const exactB = Array.from(bounds, (v) => (Number.isFinite(v) ? v : REF.cap));
  const pmB = Array.from(perMoment(cost, tAll), (v) => toDiscrete(v, dt));
  const wbB = Array.from(weightedBound(cost, tAll), (v) => toDiscrete(v, dt));
  for (const [name, b] of [["exact", exactB], ["perMoment", pmB], ["weighted", wbB]]) {
    const o = score(b, tAll, cost, REF.h, REF.cap), r = ref.scores[name], c = compare([o.reward, o.p, o.paid], [r.reward, r.p, r.paid], { length: 3, tol: 1e-7 });
    check("schedule", `${s.id}: what the ${name === "exact" ? "exact policy" : name === "perMoment" ? "per-moment rule" : "weighted rule"} earns matches the paper's known_reward in reward, accuracy, and cost (within 1e-7)`, c.ok,
      `reward ${o.reward.toFixed(6)} vs ${r.reward.toFixed(6)}; ${said(c)}`);
  }
}
check("schedule", "the eleven schedules at their starting settings never reach a bound below the grid's first step, so every cell above was compared to 1e-6 (the edge cases below exercise that branch)", defaultsBelow === 0, `${defaultsBelow} below-step pairs`);

// ---- below the grid's first step, on the tag's own output: a center that waits and a genuine center stop ----------
// At a constant cost of 3.2 or 4.2, with the choice forced at time 2, the tag's code reports 0 at time 0. Its value at
// the center then says which case it is: above 0.5 (deciding's value there), the center waits; exactly 0.5, it stops.
{
  const [wait, stop] = EDGE_CONSTANT.map((c) => {
    const ref = REF.edge[`constant ${c}`], n = Math.round(EDGE_HORIZON / REF.dt) + 1;
    const { bounds } = exactPolicy(() => c, EDGE_HORIZON, REF.dt, REF.h, REF.cap);
    return { c, ref, page: bounds, cmp: compare(Array.from(bounds), ref.exact, { length: n, tol: 1e-6, h: REF.h }) };
  });
  check("schedule", `at a constant cost of ${wait.c} with the choice forced at ${EDGE_HORIZON}, the tag reports 0 at time 0 and its center value is above 0.5 (the center waits); the page's bound there lies between 0 and the first step, and the comparator counts it as a below-step pair, with every other time compared`,
    wait.ref.exact[0] === 0 && wait.ref.v0 > 0.5 && wait.page[0] > 0 && wait.page[0] < REF.h && wait.cmp.ok && wait.cmp.belowStep > 0,
    `tag ${wait.ref.exact[0]}, center value ${wait.ref.v0.toFixed(8)}; page ${wait.page[0].toFixed(7)}; ${said(wait.cmp)}`);
  check("schedule", `at a constant cost of ${stop.c} with the choice forced at ${EDGE_HORIZON}, the tag reports 0 at time 0 and its center value is exactly 0.5 (the center stops); the page's bound is 0 there too, an equal pair, and no time is a below-step pair`,
    stop.ref.exact[0] === 0 && stop.ref.v0 === 0.5 && stop.page[0] === 0 && stop.cmp.ok && stop.cmp.belowStep === 0,
    `tag ${stop.ref.exact[0]}, center value ${stop.ref.v0}; page ${stop.page[0]}; ${said(stop.cmp)}`);
}

// ---- the worker the pages call, run here as the page runs it, against the same references -------------------------
{
  const ask = (choice) => runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
  // the expected times: every 0.02 up to the window's end (or the deadline), and the forced choice itself
  const timesTo = (end) => { const w = []; for (let k = 0; k * 0.02 <= end + 1e-9; k++) w.push(+(k * 0.02).toFixed(10)); if (Math.abs(w[w.length - 1] - end) > 1e-9) w.push(end); return w; };
  const at = (arr, ts) => ts.map((t) => arr[Math.round(t / REF.dt)]);
  // one schedule through the worker: its times, its exact bound (with the below-step rule), and, where the reference
  // has it, its per-moment bound moved in for monitoring every 0.01 (shortcuts.discrete), which is 0 at a deadline's
  // forced choice. The worker reads each preset's formula and the tag a table of log c every 0.002.
  const viaWorker = async (choice, exact, pmShifted) => {
    const m = await ask(choice), dl = deadlineOf(choice), want = timesTo(dl ?? REF.view), n = want.length;
    const t = compare(m?.t, want, { length: n, tol: 1e-9 });
    const ex = compare(m?.exact, at(exact, want), { length: n, tol: 1e-6, h: REF.h });
    const pm = pmShifted ? compare(m?.pm, want.map((x, i) => (dl !== null && x >= dl - 1e-9 ? 0 : at(pmShifted, want)[i])), { length: n, tol: 1e-10 }) : null;
    return { m, n, t, ex, pm };
  };
  for (const choice of CHOICES) {
    const s = spec(choice), ref = REF.schedules[s.id], r = await viaWorker(choice, ref.exact, ref.perMomentDiscrete);
    check("schedule", `${s.id}: the page's worker returns the expected ${r.n} times, and the reference's exact bound (within 1e-6) and per-moment bound moved in (within 1e-10, 0 at a forced choice) at each`,
      r.m?.ok && r.t.ok && r.ex.ok && r.pm.ok, `exact: ${said(r.ex)}; per-moment: ${said(r.pm)}`);
  }
  // chapter 1's stress schedules (the tag's code on the page's grid): many times below the first step
  for (const [name, cs] of Object.entries(STRESS.cases)) {
    const r = await viaWorker(cs.choice, cs.exact, null);
    check("schedule", `chapter 1's stress schedule ${name} (tools/validity/ch01.json): the worker's ${r.n} times and exact bounds match the tag's, with the times below the first step counted as below-step pairs and every other time within 1e-6`,
      STRESS.grid.dt === REF.dt && STRESS.grid.h === REF.h && STRESS.grid.cap === REF.cap && r.m?.ok && r.t.ok && r.ex.ok && r.ex.belowStep > 0, said(r.ex));
  }
  // off the cap: a cost falling to 1e-5, where the worker writes Infinity and the fixture null
  for (const [name, choice] of Object.entries(EDGE_CHOICES)) {
    const ref = REF.edge[name], r = await viaWorker(choice, ref.exact, ref.perMomentDiscrete);
    const inf = (r.m?.exact ?? []).filter((v) => v === Infinity).length;
    check("schedule", `a cost that ${name.replace("fall", "falls")} at time 1: the worker writes Infinity where the tag writes null, past the cap, and the comparator pairs them; the finite times and the per-moment bound match (within 1e-6 and 1e-10)`,
      r.m?.ok && r.t.ok && r.ex.ok && r.ex.offCap > 0 && inf === r.ex.offCap && r.ex.offCap < r.n && r.pm.ok, `exact: ${said(r.ex)}; per-moment: ${said(r.pm)}`);
  }
  for (const at of [0.45, 1, 0.8]) {
    const m = await ask({ id: "deadline", params: { at, c: 0.1 } });
    const last = m.t[m.t.length - 1];
    check("schedule", `a deadline at ${at}: the worker's last point is the forced choice, at the deadline, with both bounds 0`,
      Math.abs(last - at) < 1e-9 && m.exact[m.exact.length - 1] === 0 && m.pm[m.pm.length - 1] === 0, `last point ${last}, bounds ${m.exact[m.exact.length - 1]} and ${m.pm[m.pm.length - 1]}`);
  }
}
