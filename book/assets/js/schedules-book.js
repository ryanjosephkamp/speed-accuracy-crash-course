// The book's ten cost schedules, shared by the pages and the solver's worker. Time is in units of sigma^2 / mu^2,
// as in the paper. Figure 1's four come first, with the paper's values (experiments/showcase.py at the tag); Pulse
// and Wave are the Decision Machine's cost-lab presets; the last three are members of the paper's smooth family
// and like members of its held-out multi-step and piecewise families, with fixed values so every reader sees the
// same schedule. Joins are logistic with scale 0.05, in log c where the paper smooths in log c.

const logistic = (x) => 1 / (1 + Math.exp(-x));
const W = 0.05;

// a piecewise-constant log c with logistic joins: levels[k] holds from breaks[k-1] to breaks[k]
function joined(levels, breaks) {
  const logs = levels.map(Math.log);
  return (t) => {
    let lc = logs[0];
    for (let k = 0; k < breaks.length; k++) lc += (logs[k + 1] - logs[k]) * logistic((t - breaks[k]) / W);
    return Math.exp(lc);
  };
}

export const PRESETS = [
  {
    id: "jump", label: "Cost jumps", group: "Figure 1",
    note: "From 0.1 to 1.6 at time 0.5: Figure 1(a).",
    params: [
      { id: "at", label: "When", min: 0.2, max: 2, step: 0.05, value: 0.5 },
      { id: "factor", label: "How many times higher", min: 2, max: 32, step: 1, value: 16, unit: "×" },
    ],
    cost: (p) => (t) => 0.1 + (0.1 * p.factor - 0.1) * logistic((t - p.at) / W),
  },
  {
    id: "fall", label: "Cost falls", group: "Figure 1",
    note: "From 0.4 to 0.05 at time 0.3: Figure 1(b).",
    params: [
      { id: "at", label: "When", min: 0.1, max: 2, step: 0.05, value: 0.3 },
      { id: "factor", label: "How many times lower", min: 2, max: 16, step: 1, value: 8, unit: "×" },
    ],
    cost: (p) => (t) => 0.4 + (0.4 / p.factor - 0.4) * logistic((t - p.at) / W),
  },
  {
    id: "rising", label: "Rising", group: "Figure 1",
    note: "0.1, then rising by 0.8 per time unit after 0.5: Figure 1(c).",
    params: [
      { id: "at", label: "Starts rising", min: 0, max: 2, step: 0.05, value: 0.5 },
      { id: "rate", label: "Rate", min: 0.1, max: 2, step: 0.05, value: 0.8 },
    ],
    cost: (p) => (t) => 0.1 + p.rate * Math.max(t - p.at, 0),
  },
  {
    id: "deadline", label: "Deadline", group: "Figure 1",
    note: "A cost of 0.1 and a forced choice at time 1: Figure 1(d).",
    params: [
      { id: "at", label: "Deadline", min: 0.4, max: 3, step: 0.05, value: 1 },
      { id: "c", label: "Cost of time", min: 0.02, max: 0.5, step: 0.01, value: 0.1 },
    ],
    cost: (p) => (t) => (t <= p.at + 1e-12 ? p.c : Infinity),
    deadline: (p) => p.at,
  },
  {
    id: "pulse", label: "Pulse", group: "Cost lab",
    note: "The cost rises for 0.4 time units, then falls back.",
    params: [
      { id: "at", label: "When", min: 0.2, max: 2, step: 0.05, value: 0.8 },
      { id: "factor", label: "How many times higher", min: 2, max: 32, step: 1, value: 8, unit: "×" },
    ],
    cost: (p) => (t) => 0.1 * (1 + (p.factor - 1) * (logistic((t - p.at) / W) - logistic((t - p.at - 0.4) / W))),
  },
  {
    id: "wave", label: "Wave", group: "Cost lab",
    note: "0.1 times 1 plus a sine: the paper's sinusoid, at any size.",
    params: [
      { id: "omega", label: "How fast", min: 0.5, max: 8, step: 0.5, value: 2 },
      { id: "size", label: "How big", min: 0.05, max: 0.6, step: 0.05, value: 0.3, unit: "%" },
    ],
    cost: (p) => (t) => 0.1 * (1 + p.size * Math.sin(p.omega * t)),
  },
  {
    id: "constant", label: "Constant", group: "Reference",
    note: "Every rule gives the constant-cost bound here.",
    params: [
      { id: "c", label: "Cost of time", min: 0.01, max: 1, step: 0.01, value: 0.1 },
    ],
    cost: (p) => () => p.c,
  },
  {
    id: "smooth", label: "Smooth", group: "Paper's families",
    note: "Three sines in log c, as in the paper's smooth family.",
    params: [
      { id: "c0", label: "Middle cost", min: 0.02, max: 0.5, step: 0.01, value: 0.1 },
      { id: "size", label: "How big", min: 0, max: 1, step: 0.05, value: 1 },
    ],
    cost: (p) => (t) => p.c0 * Math.exp(p.size * (0.5 * Math.sin(0.9 * t + 0.3) - 0.35 * Math.sin(2.3 * t + 1.9) + 0.25 * Math.sin(4.7 * t + 4.0))),
  },
  {
    id: "multistep", label: "Multi-step", group: "Paper's families",
    note: "Three steps of up to 4-fold, like the held-out multi-step family.",
    params: [
      { id: "c0", label: "First cost", min: 0.02, max: 0.5, step: 0.01, value: 0.08 },
      { id: "first", label: "First step", min: 0.2, max: 1.2, step: 0.05, value: 0.4 },
    ],
    cost: (p) => joined([p.c0, p.c0 * 3, p.c0 * 1.2, p.c0 * 4.8], [p.first, p.first + 0.7, p.first + 1.4]),
  },
  {
    id: "piecewise", label: "Piecewise", group: "Paper's families",
    note: "Levels held about 0.45 time units each, like the held-out piecewise family.",
    params: [
      { id: "scale", label: "Overall level", min: 0.25, max: 2, step: 0.05, value: 1, unit: "×" },
      { id: "length", label: "Hold time", min: 0.2, max: 0.8, step: 0.05, value: 0.45 },
    ],
    cost: (p) => joined([0.05, 0.3, 0.08, 0.6, 0.15, 0.03, 0.2].map((c) => c * p.scale),
      [1, 2, 3, 4, 5, 6].map((k) => k * p.length)),
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id);

export const DRAW = { id: "draw", label: "Draw your own", group: "Yours" };

/** A drawn schedule: log c at times 0, 0.1, ..., 2.5, linear between them and flat after the last. */
export const DRAW_TIMES = Array.from({ length: 26 }, (_, i) => i / 10);
export const DRAW_MIN = 0.01, DRAW_MAX = 2;

export function drawnCost(points) {
  const lc = points.map((c) => Math.log(Math.min(Math.max(c, DRAW_MIN), DRAW_MAX)));
  const n = lc.length;
  return (t) => {
    const x = t * 10;
    if (x <= 0) return Math.exp(lc[0]);
    if (x >= n - 1) return Math.exp(lc[n - 1]);
    const i = Math.floor(x), f = x - i;
    return Math.exp(lc[i] * (1 - f) + lc[i + 1] * f);
  };
}

export const defaultDrawing = () => DRAW_TIMES.map((t) => 0.1 * Math.exp(0.9 * Math.sin(2.2 * t)));

/** The saved schedule as { id, params } or { id: "draw", points }, and its cost function. */
export function costOf(choice) {
  if (!choice) choice = defaultChoice();
  if (choice.id === "draw") return drawnCost(choice.points || defaultDrawing());
  const p = presetById(choice.id) || PRESETS[0];
  const params = Object.fromEntries(p.params.map((q) => [q.id, choice.params?.[q.id] ?? q.value]));
  return p.cost(params);
}

export const defaultChoice = () => ({ id: "jump", params: { at: 0.5, factor: 16 } });

export function paramsOf(choice) {
  const p = presetById(choice.id);
  if (!p) return {};
  return Object.fromEntries(p.params.map((q) => [q.id, choice.params?.[q.id] ?? q.value]));
}

export function deadlineOf(choice) {
  const p = presetById(choice?.id);
  return p && p.deadline ? p.deadline(paramsOf(choice)) : null;
}

export const VIEW = 2.5;   // the window every schedule is drawn and compared over
export const SPARE = 6;    // time units the solver runs past the window, so its forced choice doesn't reach back

export function labelOf(choice) {
  if (choice?.id === "draw") return DRAW.label;
  return presetById(choice?.id)?.label ?? PRESETS[0].label;
}
