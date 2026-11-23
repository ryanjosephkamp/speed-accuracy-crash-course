"""The book: its title page and its contents. A chapter with a "module" is built; the rest are listed."""

TITLE = "Waiting, weighted"
SUBTITLE = "A crash course in the paper"
SHORT = "Waiting, weighted · Crash Course"

LEDE = r"""How the best moment to decide moves when time gets more expensive, worked through one result at a time on a cost schedule of your own. The figures are computed in the page from the paper's equations, and a check script holds the numbers to the paper's."""

DRAFT = r"""**Working draft.** Chapter 6 is the first chapter built; the others follow."""

SCHEDULE_INTRO = r"""Pick a schedule for the cost of time, or draw one. The book keeps it and uses it in every chapter. Under it is the best bound for your schedule, solved in this page by dynamic programming, beside the per-moment rule's bound."""

MAP_SLOT = (
    "The claim map",
    r"""Every result in the paper and what it rests on, as one picture you can walk through, with the book's chapters along it. It arrives with the next chapters.""",
)

# number, title, one line, module (built chapters only)
CHAPTERS = [
    (0, "How to read this book", "Your schedule, the five ideas each in one screen, and which of the paper's sentences are theorems.", None),
    (1, "The question, from the 2025 capstone", "The per-moment shortcut, Figure 1's four schedules, and where the bound sits before a rise.", None),
    (2, "The ideas you need", "Noisy evidence, belief, folding the problem in half, and two starts on the same noise.", None),
    (3, "The model", "What a decision earns, which costs the theory allows, the value of waiting, and the flat bound.", None),
    (4, "The best bound and its shape", "One level at each moment, a band it can't leave, and what starting later costs.", None),
    (5, "An exact equation for the bound", "The cost at the moment of decision, and why the equation has no derivative of the bound.", None),
    (6, "The kernel and the theorem", "The weights on the future, two ways to see them, their transform, and the first-order theorem.", "ch06"),
    (7, "What the kernel says", "The transfer function, how far ahead the bound looks, half-integration, and second-order loss.", None),
    (8, "The weighted look-ahead rule", "Averaging bounds instead of costs, a bound defined by itself, and why it is first-order exact.", None),
    (9, "How the paper measures", "The reference program, scoring without sampling, the monitoring shift, and the theory checked.", None),
    (10, "The rules on random schedules", "Ninety design schedules, the held-out set run once, five more rules, and a conjecture tested.", None),
    (11, "Unknown reliability and unequal rewards", "The rules in information time, and two bounds when the rewards differ.", None),
    (12, "The prediction, the prior work, and what's open", "What an urgency signal should do, what is new and what isn't, and the open questions.", None),
    ("A", "The proofs", "Every proof in the paper, in full, as steps you scrub.", None),
    ("B", "The numerics", "The grids, the horizons, and how stable the numbers are.", None),
]
