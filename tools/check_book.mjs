// Holds the book's live model to the paper: every file in tools/checks/ (book.mjs for the shared pieces, then one
// per chapter, chNN.mjs) checks a chapter's numbers, plates, and sentences against paper/generated/ (numbers.tex
// and the tables at the tag) and against the paper's code. Writes book/checks.json, which the build prints under
// each plate: a plate's line counts the checks of its chapter's file (and book.mjs) with the tags its CHECKS lists.
//
//   node tools/check_book.mjs          exits 1 if any check fails
//   node tools/check_book.mjs ch07     runs book.mjs and ch07.mjs only (checks.json is not written)
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, results, setFile } from "./checks/lib.mjs";

const only = process.argv.slice(2);
const files = readdirSync(join(ROOT, "tools/checks")).filter((f) => f.endsWith(".mjs") && f !== "lib.mjs")
  .sort((a, b) => (a === "book.mjs" ? -1 : b === "book.mjs" ? 1 : a.localeCompare(b)))
  .filter((f) => !only.length || f === "book.mjs" || only.includes(f.replace(/\.mjs$/, "")));
for (const f of files) {
  setFile(f.replace(/\.mjs$/, ""));
  console.log(`\n== ${f}`);
  await import(pathToFileURL(join(ROOT, "tools/checks", f)).href);
}

const failed = results.filter((r) => !r.ok);
const out = { date: new Date().toISOString().slice(0, 10), total: results.length, passed: results.length - failed.length, results };
if (!only.length) writeFileSync(join(ROOT, "book/checks.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`\n${out.passed} of ${out.total} checks passed${failed.length ? "; failed: " + failed.map((r) => `[${r.file}:${r.plate}] ${r.name}`).join("; ") : ""}`);
process.exit(failed.length ? 1 : 0);
