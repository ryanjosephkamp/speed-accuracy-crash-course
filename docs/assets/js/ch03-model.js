// Chapter 3's model, with no DOM: the reward and bill of a flat bound on any schedule (from the chance of still being
// undecided, kernel.js's series), one sampled path and its decision time for every bound at once, the closed forms of
// the constant-cost problem (the value of a flat bound, the reward g(b) - c b tanh b and its slope), the standing
// assumption checked on a schedule, and the dynamic program with its value V(t, y) kept on a grid. The page, the
// worker, and tools/checks/ch03.mjs all import it.
import { B, Bprime, survival, kappa, rng, OVERSHOOT } from "./kernel.js?v=e579ee3325";
import { belief, grid, score } from "./model.js?v=e579ee3325";
import { costOf, deadlineOf, paramsOf, DRAW_MIN, DRAW_MAX, VIEW } from "./schedules-book.js?v=e579ee3325";
import { dropAt } from "./chart.js?v=e579ee3325";

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
 * (its slowest term, from the series): every 0.01 to time 6, or every b²/40 for a low bound, whose decisions take
 * about b² time units; then every 0.02. A drawing's corners (every 0.1 to time 2.5) are always step ends. */
export const BILL = { fine: 0.01, coarse: 0.02, switchAt: 6, cut: 1e-10 };
function billTimes(b, deadline) {
  const k0 = kappa(0, b), lam = (1 + k0 * k0) / 2, a0 = (2 * k0 * Math.cosh(b)) / (b * (1 + k0 * k0));
  const far = Math.log(Math.max(a0, 1) / BILL.cut) / lam;
  const end = deadline === null ? far : Math.min(deadline, far);
  const fine = Math.min(BILL.fine, (b * b) / 40), n1 = Math.ceil(Math.min(end, BILL.switchAt) / fine);
  const out = [];
  for (let i = 0; i < n1; i++) out.push(Math.min(i * fine, end));
  if (end > BILL.switchAt) for (let s = BILL.switchAt; s < end - 1e-12; s += BILL.coarse) out.push(s);
  for (let k = 1; k <= 25 && k / 10 < end; k++) out.push(k / 10);
  out.push(end);
  out.sort((x, y) => x - y);
  return out.filter((v, i) => i === 0 || v - out[i - 1] > 1e-12);
}

/** The integral over one step of length h of c(s) S(s), with log c linear across the step (exact for a drawing, whose
 * log c is linear between its corners) and S quadratic through its values at the step's ends and middle:
 * c0 h int_0^1 e^{xv} S(v) dv with x = log(c1/c0), by the moments int_0^1 v^k e^{xv} dv (series for small x). */
function stepIntegral(c0, c1, S0, Sm, S1, h) {
  const a1 = 4 * Sm - S1 - 3 * S0, a2 = 2 * S1 + 2 * S0 - 4 * Sm;     // S(v) = S0 + a1 v + a2 v^2 on [0, 1]
  if (!(c0 > 0) || !(c1 > 0)) return h * (c0 * S0 + 4 * (0.5 * (c0 + c1)) * Sm + c1 * S1) / 6;
  const x = Math.log(c1 / c0);
  let E0, E1, E2;
  if (Math.abs(x) < 0.05) {
    const x2 = x * x, x3 = x2 * x, x4 = x3 * x;
    E0 = 1 + x / 2 + x2 / 6 + x3 / 24 + x4 / 120;
    E1 = 1 / 2 + x / 3 + x2 / 8 + x3 / 30 + x4 / 144;
    E2 = 1 / 3 + x / 4 + x2 / 10 + x3 / 36 + x4 / 168;
  } else {
    const ex = Math.exp(x);
    E0 = (ex - 1) / x; E1 = (ex * (x - 1) + 1) / (x * x); E2 = (ex * (x * x - 2 * x + 2) - 2) / (x * x * x);
  }
  return c0 * h * (S0 * E0 + a1 * E1 + a2 * E2);
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
 * deadline T, the decisions still open at T are forced there: the reward is g(b) P(tau_b <= T) + E[g(|X_T|); tau_b > T],
 * and the bill runs to T. Numerically: the bill on billTimes's steps by stepIntegral, the forced term by Simpson's rule. Returns { reward, bill, net, open } with open the chance a decision is still open at T (0 without). */
export function flatOnSchedule(cost, b, deadline = null) {
  const ts = billTimes(b, deadline);
  const at = (t) => cost(deadline !== null ? Math.min(t, deadline - 1e-9) : t);
  // a step is halved, up to 8 times, while log c at its middle is more than 1e-6 off the straight line between its
  // ends (a drawing never is, between corners; a logistic step is, near its middle)
  const seg = (a, z, ca, cz, Sa, Sz, depth) => {
    const m = 0.5 * (a + z), cm = at(m), Sm = still(m, b);
    if (depth < 8 && ca > 0 && cz > 0 && Math.abs(Math.log(cm) - 0.5 * (Math.log(ca) + Math.log(cz))) > 1e-6) {
      return seg(a, m, ca, cm, Sa, Sm, depth + 1) + seg(m, z, cm, cz, Sm, Sz, depth + 1);
    }
    return stepIntegral(ca, cz, Sa, Sm, Sz, z - a);
  };
  let bill = 0, c0 = at(ts[0]), S0 = still(ts[0], b);
  for (let i = 1; i < ts.length; i++) {
    const c1 = at(ts[i]), S1 = still(ts[i], b);
    bill += seg(ts[i - 1], ts[i], c0, c1, S0, S1, 0);
    c0 = c1; S0 = S1;
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
  let lo = Infinity, hi = 0, iLo = 0, iHi = 0;
  const N = LEVELS_UNTIL * 500;
  for (let i = 0; i <= N; i++) { const v = cost(i / 500); if (v < lo) { lo = v; iLo = i; } if (v > hi) { hi = v; iHi = i; } }
  // the extremes between samples: golden-section search over the two steps around each sampled extreme
  const refine = (i, sign) => { const a = Math.max(0, i - 1) / 500, b = Math.min(N, i + 1) / 500; return sign * argmax((t) => sign * cost(t), a, b, 9, 1e-12).f; };
  const out = { lo: Math.min(lo, refine(iLo, -1)), hi: Math.max(hi, refine(iHi, 1)) };
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
    case "jump": case "fall": case "pulse": return { continuous: true, ...lv(), kind: "step" };
    case "multistep": case "piecewise": return { continuous: true, ...lv(), kind: "step", joins: "log" };
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

/** x rounded to two significant figures, outward: down for a lower level (dir < 0), up for an upper one, so the
 * printed level still bounds the cost. A value that rounds onto itself (0.1 for 0.1) stays. */
export function outward(x, dir) {
  if (!(x > 0) || !Number.isFinite(x)) return x;
  const step = 10 ** (Math.floor(Math.log10(x)) - 1);
  let r = Math.round(x / step) * step;
  if (dir < 0 && r > x * (1 + 1e-12)) r -= step;
  if (dir > 0 && r < x * (1 - 1e-12)) r += step;
  return +r.toPrecision(2);
}
/** A number rounded to d decimals, outward (dir < 0 down, dir > 0 up). */
export const outwardTo = (x, d, dir) => { const k = 10 ** d, r = Math.round(x * k) / k; return dir < 0 ? (r > x + 1e-12 ? r - 1 / k : r) : (r < x - 1e-12 ? r + 1 / k : r); };

/** The levels the plate prints: the schedule's lowest and highest values rounded outward, and the band they give the
 * bound by Lemma 1(c), B(c_max) to B(c_min), rounded outward to two decimals. */
export function printedLevels(st) {
  const lo = st.lo > 0 ? outward(st.lo, -1) : st.lo, hi = Number.isFinite(st.hi) ? outward(st.hi, 1) : st.hi;
  const ok = holds(st);
  return { lo, hi, bandLo: ok ? outwardTo(B(hi), 2, -1) : NaN, bandHi: ok ? outwardTo(B(lo), 2, 1) : NaN };
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
        // the first step out stops: where the center still waits, the bound lies between the two (model.js's rule;
        // the paper's code reports 0 there)
        if (i === m + 1) { const dc = decide[m] - wait[m]; b = dc < 0 ? x[m] - (dc * (x[i] - x[m])) / (d - dc) : 0; break; }
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
  // the bound at each kept row: its own step, not a neighbor's
  const rowBounds = snapTimes.map((t) => bounds[Math.round(t / dt)]);
  return { dt, h, ys, gy, times: snapTimes, V: snaps, rowBounds, bounds, v00: v[m], shift: OVERSHOOT * Math.sqrt(dt) };
}

/** The grid's bound is below its first step (0 < b < h): the program waits at the center and stops one step out.
 * The paper's code reports 0 there. */
export const belowFirstStep = (b, h) => Number.isFinite(b) && b > 0 && b < h;

/** The value map's two plotted curves from the worker's value reply: the per-moment bound and the program's bound, each
 * as dropAt draws it (flat to a deadline in view, then straight down to its 0), with a missing bound as NaN. */
export function mapCurves(m) {
  return { pm: dropAt(m.t, m.pm, m.deadline), b: dropAt(m.t, m.b.map((v) => (v === null ? NaN : v)), m.deadline) };
}

/** One path's outcome with the flat bound b: the first check at which |X| reaches b moved in by 0.5826 sqrt(dt), the
 * evidence there, and the chance the choice made there is right, g(|X|) at that check (not g(b): a check can land on
 * either side of b). With a deadline, a path still open there is forced at its last check before the deadline. cum is
 * cumulativeCost on the path's steps. */
export function pathOutcome(path, b, cum, deadline = null) {
  const o = outcomeAt(path, b, cum, deadline);
  o.shift = OVERSHOOT * Math.sqrt(path.dt);
  return o;
}
function outcomeAt(path, b, cum, deadline) {
  const k = decideAt(path, b), kT = deadline !== null ? Math.round(deadline / path.dt) : Infinity;
  if (k >= 0 && k <= kT) { const x = path.x[k]; return { b, k, tau: k * path.dt, x, side: Math.sign(x) || 1, forced: false, right: g(Math.abs(x)), bill: cum[k] }; }
  if (deadline !== null) { const kk = Math.min(kT, path.x.length - 1), x = path.x[kk]; return { b, k: kk, tau: kk * path.dt, x, xT: x, side: Math.sign(x) || 1, forced: true, deadline, right: g(Math.abs(x)), bill: cum[kk] }; }
  const kk = path.x.length - 1; return { b, k: kk, tau: kk * path.dt, x: path.x[kk], side: 1, forced: false, right: NaN, bill: cum[kk], off: true };
}

/** The best flat bound on the dynamic program's own grid that a numerical search finds: the threshold x, held fixed and
 * checked every dt, scored with model.js's score (the scorer the paper's code mirrors), with the choice forced at the
 * horizon. The scan takes each cell boundary (odd multiples of h/2) to 0.31, where the scorer's interpolation changes
 * slope, then every 0.05 to 3.5 and every 0.1 below the cap; a flat policy can have more than one peak (a fast decision
 * before a cost falls, or a slow one after it), so the three highest local peaks of that scan are each refined by golden
 * section between their neighbors. It doesn't score every threshold in (0, cap): between scanned points it can miss a
 * higher score. The result is the best level it scored, over the scan and every refinement probe. near, if given, is
 * scored too, but not as a candidate. */
export function bestFlatOnGrid(cost, horizon, { dt = 0.01, h = 0.02, cap = 5, near = null } = {}) {
  const steps = Math.round(horizon / dt);
  const ts = Float64Array.from({ length: steps + 1 }, (_, k) => k * dt);
  const memo = new Map();
  const at = (x) => { const k = x.toFixed(9); if (!memo.has(k)) memo.set(k, score(Float64Array.from(ts, () => x), ts, cost, h, cap).reward); return memo.get(k); };
  const xs = [];
  for (let x = h / 2; x < 0.31 + 1e-9; x += h) xs.push(+x.toFixed(9));
  for (let x = 0.35; x < Math.min(3.5, cap) + 1e-9; x += 0.05) xs.push(+x.toFixed(9));
  for (let x = 3.6; x < cap - 1e-9; x += 0.1) xs.push(+x.toFixed(9));
  const vs = xs.map(at);
  const peaks = xs.map((x, i) => i).filter((i) => (i === 0 || vs[i] >= vs[i - 1]) && (i === xs.length - 1 || vs[i] >= vs[i + 1]))
    .sort((i, j) => vs[j] - vs[i]).slice(0, 3);
  let best = { x: xs[peaks[0]], f: vs[peaks[0]] };
  const refined = [];
  for (const i of peaks) {
    const lo = xs[Math.max(0, i - 1)], hi = xs[Math.min(xs.length - 1, i + 1)], probes = [];
    const r = argmax((x) => { const f = at(x); probes.push([x, f]); return f; }, lo, hi, 5, 1e-5);
    for (const [x, f] of probes) if (f > best.f) best = { x, f };
    refined.push({ peak: xs[i], lo, hi, x: r.x, f: r.f, probes });
  }
  // scan and refined: what the search did, for the checks (the scanned levels and their scores, and each refined peak
  // with its bracket, golden section's result, and every level it scored there)
  return { x: best.x, reward: best.f, shifted: near === null ? NaN : at(near), x0: near, cap, scan: xs, scores: vs, refined };
}

/** The routes plate's step 2 axis: tall enough for the highest trial level's dot, c (b + sinh(2b)/2) at b = 1.3 B(c). */
export const slopeAxisTop = (c, levels) => Math.max(1.2, 1.08 * Math.max(...levels.map((b) => c * (b + 0.5 * Math.sinh(2 * b)))));

/** The kept sample nearest a tap on the value map: its row (time) and column (evidence), with their coordinates. */
export function nearestSample(times, ys, t, y) {
  let i = 0, j = 0;
  times.forEach((v, k) => { if (Math.abs(v - t) < Math.abs(times[i] - t)) i = k; });
  ys.forEach((v, k) => { if (Math.abs(v - y) < Math.abs(ys[j] - y)) j = k; });
  return { i, j, t: times[i], y: ys[j] };
}

/** The deadline of a choice, if it has one. */
export const deadline = (choice) => deadlineOf(choice);
