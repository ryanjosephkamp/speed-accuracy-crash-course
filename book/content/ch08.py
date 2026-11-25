"""Chapter 8: the weighted look-ahead rule.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("strip", id) place a live plate, a printed figure, or a proof strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.

The paper's timings of the rule and the dynamic program are typed into its Section 5, not produced by its code;
the book shows them only in the paper's own words (the Computation excerpt) and never types them.
"""

CHAPTER = {
    "slug": "rule",
    "num": 8,
    "title": "The weighted look-ahead rule",
    "full": "The weighted look-ahead rule: averaging the bounds ahead",
    "leaf": 9,
    "finding": "The paper's rule averages the per-moment bounds ahead with the kernel for its own level: exact to first order near a constant cost, and a heuristic beyond.",
    "readings": [
        ("HeldWeightedMax", "the weighted rule's largest loss on the held-out schedules, in points per 100 trials"),
        ("HeldAveragedCostMax", "the averaged-cost rule's largest loss there, on a deadline"),
        ("FixedPointMove", "the most that 300 updates instead of 30 move the weighted rule's bound"),
    ],
    "hero": {
        "aria": "A cost of 0.1 with a forced choice at time 1. From one moment, the kernel for the weighted rule's own level weighs the moments after it; below, the weighted rule's bound comes down toward the deadline, while the averaged-cost rule's bound is zero.",
        "caption": r"""A cost of 0.1 with a forced choice at time 1, the schedule of {{ref:fig:showcase}}(d). Top: from the moment on show, the kernel $w_b$ from its series for the level $b$ the weighted rule gives at that moment (green), with the part of its weight that falls past the deadline in gray; it is the law of the decision time for a bound at that level, from a start drawn from that level's start law ({{ref:lem:kernel}}(b)), and it is cut off at a height of 3 near $s = 0$, where it grows like $s^{-1/2}$. The share in the label is that kernel's exact weight before the deadline. Bottom: the weighted rule's bound (green), the per-moment rule's (dashed), and the averaged-cost rule's, which by its definition is zero throughout (dotted). Bounds are for continuous monitoring, from Algorithm 1's 30 damped updates at every 0.02 time units.""",
        "still": 3,
    },
    "intro": r"""
{{ref:thm:main}} says that, to first order, the best bound at each moment is the constant-cost bound for a weighted average of the coming cost. That suggests two rules that need no dynamic program: average the cost with the kernel and take its bound, or average the per-moment bounds themselves. Both are exact to first order. They differ for large changes, and before a deadline only the second gives a bound above zero. The paper's rule averages the per-moment bounds ahead with the kernel for its own level: exact to first order near a constant cost, and a heuristic beyond. Chapters 9 and 10 judge it by measurement.

Two cautions hold on every page. The rule's equation defines the bound in terms of itself, and the experiments use the output of 30 damped updates, not a chosen solution. And the rule is not faster than the dynamic program on the paper's code; what it offers is an explanation of how far ahead the bound looks, and with what weights.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"def:avg-cost": "two-ways", "def:weighted": "two-ways", "prop:rule": "first-order",
             "alg:weighted": "compute", "claim:not-faster": "compute"}

# which groups of checks in tools/checks/ch08.mjs stand behind each plate
CHECKS = {
    "tworules": ["rule", "avg", "deadline", "endpoint", "program", "words"],
    "iterate": ["rule", "iterate", "endpoint", "words"],
    "contraction": ["p13", "words"],
    "roots": ["roots", "iterate", "words"],
    "algorithm": ["rule", "bins", "endpoint", "words"],
}

PLATES = {
    "tworules": {
        "title": "Average the costs, or the bounds",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, the two rules from their equations, and each rule's loss",
        "caption": r"""Top: your schedule's cost of time, on a log scale. Bottom: the bound the dynamic program exports (ink), the per-moment rule (dashed), the averaged-cost rule $b_{\mathrm{avg}}$ (dotted green), and the weighted rule $b_{\mathrm{w}}$ (green), from Algorithm 1's 30 damped updates. The program and the scorer check the evidence every 0.01 time units on a grid of 0.02, so the rules are moved in by $0.5826\sqrt{0.01}$; the program runs 6 time units past the window, or to the deadline. A deadline you add makes the cost infinite after it. Losses are in points per 100 trials against the program's exported bound, scored the same way on the same grid without sampling; a small negative loss means a rule scored a little above it there. The program's bound is the first grid point past 0 where deciding beats waiting, interpolated. When that point is the grid's first step (0.02), the bound is placed between 0 and that step if the program still waits at 0 (the state line counts those times), and is 0 if the program decides at 0 too; the paper's code reports 0 in both cases. The averaged-cost rule is drawn as the paper defines it. On a deadline the paper's code builds each time's kernel for that time's cost, with its last bin ending at $14/\lambda_1$, and averages the costs only at the 240 bin midpoints; it gives a finite bound at times when no midpoint falls past the deadline. Where that happens, that version is drawn too (faint dots), with its loss. Points are every 0.02 time units, and the last is the window's end or the deadline.""",
        "wide": True,
    },
    "iterate": {
        "title": "Thirty updates",
        "state": "computed",
        "state_text": "Computed in the page: Algorithm 1's damped updates, one at a time",
        "caption": r"""The weighted rule on your schedule after the update you pick (green), the update before it (faint), and the per-moment bound the updates start from (dashed). These are continuous-monitoring bounds, before the algorithm's last line moves them in. Bottom, once you guess: the largest move that each update made at any of the times 0, 0.02, …, 2.5 (or to the deadline), on a log scale, through update 30; the dotted line is 0.001. The last button runs 300 updates at the times 0, 0.01, … before $\min(6, \text{deadline})$, as the paper's check does, and reports the largest move from the 30th.""",
        "wide": True,
    },
    "contraction": {
        "title": "A map that is nearly flat",
        "state": "computed",
        "state_text": "Computed in the page from the kernel's series and Algorithm 1",
        "caption": r"""The cost is $0.1\,(1 + \varepsilon\sin 2t)$, so $c_0 = 0.1$, $\gamma(t) = 0.1\sin 2t$, and $M = 0.1$. Steps 1 and 3: the map $b \mapsto T_\varepsilon(b; t)$ at $t = 0.5$ over the interval $I$ (41 levels, each with its own kernel, integrated as in the two-answers plate), against the diagonal. Step 2: the kernel $w_b$ from the series at the ends of $I$ and at $b_0$, and its derivative in the level at $b_0$. Steps 4 and 5: Algorithm 1's output (levels rounded to 0.001, 240 bins, 30 damped updates) every 0.04 time units, against $b_0 + \varepsilon\beta$ with $\beta$ from the same bins; these are finite computations at four sizes, and the asymptotic statements are the proposition's, about the equation's exact solution. Step 6: $|1 - \tilde w(-i\omega)|$ from the closed form, at $c_0 = 0.1$, sampled every 0.1 from 0 to 20.""",
        "wide": False,
    },
    "roots": {
        "title": "Two levels that both fit",
        "state": "computed",
        "state_text": "Computed in the page: the average for each level, with that level's own kernel",
        "caption": r"""Top: the equation's map $b \mapsto T(b; t)$, the per-moment bounds ahead averaged with the kernel for the level $b$ itself (green), against the diagonal (gray); where they cross, a level averages back to itself. The map is computed on a first step of delay from 0 to $10^{-4}$, then 2400 geometric steps from $10^{-4}$ to 60, split at a drawing's knots, at the time Rising starts to rise, and at a deadline. On the first step, where the kernel grows like $s^{-1/2}$, the per-moment bound is read once, at a third of the step, and weighted by the kernel's weight over the step; on every other step it is replaced by the quadratic through its values at the step's ends and middle, and that is integrated exactly against the kernel, using the kernel's weight and first two moments over the step from its series. In the book's checks, on nine schedules including a drawing that alternates between costs of 2 and 0.01 and Rising from time 2, it agrees with a separate evaluation (Simpson's rule on the kernel's density between the breaks) to within $10^{-6}$ at the levels checked. The brief spike is $\log c$ moving from $\log 4$ to $\log 0.02$ by a logistic of scale 0.05 centered at time 0.2, seen from $t = 0$; or pick your schedule and a time. Crossings are found as sign changes of $T(b) - b$ in this computed map on a grid of 160 levels from 0.01, so a pair of crossings that falls inside one grid step is not found, and where the map comes within about $10^{-6}$ of the diagonal without crossing, the count can be wrong; each crossing is refined by bisection and reported only where $|T(b) - b| < 10^{-6}$ in this map, a threshold for reporting a fit rather than a measure of the map's accuracy. The slope beside each crossing is the local test for the ideal damped update. The ink dot is where Algorithm 1's 30 damped updates from the per-moment bound end, with its levels rounded to 0.001 and its bins read at their midpoints. Bottom: the kernel for your level over the delay $s$ (green), beside the per-moment bounds ahead, $B(c(t + s))$ (dashed).""",
        "wide": False,
    },
    "algorithm": {
        "title": "Algorithm 1, one step at a time",
        "state": "computed",
        "state_text": "Computed in the page, as the paper's code computes the rule",
        "caption": r"""One time $t_k$ on your schedule (pick it). Start: the per-moment bound. Kernel: the level rounded to 0.001 and its kernel's 240 bins, against each bin's midpoint on a log scale of delay. Average: the per-moment bounds ahead (dashed), the kernel (green, scaled to fit), and their weighted average. Update: the level after each of the 30 damped updates. Shift: the result over the window, moved in by $0.5826\sqrt{\Delta t}$ with $\Delta t = 0.01$, beside the bound the dynamic program exports (ink).""",
        "wide": True,
    },
}

STRIPS = {
    "prop13": {
        "plate": "contraction",
        "steps": [
            ("The map sends the interval into itself.",
             r"Let $I = [B(c_0 + |\varepsilon|M), B(c_0 - |\varepsilon|M)]$ and $T_\varepsilon(b; t) = \int_0^\infty w_b(s)\,B(c(t + s))\,ds$. Since $B$ is decreasing and each $w_b$ is a probability density, $\class{lit}{T_\varepsilon(\cdot\,; t) \text{ maps } I \text{ into } I}$."),
            ("Every kernel integrates to one, so its change in the level integrates to zero.",
             r"From the series {{ref:eq:series}} with $b$ in place of $b_0$, $b \mapsto w_b$ is continuously differentiable into $L^1$ on compact sets of levels, with $\|\partial_b w_b\|_{L^1}$ bounded on $I$, and $\class{lit}{\textstyle\int \partial_b w_b = 0}$ because every $w_b$ integrates to one."),
            ("So the map is nearly flat: a contraction, with one fixed point.",
             r"$\class{lit}{|\partial_b T_\varepsilon(b; t)|} = \bigl|\int \partial_b w_b(s)\,[B(c(t + s)) - b_0]\,ds\bigr| \le \|\partial_b w_b\|_{L^1}\,\sup_u |B(c(u)) - b_0| = O(|\varepsilon|)$, so for small $|\varepsilon|$ the map is a contraction on $I$ with a unique fixed point."),
            ("Expand to first order: the fixed point has the theorem's first-order term.",
             r"Expand $B(c(t + s)) = b_0 + \varepsilon B'(c_0)\gamma(t + s) + O(\varepsilon^2)$, and use $|b_{\mathrm{w}}(t) - b_0| = O(\varepsilon)$ and the Lipschitz dependence of $w_b$ on $b$: $\class{lit}{b_{\mathrm{w}}(t) = b_0 + \varepsilon B'(c_0)(w_{b_0} \star \gamma)(t) + O(\varepsilon^2)}$, uniformly in $t$."),
            ("Compare with the theorem: divided by ε, the weighted rule's error goes to 0 (and is O(ε²) for a Lipschitz γ); the per-moment rule's doesn't.",
             r"By {{ref:thm:main}}, $(b_{\mathrm{w}} - b_\varepsilon)/\varepsilon \to 0$ locally uniformly, while $\class{lit}{(b_{\mathrm{pm}} - b_\varepsilon)/\varepsilon \to B'(c_0)(\gamma - w \star \gamma)}$; for a Lipschitz $\gamma$, $b_{\mathrm{w}} - b_\varepsilon = O(\varepsilon^2)$. The same $L^1$ bound shows that $b_{\mathrm{avg}}$ is exact to first order."),
            ("Only a constant change averages to itself.",
             r"If $\gamma = w \star \gamma$ for a bounded continuous $\gamma$, extend $\gamma$ to the whole line by renewal so that $\Gamma = w \star \Gamma$ everywhere. Its distributional Fourier transform is supported where $\class{lit}{\tilde w(-i\xi) = 1}$, which by {{ref:cor:transfer}} is only $\xi = 0$; so $\Gamma$ is a polynomial and, being bounded, a constant."),
        ],
    },
}

SECTIONS = [
    {
        "id": "two-ways",
        "title": "Two ways to use the weights",
        "blocks": [
            ("plain", r"""
{{ref:thm:main}} says that, for a small change in the cost, the best bound at time $t$ is to first order the constant-cost bound evaluated at a weighted average of the coming cost, with the kernel $w$ as the weights. Read as a recipe, that gives two rules, and neither needs a dynamic program.

The first averages the cost, then takes its bound:

$$b_{\mathrm{avg}}(t) = B\bigl((w_{c(t)} \star c)(t)\bigr),$$

where $w_c$ is the kernel for the constant cost $c$, here the current cost. The second averages the per-moment bounds themselves:

$$b_{\mathrm{w}}(t) = \int_0^\infty w_{b_{\mathrm{w}}(t)}(s)\,B\bigl(c(t + s)\bigr)\,ds,$$

where $w_b$ is the kernel computed for the interval $(-b, b)$ and $B(\infty) = 0$. This one uses the kernel for its own level, and it is the paper's weighted look-ahead rule. For a small change, both rules are exact to first order (see the section on {{ref:prop:rule}} below). For a large change, they differ, and a deadline is the extreme case.

The plate draws both on your schedule, over the best bound from the dynamic program, with each rule's loss. Before you add a deadline, guess what the averaged-cost rule will do.
"""),
            ("plate", "tworules"),
            ("plain", r"""
Past a deadline $T$, the cost is infinite, and $B(\infty) = 0$. The kernel is positive at every delay ({{ref:lem:kernel}}(a)), so at any time before $T$ the weighted average of the cost gives infinite values positive weight and is itself infinite. By its definition, the averaged-cost rule's bound is then 0 from the start, which means deciding at once on whatever evidence there is. Averaging bounds instead puts the weight past the deadline on $B(\infty) = 0$ and the rest on finite bounds. For a cost $c_0$ up to the deadline and $t < T$,

$$b_{\mathrm{w}}(t) = B(c_0)\int_0^{T - t} w_{b_{\mathrm{w}}(t)}(s)\,ds,$$

the constant-cost bound times the share of the rule's own kernel that falls before the deadline. As $t$ nears $T$, that share shrinks and the bound comes down. At $T$ the choice is forced, and past $T$ every cost ahead is infinite and the bound is 0; the paper writes this as $b_{\mathrm{w}} = 0$ at and after a deadline. No special case is needed.

The paper's code computes the averaged-cost rule with kernels that end at $14/\lambda_1$ (the bins of {{ref:alg:weighted}}), leaving out less than one part in a million of each kernel's weight. It builds each time's kernel for that time's cost, so how far the kernel reaches changes with the cost, and it reads the costs only at the kernel's 240 bin midpoints. At a time when no midpoint falls past the deadline, the code averages only finite costs and gives a finite bound, even if the last bin's far edge reaches past the deadline; when one does, the code gives 0. On a schedule whose cost changes, the code's bound can be 0 at first, finite for a while, and 0 again. The plate draws the rule as the paper defines it, and, where the code's version differs on your schedule, draws that too, with its loss. The losses the paper measures for this rule come from its code.

A large rise without a deadline shows the same difference in a milder form. Both rules give bounds of at least 0, but they weigh a costly stretch differently. Averaged as bounds, a costly stretch can lower each moment's contribution only toward 0, so its effect is at most its weight times the bound it replaces. Averaged as costs, the same stretch adds its weight times its cost, which has no limit, and as that average grows without limit the bound it gives approaches 0, however short the stretch. For any finite cost the bound stays above 0; only an infinite cost, as past a deadline, gives exactly 0. On the cost that jumps 16-fold, the averaged-cost rule sits far below the best bound well before the jump.

The averaged-cost rule's 0 before a deadline follows exactly from its definition and {{ref:lem:kernel}}(a). What no theorem covers is how well either rule does on a deadline or after a large change. {{ref:thm:main}} and {{ref:prop:rule}} are about small changes in a continuous cost; beyond them, the paper treats both rules as heuristics and judges them by measurement. On the held-out schedules of chapter 10, averaging costs beat the per-moment rule on {{HeldAveragedCostBeats}} of the {{HeldNoDeadlineCount}} without a deadline and lost up to {{HeldAveragedCostMax}} points per 100 trials on deadlines; the weighted rule lost at most {{HeldWeightedMax}} on any of them.
"""),
            ("exact", "590-608", "The paper's two rules"),
            ("exact", "582-588", "Where the paper says the rules are heuristics"),
        ],
    },
    {
        "id": "fixed-point",
        "title": "A bound defined by itself",
        "blocks": [
            ("plain", r"""
The weighted rule's equation has $b_{\mathrm{w}}(t)$ on both sides: the level determines the kernel, and the kernel's average of the per-moment bounds gives the level. The paper solves it by damped fixed-point iteration ({{ref:alg:weighted}}): start from the per-moment bound, average the per-moment bounds ahead with the kernel for the current level, move halfway from the current bound to that average, and do this 30 times. Each time point is solved on its own; the times are linked only through the cost ahead.

The plate runs the 30 updates on your schedule. Guess first: how many updates until no time in the window moves by more than 0.001 in an update?
"""),
            ("plate", "iterate"),
            ("plain", r"""
Where the change is small or slow, the average hardly depends on the level, so each update closes about half of the distance that remains, and the bound settles well within the 30 updates. The moves don't fall all the way to zero, though: the kernel's level is rounded to 0.001, so a time whose level sits near a rounding edge can step back and forth between two kernels by a small amount for as long as the updates run.

On Figure 1(d)'s deadline, Algorithm 1 doesn't settle at some times, 0.70 among them, for a reason that lies in its bins rather than in the equation; at others, such as 0.94, it does. Before the deadline, the per-moment bounds ahead are $B(c_0)$ up to the deadline and 0 past it, and the algorithm reads them at its 240 bin midpoints. As the level changes, the bins move, and when a midpoint crosses the deadline, that bin's whole weight drops out of the average at once. Where such a jump falls near the level the updates are heading for, as at 0.70, they step back and forth across it. Integrated exactly up to the deadline, the average changes smoothly with the level, and the damped updates settle there; the plate in the section on two answers draws that map for your schedule. The plate above shows where the moves stay large on your schedule. For some large, fast changes, such as the pulse, the updates settle slowly: there the average rises almost as fast as the level, so each update closes only a small part of the distance left, and 30 aren't enough.

The paper states that for large and fast changes, 30 updates need not reach a solution of the equation, and that the experiments use the output of the 30th update, an implemented approximation. Its check is that 300 updates instead of 30 move the bound by at most {{FixedPointMove}} before $t = \min(6, \text{deadline})$, and the loss by {{FixedPointLossChange}} points per 100 trials, on the eight schedules of its grid check ({{ref:app:numerics}}). The plate's last button runs the same comparison on your schedule; a small difference there says the two outputs are close, not that either solves the equation.
"""),
            ("exact", "639-644||at each time point.", "The paper's Computation paragraph, as far as the timings"),
            ("exact", "1571-1573|Running 300|", "The paper's check of the iteration, from Appendix C"),
        ],
    },
    {
        "id": "first-order",
        "title": "Why it is first-order exact",
        "blocks": [
            ("plain", r"""
{{ref:prop:rule}} is the rule's one guarantee about its bound; {{ref:prop:loss}} (chapter 7) bounds its reward loss at second order. Both are for small changes around a constant cost. Let the cost be $c_0 + \varepsilon\gamma(t)$ with $\gamma$ continuous and $|\gamma| \le M$. For small $|\varepsilon|$, the rule's equation has exactly one solution at each time in the interval $I = [B(c_0 + |\varepsilon|M), B(c_0 - |\varepsilon|M)]$, and

$$b_{\mathrm{w}}(t) = b_0 + \varepsilon\beta(t) + O(\varepsilon^2)$$

uniformly in $t$, with $\beta = B'(c_0)\,(w \star \gamma)$, the same first-order term as the best bound's in {{ref:thm:main}}. So, against the best bound, the weighted rule's error divided by $\varepsilon$ goes to 0, uniformly over bounded stretches of time, while the per-moment rule's tends to $B'(c_0)(\gamma - w \star \gamma)$, which is not identically zero unless $\gamma$ is constant. If $\gamma$ is also Lipschitz, the weighted rule is within $O(\varepsilon^2)$ of the best bound, uniformly in time. These are statements about the equation's exact solution; the plate computes Algorithm 1's output, with its rounding, its bins, and its 30 updates, at four sizes of change.

The key step is that every kernel integrates to one. Swapping one kernel for a nearby one changes the average of a constant by nothing, so it changes the average of a nearly constant function, such as the per-moment bounds under a small change, only at second order. That makes the right side of the equation nearly flat in the level: a contraction. The proof is six steps. Scrub through them; the plate beside each step draws what the step is about, for $c(t) = 0.1\,(1 + \varepsilon\sin 2t)$.
"""),
            ("strip", "prop13"),
            ("exact", "610-626||a contraction in $b_{\\mathrm{w}}(t)$.", "The paper's proposition and its key step"),
            ("exact", "1476-1513", "The full proof, from Appendix A"),
            ("limits", r"""
**What the proposition covers, and what it doesn't.** Small changes of a continuous cost, bounded between two positive constants, around a constant, on an infinite horizon. It says nothing about large steps, deadlines, or the forced choice at $t = 10$ in the experiments: there the rule is a heuristic motivated by the theorem, and chapters 9 and 10 measure it. The same argument shows that the averaged-cost rule is exact to first order too, so first-order exactness doesn't separate the two rules; large changes do.
"""),
        ],
    },
    {
        "id": "two-answers",
        "title": "When there are two answers",
        "blocks": [
            ("plain", r"""
For a large change, the contraction argument fails, and the equation can have more than one solution. Take a cost that is high for a short time and then low. A small level has a short kernel, which lies on the expensive stretch, where the per-moment bounds are small, so a small level can average back to itself. A large level has a longer kernel, which lies mostly on the cheap stretch that follows, where the per-moment bounds are large, so a large level can average back to itself too.

The plate's brief spike is a cost that starts near 4 and falls toward 0.02, the fall centered at time 0.2. Drag the level and watch where the average of the per-moment bounds comes back to it. Guess first: does one level fit, or more than one?
"""),
            ("plate", "roots"),
            ("plain", r"""
On the spike, the map crosses the diagonal three times: at a small level and a large one, and between them, where it crosses upward, at a third. Near a crossing where the map has slope $s$, the ideal damped update $b \leftarrow \tfrac12(b + T(b))$ has slope $\tfrac12(1 + s)$, so it moves toward the crossing when $-3 < s < 1$ and away from it when $s < -3$ or $s > 1$; at $s = -3$ or $s = 1$, the linear test decides nothing. That is a local test: here it says the iteration can end near either outer level but not at the middle one.

Which level is the rule's? The paper doesn't choose. The experiments use the output of the iteration started from the per-moment bound, and on a schedule like this one that start is small, so the updates end at the small level. That output is an implemented approximation and not a selected root, in the paper's words.

On your own schedule, try the times. At the times 0, 0.1, … up to 0.1 before the window's end, a search for sign changes of $T(b) - b$ at levels 0.02 apart finds one crossing for each of the book's presets at its usual settings. The spike is one example of more than one crossing, not the only kind: a drawing whose cost falls 25-fold between times 0.2 and 0.3 also crosses three times at time 0. On the deadline preset at its usual settings, the search finds one crossing at each sampled time, and the local test says the ideal damped update moves toward it; Algorithm 1 still steps back and forth at some of those times, such as 0.70, because of its bins.
"""),
            ("exact", "626-636|For large changes|No special case is needed.", "The paper's words on more than one solution"),
        ],
    },
    {
        "id": "compute",
        "title": "What it costs to compute",
        "blocks": [
            ("plain", r"""
{{ref:alg:weighted}} is the rule as the experiments compute it. Start from the per-moment bound. Thirty times: at each grid time, round the current level to the nearest 0.001 (using 0.01 for anything below it), look up that level's kernel (built once from 4000 terms of its series, integrated over 240 bins and renormalized, each bin placed at its midpoint, then cached), average the per-moment bounds at those 240 future times with it, and move halfway from the current bound to that average. Finally, move the bound inward by $0.5826\sqrt{\Delta t}$, not below 0, because the scorer checks the evidence only every $\Delta t$. The constant-cost bound comes from a 2001-point table in $\log c$ on $[10^{-5}, 10^4]$, with finite costs clipped to that range and $B(\infty) = 0$.

The plate walks through the algorithm at one time on your schedule.
"""),
            ("plate", "algorithm"),
            ("exact", "649-674", "Algorithm 1, as the paper prints it"),
            ("plain", r"""
On the paper's code, the rule is not faster than the dynamic program. Every update is a weighted sum over 240 future times at each time point, 30 times over, and each new level needs its kernel built from a 4000-term series; the dynamic program is a sequence of convolutions done with the fast Fourier transform. The paper reports its timings in its own words, in the Computation paragraph below. They were measured on one computer and typed into the paper, and its Code and data section says the repository reproduces every number in the paper except them. This book times nothing.

What the rule offers is an explanation: how far ahead the bound looks, and with what weights.
"""),
            ("exact", "638-647", "The paper's Computation paragraph, with its timings"),
            ("exact", "1256-1257", "The paper's Code and data section"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's five highlighted: the two rules, {{ref:prop:rule}}, {{ref:alg:weighted}}, and the statement that the rule is not faster than the dynamic program. The weighted rule uses the per-moment rule (chapter 1) and the kernel (chapter 6); the averaged-cost rule uses the kernel and {{ref:thm:main}}; {{ref:prop:rule}} uses the weighted rule, {{ref:thm:main}}, {{ref:lem:kernel}}, and {{ref:cor:transfer}}; and the algorithm uses the weighted rule, the kernel, and the monitoring shift (chapter 9).

In turn, these use the weighted rule directly: {{ref:prop:rule}} and {{ref:alg:weighted}}, Figure 1's four schedules (chapter 1), the sinusoid check (chapter 9), the development and held-out schedules (chapter 10), unknown reliability (chapter 11), and what moment-by-moment control would have to compute (chapter 12). The held-out schedules also use the averaged-cost rule. {{ref:prop:rule}} is used by the comparison of the two shortcuts (chapter 6), {{ref:conj:loss}} (chapter 7), and what the paper claims as new (chapter 12); the algorithm, by the numerical details (chapter 9) and the statement about speed.
"""),
            ("map", "def:weighted"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why does averaging costs fail on a deadline, when the theorem says it is right to first order?",
                 r"""
The theorem is about small changes. A deadline makes the cost infinite past $T$. The kernel is positive at every delay ({{ref:lem:kernel}}(a)), so the weighted average of a cost that is infinite past $T$ is infinite, and $B(\infty) = 0$: the rule's bound is zero, which means deciding at once on whatever evidence there is. The paper's summary is the sentence in {{ref:sec:rule}}: it fails when the cost becomes infinite. The measured result is the {{HeldAveragedCostMax}}-point loss.
"""),
                (r"The cost is $c_0$ until a deadline $T$. Write the rule's equation for $t < T$, and say what it does as $t \to T$.",
                 r"""
$B(c(t + s))$ is $B(c_0)$ for $s < T - t$ and $B(\infty) = 0$ after, so $b_{\mathrm{w}}(t) = B(c_0)\int_0^{T - t} w_{b_{\mathrm{w}}(t)}(s)\,ds$: the constant-cost bound times the chance that a decision ends before the deadline, when it starts from the start law for the rule's own level and stops at that level ({{ref:lem:kernel}}(b)). The level and its kernel change together, so the equation defines the bound at each $t$ implicitly; the experiments approximate it with the 30-update iteration, which need not reach a solution for large, fast changes. At $T$ the choice is forced, and past $T$ the bound is 0 (the paper writes $b_{\mathrm{w}} = 0$ at and after a deadline). Before $T$, the paper reports what it computes, not a theorem: the bound comes down smoothly toward the deadline ({{ref:fig:showcase}}(d)).
"""),
                (r"Why average bounds rather than costs, if both are first-order exact?",
                 r"""
They differ for large changes. A cost spike can pull the optimal bound down only to zero. In an average of bounds, a huge cost for a moment contributes a bound near zero for that moment, so the most it can remove is that moment's weight times the bound it replaces. In an average of costs, it contributes its weight times the huge cost, which can dominate the average and push the bound close to zero; only an infinite cost gives exactly zero. The deadline is the extreme case, as the first section of this chapter shows.
"""),
                (r"Why the kernel for the rule's own level, and not for the current cost?",
                 r"""
Near a constant cost, either choice gives the same first-order answer, because changing the kernel moves the average only at second order ({{ref:prop:rule}}). For large changes, the level-matched kernel makes the rule self-consistent: its weights are the law of the decision time for a bound at that level, from that level's start law ({{ref:lem:kernel}}(b)). The held-out schedules measure what the iteration adds: a single pass with the kernel for the per-moment bound loses up to {{HeldOnePassMax}} points per 100 trials, against {{HeldWeightedMax}} for the iterated rule (chapter 10).
"""),
                (r"Why does “every $w_b$ integrates to one” make the choice of kernel a second-order effect?",
                 r"""
Split the per-moment bounds into their constant part and the rest: $B(c(t + s)) = b_0 + [B(c(t + s)) - b_0]$. Changing the kernel from $w_{b_0}$ to $w_b$ changes the average of the constant part by $b_0\int(w_b - w_{b_0}) = 0$. It changes the average of the rest by at most $\|w_b - w_{b_0}\|_{L^1}\sup|B(c) - b_0|$, and both factors are $O(\varepsilon)$ (the level is within $O(\varepsilon)$ of $b_0$, and so is every per-moment bound). The product is $O(\varepsilon^2)$.
"""),
                (r"How can the equation have two solutions for a large change?",
                 r"""
Take a cost that is high for a short time and then low. A small level has a short kernel, which puts most of its weight on the high cost; the per-moment bounds it averages are small, so a small level can be self-consistent. A large level has a longer kernel, which puts most of its weight on the low cost that follows; the bounds it averages are large, so a large level can be self-consistent too. The proposition's contraction argument needs the change to be small and doesn't cover this case.
"""),
                (r"Why move halfway each time instead of all the way to the average?",
                 r"""
Damping, an implementation choice: moving halfway, $b \leftarrow \tfrac12(b + a)$, is a common way to keep a fixed-point iteration from overshooting when the map is steep. It isn't a guarantee: {{ref:sec:rule}} says that for large and fast changes, 30 updates need not reach a solution. The paper's check is that 300 updates instead of 30 move the bound by at most {{FixedPointMove}} before $t = \min(6, \text{deadline})$, and the loss over the whole trial by {{FixedPointLossChange}} points per 100 trials.
"""),
                (r"What is the final inward shift for, and why does the dynamic program not need it?",
                 r"""
The rule's bound is a continuous-monitoring bound, but the scorer checks the evidence only every $\Delta t$, which lets paths overshoot. To leading order, the optimal discretely checked boundary sits $0.5826\,\sigma\sqrt{\Delta t}$ inside the continuous one (chapter 9). The dynamic program is solved on the scorer's own grid, so it already accounts for the discreteness.
"""),
                (r"Why isn't a rule built from a closed-form kernel faster than backward induction?",
                 r"""
At every time point and in each of 30 updates, it computes a weighted sum over 240 future times, and it builds a kernel from a 4000-term series for each new level it meets. The dynamic program on the evidence grid is a sequence of convolutions done with the fast Fourier transform, which is already quick on this code. The paper claims no faster way to compute the rule.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“Averaging the cost is the paper's rule.”",
                 r"The paper's rule averages bounds (the paper's definition, equation {{ref:eq:weighted}}). Averaging costs is the first rule the theorem suggests, and the paper reports it as a comparison."),
                (r"“The weighted look-ahead is the optimal rule.”",
                 r"It is first-order exact near a constant cost ({{ref:prop:rule}}) and a heuristic beyond that, judged by measurement."),
                (r"“The rule predicts the future cost.”",
                 r"The cost schedule is known in advance; the rule only weights it. Nothing is forecast."),
                (r"“The experiments solve the rule's equation.”",
                 r"They run 30 damped updates from the per-moment bound. For large and fast changes, that need not reach a solution; 300 updates instead of 30 move the bound by at most {{FixedPointMove}} before $t = \min(6, \text{deadline})$, and the loss by {{FixedPointLossChange}} points per 100 trials ({{ref:app:numerics}})."),
                (r"“{{ref:prop:rule}} covers deadlines.”",
                 r"It covers small changes in a continuous bounded cost. On deadlines, the rule is a heuristic."),
                (r"“The kernel is used exactly.”",
                 r"It is binned: 240 bins on a geometric grid, with the first bin $[0, 10^{-5}]$ holding a quarter of the mass at the smallest level (a typed detail of the algorithm's note)."),
                (r"“The weighted look-ahead is a fast or cheap approximation.”",
                 r"The paper says it is not faster than the dynamic program on its code. What it offers is an explanation, not speed."),
            ]),
        ],
    },
]
