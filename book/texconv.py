"""Convert excerpts of the paper's LaTeX (paper/main.tex) to HTML, with the math left as TeX for
tools/math/render.mjs to set.

Only the constructs the paper uses are handled. Numbers for equations, theorem-like environments,
sections, tables, figures, and the algorithm come from paper/labels.json (the aux file of a compile
of the tag) and from counting environments in main.tex; build.py checks the two agree.
"""
import html
import re

THM_ENVS = ["theorem", "lemma", "corollary", "proposition", "conjecture", "definition", "remark"]
THM_NAME = {e: e.capitalize() for e in THM_ENVS}

CREF_NAMES = {
    "lem": ("Lemma", "Lemmas"), "prop": ("Proposition", "Propositions"),
    "thm": ("Theorem", "Theorems"), "cor": ("Corollary", "Corollaries"),
    "conj": ("Conjecture", "Conjectures"), "rem": ("Remark", "Remarks"),
    "def": ("Definition", "Definitions"), "sec": ("Section", "Sections"),
    "app": ("Appendix", "Appendices"), "tab": ("Table", "Tables"),
    "fig": ("Figure", "Figures"), "alg": ("Algorithm", "Algorithms"),
    "eq": ("Equation", "Equations"),
}

ACCENTS = {r"{\'c}": "ć", r"{\'e}": "é", r'{\"o}': "ö", r'{\"u}': "ü", r"{\'a}": "á",
           r"\v{c}": "č", r"{\v c}": "č", r"{\'o}": "ó", r"\'e": "é", r"\'c": "ć"}


def read_aux(text):
    labels, cites = {}, {}
    for m in re.finditer(r"\\newlabel\{([^}@]+)\}\{\{([^}]*)\}\{([^}]*)\}", text):
        labels[m.group(1)] = {"num": m.group(2), "page": m.group(3)}
    for m in re.finditer(r"\\bibcite\{([^}]+)\}\{\{(\d+)\}\{(\d+)\}\{\{(.*?)\}\}", text):
        short = m.group(4)
        for k, v in ACCENTS.items():
            short = short.replace(k, v)
        short = short.replace("~", " ").replace("{", "").replace("}", "")
        cites[m.group(1)] = {"year": m.group(3), "short": short}
    return labels, cites


def number_equations(lines):
    """Map 1-based line number of each \\begin{equation} to its printed number."""
    out, n = {}, 0
    for i, line in enumerate(lines, 1):
        for _ in re.finditer(r"\\begin\{equation\}", line):
            n += 1
            out[i] = n
    return out


def number_theorems(lines):
    out, n = {}, 0
    pat = re.compile(r"\\begin\{(" + "|".join(THM_ENVS) + r")\}")
    for i, line in enumerate(lines, 1):
        for _ in pat.finditer(line):
            n += 1
            out[i] = n
    return out


class Converter:
    def __init__(self, tex_lines, labels, cites, numbers):
        self.lines = tex_lines
        self.labels = labels
        self.cites = cites
        self.numbers = numbers
        self.eqnum = number_equations(tex_lines)
        self.thmnum = number_theorems(tex_lines)

    # ---- references -------------------------------------------------------------------
    def ref_num(self, key):
        if key not in self.labels:
            raise KeyError(f"unknown label {key}")
        return self.labels[key]["num"]

    def cref(self, keys, cap):
        keys = [k.strip() for k in keys.split(",")]
        groups = []
        for k in keys:
            p = k.split(":")[0]
            if groups and groups[-1][0] == p:
                groups[-1][1].append(k)
            else:
                groups.append((p, [k]))
        parts = []
        for p, ks in groups:
            sing, plur = CREF_NAMES[p]
            nums = [self.ref_num(k) for k in ks]
            if p == "eq":
                nums = [f"({x})" for x in nums]
            name = sing if len(nums) == 1 else plur
            if len(nums) == 1:
                parts.append(f"{name} {nums[0]}")
            elif len(nums) == 2:
                parts.append(f"{name} {nums[0]} and {nums[1]}")
            else:
                parts.append(f"{name} " + ", ".join(nums[:-1]) + f", and {nums[-1]}")
        s = " and ".join(parts)
        if not cap:
            # cleveref with [capitalize] keeps capitals; the paper uses that option
            pass
        return s

    def cite(self, keys, opt1, opt2, mode, cap):
        keys = [k.strip() for k in keys.split(",")]
        items = []
        for k in keys:
            c = self.cites[k]
            if items and items[-1][0] == c["short"]:
                items[-1][1].append(c["year"])
            else:
                items.append((c["short"], [c["year"]]))
        pre, post = "", ""
        if opt2 is not None:
            pre, post = opt1 or "", opt2 or ""
        elif opt1 is not None:
            post = opt1
        pre = pre.replace("~", " ")
        post = post.replace("~", " ")
        if mode == "t":
            s = "; ".join(f"{a} ({', '.join(ys)}{', ' + post if post else ''})" for a, ys in items)
        else:
            inner = "; ".join(f"{a}, {', '.join(ys)}" for a, ys in items)
            if post:
                inner += f", {post}"
            if pre:
                inner = f"{pre} {inner}"
            s = f"({inner})"
        return s

    # ---- inline text ------------------------------------------------------------------
    def numbers_sub(self, s):
        for name in sorted(self.numbers, key=len, reverse=True):
            s = re.sub(r"\\" + name + r"(\{\})?(?![A-Za-z])", lambda m, v=self.numbers[name]: v, s)
        return s

    def inline(self, s):
        """Text with $...$ math: escape text, convert commands, keep math for MathJax."""
        s = self.numbers_sub(s)
        # protect math
        maths = []

        def keep(m):
            maths.append(m.group(0))
            return f"\x00{len(maths) - 1}\x00"

        s = re.sub(r"\$\$.*?\$\$|\$[^$]*\$", keep, s, flags=re.S)
        # references and citations (may contain math-free text only)
        s = re.sub(r"\\texorpdfstring\{((?:[^{}]|\{[^{}]*\})*)\}\{(?:[^{}]|\{[^{}]*\})*\}", r"\1", s)
        s = re.sub(r"\\(C|c)ref\{([^}]*)\}", lambda m: self.cref(m.group(2), m.group(1) == "C"), s)
        s = re.sub(r"\\eqref\{([^}]*)\}", lambda m: f"({self.ref_num(m.group(1))})", s)
        s = re.sub(r"\\ref\{([^}]*)\}", lambda m: self.ref_num(m.group(1)), s)

        def citesub(m):
            cap, mode, o1, o2, keys = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            return self.cite(keys, o1, o2, mode, cap)

        s = re.sub(r"\\(C|c)ite(t|p)(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\{([^}]*)\}", citesub, s)
        s = html.escape(s, quote=False)
        s = re.sub(r"\\emph\{([^{}]*)\}", r"<em>\1</em>", s)
        s = re.sub(r"\\textbf\{([^{}]*)\}", r"<strong>\1</strong>", s)
        s = re.sub(r"\\paragraph\{([^{}]*)\}", r"<strong class='para'>\1</strong>", s)
        s = re.sub(r"\\url\{([^{}]*)\}", r"<span class='url'>\1</span>", s)
        s = s.replace("``", "“").replace("''", "”").replace("---", "—").replace("--", "–")
        s = s.replace("\\%", "%").replace("\\&", "&amp;").replace("~", "\u00a0").replace("\\,", "\u2009")
        s = s.replace("\\dots", "…").replace("\\ ", " ")
        for cmd in ["\\smallskip", "\\medskip", "\\noindent", "\\centering", "\\small", "\\footnotesize"]:
            s = s.replace(cmd, "")
        s = re.sub(r"\\label\{[^}]*\}", "", s)
        if "\\" in s:
            left = re.findall(r"\\[A-Za-z]+", s)
            if left:
                raise ValueError(f"unconverted commands {set(left)} in: {s[:200]}")

        def back(m):
            return html.escape(maths[int(m.group(1))], quote=False)

        s = re.sub(r"\x00(\d+)\x00", back, s)
        return s

    # ---- blocks -----------------------------------------------------------------------
    def excerpt(self, a, b, fig_src=None, start_cut=None, end_cut=None):
        """HTML for lines a..b (1-based, inclusive) of main.tex, optionally starting at start_cut in
        line a and ending after end_cut in line b (marked with an ellipsis in the page)."""
        raw = list(self.lines[a - 1:b])
        if start_cut:
            k = raw[0].index(start_cut)
            raw[0] = raw[0][k:]
        if end_cut:
            k = raw[-1].index(end_cut) + len(end_cut)
            raw[-1] = raw[-1][:k]
        # strip comments
        clean = []
        for i, line in enumerate(raw, a):
            line = re.sub(r"(?<!\\)%.*$", "", line)
            clean.append((i, line))
        out = []
        para = []
        stack = []  # environment stack

        def flush():
            if para:
                text = " ".join(para).strip()
                if text:
                    out.append(f"<p>{self.inline(text)}</p>")
                para.clear()

        i = 0
        n = len(clean)
        while i < n:
            ln, line = clean[i]
            st = line.strip()
            if not st:
                flush()
                i += 1
                continue
            # equation
            if st.startswith("\\begin{equation}"):
                flush()
                body = []
                num = self.eqnum[ln]
                rest = st[len("\\begin{equation}"):]
                if rest.strip():
                    body.append(rest)
                i += 1
                while "\\end{equation}" not in clean[i][1]:
                    body.append(clean[i][1])
                    i += 1
                endline = clean[i][1]
                before = endline.split("\\end{equation}")[0]
                if before.strip():
                    body.append(before)
                tex = " ".join(x.strip() for x in body)
                tex = re.sub(r"\\label\{[^}]*\}", "", tex)
                tex = self.numbers_sub(tex)
                out.append(f"<div class='eq'>\\[{html.escape(tex, quote=False)} \\tag{{{num}}}\\]</div>")
                after = endline.split("\\end{equation}", 1)[1].strip()
                if after:
                    para.append(after)
                i += 1
                continue
            m = re.match(r"\\begin\{(" + "|".join(THM_ENVS) + r")\}(?:\[([^\]]*)\])?(.*)$", st)
            if m:
                flush()
                env, name, rest = m.group(1), m.group(2), m.group(3)
                num = self.thmnum[ln]
                head = f"{THM_NAME[env]} {num}"
                if name:
                    head += f" ({self.inline(name)})"
                out.append(f"<div class='thm thm-{env}'><span class='thm-head'>{head}.</span>")
                stack.append("thm")
                rest = re.sub(r"\\label\{[^}]*\}", "", rest).strip()
                if rest:
                    para.append(rest)
                i += 1
                continue
            m = re.match(r"\\end\{(" + "|".join(THM_ENVS) + r")\}", st)
            if m:
                flush()
                out.append("</div>")
                stack.pop()
                i += 1
                continue
            m = re.match(r"\\begin\{proof\}(?:\[([^\]]*)\])?(.*)$", st)
            if m:
                flush()
                out.append(f"<div class='tex-proof'><span class='proof-head'>{m.group(1) or 'Proof'}.</span>")
                if m.group(2).strip():
                    para.append(m.group(2).strip())
                i += 1
                continue
            if st.startswith("\\end{proof}"):
                flush()
                out.append("<span class='qed'>∎</span></div>")
                i += 1
                continue
            m = re.match(r"\\begin\{(enumerate|itemize)\}", st)
            if m:
                flush()
                out.append("<ul class='tex-list'>")
                stack.append("list")
                i += 1
                continue
            if re.match(r"\\end\{(enumerate|itemize)\}", st):
                flush()
                if out and out[-1] != "<ul class='tex-list'>":
                    out.append("</li>")
                out.append("</ul>")
                stack.pop()
                i += 1
                continue
            m = re.match(r"\\item(?:\[([^\]]*)\])?\s*(.*)$", st)
            if m:
                flush()
                if out and out[-1] != "<ul class='tex-list'>" and stack and stack[-1] == "list":
                    out.append("</li>")
                lab = m.group(1)
                out.append(f"<li>" + (f"<span class='item-label'>{self.inline(lab)}</span> " if lab else ""))
                if m.group(2):
                    para.append(m.group(2))
                i += 1
                continue
            if st.startswith("\\begin{figure}") or st.startswith("\\begin{table}") or st.startswith("\\begin{algorithm}"):
                flush()
                kind = re.match(r"\\begin\{(\w+)\}", st).group(1)
                body = []
                i += 1
                while not clean[i][1].strip().startswith(f"\\end{{{kind}}}"):
                    body.append(clean[i][1])
                    i += 1
                i += 1
                out.append(self.float_block(kind, "\n".join(body), fig_src))
                continue
            if st.startswith(("\\section", "\\subsection", "\\label", "\\begin{abstract}", "\\end{abstract}")):
                i += 1
                continue
            para.append(st)
            i += 1
        flush()
        while stack:
            stack.pop()
            out.append("</div>")
        html_out = "\n".join(out)
        html_out = html_out.replace("<li></p>", "<li>")
        return html_out

    def float_block(self, kind, body, fig_src):
        lab = re.search(r"\\label\{([^}]*)\}", body)
        num = self.ref_num(lab.group(1)) if lab else "?"
        cap = ""
        m = re.search(r"\\caption\{", body)
        if m:
            depth, j = 1, m.end()
            while depth:
                if body[j] == "{":
                    depth += 1
                elif body[j] == "}":
                    depth -= 1
                j += 1
            cap = body[m.end():j - 1]
            cap = re.sub(r"\s+", " ", cap)
        name = {"figure": "Figure", "table": "Table", "algorithm": "Algorithm"}[kind]
        parts = [f"<figure class='tex-float'>"]
        if kind == "figure":
            g = re.search(r"\\includegraphics(?:\[[^\]]*\])?\{figures/([^}.]+)\.pdf\}", body)
            if g and fig_src:
                parts.append(fig_src(g.group(1)))
        if kind == "algorithm":
            parts.append(self.algorithmic(body))
        parts.append(f"<figcaption><strong>{name} {num}.</strong> {self.inline(cap)}</figcaption>")
        if kind == "table":
            parts.append("<p class='note'>The table's rows are shown with the card's tables below.</p>")
        parts.append("</figure>")
        return "\n".join(parts)

    def algorithmic(self, body):
        m = re.search(r"\\begin\{algorithmic\}(?:\[\d+\])?(.*?)\\end\{algorithmic\}(.*)$", body, flags=re.S)
        inner, tail = m.group(1), m.group(2)
        rows = []
        indent = 0
        for line in inner.split("\n"):
            st = line.strip()
            if not st:
                continue
            com = ""
            cm = re.search(r"\\Comment\{(.*)\}\s*$", st)
            if cm:
                com = cm.group(1)
                st = st[:cm.start()].strip()
            numbered = True
            if st.startswith("\\Require"):
                txt = "<strong>Require:</strong> " + self.inline(st[len("\\Require"):].strip())
                numbered = False  # algorithmicx numbers the steps, not the Require line
            elif st.startswith("\\State"):
                body_ = st[len("\\State"):].strip()
                body_ = body_.replace("\\Return", "\\textbf{return}")
                txt = self.inline(body_)
            elif st.startswith("\\For"):
                fm = re.match(r"\\For\{(.*)\}", st)
                txt = "<strong>for</strong> " + self.inline(fm.group(1)) + " <strong>do</strong>"
                rows.append((indent, txt, com, True))
                indent += 1
                continue
            elif st.startswith("\\EndFor"):
                indent -= 1
                rows.append((indent, "<strong>end for</strong>", "", True))
                continue
            else:
                # continuation of the previous line
                prev = rows.pop()
                rows.append((prev[0], prev[1] + " " + self.inline(st), prev[2] or com, prev[3]))
                continue
            rows.append((indent, txt, com, numbered))
        lines = []
        k = 0
        for ind, txt, com, numbered in rows:
            k += numbered
            c = f"<span class='alg-com'>▹ {self.inline(com)}</span>" if com else ""
            n = k if numbered else ""
            lines.append(f"<div class='alg-row' style='--ind:{ind}'><span class='alg-n'>{n}</span><span>{txt}{c}</span></div>")
        tail = re.sub(r"\\smallskip|\\footnotesize", "", tail).strip()
        tail_html = f"<p class='alg-note'>{self.inline(' '.join(tail.split()))}</p>" if tail else ""
        return "<div class='alg'>" + "\n".join(lines) + "</div>" + tail_html
