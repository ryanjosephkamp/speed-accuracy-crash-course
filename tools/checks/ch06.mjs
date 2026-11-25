// Chapter 6: the kernel, its series and transform, the start law and the sampler, the bracketing gap, the page's
// dynamic program against the paper's (Table 1), and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, boundForCost, OVERSHOOT } from "../../book/assets/js/model.js";
import { VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import { costOf, PRESETS, defaultDrawing } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch06.js";
import { SCALE, scaleJob, scaleGaps, YOURS_EPS, yoursPlateState, yoursMode, errorRange, errorMarks, yoursVerdict, predictView, responseChart } from "../../book/assets/js/ch06-model.js";
import { frame } from "../../book/assets/js/chart.js";
import { check, N, SIN, asPrinted, runWorker } from "./lib.mjs";

// ---- the constant-cost bound ------------------------------------------------------------------------------
for (const c of [0.02, 0.1, 0.5, 2]) {
  const b = K.B(c);
  check("kernel", `B(${c}) solves sinh 2b + 2b = 1/c`, Math.abs(Math.sinh(2 * b) + 2 * b - 1 / c) / (1 / c) < 1e-5, `residual ${(Math.sinh(2 * b) + 2 * b - 1 / c).toExponential(1)}`);
  const h = 1e-5 * c, fd = (K.B(c + h) - K.B(c - h)) / (2 * h);
  check("kernel", `B'(${c}) = -1/(4c^2 cosh^2 B) against a difference quotient`, Math.abs(fd - K.Bprime(c)) / Math.abs(K.Bprime(c)) < 2e-3, `${K.Bprime(c).toFixed(5)} vs ${fd.toFixed(5)}`);
}
check("kernel", "BoundTenth", asPrinted(K.B(0.1), N.BoundTenth), `${K.B(0.1).toFixed(4)} vs ${N.BoundTenth}`);
check("kernel", "DecisionTimeTenth: b tanh b at 0.1", asPrinted(K.meanDecisionTime(0.1), N.DecisionTimeTenth), `${K.meanDecisionTime(0.1).toFixed(4)} vs ${N.DecisionTimeTenth}`);

// ---- the kernel: series, flux, normalization ----------------------------------------------------------------
for (const c of [0.02, 0.1, 0.5]) {
  const b = K.B(c);
  check("kernel", `the flux's closed-form total, tanh b0 + b0 sech^2 b0, is 1/(2 c0 cosh^2 b0) at c0 = ${c}`, Math.abs(K.fluxTotal(b) - 1 / (2 * c * Math.cosh(b) ** 2)) < 1e-5, `${K.fluxTotal(b).toFixed(6)} vs ${(1 / (2 * c * Math.cosh(b) ** 2)).toFixed(6)}`);
  const integ = K.kernelMass(0, 80, b, 20000) * K.fluxTotal(b);   // kernelMass divides by the closed-form total
  check("kernel", `the flux series, integrated term by term over (0, 80), equals that total at c0 = ${c} (within 1e-4)`, Math.abs(integ - K.fluxTotal(b)) < 1e-4, `${integ.toFixed(6)} vs ${K.fluxTotal(b).toFixed(6)}`);
  const { w } = K.kernelBins(c);
  const tot = w.reduce((a, v) => a + v, 0);
  check("kernel", `the kernel's bins telescope to 1 at c0 = ${c} (by construction; the next check tests a bin)`, Math.abs(tot - 1) < 1e-9, `sum ${tot.toFixed(12)}`);
  { const kb = K.kernelBins(c), m0 = kb.w[0], want = K.kernelMass(0, kb.edges[1], b, 200000);
    check("kernel", `the kernel's first bin holds the series' mass over its interval at c0 = ${c} (within 1e-5, the direct sum's truncation)`, Math.abs(m0 - want) < 1e-5, `${m0.toFixed(6)} vs ${want.toFixed(6)}`); }
  check("starts", `pi_0 integrates to 1 at c0 = ${c}`, Math.abs(K.pi0Cdf(b, c) - 1) < 1e-6, `${K.pi0Cdf(b, c).toFixed(8)}`);
}
{
  const b = K.B(0.1);
  for (const s of [0.05, 0.2, 0.5, 1.5]) {
    const h = 1e-5, d = -(K.survival(b, s, b) - K.survival(b - h, s, b)) / h;
    check("survival", `n(${s}) from the series equals minus the slope of P_x(tau_0 > s) at the bound`, Math.abs(d - K.flux(s, b)) / K.flux(s, b) < 1e-3, `${K.flux(s, b).toFixed(5)} vs ${d.toFixed(5)}`);
  }
  check("survival", "P_x(tau_0 > s) is 1 inside the bound as s -> 0", Math.abs(K.survival(0, 0.002, b) - 1) < 1e-6, K.survival(0, 0.002, b).toFixed(8));
}

// ---- the transform, the transfer function, and the look-ahead ---------------------------------------------------
for (const l of [0.5, 1, 2, 5, 10, 20]) {
  const a = K.transform(l, 0.1), s = K.transformSeries(l, 0.1);
  check("transform", `closed-form transform equals the series at lambda = ${l}`, Math.abs(a - s) < 1e-5, `${a.toFixed(6)} vs ${s.toFixed(6)}`);
}
check("transform", "the transform is within 1e-6 of 1 at lambda = 1e-9 (its value at 0)", Math.abs(K.transform(1e-9, 0.1) - 1) < 1e-6, K.transform(1e-9, 0.1).toFixed(8));
for (const row of SIN) {
  const [om, gain, lead] = row;
  const t = K.transfer(0.1, om);
  check("transform", `Table (sinusoid), closed form at omega = ${om}: swing ${gain}, lead ${lead}`, t.gain.toFixed(3) === gain.toFixed(3) && t.lead.toFixed(1) === lead.toFixed(1), `${t.gain.toFixed(3)}, ${t.lead.toFixed(1)}`);
}
check("sketch", "LookAheadTenth: the mean look-ahead at c0 = 0.1", asPrinted(K.meanLookAhead(0.1), N.LookAheadTenth), `${K.meanLookAhead(0.1).toFixed(4)} vs ${N.LookAheadTenth}`);
{
  let best = [0, 0];
  for (let lc = Math.log(0.005); lc < Math.log(0.5); lc += 0.0005) { const m = K.meanLookAhead(Math.exp(lc)); if (m > best[1]) best = [Math.exp(lc), m]; }
  check("sketch", "MaxLookAhead and MaxLookAheadCost", asPrinted(best[1], N.MaxLookAhead) && asPrinted(best[0], N.MaxLookAheadCost), `${best[1].toFixed(4)} at ${best[0].toFixed(4)} vs ${N.MaxLookAhead} at ${N.MaxLookAheadCost}`);
  const dm = -(K.transform(1e-4, 0.1) - 1) / 1e-4;
  check("sketch", "the mean look-ahead equals minus the transform's slope at 0", Math.abs(dm - K.meanLookAhead(0.1)) < 1e-3, `${dm.toFixed(5)} vs ${K.meanLookAhead(0.1).toFixed(5)}`);
}

// ---- the sampler ------------------------------------------------------------------------------------------
{
  const all = [];
  for (let s = 0; s < 10; s++) all.push(...K.sampleDecisionTimes(0.1, 4000, 1000 + s));
  const m = all.reduce((a, x) => a + x) / all.length, sd = Math.sqrt(all.reduce((a, x) => a + (x - m) ** 2, 0) / all.length), se = sd / Math.sqrt(all.length);
  check("starts", "decision times from pi_0 (40,000 runs) average the kernel's mean within 3 standard errors", Math.abs(m - K.meanLookAhead(0.1)) < 3 * se, `${m.toFixed(4)} ± ${se.toFixed(4)} vs ${K.meanLookAhead(0.1).toFixed(4)}`);
  for (const l of [1, 4]) {
    let a = 0, q = 0; for (const t of all) { const v = Math.exp(-l * t); a += v; q += v * v; }
    a /= all.length; const e = Math.sqrt((q / all.length - a * a) / all.length);
    check("transform", `sampled E exp(-${l} tau) matches the transform within 3 standard errors`, Math.abs(a - K.transform(l, 0.1)) < 3 * e, `${a.toFixed(4)} ± ${e.toFixed(4)} vs ${K.transform(l, 0.1).toFixed(4)}`);
  }
}
{
  const c0 = 0.1, b0 = K.B(c0);
  for (const eps of [0.1, 0.01, 0.001]) {
    const g = (b0 + eps) * Math.tanh(b0 + eps) - (b0 - eps) * Math.tanh(b0 - eps);
    check("bracket", `expected gap / eps tends to 2 (tanh b0 + b0 sech^2 b0), eps = ${eps}`, Math.abs(g / eps - 2 * K.fluxTotal(b0)) < 2 * eps, `${(g / eps).toFixed(5)} vs ${(2 * K.fluxTotal(b0)).toFixed(5)}`);
  }
}

// ---- the dynamic program ----------------------------------------------------------------------------------
for (const row of SIN) {
  const [om, , , gainDP, leadDP] = row;
  const c0 = 0.1, eps = 0.01, period = (2 * Math.PI) / om, L = period * Math.max(2, Math.ceil(6 / period)), H = 2 + L + 6;
  const base = exactPolicy(() => c0, H), pert = exactPolicy((t) => c0 + eps * Math.sin(om * t), H);
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
  for (let k = 0; k < base.ts.length; k++) {
    const t = base.ts[k]; if (t <= 2 || t >= 2 + L) continue;
    const d = pert.bounds[k] - base.bounds[k], r = [Math.sin(om * t), Math.cos(om * t), 1];
    for (let i = 0; i < 3; i++) { y[i] += r[i] * d; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; }
  }
  const M = A.map((r, i) => [...r, y[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < 3; r++) { if (r === i) continue; const f = M[r][i] / M[i][i]; for (let c = i; c <= 3; c++) M[r][c] -= f * M[i][c]; } }
  const [a, bb] = M.map((r, i) => r[3] / r[i]);
  const pm = Math.abs(K.Bprime(c0)) * eps, gain = Math.hypot(a, bb) / pm, lead = (Math.atan2(-bb, -a) * 180) / Math.PI;
  check("scale", `the page's program against the paper's at omega = ${om} (swing within 0.01, lead within 1 degree)`, Math.abs(gain - gainDP) < 0.01 && Math.abs(lead - leadDP) < 1, `${gain.toFixed(3)}, ${lead.toFixed(1)} vs ${gainDP}, ${leadDP}`);
}

// ---- the sentences ----------------------------------------------------------------------------------------
{
  const R = K.rng(5);
  let bad = 0, n = 0;
  for (let i = 0; i < 2000; i++) {
    const say = [
      S.scaleSay(0.1 * (1 + R.next()), R.next() * 0.1, R.next(), [R.next(), R.next() * 0.5, R.next() * 0.2, R.next() * 0.1], [0.8, 0.4, 0.2, 0.1]),
      S.sketchSay(R.next(), i % 3 ? R.next() * 2 : NaN, R.next(), R.next(), 1 + R.next()),
      S.startsVerdict(["zero", "spread", "bound"][i % 3], R.next(), 0.1, 1.17, 0.546),
      S.bracketSay(R.next() * 0.3, R.next(), R.next()),
      S.errorsVerdict({ pm: i % 4 === 0 ? null : i % 3, fo: i % 4 === 0 ? null : (i + 1) % 3 },
        [R.next(), R.next() * 0.5, R.next() * 0.2], [R.next() * 0.1, R.next() * 0.05, i % 9 ? R.next() * 0.01 : 0], [1, 0.5, 0.25], i % 6 === 0),
      S.zText((R.next() - 0.5) * 8),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  check("words", "the gap sentence, for a gap over 2 standard errors, gives the one-in-twenty chance of a gap over 2 under its stated assumptions, and doesn't flag 1.5", /if the sampling error were normal and the runs unbiased, a gap over 2 would come about one time in twenty/.test(S.zText(3)) && !/twenty/.test(S.zText(1.5)), S.zText(3));
}


// ---- the plate "Shrink the change", through the page's own worker job and gap calculation -------------------------
{
  const m = await runWorker("../../book/assets/js/dp-worker.js", scaleJob()), EPS = SCALE.eps;
  const n = Math.round(SCALE.view / 0.02) + 1;
  const full = !!(m && m.ok && m.t.length === n && m.t.every((x, i) => Math.abs(x - 0.02 * i) < 1e-9) && m.b0.length === n && m.b0.every(Number.isFinite)
    && m.runs.length === EPS.length && m.runs.every((r) => r.length === n && r.every(Number.isFinite)));
  // the baseline is model.js's program at the constant cost 0.1, and each run its program for 0.1 (1 + eps sin 2t), at the
  // same times, bit for bit
  const P0 = exactPolicy(() => SCALE.c0, SCALE.view + SPARE), at = (P, i) => P.bounds[Math.round(m.t[i] / 0.01)];
  const Pk = EPS.map((e) => exactPolicy((t) => SCALE.c0 + e * SCALE.amp * Math.sin(SCALE.omega * t), SCALE.view + SPARE));
  const same = full && m.b0.every((v, i) => v === at(P0, i)) && EPS.every((e, k) => m.runs[k].every((v, i) => v === at(Pk[k], i)));
  check("scale", `the fixed sinusoid: the worker returns the ${n} times 0, 0.02, ..., ${SCALE.view}, its constant-cost baseline, and the four selectable sizes (80%, 40%, 20%, 10%), the baseline equal to model.js's program at the constant cost 0.1 and each size to its program for 0.1 (1 + ε sin 2t), at every one of those times`,
    full && same, m ? `${m.t.length} times, last ${m.t[m.t.length - 1]}, ${m.runs.length} runs` : "no reply");
  const G = full ? scaleGaps(m) : null;
  // the gaps again, from model.js's paired programs directly (each size's run against the constant-cost run), at the
  // window's times 0.5, 0.52, ..., 3.5
  const tw = Array.from({ length: 151 }, (_, j) => 0.5 + 0.02 * j), gamma = (t) => SCALE.amp * Math.sin(SCALE.omega * t);
  const bw = K.firstOrder(gamma, tw, SCALE.c0), pw = K.perMomentResponse(gamma, tw, SCALE.c0);
  const own = EPS.map((e, k) => { const d = tw.map((t) => (Pk[k].bounds[Math.round(t / 0.01)] - P0.bounds[Math.round(t / 0.01)]) / e); return [Math.max(...d.map((v, j) => Math.abs(v - bw[j]))), Math.max(...d.map((v, j) => Math.abs(v - pw[j])))]; });
  check("scale", "the fixed sinusoid: the plate's gaps at each size, to β and to the per-moment response, equal those recomputed from model.js's paired programs at the 151 times from 0.5 to 3.5 (within 1e-12)",
    G && own.every(([f, q], k) => Math.abs(f - G.gFo[k]) < 1e-12 && Math.abs(q - G.gPm[k]) < 1e-12), own.map(([f, q]) => `${f.toFixed(4)}, ${q.toFixed(4)}`).join("; "));
  const win = G && G.win.length === 151 && G.t[G.win[0]] === 0.5 && Math.abs(G.t[G.win[150]] - 3.5) < 1e-9 && G.t.every((x, i) => (x >= 0.5 && x <= 3.5) === G.win.includes(i));
  const shrink = G && G.gFo.every((g, k) => Number.isFinite(g) && (k === 0 || g < G.gFo[k - 1])) && G.gPm.every((g, k) => Number.isFinite(g) && g > G.gFo[k]);
  check("scale", "the fixed sinusoid's gaps, over the plate's window (the 151 times from 0.5 to 3.5): the gap to β falls at each of the four sizes from 80% to 10%, and the gap to the per-moment response is larger than the gap to β at every size",
    win && shrink, G ? `to β: ${G.gFo.map((g) => g.toFixed(4)).join(", ")}; to the per-moment response: ${G.gPm.map((g) => g.toFixed(4)).join(", ")}` : "no gaps");
  // the sentence at each selectable size prints these gaps
  const f3 = (x) => x.toFixed(3), lo = G && Math.min(...G.gPm), hi = G && Math.max(...G.gPm);
  const says = G ? EPS.map((e, k) => S.scaleSay(e, G.gFo[k], G.gPm[k], G.gFo, EPS, G.gPm)) : [];
  check("words", "the fixed sinusoid's sentence, at each of the four sizes, prints that size's two gaps and the run of gaps from 80% to 10% as the plate measures them",
    says.length === 4 && says.every((x, k) => x.includes(`within ${f3(G.gFo[k])} of β and ${f3(G.gPm[k])} of the per-moment response`)
      && x.includes(`the gap to β shrinks from ${f3(G.gFo[0])} to ${f3(G.gFo[3])}, while the gap to the per-moment response stays between ${f3(lo)} and ${f3(hi)}.`)), says[3] ?? "");
}

// ---- the plate "Your schedule, scaled down", through the page's own worker job, error calculation, and state ---------
{
  const EPS = YOURS_EPS;
  // a selection as the plate makes it: its job (or none), the worker's reply, and the plate's state after the reply
  const solveOn = async (choice) => {
    const P = yoursPlateState(), { my, job } = P.select(choice);
    const m = job ? await runWorker("../../book/assets/js/dp-worker.js", job) : null;
    if (m) P.take(my, m);
    return { P, m, job };
  };
  const want = Array.from({ length: 126 }, (_, i) => 0.02 * i);
  const complete = (m) => !!(m && m.ok && m.t.length === want.length && m.t.every((x, i) => Math.abs(x - want[i]) < 1e-9) && m.b0.length === want.length && m.b0.every(Number.isFinite)
    && m.runs.length === EPS.length && m.runs.every((r) => r.length === want.length && r.every(Number.isFinite)));
  const cases = [...PRESETS.filter((p) => !["deadline", "constant"].includes(p.id))
    .map((p) => ({ id: p.id, choice: { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) } })),
    { id: "draw (the default drawing)", choice: { id: "draw", points: defaultDrawing() } },
    { id: "Smooth at middle cost 0.02, size 0.05", choice: { id: "smooth", params: { c0: 0.02, size: 0.05 } } },
    { id: "Smooth at middle cost 0.5, size 0.05", choice: { id: "smooth", params: { c0: 0.5, size: 0.05 } } }];
  for (const c of cases) {
    const { P, m } = await solveOn(c.choice), d = P.state.data, ok = complete(m);
    check("yours", `${c.id}: the worker returns the 126 times 0, 0.02, ..., 2.5, a finite constant-cost run, and exactly six finite runs of the same length`, ok, m ? `${m.t.length} times, last ${m.t[m.t.length - 1]}, ${m.runs.length} runs` : "no reply");
    // the comparisons counted from the paired raw errors, not through the verdict's helper
    const smaller = d ? EPS.filter((_, k) => d.ePm[k] > 0 && d.eFo[k] > 0 && d.eFo[k] < d.ePm[k]).length : -1;
    P.show();
    const b = P.bottom(), say = d ? S.errorsVerdict({ pm: null, fo: null }, d.ePm, d.eFo, EPS, d.outside) : "";
    const claimed = /^At every size/.test(say), count = say.match(/^The first-order error is the smaller of the two at (\d+) of the 6 sizes/);
    check("yours", `${c.id}: with that reply, the plate's state (yoursPlateState, not the page's drawing) reports the revealed chart as shown on an ordered range, and the verdict's comparison matches the count from the paired errors (every size, or the count it prints)`,
      ok && d && !b.hidden && b.range[0] < b.range[1] && (smaller === EPS.length ? claimed : !claimed && count && +count[1] === smaller) && !/slope of|like ε²\)|not at all/.test(say),
      `first-order smaller at ${smaller} of ${EPS.length} sizes; range ${b.range ? b.range.map((v) => v.toExponential(1)).join(" to ") : "none"}`);
  }
  // nearly flat drawings: 2 to 1.99999 (every error below 1e-7), 2 to 1.9999622 (the largest just below it), and 2 to
  // 1.9999 (the largest above it)
  const flat = (d) => ({ id: "draw", points: Array.from({ length: 26 }, (_, i) => 2 - (d * i) / 25) });
  const printed = (say) => { const q = say.match(/the largest is (\d\.\d\de-\d+), rounded down/); return q ? +q[1] : NaN; };
  const n5 = await solveOn(flat(1e-5)), n6 = await solveOn(flat(3.78e-5)), n4 = await solveOn(flat(1e-4));
  n5.P.show(); n6.P.show(); n4.P.show();
  const b5 = n5.P.bottom(), b6 = n6.P.bottom(), b4 = n4.P.bottom(), d4 = n4.P.state.data, small4 = d4 ? [...d4.ePm, ...d4.eFo].filter((v) => v > 0 && v < 1e-7).length : 0;
  const s5 = S.tooSmallSay(b5.largest), s6 = S.tooSmallSay(b6.largest);
  const fair = (say, x) => printed(say) <= x && printed(say) > x * 0.99 && printed(say) < 1e-7;
  check("yours", "the plate's state on revealed, nearly flat drawings (2 to 1.99999, and 2 to 1.9999622, whose largest error is just below 1e-7): it reports the bottom chart hidden, and the sentence prints the largest error rounded down, below 1e-7, and says the chart opens only when one error reaches 1e-7",
    complete(n5.m) && complete(n6.m) && n5.P.state.reveal && b5.hidden && b5.range === null && b6.hidden && b6.largest > 9.9e-8 && b6.largest < 1e-7
      && fair(s5, b5.largest) && fair(s6, b6.largest) && [s5, s6].every((x) => /The log chart opens only when at least one error reaches 10⁻⁷/.test(x)),
    `largest errors ${b5.largest.toExponential(4)} and ${b6.largest.toExponential(4)}; ${s6}`);
  check("yours", "the plate's state on a revealed drawing from 2 to 1.9999: one error reaches 1e-7, so it reports the chart shown, with a range that holds the errors below 1e-7 too (the threshold is on the largest, not on each error)",
    complete(n4.m) && !b4.hidden && b4.largest >= 1e-7 && small4 > 0 && b4.range[0] < Math.min(...d4.ePm, ...d4.eFo),
    `largest ${b4.largest.toExponential(2)}, ${small4} errors below 1e-7, range from ${b4.range?.[0].toExponential(2)}`);
  // a drawing that moves only from 2 to 1.999999999 moves all the same: the plate's state solves it in theory mode, and
  // only a cost constant by value (Constant, a flat drawing, Smooth at size 0) is skipped as one that doesn't change
  const tiny = await solveOn(flat(1e-9)), bt = (tiny.P.show(), tiny.P.bottom());
  const skipped = [{ id: "constant", params: { c: 0.1 } }, flat(0), { id: "smooth", params: { c0: 0.1, size: 0 } }].map((c) => yoursMode(c).mode);
  check("yours", "a drawing from 2 to 1.999999999: the plate's state enters theory mode, the worker's reply is complete, and the revealed chart is reported hidden below 1e-7; Constant, a flat drawing, and Smooth at size 0 are the ones skipped as not changing",
    tiny.P.state.mode === "theory" && tiny.job && complete(tiny.m) && bt.hidden && bt.largest < 1e-7 && skipped.every((x) => x === "constant") && /doesn't change/.test(S.outsideNote("constant")),
    `mode ${tiny.P.state.mode}, largest error ${bt.largest.toExponential(2)}; skipped as ${skipped.join(", ")}`);
  // the prediction box the page shows for each mode (predictView, which the page's setPredict applies): the two theory
  // questions for the tiny drawing, the prompt without questions for Rising, and no box for skipped selections
  const views = Object.fromEntries([["tiny", tiny.P.state.mode], ["rising", yoursMode({ id: "rising" }).mode], ["constant", yoursMode({ id: "constant" }).mode], ["flat", yoursMode(flat(0)).mode], ["deadline", yoursMode({ id: "deadline" }).mode]].map(([k, mode]) => [k, predictView(mode)]));
  check("yours", "the prediction box's contents by mode (predictView, which the page applies): the tiny drawing gets the box with both theory questions, Rising the box with its measurement prompt and no questions, and Constant, a flat drawing, and a deadline no box",
    views.tiny.box && views.tiny.questions && /how fast does the theory say/.test(views.tiny.prompt) && views.rising.box && !views.rising.questions && /outside the theorem/.test(views.rising.prompt)
      && ["constant", "flat", "deadline"].every((k) => !views[k].box && !views[k].questions),
    Object.entries(views).map(([k, v]) => `${k}: box ${v.box}, questions ${v.questions}`).join("; "));
  // on reveal below the chart's threshold, the verdict still answers the theory question and grades the guesses
  const td = tiny.P.state.data, vRight = yoursVerdict(bt, td, { pm: 1, fo: 2 }), vWrong = yoursVerdict(bt, td, { pm: 0, fo: 1 }), vNone = yoursVerdict(bt, td, { pm: null, fo: null });
  const theory = /the per-moment error tends to a function of time that is not identically zero .* so over all times it is of order ε; the corrected one is at most of order ε²/;
  check("yours", "the verdict the page prints on reveal (yoursVerdict), for the tiny drawing below the chart's threshold: it grades the guesses (both right, both wrong) and gives the theory's answer, then the largest error and why there is no chart; with no guess, the theory's answer without a grade",
    /^Both guesses match the theory\. /.test(vRight) && /^Neither guess matches the theory\. /.test(vWrong) && [vRight, vWrong, vNone].every((v) => theory.test(v) && /Every error here is below 10⁻⁷: the largest is/.test(v)) && !/guess/.test(vNone),
    vRight);
  // the top chart for the tiny drawing at each size (responseChart, 360 pixels): its range follows the response, so the
  // three curves don't collapse onto one line, and its tick labels are all different
  const tops = YOURS_EPS.map((_, k) => {
    const { f, g } = responseChart({ clientWidth: 360 }, td, k);
    const ys = (cls) => ((g.match(new RegExp(`class="${cls}" d="([^"]+)"`)) || [])[1] || "").match(/[ML][^ML]+/g).map((q) => +q.slice(1).split(" ")[1]);
    const [pm, wb, ex] = ["pm", "wb", "ex"].map(ys), labels = [...g.matchAll(/class="tk"[^>]*text-anchor="end">([^<]+)<\/text>/g)].map((q) => q[1]);
    const spread = (a) => Math.max(...a) - Math.min(...a);
    return { ok: [pm, wb, ex].every((a) => a.length === td.t.length && spread(a) > 50) && labels.length >= 3 && new Set(labels).size === labels.length, text: `ticks ${labels.join(" | ")}; the curves span ${[pm, wb, ex].map(spread).map((v) => v.toFixed(0)).join(", ")} px` };
  });
  check("yours", "the top chart as responseChart builds it for the plate (360 pixels), on the tiny drawing at each of the six sizes: each of the three curves spans more than 50 pixels of the chart's height, and the vertical axis has at least three ticks, no two labeled the same",
    tops.every((x) => x.ok), tops[YOURS_EPS.length - 1].text);
  // a stale reply: a selection that solves, then a switch to one the plate skips before the reply arrives; the state is
  // read right after the reply is delivered
  const P = yoursPlateState();
  const first = P.select({ id: "smooth", params: { c0: 0.1, size: 1 } }), skip = P.select({ id: "constant", params: { c: 0.1 } });
  P.show();
  const late = await runWorker("../../book/assets/js/dp-worker.js", first.job), kept = P.take(first.my, late);
  const now = { data: P.state.data, mode: P.state.mode, bottom: P.bottom() };
  check("yours", "the plate's state: a reply that arrives after a switch to a skipped selection (Constant) is dropped; right after it is delivered, with the chart revealed, the state holds no data, stays on Constant, and reports the chart hidden",
    first.job && skip.job === null && !kept && now.data === null && now.mode === "constant" && now.bottom.hidden,
    `reply kept: ${kept}; mode ${now.mode}; chart hidden: ${now.bottom.hidden}`);
  const v = S.errorsVerdict({ pm: null, fo: null }, [1e-2, 5e-3], [1e-3, 3e-4], [1, 0.5], true);
  check("words", "on the rising cost, the verdict calls the errors measurements and says the theorem doesn't cover it", /says nothing about it/.test(v) && /measurements/.test(v) && !/O\(ε²\)\./.test(v), v);
  const th = S.errorsVerdict({ pm: 1, fo: 2 }, [1e-2, 5e-3], [1e-3, 3e-4], [1, 0.5], false);
  check("words", "inside the theorem, the verdict says the per-moment limit is not identically zero over all times, and names the window the chart measures", /not identically zero over all times t ≥ 0/.test(th) && /only at the times from 0 to 2\.5/.test(th), th);
}

// ---- the error chart's guides keep their slope when clipped, and each label marks its own guide ------------------------
{
  const seg = S.guideInRange(1, 1e-2, 2, 1 / 32, 1, 1e-4, 1);
  const slope = seg ? Math.log(seg[1][1] / seg[1][0]) / Math.log(seg[0][1] / seg[0][0]) : NaN;
  check("yours", "a slope-2 guide clipped to the plot keeps slope 2 and stays inside it (a helper test)", seg && Math.abs(slope - 2) < 1e-12 && seg[1].every((y) => y >= 1e-4 * (1 - 1e-12) && y <= 1), `slope ${slope}, from ${seg?.[0].map((x) => x.toExponential(2)).join(" to ")}`);
  // the bottom chart's marks as the plate draws them, 420 pixels wide, on the drawing from 2 to 1.9999: each label sits
  // at the left end of its own clipped guide; and on made-up errors that leave the slope-1 guide outside, no label
  const { P } = await (async () => { const P = yoursPlateState(), { my, job } = P.select({ id: "draw", points: Array.from({ length: 26 }, (_, i) => 2 - (1e-4 * i) / 25) }); P.take(my, await runWorker("../../book/assets/js/dp-worker.js", job)); P.show(); return { P }; })();
  const marks = (ePm, eFo, range) => {
    const f = frame({ clientWidth: 420 }, { x: [YOURS_EPS[YOURS_EPS.length - 1] / 1.3, 1.3], y: range, xlog: true, ylog: true, aspect: 0.5, minH: 180, maxH: 280 });
    const g = errorMarks(f, YOURS_EPS, ePm, eFo);
    const guides = [...g.matchAll(/class="guide" d="([^"]+)"/g)].map((q) => q[1].match(/[ML][^ML]+/g).map((p) => p.slice(1).split(" ").map(Number)));
    const labels = [...g.matchAll(/<text class="tk" x="([\d.]+)" y="([\d.]+)">slope (\d)<\/text>/g)].map((q) => ({ x: +q[1], y: +q[2], p: +q[3] }));
    return { f, guides, labels };
  };
  const d = P.state.data, b = P.bottom(), real = marks(d.ePm, d.eFo, b.range);
  const at = (L, gd) => gd && Math.abs(L.x - Math.min(gd[0][0] + 4, real.f.W - real.f.r - 44)) < 0.06 && Math.abs(L.y - Math.max(real.f.t + 10, Math.min(real.f.H - real.f.b - 4, gd[0][1] + (L.p === 2 ? 14 : -6)))) < 0.11;
  const placed = real.labels.length === real.guides.length && real.labels.every((L, i) => at(L, real.guides[i]));
  // each guide's exponent, from its two drawn endpoints read back through the chart's log scales; the SVG rounds to
  // 0.1 pixel, so it must match the label to 0.01
  const exponent = (gd) => { const [a, b] = [gd[0], gd[gd.length - 1]].map(([x, y]) => [real.f.ix(x), real.f.iy(y)]); return Math.log(b[1] / a[1]) / Math.log(b[0] / a[0]); };
  const slopes = real.guides.map(exponent);
  const none = marks([1e-2, 5e-3, 2.5e-3, 1.2e-3, 6e-4, 3e-4], [1e-9, 1e-9, 1e-9, 1e-9, 1e-9, 1e-9], [3e-10, 3e-8]);
  check("yours", "the error chart's marks from errorMarks, the function the plate draws them with (420 pixels, the drawing from 2 to 1.9999): both guides are drawn, their exponents read from their endpoints are 1 and 2 (within 0.01), each labeled with its own slope at the left end of its clipped segment; guides wholly outside the plot are omitted, path and label",
    real.guides.length === 2 && real.labels.length === 2 && real.labels.every((L, i) => Math.abs(slopes[i] - L.p) < 0.01) && real.labels[0].p === 1 && real.labels[1].p === 2 && placed && none.guides.length === 0 && none.labels.length === 0,
    `${real.guides.length} guides, exponents ${slopes.map((v) => v.toFixed(5)).join(" and ")}, labels ${real.labels.map((L) => `slope ${L.p} at (${L.x}, ${L.y})`).join(", ")}`);
}
