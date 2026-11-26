// Chapter 3's worker: the dynamic program for the reader's schedule, keeping the value V(t, y), off the page's thread.
//   { job: "value", choice, last: "far" | "window", dt, h }
//     the best policy with the choice forced 6 time units past the window ("far", standing in for no last moment),
//     at the window's end, time 2.5 ("window"), or at a deadline; V(t, y) every 0.05 time units over the window for
//     y from 0 to 3.2 every 0.04, with the bound at each of those rows; the bound and the per-moment bound every 0.02
//     to plot, always ending on the window's end or a deadline's forced choice (with the last check before a deadline
//     kept, so the drop starts from it); and V(0, 0)
//   { job: "flat", choice, dt, h }
//     the best flat bound on the same grid and horizon as "far" (or to a deadline), scored as the program's policy is,
//     beside the continuous best and the earn plate's curve of averages: a like-for-like comparison of a bound held flat
//     with the best time-dependent policy, and the plate's heavier sums off the page's thread
// Both answer through valueJob and flatJob, which tools/checks/ch03.mjs also runs.
import { valueSurface, bestFlat, bestFlatOnGrid, flatOnSchedule } from "./ch03-model.js?v=d73958033e";
import { boundForCost, toDiscrete } from "./model.js?v=d73958033e";
import { costOf, deadlineOf, VIEW, SPARE } from "./schedules-book.js?v=d73958033e";

export function valueJob(m, progress = null) {
  const dt = m.dt ?? 0.01, h = m.h ?? 0.02;
  const cost = costOf(m.choice), dl = deadlineOf(m.choice);
  const horizon = dl ?? (m.last === "window" ? VIEW : VIEW + SPARE);
  const view = Math.min(dl ?? VIEW, VIEW);
  const out = valueSurface(cost, horizon, { dt, h, view, every: Math.round(0.05 / dt), yTop: 3.2, ystep: Math.max(1, Math.round(0.04 / h)), onProgress: progress });
  const every = Math.max(1, Math.round(0.02 / dt)), kEnd = Math.round(view / dt);
  const t = [], b = [], pm = [];
  const push = (k) => {
    const tk = k * dt;
    t.push(tk);
    b.push(Number.isFinite(out.bounds[k]) ? out.bounds[k] : null);
    pm.push(dl !== null && tk >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(tk)), dt));
  };
  // at a deadline in view, the last check before it is always kept, so the drop is drawn from that check's bound
  const atDeadline = dl !== null && dl <= VIEW + 1e-9 && kEnd >= 1;
  for (let k = 0; k < (atDeadline ? kEnd - 1 : kEnd + 1); k += every) push(k);
  if (atDeadline) push(kEnd - 1);
  if (Math.round(t[t.length - 1] / dt) !== kEnd) push(kEnd);
  return { horizon, view, deadline: dl, dt, h, ys: Array.from(out.ys), gy: Array.from(out.gy), times: out.times,
    V: out.V.map((r) => Array.from(r)), rowB: out.rowBounds.map((v) => (Number.isFinite(v) ? v : null)), t, b, pm, v00: out.v00, shift: out.shift };
}

export function flatJob(m) {
  const dt = m.dt ?? 0.01, h = m.h ?? 0.02;
  const cost = costOf(m.choice), dl = deadlineOf(m.choice), horizon = dl ?? VIEW + SPARE;
  const cont = bestFlat(cost, dl);
  const grid = bestFlatOnGrid(cost, horizon, { dt, h, near: toDiscrete(cont.b, dt) });
  // the earn plate's curve: the averages for 60 flat bounds from 0.05 to 3, checking the evidence continuously
  const bs = Array.from({ length: 60 }, (_, i) => 0.05 + (2.95 * i) / 59), os = bs.map((v) => flatOnSchedule(cost, v, dl));
  const curve = { b: bs, reward: os.map((o) => o.reward), bill: os.map((o) => o.bill), net: os.map((o) => o.net) };
  return { horizon, b: cont.b, net: cont.net, reward: cont.reward, bill: cont.bill, gridX: grid.x, grid: grid.reward, shifted: grid.shifted, curve,
    search: { cap: grid.cap, scan: grid.scan, scores: grid.scores, refined: grid.refined } };
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.job === "value") { self.postMessage({ id: m.id, ok: true, ...valueJob(m, (p) => self.postMessage({ id: m.id, progress: p })) }); return; }
    if (m.job === "flat") { self.postMessage({ id: m.id, ok: true, ...flatJob(m) }); return; }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
