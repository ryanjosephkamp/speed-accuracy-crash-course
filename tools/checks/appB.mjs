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
      const far = (t) => !(Math.abs(M.boundAt(r, T, t) - binf) <= M.EPS[0]);
      if (T > d1 + 1e-9) {
        // "the earliest check where it is more than 0.001 from that value is at t = T - d1; every check before it is within 0.001"
        const qEnd = Math.round((T - d1) / M.DT);
        for (let q = 0; q < qEnd; q++) if (far(q * M.DT)) { wrong.push(`${c}, ${T}, t = ${q * M.DT}`); break; }
        if (!far(qEnd * M.DT)) wrong.push(`${c}, ${T}: within at T - d1`);
        if (!s.includes(`the earliest check where it is more than 0.001 from that value is at t = ${+(T - d1).toFixed(2)}; every check before it is within 0.001.`)) wrong.push(`${c}, ${T}: branch`);
      } else {
        // "more than 0.001 from that value at every check from t = 0 on", and the printed gap at t = 0 is above 0.001
        for (let q = 0; q * M.DT <= T + 1e-9; q++) if (!far(q * M.DT)) { wrong.push(`${c}, ${T}, t = ${q * M.DT}: within`); break; }
        const m = s.match(/the bound is [\d.]+, ([\d.]+) below it\.$/);
        if (!s.includes("more than 0.001 from that value at every check from t = 0 on") || !m || !(+m[1] > 0.001)) wrong.push(`${c}, ${T}: ${s.slice(-60)}`);
      }
    }
  }
  check("words", `the horizon plate's sentence, at every cost stop and forced choice on the sliders (${n}), has no NaN, undefined, Infinity, or null; where it names the earliest check more than 0.001 away, every check before it is within 0.001 and that one isn't; where it says every check from t = 0 is more than 0.001 away, each is, and the printed gap at t = 0 is above 0.001`, !wrong.length, wrong.slice(0, 3).join("; "));
}

// ---- the bins plate ----------------------------------------------------------------------------------------------
for (const [cs, row] of Object.entries(P.costs)) {
  const c = +cs;
  const out = M.BINS.map((n) => ({ n, v: M.beliefBackward(c, n), s: M.beliefBackward(c, n, P.short), p: row.beliefs[String(n)] }));
  const worst = Math.max(...out.map((o) => Math.max(Math.abs(o.v.gb - o.p.gb), Math.abs(o.s.gb - o.p.short))));
  check("bins", `at a cost of ${c}, the page's belief-grid bound at the start, with the choice forced at ${M.LONG} and at ${P.short}, for each of the six numbers of bins, matches known.backward_induction's within 1e-9`,
    worst < 1e-9, `largest difference ${worst.toExponential(2)}`);
}
const BELIEF = new Map(STOPS.map((c) => [c, M.BINS.map((n) => ({ n, ...M.beliefBackward(c, n) }))]));
const XE = (c) => { const b = RUNS.get(c).bTg; return b[b.length - 1]; };
{
  const c = 0.02, rows = BELIEF.get(c), xe = XE(c), few = rows.filter((r) => r.n <= 100);
  check("bins", "the text at 0.02: the belief grid's bound with 25, 50, and 100 bins is each more than 0.1 below the evidence grid's",
    few.length === 3 && few.every((r) => r.xb < xe - 0.1), few.map((r) => `${r.n}: ${(r.xb - xe).toFixed(4)}`).join(", "));
  const d800 = STOPS.map((c) => Math.abs(BELIEF.get(c).find((r) => r.n === 800).xb - XE(c)));
  check("bins", "the text: at every cost stop, the belief grid with 800 bins is within 0.01 of the evidence grid's bound, both with 30 time units left", d800.every((d) => d < 0.01), `largest ${Math.max(...d800).toFixed(4)}`);
  const hi = STOPS.filter((c) => c >= 0.1);
  const d50 = hi.map((c) => Math.abs(BELIEF.get(c).find((r) => r.n === 50).xb - XE(c)));
  check("bins", "the text: at every cost stop from 0.1 to 1, the belief grid with 50 bins is within 0.01 of the evidence grid's bound", d50.every((d) => d < 0.01), `largest ${Math.max(...d50).toFixed(4)}`);
  const below = STOPS.every((c) => XE(c) < M.boundForCost(c));
  check("bins", "the text: at every cost stop, the evidence grid's bound is below B(c)", below, "");
  const p = "so a small bin of width $1/n$ near a belief $g$ covers about $1/\\bigl(2n\\,g(1 - g)\\bigr)$ of evidence: about $2/n$ near $\\tfrac12$ and about $50/n$ near 0.99.";
  const span = (g) => 1 / (2 * g * (1 - g));
  check("words", "the text's bin widths: the slope of the evidence in the belief, 1/(2g(1 - g)), is 2 at 1/2 and rounds to 51 at 0.99, and the text says 2/n and about 50/n",
    readFileSync(join(ROOT, "book/content/appB.py"), "utf8").includes(p) && span(0.5) === 2 && Math.round(span(0.99)) === 51, `${span(0.5)}, ${span(0.99).toFixed(2)}`);
}
{
  let n = 0, wrong = [];
  for (const c of STOPS) {
    for (const r of BELIEF.get(c)) {
      const xe = XE(c), s = S.binsSay(c, r.n, M.LONG, r.xb, xe, M.boundForCost(c), M.binGap(r.x, r.xb));
      n++;
      if (bad(s) || !Number.isFinite(r.xb) || !(r.xb > 0)) { wrong.push(`${c}, ${r.n}: ${s}`); continue; }
      // the printed bounds differ whenever the printed difference isn't "within 0.000001"
      const m = s.match(/bound is ([\d.]+) in evidence, (.+?) the evidence grid's \(([\d.]+)\)/);
      if (!m || (!m[2].startsWith("within") && m[1] === m[3])) wrong.push(`${c}, ${r.n}: ${m ? m[0] : s}`);
    }
  }
  check("words", `the bins plate's sentence at every cost stop and number of bins (${n}) has no NaN, undefined, Infinity, or null, every bound there is finite and positive, and its two printed bounds differ whenever it prints a difference`, !wrong.length, wrong.slice(0, 2).join("; "));
}

// ---- the plates' solve state: the answer on show and the cost it was solved at -------------------------------------
{
  const st = M.solveState(), log = [];
  const g1 = st.ask();
  log.push(st.take(g1, 0.1, { v: "a" }) && st.get().c === 0.1);
  const g2 = st.ask();                         // a new cost: nothing from the old one is on show
  log.push(st.get() === null);
  log.push(st.take(g1, 0.1, { v: "late" }) === false && st.get() === null);   // a late answer for the old cost
  log.push(st.live(g2) && !st.live(g1));
  log.push(st.take(g2, 1, { v: "b" }) && st.get().c === 1 && st.get().v === "b");
  check("state", "the solve-state helper both plates draw from: asking for a new cost drops the answer on show, a late answer for an older ask is refused, and the answer on show carries the cost it was solved at", log.every(Boolean), log.join(", "));
  const src = readFileSync(join(ROOT, "book/assets/js/appB.js"), "utf8");
  const ok = /S\.horizonSay\(r\.c,/.test(src) && /S\.binsSay\(data\.c,/.test(src) && !/S\.(horizonSay|binsSay)\(COSTS/.test(src)
    && /const r = st\.get\(\);/.test(src) && /const data = st\.get\(\);/.test(src) && (src.match(/st\.take\(g, c, m\)/g) || []).length === 2;
  check("state", "appB.js's source: both plates draw from the solve state, take answers through it with the cost they asked for, and pass the shown answer's cost (not the slider's) to their sentences", ok, "");
}

// ---- the sentences on random and edge inputs ---------------------------------------------------------------------
{
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let wrong = [];
  for (let i = 0; i < 5000; i++) {
    const c = STOPS[Math.floor(rnd() * STOPS.length)], T = 2 + 0.5 * Math.floor(rnd() * 37), binf = 3 * rnd(), d1 = 15 * rnd(), d2 = d1 * rnd(), b0 = binf * rnd();
    const xb = [Infinity, 0, 3 * rnd()][Math.floor(rnd() * 3)], xe = 3 * rnd(), B = 3 * rnd(), gap = rnd();
    for (const s of [S.horizonSay(c, T, M.LONG, binf, d1, d2, b0), S.binsSay(c, M.BINS[i % 6], M.LONG, xb, xe, B, gap), S.guessSay([0.5, 2, 5, 10][i % 4], d1), S.heroLabel(c, d1)]) if (bad(s)) wrong.push(s);
  }
  check("words", "the four sentence functions on 5,000 random inputs (with a bound of 0 and an infinite bound) have no NaN, undefined, Infinity, or null", !wrong.length, wrong.slice(0, 2).join("; "));
  const edge = [S.binsSay(0.1, 25, M.LONG, Infinity, 1.2, 1.3, NaN), S.binsSay(0.1, 25, M.LONG, 0, 1.2, 1.3, 0.08)];
  check("words", "the bins sentence says plainly when the belief grid waits at every bin or decides at the first bin above 1/2",
    edge[0].includes("waits at every bin") && edge[1].includes("decides at the first bin above 1/2") && !edge.some(bad), edge.join(" | "));
  check("words", "every cost stop prints as the cost the plates compute with", STOPS.every((c) => +S.costLabel(c) === c), STOPS.map(S.costLabel).join(", "));
  check("words", "the hero's costs are cost stops of the plates", M.HERO_COSTS.every((c) => STOPS.includes(c)), M.HERO_COSTS.join(", "));
}
