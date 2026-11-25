// Chapter 9's plates. The programs and the scorer run in ch09-worker.js (ch09-model.js, on model.js's ports of the
// paper's backward_induction_x and known_reward); the trials and the overshoots are sampled here, in small batches,
// with kernel.js's seeded generator; the paper's Tables 1, 2, and 12 come from ch09-model.js, checked cell by cell
// against the generated tables. The words under each plate come from say-ch09.js.
import * as K from "./kernel.js?v=0487a934ff";
import * as M from "./ch09-model.js?v=0487a934ff";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, defaultDrawing } from "./schedules-book.js?v=0487a934ff";
import { getChoice, setChoice, solve, onVisible, watchVisible, liftReady, calm, seedParam } from "./book.js?v=0487a934ff";
import { frame, line, area, axes, svg, fmt, keepDrawn } from "./chart.js?v=0487a934ff";
import * as S from "./say-ch09.js?v=0487a934ff";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const setSeg = (el, name, v) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === String(v); });
const WORKER = new URL("./ch09-worker.js?v=0487a934ff", import.meta.url);
const run = (job, opts = {}) => solve(job, { worker: WORKER, ...opts });
const fail = (state, e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; };
const finiteMax = (arr) => arr.reduce((m, v) => (Number.isFinite(v) ? Math.max(m, v) : m), -Infinity);

// ---- the reader's schedule: a picker any plate can carry; every plate listens for the change ------------------------
const GROUPS = [...new Set(PRESETS.map((p) => p.group))];
const pickHTML = (id) => `<label class="dial pick-dial"><span class="ctl-key">Your schedule</span><span></span>
  <select class="pick" id="${id}">${GROUPS.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
function wirePick(sel) {
  sel.value = getChoice().id;
  sel.addEventListener("change", () => {
    let c;
    if (sel.value === "draw") { const g = getChoice(); c = g.id === "draw" && Array.isArray(g.points) ? g : { id: "draw", points: defaultDrawing() }; }
    else c = { id: sel.value, params: paramsOf({ id: sel.value }) };
    setChoice(c);
  });
  window.addEventListener("cc-schedule", () => { sel.value = getChoice().id; });
}
const isFlat = M.isFlat;
const keyOf = (c) => JSON.stringify(c);
/** One cell of a density map, from (x0, y0) to (x1, y1) in pixels, rounded so neighboring cells tile exactly. */
const cell = (x0, x1, y0, y1, op) => {
  const a = Math.round(Math.min(x0, x1)), b = Math.round(Math.max(x0, x1)), c = Math.round(Math.min(y0, y1)), d = Math.round(Math.max(y0, y1));
  return b > a && d > c ? `<rect class="dens" x="${a}" y="${c}" width="${b - a}" height="${d - c}" fill-opacity="${op.toFixed(2)}"/>` : "";
};
const shade = (d) => Math.min(0.85, 0.06 + 0.62 * Math.sqrt(d / 1.2));

// the density job is shared by the hero, the density plate, and the trials plate: one run per schedule
const DENSITY = new Map();
function density(choice, only = null, fine = false) {
  const k = keyOf(choice) + (only ? "|" + only.join(",") : "") + (fine ? "|fine" : "");
  if (!DENSITY.has(k)) DENSITY.set(k, run({ job: "density", choice, only, fine }).catch((e) => { DENSITY.delete(k); throw e; }));
  return DENSITY.get(k);
}

// ---------------------------------------------------------------- the hero: Figure 1(a)'s density, pushed forward
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const choice = { id: "jump", params: { at: 0.5, factor: 16 } };
  const times = [0.2, 0.45, 0.6, 0.9, 1.5, 2.5];
  let data = null, cur = 2;
  const cum = (P, t) => { let up = 0, lo = 0; const kk = Math.round(t / M.DT); for (let k = 1; k <= kk; k++) { up += P.upAt[k]; lo += P.loAt[k]; } return { up, lo }; };
  const draw = (i) => {
    cur = i;
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(240, W * 0.62)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const l = 12, r = 10, T = 2.5, split = Math.round(H * 0.64);
    const sx = (t) => l + (t / T) * (W - l - r);
    const xr = 1.5, y0 = 18, y1 = split - 8;
    const sy = (x) => y0 + ((xr - x) / (2 * xr)) * (y1 - y0);
    let s = `<text class="lab" x="${l}" y="11">the evidence, pushed forward between the bound's edges</text>`;
    if (!data) {
      s += `<text class="tk" x="${(W / 2).toFixed(0)}" y="${(split / 2).toFixed(0)}" text-anchor="middle">solving the best bound…</text>`;
      el.innerHTML = s; return;
    }
    const P = data.policies.best, t1 = times[i];
    // the density, as cells: darker where more trials are still deciding with that evidence
    const nb = P.M, step = 3, hx = (step * P.h) / 2;
    s += `<g shape-rendering="crispEdges">`;
    for (let j = 2; j < P.snapK.length; j += 2) {
      const t = data.ts[P.snapK[j]];
      if (t > t1 + 1e-9) break;
      for (let q = -nb; q <= nb; q += step) {
        const x = q * P.h; if (Math.abs(x) > xr) continue;
        const d = P.snaps[j * (2 * nb + 1) + q + nb];
        if (d >= 0.02) s += cell(sx(t - 0.04), sx(t), sy(x + hx), sy(x - hx), shade(d));
      }
    }
    s += `</g>`;
    const ts = data.ts.filter((t) => t <= T + 1e-9), b = ts.map((t, k) => Math.min(P.bound[k], xr));
    const path = (sgn) => ts.map((t, k) => `${k ? "L" : "M"}${sx(t).toFixed(1)} ${sy(sgn * b[k]).toFixed(1)}`).join("");
    s += `<path class="ex" d="${path(1)}"/><path class="ex" d="${path(-1)}"/>`;
    s += `<path class="ax" d="M${l} ${sy(0).toFixed(1)}H${W - r}"/>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${sx(t1).toFixed(1)} ${split + 10}V${H - 20}"/>`;
    // below: the share decided so far, correctly (ink) and wrongly (slate)
    const by = split + 16, bh = H - 22 - by;
    const share = ts.map((t) => cum(P, t));
    const upto = ts.filter((t) => t <= t1 + 1e-9).length;
    const sb = (v) => by + bh - v * bh;
    let dU = "", dL = "";
    for (let k = 0; k < upto; k++) { dU += `${k ? "L" : "M"}${sx(ts[k]).toFixed(1)} ${sb(share[k].up).toFixed(1)}`; }
    if (upto) {
      s += `<path class="ex-fill" d="${dU}L${sx(ts[upto - 1]).toFixed(1)} ${sb(0)}L${sx(0)} ${sb(0)}Z"/>`;
      for (let k = 0; k < upto; k++) dL += `${k ? "L" : "M"}${sx(ts[k]).toFixed(1)} ${sb(share[k].up + share[k].lo).toFixed(1)}`;
      for (let k = upto - 1; k >= 0; k--) dL += `L${sx(ts[k]).toFixed(1)} ${sb(share[k].up).toFixed(1)}`;
      s += `<path class="pm-fill" d="${dL}Z"/>`;
    }
    s += `<path class="ax" d="M${l} ${sb(0)}H${W - r}M${l} ${sb(1).toFixed(1)}H${W - r}"/>`;
    s += `<text class="lab" x="${l}" y="${by - 4}">decided so far: correctly (ink), wrongly (slate)</text>`;
    s += `<text class="tk" x="${sx(0)}" y="${H - 6}">0</text><text class="tk" x="${sx(T)}" y="${H - 6}" text-anchor="end">time ${T}</text>`;
    s += `<text class="tk" x="${(sx(0.5) + 4).toFixed(1)}" y="${(y0 + 10).toFixed(1)}">16-fold rise, centered at 0.5</text><path class="acc" stroke-dasharray="2 3" d="M${sx(0.5).toFixed(1)} ${y0}V${y1}"/>`;
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  const label = (i) => { if (!data) return "Solving the best bound…"; const c = cum(data.policies.best, times[i]); return S.heroLabel(times[i], c.up, c.lo); };
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: times.length, draw, label });
  onVisible(fig, () => {
    density(choice, ["best"]).then((m) => {
      data = m; draw(cur);
      const lab = fig.querySelector(".proof-label"); if (lab) lab.textContent = label(cur);
    }).catch(() => { /* the hero keeps its note */ });
  }, "200px");
}

// ---------------------------------------------------------------- plate: backward from the forced choice
function backwardPlate() {
  const fig = plate("backward"), el = rootOf("backward");
  if (!el) return;
  el.innerHTML = `<div class="controls">${pickHTML("bk-pick")}</div>
    <p class="fine" id="bk-note"></p>
    <div class="chart-wrap" id="bk-top"></div>
    <ul class="legend"><li><span class="key key-dim">Decide now, max(g, 1 − g)</span></li><li><span class="key key-ex">Best of deciding and waiting, V</span></li><li><span class="key key-wait">What waiting adds</span></li></ul>
    <div class="controls"><label class="dial grow"><span class="ctl-key">Steps back from the end</span><output id="bk-out"></output>
      <input type="range" id="bk-j" min="0" max="1" step="1" value="0" aria-label="How many steps back from the end"></label>
      <div class="actions"><button class="btn" type="button" id="bk-play" aria-pressed="false">Play</button></div></div>
    <div class="chart-wrap" id="bk-bot"></div>
    <dl class="reads" id="bk-reads"></dl><p class="say" id="bk-say" aria-live="polite"></p><p class="fine" id="bk-floor"></p><p class="fine" id="bk-state" aria-live="polite"></p>`;
  const top = $("#bk-top", el), bot = $("#bk-bot", el), reads = $("#bk-reads", el), say = $("#bk-say", el), state = $("#bk-state", el);
  const note = $("#bk-note", el), inp = $("#bk-j", el), out = $("#bk-out", el), play = $("#bk-play", el);
  wirePick($("#bk-pick", el));
  let data = null, j = 0, gen = 0, playing = false, visible = false, raf = 0, t0 = 0, j0 = 0;
  const g = (x) => 1 / (1 + Math.exp(-2 * x));
  const sliceAt = (jj) => {
    const { keepK, M: Mn, adv, h } = data;
    const xs = [], dec = [], V = [];
    for (let i = 0; i <= Mn; i++) { const x = i * h, d = Math.max(g(x), 1 - g(x)), a = adv[jj * (Mn + 1) + i]; xs.push(x); dec.push(d); V.push(d + Math.max(a, 0)); }
    return { k: keepK[jj], xs, dec, V, a0: adv[jj * (Mn + 1)] };
  };
  const drawTop = () => {
    if (!data) { top.innerHTML = ""; return; }
    const sl = sliceAt(j), b = data.bounds[sl.k];
    const xr = data.xr;
    const n = sl.xs.findIndex((x) => x > xr + 1e-9), cut = n < 0 ? sl.xs.length : n;
    const xs = sl.xs.slice(0, cut), dec = sl.dec.slice(0, cut), V = sl.V.slice(0, cut);
    const f = frame(top, { x: [0, xr], y: [0.5, 1], aspect: 0.42, minH: 160, maxH: 230 });
    let s = axes(f, { yl: "value", xl: "evidence, x", grid: true, yt: [0.5, 0.75, 1] });
    let d = `M${f.sx(0)} ${f.sy(dec[0]).toFixed(1)}`;
    xs.forEach((x, i) => { d += `L${f.sx(x).toFixed(1)} ${f.sy(V[i]).toFixed(1)}`; });
    for (let i = xs.length - 1; i >= 0; i--) d += `L${f.sx(xs[i]).toFixed(1)} ${f.sy(dec[i]).toFixed(1)}`;
    s += `<path class="wait-fill" d="${d}Z"/>`;
    s += line(f, xs, dec, "dim") + line(f, xs, V, "ex");
    if (Number.isFinite(b) && b <= xr) {
      const yb = Math.max(g(b), 1 - g(b));
      s += `<circle class="ink-dot" cx="${f.sx(b).toFixed(1)}" cy="${f.sy(yb).toFixed(1)}" r="4.5"/>`;
      s += `<text class="tag-ex" x="${(f.sx(b) + (f.sx(b) > f.W * 0.7 ? -7 : 7)).toFixed(1)}" y="${(f.sy(yb) + 16).toFixed(1)}" text-anchor="${f.sx(b) > f.W * 0.7 ? "end" : "start"}">bound ${fmt(b, 3)}</text>`;
    }
    top.innerHTML = svg(f, s, `At time ${data.ts[sl.k].toFixed(2)}: the value of deciding now and the best of deciding and waiting, against the evidence`);
  };
  const drawBot = () => {
    if (!data) { bot.innerHTML = ""; return; }
    const { ts, bounds, horizon, keepK } = data;
    const k = keepK[j], yTop = data.yTop;
    const f = frame(bot, { x: [0, horizon], y: [0, yTop], aspect: 0.4, minH: 160, maxH: 230 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    const tsC = [], bC = [];
    for (let q = k; q < ts.length; q++) { tsC.push(ts[q]); bC.push(Number.isFinite(bounds[q]) ? Math.min(bounds[q], yTop) : yTop); }
    if (tsC.length > 1) s += area(f, tsC, bC, 0, "wait-fill") + line(f, tsC, bC, "ex");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(ts[k]).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    if (!data.deadline && horizon > M.WINDOW) s += `<path class="dim" d="M${f.sx(0).toFixed(1)} ${f.t + 3}H${f.sx(M.WINDOW).toFixed(1)}"/><text class="tk" x="${f.sx(M.WINDOW / 2).toFixed(1)}" y="${f.t + 14}" text-anchor="middle">window</text>`;
    s += `<text class="tag-ex" x="${(f.W - f.r - 2).toFixed(1)}" y="${(f.t + 14).toFixed(1)}" text-anchor="end">${data.deadline ? "deadline" : "forced choice"}</text><path class="ex" d="M${(f.W - f.r - 1).toFixed(1)} ${(f.t + 19).toFixed(1)}V${(f.sy(0) - 3).toFixed(1)}" stroke-dasharray="1 3"/>`;
    if (k > 0) s += `<text class="tk" x="${(f.sx(ts[k] / 2)).toFixed(1)}" y="${(f.sy(yTop / 2)).toFixed(1)}" text-anchor="middle">not computed yet</text>`;
    bot.innerHTML = svg(f, s, `The bound computed so far, from the ${data.deadline ? "deadline" : "forced choice"} back to time ${ts[k].toFixed(2)}`);
  };
  const draw = () => {
    if (!data) return;
    inp.value = j;
    const k = data.keepK[j], t = data.ts[k], b = data.bounds[k];
    out.textContent = `${Math.round((data.ts.length - 1 - k))} of ${data.ts.length - 1}, time ${t.toFixed(2)}`;
    drawTop(); drawBot();
    const sl = sliceAt(j);
    reads.innerHTML = `<div><dt>Time</dt><dd>${t.toFixed(2)}</dd></div>
      <div><dt>Bound b(t)</dt><dd>${Number.isFinite(b) ? fmt(b, 3) : "above 5"}</dd></div>
      <div><dt>Waiting adds, at x = 0</dt><dd>${fmt(Math.max(sl.a0, 0), 3)}</dd></div>`;
    say.textContent = S.backwardSay(t, b, Math.max(sl.a0, 0), data.horizon, data.deadline !== null, M.CAP, data.h);
    liftReady(fig);
  };
  const stopPlay = () => { playing = false; cancelAnimationFrame(raf); raf = 0; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); };
  const loop = (now) => {
    raf = 0;
    if (!playing || !visible || !data) return;
    if (!t0) { t0 = now; j0 = j; }
    const last = data.keepK.length - 1;
    j = Math.min(last, j0 + Math.round(((now - t0) / 7000) * last));
    draw();
    if (j >= last) { stopPlay(); return; }
    raf = requestAnimationFrame(loop);
  };
  const startPlay = () => { if (!data || calm.matches) return; if (j >= data.keepK.length - 1) j = 0; playing = true; t0 = 0; play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); if (visible && !raf) raf = requestAnimationFrame(loop); };
  play.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
  inp.addEventListener("input", () => { stopPlay(); j = +inp.value; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && playing && !raf) { t0 = 0; raf = requestAnimationFrame(loop); } });
  const go = () => {
    const my = ++gen, choice = getChoice();
    stopPlay(); data = null; top.innerHTML = ""; bot.innerHTML = ""; reads.innerHTML = ""; say.textContent = "";
    const dl = deadlineOf(choice), cost = costOf(choice);
    note.textContent = S.scheduleNote(dl !== null ? "deadline" : isFlat(cost) ? "constant" : "", labelOf(choice));
    state.textContent = "Solving the program backward…";
    run({ job: "backward", choice }, { key: "ch09-backward" }).then((m) => {
      if (my !== gen) return;
      const fin = Array.from(m.bounds).filter(Number.isFinite);
      const bMax = fin.length ? Math.max(...fin) : 1;
      data = { ...m, xr: Math.max(1.5, Math.min(3.2, bMax * 1.3 + 0.2)), yTop: Math.max(0.5, Math.min(M.CAP, bMax * 1.12)) };
      inp.max = String(m.keepK.length - 1);
      state.textContent = `Every slice is computed from the one after it: checks every ${m.dt} time units, an evidence grid of ${m.h}, the choice forced at ${m.horizon}.`;
      j = calm.matches ? m.keepK.length - 1 : 0;
      keepDrawn(top, draw);
      if (!calm.matches) startPlay();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  go();
  run({ job: "floor" }).then((m) => { $("#bk-floor", el).textContent = S.floorSay(m.loss, m.undecided, M.PAPER.HorizonFloor); }).catch(() => {});
}

// ---------------------------------------------------------------- plate: the density, pushed forward
function densityPlate() {
  const fig = plate("density"), el = rootOf("density");
  if (!el) return;
  el.innerHTML = `<div class="controls">${pickHTML("dn-pick")}${segHTML("dn-pol", [["best", "Best bound"], ["pm", "Per-moment"], ["wb", "Weighted"]], "best", "The policy scored")}</div>
    <div class="chart-wrap" id="dn-map"></div>
    <div class="controls"><label class="dial grow"><span class="ctl-key">Time</span><output id="dn-out"></output>
      <input type="range" id="dn-t" min="0" max="1" step="1" value="0" aria-label="Time"></label>
      <div class="actions"><button class="btn" type="button" id="dn-play" aria-pressed="false">Play</button></div></div>
    <div class="chart-wrap" id="dn-rate"></div>
    <ul class="legend"><li><span class="key key-fill">Decided correctly</span></li><li><span class="key key-pm-fill">Decided wrongly</span></li></ul>
    <dl class="reads" id="dn-reads"></dl><p class="say" id="dn-say" aria-live="polite"></p><p class="fine" id="dn-state" aria-live="polite"></p>`;
  const map = $("#dn-map", el), rate = $("#dn-rate", el), reads = $("#dn-reads", el), say = $("#dn-say", el), state = $("#dn-state", el);
  const inp = $("#dn-t", el), out = $("#dn-out", el), play = $("#dn-play", el);
  wirePick($("#dn-pick", el));
  let data = null, pol = "best", j = 0, gen = 0, playing = false, visible = false, raf = 0, t0 = 0, j0 = 0;
  const CLS = { best: "ex", pm: "pm", wb: "wb" };
  // at a deadline, every trial still deciding at its last step decides there: at the bound, or by the sign of the
  // evidence (endUp, endLo); those decisions are counted together as the forced choice, a point mass
  const forcedK = () => (data.deadline === null ? null : data.ts.length - 1);
  const cumAt = (P, k) => M.decidedBy(P, k, forcedK());
  const drawMap = () => {
    if (!data) { map.innerHTML = ""; return; }
    const P = data.policies[pol], view = data.view, xr = data.xr, kNow = P.snapK[j];
    const f = frame(map, { x: [0, view], y: [-xr, xr], aspect: 0.5, minH: 190, maxH: 280 });
    let s = axes(f, { yl: "evidence, x", xl: "time", grid: false, zero: true });
    const nb = P.M, step = Math.max(1, Math.round(0.04 / P.h));
    const hx = (step * P.h) / 2;
    s += `<g shape-rendering="crispEdges">`;
    for (let q = 1; q <= j && q < P.snapK.length; q++) {
      const t = data.ts[P.snapK[q]], t0p = data.ts[P.snapK[q - 1]];
      for (let i = -nb; i <= nb; i += step) {
        const x = i * P.h; if (Math.abs(x) > xr) continue;
        const d = P.snaps[q * (2 * nb + 1) + i + nb];
        if (d >= 0.01) s += cell(f.sx(t0p), f.sx(t), f.sy(x + hx), f.sy(x - hx), shade(d));
      }
    }
    s += `</g>`;
    const ts = [], b = [];
    for (let k = 0; k < data.ts.length && data.ts[k] <= view + 1e-9; k++) { ts.push(data.ts[k]); b.push(Math.min(P.bound[k], xr)); }
    s += line(f, ts, b, CLS[pol]) + line(f, ts, b.map((v) => -v), CLS[pol]);
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(data.ts[kNow]).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    s += `<text class="tk" x="${(f.W - f.r - 2)}" y="${(f.t + 10)}" text-anchor="end">past +b: correct</text><text class="tk" x="${(f.W - f.r - 2)}" y="${(f.H - f.b - 5)}" text-anchor="end">past −b: wrong</text>`;
    map.innerHTML = svg(f, s, `The density of the evidence under ${pol === "best" ? "the best bound" : pol === "pm" ? "the per-moment rule" : "the weighted rule"}, pushed forward to time ${data.ts[kNow].toFixed(2)}`);
  };
  const drawRate = () => {
    if (!data) { rate.innerHTML = ""; return; }
    const P = data.policies[pol], view = data.view, kNow = P.snapK[j];
    // the rate of deciding, per unit time, over pairs of steps (and a last single step before an even deadline); the
    // forced choice is a point mass, marked apart from the rate scale below
    let kEnd = 0;
    while (kEnd + 1 < data.ts.length && data.ts[kEnd + 1] <= view + 1e-9) kEnd++;
    const R = M.rateBins(P, data.ts, kEnd, forcedK()), F = R.forced;
    const ts = R.t, up = R.up, lo = R.lo.map((v) => -v);
    // at a deadline, room above the curve for the forced choice's two lines of text
    const hi = Math.max(0.5, finiteMax(up)), dn = Math.max(0.1, -Math.min(...lo, 0));
    const f = frame(rate, { x: [0, view], y: [-dn * 1.1, hi * (F ? 1.6 : 1.08)], aspect: 0.36, minH: 150, maxH: 210 });
    let s = axes(f, { yl: "decided per unit time", xl: "time", grid: true, zero: true, fy: (v) => String(+Math.abs(v).toFixed(3)) });
    const n = ts.filter((t) => t <= data.ts[kNow] + 1e-9).length;
    if (n > 1) s += area(f, ts.slice(0, n), up.slice(0, n), 0, "ex-fill") + area(f, ts.slice(0, n), lo.slice(0, n), 0, "pm-fill");
    s += line(f, ts, up, "ex-thin") + line(f, ts, lo, "ex-thin");
    s += `<path class="dim" stroke-dasharray="2 3" d="M${f.sx(data.ts[kNow]).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
    let note = "";
    if (F && kNow >= F.k) {
      // a share of all trials, not a rate: a dotted line at the deadline, with the shares written beside it
      const X = f.sx(F.t).toFixed(1), pc = (x) => `${(100 * x).toFixed(1)}%`;
      s += `<path class="guide" d="M${X} ${f.t}V${(f.H - f.b).toFixed(1)}"/>`;
      s += `<text class="tag-ex" x="${(+X - 6).toFixed(1)}" y="${f.t + 10}" text-anchor="end">forced at the deadline (a share):</text>`;
      s += `<text class="tk" x="${(+X - 6).toFixed(1)}" y="${f.t + 23}" text-anchor="end">${pc(F.up)} correct, ${pc(F.lo)} wrong</text>`;
      note = `; at the deadline, a dotted line marks the forced choice, ${(100 * F.up).toFixed(1)}% of trials correct and ${(100 * F.lo).toFixed(1)}% wrong, a share and not a rate`;
    }
    rate.innerHTML = svg(f, s, `How many trials decide per unit time, correctly above the axis and wrongly below it${note}`);
  };
  const draw = () => {
    if (!data) return;
    const P = data.policies[pol], k = P.snapK[j], t = data.ts[k];
    inp.value = j; out.textContent = t.toFixed(2);
    drawMap(); drawRate();
    const c = cumAt(P, k);
    reads.innerHTML = `<div class="k-ex"><dt>Correct by ${t.toFixed(2)}</dt><dd>${(c.up * 100).toFixed(1)}%</dd></div>
      <div class="k-pm"><dt>Wrong by ${t.toFixed(2)}</dt><dd>${(c.lo * 100).toFixed(1)}%</dd></div>
      <div><dt>Whole trial: correct</dt><dd>${(P.p * 100).toFixed(2)}%<small>mean time ${fmt(P.rt, 3)}</small></dd></div>
      <div><dt>Reward</dt><dd>${fmt(P.reward, 4)}<small>correct − cost ${fmt(P.paid, 4)}</small></dd></div>`;
    say.textContent = S.densitySay(pol, t, c.up, c.lo, P, c.forced);
    liftReady(fig);
  };
  const stopPlay = () => { playing = false; cancelAnimationFrame(raf); raf = 0; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); };
  const loop = (now) => {
    raf = 0;
    if (!playing || !visible || !data) return;
    if (!t0) { t0 = now; j0 = j; }
    const last = data.policies[pol].snapK.length - 1;
    j = Math.min(last, j0 + Math.round(((now - t0) / 6000) * last));
    draw();
    if (j >= last) { stopPlay(); return; }
    raf = requestAnimationFrame(loop);
  };
  const startPlay = () => { if (!data || calm.matches) return; if (j >= data.policies[pol].snapK.length - 1) j = 0; playing = true; t0 = 0; play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); if (visible && !raf) raf = requestAnimationFrame(loop); };
  play.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
  inp.addEventListener("input", () => { stopPlay(); j = +inp.value; draw(); });
  onSeg(el, "dn-pol", (v) => { pol = v; draw(); });
  watchVisible(fig, (v) => { visible = v; if (v && playing && !raf) { t0 = 0; raf = requestAnimationFrame(loop); } });
  const go = () => {
    const my = ++gen, choice = getChoice();
    stopPlay(); data = null; map.innerHTML = ""; rate.innerHTML = ""; reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the program and pushing three densities forward…";
    density(choice).then((m) => {
      if (my !== gen) return;
      let bMax = 0;
      for (const P of Object.values(m.policies)) for (let k = 0; k < m.ts.length && m.ts[k] <= m.view + 1e-9; k++) if (Number.isFinite(P.bound[k])) bMax = Math.max(bMax, Math.min(P.bound[k], M.CAP));
      data = { ...m, xr: Math.max(0.8, Math.min(3, bMax * 1.15 + 0.1)) };
      inp.max = String(m.policies.best.snapK.length - 1);
      state.textContent = `No trial is simulated: the density moves on the evidence grid (step ${M.H}) every ${M.DT} time units, ${m.deadline !== null ? "to the deadline" : `to the forced choice at ${m.horizon}`}; the plot stops at ${m.view}.`;
      j = calm.matches ? data.policies.best.snapK.length - 1 : 0;
      keepDrawn(map, draw);
      if (!calm.matches) startPlay();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  go();
}

// ---------------------------------------------------------------- plate: how many trials?
function trialsPlate() {
  const fig = plate("trials"), el = rootOf("trials");
  if (!el) return;
  const TARGET = 2e-5;   // a loss of 0.002 points per 100 trials, as a reward
  el.innerHTML = `<div class="predict" id="tr-predict"><p>How many simulated trials would pin one rule's mean reward down to 0.002 points per 100 trials (one standard error)?</p>
      <label class="dial grow"><span class="ctl-key">Your guess</span><output id="tr-gout"></output>
      <input type="range" id="tr-g" min="3" max="11" step="0.25" value="6" aria-label="Your guess, as a power of ten"></label>
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="tr-show">Show me</button></div>
      <p class="verdict" id="tr-verdict" aria-live="polite"></p></div>
    <div class="controls">${pickHTML("tr-pick")}<div class="actions"><button class="btn" type="button" id="tr-more">Run 10 times as many</button></div></div>
    <div class="chart-wrap" id="tr-chart"></div>
    <ul class="legend"><li><span class="key key-ex">The density's score, on this page's grid</span></li><li><span class="key key-dim">Average of the trials, ± 2 standard errors</span></li></ul>
    <dl class="reads" id="tr-reads"></dl><p class="say" id="tr-say" aria-live="polite"></p><p class="fine" id="tr-state" aria-live="polite"></p>`;
  const chart = $("#tr-chart", el), reads = $("#tr-reads", el), say = $("#tr-say", el), state = $("#tr-state", el), verdict = $("#tr-verdict", el);
  const gIn = $("#tr-g", el), gOut = $("#tr-gout", el), more = $("#tr-more", el);
  wirePick($("#tr-pick", el));
  let gen = 0, exact = null, fineScore = null, bound = null, ts = null, cost = null, acc = null, R = null, goal = 100000, timer = 0, visible = false, pts = [], guess = null, shown = false;
  const seed = seedParam(2026);
  const guessN = () => 10 ** +gIn.value;
  const showGuess = () => { gOut.textContent = "about " + S.count(guessN()); };
  showGuess();
  const draw = () => {
    if (exact === null || !pts.length) { chart.innerHTML = ""; return; }
    const ys = pts.flatMap((p) => [p.mean - 2 * p.se, p.mean + 2 * p.se]).concat([exact]);
    const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.08 + 1e-4;
    const f = frame(chart, { x: [100, Math.max(1e5, goal)], y: [lo - pad, hi + pad], xlog: true, aspect: 0.5, minH: 180, maxH: 260, l: 48 });
    // the band between the two edges
    let d = "";
    pts.forEach((p, i) => { d += `${i ? "L" : "M"}${f.sx(p.n).toFixed(1)} ${f.sy(p.mean + 2 * p.se).toFixed(1)}`; });
    for (let i = pts.length - 1; i >= 0; i--) d += `L${f.sx(pts[i].n).toFixed(1)} ${f.sy(pts[i].mean - 2 * pts[i].se).toFixed(1)}`;
    let s = axes(f, { yl: "average reward", xl: "trials", grid: true, fy: (v) => v.toFixed(3) }) + `<path class="se-band" d="${d}Z"/>`;
    s += line(f, pts.map((p) => p.n), pts.map((p) => p.mean), "dim");
    s += `<path class="ex" d="M${f.l} ${f.sy(exact).toFixed(1)}H${f.W - f.r}"/>`;
    chart.innerHTML = svg(f, s, "The average reward of the simulated trials as they accumulate, with two standard errors, beside the density's exact score");
    liftReady(fig);
  };
  const report = () => {
    if (!acc || !acc.n) return;
    const st = M.trialStats(acc), need = M.trialsFor(st.sd, TARGET);
    reads.innerHTML = `<div class="k-ex"><dt>Density's score</dt><dd>${fmt(exact, 5)}<small>no sampling error; ${fmt(fineScore, 5)} on a grid four times finer</small></dd></div>
      <div><dt>Trials so far</dt><dd>${S.count(st.n)}<small>${fmt(st.mean, 5)} ± ${fmt(2 * st.se, 5)}</small></dd></div>
      <div><dt>Spread of one trial</dt><dd>${fmt(st.sd, 3)}</dd></div>
      <div class="k-acc"><dt>Trials for a standard error of 2 × 10⁻⁵</dt><dd>${shown ? "about " + S.count(need) : "–"}<small>${shown ? "(spread ÷ 0.00002)²" : "press Show me"}</small></dd></div>`;
    say.textContent = S.trialsSay(st.n, st.mean, st.se, exact, fineScore, st.sd, TARGET, shown ? need : null);
    if (shown) verdict.textContent = S.trialsVerdict(guess, need);
  };
  const step = () => {
    timer = 0;
    if (!acc || !visible || acc.n >= goal) return;
    const t1 = performance.now();
    while (acc.n < goal && performance.now() - t1 < 25) {
      // run to the next checkpoint (100, then each about 1.25 times the last), and record the average there
      const next = Math.min(goal, acc.n < 100 ? 100 : Math.ceil(acc.n * 1.25));
      M.trials(bound, ts, cost, next - acc.n, R, acc);
      const st = M.trialStats(acc);
      pts.push({ n: st.n, mean: st.mean, se: st.se });
    }
    draw(); report();
    if (acc.n < goal) timer = setTimeout(step, 16);
    else state.textContent = `${S.count(acc.n)} trials with the scorer's checks (every ${M.DT}), bound, and payoffs, but continuous evidence; seed ${seed} (add ?seed= to the address for another).`;
  };
  const kick = () => { if (!timer && visible && acc && acc.n < goal) timer = setTimeout(step, 0); };
  const CAP_N = 1e7;
  more.addEventListener("click", () => {
    if (goal >= CAP_N) return;
    goal = Math.min(goal * 10, CAP_N); more.disabled = goal >= CAP_N;
    state.textContent = "Running more trials…"; kick();
  });
  gIn.addEventListener("input", () => { guess = guessN(); showGuess(); if (shown) report(); });
  $("#tr-show", el).addEventListener("click", () => { shown = true; report(); });
  watchVisible(fig, (v) => { visible = v; kick(); });
  const go = () => {
    const my = ++gen, choice = getChoice();
    clearTimeout(timer); timer = 0; exact = null; fineScore = null; acc = null; pts = []; goal = 100000; more.disabled = false; chart.innerHTML = ""; reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the best bound…";
    density(choice, ["best"], true).then((m) => {
      if (my !== gen) return;
      cost = costOf(choice); ts = m.ts; bound = m.policies.best.bound; exact = m.policies.best.reward; fineScore = m.policies.best.fineReward;
      R = K.rng(seed); acc = { n: 0, sum: 0, sq: 0 };
      state.textContent = "Simulating trials…";
      keepDrawn(chart, draw);
      kick();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  go();
}

// ---------------------------------------------------------------- plate: past the bound between checks
function overshootPlate() {
  const fig = plate("overshoot"), el = rootOf("overshoot");
  if (!el) return;
  const DTS = [0.04, 0.01, 0.0025, 0.000625], N = 8000, b = K.B(0.1);
  const seed = seedParam(2026);
  el.innerHTML = `<div class="predict" id="os-predict"><p>If the evidence is checked only every Δt, where should a bound set for continuous watching go?</p>
      ${segHTML("os-guess", [["out", "Further out"], ["stay", "Where it is"], ["in", "Further in"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="os-show">Show me</button></div>
      <p class="verdict" id="os-verdict" aria-live="polite"></p></div>
    <div id="os-body" hidden>
    <div class="controls">${segHTML("os-dt", DTS.map((d) => [d, String(d)]), 0.04, "Checked every Δt")}<div class="actions"><button class="btn" type="button" id="os-new">Another run</button></div></div>
    <div class="chart-wrap" id="os-path"></div>
    <ul class="legend"><li><span class="key key-dim">The evidence between checks</span></li><li><span class="key key-ink-dots">What the checks see</span></li><li><span class="key key-acc">How far past the bound</span></li></ul>
    <div class="chart-wrap" id="os-stats"></div>
    <dl class="reads" id="os-reads"></dl><p class="say" id="os-say" aria-live="polite"></p></div>`;
  const pathEl = $("#os-path", el), statsEl = $("#os-stats", el), reads = $("#os-reads", el), say = $("#os-say", el), verdict = $("#os-verdict", el), body = $("#os-body", el);
  let dt = 0.04, guess = null, shown = false, runN = 0, onePath = null, timer = 0, visible = false;
  const stats = new Map();   // dt -> { R, sum, sq, n }
  const newPath = () => { onePath = M.onePath(b, dt, K.rng(seed + 101 + runN * 7 + Math.round(dt * 1e6))); };
  const drawPath = () => {
    const P = onePath, s0 = P.side;
    // the window, the fine path, and the checks all come from overshootView, which takes its start from firstPastMark
    const V = M.overshootView(P, dt), { mk, tBeg, tEnd } = V, fp = V.path, cp = V.checks;
    const ys = fp.map((p) => s0 * p[1]);
    const lo = Math.min(...ys, b - 0.1), hi = Math.max(...ys, b + 0.05);
    const pad = (hi - lo) * 0.08;
    const f = frame(pathEl, { x: [tBeg, tEnd + dt * 0.6], y: [lo - pad, hi + pad], aspect: 0.5, minH: 180, maxH: 250 });
    let s = axes(f, { yl: s0 > 0 ? "evidence, x" : "evidence, −x", xl: "time", grid: true, fx: (v) => String(+v.toFixed(3)) });
    s += `<path class="bound-line" d="M${f.l} ${f.sy(b).toFixed(1)}H${f.W - f.r}"/><text class="tag-ex" x="${f.l + 4}" y="${(f.sy(b) - 5).toFixed(1)}">bound ${fmt(b, 3)}</text>`;
    s += line(f, fp.map((p) => p[0]), ys, "dim");
    for (const c of cp) s += `<circle class="ink-dot" cx="${f.sx(c[0]).toFixed(1)}" cy="${f.sy(s0 * c[1]).toFixed(1)}" r="3.2"/>`;
    const st = P.stop, over = s0 * st[1] - b;
    s += `<path class="acc" stroke-width="2.6" d="M${f.sx(st[0]).toFixed(1)} ${f.sy(b).toFixed(1)}V${f.sy(s0 * st[1]).toFixed(1)}"/>`;
    s += `<text class="tag-acc" x="${(f.sx(st[0]) - 6).toFixed(1)}" y="${(f.sy(s0 * st[1]) - 6).toFixed(1)}" text-anchor="end">past by ${fmt(over, 3)}</text>`;
    if (mk.kind === "ring") {
      const fx = f.sx(mk.t), right = fx < f.W * 0.6;
      s += `<circle class="ring-ex" cx="${fx.toFixed(1)}" cy="${f.sy(s0 * P.first[1]).toFixed(1)}" r="4"/><text class="tk" x="${(fx + (right ? 6 : -6)).toFixed(1)}" y="${(f.sy(b) + 14).toFixed(1)}" text-anchor="${right ? "start" : "end"}">first fine step past it, unseen</text>`;
    } else if (mk.kind === "earlier") {
      s += `<text class="tk" x="${f.l + 4}" y="${(f.sy(b) + 14).toFixed(1)}">first fine step past it: earlier, at ${String(+mk.t.toFixed(4))}</text>`;
    }
    pathEl.innerHTML = svg(f, s, `One run checked every ${dt}: the evidence between checks, the checks, and how far past the bound it is when a check first sees it there`);
  };
  const drawStats = () => {
    if (!shown) return;
    const f = frame(statsEl, { x: [0.0004, 0.06], y: [0.5, 0.7], xlog: true, aspect: 0.42, minH: 160, maxH: 220 });
    let s = axes(f, { yl: "mean overshoot ÷ √Δt", xl: "Δt", grid: true, yt: [0.5, 0.55, 0.6, 0.65, 0.7] });
    s += `<path class="guide" d="M${f.l} ${f.sy(M.OVERSHOOT).toFixed(1)}H${f.W - f.r}"/><text class="tk" x="${f.W - f.r - 2}" y="${(f.sy(M.OVERSHOOT) + 14).toFixed(1)}" text-anchor="end">0.5826, the leading-order constant</text>`;
    for (const d of DTS) {
      const a = stats.get(d); if (!a || a.n < 50) continue;
      const m = a.sum / a.n, se = Math.sqrt(Math.max(0, a.sq / a.n - m * m) / a.n), r = Math.sqrt(d);
      const X = f.sx(d);
      s += `<path class="ex" d="M${X.toFixed(1)} ${f.sy((m - 2 * se) / r).toFixed(1)}V${f.sy((m + 2 * se) / r).toFixed(1)}"/><circle class="${d === dt ? "acc-dot" : "ink-dot"}" cx="${X.toFixed(1)}" cy="${f.sy(m / r).toFixed(1)}" r="4"/>`;
    }
    statsEl.innerHTML = svg(f, s, "The runs' mean overshoot divided by the square root of the time step, against the time step, with two standard errors, beside 0.5826");
  };
  const report = () => {
    const a = stats.get(dt);
    if (!a || !a.n) { reads.innerHTML = ""; say.textContent = "Sampling runs…"; return; }
    const m = a.sum / a.n, se = Math.sqrt(Math.max(0, a.sq / a.n - m * m) / a.n);
    reads.innerHTML = `<div class="k-acc"><dt>Mean overshoot</dt><dd>${fmt(m, 4)}<small>± ${fmt(2 * se, 4)}, ${S.count(a.n)} runs</small></dd></div>
      <div><dt>÷ √Δt</dt><dd>${fmt(m / Math.sqrt(dt), 3)}</dd></div><div><dt>Leading order</dt><dd>0.5826</dd></div>`;
    say.textContent = S.overshootSay(dt, m, se, a.n);
  };
  const draw = () => { if (!shown) return; drawPath(); drawStats(); report(); liftReady(fig); };
  const sample = () => {
    timer = 0;
    if (!visible) return;
    const t1 = performance.now();
    for (const d of [dt, ...DTS.filter((x) => x !== dt)]) {
      let a = stats.get(d);
      if (!a) { a = { R: K.rng(seed + Math.round(d * 1e6)), sum: 0, sq: 0, n: 0 }; stats.set(d, a); }
      while (a.n < N && performance.now() - t1 < 25) {
        const o = M.overshoots(b, d, 100, a.R);
        for (const v of o) { a.sum += v; a.sq += v * v; } a.n += o.length;
      }
      if (performance.now() - t1 >= 25) break;
    }
    if (shown) { drawStats(); report(); }
    if ([...DTS].some((d) => !stats.get(d) || stats.get(d).n < N)) timer = setTimeout(sample, 16);
  };
  const kick = () => { if (!timer && visible) timer = setTimeout(sample, 0); };
  onSeg(el, "os-dt", (v) => { dt = +v; newPath(); draw(); kick(); });
  const reveal = () => { const first = !shown; shown = true; body.hidden = false; verdict.textContent = S.overshootVerdict(guess); if (first) keepDrawn(pathEl, draw); else draw(); };
  onSeg(el, "os-guess", (v) => { guess = v; reveal(); });
  $("#os-show", el).addEventListener("click", reveal);
  $("#os-new", el).addEventListener("click", () => { runN++; newPath(); drawPath(); });
  watchVisible(fig, (v) => { visible = v; kick(); });
  newPath();
}

// ---------------------------------------------------------------- plate: how far in, moment by moment
function coefPlate() {
  const fig = plate("coef"), el = rootOf("coef");
  if (!el) return;
  el.innerHTML = `<div class="controls">${pickHTML("cf-pick")}</div>
    <div class="chart-wrap" id="cf-cost"></div>
    <div class="chart-wrap" id="cf-chart"></div>
    <ul class="legend"><li><span class="key key-ex">Measured coefficient</span></li><li><span class="key key-guide">0.5826, the leading-order shift</span></li></ul>
    <dl class="reads" id="cf-reads"></dl><p class="say" id="cf-say" aria-live="polite"></p><p class="fine" id="cf-state" aria-live="polite"></p>`;
  const costEl = $("#cf-cost", el), chart = $("#cf-chart", el), reads = $("#cf-reads", el), say = $("#cf-say", el), state = $("#cf-state", el);
  wirePick($("#cf-pick", el));
  let data = null, gen = 0;
  const draw = () => {
    if (!data) { chart.innerHTML = ""; costEl.innerHTML = ""; return; }
    const { t, k, view, cost } = data;
    const tv = [], kv = [];
    t.forEach((x, i) => { if (x <= view + 1e-9) { tv.push(x); kv.push(k[i]); } });
    const cs = tv.map(cost), fin = cs.filter(Number.isFinite);
    const fc = frame(costEl, { x: [0, view], y: [Math.min(...fin) / 1.5, Math.max(...fin) * 1.5], ylog: true, aspect: 0.2, minH: 80, maxH: 110, b: 20 });
    costEl.innerHTML = svg(fc, axes(fc, { yl: "cost of time", yt: [] }) + line(fc, tv, cs, "cost"), "The cost of time on the window");
    const f = frame(chart, { x: [0, view], y: [0.4, 0.8], aspect: 0.45, minH: 170, maxH: 240 });
    let s = axes(f, { yl: "(b at 0.0025 − b at 0.01) ÷ (√0.01 − √0.0025)", xl: "time", grid: true, yt: [0.4, 0.5, 0.6, 0.7, 0.8] });
    s += `<path class="guide" d="M${f.l} ${f.sy(M.OVERSHOOT).toFixed(1)}H${f.W - f.r}"/>`;
    s += line(f, tv, kv.map((v) => Math.max(0.4, Math.min(0.8, v))), "ex");
    const off = kv.filter((v) => Number.isFinite(v) && (v < 0.4 || v > 0.8)).length;
    if (off) s += `<text class="tag-ex" x="${f.W - f.r}" y="${f.t + 10}" text-anchor="end">${off} times off the chart, drawn at its edge</text>`;
    chart.innerHTML = svg(f, s, "The measured shift coefficient over time, beside 0.5826");
    liftReady(fig);
  };
  const go = () => {
    const my = ++gen, choice = getChoice();
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the program twice, checking every 0.01 and every 0.0025…";
    run({ job: "coef", choice }, { key: "ch09-coef" }).then((m) => {
      if (my !== gen) return;
      const cost = costOf(choice), dl = deadlineOf(choice);
      const C = M.coefSummary(m, cost, dl), { view, steady, all, lastK } = C;
      data = { ...m, view, cost };
      reads.innerHTML = `${steady ? `<div><dt>Where the cost is steady${dl !== null ? `, to ${C.steadyEnd.toFixed(2)}` : ""}</dt><dd>${fmt(steady[0], 3) === fmt(steady[1], 3) ? fmt(steady[0], 3) : `${fmt(steady[0], 3)} to ${fmt(steady[1], 3)}`}</dd></div>` : ""}
        ${all ? `<div class="k-ex"><dt>Over the ${dl !== null ? "trial" : "window"}</dt><dd>${fmt(all.lo, 3)} to ${fmt(all.hi, 3)}</dd></div>` : ""}
        ${lastK !== null ? `<div><dt>Last check before the deadline</dt><dd>${fmt(lastK, 3)}</dd></div>` : ""}`;
      say.textContent = S.coefSay(steady, all, lastK, C.flat, C.steadyIn, C.steadyEnd);
      state.textContent = `Two programs on an evidence grid of ${m.h}, ${dl !== null ? "to the deadline" : "to a forced choice at " + (M.WINDOW + M.SPARE)}, compared every ${2 * m.dtC} time units${dl !== null ? " up to the last check before it" : ""}.`;
      keepDrawn(chart, draw);
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  go();
}

// ---------------------------------------------------------------- plate: with and without the shift
function shiftPlate() {
  const fig = plate("shift"), el = rootOf("shift");
  if (!el) return;
  el.innerHTML = `<div class="controls">${pickHTML("sh-pick")}${segHTML("sh-on", [["on", "Moved in"], ["off", "As they are"]], "on", "The rules' bounds")}</div>
    <div class="chart-wrap" id="sh-chart"></div>
    <ul class="legend"><li><span class="key key-ex">The program, on the grid</span></li><li><span class="key key-pm">Per-moment rule</span></li><li><span class="key key-wb">Weighted rule</span></li></ul>
    <dl class="reads" id="sh-reads"></dl><p class="say" id="sh-say" aria-live="polite"></p><p class="fine" id="sh-state" aria-live="polite"></p>`;
  const chart = $("#sh-chart", el), reads = $("#sh-reads", el), say = $("#sh-say", el), state = $("#sh-state", el);
  wirePick($("#sh-pick", el));
  let data = null, on = true, gen = 0;
  const draw = () => {
    if (!data) { chart.innerHTML = ""; return; }
    const { t, exact, pm, wb, dt, view } = data;
    const pmS = pm.map((v) => M.asScored(v, dt, on)), wbS = wb.map((v) => M.asScored(v, dt, on));
    const ex = exact.map((v) => (Number.isFinite(v) ? v : NaN));
    const hi = Math.max(finiteMax(ex), finiteMax(pmS), finiteMax(wbS)) * 1.1 + 0.02;
    const f = frame(chart, { x: [0, view], y: [0, hi], aspect: 0.5, minH: 190, maxH: 280 });
    let s = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    s += line(f, t, pmS, "pm") + line(f, t, wbS, "wb") + line(f, t, ex, "ex");
    chart.innerHTML = svg(f, s, `The program's bound beside the two rules' bounds, ${on ? "moved in for checking every " + dt : "as they are, for continuous watching"}`);
    const L = data.loss, mark = (x) => (on ? "on" : "off");
    reads.innerHTML = `<div class="k-pm"><dt>Per-moment loss</dt><dd>${S.pts(L.pm[mark()])}<small>${on ? "without the shift " + S.pts(L.pm.off) : "with the shift " + S.pts(L.pm.on)}</small></dd></div>
      <div class="k-wb"><dt>Weighted loss</dt><dd>${S.pts(L.wb[mark()])}<small>${on ? "without the shift " + S.pts(L.wb.off) : "with the shift " + S.pts(L.wb.on)}</small></dd></div>
      <div><dt>The shift</dt><dd>${fmt(data.shift, 4)}<small>0.5826 √${dt}</small></dd></div>`;
    liftReady(fig);
  };
  onSeg(el, "sh-on", (v) => { on = v === "on"; draw(); });
  const go = () => {
    const my = ++gen, choice = getChoice();
    data = null; draw(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Solving the program and scoring the rules both ways…";
    run({ job: "shift", choice }, { key: "ch09-shift" }).then((m) => {
      if (my !== gen) return;
      const dl = deadlineOf(choice);
      data = { ...m, view: dl ?? M.WINDOW };
      say.textContent = S.shiftSay(m.loss, isFlat(costOf(choice)), dl ?? M.WINDOW + M.SPARE);
      state.textContent = `Losses in points per 100 trials, each policy scored by the density on the evidence grid (step ${M.H}, checks every ${M.DT}), ${dl !== null ? "to the deadline" : "to a forced choice at " + (M.WINDOW + M.SPARE)}.`;
      keepDrawn(chart, draw);
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  go();
}

// ---------------------------------------------------------------- plate: the theory against the program
function fitPlate() {
  const fig = plate("fit"), el = rootOf("fit");
  if (!el) return;
  const OMS = M.TABLE1.map((r) => r[0]), c0 = 0.1, eps = 0.01;
  const paperWorst = M.PAPER.ClosedFormWorstGain;
  el.innerHTML = `<div class="predict" id="ft-predict"><p>At ε = 0.01, how close do you expect the dynamic program's swing to come to the closed form's?</p>
      ${segHTML("ft-guess", [[10, "Within 10%"], [1, "Within 1%"], [0.1, "Within 0.1%"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="ft-show">Show me</button></div>
      <p class="verdict" id="ft-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("ft-om", OMS.map((o) => [o, String(o)]), 2, "Frequency, ω")}</div>
    <div class="chart-wrap" id="ft-top"></div>
    <ul class="legend"><li><span class="key key-ex">This page's program, b − b₀</span></li><li><span class="key key-wb">Closed form, εβ(t)</span></li><li><span class="key key-pm">Per-moment rule</span></li></ul>
    <div id="ft-gaps" hidden><div class="chart-wrap" id="ft-gs"></div><div class="chart-wrap" id="ft-gl"></div>
    <ul class="legend"><li><span class="key key-ink-dots">The paper's program (Table 1), with its rounding</span></li><li><span class="key key-ring">This page's program</span></li></ul></div>
    <dl class="reads" id="ft-reads"></dl><p class="say" id="ft-say" aria-live="polite"></p><p class="fine" id="ft-state" aria-live="polite"></p>`;
  const top = $("#ft-top", el), gaps = $("#ft-gaps", el), gs = $("#ft-gs", el), gl = $("#ft-gl", el), reads = $("#ft-reads", el);
  const say = $("#ft-say", el), state = $("#ft-state", el), verdict = $("#ft-verdict", el);
  let om = 2, rows = new Map(), shown = false, guess = null;
  const closed = (w) => K.transfer(c0, w);
  const drawTop = () => {
    const r = rows.get(om);
    if (!r) { top.innerHTML = `<p class="fine">Solving the program at ω = ${om}…</p>`; return; }
    const fo = r.t.map((t) => M.firstOrderSine(om, t, c0, eps));
    const all = [...r.dev, ...fo, ...r.pm];
    const lim = Math.max(...all.map(Math.abs)) * 1.15;
    const f = frame(top, { x: [r.from, r.to], y: [-lim, lim], aspect: 0.45, minH: 170, maxH: 250 });
    let s = axes(f, { yl: "bound's move from b₀", xl: "time", grid: true, zero: true });
    s += line(f, r.t, r.pm, "pm") + line(f, r.t, fo, "wb") + line(f, r.t, r.dev, "ex");
    top.innerHTML = svg(f, s, `At omega ${om}: this page's program, the closed-form response, and the per-moment rule over the fitting window`);
  };
  const gapChart = (host, key, label, unit) => {
    const pts = M.TABLE1.map((row) => {
      const w = row[0], cf = closed(w), pg = rows.get(w);
      const paper = key === "s" ? (row[3] / cf.gain - 1) * 100 : row[4] - cf.lead;
      const round = key === "s" ? (0.0005 / cf.gain) * 100 : 0.05;
      const page = pg ? (key === "s" ? (pg.swing / cf.gain - 1) * 100 : pg.lead - cf.lead) : NaN;
      return { w, paper, round, page };
    });
    const vals = pts.flatMap((p) => [p.paper - p.round, p.paper + p.round, p.page]).filter(Number.isFinite).map(Math.abs);
    const lim = Math.max(key === "s" ? 0.3 : 0.3, ...vals) * 1.15;
    const f = frame(host, { x: [0.35, 11], y: [-lim, lim], xlog: true, aspect: 0.32, minH: 140, maxH: 190 });
    let s = axes(f, { yl: label, xl: "ω", grid: true, zero: true, xt: OMS, fx: (v) => String(v) });
    for (const p of pts) {
      const X = f.sx(p.w);
      s += `<path class="ex" d="M${X.toFixed(1)} ${f.sy(p.paper - p.round).toFixed(1)}V${f.sy(p.paper + p.round).toFixed(1)}"/><circle class="ink-dot" cx="${X.toFixed(1)}" cy="${f.sy(p.paper).toFixed(1)}" r="3.6"/>`;
      if (Number.isFinite(p.page)) s += `<circle class="ring-ex" cx="${(X + 7).toFixed(1)}" cy="${f.sy(Math.max(-lim, Math.min(lim, p.page))).toFixed(1)}" r="4"/>`;
    }
    host.innerHTML = svg(f, s, `The gap from the closed form, ${unit}, for the paper's program and this page's, at five frequencies`);
  };
  const report = () => {
    const r = rows.get(om), row = M.TABLE1.find((x) => x[0] === om), cf = closed(om);
    if (!shown) { reads.innerHTML = ""; say.textContent = ""; return; }
    reads.innerHTML = `<div class="k-wb"><dt>Closed form</dt><dd>${fmt(cf.gain, 3)}<small>lead ${cf.lead.toFixed(1)}°</small></dd></div>
      <div><dt>Paper's program</dt><dd>${row[3].toFixed(3)}<small>lead ${row[4].toFixed(1)}°</small></dd></div>
      <div class="k-ex"><dt>This page's</dt><dd>${r ? fmt(r.swing, 3) : "…"}<small>${r ? "lead " + r.lead.toFixed(1) + "°" : "solving"}</small></dd></div>`;
    say.textContent = r ? S.fitSay(om, r, [row[3], row[4]], cf) : "";
    if (shown && rows.size === OMS.length) {
      const pageWorst = Math.max(...OMS.map((w) => Math.abs(rows.get(w).swing / closed(w).gain - 1) * 100));
      verdict.textContent = S.fitVerdict(guess, paperWorst, pageWorst);
    } else if (shown) verdict.textContent = "Solving the page's program at the other frequencies…";
  };
  const draw = () => {
    drawTop();
    if (shown) { gaps.hidden = false; gapChart(gs, "s", "swing gap (%)", "in percent of the swing"); gapChart(gl, "l", "lead gap (°)", "in degrees"); } else gaps.hidden = true;
    report();
    if (rows.has(om)) liftReady(fig);
  };
  onSeg(el, "ft-om", (v) => { om = +v; draw(); });
  onSeg(el, "ft-guess", (v) => { guess = v; shown = true; draw(); });
  $("#ft-show", el).addEventListener("click", () => { shown = true; draw(); });
  state.textContent = "Solving the program at five frequencies…";
  keepDrawn(top, draw);
  run({ job: "fit" }, { progress: (p) => { state.textContent = `Solving the program at five frequencies… ${Math.round(p * 5)} of 5`; } }).then((m) => {
    for (const r of m.rows) rows.set(r.om, r);
    state.textContent = `This page's program: checks every ${M.DT}, an evidence grid of ${M.H}, c₀ = ${c0}, ε = ${eps}, each fitted over whole periods from t = 2 with the choice forced 6 time units after the fit ends.`;
    draw();
  }).catch((e) => fail(state, e));
}

// ---------------------------------------------------------------- plate: the error against the size of the change
function sweepPlate() {
  const fig = plate("sweep"), el = rootOf("sweep");
  if (!el) return;
  const at03 = M.PAPER.SweepSwingThird, at06 = M.PAPER.SweepSwingSixTenths;
  const opts = [2, 4, 8].map((x) => [+(x * at03).toFixed(1), `About ${(x * at03).toFixed(1)}%`]);
  el.innerHTML = `<div class="predict" id="sw-predict"><p>The fitted swing is off by at most ${at03}% at ε/c₀ = 0.3. If that error is second order in the size of the change, what is the most it is off at 0.6?</p>
      ${segHTML("sw-guess", opts, "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="sw-show">Show me</button></div>
      <p class="verdict" id="sw-verdict" aria-live="polite"></p></div>
    <div id="sw-body" hidden>
    <div class="chart-wrap" id="sw-chart"></div>
    <ul class="legend"><li><span class="key key-ink-dots">Table 2, three costs</span></li><li><span class="key key-guide">Slope 2</span></li><li><span class="key key-ring-acc">This page's program, when run</span></li></ul>
    <div class="chart-wrap" id="sw-phase"></div>
    <ul class="legend"><li><span class="key key-ink-dots">Table 2: the largest phase error over its six costs and frequencies</span></li><li><span class="key key-ring-acc">This page's program, at the one cost and frequency run</span></li></ul>
    <div class="controls">${segHTML("sw-c", M.SWEEP.costs.map((c) => [c, String(c)]), 0.1, "This page's program at c₀")}${segHTML("sw-om", M.SWEEP.omegas.map((o) => [o, String(o)]), 1, "and ω")}
      <div class="actions"><button class="btn" type="button" id="sw-run">Run it</button></div></div>
    <dl class="reads" id="sw-reads"></dl><p class="say" id="sw-say" aria-live="polite"></p><p class="fine" id="sw-state" aria-live="polite"></p></div>`;
  const body = $("#sw-body", el), chart = $("#sw-chart", el), phase = $("#sw-phase", el), reads = $("#sw-reads", el);
  const say = $("#sw-say", el), state = $("#sw-state", el), verdict = $("#sw-verdict", el);
  let shown = false, guess = null, c0 = 0.1, om = 1, mine = null, gen = 0;
  const FLOOR = 0.05;   // percent: a cell printed as 1.000 is within 0.0005 of 1
  const draw = () => {
    if (!shown) { body.hidden = true; return; }
    body.hidden = false;
    const f = frame(chart, { x: [0.04, 0.8], y: [0.03, 20], xlog: true, ylog: true, aspect: 0.55, minH: 200, maxH: 290 });
    let s = axes(f, { yl: "swing error (%)", xl: "ε/c₀", grid: true, xt: M.SWEEP.rels, fx: (v) => String(v) });
    s += `<path class="dim" stroke-dasharray="1 3" d="M${f.l} ${f.sy(FLOOR).toFixed(1)}H${f.W - f.r}"/><text class="tk" x="${f.W - f.r}" y="${(f.sy(FLOOR) + 13).toFixed(1)}" text-anchor="end">a cell printed 1.000 is below this</text>`;
    // slope 2 through the paper's largest error at 0.6
    const top6 = Math.max(...M.TABLE2[3].slice(1, 4).flatMap((r) => r.map((v) => Math.abs(v - 1) * 100)));
    s += line(f, [0.05, 0.6], [top6 * (0.05 / 0.6) ** 2, top6], "guide");
    const dx = [-6, 0, 6];
    M.TABLE2.forEach((row) => {
      [1, 2, 3].forEach((ci) => {
        const e = row[ci].map((v) => Math.max(FLOOR, Math.abs(v - 1) * 100)), X = f.sx(row[0]) + dx[ci - 1];
        const loE = Math.min(...e), hiE = Math.max(...e);
        if (hiE > loE) s += `<path class="ex" d="M${X.toFixed(1)} ${f.sy(loE).toFixed(1)}V${f.sy(hiE).toFixed(1)}"/>`;
        for (const v of new Set(e)) s += v <= FLOOR ? `<circle class="ring-ex" cx="${X.toFixed(1)}" cy="${f.sy(v).toFixed(1)}" r="3"/>` : `<circle class="ink-dot" cx="${X.toFixed(1)}" cy="${f.sy(v).toFixed(1)}" r="3"/>`;
      });
    });
    if (mine) for (const r of mine.rows) { const e = Math.max(0.03, Math.abs(r.ratio - 1) * 100); s += `<circle class="ring-acc" cx="${(f.sx(r.rel) + 12).toFixed(1)}" cy="${f.sy(e).toFixed(1)}" r="4.5"/>`; }
    chart.innerHTML = svg(f, s, "The fitted swing's error against the size of the change, on log axes, from Table 2 and this page's program, with a slope-2 guide");
    const fp = frame(phase, { x: [0.04, 0.8], y: [0.05, 3], xlog: true, ylog: true, aspect: 0.32, minH: 140, maxH: 190 });
    let p = axes(fp, { yl: "size of the phase residual (°)", xl: "ε/c₀", grid: true, xt: M.SWEEP.rels, fx: (v) => String(v) });
    p += line(fp, M.TABLE2.map((r) => r[0]), M.TABLE2.map((r) => r[4]), "ex-thin");
    for (const r of M.TABLE2) p += `<circle class="ink-dot" cx="${fp.sx(r[0]).toFixed(1)}" cy="${fp.sy(r[4]).toFixed(1)}" r="3.4"/>`;
    if (mine) for (const r of mine.rows) p += `<circle class="ring-acc" cx="${(fp.sx(r.rel) + 8).toFixed(1)}" cy="${fp.sy(M.phasePlotted(r)).toFixed(1)}" r="4.5"/>`;
    phase.innerHTML = svg(fp, p, `The size of the phase residual, the fitted phase's distance from the predicted phase, against the size of the change: Table 2's largest at each size over its six costs and frequencies (dots)${mine ? `, and this page's program at c₀ = ${mine.c0} and ω = ${mine.om} (rings)` : ""}`);
    liftReady(fig);
  };
  const reveal = () => { shown = true; verdict.textContent = S.sweepVerdict(guess, at03, at06); draw(); };
  onSeg(el, "sw-guess", (v) => { guess = +v; reveal(); });
  $("#sw-show", el).addEventListener("click", reveal);
  onSeg(el, "sw-c", (v) => { c0 = +v; });
  onSeg(el, "sw-om", (v) => { om = +v; });
  $("#sw-run", el).addEventListener("click", () => {
    const my = ++gen;
    state.textContent = "Solving the program at four sizes…";
    run({ job: "sweep", c0, om }, { key: "ch09-sweep", progress: (q) => { if (my === gen) state.textContent = `Solving the program at four sizes… ${Math.round(q * 4)} of 4`; } }).then((m) => {
      if (my !== gen) return;
      mine = m;
      reads.innerHTML = m.rows.map((r) => `<div><dt>ε/c₀ = ${r.rel}</dt><dd>${S.sweepReading(r).swing}<small>${S.sweepReading(r).phase}</small></dd></div>`).join("");
      const ci = M.SWEEP.costs.indexOf(m.c0) + 1;
      const paperSmall = Math.max(...M.TABLE2.filter((r) => r[0] < 0.3).flatMap((r) => r[ci].map((v) => Math.abs(v - 1) * 100)));
      say.textContent = S.sweepSay(m.rows, m.c0, m.om, paperSmall);
      state.textContent = `This page's program at c₀ = ${m.c0}, ω = ${m.om}: checks every ${M.DT}, an evidence grid of ${M.H}, the choice forced at ${M.SWEEP.horizon}, fitted on 2 < t < 2 + 2π; the swing against ε|B′(c₀)||w̃(−iω)|, the phase against the angle of εB′(c₀)w̃(−iω).`;
      draw();
    }).catch((e) => { if (my === gen) fail(state, e); });
  });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- plate: finer grids
function gridPlate() {
  const fig = plate("grid"), el = rootOf("grid");
  if (!el) return;
  el.innerHTML = `<div class="predict" id="gr-predict"><p>From the paper's grid to the finest, which losses move more?</p>
      ${segHTML("gr-guess", [["pm", "Per-moment"], ["wb", "Weighted"], ["same", "About the same"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="gr-show">Show me</button></div>
      <p class="verdict" id="gr-verdict" aria-live="polite"></p></div>
    <div id="gr-paper" hidden>
      <div class="controls">${segHTML("gr-unit", [["abs", "In points"], ["rel", "As a share of the loss"]], "abs", "Table 12's moves from the paper's grid")}</div>
      <div class="chart-wrap" id="gr-chart"></div>
      <ul class="legend" id="gr-key"></ul></div>
    <div class="controls">${pickHTML("gr-pick")}</div>
    <div class="chart-wrap" id="gr-mine"></div>
    <ul class="legend"><li><span class="key key-pm">Per-moment, your schedule</span></li><li><span class="key key-wb">Weighted, your schedule</span></li></ul>
    <dl class="reads" id="gr-reads"></dl><p class="say" id="gr-say" aria-live="polite"></p><p class="fine" id="gr-state" aria-live="polite"></p>`;
  const paperBox = $("#gr-paper", el), chart = $("#gr-chart", el), mineEl = $("#gr-mine", el), reads = $("#gr-reads", el);
  const say = $("#gr-say", el), state = $("#gr-state", el), verdict = $("#gr-verdict", el);
  wirePick($("#gr-pick", el));
  let shown = false, unit = "abs", mine = null, gen = 0, guess = null;
  const moves = () => M.gridMoves(M.RESULTS12);
  const drawPaper = () => {
    if (!shown) { paperBox.hidden = true; return; }
    paperBox.hidden = false;
    const series = [];
    for (const [name, pm, wb] of M.RESULTS12) {
      series.push({ name, cls: "pm", v: pm.map((x) => (unit === "abs" ? x - pm[1] : pm[1] >= M.SHARE_FLOOR ? (x / pm[1] - 1) * 100 : NaN)) });
      series.push({ name, cls: "wb", v: wb.map((x) => (unit === "abs" ? x - wb[1] : wb[1] >= M.SHARE_FLOOR ? (x / wb[1] - 1) * 100 : NaN)) });
    }
    const vals = series.flatMap((s) => s.v).filter(Number.isFinite);
    const lim = Math.max(...vals.map(Math.abs)) * 1.12;
    const f = frame(chart, { x: [0.8, 4.2], y: [-lim, lim], aspect: 0.5, minH: 190, maxH: 270 });
    let s = axes(f, { yl: unit === "abs" ? "change from grid 2 (points)" : "change from grid 2 (%)", xl: "grid", grid: true, zero: true, xt: [1, 2, 3, 4], fx: (v) => (v === 2 ? "2, the paper's" : String(v)) });
    for (const se of series) if (se.v.every(Number.isFinite)) s += line(f, [1, 2, 3, 4], se.v, se.cls === "pm" ? "pm" : "wb");
    if (unit === "rel") s += `<text class="tk" x="${f.W - f.r}" y="${f.t + 10}" text-anchor="end">losses under ${M.SHARE_FLOOR} points left out</text>`;
    // the legend names what is drawn: as shares, the losses under the floor on grid 2 are left out
    const key = M.gridKey(M.RESULTS12, unit);
    $("#gr-key", el).innerHTML = `<li><span class="key key-pm">${key.pm}</span></li><li><span class="key key-wb">${key.wb}</span></li>`;
    chart.innerHTML = svg(f, s, `Table 12's losses on four grids, unrounded, as changes from the paper's grid, ${unit === "abs" ? "in points per 100 trials" : "as a share of the loss"}`);
  };
  const drawMine = () => {
    if (!mine) { mineEl.innerHTML = ""; return; }
    const xs = mine.rows.map((r, i) => i + 1);
    const dpm = mine.rows.map((r) => r.pm - mine.rows[0].pm), dwb = mine.rows.map((r) => r.wb - mine.rows[0].wb);
    const lim = Math.max(0.002, ...dpm.map(Math.abs), ...dwb.map(Math.abs)) * 1.15;
    const f = frame(mineEl, { x: [0.8, 3.2], y: [-lim, lim], aspect: 0.42, minH: 160, maxH: 230, l: 48 });
    let s = axes(f, { yl: "change from this page's grid (points)", xl: "this page's grids", grid: true, zero: true, xt: [1, 2, 3], fx: (v) => { const g = M.PAGE_GRIDS[v - 1]; return g ? `(${g[0]}, ${g[1]})` : ""; } });
    s += line(f, xs, dpm, "pm") + line(f, xs, dwb, "wb");
    xs.forEach((x, i) => { s += `<circle class="pm-dot" cx="${f.sx(x).toFixed(1)}" cy="${f.sy(dpm[i]).toFixed(1)}" r="3.4"/><circle class="wb-dot" cx="${f.sx(x).toFixed(1)}" cy="${f.sy(dwb[i]).toFixed(1)}" r="3.4"/>`; });
    mineEl.innerHTML = svg(f, s, "Your schedule's losses for the two rules on this page's three grids, as changes from this page's grid");
    liftReady(fig);
  };
  const draw = () => { drawPaper(); drawMine(); };
  const reveal = () => { shown = true; const mv = moves(); verdict.textContent = S.gridVerdict(guess, M.PAPER.GridPmMaxChange, M.PAPER.GridWbMaxChange, mv.pmRel, mv.wbRel, M.SHARE_FLOOR); drawPaper(); };
  onSeg(el, "gr-guess", (v) => { guess = v; reveal(); });
  $("#gr-show", el).addEventListener("click", reveal);
  onSeg(el, "gr-unit", (v) => { unit = v; drawPaper(); });
  const go = () => {
    const my = ++gen, choice = getChoice();
    mine = null; drawMine(); reads.innerHTML = ""; say.textContent = "";
    state.textContent = "Scoring the rules on three grids…";
    run({ job: "refine", choice }, { key: "ch09-refine", progress: (q) => { if (my === gen) state.textContent = `Scoring the rules on three grids… ${Math.round(q * 3)} of 3`; } }).then((m) => {
      if (my !== gen) return;
      mine = m;
      reads.innerHTML = m.rows.map((r) => `<div><dt>Grid (${r.dt}, ${r.h})</dt><dd>${S.pts(r.pm)}<small>weighted ${S.pts(r.wb)}</small></dd></div>`).join("");
      say.textContent = S.refineSay(m.rows, labelOf(choice));
      const dl = deadlineOf(choice);
      state.textContent = `Each grid solves its own program and scores both rules (moved in by 0.5826√Δt for its own Δt) ${dl !== null ? "to the deadline" : "to a forced choice at " + (M.WINDOW + M.SPARE)}.`;
      drawMine();
    }).catch((e) => { if (my === gen) fail(state, e); });
  };
  window.addEventListener("cc-schedule", go);
  keepDrawn(chart, draw);
  go();
}

// ---------------------------------------------------------------- start
hero();
const lazy = [["backward", backwardPlate], ["density", densityPlate], ["trials", trialsPlate], ["overshoot", overshootPlate], ["coef", coefPlate],
  ["shift", shiftPlate], ["fit", fitPlate], ["sweep", sweepPlate], ["grid", gridPlate]];
for (const [id, fn] of lazy) {
  const f = plate(id);
  if (f) onVisible(f, () => { try { fn(); } catch (e) { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e.message).replace(/[<>&]/g, "")}</p>`; console.error(e); } });
}
