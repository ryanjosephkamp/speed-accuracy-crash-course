// The sentences under Appendix B's plates, as pure functions of the numbers the plates compute. tools/checks/appB.mjs
// runs each over the plates' edge inputs and thousands of random ones.

const f4 = (x) => (Math.abs(x) < 0.00005 ? "0.0000" : x.toFixed(4));
const fc = (c) => String(+c.toPrecision(2));
const ft = (t) => String(+t.toFixed(2));
/** A difference's size, to three significant figures, so one near 0.001 or 0.01 doesn't print as that tolerance. */
export const fdiff = (d) => {
  const a = Math.abs(d);
  if (a < 1e-6) return "less than 0.000001";
  const p = +a.toPrecision(3);
  return String(p === 0.001 || p === 0.01 ? +a.toPrecision(6) : p);
};
/** Two bounds, to four decimals, or to six where four would print them the same. */
const pair = (a, b) => (f4(a) === f4(b) ? [a.toFixed(6), b.toFixed(6)] : [f4(a), f4(b)]);

/** The cost slider's label. */
export const costLabel = (c) => fc(c);

/** Under the horizon plate, after Show me. d1 and d2: the time left at the last check, counting back from the forced
 * choice, where the bound is more than 0.001 and 0.01 from binf, its value with `long` time units left; b0: the
 * bound at t = 0 with the choice forced at T. */
export function horizonSay(c, T, long, binf, d1, d2, b0) {
  const head = `At a cost of ${fc(c)}, the bound is more than 0.001 from its value with ${long} time units left (${f4(binf)}) only with ${ft(d1)} time units left or fewer, and more than 0.01 from it (a second tolerance) only with ${ft(d2)} left or fewer.`;
  if (T > d1 + 1e-9) return `${head} With the choice forced at ${ft(T)}, the earliest check where it is more than 0.001 from that value is at t = ${ft(T - d1)}; every check before it is within 0.001.`;
  return `${head} With the choice forced at ${ft(T)}, it is more than 0.001 from that value at every check from t = 0 on: at t = 0, the bound is ${f4(b0)}, ${fdiff(binf - b0)} below it.`;
}

/** The verdict on the reader's guess of d1. */
export const guessSay = (guess, d1) => `You guessed about ${ft(guess)} time units; on this grid, from the solve with the choice forced at 30, it is ${ft(d1)}.`;

/** Under the bins plate. xb: the belief grid's bound in evidence (Infinity when it waits at every bin, 0 when it
 * decides at the first bin above 1/2); xe: the evidence grid's bound; gap: the distance in evidence between the two
 * bin midpoints around xb. Both programs have `long` time units left. */
export function binsSay(c, n, long, xb, xe, B, gap) {
  const head = `At a cost of ${fc(c)}, with ${n} bins and ${long} time units left,`;
  if (!Number.isFinite(xb)) return `${head} the belief grid's program waits at every bin, so it has no bound on this grid. The evidence grid's bound is ${f4(xe)}.`;
  if (xb === 0) return `${head} the belief grid's program decides at the first bin above 1/2, so its bound is reported as a belief of 1/2, evidence 0. The evidence grid's bound is ${f4(xe)}.`;
  const d = xb - xe, [pb, pe] = pair(xb, xe);
  const rel = Math.abs(d) < 1e-6 ? "within 0.000001 of" : `${fdiff(d)} ${d > 0 ? "above" : "below"}`;
  return `${head} the belief grid's bound is ${pb} in evidence, ${rel} the evidence grid's (${pe}); B(c) is ${f4(B)}. The two bin midpoints on either side of its bound are ${f4(gap)} apart in evidence.`;
}

/** The hero's label at one cost. */
export const heroLabel = (c, d1) => `Cost ${fc(c)}: the bound is more than 0.001 from its value with 30 time units left only with ${ft(d1)} time units left or fewer`;
