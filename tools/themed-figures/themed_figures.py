#!/usr/bin/env python3
"""Themed figures: draw a site's charts in its own palette, light and dark, and prove they plot the same data.

`render` runs a plotting script unchanged three times (plain, light, and dark) and catches each figure at
`savefig`, so the script writes nothing. For each figure it:

- records every plotted array (lines, points, bars and other patches, bands, error bars, images, and text placed
  in data coordinates), with the axis limits, scales, ticks, tick labels, and legend entries;
- recolors the themed runs by role: each color the script used maps to a role in the palette (the spot ink, the
  ink, a gray, or the paper), and axes, ticks, and grid take the palette's hairline colors on a transparent
  background; any color left unmapped stops the run;
- records the recolored figure again and stops the run if any array, tick, or label differs from the plain run's;
- writes `<stem>.light.svg` and `<stem>.dark.svg` (text as outlines, so no font is needed to view them), or
  lossless WebP at twice the size when an SVG would pass 300 KiB;
- writes `manifest.json`: the script, the data files it read with their SHA-256, the outputs, and the proof.

`picture` sets a raster image (a photo, a generated image, a chart with no data) on a mat in each theme and checks
that its pixels are unchanged.

Usage, from the folder the plotting script runs in:
    python3 themed_figures.py render make_figures.py --palette palette-specimen.json --roles roles.json \\
        --out site-figures [--spot 1] [--only trend.png] [--data extra.csv]
    python3 themed_figures.py picture photo.png --palette palette-specimen.json --out site-figures

Python 3.9 or newer with numpy and matplotlib. Pillow is needed for pictures and WebP output. fontTools (with
brotli for .woff2) instances the palette's variable font; without it, the palette's fallback family is used.
"""
import argparse
import hashlib
import io
import json
import os
import re
import runpy
import sys
import tempfile
from pathlib import Path

import numpy as np

SVG_LIMIT = 300 * 1024      # bytes: a larger drawing is written as lossless WebP at 2x
TEXT_FLOOR = 8.0            # points: no text in a themed figure is set smaller
ROLES = ("paper", "ink", "ink2", "ink3", "axis", "grid", "accent", "s1", "s2", "s3", "s4")
# Colors any script may use without a mapping: black is the ink, white the paper, and matplotlib's default grid
# gray the grid.
BASE_ROLES = {"#000000": "ink", "#ffffff": "paper", "#b0b0b0": "grid"}


class Fail(Exception):
    pass


# ---- palette and fonts ---------------------------------------------------------------------------------------------

def load_palette(path, spot=None):
    """The palette file's two themes, each with every role and the chosen spot ink as `accent`. Every spot ink is
    also a role of its own, `spot-<name>`."""
    path = Path(path).resolve()
    p = json.loads(path.read_text())
    spots = {str(k): v for k, v in p.get("spots", {}).items()}
    spot = str(spot if spot is not None else p.get("spot", next(iter(spots), "")))
    if spot not in spots:
        raise Fail(f"{path.name}: no spot ink {spot!r} (it has {', '.join(spots) or 'none'})")
    themes = {}
    for i, mode in enumerate(("light", "dark")):
        th = {k: str(v).lower() for k, v in p[mode].items()}
        th["accent"] = spots[spot][i].lower()
        for name, pair in spots.items():
            th[f"spot-{name}"] = pair[i].lower()
        missing = [r for r in ROLES + ("mat", "mat_line") if r not in th]
        if missing:
            raise Fail(f"{path.name}: the {mode} theme has no {', '.join(missing)}")
        th["mode"] = mode
        themes[mode] = th
    return {"name": p.get("name", path.stem), "path": path, "spot": spot, "themes": themes, "font": p.get("font")}


def font_rc(palette, cache_dir=None):
    """rcParams for the themed runs, and a record of the face used. A variable font named in the palette is
    instanced at the palette's axes (an optical size, say) at weights 400 and 600 and registered with matplotlib."""
    from matplotlib import font_manager
    f = palette.get("font") or {}
    family = list(f.get("fallback", ["DejaVu Sans"]))
    info = {"family": family[0], "instanced": False}
    src = f.get("file")
    if src:
        src = (palette["path"].parent / src).resolve()
        name = f.get("name", "Themed Chart")
        try:
            from fontTools.ttLib import TTFont
            from fontTools.varLib import instancer
            cache = Path(cache_dir or tempfile.gettempdir()) / f"themed-figures-fonts-{sha256_file(src)[:12]}"
            cache.mkdir(parents=True, exist_ok=True)
            slug = re.sub(r"\W+", "-", name.lower())
            for wght, style in ((400, "Regular"), (600, "SemiBold")):
                out = cache / f"{slug}-{wght}.ttf"
                if not out.exists():
                    font = TTFont(str(src))
                    font.flavor = None
                    # matplotlib kerns only from a legacy 'kern' table; dropping GPOS also lets older fontTools
                    # releases instance fonts whose GPOS they can't
                    if "GPOS" in font:
                        del font["GPOS"]
                    axes = {a.axisTag for a in font["fvar"].axes}
                    want = {k: v for k, v in {**f.get("axes", {}), "wght": wght}.items() if k in axes}
                    font = instancer.instantiateVariableFont(font, want)
                    table = font["name"]
                    for rec in list(table.names):
                        if rec.nameID in (1, 2, 3, 4, 6, 16, 17):
                            table.removeNames(nameID=rec.nameID)
                    full = f"{name} {style}"
                    for nid, val in ((1, name), (2, "Regular"), (3, full), (4, full), (6, full.replace(" ", "")),
                                     (16, name), (17, style)):
                        table.setName(val, nid, 3, 1, 0x409)
                    font["OS/2"].usWeightClass = wght
                    font.save(str(out))
                font_manager.fontManager.addfont(str(out))
            family = [name] + family
            info = {"family": name, "instanced": True, "file": src.name, "sha256": sha256_file(src),
                    "axes": f.get("axes", {})}
        except Exception as e:  # no fontTools, no brotli for .woff2, or a font it can't instance
            info["note"] = f"used the fallback face: {type(e).__name__}: {e}"[:200]
    rc = {"font.family": family, "mathtext.fontset": "custom", "mathtext.rm": family[0],
          "mathtext.it": family[0], "mathtext.bf": f"{family[0]}:semibold", "mathtext.fallback": "stixsans",
          "axes.titleweight": "semibold", "svg.fonttype": "path", "svg.hashsalt": "themed-figures"}
    return rc, info


# ---- hashes --------------------------------------------------------------------------------------------------------

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _h(a):
    """The SHA-256 of an array's dtype, shape, values, and mask."""
    a = np.ma.asarray(a)
    data, mask = np.ascontiguousarray(np.ma.getdata(a)), np.ma.getmaskarray(a)
    if data.dtype == object:
        data = np.array([repr(x) for x in data.ravel()]).reshape(data.shape)
    h = hashlib.sha256(f"{data.dtype.str}{data.shape}".encode())
    h.update(data.tobytes())
    if mask.any():
        h.update(b"mask" + np.packbits(mask).tobytes())
    return h.hexdigest()


def _hex(rgba):
    from matplotlib.colors import to_hex
    return to_hex(rgba, keep_alpha=False).lower()


# ---- recording what a figure plots ---------------------------------------------------------------------------------

def axes_tree(fig):
    """The figure's axes and every child axes (secondary axes, insets), in a fixed order."""
    out, stack = [], list(fig.axes)
    while stack:
        a = stack.pop(0)
        if a in out:
            continue
        out.append(a)
        stack[0:0] = list(getattr(a, "child_axes", []))
    return out


KNOWN = {"Line2D", "Text", "Annotation", "Spine", "XAxis", "YAxis", "Legend", "Rectangle", "AxesImage",
         "PathCollection", "LineCollection", "PolyCollection", "FillBetweenPolyCollection", "QuadMesh", "Polygon",
         "Wedge", "Circle", "Ellipse", "FancyBboxPatch", "FancyArrowPatch", "SecondaryAxis", "Axes",
         "EventCollection", "PatchCollection", "BarContainer"}


def capture(fig):
    """Every plotted array in the figure, axes by axes. Records data, not style: vertices, offsets, sizes, values,
    images with their extent, colormap, and normalization, limits, scales, ticks and their labels, legend entries,
    text with its position, and the type of any artist this module doesn't know (so a new kind is seen)."""
    from matplotlib.collections import Collection
    from matplotlib.image import AxesImage
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    from matplotlib.text import Annotation

    out = []
    for i, ax in enumerate(axes_tree(fig)):
        rec = {"axes": i, "type": type(ax).__name__,
               "xlim": [float(v) for v in ax.get_xlim()], "ylim": [float(v) for v in ax.get_ylim()],
               "xscale": ax.get_xscale(), "yscale": ax.get_yscale(),
               "xticks": [float(v) for v in ax.get_xticks()], "yticks": [float(v) for v in ax.get_yticks()],
               "xticklabels": [t.get_text() for t in ax.get_xticklabels()],
               "yticklabels": [t.get_text() for t in ax.get_yticklabels()],
               "title": ax.get_title(), "xlabel": ax.xaxis.get_label().get_text(),
               "ylabel": ax.yaxis.get_label().get_text(), "visible": ax.get_visible(), "series": []}
        for ln in ax.lines:
            if isinstance(ln, Line2D):
                rec["series"].append({"kind": "line", "label": str(ln.get_label()), "marker": str(ln.get_marker()),
                                      "linestyle": str(ln.get_linestyle()), "drawstyle": ln.get_drawstyle(),
                                      "visible": ln.get_visible(), "n": int(len(ln.get_xydata())),
                                      "hash": _h(ln.get_xydata())})
        for c in ax.collections:
            if isinstance(c, Collection):
                paths = c.get_paths()
                verts = [p.vertices for p in paths]
                codes = [p.codes if p.codes is not None else np.zeros(0, np.uint8) for p in paths]
                mapped = c.get_array() is not None
                norm = getattr(c, "norm", None)
                rec["series"].append({
                    "kind": type(c).__name__, "label": str(c.get_label()), "visible": c.get_visible(),
                    "offsets": _h(c.get_offsets()), "n_offsets": int(len(c.get_offsets())),
                    "paths": _h(np.concatenate(verts)) if verts else None, "n_paths": len(paths),
                    "codes": _h(np.concatenate(codes)) if codes else None,
                    "sizes": _h(c.get_sizes()) if hasattr(c, "get_sizes") and len(c.get_sizes()) else None,
                    "values": _h(c.get_array()) if mapped else None,
                    "cmap": c.get_cmap().name if mapped else None,
                    "norm": [type(norm).__name__, float(norm.vmin), float(norm.vmax)]
                            if mapped and norm is not None and norm.vmin is not None else None})
        for p in ax.patches:
            if isinstance(p, Patch):
                v = p.get_patch_transform().transform(p.get_path().vertices)
                rec["series"].append({"kind": type(p).__name__, "label": str(p.get_label()),
                                      "visible": p.get_visible(), "hash": _h(v)})
        for im in ax.images:
            if isinstance(im, AxesImage):
                two_d = np.ndim(im.get_array()) == 2
                rec["series"].append({"kind": "image", "shape": list(np.shape(im.get_array())),
                                      "hash": _h(im.get_array()), "extent": [float(v) for v in im.get_extent()],
                                      "origin": im.origin, "visible": im.get_visible(),
                                      "cmap": im.get_cmap().name if two_d else None,
                                      "clim": [float(v) for v in im.get_clim()] if two_d else None})
        for t in ax.texts:
            item = {"kind": type(t).__name__, "text": t.get_text(), "visible": t.get_visible(),
                    "position": [float(v) for v in np.ravel(t.get_position())]}
            if isinstance(t, Annotation):
                item["xy"] = [float(v) for v in np.ravel(t.xy)]
                item["xycoords"] = str(t.xycoords)
            rec["series"].append(item)
        others = sorted({type(ch).__name__ for ch in ax.get_children()} - KNOWN)
        if others:
            rec["other_artists"] = others
        if ax.get_legend() is not None:
            rec["legend"] = [t.get_text() for t in ax.get_legend().get_texts()]
        out.append(rec)
    if fig.legends:
        out.append({"figure_legends": [[t.get_text() for t in lg.get_texts()] for lg in fig.legends]})
    out.append({"suptitle": fig._suptitle.get_text() if fig._suptitle else None,
                "figure_texts": [t.get_text() for t in fig.texts]})
    return out


def digest(cap):
    return hashlib.sha256(json.dumps(cap, sort_keys=True).encode()).hexdigest()


def count_series(cap):
    return sum(len(a.get("series", [])) for a in cap)


def compare(a, b):
    """'same', or where two recordings first differ."""
    if digest(a) == digest(b):
        return "same"
    ja = json.dumps(a, sort_keys=True, indent=0).splitlines()
    jb = json.dumps(b, sort_keys=True, indent=0).splitlines()
    for i, (x, y) in enumerate(zip(ja, jb)):
        if x != y:
            return f"differs at line {i}: {x[:100]} against {y[:100]}"
    return f"differs in length: {len(ja)} against {len(jb)} lines"


def _main_color(art):
    """The color that identifies a legend entry's artist, as hex, or None."""
    from matplotlib.collections import Collection
    from matplotlib.colors import to_rgba
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    try:
        if isinstance(art, Line2D):
            c = art.get_color() if str(art.get_linestyle()).lower() not in ("none", "", " ") \
                else art.get_markeredgecolor()
            if isinstance(c, str) and c.lower() == "none":
                c = art.get_markerfacecolor()
            return _hex(to_rgba(c))
        if isinstance(art, Collection):
            fc, ec = art.get_facecolor(), art.get_edgecolor()
            c = fc[0] if len(fc) and fc[0][3] > 0 else (ec[0] if len(ec) else None)
            return _hex(c) if c is not None else None
        if isinstance(art, Patch):
            return _hex(art.get_facecolor()) if art.get_facecolor()[3] > 0 else _hex(art.get_edgecolor())
    except Exception:
        return None
    return None


def legend_mismatches(fig):
    """Legend entries whose handle color differs from the plotted artist with the same label, sorted. Recoloring
    must leave this list as it was in the plain run (normally empty)."""
    from matplotlib.container import BarContainer, ErrorbarContainer
    rows = []
    legends = [(ax, ax.get_legend()) for ax in axes_tree(fig) if ax.get_legend() is not None]
    legends += [(None, lg) for lg in fig.legends]
    for ax, leg in legends:
        by_label = {}
        for a in ([ax] if ax is not None else axes_tree(fig)):
            for art in list(a.lines) + list(a.collections) + list(a.patches):
                by_label.setdefault(str(art.get_label()), art)
            for ct in a.containers:
                if isinstance(ct, ErrorbarContainer) and ct.lines[0] is not None:
                    by_label.setdefault(str(ct.get_label()), ct.lines[0])
                elif isinstance(ct, BarContainer) and len(ct.patches):
                    by_label.setdefault(str(ct.get_label()), ct.patches[0])
        handles = getattr(leg, "legend_handles", None) or getattr(leg, "legendHandles", [])
        for hd, tx in zip(handles, leg.get_texts()):
            art = by_label.get(tx.get_text())
            if art is not None and hd is not None and _main_color(hd) != _main_color(art):
                rows.append(tx.get_text())
    return sorted(rows)


def tick_state(fig):
    """Each axis's tick positions and whether its locator is automatic, by axes index."""
    from matplotlib.ticker import FixedLocator
    out = {}
    for i, ax in enumerate(axes_tree(fig)):
        for name, axis in (("x", ax.xaxis), ("y", ax.yaxis)):
            out[(i, name)] = ([float(v) for v in axis.get_ticklocs()],
                              not isinstance(axis.get_major_locator(), FixedLocator))
    return out


def pin_ticks(fig, plain):
    """Set each automatic axis whose ticks differ from the plain run's to the plain run's ticks, keeping its
    limits. A different face has other metrics, so a layout can size the axes slightly differently and an
    automatic locator can pick other ticks; the data and limits don't change. Returns the axes pinned."""
    pinned = []
    now = tick_state(fig)
    axes = axes_tree(fig)
    for key, (ticks, auto) in now.items():
        want = plain.get(key)
        if want is None or want[0] == ticks or not auto:
            continue
        i, name = key
        ax = axes[i]
        lim = ax.get_xlim() if name == "x" else ax.get_ylim()
        (ax.set_xticks if name == "x" else ax.set_yticks)(want[0])
        (ax.set_xlim if name == "x" else ax.set_ylim)(lim)
        pinned.append(f"axes {i} {name}")
    return pinned


# ---- recoloring ----------------------------------------------------------------------------------------------------

class Recolor:
    """Maps colors to a theme's role colors. `roles` is {original hex: role}. A color the script used is looked up
    first; a color that is already the theme's own passes; anything else is noted as missing."""

    def __init__(self, th, roles):
        from matplotlib.colors import to_rgba
        self.th = th
        self.roles = {k.lower(): v for k, v in {**BASE_ROLES, **roles}.items()}
        self.missing = set()
        self.allowed = {_hex(to_rgba(v)) for k, v in th.items() if k in ROLES or k.startswith("spot-")}
        for k, role in self.roles.items():
            if role != "none" and role not in th:
                raise Fail(f"role {role!r} for {k} isn't in the palette (roles: {', '.join(ROLES)}, spot-<name>, "
                           f"or none)")

    def __call__(self, c):
        from matplotlib.colors import to_rgba
        if c is None or (isinstance(c, str) and c.lower() == "none"):
            return c
        rgba = to_rgba(c)
        if rgba[3] == 0:
            return "none"   # stays invisible (an RGBA tuple would take the artist's own alpha)
        key = _hex(rgba)
        role = self.roles.get(key)
        if role == "none":
            return "none"
        if role is not None:
            new = to_rgba(self.th[role])
            return (new[0], new[1], new[2], rgba[3])
        if key in self.allowed:
            return rgba
        self.missing.add(key)
        return rgba

    def many(self, arr):
        from matplotlib.colors import to_rgba
        arr = np.asarray(arr)
        if arr.size == 0 or (arr[:, 3] == 0).all():
            return "none" if arr.size else arr
        out = []
        for x in arr:
            c = self(tuple(x))
            out.append((0, 0, 0, 0) if isinstance(c, str) else to_rgba(c))
        return np.array(out)


def _mapped(c):
    """A collection drawn through a colormap (a heat map, points colored by value) keeps its colormap."""
    return c.get_array() is not None


def restyle(fig, th, roles, hide_box=True, text_floor=TEXT_FLOOR):
    """Recolor a caught figure in place for theme `th`, and raise any text under `text_floor` points to it. Returns
    the colors with no role."""
    from matplotlib.collections import Collection
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    from matplotlib.spines import Spine
    from matplotlib.text import Text

    rc = Recolor(th, roles)
    axes = axes_tree(fig)
    secondary = {ch for a in axes for ch in getattr(a, "child_axes", [])}
    fig.patch.set_facecolor("none")
    fig.patch.set_edgecolor("none")
    skip, tick_labels, grid_lines, tick_lines = {fig.patch}, set(), set(), set()
    for ax in axes:
        skip.add(ax.patch)
        fc = ax.patch.get_facecolor()
        ax.patch.set_facecolor("none" if fc[3] == 0 or _hex(fc) == "#ffffff" else rc(fc))
        for side, sp in ax.spines.items():
            skip.add(sp)
            if hide_box and not ax.images and side in ("top", "right") and ax not in secondary:
                sp.set_visible(False)
            sp.set_edgecolor(th["axis"])
            sp.set_linewidth(min(sp.get_linewidth(), 0.8))
        for axis in (ax.xaxis, ax.yaxis):
            for tk in axis.get_major_ticks() + axis.get_minor_ticks():
                tick_lines.update([tk.tick1line, tk.tick2line])
                grid_lines.add(tk.gridline)
                tick_labels.update([tk.label1, tk.label2])
            grid_lines.update(axis.get_gridlines())
        ax.tick_params(which="both", colors=th["axis"], labelcolor=th["ink2"])
    for leg in [ax.get_legend() for ax in axes if ax.get_legend() is not None] + list(fig.legends):
        leg.get_frame().set_facecolor("none")
        leg.get_frame().set_edgecolor("none")
        skip.add(leg.get_frame())
        if leg.get_title() is not None:
            leg.get_title().set_color(th["ink2"])
            skip.add(leg.get_title())
    for art in fig.findobj():
        if art in skip or isinstance(art, Spine):
            continue
        if isinstance(art, Text):
            if text_floor and art.get_fontsize() < text_floor:
                art.set_fontsize(text_floor)
            art.set_color(th["ink2"] if art in tick_labels else rc(art.get_color()))
            box = art.get_bbox_patch()
            if box is not None:
                box.set_facecolor(rc(box.get_facecolor()))
                box.set_edgecolor(rc(box.get_edgecolor()))
                skip.add(box)
        elif isinstance(art, Line2D):
            if art in grid_lines:
                art.set_color(th["grid"])
            elif art in tick_lines:
                art.set_color(th["axis"])
                art.set_markeredgecolor(th["axis"])
            else:
                markers_only = str(art.get_linestyle()).lower() in ("none", "", " ")
                # a markers-only line's own color is never drawn unless its markers take it
                if not (markers_only and _hex(art.get_color()) not in rc.roles):
                    art.set_color(rc(art.get_color()))
                art.set_markerfacecolor(rc(art.get_markerfacecolor()))
                art.set_markeredgecolor(rc(art.get_markeredgecolor()))
                if art.get_markerfacecoloralt() not in (None, "none"):
                    art.set_markerfacecoloralt(rc(art.get_markerfacecoloralt()))
        elif isinstance(art, Collection):
            if not _mapped(art):
                art.set_facecolor(rc.many(art.get_facecolor()))
                art.set_edgecolor(rc.many(art.get_edgecolor()))
        elif isinstance(art, Patch):
            art.set_facecolor(rc(art.get_facecolor()))
            art.set_edgecolor(rc(art.get_edgecolor()))
    return rc.missing


def leftovers(fig, th):
    """Visible colors the theme doesn't define, with the artist that carries each (colormapped images and
    collections excepted)."""
    from matplotlib.collections import Collection
    from matplotlib.colors import to_rgba
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    from matplotlib.text import Text

    allowed = {_hex(to_rgba(v)) for k, v in th.items() if k in ROLES or k.startswith("spot-")}
    found = set()

    def chk(c, art):
        if c is None or (isinstance(c, str) and c.lower() == "none"):
            return
        rgba = to_rgba(c)
        if rgba[3] > 0 and _hex(rgba) not in allowed:
            label = art.get_text() if isinstance(art, Text) else art.get_label()
            found.add(f"{_hex(rgba)} ({type(art).__name__} {str(label)[:30]!r})")

    for art in fig.findobj():
        if not art.get_visible():
            continue
        if isinstance(art, Text):
            if art.get_text():
                chk(art.get_color(), art)
        elif isinstance(art, Line2D):
            has_marker = art.get_marker() not in (None, "None", "", " ")
            if len(art.get_xydata()) or has_marker:
                if str(art.get_linestyle()).lower() not in ("none", "", " "):
                    chk(art.get_color(), art)
                if has_marker:
                    chk(art.get_markerfacecolor(), art)
                    chk(art.get_markeredgecolor(), art)
        elif isinstance(art, Collection) and not _mapped(art):
            for c in list(art.get_facecolor()) + list(art.get_edgecolor()):
                chk(tuple(c), art)
        elif isinstance(art, Patch):
            if art is fig.patch or (art.axes is not None and art is art.axes.patch):
                continue
            chk(art.get_facecolor(), art)
            chk(art.get_edgecolor(), art)
    return found


# ---- writing -------------------------------------------------------------------------------------------------------

def _savefig(fig, *args, **kwargs):
    """matplotlib's own Figure.savefig, even while Catch has replaced it."""
    from matplotlib.figure import Figure
    return getattr(Figure, "_themed_original_savefig", Figure.savefig)(fig, *args, **kwargs)


def stable_ids(svg):
    """Rename matplotlib's hashed clip-path and marker ids by order of first appearance, so the same drawing gives
    the same bytes under another matplotlib version."""
    names = {}
    for m in re.finditer(r'id="([pm][0-9a-f]{10})"', svg):
        if m.group(1) not in names:
            names[m.group(1)] = f"{'clip' if m.group(1)[0] == 'p' else 'mark'}{len(names)}"
    if not names:
        return svg
    pat = re.compile(r'(?<=[#"])(' + "|".join(map(re.escape, names)) + r')(?=[")])')
    return pat.sub(lambda m: names[m.group(1)], svg)


def draw_variant(fig, stem, mode, save_kwargs):
    """Draw <stem>.<mode>.svg in memory, or .webp (lossless, at 2x) when the SVG would pass 300 KiB."""
    import matplotlib
    kw = {k: v for k, v in save_kwargs.items() if k in ("bbox_inches", "pad_inches", "bbox_extra_artists")}
    buf = io.BytesIO()
    with matplotlib.rc_context({"svg.fonttype": "path", "svg.hashsalt": "themed-figures"}):
        _savefig(fig, buf, format="svg", transparent=True, metadata={"Date": None}, **kw)
    data = stable_ids(buf.getvalue().decode("utf-8")).encode("utf-8")
    if len(data) <= SVG_LIMIT:
        head = data[:2000].decode("utf-8", "replace")
        w, h = (float(re.search(fr'{k}="([0-9.]+)pt"', head).group(1)) for k in ("width", "height"))
        return {"path": f"{stem}.{mode}.svg", "format": "svg", "css_px": [round(w * 4 / 3), round(h * 4 / 3)],
                "data": data}
    png = io.BytesIO()
    _savefig(fig, png, format="png", dpi=192, transparent=True, **kw)
    try:
        from PIL import Image
    except ImportError:
        return {"path": f"{stem}.{mode}.png", "format": "png", "css_px": None, "data": png.getvalue()}
    im = Image.open(io.BytesIO(png.getvalue())).convert("RGBA")
    webp = io.BytesIO()
    im.save(webp, format="WEBP", lossless=True, method=6)
    return {"path": f"{stem}.{mode}.webp", "format": "webp", "css_px": [round(im.width / 2), round(im.height / 2)],
            "data": webp.getvalue()}


def write_variant(out_dir, drawn):
    """Write a drawn print and return its manifest entry."""
    path = Path(out_dir) / drawn["path"]
    path.write_bytes(drawn["data"])
    return {"path": path.name, "format": drawn["format"], "bytes": path.stat().st_size, "sha256": sha256_file(path),
            "css_px": drawn["css_px"]}


def pixel_compare(a, b):
    """How a plain rerun's PNG compares with the script's own saved one: same size, identical, and the share of
    pixels that differ at all and by more than 8 levels in a channel."""
    from PIL import Image
    ia, ib = Image.open(a).convert("RGBA"), Image.open(b).convert("RGBA")
    if ia.size != ib.size:
        return {"same_size": False, "saved": list(ia.size), "rerun": list(ib.size)}
    d = np.abs(np.asarray(ia, dtype=np.int16) - np.asarray(ib, dtype=np.int16)).max(axis=2)
    return {"same_size": True, "identical": bool((d == 0).all()),
            "pixels_differing_pct": round(float((d > 0).mean() * 100), 3),
            "pixels_differing_over_8_levels_pct": round(float((d > 8).mean() * 100), 3)}


# ---- running a script ----------------------------------------------------------------------------------------------

class Catch:
    """Replace Figure.savefig while a script runs. Each save goes to `handler(name, fig, kwargs, save_plain)`, where
    `save_plain(path)` writes the figure as the script asked; nothing is written otherwise."""

    def __init__(self, handler):
        self.handler, self.seen = handler, []

    def __enter__(self):
        from matplotlib.figure import Figure
        self._orig = Figure.savefig
        Figure._themed_original_savefig = self._orig
        catch = self

        def savefig(fig, fname, *args, **kwargs):
            if isinstance(fname, (str, os.PathLike)):
                name = os.path.basename(os.fspath(fname))
            else:
                name = f"figure-{len(catch.seen) + 1}.png"   # saved to a buffer: named by its order
            catch.seen.append((name, fname))
            catch.handler(name, fname, fig, kwargs, lambda path: catch._orig(fig, path, *args, **kwargs))

        Figure.savefig = savefig
        return self

    def __exit__(self, *exc):
        from matplotlib.figure import Figure
        Figure.savefig = self._orig
        del Figure._themed_original_savefig
        return False


_READS = {"on": False, "root": None, "files": set()}


def _audit(event, args):
    # records the files a script opens for reading under its folder: its data
    if not _READS["on"] or event != "open" or not args or not isinstance(args[0], (str, bytes, os.PathLike)):
        return
    mode, flags = args[1], args[2] if len(args) > 2 else 0
    if mode is not None:
        if any(ch in str(mode) for ch in "wax+"):
            return
    elif flags & (os.O_WRONLY | os.O_RDWR):
        return
    try:
        p = Path(os.fsdecode(args[0])).resolve()
    except (OSError, ValueError):
        return
    root = _READS["root"]
    if p.suffix not in (".py", ".pyc", ".pyo") and (p == root or root in p.parents) and p.is_file():
        _READS["files"].add(p.relative_to(root).as_posix())


_HOOKED = []


def run_script(script, cwd, argv=()):
    """Run a plotting script as __main__ with `cwd` as the working folder. Returns the files under `cwd` it read."""
    if not _HOOKED:
        sys.addaudithook(_audit)
        _HOOKED.append(True)
    old = (os.getcwd(), list(sys.argv), list(sys.path), sys.dont_write_bytecode)
    _READS.update(on=True, root=Path(cwd).resolve(), files=set())
    try:
        os.chdir(cwd)
        sys.argv = [str(script)] + list(argv)
        sys.path.insert(0, str(Path(script).parent))
        sys.dont_write_bytecode = True
        runpy.run_path(str(script), run_name="__main__")
    finally:
        _READS["on"] = False
        os.chdir(old[0])
        sys.argv, sys.path, sys.dont_write_bytecode = old[1], old[2], old[3]
    return set(_READS["files"])


def versions():
    import platform
    out = {"python": platform.python_version()}
    for mod in ("numpy", "matplotlib", "PIL", "fontTools"):
        try:
            out[mod] = getattr(__import__(mod), "__version__", "?")
        except Exception:
            pass
    return out


def _rel(path, root):
    path, root = Path(path).resolve(), Path(root).resolve()
    return path.relative_to(root).as_posix() if root in path.parents or path == root else path.name


def write_manifest(out_dir, head, entries):
    """Write or update out_dir/manifest.json: the head, and the entries, replacing any of the same name."""
    p = Path(out_dir) / "manifest.json"
    old = json.loads(p.read_text()) if p.exists() else {}
    names = {e["name"] for e in entries}
    figures = [e for e in old.get("figures", []) if e.get("name") not in names] + entries
    m = {**old, **head, "figures": sorted(figures, key=lambda e: e["name"])}
    p.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
    return p


# ---- render: charts ------------------------------------------------------------------------------------------------

def render(script, palette, out, roles=None, only=None, data=(), cwd=None, argv=(), font_cache=None):
    """Run `script` plain, light, and dark; write each caught figure's two prints and manifest.json into `out`.
    `roles` is {"roles": {hex: role}, "figures": {file name: {"roles": {...}, "stem": ..., "note": ...,
    "hide_box": bool}}}. Raises Fail when a figure isn't drawn in every run, a color has no role, or a themed
    run's arrays differ from the plain run's. Returns the manifest's path."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    script = Path(script).resolve()
    cwd = Path(cwd).resolve() if cwd else script.parent
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    roles = roles or {}
    every = roles.get("roles", {})
    per = roles.get("figures", {})
    themed_rc, font = font_rc(palette, font_cache)
    plain_rc = {k: matplotlib.rcParamsDefault[k] for k in themed_rc}
    caps = {m: {} for m in ("plain", "light", "dark", "light_before", "dark_before")}
    legends = {m: {} for m in ("plain", "light", "dark")}
    ticks, pinned, outputs, pixels, order, read = {}, {}, {}, {}, [], set()

    def wanted(name):
        return not only or name in only

    # the plain reruns compared with the script's own saved files go to a folder removed afterward
    with tempfile.TemporaryDirectory(prefix="themed-figures-") as tmp:
        for mode in ("plain", "light", "dark"):
            def handler(name, fname, fig, kwargs, save_plain, mode=mode):
                if not wanted(name):
                    return
                _READS["on"] = False   # what the handler reads (the saved figure) isn't the script's data
                try:
                    if hasattr(fig, "draw_without_rendering"):
                        fig.draw_without_rendering()   # apply the layout, as saving would, before recording
                    else:
                        fig.canvas.draw()
                    if mode == "plain":
                        if name in caps["plain"]:
                            raise Fail(f"{name} is saved twice; give each figure its own file name")
                        order.append(name)
                        caps["plain"][name] = capture(fig)
                        legends["plain"][name] = legend_mismatches(fig)
                        ticks[name] = tick_state(fig)
                        saved = cwd / fname if isinstance(fname, (str, os.PathLike)) else None
                        if saved is not None and saved.suffix.lower() == ".png" and saved.is_file():
                            rerun = Path(tmp) / name
                            save_plain(rerun)
                            pixels[name] = pixel_compare(saved, rerun)
                        return
                    spec = per.get(name, {})
                    th = palette["themes"][mode]
                    pinned.setdefault(name, {})[mode] = pin_ticks(fig, ticks.get(name, {}))
                    if pinned[name][mode]:
                        fig.draw_without_rendering() if hasattr(fig, "draw_without_rendering") else fig.canvas.draw()
                    caps[f"{mode}_before"][name] = capture(fig)
                    missing = restyle(fig, th, {**every, **spec.get("roles", {})}, hide_box=spec.get("hide_box", True),
                                      text_floor=spec.get("text_floor", TEXT_FLOOR))
                    left = leftovers(fig, th)
                    if missing or left:
                        raise Fail(f"{name} ({mode}): colors with no role: {', '.join(sorted(missing | left))}; "
                                   "map each in the roles file")
                    caps[mode][name] = capture(fig)
                    legends[mode][name] = legend_mismatches(fig)
                    stem = spec.get("stem", Path(name).stem)
                    outputs.setdefault(name, {})[mode] = draw_variant(fig, stem, mode, kwargs)
                finally:
                    _READS["on"] = True

            with matplotlib.rc_context({**plain_rc, **({} if mode == "plain" else themed_rc)}):
                with Catch(handler) as c:
                    try:
                        read |= run_script(script, cwd, argv)
                    finally:
                        plt.close("all")
            drawn = {n for n, _ in c.seen if wanted(n)}
            if mode == "plain" and not drawn:
                raise Fail(f"{script.name} saved no figures{' named ' + ', '.join(only) if only else ''}")
            if mode != "plain" and set(order) - drawn:
                raise Fail(f"{mode}: {', '.join(sorted(set(order) - drawn))} weren't drawn")

    files = sorted(read | {_rel(Path(d) if Path(d).is_absolute() else cwd / d, cwd) for d in data})
    entries = []
    for name in order:
        spec = per.get(name, {})
        plain = caps["plain"][name]
        details = {}
        for m in ("light", "dark"):
            details[m] = compare(plain, caps[m][name])
            details[f"{m}_before_recolor"] = compare(plain, caps[f"{m}_before"][name])
            details[f"{m}_legend"] = "same" if legends[m][name] == legends["plain"][name] else \
                f"differs: {legends[m][name]} against {legends['plain'][name]}"
        ok = all(v == "same" for v in details.values())
        if not ok:
            raise Fail(f"{name}: a themed print doesn't plot what the plain run plots: "
                       f"{ {k: v for k, v in details.items() if v != 'same'} }")
        entries.append({
            "name": spec.get("stem", Path(name).stem), "saved_as": name, "kind": "chart",
            "script": _rel(script, cwd),
            "data": [{"path": f, "sha256": sha256_file(cwd / f)} for f in files if (cwd / f).is_file()],
            "outputs": outputs[name],
            "check": {"arrays_same_as_plain_run": ok, "series": count_series(plain),
                      "axes": sum(1 for a in plain if "axes" in a), "arrays_sha256": digest(plain),
                      "details": details, "ticks_pinned_to_plain": pinned.get(name, {}),
                      "plain_rerun_vs_saved": pixels.get(name)},
            "roles": {**every, **spec.get("roles", {})},
            "note": spec.get("note"),
        })
    # every figure passed: only now are the prints written
    for e in entries:
        e["outputs"] = {m: write_variant(out, v) for m, v in e["outputs"].items()}
    head = {"renderer": "themed_figures.py", "renderer_sha256": sha256_file(Path(__file__)),
            "palette": palette["name"], "spot": palette["spot"], "font": font, "versions": versions(),
            "background": {"light": palette["themes"]["light"]["paper"], "dark": palette["themes"]["dark"]["paper"],
                           "note": "Charts are transparent and drawn for these papers; pictures carry a mat."},
            "themes": {m: {k: v for k, v in palette["themes"][m].items() if k in ROLES}
                       for m in ("light", "dark")}}
    return write_manifest(out, head, entries)


# ---- picture: a raster image on a mat ------------------------------------------------------------------------------

def picture(src, palette, out, stem=None, note=None):
    """Set a picture on a mat in each theme, its pixels unchanged (checked), as lossless WebP. Returns the
    manifest's path."""
    from PIL import Image
    src = Path(src)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    stem = stem or src.stem
    im = Image.open(src)
    im.load()
    rgb = im.convert("RGB")
    w, h = rgb.size
    pad = max(8, round(0.025 * max(w, h)))
    outputs = {}
    for mode in ("light", "dark"):
        th = palette["themes"][mode]
        canvas = Image.new("RGB", (w + 2 * pad, h + 2 * pad), th["mat"])
        canvas.paste(Image.new("RGB", (w + 2, h + 2), th["mat_line"]), (pad - 1, pad - 1))   # a hairline around it
        canvas.paste(rgb, (pad, pad))
        path = out / f"{stem}.{mode}.webp"
        canvas.save(path, format="WEBP", lossless=True, method=6)
        back = Image.open(path).convert("RGB").crop((pad, pad, pad + w, pad + h))
        kept = bool(np.array_equal(np.asarray(back), np.asarray(rgb)))
        if not kept:
            raise Fail(f"{src.name} ({mode}): the picture's pixels changed on the mat")
        outputs[mode] = {"path": path.name, "format": "webp", "bytes": path.stat().st_size,
                         "sha256": sha256_file(path), "px": [canvas.width, canvas.height], "pixels_kept": kept}
    entry = {"name": stem, "saved_as": src.name, "kind": "picture", "source": {"path": src.name,
             "sha256": sha256_file(src)}, "outputs": outputs,
             "check": {"pixels_kept": True,
                       "source_pixels_sha256": hashlib.sha256(np.asarray(rgb).tobytes()).hexdigest(),
                       "mat_px": pad},
             "note": note}
    head = {"renderer": "themed_figures.py", "palette": palette["name"]}
    return write_manifest(out, head, [entry])


# ---- command line --------------------------------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="Draw a site's charts in its palette, light and dark, and prove they "
                                             "plot the same data.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render", help="run a plotting script and write each figure's light and dark prints")
    r.add_argument("script")
    r.add_argument("--palette", required=True)
    r.add_argument("--roles", help="JSON: {\"roles\": {hex: role}, \"figures\": {file name: {...}}}")
    r.add_argument("--out", required=True)
    r.add_argument("--spot", help="the palette's spot ink to use as the accent (default: the palette's own)")
    r.add_argument("--only", nargs="+", help="only these saved file names")
    r.add_argument("--data", nargs="+", default=[],
                   help="data files (from the script's folder) to record that the script doesn't open itself")
    r.add_argument("--cwd", help="the folder the script runs in (default: the script's own)")
    r.add_argument("--font-cache", help="where instanced fonts are kept (default: the system's temporary folder)")
    r.add_argument("--args", nargs=argparse.REMAINDER, default=[], help="arguments passed to the script")
    p = sub.add_parser("picture", help="set a raster image on a mat in each theme, pixels unchanged")
    p.add_argument("image")
    p.add_argument("--palette", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--stem")
    p.add_argument("--note")
    a = ap.parse_args(argv)
    try:
        palette = load_palette(a.palette, getattr(a, "spot", None))
        if a.cmd == "render":
            roles = json.loads(Path(a.roles).read_text()) if a.roles else {}
            m = render(a.script, palette, a.out, roles, a.only, a.data, a.cwd, a.args, a.font_cache)
            figs = json.loads(m.read_text())["figures"]
            for f in figs:
                if f["kind"] == "chart":
                    c = f["check"]
                    print(f"{f['name']}: {c['series']} series on {c['axes']} axes, the same in the light and dark "
                          f"prints as in the plain run; {', '.join(o['path'] for o in f['outputs'].values())}")
        else:
            m = picture(a.image, palette, a.out, a.stem, a.note)
            print(f"{a.image}: pixels kept on both mats; wrote {m.parent}")
        print(f"wrote {m}")
    except Fail as e:
        print(f"themed_figures: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
