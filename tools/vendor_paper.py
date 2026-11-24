#!/usr/bin/env python3
"""Copy the paper's source at a tag into paper/: main.tex, the generated numbers and every generated table, and the numbers LaTeX gave every label and citation (from the aux file of a compile of that
tag), so the book builds from these files alone.

    python3 tools/vendor_paper.py --repo ~/Projects/speed-accuracy-tradeoff --tag paper-v1.2 --aux main.aux
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "book"))
from texconv import read_aux  # noqa: E402

FILES = ["paper/main.tex", "paper/references.bib", "paper/generated/numbers.tex"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--aux", required=True, help="main.aux from compiling the tag's paper/main.tex")
    a = ap.parse_args()
    git = lambda *args: subprocess.run(["git", "-C", a.repo, *args], check=True, capture_output=True, text=True).stdout
    commit = git("rev-list", "-n", "1", a.tag).strip()
    tables = sorted(f for f in git("ls-tree", "--name-only", a.tag, "paper/generated/").split() if f.endswith(".tex")
                    and f.split("/")[-1].startswith("tab_"))
    files = FILES + tables
    for f in files:
        out = ROOT / f
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(git("show", f"{a.tag}:{f}"))
    labels, cites = read_aux(Path(a.aux).read_text())
    (ROOT / "paper/labels.json").write_text(json.dumps({"labels": labels, "cites": cites}, indent=1, sort_keys=True) + "\n")
    (ROOT / "paper/SOURCE.json").write_text(json.dumps({
        "repository": "https://github.com/ryanjosephkamp/speed-accuracy-tradeoff",
        "tag": a.tag, "commit": commit, "files": files + ["paper/labels.json"]}, indent=1) + "\n")
    print(f"paper/ now holds {a.tag} ({commit[:7]})")


if __name__ == "__main__":
    main()
