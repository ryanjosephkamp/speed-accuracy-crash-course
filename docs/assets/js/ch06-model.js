// Chapter 6's two dynamic-program plates without their pages: what "Shrink the change" measures from the scale job's
// reply, and what "Your schedule, scaled down" does with each selection and reply, shared by the page and its check so
// both compute the same thing.
import * as K from "./kernel.js?v=e579ee3325";
import { costOf, deadlineOf, VIEW } from "./schedules-book.js?v=e579ee3325";
import { line, frame, axes, ticks } from "./chart.js?v=e579ee3325";
import { guideInRange, errorsVerdict, tooSmallVerdict } from "./say-ch06.js?v=e579ee3325";
import { isFlat } from "./ch01-model.js?v=e579ee3325";

// ---- "Shrink the change": a fixed sinusoid ----------------------------------------------------------------------

/** The fixed sinusoid's plate: its job for the worker (cost c0 (1 + eps sin(omega t)) at four sizes eps, every 0.02
 * to time 4) and the window over which it measures its gaps. */
export const SCALE = { c0: 0.1, amp: 0.1, omega: 2, eps: [0.8, 0.4, 0.2, 0.1], view: 4, lo: 0.5, hi: 3.5 };
export const scaleJob = () => ({ job: "scale", wave: { amp: SCALE.amp, omega: SCALE.omega }, c0: SCALE.c0, eps: SCALE.eps, view: SCALE.view });

/** From the scale job's reply m: each size's bound move divided by its eps, the first-order and per-moment responses
 * at the reply's times, the indices of the times from lo to hi, and each size's largest gap there to each response. */
export function scaleGaps(m, { c0, amp, omega, eps, lo, hi } = SCALE) {
  const t = m.t, gamma = (x) => amp * Math.sin(omega * x);
  const dev = m.runs.map((r, k) => r.map((v, i) => (v - m.b0[i]) / eps[k]));
  const beta = Array.from(K.firstOrder(gamma, t, c0)), pmr = Array.from(K.perMomentResponse(gamma, t, c0));
  const win = t.map((x, i) => (x >= lo && x <= hi ? i : -1)).filter((i) => i >= 0);
  const gap = (d, ref) => Math.max(...win.map((i) => Math.abs(d[i] - ref[i])));
  return { t, dev, beta, pmr, win, gFo: dev.map((d) => gap(d, beta)), gPm: dev.map((d) => gap(d, pmr)) };
}

// ---- "Your schedule, scaled down" ---------------------------------------------------------------------------------

export const YOURS_EPS = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];

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

/** The bottom chart's log range, always ordered; null when every error is below `tiny`. The test is on the largest
 * error of the whole comparison: once one error reaches `tiny`, the chart opens and plots every positive error, smaller
 * ones included. */
export function errorRange(ePm, eFo, tiny = 1e-7) {
  const vals = [...ePm, ...eFo].filter((v) => v > 0 && Number.isFinite(v));
  if (!vals.length || Math.max(...vals) < tiny) return null;
  return [Math.min(...vals) / 3, Math.max(...vals) * 3];
}

/** What the plate does with a selection: "deadline", and "constant" for a cost that is constant by value to 6 past the
 * window (chapter 1's test: a drawing with equal knots, or a preset whose cost every 0.01 is one number: Constant,
 * Smooth at size 0), skip the solve; "measure" (the rising cost, outside the theorem) and "theory" solve it, however
 * little the cost moves. c0 is the cost's average over the window, from 501 times. */
export function yoursMode(choice) {
  if (deadlineOf(choice) !== null) return { mode: "deadline", cost: null, c0: NaN };
  const cost = costOf(choice);
  const ts = Array.from({ length: 501 }, (_, i) => (i * VIEW) / 500);
  const c0 = ts.reduce((a, t) => a + cost(t), 0) / ts.length;
  if (isFlat(choice, VIEW + 6)) return { mode: "constant", cost, c0 };
  return { mode: choice.id === "rising" ? "measure" : "theory", cost, c0 };
}

/** The plate's state across selections and replies, with no DOM: select(choice) starts a selection and returns its
 * number and the job for the worker (null when the plate skips it); take(my, m) keeps reply m only if it answers the
 * latest selection; show() reveals the bottom chart (it stays revealed across selections); bottom() says what that
 * chart shows: hidden until there is data and it is revealed, and hidden with the largest error when every error is
 * below the chart's threshold. */
export function yoursPlateState() {
  let gen = 0;
  const st = { mode: null, cost: null, c0: NaN, data: null, reveal: false };
  return {
    state: st,
    select(choice) {
      const my = ++gen, m = yoursMode(choice);
      Object.assign(st, { mode: m.mode, cost: m.cost, c0: m.c0, data: null });
      const job = m.mode === "deadline" || m.mode === "constant" ? null : { job: "scale", choice, c0: m.c0, eps: YOURS_EPS, view: VIEW };
      return { my, job };
    },
    current: (my) => my === gen,
    take(my, m) {
      if (my !== gen) return false;
      const { cost, c0 } = st, gamma = (x) => cost(x) - c0;
      const { beta, ePm, eFo } = yoursErrors(m, cost, c0, YOURS_EPS);
      const pmr = Array.from(K.perMomentResponse(gamma, m.t, c0));
      const dev = m.runs.map((r, k) => r.map((v, i) => (v - m.b0[i]) / YOURS_EPS[k]));
      st.data = { t: m.t, dev, beta, pmr, ePm, eFo, c0, outside: st.mode === "measure" };
      return true;
    },
    show() { st.reveal = true; },
    bottom() {
      if (!st.data || !st.reveal) return { hidden: true, range: null, largest: NaN };
      const { ePm, eFo } = st.data, range = errorRange(ePm, eFo);
      return { hidden: !range, range, largest: Math.max(...ePm, ...eFo) };
    },
  };
}

/** The bottom chart's marks in a frame f (log axes, eps from the smallest size to 1.3): guide lines of slope 1 and 2
 * through the per-moment error at the largest size, each clipped to the plot so its slope stays true and labeled at
 * its own left end (no label when no part of it is inside), then the two errors. */
export function errorMarks(f, EPS, ePm, eFo) {
  const [yLo, yHi] = f.y, e0 = EPS[0], y0 = ePm[0] || yHi / 3;
  let g = "";
  for (const [ya, p, below] of [[y0, 1, false], [y0 / 3, 2, true]]) {
    const seg = guideInRange(e0, ya, p, EPS[EPS.length - 1], e0, yLo, yHi);
    if (!seg) continue;
    g += line(f, seg[0], seg[1], "guide");
    const x = Math.min(f.sx(seg[0][0]) + 4, f.W - f.r - 44), y = f.sy(seg[1][0]) + (below ? 14 : -6);
    g += `<text class="tk" x="${x.toFixed(1)}" y="${Math.max(f.t + 10, Math.min(f.H - f.b - 4, y)).toFixed(1)}">slope ${p}</text>`;
  }
  g += line(f, EPS, ePm, "pm") + line(f, EPS, eFo, "wb");
  g += EPS.map((e, k) => (eFo[k] > 0 ? `<circle class="wb-dot" cx="${f.sx(e).toFixed(1)}" cy="${f.sy(eFo[k]).toFixed(1)}" r="3"/>` : "")).join("");
  return g;
}

/** The verdict the page prints once the errors are revealed, from bottom() and the data: with the chart shown, the
 * measured comparison, the theory's answer, and the grade of the guesses; with it hidden below its threshold, the grade
 * and the theory's answer all the same, then the largest error. */
export const yoursVerdict = (b, data, guess) => (b.hidden ? tooSmallVerdict(b.largest, guess, data.outside) : errorsVerdict(guess, data.ePm, data.eFo, YOURS_EPS, data.outside));

/** What the prediction box shows for a plate mode: nothing for a skipped selection (a deadline, or a cost that doesn't
 * change), only its prompt and button for the rising cost (outside the theorem), and the two theory questions for any
 * other schedule, however little it moves. */
export const predictView = (mode) => ({
  box: mode !== "deadline" && mode !== "constant",
  questions: mode === "theory",
  prompt: mode === "measure" ? "The rising cost is outside the theorem: show how the two errors compare." : "As ε shrinks, how fast does the theory say each shortcut's error shrinks?",
});

/** The top chart for size index sel, in a frame for el (data from take()): its vertical range pads the plotted values by
 * 12% of their span (of their size when the span is 0, and 1e-6 when every value is 0), so a response of any size fills
 * the chart, and its tick labels carry enough digits to tell neighboring ticks apart (powers of ten below a thousandth). */
export function responseChart(el, data, sel) {
  const { t, dev, beta, pmr } = data;
  const vals = [...beta, ...pmr, ...dev[sel]].filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo;
  const pad = span > 0 ? 0.12 * span : hi !== 0 ? 0.12 * Math.abs(hi) : 1e-6;
  const f = frame(el, { x: [0, VIEW], y: [lo - pad, hi + pad], aspect: 0.5, minH: 190, maxH: 300 });
  // ticks are chosen on the range scaled to order 1 (chart.js's ticks round to 10 decimals), then scaled back
  const mag = (x) => Math.floor(Math.log10(x) + 1e-9), u = 10 ** mag(hi - lo + 2 * pad);
  const yt = ticks((lo - pad) / u, (hi + pad) / u, 4).map((v) => v * u), step = yt.length > 1 ? yt[1] - yt[0] : 2 * pad;
  const extra = Math.abs(step / 10 ** mag(step) - 2.5) < 1e-6 ? 1 : 0;
  const fy = (v) => (Math.abs(v) < step * 1e-6 ? "0" : Math.abs(v) >= 1e-3 ? String(+v.toFixed(Math.min(20, Math.max(3, extra - mag(step)))))
    : v.toExponential(Math.min(20, Math.max(0, mag(Math.abs(v)) - mag(step) + extra))));
  let g = axes(f, { yl: "(b − b₀) ÷ ε", xl: "time", grid: true, zero: true, yt, fy });
  g += line(f, t, pmr, "pm") + line(f, t, beta, "wb") + line(f, t, dev[sel], "ex");
  return { f, g };
}
