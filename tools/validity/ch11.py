#!/usr/bin/env python3
"""What the paper's code at its tag computes for chapter 11's checks (tools/checks/ch11.mjs), saved as
tools/validity/ch11.json so the checks hold the page's model to it without typed-in numbers.

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch11.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ and experiments/ with git archive into a temporary folder (as paper_code.py does),
imports speed_accuracy and experiments/unknown_reliability.py from there (numpy and scipy), and writes:
- "frozen": info_time.frozen_bound (the root) and info_time.frozen_bounds (the paper's table) at a list of kappa;
- "kernelU": info_time._kernel_u, the u-kernel the weighted rule uses, at four bounds: its mean and some bins;
  and info_time.survival_kernel for the drift tanh(x) at a bound of 1 (400 nodes), the test the paper's code runs;
- "rules": for Table 10's eight schedules, info_time.frozen_time, info_time.weighted_bound, and the experiment's
  plug_in at a few times (continuous-monitoring evidence bounds), and unknown.backward_induction's evidence bound
  on the paper's grid (300 beliefs, steps of 0.005) at those times;
- "curves": from experiments/results/unknown_reliability.json at the tag, the curves the paper's run stored
  (every 0.1, rounded to 4 decimals): the program and the three rules, moved in for checking every 0.005;
- "lopsided": lopsided.constant_bounds and flux_totals on a grid of costs and ratios; the slope identity's central
  difference; transfer at three lambdas; boundary_kernels' means and some bins; and backward_induction on the
  page's grid (dt 0.01, h 0.02, cap 5) at a constant cost;
- "firstOrder": from experiments/results/lopsided.json at the tag, the paper's sinusoid fits.
"""
import argparse
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent.parent

# Table 10's eight schedules, in the table's order (experiments/unknown_reliability.py)
def schedules():
    out = [(f"constant {c:g}", (lambda t, c=c: c + 0 * np.asarray(t, float)), 10.0) for c in (0.02, 0.05, 0.1, 0.2, 0.4)]
    out.append(("flat 0.1, rising 0.8/s after 0.5 s", lambda t: 0.1 + 0.8 * np.maximum(np.asarray(t, float) - 0.5, 0), 10.0))
    out.append(("deadline 1 s at cost 0.05", lambda t: np.where(np.asarray(t, float) <= 1.0 + 1e-12, 0.05, np.inf), 1.0))
    out.append(("deadline 2 s at cost 0.02", lambda t: np.where(np.asarray(t, float) <= 2.0 + 1e-12, 0.02, np.inf), 2.0))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True).stdout
    commit = git("rev-list", "-n", "1", a.tag).decode().strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-ch11-"))
    tarfile.open(fileobj=io.BytesIO(git("archive", a.tag, "src", "experiments"))).extractall(tmp)
    sys.path.insert(0, str(tmp / "src"))
    sys.path.insert(0, str(tmp / "experiments"))
    from speed_accuracy import info_time as I, unknown as U, lopsided as L  # noqa: E402
    import unknown_reliability as UR  # noqa: E402

    out = {"tag": a.tag, "commit": commit}

    kappas = [1e-3, 0.01, 0.05, 0.1, 0.37, 2.0, 50.0]
    out["frozen"] = {"kappa": kappas, "root": [I.frozen_bound(k) for k in kappas],
                     "table": [float(I.frozen_bounds(k)) for k in kappas]}

    ku = []
    for Ub in (0.3, 0.8, 1.39, 2.2):
        s, w = I._kernel_u(Ub)
        ku.append({"U": Ub, "mean": float(w @ s), "bins": {str(i): float(w[i]) for i in (10, 60, 120, 200)},
                   "s120": float(s[120])})
    s1, w1 = I.survival_kernel(np.tanh, 1.0, points=400)
    out["kernelU"] = {"u": ku, "tanh": {"U": 1.0, "points": 400, "mean": float(w1 @ s1), "w100": float(w1[100])}}

    rules = []
    for name, cost, hor in schedules():
        ts = np.array([t for t in (0.0, 0.3, 0.7, 1.0, 1.6, 2.5) if t <= hor + 1e-9])
        tsp, gb = U.backward_induction(cost, hor, prior_var=1.0, n=300, dt=0.005)
        xb = U.evidence_bound(gb, tsp, prior_var=1.0)
        idx = [int(round(t / 0.005)) for t in ts]
        rules.append({"name": name, "t": ts.tolist(), "frozen": I.frozen_time(cost, ts).tolist(),
                      "weighted": I.weighted_bound(cost, ts).tolist(), "plug": UR.plug_in(cost, ts).tolist(),
                      "program": [float(xb[k]) for k in idx]})
        print(f"{name}: done", file=sys.stderr)
    out["rules"] = rules

    unk = json.loads((tmp / "experiments/results/unknown_reliability.json").read_text())
    out["curves"] = [{"name": u["name"], **{k: u["curves"][k] for k in ("t", "exact", "frozen_time", "weighted", "plug_in")}} for u in unk]

    lop = {"bounds": [], "transfer": [], "kernels": []}
    for c in (0.02, 0.1, 0.5, 1.0):
        for rm in (1.0, 0.5, 0.25, 0.05):
            lo, hi = L.constant_bounds(c, 1.0, rm)
            th, tl = L.flux_totals(lo, hi)
            hs = 1e-5
            (lp, hp), (lm, hm) = L.constant_bounds(c + hs, 1.0, rm), L.constant_bounds(c - hs, 1.0, rm)
            lop["bounds"].append({"c": c, "rm": rm, "lo": lo, "hi": hi, "th": th, "tl": tl,
                                  "dhi": (hp - hm) / (2 * hs), "dlo": (lp - lm) / (2 * hs)})
    for rm in (1.0, 0.5, 0.25):
        lo, hi = L.constant_bounds(0.1, 1.0, rm)
        for lam in (0.3, -1j, -4j):
            wh, wl = L.transfer(lam, lo, hi)
            lop["transfer"].append({"rm": rm, "re": complex(lam).real, "im": complex(lam).imag,
                                    "hi": [complex(wh).real, complex(wh).imag], "lo": [complex(wl).real, complex(wl).imag]})
        s, wh, wl = L.boundary_kernels(lo, hi)
        lop["kernels"].append({"rm": rm, "meanHi": float(wh @ s), "meanLo": float(wl @ s),
                               "bins": {str(i): [float(wh[i]), float(wl[i])] for i in (5, 50, 150)}})
    ts, lo_x, hi_x, _ = L.backward_induction(lambda t: 0.1 + 0 * np.asarray(t, float), 8.0, 1.0, 0.5, dt=0.01, h=0.02, cap=5.0)
    keep = [int(round(t / 0.01)) for t in (0.0, 1.0, 2.0, 4.0)]
    lop["program"] = {"c": 0.1, "rm": 0.5, "horizon": 8.0, "dt": 0.01, "h": 0.02, "cap": 5.0,
                      "t": [float(ts[k]) for k in keep], "lo": [float(lo_x[k]) for k in keep], "hi": [float(hi_x[k]) for k in keep]}
    out["lopsided"] = lop

    res = json.loads((tmp / "experiments/results/lopsided.json").read_text())
    out["firstOrder"] = res["first_order"]

    (ROOT / "tools/validity/ch11.json").write_text(json.dumps(out, indent=0) + "\n")
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"wrote tools/validity/ch11.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
