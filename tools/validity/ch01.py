#!/usr/bin/env python3
"""Read the paper's own Figure 1 at its tag, for chapter 1's checks (tools/checks/ch01.mjs): the four schedules'
cost, the three bounds, and the losses, as the tag's experiments/results/showcase.json holds them (the file the
paper's Figure 1 and Table 4 are drawn from), with the grid they were computed on.

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch01.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts the tag's src/ and experiments/ into a temporary folder with git archive and imports the paper's
modules from there (they need numpy and scipy, so run it with the paper repo's Python), but only to read the grid:
experiments/common.py's time step and horizon, known.backward_induction_x's evidence step and cap, and the shift
shortcuts.discrete applies at that time step. Nothing is recomputed. It writes tools/validity/ch01.json.
"""
import argparse
import inspect
import io
import json
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    commit = subprocess.run(["git", "-C", a.repo, "rev-list", "-n", "1", a.tag], check=True,
                            capture_output=True, text=True).stdout.strip()
    tmp = Path(tempfile.mkdtemp(prefix="ch01-"))
    tar = subprocess.run(["git", "-C", a.repo, "archive", a.tag, "src", "experiments"], check=True,
                         capture_output=True).stdout
    tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp)
    sys.path.insert(0, str(tmp / "src"))
    sys.path.insert(0, str(tmp / "experiments"))
    import common  # noqa: E402
    from speed_accuracy import known, shortcuts  # noqa: E402

    sig = inspect.signature(known.backward_induction_x).parameters
    dt = float(common.DT)
    shift = float(1.0 - shortcuts.discrete(np.array([1.0]), dt)[0])
    show = json.loads((tmp / "experiments/results/showcase.json").read_text())
    out = {
        "tag": a.tag, "commit": commit,
        "source": "experiments/results/showcase.json",
        "dt": dt, "h": float(sig["h"].default), "cap": float(sig["cap"].default), "horizon": float(common.HORIZON),
        "shift": shift,
        "schedules": [{k: s[k] for k in ("title", "t", "cost", "exact", "per_moment", "weighted", "loss")}
                      for s in show["schedules"]],
    }
    (ROOT / "tools/validity/ch01.json").write_text(json.dumps(out) + "\n")
    print(f"wrote tools/validity/ch01.json from {a.tag} ({commit[:7]}): dt {dt}, h {out['h']}, "
          f"{len(out['schedules'])} schedules", file=sys.stderr)


if __name__ == "__main__":
    main()
