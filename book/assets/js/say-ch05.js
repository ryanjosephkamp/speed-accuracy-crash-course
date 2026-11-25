// The sentences under chapter 5's plates, as functions of the numbers the plates compute. Wording can change here
// without touching a value; tools/checks/ch05.mjs runs these on random numbers and on the plates' own.
const fx = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace(/^-/, "−") : "–");
const f2 = (x) => fx(x, 2), f3 = (x) => fx(x, 3), f4 = (x) => fx(x, 4);
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

/** A small number in scientific form, "5.6 × 10⁻⁴"; numbers of 0.01 or more as decimals. */
export function sci(x) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const a = Math.abs(x), sign = x < 0 ? "−" : "";
  if (a >= 0.01) return sign + a.toFixed(3);
  let e = Math.floor(Math.log10(a)), m = a / 10 ** e;
  if (+m.toFixed(1) >= 10) { m /= 10; e += 1; }
  return `${sign}${m.toFixed(1)} × 10${String(e).split("").map((ch) => SUP[ch]).join("")}`;
}

/** Whether an expected cost and the cost now agree within 2% (the tolerance the sentences below name). */
export const near = (a, b) => Math.abs(a - b) <= 0.02 * Math.abs(b);

export function heroLabel(t, bc, Bc, top, L) {
  if (!Number.isFinite(bc)) return `At time ${t.toFixed(1)}: solving the dynamic program`;
  const where = bc < Bc - 0.01 ? `below B(c) = ${f2(Bc)}` : bc > Bc + 0.01 ? `above B(c) = ${f2(Bc)}` : `within 0.01 of B(c) = ${f2(Bc)}`;
  const cost = Number.isFinite(top) && top > 1.02 ? `the expected cost at decision runs up to ${top.toFixed(1)} times the cost now` : "the expected cost at decision is within 2% of the cost now";
  return `At time ${t.toFixed(1)}: ${cost}, and the area (${f3(L)} on the grid) ends at ${f2(bc)}, ${where}`;
}

/** "1 time", "182 times". */
export const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A cost bound printed to three significant figures, rounded down (lo) or up (hi), so the printed interval holds the
 * true one. */
export function outward(x, up) {
  if (!(x > 0) || !Number.isFinite(x)) return "–";
  const unit = 10 ** (Math.floor(Math.log10(x)) - 2), k = x / unit;
  const r = up ? Math.ceil(k - 1e-9) : Math.floor(k + 1e-9);
  return String(+(r * unit).toPrecision(3));
}

/** The hero chart's second label line: the areas are 1/4 in the model; the green one's value on the grid. */
export const heroChartLabel = (L) => (Number.isFinite(L) ? `areas about ¼; the green one is ${L.toFixed(3)} on the grid` : "areas about ¼");

/** A ratio of costs: two decimals below 2, one below 10, none above. */
export const fold = (x) => (Number.isFinite(x) ? x.toFixed(x < 1.995 ? 2 : x < 9.95 ? 1 : 0) : "–");

/** A time to two significant figures: 0.017, 0.0020, 0.00028. */
export const sig = (x) => (Number.isFinite(x) && x > 0 ? (x >= 0.01 ? x.toFixed(3) : x.toPrecision(2)) : "–");

// ---- Lemma 2: the frozen rule
export function frozenOutside(t, y, b) {
  return `At time ${f2(t)}, evidence ${y} is at or past the bound (${f3(b)}), so the decision is made at once and there is no rule to freeze. Pick a smaller y.`;
}

export function frozenSay(step, o) {
  if (step === 0) return `At time ${f2(o.t)}, the value from evidence ${o.y} is ${f4(o.V)}. Below the bound it rises with the evidence, flat at 0, and at the bound, ${f3(o.b)}, it meets the reward for deciding now.`;
  if (step === 1) {
    const s = `Over this window, the frozen rule's reward is never above the value by more than ${sci(Math.max(o.gap, 0))} (rounding, and the choice forced at time 8, which a rule started later can run past), and it equals the value at time ${f2(o.t)}.`;
    return o.n ? s + ` The faint curves are the rule frozen at ${o.n} other times: the value is never below any of them and touches each at its own time.` : s;
  }
  if (step === 2) return `From time ${f2(o.t)} and evidence ${o.y}, the decision ends ${f2(o.mean)} time units later on average, when the cost averages ${f3(o.Ec)}, against ${f3(o.c)} now. The rate at which the cost paid changes with the start involves only these two costs, so J′(t) = ${f4(o.c - o.Ec)}.`;
  if (step === 3) {
    const d = Math.max(Math.abs(o.Vt - o.Jt), Math.abs(o.Vt - o.ident), Math.abs(o.Jt - o.ident));
    return `The value's slope at time ${f2(o.t)} is ${f4(o.Vt)}, the frozen rule's is ${f4(o.Jt)}, and c(t) − E[c(t + τ*)] is ${f4(o.ident)}: they agree to within ${sci(d)}, a gap that comes from taking differences over the grid's time step of ${o.dt}.`;
  }
  const more = o.u0 > o.c * 1.02 ? "decisions started far from the bound end later, after more of the rise, so the expected cost when they end is higher."
    : o.u0 < o.c * 0.98 ? "decisions started far from the bound end later, when the cost is lower." : "the expected cost at decision is within 2% of the cost now, so the curvature term is too; for a constant cost, the two would be equal.";
  return `At time ${f2(o.t)}, the expected cost at the moment of decision runs from ${f3(o.u0)} at evidence 0 to ${f3(o.ub)} just below the bound, against ${f3(o.c)} now: ${more}`;
}

/** The sign of V_t, with |V_t| < 0.002 counted as no difference. */
export const slopeSign = (Vt) => (Math.abs(Vt) < 0.002 ? "same" : Vt < 0 ? "worse" : "better");

export function frozenVerdict(guess, Vt, t, y, c, Ec) {
  const sign = slopeSign(Vt);
  const lead = !guess ? "" : guess === sign ? "Right. " : "Not here. ";
  const what = sign === "worse" ? `starting a little later is worse. By the envelope identity, V_t = c(t) − E[c(t + τ*)], and the expected cost at the moment of decision, ${f3(Ec)}, is above the cost now, ${f3(c)}.`
    : sign === "better" ? `starting a little later is better. By the envelope identity, V_t = c(t) − E[c(t + τ*)], and the expected cost at the moment of decision, ${f3(Ec)}, is below the cost now, ${f3(c)}.`
      : `starting a little later makes almost no difference: the expected cost at the moment of decision, ${f3(Ec)}, is within 0.002 of the cost now, ${f3(c)}.`;
  return `${lead}At time ${f2(t)} from evidence ${y}, the value changes by ${Math.abs(Vt) < 5e-5 ? "less than 0.0001" : f4(Vt)} per time unit of delay: ${what}`;
}

// ---- Proposition 3: regularity
export function regularSay(step, o) {
  if (step === 0) return `At time ${f2(o.t)}, the curvature term of W below the bound is at least ${f3(o.lo)}, never below c_min = ${o.cmin}: the expected cost at decision can't be lower than the lowest cost.`;
  if (step === 1) {
    const where = o.margin >= 0 ? `On this grid, W stays above the parabola everywhere below the bound (smallest margin ${sci(o.margin)}).`
      : `On this grid, W dips below the parabola by at most ${sci(-o.margin)}, near the bound, at the grid's resolution.`;
    return `${where} At y = 0, W is ${f4(o.W0)}, against the parabola's ${f4(o.par0)}.`;
  }
  if (step === 2) {
    const inside = o.Wy >= o.lower - 1e-9 && o.Wy <= o.upper + 1e-9;
    const s = inside ? `At the lower bound's level, W at time ${f2(o.th)} is ${f4(o.Wy)}: above the floor c_min Δb² = ${f4(o.lower)} and below the cap ${f4(o.upper)}.`
      : `At the lower bound's level, W at time ${f2(o.th)} is ${f4(o.Wy)}, outside the floor ${f4(o.lower)} and the cap ${f4(o.upper)} on this grid.`;
    return s + ` The two bounds differ by ${f3(o.db)}, ${o.db <= o.allowed ? "within" : "more than"} the ${f3(o.allowed)} that C√|Δt| allows.`;
  }
  if (step === 3) {
    const ok = o.all.filter((a) => Number.isFinite(a.median));
    const list = ok.map((a, i) => `${i === ok.length - 1 && ok.length > 1 ? "and " : ""}${sig(a.median)}${i === 0 ? " time units" : ""} from ε = ${a.e}`).join(ok.length > 2 ? ", " : " ");
    const falls = ok.length > 1 && ok.every((a, i) => i === 0 || a.median <= ok[i - 1].median);
    const none = o.all.filter((a) => !Number.isFinite(a.median)).map((a) => a.e);
    let s = list ? `Half the 200 paths have crossed by ${list}.${falls ? " The closer the start, the sooner they cross." : ""}` : "";
    if (none.length) s += `${s ? " " : ""}From ε = ${none.join(" and ")}, fewer than half cross by the end of the run.`;
    return s + " Paths still below the bound at the end are counted as not crossed. These are sampled paths against the computed bound; the proof's law of the iterated logarithm covers even the fastest rise (b) allows, which no sample can show.";
  }
  const r = o.ratios, first = r[0], lastR = r[r.length - 1];
  const shrink = r.every((q, i) => i === 0 || q.r < r[i - 1].r);
  return `On this grid, with evidence step ${o.h}, the sizes of the chords' slopes, W(t, b − ε)/ε, ${shrink ? "shrink" : "go"} from ${f4(first.r)} at ε = ${f3(first.e)} to ${f4(lastR.r)} at ε = ${f3(lastR.e)}, measured from grid points to the grid's bound; in the model they tend to 0, which is smooth fit (Proposition 3(c)). In the last cell below the bound, V's slope is ${f3(o.slope)} and g's is ${f3(o.gp)}.`;
}

// ---- the Hölder band
export function bandSay(ratio, C, fall, cfac) {
  const inside = ratio <= C ? `inside the C = ${f2(C)} the proposition allows` : `above the C = ${f2(C)} the proposition allows, so here the grid's bound is only a comparison`;
  return `On this schedule, sampled every 0.01 from 0 to 2.5 on the grid, the computed bound never moves more than ${f2(ratio)} times the square root of the time between two moments, ${inside}. Its largest move in any 0.05 time units is ${f3(fall)}, while the cost changes up to ${fold(cfac)}-fold in 0.05.`;
}

export function bandVerdict(guess, fall, cfac, C) {
  const lead = guess === "cont" ? "Right: " : guess === "jump" ? "No: " : "";
  return `${lead}the bound can't jump. Proposition 3(b) caps any move at C√|Δt|, with C = ${f2(C)} here, so the bound is continuous however steep the cost. On the grid, in 0.05 time units the cost changes up to ${fold(cfac)}-fold and the computed bound moves at most ${f3(fall)}; the cap would allow ${f2(C * Math.sqrt(0.05))}, so on this grid it is far from tight.`;
}

export const bandVerdictElse = () => "The answer is for Figure 1(a): pick it again to see it.";

export function standingNote(why, label) {
  if (why === "deadline") return "A deadline makes the cost infinite at the deadline, so the standing assumption (a continuous cost between two positive levels) fails and the exact equation says nothing there. The page doesn't draw it; pick another schedule.";
  if (why === "rising") return "This cost keeps rising, so it has no upper level: the standing assumption fails and the exact equation doesn't cover it. The page doesn't draw it; pick another schedule.";
  if (why === "draw") return "Your drawing is joined by straight lines in log c and held flat after time 2.5, so it is continuous and stays between its lowest and highest points: the equation covers it.";
  if (why === "constant") return "A constant cost: the expected cost at decision is the cost itself, and the equation is sinh 2b + 2b = 1/c.";
  return `${label}: continuous, and between two positive levels, so the equation covers it.`;
}

// ---- Proposition 4: the area
export function areaSay(step, o) {
  if (step === 0) return `At time ${f2(o.t)}, the expected cost at decision from evidence 0 is ${f3(o.u0)}, against ${f3(o.c)} now. Times 2 cosh² y, it is the slope of cosh² y V_y, which is 0 at y = 0.`;
  if (step === 1) return `Up to z = ${f2(o.z)}, the shaded area is ${f4(o.Rz)}. The dots, from differences of the program's value, are cosh² z V_y(t, z), within ${sci(o.gap)} of the curve.`;
  if (step === 2) return `At the bound, ${f3(o.bc)}, the shaded area is ${f4(o.R)} on the grid. In the model it is exactly ½ there: cosh² z g′(z) = ½ at every z, and smooth fit makes V_y equal g′ at the bound.`;
  const why = o.bc < o.Bc - 0.01 ? "the expected cost at decision is higher than the cost now, so the same area is reached sooner."
    : o.bc > o.Bc + 0.01 ? "the expected cost at decision is lower than the cost now, so the same area is reached later." : "the expected cost at decision is close to the cost now, so the two bounds are within 0.01 of each other.";
  return `So the area is ${f4(o.L)}, which differs from ¼ by ${sci(Math.abs(o.L - 0.25))} on the grid. The bound is ${f3(o.bc)}, against the per-moment ${f3(o.Bc)}: ${why}`;
}

// ---- the live check
/** The live plate's sentence, from liveSummary's numbers (one mask throughout: a time whose bound is below the grid's
 * first step h is unresolved and left out of every residual): w over the resolved times from 0 to 2.5 (NaN if none);
 * wf and wc, the two grids' largest residuals at the times both resolve; unresolved of nWin times in the window shown,
 * 0 to X; tail over the resolved times in the last time unit (NaN if none) and tailSkipped; fold, the cost's range. */
export function liveSay(o) {
  const res = o.skipped > 0 ? " at the resolved times" : "";
  const window = Number.isFinite(o.nWin) && Number.isFinite(o.X) ? ` of the ${o.nWin} times from 0 to ${o.X}${o.far ? " before the forced choice" : ""} (every 0.01)` : " of the times shown";
  const h = Number.isFinite(o.h) ? `, ${o.h}` : "";
  const unres = o.unresolved > 0 ? ` At ${o.unresolved}${window}, the bound on this grid is below its first step${h}, which the grid can't resolve: the program puts it between 0 and that step where the center still waits, and at 0 where the center stops too. Those times are gaps in the charts and are left out of every residual given here.` : "";
  let tail = "";
  if (o.far) tail = Number.isFinite(o.tail)
    ? ` In the last time unit before the forced choice at ${o.horizon}, ${o.tailSkipped > 0 ? "at the resolved times, " : ""}the left side moves away from ¼, by up to ${f3(o.tail)}: there the bound is the finite-horizon problem's, which the equation is not about.`
    : ` In the last time unit before the forced choice at ${o.horizon}, the bound on this grid is below its first step at every time, so the left side isn't resolved there.`;
  const grids = Number.isFinite(o.wf) && Number.isFinite(o.wc)
    ? ` Going from Δt 0.01 with h 0.02 to Δt 0.002 with h 0.005, with the same horizon, ${o.wf < o.wc ? "lowers" : "doesn't lower"} the largest residual${o.restricted ? " at the times both grids resolve" : ""}, from ${sci(o.wc)} on the first to ${sci(o.wf)} on the second.` : "";
  const steep = Number.isFinite(o.wf) && o.wf > 1.5e-3
    ? ` On the finer grid, the residual is more than the 1.5 × 10⁻³ that the paper's test allows for its three schedules${Number.isFinite(o.fold) && o.fold > 4 ? `, which change by at most 4-fold; this one's cost changes ${fold(o.fold)}-fold up to time ${o.horizon}` : ""}.` : "";
  const first = Number.isFinite(o.w)
    ? (o.constant ? `For a constant cost, the left side is c(b/2 + sinh 2b/4); on the grid with Δt ${o.dt}, it is within ${sci(o.w)} of ¼ at every ${o.skipped > 0 ? "resolved " : ""}time shown from 0 to 2.5.`
      : `For “${o.label}”, the left side stays within ${sci(o.w)} of ¼ from time 0 to 2.5${res} on the grid with Δt ${o.dt}.`)
    : `For “${o.label}”, the bound on the grid with Δt ${o.dt} is below its first step at every time from 0 to 2.5, so the left side isn't resolved there.`;
  if (o.constant) return `${first}${grids}${unres}${tail}`;
  const pm = Number.isFinite(o.w) ? ` With the cost now in place of the cost at decision, the left side misses ¼ by up to ${f3(o.pm)}${res}.` : "";
  return `${first}${grids}${steep}${unres}${pm}${tail}`;
}

// ---- the remark on scale and speed
export function speedSay(model, c, b, A, target) {
  const who = model === "y" ? `For Y at a cost of ${f3(c)}` : `For u at a cost of ${f3(c)} per unit of information time`;
  const s = `${who}, the cost times the speed density has area ${f4(A)} from 0 to the bound, ${f3(b)}: the reward's slope over the scale density, ${f4(target)}, the same at every level because the reward is harmonic.`;
  return model === "y" ? s : s + " For this process the equation is carried over formally, not proved.";
}
