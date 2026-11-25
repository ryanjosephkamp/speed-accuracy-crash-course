// Chapter 11: the information clock, the constant-kappa bound, the u-kernel, the three rules and the program over
// beliefs (held to the paper's code at the tag through tools/validity/ch11.json), Table 10 as the page prints it,
// Appendix B's bounds and each bound's flux, the program with two bounds, and the sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as K from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch11-model.js";
import * as S from "../../book/assets/js/say-ch11.js";
import { PRESETS, costOf, deadlineOf, defaultDrawing, VIEW } from "../../book/assets/js/schedules-book.js";
import { check, N, table, ROOT } from "./lib.mjs";

const V = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch11.json"), "utf8"));
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const maxOf = (arr) => arr.reduce((m, v) => Math.max(m, v), -Infinity);
const BAD = /NaN|undefined|Infinity|null/;
const sentences = [];   // every sentence a check below builds from a real computation, tested for NaN at the end
const say = (s) => { sentences.push(s); return s; };
const choices = () => [
  ...PRESETS.map((p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) })),
  { id: "deadline", params: { at: 0.75, c: 0.3 } },                 // a deadline that isn't on a 0.02 step
  { id: "constant", params: { c: 1 } }, { id: "constant", params: { c: 0.01 } },
  { id: "smooth", params: { c0: 0.1, size: 0 } },                   // Smooth at size 0: a constant
  { id: "draw", points: defaultDrawing() }, { id: "draw", points: defaultDrawing().map(() => 0.2) },   // a flat drawing
];
const label = (c) => `${c.id}${c.params ? " " + JSON.stringify(c.params) : ""}`;

// ---- the information clock ---------------------------------------------------------------------------------
{
  let worst = 0;
  for (const a of [0.5, 1, 2]) for (const t of [0, 0.3, 2.5, 10]) worst = Math.max(worst, Math.abs(M.tOf(M.thetaOf(t, a), a) - t));
  check("clock", "t -> theta -> t returns t (a = 0.5, 1, 2; t up to 10)", worst < 1e-12, `largest error ${worst.toExponential(1)}`);
  let w2 = 0;
  for (const c of [0.02, 0.1, 0.4]) for (const th of [0, 0.7, 2.4]) w2 = Math.max(w2, rel(M.kappaOf(c, M.tOf(th, 1), 1), c * Math.exp(th)));
  check("clock", "a constant cost c is kappa = c a e^theta on the information clock", w2 < 1e-12, `largest relative error ${w2.toExponential(1)}`);
  // the clock plate's sentence on every schedule it can be given, as the plate computes it
  let ok = true, detail = "";
  for (const ch of choices()) {
    const cost = costOf(ch), dl = deadlineOf(ch), I = M.clockInfo(cost, dl, 1, 10);
    const s = say(S.clockVerdict(["flat", "falls", "rises", null][ch.id.length % 4], I));
    const fell = I.kMin < I.k0 * (1 - 1e-6) && I.tMin > 0 && I.tMin < I.tEnd;
    const right = /rises without bound/.test(s) && (fell === /after falling/.test(s)) && (dl === null) !== /deadline/.test(s)
      && (I.kEnd >= I.k0) === / times its start/.test(s) && Number.isFinite(I.kEnd);
    if (!right) { ok = false; detail = `${label(ch)}: ${s}`; }
  }
  check("clock", "the clock sentence states the rise, a fall on the way, the deadline, and the growth exactly when the computed kappa shows them, on every preset, a deadline off the grid, Smooth at size 0, and a flat drawing", ok, detail || `${choices().length} schedules`);
  const I = M.clockInfo(() => 0.1, null, 1, 10);
  check("clock", "a constant cost of 0.1 has kappa from 0.1 at t = 0 to 1.1 at t = 10, 11 times its start", Math.abs(I.k0 - 0.1) < 1e-12 && Math.abs(I.kEnd - 1.1) < 1e-12, `${I.k0}, ${I.kEnd}`);
}

// ---- the constant-kappa bound and the normal law -------------------------------------------------------------
{
  const f = V.frozen;
  const r1 = maxOf(f.kappa.map((k, i) => rel(M.frozenBound(k), f.root[i])));
  const r2 = maxOf(f.kappa.map((k, i) => rel(M.frozenBounds(k), f.table[i])));
  check("info", "U(kappa) against info_time.frozen_bound at the tag (relative 1e-10)", r1 < 1e-10, `${f.kappa.length} costs, largest ${r1.toExponential(1)}`);
  check("info", "the page's table of U against info_time.frozen_bounds at the tag (relative 1e-9)", r2 < 1e-9, `largest ${r2.toExponential(1)}`);
  // U solves its equation, with the integral by Simpson's rule as an independent check of the series
  let worst = 0;
  for (const k of [1e-3, 0.05, 0.1, 1, 20]) {
    const U = M.frozenBound(k), n = 2000; let s = 0;
    for (let i = 0; i <= n; i++) { const v = (U * i) / n, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; s += w * Math.exp(v * v / 2); }
    s *= U / (3 * n);
    worst = Math.max(worst, Math.abs(s * 2 * Math.sqrt(2 * Math.PI) * k - 1));
  }
  check("info", "U(kappa) solves int_0^U e^{v^2/2} dv = 1/(2 sqrt(2 pi) kappa), the integral by Simpson's rule on 2,000 intervals (within 1e-9)", worst < 1e-9, `largest residual ${worst.toExponential(1)}`);
  let dec = true; for (let k = 1e-3; k < 100; k *= 1.3) if (!(M.frozenBound(k * 1.3) < M.frozenBound(k))) dec = false;
  check("info", "U(kappa) falls as kappa rises (kappa from 1e-3 to 100)", dec, "");
  // the step-5 plate: kappa times the speed density, by the trapezoid rule on 400 intervals, against 1/sqrt(2 pi)
  const U = M.frozenBound(0.1); let A = 0;
  for (let i = 0; i <= 400; i++) { const u = (U * i) / 400; A += (i === 0 || i === 400 ? 0.5 : 1) * 0.2 * Math.exp(u * u / 2); }
  A *= U / 400;
  check("info", "the speed-measure area at kappa = 0.1, by the trapezoid rule on 400 intervals, is 1/sqrt(2 pi) within 1e-5", Math.abs(A - 1 / Math.sqrt(2 * Math.PI)) < 1e-5, `${A.toFixed(7)} vs ${(1 / Math.sqrt(2 * Math.PI)).toFixed(7)}`);
  let e = 0; for (let p = 0.001; p < 1; p += 0.001) e = Math.max(e, Math.abs(M.normCdf(M.normPpf(p)) - p));
  check("info", "the page's inverse normal: Phi(Phi^-1(p)) = p for p = 0.001, ..., 0.999 (within 1e-13)", e < 1e-13, `largest error ${e.toExponential(1)}`);
}

// ---- the u-kernel ----------------------------------------------------------------------------------------
{
  let worst = 0;
  for (const k of V.kernelU.u) {
    const P = M.kernelU(k.U);
    worst = Math.max(worst, rel(M.kernelMean(P), k.mean), rel(P.s[120], k.s120), ...Object.entries(k.bins).map(([i, w]) => rel(P.w[+i], w)));
  }
  check("kernelu", "the u-kernel (240 nodes, 240 bins) against info_time._kernel_u at the tag, at four bounds: means, bins, and bin times (relative 1e-8)", worst < 1e-8, `largest ${worst.toExponential(1)}`);
  const T = M.survivalKernel(Math.tanh, 1, 400), t = V.kernelU.tanh;
  check("kernelu", "the finite-difference kernel for the drift tanh x at a bound of 1 against the paper's code (relative 1e-8)", rel(M.kernelMean(T), t.mean) < 1e-8 && rel(T.w[100], t.w100) < 1e-8, `${M.kernelMean(T).toFixed(6)} vs ${t.mean.toFixed(6)}`);
  const c = 1 / (Math.sinh(2) + 2), m6 = K.meanLookAhead(c);
  check("kernelu", "for the drift tanh x, the finite-difference kernel's mean is within 2% of chapter 6's mean look-ahead at the cost whose bound is 1 (the paper's test)", rel(M.kernelMean(T), m6) < 0.02, `${M.kernelMean(T).toFixed(4)} vs ${m6.toFixed(4)}`);
  const { w } = M.kernelU(1.39); const tot = w.reduce((x, y) => x + y, 0);
  check("kernelu", "the u-kernel's bins sum to 1", Math.abs(tot - 1) < 1e-12, tot.toFixed(14));
}

// ---- the rules and the program over beliefs, against the paper's code ----------------------------------------------
const T10 = M.TABLE10_CHOICES;
{
  let wf = 0, ww = 0, wp = 0, wx = 0;
  V.rules.forEach((r, k) => {
    const cost = costOf(T10[k]), dl = deadlineOf(T10[k]);
    const fr = M.frozenTime(cost, r.t), wb = M.weightedTime(cost, r.t), pl = M.plugIn(cost, r.t);
    r.t.forEach((_, i) => { wf = Math.max(wf, Math.abs(fr[i] - r.frozen[i])); ww = Math.max(ww, Math.abs(wb[i] - r.weighted[i])); wp = Math.max(wp, Math.abs(pl[i] - r.plug[i])); });
    const P = M.unknownProgram(cost, dl ?? 10, { n: 300, dt: 0.005 });
    r.t.forEach((t, i) => { wx = Math.max(wx, Math.abs(P.x[Math.round(t / 0.005)] - r.program[i])); });
  });
  check("rules", "the frozen-time rule on Table 10's eight schedules against info_time.frozen_time at the tag (within 1e-9)", wf < 1e-9, `largest ${wf.toExponential(1)}`);
  check("rules", "the weighted rule in information time against info_time.weighted_bound at the tag (within 1e-8)", ww < 1e-8, `largest ${ww.toExponential(1)}`);
  check("rules", "the plug-in rule against the experiment's plug_in at the tag (within 1e-9)", wp < 1e-9, `largest ${wp.toExponential(1)}`);
  check("program", "the page's program over 300 beliefs, steps of 0.005, against unknown.backward_induction at the tag, on the eight schedules (evidence bound within 1e-6)", wx < 1e-6, `largest ${wx.toExponential(1)}`);
}
{
  // the paper's stored curves (every 0.1, rounded to 4 decimals, the rules moved in for checking every 0.005)
  let worst = 0, at = "";
  V.curves.forEach((cv, k) => {
    const cost = costOf(T10[k]);
    const fr = M.shifted(M.frozenTime(cost, cv.t), 0.005), wb = M.shifted(M.weightedTime(cost, cv.t), 0.005), pl = M.shifted(M.plugIn(cost, cv.t), 0.005);
    cv.t.forEach((_, i) => {
      for (const [mine, theirs] of [[fr[i], cv.frozen_time[i]], [wb[i], cv.weighted[i]], [pl[i], cv.plug_in[i]]]) {
        const d = Math.abs(Math.min(mine, 10) - theirs); if (d > worst) { worst = d; at = cv.name; }
      }
    });
  });
  check("rules", "the three rules, moved in by 0.5826 sqrt(0.005), reproduce the curves stored in the paper's results at the tag, every 0.1 time units on all eight schedules (to their 4-decimal rounding)", worst <= 5e-5 + 1e-9, `largest ${worst.toExponential(2)} (${at})`);
}
{
  // the plate's own runs: what its words and the chapter's text say about them
  let frozenAbove = true, wBelow = true, fa = "", wbd = "", ok = true, det = "";
  T10.forEach((ch, k) => {
    const cost = costOf(ch), dl = deadlineOf(ch), run = M.unknownRun(cost, dl, dl ?? VIEW);
    const idx = run.t.map((t, i) => i).filter((i) => dl === null || run.t[i] < dl - 1e-9);
    if (!(run.frozen[0] > run.exact[0])) { frozenAbove = false; fa = M.TABLE10[k][0]; }
    if (ch.id === "constant" && !idx.every((i) => run.weighted[i] < run.frozen[i])) { wBelow = false; wbd = M.TABLE10[k][0]; }
    const st = M.rulesStats(run, dl), s = say(S.rulesSay({ ...st, losses: M.TABLE10[k].slice(1) }));
    if (!s.includes(M.TABLE10[k][2])) { ok = false; det = s; }
  });
  check("rules", "on all eight schedules, the frozen-time bound starts above the program's at t = 0 (the chapter says so)", frozenAbove, fa || "all eight");
  check("rules", "on the five constant costs, the weighted bound sits below the frozen-time bound over the window (an exercise says why)", wBelow, wbd || "all five");
  check("words", "the rules sentence quotes Table 10's losses for the schedule shown", ok, det || "eight schedules");
  // even at a constant cost the program's bound moves over the window, and the plug-in stops at once wherever 4c(t + a) >= 1
  // the belief bound u = Phi^-1(g), not only the evidence bound (which moves with sqrt(t + a) even at a fixed u)
  let falls = Infinity;
  for (const k of [0, 1, 2, 3, 4]) {
    const P = M.unknownProgram(costOf(T10[k]), 10, { n: 300, dt: 0.005 }), u = (k_) => M.normPpf(Math.min(Math.max(P.g[k_], 0.5), 1 - 1e-12));
    falls = Math.min(falls, u(0) - u(Math.round(VIEW / 0.005)));
  }
  check("rules", "on all five constant costs, the program's belief bound u = Phi^-1(g) falls by more than 0.05 from t = 0 to 2.5, as a rising cost per unit of information makes it (the chapter's cause); at a constant kappa it would be U(kappa) throughout", falls > 0.05, `smallest fall ${falls.toFixed(3)}`);
  // the unshifted plug-in bound: 0 exactly where 4c(t + a) >= 1 (its bisection brackets the root from 1e-6, so a root
  // closer to 0 than that, within a hair of the switch, also reads as 0)
  let agree = true, at = "", nRaw = 0;
  for (const c of [0.05, 0.1, 0.2, 0.3, 0.4, 1]) for (let t = 0; t <= 3; t += 0.01) {
    const q = 4 * c * (t + 1); if (Math.abs(q - 1) < 1e-3) continue;
    nRaw++;
    if ((M.plugInAt(c, t) === 0) !== (q >= 1)) { agree = false; at = `c ${c}, t ${t.toFixed(2)}`; }
  }
  check("rules", "the unshifted plug-in bound is 0 exactly where 4 c (t + a) >= 1, with a = 1, at every time from 0 to 3 in steps of 0.01 farther than 0.001 from that switch: the known-reliability rule for a small estimated drift doesn't wait", agree, at || `${nRaw} times at costs 0.05 to 1`);
  // the plotted plug-in bound is moved in by delta = 0.5826 sqrt(0.005) and clipped at 0, so it is 0 wherever the
  // unshifted bound is at most delta: a little before the switch above. The plate's stretches are held to that, at every
  // time drawn on each schedule (none skipped), and the sentence to each stretch's rendered endpoints
  const delta = 0.5826 * Math.sqrt(0.005);
  const runsOf = (zero, ts) => { const out = []; let from = null; ts.forEach((t, i) => { if (zero[i] && from === null) from = t; if (!zero[i] && from !== null) { out.push([from, ts[i - 1]]); from = null; } }); if (from !== null) out.push([from, null]); return out; };
  const T2 = (t) => (Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : t.toFixed(2).replace(/0$/, ""));
  const phrase = ([a, b], last) => (a <= 1e-9 && b === null ? "at all of them" : a <= 1e-9 ? `from the start to t = ${T2(b)}` : b === null ? `from t = ${T2(a)} to the last time drawn, ${T2(last)}` : a === b ? `at t = ${T2(a)}` : `from t = ${T2(a)} to t = ${T2(b)}`);
  let zok = true, zdet = "", seen = 0, nTimes = 0;
  const zcases = [...T10, { id: "fall", params: { at: 2, factor: 16 } }, { id: "jump", params: { at: 1, factor: 16 } }, { id: "pulse", params: { at: 0.8, factor: 8 } }, { id: "deadline", params: { at: 0.75, c: 0.3 } },
    { id: "draw", points: defaultDrawing().map((c, i) => (i > 8 && i < 15 ? 0.6 : 0.1)) }, { id: "draw", points: Array(26).fill(0.2499999) }];
  for (const ch of zcases) {
    const cost = costOf(ch), dl = deadlineOf(ch), run = M.unknownRun(cost, dl, dl ?? VIEW), st = M.rulesStats(run, dl);
    const idx = M.shownBefore(run.t, dl), shown = idx.map((i) => run.t[i]);
    nTimes += shown.length;
    const want = runsOf(shown.map((t) => M.plugInAt(cost(t), t) <= delta), shown), sent = say(S.rulesSay({ ...st, losses: null }));
    if (st.plugZero.length) seen++;
    if (!idx.every((i, k) => (run.plug[i] === 0) === (M.plugInAt(cost(shown[k]), shown[k]) <= delta))) { zok = false; zdet = `${label(ch)}: a drawn time where the plotted bound is 0 but the unshifted one is above delta, or the reverse`; }
    if (JSON.stringify(want) !== JSON.stringify(st.plugZero)) { zok = false; zdet = `${label(ch)}: run ${JSON.stringify(st.plugZero)}, threshold ${JSON.stringify(want)}`; }
    const named = want.slice(0, 3).every((r) => sent.includes(phrase(r, st.lastShown))) && (want.length > 3) === / more stretches/.test(sent);
    if ((want.length > 0) !== /plug-in bound is 0/.test(sent) || !named) { zok = false; zdet = `${label(ch)}: ${sent}`; }
    if (dl !== null && !(shown[shown.length - 1] < dl)) { zok = false; zdet = `${label(ch)}: a time at the deadline is drawn`; }
  }
  check("rules", `on ${zcases.length} schedules (Table 10's eight, a fall at time 2 by 16, a late jump, a pulse, a deadline at 0.75, a drawing that rises in the middle, and a flat drawing at 0.2499999), at every time drawn the plotted plug-in bound is 0 exactly where the unshifted one is at most 0.5826 sqrt(0.005); the plate's stretches are those times, the sentence names each stretch's endpoints as drawn, and no time at a deadline is drawn`,
    zok && seen >= 4, zdet || `${nTimes} times on ${zcases.length} schedules, ${seen} with zero stretches`);
  {
    // where the two criteria part: a flat cost just under 1/4 has 4c(0 + a) < 1, so the unshifted bound is positive at
    // t = 0, but it is below delta, and the plotted bound is 0 from the start
    const cost = costOf({ id: "draw", points: Array(26).fill(0.2499999) }), raw0 = M.plugInAt(cost(0), 0), run = M.unknownRun(cost, null, VIEW);
    check("rules", "a flat drawing at 0.2499999: at t = 0 the unshifted plug-in bound is positive (4c(t + a) < 1) and below 0.5826 sqrt(0.005), and the plotted bound there is 0", raw0 > 0 && raw0 < delta && run.plug[0] === 0 && 4 * cost(0) < 1,
      `unshifted ${raw0.toFixed(5)}, delta ${delta.toFixed(5)}, plotted ${run.plug[0]}`);
  }
  // kappa0 / (t + a) is constant on the information clock: the weighted rule is the frozen-time rule there
  const flat = (t) => 0.1 / (t + 1), ts = [0, 0.4, 1.3, 2.5];
  const d = maxOf(ts.map((t, i) => Math.abs(M.weightedTime(flat, ts)[i] - M.frozenTime(flat, ts)[i])));
  check("rules", "for c(t) = 0.1/(t + 1), constant on the information clock, the weighted rule equals the frozen-time rule (within 1e-9; an exercise)", d < 1e-9, `largest difference ${d.toExponential(1)}`);
  // edge cases of the plate's schedule picker: the run finishes and every number is finite
  let fin = true, bad = "";
  for (const ch of [{ id: "deadline", params: { at: 0.75, c: 0.3 } }, { id: "smooth", params: { c0: 0.1, size: 0 } }, { id: "draw", points: defaultDrawing() }, { id: "jump", params: { at: 0.5, factor: 16 } }]) {
    const cost = costOf(ch), dl = deadlineOf(ch), run = M.unknownRun(cost, dl, dl ?? VIEW);
    const all = [...run.exact, ...run.frozen, ...run.weighted, ...run.plug];
    const endsAtDeadline = dl === null || Math.abs(run.t[run.t.length - 1] - dl) < 1e-9;
    if (!all.every(Number.isFinite) || !endsAtDeadline) { fin = false; bad = label(ch); }
    say(S.rulesSay({ ...M.rulesStats(run, dl), losses: null }));
  }
  check("rules", "the plate's run on a deadline off the 0.02 grid (0.75), Smooth at size 0, the default drawing, and the jump: every bound finite, and a deadline's run ends on the deadline", fin, bad || "four schedules");
}

// ---- Table 10, as the page prints it ---------------------------------------------------------------------------
{
  const T = table("tab_unknown");
  const same = T.length === M.TABLE10.length && T.every((r, i) => r.length === M.TABLE10[i].length && r.every((c, j) => c === M.TABLE10[i][j]));
  check("table", "the plate's Table 10 equals paper/generated/tab_unknown.tex, cell by cell", same, `${T.length} rows`);
  const col = (j) => T.map((r) => +r[j]);
  check("table", "UnknownWeightedMax and UnknownFrozenMax are the largest weighted and frozen-time losses in the table", (+N.UnknownWeightedMax).toFixed(3) === maxOf(col(2)).toFixed(3) && (+N.UnknownFrozenMax).toFixed(2) === maxOf(col(1)).toFixed(2), `${N.UnknownWeightedMax}, ${N.UnknownFrozenMax}`);
  check("table", "at constant costs of 0.02 and 0.05 the tuned constant loses no more than the weighted rule (the text says it does as well or slightly better)", +T[0][4] <= +T[0][2] && +T[1][4] <= +T[1][2], `${T[0][4]} vs ${T[0][2]}, ${T[1][4]} vs ${T[1][2]}`);
  const L = table("tab_lopsided");
  check("table", "LopsidedPerMomentMax and LopsidedWeightedMax are the largest per-moment and weighted losses in tab_lopsided.tex (which the paper doesn't print)", (+N.LopsidedPerMomentMax).toFixed(2) === maxOf(L.map((r) => +r[3])).toFixed(2) && (+N.LopsidedWeightedMax).toFixed(3) === maxOf(L.map((r) => +r[4])).toFixed(3), `${N.LopsidedPerMomentMax}, ${N.LopsidedWeightedMax}`);
  check("table", "the cells the text quotes from tab_lopsided.tex are the rows it names (r- = 0.5, step; r- = 0.25, deadline)", L[1][0] === "0.5" && L[1][1] === "Step" && L[5][0] === "0.25" && L[5][1] === "Deadline", `${L[1].slice(0, 2)} and ${L[5].slice(0, 2)}`);
}

// ---- Appendix B's bounds --------------------------------------------------------------------------------------
{
  let wb = 0, wt = 0;
  for (const b of V.lopsided.bounds) {
    const cb = M.constantBounds(b.c, 1, b.rm), ft = M.fluxTotals(cb.lo, cb.hi);
    wb = Math.max(wb, Math.abs(cb.lo - b.lo), Math.abs(cb.hi - b.hi)); wt = Math.max(wt, Math.abs(ft.hi - b.th), Math.abs(ft.lo - b.tl));
  }
  check("pair", "Appendix B's bounds against lopsided.constant_bounds at the tag, at 16 costs and ratios (within 1e-10)", wb < 1e-10, `largest ${wb.toExponential(1)}`);
  check("flux", "the flux totals against lopsided.flux_totals at the tag (within 1e-10)", wt < 1e-10, `largest ${wt.toExponential(1)}`);
  let sym = 0, com = 0;
  for (const c of [0.02, 0.1, 0.5, 1]) {
    const cb = M.constantBounds(c, 1, 1); sym = Math.max(sym, Math.abs(cb.hi - K.B(c)), Math.abs(cb.lo + K.B(c)), Math.abs(cb.K));
    for (const r of [0.25, 2, 4]) { const cr = M.constantBounds(c, r, r); com = Math.max(com, Math.abs(cr.hi - K.B(c / r)), Math.abs(cr.lo + K.B(c / r))); }
  }
  check("appb", "equal rewards give h = -l = B(c) and K = 0 (within 1e-9)", sym < 1e-9, `largest ${sym.toExponential(1)}`);
  check("appb", "a common reward r gives h = -l = B(c/r), for r = 0.25, 2, 4 (within 1e-9)", com < 1e-9, `largest ${com.toExponential(1)}`);
  // smooth fit and value matching at the solution, and smooth fit read off the value by differences
  let res = 0, fit = 0;
  for (const rm of [1, 0.5, 0.25, 0.05]) for (const c of [0.02, 0.1, 1]) {
    const cb = M.constantBounds(c, 1, rm);
    res = Math.max(res, Math.abs(c * M.Sfun(cb.hi) + cb.K - 0.5), Math.abs(c * M.Sfun(cb.lo) + cb.K + 0.5 * rm), Math.abs(M.matching(cb.hi, c, 1, rm).resid));
    const h = 1e-6, dv = (x) => (M.valueAt(x + h, c, 1, rm, cb) - M.valueAt(x - h, c, 1, rm, cb)) / (2 * h);
    const dg = (x) => (M.stopReward(x + h, 1, rm) - M.stopReward(x - h, 1, rm)) / (2 * h);
    fit = Math.max(fit, Math.abs(dv(cb.hi - 1e-4) - dg(cb.hi + 1e-4)), Math.abs(dv(cb.lo + 1e-4) - dg(cb.lo - 1e-4)));
  }
  check("appb", "the bounds satisfy both smooth-fit equations and value matching (within 1e-10)", res < 1e-10, `largest ${res.toExponential(1)}`);
  check("appb", "the value's slope meets the stopping reward's at both bounds, by differences (within 1e-3)", fit < 1e-3, `largest gap ${fit.toExponential(1)}`);
  // the residual the step-4 plate draws changes sign once above x*, over the scan it draws
  let once = true;
  for (const rm of [1, 0.5, 0.25]) {
    const xs = M.xStar(1, rm); let n = 0, prev = null;
    for (let i = 0; i <= 2000; i++) { const h = xs + 1e-3 * Math.pow(3000, i / 2000); const r = M.matching(h, 0.1, 1, rm).resid; if (prev !== null && Math.sign(r) !== Math.sign(prev)) n++; prev = r; }
    if (n !== 1) once = false;
  }
  check("appb", "at c = 0.1, value matching's residual changes sign exactly once for h from x* + 0.001 to x* + 3 (ratios 1, 0.5, 0.25; the step's sentence says so)", once, "");
  // the claims of the text and the plate over the plate's whole range of costs and ratios
  let more = true, down = true, beliefs = true, start = true, n = 0, where = "";
  for (let i = 0; i <= 40; i++) for (let j = 0; j < 40; j++) {
    const c = 10 ** (-2 + (2 * i) / 40), q = 10 ** (Math.log10(0.05) * (1 - j / 40)), cb = M.constantBounds(c, 1, q), B = K.B(c);
    const dh = cb.hi - B, dl = cb.lo + B; n++;
    if (!(Math.abs(dh) > Math.abs(dl))) { more = false; where = `c ${c}, ratio ${q}`; }
    if (!(dh < 0 && dl < 0)) { down = false; where = `c ${c}, ratio ${q}`; }
    if (!(1 - M.belief(cb.lo) >= M.belief(cb.hi))) beliefs = false;
    const s = say(S.pairSay({ ratio: q, c, lo: cb.lo, hi: cb.hi, xs: M.xStar(1, q), B, gPlus: M.belief(cb.hi), gMinus: 1 - M.belief(cb.lo) }));
    if ((cb.hi < 0) !== /chooses “\+” at once/.test(s)) start = false;
    if (!(cb.lo < M.xStar(1, q) && M.xStar(1, q) < cb.hi)) start = false;
  }
  check("pair", "on a grid of the plate's costs (0.01 to 1) and its ratios below 1 (0.05 up), the upper bound moves more than the lower from +-B(c), as the text says", more, where || `${n} pairs`);
  let still = 0; for (const c of [0.01, 0.1, 1]) { const cb = M.constantBounds(c, 1, 1); still = Math.max(still, Math.abs(cb.hi - K.B(c)), Math.abs(cb.lo + K.B(c))); }
  check("pair", "at the ratio 1, the plate's endpoint, neither bound moves from +-B(c) (the text says so)", still < 1e-9, `largest move ${still.toExponential(1)}`);
  check("pair", "over the same range, both bounds move down from +-B(c) (the text says the lower moves down too, by less)", down, where || `${n} pairs`);
  check("pair", "over the same range, the belief needed to choose “−” is at least the belief needed to choose “+”", beliefs, "");
  check("words", "the bounds bracket x* and the sentence says the start is past h exactly when h < 0, over the plate's range", start, "");
}

// ---- each bound's flux and kernel ------------------------------------------------------------------------------
{
  let wt = 0;
  for (const t of V.lopsided.transfer) {
    const cb = M.constantBounds(0.1, 1, t.rm), w = M.transfer({ re: t.re, im: t.im }, cb.lo, cb.hi);
    wt = Math.max(wt, Math.hypot(w.hi.re - t.hi[0], w.hi.im - t.hi[1]), Math.hypot(w.lo.re - t.lo[0], w.lo.im - t.lo[1]));
  }
  check("flux", "each bound's transfer function against lopsided.transfer at the tag, at lambda = 0.3, -i, -4i (within 1e-10)", wt < 1e-10, `largest ${wt.toExponential(1)}`);
  let wk = 0;
  for (const k of V.lopsided.kernels) {
    const cb = M.constantBounds(0.1, 1, k.rm), b = M.boundaryKernels(cb.lo, cb.hi).bins();
    let mh = 0, ml = 0; for (let i = 0; i < b.s.length; i++) { mh += b.s[i] * b.hi[i]; ml += b.s[i] * b.lo[i]; }
    wk = Math.max(wk, Math.abs(mh - k.meanHi), Math.abs(ml - k.meanLo), ...Object.entries(k.bins).map(([i, [h, l]]) => Math.max(Math.abs(b.hi[+i] - h), Math.abs(b.lo[+i] - l))));
  }
  check("flux", "each bound's binned kernel (4,000 terms, 240 bins) against lopsided.boundary_kernels at the tag (within 1e-10)", wk < 1e-10, `largest ${wk.toExponential(1)}`);
  const b0 = K.B(0.1), sym = M.transfer({ re: 0.3, im: 0 }, -b0, b0);
  check("flux", "with equal rewards, each bound's transform is Lemma 6(c)'s closed form at lambda = 0.3 (within 1e-10)", Math.abs(sym.hi.re - K.transform(0.3, 0.1)) < 1e-10 && Math.abs(sym.lo.re - K.transform(0.3, 0.1)) < 1e-10, `${sym.hi.re.toFixed(8)} vs ${K.transform(0.3, 0.1).toFixed(8)}`);
  let wtot = 0;
  for (const rm of [1, 0.5, 0.25]) { const cb = M.constantBounds(0.1, 1, rm), bk = M.boundaryKernels(cb.lo, cb.hi), ft = M.fluxTotals(cb.lo, cb.hi); wtot = Math.max(wtot, rel(bk.total("hi"), ft.hi), rel(bk.total("lo"), ft.lo)); }
  check("flux", "the series' total flux at each bound is the closed-form total, up to the 4,000-term truncation (relative 5e-4)", wtot < 5e-4, `largest ${wtot.toExponential(1)}`);
  let wid = 0;
  for (const b of V.lopsided.bounds) { const cb = M.constantBounds(b.c, 1, b.rm), ft = M.fluxTotals(cb.lo, cb.hi); wid = Math.max(wid, rel(-ft.hi / (2 * b.c), b.dhi), rel(ft.lo / (2 * b.c), b.dlo)); }
  check("flux", "dh/dc = -int n_h/(2c) and dl/dc = int n_l/(2c) against the paper's central difference with step 1e-5, at 16 costs and ratios (relative 1e-5, the paper's tolerance)", wid < 1e-5, `largest ${wid.toExponential(1)}`);
  const one = M.constantBounds(0.1, 1, 1), bk = M.boundaryKernels(one.lo, one.hi);
  const dots = Array.from({ length: 14 }, (_, i) => 0.01 * Math.pow(400, i / 13));
  const gap = maxOf(dots.map((s) => Math.abs(bk.flux("hi", s) / bk.total("hi") - K.kernelAt(s, 0.1))));
  check("envelope", "with equal rewards, the upper bound's kernel from the two-bound series lies on chapter 6's kernel from (16) at the plate's dots (within 2e-3, the series' truncation)", gap < 2e-3, `largest gap ${gap.toExponential(1)}`);
  check("envelope", "with equal rewards, -int n/(2 c0) is B'(c0) at c0 = 0.1 (within 1e-9)", Math.abs(-M.fluxTotals(one.lo, one.hi).hi / 0.2 - K.Bprime(0.1)) < 1e-9, `${(-M.fluxTotals(one.lo, one.hi).hi / 0.2).toFixed(6)} vs ${K.Bprime(0.1).toFixed(6)}`);
  // the step-3 plate: the first-order shift's error against Appendix B's bounds falls like dc^2
  let ratio = Infinity, dd = "";
  for (const rm of [1, 0.5, 0.25]) {
    const cb = M.constantBounds(0.1, 1, rm), ft = M.fluxTotals(cb.lo, cb.hi);
    const err = (dc) => { const u = M.constantBounds(0.1 + dc, 1, rm); return Math.abs((u.hi - cb.hi) - (-dc * ft.hi / 0.2)); };
    const r = err(0.02) / err(0.01); ratio = Math.min(ratio, r); dd += `${rm}: ${r.toFixed(2)}  `;
    if (!(r > 3.2 && r < 4.8)) ratio = -1;
  }
  check("envelope", "the first-order shift of the upper bound misses Appendix B's at c0 + dc by an amount that falls about fourfold when dc halves from 0.02 to 0.01 (second order)", ratio > 0, dd);
  let me = 0;
  for (const rm of [1, 0.5, 0.25]) {
    const cb = M.constantBounds(0.1, 1, rm), ft = M.fluxTotals(cb.lo, cb.hi), h = 1e-6;
    me = Math.max(me, Math.abs(M.meanExit(cb.lo, cb.lo, cb.hi)), Math.abs(M.meanExit(cb.hi, cb.lo, cb.hi)),
      Math.abs((M.meanExit(cb.hi, cb.lo, cb.hi) - M.meanExit(cb.hi - h, cb.lo, cb.hi)) / h + ft.hi) / 10, Math.abs((M.meanExit(cb.lo + h, cb.lo, cb.hi) - M.meanExit(cb.lo, cb.lo, cb.hi)) / h - ft.lo) / 10);
    // m'' / 2 + tanh(x) m' = -1 inside
    const x = 0.5 * (cb.lo + cb.hi), q = 1e-4, m = (y) => M.meanExit(y, cb.lo, cb.hi);
    me = Math.max(me, Math.abs((m(x + q) - 2 * m(x) + m(x - q)) / (2 * q * q) + Math.tanh(x) * (m(x + q) - m(x - q)) / (2 * q) + 1) / 100);
  }
  check("envelope", "the mean exit time is 0 at both bounds, its slope is minus the flux total at h0 and plus the flux total at l0, and it solves m''/2 + tanh(x) m' = -1 (by differences)", me < 1e-4, `largest ${me.toExponential(1)}`);
  { const cb = M.constantBounds(0.1, 1, 0.5), ft = M.fluxTotals(cb.lo, cb.hi), s0 = S.envelopeSay(0, { mMax: 1, mAt: 0, th: ft.hi, tl: ft.lo });
    check("words", "the envelope's step-1 sentence prints the upper end's slope with its minus sign and the lower end's with a plus", s0.includes(`−${ft.hi.toFixed(3)} at h₀`) && s0.includes(`+${ft.lo.toFixed(3)} at ℓ₀`), s0); }
  let curv = 0;
  for (const rm of [1, 0.5, 0.25]) {
    const cb = M.constantBounds(0.1, 1, rm), q = 1e-3, x = cb.hi - 2 * q, VG = (y) => M.valueAt(y, 0.1, 1, rm, cb) - M.stopReward(y, 1, rm);
    curv = Math.max(curv, Math.abs((VG(x + q) - 2 * VG(x) + VG(x - q)) / (q * q) - 0.2));
  }
  check("envelope", "(V - G)'' is 2 c0 at the upper bound (by differences just inside it, within 1e-2)", curv < 1e-2, `largest gap ${curv.toExponential(1)}`);
}

// ---- the program with two bounds, and the sinusoid ---------------------------------------------------------------------
{
  const P = V.lopsided.program, mine = M.lopsidedProgram(() => P.c, P.horizon, 1, P.rm, P.dt, P.h, P.cap);
  const d = maxOf(P.t.map((t, i) => Math.max(Math.abs(mine.lo[Math.round(t / P.dt)] - P.lo[i]), Math.abs(mine.hi[Math.round(t / P.dt)] - P.hi[i]))));
  check("sine", "the page's program with two bounds against lopsided.backward_induction at the tag on the page's grid (dt 0.01, h 0.02, cap 5), at a constant cost (within 1e-6)", d < 1e-6, `largest ${d.toExponential(1)}`);
  // the closed-form first order against the paper's stored first-order predictions
  let wa = 0, wp = 0;
  for (const r of V.firstOrder) {
    const cb = M.constantBounds(0.1, 1, r.r_minus), ft = M.fluxTotals(cb.lo, cb.hi), tr = M.transferAt(r.omega, cb.lo, cb.hi);
    for (const [side, slope] of [["hi", -ft.hi / 0.2], ["lo", ft.lo / 0.2]]) {
      const W = tr[side], amp = Math.abs(slope) * W.gain * 0.01, ph = ((((W.lead + (slope < 0 ? 180 : 0)) + 180) % 360) + 360) % 360 - 180;
      wa = Math.max(wa, rel(amp, r[side].first_order[0])); wp = Math.max(wp, Math.abs(((ph - r[side].first_order[1] + 540) % 360) - 180));
    }
  }
  check("sine", "the page's first-order swing and phase for each bound against the predictions stored in the paper's results at the tag, all ten runs (relative 1e-4 and 1e-6 degrees)", wa < 1e-4 && wp < 1e-6, `largest ${wa.toExponential(1)}, ${wp.toExponential(1)} degrees`);
  let wg = 0, wl = 0;
  for (const r of V.firstOrder) for (const side of ["hi", "lo"]) { wg = Math.max(wg, Math.abs(r[side].first_order[0] / r[side].exact[0] - 1)); wl = Math.max(wl, Math.abs(r[side].first_order[1] - r[side].exact[1])); }
  check("sine", "LopsidedWorstGain and LopsidedWorstLead are the worst swing and lead gaps in the paper's results at the tag", (100 * wg).toFixed(1) === N.LopsidedWorstGain && wl.toFixed(1) === N.LopsidedWorstLead, `${(100 * wg).toFixed(1)}%, ${wl.toFixed(1)} vs ${N.LopsidedWorstGain}%, ${N.LopsidedWorstLead}`);
  // the plate's own runs on its grid, against the first order: every ratio and frequency it offers
  let g = 0, l = 0, words = true, at8 = null;
  const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
  for (const rm of [0.5, 0.25]) for (const om of [0.5, 1, 2, 4, 8]) {
    const run = M.sineRun(rm, om), cb = M.constantBounds(0.1, 1, rm), ft = M.fluxTotals(cb.lo, cb.hi), tr = M.transferAt(om, cb.lo, cb.hi);
    const n = { omega: om, rm, hi: {}, lo: {} };
    for (const [side, fit, slope] of [["hi", run.fitH, -ft.hi / 0.2], ["lo", run.fitL, ft.lo / 0.2]]) {
      const gain = fit.amp / Math.abs(slope), lead = wrap(fit.phase - (slope < 0 ? 180 : 0));
      g = Math.max(g, Math.abs(gain / tr[side].gain - 1)); l = Math.max(l, Math.abs(lead - tr[side].lead));
      n[side] = { foGain: tr[side].gain, foLead: tr[side].lead, dpGain: gain, dpLead: lead };
    }
    if (BAD.test(say(S.sineSay(n)))) words = false;
    if (rm === 0.5 && om === 8) at8 = Math.abs(n.hi.dpLead - n.hi.foLead);
  }
  check("sine", "the plate's program (grid 0.02, every 0.01) matches each bound's first-order prediction within 1% on the swing and 1.5 degrees on the lead, at both ratios and all five frequencies", g < 0.01 && l < 1.5, `largest ${(100 * g).toFixed(2)}%, ${l.toFixed(2)} degrees`);
  const fine = M.sineRun(0.5, 8, { dt: 0.005, h: 0.01, every: 4 }), cb = M.constantBounds(0.1, 1, 0.5), tr = M.transferAt(8, cb.lo, cb.hi);
  const lf = Math.abs(wrap(fine.fitH.phase - 180) - tr.hi.lead);
  check("sine", "halving both steps (the evidence grid and the check interval) cuts the upper bound's lead residual from the first order at omega = 8 (r- = 0.5) by a factor between 1.6 and 2.5", at8 / lf > 1.6 && at8 / lf < 2.5, `${at8.toFixed(3)} degrees on (0.01, 0.02), ${lf.toFixed(3)} on (0.005, 0.01)`);
  check("words", "the sinusoid sentences on the plate's ten runs print no NaN, undefined, Infinity, or null", words, "");
}

// ---- edge cases of the model and the plates ---------------------------------------------------------------------------
{
  // each bound's transform is 1 at lambda = 0 (its limit; the ratio there is 0/0)
  let z = 0;
  for (const [lo, hi] of [[-1, 1], [M.constantBounds(0.1, 1, 0.25).lo, M.constantBounds(0.1, 1, 0.25).hi], [-2.3, 0.4]]) {
    const w = M.transfer(0, lo, hi), w1 = M.transfer(1e-7, lo, hi);
    z = Math.max(z, Math.abs(w.hi.re - 1), Math.abs(w.lo.re - 1), Math.abs(w.hi.im), Math.abs(w.lo.im), Math.abs(w1.hi.re - 1) > 1e-5 ? 1 : 0);
  }
  check("flux", "each bound's normalized transform is 1 at lambda = 0 (not 0/0), and next to 1 at lambda = 1e-7", z < 1e-12, `largest gap ${z.toExponential(1)}`);
  // the program over beliefs has no grid point at 1/2. By mirror symmetry its two nearest beliefs have the same
  // deciding-minus-waiting gap, so where both stop it reports a bound of 1/2 (evidence 0). That says nothing about
  // whether waiting at the center itself would pay (with the payoff's kink there, one more step can earn slightly more);
  // 1/2 is what the midpoint grid reports when its first nodes stop
  let sym = 0, half = 0;
  for (const ch of [{ id: "constant", params: { c: 0.4 } }, { id: "deadline", params: { at: 0.75, c: 0.3 } }, { id: "rising", params: { at: 0.5, rate: 0.8 } }]) {
    const P = M.unknownProgram(costOf(ch), deadlineOf(ch) ?? 10, { n: 300, dt: 0.005 });
    sym = Math.max(sym, P.symGap); half += P.g.filter((g) => g === 0.5).length;
  }
  check("program", "in the program over beliefs, deciding minus waiting is the same at the two beliefs next to 1/2 by mirror symmetry (within 1e-12), and the reported bound of 1/2 occurs on these runs where both stop", sym < 1e-12 && half > 1, `largest asymmetry ${sym.toExponential(1)}, ${half} steps at 1/2`);
  {
    // a reported 1/2 is not a center stop: Rising from 0 at rate 2, at t = 1.30 the program reports 1/2, yet from the
    // center itself one step of the same transition (midpoint nodes, weights proportional to exp(u^2/2 - u^2/(2e)) with
    // e = dt/(t + a)), then deciding, earns more than deciding there at once; waiting is worth at least that much
    const cost = costOf({ id: "rising", params: { at: 0, rate: 2 } }), P = M.unknownProgram(cost, 10, { n: 300, dt: 0.005 }), k = Math.round(1.3 / 0.005);
    const n = 300, g = Array.from({ length: n }, (_, i) => (i + 0.5) / n), u = g.map(M.normPpf), e = 0.005 / (P.ts[k] + 1);
    const z = u.map((x) => 0.5 * x * x - (x * x) / (2 * e)), zm = Math.max(...z);
    let num = 0, den = 0;
    for (let j = 0; j < n; j++) { const p = Math.exp(z[j] - zm); num += p * Math.max(g[j], 1 - g[j]); den += p; }
    const stepThenDecide = num / den - cost(P.ts[k]) * 0.005;
    check("program", "Rising from 0 at rate 2, at t = 1.30: the program reports the bound 1/2, but at the center itself one more step of its own transition and then deciding beats deciding at once (so 1/2 is what the grid reports when its first nodes stop, not a center stop)",
      P.g[k] === 0.5 && stepThenDecide > 0.5, `reported ${P.g[k]}; one step then decide ${stepThenDecide.toFixed(8)} against 0.5`);
  }
  // the sine plate's bounds stay far from x*, where the two-bound program would report x* for a bound below its first step
  let far = Infinity;
  for (const rm of [0.5, 0.25]) for (const om of [0.5, 8]) { const r = M.sineRun(rm, om), xs = M.xStar(1, rm), mv = 0.01 * Math.max(...r.dh.map(Math.abs), ...r.dl.map(Math.abs)); far = Math.min(far, r.h0 - xs - mv, xs - r.l0 - mv); }
  check("sine", "on the sinusoid plate's runs, both bounds stay more than 0.5 from x*, so the program's report of x* for a bound inside its first step never arises there", far > 0.5, `closest ${far.toFixed(3)}`);
  // envelope step 3: the three answers for the moved bound differ at second order in dc
  const rootNear = (f, a, b) => { let fa = f(a); for (let i = 0; i < 100; i++) { const m = 0.5 * (a + b), fm = f(m); if (fm * fa <= 0) b = m; else { a = m; fa = fm; } } return 0.5 * (a + b); };
  let ord = true, od = "";
  for (const rm of [0.5, 0.25]) {
    const cb = M.constantBounds(0.1, 1, rm), ft = M.fluxTotals(cb.lo, cb.hi), xs = M.xStar(1, rm);
    const slope = (x, dc) => (0.1 * M.Sfun(x) + cb.K) / Math.cosh(x) ** 2 - (x > xs ? 1 : -rm) / (2 * Math.cosh(x) ** 2) - dc * (ft.C - M.Sfun(x)) / Math.cosh(x) ** 2;
    const gap = (dc) => Math.abs(rootNear((x) => slope(x, dc), cb.hi - 0.5, cb.hi - 1e-9) - (cb.hi - dc * ft.hi / 0.2));
    const r = gap(0.02) / gap(0.01); od += `${rm}: ${r.toFixed(2)}  `;
    if (!(r > 3.2 && r < 4.8)) ord = false;
  }
  check("envelope", "at the upper bound only, for r-/r+ = 0.5 and 0.25: the green curve's own crossing near h0 and the first-order bound (the dot) differ by an amount that falls about fourfold when dc halves (second order), so the upper dot is the linearization, not the curve's root", ord, od);
  // the sine caption: at low frequencies the program's lead residual is a small fraction of a degree
  let lowLead = 0;
  const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
  for (const rm of [0.5, 0.25]) for (const om of [0.5, 1]) {
    const run = M.sineRun(rm, om), cb = M.constantBounds(0.1, 1, rm), tr = M.transferAt(om, cb.lo, cb.hi);
    lowLead = Math.max(lowLead, Math.abs(wrap(run.fitH.phase - 180) - tr.hi.lead), Math.abs(wrap(run.fitL.phase) - tr.lo.lead));
  }
  check("sine", "at omega = 0.5 and 1, both ratios, the plate's program leads or lags the first order by under 0.25 degrees (the caption says a small fraction of a degree)", lowLead < 0.25, `largest ${lowLead.toFixed(3)} degrees`);
}

// ---- the sentences, on random numbers and the strips' real numbers ----------------------------------------------------
{
  const R = K.rng(11);
  let bad = 0, n = 0, first = "";
  const test = (s) => { n++; if (BAD.test(s)) { bad++; if (!first) first = s; } };
  for (let i = 0; i < 3000; i++) {
    const u = () => R.next(), dl = i % 3 ? null : 0.4 + 2 * u();
    test(S.heroLabel(4 * u(), u(), u()));
    test(S.clockVerdict(["flat", "falls", "rises", null][i % 4], { k0: 0.01 + u(), kEnd: 10 * u() + 1e-3, tEnd: dl ?? 10, kMin: 0.005 + u() * 0.01, tMin: u() * 5, deadline: dl }));
    const z = [[], [[0, null]], [[0, 0.6 + u()]], [[0.2 + u(), null]], [[0, 0.3], [0.8, 1.2], [1.5, 1.6], [2, null], [2.3, 2.4]]][i % 5];
    test(S.rulesSay({ frozenGap0: u() - 0.2, frozenGapMax: u(), weightedGapMax: u() * 0.1, plugZero: z, lastShown: 2.5 * u(), losses: i % 2 ? ["0.1", "0.2", "0.3", "0.4"] : null }));
    const q = 0.05 + 0.95 * u(), c = 10 ** (-2 + 2 * u()), cb = M.constantBounds(c, 1, q), nn = { ratio: q, c, lo: cb.lo, hi: cb.hi, xs: M.xStar(1, q), B: K.B(c), gPlus: M.belief(cb.hi), gMinus: 1 - M.belief(cb.lo) };
    test(S.pairSay(nn)); test(S.pairVerdict(["upper", "lower", "same"][i % 3], nn));
    test(S.sineSay({ omega: 2, rm: 0.5, hi: { foGain: u(), foLead: 60 * u(), dpGain: u() + 0.01, dpLead: 60 * u() }, lo: { foGain: u(), foLead: 60 * u(), dpGain: u() + 0.01, dpLead: 60 * u() } }));
  }
  test(S.pairVerdict("upper", { ratio: 1, c: 0.1, lo: -K.B(0.1), hi: K.B(0.1), B: K.B(0.1) }));
  // the strips' sentences on the numbers their plates compute
  const U = M.frozenBound(0.1), kern = M.kernelU(U), mean = M.kernelMean(kern);
  for (let st = 0; st < 6; st++) test(say(S.beliefStep(st, { mu: 1.3, p: [0.8, 0.9, 0.99], thetaEnd: Math.log(11), kappa: 0.1, U, area: 0.3989, target: 1 / Math.sqrt(2 * Math.PI), mean, realAhead: 2 * (Math.exp(mean) - 1) })));
  for (const rm of [1, 0.5, 0.25]) {
    const cb = M.constantBounds(0.1, 1, rm);
    for (let st = 0; st < 5; st++) test(say(S.appbSay(st, { ratio: rm, rp: 1, rm, K: cb.K, lo: cb.lo, hi: cb.hi, xs: M.xStar(1, rm), gapS: M.Sfun(cb.hi) - M.Sfun(cb.lo), gapWant: (1 + rm) / 0.2, worst: 1e-12 })));
    const ft = M.fluxTotals(cb.lo, cb.hi), bk = M.boundaryKernels(cb.lo, cb.hi);
    for (let st = 0; st < 5; st++) test(say(S.envelopeSay(st, { c0: 0.1, dc: 0.02, th: ft.hi, tl: ft.lo, mh: bk.mean("hi"), ml: bk.mean("lo"), mMax: 1, mAt: 0, dhFo: -0.1, dlFo: 0.1, dhEx: -0.1, dlEx: 0.1, dhCurve: rm === 1 ? NaN : -0.12, dlCurve: 0.09, slopeRel: 1e-9, gap: 1e-3, slope: -5.97, Bp: -5.97 })));
  }
  for (const s of sentences) test(s);
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null (random inputs and every real computation above)", bad === 0, `${n} sentences, ${bad} bad${first ? ": " + first : ""}`);
  const v = S.clockVerdict("flat", { k0: 0.1, kEnd: 1.1, tEnd: 10, kMin: 0.1, tMin: 0, deadline: null });
  check("words", "a wrong guess on the clock plate is told the constant cost rises, and the growth for a constant 0.1 is 11 times", /^No: it rises\./.test(v) && /11 times/.test(v), v);
  const v2 = S.clockVerdict("falls", { k0: 0.1, kEnd: 1.1, tEnd: 10, kMin: 0.1, tMin: 0, deadline: null }), v3 = S.clockVerdict("rises", { k0: 0.1, kEnd: 1.1, tEnd: 10, kMin: 0.1, tMin: 0, deadline: null });
  check("words", "the clock plate answers both wrong guesses with the same full sentence, and the right one with Right", /^No: it rises\./.test(v2) && /^Right\./.test(v3), `${v2.slice(0, 20)} / ${v3.slice(0, 20)}`);
  const pv = S.pairVerdict("lower", { ratio: 0.25, c: 0.1, ...M.constantBounds(0.1, 1, 0.25), B: K.B(0.1) });
  check("words", "a wrong guess on the two-bounds plate is told it was the upper bound", /^The upper one/.test(pv), pv);
}
