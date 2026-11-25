// The sentences under Appendix B's plates, as pure functions of the numbers the plates compute. tools/checks/appB.mjs
// runs each over the plates' edge inputs and thousands of random ones.

const f3 = (x) => (Math.abs(x) < 0.0005 ? "0.000" : x.toFixed(3));
const fc = (c) => String(+c.toPrecision(2));
const ft = (t) => String(+t.toFixed(2));

/** The cost slider's label. */
export const costLabel = (c) => fc(c);

/** Under the horizon plate. d1 and d2: the reach at 0.001 and 0.01; binf: the bound with LONG time units left; b0: the
 * bound at t = 0 with the choice forced at T. */
export function horizonSay(c, T, long, binf, d1, d2, b0) {
  const head = `At a cost of ${fc(c)}, the bound differs from its value with ${long} time units left (${f3(binf)}) by more than 0.001 only in the last ${ft(d1)} time units before the forced choice, and by more than 0.01 only in the last ${ft(d2)}.`;
  if (T > d1 + 1e-9) return `${head} With the choice forced at ${ft(T)}, it is within 0.001 of that value from t = 0 up to, but not at, t = ${ft(T - d1)}.`;
  return `${head} With the choice forced at ${ft(T)}, that stretch reaches back to t = 0 or earlier: there the bound is ${f3(b0)}, ${f3(binf - b0)} from that value.`;
}

/** The verdict on the reader's guess of the reach at 0.001. */
export const guessSay = (guess, d1) => `You guessed about ${ft(guess)} time units; on this grid, it is ${ft(d1)}.`;

/** Under the bins plate. xb: the belief grid's bound in evidence (Infinity when it waits at every bin, 0 when it
 * decides at the first bin above 1/2); xe: the evidence grid's bound with the long horizon; gap: the distance in
 * evidence between the two bins around xb. */
export function binsSay(c, n, xb, xe, B, gap) {
  const head = `At a cost of ${fc(c)}, with ${n} bins,`;
  if (!Number.isFinite(xb)) return `${head} the belief grid's program waits at every bin, so it has no bound on this grid. The evidence grid's program stops at ${f3(xe)}.`;
  if (xb === 0) return `${head} the belief grid's program decides at the first bin above 1/2, so its bound is reported as a belief of 1/2, evidence 0. The evidence grid's program stops at ${f3(xe)}.`;
  const d = xb - xe;
  const rel = Math.abs(d) < 0.0005 ? "within 0.0005 of" : `${f3(Math.abs(d))} ${d > 0 ? "above" : "below"}`;
  return `${head} the belief grid's program stops at evidence ${f3(xb)}, ${rel} the evidence grid's program (${f3(xe)}); B(c) is ${f3(B)}. The two bins on either side of its bound are ${f3(gap)} apart in evidence.`;
}

/** The hero's label at one cost. */
export const heroLabel = (c, d1) => `Cost ${fc(c)}: the forced choice moves the bound by more than 0.001 over the last ${ft(d1)} time units`;
