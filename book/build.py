#!/usr/bin/env python3
"""Build the book into docs/: the contents page, each built chapter, and the assets.

    python3 book/build.py          then  node tools/math/render.mjs   (build.py runs it unless --no-math)

Sources: paper/ (main.tex, the generated numbers and tables, and labels.json, copied from the paper's tag
by tools/vendor_paper.py) and book/content/. Every number in the text is a {{Macro}} from
paper/generated/numbers.tex or a {{T:tab_name:row:col}} cell of a generated table, every cross-reference a
{{ref:label}} from paper/labels.json, and every mention of another claim a {{claim:id}} from the claim map;
the build fails on an unknown one, and checks that the label numbers agree with a count of main.tex.

A chapter is built when book/content/<module>.py exists (the module named in book.py's CHAPTERS); its plates
live in book/assets/js/<module>.js, and an optional book/assets/css/<module>.css is loaded on its page only.
"""
import hashlib
import html
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "docs"
sys.path.insert(0, str(HERE))
from texconv import Converter  # noqa: E402

TEX_LINES = (ROOT / "paper/main.tex").read_text().split("\n")
NUMBERS = dict(re.findall(r"\\newcommand\{\\(\w+)\}\{([^}]*)\}", (ROOT / "paper/generated/numbers.tex").read_text()))
_lab = json.loads((ROOT / "paper/labels.json").read_text())
LABELS, CITES = _lab["labels"], _lab["cites"]
SOURCE = json.loads((ROOT / "paper/SOURCE.json").read_text())
CONV = Converter(TEX_LINES, LABELS, CITES, NUMBERS)
PAPER_PDF = "https://github.com/ryanjosephkamp/speed-accuracy-tradeoff/blob/main/paper/main.pdf"
PAPER_REPO = SOURCE["repository"]
CREDIT = (HERE / "credit.html").read_text()


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / "content" / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def fail(msg):
    raise SystemExit("BUILD FAILED: " + msg)


def check_numbering():
    for lab, v in LABELS.items():
        if lab.startswith("eq:"):
            for i, line in enumerate(TEX_LINES, 1):
                if f"\\label{{{lab}}}" in line:
                    j = i
                    while j > 0 and j not in CONV.eqnum:
                        j -= 1
                    if str(CONV.eqnum[j]) != v["num"]:
                        fail(f"equation {lab}: labels.json says {v['num']}, a count of main.tex says {CONV.eqnum[j]}")


# ---------------------------------------------------------------- text
REF_NAMES = {"lem": "Lemma", "prop": "Proposition", "thm": "Theorem", "cor": "Corollary", "conj": "Conjecture",
             "rem": "Remark", "def": "Definition", "sec": "Section", "app": "Appendix", "tab": "Table",
             "fig": "Figure", "alg": "Algorithm"}


def ref(label):
    if label not in LABELS:
        fail(f"unknown label {label}")
    num = LABELS[label]["num"]
    kind = label.split(":")[0]
    return f"({num})" if kind == "eq" else f"{REF_NAMES[kind]} {num}"


# the generated tables the text may quote cell by cell, with the column heads the book prints
TABLES = {
    "tab:sinusoid": ("tab_sinusoid", ["ω", "Closed form: swing", "Closed form: lead (°)", "Dynamic program: swing",
                                       "Dynamic program: lead (°)", "Weighted: swing", "Weighted: lead (°)"]),
    "tab:sweep": ("tab_sweep", ["ε/c₀", "c₀ = 0.03", "c₀ = 0.1", "c₀ = 0.3", "Phase error (°)"]),
    "tab:random": ("tab_random", ["Family", "n", "Per-moment: median", "Per-moment: max", "Weighted: median",
                                   "Weighted: max", "Recovered"]),
    "tab:showcase": ("tab_showcase", ["Schedule", "Per-moment", "Weighted look-ahead"]),
    "tab:heldout": ("tab_heldout", ["Family", "n", "Per-moment: median", "Per-moment: max", "Weighted: median",
                                     "Weighted: max", "Recovered: median", "Recovered: 10th pct.", "Recovered: totals"]),
    "tab:baselines": ("tab_baselines", ["Rule", "No deadline: median", "No deadline: 90th pct.", "No deadline: max",
                                         "No deadline: wins / losses", "Deadline: median", "Deadline: max"]),
    "tab:behavior": ("tab_behavior", ["Family", "Bound error: per-moment", "Bound error: weighted",
                                       "Accuracy change: per-moment", "Accuracy change: weighted",
                                       "Decision time change: per-moment", "Decision time change: weighted"]),
    "tab:loss": ("tab_loss", ["Family", "Size", "Per-moment: loss", "Per-moment: predicted / actual",
                               "Weighted: loss", "Weighted: predicted / actual"]),
    "tab:scaling": ("tab_scaling", ["a", "Per-moment: loss", "Per-moment: growth", "Weighted: loss",
                                     "Weighted: finer grid"]),
    "tab:unknown": ("tab_unknown", ["Cost schedule", "Frozen-time", "Weighted", "Plug-in", "Tuned constant"]),
    "tab:grid": ("tab_grid", ["Schedule", "Per-moment, grid 1", "Per-moment, grid 2", "Per-moment, grid 3",
                               "Per-moment, grid 4", "Weighted, grid 1", "Weighted, grid 2", "Weighted, grid 3",
                               "Weighted, grid 4", "Residual"]),
}
_TABLE_ROWS = {}


def table_rows(name):
    if name not in _TABLE_ROWS:
        f = ROOT / "paper/generated" / f"{name}.tex"
        if not f.exists():
            fail(f"paper/generated/{name}.tex is missing: run tools/vendor_paper.py")
        rows = []
        for ln in f.read_text().strip().split("\n"):
            ln = ln.strip()
            if ln.endswith("\\\\"):
                ln = ln[:-2].strip()
            if ln and not ln.startswith("\\"):
                rows.append([x.strip() for x in ln.split("&")])
        _TABLE_ROWS[name] = rows
    return _TABLE_ROWS[name]


def table_cell(name, r, c):
    rows = table_rows(name)
    if not (1 <= r <= len(rows) and 1 <= c <= len(rows[r - 1])):
        fail(f"no cell {r},{c} in {name}")
    return rows[r - 1][c - 1].replace("\\%", "%").replace("---", "—")


def claim_ref(cid):
    """A claim's name from the claim map, linked to the section that teaches it once its chapter is built."""
    node = MAP["nodes"].get(cid)
    if node is None:
        fail(f"unknown claim {cid}")
    href = LINKS_NOW.get(cid)
    name = node["name"]
    return f"[{name}]({href})" if href else name


def fill(s):
    def mac(m):
        k = m.group(1)
        if k.startswith("ref:"):
            return ref(k[4:])
        if k.startswith("claim:"):
            return claim_ref(k[6:])
        if k.startswith("T:"):
            _, name, r, c = k.split(":")
            return table_cell(name, int(r), int(c))
        if k not in NUMBERS:
            fail(f"unknown number {k}")
        return NUMBERS[k]
    return re.sub(r"\{\{([\w:.-]+)\}\}", mac, s)


def inline(s):
    s = fill(s)
    maths = []

    def keep(m):
        maths.append(m.group(0))
        return f"\x00{len(maths) - 1}\x00"
    s = re.sub(r"\$\$.*?\$\$|\$[^$]*\$", keep, s, flags=re.S)
    codes = []

    def keepc(m):
        codes.append(m.group(1))
        return f"\x01{len(codes) - 1}\x01"
    s = re.sub(r"`([^`]+)`", keepc, s)
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\((https://[^)]+|#[\w-]+|[\w./#-]+)\)", r"<a href='\2'>\1</a>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"\x01(\d+)\x01", lambda m: f"<code>{html.escape(codes[int(m.group(1))])}</code>", s)
    s = re.sub(r"\x00(\d+)\x00", lambda m: html.escape(maths[int(m.group(1))], quote=False), s)
    return s


def md(s):
    """Paragraphs, '- ' lists, and $$ display math."""
    out = []
    for b in re.split(r"\n\s*\n", (s or "").strip("\n")):
        lines = [ln.rstrip() for ln in b.split("\n") if ln.strip()]
        if not lines:
            continue
        if lines[0].lstrip().startswith("- "):
            items, cur = [], None
            for ln in lines:
                if ln.lstrip().startswith("- "):
                    if cur is not None:
                        items.append(cur)
                    cur = ln.lstrip()[2:]
                else:
                    cur += " " + ln.strip()
            items.append(cur)
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
        elif b.strip().startswith("$$") and b.strip().endswith("$$"):
            out.append(f"<div class='eq'>{inline(b.strip())}</div>")
        else:
            out.append(f"<p>{inline(' '.join(x.strip() for x in lines))}</p>")
    return "\n".join(out)


def plain_text(s):
    """For attributes: numbers filled, math and markup dropped to their words."""
    s = fill(s)
    s = re.sub(r"\$[^$]*\$", "", s)
    s = re.sub(r"[*`]", "", s)
    return " ".join(s.split())


def excerpt(spec, head):
    parts = []
    lines_shown = []
    for r in spec.split(","):
        bits = r.split("|")
        a, b = (int(x) for x in bits[0].split("-"))
        sc = bits[1] if len(bits) > 1 and bits[1] else None
        ec = bits[2] if len(bits) > 2 and bits[2] else None
        body = CONV.excerpt(a, b, None, sc, ec)
        if sc:
            body = "<span class='cut'>…</span> " + body
        if ec:
            body = body + " <span class='cut'>…</span>"
        parts.append(body)
        lines_shown.append(f"{a}–{b}")
    src = (f"<p class='src'>main.tex at <code>{SOURCE['tag']}</code>, lines {', '.join(lines_shown)}</p>")
    return (f"<div class='x-exact'><span class='x-head'>{inline(head)}</span>"
            + "\n".join(parts) + src + "</div>")


# ---------------------------------------------------------------- pieces of a chapter
LIFT_ICON = ("<svg viewBox='0 0 16 16' aria-hidden='true'><path d='M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5'/></svg>")
STATE_WORD = {"computed": "computed", "measured": "measured", "exploration": "exploration"}


MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


# which groups of checks stand behind each plate: a chapter module's CHECKS, {plate id: [tags]}, set per page, and
# whose file of checks they are (tools/checks/<module>.mjs, with book.mjs for the shared pieces)
CHECK_TAGS = {"schedule": ["schedule"]}
CHECK_FILE = ["book"]


def checks_line(tag):
    """The line under a plate: what tools/check_book.mjs checked for it, and when."""
    f = HERE / "checks.json"
    if not f.exists():
        fail("book/checks.json is missing: run node tools/check_book.mjs first")
    c = json.loads(f.read_text())
    if c["passed"] != c["total"]:
        fail(f"{c['total'] - c['passed']} checks failed: run node tools/check_book.mjs")
    tags = CHECK_TAGS.get(tag, [tag])
    mine = [r for r in c["results"] if r["plate"] in tags and r.get("file") in ("book", CHECK_FILE[0])]
    y, m, d = (int(x) for x in c["date"].split("-"))
    when = f"{MONTHS[m - 1]} {d}, {y}"
    if not mine:
        return ""
    return (f"<p class='plate-checked'>Checked {when}: {len(mine)} of {len(mine)} checks of this plate's model against "
            f"the paper's numbers and code pass, of {c['total']} for the book.</p>")


def plate_html(pid, plates, n):
    p = plates[pid]
    wide = " is-wide" if p.get("wide") else ""
    return (f"<figure class='plate-live{wide}' id='plate-{pid}' data-demo='{pid}' "
            f"aria-label='Plate {n}, live: {html.escape(p['title'])}'>"
            f"<div class='plate-live-stage'><div class='grain' aria-hidden='true'></div>"
            f"<button class='btn-lift' type='button' aria-label='Lift plate {n} off the page to look closer' hidden>{LIFT_ICON}</button>"
            f"<h3>{html.escape(p['title'])}</h3>"
            f"<p class='plate-state' data-state='{p['state']}'>{html.escape(fill(p['state_text']))}</p>"
            f"<div class='demo-root'></div>{checks_line(pid)}</div>"
            f"<figcaption><b>Plate {n}, live.</b> <span class='cap'>{inline(p['caption'])}</span></figcaption></figure>")


def strip_html(sid, strips, plates, n):
    s = strips[sid]
    steps = s["steps"]
    buttons = "".join(f"<li><button type='button' data-step='{i}' aria-label='Step {i + 1}'>{i + 1}</button></li>"
                      for i in range(len(steps)))
    cards = "".join(
        f"<div class='strip-step' data-step='{i}'{'' if i == 0 else ' hidden'}>"
        f"<p class='step-no'>Step {i + 1} of {len(steps)}</p>"
        f"<p class='step-say'>{inline(say)}</p><p class='step-math'>{inline(mth)}</p></div>"
        for i, (say, mth) in enumerate(steps))
    plate = plate_html(s["plate"], plates, n)
    return (f"<div class='strip' id='strip-{sid}' data-strip='{sid}' data-plate='{s['plate']}' data-steps='{len(steps)}'>"
            f"<div class='plate-live-stage strip-stage'><div class='grain' aria-hidden='true'></div>"
            f"<div class='strip-head'><span class='ctl-key'>Scrub the proof</span>"
            f"<input type='range' min='0' max='{len(steps) - 1}' step='1' value='0' aria-label='Proof step'></div>"
            f"<ol class='strip-steps'>{buttons}</ol><div class='strip-card' aria-live='polite'>{cards}</div>"
            f"<div class='strip-nav'><button class='btn' type='button' data-go='-1'>Back</button>"
            f"<button class='btn btn-go' type='button' data-go='1'>Next step</button></div></div></div>"
            f"{plate}")


def figure_caption(label, env="figure"):
    text = "\n".join(TEX_LINES)
    end = text.index(f"\\label{{{label}}}")
    start = text.rindex(f"\\begin{{{env}}}", 0, end)
    k = text.index("\\caption{", start) + len("\\caption{")
    depth, i = 1, k
    while depth:
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    return CONV.inline(" ".join(text[k:i - 1].split()))


# the paper's figures, redrawn as day and night prints in book/assets/figures/<stem>.light.svg and .dark.svg
FIGURES = {
    "kernels": ("fig:kernels", "Two panels. Left: the kernel w(s) for four costs on log axes, falling like one over the square root of s near zero, with dots at each mean look-ahead. Right: the mean look-ahead against the cost, peaking near 0.62 and tending to one half as the cost falls, under a rising mean decision time."),
    "transfer": ("fig:transfer", "The transfer function's gain and phase lead against frequency."),
    "showcase": ("fig:showcase", "Four panels, one per cost schedule, each with the cost in a strip above: the optimal bound in ink, the per-moment rule dashed, and the weighted look-ahead rule dotted. In the first three, the optimal bound starts moving before the cost changes and the per-moment bound only when it does; on the deadline, the per-moment bound stays flat while the optimal bound comes down to zero at the deadline. The weighted rule tracks the optimal bound in all four.",
                 "In this print, the per-moment rule is slate rather than orange, and the weighted look-ahead green rather than blue."),
    "random_losses": ("fig:random", "The loss of the per-moment rule and of the weighted look-ahead on each of the 90 development schedules, in three families (smooth, step, and deadline), on a log scale. In each family, most of the weighted rule's losses are one to two powers of ten below the per-moment rule's.",
                      "In this print, the per-moment rule is slate and the weighted look-ahead green."),
    "heldout_paired": ("fig:heldout", "A scatter of the held-out schedules: the per-moment rule's loss across, the weighted look-ahead's up, on log scales, with lines at equal loss and at 10% and 1% of the per-moment rule's loss; most points sit below the 10% line.",
                       "In this print, the points are drawn in this page's inks."),
}


def table_html(label):
    if label not in TABLES:
        fail(f"no table {label} in TABLES")
    name, heads = TABLES[label]
    rows = table_rows(name)
    num = LABELS[label]["num"]
    cap = figure_caption(label, "table")
    head = "".join(f"<th scope='col'>{html.escape(h)}</th>" for h in heads)
    body = "".join("<tr>" + "".join((f"<th scope='row'>{inline(c.replace(chr(92) + '%', '%'))}</th>" if j == 0 else
                                     f"<td>{inline(c.replace(chr(92) + '%', '%').replace('---', '—'))}</td>")
                                    for j, c in enumerate(r)) + "</tr>" for r in rows)
    for r in rows:
        if len(r) != len(heads):
            fail(f"{label}: a row has {len(r)} cells for {len(heads)} heads")
    return (f"<figure class='tbl' id='table-{num}'><div class='tbl-scroll' tabindex='0' role='region' aria-label='Table {num}'>"
            f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>"
            f"<figcaption><b>Table {num}.</b> <span class='cap'>{cap} From the paper's generated table.</span></figcaption></figure>")


def figure_html(stem, depth, alt=None):
    if stem not in FIGURES:
        fail(f"no figure {stem} in FIGURES")
    label, alt0, *note = FIGURES[stem]
    alt = alt or alt0
    note = (" " + note[0]) if note else ""
    num = LABELS[label]["num"]
    cap = figure_caption(label)
    a = "../" * depth
    head = (HERE / "assets/figures" / f"{stem}.light.svg").read_text()[:3000]
    wh = re.search(r'<svg[^>]*?width="([\d.]+)pt" height="([\d.]+)pt"', head)
    W, H = (round(float(wh.group(1)) * 2), round(float(wh.group(2)) * 2)) if wh else (1200, 480)
    return (f"<figure class='plate duo' id='figure-{num}'>"
            f"<button class='lift' type='button'>"
            f"<img class='fig-day' src='{a}assets/figures/{stem}.light.svg' alt='{html.escape(alt)}' loading='lazy' width='{W}' height='{H}'>"
            f"<img class='fig-night' src='{a}assets/figures/{stem}.dark.svg' alt='{html.escape(alt)}' loading='lazy' width='{W}' height='{H}'>"
            f"<span class='vh'> Lift figure {num} off the page to look closer.</span></button>"
            f"<p class='hint' aria-hidden='true'>tap to lift</p>"
            f"<figcaption><b>Figure {num}.</b> <span class='cap'>{cap} From the paper, redrawn in this page's inks.{note}</span></figcaption></figure>")


MAP = json.loads((HERE / "content/map.json").read_text())
BOOK = load("book")


def built():
    """The built chapters in book order: [(num, title, line, module, mod)], a chapter being built when its content
    module exists. Each module's CHAPTER must agree with book.py on the number."""
    out = []
    for num, title, line, module in BOOK.CHAPTERS:
        if module and (HERE / "content" / f"{module}.py").exists():
            mod = load(module)
            if str(mod.CHAPTER["num"]) != str(num):
                fail(f"{module}.py says chapter {mod.CHAPTER['num']}, book.py says {num}")
            out.append((num, title, line, module, mod))
    slugs = [m.CHAPTER["slug"] for *_, m in out]
    if len(set(slugs)) != len(slugs):
        fail(f"two chapters share a slug: {slugs}")
    return out


BUILT = built()


def ink(num):
    return BOOK.INKS[str(num)]


def map_links(depth):
    """Links from the map to the built chapters: { claim id: href } relative to a page at this depth."""
    out = {}
    for num, _, _, module, mod in BUILT:
        slug = mod.CHAPTER["slug"]
        mine = [k for k, n in MAP["nodes"].items() if str(n["ch"]) == str(mod.CHAPTER["num"])]
        missing = [k for k in mine if k not in mod.MAP_LINKS]
        if missing:
            fail(f"chapter {num}'s claims without a section in MAP_LINKS: {missing}")
        for k in mine:
            here = depth == 1 and slug == CURRENT_SLUG[0]
            out[k] = (f"#{mod.MAP_LINKS[k]}" if here else f"{'../' * depth}{slug}/index.html#{mod.MAP_LINKS[k]}")
    return out


CURRENT_SLUG = [None]
LINKS_NOW = {}   # the map's links for the page being built, for {{claim:id}}


def map_html(depth, chapter=None, focus="thm:main"):
    links = html.escape(json.dumps(map_links(depth)), quote=True)
    ch = "" if chapter is None else f" data-chapter='{chapter}'"
    return (f"<div class='cmap is-wide' data-claim-map{ch} data-focus='{focus}' data-links=\"{links}\">"
            f"<p class='cm-how'>The claim map needs JavaScript.</p></div>")


def map_data():
    return ("<script type='application/json' id='map-data'>"
            + json.dumps(MAP, ensure_ascii=False).replace("<", "\\u003c") + "</script>")


def qs_html(qs):
    items = []
    for q, a in qs:
        items.append(f"<li><p class='q'>{inline(q)}</p><details class='answer'><summary>Worked answer</summary>"
                     f"<div>{md(a)}</div></details></li>")
    return "<ol class='qs'>" + "".join(items) + "</ol>"


def miss_html(ms):
    return "<ul class='miss'>" + "".join(
        f"<li><span class='wrong'>{inline(w)}</span>{inline(r)}</li>" for w, r in ms) + "</ul>"


# ---------------------------------------------------------------- the page shell
def chapter_word(num):
    return f"Appendix {num}" if str(num) in ("A", "B") else f"Chapter {num}"


def thumbs(chapter_sections=None, current="contents", depth=0):
    a = "../" * depth
    here = ' aria-current="page"'
    tabs = [f"<a href='{a}index.html' aria-label='Contents' data-flag='Contents'"
            f"{here if current == 'contents' else ''}></a>"]
    cur_ink = None
    for num, title, _, module, mod in BUILT:
        slug = mod.CHAPTER["slug"]
        d, n = ink(num)
        if slug == current:
            cur_ink = (d, n)
        tabs.append(f"<a href='{a}{slug}/index.html' style='--c:{d};--c-night:{n}' "
                    f"aria-label='{chapter_word(num)}: {html.escape(title)}' "
                    f"data-flag='{num} · {html.escape(title)}'{here if slug == current else ''}></a>")
    d, n = cur_ink or ("var(--ink-3)", "var(--ink-3)")
    for sid, title in (chapter_sections or []):
        tabs.append(f"<a class='sec' href='#{sid}' data-sec='{sid}' style='--c:{d};--c-night:{n}' "
                    f"aria-label='{html.escape(title)}' data-flag='§ · {html.escape(title)}'></a>")
    return "<nav class='thumb-index' aria-label='Thumb index'>" + "".join(tabs) + "</nav>"


def contents_menu(depth, current):
    a = "../" * depth
    slugs = {str(num): mod.CHAPTER["slug"] for num, *_, mod in BUILT}
    items = []
    for num, title, _, _ in BOOK.CHAPTERS:
        slug = slugs.get(str(num))
        if slug:
            cur = " aria-current='page'" if current == slug else ""
            items.append(f"<li><a href='{a}{slug}/index.html'{cur}><span>{num}</span>{html.escape(title)}</a></li>")
        else:
            items.append(f"<li><a class='soon' href='{a}index.html#ch-{num}'><span>{num}</span>{html.escape(title)}</a></li>")
    return "<ol>" + "".join(items) + "</ol>"


HEAD_SCRIPT = """<script>
(function () {
  var d = document.documentElement;
  try { var t = localStorage.getItem("cc-theme"); if (t === "light" || t === "dark") d.setAttribute("data-theme", t); } catch (e) {}
  try { var p = localStorage.getItem("cc-depth"); d.setAttribute("data-depth", p === "both" || p === "exact" ? p : "plain"); } catch (e) { d.setAttribute("data-depth", "plain"); }
})();
</script>"""


def shell(*, title, desc, body, depth, leaf, current, bar_title, thumbs_html, scripts, turn="", page_ink=None, css=""):
    a = "../" * depth
    style = f' style="--spot-d:{page_ink[0]};--spot-n:{page_ink[1]}"' if page_ink else ""
    return f"""<!doctype html>
<html lang="en" data-book="speed-accuracy-crash-course" data-leaf="{leaf}"{style}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#eef0f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0e0f" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{a}assets/favicon.svg" type="image/svg+xml">
{HEAD_SCRIPT}
<script src="{a}assets/js/page-turn.js"></script>
<link rel="preload" href="{a}assets/fonts/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{a}assets/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{a}assets/css/page-turn.css">
<link rel="stylesheet" href="{a}assets/css/thumb-index.css">
<link rel="stylesheet" href="{a}assets/css/figure-pop-out.css">
<link rel="stylesheet" href="{a}assets/css/chapter-hero.css">
<link rel="stylesheet" href="{a}assets/css/plate.css">
<link rel="stylesheet" href="{a}assets/css/book.css">{css}
</head>
<body>
<a class="skip" href="#main">Skip to the text</a>
<header class="bar page-turn-hold">
  <a class="bar-title" href="{a}index.html">{bar_title}</a>
  <div class="depth" role="group" aria-label="How much of the paper's text to show">
    <button type="button" data-depth="plain" aria-pressed="false">Plain</button><button type="button" data-depth="both" aria-pressed="false">Both</button><button type="button" data-depth="exact" aria-pressed="false">Exact</button>
  </div>
  <button class="bar-btn" type="button" id="toc-btn" aria-expanded="false" aria-controls="toc-menu" aria-label="Contents">
    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4.5h12M3 9h12M3 13.5h12"/></svg></button>
  <button class="bar-btn" type="button" id="theme-btn" aria-expanded="false" aria-controls="theme-menu" aria-label="Light or dark">
    <svg viewBox="0 0 18 18" aria-hidden="true"><path class="drop" d="M9 2.2c2.6 3.2 4.6 5.6 4.6 8.2A4.6 4.6 0 0 1 4.4 10.4C4.4 7.8 6.4 5.4 9 2.2Z"/></svg></button>
  <div class="menu" id="toc-menu" hidden><h2>Contents</h2>{contents_menu(depth, current)}</div>
  <div class="menu" id="theme-menu" hidden><h2>Printing</h2>
    <fieldset class="seg"><legend class="vh">Theme</legend><div class="seg-row">
      <label><input type="radio" name="theme" value="system"><span>System</span></label>
      <label><input type="radio" name="theme" value="light"><span>Day</span></label>
      <label><input type="radio" name="theme" value="dark"><span>Night</span></label></div></fieldset>
    <p>The figures and plates switch with the page.</p></div>
  <div class="bar-scale" aria-hidden="true"><span></span></div>
</header>
{thumbs_html}
<main id="main">
{body}
</main>
{turn}
<footer class="foot"><div class="foot-inner">
<p class="src-line">Built from the paper's source at <a href="{PAPER_REPO}/tree/{SOURCE['tag']}"><code>{SOURCE['tag']}</code></a> ({SOURCE['commit'][:7]}). <a href="{PAPER_PDF}">Read the paper</a>.</p>
{CREDIT}
</div></footer>
<script src="{a}assets/js/thumb-index.js" defer></script>
<script src="{a}assets/js/figure-pop-out.js" defer></script>
<script type="module" src="{a}assets/js/book.js"></script>
{scripts}
</body>
</html>
"""


# ---------------------------------------------------------------- pages
def turn_html(prev, nxt):
    """prev and nxt: (href, number, name, ink) or None."""
    out = ["<nav class='turn' aria-label='Turn the page'>"]
    if prev:
        href, no, name, _ = prev
        out.append(f"<a class='prev' rel='prev' href='{href}'><span class='dir'>Back to</span><span class='no'>{no}</span>"
                   f"<span class='name'>{html.escape(name)}</span></a>")
    if nxt:
        href, no, name, k = nxt
        st = f" style='--accent:{k[0]};--accent-night:{k[1]}'" if k else ""
        out.append(f"<a class='next' rel='next' href='{href}'{st}><span class='dir'>Next</span><span class='no'>{no}</span>"
                   f"<span class='name'>{html.escape(name)}</span></a>")
    out.append("</nav>")
    return "".join(out)


def chapter_page(i):
    num, title, _, module, mod = BUILT[i]
    C, PL, ST = mod.CHAPTER, mod.PLATES, getattr(mod, "STRIPS", {})
    CURRENT_SLUG[0] = C["slug"]
    LINKS_NOW.clear(); LINKS_NOW.update(map_links(1))
    CHECK_TAGS.clear(); CHECK_TAGS.update({"schedule": ["schedule"]}); CHECK_TAGS.update(getattr(mod, "CHECKS", {}))
    CHECK_FILE[0] = module
    plate_no = 0
    chips = []
    body = []
    for sec in mod.SECTIONS:
        parts = [f"<section class='sec' id='{sec['id']}' aria-labelledby='h-{sec['id']}'>",
                 f"<h2 id='h-{sec['id']}'>{inline(sec['title'])}</h2>"]
        for kind, *rest in sec["blocks"]:
            if kind == "md":
                parts.append(md(rest[0]))
            elif kind == "plain":
                parts.append(f"<div class='x-plain'>{md(rest[0])}</div>")
            elif kind == "exact":
                parts.append(excerpt(rest[0], rest[1]))
            elif kind == "plate":
                plate_no += 1
                parts.append(plate_html(rest[0], PL, plate_no))
                chips.append((rest[0], PL[rest[0]]))
            elif kind == "strip":
                plate_no += 1
                parts.append(strip_html(rest[0], ST, PL, plate_no))
                chips.append((ST[rest[0]]["plate"], PL[ST[rest[0]]["plate"]]))
            elif kind == "figure":
                parts.append(figure_html(rest[0], 1, rest[1] if len(rest) > 1 else None))
            elif kind == "table":
                parts.append(table_html(rest[0]))
            elif kind == "qs":
                parts.append(qs_html(rest[0]))
            elif kind == "miss":
                parts.append(miss_html(rest[0]))
            elif kind == "map":
                parts.append(map_html(1, C["num"], rest[0]))
            elif kind == "limits":
                parts.append(f"<div class='limits'>{md(rest[0])}</div>")
            else:
                fail(f"unknown block {kind}")
        parts.append("</section>")
        body.append("\n".join(parts))
    # the hero
    readings = "".join(f"<div><dt>{html.escape(lbl)}</dt><dd>{fill('{{' + key + '}}')}</dd></div>" for key, lbl in C["readings"])
    chip_html = "".join(f"<a href='#plate-{pid}' data-state='{p['state']}'>{html.escape(p['title'])}</a>" for pid, p in chips)
    if C["finding"] not in fill(C["intro"]):
        fail(f"{module}: the hero's finding must appear word for word in the chapter's introduction")
    if len(C["finding"]) > 170:
        fail(f"{module}: the hero's finding is longer than 170 characters")
    H = C.get("hero") or fail(f"{module}: CHAPTER has no hero (aria and caption)")
    of = "of the appendices" if str(num) in ("A", "B") else "of 12"
    hero = f"""<header class="hero">
<div class="hero-head"><div class="kicker"><span class="sp-numeral">{C['num']}</span><span class="of">{chapter_word(num)} {of}</span></div>
<h1 class="sp-headline">{html.escape(C['title'])}</h1>
<p class="finding">{html.escape(C['finding'])}</p></div>
<figure class="proof" data-kind="live" data-still="{H.get('still', 2)}" id="hero-proof">
<div class="proof-stage"><div class="proof-sheet"><svg class="chart" id="hero-svg" viewBox="0 0 520 300" role="img" aria-label="{html.escape(H['aria'])}"></svg></div><p class="proof-label" aria-hidden="true"></p></div>
<div class="proof-controls" hidden><button class="proof-play" type="button" aria-label="Pause the proof"></button><span class="proof-steps"></span></div>
<figcaption>{inline(H['caption'])}</figcaption>
</figure>
<dl class="readings">{readings}</dl>
<div class="hero-foot"><nav class="chips" aria-label="The live plates in this chapter"><span class="chips-h" aria-hidden="true">Live plates</span>{chip_html}</nav></div>
</header>"""
    intro = f"<div class='intro'>{md(C['intro'])}</div>"
    page_body = (f"<div class='col chapter-top'>{hero}{intro}\n" + "\n".join(body) + "</div>" + map_data())
    if i == 0:
        prev = ("../index.html", "·", "Contents", None)
    else:
        pn, pt, _, _, pm = BUILT[i - 1]
        prev = (f"../{pm.CHAPTER['slug']}/index.html", pn, pt, None)
    nxt = None
    if i + 1 < len(BUILT):
        nn, nt, _, _, nm = BUILT[i + 1]
        nxt = (f"../{nm.CHAPTER['slug']}/index.html", nn, nt, ink(nn))
    secs = [(s["id"], plain_text(s["title"])) for s in mod.SECTIONS]
    css = f"\n<link rel='stylesheet' href='../assets/css/{module}.css'>" if (HERE / "assets/css" / f"{module}.css").exists() else ""
    return shell(title=f"{C['num']} · {C['title']} · Waiting, weighted",
                 desc=C["finding"], body=page_body, depth=1, leaf=C["leaf"], current=C["slug"],
                 bar_title=f"<b>{C['num']}</b> · {html.escape(C['title'])}",
                 thumbs_html=thumbs(secs, C["slug"], 1),
                 scripts=f"<script src='../assets/js/chapter-hero.js' defer></script>\n<script type='module' src='../assets/js/{module}.js'></script>",
                 turn=turn_html(prev, nxt), page_ink=ink(num), css=css)


def contents_page():
    book = BOOK
    CURRENT_SLUG[0] = None
    LINKS_NOW.clear(); LINKS_NOW.update(map_links(0))
    CHECK_TAGS.clear(); CHECK_TAGS.update({"schedule": ["schedule"]})
    CHECK_FILE[0] = "book"
    slugs = {str(num): mod.CHAPTER["slug"] for num, *_, mod in BUILT}
    rows = []
    for num, title, line, _ in book.CHAPTERS:
        slug = slugs.get(str(num))
        d, n = ink(num)
        if slug:
            rows.append(f"<li class='live' id='ch-{num}' style='--spot-d:{d};--spot-n:{n}'><a href='{slug}/index.html'><span class='n'>{num}</span>"
                        f"<span class='t'>{html.escape(title)}</span><span class='st'>Read</span>"
                        f"<span class='d'>{inline(line)}</span></a></li>")
        else:
            rows.append(f"<li class='soon' id='ch-{num}'><div class='row'><span class='n'>{num}</span>"
                        f"<span class='t'>{html.escape(title)}</span><span class='st'>Coming</span>"
                        f"<span class='d'>{inline(line)}</span></div></li>")
    body = f"""<div class="col">
<header class="title-page">
<p class="kicker">Ryan Kamp</p>
<h1>{html.escape(book.TITLE)}<span class="sub">{html.escape(book.SUBTITLE)}</span></h1>
<p class="lede">{inline(book.LEDE)}</p>
<p class="byline">{inline(book.DRAFT)}</p>
</header>
<section class="sec" id="schedule" aria-labelledby="h-schedule">
<h2 id="h-schedule">Your schedule</h2>
<p>{inline(book.SCHEDULE_INTRO)}</p>
<figure class="plate-live is-wide" id="plate-schedule" data-demo="schedule" aria-label="Live: your schedule and its best bound">
<div class="plate-live-stage"><div class="grain" aria-hidden="true"></div>
<button class='btn-lift' type='button' aria-label='Lift the schedule off the page to look closer' hidden>{LIFT_ICON}</button>
<h3>Your schedule</h3>
<p class="plate-state" data-state="computed">Computed in the page: the best bound by dynamic programming on a grid</p>
<div class="demo-root"></div>{checks_line("schedule")}</div>
<figcaption><b>Live.</b> <span class="cap">Top: the cost of time, on a log scale (orange). Bottom: the best bound for it (ink), from a dynamic program that checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window, and the per-moment rule's bound, $B(c(t))$ moved in by the same check's shift (dashed). Draw your own by dragging across the top chart.</span></figcaption>
</figure>
</section>
<section class="sec" id="contents" aria-labelledby="h-contents">
<h2 id="h-contents">Contents</h2>
<ol class="contents">{''.join(rows)}</ol>
</section>
<section class="sec" id="map" aria-labelledby="h-map">
<h2 id="h-map">{html.escape(book.MAP_SLOT[0])}</h2>
<p>{inline(book.MAP_SLOT[1])}</p>
{map_html(0)}
</section>
</div>{map_data()}"""
    nxt = None
    if BUILT:
        nn, nt, _, _, nm = BUILT[0]
        nxt = (f"{nm.CHAPTER['slug']}/index.html", nn, nt, ink(nn))
    return shell(title=f"{book.TITLE}: {book.SUBTITLE}", desc=plain_text(book.LEDE), body=body, depth=0, leaf=0,
                 current="contents", bar_title=html.escape(book.SHORT), thumbs_html=thumbs(None, "contents", 0),
                 scripts="<script type='module' src='assets/js/contents.js'></script>", turn=turn_html(None, nxt))


def asset_version():
    """One short hash of every asset, added to their URLs so a new build is never read from an old cache."""
    h = hashlib.sha256()
    for f in sorted((HERE / "assets").rglob("*")):
        if f.is_file():
            h.update(f.name.encode()); h.update(f.read_bytes())
    return h.hexdigest()[:10]


def versioned(page, version):
    return re.sub(r"((?:src|href)=[\"'](?:\.\./)*assets/(?:css|js)/[\w.-]+\.(?:css|js))([\"'])", lambda m: f"{m.group(1)}?v={version}{m.group(2)}", page)


def main():
    check_numbering()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    shutil.copytree(HERE / "assets", OUT / "assets",
                    ignore=shutil.ignore_patterns("hero-check.mjs", "hero-html.mjs", "plate-kit.js", "format.js", "manifest.json"))
    version = asset_version()
    pages = [OUT / "index.html"]
    pages[0].write_text(versioned(contents_page(), version))
    for i, (num, *_, mod) in enumerate(BUILT):
        d = OUT / mod.CHAPTER["slug"]
        d.mkdir()
        (d / "index.html").write_text(versioned(chapter_page(i), version))
        pages.append(d / "index.html")
    for js in (OUT / "assets/js").glob("*.js"):
        js.write_text(re.sub(r"([\"'])\./([\w.-]+\.js)\1", lambda m: f"{m.group(1)}./{m.group(2)}?v={version}{m.group(1)}", js.read_text()))
    (OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    (OUT / ".nojekyll").write_text("")
    if "--no-math" not in sys.argv:
        subprocess.run(["node", str(ROOT / "tools/math/render.mjs"), *map(str, pages)], check=True)
    print("built docs/: " + ", ".join(str(p.relative_to(OUT)) for p in pages))


if __name__ == "__main__":
    main()
