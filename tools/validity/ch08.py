#!/usr/bin/env python3
"""What the paper's code at its tag computes for chapter 8's checks (tools/checks/ch08.mjs), saved as
tools/validity/ch08.json so the checks hold the page's rules to it without typed-in numbers.

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch08.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ and experiments/ with git archive into a temporary folder (as paper_code.py does),
imports speed_accuracy and experiments/common.py from there (numpy and scipy), and writes:
- "showcase": from experiments/results/showcase.json at the tag, the weighted rule's evidence bound (moved in by
  0.5826 sqrt(0.002), rounded to 4 decimals by the paper's script) at the times 0, 0.1, ..., for Figure 1's four
  schedules, and the first_order rows' fits (amplitude, phase in degrees) of the weighted and averaged-cost rules;
- "averagedCost": shortcuts.weighted_ahead, as continuous evidence bounds, on Figure 1's four schedules at the times
  0, 0.1, ..., 2.5 (to the deadline), and on two deadlines its binned kernels reach late: a cost of 0.5 with a forced
  choice at 3, and the 16-fold jump with a forced choice added at 2, at the times 0, 0.05, ..., to the deadline.
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


def times(end, step):
    return np.round(np.arange(0, end + step / 2, step), 10)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    git = lambda *args, **kw: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True, **kw).stdout
    commit = git("rev-list", "-n", "1", a.tag, text=True).strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-ch08-"))
    tarfile.open(fileobj=io.BytesIO(git("archive", a.tag, "src", "experiments"))).extractall(tmp)
    sys.path.insert(0, str(tmp / "src"))
    sys.path.insert(0, str(tmp / "experiments"))
    import common  # noqa: E402
    from speed_accuracy import ddm, shortcuts  # noqa: E402

    out = {"tag": a.tag, "commit": commit, "showcase": {"weighted": {}, "fits": {}}, "averagedCost": {}}

    # showcase.json as the paper's script wrote it: Figure 1's four schedules, in the order of experiments/showcase.py
    show = json.loads((tmp / "experiments/results/showcase.json").read_text())
    names = ["jump", "fall", "rising", "deadline"]
    for name, s in zip(names, show["schedules"]):
        idx = [i for i, t in enumerate(s["t"]) if abs(round(t * 10) - t * 10) < 1e-9]
        out["showcase"]["weighted"][name] = {"t": [s["t"][i] for i in idx], "weighted": [s["weighted"][i] for i in idx]}
    for r in show["first_order"]:
        out["showcase"]["fits"][f"{r['omega']:g}"] = {"weighted": r["weighted"], "averagedCost": r["averaged_cost"]}

    # the averaged-cost rule as the paper's code computes it
    def ev(g):
        return ddm.evidence(np.clip(g, 0.5, 1 - 1e-12))

    jump = common.step(0.1, 1.6, 0.5)
    cases = {
        "jump": (jump, times(2.5, 0.1)),
        "fall": (common.step(0.4, 0.05, 0.3), times(2.5, 0.1)),
        "rising": (common.Schedule("flat then rising", lambda t: 0.1 + 0.8 * np.maximum(np.asarray(t) - 0.5, 0)), times(2.5, 0.1)),
        "deadline": (common.deadline(0.1, 1.0), times(1.0, 0.1)),
        "deadline-0.5-3": (common.deadline(0.5, 3.0), times(3.0, 0.05)),
        "jump-deadline-2": (common.Schedule("jump, forced choice at 2", jump.fn, deadline=2.0), times(2.0, 0.05)),
    }
    for name, (s, ts) in cases.items():
        out["averagedCost"][name] = {"t": ts.tolist(), "bound": [float(v) for v in ev(shortcuts.weighted_ahead(s, ts))]}
        print(f"{name}: done", file=sys.stderr)
    (ROOT / "tools/validity/ch08.json").write_text(json.dumps(out, indent=0) + "\n")
    print(f"wrote tools/validity/ch08.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
