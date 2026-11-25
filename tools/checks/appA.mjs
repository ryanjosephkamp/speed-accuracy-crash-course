// Appendix A: every excerpt's lines against main.tex (each statement and proof whole, the proofs in the paper's order,
// and every line of Appendices A and B shown once), every strip reused unchanged from its chapter with a link to the
// section that draws it, the links on the page, the hero's results and where the paper proves each, the finding and
// the exercises against the claim map and main.tex, Appendix B's three equations against the paper's code, and the
// hero's sentences.
//
// The content modules are read as the build reads them (Python); the paper's code's constant-cost bounds for unequal
// rewards come from tools/validity/appA.json, which tools/validity/appA.py writes by running that code at the tag.
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { B } from "../../book/assets/js/kernel.js";
import { NODES, chain } from "../../book/assets/js/appA-chain.js";
import * as S from "../../book/assets/js/say-appA.js";
import { check, ROOT } from "./lib.mjs";

const TEX = readFileSync(join(ROOT, "paper/main.tex"), "utf8").split("\n");
const MAP = JSON.parse(readFileSync(join(ROOT, "book/content/map.json"), "utf8"));
const LABELS = JSON.parse(readFileSync(join(ROOT, "paper/labels.json"), "utf8")).labels;
const SRC = JSON.parse(readFileSync(join(ROOT, "paper/SOURCE.json"), "utf8"));
const REF = JSON.parse(readFileSync(join(ROOT, "tools/validity/appA.json"), "utf8"));
const MODULES = readdirSync(join(ROOT, "book/content")).filter((f) => /^(ch\d\d|appA)\.py$/.test(f)).map((f) => f.slice(0, -3)).sort();
const PY = `
import importlib.util, json
def load(name):
    spec = importlib.util.spec_from_file_location(name, f"book/content/{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
out = {}
for name in ${JSON.stringify(MODULES)}:
    m = load(name)
    out[name] = {"num": str(m.CHAPTER["num"]), "slug": m.CHAPTER["slug"], "chapter": m.CHAPTER, "plates": {k: v["title"] for k, v in m.PLATES.items()},
                 "strips": getattr(m, "STRIPS", {}), "map_links": m.MAP_LINKS, "proves": getattr(m, "PROVES", None),
                 "sections": [{"id": s["id"], "title": s["title"], "blocks": [list(b) for b in s["blocks"]]} for s in m.SECTIONS]}
print(json.dumps(out))
`;
const C = JSON.parse(execFileSync("python3", ["-c", PY], { cwd: ROOT, encoding: "utf8", maxBuffer: 64e6 }));
const A = C.appA;
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ---- the excerpts ------------------------------------------------------------------------------------------------
const T = (i) => (TEX[i - 1] ?? "").trim();
const prevNB = (i) => { let j = i - 1; while (j > 1 && !T(j)) j--; return j; };
const nextNB = (i) => { let j = i + 1; while (j < TEX.length && !T(j)) j++; return j; };
const HEAD = /^\\(?:sub)*section\*?\{|^\\label\{|^\\appendix\b/;
const UNIT = /^\\(?:paragraph|emph)\{/;
const THM = "lemma|proposition|theorem|corollary|definition|conjecture|remark|proof";
const ENV = new RegExp(`\\\\(begin|end)\\{(${THM})\\}`, "g");
/** Lines a..b are whole: they start at a unit (an environment, a paragraph or standing fact, or right after a heading),
 * end at one (an environment's end, or just before the next unit or heading), close every environment they open, and
 * hold no heading inside. */
function whole(a, b) {
  const start = new RegExp(`^\\\\begin\\{(${THM})\\}`).test(T(a)) || UNIT.test(T(a)) || HEAD.test(T(prevNB(a)));
  const nb = T(nextNB(b));
  const end = new RegExp(`\\\\end\\{(${THM})\\}$`).test(T(b)) || HEAD.test(nb) || UNIT.test(nb) || new RegExp(`^\\\\begin\\{(${THM})\\}`).test(nb);
  const stack = [];
  let balanced = true, inner = false;
  for (let i = a; i <= b; i++) {
    for (const m of TEX[i - 1].matchAll(ENV)) { if (m[1] === "begin") stack.push(m[2]); else if (stack.pop() !== m[2]) balanced = false; }
    if (i > a && (/^\\(?:sub)*section/.test(T(i)) || /^\\paragraph\{/.test(T(i)))) inner = true;
  }
  return { start, end, balanced: balanced && !stack.length, inner };
}
const exacts = [];
for (const s of A.sections) for (const b of s.blocks) if (b[0] === "exact") {
  exacts.push({ sec: s.id, spec: b[1], head: b[2], ranges: b[1].split(",").map((r) => { const [ab, sc, ec] = r.split("|"); const [a, z] = ab.split("-").map(Number); return { a, b: z, sc: sc || null, ec: ec || null }; }) });
}
for (const x of exacts) for (const r of x.ranges) {
  if (r.sc || r.ec) {
    const ok = (!r.sc || TEX[r.a - 1].includes(r.sc)) && (!r.ec || TEX[r.b - 1].includes(r.ec));
    check("excerpts", `${x.sec}: the context excerpt ${x.spec} ("${x.head}") is cut where its marks say`, ok && /^(Where|The setting)/.test(x.head), `cut marks found in lines ${r.a} and ${r.b}`);
    continue;
  }
  const w = whole(r.a, r.b);
  check("excerpts", `${x.sec}: lines ${r.a}-${r.b} ("${x.head}") are whole`, w.start && w.end && w.balanced && !w.inner,
    `starts at "${T(r.a).slice(0, 40)}", ends at "${T(r.b).slice(-30)}", next "${T(nextNB(r.b)).slice(0, 30)}"; ${JSON.stringify(w)}`);
}
// the sections of the paper the excerpts come from
const lineOf = (re, from = 1) => { for (let i = from; i <= TEX.length; i++) if (re.test(TEX[i - 1])) return i; return -1; };
const APP_A = lineOf(/^\\section\{Proofs\}/), APP_B = lineOf(/^\\label\{app:lopsided\}/), APP_C = lineOf(/^\\section\{Numerical details\}/);
const SEC2 = [lineOf(/^\\section\{Model\}/), lineOf(/^\\section\{An exact equation/)];
const SUBS = []; for (let i = APP_A; i < APP_B; i++) if (/^\\subsection\{Proofs? of/.test(T(i))) SUBS.push(i);
check("excerpts", "Appendix A has nine subsections of proofs, as the page's headings A.1 to A.9 assume", SUBS.length === 9, `subsections at lines ${SUBS.join(", ")}`);
const placeOf = (line) => {
  if (line >= SEC2[0] && line < SEC2[1]) return "§2";
  if (line > APP_B && line < APP_C) return "B";
  if (line > APP_A && line < APP_B) { const k = SUBS.filter((s) => s < line).length; return k ? `A.${k}` : "A"; }
  return null;
};
// every line of Appendices A and B (all but headings and labels) is in exactly one whole excerpt
{
  const shown = new Map();
  for (const x of exacts) for (const r of x.ranges) if (!r.sc && !r.ec) for (let i = r.a; i <= r.b; i++) shown.set(i, (shown.get(i) || 0) + 1);
  const missing = [], twice = [];
  for (let i = APP_A + 1; i < APP_C; i++) {
    if (!T(i) || HEAD.test(T(i))) continue;
    if (!shown.get(i)) missing.push(i); else if (shown.get(i) > 1) twice.push(i);
  }
  check("excerpts", "every line of Appendices A and B is shown, once", !missing.length && !twice.length,
    `lines ${APP_A + 1}-${APP_C - 1}: ${missing.length} missing${missing.length ? " (" + missing.slice(0, 8).join(", ") + ")" : ""}, ${twice.length} shown twice`);
}
// the proofs come in the paper's order, and each heading names its place
{
  const starts = exacts.flatMap((x) => x.ranges.filter((r) => !r.sc && !r.ec && r.a > APP_A).map((r) => r.a));
  check("excerpts", "the appendix's proofs appear in the paper's order", starts.every((v, i) => !i || v > starts[i - 1]), starts.join(", "));
  const bad = exacts.filter((x) => /Appendix [AB]/.test(x.head)).filter((x) => {
    const m = x.head.match(/Appendix ([AB](?:\.\d)?)/)[1];
    const p = placeOf(x.ranges[0].a);
    return !(p === m || (m === "A" && p === "A") || (m === "B" && p === "B"));
  });
  check("excerpts", "each heading that names a place in an appendix (A, A.1 to A.9, B) names the right one", !bad.length, bad.length ? bad.map((x) => x.spec + " " + x.head).join("; ") : `${exacts.filter((x) => /Appendix/.test(x.head)).length} headings`);
  const sec = exacts.filter((x) => /in Section (\d)/.test(x.head) && !x.ranges[0].sc).filter((x) => {
    const want = x.head.match(/in Section ([\d.]+)/)[1].split(".")[0];
    let k = 0; for (let i = 1; i <= x.ranges[0].a; i++) if (/^\\section\{/.test(T(i))) k++;
    return String(k) !== want;
  });
  check("excerpts", "each heading that names a section of the paper names the right one", !sec.length, sec.length ? sec.map((x) => x.spec).join("; ") : "all match");
}
// the proof sketch is the paper's only proof environment, and the page shows it whole
{
  const begins = TEX.map((l, i) => (/\\begin\{proof\}/.test(l) ? i + 1 : 0)).filter(Boolean);
  const ends = TEX.map((l, i) => (/\\end\{proof\}/.test(l) ? i + 1 : 0)).filter(Boolean);
  const shown = begins.every((a, k) => exacts.some((x) => x.ranges.some((r) => r.a === a && r.b === ends[k])));
  check("excerpts", "every \\begin{proof}...\\end{proof} in main.tex is shown whole", shown && begins.length === ends.length, `${begins.length} proof environment(s): ${begins.map((a, k) => `${a}-${ends[k]}`).join(", ")}`);
}

// ---- the strips ------------------------------------------------------------------------------------------------
const placed = A.sections.flatMap((s) => s.blocks.filter((b) => b[0] === "strip").map((b) => b[1]));
check("strips", "every strip on the page is defined once, and every one defined is placed once",
  same([...placed].sort(), Object.keys(A.strips).sort()) && new Set(placed).size === placed.length, `${placed.length} strips`);
const sectionHolding = (mod, sid) => C[mod].sections.find((s) => s.blocks.some((b) => b[0] === "strip" && b[1] === sid));
for (const [sid, st] of Object.entries(A.strips)) {
  if (!st.from) { check("strips", `${sid}: this appendix's own strip stands without a plate and has 4 to 6 steps`, st.plate === null && st.steps.length >= 4 && st.steps.length <= 6, `${st.steps.length} steps`); continue; }
  const [mod, from] = st.from, src = C[mod].strips[from];
  check("strips", `${sid}: chapter ${C[mod].num}'s strip "${from}" is here unchanged, without its plate`,
    !!src && same(st.steps, src.steps) && st.plate === null, `${st.steps.length} steps, plate ${st.plate}`);
  const m = (st.see || "").match(/\]\(\.\.\/([\w-]+)\/index\.html#([\w-]+)\)/);
  const sec = sectionHolding(mod, from);
  const ok = m && m[1] === C[mod].slug && sec && m[2] === sec.id && st.see.includes(`“${C[mod].plates[src.plate]}”`);
  check("strips", `${sid}: the link goes to the section of chapter ${C[mod].num} that draws it, and names its plate`, ok, m ? `../${m[1]}/index.html#${m[2]}` : "no link");
}
// every strip in the book's chapters is either here or left out for a stated reason
{
  const LEFT_OUT = {
    "ch00:flat": "the same derivation as chapter 3's routes, which is here",
    "ch02:posterior": "the posterior, which the paper cites (Peskir and Shiryaev, Ch. VI) rather than proves",
    "ch11:appB": "Appendix B's derivation, which this page has as steps of its own and links to",
    "ch11:infotime": "Section 7.1's argument, which the paper carries over formally, not as a theorem",
    "ch11:envelope": "Section 7.2's per-bound argument, which the paper has not made rigorous",
    "ch12:argument": "the equivalence of urgency gating and collapsing bounds, which the paper cites (Smith and Ratcliff, 2022) rather than proves",
  };
  const all = Object.keys(C).filter((m) => /^ch\d\d$/.test(m)).flatMap((m) => Object.keys(C[m].strips).map((s) => `${m}:${s}`));
  const here = Object.values(A.strips).filter((s) => s.from).map((s) => s.from.join(":"));
  const unplaced = all.filter((k) => !here.includes(k) && !(k in LEFT_OUT));
  check("strips", "every strip in the book's chapters is reused here, or left out for a stated reason", !unplaced.length && Object.keys(LEFT_OUT).every((k) => all.includes(k)),
    `${here.length} reused, ${Object.keys(LEFT_OUT).length} left out (${Object.entries(LEFT_OUT).map(([k, v]) => `${k}: ${v}`).join("; ")})${unplaced.length ? "; not placed: " + unplaced.join(", ") : ""}`);
}

// ---- links and the map ----------------------------------------------------------------------------------------
{
  const text = JSON.stringify(A.sections) + JSON.stringify(A.strips) + JSON.stringify(A.chapter);
  const ids = new Set(A.sections.map((s) => s.id));
  const local = [...text.matchAll(/\]\(#([\w-]+)\)/g)].map((m) => m[1]);
  check("links", "every link within the page goes to one of its sections", local.length > 0 && local.every((id) => ids.has(id)), `${local.length} links, to ${new Set(local).size} sections`);
  const out = [...text.matchAll(/\]\(\.\.\/([\w-]+)\/index\.html#([\w-]+)\)/g)];
  const bad = out.filter(([, slug, id]) => { const mod = Object.keys(C).find((k) => C[k].slug === slug); return !mod || !C[mod].sections.some((s) => s.id === id); });
  check("links", "every link to a chapter goes to a section that exists", out.length > 0 && !bad.length, `${out.length} links${bad.length ? "; broken: " + bad.map((m) => m[0]).join(", ") : ""}`);
  const claims = [...text.matchAll(/\{\{claim:([\w:.-]+)(?:\|[^}]*)?\}\}/g)].map((m) => m[1]);
  check("links", "every claim the page names is in the claim map", claims.every((c) => c in MAP.nodes), `${claims.length} names, ${new Set(claims).size} claims`);
  const map = A.sections.flatMap((s) => s.blocks).filter((b) => b[0] === "map");
  check("links", "the map section opens on Theorem 7, and the appendix has no claims of its own", map.length === 1 && map[0][1] === "thm:main" && !Object.keys(A.map_links).length && !Object.values(MAP.nodes).some((n) => String(n.ch) === "A"), `focus ${map[0]?.[1]}`);
}

// ---- the hero: its results, their places, and the finding ----------------------------------------------------------
{
  const order = A.sections.flatMap((s) => A.proves[s.id] || []);
  check("hero", "the hero draws the results of the page's sections, in their order", same(NODES.map((n) => n.id), order) && same(Object.keys(A.proves), A.sections.filter((s) => A.proves[s.id]).map((s) => s.id)), `${order.length} results`);
  const wrong = NODES.filter((n) => {
    const sec = A.sections.find((s) => (A.proves[s.id] || []).includes(n.id));
    // the section's excerpts from Section 2 or the appendices (its proof), leaving out statements in the body
    const places = new Set(exacts.filter((x) => x.sec === sec.id && !x.ranges[0].sc && !x.ranges[0].ec).map((x) => placeOf(x.ranges[0].a)).filter(Boolean));
    return places.size !== 1 || !places.has(n.where);
  });
  check("hero", "each result's place on the right (§2, A, A.1 to A.9, B) is where the page's excerpt of its proof sits in main.tex", !wrong.length, wrong.length ? wrong.map((n) => n.id).join(", ") : NODES.map((n) => n.where).join(" "));
  const { nodes, arcs } = chain(MAP);
  const inSet = new Set(NODES.map((n) => n.id));
  const edges = MAP.edges.filter(([a, b]) => inSet.has(a) && inSet.has(b));
  check("hero", "the hero's arcs are the claim map's edges between its results", arcs.length === edges.length && edges.every(([a, b]) => arcs.some(([u, v]) => NODES[u].id === b && NODES[v].id === a)), `${arcs.length} arcs`);
  check("hero", "the hero's still step is Theorem 7", NODES[A.chapter.hero.still].id === "thm:main", `step ${A.chapter.hero.still}`);
  const rest = (id) => new Set(nodes.find((n) => n.id === id).rests.map((j) => NODES[j].id));
  const exactRests = rest("prop:exact"), thmRests = rest("thm:main");
  const before = NODES.slice(0, NODES.findIndex((n) => n.id === "prop:exact")).filter((n) => n.where.startsWith("A"));
  check("hero", "finding: the exact equation rests on every result before it in Appendix A", before.length === 5 && before.every((n) => exactRests.has(n.id)), before.map((n) => n.id).join(", "));
  const extra = [...thmRests].filter((id) => id !== "prop:exact" && !exactRests.has(id)).sort();
  check("hero", "finding: Theorem 7 rests on only two more of these, the kernel's lemma and the slope B'(c)", same(extra, ["eq:Bprime", "lem:kernel"]), extra.join(", "));
  check("hero", "finding: its names are the paper's (Theorem 7, Appendix A)", LABELS["thm:main"].num === "7" && LABELS["app:proofs"].num === "A" && A.chapter.finding.includes("Theorem 7") && A.chapter.finding.includes("Appendix A"), A.chapter.finding);
  // the readings: the passage of Corollary 9's proof that finds its maximum numerically, and the two values Corollary 9
  // states for that maximum (a test of this one passage, not a count of every numerical step in the appendices)
  const sec = lineOf(/^\\subsection\{Proofs of .*cor:transfer,cor:limits/), next = lineOf(/^\\subsection\{/, sec + 1);
  const forB = lineOf(/For \(b\)/, sec), forC = lineOf(/For \(c\)/, sec);
  let numAt = -1; for (let i = sec; i < next; i++) if (`${TEX[i - 1]} ${TEX[i]}`.includes("The maximum is found numerically")) { numAt = i; break; }
  const stmt = TEX.findIndex((l) => /\\MaxLookAhead\b/.test(l) && /\\MaxLookAheadCost\b/.test(l)) + 1;
  const reading = A.chapter.readings.map((r) => r[1]).join(" ");
  check("hero", "the readings: in Appendix A.7, the proof of Corollary 9(b) says its maximum over c0 is found numerically; the two readings are the two values Corollary 9 states for that maximum, and their words credit that proof without counting the appendices' numerical steps",
    sec > 0 && placeOf(numAt) === "A.7" && numAt > forB && numAt < forC && forC < next && stmt > lineOf(/\\label\{cor:limits\}/) && stmt < lineOf(/\\end\{corollary\}/, lineOf(/\\label\{cor:limits\}/)) && /numerically its\s+maximum/.test(TEX[stmt - 2] + " " + TEX[stmt - 1])
    && same(A.chapter.readings.map((r) => r[0]), ["MaxLookAhead", "MaxLookAheadCost"]) && /Corollary 9's proof/.test(reading) && !/the one step/.test(reading),
    `"The maximum is found numerically" at line ${numAt} (${placeOf(numAt)}), between "For (b)" at ${forB} and "For (c)" at ${forC}; both values at line ${stmt}, in Corollary 9's statement`);
}
// the third exercise: the citations in Appendices A and B
{
  const cites = [];
  for (let i = APP_A + 1; i < APP_C; i++) for (const m of TEX[i - 1].matchAll(/\\cite[tp](?:\[[^\]]*\])*\{([^}]*)\}/g)) cites.push(`${m[1]}@${placeOf(i)}`);
  check("hero", "exercise: Appendices A and B make four citations of three works, in the standing facts and the proofs of Lemma 2 and Proposition 3",
    same(cites, ["revuz1999@A", "peskir2006@A", "peskir2006@A.2", "deangelis2020@A.3"]) && new Set(cites.map((c) => c.split("@")[0])).size === 3 && LABELS["lem:envelope"].num === "2" && LABELS["prop:regularity"].num === "3", cites.join(", "));
}

// ---- Appendix B: the strip's three equations, solved here, against the paper's code ---------------------------------
check("unequal", "the reference was computed by the paper's code at the book's tag", REF.commit === SRC.commit, `appA.json from ${REF.tag} (${REF.commit.slice(0, 7)})`);
const Sx = (x) => x + 0.5 * Math.sinh(2 * x);
const Ax = (x, c, K) => c * (Sx(x) * Math.tanh(x) - 0.5 * Math.cosh(2 * x)) + K * Math.tanh(x);
const g = (x) => 1 / (1 + Math.exp(-2 * x));
const Sinv = (v) => { let lo = -40, hi = 40; for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (Sx(m) < v) lo = m; else hi = m; } return (lo + hi) / 2; };
/** Steps 3 and 4: for a trial h, smooth fit fixes K and l; value matching is what's left. */
const parts = (h, c, rp, rm) => {
  const K = rp / 2 - c * Sx(h), l = Sinv(Sx(h) - (rp + rm) / (2 * c));
  return { K, l, F: Ax(h, c, K) - Ax(l, c, K) - (rp * g(h) - rm * (1 - g(l))) };
};
function solveB(c, rp, rm) {
  const xs = 0.5 * Math.log(rm / rp);
  let a = xs + 1e-6, fa = parts(a, c, rp, rm).F;
  for (let k = 1; k <= 400; k++) {
    let b = xs + 1e-6 * Math.pow(30 / 1e-6, k / 400);
    const fb = parts(b, c, rp, rm).F;
    if (fa * fb < 0) { for (let j = 0; j < 200; j++) { const m = (a + b) / 2, fm = parts(m, c, rp, rm).F; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } } const h = (a + b) / 2; return { h, ...parts(h, c, rp, rm) }; }
    a = b; fa = fb;
  }
  return null;
}
{
  let worst = 0;
  const rows = REF.bounds.map((r) => { const s = solveB(r.c, r.r_plus, r.r_minus); const d = s ? Math.max(Math.abs(s.h - r.hi), Math.abs(s.l - r.lo)) : Infinity; worst = Math.max(worst, d); return s; });
  check("unequal", "the three equations, solved here, give the paper's code's two bounds (lopsided.constant_bounds) within 1e-8",
    worst < 1e-8, `${REF.bounds.length} cases (r- = 0.5, 0.25, equal, a common 2; c = 0.03 to 1), largest difference ${worst.toExponential(1)}`);
  check("unequal", "the waiting interval holds the indifference point in every case", REF.bounds.every((r, i) => rows[i] && rows[i].l < r.x_star && r.x_star < rows[i].h), "l < x* < h");
}
{
  // step 4: A' = (c S + K) sech^2, and value matching as an integral of V'
  let dWorst = 0, iWorst = 0;
  for (const [c, rp, rm] of [[0.1, 1, 0.5], [0.03, 1, 0.25], [0.3, 1, 1]]) {
    const { h, l, K } = solveB(c, rp, rm);
    const Vp = (x) => (c * Sx(x) + K) / Math.cosh(x) ** 2;
    for (let k = 1; k < 10; k++) {
      const x = l + ((h - l) * k) / 10, e = 1e-5;
      dWorst = Math.max(dWorst, Math.abs((Ax(x + e, c, K) - Ax(x - e, c, K)) / (2 * e) - Vp(x)) / Math.max(1e-3, Math.abs(Vp(x))));
    }
    const n = 2000; let sum = 0;
    for (let k = 0; k <= n; k++) { const x = l + ((h - l) * k) / n; sum += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * Vp(x); }
    sum *= (h - l) / (3 * n);
    iWorst = Math.max(iWorst, Math.abs(sum - (Ax(h, c, K) - Ax(l, c, K))));
  }
  check("unequal", "step 4: A' = (c S + K) sech^2 (central differences, within 1e-6 relative)", dWorst < 1e-6, `largest relative difference ${dWorst.toExponential(1)}`);
  check("unequal", "step 4: integrating V' across the interval gives A(h) - A(l) (Simpson, 2000 panels, within 1e-10)", iWorst < 1e-10, `largest difference ${iWorst.toExponential(1)}`);
}
{
  // step 5: equal rewards give h = -l = B(c) and K = 0; a common reward r gives B(c/r)
  let worst = 0, worstR = 0;
  for (const c of [0.03, 0.1, 0.3, 1, 3]) {
    const b = B(c);
    worst = Math.max(worst, Math.abs(c * Sx(b) - 0.5), Math.abs(c * Sx(-b) + 0.5), Math.abs(Ax(b, c, 0) - Ax(-b, c, 0) - (g(b) - (1 - g(-b)))));
    const s = solveB(c, 2, 2);
    worstR = Math.max(worstR, Math.abs(s.h - B(c / 2)), Math.abs(s.l + B(c / 2)), Math.abs(s.K));
  }
  check("unequal", "step 5: with equal rewards, h = -l = B(c) and K = 0 satisfy all three equations (within 1e-12)", worst < 1e-12, `largest residual ${worst.toExponential(1)}`);
  check("unequal", "step 5: a common reward of 2 gives h = -l = B(c/2) and K = 0 (within 1e-9)", worstR < 1e-9, `largest difference ${worstR.toExponential(1)}`);
}

{
  // step 4 says the value *changes* across the interval: with the rewards the other way round it falls
  const s = solveB(0.1, 0.25, 1), rise = Ax(s.h, 0.1, s.K) - Ax(s.l, 0.1, s.K);
  const stepText = A.strips.lopsided.steps[3][0];
  check("unequal", "step 4: across the interval the value can fall (c = 0.1, r+ = 0.25, r- = 1), so the step says it changes, not rises",
    rise < 0 && Math.abs(rise - (0.25 * g(s.h) - (1 - g(s.l)))) < 1e-12 && /changes by exactly/.test(stepText) && !/rises/.test(JSON.stringify(A.strips.lopsided.steps)), `V(h) - V(l) = ${rise.toFixed(6)}; "${stepText}"`);
}

// ---- the page's sentences against the paper's, where the audits asked for the paper's terms ------------------------
{
  const text = (id) => JSON.stringify(A.sections.find((s) => s.id === id).blocks);
  const tex = TEX.join("\n");
  const pairs = [
    ["standing: the martingale is the value minus the cost paid, as in the paper's Snell envelope", /V\(t \+ s, Y_s\) - \\\\int_0\^s c\(t \+ u\)\\\\,du\$, stopped there, is a martingale/.test(text("standing")), tex.includes("$V(t + s, Y_s) - \\int_0^s c(t + u)\\dd u$ up to $\\sigma$")],
    ["standing: the theorem \"assumes\" a finite expected supremum, the paper's word", /The theorem assumes/.test(text("standing")), tex.includes("assumes $\\E\\sup_s |G_s| < \\infty$")],
    ["flat: Proposition 13's proof uses that B decreases and its slope, so the page lists it for both", /\{\{ref:prop:rule\}\}, and \{\{ref:prop:loss\}\}, and the slope in \{\{ref:thm:main\}\} and \{\{ref:prop:rule\}\}/.test(text("flat")),
      TEX.slice(lineOf(/^\\subsection\{Proof of .*prop:rule/), lineOf(/^\\subsection\{Proof of .*prop:loss/)).join(" ").includes("Since $B$ is") && /B'\(c_0\)\\gamma\(t\+s\)/.test(TEX.slice(lineOf(/^\\subsection\{Proof of .*prop:rule/), lineOf(/^\\subsection\{Proof of .*prop:loss/)).join(" "))],
    ["corollaries: Corollary 8 is about the first-order term, beta", /moves the bound, to first order, by a sinusoid/.test(text("corollaries")), /\\beta\(t\) = \\operatorname\{Re\}/.test(TEX.slice(lineOf(/\\label\{cor:transfer\}/), lineOf(/\\label\{cor:transfer\}/) + 4).join(" "))],
    ["exercises: Lemma 1(d) holds for any bounded measurable cost, as the paper notes", /\{\{ref:lem:structure\}\}\(d\) holds for any bounded measurable cost/.test(text("exercises")), tex.includes("Part (d) holds for any bounded measurable cost")],
  ];
  for (const [name, page, paper] of pairs) check("words", name, page && paper, `page ${page ? "says it" : "doesn't"}, main.tex ${paper ? "says it" : "doesn't"}`);
}

// ---- the sentences ------------------------------------------------------------------------------------------------
{
  const { nodes } = chain(MAP);
  let bad = 0, n = 0;
  for (const m of nodes) for (const r of [0, 1, 2, m.rests.length]) for (const u of [0, 1, 3, m.down.length]) {
    const s = S.heroLabel(m.label, r, u); n++;
    if (/NaN|undefined|Infinity|null/.test(s) || !s.startsWith(m.label)) bad++;
  }
  check("words", "the hero's sentences never print NaN, undefined, Infinity, or null", bad === 0, `${n} sentences, ${bad} bad`);
  const t = nodes.find((m) => m.id === "thm:main");
  const say = S.heroLabel(t.label, t.rests.length, t.down.length);
  check("words", "Theorem 7's sentence gives the counts the picture draws", say === `${t.label}: rests on 10 of these, and 4 of these use it.`, say);
  check("words", "one, and none, read as English", S.heroLabel("X", 0, 1) === "X: rests on none of these, and 1 of these uses it." && S.heroLabel("X", 1, 0) === "X: rests on 1 of these, and none of these uses it.", S.heroLabel("X", 0, 1));
}
