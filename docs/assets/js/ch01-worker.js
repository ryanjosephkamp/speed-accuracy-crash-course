// Chapter 1's worker: the dynamic program and the two rules for a schedule, off the page's thread.
//   { job: "three", choice } -> the best bound, the per-moment rule, and the weighted look-ahead (ch01-model.js)
import { threeRules } from "./ch01-model.js?v=50386feefc";
import { costOf, deadlineOf } from "./schedules-book.js?v=50386feefc";

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.job === "three") {
      const r = threeRules(costOf(m.choice), deadlineOf(m.choice), { progress: (p) => self.postMessage({ id: m.id, progress: p }) });
      self.postMessage({ id: m.id, ok: true, ...r });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
