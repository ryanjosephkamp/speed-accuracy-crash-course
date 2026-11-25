// Chapter 3's model, with no DOM: the reward and bill of a flat bound on any schedule (from the chance of still being
// undecided, kernel.js's series), one sampled path and its decision time for every bound at once, the closed forms of
// the constant-cost problem (the value of a flat bound, the reward g(b) - c b tanh b and its slope), the standing
// assumption checked on a schedule, and the dynamic program with its value V(t, y) kept on a grid. The page, the
// worker, and tools/checks/ch03.mjs all import it.
import { B, Bprime, survival, kappa, rng, OVERSHOOT } from "./kernel.js";
import { belief, grid } from "./model.js";
import { costOf, deadlineOf, paramsOf, DRAW_MIN, DRAW_MAX, VIEW } from "./schedules-book.js";

export { B, Bprime };
export const g = (y) => belief(y);
export const gPrime = (y) => 1 / (2 * Math.cosh(y) ** 2);
const sech2 = (y) => 1 / Math.cosh(y) ** 2;

// ---- the constant-cost problem in closed form -------------------------------------------------------------------

/** The mean decision time of a flat bound b, from evidence 0: b tanh b. */
export const meanTime = (b) => b * Math.tanh(b);
/** The reward of a flat bound at a constant cost: g(b) - c b tanh b. */
export const flatReward = (b, c) => g(b) - c * meanTime(b);
/** Its slope, g'(b) - c (tanh b + b sech^2 b). */
export const flatRewardSlope = (b, c) => gPrime(b) - c * (Math.tanh(b) + b * sech2(b));
/** The same slope written as sech^2 b [1/2 - c (b + sinh(2b)/2)]: the bracket is what smooth fit sets to zero. */
export const bracket = (b, c) => 0.5 - c * (b + 0.5 * Math.sinh(2 * b));
/** The value of waiting for the flat bound b at a constant cost: g(b) - c (b tanh b - y tanh y) below b, g(y) above. */
export const flatValue = (y, b, c) => (y < b ? g(b) - c * (meanTime(b) - meanTime(y)) : g(y));
/** Its slope below b: c (tanh y + y sech^2 y), so cosh^2 y V'(y) = c (y + sinh(2y)/2) whatever b is. */
export const flatValueSlope = (y, c) => c * (Math.tanh(y) + y * sech2(y));
/** The left side of the constant-cost equation, sinh(2b) + 2b, and its slope 2 cosh(2b) + 2 = 4 cosh^2 b. */
export const F = (b) => Math.sinh(2 * b) + 2 * b;
export const Fprime = (b) => 2 * Math.cosh(2 * b) + 2;

/** The maximum of a function on [lo, hi] by a grid of n points, then golden-section search around the best. */
export function argmax(f, lo, hi, n = 60, tol = 1e-9) {
  let best = lo, fb = -Infinity;
  for (let i = 0; i < n; i++) { const x = lo + ((hi - lo) * i) / (n - 1), v = f(x); if (v > fb) { fb = v; best = x; } }
  const step = (hi - lo) / (n - 1);
  let a = Math.max(lo, best - step), d = Math.min(hi, best + step);
  const r = (Math.sqrt(5) - 1) / 2;
  let b = d - r * (d - a), c = a + r * (d - a), fb2 = f(b), fc = f(c);
  while (d - a > tol) {
    if (fb2 > fc) { d = c; c = b; fc = fb2; b = d - r * (d - a); fb2 = f(b); }
    else { a = b; b = c; fb2 = fc; c = a + r * (d - a); fc = f(c); }
  }
  const x = 0.5 * (a + d);
  return { x, f: f(x) };
}

// ---- a flat bound on any schedule ----------------------------------------------------------------------------

/** The times the bill is integrated over, to a deadline or until the chance of still being undecided is below 1e-10
 * (its slowest term, from the series): every 0.01 to time 6 (finer than any step in the book's schedules), or every
 * b²/40 for a low bound, whose decisions take about b² time units; then every 0.02. */
function billTimes(b, deadline) {
  const k0 = kappa(0, b), lam = (1 + k0 * k0) / 2, a0 = (2 * k0 * Math.cosh(b)) / (b * (1 + k0 * k0));
  const far = Math.log(Math.max(a0, 1) / 1e-10) / lam;
  const end = deadline === null ? far : Math.min(deadline, far);
  const fine = Math.min(0.01, (b * b) / 40), n1 = Math.ceil(Math.min(end, 6) / fine);
  const out = [];
  for (let i = 0; i < n1; i++) out.push(Math.min(i * fine, end));
  if (end > 6) for (let s = 6; s < end - 1e-12; s += 0.02) out.push(s);
  out.push(end);
  return out;
}

/** P_0(tau_b > s) at s = 0 and after, from the series (1 at s = 0). */
const still = (s, b) => (s <= 0 ? 1 : survival(0, s, b));

/** The density of X at time T on the paths still undecided, started at 0 with bounds at +-b:
 * e^{-T/2} cosh y (1/b) sum_j cos(kappa_j y) e^{-kappa_j^2 T / 2} (the h-transform of a Brownian motion killed at +-b). */
export function openDensity(y, T, b) {
  let acc = 0;
  for (let j = 0; j < 4000; j++) {
    const k = kappa(j, b), e = (k * k * T) / 2;
    if (e > 60) break;
    acc += Math.cos(k * y) * Math.exp(-e);
  }
  return Math.max(0, (Math.exp(-T / 2) * Math.cosh(y) * acc) / b);
}

/** What a flat bound b earns on a schedule, under continuous monitoring, from evidence 0. Without a deadline, every
 * decision ends at |X| = b, so the reward is g(b), and the bill is the integral of c(s) P_0(tau_b > s) ds. With a
 * deadline T, the decisions still open at T are forced there: the reward adds E[g(|X_T|); tau_b > T], and the bill
 * runs to T. Returns { reward, bill, net, open } with open the chance a decision is still open at T (0 without). */
export function flatOnSchedule(cost, b, deadline = null) {
  const ts = billTimes(b, deadline);
  let bill = 0, prev = cost(ts[0]) * still(ts[0], b);
  for (let i = 1; i < ts.length; i++) {
    const t = deadline !== null ? Math.min(ts[i], deadline - 1e-9) : ts[i];
    const v = cost(t) * still(ts[i], b);
    bill += 0.5 * (prev + v) * (ts[i] - ts[i - 1]);
    prev = v;
  }
  if (deadline === null) return { reward: g(b), bill, net: g(b) - bill, open: 0 };
  const open = still(deadline, b);
  // E[g(|X_T|); tau > T] = 2 int_0^b g(y) p_T(y) dy, by Simpson's rule on 200 intervals
  const n = 200, hy = b / n;
  let forced = 0;
  for (let i = 0; i <= n; i++) {
    const y = i * hy, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    forced += w * g(y) * openDensity(y, deadline, b);
  }
  forced *= (2 * hy) / 3;
  const reward = g(b) * (1 - open) + forced;
  return { reward, bill, net: reward - bill, open, forced };
}

/** The best flat bound for a schedule (with a forced choice at a deadline), searched over [lo, hi]. */
export function bestFlat(cost, deadline = null, lo = 0.05, hi = 3) {
  const memo = new Map();
  const net = (b) => { const k = b.toFixed(12); if (!memo.has(k)) memo.set(k, flatOnSchedule(cost, b, deadline).net); return memo.get(k); };
  const { x } = argmax(net, lo, hi, 40, 1e-5);
  return { b: x, ...flatOnSchedule(cost, x, deadline) };
}

// ---- one sampled path, stopped at every bound at once ------------------------------------------------------------

/** One path of X from 0 under dX = tanh(X) dt + dW (the decision maker's own view of the evidence), in Euler steps of
 * dt, until |X| passes `top` and the time passes tMin, or time tMax. The running maximum of |X| gives the decision time
 * for every bound up to `top`; tMin only lengthens the path, so the decision times don't depend on it. */
export function samplePath(seed, { dt = 0.001, top = 3.1, tMin = 0, tMax = 40 } = {}) {
  const R = rng(seed), sd = Math.sqrt(dt);
  const xs = [0], run = [0];
  let x = 0, m = 0;
  while ((m < top || xs.length * dt < tMin) && xs.length * dt < tMax) {
    x += Math.tanh(x) * dt + sd * R.normal();
    m = Math.max(m, Math.abs(x));
    xs.push(x); run.push(m);
  }
  return { dt, x: Float64Array.from(xs), run: Float64Array.from(run) };
}

/** The step at which the path decides with the flat bound b, checked every dt against b moved in by 0.5826 sqrt(dt)
 * (the correction for checking every dt, as kernel.js's decide), or -1 if it never does. */
export function decideAt(path, b) {
  const edge = b - OVERSHOOT * Math.sqrt(path.dt), r = path.run;
  if (r[r.length - 1] < edge) return -1;
  let lo = 0, hi = r.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (r[mid] >= edge) hi = mid; else lo = mid + 1; }
  return lo;
}

/** The cost paid from 0 to each step of a path, by the trapezoid rule (a deadline's infinite cost is never reached:
 * the path is forced there). */
export function cumulativeCost(cost, n, dt) {
  const out = new Float64Array(n);
  let prev = cost(0);
  for (let k = 1; k < n; k++) { const v = cost(k * dt); out[k] = out[k - 1] + 0.5 * (prev + v) * dt; prev = v; }
  return out;
}

// ---- the standing assumption, checked on a schedule -----------------------------------------------------------------

/** Bounds each preset's formula stays within for all t >= 0, from the formula: a logistic step stays between its
 * levels, a sine between its extremes. They hold but need not be reached (a step at time 0.3 starts above its lower
 * level); standing() reports the tight levels. */
export function formulaBand(choice) {
  const p = paramsOf(choice);
  switch (choice.id) {
    case "jump": return { lo: 0.1, hi: 0.1 * p.factor };
    case "fall": return { lo: 0.4 / p.factor, hi: 0.4 };
    case "pulse": return { lo: 0.1, hi: 0.1 * p.factor };
    case "wave": return { lo: 0.1 * (1 - p.size), hi: 0.1 * (1 + p.size) };
    case "constant": return { lo: p.c, hi: p.c };
    case "smooth": return { lo: p.c0 * Math.exp(-1.1 * p.size), hi: p.c0 * Math.exp(1.1 * p.size) };
    case "multistep": return { lo: p.c0, hi: 4.8 * p.c0 };
    case "piecewise": return { lo: 0.03 * p.scale, hi: 0.6 * p.scale };
    case "rising": return { lo: 0.1, hi: Infinity };
    case "deadline": return { lo: p.c, hi: Infinity };
    default: return { lo: NaN, hi: NaN };
  }
}

/** How far the levels are sampled: past every preset's last change (the logistic steps have settled to machine
 * precision long before) and past a full period of the periodic ones (the wave's is at most 4 pi; the smooth family's
 * three sines have frequencies 0.9, 2.3, and 4.7, so it repeats every 20 pi, about 62.8). */
export const LEVELS_UNTIL = 70;
const LEVELS = new Map();
function sampledLevels(choice) {
  const key = JSON.stringify([choice.id, paramsOf(choice)]);
  if (LEVELS.has(key)) return LEVELS.get(key);
  const cost = costOf(choice);
  let lo = Infinity, hi = 0;
  for (let i = 0; i <= LEVELS_UNTIL * 500; i++) { const v = cost(i / 500); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const out = { lo, hi };
  LEVELS.set(key, out);
  return out;
}

/** Whether a schedule is continuous, and the lowest and highest values it takes for t >= 0 (sampled every 0.002 to
 * time 70, which covers every preset; for a drawing, its lowest and highest points, since it is joined by straight
 * lines in log c). A drawing is continued past time 2.5 as the reader picks: held flat (the book's choice), at its last
 * slope, or with a forced choice at 2.5. */
export function standing(choice, tail = "flat") {
  const p = paramsOf(choice);
  const lv = () => sampledLevels(choice);
  switch (choice.id) {
    case "jump": case "fall": case "pulse": case "multistep": case "piecewise": return { continuous: true, ...lv(), kind: "step" };
    case "wave": case "smooth": return { continuous: true, ...lv(), kind: "smooth" };
    case "constant": return { continuous: true, lo: p.c, hi: p.c, kind: "constant" };
    case "rising": return { continuous: true, lo: lv().lo, hi: Infinity, kind: "rising" };
    case "deadline": return { continuous: false, lo: p.c, hi: Infinity, kind: "deadline", at: p.at };
    case "draw": {
      const pts = drawnPoints(choice);
      const lo = Math.min(...pts), hi = Math.max(...pts);
      if (tail === "deadline") return { continuous: false, lo, hi: Infinity, kind: "deadline", at: VIEW };
      if (tail === "slope") {
        const s = lastSlope(pts);
        if (s > 0) return { continuous: true, lo, hi: Infinity, kind: "up", slope: s };
        if (s < 0) return { continuous: true, lo: 0, hi, kind: "down", slope: s };
      }
      return { continuous: true, lo, hi, kind: "drawn" };
    }
    default: return { continuous: true, lo: NaN, hi: NaN, kind: "unknown" };
  }
}

/** Whether the standing assumption holds: continuous, and between two positive constants. */
export const holds = (st) => st.continuous && st.lo > 0 && Number.isFinite(st.hi);

const drawnPoints = (choice) => (choice.points || []).map((c) => Math.min(Math.max(c, DRAW_MIN), DRAW_MAX));
/** The slope of log c over the drawing's last 0.1 time units, per time unit. */
const lastSlope = (pts) => (pts.length > 1 ? (Math.log(pts[pts.length - 1]) - Math.log(pts[pts.length - 2])) / 0.1 : 0);

/** The schedule's cost with a drawing's chosen continuation past time 2.5. */
export function costWithTail(choice, tail = "flat") {
  const base = costOf(choice);
  if (choice.id !== "draw" || tail === "flat") return base;
  if (tail === "deadline") return (t) => (t <= VIEW + 1e-12 ? base(t) : Infinity);
  const s = lastSlope(drawnPoints(choice)), c0 = base(VIEW);
  return (t) => (t <= VIEW ? base(t) : c0 * Math.exp(s * (t - VIEW)));
}

/** The biggest ratio between neighboring points of a drawing: its steepest change over 0.1 time units. */
export function steepest(choice) {
  const pts = drawnPoints(choice);
  let r = 1;
  for (let i = 1; i < pts.length; i++) r = Math.max(r, pts[i] / pts[i - 1], pts[i - 1] / pts[i]);
  return r;
}

// ---- the dynamic program, keeping the value ----------------------------------------------------------------------

/** The best policy for a schedule on an evidence grid, as model.js's exactPolicy computes it (the same steps, so the
 * same bound), and the value V(t, y) = max(deciding, waiting) kept every `every` steps up to time `view` for y from 0
 * to `yTop` (every `ystep` grid points). The choice is forced at the horizon. */
export function valueSurface(cost, horizon, { dt = 0.01, h = 0.02, cap = 5, view = VIEW, every = 5, yTop = 3, ystep = 2, onProgress = null } = {}) {
  const steps = Math.round(horizon / dt);
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap);
  const gx = Float64Array.from(x, (xi) => belief(xi));
  const decide = Float64Array.from(gx, (gi) => Math.max(gi, 1 - gi));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n);
  const bounds = new Float64Array(steps + 1);
  bounds[steps] = 0;
  const ny = Math.floor(Math.min(yTop, x[n - 1]) / h / ystep) + 1;
  const ys = Float64Array.from({ length: ny }, (_, j) => x[m + j * ystep]);
  const kView = Math.round(view / dt);
  const snapTimes = [], snaps = [];
  const keep = (k) => { snapTimes.push(k * dt); snaps.push(Float64Array.from({ length: ny }, (_, j) => v[m + j * ystep])); };
  if (steps <= kView && steps % every === 0) keep(steps);
  for (let k = steps - 1; k >= 0; k--) {
    const ck = Math.min(cost(k * dt), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      let up = 0, down = 0;
      for (let j = -r; j <= r; j++) {
        const idx = i + j;
        const vj = idx < 0 || idx >= n ? decide[idx < 0 ? 0 : n - 1] : v[idx];
        up += kUp[j + r] * vj;
        down += kDown[j + r] * vj;
      }
      wait[i] = gx[i] * up + (1 - gx[i]) * down - ck;
    }
    let b = Infinity;
    for (let i = m + 1; i < n; i++) {
      const d = decide[i] - wait[i];
      if (d > 0) {
        if (i === m + 1) { b = 0; break; }
        const dp = decide[i - 1] - wait[i - 1];
        b = x[i - 1] - (dp * (x[i] - x[i - 1])) / (d - dp);
        break;
      }
    }
    bounds[k] = b > cap ? Infinity : b;
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
    if (k <= kView && k % every === 0) keep(k);
    if (onProgress && k % 100 === 0) onProgress(1 - k / steps);
  }
  snapTimes.reverse(); snaps.reverse();
  const gy = Float64Array.from(ys, (y) => belief(y));
  return { dt, h, ys, gy, times: snapTimes, V: snaps, bounds, v00: v[m], shift: OVERSHOOT * Math.sqrt(dt) };
}

/** The deadline of a choice, if it has one. */
export const deadline = (choice) => deadlineOf(choice);
