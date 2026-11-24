// Chapter 7: the transfer function against Table 1 and its series, the limits of the look-ahead and their numbers,
// half-integration's slopes, the closed forms behind the second-order loss, the forward computation against
// model.js's scorer and the paper's Table 9, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch07-model.js";
import { exactPolicy, score, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, defaultDrawing } from "../../book/assets/js/schedules-book.js";
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
  const pts = M.runningTransform(0.1, 2), end = pts[pts.length - 1], W = K.transfer(0.1, 2);
  check("transfer", "the running integral of w(s) e^{i omega s} over the bins ends at the closed form (omega = 2)", Math.hypot(end.re - W.re, end.im - W.im) < 2e-3, `${end.re.toFixed(4)}+${end.im.toFixed(4)}i vs ${W.re.toFixed(4)}+${W.im.toFixed(4)}i`);
}
for (const c of [0.02, 0.1, 0.3, 1]) {
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
{
  // the plate's six starts, 400 decisions each, with its seed
  const c = 0.1, b = K.B(c), R = K.rng(2026 + 31 + Math.round(c * 1000));
  const zs = [0, 0.2, 0.4, 0.6, 0.8, 0.95].map((u) => {
    const y = u * b; let a = 0, q = 0; const n = 400;
    for (let i = 0; i < n; i++) { const t = K.decide(y, b, R).t; a += t; q += t * t; }
    a /= n; const se = Math.sqrt((q / n - a * a) / n);
    return (a - M.meanTimeFrom(y, b)) / se;
  });
  check("starts", "the plate's sampled mean times from six starts lie within 3 standard errors of b0 tanh b0 - y tanh y", zs.every((z) => Math.abs(z) < 3), zs.map((z) => z.toFixed(1)).join(", "));
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
  check("loss", "on the smooth preset, the per-moment loss falls with a slope near 2 over its three smallest resolved sizes", slope > 1.6 && slope < 2.4 && keep.filter(Boolean).length >= 4 && res.floor > 0 && res.floor < 1e-4, `slope ${slope.toFixed(2)}; ${keep.filter(Boolean).length} of 7 sizes resolved; resolution ${res.floor.toExponential(1)}; c(0) = ${res.c0.toFixed(4)}`);
  const ratios = res.runs.filter((r) => r.eps <= 0.25 && M.resolved(r.loss.pm, res.floor) && r.late.pm < 0.1).map((r) => r.pred.pm / r.loss.pm);
  check("conjecture", "on the smooth preset, the conjecture's prediction for the per-moment rule is within 0.8 to 1.3 of the scored loss wherever that loss is resolved and mostly early (eps <= 1/4)", ratios.length >= 2 && ratios.every((x) => x > 0.8 && x < 1.3), ratios.map((x) => x.toFixed(3)).join(", "));
  const draw = M.lossRun(costOf({ id: "draw", points: defaultDrawing() }), [1 / 4]);
  check("conjecture", "the late share is a share: between 0 and 1, and the running share ends at 1", res.runs.every((r) => r.late.pm >= 0 && r.late.pm <= 1 && Math.abs(r.cum.pm[r.cum.pm.length - 1] - 1) < 1e-12) && draw.runs[0].late.pm >= 0, `late shares ${res.runs.map((r) => (100 * r.late.pm).toFixed(0) + "%").join(", ")}`);
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
      S.shiftSay("Cost jumps", u(), u(), u(), u()),
      S.shiftNote(["deadline", "constant", ""][i % 3], "Wave"),
      S.leadPeakSay([0.02, 0.1, 1][i % 3], { lead: 40 + 7 * u(), omega: 10 ** (6 * u()) }),
      S.rewardVerdict(["same", "two", "four"][i % 3], 3 + u(), 3 + u(), 0.1),
      S.rewardSay(0.1, (u() - 0.5) * (i % 5 ? 1 : 1e-5), u() * 0.01, u() * 0.01),
      S.bandSay(0.3 * u() + 1e-3, u() * 1e-3, u() * 1e-3, u() * 1e-3),
      S.lossNote(["deadline", "constant", "rising", ""][i % 4], "Smooth", 0.05 + u()),
      S.lossSay(1 / 2 ** (i % 7), u() * 1e-3, (u() - 0.2) * 1e-5, i % 3 ? 3 * u() : NaN, i % 4 ? 5 * u() : NaN, i % 2 === 0, i % 3 === 0),
      S.conjSay(1 / 2 ** (i % 7), i % 5 ? 2 * u() : NaN, i % 2 === 0, i % 6 ? u() : NaN, 2 * u(), i % 3 === 0, u()),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const p1 = S.leadPeakSay(1, M.leadPeak(1)), p01 = S.leadPeakSay(0.1, M.leadPeak(0.1));
  check("words", "the lead sentence says the lead passes 45 degrees at c0 = 1 and not at 0.1, and never says it is capped", /passes 45°/.test(p1) && !/passes/.test(p01) && !/at most 45|up to an eighth/.test(p1 + p01 + S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04)), p1);
  check("words", "the wave sentence flags a lead above 45 degrees only when there is one", /above 45°/.test(S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04)) && !/above 45°/.test(S.waveSay(0.1, 8, 0.358, 36.7, 0.08, 0.546)), S.waveSay(1, 66, 0.3, 45.9, 0.01, 0.04));
  check("words", "the loss sentence names a slope near 2 as second order, and the conjecture's sentence starts with the word Conjecture", /close to the 2/.test(S.lossSay(0.25, 1e-4, 1e-6, 1.95, 3.8, true, true)) && !/close to the 2/.test(S.lossSay(0.25, 1e-4, 1e-6, 1.2, 3.8, true, true)) && /^Conjecture/.test(S.conjSay(0.25, 1.02, true, 0.02, 1.4, false, 0.9)), S.lossSay(0.25, 1e-4, 1e-6, 1.95, 3.8, true, true));
}
