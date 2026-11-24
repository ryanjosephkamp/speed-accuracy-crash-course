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
import { check, ROOT } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/paper-code.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
check("schedule", "the reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit,
  `paper-code.json from ${REF.tag} (${REF.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);

const worst = (a, b) => a.reduce((m, v, i) => {
  const r = b[i];
  if ((v === null || !Number.isFinite(v)) && (r === null || !Number.isFinite(r))) return m;
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
  const dEx = worst(mine, ref.exact);
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
  let reply = null;
  globalThis.self = { postMessage: (m) => { if (m.ok !== undefined) reply = m; } };
  await import("../../book/assets/js/dp-worker.js");
  const ask = (choice) => { reply = null; globalThis.self.onmessage({ data: { job: "bounds", choice, id: 1 } }); return reply; };
  for (const choice of CHOICES) {
    const s = spec(choice), ref = REF.schedules[s.id], m = ask(choice);
    let worst = 0;
    m.t.forEach((t, i) => { const k = Math.round(t / REF.dt), r = ref.exact[k], v = m.exact[i];
      if (Number.isFinite(r) && r !== null && Number.isFinite(v)) worst = Math.max(worst, Math.abs(r - v)); });
    check("schedule", `${s.id}: the page's worker returns the reference bound at every time it plots (within 1e-6)`, worst < 1e-6, `largest difference ${worst.toExponential(2)} over ${m.t.length} times`);
  }
  for (const at of [0.45, 1, 0.8]) {
    const m = ask({ id: "deadline", params: { at, c: 0.1 } });
    const last = m.t[m.t.length - 1];
    check("schedule", `a deadline at ${at}: the worker's last point is the forced choice, at the deadline, with bound 0`, Math.abs(last - at) < 1e-9 && m.exact[m.exact.length - 1] === 0, `last point ${last}, bound ${m.exact[m.exact.length - 1]}`);
  }
}

// ---- a known limit of the method, the same in the paper's code: a bound below the grid's first step reads as 0 ----
{
  const c = 3.2, { bounds } = exactPolicy(() => c, 2, REF.dt, REF.h, REF.cap);
  const cont = Math.max(0, (await import("../../book/assets/js/model.js")).boundForCost(c) - 0.5826 * Math.sqrt(REF.dt));
  check("schedule", `at a constant cost of ${c}, the bound (about ${cont.toFixed(4)}) is below the grid's first step (${REF.h}), and the program reports 0 there, as the paper's backward_induction_x does`,
    bounds[50] === 0 && cont < REF.h, `program ${bounds[50]}, shifted constant-cost bound ${cont.toFixed(4)}`);
}
