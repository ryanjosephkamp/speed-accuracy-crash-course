#!/usr/bin/env python3
"""Run the paper's two reference programs at its tag at constant costs on Appendix B's grid, and save what they
compute, so the page's ports can be held to them (tools/checks/appB.mjs).

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/appB.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ into a temporary folder and imports speed_accuracy from there (it needs numpy and scipy),
then, at each cost of COSTS:
- known.backward_induction_x on the page's evidence grid (a check every 0.01, an evidence step of 0.02, bounds capped
  at 5) with the choice forced at 30: the bound every 0.5 time units of time left, and, from the bound at every
  step, how much time is left when the bound is last more than 0.001 and 0.01 from its value with 30 left;
- known.backward_induction on the belief grid at the page's time step of 0.01, with the choice forced at 30, for each
  number of bins in BINS: the belief bound at the start (30 time units left), and the same with the choice forced at
  2, where the bound still moves from one step to the next.
It writes tools/validity/appB.json with the tag and its commit.
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
DT, H, CAP, LONG, SHORT = 0.01, 0.02, 5.0, 30.0, 2.0
COSTS = [0.01, 0.1, 1.0]
BINS = [25, 50, 100, 200, 400, 800]
EPS = [0.001, 0.01]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    commit = subprocess.run(["git", "-C", a.repo, "rev-list", "-n", "1", a.tag], check=True,
                            capture_output=True, text=True).stdout.strip()
    tar = subprocess.run(["git", "-C", a.repo, "archive", a.tag, "src"], check=True, capture_output=True).stdout
    with tempfile.TemporaryDirectory(prefix="appB-") as d:   # removed on success or failure
        tmp = Path(d)
        tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp)
        sys.path.insert(0, str(tmp / "src"))
        from speed_accuracy import known  # noqa: E402
        out = {"tag": a.tag, "commit": commit, "dt": DT, "h": H, "cap": CAP, "long": LONG, "short": SHORT, "eps": EPS,
               "costs": {}}
        for c in COSTS:
            ts, b, _ = known.backward_induction_x(lambda t, c=c: np.full_like(t, c), LONG, dt=DT, h=H, cap=CAP)
            left = LONG - ts
            last = b[0]
            reach = []
            for eps in EPS:
                far = ~(np.abs(b - last) <= eps)
                reach.append(float(left[far].max()) if far.any() else 0.0)
            every = np.round(np.arange(0.0, LONG + 1e-9, 0.5) / DT).astype(int)   # steps left
            n = len(ts) - 1
            row = {"left": [round(float(j * DT), 6) for j in every],
                   "bound": [None if not np.isfinite(b[n - j]) else float(b[n - j]) for j in every],
                   "reach": reach, "beliefs": {}}
            for nb in BINS:
                _, gbs = known.backward_induction(lambda t, c=c: np.full_like(t, c), LONG, n=nb, dt=DT)
                _, short = known.backward_induction(lambda t, c=c: np.full_like(t, c), SHORT, n=nb, dt=DT)
                row["beliefs"][str(nb)] = {"gb": float(gbs[0]), "short": float(short[0])}
            out["costs"][str(c)] = row
    (ROOT / "tools/validity/appB.json").write_text(json.dumps(out, indent=0) + "\n")
    print(f"wrote tools/validity/appB.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
