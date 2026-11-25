"""Chapter 11: the two extensions, unknown reliability and unequal rewards.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("table", label), and ("strip", id) place a live plate, a generated table, or a derivation strip;
("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and ("limits", text) close a section.

Both extensions are formal, not proved, and every plate says so. The paper prints Table 10 (tab:unknown); the
unequal-rewards table its code writes, paper/generated/tab_lopsided.tex, is not printed in the paper, so the text
quotes its cells as {{T:tab_lopsided:r:c}} and says that the paper doesn't print it.
"""

CHAPTER = {
    "slug": "extensions",
    "num": 11,
    "title": "Unknown reliability and unequal rewards",
    "full": "Two extensions: unknown reliability and unequal rewards",
    "leaf": 12,
    "finding": "Both extensions carry the theory over formally, not as theorems: a change of clock for unknown reliability, and one kernel per bound when the rewards differ.",
    "readings": [
        ("UnknownFrozenMax", "the frozen-time rule's largest loss with unknown reliability, in points per 100 trials (measured)"),
        ("UnknownWeightedMax", "the weighted look-ahead's largest loss there, run on the information clock"),
        ("LopsidedWeightedMax", "the weighted look-ahead's largest loss with unequal rewards, one kernel per bound, on 60 random schedules"),
    ],
    "hero": {
        "aria": "Unequal rewards: a cost that rises and falls, and from one moment each of the two bounds' kernels weighs the moments after it, the upper bound's above a line and the lower bound's below; underneath, the two bounds around the indifference point, first order and per-moment",
        "caption": r"""A correct “−” pays a quarter of a correct “+”, and the cost of 0.1 swings 30% (orange). From the moment on show, each bound's own kernel weighs the moments after it: the upper bound's above the line, the lower bound's below it (green, from the paper's series). Below: the two bounds around the indifference point $x^*$ (gray), to first order (green) and per moment (dashed). Formal, not proved: the paper checks this numerically.""",
        "still": 2,
    },
    "intro": r"""
Both extensions carry the theory over formally, not as theorems: a change of clock for unknown reliability, and one kernel per bound when the rewards differ. The paper's evidence for each is numerical. Every plate in this chapter keeps that frame: the equations are the paper's, carried over without proof, and the numbers that judge them are measurements.

When the strength of the evidence is unknown, the belief moves by the same rule at every moment once time is counted in units of information, but on that clock a constant cost of time rises without bound, outside the costs the theorems allow. When the two correct answers pay differently, the problem no longer folds in half: there are two bounds, and each looks ahead with its own kernel. Nothing here extends the proof of {{ref:thm:main}}.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"ext:unknown": "unknown", "ext:lopsided": "lopsided"}

# which groups of checks in tools/checks/ch11.mjs stand behind each plate
CHECKS = {
    "clock": ["clock", "words"],
    "belief": ["info", "kernelu", "words"],
    "rules": ["info", "kernelu", "rules", "program", "table", "words"],
    "pair": ["pair", "words"],
    "appb": ["pair", "appb"],
    "envelope": ["pair", "flux", "envelope"],
    "sine": ["pair", "flux", "sine", "words"],
}

PLATES = {
    "clock": {
        "title": "Your schedule on the information clock",
        "state": "computed",
        "state_text": "Computed in the page from the change of clock",
        "caption": r"""Top: your schedule's cost of time $c(t)$ from $t = 0$ to 10, the horizon of the paper's computations for {{ref:tab:unknown}}, on a log scale (orange). Bottom, once you guess or press Show me: the cost per unit of information time, $\kappa(\theta) = c(t)\,(t + a)$, against $\theta = \log((t + a)/a)$, on a log scale, with $a = 1$ as in the paper's table; the dashed line is $c(0)\,a\,e^\theta$, what a constant cost at your schedule's starting level would give. The faint lines mark $t = 1$, 2.5, 5, and 10 on the information clock. A deadline makes the cost infinite after it, and the curve stops there.""",
        "wide": True,
    },
    "belief": {
        "title": "From the prior to the bound",
        "state": "computed",
        "state_text": "Computed in the page: closed forms, seeded paths, and the paper's finite-difference kernel",
        "caption": r"""What each step is about, with $a = 1$. Step 1: the prior density of the drift $\mu$ (gray) and the posterior after one seeded trial's evidence at times 0.5, 2, and 8, with the chance that $\mu > 0$. Steps 2 and 3: six seeded trials, each with its own drift drawn from the prior, in steps of 0.005 time units to $t = 10$ (add `?seed=` to the address for others): the evidence $X$ against $t$, then the belief variable $u = X/\sqrt{t + a}$ against $\theta$. Step 4: $\kappa(\theta)$ for three constant costs, on a log scale. Step 5: $2\kappa e^{u^2/2}$, the cost times the speed density, shaded from 0 to $U(\kappa)$ at $\kappa = 0.1$ (area by the trapezoid rule on 400 intervals). Step 6: the kernel of the $u$ process for that bound, the normalized survival flux at $U$ from the paper's finite-difference generator on 240 interior nodes, in 240 log-spaced bins of information time, drawn as weight per unit of $\theta$.""",
        "wide": False,
    },
    "rules": {
        "title": "Three rules beside the program",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program over beliefs and three rules; the losses from the paper's Table 10",
        "caption": r"""Pick one of the paper's eight schedules or your own. Top: the cost of time (orange, log scale). Middle: the evidence bound $X(t)$ of the exact policy, from a dynamic program over 300 beliefs (bins of equal width on $(0, 1)$) in steps of 0.005 time units, stepping back from a forced choice at time 10 or at the deadline (ink); and three rules, each moved in by $0.5826\sqrt{0.005}$ for checking every 0.005: the frozen-time rule (dashed), the weighted look-ahead in information time after 30 damped updates, with $u$-kernels cached on bounds rounded to 0.01 (green), and the plug-in rule (dotted). All with $a = 1$, drawn from 0 to 2.5 or to the deadline. Bottom, for the paper's eight: each rule's loss in points per 100 trials over the whole trial, from {{ref:tab:unknown}}. The tuned constant bound isn't drawn, because its level comes from the scorer, which the page doesn't run; nor are losses for your own schedule.""",
        "wide": True,
    },
    "pair": {
        "title": "Two bounds around the indifference point",
        "state": "computed",
        "state_text": "Computed in the page from the equations of Appendix B",
        "caption": r"""A correct “+” earns $r_+ = 1$ and a correct “−” earns $r_-$, which you set, at a constant cost $c$ that you set. Top: the stopping reward $G(x) = \max(r_+ g(x),\ r_-(1 - g(x)))$ (gray) and the value of waiting $V$ on the waiting region $(\ell, h)$ (ink), from the closed form; the marks are $\ell$, $x^*$, $h$, and the start, $x = 0$. Bottom: the two bounds against $r_-/r_+$ from 0.05 to 1, on a log scale (ink), with $x^*$ (dotted) and $\pm B(c)$, the bounds for equal rewards (dashed). The bounds solve the pair of equations in Appendix B, found as the paper's code finds them: a scan for the first sign change of value matching above $x^*$, then bisection.""",
        "wide": False,
    },
    "appb": {
        "title": "Appendix B, a step at a time",
        "state": "computed",
        "state_text": "Computed in the page from the equations of Appendix B",
        "caption": r"""What each step is about, at $c = 0.1$, for the ratio $r_-/r_+$ you pick. Step 1: the two expected rewards for deciding, $r_+ g(x)$ and $r_-(1 - g(x))$, crossing at $x^*$. Step 2: $\cosh^2 x\,V'(x) = c\,S(x) + K$ on the waiting region (solid) and continued past it (faint). Step 3: the levels $\tfrac12 r_+$ and $-\tfrac12 r_-$ that smooth fit sets, met at $h$ and $\ell$. Step 4: value matching's residual, $A(h) - A(\ell) - [r_+ g(h) - r_-(1 - g(\ell))]$, against a trial upper bound $h$, with $\ell$ and $K$ from step 3; its root is the bound. Step 5: with a common reward $r$ for both answers, the upper bound from the equations (dots) against $B(c/r)$ (line), for $r$ from 0.25 to 4.""",
        "wide": False,
    },
    "envelope": {
        "title": "Each bound's kernel, from the envelope argument",
        "state": "computed",
        "state_text": "Computed in the page from closed forms and the paper's series",
        "caption": r"""At $c_0 = 0.1$, for the ratio $r_-/r_+$ you pick. Step 1: the mean exit time $\mathbb{E}_x\tau$ from $(\ell_0, h_0)$, from its closed form; a constant change $\delta c$ in the cost changes the value by $-\delta c\,\mathbb{E}_x\tau$ to first order. Step 2: $V - G$ on the waiting region (ink), beside the parabolas $c_0(x - h_0)^2$ and $c_0(x - \ell_0)^2$ (dashed). Step 3: near each bound, the slope of $V - G$ (ink) and of $V - G - \delta c\,\mathbb{E}_x\tau$ with $\delta c = 0.02$ (green), by central differences; each crosses 0 at a bound. The green dots are the first-order bounds, moved by $-\delta c\int n_h/(2c_0)$ and $\delta c\int n_\ell/(2c_0)$, and the orange ticks are Appendix B's bounds at $c_0 + \delta c$. The middle is left out: $G$ has a kink at $x^*$, where the slope jumps. Step 4: each bound's kernel, its survival flux normalized, from the paper's series with 4,000 terms, against $s$ on a log scale, with the means marked. Step 5: with equal rewards, both kernels against {{ref:thm:main}}'s, from the series {{ref:eq:series}} (dots).""",
        "wide": False,
    },
    "sine": {
        "title": "Two bounds, two leads",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program with two bounds, and each bound's transfer function",
        "caption": r"""The cost is $0.1 + 0.01\sin\omega t$, with $r_+ = 1$ and $r_-$ as you pick, as in the paper's check. Top: the upper bound's move divided by the size of the change, $(h_\varepsilon - h_0)/\varepsilon$ with $\varepsilon = 0.01$, from a dynamic program on an evidence grid of 0.02 that checks every 0.01 time units, against the same program at the constant cost (ink); the first-order prediction, $h'(c_0)$ times the sinusoid filtered by the upper bound's kernel (green); and the per-moment response $h'(c_0)\sin\omega t$ (dashed). Bottom: the same for the lower bound. The window and the fit are the paper's: whole periods from $t = 2$, at least two and at least 6 time units, with 6 more before the forced choice. The slopes $h'(c_0) = -\int n_h/(2c_0)$ and $\ell'(c_0) = \int n_\ell/(2c_0)$ come from the closed-form flux totals. The paper's program checks every 0.002 on a grid of 0.0025; this coarser grid adds a lag that grows with $\omega$, and halving both steps halves it.""",
        "wide": True,
    },
}

STRIPS = {
    "infotime": {
        "plate": "belief",
        "steps": [
            ("Before the trial, the drift is unknown in size and sign; the evidence makes the belief about it normal.",
             r"With $\mu \sim N(0, 1/a)$ and $X_t = \mu t + W_t$, the posterior is $\mu \mid X_t \sim N\bigl(X_t/(t + a),\ 1/(t + a)\bigr)$, so $\class{lit}{P(\mu > 0 \mid X_t) = \Phi\bigl(X_t/\sqrt{t + a}\bigr)}$."),
            ("In the decision maker's own view, the evidence drifts at its current estimate of the drift.",
             r"$\class{lit}{dX = \frac{X}{t + a}\,dt + d\bar W}$, where $\bar W$ is a Brownian motion for the decision maker's own information: the evidence minus its predicted part."),
            ("Change the clock and the variable, and the rule of motion stops depending on time.",
             r"With $\theta = \log((t + a)/a)$, so that $d\theta = dt/(t + a)$, and $u = X/\sqrt{t + a}$, Itô's formula gives $du = \tfrac12 u\,dt/(t + a) + d\bar W/\sqrt{t + a}$, which is $\class{lit}{du = \tfrac12 u\,d\theta + dW_\theta}$."),
            ("The cost moves to the new clock too, and a constant cost rises on it.",
             r"A cost $c(t)\,dt$ is $c(t)\,(t + a)\,d\theta$, so $\class{lit}{\kappa(\theta) = c(t)\,(t + a)}$; for a constant $c$, $\kappa = c\,a\,e^\theta$, which grows without bound."),
            (r"For a constant $\kappa$, the harmonic reward and smooth fit give the bound, through the speed-measure identity.",
             r"$\Phi(|u|)$ is harmonic for $\tfrac12\partial_u^2 + \tfrac12 u\,\partial_u$. With $s' = e^{-u^2/2}$ and $m = 2e^{u^2/2}$, the value's equation is $(V'/s')' = m\kappa$, and $V'(0) = 0$ with smooth fit, $V'(U) = \Phi'(U)$, gives $2\kappa\int_0^U e^{v^2/2}\,dv = \Phi'/s' = 1/\sqrt{2\pi}$: $\class{lit}{\int_0^U e^{v^2/2}\,dv = \frac{1}{2\sqrt{2\pi}\,\kappa}}$."),
            ("From here on, formally only: the kernel is the decision time from the normalized speed measure.",
             r"For a changing $\kappa$, the exact equation would become $\int_0^{U(\theta)} 2e^{u^2/2}\,\mathbb{E}_u[\kappa(\theta + \tau^*)]\,du = 1/\sqrt{2\pi}$, and the argument of {{ref:thm:main}}, applied formally, gives $\class{lit}{w_U}$: the law of the decision time of $u$ started from $e^{u^2/2}$ normalized on $[0, U]$, equivalently its survival flux at $U$. The paper computes it from a finite-difference generator; it proves no analog of {{ref:prop:regularity}} or {{ref:thm:main}} for this process."),
        ],
    },
    "appB": {
        "plate": "appb",
        "steps": [
            (r"Deciding pays the better of the two expected rewards, and they are equal at $x^*$.",
             r"$\class{lit}{G(x) = \max\bigl(r_+ g(x),\ r_-(1 - g(x))\bigr)}$ with $g(x) = 1/(1 + e^{-2x})$; since $g/(1 - g) = e^{2x}$, the two are equal at $x^* = \tfrac12\log(r_-/r_+)$."),
            ("While the decision maker waits, the value obeys the same equation as before, and it integrates once.",
             r"On $(\ell, h)$, $\tfrac12 V'' + \tanh(x)\,V' = c$, so $(\cosh^2 x\,V')' = 2c\cosh^2 x$ and $\class{lit}{\cosh^2 x\,V'(x) = c\,S(x) + K}$, with $S(x) = x + \tfrac12\sinh 2x$ and a constant $K$."),
            (r"Smooth fit at each end fixes $K$ and the gap between the bounds.",
             r"$V' = G'$ at both ends, and $\cosh^2 x\,G'(x)$ is $\tfrac12 r_+$ above $x^*$ and $-\tfrac12 r_-$ below it, so $\class{lit}{c\,S(h) + K = \tfrac12 r_+,\quad c\,S(\ell) + K = -\tfrac12 r_-}$, and $S(h) - S(\ell) = (r_+ + r_-)/(2c)$."),
            (r"Value matching leaves one equation in $h$.",
             r"$V(h) - V(\ell) = \int_\ell^h V' = A(h) - A(\ell)$ with $A(x) = c\bigl(S(x)\tanh x - \tfrac12\cosh 2x\bigr) + K\tanh x$, and $V = G$ at both ends, so $\class{lit}{A(h) - A(\ell) = r_+ g(h) - r_-\bigl(1 - g(\ell)\bigr)}$, with $\ell$ and $K$ given by $h$ through step 3."),
            ("With equal rewards, the pair reduces to the flat bound of chapter 3.",
             r"For $r_+ = r_- = 1$, symmetry gives $\ell = -h$ and $K = 0$, so $c\,S(h) = \tfrac12$, which is $\sinh 2h + 2h = 1/c$: $h = B(c)$. For a common reward $r$, multiplying both rewards and the cost by $r$ multiplies the objective by $r$, so $\class{lit}{h = -\ell = B(c/r)}$."),
        ],
    },
    "envelope": {
        "plate": "envelope",
        "steps": [
            ("To first order, a small change in the cost changes the value by the extra cost paid while undecided.",
             r"Holding the decision time at its value for the constant cost (the envelope argument), a change $\varepsilon\gamma$ changes the value by $\class{lit}{-\varepsilon\int_0^\infty \gamma(t + s)\,P_x(\tau > s)\,ds}$, where $\tau$ is the exit time from $(\ell_0, h_0)$; for a constant change $\delta c$, that is $-\delta c\,\mathbb{E}_x\tau$."),
            (r"At each bound, waiting and deciding meet with the same slope, and their curvatures differ by $2c_0$.",
             r"$V - G$ is 0 with slope 0 at $h_0$ (smooth fit), and since $\tfrac12 G'' + \tanh(x)\,G' = 0$ while $\tfrac12 V'' + \tanh(x)\,V' = c_0$, $\class{lit}{(V - G)''(h_0) = 2c_0}$."),
            ("The change in the value tilts the meeting point, and the bound moves to where the slope is 0 again.",
             r"With $v(x) = -\int_0^\infty \gamma(t + s)\,P_x(\tau > s)\,ds$, $0 = (V - G)'(h_0 + \delta h) + \varepsilon v'(h_0) \approx 2c_0\,\delta h + \varepsilon v'(h_0)$, and $v'(h_0) = \int_0^\infty \gamma(t + s)\,n_h(s)\,ds$, so $\class{lit}{\delta h(t) \approx -\frac{\varepsilon}{2c_0}\int_0^\infty \gamma(t + s)\,n_h(s)\,ds}$."),
            ("Normalized, each bound's flux is its own kernel, and the two bounds decouple.",
             r"Write $n_h = \bigl(\int n_h\bigr)\,w_h$: $\class{lit}{\delta h = -\frac{\varepsilon\int n_h}{2c_0}\,(w_h \star \gamma)}$, and at $\ell$, symmetrically, $\delta\ell = \frac{\varepsilon\int n_\ell}{2c_0}\,(w_\ell \star \gamma)$. For a constant $\gamma$, the coefficient must be the slope of the constant-cost bound, $dh/dc = -\int n_h/(2c)$: the paper checks this against a central difference of Appendix B's bounds, and the plate does too."),
            ("With equal rewards, both kernels are the kernel of chapter 6, and the formula is the first-order term of Theorem 7.",
             r"For $r_+ = r_-$, $n_h = n$, and $\int n = 1/(2c_0\cosh^2 b_0)$ by {{ref:lem:kernel}}(a), so $-\frac{\varepsilon}{2c_0}\int n\cdot(w \star \gamma) = \class{lit}{\varepsilon B'(c_0)\,(w \star \gamma)}$, the term of {{ref:thm:main}}. For unequal rewards, the paper hasn't made the argument rigorous."),
        ],
    },
}

SECTIONS = [
    {
        "id": "unknown",
        "title": "When the evidence's strength is unknown",
        "blocks": [
            ("plain", r"""
So far the evidence has drifted at $+1$ or $-1$, and only the sign was unknown. Now let the strength be unknown too. The drift is $\mu \sim N(0, 1/a)$, drawn once per trial and never shown, the noise has variance 1 per unit time, and a choice is correct when it matches the sign of $\mu$. After time $t$, the evidence $X_t = \mu t + W_t$ makes the decision maker's belief about $\mu$ normal, with mean $X_t/(t + a)$ and variance $1/(t + a)$, so the chance that $\mu > 0$ is

$$P(\mu > 0 \mid X_t) = \Phi(u), \qquad u = \frac{X_t}{\sqrt{t + a}}.$$

In the decision maker's own view, the evidence drifts at its current estimate of $\mu$: $dX = X/(t + a)\,dt + d\bar W$, where $\bar W$ is a Brownian motion. That rule depends on $t$: the same evidence counts for less late in a trial, because a drift that has had a long time to show itself, and hasn't, is probably small.

A change of clock removes the dependence. In *information time* $\theta = \log((t + a)/a)$, a change of clock that Campbell and Engelund (2026, Example 8.7) already use for a Gaussian unknown drift, as the paper notes, the belief variable moves by the same rule at every moment:

$$du = \tfrac12 u\,d\theta + dW_\theta.$$

The cost changes with the clock. A stretch $dt$ of time is $d\theta = dt/(t + a)$ of information time, so a cost $c(t)$ per unit time is $\kappa(\theta) = c(t)\,(t + a)$ per unit of information time. Before the plate draws it on your schedule, a guess: what does a constant cost become?
"""),
            ("plate", "clock"),
            ("plain", r"""
A constant cost $c$ becomes $\kappa = c\,a\,e^\theta$, which rises without bound: each unit of information takes longer to arrive than the one before. That puts the problem outside the costs between two positive constants that {{ref:prop:regularity}}, {{ref:prop:exact}}, and {{ref:thm:main}} assume ({{claim:asm:cost|the standing assumption}}, chapter 3), so the paper carries their structure over formally, not as a theorem.
"""),
            ("exact", "1012-1023||not as a theorem.", "The paper's setup, in Section 7.1"),
            ("exact", "83-85|The construction|one kernel per bound.", "The paper's words, in its abstract"),
        ],
    },
    {
        "id": "carried",
        "title": "The bound and the kernel, carried over",
        "blocks": [
            ("plain", r"""
On the information clock the belief is a diffusion whose rule doesn't change, so the machinery of chapters 3 to 6 has something to hold on to. For a constant $\kappa$, the problem is a stationary one, and the paper finds its bound the way chapter 3 found $B(c)$: the reward for deciding, $\Phi(|u|)$, is harmonic for the belief's generator, and the value's equation with smooth fit gives

$$\int_0^U e^{v^2/2}\,dv = \frac{1}{2\sqrt{2\pi}\,\kappa}.$$

This is {{ref:rem:speed}} at work, the identity chapter 5's plate “Same algebra, two diffusions” draws for both: for the belief, the scale density is $s' = e^{-u^2/2}$, the speed density is $m = 2e^{u^2/2}$, and $\Phi'/s' = 1/\sqrt{2\pi}$. For a $\kappa$ that changes, the exact equation would become

$$\int_0^{U(\theta)} 2e^{u^2/2}\,\mathbb{E}_u\bigl[\kappa(\theta + \tau^*)\bigr]\,du = \frac{1}{\sqrt{2\pi}},$$

and the argument of {{ref:thm:main}}, applied formally, gives a kernel: the decision time of $u$ started from its speed measure normalized on $[0, U]$, which is its survival flux at $U$, normalized. The paper computes it from a finite-difference generator and runs the weighted look-ahead on the information clock. Scrub through the derivation; the plate beside it draws each step.
"""),
            ("strip", "infotime"),
            ("exact", "1023-1036|The reward|is numerical.", "The paper's derivation, in Section 7.1"),
            ("limits", r"""
**What is derived, and what is carried over.** The posterior is exact, and so are the change of clock and the cost per unit of information time. The constant-$\kappa$ bound is the paper's calculation from the value's equation and smooth fit, for a cost that is constant on the information clock (in real time, $c(t) = \kappa_0/(t + a)$). The exact equation for a changing $\kappa$, the kernel, and the weighted rule built on it are carried over formally: the paper proves no analog of {{ref:prop:regularity}} or {{ref:thm:main}} for this process, and a constant cost in real time is outside the bounded costs those results assume. The evidence for the rule is the measurement in {{ref:tab:unknown}}.
"""),
        ],
    },
    {
        "id": "rules",
        "title": "The rules in information time",
        "blocks": [
            ("plain", r"""
Three rules need no dynamic program. The *frozen-time* rule sets the bound at each moment to $U(\kappa(\theta))$, the constant-$\kappa$ bound for the current cost per unit of information: it is the per-moment rule of chapter 1, on the information clock. The *weighted look-ahead* runs {{ref:alg:weighted}} on the same clock: it averages the frozen-time bounds ahead with the $u$-kernel for its own level, by 30 damped updates. The *plug-in* rule treats the current estimate of the drift's size, $|X|/(t + a)$, as if it were known, and stops where the known-reliability bound for that drift says to. The paper adds a fourth, a constant evidence bound tuned with the scorer: its level is chosen to maximize the scored reward, so it is tuned on the score it is judged by. The first three give an evidence bound $X(t)$, moved in by $0.5826\sqrt{\Delta t}$ for checking every $\Delta t = 0.005$.

The reference is the exact policy, from a dynamic program over a grid of 300 beliefs that steps back from a forced choice at time 10 (or at the deadline). On the paper's eight schedules with $a = 1$, the weighted rule loses at most {{UnknownWeightedMax}} points per 100 trials, and the frozen-time rule up to {{UnknownFrozenMax}}. At constant costs of 0.02 and 0.05, the tuned constant bound does as well as the weighted rule or slightly better: it loses {{T:tab_unknown:1:5}} and {{T:tab_unknown:2:5}}, against {{T:tab_unknown:1:3}} and {{T:tab_unknown:2:3}}. The reference comes from a grid of beliefs, not from the scorer's own grid, so a rule can score a little above it: losses are no longer guaranteed to be nonnegative, and the paper has no error bound for small differences between rules.
"""),
            ("plate", "rules"),
            ("table", "tab:unknown"),
            ("plain", r"""
Two things to look for in the plate. Even at a constant cost, the exact bound moves over the trial, because the cost per unit of information rises; the frozen-time rule, which looks only at the present $\kappa$, starts above it on all eight schedules. And the plug-in rule fails in its own way: when the estimate of the drift is small, the known-reliability rule for that small drift says waiting isn't worth its cost, so at high enough costs the plug-in rule stops at once.
"""),
            ("exact", "1038-1046", "The paper's comparison, in Section 7.1"),
        ],
    },
    {
        "id": "lopsided",
        "title": "Unequal rewards: two bounds",
        "blocks": [
            ("plain", r"""
Back to a drift of $\pm 1$, but now a correct “$+$” earns $r_+ > 0$ and a correct “$-$” earns $r_- > 0$, and errors earn nothing. At evidence $x$, choosing “$+$” earns $r_+ g(x)$ on average and choosing “$-$” earns $r_-(1 - g(x))$, so the two are worth the same at the *indifference point*

$$x^* = \tfrac12\log(r_-/r_+),$$

which is below 0 when “$+$” pays more. The problem no longer folds in half at 0: the paper describes the waiting region as an interval $(\ell(t), h(t))$ around $x^*$, with “$+$” chosen at $h$ and “$-$” at $\ell$. For a constant cost, Appendix B gives a pair of explicit equations for the two bounds.

A guess before the plate: if a correct “$-$” pays a quarter of a correct “$+$”, which bound moves more from where equal rewards put it, at $\pm B(c)$?
"""),
            ("plate", "pair"),
            ("plain", r"""
The upper bound moves more, at every cost and ratio the plate allows. It comes down, so the decision maker chooses “$+$” with less certainty than before: a wrong “$+$” forfeits only the small reward for “$-$”. The lower bound, where it chooses “$-$” and a mistake forfeits the large reward for “$+$”, moves down too, by less. At high costs or lopsided enough rewards, the upper bound falls below 0, and then the decision maker chooses “$+$” at the start, without waiting.

Appendix B derives the pair from the value's equation on the waiting region, smooth fit at each end, and value matching across it. Scrub through it.
"""),
            ("strip", "appB"),
            ("exact", "1064-1067||(\\cref{app:lopsided}).", "The paper's setup, in Section 7.2"),
            ("exact", "1539-1553", "The paper's derivation, in Appendix B"),
        ],
    },
    {
        "id": "per-bound",
        "title": "One kernel per bound",
        "blocks": [
            ("plain", r"""
When the cost changes a little, $c_0 + \varepsilon\gamma(t)$, how do the two bounds move? The paper applies the envelope argument of chapter 5 at each bound separately. To first order, the change costs the decision maker $\varepsilon\gamma$ for as long as it stays undecided, and at each bound the meeting point of waiting and deciding shifts by that change's slope divided by the curvature gap $2c_0$. The result:

$$\delta h(t) \approx -\frac{\varepsilon}{2c_0}\int_0^\infty \gamma(t + s)\,n_h(s)\,ds, \qquad n_h(s) = -\partial_x P_x(\tau > s)\big|_{x = h_0},$$

and symmetrically at $\ell$, where $\tau$ is the time to leave $(\ell_0, h_0)$. Each bound looks ahead with its own survival flux, and the two decouple at first order. With equal rewards, both fluxes are chapter 6's, and the formula is {{ref:thm:main}}'s first-order term.
"""),
            ("strip", "envelope"),
            ("plain", r"""
The paper hasn't made this rigorous for unequal rewards, and it checks it three ways. The slope identity $dh/dc = -\int n_h/(2c)$ holds to a relative tolerance of $10^{-5}$ against a central difference of Appendix B's bounds. With $r_+ = 1$, $r_- \in \{0.5, 0.25\}$, $c_0 = 0.1$, and a sinusoidal change of the cost, both bounds of the dynamic program match the per-bound first-order prediction to about {{LopsidedWorstGain}}% on the swing and {{LopsidedWorstLead}}° on the lead at every frequency from 0.5 to 8. The plate below runs the same check on a coarser grid.
"""),
            ("plate", "sine"),
            ("plain", r"""
The third check is on random schedules. On 60 of them (for each reward ratio, ten each of smooth, step, and deadline costs, with seed 2027), the per-moment rule loses up to {{LopsidedPerMomentMax}} points per 100 trials and the weighted look-ahead, with one kernel per bound, at most {{LopsidedWeightedMax}}. The paper prints no table of these; the table its code writes, `tab_lopsided.tex`, gives the details by family. With $r_- = 0.5$ on the step costs, for example, the per-moment rule's median loss is {{T:tab_lopsided:2:3}} and its largest {{T:tab_lopsided:2:4}}, the weighted rule's largest is {{T:tab_lopsided:2:5}}, and the weighted rule recovers {{T:tab_lopsided:2:6}} of the per-moment rule's total loss; with $r_- = 0.25$ on deadlines, it recovers {{T:tab_lopsided:6:6}}.
"""),
            ("exact", "1067-1078|The envelope argument|rigorous for unequal rewards;", "The paper's per-bound argument, in Section 7.2"),
            ("exact", "1079-1089|identity|", "The paper's checks"),
            ("limits", r"""
**Where the theory stops.** Appendix B's equations follow from the value's equation, smooth fit at both ends, and value matching, for a waiting region that is one interval around $x^*$, as the paper describes it. The first-order part, one kernel per bound, is a formal per-bound envelope argument that the paper says it has not made rigorous. {{ref:thm:main}} itself assumes equal rewards, a drift of known size, and a cost between two positive constants; nothing in this chapter extends its proof, and both extensions are listed among the paper's limitations.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's two highlighted. Unknown reliability uses {{ref:rem:speed}} (chapter 5) for the constant-$\kappa$ bound and the kernel's starting law, the argument of {{ref:thm:main}} (chapter 6), which it applies formally, and {{claim:def:weighted|the weighted look-ahead rule}} (chapter 8), which it runs on the information clock. Unequal rewards uses the envelope identity ({{ref:lem:envelope}}) and smooth fit ({{ref:prop:regularity}}) from chapter 5, and {{ref:thm:main}}, which it reproduces when the rewards are equal. Both are on {{claim:claim:limitations|the paper's list of its limitations}} (chapter 12).
"""),
            ("map", "ext:unknown"),
            ("exact", "1249-1250", "The paper's limitations, on the extensions"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Check that $\kappa(\theta) = c(t)\,(t + a)$ and that a constant cost grows exponentially in $\theta$.",
                 r"""
$\theta = \log((t + a)/a)$ gives $d\theta = dt/(t + a)$, so a stretch $dt$ of real time is $d\theta = dt/(t + a)$ of information time, and its cost $c(t)\,dt$ is $c(t)\,(t + a)\,d\theta$. Since $t + a = a\,e^\theta$, a constant $c$ gives $\kappa(\theta) = c\,a\,e^\theta$: exponential growth. Information about $\mu$ arrives ever more slowly, so each unit of it takes more real time, and costs more.
"""),
                (r"Derive the posterior $\Phi(X/\sqrt{t + a})$.",
                 r"""
With prior $\mu \sim N(0, 1/a)$ and evidence $X_t = \mu t + W_t$, the posterior of $\mu$ is normal with precision $a + t$ and mean $X_t/(t + a)$. So $P(\mu > 0 \mid X_t) = \Phi\bigl((X_t/(t + a))\sqrt{t + a}\bigr) = \Phi(X_t/\sqrt{t + a})$. The drift in the decision maker's view is the posterior mean, $X/(t + a)$.
"""),
                (r"Show that the cost $c(t) = \kappa_0/(t + a)$ is constant on the information clock. What do the frozen-time and weighted rules do for it?",
                 r"""
$\kappa(\theta) = c(t)\,(t + a) = \kappa_0$ at every moment. The weighted rule averages $U(\kappa(\theta + s))$ over $s$ with weights that sum to 1, and every term is $U(\kappa_0)$, so the average is $U(\kappa_0)$ whatever the kernel: the two rules give the same bound, $U(\kappa_0)\sqrt{t + a}$ in evidence units. (A test in the paper's code checks this.) It is the information-clock version of a constant cost for known reliability.
"""),
                (r"Why does the weighted rule sit below the frozen-time rule for a constant cost?",
                 r"""
A constant $c$ gives $\kappa(\theta + s) = c\,a\,e^{\theta + s} > \kappa(\theta)$ for every $s > 0$, and $U$ falls as $\kappa$ rises, so every term $U(\kappa(\theta + s))$ the weighted rule averages is below the frozen-time bound $U(\kappa(\theta))$, and so is their average. The rule looks ahead at a cost that will only rise and lowers its bound now.
"""),
                (r"Why should small differences between rules in {{ref:tab:unknown}} be read with caution?",
                 r"""
The reference policy is a dynamic program over 300 belief bins, not the scorer's own grid, so a rule can score slightly better than the reference, and the paper has no error bound for the gap. The large differences (frozen-time against weighted, or the plug-in rule's losses) are clear; differences of a few thousandths are not.
"""),
                (r"Derive the indifference point $x^* = \tfrac12\log(r_-/r_+)$.",
                 r"""
At $x$, choosing “$+$” earns $r_+\,g(x)$ in expectation and choosing “$-$” earns $r_-(1 - g(x))$. They are equal when $g/(1 - g) = r_-/r_+$. Since $g/(1 - g) = e^{2x}$, $x^* = \tfrac12\log(r_-/r_+)$. With $r_- < r_+$, $x^* < 0$: evidence a little below 0 still makes “$+$” the better choice. Whether the decision maker stops there depends on where the bounds are.
"""),
                (r"Show that the bounds of Appendix B satisfy $S(h) - S(\ell) = (r_+ + r_-)/(2c)$.",
                 r"""
Smooth fit gives $c\,S(h) + K = \tfrac12 r_+$ and $c\,S(\ell) + K = -\tfrac12 r_-$. Subtracting removes $K$: $c\,(S(h) - S(\ell)) = \tfrac12(r_+ + r_-)$. Since $S$ is increasing, the gap in $S$ fixes $\ell$ once $h$ is chosen, and value matching then picks $h$.
"""),
                (r"Appendix B says a common reward $r$ gives $h = -\ell = B(c/r)$. Why?",
                 r"""
Multiplying both rewards by $r$ and the cost by $r$ multiplies the whole objective by $r$, which doesn't change the best rule. So rewards $r$ with cost $c$ behave like rewards 1 with cost $c/r$, whose bound is $B(c/r)$.
"""),
                (r"Check that the per-bound formula reproduces {{ref:thm:main}} in the symmetric case.",
                 r"""
With $r_+ = r_- = 1$, $n_h = n$, and $\int n = 1/(2c_0\cosh^2 b_0)$ ({{ref:lem:kernel}}(a)). Write $n = (\int n)\,w$: the shift is $-\tfrac{\varepsilon}{2c_0}\int n\cdot(w \star \gamma) = -\tfrac{\varepsilon}{4c_0^2\cosh^2 b_0}(w \star \gamma) = \varepsilon B'(c_0)(w \star \gamma)$, which is the first-order term $\varepsilon\beta$ of {{ref:thm:main}}.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The paper proves the theory for unknown reliability.”",
                 r"It carries the exact equation and the kernel over formally and checks the rule numerically. It has not proved analogs of {{ref:prop:regularity}} or {{ref:thm:main}} for this process, and says so."),
                (r"“A constant cost stays constant on the information clock.”",
                 r"It becomes $\kappa = c\,a\,e^\theta$, which rises without bound. The frozen-time rule, which looks only at the present $\kappa$, ignores that rise; at a constant cost of 0.02 it loses {{T:tab_unknown:1:2}} points per 100 trials."),
                (r"“The weighted rule beats every alternative here.”",
                 r"At constant costs of 0.02 and 0.05, the tuned constant bound does as well or slightly better."),
                (r"“The unequal-rewards result is a theorem.”",
                 r"It is a formal per-bound envelope argument with numerical checks; the paper says it has not made it rigorous."),
                (r"“With unequal rewards, both bounds shift by the same amount toward the better-paid answer.”",
                 r"The upper bound, where the better-paid answer is chosen, moves more than the lower one, and both move down; the plate on two bounds computes how much for any ratio and cost."),
                (r"“There is a table of the unequal-rewards results.”",
                 r"The numbers are in the paper's text only. The paper's code writes `tab_lopsided.tex`, but the paper doesn't print it."),
            ]),
        ],
    },
]
