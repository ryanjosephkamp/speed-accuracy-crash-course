#!/usr/bin/env python3
"""Run the paper's own code at its tag for Appendix A's checks, and save what it computes (tools/checks/appA.mjs reads
tools/validity/appA.json).

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/appA.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ into a temporary folder and imports speed_accuracy from there, then records
lopsided.constant_bounds(c, r_plus, r_minus): the two constant-cost bounds for unequal rewards that Appendix B
derives, for the rewards Section 7.2 uses (r_plus = 1, r_minus = 0.5 and 0.25), equal rewards, and a common reward
of 2, at four costs. The check solves Appendix B's three equations itself and compares.
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

ROOT = Path(__file__).resolve().parent.parent.parent
COSTS = [0.03, 0.1, 0.3, 1.0]
REWARDS = [(1.0, 0.5), (1.0, 0.25), (1.0, 1.0), (2.0, 2.0)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    commit = subprocess.run(["git", "-C", a.repo, "rev-list", "-n", "1", a.tag], check=True,
                            capture_output=True, text=True).stdout.strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-code-"))
    try:
        tar = subprocess.run(["git", "-C", a.repo, "archive", a.tag, "src"], check=True, capture_output=True).stdout
        tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp)
        sys.path.insert(0, str(tmp / "src"))
        from speed_accuracy import lopsided  # noqa: E402

        out = {"tag": a.tag, "commit": commit, "bounds": []}
        for r_plus, r_minus in REWARDS:
            for c in COSTS:
                lo, hi = lopsided.constant_bounds(c, r_plus, r_minus)
                out["bounds"].append({"c": c, "r_plus": r_plus, "r_minus": r_minus, "lo": float(lo), "hi": float(hi),
                                      "x_star": float(lopsided.x_star(r_plus, r_minus))})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    (ROOT / "tools/validity/appA.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote tools/validity/appA.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
