// Chapter 7's worker: the losses on the reader's schedule, off the page's thread. A schedule arrives as the saved
// choice ({ id, params } or { id: "draw", points }) and is rebuilt here from the module the page uses.
//   { job: "loss", choice, eps } -> lossRun's result (ch07-model.js), with progress messages
import { costOf } from "./schedules-book.js?v=89322951a3";
import { lossRun } from "./ch07-model.js?v=89322951a3";

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.job === "loss") {
      const out = lossRun(costOf(m.choice), m.eps, { progress: (p) => self.postMessage({ id: m.id, progress: p }) });
      self.postMessage({ id: m.id, ok: true, ...out });
      return;
    }
    throw new Error("unknown job " + m.job);
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
