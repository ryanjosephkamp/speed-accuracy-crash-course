"""Chapter 5: an exact equation for the bound.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("strip", id) place a live plate, a printed figure, or a proof strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "equation",
    "num": 5,
    "title": "An exact equation for the bound",
    "full": "An exact equation for the bound: the cost at the moment of decision, regularity, and one integration",
    "leaf": 6,
    "finding": "At every moment, the best bound sits where the expected cost at the moment of decision, weighted by cosh² y over the evidence below the bound, integrates to one quarter.",
    "readings": [
        ("BoundTenth", "the bound at a constant cost of 0.1, where the equation is sinh 2b + 2b = 1/c"),
        ("LookAheadTenth", "the mean decision time from the normalized speed measure at that cost (chapter 6's look-ahead)"),
        ("DecisionTimeTenth", "the mean decision time from 0 at that cost, for comparison"),
    ],
    "hero": {
        "aria": "A cost that rises from 0.1 toward 0.4, and at one moment two curves over the evidence: cosh squared times the expected cost at decision up to the best bound, and cosh squared times the cost now up to the per-moment bound, with equal areas",
        "caption": r"""The test schedule from the paper's code, the “smooth step” of `tests/test_exact_equation.py`: a cost of 0.1 that rises toward 0.4 around time 1.5 (orange). Below, at the marked time: $\cosh^2 y$ times the expected cost at the moment of decision, from 0 to the best bound (green), and $\cosh^2 y$ times the cost now, out to the per-moment bound $B(c(t))$ (dashed). In the model, both areas are $\tfrac14$; the label prints the green one's area on the grid. Before the rise, decisions that start far from the bound end after it, when the cost is higher, so the green curve is taller and the bound sits lower. Computed on a grid with time step 0.005 and evidence step 0.01.""",
    },
    "intro": r"""
At every moment, the best bound sits where the expected cost at the moment of decision, weighted by cosh² y over the evidence below the bound, integrates to one quarter. That is {{ref:prop:exact}}, the paper's first contribution, and it holds for every continuous cost that stays between two positive constants. It takes three steps: an envelope identity that says what the value's curvature term is (the expected cost at the moment of decision), two regularity facts the paper proves rather than assumes (the bound is Hölder continuous, and smooth fit holds), and one integration from the center to the bound. The equation has no derivative of the bound in it, which makes it easy to linearize, as chapter 6 does.

One credit applies to every page of this chapter. The two identities behind the equation appear, for smooth terminal losses, in Campbell and Engelund (2026), and in their symmetric infinite-horizon setting with smooth terminal losses, their identities and smooth fit would give a relation like it. Their hypotheses exclude this model's 0-1 loss. The paper proves the identities, the regularity, and the equation for the 0-1 loss, and doesn't list the equation among its new results.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"lem:envelope": "decision-cost", "prop:regularity": "smooth", "prop:exact": "equation", "rem:speed": "cosh"}

# which groups of checks in tools/checks/ stand behind each plate
CHECKS = {
    "frozen": ["envelope", "grid"], "regular": ["regularity", "grid"], "band": ["holder", "grid", "words"],
    "area": ["exact", "area"], "live": ["exact", "grid", "words"], "speed": ["speed"],
}

PLATES = {
    "frozen": {
        "title": "The frozen rule touches from below",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, one sweep for the expected cost at decision, and the frozen rule's law of decision times",
        "caption": r"""The test schedule from the paper's code, $c(t) = 0.1 + 0.3/(1 + e^{-(t - 1.5)/0.05})$, on a grid with time step 0.005 and evidence step 0.01, with the choice forced at time 8. Pick the time $t$ the rule is frozen at and the evidence $y$. Each step of the proof draws its own picture: the value against the evidence; $V(t', y)$ (ink) and the frozen rule's reward $J(t')$ (orange) against the start time; the law of the moment of decision $t + \tau^*$ (green) under the cost; the two slopes at the touching point; and $\E_y[c(t + \tau^*)]$ against $y$. $J$ comes from moving the frozen rule's undecided probability forward one step at a time on the same grid.""",
        "wide": False,
    },
    "regular": {
        "title": "Floor, cap, and smooth fit",
        "state": "computed",
        "state_text": "Computed in the page: the dynamic program's value on a grid, and paths sampled against its bound",
        "caption": r"""The test schedule from the paper's code on the same grid, so $c_{\min} = 0.1$ and $c_{\max} = 0.4$. Step 1: $\Lop W = \E_y[c(t + \tau^*)]$ against $c_{\min}$. Step 2: $W = V - g$ from the program against $c_{\min}(b - y)^2$, with $b$ the grid's bound. Step 3: $W$ at two times 0.3 apart, near the lower of their two bounds, with the floor $c_{\min}\,\Delta b^2$ and the cap $(c_{\max} - c_{\min})|\Delta t|$. Step 4: 200 paths sampled from $b - \varepsilon$ (12 drawn; Euler steps of $2\times10^{-5}$ with a fixed seed; add `?seed=` to the address for another), against the computed bound, against $b + C\sqrt s$ with $C = \sqrt 3$ (the most (b) lets the bound rise), and against the proof's looser $b + K\sqrt s$ with $K = 1 + C$; a path still below the bound at $s = 0.04$ counts as not crossed, and the time printed is when half of the 200 have crossed. Step 5: $W$ near the grid's bound, with chords from it to grid points; $\varepsilon$ is each grid point's actual distance to that bound, and the readings give the size of each chord's slope, $W(t, b - \varepsilon)/\varepsilon$ (the slopes on the chart are negative).""",
        "wide": False,
    },
    "band": {
        "title": "The band the bound can't leave",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on the paper's test grid",
        "caption": r"""Top: the cost, on a log scale. Bottom: the best bound from the dynamic program on the paper's test grid ($\Delta t = 0.002$, $h = 0.005$, a forced choice at time 10), moved out by $0.5826\sqrt{\Delta t}$ (ink); the per-moment bound $B(c(t))$ (dashed); and the band $b(t_0) \pm C\sqrt{|t - t_0|}$ that {{ref:prop:regularity}}(b) allows around the anchor (orange), with $C = \sqrt{(c_{\max} - c_{\min})/c_{\min}}$ from bounds on the schedule's cost over all time, read from its formula (its lowest and highest levels; for Smooth, $c_0 e^{\pm 1.1 \times \text{size}}$). The largest moves printed are sampled on the grid every 0.01. When the first grid step past the center already decides, the bound is below that step: the program places it between the center and the step if the center still waits, and at 0 if the center decides too (the paper's code reports 0 in both cases). The band is a statement about the continuous bound; the computed bound, and the anchor read from it, are a comparison, with no promise that they stay inside. Deadlines and rising costs aren't drawn.""",
        "wide": True,
    },
    "area": {
        "title": "The area, integrated up to the bound",
        "state": "computed",
        "state_text": "Computed in the page: the dynamic program's value and the sweep for the expected cost at decision",
        "caption": r"""The test schedule from the paper's code on the grid of $\Delta t = 0.005$ and $h = 0.01$. Top: $2\cosh^2 y\,\E_y[c(t + \tau^*)]$ from the sweep (green), beside $2\cosh^2 y\,c(t)$ (dashed), shaded from 0 to $z$. Bottom: the shaded area against $z$ (green); $\cosh^2 z\,V_y(t, z)$ from central differences of the program's value (dots); and the line $\cosh^2 z\,g'(z) = \tfrac12$. The integral runs to the grid's bound moved out by $0.5826\sqrt{\Delta t}$, by the trapezoid rule. Near the bound, $\E_y[c(t + \tau^*)]$ approaches $c(t)$, since a decision that starts at the bound ends at once; on this rising schedule it approaches from above, and on the grid that approach takes the last cell or two.""",
        "wide": False,
    },
    "live": {
        "title": "One equation, on your schedule",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on two grids, and one sweep for the expected cost at decision",
        "caption": r"""Your schedule (top, log scale). Middle: the left side $\int_0^{b(t)}\cosh^2 y\,\E_y[c(t + \tau^*)]\,dy$ every 0.01 time units (ink), against $\tfrac14$, and the same integral with the cost now, $c(t)$, in place of $\E_y[c(t + \tau^*)]$ (dashed). Below it: the left side minus $\tfrac14$, on both grids. Bottom: the integrand at the time on show, shaded from 0 to the bound. The two grids are $\Delta t = 0.01$ with $h = 0.02$, and the paper's test grid, $\Delta t = 0.002$ with $h = 0.005$; both force a choice at time 10. The bound is the grid's moved out by $0.5826\sqrt{\Delta t}$, as in the paper's test. Near the bound, $\E_y[c(t + \tau^*)]$ approaches $c(t)$, from above or below, since a decision that starts at the bound ends at once; on the grid, that approach takes the last cell or two. When the first grid step past the center already decides, the bound is below that step, which the grid can't resolve: the program places it between the center and the step if the center still waits, and at 0 if the center decides too (the paper's code reports 0 in both cases). Those times are gaps in that grid's curves, the reading at such a time is marked unresolved, and every residual the plate gives leaves them out. The sweep for $\E_y[c(t + \tau^*)]$ stops or waits at each grid point exactly as the program does. The plate runs only for schedules that meet the standing assumption.""",
        "wide": True,
    },
    "speed": {
        "title": "Same algebra, two diffusions",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""The cost times the speed density $m$, shaded from 0 to the constant-cost bound, and the scale density $s'$ (gray, on its own scale from 0 to 1 at the right). For $Y$: $m = 2\cosh^2 y$, $s' = \sech^2 y$, and the bound solves $\sinh 2b + 2b = 1/c$. For the unknown-reliability belief $u$: $m = 2e^{u^2/2}$, $s' = e^{-u^2/2}$, and the bound $U(\kappa)$ solves $\int_0^U e^{v^2/2}\,dv = 1/(2\sqrt{2\pi}\,\kappa)$. Areas by the trapezoid rule on 400 intervals.""",
        "wide": False,
    },
}

STRIPS = {
    "lemma2": {
        "plate": "frozen",
        "steps": [
            ("Below the bound, the value is smooth and solves the backward equation.",
             r"Work with the signed value $U(t, x) = V(t, |x|) - \int_0^t c(u)\,du$, so a rectangle can contain $x = 0$: stopped at the exit from a closed rectangle inside the continuation set, it is a martingale, and the uniformly parabolic Dirichlet problem there has a smooth solution equal to it. So $V$ is smooth in $y$, continuously differentiable in $t$, $V_y(t, 0) = 0$, and $\class{lit}{V_t + \Lop V = c}$. (The paper extends the cost to $t < 0$ by $c(0)$, so $t = 0$ is an interior time.)"),
            ("Freeze the optimal rule from one start, and use it from other start times.",
             r"Fix $(t, y)$ below the bound and freeze its optimal stopping time $\tau = \tau^*_{t,y}$. For any start time $t'$, using that same $\tau$ earns $J(t') = \E_y\bigl[g(Y_\tau) - \int_0^\tau c(t' + s)\,ds\bigr]$, so $\class{lit}{J(t') \le V(t', y)}$, with equality at $t' = t$."),
            ("Moving the start changes the cost paid over the whole decision, but its derivative involves only the costs at the two ends.",
             r"Differentiate: $\frac{d}{dt'}\int_0^\tau c(t' + s)\,ds = c(t' + \tau) - c(t')$, so $\class{lit}{J'(t) = c(t) - \E_y c(t + \tau)}$. (The difference quotients are bounded by $2c_{\max}$, so the derivative passes inside the expectation.)"),
            ("A curve that stays below another and touches it has the same slope there.",
             r"$V - J \ge 0$ has a minimum at $t$, and both are differentiable there, so $\class{lit}{V_t(t, y) = J'(t) = c(t) - \E_y[c(t + \tau^*)]}$."),
            ("Subtract from the backward equation.",
             r"From $V_t + \Lop V = c$: $\class{lit}{\Lop V(t, y) = \E_y[c(t + \tau^*_{t,y})]}$. The value's curvature term is the expected cost at the moment of decision."),
        ],
    },
    "prop3": {
        "plate": "regular",
        "steps": [
            ("Below the bound, the curvature term of the value of waiting is at least the lowest cost.",
             r"(a) By {{ref:lem:envelope}} and $\Lop g = 0$, $\Lop W = \Lop V \ge c_{\min}$ below the bound, so $\class{lit}{(\cosh^2 y\,W_y)' \ge 2c_{\min}\cosh^2 y}$."),
            ("Integrate twice from the bound: a parabola sits under the value of waiting.",
             r"Integrate from $y$ to $z < b$ and use $W_y(z) \le 0$ ({{ref:lem:structure}}(a)): $-\cosh^2 y\,W_y(y) \ge 2c_{\min}\int_y^z\cosh^2 u\,du \ge 2c_{\min}\cosh^2 y\,(z - y)$. Let $z \to b$: $-W_y(y) \ge 2c_{\min}(b - y)$. Integrate once more, with $W(t, b) = 0$: $\class{lit}{W(t, y) \ge c_{\min}(b - y)^2}$."),
            ("At one time's bound, the other time's value of waiting is caught between a floor and a cap.",
             r"(b) Suppose $b(t') > b(t)$ and look at $y = b(t)$. There $W(t, y) = 0$, while (a) at time $t'$ gives $W(t', y) \ge c_{\min}(b(t') - b(t))^2$. {{ref:lem:structure}}(d) caps the difference at $(c_{\max} - c_{\min})|t' - t|$. So $\class{lit}{c_{\min}(b(t') - b(t))^2 \le (c_{\max} - c_{\min})|t' - t|}$."),
            ("A path that starts just below the bound crosses it almost at once.",
             r"(c) By (b), the bound can rise by at most $K\sqrt s$ in time $s$, with $K = 1 + \sqrt{(c_{\max} - c_{\min})/c_{\min}}$. Start a coupled path at $b - \epsilon$: since its drift is nonnegative, it is at least $b - \epsilon + B_s$, and by the law of the iterated logarithm $B_s$ exceeds $2K\sqrt s$ at arbitrarily small $s$. So the path crosses the bound almost at once: $\class{lit}{\tau_\epsilon \to 0}$."),
            ("Compare the starts at the bound and just below it under one stopping time: the slopes match.",
             r"Since $\tau_\epsilon$ is a stopping time for both starts, $V(t, b) - V(t, b - \epsilon) \ge \E\bigl[g(Y^0_{\tau_\epsilon}) - g(Y^\epsilon_{\tau_\epsilon})\bigr]$, and the integrand is never negative, because $Y^\epsilon \le Y^0$ and $g$ is increasing; so leaving out an event only lowers the right side. On the event that the lower path doesn't reach 0 first (no reflection), the two paths stay at least $\epsilon$ apart, and since $g'$ is decreasing, the integrand is at least $\epsilon\,g'(Y^0_{\tau_\epsilon})$. As $\epsilon \to 0$, that event has probability tending to 1 and $Y^0_{\tau_\epsilon} \to b$, so $\liminf_{\epsilon \to 0}[V(t, b) - V(t, b - \epsilon)]/\epsilon \ge g'(b)$, and $W(t, b - \epsilon)/\epsilon \to 0$. Because $\cosh^2 y\,W_y$ is nondecreasing and $W_y \le 0$, $W_y$ has a limit at the bound, and the mean value theorem makes it 0: $\class{lit}{V_y \to g'(b)}$. That is smooth fit."),
        ],
    },
    "prop4": {
        "plate": "area",
        "steps": [
            ("Below the bound, the value's slope, scaled by cosh², grows at twice the weighted expected cost.",
             r"From {{ref:lem:envelope}} and the $\cosh^2$ identity: $\class{lit}{(\cosh^2 y\,V_y)' = 2\cosh^2 y\,\Lop V = 2\cosh^2 y\,\E_y[c(t + \tau^*_{t,y})]}$ on $[0, b(t))$, with $V_y(t, 0) = 0$."),
            ("Integrate from the center.",
             r"Integrate from 0 to $z < b(t)$: $\class{lit}{\cosh^2 z\,V_y(t, z) = 2\int_0^z \cosh^2 y\,\E_y[c(t + \tau^*_{t,y})]\,dy}$."),
            ("At the bound, smooth fit makes the left side one half.",
             r"Let $z \uparrow b(t)$. By smooth fit ({{ref:prop:regularity}}(c)), the left side tends to $\class{lit}{\cosh^2 b(t)\,g'(b(t)) = \tfrac12}$, since $g'(y) = 1/(2\cosh^2 y)$."),
            ("Divide by 2.",
             r"$\class{lit}{\int_0^{b(t)}\cosh^2 y\,\E_y[c(t + \tau^*_{t,y})]\,dy = \tfrac14}$."),
        ],
    },
}

SECTIONS = [
    {
        "id": "decision-cost",
        "title": "The cost at the moment of decision",
        "blocks": [
            ("plain", r"""
Write $V(t, y)$ for the value of starting a decision at time $t$ with evidence $y$ (chapter 3), and $\tau^*_{t,y}$ for the optimal decision time from there: the first time the evidence reaches the best bound $b(t + s)$. Below the bound, how fast the value changes with the start time is the cost now minus the expected cost at the moment of decision. That is {{ref:lem:envelope}}:

$$V_t(t, y) = c(t) - \E_y\bigl[c(t + \tau^*_{t,y})\bigr], \qquad \Lop V(t, y) = \E_y\bigl[c(t + \tau^*_{t,y})\bigr].$$

The second identity follows from the first and the backward equation $V_t + \Lop V = c$. In words: the value's curvature term, $\Lop V = \tfrac12 V_{yy} + \tanh(y)\,V_y$, is the expected cost at the moment of decision. For a constant cost, it is just $c$, as in chapter 3; for a cost that changes, it depends on the cost after $t$.

The argument is an envelope theorem. Hold the optimal rule from $(t, y)$ fixed and slide the start time to $t'$. The reward that frozen rule earns, $J(t')$, can't beat the best rule from $t'$, so $J(t') \le V(t', y)$, with equality at $t' = t$. A curve that stays below another and touches it at one point has the same slope there. When only the start time moves, the cost paid changes over the whole decision, but its derivative involves only the costs at the two ends.

The plate asks a question first. Then scrub the proof: each step redraws the plate, from the program's value on the test schedule from the paper's code (the “smooth step” of `tests/test_exact_equation.py`).
"""),
            ("strip", "lemma2"),
            ("plain", r"""
Campbell and Engelund (2026) have both identities for smooth terminal losses: their Corollary 4.3 gives the curvature of the value in the continuation region, and their identity (6.14) gives $V_t$ on an infinite horizon. Their hypotheses exclude this model's 0-1 loss, which has a kink, so the paper proves the identities directly for it.
"""),
            ("exact", "312-332", "The paper's lemma, and the paragraph after it"),
            ("exact", "1321-1342", "The full proof, from Appendix A"),
            ("limits", r"""
**What the lemma covers.** Points strictly below the bound, for a continuous cost between two positive constants. At the bound itself it says nothing: how the value meets the reward for deciding there is smooth fit, on the next page.
"""),
        ],
    },
    {
        "id": "smooth",
        "title": "How smooth the bound has to be",
        "blocks": [
            ("plain", r"""
The equation comes from integrating the curvature identity up to the bound, and that step uses how the value meets the reward for deciding there. The paper proves what it needs rather than assuming it. Write $W = V - g \ge 0$ for the value of being allowed to wait; it is 0 at and above the bound. {{ref:prop:regularity}} says three things.

- (a) Nondegeneracy: $W(t, y) \ge c_{\min}(b(t) - y)^2$ below the bound. The value of waiting grows at least like $c_{\min}$ times the squared distance to the bound.
- (b) Hölder continuity: $|b(t) - b(t')| \le \sqrt{(c_{\max} - c_{\min})/c_{\min}}\;|t - t'|^{1/2}$. The bound can't jump, however fast the cost moves.
- (c) Smooth fit: at every time, $V_y(t, y) \to g'(b(t))$ as $y \uparrow b(t)$. The value meets the reward for deciding with a matching slope.

Part (b) follows from (a) and {{ref:lem:structure}}(d) in one line. Part (c) uses (b) through the law of the iterated logarithm and a coupling: the one-dimensional case of De Angelis and Peskir's (2020) mechanism, which derives smooth fit from the regularity of boundary points alone. The plate beside the proof uses the test schedule from the paper's code, a cost of 0.1 that rises toward 0.4 around time 1.5, so $c_{\min} = 0.1$, $c_{\max} = 0.4$, and the constant in (b) is $\sqrt 3$.
"""),
            ("strip", "prop3"),
            ("plain", r"""
Now a much steeper schedule: Figure 1(a)'s 16-fold rise, where the cost changes almost at once. Guess what the bound can do before the plate shows it.
"""),
            ("plate", "band"),
            ("plain", r"""
The constant in (b) isn't claimed to be sharp, and on Figure 1(a) it is far from it. What (b) rules out is a jump: the bound is continuous for every cost the assumption allows. The paper claims no more regularity than this for the exact bound.
"""),
            ("exact", "334-357", "The paper's proposition, and the paragraphs after it"),
            ("exact", "1344-1383", "The full proof, from Appendix A"),
        ],
    },
    {
        "id": "equation",
        "title": "One equation, checked live",
        "blocks": [
            ("plain", r"""
Multiply the curvature identity by $2\cosh^2 y$, integrate from the reflecting center to the bound, and use smooth fit, with $\cosh^2 b\,g'(b) = \tfrac12$. The result is {{ref:prop:exact}}: for every $t \ge 0$,

$$\int_0^{b(t)} \cosh^2 y\;\E_y\bigl[c(t + \tau^*_{t,y})\bigr]\,dy = \frac14.$$

The integrand is the expected cost at the moment of decision from each starting level $y$, weighted by $\cosh^2 y$. For a constant cost, the left side is $c\,(\tfrac12 b + \tfrac14\sinh 2b)$, and the equation is the classical $\sinh(2b) + 2b = 1/c$ of chapter 3; at $c = 0.1$ its root is {{BoundTenth}}. It holds for every continuous cost between two positive constants, and it contains no derivative of the bound, which makes it easy to linearize, as chapter 6 does. The proof is four steps.
"""),
            ("strip", "prop4"),
            ("plain", r"""
The equation characterizes the bound but doesn't compute it: the integrand depends on the bound's own future, through $\tau^*$. What a page can do is check it. The plate below solves the dynamic program for your schedule, runs the policy it finds backward once more to get $\E_y[c(t + \tau^*)]$ at every grid point, and integrates.

Where the left side misses $\tfrac14$, the miss is numerical, and it can come from three places. The grid: the program checks the evidence every $\Delta t$, so its bound sits about $0.5826\sqrt{\Delta t}$ inside the continuous one, and the page adds back that shift, which is only its leading term. The finite horizon: the program forces a choice at time 10, and the bound falls to 0 as that time nears. The solver: the bound is interpolated between grid points, and the integral is a trapezoid sum. The paper's own test, `tests/test_exact_equation.py`, checks the same thing on the same grid as the plate's finer one, at six times on three schedules, and allows a miss of $1.5 \times 10^{-3}$. Figure 1(a)'s step is 16-fold, against at most 4-fold in those three schedules, and on the same grid its residual is larger than that allowance; the plate prints it.
"""),
            ("plate", "live"),
            ("plain", r"""
**Where the equation stands.** The two identities behind it appear, for smooth terminal losses, in Campbell and Engelund (2026), and in their symmetric infinite-horizon setting with smooth terminal losses, their identities and smooth fit would give a relation like it. Their own boundary equation is a different, Peskir-type one. Their hypotheses exclude the 0-1 loss of this model. The paper proves the identities, the regularity, and the equation for the 0-1 loss and uses the equation to prove {{ref:thm:main}}; it lists the equation as its first contribution, but not among the results it calls new.
"""),
            ("exact", "359-376", "The paper's proposition, and the paragraph after it"),
            ("exact", "1385-1389", "The proof, from Appendix A"),
            ("exact", "195-201|The identities|", "The paper's credit, in its introduction"),
            ("exact", "1156-1170||first-order theorem.", "And in its related work"),
            ("limits", r"""
**What the equation covers, and what it doesn't.** Every continuous cost between two positive constants, on an infinite horizon, for this model's 0-1 loss. A deadline makes the cost infinite, and a cost that keeps rising has no upper level ({{claim:asm:cost}}): the equation says nothing about either, and the plate doesn't draw them. Nor is it a formula: it can't be solved for $b(t)$ directly.
"""),
        ],
    },
    {
        "id": "cosh",
        "title": "Why cosh²",
        "blocks": [
            ("plain", r"""
The weight $\cosh^2 y$ is not special to this problem. For a one-dimensional diffusion with generator $\tfrac12 f'' + \mu f'$, scale density $s' = \exp(-\int 2\mu)$, and speed density $m = 2/s'$, one has $(f'/s')' = m\,\Lop f$. For $Y$, $s' = \sech^2 y$ and $m = 2\cosh^2 y$. Because the reward is harmonic, $g'/s'$ is a constant, $\tfrac12$, and the same steps give

$$\int_0^{b(t)} m(y)\,\E_y\bigl[c(t + \tau^*_{t,y})\bigr]\,dy = \frac{g'}{s'},$$

which is the exact equation times 2. So the exact equation is one case of an identity for one-dimensional problems with a harmonic reward. {{ref:rem:speed}} states this as “the same steps give”; turning the identity into an equation for the bound also needs reflection at the center, the envelope identity, and smooth fit, and the paper proves those only for this model.

Normalized on $[0, b_0]$, the speed density is the start law $\pi_0(y) = 4c_0\cosh^2 y$ of chapter 6, so the kernel is the decision time started from the normalized speed measure. At $c_0 = 0.1$, that decision takes {{LookAheadTenth}} time units on average, against {{DecisionTimeTenth}} from 0.
"""),
            ("plate", "speed"),
            ("plain", r"""
Chapter 11 reuses the remark for unknown evidence reliability, where the belief $u$ has drift $u/2$ in information time: $s' = e^{-u^2/2}$, $m = 2e^{u^2/2}$, and $\Phi'/s' = 1/\sqrt{2\pi}$. There the paper carries the equation over formally, not as a theorem: the cost in information time grows without bound, outside the assumption, and the paper proves no analog of {{ref:prop:regularity}} or {{ref:thm:main}} for that process.
"""),
            ("exact", "378-388", "The paper's remark"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's four printed heavier. The chapter uses chapter 2's reflected process $Y$ and its strong solutions, chapter 3's standing assumption on the cost, and chapter 4's structure lemma ({{ref:lem:structure}}), optimal stopping facts, and optimal decision time $\tau^*$. In turn, {{ref:prop:exact}} is the equation {{ref:thm:main}} subtracts in chapter 6, and chapter 12's account of what is new says where it stands. {{ref:prop:regularity}} also feeds the second-order loss of chapter 7 ({{ref:prop:loss}}) and, with {{ref:lem:envelope}}, the unequal-rewards extension of chapter 11; {{ref:rem:speed}} feeds the unknown-reliability extension there.
"""),
            ("map", "prop:exact"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Check both identities of {{ref:lem:envelope}} for a constant cost.",
                 r"""
With $c(t) \equiv c$, $\E_y[c(t + \tau^*)] = c$. The first identity gives $V_t = c - c = 0$: the value doesn't depend on the start time, as it shouldn't. The second gives $\Lop V = c$, the equation solved in {{ref:eq:constant-bound}}.
"""),
                (r"Suppose the cost never decreases after $t$ and rises at some point. Is $V_t$ positive or negative below the bound?",
                 r"""
Then $c(t + \tau^*) \ge c(t)$ on every path, so $\E_y[c(t + \tau^*)] \ge c(t)$ and $V_t \le 0$. It is strictly negative: if the cost is above $c(t)$ from some time $t + s_0$ on, then from any start below the bound, the evidence stays below the bound past $s_0$ with positive probability, so $c(t + \tau^*) > c(t)$ with positive probability and $\E_y[c(t + \tau^*)] > c(t)$. Starting later is worse. If the cost never increases after $t$, $V_t \ge 0$. A cost that rises briefly and then falls below $c(t)$ can give either sign: the identity weighs the whole distribution of the cost at the moment of decision.
"""),
                (r"Why can the proof freeze the stopping time while moving $t'$, when the optimal stopping time from $t'$ is different?",
                 r"""
Because it only needs a lower bound that touches $V$ at $t$. Any fixed stopping time used from any start time gives a reward at most $V(t', y)$, and the frozen $\tau^*_{t,y}$ gives exactly $V(t, y)$ at $t' = t$. A differentiable function that stays above another and touches it at an interior point has the same derivative there. This is the same move as the envelope theorem in economics.
"""),
                (r"Derive {{ref:prop:regularity}}(b) from (a) and {{ref:lem:structure}}(d).",
                 r"""
Take $b(t') > b(t)$ and $y = b(t)$. At time $t$, $y$ is on the bound, so $W(t, y) = 0$. At time $t'$, $y$ is below the bound $b(t')$, so (a) gives $W(t', y) \ge c_{\min}(b(t') - b(t))^2$. Since $g$ doesn't depend on time, $W(t', y) - W(t, y) = V(t', y) - V(t, y) \le (c_{\max} - c_{\min})|t' - t|$. Combine: $(b(t') - b(t))^2 \le \frac{c_{\max} - c_{\min}}{c_{\min}}|t' - t|$. Swapping $t$ and $t'$ covers $b(t') < b(t)$.
"""),
                (r"What does (b) say for a constant cost? And for a continuous cost that rises from $c$ to $3c$ in a steep logistic step?",
                 r"""
For a constant cost, $c_{\max} = c_{\min}$, the constant is 0, and the bound is constant, as it should be. For the step, $c_{\min} = c$ and $c_{\max} = 3c$, so the constant is $\sqrt 2$ however steep the step is: the bound can move by at most $\sqrt{2\,|t - t'|}$ between two times. The cost can change almost at once; the bound cannot.
"""),
                (r"Why does the exact equation need smooth fit?",
                 r"""
Integrating $(\cosh^2 y\,V_y)'$ from 0 to the bound leaves the boundary term $\cosh^2 b\,V_y(b-)$. Smooth fit says $V_y(b-) = g'(b) = 1/(2\cosh^2 b)$, so the term is exactly $\tfrac12$. Without it, the right side of the equation would be unknown.
"""),
                (r"Check that the equation reduces to $\sinh(2b) + 2b = 1/c$ for a constant cost.",
                 r"""
With $\E_y[c] = c$: $c\int_0^b\cosh^2 y\,dy = c\,(\tfrac12 b + \tfrac14\sinh 2b) = \tfrac14$. Multiply by $4/c$: $2b + \sinh 2b = 1/c$.
"""),
                (r"Suppose the cost never decreases after time $t$. Use the equation to show that $b(t) \le B(c(t))$.",
                 r"""
If $c$ is nondecreasing from $t$ on, then $c(t + \tau^*) \ge c(t)$ on every path, so $\E_y[c(t + \tau^*)] \ge c(t)$ for every $y$. Then $c(t)\int_0^{b(t)}\cosh^2 y\,dy \le \int_0^{b(t)}\cosh^2 y\,\E_y[c(t + \tau^*)]\,dy = \tfrac14 = c(t)\int_0^{B(c(t))}\cosh^2 y\,dy$, and since $\int_0^b\cosh^2$ increases with $b$, $b(t) \le B(c(t))$. So when the cost never decreases after $t$, the optimal bound sits at or below the per-moment bound; when it never increases, at or above. (An exercise from the equation; the paper doesn't state it.)
"""),
                (r"Can you solve the equation for $b(t)$ directly?",
                 r"""
No. The integrand depends on the future of the bound itself, through $\tau^*$, the first time the evidence reaches $b(t + s)$. The equation characterizes the bound; it doesn't compute it. Its use is that it has no derivative of $b$ in it, so subtracting its constant-cost version gives an equation for $b_\varepsilon - b_0$ that can be expanded in $\varepsilon$.
"""),
                (r"Compute $s'$, $m$, and $g'/s'$ for $Y$, and check that the general identity gives the exact equation.",
                 r"""
The drift is $\tanh y$, so $s' = \exp(-\int_0^y 2\tanh u\,du) = \exp(-2\log\cosh y) = \sech^2 y$, and $m = 2/s' = 2\cosh^2 y$. Then $g'/s' = \tfrac12\sech^2 y/\sech^2 y = \tfrac12$. The identity reads $\int_0^b 2\cosh^2 y\,\E_y[c]\,dy = \tfrac12$, which is the exact equation times 2.
"""),
                (r"For the unknown-reliability belief $u$, with generator $\tfrac12\partial_u^2 + \tfrac12 u\,\partial_u$ and reward $\Phi(|u|)$, what replaces $\cosh^2$ and $\tfrac14$?",
                 r"""
The drift is $\tfrac12 u$, so $s' = e^{-u^2/2}$ and $m = 2e^{u^2/2}$; $\Phi'(u)/s' = (e^{-u^2/2}/\sqrt{2\pi})/e^{-u^2/2} = 1/\sqrt{2\pi}$. The equation would become $\int_0^U 2e^{u^2/2}\,\E_u[\kappa(\theta + \tau^*)]\,du = 1/\sqrt{2\pi}$, as the paper writes it in {{ref:sec:extensions}}. There, it is carried over formally, not proved ({{claim:ext:unknown}}).
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“$\Lop V$ equals the current cost $c(t)$.”",
                 r"It does when the cost is constant from $t$ on, and at any moment where the expected cost at the moment of decision happens to equal $c(t)$. In general, it is the expected cost at the moment of decision, which depends on the cost after $t$."),
                (r"“These identities are new.”",
                 r"Campbell and Engelund (2026) have both, for smooth terminal losses (their Corollary 4.3 and identity (6.14)). Their hypotheses exclude the 0-1 loss, so the paper proves them directly for it ({{claim:claim:novelty}})."),
                (r"“Smooth fit is assumed, as usual.”",
                 r"The paper proves it at every time, from the Hölder bound, rather than assuming it."),
                (r"“The bound moves like $\sqrt t$.”",
                 r"(b) is an upper bound on how fast it *can* move, with a constant that isn't claimed to be sharp. The paper claims no more regularity than this for the exact bound."),
                (r"“The exact equation is claimed as new.”",
                 r"The paper lists it as a contribution and proves it for the 0-1 loss, but its novelty sentence does not claim it: Campbell and Engelund's identities, with smooth fit, would also give a spatially integrated relation like it in their smooth-loss setting. Their own boundary equation is a different, Peskir-type one ({{claim:claim:novelty}})."),
                (r"“It holds for deadlines.”",
                 r"It needs a continuous cost bounded between two positive constants. A deadline makes the cost infinite ({{claim:asm:cost}})."),
                (r"“The remark proves the exact equation for every one-dimensional diffusion.”",
                 r"It says the same steps give the general identity; the paper proves the equation only for this model. The claim map notes that the general case is not proved beyond “the same steps.”"),
            ]),
        ],
    },
]
