// The book's solver held to the paper's own code. tools/validity/paper-code.json holds what the paper's code at the
// tag computes on the book's ten schedules and the default drawing (tools/validity/paper_code.py); here the page's
// model.js computes the same things from the same schedules, and every difference must be within its tolerance:
// - the exact bound (known.backward_induction_x against exactPolicy), over the window: within 1e-6 (the two differ
//   only in how they convolve: an FFT against a direct sum cut at six standard deviations; about 1e-8 in practice);
// - the per-moment bound (shortcuts.bound_for_cost against perMoment): within 1e-10, the same table;
// - the weighted look-ahead (shortcuts.weighted_bound against weightedBound): within 1e-10;
// - what each policy earns (evaluate.known_reward against score): within 1e-7 in reward, accuracy, and cost.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exactPolicy, perMoment, weightedBound, toDiscrete, score } from "../../book/assets/js/model.js";
import { CHOICES, spec, costFromSpec, HORIZON } from "../validity/schedules.mjs";
import { check, ROOT, runWorker } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/paper-code.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
check("schedule", "the reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit,
  `paper-code.json from ${REF.tag} (${REF.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);

// where the paper's code reports 0 because the first grid step stops, the page places the bound between the center
// and that step when its own Bellman step waits at the center: those cells are compared as "below the first step"
let subStep = 0;
const worst = (a, b, h = null) => a.reduce((m, v, i) => {
  const r = b[i];
  if ((v === null || !Number.isFinite(v)) && (r === null || !Number.isFinite(r))) return m;
  if (h !== null && r === 0 && v > 0 && v < h) { subStep++; return m; }
  return Math.max(m, Math.abs((v ?? Infinity) - (r ?? Infinity)));
}, 0);

for (const choice of CHOICES) {
  const s = spec(choice), cost = costFromSpec(s), ref = REF.schedules[s.id];
  if (!ref) { check("schedule", `${s.id}: in the reference`, false, "missing; rerun tools/validity/paper_code.py"); continue; }
  // a deadline is solved up to the deadline, as the page's worker does
  const { ts, bounds, dt } = exactPolicy(cost, s.kind === "deadline" ? s.at : HORIZON, REF.dt, REF.h, REF.cap);
  const kv = Math.min(Math.round(REF.view / dt), ts.length - 1);
  const tv = Array.from(ts.slice(0, kv + 1));
  const mine = Array.from(bounds.slice(0, kv + 1), (v) => (Number.isFinite(v) ? v : null));
  const dEx = worst(mine, ref.exact, REF.h);
  check("schedule", `${s.id}: the page's dynamic program matches the paper's backward_induction_x over the window (within 1e-6)`, dEx < 1e-6, `largest difference ${dEx.toExponential(2)}`);
  const pm = Array.from(perMoment(cost, tv));
  const dPm = worst(pm, ref.perMoment);
  check("schedule", `${s.id}: the per-moment bound matches the paper's bound_for_cost (within 1e-10)`, dPm < 1e-10, `largest difference ${dPm.toExponential(2)}`);
  const wb = Array.from(weightedBound(cost, tv));
  const dWb = worst(wb, ref.weighted);
  check("schedule", `${s.id}: the weighted look-ahead matches the paper's weighted_bound (within 1e-10)`, dWb < 1e-10, `largest difference ${dWb.toExponential(2)}`);
  // what each policy earns, over the solver's span (a deadline up to the deadline)
  const end = ts.length;
  const tAll = Array.from(ts.slice(0, end));
  const exactB = Array.from(bounds.slice(0, end), (v) => (Number.isFinite(v) ? v : REF.cap));
  const pmB = Array.from(perMoment(cost, tAll), (v) => toDiscrete(v, dt));
  const wbB = Array.from(weightedBound(cost, tAll), (v) => toDiscrete(v, dt));
  for (const [name, b] of [["exact", exactB], ["perMoment", pmB], ["weighted", wbB]]) {
    const o = score(b, tAll, cost, REF.h, REF.cap), r = ref.scores[name];
    const d = Math.max(Math.abs(o.reward - r.reward), Math.abs(o.p - r.p), Math.abs(o.paid - r.paid));
    check("schedule", `${s.id}: what the ${name === "exact" ? "exact policy" : name === "perMoment" ? "per-moment rule" : "weighted rule"} earns matches the paper's known_reward (within 1e-7)`, d < 1e-7,
      `reward ${o.reward.toFixed(6)} vs ${r.reward.toFixed(6)}, largest difference ${d.toExponential(2)}`);
  }
}

// ---- the worker the pages call, run here as the page runs it, against the same reference -------------------------
{
  const ask = (choice) => runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
  for (const choice of CHOICES) {
    const s = spec(choice), ref = REF.schedules[s.id], m = await ask(choice);
    // the expected times: every 0.02 up to the window's end (or the deadline), and the forced choice itself
    const end = s.kind === "deadline" ? s.at : REF.view, want = [];
    for (let k = 0; k * 0.02 <= end + 1e-9; k++) want.push(+(k * 0.02).toFixed(10));
    if (Math.abs(want[want.length - 1] - end) > 1e-9) want.push(end);
    const ok = !!(m && m.ok && Array.isArray(m.t) && m.t.length === want.length && m.t.every((t, i) => Math.abs(t - want[i]) < 1e-9)
      && m.exact.length === m.t.length && m.pm.length === m.t.length);
    let worst = 0, pairs = 0;
    if (ok) m.t.forEach((t, i) => {
      const k = Math.round(t / REF.dt), r = ref.exact[k], v = m.exact[i];
      if (r === null && v === null) { pairs++; return; }   // both off the grid's cap: the same, and counted
      if (Number.isFinite(r) && Number.isFinite(v)) { worst = Math.max(worst, Math.abs(r - v)); pairs++; }
    });
    check("schedule", `${s.id}: the page's worker returns the reference bound at every time it plots (within 1e-6)`, ok && pairs === m.t.length && worst < 1e-6,
      ok ? `largest difference ${worst.toExponential(2)}, ${pairs} of ${m.t.length} times compared` : "no valid reply");
  }
  for (const at of [0.45, 1, 0.8]) {
    const m = await ask({ id: "deadline", params: { at, c: 0.1 } });
    const last = m.t[m.t.length - 1];
    check("schedule", `a deadline at ${at}: the worker's last point is the forced choice, at the deadline, with both bounds 0`,
      Math.abs(last - at) < 1e-9 && m.exact[m.exact.length - 1] === 0 && m.pm[m.pm.length - 1] === 0, `last point ${last}, bounds ${m.exact[m.exact.length - 1]} and ${m.pm[m.pm.length - 1]}`);
  }
}

// ---- below the grid's first step: the paper's code reports 0; the page follows its own Bellman step ---------------
{
  const c = 3.2, { bounds } = exactPolicy(() => c, 2, REF.dt, REF.h, REF.cap);
  const cont = Math.max(0, (await import("../../book/assets/js/model.js")).boundForCost(c) - 0.5826 * Math.sqrt(REF.dt));
  const b = bounds[50];
  check("schedule", `at a constant cost of ${c}, where the paper's code reports 0, the page places the bound between the center and the grid's first step (${REF.h}), since its program waits at the center`,
    b > 0 && b < REF.h && cont < REF.h, `page ${b.toFixed(5)}, shifted constant-cost bound ${cont.toFixed(5)}`);
  check("schedule", "the eleven schedules at their starting settings never reach a bound below the grid's first step (so every cell was compared to 1e-6; the cost-3.2 case above shows the rule)", subStep === 0, `${subStep} such cells`);
}
