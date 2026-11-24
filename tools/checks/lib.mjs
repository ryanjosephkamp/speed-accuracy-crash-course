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
