// Chapter 3's worker: the dynamic program for the reader's schedule, keeping the value V(t, y), off the page's thread.
//   { job: "value", choice, last: "far" | "window", dt, h }
//     the best policy with the choice forced 6 time units past the window ("far", standing in for no last moment),
//     at the window's end, time 2.5 ("window"), or at a deadline; V(t, y) every 0.05 time units over the window for
//     y from 0 to 3.2 every 0.04, the bound every 0.02, and V(0, 0); with no last moment or a deadline, also the best
//     flat bound scored on the same grid, to compare with V(0, 0) like for like
import { valueSurface, bestFlat } from "./ch03-model.js?v=37a0cf8296";
import { boundForCost, toDiscrete, score } from "./model.js?v=37a0cf8296";
import { costOf, deadlineOf, VIEW, SPARE } from "./schedules-book.js?v=37a0cf8296";

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.job !== "value") throw new Error("unknown job " + m.job);
    const dt = m.dt ?? 0.01, h = m.h ?? 0.02;
    const cost = costOf(m.choice), dl = deadlineOf(m.choice);
    const horizon = dl ?? (m.last === "window" ? VIEW : VIEW + SPARE);
    const view = Math.min(dl ?? VIEW, VIEW);
    const out = valueSurface(cost, horizon, { dt, h, view, every: Math.round(0.05 / dt), yTop: 3.2, ystep: Math.max(1, Math.round(0.04 / h)),
      onProgress: (p) => self.postMessage({ id: m.id, progress: p }) });
    const every = Math.max(1, Math.round(0.02 / dt));
    const t = [], b = [], pm = [];
    for (let k = 0; k * dt <= view + 1e-9; k += every) {
      const tk = k * dt;
      t.push(tk);
      b.push(Number.isFinite(out.bounds[k]) ? out.bounds[k] : null);
      pm.push(dl !== null && tk >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(tk)), dt));
    }
    // the best flat bound (continuous monitoring), scored on the program's own grid, for a fair comparison with V(0, 0)
    let flat = null;
    if (m.last !== "window" || dl !== null) {
      const best = bestFlat(cost, dl), steps = Math.round(horizon / dt);
      const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
      const xb = Float64Array.from(ts, () => toDiscrete(best.b, dt));
      flat = { b: best.b, net: best.net, grid: score(xb, ts, cost, h).reward };
    }
    self.postMessage({ id: m.id, ok: true, horizon, view, deadline: dl, dt, h, ys: Array.from(out.ys), gy: Array.from(out.gy),
      times: out.times, V: out.V.map((r) => Array.from(r)), t, b, pm, v00: out.v00, shift: out.shift, flat });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
