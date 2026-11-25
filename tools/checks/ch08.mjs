// Chapter 8: the weighted look-ahead rule and the averaged-cost rule against the paper's code at the tag, the page's
// dynamic program and scorer against Table 4, the facts behind the iteration plates and Proposition 13's strip, the
// map whose crossings are the equation's solutions, Algorithm 1's kernel bins, and the sentences under the plates.
//
// The paper's code's own outputs come from tools/validity/ch08.json, which tools/validity/ch08.py writes by running
// that code at the tag (shortcuts.weighted_ahead) and reading its experiments/results/showcase.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as K from "../../book/assets/js/kernel.js";
import { weightedBound, boundForCost, kernelForBound, boundaryKernel, toDiscrete, exactPolicy } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS, DRAW_TIMES } from "../../book/assets/js/schedules-book.js";
import * as R from "../../book/assets/js/ch08-rule.js";
import * as S from "../../book/assets/js/say-ch08.js";
import { check, N, SIN, tableNumbers, ROOT } from "./lib.mjs";
import { frame, line } from "../../book/assets/js/chart.js";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch08.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
check("rule", "chapter 8's reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit,
  `ch08.json from ${REF.tag} (${REF.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);

const FIG1 = ["jump", "fall", "rising", "deadline"];
const times = (end) => Array.from({ length: Math.round(end * 10) + 1 }, (_, k) => +(k * 0.1).toFixed(10));
const fig1 = (id) => { const choice = { id }; return { cost: costOf(choice), deadline: deadlineOf(choice), choice }; };

// ---- the weighted rule: model.js and the page's history against the paper's code ------------------------------
for (const id of FIG1) {
  const { cost, deadline } = fig1(id);
  const ts = Float64Array.from(times(deadline ?? 2.5));
  const w = weightedBound(cost, ts), h = R.weightedHistory(cost, ts);
  const same = w.every((v, i) => v === h.final[i]);
  check("rule", `${id}: the page's 30th update equals model.js's weightedBound exactly`, same, same ? "bit for bit" : "differs");
  const ref = REF.showcase.weighted[id];
  const aligned = ref.t.every((x, i) => Math.abs(x - ts[i]) < 1e-9);
  const worst = aligned ? Math.max(...ref.weighted.map((v, i) => Math.abs(toDiscrete(w[i], 0.002) - v))) : Infinity;
  check("rule", `${id}: model.js's weighted rule against showcase.json at the tag (within 5.1e-5, its 4-decimal rounding)`, worst <= 5.1e-5, `largest difference ${worst.toExponential(1)} over ${ref.t.length} times`);
}

// the sinusoid of Table 1: the weighted rule's swing and lead, fit on the paper's own grid (dt = 0.002)
function fit(ts, d, om) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
  for (let k = 0; k < ts.length; k++) { const r = [Math.sin(om * ts[k]), Math.cos(om * ts[k]), 1]; for (let i = 0; i < 3; i++) { y[i] += r[i] * d[k]; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } }
  const M = A.map((r, i) => [...r, y[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < 3; r++) { if (r === i) continue; const f = M[r][i] / M[i][i]; for (let c = i; c <= 3; c++) M[r][c] -= f * M[i][c]; } }
  const [a, b] = M.map((r, i) => r[3] / r[i]);
  return [Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI];
}
for (const row of SIN) {
  const om = row[0], [, , , , , gainW, leadW] = row;
  const c0 = 0.1, eps = 0.01, period = (2 * Math.PI) / om, length = period * Math.max(2, Math.ceil(6 / period)), H = 2 + length + 6;
  const all = []; for (let k = 0; k * 0.002 <= H + 0.001; k++) all.push(k * 0.002);
  const ts = Float64Array.from(all.filter((t) => t > 2 && t < 2 + length));
  const f = (t) => c0 + eps * Math.sin(om * t), base = boundForCost(c0);
  const fw = fit(ts, Array.from(weightedBound(f, ts), (v) => v - base), om);
  const fa = fit(ts, Array.from(R.averagedCost(f, ts), (v) => v - base), om);
  const fp = fit(ts, Array.from(ts, (t) => boundForCost(f(t)) - base), om);
  const lead = (x) => ((((x[1] - fp[1] + 180) % 360) + 360) % 360) - 180;
  const ref = REF.showcase.fits[String(om)];
  check("rule", `Table 1 at omega = ${om}: the weighted rule's swing ${gainW} and lead ${leadW} as printed`, (fw[0] / fp[0]).toFixed(3) === gainW.toFixed(3) && lead(fw).toFixed(1) === leadW.toFixed(1), `${(fw[0] / fp[0]).toFixed(3)}, ${lead(fw).toFixed(1)}`);
  check("rule", `omega = ${om}: the weighted rule's fit against showcase.json (amplitude within 1e-10, phase within 1e-6 degrees)`, Math.abs(fw[0] - ref.weighted[0]) < 1e-10 && Math.abs(fw[1] - ref.weighted[1]) < 1e-6, `${fw[0].toPrecision(12)}, ${fw[1].toFixed(8)}`);
  check("avg", `omega = ${om}: the averaged-cost rule's fit against showcase.json (amplitude within 1e-10, phase within 1e-6 degrees)`, Math.abs(fa[0] - ref.averagedCost[0]) < 1e-10 && Math.abs(fa[1] - ref.averagedCost[1]) < 1e-6, `${fa[0].toPrecision(12)}, ${fa[1].toFixed(8)}`);
}

// ---- the averaged-cost rule ------------------------------------------------------------------------------------
// As the paper's code computes it (averagedCost with no deadline given), on Figure 1's four schedules and on two
// deadlines its kernels reach late, against weighted_ahead at the tag.
const CODE_CASES = {
  jump: fig1("jump"), fall: fig1("fall"), rising: fig1("rising"), deadline: fig1("deadline"),
  "deadline-0.5-3": R.scheduleFor({ id: "deadline", params: { at: 3, c: 0.5 } }),
  "jump-deadline-2": R.scheduleFor({ id: "jump" }, 2),
  "deadline-1-1": R.scheduleFor({ id: "deadline", params: { at: 1, c: 1 } }),
};
for (const [id, { cost }] of Object.entries(CODE_CASES)) {
  const ref = REF.averagedCost[id];
  const a = R.averagedCost(cost, ref.t, null);
  const worst = Math.max(...ref.bound.map((v, i) => Math.abs(a[i] - v)));
  check("avg", `${id}: the averaged-cost rule as the paper's code computes it, against weighted_ahead (within 1e-9)`, worst < 1e-9, `largest difference ${worst.toExponential(1)} over ${ref.t.length} times`);
}
{
  // the plate's own run on the late-reach deadline: its code-version curve matches weighted_ahead where the times meet
  const { cost, deadline } = CODE_CASES["deadline-0.5-3"], r = R.compareRules(cost, deadline), ref = REF.averagedCost["deadline-0.5-3"];
  let worst = 0, met = 0;
  ref.t.forEach((t, i) => { const k = r.t.findIndex((x) => Math.abs(x - t) < 1e-9); if (k >= 0) { met++; worst = Math.max(worst, Math.abs(r.avgCode[k] - ref.bound[i])); } });
  check("avg", "the plate's run at a cost of 0.5 with a forced choice at 3: its code-version curve matches weighted_ahead (within 1e-9)", met > 20 && worst < 1e-9, `${met} times, largest difference ${worst.toExponential(1)}`);
  const st = R.codeStretches(r), st1 = R.codeStretches(R.compareRules(...Object.values(R.scheduleFor({ id: "deadline" })).slice(0, 2)));
  check("avg", "the code's version is above 0 on one plotted stretch from time 0 at (0.5, 3), and nowhere on Figure 1(d)", st.length === 1 && st[0][0] === 0 && st[0][1] > 0.5 && st[0][1] < 3 && st1.length === 0, `${JSON.stringify(st)}; on Figure 1(d): ${JSON.stringify(st1)}`);
  // the jump with a deadline added at 2: the code's bound is 0 at first, then finite, then 0; the plate's stretches agree
  // with weighted_ahead at every time the two share
  const j = CODE_CASES["jump-deadline-2"], rj = R.compareRules(j.cost, j.deadline), sj = R.codeStretches(rj), refj = REF.averagedCost["jump-deadline-2"];
  const inside = (t) => sj.some(([a, b]) => t >= a - 1e-9 && t <= b + 1e-9);
  const disagree = refj.t.filter((t, i) => rj.t.some((x) => Math.abs(x - t) < 1e-9) && (refj.bound[i] > 0) !== inside(t));
  check("avg", "the jump with a deadline added at 2: the code's bound is 0 at time 0, above 0 on the plotted times from 0.48 to 1.72, and 0 again before the deadline, as weighted_ahead gives at the shared times", sj.length === 1 && Math.abs(sj[0][0] - 0.48) < 1e-9 && Math.abs(sj[0][1] - 1.72) < 1e-9 && rj.avgCode[0] === 0 && disagree.length === 0, `${JSON.stringify(sj)}; disagreements ${disagree.length}`);
  // a deadline inside a kernel's last bin, past the bin's midpoint: the code averages only at midpoints, so its bound
  // stays finite there (a cost of 1, a forced choice at 1, seen from 0.34)
  const k1 = CODE_CASES["deadline-1-1"], r1 = R.compareRules(k1.cost, k1.deadline), i34 = r1.t.findIndex((x) => Math.abs(x - 0.34) < 1e-9);
  const ker = R.kernelForCost(1), lastEdge = ker.edges[240], lastMid = ker.s[239], ref1 = REF.averagedCost["deadline-1-1"], j34 = ref1.t.findIndex((x) => Math.abs(x - 0.34) < 1e-9);
  check("avg", "a cost of 1 with a forced choice at 1, seen from 0.34: the deadline lies between the kernel's last midpoint and its last edge, and the code's bound there is finite and equals weighted_ahead's (within 1e-9)", lastMid < 0.66 && lastEdge > 0.66 && r1.avgCode[i34] > 0 && Math.abs(r1.avgCode[i34] - ref1.bound[j34]) < 1e-9, `last midpoint ${lastMid.toFixed(6)}, last edge ${lastEdge.toFixed(6)}, bound ${r1.avgCode[i34].toFixed(6)} vs ${ref1.bound[j34].toFixed(6)}`);
}
{
  // the definition: before a deadline, the exact kernel for the current cost puts positive weight past the deadline at
  // every plotted time, so the kernel-weighted cost is infinite and B of it is 0 (Lemma 6(a))
  const cases = [["Figure 1(d)", fig1("deadline")], ["(0.5, 3)", CODE_CASES["deadline-0.5-3"]], ["jump, deadline added at 2", CODE_CASES["jump-deadline-2"]],
    ["constant, deadline added at 1", R.scheduleFor({ id: "constant" }, 1)]];
  for (const [name, { cost, deadline }] of cases) {
    const r = R.compareRules(cost, deadline);
    let least = Infinity;
    r.t.forEach((t) => { if (t < deadline - 1e-9) least = Math.min(least, R.tailExact(Math.max(boundForCost(cost(t)), 1e-3), deadline - t)); });
    check("avg", `${name}: the plate's averaged-cost curve by the definition is 0 at all ${r.t.length} plotted times, and at each one before the deadline the exact kernel puts positive weight past it`, r.avg.every((v) => v === 0) && least > 0, `smallest weight past the deadline, about ${least.toExponential(1)}`);
  }
  // the tail each code kernel leaves out, at the level that kernel was built for (B at the rounded log cost)
  const tails = [0.01, 0.1, 0.5, 1.6, 20].map((c) => { const key = Math.round(Math.log(c) * 100) / 100, b = Math.max(boundForCost(Math.exp(key)), 1e-3); return R.tailExact(b, R.kernelForCost(c).edges[240]); });
  check("avg", "the code's kernels, which end at 14/lambda_1, leave out less than one part in a million of the weight of the level each was built for (costs 0.01 to 20)", tails.every((v) => v > 0 && v < 1e-6), tails.map((v) => v.toExponential(1)).join(", "));
  // a finite cost always has a positive bound: only an infinite one gives 0 (the text says so)
  check("avg", "the constant-cost bound stays above 0 for finite costs (1e4 and 1e8) and is 0 only for an infinite cost", boundForCost(1e4) > 0 && K.B(1e8) > 0 && boundForCost(Infinity) === 0, `B(1e4) = ${boundForCost(1e4).toExponential(2)}, B(1e8) = ${K.B(1e8).toExponential(2)}`);
  const r = R.compareRules(costOf({ id: "jump" }), null);
  check("avg", "on the 16-fold jump, the averaged-cost rule starts below half the best bound (as the text says)", r.avg[0] < 0.5 * r.exact[0], `${r.avg[0].toFixed(3)} vs ${r.exact[0].toFixed(3)}`);
}

// ---- the deadline: the hero, the equation for t < T, and the forced choice ------------------------------------------
{
  const { cost, deadline } = fig1("deadline");
  const ts = [0.2, 0.4, 0.6, 0.8, 0.9, 0.96], w = R.weightedHistory(cost, ts).final;
  // the hero's share is the exact kernel's weight before the deadline: against kernel.js's series mass
  const gap = Math.max(...ts.map((t, i) => Math.abs(R.shareExact(w[i], deadline - t) - K.kernelMass(0, deadline - t, w[i]))));
  check("deadline", "the hero's share (the exact kernel's weight before the deadline) against kernel.js's series mass (within 2e-4)", gap < 2e-4, `largest difference ${gap.toExponential(1)}`);
  const roots = ts.map((t) => R.selfConsistent(t, cost, 0.05, 1.5, 60, deadline));
  const off = Math.max(...ts.map((t, i) => (roots[i].length === 1 ? Math.abs(w[i] - roots[i][0].b) : Infinity)));
  check("deadline", "at the hero's times, Algorithm 1's bound is within 0.01 of the equation's solution B(0.1) times its own kernel's share before the deadline", off < 0.01, `largest difference ${off.toFixed(4)}`);
  const c95 = R.scheduleFor({ id: "deadline", params: { at: 0.95, c: 0.1 } }), r = R.compareRules(c95.cost, c95.deadline);
  const fall2 = R.scheduleFor({ id: "fall", params: { at: 1.5, factor: 16 } }, 2), rf = R.compareRules(fall2.cost, fall2.deadline), rd = R.compareRules(cost, deadline);
  const above = [rf, rd].every((x) => x.wb.every((v, i) => x.t[i] >= x.deadline - 1e-9 || v > 0));
  check("deadline", "the weighted rule's bound stays above 0 at every plotted time before the deadline (Figure 1(d), and a 16-fold fall at 1.5 with a deadline added at 2)", above, "both");
  check("endpoint", "a deadline at 0.95, off the 0.02 grid: the plates' last point is the deadline, where the program's bound is 0 (the forced choice)", Math.abs(r.t[r.t.length - 1] - 0.95) < 1e-9 && r.exact[r.exact.length - 1] === 0 && r.updates[30].length === r.t.length, `last time ${r.t[r.t.length - 1].toFixed(2)}, bound ${r.exact[r.exact.length - 1]}`);
}

// ---- the page's dynamic program and scorer against Table 4 -------------------------------------------------------
{
  const T4 = tableNumbers("tab_showcase");
  FIG1.forEach((id, i) => {
    const { cost, deadline } = fig1(id);
    const r = R.compareRules(cost, deadline);
    const [, pm, wb] = T4[i];
    check("program", `${id}: the page's losses against Table 4 (per-moment within 5%, weighted within 0.006; the page's grid is 5 times coarser in time and 4 in evidence)`,
      Math.abs(r.loss.pm / pm - 1) < 0.05 && Math.abs(r.loss.wb - wb) < 0.006, `${r.loss.pm.toFixed(3)} and ${r.loss.wb.toFixed(4)} vs ${pm} and ${wb}`);
  });
}

// ---- the iteration --------------------------------------------------------------------------------------------
const movesOf = (r) => { const ch = []; for (let k = 1; k < r.updates.length; k++) { let m = 0; for (let i = 0; i < r.t.length; i++) m = Math.max(m, Math.abs(r.updates[k][i] - r.updates[k - 1][i])); ch.push(m); } return ch; };
{
  const wave = movesOf(R.compareRules(costOf({ id: "wave" }), null));
  const ratios = [2, 3, 4, 5].map((k) => wave[k + 1] / wave[k]);
  check("iterate", "a small change (the wave): each update moves the bound about half as far as the one before (ratios within 0.4 to 0.6)", ratios.every((q) => q > 0.4 && q < 0.6), ratios.map((q) => q.toFixed(3)).join(", "));
  check("iterate", "the wave settles to 0.001 within the 30 updates", S.settledAt(wave) !== null, `update ${S.settledAt(wave)}`);
  for (const id of ["deadline", "pulse"]) {
    const { cost, deadline } = fig1(id);
    const ch = movesOf(R.compareRules(cost, deadline));
    check("iterate", `${id}: Algorithm 1's 30 updates don't settle to 0.001 (as the text says)`, S.settledAt(ch) === null, `the 30th moves ${ch[29].toExponential(1)}`);
  }
  {
    const pulse = fig1("pulse"), roots = R.selfConsistent(1, pulse.cost, 0.01, 2.5, 120);
    check("iterate", "the pulse at t = 1: one crossing, where the map's slope is between 0.5 and 1, so each damped update closes only a small part of the distance (as the text says)", roots.length === 1 && roots[0].slope > 0.5 && roots[0].slope < 1, `slope ${roots[0]?.slope.toFixed(2)}`);
  }
  const dl = fig1("deadline");
  {
    // the equation's map, integrated exactly to the deadline, crosses once at each time with a slope between -1 and 0,
    // and the ideal damped update settles; Algorithm 1's map jumps near that crossing, which is why its updates don't
    const times2 = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.96, 0.98];
    const bad = [];
    for (const t of times2) {
      const rs = R.selfConsistent(t, dl.cost, 0.01, 2, 120, dl.deadline);
      let b = boundForCost(dl.cost(t)), last = 0;
      for (let k = 0; k < 30; k++) { const nb = 0.5 * (b + R.mapExact(b, t, dl.cost, dl.deadline)); last = Math.abs(nb - b); b = nb; }
      if (rs.length !== 1 || !(rs[0].slope < 0 && rs[0].slope > -1) || Math.abs(rs[0].residual) > 1e-9 || last > 1e-8) bad.push(`${t}: ${rs.length} crossings, slope ${rs[0]?.slope.toFixed(3)}, 30th move ${last.toExponential(0)}`);
    }
    check("iterate", "Figure 1(d) at 12 times to 0.98: the equation's map crosses once (residual below 1e-9) with a slope between -1 and 0, and its ideal damped updates settle to 1e-8", bad.length === 0, bad.join("; ") || "all settle");
    const r7 = R.selfConsistent(0.7, dl.cost, 0.01, 2, 120, dl.deadline)[0].b;
    const g = (x) => R.mapAlg(x, 0.7, dl.cost) - x, steps = Array.from({ length: 120 }, (_, i) => r7 - 0.006 + i * 0.0001).map((x) => [x, Math.abs(g(x + 0.0001) - g(x) + 0.0001)]);
    const [at, jump] = steps.reduce((m, v) => (v[1] > m[1] ? v : m), [0, 0]);
    const rr = R.compareRules(dl.cost, dl.deadline), mv = (t) => { const i = rr.t.findIndex((x) => Math.abs(x - t) < 1e-9); return Math.abs(rr.updates[30][i] - rr.updates[29][i]); };
    check("iterate", "Figure 1(d): the 30th update still moves the bound by more than 0.001 at 0.70 and by less than 1e-6 at 0.94 (the text names both)", mv(0.7) > 1e-3 && mv(0.94) < 1e-6, `${mv(0.7).toExponential(1)} at 0.70, ${mv(0.94).toExponential(1)} at 0.94`);
    check("iterate", "at t = 0.7, Algorithm 1's map (rounded levels, bin midpoints) jumps by more than 0.005 within 0.006 of the equation's crossing", jump > 0.005, `a jump of ${jump.toFixed(4)} at level ${at.toFixed(4)}; the crossing is at ${r7.toFixed(4)}`);
  }
  {
    // the rounding of levels to 0.001 leaves small moves that don't die out; with each level's own kernel they do
    const cost = costOf({ id: "jump" }), t = 0.28, p = R.weightedHistory(cost, [t]).updates.map((u) => u[0]);
    let b = boundForCost(cost(t)); const q = [b];
    for (let k = 0; k < 30; k++) { b = 0.5 * (b + R.mapExact(b, t, cost)); q.push(b); }
    const mv = (a) => Math.min(...[26, 27, 28, 29, 30].map((k) => Math.abs(a[k] - a[k - 1])));
    const mx = (a) => Math.max(...[26, 27, 28, 29, 30].map((k) => Math.abs(a[k] - a[k - 1])));
    check("iterate", "on the jump at t = 0.28, updates 26 to 30 still move the level by more than 1e-5 with levels rounded to 0.001, and by less than 1e-10 with each level's own kernel", mv(p) > 1e-5 && mx(q) < 1e-10, `rounded ${mv(p).toExponential(1)} or more, exact ${mx(q).toExponential(1)} or less`);
  }
  const small = R.moreUpdates((t) => 0.1 * (1 + 0.1 * Math.sin(2 * t)), null);
  check("iterate", "on a 10% wave, 300 updates move the bound from the 30th by less than 1e-6", small.move < 1e-6, small.move.toExponential(1));
  const more = R.moreUpdates(dl.cost, dl.deadline);
  check("iterate", "on Figure 1(d), 300 updates move the bound from the 30th by more than 0.001 and less than 0.05", more.move > 1e-3 && more.move < 0.05, `${more.move.toFixed(4)} at time ${more.at.toFixed(2)}`);
}

// ---- Proposition 13 ---------------------------------------------------------------------------------------------
{
  const runs = R.P13.EPS.map((e) => R.prop13(e));
  for (const r of runs) {
    const inside = r.map.every((v) => v >= r.lo - 1e-12 && v <= r.hi + 1e-12);
    check("p13", `eps = ${r.eps}: at the 41 computed levels the map's values lie in I, and a scan of the same 41 levels finds one crossing`, inside && r.crossings === 1, `I = [${r.lo.toFixed(4)}, ${r.hi.toFixed(4)}], values ${Math.min(...r.map).toFixed(4)} to ${Math.max(...r.map).toFixed(4)}`);
  }
  const sl = runs.map((r) => r.slope / r.eps);
  check("p13", "over the four sizes, the steepest secant slope between neighboring levels, divided by eps, falls as eps shrinks, and its largest value is below 0.2", sl.every((v, i) => i === 0 || v <= sl[i - 1]) && Math.max(...sl) < 0.2, sl.map((v) => v.toFixed(3)).join(", "));
  const e2 = runs.map((r) => r.errW / (r.eps * r.eps));
  check("p13", "over the four sizes, Algorithm 1's distance from b0 + eps beta divided by eps^2 varies little (the last three within 15% of each other)", Math.max(...e2.slice(1)) / Math.min(...e2.slice(1)) < 1.15, e2.map((v) => v.toFixed(4)).join(", "));
  const W2 = K.transfer(0.1, 2), want = Math.abs(K.Bprime(0.1)) * R.P13.M * Math.hypot(1 - W2.re, W2.im);
  const [a, b] = runs.slice(-2).map((r) => r.errPm / r.eps), lim = 2 * b - a;
  check("p13", "a straight-line extrapolation to eps = 0 of the per-moment gap divided by eps, from the two smallest sizes, is within 2% of |B'(c0)| M |1 - w~(-2i)|", Math.abs(lim / want - 1) < 0.02, `${lim.toFixed(4)} vs ${want.toFixed(4)}`);
  const d = R.levelDerivative(boundForCost(0.1));
  check("p13", "the kernel's derivative in the level has equal areas above and below zero (within 1e-4; the stretch [0, 1e-8] is left out)", Math.abs(d.above - d.below) < 1e-4 && d.above > 0.05, `${d.above.toFixed(6)} above, ${d.below.toFixed(6)} below`);
  let area = 0; for (let i = 1; i < d.ss.length; i++) area += 0.5 * (d.sw[i] + d.sw[i - 1]) * Math.log(d.ss[i] / d.ss[i - 1]);
  // near 0 the kernel is sqrt(2 / (pi s)) / (tanh b + b sech^2 b), so [0, 1e-8] holds about twice that times 1e-4
  const left = (2 * Math.sqrt(1e-8) * Math.sqrt(2 / Math.PI)) / K.fluxTotal(boundForCost(0.1));
  check("p13", "the kernel from the series has area 1 on the same grid, with the stretch below 1e-8 added (within 1e-5)", Math.abs(area + left - 1) < 1e-5, `${area.toFixed(6)} + ${left.toExponential(2)}`);
  check("p13", "at each of the four sizes, Algorithm 1's gap to beta (divided by eps) is smaller than the per-moment rule's (the step 5 heading)", runs.every((r) => r.errW < r.errPm), runs.map((r) => `${(r.errW / r.eps).toFixed(4)} < ${(r.errPm / r.eps).toFixed(3)}`).join(", "));
  const om = Array.from({ length: 196 }, (_, i) => 0.5 + i * 0.1), gap = Math.min(...om.map((w) => { const T = K.transfer(0.1, w); return Math.hypot(1 - T.re, T.im); }));
  check("p13", "|1 - w~(-i omega)| is 0 at omega = 0 and stays above 0.1 for omega from 0.5 to 20", K.transfer(0.1, 0).re === 1 && gap > 0.1, `smallest ${gap.toFixed(3)}`);
}

// ---- two levels that both fit ---------------------------------------------------------------------------------------
// A separate evaluation of the equation's map, to hold the page's to: Simpson's rule on the kernel's density (kernel.js's
// series) between the breaks (a drawing's knots, the start of Rising's rise, a deadline), P panels per stretch (256
// unless given), with the first stretch in u = sqrt(s) to take out the density's s^(-1/2). A drawing is flat past its
// last knot (and every cost is infinite past a deadline), so that tail is B times the exact tail weight; any other
// schedule is also cut every 0.25 time units to 3 and every 2 to 40, and only the kernel's weight past 39 is treated
// as flat. A different method from the page's (moments of the kernel on a fixed geometric grid).
function refMap(b, t, cost, deadline = null, breaks = [], P = 256) {
  const lv = Math.max(b, 1e-3), w = (x) => K.flux(x, lv) / K.fluxTotal(lv), f = (x) => boundForCost(cost(t + x));
  const cut = deadline === null ? Infinity : deadline - t;
  if (cut <= 0) return 0;
  let cuts = [...breaks.map((k) => k - t), cut].filter((x) => x > 0 && x < 40);
  if (breaks !== DRAW_TIMES) for (let x = 0.25; x < 40; x += x < 3 ? 0.25 : 2) cuts.push(x);
  cuts = [...new Set(cuts.filter((x) => x <= cut + 1e-12))].sort((a, c) => a - c);
  const simpson = (g, a, c) => { const h = (c - a) / P; let sum = g(a) + g(c); for (let i = 1; i < P; i++) sum += g(a + i * h) * (i % 2 ? 4 : 2); return (sum * h) / 3; };
  // the first stretch, in u = sqrt(s): w(u^2) 2u tends to 2 sqrt(2/pi) / (tanh b + b sech^2 b) at u = 0
  const c0 = 2 * Math.sqrt(2 / Math.PI) / K.fluxTotal(lv);
  let acc = simpson((u) => f(u * u) * (u === 0 ? c0 : w(u * u) * 2 * u), 0, Math.sqrt(cuts[0]));
  for (let i = 1; i < cuts.length; i++) acc += simpson((x) => f(x) * w(x), cuts[i - 1], cuts[i]);
  const last = cuts[cuts.length - 1];
  if (last < cut - 1e-12) acc += f(last + 1) * R.tailExact(lv, last);   // past the last break: flat (drawings), or 40
  return acc;
}
/** Each reported root against the separate evaluation: its residual there, and a sign change within 1e-3 around it. */
function verified(roots, t, cost, deadline, breaks) {
  return roots.map((q) => {
    const g = (x) => refMap(x, t, cost, deadline, breaks) - x;
    return { b: q.b, residual: g(q.b), signChange: Math.sign(g(q.b - 1e-3)) !== Math.sign(g(q.b + 1e-3)) };
  });
}
{
  const draw = (pts) => ({ id: "draw", points: DRAW_TIMES.map((t) => (t <= 0.2 + 1e-9 ? 1 : pts)) });
  const alt = { id: "draw", points: DRAW_TIMES.map((t, i) => (i % 2 ? 0.01 : 2)) };
  const RS = R.scheduleFor({ id: "rising", params: { at: 2, rate: 2 } });
  const CASES = [
    ["the brief spike at 0", R.spikeCost, null, [], 0],
    ["a drawing from 1 to 0.0766 at 0", costOf(draw(0.0766)), null, DRAW_TIMES, 0],
    ["a drawing alternating 2 and 0.01, at 0.02", costOf(alt), null, DRAW_TIMES, 0.02],
    ["a cost of 0.02 to a deadline at 1, at 0.98", (x) => (x <= 1 + 1e-12 ? 0.02 : Infinity), 1, [], 0.98],
    ["Figure 1(d) at 0.7", fig1("deadline").cost, 1, [], 0.7],
    ["the jump at 0.3", costOf({ id: "jump" }), null, [], 0.3],
    ["the pulse at 0.8", costOf({ id: "pulse" }), null, [], 0.8],
    ["the multi-step at 0.2", costOf({ id: "multistep" }), null, [], 0.2],
    ["Rising from 2 at rate 2, at 0", RS.cost, null, RS.breaks, 0],
  ];
  const diffs = [];
  let worst = 0, where = "";
  for (const [name, cost, dl, br, t] of CASES) for (let b = 0.05; b <= 2.4; b += 0.25) { const d = Math.abs(R.mapExact(b, t, cost, dl, br) - refMap(b, t, cost, dl, br)); diffs.push(d); if (!(d <= worst)) { worst = d; where = `${name}, level ${b.toFixed(2)}`; } }
  check("roots", `the page's map agrees with the separate evaluation (Simpson's rule on the density) within 1e-6, the caption's figure, on ${CASES.length} schedules at the levels 0.05, 0.30, ..., 2.30: all ${CASES.length * 10} differences finite and below it`,
    diffs.length === CASES.length * 10 && diffs.every((d) => Number.isFinite(d) && d < 1e-6), `${diffs.length} differences, largest ${worst.toExponential(2)} (${where})`);
  // Rising has a corner where the rise starts: the page's map splits its integral there (scheduleFor's breaks). Its
  // crossing at time 0 is confirmed by the separate evaluation; without that split it misses by more than 1e-6
  const rr = R.rootsAt(RS.cost, 0, 160, null, RS.breaks), vr = verified(rr.roots, 0, RS.cost, null, RS.breaks);
  const unsplit = R.rootsAt(RS.cost, 0, 160, null, []), vu = verified(unsplit.roots, 0, RS.cost, null, RS.breaks);
  check("roots", "Rising from 2 at rate 2, seen from 0: the map splits at the start of the rise, and its one crossing is confirmed by the separate evaluation (residual below 1e-6, with a sign change); the same map without that split misses it by more than 1e-6",
    RS.breaks.length === 1 && RS.breaks[0] === 2 && rr.roots.length === 1 && vr.every((v) => Math.abs(v.residual) < 1e-6 && v.signChange) && vu.length === 1 && Math.abs(vu[0].residual) > 1e-6,
    `${rr.roots.map((q, i) => `${q.b.toFixed(9)} (separate residual ${vr[i].residual.toExponential(1)})`).join(", ")}; without the split ${unsplit.roots.map((q, i) => `${q.b.toFixed(9)} (${vu[i].residual.toExponential(1)})`).join(", ")}`);
  const r = R.rootsAt(R.spikeCost, 0);
  const s = r.roots.map((q) => q.slope), vs = verified(r.roots, 0, R.spikeCost, null, []);
  check("roots", "the brief spike: three crossings found, each confirmed by the separate evaluation (residual below 1e-6 and a sign change within 1e-3), the local test toward the outer two and away from the middle one", r.roots.length === 3 && vs.every((v) => Math.abs(v.residual) < 1e-6 && v.signChange) && s[0] < 1 && s[0] > -3 && s[2] < 1 && s[2] > -3 && s[1] > 1, r.roots.map((q, i) => `${q.b.toFixed(4)} (slope ${q.slope.toFixed(2)}, separate residual ${vs[i].residual.toExponential(0)})`).join(", "));
  check("roots", "Algorithm 1's 30 updates from the per-moment bound end at the smallest crossing (within 0.001)", Math.abs(r.end - r.roots[0].b) < 1e-3, `${r.end.toFixed(4)} vs ${r.roots[0].b.toFixed(4)}`);
  const sd = R.scheduleFor(draw(0.04)), d = R.rootsAt(sd.cost, 0, 160, null, sd.breaks), vd = verified(d.roots, 0, sd.cost, null, DRAW_TIMES);
  check("roots", "a drawing at cost 1 to time 0.2 and 0.04 from 0.3: three crossings at time 0, each confirmed by the separate evaluation", d.roots.length === 3 && vd.every((v) => Math.abs(v.residual) < 1e-6 && v.signChange), d.roots.map((q) => q.b.toFixed(4)).join(", "));
  // the alternating drawing the audit found, seen from 0.02: the plate's crossing (with the knots split) is confirmed
  const sa = R.scheduleFor(alt), ra = R.rootsAt(sa.cost, 0.02, 160, null, sa.breaks), va = verified(ra.roots, 0.02, sa.cost, null, DRAW_TIMES);
  check("roots", "a drawing alternating costs 2 and 0.01, seen from 0.02: each crossing found is confirmed by the separate evaluation (residual below 1e-6)", ra.roots.length >= 1 && va.every((v) => Math.abs(v.residual) < 1e-6 && v.signChange), ra.roots.map((q, i) => `${q.b.toFixed(6)} (separate residual ${va[i].residual.toExponential(1)})`).join(", "));
  // near-tangent drawings: at 0.0765913 and 0.0766 the separate evaluation comes close to the diagonal near 0.586 without
  // crossing it, and the plate finds one crossing. The close approach is located, not sampled, with 256 panels per
  // stretch and again, separately, with 1024: T(b) - b is scanned every 0.005 from 0.55 to 0.62, the largest value must
  // be inside, and a golden-section search from its neighbors finds the local maximum, which must stay below 0
  const peakOf = (g) => {
    const xs = Array.from({ length: 15 }, (_, i) => 0.55 + 0.005 * i), gs = xs.map((x) => g(x)), k = gs.indexOf(Math.max(...gs));
    let a = xs[Math.max(k - 1, 0)], c = xs[Math.min(k + 1, xs.length - 1)];
    const phi = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 60; i++) { const x1 = c - phi * (c - a), x2 = a + phi * (c - a); if (g(x1) > g(x2)) c = x2; else a = x1; }
    const at = (a + c) / 2;
    return { inside: k > 0 && k < xs.length - 1, at, value: g(at) };
  };
  for (const low of [0.0765913, 0.0766]) {
    const sl = R.scheduleFor(draw(low)), dl = R.rootsAt(sl.cost, 0, 160, null, sl.breaks), vl = verified(dl.roots, 0, sl.cost, null, DRAW_TIMES);
    const [coarse, fine] = [256, 1024].map((P) => peakOf((x) => refMap(x, 0, sl.cost, null, DRAW_TIMES, P) - x));
    check("roots", `a drawing from 1 to ${low}: one crossing found and confirmed, and none at the close approach near 0.586, where the local maximum of T(b) − b in the separate evaluation, located by its own search with 256 panels per stretch and again with 1024, stays below 0 in both`,
      dl.roots.length === 1 && vl.every((v) => Math.abs(v.residual) < 1e-6 && v.signChange) && coarse.inside && fine.inside && coarse.value < 0 && fine.value < 0,
      `${dl.roots.map((q) => q.b.toFixed(4)).join(", ")}; local maximum of T - b: ${coarse.value.toExponential(3)} at ${coarse.at.toFixed(5)} (256 panels), ${fine.value.toExponential(3)} at ${fine.at.toFixed(5)} (1024)`);
  }
  const s766 = R.scheduleFor(draw(0.0766)), say586 = S.rootsSay(0.586, R.mapExact(0.586, 0, s766.cost, null, s766.breaks), 0, 0);
  check("words", "on the near-tangent drawing at the level 0.586, the sentence gives the signed gap to the diagonal and says the level doesn't fit", /below the level, so it doesn't fit/.test(say586), say586);
  const say5 = S.rootsSay(1, 1 + 5e-7, 0, 0);
  check("words", "a gap below 1e-6 reads as within 10⁻⁶ in this computed map, the threshold for reporting a fit, and not as the map's resolution", /within 10⁻⁶ of the level in this computed map, the threshold this page uses to report a fit/.test(say5) && !/resolve/.test(say5), say5);
  // the deadline case the audit found: the root matches B(c0) times the exact share before the deadline
  const c02 = R.scheduleFor({ id: "deadline", params: { at: 1, c: 0.02 } }), r02 = R.rootsAt(c02.cost, 0.98, 160, c02.deadline);
  const exact = (() => { let lo = 0.3, hi = 0.8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (boundForCost(0.02) * R.shareExact(m, 0.02) - m > 0) lo = m; else hi = m; } return (lo + hi) / 2; })();
  check("roots", "a cost of 0.02 to a deadline at 1, seen from 0.98: one crossing, within 1e-8 of the solution of B(c0) times the exact share before the deadline", r02.roots.length === 1 && Math.abs(r02.roots[0].b - exact) < 1e-8, `${r02.roots[0]?.b.toFixed(6)} vs ${exact.toFixed(6)}`);
  // each preset at its usual settings, at the times 0, 0.1, ... up to 0.1 before the window's end: sign changes of the
  // page's map at the levels 0.02, 0.04, ..., 3 (what the text reports, a detection on that grid)
  const extra = [];
  for (const p of [...PRESETS.map((q) => ({ id: q.id })), { id: "draw" }]) {
    const { cost, deadline, breaks } = R.scheduleFor(p);
    for (const t of times((deadline ?? 2.5) - 0.1)) {
      let n = 0, prev = null;
      for (let k = 1; k <= 150; k++) { const b = k / 50, g = R.mapExact(b, t, cost, deadline, breaks) - b; if (prev !== null && Math.sign(g) !== Math.sign(prev)) n++; prev = g; }
      if (n !== 1) extra.push(`${p.id} at ${t}: ${n}`);
    }
  }
  check("roots", "a search for sign changes at levels 0.02 apart finds one crossing for each preset (and the default drawing) at each of the times 0, 0.1, ... up to 0.1 before its window's end", extra.length === 0, extra.join("; ") || "one crossing found at every sampled time");
  check("words", "the local test's boundary slopes, -3 and 1, decide nothing", /decides nothing/.test(S.rootRole(-3)) && /decides nothing/.test(S.rootRole(1)) && /toward/.test(S.rootRole(0.5)) && /away/.test(S.rootRole(2)), `${S.rootRole(1)}; ${S.rootRole(-3)}`);
  check("words", "slopes near the boundary print their side: 1.00455 reads 1 + 0.0046 (away), 0.99544 reads 1 − 0.0046 (toward)", /slope 1 \+ 0\.0046: damped updates move away/.test(S.rootRole(1.00455)) && /slope 1 − 0\.0046: damped updates move toward/.test(S.rootRole(0.99544)), `${S.rootRole(1.00455)}; ${S.rootRole(0.99544)}`);
}

// ---- the program's exported bound -----------------------------------------------------------------------------
{
  const same = ["jump", "deadline", "pulse"].every((id) => { const { cost, deadline } = fig1(id), H = deadline ?? 8.5, a = exactPolicy((t) => Math.min(cost(t), 1e9), H), b = R.exactPolicyCenter((t) => Math.min(cost(t), 1e9), H); return a.bounds.every((v, i) => v === b.bounds[i]); });
  check("program", "the page's program with the center recorded gives model.js's exactPolicy bounds exactly (jump, deadline, pulse)", same, same ? "bit for bit" : "differs");
  // the 32-fold jump at 0.2: at time 1 the program waits at 0 evidence and decides at the first step, so its bound lies
  // between them (0.0181357, as the built worker exports it); the state line counts such times
  const jc = costOf({ id: "jump", params: { at: 0.2, factor: 32 } }), j32 = R.compareRules(jc, null), k1 = j32.t.findIndex((x) => Math.abs(x - 1) < 1e-9);
  const ref32 = exactPolicy((t) => Math.min(jc(t), 1e9), 8.5).bounds[100], note = S.subStepNote(j32.subStep);
  check("program", "the 32-fold jump at 0.2, time 1: the exported bound lies between 0 and the grid's first step (0.0181357, as model.js gives it), and the state line counts such times", j32.exact[k1] > 0 && j32.exact[k1] < 0.02 && Math.abs(j32.exact[k1] - 0.0181357) < 1e-6 && j32.exact[k1] === ref32 && j32.subStep > 0 && note.includes(`At ${j32.subStep} of the grid's times`) && /placed between the two/.test(note), `${j32.exact[k1].toFixed(7)}; ${j32.subStep} times`);
  const rs = R.scheduleFor({ id: "rising", params: { at: 0, rate: 2 } }, 2), rr = R.compareRules(rs.cost, rs.deadline), low = rr.exact.findIndex((v, i) => v > 0 && v < 0.02 && rr.t[i] < 2 - 1e-9);
  const fig = FIG1.map((id) => { const { cost, deadline } = fig1(id); return R.compareRules(cost, deadline).subStep; });
  check("program", "rising from 0 at rate 2 with a deadline added at 2: plotted bounds between 0 and 0.02 appear (from 1.52), and the count is positive; on Figure 1's four schedules there are none", low >= 0 && Math.abs(rr.t[low] - 1.52) < 1e-9 && rr.subStep > 0 && fig.every((n) => n === 0), `first at ${rr.t[low]}, ${rr.subStep} times; Figure 1: ${fig.join(", ")}`);
  // the per-moment curve on an odd deadline drops straight down at the forced choice, in each plate that draws it, as
  // the page builds that plate's curves: the two-rules comparison (comparisonLines) and Algorithm 1's Shift step
  // (shiftLines), from compareRules at the program's times, and Algorithm 1's Start step (startSeries and startLine, at
  // 251 times). The predicate, on each plate's "pm" path: its last two points sit at the deadline's x, the first at the
  // held bound's y and the last at 0's y (to the path's 0.1-pixel rounding)
  const d95 = R.scheduleFor({ id: "deadline", params: { at: 0.95, c: 0.5 } }), r95 = R.compareRules(d95.cost, d95.deadline);
  const drop = (f, svgText, dl, held) => {
    const path = (svgText.match(/class="pm" d="([^"]+)"/) || [])[1] || "";
    const pts = (path.match(/[ML]-?[\d.]+ -?[\d.]+/g) || []).map((q) => q.slice(1).split(" ").map(Number));
    if (pts.length < 2) return { ok: false, last: "no path" };
    const [a, b] = pts.slice(-2), X = f.sx(dl), close = (u, v) => Math.abs(u - v) < 0.051;
    return { ok: close(a[0], X) && close(b[0], X) && close(a[1], f.sy(held)) && close(b[1], f.sy(0)), last: `(${a.join(", ")}) and (${b.join(", ")}), deadline at x ${X.toFixed(1)}, 0 at y ${f.sy(0).toFixed(1)}` };
  };
  const held = toDiscrete(boundForCost(0.5), 0.01), f95 = frame({ clientWidth: 360 }, { x: [0, 0.95], y: [0, 0.5] });
  const st95 = R.startSeries(d95.cost, d95.deadline, 0.95);
  const plates = [["comparison", drop(f95, R.comparisonLines(f95, r95, true), 0.95, held)], ["Shift step", drop(f95, R.shiftLines(f95, r95), 0.95, held)],
    ["Start step", drop(f95, R.startLine(f95, st95.ts, st95.pm, d95.deadline), 0.95, boundForCost(0.5))]];
  const untouched = R.pmPlot(r95.t, r95.pm, null);
  check("endpoint", "a deadline at 0.95 with a cost of 0.5: the per-moment path each plate's curve builder emits (the comparison's comparisonLines, Algorithm 1's shiftLines, and its startLine) ends with a vertical drop at the deadline's x from the held bound to the y of 0; without a deadline pmPlot passes the arrays through unchanged",
    plates.every(([, q]) => q.ok) && untouched[0] === r95.t && untouched[1] === r95.pm, plates.map(([n, q]) => `${n}: ${q.last}`).join("; "));
}

// ---- Algorithm 1's kernel bins ------------------------------------------------------------------------------------
for (const b of [0.01, 0.3, 1.344, 2.5]) {
  const k = kernelForBound(b), tot = k.w.reduce((a, v) => a + v, 0), lam = 0.5 * ((Math.PI / (2 * b)) ** 2 + 1);
  const edgesOk = k.edges[0] === 0 && Math.abs(k.edges[1] - 1e-5) < 1e-18 && Math.abs(k.edges[240] / (14 / lam) - 1) < 1e-12 && k.w.length === 240;
  check("bins", `level ${b}: 240 bins with edges 0, 1e-5, ..., 14/lambda_1, summing to 1`, edgesOk && Math.abs(tot - 1) < 1e-12, `last edge ${k.edges[240].toFixed(4)}, sum ${tot.toFixed(14)}`);
}
check("bins", "the first bin [0, 1e-5] holds a quarter of the mass at the level 0.01 (the algorithm's note)", Math.abs(kernelForBound(0.01).w[0] - 0.25) < 0.01, kernelForBound(0.01).w[0].toFixed(4));
check("bins", "levels below 0.01 use the kernel for 0.01", kernelForBound(0.004) === kernelForBound(0.01), "the same cached kernel");
{
  const k = boundaryKernel(K.B(0.1)), m = k.s.reduce((a, s, j) => a + s * k.w[j], 0);
  check("bins", "the binned kernel's mean at c0 = 0.1 against the series' mean look-ahead (LookAheadTenth) within 0.002", Math.abs(m - K.meanLookAhead(0.1)) < 0.002, `${m.toFixed(4)} vs ${K.meanLookAhead(0.1).toFixed(4)} (printed ${N.LookAheadTenth})`);
}

// ---- the sentences --------------------------------------------------------------------------------------------
{
  const Rg = K.rng(8);
  let bad = 0, n = 0;
  const loss = () => ({ pm: Rg.next() * 5 - 0.002, avg: Rg.next() * 40, wb: Rg.next() * 0.3 - 0.002, avgCode: Rg.next() * 30 });
  for (let i = 0; i < 2000; i++) {
    const ch = Array.from({ length: 30 }, () => Rg.next() * 10 ** (-1 - 4 * Rg.next()));
    const st = S.settledAt(ch);
    const roots = Array.from({ length: 1 + (i % 3) }, () => ({ b: Rg.next() * 2, slope: (Rg.next() - 0.5) * 8 }));
    const say = [
      S.heroLabel(Rg.next(), Rg.next(), Rg.next() * 1.4),
      S.twoSay("Cost jumps", loss(), i % 3 ? null : 0.5 + Rg.next() * 2, i % 2 === 0, i % 4 ? [] : [[Rg.next(), 1 + Rg.next()], ...(i % 8 ? [] : [[2, 2]])]),
      S.twoVerdict(["zero", "smooth", "hold", null][i % 4], i % 5 !== 0, i % 3 ? [] : [[Rg.next(), 1 + Rg.next()]]),
      S.subStepNote(i % 7), S.rootRole((Rg.next() - 0.5) * 10),
      S.twoNote(i % 3 ? null : 1, i % 2 === 0, i % 5 ? null : 1.5),
      S.iterateSay(i % 31, Rg.next() * 0.3, Rg.next() * 2.5, st, ch[29]),
      S.iterateVerdict(["3", "10", "20", "never", null][i % 5], st, ch[29]),
      S.moreSay(Rg.next() * 10 ** (-6 * Rg.next()), Rg.next() * 6, 1 + Rg.next() * 5),
      S.p13Say(i % 6, { eps: 0.05, lo: 1.2, hi: 1.4, min: 1.25, max: 1.3, crossings: 1, above: Rg.next(), below: Rg.next(), slope: Rg.next(), ratios: [Rg.next(), Rg.next()], err: Rg.next() * 0.01, wb: Rg.next() * 0.01, pm: Rg.next(), pms: [Rg.next(), Rg.next()], wbs: [Rg.next(), Rg.next()] }),
      S.rootsVerdict(["one", "two", "more"][i % 3], roots), S.rootsSay(Rg.next() * 2, Rg.next() * 2, Rg.next(), Rg.next()),
      S.algoSay(i % 5, { t: Rg.next() * 2.5, c: Rg.next(), b: Rg.next() * 2, l: Rg.next() * 2, top: Rg.next() * 12, first: Rg.next() * 0.3, a: Rg.next() * 2, b0: Rg.next(), b30: Rg.next(), kernels: 1 + (i % 20), last: Rg.next() * 0.01, shift: 0.058, x: Rg.next(), ex: Rg.next() }),
      S.lossText(Rg.next() * 30 - 0.01),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const r = R.compareRules(costOf({ id: "jump" }), null), say = S.twoSay("Cost jumps", r.loss, null, false);
  const parts = (txt) => txt.match(/weighted rule loses (\S+) points per 100 trials, the per-moment rule (\S+), and the averaged-cost rule (\S+?)\. /);
  const pj = parts(say);
  check("words", "on the jump, the sentence names each rule's own loss and says averaging costs does worse than the per-moment rule", pj && pj[1] === S.lossText(r.loss.wb) && pj[2] === S.lossText(r.loss.pm) && pj[3] === S.lossText(r.loss.avg) && r.loss.avg > r.loss.pm && /worse than not looking ahead/.test(say), say);
  check("words", "the iteration verdict: 'Right' when it never settles and the guess was 'not within 30'; the gap in updates otherwise", /^Right/.test(S.iterateVerdict("never", null, 0.008)) && /13 off/.test(S.iterateVerdict("20", 7, 1e-5)), S.iterateVerdict("20", 7, 1e-5));
  const spike = R.rootsAt(R.spikeCost, 0);
  check("words", "the spike's verdict reports three crossings found in the computed map, and the local test toward two", /^Right\. The search finds three crossings in this computed map, and by the local test the damped updates can settle at two of them\.$/.test(S.rootsVerdict("more", spike.roots)), S.rootsVerdict("more", spike.roots));
  // the selectable edge cases the plate's sentences now cover: a constant cost where a rule scores above the program
  const k98 = R.compareRules(costOf({ id: "constant", params: { c: 0.98 } }), null), s98 = S.twoSay("Constant", k98.loss, null, false);
  const p98 = parts(s98);
  check("words", "a constant cost of 0.98: each rule's own loss prints with its sign, and the sentence says what a negative loss means", p98 && p98[1] === S.lossText(k98.loss.wb) && p98[2] === S.lossText(k98.loss.pm) && p98[3] === S.lossText(k98.loss.avg) && ["pm", "avg", "wb"].every((x) => k98.loss[x] < 0) && p98.slice(1).every((v) => v.startsWith("−")) && /scored a little above the dynamic program/.test(s98), s98);
  check("words", "signed losses: −0.000951 reads −0.00095, 0.0137 reads 0.014, and 21.03 reads 21.0", S.lossText(-0.000951) === "−0.00095" && S.lossText(0.0137) === "0.014" && S.lossText(21.03) === "21.0", `${S.lossText(-0.000951)}; ${S.lossText(0.0137)}`);
  const late = R.scheduleFor({ id: "deadline", params: { at: 3, c: 0.5 } }), rl = R.compareRules(late.cost, late.deadline), u = R.codeStretches(rl);
  const sv = S.twoVerdict("hold", true, u), ss = S.twoSay("Deadline", rl.loss, rl.deadline, false, u);
  const zero = ss.match(/the averaged-cost rule's bound, by its definition, is 0 throughout: it decides at once and loses (\S+) points/), code = ss.match(/above 0 at the plotted times (from \S+ to \S+), and it loses (\S+?)\.(?= |$)/);
  check("words", "at (0.5, 3), the sentence says the definition's bound is 0 with its loss, and names the code's stretch and its own loss; the verdict names the same stretch", zero && zero[1] === S.lossText(rl.loss.avg) && code && code[1] === `from ${u[0][0].toFixed(2)} to ${u[0][1].toFixed(2)}` && code[2] === S.lossText(rl.loss.avgCode) && /By the paper's definition/.test(sv) && sv.includes(code[1]), ss);
  const jd = R.scheduleFor({ id: "jump" }, 2), rjd = R.compareRules(jd.cost, jd.deadline), sjd = R.codeStretches(rjd), vjd = S.twoVerdict("hold", true, sjd);
  check("words", "the jump with a deadline added at 2: the verdict prints the code's stretch as 'from 0.48 to 1.72' (the numbers are checked above) and doesn't say the bound holds from the start", vjd.includes("from 0.48 to 1.72") && !/until|from the start: that is/.test(vjd.split("The paper's code")[1] ?? ""), vjd);
  // the 16-fold fall at 1.5 with a deadline added at 2: the weighted curve rises from 1.50 to 1.52, so the verdict for
  // "come down smoothly" must not credit the weighted rule with a smooth decline
  const fs = R.scheduleFor({ id: "fall", params: { at: 1.5, factor: 16 } }, 2), rfs = R.compareRules(fs.cost, fs.deadline), vs2 = S.twoVerdict("smooth", true, R.codeStretches(rfs));
  const i150 = rfs.t.findIndex((x) => Math.abs(x - 1.5) < 1e-9), rises = toDiscrete(rfs.wb[i150 + 1], 0.01) > toDiscrete(rfs.wb[i150], 0.01);
  check("words", "a 16-fold fall at 1.5 with a deadline added at 2, guess 'come down smoothly': the weighted curve rises at 1.50 to 1.52, and the verdict gives the definition's 0 without crediting a smooth decline", rises && /By the paper's definition it doesn't/.test(vs2) && !/That is what the weighted rule does/.test(vs2), vs2.slice(0, 140));
  const sdl = S.twoSay("Deadline", rl.loss, rl.deadline, false, u);
  check("words", "on a deadline, the sentence says the weighted rule's bound stays above 0 until the deadline (no claim that it comes down smoothly)", /stays above 0 until the deadline/.test(sdl) && !/comes down/.test(sdl), sdl.slice(0, 120));
  check("words", "the first plate's note: the constant-cost note only for an unchanged constant schedule, not with a deadline added", S.twoNote(null, true, null) === S.constantNote() && !S.twoNote(null, true, 1).includes("every rule gives") && /own deadline/.test(S.twoNote(1, false, null)), S.twoNote(null, true, 1));
  check("words", "the 300-update sentence reports the difference only, not that the 30th had settled", !/settled/.test(S.moreSay(3e-11, 0.5, 6)) && !/settled/.test(S.moreSay(0, 0, 6)), S.moreSay(3e-11, 0.5, 6));
}
