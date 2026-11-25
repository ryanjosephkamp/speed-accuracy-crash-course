"""Appendix B: the numerics. The companion to the paper's Appendix C ("Numerical details"): Table 11's parameters, row
by row; the two reference programs, the evidence grid and the belief grid, with a plate that solves the belief grid at
a constant cost for six numbers of bins; how a forced choice moves the bound before it, with a plate; the two ways the
paper computes kernels; and the seeds, precision, and tests. Grid refinement (Table 12) and the 30-versus-300 updates
check are taught in chapter 9's last section and chapter 8's updates plate, and linked from here.

Table 11 is typed in main.tex rather than generated, so its rows are read from main.tex when the page is built,
with chapter 9's parser (ch09._params_rows), and each row's note is keyed by the row's first cell: a change in the
table's rows fails the build here instead of drifting.
"""
import importlib.util
import json
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_MAP = json.loads((_HERE / "map.json").read_text())
_NODES, _EDGES = _MAP["nodes"], _MAP["edges"]


def _load(name):
    spec = importlib.util.spec_from_file_location(f"appB_{name}", _HERE / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_CH09 = _load("ch09")
_HEAD, _ROWS, _A, _B = _CH09._params_rows()

# what each of Table 11's rows means, keyed by its first cell as the build reads it; {2}, {3}, {4}, {5} are the row's
# own cells (time step, evidence step, horizon, other), so no value is typed twice
_NOTES = {
    "Table 1": "The sinusoid test of chapter 9, at $c_0 = 0.1$. Its reference is a program over beliefs, stepped back from the forced choice (the next section); it has no evidence step, hence the dash. The fit covers whole periods from $t = 2$ (at least two periods and at least 6 time units), and the choice is forced 6 time units after the fit ends. The fitted curve is the bound's deviation from $b_0$; in the paper's code, $b_0$ comes from the same program at the constant cost, with the same forced choice.",
    "Table 2": "The sweep of chapter 9, on an evidence grid with half the main evidence step. The fit runs over $2 < t < 2 + 2\\pi$, and the fitted curve is again the bound's deviation from $b_0$, which the paper's code computes with the same program and the same forced choice, at {4}.",
    "Random schedules": "Chapter 10's development and held-out schedules, on the main evidence grid, with the choice forced at $t = 10$ for schedules without a deadline and at the deadline otherwise. The program reports a bound as infinite when its first stopping point on the grid lies above $|x| = 8$.",
    "Table 8": "The check of the loss formula in chapter 10. The predicted loss sums over the grid times, leaving out the last one, $t = 10$, where the scorer forces every undecided trial to choose whatever either bound says, so a gap between the bounds there costs nothing.",
    "Table 9": "How the loss scales with the size of the change, in chapter 10: one base cost and one shape. The paper scores each size on this grid and again on one twice as fine in time and space.",
    "Table 10": "Unknown reliability, in chapter 11. Its reference is a program over beliefs of a different kind (the drift is drawn once per trial and never revealed), with a time step of {2}; the rules and that reference are scored on an evidence grid of {3} up to a cap, averaged over the unknown drift at a fixed set of quadrature nodes.",
    "Unequal rewards, sinusoid": "Unequal rewards, in chapter 11: the two bounds are no longer mirror images, so the program reports both. The window is that of Table 1, and each fitted curve is a bound's deviation from the same program's bound at the constant cost.",
    "Unequal rewards, random": "Unequal rewards on random schedules, drawn with seed 2027.",
}
assert [r[0] for r in _ROWS] == list(_NOTES), [r[0] for r in _ROWS]


def _params_md():
    items = []
    for r in _ROWS:
        note = _NOTES[r[0]].format(*r)
        items.append(f"- **{r[0]}**: {r[1]}; {_HEAD[2]} {r[2]}, {_HEAD[3]} {r[3]}; {_HEAD[4].lower()} {r[4]}; {r[5]}. {note}")
    return (f"**Table 11's rows**, read from main.tex at the book's tag (lines {_A}–{_B}) when this page is built: the "
            "experiment, its reference policy, the time step, the evidence step, the horizon, and anything else, each "
            "with what it means.\n\n" + "\n".join(items))


def _users(cid):
    return [b for a, b in _EDGES if a == cid]


def _uses(cid):
    return [a for a, b in _EDGES if b == cid]


assert sorted(_uses("app:numerics")) == ["alg:weighted", "method:scoring"] and not _users("app:numerics")

CHAPTER = {
    "slug": "numerics",
    "num": "B",
    "title": "The numerics",
    "full": "Appendix B: the numerics, the grids, the horizons, and how stable the numbers are",
    "leaf": 15,
    "finding": "At a constant cost on this page's grid, the bound is more than 0.001 from its value with 30 time units left only in a last stretch, shorter at each higher cost.",
    "hero": {
        "aria": "The best bound on this page's grid against time, with the choice forced at time 10, at three constant costs; for the cost in ink, a dashed line marks the earliest check where the bound is more than 0.001 below its value with 30 time units left",
        "caption": r"""The best bound on this page's evidence grid (a check every 0.01 time units, an evidence step of 0.02), at constant costs of 0.02, 0.1, and 0.5, with the choice forced at time 10, as in the paper's main experiments. For the cost in ink, the dashed line marks the earliest check, in trial time, where the bound is more than 0.001 below its value with 30 time units left; it is more than 0.001 below at every later check. All computed in the page.""",
        "still": 0,
    },
    "readings": [
        ("HorizonFloor", "points per 100 trials the constant-cost bound, moved in for checking every Δt, loses at a cost of 0.02 against the best policy with the choice forced at t = 10"),
        ("GridPmMaxChange", "the most a per-moment loss moves from the paper's grid to the finest of four (points per 100 trials)"),
    ],
    "intro": r"""
At a constant cost on this page's grid, the bound is more than 0.001 from its value with 30 time units left only in a last stretch, shorter at each higher cost.

That is this page's own measurement, on its last plate, not a result of the paper. This appendix is the book's companion to {{ref:app:numerics}}, "Numerical details". {{ref:tab:params}} lists, experiment by experiment, which program computes the reference, with which time step $\Delta t$, which evidence step $h$, and which horizon. The sections below read that table row by row, set the two kinds of program side by side on a plate, measure on a second plate how a forced choice moves the bound before it, and say how the paper computes its kernels, seeds its random schedules, and tests its code. How much the losses move on finer grids ({{ref:tab:grid}}) and what 300 updates of the weighted rule change are taught in [chapter 9](../measures/index.html#numerics) and [chapter 8](../rule/index.html#fixed-point), with plates on your schedule.

The plates run at a constant cost, on this page's grid, which is coarser than the paper's; the captions say what each one computes.
""",
}

MAP_LINKS = {}

CHECKS = {
    "bins": ["bins", "state", "words"],
    "horizon": ["horizon", "state", "words"],
}

PLATES = {
    "bins": {
        "title": "The belief grid's bins",
        "state": "computed",
        "state_text": "Computed in the page: the belief grid's program for six numbers of bins, beside the evidence grid's",
        "caption": r"""At the constant cost you pick, from 0.01 to 1: the program over beliefs, with the beliefs at the midpoints of $n$ equal bins on $(0, 1)$ for $n$ = 25, 50, 100, 200, 400, and 800, stepped back 30 time units from a forced choice with a check every 0.01 time units, as the paper's code steps back for {{ref:tab:sinusoid}} (there with a time step of 0.002 and a cost that changes). Its bound at the start is read between bins and turned into evidence. Top: that bound for each $n$ (dots; the larger one is the $n$ you pick), beside the evidence grid's program with the same check and 30 time units left, on an evidence step of 0.02 (ink line), and $B(c)$, the bound for watching continuously (dashed). Bottom: the midpoints of the chosen $n$ bins that have positive evidence, placed in evidence up to the axis's end, with the belief grid's bound (dot) and the evidence grid's (line). While a new cost is solving, the plate shows nothing from the old one.""",
        "wide": False,
    },
    "horizon": {
        "title": "The bound before the forced choice",
        "state": "computed",
        "state_text": "Computed in the page: the evidence grid's program at a constant cost, with the choice forced at your time",
        "caption": r"""At the constant cost you pick, from 0.01 to 1, on this page's evidence grid (a check every 0.01 time units, an evidence step of 0.02, bounds capped at 5): the best bound with the choice forced at the time you pick, from 2 to 20 (ink), and its value with 30 time units left (dashed). At a constant cost the program's step back is the same at every time, so the bound depends only on the time left; the page solves once with the choice forced at 30 and reads the bound for every earlier forced choice from it. After you guess or press Show me, the dashed orange line marks the earliest check, in trial time, where the bound is more than 0.001 from its value with 30 time units left; when that is already so at $t = 0$, a note says so instead. The readings give the time left at that check, and the same for a second tolerance, 0.01. While a new cost is solving, the plate shows nothing from the old one.""",
        "wide": False,
    },
}

STRIPS = {}

SECTIONS = [
    {
        "id": "params",
        "title": "The parameters behind each experiment",
        "blocks": [
            ("plain", r"""
{{ref:tab:params}} lists, for each experiment, the program that computes its reference, the best policy for a gridded problem in which the choice is forced at a last moment, and that program's grid. Its caption names two kinds of program. The *evidence grid* is chapter 9's: the dynamic program and the scorer on a grid of evidence values $h$ apart, checking the evidence every $\Delta t$ ({{ref:sec:methods}}). The *belief grid* is backward induction over bins of the posterior belief. The horizon is the time of the forced choice.
"""),
            ("exact", "1575-1597", "The table's caption, in Appendix C"),
            ("md", _params_md()),
            ("plain", r"""
The rows compare different things. Tables 1 and 2 and the unequal-reward sinusoid fit a sinusoid to the bound's deviation from its value at the constant cost, over a window that ends before the forced choice. The rows on random schedules and Tables 8 to 10 compare rules by their losses, differences in expected reward, scored up to the forced choice.
"""),
            ("exact", "1558-1559||main evidence grid.", "Where the main grid is given, in Appendix C"),
        ],
    },
    {
        "id": "programs",
        "title": "Two kinds of reference program",
        "blocks": [
            ("plain", r"""
Both kinds of program compute the best policy for the same evidence, checked every $\Delta t$, and both step back from the forced choice. They differ in what they keep track of.

The **evidence grid** keeps the evidence $x$ itself, on points $h$ apart. One step back, the value of waiting at $x$ is the average of the next step's value over a Gaussian step with mean $+\Delta t$ or $-\Delta t$, weighted by the belief $g(x)$ that the drift is $+1$: a mixture of two convolutions. [Chapter 9](../measures/index.html#reference) runs it on your schedule.

The **belief grid** keeps the belief $g$, the chance that the drift is $+1$, at the midpoints of $n$ equal bins on $(0, 1)$. Its step from one bin to another comes from the same two Gaussian steps: turn the two beliefs into evidence, $x = \tfrac12\log\bigl(g/(1 - g)\bigr)$, take the mixture of the two evidence densities for that step, weighted by the current belief, and change variables from evidence to belief; each row is then scaled to sum to 1. {{ref:app:numerics}} uses 800 bins for the sinusoid test. The program's bound is the first bin above $\tfrac12$ where deciding beats waiting, read between bins.

Equal bins in belief are not equal in evidence. The evidence $x$ has slope $1/\bigl(2g(1 - g)\bigr)$ in the belief, so a small bin of width $1/n$ near a belief $g$ covers about $1/\bigl(2n\,g(1 - g)\bigr)$ of evidence: about $2/n$ near $\tfrac12$ and about $50/n$ near 0.99. Two parts of the program depend on the bins: its step from bin to bin, which samples the step's density at the bins' midpoints, and its bound, read between two bins. The plate solves both kinds of program at a constant cost, with 30 time units left, for six numbers of bins.
"""),
            ("plate", "bins"),
            ("plain", r"""
At the default cost of 0.02, the belief grid's bound with 25, 50, or 100 bins is more than 0.1 below the evidence grid's. With 800 bins, the two are within 0.01 of each other at every cost on the slider, and with 50 bins, at every cost from 0.1 to 1. The evidence grid's bound is below $B(c)$ at every cost on the slider; [chapter 9](../measures/index.html#monitoring) measures the shift for checking at intervals.
"""),
            ("exact", "1559-1561|The dynamic program over|the two evidence densities.", "The belief grid, in Appendix C"),
            ("limits", r"""
**What the plate shows.** Two kinds of program for the same constant cost, with 30 time units left, on this page's time step, against the number of bins. It doesn't show the paper's runs, which use a time step of 0.002 and costs that change; the paper doesn't report how its belief grid's bound moves with the number of bins.
"""),
        ],
    },
    {
        "id": "horizon",
        "title": "The horizon",
        "blocks": [
            ("plain", r"""
The paper's theorems have no last moment. A program needs one, so each experiment forces the choice at a time given in {{ref:tab:params}}'s horizon column. Close to the forced choice, waiting has little left to gain, so the bound comes down, to 0 at the forced choice itself.

At a constant cost, the program's step back is the same at every time, so the bound depends only on the time left before the forced choice, and a later forced choice moves the whole curve later by the same time. The plate measures, at each cost, the time left at which the bound is last more than 0.001 from its value with 30 time units left. Guess first, at the default cost of 0.05.
"""),
            ("plate", "horizon"),
            ("plain", r"""
Over the slider's costs, that time left is longer at each lower cost. The paper measures one effect of its own horizon: at a constant cost of 0.02, the constant-cost bound, moved in for checking every $\Delta t$, loses {{HorizonFloor}} points per 100 trials against the best policy with the choice forced at 10, both scored with the choice forced at 10.
"""),
            ("limits", r"""
**What the plate measures, and what it can't show.** The time left at which the bound is last more than 0.001, or 0.01, from its value with 30 time units left, at a constant cost, on this page's grid; not the distance from an infinite horizon. For a cost that changes, it also depends on the costs near the end, which the plate doesn't show. The plate scores no losses.
"""),
        ],
    },
    {
        "id": "kernels",
        "title": "Kernels, two ways",
        "blocks": [
            ("plain", r"""
The weighted rule ({{ref:alg:weighted}}, [chapter 8](../rule/index.html#fixed-point)) averages the per-moment bounds ahead, $B(c(t + s))$, with the kernel for its own level at each update. For known reliability, the paper computes that kernel from the eigenfunction series of the survival flux at the flat bound, a sum of exponentials ({{ref:lem:kernel}}, [chapter 6](../kernel/index.html#weights)). For unknown reliability, where the paper carries the kernel over formally ([chapter 11](../extensions/index.html#carried)), it computes the kernel from a finite-difference generator on 240 interior nodes. The paper's repository tests the series against its Laplace transform.
"""),
            ("exact", "1562-1564|Kernels for the weighted|on 240 interior nodes.", "The kernels, in Appendix C"),
        ],
    },
    {
        "id": "rest",
        "title": "Precision, seeds, propagation, and tests",
        "blocks": [
            ("plain", r"""
Every computation is in double precision. Every random schedule comes from a fixed seed: 2026 for the development schedules, 20261111 for the held-out set, 2027 for unequal rewards, and 7 for the loss check, so a rerun draws the same schedules. The decision-time distributions behind the loss check are not sampled: they come from the same forward propagation of the evidence density that scores every rule ([chapter 9](../measures/index.html#scoring)). The repository's tests check the constant-cost bounds against the dynamic programs, the scorer against simulated trials, and the kernel series against its Laplace transform.

The rest of {{ref:app:numerics}} is grid refinement: eight development schedules rescored on four grids, which move the per-moment losses by at most {{GridPmMaxChange}} and the weighted ones by at most {{GridWbMaxChange}} points per 100 trials from the paper's grid to the finest, and 300 updates of the weighted rule instead of 30. The paper calls the first empirical stability, not an error bound. [Chapter 9's last section](../measures/index.html#numerics) draws {{ref:tab:grid}} and rescores your schedule on three grids; [chapter 8](../rule/index.html#fixed-point) runs the updates on your schedule.
"""),
            ("exact", "1561-1562|The decision-time|as the scoring.,1564-1573|Random schedules use|", "Propagation, seeds, tests, and grid refinement, in Appendix C"),
        ],
    },
    {
        "id": "map",
        "title": "Where this appendix sits",
        "blocks": [
            ("plain", r"""
The claim map's entry for the numerical details is chapter 9's, and the map opens on it. It uses the scoring of chapter 9 and {{ref:alg:weighted}} of chapter 8, and no other entry uses it.
"""),
            ("map", "app:numerics"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why does {{ref:tab:params}}'s first row have no evidence step?",
                 r"""
Its reference is the program over beliefs, whose state is a bin of the posterior belief, not a point of an evidence grid. Its resolution is set by the number of bins, 800, instead.
"""),
                (r"At a constant cost, why does one solve with the choice forced at 30 give the bound for every earlier forced choice?",
                 r"""
The program's step back uses the cost only through $c\,\Delta t$, which is the same at every time when the cost is constant. So the value $j$ steps before the forced choice is the same function of the evidence whatever the forced choice's time, and so is the bound. With the choice forced at $T$, the bound at $t$ is the bound with $T - t$ left, read from the long solve. For a cost that changes, this fails: the steps differ, and each forced choice needs its own solve.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The forced choice at 10 is part of the model.”",
                 r"The theorems have no last moment; the forced choice at 10 is how the program ends for schedules without a deadline. The fits of Tables 1 and 2 end before their forced choices, while the losses on random schedules are scored up to the forced choice. The paper reports its effect at a constant cost of 0.02 ({{HorizonFloor}} points per 100 trials for the constant-cost bound, moved in for checking every $\Delta t$), and in {{ref:tab:loss}}'s check, where at the smallest size of each family most of the weighted rule's predicted loss comes from $t > 8$."),
                (r"“The belief grid and the evidence grid are two models.”",
                 r"They are two programs for the same problem, the evidence checked every $\Delta t$: one keeps the belief in bins, the other the evidence on points. On the first plate, with 800 bins and 30 time units left, their bounds are within 0.01 of each other at every cost on the slider."),
            ]),
        ],
    },
]
