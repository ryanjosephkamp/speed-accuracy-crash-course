"""Chapter 9: how the paper measures, and the first-order theory checked.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), ("table", label), and ("strip", id) place a live plate, a printed figure, a
generated table, or a proof strip; ("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and
("limits", text) close a section.

Table 11 (tab:params) is typed in main.tex rather than generated, and an excerpt of a table shows only its caption,
so its rows are read from main.tex when the page is built (_params_rows below) and printed as they stand there.
"""
import json
import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_TEX = (_ROOT / "paper/main.tex").read_text().split("\n")
_LAB = json.loads((_ROOT / "paper/labels.json").read_text())["labels"]


def _params_rows():
    """Table 11's head and rows as main.tex has them, with each \\Cref{tab:...} named, and the lines they span."""
    lab = next(i for i, ln in enumerate(_TEX) if r"\label{tab:params}" in ln)
    mid = next(i for i in range(lab, len(_TEX)) if r"\midrule" in _TEX[i])
    end = next(i for i in range(mid, len(_TEX)) if r"\bottomrule" in _TEX[i])

    def cells(ln):
        out = [c.strip() for c in ln.strip().removesuffix("\\\\").split("&")]
        return [re.sub(r"\\Cref\{(tab:[\w-]+)\}", lambda m: "Table " + _LAB[m.group(1)]["num"], c).replace("--", "–") for c in out]
    head = cells(_TEX[mid - 1])
    rows = [cells(_TEX[i]) for i in range(mid + 1, end)]
    return head, rows, mid + 2, end


def _params_md():
    head, rows, a, b = _params_rows()
    items = [f"- **{r[0]}**: {r[1]}; {head[2]} {r[2]}, {head[3]} {r[3]}; {head[4].lower()} {r[4]}; {r[5]}." for r in rows]
    return (f"**Table {_LAB['tab:params']['num']}'s rows**, read from main.tex at the book's tag (lines {a}–{b}) when this page is "
            "built: the experiment, its reference policy, the time step, the evidence step, the horizon, and anything else.\n\n"
            + "\n".join(items))


CHAPTER = {
    "slug": "measures",
    "num": 9,
    "title": "How the paper measures",
    "full": "How the paper measures, and the first-order theory checked",
    "leaf": 10,
    "finding": "The paper scores each rule by pushing the evidence density forward on the grid its best policy is solved on, so even small losses carry no sampling error.",
    "readings": [
        ("HorizonFloor", "points per 100 trials the constant-cost bound loses at a cost of 0.02 because the choice is forced at t = 10"),
        ("GridPmMaxChange", "the most a per-moment loss moves from the paper's grid to the finest of four (points per 100 trials)"),
        ("ClosedFormWorstGain", "the largest gap, in percent, between the closed form's swing and the dynamic program's, at c₀ = 0.1"),
    ],
    "hero": {
        "aria": "The evidence density for Figure 1(a)'s schedule, a 16-fold rise in the cost centered at time 0.5, pushed forward in time between the best bound's two edges, with the share of trials decided so far below",
        "caption": r"""Figure 1(a)'s schedule: a cost of 0.1 that rises 16-fold, logistic in time and centered at 0.5. Top: the density of the evidence $X$ under the drift $+1$, shaded more strongly where more trials are still deciding with that evidence, pushed forward on this page's grid between the best bound's edges $\pm b(t)$ (ink), from a dynamic program solved in the page. Bottom: the share of trials decided so far, correctly (ink) and wrongly (slate). No trial is simulated.""",
        "still": 2,
    },
    "intro": r"""
The paper scores each rule by pushing the evidence density forward on the grid its best policy is solved on, so even small losses carry no sampling error. This chapter covers how the paper measures: its reference policy, computed backward from a forced choice; its scoring, which follows the whole distribution of the evidence instead of sampling trials; and the shift it applies to a rule that is checked only every $\Delta t$. Then come the paper's first tests of the first-order theory against the dynamic program: a sinusoid at one cost and five frequencies, and a sweep across costs, frequencies, and sizes. The chapter ends with how much the numbers move when the grid is refined.

Everything here is measured, not proved, and one piece is cited rather than derived: the size of the monitoring shift, a leading-order result from sequential analysis. The plates run this page's own copy of the paper's two methods on a coarser grid; a check script holds that copy to the paper's code at the book's tag, so what the plates show is the method, at a lower resolution.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"method:reference": "reference", "method:scoring": "scoring", "method:monitoring": "monitoring",
             "exp:sinusoid": "sinusoid", "exp:sweep": "sweep", "app:numerics": "numerics"}

# which groups of checks in tools/checks/ stand behind each plate
CHECKS = {
    "backward": ["backward", "edges", "words"], "density": ["density", "edges", "words"], "trials": ["trials", "density", "words"],
    "overshoot": ["overshoot", "words"], "coef": ["coef", "edges", "words"], "shift": ["shift", "edges", "words"],
    "fit": ["fit", "words"], "sweep": ["sweep", "words"], "grid": ["grid", "edges", "words"],
}

PLATES = {
    "backward": {
        "title": "Backward from the forced choice",
        "state": "computed",
        "state_text": "Computed in the page: backward induction on an evidence grid",
        "caption": r"""Your schedule, solved backward on this page's grid: the evidence checked every 0.01 time units on a grid of 0.02, with bounds capped at $|x| = 5$ (the grid itself runs out to about $|x| = 6.8$, so the steps near the cap are computed), and the choice forced 6 time units past the drawn window of 0 to 2.5 (at 8.5) or at a deadline. Top, at the slice on show: the value of deciding now, $\max(g, 1 - g)$ (gray), and the best of deciding and waiting, $V$ (ink); the shaded gap is what waiting adds, and the dot is the bound, where the gap closes. Bottom: the bound computed so far, from the end back to the slice, with the waiting region shaded. Where the program still waits at $x = 0$ but decides at the grid's first step, the bound is placed between the two, where its own step changes from waiting to deciding; the paper's code reports 0 there. Where the program decides at $x = 0$ too, the bound is 0. The line under the plate scores the constant-cost bound at a cost of 0.02 against the program with the choice forced at 10, on the same grid.""",
        "wide": True,
    },
    "density": {
        "title": "The density, pushed forward",
        "state": "computed",
        "state_text": "Computed in the page: the evidence density pushed forward on the grid, with no sampling",
        "caption": r"""Your schedule, scored as the paper scores a policy, on this page's grid (evidence step 0.02, a step every 0.01 time units, to the forced choice at 8.5 or a deadline). Pick the policy: the best bound from the dynamic program, or the per-moment or weighted rule, each moved in by $0.5826\sqrt{0.01}$ for checking every 0.01. Top: the density of the evidence under the drift $+1$, shaded more strongly where more trials are still deciding with that evidence (cells every 0.02 time units and 0.04 in evidence), between the policy's edges $\pm\hat b(t)$, up to the time on show. Bottom: how many trials decide per unit time, correctly above the axis and wrongly below it, over pairs of steps (and over the one step left unpaired just before a deadline on an even step). At a deadline, every trial still deciding at its last step chooses there, at the bound or by the sign of the evidence; that share is a point mass, not a rate, so it is not drawn on the rate's scale: a dotted line marks the deadline, with the shares forced to choose there, correct and wrong, written beside it, and they are counted in the readings. The readings for the whole trial run to the end of the program's horizon.""",
        "wide": True,
    },
    "trials": {
        "title": "How many trials?",
        "state": "computed",
        "state_text": "Sampled in the page, beside the density's exact score on the grid",
        "caption": r"""Your schedule's best bound, from the same program as the plate above. Its score by the density on this page's grid is the ink line. The gray curve is the average reward of simulated trials with the scorer's checks, bound, and payoffs: the drift $+1$, the bound checked every 0.01 time units, the cost paid for each step, and a choice by the sign of the evidence for a trial still undecided at the end. Their evidence is continuous, not on the grid, so their average estimates the expected reward with continuous evidence, which the scorer approximates on its evidence grid; the readings also give the score on a grid four times finer (an evidence step of 0.005), at the same bound and time step, to show how far the evidence step moves it. It runs 100,000 trials (more on request, up to 10 million) with a fixed seed (add `?seed=` to the address for another); the band is two standard errors, which covers sampling only. The number of trials for a standard error of $2\times10^{-5}$ is (the spread of one trial's reward $\div$ $2\times10^{-5}$)$^2$.""",
        "wide": False,
    },
    "overshoot": {
        "title": "Past the bound between checks",
        "state": "computed",
        "state_text": "Sampled in the page",
        "caption": r"""Runs of the evidence from 0 with the drift $+1$, checked every $\Delta t$ against a flat bound at $B(0.1) \approx 1.344$ on $|X|$. Once you guess, or press Show me: top, one run's last stretch, drawn in steps of $\Delta t/24$ between the checks (gray), the checks (ink dots), and how far past the bound it is at the first check that sees it there (orange); a ring marks the first finely drawn step past the bound, when that comes before the check that sees it and within the nine checks drawn, and a note gives its time instead when it comes before them (the fine steps place a crossing only to within a step). Bottom: the mean of that overshoot divided by $\sqrt{\Delta t}$ for four values of $\Delta t$, each from 8,000 runs with a fixed seed (add `?seed=` to the address for another), with two standard errors (sampling only), beside 0.5826.""",
        "wide": False,
    },
    "coef": {
        "title": "How far in, moment by moment",
        "state": "computed",
        "state_text": "Computed in the page: the dynamic program on two grids",
        "caption": r"""Your schedule (top, the cost on a log scale), solved twice on an evidence grid of 0.01: once checking every 0.01 time units and once every 0.0025, with the choice forced at 8.5 or at a deadline. Bottom: the gap between the two bounds divided by $\sqrt{0.01} - \sqrt{0.0025}$, every 0.02 time units and at the last check before the end, beside 0.5826 (dashed). If each bound sat exactly $0.5826\sqrt{\Delta t}$ inside one continuous bound, the curve would be the dashed line. Values outside 0.4 to 0.8 are drawn at the edge. Times where either bound is 0 are left out, as is the forced choice itself.""",
        "wide": False,
    },
    "shift": {
        "title": "With and without the shift",
        "state": "computed",
        "state_text": "Computed in the page: the dynamic program, and three policies scored by the density",
        "caption": r"""Your schedule on this page's grid (checks every 0.01, evidence step 0.02, to the forced choice at 8.5 or a deadline). The program's bound (ink) and the two rules' continuous-monitoring bounds, the per-moment rule (dashed) and the weighted rule (green), either moved in by $0.5826\sqrt{0.01}$ and clipped at 0, as the paper scores them, or left as they are. The readings give each rule's loss both ways, in points per 100 trials, against the program's bound scored by the same density method, as the paper scores its reference.""",
        "wide": False,
    },
    "fit": {
        "title": "The theory against the program",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program, fitted as the paper fits it; the dots are the paper's Table 1",
        "caption": r"""The paper's sinusoid test at $c_0 = 0.1$ and $\varepsilon = 0.01$, run by this page's program (checks every 0.01, an evidence grid of 0.02) at the five frequencies of Table 1, with the paper's window: whole periods from $t = 2$, at least two and at least 6 time units, the choice forced 6 time units after the fit ends. Top, at the frequency you pick: the program's bound minus its bound at the constant cost (ink), the closed-form first-order response $\varepsilon\beta(t)$ (green), and the per-moment rule's move $B(c(t)) - B(c_0)$ (dashed). Each swing and lead is measured against the per-moment rule's, fitted the same way. Below, once you guess: the gap from the closed form in the swing (percent) and the lead (degrees), for the paper's program (dots, from Table 1, with bars for the table's rounding) and this page's (rings).""",
        "wide": True,
    },
    "sweep": {
        "title": "The error against the size of the change",
        "state": "computed",
        "state_text": "From the paper's Table 2, beside this page's program when you run it",
        "caption": r"""Top: the fitted swing's error, $|\text{fitted} / \text{predicted} - 1|$, against $\varepsilon/c_0$, on log axes, from Table 2: three marks at each size for $c_0 = 0.03$, 0.1, and 0.3 (left to right), each a bar over $\omega = 1$ and 4 where the two differ. A hollow mark is a value Table 2 prints as 1.000, an error below 0.05%, drawn at that line. The dashed guide has slope 2. Bottom: the phase error, Table 2's largest at each size over its six costs and frequencies (dots). Orange rings: this page's program's phase error at the one cost and frequency you pick (checks every 0.01, an evidence grid of 0.02, the choice forced at 14, fitted on $2 < t < 2 + 2\pi$, as the paper does on its finer grid), against the prediction $\varepsilon\,|B'(c_0)|\,|\tilde w(-i\omega)|$.""",
        "wide": False,
    },
    "grid": {
        "title": "Finer grids",
        "state": "computed",
        "state_text": "From the results behind the paper's Table 12, beside your schedule rescored in the page",
        "caption": r"""Top, once you guess: the losses behind Table 12, unrounded (the paper's results file at the tag), on its four grids, as changes from the paper's grid (grid 2), in points per 100 trials or as a share of the loss on grid 2, for the per-moment rule (dashed) and the weighted rule (green) on its eight schedules. Shares are drawn only for losses of at least 0.001 points on grid 2, which leaves out the weighted losses of Smooth 4 (it prints as {{T:tab_grid:2:7}}) and Step 10 ({{T:tab_grid:5:7}}); the legend names what is drawn. Bottom: your schedule rescored on this page's three grids, $(\Delta t, h) = (0.01, 0.02)$, $(0.005, 0.014)$, and $(0.0025, 0.01)$, each halving the time step and dividing the evidence step by about $\sqrt2$, as the paper's do. Each grid solves its own program and scores both rules moved in by $0.5826\sqrt{\Delta t}$ for its own $\Delta t$, to the forced choice at 8.5 or a deadline. The chart gives each loss as a change from this page's grid, in points per 100 trials; the readings give the losses.""",
        "wide": False,
    },
}

STRIPS = {}

SECTIONS = [
    {
        "id": "reference",
        "title": "The reference, computed backward",
        "blocks": [
            ("plain", r"""
Every loss in the paper is measured against one reference: the best policy for the gridded problem. The paper computes it by backward induction on an evidence grid. Start at the last grid time, where the choice is forced, so the value at evidence $x$ is the chance of being right, $\max(g(x), 1 - g(x))$, with $g(x) = 1/(1 + e^{-2x})$ the belief that the drift is $+1$. One step earlier, waiting is worth what the next step's value is worth on average, less the cost of the step:

$$V_{\mathrm{wait}}(t_k, x) = g(x)\,\mathbb{E}\,V(t_{k+1}, x + \Delta t + \sqrt{\Delta t}\,Z) + \bigl(1 - g(x)\bigr)\,\mathbb{E}\,V(t_{k+1}, x - \Delta t + \sqrt{\Delta t}\,Z) - c(t_k)\,\Delta t,$$

with $Z$ a standard normal. Over one step, the evidence moves by a Gaussian step with mean $+\Delta t$ or $-\Delta t$, and the decision maker at $x$ weighs the two by its belief: that is the mixture of two Gaussian convolutions. The value is the better of deciding and waiting, $V(t_k, x) = \max\bigl(\max(g, 1 - g),\ V_{\mathrm{wait}}\bigr)$, and the bound $b(t_k)$ is the first $x > 0$ where deciding beats waiting, read between grid points. Then the same again, one step further back, all the way to $t = 0$.

The plate runs this on your schedule, on this page's grid: a check every 0.01 time units, an evidence step of 0.02, bounds capped at $|x| = 5$, and the choice forced at $t = 8.5$, 6 time units past the drawn window of 0 to 2.5 (the paper forces it at 10), or at a deadline. The paper's grid is finer: an evidence step $h = 0.005$, a time step $\Delta t = 0.002$, truncated at $|x| = 8$, with the two averages computed by the fast Fourier transform, where the page sums them directly. At the ten presets' starting settings and on the default drawing, run on the page's grid by both, the page's program is held to the paper's code to within $10^{-6}$ in the bound over the drawn window. The two differ in one kind of cell, which those schedules don't reach: where the program still waits at $x = 0$ but decides at the grid's first step, the page places the bound between the two, and the paper's code reports 0.
"""),
            ("plate", "backward"),
            ("plain", r"""
Two things to see. The bound comes out backward: what the best policy does now depends on what it will do later, so no time is settled until every later one is. And the finite horizon lowers the bound at earlier times too. Close to the last time, waiting has little left to gain, so the bound comes down to 0; how long before the end that starts depends on the cost, and at a low cost, where decisions run long, it starts earlier. The paper ends each schedule without a deadline with a forced choice at $t = 10$, long compared with the decision times involved. It still changes the problem slightly: at a constant cost of 0.02, the constant-cost bound loses {{HorizonFloor}} points per 100 trials against the best policy with the choice forced at 10, because about one decision in a thousand is still open then. The heuristic rules aren't told about that cutoff; they treat the horizon as infinite.
"""),
            ("md", _params_md()),
            ("exact", "682-692", "The paper's reference, in its methods"),
            ("limits", r"""
**What the reference is.** The best policy of the gridded problem with a finite horizon, not the continuous model's bound: it checks the evidence every $\Delta t$, on a grid of spacing $h$, and forces a choice at the end. The paper hasn't bounded the grid's own error; refining the grid moves the losses only slightly ({{ref:app:numerics}}, the last section of this chapter).
"""),
        ],
    },
    {
        "id": "scoring",
        "title": "Scoring without sampling",
        "blocks": [
            ("plain", r"""
A rule, for the paper, is a bound $\hat b(t)$ on the evidence grid. To score it, the paper doesn't simulate trials. It follows the whole distribution of the evidence forward in time on the same grid. All the mass starts at $x = 0$. At each step, every unit of mass still deciding is charged $c(t)\,\Delta t$ for the step; then the mass is spread by the Gaussian step under the drift $+1$, sampled on the grid; then the mass now past $\pm\hat b$ is removed, the part past $+\hat b$ counted as correct choices and the part past $-\hat b$ as errors (a grid cell that straddles the bound is split in proportion). So a trial that stops at the end of a step has paid for that step. Trials still undecided at the last time choose by the sign of the evidence. The drift $+1$ alone is enough: the problem and the rules are symmetric, so the case $H = -1$ is its mirror image.

The result is the rule's expected reward, its accuracy minus its cost, with no sampling error. A loss is $100 \times$ (the reference's reward minus the rule's), in points per 100 trials, with the reference scored the same way.
"""),
            ("plate", "density"),
            ("plain", r"""
The scorer and the dynamic program describe the same gridded problem, so no policy on the grid can earn more than the program's own value. But a loss is measured against the program's bound as scored: read between grid points and applied by splitting cells, like any other bound, it earns slightly less than the program's own value, and a rule's bound can land in between. That is where the paper's few negative losses come from, and why they are tiny: its losses are nonnegative "up to the interpolation of bounds between grid points." What the method does have is the grid's own error, which the paper hasn't bounded; the last section shows how much the losses move on finer grids.

How much does sampling error matter? The weighted rule's losses in the paper go down to thousandths of a point per 100 trials. Before the plate runs any trials: how many would it take to pin one rule's mean reward down to 0.002 points per 100 trials, to one standard error?
"""),
            ("plate", "trials"),
            ("plain", r"""
The trials' average comes out near the density's score. The two differ for two reasons. One is the trials' sampling error, which shrinks only like one over the square root of their number. The other is the evidence grid: the trials' evidence is continuous, and the scorer's lives on the grid. On the book's schedules, refining the scorer's evidence step from 0.02 to 0.0025, at the same bound and time step, moves its score by far less than the standard error of the plate's 100,000 trials; that is a measured sensitivity, not a bound on the scorer's distance from the continuous-evidence value. Each trial earns 1 or 0, less its cost, so one trial's reward varies by a large fraction of 1, and a standard error of $2\times10^{-5}$ takes hundreds of millions of trials on most schedules; the plate computes the number from its own runs. Running two rules on the same simulated trials narrows the spread of their difference when the two rewards move together, but it doesn't remove it; the density method has no spread to remove. The paper's repository tests the scorer against simulated trials for one bound that moves in time, as this plate does with your schedule's best bound.
"""),
            ("exact", "694-705", "The paper's scoring, in its methods"),
        ],
    },
    {
        "id": "monitoring",
        "title": r"Checked every $\Delta t$",
        "blocks": [
            ("plain", r"""
The rules the paper compares with the dynamic program, the per-moment rule and the weighted look-ahead among them, give bounds for continuous watching: a decision maker who sees the evidence at every instant. On the grid, the bound is checked only every $\Delta t$. Guess first which way that should move a bound.
"""),
            ("plate", "overshoot"),
            ("plain", r"""
Between two checks, the evidence can cross the bound and keep going, so a rule checked every $\Delta t$ stops, on average, past its nominal bound: it overshoots. Over one step, the noise moves the evidence by about $\sqrt{\Delta t}$, so the overshoot scales like $\sqrt{\Delta t}$, and the constant is known from sequential analysis. Chernoff (1965) showed that, to leading order as $\Delta t \to 0$, the best boundary of a sequential test checked at intervals $\Delta t$ sits $0.5826\,\sigma\sqrt{\Delta t}$ inside the continuous one, where $0.5826 = -\zeta(\tfrac12)/\sqrt{2\pi}$; the same constant governs the overshoot of a barrier checked at intervals (Siegmund, 1979; Broadie, Glasserman, and Kou, 1997). In the paper's units, the noise has variance 1 per unit time, so $\sigma = 1$. Before scoring, the paper moves each continuous bound inward by $0.5826\sqrt{\Delta t}$. The dynamic program needs no correction: it is solved on the grid itself.

That is a cited, leading-order result: the paper relies on its sources for it and proves nothing about it for this problem. Two plates test it on this page's grid. The first measures the shift on the dynamic program itself, on your schedule: it solves the program checking every 0.01 and every 0.0025 and divides the gap between the two bounds by $\sqrt{0.01} - \sqrt{0.0025}$. If each bound sat exactly $0.5826\sqrt{\Delta t}$ inside one continuous bound, that would be 0.5826 at every time.
"""),
            ("plate", "coef"),
            ("plain", r"""
Where the cost holds steady, the measured coefficient stays near 0.5826. Near a fast change, such as the logistic jumps of Figure 1(a) and (b), it moves away from it, in either direction: there the bound itself moves a long way within a few checks, which the leading-order result doesn't describe. Before a deadline, it holds: on the Deadline preset, it stays within 0.03 of 0.5826 until the last check or two before the forced choice.

The second plate scores the rules both ways. The shift corrects for checking at intervals, not for a rule's own error. Scoring moves a rule's bound $\hat b$ in by $\delta = 0.5826\sqrt{\Delta t}$ and clips it at 0, so the bound moves by $\min(\delta, \hat b)$. Against the program's bound $b$ on the grid, that brings it closer exactly where $\hat b$ sits more than half that move, $\tfrac12\min(\delta, \hat b)$, above $b$. A rule that is right for continuous watching sits about $\delta$ above $b$, so the shift puts it about on $b$; a rule whose bound is already at or below $b$ moves further away, or stays where it is if it is already 0. That holds moment by moment. Whether a rule's loss falls depends on where along the trial its bound moves closer or further, so the plate measures it over the whole schedule.
"""),
            ("plate", "shift"),
            ("plain", r"""
On the Constant preset at its starting settings, both rules give the constant-cost bound, and the shift cuts its loss more than tenfold. What is left is a measured difference, not an error estimate: it includes the forced choice at 8.5, which the rule doesn't know about; the shift itself, which is right only to leading order; and the grid. On most of the book's schedules, the shift lowers the weighted rule's loss too, as measured on this grid. It isn't a guarantee: on the Deadline preset at its starting settings, the weighted rule's bound already sits below the best bound for most of the trial, and it loses more with the shift than without it on this grid. The per-moment rule's loss moves either way, depending on whether its bound sits above or below the best one. The paper applies the shift the same way to every continuous-time rule.
"""),
            ("exact", "707-714", "The paper's discrete-monitoring correction"),
            ("limits", r"""
**What the shift is.** A cited result, to leading order as $\Delta t \to 0$: for the best boundary of a sequential test checked at intervals (Chernoff, 1965), and for the overshoot of a barrier checked at intervals (Siegmund, 1979; Broadie, Glasserman, and Kou, 1997). The paper applies it to every continuous-time rule. It is not a promise that a given rule scores better with it, on every schedule and every grid.
"""),
        ],
    },
    {
        "id": "sinusoid",
        "title": "The theory against the dynamic program",
        "blocks": [
            ("plain", r"""
The first test of the first-order theory. At $c_0 = 0.1$, with $\gamma(t) = \sin\omega t$ and $\varepsilon = 0.01$, the paper solves the problem at five frequencies by dynamic programming over beliefs: 800 bins of the posterior, a time step of 0.002. It fits a sinusoid plus a constant, $a\sin\omega t + b\cos\omega t + c$, to the bound's deviation from its value at the constant cost, over whole periods from $t = 2$: at least two periods and at least 6 time units, with the horizon 6 time units after the end of the fit. The per-moment rule's deviation is fitted the same way, and each swing and lead is measured against it. {{ref:cor:transfer}} predicts both from the closed form, as chapter 7 shows.

How close should a dynamic program come to a first-order formula at $\varepsilon = 0.01$? Guess before the page runs its own.
"""),
            ("plate", "fit"),
            ("plain", r"""
At every frequency, the closed form agrees with the paper's dynamic program to about {{ClosedFormWorstGain}}% on the swing and {{ClosedFormWorstLead}}° on the lead, and the weighted rule agrees with it to about {{SinusoidWorstGain}}% and {{SinusoidWorstLead}}°. The per-moment rule's swing is {{PerMomentTooLargeAtEight}} times too large at $\omega = 8$, and it lags by {{PerMomentLateAtEight}}°.

This page's program runs on a coarser grid, so its results are further from the closed form; the plate's readings give how far. Most of its gap in the lead at $\omega = 8$ is the grid's: a check behind the plate runs the same test with half the time step and half the evidence step, and the gap shrinks by about half. Table 1 below is the paper's; chapter 7 draws its closed-form columns as curves, in Figure 3.
"""),
            ("table", "tab:sinusoid"),
            ("exact", "716-729", "The paper's sinusoid test"),
            ("limits", r"""
**What this checks.** The closed form against the dynamic program at one cost, $c_0 = 0.1$, and one small size, $\varepsilon = 0.01$, at five frequencies. {{ref:thm:main}} is proved; the test shows that the computation and the proof agree there. It says nothing about large changes.
"""),
        ],
    },
    {
        "id": "sweep",
        "title": "Wider: three costs, two frequencies, four sizes",
        "blocks": [
            ("plain", r"""
{{ref:thm:main}} covers any small change around a positive constant cost that is continuous and bounded, so the paper tests it more widely: three costs ($c_0 = 0.03$, 0.1, and 0.3), two frequencies ($\omega = 1$ and 4), and four sizes of the change ($\varepsilon/c_0 = {{T:tab_sweep:1:1}}$, {{T:tab_sweep:2:1}}, {{T:tab_sweep:3:1}}, and {{T:tab_sweep:4:1}}), against the best policy on a finer evidence grid ($h = 0.0025$, a time step of 0.002, the choice forced at 14). It fits on $2 < t < 2 + 2\pi$, one period at $\omega = 1$ and four at $\omega = 4$, and compares the fitted swing with the one the theorem predicts, $\varepsilon\,|B'(c_0)|\,|\tilde w(-i\omega)|$, and the fitted phase with the predicted one.

The fitted swing is off by at most {{SweepSwingThird}}% at $\varepsilon/c_0 = 0.3$, over the six costs and frequencies. If the error is second order in the size of the change, what should the most be at 0.6?
"""),
            ("plate", "sweep"),
            ("plain", r"""
At 0.6, it is off by at most {{SweepSwingSixTenths}}%: from 0.3 to 0.6 the size doubles and the largest error grows a little more than fourfold, near the 4 of a square. From 0.1 to 0.3 the size triples, and the printed largest errors, {{SweepSwingTenth}}% and {{SweepSwingThird}}%, give a factor of 11; but they are rounded, and the paper's unrounded results give a factor close to 9, the 9 of a square. At 0.05, the error is at the last printed digit (Table 2 prints 0.999 to 1.001 there), so no ratio can be read from it. So the fitted swing's error shrinks about like $(\varepsilon/c_0)^2$, as the paper says. The largest phase error grows above 0.1, to {{SweepPhaseThird}}° at 0.3 and {{SweepPhaseSixTenths}}° at 0.6, but prints as {{SweepPhaseTenth}}° at both 0.05 and 0.1 (unrounded, the two differ by a few thousandths of a degree), so at those sizes it barely changes with the size of the change; the paper doesn't say what sets it.

On this page's coarser grid, the error at 0.3 and 0.6 comes out close to Table 2's. Below 0.3, the page's errors don't grow with the size of the change the way a second-order error would, and they depend on the grid: at $c_0 = 0.1$ and $\omega = 4$, for example, a check behind the plate halves the grid's steps, and the error at 0.05 falls by more than half. The paper ran this test on a finer grid than its main one ($h = 0.0025$, against 0.005).
"""),
            ("table", "tab:sweep"),
            ("exact", "731-735", "The paper's sweep"),
            ("limits", r"""
**What the sweep measures.** The swing and the phase of a fitted sinusoid, at three costs and two frequencies: evidence for {{ref:thm:main}}, not a proof of it. It doesn't measure the whole remainder $b_\varepsilon - b_0 - \varepsilon\beta$, only its part at the frequency of the change, as the paper's limitations say ({{claim:claim:limitations|chapter 12}}).
"""),
        ],
    },
    {
        "id": "numerics",
        "title": "How stable the numbers are",
        "blocks": [
            ("plain", r"""
Everything is computed in double precision, and every random draw has a fixed seed: 2026 for the development schedules, 20261111 for the held-out set, 2027 for unequal rewards, and 7 for the loss check. The paper's repository tests the constant-cost bounds against the dynamic programs, the scorer against simulated trials, and the kernel series against its Laplace transform.

How much do the numbers depend on the grid? The paper rescores eight of its development schedules on four grids, from $(\Delta t, h) = (0.004, 0.007)$ to $(0.0005, 0.0025)$, recomputing the best policy on each (Table 12). Before you read it: from the paper's grid to the finest, which losses move more, the per-moment rule's or the weighted rule's?
"""),
            ("plate", "grid"),
            ("table", "tab:grid"),
            ("plain", r"""
In points per 100 trials, the per-moment losses move more: by at most {{GridPmMaxChange}}, against {{GridWbMaxChange}} for the weighted ones. As a share of the loss, it's the other way round: the weighted losses are small, so a change in the fourth decimal is a large share of one (Deadline 12's goes from {{T:tab_grid:8:7}} on the paper's grid to {{T:tab_grid:8:9}} on the finest). Not every loss moves steadily, either: Deadline 12's weighted loss falls from grid 1 to grid 2 and rises after. The paper calls this what it is: empirical stability, not an error bound. A number can change little as the grid is refined and still be some way from its limit.

The last column checks Algorithm 1's 30 updates: the residual is twice the largest change a 31st update makes to the weighted bound before $t = \min(6, \text{deadline})$, in units of evidence, unlike the losses beside it, which are in points per 100 trials. Running 300 updates instead of 30 moves the bound by at most {{FixedPointMove}} over that time, and the loss over the whole trial by {{FixedPointLossChange}}; chapter 8 runs the same comparison on your schedule.
"""),
            ("exact", "1555-1573", "The paper's numerical details, Appendix C"),
            ("limits", r"""
**What this shows.** That the losses change little on finer grids, for eight schedules: empirical stability, in the paper's words, not a bound on the grid's error.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's six highlighted. The reference program uses the value function of chapter 3; the scoring uses the reference; the monitoring shift is cited and uses nothing else in the paper. The sinusoid test uses the transfer function ({{ref:cor:transfer}}, chapter 7), the weighted rule's definition (chapter 8), and the reference; the sweep uses {{ref:thm:main}} (chapter 6) and the reference; the numerical details use the scoring and {{ref:alg:weighted}} (chapter 8). In turn, the reference is behind Figure 1's four schedules (chapter 1); the scoring and the shift are behind chapter 10's development and held-out schedules, and the scoring alone behind its check of the loss formula and how the loss scales; the shift is the last line of {{ref:alg:weighted}} (chapter 8); and the sweep is cited in the paper's limitations (chapter 12).
"""),
            ("map", "method:reference"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why is the value of waiting at a grid point a mixture of two Gaussian convolutions?",
                 r"""
Over one step $\Delta t$, the evidence moves by a Gaussian with mean $+\Delta t$ if $H = +1$ and $-\Delta t$ if $H = -1$, with variance $\Delta t$ in both cases. The decision maker at $x$ believes $H = +1$ with probability $g(x)$. So the expected value of the next step's value function is $g(x)$ times its convolution with the first Gaussian plus $1 - g(x)$ times its convolution with the second. A convolution on a uniform grid is cheap with the fast Fourier transform.
"""),
                (r"Why does a horizon at $t = 10$ matter at all, if decisions take about one time unit?",
                 r"""
At low costs, decisions are slow, and a few run long. At a constant cost of 0.02, about one decision in a thousand is still undecided at $t = 10$ under the constant-cost bound (a typed number in the paper), and forcing those choices is part of the finite-horizon optimum. Against that optimum, the constant-cost bound loses {{HorizonFloor}} points per 100 trials. It is small, but it is why some measured losses of near-optimal rules aren't exactly zero, and why {{ref:sec:loss-check}} has to treat late times with care.
"""),
                (r"Why is propagating the density under drift $+1$ alone enough?",
                 r"""
The problem and the rules are symmetric: the bound is applied to $|X|$, and the case $H = -1$ is the mirror image of $H = +1$, with the same reward and the same decision times. So the expected reward and cost under $H = +1$ equal the overall expected reward and cost.
"""),
                (r"How can a loss be slightly negative, if the reference is optimal?",
                 r"""
No policy on the grid can earn more than the program's own value. But the loss is measured against the program's bound as scored: read between grid points and applied by splitting cells, like any other bound, it earns slightly less than that value, and a rule's bound can land in between. That gap is the interpolation of bounds between grid points that the paper names, and it is why the few negative entries are tiny.
"""),
                (r"Why inward, and why does the shift scale like $\sqrt{\Delta t}$?",
                 r"""
Between checks, the evidence can cross the bound and keep going, so a discretely checked rule stops, on average, beyond its nominal bound: it overshoots. Moving the bound inward compensates. Over a time $\Delta t$, the evidence's noise moves it by about $\sigma\sqrt{\Delta t}$, so the overshoot, and the correction, scale like $\sqrt{\Delta t}$; the constant 0.5826 is the known first-order value.
"""),
                (r"Read Table 1 at $\omega = 0.5$ and $\omega = 8$. How do the swing and lead change, and which column is the per-moment rule?",
                 r"""
At $\omega = 0.5$, the closed form gives a swing of {{T:tab_sinusoid:1:2}} and a lead of {{T:tab_sinusoid:1:3}}°; at $\omega = 8$, {{T:tab_sinusoid:5:2}} and {{T:tab_sinusoid:5:3}}°. The faster change moves the bound less, with a larger lead in degrees (approaching the $45^\circ$ limit) but a shorter lead in time, since a phase $\phi$ (in radians) at frequency $\omega$ is a time lead of $\phi/\omega$. No column is the per-moment rule: every swing is relative to the per-moment swing, and every lead is measured from the per-moment response, so the per-moment rule is swing 1 and lead 0 by definition.
"""),
                (r"Why does the fit stop 6 time units before the horizon?",
                 r"""
The paper gives the setup, not the reason; here is the natural reading. The dynamic program has a forced choice at its horizon, and near it the optimal bound collapses toward the forced choice ({{ref:sec:loss-check}} reports the same effect before $t = 10$). That collapse isn't part of the steady sinusoidal response. Ending the fit 6 time units earlier, and starting it at $t = 2$, keeps it in the stretch where the response is periodic.
"""),
                (r"Use the printed errors to check “about like $(\varepsilon/c_0)^2$.”",
                 r"""
From 0.3 to 0.6, the size doubles, and the swing error goes from {{SweepSwingThird}}% to {{SweepSwingSixTenths}}%, a factor of about 4.5, near the 4 of a square. From 0.1 to 0.3, the size triples, and the printed error goes from {{SweepSwingTenth}}% to {{SweepSwingThird}}%, a factor of about 11, near 9. The ratios between rounded printed values are rough: the paper's unrounded results give a factor close to 9 for the second.
"""),
                (r"Why isn't Table 12 an error bound?",
                 r"""
It shows that the losses change little as the grid gets finer, which suggests they are close to their limit. It doesn't bound the distance to the limit: a quantity can change slowly under refinement and still be some way from its continuous value. The paper calls it empirical stability, not an error bound.
"""),
                (r"The tests listed in Appendix C: what do they check, and what else does the repository test?",
                 r"""
The paper lists three checks: the constant-cost bounds against the dynamic programs, the scorer against Monte Carlo, and the kernel series against its Laplace transform. The repository at the paper's tag, which is public, has more tests than the paper lists. One, `tests/test_exact_equation.py`, evaluates the exact equation of chapter 5 on the dynamic program's bounds for three schedules: a constant cost, a sinusoid, and a smoothed step. Chapter 5's plates and checks use its grid, cases, and tolerances.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The reference is the exact optimal bound.”",
                 r"It is the optimal policy of the gridded problem with a finite horizon. The paper has not bounded the grid's own discretization error; refining the grid moves losses only slightly ({{ref:app:numerics}})."),
                (r"“The losses come from simulations, so small differences are noise.”",
                 r"There is no sampling error. Small differences can still reflect the grid; Table 12 shows how much they move when the grid is refined."),
                (r"“The 0.5826 shift is a tuning constant.”",
                 r"It is a known constant from sequential analysis, cited (Chernoff 1965; Siegmund 1979; Broadie, Glasserman, and Kou 1997), applied the same way to every continuous-time rule."),
                (r"“The agreement proves the theorem.”",
                 r"It checks the closed form at one cost and one small $\varepsilon$. The theorem is proved; this shows the computation and the proof agree, and {{claim:exp:sweep|the wider sweep}} checks more widely."),
                (r"“The sweep measures the theorem's remainder.”",
                 r"It measures the swing and phase of a fitted sinusoid, not the whole remainder $b_\varepsilon - b_0 - \varepsilon\beta$ ({{claim:claim:limitations|the paper's limitations}})."),
                (r"“Grid refinement proves the numbers are accurate to three decimals.”",
                 r"It shows empirical stability on eight schedules, not an error bound."),
            ]),
        ],
    },
]
