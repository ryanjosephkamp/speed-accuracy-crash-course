"""Chapter 2: the ideas you need. Evidence and its units, the belief it implies, the folded process Y = |X| and its
generator, and strong solutions with the coupling of two starts.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id) and ("strip", id) place a live plate or a proof strip with its plate;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "ideas",
    "num": 2,
    "title": "The ideas you need",
    "full": "The ideas you need: evidence, belief, and the process Y = |X|",
    "leaf": 3,
    "finding": "In the paper's units, the evidence is half the log odds that the hidden state is +1, and its size is the one process the proofs work with.",
    "readings": [
        ("PalmerT", "milliseconds in one time unit, for the mean observer of Palmer, Huk, and Shadlen (2005) at 6.4% coherence"),
        ("PalmerBound", "that observer's fitted bound, in the paper's units of evidence"),
        ("DecisionTimeTenth", "the mean time from 0 to the flat bound at a cost of 0.1, b tanh b"),
    ],
    "hero": {
        "aria": "Evidence paths drifting up or down, the same axis read as belief, the paths folded at zero, and two folded paths on the same noise staying in order",
        "caption": r"""Eight evidence paths in the paper's units (ink when $H = +1$, gray when $H = -1$), the same axis read as the belief $g$, the paths folded to $Y = |X|$, and $Y$ from two starts on one noise path. Sampled with fixed seeds on steps of 0.01; the pair's noise path is one on which the two meet before time 2.5.""",
        "still": 0,
    },
    "intro": r"""
In the paper's units, the evidence is half the log odds that the hidden state is +1, and its size is the one process the proofs work with. This chapter teaches the pieces of probability the later chapters use, on the paper's own objects: the evidence and its time unit, the belief the evidence implies, the folded process and its generator, and the coupling that compares two starting points path by path. A reader who knows stochastic calculus can skim it; a reader who doesn't gets the pieces the proofs use, and no more.

Two of the four claims rest on other work, and the paper says so. That the evidence, seen by the decision maker, is a single diffusion with drift $\tanh X$ is a standard result of filtering theory (Peskir and Shiryaev 2006); the book derives the drift and checks consequences of the rest on sampled trials, but doesn't prove it. That the folded equation has exactly one solution for each start and each noise path rests on Skorokhod's lemma (Revuz and Yor 1999), which the book cites; from it, a strip gives the Picard and Gronwall argument the paper states in one sentence, and the paper's own proof that two starts on the same noise stay in order.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"def:evidence": "evidence", "def:posterior": "belief", "def:reflected": "fold", "sf:strong": "coupling"}

# which groups of checks in tools/checks/ch02.mjs stand behind each plate
CHECKS = {
    "units": ["units", "palmer", "words"],
    "yours": ["schedule", "yours", "palmer", "words"],
    "belief": ["belief", "drift", "words"],
    "fold": ["fold", "words"],
    "facts": ["facts", "exit", "words"],
    "couple": ["couple", "words"],
}

PLATES = {
    "units": {
        "title": "One path, two sets of units",
        "state": "computed",
        "state_text": "Sampled in the page: one seeded path, resampled in two sets of units",
        "caption": r"""Top: one path of evidence $Z_t$ in raw units, for the drift $\mu$ and noise $\sigma$ you set (each from 0.5 to 2), with the drift $\mu t$ (orange) and the noise's standard deviation $\sigma\sqrt t$ (orange, dashed); they meet at one time unit, $t = \sigma^2/\mu^2$. Bottom: the same path in the paper's units, $x = \mu Z/\sigma^2$ against $t' = \mu^2 t/\sigma^2$, with the drift $t'$ (gray) and $\sqrt{t'}$ (dashed); the shading is the part of it the top chart's window covers. The path has $H = +1$ and is simulated once, on steps of 0.0005 paper time units from a fixed seed (add `?seed=` to the address for another). Each chart draws that one path at 401 times across its own window, read linearly between the simulation's steps, so the two polylines are the same path sampled at different times. Each chart's vertical range widens to hold everything drawn.""",
        "wide": False,
    },
    "yours": {
        "title": "Your schedule, in milliseconds and in belief",
        "state": "computed",
        "state_text": "Computed in the page: the best bound by dynamic programming on a grid, with the evidence axis read through g",
        "caption": r"""Your schedule, from the contents page. Top: the cost of time on a log scale, per time unit or per second. Bottom: the best bound (ink), from a dynamic program that checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window (with a deadline, up to the forced choice there), and the per-moment rule's bound $B(c(t))$, moved in by the same check's shift (dashed). Where the program waits at the center but stops at the grid's first step, the bound is placed between them; where it stops at the center too, the bound is 0 and every trial stops at once, with or without a deadline. The dashed curve is the shifted per-moment formula, $B(c(t)) - 0.5826\sqrt{0.01}$ (0 where that is negative), at every monitoring time before a deadline. At the deadline itself, the formula still has its finite value, since the cost there is finite, but the choice is forced (orange line): the display substitutes 0 for both curves, and the dashed curve drops. The right-hand axis relabels the evidence $x$ as $g(x)$, the chance that a decision made at evidence $x$ is right; since the evidence is checked every 0.01 time units, it can pass a bound between checks, so a decision made on reaching the bound is right with at least that chance. Milliseconds are for the mean observer of Palmer, Huk, and Shadlen (2005); in their proportional-rate diffusion fit, the drift is about $21\,C$ per second at coherence $C$ (a fraction), with noise variance 1 per second, so the time unit is $1/(21\,C)^2$ seconds.""",
        "wide": True,
    },
    "belief": {
        "title": "What the evidence says about the answer",
        "state": "computed",
        "state_text": "Sampled in the page, beside the exact g and tanh",
        "caption": r"""Trials with $H = +1$ or $-1$ equally likely, and evidence $X_t = Ht + W_t$ at the time $t$ you pick, drawn exactly (6,000 trials from a fixed seed, for steps 2 to 4; add `?seed=` for another). Step 1: the two densities of $X_t$. Step 2: the trials' evidence in bins of 0.25, with each bar's $H = +1$ part in ink. Step 3: the share with $H = +1$ in each bin with at least 20 trials, with bars of two sample standard errors (floored at $0.5/n$ for a bin of $n$ trials whose share is 0 or 1, and clipped at 0 and 1), beside $g(x)$; the largest miss is measured against the exact share for the bin, which averages $g$ over it, in the binomial standard error of that exact share. Step 4: the mean change of the evidence over the next time unit, $X_{t+1} - X_t$, in each bin, with bars of two sample standard errors, beside $\tanh x$; the miss is in the bin's sample standard error. Step 5: a separate run of 4,000 trials to time 2, with the innovation $X_t - \int_0^t\tanh(X_s)\,ds$ computed from the evidence alone by left sums on steps of 0.01; 40 are drawn, with dashed guides at $\pm2\sqrt t$, two standard deviations of a Brownian motion at each time (single paths cross them). The readings are the variance of the innovation at time 2 and the correlation of its increment from time 1 to 2 with $\tanh X_1$.""",
        "wide": False,
    },
    "fold": {
        "title": "Folding at zero",
        "state": "computed",
        "state_text": "Sampled in the page: one path; the drift chart is exact",
        "caption": r"""One path of the evidence in the decision maker's view, $dX = \tanh(X)\,dt + d\bar W$ from $X_0 = 0$ to time 2, by Euler steps of 0.001 (a fixed seed; add `?seed=` for another), with $Y = |X|$ and a grid version of Tanaka's formula on the same steps: $\ell$ grows by $|X_{k+1}| - |X_k| - \operatorname{sign}(X_k)(X_{k+1} - X_k)$, with $\operatorname{sign}(0) = 0$, which is positive only on a step where the sign of $X$ on the grid changes, including the first step away from $X_0 = 0$ (ticks on the axis). This grid sum approximates the local time; Tanaka's identity for $\ell$ is the limit as the step shrinks. Second chart: $(\E_y Y_h - y)/h$, computed exactly from the mixture $y + Ht + W_t$ with $P(H = +1) = g(y)$, beside $\tanh y$.""",
        "wide": False,
    },
    "facts": {
        "title": "Three facts about g",
        "state": "computed",
        "state_text": "Computed in the page from the closed forms, with sampled runs in step 5",
        "caption": r"""What each step of the proof is about. Steps 1 and 2: both sides of each identity at 601 points from $-3$ to 3, from the closed forms, with central difference quotients of step 0.01 in step 2. Step 3: the generator's expression applied to $g$ at 301 points from 0 to 3, the part of the state space of $Y$, $[0, \infty)$, on show; at 0 the reflection acts, not this expression. Step 4: $(\cosh^2 y\,f')'$ by central differences of step $10^{-4}$ (dots), beside $2\cosh^2 y\,\Lop f$ from the closed forms (line); the reading is the largest difference divided by the largest size of the right side, or by 1 if that is smaller. Step 5: $b\tanh b - y\tanh y$ for the flat bound $b = B(c)$, with Euler runs of the filtered diffusion $dX = \tanh(X)\,dt + d\bar W$ from four starts until $|X|$ reaches $b$ moved in by $0.5826\sqrt{0.0025}$, on steps of 0.0025, with runs cut off at time 60 (up to 1,000 runs per start, a fixed seed). The bars show sampling error only, not the error of the Euler steps.""",
        "wide": False,
    },
    "couple": {
        "title": "Two starts, one noise",
        "state": "computed",
        "state_text": "Sampled in the page: Euler steps, with the reflection taken on the grid",
        "caption": r"""Two copies of $Y$, from 0.3 and 1.0, on Euler steps of 0.002 with the reflection $Y_{k+1} = \max(0,\ Y_k + \tanh(Y_k)\,\Delta t + \Delta B_k)$, which is Skorokhod's map on the grid. With shared noise both use the same $\Delta B$; with independent noise the upper one has its own. Step 2: Picard iterates from $Y^0 \equiv 0.3$ on the same grid. Steps 4 and 5: 1,000 pairs to time 3 (a fixed seed; add `?seed=` for another).""",
        "wide": False,
    },
}

STRIPS = {
    "posterior": {
        "plate": "belief",
        "steps": [
            (r"Under either answer, the evidence at time $t$ is normal, and the ratio of the two densities depends only on $x$.",
             r"Start from $X_0 = 0$, with the noise $W$ independent of $H$. Given $H$, $X_t = Ht + W_t$ is normal with mean $Ht$ and variance $t$, so $\dfrac{p_+(x)}{p_-(x)} = \dfrac{e^{-(x - t)^2/2t}}{e^{-(x + t)^2/2t}} = \class{lit}{e^{2x}}$. For a whole path the ratio is the same, $e^{x - t/2}/e^{-x - t/2}$ by Girsanov's theorem: it depends on the path only through where it ends."),
            (r"Bayes' rule with equal priors: the posterior odds are that ratio.",
             r"$\dfrac{P(H = +1 \mid \text{evidence})}{P(H = -1 \mid \text{evidence})} = \dfrac{1/2}{1/2}\cdot\dfrac{p_+(X_t)}{p_-(X_t)} = \class{lit}{e^{2X_t}}$."),
            (r"So the belief is a logistic function of the evidence, and the evidence is half the log odds.",
             r"$P(H = +1 \mid X_t = x) = \dfrac{e^{2x}}{1 + e^{2x}} = \class{lit}{g(x) = \dfrac{1}{1 + e^{-2x}}}$, and $\log\dfrac{g}{1 - g} = 2x$."),
            (r"The decision maker's best estimate of the drift is $\tanh X$.",
             r"$\E[H \mid \text{evidence}] = (+1)\,g + (-1)(1 - g) = 2g - 1 = \dfrac{1 - e^{-2X}}{1 + e^{-2X}} = \class{lit}{\tanh X}$. Since $H$ doesn't change, the expected change of the evidence over the next $h$ time units, given what has been seen, is $h\tanh X_t$."),
            (r"What is left is fresh noise, so in the decision maker's view the evidence is one diffusion (a cited result).",
             r"The innovation $\bar W_t = X_t - \int_0^t \tanh(X_s)\,ds$ is a Brownian motion in the decision maker's own information (Peskir and Shiryaev 2006, Ch. VI), so $\class{lit}{dX_t = \tanh(X_t)\,dt + d\bar W_t}$. The plate checks two consequences on 4,000 separate trials, from left sums on steps of 0.01: $\bar W$ has variance 2 at time 2, and its increment from time 1 to 2 has correlation 0 with $\tanh X_1$."),
        ],
    },
    "identities": {
        "plate": "facts",
        "steps": [
            (r"Write the belief through $\tanh$, and the product $g(1 - g)$ simplifies.",
             r"$g(y) = \dfrac{1 + \tanh y}{2}$, so $g(1 - g) = \tfrac14(1 + \tanh y)(1 - \tanh y) = \tfrac14(1 - \tanh^2 y) = \class{lit}{\dfrac{1}{4\cosh^2 y}}$."),
            (r"Differentiate: the slope of the belief is twice that product.",
             r"$g' = \tfrac12\sech^2 y = 2g(1 - g) = \class{lit}{\dfrac{1}{2\cosh^2 y}}$, and $g'' = -\sech^2 y\,\tanh y$."),
            (r"For $y > 0$, the generator's expression sends $g$ to 0: the belief has no drift while $Y > 0$.",
             r"$\Lop g = \tfrac12 g'' + \tanh y\,g' = -\tfrac12\sech^2 y\tanh y + \tfrac12\tanh y\,\sech^2 y = \class{lit}{0}$ for $y > 0$. At $y = 0$, the reflection adds $g'(0)\,d\ell = \tfrac12\,d\ell$, which is where the value of waiting comes from in chapter 4."),
            (r"Multiplying by $\cosh^2 y$ turns the generator into a single derivative.",
             r"$(\cosh^2 y\,f')' = 2\cosh y\sinh y\,f' + \cosh^2 y\,f'' = 2\cosh^2 y\,(\tfrac12 f'' + \tanh y\,f') = \class{lit}{2\cosh^2 y\,\Lop f}$, for any twice differentiable $f$."),
            (r"A first use: the mean time for $Y$ to reach a level $b$.",
             r"$m(y) = \E_y\tau_b$ solves $\Lop m = -1$ on $[0, b)$ with $m'(0) = 0$ (the reflection) and $m(b) = 0$. Step 4 gives $(\cosh^2 y\,m')' = -2\cosh^2 y$, so $\cosh^2 y\,m' = -(y + \tfrac12\sinh 2y)$, which is $m' = -(y\tanh y)'$, and $\class{lit}{m(y) = b\tanh b - y\tanh y}$."),
        ],
    },
    "strong": {
        "plate": "couple",
        "steps": [
            (r"Reflection at 0 is a map on paths: add back the furthest the path has been below 0.",
             r"For a continuous path $U$ with $U_0 \ge 0$, Skorokhod's lemma gives the unique pair with $Y = U + \ell \ge 0$ and $\ell$ nondecreasing from $\ell_0 = 0$, growing only when $Y = 0$: $\class{lit}{\ell_t = \sup_{s \le t}(-U_s)^+}$. The map $\Gamma: U \mapsto Y$ is Lipschitz in the supremum norm, with constant 2."),
            (r"Picard iteration: reflect, recompute the drift, and reflect again.",
             r"Set $Y^{n+1} = \Gamma\bigl(y + \int_0^{\cdot}\tanh(Y^n_s)\,ds + B\bigr)$. Since $\tanh$ is Lipschitz with constant 1, $\sup_{s \le t}|Y^{n+1}_s - Y^n_s| \le 2\int_0^t \sup_{r \le s}|Y^n_r - Y^{n-1}_r|\,ds$, so the distances shrink like $\class{lit}{(2t)^n/n!}$ and the iterates converge to a solution."),
            (r"Gronwall's lemma: the solution is unique, so each start and each noise path give one path.",
             r"Two solutions $Y, \tilde Y$ from the same start on the same $B$ satisfy $\sup_{s \le t}|Y_s - \tilde Y_s| \le 2\int_0^t \sup_{r \le s}|Y_r - \tilde Y_r|\,ds$, so $\class{lit}{Y = \tilde Y}$. The paper runs every start on the same $B$, so all of them share one filtration."),
            (r"Two paths that meet are one path from then on, and continuous paths can't pass each other without meeting.",
             r"If $Y^1_s = Y^2_s$ at some time $s$, then after $s$ both solve the same equation from the same point with the same $B$, and step 3 makes them equal. So for $y_1 \le y_2$, $\class{lit}{Y^1_t \le Y^2_t}$ for all $t$: paths that start ordered stay ordered."),
            (r"What chapter 4 uses: the lower start collects at least as much local time.",
             r"Write $Y^i = U^i + \ell^i$. Then $U^1 - U^2 = y_1 - y_2 + \int(\tanh Y^1 - \tanh Y^2)\,ds \le 0$, and since $\ell^i_t = \sup_{s \le t}(-U^i_s)^+$, $\class{lit}{\ell^1 \ge \ell^2}$ pathwise."),
        ],
    },
}

SECTIONS = [
    {
        "id": "evidence",
        "title": "Noisy evidence and its time unit",
        "blocks": [
            ("plain", r"""
The paper's decision maker must say which of two answers is right. A hidden state $H$ is $+1$ or $-1$, each with probability one half, and the evidence $Z_t$ drifts at rate $\mu$ in the direction of $H$, with noise of size $\sigma$:

$$dZ_t = \mu H\,dt + \sigma\,dW_t,$$

where $W$ is a standard Brownian motion independent of $H$, $Z_0 = 0$, and $\mu, \sigma > 0$. The decision maker knows $\mu$ and $\sigma$; only the sign $H$ is unknown.

Two numbers describe the task, and a change of units sets both to 1. Measure time in units of $\sigma^2/\mu^2$ and evidence in units of $\sigma^2/\mu$, that is, set $t' = \mu^2 t/\sigma^2$ and $x = \mu Z/\sigma^2$, and the evidence has drift $H$ and noise of size 1. A cost per unit of time converts by the inverse factor: with $a = \sigma^2/\mu^2$, the cost per paper time unit at paper time $t'$ is $c'(t') = a\,c(a t')$, so the total cost paid over a decision, $\int c(t)\,dt = \int c'(t')\,dt'$, is unchanged. For a constant cost, that is the paper's $c' = c\,\sigma^2/\mu^2$. Nothing is lost: a result in the paper's units converts back by multiplying its times by $\sigma^2/\mu^2$.

The time unit has a plain meaning. After time $t$, the drift has moved the evidence by $\mu t$, and the noise has a standard deviation of $\sigma\sqrt t$. The two are equal at $t = \sigma^2/\mu^2$, so one time unit is how long the evidence takes to reach a signal-to-noise ratio of one.

The plate draws one path of evidence in raw units, for the drift and noise you set, and the same path in the paper's units below it. First, a guess about a real task.
"""),
            ("plate", "units"),
            ("plain", r"""
Move either slider and the top chart changes: the drift line, the noise curve, and the path all stretch. The bottom chart doesn't change, because it is the same path measured in the paper's units, where drift and noise always meet at time 1. That is all the change of variables does.

For a sense of scale, the paper takes random-dot motion at 6.4% coherence and the mean observer of Palmer, Huk, and Shadlen (2005), whose drift is $21 \times 0.064$ per second with noise variance 1 per second. One time unit is then $1/(21 \times 0.064)^2$ seconds, {{PalmerT}} ms. The paper notes that the unit scales as $1/\text{coherence}^2$: at half the coherence, each time unit is four times as long. The book's times and costs are all in the paper's units; the last plate of the next section reads your schedule in milliseconds.
"""),
            ("exact", "213-219||signal-to-noise ratio of one.", "The paper's words"),
            ("exact", "1225-1227|For a sense|~ms.,1233-1233|The time unit|coherence}^2$.", "And its scale for a real task, from its discussion"),
        ],
    },
    {
        "id": "belief",
        "title": "From evidence to belief",
        "blocks": [
            ("plain", r"""
The evidence is useful because it changes the probability of each answer. In the paper's units, after evidence $X_t = x$, the probability that $H = +1$ is

$$g(x) = \frac{1}{1 + e^{-2x}}.$$

It depends on where the evidence is, not on how long it took to get there. And it is a logistic function: the log odds of $H = +1$ are $2x$, so the evidence is half the log posterior odds. Evidence and belief determine each other, and the paper works in whichever is easier.

The formula is Bayes' rule, in the strip's first three steps. Before you scrub them, a guess: after one unit of evidence, how sure should the decision maker be?
"""),
            ("strip", "posterior"),
            ("plain", r"""
Step 4 is where the decision maker's own view comes in. Given $H$, the evidence drifts at $H$, which is $+1$ or $-1$. The decision maker doesn't know $H$; in its information, the evidence drifts at its best estimate of $H$, which is $\tanh X$. The paper writes the evidence in that view as one diffusion,

$$dX_t = \tanh(X_t)\,dt + d\bar W_t,$$

where $\bar W$, the innovation, is the evidence minus the drift the decision maker expected. That $\bar W$ is a Brownian motion in the decision maker's own information is a standard result of filtering theory, which the paper takes from Peskir and Shiryaev (2006, Ch. VI) rather than proving; step 5 checks two of its consequences on sampled trials. The stopping problem is posed in this view, because a decision rule can use only the evidence.
"""),
            ("exact", "219-230|In these units|", "The paper's words"),
            ("plain", r"""
**On your schedule.** Here is the schedule you chose on the contents page, read in milliseconds if you like, with its best bound read as a belief. The right-hand axis is the left-hand one relabeled by $g$: a decision made at evidence $b$ is right with probability $g(b)$ (chapter 3 makes this the reward). The program checks the evidence every 0.01 time units, so the evidence can pass the bound between checks, and a decision made on reaching it is right with at least that probability. At a deadline, the choice is forced: every trial still open stops with the evidence $x$ it has, and is right with probability $g(|x|)$. A higher bound means a slower, surer choice, and a bound that falls means the decision maker accepts a lower chance of being right as time goes on.
"""),
            ("plate", "yours"),
            ("plain", r"""
The milliseconds are for the Palmer observer at the coherence you pick. The bound in evidence and the chance of being right don't depend on that choice; only the clock and the cost per second do. A cost of $c$ per time unit is a cost of $c\,\mu^2/\sigma^2$ per second, in units of the reward for a correct choice, with $\mu^2/\sigma^2$ in units of one per second.
"""),
        ],
    },
    {
        "id": "fold",
        "title": "Folding the problem in half",
        "blocks": [
            ("plain", r"""
The problem is symmetric. Flipping the sign of the evidence swaps the two answers and changes nothing else, and a decision maker who stops chooses the sign of $X$, which is right with probability $g(|X|)$. So the paper follows only the size of the evidence, $Y = |X|$. Which way does it drift?
"""),
            ("plate", "fold"),
            ("plain", r"""
Away from 0, $Y$ drifts away from it at rate $\tanh Y$: the sign of $X$ and the sign of its drift $\tanh X$ agree, because $\tanh$ is odd. At 0, it can't go lower, and it is pushed back up. Tanaka's formula makes this exact:

$$dY = \tanh(Y)\,dt + dB + d\ell,$$

where $B$ is a Brownian motion and $\ell$, the local time at 0, grows only while $Y = 0$. So $Y$ is a reflected diffusion on $[0, \infty)$. Its generator, the operator whose value $\Lop f(y)$ at $y > 0$ is the rate at which $\E_y f(Y_s)$ changes at $s = 0$, is

$$\Lop = \tfrac12\partial_y^2 + \tanh(y)\,\partial_y,$$

with a reflecting boundary at 0. The plate's second chart measures the drift directly: $(\E_y Y_h - y)/h$, the average change of $Y$ over a short time $h$, divided by $h$. It is exact, because from the decision maker's view, evidence started at $y$ is $y + Ht + W_t$ with $H = +1$ with probability $g(y)$. Away from 0, it settles on $\tanh y$ as $h$ shrinks. At 0, it grows like $\sqrt{2/(\pi h)}$, without limit: the push of the local time has no finite rate.

Three facts about $g$ and $\Lop$ are used throughout the paper:

- $\Lop g = 0$ for $y > 0$: the belief has no drift while $Y > 0$, because $g(X)$ is a martingale.
- $g(1 - g) = 1/(4\cosh^2 y)$, so $g'(y) = 1/(2\cosh^2 y)$.
- $(\cosh^2 y\,f')' = 2\cosh^2 y\,\Lop f$ for any twice differentiable $f$.

Each is a line of calculus. The third turns a second-order equation $\Lop f = q$ into $(\cosh^2 y\,f')' = 2\cosh^2 y\,q$, which integrates in one step. That integration puts the weight $\cosh^2 y$ into the flat bound (chapter 3), the exact equation (chapter 5), and the kernel's start law (chapter 6); the paper notes that $\cosh^2 y$ is half the speed density of $Y$, $m = 2\cosh^2 y$ ({{ref:rem:speed}}). The strip proves the three and then uses the third once.
"""),
            ("strip", "identities"),
            ("plain", r"""
Step 5 is the first of many uses. From 0, the mean time to reach a flat bound $b$ is $b\tanh b$; at the flat bound for a cost of 0.1, {{BoundTenth}}, that is {{DecisionTimeTenth}} time units. Chapter 0's strip used the same identity to find the flat bound, chapter 5 uses it to integrate the exact equation, and the formula $\E_y\tau = b\tanh b - y\tanh y$ returns in the proofs of {{ref:thm:main}}, {{ref:cor:limits}}, and {{ref:prop:loss}}.
"""),
            ("exact", "239-244|By symmetry|", "The paper's words"),
            ("limits", r"""
**What is proved here, and what is taken from elsewhere.** The three facts are direct computations, and the page checks each one. Tanaka's formula, which makes $|X|$ a reflected diffusion, is standard, and the paper uses it without proof. The plate's path is a demonstration on Euler steps of 0.001; its drift chart is exact.
"""),
        ],
    },
    {
        "id": "coupling",
        "title": "Two starts on the same noise",
        "blocks": [
            ("plain", r"""
The proofs in chapters 4 and 5 compare a decision started at $y_1$ with one started at $y_2$, and they do it path by path: run both on the same noise and compare the two paths, not only their averages. That needs the reflected equation to have exactly one solution for each start and each noise path, a *strong solution*, and it needs the solutions from all the starts to be driven by one noise path $B$.

The paper takes the first from Skorokhod's lemma (Revuz and Yor 1999, Ch. VI, Lemma 2.1) and gives the argument in one sentence: reflection at 0 is a map on paths that is Lipschitz in the supremum norm, and $\tanh$ is Lipschitz, so Picard iteration and Gronwall's lemma give a unique strong solution from every start. The strip spells that sentence out, then adds the paper's one-line reason the paths stay in order. First, a guess.
"""),
            ("strip", "strong"),
            ("plain", r"""
Order belongs to the coupling, not to the process. With independent noise, the same two starts cross often; switch the plate's noise to see it. What the proofs use is the pair run on one $B$. In chapter 4, the coupling shows that a start nearer 0 collects at least as much local time, $\ell^1 \ge \ell^2$, which is how {{ref:lem:structure}}(a) shows that the value of being allowed to wait, $V - g$, doesn't increase as the evidence grows. Chapter 5 uses the same coupling to prove smooth fit, {{ref:prop:regularity}}(c).
"""),
            ("exact", "1273-1278", "The paper's standing fact, from Appendix A"),
            ("exact", "1300-1303|By the|stay ordered.", "And the ordering, from the proof of {{ref:lem:structure}}"),
            ("limits", r"""
**What the chapter cites, and what it proves.** Skorokhod's lemma, the reflection of a given path, is cited (Revuz and Yor 1999). From it, steps 2 and 3 prove existence and uniqueness of the strong solution by the Picard and Gronwall argument the paper states in one sentence, and steps 4 and 5 prove the ordering and the local-time comparison, the paper's own argument. The plate's charts are demonstrations on Euler steps of 0.002 with the reflection $\max(0, \cdot)$, a scheme that keeps the order exactly. Nothing about the cost of time enters any of it.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's four highlighted. Apart from each other, they use nothing else in the paper. The evidence and its units feed the belief, and chapter 12's scale for a real task ({{claim:claim:palmer-scale}}). The belief feeds the folded process and chapter 3's reward ({{claim:def:reward-cost}}). The folded process is used by seven claims: the strong solutions on this page, chapter 3's value and flat bound, chapter 4's {{ref:lem:structure}}, chapter 5's {{ref:prop:regularity}} and {{ref:prop:exact}}, and chapter 6's kernel. The strong solutions are used by {{ref:lem:structure}}, by chapter 4's fact that optimal stopping applies ({{claim:sf:stopping}}), and by {{ref:prop:regularity}}.
"""),
            ("map", "def:reflected"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Show that $x = \mu Z/\sigma^2$, $t' = \mu^2 t/\sigma^2$ turns $dZ = \mu H\,dt + \sigma\,dW$ into evidence with drift $H$ and unit noise, and find how the cost changes.",
                 r"""
Multiply by $\mu/\sigma^2$: $dx = (\mu^2/\sigma^2)H\,dt + (\mu/\sigma)\,dW_t$. Since $dt' = (\mu^2/\sigma^2)\,dt$, the first term is $H\,dt'$. For the noise, define $W'_{t'} = (\mu/\sigma)\,W_t$ on the same path; by Brownian scaling, $W'$ is a standard Brownian motion in the new time, and $(\mu/\sigma)\,dW_t = dW'_{t'}$. Hence $dx = H\,dt' + dW'_{t'}$. For the cost, write $a = \sigma^2/\mu^2$, so $t = a t'$. The total cost doesn't depend on the clock: $\int c(t)\,dt = \int c(a t')\,a\,dt'$, so the cost per unit of new time is $c'(t') = a\,c(a t')$, which is $c\,\sigma^2/\mu^2$ for a constant cost.
"""),
                (r"Why is $\sigma^2/\mu^2$ “the time it takes for the evidence to reach a signal-to-noise ratio of one”?",
                 r"""
After time $t$, the drift has moved the evidence by $\mu t$, and the noise has standard deviation $\sigma\sqrt t$. Their ratio is $\mu\sqrt t/\sigma$, which equals 1 exactly when $t = \sigma^2/\mu^2$.
"""),
                (r"For the mean observer of Palmer, Huk, and Shadlen (2005) at 6.4% coherence, the drift is $21 \times 0.064$ per second with noise variance 1 per second. What is one time unit?",
                 r"""
$\sigma^2/\mu^2 = 1/(21 \times 0.064)^2$ seconds, which the paper prints as {{PalmerT}} ms ({{claim:claim:palmer-scale}}). The paper notes that the unit scales as $1/\text{coherence}^2$; in Palmer and colleagues' proportional-rate diffusion fit, the drift is proportional to coherence, so halving the coherence makes the time unit four times as long.
"""),
                (r"Derive $g(x) = 1/(1 + e^{-2x})$.",
                 r"""
In these units, the likelihood ratio of a path ending at $x$ under $H = +1$ against $H = -1$ is $e^{2x}$ (the Girsanov density for drift $+1$ against drift $-1$ is $e^{(+1)x - t/2} / e^{(-1)x - t/2}$). With equal priors, the posterior odds equal the likelihood ratio, so $P(H = +1 \mid x) = e^{2x}/(1 + e^{2x}) = 1/(1 + e^{-2x})$. Taking logs, the log odds are $2x$, so $x$ is half the log posterior odds.
"""),
                (r"Show that $2g(x) - 1 = \tanh x$, and explain why that is the drift of $X$ in the decision maker's own view.",
                 r"""
$2g - 1 = (2 - 1 - e^{-2x})/(1 + e^{-2x}) = (1 - e^{-2x})/(1 + e^{-2x}) = \tanh x$. The decision maker doesn't know $H$, so its best prediction of the drift $H$ is $\E[H \mid \text{evidence}] = (+1)g + (-1)(1 - g) = 2g - 1$. The leftover, $\bar W_t = X_t - \int_0^t \tanh(X_s)\,ds$, is a Brownian motion in the decision maker's own information (the innovation process; the paper cites Peskir and Shiryaev, Ch. VI).
"""),
                (r"Check that $\Lop g = 0$ and that $g(1 - g) = 1/(4\cosh^2 y)$.",
                 r"""
Write $g = (1 + \tanh y)/2$. Then $g' = \tfrac12\sech^2 y$ and $g'' = -\sech^2 y\,\tanh y$, so $\Lop g = \tfrac12 g'' + \tanh y\,g' = -\tfrac12\sech^2 y\tanh y + \tfrac12\tanh y\,\sech^2 y = 0$. For the product, $g(1 - g) = \tfrac14(1 + \tanh y)(1 - \tanh y) = \tfrac14(1 - \tanh^2 y) = 1/(4\cosh^2 y)$.
"""),
                (r"Prove $(\cosh^2 y\,f')' = 2\cosh^2 y\,\Lop f$.",
                 r"""
$(\cosh^2 y\,f')' = 2\cosh y\sinh y\,f' + \cosh^2 y\,f'' = \cosh^2 y\,(f'' + 2\tanh y\,f') = 2\cosh^2 y\,(\tfrac12 f'' + \tanh y\,f') = 2\cosh^2 y\,\Lop f$.
"""),
                (r"Use the identity to find $\E_y\tau$ for the first time $Y$ reaches a fixed level $b$.",
                 r"""
$m(y) = \E_y\tau$ solves $\Lop m = -1$ on $[0, b)$ with $m'(0) = 0$ (reflection) and $m(b) = 0$. The identity gives $(\cosh^2 y\,m')' = -2\cosh^2 y$, so $\cosh^2 y\,m'(y) = -(y + \tfrac12\sinh 2y)$ and $m'(y) = -(y\,\sech^2 y + \tanh y) = -(y\tanh y)'$. With $m(b) = 0$: $m(y) = b\tanh b - y\tanh y$. This formula returns in the mean decision time ($b\tanh b$, from $y = 0$), in the proofs of {{ref:thm:main}} and {{ref:prop:loss}}, and in the mean look-ahead ({{ref:cor:limits}}).
"""),
                (r"Why do two coupled paths that start ordered stay ordered?",
                 r"""
Suppose $Y^1_0 \le Y^2_0$. If the paths ever met, then from that moment both would solve the same equation, from the same point, with the same $B$, and pathwise uniqueness makes them equal from then on. Continuous paths can't pass each other without meeting, so $Y^1 \le Y^2$ for all time.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“Setting $\mu = \sigma = 1$ is a special case.”",
                 r"It is a choice of units. The change of variables maps the general two-valued-drift problem onto this one exactly, so nothing is lost; results convert back by multiplying times by $\sigma^2/\mu^2$."),
                (r"“The drift's size is unknown to the decision maker.”",
                 r"Only its sign $H$ is unknown; its size $\mu$ is known. A drift of unknown size is a formal extension in chapter 11 ({{claim:ext:unknown}})."),
                (r"“The evidence drifts toward the right answer at rate 1, so $\tanh X$ is a mistake.”",
                 r"Both are true, in different information. Given $H$, the drift is $H$. Without $H$, which is the decision maker's view and the one the stopping problem uses, the drift is $\tanh X$."),
                (r"“$g(X)$ is the probability of being right.”",
                 r"$g(X)$ is the probability that $H = +1$. The probability of being right when choosing the sign of $X$ is $g(|X|)$ ({{claim:def:reward-cost}})."),
                (r"“$\Lop g = 0$ means $g$ is constant.”",
                 r"It means $g(Y)$ has no drift while $Y > 0$: $g$ is harmonic for $\Lop$. At $Y = 0$, the reflection adds $g'(0)\,d\ell = \tfrac12 d\ell$, which is where the value of waiting comes from in the proof of {{ref:lem:structure}}."),
                (r"“The coupling is an extra assumption of the paper.”",
                 r"It is the paper's construction on a standard fact. Skorokhod's lemma (Revuz and Yor, Ch. VI, Lemma 2.1) reflects a given path, and with Picard iteration and Gronwall's lemma it gives one solution for each start and noise path; the paper then runs every start on the same noise, and its own argument shows they stay in order. Nothing about the cost enters it."),
            ]),
        ],
    },
]
