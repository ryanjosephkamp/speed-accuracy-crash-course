"""Chapter 10: the rules on random schedules.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex, {{T:tab:row:col}} for cells of the
generated tables. Blocks: ("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("table", label) place a live plate, a printed figure, or a generated table;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.

Every number this chapter quotes from the paper is a macro or a table cell. The plates draw the paper's per-schedule
results from book/assets/js/ch10-data.js, written by tools/validity/ch10.py from the results files at the tag; what
the page computes itself (a tapped schedule, the reader's schedule, Table 9's shape on the page's grid) is labeled as
the page's own measurement on its coarser grid.
"""

CHAPTER = {
    "slug": "random",
    "num": 10,
    "title": "The rules on random schedules",
    "full": "The rules on random schedules: a development set, a held-out set, and a conjecture tested",
    "leaf": 11,
    "finding": "On schedules fixed in advance and run once, the per-moment rule gives up little reward, and the weighted look-ahead avoids most of that loss.",
    "readings": [
        ("HeldRecoveredMedian", "median share of the per-moment rule's loss that the weighted rule avoids, on held-out schedules where the per-moment rule loses at least 0.01 (%)"),
        ("HeldShareMedian", "median share of the reward the per-moment rule gives up on the held-out schedules (%)"),
        ("HeldWeightedMax", "the weighted rule's largest held-out loss, in points per 100 trials"),
    ],
    "hero": {
        "aria": "The held-out schedules as points, the per-moment rule's loss across and the weighted look-ahead's up, one family at a time, beside the lines of equal loss and of a tenth and a hundredth of it; most points sit below the tenth.",
        "caption": r"""Figure 5's {{HeldCount}} held-out schedules, all of them and then one family at a time, from the paper's results at the tag: each point is a schedule, with the per-moment rule's loss across and the weighted look-ahead's up, in points per 100 trials on log scales, beside the lines of equal loss and of 10% and 1% of it.""",
        "still": 0,
    },
    "intro": r"""
On schedules fixed in advance and run once, the per-moment rule gives up little reward, and the weighted look-ahead avoids most of that loss. This chapter reads the paper's measurements of the two rules where its theorems don't reach: large changes, steps, pulses, and deadlines. First come the 90 development schedules the rule was designed on, then {{HeldCount}} held-out schedules, specified in advance and run once, with five more rules for comparison and a table of how far each rule's bound strays from the optimal one. Then what all this says about reward, and the paper's two tests of its conjectured loss formula.

Every number here is a measurement. Each loss is scored on a grid by moving the chance of each decision time forward, with no sampling, in points per 100 trials against the dynamic program's best policy on the same grid (chapter 9). The plates draw the paper's own results, schedule by schedule, from its results files at the tag. The page also scores your schedule, and any development schedule you tap, with the same rules on a coarser grid, and labels those numbers as its own.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"exp:random": "development", "exp:heldout": "held-out", "claim:pm-close-in-reward": "close",
             "exp:loss-formula": "conjecture", "exp:loss-scaling": "scaling"}

# which groups of checks in tools/checks/ch10.mjs stand behind each plate
CHECKS = {
    "dev": ["data", "dev", "rules", "grid", "words"],
    "held": ["data", "held", "words"],
    "seven": ["data", "seven", "words"],
    "yours": ["rules", "grid", "edges", "words"],
    "share": ["data", "share", "edges", "words"],
    "formula": ["formula", "words"],
    "scaling": ["scaling", "rules", "words"],
}

PLATES = {
    "dev": {
        "title": "The development schedules, one by one",
        "state": "measured",
        "state_text": "From the paper's results at the tag; a schedule you tap is solved in the page",
        "caption": r"""Each development schedule's loss under the per-moment rule (slate, left in each family) and the weighted look-ahead (green, right), in points per 100 trials on a log scale, from the paper's results file at the tag (seed 2026). Losses below $10^{-4}$, including a few slightly negative ones where a rule scored a little above the program on the grid, are drawn at $10^{-4}$, as in the paper's Figure 4; within a family, points are spread sideways by a fixed jitter. Tap a point to draw its schedule: its cost (top, log scale) and, over $0 \le t \le 4$ or to the deadline, the best bound from a dynamic program (ink), the per-moment rule (dashed), and the weighted rule (green). These are solved in the page on a grid that checks the evidence every 0.01 time units with an evidence step of 0.02 and forces the choice at $t = 10$ or at the deadline, as the paper's experiments do, and scored on that grid without sampling. The paper's losses come from a grid five times finer in time and four times finer in evidence. Your schedule, scored the same way on the page's grid, is the orange ring in its own column; it is not one of the 90.""",
        "wide": True,
    },
    "held": {
        "title": "Two losses per schedule",
        "state": "measured",
        "state_text": "From the paper's results at the tag; your schedule is computed in the page",
        "caption": r"""Each of the {{HeldCount}} held-out schedules (seed 20261111) as a point: the per-moment rule's loss across and the weighted look-ahead's up, in points per 100 trials on log scales, from the paper's results file at the tag. Losses below $10^{-5}$, including a few slightly negative ones, are drawn at $10^{-5}$, as in the paper's Figure 5. The solid gray line is equal loss; the dashed ones are losses of 10% and 1% of the per-moment rule's. Circles are smooth, pulse, and ramp schedules; triangles are steps, multi-steps, and piecewise schedules; squares are deadlines, the paper's grouping. Your guess is the orange line, and the median share avoided, over the schedules where the per-moment rule loses at least 0.01, is the green one. The orange ring is your schedule, scored in the page on its coarser grid (every 0.01 time units, evidence step 0.02, forced choice at $t = 10$ or the deadline); it is not one of the held-out schedules.""",
        "wide": False,
    },
    "seven": {
        "title": "Six rules against the per-moment rule",
        "state": "measured",
        "state_text": "From the paper's results at the tag; your schedule is computed in the page",
        "caption": r"""One panel per rule: each held-out schedule's loss under that rule (up) against its loss under the per-moment rule (across), in points per 100 trials on log scales, with losses below $10^{-5}$ drawn at $10^{-5}$ and the axes ending at 50. Below the diagonal, the rule loses less. Filled dots are the {{HeldNoDeadlineCount}} schedules without a deadline, the ones Table 6's wins and losses count (a difference of more than $10^{-9}$); hollow squares are the 30 deadlines. The counts in the panel titles are computed in the page from the paper's results file. The orange ring is your schedule, scored on the page's grid, in every panel.""",
        "wide": True,
    },
    "yours": {
        "title": "Seven rules on your schedule",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program and seven rules on a grid, each scored without sampling",
        "caption": r"""Top: your schedule's cost of time, on a log scale. Bottom: over $0 \le t \le 4$ or to the deadline, the best bound from a dynamic program (ink), the per-moment rule (dashed), the weighted look-ahead (green), and one more rule you pick (gray). The program and the scorer check the evidence every 0.01 time units on an evidence grid of 0.02, with bounds capped at 5, and force the choice at $t = 10$ or at the deadline, as the paper's experiments do; the rules other than the tuned constant are moved in by $0.5826\sqrt{0.01}$. The rules are the held-out test's, as the paper's code defines them: the averaged-cost rule as that code computes it, and the tuned constant searched with the scorer on $[0.02, 4]$ with tolerance 0.005. The table gives each rule's loss in points per 100 trials (less than the per-moment rule's is a win, as Table 6 counts it) and Table 7's three readouts for this one schedule: the largest gap between its bound and the program's before $t = 4$ or the deadline (both capped at 4), and its change in accuracy and in mean decision time from the program's.""",
        "wide": True,
    },
    "share": {
        "title": "Close in reward, wrong in timing",
        "state": "measured",
        "state_text": "From the paper's results at the tag; your schedule is computed in the page",
        "caption": r"""Top: each held-out schedule's per-moment loss as a share of the best policy's reward (up, log scale) against the largest gap between the per-moment bound and the optimal one before $t = 4$ or the deadline (across, in evidence units), from the paper's results file at the tag. The few shares below 0.0001%, one of them slightly negative, are drawn at 0.0001%. Your guess is the orange line, and the median share the green one. Bottom: on your schedule, the per-moment bound minus the best bound (dashed) and the weighted rule's bound minus the best bound (green), over $0 \le t \le 4$ or to the deadline, from the same run as the plate before, on the page's grid; the readings give that schedule's per-moment loss and its share of the reward.""",
        "wide": False,
    },
    "formula": {
        "title": "The loss formula, tested",
        "state": "conjecture",
        "state_text": "Conjecture 11, not proved: the paper's test of it, from its results at the tag",
        "caption": r"""Table 8's six rows. Top: for each row, the formula's prediction divided by the scored loss, both summed over the row's six schedules (seed 7), for the per-moment rule (slate) and the weighted look-ahead (green), from the paper's results file at the tag; the dashed gray line at 1 is agreement. Bottom: the share of the weighted rule's prediction that comes from grid times after $t = 8$, from the same file. All of it is computed on the paper's grid, with the choice forced at $t = 10$ and that last grid time left out of the sum.""",
        "wide": False,
    },
    "scaling": {
        "title": "How the loss grows",
        "state": "measured",
        "state_text": "From the paper's results at the tag; the page's own grid when you run it",
        "caption": r"""Table 9's shape, $c(t) = {{ScalingCost}}\,e^{a f(t)}$, at five amplitudes: each rule's loss in points per 100 trials against $a$, on log axes, from the paper's results file at the tag. Slate: the per-moment rule on the paper's grid. Green: the weighted look-ahead on the paper's grid (filled) and on the grid twice as fine (hollow). A loss at or below 0 can't sit on a log axis; it is marked at the foot of the chart with its sign. The dashed guides have slopes 2 and 4. The effective orders are computed from the file's unrounded losses, between the amplitudes the paper uses. Run on this page's grid (every 0.01 time units, evidence step 0.02, forced choice at $t = 10$), the same losses are drawn as crosses, with the per-moment loss this grid scores at the constant cost {{ScalingCost}} (dotted), where the rule is optimal on an infinite horizon with continuous checking.""",
        "wide": False,
    },
}

STRIPS = {}

SECTIONS = [
    {
        "id": "development",
        "title": "Ninety schedules the rule was designed on",
        "blocks": [
            ("plain", r"""
The theorems of chapters 6 to 8 are about small changes in a continuous cost. The paper's random schedules test the two rules beyond them. It drew 90 development schedules from seed 2026, the seed used while the weighted rule was designed, 30 in each of three families:

- *Smooth:* $\log c(t) = \log c_0 + \sum_{j=1}^3 a_j\sin(\omega_j t + \phi_j)$, with $c_0$ log-uniform on $[0.02, 0.5]$, each $a_j$ uniform on $[-\tfrac23, \tfrac23]$, each $\omega_j$ uniform on $[0.3, 6]$, and each phase uniform.
- *Step:* a jump from $c_0$ to $c_0 r$ at a time $t_0$, logistic in time with scale 0.05, with $c_0$ log-uniform on $[0.02, 1]$, $r$ log-uniform on $[\tfrac1{16}, 16]$, and $t_0$ uniform on $[0.1, 2]$.
- *Deadline:* a constant cost $c_0$, log-uniform on $[0.01, 0.5]$, and a forced choice at a time $T$ uniform on $[0.3, 3]$.

Without a deadline, the choice is forced at $t = 10$. The per-moment rule loses up to {{PerMomentMaxAll}} points per 100 trials; the weighted look-ahead loses at most {{WeightedMaxAll}}. Measured as total loss, the weighted rule recovers {{RecoveredSmooth}}% of the per-moment rule's loss on smooth schedules, {{RecoveredStep}}% on steps, and {{RecoveredDeadline}}% on deadlines. That share is one minus the ratio of the family's two total losses, so the schedules with large losses count the most.

Guess first: in which family does the weighted rule recover the smallest share?
"""),
            ("plate", "dev"),
            ("plain", r"""
Deadlines are where the weighted rule recovers the least, and where its median loss is largest: {{T:tab_random:3:5}} points per 100 trials, against {{T:tab_random:1:5}} on smooth schedules and {{T:tab_random:2:5}} on steps. Its largest single loss, {{T:tab_random:2:6}}, is on a step. In each family, its median loss is less than a tenth of the per-moment rule's.

One caution goes with every number in this section. These schedules come from the seed used while the rule was designed, so a good result on them could partly reflect choices made while looking at them. That is why the paper ran a second set.
"""),
            ("table", "tab:random"),
            ("figure", "random_losses"),
            ("exact", "772-788", "The paper's development schedules"),
        ],
    },
    {
        "id": "held-out",
        "title": "{{HeldCount}} schedules, fixed in advance and run once",
        "blocks": [
            ("plain", r"""
To test the rule on schedules it wasn't shaped by, the paper specified a held-out set before running it, and ran it once: seed 20261111, {{HeldCount}} schedules, 30 in each of seven families. Three are the development families, drawn again with the new seed, and four are new:

- *Pulse:* a Gaussian bump in $\log c$ that changes the cost by up to 8-fold either way.
- *Ramp:* $\log c$ changing linearly over a random time, so that the cost changes by up to 16-fold either way, then flat.
- *Multi-step:* two to four steps, each changing the cost by up to 4-fold either way.
- *Piecewise:* a cost constant on random intervals, about 0.45 time units long on average, at levels drawn independently and log-uniformly from $[0.02, 1]$.

Multi-step and piecewise schedules have their joins smoothed in $\log c$ by the same logistic as the steps. The per-moment rule loses a median of {{HeldPerMomentMedian}} points per 100 trials ({{HeldShareMedian}}% of the reward) and at most {{HeldPerMomentMax}}; the weighted look-ahead loses at most {{HeldWeightedMax}}.

The plate plots each schedule's two losses against each other. A point on the diagonal is a schedule where the two rules lose the same. A point on the line marked 10% is one where the weighted rule loses a tenth of what the per-moment rule loses, so it avoids 90% of that loss. Before the points appear, guess: on a typical held-out schedule, what share of the per-moment rule's loss does the weighted rule avoid?
"""),
            ("plate", "held"),
            ("plain", r"""
The paper measures that share schedule by schedule, but only where there is a loss to avoid: on the {{HeldRecoveredCount}} schedules where the per-moment rule loses at least 0.01 point per 100 trials. There, the weighted rule recovers a median of {{HeldRecoveredMedian}}%, with a 10th percentile of {{HeldRecoveredPTen}}% and a minimum of {{HeldRecoveredMin}}%. Piecewise schedules are the hardest: their median is {{T:tab_heldout:7:7}} and their 10th percentile {{T:tab_heldout:7:8}}, the lowest of the seven families, and the weighted rule's largest loss, {{T:tab_heldout:7:6}}, is on one of them.

Table 5 gives both kinds of share: the median and 10th percentile schedule by schedule, and, in its last column, one minus the ratio of the family's total losses, the measure of Table 3.
"""),
            ("table", "tab:heldout"),
            ("figure", "heldout_paired"),
            ("exact", "832-845|The 90 schedules|by the same logistic.", "The paper's held-out set"),
            ("exact", "851-856||piecewise schedules are the hardest.", "What it finds"),
            ("limits", r"""
**What the held-out test shows, and what it doesn't.** It is a measurement on seven families of random schedules, specified before the set was run, on the paper's grid with the choice forced at $t = 10$ or at the deadline. It is the paper's test of whether the rule's results on the development set depended on choices made while looking at those schedules. It proves nothing about large changes, which stay outside the theorems, and it says nothing about families it didn't draw.
"""),
        ],
    },
    {
        "id": "more-rules",
        "title": "Five more rules",
        "blocks": [
            ("plain", r"""
The paper also scored five more rules on the held-out schedules, each a shortcut that the theory of chapters 6 to 8 might suggest instead:

- *Weighted, one pass:* the weighted look-ahead's average of the per-moment bounds ahead, taken once, with the kernel for the per-moment bound and no iteration.
- *Averaged cost:* $b_{\mathrm{avg}}(t) = B\bigl((w_{c(t)} \star c)(t)\bigr)$, the bound for the kernel-weighted average of the coming cost (chapter 8).
- *Shift by the mean look-ahead:* $B\bigl(c(t + m(c(t)))\bigr)$, the per-moment rule for the cost one mean look-ahead later, where $m(c)$ is the kernel's mean at the cost $c$.
- *Shift by 0.5:* $B\bigl(c(t + \tfrac12)\bigr)$. Half a time unit is the limit of the mean look-ahead as the cost goes to 0 ({{ref:cor:limits}}(b)).
- *Tuned constant:* a single flat evidence bound for each schedule, chosen by searching with the scorer itself on that schedule. The paper calls it an oracle rather than a usable rule.

Table 6 counts, on the {{HeldNoDeadlineCount}} schedules without a deadline, how often each rule loses less than the per-moment rule and how often more. They are a different set from the {{HeldRecoveredCount}} of the last section, of the same size by coincidence. The plate draws each rule against the per-moment rule, schedule by schedule.
"""),
            ("plate", "seven"),
            ("plain", r"""
Reading the panels with Table 6:

- Both versions of the weighted look-ahead lose less than the per-moment rule on every one of the {{HeldNoDeadlineCount}} ({{T:tab_baselines:2:5}} and {{T:tab_baselines:3:5}}). A single pass loses up to {{HeldOnePassMax}}, against {{HeldWeightedMax}} for the iterated rule, so the iteration matters in the worst cases.
- Averaging costs beats the per-moment rule on {{HeldAveragedCostBeats}} of the {{HeldNoDeadlineCount}}, but fails on deadlines, with losses up to {{HeldAveragedCostMax}}, as {{ref:sec:rule}} predicts. Chapter 8 explains why: in an average of costs, the infinite cost past a deadline drives the bound to 0 (in the paper's code, once the deadline comes within reach of its binned kernels).
- Shifting by the mean look-ahead is worse than not shifting at all on {{HeldShiftMeanWorse}} of the {{HeldNoDeadlineCount}}, so the kernel's shape matters, not only its mean. A shift reads the cost at a single delay; the weighted rule averages the bounds over every delay with the kernel's weights.
- Even the tuned constant beats the per-moment rule on only {{HeldBestConstantBeats}} of them: the best flat bound the search finds for a schedule usually does worse than a bound that follows the cost.
"""),
            ("table", "tab:baselines"),
            ("exact", "845-849|We also scored|usable rule.", "The paper's five more rules"),
            ("exact", "857-865|Away from deadlines|schedules without a deadline.", "What it finds"),
        ],
    },
    {
        "id": "behavior",
        "title": "How far the bounds are from the optimal one",
        "blocks": [
            ("plain", r"""
Loss is one summary. Table 7 gives three others, as medians over each family of held-out schedules: the largest gap between the rule's bound and the optimal one before $t = 4$ (or the deadline), in evidence units; the change in accuracy, in percentage points; and the change in mean decision time, in units of $\sigma^2/\mu^2$, each relative to the optimal policy.

The per-moment rule's bound strays far: its median largest gap runs from {{T:tab_behavior:5:2}} on ramps to {{T:tab_behavior:3:2}} on deadlines, against {{T:tab_behavior:5:3}} to {{T:tab_behavior:7:3}} for the weighted rule. The largest median change in its accuracy is {{T:tab_behavior:7:4}} percentage points, on piecewise schedules. On deadlines, the median changes are {{T:tab_behavior:3:4}} percentage points in accuracy and {{T:tab_behavior:3:6}} in mean decision time: the per-moment bound stays at $B(c_0)$ right up to the forced choice while the optimal bound comes down toward it, so the rule decides later and a little more accurately, and pays for the extra time.
"""),
            ("table", "tab:behavior"),
            ("plain", r"""
For your schedule, the plate scores all seven rules and gives the same three readouts. They are one schedule's numbers on the page's grid, not a family's median.
"""),
            ("plate", "yours"),
            ("plain", r"""
The page's grid checks the evidence every 0.01 time units on an evidence grid of 0.02: five times coarser in time and four times in evidence than the paper's. Its losses are its own measurement. Its rules, its program, and its scorer are held to the paper's code run on the same grid, on the book's schedules and on some of the paper's own (the line under the plate counts those checks). On the paper's schedules that the checks run, its per-moment losses come within 5% of the paper's. Its weighted losses, which are far smaller, agree less closely: within 30% where they are at least 0.001, and below that they can differ even in sign, beyond what this grid resolves.
"""),
            ("exact", r"865-866|\Cref{tab:behavior} reports|decision time.", "The paper's words"),
        ],
    },
    {
        "id": "close",
        "title": "Close in reward, wrong in timing",
        "blocks": [
            ("plain", r"""
The per-moment rule's bound is wrong at first order: divided by the size of a small change, its error doesn't shrink to 0 (chapter 6). In reward, though, it is already close to optimal. That is consistent with {{ref:prop:loss}}, which covers small changes: an error of order $\varepsilon$ in the bound costs reward only of order $\varepsilon^2$, because the reward is flat at its peak (chapter 7).

The held-out schedules measure it for changes that aren't small. The per-moment rule gives up a median of {{HeldShareMedian}}% of the reward. It loses under 0.1 point per 100 trials on {{HeldPerMomentUnderTenth}} of the {{HeldCount}} schedules, and 1 or more on only {{HeldPerMomentOverOne}}, up to {{HeldPerMomentMax}} on the worst.

Guess before the plate draws them: on a typical held-out schedule, what share of the reward does the per-moment rule give up?
"""),
            ("plate", "share"),
            ("plain", r"""
The two charts make the claim. Across the held-out schedules, the per-moment rule's largest bound gap before $t = 4$ has family medians from {{T:tab_behavior:5:2}} to {{T:tab_behavior:3:2}} evidence units (Table 7), while the share of the reward it gives up has a median of {{HeldShareMedian}}%. On your schedule, the bottom chart draws that gap over time.

What the look-ahead changes is where the bound sits and when it moves. So, in the words that end the first paragraph of the paper's Section 9, the look-ahead's “clearest test is not accuracy or reward, but the timing of an urgency signal” (chapter 12).
"""),
            ("exact", "144-147|In reward|moves.,1207-1212", "The paper's words: its introduction, and the start of Section 9"),
            ("limits", r"""
**What is measured, and what is proved.** Measured: the losses and shares on the held-out schedules. Proved: {{ref:prop:loss}}, for small changes around a constant cost, a fixed start, and bounds within a constant times $\varepsilon$ of $b_0$. The held-out schedules have large changes and deadlines, outside the proposition; the measurement is consistent with it, not a consequence of it.
"""),
        ],
    },
    {
        "id": "conjecture",
        "title": "Testing a conjecture",
        "blocks": [
            ("md", r"""
**This section tests a conjecture.** The paper states {{ref:conj:loss}} without proof (chapter 7). The two tables here are measurements that test it, not proofs of it.
"""),
            ("plain", r"""
{{ref:conj:loss}} says that a policy whose bound misses the best bound by a small $\eta(t)$ should lose about $\mathbb{E}\bigl[c(\hat\tau)\,\eta(\hat\tau)^2\bigr]$ of reward, where $\hat\tau$ is its decision time. On a grid, that is a sum over the grid times $t_j$:

$$\text{predicted loss} = 100\sum_j f_j\,c(t_j)\,\eta(t_j)^2,$$

in points per 100 trials, with $f_j$ the chance of deciding at $t_j$ under the rule, computed on the grid without sampling, and $\eta$ the rule's distance from the optimal bound. The sum leaves out the last grid time, $t = 10$: there the scorer forces every undecided trial to choose, whatever either bound says, so a gap between the bounds costs nothing.

The paper tests it on 36 schedules from seed 7: six smooth schedules at each of three sizes and six steps at each of three ratios, with base costs log-uniform on $[0.03, 0.3]$. A smooth schedule of size $a$ has its three amplitudes of $\log c$ uniform on $[-\tfrac23 a, \tfrac23 a]$; the steps alternate up and down. At the largest ratio, 16-fold, the per-moment rule's bound error is no longer small. Guess first: does the formula over- or underestimate the per-moment rule's loss there?
"""),
            ("plate", "formula"),
            ("plain", r"""
For the per-moment rule, the formula overestimates the loss by {{LossPmLow}} to {{LossPmHigh}}% for smooth schedules and for steps up to threefold, and by {{LossPmSixteen}}% for the 16-fold steps. For the weighted rule, whose total loss is about {{LossTotalRatio}} times smaller, it overestimates by a factor of {{LossWbLow}} to {{LossWbHigh}}. At the smallest size of each family, most of the weighted rule's prediction comes from $t > 8$, where the optimal bound collapses toward the forced choice at $t = 10$ and the rules, which ignore it, don't. There the gap isn't small, so the formula need not hold, and that part of the prediction compares rules that ignore the horizon with the finite-horizon optimum. So Table 8 tests the formula for the per-moment rule and says little about the weighted rule.
"""),
            ("table", "tab:loss"),
            ("exact", "938-955", "The paper's test of the formula"),
        ],
    },
    {
        "id": "scaling",
        "title": "How the loss grows with the change",
        "blocks": [
            ("plain", r"""
Each row of Table 8 draws new schedules, so it can't show how a loss grows with the size of the change. Table 9 does, for one smooth shape scaled in $\log c$ around $c_0 = {{ScalingCost}}$, where decisions are short and the forced choice at $t = 10$ hardly matters:

$$c(t) = {{ScalingCost}}\,e^{a f(t)}, \qquad f(t) = 0.6\sin(1.3t + 0.4) + 0.5\sin(3.1t + 2) + 0.4\sin(5.2t + 4).$$

Each amplitude is scored on the paper's grid and again on one twice as fine in time and space. If a loss grows like $a^p$, doubling $a$ multiplies it by $2^p$: by 4 for a loss of second order, and by 16 for one of fourth order. Guess the two growth factors before the plate draws the points.
"""),
            ("plate", "scaling"),
            ("plain", r"""
Up to $a = 0.4$, each doubling multiplies the per-moment rule's loss by {{ScalingPmGrowthLow}} to {{ScalingPmGrowthHigh}}, close to the 4 of a second-order loss; its effective order there, the slope of log loss against log amplitude, is {{ScalingPmOrder}}. The weighted rule's loss is far smaller. The paper reads its order only from $a = 0.2$ up, where the two grids agree on it to within {{ScalingGridChangeTwo}}% at $a = 0.2$ and better above. At $a = 0.1$ they happen to agree more closely, on losses of only {{T:tab_scaling:2:4}} and {{T:tab_scaling:2:5}} points, and at the smallest amplitude its sign differs between them. From $a = 0.2$ to 0.8, its effective order is {{ScalingWbOrderLow}} on one grid and {{ScalingWbOrderHigh}} on the other. That is consistent with the heuristic fourth order of chapter 7, but it is a measurement over a short range, not an asymptotic result.

The page's own grid is coarser than both. Run the shape on it, and the weighted rule's losses at the small amplitudes come out no larger in size than what the grid scores for the per-moment rule at the constant cost, where that rule is optimal: a grid can't measure a loss below its own error.
"""),
            ("table", "tab:scaling"),
            ("exact", "957-969", "The paper's scaling test"),
            ("limits", r"""
**What these two tests show, and what they don't.** Table 8 supports {{ref:conj:loss}} for the per-moment rule at moderate sizes, on 36 schedules; it doesn't prove it, and it says little about the weighted rule. Table 9 measures effective orders on one shape over short ranges of amplitude: {{ScalingPmOrder}} for the per-moment rule from $a = 0.05$ to 0.4, consistent with the second-order bound of {{ref:prop:loss}}, and {{ScalingWbOrderLow}} to {{ScalingWbOrderHigh}} for the weighted rule from $a = 0.2$ to 0.8, consistent with the fourth order a heuristic suggests. Neither is an asymptotic statement.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's five highlighted: the development schedules, the held-out schedules with the five more rules, the per-moment rule's closeness in reward, and the two tests of the loss formula.

The development and held-out schedules use the per-moment rule (chapter 1), the weighted look-ahead (chapter 8), scoring without sampling, and the monitoring shift (chapter 9); the held-out test also uses the averaged-cost rule (chapter 8) and the limits of the mean look-ahead ({{ref:cor:limits}}, chapter 7), behind its shifted rules. The claim that the per-moment rule is close in reward uses {{ref:prop:loss}} (chapter 7) and the held-out measurements. The loss formula's test uses {{ref:conj:loss}} and scoring without sampling; the scaling test uses both of chapter 7's loss results and the same scoring. No claim outside this chapter uses these five.
"""),
            ("map", "exp:heldout"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"What does “recovers {{RecoveredSmooth}}% … measured as total loss” mean, and how could it differ from a per-schedule average?",
                 r"""
It is one minus the ratio of totals over the family: $1 - \sum(\text{weighted losses})/\sum(\text{per-moment losses})$. Schedules where the per-moment rule loses a lot dominate the totals. A per-schedule figure (the median of $1 - \text{weighted}/\text{per-moment}$, as the held-out set reports it) weights every schedule equally, and can be lower or higher.
"""),
                (r"Why does it matter that the 90 are development schedules?",
                 r"""
The paper says they come from the seed used while the rule was designed, so good results on them could partly reflect choices made while looking at these schedules. The held-out set exists to test the rule on schedules it wasn't shaped by ({{claim:exp:heldout}}).
"""),
                (r"The held-out paragraph mentions 180 schedules twice. Are they the same 180?",
                 r"""
No. The first is the schedules where the per-moment rule loses at least 0.01 point per 100 trials ({{HeldRecoveredCount}}). The second is the schedules without a deadline ({{HeldNoDeadlineCount}}: six families of 30). The paper says they are different sets of the same size by coincidence.
"""),
                (r"Read Table 6. Which rules beat the per-moment rule on every schedule without a deadline, and which on fewer than half?",
                 r"""
The weighted look-ahead and its single-pass version both have {{T:tab_baselines:2:5}} and {{T:tab_baselines:3:5}} wins and losses. Averaging costs has {{T:tab_baselines:4:5}}. Shifting by the mean look-ahead ({{T:tab_baselines:5:5}}) wins on just over half; shifting by half a time unit ({{T:tab_baselines:6:5}}) and the tuned constant ({{T:tab_baselines:7:5}}) beat it on fewer than half.
"""),
                (r"Why is the tuned constant called an oracle?",
                 r"""
For each schedule, its single flat bound is tuned separately, by searching with the scorer itself on that schedule. The schedule is known, so a decision maker with the model and the scorer could compute it; the paper calls it an oracle because it is the best flat bound found by scoring that very schedule, a benchmark rather than a rule built from the theory. It shows that the per-moment rule's changes over time are worth having: even the best flat bound the search found beats it on only {{HeldBestConstantBeats}} of the {{HeldNoDeadlineCount}} schedules without a deadline.
"""),
                (r"Read Table 7's deadline row. How far does each rule's bound stray, and what happens to accuracy and decision time?",
                 r"""
On deadlines, the per-moment bound's largest gap from the optimal bound has a median of {{T:tab_behavior:3:2}} evidence units, against {{T:tab_behavior:3:3}} for the weighted rule. The per-moment rule's accuracy changes by a median of {{T:tab_behavior:3:4}} percentage points and its mean decision time by {{T:tab_behavior:3:6}}, against {{T:tab_behavior:3:5}} and {{T:tab_behavior:3:7}} for the weighted rule. These are medians over the family, relative to the optimal policy.
"""),
                (r"If the per-moment rule loses so little, why does the paper matter?",
                 r"""
Three reasons. The look-ahead changes where the bound sits and when it moves, which the paper names as its clearest test: the timing of an urgency signal ({{claim:claim:urgency}}). It explains what the dynamic program computes: how far ahead the best bound looks, and with what weights (chapters 6 and 7). And the worst cases are not small: up to {{HeldPerMomentMax}} points per 100 trials on the held-out set.
"""),
                (r"Why does the formula's prediction leave out $t = 10$?",
                 r"""
At the last grid time, the scorer forces every undecided trial to choose by the sign of its evidence, whatever either bound says, so two different bounds there give the same choice and the same reward: a gap between them costs nothing. Including that time would charge the formula for gaps that have no effect.
"""),
                (r"Why does Table 8 say little about the weighted rule?",
                 r"""
Its losses are tiny, and at the smallest sizes most of the formula's prediction for it comes from $t > 8$, where the optimal bound collapses toward the forced choice at $t = 10$ and the rules, which ignore the horizon, don't. There, the gap between the bounds is not small, so the formula, a statement about small gaps, need not hold, and that part of the prediction comes from comparing rules that ignore the horizon with a finite-horizon optimum.
"""),
                (r"What is an “effective order,” and how does a growth factor of 4 per doubling give order 2?",
                 r"""
If the loss is about $K a^p$, then $\log(L(a_2)/L(a_1))/\log(a_2/a_1) = p$; that ratio, measured, is the effective order. A doubling of $a$ that multiplies the loss by 4 gives $p = \log 4/\log 2 = 2$.
"""),
                (r"Why aren't the weighted rule's losses at the smallest amplitudes used for its order?",
                 r"""
At $a = 0.05$, the two grids disagree even in sign ({{T:tab_scaling:1:4}} against {{T:tab_scaling:1:5}}): the loss is below what the grid resolves. At $a = 0.1$, the two values are close ({{T:tab_scaling:2:4}} and {{T:tab_scaling:2:5}}), but both are tiny, and the paper estimates the effective order only from $a = 0.2$ to 0.8, where it reports that the grids agree to within {{ScalingGridChangeTwo}}% or better.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The weighted rule recovers nearly all of the loss on every schedule.”",
                 r"The development figures are shares of each family's total loss. Schedule by schedule, the share varies: on the held-out set, its 10th percentile is {{HeldRecoveredPTen}}% and its minimum {{HeldRecoveredMin}}%."),
                (r"“The weighted rule always recovers at least nine-tenths of the loss.”",
                 r"{{HeldRecoveredPTen}}% is the 10th percentile; the minimum is {{HeldRecoveredMin}}%, and piecewise schedules are the hardest."),
                (r"“Shifting the 2025 rule by the mean look-ahead captures the result.”",
                 r"On {{HeldShiftMeanWorse}} of the {{HeldNoDeadlineCount}} schedules without a deadline, it is worse than no shift; the kernel's shape matters."),
                (r"“The held-out test makes the rule proved for large changes.”",
                 r"It is a measurement on seven families. Large changes stay outside the theorems."),
                (r"“The look-ahead barely matters.”",
                 r"It barely matters in reward on typical schedules. It matters for the bound's timing, which is what the paper's prediction is about."),
                (r"“Table 8 confirms the conjecture.”",
                 r"It supports it for the per-moment rule at moderate sizes. It doesn't prove it, and it says little about the weighted rule."),
                (r"“The weighted rule's loss is fourth order.”",
                 r"Effective orders of {{ScalingWbOrderLow}} and {{ScalingWbOrderHigh}} over $a$ from 0.2 to 0.8 are consistent with four; the paper calls it a measurement over a short range."),
            ]),
        ],
    },
]
