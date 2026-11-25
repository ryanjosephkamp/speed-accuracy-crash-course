// Chapter 0: the flat-bound strip's closed forms, the moment the guessing plate asks about, the schedule plate's two cases
// below the grid's first step, and the sentences.
import { B } from "../../book/assets/js/kernel.js";
import { belief, reward, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { PRESETS, costOf, deadlineOf, VIEW, SPARE } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch00.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check, ROOT, runWorker, centerActions, belowStepClass, fitsClass } from "./lib.mjs";

// ---- the flat bound: V(y) = g(b) - c (b tanh b - y tanh y) below b ------------------------------------------------
const V = (y, b, c) => belief(b) - c * (b * Math.tanh(b) - y * Math.tanh(y));
for (const c of [0.03, 0.1, 0.3, 1]) {
  const b = B(c), h = 1e-6;
  check("flat", `c = ${c}: B(c) solves sinh 2b + 2b = 1/c`, Math.abs(Math.sinh(2 * b) + 2 * b - 1 / c) * c < 1e-9, `b = ${b.toFixed(6)}`);
  const dV = (V(b, b, c) - V(b - h, b, c)) / h, dg = 1 / (2 * Math.cosh(b) ** 2);
  check("flat", `c = ${c}: smooth fit, V'(b) = g'(b) = 1/(2 cosh^2 b), within 1e-5`, Math.abs(dV - dg) < 1e-5, `${dV.toFixed(7)} vs ${dg.toFixed(7)}`);
  let worst = 0;
  for (const y of [0.1, 0.4, 0.7, 0.95].map((u) => u * b)) {
    const d = ((V(y + h, b, c) - V(y - h, b, c)) / (2 * h)) * Math.cosh(y) ** 2, want = c * (y + 0.5 * Math.sinh(2 * y));
    worst = Math.max(worst, Math.abs(d - want) / want);
  }
  check("flat", `c = ${c}: cosh^2 y V'(y) = c (y + sinh(2y)/2) below the bound, within 1e-6 relative`, worst < 1e-6, `largest relative difference ${worst.toExponential(1)}`);
  check("flat", `c = ${c}: V(0) is the flat bound's reward g(b) - c b tanh b (model.js reward)`, Math.abs(V(0, b, c) - reward(b, 1, c)) < 1e-12, `${V(0, b, c).toFixed(9)}`);
  let below = Infinity;
  for (let k = 0; k < 200; k++) { const y = (k / 200) * b; below = Math.min(below, V(y, b, c) - belief(y)); }
  check("flat", `c = ${c}: below the bound, waiting is worth at least deciding (V - g >= 0)`, below >= -1e-12, `smallest V - g ${below.toExponential(2)}`);
}

// ---- the guessing plate's moment ----------------------------------------------------------------------------------
for (const p of PRESETS) {
  const choice = { id: p.id, params: Object.fromEntries(p.params.map((q) => [q.id, q.value])) };
  const cost = costOf(choice), dl = deadlineOf(choice);
  const pmAt = (t) => (dl !== null && t >= dl - 1e-9 ? 0 : toDiscrete(boundForCost(cost(t)), 0.01));
  const t = S.guessTime(pmAt, dl ?? VIEW, dl);
  check("guess", `${p.id}: the marked moment is inside the window and at least 0.1 before its end or the deadline`, t > 0 && t <= (dl ?? VIEW) - 0.1 + 1e-9, `time ${t}${dl !== null ? `, deadline ${dl}` : ""}`);
}
{
  const jump = costOf({ id: "jump", params: { at: 0.5, factor: 16 } });
  const t = S.guessTime((u) => toDiscrete(boundForCost(jump(u)), 0.01), VIEW, null);
  check("guess", "on Figure 1's jump, the marked moment comes before the jump at 0.5", t < 0.5, `time ${t}`);
  const flat = S.guessTime(() => 1, VIEW, null);
  check("guess", "a schedule whose per-moment bound never changes is asked about at time 1", flat === 1, `time ${flat}`);
}

// ---- the sentences ----------------------------------------------------------------------------------------------
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const out = [
      S.guessSay(i % 5 ? rnd() * 2 : null, rnd() * 2, rnd() * 2, [1, 0.2, 0.5, 0.35][i % 4]),
      S.flatSay([0.03, 0.1, 0.3, 1][i % 4], B([0.03, 0.1, 0.3, 1][i % 4])),
      S.heroLabel("Cost jumps"),
    ];
    for (const s of out) { n++; if (/NaN|undefined|Infinity|null/.test(s)) bad++; }
  }
  check("words", "the plates' sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const hi = S.guessSay(0.9, 0.7, 0.8, 1), lo = S.guessSay(0.5, 0.7, 0.8, 1);
  check("words", "a guess above the best bound is called too high, below it too low, with the right gap to the per-moment rule",
    /0\.20 too high/.test(hi) && /0\.20 too low/.test(lo) && /0\.10 below the per-moment rule's 0\.80/.test(hi), hi);
  check("words", "the flat-bound sentence states both sides of the equation", /= 10\.00, which is 1\/c = 10\.00/.test(S.flatSay(0.1, B(0.1))), S.flatSay(0.1, B(0.1)));
}

// ---- below the grid's first step: the schedule plate's two cases, on the page's worker, and the words for both -------
{
  // Rising at its largest rate, from time 0: late in the window the worker's bound falls below the first step, 0.02.
  // Each plotted bound is held to the program's own Bellman step at that time, recomputed here: between the center and
  // the first step where the first step stops and the center waits, 0 where the center stops too, at least 0.02 where
  // the first step waits
  const choice = { id: "rising", params: { at: 0, rate: 2 } };
  const m = await runWorker("../../book/assets/js/dp-worker.js", { job: "bounds", choice });
  const act = await centerActions(costOf(choice), VIEW + SPARE);
  const cls = m.t.map((t) => belowStepClass(act[Math.round(t / 0.01)])), wrong = m.t.filter((t, i) => !fitsClass(cls[i], m.exact[i]));
  const between = m.t.filter((t, i) => cls[i] === "between"), stops = m.t.filter((t, i) => cls[i] === "stop");
  const words = ["ch00.py", "book.py"].map((f) => readFileSync(join(ROOT, "book/content", f), "utf8"));
  const both = words.every((w) => /places it between the center and the step if the program still waits at the center, and at 0 if it decides at the center too/.test(w) && /reports 0 in both cases/.test(w));
  check("schedule", "Rising from 0 at rate 2, on the page's worker: every plotted bound has the class the program's Bellman step gives at its time (between the center and the first step where the center waits, 0 where it stops too, at least 0.02 otherwise), with both below-step classes present; chapter 0's text and the contents page each state both cases",
    m.t.length === 126 && wrong.length === 0 && between.length > 0 && stops.length > 0 && both,
    `${between.length} times between (first ${between[0]}), ${stops.length} center stops (first ${stops[0]}), ${wrong.length} mismatched${wrong.length ? ` (first at ${wrong[0]})` : ""}; both cases stated: ${both}`);
}
