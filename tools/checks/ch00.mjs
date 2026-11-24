// Chapter 0: the flat-bound strip's closed forms, the moment the guessing plate asks about, and the sentences.
import { B } from "../../book/assets/js/kernel.js";
import { belief, reward, boundForCost, toDiscrete } from "../../book/assets/js/model.js";
import { PRESETS, costOf, deadlineOf, VIEW } from "../../book/assets/js/schedules-book.js";
import * as S from "../../book/assets/js/say-ch00.js";
import { check } from "./lib.mjs";

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
