// Chapter 10's worker: the dynamic program and the held-out test's rules, off the page's thread (ch10-model.js).
//   { job: "yours", choice }   -> the reader's schedule: the program and all seven rules, scored, with their curves
//   { job: "paper", f, p }     -> one of the paper's schedules: the program and the per-moment and weighted rules
//   { job: "scaling" }         -> Table 9's shape at each amplitude, and the constant cost, on the page's grid
import { runRules, familyCost, familyDeadline, scalingLosses, SCALING } from "./ch10-model.js?v=50386feefc";
import { costOf, deadlineOf } from "./schedules-book.js?v=50386feefc";

self.onmessage = (e) => {
  const m = e.data;
  const progress = (p) => self.postMessage({ id: m.id, progress: p });
  try {
    if (m.job === "yours") {
      self.postMessage({ id: m.id, ok: true, ...runRules(costOf(m.choice), deadlineOf(m.choice), { progress }) });
      return;
    }
    if (m.job === "paper") {
      const r = runRules(familyCost(m.f, m.p), familyDeadline(m.f, m.p), { rules: ["per_moment", "weighted"], progress });
      self.postMessage({ id: m.id, ok: true, ...r });
      return;
    }
    if (m.job === "scaling") {
      const amps = [0, ...SCALING.amps], rows = [];
      amps.forEach((a, i) => { rows.push({ a, ...scalingLosses(a) }); progress((i + 1) / amps.length); });
      self.postMessage({ id: m.id, ok: true, rows });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
