// Chapter 8's worker: the dynamic program and the rules for the reader's schedule, more updates, the map whose
// crossings are the rule's solutions, and Proposition 13's small change, off the page's thread.
//   { job: "rules", choice, add }   -> the program, the three rules, every update, and the losses (ch08-rule.js)
//   { job: "more", choice }         -> how far 300 updates move the bound from the 30th
//   { job: "roots", choice | null, t } -> the map T(b; t) over levels, its crossings, and the iteration's end
//   { job: "prop13" }               -> the small change of Proposition 13 at each size
import { compareRules, scheduleFor, moreUpdates, rootsAt, spikeCost, prop13, P13 } from "./ch08-rule.js";

self.onmessage = (e) => {
  const m = e.data;
  const progress = (p) => self.postMessage({ id: m.id, progress: p });
  try {
    if (m.job === "rules") {
      const { cost, deadline, own } = scheduleFor(m.choice, m.add ?? null);
      self.postMessage({ id: m.id, ok: true, own, ...compareRules(cost, deadline, { progress }) });
      return;
    }
    if (m.job === "more") {
      const { cost, deadline } = scheduleFor(m.choice, null);
      self.postMessage({ id: m.id, ok: true, ...moreUpdates(cost, deadline) });
      return;
    }
    if (m.job === "roots") {
      const { cost, deadline, breaks } = m.choice ? scheduleFor(m.choice, null) : { cost: spikeCost, deadline: null, breaks: [] };
      self.postMessage({ id: m.id, ok: true, t: m.t, ...rootsAt(cost, m.t, 160, deadline, breaks) });
      return;
    }
    if (m.job === "prop13") {
      const runs = P13.EPS.map((eps, k) => { const r = prop13(eps); progress((k + 1) / P13.EPS.length); return r; });
      self.postMessage({ id: m.id, ok: true, runs });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
