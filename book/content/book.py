"""The book: its title page and its contents. A chapter is built when book/content/<module>.py exists; the rest
are listed as coming."""

TITLE = "Waiting, weighted"
SUBTITLE = "A crash course in the paper"
SHORT = "Waiting, weighted · Crash Course"

LEDE = r"""How the best moment to decide moves when time gets more expensive, worked through one result at a time on a cost schedule of your own. The figures are computed in the page from the paper's equations, and a check script holds the numbers to the paper's."""

DRAFT = r"""**Working draft.** Chapter 6 is the first chapter built; the others follow."""

SCHEDULE_INTRO = r"""Pick a schedule for the cost of time, or draw one. The book keeps it and uses it in every chapter. Under it is the best bound for your schedule, solved in this page by dynamic programming, beside the per-moment rule's bound."""

MAP_SLOT = (
    "The claim map",
    r"""Every claim in the paper and the places one uses another: 50 claims and 118 uses. Pick a way to draw it; your browser keeps the choice for every page of the book. A built chapter's claims link to the page that teaches them.""",
)

# number, title, one line, module
CHAPTERS = [
    (0, "How to read this book", "Your schedule, the five ideas each in one screen, and which of the paper's sentences are theorems.", "ch00"),
    (1, "The question, from the 2025 capstone", "The per-moment shortcut, Figure 1's four schedules, and where the bound sits before a rise.", "ch01"),
    (2, "The ideas you need", "Noisy evidence, belief, folding the problem in half, and two starts on the same noise.", "ch02"),
    (3, "The model", "What a decision earns, which costs the theory allows, the value of waiting, and the flat bound.", "ch03"),
    (4, "The best bound and its shape", "One level at each moment, a band it can't leave, and what starting later costs.", "ch04"),
    (5, "An exact equation for the bound", "The cost at the moment of decision, and why the equation has no derivative of the bound.", "ch05"),
    (6, "The kernel and the theorem", "The weights on the future, two ways to see them, their transform, and the first-order theorem.", "ch06"),
    (7, "What the kernel says", "The transfer function, how far ahead the bound looks, half-integration, and second-order loss.", "ch07"),
    (8, "The weighted look-ahead rule", "Averaging bounds instead of costs, a bound defined by itself, and why it is first-order exact.", "ch08"),
    (9, "How the paper measures", "The reference program, scoring without sampling, the monitoring shift, and the theory checked.", "ch09"),
    (10, "The rules on random schedules", "Ninety design schedules, the held-out set run once, five more rules, and a conjecture tested.", "ch10"),
    (11, "Unknown reliability and unequal rewards", "The rules in information time, and two bounds when the rewards differ.", "ch11"),
    (12, "The prediction, the prior work, and what's open", "What an urgency signal should do, what is new and what isn't, and the open questions.", "ch12"),
    ("A", "The proofs", "Every proof in the paper, in full, as steps you scrub.", "appA"),
    ("B", "The numerics", "The grids, the horizons, and how stable the numbers are.", "appB"),
]

# each chapter's ink (day, night): one hue per part of the book, for its thumb tab, its numeral, and its turn
PARTS = {
    "front": ("#2b5c8f", "#86b4e8"),    # 0 to 2: the question and the ideas it needs
    "model": ("#8a5a00", "#e2b04a"),    # 3 to 5: the model, the bound's shape, the exact equation
    "theory": ("#0a734f", "#2fd39a"),   # 6 to 8: the first-order theory (the look-ahead green)
    "tests": ("#7b3a8e", "#d09ae6"),    # 9 and 10: the experiments
    "beyond": ("#9a2f52", "#f290b0"),   # 11 and 12: the extensions, the prediction, and what's open
    "back": ("#4b525b", "#b5bcc5"),     # the appendices
}
INKS = {**{str(n): PARTS["front"] for n in (0, 1, 2)}, **{str(n): PARTS["model"] for n in (3, 4, 5)},
        **{str(n): PARTS["theory"] for n in (6, 7, 8)}, **{str(n): PARTS["tests"] for n in (9, 10)},
        **{str(n): PARTS["beyond"] for n in (11, 12)}, "A": PARTS["back"], "B": PARTS["back"]}
