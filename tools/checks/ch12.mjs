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
import { check, N, asPrinted, ROOT, runWorker } from "./lib.mjs";

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
  const dips = (c) => { let prev = -1, dip = false; for (let lo = Math.log10(0.05); lo <= Math.log10(3000); lo += 0.002) { const d = K.transfer(c, 10 ** lo).lead; if (d < prev - 1e-9) dip = true; prev = d; } return dip; };
  check("wave", "the phase in degrees rises steadily over omega from 0.05 to 3000 at c0 = 0.03 and 0.1, and dips on the way at 0.3 and 1, as the text says", !dips(0.03) && !dips(0.1) && dips(0.3) && dips(1), `dips: 0.03 ${dips(0.03)}, 0.1 ${dips(0.1)}, 0.3 ${dips(0.3)}, 1 ${dips(1)}`);
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
  // the drawn paths: every fifth step, then the one crossing, at the upper or the lower level, on both charts
  let drawnOk = 0, lower = 0, m2 = 0, lowerSay = "";
  for (let s = 0; s < 300; s++) {
    const p = M.gatePath(bnd, K.rng(5000 + s)); if (!Number.isFinite(p.hit)) continue; m2++;
    const d = M.gateDisplay(p, bnd), k = d.ts.length - 1, last = p.xs.length - 1;
    const between = p.hit >= p.ts[last - 1] - 1e-12 && p.hit <= p.ts[last] + 1e-12 && d.ts[k - 1] < p.hit;
    const onLevel = Math.abs(d.xs[k] - p.sign * bnd(p.hit)) < 1e-12 && Math.abs(d.gated[k] - p.sign) < 1e-12 && d.gated.slice(0, k).every((v) => Math.abs(v) < 1);
    const sayOk = p.sign > 0 ? /upper bound, \+b\(t\)/.test(S.gateSay(p.hit, p.sign)) && /reaches \+a/.test(S.gateSay(p.hit, p.sign)) : /lower bound, −b\(t\)/.test(S.gateSay(p.hit, p.sign)) && /reaches −a/.test(S.gateSay(p.hit, p.sign));
    if (between && onLevel && sayOk) drawnOk++;
    if (p.sign < 0) { lower++; lowerSay = S.gateSay(p.hit, p.sign); }
  }
  check("gate", "on 300 seeded paths, both charts draw the same crossing, at the signed level (+b and +a, or −b and −a) and between the two straddling steps, and the sentence names the level", drawnOk === m2 && lower > 0, `${drawnOk} of ${m2} paths; ${lower} at the lower level: ${lowerSay}`);
  {
    // the drawn moving bound passes through the marked crossing: gateBoundLine (what the plate draws) has a knot at the
    // crossing time, so the polyline read there is b(hit), the marked point's height; without that knot it is off
    const at = (ts, ys, x) => { const i = ts.findIndex((t) => t >= x); if (ts[i] === x) return ys[i]; return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - ts[i - 1])) / (ts[i] - ts[i - 1]); };
    let worst = 0, oldGap = 0;
    for (const seed of [2026 + 12, 25 + 12, ...Array.from({ length: 40 }, (_, i) => 7000 + i)]) {
      const p = M.gatePath(bnd, K.rng(seed)); if (!Number.isFinite(p.hit)) continue;
      const L = M.gateBoundLine(p, bnd), d = M.gateDisplay(p, bnd), mark = d.xs[d.xs.length - 1];
      worst = Math.max(worst, Math.abs(p.sign * at(L.ts, L.b, p.hit) - mark));
      if (seed === 2026 + 12) { const even = Array.from({ length: 160 }, (_, i) => (L.end * i) / 159); oldGap = Math.abs(at(even, even.map(bnd), p.hit) - Math.abs(mark)); }
    }
    check("gate", "on the default path, seed 25's, and 40 more, the moving bound as drawn (gateBoundLine) passes through the marked crossing (within 1e-12); with only its 160 even knots it would miss it slightly", worst < 1e-12 && oldGap > 1e-6,
      `largest miss ${worst.toExponential(1)}; on the default path, the even knots alone miss by ${oldGap.toExponential(2)}`);
  }
  const neg = M.gatePath(bnd, K.rng(25 + 12));
  check("gate", "the path for ?seed=25 crosses at the lower level, and the plate says so", neg.sign === -1 && /lower bound/.test(S.gateSay(neg.hit, neg.sign)) && /−a/.test(S.gateSay(neg.hit, neg.sign)), `hit ${neg.hit.toFixed(4)}, sign ${neg.sign}`);
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

{
  const say = S.controlSay(2, 0.1, 0.546, 0.23, 1.53, 1.3, 1.34);
  check("control", "the control sentence names the fixed-kernel approximation and says it is the best bound only to first order", /fixed-kernel approximation/.test(say) && /to first order in the size of the change, it is the best bound/.test(say) && !/the bound is the kernel's average/.test(say), say);
  // the control plate's window (END = 4, so the chart ends at 4.6): the reading and the arrow come from controlWindow,
  // which the plate calls for both
  const w1 = M.controlWindow(4, 0.03, 4.6), w2 = M.controlWindow(4, 1, 4.6);
  check("control", "controlWindow, which the plate's reading and arrow use: at c0 = 0.03 and t = 4 it gives the reading “29%” and puts the mean, 0.618 ahead (as the plate prints it), past the chart's edge, the branch where the plate draws the arrow (the drawing itself isn't inspected); at c0 = 1 it gives no reading, with under 0.5% past the edge",
    w1.reading === "29%" && !w1.meanInside && w1.meanAt > 4.6 && (w1.meanAt - 4).toFixed(3) === "0.618" && /the average uses all of it/.test(S.PAST_EDGE) && w2.reading === null && w2.past > 0 && w2.past < M.PAST_SHOWN,
    `${(w1.past * 100).toFixed(2)}% past, mean at ${w1.meanAt.toFixed(3)}; at c0 = 1, ${(w2.past * 100).toExponential(2)}% past, no reading`);
  const cap = readFileSync(join(ROOT, "book/content/ch12.py"), "utf8");
  check("control", "the control caption states the reading's threshold, the plate's own (PAST_SHOWN = 0.005)", cap.includes(`when at least ${M.PAST_SHOWN * 100}% of the weight lies past the right edge`), `PAST_SHOWN ${M.PAST_SHOWN}`);
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
    const say = S.yoursSay(EPS, L, gFo, gPm, u.map((x) => x.total - x.used), p.id === "rising", u[L].total);
    check("yours", `${p.id}: at the smallest size the first-order urgency is closer to the best bound's than the per-moment urgency, and the best bound's urgency is finite`, gFo[L] < gPm[L] && finite && !u[L].holes && /is the closer of the two/.test(say) && !/not the closer/.test(say),
      `gaps at ${EPS.join(", ")}: first order ${gFo.map((g) => g.toExponential(1)).join(", ")}; per-moment ${gPm.map((g) => g.toExponential(1)).join(", ")}`);
  }
  {
    // a drawing at 0.01, then 2 from time 2: at full size the first-order bound falls to 0 or below at some times
    const choice = { id: "draw", points: DRAW_TIMES.map((t, i) => (i < 20 ? 0.01 : 2)) }, cost = costOf(choice), c0 = avg(cost), m = scaleJob(cost, c0);
    const { u, gFo, gPm } = M.urgencies(m.t, m.b0, m.runs, cost, c0, EPS), x = u[0];
    const joint = m.t.map((_, i) => Number.isFinite(x.best[i]) && Number.isFinite(x.fo[i]) && Number.isFinite(x.pm[i]));
    const g1 = Math.max(0, ...x.fo.map((v, i) => (joint[i] ? Math.abs(v - x.best[i]) : 0))), g2 = Math.max(0, ...x.pm.map((v, i) => (joint[i] ? Math.abs(v - x.best[i]) : 0)));
    const say = S.yoursSay(EPS, 0, gFo, gPm, u.map((v) => v.total - v.used), false, x.total);
    check("yours", "a drawing with a first-order bound at or below 0: both gaps are taken over the same times, where all three are defined, and the sentence and readings say how many", x.holes && x.used < x.total && x.used === joint.filter(Boolean).length && g1 === gFo[0] && g2 === gPm[0] &&
      say.includes(`both over the ${x.used} of ${x.total} times where all three curves are defined`) && S.overTimes(x.used, x.total).includes(`${x.used} of ${x.total}`), `${x.used} of ${x.total} times; ${say}`);
  }
  check("yours", "the deadline's state line says the program's bound is computed for discrete checking and only the per-moment bound is moved in", /program's bound is computed for checking every 0.01/.test(S.DEADLINE_STATE) && /per-moment bound is moved in by 0.5826/.test(S.DEADLINE_STATE) && !/the bounds are moved in/.test(S.DEADLINE_STATE), S.DEADLINE_STATE);
  // a deadline, on an even and on an odd time step: the solver's worker (dp-worker.js, run here as the page runs it) ends
  // its times on the forced choice, and the plate (deadlineUrgency, then yoursText) stops short of it
  for (const [at, c] of [[1, 0.1], [1.05, 0.1], [0.45, 0.1], [0.45, 0.5]]) {
    const choice = { id: "deadline", params: { at, c } }, dl = deadlineOf(choice);
    const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
    const D = M.deadlineUrgency(m, dl), T = S.yoursText({ kind: "deadline", tLast: D.tLast, deadline: dl, ratio: D.ratio }, EPS, 0);
    const run = exactPolicy(costOf(choice), dl);
    const ok = m.ok && D.keep.length > 10 && D.tLast < dl && Math.abs(m.t[m.t.length - 1] - run.ts[run.ts.length - 1]) < 1e-12 && D.best.every((v) => Number.isFinite(v) && v > 0) && D.pm.every((v) => Number.isFinite(v)) && D.ratio >= 1
      && T.say.includes(`at time ${D.tLast.toFixed(2)}, the last moment the plate draws before the deadline at ${dl.toFixed(2)}`);
    check("yours", `deadline at ${at}, cost ${c}: the worker's times end on the forced choice, and the plate draws finite urgencies up to ${D.tLast.toFixed(2)}, short of it, and says so`, ok, `${D.keep.length} points, last ratio ${D.ratio.toFixed(2)}; ${T.say}`);
  }
  // schedules with nothing to lead: the Constant preset, a flat drawing, and Smooth at size 0
  const flat = [{ id: "constant", params: { c: 0.1 } }, { id: "draw", points: DRAW_TIMES.map(() => 0.2) }, { id: "smooth", params: { c0: 0.1, size: 0 } }];
  check("yours", "the Constant preset, a flat drawing, and Smooth at size 0 are found not to move, and the Wave preset is found to move", flat.every((ch) => !M.moves(costOf(ch), avg(costOf(ch)), VIEW, SPARE)) && M.moves(costOf({ id: "wave", params: { omega: 2, size: 0.05 } }), 0.1, VIEW, SPARE), "three flat, one moving");
  // what the plate prints for them at every size the reader picks (the size handler calls yoursText again): the flat
  // sentence and two gaps of 0, never a winner
  const t126 = Array.from({ length: 126 }, (_, i) => (i * VIEW) / 125);
  let flatOk = true, flatSay = "";
  for (const ch of flat) {
    const d = M.flatUrgency(t126, avg(costOf(ch)), EPS);
    for (let k = 0; k < EPS.length; k++) { const T = S.yoursText(d, EPS, k); flatSay = T.say; if (T.say !== S.FLAT_SAY || T.fo !== "0%" || T.pm !== "0%" || /closer of the two/.test(T.say)) flatOk = false; }
  }
  check("yours", "the Constant preset, a flat drawing, and Smooth at size 0: at each of the three sizes, the plate's text (yoursText) gives both gaps as 0% and the flat sentence, which names no rule as the closer", flatOk, flatSay);
  // a nearly flat drawing (its third point raised from 0.1 to 0.100001): the gaps are tiny but not 0, and the plate prints
  // them to two significant digits instead of 0.00%, before naming the closer one
  {
    const choice = { id: "draw", points: DRAW_TIMES.map((t, i) => (i === 2 ? 0.100001 : 0.1)) }, cost = costOf(choice), c0 = avg(cost);
    const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "scale", choice, c0, eps: EPS, view: VIEW });
    const { u, gFo, gPm } = M.urgencies(m.t, m.b0, m.runs, cost, c0, EPS), L = EPS.length - 1;
    const d = { kind: "scale", t: m.t, c0, outside: false, u, gFo, gPm }, T = S.yoursText(d, EPS, L);
    const tiny = gFo[L] > 0 && gPm[L] > 0 && gFo[L] < 1e-6 && gPm[L] < 1e-6;
    check("yours", "a nearly flat drawing (one point raised by 10⁻⁶): the smallest size's gaps are positive and under 10⁻⁶, and the plate prints both to two significant digits (not 0.00%) in the readings and the sentence before naming the closer",
      tiny && !/^0\.00%$/.test(T.fo) && !/^0\.00%$/.test(T.pm) && /× 10⁻/.test(T.fo) && /× 10⁻/.test(T.pm) && T.say.includes(T.fo) && T.say.includes(T.pm) && /× 10⁻[⁰¹²³⁴⁵⁶⁷⁸⁹]+%/.test(T.say) && !/less than 0\.1%/.test(T.say) && /the closer of the two/.test(T.say),
      `gaps ${gFo[L].toExponential(2)} and ${gPm[L].toExponential(2)}; readings ${T.fo} and ${T.pm}; ${T.say}`);
  }
  // a drawing whose first-order bound is at or below 0 at every time drawn at full size (0.02 at 0, 0.05 at 0.1, 0.01 to
  // 2.4, 2 at 2.5), run through the worker as the page runs it: at full size no time has all three curves, so the gaps
  // are unavailable, not 0, and the sentence says they can't be computed; the smaller sizes still have gaps
  {
    const choice = { id: "draw", points: DRAW_TIMES.map((t, i) => (i === 0 ? 0.02 : i === 1 ? 0.05 : i === 25 ? 2 : 0.01)) }, cost = costOf(choice), c0 = avg(cost);
    const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "scale", choice, c0, eps: EPS, view: VIEW });
    const { u, gFo, gPm } = M.urgencies(m.t, m.b0, m.runs, cost, c0, EPS), d = { kind: "scale", t: m.t, c0, outside: false, u, gFo, gPm };
    const T0 = S.yoursText(d, EPS, 0), T1 = S.yoursText(d, EPS, 1), T2 = S.yoursText(d, EPS, 2);
    const shown = (T) => [T.fo, T.pm].every((x) => /^\d+(\.\d+)?%$/.test(x));
    const none = S.yoursSay(EPS, 0, [NaN, 0.2, NaN], [NaN, 0.1, NaN], [126, 40, 126], false, 126);
    check("yours", "a drawing with no time at full size where all three curves are defined (the worker's run): the full-size gaps are unavailable, not 0, in both readings and the sentence, with no count of 0 times; at both smaller sizes both readings are finite percents over their 80 and 124 common times, and the ranking stands; and with the smallest size unavailable too, neither urgency is ranked",
      u.map((x) => x.used).join() === "0,80,124" && Number.isNaN(gFo[0]) && Number.isNaN(gPm[0]) && T0.fo === "unavailable" && T0.pm === "unavailable" && T0.note === "no time drawn has all three curves defined"
      && /so the gaps can't be computed at that size/.test(T0.say) && !/by 0|0%|over the 0 of/.test(T0.say) && /not the closer of the two/.test(T0.say) && [1, 2].every((j) => Number.isFinite(gFo[j]) && Number.isFinite(gPm[j])) && shown(T1) && shown(T2)
      && T1.fo === S.gapShown(gFo[1]) && T2.pm === S.gapShown(gPm[2]) && /^of the constant cost's urgency, over the 80 of 126/.test(T1.note) && /^of the constant cost's urgency, over the 124 of 126/.test(T2.note)
      && /ranks neither urgency/.test(none) && !/closer/.test(none),
      `${u.map((x) => x.used).join(", ")} of 126 times; full ${T0.fo}, 25% ${T1.fo} and ${T1.pm}, 6.25% ${T2.fo} and ${T2.pm}; ${T0.say} | ${none}`);
  }
  // two drawings at 0.01 to 2.4, ending at 0.244631958 and at 0.24, run through the worker. At the smallest size, the
  // first pair agrees to the readings' two decimals (13.03%), so the readings and the sentence carry the digits that
  // tell them apart, and the ranking gives the measured margin as a result on this grid; the second pair (12.60% and
  // 12.85%) differs at two decimals, so it gets no extra digits and no such qualifier
  for (const [lastKnot, alike] of [[0.244631958, true], [0.24, false]]) {
    const choice = { id: "draw", points: DRAW_TIMES.map((t, i) => (i === 25 ? lastKnot : 0.01)) }, cost = costOf(choice), c0 = avg(cost);
    const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "scale", choice, c0, eps: EPS, view: VIEW });
    const { u, gFo, gPm } = M.urgencies(m.t, m.b0, m.runs, cost, c0, EPS), L = EPS.length - 1, d = { kind: "scale", t: m.t, c0, outside: false, u, gFo, gPm };
    const TL = S.yoursText(d, EPS, L), T0 = S.yoursText(d, EPS, 0);
    // the margin as the sentence prints it, read back as a number and held to the two worker gaps
    // the margin as the sentence prints it, against the string built here from the two worker gaps: two decimals of a
    // percent from 0.01% up, else a mantissa with one decimal times a power of ten (two significant digits)
    const mt = (TL.say.match(/, by ([^%]*)% of the constant cost's urgency/) || [])[1];
    const diff = 100 * Math.abs(gFo[L] - gPm[L]);
    const supOf = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    const want = diff >= 0.01 ? diff.toFixed(2) : (([m, e]) => `${m} × 10${String(+e).split("").map((c) => supOf[c]).join("")}`)(diff.toExponential(1).split("e"));
    const pairOk = TL.fo !== TL.pm && TL.fo === S.gapPair(gFo[L], gPm[L]).a && TL.pm === S.gapPair(gFo[L], gPm[L]).b
      && TL.say.includes(`by up to ${TL.fo} of the constant cost's urgency, and the per-moment urgency by up to ${TL.pm}`) && T0.say.includes(`the gaps are ${TL.fo} and ${TL.pm}`);
    const ok = alike
      ? S.gapShown(gFo[L]) === S.gapShown(gPm[L]) && pairOk && mt === want && /the two agree to two decimals of a percent, so the ranking rests on a difference measured on this grid/.test(TL.say)
      : S.gapShown(gFo[L]) !== S.gapShown(gPm[L]) && pairOk && TL.fo === S.gapShown(gFo[L]) && TL.pm === S.gapShown(gPm[L]) && mt === undefined && !/agree to two decimals|measured on this grid/.test(TL.say);
    check("yours", alike
      ? "a drawing ending at 0.244631958 (the worker's run): at the smallest size the two gaps agree to the readings' two decimals, so the readings and both sentences give one pair with the digits that tell them apart, and the ranking's printed margin is exactly the two worker gaps' difference at two significant digits, as built here, and is called a result on this grid"
      : "a drawing ending at 0.24 (the worker's run): at the smallest size the two gaps differ at the readings' two decimals (12.60% and 12.85%), so the readings and both sentences print that pair and the ranking carries no margin or precision qualifier",
      ok, `${gFo[L].toFixed(9)} and ${gPm[L].toFixed(9)}: readings ${TL.fo} and ${TL.pm}; margin ${mt ?? "none"} against ${want} (${diff.toExponential(3)}); ${TL.say}`);
  }
  {
    const tie = S.yoursSay(EPS, 2, [0.1, 0.01, 3e-9], [0.1, 0.01, 3e-9 + 1e-13]), apart = S.yoursSay(EPS, 2, [0.1, 0.01, 7.1e-9], [0.1, 0.01, 2.1e-7]);
    check("words", "two gaps equal to within 1e-12 are a tie, named as such; gaps of 7.1e-9 and 2.1e-7 print as 7.1 × 10⁻⁷% and 2.1 × 10⁻⁵% and name the first-order urgency as the closer",
      /neither urgency is the closer/.test(tie) && !/is the closer of the two|not the closer/.test(tie) && /7\.1 × 10⁻⁷%/.test(apart) && /2\.1 × 10⁻⁵%/.test(apart) && /is the closer of the two/.test(apart), `${tie} | ${apart}`);
  }
}

// ---- the self-test against main.tex -------------------------------------------------------------------------------------
{
  const tex = readFileSync(join(ROOT, "paper/main.tex"), "utf8").split("\n");
  const flat = (a, b) => tex.slice(a - 1, b).join(" ").replace(/\s+/g, " ");
  for (const it of S.ITEMS) check("novelty", `“${it.text}”: its phrase is in main.tex at lines ${it.lines[0]}–${it.lines[1]}`, flat(it.lines[0], it.lines[1]).includes(it.quote), it.quote);
  const count = (k) => S.ITEMS.filter((it) => it.key === k).length;
  check("novelty", "the key: the technique, the convolution form, the identities, and anticipation credited; the exact equation proved; the kernel, the infinite-horizon proof, and the rule new", count("credited") === 4 && count("proved") === 1 && count("new") === 3 &&
    ["technique", "convolution", "identities", "anticipation"].every((id) => S.ITEMS.find((it) => it.id === id).key === "credited") && S.ITEMS.find((it) => it.id === "exact").key === "proved", S.ITEMS.map((it) => `${it.id}: ${it.key}`).join(", "));
  const proved = S.ITEMS.filter((it) => it.proved).map((it) => it.id).sort().join();
  check("novelty", "the middle answer is “Proved here, not claimed as new”; the kernel, the theorem, and the rule answer “new” and say they are proved in the paper too", S.KINDS[1][1] === "Proved here, not claimed as new" && proved === "kernel,rule,theorem" &&
    S.ITEMS.filter((it) => it.proved).every((it) => /, and proved in the paper\./.test(S.answerText(it)) && !S.marksRight(it, "proved") && S.marksRight(it, "new")) && S.marksRight(S.ITEMS.find((it) => it.id === "identities"), "proved"), proved);
  const ant = S.ITEMS.find((it) => it.id === "anticipation"), ex = S.ITEMS.find((it) => it.id === "exact");
  check("novelty", "the anticipation item credits Drugowitsch and colleagues (2012) and Barendregt and colleagues (2022), both in its lines, and doesn't call a reward drop a change in the cost of time", /Drugowitsch/.test(ant.why) && /Barendregt/.test(ant.why) && !/cost of time/.test(ant.text) &&
    flat(ant.lines[0], ant.lines[1]).includes("drugowitsch2012") && flat(ant.lines[0], ant.lines[1]).includes("barendregt2022"), ant.text);
  check("novelty", "the exact equation's answer gives the paper's note, not a reason the paper doesn't state", !/because/.test(ex.why) && /symmetric infinite-horizon setting/.test(ex.why), ex.why);
  const all = S.ITEMS.map((it) => it.text + " " + S.answerText(it)).join(" ");
  check("novelty", "no statement or answer calls the rule fast or optimal, or drops the qualifier from a claim of novelty", !/\bfast\b|(?<!not )faster|\boptimal rule\b|\bfirst to\b/i.test(all) && S.ITEMS.filter((it) => it.key === "new").every((it) => /knowledge/.test(S.answerText(it))), "checked");
  // the paper's novelty sentences, in the paper's words: the exact equation is not among what they call new
  const intro = flat(195, 201), rel2 = flat(1136, 1143), smooth = flat(1170, 1172);
  check("novelty", "the paper's three sentences on what is new each say “to our knowledge” and none lists the exact equation", [intro, rel2, smooth].every((s) => /to our knowledge/.test(s.replace(/\s+/g, " ")) || /to our\s+knowledge/.test(s)) && ![intro, rel2, smooth].some((s) => /exact equation[^.]*new/.test(s)), "lines 195–201, 1136–1143, 1170–1172");
}

{
  const text = readFileSync(join(ROOT, "book/content/ch12.py"), "utf8");
  const gone = ["fit to one observer", "no one has run", "summed exactly", "falls at every frequency", "rises toward $45^\\circ$", "because Campbell", "the drift, the noise, and the bound", "drift, noise, and bound", "A test needs", "Every result of the paper that the book quotes", "The book reads every number", "the bound at that moment is the average"];
  const left = gone.filter((g) => text.includes(g));
  check("words", "the chapter's text drops the phrasings the audits found too strong", left.length === 0, left.length ? left.join("; ") : `${gone.length} phrases absent`);
  const kept = ["mean observer's fit", "the noise fixed at variance 1 per second", "could test it", "background, not in the paper", "relative tolerance of $10^{-5}$", "proved in the paper but not claimed as new", "fixed-kernel approximation", "at frequencies sampled from 0.05 to 3,000", "cut off after at most 4,000 terms"];
  const missing = kept.filter((k) => !text.includes(k));
  check("words", "the chapter's text carries the audits' corrections (the mean observer, the fixed noise, could, the background note, the typed tolerance, the categories, the approximation, the sampled range, the cutoff)", missing.length === 0, missing.length ? missing.join("; ") : `${kept.length} phrases present`);
  check("words", "the caption's 4,000-term cutoff is the code's", /export function excessMean\(a, c0, terms = 4000\)/.test(readFileSync(join(ROOT, "book/assets/js/ch12-model.js"), "utf8")) && /terms = 4000/.test(K.meanLookAhead.toString()), "excessMean and meanLookAhead default to 4,000 terms");
  const tex = readFileSync(join(ROOT, "paper/main.tex"), "utf8").split("\n").slice(1078, 1080).join(" ");
  check("words", "the typed tolerance the text quotes is in main.tex (line 1079, Section 7.2)", /relative tolerance of \$10\^\{-5\}\$/.test(tex), tex.slice(0, 90));
  check("words", "the degree axis holds every guess the slider allows (0 to 90 degrees)", [0, 30, 50, 51, 75, 90].every((g) => M.degreeAxisTop(g) >= g) && M.degreeAxisTop(NaN) === 50 && M.degreeAxisTop(40) === 50, [0, 50, 51, 90].map((g) => M.degreeAxisTop(g)).join(", "));
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
      S.waveSay(c, 10 ** (3 * u() - 1), 50 * u(), u(), u(), m), S.gateSay(i % 7 ? 3 * u() : NaN, i % 2 ? 1 : -1), S.mirrorSay(c, K.B(c)), S.mirrorWaveSay(c, 40 * u()), S.linearSay(c, m),
      S.phaseSay(c, { lead: 44 + 3 * u(), omega: 10 ** (4 * u()) }, m), S.yoursSay(EPS, i % 3, gF, gP, [0, i % 2 ? 0 : 7, 0], i % 5 === 0, 126), S.overTimes(100 + (i % 27), 126), S.outsideNote(["deadline", "constant", "rising"][i % 3]),
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
  const ys = S.yoursSay(EPS, 0, [0.5, 0.1, 0.02], [0.3, 0.08, 0.03], [33, 0, 0], true, 126);
  const big = S.yoursSay(EPS, 0, [84, 0.2, 0.007], [0.12, 0.03, 0.008]);
  check("words", "the schedule sentence calls the first order the closer only when its gap is smaller, flags the rising cost and gaps, and writes a gap over 100% as a multiple", /is the closer of the two/.test(ys) && /outside the theorem/.test(ys) && /leaves a gap/.test(ys) && /not the closer/.test(S.yoursSay(EPS, 0, [0.5, 0.1, 0.05], [0.3, 0.08, 0.03])) && /84\.0 times the constant cost's urgency/.test(big) && !/\d{3,}%/.test(big), big);
  const nv = S.noveltyVerdict({ technique: "new", convolution: "credited", exact: "proved", identities: "proved" });
  check("words", "the self-test verdict counts the right marks (the identities accept both answers) and flags a credited statement marked new", /^3 of your 4 marks/.test(nv) && /One statement you marked new/.test(nv), nv);
}
