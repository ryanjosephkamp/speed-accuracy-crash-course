"""Chapter 3: the model.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("strip", id) place a live plate, a printed figure, or a proof strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "model",
    "num": 3,
    "title": "The model",
    "full": "The model: what a decision earns, which costs the theory allows, the value of waiting, and the flat bound",
    "leaf": 4,
    "finding": "A decision earns its chance of being right minus the cost of its time; at a constant cost c, the best rule stops when the evidence reaches B(c), where sinh 2b + 2b = 1/c.",
    "readings": [
        ("BoundTenth", "the best flat bound at a cost of 0.1, in units of evidence (half the log odds)"),
        ("DecisionTimeTenth", "its mean decision time, b tanh b, in time units"),
    ],
    "hero": {
        "aria": "For six costs of time in turn, the chance of being right minus the cost of time for a flat bound, peaking at the best bound, and below it the best flat bound against the cost",
        "caption": r"""A constant cost $c$, stepping from 0.03 to 0.8. Top: for a flat bound $b$, the chance of being right, $g(b)$ (gray), the bill for time, $c\,b\tanh b$ (orange), and their difference (ink), which peaks at $B(c)$. Bottom: $B(c)$ against $c$. A higher cost means a lower bound. Closed forms, computed in the page.""",
    },
    "intro": r"""
A decision earns its chance of being right minus the cost of its time; at a constant cost c, the best rule stops when the evidence reaches B(c), where sinh 2b + 2b = 1/c. This chapter sets up the stopping problem the rest of the paper works on: what a decision earns, which costs of time the theory allows, what the chance to wait is worth, and the answer for a constant cost, which every later chapter starts from.

The constant-cost answer is classical, and the paper cites it rather than claiming it. What the chapter works through is the paper's own short derivation, by both of the routes it names, and the slope $B'(c)$ that chapter 6 puts in front of the kernel.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"def:reward-cost": "earns", "asm:cost": "allowed", "def:value": "value", "eq:constant-bound": "flat", "eq:Bprime": "slope"}

# which groups of checks in tools/checks/ch03.mjs stand behind each plate
CHECKS = {
    "earn": ["bill", "value", "words"], "allows": ["standing", "words"], "value": ["value", "words"],
    "peak": ["flat", "words"], "routes": ["flat", "words"], "double": ["slope", "flat", "words"], "inverse": ["slope", "flat", "words"],
}

PLATES = {
    "earn": {
        "title": "What one decision earns",
        "state": "computed",
        "state_text": "Sampled in the page, beside averages computed from the series",
        "caption": r"""Top: one path of the evidence from 0, in Euler steps of 0.001 time units under $dX = \tanh(X)\,dt + dW$ (the decision maker's own view of the evidence, chapter 2), seeded (add `?seed=` to the address for another); it stops at the first check where $|X|$ reaches the flat bound $\pm b$ (orange; drag it) moved in by $0.5826\sqrt{0.001}$, and the dot and the path's chance of being right, $g(|X|)$, are at that check. Middle: your schedule's cost, with this path's bill shaded. The averages are for checking the evidence continuously, computed in the page: without a deadline, the reward is $g(b)$ and the bill is $\int_0^\infty c(s)\,P_0(\tau_b > s)\,ds$; with a deadline $T$, the reward is $g(b)\,P_0(\tau_b \le T) + \E_0[g(|X_T|);\ \tau_b > T]$ (by Simpson's rule over the density of the paths still open) and the bill is the integral to $T$. The bill's integral runs in steps of 0.01 to time 6 ($b^2/40$ for bounds below about 0.63) and 0.02 after, and stops at the earlier of a deadline and the time where the chance of still being undecided, from its series, falls below $10^{-10}$. Across each step, it takes $\log c$ as linear (halving the step where it isn't) and the chance of still being undecided as quadratic, and a drawing's corners are always step ends. After Show me: the averages against $b$, and what the best time-dependent policy earns, $V(0, 0)$ from the dynamic program of the value plate (time step 0.01, evidence step 0.02, the choice forced at time 8.5 or at a deadline), whose bound can change with the cost ahead and with the time left before the forced choice, and which differs from the averages by the grid's checking as well; the sentence compares it with the best level held flat on the same grid that a numerical search found, and states the time-dependent policy's gain over that level. The search scores each odd multiple of 0.01 up to 0.31, then every 0.05 up to 3.5 and every 0.1 below the evidence cap of 5, and refines up to the three highest sampled peaks by golden section; it doesn't score every level, so a level it skipped can score slightly higher.""",
        "wide": True,
    },
    "allows": {
        "title": "Check your schedule",
        "state": "computed",
        "state_text": "Computed in the page from the schedule's formula",
        "caption": r"""Your schedule's cost to time 10, on a log scale (orange), with the part the book draws shaded gray. Where the standing assumption holds, the dashed lines are levels the cost stays between for all time, $c_{\min}$ and $c_{\max}$: the lowest and highest values it takes (for the book's presets, sampled every 0.002 time units to time 70, by which each has settled or repeated, and refined between samples; for a drawing, its lowest and highest points), rounded outward to two figures, so each level is a bound even where the cost only approaches it. The band for the bound, $B(c_{\max})$ to $B(c_{\min})$ from {{ref:lem:structure}}(c), is rounded outward too.""",
        "wide": False,
    },
    "value": {
        "title": "The value of waiting",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid",
        "caption": r"""Top: your schedule's cost (log scale). Map: the value of waiting, $W = V - g$, over the start time and the evidence, darker where it is larger (scaled to the largest value on the map), from a dynamic program with time step 0.01 and evidence step 0.02, its choice forced 6 time units past the window or at the last moment you pick. The ink curve is the program's best bound: where deciding starts to beat waiting, read between the grid's evidence points by interpolating the two values' difference, so $W = 0$ at the grid points above it (between grid points, the shaded slice only joins the kept values); the dashed curve is $B(c(t))$, moved in by $0.5826\sqrt{0.01}$ because the program checks the evidence every 0.01. At a deadline, both fall straight to 0 from their values at the last check before it. Where the program waits at $y = 0$ but decides one evidence step out, the page puts the bound between the two, where its deciding and waiting values cross; the paper's code reports 0 there. A tap is read at the nearest kept sample. Bottom, after Show me: at the time you pick, $V(t, y)$ (ink) above $g(y)$ (gray), with $W$ shaded between them.""",
        "wide": True,
    },
    "peak": {
        "title": "Where the reward peaks",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""For a flat bound $b$ at a constant cost: the chance of being right, $g(b)$ (gray), and the bill for time, $c\,b\tanh b$ (orange). After Show me: their difference (ink), which peaks at $B(c)$, where the two dashed tangents have the same slope.""",
        "wide": False,
    },
    "routes": {
        "title": "Two routes, one equation",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""Each step at the cost you pick, for three trial levels, $0.7\,B(c)$, $B(c)$, and $1.3\,B(c)$. Steps 1 and 3: the value of following the flat rule at level $b$, $V_b(y) = g(b) - c\,(b\tanh b - y\tanh y)$ below $b$, beside $g(y)$ (gray); the dots mark where each meets $g$. Step 2: $\cosh^2 y\,V_b'(y)$, one curve below every level, each level's piece ending at its dot (above its level, that rule stops, and its value is $g$), beside $\tfrac12$. Step 4: the reward of a flat bound and its two parts, with the three levels marked. Step 5: its slope $R'(b)$ (ink) and the bracket $\tfrac12 - c\,(b + \tfrac12\sinh 2b)$ (dashed).""",
        "wide": False,
    },
    "double": {
        "title": "Double the cost",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""$B(c)$ on linear axes (ink), by Newton's method on $\sinh(2b) + 2b = 1/c$. After Show me: the tangent at the cost you pick, of slope $B'(c)$ (dashed), its value at $2c$ (hollow), and $B(2c)$ (filled). The difference quotient is $[B(c + h) - B(c - h)]/2h$ with $h = 10^{-4}c$. On log axes, the tangent would show $c\,B'(c)/B(c)$ instead, so the plate keeps linear axes.""",
        "wide": False,
    },
    "inverse": {
        "title": "Differentiating the equation",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms",
        "caption": r"""Steps 1 and 2: $F(b) = \sinh 2b + 2b$ (ink) and the lines $1/c$ (orange) for the cost you pick and for one 25% higher; in step 2, the tangent at $B(c)$ (dashed) and the move it predicts (hollow). Step 3: $F'(b) = 2\cosh 2b + 2$ (line) and $4\cosh^2 b$ (dots). Step 4: $B(c)$ with its tangent, and the bound at $c \pm 10\%$ (orange); the reading's difference quotient uses $\pm 0.01\%$.""",
        "wide": False,
    },
}

STRIPS = {
    "routes": {
        "plate": "routes",
        "steps": [
            (r"For a constant cost, the problem looks the same at every start time, so the decision maker stops once $Y$ reaches a flat level $b$. Below it, the value solves one equation.",
             r"$\class{lit}{\Lop V = c}$ on $[0, b)$, with $V'(0) = 0$ at the reflecting center and $V(b) = g(b)$. For each trial level, the value of following that flat rule, $V_b(y) = g(b) - c\,(b\tanh b - y\tanh y)$, solves it, since $\Lop(y\tanh y) = 1$."),
            (r"Multiply by $2\cosh^2 y$ and integrate once from the center: below its own level, every rule has the same slope.",
             r"Since $(\cosh^2 y\,f')' = 2\cosh^2 y\,\Lop f$ for any smooth $f$, $(\cosh^2 y\,V')' = 2c\cosh^2 y$, so $\class{lit}{\cosh^2 y\,V_b'(y) = c\,(y + \tfrac12\sinh 2y)}$ on $[0, b)$, for every $b$."),
            (r"Smooth fit picks the level: at the bound, the value meets $g$ with the same slope.",
             r"$V'(b) = g'(b) = \dfrac{1}{2\cosh^2 b}$ makes the left side of step 2 equal $\tfrac12$ at $y = b$: $c\,(b + \tfrac12\sinh 2b) = \tfrac12$, which is $\class{lit}{\sinh(2b) + 2b = 1/c}$. Its root is $B(c)$."),
            (r"The second route: a flat bound $b$ earns $g(b)$ on every decision and pays $c$ for each unit of its mean decision time, $b\tanh b$.",
             r"From $\E_y\tau_b = b\tanh b - y\tanh y$ (chapter 2), the expected reward of a flat bound is $\class{lit}{R(b) = g(b) - c\,b\tanh b}$, which is $V_b(0)$."),
            (r"Set its slope to zero. The same equation comes out, because the reward's slope is the gap between the two slopes at the bound.",
             r"$R'(b) = g'(b) - c\,(\tanh b + b\sech^2 b) = \class{lit}{\sech^2 b\,\bigl[\tfrac12 - c\,(b + \tfrac12\sinh 2b)\bigr]}$. Since $c\,(\tanh b + b\sech^2 b) = V_b'(b)$, $R'(b) = g'(b) - V_b'(b)$: the reward peaks where smooth fit holds."),
        ],
    },
    "inverse": {
        "plate": "inverse",
        "steps": [
            (r"Write the equation as an identity in the cost: $B(c)$ is where the rising curve $F(b) = \sinh 2b + 2b$ meets $1/c$.",
             r"$\class{lit}{F(B(c)) = 1/c}$ for every $c > 0$. $F$ increases from $F(0) = 0$ without limit, so the root is unique."),
            (r"Differentiate both sides in $c$, by the chain rule.",
             r"$\class{lit}{F'(B(c))\,B'(c) = -\dfrac{1}{c^2}}$. ($B$ is differentiable by the implicit function theorem, since $F' > 0$.)"),
            (r"The slope of $F$ is four times a square.",
             r"$F'(b) = 2\cosh 2b + 2$, and $\cosh 2b + 1 = 2\cosh^2 b$, so $\class{lit}{F'(b) = 4\cosh^2 b}$."),
            (r"Divide: the slope of the bound, negative at every cost.",
             r"$\class{lit}{B'(c) = -\dfrac{1}{4c^2\cosh^2 B(c)}} < 0$: a higher constant cost always means a lower bound."),
        ],
    },
}

SECTIONS = [
    {
        "id": "earns",
        "title": "What a decision earns",
        "blocks": [
            ("plain", r"""
The decision maker watches the evidence $X_t$ of chapter 2, picks a moment $\tau$ to stop, and then chooses the sign of $X_\tau$. Given what it has seen, that choice is right with probability $g(|X_\tau|)$, where $g(x) = 1/(1 + e^{-2x})$. A correct choice earns 1 and an error earns 0, so $g(|X_\tau|)$ is the choice's expected reward. Each moment spent deciding costs $c(t)$, in the same units, on a schedule known in advance. The moment $\tau$ may depend on the evidence seen so far but not on evidence still to come: it is a stopping time. The goal is the largest expected reward minus the expected cost of the time spent:

$$\E\Bigl[\, g(|X_\tau|) - \int_0^\tau c(s)\,ds \Bigr].$$

This is one decision, not a run of trials. The cost of time is given in advance; in a reward-rate setting it would depend on the policy itself, and the paper lists that case among its limitations.

The plate runs one path on your schedule and stops it with the simplest rule there is, a flat bound: decide when $|X|$ first reaches $b$. Drag the bound up and down. A higher bound stops later, so the choice is right more often, and the shaded bill for time grows. The averages under the plate are for checking the evidence continuously, and the page computes them from formulas. Without a deadline, every decision under a flat bound ends at $|X| = b$, so the average reward is $g(b)$; the average bill is the cost at each moment times the chance that the decision is still open then, $\int_0^\infty c(s)\,P_0(\tau_b > s)\,ds$, with that chance from the series of chapter 6. With a deadline, the decisions still open there are forced to choose at whatever evidence they have, and the bill stops at the deadline.
"""),
            ("plate", "earn"),
            ("plain", r"""
A flat bound is the best rule when the cost is constant ([the flat bound](#flat), below). When the cost changes, the best bound generally moves, and the paper gives no formula for it. After Show me, the plate compares the best level held flat that a numerical search finds with the best time-dependent policy, whose bound may change with time, both on the grid of the dynamic program in the value plate below.
"""),
            ("exact", "232-238", "The paper's words"),
        ],
    },
    {
        "id": "allowed",
        "title": "Which costs the theory allows",
        "blocks": [
            ("plain", r"""
The paper proves its results for costs of time that meet one standing assumption: the cost is continuous, and it stays between two positive constants for all $t \ge 0$,

$$0 < c_{\min} \le c(t) \le c_{\max}.$$

Both levels matter. The upper level keeps the bound away from 0: by {{ref:lem:structure}}(c), the best bound never falls below $B(c_{\max})$. The lower level does more of the work. It caps the bound at $B(c_{\min})$, and that cap is what lets the optimal-stopping theorem apply (chapter 4). It makes the value of waiting grow at least like $c_{\min}$ times the squared distance to the bound, {{ref:prop:regularity}}(a). And without it, the constant in the bound's Hölder continuity, $\sqrt{(c_{\max} - c_{\min})/c_{\min}}$, would be infinite (chapter 5).

Check your schedule against it. The plate draws the cost to time 10, past the window the rest of the book draws, because the assumption is about all time. A drawing stops at time 2.5, so for a drawing the plate asks how it goes on.
"""),
            ("plate", "allows"),
            ("plain", r"""
Three cases are worth keeping apart. The book's steps (Figure 1's rise and fall, the pulse, and the paper's multi-step and piecewise families, whose joins are logistic in $\log c$) are logistic in time with scale 0.05, so they are continuous however steep they look: the assumption holds, and the exact equation of chapter 5 covers them. They lie outside {{ref:thm:main}} for a different reason: the theorem is about the limit of small changes, and the paper counts large steps outside it. A deadline makes the cost infinite after it, and the rising cost of Figure 1(c) has no upper level, so the assumption fails for both. The forced choice at time 10 that ends the paper's main experiments (other runs use the horizons in {{ref:tab:params}}) is outside the theorems too: it is a last moment, and the theorems are stated with none. In all these cases, the paper says, its rules are heuristics motivated by the theorem, and it judges them by measurement (chapters 9 and 10).
"""),
            ("exact", "234-235|The cost of time|c_{\\max}$.", "The assumption, in the paper's model"),
            ("exact", "582-588", "What lies outside it, at the start of Section 5"),
            ("limits", r"""
**What the assumption does, and what it doesn't.** It is a condition the proofs use, not a claim about how costs behave: the structure lemma's band, the regularity of the bound, the exact equation ({{ref:prop:exact}}), and {{ref:thm:main}} all assume it. It doesn't put every schedule under {{ref:thm:main}}, which also needs the change to be small. And the dynamic program still solves a schedule outside it on its grid, with a last moment; what the paper doesn't give there is a proof.
"""),
        ],
    },
    {
        "id": "value",
        "title": "The value of waiting",
        "blocks": [
            ("plain", r"""
Fix a start time $t$ and evidence $y = |x|$. The value $V(t, y)$ is the most a decision maker who starts there can expect to earn, net of the time it will still pay for; the cost $s$ time units after the start is $c(t + s)$:

$$V(t, y) = \sup_{\tau} \E_y\Bigl[\, g(Y_\tau) - \int_0^\tau c(t+s)\,ds \Bigr].$$

Stopping at once is allowed and earns $g(y)$, so $V \ge g$. The difference $W = V - g \ge 0$ is what the chance to wait is worth. Where $W > 0$, waiting beats deciding; where $W = 0$, the decision maker stops. The edge between the two regions is the best bound $b(t)$; chapter 4 shows that at each time the stopping set is a single interval, $[b(t), \infty)$.

The plate finds $V$ for your schedule by dynamic programming, the way the paper computes its reference policy (chapter 9): it steps back in time from a forced choice, and at each moment and level of evidence it keeps the larger of deciding now and waiting one more step. Before it shades $W$, guess where waiting is worth the most.
"""),
            ("plate", "value"),
            ("plain", r"""
**Why there is no last moment.** The supremum runs over every stopping time, with no last moment to decide: the decision maker may wait as long as it likes, paying for every moment it waits. That is the infinite horizon, and the paper's theorems are stated on it. Three things come with it. For a constant cost, the problem looks the same from every start time, so $V$ depends on $y$ alone and the best bound is flat, which is what makes the constant-cost answer below a single number. With a last moment, the value would depend on the time left, and the bound would fall toward 0 as that moment neared, as it does before a deadline: set the plate's last moment to time 2.5 to see it. And waiting forever never pays. The cost is at least $c_{\min} > 0$, so a rule whose mean decision time is infinite pays an infinite bill, and the paper only needs rules with $\E\tau < \infty$.

A computer can't run to infinity. In the paper's main experiments, the dynamic program forces a choice at time 10 for schedules without a deadline (other runs use the horizons in {{ref:tab:params}}), and the paper measures what that does: at a constant cost of 0.02, the constant-cost bound loses {{HorizonFloor}} points per 100 trials against the optimum for that horizon. The book's solver forces the choice 6 time units past its window. That is an approximation too: the forced choice changes the bound inside the window, more as time gets cheaper and decisions run longer.
"""),
            ("exact", "246-250", "The paper's definition"),
            ("exact", "1267-1271|Throughout|is infinite.", "The standing facts, at the start of Appendix A"),
            ("exact", "686-692|The choice is|as infinite.", "The paper's finite horizon, in its methods"),
        ],
    },
    {
        "id": "flat",
        "title": "The flat bound, two ways",
        "blocks": [
            ("plain", r"""
For a constant cost $c$, the best rule stops when $Y = |X|$ first reaches a fixed level $B(c)$, the root of

$$\sinh(2b) + 2b = \frac{1}{c}.$$

The result is classical; the paper cites Wald and Wolfowitz (1948), Shiryaev (1978), and Bogacz and colleagues (2006) for it, and derives it in a few lines, two ways. The first route solves for the value below the bound and asks that it meet the reward for deciding with a matching slope (smooth fit). The second picks the flat bound $b$ that maximizes its own expected reward, $g(b) - c\,b\tanh b$: every decision under a flat bound ends at $|X| = b$ and is right with probability $g(b)$, and $b\tanh b$ is its mean decision time from 0 (chapter 2). At $c = 0.1$ the bound is {{BoundTenth}}, from the paper's generated numbers (its text doesn't print it), and the mean decision time is {{DecisionTimeTenth}}.

First a guess, on the second route.
"""),
            ("plate", "peak"),
            ("plain", r"""
Now both routes, a step at a time. Chapter 0 draws the first route's integration on its own; here the plate follows three trial levels through both routes. The routes meet at the last step: the slope of the reward of a flat bound, $R'(b)$, is $g'(b)$ minus the slope at $y = b$ of $V_b$, the value of following the flat rule at level $b$. So the reward peaks exactly where smooth fit holds.
"""),
            ("strip", "routes"),
            ("exact", "252-262||mean decision time.", "The paper's derivation"),
            ("exact", "101-103|If every unit|bogacz2006}.", "And its introduction"),
            ("limits", r"""
**Scope.** This is the answer for a constant cost. When the cost changes, the best bound generally moves, and the paper gives no formula for it. Chapter 5's exact equation reduces to this one at a constant cost, and chapter 6 expands around it for small changes.
"""),
        ],
    },
    {
        "id": "slope",
        "title": "How the bound changes with the cost",
        "blocks": [
            ("plain", r"""
A higher cost of time means deciding sooner, on less evidence. How much sooner? Guess first.
"""),
            ("plate", "double"),
            ("plain", r"""
Differentiating $\sinh(2B) + 2B = 1/c$ in $c$ gives the slope of the constant-cost bound:

$$B'(c) = -\frac{1}{4c^2\cosh^2 B(c)}.$$

It is negative at every cost, so a higher constant cost always means a lower bound. How much lower depends on the cost. When time is cheap, $\sinh 2b$ dominates the equation and $B(c)$ grows like $\tfrac12\log(1/c)$, so as $c \to 0$, the drop when the cost doubles tends to $\tfrac12\log 2$. When time is expensive, $B(c) \approx 1/(4c)$, so doubling the cost halves the bound.

$B'(c_0)$ is not a fitted constant. In {{ref:thm:main}}, it is the exact factor that turns a small change in the cost, averaged by the kernel, into a change in the bound (chapter 6). The derivation is implicit differentiation, in four steps.
"""),
            ("strip", "inverse"),
            ("exact", "262-267|Differentiating", "The paper's equation {{ref:eq:Bprime}}"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's five shown in bold on gray cards. They use chapter 2's posterior and filtered diffusion (for the reward) and its reflected process $Y$ (for the value and the flat bound). Of this chapter's claims, the constant-cost bound is used the most, by eight: its slope (this chapter), the per-moment rule (chapter 1), the structure lemma and the cap that lets optimal stopping apply (chapter 4), the kernel and its two descriptions (chapter 6), and the limits and the second-order loss (chapter 7). The value function is used by the constant-cost bound (this chapter), the structure lemma (chapter 4), and the paper's reference program (chapter 9). The standing assumption is used by the objective in this chapter, the exact equation (chapter 5), and {{ref:thm:main}} (chapter 6), and the slope $B'(c)$ by {{ref:thm:main}}.
"""),
            ("map", "eq:constant-bound"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why is the chance of a correct choice $g(|X_\tau|)$ and not $g(X_\tau)$?",
                 r"""
The decision maker chooses the sign of $X_\tau$. If $X_\tau > 0$, it says $+1$, which is right with probability $g(X_\tau) = g(|X_\tau|)$. If $X_\tau < 0$, it says $-1$, which is right with probability $1 - g(X_\tau) = g(-X_\tau) = g(|X_\tau|)$, using $1 - g(x) = g(-x)$. At $X_\tau = 0$, either answer is right with probability $\tfrac12 = g(0)$.
"""),
                (r"How does this objective differ from maximizing a reward rate over many trials?",
                 r"""
Here, the cost of time $c(t)$ is given in advance, and the decision maker optimizes one decision. In a reward-rate setting, the cost of time is itself set by the policy (time spent on this trial is time not spent on the next ones). The paper names this as a limitation ({{claim:claim:limitations}}) and gives no model for it; the book's gloss is that the cost would then depend on the rule it is meant to choose, a fixed-point problem.
"""),
                (r"Which of Figure 1's four schedules satisfy the assumption?",
                 r"""
The 16-fold rise and the fall do: both are logistic in time, so they are continuous and stay between their two levels. The deadline does not: past $t = 1$ the cost is infinite. The ramp in panel (c), $0.1 + 0.8\,(t - 0.5)$, does not either, strictly: it is continuous, but it grows without bound, so no $c_{\max}$ exists. In the random-schedule experiments, every schedule without a deadline ends with a forced choice at $t = 10$, and the sinusoid runs end at other finite horizons ({{claim:method:reference}}, {{ref:tab:params}}), so the computed problems are finite; the theorem, though, is stated for an infinite horizon.
"""),
                (r"What goes wrong if $c_{\min} = 0$?",
                 r"""
Three things the proofs use. The bound for the lowest cost, $B(c_{\min})$, is the cap that makes the optimal-stopping theorem apply ({{claim:sf:stopping}}); $B(0)$ is infinite. The nondegeneracy estimate $W \ge c_{\min}(b - y)^2$ ({{ref:prop:regularity}}) becomes empty. And the Hölder constant $\sqrt{(c_{\max} - c_{\min})/c_{\min}}$ becomes infinite.
"""),
                (r"Why does $V$ depend on the start time $t$ at all?",
                 r"""
Because the cost changes over time: starting at $t$ means paying $c(t + s)$ for the $s$-th moment of waiting. For a constant cost, $V$ depends only on $y$, and the bound is flat.
"""),
                (r"Show that $V \ge g$, and say what $W = V - g$ measures.",
                 r"""
The stopping time $\tau = 0$ is allowed and earns $g(y)$ with no cost, so the supremum is at least $g(y)$. $W$ is what the option to keep sampling is worth over deciding now; the stopping set is where it is zero.
"""),
                (r"Derive $\sinh(2b) + 2b = 1/c$ by maximizing $R(b) = g(b) - c\,b\tanh b$.",
                 r"""
$R'(b) = g'(b) - c\,(\tanh b + b\,\sech^2 b) = \sech^2 b\,\bigl[\tfrac12 - c\,(\sinh b\cosh b + b)\bigr]$. Setting the bracket to zero gives $c\,(\tfrac12\sinh 2b + b) = \tfrac12$, the same equation. The mean decision time $b\tanh b$ is $\E_0\tau$ from the formula $\E_y\tau = b\tanh b - y\tanh y$ ({{claim:def:reflected}}, chapter 2).
"""),
                (r"How does $B(c)$ behave as time becomes free ($c \to 0$) and as it becomes very expensive ($c \to \infty$)?",
                 r"""
As $c \to 0$, $\sinh 2b$ dominates and grows like $e^{2b}/2$, so $B(c)$ grows like $\tfrac12\log(1/c)$: slowly. As $c \to \infty$, $b$ is small, $\sinh 2b + 2b \approx 4b$, and $B(c) \approx 1/(4c)$, the asymptotic the paper uses in the proof of {{ref:cor:limits}}.
"""),
                (r"What is the confidence at the bound, and why is it not the bound itself?",
                 r"""
The bound is a level of evidence $X$, which is half the log odds. The confidence there is $g(B(c)) = 1/(1 + e^{-2B(c)})$. The paper states all its bounds on the evidence scale; a text that quotes a probability must convert, and must not call the bound a probability.
"""),
                (r"Derive $B'(c)$.",
                 r"""
Differentiate $\sinh(2B) + 2B = 1/c$ in $c$: $(2\cosh 2B + 2)\,B' = -1/c^2$. Since $\cosh 2B + 1 = 2\cosh^2 B$, the factor is $4\cosh^2 B$, so $B' = -1/(4c^2\cosh^2 B)$.
"""),
                (r"{{ref:sec:lopsided}} writes the same slope as $-\int_0^\infty n(s)\,ds/(2c_0)$. Check that the two agree.",
                 r"""
{{ref:lem:kernel}}(a) gives $\int_0^\infty n = 1/(2c_0\cosh^2 b_0)$. Then $-\int n/(2c_0) = -1/(4c_0^2\cosh^2 b_0) = B'(c_0)$. This is the symmetric case of the per-bound slope identity $dh/dc = -\int n_h/(2c)$ that the unequal-rewards extension checks numerically ({{claim:ext:lopsided}}).
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The decision maker maximizes accuracy.”",
                 r"It maximizes accuracy minus the expected cost of the time spent. Accuracy alone has no best rule: a higher bound always does better, so the cost of time is what makes stopping worthwhile."),
                (r"“The theorem needs a smooth cost.”",
                 r"The exact equation needs only a continuous cost bounded between two positive constants. {{ref:thm:main}} is about $c_\varepsilon = c_0 + \varepsilon\gamma$ with $\gamma$ continuous and bounded, as $\varepsilon \to 0$: its limit holds uniformly for $t$ in compact sets, and on all of $[0, \infty)$ if $\gamma$ is uniformly continuous. Smoothness enters only through the rate: a Hölder $\gamma$ with exponent $\alpha$ gives a remainder $O(|\varepsilon|^{1+\alpha})$, and a Lipschitz one $O(\varepsilon^2)$."),
                (r"“The paper's steps are discontinuous, so its step experiments lie outside the assumption.”",
                 r"The paper's steps are logistic in time (scale 0.05), so they are continuous and bounded, and the exact equation holds for them. They lie outside the theorem because they are large, not because they jump."),
                (r"“$V(t, y)$ is the value of the trial.”",
                 r"It is the value from a start at time $t$ with evidence $y$. The value of a trial that starts at time 0 with no evidence is $V(0, 0)$."),
                (r"“The constant-cost bound is a result of the paper.”",
                 r"It is classical, and the paper cites it. The paper's own work starts from it: the exact equation of chapter 5 reduces to it at a constant cost, and chapter 6 expands around it."),
                (r"“A higher cost of time raises the bound.”",
                 r"It lowers it: $B$ is decreasing, by {{ref:eq:Bprime}}. Expensive time means deciding sooner, on less evidence."),
                (r"“In {{ref:thm:main}}, $B'(c_0)$ is a fitted constant.”",
                 r"It is the exact slope of the classical bound, in closed form."),
            ]),
        ],
    },
]
