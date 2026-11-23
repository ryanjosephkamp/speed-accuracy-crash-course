// The solver's worker: the dynamic program for a schedule, off the page's thread. A schedule arrives as the saved
// choice ({ id, params } or { id: "draw", points }) and is rebuilt here from the same module the page uses.
//   { job: "bounds", choice, dt, h }            -> the best bound and the per-moment bound over the window
//   { job: "scale", choice | wave, c0, eps, dt, h } -> bounds at c0 and at c0 + eps (c - c0) for each eps
import { exactPolicy, boundForCost, toDiscrete } from "./model.js?v=f6d032483b";
import { costOf, deadlineOf, VIEW, SPARE } from "./schedules-book.js?v=f6d032483b";

const EVERY = 2; // keep every second time step (0.02 time units) for the page

function thin(ts, arr, upto) {
  const t = [], v = [];
  for (let k = 0; k < ts.length && ts[k] <= upto + 1e-9; k += EVERY) { t.push(ts[k]); v.push(arr[k]); }
  return { t, v };
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    const dt = m.dt ?? 0.01, h = m.h ?? 0.02;
    if (m.job === "bounds") {
      const cost = costOf(m.choice);
      const dl = deadlineOf(m.choice);
      const horizon = dl ?? VIEW + SPARE;
      const view = dl ?? VIEW;
      const { ts, bounds } = exactPolicy(cost, horizon, dt, h);
      const ex = thin(ts, bounds, view);
      const pm = ex.t.map((t) => (dl !== null && t >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(t)), dt)));
      const c = ex.t.map((t) => cost(t));
      self.postMessage({ id: m.id, ok: true, t: ex.t, exact: ex.v, pm, cost: c, deadline: dl });
      return;
    }
    if (m.job === "scale") {
      const base = m.wave ? null : costOf(m.choice);
      const c0 = m.c0;
      const gamma = m.wave ? (t) => m.wave.amp * Math.sin(m.wave.omega * t) : (t) => base(t) - c0;
      const view = m.view ?? VIEW;
      const horizon = view + SPARE;
      const flat = exactPolicy(() => c0, horizon, dt, h);
      const b0 = thin(flat.ts, flat.bounds, view);
      const out = [];
      for (const eps of m.eps) {
        const run = exactPolicy((t) => c0 + eps * gamma(t), horizon, dt, h);
        out.push(thin(run.ts, run.bounds, view).v);
        self.postMessage({ id: m.id, progress: out.length / m.eps.length });
      }
      self.postMessage({ id: m.id, ok: true, t: b0.t, b0: b0.v, runs: out });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) });
  }
};
