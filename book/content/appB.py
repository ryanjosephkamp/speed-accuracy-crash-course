"""Appendix B: the numerics. The companion to the paper's Appendix C ("Numerical details"): Table 11's parameters, row
by row; the two reference programs, the evidence grid and the belief grid, with a plate that solves the belief grid at
a constant cost for six numbers of bins; how far back a forced choice moves the bound, with a plate; the two ways the
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
    "Table 1": "The sinusoid test of chapter 9, at $c_0 = 0.1$. Its reference is the program over beliefs (the next section), which has no evidence step, hence the dash. The fit covers whole periods from $t = 2$ (at least two periods and at least 6 time units), and the choice is forced 6 time units after the fit ends: the last plate on this page measures how far back a forced choice moves the bound.",
    "Table 2": "The sweep of chapter 9, on an evidence grid with half the main evidence step. The fit runs over $2 < t < 2 + 2\\pi$, which ends before the forced choice at {4}.",
    "Random schedules": "Chapter 10's development and held-out schedules, on the main evidence grid, with the choice forced at {4} if the schedule has no deadline and at its deadline otherwise. Bounds are capped at $|x| = 8$: a bound above the cap is reported as infinite, with no stop on the grid.",
    "Table 8": "The check of the loss formula in chapter 10. The predicted loss sums over the grid times, leaving out the last one, $t = 10$, where the scorer forces every undecided trial to choose whatever either bound says, so a gap between the bounds there costs nothing.",
    "Table 9": "How the loss scales with the size of the change, in chapter 10: one base cost and one shape, scaled.",
    "Table 10": "Unknown reliability, in chapter 11: a program over beliefs of a different kind (the drift is drawn once per trial and never revealed), with a time step of {2}. Its scorer follows the evidence on a grid of {3} up to a cap, and averages over the unknown drift at a fixed set of quadrature nodes.",
    "Unequal rewards, sinusoid": "Unequal rewards, in chapter 11: the evidence can't be folded at 0, so the program follows it on both sides and reports two bounds. The window is that of Table 1.",
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
    "finding": "A forced choice moves the program's bound only over a stretch of time before it, and that stretch is shorter the higher the cost of time.",
    "hero": {
        "aria": "The best bound on this page's grid against time, with the choice forced at time 10, at three constant costs; for the cost in ink, a dashed line marks where the bound first falls 0.001 below its long-horizon value, counting back from the forced choice",
        "caption": r"""The best bound on this page's evidence grid (a check every 0.01 time units, an evidence step of 0.02), at constant costs of 0.02, 0.1, and 0.5, with the choice forced at time 10, as in the paper's main experiments. For the cost in ink, the dashed line marks the last time, counting back from the forced choice, at which the bound is more than 0.001 from its value with 30 time units left. All computed in the page.""",
        "still": 0,
    },
    "readings": [
        ("HorizonFloor", "points per 100 trials the constant-cost bound loses at a cost of 0.02 because the choice is forced at t = 10"),
        ("GridPmMaxChange", "the most a per-moment loss moves from the paper's grid to the finest of four (points per 100 trials)"),
    ],
    "intro": r"""
A forced choice moves the program's bound only over a stretch of time before it, and that stretch is shorter the higher the cost of time.

This appendix is the book's companion to {{ref:app:numerics}}, "Numerical details". Every loss in the paper is measured against a reference policy computed on a grid with a last moment, and {{ref:tab:params}} lists, experiment by experiment, which program, which time step $\Delta t$, which evidence step $h$, and which horizon. The sections below read that table row by row, set the two reference programs side by side on a plate, measure on a second plate how far back a forced choice reaches, and say how the paper computes its kernels, seeds its random schedules, and tests its code. How much the losses move on finer grids ({{ref:tab:grid}}) and what 300 updates of the weighted rule change are taught in [chapter 9](../measures/index.html#numerics) and [chapter 8](../rule/index.html#fixed-point), with plates on your schedule.

Everything here is a measurement on a grid. The plates run at a constant cost, on this page's grid, which is coarser than the paper's; the captions say what each one computes.
""",
}

MAP_LINKS = {}

CHECKS = {
    "bins": ["bins", "words"],
    "horizon": ["horizon", "words"],
}

PLATES = {
    "bins": {
        "title": "The belief grid's bins",
        "state": "computed",
        "state_text": "Computed in the page: the belief grid's program for six numbers of bins, beside the evidence grid's",
        "caption": r"""At the constant cost you pick, from 0.01 to 1: the program over beliefs, with the beliefs at the midpoints of $n$ equal bins on $(0, 1)$ for $n$ = 25, 50, 100, 200, 400, and 800, solved by value iteration (each sweep one step of 0.01 time units, stopped once no value moves by more than $0.001\,\Delta t$), as the paper's code does; the bound is read between bins and turned into evidence. Top: its bound for each $n$ (dots; the larger one is the $n$ you pick), beside the evidence grid's program at the same time step with an evidence step of 0.02 (ink line; the choice forced 30 time units ahead, its bound read at the start), and $B(c)$, the bound for watching continuously (dashed). Bottom: the $n$ bins above $\tfrac12$, placed in evidence, with the belief grid's bound (dot) and the evidence grid's (line). The paper's belief grid for {{ref:tab:sinusoid}} has 800 bins and a time step of 0.002; this plate uses 0.01.""",
        "wide": False,
    },
    "horizon": {
        "title": "How far back the forced choice reaches",
        "state": "computed",
        "state_text": "Computed in the page: the evidence grid's program at a constant cost, with the choice forced at your time",
        "caption": r"""At the constant cost you pick, from 0.01 to 1, on this page's evidence grid (a check every 0.01 time units, an evidence step of 0.02, bounds capped at 5): the best bound with the choice forced at the time you pick, from 2 to 20 (ink), and its value with 30 time units left (dashed). At a constant cost the program's step back is the same at every time, so the bound depends only on the time left; the page solves once with the choice forced at 30 and reads the bound for every earlier forced choice from it. Once you guess, or press Show me: the dashed orange line marks the last time, counting back from the forced choice, at which the bound is more than 0.001 from its value with 30 time units left. The readings give that stretch, and the same for 0.01.""",
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
Every experiment in the paper scores rules against a reference: the best policy for a gridded problem with a last moment, where the choice is forced. {{ref:tab:params}} says, for each experiment, which program gives that reference and on which grid. Two programs appear. The *evidence grid* is chapter 9's: the dynamic program and the scorer on a grid of evidence values $h$ apart, checking the evidence every $\Delta t$ ({{ref:sec:methods}}). The *belief grid* is backward induction over bins of the posterior belief, which needs no evidence step. The horizon is when the choice is forced: at a fixed time, at a deadline, or a fixed time after the window a test fits over.
"""),
            ("md", _params_md()),
            ("plain", r"""
Two patterns run through the rows. The tests of the first-order theory ({{ref:tab:sinusoid}}, {{ref:tab:sweep}}, and the unequal-reward sinusoid) fit a sinusoid to the bound, so they need the bound to be periodic over the fit; each ends its fit some time before the forced choice; the last plate on this page measures how far back a forced choice moves the bound. The tests on random schedules score whole trials, to a fixed time, 10, or to the schedule's own deadline. Besides the belief grid of the first row, the sweep and the unequal-reward sinusoid use half the main evidence step, and unknown reliability uses a program of its own, with its own time step.
"""),
            ("exact", "1575-1597", "The table's caption, in Appendix C"),
            ("exact", "1558-1559||main evidence grid.", "Where the main grid is given, in Appendix C"),
        ],
    },
    {
        "id": "programs",
        "title": "Two reference programs",
        "blocks": [
            ("plain", r"""
Both programs answer the same question, when to stop, for the same evidence checked every $\Delta t$, and both start from the forced choice and step back. They differ in what they keep track of.

The **evidence grid** keeps the evidence $x$ itself, on points $h$ apart. One step back, the value of waiting at $x$ is the average of the next step's value over a Gaussian step with mean $+\Delta t$ or $-\Delta t$, weighted by the belief $g(x)$ that the drift is $+1$: a mixture of two convolutions. [Chapter 9](../measures/index.html#reference) runs it on your schedule.

The **belief grid** keeps the belief $g$, the chance that the drift is $+1$, at the midpoints of $n$ equal bins on $(0, 1)$. Its step from one bin to another comes from the same two Gaussian steps: turn the two beliefs into evidence, $x = \tfrac12\log\bigl(g/(1 - g)\bigr)$, take the mixture of the two evidence densities for that step, weighted by the current belief, and change variables from evidence to belief; each row is then scaled to sum to 1. {{ref:app:numerics}} uses 800 bins for the sinusoid test. The program's bound is the first bin above $\tfrac12$ where deciding beats waiting, read between bins.

Equal bins in belief are not equal in evidence. Near a belief of $\tfrac12$, a bin of width $1/n$ covers about $2/n$ of evidence; near a belief of 0.99, about $50/n$. So at a low cost, where the bound sits at high belief, a belief grid needs many more bins than at a high cost. The plate solves it at a constant cost, where the best bound for continuous watching is $B(c)$, for six numbers of bins.
"""),
            ("plate", "bins"),
            ("plain", r"""
At the default cost of 0.02 and 100 bins, the bins near the bound are wider than the evidence moves in one step's noise, $\sqrt{0.01} = 0.1$, and the program's bound sits some way from the evidence grid's; with more bins, the two come together. At every cost from 0.1 to 1 on the slider, 50 bins already put the two programs within 0.01 of each other. The evidence grid's program sits below $B(c)$ at every cost on the slider; [chapter 9](../measures/index.html#monitoring) measures the shift for checking at intervals.
"""),
            ("exact", "1559-1561|The dynamic program over|the two evidence densities.", "The belief grid, in Appendix C"),
            ("limits", r"""
**What the plate shows.** Two programs for the same constant cost, on this page's time step, against the number of bins. It doesn't show the paper's runs, which use a time step of 0.002 and costs that change; the paper doesn't report how its belief grid's bound moves with the number of bins.
"""),
        ],
    },
    {
        "id": "horizon",
        "title": "The horizon",
        "blocks": [
            ("plain", r"""
The paper's theorems are about an infinite horizon: no last moment. A program needs one, so each experiment forces the choice at some time, given in {{ref:tab:params}}'s horizon column. How far back does that reach? Close to the forced choice, waiting has little left to gain, so the bound comes down, to 0 at the forced choice itself. Further back, the forced choice matters less and less, and the bound settles at the value it has with plenty of time left.

At a constant cost, the program's step back is the same at every time, so the bound depends only on the time left before the forced choice. Moving the forced choice later moves the whole drop later. What changes with the cost is how long the drop is. Guess first, at the default cost of 0.1, the base cost of the sinusoid test.
"""),
            ("plate", "horizon"),
            ("plain", r"""
Over the slider's costs, the stretch is longer the lower the cost. The paper measures one effect of its own horizon: at a constant cost of 0.02, the constant-cost bound loses {{HorizonFloor}} points per 100 trials against the best policy with the choice forced at 10 ([chapter 9](../measures/index.html#reference) computes the same on its own grid).
"""),
            ("limits", r"""
**What the plate measures, and what it can't show.** The stretch over which the forced choice moves the bound by more than 0.001 or 0.01, at a constant cost, on this page's grid, measured against the bound with 30 time units left, not against an infinite horizon. For a cost that changes, the stretch also depends on the costs near the end, and the plate doesn't show that; chapter 9's plates solve your schedule with the choice forced 6 time units past its window. The losses the paper reports depend on the horizon through the whole trial, and the plate doesn't score them.
"""),
        ],
    },
    {
        "id": "kernels",
        "title": "Kernels, two ways",
        "blocks": [
            ("plain", r"""
The weighted rule needs a kernel at each time, the weights {{ref:lem:kernel}} gives to the future costs. For known reliability, the paper computes it from the eigenfunction series of the exit time from the flat bound, a sum of exponentials, as [chapter 6](../kernel/index.html#weights) shows and its plates compute. For unknown reliability, it computes the kernel from a finite-difference generator on 240 interior nodes instead of a series ([chapter 11](../extensions/index.html#carried)). The paper's repository tests the series against its Laplace transform.
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
                (r"Why would a belief grid with few bins get the bound wrong at a low cost but not at a high one?",
                 r"""
The bins are equal in belief, and a bin of width $1/n$ at belief $g$ covers about $1/\bigl(2n\,g(1 - g)\bigr)$ of evidence. At a low cost, the bound sits at a belief near 1, where that is large: the bins near the bound are coarser than one step's movement, and the program's bound can only be read between bins that far apart. At a high cost, the bound sits near $\tfrac12$, where the bins are fine in evidence.
"""),
                (r"The sweep's fit ends at $2 + 2\pi$ and its choice is forced at 14. At its lowest base cost, 0.03, how could you check that the forced choice doesn't reach the fit?",
                 r"""
Set the horizon plate to a cost of 0.03 and read how far back the bound moves by more than 0.001; compare it with the time between the fit's end and 14. The plate measures this on its own grid and at a constant cost; the sweep's cost moves away from the base cost by up to {{T:tab_sweep:4:1}} times it, and its grid is finer, so the plate gives a guide rather than the sweep's own number.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The forced choice at 10 is part of the model.”",
                 r"The model has no last moment. The forced choice is how the program ends; the paper keeps it far from what it measures and reports what it costs at a low constant cost ({{HorizonFloor}} points per 100 trials at 0.02)."),
                (r"“The belief grid and the evidence grid are two models.”",
                 r"They are two ways to compute the best policy for the same evidence checked every $\Delta t$: one keeps the belief in bins, the other the evidence on points. On a fine enough grid, both approach the same bound."),
                (r"“Table 11's parameters were tuned to make the rules look good.”",
                 r"The parameters set the reference program's grid and horizon, which every rule is scored against in the same way. Table 12 shows how much the losses move on finer grids."),
            ]),
        ],
    },
]
