// Chapter 5's worker: the dynamic program and the sweep for E_y[c(t + tau*)] (ch05-model.js), off the page's thread.
//   { job: "fixed" }  the paper's test schedule (0.1 rising to 0.4 at time 1.5) on a grid of dt 0.005 and h 0.01, run
//                     to a forced choice at time 8: the bound and V(t, y) at y = 0, 0.25, 0.5 at every step, the
//                     left side every step to time 3, and V(t, .) and u(t, .) every 0.05 from 0 to 3
//   { job: "schedule", choice, dt, h, horizon }  the reader's schedule: the bound, the left side and its per-moment
//                     version every 0.01 time units to the horizon, and u(t, .) every 0.05 over the window 0 to 2.5
import { solveSchedule, costRange, testStep, FIXED } from "./ch05-model.js";
import { costOf, VIEW } from "./schedules-book.js";

self.onmessage = (e) => {
  const m = e.data;
  try {
    const progress = (p) => self.postMessage({ id: m.id, progress: p });
    if (m.job === "fixed") {
      const snaps = Array.from({ length: 61 }, (_, i) => i * 0.05);
      const out = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt, h: FIXED.h, cMin: 0.1, every: 1, lhsUpto: 3,
        ys: FIXED.ys, snaps, snapTo: 2, onProgress: progress });
      self.postMessage({ id: m.id, ok: true, ...out });
      return;
    }
    if (m.job === "schedule") {
      const cost = costOf(m.choice);
      const range = costRange(cost, m.horizon);
      const every = Math.max(1, Math.round(0.01 / m.dt));
      const snaps = Array.from({ length: Math.round(VIEW / 0.05) + 1 }, (_, i) => i * 0.05);
      const out = solveSchedule(cost, m.horizon, { dt: m.dt, h: m.h, cMin: range.lo, every, lhsUpto: m.horizon,
        snaps, snapTo: 12, onProgress: progress });
      for (const s of out.snaps) { s.V = null; const n = Math.min(s.u.length, Math.ceil((s.b + out.shift) / m.h) + 3); s.u = s.u.slice(0, n); s.x = s.x.slice(0, n); }
      self.postMessage({ id: m.id, ok: true, ...out, cMin: range.lo, cMax: range.hi });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
