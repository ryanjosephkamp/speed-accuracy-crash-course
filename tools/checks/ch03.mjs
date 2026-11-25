// Chapter 3: the constant-cost bound against its equation and against the paper's code (which finds it the second
// way, by maximizing the reward of a flat bound), the two routes' identities, the bill of a flat bound on a schedule
// against its closed form, the sampled paths against the mean decision time, the standing assumption on every preset,
// the dynamic program's value against the closed form and against the paper's code, B'(c) against a difference
// quotient, and the sentences under the plates. Reference values from the paper's code are in
// tools/validity/ch03.json, written by tools/validity/ch03.py.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as M from "../../book/assets/js/ch03-model.js";
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, score, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, PRESETS, defaultDrawing, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import { CHOICES, spec, costFromSpec } from "../validity/schedules.mjs";
import * as S from "../../book/assets/js/say-ch03.js";
import { check, N, asPrinted, ROOT } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch03.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
const defaults = (p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) });

// ---- the flat bound: the equation, the paper's numbers, the paper's code ------------------------------------------
for (const c of [0.01, 0.03, 0.1, 0.3, 1, 2]) {
  const b = M.B(c), r = (M.F(b) - 1 / c) * c;
  check("flat", `B(${c}) solves sinh 2b + 2b = 1/c (relative residual below 1e-12)`, Math.abs(r) < 1e-12, `b = ${b.toFixed(10)}, residual ${r.toExponential(1)}`);
}
check("flat", "BoundTenth: B(0.1) as numbers.tex prints it", asPrinted(M.B(0.1), N.BoundTenth), `${M.B(0.1).toFixed(4)} vs ${N.BoundTenth}`);
check("flat", "DecisionTimeTenth: B tanh B at 0.1 as the paper prints it", asPrinted(M.meanTime(M.B(0.1)), N.DecisionTimeTenth), `${M.meanTime(M.B(0.1)).toFixed(4)} vs ${N.DecisionTimeTenth}`);
check("flat", "the paper-code reference was computed at the book's tag (same tag and commit)", REF.commit === SRC.commit && REF.tag === SRC.tag, `ch03.json from ${REF.tag} (${REF.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);
{
  let dB = 0, dR = 0, dT = 0;
  for (const row of REF.flat) {
    const b = M.B(row.c);
    dB = Math.max(dB, Math.abs(b - row.bound)); dR = Math.max(dR, Math.abs(M.flatReward(row.bound, row.c) - row.reward)); dT = Math.max(dT, Math.abs(M.meanTime(row.bound) - row.time));
  }
  check("flat", `B(c) by Newton on the equation matches the paper's ddm.optimal_bound, which maximizes the reward of a flat bound, at ${REF.flat.length} costs (within 1e-9)`, dB < 1e-9, `largest difference ${dB.toExponential(1)}`);
  check("flat", "the reward g(b) - c b tanh b and the mean decision time b tanh b match ddm.expected_reward and ddm.mean_decision_time (within 1e-12)", dR < 1e-12 && dT < 1e-12, `largest differences ${dR.toExponential(1)}, ${dT.toExponential(1)}`);
}
for (const c of [0.03, 0.1, 0.3, 1]) {
  const b = M.B(c), { x } = M.argmax((v) => M.flatReward(v, c), 0.01, 4, 200, 1e-11);
  check("flat", `c = ${c}: the reward of a flat bound, maximized by search, peaks at B(c) (within 1e-6)`, Math.abs(x - b) < 1e-6, `${x.toFixed(8)} vs ${b.toFixed(8)}`);
}
{
  const R = K.rng(31);
  let w1 = 0, w2 = 0;
  for (let i = 0; i < 2000; i++) {
    const c = Math.exp(Math.log(0.01) + R.next() * Math.log(300)), b = 0.02 + 3 * R.next();
    const rp = M.flatRewardSlope(b, c);
    w1 = Math.max(w1, Math.abs(rp - (M.gPrime(b) - M.flatValueSlope(b, c))));
    w2 = Math.max(w2, Math.abs(rp - M.bracket(b, c) / Math.cosh(b) ** 2));
  }
  check("flat", "the routes meet: R'(b) = g'(b) - V_b'(b) = sech^2 b [1/2 - c (b + sinh(2b)/2)] (2,000 random b and c, within 1e-12)", w1 < 1e-12 && w2 < 1e-12, `largest differences ${w1.toExponential(1)}, ${w2.toExponential(1)}`);
}
for (const c of [0.03, 0.1, 1]) {
  const B = M.B(c), h = 1e-4;
  let worst = 0;
  for (const k of [0.7, 1, 1.3]) {
    const b = k * B;
    for (const u of [0.15, 0.4, 0.65, 0.9]) {
      const y = u * b, V = (z) => M.flatValue(z, b, c);
      const d1 = (V(y + h) - V(y - h)) / (2 * h), d2 = (V(y + h) - 2 * V(y) + V(y - h)) / (h * h);
      worst = Math.max(worst, Math.abs(0.5 * d2 + Math.tanh(y) * d1 - c) / c);
    }
  }
  check("flat", `c = ${c}: V_b(y) = g(b) - c (b tanh b - y tanh y) solves L V = c below each trial level (relative, within 1e-5)`, worst < 1e-5, `largest relative miss ${worst.toExponential(1)}`);
  const at = (k) => M.flatValueSlope(k * B, c) - M.gPrime(k * B);
  check("flat", `c = ${c}: smooth fit only at B(c): V' - g' at the bound is below 0 at 0.7 B, 0 at B, above 0 at 1.3 B`, at(0.7) < -1e-4 && Math.abs(at(1)) < 1e-12 && at(1.3) > 1e-4, `${at(0.7).toExponential(2)}, ${at(1).toExponential(1)}, ${at(1.3).toExponential(2)}`);
  check("flat", `c = ${c}: cosh^2 B V'(B) = c (B + sinh(2B)/2) = 1/2`, Math.abs(c * (B + 0.5 * Math.sinh(2 * B)) - 0.5) < 1e-12, `${(c * (B + 0.5 * Math.sinh(2 * B))).toFixed(14)}`);
}

// ---- the bill of a flat bound on a schedule ------------------------------------------------------------------
{
  let worst = 0, at = "";
  for (const c of [0.02, 0.1, 0.5, 2]) for (const b of [0.05, 0.2, 0.7, 1.5, 3]) {
    const o = M.flatOnSchedule(() => c, b), want = c * M.meanTime(b), r = Math.abs(o.bill - want) / want;
    if (r > worst) { worst = r; at = `c ${c}, b ${b}`; }
  }
  check("bill", "at a constant cost, the bill from the series, integral of c P_0(tau_b > s) ds, equals c b tanh b (20 cases, relative, within 1e-6)", worst < 1e-6, `largest relative difference ${worst.toExponential(1)} (${at})`);
}
for (const [b, T] of [[0.5, 0.4], [1, 1], [1.5, 2.5]]) {
  let s = 0; const n = 400, h = (2 * b) / n;
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * M.openDensity(-b + i * h, T, b);
  s *= h / 3;
  const open = K.survival(0, T, b);
  check("bill", `the density of the paths still open at a deadline integrates to P_0(tau > T) (b = ${b}, T = ${T}, within 1e-8)`, Math.abs(s - open) < 1e-8, `${s.toFixed(10)} vs ${open.toFixed(10)}`);
}
{
  const a = M.flatOnSchedule(() => 0.1, 1, 14), z = M.flatOnSchedule(() => 0.1, 1);
  check("bill", "a deadline far past every decision changes nothing (T = 14, b = 1, within 1e-8)", Math.abs(a.net - z.net) < 1e-8, `${a.net.toFixed(10)} vs ${z.net.toFixed(10)}`);
  const d = M.flatOnSchedule(() => 0.1, 1.2, 1);
  check("bill", "a forced choice at the deadline is right with chance between 1/2 and g(b) on the paths still open", d.forced >= 0.5 * d.open - 1e-12 && d.forced <= M.g(1.2) * d.open + 1e-12, `forced ${d.forced.toFixed(5)}, open ${d.open.toFixed(5)}`);
}
for (const c of [0.05, 0.1, 0.4]) {
  const best = M.bestFlat(() => c);
  check("bill", `the best flat bound for a constant cost ${c}, by search, is B(c) (within 1e-4)`, Math.abs(best.b - M.B(c)) < 1e-4, `${best.b.toFixed(6)} vs ${M.B(c).toFixed(6)}`);
}
{
  const n = 3000, bs = [0.4, 1, 2], sums = bs.map(() => [0, 0]);
  for (let i = 0; i < n; i++) {
    const p = M.samplePath(9000 + i);
    bs.forEach((b, k) => { const t = M.decideAt(p, b) * p.dt; sums[k][0] += t; sums[k][1] += t * t; });
  }
  bs.forEach((b, k) => {
    const m = sums[k][0] / n, se = Math.sqrt(Math.max(0, sums[k][1] / n - m * m) / n), want = M.meanTime(b);
    check("bill", `the plate's sampled paths (${n.toLocaleString("en-US")}, steps of 0.001) decide at b = ${b} after b tanh b on average, within 3 standard errors`, Math.abs(m - want) < 3 * se, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${want.toFixed(4)}`);
  });
}

// ---- the standing assumption, on every preset -----------------------------------------------------------------
{
  const R = K.rng(77);
  for (const p of PRESETS) {
    const draws = [defaults(p), ...Array.from({ length: 12 }, () => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.min + Math.round(((q.max - q.min) * R.next()) / q.step) * q.step])) }))];
    if (p.id === "rising") {
      const st = M.standing(defaults(p)), cost = costOf(defaults(p));
      check("standing", "rising: continuous, with no upper level (the assumption fails)", st.continuous && !Number.isFinite(st.hi) && !M.holds(st) && cost(1000) > 100, `c(1000) = ${cost(1000).toFixed(1)}`);
      continue;
    }
    if (p.id === "deadline") {
      const ch = defaults(p), st = M.standing(ch), cost = costOf(ch);
      check("standing", "deadline: infinite past the deadline, so neither continuous nor bounded (the assumption fails)", !st.continuous && !M.holds(st) && cost(ch.params.at + 0.01) === Infinity, `c(${ch.params.at + 0.01}) = ${cost(ch.params.at + 0.01)}`);
      continue;
    }
    // the levels the plate states lie within the formula's own bounds, and the schedule has settled (or repeats) past them
    let inside = true, settled = true, detail = "";
    for (const ch of draws) {
      const st = M.standing(ch), fb = M.formulaBand(ch), cost = costOf(ch);
      if (!M.holds(st) || st.lo < fb.lo * (1 - 1e-12) || st.hi > fb.hi * (1 + 1e-12) || st.lo > st.hi) { inside = false; detail = `${JSON.stringify(ch.params)}: [${st.lo}, ${st.hi}] vs [${fb.lo}, ${fb.hi}]`; }
      const per = p.id === "smooth" ? 20 * Math.PI : p.id === "wave" ? (2 * Math.PI) / ch.params.omega : 0;
      for (const t of [3.7, 11.2, 40.5]) {
        const d = per ? Math.abs(cost(t + per) - cost(t)) / cost(t) : Math.abs(cost(M.LEVELS_UNTIL) - cost(M.LEVELS_UNTIL + t * 100)) / cost(M.LEVELS_UNTIL);
        if (d > 1e-9) { settled = false; detail = `${JSON.stringify(ch.params)}: changes by ${d.toExponential(1)} past the sampled span`; }
      }
    }
    check("standing", `${p.id}: the levels the plate states (sampled to time ${M.LEVELS_UNTIL}) are positive, finite, and within the formula's bounds, at the default and 12 random settings`, inside, detail || "inside");
    check("standing", `${p.id}: past the sampled span the cost ${["smooth", "wave"].includes(p.id) ? "repeats with its period" : "has settled"} (within 1e-9), so the sampled levels hold for all time`, settled, detail || (["smooth", "wave"].includes(p.id) ? "periodic" : "settled"));
  }
  const draw = { id: "draw", points: defaultDrawing() }, pts = draw.points;
  const flat = M.standing(draw, "flat"), base = costOf(draw);
  check("standing", "a drawing held flat: between its lowest and highest points, so the assumption holds", M.holds(flat) && flat.lo === Math.min(...pts) && flat.hi === Math.max(...pts) && base(9) === base(VIEW), `[${flat.lo.toFixed(4)}, ${flat.hi.toFixed(4)}]`);
  const up = { id: "draw", points: pts.map((c, i) => 0.05 * (1 + i / 10)) }, down = { id: "draw", points: pts.map((c, i) => 0.5 / (1 + i / 10)) };
  const su = M.standing(up, "slope"), sd = M.standing(down, "slope"), cu = M.costWithTail(up, "slope"), cd = M.costWithTail(down, "slope");
  check("standing", "a drawing continued at a rising last slope has no upper level, and one at a falling slope no positive lower level", !M.holds(su) && su.kind === "up" && cu(200) > 1e3 && !M.holds(sd) && sd.kind === "down" && cd(200) < 1e-6, `c(200) = ${cu(200).toExponential(1)} and ${cd(200).toExponential(1)}`);
  const sdl = M.standing(draw, "deadline"), cdl = M.costWithTail(draw, "deadline");
  check("standing", "a drawing ended with a forced choice at 2.5 is a deadline (the assumption fails), and agrees with the drawing before it", !M.holds(sdl) && cdl(2.6) === Infinity && cdl(1.3) === base(1.3), "infinite past 2.5");
  const level = { id: "draw", points: pts.map(() => 0.1) };
  check("standing", "a drawing whose last slope is 0 is the same at its last slope as held flat", M.holds(M.standing(level, "slope")) && Math.abs(M.costWithTail(level, "slope")(9) - 0.1) < 1e-15, "flat");
}

// ---- the value of waiting: the dynamic program ---------------------------------------------------------------
for (const id of ["jump", "fall"]) {
  const cost = costOf(defaults(PRESETS.find((p) => p.id === id))), H = VIEW + SPARE;
  const a = M.valueSurface(cost, H), b = exactPolicy(cost, H);
  let d = 0; for (let k = 0; k < b.bounds.length; k++) { const x = a.bounds[k], y = b.bounds[k]; if (!(x === y)) d = Math.max(d, Math.abs(x - y)); }
  check("value", `${id}: the program that keeps the value finds the same bound as model.js's exactPolicy, step for step`, d === 0, `largest difference ${d}`);
}
for (const c of [0.05, 0.1, 0.3]) {
  const o = M.valueSurface(() => c, VIEW + SPARE), B = M.B(c);
  let worst = 0, drift = 0, neg = 0, rise = 0;
  o.ys.forEach((y, j) => {
    if (y <= B + 0.3) worst = Math.max(worst, Math.abs(o.V[0][j] - M.flatValue(y, B, c)));
    drift = Math.max(drift, Math.abs(o.V[0][j] - o.V[o.V.length - 1][j]));
  });
  o.V.forEach((row) => row.forEach((v, j) => { const w = v - o.gy[j]; neg = Math.min(neg, w); if (j) rise = Math.max(rise, w - (row[j - 1] - o.gy[j - 1])); }));
  const bDrift = Math.abs(o.bounds[0] - o.bounds[Math.round(VIEW / o.dt)]);
  check("value", `c = ${c}: the program's V(0, y) is within 0.0015 of the closed form g(B) - c (B tanh B - y tanh y) up to B + 0.3 (it checks the evidence every 0.01)`, worst < 0.0015, `largest difference ${worst.toExponential(2)}`);
  check("value", `c = ${c}: with the choice forced 6 time units past the window, V changes by less than 0.001 and the bound by less than 0.003 over the window, as for no last moment`, drift < 1e-3 && bDrift < 3e-3, `V by ${drift.toExponential(1)}, the bound by ${bDrift.toExponential(1)}`);
  check("value", `c = ${c}: W = V - g is never negative, and never rises with y by more than 1e-9`, neg >= 0 && rise < 1e-9, `smallest W ${neg.toExponential(1)}, largest rise ${rise.toExponential(1)}`);
}
{
  const o = M.valueSurface(() => 0.01, VIEW + SPARE), bDrift = Math.abs(o.bounds[0] - o.bounds[Math.round(VIEW / o.dt)]);
  check("value", "c = 0.01, where decisions run long: the forced choice 6 time units past the window moves the bound by less than 0.02 over the window (what the plate's note warns of)", bDrift < 0.02 && bDrift > 0.003, `the bound by ${bDrift.toFixed(4)}`);
}
{
  let worst = 0, n = 0, at = "";
  for (const choice of CHOICES) {
    const s = spec(choice), cost = costFromSpec(s), ref = REF.value[s.id];
    for (const last of s.kind === "deadline" ? ["far"] : ["far", "window"]) {   // a deadline is solved to the deadline either way
      const H = s.kind === "deadline" ? s.at : last === "far" ? VIEW + SPARE : VIEW;
      const o = M.valueSurface(cost, H, { dt: REF.dt, h: REF.h, cap: REF.cap });
      const d = Math.abs(o.v00 - ref[last]); n++;
      if (d > worst) { worst = d; at = `${s.id}, ${last}`; }
    }
  }
  check("value", `V(0, 0) from the page's program matches the paper's backward_induction_x in ${n} cases: 11 schedules, the 10 without a deadline at two last moments (within 1e-6)`, worst < 1e-6, `largest difference ${worst.toExponential(2)} (${at})`);
}
{
  let worst = Infinity, at = "";
  for (const choice of CHOICES) {
    const s = spec(choice), cost = costOf(choice), dl = s.kind === "deadline" ? s.at : null, H = dl ?? VIEW + SPARE;
    const best = M.bestFlat(cost, dl), ts = Float64Array.from({ length: Math.round(H / REF.dt) + 1 }, (_, k) => k * REF.dt);
    const flat = score(Float64Array.from(ts, () => toDiscrete(best.b, REF.dt)), ts, cost, REF.h, REF.cap).reward;
    const d = REF.value[s.id].far - flat;
    if (d < worst) { worst = d; at = s.id; }
  }
  check("value", "on every book schedule, the program's V(0, 0) is at least what the best flat bound earns scored on the same grid (within 1e-6)", worst > -1e-6, `smallest margin ${worst.toExponential(2)} (${at})`);
}

// ---- how the bound answers a cost ---------------------------------------------------------------------------
{
  let worst = 0, at = "";
  for (const c of [0.005, 0.01, 0.03, 0.1, 0.3, 1, 3, 10]) {
    const h = 1e-5 * c, fd = (M.B(c + h) - M.B(c - h)) / (2 * h), r = Math.abs(fd - M.Bprime(c)) / Math.abs(M.Bprime(c));
    if (r > worst) { worst = r; at = String(c); }
  }
  check("slope", "B'(c) = -1/(4c^2 cosh^2 B) against a central difference quotient at 8 costs from 0.005 to 10 (relative, within 1e-6)", worst < 1e-6, `largest relative difference ${worst.toExponential(1)} (c = ${at})`);
  let id = 0; for (let b = 0; b <= 4; b += 0.05) id = Math.max(id, Math.abs(M.Fprime(b) - 4 * Math.cosh(b) ** 2) / M.Fprime(b));
  check("slope", "2 cosh 2b + 2 = 4 cosh^2 b (b from 0 to 4, relative, within 1e-14)", id < 1e-14, `largest relative difference ${id.toExponential(1)}`);
  let convex = true, over = true;
  for (let lc = Math.log(0.005); lc < Math.log(20); lc += 0.05) {
    const c = Math.exp(lc), h = 0.01 * c;
    if (!(M.B(c + h) - 2 * M.B(c) + M.B(c - h) > 0)) convex = false;
    if (!(M.B(c) + M.Bprime(c) * c < M.B(2 * c))) over = false;
  }
  check("slope", "B is convex, so the tangent at c overstates the drop to B(2c) (costs 0.005 to 20)", convex && over, `${convex ? "convex" : "not convex"}, ${over ? "tangent below" : "tangent not below"}`);
  const small = M.B(1e-5) - M.B(2e-5), large = M.B(100) / M.B(50);
  check("slope", "doubling a small cost lowers the bound by about log(2)/2; doubling a large one halves it", Math.abs(small - Math.log(2) / 2) < 1e-3 && Math.abs(large - 0.5) < 1e-3, `drop ${small.toFixed(5)} at c = 1e-5, ratio ${large.toFixed(5)} at c = 50`);
  check("slope", "B(c) is close to 1/(4c) for a large cost (c = 100, relative, within 1e-3)", Math.abs(M.B(100) * 400 - 1) < 1e-3, `${(M.B(100) * 400).toFixed(6)}`);
  let fl = 0; for (const c of [0.03, 0.1, 0.5]) fl = Math.max(fl, Math.abs(-K.fluxTotal(M.B(c)) / (2 * c) - M.Bprime(c)) / -M.Bprime(c));
  check("slope", "the exercise's identity: -(integral of the flux)/(2c) = B'(c) (relative, within 1e-10)", fl < 1e-10, `largest relative difference ${fl.toExponential(1)}`);
}

// ---- the sentences -------------------------------------------------------------------------------------------
{
  const R = K.rng(5), r = () => R.next();
  let bad = 0, n = 0;
  const kinds = ["constant", "step", "smooth", "rising", "deadline", "drawn", "up", "down"];
  for (let i = 0; i < 3000; i++) {
    const b = 0.05 + 3 * r(), c = Math.exp(Math.log(0.01) + r() * Math.log(200)), net = r(), best = { b: 0.05 + 3 * r(), net: r(), reward: r(), bill: r() };
    const out = [
      S.heroLabel(c, M.B(c)),
      S.pathSay({ b, tau: 3 * r(), side: r() < 0.5 ? 1 : -1, forced: i % 4 === 0, deadline: 0.4 + 2.6 * r(), x: (r() - 0.5) * 2 * b, right: 0.5 + 0.5 * r(), bill: r() }),
      S.earnVerdict({ b, mine: { net, reward: r(), bill: r() }, best, dp: i % 3 ? r() : NaN, flat: i % 2 ? { grid: r(), gridX: r(), horizon: 8.5 } : null, deadline: i % 5 ? null : 1 }),
      S.standingSay({ kind: kinds[i % kinds.length], lo: c, hi: c * (1 + 10 * r()), at: 0.4 + 2.6 * r(), continuous: true }, "Cost jumps", 1 + 5 * r()),
      S.valueVerdict(i % 3 ? { t: 2.5 * r(), y: 2 * r(), W: r() } : null, { t: 2.5 * r(), W: r() }),
      S.sliceSay(2.5 * r(), i % 7 ? 2 * r() : 0, 0.5 + 0.5 * r(), 0.5 * r(), i % 2 === 0),
      S.lastNote(i % 2 ? "far" : "window", i % 3 ? null : 1),
      S.peakVerdict(i % 4 ? 3 * r() : null, c, M.B(c), M.flatReward(M.B(c), c), M.gPrime(M.B(c))),
      S.routesSay(i % 5, c, M.B(c)),
      S.doubleVerdict(i % 4 ? 2.4 * r() : null, 0.1, M.B(0.1), M.B(0.2), M.B(0.1) + M.Bprime(0.1) * 0.1),
      S.slideSay(c, M.B(c), M.Bprime(c), M.B(2 * c), M.B(c + 0.01)),
      S.inverseSay(i % 4, { c, b: M.B(c), b2: M.B(1.25 * c), dTan: -r(), dTrue: -r(), Fp: M.Fprime(M.B(c)), fourCosh: 4 * Math.cosh(M.B(c)) ** 2, bp: M.Bprime(c), fd: M.Bprime(c) }),
    ];
    for (const s of out) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  let right = true;
  for (const p of PRESETS) {
    const st = M.standing(defaults(p)), s = S.standingSay(st, p.label);
    if (M.holds(st) !== /assumption holds/.test(s) || M.holds(st) === /assumption fails/.test(s)) right = false;
  }
  for (const tail of ["flat", "slope", "deadline"]) {
    const ch = { id: "draw", points: defaultDrawing() }, st = M.standing(ch, tail), s = S.standingSay(st, "Your drawing", M.steepest(ch));
    if (M.holds(st) !== /assumption holds/.test(s)) right = false;
  }
  check("words", "the verdict on each preset and drawing says the assumption holds exactly when the plate's test says so", right, "consistent");
  const lo = S.peakVerdict(1, 0.1, M.B(0.1), 0.8, 0.08), hi = S.doubleVerdict(1.2, 0.1, M.B(0.1), M.B(0.2), 0.747);
  check("words", "a guess below the peak is called too low, and a guess of B(0.2) above it too high, with the computed B(0.2)", /0\.34 too low/.test(lo) && /0\.27 too high/.test(hi) && hi.includes(M.B(0.2).toFixed(3)), `${lo.slice(0, 50)}… / ${hi.slice(0, 60)}…`);
  const same = S.earnVerdict({ b: 1.2, mine: { net: 0.77, reward: 0.9, bill: 0.13 }, best: { b: 1.2, net: 0.77 }, dp: 0.79, flat: { grid: 0.768, gridX: 1.14, horizon: 8.5 }, deadline: null });
  check("words", "a bound that earns what the best flat bound earns is called within 0.05 points of it, and the time-dependent policy's gain on the grid is stated with the grid's horizon", /within 0\.05 points/.test(same) && /2\.2 points per 100 decisions more/.test(same) && /time 8\.5/.test(same), same.slice(0, 80) + "…");
  const tiny = S.earnVerdict({ b: 1.2, mine: { net: 0.77, reward: 0.9, bill: 0.13 }, best: { b: 1.2, net: 0.77 }, dp: 0.7682, flat: { grid: 0.768, gridX: 1.14, horizon: 8.5 }, deadline: null });
  const cap = readFileSync(join(ROOT, "book/content/ch03.py"), "utf8");
  // the caption's description of the search, word for word (the search itself is checked below, through flatJob)
  const SCAN = "The search scores each odd multiple of 0.01 up to 0.31, then every 0.05 up to 3.5 and every 0.1 below the evidence cap of 5, then scores more levels around its highest sampled peaks, each between the scanned levels on either side of it (at the first or last scanned level, between that level and its one neighbor); it doesn't score every level, so a level it skipped can score slightly higher.";
  check("words", "the earn caption describes the search as odd multiples of 0.01 to 0.31, every 0.05 to 3.5, and every 0.1 below the cap of 5, then more levels around its highest sampled peaks, says it doesn't score every level, and calls the comparison the best time-dependent policy's gain over the level found",
    cap.includes(SCAN) && cap.includes("the sentence compares it with the best level held flat on the same grid that a numerical search found, and states the time-dependent policy's gain over that level")
    && /what the best time-dependent policy earns, \$V\(0, 0\)\$/.test(cap) && /best level held flat that a numerical search finds with the best time-dependent policy/.test(cap) && !/scoring every level the grid can hold|bound that moves|gain from moving/.test(cap), `caption: ${cap.includes(SCAN)}`);
  check("words", "the earn verdict calls the grid's flat level the best the page's numerical search found, and the other the best time-dependent policy on the grid, with its gain over that level, either way; never a bound that moves with the cost, and never every level",
    /best level held flat that the page's numerical search found, 1\.14/.test(same) && /the best time-dependent policy on this grid earns 0\.790: 2\.2 points per 100 decisions more than that level\./.test(same)
    && /the best time-dependent policy on this grid earns 0\.768: on this schedule, it gains less than 0\.05 points per 100 decisions over that level\./.test(tiny) && ![same, tiny].some((x) => /every level|best level held flat,|moves with the cost|bound that moves|moving gains/.test(x)), same.slice(same.indexOf("On the"), same.length));
}

// ---- the audit's edge cases, run through the plates' own computations ------------------------------------------
{
  globalThis.self ??= {};   // the worker module sets self.onmessage when it loads; its jobs are plain functions
  const { valueJob, flatJob } = await import("../../book/assets/js/ch03-worker.js");
  // the zero bound: below the grid's first step, the page puts the bound where its program's two values cross
  for (const choice of [{ id: "jump", params: { at: 0.2, factor: 32 } }, { id: "constant", params: { c: 1 } }, { id: "pulse", params: { at: 0.2, factor: 32 } }]) {
    const m = valueJob({ choice, last: "far" });
    let agree = true, below = 0, bad = "";
    m.times.forEach((t, i) => {
      const w0 = m.V[i][0] - m.gy[0], b = m.rowB[i];
      if ((b > 0) !== (w0 > 1e-12)) { agree = false; bad = `time ${t}: bound ${b}, W(t, 0) ${w0}`; }
      if (M.belowFirstStep(b, m.h)) below++;
    });
    check("value", `${choice.id} ${JSON.stringify(choice.params)}: at every kept row the bound is above 0 exactly where the program waits at y = 0 (W(t, 0) > 0)`, agree, bad || `${m.times.length} rows, ${below} with the bound below the first step`);
  }
  {
    const m = valueJob({ choice: { id: "jump", params: { at: 0.2, factor: 32 } }, last: "far" }), i = m.times.findIndex((t) => Math.abs(t - 1) < 1e-9);
    check("value", "jump x32 at 0.2, time 1: where the paper's code reports 0, the page's bound lies between y = 0 and the first step, and the program waits at y = 0", M.belowFirstStep(m.rowB[i], m.h) && m.V[i][0] > m.gy[0], `bound ${m.rowB[i].toFixed(5)}, V(1, 0) ${m.V[i][0].toFixed(6)} vs g(0) 0.5`);
    const ep = exactPolicy(costOf({ id: "jump", params: { at: 0.2, factor: 32 } }), VIEW + SPARE), vs = M.valueSurface(costOf({ id: "jump", params: { at: 0.2, factor: 32 } }), VIEW + SPARE);
    let d = 0; for (let k = 0; k < ep.bounds.length; k++) if (!(ep.bounds[k] === vs.bounds[k])) d = Math.max(d, Math.abs(ep.bounds[k] - vs.bounds[k]));
    check("value", "jump x32: the chapter's program and model.js's exactPolicy place the bound below the first step the same way, step for step", d === 0, `largest difference ${d}`);
  }
  // the worker's rows and plotted series at a deadline that isn't on the plotting step
  for (const at of [0.45, 1, 2.35]) {
    const m = valueJob({ choice: { id: "deadline", params: { at, c: 0.1 } }, last: "far" });
    const last = m.t.length - 1, iT = m.times.length - 1;
    const vs = M.valueSurface(costOf({ id: "deadline", params: { at, c: 0.1 } }), at, { view: Math.min(at, VIEW) });
    const rowsOk = m.rowB.length === m.times.length && m.rowB.every((b, i) => b === (Number.isFinite(vs.bounds[Math.round(m.times[i] / m.dt)]) ? vs.bounds[Math.round(m.times[i] / m.dt)] : null));
    check("value", `a deadline at ${at}: the plotted series end at the deadline with both bounds 0, and every kept row carries its own step's bound`,
      Math.abs(m.t[last] - at) < 1e-9 && m.b[last] === 0 && m.pm[last] === 0 && rowsOk && Math.abs(m.times[iT] - Math.floor(at / 0.05 + 1e-9) * 0.05) < 1e-9,
      `last plotted time ${m.t[last]}, bounds ${m.b[last]} and ${m.pm[last]}; rows to ${m.times[iT]}`);
  }
  {
    const m = valueJob({ choice: { id: "jump", params: { at: 0.5, factor: 16 } }, last: "far" }), i = m.times.findIndex((t) => Math.abs(t - 0.05) < 1e-9);
    const vs = M.valueSurface(costOf({ id: "jump", params: { at: 0.5, factor: 16 } }), VIEW + SPARE);
    check("value", "the slice at time 0.05 reads the bound at 0.05, not at the next plotted time", m.rowB[i] === vs.bounds[5] && m.rowB[i] !== vs.bounds[6], `${m.rowB[i].toFixed(5)} at 0.05; ${vs.bounds[6].toFixed(5)} at 0.06`);
  }
  // a tap is read at the nearest kept sample, and printed there
  {
    const m = valueJob({ choice: { id: "jump", params: { at: 0.5, factor: 16 } }, last: "far" });
    const n = M.nearestSample(m.times, m.ys, 0.663, 0.27), s = S.valueVerdict({ ...n, W: m.V[n.i][n.j] - m.gy[n.j] }, { t: 0, W: 0.21 });
    check("words", "a tap at (0.663, 0.27) is read and printed at the nearest kept sample, (0.65, 0.28)", Math.abs(n.t - 0.65) < 1e-9 && Math.abs(n.y - 0.28) < 1e-9 && /time 0\.65, evidence 0\.28/.test(s), s.slice(0, 80) + "…");
  }
  // the best flat level on the program's own grid, against an independent scan of every level the grid can hold,
  // and below V(0, 0); the drawing that is 2 to time 0.2 and 0.01 after has two peaks, far apart
  // (the search is a scan and refinement, not every level: the drawing at 0.5 to 0.8, then 0.01, is one where it stops
  // about 2e-8 short of the level 0.43, below the displayed precision)
  const twoPeaks = { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i <= 2 ? 2 : 0.01)) };
  const halfThenLow = { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i <= 8 ? 0.5 : 0.01)) };
  const nameOf = (choice) => (choice === twoPeaks ? "a drawing at 2 through time 0.2, falling log-linearly to 0.01 at time 0.3, and 0.01 after" : choice === halfThenLow ? "a drawing at 0.5 through time 0.8, falling log-linearly to 0.01 at time 0.9, and 0.01 after" : choice.id);
  for (const [choice, step] of [[twoPeaks, 0.01], [halfThenLow, 0.01], [{ id: "draw", points: defaultDrawing().map(() => 2) }, 0.05], [{ id: "jump", params: { at: 0.5, factor: 16 } }, 0.05], [{ id: "deadline", params: { at: 1, c: 0.1 } }, 0.05]]) {
    const f = flatJob({ choice }), cost = costOf(choice), H = f.horizon, ts = Float64Array.from({ length: Math.round(H / 0.01) + 1 }, (_, k) => k * 0.01);
    let scan = -Infinity, at = 0;
    for (let x = step; x < 5 - 1e-9; x += step) { const v = score(Float64Array.from(ts, () => x), ts, cost, 0.02, 5).reward; if (v > scan) { scan = v; at = x; } }
    const v00 = valueJob({ choice, last: "far" }).v00;
    check("bill", `${nameOf(choice)}: the level the page's search finds on the program's grid scores within 1e-7 of the best level in a separate scan of (0, 5) every ${step} (or above it), at least the continuous best moved in, and no more than V(0, 0)`,
      f.grid >= scan - 1e-7 && f.grid >= f.shifted - 1e-12 && v00 >= f.grid - 1e-9, `level ${f.gridX.toFixed(4)} earns ${f.grid.toFixed(7)}; scan best ${scan.toFixed(7)} at ${at.toFixed(3)}; moved-in ${f.shifted.toFixed(6)}; V(0, 0) ${v00.toFixed(6)}`);
    if (choice === twoPeaks) {
      const s0 = S.earnVerdict({ b: 2.5, mine: M.flatOnSchedule(cost, 2.5), best: { b: f.b, net: f.net }, dp: v00, flat: f, deadline: null });
      const gain = (100 * (v00 - f.grid)).toFixed(1), at07 = score(Float64Array.from(ts, () => 0.07), ts, cost, 0.02, 5).reward;
      check("bill", "that drawing: the best level held flat on the grid is the fast one, near 0.07, not the slow one near the continuous best, and the printed gain from moving uses it", f.gridX < 0.2 && f.grid >= at07 - 1e-12 && s0.includes(`${gain} points per 100 decisions more`) && +gain <= 100 * (v00 - at07) + 1e-9,
        `level ${f.gridX.toFixed(4)}, ${f.grid.toFixed(7)} vs ${at07.toFixed(7)} at 0.07; printed gain ${gain} points`);
    }
  }
  // the search itself, through the worker's flatJob, on what it reports: the levels it scanned and their scores, the
  // peaks it refined in order, every level it scored inside each refined bracket, and the level it returned
  {
    const want = [...Array.from({ length: 16 }, (_, k) => 0.01 + 0.02 * k), ...Array.from({ length: 64 }, (_, k) => 0.35 + 0.05 * k), ...Array.from({ length: 14 }, (_, k) => 3.6 + 0.1 * k)];
    const rows = [], drawing = { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i <= 2 ? 2 : 0.01)) };
    let multi = 0;
    for (const [name, choice] of [["Constant 0.1", { id: "constant", params: { c: 0.1 } }], ["Constant 0.01", { id: "constant", params: { c: 0.01 } }], ["a deadline at 1", { id: "deadline", params: { at: 1, c: 0.1 } }],
      ["a drawing at 2 through time 0.2, falling log-linearly to 0.01 at time 0.3, and 0.01 after", drawing]]) {
      const f = flatJob({ choice }), q = f.search, cost = costOf(choice), ts = Float64Array.from({ length: Math.round(f.horizon / 0.01) + 1 }, (_, k) => k * 0.01);
      const sc = (x) => score(Float64Array.from(ts, () => x), ts, cost, 0.02, 5).reward;
      const levels = q.cap === 5 && q.scan.length === want.length && q.scan.every((x, i) => Math.abs(x - want[i]) < 1e-9);
      const scored = q.scores.length === q.scan.length && q.scan.every((x, i) => Math.abs(q.scores[i] - sc(x)) < 1e-12);
      const local = q.scores.map((v, i) => i).filter((i) => (i === 0 || q.scores[i] >= q.scores[i - 1]) && (i === q.scores.length - 1 || q.scores[i] >= q.scores[i + 1]))
        .sort((i, j) => q.scores[j] - q.scores[i]);
      const peaks = local;
      if (peaks.length > 1) multi++;
      const refined = q.refined.length === peaks.length && peaks.every((i, j) => {
        const r = q.refined[j];
        return r.peak === q.scan[i] && r.lo === q.scan[Math.max(0, i - 1)] && r.hi === q.scan[Math.min(q.scan.length - 1, i + 1)] && r.probes.length > 5
          && r.probes.every(([x, v]) => x >= r.lo && x <= r.hi && Math.abs(v - sc(x)) < 1e-12);
      });
      const all = [...q.scan.map((x, i) => [x, q.scores[i]]), ...q.refined.flatMap((r) => r.probes)], top = all.reduce((a, b) => (b[1] > a[1] ? b : a));
      const answer = f.grid === top[1] && f.gridX === top[0];
      rows.push({ ok: levels && scored && refined && answer, text: `${name}: ${q.scan.length} levels (${levels}), scores ${scored}; ${local.length} local peaks, ${q.refined.length} refined at ${q.refined.map((r) => r.peak).join(", ")} with ${q.refined.map((r) => r.probes.length).join(", ")} probes (${refined}); returned ${f.gridX.toFixed(7)}, the best of ${all.length} scores (${answer})` });
    }
    // the drawing is what its name says: 2 at times 0 to 0.2, 0.01 from 0.3, and log-linear between (sqrt(2 x 0.01) at 0.25)
    const dc = costOf(drawing);
    const shape = [0, 0.1, 0.2].every((t) => Math.abs(dc(t) - 2) < 1e-12) && [0.3, 1, 2.5, 8].every((t) => Math.abs(dc(t) - 0.01) < 1e-12) && Math.abs(dc(0.25) - Math.sqrt(0.02)) < 1e-12;
    check("bill", "flatJob's flat search, as it reports it, on Constant 0.1, Constant 0.01, a deadline at 1, and a drawing at 2 through time 0.2, falling log-linearly to 0.01 at time 0.3, and 0.01 after: its scanned levels are the caption's 94 below the cap of 5, each scored as model.js's scorer scores it; it refined every local peak of those scores, highest first (one each on the first three, both of the drawing's two); every level it scored around each refined peak lies between that peak's neighbors and is scored as the scorer scores it; and the level it returns has the highest of all those scores",
      rows.every((x) => x.ok) && multi > 0 && shape, `drawing as named: ${shape}; ` + rows.map((x) => x.text).join("; "));
  }
  // the bill on steep schedules, against a fine midpoint rule with the same series
  {
    const alt = { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i % 2 ? 2 : 0.01)) };
    const cases = [[alt, 1], [alt, 0.3], [alt, 2.2], [{ id: "jump", params: { at: 0.2, factor: 32 } }, 0.6], [{ id: "pulse", params: { at: 0.2, factor: 32 } }, 1], [{ id: "wave", params: { omega: 8, size: 0.6 } }, 1.2]];
    let worst = 0, where = "", printed = true, pwhere = "";
    for (const [choice, b] of cases) {
      const cost = costOf(choice), o = M.flatOnSchedule(cost, b);
      const end = Math.log(1 / 1e-12) / ((1 + (Math.PI / (2 * b)) ** 2) / 2) + 1, hh = Math.min(5e-5, (b * b) / 2000);
      let ref = 0; for (let s0 = hh / 2; s0 < end; s0 += hh) ref += cost(s0) * K.survival(0, s0, b) * hh;
      const d = Math.abs(o.bill - ref);
      if (d > worst) { worst = d; where = `${choice.id} at b = ${b}: ${o.bill.toFixed(7)} vs ${ref.toFixed(7)}`; }
      for (const [mine, theirs] of [[o.bill, ref], [o.net, M.g(b) - ref]]) if (mine.toFixed(3) !== theirs.toFixed(3)) { printed = false; pwhere = `${choice.id} at b = ${b}: ${mine.toFixed(3)} vs ${theirs.toFixed(3)}`; }
    }
    check("bill", "on steep schedules (a drawing alternating 0.01 and 2, x32 steps, a fast wave), the bill matches a midpoint rule with steps of 5e-5 or finer, within 2e-6", worst < 2e-6, where);
    check("bill", "on the same six cases, the printed bill and net, to three decimals, are those of the fine midpoint rule", printed, pwhere || "the same");
  }
  // one path's outcome: the chance of being right at the check where it stops, g(|X|), not g(b)
  {
    const path = M.samplePath(2026, { tMin: VIEW }), cum = M.cumulativeCost(costOf({ id: "jump", params: { at: 0.5, factor: 16 } }), path.x.length, path.dt);
    const o = M.pathOutcome(path, 0.05, cum), s = S.pathSay(o);
    check("bill", "the default path at b = 0.05: its chance of being right is g(|X|) at the check where it stops, which differs from g(b), and the sentence prints it", Math.abs(o.right - M.g(Math.abs(path.x[o.k]))) < 1e-15 && Math.abs(o.right - M.g(0.05)) > 5e-4 && s.includes(o.right.toFixed(3)),
      `X = ${o.x.toFixed(5)} at time ${o.tau.toFixed(3)}: g(|X|) = ${o.right.toFixed(5)} vs g(b) = ${M.g(0.05).toFixed(5)}`);
    const d = M.pathOutcome(path, 3, cum, 0.45);
    const ds = S.pathSay(d), os = S.pathSay(o);
    check("bill", "a path still open at a deadline of 0.45 is forced at the deadline's own check, step 450, at its own evidence, and the sentence says so", d.forced && d.k === 450 && d.right === M.g(Math.abs(path.x[450])) && /at the deadline, time 0\.45/.test(ds) && !/before the deadline/.test(ds), `forced at step ${d.k}, X = ${d.x.toFixed(4)}: ${ds.slice(0, 60)}…`);
    check("bill", "the default path at b = 0.05: the sentence gives its check time to three decimals and names the moved-in threshold", os.includes(`time ${o.tau.toFixed(3)}`) && o.tau.toFixed(3) === "0.006" && os.includes(`moved in by ${o.shift.toFixed(3)}`), os.slice(0, 110) + "…");
  }
  // the reader's bound against the best flat bound, by what it earns
  {
    const cost = costOf({ id: "draw", points: defaultDrawing().map(() => 2) }), best = M.bestFlat(cost), mine = M.flatOnSchedule(cost, 0.105);
    const s = S.earnVerdict({ b: 0.105, mine, best, dp: NaN, flat: null, deadline: null });
    check("words", "a drawing held at 2 and a guess of 0.105: the verdict states the shortfall in points, not a match", /points per 100 decisions less/.test(s) && !/within 0\.05/.test(s), s.slice(0, 120) + "…");
  }
  // the printed levels enclose the cost, rounded outward
  {
    const R = K.rng(91);
    const choices = [{ id: "wave", params: { omega: 8, size: 0.6 } }, { id: "smooth", params: { c0: 0.1, size: 1 } }, { id: "jump", params: { at: 0.5, factor: 16 } }, { id: "piecewise", params: { scale: 1, length: 0.8 } },
      ...PRESETS.filter((p) => !["rising", "deadline", "constant"].includes(p.id)).map((p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.min + Math.round(((q.max - q.min) * R.next()) / q.step) * q.step])) }))];
    let ok = true, detail = "";
    for (const ch of choices) {
      const st = M.standing(ch), P = M.printedLevels(st), cost = costOf(ch);
      let lo = Infinity, hi = 0; for (let i = 0; i <= 700000; i++) { const v = cost(i / 10000); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (!(P.lo <= lo * (1 + 1e-12) && P.hi >= hi * (1 - 1e-12) && st.lo <= lo * (1 + 1e-9) && st.hi >= hi * (1 - 1e-9))) { ok = false; detail = `${ch.id} ${JSON.stringify(ch.params)}: printed [${P.lo}, ${P.hi}], found [${lo}, ${hi}], dense [${lo}, ${hi}]`; }
      if (!(P.bandLo <= M.B(P.hi) && P.bandHi >= M.B(P.lo))) { ok = false; detail = `${ch.id}: band [${P.bandLo}, ${P.bandHi}] vs [${M.B(P.hi)}, ${M.B(P.lo)}]`; }
    }
    check("standing", `the printed levels, rounded outward, enclose the cost sampled every 0.0001 to time 70 (to floating-point rounding, 1e-12), and the printed band encloses B(c_max) to B(c_min), on ${choices.length} settings`, ok, detail || "enclosed");
    const cases = [[0.1, -1, 0.1], [0.0335838, -1, 0.033], [0.159999999873, 1, 0.16], [0.100068, -1, 0.1], [1.6, 1, 1.6], [0.0999999999, -1, 0.099]];
    check("standing", "outward rounding to two figures: 0.1 stays 0.1, 0.0335838 goes down to 0.033, 0.159999999873 up to 0.16, and 0.100068 down to 0.1", cases.every(([x, d, w]) => M.outward(x, d) === w), cases.map(([x, d]) => M.outward(x, d)).join(", "));
  }
  // the remaining sentences on their edge cases
  {
    const forced = S.sliceSay(2.5, 0, 0.5, 0, true), atOnce = S.sliceSay(1.2, 0, 0.5, 0, false), slide = S.slideSay(0.02, M.B(0.02), M.Bprime(0.02), M.B(0.04), M.B(0.03));
    check("words", "a slice where the bound is 0 says the choice is forced only at the last moment, and otherwise that the program decides at once", /forced/.test(forced) && /decides at once/.test(atOnce) && !/forced/.test(atOnce), atOnce);
    check("words", "at c = 0.02, the slide sentence gives the tangent's estimate for +0.01 and the actual drop", slide.includes((-M.Bprime(0.02) * 0.01).toFixed(3)) && slide.includes((M.B(0.02) - M.B(0.03)).toFixed(3)), slide);
    const near = S.peakVerdict(1.334695, 0.1, M.B(0.1), 0.819, 0.12);
    check("words", "a guess 0.009 from the peak is called within 0.01, not right to two decimals", /within 0\.01/.test(near) && !/two decimals/.test(near), near.slice(0, 60));
    const dl = S.standingSay(M.standing({ id: "deadline", params: { at: 1, c: 0.1 } }), "Deadline");
    check("words", "the deadline verdict points to the measurement chapters, not a section number", /chapters 9 and 10/.test(dl) && !/Section/.test(dl), dl.slice(-80));
  }
}

// ---- round 3: deadlines printed as set, the last check before a deadline, the threshold's wording, the axis -------
{
  const { valueJob } = await import("../../book/assets/js/ch03-worker.js");
  for (const at of [2.35, 2.55, 0.45, 3]) {
    const m = valueJob({ choice: { id: "deadline", params: { at, c: 0.1 } }, last: "far" }), note = S.lastNote("far", m.deadline);
    const state = S.valueState(m, m.b.some((v) => M.belowFirstStep(v, m.h)));
    check("value", `a deadline at ${at}: the note (lastNote) and the solver line (valueState, which the plate prints as it comes) give the forced-choice time as ${at}, the time the program used${at > 2.5 ? ", and the note says the map stops at the window's end" : ""}`,
      m.horizon === at && note.includes(`time ${at},`) && state.includes(`the choice forced at time ${at}.`) && (at > 2.5 ? /stop at 2\.5/.test(note) && Math.abs(m.t[m.t.length - 1] - 2.5) < 1e-9 : true),
      `${note.slice(0, 90)}… | ${state.slice(0, 90)}…`);
  }
  {
    const m = valueJob({ choice: { id: "deadline", params: { at: 0.8, c: 0.1 } }, last: "far" }), n = m.t.length;
    const vs = M.valueSurface(costOf({ id: "deadline", params: { at: 0.8, c: 0.1 } }), 0.8, { view: 0.8 });
    const [xs, ys] = M.mapCurves(m).b;
    check("value", "a deadline at 0.8: the worker's plotted bound keeps the last check before it, 0.79, and the map's curve (mapCurves, which the plate draws as it comes) drops straight down at 0.8 from that check's bound to 0",
      Math.abs(m.t[n - 2] - 0.79) < 1e-9 && m.b[n - 2] === vs.bounds[79] && ys[ys.length - 2] === vs.bounds[79] && xs[xs.length - 2] === 0.8 && xs[xs.length - 1] === 0.8 && ys[ys.length - 1] === 0 && Math.abs(xs[xs.length - 3] - 0.79) < 1e-9,
      `0.79: ${m.b[n - 2].toFixed(4)} (the program's ${vs.bounds[79].toFixed(4)}); 0.78: ${m.b[n - 3].toFixed(4)}`);
  }
  {
    const s0 = S.sliceSay(1, 0.01814, 0.508359, 0.008359);
    check("words", "a bound below the first grid step is described as where deciding starts to beat waiting, read between grid points, with V = g only at the grid points above it, and the program waiting at y = 0", /between the grid's evidence points/.test(s0) && /at the grid points above it, V = g/.test(s0) && /still waits at y = 0 and decides at y = 0\.02/.test(s0) && !/equal above it/.test(s0), s0.slice(-150));
    // a positive bound that would round to 0.000 (Rising from 0 at rate 1.75, time 2.20, far horizon), through the worker
    // and sliceReads, whose marker text, tiles, and sentence the slice prints as they come
    const r = valueJob({ choice: { id: "rising", params: { at: 0, rate: 1.75 } }, last: "far" });
    const row = (t) => r.times.findIndex((x) => Math.abs(x - t) < 1e-9), i = row(2.2), z = row(2.25), most = { W: 0.149 };
    const b = r.rowB[i], w = r.V[i][0] - r.gy[0], wz = r.V[z][0] - r.gy[0], A = S.sliceReads(r, i, most), Z = S.sliceReads(r, z, most);
    check("words", "Rising from 0 at rate 1.75, the worker's value reply and the payload sliceReads returns from it (marker text, tile text, and sentence; not the slice's rendering): at 2.20 the bound is positive and would round to 0.000, so the marker text is \"threshold < 0.001\", the bound and W(t, 0) tiles \"< 0.001\", and the sentence says the program still waits at y = 0; at 2.25 the bound and W(t, 0) are 0, the marker text is null, the tiles are 0.000, and the sentence says it decides at once",
      b > 0 && b < 0.0005 && w > 1e-12 && A.marker === "threshold < 0.001" && A.tiles.bound === "< 0.001" && A.tiles.W === "< 0.001" && A.tiles.V === r.V[i][0].toFixed(3)
      && /W < 0\.001, though above 0/.test(A.say) && /The bound, < 0\.001, is below the grid's first evidence step, 0\.02: the program still waits at y = 0/.test(A.say) && !/0\.000/.test(A.say)
      && r.rowB[z] === 0 && Math.abs(wz) <= 1e-12 && Z.marker === null && Z.tiles.bound === "0.000" && Z.tiles.W === "0.000" && /decides at once/.test(Z.say)
      && S.boundShown(0.0123) === "0.012" && S.boundShown(0.53) === "0.53", `bound ${b.toExponential(3)}, W ${w.toExponential(3)}: ${A.marker}; tiles ${Object.values(A.tiles).join(", ")}; at 2.25 W ${wz}, tiles ${Object.values(Z.tiles).join(", ")}`);
    // a bound just below the first step prints below it: Rising from 0.95 at rate 1.95, time 2.50 (bound 0.019920)
    {
      const v = valueJob({ choice: { id: "rising", params: { at: 0.95, rate: 1.95 } }, last: "far" }), k = v.times.findIndex((x) => Math.abs(x - 2.5) < 1e-9), B = S.sliceReads(v, k, most);
      check("words", "Rising from 0.95 at rate 1.95, time 2.50, the worker's value reply and sliceReads (marker text, tile text, and sentence): the bound is between 0.0195 and 0.02, and all three print it as 0.0199, below the step the sentence compares it with, never 0.020; in boundShown, a bound from 0.0005 to below 0.02 prints with the fewest decimals from three to six that round below 0.02, and as \"just below 0.02\" when six round to 0.02 (0.0007 prints 0.001, 0.0199991 prints 0.019999, and 0.0199996 prints \"just below 0.02\"), and a positive bound below 0.0005 prints \"< 0.001\" (0.0004)",
        v.rowB[k] > 0.0195 && v.rowB[k] < 0.02 && B.marker === "threshold 0.0199" && B.tiles.bound === "0.0199" && B.say.includes("The bound, 0.0199, is below the grid's first evidence step, 0.02") && !/0\.020\b/.test(B.marker + B.tiles.bound + B.say)
        && S.boundShown(0.0004) === "< 0.001" && S.boundShown(0.0007) === "0.001" && S.boundShown(0.0199991) === "0.019999" && S.boundShown(0.0199996) === "just below 0.02" && S.boundShown(0.0123) === "0.012" && S.boundShown(0.05) === "0.050", `bound ${v.rowB[k].toFixed(7)}: ${B.marker}; tile ${B.tiles.bound}`);
    }
    let ok = true, d = "";
    for (const c of [0.03, 0.1, 0.3, 1]) { const B0 = M.B(c), lv = [0.7, 1, 1.3].map((k) => k * B0), top = M.slopeAxisTop(c, lv); for (const b of lv) { const v = c * (b + 0.5 * Math.sinh(2 * b)); if (v > top) { ok = false; d = `c = ${c}: dot at ${v.toFixed(3)} above ${top.toFixed(3)}`; } } }
    check("flat", "step 2 of the routes strip: at each selectable cost (0.03 to 1), the axis reaches every trial level's dot", ok, d || `at 0.03 the axis reaches ${M.slopeAxisTop(0.03, [0.7, 1, 1.3].map((k) => k * M.B(0.03))).toFixed(3)}`);
    check("words", "slider values print as set: a cost of 0.105 is 0.105, a deadline of 2.55 is 2.55", S.ft(0.105) === "0.105" && S.ft(2.55) === "2.55" && S.ft(0.1) === "0.1", `${S.ft(0.105)}, ${S.ft(2.55)}`);
  }
}
