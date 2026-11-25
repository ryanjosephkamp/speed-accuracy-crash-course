"""Chapter 4: the best bound and its shape.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("strip", id) place a live plate, a printed figure, or a proof strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "shape",
    "num": 4,
    "title": "The best bound and its shape",
    "full": "The best bound and its shape: one level at each moment, a band it can't leave, and the decision time",
    "leaf": 5,
    "finding": "For a continuous cost between two positive levels, the best rule stops when the evidence first reaches one level, which stays between the extreme costs' flat bounds.",
    "readings": [
        ("BoundTenth", "the flat bound at a cost of 0.1: about the top of Figure 1(a)'s band, since its cost starts a little above 0.1 and rises to 1.6"),
        ("DecisionTimeTenth", "the mean time from evidence 0 to first reach that bound, b tanh b: about the mean cap time in the optimal stopping facts for Figure 1(a), in the continuous model"),
    ],
    "hero": {
        "aria": "Four cost schedules in turn, each with its lowest and highest cost marked, and below it the best bound inside the band between the same program's bounds for those two constant costs",
        "caption": "Four of the book's schedules in turn: the cost of time (orange), with the lowest and highest levels it reaches or approaches over all time (dotted), and below it the best bound from a dynamic program solved in this page (ink), inside the band between the same program's bounds for those two constant costs (gray), beside the per-moment rule's bound (dashed). The dashed lines are the continuous flat bounds moved in by the program's monitoring shift, to leading order.",
        "still": 0,
    },
    "intro": r"""
For a continuous cost between two positive levels, the best rule stops when the evidence first reaches one level, which stays between the extreme costs' flat bounds. That the place to stop at each moment is one level, and where that level can be, are parts of {{ref:lem:structure}}, proved by comparing strategies path by path on the same noise, with no equation solved. That stopping the first time the evidence reaches the level is optimal comes after the lemma, from the optimal stopping facts. The lemma's last part bounds how much the value can change when the start time moves: by at most the spread of the cost times the move.

The chapter ends with the decision time $\tau^*$, the first moment the evidence meets the moving bound, and with the facts from optimal stopping that make stopping there optimal. Chapter 5 is built on both.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"lem:structure": "one-level", "def:stopping-time": "decision-time", "sf:stopping": "why-optimal"}

# which groups of checks in tools/checks/ stand behind each plate
CHECKS = {
    "coupling": ["coupling", "program", "words"], "band": ["band", "program", "words"], "compare": ["compare", "program", "words"],
    "later": ["later", "program", "words"], "decide": ["decide", "program", "words"], "cap": ["cap", "program", "words"],
}

PLATES = {
    "coupling": {
        "title": "Two starts on the same noise",
        "state": "computed",
        "state_text": "Sampled in the page with a fixed seed, beside a dynamic program on a grid",
        "caption": r"""Steps 1 and 2: the evidence $Y$ from two starts, $y_1 = 0.05$ and $y_2 = 0.5$, driven by the same noise and reflected at 0 (Euler steps of 0.001 time units, $Y' = \max(Y + \tanh(Y)\,\Delta t + \Delta B,\ 0)$; a fixed seed, shown on the plate; add `?seed=` to the address for another), with the local time $\ell$ each collects at 0. Steps 3 and 4: Figure 1(a)'s cost, a rise from 0.1 to 1.6 centered at time 0.5. The value of waiting $V - g$ at four times, and the set where stopping is best, come from a dynamic program that checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window.""",
        "wide": False,
    },
    "band": {
        "title": "Where does the best bound run?",
        "state": "computed",
        "state_text": "Computed in the page: the best bound by dynamic programming on a grid",
        "caption": r"""Top: your schedule's cost on a log scale, with the lowest and highest levels it reaches or approaches over all time (dotted; the page scans to time 100, past every schedule's last change and over whole periods of the periodic ones, refines each extreme, and prints it rounded outward). Bottom: drag across the chart to draw where you think the best bound runs, then press Show me for the best bound from a dynamic program (ink), the band between the same program's bounds for the constant costs $c_{\min}$ and $c_{\max}$ (gray; not flat on the grid, since they bend down toward the forced choice, and drawn at least 1.5 px wide so it shows when the two are equal), and the per-moment rule's bound $B(c(t))$ (dashed). The program checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window, or ends at a deadline. The dashed lines are the continuous edges $B(c_{\max})$ and $B(c_{\min})$, and the dashed curve is $B(c(t))$, each moved in by the leading term of the monitoring shift, $0.5826\sqrt{0.01}$, as on chapter 0's plates; the plate reports how far the dashed lines sit from the band's edges. A deadline and the rising cost are outside the lemma and get no band.""",
        "wide": True,
    },
    "compare": {
        "title": "A higher cost, a lower bound",
        "state": "computed",
        "state_text": "Computed in the page: three dynamic programs on a grid, and one sampled path",
        "caption": r"""Figure 1(a)'s cost $c$ beside the constant costs $c_{\min}$ and $c_{\max}$, its infimum and supremum: its value at time 0, a little above 0.1, and 1.6, which it approaches but never reaches; the programs use these two values, and the labels round them to 0.1 and 1.6. Step 1: one path from evidence 0 at time 0, stopped by the program's rule for $c$ (seeded), and the cost each of the three charges for the same decision. Steps 2 and 3: the value $V(0, y)$ and the value of waiting $V - g$ under each cost. Step 4: the program's bound for $c$ against time, inside the band of the same program's bounds for the constant costs $c_{\min}$ and $c_{\max}$ (gray), with the continuous edges moved in by the monitoring shift (dashed). All three programs check the evidence every 0.01 time units on a grid of 0.02 and run 6 time units past the window.""",
        "wide": False,
    },
    "later": {
        "title": "Two start times, one rule",
        "state": "computed",
        "state_text": "Computed in the page: the cost integrals, and a dynamic program's value on a grid",
        "caption": r"""A cost that jumps from 0.1 to 1.6 at time 0.5, with no smoothing, so $c_{\min} = 0.1$ and $c_{\max} = 1.6$. Steps 1 to 3: one decision that lasts $\tau$ under a fixed rule, started at $t$ (top bar) and at $t' = t + \Delta$ (bottom bar); the costs paid are the areas under the cost over $[t, t + \tau]$ and $[t', t' + \tau]$. Step 4: the program's value $V(t, 0)$ against the start time (ink), with lines of slope $\pm(c_{\max} - c_{\min})$ from the start time on show (orange). The program checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window.""",
        "wide": False,
    },
    "decide": {
        "title": "Decisions on your schedule",
        "state": "computed",
        "state_text": "Sampled in the page against a bound computed in the page: a demonstration",
        "caption": r"""Your schedule's best bound from a dynamic program (ink; checked every 0.01 time units, a grid of 0.02, 6 time units past the window, or a forced choice at a deadline). Pick a start time $t$ and evidence $y$, and guess first. The page then runs 2,000 decisions from there with a fixed seed (add `?seed=` to the address for another): the hidden direction is drawn from the belief $g(y)$, the evidence moves between checks by its exact law, and each decision ends at the first check where $Y$ is at or above the bound, or at a deadline. Sixteen are drawn; the bars along the time axis count the moments of decision, $t + \tau^*$, with a decision at the chart's right edge in the last bar, and the plate says how many end past it. A decision forced at a deadline is charged the cost at the deadline itself, which the schedule keeps finite (equal to the rate just before it).""",
        "wide": True,
    },
    "cap": {
        "title": "Cap the gain, then use the theorem",
        "state": "computed",
        "state_text": "Sampled in the page with a fixed seed, with values from a dynamic program",
        "caption": r"""Your schedule (Figure 1(a)'s if yours has a deadline or rises without bound), from evidence 0 at time 0: 1,500 decisions sampled as on the plate above, with the program's value kept at every check. Step 1: the gain $G_s$ on eight paths that are never stopped, under the line $1 - c_{\min}s$ (dashed). Step 2: paths with the bound (ink) and the cap on the grid (dashed), each path's $\tau^*$ (ink dot) and $\sigma$ (ring). On the grid, the cap at each check is the same program's bound for the constant cost $c_{\min}$, on the same horizon, the grid's version of $\bar b = B(c_{\min})$; $\sigma$ is the first check at or above it, cut off at the program's last moment. Step 3: the sampled $\sigma$ beside $\E_y\sigma = \bar b\tanh\bar b - y\tanh y$, the paper's mean for the continuous model on an infinite horizon, a different model from the grid's. Step 4: the means of the value process $V(t + s, Y_s) - \int_0^s c$ (ink) and of the gain (gray), both stopped at $\tau^*$, with one path's two curves. The paths move between checks by the exact Gaussian law, while the program steps with a truncated kernel on its grid and the values are interpolated, so the plate shows agreement to sampling and grid error.""",
        "wide": False,
    },
}

STRIPS = {
    "lemma1a": {
        "plate": "coupling",
        "steps": [
            ("Waiting changes the expected reward only through the push that keeps the evidence off 0.",
             r"By Itô's formula, with $\Lop g = 0$ for $y > 0$ and $g'(0) = \tfrac12$: $g(Y_\tau) = g(y) + \int_0^\tau g'(Y_s)\dd B_s + \tfrac12\ell_\tau$. The stochastic integral has mean 0 for stopping times with finite mean, so $\class{lit}{V(t, y) - g(y) = \sup_\tau \E_y\bigl[\tfrac12\ell_\tau - C_\tau\bigr]}$, where $C_\tau = \int_0^\tau c(t + s)\dd s$ is the cost paid."),
            ("Two starts on the same noise stay in order, and the lower one collects at least as much local time.",
             r"Write $Y = U + \ell$, with $U_s = y + \int_0^s\tanh(Y_r)\dd r + B_s$ and $\ell_s = \sup_{r \le s}(-U_r)^+$. For $y_1 \le y_2$, paths that meet coincide afterward (pathwise uniqueness), so $Y^1 \le Y^2$. Then $U^1 \le U^2$, because $y_1 \le y_2$ and $\tanh Y^1 \le \tanh Y^2$, and Skorokhod's formula gives $\class{lit}{\ell^1 \ge \ell^2}$ path by path."),
            ("So every stopping time gains at least as much from the lower start: the value of waiting never rises as the evidence rises.",
             r"Under one stopping time $\tau$, the cost $C_\tau$ is the same from both starts, so $\tfrac12\ell^1_\tau - C_\tau \ge \tfrac12\ell^2_\tau - C_\tau$ on every path. Take expectations, then suprema: $\class{lit}{V(t, y_1) - g(y_1) \ge V(t, y_2) - g(y_2)}$, so $y \mapsto V(t, y) - g(y)$ is nonincreasing."),
            ("Where waiting is worth nothing, it is worth nothing higher up: the stopping set is a ray.",
             r"$V - g \ge 0$, so if it is 0 at $y_0$, it is 0 at every $y \ge y_0$: the stopping set at time $t$ is $\class{lit}{[b(t), \infty)}$. It is closed because $V$ is Lipschitz (the same coupling gives $0 \le V(t, y_2) - V(t, y_1) \le \tfrac12(y_2 - y_1)$, and part (d) covers time), and it isn't empty, since by part (b) it contains $[B(c_{\min}), \infty)$."),
        ],
    },
    "lemma1bc": {
        "plate": "compare",
        "steps": [
            ("Use one stopping time for both costs: on every path, the higher cost charges at least as much.",
             r"If $c_1 \le c_2$ at every moment, then, for any stopping time $\tau$, the reward $g(Y_\tau)$ is the same under both, and $\class{lit}{\int_0^\tau c_1(t + s)\dd s \le \int_0^\tau c_2(t + s)\dd s}$."),
            ("So the higher cost has the lower value.",
             r"Every stopping time earns at least as much under $c_1$ as under $c_2$. Taking suprema, $\class{lit}{V^{c_1} \ge V^{c_2}}$."),
            ("A lower value meets the reward for deciding sooner: the stopping set grows, and the bound comes down.",
             r"Since $V \ge g$, the stopping set $\{V = g\}$ grows as $V$ shrinks: where $V^{c_1} = g$, also $V^{c_2} = g$. So $\class{lit}{b^{c_1} \ge b^{c_2}}$, which is part (b)."),
            ("Compare with the two constant costs.",
             r"$c_{\min} \le c(t) \le c_{\max}$ at every moment, and a constant cost $c$ has the flat bound $B(c)$ at every moment (chapter 3). By part (b), $\class{lit}{B(c_{\max}) \le b(t) \le B(c_{\min})}$ for all $t$, which is part (c)."),
        ],
    },
    "lemma1d": {
        "plate": "later",
        "steps": [
            ("Fix one stopping rule, and start it at two times.",
             r"Take $t \le t'$ (the other case is the same) and a stopping time $\tau$. The evidence path, and so the reward $g(Y_\tau)$, doesn't depend on the start time; the cost does: $\class{lit}{\int_0^\tau c(t + s)\dd s}$ from $t$, and $\int_0^\tau c(t' + s)\dd s$ from $t'$."),
            ("The two costs differ only by two stretches of length $t' - t$.",
             r"With $C(u) = \int_0^u c$, the cost from $t$ is $C(t + \tau) - C(t)$ and from $t'$ is $C(t' + \tau) - C(t')$. Their difference, regrouped, is $\class{lit}{\int_{t + \tau}^{t' + \tau} c - \int_t^{t'} c}$, whether or not the two decisions overlap in time."),
            ("Each end is an interval of length $t' - t$.",
             r"So each integral lies between $c_{\min}(t' - t)$ and $c_{\max}(t' - t)$, and their difference is at most $\class{lit}{(c_{\max} - c_{\min})(t' - t)}$ in size, on every path."),
            ("Take the best rule on each side.",
             r"A bound that holds for every stopping time holds for the suprema: $\class{lit}{|V(t, y) - V(t', y)| \le (c_{\max} - c_{\min})|t - t'|}$. Nothing used continuity, so this holds for any bounded measurable cost."),
        ],
    },
    "stopping": {
        "plate": "cap",
        "steps": [
            ("The textbook theorem needs a gain that stays integrable, and this one falls without bound.",
             r"The gain from stopping at $s$ is $G_s = g(Y_s) - \int_0^s c(t + u)\dd u \le 1 - c_{\min}s$, so $\class{lit}{\E\sup_s|G_s| = \infty}$. The theorem for continuous gains (Peskir and Shiryaev, 2006, Ch. I, Thm. 2.2) assumes it is finite."),
            ("Cap the decision at the flat bound for the lowest cost; that never lowers the gain.",
             r"Let $\sigma$ be the first time $Y \ge \bar b = B(c_{\min})$. From $\bar b$, under any cost of at least $c_{\min}$, no stopping time earns more than the constant-cost value for $c_{\min}$ ({{ref:lem:structure}}(b)), which is $g(\bar b)$. So replacing $\tau$ by $\class{lit}{\tau \wedge \sigma}$ never lowers the expected gain."),
            ("The capped gain is bounded by something with a finite mean.",
             r"$\class{lit}{|G_{s \wedge \sigma}| \le 1 + c_{\max}\sigma}$, and $\E_y\sigma = \bar b\tanh\bar b - y\tanh y < \infty$ for $y \le \bar b$."),
            ("Now the theorem applies: the first entry into the stopping set is optimal.",
             r"By the Markov property of $(t + s, Y_s)$, the Snell envelope of the capped gain is $V(t + s, Y_s) - \int_0^s c(t + u)\dd u$ up to $\sigma$. The theorem says its first meeting with the gain, which is $\class{lit}{\tau^*_{t,y}}$ and comes no later than $\sigma$, so it is finite, is optimal, and that the Snell envelope, stopped there, is a martingale."),
        ],
    },
}

SECTIONS = [
    {
        "id": "one-level",
        "title": "One level at each moment",
        "blocks": [
            ("plain", r"""
For a constant cost of time, chapter 3 found the best rule: stop the first time the evidence $Y = |X|$ reaches the flat bound $B(c)$. When the cost changes, the value of starting at time $t$ with evidence $y$, $V(t, y)$, depends on $t$, and it isn't obvious that the best rule keeps that shape. The evidence levels where stopping is best, the set where $V(t, y) = g(y)$, could in principle come in pieces: stop at moderate evidence, wait at higher evidence, and stop again higher up.

Part (a) of {{ref:lem:structure}} rules that out. At each time, the value of being allowed to wait, $V - g$, never rises as the evidence rises. Where it has fallen to 0, it stays 0 higher up, so the stopping set is everything at or above one level, $[b(t), \infty)$. That level is the best bound.

The proof doesn't solve any equation. Away from 0, the chance of being right, $g(Y)$, is unchanged on average by waiting, because $\Lop g = 0$; only the push that keeps $Y$ off 0 adds to it, at the rate $g'(0) = \tfrac12$ per unit of the local time $\ell$ that $Y$ collects there. So waiting pays only through local time. Two starts run on the same noise (the coupling of chapter 2) then compare path by path: the lower start collects at least as much. Scrub through the proof; the plate beside each step draws what that step is about.
"""),
            ("strip", "lemma1a"),
            ("plain", r"""
In step 3, the stopping time is the same random time for both starts. That makes sense because the two paths are driven by one Brownian motion: the paper runs the reflected equation from every start with the same noise, so the processes share one flow of information (its standing fact on strong solutions, chapter 2).
"""),
            ("exact", "290-302", "The paper's lemma"),
            ("exact", "1294-1308", "The proof of (a), from Appendix A"),
            ("limits", r"""
**What part (a) says, and what it doesn't.** At each moment, the best rule has one level. It says nothing about where that level is (that is part (c), next) or how it moves in time (chapter 5 proves it moves continuously).
"""),
        ],
    },
    {
        "id": "band",
        "title": "A band the bound can't leave",
        "blocks": [
            ("plain", r"""
Part (a) says the best rule has one level at each moment, not where it is. Before reading on, a guess on your schedule. The plate draws your cost and the per-moment rule's bound $B(c(t))$. Draw where you think the best bound runs, then press Show me.
"""),
            ("plate", "band"),
            ("plain", r"""
For every schedule that meets the paper's standing assumption, the best bound stays inside the band. That is part (c) of {{ref:lem:structure}}: with $c_{\min}$ and $c_{\max}$ the lowest and the highest cost of the whole schedule,

$$B(c_{\max}) \le b(t) \le B(c_{\min}) \qquad \text{for all } t.$$

It follows from part (b), a comparison: if one cost is at most another at every moment, $c_1 \le c_2$, then $V^{c_1} \ge V^{c_2}$ and $b^{c_1} \ge b^{c_2}$. A cost that is higher everywhere gives a lower value and a lower bound. The proof takes four short steps.

On the grid, the same comparison holds exactly for the program, since its one-step rule also gives a lower value to a cost that is higher at every step. So the plate draws the band between the same program's bounds for the constant costs $c_{\min}$ and $c_{\max}$, on the same grid and horizon, and the program's bound never leaves it (a check runs every slider's extremes). The continuous edges, $B(c_{\max})$ and $B(c_{\min})$ moved in by $0.5826\sqrt{\Delta t}$, are only the leading-order version of that band. At the schedules' starting settings, they sit within 0.005 of its edges, but at the sliders' extremes they are up to about 0.02 away: at the lowest costs, the forced choice 6 time units past the window pulls the constant-cost program's bound down (so on the grid it isn't flat; it bends down across the window). Where a bound falls below the grid's first step, 0.02 (at costs above about 3.2), the page places it between the center and that step, as its own program's choice at the center says; the paper's code reports 0 there.
"""),
            ("strip", "lemma1bc"),
            ("plain", r"""
Two things about part (c) are easy to misread. First, $c_{\min}$ and $c_{\max}$ are the extremes of the whole schedule, past any window a plate draws: on the Smooth schedule at its starting settings, both are reached after time 18, and on Piecewise with a hold time of 0.8, the lowest cost comes near time 4.4. Second, part (c) doesn't place the best bound on one side of $B(c(t))$, the per-moment bound at the same moment. Its edges are per-moment bounds too, the lowest and the highest over the whole schedule: since $B$ is continuous and decreasing, $B(c_{\max}) = \inf_s B(c(s))$ and $B(c_{\min}) = \sup_s B(c(s))$, so the per-moment curve is inside the band as well. At a given moment, the best bound can sit above or below $B(c(t))$. On Figure 1(a), where the cost only rises, the best bound sits below it; on Figure 1(b), where the cost only falls, above it (chapter 5 has this as an exercise; the paper doesn't state it).
"""),
            ("exact", "1310-1313", "The proofs of (b) and (c), from Appendix A"),
            ("limits", r"""
**What parts (b) and (c) cover.** Where the bound can be, for every continuous cost between two positive levels. Beyond what part (c) gives for the schedule from each time on (an exercise below), it says nothing about where in the band the bound sits: that takes the exact equation (chapter 5) or, for small changes, the first-order theory (chapter 6). A deadline makes the cost infinite after the deadline and a rising cost has no highest level ({{claim:asm:cost}}), so part (c) doesn't apply to either.
"""),
        ],
    },
    {
        "id": "later",
        "title": "How far the value moves with the start time",
        "blocks": [
            ("plain", r"""
Part (d) of {{ref:lem:structure}} is about time. Moving the start time changes the value by at most the spread of the cost times the move:

$$|V(t, y) - V(t', y)| \le (c_{\max} - c_{\min})\,|t - t'|.$$

The argument fixes one stopping rule and starts it at two times. The reward it earns depends only on the evidence path, which is the same either way. The two costs differ by the cost of two stretches of length $|t - t'|$, one at each end of the decision (where the two decisions overlap in time, the overlap is paid either way), and each stretch costs between $c_{\min}$ and $c_{\max}$ times its length. Taking the best rule on each side keeps the bound.

Nothing in that argument uses continuity, so part (d) holds for any bounded measurable cost, as the paper notes. The plate uses a cost that jumps from 0.1 to 1.6 at time 0.5 with no smoothing at all.
"""),
            ("strip", "lemma1d"),
            ("plain", r"""
On the grid, the bound in part (d) is reached, to the precision shown. Just before the jump, the program's bound is above 0 at both start times, so from evidence 0 it waits at least one check from each. For any rule that waits at least one check, starting one check later trades that first check's cost of 0.1 for a check at 1.6, and the other checks are charged the same. So the program's value falls at the rate $c_{\max} - c_{\min}$ there. Chapter 5 combines part (d) with the floor of {{ref:prop:regularity}}(a) on the value of waiting to bound how far $b(t)$ can move in a time $\Delta$, by a constant times $\sqrt{\Delta}$ ({{ref:prop:regularity}}(b)), so the bound can't jump.
"""),
            ("exact", "304-305|Part (d)|pathwise.", "The paper's remark after the lemma"),
            ("exact", "1315-1319", "The proof of (d), from Appendix A"),
        ],
    },
    {
        "id": "decision-time",
        "title": "The decision time",
        "blocks": [
            ("plain", r"""
With one level at each moment, the best rule has a plain form. From a start at time $t$ with evidence $y$, wait until the evidence first reaches the bound as the bound moves:

$$\tau^*_{t,y} = \inf\{s \ge 0 : Y_s \ge b(t + s)\}, \qquad Y_0 = y.$$

It is a random time, one for each path, and a start at or above the bound stops at once. The bound can change while the decision is open, so $\tau^*$ is in general the first entry across a time-dependent threshold. On the infinite horizon, the bound at a time depends only on the cost from that time on, so when the remaining cost $s \mapsto c(t + s)$ is a constant $c$ (a constant schedule, or a start after a drawing's last change), the threshold is the flat bound $B(c)$ for the whole decision, and $\tau^*$ is the first entry into $[B(c), \infty)$ (0 for a start at or above $B(c)$). The cost at that moment, $c(t + \tau^*)$, is what chapter 5's exact equation is about.

The plate runs decisions on your schedule against the bound the program computed for it. Guess first: drag the orange line to where you think half the decisions from the start have ended.
"""),
            ("plate", "decide"),
            ("plain", r"""
The sampled decisions are a demonstration of the definition on a grid, not a measurement the paper makes. The program's bound is for checking every 0.01 time units, so the page checks the paths at the same moments.
"""),
            ("exact", "305-310|Write", "The paper's definition"),
        ],
    },
    {
        "id": "why-optimal",
        "title": "Why stopping at the bound is optimal",
        "blocks": [
            ("plain", r"""
That $\tau^*$ is optimal is not assumed. The paper proves it from one theorem of optimal stopping, which it cites, and facts it proves itself. The theorem (Peskir and Shiryaev, 2006, Ch. I, Thm. 2.2) is for a continuous gain process $G$ with $\E\sup_s|G_s| < \infty$: the first time the Snell envelope (the best expected gain from each moment on) meets the gain, when that time is finite, is an optimal stopping time, and the Snell envelope stopped there is a martingale. Here the gain from stopping at $s$ is $G_s = g(Y_s) - \int_0^s c(t + u)\,du$, which falls without bound, so the theorem doesn't apply as it stands. The paper caps the gain first, at the flat bound for the lowest cost.
"""),
            ("strip", "stopping"),
            ("plain", r"""
Two facts come out: $\tau^*$ is optimal, and the value process $V(t + s, Y_s) - \int_0^s c(t + u)\,du$, stopped at $\tau^*$, is a martingale. Chapter 5's envelope identity uses both: the martingale property to show the value is smooth below the bound, and the optimality of $\tau^*$ for its frozen rule.
"""),
            ("exact", "1280-1292", "The standing fact, from Appendix A"),
            ("limits", r"""
**What the paper proves here, and what it cites.** It proves that the cap is harmless (from {{ref:lem:structure}}(b) and the flat bound's value), that the capped gain is bounded by $1 + c_{\max}\sigma$ with $\E_y\sigma$ finite, and that the Snell envelope is the cost-adjusted value. That the first meeting is optimal, and the martingale property, are the cited theorem's. All of it is under the standing assumption, a continuous cost between two positive levels: a deadline or a cost that rises without bound is outside it.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's three highlighted. {{ref:lem:structure}} uses the value (chapter 3), the reflected process $Y$ and its strong solutions (chapter 2), and the flat bound (chapter 3). Six claims use it: the optimal stopping facts and $\tau^*$, in this chapter; the envelope identity ({{ref:lem:envelope}}) and the regularity of the bound ({{ref:prop:regularity}}), in chapter 5; {{ref:thm:main}}, in chapter 6, which uses part (c) to keep the bound for a slightly changed cost within a constant times $|\varepsilon|$ of $b_0$; and the second-order loss ({{ref:prop:loss}}, chapter 7), which uses part (c) the same way. {{ref:lem:envelope}} also uses the decision time and the stopping facts.
"""),
            ("map", "lem:structure"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why does “$V - g$ is nonincreasing in $y$” make the stopping set an interval $[b(t), \infty)$?",
                 r"""
$W = V - g \ge 0$. If $W(t, y_0) = 0$, then for every $y \ge y_0$, $0 \le W(t, y) \le W(t, y_0) = 0$. So once the evidence is high enough to stop, any higher evidence is too; the stopping set is everything above its lowest point $b(t)$. (Its closedness comes from the Lipschitz bounds at the end of the proof of (a).)
"""),
                (r"Prove (d) for a cost that steps from 0.1 to 1.6 at $t = 0.5$, with start times $t = 0.4$ and $t' = 0.45$.",
                 r"""
Fix any stopping time $\tau$. The cost paid from $t'$ minus the cost from $t$ is $\int_{t+\tau}^{t'+\tau} c - \int_t^{t'} c$. Each integral runs over an interval of length 0.05 and so lies between $0.1 \times 0.05$ and $1.6 \times 0.05$. Their difference is at most $(1.6 - 0.1) \times 0.05$ in size. Taking suprema over $\tau$ gives $|V(0.45, y) - V(0.4, y)| \le 0.075$. Nothing needed the cost to be continuous.
"""),
                (r"For Figure 1(a), where can the optimal bound be?",
                 r"""
By (c), between $B(1.6)$ and $B(0.1)$ at every moment, before the rise as well as after it. (The cost starts a little above 0.1, so the band's true top is a little lower; $B(0.1)$ is still an upper edge.) Part (c) alone says no more; applied to the schedule from each time on (the next exercise), it gives a narrower band, and the exact equation and the first-order theory say more.
"""),
                (r"Show that $b(t)$ lies between $B\bigl(\sup_{s \ge t} c(s)\bigr)$ and $B\bigl(\inf_{s \ge t} c(s)\bigr)$. What does that say about Figure 1(a) long after the rise? (An exercise from the lemma; the paper doesn't state it.)",
                 r"""
$V(t, \cdot)$ is the value for the cost $s \mapsto c(t + s)$, which never looks back before $t$. Apply (c) to that schedule: its lowest and highest values are the infimum and supremum of $c$ over $[t, \infty)$. On Figure 1(a), both tend to 1.6 as $t$ grows, so the band from $t$ on closes onto $B(1.6)$, and the bound settles at the flat bound for the cost it will pay from then on.
"""),
                (r"Why is $\tau^*_{t,y}$ in general the first entry across a moving level rather than the hitting time of a fixed one, and where does the paper replace it with fixed levels?",
                 r"""
When the cost from $t$ on changes, the bound $b(t + s)$ can change during the decision, so $\tau^*$ is the first time the path meets a time-dependent threshold. When the remaining cost $s \mapsto c(t + s)$ is a constant $c$, on the infinite horizon, the bound is $B(c)$ for the whole decision and $\tau^*$ is the first entry into $[B(c), \infty)$: that covers a constant schedule, and a start after a schedule's last change. In the proof of {{ref:thm:main}}, the paper brackets $\tau^*$ between the hitting times of the two fixed levels $b_0 \pm a|\varepsilon|$, for starts below the lower level, $y < b_0 - a|\varepsilon|$. That is possible because {{ref:lem:structure}}(c) keeps the whole bound inside that band for a small change: a path from below meets the bound no sooner than it reaches $b_0 - a|\varepsilon|$, and no later than it reaches $b_0 + a|\varepsilon|$.
"""),
                (r"Why is stopping at $\bar b = B(c_{\min})$ never worse than continuing?",
                 r"""
From $\bar b$, every cost the decision maker can face is at least $c_{\min}$. By {{ref:lem:structure}}(b), the value under such a cost is at most the value under the constant cost $c_{\min}$. At $\bar b$, that constant-cost value equals $g(\bar b)$, because $\bar b$ is exactly where the constant-cost rule stops. So $V(t, \bar b) \le g(\bar b)$, and stopping is optimal there.
"""),
                (r"{{ref:lem:structure}} is used to justify the standing facts, and the standing facts are used in the paper's proofs. Is the argument circular?",
                 r"""
No. {{ref:lem:structure}} uses only comparisons between fixed stopping times (and the coupling), not the optimality of $\tau^*$. The standing facts then use part (b) of it for the cap. The claim map draws the order: {{ref:lem:structure}} comes before the optimal stopping facts, and nothing it uses depends on them.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“(c) puts the bound on one side of the per-moment bound $B(c(t))$, or close to it.”",
                 r"Its edges are the lowest and the highest per-moment bounds over the *whole* schedule, $\inf_s B(c(s))$ and $\sup_s B(c(s))$. At a given moment, the optimal bound can be above or below $B(c(t))$, and the band can be wide."),
                (r"“$c_{\min}$ and $c_{\max}$ are over the stretch of time being looked at.”",
                 r"They are the lowest and the highest cost of the whole schedule, at all times. A low cost that comes after a plate's window still sets the band's top edge."),
                (r"“The stopping set being an interval is assumed.”",
                 r"It is proved, by the coupling in part (a)."),
                (r"“$\tau^*$ is the mean decision time.”",
                 r"It is a random time, one per path. The kernel $w$ is the density of a different time: $\tau_0$, the first time the evidence reaches the fixed constant-cost bound $b_0$, from the start law $\pi_0$ ({{ref:lem:kernel}})."),
                (r"“The paper assumes the first entry into the stopping set is optimal.”",
                 r"It proves it, by capping the gain and citing Peskir and Shiryaev (2006, Ch. I, Thm. 2.2) for the capped problem."),
            ]),
        ],
    },
]
