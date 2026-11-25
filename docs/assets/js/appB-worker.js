// Appendix B's worker: the two reference programs at a constant cost, off the page's thread (appB-model.js). Jobs:
//   { job: "horizon", c } -> the evidence grid's bound against the time left, with the choice forced at LONG, and how
//                            far back the forced choice reaches (at 0.001 and 0.01)
//   { job: "bins", c }    -> the belief grid's bound with LONG time units left for each number of bins in BINS (with
//                            progress), beside the evidence grid's bound with LONG time units left and B(c)
import * as M from "./appB-model.js?v=355988b29e";

const RUNS = new Map();
const horizon = (c) => { if (!RUNS.has(c)) RUNS.set(c, M.horizonRun(c)); return RUNS.get(c); };

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.job === "horizon") {
      const r = horizon(m.c);
      self.postMessage({ id: m.id, ok: true, bTg: r.bTg, dt: r.dt, long: r.long, reach: M.EPS.map((eps) => M.reach(r, eps)) });
      return;
    }
    if (m.job === "bins") {
      const out = [];
      for (const n of M.BINS) {
        const v = M.beliefBackward(m.c, n);
        out.push({ n, gb: v.gb, xb: v.xb, gap: M.binGap(v.x, v.xb), x: v.x });
        self.postMessage({ id: m.id, progress: out.length / (M.BINS.length + 1) });
      }
      const r = horizon(m.c);
      self.postMessage({ id: m.id, ok: true, rows: out, xe: r.bTg[r.bTg.length - 1], B: M.boundForCost(m.c), long: r.long });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
