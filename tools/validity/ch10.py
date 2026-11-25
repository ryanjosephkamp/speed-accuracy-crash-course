#!/usr/bin/env python3
"""What chapter 10 reads from the paper's code and results at its tag, and what that code computes on the page's
grid, so the page draws the paper's own data and its checks (tools/checks/ch10.mjs) hold its computations to the
code without typed-in numbers.

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch10.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ and experiments/ with git archive into a temporary folder, imports speed_accuracy and
experiments/common.py and families.py from there (numpy and scipy), and writes two files.

book/assets/js/ch10-data.js, the data the page draws, from experiments/results/ at the tag:
- "dev": the 90 development schedules (random_schedules.json, seed 2026), each with its family, its parameters,
  the exact policy's reward, and the per-moment and weighted rules' losses and largest bound errors;
- "held": the 210 held-out schedules (held_out.json, seed 20261111), each with its family, its parameters, the
  exact policy's reward, accuracy, and mean decision time ("ex"); the seven rules' results in the order of "rules"
  ("r"): for the per-moment and weighted rules, the loss, accuracy, mean decision time, and largest bound error before
  t = min(4, deadline), and for the other five the loss (the only result of theirs the paper's tables and figures
  use); and the tuned constant's bound ("x");
- "formula": the 36 rows of loss_formula.json (seed 7), and "scaling": loss_scaling.json.
The results files keep only a few parameters of each schedule (the smooth family keeps only c0), so the full
parameters are drawn again here from the generators' seeds in the generators' order (families.py), and each
schedule rebuilt from them is held to the paper's own schedule function at 2001 times, and to its stored name and
parameters.

tools/validity/ch10.json, for the checks:
- "costs": each schedule's cost from the paper's own function at a few times, to hold the page's rebuilt schedules
  to it;
- "pageGrid": the paper's code run on the page's grid (dt 0.01, h 0.02, bounds capped at 5) with the paper's
  horizon (a forced choice at t = 10, or at the deadline): the exact policy's reward, accuracy, and decision time,
  and the seven rules of experiments/held_out.py (its own cheap_policies and mean_look_ahead, read from its
  source; the tuned constant searched as experiments/common.py's best_fixed does, with the page grid's scorer),
  on the book's presets (each read from the same log-cost table as tools/validity/schedules.mjs gives the page's
  checks) and on some of the paper's own schedules;
- "scalingPage": Table 9's shape at its five amplitudes, and the constant cost, on the page's grid.
"""
import argparse
import io
import json
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent.parent
PAGE = dict(dt=0.01, h=0.02, cap=5.0)
TIMES = [0.0, 0.07, 0.3, 0.55, 1.0, 1.42, 2.0, 2.71, 3.5, 5.0, 6.3, 8.0, 9.9, 10.0]


# ---- the generators' draws, in families.py's order, kept as parameters ------------------------------------------

def p_smooth(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.02), np.log(0.5))))
    a = rng.uniform(-1, 1, 3) / 1.5
    om = rng.uniform(0.3, 6.0, 3)
    ph = rng.uniform(0, 2 * np.pi, 3)
    return dict(c0=c0, a=a.tolist(), om=om.tolist(), ph=ph.tolist())


def p_step(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.02), np.log(1.0))))
    r = float(np.exp(rng.uniform(-np.log(16), np.log(16))))
    t0 = float(rng.uniform(0.1, 2.0))
    return dict(c0=c0, c1=c0 * r, t0=t0)


def p_deadline(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.01), np.log(0.5))))
    T = float(rng.uniform(0.3, 3.0))
    return dict(c0=c0, T=T)


def p_pulse(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.02), np.log(0.5))))
    amp = float(rng.uniform(-np.log(8), np.log(8)))
    t0 = float(rng.uniform(0.2, 2.5))
    width = float(rng.uniform(0.05, 0.6))
    return dict(c0=c0, amp=amp, t0=t0, width=width)


def p_ramp(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.02), np.log(0.5))))
    total = float(rng.uniform(-np.log(16), np.log(16)))
    t1 = float(rng.uniform(0.5, 4.0))
    return dict(c0=c0, total=total, t1=t1)


def p_multi(rng):
    c0 = float(np.exp(rng.uniform(np.log(0.02), np.log(0.5))))
    k = int(rng.integers(2, 5))
    times = np.sort(rng.uniform(0.1, 3.0, k))
    jumps = rng.uniform(-np.log(4), np.log(4), k)
    return dict(c0=c0, times=times.tolist(), jumps=jumps.tolist())


def p_piecewise(rng, horizon):
    edges = [0.0]
    while edges[-1] < horizon:
        edges.append(edges[-1] + float(rng.exponential(0.4)) + 0.05)
    levels = rng.uniform(np.log(0.02), np.log(1.0), len(edges))
    return dict(levels=levels.tolist(), cuts=edges[1:])


def cost_of(family, p):
    """The schedule rebuilt from its parameters, in the paper's formulas (common.py and families.py)."""
    def lg(x):
        return 1 / (1 + np.exp(-x))
    if family == "smooth":
        return lambda t: p["c0"] * np.exp(sum(p["a"][j] * np.sin(p["om"][j] * np.asarray(t, float) + p["ph"][j]) for j in range(3)))
    if family == "step":
        return lambda t: p["c0"] + (p["c1"] - p["c0"]) / (1 + np.exp(-(np.asarray(t, float) - p["t0"]) / 0.05))
    if family == "deadline":
        return lambda t: np.where(np.asarray(t, float) <= p["T"] + 1e-12, p["c0"] + 0 * np.asarray(t, float), np.inf)
    if family == "pulse":
        return lambda t: p["c0"] * np.exp(p["amp"] * np.exp(-0.5 * ((np.asarray(t, float) - p["t0"]) / p["width"]) ** 2))
    if family == "ramp":
        return lambda t: p["c0"] * np.exp(p["total"] * np.clip(np.asarray(t, float) / p["t1"], 0.0, 1.0))
    if family == "multi-step":
        return lambda t: p["c0"] * np.exp(sum(p["jumps"][j] / (1 + np.exp(-(np.asarray(t, float) - p["times"][j]) / 0.05))
                                              for j in range(len(p["jumps"]))))
    if family == "piecewise":
        def f(t):
            t = np.asarray(t, float)
            out = np.full(t.shape, p["levels"][0])
            for j, tc in enumerate(p["cuts"]):
                out = out + (p["levels"][j + 1] - p["levels"][j]) / (1 + np.exp(-(t - tc) / 0.05))
            return np.exp(out)
        return f
    raise ValueError(family)


def same_schedule(s, family, p, label):
    """Hold a rebuilt schedule to the paper's own function, everywhere it is finite, at 2001 times on [0, 12]."""
    t = np.linspace(0, 12, 2001)
    a, b = np.asarray(s(t), float), np.asarray(cost_of(family, p)(t), float)
    fin = np.isfinite(a)
    if not (np.array_equal(fin, np.isfinite(b)) and np.max(np.abs(a[fin] / b[fin] - 1), initial=0) < 1e-12):
        raise SystemExit(f"{label}: the rebuilt schedule differs from the paper's")


def g(x, d=10):
    """A number for the data file: d significant digits (finite), else None. Ten keep every printed table cell and
    every comparison the paper's tables make (its win counts compare losses to within 1e-9)."""
    return None if x is None or not np.isfinite(x) else float(f"{x:.{d}g}")


def gp(p):
    """A schedule's parameters for the data file, to 13 significant digits (far below anything the page resolves)."""
    return {k: ([g(x, 13) for x in v] if isinstance(v, list) else g(v, 13)) for k, v in p.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    git = lambda *args, **kw: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True, **kw).stdout  # noqa: E731
    commit = git("rev-list", "-n", "1", a.tag, text=True).strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-ch10-"))
    tarfile.open(fileobj=io.BytesIO(git("archive", a.tag, "src", "experiments"))).extractall(tmp)
    sys.path.insert(0, str(tmp / "src"))
    sys.path.insert(0, str(tmp / "experiments"))
    import common  # noqa: E402
    import families  # noqa: E402
    from speed_accuracy import ddm, evaluate, known, shortcuts  # noqa: E402

    # held_out.py runs its experiment when imported; its rules and the mean look-ahead are taken from its source,
    # up to the line where the run starts, so they are the paper's own definitions
    src = (tmp / "experiments/held_out.py").read_text()
    head = src[: src.index("\nrows = []")]
    ns = {"__file__": str(tmp / "experiments/held_out.py")}
    argv, sys.argv = sys.argv, ["held_out.py"]
    exec(compile(head, "held_out.py", "exec"), ns)
    sys.argv = argv
    cheap_policies, mean_look_ahead = ns["cheap_policies"], ns["mean_look_ahead"]

    res = lambda name: json.loads((tmp / f"experiments/results/{name}.json").read_text())  # noqa: E731

    # ---- the development set ------------------------------------------------------------------------------------
    rand = res("random_schedules")
    rng = np.random.default_rng(2026)
    dev_p = [("smooth", p_smooth(rng)) for _ in range(30)] + [("step", p_step(rng)) for _ in range(30)] + \
            [("deadline", p_deadline(rng)) for _ in range(30)]
    dev_s = families.development_set()
    dev = []
    for i, (row, s, (fam, p)) in enumerate(zip(rand, dev_s, dev_p)):
        assert row["kind"] == fam == s.family and row["name"] == s.name, (i, row["name"], s.name)
        assert abs(row["c0"] / p["c0"] - 1) < 1e-14
        same_schedule(s, fam, p, row["name"])
        dev.append(dict(f=fam, p=gp(p), ex=g(row["exact_reward"]), pm=g(row["per_moment"]), wb=g(row["weighted_bound"]),
                        pmDx=g(row["per_moment_max_dx"], 7), wbDx=g(row["weighted_bound_max_dx"], 7)))
    print("development set: 90 schedules rebuilt and matched", file=sys.stderr)

    # ---- the held-out set -----------------------------------------------------------------------------------------
    held_rows = res("held_out")
    makers = {"smooth": p_smooth, "step": p_step, "deadline": p_deadline, "pulse": p_pulse, "ramp": p_ramp,
              "multi-step": p_multi, "piecewise": lambda r: p_piecewise(r, common.HORIZON)}
    held_p = []
    for j, (fam, _) in enumerate(families.HELD_OUT_FAMILIES):
        r = np.random.default_rng([families.HELD_OUT_SEED, j])
        held_p += [(fam, makers[fam](r)) for _ in range(families.PER_FAMILY)]
    held_s = families.held_out_set()
    RULES = ["per_moment", "weighted", "weighted_one_pass", "averaged_cost", "shift_mean", "shift_half", "best_constant"]
    held = []
    for i, (row, s, (fam, p)) in enumerate(zip(held_rows, held_s, held_p)):
        assert row["family"] == fam == s.family and row["name"] == s.name, (i, row["name"], s.name)
        for k, v in row["params"].items():
            if k in p and not isinstance(v, list):
                assert abs(v / p[k] - 1) < 1e-14, (row["name"], k)
        same_schedule(s, fam, p, row["name"])
        held.append(dict(f=fam, p=gp(p), ex=[g(row["exact"][k]) for k in ("reward", "p", "rt")],
                         r=[[g(row[k]["loss"]), g(row[k]["p"]), g(row[k]["rt"]), g(row[k]["max_dx"], 7)] for k in RULES[:2]]
                         + [g(row[k]["loss"]) for k in RULES[2:]],
                         x=g(row["best_constant"]["x"], 7)))
    print("held-out set: 210 schedules rebuilt and matched", file=sys.stderr)

    formula = [dict(kind=r["kind"], size=r["size"], **{k: {q: g(v) for q, v in r[k].items()} for k in ("per_moment", "weighted")})
               for r in res("loss_formula")]
    scaling = res("loss_scaling")
    data = dict(tag=a.tag, commit=commit, rules=RULES, dev=dev, held=held, formula=formula, scaling=scaling)
    js = ("// Written by tools/validity/ch10.py from experiments/results/ at " + a.tag + " (" + commit[:7] + "): the\n"
          "// paper's own per-schedule results, and each schedule's parameters drawn again from its generator's seed.\n"
          "// Do not edit; run the script again.\n"
          "export default " + json.dumps(data, separators=(",", ":")) + ";\n")
    (ROOT / "book/assets/js/ch10-data.js").write_text(js)
    print(f"wrote book/assets/js/ch10-data.js ({len(js) // 1024} KB)", file=sys.stderr)

    # ---- for the checks: the paper's schedule functions at a few times -----------------------------------------------
    fin = lambda v: [None if not np.isfinite(x) else float(x) for x in np.asarray(v, float)]  # noqa: E731
    costs = {"times": TIMES, "dev": [fin(s(np.array(TIMES))) for s in dev_s],
             "held": [fin(s(np.array(TIMES))) for s in held_s]}

    # ---- for the checks: the paper's code on the page's grid --------------------------------------------------------
    dt, h, cap = PAGE["dt"], PAGE["h"], PAGE["cap"]

    def to_x(gb):
        return shortcuts.discrete(ddm.evidence(np.clip(gb, 0.5, 1 - 1e-12)), dt)

    def page_run(s):
        """held_out.py's run of one schedule, on the page's grid."""
        ts, x_ex, _ = known.backward_induction_x(lambda t: np.minimum(s(t), 1e9), s.horizon, dt=dt, h=h, cap=cap)
        score = lambda x: evaluate.known_reward(x, ts, s, h=h, cap=cap)  # noqa: E731
        ex = score(x_ex)
        early = ts < min(s.horizon, 4)

        def outcome(x):
            o = score(x)
            return dict(loss=100 * (ex.reward - o.reward), p=o.p_correct, rt=o.mean_rt,
                        max_dx=float(np.max(np.abs(np.minimum(x, 4) - np.minimum(x_ex, 4))[early])))
        out = dict(exact=dict(reward=ex.reward, p=ex.p_correct, rt=ex.mean_rt))
        for k, gb in cheap_policies(s, ts).items():
            out[k] = outcome(to_x(gb))
        from scipy.optimize import minimize_scalar
        r = minimize_scalar(lambda xb: -score(np.full(len(ts), xb)).reward, bounds=(0.02, 4.0), method="bounded",
                            options={"xatol": 0.005})
        out["best_constant"] = outcome(np.full(len(ts), float(r.x))) | dict(x=float(r.x), nfev=int(r.nfev))
        return out

    # the book's presets, read from the same log-cost table the page's checks read (tools/validity/schedules.mjs)
    specs = json.loads(subprocess.run(
        ["node", "--input-type=module", "-e",
         "import { CHOICES, spec } from './tools/validity/schedules.mjs'; process.stdout.write(JSON.stringify(CHOICES.map(spec)));"],
        cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    page = {"grid": PAGE, "horizon": common.HORIZON, "presets": {}, "dev": {}, "held": {}}
    for sp in specs:
        if sp["kind"] == "deadline":
            s = common.deadline(sp["c"], sp["at"])
        else:
            L = np.asarray(sp["logc"], float)
            grid = np.arange(len(L)) * sp["step"]
            s = common.Schedule(sp["id"], lambda t, L=L, grid=grid: np.exp(np.interp(np.clip(np.asarray(t, float), 0.0, grid[-1]), grid, L)))
        page["presets"][sp["id"]] = page_run(s)
        print(f"page grid, preset {sp['id']}: done", file=sys.stderr)
    # some of the paper's own schedules: the first of each family, and each set's worst for the weighted rule
    worst_dev = max(range(90), key=lambda i: rand[i]["weighted_bound"])
    pick_dev = sorted({0, 30, 60, worst_dev})
    worst_held = max(range(210), key=lambda i: held_rows[i]["weighted"]["loss"])
    pick_held = sorted({30 * j for j in range(7)} | {worst_held})
    for i in pick_dev:
        page["dev"][str(i)] = page_run(dev_s[i])
        print(f"page grid, development schedule {i}: done", file=sys.stderr)
    for i in pick_held:
        page["held"][str(i)] = page_run(held_s[i])
        print(f"page grid, held-out schedule {i}: done", file=sys.stderr)

    # Table 9's shape on the page's grid, as experiments/loss_scaling.py scores it
    src_ls = (tmp / "experiments/loss_scaling.py").read_text()
    ns_ls = {"__file__": str(tmp / "experiments/loss_scaling.py")}
    exec(compile(src_ls[: src_ls.index("\nfloor = both(")], "loss_scaling.py", "exec"), ns_ls)
    shape, C0 = ns_ls["shape"], ns_ls["C0"]

    def ls_losses(s):
        cost = lambda t: np.minimum(s(t), 1e9)  # noqa: E731
        ts, x_ex, _ = known.backward_induction_x(cost, s.horizon, dt=dt, h=h, cap=cap)
        ex = evaluate.known_reward(x_ex, ts, s, h=h, cap=cap).reward
        return {lab: 100 * (ex - evaluate.known_reward(to_x(gb), ts, s, h=h, cap=cap).reward)
                for lab, gb in (("per_moment", shortcuts.per_moment(s, ts)), ("weighted", shortcuts.weighted_bound(s, ts)))}
    scaling_page = dict(cost=C0, floor=ls_losses(common.Schedule("constant", lambda t: C0 + 0 * np.asarray(t, float))),
                        rows=[dict(amplitude=amp, **ls_losses(common.Schedule(f"a={amp}", lambda t, amp=amp: C0 * np.exp(amp * shape(t)))))
                              for amp in (0.05, 0.1, 0.2, 0.4, 0.8)])
    print("page grid, Table 9's shape: done", file=sys.stderr)

    out = dict(tag=a.tag, commit=commit, costs=costs, pageGrid=page, scalingPage=scaling_page)
    (ROOT / "tools/validity/ch10.json").write_text(json.dumps(out, indent=0) + "\n")
    print(f"wrote tools/validity/ch10.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
