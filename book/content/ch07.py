"""Chapter 7: what the kernel implies.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id), ("figure", stem), ("table", label), and ("strip", id) place a live plate, a printed figure, a
generated table, or a proof strip; ("qs", [(question, answer)]), ("miss", [(misreading, correction)]), and
("limits", text) close a section.
"""

CHAPTER = {
    "slug": "implies",
    "num": 7,
    "title": "What the kernel implies",
    "full": "What the kernel implies: the transfer function, the limits, and second-order loss",
    "leaf": 8,
    "finding": "To first order, a cost that rises and falls like a sine wave moves the bound by a smaller swing than the per-moment rule says, and earlier.",
    "readings": [
        ("PerMomentTooLargeAtEight", "the per-moment rule's swing at ω = 8, as a multiple of the best bound's swing measured on the dynamic program"),
        ("PerMomentLateAtEight", "how many degrees the per-moment rule lags the best bound there"),
        ("MaxLookAhead", "the longest mean look-ahead over all costs, found numerically (time units)"),
    ],
    "hero": {
        "aria": "A cost that rises and falls like a sine wave at five frequencies, and below it the per-moment response and the smaller, earlier first-order response",
        "caption": "A cost of 0.1 that swings 30% like a sine wave (orange), at five frequencies $\\omega$, drawn over two periods. Below: the per-moment response (dashed) and the first-order bound's response (green). As $\\omega$ grows, the bound's swing shrinks and its troughs come earlier in each cycle.",
        "still": 4,
    },
    "intro": r"""
To first order, a cost that rises and falls like a sine wave moves the bound by a smaller swing than the per-moment rule says, and earlier. This chapter derives that from the kernel's closed form in chapter 6, then how far ahead the bound looks on average and why fast changes in the cost are smoothed but not ignored. Its second half turns to reward: why a bound that is a little off loses very little.

Three of the chapter's four claims are proved. The fourth, a formula for how much reward a nearby rule loses, is a conjecture: the paper checks its constant against two exact facts and tests it numerically, and this chapter labels it a conjecture wherever it appears. Of the chapter's results, one number is numerical rather than proved: the largest mean look-ahead over all costs. The readings beside the picture are the paper's measurements on its dynamic program.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"cor:transfer": "sinusoid", "cor:limits": "look-ahead", "prop:loss": "reward", "conj:loss": "conjecture"}

# which groups of checks in tools/checks/ stand behind each plate
CHECKS = {
    "wave": ["transfer", "table", "words"], "arrows": ["transfer"], "lookahead": ["lookahead", "words"],
    "mean": ["lookahead", "starts"], "shift": ["shift", "schedule", "words"], "halfint": ["half", "lead"],
    "reward": ["reward", "words"], "band": ["band"], "loss": ["loss", "scorer", "schedule", "words"],
    "conj": ["conjecture", "scorer", "reward", "band", "words"],
}

PLATES = {
    "wave": {
        "title": "A sinusoid in, a sinusoid out",
        "state": "computed",
        "state_text": "Computed in the page from the closed-form transform; the dots are the paper's Table 1",
        "caption": r"""A cost $c_0\,(1 + 0.3\sin\omega t)$. Top: the cost (orange) over two periods. Middle: the per-moment response $B'(c_0)\gamma(t)$ (dashed) and the first-order response $\beta(t)$ (green), each divided by the per-moment swing; the arrow between two troughs is the lead. Bottom, as in Figure 3: the gain $|\tilde w(-i\omega)|$ on log axes, and the lead $\arg\tilde w(-i\omega)$ in degrees against $\omega$ on a log axis, with the high-frequency gain $2c_0\cosh^2 b_0\sqrt{2/\omega}$ dotted. Your cost's curves are drawn bold from the lowest frequency you have visited to the highest; when you reveal the answer, that range starts as Table 1's, 0.5 to 8. Dots: the paper's dynamic program at $c_0 = 0.1$ and $\varepsilon = 0.01$ (Table 1).""",
        "wide": True,
    },
    "arrows": {
        "title": "The terms of the transform",
        "state": "computed",
        "state_text": "Computed in the page from the series and the closed form",
        "caption": r"""The complex plane, for the cost and frequency you pick. Step 1: the running integral $\int_0^S w(s)\,e^{i\omega s}\,ds$ as $S$ grows, from 0 to $\tilde w(-i\omega)$, evaluated exactly at the edges of the kernel's 320 bins (the closed form less the series' tail from $S$ on). Steps 2 to 4: the terms $a_j/(\alpha_j - i\omega)$ of the series, head to tail: the first five as arrows, and the rest of the sum as one dotted arrow (the closed form less the first five). The arc is the unit circle.""",
        "wide": False,
    },
    "lookahead": {
        "title": "How far ahead, at every cost",
        "state": "computed",
        "state_text": "Computed in the page from the series and the closed form (22)",
        "caption": r"""Figure 2, rebuilt. Top: the kernel $w(s)$ for the cost you set (green), on log axes, with its mean $m(c_0)$ marked, and the four costs of Figure 2 in gray. Bottom: the mean look-ahead $m(c_0)$ (green) and the mean decision time from 0, $b_0\tanh b_0$ (gray), against the cost on a log axis; the dotted line is $\tfrac12$. The largest look-ahead is found by scanning 4,000 costs from $10^{-4}$ to 10, as the paper's figure script does.""",
        "wide": True,
    },
    "mean": {
        "title": "The look-ahead, step by step",
        "state": "computed",
        "state_text": "Computed in the page: the closed forms, and decision times sampled from six starts",
        "caption": r"""What each step of the proof is about, for the cost you pick. Step 1: the transform $\tilde w(\lambda)$, with its value 1 and its slope $-m(c_0)$ at 0 (the readings take $\lambda = 10^{-4}$). Step 2: the start law $\pi_0(y)$ and the mean time $\mathbb{E}_y\tau_0$; their product, shaded, has area $m(c_0)$. Step 3: $\mathbb{E}_y\tau_0$ beside the mean of 400 decisions from each of six starts, from 0 to $0.9\,b_0$ (crosses, with two standard errors; seeded). Each decision runs $dX = \tanh(X)\,dt + dW$ and is checked every $dt$ against the bound moved in by $0.5826\sqrt{dt}$, with $dt = 0.0025$, or less where that shift would be more than a quarter of the distance from the nearest start to the bound (at $c_0 = 0.5$, $dt \approx 0.0004$). Step 4: $m(c_0)$ over costs from $10^{-4}$ to 100, with its two limits.""",
        "wide": False,
    },
    "shift": {
        "title": "Your schedule, shifted ahead",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program on a grid, and the per-moment rule shifted by the closed form (22)",
        "caption": r"""Ink: the bound a dynamic program exports for your schedule, solved for checking the evidence every 0.01 time units on a grid of 0.02 and run until 6 time units past the window, or until the forced choice when the schedule has a deadline. It is exported as the paper's code exports it: the first grid point past 0 where deciding beats waiting, interpolated, and 0 when that point is the grid's first step (0.02), although the program may still wait at 0 itself there. Dashed: the per-moment bound $B(c(t))$. Green, dotted: the per-moment bound shifted ahead by the mean look-ahead at the present cost, $B(c(t + m(c(t))))$, with $m$ from the closed form (22), the shift the paper tests in its held-out set. Only these two rules are moved in, by $0.5826\sqrt{0.01}$, for checking every 0.01; the program is solved for that checking and needs no shift. The plot shows every 0.02 time units and the last one. Orange, above: the cost, on a log scale.""",
        "wide": True,
    },
    "halfint": {
        "title": "Half an integration",
        "state": "computed",
        "state_text": "Computed in the page from the closed form and the series; the slopes are measured on the curves",
        "caption": r"""What each step is about, for the cost you pick. Step 1: the real part of $r = \sqrt{1 - 2i\omega}$ and minus its imaginary part, beside $\sqrt\omega$, on log axes. Step 2: the distance of $\tanh(rb_0)$ from 1. Step 3: the gain and the lead against $\omega$ on log axes, with the gain's line of slope $-\tfrac12$, $2c_0\cosh^2 b_0\sqrt{2/\omega}$, and the line at $45^\circ$. Step 4: the kernel near $s = 0$ beside $2c_0\cosh^2 b_0\sqrt{2/(\pi s)}$, a line of slope $-\tfrac12$. Step 5: the gain beside that of an exponential kernel with the same mean, $1/|1 - i\omega m(c_0)|$. The slopes in the readings are measured on the computed curves, by central differences.""",
        "wide": False,
    },
    "reward": {
        "title": "Off the peak",
        "state": "computed",
        "state_text": "Computed in the page from the closed form of a flat bound's reward",
        "caption": r"""Top: the reward of a flat bound $b$ at a constant cost $c$, from a start at 0, $R(b) = g(b) - c\,b\tanh b$ (ink), with its peak at $B(c)$. Drag along the curve, or use the slider, to move the bound (orange). Bottom: the loss $R(B) - R(B + \delta)$ against the size of the miss on log axes, for misses above the peak (solid) and below it (thin), beside $c\,\delta^2$ (dotted).""",
        "wide": False,
    },
    "band": {
        "title": "A thin band at the bound",
        "state": "computed",
        "state_text": "Computed in the page from closed forms; one path sampled, seeded",
        "caption": r"""What each step of the proof is about, at $c_0 = 0.1$ from a start at $y_0 = 0$, for the band half-width $D = A|\varepsilon|$ you set. Step 1: the last stretch of one path of $Y$ (seeded) before it reaches $b_0 + D$, the band $b_0 \pm D$, and a bound that wanders inside it (orange), with the three hitting times. Step 2: the waiting value $W_0(y) = V_0(y) - g(y)$ at the constant cost, and $c_0(b_0 - y)^2$ (dotted). Step 3: the largest $W_0$ in the band, and $c_0$ times the expected time spent above $b_0$ (the cost of that time, from the Green's function), against $D$ on log axes, with a dashed line of slope 2. Step 4: $\mathbb{E}\tau^+ - \mathbb{E}\tau^-$ and $D(\mathbb{E}\tau^+ - \mathbb{E}\tau^-)$ against $D$; the labels on the curves give their slopes.""",
        "wide": False,
    },
    "loss": {
        "title": "Your schedule: loss against the size of the change",
        "state": "computed",
        "state_text": "Computed in the page: a dynamic program and a forward computation on a grid, with no sampling",
        "caption": r"""Your schedule written around its cost at time 0, $c(0) + \varepsilon\,(c(t) - c(0))$, for $\varepsilon$ from 1 down to $\tfrac1{64}$. Top: at the $\varepsilon$ you set, the best bound (ink), the per-moment rule (dashed), and the first-order bound $b_0 + \varepsilon\beta(t)$ (green). Bottom: each rule's loss of reward against the best bound's, on log axes, with a guide line of slope 2 (a reference for the order, not a bound); the slopes in the readings are fitted over each rule's three smallest sizes above the display cutoff. Each policy is scored by pushing the chance of each decision time forward on the evidence grid (every 0.01 time units, a grid of 0.02, a forced choice at time 14, late enough that almost every decision comes before it unless the cost is very small). The best policy is scored from the program's own stop decisions, so its score is the program's value and no rule can score above it; the rules are scored from their bounds, moved in for checking every 0.01, and the first-order bound is clipped at 0, where every trial still undecided stops. The baseline is the per-moment rule's loss at the constant cost $c(0)$ on this grid with this forced choice: in the continuous problem on an infinite horizon that loss is 0, so the baseline measures the grid and the horizon together. Hollow dots: losses below ten times the baseline, a display cutoff for this page rather than an error bound (on the Smooth preset, the losses above it change by under 10% on a grid twice as fine, and by under 10% with the forced choice at 28 instead of 14).""",
        "wide": True,
    },
    "conj": {
        "title": "Conjecture 11 on your schedule",
        "state": "conjecture",
        "state_text": "Conjecture 11, not proved: its prediction computed in the page beside the loss scored on a grid",
        "caption": r"""The same runs as the plate before. Top: at the $\varepsilon$ you set, the share of the conjecture's prediction $\sum_k f_k\,c(t_k)\,\eta(t_k)^2$ that comes from decisions made by time $t$ (on a log axis), for each rule, out to the forced choice at 14 (the last grid time is left out, as in the paper); the shaded band is the last 2 time units. Bottom: the prediction divided by the scored loss, against $\varepsilon$, with a dashed line at 1 as an agreement reference for both rules. The conjecture implies a ratio near 1 for small $\varepsilon$ only for a miss $\varepsilon f$ of one fixed Lipschitz shape whose leading term $\E[c(\hat\tau) f(\hat\tau)^2]$ doesn't vanish. Neither rule's miss is exactly that: the per-moment rule's is of that form only to first order, with a remainder; the first-order bound's changes shape with $\varepsilon$; and the grid and the forced choice add limits of their own. So the plate compares, and doesn't test the conjecture. A ratio past the top of the axis (at most 8) is drawn at the top with an arrow and its value. Hollow dots: losses below the display cutoff of the plate before. Below the charts: the two exact facts the conjecture's constant agrees with, computed at your schedule's starting cost by difference quotients.""",
        "wide": True,
    },
}

STRIPS = {
    "transfer": {
        "plate": "arrows",
        "steps": [
            ("A wave through the kernel comes out as the same wave, scaled and turned.",
             r"For $\gamma(t) = e^{i\omega t}$, $(w \star \gamma)(t) = \int_0^\infty w(s)\,e^{i\omega(t + s)}\,ds$, which is $\class{lit}{e^{i\omega t}\,\tilde w(-i\omega)}$. Taking real parts with $B'(c_0)$ and $\Gamma$ gives $\beta(t) = \operatorname{Re}\bigl(B'(c_0)\,\tilde w(-i\omega)\,\Gamma e^{i\omega t}\bigr)$."),
            ("Write the transform as a sum of simple terms, one per exponential in the series.",
             r"From the series {{ref:eq:series}}, $\tilde w(-i\omega) = \class{lit}{\sum_j a_j/(\alpha_j - i\omega)}$ with $a_j > 0$, $\alpha_j = (1 + \kappa_j^2)/2$, and $\sum_j a_j/\alpha_j = 1$ (the value at $\omega = 0$)."),
            ("At any frequency above 0, every term points up and to the right.",
             r"Each term $1/(\alpha_j - i\omega) = \class{lit}{(\alpha_j + i\omega)/(\alpha_j^2 + \omega^2)}$ has positive real and imaginary parts, so the sum's phase lies strictly between $0^\circ$ and $90^\circ$."),
            ("Every term is shorter than it was at zero frequency, so the sum's modulus is less than 1.",
             r"Each term has modulus $a_j/|\alpha_j - i\omega| < a_j/\alpha_j$ for $\omega > 0$, so $\class{lit}{|\tilde w(-i\omega)| < \sum_j a_j/\alpha_j = 1}$. (The paper also notes the terms have different phases, which makes the triangle inequality strict.)"),
        ],
    },
    "limits": {
        "plate": "mean",
        "steps": [
            ("Slow changes: the transform at zero is 1.",
             r"(a) $\class{lit}{\tilde w(0) = \int_0^\infty w(s)\,ds = 1}$ because $w$ is normalized: at zero frequency the weighted average is the value itself, which is the per-moment rule."),
            ("The mean is minus the transform's slope at zero, and an average over starts.",
             r"(b) $m(c_0) = \int_0^\infty s\,w(s)\,ds = -\tilde w'(0)$. By {{ref:lem:kernel}}(b), it is also $\class{lit}{\int_0^{b_0}\pi_0(y)\,\E_y\tau_0\,dy}$, the mean decision time from the start law $\pi_0$."),
            ("The mean time from each start has a closed form; integrate it.",
             r"$\E_y\tau_0 = b_0\tanh b_0 - y\tanh y$ solves $\Lop m = -1$ with $m'(0) = 0$ and $m(b_0) = 0$. Integrating against $4c_0\cosh^2 y$, with the constant-cost equation, gives {{ref:eq:mean-look-ahead}}: $\class{lit}{m(c_0) = c_0\bigl[\tfrac12\sinh 2b_0 - b_0 + 2b_0^2\tanh b_0\bigr]}$."),
            ("Half a unit when time is free, nothing when it is expensive; the peak in between is numerical.",
             r"The second form of {{ref:eq:mean-look-ahead}}, $m = \tfrac12 + \frac{2b_0(b_0\tanh b_0 - 1)}{\sinh 2b_0 + 2b_0}$, shows $\class{lit}{m \to \tfrac12}$ as $b_0 \to \infty$ ($c_0 \to 0$). As $c_0 \to \infty$, $b_0 \sim 1/(4c_0)$ and $m \sim \tfrac23 b_0^2 \to 0$. The maximum is found numerically."),
        ],
    },
    "half": {
        "plate": "halfint",
        "steps": [
            (r"At a high frequency, $r$ is close to $(1 - i)\sqrt\omega$.",
             r"(c) At $\lambda = -i\omega$, $r = \sqrt{1 - 2i\omega}$, and $\sqrt{-2i\omega} = (1 - i)\sqrt\omega$, so $\class{lit}{r \sim (1 - i)\sqrt\omega}$ as $\omega \to \infty$."),
            ("The hyperbolic tangent approaches 1.",
             r"The real part of $rb_0$ is about $b_0\sqrt\omega$, which grows without bound, so $\class{lit}{\tanh(rb_0) \to 1}$, exponentially fast."),
            (r"What is left has a gain like $\omega^{-1/2}$ and a phase of $45^\circ$.",
             r"So $\tilde w(-i\omega) \sim 2c_0\cosh^2 b_0\,(1 - i)\sqrt\omega/(-i\omega)$, which is $\class{lit}{2c_0\cosh^2 b_0\,(1 + i)/\sqrt\omega}$: modulus $2c_0\cosh^2 b_0\sqrt{2/\omega}$, phase $45^\circ$. The $-\tanh b_0$ in the closed form is smaller by a factor of $\sqrt\omega$."),
            (r"A transform like $\lambda^{-1/2}$ comes from a kernel like $s^{-1/2}$.",
             r"Near $s = 0$, the terms of the series {{ref:eq:series}} add up to $n(s) \approx \sqrt{2/(\pi s)}$, so $\class{lit}{w(s) \approx 2c_0\cosh^2 b_0\sqrt{2/(\pi s)}}$, whose transform is $2c_0\cosh^2 b_0\sqrt{2/\lambda}$: the same behavior at high frequency."),
            ("Half of an integration: fast changes are smoothed, not ignored.",
             r"Integrating over time divides a wave's swing by $\omega$ and delays it by $90^\circ$. A kernel like $s^{-1/2}$ does half of each: its gain falls like $\class{lit}{\omega^{-1/2}}$ and its phase tends to $45^\circ$ (a lead, since the kernel averages the future). An exponential kernel with the same mean falls like $\omega^{-1}$."),
        ],
    },
    "loss": {
        "plate": "band",
        "steps": [
            ("Both decision times are caught between two fixed levels.",
             r"Let $A = \max(a, a_0)$, where $a_0|\varepsilon|$ bounds the optimal bound's own distance from $b_0$ ({{ref:lem:structure}}(c)). Both the policy's decision time $\hat\tau$ and the optimal one lie between the hitting times $\tau^\pm$ of $b_0 \pm A|\varepsilon|$: $\class{lit}{\tau^- \le \hat\tau \le \tau^+}$."),
            ("At the constant cost, the shortfall has two parts.",
             r"Itô's formula for $V_0$ gives the policy's shortfall $V_0(y_0) - J_0(\hat b)$ as $\class{lit}{\E[W_0(Y_{\hat\tau})] + c_0\,\E\int_0^{\hat\tau}\mathbf 1\{Y_s \ge b_0\}\,ds}$, the waiting value left where it stops and the cost of time spent above $b_0$."),
            ("Both parts are of order ε².",
             r"$Y_{\hat\tau}$ is within $A|\varepsilon|$ of $b_0$, where $W_0 \le C(b_0 - y)^2$ by smooth fit and a bounded second derivative. The expected time spent in a band of width $A|\varepsilon|$ next to an absorbing level is $\class{lit}{O(\varepsilon^2)}$. The same holds for the optimal policy of $c_\varepsilon$."),
            ("Changing the cost changes both rewards by nearly the same amount.",
             r"The perturbation changes each policy's reward by $-\varepsilon\,\E\int_0^\tau\gamma$. Between the two policies, these changes differ by at most $\class{lit}{|\varepsilon| M(\E\tau^+ - \E\tau^-) = O(\varepsilon^2)}$, since $\E_{y_0}\sigma_z = z\tanh z - y_0\tanh y_0$ is smooth in the level $z$."),
        ],
    },
}

SECTIONS = [
    {
        "id": "sinusoid",
        "title": "A sinusoid in, a sinusoid out",
        "blocks": [
            ("plain", r"""
Chapter 6 found the weights the best bound puts on the future and their Laplace transform $\tilde w$. Apply the theorem to the simplest moving cost, a sine wave $\gamma(t) = \operatorname{Re}(\Gamma e^{i\omega t})$ at angular frequency $\omega$, a period of $2\pi/\omega$ time units. A weighted average of a sine wave is a sine wave at the same frequency, so the first-order bound is one too, and two numbers describe it: how large its swing is next to the per-moment response $B'(c_0)\gamma$, and how far ahead of that response it runs. Both come from one complex number, the transform at $\lambda = -i\omega$:

$$\beta(t) = \operatorname{Re}\bigl(B'(c_0)\,\tilde w(-i\omega)\,\Gamma e^{i\omega t}\bigr).$$

The bound's swing is $|\tilde w(-i\omega)|$ times the per-moment swing, and it leads the per-moment response by the phase $\arg\tilde w(-i\omega)$. Before the plate shows them: at $\omega = 8$, a period of $\pi/4$ time units, how many degrees ahead do you think the bound runs?
"""),
            ("plate", "wave"),
            ("plain", r"""
At every frequency $\omega > 0$, the swing is less than the per-moment swing and the lead lies between $0^\circ$ and $90^\circ$: that is {{ref:cor:transfer}}. (At $\omega = 0$ the gain is 1 and the lead 0.) At $c_0 = 0.1$ and $\omega = 8$, the closed form gives a swing of {{T:tab_sinusoid:5:2}} of the per-moment swing and a lead of {{T:tab_sinusoid:5:3}}°, and the paper's dynamic program measures {{T:tab_sinusoid:5:4}} and {{T:tab_sinusoid:5:5}}°; chapter 9 covers that experiment, “{{claim:exp:sinusoid}}.” There, the per-moment rule's swing is {{PerMomentTooLargeAtEight}} times the best bound's measured swing, and it lags the best bound by {{PerMomentLateAtEight}}°.

Which way is ahead? $B'(c_0) < 0$, so the per-moment response is the cost turned upside down: the bound falls when the cost rises. The first-order bound leads that inverted curve, so it starts to fall before the cost starts to rise.

A lead of $\varphi$ degrees at frequency $\omega$ is a lead in time of $\varphi$ in radians divided by $\omega$. The plate's readings show that time: it is largest for slow waves, where it approaches the mean look-ahead of the next section, and it falls as the frequency rises, while the lead in degrees can first rise and then fall (at $c_0 = 1$ it passes $45^\circ$ and comes back, as section 3 shows). That the lead in time falls, and stays below the mean look-ahead, is what the page computes on every cost it offers; the paper doesn't state it.
"""),
            ("table", "tab:sinusoid"),
            ("figure", "transfer"),
            ("plain", r"""
Why the swing shrinks and the lead is positive: each term of the kernel's series is a decaying exponential, and the transform of each is a simple term in the first quadrant of the complex plane. The proof is four steps; the plate beside each draws the terms as arrows.
"""),
            ("strip", "transfer"),
            ("exact", "470-485", "The paper's corollary and the paragraph after it"),
            ("exact", "1460-1465||phases.", "The proof, from Appendix A"),
            ("limits", r"""
**What the corollary says, and what it doesn't.** It describes $\beta$, the first-order response, so it is about small swings around a constant cost, the theorem's setting; Table 1 checks it at $c_0 = 0.1$ and $\varepsilon = 0.01$. The lead is measured against the per-moment response $B'(c_0)\gamma$, not against the cost.
"""),
        ],
    },
    {
        "id": "look-ahead",
        "title": "How far ahead the bound looks",
        "blocks": [
            ("plain", r"""
{{ref:cor:limits}} takes three limits of the closed form. Two of them are about slow changes and the kernel's mean; the third, for fast changes, is the next section.

(a) $\tilde w(0) = 1$, so a change that is slow next to the kernel is averaged to its present value, which is what the per-moment rule does.

(b) The kernel's mean, the average time ahead that the bound looks, has a closed form:

$$m(c_0) = -\tilde w'(0) = c_0\Bigl[\tfrac12\sinh 2b_0 - b_0 + 2b_0^2\tanh b_0\Bigr] = \frac12 + \frac{2b_0(b_0\tanh b_0 - 1)}{\sinh 2b_0 + 2b_0}.$$

It tends to $\tfrac12$ as time becomes free ($c_0 \to 0$) and to 0 as time becomes very expensive. Its largest value over all costs, found numerically rather than proved, is about {{MaxLookAhead}} time units, at $c_0 \approx$ {{MaxLookAheadCost}}. At $c_0 = 0.1$, the bound looks {{LookAheadTenth}} time units ahead, against a mean decision time of {{DecisionTimeTenth}}.

A guess first: when time is nearly free and decisions take longer and longer, how far ahead does the bound look?
"""),
            ("plate", "lookahead"),
            ("plain", r"""
Chapter 6's second description of the kernel explains the bottom chart. The look-ahead is the mean decision time from the start law $\pi_0(y) = 4c_0\cosh^2 y$, whose weight is concentrated within about a unit of the bound. When time is cheap, a decision from 0 takes $b_0\tanh b_0$, which grows without bound as $c_0 \to 0$, but almost none of $\pi_0$'s weight is near 0: the distance $b_0 - Y_0$ is close to exponential with rate 2, and covering it at a drift near 1 takes about half a time unit. The proof is four steps.
"""),
            ("strip", "limits"),
            ("plain", r"""
Part (b) ends with a rule of thumb: for a cost that changes slowly and nearly linearly over the decision's time scale, the best bound at $t$ is, to first order, close to the per-moment bound for the cost at $t + m(c_0)$. Then only the kernel's mean matters. Away from that case, its shape matters too: the kernel puts heavy weight on the next instant and has a long, thin tail, which a single shift can't copy. The time lead in the first plate shows one sign of this: on the page's computation (not a result of the paper), it stays below $m(c_0)$ at every frequency and falls as the frequency rises, so a shift by $m(c_0)$ overshoots any wave that isn't slow.

Here is the shift on the schedule you chose on the contents page, in the form the paper tests on its held-out schedules, $B(c(t + m(c(t))))$.
"""),
            ("plate", "shift"),
            ("plain", r"""
The plate compares bounds; the paper compares rewards. On its {{HeldNoDeadlineCount}} held-out schedules without a deadline, shifting the per-moment rule by the mean look-ahead lost more reward than not shifting it on {{HeldShiftMeanWorse}}. Chapter 10 covers that test, “{{claim:exp:heldout}}.”
"""),
            ("exact", "487-516", "The paper's corollary and the paragraph after it"),
            ("exact", r"1465-1471|For \cref{cor:limits}(a)|numerically.", "The proof of (a) and (b), from Appendix A"),
        ],
    },
    {
        "id": "half",
        "title": "Fast changes are half-integrated",
        "blocks": [
            ("plain", r"""
Part (c) of {{ref:cor:limits}} is about fast changes. As $\omega \to \infty$,

$$|\tilde w(-i\omega)| \sim 2c_0\cosh^2 b_0\sqrt{2/\omega}, \qquad \arg\tilde w(-i\omega) \to 45^\circ.$$

The swing falls like $\omega^{-1/2}$, not like $\omega^{-1}$, and the lead tends to $45^\circ$. Both mark a half-integration. Integrating a wave over time divides its swing by $\omega$ and turns it by $90^\circ$; the kernel does half of each, because near $s = 0$ it behaves like $s^{-1/2}$. So fast changes in the cost are smoothed, not ignored.

"Tends to" is the whole claim about the lead. It isn't capped at $45^\circ$: at larger costs, the lead passes $45^\circ$ at high frequencies and then comes back to it, and step 3 of the plate shows by how much. What falls steadily as the frequency rises, on every cost the page computes, is the lead in time; that is a computation, not a result of the paper.
"""),
            ("strip", "half"),
            ("exact", "513-515|Part (c)|ignored.,1471-1472|For (c)|", "The paper's words on part (c), and its proof from Appendix A"),
        ],
    },
    {
        "id": "reward",
        "title": "Why the reward barely moves",
        "blocks": [
            ("plain", r"""
The chapter's last two claims change the question from where the bound sits to how much reward a misplaced bound loses. Start with a constant cost $c$ and a flat bound $b$, with a start at 0. It earns

$$R(b) = g(b) - c\,b\tanh b,$$

the chance of being right, $g(b) = 1/(1 + e^{-2b})$, less the cost of the mean decision time $b\tanh b$. The best flat bound $B(c)$ sits at the peak, where the curve is flat, so a small miss costs little: in the exercises you show that $R''(B) = -2c$, so a miss of $\delta$ costs about $c\,\delta^2$.

A guess first: if missing the peak by 0.1 loses some reward, how much does missing it by 0.2 lose?
"""),
            ("plate", "reward"),
            ("plain", r"""
{{ref:prop:loss}} makes this hold uniformly over rules when the cost moves a little around a constant. Fix a start $y_0$ below $b_0$ and a constant $a$. Then, for all small $\varepsilon$, every policy that stops when $Y$ first reaches a continuous bound within $a|\varepsilon|$ of $b_0$ earns at most $C\varepsilon^2$ less than the best policy for the cost $c_0 + \varepsilon\gamma$, for one constant $C$.

The per-moment rule and the first-order bound $b_0 + \varepsilon\beta$ of chapter 6 both stay within $O(\varepsilon)$ of $b_0$, so both lose $O(\varepsilon^2)$; so does the weighted look-ahead of chapter 8. The proposition bounds the loss; it doesn't say which rule loses less. The proof is four steps.
"""),
            ("strip", "loss"),
            ("plain", r"""
Here are both rules on your schedule. Each policy is scored by the forward computation chapter 9 describes: the chance of each decision time is pushed forward on the evidence grid, with no sampling. The page writes your schedule as a change around its cost at time 0, $c(0) + \varepsilon\,(c(t) - c(0))$, and shrinks $\varepsilon$; the proposition then applies with $c_0 = c(0)$ and $\gamma = c - c(0)$, when $\gamma$ is bounded. The plate is a finite version of the proposition's setting: a grid, a forced choice at time 14, and rules moved in for checking every 0.01.
"""),
            ("plate", "loss"),
            ("plain", r"""
Read the slope-2 line as a reference for the order, not as a ceiling. The proposition says the loss is at most a constant times $\varepsilon^2$ for small $\varepsilon$, under its hypotheses; it gives no value for the constant and doesn't say the loss falls at exactly that rate. The first-order bound misses the best bound by $O(\varepsilon^2)$ for a smooth change, so a loss quadratic in the miss would make it lose order $\varepsilon^4$, and on most schedules its loss falls below the display cutoff within a few halvings. The paper measures the weighted rule's order on one smooth shape at {{ScalingWbOrderLow}} on one grid and {{ScalingWbOrderHigh}} on another, a measurement over a short range rather than a proof; chapter 10 covers it, in “{{claim:exp:loss-scaling}}.”
"""),
            ("exact", "540-557", "The paper's proposition and the paragraphs around it"),
            ("exact", "1515-1534", "The proof, from Appendix A"),
            ("limits", r"""
**What the proposition covers, and what it doesn't.** Small, bounded changes around a positive constant cost, in the paper's continuous-time setting on an infinite horizon; a fixed start below $b_0$; and continuous bounds that stay within a constant times $\varepsilon$ of $b_0$. It puts every such rule under the same order; it doesn't rank them. Large steps and deadlines lie outside it, since there a rule's bound can be far from $b_0$. The plate above checks it on a grid with a forced choice at time 14, which the proposition doesn't cover; there, the first-order bound is clipped at 0 for large changes, and a bound of 0 stops every trial still undecided.
"""),
        ],
    },
    {
        "id": "conjecture",
        "title": "How much each rule loses: a conjecture",
        "blocks": [
            ("md", r"""
**This section is about a conjecture.** The paper states {{ref:conj:loss}} without proof. It checks the formula's constant against two exact facts and tests the formula numerically in {{ref:sec:loss-check}}, which chapter 10 covers.
"""),
            ("plain", r"""
{{ref:conj:loss}} is a sharper statement than {{ref:prop:loss}}, and the paper doesn't prove it. Let $f$ be bounded and Lipschitz. A policy whose bound misses the best bound by $\eta = \varepsilon f$ should lose

$$\E\bigl[c(\hat\tau)\,\eta(\hat\tau)^2\bigr]$$

of reward, up to $o(\varepsilon^2)$, where $\hat\tau$ is its decision time. In words: the cost of time at the moment of decision, times the squared distance from the best bound then, averaged over when decisions happen.

The constant agrees with two exact facts. At the bound, approached from the continuation side, the waiting value has second derivative $(V - g)_{yy} = 2c(t)$, so stopping a distance $\eta$ short of the bound gives up about $c(t)\,\eta^2$. And at a constant cost, the flat bound's reward has curvature exactly $-2c$ at its peak, so a flat miss of $\delta$ costs about $c\,\delta^2$, which is what the formula gives when $\eta \equiv \delta$.

Two cautions. The conjecture is about a miss of fixed shape $\varepsilon f$, but the rules' misses change shape as $\varepsilon$ shrinks, so it doesn't by itself say how much less one rule loses than another. And the orders the paper gives for the rules come from a heuristic: a loss quadratic in the miss would make the per-moment rule lose order $\varepsilon^2$ and a rule that misses by $O(\varepsilon^2)$ lose order $\varepsilon^4$.

On your schedule, the plate puts the conjecture's prediction for each rule beside the loss the page scores.
"""),
            ("plate", "conj"),
            ("plain", r"""
In the paper's Table 8, the formula overestimates the per-moment rule's loss by {{LossPmLow}} to {{LossPmHigh}}% for smooth schedules and steps up to threefold, and by {{LossPmSixteen}}% for 16-fold steps, where the bound's error is no longer small. As the paper says, that table tests the formula for the per-moment rule but says little about the weighted rule: at the smallest change in each family, most of the weighted rule's predicted loss comes from late times, where the best bound collapses toward the forced choice at time 10 and the rules, which ignore it, don't. The plate's late-share reading shows whether the same happens for the first-order bound on your schedule, with the forced choice at 14. Separately, a loss close to the baseline loss of the grid and horizon makes any ratio unreliable, which the plate marks with hollow dots. Chapter 10 tests the formula as the paper does, in “{{claim:exp:loss-formula}}” and “{{claim:exp:loss-scaling}}.”
"""),
            ("exact", "559-577", "The paper's conjecture and the paragraph after it"),
            ("limits", r"""
**What is proved, and what isn't.** Proved: every rule within $O(\varepsilon)$ of $b_0$ loses $O(\varepsilon^2)$ ({{ref:prop:loss}}). Conjectured: the leading term, $\E[c(\hat\tau)\eta(\hat\tau)^2]$ ({{ref:conj:loss}}). Heuristic, and measured rather than proved: the fourth-order loss of a rule that misses by $O(\varepsilon^2)$.
"""),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's four highlighted. The transfer function ({{ref:cor:transfer}}) uses {{ref:thm:main}} and {{ref:lem:kernel}} from chapter 6. The limits ({{ref:cor:limits}}) use {{ref:lem:kernel}}, the transfer function, and the constant-cost equation of chapter 3; they reach {{ref:thm:main}} only through the transfer function. {{ref:prop:loss}} uses the band around the bound ({{ref:lem:structure}}, chapter 4), the constant-cost equation, and smooth fit ({{ref:prop:regularity}}, chapter 5); {{ref:conj:loss}} uses {{ref:prop:loss}} and {{ref:prop:rule}} (chapter 8). In turn, the transfer function is used in the proof of {{ref:prop:rule}} (chapter 8) and checked by the sinusoid experiment (chapter 9); the look-ahead's limits are behind the shift-by-the-mean rule of the held-out test (chapter 10); the loss bound is used by chapter 10's finding that the per-moment rule is close to optimal in reward, and with the conjecture it is what chapter 10's loss measurements test; and the two corollaries and the conjecture feed four of chapter 12's closing claims: the urgency signal's lead, its size for a real task, what moment-by-moment control would have to compute, and the paper's limitations.
"""),
            ("map", "cor:transfer"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Why is a positive phase a lead and not a lag?",
                 r"""
With $\tilde w(-i\omega) = |\tilde w|e^{i\phi}$, the first-order response is $\operatorname{Re}(B'(c_0)\,|\tilde w|\,\Gamma\,e^{i(\omega t + \phi)})$: the per-moment response's shape, scaled by $|\tilde w|$, evaluated at time $t + \phi/\omega$. So the bound does now what the per-moment response will do $\phi/\omega$ later. Why $\phi > 0$: every term of the series, $a_j/(\alpha_j - i\omega)$, has a positive imaginary part (step 3). Looking only forward isn't enough by itself: a kernel with all its weight at one delay could shift a sinusoid by any phase.
"""),
                (r"Read Table 1 at $\omega = 8$: what are the closed form's swing and lead, and what does the per-moment rule get wrong there?",
                 r"""
The closed form gives a swing of {{T:tab_sinusoid:5:2}} of the per-moment swing and a lead of {{T:tab_sinusoid:5:3}}°. Measured on the dynamic program, in the experiment chapter 9 covers, the per-moment rule's swing there is {{PerMomentTooLargeAtEight}} times the optimal bound's, and it lags the optimal bound by {{PerMomentLateAtEight}}°.
"""),
                (r"The bound leads “the per-moment response.” Does it lead the cost?",
                 r"""
$B'(c_0) < 0$, so the per-moment response is the cost turned upside down: the bound falls when the cost rises. The first-order bound leads that inverted curve. {{ref:sec:discussion}} turns this around for an urgency signal $U = a/b$, which rises with the cost: to first order, $\delta U/U = -\delta b/b_0$, so $U$ leads the cost itself by the same phase ({{claim:claim:urgency}}).
"""),
                (r"Derive the first form of $m(c_0)$ from $m = \int_0^{b_0}4c_0\cosh^2 y\,(b_0\tanh b_0 - y\tanh y)\,dy$.",
                 r"""
Write $b = b_0$, $c = c_0$. First part: $4c\,b\tanh b\int_0^b\cosh^2 = b\tanh b$, since $4c\int_0^b\cosh^2 = 1$. Second part: $4c\int_0^b y\tanh y\cosh^2 y\,dy = 2c\int_0^b y\sinh 2y\,dy = c\,(b\cosh 2b - \tfrac12\sinh 2b)$. So $m = b\tanh b - c\,(b\cosh 2b - \tfrac12\sinh 2b)$. Replace $b\tanh b$ by $c\,(\sinh 2b + 2b)\,b\tanh b$ (the constant-cost equation), use $\sinh 2b\cdot b\tanh b = 2b\sinh^2 b$ and $2b\sinh^2 b - b\cosh 2b = -b$: $m = c\,[\tfrac12\sinh 2b - b + 2b^2\tanh b]$, the first form of {{ref:eq:mean-look-ahead}}.
"""),
                (r"Use the second form, $m = \tfrac12 + 2b_0(b_0\tanh b_0 - 1)/(\sinh 2b_0 + 2b_0)$, to see why $m \to \tfrac12$ as $c_0 \to 0$.",
                 r"""
As $c_0 \to 0$, $b_0 \to \infty$. The numerator $2b_0(b_0\tanh b_0 - 1)$ grows like $2b_0^2$, but the denominator grows like $e^{2b_0}/2$, so the fraction goes to 0 and $m \to \tfrac12$.
"""),
                (r"The paper says the bound at $t$ is close to the per-moment bound for the cost at $t + m(c_0)$. Why then does shifting the per-moment rule by the mean look-ahead do worse than not shifting on many held-out schedules?",
                 r"""
The statement is for a cost that changes slowly and nearly linearly over the decision's time scale; there, only the kernel's mean matters, to first order. Away from that case, the kernel's shape matters: it puts heavy weight on the next instant ($s^{-1/2}$ near 0) and has a long thin tail, which a single shift can't mimic. The paper reports one count over all families without a deadline, with no breakdown by family: on the {{HeldNoDeadlineCount}} held-out schedules without a deadline, the shift by the mean was worse than no shift on {{HeldShiftMeanWorse}}; chapter 10 covers that test.
"""),
                (r"What does “half-integration” mean here?",
                 r"""
Integration in time divides a sinusoid's amplitude by $\omega$ and delays it by $90^\circ$. A kernel that behaves like $s^{-1/2}$ near $s = 0$ acts like a fractional integral of order $\tfrac12$: the gain falls like $\omega^{-1/2}$ and the phase tends to $45^\circ$, half of $90^\circ$. (Here it is a lead, because the kernel averages the future.) So fast cost fluctuations are damped, but much less than a full average over a fixed window would damp them.
"""),
                (r"For a constant cost and a start at 0, show that the reward of a flat bound $R(b) = g(b) - c\,b\tanh b$ has $R''(B) = -2c$ at the optimum, and say what that means for a miss $\delta$.",
                 r"""
$R'(b) = \sech^2 b\,[\tfrac12 - c\,(\tfrac12\sinh 2b + b)]$. At $b = B$ the bracket is 0, so $R''(B)$ is $\sech^2 B$ times the bracket's derivative, $-c\,(\cosh 2B + 1) = -2c\cosh^2 B$. Hence $R''(B) = -2c$, and $R(B + \delta) = R(B) - c\,\delta^2 + o(\delta^2)$: a miss of $\delta$ costs about $c\,\delta^2$.
"""),
                (r"Does {{ref:prop:loss}} show that the weighted look-ahead loses less than the per-moment rule?",
                 r"""
No. It puts both under the same $C\varepsilon^2$ ceiling. Which loses less is a measurement (chapter 10) and, for the leading constant, a conjecture ({{ref:conj:loss}}).
"""),
                (r"Check the formula of {{ref:conj:loss}} for a constant cost and a flat bound that misses by $\delta$.",
                 r"""
With $c$ constant and $\eta \equiv \delta$, the formula gives $\E[c\,\delta^2] = c\,\delta^2$. The exact loss of a flat bound $B + \delta$ is $R(B) - R(B + \delta) = c\,\delta^2 + o(\delta^2)$ (exercise 8). They agree.
"""),
                (r"Why can't the conjecture, even if proved, rank the two rules by itself?",
                 r"""
It is stated for misses of the form $\varepsilon f$ with $f$ fixed, bounded, and Lipschitz. The per-moment rule's miss is of that form only to first order ($\varepsilon B'(c_0)(\gamma - w \star \gamma)$ plus a smaller remainder, with $f$ Lipschitz when $\gamma$ is), so applying the formula to it would also need control of how much that remainder changes the reward. The weighted rule's miss is $O(\varepsilon^2)$ for a smooth change and changes shape with $\varepsilon$; the conjecture gives no error bound that is uniform over such shapes, and an $o(\varepsilon^2)$ error term alone can't show that a loss is of order $\varepsilon^4$. Comparing the two needs more than the conjecture; the paper measures it.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The bound rises before the cost rises.”",
                 r"It *falls* before the cost rises. The lead is relative to the per-moment response, which moves opposite to the cost."),
                (r"“A smaller swing means the bound ignores fast changes.”",
                 r"The swing falls only like $\omega^{-1/2}$ ({{ref:cor:limits}}, part (c)): fast changes are smoothed, not ignored."),
                (r"“The bound looks exactly $m(c_0)$ ahead.”",
                 r"$m(c_0)$ is the kernel's mean. The bound uses the whole kernel, and the held-out test shows the shape matters."),
                (r"“The maximum {{MaxLookAhead}} is proved.”",
                 r"It is found numerically from the closed form, and this page finds it again by the same scan. The limits $\tfrac12$ and 0 are proved."),
                (r"“The look-ahead is about as long as a decision.”",
                 r"Much shorter when time is cheap: at $c_0 = 0.1$, {{LookAheadTenth}} against a mean decision time of {{DecisionTimeTenth}}, and the gap grows without bound as $c_0 \to 0$."),
                (r"“Second-order loss means the per-moment rule is optimal to first order.”",
                 r"Its *reward* is optimal to first order; its *bound* is not ({{claim:claim:pm-order-eps}}), unless the change $\gamma$ is constant ({{ref:prop:rule}}). The two statements are about different things."),
                (r"“The weighted rule's loss is proved to be fourth order.”",
                 r"It is a heuristic. Measured, its effective order over a short range was {{ScalingWbOrderLow}} on one grid and {{ScalingWbOrderHigh}} on the other, consistent with four but not a proof ({{claim:exp:loss-scaling}})."),
                (r"“The loss formula holds.”",
                 r"It is a conjecture. It overestimates the per-moment rule's losses by {{LossPmLow}} to {{LossPmHigh}}% for modest changes, and by {{LossPmSixteen}}% for 16-fold steps ({{claim:exp:loss-formula}})."),
            ]),
        ],
    },
]
