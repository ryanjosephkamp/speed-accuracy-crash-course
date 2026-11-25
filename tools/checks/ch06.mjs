// Chapter 6: the kernel, its series and transform, the start law and the sampler, the bracketing gap, the page's
// dynamic program against the paper's (Table 1), and the sentences under the plates.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, boundForCost, OVERSHOOT } from "../../book/assets/js/model.js";
import { VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import { costOf, PRESETS, defaultDrawing } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch06.js";
import { check, N, SIN, asPrinted } from "./lib.mjs";

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
  { const kb = K.kernelBins(c), m0 = kb.w[0], want = K.kernelMass(0, kb.edges[1], b, 20000);
    check("kernel", `the kernel's first bin holds the series' mass over its interval at c0 = ${c} (within 1e-4)`, Math.abs(m0 - want) < 1e-4, `${m0.toFixed(6)} vs ${want.toFixed(6)}`); }
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
      S.ordersVerdict({ pm: i % 4 === 0 ? null : i % 3, fo: i % 4 === 0 ? null : (i + 1) % 3 },
        { pm: i % 5 ? { slope: R.next() * 3, from: 1, to: 0.125 } : null, fo: i % 7 ? { slope: R.next() * 3, from: 1, to: 0.25 } : null }, R.next() * 1e-3, i % 6 === 0),
      S.zText((R.next() - 0.5) * 8),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  check("words", "the gap sentence puts a 3-standard-error miss at about one time in twenty only under its stated assumptions, and doesn't flag 1.5", /if the sampling error were normal and the runs unbiased/.test(S.zText(3)) && !/twenty/.test(S.zText(1.5)), S.zText(3));
}


// ---- the plate "Your schedule, scaled down", run as the page runs it (the scale job's programs, the same errors) ----
{
  const EPS = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];
  const errors = (cost, dt = 0.01, h = 0.02) => {
    const ts = Array.from({ length: 501 }, (_, i) => (i * VIEW) / 500);
    const c0 = ts.reduce((a, t) => a + cost(t), 0) / ts.length, gamma = (x) => cost(x) - c0, H = VIEW + SPARE;
    const flat = exactPolicy(() => c0, H, dt, h), kv = Math.round(VIEW / dt), t = Array.from(flat.ts.slice(0, kv + 1));
    const beta = K.firstOrder(gamma, t, c0), b0c = K.B(c0), eFo = [], ePm = [];
    for (const e of EPS) {
      const r = exactPolicy((x) => c0 + e * gamma(x), H, dt, h).bounds;
      let mf = 0, mp = 0;
      t.forEach((x, i) => { const d = r[i] - flat.bounds[i]; mf = Math.max(mf, Math.abs(d - e * beta[i])); mp = Math.max(mp, Math.abs(d - (K.B(c0 + e * gamma(x)) - b0c))); });
      eFo.push(mf); ePm.push(mp);
    }
    return { eFo, ePm };
  };
  const runs = [...PRESETS.filter((p) => !["deadline", "constant", "rising"].includes(p.id))   // outside the theorem, or nothing to shrink
    .map((p) => ({ id: p.id, choice: { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) } })),
    { id: "draw (the default drawing)", choice: { id: "draw", points: defaultDrawing() } }];
  for (const p of runs) {
    const cost = costOf(p.choice);
    const { eFo, ePm } = errors(cost), floor = S.gridFloor(eFo);
    const fo = S.fitAbove(EPS, eFo, floor), pm = S.fitAbove(EPS, ePm, floor);
    const ok = fo && pm && fo.slope >= 1.5 && pm.slope >= 0.5 && pm.slope < 1.5;
    check("yours", `${p.id}: above the grid's floor, the first-order error falls like eps^2 or faster and the per-moment error like eps`, ok,
      `first-order slope ${fo ? fo.slope.toFixed(2) : "none"} (${fo ? fo.from + " to " + fo.to : ""}), per-moment ${pm ? pm.slope.toFixed(2) : "none"}, floor ${floor.toExponential(1)}`);
  }
  const wave = costOf({ id: "wave", params: { omega: 2, size: 0.3 } });
  const coarse = errors(wave), fine = errors(wave, 0.005, 0.01);
  const f1 = S.gridFloor(coarse.eFo), f2v = S.gridFloor(fine.eFo);
  check("yours", "the floor is the grid's: halving both steps lowers Wave's floor at least twofold", f2v < f1 / 2, `${f1.toExponential(2)} on (0.01, 0.02), ${f2v.toExponential(2)} on (0.005, 0.01)`);
  const v = S.ordersVerdict({ pm: null, fo: null }, { pm: { slope: 1, from: 1, to: 0.03125 }, fo: null }, 7e-4, true);
  check("words", "on the rising cost, the verdict calls the slopes measurements and says the theorem doesn't cover it", /outside the theorem/.test(v) && /measurements/.test(v) && !/O\(ε²\) for a Lipschitz/.test(v), v);
}
