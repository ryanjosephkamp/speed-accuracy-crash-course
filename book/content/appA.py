"""Appendix A: the proofs. Every proof in the paper, in the paper's order: the two derivations in Section 2 that the
proofs use, the standing facts at the start of Appendix A, its proofs, and Appendix B's bounds for unequal rewards.

Each section gives what the result proves and assumes, the paper's statement and proof in full (Exact and Both), and
the steps a chapter draws for it. Those steps are the chapters' own strips, loaded from their content modules (so a
fix there reaches this page), shown without their plates and with a link to the section that draws them; Appendix
B's steps are this module's own. The lines on what each result uses and what uses it, the map paragraph, and one
exercise are built from the claim map, so they can't drift from it.
"""
import importlib.util
import json
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_MAP = json.loads((_HERE / "map.json").read_text())
_NODES, _EDGES = _MAP["nodes"], _MAP["edges"]


def _load(name):
    spec = importlib.util.spec_from_file_location(f"appA_{name}", _HERE / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_CH = {name: _load(name) for name in ("ch02", "ch03", "ch04", "ch05", "ch06", "ch07", "ch08", "ch11")}

# the claims whose proofs (or derivations) each section holds, in the paper's order; the hero draws them in this order
PROVES = {
    "facts": ["def:reflected"],
    "flat": ["eq:constant-bound", "eq:Bprime"],
    "standing": ["sf:strong", "sf:stopping"],
    "lemma1": ["lem:structure"],
    "lemma2": ["lem:envelope"],
    "prop3": ["prop:regularity"],
    "prop4": ["prop:exact"],
    "lemma6": ["lem:kernel"],
    "theorem7": ["thm:main"],
    "corollaries": ["cor:transfer", "cor:limits"],
    "prop13": ["prop:rule", "def:avg-cost"],
    "prop10": ["prop:loss"],
    "unequal": ["ext:lopsided"],
}
_SEC_OF = {c: s for s, cs in PROVES.items() for c in cs}


def _ref(cid):
    """A claim by its name in the map: linked to its section here when this page proves it, else to its chapter."""
    if cid in _SEC_OF:
        return f"[{_NODES[cid]['name']}](#{_SEC_OF[cid]})"
    return "{{claim:" + cid + "}}"


def _uses(cid):
    return [a for a, b in _EDGES if b == cid]


def _users(cid):
    return [b for a, b in _EDGES if a == cid]


def _ancestors(cid):
    seen, todo = set(), [cid]
    while todo:
        for a in _uses(todo.pop()):
            if a not in seen:
                seen.add(a)
                todo.append(a)
    return seen


def _and(xs):
    return xs[0] if len(xs) == 1 else " and ".join(xs) if len(xs) == 2 else ", ".join(xs[:-1]) + ", and " + xs[-1]


def _edges_md(section):
    """What each claim of a section uses and what uses it, from the claim map's edges (direct ones only)."""
    out = []
    for cid in PROVES[section]:
        uses, users = _uses(cid), _users(cid)
        head = "In the claim map" + ("" if len(PROVES[section]) == 1 else f", for **{_NODES[cid]['name']}**") + ":"
        out.append(head + "\n\n"
                   + "- **It uses** " + ("; ".join(_ref(x) for x in uses) if uses else "no other entry") + ".\n"
                   + "- **What uses it:** " + ("; ".join(_ref(x) for x in users) if users else "no other entry") + ".")
    return ("md", "\n\n".join(out))


def _reuse(ch, sid):
    """A chapter's strip, unchanged, without its plate, with a link to the section that draws it."""
    m = _CH[ch]
    st = m.STRIPS[sid]
    sec = next(s for s in m.SECTIONS if any(b[0] == "strip" and b[1] == sid for b in s["blocks"]))
    c = m.CHAPTER
    plate = m.PLATES[st["plate"]]["title"]
    see = (f"Chapter {c['num']} draws each step beside its live plate “{plate}”, in "
           f"[{sec['title']}](../{c['slug']}/index.html#{sec['id']}).")
    return {"plate": None, "steps": st["steps"], "see": see, "from": [ch, sid]}


# where the strips come from: (chapter module, strip id); every strip of chapters 3 to 8 is here, with two of
# chapter 2's (tools/checks/appA.mjs holds the list to the chapters' strips)
_REUSED = [("ch02", "identities"), ("ch03", "routes"), ("ch03", "inverse"), ("ch02", "strong"), ("ch04", "stopping"),
           ("ch04", "lemma1a"), ("ch04", "lemma1bc"), ("ch04", "lemma1d"), ("ch05", "lemma2"), ("ch05", "prop3"),
           ("ch05", "prop4"), ("ch06", "lemma6"), ("ch06", "theorem7"), ("ch07", "transfer"), ("ch07", "limits"),
           ("ch07", "half"), ("ch08", "prop13"), ("ch07", "loss")]

STRIPS = {sid: _reuse(ch, sid) for ch, sid in _REUSED}
# Appendix B's steps are this page's own; chapter 11 draws the same derivation in its own strip, beside a plate
_B11 = _CH["ch11"]
_B11_SEC = next(s for s in _B11.SECTIONS if any(b[0] == "strip" and b[1] == "appB" for b in s["blocks"]))
STRIPS["lopsided"] = {
    "plate": None,
    "see": (f"These steps are this appendix's own. Chapter 11 draws the same derivation, in steps of its own, beside its "
            f"live plate “{_B11.PLATES[_B11.STRIPS['appB']['plate']]['title']}”, in "
            f"[{_B11_SEC['title']}](../{_B11.CHAPTER['slug']}/index.html#{_B11_SEC['id']})."),
    "steps": [
        ("With unequal rewards, the problem can't be folded at 0: the evidence is followed on both sides, and stopping earns the better of the two choices.",
         r"A correct $+$ earns $r_+$ and a correct $-$ earns $r_-$, so stopping at $x$ earns $\class{lit}{G(x) = \max\bigl(r_+ g(x),\ r_-(1 - g(x))\bigr)}$. For a constant cost $c$, the decision maker waits while $\ell < x < h$, an interval around $x^* = \tfrac12\log(r_-/r_+)$, where the two choices earn the same."),
        ("Between the bounds, the value solves the same equation as for equal rewards, and it integrates once, with a constant left free.",
         r"$X$ has the generator $\Lop = \tfrac12\partial_x^2 + \tanh(x)\,\partial_x$, so on $(\ell, h)$, $\Lop V = c$ becomes $(\cosh^2 x\,V')' = 2c\cosh^2 x$, and $\class{lit}{\cosh^2 x\,V'(x) = c\,S(x) + K}$ with $S(x) = x + \tfrac12\sinh 2x$. For equal rewards, the reflecting center gave $V'(0) = 0$ and so $K = 0$; here nothing fixes $K$ yet."),
        ("Smooth fit at each bound gives one equation each.",
         r"At $h$ the value meets $r_+ g$, whose slope is $r_+ g'(h) = r_+/(2\cosh^2 h)$; at $\ell$ it meets $r_-(1 - g)$, whose slope is $-r_-/(2\cosh^2\ell)$. Multiplied by $\cosh^2$, the two slopes give $\class{lit}{c\,S(h) + K = \tfrac12 r_+}$ and $\class{lit}{c\,S(\ell) + K = -\tfrac12 r_-}$."),
        ("Value matching gives the third: across the interval, the value changes by exactly as much as the reward for stopping does.",
         r"Since $S' = 2\cosh^2 x$, integrating by parts gives $\int S\sech^2 x\,dx = S\tanh x - \tfrac12\cosh 2x$, so $A$, which is $c\,\bigl(S\tanh x - \tfrac12\cosh 2x\bigr)$ plus $K\tanh x$, has $A' = V'$. Then $V(h) - V(\ell) = G(h) - G(\ell)$ reads $\class{lit}{A(h) - A(\ell) = r_+ g(h) - r_-\bigl(1 - g(\ell)\bigr)}$. With step 3, that is three equations for $\ell$, $h$, and $K$."),
        ("Equal rewards give back the flat bound.",
         r"For $r_+ = r_- = 1$, $h = -\ell$ and $K = 0$ satisfy both equations of step 3 when $c\,S(h) = \tfrac12$, which is $\class{lit}{\sinh(2h) + 2h = 1/c}$, so $h = -\ell = B(c)$. Value matching holds too: $A$ is then even, and $1 - g(-h) = g(h)$, so both sides of step 4 are 0. For a common reward $r$, dividing the equations by $r$ gives $h = -\ell = B(c/r)$."),
    ],
}

_THM_USERS = len(_users("thm:main"))
assert _THM_USERS == max(len(_users(k)) for k in _NODES), "the map paragraph says Theorem 7 has the most users"

# the finding, from the map: the exact equation rests on every result before it in Appendix A, and Theorem 7 rests
# on only two more of the results proved here
_ORDER = [c for cs in PROVES.values() for c in cs]
_BEFORE_EXACT = ["sf:strong", "sf:stopping", "lem:structure", "lem:envelope", "prop:regularity"]
assert set(_BEFORE_EXACT) <= _ancestors("prop:exact")
_EXTRA = sorted(k for k in _ancestors("thm:main") - _ancestors("prop:exact") - {"prop:exact"} if k in _ORDER)
assert _EXTRA == ["eq:Bprime", "lem:kernel"], _EXTRA
_DIRECT = [k for k in _ORDER if k in _uses("thm:main")]
_THROUGH = [k for k in _ORDER[:_ORDER.index("thm:main")] if k not in _DIRECT]
assert all(k in _ancestors("thm:main") for k in _THROUGH)

CHAPTER = {
    "slug": "proofs",
    "num": "A",
    "title": "The proofs",
    "full": "Appendix A: the proofs, in full and in the paper's order",
    "leaf": 14,
    "finding": "The exact equation rests on every result before it in Appendix A, and Theorem 7 needs only two more: the kernel's lemma and the slope of the flat bound.",
    "hero": {
        "aria": "The results whose proofs this appendix collects, listed top to bottom in the paper's order, joined by an arc for each use the claim map records; one result at a time is lit with what it rests on and what uses it",
        "caption": "The results whose proofs this appendix collects, top to bottom in the paper's order, with an arc for each use the claim map records and, on the right, where the paper proves each one. For the result in bold, slate marks what it uses (arcs) and everything those rest on (names), and green marks what uses it. The dots are marked as in the claim map: ink for proved, slate for cited, orange for argued formally.",
        "still": _ORDER.index("thm:main"),
    },
    "readings": [
        ("MaxLookAhead", "the largest mean look-ahead over all costs, in time units, which Corollary 9's proof finds numerically rather than proving it"),
        ("MaxLookAheadCost", "the cost at which that largest look-ahead falls, found the same way"),
    ],
    "intro": r"""
The exact equation rests on every result before it in Appendix A, and Theorem 7 needs only two more: the kernel's lemma and the slope of the flat bound.

This appendix collects every proof in the paper, in the paper's order: the facts and the derivation in {{ref:sec:model}} that the proofs use, the standing facts at the start of {{ref:app:proofs}}, its proofs, and {{ref:app:lopsided}}'s bounds for unequal rewards. Each section says what the result proves, what it assumes, and what it uses, then gives the paper's statement and proof in full and the steps a chapter draws for it, with a link to that chapter's live plate. Where the paper takes a fact from other work, or calls an argument formal, the section says so in the paper's terms. {{ref:rem:speed}} and the extensions of {{ref:sec:extensions}}, which the paper argues without proving, are taught in chapters 5 and 11.

Set the dial to *Exact* or *Both* to read the paper's text; *Plain* shows the steps alone. The picture above walks through the same results, with an arc for each use the claim map records.
""",
}

MAP_LINKS = {}

CHECKS = {}

PLATES = {}

SECTIONS = [
    {
        "id": "facts",
        "title": "Facts the proofs use, from Section 2",
        "blocks": [
            ("md", r"""
{{ref:sec:model}} sets up the model every proof works in. The evidence $X$ is half the log odds of the two answers, and its size $Y = |X|$ is a diffusion reflected at 0, with generator $\Lop = \tfrac12\partial_y^2 + \tanh(y)\,\partial_y$. The chance that the current choice is right, $g(y) = 1/(1 + e^{-2y})$, has no drift while $Y > 0$ ($\Lop g = 0$), its slope is $g'(y) = 1/(2\cosh^2 y)$, and $(\cosh^2 y\,f')' = 2\cosh^2 y\,\Lop f$ for any twice differentiable $f$. The paper states these briefly, and chapter 2 works them out; the equation for $X$ that they start from is cited (Peskir and Shiryaev, 2006, Ch. VI). The excerpt also sets the standing assumption on the cost of time, continuous with $0 < c_{\min} \le c(t) \le c_{\max}$, and defines the value $V(t, y)$.
"""),
            _edges_md("facts"),
            ("exact", "232-250", "The paper's text, in Section 2"),
            ("strip", "identities"),
        ],
    },
    {
        "id": "flat",
        "title": "The flat bound and its slope, from Section 2",
        "blocks": [
            ("md", r"""
For a constant cost $c$, the problem looks the same from every start time, and the best rule stops when $Y$ first reaches a fixed level, $B(c)$. The paper finds the level two ways, from the value's equation with smooth fit and by maximizing the reward of a flat bound, and differentiates the result to get the slope $B'(c)$, which is negative at every cost. These are derivations in the text of {{ref:sec:model}}, not proofs in {{ref:app:proofs}}, but the appendix uses both, among other places: the flat bound in {{ref:lem:structure}}(c), the optimal-stopping fact, {{ref:lem:kernel}}, {{ref:cor:limits}}, {{ref:prop:rule}}, and {{ref:prop:loss}}, and the slope in {{ref:thm:main}} and {{ref:prop:rule}}. The claim map, below, records fewer of these uses.
"""),
            _edges_md("flat"),
            ("exact", "252-267", "The derivation, in Section 2"),
            ("md", "**The bound, two ways.**"),
            ("strip", "routes"),
            ("md", "**Its slope.**"),
            ("strip", "inverse"),
        ],
    },
    {
        "id": "standing",
        "title": "The standing facts, at the start of Appendix A",
        "blocks": [
            ("md", r"""
{{ref:app:proofs}} opens with its standing assumptions: the cost is continuous with $0 < c_{\min} \le c \le c_{\max}$; it is extended to start times in $(-1, \infty)$ by $c(t) = c(0)$ for $t < 0$, so that $t = 0$ is an interior time; and only stopping times with a finite mean need be considered, since any other costs infinitely much. Then come two facts the paper calls standard and uses throughout.

*Strong solutions* is cited: Skorokhod's lemma (Revuz and Yor, 1999, Ch. VI, Lemma 2.1) reflects every continuous path at 0 through a map that is Lipschitz in the supremum norm, and Picard iteration with Gronwall's lemma gives one strong solution from every start. The paper runs every start on the same Brownian motion, so later proofs can compare two starts path by path.

*Optimal stopping* applies a cited theorem, Peskir and Shiryaev's (2006, Ch. I, Thm. 2.2) for continuous gains, through an argument of the paper's own. The theorem assumes $\E\sup_s|G_s| < \infty$, which fails here because the gain is unbounded below, so the paper caps each decision at the flat bound for the lowest cost, $\bar b = B(c_{\min})$, and shows that the cap never lowers the expected gain. The cap uses {{ref:lem:structure}}(b), which the paper proves just after. The conclusion: the first entry into the stopping set, $\tau^*_{t,y}$, is optimal, and the value process $V(t + s, Y_s) - \int_0^s c(t + u)\,du$, stopped there, is a martingale.
"""),
            _edges_md("standing"),
            ("exact", "1267-1271", "The standing assumptions, in Appendix A"),
            ("md", "**Strong solutions.**"),
            ("strip", "strong"),
            ("exact", "1273-1278", "Strong solutions, in Appendix A"),
            ("md", "**Optimal stopping.**"),
            ("strip", "stopping"),
            ("exact", "1280-1292", "Optimal stopping, in Appendix A"),
            ("exact", "305-310|Write", "Where the text relies on it, in Section 3"),
        ],
    },
    {
        "id": "lemma1",
        "title": r"{{ref:lem:structure}}: structure",
        "blocks": [
            ("md", r"""
Four facts that follow from comparison arguments alone: (a) the value of waiting, $V - g$, falls as the evidence rises, so the stopping set at each time is a ray $[b(t), \infty)$; (b) a higher cost gives a lower value and a lower bound; (c) so the bound stays between the flat bounds for the highest and the lowest cost; (d) the value changes with the start time at a rate of at most $c_{\max} - c_{\min}$, for any bounded measurable cost. The proof is the paper's own. Part (a) compares two starts on one Brownian motion, from the strong-solutions fact, and part (c) uses the flat bound.
"""),
            _edges_md("lemma1"),
            ("exact", "293-302", "The statement, in Section 3"),
            ("md", "**Part (a).**"),
            ("strip", "lemma1a"),
            ("md", "**Parts (b) and (c).**"),
            ("strip", "lemma1bc"),
            ("md", "**Part (d).**"),
            ("strip", "lemma1d"),
            ("exact", "1296-1319", "The proof, in Appendix A.1"),
        ],
    },
    {
        "id": "lemma2",
        "title": r"{{ref:lem:envelope}}: the envelope identity",
        "blocks": [
            ("md", r"""
Below the bound, the value is smooth in the evidence and continuously differentiable in time, its slope is 0 at the reflecting center, and two identities hold: $V_t = c(t) - \E_y[c(t + \tau^*_{t,y})]$, and $\Lop V = \E_y[c(t + \tau^*_{t,y})]$, the expected cost at the moment of decision. The first is an envelope argument: hold the optimal decision time from one start fixed, and move the start time. For the smoothness, the paper solves a Dirichlet problem for a uniformly parabolic operator on rectangles inside the continuation set, citing Peskir and Shiryaev (2006, Sec. 7.1) for the method. Campbell and Engelund (2026) give both identities for smooth terminal losses; their hypotheses exclude this model's 0-1 loss, so the paper proves them directly ({{ref:sec:related}}).
"""),
            _edges_md("lemma2"),
            ("exact", "316-325", "The statement, in Section 3"),
            ("strip", "lemma2"),
            ("exact", "1323-1342", "The proof, in Appendix A.2"),
        ],
    },
    {
        "id": "prop3",
        "title": r"{{ref:prop:regularity}}: regularity",
        "blocks": [
            ("md", r"""
Three properties of the bound that the paper proves rather than assumes: (a) the value of waiting, $W = V - g$, grows at least quadratically below the bound, $W(t, y) \ge c_{\min}(b(t) - y)^2$; (b) the bound is Hölder continuous in time with exponent $\tfrac12$; (c) smooth fit: the value's slope meets $g'$ at the bound. Parts (a) and (b) are the paper's own. For (c), the paper says its argument is that of De Angelis and Peskir (2020), specialized to a one-dimensional diffusion whose boundary points are regular by (b): a path started just below the bound crosses it almost at once, by the law of the iterated logarithm.
"""),
            _edges_md("prop3"),
            ("exact", "341-349", "The statement, in Section 3"),
            ("strip", "prop3"),
            ("exact", "1346-1383", "The proof, in Appendix A.3"),
        ],
    },
    {
        "id": "prop4",
        "title": r"{{ref:prop:exact}}: the exact equation",
        "blocks": [
            ("md", r"""
At every time, $\int_0^{b(t)}\cosh^2 y\,\E_y[c(t + \tau^*_{t,y})]\,dy = \tfrac14$: an equation for the bound with no derivative of the bound in it, which, the paper notes, makes it convenient to linearize. The proof is three lines and the paper's own: integrate the second identity of {{ref:lem:envelope}} from the reflecting center to the bound, and use smooth fit, {{ref:prop:regularity}}(c). The paper notes that in Campbell and Engelund's symmetric, infinite-horizon setting with smooth losses, their identities and smooth fit would also give a relation like it; it proves the equation directly for the 0-1 loss.
"""),
            _edges_md("prop4"),
            ("exact", "363-370", "The statement, in Section 3"),
            ("strip", "prop4"),
            ("exact", "1387-1389", "The proof, in Appendix A.4"),
        ],
    },
    {
        "id": "lemma6",
        "title": r"{{ref:lem:kernel}}: two descriptions of the kernel",
        "blocks": [
            ("md", r"""
Fix a constant cost $c_0$ and its flat bound $b_0 = B(c_0)$. The kernel $w$ is the survival flux of the decision time at $b_0$, normalized to total 1. The lemma gives (a) the flux as a series of positive exponentials, (b) a second description, as the law of the decision time when the start is drawn from $\pi_0(y) = 4c_0\cosh^2 y$ on $[0, b_0]$, and (c) the kernel's Laplace transform in closed form. The proof is the paper's own. It uses an $h$-transform to Brownian motion, an expansion in Dirichlet eigenfunctions, an ordinary differential equation for the transform, and the fact that two probability measures with the same Laplace transform are equal; of the paper's other results, it uses only the flat bound's equation {{ref:eq:constant-bound}}. The explicit kernel and its transform are new, to the paper's knowledge.
"""),
            _edges_md("lemma6"),
            ("exact", "395-427", "The definition and the statement, in Section 4.1"),
            ("strip", "lemma6"),
            ("exact", "1393-1413", "The proof, in Appendix A.5"),
        ],
    },
    {
        "id": "theorem7",
        "title": r"{{ref:thm:main}}: the first-order theorem",
        "blocks": [
            ("md", r"""
For a cost $c_0 + \varepsilon\gamma(t)$, with $c_0 > 0$ and $\gamma$ continuous with $|\gamma| \le M$, the bound moves away from $b_0$, to first order in $\varepsilon$, by $\varepsilon B'(c_0)\,(w \star \gamma)(t)$: the slope of the flat bound times the kernel's weighted average of the change still to come. The limit is uniform on bounded time intervals, and on all of $[0, \infty)$ if $\gamma$ is uniformly continuous; for a Hölder continuous $\gamma$ with exponent $\alpha$, the remainder is $O(|\varepsilon|^{1+\alpha})$, uniformly on $[0, \infty)$. The theorem covers small, continuous changes around a constant cost on an infinite horizon; large changes, discontinuous steps, and deadlines lie outside it.

The proof is the paper's own: subtract the exact equations for the two costs, bracket the decision time between the hitting times of two fixed levels, and divide by $\varepsilon$. That the first-order change is a weighted average of the future change is not new: specializing Stojanovic's (1997) perturbation formula to this model at a constant cost formally gives that form. What the paper claims, to its knowledge, is the explicit kernel, its transform, and the proof for this model on an infinite horizon.
"""),
            _edges_md("theorem7"),
            ("exact", "438-449", "The statement, in Section 4.2"),
            ("strip", "theorem7"),
            ("exact", "451-468", "The proof sketch, in Section 4.2"),
            ("exact", "1417-1456", "The proof, in Appendix A.6"),
        ],
    },
    {
        "id": "corollaries",
        "title": r"{{ref:cor:transfer}} and {{ref:cor:limits}}: the transfer function and the limits",
        "blocks": [
            ("md", r"""
Both read the kernel's transform. {{ref:cor:transfer}}: a sinusoidal change in the cost moves the bound, to first order, by a sinusoid of the same frequency, whose swing is $|\tilde w(-i\omega)| < 1$ times the per-moment response's, with a phase lead between $0^\circ$ and $90^\circ$. {{ref:cor:limits}}: (a) very slow changes recover the per-moment rule; (b) the mean look-ahead has a closed form, tends to $\tfrac12$ as time becomes free and to 0 as it becomes expensive, and peaks at about {{MaxLookAhead}}, near $c_0 \approx$ {{MaxLookAheadCost}}, a maximum the paper finds numerically; (c) at high frequency, the swing falls like $\omega^{-1/2}$, and the lead tends to $45^\circ$. Both proofs are the paper's own, from {{ref:lem:kernel}}'s series and transform.
"""),
            _edges_md("corollaries"),
            ("exact", "472-507", "The statements, in Section 4.3"),
            ("md", r"**{{ref:cor:transfer}}.**"),
            ("strip", "transfer"),
            ("md", r"**{{ref:cor:limits}}, parts (a) and (b).**"),
            ("strip", "limits"),
            ("md", r"**{{ref:cor:limits}}, part (c).**"),
            ("strip", "half"),
            ("exact", "1460-1472", "The proofs, in Appendix A.7"),
        ],
    },
    {
        "id": "prop13",
        "title": r"{{ref:prop:rule}}: the weighted rule near a constant cost",
        "blocks": [
            ("md", r"""
The weighted look-ahead rule ({{claim:def:weighted}}) sets its bound by an equation in which the bound appears on both sides. For a cost $c_0 + \varepsilon\gamma$, with $\gamma$ continuous, $|\gamma| \le M$, and $|\varepsilon|$ small, the proposition shows that the equation has exactly one solution in $[B(c_0 + |\varepsilon|M), B(c_0 - |\varepsilon|M)]$ at each time, and that the solution matches the optimal bound to first order. The per-moment rule's error, divided by $\varepsilon$, instead tends to $B'(c_0)(\gamma - w \star \gamma)$, which is identically zero only for a constant $\gamma$. The same proof shows that the averaged-cost rule, $b_{\mathrm{avg}}(t) = B\bigl((w_{c(t)} \star c)(t)\bigr)$, is exact to first order. The proof is the paper's own. For large changes, the paper notes, the equation can have more than one solution.
"""),
            _edges_md("prop13"),
            ("exact", "599-622", "The definition and the statement, in Section 5"),
            ("strip", "prop13"),
            ("exact", "1476-1513", "The proof, in Appendix A.8"),
        ],
    },
    {
        "id": "prop10",
        "title": r"{{ref:prop:loss}}: second-order loss",
        "blocks": [
            ("md", r"""
A bound that misses the optimum loses reward only at second order. Fix a start $y_0 \in [0, b_0)$ and $a > 0$: for all small $\varepsilon$, every policy that stops at a continuous bound within $a|\varepsilon|$ of $b_0$ earns at most $C\varepsilon^2$ less than the optimal policy for the cost $c_0 + \varepsilon\gamma$. The per-moment rule and the weighted look-ahead both qualify, so both lose $O(\varepsilon^2)$. The proof is the paper's own: the value of waiting is at most quadratic near the bound, by smooth fit, and a path spends little time in a thin band next to an absorbing level. How much each rule loses at leading order is {{ref:conj:loss}}, which the paper checks numerically but does not prove. The paper places this proof last in {{ref:app:proofs}}, after that of {{ref:prop:rule}}.
"""),
            _edges_md("prop10"),
            ("exact", "546-552", "The statement, in Section 4.4"),
            ("strip", "loss"),
            ("exact", "1517-1534", "The proof, in Appendix A.9"),
        ],
    },
    {
        "id": "unequal",
        "title": r"{{ref:app:lopsided}}: unequal rewards at a constant cost",
        "blocks": [
            ("md", r"""
When a correct $+$ earns $r_+$ and a correct $-$ earns $r_-$, the problem can't be folded at 0, and the decision maker waits while the evidence lies between two bounds $\ell < h$, around the point $x^*$ where the two choices earn the same. {{ref:app:lopsided}} derives the two bounds for a constant cost: the value's equation integrates once, as for the flat bound, smooth fit at each bound gives one equation, and value matching across the interval gives a third. It takes the waiting region to be an interval around $x^*$ and uses smooth fit at both ends; the paper doesn't prove these separately for unequal rewards ({{ref:prop:regularity}} is for equal rewards). What {{ref:sec:lopsided}} builds on these bounds, one first-order kernel for each bound, is formal: “We have not made it rigorous for unequal rewards.” The claim map's entry covers both parts, and its uses, below, are those of the first-order argument.
"""),
            _edges_md("unequal"),
            ("exact", r"1064-1067||(\cref{app:lopsided}).", "The setting, in Section 7.2"),
            ("strip", "lopsided"),
            ("exact", "1539-1553", "The derivation, in Appendix B"),
        ],
    },
    {
        "id": "map",
        "title": "Where this appendix sits",
        "blocks": [
            ("plain", r"""
None of the map's entries belongs to this appendix: each result above is taught in a chapter, and the map links it there. The map opens on {{ref:thm:main}}, the entry the most others use (""" + str(_THM_USERS) + r""" of them). Pick any entry to see what it uses and what uses it; the picture at the top of this page draws the same uses for the results proved here.
"""),
            ("map", "thm:main"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Where do the proofs use $c_{\min} > 0$?",
                 r"""
The standing assumptions drop stopping times with an infinite mean because their cost is infinite, which needs a cost of at least $c_{\min} > 0$. The optimal-stopping fact caps decisions at $\bar b = B(c_{\min})$, which is finite only for $c_{\min} > 0$ (by {{ref:eq:constant-bound}}, $B(c) \to \infty$ as $c \to 0$), with $\E_y\sigma = \bar b\tanh\bar b - y\tanh y < \infty$. {{ref:lem:structure}}(c) bounds $b(t)$ above by the same $B(c_{\min})$. In {{ref:prop:regularity}}, (a) gives $W \ge c_{\min}(b - y)^2$, which says nothing when $c_{\min} = 0$; the Hölder constant of (b), $\sqrt{(c_{\max} - c_{\min})/c_{\min}}$, is infinite there; and (c) uses that constant. The exact equation and {{ref:thm:main}} rest on smooth fit; {{ref:thm:main}} also needs $c_0 > 0$, so that $c_0 + \varepsilon\gamma$ stays between two positive constants for small $\varepsilon$.
"""),
                (r"Which of the results above does {{ref:thm:main}} use directly, and which only through them?",
                 r"""
By the claim map, directly: """ + "; ".join(_ref(k) for k in _DIRECT) + r""". Only through those: """ + "; ".join(_ref(k) for k in _THROUGH) + r""". So the theorem rests on every result before it on this page. Of the results it uses directly, only {{ref:lem:kernel}} and the slope {{ref:eq:Bprime}} are not already behind the exact equation, which is the finding at the top of the page.
"""),
                (r"Which steps of {{ref:app:proofs}} does the paper attribute to other work?",
                 r"""
Four citations, in the opening facts and in the proofs of {{ref:lem:envelope}} and {{ref:prop:regularity}}: Skorokhod's lemma, for strong solutions (Revuz and Yor, 1999); the optimal-stopping theorem for continuous gains (Peskir and Shiryaev, 2006, Ch. I, Thm. 2.2), applied after the paper's own capping argument; the Dirichlet-problem method behind the smoothness in {{ref:lem:envelope}} (as in Peskir and Shiryaev, 2006, Sec. 7.1); and the smooth-fit argument of {{ref:prop:regularity}}(c), which the paper calls that of De Angelis and Peskir (2020), specialized to this diffusion. The rest of {{ref:app:proofs}} and all of {{ref:app:lopsided}} cite no other work, though they use textbook facts by name (Itô's formula, the law of the iterated logarithm, dominated convergence, and Jensen's inequality, among others).
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The appendix proves every step from scratch.”",
                 r"The paper calls two facts standard and cites them, and it follows De Angelis and Peskir (2020) for smooth fit and Peskir and Shiryaev (2006) for the smoothness in {{ref:lem:envelope}}. Each section above says what is the paper's own."),
                (r"“The proofs cover deadlines and large steps.”",
                 r"The standing assumptions make the cost continuous and keep it between two positive constants, on an infinite horizon; the paper notes that {{ref:lem:structure}}(d) holds for any bounded measurable cost. {{ref:thm:main}}, {{ref:prop:rule}}, and {{ref:prop:loss}} are about small changes around a constant cost. A deadline makes the cost infinite. There, the paper's rules are heuristics, judged by measurement ({{ref:sec:experiments}})."),
                (r"“{{ref:app:lopsided}} proves the rule for unequal rewards.”",
                 r"It derives the two bounds for a constant cost. The first-order argument for unequal rewards in {{ref:sec:lopsided}}, one kernel for each bound, is formal; the paper checks it numerically."),
            ]),
        ],
    },
]
