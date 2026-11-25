// Chapter 6's plates. Every number drawn comes from kernel.js (the series, the closed forms, the sampler) or from
// the dynamic program in the worker; the words under each plate come from the functions in say-ch06.js, which take
// numbers and return sentences.
import * as K from "./kernel.js?v=f47f3f996a";
import { labelOf, PRESETS, DRAW, paramsOf, VIEW, defaultDrawing } from "./schedules-book.js?v=f47f3f996a";
import { getChoice, setChoice, solve, onVisible, watchVisible, liftReady, calm, seedParam } from "./book.js?v=f47f3f996a";
import { frame, line, area, axes, svg, tags, fmt, keepDrawn } from "./chart.js?v=f47f3f996a";
import * as S from "./say-ch06.js?v=f47f3f996a";
import { SCALE, scaleJob, scaleGaps, YOURS_EPS, yoursPlateState, errorMarks, yoursVerdict, predictView, responseChart } from "./ch06-model.js?v=f47f3f996a";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const maxAbs = (arr) => arr.reduce((m, v) => (Number.isFinite(v) ? Math.max(m, Math.abs(v)) : m), 0);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));

// ---------------------------------------------------------------- the hero: the kernel sliding along a cost
function hero() {
  const fig = document.getElementById("hero-proof");
  const el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const c0 = 0.1, size = 0.3, om = 2, T = 4;
  const cost = (t) => c0 * (1 + size * Math.sin(om * t));
  const gamma = (t) => c0 * size * Math.sin(om * t);
  const ts = range(0, T, 161);
  const b0 = K.B(c0);
  const beta = K.firstOrder(gamma, ts, c0);
  const fo = ts.map((t, i) => b0 + beta[i]);
  const pm = ts.map((t) => K.B(cost(t)));
  const times = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3];
  const median = (() => { const { edges, w } = K.kernelBins(c0); let acc = 0; for (let j = 0; j < w.length; j++) { if (acc + w[j] >= 0.5) return edges[j] + ((0.5 - acc) / w[j]) * (edges[j + 1] - edges[j]); acc += w[j]; } return NaN; })();
  let cur = 2;
  const draw = (i) => {
    cur = i;
    const t0 = times[i];
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(240, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const split = Math.round(H * 0.5);
    const top = { W, H: split, l: 12, r: 10, t: 16, b: 10, x: [0, T], y: [0.06, 0.135] };
    const fT = { ...top, sx: (v) => top.l + (v / T) * (W - top.l - top.r), sy: (v) => top.t + (1 - (v - 0.06) / 0.075) * (top.H - top.t - top.b) };
    const bot = { W, H, l: 12, r: 10, t: split + 18, b: 20 };
    const lo = Math.min(...fo, ...pm) - 0.03, hi = Math.max(...fo, ...pm) + 0.03;
    const fB = { ...bot, x: [0, T], y: [lo, hi], sx: fT.sx, sy: (v) => bot.t + (1 - (v - lo) / (hi - lo)) * (H - bot.t - bot.b) };
    // the kernel, forward from t0, as a green shape under the cost
    const ss = range(0.004, T - t0, 120);
    const ws = ss.map((s) => K.kernelAt(s, c0));
    const scale = 0.055 / 3.2;
    let k = `M${fT.sx(t0).toFixed(1)} ${fT.sy(0.06).toFixed(1)}`;
    ss.forEach((s, j) => { k += `L${fT.sx(t0 + s).toFixed(1)} ${fT.sy(0.06 + Math.min(ws[j], 3.2) * scale).toFixed(1)}`; });
    k += `L${fT.sx(T).toFixed(1)} ${fT.sy(0.06).toFixed(1)}Z`;
    let s = `<path class="wb-fill" d="${k}"/>`;
    s += line(fT, ts, ts.map(cost), "cost");
    s += `<path class="ax" d="M${fT.l} ${fT.sy(0.06).toFixed(1)}H${W - fT.r}M${fT.l} ${fB.H - fB.b}H${W - fT.r}"/>`;
    s += `<text class="lab" x="${fT.l}" y="11">cost, and the weights from time ${t0.toFixed(1)}</text>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${fT.sx(t0).toFixed(1)} ${fT.t}V${fB.H - fB.b}"/>`;
    const upto = ts.findIndex((t) => t > t0);
    s += line(fB, ts, pm, "pm") + line(fB, ts, fo, "wb-thin") + line(fB, ts.slice(0, upto), fo.slice(0, upto), "wb");
    const iy = fo[upto - 1];
    s += `<circle class="wb-dot" cx="${fB.sx(ts[upto - 1]).toFixed(1)}" cy="${fB.sy(iy).toFixed(1)}" r="4.5"/>`;
    s += `<text class="lab" x="${fT.l}" y="${bot.t - 2}">the bound: first order (green) and per-moment (dashed)</text>`;
    s += `<text class="tk" x="${fT.sx(0)}" y="${H - 6}" text-anchor="middle">0</text><text class="tk" x="${fT.sx(T)}" y="${H - 6}" text-anchor="end">time ${T}</text>`;
    el.innerHTML = s;
  };
  draw(2);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) {
    window.ChapterHero.live(fig, { steps: times.length, draw, label: (i) => S.heroLabel(times[i], median) });
  }
}

// ---------------------------------------------------------------- plate: shrink the change
function scalePlate() {
  const fig = plate("scale"), el = rootOf("scale");
  if (!el) return;
  const EPS = SCALE.eps, VIEW4 = SCALE.view;
  el.innerHTML = `<div class="controls">${segHTML("sc-eps", EPS.map((e) => [e, Math.round(e * 100) + "%"]), 0.1, "Size of the change, ε")}
    <div class="actions"><button class="btn" type="button" id="sc-play" aria-pressed="false">Play</button></div></div>
    <div class="chart-wrap" id="sc-chart"></div>
    <ul class="legend"><li><span class="key key-ex">Program, ÷ ε</span></li><li><span class="key key-wb">First order, β</span></li><li><span class="key key-pm">Per-moment</span></li></ul>
    <dl class="reads" id="sc-reads"></dl><p class="say" id="sc-say"></p><p class="fine" id="sc-state" aria-live="polite">Solving four dynamic programs…</p>`;
  const chart = $("#sc-chart", el), reads = $("#sc-reads", el), say = $("#sc-say", el), state = $("#sc-state", el), play = $("#sc-play", el);
  let data = null, sel = 3, timer = 0;
  const draw = () => {
    if (!data) return;
    const { t, dev, beta, pmr, gFo: gFoAll, gPm: gPmAll } = data;
    const all = [...beta, ...pmr, ...dev.flat()].filter(Number.isFinite);
    const lim = Math.max(...all.map(Math.abs)) * 1.12;
    const f = frame(chart, { x: [0, VIEW4], y: [-lim, lim], aspect: 0.5, minH: 190, maxH: 300 });
    let s = axes(f, { yl: "(b − b₀) ÷ ε", xl: "time", grid: true, zero: true });
    dev.forEach((d, k) => { if (k !== sel) s += line(f, t, d, "ex-thin"); });
    s += line(f, t, pmr, "pm") + line(f, t, beta, "wb") + line(f, t, dev[sel], "ex");
    chart.innerHTML = svg(f, s, `The bound's move divided by epsilon for a ${Math.round(EPS[sel] * 100)}% change, beside the first-order and per-moment responses`);
    const gFo = gFoAll[sel], gPm = gPmAll[sel];
    reads.innerHTML = `<div class="k-wb"><dt>Largest gap to β</dt><dd>${fmt(gFo, 3)}<small>between times ${SCALE.lo} and ${SCALE.hi}</small></dd></div>
      <div class="k-pm"><dt>Largest gap to per-moment</dt><dd>${fmt(gPm, 3)}<small>same window</small></dd></div>
      <div><dt>Swing of β</dt><dd>${fmt(maxAbs(beta), 3)}<small>for comparison</small></dd></div>`;
    say.textContent = S.scaleSay(EPS[sel], gFo, gPm, gFoAll, EPS, gPmAll);
    liftReady(fig);
  };
  const run = () => {
    solve(scaleJob(), { progress: (p) => { state.textContent = `Solving four dynamic programs… ${Math.round(p * 4)} of 4`; } }).then((m) => {
      data = scaleGaps(m);
      state.textContent = "Time step 0.01, evidence step 0.02, 6 time units past the window.";
      keepDrawn(chart, draw);
      startPlay();
    }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
  };
  const choose = (k) => { sel = k; el.querySelectorAll('input[name="sc-eps"]').forEach((r) => { r.checked = +r.value === EPS[k]; }); draw(); };
  onSeg(el, "sc-eps", (v) => { stopPlay(); choose(EPS.indexOf(+v)); });
  let visible = false, playing = false;
  const tick = () => { if (!playing || !visible) return; choose((sel + 1) % EPS.length); timer = setTimeout(tick, 1500); };
  const startPlay = () => { if (calm.matches) return; playing = true; play.setAttribute("aria-pressed", "true"); play.textContent = "Pause"; clearTimeout(timer); sel = 0; choose(0); timer = setTimeout(tick, 1500); };
  const stopPlay = () => { playing = false; clearTimeout(timer); play.setAttribute("aria-pressed", "false"); play.textContent = "Play"; };
  play.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
  watchVisible(fig, (v) => { visible = v; if (v && playing) { clearTimeout(timer); timer = setTimeout(tick, 1500); } });
  run();
}

// ---------------------------------------------------------------- plate: draw the weights
function sketchPlate() {
  const fig = plate("sketch"), el = rootOf("sketch");
  if (!el) return;
  const S_MAX = 3, N = 61, sx = range(0, S_MAX, N);
  let ys = new Array(N).fill(0), shown = false, c0 = 0.1, drew = false;
  el.innerHTML = `<div class="controls">${segHTML("sk-c", [[0.02, "0.02"], [0.1, "0.1"], [0.5, "0.5"]], c0, "Cost of time, c₀")}
    <div class="actions"><button class="btn btn-go" type="button" id="sk-show">Show the kernel</button><button class="btn" type="button" id="sk-clear">Clear</button></div></div>
    <div class="chart-wrap pad is-draw" id="sk-chart"></div>
    <dl class="reads" id="sk-reads"></dl><p class="say" id="sk-say" aria-live="polite">Drag across the sheet to draw your weights.</p>`;
  const chart = $("#sk-chart", el), reads = $("#sk-reads", el), say = $("#sk-say", el);
  const draw = () => {
    const kx = range(0.006, S_MAX, 240);
    const kw = kx.map((s) => K.kernelAt(s, c0));
    const area0 = ys.reduce((a, y, i) => (i ? a + 0.5 * (y + ys[i - 1]) * (sx[i] - sx[i - 1]) : a), 0);
    const norm = shown && area0 > 0 ? ys.map((y) => y / area0) : ys;
    const top = shown ? 3 : 3;
    const f = frame(chart, { x: [0, S_MAX], y: [0, top], aspect: 0.48, minH: 180, maxH: 260 });
    let s = axes(f, { yl: "weight", xl: "time ahead, s", grid: true });
    if (drew) s += area(f, sx, norm.map((v) => Math.min(v, top)), 0, "sketch-fill") + line(f, sx, norm.map((v) => Math.min(v, top)), "sketch");
    if (shown) {
      const m = K.meanLookAhead(c0);
      s += area(f, kx, kw.map((v) => Math.min(v, top)), 0, "wb-fill") + line(f, kx, kw, "wb");
      s += `<path class="wb" stroke-dasharray="3 3" d="M${f.sx(m).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-wb" x="${(f.sx(m) + 5).toFixed(1)}" y="${f.t + 12}">mean ${fmt(m, 3)}</text>`;
    }
    // the chart stops at 3: say so where a curve runs above it (the kernel does near 0, like s^(-1/2))
    if (shown && kw.some((v) => v > top)) s += `<text class="tag-wb" x="${(f.sx(0.02) + 4).toFixed(1)}" y="${f.t + 10}">w(s) runs above ${top} near 0</text>`;
    if (drew && norm.some((v) => v > top)) s += `<text class="tag-acc" x="${f.W - f.r - 2}" y="${f.t + 24}" text-anchor="end">your weights run above ${top}</text>`;
    s += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    chart.innerHTML = svg(f, s, shown ? `Your drawn weights beside the kernel for a cost of ${c0}` : "A sheet to draw your weights on");
    chart._f = f;
    if (shown) {
      const m = K.meanLookAhead(c0);
      const yourMean = drew && area0 > 0 ? sx.reduce((a, x, i) => (i ? a + 0.5 * (x * norm[i] + sx[i - 1] * norm[i - 1]) * (x - sx[i - 1]) : a), 0) : NaN;
      const inHalf = K.kernelMass(0, 0.5, K.B(c0));
      const yourHalf = drew && area0 > 0 ? sx.reduce((a, x, i) => (i && x <= 0.5 + 1e-9 ? a + 0.5 * (norm[i] + norm[i - 1]) * (x - sx[i - 1]) : a), 0) : NaN;
      reads.innerHTML = `<div class="k-wb"><dt>Kernel's mean</dt><dd>${fmt(m, 3)}<small>time units ahead</small></dd></div>
        <div class="k-acc"><dt>Your drawing's mean</dt><dd>${fmt(yourMean, 2)}<small>over 0 to 3</small></dd></div>
        <div class="k-wb"><dt>Kernel's weight before 0.5</dt><dd>${Math.round(inHalf * 100)}%</dd></div>
        <div class="k-acc"><dt>Yours before 0.5</dt><dd>${Number.isFinite(yourHalf) ? Math.round(yourHalf * 100) + "%" : "–"}</dd></div>`;
      say.textContent = S.sketchSay(m, yourMean, inHalf, yourHalf, K.meanDecisionTime(c0));
      liftReady(fig);
    } else reads.innerHTML = "";
  };
  let down = false, last = null;
  const setAt = (e) => {
    const f = chart._f, r = chart.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * f.W, py = ((e.clientY - r.top) / r.height) * f.H;
    const i = Math.max(0, Math.min(N - 1, Math.round((f.ix(px) / S_MAX) * (N - 1))));
    const v = Math.max(0, Math.min(3, f.iy(py)));
    if (last && last.i !== i) { const a = Math.min(last.i, i), b = Math.max(last.i, i); for (let j = a; j <= b; j++) ys[j] = last.v + ((v - last.v) * (j - last.i)) / (i - last.i); }
    ys[i] = v; last = { i, v }; drew = true;
    if (shown) { shown = false; say.textContent = "Drawing again. Show the kernel when you're done."; }
    draw();
  };
  chart.addEventListener("pointerdown", (e) => { down = true; last = null; chart.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  chart.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  const up = () => { down = false; };
  chart.addEventListener("pointerup", up); chart.addEventListener("pointercancel", up);
  $("#sk-show", el).addEventListener("click", () => { shown = true; draw(); });
  $("#sk-clear", el).addEventListener("click", () => { ys = new Array(N).fill(0); drew = false; shown = false; say.textContent = "Drag across the sheet to draw your weights."; draw(); });
  onSeg(el, "sk-c", (v) => { c0 = +v; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: still undecided
function survivalPlate() {
  const fig = plate("survival"), el = rootOf("survival");
  if (!el) return;
  const c0 = 0.1, b = K.B(c0);
  let s = 0.3;
  el.innerHTML = `<div class="controls"><label class="dial"><span class="ctl-key">Time s</span><output id="sv-out"></output>
    <input type="range" id="sv-s" min="0.05" max="2" step="0.01" value="${s}" aria-label="Time s"></label></div>
    <div class="chart-wrap" id="sv-top"></div><div class="chart-wrap" id="sv-bot"></div>
    <dl class="reads" id="sv-reads"></dl>`;
  const top = $("#sv-top", el), bot = $("#sv-bot", el), reads = $("#sv-reads", el), inp = $("#sv-s", el), out = $("#sv-out", el);
  const xs = range(-b, b, 161);
  const nCurve = range(0.03, 3, 200).map((u) => [u, K.flux(u, b)]);
  const draw = () => {
    out.textContent = s.toFixed(2);
    const f = frame(top, { x: [-b, b], y: [0, 1.05], aspect: 0.42, minH: 160, maxH: 230 });
    let g = axes(f, { yl: "chance still undecided", xl: "start x", grid: true, xt: [-b, 0, b], fx: (v) => (Math.abs(v - b) < 1e-6 ? "b₀" : Math.abs(v + b) < 1e-6 ? "−b₀" : String(v)) });
    for (const u of [0.1, 0.5, 1, 2]) g += line(f, xs, xs.map((x) => K.survival(x, u, b)), "path-dim");
    const ps = xs.map((x) => K.survival(x, s, b));
    g += line(f, xs, ps, "ex");
    const n = K.flux(s, b);
    // the slope at the bound: a line through (b, 0) with slope -n
    const x1 = b - Math.min(0.9 / Math.max(n, 0.6), b);
    g += `<path class="acc" d="M${f.sx(b).toFixed(1)} ${f.sy(0).toFixed(1)}L${f.sx(x1).toFixed(1)} ${f.sy(n * (b - x1)).toFixed(1)}"/>`;
    g += `<text class="tag-acc" x="${(f.sx(x1) - 4).toFixed(1)}" y="${(f.sy(n * (b - x1)) - 4).toFixed(1)}" text-anchor="end">slope −${fmt(n, 2)}</text>`;
    top.innerHTML = svg(f, g, `The chance of still being undecided at time ${s.toFixed(2)}, against the start, with its slope at the bound`);
    const fb = frame(bot, { x: [0, 3], y: [0, 3], aspect: 0.32, minH: 130, maxH: 180 });
    let h = axes(fb, { yl: "flux n(s)", xl: "time s", grid: true });
    h += line(fb, nCurve.map((p) => p[0]), nCurve.map((p) => p[1]), "wb");
    h += `<circle class="acc-dot" cx="${fb.sx(s).toFixed(1)}" cy="${fb.sy(Math.min(n, 3)).toFixed(1)}" r="4.5"/>`;
    bot.innerHTML = svg(fb, h, "The survival flux against time, with the chosen time marked");
    reads.innerHTML = `<div class="k-acc"><dt>Flux at s, n(s)</dt><dd>${fmt(n, 3)}</dd></div>
      <div><dt>Still undecided from 0</dt><dd>${Math.round(K.survival(0, s, b) * 100)}%<small>at time ${s.toFixed(2)}</small></dd></div>
      <div class="k-wb"><dt>Kernel w(s)</dt><dd>${fmt(n / K.fluxTotal(b), 3)}<small>the flux ÷ its total, ${fmt(K.fluxTotal(b), 3)}</small></dd></div>`;
    liftReady(fig);
  };
  let auto = !calm.matches, visible = false, raf = 0, t0 = 0;
  const loop = (now) => {
    raf = 0;
    if (!auto || !visible) return;
    if (!t0) t0 = now;
    const ph = ((now - t0) / 9000) % 1;
    s = 0.05 + 1.95 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
    inp.value = s; draw();
    raf = requestAnimationFrame(loop);
  };
  inp.addEventListener("input", () => { auto = false; s = +inp.value; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && auto && !raf) raf = requestAnimationFrame(loop); });
  keepDrawn(top, draw);
}

// ---------------------------------------------------------------- plate: starts near the bound
let SAMPLE_CACHE = new Map();
function startsPlate() {
  const fig = plate("starts"), el = rootOf("starts");
  if (!el) return;
  const seed = seedParam(2026);
  let c0 = 0.1, guess = null, running = false, visible = false;
  let R, times = [], starts = [], timer = 0;
  const TARGET = 8000, BATCH = 160;
  el.innerHTML = `<div class="predict" id="st-predict"><p>Where do the starts that matter sit?</p>
      ${segHTML("st-guess", [["zero", "Near 0"], ["spread", "Spread out"], ["bound", "Near the bound"]], "", "Your guess")}
      <p class="verdict" id="st-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("st-c", [[0.02, "0.02"], [0.1, "0.1"], [0.5, "0.5"]], c0, "Cost of time, c₀")}
      <div class="actions"><button class="btn" type="button" id="st-run" aria-pressed="false">Pause</button><button class="btn" type="button" id="st-again">Start over</button></div></div>
    <div class="chart-wrap" id="st-pi"></div><div class="chart-wrap" id="st-hist"></div>
    <ul class="legend"><li><span class="key key-wb">Exact w(s), from the series</span></li><li>Gray: decision times from the runs</li></ul>
    <dl class="reads" id="st-reads"></dl>`;
  const pi = $("#st-pi", el), hist = $("#st-hist", el), reads = $("#st-reads", el), verdict = $("#st-verdict", el), runBtn = $("#st-run", el);
  const reset = () => { R = K.rng(seed + Math.round(c0 * 1000)); times = []; starts = []; };
  const exactNear = (c) => { const b = K.B(c); return b <= 1 ? 1 : 1 - K.pi0Cdf(b - 1, c); };
  const draw = () => {
    const b = K.B(c0);
    // the start law, with the starts so far as a rug
    const ys = range(0, b, 120), dens = ys.map((y) => K.pi0(y, c0));
    const f = frame(pi, { x: [0, b], y: [0, Math.max(...dens) * 1.1], aspect: 0.3, minH: 120, maxH: 170 });
    let g = axes(f, { yl: "start density π₀(y)", xl: "start y", grid: true, xt: [0, b / 2, b], fx: (v) => (Math.abs(v - b) < 1e-9 ? "b₀" : Math.abs(v - b / 2) < 1e-9 ? "b₀/2" : String(v)) });
    g += area(f, ys, dens, 0, "wb-fill") + line(f, ys, dens, "wb");
    const rug = starts.slice(-240).map((y) => `<path class="dim" d="M${f.sx(y).toFixed(1)} ${f.H - f.b}v-6"/>`).join("");
    g += rug;
    pi.innerHTML = svg(f, g, `The start law for a cost of ${c0}, rising toward the bound, with the starts drawn so far`);
    // the decision times against the kernel
    const S_MAX = 3, BW = 0.05, nb = Math.round(S_MAX / BW), counts = new Array(nb).fill(0);
    for (const t of times) { const k = Math.floor(t / BW); if (k < nb) counts[k]++; }
    const kx = range(0.008, S_MAX, 220), kw = kx.map((s) => K.kernelAt(s, c0));
    const yTop = Math.min(4, Math.max(2, ...counts.map((c) => c / Math.max(1, times.length) / BW)) * 1.05);
    const fh = frame(hist, { x: [0, S_MAX], y: [0, yTop], aspect: 0.42, minH: 160, maxH: 240 });
    let h = axes(fh, { yl: "density of decision times", xl: "time s", grid: true });
    const n = Math.max(1, times.length);
    counts.forEach((c, k) => {
      const d = c / n / BW, x0 = fh.sx(k * BW), x1 = fh.sx((k + 1) * BW);
      if (d > 0) h += `<rect class="hist" x="${(x0 + 0.5).toFixed(1)}" y="${fh.sy(Math.min(d, yTop)).toFixed(1)}" width="${Math.max(0.5, x1 - x0 - 1).toFixed(1)}" height="${(fh.sy(0) - fh.sy(Math.min(d, yTop))).toFixed(1)}"/>`;
    });
    h += line(fh, kx, kw, "wb");
    hist.innerHTML = svg(fh, h, `Decision times from starts drawn from the start law, beside the exact kernel, for a cost of ${c0}`);
    // readings
    const m = K.meanLookAhead(c0);
    let mean = 0, sq = 0; for (const t of times) { mean += t; sq += t * t; }
    mean /= n; const sd = Math.sqrt(Math.max(0, sq / n - mean * mean)), se = sd / Math.sqrt(n);
    const near = starts.filter((y) => y >= b - 1).length / Math.max(1, starts.length);
    reads.innerHTML = `<div><dt>Runs so far</dt><dd>${times.length.toLocaleString("en-US")}</dd></div>
      <div><dt>Mean of the runs</dt><dd>${times.length ? fmt(mean, 3) : "–"}<small>${times.length ? "± " + fmt(2 * se, 3) + " (two standard errors)" : ""}</small></dd></div>
      <div class="k-wb"><dt>Exact mean look-ahead</dt><dd>${fmt(m, 3)}<small>${times.length > 30 ? S.zText((mean - m) / se) : "from the series"}</small></dd></div>
      <div class="k-wb"><dt>Starts within 1 of the bound</dt><dd>${Math.round(exactNear(c0) * 100)}%<small>exact; ${starts.length ? Math.round(near * 100) + "% in the runs" : "runs pending"}</small></dd></div>`;
    if (guess) verdict.textContent = S.startsVerdict(guess, exactNear(c0), c0, K.meanDecisionTime(c0), m);
    if (times.length) liftReady(fig);
  };
  const step = () => {
    timer = 0;
    if (!running || !visible) return;
    const b = K.B(c0);
    for (let i = 0; i < BATCH && times.length < TARGET; i++) {
      const y = K.pi0Quantile(R.next(), c0);
      starts.push(y); times.push(K.decide(y, b, R).t);
    }
    draw();
    if (times.length < TARGET) timer = setTimeout(step, 30);
    else { running = false; runBtn.textContent = "Run"; runBtn.setAttribute("aria-pressed", "false"); SAMPLE_CACHE.set(c0, times.slice()); }
  };
  const go = () => { running = true; runBtn.textContent = "Pause"; runBtn.setAttribute("aria-pressed", "true"); if (!timer) timer = setTimeout(step, 0); };
  const instant = () => { // reduced motion: all runs at once
    const b = K.B(c0);
    while (times.length < TARGET) { const y = K.pi0Quantile(R.next(), c0); starts.push(y); times.push(K.decide(y, b, R).t); }
    SAMPLE_CACHE.set(c0, times.slice()); draw();
  };
  runBtn.addEventListener("click", () => { if (running) { running = false; runBtn.textContent = "Run"; runBtn.setAttribute("aria-pressed", "false"); } else if (times.length >= TARGET) { reset(); go(); } else go(); });
  $("#st-again", el).addEventListener("click", () => { reset(); if (calm.matches) instant(); else go(); });
  onSeg(el, "st-c", (v) => { c0 = +v; reset(); if (calm.matches) instant(); else go(); draw(); });
  onSeg(el, "st-guess", (v) => { guess = v; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && running && !timer) timer = setTimeout(step, 0); });
  reset();
  keepDrawn(hist, draw);
  if (calm.matches) instant(); else go();
}

/** Decision times from pi_0 at c0, for the transform plate: the starts plate's runs if they're done, else new ones. */
function samplesFor(c0) {
  if (SAMPLE_CACHE.has(c0)) return SAMPLE_CACHE.get(c0);
  const t = Array.from(K.sampleDecisionTimes(c0, 3000, seedParam(2026) + 7));
  SAMPLE_CACHE.set(c0, t);
  return t;
}

// ---------------------------------------------------------------- the proof strips
function strips() {
  document.querySelectorAll(".strip").forEach((st) => {
    const n = +st.dataset.steps, inp = st.querySelector("input[type=range]");
    const cards = [...st.querySelectorAll(".strip-step")], btns = [...st.querySelectorAll(".strip-steps button")];
    const fig = plate(st.dataset.plate);
    let at = 0;
    const show = (k) => {
      at = Math.max(0, Math.min(n - 1, k));
      cards.forEach((c, i) => { c.hidden = i !== at; });
      btns.forEach((b, i) => { if (i === at) { b.setAttribute("aria-current", "step"); b.classList.add("seen"); } else b.removeAttribute("aria-current"); });
      inp.value = at;
      st.querySelector('[data-go="-1"]').disabled = at === 0;
      const nx = st.querySelector('[data-go="1"]'); nx.disabled = at === n - 1; nx.textContent = at === n - 1 ? "Last step" : "Next step";
      if (fig) { fig.dataset.step = at; fig.dispatchEvent(new CustomEvent("strip-step", { detail: at })); }
    };
    inp.addEventListener("input", () => show(+inp.value));
    btns.forEach((b, i) => b.addEventListener("click", () => show(i)));
    st.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(at + +b.dataset.go)));
    show(0);
  });
}

function transformPlate() {
  const fig = plate("transform"), el = rootOf("transform");
  if (!el) return;
  const c0 = 0.1, b = K.B(c0);
  let step = +(fig.dataset.step || 0);
  el.innerHTML = `<p class="fine" id="tf-step"></p><div class="chart-wrap" id="tf-chart"></div><dl class="reads" id="tf-reads"></dl>`;
  const chart = $("#tf-chart", el), reads = $("#tf-reads", el), head = $("#tf-step", el);
  const draw = () => {
    let f, g = "", label = "";
    reads.innerHTML = "";
    if (step === 0) {
      const xs = range(-b, b, 161);
      f = frame(chart, { x: [-b, b], y: [0, 1.05], aspect: 0.5 });
      g = axes(f, { yl: "P(still undecided at s)", xl: "start x", grid: true, xt: [-1, 0, 1] });
      const items = [];
      for (const [u, cls] of [[0.1, "ex"], [0.3, "ex-thin"], [1, "path-dim"]]) {
        const ps = xs.map((x) => K.survival(x, u, b));
        g += line(f, xs, ps, cls);
        items.push({ y: ps[80], text: `s = ${u}`, cls: "tag-ex" });
      }
      g += tags(f, items, f.sx(0) + 30);
      head.textContent = "Step 1: the chance of still being undecided, from the h-transform's series.";
      label = "The chance of still being undecided against the start, at three times";
    } else if (step === 1) {
      const ss = range(Math.log10(0.005), Math.log10(3), 200).map((v) => 10 ** v);
      f = frame(chart, { x: [0.005, 3], y: [0.03, 30], xlog: true, ylog: true, aspect: 0.5 });
      g = axes(f, { yl: "partial sums of n(s)", xl: "time s", grid: true });
      const items = [];
      for (const [J, cls] of [[1, "path-dim"], [2, "path-dim"], [4, "ex-thin"], [64, "wb"]]) {
        const ys = ss.map((s) => { let a = 0; for (let j = 0; j < J; j++) { const k2 = K.kappa(j, b) ** 2; a += (k2 / (1 + k2)) * Math.exp(-((1 + k2) * s) / 2); } return (2 / b) * a; });
        g += line(f, ss, ys, cls);
        items.push({ y: ys[40], text: J === 64 ? "64 terms" : `${J}`, cls: J === 64 ? "tag-wb" : "tag-ex" });
      }
      g += tags(f, items, f.sx(ss[40]) - 4);
      head.textContent = "Step 2: every term is a positive exponential; more terms fill in the early times.";
      label = "Partial sums of the flux series with 1, 2, 4, and 64 terms, on log axes";
    } else if (step === 2) {
      const xs = range(-b, b, 161);
      f = frame(chart, { x: [-b, b], y: [0, 1.05], aspect: 0.5 });
      g = axes(f, { yl: "u(x) = E e^(−λτ)", xl: "start x", grid: true, xt: [-1, 0, 1] });
      const items = [];
      for (const [lam, cls] of [[0.5, "ex"], [2, "ex-thin"], [8, "path-dim"]]) {
        const r = Math.sqrt(2 * lam + 1);
        const us = xs.map((x) => (Math.cosh(r * x) * Math.cosh(b)) / (Math.cosh(x) * Math.cosh(r * b)));
        g += line(f, xs, us, cls);
        items.push({ y: us[80], text: `λ = ${lam}`, cls: "tag-ex" });
      }
      g += tags(f, items, f.sx(0) + 30);
      head.textContent = "Step 3: the transform of the decision time is 1 at the bound and smallest at the middle.";
      label = "The Laplace transform of the decision time against the start, for three values of lambda";
    } else {
      const lams = range(0, 20, 161);
      const wt = lams.map((l) => K.transform(l, c0));
      f = frame(chart, { x: [0, 20], y: [0, 1.05], aspect: 0.5 });
      g = axes(f, { yl: "w̃(λ)", xl: "λ", grid: true });
      g += line(f, lams, wt, "wb");
      const dots = [0.5, 1, 2, 5, 10, 20];
      g += dots.map((l) => `<circle class="ink-dot" cx="${f.sx(l).toFixed(1)}" cy="${f.sy(K.transformSeries(l, c0, 40000)).toFixed(1)}" r="3.2"/>`).join("");
      let maxGap = 0;
      if (step === 4) {
        const ts = samplesFor(c0);
        for (const l of [1, 2, 4, 8, 16]) {
          let m = 0, q = 0; for (const t of ts) { const v = Math.exp(-l * t); m += v; q += v * v; }
          m /= ts.length; const se = Math.sqrt(Math.max(0, q / ts.length - m * m) / ts.length);
          const X = f.sx(l), y0 = f.sy(m - 2 * se), y1 = f.sy(m + 2 * se);
          g += `<path class="acc" d="M${X - 5} ${f.sy(m) - 5}l10 10M${X + 5} ${f.sy(m) - 5}l-10 10M${X} ${y0.toFixed(1)}V${y1.toFixed(1)}"/>`;
          maxGap = Math.max(maxGap, Math.abs(m - K.transform(l, c0)) / Math.max(se, 1e-9));
        }
        reads.innerHTML = `<div><dt>Runs used</dt><dd>${ts.length.toLocaleString("en-US")}</dd></div>
          <div><dt>Largest gap, in standard errors</dt><dd>${fmt(maxGap, 1)}</dd></div>`;
      }
      const gaps = dots.map((l) => Math.abs(K.transformSeries(l, c0, 40000) - K.transform(l, c0)));
      reads.innerHTML = `<div class="k-wb"><dt>Closed form at λ = 1</dt><dd>${fmt(K.transform(1, c0), 4)}</dd></div>
        <div><dt>Series at λ = 1</dt><dd>${fmt(K.transformSeries(1, c0, 40000), 4)}<small>largest gap at the dots ${Math.max(...gaps).toExponential(1)}</small></dd></div>` + reads.innerHTML;
      head.textContent = step === 3 ? "Step 4: the flux's transform, normalized, is the closed form (green); the dots are the series, term by term."
        : "Step 5: estimates from the monitored sampler of decision times from π₀ (crosses, two standard errors), beside the same transform.";
      label = "The kernel's Laplace transform: the closed form, the series, and sampled decision times";
    }
    chart.innerHTML = svg(f, g, label);
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

function bracketPlate() {
  const fig = plate("bracket"), el = rootOf("bracket");
  if (!el) return;
  const c0 = 0.1, b0 = K.B(c0), y0 = 0.6, A = 1, dt = 0.0002;
  // one path of X from y0, run until |X| passes the highest level the slider can ask for
  const R = K.rng(seedParam(2026) + 11);
  const pts = [[0, y0]];
  let x = y0, t = 0;
  while (Math.abs(x) < b0 + 0.32 && t < 30) { x += Math.tanh(x) * dt + Math.sqrt(dt) * R.normal(); t += dt; pts.push([t, Math.abs(x)]); }
  const hit = (z) => { for (let i = 1; i < pts.length; i++) if (pts[i][1] >= z) { const [ta, ya] = pts[i - 1], [tb, yb] = pts[i]; return ta + ((z - ya) / (yb - ya)) * (tb - ta); } return NaN; };
  const ET = (z) => z * Math.tanh(z);
  const keep = pts.filter((_, i) => i % 10 === 0);
  let eps = 0.3, auto = !calm.matches, visible = false, timer = 0;
  el.innerHTML = `<div class="controls"><label class="dial"><span class="ctl-key">Size of the change, ε</span><output id="br-out"></output>
    <input type="range" id="br-eps" min="${Math.log10(0.005)}" max="${Math.log10(0.3)}" step="0.01" value="${Math.log10(eps)}" aria-label="Epsilon, on a log scale"></label></div>
    <div class="chart-wrap" id="br-chart"></div><dl class="reads" id="br-reads"></dl><p class="say" id="br-say"></p>`;
  const chart = $("#br-chart", el), reads = $("#br-reads", el), out = $("#br-out", el), inp = $("#br-eps", el), say = $("#br-say", el);
  const tEnd = hit(b0 + 0.3) * 1.04 + 0.05;
  const draw = () => {
    out.textContent = fmt(eps, 3);
    const lo = b0 - A * eps, hi = b0 + A * eps;
    const sm = hit(lo), s0 = hit(b0), sp = hit(hi);
    const f = frame(chart, { x: [0, tEnd], y: [0, b0 + 0.42], aspect: 0.55 });
    let g = axes(f, { yl: "Y = |X|", xl: "time", grid: true });
    g += `<rect class="band" x="${f.l}" y="${f.sy(hi).toFixed(1)}" width="${f.W - f.l - f.r}" height="${(f.sy(lo) - f.sy(hi)).toFixed(1)}"/>`;
    g += line(f, keep.map((p) => p[0]), keep.map((p) => p[1]), "dim");
    g += `<path class="bound-line" d="M${f.l} ${f.sy(b0).toFixed(1)}H${f.W - f.r}"/><text class="tag-ex" x="${f.W - f.r}" y="${(f.sy(b0) - 5).toFixed(1)}" text-anchor="end">b₀</text>`;
    g += `<path class="acc" d="M${f.l} ${f.sy(hi).toFixed(1)}H${f.W - f.r}M${f.l} ${f.sy(lo).toFixed(1)}H${f.W - f.r}" stroke-dasharray="5 3"/>`;
    const mark = (tt, lbl, cls, anchor, y) => `<path class="${cls === "tag-ex" ? "bound-line" : "acc"}" stroke-dasharray="2 3" d="M${f.sx(tt).toFixed(1)} ${f.t}V${f.H - f.b}"/>` +
      `<text class="${cls}" x="${(f.sx(tt) + (anchor === "end" ? -4 : anchor === "start" ? 4 : 0)).toFixed(1)}" y="${y}" text-anchor="${anchor}">${lbl}</text>`;
    g += mark(sm, "σ₋", "tag-acc", "end", f.t + 10) + mark(sp, "σ₊", "tag-acc", "start", f.t + 10) + mark(s0, "τ₀", "tag-ex", "middle", f.H - f.b - 6);
    chart.innerHTML = svg(f, g, `One path of the evidence's size, the bound, and a band of half-width ${fmt(eps, 3)} around it, with the three hitting times`);
    const egap = ET(hi) - ET(lo);
    reads.innerHTML = `<div class="k-acc"><dt>σ₊ − σ₋ on this path</dt><dd>${fmt(sp - sm, 4)}</dd></div>
      <div><dt>Expected gap, exact</dt><dd>${fmt(egap, 4)}<small>(b₀+aε)tanh(b₀+aε) − (b₀−aε)tanh(b₀−aε)</small></dd></div>
      <div><dt>Expected gap ÷ ε</dt><dd>${fmt(egap / eps, 3)}<small>tends to 2a(tanh b₀ + b₀ sech² b₀) = ${fmt(2 * A * K.fluxTotal(b0), 3)}</small></dd></div>`;
    say.textContent = S.bracketSay(eps, sp - sm, egap);
    liftReady(fig);
  };
  const tick = () => { timer = 0; if (!auto || !visible) return; eps = eps <= 0.0051 ? 0.3 : eps / 1.35; inp.value = Math.log10(eps); draw(); timer = setTimeout(tick, eps === 0.3 ? 1600 : 700); };
  inp.addEventListener("input", () => { auto = false; eps = 10 ** +inp.value; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && auto && !timer) timer = setTimeout(tick, 900); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: your schedule, scaled down
function yoursPlate() {
  const fig = plate("yours"), el = rootOf("yours");
  if (!el) return;
  const EPS = YOURS_EPS, P = yoursPlateState();
  let choice = getChoice(), sel = 2, guess = { pm: null, fo: null };
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  el.innerHTML = `<div class="controls"><label class="dial" style="flex:1 1 14rem"><span class="ctl-key">Your schedule</span><span></span>
      <select class="pick" id="yo-pick">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>
      ${segHTML("yo-eps", EPS.map((e, k) => [k, e >= 0.1 ? Math.round(e * 100) + "%" : (e * 100).toFixed(1) + "%"]), sel, "Size of the change, ε")}</div>
    <p class="fine" id="yo-note"></p>
    <div class="chart-wrap" id="yo-top"></div>
    <ul class="legend"><li><span class="key key-ex">Program, (b − b₀) ÷ ε</span></li><li><span class="key key-wb">First order, β</span></li><li><span class="key key-pm">Per-moment</span></li></ul>
    <div class="predict" id="yo-predict"><p>As ε shrinks, how fast does the theory say each shortcut's error shrinks?</p>
      ${segHTML("yo-gpm", [["0", "Doesn't shrink"], ["1", "Order ε"], ["2", "At most order ε²"]], "", "Per-moment rule")}
      ${segHTML("yo-gfo", [["0", "Doesn't shrink"], ["1", "Order ε"], ["2", "At most order ε²"]], "", "First-order correction")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="yo-show">Show the errors</button></div>
      <p class="verdict" id="yo-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="yo-bot" hidden></div>
    <dl class="reads" id="yo-reads"></dl><p class="fine" id="yo-state" aria-live="polite"></p>`;
  const pick = $("#yo-pick", el), note = $("#yo-note", el), top = $("#yo-top", el), bot = $("#yo-bot", el), reads = $("#yo-reads", el), state = $("#yo-state", el), verdict = $("#yo-verdict", el);
  const drawTop = () => {
    const data = P.state.data;
    if (!data) { top.innerHTML = ""; return; }
    const { f, g } = responseChart(top, data, sel);
    top.innerHTML = svg(f, g, `For ${labelOf(choice)} at ${EPS[sel] * 100}% of its change: the program's bound move divided by epsilon, the first-order response, and the per-moment response`);
    liftReady(fig);
  };
  const drawBot = () => {
    const data = P.state.data, b = P.bottom();
    if (b.hidden) { bot.hidden = true; if (data && P.state.reveal) { reads.innerHTML = ""; verdict.textContent = yoursVerdict(b, data, guess); } return; }
    bot.hidden = false;
    const { ePm, eFo } = data, [yLo, yHi] = b.range;
    const f = frame(bot, { x: [EPS[EPS.length - 1] / 1.3, 1.3], y: [yLo, yHi], xlog: true, ylog: true, aspect: 0.5, minH: 180, maxH: 280 });
    // guide lines of slope 1 and 2 through the per-moment error at the largest epsilon (guides only), then the errors
    const g = axes(f, { yl: "largest error in the bound", xl: "ε", grid: true }) + errorMarks(f, EPS, ePm, eFo);
    bot.innerHTML = svg(f, g, "The largest error of each shortcut's bound against epsilon, on log axes, with guide lines of slope 1 and 2");
    const ratios = S.errorRatios(ePm, eFo);
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment error</dt><dd>${ePm[ePm.length - 1].toExponential(1)}<small>at the smallest ε; ${ePm[0].toExponential(1)} at the largest</small></dd></div>
      <div class="k-wb"><dt>First-order error</dt><dd>${eFo[eFo.length - 1].toExponential(1)}<small>at the smallest ε; ${eFo[0].toExponential(1)} at the largest</small></dd></div>
      <div><dt>Per-moment ÷ first-order</dt><dd>${ratios.lo === null ? "–" : fmt(ratios.lo, 1) + " to " + fmt(ratios.hi, 1)}<small>over the sizes shown</small></dd></div>`;
    verdict.textContent = yoursVerdict(b, data, guess);
    liftReady(fig);
  };
  // what the prediction box offers: the theory's question, the measured errors only (outside the theorem), or nothing
  const setPredict = (mode) => {
    const box = $("#yo-predict", el), v = predictView(mode);
    box.hidden = !v.box;
    box.querySelectorAll("fieldset").forEach((fs) => { fs.hidden = !v.questions; });
    box.querySelector("p").textContent = v.prompt;
  };
  const run = () => {
    // a newer selection makes an earlier selection's reply stale (yoursPlateState drops it)
    const { my, job } = P.select(choice), mode = P.state.mode;
    verdict.textContent = ""; reads.innerHTML = ""; drawTop(); drawBot();
    pick.value = choice.id;
    setPredict(mode);
    note.textContent = mode === "theory" ? S.insideNote(labelOf(choice)) : S.outsideNote(mode === "measure" ? "rising" : mode);
    if (!job) { state.textContent = ""; return; }
    state.textContent = "Solving seven dynamic programs…";
    solve(job, { key: "yours", progress: (p) => { if (P.current(my)) state.textContent = `Solving seven dynamic programs… ${1 + Math.round(p * 6)} of 7`; } }).then((m) => {
      if (!P.take(my, m)) return;
      state.textContent = "Time step 0.01, evidence step 0.02, 6 time units past the window; errors measured from the program's own constant-cost bound.";
      drawTop(); drawBot();
    }).catch((e) => { if (e.message !== "superseded" && P.current(my)) state.textContent = "The solver stopped: " + e.message; });
  };
  pick.addEventListener("change", () => {
    if (pick.value === "draw") { const c = getChoice(); choice = c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
    else choice = { id: pick.value, params: paramsOf({ id: pick.value }) };
    setChoice(choice); run();
  });
  onSeg(el, "yo-eps", (v) => { sel = +v; drawTop(); });
  onSeg(el, "yo-gpm", (v) => { guess.pm = +v; });
  onSeg(el, "yo-gfo", (v) => { guess.fo = +v; });
  $("#yo-show", el).addEventListener("click", () => { P.show(); drawBot(); });
  keepDrawn(top, drawTop); keepDrawn(bot, drawBot);
  run();
}

// ---------------------------------------------------------------- start
hero();
strips();
const lazy = [["scale", scalePlate], ["sketch", sketchPlate], ["survival", survivalPlate], ["starts", startsPlate], ["transform", transformPlate], ["bracket", bracketPlate], ["yours", yoursPlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } }); }
