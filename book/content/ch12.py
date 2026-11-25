"""Chapter 12: the prediction, the prior work, and what's open.

Text uses $...$ for math and {{Macro}} for numbers from paper/generated/numbers.tex. Blocks:
("md", text) is always shown; ("plain", text) is the book's own words (Plain and Both);
("exact", "a-b|start|end,...", heading) is the paper's text at those lines of main.tex (Exact and Both);
("plate", id) and ("strip", id) place a live plate or a proof strip; ("qs", [(question, answer)]),
("miss", [(misreading, correction)]), and ("limits", text) close a section.
"""

CHAPTER = {
    "slug": "open",
    "num": 12,
    "title": "The prediction, the prior work, and what's open",
    "full": "The prediction, the prior work, and what's open: urgency, novelty, limitations, and the code",
    "leaf": 13,
    "finding": "An urgency signal that follows the best bound should move before a small, known change in the cost of time, not with it; the paper argues this but has no data.",
    "readings": [
        ("PalmerLead", "the predicted lead, in milliseconds, of the urgency signal over a slow ramp in the cost, for the mean observer of one random-dot task"),
        ("PalmerDegOneHz", "the predicted lead, in degrees, over a cost that rises and falls once a second, for the same mean observer"),
        ("MaxLookAhead", "the longest mean look-ahead over all costs, in time units (found numerically)"),
    ],
    "hero": {
        "aria": "A slow ramp and three sine waves in the cost of time, each with the urgency signal running ahead of it by the predicted lead in milliseconds",
        "caption": r"""The mean observer of Palmer, Huk, and Shadlen (2005) at 6.4% coherence, where one time unit is {{PalmerT}} ms and the fitted bound implies a constant cost of {{PalmerCost}}. A small change in the cost of time (orange; the per-moment urgency moves with it) and the first-order urgency signal $a/b$ (green), each as a share of the per-moment change: a slow, steady rise (a 1.5-second window of a straight line that continues past both edges, the slow-ramp limit), then sine waves at 0.5, 1, and 2 Hz. The arrows are the leads the paper predicts: about {{PalmerLead}} ms for the ramp, and {{PalmerLeadMsHalfHz}}, {{PalmerLeadMsOneHz}}, and {{PalmerLeadMsTwoHz}} ms for the waves.""",
        "still": 0,
    },
    "intro": r"""
An urgency signal that follows the best bound should move before a small, known change in the cost of time, not with it; the paper argues this but has no data. This chapter covers the paper's last steps outside the mathematics: that prediction and its size for one real task, what moment-by-moment control of the bound would have to compute, what in the paper is new and what was known before, the limitations the paper states, and where its code is.

Two cautions hold on every page. The prediction is a formal consequence of the first-order theory, for small changes on a known schedule; it is not a theorem, and the paper reports no test of it. And the paper's claims of novelty are narrow: each carries “to our knowledge,” and the book quotes the paper's own sentences for them.
""",
}

# where each of this chapter's claims is taught, for the claim map's links
MAP_LINKS = {"claim:urgency": "urgency", "claim:palmer-scale": "palmer", "claim:smith-weakness": "control",
             "claim:novelty": "novelty", "claim:limitations": "open", "claim:code-and-data": "code"}

# which groups of checks in tools/checks/ch12.mjs stand behind each plate
CHECKS = {
    "lead": ["kernel", "ramp", "wave", "words"], "argument": ["gate", "ramp", "wave", "words"],
    "yours": ["yours", "words"], "ms": ["palmer", "trap", "words"], "control": ["kernel", "control", "words"],
    "novelty": ["novelty", "words"],
}

PLATES = {
    "lead": {
        "title": "Ahead of the cost",
        "state": "computed",
        "state_text": "Computed in the page: the kernel's series and the closed-form transfer function",
        "caption": r"""A small change in the cost around $c_0$, drawn as its shape $\gamma(t)$ (orange), which is also the shape of the per-moment urgency's change. Green: the first-order urgency signal's change $\delta U/U$, as a share of the per-moment urgency's full change; to first order, that is $(w \star \gamma)(t)$. Ramp: $\gamma$ rises linearly from time 1.5 over the length you set (the chart shows the whole ramp when it lasts at most 3.6 time units, and otherwise the 6 time units around its halfway line), and each lead is read where a curve crosses the halfway line; $(w \star \gamma)$ is summed term by term from the series {{ref:eq:series}}, cut off after at most 4,000 terms, with a closed-form estimate of the rest where the ramp has begun. Sine wave: $\gamma(t) = \sin\omega t$ over two periods, with the urgency's swing and lead from $\tilde w(-i\omega)$, as in chapter 7.""",
        "wide": True,
    },
    "argument": {
        "title": "The argument, beside each step",
        "state": "computed",
        "state_text": "Computed in the page: one path sampled with a fixed seed, and the closed forms",
        "caption": r"""What each step is about. Step 1: one path of the evidence $X(t) = t + W(t)$ (gray, in Euler steps of 0.002 from 0, with a fixed seed; add `?seed=` to the address for another) against the per-moment bound $\pm B(c(t))$ for the paper's rising cost $c(t) = 0.1 + 0.8\max(t - 0.5, 0)$ (Figure 1(c)); below, the same path times $U = a/b$ against the fixed level $\pm a$, with $a = 1$. The crossing is found between two Euler steps by a straight line, added to both drawn paths, and can be at the upper or the lower level; the paths are drawn every fifth step. Step 2: $U/U_0 = b_0/b$ and its tangent at $b_0$. Step 3: a sine wave in the cost at $\omega = 2$, the first-order bound's move $\delta b/b_0$ (faint), and the urgency's move $\delta U/U_0$, each as a share of the per-moment swing. Step 4: a cost rising at a steady rate, the kernel drawn forward from one moment, and the kernel's average of the line. Step 5: the lead in degrees and in time against $\omega$, from $\tilde w(-i\omega)$; the peak above $45^\circ$, where there is one, is found by scanning $\omega$.""",
        "wide": False,
    },
    "yours": {
        "title": "Your schedule's urgency signal",
        "state": "computed",
        "state_text": "Computed in the page: dynamic programs on a grid, and the kernel from its series",
        "caption": r"""Your schedule written as $c_0 + \varepsilon\gamma(t)$, with $c_0$ its average over the window and $\gamma = c - c_0$, at the size $\varepsilon$ you pick. Top: the cost (on a log scale when it changes more than threefold). Bottom: the urgency $U = a/b$ for three bounds, each divided by the urgency $a/b_0$ of the program's own constant-cost bound, so $a$ cancels: the best bound, from a dynamic program that checks the evidence every 0.01 time units on a grid of 0.02 and runs 6 time units past the window (ink); the first-order bound $b_0 + \varepsilon\beta(t)$ (green); and the per-moment bound $B(c_0 + \varepsilon\gamma(t))$ (dashed). The two shortcuts are measured from the program's constant-cost bound, as in chapter 6, so the shift for checking every 0.01 cancels. Where a bound is 0 or below, $a/b$ has no value and its curve stops. The readings' largest gaps are both taken over the times where all three curves are defined. On a deadline, the plate draws, on a time axis that runs to the deadline, the urgency from the best bound (the program's own bound, computed for checking every 0.01) and from the per-moment bound (moved in by $0.5826\sqrt{0.01}$ for the same checking), up to the last moment the program's bound is above 0, both divided by the per-moment urgency at time 0. The vertical axis turns logarithmic when the urgency changes more than threefold.""",
        "wide": True,
    },
    "ms": {
        "title": "In milliseconds",
        "state": "computed",
        "state_text": "Computed in the page from the observer's drift and fitted bound, and the closed forms",
        "caption": r"""The mean observer of Palmer, Huk, and Shadlen (2005) at 6.4% coherence: drift $21 \times 0.064$ per second and noise variance 1 per second, so one time unit is $1/(21 \times 0.064)^2$ seconds. Its bound in the paper's units, $21 \times 0.064 \times 0.71$, is the paper's figure script's, where 0.71 is the observer's fitted bound in Palmer and colleagues' units; read as the best bound for a constant cost, it gives $c_0 = 1/(\sinh 2b + 2b)$. Top: the lead in milliseconds against the frequency $f$ of a sinusoidal cost: $\arg\tilde w(-i\omega)/\omega$ time units, with $\omega = 2\pi f$ times one time unit in seconds, times one time unit in milliseconds; the dashed line is the slow-ramp lead, $m(c_0)$ time units. Bottom: the lead in degrees (the axis runs to $90^\circ$ when a guess is above $50^\circ$). Dots: 0.5, 1, and 2 Hz, the paper's three frequencies. The last readings redo two of the calculations from the numbers as the paper prints them.""",
        "wide": False,
    },
    "control": {
        "title": "What control would have to compute",
        "state": "computed",
        "state_text": "Computed in the page from the kernel's series",
        "caption": r"""A cost of $c_0\,(1 + 0.25\,\gamma(t))$ for the shape you pick. Top: the cost (orange) and, from the moment $t$ you set (or that plays), the kernel $w(s)$ for $c_0$ drawn forward over the cost ahead, within the chart's window (green, scaled to fit; it rises like $s^{-1/2}$ toward $s = 0$), with its mean marked; when at least 0.5% of the weight lies past the right edge, a reading says how much, to the nearest percent, and a mean past the edge is marked by an arrow. Bottom: the constant-cost bound $B(c(t))$ for each moment's cost (dashed), and the fixed-kernel approximation, the fixed kernel's average of those bounds over all of its weight, $\int_0^\infty w(s)\,B(c(t + s))\,ds$ (green), drawn up to $t$; to first order in the size of the change, it is {{ref:thm:main}}'s bound. The average uses the kernel's 320 bins from chapter 6.""",
        "wide": True,
    },
    "novelty": {
        "title": "Credited, proved, or new?",
        "state": "exploration",
        "state_text": "From the paper's own sentences, in Sections 1 and 8",
        "caption": r"""Eight statements about the paper's results. Mark each, then show the paper's answers: each gives the reason in the paper's terms and the lines of main.tex, version 1.2, that say so. The middle answer means proved in the paper and not claimed as new; the paper proves its new results too. One statement has two right answers: the identities behind the exact equation appear, for smooth losses, in Campbell and Engelund (2026), and the paper proves them for the 0-1 loss without claiming them as new.""",
        "wide": False,
    },
}

STRIPS = {
    "argument": {
        "plate": "argument",
        "steps": [
            ("An urgency gain with a fixed boundary decides exactly when a moving bound would.",
             r"Smith and Ratcliff (2022): $U(t)X(t)$ reaches $\pm a$ exactly when $X(t)$ reaches $\pm a/U(t)$. So the urgency signal that implements a bound $b(t)$ is $\class{lit}{U(t) = a/b(t)}$, and the one that implements the best bound is the normative urgency signal."),
            ("To first order, the urgency moves opposite to the bound, by the same share.",
             r"With $b = b_0 + \delta b$, $U = a/b = (a/b_0)\,(1 - \delta b/b_0 + O(\delta b^2))$, so $\class{lit}{\delta U/U = -\delta b/b_0}$ to first order."),
            ("The bound falls ahead of a rising cost, so the urgency rises ahead of it.",
             r"By {{ref:thm:main}}, $\delta b = \varepsilon B'(c_0)\,(w \star \gamma)(t)$ to first order, with $B'(c_0) < 0$. So $\class{lit}{\delta U/U = \varepsilon\,\frac{|B'(c_0)|}{b_0}\,(w \star \gamma)(t)}$: the urgency moves with the kernel's average of the coming change, the same average that moves the bound ahead of the per-moment rule."),
            ("For a slow, nearly linear change, the lead is the mean look-ahead.",
             r"If $\gamma(t + s) = \gamma(t) + \gamma'(t)\,s$ over the kernel's reach, then $(w \star \gamma)(t) = \gamma(t) + \gamma'(t)\,m(c_0) = \class{lit}{\gamma(t + m(c_0))}$, since $\int_0^\infty w(s)\,ds = 1$ and $\int_0^\infty s\,w(s)\,ds = m(c_0)$ ({{ref:cor:limits}}(b)). The urgency runs $m(c_0)$ ahead of the cost."),
            (r"For a sinusoid, the lead is the transfer function's phase, which tends to $45^\circ$.",
             r"For $\gamma(t) = \operatorname{Re}(\Gamma e^{i\omega t})$, $(w \star \gamma)(t) = \operatorname{Re}(\tilde w(-i\omega)\,\Gamma e^{i\omega t})$ ({{ref:cor:transfer}}): the urgency runs $\arg\tilde w(-i\omega)$ ahead of the cost, a phase between $0^\circ$ and $90^\circ$, with $\class{lit}{\arg\tilde w(-i\omega) \to 45^\circ}$ as $\omega \to \infty$ ({{ref:cor:limits}}(c)). In time, the lead is that phase in radians divided by $\omega$."),
        ],
    },
}

SECTIONS = [
    {
        "id": "urgency",
        "title": "What an urgency signal should do",
        "blocks": [
            ("md", r"""
**This section is about a prediction.** The paper argues it formally from {{ref:thm:main}}, {{ref:cor:transfer}}, and {{ref:cor:limits}}, for small changes in the cost on a known schedule. It is not a theorem, and the paper has no data on it.
"""),
            ("plain", r"""
An *urgency signal* is another way to describe a bound that moves. Instead of the bound falling, the evidence is multiplied by a gain $U(t)$ that grows, and the decision is made when the gated evidence reaches a fixed level $a$. Smith and Ratcliff (2022) show that the two descriptions give exactly the same decisions: a gain $U(t)$ with a fixed boundary $a$ decides when an ungated process reaches $a/U(t)$. So the urgency signal that implements a bound $b(t)$ is $U(t) = a/b(t)$, and the one that implements the best bound is the *normative* urgency signal.

The paper's prediction is about how that signal moves when the cost of time changes in a known way. To first order, $\delta U/U = -\delta b/b_0$: when the bound falls, $U$ rises, so $U$ rises when the cost rises. And because the best bound moves ahead of the per-moment rule's, an urgency signal that implements it should lead the cost, not track it:

- for a small change that is slow and nearly linear, by the mean look-ahead $m(c_0)$, which is at most about {{MaxLookAhead}} time units and about $\tfrac12$ when time is cheap;
- for a small sinusoidal change, by the transfer function's phase, which tends to an eighth of a period ($45^\circ$) at high frequency, with a deviation that shrinks only like $\omega^{-1/2}$.

For other small changes, the first-order theory predicts the whole response, $\delta U/U = -\varepsilon B'(c_0)\,(w \star \gamma)(t)/b_0$, rather than a single lead. An urgency signal that followed the per-moment rule would show no lead at all: it would change at the moment the cost does.

Before the plate draws $U$: for a cost that ramps up slowly, over 8 time units, how far ahead of the per-moment urgency does it cross the halfway line?
"""),
            ("plate", "lead"),
            ("plain", r"""
On a slow ramp, $U$ crosses the halfway line very nearly $m(c_0)$ earlier than the per-moment urgency: the kernel's average of a straight line is the line a mean look-ahead later (step 4 below). On a short ramp, it crosses less far ahead, because the kernel puts much of its weight on the next instant. On the page's computation, as the ramp shortens, the lead at the halfway line falls toward the kernel's median, which is below its mean. That is why the lead of $m(c_0)$ is stated for slow changes only.

On a sine wave, the lead is a phase. In degrees, it tends to $45^\circ$ as the frequency grows, but not always steadily: at the plate's costs of 0.3 and 1 it dips on the way, and at 1 it passes $45^\circ$ and comes back to it, as chapter 7 shows. In time, it is the phase divided by $\omega$: it starts at $m(c_0)$ for slow waves and tends to 0. On the page's computation, at the plates' costs and at frequencies sampled from 0.05 to 3,000, the lead in time falls from each sample to the next; the paper states only the limits.
"""),
            ("plain", r"""
The argument behind the prediction is five steps: Smith and Ratcliff's (2022) equivalence, one line of algebra, and three results of chapters 6 and 7. It holds to first order in the size of the change, for a cost that changes in a known way.
"""),
            ("strip", "argument"),
            ("exact", "1207-1223", "The paper's words, in its discussion"),
            ("limits", r"""
**What the prediction says, and what it doesn't.** It says what an urgency signal that implements the best bound would do, to first order, for a small change in the cost of time on a known schedule. It doesn't say that any brain implements the best bound, and the paper reports no data on it. Large changes, discontinuous steps, and deadlines lie outside {{ref:thm:main}}, which the argument rests on.
"""),
        ],
    },
    {
        "id": "yours",
        "title": "On your schedule",
        "blocks": [
            ("plain", r"""
Here is the urgency signal on the schedule you chose on the contents page. The page writes your schedule as $c_0 + \varepsilon\gamma(t)$, with $c_0$ its average over the window, as chapter 6 does, and draws $U = a/b$ for three bounds at the size you pick: the best bound from the dynamic program (ink), the first-order bound $b_0 + \varepsilon\beta(t)$ (green), and the per-moment bound (dashed).

The paper's prediction is about the green curve. It describes the best bound's urgency where the green curve lies on the ink one; shrink the change and see where it does.
"""),
            ("plate", "yours"),
            ("plain", r"""
On a schedule that changes a lot, the first-order curve can be far from the best bound's, and at full size the first-order bound can reach 0, where $a/b$ has no value; the plate leaves a gap there. The rising cost grows without bound, so it is outside the theorem; the page computes it, and its curves are a computation only. A deadline isn't a small change of a constant cost: the plate draws the best bound's urgency up to the last moment the bound is above 0, and no first-order curve.
"""),
        ],
    },
    {
        "id": "palmer",
        "title": "In milliseconds",
        "blocks": [
            ("plain", r"""
The paper puts the prediction on a clock for one real task: random-dot motion at 6.4% coherence and the mean observer of Palmer, Huk, and Shadlen (2005), whose drift is $21 \times 0.064$ per second with noise variance 1 per second. One time unit, $\sigma^2/\mu^2$, is then {{PalmerT}} ms. Their fitted bound is {{PalmerBound}} in the paper's units; read as the best bound for a constant cost, that cost is {{PalmerCost}}, where the mean look-ahead is {{PalmerLookAhead}} time units.

Before the plate shows the paper's numbers: if this observer's cost of time rose slowly and steadily, how many milliseconds ahead should its urgency signal run? And for a cost that rises and falls once a second, how many degrees?
"""),
            ("plate", "ms"),
            ("plain", r"""
The paper's numbers: a slowly changing cost, such as a linear ramp, would be led by about {{PalmerLead}} ms. A cost oscillating at 0.5, 1, or 2 Hz would be led by about {{PalmerLeadMsHalfHz}}, {{PalmerLeadMsOneHz}}, or {{PalmerLeadMsTwoHz}} ms ({{PalmerDegHalfHz}}°, {{PalmerDegOneHz}}°, or {{PalmerDegTwoHz}}°), with a swing {{PalmerGainHalfHz}}, {{PalmerGainOneHz}}, or {{PalmerGainTwoHz}} times the per-moment one. As the frequency rises, the lead grows in degrees and shrinks in milliseconds.

The plate computes each of these from the observer's drift and fitted bound, not from the printed values, and the check script holds each to the paper's. That matters here, because the printed values are rounded and the leads are sensitive to them. Starting from the printed bound, {{PalmerBound}}, gives 216 ms for the ramp instead of {{PalmerLead}}; converting the printed {{PalmerDegHalfHz}}° at 0.5 Hz gives 161 ms instead of {{PalmerLeadMsHalfHz}}. The paper's figure script starts from Palmer and colleagues' fitted bound, 0.71 in their units, which the paper doesn't print: $21 \times 0.064 \times 0.71 = 0.95424$ in the paper's units.

The time unit scales as $1/\text{coherence}^2$, since the drift is proportional to coherence: at half the coherence, one time unit is four times as long. A task in which the reward rate or a penalty for slowness changes within a trial on a known schedule could test it. Kira, Zylberberg, and Shadlen (2025) show how time-dependent bounds can be estimated from choices and reaction times alone, and Kalburge and colleagues (2026) measured bounds directly, trial by trial, in a task in which the evidence's signal-to-noise ratio can change at a cued time within a trial. The paper notes that the same design, with a change in the cost of time at the cued moment, could measure the lead directly.
"""),
            ("exact", "1225-1238", "The paper's numbers, in its discussion"),
            ("limits", r"""
**What these numbers are.** Predicted leads, from the paper's reading of the mean observer's fit, for a kind of test the paper proposes and reports no data from: Palmer and colleagues' observers faced no changing cost of time, and their data set only the scale (the drift and the bound, with the noise fixed at variance 1 per second). The first-order theory behind the numbers is for small changes.
"""),
        ],
    },
    {
        "id": "control",
        "title": "What moment-by-moment control would have to compute",
        "blocks": [
            ("plain", r"""
Smith and Ratcliff (2025, p. 163) point out that Bellman-optimal bounds must be adjusted continuously, moment by moment, and count the lack of a model of how such control is maintained as a significant weakness of the collapsing-bounds account. The paper's answer is not such a model. It says what that control would have to compute: to first order, the bound at each moment is a fixed kernel's average of the constant-cost bounds for the costs ahead, looking at most about {{MaxLookAhead}} time units ahead on average.

The plate shows that computation. At the moment you set, the kernel for the constant cost $c_0$ is drawn forward over the cost ahead, and the average, with those weights, of the constant-cost bounds $B(c(t + s))$ is the *fixed-kernel approximation* of the bound at that moment. To first order in the size of the change, it is the best bound; at the plate's 25% change it is an approximation.
"""),
            ("plate", "control"),
            ("plain", r"""
The average reaches only a short way: half of the weight lies within a fraction of a time unit, and the mean is at most about {{MaxLookAhead}}. To first order in the size of the change, this average of bounds and {{ref:thm:main}}'s bound $b_0 + \varepsilon B'(c_0)\,(w \star \gamma)$ agree. The weighted look-ahead rule of chapter 8 does the same averaging with the kernel for its own level at each moment; on the paper's code, it is not faster than the dynamic program ({{claim:claim:not-faster|chapter 8}}). Whether a brain's bound does this is what the prediction in this chapter's first section could test; the paper has no data on it.
"""),
            ("exact", "128-131|It also bears", "The paper's words, in its introduction"),
            ("exact", "1192-1198|They also point|average.", "And in its related work"),
            ("limits", r"""
**Not a model of control.** The plate describes what the best bound computes, to first order, for a small change around a constant cost. It says nothing about how a brain would compute or maintain it.
"""),
        ],
    },
    {
        "id": "novelty",
        "title": "What is new, and what isn't",
        "blocks": [
            ("md", r"""
The paper states what is new in it narrowly, and the book keeps to its words. First, a self-test: for each statement, is it credited to others, proved in the paper but not claimed as new, or new to the paper's knowledge?
"""),
            ("plate", "novelty"),
            ("plain", r"""
**Credited to others.** Expanding the value-matching and smooth-fit conditions about an unperturbed free boundary is a standard formal procedure in the asymptotic analysis of American options (Fouque and colleagues). Stojanovic (1997) establishes the resulting perturbation formula in a weak sense, for regular free boundaries under perturbations of the source term: for elliptic obstacle problems on bounded domains, and for parabolic ones on finite cylinders, assuming in the parabolic case that the linearized problem has a unique solution. Here, the cost of time is that source term, and specializing his formula formally to this model at a constant cost gives the first-order coefficient of the bound as $-1/(2c_0)$ times the convolution of the future values of $\gamma$ with the survival flux at the unperturbed bound. So neither the technique nor the convolution form is new. The two identities behind the exact equation ({{ref:lem:envelope}}) appear, for smooth terminal losses, in Campbell and Engelund (2026), and in their symmetric infinite-horizon setting with smooth losses, their identities and smooth fit would also give a spatially integrated relation like the exact equation. And bounds that move with a known change are not new: Drugowitsch and colleagues (2012) computed optimal bounds for time-varying costs by backward induction, and Barendregt and colleagues (2022) find thresholds that anticipate a known drop in reward.

**Proved in the paper, not claimed as new.** Campbell and Engelund's hypotheses exclude the drift-diffusion model's 0-1 loss, which has a kink, so the paper proves the identities and the regularity directly, proves the exact equation ({{ref:prop:exact}}) for the 0-1 loss, and uses it to prove the first-order theorem. The paper lists the exact equation among its contributions, but its sentences on what is new don't claim it.

**New, to the paper's knowledge.** The kernel made explicit, as the density of the time to reach $b_0$ from a start drawn with density proportional to $\cosh^2 y$ on $[0, b_0]$, and through its Laplace transform ({{ref:lem:kernel}}); a proof of the expansion for the drift-diffusion model on an infinite horizon, outside the finite cylinders of Stojanovic's theorem, locally uniformly, through an exact equation with no derivative of the bound, with a rate when the change is Hölder continuous ({{ref:thm:main}}); the weighted look-ahead rule ({{ref:prop:rule}}); and the measurements. The paper proves the kernel's descriptions, the theorem, and the rule's first-order exactness too; these are both proved and claimed as new. Also to the paper's knowledge, none of the exact-solution work it reviews, which computes optimal bounds numerically or studies their structure, gives an analytic approximation of the optimal bound of a drift-diffusion model for small changes of general shape in the cost of time.

Each claim of novelty carries “to our knowledge” in the paper, and the book keeps the qualifier.
"""),
            ("exact", "195-201", "The paper's words, in its introduction"),
            ("exact", "1106-1108|All of these|in the cost of time.", "On the work that computes optimal bounds"),
            ("exact", "1122-1143", "On boundary sensitivity, from its related work"),
            ("exact", "1155-1173", "On smooth-loss sequential inference"),
            ("limits", r"""
**What the paper doesn't claim.** That the technique or the convolution form is new; that the exact equation is new; that the weighted look-ahead rule is faster than the dynamic program (on the paper's code it isn't) or optimal (it is first-order exact near a constant cost, {{ref:prop:rule}}); or that any of its novelty is certain.
"""),
        ],
    },
    {
        "id": "open",
        "title": "What the paper leaves open",
        "blocks": [
            ("plain", r"""
The paper's own list of limitations, in its order:

- The leading-order loss formula ({{ref:conj:loss}}) is a conjecture. {{ref:prop:loss}} bounds the loss of nearby rules by $O(\varepsilon^2)$ but doesn't give each rule's loss; {{ref:sec:loss-check}} checks the formula numerically.
- {{ref:thm:main}} gives a rate only when the change $\gamma$ is Hölder or Lipschitz, and its constant is not sharp. In the sweep of {{ref:tab:sweep}}, the fitted swing differs from the first-order prediction by about {{SweepSwingTenth}}% at $\varepsilon/c_0 = 0.1$ and {{SweepSwingSixTenths}}% at 0.6, but that measures only the swing, not the whole remainder. Discontinuous steps, deadlines, and large changes lie outside the theorem.
- The drift takes two values. Unknown reliability (through information time) and unequal rewards (through a per-bound envelope argument) are checked numerically, not proved.
- The paper treats a single decision with a cost of time, not a sequence of trials with a reward rate. With a reward rate, the cost of time is itself set by the policy.

Each is taught where it arises: the conjecture in chapter 7, the sweep in chapter 9 (“{{claim:exp:sweep}}”), and the two extensions in chapter 11.
"""),
            ("exact", "1240-1253", "The paper's limitations"),
        ],
    },
    {
        "id": "code",
        "title": "The code",
        "blocks": [
            ("plain", r"""
The paper's code computes the exact policies, the rules, the scoring, and every number, table, and figure in the paper, except the timings in {{ref:sec:rule}}, which come from runs on one computer. It is public, at [github.com/ryanjosephkamp/speed-accuracy-tradeoff](https://github.com/ryanjosephkamp/speed-accuracy-tradeoff), and this book is built against version 1.2 of the paper ([its source](https://github.com/ryanjosephkamp/speed-accuracy-tradeoff/tree/main/paper)).

Most numbers the book quotes are the paper's generated numbers or table cells, read from the files its code writes. The rest are values the paper types into its text (as an input, a setting, or a result, such as the relative tolerance of $10^{-5}$ in {{ref:sec:lopsided}}); values read from the paper's code and its results files at version 1.2, such as the observer's fitted bound of 0.71 in the paper's figure script; and arithmetic or computations of the page's own, which the book labels as its own. The plates recompute what they draw in the page, and a check script holds those computations to the generated numbers and, where the paper prints no number, to the paper's code at version 1.2; the line under each plate says how many of its checks pass. Typed values, such as the observer's drift of $21 \times 0.064$ per second, are quoted as the paper states them.
"""),
            ("exact", "1255-1257", "The paper's code and data"),
        ],
    },
    {
        "id": "map",
        "title": "Where this chapter sits",
        "blocks": [
            ("plain", r"""
The paper's claims and the places one uses another, with this chapter's six highlighted. The urgency prediction uses {{ref:thm:main}} (chapter 6) and the transfer function and its limits, {{ref:cor:transfer}} and {{ref:cor:limits}} (chapter 7). Its size for one real task uses the same two corollaries and the paper's units of evidence and time (chapter 2). What control would have to compute uses {{ref:thm:main}}, {{ref:cor:limits}}, and the weighted look-ahead rule (chapter 8). What is new rests on the exact equation, {{ref:prop:exact}} (chapter 5), on {{ref:lem:kernel}} and {{ref:thm:main}} (chapter 6), and on {{ref:prop:rule}} (chapter 8). The limitations name {{ref:conj:loss}} (chapter 7), {{ref:thm:main}}, the first-order sweep (chapter 9), and both extensions (chapter 11). The map draws no links to the code and data. No claim uses this chapter's: the paper ends here.
"""),
            ("map", "claim:urgency"),
        ],
    },
    {
        "id": "exercises",
        "title": "Exercises",
        "blocks": [
            ("md", "Worked answers are folded under each question. Nothing is gated."),
            ("qs", [
                (r"Show that $U = a/b$ gives $\delta U/U = -\delta b/b_0$ to first order.",
                 r"""
$U = a/b$, so $dU = -a\,db/b^2$ and $dU/U = -db/b$. At first order around $b_0$, $\delta U/U = -\delta b/b_0$. Since the bound falls when the cost rises, $U$ rises; and since $\delta b$ leads the per-moment response, $\delta U$ leads the cost by the same phase.
"""),
                (r"What would an urgency signal that implements the per-moment rule predict?",
                 r"""
No lead: it would track the cost through $a/B(c(t))$, changing at the moment the cost does. The difference between no lead and a lead of $m(c_0)$ time units for slow changes, or a phase that tends to $45^\circ$ for fast ones, is what an experiment could measure.
"""),
                (r"At high frequency, the phase lead tends to $45^\circ$. Does the lead in time grow too?",
                 r"""
No. A phase of $\phi$ radians at angular frequency $\omega$ is a time lead of $\phi/\omega$. As $\omega$ grows, $\phi$ tends to $45^\circ$, but $\omega$ grows without bound, so the time lead tends to 0. On the book's computation, at the plates' costs and at frequencies sampled from 0.05 to 3,000, the time lead also falls from each sample to the next, from $m(c_0)$ for slow waves; the paper states only the limit. The Palmer numbers show the pattern: {{PalmerDegHalfHz}}°, {{PalmerDegOneHz}}°, and {{PalmerDegTwoHz}}°, but {{PalmerLeadMsHalfHz}}, {{PalmerLeadMsOneHz}}, and {{PalmerLeadMsTwoHz}} ms, at 0.5, 1, and 2 Hz. And “tends to $45^\circ$” is not “at most $45^\circ$”: at large costs the phase passes $45^\circ$ at a finite frequency before it settles, as chapter 7 shows at $c_0 = 1$.
"""),
                (r"Convert the printed {{PalmerDegOneHz}}° at 1 Hz to milliseconds. Then do the same for {{PalmerDegHalfHz}}° at 0.5 Hz, and explain the result.",
                 r"""
At 1 Hz, a period is 1000 ms, so {{PalmerDegOneHz}}° is $1000 \times {{PalmerDegOneHz}}/360 \approx 103$ ms, the paper's {{PalmerLeadMsOneHz}}. At 0.5 Hz, a period is 2000 ms, so $2000 \times {{PalmerDegHalfHz}}/360 \approx 161$ ms, but the paper says {{PalmerLeadMsHalfHz}}. The paper's value comes from the unrounded phase (a little over {{PalmerDegHalfHz}}°); converting the rounded one loses a millisecond. That is why the book quotes the generated numbers and never recomputes from printed, rounded ones.
"""),
                (r"Why does recomputing the slow-ramp lead from the printed bound {{PalmerBound}} give 216 ms instead of {{PalmerLead}}?",
                 r"""
The paper's figure script starts from the bound $21 \times 0.064 \times 0.71 = 0.95424$, where 0.71 is Palmer and colleagues' fitted bound in their units, which the paper doesn't print. The cost, the look-ahead, and the lead all follow from that bound, and rounding it to {{PalmerBound}} moves the lead by about a millisecond. The plate in this section does both calculations.
"""),
                (r"Why does the time unit scale as $1/\text{coherence}^2$?",
                 r"""
The drift is proportional to coherence ($\mu = 21 \times \text{coherence}$ per second here), and the noise doesn't change, so $\sigma^2/\mu^2 \propto 1/\text{coherence}^2$: halving the coherence makes the time unit four times as long. A lead computed for the same schedule in the paper's units scales with it. But a cost that changes at a fixed rate in seconds, or a fixed cost per second, becomes a different schedule in the paper's units at another coherence, so its lead has to be recomputed, not just rescaled.
"""),
                (r"Someone asks whether the weighted look-ahead is a model of how the brain sets its bound. What is the accurate answer?",
                 r"""
No. It describes what a bound that tracks the optimum would have to compute: to first order, a fixed-weight average over a short stretch of the future. Whether any neural signal does that is the paper's prediction to test ({{claim:claim:urgency}}), and the paper has no data on it.
"""),
                (r"Specialized to this model, what does Stojanovic's formula give, and is it consistent with {{ref:thm:main}}?",
                 r"""
The paper states that it gives the first-order coefficient of the bound as $-1/(2c_0)$ times the convolution of $\gamma$'s future values with the survival flux $n$. Since $n = (\int n)\,w$ with $\int n = 1/(2c_0\cosh^2 b_0)$, that is $-\tfrac{1}{2c_0}\cdot\tfrac{1}{2c_0\cosh^2 b_0}\,(w \star \gamma) = B'(c_0)\,(w \star \gamma)$: {{ref:thm:main}}'s coefficient. The paper's own calculation in {{ref:sec:lopsided}}, in the symmetric case, reproduces it the same way. What the paper claims as new, to its knowledge, is the kernel made explicit and its transform, and the proof for this model on an infinite horizon with a rate.
"""),
                (r"A referee says: “Isn't this a short step from Campbell and Engelund?” Give the accurate answer.",
                 r"""
The paper's own answer: their Corollary 4.3 and identity (6.14) are the two identities of {{ref:lem:envelope}}, and with smooth fit they would give a spatially integrated relation like the exact equation in their symmetric infinite-horizon setting with smooth losses. But their hypotheses (a concave terminal loss, $C^2$ in general and $C^3$ for their time-inhomogeneous results, whose generator image is strictly monotone on each side of a point, and a $C^1$ cost with bounded $c'/c$) exclude the 0-1 loss of the drift-diffusion model, which has a kink. Their own boundary equation is a different, Peskir-type integral equation, and they do not linearize the boundary in a perturbation of the running cost. The paper proves the identities and the equation directly for the 0-1 loss, uses them to prove the first-order theorem, and computes the kernel and its transform from the exit-time law.
"""),
                (r"“Didn't people already know that bounds move before a known change?”",
                 r"""
Yes, qualitatively. Drugowitsch and colleagues (2012) computed optimal bounds for time-varying costs by backward induction, Barendregt and colleagues (2022) find thresholds that anticipate a known drop in reward, and the best bound in Figure 1, from backward induction, moves before the cost does. What the paper claims, to its knowledge, is an analytic first-order approximation for small changes of general shape, with the kernel explicit.
"""),
                (r"Why is the reward-rate setting harder?",
                 r"""
The paper says only that, with a reward rate, the cost of time is itself determined by the policy. In the standard reward-rate setting (background, not in the paper), waiting on this trial delays the next ones, so the cost of time is the reward rate itself, which depends on the policy being chosen. The cost is then an unknown to be solved for together with the bound (a fixed-point problem), not a given schedule.
"""),
                (r"Which numbers in the paper doesn't its code compute, and what does that mean for this book?",
                 r"""
The timings in {{ref:sec:rule}}, which come from the paper's runs on one computer. Everything else, the paper says, its code computes; most of it is written into the generated numbers and tables, and a few values are typed into the text, such as the relative tolerance of $10^{-5}$ in {{ref:sec:lopsided}}. The book reads the generated numbers from those files, quotes typed values as the paper states them, takes a few values from the code and its results files (such as the observer's fitted bound, 0.71, from the figure script, and the unrounded losses behind Table 12), and its check script holds the plates' computations to the generated numbers and the code.
"""),
            ]),
            ("md", "**Common misreadings.**"),
            ("miss", [
                (r"“The paper shows that the brain implements the optimal bound.”",
                 r"The paper has no data. It says what an urgency signal that implements the optimal bound should do."),
                (r"“The prediction is a theorem.”",
                 r"It is argued formally from {{ref:thm:main}}, {{ref:cor:transfer}}, and {{ref:cor:limits}}, to first order, for small changes on a known schedule. The paper calls it a testable prediction."),
                (r"“The lead is always the mean look-ahead.”",
                 r"Only for slow, nearly linear changes. For a sinusoid, the lead is the transfer function's phase, which tends to $45^\circ$ at high frequency, and in time it is shorter than $m(c_0)$."),
                (r"“The phase lead is at most $45^\circ$.”",
                 r"It tends to $45^\circ$ at high frequency. At large costs it passes $45^\circ$ at a finite frequency and comes back (chapter 7)."),
                (r"“{{PalmerLead}} ms is a measured lead.”",
                 r"It is a predicted lead, from the paper's reading of the mean observer's fit, for the kind of test the paper proposes: a cost of time that changes within a trial on a known schedule. The paper reports no data on such a lead."),
                (r"“Palmer's observers faced a changing cost of time.”",
                 r"Their data set the scale (the drift and the bound, with the noise fixed at variance 1 per second); the changing cost is hypothetical."),
                (r"“The paper solves Smith and Ratcliff's open problem.”",
                 r"It addresses part of it: what the control would compute, not how it is maintained."),
                (r"“The paper discovered that the first-order correction is a convolution of future costs.”",
                 r"Not new: Stojanovic's (1997) formula, specialized formally, already gives the convolution form. Neither the convolution form nor the perturbation technique is new."),
                (r"“The exact equation is new.”",
                 r"The paper proves it for the 0-1 loss and lists it as a contribution, but its sentences on what is new don't claim it. The paper notes that, in Campbell and Engelund's symmetric infinite-horizon setting with smooth losses, their identities and smooth fit would also give a relation like it."),
                (r"“The weighted look-ahead rule is a fast way to get the optimal bound.”",
                 r"On the paper's code, it is not faster than the dynamic program, and it is not the optimal bound: it is first-order exact near a constant cost ({{ref:prop:rule}}), which is not the same as optimal."),
                (r"“The novelty is certain.”",
                 r"Every sentence in the paper on what is new says “to our knowledge,” and the book keeps the qualifier."),
                (r"“The limitations are minor caveats.”",
                 r"They say which statements are theorems and which are a conjecture, formal arguments, or measurements, and which cases the theorem doesn't cover."),
                (r"“Everything in the paper is regenerated by the code.”",
                 r"The paper says its code computes everything except the timings. Most numbers are written into the generated files, and a few are typed into the paper's text."),
            ]),
        ],
    },
]
