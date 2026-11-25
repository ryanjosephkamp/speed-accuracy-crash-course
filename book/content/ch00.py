"""Chapter 0: how to read this book. It has no claims of its own; it sets up the reader's schedule and shows each
of the book's habits once. The three lists of claims by status are built from the claim map, so they can't drift
from it.
"""
import json
from pathlib import Path

_MAP = json.loads((Path(__file__).resolve().parent / "map.json").read_text())["nodes"]


def _by(statuses):
    ids = [k for k, n in _MAP.items() if n["status"] in statuses]
    ids.sort(key=lambda k: (_MAP[k]["ch"], _MAP[k]["depth"], k))
    return ids


def _items(ids, show_status=False):
    out = []
    for k in ids:
        n = _MAP[k]
        tail = f" ({n['statusLabel'].lower()}, chapter {n['ch']})" if show_status else f" (chapter {n['ch']})"
        out.append(f"- {{{{claim:{k}}}}}{tail}")
    return "\n".join(out)


_PROVED = _by({"proved"})
_ARGUED = _by({"formal", "conjecture", "computed"})
_MEASURED = _by({"numerical"})
_REST = [k for k in _MAP if k not in set(_PROVED + _ARGUED + _MEASURED)]
_DEFS = [k for k in _REST if _MAP[k]["status"] == "definition"]
_CITED = [k for k in _REST if _MAP[k]["status"] == "cited"]
assert len(_DEFS) + len(_CITED) == len(_REST), "a status the lists don't cover"

CHAPTER = {
    "slug": "start",
    "num": 0,
    "title": "How to read this book",
    "full": "How to read this book",
    "leaf": 1,
    "finding": "The book's chapters work on a cost schedule you choose, set plain words beside the paper's own, and ask for your guess before they show an answer.",
    "hero": {
        "aria": "Four cost schedules in turn, each with the best bound solved in the page and the per-moment rule's bound beneath it",
        "caption": "Figure 1's four schedules, one at a time: the cost of time (orange) and, beneath it, the best bound from a dynamic program solved in this page (ink) beside the per-moment rule's bound (dashed).",
        "still": 0,
    },
    "readings": [
        ("HeldCount", "held-out schedules the paper's rules were run on once, fixed in advance"),
        ("MaxLookAhead", "the most the best bound looks ahead on average, at any cost (time units, found numerically)"),
    ],
    "intro": r"""
The book's chapters work on a cost schedule you choose, set plain words beside the paper's own, and ask for your guess before they show an answer. This chapter sets up those habits once, so the later chapters can use them without stopping to explain.

The book follows the paper *Waiting, weighted* one result at a time. Each result gets a plain statement and the paper's exact text; most also get a live plate, computed in this page from the paper's equations, and questions with worked answers. A check script holds the plates' computations to the paper's generated numbers and to its code, and to identities they must satisfy; the line under each plate says how many of those checks pass.
""",
}

MAP_LINKS = {}

CHECKS = {"schedule": ["schedule"], "guess": ["guess", "words"], "flat": ["flat", "words"]}

PLATES = {
    "schedule": {
        "title": "Your schedule",
        "state": "computed",
        "state_text": "Computed in the page: the best bound by dynamic programming on a grid",
        "caption": r"""Top: the cost of time, on a log scale (orange). Bottom: the best bound for it (ink), from a dynamic program that checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window (or ends at a deadline), and the per-moment rule's bound, $B(c(t))$ moved in by the same check's shift (dashed). Draw your own by dragging across the top chart.""",
        "wide": True,
    },
    "guess": {
        "title": "Where is the bound?",
        "state": "computed",
        "state_text": "Computed in the page: the best bound by dynamic programming on a grid",
        "caption": r"""Your schedule's cost (top) and the per-moment rule's bound (dashed). Drag the orange marker to where you think the best bound sits at the marked moment, then press Show me: the best bound (ink) is drawn from the same dynamic program as the schedule's plate, with your miss beside it.""",
        "wide": False,
    },
    "flat": {
        "title": "Waiting meets deciding",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""For a constant cost $c$, with $Y = |X|$ the size of the evidence. Step 1: the value of deciding now, $g(y)$, and the value of continuing until the best flat bound $b = B(c)$, which is $V(y) = g(b) - c\,(b\tanh b - y\tanh y)$ below the bound. Step 2: $\cosh^2 y\,V'(y) = c\,(y + \tfrac12\sinh 2y)$ below the bound (solid), and the same formula continued past it (faint), where $V = g$ instead. Step 3: the formula meets $\cosh^2 y\,g'(y) = \tfrac12$ at $y = B(c)$, which is the equation.""",
        "wide": False,
    },
}

STRIPS = {
    "flat": {
        "plate": "flat",
        "steps": [
            ("While the decision maker waits, the value obeys one equation.",
             r"Below the bound, $\class{lit}{\mathcal{L}V = c}$ with $V'(0) = 0$, where $\mathcal{L} = \tfrac12\partial_y^2 + \tanh(y)\,\partial_y$ is the generator of $Y = |X|$."),
            ("Multiply by $2\cosh^2 y$, and the equation integrates once.",
             r"Since $(\cosh^2 y\,f')' = 2\cosh^2 y\,\mathcal{L}f$ for any smooth $f$: $(\cosh^2 y\,V')' = 2c\cosh^2 y$, so $\class{lit}{\cosh^2 y\,V'(y) = c\,(y + \tfrac12\sinh 2y)}$."),
            ("At the bound, waiting and deciding meet with the same slope.",
             r"Smooth fit, $V'(b) = g'(b) = \dfrac{1}{2\cosh^2 b}$, turns step 2 into $c\,(b + \tfrac12\sinh 2b) = \tfrac12$, which is $\class{lit}{\sinh(2b) + 2b = 1/c}$."),
        ],
    },
}

SECTIONS = [
    {
        "id": "schedule",
        "title": "Your schedule",
        "blocks": [
            ("plain", r"""
The paper asks what the best decision rule does when the cost of time changes. A decision maker watches noisy evidence pile up and chooses once the net evidence reaches a *bound*: a higher bound means slower, more accurate choices. Each moment spent deciding costs $c(t)$, in the same units as the reward for a correct choice, and a *schedule* says how that cost changes over the trial. Time is measured in units of $\sigma^2/\mu^2$, so the evidence drifts at rate $+1$ or $-1$, depending on which choice is correct, with noise of variance 1 per unit time.

Pick one of the book's ten schedules, or choose Draw your own and drag across the top chart. Your browser keeps the choice for every page of the book, and each chapter works on it.

Under the schedule is the best bound for it, solved in this page: a dynamic program steps back from a choice forced six time units past the window (or at a deadline), on an evidence grid, the way the paper computes its reference policy (chapter 9). At the ten schedules' starting settings, its bound agrees with the paper's own code to within $10^{-6}$, the check's tolerance. It approximates the paper's bound, which watches the evidence continuously on an infinite horizon: checking only every $\Delta t = 0.01$ moves a constant-cost bound in by about $0.5826\sqrt{\Delta t}$, to leading order, and chapter 9 covers the grid and the horizon. A bound below the grid's first step, 0.02, reads as 0, as in the paper's code; that happens at costs above about 3. The dashed curve is the per-moment rule's bound, the shortcut chapter 1 starts from, moved in by the same $0.5826\sqrt{\Delta t}$.
"""),
            ("plate", "schedule"),
        ],
    },
    {
        "id": "dial",
        "title": "Plain words, or the paper's",
        "blocks": [
            ("md", r"""
The dial at the top of every page sets how much of the paper's text you see. *Plain* shows the book's own words. *Exact* shows the paper's text for the same result, quoted from its source with line numbers. *Both* shows the two together. Try it on the rule chapter 1 starts from.
"""),
            ("plain", r"""
At each moment, the per-moment rule uses the bound that would be best if the current cost of time lasted forever: $b_{\mathrm{pm}}(t) = B(c(t))$, where $B(c)$ is the best bound for a constant cost $c$. It is exact when the cost is constant, but it doesn't look at what the cost will do next.
"""),
            ("exact", "115-125|A natural shortcut|ignores the future.", "The paper's words, in its introduction"),
        ],
    },
    {
        "id": "guess",
        "title": "Guess, then look",
        "blocks": [
            ("md", r"""
Each chapter asks for a guess before it shows an answer, because an answer means more when you've committed to something first. Nothing waits on the guess: *Show me* always works. Here is the first one, on your schedule. The per-moment rule's bound is drawn; where does the best bound sit at the marked moment? Drag the orange marker, then press Show me.
"""),
            ("plate", "guess"),
            ("plain", r"""
Whether you guessed above or below the dashed curve depends on what your cost does after the marked moment. A decision still open when the cost changes pays the new cost, so the best bound can start moving before the cost does. One case follows from the paper's results, as an exercise in chapter 5 (the paper doesn't state it): when the cost never falls after a moment, the best bound at that moment sits at or below the per-moment one. Chapter 6 says how far ahead the bound looks.
"""),
        ],
    },
    {
        "id": "proof",
        "title": "A proof, a step at a time",
        "blocks": [
            ("md", r"""
Each proof in the book is a strip of steps. Move through them with the slider or the buttons, and the plate beside the proof draws what each step is about; the terms a step changes are lit. This one is a short derivation from the paper: why the best bound for a constant cost $c$ solves $\sinh(2b) + 2b = 1/c$. Chapter 3 goes through it properly.
"""),
            ("strip", "flat"),
            ("exact", "252-262||mean decision time.", "The paper's derivation"),
        ],
    },
    {
        "id": "map",
        "title": "Where each result is taught",
        "blocks": [
            ("md", r"""
The map below has 50 entries from the paper: definitions, lemmas, propositions, one theorem, corollaries, a conjecture, measurements, and the statements its discussion makes (an entry can group a few statements). It draws each entry and the entries it uses. Each chapter lights its own part of the map, and once a chapter is built, its claims link to the sections that teach them. Pick the drawing you like; your browser keeps it.
"""),
            ("map", "thm:main"),
        ],
    },
    {
        "id": "status",
        "title": "What the paper proves, and what it doesn't",
        "blocks": [
            ("md", r"""
Not every sentence in the paper is a theorem, and the book keeps the kinds apart. Each entry in the map has a status. The proofs are for the paper's model under its standing assumption: a cost of time that is continuous and stays between two positive constants, on an infinite horizon, with equal rewards for the two choices. Within that, the hypotheses differ: Theorem 7 and Proposition 13 are about small changes around a constant cost, to first order in the size of the change; Lemma 6 and Corollaries 8 and 9 describe the kernel at a constant cost, exactly; and Proposition 10 bounds a reward loss at second order.
"""),
            ("md", "**Proved** (" + str(len(_PROVED)) + "):\n\n" + _items(_PROVED)),
            ("md", "**Argued formally, conjectured, or computed from closed forms, but not proved** (" + str(len(_ARGUED)) + "):\n\n" + _items(_ARGUED, True)),
            ("md", "**Measured, and the numerical methods behind the measurements** (" + str(len(_MEASURED)) + "): on the dynamic program, on random schedules, or by the paper's code.\n\n" + _items(_MEASURED)),
            ("md", r"""
The other """ + str(len(_REST)) + r""" entries are definitions and statements of scope (""" + str(len(_DEFS)) + r"""), and entries that rest on other work or compare the paper with it (""" + str(len(_CITED)) + r"""). The prediction about urgency signals is on the second list: the paper argues it from the first-order theory, but it is not a theorem.
"""),
        ],
    },
]
