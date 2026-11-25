// Chapter 1: the constant-cost bound the per-moment rule reads (the rule plate); the page's three bounds held to the
// paper's code on the book's schedules (tools/validity/paper-code.json) and to the paper's own Figure 1 and Table 4
// (tools/validity/ch01.json, read from the tag's experiments/results/showcase.json); the guess at t = 0.4 on the
// 16-fold rise; and the sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { B } from "../../book/assets/js/kernel.js";
import { boundForCost, toDiscrete, exactPolicy } from "../../book/assets/js/model.js";
import { dropAt } from "../../book/assets/js/chart.js";
import { costOf, deadlineOf, PRESETS, VIEW, SPARE, drawnCost } from "../../book/assets/js/schedules-book.js";
import { FIG1, fig1Choice, fig1Of, threeRules, at, ahead, costStrip, DT, H, SHIFT } from "../../book/assets/js/ch01-model.js";
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
// the two curves must have the same length and the same missing points (a bound above the cap is null in both)
const worst = (a, b) => {
  if (a.length !== b.length) return Infinity;
  return a.reduce((m, v, i) => {
    const fa = v !== null && Number.isFinite(v), fb = b[i] !== null && Number.isFinite(b[i]);
    return fa !== fb ? Infinity : fa ? Math.max(m, Math.abs(v - b[i])) : m;
  }, 0);
};
for (const choice of CHOICES) {
  const s = spec(choice), ref = REF.schedules[s.id];
  if (!ref) { check("code", `${s.id}: in the reference`, false, "missing; rerun tools/validity/paper_code.py"); continue; }
  // the plate's function, unthinned, with the reference's horizon (a deadline's program stops at the deadline, in both)
  const r = threeRules(costFromSpec(s), s.kind === "deadline" ? s.at : null, { every: 1, horizon: s.kind === "deadline" ? s.at : HORIZON });
  const n = r.t.length;
  const times = r.t.every((x, i) => Math.abs(x - i * REF.dt) < 1e-9) && ref.exact.length >= n;
  const dEx = worst(r.exact, ref.exact.slice(0, n)), dPm = worst(r.pm, ref.perMoment.slice(0, n)), dWb = worst(r.wb, ref.weighted.slice(0, n));
  check("code", `${s.id}: the plate's best bound, per-moment bound, and weighted look-ahead match the paper's code at the same ${n} times, with the same missing points (within 1e-6, 1e-10, 1e-10)`,
    times && dEx < 1e-6 && dPm < 1e-10 && dWb < 1e-10, `largest differences ${dEx.toExponential(1)}, ${dPm.toExponential(1)}, ${dWb.toExponential(1)}; reference has ${ref.exact.length} times`);
}

// ---- Figure 1 and Table 4 ---------------------------------------------------------------------------------------
const T4 = table("tab_showcase");
check("fig1", "Table 4 has one row for each of Figure 1's four panels", T4.length === FIG1.length && FIG.schedules.length === FIG1.length, `${T4.length} rows, ${FIG.schedules.length} schedules in the results`);
FIG1.forEach((p, k) => {
  const row = T4[k][0].replace(/\$/g, ""), nums = (x) => (x.match(/\d+(\.\d+)?/g) || []).join(" ");
  check("fig1", `panel (${p.letter}) names the numbers of Table 4's row ${k + 1}, "${row}"`, nums(p.title) === nums(row), `page "${p.title}"`);
  const ps = FIG.schedules[k], lp = ps.loss.per_moment.toFixed(2), lw = ps.loss.weighted.toFixed(3);
  check("fig1", `Table 4's row ${k + 1} prints the losses of the paper's Figure 1 schedule ${k + 1} (${ps.title})`, lp === T4[k][1] && lw === T4[k][2], `${lp}, ${lw} vs ${T4[k][1]}, ${T4[k][2]}`);
});
const dShift = SHIFT - FIG.shift;
check("fig1", "the page's shift for checking every 0.01, less the paper's for every 0.002, is 0.032 (as the caption prints it)", dShift.toFixed(3) === "0.032" && Math.abs(FIG.dt - 0.002) < 1e-12 && DT === 0.01,
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
  const thin = threeRules(costOf(fig1Choice("jump")), null);   // as the worker sends it
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
  const k2 = Math.round(0.2 / DT), dBest = r.exact[0] - r.exact[k2], dPm = r.pm[0] - r.pm[k2], c2 = costOf(fig1Choice("jump"))(0.2);
  check("rise", "by t = 0.2, with the cost within 4% of 0.1, the best bound has come down more than three times as far as the per-moment bound (the text's claim), and it falls at every step to 0.4",
    falling && c2 < 0.104 && dBest > 3 * dPm, `cost ${c2.toFixed(4)}; best down ${dBest.toFixed(3)}, per-moment down ${dPm.toFixed(3)}`);
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

{
  // the falling-cost exercise: the best bound rises to the new level, about three-fifths of the way by t = 0.3
  const r = PAGE.fall, ps = FIG.schedules[1], k = Math.round(0.3 / DT);
  const share = (a, i) => (a[i] - a[0]) / (a[a.length - 1] - a[0]);
  const page = share(r.exact, k), paper = share(ps.exact, ps.t.findIndex((x) => Math.abs(x - 0.3) < 1e-9));
  check("fig1", "on the fall, about three-fifths of the best bound's rise over the window comes before t = 0.3, on the page's grid and in the printed figure (between 0.55 and 0.67)",
    page > 0.55 && page < 0.67 && paper > 0.55 && paper < 0.67 && r.exact[r.exact.length - 1] - r.exact[0] > 0.5, `page ${page.toFixed(3)}, printed ${paper.toFixed(3)}`);
}

// ---- edge cases, run through the plates' own computation ----------------------------------------------------------
{
  // a deadline at an odd hundredth keeps its forced choice: the last time is the deadline, and the program's bound there is 0
  const ok = [0.45, 0.95, 1, 3].map((dl) => {
    const r = threeRules(costOf({ id: "deadline", params: { at: dl, c: 0.1 } }), dl);
    const n = r.t.length, last = r.t[n - 1];
    const lens = ["cost", "exact", "pm", "wb", "pmShift", "wbShift"].every((k) => r[k].length === n);
    const before = at(r, "exact", +(dl - 0.01).toFixed(2)), atDl = at(r, "exact", dl);
    return { dl, ok: Math.abs(last - dl) < 1e-9 && n === Math.round(dl / DT) + 1 && lens && atDl === 0 && before === r.exact[n - 2] && before > 0, text: `T = ${dl}: ${n} times to ${last}, ${before.toFixed(4)} just before, ${atDl} at T` };
  });
  check("fig1", "for deadlines at 0.45, 0.95, 1, and 3, the worker's curves end at the forced choice, every curve the same length, and the read-out gives the grid's own value just before it and 0 at it",
    ok.every((x) => x.ok), ok.map((x) => x.text).join("; "));
  // the read-out at t = 0.99 on panel (d) is the program's value there, not a line drawn across to the 0 at t = 1
  const d = threeRules(costOf(fig1Choice("deadline")), 1);
  check("fig1", "panel (d) read out at t = 0.99 is the program's own value at 0.99", at(d, "exact", 0.99) === d.exact[99] && at(d, "wbShift", 0.99) === d.wbShift[99],
    `${at(d, "exact", 0.99).toFixed(4)} and ${at(d, "wbShift", 0.99).toFixed(4)}`);
  // the panel draws the program's and the weighted rule's bounds flat to the deadline and straight down there
  const [xs, ys] = dropAt(d.t, d.exact, 1), m = xs.length;
  check("fig1", "panel (d)'s best bound is drawn flat to t = 1, then straight down to 0", xs[m - 1] === 1 && xs[m - 2] === 1 && ys[m - 2] === d.exact[99] && ys[m - 1] === 0, `last points (${xs.slice(-3).join(", ")}) at (${ys.slice(-3).map((v) => v.toFixed(3)).join(", ")})`);
  // the cost strips have their own scale: a constant cost of 1 and a 32-fold rise to 3.2 stay inside their strips
  const strips = [[{ id: "constant", params: { c: 1 } }, 1], [{ id: "jump", params: { at: 0.2, factor: 32 } }, 3.2], [{ id: "draw", points: Array.from({ length: 26 }, (_, i) => (i % 2 ? 2 : 0.5)) }, 2]].map(([ch, top]) => {
    const cost = costOf(ch), st = costStrip(cost, VIEW), ys = Array.from({ length: 251 }, (_, i) => st.y(cost(i / 100)));
    return { ok: Math.min(...ys) > 0 && Math.max(...ys) < 1 && st.hi > top && Math.abs(st.y(cost(1.3)) - ys[130]) < 1e-12, text: `${ch.id}: strip from ${st.lo.toPrecision(3)} to ${st.hi.toPrecision(3)}, line within (${Math.min(...ys).toFixed(3)}, ${Math.max(...ys).toFixed(3)})` };
  });
  check("fig1", "the cost strip's scale holds the whole cost (a constant 1, a rise to 3.2, a drawing up to 2), and the line and the dot at a time use the same scale", strips.every((x) => x.ok), strips.map((x) => x.text).join("; "));
  // the grid's zero bound (shared rule in model.js): where the program waits at the center, the bound is above it
  const z = threeRules(costOf({ id: "jump", params: { at: 0.2, factor: 32 } }), null), zb = z.exact[z.t.length - 1];
  check("fig1", "on a 32-fold rise centered at 0.2, the program's bound at t = 2.5 sits between the center and the grid's first step, not at 0", zb > 0 && zb < H, `bound ${zb.toFixed(4)}, first step ${H}`);
}

// ---- the reader's schedule: which panel it is ------------------------------------------------------------------
{
  const ok = FIG1.every((p) => { const f = fig1Of(fig1Choice(p.id)); return f && f.same && f.letter === p.letter; });
  const other = fig1Of({ id: "jump", params: { at: 0.8, factor: 16 } }), none = fig1Of({ id: "wave", params: {} });
  check("fig1", "the fifth panel names Figure 1's schedules at the paper's values, and says when the settings differ", ok && other && !other.same && none === null, `${JSON.stringify(other)}, ${JSON.stringify(none)}`);
}

// ---- the sentences ----------------------------------------------------------------------------------------------
// sentences that would read wrong: a missing number, or the infinite cost past a deadline averaged as if it were a cost
const BAD = /NaN|undefined|Infinity|null|infinite and infinite|between infinite|mean of infinite|averages infinite/;
{
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = 0, n = 0, first = "";
  const choices = [...PRESETS.map((p) => ({ id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) })),
    { id: "deadline", params: { at: 0.45, c: 0.1 } }, { id: "deadline", params: { at: 3, c: 0.3 } }];
  for (let i = 0; i < 3000; i++) {
    const ch = choices[i % choices.length], cost = costOf(ch), dl = deadlineOf(ch);
    // a third of the times land exactly on the deadline, as the slider and the sweeps do
    const t = dl !== null && i % 3 === 0 ? dl : Math.round(rnd() * Math.max(VIEW, dl ?? 0) * 100) / 100;
    const past = dl !== null && t > dl;
    const c = past ? cost(dl) : cost(t);
    const costAt = (u) => (dl !== null && u > dl + 1e-9 ? Infinity : cost(u));
    const next = ahead(costAt, t, dl);
    const out = [
      S.heroLabel(rnd(), 0.05 + rnd(), rnd() * 2, rnd() * 2),
      S.ruleSay(t, c, boundForCost(c), next, dl),
      S.riseSay(i % 4 ? rnd() * 1.4 : null, rnd(), rnd() * 1.4, 0.4, 0.28, 0.1, 1.6),
      next.kind === "past" && dl === null ? S.beyondSay("(a) 16-fold rise", t, VIEW)
        : S.panelSay({ name: "(a) 16-fold rise", t, c, best: rnd() * 1.6, pm: rnd() * 1.6, wb: rnd() * 1.6, next, dl }),
      S.yoursNote({ label: "Pulse", kind: ["deadline", "constant", "other"][i % 3], letter: i % 2 ? "a" : undefined, same: i % 4 < 2, dl: 1 }),
    ];
    for (const x of out) { n++; if (BAD.test(x)) { bad++; first ||= x; } }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null, nor average the infinite cost past a deadline", bad === 0, bad ? first : `${n} sentences, none bad`);
}
{
  // at the instant of a deadline, on the plates' own numbers: the choice is forced, and nothing is said to stay open
  const ok = [1, 0.45].map((dl) => {
    const ch = { id: "deadline", params: { at: dl, c: 0.1 } }, cost = costOf(ch), r = threeRules(cost, dl);
    const costAt = (u) => (u > dl + 1e-9 ? Infinity : cost(u));
    const next = ahead(costAt, dl, dl);
    const panel = S.panelSay({ name: "(d)", t: dl, c: cost(dl), best: at(r, "exact", dl), pm: toDiscrete(boundForCost(cost(dl)), DT), wb: at(r, "wbShift", dl), next, dl });
    const rule = S.ruleSay(dl, cost(dl), boundForCost(cost(dl)), next, dl);
    const after = S.ruleSay(dl + 0.2, cost(dl), boundForCost(cost(dl)), ahead(costAt, dl + 0.2, dl), dl);
    const good = next.kind === "forced" && /choice is forced/.test(panel) && /program's bound there is 0\.000/.test(panel) && !/may still be open/.test(panel)
      && /choice is forced now/.test(rule) && /= 1\.344\./.test(rule) && /B\(∞\) = 0/.test(after) && ![panel, rule, after].some((x) => BAD.test(x));
    return { good, text: `${panel} | ${rule} | ${after}` };
  });
  check("words", "at a deadline's instant (T = 1 and 0.45), the read-out and the rule plate say the choice is forced, with the program's bound 0 and the per-moment B(0.1); just past it, B(∞) = 0",
    ok.every((x) => x.good), ok[0].text);
}
{
  // gaps from full-precision values, on the plate's own numbers at t = 0.4: 0.685 - 0.384 = 0.301
  const thin = threeRules(costOf(fig1Choice("jump")), null), cost = costOf(fig1Choice("jump"));
  const best = at(thin, "exact", 0.4), pm = toDiscrete(boundForCost(cost(0.4)), DT);
  const say = S.riseSay(0.9, best, pm, 0.4, cost(0.4), cost(-5), cost(10)), lo = S.riseSay(0.2, best, pm, 0.4, cost(0.4), cost(-5), cost(10));
  check("words", "the guess's sentence takes every gap from the full-precision values and prints them to three decimals, as the bounds are",
    /best bound is 0\.384, so your guess was 0\.516 too high/.test(say) && /0\.184 too low/.test(lo) && /The per-moment bound is 0\.685, 0\.301 above the best bound/.test(say), say);
  const up = S.panelSay({ name: "x", t: 0.3, c: 0.13, best: 0.6, pm: 1.1, wb: 0.58, next: { kind: "cost", mean: 1.2, lo: 0.13, hi: 1.6 }, dl: null });
  const dn = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.99, pm: 0.51, wb: 1.08, next: { kind: "cost", mean: 0.1, lo: 0.05, hi: 0.39 }, dl: null });
  const odd = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.4, pm: 0.51, wb: 0.4, next: { kind: "cost", mean: 0.1, lo: 0.05, hi: 0.39 }, dl: null });
  check("words", "the read-out gives a reason only when the cost ahead lies on one side and the gap points the same way", /0\.500 lower: a decision open now may still be open when the cost is higher/.test(up)
    && /0\.480 higher: a decision open now may still be open when the cost is lower/.test(dn) && /0\.110 lower than the per-moment bound\.$/.test(odd), `${up} | ${dn} | ${odd}`);
  // a drawing that swings between 0.01 and 2 from 0.32: its half-unit mean is near the cost now, but the cost isn't steady
  const pts = Array.from({ length: 26 }, (_, i) => (i === 0 ? 0.32 : i % 2 ? 0.01 : 2)), wild = drawnCost(pts), nx = ahead(wild, 0, null);
  const w = S.panelSay({ name: "Yours", t: 0, c: wild(0), best: 0.5, pm: 0.9, wb: 0.5, next: nx, dl: null });
  check("words", "on a drawing that swings from 0.01 to 2, the read-out reports the range, says nothing is steady, and gives no reason", /ranges from 0\.010 to 2\.0/.test(w) && !/within 10%|may still be open/.test(w), w);
  const r = S.ruleSay(0.3, cost(0.3), boundForCost(cost(0.3)), ahead(cost, 0.3, null), null);
  check("words", "the rule plate's sentence names the cost at the time it reads, B(c(t)), and the cost ahead it leaves out", /B\(c\(0\.3\)\) = 1\.201\./.test(r) && /between 0\.13 and 1\.6, and the rule uses none of it/.test(r), r);
  check("words", "costs print to two significant figures", S.cf(0.1001) === "0.10" && S.cf(0.0917) === "0.092" && S.cf(1.4212) === "1.4" && S.cf(16) === "16", [0.1001, 0.0917, 1.4212, 16].map(S.cf).join(", "));
}
