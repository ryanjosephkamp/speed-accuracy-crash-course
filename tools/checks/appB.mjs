// Appendix B: the page's two reference programs at a constant cost against the paper's code at the book's tag
// (tools/validity/appB.json, from tools/validity/appB.py), the horizon plate's one-solve reading against direct solves,
// every number the page's text states about the plates, the slider's edge stops, and the sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as M from "../../book/assets/js/appB-model.js";
import { exactPolicy } from "../../book/assets/js/model.js";
import * as S from "../../book/assets/js/say-appB.js";
import { check, ROOT } from "./lib.mjs";

const P = JSON.parse(readFileSync(join(ROOT, "tools/validity/appB.json"), "utf8"));
const bad = (s) => /NaN|undefined|Infinity|null/.test(s);
const STOPS = M.COST_STOPS;

// ---- the page's grid is the one the paper's code was run on --------------------------------------------------------
check("horizon", "appB.json was computed on the page's grid (dt, h, cap, the longest forced choice, and the two gaps)",
  P.dt === M.DT && P.h === M.H && P.cap === M.CAP && P.long === M.LONG && JSON.stringify(P.eps) === JSON.stringify(M.EPS),
  `${P.tag} (${P.commit.slice(0, 7)}): ${P.dt}, ${P.h}, ${P.cap}, ${P.long}`);

// ---- the horizon plate --------------------------------------------------------------------------------------------
const RUNS = new Map(STOPS.map((c) => [c, M.horizonRun(c)]));
for (const [cs, row] of Object.entries(P.costs)) {
  const c = +cs, r = RUNS.get(c) ?? M.horizonRun(c);
  let worst = 0;
  row.left.forEach((left, q) => { worst = Math.max(worst, Math.abs(M.boundAt(r, M.LONG, M.LONG - left) - row.bound[q])); });
  check("horizon", `at a cost of ${c}, the page's bound with the choice forced at ${M.LONG} matches known.backward_induction_x every 0.5 time units of time left, within 1e-6`, worst < 1e-6, `largest difference ${worst.toExponential(2)}`);
  const mine = M.EPS.map((eps) => M.reach(r, eps));
  check("horizon", `at a cost of ${c}, the page's reach at 0.001 and 0.01 equals the paper's code's, within one step`,
    mine.every((d, i) => Math.abs(d - row.reach[i]) <= M.DT + 1e-9), `${mine.map((d) => d.toFixed(2)).join(", ")} vs ${row.reach.map((d) => d.toFixed(2)).join(", ")}`);
}
for (const c of [STOPS[0], 0.1, STOPS[STOPS.length - 1]]) {
  for (const T of [2, 10, 20]) {
    const direct = exactPolicy(() => c, T, M.DT, M.H, M.CAP), r = RUNS.get(c);
    let worst = 0;
    direct.ts.forEach((t, k) => { worst = Math.max(worst, Math.abs(M.boundAt(r, T, t) - direct.bounds[k])); });
    check("horizon", `at a cost of ${c}, the plate's bound for a forced choice at ${T}, read from the solve at ${M.LONG}, equals a direct solve forced at ${T} at every step, within 1e-12`, worst < 1e-12, `largest difference ${worst.toExponential(2)}`);
  }
}
{
  const c = STOPS[0], r40 = M.horizonRun(c, 40), r30 = RUNS.get(c);
  const d = Math.abs(r40.bTg[r40.bTg.length - 1] - r30.bTg[r30.bTg.length - 1]);
  check("horizon", `at the slider's lowest cost, ${c}, the bound with 40 time units left is within 1e-6 of the bound with ${M.LONG} left`, d < 1e-6, d.toExponential(2));
}
{
  const d1 = STOPS.map((c) => M.reach(RUNS.get(c), M.EPS[0])), d2 = STOPS.map((c) => M.reach(RUNS.get(c), M.EPS[1]));
  const down = (a) => a.every((v, i) => i === 0 || v < a[i - 1]);
  check("horizon", "the finding and the text: over the slider's 21 costs, the reach at 0.001 and at 0.01 is strictly shorter at each higher cost", down(d1) && down(d2),
    `0.001: ${d1[0].toFixed(2)} at ${STOPS[0]} to ${d1[d1.length - 1].toFixed(2)} at ${STOPS[STOPS.length - 1]}`);
  let worst = 0, where = "";
  for (const c of STOPS) {
    const b = RUNS.get(c).bTg, last = b[b.length - 1];
    for (let j = 1; j < b.length; j++) { const v = b[j - 1] - b[j]; if (v > worst) { worst = v; where = `${c}, ${(j * M.DT).toFixed(2)} left`; } }
    for (let j = 0; j < b.length; j++) worst = Math.max(worst, b[j] - last);
  }
  check("horizon", "the hero's \"below\": at every slider cost, the bound never falls as the time left grows, so it is never above its value with 30 left", worst <= 1e-12, worst ? `largest fall ${worst.toExponential(2)} (${where})` : "never falls");
  check("horizon", "every slider cost's bound is finite and positive with time left, and 0 at the forced choice",
    STOPS.every((c) => { const b = RUNS.get(c).bTg; return b[0] === 0 && Array.from(b).slice(1).every((v) => Number.isFinite(v) && v > 0); }), "");
}
{
  // the sentence under the plate, at every cost stop and every forced choice on the slider, through the plate's reading
  let n = 0, wrong = [];
  for (const c of STOPS) {
    const r = RUNS.get(c), binf = r.bTg[r.bTg.length - 1], [d1, d2] = M.EPS.map((eps) => M.reach(r, eps));
    for (let T = 2; T <= 20 + 1e-9; T += 0.5) {
      const b0 = M.boundAt(r, T, 0), s = S.horizonSay(c, T, M.LONG, binf, d1, d2, b0);
      n++;
      if (bad(s)) wrong.push(`${c}, ${T}: ${s}`);
      if (T > d1 + 1e-9) {
        // "within 0.001 of that value from t = 0 up to, but not at, t = T - d1": every step before it, and not at it
        const qEnd = Math.round((T - d1) / M.DT);
        for (let q = 0; q < qEnd; q++) if (!(Math.abs(M.boundAt(r, T, q * M.DT) - binf) <= M.EPS[0])) { wrong.push(`${c}, ${T}, t = ${q * M.DT}`); break; }
        if (Math.abs(M.boundAt(r, T, qEnd * M.DT) - binf) <= M.EPS[0]) wrong.push(`${c}, ${T}: within at T - d1`);
        if (!s.includes("within 0.001 of that value from t = 0 up to, but not at, t = ")) wrong.push(`${c}, ${T}: branch`);
      } else if (!s.includes("reaches back")) wrong.push(`${c}, ${T}: branch`);
    }
  }
  check("words", `the horizon plate's sentence, at every cost stop and forced choice on the sliders (${n}), has no NaN, undefined, Infinity, or null, and its "within 0.001 from t = 0 up to, but not at, T - d" holds at every step before T - d and fails at T - d`, !wrong.length, wrong.slice(0, 3).join("; "));
}

// ---- the bins plate ----------------------------------------------------------------------------------------------
for (const [cs, row] of Object.entries(P.costs)) {
  const c = +cs;
  const out = M.BINS.map((n) => ({ n, v: M.valueIteration(c, n), p: row.beliefs[String(n)] }));
  const worst = Math.max(...out.map((o) => Math.abs(o.v.gb - o.p.gb)));
  check("bins", `at a cost of ${c}, the page's belief-grid bound for each of the six numbers of bins matches known.value_iteration within 1e-9, after the same number of iterations`,
    worst < 1e-9 && out.every((o) => o.v.it === o.p.it), `largest difference ${worst.toExponential(2)}; iterations ${out.map((o) => o.v.it).join(", ")}`);
}
const BELIEF = new Map(STOPS.map((c) => [c, M.BINS.map((n) => ({ n, ...M.valueIteration(c, n) }))]));
const XE = (c) => { const b = RUNS.get(c).bTg; return b[b.length - 1]; };
{
  const c = 0.02, rows = BELIEF.get(c), xe = XE(c), r100 = rows.find((r) => r.n === 100), r800 = rows.find((r) => r.n === 800);
  const gap = M.binGap(r100.x, r100.xb);
  check("bins", "the text at 0.02: with 100 bins, the bins around the bound are more than 0.1 apart and the bound is more than 0.1 from the evidence grid's; with 800, within 0.005",
    gap > 0.1 && Math.abs(r100.xb - xe) > 0.1 && Math.abs(r800.xb - xe) < 0.005, `gap ${gap.toFixed(3)}; ${r100.xb.toFixed(3)} and ${r800.xb.toFixed(4)} vs ${xe.toFixed(4)}`);
  const hi = STOPS.filter((c) => c >= 0.1);
  const d50 = hi.map((c) => Math.abs(BELIEF.get(c).find((r) => r.n === 50).xb - XE(c)));
  check("bins", "the text: at every cost stop from 0.1 to 1, the belief grid with 50 bins is within 0.01 of the evidence grid's bound", d50.every((d) => d < 0.01), `largest ${Math.max(...d50).toFixed(4)}`);
  const below = STOPS.every((c) => XE(c) < M.boundForCost(c));
  check("bins", "the text: at every cost stop, the evidence grid's bound is below B(c)", below, "");
  const p = "Equal bins in belief are not equal in evidence. Near a belief of $\\tfrac12$, a bin of width $1/n$ covers about $2/n$ of evidence; near a belief of 0.99, about $50/n$.";
  const span = (g) => 1 / (2 * g * (1 - g));
  check("words", "the text's bin widths: a belief bin of width 1/n covers about 2/n of evidence at 1/2 and about 50/n at 0.99 (the slope of the evidence in the belief)",
    readFileSync(join(ROOT, "book/content/appB.py"), "utf8").includes(p) && span(0.5) === 2 && Math.round(span(0.99)) === 51, `${span(0.5)}, ${span(0.99).toFixed(2)}`);
}
{
  let n = 0, wrong = [];
  for (const c of STOPS) {
    for (const r of BELIEF.get(c)) {
      const s = S.binsSay(c, r.n, r.xb, XE(c), M.boundForCost(c), M.binGap(r.x, r.xb));
      n++;
      if (bad(s) || !Number.isFinite(r.xb) || !(r.xb > 0)) wrong.push(`${c}, ${r.n}: ${s}`);
    }
  }
  check("words", `the bins plate's sentence at every cost stop and number of bins (${n}) has no NaN, undefined, Infinity, or null, and every bound there is finite and positive`, !wrong.length, wrong.slice(0, 2).join("; "));
}

// ---- the sentences on random and edge inputs ---------------------------------------------------------------------
{
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let wrong = [];
  for (let i = 0; i < 5000; i++) {
    const c = STOPS[Math.floor(rnd() * STOPS.length)], T = 2 + 0.5 * Math.floor(rnd() * 37), binf = 3 * rnd(), d1 = 15 * rnd(), d2 = d1 * rnd(), b0 = binf * rnd();
    const xb = [Infinity, 0, 3 * rnd()][Math.floor(rnd() * 3)], xe = 3 * rnd(), B = 3 * rnd(), gap = rnd();
    for (const s of [S.horizonSay(c, T, M.LONG, binf, d1, d2, b0), S.binsSay(c, M.BINS[i % 6], xb, xe, B, gap), S.guessSay([0.5, 2, 5, 10][i % 4], d1), S.heroLabel(c, d1)]) if (bad(s)) wrong.push(s);
  }
  check("words", "the four sentence functions on 5,000 random inputs (with a bound of 0 and an infinite bound) have no NaN, undefined, Infinity, or null", !wrong.length, wrong.slice(0, 2).join("; "));
  const edge = [S.binsSay(0.1, 25, Infinity, 1.2, 1.3, NaN), S.binsSay(0.1, 25, 0, 1.2, 1.3, 0.08)];
  check("words", "the bins sentence says plainly when the belief grid waits at every bin or decides at the first bin above 1/2",
    edge[0].includes("waits at every bin") && edge[1].includes("decides at the first bin above 1/2") && !edge.some(bad), edge.join(" | "));
  check("words", "every cost stop prints as the cost the plates compute with", STOPS.every((c) => +S.costLabel(c) === c), STOPS.map(S.costLabel).join(", "));
  check("words", "the hero's costs are cost stops of the plates", M.HERO_COSTS.every((c) => STOPS.includes(c)), M.HERO_COSTS.join(", "));
}
