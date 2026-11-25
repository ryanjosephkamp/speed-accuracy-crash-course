// Chapter 8: the weighted look-ahead rule and the averaged-cost rule against the paper's code at the tag, the page's
// dynamic program and scorer against Table 4, the facts behind the iteration plates and Proposition 13's strip, the
// map whose crossings are the equation's solutions, Algorithm 1's kernel bins, and the sentences under the plates.
//
// The paper's code's own outputs come from tools/validity/ch08.json, which tools/validity/ch08.py writes by running
// that code at the tag (shortcuts.weighted_ahead) and reading its experiments/results/showcase.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as K from "../../book/assets/js/kernel.js";
import { weightedBound, boundForCost, kernelForBound, boundaryKernel, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS, DRAW_TIMES } from "../../book/assets/js/schedules-book.js";
import * as R from "../../book/assets/js/ch08-rule.js";
import * as S from "../../book/assets/js/say-ch08.js";
import { check, N, SIN, tableNumbers, ROOT } from "./lib.mjs";

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
  const until = R.codeUntil(r), until1 = R.codeUntil(R.compareRules(...Object.values(R.scheduleFor({ id: "deadline" })).slice(0, 2)));
  check("avg", "the code's version stays finite until a time before the deadline at (0.5, 3), and agrees with the definition's 0 on Figure 1(d)", until !== null && until > 0.5 && until < 3 && until1 === null, `finite until ${until}; on Figure 1(d): ${until1}`);
}
{
  // the definition: before a deadline, the exact kernel for the current cost puts positive weight past the deadline at
  // every plotted time, so the kernel-weighted cost is infinite and B of it is 0 (Lemma 6(a))
  const cases = [["Figure 1(d)", fig1("deadline")], ["(0.5, 3)", CODE_CASES["deadline-0.5-3"]], ["jump, deadline added at 2", CODE_CASES["jump-deadline-2"]],
    ["constant, deadline added at 1", R.scheduleFor({ id: "constant" }, 1)]];
  for (const [name, { cost, deadline }] of cases) {
    let least = Infinity;
    for (let t = 0; t < deadline - 1e-9; t += 0.02) least = Math.min(least, R.tailExact(Math.max(boundForCost(cost(t)), 1e-3), deadline - t));
    check("avg", `${name}: at every plotted time before the deadline the exact kernel puts weight past it, so the definition's bound is 0`, least > 0, `smallest weight past the deadline ${least.toExponential(1)}`);
  }
  const tails = [0.01, 0.1, 0.5, 1.6, 20].map((c) => { const b = Math.max(boundForCost(c), 1e-3); return R.tailExact(b, R.kernelForCost(c).edges[240]); });
  check("avg", "the code's kernels, which end at 14/lambda_1, leave out less than one part in a million of the weight (costs 0.01 to 20)", tails.every((v) => v > 0 && v < 1e-6), tails.map((v) => v.toExponential(1)).join(", "));
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
    check("p13", `eps = ${r.eps}: the map sends I into I and crosses the diagonal once`, inside && r.crossings === 1, `I = [${r.lo.toFixed(4)}, ${r.hi.toFixed(4)}], values ${Math.min(...r.map).toFixed(4)} to ${Math.max(...r.map).toFixed(4)}`);
  }
  const sl = runs.map((r) => r.slope / r.eps);
  check("p13", "over the four sizes, the map's steepest secant slope divided by eps falls as eps shrinks and stays below 0.2", sl.every((v, i) => i === 0 || v <= sl[i - 1]) && sl[sl.length - 1] < 0.2, sl.map((v) => v.toFixed(3)).join(", "));
  const e2 = runs.map((r) => r.errW / (r.eps * r.eps));
  check("p13", "over the four sizes, Algorithm 1's distance from b0 + eps beta divided by eps^2 varies little (the last three within 15% of each other)", Math.max(...e2.slice(1)) / Math.min(...e2.slice(1)) < 1.15, e2.map((v) => v.toFixed(4)).join(", "));
  const W2 = K.transfer(0.1, 2), want = Math.abs(K.Bprime(0.1)) * R.P13.M * Math.hypot(1 - W2.re, W2.im);
  const [a, b] = runs.slice(-2).map((r) => r.errPm / r.eps), lim = 2 * b - a;
  check("p13", "the per-moment rule's error divided by eps tends to |B'(c0)| M |1 - w~(-2i)| (extrapolated from the two smallest sizes, within 2%)", Math.abs(lim / want - 1) < 0.02, `${lim.toFixed(4)} vs ${want.toFixed(4)}`);
  const d = R.levelDerivative(boundForCost(0.1));
  check("p13", "the kernel's derivative in the level has equal areas above and below zero (within 1e-4; the stretch [0, 1e-8] is left out)", Math.abs(d.above - d.below) < 1e-4 && d.above > 0.05, `${d.above.toFixed(6)} above, ${d.below.toFixed(6)} below`);
  let area = 0; for (let i = 1; i < d.ss.length; i++) area += 0.5 * (d.sw[i] + d.sw[i - 1]) * Math.log(d.ss[i] / d.ss[i - 1]);
  // near 0 the kernel is sqrt(2 / (pi s)) / (tanh b + b sech^2 b), so [0, 1e-8] holds about twice that times 1e-4
  const left = (2 * Math.sqrt(1e-8) * Math.sqrt(2 / Math.PI)) / K.fluxTotal(boundForCost(0.1));
  check("p13", "the kernel from the series has area 1 on the same grid, with the stretch below 1e-8 added (within 1e-5)", Math.abs(area + left - 1) < 1e-5, `${area.toFixed(6)} + ${left.toExponential(2)}`);
  const om = Array.from({ length: 196 }, (_, i) => 0.5 + i * 0.1), gap = Math.min(...om.map((w) => { const T = K.transfer(0.1, w); return Math.hypot(1 - T.re, T.im); }));
  check("p13", "|1 - w~(-i omega)| is 0 at omega = 0 and stays above 0.1 for omega from 0.5 to 20", K.transfer(0.1, 0).re === 1 && gap > 0.1, `smallest ${gap.toFixed(3)}`);
}

// ---- two levels that both fit ---------------------------------------------------------------------------------------
{
  const r = R.rootsAt(R.spikeCost, 0);
  const s = r.roots.map((q) => q.slope);
  check("roots", "the brief spike: three crossings (each with residual below 1e-6), the local test toward the outer two and away from the middle one", r.roots.length === 3 && r.roots.every((q) => Math.abs(q.residual) < 1e-6) && s[0] < 1 && s[0] > -3 && s[2] < 1 && s[2] > -3 && s[1] > 1, r.roots.map((q) => `${q.b.toFixed(4)} (slope ${q.slope.toFixed(2)})`).join(", "));
  check("roots", "Algorithm 1's 30 updates from the per-moment bound end at the smallest crossing (within 0.001)", Math.abs(r.end - r.roots[0].b) < 1e-3, `${r.end.toFixed(4)} vs ${r.roots[0].b.toFixed(4)}`);
  // a drawing that falls 25-fold between 0.2 and 0.3 also gives three crossings (the text says the spike isn't the only kind)
  const d = R.rootsAt(costOf({ id: "draw", points: DRAW_TIMES.map((t) => (t <= 0.2 + 1e-9 ? 1 : 0.04)) }), 0);
  check("roots", "a drawing at cost 1 to time 0.2 and 0.04 from 0.3: three crossings at time 0 (each with residual below 1e-6)", d.roots.length === 3 && d.roots.every((q) => Math.abs(q.residual) < 1e-6), d.roots.map((q) => q.b.toFixed(4)).join(", "));
  // each preset at its usual settings, at the times 0, 0.1, ... up to 0.1 before the window's end, counted on the
  // equation's map (integrated to a deadline) at the levels 0.01, 0.02, ..., 3
  const extra = [];
  for (const p of [...PRESETS.map((q) => ({ id: q.id })), { id: "draw" }]) {
    const { cost, deadline } = R.scheduleFor(p);
    for (const t of times((deadline ?? 2.5) - 0.1)) {
      let n = 0, prev = null;
      for (let k = 1; k <= 300; k++) { const b = k / 100, g = R.mapExact(b, t, cost, deadline) - b; if (prev !== null && Math.sign(g) !== Math.sign(prev)) n++; prev = g; }
      if (n !== 1) extra.push(`${p.id} at ${t}: ${n}`);
    }
  }
  check("roots", "each preset (and the default drawing) crosses the diagonal once at each of the times 0, 0.1, ... up to 0.1 before its window's end", extra.length === 0, extra.join("; ") || "one crossing at every sampled time");
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
      S.twoSay("Cost jumps", loss(), i % 3 ? null : 0.5 + Rg.next() * 2, i % 2 === 0, i % 4 ? null : Rg.next() * 2),
      S.twoVerdict(["zero", "smooth", "hold", null][i % 4], i % 5 !== 0, i % 3 ? null : Rg.next() * 2),
      S.twoNote(i % 3 ? null : 1, i % 2 === 0, i % 5 ? null : 1.5),
      S.iterateSay(i % 31, Rg.next() * 0.3, Rg.next() * 2.5, st, ch[29]),
      S.iterateVerdict(["3", "10", "20", "never", null][i % 5], st, ch[29]),
      S.moreSay(Rg.next() * 10 ** (-6 * Rg.next()), Rg.next() * 6, 1 + Rg.next() * 5),
      S.p13Say(i % 6, { eps: 0.05, lo: 1.2, hi: 1.4, min: 1.25, max: 1.3, crossings: 1, above: Rg.next(), below: Rg.next(), slope: Rg.next(), ratios: [Rg.next(), Rg.next()], err: Rg.next() * 0.01, wb: Rg.next() * 0.01, pm: Rg.next(), pms: [Rg.next(), Rg.next()] }),
      S.rootsVerdict(["one", "two", "more"][i % 3], roots), S.rootsSay(Rg.next() * 2, Rg.next() * 2, Rg.next(), Rg.next()),
      S.algoSay(i % 5, { t: Rg.next() * 2.5, c: Rg.next(), b: Rg.next() * 2, l: Rg.next() * 2, top: Rg.next() * 12, first: Rg.next() * 0.3, a: Rg.next() * 2, b0: Rg.next(), b30: Rg.next(), kernels: 1 + (i % 20), last: Rg.next() * 0.01, shift: 0.058, x: Rg.next(), ex: Rg.next() }),
      S.lossText(Rg.next() * 30 - 0.01),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const r = R.compareRules(costOf({ id: "jump" }), null), say = S.twoSay("Cost jumps", r.loss, null, false);
  check("words", "on the jump, the sentence prints the three losses and says averaging costs does worse than the per-moment rule", [r.loss.pm, r.loss.avg, r.loss.wb].every((x) => say.includes(S.lossText(x))) && r.loss.avg > r.loss.pm && /worse than not looking ahead/.test(say), say);
  check("words", "the iteration verdict: 'Right' when it never settles and the guess was 'not within 30'; the gap in updates otherwise", /^Right/.test(S.iterateVerdict("never", null, 0.008)) && /13 off/.test(S.iterateVerdict("20", 7, 1e-5)), S.iterateVerdict("20", 7, 1e-5));
  const spike = R.rootsAt(R.spikeCost, 0);
  check("words", "the spike's verdict says three levels fit and the local test lets the updates settle at two", /^Right\. Three levels fit here, and by the local test the damped updates can settle at two of them\.$/.test(S.rootsVerdict("more", spike.roots)), S.rootsVerdict("more", spike.roots));
  // the selectable edge cases the plate's sentences now cover: a constant cost where a rule scores above the program
  const k98 = R.compareRules(costOf({ id: "constant", params: { c: 0.98 } }), null), s98 = S.twoSay("Constant", k98.loss, null, false);
  check("words", "a constant cost of 0.98: the losses print with their signs, and the sentence says what a negative loss means", ["pm", "avg", "wb"].every((x) => k98.loss[x] < 0 && s98.includes(S.lossText(k98.loss[x]))) && /−/.test(s98) && /scored a little above the dynamic program/.test(s98), s98);
  check("words", "signed losses: −0.000951 reads −0.00095, 0.0137 reads 0.014, and 21.03 reads 21.0", S.lossText(-0.000951) === "−0.00095" && S.lossText(0.0137) === "0.014" && S.lossText(21.03) === "21.0", `${S.lossText(-0.000951)}; ${S.lossText(0.0137)}`);
  const late = R.scheduleFor({ id: "deadline", params: { at: 3, c: 0.5 } }), rl = R.compareRules(late.cost, late.deadline), u = R.codeUntil(rl);
  const sv = S.twoVerdict("hold", true, u), ss = S.twoSay("Deadline", rl.loss, rl.deadline, false, u);
  check("words", "at (0.5, 3), the verdict and the sentence say the definition gives 0 and the paper's code holds a finite bound until a named time, with its loss", /By the paper's definition/.test(sv) && sv.includes(`until time ${u.toFixed(2)}`) && ss.includes(S.lossText(rl.loss.avgCode)), ss);
  check("words", "the first plate's note: the constant-cost note only for an unchanged constant schedule, not with a deadline added", S.twoNote(null, true, null) === S.constantNote() && !S.twoNote(null, true, 1).includes("every rule gives") && /own deadline/.test(S.twoNote(1, false, null)), S.twoNote(null, true, 1));
  check("words", "the 300-update sentence reports the difference only, not that the 30th had settled", !/settled/.test(S.moreSay(3e-11, 0.5, 6)) && !/settled/.test(S.moreSay(0, 0, 6)), S.moreSay(3e-11, 0.5, 6));
}
