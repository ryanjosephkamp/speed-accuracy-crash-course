# Waiting, weighted: a crash course

A course book for the paper *Waiting, weighted* ([source](https://github.com/ryanjosephkamp/speed-accuracy-tradeoff)).
It works through the paper one result at a time, on a cost-of-time schedule the reader picks or draws. Each chapter
puts the paper's statements beside plain-language explanations, proof strips, and live plates. The plates compute in
the browser from the paper's equations: the boundary kernel from its series, the transform and transfer function from
their closed forms, decision times sampled from the paper's start law, and the best bound from a dynamic program on an
evidence grid. A check script holds those computations to the paper's generated numbers and to the paper's own code.

## Layout

| Path | What it holds |
|---|---|
| `paper/` | The paper's `main.tex`, its generated numbers and tables, and the number LaTeX gave each label (`labels.json`), at the tag `paper-v1.2`, copied by `tools/vendor_paper.py` |
| `book/content/` | The text: the contents page (`book.py`), the chapters (`ch00.py` to `ch12.py`), Appendix A (`appA.py`), and the claim map's graph (`map.json`) |
| `book/build.py` | Builds `docs/` from the content and the paper; numbers come from the paper's macros and cross-references from its labels |
| `book/texconv.py` | Converts excerpts of `main.tex` to HTML for the pages' Exact setting |
| `book/assets/js/` | The plates: shared models (`model.js`, `kernel.js`, `schedules-book.js`), each chapter's plates and workers (`chNN*.js`), the sentences under them as functions of their numbers (`say-chNN.js`), and the claim map |
| `tools/check_book.mjs`, `tools/checks/` | The checks, one file per chapter plus the shared ones; the run writes `book/checks.json`, which the build prints under each plate |
| `tools/validity/` | Reference values computed by the paper's code at the tag, and the scripts that compute them |
| `tools/shoot.mjs` | Opens the built pages in headless Chrome at phone and desktop widths, in both themes, and reports console errors, failed plates, and sideways scroll |
| `tools/math/render.mjs` | Sets the TeX in the built pages as SVG, so the pages load no math library |
| `tools/themed-figures/` | Redraws the paper's figures in the book's inks, one print for each theme |
| `docs/` | The built site |

## Build and check

```sh
npm install --prefix tools/math        # once
node tools/check_book.mjs              # every check; exits 1 on a failure
python3 book/build.py                  # writes docs/, then sets the math
node tools/shoot.mjs --both-widths index.html kernel/    # optional: pictures and console errors
python3 -m http.server 8750 --directory docs
```

`node tools/check_book.mjs ch06` runs the shared `book.mjs` and chapter 6's checks. The reference files in
`tools/validity/` are rebuilt with the paper repository's Python, as each script's header says.

The printed figures are redrawn from the paper's plotting script at the tag:

```sh
git -C ../speed-accuracy-tradeoff archive paper-v1.2 | tar -x -C /tmp/paper-v1.2
cd /tmp/paper-v1.2/paper && python3 <book>/tools/themed-figures/themed_figures.py render make_figures.py \
  --palette <book>/tools/themed-figures/palette-crash-course.json --roles <book>/tools/themed-figures/roles.json \
  --only kernels.pdf transfer.pdf --out <book>/book/assets/figures
```

## Licenses

The book's code and text are under the MIT License (`LICENSE`). Archivo and Source Serif 4 are under the SIL Open
Font License (`book/assets/fonts/OFL-*.txt`). The math is set at build time by MathJax (Apache License 2.0).
