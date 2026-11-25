// Chapter 4's worker: the dynamic program with its values kept, and decisions sampled against its bound, off the
// page's thread. Jobs (answers are { id, ok, ... }):
//   { job: "values", spec, keep }                      -> the bound at every check, and V at the steps kept
//   { job: "decide", spec, t0, y0, n, seed, keepPaths } -> n decision times from (t0, y0), and the first paths
//   { job: "cap", spec, t0, y0, n, seed, track, keepPaths } -> decisions with the cap sigma, and the means of the
//                                                         value process and the gain stopped at the decision
// A spec is { kind: "choice", choice } (the reader's saved schedule), { kind: "const", c }, or { kind: "step", ... }.
import { program, costFrom, extremes, decisions, valueAt } from "./ch04-model.js?v=0487a934ff";
import { rng } from "./kernel.js?v=0487a934ff";
import { deadlineOf, VIEW, SPARE } from "./schedules-book.js?v=0487a934ff";

const horizonOf = (spec) => (spec.kind === "choice" ? deadlineOf(spec.choice) : null) ?? VIEW + SPARE;
const kept = new Map(); // one program with every value kept, per schedule (the last few)
function full(spec) {
  const key = JSON.stringify(spec);
  if (!kept.has(key)) {
    if (kept.size >= 3) kept.delete(kept.keys().next().value);
    kept.set(key, program(costFrom(spec), horizonOf(spec), { keep: "all" }));
  }
  return kept.get(key);
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    const spec = m.spec, cost = costFrom(spec), horizon = horizonOf(spec);
    if (m.job === "values") {
      const P = program(cost, horizon, { keep: m.keep ?? "none" });
      self.postMessage({ id: m.id, ok: true, dt: P.dt, h: P.h, m: P.m, steps: P.steps, bounds: P.bounds, V: P.V, slot: P.slot,
        deadline: spec.kind === "choice" ? deadlineOf(spec.choice) : null }, [P.bounds.buffer, P.V.buffer, P.slot.buffer]);
      return;
    }
    if (m.job === "decide") {
      const P = full(spec), k0 = Math.round(m.t0 / P.dt);
      const D = decisions(P, k0, m.y0, m.n, rng(m.seed), { keepPaths: m.keepPaths ?? 16 });
      const bounds = Float64Array.from(P.bounds);
      self.postMessage({ id: m.id, ok: true, dt: P.dt, k0, bounds, tau: D.tau, paths: D.paths }, [bounds.buffer, D.tau.buffer]);
      return;
    }
    if (m.job === "cap") {
      const P = full(spec), k0 = Math.round(m.t0 / P.dt);
      const ext = extremes(cost);
      const capP = program(() => ext.lo, horizon);
      const D = decisions(P, k0, m.y0, m.n, rng(m.seed), { cap: capP.bounds, track: m.track, cost: (t) => cost(t), keepPaths: m.keepPaths ?? 8 });
      const bounds = Float64Array.from(P.bounds);
      self.postMessage({ id: m.id, ok: true, dt: P.dt, k0, bounds, cap: capP.bounds, lo: ext.lo, hi: ext.hi, tLo: ext.tLo, tHi: ext.tHi,
        V0: valueAt(P, k0, m.y0), tau: D.tau, sigma: D.sigma, paths: D.paths, meanM: D.meanM, meanG: D.meanG, seM: D.seM, seG: D.seG },
      [bounds.buffer, capP.bounds.buffer, D.tau.buffer, D.sigma.buffer]);
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
