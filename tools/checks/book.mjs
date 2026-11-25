// The book's shared pieces: the dynamic program the contents page and every chapter solve in the browser, and the
// preset schedules against the paper's experiments code.
import * as K from "../../book/assets/js/kernel.js";
import { exactPolicy, boundForCost, OVERSHOOT } from "../../book/assets/js/model.js";
import { costOf, PRESETS } from "../../book/assets/js/schedules-book.js";
import { check } from "./lib.mjs";

// ---- the dynamic program ----------------------------------------------------------------------------------
for (const c of [0.05, 0.1, 0.5]) {
  const { ts, bounds, dt } = exactPolicy(() => c, 10);
  const k = Math.round(2 / dt);
  const want = boundForCost(c) - OVERSHOOT * Math.sqrt(dt);
  check("schedule", `constant cost ${c}: the program's bound at t = 2 is B(c) - 0.5826 sqrt(dt)`, Math.abs(bounds[k] - want) < 0.01, `${bounds[k].toFixed(4)} vs ${want.toFixed(4)}`);
}

// ---- the schedules: Figure 1's four, as the paper's experiments code writes them -----------------------------
{
  const logistic = (x) => 1 / (1 + Math.exp(-x));
  const paper = {
    jump: (t) => 0.1 + (1.6 - 0.1) * logistic((t - 0.5) / 0.05),
    fall: (t) => 0.4 + (0.05 - 0.4) * logistic((t - 0.3) / 0.05),
    rising: (t) => 0.1 + 0.8 * Math.max(t - 0.5, 0),
    deadline: (t) => (t <= 1 ? 0.1 : Infinity),
  };
  for (const [id, fn] of Object.entries(paper)) {
    const mine = costOf({ id, params: Object.fromEntries(PRESETS.find((p) => p.id === id).params.map((q) => [q.id, q.value])) });
    const worst = Math.max(...Array.from({ length: 51 }, (_, i) => { const t = i * 0.05; const a = mine(t), b = fn(t); return a === b ? 0 : Math.abs(a - b); }));
    check("schedule", `Figure 1 preset "${id}" equals the paper's schedule`, worst < 1e-12, `largest difference ${worst.toExponential(1)}`);
  }
}


// ---- a rule's bound drops at a deadline instead of sloping across the last step ---------------------------------
{
  const { dropAt } = await import("../../book/assets/js/chart.js");
  const [t, v] = dropAt([0.42, 0.44, 0.45], [1.2854, 1.2854, 0], 0.45);
  check("schedule", "at a deadline the per-moment curve holds its value up to the forced choice and drops there",
    t.length === 4 && t[2] === 0.45 && v[2] === 1.2854 && t[3] === 0.45 && v[3] === 0, `${t.join(", ")} / ${v.join(", ")}`);
  const [t2] = dropAt([0, 1, 2], [1, 1, 1], null);
  check("schedule", "without a deadline the curve is unchanged", t2.length === 3, String(t2.length));
}
