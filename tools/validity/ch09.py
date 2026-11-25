#!/usr/bin/env python3
"""What the paper's results at its tag hold for chapter 9's checks (tools/checks/ch09.mjs), saved as
tools/validity/ch09.json so the checks can hold the page's numbers to the unrounded results behind Tables 2 and 12
without typed-in numbers.

    python3 tools/validity/ch09.py --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It reads, with git show at the tag, experiments/results/grid_refinement.json (Table 12: each schedule's losses on
the four grids, in points per 100 trials, and the residual) and experiments/results/first_order_sweep.json (Table 2:
the fitted swing over the predicted swing and the phase error, for each cost, frequency, and size), and writes them
with the tag and its commit.
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True, text=True).stdout
    commit = git("rev-list", "-n", "1", a.tag).strip()
    grid = json.loads(git("show", f"{a.tag}:experiments/results/grid_refinement.json"))
    sweep = json.loads(git("show", f"{a.tag}:experiments/results/first_order_sweep.json"))
    out = {
        "tag": a.tag, "commit": commit,
        "grid": [{"name": r["name"], "perMoment": [g["per_moment"] for g in r["grids"]], "weighted": [g["weighted"] for g in r["grids"]],
                  "grids": [[g["dt"], g["h"]] for g in r["grids"]], "residual": r["residual"]} for r in grid],
        "sweep": [{"c0": r["c0"], "omega": r["omega"], "rel": r["rel"], "ratio": r["swing_ratio"], "phase": r["phase_error"]} for r in sweep],
    }
    (ROOT / "tools/validity/ch09.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote tools/validity/ch09.json from {a.tag} ({commit[:7]})")


if __name__ == "__main__":
    main()
