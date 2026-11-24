// Chapter 8: the weighted look-ahead rule and the averaged-cost rule against the paper's code at the tag, the page's
// dynamic program and scorer against Table 4, the facts behind the iteration plates and Proposition 13's strip, the
// two-level example, Algorithm 1's kernel bins, and the sentences under the plates.
//
// Reference values from the paper's code: SHOWCASE_WEIGHTED is copied from experiments/results/showcase.json at
// paper-v1.2; PAPER_AVERAGED_COST and the sinusoid fits were printed by the paper's src/speed_accuracy/shortcuts.py at
// the tag (weighted_ahead on experiments/common.py's schedules; the fits are showcase.json's first_order rows).
// To reproduce: run those functions at the tag at the times listed.
import * as K from "../../book/assets/js/kernel.js";
import { weightedBound, boundForCost, kernelForBound, boundaryKernel, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS } from "../../book/assets/js/schedules-book.js";
import * as R from "../../book/assets/js/ch08-rule.js";
import * as S from "../../book/assets/js/say-ch08.js";
import { check, N, SIN, tableNumbers } from "./lib.mjs";

// The weighted rule's evidence bound in experiments/results/showcase.json at the tag (moved in by 0.5826 sqrt(0.002),
// rounded to 4 decimals), at the times 0, 0.1, ..., 2.5 (to 1 on the deadline), for Figure 1's four schedules.
const SHOWCASE_WEIGHTED = {
  jump: [0.9143, 0.8478, 0.7566, 0.6154, 0.4002, 0.2108, 0.1432, 0.131, 0.1292, 0.129, 0.129, 0.129, 0.129, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289, 0.1289],
  fall: [0.9979, 1.11, 1.2457, 1.4373, 1.6299, 1.7062, 1.7204, 1.7224, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227, 1.7227],
  rising: [1.0733, 1.0405, 1.0018, 0.9545, 0.8934, 0.7988, 0.6649, 0.5694, 0.4954, 0.436, 0.3871, 0.3463, 0.3118, 0.2825, 0.2574, 0.2356, 0.2168, 0.2003, 0.1857, 0.1729, 0.1614, 0.1511, 0.1419, 0.1335, 0.126, 0.119],
  deadline: [1.1147, 1.0784, 1.0595, 1.0209, 0.9813, 0.9414, 0.8819, 0.8131, 0.7332, 0.5934, 0.0],
};
// The averaged-cost rule (shortcuts.weighted_ahead) printed by the paper's code at the tag, run on
// experiments/common.py's four Figure 1 schedules at the same times, as continuous evidence bounds.
const PAPER_AVERAGED_COST = {
  jump: [0.3839431909, 0.3457416801, 0.3071473627, 0.2672198462, 0.2370006835, 0.2182647335, 0.1688739770, 0.1570007643, 0.1552773877, 0.1550415636, 0.1550096119, 0.1550052871, 0.1550047018, 0.1550046226, 0.1550046118, 0.1550046104, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102, 0.1550046102],
  fall: [0.6693649762, 0.7495127155, 0.9364762690, 1.3307264250, 1.6440485761, 1.7318862356, 1.7464297787, 1.7484656361, 1.7487423835, 1.7487798577, 1.7487849292, 1.7487856155, 1.7487857084, 1.7487857210, 1.7487857227, 1.7487857229, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230, 1.7487857230],
  rising: [0.6577324398, 0.6150897606, 0.5721197988, 0.5287465712, 0.4844838693, 0.4366553381, 0.4582433804, 0.4635131899, 0.4507559098, 0.4245539401, 0.3938333684, 0.3621396240, 0.3319158471, 0.3053770994, 0.2815323468, 0.2605407668, 0.2421946861, 0.2259510430, 0.2115367164, 0.1987655332, 0.1873344352, 0.1771043049, 0.1678990441, 0.1595496069, 0.1519740012, 0.1450694065],
  deadline: [0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000, 0.0000000000],
};
// showcase.json's first_order rows: (amplitude, phase in degrees) of the fitted response at c0 = 0.1, eps = 0.01
const SHOWCASE_FITS = {
  0.5: { weighted: [0.055979575180292895, -165.51401558451627], avg: [0.05595059809491054, -165.50840829174712] },
  1: { weighted: [0.04859603511352685, -155.9370933874847], avg: [0.048542664497162935, -155.939352499533] },
  2: { weighted: [0.037395657532681995, -148.56815421330498], avg: [0.03735786815666594, -148.5899987479668] },
  4: { weighted: [0.028182583393589176, -145.8404369280571], avg: [0.02814875371341643, -145.84864158540898] },
  8: { weighted: [0.021412227789698316, -143.30242993518013], avg: [0.021379470966427748, -143.31005736597547] },
};

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
  const ref = SHOWCASE_WEIGHTED[id];
  const worst = Math.max(...ref.map((v, i) => Math.abs(toDiscrete(w[i], 0.002) - v)));
  check("rule", `${id}: model.js's weighted rule against showcase.json at the tag (within 5.1e-5, its 4-decimal rounding)`, worst <= 5.1e-5, `largest difference ${worst.toExponential(1)} over ${ref.length} times`);
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
  const ref = SHOWCASE_FITS[om];
  check("rule", `Table 1 at omega = ${om}: the weighted rule's swing ${gainW} and lead ${leadW} as printed`, (fw[0] / fp[0]).toFixed(3) === gainW.toFixed(3) && lead(fw).toFixed(1) === leadW.toFixed(1), `${(fw[0] / fp[0]).toFixed(3)}, ${lead(fw).toFixed(1)}`);
  check("rule", `omega = ${om}: the weighted rule's fit against showcase.json (amplitude within 1e-10, phase within 1e-6 degrees)`, Math.abs(fw[0] - ref.weighted[0]) < 1e-10 && Math.abs(fw[1] - ref.weighted[1]) < 1e-6, `${fw[0].toPrecision(12)}, ${fw[1].toFixed(8)}`);
  check("avg", `omega = ${om}: the averaged-cost rule's fit against showcase.json (amplitude within 1e-10, phase within 1e-6 degrees)`, Math.abs(fa[0] - ref.avg[0]) < 1e-10 && Math.abs(fa[1] - ref.avg[1]) < 1e-6, `${fa[0].toPrecision(12)}, ${fa[1].toFixed(8)}`);
}

// ---- the averaged-cost rule ------------------------------------------------------------------------------------
for (const id of FIG1) {
  const { cost, deadline } = fig1(id);
  const ts = times(deadline ?? 2.5);
  const a = R.averagedCost(cost, ts, deadline), ref = PAPER_AVERAGED_COST[id];
  const worst = Math.max(...ref.map((v, i) => Math.abs(a[i] - v)));
  check("avg", `${id}: the averaged-cost rule against the paper's weighted_ahead (within 1e-9)`, worst < 1e-9, `largest difference ${worst.toExponential(1)}`);
}
{
  // the deadline: the kernel is positive at every delay, so a cost that is infinite past T averages to infinity
  const b = K.B(0.1), at = [0.5, 2, 5, 10, 20].map((s) => K.flux(s, b));
  check("avg", "the kernel is positive far out (s = 0.5 to 20), so any infinite cost ahead makes the average infinite", at.every((v) => v > 0), at.map((v) => v.toExponential(1)).join(", "));
  const { cost, deadline } = R.scheduleFor({ id: "jump" }, 2);
  const a = R.averagedCost(cost, times(2), deadline);
  check("avg", "with a deadline added, the averaged-cost rule is 0 at every time", a.every((v) => v === 0), `${a.length} times`);
  const r = R.compareRules(costOf({ id: "jump" }), null);
  check("avg", "on the 16-fold jump, the averaged-cost rule starts below half the best bound (as the text says)", r.avg[0] < 0.5 * r.exact[0], `${r.avg[0].toFixed(3)} vs ${r.exact[0].toFixed(3)}`);
}

// ---- the deadline: the rule's bound is B(c0) times its own kernel's share before the deadline --------------------
{
  const { cost, deadline } = fig1("deadline");
  const ts = [0.2, 0.4, 0.6, 0.8, 0.9, 0.96], w = R.weightedHistory(cost, ts).final;
  const gaps = ts.map((t, i) => Math.abs(w[i] - boundForCost(0.1) * R.shareBefore(w[i], deadline - t)));
  check("deadline", "Figure 1(d): at the hero's times, the rule's bound is within 0.002 of B(0.1) times its kernel's share before the deadline", Math.max(...gaps) < 0.002, gaps.map((g) => g.toExponential(0)).join(", "));
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
    check("iterate", `${id}: the 30 updates don't settle to 0.001 (as the text says)`, S.settledAt(ch) === null, `the 30th moves ${ch[29].toExponential(1)}`);
  }
  {
    const pulse = fig1("pulse"), roots = R.selfConsistent(1, pulse.cost, 0.01, 2.5, 120);
    check("iterate", "the pulse at t = 1: one crossing, where the map's slope is between 0.5 and 1, so each damped update closes only a small part of the distance (as the text says)", roots.length === 1 && roots[0].slope > 0.5 && roots[0].slope < 1, `slope ${roots[0]?.slope.toFixed(2)}`);
  }
  const dl = fig1("deadline");
  const roots = R.selfConsistent(0.7, dl.cost, 0.01, 2, 120);
  check("iterate", "near the deadline (t = 0.7) the map crosses once, with a slope below -3, so the damped update can't settle there", roots.length === 1 && roots[0].slope < -3, `${roots.length} crossing, slope ${roots[0]?.slope.toFixed(2)}`);
  {
    // the rounding of levels to 0.001 leaves small moves that don't die out; with each level's own kernel they do
    const cost = costOf({ id: "jump" }), t = 0.28, p = R.weightedHistory(cost, [t]).updates.map((u) => u[0]);
    let b = boundForCost(cost(t)); const q = [b];
    for (let k = 0; k < 30; k++) { b = 0.5 * (b + R.mapT(b, t, cost, true)); q.push(b); }
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
  check("p13", "the map's steepest slope divided by eps stays bounded and falls as eps shrinks", sl.every((v, i) => i === 0 || v <= sl[i - 1]) && sl[sl.length - 1] < 0.2, sl.map((v) => v.toFixed(3)).join(", "));
  const e2 = runs.map((r) => r.errW / (r.eps * r.eps));
  check("p13", "the rule's distance from b0 + eps beta divided by eps^2 settles (the last three within 15% of each other)", Math.max(...e2.slice(1)) / Math.min(...e2.slice(1)) < 1.15, e2.map((v) => v.toFixed(4)).join(", "));
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
  check("roots", "the brief spike: three crossings, the outer two where the damped update settles and the middle one where it doesn't", r.roots.length === 3 && s[0] < 1 && s[0] > -3 && s[2] < 1 && s[2] > -3 && s[1] > 1, r.roots.map((q) => `${q.b.toFixed(4)} (slope ${q.slope.toFixed(2)})`).join(", "));
  check("roots", "Algorithm 1's 30 updates from the per-moment bound end at the smallest crossing (within 0.001)", Math.abs(r.end - r.roots[0].b) < 1e-3, `${r.end.toFixed(4)} vs ${r.roots[0].b.toFixed(4)}`);
  // every preset, at its usual settings, crosses once at every time 0, 0.1, ... (the text says so), counted on the
  // map with Algorithm 1's rounded levels, every 0.01
  const extra = [];
  for (const p of [...PRESETS.map((q) => ({ id: q.id })), { id: "draw" }]) {
    const { cost, deadline } = R.scheduleFor(p);
    for (const t of times((deadline ?? 2.5) - 0.1)) {
      let n = 0, prev = null;
      for (let b = 0.01; b <= 3; b += 0.01) { const g = R.mapT(b, t, cost) - b; if (prev !== null && Math.sign(g) !== Math.sign(prev)) n++; prev = g; }
      if (n !== 1) extra.push(`${p.id} at ${t}: ${n}`);
    }
  }
  check("roots", "each preset (and the default drawing) crosses the diagonal once at every time 0, 0.1, ... in its window", extra.length === 0, extra.join("; ") || "one crossing everywhere");
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
  const loss = () => ({ pm: Rg.next() * 5, avg: Rg.next() * 40, wb: Rg.next() * 0.3 });
  for (let i = 0; i < 2000; i++) {
    const ch = Array.from({ length: 30 }, () => Rg.next() * 10 ** (-1 - 4 * Rg.next()));
    const st = S.settledAt(ch);
    const roots = Array.from({ length: 1 + (i % 3) }, () => ({ b: Rg.next() * 2, slope: (Rg.next() - 0.5) * 8 }));
    const say = [
      S.heroLabel(Rg.next(), Rg.next(), Rg.next() * 1.4),
      S.twoSay("Cost jumps", loss(), i % 3 ? null : 0.5 + Rg.next() * 2, i % 2 === 0),
      S.twoVerdict(["zero", "smooth", "hold", null][i % 4], i % 5 !== 0),
      S.iterateSay(i % 31, Rg.next() * 0.3, Rg.next() * 2.5, st, ch[29]),
      S.iterateVerdict(["3", "10", "20", "never", null][i % 5], st, ch[29]),
      S.moreSay(Rg.next() * 10 ** (-6 * Rg.next()), Rg.next() * 6, 1 + Rg.next() * 5),
      S.p13Say(i % 6, { eps: 0.05, lo: 1.2, hi: 1.4, min: 1.25, max: 1.3, crossings: 1, above: Rg.next(), below: Rg.next(), slope: Rg.next(), ratios: [Rg.next(), Rg.next()], err: Rg.next() * 0.01, wb: Rg.next() * 0.01, pm: Rg.next() }),
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
  check("words", "the spike's verdict says three levels fit and the updates can settle at two", /^Right\. Three levels fit here, and the damped updates can settle at two of them\.$/.test(S.rootsVerdict("more", spike.roots)), S.rootsVerdict("more", spike.roots));
  check("words", "losses below 0.0005 read 'less than 0.001'", S.lossText(0.0002) === "less than 0.001" && S.lossText(-0.001) === "less than 0.001" && S.lossText(0.0137) === "0.014", `${S.lossText(0.0002)}; ${S.lossText(0.0137)}`);
}
