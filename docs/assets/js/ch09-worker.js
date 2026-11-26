// Chapter 9's worker: the dynamic program and the scorer for the reader's schedule, and the paper's two tests of the
// first-order theory on this page's grid, off the page's thread (ch09-model.js). A schedule arrives as the saved
// choice ({ id, params } or { id: "draw", points }) and is rebuilt here from the module the page uses. Jobs:
//   { job: "backward", choice }  -> the bound at every step to the horizon, and what waiting adds at every other step
//   { job: "floor" }             -> the forced choice's cost at a constant cost of 0.02, with the choice forced at 10
//   { job: "density", choice, only, fine } -> the best bound, the per-moment and weighted rules (moved in for checking
//                                   every 0.01; only some, if asked), and for each, the density pushed forward with the
//                                   mass decided at each step; with fine, the best bound's score on a finer grid too
//   { job: "coef", choice }      -> the program checked every 0.01 and every 0.0025, and the coefficient between them
//   { job: "shift", choice }     -> the two rules' losses with and without the shift
//   { job: "fit" }               -> the sinusoid test at Table 1's five frequencies, with progress
//   { job: "sweep", c0, om }     -> the sweep's four sizes at one cost and frequency, with progress
//   { job: "refine", choice }    -> the two rules' losses on this page's three grids, with progress
import { costOf, deadlineOf } from "./schedules-book.js?v=d73958033e";
import { exactPolicy, perMoment, weightedBound, toDiscrete, score } from "./model.js?v=d73958033e";
import * as M from "./ch09-model.js?v=d73958033e";

const horizonOf = (choice) => deadlineOf(choice) ?? M.WINDOW + M.SPARE;

self.onmessage = (e) => {
  const m = e.data;
  const say = (out) => self.postMessage({ id: m.id, ok: true, ...out });
  const progress = (p) => self.postMessage({ id: m.id, progress: p });
  try {
    if (m.job === "backward") {
      const cost = costOf(m.choice), dl = deadlineOf(m.choice), horizon = horizonOf(m.choice);
      const r = M.backward(cost, horizon);
      say({ ts: r.ts, bounds: r.bounds, keepK: r.keepK, M: r.M, adv: r.adv, h: r.h, dt: r.dt, v0: r.v0, horizon, deadline: dl });
      return;
    }
    if (m.job === "floor") { say(M.horizonFloor(0.02)); return; }
    if (m.job === "density") {
      const cost = costOf(m.choice), dl = deadlineOf(m.choice), horizon = horizonOf(m.choice);
      const view = dl ?? M.WINDOW;
      const { ts, bounds } = exactPolicy(cost, horizon, M.DT, M.H, M.CAP);
      const T = Array.from(ts);
      const want = m.only || ["best", "pm", "wb"];
      const pol = { best: Array.from(bounds, (v) => (Number.isFinite(v) ? v : M.CAP)) };
      if (want.includes("pm")) pol.pm = Array.from(perMoment(cost, T), (v) => toDiscrete(v, M.DT));
      if (want.includes("wb")) pol.wb = Array.from(weightedBound(cost, T), (v) => toDiscrete(v, M.DT));
      const kView = Math.round(view / M.DT);
      const out = {};
      for (const [k, b] of Object.entries(pol)) {
        const f = M.forward(b, T, cost, { every: 2, upto: kView });
        out[k] = { bound: b, p: f.p, rt: f.rt, paid: f.paid, reward: f.reward, upAt: f.upAt, loAt: f.loAt, aliveAt: f.aliveAt,
          endUp: f.endUp, endLo: f.endLo, snapK: f.snapK, snaps: f.snaps, M: f.M, h: f.h, atOnce: f.atOnce };
      }
      // the best bound scored again on a finer evidence grid, for the trials, whose evidence is continuous
      if (m.fine) out.best.fineReward = score(pol.best, T, cost, M.FINE_H, M.CAP).reward;
      say({ ts: T, view, horizon, deadline: dl, policies: out });
      return;
    }
    if (m.job === "coef") { say(M.shiftCoef(costOf(m.choice), horizonOf(m.choice))); return; }
    if (m.job === "shift") { say(M.ruleLosses(costOf(m.choice), horizonOf(m.choice), { view: deadlineOf(m.choice) ?? M.WINDOW })); return; }
    if (m.job === "fit") {
      const rows = [];
      for (const row of M.TABLE1) { rows.push(M.sinusoidTest(row[0])); progress(rows.length / M.TABLE1.length); }
      say({ rows });
      return;
    }
    if (m.job === "sweep") { say({ c0: m.c0, om: m.om, rows: M.sweepTest(m.c0, m.om, M.SWEEP.rels, { progress }) }); return; }
    if (m.job === "refine") { say({ rows: M.refine(costOf(m.choice), horizonOf(m.choice), M.PAGE_GRIDS, { progress }) }); return; }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
