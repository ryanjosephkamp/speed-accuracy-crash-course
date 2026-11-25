// Chapter 6's "Your schedule, scaled down": the errors the plate draws, from the scale job's programs, shared by the
// page and its check so both compute the same thing.
import * as K from "./kernel.js?v=850f062e96";

/** From the scale job's reply m (times t, the constant-cost bound b0, a run per size), with the cost and its middle
 * c0: the largest error over the window of the per-moment bound (the full B(c0 + eps gamma)) and of the first-order
 * bound (b0 + eps beta), each measured from the program's own constant-cost bound. */
export function yoursErrors(m, cost, c0, EPS) {
  const t = m.t, gamma = (x) => cost(x) - c0;
  const beta = Array.from(K.firstOrder(gamma, t, c0)), b0c = K.B(c0);
  const ePm = m.runs.map((r, k) => Math.max(...t.map((x, i) => Math.abs((r[i] - m.b0[i]) - (K.B(c0 + EPS[k] * gamma(x)) - b0c)))));
  const eFo = m.runs.map((r, k) => Math.max(...t.map((x, i) => Math.abs((r[i] - m.b0[i]) - EPS[k] * beta[i]))));
  return { beta, ePm, eFo };
}

/** The bottom chart's log range, always ordered; null when every error is too small for this grid to show. */
export function errorRange(ePm, eFo, tiny = 1e-7) {
  const vals = [...ePm, ...eFo].filter((v) => v > 0 && Number.isFinite(v));
  if (!vals.length || Math.max(...vals) < tiny) return null;
  return [Math.min(...vals) / 3, Math.max(...vals) * 3];
}
