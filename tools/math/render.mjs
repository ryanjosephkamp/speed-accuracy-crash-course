// Set the TeX in built pages as SVG, in place, so pages carry no math library: $...$ inline and
// \[...\] or $$...$$ displayed, with the paper's macros. Each page gets one shared glyph cache and
// MathJax's stylesheet, and hidden MathML for screen readers.
//
//   node tools/math/render.mjs docs/index.html docs/kernel/index.html
import { readFileSync, writeFileSync } from "node:fs";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AssistiveMmlHandler } from "mathjax-full/js/a11y/assistive-mml.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

const MACROS = { E: "\\mathbb{E}", P: "\\mathbb{P}", dd: "\\,\\mathrm{d}", sech: "\\operatorname{sech}", Lop: "\\mathcal{L}" };

for (const file of process.argv.slice(2)) {
  const adaptor = liteAdaptor();
  const handler = RegisterHTMLHandler(adaptor);
  AssistiveMmlHandler(handler);
  const tex = new TeX({
    packages: AllPackages.filter((p) => p !== "bussproofs"),
    inlineMath: [["$", "$"]], displayMath: [["\\[", "\\]"], ["$$", "$$"]],
    processEscapes: true, macros: MACROS, formatError: (jax, err) => { throw new Error(`${file}: ${err.message}`); },
  });
  const svg = new SVG({ fontCache: "global" });
  const doc = mathjax.document(readFileSync(file, "utf8"), { InputJax: tex, OutputJax: svg, ignoreHtmlClass: "no-math" });
  doc.render();
  const n = Array.from(doc.math).length;
  writeFileSync(file, adaptor.doctype(doc.document) + "\n" + adaptor.outerHTML(adaptor.root(doc.document)));
  console.log(`${file}: ${n} formulas`);
}
