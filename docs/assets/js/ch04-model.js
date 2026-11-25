// Chapter 4's model, with no DOM: model.js's dynamic program with its values kept, a schedule's lowest and highest
// cost over all time, two starts driven by the same noise, and decisions sampled against a computed bound. The
// worker (ch04-worker.js) runs the program; the page and tools/checks/ch04.mjs run the rest.
import { grid, belief } from "./model.js?v=942da027e0";
import { costOf, deadlineOf } from "./schedules-book.js?v=942da027e0";
import { B } from "./kernel.js?v=942da027e0";

export const DT = 0.01, H = 0.02, CAP = 5;
export const OVERSHOOT = 0.5826; // the program, checking every dt, stops about this many sqrt(dt) inside the continuous bound
export const FIG1A = { id: "jump", params: { at: 0.5, factor: 16 } };
export const g = (y) => belief(Math.abs(y));

/** A cost from a description the page can post to the worker: a constant, a hard step, or a saved schedule. */
export function costFrom(spec) {
  if (spec.kind === "const") return () => spec.c;
  if (spec.kind === "step") return (t) => (t < spec.at ? spec.lo : spec.hi);
  return costOf(spec.choice);
}

/** The lowest and highest cost over [0, upto]: a scan every `step`, then a golden-section search on the two steps
 * around each scanned extreme, and the first time the cost comes within 0.5% of each (a schedule may only approach
 * its extreme, as Figure 1(a)'s does 1.6). Every schedule in the book has made its last change, or run a whole
 * period, by time 100, so the default scan covers all t >= 0. */
export function extremes(cost, upto = 100, step = 0.001) {
  let lo = Infinity, hi = -Infinity, iLo = 0, iHi = 0;
  const n = Math.round(upto / step);
  for (let i = 0; i <= n; i++) { const c = cost(i * step); if (c < lo) { lo = c; iLo = i; } if (c > hi) { hi = c; iHi = i; } }
  const golden = (f, a, b) => {
    const r = (Math.sqrt(5) - 1) / 2;
    let c = b - r * (b - a), d = a + r * (b - a);
    for (let k = 0; k < 60; k++) { if (f(c) < f(d)) b = d; else a = c; c = b - r * (b - a); d = a + r * (b - a); }
    return (a + b) / 2;
  };
  let tMin = iLo * step, tMax = iHi * step;
  if (Number.isFinite(lo)) { const t = golden(cost, Math.max(0, (iLo - 1) * step), Math.min(upto, (iLo + 1) * step)); if (cost(t) < lo) { lo = cost(t); tMin = t; } }
  if (Number.isFinite(hi)) { const t = golden((u) => -cost(u), Math.max(0, (iHi - 1) * step), Math.min(upto, (iHi + 1) * step)); if (cost(t) > hi) { hi = cost(t); tMax = t; } }
  let tLo = NaN, tHi = NaN;
  for (let i = 0; i <= n && (Number.isNaN(tLo) || Number.isNaN(tHi)); i++) {
    const c = cost(i * step);
    if (Number.isNaN(tLo) && c <= lo * 1.005) tLo = i * step;
    if (Number.isNaN(tHi) && c >= hi * 0.995) tHi = i * step;
  }
  return { lo, hi, tLo, tHi, tMin, tMax };
}

/** The flat bound B(c) moved in by the shift for checking every dt, as the program sees it. */
export const flatOnGrid = (c, dt = DT) => Math.max(B(c) - OVERSHOOT * Math.sqrt(dt), 0);

/** model.js's exactPolicy, step for step, keeping the value V(t_k, y) on y >= 0 at the steps asked for ("all",
 * "none", or a list of steps). Rows are Float32, one per kept step, in V; row(k) finds step k's row. */
export function program(cost, horizon, { dt = DT, h = H, cap = CAP, keep = "none" } = {}) {
  const steps = Math.round(horizon / dt);
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap);
  const gx = Float64Array.from(x, (xi) => belief(xi));
  const decide = Float64Array.from(gx, (gi) => Math.max(gi, 1 - gi));
  const v = Float64Array.from(decide);
  const wait = new Float64Array(n);
  const bounds = new Float64Array(steps + 1);
  const kept = keep === "all" ? Array.from({ length: steps + 1 }, (_, k) => k) : keep === "none" ? [] : [...new Set(keep)].filter((k) => k >= 0 && k <= steps).sort((a, b) => a - b);
  const slot = new Int32Array(steps + 1).fill(-1);
  kept.forEach((k, j) => { slot[k] = j; });
  const W = m + 1, V = new Float32Array(kept.length * W);
  const save = (k) => { const j = slot[k]; if (j >= 0) for (let i = 0; i < W; i++) V[j * W + i] = v[m + i]; };
  bounds[steps] = 0;
  save(steps);
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
        // as model.js: the first step out stops, so the bound is below it; where the center still waits, place it between
        // the center and that step (the paper's code reports 0 here)
        if (i === m + 1) { const dc = decide[m] - wait[m]; b = dc < 0 ? x[m] - (dc * (x[i] - x[m])) / (d - dc) : 0; break; }
        const dp = decide[i - 1] - wait[i - 1];
        b = x[i - 1] - (dp * (x[i] - x[i - 1])) / (d - dp);
        break;
      }
    }
    bounds[k] = b > cap ? Infinity : b;
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
    save(k);
  }
  return { dt, h, m, steps, bounds, V, slot };
}

/** V(t_k, y) from a program's kept row k, linear in y; past the grid the value is the value of deciding. */
export function valueAt(P, k, y) {
  const j = P.slot[k];
  if (j < 0) return NaN;
  const W = P.m + 1, u = Math.abs(y) / P.h, i = Math.floor(u);
  if (i >= P.m) return g(y);
  const f = u - i, o = j * W;
  return P.V[o + i] * (1 - f) + P.V[o + i + 1] * f;
}

/** W = V - g, the value of being allowed to wait. */
export const waitValue = (P, k, y) => valueAt(P, k, y) - g(y);

/** Two starts y1 <= y2 driven by the same noise, as the reflected scheme Y' = max(Y + tanh(Y) dt + dB, 0), with
 * U the unreflected input (Y = U + l) and l = sup(-U)^+ the local time at 0. Kept every `every` steps. */
export function coupled(y1, y2, T, R, dt = 0.001, every = 5) {
  const n = Math.round(T / dt), sd = Math.sqrt(dt);
  let a = y1, b = y2, ua = y1, ub = y2;
  const t = [0], Y1 = [a], Y2 = [b], L1 = [0], L2 = [0];
  let met = NaN;
  for (let k = 1; k <= n; k++) {
    const dB = sd * R.normal();
    ua += Math.tanh(a) * dt + dB; ub += Math.tanh(b) * dt + dB;
    a = Math.max(a + Math.tanh(a) * dt + dB, 0);
    b = Math.max(b + Math.tanh(b) * dt + dB, 0);
    if (Number.isNaN(met) && a === b) met = k * dt;
    if (k % every === 0) { t.push(k * dt); Y1.push(a); Y2.push(b); L1.push(a - ua); L2.push(b - ub); }
  }
  return { t, Y1, Y2, L1, L2, met };
}

/** Decisions from evidence y0 at step k0 of a program: the hidden direction is drawn from the belief g(y0), the
 * evidence moves by z dt + N(0, dt) between checks, and a decision ends at the first check where |X| reaches the
 * bound (step 0 included, so a start at or above it stops at once). With `cap` (a level per step), each path also
 * runs on to its first check at or above the cap, sigma. With `track` (a number of steps) and every value kept, the
 * means of the value process M and the gain G, both stopped at the decision, are kept at each check up to `track`,
 * and the first `keepPaths` paths keep M and G unstopped. */
export function decisions(P, k0, y0, n, R, { keepPaths = 0, cap = null, track = 0, cost = null } = {}) {
  const dt = P.dt, sd = Math.sqrt(dt), last = P.steps;
  const tau = new Float64Array(n), sigma = cap ? new Float64Array(n) : null, paths = [];
  const T = track ? track + 1 : 0;
  const sumM = new Float64Array(T), sumG = new Float64Array(T), sqM = new Float64Array(T), sqG = new Float64Array(T);
  const g0 = g(y0);
  for (let p = 0; p < n; p++) {
    const z = R.next() < g0 ? 1 : -1;
    const keepIt = p < keepPaths, pts = keepIt ? [] : null, gain = keepIt && track ? [] : null;
    let x = y0, k = 0, done = -1, sig = -1, paid = 0, mAt = 0, gAt = 0;
    for (;;) {
      const y = Math.abs(x), kk = Math.min(k0 + k, last);
      if (done < 0 && (y >= P.bounds[kk] || kk >= last)) done = k;
      if (cap && sig < 0 && (y >= cap[Math.min(kk, last)] || kk >= last)) sig = k;
      if (k < T) {
        const vNow = valueAt(P, kk, y) - paid, gNow = g(y) - paid;
        if (done < 0 || done === k) { mAt = vNow; gAt = gNow; }
        sumM[k] += mAt; sqM[k] += mAt * mAt; sumG[k] += gAt; sqG[k] += gAt * gAt;
        if (gain) gain.push([k * dt, vNow, gNow]);
      }
      if (pts && (done < 0 || done === k || (cap && (sig < 0 || sig === k)))) pts.push([k * dt, y]);
      if (done >= 0 && (!cap || sig >= 0) && k + 1 >= T) break;
      if (cost) paid += cost(kk * dt) * dt;
      x += z * dt + sd * R.normal();
      k++;
    }
    tau[p] = done * dt;
    if (cap) sigma[p] = sig * dt;
    if (keepIt) paths.push({ pts, gain, tau: done * dt, sigma: cap ? sig * dt : NaN });
  }
  const out = { tau, sigma, paths };
  if (T) {
    const mean = (s) => Array.from(s, (v) => v / n);
    const se = (s, q) => Array.from(s, (v, i) => Math.sqrt(Math.max(0, q[i] / n - (v / n) ** 2) / n));
    Object.assign(out, { meanM: mean(sumM), meanG: mean(sumG), seM: se(sumM, sqM), seG: se(sumG, sqG) });
  }
  return out;
}

/** The band plate's numbers, over the checks ts of the window: the program's bound bs against its own flat bounds
 * for the lowest cost (up) and the highest (dn), the band on the grid that part (b) guarantees; the continuous edges
 * upC and dnC (B moved in by the monitoring shift) against those; and the share of checks where bs is below or above
 * the per-moment bound pm by more than tol. */
export function bandStats(ts, bs, up, dn, upC, dnC, pm, tol = 0.002, h = H) {
  let gapUp = Infinity, atUp = 0, gapDn = Infinity, atDn = 0, shiftGap = 0, pull = 0, below = 0, above = 0, sub = false;
  for (let k = 0; k < ts.length; k++) {
    if (up[k] - bs[k] < gapUp) { gapUp = up[k] - bs[k]; atUp = ts[k]; }
    if (bs[k] - dn[k] < gapDn) { gapDn = bs[k] - dn[k]; atDn = ts[k]; }
    shiftGap = Math.max(shiftGap, Math.abs(upC - up[k]), Math.abs(dnC - dn[k]));
    pull = Math.max(pull, upC - up[k]);
    if (dn[k] < h) sub = true;
    if (bs[k] < pm[k] - tol) below++;
    if (bs[k] > pm[k] + tol) above++;
  }
  return { up: up[0], dn: dn[0], gapUp, atUp, gapDn, atDn, shiftGap, horizonPull: pull > tol, subStep: sub, below: below / ts.length, above: above / ts.length };
}

/** The band plate's kind of schedule: a deadline, the rising cost (no c_max), the Constant preset, or one the band
 * covers ("ok"). Constant and "ok" get the band between the same program's bounds for c_min and c_max. */
export const bandKind = (choice) => (deadlineOf(choice) !== null ? "deadline" : choice.id === "rising" ? "rising" : choice.id === "constant" ? "constant" : "ok");
export const hasBand = (kind) => kind === "ok" || kind === "constant";
/** The band plate's per-moment bound on the grid: B(c(t)) moved in by 0.5826 sqrt(dt), and 0 from a deadline on. */
export const pmOnGrid = (cost, dl) => (t) => (dl !== null && t >= dl - 1e-9 ? 0 : flatOnGrid(cost(t)));

/** The band plate's series over [0, view] at the program's checks: the times, the program's bound (data, the worker's
 * values reply), the per-moment bound, and the band's upper and lower edges, the programs' bounds for c_min and c_max
 * (flats = { lo, hi }, or null without a band). */
export function bandSeries(data, flats, view, cost, dl) {
  const k = Math.round(view / data.dt), ts = Array.from({ length: k + 1 }, (_, j) => j * data.dt);
  const cut = (P) => (P ? Array.from(P.bounds.subarray(0, k + 1)) : null);
  return { ts, bs: cut(data), pm: ts.map(pmOnGrid(cost, dl)), up: cut(flats?.lo), dn: cut(flats?.hi) };
}

/** After Show me on the band plate: the reader's drawing (its values at sketch.length evenly spaced times over
 * [0, view], NaN where nothing was drawn) against the program's bound, each point at the check nearest it: its mean
 * distance from the bound, and the share of it more than 0.002 outside the band where there is one; with a band, the
 * band's measured statistics (bandStats); without one, the bound's range. ext is extremes() of the cost. */
export function bandReveal({ kind, sketch, view, data, flats, cost, dl, ext }) {
  const { ts, bs, pm, up, dn } = bandSeries(data, flats, view, cost, dl), n = sketch.length;
  let miss = 0, cnt = 0, out = 0;
  sketch.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const k = Math.min(bs.length - 1, Math.round(((i / (n - 1)) * view) / data.dt));
    miss += Math.abs(v - bs[k]); cnt++;
    if (up && (v > up[k] + 0.002 || v < dn[k] - 0.002)) out++;
  });
  const band = hasBand(kind) && up !== null;
  // the bound's lowest value while a decision is still open: before a deadline's forced choice, where it is 0
  const open = dl !== null && bs.length > 1 ? bs.slice(0, -1) : bs;
  return { kind, band, dl: dl ?? null, cnt, miss: cnt ? miss / cnt : NaN, outside: cnt ? out / cnt : 0, lo: Math.min(...bs), hi: Math.max(...bs), loOpen: Math.min(...open),
    st: band ? bandStats(ts, bs, up, dn, flatOnGrid(ext.lo), flatOnGrid(ext.hi), pm) : null };
}

/** The moments of decision counted in bins of width bw from xMin, with a moment at the right edge xMax counted in
 * the last bin (a deadline's forced choice lands there), and the number past xMax, which the chart doesn't show. */
export function decisionBins(moments, xMin, xMax, bw) {
  const nb = Math.max(1, Math.ceil((xMax - xMin) / bw - 1e-9)), counts = new Array(nb).fill(0);
  let beyond = 0, before = 0;
  for (const v of moments) {
    if (v > xMax + 1e-9) { beyond++; continue; }
    if (v < xMin - 1e-9) { before++; continue; }
    counts[Math.min(nb - 1, Math.max(0, Math.floor((v - xMin) / bw + 1e-9)))]++;
  }
  return { counts, beyond, before };
}

/** The integral of a cost over [a, b], by the midpoint rule on steps of at most 0.0005 (0 if b <= a). */
export function integral(cost, a, b) {
  if (!(b > a)) return 0;
  const n = Math.max(1, Math.ceil((b - a) / 0.0005)), h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += cost(a + (i + 0.5) * h);
  return s * h;
}

/** The integral over [a, b] of a cost that is lo before `at` and hi from then on, exactly. */
export const stepIntegral = (lo, hi, at, a, b) => (b > a ? lo * Math.max(0, Math.min(b, at) - Math.min(a, at)) + hi * Math.max(0, Math.max(b, at) - Math.max(a, at)) : 0);

/** Quantile q of a sample (sorted copy). */
export function quantile(arr, q) {
  const s = Float64Array.from(arr).sort();
  const i = (s.length - 1) * q, a = Math.floor(i), f = i - a;
  return a + 1 < s.length ? s[a] * (1 - f) + s[a + 1] * f : s[a];
}
