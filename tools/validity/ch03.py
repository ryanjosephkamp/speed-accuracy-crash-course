#!/usr/bin/env python3
"""Run the paper's own code at its tag for chapter 3's checks, and save what it computes (tools/checks/ch03.mjs reads
tools/validity/ch03.json).

    node tools/validity/export.mjs > /tmp/schedules.json
    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch03.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2 --schedules /tmp/schedules.json

It extracts the tag's src/ into a temporary folder and imports speed_accuracy from there, then records:
- ddm.optimal_bound(c), which finds the constant-cost bound by maximizing the reward of a flat bound (the second
  route of the paper's derivation), with ddm.expected_reward and ddm.mean_decision_time there, for eight costs;
- known.backward_induction_x's value of starting at x = 0, V(0, 0), on the page's grid (dt 0.01, h 0.02, cap 5) for
  the book's schedules, with the choice forced 6 time units past the window (time 8.5) and at the window's end
  (time 2.5); a deadline is solved to its deadline either way.
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
COSTS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--schedules", required=True)
    a = ap.parse_args()
    commit = subprocess.run(["git", "-C", a.repo, "rev-list", "-n", "1", a.tag], check=True,
                            capture_output=True, text=True).stdout.strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-code-"))
    tar = subprocess.run(["git", "-C", a.repo, "archive", a.tag, "src"], check=True, capture_output=True).stdout
    tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp)
    sys.path.insert(0, str(tmp / "src"))
    from speed_accuracy import ddm, known  # noqa: E402

    out = {"tag": a.tag, "commit": commit, "flat": [], "value": {}}
    for c in COSTS:
        x = ddm.optimal_bound(c)
        out["flat"].append({"c": c, "bound": x, "reward": float(ddm.expected_reward(x, c)),
                            "time": float(ddm.mean_decision_time(x))})

    data = json.loads(Path(a.schedules).read_text())
    dt, h, cap, far, view = data["dt"], data["h"], data["cap"], data["horizon"], data["view"]
    out.update({"dt": dt, "h": h, "cap": cap, "far": far, "window": view})
    for s in data["schedules"]:
        if s["kind"] == "deadline":
            at, c0 = s["at"], s["c"]

            def cost(t, at=at, c0=c0):
                t = np.asarray(t, float)
                return np.where(t <= at + 1e-12, c0, np.inf)
            horizons = {"far": at, "window": at}
        else:
            L = np.asarray(s["logc"], float)
            grid = np.arange(len(L)) * s["step"]

            def cost(t, L=L, grid=grid):
                t = np.clip(np.asarray(t, float), 0.0, grid[-1])
                return np.exp(np.interp(t, grid, L))
            horizons = {"far": far, "window": view}
        out["value"][s["id"]] = {}
        for name, hz in horizons.items():
            _, _, v0 = known.backward_induction_x(cost, hz, dt=dt, h=h, cap=cap)
            out["value"][s["id"]][name] = v0
        print(f"{s['id']}: done", file=sys.stderr)
    (ROOT / "tools/validity/ch03.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote tools/validity/ch03.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
