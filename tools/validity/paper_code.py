#!/usr/bin/env python3
"""Run the paper's own code at its tag on the book's schedules, and save what it computes, so the book's
in-browser solver can be held to it (tools/checks/paper-code.mjs).

    node tools/validity/export.mjs > /tmp/schedules.json
    python3 tools/validity/paper_code.py --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2 \
        --schedules /tmp/schedules.json

It extracts the tag's src/ into a temporary folder and imports speed_accuracy from there (it needs numpy and
scipy), runs, for each schedule, on the page's grid:
- known.backward_induction_x: the exact evidence bound over [0, view + spare], or up to a deadline, where the
  choice is forced;
- shortcuts.bound_for_cost: the per-moment evidence bound over the window;
- shortcuts.weighted_bound: the weighted look-ahead (belief bounds, turned back into evidence);
- shortcuts.discrete: the per-moment bound moved in for monitoring every dt, as the page's worker plots it;
- evaluate.known_reward: what the exact policy, moved in by the discrete-monitoring shift where the page does,
  earns, and what the per-moment and weighted bounds earn (a deadline scored up to the deadline);
and, for the comparator's edge cases (tools/checks/paper-code.mjs), the same program on the same grid at constant
costs of 3.2 and 4.2 with a forced choice at time 2 (its bound at every step and its value at the center at time 0,
which says whether the center waits), and on a cost that falls 40,000-fold at time 1 (to 1e-5, below the presets'
range), whose bound passes the cap late in the window. Where the tag's code returns infinity for a bound (no stop
below the cap), the file stores null. It writes tools/validity/paper-code.json.
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--schedules", required=True)
    a = ap.parse_args()
    commit = subprocess.run(["git", "-C", a.repo, "rev-list", "-n", "1", a.tag], check=True,
                            capture_output=True, text=True).stdout.strip()
    tar = subprocess.run(["git", "-C", a.repo, "archive", a.tag, "src"], check=True, capture_output=True).stdout
    with tempfile.TemporaryDirectory(prefix="paper-code-") as d:   # removed on success or failure
        tmp = Path(d)
        tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp)
        sys.path.insert(0, str(tmp / "src"))
        from speed_accuracy import known, shortcuts, evaluate  # noqa: E402
        run(a, commit, known, shortcuts, evaluate)


def run(a, commit, known, shortcuts, evaluate):
    data = json.loads(Path(a.schedules).read_text())
    dt, h, cap, horizon, view = data["dt"], data["h"], data["cap"], data["horizon"], data["view"]
    out = {"tag": a.tag, "commit": commit, "dt": dt, "h": h, "cap": cap, "horizon": horizon, "view": view,
           "schedules": {}}
    for s in data["schedules"]:
        if s["kind"] == "deadline":
            at, c0 = s["at"], s["c"]

            def cost(t, at=at, c0=c0):
                t = np.asarray(t, float)
                return np.where(t <= at + 1e-12, c0, np.inf)
        else:
            L = np.asarray(s["logc"], float)
            grid = np.arange(len(L)) * s["step"]

            def cost(t, L=L, grid=grid):
                t = np.clip(np.asarray(t, float), 0.0, grid[-1])
                return np.exp(np.interp(t, grid, L))
        # a deadline is solved as the page's worker and the paper's experiments solve it: the program's horizon is
        # the deadline, where the choice is forced
        hz = s["at"] if s["kind"] == "deadline" else horizon
        ts, xb, _ = known.backward_induction_x(cost, hz, dt=dt, h=h, cap=cap)
        k_view = min(int(round(view / dt)), len(ts) - 1)
        tv = ts[: k_view + 1]
        pm = shortcuts.bound_for_cost(cost(tv))
        g = shortcuts.weighted_bound(cost, tv)
        wb = 0.5 * np.log(g / (1 - g))
        # scores over the solver's whole span: the exact policy as solved, and the two shortcuts moved in by the
        # discrete-monitoring shift (beyond the window, each shortcut's own bound for the cost there)
        pm_all = shortcuts.discrete(shortcuts.bound_for_cost(cost(ts)), dt)
        wb_all_g = shortcuts.weighted_bound(cost, ts)
        wb_all = shortcuts.discrete(0.5 * np.log(wb_all_g / (1 - wb_all_g)), dt)
        xb_fin = np.where(np.isfinite(xb), xb, cap)
        # a deadline is scored up to the deadline, where the choice is forced, as the paper's experiments do
        end = int(round(s["at"] / dt)) + 1 if s["kind"] == "deadline" else len(ts)
        sc = {name: evaluate.known_reward(b[:end], ts[:end], cost, h=h, cap=cap) for name, b in
              (("exact", xb_fin), ("perMoment", pm_all), ("weighted", wb_all))}
        out["schedules"][s["id"]] = {
            "exact": [None if not np.isfinite(v) else float(v) for v in xb[: k_view + 1]],
            "perMoment": [float(v) for v in pm],
            "perMomentDiscrete": [float(v) for v in shortcuts.discrete(pm, dt)],
            "weighted": [float(v) for v in wb],
            "scores": {k: {"p": o.p_correct, "rt": o.mean_rt, "paid": o.mean_cost, "reward": o.reward} for k, o in sc.items()},
        }
        print(f"{s['id']}: done", file=sys.stderr)
    # the edge cases: below the grid's first step (constant costs, forced choice at 2), and off the cap
    edge = {}
    for c0 in data["edge"]["constant"]:
        ts, xb, v0 = known.backward_induction_x(lambda t, c0=c0: np.full(np.shape(t), c0), data["edge"]["horizon"],
                                                dt=dt, h=h, cap=cap)
        edge[f"constant {c0}"] = {"c": c0, "horizon": data["edge"]["horizon"], "v0": v0,
                                  "exact": [None if not np.isfinite(v) else float(v) for v in xb]}
    for s in data["edge"]["schedules"]:
        L = np.asarray(s["logc"], float)
        grid = np.arange(len(L)) * s["step"]

        def cost(t, L=L, grid=grid):
            t = np.clip(np.asarray(t, float), 0.0, grid[-1])
            return np.exp(np.interp(t, grid, L))
        ts, xb, _ = known.backward_induction_x(cost, horizon, dt=dt, h=h, cap=cap)
        k_view = min(int(round(view / dt)), len(ts) - 1)
        pm = shortcuts.bound_for_cost(cost(ts[: k_view + 1]))
        edge[s["name"]] = {"choice": s["choice"], "exact": [None if not np.isfinite(v) else float(v) for v in xb[: k_view + 1]],
                           "perMomentDiscrete": [float(v) for v in shortcuts.discrete(pm, dt)]}
    out["edge"] = edge
    (ROOT / "tools/validity/paper-code.json").write_text(json.dumps(out, indent=0) + "\n")
    print(f"wrote tools/validity/paper-code.json from {a.tag} ({commit[:7]})", file=sys.stderr)


if __name__ == "__main__":
    main()
