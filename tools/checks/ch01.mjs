// Chapter 1: the constant-cost bound the per-moment rule reads (the rule plate); the page's three bounds held to the
// paper's code on the book's schedules (tools/validity/paper-code.json) and to the paper's own Figure 1 and Table 4
// (tools/validity/ch01.json, read from the tag's experiments/results/showcase.json); the guess at t = 0.4 on the
// 16-fold rise; and the sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { B } from "../../book/assets/js/kernel.js";
import { boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { costOf, deadlineOf, PRESETS, VIEW } from "../../book/assets/js/schedules-book.js";
import { FIG1, fig1Choice, fig1Of, threeRules, at, ahead, DT, SHIFT } from "../../book/assets/js/ch01-model.js";
import { CHOICES, spec, costFromSpec, HORIZON } from "../validity/schedules.mjs";
import * as S from "../../book/assets/js/say-ch01.js";
import { check, table, ROOT } from "./lib.mjs";

const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/paper-code.json"), "utf8"));
const FIG = JSON.parse(readFileSync(join(ROOT, "tools/validity/ch01.json"), "utf8"));
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));

// ---- the rule plate: B(c) from the table, against the root of sinh 2b + 2b = 1/c ------------------------------------
{
  let worst = 0, at0 = 0, mono = true, prev = Infinity;
  for (let lc = Math.log(0.004); lc <= Math.log(8) + 1e-12; lc += 0.01) {
    const c = Math.exp(lc), b = boundForCost(c), d = Math.abs(b - B(c));
    if (d > worst) { worst = d; at0 = c; }
    if (!(b < prev)) mono = false;
    prev = b;
  }
  check("rule", "B(c) from the page's table matches the root of sinh 2b + 2b = 1/c for costs 0.004 to 8 (within 1e-5)", worst < 1e-5, `largest difference ${worst.toExponential(1)} at c = ${at0.toPrecision(3)}`);
  check("rule", "B(c) falls as the cost rises, over the same costs: a higher cost gives a lower bound", mono, mono ? "strictly decreasing" : "not decreasing");
  check("rule", "an infinite cost gives the bound B(infinity) = 0", boundForCost(Infinity) === 0, `B(Infinity) = ${boundForCost(Infinity)}`);
  const ch = fig1Choice("deadline"), cost = costOf(ch), dl = deadlineOf(ch);
  const before = boundForCost(cost(dl)), after = boundForCost(cost(dl + 0.01));
  check("rule", "on the deadline, the per-moment bound is B(0.1) up to the forced choice and 0 after it", Math.abs(before - B(0.1)) < 1e-5 && after === 0, `${before.toFixed(5)} at the deadline, ${after} just after`);
}

// ---- the page's three bounds against the paper's code, on the book's schedules ---------------------------------------
check("code", "the reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit && FIG.commit === SRC.commit,
  `paper-code.json and ch01.json from ${REF.tag} and ${FIG.tag} (${FIG.commit.slice(0, 7)}), book from ${SRC.tag} (${SRC.commit.slice(0, 7)})`);
const worst = (a, b) => a.reduce((m, v, i) => (v === null || b[i] === null || b[i] === undefined ? m : Math.max(m, Math.abs(v - b[i]))), 0);
for (const choice of CHOICES) {
  const s = spec(choice), ref = REF.schedules[s.id];
  if (!ref) { check("code", `${s.id}: in the reference`, false, "missing; rerun tools/validity/paper_code.py"); continue; }
  // the plate's function, unthinned, with the reference's horizon (a deadline's program stops at the deadline, in both)
  const r = threeRules(costFromSpec(s), s.kind === "deadline" ? s.at : null, { every: 1, horizon: s.kind === "deadline" ? s.at : HORIZON });
  const n = r.t.length;
  const dEx = worst(r.exact, ref.exact.slice(0, n)), dPm = worst(r.pm, ref.perMoment.slice(0, n)), dWb = worst(r.wb, ref.weighted.slice(0, n));
  check("code", `${s.id}: the plate's best bound, per-moment bound, and weighted look-ahead match the paper's code (within 1e-6, 1e-10, 1e-10)`,
    dEx < 1e-6 && dPm < 1e-10 && dWb < 1e-10, `largest differences ${dEx.toExponential(1)}, ${dPm.toExponential(1)}, ${dWb.toExponential(1)} over ${n} times`);
}

// ---- Figure 1 and Table 4 ---------------------------------------------------------------------------------------
const T4 = table("tab_showcase");
check("fig1", "Table 4 has one row for each of Figure 1's four panels", T4.length === FIG1.length && FIG.schedules.length === FIG1.length, `${T4.length} rows, ${FIG.schedules.length} schedules in the results`);
FIG1.forEach((p, k) => {
  const row = T4[k][0].replace(/\$/g, "");
  check("fig1", `panel (${p.letter}) is Table 4's row ${k + 1}: "${row}"`, p.title === row, `page "${p.title}"`);
  const ps = FIG.schedules[k], lp = ps.loss.per_moment.toFixed(2), lw = ps.loss.weighted.toFixed(3);
  check("fig1", `Table 4's row ${k + 1} prints the losses of the paper's Figure 1 schedule ${k + 1} (${ps.title})`, lp === T4[k][1] && lw === T4[k][2], `${lp}, ${lw} vs ${T4[k][1]}, ${T4[k][2]}`);
});
const dShift = SHIFT - FIG.shift;
check("fig1", "the page's shift for checking every 0.01, less the paper's for every 0.002, is about 0.03", Math.abs(dShift - 0.03) < 0.005 && Math.abs(FIG.dt - 0.002) < 1e-12 && DT === 0.01,
  `0.5826 (sqrt ${DT} - sqrt ${FIG.dt}) = ${dShift.toFixed(4)}`);
const PAGE = {};
FIG1.forEach((p, k) => {
  const ch = fig1Choice(p.id), cost = costOf(ch), dl = deadlineOf(ch);
  const r = threeRules(cost, dl, { every: 1 });
  PAGE[p.id] = r;
  const ps = FIG.schedules[k];
  let dC = 0, dPm = 0, dWb = 0, raw = 0, res = 0, n = 0;
  for (let i = 0; i < r.t.length; i++) {
    const j = ps.t.findIndex((x) => Math.abs(x - r.t[i]) < 1e-9);
    if (j < 0) continue;
    n++;
    if (ps.cost[j] < 99) dC = Math.max(dC, Math.abs(cost(r.t[i]) - ps.cost[j]));
    // the page's continuous-monitoring rules, moved in for the paper's time step, are the printed curves to rounding
    dPm = Math.max(dPm, Math.abs(Math.min(toDiscrete(r.pm[i], FIG.dt), 4) - ps.per_moment[j]));
    dWb = Math.max(dWb, Math.abs(Math.min(toDiscrete(r.wb[i], FIG.dt), 4) - ps.weighted[j]));
    const v = Math.min(r.exact[i], 4), pv = ps.exact[j];
    raw = Math.max(raw, Math.abs(v - pv), Math.abs(r.pmShift[i] - ps.per_moment[j]), Math.abs(r.wbShift[i] - ps.weighted[j]));
    if (pv > 0.15) res = Math.max(res, Math.abs(v + dShift - pv));
  }
  check("fig1", `(${p.letter}): the page's schedule is the paper's, at every 0.01 time units (within 1e-4, the printed rounding)`, n > 90 && dC < 1e-4, `largest difference ${dC.toExponential(1)} at ${n} times`);
  check("fig1", `(${p.letter}): moved in for the paper's time step, the page's per-moment and weighted bounds are the printed curves (within 1e-4)`, dPm < 1e-4 && dWb < 1e-4, `largest differences ${dPm.toExponential(1)}, ${dWb.toExponential(1)}`);
  check("fig1", `(${p.letter}): every curve the page draws is within 0.04 of the printed figure's`, raw < 0.04, `largest difference ${raw.toFixed(4)}`);
  check("fig1", `(${p.letter}): the page's best bound, raised by the shift difference, is within 0.007 of the printed one wherever that is above 0.15`, res < 0.007, `largest difference ${res.toFixed(4)}`);
});

// ---- the guess: t = 0.4 on the 16-fold rise --------------------------------------------------------------------
{
  const r = PAGE.jump, ps = FIG.schedules[0], T = 0.4;
  const thin = threeRules(costOf(fig1Choice("jump")), null);   // as the worker sends it, every 0.02
  const k = thin.t.findIndex((x) => Math.abs(x - T) < 1e-9);
  check("rise", "t = 0.4 is one of the times the worker sends, so the answer is the program's own value", k >= 0 && Math.abs(at(thin, "exact", T) - thin.exact[k]) < 1e-12, `index ${k}`);
  const best = at(thin, "exact", T), pm = toDiscrete(boundForCost(costOf(fig1Choice("jump"))(T)), DT);
  const j = ps.t.findIndex((x) => Math.abs(x - T) < 1e-9);
  check("rise", "the page's best bound at t = 0.4, raised by the shift difference, is within 0.007 of the printed figure's", Math.abs(best + dShift - ps.exact[j]) < 0.007,
    `page ${best.toFixed(4)} + ${dShift.toFixed(4)} vs printed ${ps.exact[j].toFixed(4)}`);
  check("rise", "at t = 0.4 the best bound sits well below the per-moment bound, on the page's grid and in the printed figure (by more than 0.25)",
    pm - best > 0.25 && ps.per_moment[j] - ps.exact[j] > 0.25, `page ${pm.toFixed(3)} vs ${best.toFixed(3)}; printed ${ps.per_moment[j].toFixed(3)} vs ${ps.exact[j].toFixed(3)}`);
  let falling = true;
  for (let i = 1; i <= Math.round(T / DT); i++) if (!(r.exact[i] < r.exact[i - 1])) falling = false;
  check("rise", "the best bound comes down at every step from t = 0 to 0.4, while the cost at t = 0.2 is still within 4% of 0.1", falling && costOf(fig1Choice("jump"))(0.2) < 0.104, `cost at 0.2: ${costOf(fig1Choice("jump"))(0.2).toFixed(4)}`);
  check("rise", "t = 0.4 comes before the center of the rise at 0.5", T < fig1Choice("jump").params.at, `center ${fig1Choice("jump").params.at}`);
}
{
  // the text says the best bound moves first in each panel: before the rise, before the fall, before the ramp
  const before = (id, until, sign) => {
    const r = PAGE[id], k = Math.round(until / DT), d = r.exact[k] - r.exact[0], dpm = r.pm[k] - r.pm[0];
    return { ok: sign * d > 0.1 && Math.abs(dpm) < 0.05, text: `${id}: best moves ${d.toFixed(3)}, per-moment ${dpm.toFixed(3)} by t = ${until}` };
  };
  const a = before("jump", 0.2, -1), b = before("fall", 0.15, 1), c = before("rising", 0.45, -1), d = before("deadline", 0.9, -1);
  check("fig1", "in each panel the best bound moves by more than 0.1 while the per-moment bound has moved less than 0.05", a.ok && b.ok && c.ok && d.ok, [a, b, c, d].map((x) => x.text).join("; "));
  const r = PAGE.deadline;
  let cross = null;
  for (let i = 1; i < r.t.length - 1; i++) if (r.wbShift[i - 1] < r.exact[i - 1] && r.wbShift[i] >= r.exact[i]) { cross = r.t[i]; break; }
  const below = r.t.filter((t, i) => t < 0.8 && r.wbShift[i] < r.exact[i]).length / r.t.filter((t) => t < 0.8).length;
  check("fig1", "on the deadline, the page's weighted rule sits below the best bound for most of the trial and crosses above it near the deadline", below === 1 && cross !== null && cross > 0.8,
    `below at every time before 0.8; crosses at t = ${cross}`);
}

// ---- the reader's schedule: which panel it is ------------------------------------------------------------------
{
  const ok = FIG1.every((p) => { const f = fig1Of(fig1Choice(p.id)); return f && f.same && f.letter === p.letter; });
  const other = fig1Of({ id: "jump", params: { at: 0.8, factor: 16 } }), none = fig1Of({ id: "wave", params: {} });
  check("fig1", "the fifth panel names Figure 1's schedules at the paper's values, and says when the settings differ", ok && other && !other.same && none === null, `${JSON.stringify(other)}, ${JSON.stringify(none)}`);
}

// ---- the sentences ----------------------------------------------------------------------------------------------
{
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = 0, n = 0;
  const choices = PRESETS.map((p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) }));
  for (let i = 0; i < 3000; i++) {
    const ch = choices[i % choices.length], cost = costOf(ch), dl = deadlineOf(ch);
    const t = Math.round(rnd() * VIEW * 100) / 100, past = dl !== null && t > dl;
    const c = past ? cost(dl) : cost(t);
    const next = past ? null : ahead(cost, t, dl);
    const out = [
      S.heroLabel(rnd(), 0.05 + rnd(), rnd() * 2, rnd() * 2),
      S.ruleSay(t, c, boundForCost(c), next, dl),
      S.riseSay(i % 4 ? rnd() * 1.4 : null, rnd(), rnd() * 1.4, 0.4, 0.28, 0.1, 1.6),
      S.panelSay({ name: "(a) 16-fold rise", t, c: past ? Infinity : c, best: rnd() * 1.6, pm: rnd() * 1.6, wb: rnd() * 1.6, next, dl }),
      S.yoursNote({ label: "Pulse", kind: ["deadline", "constant", "other"][i % 3], letter: i % 2 ? "a" : undefined, same: i % 4 < 2, dl: 1 }),
    ];
    for (const s of out) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const hi = S.riseSay(0.9, 0.38, 0.69, 0.4, 0.28, 0.1, 1.6), lo = S.riseSay(0.2, 0.38, 0.69, 0.4, 0.28, 0.1, 1.6);
  check("words", "a guess above the best bound is called too high, below it too low, with the right gaps", /0\.52 too high/.test(hi) && /0\.18 too low/.test(lo) && /0\.31 above the best bound/.test(hi), hi);
  const up = S.panelSay({ name: "x", t: 0.3, c: 0.13, best: 0.6, pm: 1.1, wb: 0.58, next: { kind: "cost", mean: 1.2, lo: 0.13, hi: 1.6 }, dl: null });
  const dn = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.99, pm: 0.51, wb: 1.08, next: { kind: "cost", mean: 0.1, lo: 0.05, hi: 0.39 }, dl: null });
  const odd = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.4, pm: 0.51, wb: 0.4, next: { kind: "cost", mean: 0.1, lo: 0.05, hi: 0.39 }, dl: null });
  check("words", "the read-out gives a reason only when the gap and the cost ahead agree in direction", /0\.50 lower: a decision open now may still be open when the cost is higher/.test(up)
    && /0\.48 higher: a decision open now may still be open when the cost is lower/.test(dn) && /0\.11 lower than the per-moment bound\.$/.test(odd), `${up} | ${dn} | ${odd}`);
  const ch = fig1Choice("jump"), cost = costOf(ch);
  const r = S.ruleSay(0.3, cost(0.3), boundForCost(cost(0.3)), ahead(cost, 0.3, null), null);
  check("words", "the rule plate's sentence reports the cost ahead it leaves out", /between 0\.13 and 1\.6, and the rule uses none of it/.test(r), r);
  const page = S.riseSay(null, 0.3843, 0.6854, 0.4, 0.28, 0.1, 1.6), hero = S.heroLabel(0.1, 0.39, 0.9869, 0.5111);
  check("words", "a gap a sentence states is the difference of the two numbers it prints", /0\.38, 0\.31 below the per-moment bound's 0\.69/.test(page) && /0\.48 above/.test(hero), `${page} | ${hero}`);
  check("words", "costs print to two significant figures", S.cf(0.1001) === "0.10" && S.cf(0.0917) === "0.092" && S.cf(1.4212) === "1.4" && S.cf(16) === "16", [0.1001, 0.0917, 1.4212, 16].map(S.cf).join(", "));
}
