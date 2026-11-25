// Chapter 9: the page's backward induction and forward scoring against model.js (the ports the paper-code checks hold
// to the paper's code), the scorer against simulated trials, the overshoot against its leading-order constant, the
// shift measured on the program, the rules scored with and without it, the sinusoid test and the sweep on the page's
// grid against Tables 1 and 2, the grid refinement against Table 12, every plate's computation on the edge cases, and
// the sentences under the plates. Each claim the chapter's text makes about a computed number is checked here too.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as K from "../../book/assets/js/kernel.js";
import * as M from "../../book/assets/js/ch09-model.js";
import { exactPolicy, score, perMoment, weightedBound, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS, defaultDrawing } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch09.js";
import { check, N, table, tableNumbers, asPrinted, ROOT } from "./lib.mjs";

const preset = (id, over = {}) => { const p = PRESETS.find((q) => q.id === id); return { id, params: { ...Object.fromEntries(p.params.map((q) => [q.id, q.value])), ...over } }; };
const horizonOf = (choice) => deadlineOf(choice) ?? M.WINDOW + M.SPARE;
const ALL = [...PRESETS.map((p) => preset(p.id)), { id: "draw", points: defaultDrawing() }];
const finite = (xs) => xs.every((v) => Number.isFinite(v));
const bad = (s) => /NaN|undefined|Infinity|null/.test(s);

// ---- the paper's numbers and tables the plates print ------------------------------------------------------------
check("backward", "the plate's HorizonFloor is the paper's", M.PAPER.HorizonFloor === N.HorizonFloor, `${M.PAPER.HorizonFloor} vs ${N.HorizonFloor}`);
check("fit", "the plate's ClosedFormWorstGain is the paper's", M.PAPER.ClosedFormWorstGain === N.ClosedFormWorstGain, `${M.PAPER.ClosedFormWorstGain} vs ${N.ClosedFormWorstGain}`);
check("sweep", "the plate's SweepSwingThird and SweepSwingSixTenths are the paper's", String(M.PAPER.SweepSwingThird) === N.SweepSwingThird && String(M.PAPER.SweepSwingSixTenths) === N.SweepSwingSixTenths,
  `${M.PAPER.SweepSwingThird}, ${M.PAPER.SweepSwingSixTenths} vs ${N.SweepSwingThird}, ${N.SweepSwingSixTenths}`);
{
  const T = tableNumbers("tab_sinusoid");
  const same = T.length === M.TABLE1.length && T.every((r, i) => r.every((v, j) => v === M.TABLE1[i][j]));
  check("fit", "the plate's Table 1 equals paper/generated/tab_sinusoid.tex, cell by cell", same, `${T.length} rows`);
  const [, , , g8, l8] = M.TABLE1[4];
  check("fit", "PerMomentTooLargeAtEight is 1 / the program's swing at omega = 8, and PerMomentLateAtEight its lead", asPrinted(1 / g8, N.PerMomentTooLargeAtEight) && asPrinted(l8, N.PerMomentLateAtEight), `${(1 / g8).toFixed(2)}, ${l8}`);
  // the macros come from unrounded fits; from the printed cells they agree within the cells' rounding
  let wg = 0, wl = 0;
  for (const [om, , , g, l] of M.TABLE1) { const t = K.transfer(0.1, om); wg = Math.max(wg, Math.abs(t.gain / g - 1) * 100); wl = Math.max(wl, Math.abs(t.lead - l)); }
  check("fit", "ClosedFormWorstGain and ClosedFormWorstLead agree with the closed form against Table 1's printed cells, within their rounding (0.07% and 0.05 degrees)",
    Math.abs(wg - +N.ClosedFormWorstGain) <= 0.07 && Math.abs(wl - +N.ClosedFormWorstLead) <= 0.05, `${wg.toFixed(3)}% and ${wl.toFixed(3)} degrees vs ${N.ClosedFormWorstGain}% and ${N.ClosedFormWorstLead}`);
}
{
  const raw = table("tab_sweep");
  const cell = (c) => { const [a, b] = c.split("--").map(Number); return [a, b ?? a]; };
  const same = raw.length === M.TABLE2.length && raw.every((r, i) => +r[0] === M.TABLE2[i][0] && [1, 2, 3].every((j) => { const [a, b] = cell(r[j]); return a === M.TABLE2[i][j][0] && b === M.TABLE2[i][j][1]; }) && +r[4] === M.TABLE2[i][4]);
  check("sweep", "the plate's Table 2 equals paper/generated/tab_sweep.tex, cell by cell", same, `${raw.length} rows`);
  for (const [rel, name] of [[0.1, "Tenth"], [0.3, "Third"], [0.6, "SixTenths"]]) {
    const row = M.TABLE2.find((r) => r[0] === rel);
    const sw = Math.max(...[1, 2, 3].flatMap((j) => row[j].map((v) => Math.abs(v - 1) * 100)));
    check("sweep", `SweepSwing${name} and SweepPhase${name} are Table 2's largest errors at ${rel}`, sw.toFixed(1) === N[`SweepSwing${name}`] && row[4].toFixed(2) === N[`SweepPhase${name}`], `${sw.toFixed(1)}% and ${row[4]} vs ${N[`SweepSwing${name}`]} and ${N[`SweepPhase${name}`]}`);
  }
  const r1 = +N.SweepSwingSixTenths / +N.SweepSwingThird, r2 = +N.SweepSwingThird / +N.SweepSwingTenth;
  check("words", "the text's ratios: from 0.3 to 0.6 a little more than fourfold (4 to 5), from 0.1 to 0.3 about 11", r1 > 4 && r1 < 5 && Math.round(r2) === 11, `${r1.toFixed(2)}, ${r2.toFixed(2)}`);
  check("words", "the text's phase errors: printed the same at 0.05 and 0.1, larger at 0.3 and 0.6", M.TABLE2[0][4] === M.TABLE2[1][4] && M.TABLE2[2][4] > M.TABLE2[1][4] && M.TABLE2[3][4] > M.TABLE2[2][4], M.TABLE2.map((r) => r[4]).join(", "));
}
{
  const raw = table("tab_grid");
  const same = raw.length === M.TABLE12.length && raw.every((r, i) => r[0] === M.TABLE12[i][0] && [0, 1, 2, 3].every((j) => +r[1 + j] === M.TABLE12[i][1][j] && +r[5 + j] === M.TABLE12[i][2][j]) && +r[9] === M.TABLE12[i][3]);
  check("grid", "the plate's Table 12 equals paper/generated/tab_grid.tex, cell by cell", same, `${raw.length} rows`);
  const tex = readFileSync(join(ROOT, "paper/main.tex"), "utf8");
  const cap = tex.slice(tex.indexOf("Grid refinement on eight"), tex.indexOf("\\label{tab:grid}"));
  const grids = [...cap.matchAll(/\$\((0\.\d+), (0\.\d+)\)\$/g)].map((m) => [+m[1], +m[2]]);
  check("grid", "the plate's four paper grids are Table 12's caption's", JSON.stringify(grids) === JSON.stringify(M.PAPER_GRIDS), JSON.stringify(grids));
  let pmAbs = 0, wbAbs = 0, pmRel = 0, wbRel = 0;
  for (const [, pm, wb] of M.TABLE12) { pmAbs = Math.max(pmAbs, Math.abs(pm[3] - pm[1])); wbAbs = Math.max(wbAbs, Math.abs(wb[3] - wb[1])); if (pm[1] > 0) pmRel = Math.max(pmRel, Math.abs(pm[3] / pm[1] - 1)); if (wb[1] > 0) wbRel = Math.max(wbRel, Math.abs(wb[3] / wb[1] - 1)); }
  check("grid", "GridPmMaxChange is the largest per-moment move from grid 2 to grid 4 in Table 12, and GridWbMaxChange the weighted one within the cells' rounding (0.0001)",
    asPrinted(pmAbs, N.GridPmMaxChange) && Math.abs(wbAbs - +N.GridWbMaxChange) <= 1e-4 + 1e-12, `${pmAbs.toFixed(3)} and ${wbAbs.toFixed(4)} vs ${N.GridPmMaxChange} and ${N.GridWbMaxChange}`);
  check("grid", "the verdict's claim: in points the per-moment losses move more, as a share the weighted ones do", pmAbs > wbAbs && wbRel > pmRel, `points ${pmAbs.toFixed(4)} vs ${wbAbs.toFixed(4)}; shares ${(pmRel * 100).toFixed(1)}% vs ${(wbRel * 100).toFixed(1)}%`);
  const d12 = M.TABLE12.find((r) => r[0] === "Deadline 12")[2];
  check("words", "the text's claim: Deadline 12's weighted loss falls from grid 1 to grid 2 and rises after", d12[1] < d12[0] && d12[2] > d12[1] && d12[3] >= d12[2], d12.join(", "));
}

// ---- backward induction: the plate's program is model.js's, step for step ------------------------------------------
{
  const cases = [["jump", preset("jump")], ["deadline at 0.45", preset("deadline", { at: 0.45 })], ["constant", preset("constant")], ["rising", preset("rising")], ["draw", { id: "draw", points: defaultDrawing() }]];
  for (const [name, choice] of cases) {
    const cost = costOf(choice), H = horizonOf(choice);
    const B = M.backward(cost, H), E = exactPolicy(cost, H);
    let same = B.bounds.length === E.bounds.length;
    for (let k = 0; same && k < E.bounds.length; k++) same = B.bounds[k] === E.bounds[k] || (Number.isNaN(B.bounds[k]) && Number.isNaN(E.bounds[k]));
    check("backward", `${name}: the backward plate's bounds are model.js's exactPolicy's, exactly, at every step`, same, `${E.bounds.length} steps`);
    // at every kept slice with a bound inside the kept range, the bound sits between the last node where waiting adds
    // something and the first where it doesn't
    let ok = 0, n = 0;
    B.keepK.forEach((k, j) => {
      const b = B.bounds[k];
      if (k === B.ts.length - 1 || !Number.isFinite(b) || b <= 0 || b >= B.M * B.h) return;
      n++;
      const i = Math.floor(b / B.h + 1e-12);
      if (B.adv[j * (B.M + 1) + i] >= -1e-7 && B.adv[j * (B.M + 1) + i + 1] <= 1e-7) ok++;
    });
    check("backward", `${name}: at each kept slice, the bound lies where what waiting adds reaches 0`, ok === n, `${ok} of ${n} slices`);
    const top = B.adv.slice(0, B.M + 1);
    check("backward", `${name}: at the forced choice, waiting adds nothing anywhere`, top.every((v) => v === 0), "the horizon's slice");
  }
  // the text: the forced choice reaches further back at a low cost (the bound first falls below 99% of its value at the
  // start, for good, earlier before the forced choice at 8.5)
  const reach = (c) => { const { ts, bounds } = exactPolicy(() => c, 8.5); let k = bounds.length - 1; while (k > 0 && bounds[k - 1] < 0.99 * bounds[0]) k--; return 8.5 - ts[k]; };
  const r02 = reach(0.02), r1 = reach(0.1);
  check("words", "the text's claim: the forced choice reaches further back at a low cost (at 0.02 than at 0.1)", r02 > r1, `the bound starts down ${r02.toFixed(2)} time units before the end at 0.02, ${r1.toFixed(2)} at 0.1`);
  const F = M.horizonFloor(0.02);
  check("backward", "HorizonFloor: at a constant cost of 0.02 with the choice forced at 10, the constant-cost bound's loss on this page's grid prints as the paper's", asPrinted(F.loss, N.HorizonFloor), `${F.loss.toFixed(5)} vs ${N.HorizonFloor}`);
  check("words", "the text's claim: about one decision in a thousand is still open at 10 (between 0.0008 and 0.0016 on this grid)", F.undecided > 0.0008 && F.undecided < 0.0016, F.undecided.toFixed(5));
  const cost = costOf(preset("jump")), B = M.backward(cost, 8.5);
  const r = score(Array.from(B.bounds, (v) => (Number.isFinite(v) ? v : 5)), Array.from(B.ts), cost);
  check("backward", "the program's own value at the start and its bound scored by the density differ only by the interpolation of the bound (under 1e-4)", Math.abs(B.v0 - r.reward) < 1e-4, `${B.v0.toFixed(6)} vs ${r.reward.toFixed(6)}`);
}

// ---- scoring: the plate's forward pass is model.js's score, step for step --------------------------------------------
{
  for (const [name, choice] of [["jump", preset("jump")], ["deadline at 0.45", preset("deadline", { at: 0.45 })], ["constant", preset("constant")], ["rising", preset("rising")], ["pulse at 32-fold", preset("pulse", { factor: 32 })]]) {
    const cost = costOf(choice), H = horizonOf(choice);
    const { ts, bounds } = exactPolicy(cost, H);
    const T = Array.from(ts);
    const pols = { best: Array.from(bounds, (v) => (Number.isFinite(v) ? v : 5)), pm: Array.from(perMoment(cost, T), (v) => toDiscrete(v, 0.01)), wb: Array.from(weightedBound(cost, T), (v) => toDiscrete(v, 0.01)) };
    for (const [p, b] of Object.entries(pols)) {
      const F = M.forward(b, T, cost), R = score(b, T, cost);
      const same = F.reward === R.reward && F.p === R.p && F.rt === R.rt && F.paid === R.paid;
      let tot = F.endUp + F.endLo; for (let k = 0; k < T.length; k++) tot += F.upAt[k] + F.loAt[k];
      check("density", `${name}, ${p}: the density plate's totals are model.js's score, exactly, and every trial is decided once (mass 1 within 1e-12)`, same && Math.abs(tot - 1) < 1e-12, `reward ${F.reward.toFixed(6)}, mass ${tot.toFixed(14)}`);
    }
  }
  const cost = costOf(preset("jump")), { ts, bounds } = exactPolicy(cost, 8.5), T = Array.from(ts);
  const b = Array.from(bounds, (v) => (Number.isFinite(v) ? v : 5));
  const F = M.forward(b, T, cost);
  let worst = 0;
  F.snapK.forEach((k, j) => { let s = 0; for (let i = 0; i < 2 * F.M + 1; i++) s += F.snaps[j * (2 * F.M + 1) + i] * F.h; worst = Math.max(worst, Math.abs(s - F.aliveAt[k])); });
  check("density", "the density drawn at each kept step holds the mass still deciding (within 1e-6; the page keeps it in single precision)", worst < 1e-6, `largest gap ${worst.toExponential(1)}`);
  const pm = Array.from(perMoment(cost, T), (v) => toDiscrete(v, 0.01));
  const d = Math.max(Math.abs(score(b, T, cost, 0.02).reward - score(b, T, cost, 0.005).reward), Math.abs(score(pm, T, cost, 0.02).reward - score(pm, T, cost, 0.005).reward));
  check("density", "the scorer's own grid matters little here: an evidence step of 0.005 instead of 0.02 moves the jump's scores by under 2e-5", d < 2e-5, `largest move ${d.toExponential(1)}`);
}

// ---- simulated trials of the same gridded problem ----------------------------------------------------------------
{
  const cost = costOf(preset("jump")), { ts, bounds } = exactPolicy(cost, 8.5), T = Array.from(ts);
  for (const [name, b] of [["best bound", Array.from(bounds, (v) => (Number.isFinite(v) ? v : 5))], ["per-moment rule", Array.from(perMoment(cost, T), (v) => toDiscrete(v, 0.01))]]) {
    const acc = M.trials(b, T, cost, 40000, K.rng(2026));
    const st = M.trialStats(acc), ex = score(b, T, cost).reward;
    check("trials", `jump, ${name}: the average of 40,000 simulated trials is within 3 standard errors of the density's score`, Math.abs(st.mean - ex) < 3 * st.se, `${st.mean.toFixed(4)} ± ${st.se.toFixed(4)} vs ${ex.toFixed(4)}`);
  }
  check("trials", "after trialsFor(sd, target) trials, the standard error is the target", Math.abs(0.43 / Math.sqrt(M.trialsFor(0.43, 2e-5)) - 2e-5) < 1e-15, "identity");
  // the text: "hundreds of millions of trials on most schedules"
  let many = 0;
  const seen = [];
  for (const choice of ALL) {
    const c = costOf(choice), H = horizonOf(choice), P = exactPolicy(c, H), TT = Array.from(P.ts);
    const st = M.trialStats(M.trials(Array.from(P.bounds, (v) => (Number.isFinite(v) ? v : 5)), TT, c, 20000, K.rng(7)));
    const need = M.trialsFor(st.sd, 2e-5);
    seen.push(`${choice.id} ${S.count(need)}`);
    if (need >= 1e8) many++;
  }
  check("words", "the text's claim: a standard error of 2e-5 takes hundreds of millions of trials on most of the book's schedules (at least 8 of 11)", many >= 8, seen.join("; "));
}

// ---- the overshoot of a bound checked every dt -----------------------------------------------------------------------
{
  // -zeta(1/2) / sqrt(2 pi), with zeta(1/2) from the alternating series eta(1/2) / (1 - sqrt 2), averaged over two partial sums
  let eta = 0, prev = 0;
  for (let n = 1; n <= 2000001; n++) { prev = eta; eta += (n % 2 ? 1 : -1) / Math.sqrt(n); }
  const zeta = (0.5 * (eta + prev)) / (1 - Math.SQRT2), c = -zeta / Math.sqrt(2 * Math.PI);
  check("overshoot", "0.5826 is -zeta(1/2) / sqrt(2 pi) to four decimals", c.toFixed(4) === "0.5826" && M.OVERSHOOT === 0.5826, `${c.toFixed(6)}`);
  const b = K.B(0.1), out = [];
  for (const d of [0.04, 0.01, 0.0025, 0.000625]) {
    const R = K.rng(2026 + Math.round(d * 1e6));
    const o = M.overshoots(b, d, 8000, R);
    const m = o.reduce((a, v) => a + v, 0) / o.length, se = Math.sqrt(o.reduce((a, v) => a + (v - m) ** 2, 0) / o.length / o.length);
    out.push({ d, r: m / Math.sqrt(d), e: se / Math.sqrt(d) });
  }
  check("overshoot", "at the plate's default seed (8,000 runs at each dt): mean overshoot / sqrt(dt) falls at each smaller dt, and at dt = 0.000625 is within 3 standard errors plus 0.01 of 0.5826 (another seed need not fall at every step; the plate's sentence doesn't say it will)",
    out[0].r > out[1].r && out[1].r > out[2].r && out[2].r > out[3].r && Math.abs(out[3].r - 0.5826) < 3 * out[3].e + 0.01, out.map((x) => `${x.d}: ${x.r.toFixed(3)} ± ${x.e.toFixed(3)}`).join(", "));
  let ok = true;
  for (let i = 0; i < 40; i++) {
    const P = M.onePath(b, 0.01, K.rng(500 + i));
    const before = P.checks.slice(0, -1).every((c2) => Math.abs(c2[1]) < b);
    ok = ok && before && Math.abs(P.stop[1]) >= b && P.first[0] <= P.stop[0] + 1e-12;
  }
  check("overshoot", "the drawn run stops at the first check past the bound, and the run itself reached the bound no later", ok, "40 runs");
}

// ---- the shift, measured on the program ------------------------------------------------------------------------------
{
  const range = (r, upto) => { const v = r.k.filter((x, i) => Number.isFinite(x) && r.t[i] <= upto + 1e-9); return [Math.min(...v), Math.max(...v)]; };
  const cst = M.shiftCoef(() => 0.1, 8.5), [a, b] = range(cst, 2.5);
  check("coef", "at a constant cost of 0.1, the measured coefficient stays within 0.015 of 0.5826 over the window", Math.abs(a - 0.5826) < 0.015 && Math.abs(b - 0.5826) < 0.015, `${a.toFixed(3)} to ${b.toFixed(3)}`);
  for (const [c, at] of [[0.1, 1], [0.02, 0.4], [0.5, 3]]) {
    const r = M.shiftCoef((t) => (t <= at + 1e-12 ? c : Infinity), at, { every: 1 });
    const n = r.k.length, body = r.k.slice(0, n - 2), last2 = r.k.slice(n - 2);
    check("coef", `the text's claim, on a deadline at ${at} with cost ${c}: within 0.03 of 0.5826 until the last two checks before it`, body.every((v) => Math.abs(v - 0.5826) < 0.03),
      `${Math.min(...body).toFixed(3)} to ${Math.max(...body).toFixed(3)}; last two ${last2.map((v) => v.toFixed(3)).join(", ")}`);
  }
  const jump = M.shiftCoef(costOf(preset("jump")), 8.5), fall = M.shiftCoef(costOf(preset("fall")), 8.5);
  const [jl] = range(jump, 2.5), [, fh] = range(fall, 2.5);
  check("coef", "the text's claim: near a fast change it moves away, both ways (below 0.55 on the jump, above 0.62 on the fall)", jl < 0.55 && fh > 0.62, `jump down to ${jl.toFixed(3)}, fall up to ${fh.toFixed(3)}`);
  // the departures are not the evidence grid's: halving h moves them little
  const fine = M.shiftCoef(costOf(preset("jump")), 8.5, { h: 0.005 });
  let w = 0; jump.t.forEach((t, i) => { if (t <= 2.5 && Number.isFinite(jump.k[i]) && Number.isFinite(fine.k[i])) w = Math.max(w, Math.abs(jump.k[i] - fine.k[i])); });
  check("coef", "on the jump, an evidence step of 0.005 instead of 0.01 moves the measured coefficient by under 0.02 anywhere in the window", w < 0.02, `largest move ${w.toFixed(4)}`);
}

// ---- the rules with and without the shift ----------------------------------------------------------------------------
{
  const L = {};
  for (const choice of ALL) L[choice.id] = M.ruleLosses(costOf(choice), horizonOf(choice)).loss;
  const c = L.constant;
  check("shift", "the text's claim: on a constant cost, both rules are the constant-cost bound, and the shift takes its loss down to under 0.001 from over ten times that",
    c.pm.on === c.wb.on && c.pm.off === c.wb.off && c.pm.on < 0.001 && c.pm.off > 10 * c.pm.on, `${c.pm.on.toFixed(5)} with, ${c.pm.off.toFixed(5)} without`);
  const lower = Object.values(L).filter((x) => x.wb.on < x.wb.off).length;
  check("shift", "the text's claim: the shift lowers the weighted rule's loss on most of the book's schedules (at least 8 of 11)", lower >= 8, `${lower} of ${ALL.length}`);
  check("shift", "the text's claim: on the Deadline preset, the weighted rule loses more with the shift than without it", L.deadline.wb.on > L.deadline.wb.off, `${L.deadline.wb.on.toFixed(4)} with, ${L.deadline.wb.off.toFixed(4)} without`);
  const up = Object.values(L).filter((x) => x.pm.on > x.pm.off).length, down = Object.values(L).filter((x) => x.pm.on < x.pm.off).length;
  check("shift", "the text's claim: the per-moment rule's loss moves either way with the shift", up > 0 && down > 0, `worse on ${up}, better on ${down}`);
  const dl = preset("deadline"), cost = costOf(dl), { ts, bounds } = exactPolicy(cost, 1), T = Array.from(ts), wb = Array.from(weightedBound(cost, T));
  let below = 0; for (let k = 0; k < T.length - 1; k++) if (wb[k] < bounds[k] + 0.5826 * 0.1) below++;
  check("shift", "the text's claim: on the Deadline preset, the weighted rule's continuous bound sits below the program's bound moved back out by the shift for most of the trial", below > 0.5 * (T.length - 1), `${below} of ${T.length - 1} checks`);
}

// ---- the sinusoid test on the page's grid ----------------------------------------------------------------------------
{
  const rows = M.TABLE1.map((r) => M.sinusoidTest(r[0]));
  let gs = 0, gl = 0;
  rows.forEach((r, i) => { gs = Math.max(gs, Math.abs(r.swing - M.TABLE1[i][3])); gl = Math.max(gl, Math.abs(r.lead - M.TABLE1[i][4])); });
  check("fit", "the page's program on its grid, fitted as the paper fits it: within 0.006 of Table 1's program on the swing and 1 degree on the lead, at all five frequencies", gs < 0.006 && gl < 1, `largest gaps ${gs.toFixed(4)} and ${gl.toFixed(2)} degrees`);
  const w = M.sinusoidWindow(1);
  check("fit", "the paper's window at omega = 1: two whole periods from t = 2, the horizon 6 after", w.periods === 2 && Math.abs(w.to - (2 + 4 * Math.PI)) < 1e-12 && Math.abs(w.horizon - w.to - 6) < 1e-12, `${w.from} to ${w.to.toFixed(3)}, horizon ${w.horizon.toFixed(3)}`);
  const w8 = M.sinusoidWindow(8);
  check("fit", "at omega = 8: eight whole periods, at least 6 time units", w8.periods === 8 && w8.to - w8.from >= 6, `${(w8.to - w8.from).toFixed(3)} time units`);
  const t8 = K.transfer(0.1, 8), coarse = rows[4], fine = M.sinusoidTest(8, { dt: 0.005, h: 0.01 });
  const g1 = Math.abs(coarse.lead - t8.lead), g2 = Math.abs(fine.lead - t8.lead);
  check("fit", "the text's claim: with half the time step and evidence step, the lead's gap from the closed form at omega = 8 shrinks by about half (to 40 to 60%)", g2 / g1 > 0.4 && g2 / g1 < 0.6, `${g1.toFixed(3)} to ${g2.toFixed(3)} degrees`);
  // the closed-form response against the kernel's series, and the fit against a known sinusoid
  let e = 0; for (const t of [2.1, 3.7, 5.3]) e = Math.max(e, Math.abs(M.firstOrderSine(4, t, 0.1, 0.01) - 0.01 * K.firstOrder((s) => Math.sin(4 * s), [t], 0.1)[0]));
  check("fit", "the closed-form response eps beta(t) equals eps B'(c0) (w * sin)(t) from the kernel's bins (within 1e-5)", e < 1e-5, `largest gap ${e.toExponential(1)}`);
  const tt = Array.from({ length: 400 }, (_, i) => 2 + i * 0.02), f = M.fitSine(tt, tt.map((t) => 0.3 * Math.sin(2 * t) - 0.2 * Math.cos(2 * t) + 0.05), 2);
  check("fit", "the fit recovers a known sinusoid", Math.abs(f.a - 0.3) < 1e-12 && Math.abs(f.b + 0.2) < 1e-12 && Math.abs(f.c - 0.05) < 1e-12, `${f.a.toFixed(6)}, ${f.b.toFixed(6)}, ${f.c.toFixed(6)}`);
}

// ---- the sweep on the page's grid ---------------------------------------------------------------------------------------
{
  let worst = [];
  for (const c0 of M.SWEEP.costs) for (const om of M.SWEEP.omegas) {
    const rows = M.sweepTest(c0, om, [0.3, 0.6]), ci = M.SWEEP.costs.indexOf(c0) + 1;
    for (const r of rows) {
      const [lo, hi] = M.TABLE2.find((x) => x[0] === r.rel)[ci].map((v) => Math.abs(v - 1) * 100), e = Math.abs(r.ratio - 1) * 100;
      worst.push({ c0, om, rel: r.rel, off: e < lo ? lo - e : e > hi ? e - hi : 0, e });
    }
  }
  const at = (rel) => Math.max(...worst.filter((x) => x.rel === rel).map((x) => x.off));
  check("sweep", "the text's claim: on the page's grid, the swing error at 0.3 and 0.6 comes out close to Table 2's (within 0.4 and 0.8 percentage points of its range, at every cost and frequency)",
    at(0.3) < 0.4 && at(0.6) < 0.8, `largest distances ${at(0.3).toFixed(2)} and ${at(0.6).toFixed(2)} points`);
  let grows = [];
  for (const c0 of M.SWEEP.costs) for (const om of M.SWEEP.omegas) { const [a, b] = M.sweepTest(c0, om, [0.05, 0.1]).map((r) => Math.abs(r.ratio - 1)); grows.push({ c0, om, r: b / a }); }
  check("sweep", "the text's claim: below 0.3 the page's errors don't grow with the size the way a second-order error would (from 0.05 to 0.1, at most 1.1-fold at every cost and frequency, against 4)",
    grows.every((g) => g.r <= 1.1), grows.map((g) => `${g.c0}/${g.om}: ${g.r.toFixed(2)}`).join(", "));
  const coarse = M.sweepTest(0.1, 4, [0.05])[0], fine = M.sweepTest(0.1, 4, [0.05], { dt: 0.005, h: 0.01 })[0];
  const e1 = Math.abs(coarse.ratio - 1), e2 = Math.abs(fine.ratio - 1);
  check("sweep", "the text's claim: below 0.3 the page's error depends on its grid (at 0.05, c0 = 0.1, omega = 4, a grid of half the steps cuts it by more than half)", e2 < e1 / 2, `${(e1 * 100).toFixed(2)}% to ${(e2 * 100).toFixed(2)}%`);
}

// ---- every plate's computation on the edge cases ----------------------------------------------------------------------
{
  const cases = [
    ["deadline at 0.45", preset("deadline", { at: 0.45 })], ["deadline at 3 with cost 0.02", preset("deadline", { at: 3, c: 0.02 })], ["constant", preset("constant")],
    ["flat drawing", { id: "draw", points: Array(26).fill(0.1) }], ["smooth at size 0", preset("smooth", { size: 0 })], ["rising", preset("rising")],
    ["jump to 3.2 (a bound below the grid's first step)", preset("jump", { factor: 32 })], ["drawing at its extremes", { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i % 2 ? 2 : 0.01)) }],
  ];
  for (const [name, choice] of cases) {
    const cost = costOf(choice), H = horizonOf(choice), dl = deadlineOf(choice);
    const B = M.backward(cost, H);
    const okB = B.bounds.length === Math.round(H / 0.01) + 1 && B.bounds[B.bounds.length - 1] === 0 && Math.abs(B.ts[B.ts.length - 1] - H) < 1e-9;
    const T = Array.from(B.ts), b = Array.from(B.bounds, (v) => (Number.isFinite(v) ? v : 5));
    const F = M.forward(b, T, cost, { upto: Math.round((dl ?? 2.5) / 0.01) });
    const C = M.shiftCoef(cost, H), Lr = M.ruleLosses(cost, H, { view: dl ?? 2.5 }), Rf = M.refine(cost, H);
    const nums = [F.reward, F.p, F.rt, F.paid, Lr.loss.pm.on, Lr.loss.pm.off, Lr.loss.wb.on, Lr.loss.wb.off, ...Rf.flatMap((r) => [r.pm, r.wb])];
    const lastT = Lr.t[Lr.t.length - 1];
    const sents = [
      S.backwardSay(T[0], B.bounds[0], 0.3, H, dl !== null, 5, 0.02), S.densitySay("best", 1, 0.3, 0.1, F),
      S.shiftSay(Lr.loss, choice.id === "constant"), S.refineSay(Rf, name),
    ];
    // the density plate's last kept step is the end of what it draws, and at a deadline every trial has decided by then
    const kEnd = Math.round((dl ?? 2.5) / 0.01), dEnd = M.decidedBy(F, F.snapK[F.snapK.length - 1], dl !== null ? T.length - 1 : null);
    const okD = F.snapK[F.snapK.length - 1] === kEnd && (dl === null || Math.abs(dEnd.up + dEnd.lo - 1) < 1e-12) && dEnd.up + dEnd.lo <= 1 + 1e-12;
    const okC = Math.abs(C.t[C.t.length - 1] - (H - 0.01)) < 1e-9;
    check("edges", `${name}: every plate's computation runs; the program, the density, the coefficient, and the shift plot all end where they should; and the numbers and sentences are clean`,
      okB && okD && okC && finite(nums) && C.k.length > 0 && Math.abs(lastT - (dl ?? 2.5)) < 1e-9 && !sents.some(bad) && nums.slice(4).every((v) => v > -1e-3),
      `reward ${F.reward.toFixed(4)}, decided by the plot's end ${(dEnd.up + dEnd.lo).toFixed(6)}, losses ${nums.slice(4).map((v) => v.toFixed(4)).join(" ")}, plots end at ${lastT} and ${C.t[C.t.length - 1].toFixed(2)}`);
  }
  // the refinement on the reader's schedule: every grid gives a loss, and the page's grid's is model.js's
  const r = M.refine(costOf(preset("jump")), 8.5);
  const direct = M.ruleLosses(costOf(preset("jump")), 8.5).loss.pm.on;
  check("grid", "the refinement's first grid is this page's, with the same per-moment loss as the shift plate's", r[0].pm === direct && r.length === 3, `${r.map((x) => x.pm.toFixed(4)).join(", ")}`);
  check("grid", "every time step of this page's grids divides 0.05, so a deadline on the schedules' 0.05 steps falls on a grid time", M.PAGE_GRIDS.every(([dt]) => Math.abs(0.05 / dt - Math.round(0.05 / dt)) < 1e-9), M.PAGE_GRIDS.map((g) => g[0]).join(", "));
}

// ---- the sentences --------------------------------------------------------------------------------------------------
{
  const R = K.rng(9);
  let n = 0, nb = 0;
  for (let i = 0; i < 3000; i++) {
    const u = () => R.next();
    const tot = { p: 0.5 + 0.5 * u(), rt: u() * 2, paid: u() * 0.1, reward: u() };
    const rows = [0.05, 0.1, 0.3, 0.6].map((rel) => ({ rel, ratio: 1 + (u() - 0.5) * 0.2, phase: (u() - 0.5) * 3 }));
    const say = [
      S.heroLabel(u() * 2.5, u() * 0.6, u() * 0.3),
      S.backwardSay(u() * 8, [0, Infinity, u() * 2][i % 3], u() * 0.3, 8.5, i % 2 === 0),
      S.floorSay(u() * 0.01, u() * 0.01, "0.0018"),
      S.densitySay(["best", "pm", "wb"][i % 3], u() * 2.5, u() * 0.6, u() * 0.3, tot),
      S.trialsVerdict(i % 4 ? 10 ** (3 + 8 * u()) : null, 10 ** (6 + 3 * u())),
      S.trialsSay(1000 + Math.floor(u() * 1e6), 0.7 + 0.1 * u(), 1e-3 * (0.1 + u()), 0.7, 0.7 + 1e-4 * (u() - 0.5) * (i % 3), 0.4 + 0.1 * u(), 2e-5, i % 2 ? 10 ** (8 + u()) : null),
      S.densitySay(["best", "pm", "wb"][i % 3], 0.45, 0.6 * u(), 0.4 * u(), tot, i % 2 ? u() : 0), S.sci(i % 4 ? 10 ** (-9 * u()) : 0),
      S.backwardSay(u() * 8, [0, 0.02 * u(), u() * 2, Infinity][i % 4], u() * 0.3, 8.5, i % 2 === 0, 5, 0.02),
      S.overshootVerdict([null, "in", "out", "stay"][i % 4]),
      S.overshootSay([0.04, 0.01, 0.0025, 0.000625][i % 4], 0.01 * u(), 1e-4 * u() + 1e-6, 8000),
      S.coefSay(i % 2 ? [0.57, 0.6] : null, { lo: 0.4 + 0.2 * u(), hi: 0.6 + 0.2 * u(), tLo: u() * 2.5, tHi: u() * 2.5 }, i % 3 ? null : 0.55, i % 5 === 0),
      S.shiftSay({ pm: { on: u(), off: u() }, wb: { on: u() * 0.1, off: u() * 0.1 } }, i % 7 === 0),
      S.fitVerdict([null, 10, 1, 0.1][i % 4], "0.1", u()), S.fitSay(2, { swing: u(), lead: 40 * u() }, [u(), 40 * u()], { gain: u(), lead: 40 * u() }),
      S.sweepVerdict([null, 4.4, 8.8, 17.6][i % 4], 2.2, 9.8), S.sweepSay(rows, 0.1, 4, 0.2 * u()),
      S.gridVerdict([null, "pm", "wb", "same"][i % 4], "0.005", "0.0017", 0.011, 0.17, 0.001), S.refineSay([{ dt: 0.01, h: 0.02, pm: u(), wb: u() * 0.01 }, { dt: 0.0025, h: 0.01, pm: u(), wb: u() * 0.01 }], "Jump"),
      S.scheduleNote(["deadline", "constant", ""][i % 3], "Wave"), S.count(10 ** (2 + 9 * u())),
    ];
    for (const s of say) { n++; if (bad(s)) nb++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", nb === 0, `${n} sentences, ${nb} bad`);
  check("words", "the backward sentence says what the program does at the forced choice, at a bound of 0, and past the cap",
    /nobody waits/.test(S.backwardSay(8.5, 0, 0, 8.5, false)) && /the bound is 0/.test(S.backwardSay(3, 0, 0, 8.5, false)) && /above the cap/.test(S.backwardSay(1, Infinity, 0.3, 8.5, false)), "three cases");
  check("words", "the sweep verdict calls 4 times the error at 0.3 second order, and the others first and third order",
    /^Right/.test(S.sweepVerdict(8.8, 2.2, 9.8)) && /first order/.test(S.sweepVerdict(4.4, 2.2, 9.8)) && /third order/.test(S.sweepVerdict(17.6, 2.2, 9.8)), S.sweepVerdict(8.8, 2.2, 9.8));
  check("words", "the shift sentence says when the shift makes a rule worse, and only then; an equal loss is called the same, not worse",
    /makes it worse/.test(S.shiftSay({ pm: { on: 2, off: 1 }, wb: { on: 0.01, off: 0.05 } }, false)) && !/makes it worse/.test(S.shiftSay({ pm: { on: 1, off: 2 }, wb: { on: 0.01, off: 0.05 } }, false))
    && !/makes it worse/.test(S.shiftSay({ pm: { on: 1, off: 1 }, wb: { on: 0.01, off: 0.01 } }, false)) && /the same without it/.test(S.shiftSay({ pm: { on: 1, off: 1 }, wb: { on: 0.01, off: 0.05 } }, false)),
    S.shiftSay({ pm: { on: 1, off: 1 }, wb: { on: 0.01, off: 0.05 } }, false));
  check("words", "the trials verdict counts powers of ten the right way", /about ten times more/.test(S.trialsVerdict(1e7, 1.1e8)) && /about 2 powers of ten more/.test(S.trialsVerdict(1e6, 1.2e8)) && /About right/.test(S.trialsVerdict(3e8, 4.7e8)), S.trialsVerdict(1e6, 1.2e8));
  check("words", "counts read as a reader says them", S.count(4.7e8) === "470 million" && S.count(2345) === "2,345" && S.count(1.25e10) === "13 billion" && S.count(4.1e9) === "4.1 billion" && S.count(1e6) === "1 million", [4.7e8, 2345, 1.25e10, 4.1e9, 1e6].map(S.count).join(", "));
  check("words", "the trials sentence keeps the number of trials needed back until the reader has guessed, and names the grid's error beside the sampling error",
    !/million|billion/.test(S.trialsSay(1e5, 0.709, 0.0014, 0.7103, 0.71031, 0.437, 2e-5, null)) && /476 million/.test(S.trialsSay(1e5, 0.709, 0.0014, 0.7103, 0.71031, 0.437, 2e-5, 4.76e8))
    && /grid's error/.test(S.trialsSay(1e5, 0.709, 0.0014, 0.7103, 0.71031, 0.437, 2e-5, null)), "with and without");
  check("words", "the backward sentence places a bound below the grid's first step between the center and that step, and says the paper's code reports 0 there",
    /placed between them/.test(S.backwardSay(1, 0.0183, 0.01, 8.5, false, 5, 0.02)) && /reports 0/.test(S.backwardSay(1, 0.0183, 0.01, 8.5, false, 5, 0.02)) && /even at x = 0/.test(S.backwardSay(1, 0, 0, 8.5, false, 5, 0.02)), S.backwardSay(1, 0.0183, 0.01, 8.5, false, 5, 0.02));
  check("words", "the hero's list ends with an Oxford comma and 'and'", /wrongly, and/.test(S.heroLabel(0.6, 0.75, 0.24)), S.heroLabel(0.6, 0.75, 0.24));
  check("words", "the coefficient sentence names a departure only past 0.03 from 0.5826, and prints one value when the range rounds to it",
    /falls to 0.50/.test(S.coefSay([0.586, 0.586], { lo: 0.497, hi: 0.586, tLo: 0.4, tHi: 2 }, null, false)) && !/rises/.test(S.coefSay([0.586, 0.586], { lo: 0.497, hi: 0.586, tLo: 0.4, tHi: 2 }, null, false)) && /stays at 0.59/.test(S.coefSay([0.586, 0.586], { lo: 0.497, hi: 0.586, tLo: 0.4, tHi: 2 }, null, false)),
    S.coefSay([0.586, 0.586], { lo: 0.497, hi: 0.586, tLo: 0.4, tHi: 2 }, null, false));
}

// ---- round 1 of the audits: the claims the fixes rest on, run on the real computation -------------------------------
{
  const V = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch09.json"), "utf8"));
  const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
  check("grid", "tools/validity/ch09.json holds the paper's results at the book's tag", V.commit === SRC.commit, `${V.tag} (${V.commit.slice(0, 7)})`);
  // Table 12's unrounded results, as the plate carries them
  const byName = new Map(V.grid.map((r) => [r.name.toLowerCase(), r]));
  let worst = 0, rounds = true;
  M.RESULTS12.forEach(([name, pm, wb, res], i) => {
    const r = byName.get(name.toLowerCase());
    [...pm.map((v, g) => [v, r.perMoment[g]]), ...wb.map((v, g) => [v, r.weighted[g]]), [res, r.residual]].forEach(([a, b]) => { worst = Math.max(worst, Math.abs(a / b - 1)); });
    const T12 = M.TABLE12[i];
    rounds = rounds && T12[0] === name && pm.every((v, g) => v.toFixed(3) === T12[1][g].toFixed(3)) && wb.every((v, g) => v.toFixed(4) === T12[2][g].toFixed(4)) && res.toFixed(3) === T12[3].toFixed(3);
  });
  check("grid", "the plate's unrounded Table 12 is the paper's results file (within 1e-8, relative), and rounds to Table 12's printed cells", worst < 1e-8 && rounds, `largest relative gap ${worst.toExponential(1)}`);
  check("grid", "the plate's GridPmMaxChange and GridWbMaxChange are the paper's", M.PAPER.GridPmMaxChange === N.GridPmMaxChange && M.PAPER.GridWbMaxChange === N.GridWbMaxChange, `${M.PAPER.GridPmMaxChange}, ${M.PAPER.GridWbMaxChange}`);
  const mv = M.gridMoves();
  check("grid", "from the unrounded results, the largest moves from grid 2 to grid 4 print as GridPmMaxChange and GridWbMaxChange", asPrinted(mv.pmAbs, N.GridPmMaxChange) && asPrinted(mv.wbAbs, N.GridWbMaxChange), `${mv.pmAbs.toFixed(5)}, ${mv.wbAbs.toFixed(6)}`);
  const small = M.RESULTS12.filter((r) => r[2][1] < M.SHARE_FLOOR).map((r) => r[0]);
  check("grid", "the verdict's shares: over losses of at least 0.001 points, the weighted losses move more as a share (and Smooth 4's and Step 10's weighted losses are the ones left out)",
    mv.wbRel > mv.pmRel && JSON.stringify(small) === JSON.stringify(["Smooth 4", "Step 10"]), `${(mv.pmRel * 100).toFixed(2)}% against ${(mv.wbRel * 100).toFixed(1)}%; left out: ${small.join(", ")}`);
  // Table 2's unrounded results
  const most = (rel, key) => Math.max(...V.sweep.filter((r) => r.rel === rel).map((r) => (key === "ratio" ? Math.abs(r.ratio - 1) : Math.abs(r.phase))));
  const r31 = most(0.3, "ratio") / most(0.1, "ratio");
  check("words", "the text's claim: unrounded, the largest swing errors at 0.3 and 0.1 give a factor close to 9 (within 0.5)", Math.abs(r31 - 9) < 0.5, r31.toFixed(2));
  const p05 = most(0.05, "phase"), p1 = most(0.1, "phase");
  check("words", "the text's claim: unrounded, the largest phase errors at 0.05 and 0.1 both print as 0.15 and differ by a few thousandths of a degree", p05.toFixed(2) === "0.15" && p1.toFixed(2) === "0.15" && Math.abs(p05 - p1) < 0.01, `${p05.toFixed(4)} and ${p1.toFixed(4)}`);
  check("words", "the text's claim: at 0.05, Table 2 prints 0.999 to 1.001, the last printed digit", JSON.stringify(M.TABLE2[0].slice(1, 4).flat().map((v) => v.toFixed(3)).sort()) === JSON.stringify(["0.999", "1.000", "1.000", "1.000", "1.001", "1.001"]), M.TABLE2[0].slice(1, 4).flat().join(", "));
}
{
  // why a loss can be negative: nothing scores above the program's own value, but the scored reference earns a little less
  for (const c of [0.1, 0.2]) {
    const cost = () => c, B = M.backward(cost, 10), T = Array.from(B.ts);
    const ref = score(Array.from(B.bounds, (v) => (Number.isFinite(v) ? v : 5)), T, cost).reward;
    let best = -Infinity;
    for (let x = K.B(c) - 0.12; x <= K.B(c) + 0.06; x += 0.0005) best = Math.max(best, score(T.map(() => x), T, cost).reward);
    const pm = score(T.map(() => toDiscrete(K.B(c), 0.01)), T, cost).reward;
    check("density", `the text's claim, at a constant cost of ${c} with the choice forced at 10: the program's bound as scored earns less than the program's own value, and no flat bound (a scan in steps of 0.0005) scores above that value`,
      ref < B.v0 && best <= B.v0 + 1e-12, `value ${B.v0.toFixed(8)}, scored reference ${ref.toFixed(8)}, best flat ${best.toFixed(8)}`);
    if (c === 0.2) check("density", "and at 0.2 the per-moment rule's loss is negative against the scored reference, positive against the program's own value",
      ref - pm < 0 && B.v0 - pm > 0, `${(100 * (ref - pm)).toExponential(2)} and ${(100 * (B.v0 - pm)).toExponential(2)} points`);
  }
}
{
  // the density plate at a deadline: the scrubber ends on the deadline, and the forced choice is counted
  for (const at of [0.45, 1]) {
    const choice = preset("deadline", { at }), cost = costOf(choice);
    const { ts, bounds } = exactPolicy(cost, at), T = Array.from(ts), kD = T.length - 1;
    for (const [name, b] of [["per-moment", Array.from(perMoment(cost, T), (v) => toDiscrete(v, 0.01))], ["best", Array.from(bounds, (v) => (Number.isFinite(v) ? v : 5))]]) {
      const F = M.forward(b, T, cost, { every: 2, upto: Math.round(at / 0.01) });
      const end = F.snapK[F.snapK.length - 1], d = M.decidedBy(F, end, kD);
      const before = M.decidedBy(F, kD - 1, kD);
      check("density", `a deadline at ${at}, ${name}: the plate's last step is the deadline, every trial has decided there (within 1e-12), and the share forced to choose there is what was still deciding a step before`,
        end === kD && Math.abs(T[end] - at) < 1e-9 && Math.abs(d.up + d.lo - 1) < 1e-12 && Math.abs(d.forced - (1 - before.up - before.lo)) < 1e-12 && Math.abs(d.up - F.p) < 1e-12,
        `last step at ${T[end]}, decided ${(d.up + d.lo).toFixed(14)}, forced ${(100 * d.forced).toFixed(2)}%`);
    }
  }
  // the coefficient plate's last comparison is the last check before the deadline
  const r = M.shiftCoef((t) => (t <= 1 + 1e-12 ? 0.1 : Infinity), 1);
  check("coef", "the coefficient plate compares the last check before a deadline (0.99 for a deadline at 1), as well as every other check", Math.abs(r.t[r.t.length - 1] - 0.99) < 1e-9 && Math.abs(r.t[1] - 0.02) < 1e-9, `last ${r.t[r.t.length - 1]}, ${r.t.length} times`);
}
{
  // the trials: their continuous evidence against the scorer's grid, on every schedule the book offers at its settings
  let worstGrid = 0, ratio = 0, names = [];
  for (const choice of [...ALL, { id: "draw", points: Array(26).fill(2) }]) {
    const c = costOf(choice), H = horizonOf(choice), P = exactPolicy(c, H), T = Array.from(P.ts), b = Array.from(P.bounds, (v) => (Number.isFinite(v) ? v : 5));
    const g = Math.abs(score(b, T, c, 0.02).reward - score(b, T, c, 0.0025).reward);
    const sd = Math.sqrt(M.trialStats(M.trials(b, T, c, 4000, K.rng(3))).sd ** 2), se = sd / Math.sqrt(1e5);
    worstGrid = Math.max(worstGrid, g); if (g / se > ratio) { ratio = g / se; names = [choice.id]; }
  }
  check("trials", "the text's claim: on the book's schedules (and a flat drawing at its top cost), the grid's own error, an evidence step of 0.02 against 0.0025, is far smaller (under a fifth) than the standard error of 100,000 trials",
    ratio < 0.2, `largest grid move ${worstGrid.toExponential(1)}, at most ${ratio.toFixed(3)} standard errors (${names.join(", ")})`);
  const cost = costOf(preset("jump")), { ts, bounds } = exactPolicy(cost, 8.5), T = Array.from(ts), b = Array.from(bounds, (v) => (Number.isFinite(v) ? v : 5));
  const st = M.trialStats(M.trials(b, T, cost, 40000, K.rng(2026))), fine = score(b, T, cost, M.FINE_H).reward;
  check("trials", "jump, best bound: 40,000 trials land within 3 standard errors of the score on the finer grid the plate also prints", Math.abs(st.mean - fine) < 3 * st.se, `${st.mean.toFixed(4)} ± ${st.se.toFixed(4)} vs ${fine.toFixed(5)}`);
}
{
  // the backward plate below the grid's first step: on the 32-fold jump the program waits at 0 but decides at the first step
  const B = M.backward(costOf(preset("jump", { factor: 32 })), 8.5);
  const k = B.keepK.find((kk) => B.bounds[kk] > 0 && B.bounds[kk] < B.h);
  const sent = k === undefined ? "" : S.backwardSay(B.ts[k], B.bounds[k], 0.01, 8.5, false, 5, B.h);
  check("backward", "on the 32-fold jump, some slice's bound lies between the center and the grid's first step, and the plate's sentence says it is placed there and that the paper's code reports 0",
    k !== undefined && /placed between them/.test(sent) && !/reads as 0/.test(sent), k === undefined ? "none" : `at time ${B.ts[k].toFixed(2)}, bound ${B.bounds[k].toFixed(5)}`);
}
