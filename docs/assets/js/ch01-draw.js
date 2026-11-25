// Chapter 1's Figure 1 panels as SVG strings, with no DOM: the plate draws them, and tools/checks/ch01.mjs reads the
// same strings back, so the checks see what the reader sees. A panel is a title, the cost strip (log c over the
// schedule's own range), and the three bounds on the panel's bound scale; the time line and its dots are drawn apart,
// so moving the time redraws only them.
import { boundForCost, toDiscrete } from "./model.js?v=850f062e96";
import { VIEW } from "./schedules-book.js?v=850f062e96";
import { ticks, dropAt } from "./chart.js?v=850f062e96";
import { at, costStrip, DT } from "./ch01-model.js?v=850f062e96";

export const ROWS = { title: 15, gap: 5 };
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
export const pmShifted = (cost, t) => toDiscrete(boundForCost(cost(t)), DT);

/** A polyline through (xs, ys) in the given scales; missing values break it. */
export function pathD(xs, ys, sx, sy) {
  let d = "", pen = false;
  xs.forEach((x, k) => { const v = ys[k]; if (v === null || !Number.isFinite(v)) { pen = false; return; } d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(v).toFixed(1); pen = true; });
  return d;
}
/** The points of a path's d string, for the checks. */
export const points = (d) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);

/** One panel at (x0, y0) of width w. p = { cost, dl, data } (data from the worker, or null while it solves). Returns
 * the static marks, each curve's d string, and the scales the time line needs. */
export function panel(p, { x0, y0, w, bh, yTop, selected, title }) {
  const view = p.dl ?? VIEW, l = 28, r = 6, cH = Math.round(Math.min(40, Math.max(28, bh * 0.26)));
  const sx = (u) => x0 + l + (u / view) * (w - l - r);
  const cT = y0 + ROWS.title + 4, cB = cT + cH, bT = cB + ROWS.gap + 4, bB = bT + bh;
  // the cost and the bounds have their own scales: the cost strip is log c over the schedule's own range, and only
  // the bounds are held to the panel's bound scale
  const tsC = range(0, view, 181), strip = costStrip(p.cost, view);
  const syC = (c) => cB - strip.y(c) * (cB - cT);
  const syB = (b) => bB - (Math.min(b, yTop * 1.02) / yTop) * (bB - bT);
  const paths = { cost: pathD(tsC, tsC.map(p.cost), sx, syC) };
  let s = "";
  if (selected) s += `<rect class="panel-sel" x="${x0}" y="${y0}" width="${w}" height="${bB + 20 - y0}"/>`;
  s += `<text class="lab${selected ? " sel" : ""}" x="${x0 + 4}" y="${y0 + 11}">${title}</text>`;
  s += `<path class="ax" d="M${x0 + l} ${cB}H${x0 + w - r}M${x0 + l} ${bB}H${x0 + w - r}M${x0 + l} ${bT}V${bB}"/>`;
  s += `<path class="cost" d="${paths.cost}"/>`;
  for (const v of ticks(0, yTop / 1.02, 4)) {
    s += `<path class="grid" d="M${x0 + l} ${syB(v).toFixed(1)}H${x0 + w - r}"/>`;
    s += `<text class="tk" x="${x0 + l - 5}" y="${(syB(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  for (const v of ticks(0, view, 3)) s += `<path class="ax" d="M${sx(v).toFixed(1)} ${bB}v4"/><text class="tk" x="${sx(v).toFixed(1)}" y="${bB + 15}" text-anchor="middle">${v}</text>`;
  if (p.dl !== null) s += `<path class="acc" stroke-dasharray="3 3" d="M${sx(p.dl).toFixed(1)} ${cT}V${bB}"/>`;
  const tsP = range(0, view, 251);
  paths.pm = pathD(tsP, tsP.map((u) => pmShifted(p.cost, u)), sx, syB);
  s += `<path class="pm" d="${paths.pm}"/>`;
  if (p.data) {
    // at a deadline the program's bound and the weighted rule's are 0: flat up to it, then straight down
    paths.wb = pathD(...dropAt(p.data.t, p.data.wbShift, p.dl), sx, syB);
    paths.ex = pathD(...dropAt(p.data.t, p.data.exact, p.dl), sx, syB);
    s += `<path class="wb" d="${paths.wb}"/><path class="ex" d="${paths.ex}"/>`;
  } else s += `<text class="tk" x="${(x0 + l + (w - l - r) / 2).toFixed(1)}" y="${((bT + bB) / 2).toFixed(1)}" text-anchor="middle">solving…</text>`;
  return { s, paths, sx, syC, syB, cT, cB, bB, view, hit: { x: x0, y: y0, w, h: bB + 20 - y0 } };
}

/** The time line and the dots at time t, for one panel g = panel(p, ...). */
export function nowMarks(p, g, t) {
  if (t > g.view + 1e-9) return `<text class="tk" x="${(g.sx(g.view) - 3).toFixed(1)}" y="${(g.cT + 9).toFixed(1)}" text-anchor="end">${p.dl !== null ? "past the deadline" : "past the window"}</text>`;
  const X = g.sx(t).toFixed(1), c = p.cost(t);
  let s = `<path class="dim" stroke-dasharray="2 3" d="M${X} ${g.cT}V${g.bB}"/>`;
  if (Number.isFinite(c)) s += `<circle class="acc-dot" cx="${X}" cy="${g.syC(c).toFixed(1)}" r="3.2"/>`;
  s += `<circle class="pm-dot" cx="${X}" cy="${g.syB(pmShifted(p.cost, t)).toFixed(1)}" r="3.4"/>`;
  if (p.data) {
    s += `<circle class="wb-dot" cx="${X}" cy="${g.syB(at(p.data, "wbShift", t)).toFixed(1)}" r="3.4"/>`;
    s += `<circle class="ink-dot" cx="${X}" cy="${g.syB(at(p.data, "exact", t)).toFixed(1)}" r="3.4"/>`;
  }
  return s;
}
