// Chapter 12's plates. Every number drawn comes from kernel.js (the series and the closed forms), ch12-model.js (the
// Palmer observer, the ramp's exact look-ahead, the kernel's quantiles, the averaged bounds, the gate), or the solver's
// worker; the words under each plate come from say-ch12.js, which takes numbers and returns sentences.
import * as K from "./kernel.js?v=9bcb592a71";
import * as M from "./ch12-model.js?v=9bcb592a71";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, VIEW, SPARE, defaultDrawing } from "./schedules-book.js?v=9bcb592a71";
import { getChoice, setChoice, solve, onVisible, watchVisible, liftReady, calm, seedParam, wireStrips } from "./book.js?v=9bcb592a71";
import { frame, line, area, axes, svg, fmt, keepDrawn } from "./chart.js?v=9bcb592a71";
import * as S from "./say-ch12.js?v=9bcb592a71";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const logRange = (a, b, n) => range(Math.log10(a), Math.log10(b), n).map((v) => 10 ** v);
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const P1 = (v) => v.toFixed(1);
const txt = (x, y, s, cls = "tk", anchor = "start") => `<text class="${cls}" x="${P1(x)}" y="${P1(y)}" text-anchor="${anchor}">${s}</text>`;
const vline = (f, x, cls = "dim", dash = "2 3") => `<path class="${cls}" stroke-dasharray="${dash}" d="M${P1(f.sx(x))} ${f.t}V${f.H - f.b}"/>`;
const hline = (f, y, cls = "dim", dash = "1 3") => `<path class="${cls}" stroke-dasharray="${dash}" d="M${f.l} ${P1(f.sy(y))}H${f.W - f.r}"/>`;
/** A line from (x0, y0) to (x1, y1) in pixels with an open head at the end. */
function arrowPx(x0, y0, x1, y1, cls, head = 6) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 0.5) return "";
  const ux = dx / L, uy = dy / L, h = Math.min(head, L * 0.6);
  const ax = x1 - h * ux + h * 0.55 * uy, ay = y1 - h * uy - h * 0.55 * ux, bx = x1 - h * ux - h * 0.55 * uy, by = y1 - h * uy + h * 0.55 * ux;
  return `<path class="${cls}" d="M${P1(x0)} ${P1(y0)}L${P1(x1)} ${P1(y1)}M${P1(ax)} ${P1(ay)}L${P1(x1)} ${P1(y1)}L${P1(bx)} ${P1(by)}"/>`;
}
const failHTML = (e) => `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`;
const COSTS = [0.03, 0.1, 0.3, 1];

// ---------------------------------------------------------------- the hero: the urgency signal ahead of the cost, in milliseconds
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const P = M.palmer(), u = P.unitMs;
  // a steady rise over 1.5 seconds (the kernel's average of a straight line is the line m(c0) later, exactly), then the
  // paper's three waves; time in milliseconds, the model in time units
  const RISE = 1500;
  const STEPS = [{ kind: "ramp" }, ...P.waves.map((w) => ({ kind: w.hz, w }))];
  let cur = 0;
  const draw = (i) => {
    cur = i;
    const st = STEPS[i];
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(310, Math.max(230, W * 0.6)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const end = st.kind === "ramp" ? RISE : 2000 / st.kind;
    const ts = range(0, end, 241);
    const l = 12, r = 12, t = 34, b = 30;
    const yr = st.kind === "ramp" ? [-0.05, 1.12] : [-1.25, 1.25];
    const f = { W, H, l, r, t, b, x: [0, end], y: yr };
    f.sx = (v) => l + (v / end) * (W - l - r);
    f.sy = (v) => t + (1 - (v - yr[0]) / (yr[1] - yr[0])) * (H - t - b);
    let s = `<text class="lab" x="${l}" y="12">the cost of time (orange) and the urgency signal a/b (green)</text>`;
    s += `<text class="tk" x="${l}" y="26">Palmer observer, 6.4% coherence; ${st.kind === "ramp" ? "a slow, steady rise" : `${st.kind} Hz`}</text>`;
    s += `<path class="ax" d="M${l} ${P1(H - b)}H${W - r}"/>`;
    let cost, urg, lead, yArrow, xFrom;
    if (st.kind === "ramp") {
      cost = ts.map((x) => 0.1 + (0.8 * x) / RISE);
      urg = ts.map((x) => 0.1 + (0.8 * (x + P.leadMs)) / RISE);
      lead = P.leadMs; xFrom = RISE * 0.75; yArrow = 0.1 + (0.8 * xFrom) / RISE;
      s += hline(f, yArrow);
    } else {
      const w = st.w, om = 2 * Math.PI * st.kind / 1000, ph = (w.deg * Math.PI) / 180;
      cost = ts.map((x) => Math.sin(om * x));
      urg = ts.map((x) => w.gain * Math.sin(om * x + ph));
      lead = w.ms; xFrom = 1250 / st.kind; yArrow = 1.1;
      s += `<path class="ax" d="M${l} ${P1(f.sy(0))}H${W - r}"/>`;
    }
    s += line(f, ts, cost, "cost") + line(f, ts, urg, "wb");
    const x0 = f.sx(xFrom), x1 = f.sx(xFrom - lead), y = f.sy(yArrow);
    s += arrowPx(x0, y, x1, y, "wb", 5);
    s += txt(x1 - 4, y + 4, `${Math.round(lead)} ms ahead`, "tag-wb", "end");
    for (const v of st.kind === "ramp" ? [0, 500, 1000, 1500] : [0, end / 2, end]) s += txt(f.sx(v), H - 12, `${Math.round(v)}`, "tk", v === 0 ? "start" : v === end ? "end" : "middle");
    s += txt(W - r, H - 1, "ms", "tk", "end");
    el.innerHTML = s;
  };
  draw(0);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: STEPS.length, draw,
    label: (i) => (STEPS[i].kind === "ramp" ? S.heroLabel("ramp", P.leadMs) : S.heroLabel(STEPS[i].kind, STEPS[i].w.ms, STEPS[i].w.deg, STEPS[i].w.gain)) });
}

// ---------------------------------------------------------------- plate: ahead of the cost
function leadPlate() {
  const fig = plate("lead"), el = rootOf("lead");
  if (!el) return;
  let shape = "ramp", c0 = 0.1, lL = Math.log10(8), lom = Math.log10(2), guess = NaN, shown = false;
  el.innerHTML = `<div class="predict"><p>A cost ramps up slowly, over 8 time units, at c₀ = 0.1. How far ahead of the per-moment urgency does U cross the halfway line? Slide the orange copy, then press Show me.</p>
      <label class="dial"><span class="ctl-key">Your guess, in time units</span><output id="ld-gout">–</output>
      <input type="range" id="ld-guess" min="0" max="1.2" step="0.01" value="0" aria-label="Your guess of the lead, in time units"></label>
      <div class="actions" style="margin-top:6px"><button class="btn btn-go" type="button" id="ld-show">Show me</button></div>
      <p class="verdict" id="ld-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("ld-shape", [["ramp", "Slow ramp"], ["wave", "Sine wave"]], shape, "Shape of the change")}
      ${segHTML("ld-c", COSTS.map((c) => [c, String(c)]), c0, "Cost of time, c₀")}
      <label class="dial" id="ld-Lbox"><span class="ctl-key">Ramp lasts, time units</span><output id="ld-Lout"></output>
      <input type="range" id="ld-L" min="-1" max="1.3" step="0.01" value="${lL}" aria-label="How long the ramp lasts, on a log scale"></label>
      <label class="dial" id="ld-wbox" hidden><span class="ctl-key">Frequency, ω</span><output id="ld-wout"></output>
      <input type="range" id="ld-om" min="-1" max="2" step="0.005" value="${lom}" aria-label="Frequency omega, on a log scale"></label></div>
    <div class="chart-wrap" id="ld-chart"></div>
    <ul class="legend"><li><span class="key key-cost">Cost, and the per-moment urgency (same shape)</span></li><li><span class="key key-wb">Urgency a/b, first order</span></li><li id="ld-gkey"><span class="key key-acc-dash">Your guess</span></li></ul>
    <dl class="reads" id="ld-reads"></dl><p class="say" id="ld-say" aria-live="polite"></p>`;
  const chart = $("#ld-chart", el), reads = $("#ld-reads", el), say = $("#ld-say", el), verdict = $("#ld-verdict", el);
  const gIn = $("#ld-guess", el), gOut = $("#ld-gout", el), Lin = $("#ld-L", el), Lout = $("#ld-Lout", el), wIn = $("#ld-om", el), wOut = $("#ld-wout", el);
  const T1 = 1.5;
  const draw = () => {
    const showU = shape === "wave" || shown;
    $("#ld-Lbox", el).hidden = shape !== "ramp"; $("#ld-wbox", el).hidden = shape !== "wave"; $("#ld-gkey", el).hidden = shape !== "ramp";
    let f, g;
    if (shape === "ramp") {
      // the whole ramp when it is short; the 6 time units around its halfway line when it is long
      const L = 10 ** lL, mid0 = T1 + L / 2, half = L <= 3.6 ? L / 2 + 1.2 : 3, x0 = mid0 - half, end = mid0 + half, ts = range(x0, end, 301);
      Lout.textContent = L >= 1 ? L.toFixed(1) : L.toFixed(2);
      f = frame(chart, { x: [x0, end], y: [-0.08, 1.12], aspect: 0.5, minH: 190, maxH: 290 });
      g = axes(f, { yl: "share of the per-moment change", xl: "time", grid: true, yt: [0, 0.5, 1] });
      g += hline(f, 0.5);
      const gam = ts.map((t) => Math.min(1, Math.max(0, (t - T1) / L)));
      g += line(f, ts, gam, "cost");
      if (Number.isFinite(guess)) g += line(f, ts, ts.map((t) => Math.min(1, Math.max(0, (t + guess - T1) / L))), "acc", 'stroke-dasharray="5 4"');
      const mid = T1 + L / 2;
      g += vline(f, mid);
      if (showU) {
        const lead = M.rampLead(L, c0), m = K.meanLookAhead(c0);
        g += line(f, ts, ts.map((t) => M.rampLookAhead(t, T1, L, c0)), "wb");
        const y = f.sy(0.5), x0 = f.sx(mid), x1 = f.sx(mid - lead);
        g += vline(f, mid - lead, "wb", "2 3");
        g += arrowPx(x0, y - 12, x1, y - 12, "wb", 5) + txt(x1 - 4, y - 16, `${fmt(lead, 2)} ahead`, "tag-wb", "end");
        const med = M.kernelQuantile(0.5, c0);
        reads.innerHTML = `<div class="k-wb"><dt>Lead at the halfway line</dt><dd>${fmt(lead, 3)}<small>time units, for this ramp</small></dd></div>
          <div class="k-wb"><dt>Mean look-ahead, m(c₀)</dt><dd>${fmt(m, 3)}<small>the lead for a slow ramp</small></dd></div>
          <div><dt>Kernel's median</dt><dd>${fmt(med, 3)}<small>the lead as the ramp shortens</small></dd></div>
          <div class="k-acc"><dt>Your guess</dt><dd>${Number.isFinite(guess) ? fmt(guess, 2) : "–"}</dd></div>`;
        say.textContent = S.rampSay(c0, L, lead, m, med);
        if (shown) verdict.textContent = S.rampVerdict(guess, lead, m, L);
      } else { reads.innerHTML = ""; say.textContent = "U appears when you press Show me."; }
      chart.innerHTML = svg(f, g, showU ? `A ramp in the cost and the first-order urgency signal, which crosses the halfway line earlier` : `A ramp in the cost, with your guess of the urgency signal`);
    } else {
      const om = 10 ** lom, wl = M.waveLead(c0, om), ph = (wl.deg * Math.PI) / 180, T = (4 * Math.PI) / om, ts = range(0, T, 301);
      wOut.textContent = om >= 10 ? om.toFixed(0) : om >= 1 ? om.toFixed(1) : om.toFixed(2);
      f = frame(chart, { x: [0, T], y: [-1.3, 1.3], aspect: 0.5, minH: 190, maxH: 290 });
      g = axes(f, { yl: "share of the per-moment swing", xl: "time", grid: true, zero: true, yt: [-1, 0, 1] });
      g += line(f, ts, ts.map((t) => Math.sin(om * t)), "cost") + line(f, ts, ts.map((t) => wl.gain * Math.sin(om * t + ph)), "wb");
      const tPk = (2.5 * Math.PI) / om, tU = tPk - ph / om, y = f.sy(1.16);
      g += vline(f, tPk) + vline(f, tU, "wb");
      g += arrowPx(f.sx(tPk), y, f.sx(tU), y, "wb", 5) + txt(f.sx(tU) - 4, y + 4, `${fmt(wl.deg, 1)}°`, "tag-wb", "end");
      const m = K.meanLookAhead(c0);
      reads.innerHTML = `<div class="k-wb"><dt>Lead</dt><dd>${fmt(wl.deg, 1)}°<small>ahead of the cost</small></dd></div>
        <div class="k-wb"><dt>Lead in time</dt><dd>${fmt(wl.time, 3)}<small>time units</small></dd></div>
        <div class="k-wb"><dt>Swing</dt><dd>${fmt(wl.gain, 3)}<small>of the per-moment swing</small></dd></div>
        <div><dt>Mean look-ahead</dt><dd>${fmt(m, 3)}<small>for comparison</small></dd></div>`;
      say.textContent = S.waveSay(c0, om, wl.deg, wl.time, wl.gain, m);
      chart.innerHTML = svg(f, g, `A sine wave in the cost and the first-order urgency signal, ${wl.deg.toFixed(1)} degrees ahead`);
    }
    liftReady(fig);
  };
  gIn.addEventListener("input", () => { guess = +gIn.value; gOut.textContent = fmt(guess, 2); if (shape !== "ramp") { shape = "ramp"; el.querySelector('input[name="ld-shape"][value="ramp"]').checked = true; } draw(); });
  $("#ld-show", el).addEventListener("click", () => { shown = true; if (shape !== "ramp") verdict.textContent = S.rampVerdict(guess, M.rampLead(10 ** lL, c0), K.meanLookAhead(c0), 10 ** lL); draw(); });
  onSeg(el, "ld-shape", (v) => { shape = v; draw(); });
  onSeg(el, "ld-c", (v) => { c0 = +v; draw(); });
  Lin.addEventListener("input", () => { lL = +Lin.value; draw(); });
  wIn.addEventListener("input", () => { lom = +wIn.value; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- the strip's plate: the argument, step by step
function argumentPlate() {
  const fig = plate("argument"), el = rootOf("argument");
  if (!el) return;
  let step = +(fig.dataset.step || 0), c0 = 0.1;
  el.innerHTML = `<div class="controls">${segHTML("ar-c", [[0.03, "0.03"], [0.1, "0.1"], [1, "1"]], c0, "Cost of time, c₀ (steps 2 to 5)")}</div>
    <p class="fine" id="ar-head"></p><div class="chart-wrap" id="ar-top"></div><div class="chart-wrap" id="ar-bot"></div>
    <dl class="reads" id="ar-reads"></dl><p class="say" id="ar-say" aria-live="polite"></p>`;
  const top = $("#ar-top", el), bot = $("#ar-bot", el), reads = $("#ar-reads", el), say = $("#ar-say", el), head = $("#ar-head", el);
  // step 1's path: the evidence against the per-moment bound for the paper's rising cost (Figure 1(c)), seeded
  const rising = (t) => 0.1 + 0.8 * Math.max(t - 0.5, 0);
  const bnd = (t) => K.B(rising(t));
  const gate = M.gatePath(bnd, K.rng(seedParam(2026) + 12));
  const peaks = new Map();
  const peakFor = (c) => {
    if (!peaks.has(c)) { let best = { lead: -1, omega: 0 }; for (let lo = -2; lo <= 5; lo += 0.005) { const w = 10 ** lo, d = K.transfer(c, w).lead; if (d > best.lead) best = { lead: d, omega: w }; } peaks.set(c, best); }
    return peaks.get(c);
  };
  const draw = () => {
    bot.hidden = step !== 0 && step !== 4;
    reads.innerHTML = "";
    if (step === 0) {
      head.textContent = S.GATE_HEAD;
      const { ts, xs, gated } = M.gateDisplay(gate, bnd);
      const { end, ts: tb, b: bs } = M.gateBoundLine(gate, bnd), top0 = Math.max(...bs) * 1.1;
      const f = frame(top, { x: [0, end], y: [-top0, top0], aspect: 0.4, minH: 150, maxH: 220 });
      let g = axes(f, { yl: "evidence X and the bound ±b(t)", xl: "", grid: true, zero: true });
      g += line(f, tb, bs, "bound-line") + line(f, tb, bs.map((v) => -v), "bound-line") + line(f, ts, xs, "dim");
      if (Number.isFinite(gate.hit)) g += vline(f, gate.hit, "acc", "3 3") + `<circle class="acc-dot" cx="${P1(f.sx(gate.hit))}" cy="${P1(f.sy(xs[xs.length - 1]))}" r="4"/>`;
      top.innerHTML = svg(f, g, "One path of the evidence and a moving bound, with the moment it reaches the bound");
      const fb = frame(bot, { x: [0, end], y: [-1.2, 1.2], aspect: 0.4, minH: 150, maxH: 220 });
      let h = axes(fb, { yl: "gated evidence U·X and the level ±a", xl: "time", grid: true, zero: true, yt: [-1, 0, 1] });
      h += hline(fb, 1, "bound-line", "0") + hline(fb, -1, "bound-line", "0");
      h += line(fb, ts, gated, "wb");
      if (Number.isFinite(gate.hit)) h += vline(fb, gate.hit, "acc", "3 3") + `<circle class="acc-dot" cx="${P1(fb.sx(gate.hit))}" cy="${P1(fb.sy(gated[gated.length - 1]))}" r="4"/>` + txt(fb.sx(gate.hit) - 6, gate.sign > 0 ? fb.t + 10 : fb.H - fb.b - 6, "same moment", "tag-acc", "end");
      bot.innerHTML = svg(fb, h, "The same path multiplied by the urgency a over b, against a fixed level, reaching it at the same moment");
      reads.innerHTML = `<div class="k-acc"><dt>Reaches the bound at</dt><dd>${fmt(gate.hit, 3)}<small>time units, at the ${gate.sign < 0 ? "lower" : "upper"} level, both ways</small></dd></div>`;
      say.textContent = S.gateSay(gate.hit, gate.sign);
    } else if (step === 1) {
      head.textContent = "Step 2: U = a/b, so near b₀ the urgency moves opposite to the bound, by the same share to first order.";
      const xs = range(0.6, 1.4, 161);
      const f = frame(top, { x: [0.6, 1.4], y: [0.6, 1.7], aspect: 0.5, minH: 180, maxH: 260 });
      let g = axes(f, { yl: "urgency, U ÷ U₀", xl: "bound, b ÷ b₀", grid: true });
      g += line(f, xs, xs.map((x) => 1 / x), "wb") + line(f, xs, xs.map((x) => 2 - x), "guide");
      g += `<circle class="ink-dot" cx="${P1(f.sx(1))}" cy="${P1(f.sy(1))}" r="4"/>` + txt(f.sx(1) + 6, f.sy(1) - 6, "b₀", "tag-ex");
      g += txt(f.sx(0.64), f.sy(2 - 0.64) + 16, "tangent", "tk", "start");
      top.innerHTML = svg(f, g, "The urgency a over b against the bound, with its tangent at the constant-cost bound");
      say.textContent = S.mirrorSay(c0, K.B(c0));
    } else if (step === 2) {
      head.textContent = "Step 3: the bound falls ahead of a rising cost, and the urgency, its mirror image, rises ahead of it.";
      const om = 2, T = 2 * Math.PI, ts = range(0, T, 241), wl = M.waveLead(c0, om), ph = (wl.deg * Math.PI) / 180;
      const f = frame(top, { x: [0, T], y: [-1.3, 1.3], aspect: 0.5, minH: 180, maxH: 260 });
      let g = axes(f, { yl: "share of the per-moment swing", xl: "time", grid: true, zero: true, yt: [-1, 0, 1] });
      g += line(f, ts, ts.map((t) => Math.sin(om * t)), "cost");
      g += line(f, ts, ts.map((t) => -wl.gain * Math.sin(om * t + ph)), "wb-thin");
      g += line(f, ts, ts.map((t) => wl.gain * Math.sin(om * t + ph)), "wb");
      g += txt(f.sx(T) - 2, f.sy(-1.18), "bound, δb ÷ b₀ (faint)", "tag-wb", "end") + txt(f.sx(0.05), f.sy(1.18), "urgency, δU ÷ U₀", "tag-wb", "start");
      top.innerHTML = svg(f, g, "A sine wave in the cost, the first-order bound's move, and the urgency's move, its mirror image");
      say.textContent = S.mirrorWaveSay(c0, wl.deg);
    } else if (step === 3) {
      head.textContent = "Step 4: the kernel's average of a straight line is the line a mean look-ahead later.";
      const m = K.meanLookAhead(c0), t0 = 0.8, end = 3, ts = range(0, end, 121);
      const f = frame(top, { x: [0, end], y: [0, end + 0.9], aspect: 0.5, minH: 180, maxH: 260 });
      let g = axes(f, { yl: "a cost rising at a steady rate", xl: "time", grid: true });
      const ss = range(0.004, end - t0, 160), ws = ss.map((s) => K.kernelAt(s, c0)), sc = 0.9 / Math.max(...ws.map((v) => Math.min(v, 4)));
      g += area(f, ss.map((s) => t0 + s), ws.map((v) => Math.min(v, 4) * sc), 0, "wb-fill");
      g += line(f, ts, ts, "cost") + line(f, ts, ts.map((t) => t + m), "wb");
      g += vline(f, t0) + vline(f, t0 + m, "wb");
      g += `<path class="dim" stroke-dasharray="1 3" d="M${P1(f.sx(t0))} ${P1(f.sy(t0 + m))}H${P1(f.sx(t0 + m))}"/>`;
      g += `<circle class="wb-dot" cx="${P1(f.sx(t0))}" cy="${P1(f.sy(t0 + m))}" r="4"/><circle class="acc-dot" cx="${P1(f.sx(t0 + m))}" cy="${P1(f.sy(t0 + m))}" r="4"/>`;
      g += txt(f.sx(t0 + m) + 6, f.sy(t0 + m) + 14, `m = ${fmt(m, 3)} later`, "tag-wb");
      top.innerHTML = svg(f, g, "A straight line, the kernel drawn forward from one moment, and the kernel's average, which is the line a mean look-ahead later");
      reads.innerHTML = `<div class="k-wb"><dt>Mean look-ahead</dt><dd>${fmt(m, 3)}<small>time units at c₀ = ${c0}</small></dd></div>`;
      say.textContent = S.linearSay(c0, m);
    } else {
      head.textContent = "Step 5: for a sine wave, the lead is the transfer function's phase; it tends to 45°, and the lead in time falls toward 0.";
      const oms = logRange(0.05, 3000, 260), tr = oms.map((w) => M.waveLead(c0, w)), m = K.meanLookAhead(c0), pk = peakFor(c0);
      const f = frame(top, { x: [0.05, 3000], y: [0, 50], xlog: true, aspect: 0.42, minH: 150, maxH: 220 });
      let g = axes(f, { yl: "lead (degrees)", xl: "", grid: true, yt: [0, 15, 30, 45] });
      g += hline(f, 45, "guide", "6 4") + line(f, oms, tr.map((x) => x.deg), "wb");
      if (pk.lead > 45) g += `<circle class="wb-dot" cx="${P1(f.sx(pk.omega))}" cy="${P1(f.sy(pk.lead))}" r="3.5"/>` + txt(f.sx(pk.omega) - 6, f.sy(pk.lead) - 7, `${fmt(pk.lead, 2)}°`, "tag-wb", "end");
      top.innerHTML = svg(f, g, `The lead in degrees against frequency at a cost of ${c0}, tending to 45 degrees`);
      const fb = frame(bot, { x: [0.05, 3000], y: [m * 1e-3, m * 1.6], xlog: true, ylog: true, aspect: 0.42, minH: 150, maxH: 220 });
      let h = axes(fb, { yl: "lead in time (time units)", xl: "ω", grid: true });
      h += hline(fb, m, "guide", "6 4") + txt(fb.W - fb.r - 2, fb.sy(m) - 5, `m(c₀) = ${fmt(m, 3)}`, "tk", "end");
      h += line(fb, oms, tr.map((x) => x.time), "wb");
      bot.innerHTML = svg(fb, h, `The lead in time against frequency at a cost of ${c0}, starting at the mean look-ahead and falling`);
      say.textContent = S.phaseSay(c0, pk, m);
    }
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "ar-c", (v) => { c0 = +v; draw(); });
  keepDrawn(top, draw);
}

// ---------------------------------------------------------------- plate: your schedule's urgency
function yoursPlate() {
  const fig = plate("yours"), el = rootOf("yours");
  if (!el) return;
  const EPS = [1, 0.25, 0.0625];
  let choice = getChoice(), data = null, sel = 2, gen = 0;
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  el.innerHTML = `<div class="controls"><label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
      <select class="pick" id="yu-pick">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>
      ${segHTML("yu-eps", EPS.map((e, k) => [k, e >= 1 ? "Full" : e >= 0.1 ? Math.round(e * 100) + "%" : (e * 100).toFixed(2) + "%"]), sel, "Size of the change, ε")}</div>
    <p class="fine" id="yu-note"></p>
    <div class="chart-wrap" id="yu-cost"></div><div class="chart-wrap" id="yu-chart"></div>
    <ul class="legend"><li><span class="key key-ex">From the best bound</span></li><li id="yu-fokey"><span class="key key-wb">From the first-order bound</span></li><li><span class="key key-pm">From the per-moment bound</span></li></ul>
    <dl class="reads" id="yu-reads"></dl><p class="say" id="yu-say" aria-live="polite"></p><p class="fine" id="yu-state" aria-live="polite"></p>`;
  const pick = $("#yu-pick", el), note = $("#yu-note", el), costEl = $("#yu-cost", el), chart = $("#yu-chart", el), reads = $("#yu-reads", el), say = $("#yu-say", el), state = $("#yu-state", el);
  const segs = [...el.querySelectorAll('input[name="yu-eps"]')];
  const drawCost = () => {
    if (!data) { costEl.innerHTML = ""; return; }
    const { t, cost } = data, view = data.kind === "deadline" ? data.deadline : t[t.length - 1];
    const cs = t.map((x, i) => cost[i] ?? NaN).filter(Number.isFinite);
    const lo = Math.min(...cs), hi = Math.max(...cs);
    const logScale = hi / lo > 3, pad = (hi - lo) * 0.15 + lo * 1e-3;
    const f = frame(costEl, { x: [0, view], y: logScale ? [lo / 1.25, hi * 1.25] : [lo - pad, hi + pad], ylog: logScale, aspect: 0.2, minH: 80, maxH: 120, b: 22 });
    let g = axes(f, { yl: "cost of time", yt: [] }) + line(f, t, cost, "cost");
    costEl.innerHTML = svg(f, g, `The cost of time for ${labelOf(choice)}${data.kind === "scale" ? ` at ${EPS[sel] * 100}% of its change` : ""}`);
  };
  const drawChart = () => {
    if (!data) { chart.innerHTML = ""; return; }
    const { t } = data, view = data.kind === "deadline" ? data.deadline : t[t.length - 1];
    $("#yu-fokey", el).hidden = data.kind !== "scale";
    let best, fo, pm;
    if (data.kind === "scale") ({ best, fo, pm } = data.u[sel]); else ({ best, pm } = data);
    const vals = [...best, ...pm, ...(fo || [])].filter((v) => Number.isFinite(v) && v > 0);
    const lo = Math.min(...vals), hi = Math.max(...vals), useLog = hi / lo > 3;
    // a flat or nearly flat set of curves gets a wide range, so the ticks don't all print as 1
    const pad = useLog ? 1.25 : hi - lo < 1e-4 ? 0.25 : (hi - lo) * 0.12 + 1e-3;
    const f = frame(chart, { x: [0, view], y: useLog ? [lo / pad, hi * pad] : [lo - pad, hi + pad], ylog: useLog, aspect: 0.5, minH: 190, maxH: 300 });
    let g = axes(f, { yl: data.kind === "scale" ? "urgency ÷ the constant cost's" : "urgency ÷ the per-moment urgency at time 0", xl: "time", grid: true });
    if (!useLog && f.y[0] < 1 && f.y[1] > 1) g += hline(f, 1);
    g += line(f, t, pm, "pm");
    if (fo) g += line(f, t, fo, "wb");
    g += line(f, t, best, "ex");
    if (data.kind === "deadline") g += vline(f, data.deadline, "acc", "3 3") + txt(f.sx(data.deadline) - 4, f.t + 10, "deadline", "tag-acc", "end");
    chart.innerHTML = svg(f, g, data.kind === "scale" ? `The urgency signal a over b on ${labelOf(choice)}, from the best bound, the first-order bound, and the per-moment bound`
      : `The urgency signal a over b on ${labelOf(choice)}, from the best bound and from the per-moment bound, each divided by the per-moment urgency at time 0, up to the deadline at ${data.deadline}`);
    liftReady(fig);
  };
  const drawAll = () => {
    drawCost(); drawChart();
    if (!data) return;
    const T = S.yoursText(data, EPS, sel);
    if (data.kind === "scale") {
      reads.innerHTML = `<div class="k-wb"><dt>First order vs best, largest gap</dt><dd>${T.fo}<small>of the constant cost's urgency, ${T.over}</small></dd></div>
        <div class="k-pm"><dt>Per-moment vs best, largest gap</dt><dd>${T.pm}<small>the same times</small></dd></div>
        <div><dt>Middle cost, c₀</dt><dd>${fmt(data.c0, 3)}<small>the window's average</small></dd></div>`;
    } else reads.innerHTML = `<div class="k-ex"><dt>Best bound's urgency, last time drawn</dt><dd>${fmt(data.ratio, 1)}×<small>the per-moment urgency then</small></dd></div>`;
    say.textContent = T.say;
  };
  const run = () => {
    const my = ++gen;
    data = null; reads.innerHTML = ""; say.textContent = ""; drawAll(); chart.innerHTML = ""; costEl.innerHTML = "";
    pick.value = choice.id;
    const dl = deadlineOf(choice), cost = costOf(choice);
    segs.forEach((r) => { r.disabled = dl !== null; });
    if (dl !== null) {
      note.textContent = S.outsideNote("deadline");
      state.textContent = "Solving the best bound…";
      solve({ job: "bounds", choice }, { key: "yours12" }).then((m) => {
        if (my !== gen) return;
        const D = M.deadlineUrgency(m, dl);
        data = { kind: "deadline", t: D.t, best: D.best, pm: D.pm, cost: D.cost, deadline: dl, tLast: D.tLast, ratio: D.ratio };
        state.textContent = S.DEADLINE_STATE;
        drawAll();
      }).catch((e) => { if (e.message !== "superseded" && my === gen) state.textContent = "The solver stopped: " + e.message; });
      return;
    }
    const tsAvg = range(0, VIEW, 501);
    const c0 = tsAvg.reduce((a, t) => a + cost(t), 0) / tsAvg.length;
    if (!M.moves(cost, c0, VIEW, SPARE)) {
      note.textContent = S.outsideNote("constant"); state.textContent = "";
      data = M.flatUrgency(range(0, VIEW, 126), c0, EPS);
      drawAll();
      return;
    }
    const outside = choice.id === "rising";
    note.textContent = outside ? S.outsideNote("rising") : S.insideNote(labelOf(choice));
    state.textContent = "Solving four dynamic programs…";
    solve({ job: "scale", choice, c0, eps: EPS, view: VIEW }, { key: "yours12", progress: (p) => { if (my === gen) state.textContent = `Solving four dynamic programs… ${1 + Math.round(p * 3)} of 4`; } }).then((m) => {
      if (my !== gen) return;
      const t = m.t, gamma = (x) => cost(x) - c0;
      const { u, gFo, gPm } = M.urgencies(t, m.b0, m.runs, cost, c0, EPS);
      data = { kind: "scale", t, c0, outside, u, gFo, gPm, costAt: (e) => t.map((x) => c0 + e * gamma(x)) };
      data.cost = data.costAt(EPS[sel]);
      state.textContent = "Time step 0.01, evidence step 0.02, 6 time units past the window; each bound measured from the program's own constant-cost bound.";
      drawAll();
    }).catch((e) => { if (e.message !== "superseded" && my === gen) state.textContent = "The solver stopped: " + e.message; });
  };
  pick.addEventListener("change", () => {
    if (pick.value === "draw") { const c = getChoice(); choice = c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
    else choice = { id: pick.value, params: paramsOf({ id: pick.value }) };
    setChoice(choice);
  });
  window.addEventListener("cc-schedule", (e) => { choice = e.detail || getChoice(); run(); });
  onSeg(el, "yu-eps", (v) => { sel = +v; if (data && data.costAt) data.cost = data.costAt(EPS[sel]); drawAll(); });
  keepDrawn(chart, drawAll);
  run();
}

// ---------------------------------------------------------------- plate: in milliseconds
function msPlate() {
  const fig = plate("ms"), el = rootOf("ms");
  if (!el) return;
  const P = M.palmer(), T = M.traps(P), w1 = P.waves[1];
  const HZS = logRange(0.05, 20, 240), curve = HZS.map((hz) => M.palmerAt(hz, P));
  let gMs = NaN, gDeg = NaN, shown = false;
  el.innerHTML = `<div class="predict"><p>For this observer, a cost of time that rises slowly and steadily: how many milliseconds ahead should the urgency signal run? And for a cost that rises and falls once a second, how many degrees?</p>
      <label class="dial"><span class="ctl-key">Slow ramp, milliseconds</span><output id="ms-gout">–</output>
      <input type="range" id="ms-g" min="0" max="600" step="5" value="0" aria-label="Your guess of the lead for a slow ramp, in milliseconds"></label>
      <label class="dial"><span class="ctl-key">1 Hz, degrees</span><output id="ms-dout">–</output>
      <input type="range" id="ms-d" min="0" max="90" step="1" value="0" aria-label="Your guess of the lead at 1 Hz, in degrees"></label>
      <div class="actions" style="margin-top:6px"><button class="btn btn-go" type="button" id="ms-show">Show me</button></div>
      <p class="verdict" id="ms-verdict" aria-live="polite"></p></div>
    <div id="ms-fig" hidden><div class="chart-wrap" id="ms-ms"></div><div class="chart-wrap" id="ms-deg"></div>
    <ul class="legend"><li><span class="key key-wb">Predicted lead, closed form</span></li><li><span class="key key-guide">Slow-ramp lead; 45°</span></li><li><span class="key key-acc">Your guesses</span></li></ul>
    <dl class="reads" id="ms-reads"></dl><p class="say" id="ms-say"></p>
    <p class="fine" style="margin-top:14px"><b>The rounding trap.</b> The same calculations from the numbers as printed:</p>
    <dl class="reads" id="ms-trap"></dl><p class="say" id="ms-tsay"></p></div>`;
  const box = $("#ms-fig", el), cMs = $("#ms-ms", el), cDeg = $("#ms-deg", el), reads = $("#ms-reads", el), verdict = $("#ms-verdict", el);
  const gIn = $("#ms-g", el), dIn = $("#ms-d", el);
  const draw = () => {
    box.hidden = !shown;
    if (!shown) return;
    const f = frame(cMs, { x: [0.05, 20], y: [0, Math.max(260, P.leadMs * 1.2, Number.isFinite(gMs) ? gMs * 1.1 : 0)], xlog: true, aspect: 0.46, minH: 170, maxH: 240 });
    let g = axes(f, { yl: "lead (ms)", xl: "", grid: true });
    g += hline(f, P.leadMs, "guide", "6 4") + txt(f.W - f.r - 2, f.sy(P.leadMs) - 5, `slow ramp, ${Math.round(P.leadMs)} ms`, "tk", "end");
    g += line(f, HZS, curve.map((c) => c.ms), "wb");
    g += P.waves.map((w) => `<circle class="wb-dot" cx="${P1(f.sx(w.hz))}" cy="${P1(f.sy(w.ms))}" r="4"/>` + txt(f.sx(w.hz) + 6, f.sy(w.ms) - 6, `${Math.round(w.ms)}`, "tag-wb")).join("");
    if (Number.isFinite(gMs)) g += hline(f, gMs, "acc", "5 4") + txt(f.l + 4, f.sy(gMs) - 5, `your ramp guess, ${Math.round(gMs)}`, "tag-acc");
    cMs.innerHTML = svg(f, g, "The predicted lead in milliseconds against frequency for the Palmer observer, falling from the slow-ramp lead");
    const dTop = M.degreeAxisTop(gDeg);
    const fd = frame(cDeg, { x: [0.05, 20], y: [0, dTop], xlog: true, aspect: 0.4, minH: 150, maxH: 220 });
    let h = axes(fd, { yl: "lead (degrees)", xl: "frequency (Hz)", grid: true, yt: dTop > 50 ? [0, 15, 30, 45, 60, 75, 90] : [0, 15, 30, 45] });
    h += hline(fd, 45, "guide", "6 4") + line(fd, HZS, curve.map((c) => c.deg), "wb");
    h += P.waves.map((w) => `<circle class="wb-dot" cx="${P1(fd.sx(w.hz))}" cy="${P1(fd.sy(w.deg))}" r="4"/>` + txt(fd.sx(w.hz) + 5, fd.sy(w.deg) + 15, `${Math.round(w.deg)}°`, "tag-wb")).join("");
    if (Number.isFinite(gDeg)) h += `<circle class="acc-dot" cx="${P1(fd.sx(1))}" cy="${P1(fd.sy(gDeg))}" r="4.5"/>` + txt(fd.sx(1) - 8, fd.sy(gDeg) + (gDeg > 30 && gDeg < 52 ? 16 : -7), `your guess, ${Math.round(gDeg)}°`, "tag-acc", "end");
    cDeg.innerHTML = svg(fd, h, "The predicted lead in degrees against frequency for the Palmer observer, rising toward 45 degrees");
    reads.innerHTML = `<div class="k-wb"><dt>Slow ramp</dt><dd>${Math.round(P.leadMs)} ms<small>m = ${fmt(P.m, 3)} time units of ${fmt(P.unitMs, 1)} ms</small></dd></div>` +
      P.waves.map((w) => `<div class="k-wb"><dt>${w.hz} Hz</dt><dd>${Math.round(w.ms)} ms<small>${Math.round(w.deg)}°, swing ${fmt(w.gain, 2)}</small></dd></div>`).join("");
    $("#ms-say", el).textContent = S.msSay(P);
    $("#ms-trap", el).innerHTML = `<div class="k-wb"><dt>Ramp, from the fit</dt><dd>${Math.round(P.leadMs)} ms<small>bound ${fmt(P.b, 5)}</small></dd></div>
      <div class="k-acc"><dt>Ramp, from the printed bound</dt><dd>${Math.round(T.fromBound)} ms<small>bound ${fmt(T.bPrinted, 2)}</small></dd></div>
      <div class="k-wb"><dt>0.5 Hz, from the phase</dt><dd>${Math.round(P.waves[0].ms)} ms<small>${fmt(P.waves[0].deg, 2)}°</small></dd></div>
      <div class="k-acc"><dt>0.5 Hz, from the printed phase</dt><dd>${Math.round(T.fromDegrees[0].ms)} ms<small>${T.fromDegrees[0].deg}°</small></dd></div>`;
    $("#ms-tsay", el).textContent = S.trapSay(P, T);
    verdict.textContent = S.msVerdict(gMs, gDeg, P.leadMs, w1.deg, w1.ms);
    liftReady(fig);
  };
  gIn.addEventListener("input", () => { gMs = +gIn.value; $("#ms-gout", el).textContent = `${gMs} ms`; if (shown) draw(); });
  dIn.addEventListener("input", () => { gDeg = +dIn.value; $("#ms-dout", el).textContent = `${gDeg}°`; if (shown) draw(); });
  $("#ms-show", el).addEventListener("click", () => { shown = true; draw(); });
  keepDrawn(cMs, draw);
}

// ---------------------------------------------------------------- plate: what control would have to compute
function controlPlate() {
  const fig = plate("control"), el = rootOf("control");
  if (!el) return;
  const SHAPES = {
    ramp: { label: "Ramp", f: (t) => Math.min(1, Math.max(0, (t - 1) / 1.5)) },
    wave: { label: "Wave", f: (t) => Math.sin(2.5 * t) },
    pulse: { label: "Pulse", f: (t) => 1 / (1 + Math.exp(-(t - 1.6) / 0.08)) - 1 / (1 + Math.exp(-(t - 2.3) / 0.08)) },
  };
  const SIZE = 0.25, END = 4, ts = range(0, END, 201);
  let c0 = 0.1, shape = "ramp", t = 0.6, playing = !calm.matches, visible = false, raf = 0, t0 = 0, cache = new Map();
  el.innerHTML = `<p class="fine" style="margin:0 0 10px">Not a model of control: what the best bound computes, to first order, for a small change around a constant cost.</p>
    <div class="controls">${segHTML("co-c", COSTS.map((c) => [c, String(c)]), c0, "Cost of time, c₀")}
      ${segHTML("co-s", Object.entries(SHAPES).map(([k, v]) => [k, v.label]), shape, "Shape of the change")}</div>
    <div class="controls"><label class="dial"><span class="ctl-key">Now, t</span><output id="co-out"></output>
      <input type="range" id="co-t" min="0" max="${END}" step="0.01" value="${t}" aria-label="The moment shown"></label>
      <div class="actions"><button class="btn" type="button" id="co-play" aria-pressed="${playing}">${playing ? "Pause" : "Play"}</button></div></div>
    <div class="chart-wrap" id="co-top"></div><div class="chart-wrap" id="co-bot"></div>
    <ul class="legend"><li><span class="key key-cost">Cost</span></li><li><span class="key key-wb">The kernel's weights, and the fixed-kernel approximation</span></li><li><span class="key key-pm">Constant-cost bound for each moment's cost</span></li></ul>
    <dl class="reads" id="co-reads"></dl><p class="say" id="co-say" aria-live="polite"></p>`;
  const top = $("#co-top", el), bot = $("#co-bot", el), reads = $("#co-reads", el), say = $("#co-say", el), inp = $("#co-t", el), out = $("#co-out", el), play = $("#co-play", el);
  const series = () => {
    const key = c0 + ":" + shape;
    if (!cache.has(key)) {
      const sh = SHAPES[shape].f, cost = (x) => c0 * (1 + SIZE * sh(x));
      const tAll = range(0, END + 0.6, 231);
      cache.set(key, { cost, tAll, avg: ts.map((x) => M.averagedBound(cost, x, c0)), pm: tAll.map((x) => K.B(cost(x))),
        m: K.meanLookAhead(c0), med: M.kernelQuantile(0.5, c0), q90: M.kernelQuantile(0.9, c0) });
    }
    return cache.get(key);
  };
  const draw = () => {
    const D = series(), { cost, tAll } = D, xEnd = END + 0.6;
    out.textContent = t.toFixed(2);
    const f = frame(top, { x: [0, xEnd], y: [c0 * (1 - SIZE * 1.25), c0 * (1 + SIZE * 1.6)], aspect: 0.36, minH: 140, maxH: 200 });
    let g = axes(f, { yl: "cost, and the weights from now", xl: "", grid: true, yt: [c0 * (1 - SIZE), c0, c0 * (1 + SIZE)], fy: (v) => String(+v.toPrecision(2)) });
    const ss = range(0.004, xEnd - t, 160), ws = ss.map((s) => K.kernelAt(s, c0)), cap = Math.max(...ws.map((v, i) => (ss[i] > 0.05 ? v : 0))) * 1.4 || 1;
    const base = c0 * (1 - SIZE * 1.25), hgt = c0 * SIZE * 2.4;
    g += area(f, ss.map((s) => t + s), ws.map((v) => base + (Math.min(v, cap) / cap) * hgt), base, "wb-fill");
    g += line(f, tAll, tAll.map(cost), "cost") + vline(f, t, "dim", "2 3");
    // the window: the weight past its right edge, and the mean, marked by an arrow when it lies past the edge
    const win = M.controlWindow(t, c0, xEnd);
    if (win.meanInside) g += vline(f, win.meanAt, "wb", "3 3") + txt(Math.min(f.sx(win.meanAt) + 4, f.W - f.r - 28), f.t + 10, "mean", "tag-wb");
    else g += arrowPx(f.W - f.r - 26, f.t + 8, f.W - f.r - 2, f.t + 8, "wb", 5) + txt(f.W - f.r - 30, f.t + 12, "mean", "tag-wb", "end");

    top.innerHTML = svg(f, g, `The cost of time and the kernel's weights drawn forward from time ${t.toFixed(2)}, within the chart's window`);
    const all = [...D.pm, ...D.avg], lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.15 + 1e-3;
    const fb = frame(bot, { x: [0, xEnd], y: [lo - pad, hi + pad], aspect: 0.4, minH: 150, maxH: 220 });
    let h = axes(fb, { yl: "bound", xl: "time", grid: true });
    const k = ts.findIndex((x) => x > t + 1e-9), upto = k < 0 ? ts.length : k;
    h += line(fb, tAll, D.pm, "pm") + line(fb, ts, D.avg, "wb-thin") + line(fb, ts.slice(0, upto), D.avg.slice(0, upto), "wb");
    const avgNow = M.averagedBound(cost, t, c0), pmNow = K.B(cost(t));
    h += vline(fb, t, "dim", "2 3") + `<circle class="wb-dot" cx="${P1(fb.sx(t))}" cy="${P1(fb.sy(avgNow))}" r="4.5"/>`;
    bot.innerHTML = svg(fb, h, `The constant-cost bound for each moment's cost, and the fixed-kernel approximation of the bound, up to time ${t.toFixed(2)}`);
    reads.innerHTML = `<div class="k-wb"><dt>Fixed-kernel approximation now</dt><dd>${fmt(avgNow, 3)}<small>the best bound, to first order</small></dd></div>
      <div class="k-pm"><dt>Bound for the cost now alone</dt><dd>${fmt(pmNow, 3)}</dd></div>
      <div class="k-wb"><dt>Half the weight within</dt><dd>${fmt(D.med, 2)}<small>90% within ${fmt(D.q90, 2)}</small></dd></div>
      <div class="k-wb"><dt>Mean look-ahead</dt><dd>${fmt(D.m, 3)}<small>time units</small></dd></div>` +
      (win.reading ? `<div><dt>Weight past the chart's right edge</dt><dd>${win.reading}<small>${S.PAST_EDGE}</small></dd></div>` : "");
    say.textContent = S.controlSay(t, c0, D.m, D.med, D.q90, avgNow, pmNow);
    liftReady(fig);
  };
  const loop = (now) => {
    raf = 0;
    if (!playing || !visible) return;
    if (!t0) t0 = now - (t / END) * 14000;
    t = (((now - t0) / 14000) % 1) * END;
    inp.value = t; draw();
    raf = requestAnimationFrame(loop);
  };
  const setPlay = (on) => { playing = on; play.setAttribute("aria-pressed", String(on)); play.textContent = on ? "Pause" : "Play"; t0 = 0; if (on && visible && !raf) raf = requestAnimationFrame(loop); };
  play.addEventListener("click", () => setPlay(!playing));
  inp.addEventListener("input", () => { setPlay(false); t = +inp.value; draw(); });
  onSeg(el, "co-c", (v) => { c0 = +v; draw(); });
  onSeg(el, "co-s", (v) => { shape = v; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && playing && !raf) { t0 = 0; raf = requestAnimationFrame(loop); } });
  keepDrawn(top, draw);
}

// ---------------------------------------------------------------- plate: what is new, and what isn't
function noveltyPlate() {
  const fig = plate("novelty"), el = rootOf("novelty");
  if (!el) return;
  const marks = {};
  let shown = false;
  const short = { credited: "Credited", proved: "Proved, not new", new: "New, to its knowledge" };
  el.innerHTML = `<p class="fine" style="margin:0 0 10px">For each statement: credited to others, proved in the paper but not claimed as new, or new to the paper's knowledge (and, where it is a result, proved in the paper too)? Then compare with the paper's own sentences.</p>
    <ol class="nv-list">${S.ITEMS.map((it) => `<li id="nv-${it.id}"><p class="nv-q">${it.text}</p>
      ${segHTML("nv-" + it.id, S.KINDS.map(([k]) => [k, short[k]]), "", "Your answer")}
      <p class="nv-a" hidden></p></li>`).join("")}</ol>
    <div class="actions"><button class="btn btn-go" type="button" id="nv-show">Show the paper's answers</button><button class="btn" type="button" id="nv-clear">Clear</button></div>
    <p class="say" id="nv-say" aria-live="polite"></p>`;
  const say = $("#nv-say", el);
  const draw = () => {
    for (const it of S.ITEMS) {
      const a = $(`#nv-${it.id} .nv-a`, el), mk = marks[it.id];
      a.hidden = !shown;
      if (!shown) continue;
      const verdict = mk ? (S.marksRight(it, mk) ? "Matches the paper. " : "The paper differs. ") : "";
      a.innerHTML = `<b>${verdict}</b>${S.answerText(it).replace(/[<>&]/g, "")} <span class="nv-src">main.tex, lines ${it.lines[0]}–${it.lines[1]}</span>`;
      a.dataset.right = mk ? String(!!S.marksRight(it, mk)) : "";
    }
    say.textContent = shown ? S.noveltyVerdict(marks) : "";
    if (shown) liftReady(fig);
  };
  for (const it of S.ITEMS) onSeg(el, "nv-" + it.id, (v) => { marks[it.id] = v; draw(); });
  $("#nv-show", el).addEventListener("click", () => { shown = true; draw(); });
  $("#nv-clear", el).addEventListener("click", () => { for (const k of Object.keys(marks)) delete marks[k]; el.querySelectorAll(".nv-list input").forEach((r) => { r.checked = false; }); shown = false; draw(); });
  draw();
}

// ---------------------------------------------------------------- start
hero();
wireStrips();
const lazy = [["lead", leadPlate], ["argument", argumentPlate], ["yours", yoursPlate], ["ms", msPlate], ["control", controlPlate], ["novelty", noveltyPlate]];
for (const [id, fn] of lazy) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = failHTML(e); console.error(e); } });
}
