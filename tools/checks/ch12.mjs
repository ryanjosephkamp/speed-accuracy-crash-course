// Chapter 12: the Palmer observer against the paper's figure script and its generated numbers, the rounding traps and
// the numbers the text derives from them, the kernel's exact tail sums and quantiles, the ramp's lead, the sinusoid's
// lead in degrees and in time, the urgency gate, the averaged bounds against Theorem 7, the urgency on the reader's
// schedule run as the page runs it, the self-test's answers against main.tex, and the sentences.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as K from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch12-model.js";
import { exactPolicy, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS, defaultDrawing, VIEW, SPARE, DRAW_TIMES } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch12.js";
import { check, N, asPrinted, ROOT } from "./lib.mjs";

const V = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch12.json"), "utf8"));
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const COSTS = [0.03, 0.1, 0.3, 1];

// ---- the Palmer observer ----------------------------------------------------------------------------------------
const P = M.palmer(), T = M.traps(P);
{
  const i = V.inputs;
  check("palmer", `the page's inputs are the figure script's at ${V.tag} (k = 21, coherence 0.064, fitted bound)`, M.PALMER.k === i.k && M.PALMER.coherence === i.coherence && M.PALMER.fittedBound === i.fittedBound,
    `page ${JSON.stringify(M.PALMER)}, script ${JSON.stringify(i)}`);
  const v = V.palmer;
  const pairs = [["one time unit (ms)", P.unitMs, v.unitMs], ["bound b", P.b, v.b], ["cost c0", P.c0, v.c0], ["mean look-ahead m", P.m, v.m], ["slow-ramp lead (ms)", P.leadMs, v.leadMs],
    ...P.waves.flatMap((w, k) => [[`${w.hz} Hz lead (degrees)`, w.deg, v.waves[k].deg], [`${w.hz} Hz lead (ms)`, w.ms, v.waves[k].ms], [`${w.hz} Hz swing`, w.gain, v.waves[k].gain]])];
  const worst = pairs.reduce((a, [, x, y]) => Math.max(a, rel(x, y)), 0);
  check("palmer", "every Palmer number the page computes matches the paper's code at the tag, unrounded (relative 1e-9)", worst < 1e-9, `${pairs.length} numbers, largest relative difference ${worst.toExponential(1)}`);
  check("palmer", "the constant-cost bound at the observer's cost is the observer's bound (B(c0) = b within 1e-9)", Math.abs(K.B(P.c0) - P.b) < 1e-9, `${K.B(P.c0).toFixed(12)} vs ${P.b}`);
  check("palmer", "the closed form (22) for m equals the series at the observer's cost (within 1e-6)", Math.abs(P.m - K.meanLookAhead(P.c0)) < 1e-6, `${P.m.toFixed(8)} vs ${K.meanLookAhead(P.c0).toFixed(8)}`);
  const printed = [["PalmerT", P.unitMs], ["PalmerBound", P.b], ["PalmerCost", P.c0], ["PalmerLookAhead", P.m], ["PalmerLead", P.leadMs],
    ...["HalfHz", "OneHz", "TwoHz"].flatMap((tag, k) => [[`PalmerDeg${tag}`, P.waves[k].deg], [`PalmerLeadMs${tag}`, P.waves[k].ms], [`PalmerGain${tag}`, P.waves[k].gain]])];
  for (const [mac, x] of printed) check("palmer", `${mac} as printed`, asPrinted(x, N[mac]), `${x.toFixed(4)} vs ${N[mac]}`);
  // the time lead falls and the degrees rise over the paper's three frequencies, as the text says
  const w = P.waves;
  check("palmer", "over 0.5, 1, and 2 Hz the lead grows in degrees and shrinks in milliseconds, all below the slow-ramp lead", w[0].deg < w[1].deg && w[1].deg < w[2].deg && w[0].ms > w[1].ms && w[1].ms > w[2].ms && w[0].ms < P.leadMs,
    w.map((x) => `${x.deg.toFixed(1)}° ${x.ms.toFixed(1)} ms`).join(", "));
  let mono = true, prev = Infinity;
  for (let lh = Math.log10(0.05); lh <= Math.log10(20); lh += 0.01) { const a = M.palmerAt(10 ** lh, P).ms; if (!(a < prev + 1e-9 && a < P.leadMs + 1e-9)) mono = false; prev = a; }
  check("palmer", "the plate's lead in milliseconds falls with frequency from 0.05 to 20 Hz and stays below the slow-ramp lead", mono, `at 0.05 Hz ${M.palmerAt(0.05, P).ms.toFixed(1)} ms, at 20 Hz ${M.palmerAt(20, P).ms.toFixed(2)} ms`);
}

// ---- the rounding traps, and the numbers the text derives from them -----------------------------------------------
{
  check("trap", "the trap from the printed bound matches the paper's code run on the printed bound (relative 1e-9)", rel(T.fromBound, V.traps.fromBound) < 1e-9 && T.bPrinted === V.traps.bPrinted, `${T.fromBound.toFixed(6)} vs ${V.traps.fromBound.toFixed(6)}`);
  check("trap", "the traps from the printed phases match (whole degrees, then milliseconds)", T.fromDegrees.every((d, k) => d.deg === V.traps.fromDegrees[k].deg && rel(d.ms, V.traps.fromDegrees[k].ms) < 1e-12), T.fromDegrees.map((d) => `${d.deg}° → ${d.ms.toFixed(2)} ms`).join(", "));
  check("trap", "the printed bound is PalmerBound and the printed phases are the PalmerDeg macros", T.bPrinted.toFixed(2) === N.PalmerBound && T.fromDegrees.map((d) => String(d.deg)).join() === [N.PalmerDegHalfHz, N.PalmerDegOneHz, N.PalmerDegTwoHz].join(), `${T.bPrinted}, ${T.fromDegrees.map((d) => d.deg).join(", ")}`);
  check("trap", "the traps differ from the paper's numbers: 216 against PalmerLead, 161 against PalmerLeadMsHalfHz", Math.round(T.fromBound) !== +N.PalmerLead && Math.round(T.fromDegrees[0].ms) !== +N.PalmerLeadMsHalfHz, `${Math.round(T.fromBound)} vs ${N.PalmerLead}; ${Math.round(T.fromDegrees[0].ms)} vs ${N.PalmerLeadMsHalfHz}`);
  // the chapter's text types the trap values and the figure script's inputs: hold each to its computation
  const text = readFileSync(join(ROOT, "book/content/ch12.py"), "utf8");
  const typed = [
    ["216 ms", `${Math.round(T.fromBound)} ms`], ["\\approx 161", `\\approx ${Math.round(1000 * 2 * +N.PalmerDegHalfHz / 360)}`],
    ["\\approx 103", `\\approx ${Math.round(1000 * +N.PalmerDegOneHz / 360)}`], ["0.95424", (M.PALMER.k * M.PALMER.coherence * M.PALMER.fittedBound).toFixed(5)],
    ["\\times 0.71", `\\times ${V.inputs.fittedBound}`],
  ];
  for (const [want, computed] of typed) check("trap", `the text's “${want}” is the computation's “${computed}”`, text.includes(want) && want === computed, `computed ${computed}`);
  check("trap", "the text quotes 161 ms only beside the printed phase, and 216 ms only beside the printed bound", (text.match(/161 ms/g) || []).length === 1 && (text.match(/216 ms/g) || []).length === 2, `161 ms ×${(text.match(/161 ms/g) || []).length}, 216 ms ×${(text.match(/216 ms/g) || []).length}`);
}

// ---- the kernel: exact tail sums and quantiles --------------------------------------------------------------------
for (const c of COSTS) {
  const b = K.B(c), m = K.meanLookAhead(c);
  check("kernel", `E(S - a)^+ at a -> 0+ is the mean look-ahead at c0 = ${c} (within 1e-7)`, Math.abs(M.excessMean(1e-12, c) - m) < 1e-7, `${M.excessMean(1e-12, c).toFixed(9)} vs ${m.toFixed(9)}`);
  // against a quadrature of the tail P(S > s) from the series' masses
  for (const a of [0.05 * m, m, 3 * m]) {
    let q = 0; const top = a + 60 / ((1 + K.kappa(0, b) ** 2) / 2), n = 20000, hstep = (top - a) / n;
    for (let i = 0; i <= n; i++) { const s = a + i * hstep, wgt = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; q += wgt * K.kernelMass(s, Infinity, b, 3000); }
    q *= hstep / 3;
    check("kernel", `E(S - a)^+ from the series equals a quadrature of the kernel's tail at c0 = ${c}, a = ${a.toFixed(4)} (within 1e-6)`, Math.abs(M.excessMean(a, c) - q) < 1e-6, `${M.excessMean(a, c).toFixed(8)} vs ${q.toFixed(8)}`);
  }
  const med = M.kernelQuantile(0.5, c), q90 = M.kernelQuantile(0.9, c);
  check("kernel", `the median and the 90th percentile at c0 = ${c} solve the distribution function, and median < mean < 90th`, Math.abs(M.kernelCdf(med, c) - 0.5) < 1e-9 && Math.abs(M.kernelCdf(q90, c) - 0.9) < 1e-9 && med < m && m < q90,
    `median ${med.toFixed(4)}, mean ${m.toFixed(4)}, 90th ${q90.toFixed(4)}`);
  const { edges, w } = K.kernelBins(c); let acc = 0, j = 0; while (edges[j + 1] < med) acc += w[j++];
  check("kernel", `the median agrees with the kernel's bins at c0 = ${c} (their weight below it, within 0.01 of a half)`, Math.abs(acc + w[j] * (med - edges[j]) / (edges[j + 1] - edges[j]) - 0.5) < 0.01, `bins' weight ${(acc + w[j] * (med - edges[j]) / (edges[j + 1] - edges[j])).toFixed(4)}`);
}

// ---- the ramp's lead ----------------------------------------------------------------------------------------------
{
  const Ls = []; for (let lL = -1; lL <= 1.3 + 1e-9; lL += 0.05) Ls.push(10 ** lL);
  for (const c of COSTS) {
    const m = K.meanLookAhead(c), med = M.kernelQuantile(0.5, c);
    const leads = Ls.map((L) => M.rampLead(L, c));
    const mono = leads.every((x, k) => k === 0 || x >= leads[k - 1] - 1e-9), within = leads.every((x) => x <= m + 1e-9 && x >= med * (1 - 1e-6));
    check("ramp", `over the slider's ramp lengths (0.1 to 20), the lead at c0 = ${c} rises with the length and lies between the kernel's median and mean`, mono && within, `${leads[0].toFixed(4)} to ${leads[leads.length - 1].toFixed(4)}; median ${med.toFixed(4)}, mean ${m.toFixed(4)}`);
    const shortL = M.rampLead(1e-3, c), longL = M.rampLead(400, c);
    check("ramp", `the lead tends to the median for a very short ramp and to the mean for a very long one, at c0 = ${c}`, Math.abs(shortL - med) < 0.01 * med && Math.abs(longL - m) < 1e-6, `L = 0.001: ${shortL.toFixed(5)} vs ${med.toFixed(5)}; L = 400: ${longL.toFixed(7)} vs ${m.toFixed(7)}`);
    // the exact sum against the kernel's bins, an independent quadrature
    let worst = 0;
    for (const L of [0.3, 2, 8]) for (const t of [1, 1.5 + L * 0.3, 1.5 + L * 0.5, 1.5 + L]) worst = Math.max(worst, Math.abs(M.rampLookAhead(t, 1.5, L, c) - K.lookAhead(M.ramp(1.5, L), t, c)));
    check("ramp", `the ramp's exact look-ahead equals the kernel's bins' average at c0 = ${c} (within 2e-3)`, worst < 2e-3, `largest difference ${worst.toExponential(1)}`);
  }
  const d = M.rampLead(8, 0.1), m = K.meanLookAhead(0.1);
  check("ramp", "the plate's default ramp (8 time units at c0 = 0.1) is slow: its lead is within 5% of the mean look-ahead", (m - d) / m <= 0.05, `${d.toFixed(4)} vs ${m.toFixed(4)}`);
}

// ---- the sinusoid's lead --------------------------------------------------------------------------------------------
{
  let bad = 0, n = 0;
  for (const c of [...COSTS, 0.03]) {
    const m = K.meanLookAhead(c); let prev = Infinity;
    for (let lo = Math.log10(0.05); lo <= Math.log10(3000); lo += 0.01) {
      const x = M.waveLead(c, 10 ** lo); n++;
      if (!(x.time < prev + 1e-12 && x.time < m + 1e-9 && x.deg > 0 && x.deg < 90 && x.gain < 1)) bad++;
      if (Math.abs(x.time - (x.deg * Math.PI) / 180 / 10 ** lo) > 1e-12) bad++;
      prev = x.time;
    }
  }
  check("wave", "the lead in time falls with frequency and stays below m(c0), and the phase stays in (0, 90) degrees, over omega from 0.05 to 3000 at the plates' costs", bad === 0, `${n} points, ${bad} bad`);
  const scan = (c) => { let best = { lead: -1, omega: 0 }; for (let lo = -2; lo <= 5; lo += 0.005) { const w = 10 ** lo, dd = K.transfer(c, w).lead; if (dd > best.lead) best = { lead: dd, omega: w }; } return best; };
  const p1 = scan(1), p01 = scan(0.1), p003 = scan(0.03);
  check("wave", "step 5's scan: at c0 = 1 the lead passes 45 degrees (about 46, near omega = 66); at 0.1 and 0.03 it stays below", p1.lead > 45.5 && p1.lead < 46.5 && p1.omega > 40 && p1.omega < 100 && p01.lead < 45 && p003.lead < 45, `${p1.lead.toFixed(3)} at ${p1.omega.toFixed(1)}; ${p01.lead.toFixed(3)}; ${p003.lead.toFixed(3)}`);
  const far = COSTS.map((c) => K.transfer(c, 1e6).lead);
  check("wave", "the lead tends to 45 degrees: within 0.05 at omega = 1e6 for every plate cost", far.every((l) => Math.abs(l - 45) < 0.05), far.map((l) => l.toFixed(3)).join(", "));
}

// ---- the urgency gate -------------------------------------------------------------------------------------------------
{
  const bnd = (t) => K.B(0.1 + 0.8 * Math.max(t - 0.5, 0));
  const g = M.gatePath(bnd, K.rng(2026 + 12));
  check("gate", "the plate's seeded path reaches the bound within the time drawn", Number.isFinite(g.hit) && g.hit < 4, `hit at ${g.hit.toFixed(4)}`);
  let same = 0, n = 0;
  for (let s = 0; s < 300; s++) {
    const p = M.gatePath(bnd, K.rng(5000 + s)); if (!Number.isFinite(p.hit)) continue; n++;
    // the first step at which the gated evidence (a = 1) reaches the fixed level, computed separately
    const k = p.xs.findIndex((x, i) => Math.abs(x / bnd(p.ts[i])) >= 1);
    if (k === p.xs.length - 1 && p.hit > p.ts[k - 1] - 1e-12 && p.hit <= p.ts[k] + 1e-12) same++;
  }
  check("gate", "on 300 seeded paths, U·X reaches the fixed level a at the same step as X reaches b(t), and the hitting time lies in that step", same === n && n > 280, `${same} of ${n} paths`);
  // to first order, U/U0 = b0/b falls along its tangent 2 - b/b0
  check("gate", "a/b and its tangent at b0 differ at second order (a 1% move of the bound: within 1.1e-4)", Math.abs(1 / 0.99 - (2 - 0.99)) < 1.1e-4 && Math.abs(1 / 1.01 - (2 - 1.01)) < 1.1e-4, `${(1 / 0.99 - 1.01).toExponential(2)}`);
}

// ---- the averaged bounds against Theorem 7 ---------------------------------------------------------------------------
{
  const shapes = { ramp: (t) => Math.min(1, Math.max(0, (t - 1) / 1.5)), wave: (t) => Math.sin(2.5 * t), pulse: (t) => 1 / (1 + Math.exp(-(t - 1.6) / 0.08)) - 1 / (1 + Math.exp(-(t - 2.3) / 0.08)) };
  for (const c of [0.03, 0.3]) for (const [name, sh] of Object.entries(shapes)) {
    const errAt = (eps) => {
      const cost = (t) => c * (1 + eps * sh(t)), gamma = (t) => c * sh(t), ts = [0.5, 1.2, 1.8, 2.5, 3.2];
      const beta = K.firstOrder(gamma, ts, c), b0 = K.B(c);
      return Math.max(...ts.map((t, i) => Math.abs(M.averagedBound(cost, t, c) - (b0 + eps * beta[i]))));
    };
    const e1 = errAt(0.1), e2 = errAt(0.05);
    check("control", `the fixed kernel's average of the bounds is Theorem 7's bound to first order: halving the size quarters the gap (${name}, c0 = ${c})`, e1 / e2 > 3.5 && e1 / e2 < 4.5, `gap ${e1.toExponential(2)} at 0.1, ${e2.toExponential(2)} at 0.05, ratio ${(e1 / e2).toFixed(2)}`);
  }
  check("control", "for a constant cost, the average of the bounds is the constant-cost bound (within 1e-9)", COSTS.every((c) => Math.abs(M.averagedBound(() => c, 1, c) - K.B(c)) < 1e-9), COSTS.map((c) => (M.averagedBound(() => c, 1, c) - K.B(c)).toExponential(1)).join(", "));
}

// ---- the urgency on the reader's schedule, run as the page runs it -----------------------------------------------------
// the worker's scale job: the program at c0 and at c0 + eps (c - c0) for each eps, kept every second step over the window
const EPS = [1, 0.25, 0.0625];
const thin = (ts, arr, upto) => { const t = [], v = []; let last = -1; for (let k = 0; k < ts.length && ts[k] <= upto + 1e-9; k++) last = k; for (let k = 0; k <= last; k += 2) { t.push(ts[k]); v.push(arr[k]); } if (t.length && t[t.length - 1] !== ts[last]) { t.push(ts[last]); v.push(arr[last]); } return { t, v }; };
function scaleJob(cost, c0) {
  const flat = exactPolicy(() => c0, VIEW + SPARE), b0 = thin(flat.ts, flat.bounds, VIEW);
  const runs = EPS.map((e) => { const r = exactPolicy((t) => c0 + e * (cost(t) - c0), VIEW + SPARE); return thin(r.ts, r.bounds, VIEW).v; });
  return { t: b0.t, b0: b0.v, runs };
}
{
  const avg = (cost) => { const ts = Array.from({ length: 501 }, (_, i) => (i * VIEW) / 500); return ts.reduce((a, t) => a + cost(t), 0) / ts.length; };
  const runs = [...PRESETS.filter((p) => !["deadline", "constant"].includes(p.id)).map((p) => ({ id: p.id, choice: { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) } })),
    { id: "draw (the default drawing)", choice: { id: "draw", points: defaultDrawing() } }];
  for (const p of runs) {
    const cost = costOf(p.choice), c0 = avg(cost), m = scaleJob(cost, c0);
    const { u, gFo, gPm } = M.urgencies(m.t, m.b0, m.runs, cost, c0, EPS);
    const L = EPS.length - 1, finite = u.every((x) => x.best.every((v) => Number.isFinite(v) && v > 0));
    const say = S.yoursSay(EPS, L, gFo, gPm, u[L].holes, p.id === "rising");
    check("yours", `${p.id}: at the smallest size the first-order urgency is closer to the best bound's than the per-moment urgency, and the best bound's urgency is finite`, gFo[L] < gPm[L] && finite && !u[L].holes && /is the closer of the two/.test(say) && !/not the closer/.test(say),
      `gaps at ${EPS.join(", ")}: first order ${gFo.map((g) => g.toExponential(1)).join(", ")}; per-moment ${gPm.map((g) => g.toExponential(1)).join(", ")}`);
  }
  // a deadline, on an even and on an odd time step: the plate stops short of the deadline, where the bound is above 0
  for (const at of [1, 1.05, 0.45]) {
    const choice = { id: "deadline", params: { at, c: 0.1 } }, cost = costOf(choice), dl = deadlineOf(choice);
    const run = exactPolicy(cost, dl), ex = thin(run.ts, run.bounds, dl);
    const pm = ex.t.map((t) => (t >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(t)), 0.01)));
    const D = M.deadlineUrgency({ t: ex.t, exact: ex.v, pm, cost: ex.t.map(cost) }, dl);
    const ok = D.keep.length > 10 && D.tLast < dl && ex.t[ex.t.length - 1] === run.ts[run.ts.length - 1] && D.best.every((v) => Number.isFinite(v) && v > 0) && D.pm.every((v) => Number.isFinite(v)) && D.ratio >= 1;
    check("yours", `deadline at ${at}: the worker's times end on the forced choice, and the plate draws finite urgencies up to ${D.tLast.toFixed(2)}, short of it`, ok, `${D.keep.length} points, last ratio ${D.ratio.toFixed(2)}`);
  }
  // schedules with nothing to lead: the Constant preset, a flat drawing, and Smooth at size 0
  const flat = [{ id: "constant", params: { c: 0.1 } }, { id: "draw", points: DRAW_TIMES.map(() => 0.2) }, { id: "smooth", params: { c0: 0.1, size: 0 } }];
  check("yours", "the Constant preset, a flat drawing, and Smooth at size 0 are found not to move, and the Wave preset is found to move", flat.every((ch) => !M.moves(costOf(ch), avg(costOf(ch)), VIEW, SPARE)) && M.moves(costOf({ id: "wave", params: { omega: 2, size: 0.05 } }), 0.1, VIEW, SPARE), "three flat, one moving");
}

// ---- the self-test against main.tex -------------------------------------------------------------------------------------
{
  const tex = readFileSync(join(ROOT, "paper/main.tex"), "utf8").split("\n");
  const flat = (a, b) => tex.slice(a - 1, b).join(" ").replace(/\s+/g, " ");
  for (const it of S.ITEMS) check("novelty", `“${it.text}”: its phrase is in main.tex at lines ${it.lines[0]}–${it.lines[1]}`, flat(it.lines[0], it.lines[1]).includes(it.quote), it.quote);
  const count = (k) => S.ITEMS.filter((it) => it.key === k).length;
  check("novelty", "the key: the technique, the convolution form, the identities, and anticipation credited; the exact equation proved; the kernel, the infinite-horizon proof, and the rule new", count("credited") === 4 && count("proved") === 1 && count("new") === 3 &&
    ["technique", "convolution", "identities", "anticipation"].every((id) => S.ITEMS.find((it) => it.id === id).key === "credited") && S.ITEMS.find((it) => it.id === "exact").key === "proved", S.ITEMS.map((it) => `${it.id}: ${it.key}`).join(", "));
  const all = S.ITEMS.map((it) => it.text + " " + S.answerText(it)).join(" ");
  check("novelty", "no statement or answer calls the rule fast or optimal, or drops the qualifier from a claim of novelty", !/\bfast\b|(?<!not )faster|\boptimal rule\b|\bfirst to\b/i.test(all) && S.ITEMS.filter((it) => it.key === "new").every((it) => /knowledge/.test(S.answerText(it))), "checked");
  // the paper's novelty sentences, in the paper's words: the exact equation is not among what they call new
  const intro = flat(195, 201), rel2 = flat(1136, 1143), smooth = flat(1170, 1172);
  check("novelty", "the paper's three sentences on what is new each say “to our knowledge” and none lists the exact equation", [intro, rel2, smooth].every((s) => /to our knowledge/.test(s.replace(/\s+/g, " ")) || /to our\s+knowledge/.test(s)) && ![intro, rel2, smooth].some((s) => /exact equation[^.]*new/.test(s)), "lines 195–201, 1136–1143, 1170–1172");
}

// ---- the sentences ------------------------------------------------------------------------------------------------
{
  const R = K.rng(12);
  let bad = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const u = () => R.next();
    const c = COSTS[i % 4], m = 0.04 + u() * 0.6, gF = [u(), u() * 0.1, u() * 1e-3], gP = [u(), u() * 0.3, u() * 0.05];
    const marks = Object.fromEntries(S.ITEMS.filter(() => u() < 0.6).map((it) => [it.id, S.KINDS[Math.floor(u() * 3)][0]]));
    const say = [
      S.heroLabel(i % 4 === 0 ? "ramp" : [0.5, 1, 2][i % 3], 50 + 200 * u(), 20 + 25 * u(), u()),
      S.rampVerdict(i % 5 ? u() * 1.2 : NaN, u(), m, 10 * u()), S.rampSay(c, 0.1 + 20 * u(), m * (0.3 + 0.7 * u()), m, m * 0.4),
      S.waveSay(c, 10 ** (3 * u() - 1), 50 * u(), u(), u(), m), S.gateSay(i % 7 ? 3 * u() : NaN), S.mirrorSay(c, K.B(c)), S.mirrorWaveSay(c, 40 * u()), S.linearSay(c, m),
      S.phaseSay(c, { lead: 44 + 3 * u(), omega: 10 ** (4 * u()) }, m), S.yoursSay(EPS, i % 3, gF, gP, i % 2 === 0, i % 5 === 0), S.outsideNote(["deadline", "constant", "rising"][i % 3]),
      S.insideNote("Wave"), S.deadlineSay(u(), 1 + u(), 1 + 5 * u()), S.msVerdict(i % 3 ? 600 * u() : NaN, i % 4 ? 90 * u() : NaN, P.leadMs, P.waves[1].deg, P.waves[1].ms),
      S.msSay(P), S.trapSay(P, T), S.controlSay(4 * u(), c, m, m * 0.4, m * 2.5, u() + 0.5, u() + 0.5), S.noveltyVerdict(marks),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const hero = [S.heroLabel("ramp", P.leadMs), ...P.waves.map((w) => S.heroLabel(w.hz, w.ms, w.deg, w.gain))].join(" | ");
  const want = [`${N.PalmerLead} ms`, `${N.PalmerLeadMsHalfHz} ms ahead (${N.PalmerDegHalfHz}°), with ${N.PalmerGainHalfHz}`, `${N.PalmerLeadMsOneHz} ms ahead (${N.PalmerDegOneHz}°), with ${N.PalmerGainOneHz}`, `${N.PalmerLeadMsTwoHz} ms ahead (${N.PalmerDegTwoHz}°), with ${N.PalmerGainTwoHz}`];
  check("words", "the hero's labels print the paper's Palmer numbers", want.every((w) => hero.includes(w)), hero);
  const ms = S.msSay(P) + " " + S.msVerdict(NaN, NaN, P.leadMs, P.waves[1].deg, P.waves[1].ms);
  check("words", "the milliseconds plate's sentences print the paper's Palmer numbers", [N.PalmerDegHalfHz, N.PalmerDegOneHz, N.PalmerDegTwoHz].every((d) => ms.includes(d + "°")) && [N.PalmerLeadMsHalfHz, N.PalmerLeadMsOneHz, N.PalmerLeadMsTwoHz, N.PalmerLead].every((x) => ms.includes(x + " ms")), ms);
  const tr = S.trapSay(P, T);
  check("words", "the trap sentence prints 216 and 161 beside the paper's PalmerLead and PalmerLeadMsHalfHz", tr.includes("216 ms") && tr.includes("161 ms") && tr.includes(`${N.PalmerLead} ms`) && tr.includes(`${N.PalmerLeadMsHalfHz} ms`), tr);
  // the ramp sentence calls a ramp slow only when its lead is within 5% of m, on every cost and ramp length the plate offers
  let wrong = 0;
  for (const c of COSTS) { const m = K.meanLookAhead(c), med = M.kernelQuantile(0.5, c); for (let lL = -1; lL <= 1.3; lL += 0.1) { const L = 10 ** lL, lead = M.rampLead(L, c), s = S.rampSay(c, L, lead, m, med); if (/is slow next/.test(s) !== ((m - lead) / m <= 0.05)) wrong++; } }
  check("words", "the ramp sentence calls a ramp slow exactly when its lead is within 5% of the mean look-ahead", wrong === 0, `${wrong} wrong`);
  check("words", "the wave sentence flags a lead above 45 degrees only when there is one", /above 45°/.test(S.waveSay(1, 66, K.transfer(1, 66).lead, 0.01, 0.3, 0.04)) && !/above 45°/.test(S.waveSay(0.1, 8, K.transfer(0.1, 8).lead, 0.08, 0.36, 0.546)), S.waveSay(1, 66, K.transfer(1, 66).lead, 0.01, 0.3, 0.04));
  const ys = S.yoursSay(EPS, 0, [0.5, 0.1, 0.02], [0.3, 0.08, 0.03], true, true);
  const big = S.yoursSay(EPS, 0, [84, 0.2, 0.007], [0.12, 0.03, 0.008]);
  check("words", "the schedule sentence calls the first order the closer only when its gap is smaller, flags the rising cost and gaps, and writes a gap over 100% as a multiple", /is the closer of the two/.test(ys) && /outside the theorem/.test(ys) && /leaves a gap/.test(ys) && /not the closer/.test(S.yoursSay(EPS, 0, [0.5, 0.1, 0.05], [0.3, 0.08, 0.03])) && /84\.0 times the constant cost's urgency/.test(big) && !/\d{3,}%/.test(big), big);
  const nv = S.noveltyVerdict({ technique: "new", convolution: "credited", exact: "proved", identities: "proved" });
  check("words", "the self-test verdict counts the right marks (the identities accept both answers) and flags a credited statement marked new", /^3 of your 4 marks/.test(nv) && /One statement you marked new/.test(nv), nv);
}
