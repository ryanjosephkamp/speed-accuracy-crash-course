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
check("flat", "the paper-code reference was computed at the book's tag", REF.commit === SRC.commit, `ch03.json from ${REF.tag} (${REF.commit.slice(0, 7)})`);
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
    for (const last of ["far", "window"]) {
      const H = s.kind === "deadline" ? s.at : last === "far" ? VIEW + SPARE : VIEW;
      const o = M.valueSurface(cost, H, { dt: REF.dt, h: REF.h, cap: REF.cap });
      const d = Math.abs(o.v00 - ref[last]); n++;
      if (d > worst) { worst = d; at = `${s.id}, ${last}`; }
    }
  }
  check("value", `V(0, 0) from the page's program matches the paper's backward_induction_x on ${n} schedules and last moments (within 1e-6)`, worst < 1e-6, `largest difference ${worst.toExponential(2)} (${at})`);
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
      S.pathSay({ b, tau: 3 * r(), side: r() < 0.5 ? 1 : -1, forced: i % 4 === 0, deadline: 0.4 + 2.6 * r(), xT: (r() - 0.5) * b, right: 0.5 + 0.5 * r(), bill: r() }),
      S.earnVerdict({ b, mine: { net, reward: r(), bill: r() }, best, dp: i % 3 ? r() : NaN, flatGrid: i % 2 ? r() : NaN, deadline: i % 5 ? null : 1 }),
      S.standingSay({ kind: kinds[i % kinds.length], lo: c, hi: c * (1 + 10 * r()), at: 0.4 + 2.6 * r(), continuous: true }, "Cost jumps", 1 + 5 * r()),
      S.valueVerdict(i % 3 ? { t: 2.5 * r(), y: 2 * r(), W: r() } : null, { t: 2.5 * r(), W: r() }),
      S.sliceSay(2.5 * r(), i % 7 ? 2 * r() : 0, 0.5 + 0.5 * r(), 0.5 * r()),
      S.lastNote(i % 2 ? "far" : "window", i % 3 ? null : 1),
      S.peakVerdict(i % 4 ? 3 * r() : null, c, M.B(c), M.flatReward(M.B(c), c), M.gPrime(M.B(c))),
      S.routesSay(i % 5, c, M.B(c)),
      S.doubleVerdict(i % 4 ? 2.4 * r() : null, 0.1, M.B(0.1), M.B(0.2), M.B(0.1) + M.Bprime(0.1) * 0.1),
      S.slideSay(c, M.B(c), M.Bprime(c), M.B(2 * c)),
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
  const same = S.earnVerdict({ b: 1.2, mine: { net: 0.77, reward: 0.9, bill: 0.13 }, best: { b: 1.2, net: 0.77 }, dp: 0.79, flatGrid: 0.768, deadline: null });
  check("words", "a bound at the best flat bound is called as good, and the moving bound's gain on the grid is stated", /as good/.test(same) && /2\.2 points per 100 decisions more/.test(same), same.slice(0, 80) + "…");
}
