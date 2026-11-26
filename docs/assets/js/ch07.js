// Chapter 7's plates. Every number drawn comes from kernel.js (the series and the closed forms), ch07-model.js (the
// series form of the transfer function, the scans, the closed forms behind the loss, and the forward computation),
// the solver's workers, or the paper's Table 1; the words under each plate come from the functions in say-ch07.js.
import * as K from "./kernel.js?v=d73958033e";
import * as M from "./ch07-model.js?v=d73958033e";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, VIEW, defaultDrawing } from "./schedules-book.js?v=d73958033e";
import { getChoice, setChoice, solve, onVisible, watchVisible, liftReady, calm, seedParam, wireStrips } from "./book.js?v=d73958033e";
import { frame, line, area, axes, svg, tags, fmt, keepDrawn } from "./chart.js?v=d73958033e";
import * as S from "./say-ch07.js?v=d73958033e";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const logRange = (a, b, n) => range(Math.log10(a), Math.log10(b), n).map((v) => 10 ** v);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const P = (v) => v.toFixed(1);
const dot = (f, x, y, cls, r = 4) => (Number.isFinite(f.sy(y)) ? `<circle class="${cls}" cx="${P(f.sx(x))}" cy="${P(f.sy(y))}" r="${r}"/>` : "");
const txt = (x, y, s, cls = "tk", anchor = "start") => `<text class="${cls}" x="${P(x)}" y="${P(y)}" text-anchor="${anchor}">${s}</text>`;
const clampTo = (f, v) => Math.min(Math.max(v, Math.min(...f.y)), Math.max(...f.y));
/** A line from (x0, y0) to (x1, y1) in pixels with an open head at the end, in one class. */
function arrowPx(x0, y0, x1, y1, cls, head = 6, extra = "") {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 0.5) return "";
  const ux = dx / L, uy = dy / L, h = Math.min(head, L * 0.6);
  const ax = x1 - h * ux + h * 0.55 * uy, ay = y1 - h * uy - h * 0.55 * ux, bx = x1 - h * ux - h * 0.55 * uy, by = y1 - h * uy + h * 0.55 * ux;
  return `<path class="${cls}" ${extra} d="M${P(x0)} ${P(y0)}L${P(x1)} ${P(y1)}M${P(ax)} ${P(ay)}L${P(x1)} ${P(y1)}L${P(bx)} ${P(by)}"/>`;
}
const failText = (e) => `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`;

// the reader's schedule: a picker that every schedule plate shares through setChoice and the cc-schedule event
const GROUPS = [...new Set(PRESETS.map((p) => p.group))];
const pickerHTML = (id) => `<label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${GROUPS.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
function wirePicker(sel) {
  sel.value = getChoice().id;
  sel.addEventListener("change", () => {
    let choice;
    if (sel.value === "draw") { const c = getChoice(); choice = c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
    else choice = { id: sel.value, params: paramsOf({ id: sel.value }) };
    setChoice(choice);
  });
}
const onSchedule = (fn) => window.addEventListener("cc-schedule", (e) => fn(e.detail || getChoice()));

// ---------------------------------------------------------------- the hero: a sine wave in, a smaller and earlier one out
function hero() {
  const fig = document.getElementById("hero-proof");
  const el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const c0 = 0.1, size = 0.3, OMS = M.TABLE1.map((r) => r[0]);
  const U = range(0, 4 * Math.PI, 181);
  let cur = 4;
  const draw = (i) => {
    cur = i;
    const om = OMS[i], tr = K.transfer(c0, om), ph = (tr.lead * Math.PI) / 180;
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.64)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const split = Math.round(H * 0.38);
    const l = 12, r = 12, sx = (u) => l + (u / (4 * Math.PI)) * (W - l - r);
    const fT = { W, H: split, l, r, t: 18, b: 8, x: [0, 4 * Math.PI], y: [c0 * (1 - size) - 0.005, c0 * (1 + size) + 0.005] };
    fT.sx = sx; fT.sy = (v) => fT.t + (1 - (v - fT.y[0]) / (fT.y[1] - fT.y[0])) * (split - fT.t - fT.b);
    const fB = { W, H, l, r, t: split + 22, b: 22, x: [0, 4 * Math.PI], y: [-1.15, 1.15] };
    fB.sx = sx; fB.sy = (v) => fB.t + (1 - (v - fB.y[0]) / (fB.y[1] - fB.y[0])) * (H - fB.t - fB.b);
    // per-moment response B'(c0) gamma, divided by its swing: the cost turned upside down; the first-order response
    // is the same wave scaled by the gain and moved ahead by the lead
    const pm = U.map((u) => -Math.sin(u)), fo = U.map((u) => -tr.gain * Math.sin(u + ph));
    let s = `<text class="lab" x="${l}" y="12">the cost of time, ${c0} × (1 + ${size} sin ωt)</text>`;
    s += line(fT, U, U.map((u) => c0 * (1 + size * Math.sin(u))), "cost");
    s += `<text class="lab" x="${l}" y="${split + 12}">the bound's move ÷ the per-moment swing</text>`;
    s += `<path class="ax" d="M${l} ${P(fB.sy(0))}H${W - r}"/>`;
    s += line(fB, U, pm, "pm") + line(fB, U, fo, "wb");
    // the lead, between the second trough of the per-moment response and the bound's, where the bound falls lowest
    const uPm = 2.5 * Math.PI, uFo = uPm - ph, yLow = fB.sy(-1.08);
    s += `<path class="dim" stroke-dasharray="2 3" d="M${P(sx(uPm))} ${P(fB.sy(-1))}V${P(yLow + 4)}M${P(sx(uFo))} ${P(fB.sy(-tr.gain))}V${P(yLow + 4)}"/>`;
    s += arrowPx(sx(uPm), yLow, sx(uFo), yLow, "wb", 5);
    s += txt(sx(uFo) - 4, yLow + 4, `${tr.lead.toFixed(1)}° ahead`, "tag-wb", "end");
    s += txt(l, H - 6, "0", "tk") + txt(W - r, H - 6, `two periods, ${(4 * Math.PI / om).toFixed(om >= 2 ? 2 : 1)} time units`, "tk", "end");
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: OMS.length, draw, label: (i) => { const t = K.transfer(c0, OMS[i]); return S.heroLabel(OMS[i], t.gain, t.lead); } });
}

// ---------------------------------------------------------------- plate: a sinusoid in, a sinusoid out
function wavePlate() {
  const fig = plate("wave"), el = rootOf("wave");
  if (!el) return;
  const COSTS = [0.02, 0.1, 0.3, 1], OM = logRange(0.05, 200, 260);
  const row8 = M.TABLE1[M.TABLE1.length - 1];
  let c0 = 0.1, lom = Math.log10(8), shown = false, touched = false, playing = false, visible = false, raf = 0, t0 = 0;
  const visited = new Map(); // c0 -> [lo, hi] in log10 omega
  const curves = new Map();
  const curveFor = (c) => { if (!curves.has(c)) curves.set(c, OM.map((w) => K.transfer(c, w))); return curves.get(c); };
  el.innerHTML = `<div class="predict"><p>At ω = 8, with c₀ = 0.1, how many degrees ahead of the per-moment response does the bound run?</p>
      <label class="dial"><span class="ctl-key">Your guess</span><output id="wv-gout">–</output>
      <input type="range" id="wv-guess" min="0" max="90" step="1" value="0" aria-label="Your guess of the lead, in degrees"></label>
      <div class="actions" style="margin-top:6px"><button class="btn btn-go" type="button" id="wv-show">Show me</button></div>
      <p class="verdict" id="wv-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("wv-c", COSTS.map((c) => [c, String(c)]), c0, "Cost of time, c₀")}
      <label class="dial"><span class="ctl-key">Frequency, ω</span><output id="wv-out"></output>
      <input type="range" id="wv-om" min="${Math.log10(0.1)}" max="2" step="0.005" value="${lom}" aria-label="Frequency omega, on a log scale"></label>
      <div class="actions"><button class="btn" type="button" id="wv-play" aria-pressed="false">Sweep</button></div></div>
    <div class="chart-wrap" id="wv-cost"></div><div class="chart-wrap" id="wv-resp"></div>
    <ul class="legend"><li><span class="key key-cost">Cost</span></li><li><span class="key key-pm">Per-moment response</span></li><li id="wv-fokey" hidden><span class="key key-wb">First-order bound</span></li></ul>
    <div id="wv-fig" hidden><div class="chart-wrap" id="wv-gain"></div><div class="chart-wrap" id="wv-lead"></div>
    <ul class="legend"><li><span class="key key-wb">Your c₀</span></li><li>Gray: the other costs</li><li>Black dots: the dynamic program, c₀ = 0.1</li><li>Orange: your ω</li></ul></div>
    <dl class="reads" id="wv-reads"></dl><p class="say" id="wv-say"></p>`;
  const cost = $("#wv-cost", el), resp = $("#wv-resp", el), gainEl = $("#wv-gain", el), leadEl = $("#wv-lead", el), figBox = $("#wv-fig", el);
  const reads = $("#wv-reads", el), say = $("#wv-say", el), out = $("#wv-out", el), inp = $("#wv-om", el), play = $("#wv-play", el);
  const guess = $("#wv-guess", el), gout = $("#wv-gout", el), verdict = $("#wv-verdict", el);
  const mark = () => { const v = visited.get(c0) || [lom, lom]; visited.set(c0, [Math.min(v[0], lom), Math.max(v[1], lom)]); };
  const drawTop = () => {
    const om = 10 ** lom, tr = K.transfer(c0, om), ph = (tr.lead * Math.PI) / 180, T = (4 * Math.PI) / om;
    out.textContent = om >= 10 ? om.toFixed(0) : om.toFixed(2);
    const ts = range(0, T, 241);
    const fc = frame(cost, { x: [0, T], y: [c0 * 0.62, c0 * 1.38], aspect: 0.2, minH: 80, maxH: 110, t: 10, b: 8 });
    let g = axes(fc, { yt: [c0 * 0.7, c0, c0 * 1.3], fy: (v) => String(+v.toPrecision(2)), xt: [], yl: "", grid: true });
    g += line(fc, ts, ts.map((t) => c0 * (1 + 0.3 * Math.sin(om * t))), "cost");
    cost.innerHTML = svg(fc, g, `The cost of time, a sine wave around ${c0} at frequency ${om.toFixed(2)}`);
    const fr = frame(resp, { x: [0, T], y: [-1.25, 1.25], aspect: 0.42, minH: 160, maxH: 240 });
    let h = axes(fr, { yt: [-1, 0, 1], xl: "time", grid: true, zero: true });
    h += line(fr, ts, ts.map((t) => -Math.sin(om * t)), "pm");
    if (shown) {
      h += line(fr, ts, ts.map((t) => -tr.gain * Math.sin(om * t + ph)), "wb");
      const tPm = (2.5 * Math.PI) / om, tFo = tPm - ph / om, y = fr.sy(-1.13);
      h += `<path class="dim" stroke-dasharray="2 3" d="M${P(fr.sx(tPm))} ${P(fr.sy(-1))}V${P(y + 3)}M${P(fr.sx(tFo))} ${P(fr.sy(-tr.gain))}V${P(y + 3)}"/>`;
      h += arrowPx(fr.sx(tPm), y, fr.sx(tFo), y, "wb", 5);
      h += txt(fr.sx(tFo) - 4, y + 4, `${tr.lead.toFixed(1)}°`, "tag-wb", "end");
    }
    $("#wv-fokey", el).hidden = !shown;
    resp.innerHTML = svg(fr, h, shown ? `The per-moment response and the first-order bound's response at frequency ${om.toFixed(2)}, the bound ${tr.lead.toFixed(1)} degrees ahead` : `The per-moment response at frequency ${om.toFixed(2)}`);
  };
  const drawFig = () => {
    figBox.hidden = !shown;
    if (!shown) return;
    const om = 10 ** lom, tr = K.transfer(c0, om), cur = curveFor(c0), v = visited.get(c0) || [lom, lom];
    const fg = frame(gainEl, { x: [0.05, 200], y: [0.04, 1.3], xlog: true, ylog: true, aspect: 0.5, minH: 170, maxH: 240 });
    let g = axes(fg, { yl: "gain |w̃(−iω)|", xl: "ω", grid: true });
    for (const c of COSTS) if (c !== c0) g += line(fg, OM, curveFor(c).map((t) => t.gain), "path-dim");
    g += line(fg, OM, cur.map((t) => t.gain), "wb-thin");
    const inV = OM.map((w) => Math.log10(w) >= v[0] - 1e-9 && Math.log10(w) <= v[1] + 1e-9);
    g += line(fg, OM, cur.map((t, i) => (inV[i] ? t.gain : NaN)), "wb");
    const asym = OM.filter((w) => w > 2);
    g += line(fg, asym, asym.map((w) => M.gainAsymptote(w, c0)), "dim", 'stroke-dasharray="1 3"');
    g += M.TABLE1.map((r) => dot(fg, r[0], r[3], "ink-dot", 3.2)).join("");
    g += dot(fg, om, tr.gain, "acc-dot", 4.5);
    gainEl.innerHTML = svg(fg, g, "The gain against frequency on log axes, for four costs, with the paper's dynamic program at 0.1 as dots");
    const fl = frame(leadEl, { x: [0.05, 200], y: [0, 50], xlog: true, aspect: 0.42, minH: 150, maxH: 220 });
    let h = axes(fl, { yl: "lead (degrees)", xl: "ω", grid: true, yt: [0, 15, 30, 45] });
    h += `<path class="dim" stroke-dasharray="1 3" d="M${fl.l} ${P(fl.sy(45))}H${fl.W - fl.r}"/>`;
    for (const c of COSTS) if (c !== c0) h += line(fl, OM, curveFor(c).map((t) => t.lead), "path-dim");
    h += line(fl, OM, cur.map((t) => t.lead), "wb-thin") + line(fl, OM, cur.map((t, i) => (inV[i] ? t.lead : NaN)), "wb");
    h += M.TABLE1.map((r) => dot(fl, r[0], r[4], "ink-dot", 3.2)).join("");
    h += dot(fl, om, tr.lead, "acc-dot", 4.5);
    leadEl.innerHTML = svg(fl, h, "The lead against frequency, tending to 45 degrees, for four costs, with the paper's dynamic program at 0.1 as dots");
  };
  const draw = () => {
    drawTop(); drawFig();
    const om = 10 ** lom, tr = K.transfer(c0, om), m = K.meanLookAhead(c0), tl = (tr.lead * Math.PI) / 180 / om;
    if (shown) {
      reads.innerHTML = `<div class="k-wb"><dt>Gain |w̃(−iω)|</dt><dd>${fmt(tr.gain, 3)}<small>of the per-moment swing</small></dd></div>
        <div class="k-wb"><dt>Lead</dt><dd>${fmt(tr.lead, 1)}°<small>ahead of the per-moment response</small></dd></div>
        <div class="k-wb"><dt>Lead in time</dt><dd>${fmt(tl, 3)}<small>the mean look-ahead is ${fmt(m, 3)}</small></dd></div>
        <div class="k-pm"><dt>Per-moment swing ÷ the bound's</dt><dd>${fmt(1 / tr.gain, 2)}</dd></div>`;
      say.textContent = S.waveSay(c0, om, tr.gain, tr.lead, tl, m);
    } else { reads.innerHTML = ""; say.textContent = ""; }
    liftReady(fig);
  };
  const reveal = () => { shown = true; const v = visited.get(c0) || [lom, lom]; visited.set(c0, [Math.min(v[0], Math.log10(0.5)), Math.max(v[1], Math.log10(8))]); mark(); verdict.textContent = S.waveVerdict(touched ? +guess.value : NaN, K.transfer(0.1, 8).lead, row8[4]); draw(); };
  guess.addEventListener("input", () => { touched = true; gout.textContent = guess.value + "°"; if (shown) verdict.textContent = S.waveVerdict(+guess.value, K.transfer(0.1, 8).lead, row8[4]); });
  $("#wv-show", el).addEventListener("click", reveal);
  inp.addEventListener("input", () => { stop(); lom = +inp.value; if (shown) mark(); draw(); });
  onSeg(el, "wv-c", (v) => { c0 = +v; if (shown) mark(); draw(); });
  // a sweep of the frequency, slow and back, that fills in the curves; it pauses off screen
  const loop = (now) => {
    raf = 0;
    if (!playing || !visible) return;
    if (!t0) t0 = now;
    const p = ((now - t0) / 12000) % 1, lo = Math.log10(0.1), hi = 2;
    lom = lo + (hi - lo) * (0.5 - 0.5 * Math.cos(2 * Math.PI * p));
    inp.value = lom; mark(); draw();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { playing = false; play.setAttribute("aria-pressed", "false"); play.textContent = "Sweep"; };
  play.addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (!shown) reveal();
    if (calm.matches) { visited.set(c0, [Math.log10(0.05), Math.log10(200)]); draw(); return; }
    playing = true; t0 = 0; play.setAttribute("aria-pressed", "true"); play.textContent = "Stop";
    if (!raf) raf = requestAnimationFrame(loop);
  });
  watchVisible(fig, (v) => { visible = v; if (v && playing && !raf) raf = requestAnimationFrame(loop); });
  keepDrawn(resp, draw);
}

// ---------------------------------------------------------------- plate: the terms of the transform (Corollary 8's proof)
function arrowsPlate() {
  const fig = plate("arrows"), el = rootOf("arrows");
  if (!el) return;
  let step = +(fig.dataset.step || 0), c0 = 0.1, lom = Math.log10(2);
  el.innerHTML = `<p class="fine" id="ar-step"></p><div class="controls">${segHTML("ar-c", [[0.02, "0.02"], [0.1, "0.1"], [0.3, "0.3"]], c0, "Cost of time, c₀")}
      <label class="dial"><span class="ctl-key">Frequency, ω</span><output id="ar-out"></output>
      <input type="range" id="ar-om" min="-1" max="2" step="0.01" value="${lom}" aria-label="Frequency omega, on a log scale"></label></div>
    <div class="chart-wrap" id="ar-chart"></div><dl class="reads" id="ar-reads"></dl>`;
  const chart = $("#ar-chart", el), reads = $("#ar-reads", el), head = $("#ar-step", el), out = $("#ar-out", el), inp = $("#ar-om", el);
  const draw = () => {
    const om = 10 ** lom;
    out.textContent = om >= 10 ? om.toFixed(0) : om.toFixed(2);
    head.textContent = S.ARROW_HEADS[step];
    // an equal-scale complex plane
    const X = [-0.06, 1.1], Y = [-0.12, 0.62], Wd = Math.max(260, Math.round(chart.clientWidth || 340));
    const l = 34, r = 12, t = 16, b = 28, h = Math.round(((Wd - l - r) * (Y[1] - Y[0])) / (X[1] - X[0])) + t + b;
    const f = frame(chart, { x: X, y: Y, h, l, r, t, b });
    let g = axes(f, { xt: [0, 0.5, 1], yt: [0, 0.25, 0.5], xl: "real part", yl: "imaginary part", grid: true });
    g += `<path class="ax" d="M${P(f.sx(0))} ${f.t}V${f.H - f.b}"/>`;
    // the unit circle's arc in the first quadrant
    const arc = range(0, Math.asin(Y[1] - 0.04), 60);
    g += line(f, arc.map((a) => Math.cos(a)), arc.map((a) => Math.sin(a)), "dim", 'stroke-dasharray="2 3"');
    const W0 = K.transfer(c0, om), Wc = { re: W0.re, im: W0.im };
    if (step === 0) {
      const pts = M.runningTransform(c0, om);
      g += line(f, pts.map((p) => p.re), pts.map((p) => p.im), "wb");
      g += dot(f, Wc.re, Wc.im, "wb-dot", 4.5) + txt(f.sx(Wc.re) + 6, f.sy(Wc.im) - 6, "w̃(−iω)", "tag-wb");
      g += dot(f, 0, 0, "ink-dot", 3);
    } else {
      const atZero = step === 1;
      const { terms, rest } = M.seriesTerms(c0, atZero ? 0 : om, 5);
      let x = 0, y = 0;
      terms.forEach((tm, j) => {
        const x1 = x + tm.re, y1 = y + tm.im;
        g += arrowPx(f.sx(x), f.sy(y), f.sx(x1), f.sy(y1), j % 2 ? "ex-thin" : "ex", 6);
        x = x1; y = y1;
      });
      g += arrowPx(f.sx(x), f.sy(y), f.sx(x + rest.re), f.sy(y + rest.im), "ex", 5, 'stroke-dasharray="2 2"');
      if (atZero) {
        g += txt(f.sx(1), f.sy(0) - 10, "sum = 1", "tag-ex", "end");
        g += txt(f.sx(terms[0].re / 2), f.sy(0) + 16, "first term", "tk", "middle");
      } else {
        g += arrowPx(f.sx(0), f.sy(0), f.sx(Wc.re), f.sy(Wc.im), "wb", 7);
        const a = Math.atan2(Wc.im, Wc.re), rr = 0.16, aa = range(0, a, 20);
        g += line(f, aa.map((v) => rr * Math.cos(v)), aa.map((v) => rr * Math.sin(v)), "wb");
        g += txt(f.sx(rr * 1.15), f.sy(0) - 4, `${W0.lead.toFixed(1)}°`, "tag-wb");
        g += txt(f.sx(Wc.re) + 6, f.sy(Wc.im) + 4, "w̃(−iω)", "tag-wb");
        if (step === 3) {
          // the same terms at omega = 0, laid along the real axis, for their lengths
          const z = M.seriesTerms(c0, 0, 5);
          let zx = 0;
          z.terms.forEach((tm, j) => { g += `<path class="dim" d="M${P(f.sx(zx))} ${P(f.sy(-0.06))}H${P(f.sx(zx + tm.re))}M${P(f.sx(zx))} ${P(f.sy(-0.06) - 4)}v8"/>`; zx += tm.re; });
          g += `<path class="dim" stroke-dasharray="2 2" d="M${P(f.sx(zx))} ${P(f.sy(-0.06))}H${P(f.sx(1))}"/>`;
          g += txt(f.sx(1), f.sy(-0.06) + 13, "the same terms at ω = 0", "tk", "end");
        }
      }
    }
    chart.innerHTML = svg(f, g, step === 0 ? "The running integral of the kernel times a complex exponential, ending at the transform" : "The terms of the transform's series drawn head to tail in the complex plane");
    const tail = M.transferSeries(c0, om, 20000);
    let lengths = 0;
    { const b = K.B(c0), F = K.fluxTotal(b); for (let j = 0; j < 20000; j++) { const k2 = K.kappa(j, b) ** 2, al = (1 + k2) / 2; lengths += ((2 / b) * (k2 / (1 + k2))) / F / Math.hypot(al, om); } }
    reads.innerHTML = `${step === 3 ? `<div><dt>Lengths of the terms, summed</dt><dd>${fmt(lengths, 3)}<small>below 1, and at least |w̃(−iω)|</small></dd></div>` : ""}<div class="k-wb"><dt>|w̃(−iω)|</dt><dd>${fmt(W0.gain, 3)}<small>closed form</small></dd></div>
      <div class="k-wb"><dt>Angle</dt><dd>${fmt(W0.lead, 1)}°<small>between 0° and 90°</small></dd></div>
      <div><dt>Series, 20,000 terms</dt><dd>${fmt(Math.hypot(tail.re, tail.im), 3)}<small>|sum| at ${fmt(Math.atan2(tail.im, tail.re) * 180 / Math.PI, 1)}°</small></dd></div>`;
    liftReady(fig);
  };
  inp.addEventListener("input", () => { lom = +inp.value; draw(); });
  onSeg(el, "ar-c", (v) => { c0 = +v; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: how far ahead, at every cost (Figure 2, live)
let MAX_LA = null;
const maxLA = () => (MAX_LA ??= M.maxLookAhead());
function lookaheadPlate() {
  const fig = plate("lookahead"), el = rootOf("lookahead");
  if (!el) return;
  let lc = Math.log10(0.1), guess = null;
  const CS = logRange(1e-4, 10, 220), MS = CS.map((c) => M.lookAheadClosed(c)), DS = CS.map((c) => K.meanDecisionTime(c));
  const SS = logRange(1e-3, 8, 160);
  const ref = [0.3, 0.1, 0.05, 0.02].map((c) => SS.map((s) => K.kernelAt(s, c)));
  el.innerHTML = `<div class="predict"><p>When time is nearly free (c₀ → 0), decisions take longer and longer. How far ahead does the bound look?</p>
      ${segHTML("la-guess", [["zero", "Near 0"], ["half", "About half a unit"], ["long", "As long as a decision"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="la-show">Show me</button></div>
      <p class="verdict" id="la-verdict" aria-live="polite"></p></div>
    <div class="controls"><label class="dial"><span class="ctl-key">Cost of time, c₀</span><output id="la-out"></output>
      <input type="range" id="la-c" min="-4" max="1" step="0.01" value="${lc}" aria-label="Cost of time, on a log scale"></label></div>
    <div class="chart-wrap" id="la-k"></div><div class="chart-wrap pad is-draw" id="la-m"></div>
    <ul class="legend"><li><span class="key key-wb">Mean look-ahead, m(c₀)</span></li><li>Gray: mean decision time from 0, b₀ tanh b₀</li></ul>
    <dl class="reads" id="la-reads"></dl><p class="say" id="la-say"></p>`;
  const kEl = $("#la-k", el), mEl = $("#la-m", el), reads = $("#la-reads", el), say = $("#la-say", el), out = $("#la-out", el), inp = $("#la-c", el), verdict = $("#la-verdict", el);
  const draw = () => {
    const c0 = 10 ** lc, m = K.meanLookAhead(c0), dec = K.meanDecisionTime(c0), best = maxLA();
    out.textContent = S.num(c0);
    const fk = frame(kEl, { x: [1e-3, 8], y: [1e-3, 20], xlog: true, ylog: true, aspect: 0.5, minH: 180, maxH: 260 });
    let g = axes(fk, { yl: "weight w(s)", xl: "time ahead, s", grid: true });
    const inK = (v) => (v >= 1e-3 && v <= 20 ? v : NaN);
    ref.forEach((ys) => { g += line(fk, SS, ys.map(inK), "path-dim"); });
    const ws = SS.map((s) => K.kernelAt(s, c0));
    g += line(fk, SS, ws.map(inK), "wb");
    if (m >= 1e-3) {
      const ym = clampTo(fk, K.kernelAt(m, c0));
      g += dot(fk, m, ym, "wb-dot", 4.5);
      g += txt(fk.sx(m) - 8, fk.sy(ym) + 16, `mean ${fmt(m, 3)}`, "tag-wb", "end");
    } else g += txt(fk.l + 4, fk.t + 12, `mean ${m.toExponential(1)}, left of the chart`, "tag-wb");
    kEl.innerHTML = svg(fk, g, `The kernel for a cost of ${c0.toPrecision(2)} on log axes, with its mean marked, beside the four costs of Figure 2`);
    const fm = frame(mEl, { x: [1e-4, 10], y: [0, 2.5], xlog: true, aspect: 0.5, minH: 180, maxH: 260 });
    let h = axes(fm, { yl: "time", xl: "cost of time, c₀", grid: true, yt: [0, 0.5, 1, 1.5, 2, 2.5] });
    h += `<path class="dim" stroke-dasharray="1 3" d="M${fm.l} ${P(fm.sy(0.5))}H${fm.W - fm.r}"/>`;
    h += line(fm, CS, DS.map((v) => (v <= 2.5 ? v : NaN)), "dim") + line(fm, CS, MS, "wb");
    h += dot(fm, best.cost, best.m, "ink-dot", 3);
    h += `<path class="dim" d="M${P(fm.sx(best.cost))} ${P(fm.sy(best.m) - 5)}V${P(fm.sy(best.m) - 16)}"/>`;
    h += txt(fm.sx(best.cost) - 4, fm.sy(best.m) - 20, `largest ${fmt(best.m, 3)}`, "tag-ex", "end");
    h += `<path class="acc" stroke-dasharray="2 3" d="M${P(fm.sx(c0))} ${fm.t}V${fm.H - fm.b}"/>`;
    h += dot(fm, c0, m, "acc-dot", 4.5);
    if (dec <= 2.5) h += dot(fm, c0, dec, "acc-dot", 4.5);
    else h += arrowPx(fm.sx(c0), fm.t + 16, fm.sx(c0), fm.t + 2, "acc", 5) + txt(fm.sx(c0) + (fm.sx(c0) > fm.W * 0.6 ? -6 : 6), fm.t + 12, `decision time ${fmt(dec, 2)}, off the chart`, "tag-acc", fm.sx(c0) > fm.W * 0.6 ? "end" : "start");
    h += `<rect class="hit" x="${fm.l}" y="${fm.t}" width="${fm.W - fm.l - fm.r}" height="${fm.H - fm.t - fm.b}"/>`;
    mEl.innerHTML = svg(fm, h, "The mean look-ahead and the mean decision time against the cost, with the chosen cost marked");
    mEl._f = fm;
    reads.innerHTML = `<div class="k-wb"><dt>Mean look-ahead, m(c₀)</dt><dd>${S.fixedOr(m, 3)}<small>time units</small></dd></div>
      <div><dt>Mean decision time from 0</dt><dd>${S.fixedOr(dec, 2)}<small>b₀ tanh b₀</small></dd></div>
      <div><dt>Bound, b₀</dt><dd>${fmt(K.B(c0), 3)}</dd></div>
      <div class="k-wb"><dt>Largest look-ahead</dt><dd>${fmt(best.m, 3)}<small>at c₀ ≈ ${fmt(best.cost, 3)}, scanned over 10⁻⁴ to 10</small></dd></div>`;
    say.textContent = S.lookaheadSay(c0, m, dec, best.m, best.cost);
    if (guess) verdict.textContent = S.lookaheadVerdict(guess, M.lookAheadClosed(1e-4), 1e-4, K.meanDecisionTime(1e-4));
    liftReady(fig);
  };
  inp.addEventListener("input", () => { lc = +inp.value; draw(); });
  let down = false;
  const setAt = (e) => { const f = mEl._f, r = mEl.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * f.W; lc = Math.max(-4, Math.min(1, Math.log10(f.ix(px)))); inp.value = lc; draw(); };
  mEl.addEventListener("pointerdown", (e) => { down = true; mEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  mEl.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  mEl.addEventListener("pointerup", () => { down = false; }); mEl.addEventListener("pointercancel", () => { down = false; });
  onSeg(el, "la-guess", (v) => { guess = v; draw(); });
  // Show me: walk the cost down to 1e-4, where the look-ahead is close to its limit
  $("#la-show", el).addEventListener("click", () => {
    if (!guess) guess = "shown";
    if (calm.matches) { lc = -4; inp.value = lc; draw(); return; }
    const from = lc, t0 = performance.now();
    const go = (now) => { const p = Math.min(1, (now - t0) / 1600); lc = from + (-4 - from) * (1 - (1 - p) ** 2); inp.value = lc; draw(); if (p < 1) requestAnimationFrame(go); };
    requestAnimationFrame(go);
  });
  keepDrawn(kEl, draw);
}

// ---------------------------------------------------------------- plate: the look-ahead, step by step (Corollary 9(a), (b))
function meanPlate() {
  const fig = plate("mean"), el = rootOf("mean");
  if (!el) return;
  let step = +(fig.dataset.step || 0), c0 = 0.1;
  const samples = new Map();
  el.innerHTML = `<p class="fine" id="mn-step"></p><div class="controls">${segHTML("mn-c", [[0.02, "0.02"], [0.1, "0.1"], [0.5, "0.5"]], c0, "Cost of time, c₀")}</div>
    <div class="chart-wrap" id="mn-chart"></div><dl class="reads" id="mn-reads"></dl>`;
  const chart = $("#mn-chart", el), reads = $("#mn-reads", el), head = $("#mn-step", el);
  // the mean of 400 decisions from each of six starts, seeded (ch07-model.js's sampleStarts)
  const sampled = (c) => {
    if (!samples.has(c)) samples.set(c, M.sampleStarts(c, seedParam(2026)));
    return samples.get(c);
  };
  const draw = () => {
    head.textContent = S.MEAN_HEADS[step];
    const b = K.B(c0), m = K.meanLookAhead(c0);
    let f, g = "", label = "";
    if (step === 0) {
      const ls = range(0, 6, 121), wt = ls.map((l) => (l === 0 ? 1 : K.transform(l, c0)));
      f = frame(chart, { x: [0, 6], y: [0, 1.08], aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { yl: "w̃(λ)", xl: "λ", grid: true });
      g += line(f, ls, wt, "wb");
      const lt = range(0, Math.min(6, 0.9 / m), 20);
      g += line(f, lt, lt.map((l) => 1 - m * l), "ex-thin", 'stroke-dasharray="4 3"');
      g += dot(f, 0, 1, "ink-dot", 4) + txt(f.sx(0) + 8, f.sy(1) + 14, "w̃(0) = 1", "tag-ex");
      const lEnd = Math.min(6, 0.9 / m);
      g += txt(f.sx(lEnd) + 6, f.sy(1 - m * lEnd) + 4, `slope −${fmt(m, 3)}`, "tag-ex");
      label = "The kernel's Laplace transform, 1 at zero, with its tangent of slope minus the mean";
      const w4 = K.transform(1e-4, c0), dq = -(w4 - 1) / 1e-4;
      reads.innerHTML = `<div class="k-wb"><dt>w̃ at λ = 10⁻⁴</dt><dd>${fmt(w4, 6)}<small>1 − 10⁻⁴ m(c₀) = ${fmt(1 - 1e-4 * m, 6)}</small></dd></div>
        <div class="k-wb"><dt>−w̃′(0), difference quotient</dt><dd>${fmt(dq, 4)}<small>from λ = 10⁻⁴; the mean from the series: ${fmt(m, 4)}</small></dd></div>`;
    } else if (step === 1 || step === 2) {
      const ys = range(0, b, 161), pis = ys.map((y) => K.pi0(y, c0)), ets = ys.map((y) => M.meanTimeFrom(y, b)), prod = ys.map((y, i) => pis[i] * ets[i]);
      const top = Math.max(...pis, ...ets) * 1.12;
      f = frame(chart, { x: [0, b], y: [0, top], aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { xl: "start y", yl: step === 2 ? "mean time to the bound" : "", grid: true, xt: [0, b / 2, b], fx: (v) => (Math.abs(v - b) < 1e-9 ? "b₀" : Math.abs(v - b / 2) < 1e-9 ? "b₀/2" : "0") });
      if (step === 1) {
        g += area(f, ys, prod, 0, "wb-fill") + line(f, ys, pis, "wb") + line(f, ys, ets, "ex");
        g += txt(f.sx(ys[150]) - 6, f.sy(pis[150]) - 6, "π₀(y)", "tag-wb", "end");
        g += txt(f.sx(ys[20]) + 4, f.sy(ets[20]) - 6, "E_y τ₀", "tag-ex");
        const peak = prod.indexOf(Math.max(...prod));
        g += txt(f.sx(ys[peak]), f.sy(prod[peak] * 0.45), "area m", "tag-wb", "middle");
        label = "The start law and the mean time from each start, with their product shaded";
        reads.innerHTML = `<div class="k-wb"><dt>Shaded area</dt><dd>${fmt(M.lookAheadByStarts(c0), 4)}<small>by Simpson's rule</small></dd></div>
          <div class="k-wb"><dt>Mean of the kernel</dt><dd>${fmt(m, 4)}<small>from the series</small></dd></div>`;
      } else {
        g += line(f, ys, ets, "ex");
        const smp = sampled(c0), sm = smp.starts;
        for (const p of sm) {
          const X = f.sx(p.y), Y = f.sy(p.mean);
          g += `<path class="acc" d="M${P(X - 4)} ${P(Y - 4)}l8 8M${P(X + 4)} ${P(Y - 4)}l-8 8M${P(X)} ${P(f.sy(p.mean - 2 * p.se))}V${P(f.sy(p.mean + 2 * p.se))}"/>`;
        }
        g += txt(f.sx(ys[10]) + 4, f.sy(ets[10]) - 8, "b₀ tanh b₀ − y tanh y", "tag-ex");
        label = "The mean time to the bound from each start, beside sampled decisions from six starts";
        const worst = M.worstGap(smp, b);
        reads.innerHTML = `<div><dt>Runs</dt><dd>${(400 * sm.length).toLocaleString("en-US")}<small>400 from each start, checked every ${smp.dt >= 0.001 ? smp.dt : smp.dt.toExponential(1)}</small></dd></div>
          <div><dt>Largest gap, in standard errors</dt><dd>${fmt(worst, 1)}</dd></div>
          <div class="k-wb"><dt>Closed form (22), both forms</dt><dd>${fmt(M.lookAheadFirst(c0), 4)}<small>and ${fmt(M.lookAheadClosed(c0), 4)}</small></dd></div>`;
      }
    } else {
      const cs = logRange(1e-4, 100, 220);
      f = frame(chart, { x: [1e-4, 100], y: [0, 0.7], xlog: true, aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { yl: "m(c₀)", xl: "cost of time, c₀", grid: true, yt: [0, 0.25, 0.5] });
      g += `<path class="dim" stroke-dasharray="1 3" d="M${f.l} ${P(f.sy(0.5))}H${f.W - f.r}"/>`;
      const big = cs.filter((c) => c > 0.3);
      g += line(f, big, big.map((c) => (2 / 3) * K.B(c) ** 2), "ex-thin", 'stroke-dasharray="4 3"');
      g += line(f, cs, cs.map((c) => M.lookAheadClosed(c)), "wb");
      const best = maxLA();
      g += dot(f, best.cost, best.m, "ink-dot", 3) + txt(f.sx(best.cost), f.sy(best.m) - 8, `largest ${fmt(best.m, 3)}`, "tag-ex", "middle");
      g += dot(f, c0, m, "acc-dot", 4.5);
      g += txt(f.sx(1.2e-4), f.sy(0.5) - 5, "½", "tag-ex") + txt(f.sx(3), f.sy(0.25), "⅔ b₀²", "tag-ex");
      label = "The mean look-ahead against the cost, from a ten-thousandth to 100, with its limits";
      reads.innerHTML = `<div class="k-wb"><dt>At c₀ = 10⁻⁴</dt><dd>${fmt(M.lookAheadClosed(1e-4), 4)}<small>tending to ½</small></dd></div>
        <div class="k-wb"><dt>At c₀ = 100, ÷ ⅔ b₀²</dt><dd>${fmt(M.lookAheadClosed(100) / ((2 / 3) * K.B(100) ** 2), 4)}<small>tending to 1</small></dd></div>
        <div><dt>Largest, scanned over 10⁻⁴ to 10</dt><dd>${fmt(best.m, 3)}<small>at c₀ ≈ ${fmt(best.cost, 3)}</small></dd></div>`;
    }
    chart.innerHTML = svg(f, g, label);
    liftReady(fig);
  };
  onSeg(el, "mn-c", (v) => { c0 = +v; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: your schedule, shifted ahead
function shiftPlate() {
  const fig = plate("shift"), el = rootOf("shift");
  if (!el) return;
  let choice = getChoice(), data = null;
  el.innerHTML = `<div class="controls">${pickerHTML("sh-pick")}</div><p class="fine" id="sh-note"></p>
    <div class="chart-wrap" id="sh-cost"></div><div class="chart-wrap" id="sh-chart"></div>
    <ul class="legend"><li><span class="key key-ex">Program's bound, as exported</span></li><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-wbdot">Shifted by m(c(t))</span></li></ul>
    <dl class="reads" id="sh-reads"></dl><p class="say" id="sh-say"></p><p class="fine" id="sh-state" aria-live="polite"></p>`;
  const pick = $("#sh-pick", el), note = $("#sh-note", el), costEl = $("#sh-cost", el), chart = $("#sh-chart", el), reads = $("#sh-reads", el), say = $("#sh-say", el), state = $("#sh-state", el);
  wirePicker(pick);
  const draw = () => {
    if (!data) { costEl.innerHTML = ""; chart.innerHTML = ""; return; }
    const { t, exact, pm, sh, c, view } = data;
    const cf = c.map((v) => (Number.isFinite(v) ? v : NaN)), fin = cf.filter(Number.isFinite);
    const lo = Math.min(...fin) / 1.3, hi = Math.max(...fin) * 1.3;
    const fc = frame(costEl, { x: [0, view], y: [lo, hi], ylog: true, aspect: 0.2, minH: 80, maxH: 110, t: 12, b: 8 });
    let g = axes(fc, { xt: [], yt: [lo * 1.3, hi / 1.3].map((v) => +v.toPrecision(2)), yl: "", grid: true });
    g += line(fc, t, cf, "cost");
    costEl.innerHTML = svg(fc, g, `The cost of time for ${labelOf(choice)}, on a log scale`);
    const all = [...exact, ...pm, ...sh].filter(Number.isFinite);
    const f = frame(chart, { x: [0, view], y: [0, Math.max(...all) * 1.12], aspect: 0.48, minH: 190, maxH: 280 });
    let h = axes(f, { yl: "evidence bound", xl: "time", grid: true });
    h += M.shiftLines(f, t, exact, pm, sh, data.dl);
    chart.innerHTML = svg(f, h, `For ${labelOf(choice)}: the program's exported bound, the per-moment bound, and the per-moment bound shifted ahead by the mean look-ahead`);
    liftReady(fig);
  };
  const run = () => {
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    pick.value = choice.id;
    const dl = deadlineOf(choice);
    const cost = costOf(choice), flat = dl === null && M.isFlat(choice);
    note.textContent = S.shiftNote(dl !== null ? "deadline" : flat ? "constant" : "", labelOf(choice));
    state.textContent = "Solving the dynamic program…";
    solve({ job: "bounds", choice }, { key: "ch07-shift" }).then((m) => {
      const t = m.t, view = dl ?? VIEW;
      const sh = M.shiftSeries(cost, t, dl);
      data = { t, exact: m.exact, pm: m.pm, sh, c: m.cost, view, dl };
      const n = t.length, G = M.shiftGaps(m.exact, m.pm, sh);
      reads.innerHTML = `<div class="k-pm"><dt>Per-moment: average gap</dt><dd>${fmt(G.avgPm, 3)}<small>largest ${fmt(G.maxPm, 3)}</small></dd></div>
        <div class="k-wb"><dt>Shifted: average gap</dt><dd>${fmt(G.avgSh, 3)}<small>largest ${fmt(G.maxSh, 3)}</small></dd></div>
        <div><dt>Shift at time 0</dt><dd>${fmt(M.lookAheadClosed(cost(0)), 3)}<small>m(c(0)), time units</small></dd></div>`;
      say.textContent = S.shiftSay(labelOf(choice), G, flat);
      // a bound strictly between 0 and the grid's first step: the program waits at the center and decides one step out
      const zero = m.exact.some((v, i) => v > 0 && v < 0.02 && (dl === null || t[i] < dl - 1e-9));
      state.textContent = S.shiftState(dl !== null, n, zero);
      draw();
    }).catch((e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; });
  };
  onSchedule((c) => { choice = c; run(); });
  keepDrawn(chart, draw);
  run();
}

// ---------------------------------------------------------------- plate: half an integration (Corollary 9(c))
function halfPlate() {
  const fig = plate("halfint"), el = rootOf("halfint");
  if (!el) return;
  let step = +(fig.dataset.step || 0), c0 = 0.1;
  const peaks = new Map();
  const peakFor = (c) => { if (!peaks.has(c)) peaks.set(c, M.leadPeak(c)); return peaks.get(c); };
  el.innerHTML = `<p class="fine" id="hf-step"></p><div class="controls">${segHTML("hf-c", [[0.02, "0.02"], [0.1, "0.1"], [1, "1"]], c0, "Cost of time, c₀")}</div>
    <div class="chart-wrap" id="hf-a"></div><div class="chart-wrap" id="hf-b"></div><dl class="reads" id="hf-reads"></dl><p class="say" id="hf-say"></p>`;
  const A = $("#hf-a", el), Bw = $("#hf-b", el), reads = $("#hf-reads", el), head = $("#hf-step", el), say = $("#hf-say", el);
  const OM = logRange(0.1, 1e5, 240);
  const draw = () => {
    head.textContent = S.HALF_HEADS[step];
    say.textContent = "";
    Bw.hidden = step !== 2;
    let f, g = "", label = "";
    if (step === 0) {
      const om = logRange(0.1, 1e4, 160), rs = om.map((w) => M.rAndTanh(c0, w).r);
      f = frame(A, { x: [0.1, 1e4], y: [0.05, 200], xlog: true, ylog: true, aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { xl: "ω", grid: true });
      g += line(f, om, om.map((w) => Math.sqrt(w)), "dim", 'stroke-dasharray="1 3"');
      g += line(f, om, rs.map((r) => r.re), "ex") + line(f, om, rs.map((r) => -r.im), "ex-thin");
      g += txt(f.sx(0.13), f.sy(rs[4].re) - 8, "Re r", "tag-ex") + txt(f.sx(0.3), f.sy(-M.rAndTanh(c0, 0.3).r.im) + 18, "−Im r", "tag-ex");
      g += txt(f.sx(300), f.sy(Math.sqrt(300)) + 22, "√ω, dotted", "tk", "middle");
      label = "The real and imaginary parts of r against frequency, beside the square root of omega, on log axes";
      const r = M.rAndTanh(c0, 1e4).r;
      reads.innerHTML = `<div><dt>Re r ÷ √ω at ω = 10⁴</dt><dd>${fmt(r.re / 100, 4)}</dd></div><div><dt>−Im r ÷ √ω at ω = 10⁴</dt><dd>${fmt(-r.im / 100, 4)}</dd></div>`;
    } else if (step === 1) {
      const om = logRange(0.1, 1e3, 160), d = om.map((w) => { const t = M.rAndTanh(c0, w).tanh; return Math.max(1e-16, Math.hypot(t.re - 1, t.im)); });
      f = frame(A, { x: [0.1, 1e3], y: [1e-16, 2], xlog: true, ylog: true, aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { yl: "|tanh(r b₀) − 1|", xl: "ω", grid: true });
      g += line(f, om, d, "ex");
      label = "The distance of tanh of r b zero from 1 against frequency, falling exponentially";
      const at = (w) => { const t = M.rAndTanh(c0, w).tanh; return Math.hypot(t.re - 1, t.im); };
      reads.innerHTML = `<div><dt>At ω = 10</dt><dd>${at(10).toExponential(1)}</dd></div><div><dt>At ω = 100</dt><dd>${at(100).toExponential(1)}</dd></div><div><dt>b₀</dt><dd>${fmt(K.B(c0), 3)}</dd></div>`;
    } else if (step === 2) {
      const tr = OM.map((w) => K.transfer(c0, w));
      f = frame(A, { x: [0.1, 1e5], y: [1e-3, 1.3], xlog: true, ylog: true, aspect: 0.5, minH: 170, maxH: 240 });
      g = axes(f, { yl: "gain", xl: "ω", grid: true });
      const hiOm = OM.filter((w) => w > 1);
      g += line(f, hiOm, hiOm.map((w) => M.gainAsymptote(w, c0)), "dim", 'stroke-dasharray="1 3"');
      g += line(f, OM, tr.map((t) => t.gain), "wb");
      g += txt(f.sx(3e3), f.sy(M.gainAsymptote(3e3, c0)) - 10, "slope −½", "tk", "middle");
      label = "The gain against frequency on log axes, with its line of slope minus one half";
      const fl = frame(Bw, { x: [0.1, 1e5], y: [0, 50], xlog: true, aspect: 0.42, minH: 150, maxH: 210 });
      let h = axes(fl, { yl: "lead (degrees)", xl: "ω", grid: true, yt: [0, 15, 30, 45] });
      h += `<path class="dim" stroke-dasharray="1 3" d="M${fl.l} ${P(fl.sy(45))}H${fl.W - fl.r}"/>`;
      h += line(fl, OM, tr.map((t) => t.lead), "wb");
      const pk = peakFor(c0);
      if (pk.lead > 45.005) h += dot(fl, pk.omega, pk.lead, "ink-dot", 3.5) + txt(fl.sx(pk.omega), fl.sy(pk.lead) - 8, `${fmt(pk.lead, 2)}°`, "tag-ex", "middle");
      Bw.innerHTML = svg(fl, h, "The lead against frequency, tending to 45 degrees");
      const sl = M.logSlope((w) => K.transfer(c0, w).gain, 1e4);
      reads.innerHTML = `<div class="k-wb"><dt>Gain's slope at ω = 10⁴</dt><dd>${fmt(sl, 3)}<small>measured on the curve</small></dd></div>
        <div class="k-wb"><dt>Gain ÷ the line, ω = 10⁴</dt><dd>${fmt(K.transfer(c0, 1e4).gain / M.gainAsymptote(1e4, c0), 4)}</dd></div>
        <div class="k-wb"><dt>Lead at ω = 10⁴</dt><dd>${fmt(K.transfer(c0, 1e4).lead, 2)}°</dd></div>
        <div><dt>Largest lead</dt><dd>${fmt(pk.lead, 2)}°<small>near ω = ${pk.omega >= 100 ? pk.omega.toExponential(0) : Math.round(pk.omega)}</small></dd></div>`;
      say.textContent = S.leadPeakSay(c0, pk);
    } else if (step === 3) {
      const ss = logRange(1e-5, 1, 180);
      f = frame(A, { x: [1e-5, 1], y: [0.1, 1000], xlog: true, ylog: true, aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { yl: "weight w(s)", xl: "time ahead, s", grid: true });
      g += line(f, ss, ss.map((s) => M.kernelNearZero(s, c0)), "dim", 'stroke-dasharray="1 3"');
      g += line(f, ss, ss.map((s) => K.kernelAt(s, c0)), "wb");
      g += txt(f.sx(1e-3), f.sy(M.kernelNearZero(1e-3, c0)) - 10, "slope −½", "tk", "start");
      label = "The kernel near zero on log axes, beside a line of slope minus one half";
      reads.innerHTML = `<div class="k-wb"><dt>Kernel's slope at s = 10⁻⁴</dt><dd>${fmt(M.logSlope((s) => K.kernelAt(s, c0), 1e-4), 3)}<small>measured on the curve</small></dd></div>
        <div class="k-wb"><dt>Kernel ÷ the line, s = 10⁻⁶</dt><dd>${fmt(K.kernelAt(1e-6, c0) / M.kernelNearZero(1e-6, c0), 4)}</dd></div>`;
    } else {
      const m = K.meanLookAhead(c0), tr = OM.map((w) => K.transfer(c0, w).gain), ex = OM.map((w) => 1 / Math.hypot(1, w * m));
      f = frame(A, { x: [0.1, 1e5], y: [1e-5, 1.3], xlog: true, ylog: true, aspect: 0.55, minH: 180, maxH: 260 });
      g = axes(f, { yl: "gain", xl: "ω", grid: true });
      g += line(f, OM, ex, "ex-thin", 'stroke-dasharray="4 3"') + line(f, OM, tr, "wb");
      g += tags(f, [{ y: tr[200], text: "the kernel, slope −½", cls: "tag-wb" }, { y: ex[200], text: "exponential, slope −1", cls: "tag-ex" }], f.sx(OM[200]));
      label = "The kernel's gain beside an exponential kernel's with the same mean, on log axes";
      reads.innerHTML = `<div class="k-wb"><dt>Kernel's gain at ω = 100</dt><dd>${fmt(K.transfer(c0, 100).gain, 3)}</dd></div>
        <div><dt>Exponential's, same mean</dt><dd>${fmt(1 / Math.hypot(1, 100 * m), 3)}<small>mean ${fmt(m, 3)}</small></dd></div>`;
    }
    A.innerHTML = svg(f, g, label);
    liftReady(fig);
  };
  onSeg(el, "hf-c", (v) => { c0 = +v; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(A, draw);
}

// ---------------------------------------------------------------- plate: off the peak
function rewardPlate() {
  const fig = plate("reward"), el = rootOf("reward");
  if (!el) return;
  let c = 0.1, delta = 0.3, guess = null;
  el.innerHTML = `<div class="predict"><p>Missing the peak by 0.1 loses some reward. Missing it by 0.2 loses…</p>
      ${segHTML("rw-guess", [["same", "About the same"], ["two", "Twice as much"], ["four", "Four times"]], "", "Your guess")}
      <p class="verdict" id="rw-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("rw-c", [[0.02, "0.02"], [0.1, "0.1"], [0.5, "0.5"]], c, "Cost of time, c")}
      <label class="dial"><span class="ctl-key">Miss, δ = b − B(c)</span><output id="rw-out"></output>
      <input type="range" id="rw-d" min="-0.8" max="0.8" step="0.005" value="${delta}" aria-label="The miss from the peak"></label></div>
    <div class="chart-wrap pad is-draw" id="rw-top"></div><div class="chart-wrap" id="rw-bot"></div>
    <dl class="reads" id="rw-reads"></dl><p class="say" id="rw-say"></p>`;
  const top = $("#rw-top", el), bot = $("#rw-bot", el), reads = $("#rw-reads", el), say = $("#rw-say", el), out = $("#rw-out", el), inp = $("#rw-d", el), verdict = $("#rw-verdict", el);
  const DS = logRange(0.01, 0.8, 120);
  const draw = () => {
    const B = K.B(c), RB = M.flatReward(B, c);
    delta = Math.max(-Math.min(0.8, B - 0.02), Math.min(0.8, delta));
    out.textContent = (delta >= 0 ? "+" : "−") + Math.abs(delta).toFixed(3);
    const bs = range(Math.max(0, B - 1), B + 1, 201), rs = bs.map((b) => M.flatReward(b, c));
    const lo = Math.min(...rs), hi = RB;
    const f = frame(top, { x: [bs[0], bs[bs.length - 1]], y: [lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.18], aspect: 0.5, minH: 180, maxH: 250 });
    let g = axes(f, { yl: "reward R(b)", xl: "flat bound b", grid: true });
    g += line(f, bs, rs, "ex");
    const b = B + delta, R = M.flatReward(b, c);
    g += `<path class="dim" stroke-dasharray="2 3" d="M${f.l} ${P(f.sy(RB))}H${f.W - f.r}"/>`;
    g += `<path class="acc" d="M${P(f.sx(b))} ${P(f.sy(RB))}V${P(f.sy(R))}"/>`;
    g += dot(f, B, RB, "ink-dot", 4) + txt(f.sx(B), f.sy(RB) - 9, `B(${c}) = ${fmt(B, 3)}`, "tag-ex", "middle");
    g += dot(f, b, R, "acc-dot", 5.5);
    g += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    top.innerHTML = svg(f, g, `The reward of a flat bound at a cost of ${c}, with its peak and the bound you set`);
    top._f = f;
    const up = DS.map((d) => RB - M.flatReward(B + d, c)), dn = DS.map((d) => (d < B ? RB - M.flatReward(B - d, c) : NaN));
    const fb = frame(bot, { x: [0.01, 0.8], y: [Math.min(...up.filter((v) => v > 0)) / 2, Math.max(...up, ...dn.filter(Number.isFinite)) * 2], xlog: true, ylog: true, aspect: 0.45, minH: 160, maxH: 220 });
    let h = axes(fb, { yl: "loss", xl: "size of the miss, |δ|", grid: true });
    h += line(fb, DS, DS.map((d) => c * d * d), "dim", 'stroke-dasharray="1 3"');
    h += line(fb, DS, dn, "ex-thin") + line(fb, DS, up, "ex");
    h += txt(fb.sx(0.025), fb.sy(c * 0.025 ** 2) + 16, "c δ², dotted", "tk");
    const L = RB - R;
    if (Math.abs(delta) >= 0.01 && L > 0) h += dot(fb, Math.abs(delta), clampTo(fb, L), "acc-dot", 4.5);
    bot.innerHTML = svg(fb, h, "The loss against the size of the miss on log axes, above and below the peak, beside c delta squared");
    reads.innerHTML = `<div class="k-acc"><dt>Miss δ</dt><dd>${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta), 3)}</dd></div>
      <div class="k-acc"><dt>Loss R(B) − R(b)</dt><dd>${L > 0 ? L.toExponential(2) : "0"}</dd></div>
      <div><dt>c δ²</dt><dd>${(c * delta * delta).toExponential(2)}<small>the conjecture's formula, here</small></dd></div>`;
    say.textContent = S.rewardSay(c, delta, L, c * delta * delta);
    if (guess) {
      const r = (d) => (RB - M.flatReward(B + d, c));
      verdict.textContent = S.rewardVerdict(guess, r(0.2) / r(0.1), r(-0.2) / r(-0.1), c);
    }
    liftReady(fig);
  };
  inp.addEventListener("input", () => { delta = +inp.value; draw(); });
  onSeg(el, "rw-c", (v) => { c = +v; draw(); });
  onSeg(el, "rw-guess", (v) => { guess = v; draw(); });
  let down = false;
  const setAt = (e) => { const f = top._f, r = top.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * f.W; delta = f.ix(px) - K.B(c); inp.value = delta; draw(); };
  top.addEventListener("pointerdown", (e) => { down = true; top.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  top.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  top.addEventListener("pointerup", () => { down = false; }); top.addEventListener("pointercancel", () => { down = false; });
  keepDrawn(top, draw);
}

// ---------------------------------------------------------------- plate: a thin band at the bound (Proposition 10's proof)
function bandPlate() {
  const fig = plate("band"), el = rootOf("band");
  if (!el) return;
  const c0 = 0.1, b0 = K.B(c0), y0 = 0, dt = 0.0005;
  let step = +(fig.dataset.step || 0), D = 0.1;
  // one path of Y = |X| from y0, run until it passes the highest level the slider can ask for
  const R = K.rng(seedParam(2026) + 17);
  const pts = [[0, y0]];
  { let x = y0, t = 0; while (Math.abs(x) < b0 + 0.32 && t < 40) { x += Math.tanh(x) * dt + Math.sqrt(dt) * R.normal(); t += dt; pts.push([t, Math.abs(x)]); } }
  // the first time the path reaches a level that may move with time, interpolated within the step
  const hitLevel = (lev) => {
    for (let i = 1; i < pts.length; i++) {
      const L1 = lev(pts[i][0]);
      if (pts[i][1] >= L1) { const [ta, ya] = pts[i - 1], [tb, yb] = pts[i], L0 = lev(ta); const u = (L0 - ya) / ((yb - L1) - (ya - L0)); return ta + Math.max(0, Math.min(1, u)) * (tb - ta); }
    }
    return NaN;
  };
  const keep = pts.filter((_, i) => i % 8 === 0);
  const DS = logRange(0.003, 0.3, 80);
  const w0max = (d) => M.waitingValue(b0 - d, c0);
  el.innerHTML = `<p class="fine" id="bd-step"></p><div class="controls"><label class="dial"><span class="ctl-key">Band half-width, D = A|ε|</span><output id="bd-out"></output>
    <input type="range" id="bd-d" min="${Math.log10(0.003)}" max="${Math.log10(0.3)}" step="0.01" value="${Math.log10(D)}" aria-label="Band half-width, on a log scale"></label></div>
    <div class="chart-wrap" id="bd-chart"></div><dl class="reads" id="bd-reads"></dl><p class="say" id="bd-say"></p>`;
  const chart = $("#bd-chart", el), reads = $("#bd-reads", el), head = $("#bd-step", el), out = $("#bd-out", el), inp = $("#bd-d", el), say = $("#bd-say", el);
  const draw = () => {
    head.textContent = S.BAND_HEADS[step];
    out.textContent = fmt(D, 3);
    let f, g = "", label = "";
    const tA = M.timeAbove(b0, D), eGap = M.hitMean(y0, b0 + D) - M.hitMean(y0, b0 - D);
    if (step === 0) {
      const lev = (t) => b0 + 0.8 * D * Math.sin(14 * t + 1);
      const sm = hitLevel(() => b0 - D), sp = hitLevel(() => b0 + D), sh = hitLevel(lev);
      const t0 = Math.max(0, sm - 0.35), tEnd = Math.min(pts[pts.length - 1][0], sp + 0.12);
      f = frame(chart, { x: [t0, tEnd], y: [b0 - 0.75, b0 + 0.42], aspect: 0.55, minH: 190, maxH: 270 });
      g = axes(f, { yl: "Y = |X|", xl: "time", grid: true });
      g += `<rect class="band" x="${f.l}" y="${P(f.sy(b0 + D))}" width="${f.W - f.l - f.r}" height="${P(f.sy(b0 - D) - f.sy(b0 + D))}"/>`;
      const kk = pts.filter((p, i) => p[0] >= t0 && p[0] <= tEnd && i % 2 === 0);
      g += line(f, kk.map((p) => p[0]), kk.map((p) => p[1]), "dim");
      const tl = range(t0, tEnd, 200);
      g += line(f, tl, tl.map(lev), "acc");
      g += `<path class="bound-line" d="M${f.l} ${P(f.sy(b0))}H${f.W - f.r}" stroke-dasharray="5 3"/>` + txt(f.l + 4, f.sy(b0 + D) - 6, "b₀ ± D", "tag-ex");
      const mk = (tt, lbl, cls, anchor, y) => (Number.isFinite(tt) ? `<path class="dim" stroke-dasharray="2 3" d="M${P(f.sx(tt))} ${f.t}V${f.H - f.b}"/>` + txt(f.sx(tt) + (anchor === "end" ? -4 : anchor === "start" ? 4 : 0), y, lbl, cls, anchor) : "");
      g += mk(sm, "τ⁻", "tag-ex", "end", f.H - f.b - 8) + mk(sp, "τ⁺", "tag-ex", "start", f.H - f.b - 8) + mk(sh, "τ̂", "tag-acc", "middle", f.H - f.b - 24);
      label = "One path of the evidence's size, a band around the bound, and a bound that wanders inside it, with three hitting times";
    } else if (step === 1) {
      const ys = range(0, b0 + 0.25, 200);
      const ws = ys.map((y) => M.waitingValue(y, c0));
      f = frame(chart, { x: [0, b0 + 0.25], y: [0, Math.max(...ws) * 1.1], aspect: 0.55, minH: 190, maxH: 270 });
      g = axes(f, { yl: "waiting value W₀(y)", xl: "evidence y", grid: true, xt: [0, b0 / 2, b0], fx: (v) => (Math.abs(v - b0) < 1e-9 ? "b₀" : Math.abs(v - b0 / 2) < 1e-9 ? "b₀/2" : "0") });
      g += `<rect class="band" x="${P(f.sx(b0 - D))}" y="${f.t}" width="${P(f.sx(b0) - f.sx(b0 - D))}" height="${f.H - f.t - f.b}"/>`;
      const near = ys.filter((y) => y > b0 - 0.6 && y <= b0);
      g += line(f, near, near.map((y) => c0 * (b0 - y) ** 2), "dim", 'stroke-dasharray="1 3"');
      g += line(f, ys, ws, "ex");
      g += dot(f, b0 - D, w0max(D), "acc-dot", 4);
      g += txt(f.sx(b0 - 0.55), f.sy(c0 * 0.3025) - 8, "c₀(b₀ − y)²", "tk", "start");
      label = "The waiting value at the constant cost, touching zero at the bound like a parabola, with the band shaded";
    } else if (step === 2) {
      f = frame(chart, { x: [0.003, 0.3], y: [1e-7, 0.1], xlog: true, ylog: true, aspect: 0.55, minH: 190, maxH: 270 });
      g = axes(f, { xl: "band half-width D", grid: true });
      g += line(f, DS, DS.map((d) => 0.008 * d * d), "guide") + txt(f.sx(0.06), f.sy(0.008 * 0.06 ** 2) + 15, "slope 2", "tk", "middle");
      g += line(f, DS, DS.map(w0max), "ex") + line(f, DS, DS.map((d) => c0 * M.timeAbove(b0, d)), "ex-thin");
      g += txt(f.sx(0.0035), f.sy(w0max(0.0035)) - 14, "largest W₀ in the band (bold)", "tag-ex");
      g += txt(f.sx(0.035), f.sy(c0 * M.timeAbove(b0, 0.035)) + 20, "c₀ × time above b₀ (thin)", "tag-ex");
      g += dot(f, D, w0max(D), "acc-dot", 4) + dot(f, D, c0 * tA, "acc-dot", 4);
      label = "The waiting value left in the band and the cost of time spent above the bound against the band's width, on log axes";
    } else {
      f = frame(chart, { x: [0.003, 0.3], y: [1e-5, 2], xlog: true, ylog: true, aspect: 0.55, minH: 190, maxH: 270 });
      g = axes(f, { xl: "band half-width D", grid: true });
      const gap = DS.map((d) => M.hitMean(y0, b0 + d) - M.hitMean(y0, b0 - d));
      g += line(f, DS, gap, "ex-thin") + line(f, DS, DS.map((d, i) => d * gap[i]), "ex");
      g += tags(f, [{ y: gap[70], text: "E τ⁺ − E τ⁻, slope 1", cls: "tag-ex" }, { y: DS[70] * gap[70], text: "D × that, slope 2", cls: "tag-ex" }], f.sx(DS[70]));
      g += dot(f, D, eGap, "acc-dot", 4) + dot(f, D, D * eGap, "acc-dot", 4);
      label = "The gap between the two fixed levels' mean hitting times, and D times it, against the band's width, on log axes";
    }
    chart.innerHTML = svg(f, g, label);
    reads.innerHTML = `<div class="k-acc"><dt>D</dt><dd>${fmt(D, 3)}</dd></div>
      <div><dt>Largest W₀ in the band</dt><dd>${w0max(D).toExponential(2)}<small>c₀D² = ${(c0 * D * D).toExponential(2)}</small></dd></div>
      <div><dt>c₀ × time above b₀</dt><dd>${(c0 * tA).toExponential(2)}<small>time above ÷ D² = ${fmt(tA / (D * D), 3)}</small></dd></div>
      <div><dt>E τ⁺ − E τ⁻</dt><dd>${fmt(eGap, 4)}<small>÷ D = ${fmt(eGap / D, 3)}</small></dd></div>`;
    say.textContent = S.bandSay(D, w0max(D), c0 * D * D, c0 * tA);
    liftReady(fig);
  };
  inp.addEventListener("input", () => { D = 10 ** +inp.value; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- the losses on the reader's schedule, in chapter 7's worker
const LOSS_EPS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32, 1 / 64];
let lossWorker = null, lossNext = 1;
const lossPending = new Map(), lossCache = new Map();
function getLossWorker() {
  if (lossWorker) return lossWorker;
  lossWorker = new Worker(new URL("./ch07-worker.js?v=d73958033e", import.meta.url), { type: "module" });
  lossWorker.onmessage = (e) => {
    const m = e.data, p = lossPending.get(m.id);
    if (!p) return;
    if (m.progress !== undefined) { p.entry.done = m.progress; p.entry.listeners.forEach((fn) => fn(m.progress)); return; }
    lossPending.delete(m.id);
    if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
  };
  lossWorker.onerror = (e) => { lossPending.forEach((p) => p.reject(new Error(e.message || "the worker failed"))); lossPending.clear(); lossCache.clear(); };
  return lossWorker;
}
/** The loss runs for a schedule: one job per schedule, shared by the plates that show it. */
function lossFor(choice, onProgress) {
  const key = JSON.stringify(choice);
  let entry = lossCache.get(key);
  if (!entry) {
    const id = lossNext++;
    entry = { listeners: new Set(), done: 0 };
    entry.promise = new Promise((resolve, reject) => { lossPending.set(id, { resolve, reject, entry }); getLossWorker().postMessage({ job: "loss", choice, eps: LOSS_EPS, id }); });
    entry.promise.catch(() => lossCache.delete(key));
    lossCache.set(key, entry);
  }
  if (onProgress) { entry.listeners.add(onProgress); onProgress(entry.done); }
  return entry.promise;
}
// what a schedule is, for the loss plates: a deadline, a flat cost (by its values, so a flat drawing or a Smooth of
// size 0 counts), the rising cost, or one the proposition covers
const scheduleKind = (choice) => (deadlineOf(choice) !== null ? "deadline" : M.isFlat(choice) ? "constant" : choice.id === "rising" ? "rising" : "");
const epsLabel = (e) => (e >= 1 ? "1" : `1/${Math.round(1 / e)}`);
const epsDial = (id, k) => `<label class="dial"><span class="ctl-key">Size of the change, ε</span><output id="${id}-out">${epsLabel(LOSS_EPS[k])}</output>
  <input type="range" id="${id}" min="0" max="${LOSS_EPS.length - 1}" step="1" value="${k}" aria-label="Size of the change, as a power of one half"></label>`;

function lossPlate() {
  const fig = plate("loss"), el = rootOf("loss");
  if (!el) return;
  let choice = getChoice(), data = null, k = 2;
  el.innerHTML = `<div class="controls">${pickerHTML("ls-pick")}${epsDial("ls-eps", k)}</div><p class="fine" id="ls-note"></p>
    <div class="chart-wrap" id="ls-top"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-wb">First-order bound</span></li></ul>
    <div class="chart-wrap" id="ls-bot"></div>
    <dl class="reads" id="ls-reads"></dl><p class="say" id="ls-say"></p><p class="fine" id="ls-state" aria-live="polite"></p>`;
  const pick = $("#ls-pick", el), note = $("#ls-note", el), top = $("#ls-top", el), bot = $("#ls-bot", el), reads = $("#ls-reads", el), say = $("#ls-say", el), state = $("#ls-state", el);
  const epsIn = $("#ls-eps", el), epsOut = $("#ls-eps-out", el);
  wirePicker(pick);
  const draw = () => {
    if (!data) { top.innerHTML = ""; bot.innerHTML = ""; return; }
    const run = data.runs[k], { t } = data;
    const all = [...run.bounds.dp, ...run.bounds.pm, ...run.bounds.fo].filter(Number.isFinite);
    const lo = Math.min(0, ...all), hi = Math.max(...all);
    const f = frame(top, { x: [0, VIEW], y: [lo, hi * 1.1 + 0.02], aspect: 0.42, minH: 170, maxH: 250 });
    let g = axes(f, { yl: "evidence bound", xl: "time", grid: true });
    g += line(f, t, run.bounds.pm, "pm") + line(f, t, run.bounds.fo, "wb") + line(f, t, run.bounds.dp, "ex");
    top.innerHTML = svg(f, g, `At epsilon ${epsLabel(run.eps)}: the best bound, the per-moment rule, and the first-order bound`);
    const floor10 = 10 * data.floor;
    const lp = data.runs.map((r) => r.loss.pm), lf = data.runs.map((r) => r.loss.fo);
    const pos = [...lp, ...lf].filter((v) => v > 0);
    if (!pos.length) { bot.innerHTML = `<p class="fine">${S.noLossNote()}</p>`; liftReady(fig); return; }
    const [yLo, yHi] = M.lossAxis(pos, floor10);
    const fb = frame(bot, { x: [1 / 90, 1.4], y: [yLo, yHi], xlog: true, ylog: true, aspect: 0.5, minH: 190, maxH: 270 });
    let h = axes(fb, { yl: "loss of reward", xl: "size of the change, ε", grid: true, xt: LOSS_EPS.slice().reverse(), fx: epsLabel });
    // the slope-2 guide through the per-moment loss at the largest resolved epsilon of 1/4 or less
    const anchor = data.runs.findIndex((r) => r.eps <= 0.25 + 1e-9 && M.resolved(r.loss.pm, data.floor));
    if (anchor >= 0) {
      const e0 = LOSS_EPS[anchor], y0 = lp[anchor] * 1.8, xs = [1.2, 1 / 80];
      h += line(fb, xs, xs.map((x) => y0 * (x / e0) ** 2), "guide");
      const xg = 1 / 45, yg = clampTo(fb, y0 * (xg / e0) ** 2);
      h += txt(fb.sx(xg) + 6, fb.sy(yg) + 15, "slope 2", "tk");
    }
    h += `<path class="dim" stroke-dasharray="1 3" d="M${fb.l} ${P(fb.sy(floor10))}H${fb.W - fb.r}"/>` + txt(fb.W - fb.r, fb.sy(floor10) + 13, "display cutoff, ten times the baseline", "tk", "end");
    h += line(fb, LOSS_EPS, lp.map((v) => (v > 0 ? v : NaN)), "pm") + line(fb, LOSS_EPS, lf.map((v) => (v > 0 ? v : NaN)), "wb-thin");
    const mark = (v, i, full, hollow) => { const y = v > 0 ? v : yLo; return dot(fb, LOSS_EPS[i], clampTo(fb, y), M.resolved(v, data.floor) ? full : hollow, i === k ? 5 : 3.5); };
    h += lp.map((v, i) => mark(v, i, "pm-dot", "ring-pm")).join("") + lf.map((v, i) => mark(v, i, "wb-dot", "ring-wb")).join("");
    bot.innerHTML = svg(fb, h, "Each rule's loss against the size of the change on log axes, with a guide line of slope 2");
    liftReady(fig);
  };
  const readOut = () => {
    if (!data) return;
    const run = data.runs[k];
    const rp = data.runs.map((r) => M.resolved(r.loss.pm, data.floor)), rf = data.runs.map((r) => M.resolved(r.loss.fo, data.floor));
    const sp = M.lastSlope(LOSS_EPS, data.runs.map((r) => r.loss.pm), rp), sf = M.lastSlope(LOSS_EPS, data.runs.map((r) => r.loss.fo), rf);
    const v = (x) => (Math.abs(x) < 1e-12 ? "0" : S.num(x));
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment loss</dt><dd>${v(run.loss.pm)}<small>slope, three smallest above the cutoff: ${fmt(sp, 2)}</small></dd></div>
      <div class="k-wb"><dt>First-order bound's loss</dt><dd>${v(run.loss.fo)}<small>slope, three smallest above the cutoff: ${fmt(sf, 2)}</small></dd></div>
      <div><dt>Baseline loss</dt><dd>${S.num(data.floor)}<small>the per-moment loss at the constant cost c(0), on this grid and horizon</small></dd></div>`;
    say.textContent = S.lossSay(run.eps, run.loss.pm, run.loss.fo, sp, sf, rp[k], rf[k], run.foZero, rp.filter(Boolean).length, rf.filter(Boolean).length, LOSS_EPS.length);
  };
  const run = () => {
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    pick.value = choice.id;
    const kind = scheduleKind(choice);
    const c0 = costOf(choice)(0);
    note.textContent = S.lossNote(kind, labelOf(choice), c0);
    if (kind === "deadline" || kind === "constant") { state.textContent = ""; return; }
    const mine = JSON.stringify(choice);
    lossFor(choice, (p) => { if (JSON.stringify(choice) === mine && !data) state.textContent = `Solving and scoring ${LOSS_EPS.length} sizes of the change… ${Math.round(p * LOSS_EPS.length)} of ${LOSS_EPS.length}`; }).then((m) => {
      if (JSON.stringify(choice) !== mine) return;
      data = m;
      state.textContent = S.lossState(M.LOSS_HORIZON, m.runs.some((r) => r.centerWaits > 0), "loss");
      draw(); readOut();
    }).catch((e) => { if (JSON.stringify(choice) === mine) state.textContent = "The solver stopped: " + e.message; });
  };
  epsIn.addEventListener("input", () => { k = +epsIn.value; epsOut.textContent = epsLabel(LOSS_EPS[k]); draw(); readOut(); });
  onSchedule((c) => { choice = c; run(); });
  keepDrawn(bot, draw);
  run();
}

// ---------------------------------------------------------------- plate: Conjecture 11 on your schedule
function conjPlate() {
  const fig = plate("conj"), el = rootOf("conj");
  if (!el) return;
  let choice = getChoice(), data = null, k = 2;
  el.innerHTML = `<p class="conj-flag">Conjecture: the paper does not prove this formula.</p>
    <div class="controls">${pickerHTML("cj-pick")}${epsDial("cj-eps", k)}</div><p class="fine" id="cj-note"></p>
    <div class="chart-wrap" id="cj-top"></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-wb">First-order bound</span></li><li>Shaded: the last 2 time units</li></ul>
    <div class="chart-wrap" id="cj-bot"></div>
    <dl class="reads" id="cj-reads"></dl><p class="say" id="cj-say"></p>
    <dl class="reads" id="cj-facts"></dl><p class="fine" id="cj-state" aria-live="polite"></p>`;
  const pick = $("#cj-pick", el), note = $("#cj-note", el), top = $("#cj-top", el), bot = $("#cj-bot", el), reads = $("#cj-reads", el), say = $("#cj-say", el), facts = $("#cj-facts", el), state = $("#cj-state", el);
  const epsIn = $("#cj-eps", el), epsOut = $("#cj-eps-out", el);
  wirePicker(pick);
  const ratio = (r, which) => (r.loss[which] > 0 ? r.pred[which] / r.loss[which] : NaN);
  const draw = () => {
    if (!data) { top.innerHTML = ""; bot.innerHTML = ""; return; }
    const run = data.runs[k], H = data.horizon;
    const f = frame(top, { x: [0.01, H], y: [0, 1.05], xlog: true, aspect: 0.42, minH: 170, maxH: 240 });
    let g = axes(f, { yl: "share of the prediction", xl: "time of decision", grid: true, yt: [0, 0.5, 1], xt: [0.01, 0.1, 1, 10] });
    g += `<rect class="band" x="${P(f.sx(H - 2))}" y="${f.t}" width="${P(f.sx(H) - f.sx(H - 2))}" height="${f.H - f.t - f.b}"/>`;
    const tcs = data.tc.map((t) => Math.max(t, 0.01));
    g += line(f, tcs, run.cum.pm, "pm") + line(f, tcs, run.cum.fo, "wb");
    g += txt(f.sx(H - 2) - 4, f.H - f.b - 8, `forced choice at ${H}`, "tk", "end");
    top.innerHTML = svg(f, g, `At epsilon ${epsLabel(run.eps)}: the running share of the conjecture's prediction against the time of decision, for each rule`);
    // the axis reaches the largest ratio up to 8; a ratio past that is drawn at the top with an arrow and its value
    const ratios = data.runs.flatMap((r) => [ratio(r, "pm"), ratio(r, "fo")]).filter(Number.isFinite);
    const yMax = M.ratioAxisTop(ratios);
    const fb = frame(bot, { x: [1 / 90, 1.4], y: [0, yMax], xlog: true, aspect: 0.45, minH: 170, maxH: 240 });
    let h = axes(fb, { yl: "predicted ÷ scored", xl: "size of the change, ε", grid: true, xt: LOSS_EPS.slice().reverse(), fx: epsLabel });
    h += `<path class="guide" d="M${fb.l} ${P(fb.sy(1))}H${fb.W - fb.r}"/>` + txt(fb.l + 4, fb.sy(1) - 6, "1, the agreement line", "tk");
    const pts = (which, full, hollow, tagCls) => data.runs.map((r, i) => {
      const v = ratio(r, which), mk = M.ratioMark(v, yMax);
      if (mk === "none") return "";
      const cls = M.resolved(r.loss[which], data.floor) ? full : hollow;
      if (mk === "dot") return dot(fb, LOSS_EPS[i], Math.max(0, v), cls, i === k ? 5 : 3.5);
      const X = fb.sx(LOSS_EPS[i]), Y = fb.sy(yMax);
      return arrowPx(X, Y + 12, X, Y - 2, tagCls === "tag-wb" ? "wb" : "pm", 5) + txt(X, Y + 24, fmt(v, 1), tagCls, "middle");
    }).join("");
    h += line(fb, LOSS_EPS, data.runs.map((r) => { const v = ratio(r, "pm"); return M.resolved(r.loss.pm, data.floor) && v <= yMax ? v : NaN; }), "pm");
    h += pts("fo", "wb-dot", "ring-wb", "tag-wb") + pts("pm", "pm-dot", "ring-pm", "tag-pm");
    bot.innerHTML = svg(fb, h, "The conjecture's prediction divided by the scored loss, against the size of the change, for each rule");
    liftReady(fig);
  };
  const readOut = () => {
    if (!data) return;
    const run = data.runs[k], rp = M.resolved(run.loss.pm, data.floor), rf = M.resolved(run.loss.fo, data.floor);
    const v = (x) => (Math.abs(x) < 1e-12 ? "0" : S.num(x));
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment: predicted</dt><dd>${v(run.pred.pm)}<small>scored ${v(run.loss.pm)}${rp ? "" : ", below the cutoff"}</small></dd></div>
      <div class="k-pm"><dt>Ratio</dt><dd>${fmt(ratio(run, "pm"), 2)}<small>${fmt(run.late.pm * 100, 0)}% from the last 2 time units</small></dd></div>
      <div class="k-wb"><dt>First-order: predicted</dt><dd>${v(run.pred.fo)}<small>scored ${v(run.loss.fo)}${rf ? "" : ", below the cutoff"}</small></dd></div>
      <div class="k-wb"><dt>Ratio</dt><dd>${fmt(ratio(run, "fo"), 2)}<small>${fmt(run.late.fo * 100, 0)}% from the last 2 time units</small></dd></div>`;
    say.textContent = S.conjSay(run.eps, ratio(run, "pm"), rp, run.late.pm, ratio(run, "fo"), rf, run.late.fo, run.loss.pm, run.loss.fo);
  };
  const drawFacts = (c0) => {
    const b = K.B(c0), h = 1e-3;
    const w2 = (M.waitingValue(b - 2 * h, c0) - 2 * M.waitingValue(b - h, c0) + M.waitingValue(b, c0)) / (h * h);
    const r2 = (M.flatReward(b + h, c0) - 2 * M.flatReward(b, c0) + M.flatReward(b - h, c0)) / (h * h);
    facts.innerHTML = `<div><dt>(V − g)_yy at the bound ÷ 2c</dt><dd>${fmt(w2 / (2 * c0), 3)}<small>exact fact: 1; c = ${fmt(c0, 3)}, by a difference quotient from below</small></dd></div>
      <div><dt>Flat bound's R″(B) ÷ (−2c)</dt><dd>${fmt(r2 / (-2 * c0), 3)}<small>exact fact: 1; the same c</small></dd></div>`;
  };
  const run = () => {
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    pick.value = choice.id;
    const kind = scheduleKind(choice);
    const c0 = costOf(choice)(0);
    note.textContent = S.lossNote(kind, labelOf(choice), c0);
    drawFacts(Number.isFinite(c0) && c0 > 0 ? c0 : 0.1);
    if (kind === "deadline" || kind === "constant") { state.textContent = ""; return; }
    const mine = JSON.stringify(choice);
    lossFor(choice, (p) => { if (JSON.stringify(choice) === mine && !data) state.textContent = `Solving and scoring ${LOSS_EPS.length} sizes of the change… ${Math.round(p * LOSS_EPS.length)} of ${LOSS_EPS.length}`; }).then((m) => {
      if (JSON.stringify(choice) !== mine) return;
      data = m;
      state.textContent = S.lossState(M.LOSS_HORIZON, m.runs.some((r) => r.centerWaits > 0), "conj");
      draw(); readOut();
    }).catch((e) => { if (JSON.stringify(choice) === mine) state.textContent = "The solver stopped: " + e.message; });
  };
  epsIn.addEventListener("input", () => { k = +epsIn.value; epsOut.textContent = epsLabel(LOSS_EPS[k]); draw(); readOut(); });
  onSchedule((c) => { choice = c; run(); });
  keepDrawn(bot, draw);
  run();
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
const lazy = [["wave", wavePlate], ["arrows", arrowsPlate], ["lookahead", lookaheadPlate], ["mean", meanPlate], ["shift", shiftPlate],
  ["halfint", halfPlate], ["reward", rewardPlate], ["band", bandPlate], ["loss", lossPlate], ["conj", conjPlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = failText(e); console.error(e); } }); }
