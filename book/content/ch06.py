"""Chapter 6: the kernel and the theorem.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), and ("strip", id) place a live plate, a printed figure, or a proof strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "kernel",
    "num": 6,
    "title": "The kernel and the theorem",
    "full": "The first-order theory: the kernel and the theorem",
    "leaf": 7,
    "finding": "For a small change in the cost of time, the best bound moves in proportion to a weighted average of the changes still to come.",
    "readings": [
        ("LookAheadTenth", "how far ahead the bound looks, on average, at a cost of 0.1 (time units)"),
        ("DecisionTimeTenth", "the mean decision time at the same cost, for comparison"),
        ("MaxLookAhead", "about the most the average look-ahead reaches over all costs (found numerically)"),
    ],
    "hero": {
        "aria": "A cost that rises and falls, and from one moment the kernel's weights on the moments after it, with the first-order bound below",
        "caption": "A cost of 0.1 that swings 30% (orange). From each moment, the kernel (green) weighs the moments after it; below, the bound those weights give (green) beside the per-moment rule's (dashed).",
    },
    "intro": r"""
For a small change in the cost of time, the best bound moves in proportion to a weighted average of the changes still to come. This chapter finds the weights, describes them two ways, derives their Laplace transform, and proves the theorem that puts them to work. It is the center of the paper: every later chapter uses it.

One caution runs through every page. That a small change moves the bound by a weighted average of the future change (a convolution) is not new: specializing Stojanovic's (1997) perturbation formula to this model at a constant cost formally gives the same form, with the survival flux as the weights. What the paper claims, to its knowledge, is the kernel made explicit, its transform, and the proof for this model on an infinite horizon.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"def:kernel": "weights", "lem:kernel": "second-way", "thm:main": "theorem", "claim:pm-order-eps": "yours"}

# which groups of checks in tools/checks/ stand behind each plate
CHECKS = {
    "scale": ["kernel", "scale"], "sketch": ["kernel", "sketch"], "survival": ["survival"],
    "starts": ["starts", "words"], "transform": ["transform"], "bracket": ["bracket", "words"],
    "yours": ["kernel", "scale", "schedule", "yours", "words"],
}

PLATES = {
    "scale": {
        "title": "Shrink the change",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, and the kernel from its series",
        "caption": r"""A cost of $0.1\,(1 + \varepsilon \sin 2t)$, so $c_0 = 0.1$ and $\gamma(t) = 0.1\sin 2t$. Gray curves: the dynamic program's bound minus its own bound at the constant cost, divided by $\varepsilon$, for four sizes of change. Green: the first-order response $\beta(t) = B'(c_0)\,(w \star \gamma)(t)$. Dashed: the per-moment response $B'(c_0)\gamma(t)$. The program checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window.""",
        "wide": True,
    },
    "sketch": {
        "title": "Draw the weights",
        "state": "computed",
        "state_text": "Computed in the page from the series {{ref:eq:series}}",
        "caption": r"""Drag across the sheet to draw how much each future moment should count; your drawing is scaled to total 1 when the kernel is shown. The green curve is $w(s)$ from the series for the cost you pick, with its mean, the average look-ahead, marked.""",
        "wide": False,
    },
    "survival": {
        "title": "Still undecided",
        "state": "computed",
        "state_text": "Computed in the page from the eigenfunction series",
        "caption": r"""Top: the chance $P_x(\tau_0 > s)$ of still being undecided at time $s$, against the starting evidence $x$, for the time you pick; it is 0 at the bound. The orange line is its slope at the bound. Bottom: minus that slope, the survival flux $n(s)$, for $s$ from 0.03 to 3 (it grows like $s^{-1/2}$ toward 0, and the total stays finite); the dot is the time on show. The cost is $c_0 = 0.1$.""",
        "wide": False,
    },
    "starts": {
        "title": "Starts near the bound",
        "state": "computed",
        "state_text": "Sampled in the page, beside the exact curve from the series",
        "caption": r"""Each decision starts at evidence drawn from $\pi_0(y) = 4c_0\cosh^2 y$ (left, the density) and runs until it reaches the bound, checked every 0.0025 time units against the bound moved in by $0.5826\sqrt{0.0025}$. Right: a histogram of 8,000 decision times on $0 \le s < 3$ (runs of three or more time units are outside the histogram, and starts above the moved-in bound stop at 0), under the exact kernel $w(s)$. The runs are a demonstration with a fixed seed (add `?seed=` to the address for another); the curve is the series. Checking only every 0.0025 is an approximation, so the runs can differ from the exact law by more than their sampling error.""",
        "wide": True,
    },
    "transform": {
        "title": "The transform, beside each step",
        "state": "computed",
        "state_text": "Computed in the page: the closed forms, the series, and sampled decision times",
        "caption": r"""What each step of the proof is about, for $c_0 = 0.1$. Step 1: the chance of still being undecided. Step 2: the flux series cut off after 1, 2, 4, and 64 terms. Step 3: $u(x) = \mathbb{E}_x e^{-\lambda\tau_0}$ for three values of $\lambda$. Steps 4 and 5: the closed form $\tilde w(\lambda)$, with the series (dots) and the sampled decision times from $\pi_0$ (crosses, with two standard errors): the 8,000 runs of the plate above when they're ready at this cost, or 3,000 new ones. The standard errors cover sampling only; checking every 0.0025 adds a small bias of its own.""",
        "wide": False,
    },
    "bracket": {
        "title": "Two fixed levels close in",
        "state": "computed",
        "state_text": "One path sampled in the page; the expected gap is exact",
        "caption": r"""One path of $Y = |X|$ from $y = 0.6$ at $c_0 = 0.1$ (seeded, in Euler steps of 0.0002, with each hitting time read between steps). The middle line is the bound $b_0$; the band is $b_0 \pm a|\varepsilon|$, drawn with $a = 1$ for the picture (the proof's $a$ comes from {{ref:lem:structure}}(c) and isn't computed here). The marks on the time axis are the hitting times of the band's lower edge, of $b_0$, and of its upper edge. As $\varepsilon$ shrinks they close on $\tau_0$; the expected gap $\mathbb{E}(\sigma_+ - \sigma_-)$ comes from $\mathbb{E}_y\sigma_z = z\tanh z - y\tanh y$.""",
        "wide": False,
    },
    "yours": {
        "title": "Your schedule, scaled down",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, and the kernel from its series",
        "caption": r"""Your schedule $c(t)$, written as $c_0 + \varepsilon\gamma(t)$ with $c_0$ its average over the window and $\gamma = c - c_0$, then scaled down by $\varepsilon$. Top: the dynamic program's $(b_\varepsilon - b_0)/\varepsilon$ (ink), the first-order $\beta(t)$ (green), and the per-moment $B'(c_0)\gamma(t)$ (dashed). The dashed curve on top is the per-moment rule's linear response; its error below uses the full $B(c_0 + \varepsilon\gamma(t))$. Bottom: the largest error of each shortcut's bound over the window, against $\varepsilon$, on log axes, with guide lines of slope 1 and 2; it opens only when at least one error reaches $10^{-7}$, and then plots every positive error, smaller ones included. Errors are measured from the program's own constant-cost bound, so the offsets the two runs share cancel; what remains of the numerical error can change with $\varepsilon$, so the chart compares the two errors at each size and isn't a test of the theory's rates.""",
        "wide": True,
    },
}

STRIPS = {
    "lemma6": {
        "plate": "transform",
        "steps": [
            ("Undo the drift: the evidence is a Brownian motion, reweighted.",
             r"$X$ is a Brownian motion $h$-transformed by $h(s, x) = e^{-s/2}\cosh x$, so $P_x(\tau_0 > s) = \class{lit}{\frac{e^{-s/2}}{\cosh x}\,\mathbb{E}_x[\cosh W_s;\ \tau^W > s]}$ for a Brownian motion $W$ that must stay in $(-b, b)$."),
            ("Expand in waves that vanish at the bound, and take the slope there.",
             r"Expand $\cosh x$ in the even Dirichlet eigenfunctions $\class{lit}{\cos(\kappa_j x)}$ on $(-b, b)$, $\kappa_j = (j + \tfrac12)\pi/b$, and differentiate at $x = b$: every term of the series {{ref:eq:series}} is positive."),
            ("The transform of the decision time solves a second-order equation.",
             r"For the transform, $u(x) = \mathbb{E}_x e^{-\lambda\tau_0}$ solves $\tfrac12 u'' + \tanh(x)\,u' = \lambda u$ with $u(\pm b) = 1$, so $\class{lit}{u = \chi(x)/\chi(b)}$ with $\chi(x) = \cosh(rx)/\cosh x$ and $r = \sqrt{2\lambda + 1}$."),
            ("Integrate over time to get the flux's transform, and normalize.",
             r"Since $\int_0^\infty e^{-\lambda s}P_x(\tau_0 > s)\,ds = (1 - u(x))/\lambda$, the flux's transform is $\class{lit}{\tilde n(\lambda) = \chi'(b)/(\lambda\chi(b)) = [r\tanh(rb) - \tanh b]/\lambda}$, and $\tilde n(0) = \tanh b + b\,\operatorname{sech}^2 b = 1/(2c_0\cosh^2 b)$ by the constant-cost equation. Normalizing gives (a) and (c)."),
            ("Average over the start law: the same transform, so the same law.",
             r"For (b), integrate $\mathbb{E}_y e^{-\lambda\tau_0}$ against $\pi_0(y) = 4c_0\cosh^2 y$: the result is $\class{lit}{4c_0\cosh^2 b\,[r\tanh(rb) - \tanh b]/(r^2 - 1)}$, which is $\tilde w(\lambda)$ because $r^2 - 1 = 2\lambda$. Two probability measures with the same Laplace transform are equal."),
        ],
    },
    "theorem7": {
        "plate": "bracket",
        "steps": [
            ("Subtract two exact equations: one for the changed cost, one for the constant.",
             r"With $c_0 > 0$ and $\gamma$ bounded, both $c_\varepsilon = c_0 + \varepsilon\gamma$ and $c_0$ stay between two positive constants for small $\varepsilon$. Apply the exact equation to each, and subtract. With $F(b) = \int_0^b\cosh^2$: $\class{lit}{c_0[F(b_\varepsilon(t)) - F(b_0)] = -\varepsilon I_\varepsilon(t)}$, where $I_\varepsilon(t) = \int_0^{b_\varepsilon(t)}\cosh^2 y\,\mathbb{E}_y[\gamma(t + \tau^\varepsilon_{t,y})]\,dy$."),
            ("The changed bound stays within a band of width proportional to the change.",
             r"By {{ref:lem:structure}}(c) and the smoothness of $B$, $\class{lit}{|b_\varepsilon - b_0| \le a|\varepsilon|}$ for a constant $a$."),
            (r"So two fixed levels bracket the decision time, and both close on $\tau_0$.",
             r"For starts below $b_0 - a|\varepsilon|$, the decision time $\tau^\varepsilon$ lies between the hitting times of the fixed levels $\class{lit}{b_0 \pm a|\varepsilon|}$. Both converge almost surely to $\tau_0$, the hitting time of $b_0$."),
            ("In the limit, the integral is the kernel-weighted average.",
             r"$\gamma$ is uniformly continuous on compact sets and the bracketing times don't depend on $t$, so, on the common coupling, almost surely $\sup_{t \le T}|\gamma(t + \tau^\varepsilon) - \gamma(t + \tau_0)| \to 0$; the thin strip near the bound adds $O(|\varepsilon|)$. Dominated convergence gives $I_\varepsilon \to I_0 = \int_0^{b_0}\cosh^2 y\,\mathbb{E}_y[\gamma(t + \tau_0)]\,dy = \class{lit}{(w \star \gamma)(t)/(4c_0)}$, by {{ref:lem:kernel}}(b)."),
            (r"Divide by $\varepsilon$ and read off $\beta$.",
             r"The left side is $c_0\cosh^2(\xi)\,(b_\varepsilon - b_0)$ for some $\xi$ between $b_0$ and $b_\varepsilon$ (mean value theorem). Divide by $\varepsilon$: $(b_\varepsilon - b_0)/\varepsilon \to -(w \star \gamma)/(4c_0^2\cosh^2 b_0) = \class{lit}{B'(c_0)\,(w \star \gamma)}$, uniformly on $[0, T]$."),
            ("If the change is Hölder, the remainder has a rate.",
             r"If $|\gamma(u) - \gamma(v)| \le L|u - v|^\alpha$, Jensen's inequality bounds $|\mathbb{E}\gamma(t + \tau^\varepsilon) - \mathbb{E}\gamma(t + \tau_0)|$ by $L[\mathbb{E}(\sigma_+ - \sigma_-)]^\alpha$, and $\mathbb{E}(\sigma_+ - \sigma_-) = O(|\varepsilon|)$ from $\mathbb{E}_y\sigma_z = z\tanh z - y\tanh y$. So the error in step 4's limit is $O(|\varepsilon|^\alpha)$ for starts below the band; the thin strip near the bound adds $O(|\varepsilon|)$, and the mean-value denominator of step 5 changes by $O(|\varepsilon|)$. The bound's remainder is $\class{lit}{O(|\varepsilon|^{1+\alpha})}$."),
        ],
    },
}

SECTIONS = [
    {
        "id": "small-changes",
        "title": "Small changes, scaled up",
        "blocks": [
            ("plain", r"""
Chapter 5 gave an exact equation for the best bound, but no formula for it. This chapter gets a formula by asking a smaller question: what does the bound do when the cost moves only a little away from a constant?

Write the cost as $c(t) = c_0 + \varepsilon\gamma(t)$: a constant $c_0$, a shape $\gamma$ that says how the cost moves, and a size $\varepsilon$. At $\varepsilon = 0$, the bound is the flat $b_0 = B(c_0)$ of chapter 3. For a small $\varepsilon$, it moves away from $b_0$ by roughly $\varepsilon$ times something, so dividing the move by $\varepsilon$ gives a curve that should settle down as $\varepsilon$ shrinks. The theorem says what it settles to: $\beta(t) = B'(c_0)\,(w \star \gamma)(t)$, the slope of the constant-cost bound times a weighted average of the coming values of $\gamma$.

The plate shows it happening on a grid. The gray curves come from the same kind of dynamic program the paper uses as its reference, on a coarser grid, measured from that program's own bound at the constant cost, which cancels the offsets the two runs share. As the change shrinks from 80% of the cost to 10%, they come closer and closer to the green curve. The dashed curve is what the per-moment rule would say, all the weight on the present: it has no lead, and the gap to it stays: for this sinusoid, the per-moment curve divided by $\varepsilon$ tends to a different sinusoid from $\beta$.
"""),
            ("plate", "scale"),
            ("plain", r"""
What the plate can't show is the limit itself. A grid has a finest resolution, and the theorem is about the continuous model; the page shows what the grid gives. Chapter 9 tests the same thing at more costs and frequencies.
"""),
            ("exact", "133-147", "The paper's statement, in its introduction"),
        ],
    },
    {
        "id": "weights",
        "title": "Where the weights come from",
        "blocks": [
            ("plain", r"""
Before the definition, a guess. If the cost is about to change, how much should the change at each future moment count toward where the bound sits now? Draw it.
"""),
            ("plate", "sketch"),
            ("plain", r"""
Fix the constant cost $c_0$ and its bound $b_0 = B(c_0)$, and let $\tau_0$ be the first time $Y$ reaches $b_0$ (equivalently, the first time $X$ leaves $(-b_0, b_0)$). The chance $P_x(\tau_0 > s)$ of still being undecided at time $s$ is 0 at the bound and positive inside it. Its slope at the bound, $n(s) = -\partial_x P_x(\tau_0 > s)$ at $x = b_0$, is the survival flux; normalized to integrate to 1, it is the kernel $w$:

$$n(s) = -\partial_x P_x(\tau_0 > s)\big|_{x = b_0},$$

$$w(s) = \frac{n(s)}{\int_0^\infty n(u)\,du}.$$

The weighted average of a future change is $(w \star \gamma)(t) = \int_0^\infty w(s)\,\gamma(t + s)\,ds$: it looks only forward, from $t$. The next plate shows where the flux comes from: the surface of "still undecided" chances, and its slope at the bound.
"""),
            ("exact", "393-405", "The paper's definition"),
            ("plate", "survival"),
            ("plain", r"""
Two things to notice. The slope is steep early, because a decision that starts at the bound's edge ends almost at once, and the flux behaves like $s^{-1/2}$ near 0 (chapter 7). And it never changes sign: the chance of still being undecided only falls as the start moves toward the bound, so $n(s) \ge 0$, and {{ref:lem:kernel}}(a) shows it is strictly positive.
"""),
        ],
    },
    {
        "id": "second-way",
        "title": "The same weights, a second way",
        "blocks": [
            ("plain", r"""
The flux is one description of the weights. {{ref:lem:kernel}} gives a second, and it explains their shape. The kernel is the distribution of the decision time $\tau_0$ when the starting evidence is drawn with density $\pi_0(y) = 4c_0\cosh^2 y$ on $[0, b_0]$, a law that rises steeply toward the bound:

$$w(s)\,ds = \int_0^{b_0} \pi_0(y)\,P_y(\tau_0 \in ds)\,dy.$$

Where do you think the starts that matter sit?
"""),
            ("plate", "starts"),
            ("plain", r"""
$\cosh^2 y$ grows like $e^{2y}$, so most of the starting weight lies within about one unit below the bound, and decisions that start there end soon. That is why the kernel is short. At $c_0 = 0.1$, the bound looks ahead {{LookAheadTenth}} time units on average, while a decision from 0 takes {{DecisionTimeTenth}}. As $c_0 \to 0$, the distance $b_0 - Y_0$ becomes exponential with rate 2, the drift near the bound is nearly 1, and the expected time to cover that distance tends to $\tfrac12$.
"""),
            ("figure", "kernels"),
            ("exact", "407-434", "The paper's lemma, and the paragraph after it"),
        ],
    },
    {
        "id": "transform",
        "title": "The transform, derived",
        "blocks": [
            ("plain", r"""
The third part of {{ref:lem:kernel}} is a closed form for the kernel's Laplace transform:

$$\tilde w(\lambda) = \frac{2c_0\cosh^2 b_0\,[\,r\tanh(rb_0) - \tanh b_0\,]}{\lambda}, \qquad r = \sqrt{2\lambda + 1}.$$

Most of chapter 7 (the transfer function, the limits of the look-ahead, the half-integration) comes from this one line. The proof is five steps. Scrub through them; the plate beside each step draws what that step is about.
"""),
            ("strip", "lemma6"),
            ("exact", "1391-1413", "The paper's proof, from Appendix A"),
        ],
    },
    {
        "id": "theorem",
        "title": "The theorem, step by step",
        "blocks": [
            ("plain", r"""
Let the cost be $c_0 + \varepsilon\gamma(t)$, with $\gamma$ continuous and bounded. Then, as $\varepsilon \to 0$, the optimal bound is the constant-cost bound plus $\varepsilon B'(c_0)$ times the kernel-weighted average of the coming values of $\gamma$:

$$b_\varepsilon(t) = b_0 + \varepsilon B'(c_0)\,(w \star \gamma)(t) + o(\varepsilon).$$

To first order, then, the optimal bound at time $t$ is the constant-cost bound evaluated at a weighted average of the future cost. The limit is uniform over bounded time intervals, and over all times if $\gamma$ is uniformly continuous. If $\gamma$ is Hölder continuous with exponent $\alpha$, the remainder is $O(|\varepsilon|^{1+\alpha})$ uniformly in time, so $O(\varepsilon^2)$ when $\gamma$ is Lipschitz.

The proof uses the exact equation of chapter 5, which has no derivative of the bound in it. That is what makes it short: subtract two exact equations, bracket one decision time between two others, and divide by $\varepsilon$.
"""),
            ("strip", "theorem7"),
            ("exact", "436-468", "The paper's theorem and its sketch"),
            ("exact", "1415-1456", "The full proof, from Appendix A"),
            ("limits", r"""
**What the theorem covers, and what it doesn't.** Small, continuous, bounded changes of the cost around a constant. It says nothing about large changes, discontinuous steps, or deadlines, and nothing about the weighted look-ahead rule (that is {{ref:prop:rule}}, in chapter 8). The per-moment rule would put all the weight at $s = 0$.
"""),
        ],
    },
    {
        "id": "yours",
        "title": "On your schedule",
        "blocks": [
            ("plain", r"""
{{ref:thm:main}}, with {{ref:prop:rule}}, compares two shortcuts. The per-moment rule's error in the bound shrinks no faster than the size of the change: divided by $\varepsilon$, it tends to $B'(c_0)(\gamma - w \star \gamma)$, which is not identically zero unless $\gamma$ is constant. With the first-order correction, the error shrinks faster than the change, $o(\varepsilon)$; when the change is smooth (Lipschitz), it is $O(\varepsilon^2)$.

Here is that comparison on the schedule you chose on the contents page. The page writes your schedule as $c_0 + \varepsilon\gamma$, with $c_0$ its average over the window, and shrinks the change. The program adds numerical errors of its own (from the grid, the finite horizon, and the kernel's series), which can change with $\varepsilon$, so the page compares the two errors at each size instead of reading the theory's rates off the grid. For a schedule the theorem covers, a bounded change that moves (not a deadline, the rising cost, a constant, or a flat drawing), the plate asks how fast the theory says each error shrinks before it draws the bottom chart. The theory's limit for the per-moment rule is a function on all times $t \ge 0$; the plate measures the errors only at the times from 0 to 2.5, every 0.02.
"""),
            ("plate", "yours"),
            ("plain", r"""
Two cautions about the bottom chart. The guide lines are guides only: for a Lipschitz change the theorem bounds the corrected error by a constant times $\varepsilon^2$, which doesn't fix the slope you see at these sizes. And the rising cost, which grows without bound, is outside the theorem: the page computes it and shows how the two errors compare, with no theory question. A deadline isn't a small change of a constant cost, and the plate doesn't run on it.
"""),
            ("exact", "61-65|We show|smoothly.,610-622", "The paper's words: the abstract, and {{ref:prop:rule}}"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's four highlighted: the kernel, its two descriptions and transform ({{ref:lem:kernel}}), {{ref:thm:main}}, and the comparison of the two shortcuts. {{ref:thm:main}} is the claim the most others use: eleven of them, namely the comparison at the end of this chapter, the transfer function (chapter 7), the averaged-cost rule and {{ref:prop:rule}} (chapter 8), the first-order sweep (chapter 9), both extensions (chapter 11), and four of the closing claims (chapter 12).
"""),
            ("map", "thm:main"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why is $n(s) \ge 0$?",
                 r"""
At $x = b_0$ the evidence is already at the bound, so $P_{b_0}(\tau_0 > s) = 0$; just inside the bound the probability is positive. So $P_x(\tau_0 > s)$ decreases toward the bound, and its derivative at $x = b_0$ is $\le 0$, making $n(s) = -\partial_x P_x(\tau_0 > s)|_{x = b_0} \ge 0$. {{ref:lem:kernel}}(a) shows it is strictly positive, as a sum of positive exponentials.
"""),
                (r"Let $\gamma$ be 0 before time $T$ and 1 after it. What is $(w \star \gamma)(t)$ for $t < T$, in words?",
                 r"""
$(w \star \gamma)(t) = \int_{T - t}^\infty w(s)\,ds$, the probability that a decision time with density $w$ exceeds $T - t$. By {{ref:lem:kernel}}(b): the chance that a decision started at time $t$ from the law $\pi_0$ is still open when the change arrives. For the ideal step, this is a calculation with the kernel ({{ref:thm:main}} needs a continuous $\gamma$). A continuous logistic step has its own kernel-averaged value, $(w \star \gamma)(t)$ computed from its actual shape, which approaches this tail as the step's width shrinks; for a fixed width, use the logistic itself.
"""),
                (r"Check that $\pi_0$ integrates to 1 and that $\tilde w(0) = 1$.",
                 r"""
$\int_0^{b_0} 4c_0\cosh^2 y\,dy = 4c_0\,(\tfrac12 b_0 + \tfrac14\sinh 2b_0) = c_0\,(2b_0 + \sinh 2b_0) = 1$ by the constant-cost equation. For the transform, $\tilde w = \tilde n\cdot 2c_0\cosh^2 b_0$ (normalizing by $\int n = 1/(2c_0\cosh^2 b_0)$), so $\tilde w(0) = \tilde n(0)\cdot 2c_0\cosh^2 b_0 = 1$.
"""),
                (r"Show that $u(x) = \cosh(rx)/\cosh x$ solves $\tfrac12 u'' + \tanh(x)\,u' = \lambda u$ when $r^2 = 2\lambda + 1$.",
                 r"""
The generator factors: $\tfrac12 u'' + \tanh x\,u' = \frac{1}{\cosh x}\bigl(\tfrac12\partial_x^2 - \tfrac12\bigr)(\cosh x\cdot u)$. (Expand: $\tfrac12(\cosh x\,u)'' - \tfrac12\cosh x\,u = \sinh x\,u' + \tfrac12\cosh x\,u''$; divide by $\cosh x$.) So the equation becomes $v'' = (1 + 2\lambda)\,v = r^2 v$ for $v = \cosh x\cdot u$, whose even solution is $v = \cosh(rx)$. This factoring is the $h$-transform of step 1 in one line.
"""),
                (r"Use the second description to explain, without computing, why the mean look-ahead stays near $\tfrac12$ when time is nearly free, even though the mean decision time grows without bound.",
                 r"""
When $c_0$ is small, $b_0$ is large, and $\pi_0 \propto \cosh^2 y \approx e^{2y}/4$ puts almost all its weight within a unit or so of the bound: the distance $b_0 - Y_0$ is close to exponential with rate 2, so its mean is about $\tfrac12$. Near the bound, the drift $\tanh y$ is nearly 1, so covering that distance takes about $\tfrac12$ a time unit on average. The typical decision starts at 0, far from the bound, and takes $b_0\tanh b_0$, which grows without bound; but those starts carry almost no weight in $\pi_0$. {{ref:cor:limits}}(b) makes this exact.
"""),
                (r"Check the theorem for a constant change, $\gamma \equiv \gamma_0$.",
                 r"""
$w$ integrates to 1, so $(w \star \gamma)(t) = \gamma_0$ and $\beta = B'(c_0)\gamma_0$. The theorem then says $b_\varepsilon = B(c_0) + \varepsilon B'(c_0)\gamma_0 + o(\varepsilon)$, which is the first-order Taylor expansion of the exact answer $B(c_0 + \varepsilon\gamma_0)$.
"""),
                (r"Show that $\int_0^{b_0}\cosh^2 y\,\mathbb{E}_y[\gamma(t + \tau_0)]\,dy = (w \star \gamma)(t)/(4c_0)$.",
                 r"""
Write $\cosh^2 y = \pi_0(y)/(4c_0)$. Then the integral is $\frac{1}{4c_0}\int_0^{b_0}\pi_0(y)\,\mathbb{E}_y[\gamma(t + \tau_0)]\,dy$, and by {{ref:lem:kernel}}(b) the start law $\pi_0$ turns $\tau_0$'s distribution into $w$: $\int_0^{b_0}\pi_0(y)\,\mathbb{E}_y[\gamma(t + \tau_0)]\,dy = \int_0^\infty w(s)\,\gamma(t + s)\,ds$.
"""),
                (r"Where does the proof need the exact equation's lack of a derivative of the bound?",
                 r"""
In step 1. Subtracting two exact equations gives an identity between $F(b_\varepsilon) - F(b_0)$ and an integral, with no $b'$ anywhere, so dividing by $\varepsilon$ and passing to the limit needs only the bracketing of step 3, not any smoothness of $b_\varepsilon$ in time (which isn't known: {{ref:prop:regularity}} gives only Hölder continuity).
"""),
                (r"The theorem is “locally uniform” in $t$. What would go wrong over all of $[0, \infty)$ without uniform continuity of $\gamma$?",
                 r"""
Step 4 needs $\gamma(t + \tau^\varepsilon) - \gamma(t + \tau_0) \to 0$ uniformly in $t$. On a bounded interval, that follows from uniform continuity on compact sets. Over all times, a continuous $\gamma$ could oscillate faster and faster (for example $\sin(t^2)$), so a tiny shift between $\tau^\varepsilon$ and $\tau_0$ could change $\gamma$ by a fixed amount at late enough times. Uniform continuity on $[0, \infty)$ rules that out, and the paper states the uniform version under exactly that condition.
"""),
                (r"For $\gamma(t) = \sin\omega t$ with $\omega > 0$, show that the per-moment error divided by $\varepsilon$ does not tend to the zero function.",
                 r"""
It tends to $B'(c_0)(\gamma - w \star \gamma)$. Write $\gamma = \operatorname{Im}(e^{i\omega t})$; then $(w \star \gamma)(t) = \operatorname{Im}(\tilde w(-i\omega)\,e^{i\omega t})$, because $\int_0^\infty w(s)\,e^{i\omega(t + s)}\,ds = e^{i\omega t}\,\tilde w(-i\omega)$. {{ref:cor:transfer}} shows $|\tilde w(-i\omega)| < 1$, so $\tilde w(-i\omega) \ne 1$, and $\gamma - w \star \gamma = \operatorname{Im}((1 - \tilde w(-i\omega))\,e^{i\omega t})$ is a sinusoid of amplitude $|1 - \tilde w(-i\omega)| > 0$. Multiplied by $B'(c_0) \ne 0$, it is not 0.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The kernel depends on the schedule.”",
                 r"In {{ref:thm:main}}, it is fixed by the constant cost $c_0$ alone. The weighted look-ahead rule of chapter 8 uses the kernel for its own level at each moment, which is a different object."),
                (r"“The kernel is the distribution of decision times.”",
                 r"Of decision times from the special start law $\pi_0$, which piles up near the bound, not from $y = 0$."),
                (r"“The series is how the kernel is defined.”",
                 r"The kernel is defined as the normalized survival flux {{ref:eq:kernel}}. The series and the transform are proved properties of it."),
                (r"“Campbell and Engelund already give the kernel.”",
                 r"The paper credits them with the two identities behind the exact equation, for smooth losses. The explicit kernel and its transform, computed from the exit-time law, are claimed as new to the paper's knowledge."),
                (r"“To first order, the bound is the constant-cost bound at the average future cost, so averaging costs is exactly right.”",
                 r"It is right to first order in $\varepsilon$, for small changes, with the kernel fixed at $c_0$. For large changes, averaging costs fails badly on deadlines, and the paper's rule averages bounds instead (chapter 8)."),
                (r"“The convolution form is the paper's discovery.”",
                 r"Specializing Stojanovic's (1997) perturbation formula to this model at a constant cost formally gives the first-order coefficient as $-1/(2c_0)$ times the convolution of $\gamma$'s future values with the survival flux. The paper claims, to its knowledge, the kernel made explicit, its transform, and the proof for this model on an infinite horizon."),
                (r"“{{ref:thm:main}} covers the 16-fold rise and the deadline.”",
                 r"Large changes, discontinuous steps, and deadlines lie outside it."),
                (r"“The per-moment rule's error is first order, so it loses first-order reward.”",
                 r"Its *bound* error is first order; its *reward* loss is at most second order, by {{ref:prop:loss}} (chapter 7): for a small, bounded, continuous change and a fixed start below the bound. That is why it is close in reward and wrong in timing."),
                (r"“‘Smoothly’ in the abstract means differentiable.”",
                 r"The paper doesn't define it; it corresponds to the Lipschitz case of {{ref:thm:main}} and {{ref:prop:rule}}, where the error is $O(\varepsilon^2)$."),
            ]),
        ],
    },
]
