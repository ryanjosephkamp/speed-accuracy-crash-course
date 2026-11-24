// Chapter 5: the exact equation on the page's grids against the paper's own test (tests/test_exact_equation.py at
// the tag: its grid, schedules, times, and tolerances), the page's dynamic program against model.js's, the envelope
// identity and the regularity facts on the plates' grid, the band's Hölder constant, the remark's closed forms, the
// numbers the text quotes, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy } from "../../book/assets/js/model.js";
import { costOf, PRESETS, defaultDrawing, VIEW } from "../../book/assets/js/schedules-book.js";
import { solveSchedule, frozenRule, costRange, leftSide, belief, gPrime, B, F, testStep, FIXED, OVERSHOOT } from "../../book/assets/js/ch05-model.js";
import * as S from "../../book/assets/js/say-ch05.js";
import { check, N, asPrinted } from "./lib.mjs";

const presetChoice = (id) => ({ id, params: Object.fromEntries(PRESETS.find((p) => p.id === id).params.map((q) => [q.id, q.value])) });
const worstIn = (out, upto) => { let w = 0, at = 0; out.ts.forEach((t, i) => { if (t <= upto + 1e-9 && Number.isFinite(out.lhs[i]) && Math.abs(out.lhs[i] - 0.25) > w) { w = Math.abs(out.lhs[i] - 0.25); at = t; } }); return { w, at }; };

// ---- the numbers the text quotes ---------------------------------------------------------------------------
check("speed", "BoundTenth: B(0.1), the root of sinh 2b + 2b = 10", asPrinted(B(0.1), N.BoundTenth), `${B(0.1).toFixed(4)} vs ${N.BoundTenth}`);
check("speed", "LookAheadTenth: the mean decision time from the normalized speed measure at 0.1", asPrinted(K.meanLookAhead(0.1), N.LookAheadTenth), `${K.meanLookAhead(0.1).toFixed(4)} vs ${N.LookAheadTenth}`);
check("speed", "DecisionTimeTenth: b tanh b at 0.1", asPrinted(K.meanDecisionTime(0.1), N.DecisionTimeTenth), `${K.meanDecisionTime(0.1).toFixed(4)} vs ${N.DecisionTimeTenth}`);
for (const c of [0.01, 0.1, 1]) {
  check("exact", `for a constant cost ${c}, c (b/2 + sinh 2b / 4) = 1/4 at b = B(c)`, Math.abs(c * F(B(c)) - 0.25) < 1e-12, `${(c * F(B(c))).toFixed(14)}`);
}

// ---- the page's dynamic program is model.js's ----------------------------------------------------------------
// Same grid, same steps, same bound; ch05-model.js keeps only x >= 0 and stops working out the value past
// B(c_min) + 1, which changes no bound (to 1e-9).
for (const [name, cost] of [["Figure 1(a)'s jump", costOf(presetChoice("jump"))], ["the paper's test step", testStep]]) {
  const ref = exactPolicy(cost, 8.5, 0.01, 0.02, 5);
  const mine = solveSchedule(cost, 8.5, { dt: 0.01, h: 0.02, lhsUpto: 0 });
  let d = 0;
  for (let k = 0; k < ref.bounds.length - 1; k++) d = Math.max(d, Math.abs(ref.bounds[k] - mine.bounds[k]));
  check("grid", `the chapter's program gives model.js's bounds for ${name} (Δt 0.01, h 0.02, to 1e-9)`, d < 1e-9, `largest difference ${d.toExponential(1)}`);
}

// ---- the paper's own test, on its grid -------------------------------------------------------------------------
// tests/test_exact_equation.py at paper-v1.2: backward_induction_x with dt = 0.002, h = 0.005, cap 8, horizon 10; the
// left side at t = 0, 0.5, 1, 1.4, 2, 3, integrated to the bound plus 0.5826 sqrt(dt); |left side - 1/4| < 1.5e-3
// ("measured at most 6e-4"), and the per-moment version c(t)(b/2 + sinh 2b/4) off by more than 0.03 when the cost
// moves.
const TEST = {
  constant: () => 0.1,
  sinusoid: (t) => 0.1 * (1 + 0.5 * Math.sin(2 * t)),
  "smooth step": testStep,
};
const TIMES = [0, 0.5, 1, 1.4, 2, 3];
const fineOf = {}, coarseOf = {};
for (const [name, cost] of Object.entries(TEST)) {
  const out = solveSchedule(cost, 10, { dt: 0.002, h: 0.005, every: 5, lhsUpto: 9.9 });
  fineOf[name] = out;
  let we = 0, wp = 0;
  for (const t of TIMES) {
    const i = out.ts.findIndex((x) => Math.abs(x - t) < 1e-9);
    we = Math.max(we, Math.abs(out.lhs[i] - 0.25)); wp = Math.max(wp, Math.abs(out.pm[i] - 0.25));
  }
  check("exact", `the paper's test, ${name}: the left side is within 1.5e-3 of 1/4 at its six times (Δt 0.002, h 0.005)`, we < 1.5e-3, `worst ${we.toExponential(2)}`);
  if (name !== "constant") check("exact", `the paper's test, ${name}: the cost now in place of the cost at decision misses 1/4 by more than 0.03`, wp > 0.03, `worst ${wp.toFixed(4)}`);
  coarseOf[name] = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, every: 1, lhsUpto: 9.9 });
}
{
  // the plates' grids: the coarse one is looser, the plates' fixed one in between
  for (const name of ["sinusoid", "smooth step"]) {
    const c = worstIn(coarseOf[name], 3).w, f = worstIn(fineOf[name], 3).w;
    check("grid", `${name}: the residual over 0 to 3 is smaller on the paper's grid than on Δt 0.01, h 0.02`, f < c, `${f.toExponential(2)} vs ${c.toExponential(2)}`);
  }
  const fx = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt, h: FIXED.h, cMin: 0.1, every: 1, lhsUpto: 3 });
  const w = worstIn(fx, 3);
  check("area", "the plates' grid (Δt 0.005, h 0.01, forced choice at 8): the left side is within 2e-3 of 1/4 on the test step, 0 to 3 (measured 1.6e-3)", w.w < 2e-3, `worst ${w.w.toExponential(2)} at ${w.at.toFixed(3)}`);
  const tail = fineOf.constant.lhs[fineOf.constant.ts.findIndex((t) => Math.abs(t - 9.5) < 1e-9)];
  check("exact", "the finite horizon: a constant cost's left side falls well below 1/4 half a time unit before the forced choice", tail < 0.2, `left side ${tail.toFixed(4)} at t = 9.5`);
}

// ---- the book's schedules on the live plate -----------------------------------------------------------------------
{
  const ids = PRESETS.map((p) => p.id).filter((id) => id !== "deadline" && id !== "rising");
  const choices = [...ids.map(presetChoice), { id: "draw", points: defaultDrawing() }];
  let worstCoarse = 0, wcAt = "", ok = true, holder = true, hol = [];
  for (const ch of choices) {
    const cost = costOf(ch), r = costRange(cost, 10);
    const out = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, cMin: r.lo, every: 1, lhsUpto: 10 });
    const w = worstIn(out, VIEW).w;
    if (w > worstCoarse) { worstCoarse = w; wcAt = ch.id; }
    if (!(w < 1.2e-2)) ok = false;
    // the band: the computed bound's largest |db| / sqrt|dt| over the window against C
    const C = Math.sqrt((r.hi - r.lo) / r.lo);
    const idx = out.ts.map((t, i) => (t <= VIEW + 1e-9 ? i : -1)).filter((i) => i >= 0);
    let ratio = 0;
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) ratio = Math.max(ratio, Math.abs(out.bounds[idx[b]] - out.bounds[idx[a]]) / Math.sqrt(out.ts[idx[b]] - out.ts[idx[a]]));
    if (ch.id !== "constant" && !(ratio <= C)) holder = false;
    hol.push(`${ch.id} ${ratio.toFixed(2)}/${C.toFixed(2)}`);
  }
  check("grid", "every book schedule that meets the assumption: left side within 1.2e-2 of 1/4 over 0 to 2.5 on Δt 0.01, h 0.02", ok, `worst ${worstCoarse.toExponential(2)} (${wcAt})`);
  check("holder", "every book schedule that meets the assumption: the computed bound's largest |Δb|/√|Δt| over 0 to 2.5 is within C (Δt 0.01)", holder, hol.join(", "));
  for (const ch of [presetChoice("jump"), { id: "draw", points: defaultDrawing() }]) {
    const cost = costOf(ch), r = costRange(cost, 10);
    const out = solveSchedule(cost, 10, { dt: 0.002, h: 0.005, cMin: r.lo, every: 5, lhsUpto: 2.6 });
    const w = worstIn(out, VIEW), co = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, cMin: r.lo, every: 1, lhsUpto: 2.6 });
    check("grid", `${ch.id}: on the paper's grid the left side is within 3e-3 of 1/4 over 0 to 2.5, and closer than on Δt 0.01`, w.w < 3e-3 && w.w < worstIn(co, VIEW).w, `${w.w.toExponential(2)} at ${w.at.toFixed(2)}, against ${worstIn(co, VIEW).w.toExponential(2)}`);
    if (ch.id === "jump") {
      const C = Math.sqrt((r.hi - r.lo) / r.lo);
      check("holder", "Figure 1(a): C is √15 within 0.01 (the logistic step is 0.1 + 1.5 × 4.5e-5 at time 0, so c_min is a hair above 0.1)", Math.abs(C - Math.sqrt(15)) < 0.01, `${C.toFixed(4)} vs ${Math.sqrt(15).toFixed(4)}, c_min ${r.lo.toFixed(5)}`);
    }
  }
}

// ---- the envelope identity on the plates' grid ----------------------------------------------------------------------
const FX = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt, h: FIXED.h, cMin: 0.1, every: 1, lhsUpto: 3, ys: FIXED.ys, snaps: [0.5, 1, 1.2, 1.5, 1.8, 2], snapTo: 2 });
{
  const n = FX.ts.length + Math.round(10 / FX.dt);
  const c = Float64Array.from({ length: n }, (_, k) => testStep(k * FX.dt));
  const Cs = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) Cs[k + 1] = Cs[k] + c[k] * FX.dt;
  let worstAbove = -Infinity, worstTouch = 0, worstSlope = 0, worstMass = 0, cases = 0;
  for (const [q, y] of FIXED.ys.entries()) for (const t of [0.5, 1, 1.3, 1.5, 2, 2.4]) {
    const Kk = Math.round(t / FX.dt);
    if (!(FX.yGrid[q] < FX.bounds[Kk])) continue;
    cases++;
    const { f, A } = frozenRule(FX.bounds, FX.dt, FX.h, y, Kk, 0.1);
    const J = (M) => A - f.reduce((a, fn, k) => a + fn * (Cs[Kk + M + k] - Cs[Kk + M]), 0);
    for (let M = -Math.min(Kk, 200); M <= 200; M += 4) worstAbove = Math.max(worstAbove, J(M) - FX.Vy[q][Kk + M]);
    worstTouch = Math.max(worstTouch, Math.abs(J(0) - FX.Vy[q][Kk]));
    const Vt = (FX.Vy[q][Kk + 1] - FX.Vy[q][Kk - 1]) / (2 * FX.dt);
    const ident = c[Kk] - f.reduce((a, fn, k) => a + fn * c[Kk + k], 0);
    worstSlope = Math.max(worstSlope, Math.abs(Vt - ident));
    worstMass = Math.max(worstMass, Math.abs(f.reduce((a, b) => a + b, 0) - 1));
  }
  check("envelope", `the frozen rule's reward never exceeds the value by more than 1e-9 over ±1 time unit (${cases} starts; rounding, and the forced choice at 8, which a rule started later can run past)`, worstAbove < 1e-9, `largest J − V ${worstAbove.toExponential(1)}`);
  check("envelope", "the frozen rule's reward equals the value where it was frozen", worstTouch < 1e-11, `largest |J − V| at t: ${worstTouch.toExponential(1)}`);
  check("envelope", "the frozen rule's law of decision times sums to 1", worstMass < 1e-9, `largest miss ${worstMass.toExponential(1)}`);
  check("envelope", "V_t from the grid matches c(t) − E[c(t + τ*)] within 5e-3 per time unit (Δt 0.005; measured 3.2e-3)", worstSlope < 5e-3, `largest gap ${worstSlope.toExponential(2)}`);
  // the gap shrinks with the time step
  const half = solveSchedule(testStep, 4, { dt: FIXED.dt / 2, h: FIXED.h / 2, cMin: 0.1, every: 1, lhsUpto: 0, ys: [0.25] });
  const Kh = Math.round(1.3 / half.dt), q1 = Math.round(1.3 / FX.dt);
  const ch = Float64Array.from({ length: half.ts.length + 2000 }, (_, k) => testStep(k * half.dt));
  const rh = frozenRule(half.bounds, half.dt, half.h, 0.25, Kh, 0.1);
  const r1 = frozenRule(FX.bounds, FX.dt, FX.h, 0.25, q1, 0.1);
  const gapH = Math.abs((half.Vy[0][Kh + 1] - half.Vy[0][Kh - 1]) / (2 * half.dt) - (ch[Kh] - rh.f.reduce((a, fn, k) => a + fn * ch[Kh + k], 0)));
  const gap1 = Math.abs((FX.Vy[1][q1 + 1] - FX.Vy[1][q1 - 1]) / (2 * FX.dt) - (c[q1] - r1.f.reduce((a, fn, k) => a + fn * c[q1 + k], 0)));
  check("envelope", "the slope gap at t = 1.3, y = 0.25 shrinks when the time step and evidence step are halved", gapH < 0.7 * gap1, `${gapH.toExponential(2)} vs ${gap1.toExponential(2)}`);
}

// ---- regularity on the plates' grid --------------------------------------------------------------------------------
{
  let margin = Infinity, lowU = Infinity, chords = true;
  for (const s of FX.snaps) {
    for (let j = 0; j < s.x.length && s.x[j] < s.b; j++) {
      margin = Math.min(margin, s.V[j] - belief(s.x[j]) - 0.1 * (s.b - s.x[j]) ** 2);
      lowU = Math.min(lowU, s.u[j]);
    }
    const W = (y) => { const j = Math.round(y / FX.h); return s.V[j] - belief(j * FX.h); };
    const r = [0.4, 0.2, 0.1, 0.05].map((e) => W(s.b - e) / e);
    if (!r.every((v, i) => i === 0 || v < r[i - 1])) chords = false;
  }
  check("regularity", "W ≥ c_min (b − y)² below the grid's bound at six times (Δt 0.005, h 0.01)", margin >= 0, `smallest margin ${margin.toExponential(2)}`);
  check("regularity", "E_y[c(t + τ*)] ≥ c_min below the bound", lowU >= 0.1 - 1e-12, `smallest ${lowU.toFixed(5)}`);
  check("regularity", "the chords' slopes W(t, b − ε)/ε fall as ε goes 0.4, 0.2, 0.1, 0.05, at all six times", chords, "");
  // Hölder at two times 0.3 apart: floor <= W <= cap at the lower bound's level
  const s1 = FX.snaps.find((s) => Math.abs(s.t - 1.2) < 1e-9), s2 = FX.snaps.find((s) => Math.abs(s.t - 1.5) < 1e-9);
  const y = s2.b, j = Math.round(y / FX.h);
  const Wy = s1.V[j] - belief(j * FX.h) + (s1.V[j + 1] - belief((j + 1) * FX.h) - s1.V[j] + belief(j * FX.h)) * (y / FX.h - j);
  const lower = 0.1 * (s1.b - s2.b) ** 2, upper = 0.3 * 0.3;
  check("regularity", "times 1.2 and 1.5: W at the lower bound's level lies between c_min Δb² and (c_max − c_min)|Δt|", Wy >= lower && Wy <= upper, `${lower.toFixed(4)} ≤ ${Wy.toFixed(4)} ≤ ${upper.toFixed(4)}`);
  // smooth fit: the last cell's slope of V moves toward g'(b) as the grid is refined
  const fine = solveSchedule(testStep, 4, { dt: 0.002, h: 0.005, cMin: 0.1, every: 1, lhsUpto: 0, snaps: [1.2], snapTo: 2 });
  const gapOf = (s, h, dt) => { const ib = Math.floor(s.b / h); return Math.abs((s.V[ib] - s.V[ib - 1]) / h - gPrime(s.b + OVERSHOOT * Math.sqrt(dt))); };
  const g1 = gapOf(s1, FX.h, FX.dt), g2 = gapOf(fine.snaps[0], 0.005, 0.002);
  check("regularity", "smooth fit on the grid: the gap between V's last-cell slope and g′(b) at t = 1.2 shrinks on the finer grid", g2 < g1, `${g2.toFixed(4)} (h 0.005) vs ${g1.toFixed(4)} (h 0.01)`);
}

// ---- the area plate's integral -------------------------------------------------------------------------------------
{
  let worst = 0, worstDots = 0;
  for (const s of FX.snaps) {
    const bc = s.b + FX.shift, xs = [], f2 = [];
    for (let j = 0; j < s.x.length && s.x[j] < bc; j++) { xs.push(s.x[j]); f2.push(2 * Math.cosh(s.x[j]) ** 2 * s.u[j]); }
    const j = Math.floor(bc / FX.h), ub = s.u[j] + (s.u[j + 1] - s.u[j]) * (bc / FX.h - j);
    xs.push(bc); f2.push(2 * Math.cosh(bc) ** 2 * ub);
    const R = [0];
    for (let i = 1; i < xs.length; i++) R.push(R[i - 1] + 0.5 * (f2[i] + f2[i - 1]) * (xs[i] - xs[i - 1]));
    worst = Math.max(worst, Math.abs(R[R.length - 1] / 2 - leftSide(s.u, FX.h, bc)));
    for (let i = 1; i + 1 < s.x.length && s.x[i + 1] < s.b; i += 3) {
      const lhs = Math.cosh(s.x[i]) ** 2 * (s.V[i + 1] - s.V[i - 1]) / (2 * FX.h);
      worstDots = Math.max(worstDots, Math.abs(lhs - R[i]));
    }
  }
  check("area", "the plate's trapezoid sum to the bound equals the left side the live plate uses", worst < 1e-12, `largest difference ${worst.toExponential(1)}`);
  check("area", "cosh² z V_y(t, z) from the value's differences matches twice the area to z within 1e-2 (h 0.01)", worstDots < 1e-2, `largest gap ${worstDots.toExponential(2)}`);
}

// ---- the remark: scale and speed -------------------------------------------------------------------------------------
{
  const d = 1e-4;
  const models = [
    ["Y", (y) => Math.tanh(y), (y) => 1 / Math.cosh(y) ** 2, (y) => 2 * Math.cosh(y) ** 2, (y) => gPrime(y), 0.5],
    ["u", (u) => u / 2, (u) => Math.exp(-u * u / 2), (u) => 2 * Math.exp(u * u / 2), (u) => Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI), 1 / Math.sqrt(2 * Math.PI)],
  ];
  for (const [name, mu, sp, m, gp, target] of models) {
    let worst = 0, worstG = 0;
    const f = (x) => Math.sin(1.3 * x) + 0.2 * x * x;
    for (const x of [0.2, 0.7, 1.4, 2.1]) {
      const fp = (z) => (f(z + d) - f(z - d)) / (2 * d), fpp = (z) => (f(z + d) - 2 * f(z) + f(z - d)) / (d * d);
      const lhs = (fp(x + d) / sp(x + d) - fp(x - d) / sp(x - d)) / (2 * d), rhs = m(x) * (0.5 * fpp(x) + mu(x) * fp(x));
      worst = Math.max(worst, Math.abs(lhs - rhs) / Math.max(1, Math.abs(rhs)));
      worstG = Math.max(worstG, Math.abs(gp(x) / sp(x) - target));
      const sInt = Math.exp(-2 * (name === "Y" ? Math.log(Math.cosh(x)) : x * x / 4));
      worstG = Math.max(worstG, Math.abs(sInt - sp(x)));
    }
    check("speed", `${name}: (f′/s′)′ = m 𝓛f against differences, and s′ = exp(−∫2μ)`, worst < 1e-4, `largest relative gap ${worst.toExponential(1)}`);
    check("speed", `${name}: the reward's slope over s′ is the constant ${target.toFixed(4)}`, worstG < 1e-12, `largest gap ${worstG.toExponential(1)}`);
  }
  // the unknown-reliability bound: int_0^U e^{v^2/2} dv = 1/(2 sqrt(2 pi) kappa), against a series for the integral
  const series = (U) => { let s = 0, term = U; for (let n = 0; n < 80; n++) { s += term; term *= (U * U / 2) * (2 * n + 1) / ((n + 1) * (2 * n + 3)); } return s; };
  const I = (U) => { const n = 400; let s = 0; for (let i = 0; i <= n; i++) { const v = (U * i) / n; s += (i === 0 || i === n ? 0.5 : 1) * Math.exp(v * v / 2); } return (s * U) / n; };
  let worst = 0;
  for (const U of [0.3, 1, 2]) worst = Math.max(worst, Math.abs(I(U) - series(U)) / series(U));
  check("speed", "the plate's trapezoid rule for ∫e^{v²/2} on 400 intervals agrees with its series within 1e-4", worst < 1e-4, `largest relative gap ${worst.toExponential(1)}`);
  for (const c of [0.01, 0.1, 1]) {
    const b = B(c), n = 400;
    let A = 0; for (let i = 0; i <= n; i++) { const y = (b * i) / n; A += (i === 0 || i === n ? 0.5 : 1) * c * 2 * Math.cosh(y) ** 2; } A *= b / n;
    check("speed", `Y at c = ${c}: the shaded area c ∫ m to B(c) is g′/s′ = 1/2 within 1e-4`, Math.abs(A - 0.5) < 1e-4, `${A.toFixed(6)}`);
  }
}

// ---- the sentences ---------------------------------------------------------------------------------------------------
{
  const R = K.rng(7);
  let bad = 0, n = 0;
  const r = () => R.next(), maybe = () => (r() < 0.1 ? NaN : r());
  for (let i = 0; i < 3000; i++) {
    const all = [{ e: 0.1, median: maybe() * 0.01, share: r() }, { e: 0.03, median: maybe() * 0.005, share: r() }, { e: 0.01, median: r() * 0.001, share: r() }];
    const say = [
      S.heroLabel(r() * 3, i % 7 ? r() * 1.5 : NaN, r() * 1.5, 1 + r() * 3),
      S.frozenOutside(r() * 2.4, 0.5, r()),
      S.frozenSay(i % 5, { t: r() * 2.4, y: 0.25, V: r(), b: r() * 1.4, gap: (r() - 0.5) * 1e-12, n: i % 3, c: r() * 0.4, Ec: r() * 0.4, mean: r() * 2, Vt: -r(), Jt: -r(), ident: -r(), dt: 0.005, u0: r() * 0.4, ub: r() * 0.4 }),
      S.frozenVerdict(["better", "worse", "same", null][i % 4], (r() - 0.7) * 0.3, r() * 2.4, 0.25),
      S.regularSay(i % 5, { t: r() * 2, lo: r(), cmin: 0.1, W0: r() * 0.2, par0: r() * 0.2, margin: (r() - 0.3) * 1e-3, tl: 1.2, th: 1.5, Wy: r() * 0.1, lower: r() * 0.05, upper: 0.09, db: r() * 0.5, allowed: 0.95, all, ratios: [{ e: 0.4, r: r() }, { e: 0.05, r: r() * 0.1 }], slope: r(), gp: r(), h: 0.01 }),
      S.bandSay(r() * 4, r() * 4, r(), 1 + r() * 15),
      S.bandVerdict(["jump", "cont", null][i % 3], r(), 1 + r() * 15, r() * 4),
      S.standingNote(["deadline", "rising", "draw", "constant", "preset"][i % 5], "Pulse"),
      S.areaSay(i % 4, { t: r() * 2, u0: r(), c: r(), z: r(), Rz: r(), gap: r() * 1e-3, R: r(), bc: r() * 1.4, L: 0.25 + (r() - 0.5) * 1e-3, Bc: r() * 1.4 }),
      S.liveSay({ label: "Pulse", dt: [0.002, 0.01][i % 2], w: r() * 1e-3, at: r() * 2.5, wo: i % 3 ? r() * 1e-2 : NaN, dtOther: [0.01, 0.002][i % 2], pm: r() * 0.3, far: i % 2 === 0, tail: r() * 0.2, horizon: 10, constant: i % 9 === 0 }),
      S.speedSay(["y", "u"][i % 2], r(), r() * 2, r(), r()),
      S.sci((r() - 0.5) * 10 ** (-1 - Math.floor(r() * 12))),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  check("words", "a small residual prints as 5.6 × 10⁻⁴, and 0.0123 as a decimal", S.sci(5.56e-4) === "5.6 × 10⁻⁴" && S.sci(0.0123) === "0.012" && S.sci(-9.96e-5) === "−1.0 × 10⁻⁴", `${S.sci(5.56e-4)}, ${S.sci(0.0123)}, ${S.sci(-9.96e-5)}`);
  check("words", "the slope verdict calls a falling value worse and a flat one no different", /worse/.test(S.frozenVerdict("worse", -0.1, 1, 0.25)) && /^Right/.test(S.frozenVerdict("worse", -0.1, 1, 0.25)) && /no difference/.test(S.frozenVerdict(null, 0.0005, 2, 0.25)), S.frozenVerdict("worse", -0.1, 1, 0.25));
  check("words", "the live sentence credits the grid only when the finer grid's residual is smaller", /main source/.test(S.liveSay({ label: "x", dt: 0.002, w: 1e-4, at: 1, wo: 1e-3, dtOther: 0.01, pm: 0.1 })) && !/main source/.test(S.liveSay({ label: "x", dt: 0.002, w: 2e-3, at: 1, wo: 1e-3, dtOther: 0.01, pm: 0.1 })), "");
  check("words", "the band sentence says when the computed bound exceeds C", /above the C/.test(S.bandSay(2, 1, 0.1, 3)) && /inside the C/.test(S.bandSay(1, 2, 0.1, 3)), "");
}
