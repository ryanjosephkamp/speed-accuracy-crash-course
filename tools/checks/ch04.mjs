// Chapter 4: the page's program against model.js's, the band of Lemma 1(c) on every schedule that meets the standing
// assumption, the exact comparison on the grid behind it, the schedules' extremes, the coupling, the value of
// waiting, the value's Lipschitz bound in time, the sampled decision and cap times, the martingale of the value
// process, the paper's numbers, and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy } from "../../book/assets/js/model.js";
import { costOf, PRESETS, paramsOf, defaultDrawing, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import * as M from "../../book/assets/js/ch04-model.js";
import * as S from "../../book/assets/js/say-ch04.js";
import { check, N, asPrinted } from "./lib.mjs";

const HOR = VIEW + SPARE, KV = Math.round(VIEW / M.DT);
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const seOf = (a) => { const m = meanOf(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length / a.length); };

// ---- the paper's numbers the hero quotes -----------------------------------------------------------------------
check("band", "BoundTenth: B(0.1), the top of Figure 1(a)'s band", asPrinted(K.B(0.1), N.BoundTenth), `${K.B(0.1).toFixed(4)} vs ${N.BoundTenth}`);
check("cap", "DecisionTimeTenth: b tanh b at 0.1, the mean cap time from 0 when c_min = 0.1", asPrinted(K.meanDecisionTime(0.1), N.DecisionTimeTenth), `${K.meanDecisionTime(0.1).toFixed(4)} vs ${N.DecisionTimeTenth}`);

// ---- the page's program is model.js's, with its values kept ----------------------------------------------------
const FIG = costOf(M.FIG1A);
const PF = M.program(FIG, HOR, { keep: "all" });
{
  const E = exactPolicy(FIG, HOR);
  let d = 0; for (let k = 0; k < E.bounds.length; k++) d = Math.max(d, Math.abs(E.bounds[k] - PF.bounds[k]));
  check("program", "the page's program gives model.js's bound at every check on Figure 1(a)", d === 0, `largest difference ${d}`);
  let above = 0, below = Infinity;
  for (const t of [0, 0.3, 0.45, 1, 2]) {
    const k = Math.round(t / M.DT), b = PF.bounds[k];
    for (let i = 0; i <= PF.m; i++) {
      const y = i * PF.h, w = M.waitValue(PF, k, y);
      if (y >= b + PF.h) above = Math.max(above, Math.abs(w));
      if (y <= b - PF.h) below = Math.min(below, w);
    }
  }
  check("program", "the kept value equals the reward for deciding at and above the bound, and exceeds it below (5 times)", above < 1e-6 && below > 0, `|V − g| above ≤ ${above.toExponential(1)}; V − g below ≥ ${below.toExponential(1)}`);
}

// ---- Lemma 1(a): the value of waiting never rises with the evidence, and V is Lipschitz in y -----------------------------
{
  let rise = 0, slope = 0, fall = 0;
  for (let k = 0; k <= KV; k += 5) {
    for (let i = 0; i < PF.m; i++) {
      const y = i * PF.h, w0 = M.waitValue(PF, k, y), w1 = M.waitValue(PF, k, y + PF.h);
      rise = Math.max(rise, w1 - w0);
      const dv = M.valueAt(PF, k, y + PF.h) - M.valueAt(PF, k, y);
      slope = Math.max(slope, dv / PF.h); fall = Math.max(fall, -dv);
    }
  }
  check("coupling", "on the grid, V − g never rises with the evidence (Figure 1(a), every 0.05 time units to 2.5)", rise < 2e-6, `largest rise ${rise.toExponential(1)} (Float32 values)`);
  check("coupling", "on the grid, 0 ≤ V(t, y + h) − V(t, y) ≤ h/2: V is Lipschitz in y with constant ½", slope <= 0.5 + 1e-4 && fall < 2e-6, `largest slope ${slope.toFixed(4)}; largest fall ${fall.toExponential(1)}`);
}

// ---- the coupling ---------------------------------------------------------------------------------------------
{
  let order = 0, local = 0, push = 0, after = 0, met = 0;
  for (let s = 0; s < 200; s++) {
    const c = M.coupled(0.05, 0.5, 2.5, K.rng(100 + s), 0.001, 1);
    for (let i = 0; i < c.t.length; i++) {
      if (c.Y1[i] > c.Y2[i]) order++;
      if (c.L1[i] < c.L2[i] - 1e-9) local++;
      if (i && c.L1[i] > c.L1[i - 1] + 1e-9 && c.Y1[i] !== 0) push++;
      if (Number.isFinite(c.met) && c.t[i] >= c.met && c.Y1[i] !== c.Y2[i]) after++;
    }
    if (Number.isFinite(c.met)) met++;
  }
  check("coupling", "200 coupled pairs: the lower start never rises above the upper one", order === 0, `${order} violations`);
  check("coupling", "200 coupled pairs: the lower start's local time is never below the upper one's", local === 0, `${local} violations`);
  check("coupling", "local time grows only at steps where the path is at 0", push === 0, `${push} violations`);
  check("coupling", "paths that meet move as one afterward", after === 0, `${met} of 200 pairs met; ${after} steps apart after meeting`);
  const c = M.coupled(0.05, 0.5, 2.5, K.rng(2026 + 76), 0.001, 5);
  check("coupling", "the plate's default seed shows what its sentence says: the paths meet, and ℓ¹ ends above ℓ²", Number.isFinite(c.met) && c.L1.at(-1) > c.L2.at(-1) + 0.1, `met at ${c.met.toFixed(3)}; ℓ¹ ${c.L1.at(-1).toFixed(3)}, ℓ² ${c.L2.at(-1).toFixed(3)}`);
}

// ---- the extremes and the band ------------------------------------------------------------------------------------
{
  const e = M.extremes(FIG);
  check("band", "Figure 1(a): the scan finds c_min = c(0) and c_max = 1.6", Math.abs(e.lo - FIG(0)) < 1e-12 && Math.abs(e.hi - 1.6) < 1e-12, `${e.lo} and ${e.hi}`);
  const wave = costOf({ id: "wave", params: paramsOf({ id: "wave" }) }), ew = M.extremes(wave);
  check("band", "Wave: the scan finds 0.1(1 ± 0.3) to within 1e-6", Math.abs(ew.lo - 0.07) < 1e-6 && Math.abs(ew.hi - 0.13) < 1e-6, `${ew.lo.toFixed(7)}, ${ew.hi.toFixed(7)}`);
  const smooth = costOf({ id: "smooth", params: paramsOf({ id: "smooth" }) }), es = M.extremes(smooth);
  let per = 0; for (const t of [0.3, 1.7, 5, 12.2]) per = Math.max(per, Math.abs(smooth(t + 20 * Math.PI) - smooth(t)) / smooth(t));
  check("band", "Smooth repeats every 20π, so a scan to time 100 covers all t ≥ 0", per < 1e-9, `largest relative change over one period ${per.toExponential(1)}`);
  // a finer look around each extreme the scan found
  const golden = (f, a, b) => { const r = (Math.sqrt(5) - 1) / 2; let c = b - r * (b - a), d = a + r * (b - a); for (let i = 0; i < 80; i++) { if (f(c) < f(d)) b = d; else a = c; c = b - r * (b - a); d = a + r * (b - a); } return f((a + b) / 2); };
  const lo2 = golden(smooth, es.tLo - 0.5, es.tLo + 0.5), hi2 = -golden((t) => -smooth(t), es.tHi - 0.5, es.tHi + 0.5);
  check("band", "Smooth: the scan's extremes match a golden-section search near them, and both come after time 18 (the text says so)", Math.abs(lo2 - es.lo) < 1e-6 && Math.abs(hi2 - es.hi) < 1e-6 && es.tLo > 18 && es.tHi > 18, `c_min ${es.lo.toFixed(5)} near ${es.tLo.toFixed(2)}, c_max ${es.hi.toFixed(5)} near ${es.tHi.toFixed(2)}`);
  const pw = M.extremes(costOf({ id: "piecewise", params: { scale: 1, length: 0.8 } }));
  check("band", "Piecewise with a hold time of 0.8: the lowest cost comes between times 4 and 4.8 (the text says so)", pw.tLo > 4 && pw.tLo < 4.8, `c_min ${pw.lo.toFixed(4)} near time ${pw.tLo.toFixed(2)}`);
}
const schedules = PRESETS.filter((p) => p.id !== "deadline" && p.id !== "rising").map((p) => ({ label: p.label, choice: { id: p.id, params: paramsOf({ id: p.id }) } }));
schedules.push({ label: "Draw your own (its default)", choice: { id: "draw", points: defaultDrawing() } });
schedules.push({ label: "Piecewise, hold 0.8", choice: { id: "piecewise", params: { scale: 1, length: 0.8 } } });
for (const { label, choice } of schedules) {
  const cost = costOf(choice), ext = M.extremes(cost);
  const P = M.program(cost, HOR), Plo = M.program(() => ext.lo, HOR), Phi = M.program(() => ext.hi, HOR);
  const up = M.flatOnGrid(ext.lo), dn = M.flatOnGrid(ext.hi);
  let out = -Infinity, order = -Infinity;
  for (let k = 0; k <= KV; k++) { out = Math.max(out, P.bounds[k] - up, dn - P.bounds[k]); order = Math.max(order, P.bounds[k] - Plo.bounds[k], Phi.bounds[k] - P.bounds[k]); }
  check("band", `${label}: the program's bound stays within 0.001 of the band [B(c_max), B(c_min)] moved in, over the window`, out < 0.001, `largest step outside ${Math.max(0, out).toFixed(4)}`);
  check("program", `${label}: on the grid, part (b) holds exactly: the bound lies between the program's flat bounds for c_max and c_min`, order <= 1e-12, `largest violation ${order.toExponential(1)}`);
  check("cap", `${label}: the program's flat bound for c_min is within 0.001 of B(c_min) moved in by 0.5826√0.01`, Math.abs(Plo.bounds[0] - up) < 0.001, `${Plo.bounds[0].toFixed(4)} vs ${up.toFixed(4)}`);
}

// ---- Lemma 1(b) at time 0, under one cost and its two constants ------------------------------------------------------
{
  const e = M.extremes(FIG);
  const lo = M.program(() => e.lo, HOR, { keep: [0] }), hi = M.program(() => e.hi, HOR, { keep: [0] });
  let bad = 0;
  for (let i = 0; i <= PF.m; i++) { const y = i * PF.h, a = M.valueAt(lo, 0, y), b = M.valueAt(PF, 0, y), c = M.valueAt(hi, 0, y); if (a < b - 1e-7 || b < c - 1e-7) bad++; }
  check("compare", "at time 0, V for c_min ≥ V for Figure 1(a) ≥ V for c_max at every grid point", bad === 0, `${bad} violations of ${PF.m + 1}`);
  check("compare", "and the bounds at time 0 come in the same order", lo.bounds[0] >= PF.bounds[0] && PF.bounds[0] >= hi.bounds[0], `${lo.bounds[0].toFixed(3)} ≥ ${PF.bounds[0].toFixed(3)} ≥ ${hi.bounds[0].toFixed(3)}`);
  const R = K.rng(2026 + 6), d = M.decisions(PF, 0, 0, 1, R, { keepPaths: 1 }).paths[0];
  const paid = [e.lo * d.tau, M.integral(FIG, 0, d.tau), e.hi * d.tau];
  check("compare", "the plate's path is charged in order under c_min, Figure 1(a)'s cost, and c_max", paid[0] <= paid[1] && paid[1] <= paid[2], paid.map((v) => v.toFixed(4)).join(" ≤ "));
}

// ---- Lemma 1(d) on a hard step -----------------------------------------------------------------------------------
{
  const step = M.costFrom({ kind: "step", lo: 0.1, hi: 1.6, at: 0.5 });
  const P = M.program(step, HOR, { keep: Array.from({ length: KV + 1 }, (_, k) => k) });
  let worst = 0, at = 0, ex = 0;
  for (const y of [0, 0.3, 0.6, 1]) {
    for (let k = 0; k < KV; k++) { const s = Math.abs(M.valueAt(P, k + 1, y) - M.valueAt(P, k, y)) / M.DT; if (s > worst) { worst = s; at = k * M.DT; } }
    ex = Math.max(ex, Math.abs(M.valueAt(P, 45, y) - M.valueAt(P, 40, y)));
  }
  check("later", "on a hard step from 0.1 to 1.6, the program's value moves by at most 1.5 per unit of start time", worst <= 1.5 + 2e-4, `steepest ${worst.toFixed(5)} at time ${at.toFixed(2)}`);
  check("later", "and reaches that rate just before the jump, from evidence 0 (the text says so)", Math.abs(worst - 1.5) < 1e-3 && Math.abs(at - 0.49) < 1e-9, `${worst.toFixed(5)} at ${at.toFixed(2)}`);
  check("later", "the exercise: |V(0.45, y) − V(0.4, y)| ≤ 0.075 at y = 0, 0.3, 0.6, 1", ex <= 0.075, `largest ${ex.toFixed(4)}`);
  let id = 0;
  for (const [t, D, tau] of [[0.4, 0.05, 0.5], [0.1, 0.25, 0.3], [0.45, 0.1, 1], [0.7, 0.05, 0.3]]) {
    const I = (a, b) => M.stepIntegral(0.1, 1.6, 0.5, a, b);
    id = Math.max(id, Math.abs((I(t + D, t + D + tau) - I(t, t + tau)) - (I(t + tau, t + D + tau) - I(t, t + D))));
    id = Math.max(id, Math.abs(I(t, t + tau) - M.integral(step, t, t + tau)));
  }
  check("later", "the plate's cost difference equals the difference of its two ends, and the exact integrals match the midpoint rule", id < 1e-3, `largest gap ${id.toExponential(1)}`);
  check("later", "at t = 0.4, Δ = 0.05, τ = 0.5 the ends differ by exactly the cap, 0.075", Math.abs((M.stepIntegral(0.1, 1.6, 0.5, 0.9, 0.95) - M.stepIntegral(0.1, 1.6, 0.5, 0.4, 0.45)) - 0.075) < 1e-12, "1.6 × 0.05 − 0.1 × 0.05");
}

// ---- decisions sampled against the bound --------------------------------------------------------------------------
{
  const P = M.program(() => 0.1, HOR);
  const d = M.decisions(P, 0, 0, 20000, K.rng(7));
  const tau = Array.from(d.tau), m = meanOf(tau), se = seOf(tau), bt = K.meanDecisionTime(0.1);
  check("decide", "at a constant 0.1, 20,000 sampled decisions from 0 take b tanh b on average (3 standard errors, plus 0.03 for the monitoring shift's next term)", Math.abs(m - bt) < 3 * se + 0.03, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${bt.toFixed(4)}`);
  const atOnce = M.decisions(PF, 100, PF.bounds[100] + 0.01, 200, K.rng(3));
  check("decide", "a start above the bound stops at once on every path", atOnce.tau.every((v) => v === 0), `${atOnce.tau.filter((v) => v === 0).length} of 200`);
  const a = M.decisions(PF, 20, 0, 300, K.rng(2026), { keepPaths: 16 }), b = M.decisions(PF, 20, 0, 300, K.rng(2026));
  check("decide", "the same seed gives the same decisions", a.tau.every((v, i) => v === b.tau[i]), "300 of 300 equal");
  let early = 0;
  for (const p of a.paths) {
    p.pts.forEach((q, i) => { const k = 20 + Math.round(q[0] / M.DT), hit = q[1] >= PF.bounds[k]; if ((i < p.pts.length - 1 && hit) || (i === p.pts.length - 1 && !hit)) early++; });
  }
  check("decide", "each kept path stays below the bound until its last check, where it is at or above it", early === 0, `${early} violations on 16 paths`);
}

// ---- the cap and the martingale (Figure 1(a), from 0 at time 0, as the plate) -----------------------------------------
{
  const e = M.extremes(FIG), capP = M.program(() => e.lo, HOR);
  const d = M.decisions(PF, 0, 0, 1500, K.rng(2026 + 3), { cap: capP.bounds, track: 300, cost: FIG, keepPaths: 8 });
  const tau = Array.from(d.tau), sig = Array.from(d.sigma);
  check("cap", "τ* ≤ σ on all 1,500 paths: the bound never rises above the cap", tau.every((v, i) => v <= sig[i] + 1e-12), `${tau.filter((v, i) => v <= sig[i]).length} of 1500`);
  const bb = K.B(e.lo), exact = bb * Math.tanh(bb), ms = meanOf(sig), se = seOf(sig);
  check("cap", "the sampled σ averages b̄ tanh b̄ (3 standard errors, plus 0.03 for the monitoring shift's next term)", Math.abs(ms - exact) < 3 * se + 0.03, `${ms.toFixed(4)} ± ${se.toFixed(4)} vs ${exact.toFixed(4)}`);
  const V0 = M.valueAt(PF, 0, 0);
  let worst = 0;
  for (const k of [50, 100, 200, 300]) worst = Math.max(worst, Math.abs(d.meanM[k] - V0) / (3 * d.seM[k] + 0.002));
  check("cap", "the value process stopped at τ* keeps its mean, V(0, 0), at s = 0.5, 1, 2, 3 (3 standard errors plus 0.002 for the grid)", worst < 1, `V(0, 0) = ${V0.toFixed(4)}; means ${[50, 100, 200, 300].map((k) => d.meanM[k].toFixed(4)).join(", ")}`);
  check("cap", "and the gain stopped at τ* reaches the same mean: τ* is optimal on the grid", Math.abs(d.meanG[300] - V0) < 3 * d.seG[300] + 0.002 && d.meanG[0] === 0.5, `mean gain ${d.meanG[0].toFixed(3)} at 0, ${d.meanG[300].toFixed(4)} at 3`);
  let over = 0;
  for (const p of d.paths) for (const q of p.gain) if (q[2] > 1 - e.lo * q[0] + 1e-12) over++;
  check("cap", "the unstopped gain stays under 1 − c_min s on the eight kept paths", over === 0, `${over} violations`);
}

// ---- the sentences ------------------------------------------------------------------------------------------------
{
  const R = K.rng(11), r = () => R.next();
  let bad = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const out = [
      S.heroLabel("Cost jumps", 0.01 + r(), 1 + r() * 5),
      S.couplingSay(i % 2, r() * 2, r(), i % 3 ? r() * 2.5 : NaN, 2.5),
      S.waitSay([{ t: 0, b: r() }, { t: 1, b: r() }]),
      S.raySay(r() * 2.5, r() * 2),
      S.extremesNote("Smooth", 0.01 + r(), r() * 60, 0.5 + r(), r() * 60, 2.5),
      S.outsideNote(["deadline", "rising", "constant"][i % 3]),
      S.bandSay({ dn: r(), up: 1 + r(), gapDn: r() * 0.01 - 0.0005, atDn: r() * 2.5, gapUp: r(), atUp: r() * 2.5, below: r(), above: r() }),
      S.noBandSay(r(), 1 + r()),
      S.sketchVerdict(i % 4 !== 0, r() * 0.5, r(), i % 2 === 0),
      S.compareSay(i % 4, { tau: r(), paid: [r(), r(), r()], v: [r(), r(), r()], b: [r(), r(), r()], min: r(), max: r(), dn: r(), up: r() }),
      S.laterSay(i % 4, { t: r(), D: 0.05, tau: 0.5, A: r(), B: r(), e1: r(), e2: r(), lo: 0.1, hi: 1.6, dv: r() * 0.1, slope: r() * 1.5, at: r() * 2.5 }),
      S.decideSay({ n: 2000, t0: r() * 2, y0: r() * 2, median: r(), mean: r(), se: r() * 0.01, ec: 0.01 + r(), c0: 0.01 + r(), atOnce: i % 7 ? 0 : 1 }),
      S.decideVerdict(i % 5 ? r() * 3 : NaN, r() * 3),
      S.capSay(i % 4, { lo: 0.1, T: 3, maxG: r(), ok: 1500, n: 1500, mTau: r(), mSig: 1 + r(), seSig: r() * 0.02, exact: 1.17, hi: 1.6, V0: 0.7, drift: r() * 0.01, seEnd: r() * 0.01, G0: 0.5, Gend: 0.7 }),
    ];
    for (const s of out) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  check("words", "a gap below the grid's resolution reads “less than 0.001”, and a larger one prints its value", /less than 0\.001/.test(S.bandSay({ dn: 0.1, up: 1.3, gapDn: -0.0003, atDn: 2, gapUp: 0.35, atUp: 0, below: 0.4, above: 0 })) && /0\.350/.test(S.bandSay({ dn: 0.1, up: 1.3, gapDn: 0.0003, atDn: 2, gapUp: 0.35, atUp: 0, below: 0.4, above: 0 })), "checked");
  check("words", "a guess after the median reads late, and one before it early", /late/.test(S.decideVerdict(1.2, 0.8)) && /early/.test(S.decideVerdict(0.5, 0.8)) && /within 0.05/.test(S.decideVerdict(0.82, 0.8)), "checked");
  check("words", "the hero names the flat bounds for the highest and the lowest cost", S.heroLabel("Cost jumps", 0.1, 1.6) === "Cost jumps: the bound stays between B(1.6) and B(0.1)", S.heroLabel("Cost jumps", 0.1, 1.6));
}
