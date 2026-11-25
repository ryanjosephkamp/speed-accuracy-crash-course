// Charts as SVG strings drawn from arrays, sized to the pixels they occupy so their labels stay 11 px on a phone.
// Classes (.ex, .pm, .wb, .cost, .ax, .tk, ...) take their colors from the page's tokens, so a theme change
// restyles every chart without redrawing it.

export const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace(/^-(0\.0*)$/, "$1") : "–");

/** A plot frame: pixel size, margins, and the data ranges, with scales sx and sy (log if asked). */
export function frame(el, { h = null, aspect = 0.56, minH = 170, maxH = 300, l = 42, r = 12, t = 22, b = 30, x, y, xlog = false, ylog = false }) {
  const W = Math.max(260, Math.round(el.clientWidth || el.getBoundingClientRect().width || 340));
  const H = h ?? Math.round(Math.min(maxH, Math.max(minH, W * aspect)));
  const tx = xlog ? Math.log10 : (v) => v, ty = ylog ? Math.log10 : (v) => v;
  const [x0, x1] = x.map(tx), [y0, y1] = y.map(ty);
  const sx = (v) => l + ((tx(v) - x0) / (x1 - x0)) * (W - l - r);
  const sy = (v) => t + (1 - (ty(v) - y0) / (y1 - y0)) * (H - t - b);
  const ix = (px) => { const u = x0 + ((px - l) / (W - l - r)) * (x1 - x0); return xlog ? 10 ** u : u; };
  const iy = (py) => { const u = y0 + (1 - (py - t) / (H - t - b)) * (y1 - y0); return ylog ? 10 ** u : u; };
  return { W, H, l, r, t, b, sx, sy, ix, iy, x, y, xlog, ylog };
}

const clampY = (f, v) => Math.max(f.t - 4, Math.min(f.H - f.b + 4, v));

/** A polyline through (xs[i], ys[i]); points that aren't finite break the line. */
export function line(f, xs, ys, cls, extra = "") {
  let d = "", pen = false;
  for (let i = 0; i < xs.length; i++) {
    const yv = ys[i];
    if (!Number.isFinite(yv) || !Number.isFinite(xs[i])) { pen = false; continue; }
    const X = f.sx(xs[i]), Y = clampY(f, f.sy(yv));
    d += (pen ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1);
    pen = true;
  }
  return d ? `<path class="${cls}" d="${d}" ${extra}/>` : "";
}

/** A filled area between ys and a base. */
export function area(f, xs, ys, base, cls) {
  let d = "";
  for (let i = 0; i < xs.length; i++) d += (i ? "L" : "M") + f.sx(xs[i]).toFixed(1) + " " + clampY(f, f.sy(ys[i])).toFixed(1);
  for (let i = xs.length - 1; i >= 0; i--) d += "L" + f.sx(xs[i]).toFixed(1) + " " + clampY(f, f.sy(base)).toFixed(1);
  return `<path class="${cls}" d="${d}Z"/>`;
}

export function ticks(a, b, n = 5) {
  const span = b - a, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function logTicks(a, b) {
  // 1, 2, and 5 in each decade over a short range; powers of ten over a long one
  const decades = Math.log10(b / a), ms = decades > 2.2 ? [1] : decades > 1.2 ? [1, 3] : [1, 2, 5];
  const out = [];
  for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) {
    for (const m of ms) { const v = m * 10 ** e; if (v >= a * 0.999 && v <= b * 1.001) out.push(v); }
  }
  return out;
}

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const logLabel = (v) => {
  if (v >= 0.01 && v < 1000) return String(+v.toPrecision(2));
  const e = Math.round(Math.log10(v)), m = v / 10 ** e;
  return (Math.abs(m - 1) < 1e-9 ? "" : +m.toPrecision(2) + "×") + "10" + String(e).split("").map((c) => SUP[c]).join("");
};

/** Axes: a baseline, a left rule, tick labels, and optional axis labels and grid. */
export function axes(f, { xt, yt, xl = "", yl = "", fx, fy, grid = false, zero = false } = {}) {
  const X = xt ?? (f.xlog ? logTicks(...f.x) : ticks(...f.x));
  const Y = yt ?? (f.ylog ? logTicks(...f.y) : ticks(...f.y, 4));
  const fX = fx ?? (f.xlog ? logLabel : (v) => String(+v.toFixed(3)));
  const fY = fy ?? (f.ylog ? logLabel : (v) => String(+v.toFixed(3)));
  let s = `<path class="ax" d="M${f.l} ${f.H - f.b}H${f.W - f.r}M${f.l} ${f.t}V${f.H - f.b}"/>`;
  for (const v of X) {
    const x = f.sx(v).toFixed(1);
    s += `<path class="ax" d="M${x} ${f.H - f.b}v4"/><text class="tk" x="${x}" y="${f.H - f.b + 16}" text-anchor="middle">${fX(v)}</text>`;
  }
  for (const v of Y) {
    const y = f.sy(v).toFixed(1);
    if (grid) s += `<path class="grid" d="M${f.l} ${y}H${f.W - f.r}"/>`;
    s += `<text class="tk" x="${f.l - 6}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${fY(v)}</text>`;
  }
  if (zero && f.y[0] < 0 && f.y[1] > 0) s += `<path class="ax" d="M${f.l} ${f.sy(0).toFixed(1)}H${f.W - f.r}"/>`;
  if (xl) s += `<text class="lab" x="${f.W - f.r}" y="${f.H - 3}" text-anchor="end">${xl}</text>`;
  if (yl) s += `<text class="lab" x="${f.l - 30 > 0 ? f.l - 30 : 2}" y="${Math.max(11, f.t - 9)}" text-anchor="start">${yl}</text>`;
  return s;
}

export const svg = (f, inner, label) =>
  `<svg class="chart" viewBox="0 0 ${f.W} ${f.H}" width="${f.W}" height="${f.H}" role="img" aria-label="${label.replace(/"/g, "&quot;")}">${inner}</svg>`;

/** Place tags at the right ends of lines without overlapping: [{y, text, cls}] -> svg text. */
export function tags(f, items, x = null) {
  const X = x ?? f.W - f.r - 2;
  const sorted = items.filter((d) => Number.isFinite(d.y)).map((d) => ({ ...d, py: clampY(f, f.sy(d.y)) })).sort((a, b) => a.py - b.py);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].py - sorted[i - 1].py < 13) sorted[i].py = sorted[i - 1].py + 13;
  return sorted.map((d) => `<text class="${d.cls}" x="${X}" y="${(d.py - 5).toFixed(1)}" text-anchor="end">${d.text}</text>`).join("");
}

/** Keep a chart drawn at its current width: calls draw() now and on every width change. */
export function keepDrawn(el, draw) {
  let w = 0;
  const run = () => { const nw = Math.round(el.clientWidth); if (nw && nw !== w) { w = nw; draw(); } };
  if ("ResizeObserver" in window) new ResizeObserver(run).observe(el); else window.addEventListener("resize", run);
  draw(); w = Math.round(el.clientWidth);
  return () => { w = 0; run(); };
}

/** A curve that jumps at x (a deadline's forced choice): its last point drops there, so insert the left limit at x
 * and the line falls straight down instead of sloping across the last step. */
export function dropAt(xs, ys, x) {
  const n = xs.length;
  if (x === null || x === undefined || n < 2 || Math.abs(xs[n - 1] - x) > 1e-9) return [xs, ys];
  return [[...xs.slice(0, n - 1), x, x], [...ys.slice(0, n - 1), ys[n - 2], ys[n - 1]]];
}
