# Waiting, weighted: a crash course

A course book for the paper *Waiting, weighted* ([source](https://github.com/ryanjosephkamp/speed-accuracy-tradeoff)),
built one result at a time on a cost-of-time schedule the reader picks or draws. Every figure on a chapter page is
computed in the browser from the paper's equations: the kernel from its series, the Laplace transform and the
transfer function from their closed forms, decision times sampled from the paper's start law, and the optimal bound
from a dynamic program on an evidence grid. A check script holds those computations to the paper's generated numbers
and code.

Chapter 6, the kernel and the theorem, is the first chapter built.

## Layout

| Path | What it holds |
|---|---|
| `paper/` | The paper's `main.tex`, generated numbers, and Table 1's rows at the tag `paper-v1.2`, and the number LaTeX gave each label (`labels.json`), copied by `tools/vendor_paper.py` |
| `book/content/` | The book's text: the contents page (`book.py`), each chapter (`ch06.py`), and the claim map's graph (`map.json`: 50 claims, 118 uses) |
| `book/build.py` | Builds `docs/` from the content and the paper; every number is a macro from `numbers.tex` and every cross-reference a label |
| `book/texconv.py` | Converts excerpts of `main.tex` to HTML for the Exact setting of the depth dial |
| `book/assets/js/kernel.js` | The chapter's model: the bound, the kernel, its transform, the transfer function, the start law, and the sampler |
| `book/assets/js/model.js` | The dynamic program and the per-moment bound, shared with the paper's site |
| `book/assets/js/claim-map.js` | The claim map in four views (Focus, Layers, Outline, Book path), with the reader's choice kept in their browser |
| `book/assets/js/ch06.js`, `say-ch06.js` | Chapter 6's plates, and the sentences under them as functions of their numbers |
| `tools/check_book.mjs` | The checks; writes `book/checks.json`, which the build prints under each plate |
| `tools/math/render.mjs` | Sets the TeX in the built pages as SVG, so the pages load no math library |
| `tools/themed-figures/` | Redraws the paper's figures in the book's inks, a print for each theme |
| `docs/` | The built site |

## Build

```sh
npm install --prefix tools/math        # once
node tools/check_book.mjs              # 59 checks; exits 1 on a failure
python3 book/build.py                  # writes docs/, then sets the math
python3 -m http.server 8750 --directory docs
```

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
