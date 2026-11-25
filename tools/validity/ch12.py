#!/usr/bin/env python3
"""What the paper's figure script at its tag computes for chapter 12's checks (tools/checks/ch12.mjs), saved as
tools/validity/ch12.json so the checks hold the page's Palmer numbers to the paper's code without typed-in values.

    ~/Projects/speed-accuracy-tradeoff/.venv/bin/python tools/validity/ch12.py \
        --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2

It extracts paper/make_figures.py from the tag with git archive into a temporary folder and reads it without running
it (the script writes figures when run): from its syntax tree it takes the Palmer inputs (K_PALMER, A_PALMER, COH)
and the closed forms bound, transfer, and mean_look_ahead, runs those three functions (numpy and scipy), and repeats
the script's worked example step for step, unrounded. It also runs the same functions on the numbers as the paper
prints them (the bound to two decimals, the phases to whole degrees), which is where the rounding traps come from.
"""
import argparse
import ast
import io
import json
import subprocess
import tarfile
import tempfile
from pathlib import Path

import numpy as np
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parent.parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True).stdout
    commit = git("rev-list", "-n", "1", a.tag).decode().strip()
    tmp = Path(tempfile.mkdtemp(prefix="paper-ch12-"))
    tarfile.open(fileobj=io.BytesIO(git("archive", a.tag, "paper/make_figures.py"))).extractall(tmp)
    src = (tmp / "paper/make_figures.py").read_text()
    tree = ast.parse(src)

    # the Palmer inputs: the one assignment K_PALMER, A_PALMER, COH = ...
    inputs = None
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Tuple):
            names = [t.id for t in node.targets[0].elts if isinstance(t, ast.Name)]
            if names == ["K_PALMER", "A_PALMER", "COH"]:
                inputs = dict(zip(names, ast.literal_eval(node.value)))
    if inputs is None:
        raise SystemExit("no K_PALMER, A_PALMER, COH assignment in make_figures.py")

    # the three closed forms, compiled from the script's own source
    ns = {"np": np, "brentq": brentq}
    funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ("bound", "transfer", "mean_look_ahead")]
    if len(funcs) != 3:
        raise SystemExit("make_figures.py is missing bound, transfer, or mean_look_ahead")
    exec(compile(ast.Module(body=funcs, type_ignores=[]), "make_figures.py", "exec"), ns)
    bound, transfer, mean_look_ahead = ns["bound"], ns["transfer"], ns["mean_look_ahead"]

    # the worked example, as the script computes it (paper/make_figures.py, the Palmer block)
    k, A, coh = inputs["K_PALMER"], inputs["A_PALMER"], inputs["COH"]
    mu = k * coh
    b = mu * A
    c = 1 / (np.sinh(2 * b) + 2 * b)
    m = mean_look_ahead(c)
    waves = []
    for hz in (0.5, 1.0, 2.0):
        resp = transfer(c, -1j * 2 * np.pi * hz / mu ** 2)
        deg = float(np.degrees(np.angle(resp)))
        waves.append({"hz": hz, "deg": deg, "ms": 1000 * deg / 360 / hz, "gain": float(abs(resp))})
    # the traps: the same functions from the printed bound, and the printed phases converted
    b_printed = round(b, 2)
    c_printed = 1 / (np.sinh(2 * b_printed) + 2 * b_printed)
    out = {
        "tag": a.tag, "commit": commit,
        "inputs": {"k": k, "fittedBound": A, "coherence": coh},
        "palmer": {"mu": mu, "unitMs": 1000 / mu ** 2, "b": b, "c0": c, "boundOfC0": bound(c), "m": float(m),
                   "leadMs": float(1000 * m / mu ** 2), "waves": waves},
        "traps": {"bPrinted": b_printed, "fromBound": float(1000 * mean_look_ahead(c_printed) / mu ** 2),
                  "fromDegrees": [{"hz": w["hz"], "deg": round(w["deg"]), "ms": 1000 * round(w["deg"]) / 360 / w["hz"]} for w in waves]},
    }
    (ROOT / "tools/validity/ch12.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote tools/validity/ch12.json from {a.tag} ({commit[:7]})")


if __name__ == "__main__":
    main()
