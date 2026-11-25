// What every file of checks shares: the paper's generated numbers and tables at the tag, and check(), which records
// one result for the file being run. tools/check_book.mjs runs every file in this folder.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const N = Object.fromEntries([...readFileSync(join(ROOT, "paper/generated/numbers.tex"), "utf8").matchAll(/\\newcommand\{\\(\w+)\}\{([^}]*)\}/g)].map((m) => [m[1], m[2]]));

/** A generated table's rows as strings, cell by cell, as the paper prints them (paper/generated/<name>.tex). */
export function table(name) {
  return readFileSync(join(ROOT, `paper/generated/${name}.tex`), "utf8").trim().split("\n")
    .map((r) => r.trim().replace(/\\\\$/, "").trim()).filter((r) => r && !r.startsWith("\\"))
    .map((r) => r.split("&").map((c) => c.trim()));
}
/** The same rows with every cell read as a number where it is one (NaN where it isn't). */
export const tableNumbers = (name) => table(name).map((r) => r.map((c) => +c.replace(/\\%|\$/g, "")));
export const SIN = tableNumbers("tab_sinusoid");

export const results = [];
let file = "book";
export const setFile = (f) => { file = f; };
/** Record one check. plate: a tag the chapter's CHECKS maps its plates to; ok: whether it passed. */
export function check(plate, name, ok, detail) {
  results.push({ file, plate, name, ok: !!ok, detail });
  console.log(`${ok ? "pass" : "FAIL"}  [${file}:${plate}] ${name}: ${detail}`);
}
/** A number printed to d decimals matches the paper's printed value. */
export const asPrinted = (x, s) => { const d = (s.split(".")[1] || "").length; return x.toFixed(d) === s; };

/** Run a page's worker as the page does: import it once (each worker sets self.onmessage), send it one job, and
 * return its final reply ({ ok, ... }). The book's workers answer synchronously. rel is relative to this folder. */
const handlers = new Map();
export async function runWorker(rel, msg) {
  globalThis.self ??= {};
  let replies = [];
  globalThis.self.postMessage = (m) => replies.push(m);
  if (!handlers.has(rel)) {
    await import(new URL(rel, import.meta.url).href);
    handlers.set(rel, globalThis.self.onmessage);
  }
  replies = [];
  handlers.get(rel)({ data: { ...msg, id: 1 } });
  return replies.find((m) => m.ok !== undefined) || null;
}

/** The program's Bellman step at the center and at the grid's first step past it, recomputed here from model.js's grid
 * and kernels (as exactPolicy steps back from a forced choice at the horizon): for each time step k, center and first
 * are deciding's value minus waiting's there, so a value above 0 means that node stops. */
export async function centerActions(cost, horizon, dt = 0.01, h = 0.02, cap = 5) {
  const { grid } = await import("../../book/assets/js/model.js");
  const { x, m, n, r, kUp, kDown } = grid(dt, h, cap), steps = Math.round(horizon / dt);
  const g = Float64Array.from(x, (v) => 1 / (1 + Math.exp(-2 * v))), decide = Float64Array.from(g, (v) => Math.max(v, 1 - v));
  let v = Float64Array.from(decide);
  const wait = new Float64Array(n), out = new Array(steps);
  for (let k = steps - 1; k >= 0; k--) {
    const ck = Math.min(cost(k * dt), 1e9) * dt;
    for (let i = 0; i < n; i++) {
      let up = 0, dn = 0;
      for (let j = -r; j <= r; j++) { const q = i + j, vj = q < 0 || q >= n ? decide[q < 0 ? 0 : n - 1] : v[q]; up += kUp[j + r] * vj; dn += kDown[j + r] * vj; }
      wait[i] = g[i] * up + (1 - g[i]) * dn - ck;
    }
    out[k] = { center: decide[m] - wait[m], first: decide[m + 1] - wait[m + 1] };
    for (let i = 0; i < n; i++) v[i] = Math.max(decide[i], wait[i]);
  }
  return out;
}
/** What the exported bound must be, from that step: "between" 0 and h when the first step stops and the center waits,
 * "stop" (exactly 0) when both stop, and "above" (at least h) when the first step waits. */
export const belowStepClass = (a) => (a.first > 0 ? (a.center < 0 ? "between" : "stop") : "above");
export const fitsClass = (cls, b, h = 0.02) => (cls === "between" ? b > 0 && b < h : cls === "stop" ? b === 0 : b >= h);
