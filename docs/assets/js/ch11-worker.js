// Chapter 11's worker: the two dynamic programs, off the page's thread.
//   { job: "unknown", choice }     -> the program over beliefs and the three rules on that schedule (ch11-model.js)
//   { job: "sine", rm, omega }     -> the program with two bounds at a constant cost and with a sinusoid, and the fits
import { unknownRun, sineRun } from "./ch11-model.js?v=06afe54c9a";
import { costOf, deadlineOf, VIEW } from "./schedules-book.js?v=06afe54c9a";

self.onmessage = (e) => {
  const m = e.data;
  const progress = (p) => self.postMessage({ id: m.id, progress: p });
  try {
    if (m.job === "unknown") {
      const cost = costOf(m.choice), dl = deadlineOf(m.choice);
      self.postMessage({ id: m.id, ok: true, deadline: dl, ...unknownRun(cost, dl, dl ?? VIEW, { progress }) });
      return;
    }
    if (m.job === "sine") {
      self.postMessage({ id: m.id, ok: true, ...sineRun(m.rm, m.omega) });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
