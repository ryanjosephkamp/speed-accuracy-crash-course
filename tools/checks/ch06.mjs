// Chapter 6: the kernel, its series and transform, the start law and the sampler, the bracketing gap, the page's
// dynamic program against the paper's (Table 1), and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, boundForCost, OVERSHOOT } from "../../book/assets/js/model.js";
import { VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import { costOf, PRESETS, defaultDrawing } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch06.js";
import { yoursErrors, errorRange } from "../../book/assets/js/ch06-model.js";
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


// ---- the plate "Your schedule, scaled down", through the page's own worker and error calculation -------------------
{
  const EPS = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];
  const run = async (choice) => {
    const cost = costOf(choice);
    const ts = Array.from({ length: 501 }, (_, i) => (i * VIEW) / 500);
    const c0 = ts.reduce((a, t) => a + cost(t), 0) / ts.length;
    const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "scale", choice, c0, eps: EPS, view: VIEW });
    return { m, ...yoursErrors(m, cost, c0, EPS) };
  };
  const cases = [...PRESETS.filter((p) => !["deadline", "constant"].includes(p.id))
    .map((p) => ({ id: p.id, choice: { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) } })),
    { id: "draw (the default drawing)", choice: { id: "draw", points: defaultDrawing() } },
    { id: "Smooth at middle cost 0.02, size 0.05", choice: { id: "smooth", params: { c0: 0.02, size: 0.05 } } },
    { id: "Smooth at middle cost 0.5, size 0.05", choice: { id: "smooth", params: { c0: 0.5, size: 0.05 } } }];
  for (const c of cases) {
    const { m, ePm, eFo } = await run(c.choice);
    const yr = errorRange(ePm, eFo), r = S.errorRatios(ePm, eFo);
    const full = m && m.ok && m.t.length === 126 && Math.abs(m.t[125] - 2.5) < 1e-9 && m.b0.length === 126 && m.runs.every((x) => x.length === 126 && x.every(Number.isFinite));
    check("yours", `${c.id}: the worker returns all 126 times from 0 to 2.5, a constant-cost run, and six complete runs`, full, m ? `${m.t.length} times, last ${m.t[m.t.length - 1]}` : "no reply");
    const say = S.errorsVerdict({ pm: null, fo: null }, ePm, eFo, EPS, c.id === "rising");
    const claimed = /At every size/.test(say), truly = r.n === EPS.length && r.smaller === EPS.length;
    check("yours", `${c.id}: the worker's reply is complete, the chart's range is ordered, and the sentence's "every size" holds exactly when it is true`,
      m && m.ok && m.runs.length === EPS.length && yr && yr[0] < yr[1] && claimed === truly && !/slope of|like ε²\)|not at all/.test(say),
      `ratios ${r.lo?.toFixed(2)} to ${r.hi?.toFixed(2)} at ${r.smaller} of ${r.n} sizes; range ${yr ? yr.map((v) => v.toExponential(1)).join(" to ") : "none"}`);
  }
  // a change too small for the grid: no chart, and a sentence that says why
  const near = { id: "draw", points: Array.from({ length: 26 }, (_, i) => 2 - (1e-5 * i) / 25) };
  const n = await run(near);
  check("yours", "a nearly flat drawing (2 to 1.99999): no log chart is drawn, and the plate gives the largest error and says it is below what the chart displays", errorRange(n.ePm, n.eFo) === null && /below 10⁻⁷, the smallest this chart displays \(the largest is 2\.6e-8\)/.test(S.tooSmallSay(Math.max(...n.ePm, ...n.eFo))),
    `largest error ${Math.max(...n.ePm, ...n.eFo).toExponential(2)}`);
  const v = S.errorsVerdict({ pm: null, fo: null }, [1e-2, 5e-3], [1e-3, 3e-4], [1, 0.5], true);
  check("words", "on the rising cost, the verdict calls the errors measurements and says the theorem doesn't cover it", /says nothing about it/.test(v) && /measurements/.test(v) && !/O\(ε²\)\./.test(v), v);
}

// ---- the error chart's guides keep their slope when clipped to the plot ------------------------------------------
{
  const seg = S.guideInRange(1, 1e-2, 2, 1 / 32, 1, 1e-4, 1);
  const slope = seg ? Math.log(seg[1][1] / seg[1][0]) / Math.log(seg[0][1] / seg[0][0]) : NaN;
  check("yours", "a slope-2 guide clipped to the plot keeps slope 2 and stays inside it", seg && Math.abs(slope - 2) < 1e-12 && seg[1].every((y) => y >= 1e-4 * (1 - 1e-12) && y <= 1), `slope ${slope}, from ${seg?.[0].map((x) => x.toExponential(2)).join(" to ")}`);
}
