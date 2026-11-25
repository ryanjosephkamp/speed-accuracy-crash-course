// Chapter 10: the paper's per-schedule results as the page draws them (book/assets/js/ch10-data.js) against the
// paper's generated tables and numbers; the page's rules, program, and scorer against the paper's code run on the
// page's grid (tools/validity/ch10.json, from tools/validity/ch10.py); the page's rebuilt schedules against the paper's
// own schedule functions; what the text says about the page's grid; the plates' computations on edge cases; and the
// sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import DATA from "../../book/assets/js/ch10-data.js";
import * as M from "../../book/assets/js/ch10-model.js";
import * as S from "../../book/assets/js/say-ch10.js";
import { meanLookAhead, firstOrder, perMomentResponse } from "../../book/assets/js/kernel.js";
import { grid, belief, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS } from "../../book/assets/js/schedules-book.js";
import { CHOICES, spec, costFromSpec } from "../validity/schedules.mjs";
import { check, N, table, ROOT, asPrinted } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch10.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
const strip = (c) => c.replace(/\\%/g, "").trim();
const f = (x, d) => x.toFixed(d);
const sg = (v, d) => { const out = (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(d); return +out === 0 ? out.slice(1) : out; };
const sci = (v) => { const [m, e] = v.toExponential(1).split("e"); return `$${m}\\times 10^{${+e}}$`; };

// ---- where the data came from -------------------------------------------------------------------------------------
check("data", "the page's data and the checks' reference were written from the paper's tag the book is built from",
  DATA.commit === SRC.commit && REF.commit === SRC.commit, `ch10-data.js from ${DATA.tag} (${DATA.commit.slice(0, 7)}), ch10.json ${REF.commit.slice(0, 7)}, book ${SRC.tag} (${SRC.commit.slice(0, 7)})`);
check("data", "90 development and 210 held-out schedules, 30 per family, and 36 rows for the loss formula",
  DATA.dev.length === 90 && DATA.held.length === +N.HeldCount && M.FAMILIES.every((fm) => DATA.held.filter((r) => r.f === fm).length === 30) && DATA.formula.length === 36,
  `${DATA.dev.length}, ${DATA.held.length}, ${DATA.formula.length}`);

// ---- the rebuilt schedules against the paper's own functions -------------------------------------------------------
{
  let worst = 0, mism = 0;
  const cmp = (rows, ref) => rows.forEach((r, i) => {
    const c = M.familyCost(r.f, r.p);
    REF.costs.times.forEach((t, k) => {
      const a = c(t), b = ref[i][k];
      if (b === null || !Number.isFinite(a)) { if ((b === null) !== !Number.isFinite(a)) mism++; return; }
      worst = Math.max(worst, Math.abs(a / b - 1));
    });
  });
  cmp(DATA.dev, REF.costs.dev); cmp(DATA.held, REF.costs.held);
  check("data", "each of the 300 rebuilt schedules matches the paper's schedule function (relative 1e-10, and infinite past a deadline exactly where it is)", worst < 1e-10 && mism === 0, `largest relative difference ${worst.toExponential(1)} at ${REF.costs.times.length} times each; ${mism} mismatched infinities`);
}

// ---- Table 3 and its numbers ---------------------------------------------------------------------------------------
{
  const T = table("tab_random"), FAMS = ["smooth", "step", "deadline"];
  let bad = [];
  FAMS.forEach((fm, j) => {
    const rs = DATA.dev.filter((r) => r.f === fm), pm = rs.map((r) => r.pm), wb = rs.map((r) => r.wb);
    const rec = 1 - wb.reduce((a, b) => a + b) / pm.reduce((a, b) => a + b);
    const mine = [String(rs.length), f(M.median(pm), 3), f(Math.max(...pm), 2), f(M.median(wb), 4), f(Math.max(...wb), 3), f(100 * rec, 1)];
    mine.forEach((v, c) => { if (v !== strip(T[j][c + 1])) bad.push(`${fm} col ${c + 2}: ${v} vs ${T[j][c + 1]}`); });
  });
  check("data", "Table 3, every cell, recomputed from the per-schedule results", bad.length === 0, bad.join("; ") || "18 cells");
  const rec = M.devRecovered(DATA);
  check("dev", "RecoveredSmooth, RecoveredStep, RecoveredDeadline", asPrinted(100 * rec.smooth, N.RecoveredSmooth) && asPrinted(100 * rec.step, N.RecoveredStep) && asPrinted(100 * rec.deadline, N.RecoveredDeadline), `${f(100 * rec.smooth, 2)}, ${f(100 * rec.step, 2)}, ${f(100 * rec.deadline, 2)}`);
  check("dev", "PerMomentMaxAll and WeightedMaxAll", asPrinted(Math.max(...DATA.dev.map((r) => r.pm)), N.PerMomentMaxAll) && asPrinted(Math.max(...DATA.dev.map((r) => r.wb)), N.WeightedMaxAll), `${N.PerMomentMaxAll}, ${N.WeightedMaxAll}`);
  const worstFam = Object.keys(rec).reduce((a, b) => (rec[b] < rec[a] ? b : a));
  check("dev", "the text: deadlines are where the weighted rule recovers the smallest share, and the largest weighted loss is on a step", worstFam === "deadline" && DATA.dev.reduce((a, r) => (r.wb > a.wb ? r : a)).f === "step", `smallest share: ${worstFam}`);
  const ratio = FAMS.map((fm) => { const rs = DATA.dev.filter((r) => r.f === fm); return M.median(rs.map((r) => r.wb)) / M.median(rs.map((r) => r.pm)); });
  check("dev", "the text: in each development family, the weighted rule's median loss is less than a tenth of the per-moment rule's", ratio.every((r) => r < 0.1), ratio.map((r) => r.toFixed(3)).join(", "));
}

// ---- Table 5, Figure 5, and their numbers ------------------------------------------------------------------------------
{
  const T = table("tab_heldout"), bad = [];
  M.FAMILIES.forEach((fm, j) => {
    const rs = DATA.held.filter((r) => r.f === fm), pm = rs.map((r) => M.lossOf(r, 0)), wb = rs.map((r) => M.lossOf(r, 1)), rec = M.recovered(rs);
    const mine = [String(rs.length), f(M.median(pm), 3), f(Math.max(...pm), 2), f(M.median(wb), 4), f(Math.max(...wb), 3), f(100 * M.median(rec), 1), f(100 * M.percentile(rec, 10), 1), f(100 * (1 - wb.reduce((a, b) => a + b) / pm.reduce((a, b) => a + b)), 1)];
    mine.forEach((v, c) => { if (v !== strip(T[j][c + 1])) bad.push(`${fm} col ${c + 2}: ${v} vs ${T[j][c + 1]}`); });
  });
  check("data", "Table 5, every cell, recomputed from the per-schedule results", bad.length === 0, bad.join("; ") || "56 cells");
  const s = M.heldSummary(DATA), pm = DATA.held.map((r) => M.lossOf(r, 0)), wb = DATA.held.map((r) => M.lossOf(r, 1));
  check("held", "HeldRecoveredCount, HeldRecoveredMedian, HeldRecoveredPTen, HeldRecoveredMin (the shares the plate and the hero print)",
    String(s.n) === N.HeldRecoveredCount && asPrinted(100 * s.med, N.HeldRecoveredMedian) && asPrinted(100 * s.p10, N.HeldRecoveredPTen) && asPrinted(100 * s.min, N.HeldRecoveredMin),
    `${s.n}, ${f(100 * s.med, 2)}, ${f(100 * s.p10, 2)}, ${f(100 * s.min, 2)}`);
  check("held", "HeldPerMomentMedian, HeldPerMomentMax, HeldWeightedMedian, HeldWeightedMax",
    asPrinted(M.median(pm), N.HeldPerMomentMedian) && asPrinted(Math.max(...pm), N.HeldPerMomentMax) && asPrinted(M.median(wb), N.HeldWeightedMedian) && asPrinted(Math.max(...wb), N.HeldWeightedMax), `${N.HeldPerMomentMedian}, ${N.HeldPerMomentMax}, ${N.HeldWeightedMedian}, ${N.HeldWeightedMax}`);
  const fams = Object.entries(s.byFam);
  const lowMed = fams.reduce((a, b) => (b[1].med < a[1].med ? b : a))[0], lowP10 = fams.reduce((a, b) => (b[1].p10 < a[1].p10 ? b : a))[0];
  const worstWb = DATA.held.reduce((a, r) => (M.lossOf(r, 1) > M.lossOf(a, 1) ? r : a)).f;
  check("held", "the text: piecewise schedules have the lowest median and 10th percentile, and the weighted rule's largest loss", lowMed === "piecewise" && lowP10 === "piecewise" && worstWb === "piecewise", `${lowMed}, ${lowP10}, ${worstWb}`);
  const ten = DATA.held.filter((r) => M.lossOf(r, 0) >= 0.01 && M.lossOf(r, 1) <= 0.1 * M.lossOf(r, 0)).length;
  check("held", "the hero's words: most of the held-out schedules sit below the 10% line", ten > DATA.held.length / 2, `${ten} of ${DATA.held.length} with a per-moment loss of at least 0.01 and a weighted loss at most a tenth of it`);
}

// ---- Table 6 and its numbers -------------------------------------------------------------------------------------------
{
  const T = table("tab_baselines"), nodl = DATA.held.filter((r) => r.f !== "deadline"), dl = DATA.held.filter((r) => r.f === "deadline"), bad = [];
  M.RULES.forEach((k, j) => {
    const a = nodl.map((r) => M.lossOf(r, j)), d = dl.map((r) => M.lossOf(r, j)), wl = M.winsLosses(nodl, j);
    const mine = [f(M.median(a), 4), f(M.percentile(a, 90), 3), f(Math.max(...a), 2), j === 0 ? "--" : `${wl.wins} / ${wl.losses}`, f(M.median(d), 3), f(Math.max(...d), 2)];
    if (M.RULE_NAMES[k] !== T[j][0]) bad.push(`row ${j + 1} is ${T[j][0]}, not ${M.RULE_NAMES[k]}`);
    mine.forEach((v, c) => { if (v !== strip(T[j][c + 1])) bad.push(`${k} col ${c + 2}: ${v} vs ${T[j][c + 1]}`); });
  });
  check("seven", "Table 6, every cell, recomputed from the per-schedule results (the panels' win and loss counts among them)", bad.length === 0, bad.join("; ") || "42 cells");
  const pairs = [["shift_mean", "ShiftMean"], ["shift_half", "ShiftHalf"], ["best_constant", "BestConstant"], ["averaged_cost", "AveragedCost"], ["weighted_one_pass", "OnePass"]];
  const badM = pairs.filter(([k, n]) => { const j = M.RULES.indexOf(k), wl = M.winsLosses(nodl, j); return String(wl.wins) !== N[`Held${n}Beats`] || String(wl.losses) !== N[`Held${n}Worse`] || !asPrinted(Math.max(...DATA.held.map((r) => M.lossOf(r, j))), N[`Held${n}Max`]); });
  check("seven", "Held*Beats, Held*Worse, and Held*Max for the five more rules, and HeldNoDeadlineCount", badM.length === 0 && String(nodl.length) === N.HeldNoDeadlineCount, badM.map((p) => p[1]).join(", ") || `${nodl.length} without a deadline`);
}

// ---- Table 7 ------------------------------------------------------------------------------------------------------------
{
  const T = table("tab_behavior"), bad = [];
  M.FAMILIES.forEach((fm, j) => {
    const rs = DATA.held.filter((r) => r.f === fm);
    const med = (k, g) => M.median(rs.map((r) => g(r, k)));
    const dx = (r, k) => r.r[k][3], dp = (r, k) => 100 * (r.r[k][1] - r.ex[1]), drt = (r, k) => r.r[k][2] - r.ex[2];
    const mine = [f(med(0, dx), 3), f(med(1, dx), 3), sg(med(0, dp), 2), sg(med(1, dp), 2), sg(med(0, drt), 3), sg(med(1, drt), 3)];
    mine.forEach((v, c) => { if (v !== strip(T[j][c + 1])) bad.push(`${fm} col ${c + 2}: ${v} vs ${T[j][c + 1]}`); });
  });
  check("data", "Table 7, every cell, recomputed from the per-schedule results", bad.length === 0, bad.join("; ") || "42 cells");
}

// ---- close in reward ----------------------------------------------------------------------------------------------------
{
  const share = DATA.held.map((r) => M.lossOf(r, 0) / (100 * r.ex[0])), pm = DATA.held.map((r) => M.lossOf(r, 0));
  check("share", "HeldShareMedian and HeldShareMax: the per-moment loss as a share of the best policy's reward", asPrinted(100 * M.median(share), N.HeldShareMedian) && asPrinted(100 * Math.max(...share), N.HeldShareMax), `${f(100 * M.median(share), 3)}%, ${f(100 * Math.max(...share), 2)}%`);
  check("share", "HeldPerMomentUnderTenth and HeldPerMomentOverOne", String(pm.filter((v) => v < 0.1).length) === N.HeldPerMomentUnderTenth && String(pm.filter((v) => v >= 1).length) === N.HeldPerMomentOverOne, `${pm.filter((v) => v < 0.1).length}, ${pm.filter((v) => v >= 1).length}`);
  const off = share.filter((v) => v < 1e-6).length, gaps = DATA.held.map((r) => r.r[0][3]);
  check("share", "the plate's axes hold every point: a few shares below 0.0001%, one of them negative (drawn at it, as the caption says), and every gap within 2.6", off >= 1 && off <= 3 && share.filter((v) => v < 0).length === 1 && Math.max(...gaps) <= 2.6, `${off} below, ${share.filter((v) => v < 0).length} negative, largest gap ${Math.max(...gaps).toFixed(3)}`);
}

// ---- Table 8 ------------------------------------------------------------------------------------------------------------
{
  const T = table("tab_loss"), rows = M.formulaRows(DATA), bad = [];
  rows.forEach((r, j) => {
    const mine = [f(r.pmLoss, 4), f(r.pmPred / r.pmLoss, 2), f(r.wbLoss, 5), f(r.wbPred / r.wbLoss, 2)];
    mine.forEach((v, c) => { if (v !== strip(T[j][c + 2])) bad.push(`row ${j + 1} col ${c + 3}: ${v} vs ${T[j][c + 2]}`); });
  });
  check("formula", "Table 8, every number, recomputed from the per-schedule results", bad.length === 0, bad.join("; ") || "24 cells");
  const pr = rows.map((r) => r.pmPred / r.pmLoss), wr = rows.map((r) => r.wbPred / r.wbLoss), mod = pr.slice(0, 5);
  const tot = rows.reduce((a, r) => a + r.pmLoss, 0) / rows.reduce((a, r) => a + r.wbLoss, 0);
  check("formula", "LossPmLow, LossPmHigh, LossPmSixteen, LossWbLow, LossWbHigh, LossTotalRatio",
    String(Math.round(100 * (Math.min(...mod) - 1))) === N.LossPmLow && String(Math.round(100 * (Math.max(...mod) - 1))) === N.LossPmHigh && String(Math.round(100 * (pr[5] - 1))) === N.LossPmSixteen
    && asPrinted(Math.min(...wr), N.LossWbLow) && asPrinted(Math.max(...wr), N.LossWbHigh) && String(Math.round(tot)) === N.LossTotalRatio,
    `${mod.map((v) => v.toFixed(3)).join(", ")}; 16-fold ${pr[5].toFixed(3)}; weighted ${Math.min(...wr).toFixed(3)} to ${Math.max(...wr).toFixed(3)}; totals ${tot.toFixed(1)}`);
  const late = rows.map((r) => r.wbLate / r.wbPred);
  check("formula", "the text: at the smallest size of each family, most of the weighted rule's prediction comes from t > 8", late[0] > 0.5 && late[3] > 0.5, late.map((v) => v.toFixed(3)).join(", "));
}

// ---- Table 9, and Table 9's shape on the page's grid ---------------------------------------------------------------------
{
  const T = table("tab_scaling"), sc = DATA.scaling, bad = [];
  let prev = null;
  sc.rows.forEach((r, j) => {
    const g = prev ? f(r.paper.per_moment / prev.paper.per_moment, 1) : "---";
    const mine = [String(r.amplitude), sci(r.paper.per_moment), g, sci(r.paper.weighted), sci(r.fine.weighted)];
    mine.forEach((v, c) => { if (v !== T[j][c]) bad.push(`row ${j + 1} col ${c + 1}: ${v} vs ${T[j][c]}`); });
    prev = r;
  });
  check("scaling", "Table 9, every cell, from the per-schedule results", bad.length === 0, bad.join("; ") || "25 cells");
  const o = M.scalingOrders(sc), two = sc.rows.find((r) => r.amplitude === 0.2);
  check("scaling", "ScalingPmOrder, ScalingWbOrderLow and High, ScalingPmGrowthLow and High, ScalingGridChangeTwo, ScalingCost (what the plate prints)",
    asPrinted(o.pm, N.ScalingPmOrder) && asPrinted(Math.min(o.wbPaper, o.wbFine), N.ScalingWbOrderLow) && asPrinted(Math.max(o.wbPaper, o.wbFine), N.ScalingWbOrderHigh)
    && asPrinted(Math.min(...o.growth), N.ScalingPmGrowthLow) && asPrinted(Math.max(...o.growth), N.ScalingPmGrowthHigh)
    && String(Math.round(100 * Math.abs(two.fine.weighted / two.paper.weighted - 1))) === N.ScalingGridChangeTwo && String(sc.cost) === N.ScalingCost && M.SCALING.c0 === sc.cost,
    `${o.pm.toFixed(3)}, ${o.wbPaper.toFixed(3)} and ${o.wbFine.toFixed(3)}, growth ${o.growth.map((v) => v.toFixed(2)).join(", ")}`);
  check("scaling", "the plate's shape is experiments/loss_scaling.py's", sc.shape === "0.6 sin(1.3t + 0.4) + 0.5 sin(3.1t + 2.0) + 0.4 sin(5.2t + 4.0)" && Math.abs(M.scalingShape(0.7) - (0.6 * Math.sin(1.3 * 0.7 + 0.4) + 0.5 * Math.sin(3.1 * 0.7 + 2) + 0.4 * Math.sin(5.2 * 0.7 + 4))) < 1e-15, sc.shape);
  const ref = REF.scalingPage, page = [0, ...M.SCALING.amps].map((a) => ({ a, ...M.scalingLosses(a) }));
  let worst = 0;
  page.forEach((r) => { const q = r.a === 0 ? ref.floor : ref.rows.find((x) => x.amplitude === r.a); worst = Math.max(worst, Math.abs(r.pm - q.per_moment), Math.abs(r.wb - q.weighted)); });
  check("scaling", "the page's grid run of Table 9's shape matches the paper's code on the same grid (within 1e-5 points per 100 trials)", worst < 1e-5, `largest difference ${worst.toExponential(1)}`);
  const paperWb = (a) => sc.rows.find((r) => r.amplitude === a).paper.weighted;
  const apart = (r) => !(r.wb > 0 && paperWb(r.a) > 0 && Math.abs(r.wb / paperWb(r.a) - 1) <= 0.5);
  const off = page.filter((r) => r.a > 0 && apart(r)).map((r) => r.a), on = page.filter((r) => r.a > 0 && !apart(r)).map((r) => r.a);
  check("scaling", "the text, run on the page's grid: at the three smallest amplitudes its weighted losses differ from the paper's grid in sign or by more than half, at 0.4 and 0.8 they don't, and the per-moment loss at the constant cost is negative",
    off.join() === "0.05,0.1,0.2" && on.join() === "0.4,0.8" && page[0].pm < 0, `apart at ${off.join(", ")}; within half at ${on.join(", ")}; constant cost ${page[0].pm.toExponential(2)}`);
  const sp = S.scalingPage(page, sc.rows.map((r) => ({ a: r.amplitude, pm: r.paper.per_moment, wb: r.paper.weighted })));
  const offRows = page.filter((r) => [0.05, 0.1, 0.2].includes(r.a)), listOf = (xs) => `${xs[0]}, ${xs[1]}, and ${xs[2]}`;
  check("words", "the scaling plate's page-grid sentence gives the constant-cost loss with its sign as one difference, not an error bound, and where the two grids differ in sign or by more than half (a = 0.05, 0.1, and 0.2) gives both grids' signed losses, with no claim about what a grid resolves",
    /−1\.8 × 10⁻⁴/.test(sp) && /not an error bound/.test(sp) && /at a = 0\.05, 0\.1, and 0\.2, the two grids differ in sign or by more than half/.test(sp)
    && sp.includes(`this grid gives ${listOf(offRows.map((r) => S.num(r.wb)))}, the paper's ${listOf(offRows.map((r) => S.num(paperWb(r.a))))}`) && !/resolves/.test(sp) && !/NaN|undefined/.test(sp), sp);
  const r1 = sc.rows.find((r) => r.amplitude === 0.1), rel = (r) => Math.abs(r.fine.weighted / r.paper.weighted - 1);
  check("scaling", "the text: at a = 0.1 the paper's two grids agree on the weighted loss more closely than at 0.2, on a loss under 1e-6 points, and at 0.05 they differ in sign",
    rel(r1) < rel(two) && Math.max(r1.paper.weighted, r1.fine.weighted) < 1e-6 && Math.sign(sc.rows[0].paper.weighted) !== Math.sign(sc.rows[0].fine.weighted),
    `${(100 * rel(r1)).toFixed(1)}% at 0.1 against ${(100 * rel(two)).toFixed(1)}% at 0.2`);
}

// ---- the page's rules against the paper's code on the page's grid ------------------------------------------------------------
// The program's bound is compared time by time with the paper's (tools/validity/ch10.json keeps it at every grid time before
// min(4, deadline), where the gap statistic is measured). The two may differ in one kind of cell only: where the page
// places a bound below the grid's first step (between 0 and h) because its program still waits at the center, and the
// paper's code reports 0 (model.js; chapter 9). Each rule's gap statistic is then recomputed against the paper's own
// program bound and must match the paper's to 1e-6; and the page's displayed statistic, recomputed here from the page's
// own time-indexed bounds (the rule's bound as scored and the page's program bound, both capped at 4, at the grid times
// before min(4, deadline)), must match it to 1e-6, with no allowance for the sub-step cells.
{
  const cmp = (name, r, ref, rules) => {
    const ts = r.raw.ts, early = Math.min(4, r.horizon), h = r.h;
    const nEarly = ts.filter((t) => t < early).length;
    const paperEx = ref.early.map((v) => (v === null ? Infinity : v));
    let dEx = 0, sub = 0;
    for (let k = 0; k < paperEx.length; k++) {
      const a = r.raw.exact[k], b = paperEx[k];
      if (a > 0 && a < h && b === 0) { sub++; continue; }
      if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
      dEx = Math.max(dEx, Math.abs(a - b));
    }
    let worst = 0, dxPaper = 0, dxShown = 0, dxPaperShown = 0;
    for (const k of rules) {
      const a = r.rules[k], b = ref[k];
      worst = Math.max(worst, Math.abs(a.loss - b.loss), 100 * Math.abs(a.p - b.p), 100 * Math.abs(a.rt - b.rt));
      dxPaper = Math.max(dxPaper, Math.abs(M.maxGap(ts, r.raw.rules[k], paperEx, r.horizon) - b.max_dx));
      let mine = 0;
      for (let j = 0; j < ts.length && ts[j] < early; j++) mine = Math.max(mine, Math.abs(Math.min(r.raw.rules[k][j], 4) - Math.min(r.raw.exact[j], 4)));
      dxShown = Math.max(dxShown, Math.abs(a.maxDx - mine));
      dxPaperShown = Math.max(dxPaperShown, Math.abs(a.maxDx - b.max_dx));
    }
    const ex = Math.max(Math.abs(r.exact.reward - ref.exact.reward), Math.abs(r.exact.p - ref.exact.p), Math.abs(r.exact.rt - ref.exact.rt));
    const x = rules.includes("best_constant") ? Math.abs(r.x - ref.best_constant.x) : 0;
    const shownOk = dxShown < 1e-6 && (sub > 0 || dxPaperShown < 1e-6);
    check("rules", `${name}: the page's program matches the paper's code at every grid time before min(4, deadline) within 1e-6, except cells below the grid's first step where the paper's reports 0; its ${rules.length} rules' losses, accuracy, and decision time within 1e-5 points; their gap statistic within 1e-6 against the paper's program bound; each displayed gap within 1e-6 of the gap recomputed from the page's own bounds (and of the paper's where no sub-step cell exists); tuned bound within 1e-6`,
      paperEx.length === nEarly && dEx < 1e-6 && worst < 1e-5 && dxPaper < 1e-6 && shownOk && ex < 1e-7 && x < 1e-6,
      `program bound ${dEx.toExponential(1)} (${sub} sub-step cells of ${nEarly}), loss etc. ${worst.toExponential(1)}, gap statistic ${dxPaper.toExponential(1)} (as shown, against the page's bounds ${dxShown.toExponential(1)}, against the paper's ${dxPaperShown.toExponential(1)}), program value ${ex.toExponential(1)}, tuned bound ${x.toExponential(1)}`);
    return sub;
  };
  let subTotal = 0, sub150 = null;
  for (const ch of CHOICES) {
    const s = spec(ch), r = M.runRules(costFromSpec(s), s.kind === "deadline" ? s.at : null, { raw: true });
    subTotal += cmp(`preset ${s.id}`, r, REF.pageGrid.presets[s.id], M.RULES);
  }
  const grid = [];
  for (const [set, rows] of [["dev", DATA.dev], ["held", DATA.held]]) {
    for (const [i, ref] of Object.entries(REF.pageGrid[set])) {
      const row = rows[+i], r = M.runRules(M.familyCost(row.f, row.p), M.familyDeadline(row.f, row.p), { raw: true });
      const nSub = cmp(`${set === "dev" ? "development" : "held-out"} schedule ${i} (${row.f})`, r, ref, M.RULES);
      subTotal += nSub;
      if (set === "held" && +i === 150) sub150 = nSub;
      const paper = set === "dev" ? { pm: row.pm, wb: row.wb } : { pm: M.lossOf(row, 0), wb: M.lossOf(row, 1) };
      grid.push({ name: `${set} ${i}`, pm: [r.rules.per_moment.loss, paper.pm], wb: [r.rules.weighted.loss, paper.wb] });
    }
  }
  check("rules", "the exception above is used: held-out schedule 150, compared on its own, reaches a bound below the grid's first step, so the time-by-time rule is tested", sub150 !== null && sub150 > 0, `${sub150} such cells on held-out schedule 150, ${subTotal} in all`);
  const pmRel = Math.max(...grid.map((g) => Math.abs(g.pm[0] / g.pm[1] - 1)));
  check("grid", "the text: on the paper's schedules the checks run, the page's per-moment losses are within 5% of the paper's", pmRel <= 0.05, `largest relative difference ${(100 * pmRel).toFixed(1)}% over ${grid.length} schedules`);
  const big = grid.filter((g) => g.wb[1] >= 0.001), wbRel = Math.max(...big.map((g) => Math.abs(g.wb[0] / g.wb[1] - 1)));
  const sign = grid.some((g) => Math.abs(g.wb[1]) < 0.001 && Math.sign(g.wb[0]) !== Math.sign(g.wb[1]));
  check("grid", "the text: their weighted losses are within 30% of the paper's where the paper's are at least 0.001, and below that one differs in sign", wbRel <= 0.3 && sign, `${big.length} at least 0.001, largest relative difference ${(100 * wbRel).toFixed(1)}%; a sign difference below: ${sign}`);
}

// ---- the five more rules' pieces ------------------------------------------------------------------------------------------
{
  const bad = [0.01, 0.05, 0.1, 0.3, 1].filter((c) => Math.abs(M.meanLookAheadTable(c) - meanLookAhead(c)) > 2e-3);
  check("rules", "the closed form behind the shifted rule, c (sinh 2b / 2 - b + 2 b^2 tanh b), is the kernel's mean from its series (within 2e-3, the table's interpolation)", bad.length === 0, [0.01, 0.1, 1].map((c) => `${M.meanLookAheadTable(c).toFixed(4)} vs ${meanLookAhead(c).toFixed(4)}`).join("; "));
  const r = M.fminbound((x) => (x - 1.3) ** 2 + 0.1, 0.02, 4, 0.005);
  check("rules", "the bounded search finds the minimum of a parabola to its tolerance, and stops at the bound for a monotone function", Math.abs(r.x - 1.3) < 0.005 && M.fminbound((x) => x, 0.02, 4, 0.005).x < 0.03, `${r.x.toFixed(4)} in ${r.nfev} evaluations`);
  check("rules", "the mean look-ahead is 0 past a deadline, as the paper's code takes it", M.meanLookAheadTable(Infinity) === 0, "0");
}

// ---- the plates' computations on edge cases -------------------------------------------------------------------------------
{
  const P0 = (id) => Object.fromEntries(PRESETS.find((p) => p.id === id).params.map((q) => [q.id, q.value]));
  const cases = [
    ["Deadline at its default", { id: "deadline", params: P0("deadline") }],
    ["Deadline on an odd time step (0.955) at the largest cost", { id: "deadline", params: { at: 0.955, c: 0.5 } }],
    ["Deadline at its earliest (0.4) and cheapest", { id: "deadline", params: { at: 0.4, c: 0.02 } }],
    ["Constant", { id: "constant", params: P0("constant") }],
    ["Smooth at size 0", { id: "smooth", params: { c0: 0.1, size: 0 } }],
    ["a flat drawing", { id: "draw", points: Array(26).fill(0.2) }],
    ["Rising at its steepest", { id: "rising", params: { at: 0, rate: 2 } }],
    ["Cost jumps 32-fold at time 2", { id: "jump", params: { at: 2, factor: 32 } }],
    ["Pulse at its largest", { id: "pulse", params: { at: 2, factor: 32 } }],
    ["Piecewise at twice the level, held 0.8", { id: "piecewise", params: { scale: 2, length: 0.8 } }],
  ];
  const NAMES = M.SAY_NAMES;
  let closeOk = true, closeAt = "", nDl = 0, nFlat = 0;
  for (const [name, choice] of cases) {
    const dl = deadlineOf(choice), r = M.runRules(costOf(choice), dl);
    const fin = M.RULES.every((k) => Number.isFinite(r.rules[k].loss) && Number.isFinite(r.rules[k].maxDx) && Number.isFinite(r.rules[k].p) && Number.isFinite(r.rules[k].rt));
    const endsRight = dl === null ? Math.abs(r.t[r.t.length - 1] - 4) < 1e-9 : Math.abs(r.t[r.t.length - 1] - Math.round(dl / 0.01) * 0.01) < 1e-9;
    const flat = name === "Constant" || name === "Smooth at size 0" || name === "a flat drawing";
    const ties = flat ? M.RULES.filter((k) => k !== "best_constant").every((k) => Math.abs(r.rules[k].loss - r.rules.per_moment.loss) < 1e-9) : true;
    const sents = [S.yoursSay(name, r, NAMES, flat, 180, dl !== null), S.shareYours(name, r.rules.per_moment.maxDx, r.rules.per_moment.loss, r.exact.reward, dl !== null && dl < 4 ? "the deadline" : "t = 4")];
    const clean = sents.every((s) => !/NaN|undefined|Infinity|null/.test(s));
    check("edges", `${name}: every rule's loss, accuracy, time, and gap is finite, the curves end at ${dl === null ? "t = 4" : "the deadline's grid time"}${flat ? ", every rule but the tuned constant ties the per-moment rule," : ""} and the sentences read cleanly`,
      fin && endsRight && ties && clean, `per-moment ${S.num(r.rules.per_moment.loss)}, weighted ${S.num(r.rules.weighted.loss)}, tuned ${S.num(r.rules.best_constant.loss)}; ends at ${r.t[r.t.length - 1].toFixed(2)}; ${sents[0].slice(0, 90)}…`);
    const ok = flat ? /forced choice at t = 10.*shift.*leading order.*grid/.test(sents[0]) && !/Table 6/.test(sents[0])
      : dl !== null ? /Table 6's last two columns give the median and largest losses over the held-out schedules with a deadline\.$/.test(sents[0].replace(" " + S.NEGATIVE, "")) && !/without a deadline/.test(sents[0])
      : /Table 6 counts the 180 held-out schedules without a deadline\.$/.test(sents[0].replace(" " + S.NEGATIVE, ""));
    if (flat) nFlat++; if (dl !== null) nDl++;
    if (!ok && closeOk) { closeOk = false; closeAt = name; }
  }
  check("edges", "the plate's sentence names three sources of a flat cost's loss (the forced choice, the shift, and the grid), ends on a deadline with Table 6's deadline columns, and otherwise with Table 6's count of schedules without a deadline", closeOk, closeAt || `${cases.length} edge inputs, ${nFlat} flat and ${nDl} with a deadline`);
}

// ---- the sentences ----------------------------------------------------------------------------------------------------------
{
  let bad = 0, n = 0;
  const R = (() => { let s = 9; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const fake = (pm, wb, others) => ({ rules: { per_moment: { loss: pm }, weighted: { loss: wb }, ...Object.fromEntries(M.RULES.slice(2).map((k, i) => [k, { loss: others[i] }])) } });
  for (let i = 0; i < 3000; i++) {
    const pm = (R() - 0.05) * 10 ** (4 * R() - 4), wb = (R() - 0.1) * pm, others = M.RULES.slice(2).map(() => (R() * 2) * Math.abs(pm));
    const say = [
      S.heroLabel(i % 2 ? "Piecewise" : null, R(), Math.floor(R() * 200)),
      S.devVerdict([null, "smooth", "step", "deadline"][i % 4], { smooth: R(), step: R(), deadline: R() }),
      S.devTap("Step from 0.36 to 0.15 at time 0.12", { pm: R() * 2, wb: (R() - 0.3) * 1e-3 }, { pm: R() * 2, wb: (R() - 0.5) * 1e-3 }),
      S.heldVerdict(i % 5 ? R() : null, R(), R(), R(), 180),
      S.heldTap("Pulse from 0.10, 2.30 times at time 1.20", pm, wb),
      S.yoursSay("Cost jumps", fake(pm, wb, others), M.SAY_NAMES, i % 9 === 0),
      S.shareVerdict(i % 4 ? 10 ** (-4 + 3 * R()) : null, 0.0016),
      S.shareYours("Wave", 3 * R(), pm, 0.5 + 0.4 * R(), i % 2 ? "t = 4" : "the deadline"),
      S.formulaVerdict([null, "over", "about", "under"][i % 4], 0.8 + R(), 1 + R() * 0.1, 1.1 + R() * 0.1),
      S.lateSay(R(), R()),
      S.scalingVerdict({ pm: i % 3 ? [2, 4, 8, 16][i % 4] : null, wb: i % 5 ? [2, 4, 8, 16][(i + 1) % 4] : null }, [3.5 + R(), 3.7 + R() * 0.3], { pm: 1.9, wbPaper: 3.7, wbFine: 3.9 }),
      S.num((R() - 0.5) * 10 ** (8 * R() - 6)),
    ];
    for (const s of say) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const v = S.devVerdict("deadline", { smooth: 0.979, step: 0.978, deadline: 0.955 });
  check("words", "the development verdict names the family with the smallest share and says the guess was right", /^Right\. .*deadlines: 95\.5%/.test(v), v);
  const h = S.heldVerdict(0.5, 0.983, 0.904, 0.558, 180);
  check("words", "the held-out verdict says how far a guess is from the median, in points, and gives the median's scope", /48\.3 points low/.test(h) && /180 schedules where the per-moment rule loses at least 0\.01/.test(h), h);
  check("words", "the share avoided is printed only where the per-moment loss is at least 0.01", /under 0\.01/.test(S.heldTap("x", 0.005, 0.0001)) && /avoids 98\.0%/.test(S.heldTap("x", 0.5, 0.01)), S.heldTap("x", 0.005, 0.0001));
  const a1 = S.agree("weighted", 1.2e-5, -2.5e-5), a2 = S.agree("per-moment", 0.169, 0.168), a3 = S.agree("weighted", 1e-4, 2.6e-4);
  check("words", "two grids that differ in sign say so, two more than half apart say by how much of the paper's, and two that agree say within how much; none claims what a grid resolves",
    /differ on the weighted loss even in sign/.test(a1) && /within 1%/.test(a2) && /by 160% of the paper's/.test(a3) && ![a1, a2, a3].some((x) => /resolves/.test(x)), `${a1} | ${a2} | ${a3}`);
  const sv = S.shareVerdict(0.01, 0.0016);
  check("words", "the share verdict says how many times too high a guess is", /about 6\.3 times too high/.test(sv), sv);
  check("words", "small losses print in powers of ten, with the minus sign", S.num(-2.5e-5) === "−2.5 × 10⁻⁵" && S.num(9.96e-5) === "1.0 × 10⁻⁴" && S.num(0.0123) === "0.012" && S.num(42.64) === "42.6", `${S.num(-2.5e-5)}, ${S.num(9.96e-5)}, ${S.num(0.0123)}, ${S.num(42.64)}`);
  const sy = [S.shareYours("Deadline", 1.09, 0.845, 0.66, "the deadline"), S.shareYours("Cost jumps", 0.53, 0.907, 0.71, "t = 4")];
  check("words", "the reader's gap is said before the deadline, or before t = 4", /before the deadline,/.test(sy[0]) && /before t = 4,/.test(sy[1]), sy.join(" | "));
  const fv = S.formulaVerdict("over", 1.3623, 1.014, 1.054);
  check("words", "the formula verdict prints the 16-fold ratio as Table 8 does", /1\.36 times/.test(fv) && /^Right/.test(fv), fv);
}

// ---- what the audits' fixes say, run on the page's real computation -------------------------------------------------------
{
  /** The program's own value at the start, V(0, 0): exactPolicy's backward pass on the same grid, kept to the end. */
  function programValue(cost, horizon, dt = 0.01, h = 0.02, cap = 5) {
    const steps = Math.round(horizon / dt), { x, m, n, r, kUp, kDown } = grid(dt, h, cap);
    const g = Float64Array.from(x, belief), decide = Float64Array.from(g, (gi) => Math.max(gi, 1 - gi));
    let v = Float64Array.from(decide);
    const wait = new Float64Array(n);
    for (let k = steps - 1; k >= 0; k--) {
      const ck = Math.min(cost(k * dt), 1e9) * dt;
      for (let i = 0; i < n; i++) {
        let up = 0, down = 0;
        for (let j = -r; j <= r; j++) { const idx = i + j, vj = idx < 0 || idx >= n ? decide[idx < 0 ? 0 : n - 1] : v[idx]; up += kUp[j + r] * vj; down += kDown[j + r] * vj; }
        wait[i] = g[i] * up + (1 - g[i]) * down - ck;
      }
      for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
    }
    return v[m];
  }
  // a constant cost of 0.2 and the Constant preset: the program's bound as scored earns less than the program's value,
  // some rules score above the former, and none above the latter
  for (const [name, c] of [["a constant cost of 0.2", 0.2], ["the Constant preset (0.1)", 0.1]]) {
    const cost = () => c, run = M.runRules(cost, null), v0 = programValue(cost, M.HORIZON);
    const rewards = M.RULES.map((k) => run.exact.reward - run.rules[k].loss / 100);
    const negs = M.RULES.filter((k) => run.rules[k].loss < 0);
    check("words", `${name}, on the page's grid: the sentence on negative losses holds (the program's bound as scored earns less than the program's own value, ${negs.length} rules score above the former, and none above the latter)`,
      run.exact.reward < v0 && negs.length > 0 && rewards.every((x) => x <= v0 + 1e-12), `value ${v0.toFixed(8)}, bound as scored ${run.exact.reward.toFixed(8)}, best rule ${Math.max(...rewards).toFixed(8)}; negative: ${negs.join(", ")}`);
    const say = S.yoursSay(name, run, M.SAY_NAMES, true, DATA.held.filter((r) => r.f !== "deadline").length);
    check("words", `${name}: the reader's sentence explains a negative loss by the scored reference`, /measured against the program's bound as the scorer applies it/.test(say), say.slice(-200));
  }
  // the share plate on a flat drawing at 0.2: a negative loss is reported with its sign, not as 0%
  {
    const choice = { id: "draw", points: Array(26).fill(0.2) }, run = M.runRules(costOf(choice), null);
    const loss = run.rules.per_moment.loss, sh = loss / (100 * run.exact.reward), say = S.shareYours("a flat drawing at 0.2", run.rules.per_moment.maxDx, loss, run.exact.reward, "t = 4");
    check("share", "a flat drawing at 0.2: the per-moment loss is negative on this grid, and the readout and sentence give it with its sign", loss < 0 && S.sharePct(sh).startsWith("−") && /negative difference at the level of the grid/.test(say) && !/0%/.test(S.sharePct(sh)), `${S.num(loss)} points, ${S.sharePct(sh)}; ${say.slice(0, 160)}…`);
  }
  // the share plate's gap curves: the times the paper's statistic covers, with a deadline's forced choice left out
  {
    const dl = M.runRules(costOf({ id: "deadline", params: { at: 1, c: 0.1 } }), 1), g = M.gapCurves(dl);
    const top = Math.max(...g.pm.map(Math.abs).filter(Number.isFinite));
    check("share", "on the Deadline preset, the gap curves stop before the forced choice, which is marked, and never exceed the per-moment gap statistic",
      g.t[g.t.length - 1] < 1 && g.forced !== null && Math.abs(g.forced - 1) < 1e-9 && top <= dl.rules.per_moment.maxDx + 1e-12, `last time ${g.t[g.t.length - 1].toFixed(2)}, forced choice at ${g.forced}, largest drawn gap ${top.toFixed(4)} against ${dl.rules.per_moment.maxDx.toFixed(4)}`);
    const jp = M.runRules(costOf({ id: "jump", params: { at: 0.5, factor: 16 } }), null), gj = M.gapCurves(jp);
    check("share", "on Cost jumps, the gap curves run to just before t = 4 with no forced choice, and their largest per-moment gap is the statistic (up to the thinning to every 0.02)",
      gj.forced === null && gj.t[gj.t.length - 1] < 4 && Math.abs(Math.max(...gj.pm.map(Math.abs)) - jp.rules.per_moment.maxDx) < 0.01, `${Math.max(...gj.pm.map(Math.abs)).toFixed(4)} against ${jp.rules.per_moment.maxDx.toFixed(4)}`);
  }
  // the held-out plate's guess: 100% has no line; the hero's family readouts carry the eligibility condition
  check("held", "a guess of 100% has no line on log axes, and 90% draws the 10% line", M.guessSlope(1) === null && Math.abs(M.guessSlope(0.9) - 0.1) < 1e-12, `${M.guessSlope(1)}, ${M.guessSlope(0.9)}`);
  {
    const sum = M.heldSummary(DATA), lab = S.heroLabel("Piecewise", sum.byFam.piecewise.med, sum.byFam.piecewise.n);
    check("held", "the hero's family readout states the schedules its median covers", /over the 29 schedules where that loss is at least 0\.01/.test(lab) && /95\.3%/.test(lab), lab);
    const corner = DATA.held.filter((r) => M.lossOf(r, 0) < 1e-5 && M.lossOf(r, 1) < 1e-5);
    check("held", "the caption's corner: some schedule has both losses below the floor, so it is drawn on the diagonal whatever their ratio", corner.length >= 1, `${corner.length}: ${corner.map((r) => `${S.num(M.lossOf(r, 0))} and ${S.num(M.lossOf(r, 1))}`).join("; ")}`);
  }
  // #close: the per-moment rule's scaled error tends to B'(c0)(gamma - w * gamma), not the zero function, but zero at moments
  {
    const c0 = 0.1, gamma = (t) => 0.03 * Math.sin(2 * t), ts = Array.from({ length: 251 }, (_, i) => i / 100);
    const pm = perMomentResponse(gamma, ts, c0), fo = firstOrder(gamma, ts, c0), d = Array.from(pm, (v, i) => v - fo[i]);
    const crosses = d.slice(1).filter((v, i) => Math.sign(v) !== Math.sign(d[i])).length, size = Math.max(...d.map(Math.abs));
    check("words", "the text on the per-moment limit: for the Wave preset's change, B'(c0)(gamma - w * gamma) is not the zero function but crosses zero", crosses >= 1 && size > 0.1 * Math.max(...Array.from(pm, Math.abs)), `${crosses} sign changes on [0, 2.5], largest size ${size.toFixed(4)}`);
  }
  // #behavior: on a deadline, the per-moment threshold as scored is max(B(c0) - 0.5826 sqrt(dt), 0), flat to the forced choice
  {
    const run = M.runRules(costOf({ id: "deadline", params: { at: 1, c: 0.1 } }), 1), want = toDiscrete(boundForCost(0.1), 0.01);
    const curve = run.rules.per_moment.curve, flat = curve.every((v) => Math.abs(v - want) < 1e-12);
    check("words", "the text on deadlines: the per-moment threshold as scored is max(B(c0) - 0.5826 sqrt(dt), 0) at every drawn time up to the forced choice", flat && Math.abs(want - Math.max(boundForCost(0.1) - 0.5826 * 0.1, 0)) < 1e-12, `${want.toFixed(4)} at ${curve.length} times`);
  }
}
