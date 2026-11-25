// Chapter 5: the exact equation on the page's grids against the paper's own test (tests/test_exact_equation.py at
// the tag: its grid, schedules, times, and tolerances), the page's dynamic program against model.js's, the envelope
// identity and the regularity facts on the plates' grid, the band's Hölder constant, the remark's closed forms, the
// numbers the text quotes, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy } from "../../book/assets/js/model.js";
import { costOf, PRESETS, defaultDrawing, paramsOf, VIEW } from "../../book/assets/js/schedules-book.js";
import { solveSchedule, frozenRule, costRange, leftSide, belief, gPrime, B, F, testStep, FIXED, areaTo, wAt, chords, halfCrossed, costBounds, bandStats, worstResidual } from "../../book/assets/js/ch05-model.js";
import * as S from "../../book/assets/js/say-ch05.js";
import { check, N, asPrinted } from "./lib.mjs";

const presetChoice = (id) => ({ id, params: Object.fromEntries(PRESETS.find((p) => p.id === id).params.map((q) => [q.id, q.value])) });

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
// every comparison between grids below reads both at the same times: every 0.01 from 0 to the window's end
const every01 = (upto) => Array.from({ length: Math.round(upto / 0.01) + 1 }, (_, k) => k * 0.01);
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
  for (const name of ["sinusoid", "smooth step"]) {
    const on = every01(3), c = worstResidual(coarseOf[name], 0, 3, on).w, f = worstResidual(fineOf[name], 0, 3, on).w;
    check("grid", `${name}: at the same 301 times from 0 to 3 and the same horizon, the residual is smaller on the paper's grid than on Δt 0.01, h 0.02`, f < c, `${f.toExponential(2)} vs ${c.toExponential(2)}`);
  }
  const fx = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt, h: FIXED.h, cMin: 0.1, every: 1, lhsUpto: 3 });
  const w = worstResidual(fx, 0, 3);
  check("area", "the plates' grid (Δt 0.005, h 0.01, forced choice at 8): the left side is within 2e-3 of 1/4 on the test step, 0 to 3 (measured 1.6e-3)", w.w < 2e-3, `worst ${w.w.toExponential(2)} at ${w.at.toFixed(3)}`);
  const tail = fineOf.constant.lhs[fineOf.constant.ts.findIndex((t) => Math.abs(t - 9.5) < 1e-9)];
  check("exact", "the finite horizon: a constant cost's left side falls well below 1/4 half a time unit before the forced choice", tail < 0.2, `left side ${tail.toFixed(4)} at t = 9.5`);
}

// ---- the sweep stops where the program stops ---------------------------------------------------------------------
// A bound closer to 0 than the grid's first step reads as 0 (as in model.js and the paper's backward_induction_x),
// even where the center still waits; the sweep for E_y[c(t + tau*)] follows the program's own choice at each node.
{
  const cost = costOf({ id: "jump", params: { at: 0.5, factor: 32 } });
  const out = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, cMin: 0.1, every: 1, lhsUpto: 3, snaps: [0.7], snapTo: 1 });
  const i = out.ts.findIndex((t) => Math.abs(t - 0.7) < 1e-9), sn = out.snaps[0];
  check("grid", "a 32-fold jump at time 0.70 (Δt 0.01, h 0.02): the bound reads 0, while waiting beats deciding at the center", out.bounds[i] === 0 && sn.V[0] > 0.5 && out.centerWaits[i],
    `bound ${out.bounds[i]}, value at 0 ${sn.V[0].toFixed(6)}, center waits ${out.centerWaits[i]}`);
  check("grid", "there the sweep waits at the center too: E_0[c(t + τ*)] is above the cost now, which is still rising", sn.u[0] > cost(0.7) + 1e-6, `${sn.u[0].toFixed(6)} vs ${cost(0.7).toFixed(6)}`);
  // on the test schedules, the stop mask is the old rule |x| >= b at every step where the bound isn't 0
  let differ = 0;
  for (const name of Object.keys(TEST)) {
    const o = solveSchedule(TEST[name], 4, { dt: 0.01, h: 0.02, cMin: 0.1, every: 1, lhsUpto: 0 });
    for (let k = 0; k < o.ts.length - 1; k++) for (let n = 0; n <= o.M; n++) if ((n * 0.02 >= o.bounds[k]) !== (o.stop[k * (o.M + 1) + n] === 1)) differ++;
  }
  check("grid", "on the paper's three test schedules, the program's stop mask is exactly |x| ≥ b at every step and node", differ === 0, `${differ} nodes differ`);
  const zeros = out.ts.filter((t, k) => t <= VIEW + 1e-9 && out.bounds[k] === 0).length;
  const say = S.liveSay({ label: "Cost jumps", dt: 0.01, w: worstResidual(out, 0, VIEW).w, wf: NaN, wc: NaN, pm: 0.1, far: false, constant: false, zeros, fold: 32 });
  check("words", "the live sentence names the grid's limit when the bound reads 0 (the 32-fold jump)", zeros > 0 && /reads as 0/.test(say), `${zeros} times read 0`);
}

// ---- the book's schedules on the live plate -----------------------------------------------------------------------
// the sample: each preset at its default settings, other than Deadline and Rising, and the default drawing
{
  const ids = PRESETS.map((p) => p.id).filter((id) => id !== "deadline" && id !== "rising");
  const choices = [...ids.map(presetChoice), { id: "draw", points: defaultDrawing() }];
  let worstCoarse = 0, wcAt = "", ok = true, holder = true, contain = true, hol = [], cont = [];
  for (const ch of choices) {
    const cost = costOf(ch), r = costRange(cost, 10);
    const out = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, cMin: r.lo, every: 1, lhsUpto: 10 });
    const w = worstResidual(out, 0, VIEW).w;
    if (w > worstCoarse) { worstCoarse = w; wcAt = ch.id; }
    if (!(w < 1.2e-2)) ok = false;
    // the band: C from the bounds read off the formula; they hold the cost sampled to time 400
    const g = costBounds(ch, paramsOf(ch)), long = costRange(cost, 400);
    if (!(g && long.lo >= g.lo * (1 - 1e-12) && long.hi <= g.hi * (1 + 1e-12))) contain = false;
    cont.push(`${ch.id} [${long.lo.toFixed(4)}, ${long.hi.toFixed(4)}] in [${g.lo.toFixed(4)}, ${g.hi.toFixed(4)}]`);
    const C = Math.sqrt((g.hi - g.lo) / g.lo), st = bandStats(out.ts, out.bounds, cost, VIEW);
    if (ch.id !== "constant" && !(st.ratio <= C)) holder = false;
    hol.push(`${ch.id} ${st.ratio.toFixed(2)}/${C.toFixed(2)}`);
  }
  check("grid", "the book's sample (each preset at its defaults, other than Deadline and Rising, and the default drawing): left side within 1.2e-2 of 1/4 over 0 to 2.5 on Δt 0.01, h 0.02", ok, `worst ${worstCoarse.toExponential(2)} (${wcAt})`);
  check("holder", "the same sample: the cost sampled every 0.001 to time 400 stays within the bounds the band reads from the formula", contain, cont.join("; "));
  check("holder", "the same sample: the computed bound's largest |Δb|/√|Δt| over 0 to 2.5 (Δt 0.01) is within C from those bounds", holder, hol.join(", "));
  {
    const sm = presetChoice("smooth"), g = costBounds(sm, paramsOf(sm)), r10 = costRange(costOf(sm), 10), r400 = costRange(costOf(sm), 400);
    check("holder", "Smooth: its cost goes beyond the range sampled to time 10, so a C read from 0 to 10 would be too small", r400.lo < r10.lo && r400.hi > r10.hi && g.lo <= r400.lo && g.hi >= r400.hi,
      `0 to 10: [${r10.lo.toFixed(4)}, ${r10.hi.toFixed(4)}]; 0 to 400: [${r400.lo.toFixed(4)}, ${r400.hi.toFixed(4)}]; formula: [${g.lo.toFixed(4)}, ${g.hi.toFixed(4)}]`);
  }
  for (const ch of [presetChoice("jump"), { id: "draw", points: defaultDrawing() }]) {
    const cost = costOf(ch), r = costRange(cost, 10), on = every01(VIEW);
    const out = solveSchedule(cost, 10, { dt: 0.002, h: 0.005, cMin: r.lo, every: 5, lhsUpto: 2.6 });
    const co = solveSchedule(cost, 10, { dt: 0.01, h: 0.02, cMin: r.lo, every: 1, lhsUpto: 2.6 });
    const w = worstResidual(out, 0, VIEW, on), wc = worstResidual(co, 0, VIEW, on);
    check("grid", `${ch.id}: on the paper's grid the left side is within 3e-3 of 1/4 over 0 to 2.5, and closer than on Δt 0.01 at the same 251 times`, w.w < 3e-3 && w.w < wc.w, `${w.w.toExponential(2)} at ${w.at.toFixed(2)}, against ${wc.w.toExponential(2)}`);
    if (ch.id === "jump") {
      const g = costBounds(ch, paramsOf(ch));
      check("holder", "Figure 1(a): C = √15 from the formula's levels 0.1 and 1.6", Math.abs(Math.sqrt((g.hi - g.lo) / g.lo) - Math.sqrt(15)) < 1e-12, `${Math.sqrt((g.hi - g.lo) / g.lo).toFixed(6)}`);
      check("exact", "Figure 1(a): on the paper's grid, the residual over 0 to 2.5 is above the test's 1.5e-3, as the text says", w.w > 1.5e-3, `${w.w.toExponential(2)}`);
      const say = S.liveSay({ label: "Cost jumps", dt: 0.002, w: w.w, wf: w.w, wc: wc.w, pm: 0.15, far: false, constant: false, zeros: 0, fold: g.hi / g.lo });
      check("words", "the live sentence on Figure 1(a): says refinement lowers the residual and names the test's allowance and the 16-fold change, without calling the grid the source",
        /lowers the largest residual/.test(say) && /1\.5 × 10⁻³/.test(say) && /16-fold/.test(say) && !/main source/.test(say), say);
    }
  }
  {
    const out = fineOf.constant, w = worstResidual(out, 0, VIEW).w;
    let tail = 0; out.ts.forEach((t, i) => { if (t >= out.horizon - 1 && Number.isFinite(out.lhs[i])) tail = Math.max(tail, Math.abs(out.lhs[i] - 0.25)); });
    const say = S.liveSay({ label: "Constant", dt: 0.002, w, wf: w, wc: worstResidual(coarseOf.constant, 0, VIEW).w, pm: 0, far: true, tail, horizon: 10, constant: true, zeros: 0, fold: 1 });
    check("words", "the live sentence for a constant cost, shown to the forced choice, keeps the finite-horizon explanation and limits the claim to the times shown", /forced choice at 10/.test(say) && /every time shown from 0 to 2\.5/.test(say), say);
  }
}

// ---- the envelope identity on the plates' grid ----------------------------------------------------------------------
const FX = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt, h: FIXED.h, cMin: 0.1, every: 1, lhsUpto: 3, ys: FIXED.ys, snaps: [0.5, 1, 1.2, 1.5, 1.8, 2, 2.4], snapTo: 2 });
const waitsFX = (o, K, y) => o.stop[K * (o.M + 1) + Math.round(y / o.h)] === 0;
const cumCost = (o) => {
  const n = o.ts.length + Math.round(10 / o.dt);
  const c = Float64Array.from({ length: n }, (_, k) => testStep(k * o.dt)), Cs = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) Cs[k + 1] = Cs[k] + c[k] * o.dt;
  return { c, Cs };
};
{
  const { c, Cs } = cumCost(FX);
  let worstAbove = -Infinity, worstTouch = 0, worstSlope = 0, worstMass = 0, cases = 0;
  for (const [q, y] of FIXED.ys.entries()) for (const t of [0.5, 1, 1.3, 1.5, 2, 2.4]) {
    const Kk = Math.round(t / FX.dt);
    if (!waitsFX(FX, Kk, y)) continue;
    cases++;
    const { f, A } = frozenRule(FX.stop, FX.M, FX.dt, FX.h, y, Kk);
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
  // the gap shrinks when the time step and evidence step are halved, at the same horizon (8), time, and level
  const half = solveSchedule(testStep, FIXED.horizon, { dt: FIXED.dt / 2, h: FIXED.h / 2, cMin: 0.1, every: 1, lhsUpto: 0, ys: [0.25] });
  const hc = cumCost(half).c, Kh = Math.round(1.3 / half.dt), q1 = Math.round(1.3 / FX.dt);
  const rh = frozenRule(half.stop, half.M, half.dt, half.h, 0.25, Kh), r1 = frozenRule(FX.stop, FX.M, FX.dt, FX.h, 0.25, q1);
  const gapH = Math.abs((half.Vy[0][Kh + 1] - half.Vy[0][Kh - 1]) / (2 * half.dt) - (hc[Kh] - rh.f.reduce((a, fn, k) => a + fn * hc[Kh + k], 0)));
  const gap1 = Math.abs((FX.Vy[1][q1 + 1] - FX.Vy[1][q1 - 1]) / (2 * FX.dt) - (c[q1] - r1.f.reduce((a, fn, k) => a + fn * c[q1 + k], 0)));
  check("envelope", "the slope gap at t = 1.3, y = 0.25 shrinks when the time step and evidence step are halved (both runs to the forced choice at 8)", gapH < 0.7 * gap1, `${gapH.toExponential(2)} vs ${gap1.toExponential(2)}`);
  // the plate's verdict, on the plate's numbers
  const verdictAt = (t, q) => {
    const Kk = Math.round(t / FX.dt), R = frozenRule(FX.stop, FX.M, FX.dt, FX.h, FIXED.ys[q], Kk);
    const Vt = (FX.Vy[q][Kk + 1] - FX.Vy[q][Kk - 1]) / (2 * FX.dt), Ec = R.f.reduce((a, fn, k) => a + fn * c[Kk + k], 0);
    return { Vt, Ec, c: c[Kk], say: S.frozenVerdict("worse", Vt, t, FIXED.ys[q], c[Kk], Ec) };
  };
  const a = verdictAt(1.2, 1), b = verdictAt(2.4, 1);
  check("words", "the frozen plate's verdict at time 1.2, y = 0.25: worse, giving the expected cost at decision against the cost now rather than a general reason",
    S.slopeSign(a.Vt) === "worse" && a.Ec > a.c && /above the cost now/.test(a.say) && !/more of the decision/.test(a.say), a.say);
  check("words", "at time 2.4, after the rise has leveled off, the verdict is no difference within 0.002", S.slopeSign(b.Vt) === "same" && /within 0\.002/.test(b.say), b.say);
}

// ---- regularity on the plates' grid --------------------------------------------------------------------------------
{
  let margin = Infinity, lowU = Infinity, falls = true, actual = true;
  for (const s of FX.snaps) {
    for (let j = 0; j < s.x.length && s.x[j] < s.b; j++) {
      margin = Math.min(margin, s.V[j] - belief(s.x[j]) - 0.1 * (s.b - s.x[j]) ** 2);
      lowU = Math.min(lowU, s.u[j]);
    }
    const r = chords(s.V, FX.h, s.b, [0.4, 0.2, 0.1, 0.05]);
    if (!r.every((v, i) => i === 0 || v.r < r[i - 1].r)) falls = false;
    // the plate's distances are the actual ones, grid point to grid bound, not the nominal 0.4, 0.2, 0.1, 0.05
    if (!r.every((v) => Math.abs(v.e - (s.b - v.y)) < 1e-12 && Math.abs(v.r - (s.V[Math.round(v.y / FX.h)] - belief(v.y)) / v.e) < 1e-12)) actual = false;
  }
  check("regularity", "W ≥ c_min (b − y)² below the grid's bound at seven times (Δt 0.005, h 0.01)", margin >= 0, `smallest margin ${margin.toExponential(2)}`);
  check("regularity", "E_y[c(t + τ*)] ≥ c_min below the bound", lowU >= 0.1 - 1e-12, `smallest ${lowU.toFixed(5)}`);
  check("regularity", "the plate's chords: their slopes' sizes fall as the distance shrinks, at all seven times, and each divides W by its actual distance", falls && actual, "");
  // Hölder at two times 0.3 apart: the plate's W at the lower bound's level, against an independent reading
  const s1 = FX.snaps.find((s) => Math.abs(s.t - 1.2) < 1e-9), s2 = FX.snaps.find((s) => Math.abs(s.t - 1.5) < 1e-9);
  const y = s2.b, Wy = wAt(s1.V, FX.h, y);
  const W = (i) => s1.V[i] - belief(i * FX.h), j = Math.floor(y / FX.h), u = y / FX.h - j;
  const quad = W(j - 1) * (u * (u - 1)) / 2 + W(j) * (1 - u * u) + W(j + 1) * (u * (u + 1)) / 2; // through j - 1, j, j + 1
  check("regularity", "times 1.2 and 1.5: the plate's W at the lower bound's level lies between the two grid values that enclose it, and within 1e-5 of a quadratic through three nodes",
    Wy <= W(j) && Wy >= W(j + 1) && Math.abs(Wy - quad) < 1e-5, `${Wy.toFixed(7)} in [${W(j + 1).toFixed(7)}, ${W(j).toFixed(7)}], quadratic ${quad.toFixed(7)}`);
  const lower = 0.1 * (s1.b - s2.b) ** 2, upper = 0.3 * 0.3;
  check("regularity", "and it lies between c_min Δb² and (c_max − c_min)|Δt|", Wy >= lower && Wy <= upper, `${lower.toFixed(4)} ≤ ${Wy.toFixed(4)} ≤ ${upper.toFixed(4)}`);
  // smooth fit on the grid: W's slope in the last cell below the bound shrinks when the grid is refined, same horizon
  const fine = solveSchedule(testStep, FIXED.horizon, { dt: 0.002, h: 0.005, cMin: 0.1, every: 1, lhsUpto: 0, snaps: [1.2], snapTo: 2 });
  const lastCell = (s, h) => { const ib = Math.floor(s.b / h); return Math.abs((s.V[ib] - belief(ib * h) - s.V[ib - 1] + belief((ib - 1) * h)) / h); };
  const g1 = lastCell(s1, FX.h), g2 = lastCell(fine.snaps[0], 0.005);
  check("regularity", "smooth fit on the grid: W's slope in the last cell below the bound at t = 1.2 shrinks on the finer grid (both to the forced choice at 8)", g2 < g1, `${g2.toFixed(4)} (h 0.005) vs ${g1.toFixed(4)} (h 0.01)`);
  // the crossing-time median, censored: defined at exactly half the paths, not at fewer
  const times = [...Array.from({ length: 100 }, (_, i) => 0.001 * (i + 1)), ...Array(100).fill(NaN)];
  check("regularity", "half-crossing time: with exactly 100 of 200 paths crossed, it is the 100th crossing; with 99, it is undefined",
    halfCrossed(times, 200) === 0.1 && Number.isNaN(halfCrossed(times.slice(1), 200)), `${halfCrossed(times, 200)}, ${halfCrossed(times.slice(1), 200)}`);
}

// ---- the area plate's integral -------------------------------------------------------------------------------------
{
  let worst = 0, worstDots = 0, worstZ = 0;
  for (const s of FX.snaps) {
    const bc = s.b + FX.shift, xs = [], f2 = [];
    for (let j = 0; j < s.x.length && s.x[j] < bc; j++) { xs.push(s.x[j]); f2.push(2 * Math.cosh(s.x[j]) ** 2 * s.u[j]); }
    const j = Math.floor(bc / FX.h), ub = s.u[j] + (s.u[j + 1] - s.u[j]) * (bc / FX.h - j);
    xs.push(bc); f2.push(2 * Math.cosh(bc) ** 2 * ub);
    worst = Math.max(worst, Math.abs(areaTo(xs, f2, bc) / 2 - leftSide(s.u, FX.h, bc)));
    for (let i = 1; i + 1 < s.x.length && s.x[i + 1] < s.b; i += 3) {
      const lhs = Math.cosh(s.x[i]) ** 2 * (s.V[i + 1] - s.V[i - 1]) / (2 * FX.h);
      worstDots = Math.max(worstDots, Math.abs(lhs - areaTo(xs, f2, s.x[i])));
    }
    // between nodes, the dot is the area the plate shades: the straight-line interpolant, integrated on a fine split
    for (const z of [0.505, 0.333, bc - 0.0037]) {
      let k = 1; while (xs[k] < z) k++;
      const lin = (x) => f2[k - 1] + ((f2[k] - f2[k - 1]) * (x - xs[k - 1])) / (xs[k] - xs[k - 1]);
      let part = 0; const n = 64, a = xs[k - 1];
      for (let m = 0; m < n; m++) { const x0 = a + ((z - a) * m) / n, x1 = a + ((z - a) * (m + 1)) / n; part += 0.5 * (lin(x0) + lin(x1)) * (x1 - x0); }
      worstZ = Math.max(worstZ, Math.abs(areaTo(xs, f2, z) - (areaTo(xs, f2, a) + part)));
    }
  }
  check("area", "the plate's shaded area to the bound is twice the left side the live plate uses", worst < 1e-12, `largest difference ${worst.toExponential(1)}`);
  check("area", "cosh² z V_y(t, z) from the value's differences matches the shaded area to z within 1e-2 (h 0.01)", worstDots < 1e-2, `largest gap ${worstDots.toExponential(2)}`);
  check("area", "between grid points, the slider's dot and reading are the shaded area itself", worstZ < 1e-13, `largest gap ${worstZ.toExponential(1)}`);
  // the sentences on the plates' numbers
  const s = FX.snaps.find((q) => Math.abs(q.t - 2.4) < 1e-9), k = Math.round(2.4 / FX.dt);
  const say = S.areaSay(3, { L: FX.lhs[k], bc: s.b + FX.shift, Bc: B(testStep(2.4)), t: 2.4 });
  check("words", "the area plate at time 2.4 gives the bounds' agreement as a tolerance, and the residual as a size", /within 0\.01/.test(say) && /differs from ¼ by/.test(say) && !/is the cost now/.test(say), say);
  const hs = FX.snaps.find((q) => Math.abs(q.t - 1.3) < 1e-9) || null;
  const h13 = S.heroLabel(1.3, FX.bounds[Math.round(1.3 / FX.dt)] + FX.shift, B(testStep(1.3)), 2.9, FX.lhs[Math.round(1.3 / FX.dt)]);
  check("words", "the hero's label prints the grid's area instead of saying it reaches ¼", /on the grid/.test(h13) && !/reaches ¼/.test(h13), h13);
  void hs;
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
      S.heroLabel(r() * 3, i % 7 ? r() * 1.5 : NaN, r() * 1.5, 1 + r() * 3, 0.25 + (r() - 0.5) * 1e-3),
      S.frozenOutside(r() * 2.4, 0.5, r()),
      S.frozenSay(i % 5, { t: r() * 2.4, y: 0.25, V: r(), b: r() * 1.4, gap: (r() - 0.5) * 1e-12, n: i % 3, c: r() * 0.4, Ec: r() * 0.4, mean: r() * 2, Vt: -r(), Jt: -r(), ident: -r(), dt: 0.005, u0: r() * 0.4, ub: r() * 0.4 }),
      S.frozenVerdict(["better", "worse", "same", null][i % 4], (r() - 0.7) * 0.3, r() * 2.4, 0.25, r() * 0.4, r() * 0.4),
      S.regularSay(i % 5, { t: r() * 2, lo: r(), cmin: 0.1, W0: r() * 0.2, par0: r() * 0.2, margin: (r() - 0.3) * 1e-3, tl: 1.2, th: 1.5, Wy: r() * 0.1, lower: r() * 0.05, upper: 0.09, db: r() * 0.5, allowed: 0.95, all, ratios: [{ e: 0.4 * r(), r: r() }, { e: 0.05 * r(), r: r() * 0.1 }], slope: r(), gp: r(), h: 0.01 }),
      S.bandSay(r() * 4, r() * 4, r(), 1 + r() * 15),
      S.bandVerdict(["jump", "cont", null][i % 3], r(), 1 + r() * 15, r() * 4),
      S.standingNote(["deadline", "rising", "draw", "constant", "preset"][i % 5], "Pulse"),
      S.areaSay(i % 4, { t: r() * 2, u0: r(), c: r(), z: r(), Rz: r(), gap: r() * 1e-3, R: r(), bc: r() * 1.4, L: 0.25 + (r() - 0.5) * 1e-3, Bc: r() * 1.4 }),
      S.liveSay({ label: "Pulse", dt: [0.002, 0.01][i % 2], w: r() * 1e-3, wf: i % 3 ? r() * 3e-3 : NaN, wc: i % 4 ? r() * 1e-2 : NaN, pm: r() * 0.3, far: i % 2 === 0, tail: i % 5 ? r() * 0.2 : NaN, horizon: 10, constant: i % 9 === 0, zeros: i % 6 ? 0 : 12, fold: i % 7 ? 1 + r() * 30 : NaN }),
      S.speedSay(["y", "u"][i % 2], r(), r() * 2, r(), r()),
      S.sci((r() - 0.5) * 10 ** (-1 - Math.floor(r() * 12))),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  check("words", "a small residual prints as 5.6 × 10⁻⁴, and 0.0123 as a decimal", S.sci(5.56e-4) === "5.6 × 10⁻⁴" && S.sci(0.0123) === "0.012" && S.sci(-9.96e-5) === "−1.0 × 10⁻⁴", `${S.sci(5.56e-4)}, ${S.sci(0.0123)}, ${S.sci(-9.96e-5)}`);
  check("words", "the live sentence says lowers only when the finer grid's residual is smaller, and never names a main source", /lowers/.test(S.liveSay({ label: "x", dt: 0.002, w: 1e-4, wf: 1e-4, wc: 1e-3, pm: 0.1 })) && /doesn't lower/.test(S.liveSay({ label: "x", dt: 0.002, w: 2e-3, wf: 2e-3, wc: 1e-3, pm: 0.1 })) && !/main source/.test(S.liveSay({ label: "x", dt: 0.002, w: 1e-4, wf: 1e-4, wc: 1e-3, pm: 0.1 })), "");
  check("words", "the band sentence says when the computed bound exceeds C", /above the C/.test(S.bandSay(2, 1, 0.1, 3)) && /inside the C/.test(S.bandSay(1, 2, 0.1, 3)), "");
}
