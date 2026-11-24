// Chapter 8's plates. Every number drawn comes from ch08-rule.js (Algorithm 1, the averaged-cost rule, the map whose
// fixed points the rule's equation asks for), model.js (the constant-cost bound, the binned kernels, the dynamic
// program and its scorer), or kernel.js (the kernel's series and transform); the heavy work runs in ch08-worker.js.
// The words under each plate come from say-ch08.js, which takes numbers and returns sentences.
import * as K from "./kernel.js?v=89322951a3";
import { boundForCost, kernelForBound, toDiscrete } from "./model.js?v=89322951a3";
import { PRESETS, DRAW, paramsOf, labelOf, defaultDrawing, deadlineOf, VIEW } from "./schedules-book.js?v=89322951a3";
import { getChoice, setChoice, onVisible, watchVisible, liftReady, calm } from "./book.js?v=89322951a3";
import { frame, line, area, axes, svg, fmt, keepDrawn } from "./chart.js?v=89322951a3";
import { weightedHistory, mapT, scheduleFor, spikeCost, shareBefore, P13, levelDerivative } from "./ch08-rule.js?v=89322951a3";
import * as S from "./say-ch08.js?v=89322951a3";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const finiteMax = (...arrs) => Math.max(...arrs.flat().filter(Number.isFinite));
const DT = 0.01, SHIFT = 0.5826 * Math.sqrt(DT);
const shift = (a) => a.map((v) => toDiscrete(v, DT));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const setSeg = (el, name, v) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = String(r.value) === String(v); });
const groups = [...new Set(PRESETS.map((p) => p.group))];
const pickHTML = (id) => `<label class="dial" style="flex:1 1 13rem"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
const fromPick = (v) => {
  if (v !== "draw") return { id: v, params: paramsOf({ id: v }) };
  const c = getChoice();
  return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() };
};
/** Follow the reader's schedule: the picker sets it for every page, and every plate that uses it redraws. */
function follow(pick, onChange) {
  if (pick) pick.addEventListener("change", () => setChoice(fromPick(pick.value)));
  window.addEventListener("cc-schedule", (e) => onChange(e.detail));
}
// the deadline: a dotted line through the plot, named in the top margin so it covers no curve
const deadlineMark = (f, dl, label = "forced choice") => `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(dl).toFixed(1)} ${f.t - 4}V${f.H - f.b}"/>` +
  `<text class="tag-acc" x="${Math.min(f.sx(dl) + 2, f.W - 2).toFixed(1)}" y="${f.t - 8}" text-anchor="end">${label}</text>`;

// ---------------------------------------------------------------- the worker
let worker = null, nextId = 1;
const pending = new Map(), latest = new Map();
function work(job, { key = null, progress = null } = {}) {
  if (!worker) {
    worker = new Worker(new URL("./ch08-worker.js?v=89322951a3", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data, p = pending.get(m.id);
      if (!p) return;
      if (m.progress !== undefined) { p.progress?.(m.progress); return; }
      pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
    };
    worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || "the worker stopped")); pending.clear(); };
  }
  const id = nextId++;
  if (key) latest.set(key, id);
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, progress }); worker.postMessage({ ...job, id }); })
    .then((m) => { if (key && latest.get(key) !== id) throw new Error("superseded"); return m; });
}
// the program and the rules for a schedule, shared by the plates that draw the same one
const RULES = new Map();
function rulesFor(choice, add = null, progress = null) {
  const k = JSON.stringify([choice, add]);
  if (!RULES.has(k)) RULES.set(k, work({ job: "rules", choice, add }, { progress }).catch((e) => { RULES.delete(k); throw e; }));
  return RULES.get(k);
}
const stopped = (state, e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; };

/** The cost of time on a log scale, with the deadline marked. */
function costChart(el, t, cs, dl, label) {
  const finite = cs.filter(Number.isFinite);
  const lo = Math.max(0.005, Math.min(...finite) / 1.6), hi = Math.min(40, Math.max(...finite) * 1.6);
  const f = frame(el, { x: [0, t[t.length - 1]], y: [Math.min(lo, 0.05), Math.max(hi, 0.3)], ylog: true, aspect: 0.24, minH: 96, maxH: 140, b: 24 });
  let g = axes(f, { yl: "cost of time", grid: true });
  g += line(f, t, cs, "cost");
  if (dl !== null) g += deadlineMark(f, dl);
  el.innerHTML = svg(f, g, label);
}

// ---------------------------------------------------------------- the hero: a deadline, two rules
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const c0 = 0.1, T = 1, X = 1.45, b0 = boundForCost(c0);
  const times = [0.2, 0.4, 0.6, 0.8, 0.9, 0.96];
  let data = null, cur = 3;
  const draw = (i) => {
    cur = i;
    const t0 = times[i];
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.64)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 12, r = 10, sx = (v) => l + (v / X) * (W - l - r);
    const split = Math.round(H * 0.47), kT = 30, kB = split - 4, cap = 3;
    const ky = (v) => kB - (Math.min(v, cap) / cap) * (kB - kT);
    const bT = split + 22, bB = H - 22, yLo = -0.12, yHi = 1.5;
    const by = (v) => bB - ((v - yLo) / (yHi - yLo)) * (bB - bT);
    let s = "";
    // top: the kernel for the rule's own level, forward from t0, split at the deadline
    if (data) {
      const k = Math.round(t0 / 0.02), b = data.wb[k];
      const ss = range(0.003, X - t0, 160), ws = ss.map((u) => K.flux(u, b) / K.fluxTotal(b));
      const cut = T - t0;
      const piece = (keep, cls) => {
        const pts = ss.map((u, j) => [u, ws[j]]).filter(([u]) => keep(u));
        if (pts.length < 2) return "";
        let d = `M${sx(t0 + pts[0][0]).toFixed(1)} ${kB}`;
        for (const [u, w] of pts) d += `L${sx(t0 + u).toFixed(1)} ${ky(w).toFixed(1)}`;
        return `<path class="${cls}" d="${d}L${sx(t0 + pts[pts.length - 1][0]).toFixed(1)} ${kB}Z"/>`;
      };
      s += piece((u) => u <= cut + 0.004, "wb-fill") + piece((u) => u >= cut - 0.004, "past-fill");
      let d = "";
      ss.forEach((u, j) => { d += `${j ? "L" : "M"}${sx(t0 + u).toFixed(1)} ${ky(ws[j]).toFixed(1)}`; });
      s += `<path class="wb" d="${d}"/>`;
      s += `<text class="lab" x="${l}" y="14">kernel for the bound's own level, from time ${t0.toFixed(2)}</text>`;
    } else s += `<text class="lab" x="${l}" y="14">solving the rule…</text>`;
    s += `<path class="ax" d="M${l} ${kB}H${W - r}M${l} ${bB}H${W - r}"/>`;
    s += `<path class="acc" stroke-dasharray="3 3" d="M${sx(T).toFixed(1)} ${kT - 8}V${bB}"/><text class="tag-acc" x="${(sx(T) + 4).toFixed(1)}" y="${kT}">deadline</text>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${sx(t0).toFixed(1)} ${kT}V${bB}"/>`;
    // bottom: the three rules' bounds
    const ts = range(0, T, 51);
    s += `<path class="pm" d="M${sx(0)} ${by(b0).toFixed(1)}H${sx(T).toFixed(1)}"/>`;
    s += `<path class="avg" d="M${sx(0)} ${by(0).toFixed(1)}H${sx(T).toFixed(1)}"/>`;
    if (data) {
      const upto = data.t.findIndex((x) => x > t0 + 1e-9);
      const pts = data.t.map((x, j) => `${j ? "L" : "M"}${sx(x).toFixed(1)} ${by(data.wb[j]).toFixed(1)}`);
      s += `<path class="wb-thin" d="${pts.join("")}"/><path class="wb" d="${pts.slice(0, upto).join("")}"/>`;
      const k = Math.round(t0 / 0.02);
      s += `<circle class="wb-dot" cx="${sx(t0).toFixed(1)}" cy="${by(data.wb[k]).toFixed(1)}" r="4.5"/>`;
      s += `<text class="tag-wb" x="${sx(0.02).toFixed(1)}" y="${(by(data.wb[0]) + 15).toFixed(1)}">weighted</text>`;
    }
    s += `<text class="tag-pm" x="${sx(0.02).toFixed(1)}" y="${(by(b0) - 6).toFixed(1)}">per-moment</text>`;
    s += `<text class="tag-wb" x="${sx(0.02).toFixed(1)}" y="${(by(0) - 6).toFixed(1)}">averaged cost: 0</text>`;
    s += `<text class="tk" x="${sx(0)}" y="${H - 6}" text-anchor="start">0</text><text class="tk" x="${sx(T).toFixed(1)}" y="${H - 6}" text-anchor="middle">1</text><text class="tk" x="${W - r}" y="${H - 6}" text-anchor="end">time</text>`;
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  rulesFor({ id: "deadline", params: { at: T, c: c0 } }).then((r) => {
    data = r;
    draw(cur);
    if (window.ChapterHero) {
      window.ChapterHero.live(fig, { steps: times.length, draw, label: (i) => { const k = Math.round(times[i] / 0.02); return S.heroLabel(times[i], shareBefore(data.wb[k], T - times[i]), data.wb[k]); } });
    }
  }).catch((e) => console.warn("hero:", e.message));
}

// ---------------------------------------------------------------- plate: average the costs, or the bounds
function twoPlate() {
  const fig = plate("tworules"), el = rootOf("tworules");
  if (!el) return;
  let choice = getChoice(), add = null, guess = null, data = null;
  const ADDS = [["none", "None"], [1, "At 1"], [1.5, "At 1.5"], [2, "At 2"]];
  el.innerHTML = `<div class="controls">${pickHTML("tw-pick")}${segHTML("tw-dl", ADDS, "none", "Add a deadline")}</div>
    <p class="fine" id="tw-note"></p>
    <div class="predict"><p>With a deadline ahead, what will the averaged-cost rule do before it?</p>
      ${segHTML("tw-guess", [["smooth", "Come down smoothly"], ["hold", "Hold, then drop"], ["zero", "Drop to 0 at once"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="tw-show">Show me</button></div>
      <p class="verdict" id="tw-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="tw-cost"></div><div class="chart-wrap" id="tw-bound"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment</span></li><li><span class="key key-avg">Averaged cost</span></li><li><span class="key key-wb">Weighted</span></li></ul>
    <dl class="reads" id="tw-reads"></dl><p class="say" id="tw-say"></p><p class="fine" id="tw-state" aria-live="polite"></p>`;
  const pick = $("#tw-pick", el), note = $("#tw-note", el), costEl = $("#tw-cost", el), boundEl = $("#tw-bound", el);
  const reads = $("#tw-reads", el), say = $("#tw-say", el), state = $("#tw-state", el), verdict = $("#tw-verdict", el);
  const own = () => deadlineOf(choice);
  const draw = () => {
    if (!data) { boundEl.innerHTML = ""; return; }
    const r = data, dl = r.deadline;
    costChart(costEl, r.t, r.cost, dl, `The cost of time for ${labelOf(choice)}${dl !== null ? ", with a forced choice at " + dl : ""}, on a log scale`);
    const ex = r.exact, pm = shift(r.pm), avg = shift(r.avg), wb = shift(r.wb);
    const top = finiteMax(ex, pm, avg, wb) * 1.12;
    const f = frame(boundEl, { x: [0, r.view], y: [0, Math.max(0.4, top)], aspect: 0.46, minH: 170, maxH: 280 });
    let g = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    g += line(f, r.t, avg, "avg") + line(f, r.t, pm, "pm") + line(f, r.t, wb, "wb") + line(f, r.t, ex, "ex");
    if (dl !== null) g += deadlineMark(f, dl);
    boundEl.innerHTML = svg(f, g, `For ${labelOf(choice)}: the best bound, the per-moment rule, the averaged-cost rule, and the weighted rule`);
    const L = S.lossText;
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment loss</dt><dd>${L(r.loss.pm)}<small>points per 100 trials</small></dd></div>
      <div class="k-avg"><dt>Averaged-cost loss</dt><dd>${L(r.loss.avg)}<small>points per 100 trials</small></dd></div>
      <div class="k-wb"><dt>Weighted loss</dt><dd>${L(r.loss.wb)}<small>points per 100 trials</small></dd></div>`;
    say.textContent = S.twoSay(labelOf(choice), r.loss, dl, dl !== null && !r.own);
    verdict.textContent = S.twoVerdict(guess, dl !== null);
    liftReady(fig);
  };
  const run = () => {
    pick.value = choice.id;
    const o = own();
    el.querySelectorAll('input[name="tw-dl"]').forEach((x) => { x.disabled = o !== null; });
    if (o !== null) { add = null; setSeg(el, "tw-dl", "none"); }
    note.textContent = o !== null ? `Your schedule has its own deadline, at ${o}.` : choice.id === "constant" ? S.constantNote() : "Add a deadline to make the cost infinite after it.";
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the dynamic program and the rules…";
    const c = choice, a = o !== null ? null : add;
    rulesFor(c, a, (p) => { state.textContent = `Solving the dynamic program and the rules… ${Math.round(p * 100)}%`; }).then((r) => {
      if (c !== choice || a !== (deadlineOf(choice) !== null ? null : add)) return;
      data = r;
      state.textContent = `Time step 0.01, evidence step 0.02; the program runs ${r.deadline !== null ? "to the deadline" : "6 time units past the window"}.`;
      draw();
    }).catch((e) => stopped(state, e));
  };
  keepDrawn(boundEl, draw);
  follow(pick, (c) => { choice = c; run(); });
  onSeg(el, "tw-dl", (v) => { add = v === "none" ? null : +v; run(); });
  onSeg(el, "tw-guess", (v) => { guess = v; verdict.textContent = S.twoVerdict(guess, data ? data.deadline !== null : own() !== null || add !== null); });
  $("#tw-show", el).addEventListener("click", () => {
    if (own() === null && add === null) { add = 1.5; setSeg(el, "tw-dl", 1.5); run(); }
    else verdict.textContent = S.twoVerdict(guess || "zero", true);
  });
  run();
}

// ---------------------------------------------------------------- plate: thirty updates
function iteratePlate() {
  const fig = plate("iterate"), el = rootOf("iterate");
  if (!el) return;
  let choice = getChoice(), data = null, k = 0, guess = null, reveal = false, change = [], where = [], timer = 0, visible = false, playing = false;
  el.innerHTML = `<div class="controls">${pickHTML("it-pick")}<label class="dial"><span class="ctl-key">After update</span><output id="it-out">0</output>
      <input type="range" id="it-k" min="0" max="30" step="1" value="0" aria-label="Number of updates"></label>
      <div class="actions"><button class="btn" type="button" id="it-play" aria-pressed="false">Play</button></div></div>
    <p class="fine" id="it-note"></p>
    <div class="chart-wrap" id="it-top"></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment start</span></li><li><span class="key key-wb">After this update</span></li><li><span class="key key-faint">The update before</span></li></ul>
    <div class="predict"><p>How many updates until no time in the window moves by more than 0.001?</p>
      ${segHTML("it-guess", [["3", "About 3"], ["10", "About 10"], ["20", "About 20"], ["never", "Not within 30"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="it-show">Show me</button></div>
      <p class="verdict" id="it-verdict" aria-live="polite"></p></div>
    <div class="chart-wrap" id="it-bot" hidden></div>
    <dl class="reads" id="it-reads"></dl>
    <div class="actions" style="margin-top:12px"><button class="btn" type="button" id="it-more">Run 300 updates</button></div>
    <p class="say" id="it-say"></p><p class="fine" id="it-more-say" aria-live="polite"></p><p class="fine" id="it-state" aria-live="polite"></p>`;
  const pick = $("#it-pick", el), top = $("#it-top", el), bot = $("#it-bot", el), reads = $("#it-reads", el), say = $("#it-say", el);
  const state = $("#it-state", el), verdict = $("#it-verdict", el), inp = $("#it-k", el), out = $("#it-out", el), play = $("#it-play", el);
  const note = $("#it-note", el), moreBtn = $("#it-more", el), moreSay = $("#it-more-say", el);
  const settle = () => S.settledAt(change);
  const drawTop = () => {
    if (!data) { top.innerHTML = ""; return; }
    const r = data, u = r.updates;
    const f = frame(top, { x: [0, r.view], y: [0, Math.max(0.4, finiteMax(u[0], u[30], r.pm) * 1.12)], aspect: 0.46, minH: 170, maxH: 270 });
    let g = axes(f, { yl: "bound (continuous monitoring)", xl: "time", grid: true });
    g += line(f, r.t, u[0], "pm");
    if (k > 0) g += line(f, r.t, u[k - 1], "wb-thin");
    g += line(f, r.t, u[k], "wb");
    if (r.deadline !== null) g += deadlineMark(f, r.deadline);
    top.innerHTML = svg(f, g, `For ${labelOf(choice)}: the weighted rule after update ${k} of 30, beside the update before and the per-moment start`);
    liftReady(fig);
  };
  const drawBot = () => {
    if (!data || !reveal || !(Math.max(...change) > 0)) { bot.hidden = true; return; }
    bot.hidden = false;
    const pos = change.filter((v) => v > 0);
    const yLo = Math.min(2e-4, Math.min(...pos) / 2), yHi = Math.max(...pos) * 2.5;
    const f = frame(bot, { x: [0.5, 30.5], y: [yLo, yHi], ylog: true, aspect: 0.36, minH: 150, maxH: 220 });
    const decades = []; for (let e = Math.ceil(Math.log10(yLo)); e <= Math.floor(Math.log10(yHi)); e++) decades.push(10 ** e);
    const sup = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    const fy = (v) => (v >= 1e-3 ? String(+v.toPrecision(1)) : "10" + String(Math.round(Math.log10(v))).split("").map((c) => sup[c]).join(""));
    let g = axes(f, { yl: "largest move in the update", xl: "update", grid: true, xt: [1, 5, 10, 15, 20, 25, 30], yt: decades, fy });
    g += `<path class="dim" stroke-dasharray="1 3" d="M${f.l} ${f.sy(1e-3).toFixed(1)}H${f.W - f.r}"/>`;
    g += change.map((v, j) => (v > 0 ? `<circle class="${j + 1 === k ? "wb-dot" : "ink-dot"}" cx="${f.sx(j + 1).toFixed(1)}" cy="${f.sy(Math.max(v, yLo)).toFixed(1)}" r="${j + 1 === k ? 4.5 : 2.6}"/>` : "")).join("");
    bot.innerHTML = svg(f, g, "The largest move each of the 30 updates made, on a log scale, with a line at 0.001");
  };
  const drawAll = () => {
    out.textContent = String(k); inp.value = k;
    drawTop(); drawBot();
    if (!data) return;
    const st = settle();
    say.textContent = S.iterateSay(k, change[k - 1] ?? 0, where[k - 1] ?? 0, st, change[29], reveal);
    reads.innerHTML = `<div class="k-wb"><dt>Largest move in update ${k}</dt><dd>${k ? S.num(change[k - 1]) : "–"}<small>${k ? "at time " + fmt(where[k - 1], 2) : "the start"}</small></dd></div>
      <div><dt>Settled after</dt><dd>${reveal ? (st === null ? "> 30" : st) : "?"}<small>${reveal ? "updates, to within 0.001" : "guess first, or show me"}</small></dd></div>`;
    if (reveal) verdict.textContent = S.iterateVerdict(guess, st, change[29]);
  };
  const tick = () => { timer = 0; if (!playing || !visible || !data) return; if (k >= 30) { stopPlay(); return; } k++; drawAll(); timer = setTimeout(tick, 420); };
  const startPlay = () => { if (!data) return; if (calm.matches) { k = 30; drawAll(); return; } playing = true; play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); if (k >= 30) k = 0; drawAll(); clearTimeout(timer); timer = setTimeout(tick, 420); };
  const stopPlay = () => { playing = false; clearTimeout(timer); timer = 0; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); };
  const run = () => {
    stopPlay();
    pick.value = choice.id;
    data = null; change = []; where = []; moreSay.textContent = ""; drawAll(); reads.innerHTML = ""; say.textContent = "";
    note.textContent = choice.id === "constant" ? S.constantNote() : "";
    state.textContent = "Running the updates…";
    const c = choice;
    rulesFor(c, null).then((r) => {
      if (c !== choice) return;
      data = r;
      for (let j = 1; j <= 30; j++) {
        let m = 0, at = 0;
        for (let i = 0; i < r.t.length; i++) { const d = Math.abs(r.updates[j][i] - r.updates[j - 1][i]); if (d > m) { m = d; at = r.t[i]; } }
        change.push(m); where.push(at);
      }
      state.textContent = `Algorithm 1 at the times 0, 0.02, …, ${fmt(r.view, 2)}; each time point is updated on its own.`;
      drawAll();
      if (visible) startPlay();
    }).catch((e) => stopped(state, e));
  };
  keepDrawn(top, drawAll);
  follow(pick, (c) => { choice = c; run(); });
  inp.addEventListener("input", () => { stopPlay(); k = +inp.value; drawAll(); });
  play.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
  onSeg(el, "it-guess", (v) => { guess = v; reveal = true; drawAll(); });
  $("#it-show", el).addEventListener("click", () => { reveal = true; drawAll(); });
  moreBtn.addEventListener("click", () => {
    moreSay.textContent = "Running 300 updates…"; moreBtn.disabled = true;
    const c = choice;
    work({ job: "more", choice: c }, { key: "more" }).then((m) => { if (c === choice) moreSay.textContent = S.moreSay(m.move, m.at, m.end); })
      .catch((e) => { if (e.message !== "superseded") moreSay.textContent = "The solver stopped: " + e.message; })
      .finally(() => { moreBtn.disabled = false; });
  });
  watchVisible(fig, (v) => { const was = visible; visible = v; if (v && !was && data && k === 0 && !playing) startPlay(); if (!v && playing) { clearTimeout(timer); timer = 0; } else if (v && playing && !timer) timer = setTimeout(tick, 420); });
  run();
}

// ---------------------------------------------------------------- the proof strip
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

// ---------------------------------------------------------------- plate: a map that is nearly flat (Proposition 13)
function contractionPlate() {
  const fig = plate("contraction"), el = rootOf("contraction");
  if (!el) return;
  const { c0, EPS } = P13;
  let step = +(fig.dataset.step || 0), sel = 1, runs = null;
  el.innerHTML = `<div class="controls">${segHTML("p13-eps", EPS.map((e, i) => [i, Math.round(e * 100) + "%"]), sel, "Size of the change, ε")}</div>
    <p class="fine" id="p13-head"></p><div class="chart-wrap" id="p13-a"></div><div class="chart-wrap" id="p13-b"></div>
    <ul class="legend" id="p13-legend"></ul><dl class="reads" id="p13-reads"></dl><p class="say" id="p13-say"></p><p class="fine" id="p13-state" aria-live="polite">Computing the four sizes…</p>`;
  const A = $("#p13-a", el), B = $("#p13-b", el), head = $("#p13-head", el), reads = $("#p13-reads", el), say = $("#p13-say", el), legend = $("#p13-legend", el), state = $("#p13-state", el);
  const b0 = boundForCost(c0);
  // step 2's pictures come from the series directly: the kernel at three levels and its derivative in the level, each
  // times s, so that the areas on the log axis are the true integrals
  const kern = levelDerivative(b0);
  const kernAt = (b) => kern.ss.map((s) => s * K.flux(s, b) / K.fluxTotal(b));
  const transfer = (() => { const om = range(0, 20, 201); return { om, v: om.map((w) => { const T = K.transfer(c0, w); return Math.hypot(1 - T.re, T.im); }) }; })();
  const keyList = (items) => items.map(([cls, txt]) => `<li><span class="key ${cls}">${txt}</span></li>`).join("");
  const draw = () => {
    B.innerHTML = ""; B.hidden = true; reads.innerHTML = "";
    if (step === 1) { drawKernels(); return; }
    if (step === 5) { drawTransfer(); return; }
    if (!runs) { A.innerHTML = ""; head.textContent = ""; return; }
    const r = runs[sel];
    if (step === 0 || step === 2) {
      const all = step === 2 ? runs : [r];
      const lo = Math.min(...all.map((x) => x.lo)), hi = Math.max(...all.map((x) => x.hi)), pad = (hi - lo) * 0.06;
      const f = frame(A, { x: [lo - pad, hi + pad], y: [lo - pad, hi + pad], aspect: 0.78, minH: 230, maxH: 340 });
      let g = axes(f, { yl: "T(b; 0.5)", xl: "level b", grid: true });
      g += `<rect class="box" x="${f.sx(r.lo).toFixed(1)}" y="${f.sy(r.hi).toFixed(1)}" width="${(f.sx(r.hi) - f.sx(r.lo)).toFixed(1)}" height="${(f.sy(r.lo) - f.sy(r.hi)).toFixed(1)}"/>`;
      g += line(f, [lo - pad, hi + pad], [lo - pad, hi + pad], "diag");
      for (const x of all) g += line(f, x.bs, x.map, x === r ? "wb" : "wb-thin");
      if (Number.isFinite(r.fixed)) g += `<circle class="root" cx="${f.sx(r.fixed).toFixed(1)}" cy="${f.sy(r.fixed).toFixed(1)}" r="4.5"/>`;
      g += `<text class="tag-wb" x="${(f.sx(r.lo) + 4).toFixed(1)}" y="${(f.sy(r.hi) + 14).toFixed(1)}">I × I</text>`;
      A.innerHTML = svg(f, g, `The map from level to average over the interval I, against the diagonal, for a ${Math.round(r.eps * 100)}% change`);
      legend.innerHTML = keyList([["key-wb", "The map T(b; 0.5)"], ["key-diag", "Diagonal"]]);
      if (step === 0) {
        const mn = Math.min(...r.map), mx = Math.max(...r.map);
        head.textContent = "Step 1: every level in I averages to a level in I (the shaded square).";
        reads.innerHTML = `<div><dt>The interval I</dt><dd>${fmt(r.lo, 3)}–${fmt(r.hi, 3)}</dd></div><div class="k-wb"><dt>The map's values</dt><dd>${fmt(mn, 3)}–${fmt(mx, 3)}</dd></div>`;
        say.textContent = S.p13Say(0, { eps: r.eps, lo: r.lo, hi: r.hi, min: mn, max: mx, crossings: r.crossings });
      } else {
        const ratios = runs.map((x) => x.slope / x.eps);
        head.textContent = "Step 3: the map is nearly flat, and flatter for a smaller change; the faint curves are the other sizes.";
        reads.innerHTML = `<div class="k-wb"><dt>Steepest slope on I</dt><dd>${fmt(r.slope, 4)}</dd></div><div><dt>Slope ÷ ε</dt><dd>${ratios.map((v) => fmt(v, 3)).join(", ")}<small>for ε = ${EPS.map((e) => Math.round(e * 100) + "%").join(", ")}</small></dd></div>`;
        say.textContent = S.p13Say(2, { eps: r.eps, slope: r.slope, ratios });
      }
    } else if (step === 3) {
      const curves = runs.map((x) => x.ts.map((t, i) => (x.wb[i] - x.b0 - x.eps * x.beta[i]) / (x.eps * x.eps)));
      const lim = finiteMax(...curves.map((c) => c.map(Math.abs))) * 1.15;
      const f = frame(A, { x: [0, P13.end], y: [-lim, lim], aspect: 0.5, minH: 190, maxH: 280 });
      let g = axes(f, { yl: "(b_w − b₀ − εβ) ÷ ε²", xl: "time", grid: true, zero: true });
      curves.forEach((c, i) => { if (i !== sel) g += line(f, r.ts, c, "wb-thin"); });
      g += line(f, r.ts, curves[sel], "wb");
      A.innerHTML = svg(f, g, "The weighted rule's error from the first-order bound, divided by epsilon squared, for four sizes of change");
      legend.innerHTML = keyList([["key-wb", `ε = ${Math.round(r.eps * 100)}%`], ["key-faint", "The other sizes"]]);
      const ratios = runs.map((x) => x.errW / (x.eps * x.eps));
      head.textContent = "Step 4: divided by ε², the rule's distance from b₀ + εβ is about the same curve at every size: second order.";
      reads.innerHTML = `<div class="k-wb"><dt>Largest distance</dt><dd>${S.num(r.errW)}<small>at ε = ${Math.round(r.eps * 100)}%</small></dd></div><div><dt>÷ ε²</dt><dd>${ratios.map((v) => fmt(v, 3)).join(", ")}</dd></div>`;
      say.textContent = S.p13Say(3, { eps: r.eps, err: r.errW, ratios });
    } else {
      const wb = r.ts.map((t, i) => (r.wb[i] - r.b0) / r.eps), pm = r.ts.map((t, i) => (r.pm[i] - r.b0) / r.eps);
      const lim = finiteMax(wb.map(Math.abs), pm.map(Math.abs), r.beta.map(Math.abs)) * 1.12;
      const f = frame(A, { x: [0, P13.end], y: [-lim, lim], aspect: 0.5, minH: 190, maxH: 280 });
      let g = axes(f, { yl: "(b − b₀) ÷ ε", xl: "time", grid: true, zero: true });
      g += line(f, r.ts, pm, "pm") + line(f, r.ts, r.beta, "ex", 'stroke-dasharray="2 3"') + line(f, r.ts, wb, "wb");
      A.innerHTML = svg(f, g, "The weighted and per-moment rules' moves divided by epsilon, beside the first-order term of the best bound");
      legend.innerHTML = keyList([["key-wb", "Weighted, ÷ ε"], ["key-beta", "β, the best bound's first-order term"], ["key-pm", "Per-moment, ÷ ε"]]);
      head.textContent = "Step 5: the weighted rule's move sits on β; the per-moment rule's doesn't, at any size.";
      reads.innerHTML = `<div class="k-wb"><dt>Weighted, largest gap to β</dt><dd>${fmt(r.errW / r.eps, 4)}</dd></div><div class="k-pm"><dt>Per-moment, largest gap</dt><dd>${fmt(r.errPm / r.eps, 3)}<small>${runs.map((x) => fmt(x.errPm / x.eps, 3)).join(", ")} across the sizes</small></dd></div>`;
      say.textContent = S.p13Say(4, { eps: r.eps, wb: r.errW / r.eps, pm: r.errPm / r.eps });
    }
    liftReady(fig);
  };
  const drawKernels = () => {
    const { ss, sw, sd, above, below } = kern;
    const r = runs ? runs[sel] : { lo: boundForCost(c0 * (1 + EPS[sel])), hi: boundForCost(c0 * (1 - EPS[sel])) };
    const X = [1e-6, 20], keep = ss.map((s) => s >= X[0] && s <= X[1]);
    const xs = ss.filter((_, i) => keep[i]), cut = (a) => a.filter((_, i) => keep[i]);
    const ends = [kernAt(r.lo), kernAt(r.hi)].map(cut), mid = cut(sw);
    const f = frame(A, { x: X, y: [0, Math.max(...mid, ...ends.flat()) * 1.12], xlog: true, aspect: 0.42, minH: 160, maxH: 230 });
    let g = axes(f, { yl: "s · w_b(s): area 1 on this axis", xl: "delay s", grid: true });
    for (const e of ends) g += line(f, xs, e, "wb-thin");
    g += line(f, xs, mid, "wb");
    A.innerHTML = svg(f, g, "The kernel at the two ends of the interval and at b0, times s, on a log scale of delay");
    B.hidden = false;
    const d = cut(sd), lim = Math.max(...d.map(Math.abs)) * 1.1;
    const fb = frame(B, { x: X, y: [-lim, lim], xlog: true, aspect: 0.34, minH: 140, maxH: 200 });
    let h = axes(fb, { yl: "s · ∂w_b/∂b at b₀", xl: "delay s", grid: true, zero: true });
    h += area(fb, xs, d.map((v) => Math.max(v, 0)), 0, "wb-fill") + area(fb, xs, d.map((v) => Math.min(v, 0)), 0, "past-fill") + line(fb, xs, d, "wb");
    B.innerHTML = svg(fb, h, "The kernel's derivative in the level at b0, times s: the areas above and below zero are equal");
    legend.innerHTML = keyList([["key-wb", "At b₀"], ["key-faint", "At the ends of I"]]);
    head.textContent = "Step 2: the kernels at the ends of I nearly agree. A higher level moves weight from the middle delays, mostly to longer ones, and the derivative's areas cancel.";
    reads.innerHTML = `<div class="k-wb"><dt>Area above zero</dt><dd>${fmt(above, 4)}</dd></div><div><dt>Area below zero</dt><dd>${fmt(below, 4)}</dd></div><div><dt>Difference</dt><dd>${S.num(above - below)}<small>from leaving out delays below 10⁻⁸</small></dd></div>`;
    say.textContent = S.p13Say(1, { above, below });
    liftReady(fig);
  };
  const drawTransfer = () => {
    const { om, v } = transfer;
    const f = frame(A, { x: [0, 20], y: [0, Math.max(...v) * 1.1], aspect: 0.46, minH: 170, maxH: 250 });
    let g = axes(f, { yl: "|1 − w̃(−iω)|", xl: "angular frequency ω", grid: true });
    g += line(f, om, v, "wb") + `<circle class="root" cx="${f.sx(0).toFixed(1)}" cy="${f.sy(0).toFixed(1)}" r="4.5"/>`;
    A.innerHTML = svg(f, g, "The distance of the kernel's transfer function from 1, zero only at frequency zero");
    legend.innerHTML = keyList([["key-wb", "|1 − w̃(−iω)| at c₀ = 0.1"]]);
    const mn = Math.min(...v.filter((_, i) => om[i] >= 0.5));
    head.textContent = "Step 6: a change that is its own kernel-weighted average would need w̃(−iω) = 1 at some ω ≠ 0; that never happens.";
    reads.innerHTML = `<div class="k-wb"><dt>Smallest for ω ≥ 0.5</dt><dd>${fmt(mn, 3)}</dd></div>`;
    say.textContent = S.p13Say(5, { min: mn });
    liftReady(fig);
  };
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  onSeg(el, "p13-eps", (v) => { sel = +v; draw(); });
  keepDrawn(A, draw);
  work({ job: "prop13" }, { progress: (p) => { state.textContent = `Computing the four sizes… ${Math.round(p * 4)} of 4`; } }).then((m) => {
    runs = m.runs; state.textContent = "Kernels from 4000 terms of the series in 240 bins; the rule from 30 damped updates."; draw();
  }).catch((e) => stopped(state, e));
}

// ---------------------------------------------------------------- plate: two levels that both fit
function rootsPlate() {
  const fig = plate("roots"), el = rootOf("roots");
  if (!el) return;
  let source = "spike", choice = getChoice(), t = 0, data = null, b = 0.6, guess = null, reveal = false;
  el.innerHTML = `<div class="controls">${segHTML("rt-src", [["spike", "A brief spike"], ["yours", "Your schedule"]], source, "Schedule")}
      <label class="dial" id="rt-tl" hidden><span class="ctl-key">Seen from time</span><output id="rt-tout"></output><input type="range" id="rt-t" min="0" max="2.4" step="0.02" value="0" aria-label="The time the map is seen from"></label></div>
    <p class="fine" id="rt-note"></p>
    <div class="predict"><p>Does one level average back to itself, or more than one?</p>
      ${segHTML("rt-guess", [["one", "One"], ["two", "Two"], ["more", "More than two"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="rt-show">Show me</button></div>
      <p class="verdict" id="rt-verdict" aria-live="polite"></p></div>
    <div class="controls"><label class="dial"><span class="ctl-key">Your level b</span><output id="rt-bout"></output><input type="range" id="rt-b" min="0.01" max="2.4" step="0.001" value="${b}" aria-label="The level b"></label></div>
    <div class="chart-wrap pad is-draw" id="rt-map"></div><div class="chart-wrap" id="rt-ker"></div>
    <ul class="legend"><li><span class="key key-wb">Average T(b)</span></li><li><span class="key key-diag">Level b itself</span></li><li><span class="key key-pm">Per-moment bounds ahead</span></li></ul>
    <dl class="reads" id="rt-reads"></dl><p class="say" id="rt-say"></p><p class="fine" id="rt-state" aria-live="polite"></p>`;
  const mapEl = $("#rt-map", el), kerEl = $("#rt-ker", el), reads = $("#rt-reads", el), say = $("#rt-say", el), state = $("#rt-state", el), verdict = $("#rt-verdict", el);
  const tl = $("#rt-tl", el), tin = $("#rt-t", el), tout = $("#rt-tout", el), bin = $("#rt-b", el), bout = $("#rt-bout", el), note = $("#rt-note", el);
  const costNow = () => (source === "spike" ? spikeCost : scheduleFor(choice).cost);
  const draw = () => {
    bout.textContent = fmt(b, 3);
    if (!data) { mapEl.innerHTML = ""; kerEl.innerHTML = ""; return; }
    const cost = costNow(), Tb = mapT(b, t, cost, true);
    const f = frame(mapEl, { x: [0, data.hi], y: [0, data.hi], aspect: 0.72, minH: 220, maxH: 330 });
    let g = axes(f, { yl: `T(b; ${+t.toFixed(2)})`, xl: "level b", grid: true });
    g += line(f, [0, data.hi], [0, data.hi], "diag") + line(f, data.bs, data.map, "wb");
    g += `<path class="acc" d="M${f.sx(b).toFixed(1)} ${f.sy(b).toFixed(1)}V${f.sy(Tb).toFixed(1)}"/><circle class="acc-dot" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(Tb).toFixed(1)}" r="4.5"/>`;
    if (reveal) {
      g += data.roots.map((q) => `<circle class="root" cx="${f.sx(q.b).toFixed(1)}" cy="${f.sy(q.b).toFixed(1)}" r="5"/>`).join("");
      g += `<circle class="ink-dot" cx="${f.sx(data.end).toFixed(1)}" cy="${f.sy(data.end).toFixed(1)}" r="3.2"/><text class="tag-ex" x="${(f.sx(data.end) + 8).toFixed(1)}" y="${(f.sy(data.end) - 9).toFixed(1)}">30 updates end here</text>`;
    }
    g += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    mapEl.innerHTML = svg(f, g, `The average of the per-moment bounds ahead for each level, against the level itself, seen from time ${fmt(t, 2)}`);
    mapEl._f = f;
    // the kernel for the level, over the delay, beside the per-moment bounds ahead
    const S_MAX = source === "spike" ? 1.2 : 2;
    const ss = range(0.002, S_MAX, 220), bs = ss.map((s) => boundForCost(cost(t + s))), ws = ss.map((s) => K.flux(s, Math.max(b, 0.01)) / K.fluxTotal(Math.max(b, 0.01)));
    const wTop = Math.max(...ws.slice(Math.round(ws.length * 0.02))) || 1, scale = (data.hi * 0.9) / wTop;
    const fk = frame(kerEl, { x: [0, S_MAX], y: [0, data.hi], aspect: 0.4, minH: 150, maxH: 220 });
    let h = axes(fk, { yl: "bound ahead, and the kernel (scaled)", xl: "delay s", grid: true });
    h += area(fk, ss, ws.map((w) => Math.min(w * scale, data.hi)), 0, "wb-fill") + line(fk, ss, ws.map((w) => Math.min(w * scale, data.hi)), "wb-thin");
    h += line(fk, ss, bs, "pm") + `<path class="wb" stroke-dasharray="5 3" d="M${fk.l} ${fk.sy(Tb).toFixed(1)}H${fk.W - fk.r}"/><text class="tag-wb" x="${fk.W - fk.r}" y="${(fk.sy(Tb) - 5).toFixed(1)}" text-anchor="end">average ${fmt(Tb, 3)}</text>`;
    kerEl.innerHTML = svg(fk, h, `The kernel for the level ${fmt(b, 3)} over the delay, beside the per-moment bounds ahead`);
    const rs = reveal ? data.roots.map((q) => `${fmt(q.b, 3)}`).join(", ") : "?";
    reads.innerHTML = `<div class="k-acc"><dt>Your level</dt><dd>${fmt(b, 3)}</dd></div><div class="k-wb"><dt>Its average</dt><dd>${fmt(Tb, 3)}</dd></div>
      <div><dt>Levels that fit</dt><dd>${rs}<small>${reveal ? data.roots.map((q) => S.rootRole(q.slope)).join("; ") : "guess first, or show me"}</small></dd></div>`;
    say.textContent = S.rootsSay(b, Tb, data.start, data.end);
    if (reveal) verdict.textContent = S.rootsVerdict(guess, data.roots);
    liftReady(fig);
  };
  const run = () => {
    tl.hidden = source === "spike";
    if (source === "yours") {
      const dl = deadlineOf(choice), end = (dl ?? VIEW) - 0.02;
      tin.max = String(end); if (t > end) t = end; tin.value = t; tout.textContent = fmt(t, 2);
      note.textContent = `${labelOf(choice)}, seen from time ${fmt(t, 2)}.`;
    } else { t = 0; note.textContent = "A cost near 4 for the first 0.2 time units, then 0.02, seen from time 0."; }
    state.textContent = "Averaging for each level…";
    work({ job: "roots", choice: source === "spike" ? null : choice, t }, { key: "roots" }).then((m) => {
      data = m; bin.max = String(m.hi.toFixed(3)); if (b > m.hi) b = m.hi / 2; bin.value = b;
      state.textContent = `Levels 0.01 to ${fmt(m.hi, 2)}; each level's own kernel from 4000 terms of its series.`;
      draw();
    }).catch((e) => stopped(state, e));
  };
  let tTimer = 0;
  tin.addEventListener("input", () => { t = +tin.value; tout.textContent = fmt(t, 2); clearTimeout(tTimer); tTimer = setTimeout(run, 160); });
  bin.addEventListener("input", () => { b = +bin.value; draw(); });
  onSeg(el, "rt-src", (v) => { source = v; run(); });
  onSeg(el, "rt-guess", (v) => { guess = v; reveal = true; draw(); });
  $("#rt-show", el).addEventListener("click", () => { reveal = true; draw(); });
  window.addEventListener("cc-schedule", (e) => { choice = e.detail; if (source === "yours") run(); });
  let down = false;
  const setAt = (e) => {
    const f = mapEl._f; if (!f || !data) return;
    const rc = mapEl.getBoundingClientRect();
    b = Math.max(0.01, Math.min(data.hi, f.ix(((e.clientX - rc.left) / rc.width) * f.W)));
    bin.value = b; draw();
  };
  mapEl.addEventListener("pointerdown", (e) => { down = true; mapEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  mapEl.addEventListener("pointermove", (e) => { if (down) setAt(e); });
  mapEl.addEventListener("pointerup", () => { down = false; }); mapEl.addEventListener("pointercancel", () => { down = false; });
  keepDrawn(mapEl, draw);
  run();
}

// ---------------------------------------------------------------- plate: Algorithm 1, one step at a time
function algorithmPlate() {
  const fig = plate("algorithm"), el = rootOf("algorithm");
  if (!el) return;
  let choice = getChoice(), step = 0, tk = 0.3, data = null, local = null;
  const STEPS = [[0, "Start"], [1, "Kernel"], [2, "Average"], [3, "Update"], [4, "Shift"]];
  el.innerHTML = `<div class="controls">${pickHTML("al-pick")}<label class="dial"><span class="ctl-key">Time tₖ</span><output id="al-tout"></output>
      <input type="range" id="al-t" min="0" max="2.48" step="0.02" value="${tk}" aria-label="The time t sub k"></label></div>
    <div class="controls">${segHTML("al-step", STEPS, step, "Step of the algorithm")}</div>
    <div class="chart-wrap" id="al-chart"></div><ul class="legend" id="al-legend"></ul>
    <dl class="reads" id="al-reads"></dl><p class="say" id="al-say"></p><p class="fine" id="al-state" aria-live="polite"></p>`;
  const pick = $("#al-pick", el), chart = $("#al-chart", el), reads = $("#al-reads", el), say = $("#al-say", el), state = $("#al-state", el), legend = $("#al-legend", el);
  const tin = $("#al-t", el), tout = $("#al-tout", el);
  const keyList = (items) => items.map(([cls, txt]) => `<li><span class="key ${cls}">${txt}</span></li>`).join("");
  const compute = () => {
    const { cost, deadline } = scheduleFor(choice);
    const hist = weightedHistory(cost, [tk]);
    const path = hist.updates.map((u) => u[0]);
    const b = path[0], l = Math.round(Math.max(b, 0.01) * 1000) / 1000, kb = kernelForBound(l);
    let a = 0; for (let j = 0; j < kb.s.length; j++) a += kb.w[j] * boundForCost(cost(tk + kb.s[j]));
    const keys = new Set(path.slice(0, 30).map((v) => Math.round(Math.max(v, 0.01) * 1000)));
    const avgs = path.slice(0, 30).map((v, i) => 2 * path[i + 1] - v);
    local = { cost, deadline, path, b, l, kb, a, kernels: keys.size, avgs, c: cost(tk) };
  };
  const draw = () => {
    tout.textContent = fmt(tk, 2);
    if (!local) compute();
    const { cost, deadline, path, b, l, kb, a, kernels, avgs, c } = local;
    const view = deadline ?? VIEW;
    let f, g = "", label = "", items = [];
    if (step === 0) {
      const ts = range(0, view, 251), pm = ts.map((t) => (deadline !== null && t >= deadline - 1e-9 ? 0 : boundForCost(cost(t))));
      f = frame(chart, { x: [0, view], y: [0, Math.max(0.4, finiteMax(pm) * 1.12)], aspect: 0.44, minH: 170, maxH: 260 });
      g = axes(f, { yl: "per-moment bound B(c(t))", xl: "time", grid: true }) + line(f, ts, pm, "pm");
      g += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tk).toFixed(1)} ${f.t}V${f.H - f.b}"/><circle class="acc-dot" cx="${f.sx(tk).toFixed(1)}" cy="${f.sy(b).toFixed(1)}" r="4.5"/>`;
      label = "The per-moment bound over the window, with the chosen time marked"; items = [["key-pm", "Per-moment bound"]];
      reads.innerHTML = `<div class="k-acc"><dt>Cost at tₖ</dt><dd>${S.num(c)}</dd></div><div class="k-pm"><dt>Start b(tₖ)</dt><dd>${fmt(b, 3)}</dd></div>`;
      say.textContent = S.algoSay(0, { t: tk, c, b });
    } else if (step === 1) {
      const top = kb.edges[kb.edges.length - 1];
      f = frame(chart, { x: [3e-6, top * 1.3], y: [0, Math.max(...kb.w) * 1.15], xlog: true, aspect: 0.44, minH: 170, maxH: 260 });
      g = axes(f, { yl: "weight in each bin", xl: "bin midpoint sⱼ (delay)", grid: true });
      g += Array.from(kb.s, (s, j) => `<path class="wb" d="M${f.sx(s).toFixed(1)} ${f.sy(0).toFixed(1)}V${f.sy(kb.w[j]).toFixed(1)}" stroke-width="1.4"/>`).join("");
      label = `The 240 bins of the kernel for the level ${l}, against each bin's midpoint on a log scale`; items = [["key-wb", `Kernel for ℓ = ${fmt(l, 3)}, 240 bins`]];
      reads.innerHTML = `<div class="k-wb"><dt>Level ℓ</dt><dd>${fmt(l, 3)}</dd></div><div><dt>Last edge, 14/λ₁</dt><dd>${fmt(top, 2)}</dd></div><div><dt>First bin's weight</dt><dd>${(kb.w[0] * 100).toFixed(1)}%</dd></div>`;
      say.textContent = S.algoSay(1, { b, l, top, first: kb.w[0] });
    } else if (step === 2) {
      const top = kb.edges[kb.edges.length - 1], S_MAX = Math.min(top, 2.5);
      const ss = range(0.002, S_MAX, 240), bs = ss.map((s) => boundForCost(cost(tk + s)));
      const ws = ss.map((s) => K.flux(s, l) / K.fluxTotal(l));
      const yTop = Math.max(0.4, finiteMax(bs, [a, b]) * 1.15), wTop = Math.max(...ws.slice(5)) || 1, sc = (yTop * 0.85) / wTop;
      f = frame(chart, { x: [0, S_MAX], y: [0, yTop], aspect: 0.44, minH: 170, maxH: 260 });
      g = axes(f, { yl: "per-moment bound ahead", xl: "delay s", grid: true });
      g += area(f, ss, ws.map((w) => Math.min(w * sc, yTop)), 0, "wb-fill") + line(f, ss, bs, "pm");
      g += `<path class="wb" stroke-dasharray="5 3" d="M${f.l} ${f.sy(a).toFixed(1)}H${f.W - f.r}"/><text class="tag-wb" x="${f.W - f.r}" y="${(f.sy(a) - 5).toFixed(1)}" text-anchor="end">average a = ${fmt(a, 3)}</text>`;
      label = "The per-moment bounds ahead, the kernel scaled to fit, and their weighted average"; items = [["key-pm", "B(c(tₖ + s))"], ["key-wb", "Kernel (scaled) and the average"]];
      reads.innerHTML = `<div class="k-pm"><dt>Level b</dt><dd>${fmt(b, 3)}</dd></div><div class="k-wb"><dt>Average a</dt><dd>${fmt(a, 3)}</dd></div><div><dt>Halfway, (b + a)/2</dt><dd>${fmt((a + b) / 2, 3)}</dd></div>`;
      say.textContent = S.algoSay(2, { a, b });
    } else if (step === 3) {
      const ys = [...path, ...avgs], lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.15 + 0.01;
      f = frame(chart, { x: [-0.5, 30.5], y: [Math.max(0, lo - pad), hi + pad], aspect: 0.44, minH: 170, maxH: 260 });
      g = axes(f, { yl: "level at tₖ", xl: "update", grid: true, xt: [0, 5, 10, 15, 20, 25, 30] });
      g += avgs.map((v, i) => `<path class="wb-thin" d="M${f.sx(i + 0.5).toFixed(1)} ${f.sy(v).toFixed(1)}h0.1" stroke-width="5" stroke-linecap="round"/>`).join("");
      g += line(f, path.map((_, i) => i), path, "wb-thin") + path.map((v, i) => `<circle class="${i === 30 ? "wb-dot" : "ink-dot"}" cx="${f.sx(i).toFixed(1)}" cy="${f.sy(v).toFixed(1)}" r="${i === 30 ? 4.5 : 2.4}"/>`).join("");
      label = "The level at the chosen time after each of the 30 damped updates, with each update's average"; items = [["key-ex", "Level after each update"], ["key-faint", "The average it moved toward"]];
      const last = Math.abs(path[30] - path[29]);
      reads.innerHTML = `<div class="k-wb"><dt>After 30 updates</dt><dd>${fmt(path[30], 3)}</dd></div><div><dt>Kernels used here</dt><dd>${kernels}</dd></div><div><dt>Last move</dt><dd>${S.num(last)}</dd></div>`;
      say.textContent = S.algoSay(3, { b0: path[0], b30: path[30], kernels, last });
    } else {
      if (!data) { chart.innerHTML = ""; reads.innerHTML = ""; say.textContent = ""; legend.innerHTML = ""; return; }
      const r = data, ex = r.exact, wb = shift(r.wb), pm = shift(r.pm);
      f = frame(chart, { x: [0, r.view], y: [0, Math.max(0.4, finiteMax(ex, r.wb, pm) * 1.12)], aspect: 0.44, minH: 170, maxH: 260 });
      g = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
      g += line(f, r.t, pm, "pm") + line(f, r.t, r.wb, "wb-thin") + line(f, r.t, wb, "wb") + line(f, r.t, ex, "ex");
      const k = Math.min(r.t.length - 1, Math.round(tk / 0.02));
      g += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(tk).toFixed(1)} ${f.t}V${f.H - f.b}"/><circle class="wb-dot" cx="${f.sx(r.t[k]).toFixed(1)}" cy="${f.sy(wb[k]).toFixed(1)}" r="4.5"/>`;
      label = "The rule over the window before and after the shift for checking every 0.01, beside the dynamic program"; items = [["key-ex", "Best bound"], ["key-wb", "Weighted, moved in"], ["key-faint", "Before the shift"], ["key-pm", "Per-moment, moved in"]];
      const sh = SHIFT;
      reads.innerHTML = `<div class="k-wb"><dt>Shift, Δt = 0.01</dt><dd>${fmt(sh, 3)}</dd></div><div><dt>At the paper's Δt = 0.002</dt><dd>${fmt(0.5826 * Math.sqrt(0.002), 3)}</dd></div><div class="k-wb"><dt>Rule at tₖ</dt><dd>${fmt(wb[k], 3)}</dd></div>`;
      say.textContent = S.algoSay(4, { shift: sh, t: r.t[k], x: wb[k], ex: ex[k] });
    }
    legend.innerHTML = keyList(items);
    chart.innerHTML = svg(f, g, label);
    liftReady(fig);
  };
  const run = () => {
    pick.value = choice.id;
    const dl = deadlineOf(choice), end = (dl ?? VIEW) - 0.02;
    tin.max = String(end); if (tk > end) { tk = Math.round(end / 2 / 0.02) * 0.02; tin.value = tk; }
    local = null; data = null; draw();
    state.textContent = "Solving the dynamic program for the last step…";
    const c = choice;
    rulesFor(c, null).then((r) => { if (c !== choice) return; data = r; state.textContent = "Kernels from 4000 terms of their series in 240 bins, cached by level; the program on a grid of 0.01 by 0.02."; if (step === 4) draw(); })
      .catch((e) => stopped(state, e));
  };
  follow(pick, (c) => { choice = c; run(); });
  tin.addEventListener("input", () => { tk = Math.round(+tin.value / 0.02) * 0.02; local = null; draw(); });
  onSeg(el, "al-step", (v) => { step = +v; draw(); });
  keepDrawn(chart, draw);
  run();
}

// ---------------------------------------------------------------- start
hero();
strips();
const lazy = [["tworules", twoPlate], ["iterate", iteratePlate], ["contraction", contractionPlate], ["roots", rootsPlate], ["algorithm", algorithmPlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } }); }
