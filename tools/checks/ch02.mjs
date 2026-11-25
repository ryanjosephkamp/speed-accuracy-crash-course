// Chapter 2: the change of units, the Palmer time unit, the belief from Bayes' rule and its sampled check, the
// decision maker's drift and the innovation, the drift of Y = |X| and its reflection, the three facts about g and
// the mean time to reach a level, the coupling of two starts, and the sentences under the plates.
import { rng, B, decide } from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch02-model.js";
import * as S from "../../book/assets/js/say-ch02.js";
import { costOf, deadlineOf, VIEW } from "../../book/assets/js/schedules-book.js";
import { dropAt } from "../../book/assets/js/chart.js";
import { check, N, asPrinted, runWorker } from "./lib.mjs";

const meanSE = (xs) => {
  let s = 0, q = 0; for (const x of xs) { s += x; q += x * x; }
  const n = xs.length, m = s / n;
  return { m, se: Math.sqrt(Math.max(0, q / n - m * m) / (n - 1)) };
};
const simpson = (f, a, b, n = 4000) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return (s * h) / 3; };

// ---- the normal distribution the plates use ------------------------------------------------------------------
{
  let worst = 0;
  for (const x of [-2.5, -0.7, 0, 0.3, 1, 2, 2.99, 3, 3.5, 5]) {
    const ref = x >= 0 ? simpson((u) => (2 / Math.sqrt(Math.PI)) * Math.exp(-u * u), x, x + 12, 20000) : 2 - simpson((u) => (2 / Math.sqrt(Math.PI)) * Math.exp(-u * u), -x, -x + 12, 20000);
    worst = Math.max(worst, Math.abs(M.erfc(x) - ref) / ref);
  }
  check("belief", "erfc against Simpson's rule on its integral, at ten points from -2.5 to 5 (relative, within 1e-9)", worst < 1e-9, `largest relative difference ${worst.toExponential(1)}`);
  // |x| has a kink at 0, so integrate the two sides separately
  const sc = [[0.4, 0.3], [-1.2, 0.7], [2, 1.5]].map(([m, s]) => Math.abs(M.absMean(m, s) - (simpson((x) => -x * M.normal(x, m, s * s), Math.min(0, m - 14 * s), 0, 20000) + simpson((x) => x * M.normal(x, m, s * s), 0, Math.max(0, m + 14 * s), 20000))));
  check("fold", "E|N(m, s^2)| in closed form against Simpson's rule, three cases (within 1e-10)", Math.max(...sc) < 1e-10, `largest difference ${Math.max(...sc).toExponential(1)}`);
}

// ---- units ------------------------------------------------------------------------------------------------------
for (const [mu, sigma] of [[0.6, 1.5], [1.8, 0.7]]) {
  // raw evidence by Euler steps, then the change of variables: per unit of new time, drift H and variance 1
  const R = rng(17), dt = 0.01, n = 200000, H = 1;
  const k = (mu * mu) / (sigma * sigma);
  const incs = new Float64Array(n);
  for (let i = 0; i < n; i++) incs[i] = (mu / (sigma * sigma)) * (mu * H * dt + sigma * Math.sqrt(dt) * R.normal()) / (k * dt);
  // incs[i] is the change of x per unit of t' over one raw step; its mean is H and its variance 1/(k dt)
  const { m, se } = meanSE(incs);
  let v = 0; for (const x of incs) v += (x - m) ** 2; v /= n - 1;
  const want = 1 / (k * dt), vSE = want * Math.sqrt(2 / (n - 1));
  check("units", `mu = ${mu}, sigma = ${sigma}: x = mu Z / sigma^2 against t' = mu^2 t / sigma^2 has drift H = 1 (within 3 standard errors)`, Math.abs(m - 1) < 3 * se, `${m.toFixed(4)} ± ${se.toFixed(4)}`);
  check("units", `mu = ${mu}, sigma = ${sigma}: and unit noise, variance per unit of t' equal to 1 (within 3 standard errors)`, Math.abs(v - want) < 3 * vSE, `${(v * k * dt).toFixed(4)} ± ${(vSE * k * dt).toFixed(4)} per unit time`);
  const T1 = (sigma * sigma) / (mu * mu);
  check("units", `mu = ${mu}, sigma = ${sigma}: the drift mu t meets the noise sigma sqrt t at t = sigma^2/mu^2, at evidence sigma^2/mu`, Math.abs(mu * T1 - sigma * Math.sqrt(T1)) < 1e-12 && Math.abs(mu * T1 - (sigma * sigma) / mu) < 1e-12, `t = ${T1.toFixed(4)}, evidence ${(mu * T1).toFixed(4)}`);
  // the cost: int c dt in raw time equals int c' dt' in the paper's time
  const c = (t) => 0.1 + 0.05 * Math.sin(3 * t), Traw = 2;
  const raw = simpson(c, 0, Traw), paper = simpson((tp) => c(tp / k) / k, 0, k * Traw);
  check("units", `mu = ${mu}, sigma = ${sigma}: with c'(t') = a c(a t'), a = sigma^2/mu^2, the total cost of a decision doesn't change (within 1e-10)`, Math.abs(raw - paper) < 1e-10, `${raw.toFixed(8)} vs ${paper.toFixed(8)}`);
}
{
  // the plate's own path and drawing functions: its seed, steps, and window, at the slider's corners and Palmer's setting
  const DT = 0.0005, xp = M.evidence(1, 0, M.increments(rng(2026 + 1), Math.round(64 / DT), DT), DT);
  const ts = Array.from({ length: 401 }, (_, i) => (4 * i) / 400);
  const settings = [[0.5, 0.5], [0.5, 2], [2, 0.5], [2, 2], [1, 1], [21 * 0.064, 1]];
  let back = 0, clipped = 0, mid = 0, widened = 0, charts = 0;
  // every series unitsCharts returns for a chart, inside the range it returns for that chart (the plate draws both
  // as they come; this doesn't see the plate's frames)
  const holds = ([lo, hi], ...series) => series.every((a) => a.length === 401 && a.every((v) => Number.isFinite(v) && v >= lo && v <= hi));
  for (const [mu, sigma] of settings) {
    const k = (mu * mu) / (sigma * sigma), C = M.unitsCharts(xp, DT, mu, sigma, 4), zs = C.raw.zs;
    if (C.raw.ts.some((t, i) => Math.abs(t - ts[i]) > 1e-12)) clipped++;
    zs.forEach((z, i) => { back = Math.max(back, Math.abs((mu * z) / (sigma * sigma) - M.pathAt(xp, DT, k * ts[i]))); });
    charts += 2;
    if (!holds(C.raw.y, C.raw.zs, C.raw.drift, C.raw.noise)) clipped++;
    if (!holds(C.paper.y, C.paper.xs, C.paper.line, C.paper.sqrt)) clipped++;
    if (C.raw.y[1] > 6 || C.raw.y[0] < -2) widened++;
    if (Math.abs(C.raw.drift[400] - mu * 4) > 1e-12 || Math.abs(C.raw.noise[400] - sigma * 2) > 1e-12) clipped++;
  }
  // between two steps the path is read linearly: halfway, it is the mean of the two steps
  for (const k of [10, 3613, 70000]) mid = Math.max(mid, Math.abs(M.pathAt(xp, DT, (k + 0.5) * DT) - 0.5 * (xp[k] + xp[k + 1])));
  check("units", "the units plate's raw samples, read back through x = mu Z / sigma^2, are the paper path at t' = mu^2 t / sigma^2, read the same way (six settings, within 1e-12)", back < 1e-12 && mid < 1e-12, `largest difference ${back.toExponential(1)}`);
  check("units", "the helper unitsCharts returns, for each of the units plate's two charts, a range that holds every series it returns for that chart (the path, the drift line, and the noise curve; the path, t, and sqrt t), at the slider's corners and Palmer's setting",
    clipped === 0 && widened > 0, `${charts} charts, ${clipped} with a returned value outside the returned range; ${widened} raw charts widened past -2 to 6`);
}
{
  const ms = 1000 * M.unitSeconds(0.064);
  check("palmer", "PalmerT: one time unit at 6.4% coherence, 1000/(21 x 0.064)^2 ms", asPrinted(ms, N.PalmerT), `${ms.toFixed(2)} vs ${N.PalmerT}`);
  check("palmer", "the time unit scales as 1/coherence^2: half the coherence, four times the unit", Math.abs(M.unitSeconds(0.032) / M.unitSeconds(0.064) - 4) < 1e-12, `${(M.unitSeconds(0.032) / M.unitSeconds(0.064)).toFixed(12)}`);
  const b = +N.PalmerBound, p = M.g(b);
  check("palmer", "PalmerBound read as a belief: g(0.95) is between 0.86 and 0.88", p > 0.86 && p < 0.88, `g(${b}) = ${p.toFixed(4)}`);
}

// ---- the belief ---------------------------------------------------------------------------------------------------
{
  let worst = 0;
  for (const t of [0.1, 0.25, 1, 3, 10]) for (const x of [-2, -0.5, 0, 0.7, 1, 2.5]) {
    const ratio = M.normal(x, t, t) / M.normal(x, -t, t);
    worst = Math.max(worst, Math.abs(Math.log(ratio) - 2 * x));
    const post = M.normal(x, t, t) / (M.normal(x, t, t) + M.normal(x, -t, t));
    worst = Math.max(worst, Math.abs(post - M.g(x)));
  }
  check("belief", "Bayes' rule on the two normal densities gives log ratio 2x and posterior g(x), at five times and six points (within 1e-12)", worst < 1e-12, `largest difference ${worst.toExponential(1)}`);
  const girs = [0.3, 2].map((t) => Math.abs((Math.exp(1.1 - t / 2) / Math.exp(-1.1 - t / 2)) - Math.exp(2.2)) / Math.exp(2.2));
  check("belief", "the Girsanov ratio e^(x - t/2)/e^(-x - t/2) is e^(2x) at every t", Math.max(...girs) < 1e-12, `${Math.max(...girs).toExponential(1)}`);
  let lo = 0;
  for (const x of [-3, -1, 0, 0.4, 2]) lo = Math.max(lo, Math.abs(Math.log(M.g(x) / (1 - M.g(x))) - 2 * x), Math.abs(M.halfLogOdds(M.g(x)) - x));
  check("belief", "the evidence is half the log odds: log(g/(1 - g)) = 2x, and halfLogOdds inverts g", lo < 1e-12, `${lo.toExponential(1)}`);
  let bw = 0;
  for (const t of [0.25, 1, 3]) for (const x of [-1, 0.2, 1, 2]) bw = Math.max(bw, Math.abs(M.binShare(x - 1e-4, x + 1e-4, t) - M.g(x)));
  check("belief", "the exact share in a bin tends to g at the bin's center as the bin shrinks (width 2e-4, within 1e-6)", bw < 1e-6, `${bw.toExponential(1)}`);
}
for (const t of [0.25, 1, 3]) {
  // sampled trials: E[(1{H=+1} - g(X_t)) phi(X_t)] = 0 for any phi (the definition of the conditional probability)
  const tr = M.trials(rng(900 + Math.round(t * 100)), t, 200000, 1);
  for (const [name, phi] of [["1", () => 1], ["x", (x) => x], ["1{x > 0.5}", (x) => (x > 0.5 ? 1 : 0)]]) {
    const v = Array.from(tr.X, (x, i) => ((tr.H[i] > 0 ? 1 : 0) - M.g(x)) * phi(x));
    const { m, se } = meanSE(v);
    check("belief", `t = ${t}: sampled E[(1{H = +1} - g(X_t)) ${name}] is 0 within 3 standard errors (200,000 trials)`, Math.abs(m) < 3 * se, `${m.toExponential(2)} ± ${se.toExponential(1)}`);
  }
  // choosing the sign of X_t is right in a share Phi(sqrt t), and that equals E g(|X_t|)
  const right = Array.from(tr.X, (x, i) => (Math.sign(x) === tr.H[i] ? 1 : 0)), gs = Array.from(tr.X, (x) => M.g(Math.abs(x)));
  const r = meanSE(right), d = meanSE(right.map((v, i) => v - gs[i]));
  check("belief", `t = ${t}: the share of correct sign choices matches Phi(sqrt t) within 3 standard errors`, Math.abs(r.m - M.rightAt(t)) < 3 * r.se, `${r.m.toFixed(4)} ± ${r.se.toFixed(4)} vs ${M.rightAt(t).toFixed(4)}`);
  check("belief", `t = ${t}: and the sampled g(|X_t|) averages the same (the difference within 3 standard errors of 0)`, Math.abs(d.m) < 3 * d.se, `${d.m.toExponential(2)} ± ${d.se.toExponential(1)}`);
  const quad = simpson((x) => M.g(Math.abs(x)) * 0.5 * (M.normal(x, t, t) + M.normal(x, -t, t)), -t - 14 * Math.sqrt(t), t + 14 * Math.sqrt(t), 40000);
  check("belief", `t = ${t}: E g(|X_t|) by quadrature equals Phi(sqrt t) (within 1e-9)`, Math.abs(quad - M.rightAt(t)) < 1e-9, `${quad.toFixed(10)} vs ${M.rightAt(t).toFixed(10)}`);
  // the decision maker's drift: E[X_{t+1} - X_t | X_t] = tanh X_t, so E[(dX - tanh X_t) phi(X_t)] = 0
  for (const [name, phi] of [["1", () => 1], ["tanh x", Math.tanh]]) {
    const v = Array.from(tr.X, (x, i) => (tr.dX[i] - Math.tanh(x)) * phi(x));
    const { m, se } = meanSE(v);
    check("drift", `t = ${t}: the next unit's change minus tanh X_t, times ${name}, averages 0 within 3 standard errors`, Math.abs(m) < 3 * se, `${m.toExponential(2)} ± ${se.toExponential(1)}`);
  }
}
{
  let w = 0;
  for (const x of [-3, -0.4, 0, 0.9, 2.2]) w = Math.max(w, Math.abs(2 * M.g(x) - 1 - Math.tanh(x)));
  check("drift", "2 g(x) - 1 = tanh x (within 1e-15)", w < 1e-15, `${w.toExponential(1)}`);
  // the innovation from the true model, computed from the evidence alone
  const T = 2, dt = 0.01, n = Math.round(T / dt), K = 40000, R = rng(77);
  let s1 = 0, s2 = 0, a = 0, b = 0, ab = 0, aa = 0, bb = 0;
  for (let k = 0; k < K; k++) {
    const H = R.next() < 0.5 ? 1 : -1, x = M.evidence(H, 0, M.increments(R, n, dt), dt), wv = M.innovation(x, dt);
    const end = wv[n], inc = wv[n] - wv[n / 2], th = Math.tanh(x[n / 2]);
    s1 += end; s2 += end * end; a += inc; b += th; ab += inc * th; aa += inc * inc; bb += th * th;
  }
  const v = s2 / K - (s1 / K) ** 2, vSE = v * Math.sqrt(2 / (K - 1));
  check("drift", `the innovation computed from sampled evidence has variance T = ${T} at time ${T} within 3 standard errors (40,000 trials, steps of 0.01)`, Math.abs(v - T) < 3 * vSE, `${v.toFixed(4)} ± ${vSE.toFixed(4)}`);
  const cov = ab / K - (a / K) * (b / K), r = cov / (Math.sqrt(aa / K - (a / K) ** 2) * Math.sqrt(bb / K - (b / K) ** 2));
  check("drift", "its increment from time 1 to 2 is uncorrelated with tanh X at time 1, within 3 standard errors", Math.abs(r) < 3 / Math.sqrt(K), `${r.toFixed(4)} ± ${(1 / Math.sqrt(K)).toFixed(4)}`);
  // the plate's own run: its seed, 4,000 trials, its code; the sentence says what those numbers say
  const run = M.innovationRun(2, 0.01, 40), R2 = rng(2026 + 211);
  run.add(R2, 4000);
  const o = run.summary(), sv = S.innovationSay(run.T, o.v, o.vSE, o.r, o.rSE);
  check("drift", "the plate's own 4,000 trials: the innovation's variance at time 2 within 3 standard errors of 2, and its later increment's correlation with tanh X_1 within 3 of 0", Math.abs(o.v - 2) < 3 * o.vSE && Math.abs(o.r) < 3 * o.rSE, `${o.v.toFixed(4)} ± ${o.vSE.toFixed(4)}, ${o.r.toFixed(4)} ± ${o.rSE.toFixed(4)}`);
  check("words", "the innovation sentence prints the plate's own variance, two standard errors, and correlation", sv.includes(`variance ${o.v.toFixed(3)} ± ${(2 * o.vSE).toFixed(3)}, against 2`) && sv.includes(`correlation ${o.r.toFixed(3)} ± ${(2 * o.rSE).toFixed(3)}`) && sv.includes("from time 1 to 2"), sv);
}

// ---- the fold ---------------------------------------------------------------------------------------------------
{
  // the drift of Y measured over h, in closed form from the mixture, against Euler runs of the filtered diffusion
  for (const [y, h] of [[0.6, 0.3], [0, 0.1], [1.2, 0.5]]) {
    const R = rng(311 + Math.round(y * 10)), dt = 0.0005, n = Math.round(h / dt), K = 40000, ys = new Float64Array(K);
    for (let k = 0; k < K; k++) { let x = y; for (let i = 0; i < n; i++) x += Math.tanh(x) * dt + Math.sqrt(dt) * R.normal(); ys[k] = (Math.abs(x) - y) / h; }
    const { m, se } = meanSE(ys);
    check("fold", `y = ${y}, h = ${h}: Euler runs of dX = tanh X dt + dW from y give (E|X_h| - y)/h as the mixture's closed form, within 3 standard errors`, Math.abs(m - M.foldDrift(y, h)) < 3 * se, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${M.foldDrift(y, h).toFixed(4)}`);
  }
  // E_y X_h = y + h tanh y exactly, and |X_h| differs from X_h only if X reaches 0, which is exponentially unlikely
  // for small h: so away from 0 the measured drift is tanh y up to that chance
  let ok = true, det = [];
  for (const y of [0.5, 1, 2]) {
    const e = [0.3, 0.1, 0.01, 0.001].map((h) => Math.abs(M.foldDrift(y, h) - Math.tanh(y)));
    det.push(`${y}: ${e.map((v) => v.toExponential(1)).join(", ")}`);
    ok = ok && e[0] > e[1] && (e[1] > e[2] || e[2] < 1e-10) && e[3] < 1e-10;
  }
  check("fold", "away from 0, the measured drift closes on tanh y as h shrinks, to rounding by h = 0.001 (errors at h = 0.3, 0.1, 0.01, 0.001)", ok, det.join("; "));
  const mix = [0.2, 0.9].map((y) => Math.abs(M.g(y) * (y + 0.3) + (1 - M.g(y)) * (y - 0.3) - (y + 0.3 * Math.tanh(y))));
  check("fold", "from the decision maker's view, E_y X_h = y + h tanh y exactly (the mixture's mean, h = 0.3)", Math.max(...mix) < 1e-15, `${Math.max(...mix).toExponential(1)}`);
  const r = [1e-2, 1e-4, 1e-6].map((h) => M.foldDrift(0, h) * Math.sqrt(h) / Math.sqrt(2 / Math.PI));
  check("fold", "at y = 0 it grows like sqrt(2/(pi h)): the ratio tends to 1", Math.abs(r[2] - 1) < 2e-3 && Math.abs(r[2] - 1) < Math.abs(r[0] - 1), r.map((v) => v.toFixed(5)).join(", "));
  // tanh is odd, so the drift of |X| is tanh|X| on both sides
  check("fold", "sign(x) tanh(x) = tanh|x|, so Y drifts away from 0 on both sides", [-2, -0.3, 0.4, 1.7].every((x) => Math.abs(Math.sign(x) * Math.tanh(x) - Math.tanh(Math.abs(x))) < 1e-15), "four points");
  // Tanaka on the grid: the local time is nondecreasing, grows only on sign changes, and closes the identity
  const dt = 0.001, x = M.filtered(0, M.increments(rng(2026 + 335), 2000, dt), dt), l = M.tanaka(x);
  let mono = true, only = true, resid = 0, sum = 0;
  for (let i = 0; i < x.length - 1; i++) {
    const d = l[i + 1] - l[i];
    if (d < -1e-15) mono = false;
    if (d > 1e-15 && Math.sign(x[i + 1]) === Math.sign(x[i])) only = false;
    sum += Math.sign(x[i]) * (x[i + 1] - x[i]);
    resid = Math.max(resid, Math.abs(Math.abs(x[i + 1]) - Math.abs(x[0]) - sum - l[i + 1]));
  }
  check("fold", "the plate's local time is nondecreasing and grows only on a step where X changes sign", mono && only, `ℓ at the end ${l[l.length - 1].toFixed(4)}`);
  check("fold", "and Tanaka's identity |X_t| = |X_0| + sum sign(X) dX + ℓ_t holds on the grid", resid < 1e-12, `largest residual ${resid.toExponential(1)}`);
}

// ---- the three facts ----------------------------------------------------------------------------------------------
{
  const ys = Array.from({ length: 601 }, (_, i) => -3 + i * 0.01);
  const w1 = Math.max(...ys.map((y) => Math.abs(M.g(y) * (1 - M.g(y)) - 1 / (4 * Math.cosh(y) ** 2)) * 4 * Math.cosh(y) ** 2));
  check("facts", "g(1 - g) = 1/(4 cosh^2 y) at 601 points from -3 to 3 (relative, within 1e-12)", w1 < 1e-12, `${w1.toExponential(1)}`);
  const w2 = Math.max(...ys.map((y) => Math.abs((M.g(y + 1e-5) - M.g(y - 1e-5)) / 2e-5 - M.g1(y))));
  check("facts", "g'(y) = 1/(2 cosh^2 y) against central difference quotients of step 1e-5 (within 1e-9)", w2 < 1e-9, `${w2.toExponential(1)}`);
  const w2b = Math.max(...ys.map((y) => Math.abs((M.g1(y + 1e-5) - M.g1(y - 1e-5)) / 2e-5 - M.g2(y))));
  check("facts", "g''(y) = -tanh(y)/cosh^2 y against difference quotients of g' (within 1e-9)", w2b < 1e-9, `${w2b.toExponential(1)}`);
  const w2c = Math.max(...ys.map((y) => Math.abs(M.g1(y) - 2 * M.g(y) * (1 - M.g(y)))));
  check("facts", "g' = 2 g (1 - g) (within 1e-15)", w2c < 1e-15, `${w2c.toExponential(1)}`);
  const h = 1e-4;
  const w3 = Math.max(...ys.filter((y) => y > 0).map((y) => Math.abs(0.5 * (M.g(y + h) - 2 * M.g(y) + M.g(y - h)) / (h * h) + Math.tanh(y) * (M.g(y + h) - M.g(y - h)) / (2 * h))));
  check("facts", "L g = 0 for y > 0, from second and first differences of g alone (step 1e-4, within 1e-6)", w3 < 1e-6, `${w3.toExponential(1)}`);
  const w3b = Math.max(...ys.map((y) => Math.abs(M.Lop(y, M.g1(y), M.g2(y)))));
  check("facts", "L g = 0 from the closed forms (within 1e-16)", w3b < 1e-16, `${w3b.toExponential(1)}`);
  for (const q of M.TESTS) {
    const yy = Array.from({ length: 251 }, (_, i) => i * 0.01);
    const P = (y) => Math.cosh(y) ** 2 * q.f1(y), hh = 1e-4;
    const lhs = yy.map((y) => (P(y + hh) - P(y - hh)) / (2 * hh)), rhs = yy.map((y) => 2 * Math.cosh(y) ** 2 * M.Lop(y, q.f1(y), q.f2(y)));
    // relative to the sides' size, or absolute where both are below 1 (for f = g both sides are 0)
    const scale = Math.max(1, ...rhs.map(Math.abs)), worst = Math.max(...lhs.map((v, k) => Math.abs(v - rhs[k]))) / scale;
    check("facts", `(cosh^2 y f')' = 2 cosh^2 y L f for f = ${q.label}, by difference quotients on [0, 2.5] (within 1e-6, relative where the sides exceed 1)`, worst < 1e-6, `${worst.toExponential(1)}`);
    const d1 = Math.max(...yy.slice(1, -1).map((y) => Math.abs((q.f(y + 1e-5) - q.f(y - 1e-5)) / 2e-5 - q.f1(y))));
    check("facts", `the test function ${q.label}: its stated derivative against difference quotients (within 1e-8)`, d1 < 1e-8, `${d1.toExponential(1)}`);
  }
  // the mean time to reach b: L m = -1, m'(0) = 0, m(b) = 0
  for (const c of [0.03, 0.1, 0.3]) {
    const b = B(c), m = (y) => M.meanHit(y, b), hh = 1e-4;
    const res = Math.max(...[0.1, 0.3, 0.6, 0.9].map((u) => u * b).map((y) => Math.abs(0.5 * (m(y + hh) - 2 * m(y) + m(y - hh)) / (hh * hh) + Math.tanh(y) * (m(y + hh) - m(y - hh)) / (2 * hh) + 1)));
    check("facts", `c = ${c}: m(y) = b tanh b - y tanh y solves L m = -1 below b = B(c) (within 1e-5), with m'(0) = 0 and m(b) = 0`, res < 1e-5 && Math.abs((m(hh) - m(-hh)) / (2 * hh)) < 1e-12 && Math.abs(m(b)) < 1e-15, `largest residual ${res.toExponential(1)}`);
  }
  check("facts", "DecisionTimeTenth: b tanh b at the flat bound for c = 0.1", asPrinted(M.meanHit(0, B(0.1)), N.DecisionTimeTenth), `${M.meanHit(0, B(0.1)).toFixed(4)} vs ${N.DecisionTimeTenth}`);
  check("facts", "BoundTenth: the flat bound at c = 0.1", asPrinted(B(0.1), N.BoundTenth), `${B(0.1).toFixed(4)} vs ${N.BoundTenth}`);
}
{
  // sampled hitting times, as the plate runs them (steps of 0.0025, the bound moved in by 0.5826 sqrt(dt)), but more
  const c = 0.1, b = B(c);
  for (const y of [0, 0.5 * b]) {
    const R = rng(4001 + Math.round(y * 100)), ts = [];
    for (let k = 0; k < 20000; k++) ts.push(decide(y, b, R).t);
    const { m, se } = meanSE(ts);
    check("exit", `c = 0.1, y = ${y.toFixed(3)}: sampled times to reach b average b tanh b - y tanh y within 3 standard errors (20,000 runs, steps of 0.0025)`, Math.abs(m - M.meanHit(y, b)) < 3 * se, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${M.meanHit(y, b).toFixed(4)}`);
  }
}

// ---- the coupling -------------------------------------------------------------------------------------------------
{
  const dt = 0.002, n = 1500, R = rng(6001);
  let crossed = 0, crossedInd = 0, meetOK = 0, merged = 0, lOrdered = 0, lOrderedInd = 0;
  const firstMeet = (a, b) => { for (let i = 0; i <= n; i++) if (Math.abs(a[i] - b[i]) < 1e-12) return i; return -1; };
  const firstZero = (a) => { for (let i = 0; i <= n; i++) if (a[i] === 0) return i; return -1; };
  for (let k = 0; k < 1000; k++) {
    const dB = M.increments(R, n, dt), dB2 = M.increments(R, n, dt);
    const a = M.reflected(0.3, dB, dt), b = M.reflected(1.0, dB, dt), c = M.reflected(1.0, dB2, dt);
    let cr = false, crI = false;
    for (let i = 0; i <= n; i++) { if (b.y[i] < a.y[i] - 1e-12) cr = true; if (c.y[i] < a.y[i] - 1e-12) crI = true; }
    if (cr) crossed++; if (crI) crossedInd++;
    const mt = firstMeet(a.y, b.y), z = firstZero(b.y);
    if (mt >= 0) merged++;
    if (mt === z) meetOK++;
    if (a.l[n] >= b.l[n] - 1e-12) lOrdered++;
    if (a.l[n] >= c.l[n] - 1e-12) lOrderedInd++;
  }
  check("couple", "1,000 pairs from 0.3 and 1.0 on shared noise: none crosses", crossed === 0, `${crossed} crossed`);
  check("couple", "in every pair, the paths first meet when the upper one first reaches 0 (or neither happens)", meetOK === 1000, `${meetOK} of 1000; ${merged} met by time 3`);
  check("couple", "in every pair, the lower start collects at least as much local time", lOrdered === 1000, `${lOrdered} of 1000`);
  check("couple", "with independent noise, the same starts do cross, and the local times are not always ordered", crossedInd > 100 && lOrderedInd < 1000, `${crossedInd} of 1000 crossed; ${lOrderedInd} ordered`);
  // the scheme is Skorokhod's map on the grid: max(0, Y + tanh(Y) dt + dB) equals U + sup(-U)^+
  const dB = M.increments(rng(6002), n, dt), r = M.reflected(0.3, dB, dt);
  let w = 0, y = 0.3;
  for (let i = 0; i < n; i++) { y = Math.max(0, y + Math.tanh(y) * dt + dB[i]); w = Math.max(w, Math.abs(y - r.y[i + 1])); }
  const sk = M.skorokhod(r.u);
  check("couple", "the plate's reflection max(0, Y + tanh(Y) dt + dB) is Skorokhod's map U + sup(-U)^+ on the grid", w < 1e-12 && M.supDist(sk, r.y) < 1e-12, `${w.toExponential(1)}, ${M.supDist(sk, r.y).toExponential(1)}`);
  // Picard iterates: converge to the scheme's solution within the bound (2T)^n/n! times the first distance
  const it = M.picard(0.3, dB, dt, 30), T = n * dt;
  const d = it.map((p) => M.supDist(p, r.y));
  let fact = 1, within = true;
  for (let k = 1; k <= 30; k++) { fact *= k; if (d[k] > d[0] * (2 * T) ** k / fact + 1e-13) within = false; }
  check("couple", "Picard iterates close on the solution within (2T)^n/n! times the starting distance, and reach it to 1e-12", within && d[30] < 1e-12, `after 1, 2, 4, 8: ${[1, 2, 4, 8].map((k) => d[k].toExponential(1)).join(", ")}`);
  const it2 = M.picard(0.3, dB, dt, 1)[1], u = new Float64Array(n + 1); u[0] = 0.3; for (let i = 0; i < n; i++) u[i + 1] = u[i] + Math.tanh(0.3) * dt + dB[i];
  check("couple", "the first Picard iterate is the reflection of 0.3 + tanh(0.3) t + B", M.supDist(it2, M.skorokhod(u)) < 1e-15, "exact");
}

// ---- the sentences ------------------------------------------------------------------------------------------------
{
  const R = rng(13);
  let bad = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const u = () => R.next();
    const out = [
      S.heroLabel(i % 4), S.unitsSay(0.5 + 1.5 * u(), 0.5 + 1.5 * u()), S.palmerVerdict([null, "fifty", "half", "five"][i % 4], 553.6),
      S.yoursSay({ label: "Cost jumps", unitMs: i % 2 ? null : 553.6 * (1 + u()), view: 2.5, b0: 2 * u(), b1: 2 * u(), deadline: i % 3 ? null : 1, g: M.g }),
      S.costUnitNote(i % 2 ? null : 553.6 * (1 + u()), [0.032, 0.064, 0.128, 0.256][i % 4]),
      S.gVerdict([null, 0.731, 0.841, 0.881, 0.982][i % 5], M.g(1)), S.ratioSay([0.25, 1, 3][i % 3], Math.exp(2)),
      S.barSay([0.25, 1, 3][i % 3], i % 7 ? Math.floor(u() * 400) + 1 : 0, Math.floor(u() * 50), 0.875, 1.125),
      S.binSay(1, 6000, 1 + (i % 21), 4 * u(), i % 2 ? "share" : "expected drift"), S.innovationSay(2, 2 * u() + 1, u() * 0.1, u() - 0.5, 0.0158),
      S.foldVerdict([null, "toward", "away", "none"][i % 4]), S.foldSay([0.3, 0.1, 0.01, 0.001][i % 4], 10 * u(), u(), u() * 0.01), S.pathSay(2, i % 5, u(), 2000),
      S.factSay(i % 4, u() * 1e-6, { label: "y²" }), S.exitSay(0.1, B(0.1), 1.17, 1.1 + 0.1 * u(), 0.02 * u(), i % 3 ? 400 : 0),
      S.coupleVerdict([null, "cross", "never", "meet"][i % 4]), S.skorokhodSay(Math.floor(u() * 100), 1500), S.picardSay([u(), u() * 0.1, u() * 1e-3, u() * 1e-8]),
      S.pairSay(i % 2 === 0, i % 3 ? 2 * u() : null, Math.floor(u() * 4)), S.pairsSay(i % 2 === 0, 1000, Math.floor(u() * 400), Math.floor(u() * 1000)),
      S.localSay(i % 2 === 0, 1000, Math.floor(u() * 1000), u(), u()),
      S.progressSay(i % 2 ? "pairs" : "trials", Math.floor(u() * 1000), 1000),
      ...S.BELIEF_HEADS, ...S.FACT_HEADS, ...S.COUPLE_HEADS,
    ];
    for (const s of out) { n++; if (typeof s !== "string" || /NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const pv = S.palmerVerdict("half", 1000 * M.unitSeconds(0.064));
  check("words", "the Palmer verdict says right for half a second and prints the page's 554 ms", /^Right/.test(pv) && new RegExp(`, ${N.PalmerT} ms\\.$`).test(pv) && /^Longer/.test(S.palmerVerdict("fifty", 553.6)) && /^Shorter/.test(S.palmerVerdict("five", 553.6)), pv);
  const gv = S.gVerdict(+M.g(1).toFixed(3), M.g(1));
  check("words", "the g(1) verdict says right for 0.881, names the factor of 2 for 0.73 and Phi(1) for 0.84, and gives the odds e^2", /^Right/.test(gv) && /0\.881/.test(gv) && /7\.4 times/.test(gv) && /log odds to be x/.test(S.gVerdict(0.731, M.g(1))) && /Φ\(1\)/.test(S.gVerdict(0.841, M.g(1))) && /^Too sure/.test(S.gVerdict(0.982, M.g(1))), gv);
  check("words", "the ratio sentence prints e^2 = 7.39", /7\.39 times/.test(S.ratioSay(1, Math.exp(2))) && /e² = 7\.39/.test(S.ratioSay(1, Math.exp(2))), S.ratioSay(1, Math.exp(2)));
  // the belief plate's own trials at t = 1 (its default seed), bins, and largest misses, through its code
  const tr = M.trials(rng(2026 + 101 + 100), 1, 6000, 1), bns = M.bins(tr, -2.625, 2.625, 0.25);
  const share = M.largestMiss(bns, 1, "share"), mean = M.largestMiss(bns, 1, "mean");
  let hand = 0;
  for (const b of bns) if (b.n >= 20) { const p = M.binShare(b.a, b.b, 1); hand = Math.max(hand, Math.abs(b.share - p) / Math.sqrt((p * (1 - p)) / b.n)); }
  const bs = S.binSay(1, 6000, share.k, share.z, "share"), bm = S.binSay(1, 6000, mean.k, mean.z, "expected drift");
  check("belief", "the share's largest miss is measured in the binomial standard error of each bin's exact share, over the bins with at least 20 trials", Math.abs(share.z - hand) < 1e-12 && share.k === bns.filter((b) => b.n >= 20).length, `${share.z.toFixed(3)} over ${share.k} bins`);
  check("words", "the bin sentences print the plate's own largest misses, name the standard error each uses, and attach no probability to them", bs.includes(`${share.k} bins with at least 20 trials is ${share.z.toFixed(1)} binomial standard errors of the bin's exact share`) && bm.includes(`is ${mean.z.toFixed(1)} standard errors of the bin's sample mean`) && !/%|chance/.test(bs + bm), bs);
  const ys = S.yoursSay({ label: "Deadline", unitMs: 553.6, view: 1, b0: 0.97, b1: 0, deadline: 1, g: M.g });
  check("words", "the schedule sentence: a window of 1 time unit in ms, the bound read as the chance right at that evidence, and at a deadline every open trial stopping at its evidence x, right with probability g(|x|)", /window is 1 time unit, 554 ms/.test(ys) && /made at that evidence is right with probability 0\.87/.test(ys) && /stops with the evidence x it has and is right with probability g\(\|x\|\)/.test(ys) && !/coin flip/.test(ys), ys);
  check("words", "the cost note converts per time unit to per second at 6.4% coherence", /a cost of c per time unit is 1\.81c per second/.test(S.costUnitNote(1000 * M.unitSeconds(0.064), 0.064)), S.costUnitNote(1000 * M.unitSeconds(0.064), 0.064));
  const fs = S.foldSay(0.01, M.foldDrift(0, 0.01), M.foldDrift(1, 0.01), 0.0002);
  check("words", "the fold sentence prints the measured drift at 1 beside tanh 1 and the value at 0", /0\.762, against tanh 1 = 0\.762/.test(fs) && /At y = 0, it is 8\.02/.test(fs), fs);
  check("words", "the exit sentence prints b tanh b at c = 0.1 as the paper does", S.exitSay(0.1, B(0.1), M.meanHit(0, B(0.1)), 1.17, 0.02, 0).includes(`b tanh b = ${M.meanHit(0, B(0.1)).toFixed(3)}`) && M.meanHit(0, B(0.1)).toFixed(2) === N.DecisionTimeTenth, S.exitSay(0.1, B(0.1), M.meanHit(0, B(0.1)), 1.17, 0.02, 0));
  check("words", "the pair sentences: met at the upper path's first zero, none crossed on shared noise", /meet at time 1\.25, when the upper one first reaches 0/.test(S.pairSay(true, 1.25, 0)) && /0 crossed/.test(S.pairsSay(true, 1000, 0, 640)), S.pairSay(true, 1.25, 0));
}

// ---- the schedule plate, through the page's own worker --------------------------------------------------------------
{
  const ask = (choice) => runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
  const say = (choice, m) => S.yoursSay({ label: "x", unitMs: null, view: deadlineOf(choice) ?? VIEW, b0: m.exact[0], b1: m.exact[m.exact.length - 1], deadline: deadlineOf(choice), g: M.g });
  // a 32-fold rise centered at 0.2: the cost at the window's end is 3.2, where the program waits at the center
  const rise = { id: "jump", params: { at: 0.2, factor: 32 } }, mr = await ask(rise), b1 = mr.exact[mr.exact.length - 1];
  const sr = say(rise, mr);
  check("yours", "a 32-fold rise at 0.2: the bound at the window's end is above 0 and below the grid's first step, where the program waits at the center", b1 > 0 && b1 < 0.02 && Math.abs(costOf(rise)(VIEW) - 3.2) < 1e-6, `bound ${b1.toFixed(5)} at cost ${costOf(rise)(VIEW).toFixed(4)}`);
  check("words", "and the plate prints that bound to three decimals and says it is below the grid's first step", sr.includes(`the bound is ${b1.toFixed(3)}`) && /below the grid's first evidence step, 0\.02/.test(sr) && S.boundText(b1) === b1.toFixed(3) && /below the grid's first step/.test(S.boundNote(b1, M.g)), sr);
  // a deadline: the worker ends on the forced choice; the rule's curve holds its value to the deadline and drops there
  const dl = { id: "deadline", params: { at: 1, c: 0.1 } }, md = await ask(dl);
  const [tp, pmp] = dropAt(md.t, md.pm, md.deadline), n = tp.length;
  check("yours", "a deadline at 1: the dashed curve holds the per-moment bound up to the forced choice and drops to 0 there", tp[n - 1] === 1 && tp[n - 2] === 1 && pmp[n - 1] === 0 && pmp[n - 2] === md.pm[md.pm.length - 2] && pmp[n - 2] > 1, `holds ${pmp[n - 2].toFixed(3)} to time 1, then 0`);
  const sd = say(dl, md);
  check("words", "at a deadline, the sentence says the choice is forced and each open trial is right with probability g(|x|) at its evidence, not a coin flip", /the choice is forced/.test(sd) && /g\(\|x\|\)/.test(sd) && !/coin flip/.test(sd) && /up to the forced choice at time 1/.test(S.yoursState(1)) && /6 time units past the window/.test(S.yoursState(null)), sd);
  // the default schedule: the readings print the worker's first bound and its belief
  const jm = await ask({ id: "jump", params: { at: 0.5, factor: 16 } }), sj = say({ id: "jump" }, jm);
  check("words", "on the default schedule, the sentence prints the worker's starting bound and g of it", sj.includes(`starts at ${jm.exact[0].toFixed(2)}`) && sj.includes(`right with probability ${M.g(jm.exact[0]).toFixed(2)}`), sj);
}

// ---- the fold plate's grid rule, and the facts plate's readings -------------------------------------------------------
{
  const dt = 0.001, x = M.filtered(0, M.increments(rng(2026 + 335), 2000, dt), dt), l = M.tanaka(x);
  let grew = 0; for (let i = 0; i < x.length - 1; i++) if (l[i + 1] - l[i] > 1e-15) grew++;
  check("fold", "from X_0 = 0, the grid's first step adds |X_1| to the local time, and the sign count includes that step", Math.abs(l[1] - Math.abs(x[1])) < 1e-15 && M.signSteps(x) >= grew && Math.sign(x[0]) === 0, `${M.signSteps(x)} sign steps, ℓ grew on ${grew}`);
  check("words", "the path sentence names the grid rule: sign changes on the grid, counting a step away from 0", /counting a step away from 0/.test(S.pathSay(2, M.signSteps(x), l[l.length - 1], 2000)) && S.pathSay(2, M.signSteps(x), l[l.length - 1], 2000).includes(`${M.signSteps(x)} of the 2,000 steps`), S.pathSay(2, M.signSteps(x), l[l.length - 1], 2000));
  const f3 = S.factSay(3, 7.9e-9, { label: "sin 2y" }), fg = S.factSay(3, 2.8e-13, { label: "g(y)", zero: true });
  check("words", "the identity's reading is named as one normalized maximum, and absolute for f = g; step 3 reads over y from 0 to 3", /divided by the largest size of the right side, is 7\.9e-9/.test(f3) && /in absolute terms/.test(fg) && S.factNote(3, false).includes("largest |2 cosh² y·𝓛f|") && /from 0 to 3/.test(S.factSay(2, 1e-17)) && S.factNote(2) === "over 301 points", f3);
  const ys = Array.from({ length: 301 }, (_, i) => i * 0.01);
  check("facts", "the generator's expression applied to g vanishes at the 301 points from 0 to 3 the plate draws (within 1e-16)", Math.max(...ys.map((y) => Math.abs(M.Lop(y, M.g1(y), M.g2(y))))) < 1e-16, "closed forms");
  const words = [S.heroLabel(2), S.unitsSay(1, 1), S.palmerVerdict(null, 553.6), S.foldVerdict(null), S.coupleVerdict(null), S.pairSay(true, null, 0), S.pairSay(false, null, 2)];
  check("words", "introductory phrases take their commas, and the fold's drift tanh Y is said to hold in the decision maker's view", /in the decision maker's view drifts away from 0 at rate tanh Y/.test(words[0]) && /In those units, the path/.test(words[1]) && /At 6\.4% coherence, the drift/.test(words[2]) && /In the decision maker's view, away from 0/.test(words[3]) && /On the same noise, they/.test(words[4]) && /On this noise path, the two/.test(words[5]) && /With independent noise, they/.test(words[6]), words[0]);
  let bad = 0;
  for (const b of [0, 0.005, 0.0199, 0.02, 0.5, 1.9]) for (const d of [null, 1]) for (const s of [S.boundText(b), S.boundNote(b, M.g), S.yoursState(d), S.factNote(b > 1 ? 3 : 2, b === 0), S.yoursSay({ label: "Pulse", unitMs: d ? 553.6 : null, view: d ?? 2.5, b0: 1, b1: b, deadline: d, g: M.g })]) if (/NaN|undefined|Infinity|null/.test(s)) bad++;
  check("words", "the new readings and notes never print NaN, undefined, Infinity, or null", bad === 0, `${bad} bad`);
}

// ---- round 3: a zero bound without a deadline, a bound that rounds to 0, the dashed curve's terminal value, and the
// speed density's normalization ---------------------------------------------------------------------------------------
{
  const ask = (choice) => runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
  const end = (m) => m.exact[m.exact.length - 1];
  const sayFor = (choice, m) => S.yoursSay({ label: "Rising", unitMs: null, view: VIEW, b0: m.exact[0], b1: end(m), deadline: deadlineOf(choice), g: M.g });
  // Rising from 0 at rate 2: the cost at 2.5 is 5.1, and the program stops at the center too
  const r0 = { id: "rising", params: { at: 0, rate: 2 } }, m0 = await ask(r0), s0 = sayFor(r0, m0);
  check("yours", "Rising from 0 at rate 2: the worker's bound at the window's end is exactly 0 (the program stops at the center), with no deadline", end(m0) === 0 && deadlineOf(r0) === null && Math.abs(costOf(r0)(VIEW) - 5.1) < 1e-12, `bound ${end(m0)}, cost ${costOf(r0)(VIEW)}`);
  check("words", "there, the sentence says the program stops at once at every evidence level, and neither that it waits at the center nor that the choice is forced", /bound is 0, though there is no deadline: the program stops at once at every evidence level, the center included/.test(s0) && !/waits at the center/.test(s0) && !/forced/.test(s0) && S.boundNote(end(m0), M.g) === "the program stops at once, at 0 too", s0);
  // Rising from 0.6 at rate 2: a positive bound below the first step, where the center waits
  const r6 = { id: "rising", params: { at: 0.6, rate: 2 } }, m6 = await ask(r6), s6 = sayFor(r6, m6);
  check("yours", "Rising from 0.6 at rate 2: the worker's bound at the window's end is above 0 and below the grid's first step", end(m6) > 0 && end(m6) < 0.02, `bound ${end(m6).toFixed(6)}`);
  check("words", "there, the sentence says the program still waits at the center and stops at the first step, and prints the bound", /still waits at the center and stops at the first step/.test(s6) && s6.includes(`the bound is ${S.boundText(end(m6))}`) && !/stops at once/.test(s6), s6);
  // Rising from 0 at rate 2, at time 1.93: a positive bound too small for three decimals prints as < 0.001, not 0
  // (the worker sends every second step, so read the same program at 1.93 directly, as the worker runs it)
  const { exactPolicy } = await import("../../book/assets/js/model.js"), { SPARE } = await import("../../book/assets/js/schedules-book.js");
  const full = exactPolicy(costOf(r0), VIEW + SPARE), k = full.ts.findIndex((t) => Math.abs(t - 1.93) < 1e-9), tiny = full.bounds[k];
  check("yours", "the same program, read at the worker's own times, agrees with the worker's reply (Rising from 0 at rate 2)", m0.t.every((t, i) => Math.abs(full.bounds[Math.round(t / 0.01)] - m0.exact[i]) < 1e-12), `${m0.t.length} times`);
  check("words", "a positive bound below 0.0005 (Rising from 0 at rate 2, time 1.93) prints as < 0.001, never as 0", tiny > 0 && tiny < 0.0005 && S.boundText(tiny) === "< 0.001" && S.boundText(0) === "0.00", `bound ${tiny} prints ${S.boundText(tiny)}`);
  // a deadline at 0.45: the dashed curve is the shifted formula at every time before the deadline; at it the formula is
  // finite, and the worker sends 0 for both curves
  const d = { id: "deadline", params: { at: 0.45, c: 0.1 } }, md = await ask(d), n = md.pm.length;
  const { boundForCost: Bc } = await import("../../book/assets/js/model.js"), formula = (t) => Math.max(Bc(costOf(d)(t)) - 0.5826 * Math.sqrt(0.01), 0);
  let off = 0; for (let i = 0; i < n - 1; i++) off = Math.max(off, Math.abs(md.pm[i] - formula(md.t[i])));
  const before = n === 24 && md.t.slice(0, n - 1).every((t, i) => Math.abs(t - 0.02 * i) < 1e-9 && t < 0.45);
  check("yours", "a deadline at 0.45: at each of the 23 plotted times before it (every 0.02 from 0 to 0.44), the dashed value is the shifted formula; at 0.45 the formula is still finite, and both the dashed and the best bound are the worker's terminal 0, the forced choice",
    before && off < 1e-9 && formula(0.45) > 1 && md.pm[n - 1] === 0 && md.exact[n - 1] === 0 && md.t[n - 1] === 0.45 && md.pm.length === md.exact.length,
    `${n - 1} times before the deadline, largest difference ${off.toExponential(1)}; formula at 0.45 ${formula(0.45).toFixed(6)}; terminal ${md.pm[n - 1]} and ${md.exact[n - 1]}`);
  const text = (await import("node:fs")).readFileSync(new URL("../../book/content/ch02.py", import.meta.url), "utf8");
  check("words", "the schedule caption names the shifted formula, its finite value at the deadline, the substituted 0, and the zero bound without a deadline", /B\(c\(t\)\) - 0\.5826\\sqrt\{0\.01\}/.test(text) && /the formula still has its finite value/.test(text) && /the display substitutes 0 for both curves/.test(text) && /every trial stops at once, with or without a deadline/.test(text), "caption of #plate-yours");
  // the speed density: s' = exp(-int 2 tanh) = sech^2 y, m = 2/s' = 2 cosh^2 y, twice the weight, and (f'/s')' = m L f
  let w = 0;
  for (const y of [0.3, 1, 2.2]) {
    const sp = Math.exp(-simpson((u) => 2 * Math.tanh(u), 0, y, 2000)), m = 2 / sp;
    w = Math.max(w, Math.abs(sp * Math.cosh(y) ** 2 - 1), Math.abs(m / Math.cosh(y) ** 2 - 2));
    const q = M.TESTS[1], h = 1e-4, P = (v) => q.f1(v) * Math.cosh(v) ** 2;   // f'/s' with s' = sech^2
    w = Math.max(w, Math.abs((P(y + h) - P(y - h)) / (2 * h) - m * M.Lop(y, q.f1(y), q.f2(y))) / Math.max(1, Math.abs(m * M.Lop(y, q.f1(y), q.f2(y)))));
  }
  check("facts", "the scale density exp(-int 2 tanh) is sech^2 y, the speed density m = 2/s' is 2 cosh^2 y, twice the weight, and (f'/s')' = m L f (within 1e-7)", w < 1e-7, `largest difference ${w.toExponential(1)}`);
  check("words", "the text calls cosh^2 y half the speed density, as the paper's remark does", /\$\\cosh\^2 y\$ is half the speed density of \$Y\$, \$m = 2\\cosh\^2 y\$/.test(text) && !/the same weight as the speed density/.test(text), "fold section");
}
