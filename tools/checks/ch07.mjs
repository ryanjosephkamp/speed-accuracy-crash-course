// Chapter 7: the transfer function against Table 1 and its series, the limits of the look-ahead and their numbers,
// half-integration's slopes, the closed forms behind the second-order loss, the forward computation against
// model.js's scorer and the paper's Table 9, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch07-model.js";
import { exactPolicy, score, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, defaultDrawing, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch07.js";
import { check, N, table, tableNumbers, asPrinted } from "./lib.mjs";

// ---- Table 1 ------------------------------------------------------------------------------------------------
{
  const T = tableNumbers("tab_sinusoid");
  const same = T.length === M.TABLE1.length && T.every((r, i) => r.length === M.TABLE1[i].length && r.every((v, j) => v === M.TABLE1[i][j]));
  check("table", "the plate's Table 1 equals paper/generated/tab_sinusoid.tex, cell by cell", same, `${T.length} rows, ${T[0].length} columns`);
  const [, , , g8, l8] = M.TABLE1[M.TABLE1.length - 1];
  check("table", "PerMomentTooLargeAtEight is 1 / the program's swing at omega = 8", asPrinted(1 / g8, N.PerMomentTooLargeAtEight), `${(1 / g8).toFixed(2)} vs ${N.PerMomentTooLargeAtEight}`);
  check("table", "PerMomentLateAtEight is the program's lead at omega = 8", asPrinted(l8, N.PerMomentLateAtEight), `${l8} vs ${N.PerMomentLateAtEight}`);
}

// ---- the transfer function ----------------------------------------------------------------------------------
for (const [om, gain, lead] of M.TABLE1) {
  const t = K.transfer(0.1, om);
  check("transfer", `closed form at omega = ${om} prints as Table 1 (swing ${gain}, lead ${lead})`, t.gain.toFixed(3) === gain.toFixed(3) && t.lead.toFixed(1) === lead.toFixed(1), `${t.gain.toFixed(3)}, ${t.lead.toFixed(1)}`);
}
for (const c of [0.02, 0.1, 0.3, 1]) {
  for (const om of [0.5, 4, 30]) {
    const a = K.transfer(c, om), s = M.transferSeries(c, om);
    check("transfer", `the series sum of a_j/(alpha_j - i omega) equals the closed form, c0 = ${c}, omega = ${om}`, Math.hypot(a.re - s.re, a.im - s.im) < 1e-4, `${a.re.toFixed(5)}+${a.im.toFixed(5)}i vs ${s.re.toFixed(5)}+${s.im.toFixed(5)}i`);
  }
}
{
  let bad = 0, n = 0, worstGain = 0;
  for (const c of [0.005, 0.02, 0.1, 0.3, 1, 3]) {
    for (let lo = -2; lo <= 5; lo += 0.05) {
      const t = K.transfer(c, 10 ** lo); n++;
      if (!(t.gain < 1 && t.lead > 0 && t.lead < 90)) bad++;
      worstGain = Math.max(worstGain, t.gain);
    }
  }
  check("transfer", "gain below 1 and lead in (0, 90) degrees at 846 pairs of cost and frequency", bad === 0, `${n} pairs, ${bad} outside; largest gain ${worstGain.toFixed(6)}`);
  let quad = true;
  for (const c of [0.02, 0.1, 0.3]) for (const om of [0.1, 2, 50]) for (const t of M.seriesTerms(c, om, 5).terms) quad = quad && t.re > 0 && t.im > 0;
  const z = M.seriesTerms(0.1, 0, 5);
  check("transfer", "every drawn term lies in the first quadrant, and at omega = 0 the terms plus the rest sum to 1", quad && Math.abs(z.terms.reduce((a, t) => a + t.re, 0) + z.rest.re - 1) < 1e-12, `first term at omega = 0: ${z.terms[0].re.toFixed(4)}`);
  // the arrows plate's running integral, at the slider's ends and the costs it offers: its last point is the
  // closed form, and a stretch of it matches a fine quadrature of w(s) e^{i omega s}
  const ends = [];
  let endOk = true;
  for (const c of [0.02, 0.1, 0.3]) for (const om of [0.1, 2, 100]) {
    const pts = M.runningTransform(c, om), end = pts[pts.length - 1], W = K.transfer(c, om);
    const d = Math.hypot(end.re - W.re, end.im - W.im);
    endOk = endOk && d < 1e-9; ends.push(d);
  }
  check("transfer", "the running integral ends at the closed form at omega = 0.1, 2, and 100 for c0 = 0.02, 0.1, 0.3 (the plate's ends)", endOk, `largest distance ${Math.max(...ends).toExponential(1)}`);
  {
    const c = 0.02, om = 100, pts = M.runningTransform(c, om);
    const i1 = pts.findIndex((p) => p.s >= 0.1), i2 = pts.findIndex((p) => p.s >= 0.5);
    const a = pts[i1].s, bb = pts[i2].s, n = 40000, hh = (bb - a) / n;
    let re = 0, im = 0;
    for (let i = 0; i <= n; i++) { const sv = a + i * hh, wv = K.kernelAt(sv, c), f = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; re += f * wv * Math.cos(om * sv); im += f * wv * Math.sin(om * sv); }
    re *= hh / 3; im *= hh / 3;
    const d = Math.hypot(pts[i2].re - pts[i1].re - re, pts[i2].im - pts[i1].im - im);
    check("transfer", "between the first bin edges at or above s = 0.1 and 0.5, the running integral at c0 = 0.02, omega = 100 matches Simpson's rule on 40,000 steps", d < 1e-7, `edges ${a.toFixed(4)} and ${bb.toFixed(4)}; difference ${d.toExponential(1)}`);
  }
}
for (const c of [1e-4, 3e-4, 1e-3, 3e-3, 0.01, 0.02, 0.035, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10]) {
  const m = K.meanLookAhead(c);
  let prev = Infinity, mono = true;
  for (let lo = -1.3; lo <= 4; lo += 0.02) { const om = 10 ** lo, tl = (K.transfer(c, om).lead * Math.PI) / 180 / om; if (!(tl < prev + 1e-9) || !(tl < m + 1e-9)) mono = false; prev = tl; }
  const small = (K.transfer(c, 1e-4).lead * Math.PI) / 180 / 1e-4;
  check("transfer", `the lead in time falls with frequency from omega = 0.05 to 1e4, stays below m(c0), and tends to m(c0) as omega -> 0 (c0 = ${c})`, mono && Math.abs(small - m) / m < 1e-4, `at omega = 1e-4: ${small.toFixed(5)} vs m = ${m.toFixed(5)}`);
}

// ---- the lead near 45 degrees ------------------------------------------------------------------------------
{
  const p1 = M.leadPeak(1), p01 = M.leadPeak(0.1);
  check("lead", "at c0 = 1 the lead passes 45 degrees (about 46, near omega = 66)", p1.lead > 45.5 && p1.lead < 46.5 && p1.omega > 40 && p1.omega < 100, `${p1.lead.toFixed(3)} at ${p1.omega.toFixed(1)}`);
  check("lead", "at c0 = 0.1 the lead stays below 45 degrees over omega from 0.01 to 1e6", p01.lead < 45, `largest ${p01.lead.toFixed(3)} at ${p01.omega.toExponential(1)}`);
  const far = [0.02, 0.1, 1].map((c) => K.transfer(c, 1e6).lead);
  check("lead", "the lead tends to 45 degrees: within 0.05 at omega = 1e6 for c0 = 0.02, 0.1, 1", far.every((l) => Math.abs(l - 45) < 0.05), far.map((l) => l.toFixed(3)).join(", "));
  // the lead in degrees isn't monotone at c0 = 1, which is why the text no longer says it grows while the time lead falls
  const l66 = K.transfer(1, 66).lead, l100 = K.transfer(1, 100).lead;
  check("lead", "at c0 = 1 the lead in degrees falls from omega = 66 to 100, while the lead in time falls too", l100 < l66 && (l100 * Math.PI) / 180 / 100 < (l66 * Math.PI) / 180 / 66, `${l66.toFixed(3)} at 66, ${l100.toFixed(3)} at 100`);
}

// ---- the look-ahead ----------------------------------------------------------------------------------------
{
  const best = M.maxLookAhead();
  check("lookahead", "MaxLookAhead and MaxLookAheadCost, by the page's scan of 4,000 costs", asPrinted(best.m, N.MaxLookAhead) && asPrinted(best.cost, N.MaxLookAheadCost), `${best.m.toFixed(4)} at ${best.cost.toFixed(4)} vs ${N.MaxLookAhead} at ${N.MaxLookAheadCost}`);
  check("lookahead", "LookAheadTenth from the closed form (22)", asPrinted(M.lookAheadClosed(0.1), N.LookAheadTenth), `${M.lookAheadClosed(0.1).toFixed(4)} vs ${N.LookAheadTenth}`);
  check("lookahead", "DecisionTimeTenth: b0 tanh b0 at 0.1", asPrinted(K.meanDecisionTime(0.1), N.DecisionTimeTenth), `${K.meanDecisionTime(0.1).toFixed(4)} vs ${N.DecisionTimeTenth}`);
  for (const c of [1e-3, 0.02, 0.1, 0.5, 3]) {
    const s = K.meanLookAhead(c), a = M.lookAheadFirst(c), b = M.lookAheadClosed(c), p = M.lookAheadByStarts(c);
    check("lookahead", `both forms of (22), the series mean, and the integral over starts agree at c0 = ${c}`, Math.abs(a - s) < 1e-6 && Math.abs(b - s) < 1e-6 && Math.abs(p - s) < 1e-6, `${a.toFixed(7)}, ${b.toFixed(7)}, ${s.toFixed(7)}, ${p.toFixed(7)}`);
  }
  const dq = -(K.transform(1e-4, 0.1) - 1) / 1e-4;
  check("lookahead", "minus the transform's slope at 0 (difference quotient) is the mean", Math.abs(dq - K.meanLookAhead(0.1)) < 1e-3, `${dq.toFixed(5)} vs ${K.meanLookAhead(0.1).toFixed(5)}`);
  const m4 = M.lookAheadClosed(1e-4), big = M.lookAheadClosed(100) / ((2 / 3) * K.B(100) ** 2);
  check("lookahead", "the limits: m(1e-4) within 0.005 of 1/2, and m / (2/3 b0^2) within 1e-3 of 1 at c0 = 100", Math.abs(m4 - 0.5) < 0.005 && Math.abs(big - 1) < 1e-3, `m(1e-4) = ${m4.toFixed(5)}; ratio at 100 = ${big.toFixed(6)}`);
}
for (const c of [0.02, 0.1, 0.5]) {
  // the plate's own sampler, at each cost it offers, with its default seed
  const smp = M.sampleStarts(c, 2026), b = K.B(c), shift = K.OVERSHOOT * Math.sqrt(smp.dt);
  const edgeOk = smp.starts.every((p) => b - shift - p.y >= 0.75 * (b - 0.9 * b) - 1e-12 && p.se > 0);
  const g = M.worstGap(smp, b);
  check("starts", `the plate's sampled mean times from six starts lie within 3 standard errors of b0 tanh b0 - y tanh y, every start below the moved-in bound (c0 = ${c})`, edgeOk && g < 3, `dt ${smp.dt.toExponential(2)}, shift ${shift.toFixed(4)}; largest gap ${g.toFixed(2)} standard errors`);
}
{
  const w4 = K.transform(1e-4, 0.02), m = K.meanLookAhead(0.02);
  check("lookahead", "the mean plate's reading at lambda = 1e-4 agrees with 1 - 1e-4 m(c0) to 1e-8 (c0 = 0.02)", Math.abs(w4 - (1 - 1e-4 * m)) < 1e-8, `${w4.toFixed(10)} vs ${(1 - 1e-4 * m).toFixed(10)}`);
}

// ---- the shift -------------------------------------------------------------------------------------------
{
  const flat = () => 0.1;
  const d = Math.abs(M.shiftedBound(flat, 0.7) - toDiscrete(boundForCost(0.1), 0.01));
  // a 16-fold jump at time 1: the shifted bound drops a look-ahead m(0.1) before the per-moment bound does
  const jump = costOf({ id: "jump", params: { at: 1, factor: 16 } });
  const mid = 0.5 * (toDiscrete(boundForCost(0.1), 0.01) + toDiscrete(boundForCost(1.6), 0.01));
  const cross = (fn) => { for (let t = 0; t < 2; t += 0.0005) if (fn(t) < mid) return t; return NaN; };
  const tPm = cross((t) => toDiscrete(boundForCost(jump(t)), 0.01)), tSh = cross((t) => M.shiftedBound(jump, t));
  const m = K.meanLookAhead(0.1, 400);
  check("shift", "the shifted rule is the per-moment rule at a constant cost, and drops m(0.1) earlier before a jump", d < 1e-12 && Math.abs(tPm - tSh - m) < 0.002, `drops at ${tSh.toFixed(4)} and ${tPm.toFixed(4)}; m = ${m.toFixed(4)}`);
}
{
  // a flat schedule, as a drawing at 0.01 (the plate's grid, the shared worker's program): the two rules coincide,
  // the program's bound doesn't, and the sentence says which curves coincide
  const choice = { id: "draw", points: Array(26).fill(0.01) }, cost = costOf(choice);
  const P = exactPolicy(cost, VIEW + SPARE), ts = [], ex = [], pm = [], sh = [];
  for (let k = 0; k < P.ts.length && P.ts[k] <= VIEW + 1e-9; k += 2) { ts.push(P.ts[k]); ex.push(P.bounds[k]); pm.push(toDiscrete(boundForCost(cost(P.ts[k])), 0.01)); sh.push(M.shiftedBound(cost, P.ts[k])); }
  const G = M.shiftGaps(ex, pm, sh), say = S.shiftSay("Draw your own", G, M.isFlat(cost));
  check("shift", "a flat drawing counts as flat; its two rules coincide while the program's bound sits apart, and the sentence names only the two rules", M.isFlat(cost) && G.apart < 1e-12 && G.maxPm > 1e-3 && /per-moment and shifted bounds coincide/.test(say) && !/three/.test(say), `${say}`);
  const smooth0 = costOf({ id: "smooth", params: { c0: 0.1, size: 0 } }), flat98 = costOf({ id: "draw", points: Array(26).fill(0.98) });
  check("shift", "a Smooth of size 0 and a flat drawing at 0.98 count as flat; the default jump and Smooth don't", M.isFlat(smooth0) && M.isFlat(flat98) && !M.isFlat(costOf({ id: "jump" })) && !M.isFlat(costOf({ id: "smooth" })), "by the schedule's values every 0.01 to time 14");
}

// ---- half-integration ---------------------------------------------------------------------------------------
for (const c of [0.02, 0.1, 1]) {
  const b = K.B(c);
  const near = K.flux(1e-6, b) * Math.sqrt((Math.PI * 1e-6) / 2);
  const ks = M.logSlope((s) => K.kernelAt(s, c), 1e-4), gs = M.logSlope((w) => K.transfer(c, w).gain, 1e4);
  const ga = K.transfer(c, 1e6).gain / M.gainAsymptote(1e6, c);
  check("half", `near s = 0, n(s) sqrt(pi s / 2) -> 1, and the kernel's and the gain's log slopes are -1/2 (c0 = ${c})`, Math.abs(near - 1) < 3e-3 && Math.abs(ks + 0.5) < 0.012 && Math.abs(gs + 0.5) < 0.006 && Math.abs(ga - 1) < 2e-3, `n sqrt(pi s/2) at 1e-6: ${near.toFixed(5)}; slopes ${ks.toFixed(4)} at s = 1e-4, ${gs.toFixed(4)} at omega = 1e4; gain / asymptote at 1e6: ${ga.toFixed(5)}`);
}
{
  const { r } = M.rAndTanh(0.1, 37);
  const sq = { re: r.re * r.re - r.im * r.im, im: 2 * r.re * r.im };
  const far = M.rAndTanh(0.1, 1e4);
  check("half", "r^2 = 1 - 2 i omega, r / sqrt(omega) -> 1 - i, and tanh(r b0) -> 1", Math.abs(sq.re - 1) < 1e-12 && Math.abs(sq.im + 74) < 1e-10 && Math.abs(far.r.re / 100 - 1) < 0.01 && Math.abs(far.r.im / 100 + 1) < 0.01 && Math.hypot(far.tanh.re - 1, far.tanh.im) < 1e-12, `r(1e4) / 100 = ${(far.r.re / 100).toFixed(4)} ${(far.r.im / 100).toFixed(4)}i`);
}

// ---- the flat bound's reward ---------------------------------------------------------------------------------
for (const c of [0.02, 0.1, 0.5]) {
  const B = K.B(c), h = 1e-4;
  const d1 = (M.flatReward(B + h, c) - M.flatReward(B - h, c)) / (2 * h);
  const d2 = (M.flatReward(B + h, c) - 2 * M.flatReward(B, c) + M.flatReward(B - h, c)) / (h * h);
  const L = (d) => M.flatReward(B, c) - M.flatReward(B + d, c);
  const ru = L(0.2) / L(0.1), rd = L(-0.2) / L(-0.1);
  check("reward", `R'(B) = 0 and R''(B) = -2c, and doubling a miss about quadruples the loss (c = ${c})`, Math.abs(d1) < 1e-7 && Math.abs(d2 / (-2 * c) - 1) < 1e-3 && ru > 3.3 && ru < 4.7 && rd > 3.3 && rd < 4.7, `R' = ${d1.toExponential(1)}, R''/(-2c) = ${(d2 / (-2 * c)).toFixed(5)}, ratios ${ru.toFixed(2)} above, ${rd.toFixed(2)} below`);
}

// ---- the band at the bound --------------------------------------------------------------------------------
for (const c of [0.02, 0.1, 0.5]) {
  const b = K.B(c), h = 1e-4;
  const w0 = M.waitingValue(b, c), w1 = (M.waitingValue(b, c) - M.waitingValue(b - h, c)) / h;
  const w2 = (M.waitingValue(b - 2 * h, c) - 2 * M.waitingValue(b - h, c) + M.waitingValue(b, c)) / (h * h);
  const wd = (M.waitingValue(b - 2e-3, c) - 2 * M.waitingValue(b - 1e-3, c) + M.waitingValue(b, c)) / 1e-6;
  check("band", `the waiting value is 0 with slope 0 at the bound and (V - g)_yy = 2c there (c = ${c})`, w0 === 0 && Math.abs(w1) < 1e-3 * c && Math.abs(w2 / (2 * c) - 1) < 2e-3 && Math.abs(wd / (2 * c) - 1) < 0.02, `slope ${w1.toExponential(1)}; second difference / 2c = ${(w2 / (2 * c)).toFixed(4)} (h = 1e-4), ${(wd / (2 * c)).toFixed(4)} (h = 1e-3, as the plate)`);
}
{
  const b0 = K.B(0.1);
  const r = [1e-3, 1e-2].map((D) => M.timeAbove(b0, D) / (D * D));
  // the Green's function, integrated over all levels from a start at 0, is the mean exit time L tanh L
  const L = 1.7, n = 4000; let acc = 0;
  for (let i = 0; i <= n; i++) { const z = (L * i) / n; acc += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * 2 * Math.cosh(z) ** 2 * (Math.tanh(L) - Math.tanh(z)); }
  acc *= L / n / 3;
  const g = (M.hitMean(0, b0 + 1e-4) - M.hitMean(0, b0 - 1e-4)) / 1e-4;
  check("band", "time above b0 over D^2 tends to 1; the Green's function gives E_0 tau = L tanh L; (E tau+ - E tau-) / D tends to 2 (tanh b0 + b0 sech^2 b0)",
    Math.abs(r[0] - 1) < 0.01 && Math.abs(acc - L * Math.tanh(L)) < 1e-8 && Math.abs(g - 2 * K.fluxTotal(b0)) < 1e-6, `ratios ${r.map((x) => x.toFixed(4)).join(", ")}; ${acc.toFixed(8)} vs ${(L * Math.tanh(L)).toFixed(8)}; ${g.toFixed(6)} vs ${(2 * K.fluxTotal(b0)).toFixed(6)}`);
}

// ---- the forward computation and the losses -------------------------------------------------------------------
{
  const cost = costOf({ id: "smooth" }), H = 8.5;
  const dp = exactPolicy(cost, H), ts = dp.ts;
  const pm = Float64Array.from(ts, (t) => toDiscrete(boundForCost(cost(t)), 0.01));
  const flatB = Float64Array.from(ts, () => 1.0);
  let worst = 0, mass = 0;
  for (const xb of [dp.bounds, pm, flatB]) {
    const a = M.forward(xb, ts, cost), b = score(xb, ts, cost);
    worst = Math.max(worst, Math.abs(a.reward - b.reward), Math.abs(a.rt - b.rt), Math.abs(a.p - b.p));
    mass = Math.max(mass, Math.abs(a.f.reduce((x, y) => x + y, 0) - 1));
  }
  check("scorer", "the forward computation equals model.js's score on three policies, and its decision-time chances sum to 1", worst < 1e-12 && mass < 1e-9, `largest difference ${worst.toExponential(1)}; mass off by ${mass.toExponential(1)}`);
}
{
  // the paper's Table 9: one smooth shape scaled in log c around 0.2, horizon 10, per-moment losses in points per 100
  const ff = (t) => 0.6 * Math.sin(1.3 * t + 0.4) + 0.5 * Math.sin(3.1 * t + 2) + 0.4 * Math.sin(5.2 * t + 4);
  const raw = table("tab_scaling");
  const parse = (s) => { const m = s.match(/\$?([\d.]+)\\times 10\^\{(-?\d+)\}\$?/); return m ? +m[1] * 10 ** +m[2] : NaN; };
  const out = [];
  let ok = true;
  for (const a of [0.2, 0.4, 0.8]) {
    const row = raw.find((r) => +r[0] === a), paper = parse(row[1]);
    const c = (t) => 0.2 * Math.exp(a * ff(t));
    const dp = exactPolicy(c, 10);
    const pm = Float64Array.from(dp.ts, (t) => toDiscrete(boundForCost(c(t)), 0.01));
    const mine = 100 * (score(dp.bounds, dp.ts, c).reward - M.forward(pm, dp.ts, c).reward);
    ok = ok && Math.abs(mine / paper - 1) < 0.06;
    out.push(`a = ${a}: ${mine.toExponential(2)} vs ${paper.toExponential(1)}`);
  }
  check("scorer", "the page's program and scorer against Table 9's per-moment losses at a = 0.2, 0.4, 0.8 (within 6%, on the page's coarser grid)", ok, out.join("; "));
}
{
  const EPS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32, 1 / 64];
  const res = M.lossRun(costOf({ id: "smooth" }), EPS);
  const lp = res.runs.map((r) => r.loss.pm), keep = lp.map((v) => M.resolved(v, res.floor));
  const slope = M.lastSlope(EPS, lp, keep);
  check("loss", "on the smooth preset, the per-moment loss falls with a slope near 2 over its three smallest sizes above the display cutoff", slope > 1.6 && slope < 2.4 && keep.filter(Boolean).length >= 4 && res.floor > 0 && res.floor < 1e-4, `slope ${slope.toFixed(2)}; ${keep.filter(Boolean).length} of 7 sizes above the cutoff; baseline ${res.floor.toExponential(1)}; c(0) = ${res.c0.toFixed(4)}`);
  const ratios = res.runs.filter((r) => r.eps <= 0.25 && M.resolved(r.loss.pm, res.floor) && r.late.pm < 0.1).map((r) => r.pred.pm / r.loss.pm);
  check("conjecture", "on the smooth preset, the conjecture's prediction for the per-moment rule is within 0.8 to 1.3 of the scored loss wherever that loss is above the display cutoff and mostly early (eps <= 1/4)", ratios.length >= 2 && ratios.every((x) => x > 0.8 && x < 1.3), ratios.map((x) => x.toFixed(3)).join(", "));
  const draw = M.lossRun(costOf({ id: "draw", points: defaultDrawing() }), [1 / 4]);
  check("conjecture", "the late share is a share: between 0 and 1, and the running share ends at 1 (Smooth at seven sizes, the default drawing at 1/4)", res.runs.every((r) => r.late.pm >= 0 && r.late.pm <= 1 && Math.abs(r.cum.pm[r.cum.pm.length - 1] - 1) < 1e-12) && draw.runs[0].late.pm >= 0, `late shares ${res.runs.map((r) => (100 * r.late.pm).toFixed(0) + "%").join(", ")}`);
  // the display cutoff against a grid twice as fine in time and space, and against a forced choice at 28 instead of 14
  const fine = M.lossRun(costOf({ id: "smooth" }), EPS, { dt: 0.005, h: 0.01 });
  const long = M.lossRun(costOf({ id: "smooth" }), EPS, { horizon: 28 });
  const moves = [], movesH = [];
  res.runs.forEach((r, i) => { for (const w of ["pm", "fo"]) if (M.resolved(r.loss[w], res.floor)) { moves.push(Math.abs(fine.runs[i].loss[w] / r.loss[w] - 1)); movesH.push(Math.abs(long.runs[i].loss[w] / r.loss[w] - 1)); } });
  check("loss", `on the Smooth preset, each of the ${moves.length} losses above the display cutoff (both rules, seven sizes) changes by under 10% on a grid twice as fine, and by under 10% with the forced choice at 28`, moves.length >= 6 && Math.max(...moves) < 0.1 && Math.max(...movesH) < 0.1, `largest changes ${(100 * Math.max(...moves)).toFixed(1)}% (finer grid) and ${(100 * Math.max(...movesH)).toFixed(2)}% (horizon 28); baseline ${res.floor.toExponential(1)}, ${fine.floor.toExponential(1)}, ${long.floor.toExponential(1)}`);
  // the baseline depends on the forced horizon as well as the grid (the audit's flat cost of 0.01), which is why the
  // page calls it the baseline for this grid and horizon
  const b14 = M.lossRun(() => 0.01, []).floor, b28 = M.lossRun(() => 0.01, [], { horizon: 28 }).floor;
  check("loss", "at a flat cost of 0.01, the baseline on the same grid changes with the forced horizon (14 against 28)", b14 > 2 * b28 && b28 > 0, `${b14.toExponential(3)} at 14, ${b28.toExponential(3)} at 28`);
}
{
  // the program scored from its own stop set: its score is its value and it matches exactPolicy's bounds; on four
  // schedules, three policies score at or below it: the per-moment rule, the first-order bound b0 + beta (eps = 1,
  // around c(0), clipped at 0), and the exported bound, including where a high cost puts the exported bound below the
  // grid's first step
  const cases = [["Smooth", costOf({ id: "smooth" })], ["32-fold jump at 0.2", costOf({ id: "jump", params: { at: 0.2, factor: 32 } })], ["flat 0.98", () => 0.98], ["flat 3.2", () => 3.2]];
  const out = [];
  let ok = true;
  for (const [name, cost] of cases) {
    const P = M.gridProgram(cost, 8.5), E = exactPolicy(cost, 8.5);
    let same = 0; for (let k = 0; k < P.ts.length; k++) if (!(P.bounds[k] === E.bounds[k])) same++;
    const Rm = M.forwardPolicy({ stop: P.stop, m: P.m }, P.ts, cost).reward;
    const c0 = cost(0), beta = K.firstOrder((t) => cost(t) - c0, Array.from(P.ts), c0);
    const pm = Float64Array.from(P.ts, (t) => toDiscrete(boundForCost(cost(t)), 0.01));
    const fo = Float64Array.from(P.ts, (t, k) => toDiscrete(K.B(c0) + beta[k], 0.01));
    const lossPm = P.value - M.forward(pm, P.ts, cost).reward, lossFo = P.value - M.forward(fo, P.ts, cost).reward, lossB = P.value - score(E.bounds, E.ts, cost).reward;
    ok = ok && same === 0 && Math.abs(Rm - P.value) < 1e-12 && lossPm > -1e-12 && lossFo > -1e-12 && lossB > -1e-12;
    out.push(`${name}: value ${P.value.toFixed(6)}; losses: per-moment ${lossPm.toExponential(1)}, first-order ${lossFo.toExponential(1)}, exported bound ${lossB.toExponential(1)}`);
  }
  check("scorer", "the program scored from its own stop set earns its value and equals exactPolicy's bounds; on four schedules the per-moment rule, the first-order bound, and the exported bound each score at or below it", ok, out.join("; "));
  // at a cost of 3.2 the program waits at the center but decides one grid step out (the paper's code reports 0 there);
  // the exported bound lies between the two, and scored as a bound it earns within 1e-4 of the stop set's value
  const P = M.gridProgram(() => 3.2, 8.5), E = exactPolicy(() => 3.2, 8.5);
  const gap = P.value - score(E.bounds, P.ts, () => 3.2).reward;
  check("scorer", "at a cost of 3.2 the program waits at the center and decides one step out, where the paper's code reports 0: the exported bound lies between 0 and 0.02, and scored as a bound it earns within 1e-4 of the stop set's value", P.paperZero[0] === 1 && E.bounds[0] > 0 && E.bounds[0] < 0.02 && gap >= -1e-12 && gap < 1e-4, `bound ${E.bounds[0].toFixed(4)}; value ${P.value.toFixed(6)}, the bound scores ${gap.toExponential(2)} below it (an exported 0 would score 0.5, ${(P.value - 0.5).toExponential(2)} below)`);
}
{
  // the audit's drawing (2 for its first point, 0.01 after) at eps = 1: both ratios fit the axis, which grows to 7;
  // and, with made-up ratios of 12 and 3, the axis stops at 8 and the 12 is drawn as an arrow at the top
  const res = M.lossRun(costOf({ id: "draw", points: [2, ...Array(25).fill(0.01)] }), [1]);
  const r = res.runs[0], ratios = [r.pred.pm / r.loss.pm, r.pred.fo / r.loss.fo], top = M.ratioAxisTop(ratios);
  const capTop = M.ratioAxisTop([12, 3]);
  check("conjecture", "on the audit's drawing at eps = 1, both rules' ratios (6.3 and 2.9) are drawn as dots on an axis to 7, and both losses are positive; made-up ratios 12 and 3 give an axis to 8 with the 12 drawn as an arrow", ratios.every((x) => M.ratioMark(x, top) === "dot") && top === 7 && r.loss.pm > 0 && r.loss.fo > 0 && capTop === 8 && M.ratioMark(12, capTop) === "arrow" && M.ratioMark(3, capTop) === "dot" && M.ratioMark(NaN, capTop) === "none", `ratios ${ratios.map((x) => x.toFixed(2)).join(", ")}; axis top ${top}`);
}

// ---- the sentences ----------------------------------------------------------------------------------------
{
  const R = K.rng(7);
  let bad = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const u = () => R.next();
    const say = [
      S.heroLabel(0.5 + 8 * u(), u(), 90 * u()),
      S.waveVerdict(i % 4 ? 90 * u() : NaN, 36.68, 36.4),
      S.waveSay([0.02, 0.1, 0.3, 1][i % 4], 0.1 + 100 * u(), u(), 50 * u(), u(), u()),
      S.lookaheadVerdict(["zero", "half", "long", "shown"][i % 4], 0.5 + 0.01 * u(), 1e-4, 4 + u()),
      S.lookaheadSay(10 ** (-4 + 5 * u()), u(), 5 * u(), 0.619, 0.035),
      S.shiftSay("Cost jumps", { maxPm: u(), maxSh: u(), avgPm: u(), avgSh: u(), apart: u() * 1e-3 }, i % 2 === 0),
      S.shiftNote(["deadline", "constant", ""][i % 3], "Wave"),
      S.leadPeakSay([0.02, 0.1, 1][i % 3], { lead: 40 + 7 * u(), omega: 10 ** (6 * u()) }),
      S.rewardVerdict(["same", "two", "four"][i % 3], 3 + u(), 3 + u(), 0.1),
      S.rewardSay(0.1, (u() - 0.5) * (i % 5 ? 1 : 1e-5), u() * 0.01, u() * 0.01),
      S.bandSay(0.3 * u() + 1e-3, u() * 1e-3, u() * 1e-3, u() * 1e-3),
      S.lossNote(["deadline", "constant", "rising", ""][i % 4], "Smooth", 0.05 + u()),
      S.lossSay(1 / 2 ** (i % 7), u() * 1e-3, (u() - 0.2) * 1e-5, i % 3 ? 3 * u() : NaN, i % 4 ? 5 * u() : NaN, i % 2 === 0, i % 3 === 0),
      S.conjSay(1 / 2 ** (i % 7), i % 5 ? 2 * u() : NaN, i % 2 === 0, i % 6 ? u() : NaN, 2 * u(), i % 3 === 0, u(), i % 7 ? u() * 1e-3 : 0, i % 4 ? u() * 1e-4 : -1e-9),
      S.lossState(14, i % 2 === 0, i % 3 ? "loss" : "conj"),
      S.shiftState(i % 2 === 0, 126, i % 3 === 0),
      S.noLossNote(),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const p1 = S.leadPeakSay(1, M.leadPeak(1)), p01 = S.leadPeakSay(0.1, M.leadPeak(0.1));
  check("words", "the lead sentence says the lead passes 45 degrees at c0 = 1 and not at 0.1, and never says it is capped", /passes 45°/.test(p1) && !/passes/.test(p01) && !/at most 45|up to an eighth/.test(p1 + p01 + S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04)), p1);
  check("words", "the wave sentence flags a lead above 45 degrees only when there is one", /above 45°/.test(S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04)) && !/above 45°/.test(S.waveSay(0.1, 8, 0.358, 36.7, 0.08, 0.546)), S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04));
  const neg = S.lossSay(0.25, -9.5e-6, 1e-6, NaN, NaN, false, false), cj = S.conjSay(0.25, 1.02, true, 0.02, 1.4, true, 0.9, 1e-4, 1e-6);
  const la = S.lookaheadSay(1e-4, 0.504, 4.95, 0.619, 0.035) + S.lookaheadVerdict("half", 0.504, 1e-4, 4.95);
  check("words", "a nonpositive loss is a difference the grid can't measure, the first-order ratio is not credited to the conjecture, and powers of ten read as 10⁻⁴", /no reward measurable on this grid/.test(neg) && !/loses −/.test(neg) && /doesn't cover the first-order bound/.test(cj) && /10⁻⁴ to 10/.test(la) && /c₀ = 10⁻⁴/.test(la) && !/e-\d/.test(la + neg), `${neg} | ${la}`);
  const st = S.shiftState(false, 126, true), st0 = S.shiftState(true, 48, false), cut = S.lossSay(0.25, 1e-5, 1e-6, NaN, NaN, false, false);
  check("words", "the shift plate says where the program waits at 0 its bound is placed below the grid's first step and the paper's code reports 0, the band's step 3 says expected time, and losses under the cutoff are called that", /waits at 0 but decides at the grid's first step/.test(st) && /paper's code reports 0/.test(st) && !/wait/.test(st0) && /deadline/.test(st0) && /expected time spent above/.test(S.BAND_HEADS[2]) && /below the display cutoff/.test(cut) && !/resolv/.test(cut + S.conjSay(0.25, 1, false, 0, 1, false, 0, 1e-5, 1e-6)), st);
  check("words", "the loss sentence names a slope near 2 as second order, and the conjecture's sentence starts with the word Conjecture", /close to the 2/.test(S.lossSay(0.25, 1e-4, 1e-6, 1.95, 3.8, true, true)) && !/close to the 2/.test(S.lossSay(0.25, 1e-4, 1e-6, 1.2, 3.8, true, true)) && /^Conjecture/.test(S.conjSay(0.25, 1.02, true, 0.02, 1.4, false, 0.9)), S.lossSay(0.25, 1e-4, 1e-6, 1.95, 3.8, true, true));
}
