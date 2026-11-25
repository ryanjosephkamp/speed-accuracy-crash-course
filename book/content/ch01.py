"""Chapter 1: the question, from the 2025 capstone.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("table", label) place a live plate, a printed figure, or a generated table;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.

The capstone's story is not in the paper. It comes from the author's public post about the paper, and the page says
so; nothing is added to what the post states. The guess comes before Figure 1, so the best bound on the 16-fold rise
is first drawn after the reader has placed it. Table 4's losses are quoted only from the generated table; the page
draws the curves on a coarser grid and scores nothing.
"""

POST = "https://ryanjosephkamp.github.io/blog/articles/speed-accuracy/"

CHAPTER = {
    "slug": "question",
    "num": 1,
    "title": "The question, from the 2025 capstone",
    "full": "The question, from the 2025 capstone: the per-moment rule and Figure 1",
    "leaf": 2,
    "finding": "The per-moment rule moves the bound with the cost; the best bound moves well before most of a change. How far ahead should the bound look, and with what weights?",
    "readings": [
        ("HeldPerMomentMedian", "the per-moment rule's median loss on the paper's held-out schedules, in points per 100 trials"),
        ("HeldShareMedian", "the same loss as a share of the reward, in percent"),
        ("HeldPerMomentMax", "its largest loss there, in points per 100 trials"),
    ],
    "hero": {
        "aria": "Figure 1(b): the cost of time falls from 0.4 to 0.05 around time 0.3. Below, the best bound makes most of its rise before the center of the fall, while the per-moment rule's bound rises with the cost.",
        "caption": r"""Figure 1(b): the cost of time falls from 0.4 to 0.05 around $t = 0.3$ (orange, log scale). Below, the best bound from a dynamic program solved in this page (ink) makes most of its rise before the center of the fall; the per-moment rule's bound (dashed) rises with the cost. Both are for checking the evidence every 0.01 time units.""",
        "still": 1,
    },
    "intro": r"""
Where the paper starts: a shortcut for a cost of time that changes, the one the author's 2025 capstone used, and a picture of what it misses. The per-moment rule moves the bound with the cost; the best bound moves well before most of a change. How far ahead should the bound look, and with what weights?

Nothing in this chapter is proved. It defines the shortcut, asks for a guess, and rebuilds the paper's first measurement, Figure 1, in the page. In reward, the shortcut is already close: on the paper's {{HeldCount}} held-out schedules, it gives up a median of {{HeldShareMedian}}% of the reward (chapter 10). What it gets wrong is where the bound sits and when it moves. The formal setup comes in chapters 2 and 3; this chapter needs only the idea that a higher cost of time means deciding sooner, on less evidence.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"def:per-moment": "capstone", "exp:showcase": "four"}

# which groups of checks in tools/checks/ch01.mjs (and the shared files) stand behind each plate
CHECKS = {
    "rule": ["rule", "words"],
    "rise": ["rise", "fig1", "code", "schedule", "words"],
    "figure1": ["fig1", "code", "schedule", "words"],
}

PLATES = {
    "rule": {
        "title": "Read the cost through B",
        "state": "computed",
        "state_text": "Computed in the page from the constant-cost equation",
        "caption": r"""Top: your schedule's cost of time $c(t)$, on a log scale. Middle: the per-moment bound $B(c(t))$ over time. Bottom: the constant-cost bound $B(c)$, the root of $\sinh(2b) + 2b = 1/c$, against the cost, read from a table of roots in $\log c$ as the paper's code reads it; the band marks the costs your schedule reaches, and the guides carry the cost at the marked time through $B$. These are bounds for checking the evidence continuously, with no grid. Past a deadline, the cost is infinite and $B(\infty) = 0$.""",
        "wide": False,
    },
    "rise": {
        "title": "Where is the bound at time 0.4?",
        "state": "computed",
        "state_text": "Computed in the page: the best bound by dynamic programming on a grid",
        "caption": r"""Figure 1(a)'s schedule: a logistic step of scale 0.05 centered at $t = 0.5$, from a lower level of 0.1 to an upper level of 1.6 (top, log scale). Below, the per-moment bound (dashed), moved in by $0.5826\sqrt{0.01}$ because the program checks the evidence every 0.01 time units. Drag the orange marker, or use the slider, to where you think the best bound sits at $t = 0.4$, then press Show me: the best bound (ink) comes from a dynamic program on an evidence grid of 0.02, solved backward from a forced choice at $t = 8.5$, 6 time units past the book's window of 2.5. The chart shows the first 1.2 time units.""",
        "wide": False,
    },
    "figure1": {
        "title": "Four schedules, three rules",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, and the two rules from their equations",
        "caption": r"""Figure 1's four schedules, in the paper's order, and your own below them. Above each panel is the cost of time, on a log scale over the schedule's own range; in it are the best bound from the dynamic program (ink), the per-moment rule (dashed), and the weighted look-ahead from {{ref:alg:weighted}}'s 30 damped updates (green). The time line moves across every panel; pick a panel to read it out, at the program's own times, every 0.01. The page checks the evidence every 0.01 time units on an evidence grid of 0.02, and runs the program to $t = 8.5$ with the evidence capped at 5, or to the deadline. Where the program's bound falls below the grid's first step of 0.02 while its Bellman step still waits at the center, the page places the bound between the center and that step (the paper's code reports 0 there; chapter 9); such a bound below 0.001 reads "< 0.001". For the four paper schedules, the printed Figure 1 is on a finer grid ($\Delta t = 0.002$, $h = 0.005$, run to $t = 10$ with the evidence capped at 8). The rules are moved in by $0.5826\sqrt{0.01}$ instead of $0.5826\sqrt{0.002}$, so the page's two rule curves sit 0.032 below the printed ones wherever neither is held at 0 (the weighted rule is 0 at the deadline in both). The two programs' best bounds, each solved on its own grid, are within 0.04 of each other at every printed time, and both are 0 at the deadline. Your own schedule has no printed curve to compare. The losses are the paper's, in {{ref:tab:showcase}}; the page doesn't score the rules.""",
        "wide": True,
    },
}

STRIPS = {}

SECTIONS = [
    {
        "id": "capstone",
        "title": "The capstone and its shortcut",
        "blocks": [
            ("plain", r"""
This section's story comes from the author's [blog post about the paper](""" + POST + r"""), not from the paper, which doesn't mention the capstone. In April 2025, the author presented his undergraduate research capstone at the University of Cincinnati: an implementation of Jan Drugowitsch's notes on normative solutions to the speed-accuracy trade-off in perceptual decision-making, written for the FENS-Hertie 2015 Winter School. The capstone's code handled a cost of time that changes during a decision with a shortcut, which the post calls the capstone's main contribution: at every moment, use the bound that would be best if the current cost lasted forever.

At the time, neither he nor the code could say how much that mattered. When he rechecked the code in the fall of 2026, he found that its dynamic-programming solver stopped after three iterations, that its belief grid was too coarse for its time step, and that it applied its transition matrix transposed. He rebuilt the solvers, checked them against the closed form, and then measured the shortcut against the best bound from a dynamic program. The paper reports that measurement, and a way to do better.
"""),
            ("plain", r"""
In the paper, the shortcut is the *per-moment rule*. At each moment, it uses the bound that would be best if the current cost of time lasted forever:

$$b_{\mathrm{pm}}(t) = B\bigl(c(t)\bigr),$$

where $B(c)$, the best bound for a constant cost $c$, is the root of $\sinh(2b) + 2b = 1/c$ (chapter 3 derives it). A higher cost gives a lower bound: deciding sooner, on less evidence. The paper says the rule comes from treating the problem as quasi-static. It is exact when the cost is constant, and frozen-cost bounds of this kind are the leading term in large-time asymptotics for related stopping problems with slowly changing costs (Irle, Kubillus, and Paulsen 2001; Muravlev 2020). But it ignores the future.

The plate takes your schedule's cost at each moment and applies $B$ to it.
"""),
            ("exact", "111-125||ignores the future.", "The paper's words, in its introduction"),
            ("plate", "rule"),
            ("plain", r"""
Reading the present cost through $B$ is all the rule does, so its bound moves when the cost moves, never before. That is the trouble. A decision still open at time $t$ pays the cost at every moment until it ends, not only the cost at $t$. If the cost is about to jump, a decision still open now may well be completed after the jump, so the best bound should already be moving toward the bound the jump will call for. In the paper, the per-moment rule is the baseline that everything else is measured against, not the contribution.
"""),
        ],
    },
    {
        "id": "rise",
        "title": "Where is the bound before the rise?",
        "blocks": [
            ("plain", r"""
Here is the first schedule of the paper's Figure 1: a smooth step, logistic in time with scale 0.05 and centered at $t = 0.5$, from a lower level of 0.1 to an upper level of 1.6, 16 times higher. The per-moment bound is drawn, moved in for a program that checks the evidence every 0.01 time units, so it starts just below $B(0.1)$ and comes down with the cost. The best bound, from a dynamic program the page solves backward from a forced choice, isn't drawn yet.
"""),
            ("md", r"""
Take the moment $t = 0.4$, a little before the center of the rise. Where does the best bound sit there: on the per-moment bound, above it, or below it, and by how much? Drag the orange marker, then press Show me.
"""),
            ("plate", "rise"),
            ("plain", r"""
The best bound at $t = 0.4$ sits well below the per-moment bound. It began coming down long before the main part of the step: by $t = 0.2$, when the cost is still within 4% of 0.1, the best bound has come down more than three times as far as the per-moment bound. A decision open at $t = 0.4$ may still be open as the cost climbs toward 1.6, so it pays to stop sooner, on less evidence. The per-moment rule can't do this: at $t = 0.4$, it uses only the cost at $t = 0.4$.

Chapter 0 asked the same question on your own schedule. Whether the best bound sits above or below the per-moment one there depends on how the cost changes after that moment. In Figure 1(b), where the cost falls, the best bound sits higher than the per-moment one before most of the fall: a decision open then may still be open when waiting is cheap. The next section shows both.
"""),
            ("exact", "125-127|A decision maker|completed after the jump.", "The paper's reason, in its introduction"),
        ],
    },
    {
        "id": "four",
        "title": "Four schedules, three rules",
        "blocks": [
            ("plain", r"""
Figure 1 is the paper's first measurement. It compares three bounds on four schedules: (a) the 16-fold rise from the last section; (b) a fall from 0.4 to 0.05, centered at $t = 0.3$; (c) a cost that is flat at 0.1, then rises by 0.8 per time unit after $t = 0.5$; and (d) a cost of 0.1 until a hard deadline at $t = 1$, where the choice is forced. The steps in (a) and (b) are logistic in time, with scale 0.05.

Two of the bounds are the best bound, from the dynamic program, and the per-moment rule. The third is a rule that the paper's answer suggests: the weighted look-ahead rule of chapter 8, which averages the per-moment bounds ahead of each moment, with weights that chapter 6 derives. Near a constant cost, it is exact to first order ({{ref:prop:rule}}); for changes as large as these, and on a deadline, no theorem covers it, and the paper judges it by measurement.
"""),
            ("md", r"""
Move the time line across the four panels, or let it play, and pick a panel to read it out. Your own schedule is the fifth panel.
"""),
            ("plate", "figure1"),
            ("plain", r"""
In each of Figure 1's four panels, the per-moment bound moves with the cost, and the best bound moves well before most of the change: down before most of the rise in (a), up before most of the fall in (b), down while the cost is still flat in (c), and down toward the deadline in (d), where the per-moment bound stays flat until the choice is forced. The weighted rule follows the best bound in all four, though not exactly: on the deadline, the paper notes, its bound sits below the best one for most of the trial and above it near the deadline. Read out panel (d) near $t = 1$ to see where the page's grid puts the crossing.
"""),
            ("exact", "269-272", "The paper's paragraph on the per-moment rule"),
            ("exact", "582-588", "Where the paper says the rules are heuristics, and reads panel (d)"),
            ("figure", "showcase"),
            ("plain", r"""
{{ref:tab:showcase}} gives what each rule loses against the best bound, in points per 100 trials: the difference in expected reward, computed exactly on the paper's grid rather than by simulation (chapter 9). The per-moment rule loses the most on the fall ({{T:tab_showcase:2:2}}), then the rise ({{T:tab_showcase:1:2}}), the deadline ({{T:tab_showcase:4:2}}), and the ramp ({{T:tab_showcase:3:2}}). The weighted rule loses at most {{T:tab_showcase:4:3}}, on the deadline. The page draws the curves but doesn't score them: these losses are the paper's.
"""),
            ("table", "tab:showcase"),
            ("limits", r"""
**What Figure 1 shows, and what it doesn't.** Four schedules, measured on the paper's grid with a forced choice at $t = 10$, or at the deadline. No small-change result covers the rules on them: {{ref:thm:main}} and {{ref:prop:rule}} are about small changes of a continuous, bounded cost on an infinite horizon, and the rise, the fall, and the ramp are large changes. The rise and the fall do meet the paper's standing assumption (a continuous cost between two positive constants), so the exact equation of chapter 5 holds for these costs on an infinite horizon; the ramp, which grows without bound, and the deadline, which makes the cost infinite, don't meet it. The measurements' forced choice at $t = 10$ is itself outside the infinite-horizon setting of the theorems. On all four, the weighted rule is a heuristic, and Figure 1 and {{ref:tab:showcase}} measure it.
"""),
            ("plain", r"""
Each of the four panels shows the same thing. A decision open now pays the cost of every moment it lasts into, so the best bound moves before most of the change in the cost, and a rule that uses only the present cost moves late. The weighted rule moves early because it looks ahead, and on these four schedules it loses far less than the per-moment rule ({{ref:tab:showcase}}). Why that works, and how far ahead is far enough, is the rest of the book. The paper puts its question this way: *how far ahead should the bound look, and with what weights?*
"""),
            ("exact", "127-128|How far ahead|question this paper answers.", "The paper's question, in its introduction"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's two printed heavier: the per-moment rule and Figure 1's four schedules. The per-moment rule uses the constant-cost bound $B(c)$ (chapter 3). In turn, the weighted look-ahead rule averages its bounds (chapter 8), and the experiments compare every rule with it: Figure 1 here, and the development and held-out schedules (chapter 10). Figure 1 also uses the weighted rule and the reference dynamic program (chapter 9).
"""),
            ("map", "def:per-moment"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"The cost is $0.1$ until a hard deadline at $t = 1$. What bound does the per-moment rule use at $t = 0.9$?",
                 r"""
$B(0.1)$, the same flat bound it uses at $t = 0$. At $t = 0.9$, the current cost is still $0.1$, and the rule looks only at the current cost. The cost is 0.1 at $t = 1$ as well, so the rule's value is still $B(0.1)$ there; only past the deadline, where the cost is infinite, is it $B(\infty) = 0$. At $t = 1$ itself the choice is forced, whatever the bound. The optimal bound has already been coming down toward 0 well before $t = 1$ ({{ref:fig:showcase}}(d)), because a decision still open near the deadline will be forced.
"""),
                (r"When, if ever, is the per-moment rule exactly optimal?",
                 r"""
When the cost is constant, on an infinite horizon: then $b_{\mathrm{pm}} = B(c)$ is the optimal flat bound. To first order, it is also right in the limit of very slow changes. For a small, bounded, continuous change around a constant cost on an infinite horizon, the first-order term weights the coming change by the kernel, and $\tilde w(0) = 1$, so in the low-frequency limit that weighted average is the present value of the change ({{ref:cor:limits}}(a)). For any such change that isn't constant, the per-moment bound's error divided by $\varepsilon$ tends, locally uniformly in time, to a limit that isn't identically zero, so the error doesn't shrink faster than the change ({{ref:prop:rule}}).
"""),
                (r"The paper says frozen-cost bounds are “the leading term in large-time asymptotics” for related problems. Does that contradict the claim that the per-moment rule is wrong?",
                 r"""
No. Irle and colleagues (2001) and Muravlev (2020) show that, for related stopping problems with slowly changing costs, the frozen-cost boundary is the *leading* term as $t \to \infty$. That is the per-moment idea, and it is right to leading order in those limits. The paper's point is about a different expansion: for a small, bounded, continuous change of size $\varepsilon$ around a constant cost, on an infinite horizon and on any time scale, the per-moment bound's miss, divided by $\varepsilon$, tends, locally uniformly in time, to a function that isn't identically zero unless the change is constant, and the first-order correction is a weighted average over the near future. {{ref:sec:related}}, in its paragraph on asymptotics, puts it this way: those expansions are local in time, built from the cost near $t$; the paper's is a perturbation on an arbitrary time scale, with a nonlocal kernel.
"""),
                (r"In panel (b) the cost falls. Does the optimal bound rise or fall, and does it move before or after the change?",
                 r"""
It rises. That the per-moment bound rises follows from $B$ being decreasing ({{ref:eq:Bprime}}): a cheaper cost of time gives a higher constant-cost bound. That the best bound rises, and when, is measured: on the page's grid and in the printed {{ref:fig:showcase}}(b), it rises to the new level, and about three-fifths of its rise over the window comes before the center of the fall at $t = 0.3$. The reason is the one for a bound falling before a rise: a decision open now may still be open after the change, under the new cost. The per-moment bound moves only as the cost moves: the step is logistic (scale 0.05), so it changes mostly close to $t = 0.3$.
"""),
                (r"Read {{ref:tab:showcase}}. On which schedule does the per-moment rule lose the most, and does the weighted rule's ranking follow it?",
                 r"""
The per-moment rule loses the most on the falling cost ({{T:tab_showcase:2:2}} points per 100 trials), then the rise ({{T:tab_showcase:1:2}}), the deadline ({{T:tab_showcase:4:2}}), and the ramp ({{T:tab_showcase:3:2}}). The weighted rule loses the most on the deadline ({{T:tab_showcase:4:3}}) and between {{T:tab_showcase:2:3}} and {{T:tab_showcase:3:3}} on the other three, so its ranking does not follow the per-moment rule's. The paper's small-change results ({{ref:thm:main}} and {{ref:prop:rule}}) don't justify the weighted rule on any of the four: on all of them it is a heuristic, and {{ref:tab:showcase}} measures it.
"""),
                (r"Does {{ref:thm:main}} cover the 16-fold rise?",
                 r"""
No. The rise is continuous (logistic in time) and stays between 0.1 and 1.6, so the cost meets the standing assumption and the exact equation ({{ref:prop:exact}}) holds for it. But {{ref:thm:main}} is a statement about the limit of small changes, $\varepsilon \to 0$; a fixed 16-fold rise is a large change. {{ref:sec:rule}} says so: large steps, deadlines, and the forced choice at $t = 10$ lie outside {{ref:thm:main}} and {{ref:prop:rule}}, and there the rules are heuristics judged by measurement.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The per-moment rule is the paper's shortcut, its contribution.”",
                 r"It is the baseline: the 2025 capstone's rule, by the author's post (the paper doesn't mention the capstone). The paper measures it and proves that its bound is wrong at first order. What the paper claims as new, to its knowledge, is the explicit kernel and its transform, the theorem, the weighted rule, and the measurements. Specializing Stojanovic's (1997) perturbation formula to this model at a constant cost formally gives the convolution form of the correction, and the identities behind the exact equation appear, for smooth losses, in Campbell and Engelund (2026)."),
                (r"“The per-moment rule is bad.”",
                 r"In reward, it is close: on the {{HeldCount}} held-out schedules, it gives up a median of {{HeldShareMedian}}% of the reward. What it gets wrong is where the bound sits and when it moves ({{claim:claim:pm-close-in-reward}})."),
                (r"“The curves in Figure 1 are simulations.”",
                 r"The optimal bound is the dynamic program's, and the losses are computed by propagating the evidence density on a grid, with no sampling ({{claim:method:scoring}})."),
                (r"“The weighted rule matches the optimal bound on the deadline.”",
                 r"It loses little ({{T:tab_showcase:4:3}} points per 100 trials), but its bound is visibly off: in the paper's reading of its figure ({{ref:sec:rule}}), below the optimal one for most of the trial, then above it from about $t = 0.9$ to the deadline, by up to about 0.1."),
            ]),
        ],
    },
]
