// Chapter 1: the constant-cost bound the per-moment rule reads (the rule plate); the page's three bounds held to the
// paper's code on the book's schedules (tools/validity/paper-code.json) and to the paper's own Figure 1 and Table 4
// (tools/validity/ch01.json, read from the tag's experiments/results/showcase.json); the guess at t = 0.4 on the
// 16-fold rise; and the sentences under the plates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { B } from "../../book/assets/js/kernel.js";
import { boundForCost, toDiscrete, grid } from "../../book/assets/js/model.js";
import { dropAt } from "../../book/assets/js/chart.js";
import { costOf, deadlineOf, PRESETS, VIEW, SPARE, drawnCost } from "../../book/assets/js/schedules-book.js";
import { FIG1, fig1Choice, fig1Of, threeRules, at, ahead, costStrip, isFlat, knotsOf, DT, H, CAP, SHIFT } from "../../book/assets/js/ch01-model.js";
import { panel, nowMarks, points, panelReadOut, fifthNote } from "../../book/assets/js/ch01-draw.js";
import { CHOICES, spec, costFromSpec, HORIZON } from "../validity/schedules.mjs";
import * as S from "../../book/assets/js/say-ch01.js";
import { check, table, ROOT, runWorker } from "./lib.mjs";

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
  // the whole expected timeline: every 0.01 from 0 to the window's end or the deadline, in order, nothing skipped
  const end = s.kind === "deadline" ? s.at : VIEW, N = Math.round(end / REF.dt) + 1;
  const times = n === N && r.t.every((x, i) => Math.abs(x - i * REF.dt) < 1e-9) && Math.abs(r.t[n - 1] - end) < 1e-9
    && ref.exact.length === n && ref.perMoment.length === n && ref.weighted.length === n;
  const dEx = worst(r.exact, ref.exact.slice(0, n)), dPm = worst(r.pm, ref.perMoment.slice(0, n)), dWb = worst(r.wb, ref.weighted.slice(0, n));
  check("code", `${s.id}: the plate's best bound, per-moment bound, and weighted look-ahead match the paper's code at the same ${n} times, with the same missing points (within 1e-6, 1e-10, 1e-10)`,
    times && dEx < 1e-6 && dPm < 1e-10 && dWb < 1e-10, `largest differences ${dEx.toExponential(1)}, ${dPm.toExponential(1)}, ${dWb.toExponential(1)}; ${n} times to ${end}, reference has ${ref.exact.length}`);
}
// the one place the page departs from the paper's code on purpose: below the grid's first step. On two schedules the
// tag's code (run on the page's grid, tools/validity/ch01.py) reports 0 late in the window; there the page's bound must
// lie between the center and the first step exactly where a Bellman step, recomputed here, waits at the center and
// stops at the first step, and equal the tag's value everywhere else
function bellman(cost, horizon, k0, dt = DT, h = H, cap = 5) {
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap), steps = Math.round(horizon / dt);
  const g = Float64Array.from(x, (v) => 1 / (1 + Math.exp(-2 * v))), decide = Float64Array.from(g, (v) => Math.max(v, 1 - v));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n), out = new Map();
  for (let k = steps - 1; k >= 0; k--) {
    const ck = Math.min(cost(k * dt), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      let up = 0, dn = 0;
      for (let j = -r; j <= r; j++) { const q = i + j, vj = q < 0 || q >= n ? decide[q < 0 ? 0 : n - 1] : v[q]; up += kUp[j + r] * vj; dn += kDown[j + r] * vj; }
      wait[i] = g[i] * up + (1 - g[i]) * dn - ck;
    }
    if (k <= k0) out.set(k, { center: decide[m] - wait[m], first: decide[m + 1] - wait[m + 1] });
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
  }
  return out;
}
{
  const sub = FIG.subStep, rows = [];
  check("code", "the sub-step reference was run on the page's grid: time step, evidence step, evidence cap, horizon, and window", sub.grid.dt === DT && sub.grid.h === H && sub.grid.cap === CAP && sub.grid.horizon === VIEW + SPARE && sub.grid.view === VIEW,
    `dt ${sub.grid.dt}, h ${sub.grid.h}, cap ${sub.grid.cap} (page ${CAP}), horizon ${sub.grid.horizon}, view ${sub.grid.view}`);
  // the two named fixtures, each the schedule it is named for
  const WANT = { jump32: { id: "jump", params: { at: 0.2, factor: 32 } }, ramp2: { id: "rising", params: { at: 0, rate: 2 } } };
  const named = Object.keys(sub.cases).sort().join(",") === Object.keys(WANT).sort().join(",")
    && Object.entries(WANT).every(([k, ch]) => sub.cases[k].choice.id === ch.id && Object.entries(ch.params).every(([q, v]) => sub.cases[k].choice.params[q] === v));
  for (const [name, cs] of Object.entries(sub.cases)) {
    const cost = costOf(cs.choice), r = threeRules(cost, null), tag = cs.exact;
    const act = bellman(cost, VIEW + SPARE, r.t.length - 1);
    let cells = 0, wrong = 0, other = 0, worst = 0;
    for (let i = 0; i < r.t.length; i++) {
      const page = r.exact[i], a = act.get(i), firstStops = a.first > 0;
      if (tag[i] === 0 && page > 0) {
        cells++;
        if (!(page < H && a.center < 0 && firstStops)) wrong++;
      } else {
        other++; worst = Math.max(worst, Math.abs(page - tag[i]));
        if (tag[i] === 0 && !(page === 0 && a.center >= 0)) wrong++;   // both 0: the center stops too
      }
    }
    rows.push({ ok: tag.length === r.t.length && cells > 0 && wrong === 0 && worst < 1e-6, text: `${name}: ${cells} cells where the tag reads 0 and the center waits (page between 0 and ${H}), ${other} others within ${worst.toExponential(1)}` });
  }
  check("code", "on the two tagged fixtures (the 32-fold jump at 0.2 and the ramp from 0 at rate 2), each with at least one such cell: below the grid's first step, the page departs from the tag's 0 exactly where the center waits, and matches the tag everywhere else (within 1e-6)",
    named && rows.length === 2 && rows.every((x) => x.ok), `${named ? "both fixtures present" : `fixtures ${Object.keys(sub.cases).join(", ")}`}; ` + rows.map((x) => x.text).join("; "));
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
  check("fig1", `(${p.letter}): the page's schedule is the paper's at each of its times, every one matched to a printed time (within 1e-4, the printed rounding)`, n === r.t.length && n === ps.t.length && dC < 1e-4, `largest difference ${dC.toExponential(1)} at ${n} of ${r.t.length} times; ${ps.t.length} printed`);
  check("fig1", `(${p.letter}): moved in for the paper's time step, the page's per-moment and weighted bounds are the printed curves (within 1e-4)`, dPm < 1e-4 && dWb < 1e-4, `largest differences ${dPm.toExponential(1)}, ${dWb.toExponential(1)}`);
  check("fig1", `(${p.letter}): every curve the page draws is within 0.04 of the printed figure's`, raw < 0.04, `largest difference ${raw.toFixed(4)}`);
  check("fig1", `(${p.letter}): the page's best bound, raised by the shift difference, is within 0.007 of the printed one wherever that is above 0.15`, res < 0.007, `largest difference ${res.toFixed(4)}`);
});

{
  // the caption's comparison, as it states it: for the four paper schedules, the two rule curves sit 0.032 below the
  // printed ones wherever neither is held at 0, and where one is held at 0 (the weighted rule at the deadline) both are
  let worst = 0, held = 0, n = 0, mixed = 0;
  FIG1.forEach((p, k) => {
    const r = PAGE[p.id], ps = FIG.schedules[k];
    r.t.forEach((t, i) => {
      const j = ps.t.findIndex((x) => Math.abs(x - t) < 1e-9);
      for (const [mine, theirs] of [[r.pmShift[i], ps.per_moment[j]], [r.wbShift[i], ps.weighted[j]]]) {
        if (theirs >= 4) continue;   // the printed data cap bounds at 4; none of the four reaches it
        if (mine > 0 && theirs > 0) { n++; worst = Math.max(worst, Math.abs(theirs - mine - dShift)); }
        else if (mine === 0 && theirs === 0) held++;
        else mixed++;
      }
    });
  });
  check("fig1", "for the four paper schedules, the page's rule curves sit the shift difference, 0.5826 (sqrt 0.01 - sqrt 0.002) = 0.0322 (the caption's 0.032, rounded), below the printed ones wherever neither is held at 0 (within 1e-4 of that difference), and where one is held at 0, both are",
    n > 1500 && worst < 1e-4 && held > 0 && mixed === 0, `${n} points within ${worst.toExponential(1)} of the shift difference; ${held} points 0 in both; ${mixed} mixed`);
}

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

// ---- edge cases, run through the chapter's worker and the panels' own drawing code ------------------------------------
const ask = (choice) => runWorker("../../book/assets/js/ch01-worker.js", { job: "three", choice });
const KEYS = ["t", "cost", "exact", "pm", "wb", "pmShift", "wbShift"];
{
  // a deadline at an odd hundredth keeps its forced choice: the worker's reply ends at the deadline, every curve the
  // same length, and the program's bound there is 0
  const rows = [];
  for (const dl of [0.45, 0.95, 1, 3]) {
    const m = await ask({ id: "deadline", params: { at: dl, c: 0.1 } }), n = m.t.length, N = Math.round(dl / DT) + 1;
    const ok = m.ok && n === N && m.t.every((x, i) => Math.abs(x - i * DT) < 1e-9) && KEYS.every((k) => m[k].length === n)
      && m.exact[n - 1] === 0 && at(m, "exact", dl) === 0 && at(m, "exact", +(dl - 0.01).toFixed(2)) === m.exact[n - 2] && m.exact[n - 2] > 0;
    rows.push({ ok, text: `T = ${dl}: ${n} of ${N} times, last ${m.t[n - 1].toFixed(2)}, ${m.exact[n - 2].toFixed(4)} just before, ${m.exact[n - 1]} at T` });
  }
  // and without a deadline, every curve runs the whole window, at every 0.01 from 0 to 2.5
  const j = await ask(fig1Choice("jump")), nj = j.t.length, NJ = Math.round(VIEW / DT) + 1;
  const timeline = nj === NJ && j.t.every((x, i) => Math.abs(x - i * DT) < 1e-9) && Math.abs(j.t[nj - 1] - VIEW) < 1e-9;
  const whole = j.ok && timeline && KEYS.every((k) => j[k].length === nj) && ["exact", "wbShift", "pmShift"].every((k) => j[k].every(Number.isFinite));
  check("fig1", "the chapter's worker replies to deadlines at 0.45, 0.95, 1, and 3 with every time to the forced choice, each curve the same length, the grid's own value just before it and 0 at it; and to the 16-fold rise with every time every 0.01 from 0 to 2.5 and every curve over them",
    rows.every((x) => x.ok) && whole, rows.map((x) => x.text).join("; ") + `; rise: ${nj} of ${NJ} times, on the 0.01 grid to ${j.t[nj - 1]}: ${timeline}, all finite: ${whole}`);
  // the read-out at t = 0.99 on panel (d) is the program's value there, not a line drawn across to the 0 at t = 1
  const d = await ask(fig1Choice("deadline"));
  check("fig1", "panel (d), read from the worker's reply at t = 0.99, gives the program's own values at 0.99", at(d, "exact", 0.99) === d.exact[99] && at(d, "wbShift", 0.99) === d.wbShift[99],
    `${at(d, "exact", 0.99).toFixed(4)} and ${at(d, "wbShift", 0.99).toFixed(4)}`);
  // the panel as drawn: both of panel (d)'s solved curves run flat to t = 1, then straight down to the axis's 0
  const p = { cost: costOf(fig1Choice("deadline")), dl: 1, data: d };
  const g = panel(p, { x0: 0, y0: 0, w: 170, bh: 104, yTop: 1.86, selected: false, title: "(d)" });
  const drops = ["ex", "wb"].map((k) => {
    const pts = points(g.paths[k]), q = pts.length, X = +g.sx(1).toFixed(1);
    const key = k === "ex" ? "exact" : "wbShift";
    return { ok: pts[q - 1][0] === X && pts[q - 2][0] === X && pts[q - 1][1] === +g.syB(0).toFixed(1) && pts[q - 2][1] === +g.syB(d[key][99]).toFixed(1),
      text: `${k}: last points ${JSON.stringify(pts.slice(-3))}` };
  });
  check("fig1", "panel (d) as drawn: the best bound and the weighted rule both run flat to t = 1 and drop straight down to 0 there", drops.every((x) => x.ok), drops.map((x) => x.text).join("; "));
  // the panels as drawn: the cost line holds the whole cost inside its strip, and the dot at a time sits on the line
  // (the fifth panel's knots are passed as the plate passes them, so a drawing's path turns at each knot)
  const strips = [], vertexAt = (line, x) => line.find(([px]) => Math.abs(px - x) < 0.051);
  const sharp = Array(26).fill(0.01); sharp[2] = 2;
  for (const [ch, T] of [[{ id: "constant", params: { c: 1 } }, 1.25], [{ id: "jump", params: { at: 0.2, factor: 32 } }, 1.25], [{ id: "draw", points: Array.from({ length: 26 }, (_, i) => (i % 2 ? 2 : 0.5)) }, 1.25], [{ id: "draw", points: sharp }, 0.2]]) {
    const q = { cost: costOf(ch), dl: null, data: await ask(ch), knots: knotsOf(ch) };
    const gg = panel(q, { x0: 0, y0: 0, w: 420, bh: 130, yTop: 2, selected: false, title: "x" });
    const line = points(gg.paths.cost), X = +gg.sx(T).toFixed(1), v = vertexAt(line, X);
    const dot = +nowMarks(q, gg, T).match(/acc-dot" cx="[\d.]+" cy="([\d.]+)"/)[1];
    // every knot is a vertex of the path, at the knot's own cost on the strip's scale (to the path's 0.1 px rounding)
    const knots = ch.id === "draw" ? Array.from({ length: 26 }, (_, i) => i / 10).every((u) => { const pt = vertexAt(line, +gg.sx(u).toFixed(1)); return pt && Math.abs(pt[1] - gg.syC(q.cost(u))) < 0.051; }) : true;
    const inside = line.every(([, y]) => y >= gg.cT - 1e-9 && y <= gg.cB + 1e-9), spread = Math.max(...line.map((u) => u[1])) - Math.min(...line.map((u) => u[1]));
    strips.push({ ok: line.length >= 181 && inside && knots && v && Math.abs(v[1] - dot) < 0.11 && (ch.id === "constant" ? spread === 0 : spread > 0.5 * (gg.cB - gg.cT)),
      text: `${ch.id === "draw" ? (ch.points[2] === 2 && ch.points[3] === 0.01 ? "sharp knot" : "alternating drawing") : ch.id}: ${line.length} points from ${Math.min(...line.map((u) => u[1]))} to ${Math.max(...line.map((u) => u[1]))} inside ${gg.cT}–${gg.cB}; at t = ${T} line ${v?.[1]}, dot ${dot}${ch.id === "draw" ? `; a vertex at every knot: ${knots}` : ""}` });
  }
  check("fig1", "the panels as drawn keep the cost line inside its strip on its own scale (a constant 1, a rise to 3.2, a drawing alternating 0.5 and 2, and a drawing at 0.01 with one knot of 2 at t = 0.2), turn a drawing's path at each of its knots, at that knot's cost, and put the dot on the line (at t = 1.25, and at the sharp knot itself)", strips.every((x) => x.ok), strips.map((x) => x.text).join("; "));
  // a positive bound below the grid's first step shows as positive, in the read-out's tile and its sentence, as the
  // plate prints them (panelReadOut, whose tiles and sentence the plate assigns as they come)
  const ramp = { id: "rising", params: { at: 0, rate: 2 } }, rm = await ask(ramp), b193 = at(rm, "exact", 1.93), b192 = at(rm, "exact", 1.92);
  const yp = { cost: costOf(ramp), dl: null, data: rm }, r193 = panelReadOut(yp, 1.93, "Yours", false), r192 = panelReadOut(yp, 1.92, "Yours", false);
  check("words", "the read-out on a ramp from 0 at rate 2: the worker's bound at t = 1.93 is positive and would round to 0.000, so the best-bound tile reads \"< 0.001\" and the sentence says the program still waits at the center; at t = 1.92 the bound rounds to 0.001 and reads so",
    b193 > 0 && b193 < 0.0005 && r193.tiles.best === "< 0.001" && r193.html.includes("<dd>< 0.001</dd>") && /best bound is below 0\.001 but above 0 \(the program still waits at the center\)/.test(r193.say)
    && b192 >= 0.0005 && b192 < 0.001 && r192.tiles.best === "0.001" && S.bf(0) === "0.000", `${b193.toExponential(3)}: tile ${r193.tiles.best}; ${r193.say} | ${b192.toExponential(3)}: tile ${r192.tiles.best}`);
}
{
  // the note above the fifth panel, as the plate prints it (fifthNote): a cost that doesn't change gets the constant-cost
  // note, whatever its preset is called, and a drawing whose knots differ at all does not
  const same = /Your cost doesn't change, so B\(c\) is the best bound on an infinite horizon/;
  const flatChoices = [["Constant 0.01", { id: "constant", params: { c: 0.01 } }], ["Smooth of size 0", { id: "smooth", params: { c0: 0.1, size: 0 } }],
    ...[0.01, 0.02, 0.05, 0.07, 0.3, 0.5, 2].map((v) => [`a drawing of 26 knots at ${v}`, { id: "draw", points: Array(26).fill(v) }]),
    ["a drawing at 0.005 and 0.01 (both 0.01 once clamped)", { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i % 2 ? 0.005 : 0.01)) }]];
  const varyChoices = [["a drawing from 0.010000 to 0.010025", { id: "draw", points: Array.from({ length: 26 }, (_, i) => 0.01 + i * 0.000001) }],
    ["a drawing at 0.5 with its last knot 0.5000001", { id: "draw", points: Array.from({ length: 26 }, (_, i) => (i === 25 ? 0.5000001 : 0.5)) }], ["Figure 1(a)", fig1Choice("jump")]];
  const flat = flatChoices.map(([name, ch]) => ({ name, ok: same.test(fifthNote(ch)) }));
  const varies = varyChoices.map(([name, ch]) => ({ name, ok: !same.test(fifthNote(ch)) && !/doesn't change/.test(fifthNote(ch)) }));
  check("fig1", "the note above the fifth panel calls a schedule's cost constant by the cost, not the preset's name: Constant, Smooth of size 0, and drawings of equal knots at 0.01, 0.02, 0.05, 0.07, 0.3, 0.5, and 2 (and one that is equal once clamped) get the constant-cost note; drawings from 0.010000 to 0.010025, or with one knot 0.5000001 among 0.5, and Figure 1(a) don't",
    [...flat, ...varies].every((x) => x.ok), [...flat, ...varies].filter((x) => !x.ok).map((x) => x.name).join(", ") || `${flat.length} constant, ${varies.length} changing; ${fifthNote(varyChoices[0][1])}`);
  // the helper on its own: the old sampled test disagreed with the knots at ordinary costs, from interpolation's last digit
  const drift = costOf({ id: "draw", points: Array(26).fill(0.02) });
  check("fig1", "isFlat, the helper the note uses: equal knots at 0.02 are flat although their interpolated costs differ in the last binary digit (time 0 against 0.02)", isFlat({ id: "draw", points: Array(26).fill(0.02) }, VIEW + SPARE) && drift(0) !== drift(0.02),
    `${drift(0)} and ${drift(0.02)}`);
}

{
  // the caption says what the tile does: "< 0.001" for a positive bound that would round to 0.000 (bf's cutoff, 0.0005),
  // and a printed comparison for the fifth panel only when it is one of the four at the paper's values
  const text = readFileSync(join(ROOT, "book/content/ch01.py"), "utf8");
  check("words", "Figure 1's caption gives the tile's cutoff as rounding to 0.000 (0.0007 reads 0.001, 0.0004 reads < 0.001), and allows a printed comparison for the fifth panel when it is one of the four at the paper's values",
    /such a bound that would round to 0\.000 reads "< 0\.001"/.test(text) && /has a printed curve to compare only when it is one of the four at the paper's values/.test(text) && !/no printed curve to compare\./.test(text)
    && S.bf(0.0007) === "0.001" && S.bf(0.0004) === "< 0.001" && /This is Figure 1\(a\) itself/.test(fifthNote(fig1Choice("jump"))), "book/content/ch01.py");
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
      && /choice is forced now/.test(rule) && /B\(c\(\d[\d.]*\)\) ≈ 1\.344\./.test(rule) && /B\(∞\) = 0/.test(after) && ![panel, rule, after].some((x) => BAD.test(x));
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
  // a gap where rounding the operands first would print 0.302: the sentence prints the full-precision 0.301
  const pre = S.riseSay(null, 0.3844, 0.6856, 0.4, 0.28, 0.1, 1.6);
  check("words", "a gap is the difference of the full-precision values (0.6856 - 0.3844 = 0.3012 prints 0.301; rounding first would give 0.302)", /0\.301 below the per-moment bound's 0\.686/.test(pre), pre);
  const one = { kind: "cost", mean: 1.2, lo: 0.13, hi: 1.6, up: true, down: false }, two = { kind: "cost", mean: 0.1, lo: 0.05, hi: 0.39, up: false, down: true };
  const up = S.panelSay({ name: "x", t: 0.3, c: 0.13, best: 0.6, pm: 1.1, wb: 0.58, next: one, dl: null, explain: true });
  const dn = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.99, pm: 0.51, wb: 1.08, next: two, dl: null, explain: true });
  const odd = S.panelSay({ name: "x", t: 0.1, c: 0.39, best: 0.4, pm: 0.51, wb: 0.4, next: two, dl: null, explain: true });
  const off = S.panelSay({ name: "x", t: 0.3, c: 0.13, best: 0.6, pm: 1.1, wb: 0.58, next: one, dl: null, explain: false });
  check("words", "the read-out gives a reason only on the paper's schedules, and only when every sampled cost ahead is on the side the gap points to",
    /sampled over the next half time unit it rises, to a mean of 1\.2\..*0\.500 lower: a decision open now may still be open when the cost is higher/.test(up)
    && /it falls, to a mean of 0\.10\..*0\.480 higher: a decision open now may still be open when the cost is lower/.test(dn) && /0\.110 lower than the per-moment bound\.$/.test(odd)
    && /0\.500 lower than the per-moment bound\.$/.test(off), `${up} | ${dn} | ${odd} | ${off}`);
  // a drawing that crosses its starting level: down to 0.099, up to 0.25, then back and forth (the auditor's case), and
  // one that dips less than 2% before rising: neither is called a rise, and no reason is given even where one may be
  const knots = (head) => Array.from({ length: 26 }, (_, i) => head[Math.min(i, head.length - 1)]);
  const cross = drawnCost(knots([0.10, 0.099, 0.25, 0.12, 0.22, 0.15])), dip = drawnCost(knots([0.10, 0.0995, 0.2, 0.3, 0.3, 0.3]));
  const cx = ahead(cross, 0, null), dx = ahead(dip, 0, null);
  const sc = S.panelSay({ name: "Yours", t: 0, c: cross(0), best: 0.9, pm: 1.08, wb: 0.9, next: cx, dl: null, explain: true });
  const sd = S.panelSay({ name: "Yours", t: 0, c: dip(0), best: 0.9, pm: 1.08, wb: 0.9, next: dx, dl: null, explain: true });
  check("words", "a sampled cost that crosses its starting level, even by less than 2%, is reported by its range and mean, not as a rise, and gets no reason",
    !cx.up && !dx.up && /ranges from 0\.099 to 0\.25, with a mean of/.test(sc) && /ranges from 0\.10 to 0\.30, with a mean of/.test(sd) && ![sc, sd].some((x) => /rises|may still be open/.test(x)), `${sc} | ${sd}`);
  // the sampled mean is the trapezoid rule's: exact on a straight ramp
  const ramp = costOf({ id: "rising", params: { at: 0, rate: 2 } }), rmn = ahead(ramp, 0, null).mean;
  check("words", "the half-unit mean of a straight ramp from 0.1 at rate 2 is its exact mean, 0.6", Math.abs(rmn - 0.6) < 1e-12, `${rmn}`);
  // a drawing that swings between 0.01 and 2 from 0.32: its half-unit mean is near the cost now, but the cost isn't steady
  const pts = Array.from({ length: 26 }, (_, i) => (i === 0 ? 0.32 : i % 2 ? 0.01 : 2)), wild = drawnCost(pts), nx = ahead(wild, 0, null);
  const w = S.panelSay({ name: "Yours", t: 0, c: wild(0), best: 0.5, pm: 0.9, wb: 0.5, next: nx, dl: null });
  check("words", "on a drawing that swings from 0.01 to 2, the read-out reports the range, says nothing is steady, and gives no reason", /ranges from 0\.010 to 2\.0/.test(w) && !/within 10%|may still be open/.test(w), w);
  const r = S.ruleSay(0.3, cost(0.3), boundForCost(cost(0.3)), ahead(cost, 0.3, null), null);
  const past = S.ruleSay(1.2, 0.17, boundForCost(0.17), { kind: "past" }, 1), rounded = S.ruleSay(0.3, 0.1234, boundForCost(0.1234), { kind: "cost", lo: 0.12, hi: 0.13, mean: 0.125 }, null);
  check("words", "the rule plate's sentence names the cost symbolically, marks rounded decimals with ≈ and exact ones with =, and reports the cost ahead it leaves out",
    /c\(0\.3\) ≈ 0\.13, so the per-moment bound is B\(c\(0\.3\)\) ≈ 1\.201\./.test(r) && /between 0\.13 and 1\.6, and the rule uses none of it/.test(r)
    && /B\(c\(1\)\) ≈ 1\.026, with c\(1\) = 0\.17/.test(past) && /c\(0\.3\) ≈ 0\.12/.test(rounded), `${r} | ${past}`);
  check("words", "costs print to two significant figures", S.cf(0.1001) === "0.10" && S.cf(0.0917) === "0.092" && S.cf(1.4212) === "1.4" && S.cf(16) === "16", [0.1001, 0.0917, 1.4212, 16].map(S.cf).join(", "));
}
