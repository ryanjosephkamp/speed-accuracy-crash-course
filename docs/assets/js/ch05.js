// Chapter 5's plates. Every number drawn comes from the dynamic program and the sweep for E_y[c(t + tau*)] in
// ch05-model.js, run in this chapter's worker (ch05-worker.js), or from closed forms; the frozen rule of the envelope
// identity is worked out here, on the worker's bound, in about 10 ms. The words under each plate come from the
// functions in say-ch05.js, which take numbers and return sentences.
import { frozenRule, belief, gPrime, B, testStep } from "./ch05-model.js?v=3012045bec";
import { costOf, deadlineOf, labelOf, PRESETS, DRAW, paramsOf, VIEW, defaultDrawing } from "./schedules-book.js?v=3012045bec";
import { getChoice, setChoice, onVisible, watchVisible, liftReady, calm, seedParam } from "./book.js?v=3012045bec";
import { rng, meanLookAhead, meanDecisionTime } from "./kernel.js?v=3012045bec";
import { frame, line, area, axes, svg, fmt, keepDrawn } from "./chart.js?v=3012045bec";
import * as S from "./say-ch05.js?v=3012045bec";

const $ = (sel, el = document) => el.querySelector(sel);
const plate = (id) => document.getElementById("plate-" + id);
const rootOf = (id) => plate(id)?.querySelector(".demo-root");
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const segHTML = (name, opts, cur, legend) => `<fieldset class="seg"><legend>${legend}</legend><div class="seg-row">${opts.map(([v, lbl]) =>
  `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(cur) ? " checked" : ""}><span>${lbl}</span></label>`).join("")}</div></fieldset>`;
const onSeg = (el, name, fn) => el.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener("change", () => fn(r.value)));
const vline = (f, x, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.sx(x).toFixed(1)} ${f.t}V${f.H - f.b}"/>`;
const hline = (f, y, cls, extra = "") => `<path class="${cls}" ${extra} d="M${f.l} ${f.sy(y).toFixed(1)}H${f.W - f.r}"/>`;
const dot = (f, x, y, cls = "acc-dot", r = 4) => `<circle class="${cls}" cx="${f.sx(x).toFixed(1)}" cy="${f.sy(y).toFixed(1)}" r="${r}"/>`;
const text = (x, y, s, cls = "tk", anchor = "start") => `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${s}</text>`;
const fail = (id, e) => { const r = rootOf(id); if (r) r.innerHTML = `<p class="plate-fail">The live plate could not start: ${String(e && e.message || e).replace(/[<>&]/g, "")}</p>`; console.error(e); };

// ---------------------------------------------------------------- this chapter's worker
let worker = null, nextId = 1;
const pending = new Map();
function work(job, progress = null) {
  if (!worker) {
    worker = new Worker(new URL("./ch05-worker.js?v=3012045bec", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const m = e.data, p = pending.get(m.id);
      if (!p) return;
      if (m.progress !== undefined) { p.progress.forEach((fn) => fn(m.progress)); return; }
      pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
    };
    worker.onerror = (e) => { for (const [, p] of pending) p.reject(new Error(e.message || "the worker stopped")); pending.clear(); };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress: progress ? [progress] : [] });
    worker.postMessage({ ...job, id });
  });
}
/** One solve per job, shared by every plate that asks for it; a later asker can listen to its progress too. */
const solved = new Map();
function cachedWork(key, job, progress) {
  if (!solved.has(key)) {
    const id = nextId;
    const p = work(job, progress).catch((e) => { solved.delete(key); throw e; });
    solved.set(key, { p, id });
  } else if (progress) {
    const entry = pending.get(solved.get(key).id);
    if (entry) entry.progress.push(progress);
  }
  return solved.get(key).p;
}

// ---- the paper's test schedule on the plates' grid, with what the plates read from it
let FIX = null;
function fixed(progress) {
  return cachedWork("fixed", { job: "fixed" }, progress).then((m) => {
    if (FIX) return FIX;
    const n = m.ts.length + Math.round(10 / m.dt);
    const c = Float64Array.from({ length: n }, (_, k) => testStep(k * m.dt));
    const Cs = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) Cs[k + 1] = Cs[k] + c[k] * m.dt;
    const snap = (t) => m.snaps[Math.max(0, Math.min(m.snaps.length - 1, Math.round(t / 0.05)))];
    const rules = new Map();
    const rule = (K, q) => {
      const key = K + ":" + q;
      if (!rules.has(key)) rules.set(key, frozenRule(m.bounds, m.dt, m.h, m.yGrid[q], K, 0.1));
      return rules.get(key);
    };
    FIX = { ...m, c, Cs, snap, rule };
    return FIX;
  });
}
/** The frozen rule's reward J at step K + M, for the rule frozen at step K: A - E[cost from K + M to K + M + n]. */
function Jat(D, K, R, M) {
  const { f, A } = R, Cs = D.Cs;
  let s = 0;
  for (let n = 0; n < f.length; n++) { if (f[n]) s += f[n] * (Cs[K + M + n] - Cs[K + M]); }
  return A - s;
}

// ---- the reader's schedule on two grids
const COARSE = { dt: 0.01, h: 0.02, horizon: 10, name: "coarse" };
const FINE = { dt: 0.002, h: 0.005, horizon: 10, name: "fine" };
const keyOf = (choice) => JSON.stringify({ id: choice.id, params: choice.id === "draw" ? undefined : paramsOf(choice), points: choice.id === "draw" ? choice.points : undefined });
function scheduleData(choice, grid, progress) {
  const key = keyOf(choice) + grid.name;
  return cachedWork(key, { job: "schedule", choice, dt: grid.dt, h: grid.h, horizon: grid.horizon }, progress);
}
/** Whether the standing assumption holds: continuous, between two positive levels. */
function standing(choice) {
  if (deadlineOf(choice) !== null) return { ok: false, why: "deadline" };
  if (choice.id === "rising") return { ok: false, why: "rising" };
  return { ok: true, why: choice.id === "draw" ? "draw" : choice.id === "constant" ? "constant" : "preset" };
}
const pickerHTML = (id) => {
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  return `<label class="dial" style="flex:1 1 13rem"><span class="ctl-key">Your schedule</span><span></span>
    <select class="pick" id="${id}">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}<optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>`;
};
const choiceFromPick = (v) => {
  if (v === "draw") { const c = getChoice(); return c.id === "draw" && Array.isArray(c.points) ? c : { id: "draw", points: defaultDrawing() }; }
  return { id: v, params: paramsOf({ id: v }) };
};

// ---------------------------------------------------------------- the hero: two areas of one quarter
function hero() {
  const fig = document.getElementById("hero-proof");
  const el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const times = [0.6, 1.0, 1.3, 1.5, 1.8, 2.4];
  const T = 3;
  let D = null, cur = 2;
  const label = fig.querySelector(".proof-label");
  const at = (i) => {
    const t = times[i], c = testStep(t), Bc = B(c);
    if (!D) return { t, c, Bc, bc: NaN, top: NaN };
    const s = D.snap(t), bc = s.b + D.shift;
    let top = 0;
    for (let j = 0; j < s.x.length && s.x[j] < bc; j++) top = Math.max(top, s.u[j] / c);
    return { t, c, Bc, bc, top, s };
  };
  // the lower chart's height: the tallest curve over all six moments
  let vCache = null;
  const vTop = () => {
    if (vCache && D) return vCache;
    let v = Math.max(...times.map((t) => testStep(t) * Math.cosh(B(testStep(t))) ** 2));
    if (D) for (let i = 0; i < times.length; i++) { const s = D.snap(times[i]); for (let j = 0; j < s.x.length && s.x[j] < s.b + D.shift; j++) v = Math.max(v, Math.cosh(s.x[j]) ** 2 * s.u[j]); }
    const out = v * 1.12;
    if (D) vCache = out;
    return out;
  };
  const labelOf = (i) => { const a = at(i); return S.heroLabel(a.t, a.bc, a.Bc, a.top); };
  const draw = (i) => {
    cur = i;
    const a = at(i);
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340)), H = Math.round(Math.min(330, Math.max(250, W * 0.64)));
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    const split = Math.round(H * 0.3);
    const fT = { W, H: split, l: 12, r: 10, t: 18, b: 6 };
    const ftx = (v) => fT.l + (v / T) * (W - fT.l - fT.r), fty = (v) => fT.t + (1 - (v - 0.05) / 0.4) * (fT.H - fT.t - fT.b);
    const ts = range(0, T, 151);
    let s = `<text class="lab" x="${fT.l}" y="12">the cost, rising from 0.1 to 0.4; marked: time ${a.t.toFixed(1)}</text>`;
    s += `<path class="cost" d="${ts.map((t, k) => (k ? "L" : "M") + ftx(t).toFixed(1) + " " + fty(testStep(t)).toFixed(1)).join("")}"/>`;
    s += `<path class="dim" stroke-dasharray="2 3" d="M${ftx(a.t).toFixed(1)} ${fT.t - 2}V${fT.H}"/><circle class="acc-dot" cx="${ftx(a.t).toFixed(1)}" cy="${fty(a.c).toFixed(1)}" r="4"/>`;
    // the two integrands, against the evidence y
    const fB = { W, H, l: 12, r: 10, t: split + 30, b: 22 };
    const yMax = 1.45, vMax = vTop();
    const bx = (v) => fB.l + (v / yMax) * (W - fB.l - fB.r), by = (v) => fB.t + (1 - Math.min(v, vMax) / vMax) * (H - fB.t - fB.b);
    s += `<text class="lab" x="${fB.l}" y="${fB.t - 12}">at that time: cosh² y × cost, from 0 to the bound; both areas are ¼</text>`;
    s += `<path class="ax" d="M${fB.l} ${H - fB.b}H${W - fB.r}"/>`;
    const ys = range(0, a.Bc, 80);
    s += `<path class="pm" d="${ys.map((y, k) => (k ? "L" : "M") + bx(y).toFixed(1) + " " + by(a.c * Math.cosh(y) ** 2).toFixed(1)).join("")}L${bx(a.Bc).toFixed(1)} ${by(0).toFixed(1)}"/>`;
    if (a.s) {
      const pts = [];
      for (let j = 0; j < a.s.x.length && a.s.x[j] < a.bc; j++) pts.push([a.s.x[j], Math.cosh(a.s.x[j]) ** 2 * a.s.u[j]]);
      const jb = Math.min(a.s.u.length - 2, Math.floor(a.bc / D.h)), ub = a.s.u[jb] + (a.s.u[jb + 1] - a.s.u[jb]) * (a.bc / D.h - jb);
      pts.push([a.bc, Math.cosh(a.bc) ** 2 * ub]);
      const d = pts.map(([x, v], k) => (k ? "L" : "M") + bx(x).toFixed(1) + " " + by(v).toFixed(1)).join("");
      s += `<path class="wb-fill" d="${d}L${bx(a.bc).toFixed(1)} ${by(0).toFixed(1)}L${bx(0).toFixed(1)} ${by(0).toFixed(1)}Z"/><path class="wb" d="${d}L${bx(a.bc).toFixed(1)} ${by(0).toFixed(1)}"/>`;
      s += `<text class="tag-wb" x="${(bx(a.bc) - 4).toFixed(1)}" y="${(H - fB.b + 15).toFixed(1)}" text-anchor="end">b(t)</text>`;
    } else {
      s += `<text class="tk" x="${(W / 2).toFixed(1)}" y="${((fB.t + H) / 2).toFixed(1)}" text-anchor="middle">solving the dynamic program…</text>`;
    }
    s += `<text class="tag-pm" x="${(bx(a.Bc) + 4).toFixed(1)}" y="${(H - fB.b + 15).toFixed(1)}" text-anchor="start">B(c(t))</text>`;
    s += `<text class="tk" x="${fB.l}" y="${H - 6}">0</text>`;
    el.innerHTML = s;
  };
  draw(2);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) window.ChapterHero.live(fig, { steps: times.length, draw, label: labelOf });
  fixed().then((m) => { D = m; draw(cur); if (label) label.textContent = labelOf(cur); }).catch((e) => console.error(e));
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

// ---------------------------------------------------------------- plate: the frozen rule (Lemma 2's strip)
function frozenPlate() {
  const fig = plate("frozen"), el = rootOf("frozen");
  if (!el) return;
  let step = +(fig.dataset.step || 0), t = 1.2, q = 1, guess = null, shown = false, D = null;
  el.innerHTML = `<div class="predict"><p>The cost rises from 0.1 to 0.4 around time 1.5 and then stays at 0.4. From evidence y at the time on the slider, is starting a little later better or worse?</p>
      ${segHTML("fz-guess", [["better", "Better"], ["worse", "Worse"], ["same", "No difference"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="fz-show">Show me</button></div>
      <p class="verdict" id="fz-verdict" aria-live="polite"></p></div>
    <div class="controls"><label class="dial" style="flex:1 1 12rem"><span class="ctl-key">Rule frozen at time t</span><output id="fz-out"></output>
      <input type="range" id="fz-t" min="0.3" max="2.4" step="0.05" value="${t}" aria-label="The time the rule is frozen at"></label>
      ${segHTML("fz-y", [[0, "0"], [1, "0.25"], [2, "0.5"]], q, "Evidence y")}</div>
    <p class="fine" id="fz-step"></p>
    <div class="chart-wrap" id="fz-a"></div><div class="chart-wrap" id="fz-b" hidden></div>
    <ul class="legend" id="fz-legend"></ul>
    <dl class="reads" id="fz-reads"></dl><p class="say" id="fz-say"></p>
    <p class="fine" id="fz-state" aria-live="polite">Solving the dynamic program…</p>`;
  const ca = $("#fz-a", el), cb = $("#fz-b", el), reads = $("#fz-reads", el), say = $("#fz-say", el), head = $("#fz-step", el);
  const legend = $("#fz-legend", el), verdict = $("#fz-verdict", el), out = $("#fz-out", el), inp = $("#fz-t", el), state = $("#fz-state", el);
  const numbers = () => {
    const K = Math.round(t / D.dt), y = D.yGrid[q], b = D.bounds[K];
    if (!(y < b)) return { K, y, b, inside: false };
    const R = D.rule(K, q);
    const V = D.Vy[q];
    const Vt = (V[K + 1] - V[K - 1]) / (2 * D.dt);
    const Jt = (Jat(D, K, R, 1) - Jat(D, K, R, -1)) / (2 * D.dt);
    let Ec = 0, mean = 0;
    R.f.forEach((fn, n) => { Ec += fn * D.c[K + n]; mean += fn * n * D.dt; });
    return { K, y, b, inside: true, R, Vt, Jt, Ec, mean, c: D.c[K], ident: D.c[K] - Ec, V: V[K] };
  };
  const draw = () => {
    out.textContent = t.toFixed(2);
    if (!D) return;
    const N = numbers();
    cb.hidden = step !== 2;
    if (!N.inside) {
      ca.innerHTML = ""; reads.innerHTML = ""; legend.innerHTML = "";
      say.textContent = S.frozenOutside(t, N.y, N.b + D.shift);
      return;
    }
    let f, g = "", lab = "";
    const K = N.K;
    if (step === 0) {
      head.textContent = "Step 1: below the bound, the value is a smooth function of the evidence, flat at 0.";
      const s = D.snap(t);
      const xs = range(0, 1.6, 161);
      f = frame(ca, { x: [0, 1.6], y: [0.5, 1], aspect: 0.5, minH: 180, maxH: 270 });
      g = axes(f, { yl: "value at time t", xl: "evidence y", grid: true });
      g += line(f, xs, xs.map((x) => belief(x)), "path-dim");
      const vx = s.x.filter((x) => x <= 1.6), vv = vx.map((x, j) => (x < s.b ? s.V[j] : belief(x)));
      g += line(f, vx, vv, "ex");
      g += vline(f, s.b + D.shift, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(s.b + D.shift) + 4, f.t + 10, "b(t)", "tag-ex");
      g += dot(f, N.y, N.V);
      g += text(f.sx(1.58), f.sy(belief(1.58)) + 16, "g(y)", "tk", "end");
      legend.innerHTML = `<li><span class="key key-ex">V(t, y), from the program</span></li><li><span class="key key-dim">g(y), deciding now</span></li>`;
      reads.innerHTML = `<div><dt>V(t, y)</dt><dd>${fmt(N.V, 4)}<small>at y = ${N.y}</small></dd></div>
        <div><dt>Bound b(t)</dt><dd>${fmt(s.b + D.shift, 3)}<small>the grid's, moved out by 0.5826√Δt</small></dd></div>
        <div><dt>Slope at y = 0</dt><dd>${fmt((s.V[1] - s.V[0]) / D.h, 4)}<small>a one-cell difference, 0 in the model</small></dd></div>`;
      say.textContent = S.frozenSay(0, { t, y: N.y, V: N.V, b: s.b + D.shift });
      lab = "The value against the evidence at the chosen time, above the reward for deciding now, meeting it at the bound";
    } else if (step === 1 || step === 3) {
      const span = step === 1 ? 1 : 0.25;
      const lo = Math.max(0, t - span), hi = Math.min(3, t + span);
      const Ks = [], vs = [];
      for (let k = Math.round(lo / D.dt); k <= Math.round(hi / D.dt); k += step === 1 ? 2 : 1) { Ks.push(k); vs.push(D.Vy[q][k]); }
      const xs = Ks.map((k) => k * D.dt);
      const js = Ks.map((k) => Jat(D, K, N.R, k - K));
      // the rule frozen at other times, faint: the value is the upper envelope of all of them
      const others = step === 1 ? [-1, -0.5, 0.5, 1].map((d) => Math.round((t + d) / 0.05) * 0.05).filter((u) => u >= 0.3 && u <= 2.4 && u >= lo && u <= hi) : [];
      const curves = others.map((u) => { const K2 = Math.round(u / D.dt); if (!(D.yGrid[q] < D.bounds[K2])) return null; const R2 = D.rule(K2, q); return Ks.map((k) => Jat(D, K2, R2, k - K2)); }).filter(Boolean);
      const all = [...vs, ...js, ...curves.flat()];
      let ylo = Math.min(...vs, ...js), yhi = Math.max(...vs, ...js);
      if (step === 1) { ylo = Math.min(ylo, ...all.filter((v) => v > ylo - 0.4 * (yhi - ylo + 0.01))); }
      const pad = (yhi - ylo) * 0.12 + 1e-4;
      f = frame(ca, { x: [lo, hi], y: [ylo - pad, yhi + pad], aspect: 0.52, minH: 190, maxH: 280, l: 48 });
      g = axes(f, { yl: "reward from y", xl: "start time t′", grid: true });
      curves.forEach((cv) => { g += line(f, xs, cv, "path-dim"); });
      g += line(f, xs, js, "acc") + line(f, xs, vs, "ex");
      if (step === 3) {
        const x0 = Math.max(lo, t - 0.2), x1 = Math.min(hi, t + 0.2);
        g += `<path class="wb" stroke-dasharray="5 4" d="M${f.sx(x0).toFixed(1)} ${f.sy(N.V + N.ident * (x0 - t)).toFixed(1)}L${f.sx(x1).toFixed(1)} ${f.sy(N.V + N.ident * (x1 - t)).toFixed(1)}"/>`;
      }
      g += vline(f, t, "dim", 'stroke-dasharray="2 3"') + dot(f, t, N.V);
      let gap = -Infinity;
      js.forEach((j, i) => { gap = Math.max(gap, j - vs[i]); });
      head.textContent = step === 1 ? "Step 2: the rule frozen at time t earns J(t′) from other start times: never more than V, and the same at t."
        : "Step 4: at the touching point, the two curves have the same slope (dashed: c(t) − E[c(t + τ*)]).";
      legend.innerHTML = `<li><span class="key key-ex">V(t′, y)</span></li><li><span class="key key-acc">J(t′), the rule frozen at t</span></li>${step === 1 ? '<li><span class="key key-dim">Frozen at other times</span></li>' : '<li><span class="key key-wb-dash">Slope c(t) − E[c(t + τ*)]</span></li>'}`;
      if (step === 1) {
        reads.innerHTML = `<div class="k-acc"><dt>Largest J − V</dt><dd>${S.sci(gap)}<small>over the window</small></dd></div>
          <div><dt>V(t, y) = J(t)</dt><dd>${fmt(N.V, 4)}<small>the touching point</small></dd></div>`;
        say.textContent = S.frozenSay(1, { t, y: N.y, gap, n: curves.length });
      } else {
        reads.innerHTML = `<div><dt>Slope of V</dt><dd>${fmt(N.Vt, 4)}<small>central difference on the grid</small></dd></div>
          <div class="k-acc"><dt>Slope of J</dt><dd>${fmt(N.Jt, 4)}</dd></div>
          <div class="k-wb"><dt>c(t) − E[c(t + τ*)]</dt><dd>${fmt(N.ident, 4)}</dd></div>`;
        say.textContent = S.frozenSay(3, { t, y: N.y, Vt: N.Vt, Jt: N.Jt, ident: N.ident, dt: D.dt });
      }
      lab = step === 1 ? "The value against the start time at a fixed evidence level, with the frozen rule's reward touching it from below"
        : "A close view of the value and the frozen rule's reward at the touching point, with the common slope";
    } else if (step === 2) {
      head.textContent = "Step 3: moving the start moves only the cost paid at the start and at the moment of decision.";
      const X1 = Math.min(4.5, t + 3);
      const ts = range(0, X1, 226);
      f = frame(ca, { x: [0, X1], y: [0, 0.45], aspect: 0.32, minH: 120, maxH: 170, b: 22 });
      g = axes(f, { yl: "cost c", grid: true, xt: [] });
      g += line(f, ts, ts.map(testStep), "cost");
      g += hline(f, N.Ec, "wb", 'stroke-dasharray="5 4"') + text(f.W - f.r, f.sy(N.Ec) - 5, `E[c(t + τ*)] ${fmt(N.Ec, 3)}`, "tag-wb", "end");
      g += dot(f, t, N.c);
      ca.innerHTML = svg(f, g, `The cost over time, with the cost now and the expected cost at the moment of decision marked`);
      // the law of the moment of decision, t + tau
      const BW = 0.05, nb = Math.ceil(X1 / BW), dens = new Array(nb).fill(0);
      N.R.f.forEach((fn, n) => { const k = Math.floor((t + n * D.dt) / BW); if (k < nb) dens[k] += fn / BW; });
      const top = Math.max(...dens) * 1.1;
      const fb = frame(cb, { x: [0, X1], y: [0, top], aspect: 0.3, minH: 110, maxH: 160, t: 16 });
      let h = axes(fb, { yl: "moment of decision", xl: "time", grid: true, yt: [] });
      dens.forEach((d, k) => { if (d > 0) h += `<rect class="wb-fill" x="${(fb.sx(k * BW) + 0.5).toFixed(1)}" y="${fb.sy(d).toFixed(1)}" width="${Math.max(0.5, fb.sx(BW) - fb.sx(0) - 1).toFixed(1)}" height="${(fb.sy(0) - fb.sy(d)).toFixed(1)}"/>`; });
      h += vline(fb, t, "dim", 'stroke-dasharray="2 3"') + text(fb.sx(t) + 4, fb.t + 10, "t", "tag-acc");
      cb.innerHTML = svg(fb, h, "The law of the moment of decision, t plus the decision time, under the frozen rule");
      legend.innerHTML = `<li><span class="key key-cost">Cost c</span></li><li><span class="key key-wb">The moment of decision, its law and expected cost</span></li>`;
      reads.innerHTML = `<div class="k-acc"><dt>Cost now, c(t)</dt><dd>${fmt(N.c, 3)}</dd></div>
        <div class="k-wb"><dt>E[c(t + τ*)]</dt><dd>${fmt(N.Ec, 3)}<small>decision ${fmt(N.mean, 2)} time units later, on average</small></dd></div>
        <div><dt>J′(t)</dt><dd>${fmt(N.ident, 4)}<small>c(t) − E[c(t + τ*)]</small></dd></div>`;
      say.textContent = S.frozenSay(2, { t, y: N.y, c: N.c, Ec: N.Ec, mean: N.mean });
      liftReady(fig);
      return;
    } else {
      head.textContent = "Step 5: with the backward equation, the curvature term is the expected cost at the moment of decision.";
      const s = D.snap(t), bc = s.b + D.shift;
      const xs = [], us = [];
      for (let j = 0; j < s.x.length && s.x[j] < s.b; j++) { xs.push(s.x[j]); us.push(s.u[j]); }
      const c = D.c[K];
      const lo = Math.min(c, ...us), hi = Math.max(c, ...us);
      f = frame(ca, { x: [0, Math.max(bc, 0.6)], y: [Math.max(0, lo - 0.15 * (hi - lo + 0.02)), hi + 0.15 * (hi - lo + 0.02)], aspect: 0.5, minH: 180, maxH: 260 });
      g = axes(f, { yl: "𝓛V(t, y) = E_y[c(t + τ*)]", xl: "evidence y", grid: true });
      g += hline(f, c, "acc", 'stroke-dasharray="5 4"') + text(f.l + 4, f.sy(c) - 5, `c(t) = ${fmt(c, 3)}`, "tag-acc");
      g += line(f, xs, us, "wb");
      g += vline(f, bc, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(bc) - 4, f.t + 10, "b(t)", "tag-ex", "end");
      const uy = s.u[Math.round(N.y / D.h)];
      g += dot(f, N.y, uy, "wb-dot");
      legend.innerHTML = `<li><span class="key key-wb">E_y[c(t + τ*)], from the sweep</span></li><li><span class="key key-acc-dash">The cost now</span></li>`;
      reads.innerHTML = `<div class="k-wb"><dt>At y = ${N.y}</dt><dd>${fmt(uy, 3)}<small>E_y[c(t + τ*)]</small></dd></div>
        <div class="k-wb"><dt>At y = 0</dt><dd>${fmt(us[0], 3)}</dd></div>
        <div class="k-acc"><dt>Cost now</dt><dd>${fmt(c, 3)}</dd></div>`;
      say.textContent = S.frozenSay(4, { t, u0: us[0], ub: us[us.length - 1], c });
      lab = "The expected cost at the moment of decision against the evidence, beside the cost now";
    }
    ca.innerHTML = svg(f, g, lab);
    liftReady(fig);
  };
  const judge = () => {
    if (!D || (!guess && !shown)) { verdict.textContent = ""; return; }
    const N = numbers();
    verdict.textContent = N.inside ? S.frozenVerdict(guess, N.Vt, t, N.y) : S.frozenOutside(t, N.y, N.b + D.shift);
  };
  inp.addEventListener("input", () => { t = +inp.value; draw(); judge(); });
  onSeg(el, "fz-y", (v) => { q = +v; draw(); judge(); });
  onSeg(el, "fz-guess", (v) => { guess = v; shown = true; judge(); });
  $("#fz-show", el).addEventListener("click", () => { shown = true; judge(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  fixed((p) => { state.textContent = `Solving the dynamic program… ${Math.round(p * 100)}%`; }).then((m) => {
    D = m;
    state.textContent = `The paper's test schedule; time step ${D.dt}, evidence step ${D.h}, a forced choice at time ${D.horizon}.`;
    keepDrawn(ca, draw); judge();
  }).catch((e) => fail("frozen", e));
  draw();
}

// ---------------------------------------------------------------- plate: regularity (Proposition 3's strip)
function regularPlate() {
  const fig = plate("regular"), el = rootOf("regular");
  if (!el) return;
  let step = +(fig.dataset.step || 0), t = 1.2, eps = 0.03, D = null;
  const cmin = 0.1, cmax = 0.4, C = Math.sqrt((cmax - cmin) / cmin), Kc = 1 + C, GAP = 0.3;
  el.innerHTML = `<div class="controls">${segHTML("rg-t", [[0.5, "0.5"], [1.2, "1.2"], [1.5, "1.5"], [2, "2"]], t, "Time t")}
      <span id="rg-eps-box">${segHTML("rg-eps", [[0.1, "0.1"], [0.03, "0.03"], [0.01, "0.01"]], eps, "Start below the bound by ε")}</span></div>
    <p class="fine" id="rg-step"></p>
    <div class="chart-wrap" id="rg-chart"></div>
    <ul class="legend" id="rg-legend"></ul>
    <dl class="reads" id="rg-reads"></dl><p class="say" id="rg-say"></p>
    <p class="fine" id="rg-state" aria-live="polite">Solving the dynamic program…</p>`;
  const chart = $("#rg-chart", el), reads = $("#rg-reads", el), say = $("#rg-say", el), head = $("#rg-step", el), legend = $("#rg-legend", el), state = $("#rg-state", el);
  const epsBox = $("#rg-eps-box", el);
  const Wof = (s) => s.x.map((x, j) => (x < s.b ? s.V[j] - belief(x) : 0));
  // sampled paths from b - eps against the computed bound (step 4), seeded and cached
  const paths = new Map();
  const sample = (tt, e) => {
    const key = tt + ":" + e;
    if (paths.has(key)) return paths.get(key);
    const R = rng(seedParam(2026) + Math.round(e * 1000) + Math.round(tt * 100) * 7);
    const dts = 2e-5, Smax = 0.04, n = Math.round(Smax / dts), K0 = tt / D.dt;
    const bAt = (s) => { const u = K0 + s / D.dt, k = Math.floor(u), w = u - k; return D.bounds[k] * (1 - w) + D.bounds[k + 1] * w + D.shift; };
    const b0 = bAt(0), out = [], hits = [];
    for (let p = 0; p < 200; p++) {
      let y = b0 - e, hit = NaN;
      const keep = p < 12 ? [[0, y]] : null;
      for (let i = 1; i <= n; i++) {
        y += Math.tanh(y) * dts + Math.sqrt(dts) * R.normal();
        if (y < 0) y = -y;
        if (keep && i % 10 === 0) keep.push([i * dts, y]);
        if (y >= bAt(i * dts)) { hit = i * dts; if (keep) keep.push([hit, y]); break; }
      }
      hits.push(hit);
      if (keep) out.push(keep);
    }
    const done = hits.filter(Number.isFinite).sort((a, b) => a - b);
    const res = { paths: out, b0, bAt, share: done.length / hits.length, median: done.length >= hits.length / 2 ? done[Math.floor(hits.length / 2)] : NaN, Smax };
    paths.set(key, res);
    return res;
  };
  const draw = () => {
    if (!D) return;
    epsBox.hidden = step !== 3;
    const s = D.snap(t), b = s.b, W = Wof(s);
    let f, g = "", lab = "";
    if (step === 0) {
      head.textContent = "Step 1: below the bound, 𝓛W = 𝓛V = E_y[c(t + τ*)], which is never below c_min.";
      const xs = [], us = [];
      for (let j = 0; j < s.x.length && s.x[j] < b; j++) { xs.push(s.x[j]); us.push(s.u[j]); }
      f = frame(chart, { x: [0, Math.max(b + D.shift, 0.6)], y: [0, 0.45], aspect: 0.5, minH: 180, maxH: 260 });
      g = axes(f, { yl: "𝓛W(t, y)", xl: "evidence y", grid: true });
      g += hline(f, cmin, "acc", 'stroke-dasharray="5 4"') + text(f.W - f.r, f.sy(cmin) + 14, "c_min = 0.1", "tag-acc", "end");
      g += hline(f, cmax, "dim", 'stroke-dasharray="2 3"') + text(f.W - f.r, f.sy(cmax) - 5, "c_max = 0.4", "tk", "end");
      g += line(f, xs, us, "wb");
      legend.innerHTML = `<li><span class="key key-wb">E_y[c(t + τ*)], from the sweep</span></li><li><span class="key key-acc-dash">c_min</span></li>`;
      const lo = Math.min(...us);
      reads.innerHTML = `<div class="k-wb"><dt>Smallest 𝓛W below the bound</dt><dd>${fmt(lo, 3)}</dd></div><div class="k-acc"><dt>c_min</dt><dd>${cmin}</dd></div>`;
      say.textContent = S.regularSay(0, { t, lo, cmin });
      lab = "The curvature term of the value of waiting against the evidence, above the lowest cost";
    } else if (step === 1) {
      head.textContent = "Step 2: integrating twice from the bound, W grows at least like c_min times the squared distance to the bound.";
      const xs = s.x.filter((x) => x <= b + 0.15);
      const Wv = xs.map((x, j) => W[j]), par = xs.map((x) => (x < b ? cmin * (b - x) ** 2 : 0));
      f = frame(chart, { x: [0, b + 0.15], y: [0, Math.max(...Wv) * 1.12], aspect: 0.5, minH: 180, maxH: 260, l: 48 });
      g = axes(f, { yl: "value of waiting W", xl: "evidence y", grid: true });
      g += line(f, xs, par, "acc", 'stroke-dasharray="5 4"') + line(f, xs, Wv, "ex");
      g += vline(f, b, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(b) - 4, f.t + 10, "grid bound", "tag-ex", "end");
      let margin = Infinity;
      xs.forEach((x, j) => { if (x < b) margin = Math.min(margin, Wv[j] - par[j]); });
      legend.innerHTML = `<li><span class="key key-ex">W(t, y) = V − g, from the program</span></li><li><span class="key key-acc-dash">c_min (b − y)²</span></li>`;
      reads.innerHTML = `<div><dt>W(t, 0)</dt><dd>${fmt(W[0], 4)}</dd></div><div class="k-acc"><dt>c_min b²</dt><dd>${fmt(cmin * b * b, 4)}</dd></div>
        <div><dt>Smallest W − c_min(b − y)²</dt><dd>${S.sci(margin)}<small>below the grid's bound</small></dd></div>`;
      say.textContent = S.regularSay(1, { t, W0: W[0], par0: cmin * b * b, margin });
      lab = "The value of waiting against the evidence, above the parabola c_min times the squared distance to the bound";
    } else if (step === 2) {
      const t2 = t + GAP <= 3 ? t + GAP : t - GAP;
      const s2 = D.snap(t2), W2 = Wof(s2);
      const [lowS, lowW, highS, highW, tl, th] = s2.b < b ? [s2, W2, s, W, t2, t] : [s, W, s2, W2, t, t2];
      const y = lowS.b, j = Math.round(y / D.h);
      const Wy = highW[j] + (highW[j + 1] - highW[j]) * (y / D.h - j);
      const lower = cmin * (highS.b - lowS.b) ** 2, upper = (cmax - cmin) * GAP;
      head.textContent = "Step 3: at the lower bound's level, one time's W is 0 and the other's is pinned between two bounds.";
      const x0 = Math.max(0, y - 0.45), x1 = highS.b + 0.08;
      const xs = s.x.filter((x) => x >= x0 && x <= x1);
      const pick = (Wv) => xs.map((x) => Wv[Math.round(x / D.h)]);
      const ymax = Math.max(upper, ...pick(highW)) * 1.15;
      f = frame(chart, { x: [x0, x1], y: [0, ymax], aspect: 0.52, minH: 190, maxH: 270, l: 48 });
      g = axes(f, { yl: "value of waiting W", xl: "evidence y", grid: true });
      g += line(f, xs, pick(lowW), "ex-thin") + line(f, xs, pick(highW), "ex");
      g += vline(f, y, "dim", 'stroke-dasharray="2 3"');
      const X = f.sx(y);
      g += `<path class="acc" d="M${(X + 6).toFixed(1)} ${f.sy(lower).toFixed(1)}h14M${(X + 6).toFixed(1)} ${f.sy(upper).toFixed(1)}h14M${(X + 13).toFixed(1)} ${f.sy(lower).toFixed(1)}V${f.sy(upper).toFixed(1)}"/>`;
      g += text(X + 23, f.sy(upper) + 4, "Lipschitz cap", "tag-acc") + text(X + 23, f.sy(lower) + 4, "parabola floor", "tag-acc");
      g += dot(f, y, Wy, "ink-dot");
      legend.innerHTML = `<li><span class="key key-ex">W at time ${fmt(th, 2)}, the higher bound</span></li><li><span class="key key-ex-thin">W at time ${fmt(tl, 2)}, the lower bound</span></li>`;
      const db = highS.b - lowS.b;
      reads.innerHTML = `<div><dt>W there</dt><dd>${fmt(Wy, 4)}<small>at y = ${fmt(y, 3)}</small></dd></div>
        <div class="k-acc"><dt>Floor c_min Δb²</dt><dd>${fmt(lower, 4)}</dd></div>
        <div class="k-acc"><dt>Cap (c_max − c_min)|Δt|</dt><dd>${fmt(upper, 4)}</dd></div>
        <div><dt>|Δb| against C√|Δt|</dt><dd>${fmt(db, 3)}<small>allowed ${fmt(C * Math.sqrt(GAP), 3)}, C = √3</small></dd></div>`;
      say.textContent = S.regularSay(2, { tl, th, Wy, lower, upper, db, allowed: C * Math.sqrt(GAP) });
      lab = "The value of waiting at two times near the lower of their two bounds, with the floor and the cap that pin it";
    } else if (step === 3) {
      head.textContent = "Step 4: the bound can't rise faster than K√s, so a path that starts just below it crosses it almost at once.";
      const P = sample(t, eps);
      const all = [0.1, 0.03, 0.01].map((e) => ({ e, ...sample(t, e) }));
      const ss = range(0, P.Smax, 81);
      const ylo = P.b0 - 0.2, yhi = P.b0 + 0.3, sOut = (0.3 / Kc) ** 2;
      f = frame(chart, { x: [0, P.Smax], y: [ylo, yhi], aspect: 0.55, minH: 190, maxH: 280, l: 46 });
      g = axes(f, { yl: "evidence Y", xl: "time after t, s", grid: true });
      P.paths.forEach((pth) => { g += line(f, pth.map((p) => p[0]), pth.map((p) => p[1]), "path-dim"); const last = pth[pth.length - 1]; if (last[1] >= P.bAt(last[0]) - 1e-9) g += dot(f, last[0], last[1], "acc-dot", 2.6); });
      const sd = range(0, sOut, 60);
      g += line(f, sd, sd.map((u) => P.b0 + Kc * Math.sqrt(u)), "ex-thin", 'stroke-dasharray="5 4"');
      g += line(f, ss, ss.map(P.bAt), "ex");
      g += text(f.sx(sOut) + 6, f.t + 10, "b + K√s, K = 1 + √3", "tag-ex");
      legend.innerHTML = `<li><span class="key key-ex">The bound b(t + s), from the program</span></li><li><span class="key key-ex-thin">b + K√s, the most (b) allows it to rise</span></li><li><span class="key key-dim">Sampled paths from b − ε</span></li>`;
      reads.innerHTML = all.map((a) => `<div class="${a.e === eps ? "k-acc" : ""}"><dt>ε = ${a.e}</dt><dd>${S.sig(a.median)}<small>median time to cross; ${Math.round(a.share * 100)}% cross by s = ${P.Smax}</small></dd></div>`).join("");
      say.textContent = S.regularSay(3, { all });
      lab = "Sampled paths of the evidence from just below the bound, crossing it, with the fastest rise the Hölder bound allows";
    } else {
      head.textContent = "Step 5: so W(t, b − ε)/ε → 0: the value meets the reward for deciding with the same slope.";
      const x0 = Math.max(0, b - 0.45);
      const xs = s.x.filter((x) => x >= x0 && x <= b + 0.05);
      const Wv = xs.map((x) => W[Math.round(x / D.h)]);
      f = frame(chart, { x: [x0, b + 0.05], y: [0, Math.max(...Wv) * 1.15], aspect: 0.5, minH: 180, maxH: 260, l: 48 });
      g = axes(f, { yl: "value of waiting W", xl: "evidence y", grid: true });
      g += line(f, xs, Wv, "ex");
      const E = [0.4, 0.2, 0.1, 0.05].filter((e) => b - e >= x0 - 1e-9);
      const ratios = E.map((e) => { const j = Math.round((b - e) / D.h); const y = j * D.h; const w = W[j]; g += `<path class="acc" d="M${f.sx(b).toFixed(1)} ${f.sy(0).toFixed(1)}L${f.sx(y).toFixed(1)} ${f.sy(w).toFixed(1)}"/>` + dot(f, y, w, "acc-dot", 3); return { e, r: w / (b - y) }; });
      g += vline(f, b, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(b) - 4, f.t + 10, "grid bound", "tag-ex", "end");
      const ib = Math.floor(b / D.h);
      const slope = (s.V[ib] - s.V[ib - 1]) / D.h;
      legend.innerHTML = `<li><span class="key key-ex">W(t, y)</span></li><li><span class="key key-acc">Chords from the bound: slope W(t, b − ε)/ε</span></li>`;
      reads.innerHTML = ratios.map((r) => `<div class="k-acc"><dt>ε = ${r.e}</dt><dd>${fmt(r.r, 4)}<small>W(t, b − ε)/ε</small></dd></div>`).join("") +
        `<div><dt>V_y and g′ at the bound</dt><dd>${fmt(slope, 3)}<small>V's last cell; g′(b) = ${fmt(gPrime(b + D.shift), 3)}</small></dd></div>`;
      say.textContent = S.regularSay(4, { ratios, slope, gp: gPrime(b + D.shift), h: D.h });
      lab = "The value of waiting near the bound, with chords from the bound whose slopes shrink toward zero";
    }
    chart.innerHTML = svg(f, g, lab);
    liftReady(fig);
  };
  onSeg(el, "rg-t", (v) => { t = +v; draw(); });
  onSeg(el, "rg-eps", (v) => { eps = +v; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; draw(); });
  fixed((p) => { state.textContent = `Solving the dynamic program… ${Math.round(p * 100)}%`; }).then((m) => {
    D = m;
    state.textContent = `The paper's test schedule, c_min = 0.1 and c_max = 0.4; time step ${D.dt}, evidence step ${D.h}.`;
    keepDrawn(chart, draw);
  }).catch((e) => fail("regular", e));
}

// ---------------------------------------------------------------- plate: the band the bound can't leave
function bandPlate() {
  const fig = plate("band"), el = rootOf("band");
  if (!el) return;
  const FIG1A = { id: "jump", params: { at: 0.5, factor: 16 } };
  let mode = "fig", t0 = 0.5, guess = null, shown = false, data = null, choice = FIG1A, auto = !calm.matches, visible = false, timer = 0;
  el.innerHTML = `<div class="predict"><p>In Figure 1(a), the cost of time rises 16-fold, from 0.1 to 1.6, almost all of it between times 0.3 and 0.7. Can the best bound jump?</p>
      ${segHTML("bd-guess", [["jump", "Yes, it can jump"], ["cont", "No, it moves continuously"]], "", "Your guess")}
      <div class="actions" style="margin-top:8px"><button class="btn btn-go" type="button" id="bd-show">Show me</button></div>
      <p class="verdict" id="bd-verdict" aria-live="polite"></p></div>
    <div class="controls">${segHTML("bd-mode", [["fig", "Figure 1(a)"], ["yours", "Your schedule"]], mode, "Schedule")}
      <label class="dial" style="flex:1 1 12rem"><span class="ctl-key">Anchor time t₀</span><output id="bd-out"></output>
      <input type="range" id="bd-t0" min="0" max="2.5" step="0.01" value="${t0}" aria-label="Anchor time of the band"></label></div>
    <p class="fine" id="bd-note"></p>
    <div class="chart-wrap" id="bd-cost"></div><div class="chart-wrap" id="bd-chart"></div>
    <ul class="legend"><li><span class="key key-ex">Best bound, from the program</span></li><li><span class="key key-pm">Per-moment B(c(t))</span></li><li><span class="key key-acc">b(t₀) ± C√|t − t₀|</span></li></ul>
    <dl class="reads" id="bd-reads"></dl><p class="say" id="bd-say"></p><p class="fine" id="bd-state" aria-live="polite"></p>`;
  const costEl = $("#bd-cost", el), chart = $("#bd-chart", el), reads = $("#bd-reads", el), say = $("#bd-say", el), note = $("#bd-note", el);
  const state = $("#bd-state", el), verdict = $("#bd-verdict", el), inp = $("#bd-t0", el), out = $("#bd-out", el);
  const stats = () => {
    const { ts, bounds, shift, cMin, cMax } = data;
    const C = Math.sqrt((cMax - cMin) / cMin);
    const idx = ts.map((t, i) => (t <= VIEW + 1e-9 ? i : -1)).filter((i) => i >= 0);
    let ratio = 0, at = [0, 0];
    for (let a = 0; a < idx.length; a++) for (let b2 = a + 1; b2 < idx.length; b2++) {
      const i = idx[a], j = idx[b2], r = Math.abs(bounds[j] - bounds[i]) / Math.sqrt(ts[j] - ts[i]);
      if (r > ratio) { ratio = r; at = [ts[i], ts[j]]; }
    }
    let fall = 0, fallAt = 0;
    const w = Math.round(0.05 / (ts[1] - ts[0]));
    for (let a = 0; a + w < idx.length; a++) { const d = Math.abs(bounds[idx[a + w]] - bounds[idx[a]]); if (d > fall) { fall = d; fallAt = ts[idx[a]]; } }
    const cost = costOf(choice);
    let cfac = 1, cAt = 0;
    for (let t = 0; t <= VIEW - 0.05 + 1e-9; t += 0.005) { const f = Math.max(cost(t + 0.05) / cost(t), cost(t) / cost(t + 0.05)); if (f > cfac) { cfac = f; cAt = t; } }
    return { C, ratio, at, fall, fallAt, cfac, cAt, shift, cMin, cMax };
  };
  const drawCost = () => {
    const cost = costOf(choice), dl = deadlineOf(choice);
    const ts = range(0, VIEW, 251), cs = ts.map((t) => Math.min(cost(t), 50));
    const lo = Math.max(0.005, Math.min(...cs) / 1.6), hi = Math.min(60, Math.max(...cs) * 1.6);
    const f = frame(costEl, { x: [0, VIEW], y: [Math.min(lo, 0.05), Math.max(hi, 0.3)], ylog: true, aspect: 0.22, minH: 90, maxH: 130, b: 22, t: 18 });
    let g = axes(f, { yl: "cost, log scale", grid: true, xt: [] });
    g += line(f, ts, cs.map((c, i) => (dl !== null && ts[i] > dl ? NaN : c)), "cost");
    costEl.innerHTML = svg(f, g, `The cost of time for ${mode === "fig" ? "Figure 1(a)" : labelOf(choice)}`);
  };
  const draw = () => {
    out.textContent = t0.toFixed(2);
    drawCost();
    if (!data) { chart.innerHTML = ""; reads.innerHTML = ""; return; }
    const { ts, bounds, shift } = data;
    const st = stats();
    const view = ts.map((t, i) => (t <= VIEW + 1e-9 ? i : -1)).filter((i) => i >= 0);
    const T = view.map((i) => ts[i]), bc = view.map((i) => bounds[i] + shift);
    const cost = costOf(choice);
    const pm = T.map((t) => B(cost(t)));
    const top = Math.max(...bc, ...pm) * 1.12;
    const f = frame(chart, { x: [0, VIEW], y: [0, top], aspect: 0.55, minH: 200, maxH: 300 });
    let g = axes(f, { yl: "evidence bound", xl: "time", grid: true });
    const i0 = Math.round(t0 / (ts[1] - ts[0])), b0 = bounds[Math.min(i0, view.length - 1)] + shift;
    const tt = range(0, VIEW, 251), up = tt.map((t) => b0 + st.C * Math.sqrt(Math.abs(t - t0))), dn = tt.map((t) => Math.max(0, b0 - st.C * Math.sqrt(Math.abs(t - t0))));
    let d = "";
    tt.forEach((t, k) => { d += (k ? "L" : "M") + f.sx(t).toFixed(1) + " " + f.sy(Math.min(up[k], top * 1.02)).toFixed(1); });
    for (let k = tt.length - 1; k >= 0; k--) d += "L" + f.sx(tt[k]).toFixed(1) + " " + f.sy(dn[k]).toFixed(1);
    g += `<path class="band" d="${d}Z"/>`;
    g += line(f, tt, up, "acc") + line(f, tt, dn, "acc");
    g += line(f, T, pm, "pm") + line(f, T, bc, "ex");
    g += dot(f, t0, b0, "acc-dot", 4.5);
    chart.innerHTML = svg(f, g, `The best bound for ${mode === "fig" ? "Figure 1(a)" : labelOf(choice)}, with the band the Hölder bound allows around the anchor at time ${t0.toFixed(2)}`);
    reads.innerHTML = `<div class="k-acc"><dt>Hölder constant C</dt><dd>${fmt(st.C, 2)}<small>√((c_max − c_min)/c_min), c from ${fmt(st.cMin, 3)} to ${fmt(st.cMax, 3)}</small></dd></div>
      <div><dt>Bound's largest |Δb|/√|Δt|</dt><dd>${fmt(st.ratio, 2)}<small>over 0 to 2.5, every 0.01</small></dd></div>
      <div><dt>Bound's largest move in 0.05</dt><dd>${fmt(st.fall, 3)}<small>from time ${fmt(st.fallAt, 2)}; the band allows ${fmt(st.C * Math.sqrt(0.05), 2)}</small></dd></div>
      <div class="k-acc"><dt>Cost's largest change in 0.05</dt><dd>${S.fold(st.cfac)}-fold<small>from time ${fmt(st.cAt, 2)}</small></dd></div>`;
    say.textContent = S.bandSay(st.ratio, st.C, st.fall, st.cfac);
    if (guess || shown) verdict.textContent = mode === "fig" ? S.bandVerdict(guess, st.fall, st.cfac, st.C) : S.bandVerdictElse();
    liftReady(fig);
  };
  const run = () => {
    data = null;
    const ok = standing(choice);
    if (!ok.ok) { note.textContent = S.standingNote(ok.why, labelOf(choice)); state.textContent = ""; draw(); return; }
    note.textContent = mode === "fig" ? "Figure 1(a): 0.1, rising to 1.6 in a logistic step of scale 0.05 centered at time 0.5." : S.standingNote(ok.why, labelOf(choice));
    state.textContent = "Solving the dynamic program…";
    const mine = choice;
    draw();
    scheduleData(choice, FINE, (p) => { if (mine === choice) state.textContent = `Solving the dynamic program… ${Math.round(p * 100)}%`; }).then((m) => {
      if (mine !== choice) return;
      data = m;
      state.textContent = `Time step ${m.dt}, evidence step ${m.h}, a forced choice at time ${m.horizon}; the bound drawn is the grid's moved out by 0.5826√Δt. The band is a statement about the continuous bound, so the computed one is a comparison.`;
      draw();
    }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
  };
  const setMode = (m) => { mode = m; choice = mode === "fig" ? FIG1A : getChoice(); run(); };
  onSeg(el, "bd-mode", setMode);
  onSeg(el, "bd-guess", (v) => { guess = v; shown = true; if (mode !== "fig") { el.querySelector('input[name="bd-mode"][value="fig"]').checked = true; setMode("fig"); } else draw(); });
  $("#bd-show", el).addEventListener("click", () => { shown = true; if (mode !== "fig") { el.querySelector('input[name="bd-mode"][value="fig"]').checked = true; setMode("fig"); } else draw(); });
  inp.addEventListener("input", () => { auto = false; t0 = +inp.value; draw(); });
  window.addEventListener("cc-schedule", () => { if (mode === "yours" && keyOf(getChoice()) !== keyOf(choice)) { choice = getChoice(); run(); } });
  const tick = () => { timer = 0; if (!auto || !visible || !data) { if (auto && visible) timer = setTimeout(tick, 400); return; } t0 = t0 >= 2.4 ? 0.1 : +(t0 + 0.1).toFixed(2); inp.value = t0; draw(); timer = setTimeout(tick, 900); };
  watchVisible(fig, (v) => { visible = v; if (v && auto && !timer) timer = setTimeout(tick, 1200); });
  keepDrawn(chart, draw);
  run();
}

// ---------------------------------------------------------------- plate: the area, step by step (Proposition 4's strip)
function areaPlate() {
  const fig = plate("area"), el = rootOf("area");
  if (!el) return;
  let step = +(fig.dataset.step || 0), t = 1.2, z = 0.5, D = null, zAuto = true;
  el.innerHTML = `<div class="controls">${segHTML("ar-t", [[0.5, "0.5"], [1.2, "1.2"], [1.5, "1.5"], [2, "2"]], t, "Time t")}
      <label class="dial" style="flex:1 1 12rem" id="ar-zbox"><span class="ctl-key">Integrate up to z</span><output id="ar-out"></output>
      <input type="range" id="ar-z" min="0" max="1" step="0.001" value="0.5" aria-label="Upper end of the integral"></label></div>
    <p class="fine" id="ar-step"></p>
    <div class="chart-wrap" id="ar-a"></div><div class="chart-wrap" id="ar-b"></div>
    <ul class="legend" id="ar-legend"></ul>
    <dl class="reads" id="ar-reads"></dl><p class="say" id="ar-say"></p>
    <p class="fine" id="ar-state" aria-live="polite">Solving the dynamic program…</p>`;
  const ca = $("#ar-a", el), cb = $("#ar-b", el), reads = $("#ar-reads", el), say = $("#ar-say", el), head = $("#ar-step", el), legend = $("#ar-legend", el);
  const zin = $("#ar-z", el), zout = $("#ar-out", el), zbox = $("#ar-zbox", el), state = $("#ar-state", el);
  const curves = () => {
    const s = D.snap(t), bc = s.b + D.shift, c = testStep(s.t);
    const xs = [], f2 = [], R = [0];
    for (let j = 0; j < s.x.length && s.x[j] < bc; j++) { xs.push(s.x[j]); f2.push(2 * Math.cosh(s.x[j]) ** 2 * s.u[j]); }
    const ub = s.u[Math.floor(bc / D.h)] + (s.u[Math.floor(bc / D.h) + 1] - s.u[Math.floor(bc / D.h)]) * (bc / D.h - Math.floor(bc / D.h));
    xs.push(bc); f2.push(2 * Math.cosh(bc) ** 2 * ub);
    for (let j = 1; j < xs.length; j++) R.push(R[j - 1] + 0.5 * (f2[j] + f2[j - 1]) * (xs[j] - xs[j - 1]));
    // cosh^2 z V_y(z) from the program's value, by central differences, a cell or more inside the grid's bound
    const vz = [], vv = [];
    for (let j = 1; j + 1 < s.x.length && s.x[j + 1] < s.b; j += 3) { vz.push(s.x[j]); vv.push(Math.cosh(s.x[j]) ** 2 * (s.V[j + 1] - s.V[j - 1]) / (2 * D.h)); }
    return { s, bc, c, xs, f2, R, vz, vv };
  };
  const Rat = (cv, zz) => { let j = 1; while (j < cv.xs.length && cv.xs[j] < zz) j++; if (j >= cv.xs.length) return cv.R[cv.R.length - 1]; const w = (zz - cv.xs[j - 1]) / (cv.xs[j] - cv.xs[j - 1]); return cv.R[j - 1] + w * (cv.R[j] - cv.R[j - 1]); };
  const draw = () => {
    if (!D) return;
    const cv = curves();
    zin.max = cv.bc.toFixed(3);
    if (step >= 2) z = cv.bc; else if (zAuto) z = Math.min(z, cv.bc);
    z = Math.min(z, cv.bc);
    zin.value = z; zout.textContent = z.toFixed(2);
    zbox.hidden = step === 0;
    cb.hidden = step === 0;
    // chart a: the integrand, shaded up to z
    const top = Math.max(...cv.f2, 2 * cv.c * Math.cosh(cv.bc) ** 2) * 1.12;
    const fa = frame(ca, { x: [0, Math.max(cv.bc * 1.06, 0.6)], y: [0, top], aspect: 0.46, minH: 170, maxH: 250 });
    let g = axes(fa, { yl: "2 cosh² y × cost", xl: "evidence y", grid: true });
    if (step > 0) {
      const k = cv.xs.findIndex((x) => x > z), xs = cv.xs.slice(0, k < 0 ? cv.xs.length : k), fs = cv.f2.slice(0, xs.length);
      if (k > 0) { xs.push(z); fs.push(cv.f2[k - 1] + (cv.f2[k] - cv.f2[k - 1]) * (z - cv.xs[k - 1]) / (cv.xs[k] - cv.xs[k - 1])); }
      g += area(fa, xs, fs, 0, "wb-fill");
    }
    g += line(fa, cv.xs, cv.xs.map((x) => 2 * cv.c * Math.cosh(x) ** 2), "pm") + line(fa, cv.xs, cv.f2, "wb");
    g += vline(fa, cv.bc, "bound-line", 'stroke-dasharray="3 3"') + text(fa.sx(cv.bc) - 4, fa.t + 10, "b(t)", "tag-ex", "end");
    if (step === 1) g += vline(fa, z, "acc") + text(fa.sx(z) + 4, fa.H - fa.b - 6, "z", "tag-acc");
    ca.innerHTML = svg(fa, g, "Twice cosh squared of the evidence times the expected cost at decision, from 0 to the bound, shaded up to z");
    if (step === 0) {
      head.textContent = "Step 1: (cosh² y V_y)′ = 2 cosh² y E_y[c(t + τ*)] below the bound, and V_y = 0 at y = 0.";
      legend.innerHTML = `<li><span class="key key-wb">2 cosh² y E_y[c(t + τ*)]</span></li><li><span class="key key-pm">2 cosh² y c(t), the cost now</span></li>`;
      reads.innerHTML = `<div class="k-wb"><dt>E_y[c(t + τ*)] at y = 0</dt><dd>${fmt(cv.s.u[0], 3)}</dd></div><div class="k-acc"><dt>Cost now</dt><dd>${fmt(cv.c, 3)}</dd></div><div><dt>Bound b(t)</dt><dd>${fmt(cv.bc, 3)}</dd></div>`;
      say.textContent = S.areaSay(0, { t: cv.s.t, u0: cv.s.u[0], c: cv.c });
      liftReady(fig);
      return;
    }
    // chart b: both sides of step 2 against z, and the flat 1/2 of cosh^2 z g'(z)
    const fb = frame(cb, { x: [0, Math.max(cv.bc * 1.06, 0.6)], y: [0, 0.6], aspect: 0.4, minH: 160, maxH: 230 });
    let h = axes(fb, { yl: "cosh² z V_y(t, z)", xl: "z", grid: true });
    if (step >= 2) h += hline(fb, 0.5, "ex-thin", 'stroke-dasharray="5 4"') + text(fb.l + 4, fb.sy(0.5) - 5, "cosh² z g′(z) = ½ for every z", "tk");
    h += line(fb, cv.xs, cv.R, "wb");
    h += cv.vz.map((x, i) => dot(fb, x, cv.vv[i], "ink-dot", 2)).join("");
    const Rz = Rat(cv, z);
    h += dot(fb, z, Rz, "acc-dot", 4.5) + vline(fb, z, "acc", 'stroke-dasharray="2 3"');
    cb.innerHTML = svg(fb, h, "The integral of the shaded area against z, beside cosh squared of z times the slope of the value from the program");
    legend.innerHTML = `<li><span class="key key-wb">2∫₀ᶻ cosh² y E_y[c] dy</span></li><li><span class="key key-ink-dots">cosh² z V_y, from the program's value</span></li>${step >= 2 ? '<li><span class="key key-ex-thin">cosh² z g′(z) = ½</span></li>' : ""}`;
    const L = cv.R[cv.R.length - 1] / 2;
    if (step === 1) {
      head.textContent = "Step 2: integrate from 0 to z: the area is cosh² z V_y(t, z), the slope of the value scaled by cosh².";
      const gap = Math.max(...cv.vz.map((x, i) => Math.abs(cv.vv[i] - Rat(cv, x))));
      reads.innerHTML = `<div class="k-wb"><dt>Area to z, doubled</dt><dd>${fmt(Rz, 4)}</dd></div><div><dt>Largest gap to the dots</dt><dd>${S.sci(gap)}</dd></div>`;
      say.textContent = S.areaSay(1, { z, Rz, gap });
    } else if (step === 2) {
      head.textContent = "Step 3: at the bound, smooth fit turns the boundary term into cosh² b g′(b) = ½.";
      reads.innerHTML = `<div class="k-wb"><dt>Area to b(t), doubled</dt><dd>${fmt(2 * L, 4)}</dd></div><div><dt>Bound b(t)</dt><dd>${fmt(cv.bc, 3)}</dd></div>`;
      say.textContent = S.areaSay(2, { R: 2 * L, bc: cv.bc });
    } else {
      head.textContent = "Step 4: divide by 2: the area under cosh² y E_y[c(t + τ*)] from 0 to the bound is ¼.";
      const Bc = B(cv.c);
      reads.innerHTML = `<div class="k-wb"><dt>Left side</dt><dd>${fmt(L, 4)}<small>residual ${S.sci(L - 0.25)}</small></dd></div>
        <div><dt>Bound b(t)</dt><dd>${fmt(cv.bc, 3)}</dd></div><div class="k-pm"><dt>Per-moment B(c(t))</dt><dd>${fmt(Bc, 3)}</dd></div>`;
      say.textContent = S.areaSay(3, { L, bc: cv.bc, Bc, t: cv.s.t });
    }
    liftReady(fig);
  };
  zin.addEventListener("input", () => { zAuto = false; z = +zin.value; draw(); });
  onSeg(el, "ar-t", (v) => { t = +v; draw(); });
  fig.addEventListener("strip-step", (e) => { step = e.detail; if (step === 1 && zAuto) z = 0.5; draw(); });
  fixed((p) => { state.textContent = `Solving the dynamic program… ${Math.round(p * 100)}%`; }).then((m) => {
    D = m;
    state.textContent = `The paper's test schedule; time step ${D.dt}, evidence step ${D.h}; the integral runs to the grid's bound moved out by 0.5826√Δt.`;
    keepDrawn(ca, draw);
  }).catch((e) => fail("area", e));
}

// ---------------------------------------------------------------- plate: one equation, checked live
function livePlate() {
  const fig = plate("live"), el = rootOf("live");
  if (!el) return;
  let touched = false, choice = getChoice(), grid = "fine", far = false, res = { coarse: null, fine: null }, tm = 1.2, auto = !calm.matches, visible = false, raf = 0, last = 0;
  el.innerHTML = `<div class="controls">${pickerHTML("lv-pick")}
      ${segHTML("lv-grid", [["coarse", "Δt 0.01"], ["fine", "Δt 0.002"]], grid, "Grid")}
      ${segHTML("lv-far", [["0", "0 to 2.5"], ["1", "To the forced choice"]], "0", "Show")}</div>
    <p class="fine" id="lv-note"></p>
    <div class="chart-wrap" id="lv-cost"></div><div class="chart-wrap" id="lv-main"></div>
    <ul class="legend" id="lv-legend"><li><span class="key key-ex">Left side, from the program</span></li><li><span class="key key-pm">With the cost now in place of the cost at decision</span></li></ul>
    <div class="chart-wrap" id="lv-res"></div>
    <div class="controls" style="margin-top:12px" id="lv-time"><label class="dial" style="flex:1 1 12rem"><span class="ctl-key">Time on show</span><output id="lv-out"></output>
      <input type="range" id="lv-t" min="0" max="2.5" step="0.05" value="${tm}" aria-label="Time whose area is drawn"></label>
      <div class="actions"><button class="btn" type="button" id="lv-play" aria-pressed="${auto}">${auto ? "Pause" : "Play"}</button></div></div>
    <div class="chart-wrap" id="lv-area"></div>
    <dl class="reads" id="lv-reads"></dl><p class="say" id="lv-say"></p><p class="fine" id="lv-state" aria-live="polite"></p>`;
  const pick = $("#lv-pick", el), note = $("#lv-note", el), costEl = $("#lv-cost", el), mainEl = $("#lv-main", el), resEl = $("#lv-res", el), areaEl = $("#lv-area", el);
  const reads = $("#lv-reads", el), say = $("#lv-say", el), state = $("#lv-state", el), tin = $("#lv-t", el), tout = $("#lv-out", el), play = $("#lv-play", el);
  const cur = () => res[grid] || res[grid === "fine" ? "coarse" : "fine"];
  const worst = (m, upto) => { let w = 0, at = 0; m.ts.forEach((t, i) => { if (t <= upto + 1e-9 && Number.isFinite(m.lhs[i]) && Math.abs(m.lhs[i] - 0.25) > w) { w = Math.abs(m.lhs[i] - 0.25); at = t; } }); return { w, at }; };
  const drawCost = () => {
    const cost = costOf(choice), dl = deadlineOf(choice), X = far ? (res.fine || res.coarse)?.horizon ?? 10 : VIEW;
    const ts = range(0, X, 301), cs = ts.map((t) => Math.min(cost(t), 50));
    const lo = Math.max(0.005, Math.min(...cs) / 1.6), hi = Math.min(60, Math.max(...cs) * 1.6);
    const f = frame(costEl, { x: [0, X], y: [Math.min(lo, 0.05), Math.max(hi, 0.3)], ylog: true, aspect: 0.2, minH: 86, maxH: 120, b: 20, t: 18 });
    let g = axes(f, { yl: "cost, log scale", grid: true, xt: [] });
    g += line(f, ts, cs.map((c, i) => (dl !== null && ts[i] > dl ? NaN : c)), "cost");
    if (!far) g += vline(f, tm, "dim", 'stroke-dasharray="2 3"');
    costEl.innerHTML = svg(f, g, `The cost of time for ${labelOf(choice)}`);
  };
  const drawMain = () => {
    const m = cur();
    if (!m) { mainEl.innerHTML = ""; resEl.innerHTML = ""; return; }
    const X = far ? m.horizon : VIEW;
    const idx = m.ts.map((t, i) => (t <= X - (far ? m.dt : 0) + 1e-9 && Number.isFinite(m.lhs[i]) ? i : -1)).filter((i) => i >= 0);
    const T = idx.map((i) => m.ts[i]), L = idx.map((i) => m.lhs[i]), P = idx.map((i) => m.pm[i]);
    const lo = Math.min(0.24, ...L, ...P), hi = Math.max(0.26, ...L, ...P), pad = (hi - lo) * 0.08;
    const f = frame(mainEl, { x: [0, X], y: [lo - pad, hi + pad], aspect: 0.46, minH: 180, maxH: 270, l: 46 });
    let g = axes(f, { yl: "left side of the equation", xl: "time", grid: true });
    g += hline(f, 0.25, "ex-thin", 'stroke-dasharray="5 4"') + text(f.W - f.r, f.sy(0.25) - 5, "¼", "tag-ex", "end");
    g += line(f, T, P, "pm") + line(f, T, L, "ex");
    if (!far) g += vline(f, tm, "acc", 'stroke-dasharray="2 3"');
    mainEl.innerHTML = svg(f, g, `The left side of the exact equation over time for ${labelOf(choice)}, against one quarter, with the per-moment version`);
    // the residual, for both grids when both are in
    const r = (mm) => { const ii = mm.ts.map((t, i) => (t <= X - (far ? mm.dt : 0) + 1e-9 && Number.isFinite(mm.lhs[i]) ? i : -1)).filter((i) => i >= 0); return { T: ii.map((i) => mm.ts[i]), R: ii.map((i) => mm.lhs[i] - 0.25) }; };
    const other = res[grid === "fine" ? "coarse" : "fine"];
    const a = r(m), b = other && other !== m ? r(other) : null;
    const lim = Math.max(1e-4, ...a.R.map(Math.abs), ...(b ? b.R.map(Math.abs) : [])) * 1.15;
    const fr = frame(resEl, { x: [0, X], y: [-lim, lim], aspect: 0.26, minH: 110, maxH: 160, l: 52 });
    const sc = lim < 0.01 ? 1000 : 1;
    let h = axes(fr, { yl: sc === 1000 ? "left side − ¼, in thousandths" : "left side − ¼", grid: true, zero: true, fy: (v) => String(+(v * sc).toFixed(sc === 1000 ? 2 : 3)) });
    if (b) h += line(fr, b.T, b.R, "ex-thin");
    h += line(fr, a.T, a.R, "ex");
    if (b) h += text(fr.W - fr.r, fr.t + 10, `faint: ${grid === "fine" ? "Δt 0.01" : "Δt 0.002"}`, "tk", "end");
    resEl.innerHTML = svg(fr, h, "The residual of the exact equation over time");
  };
  const drawArea = () => {
    const m = cur();
    tout.textContent = tm.toFixed(2);
    if (!m) { areaEl.innerHTML = ""; return; }
    const s = m.snaps[Math.max(0, Math.min(m.snaps.length - 1, Math.round(tm / 0.05)))];
    const bc = s.b + m.shift, c = costOf(choice)(s.t);
    const xs = [], fs = [];
    for (let j = 0; j < s.x.length && s.x[j] < bc; j++) { xs.push(s.x[j]); fs.push(Math.cosh(s.x[j]) ** 2 * s.u[j]); }
    const j = Math.min(s.u.length - 2, Math.floor(bc / m.h)), ub = s.u[j] + (s.u[j + 1] - s.u[j]) * (bc / m.h - j);
    xs.push(bc); fs.push(Math.cosh(bc) ** 2 * ub);
    const pmv = xs.map((x) => c * Math.cosh(x) ** 2);
    const top = Math.max(...fs, ...pmv) * 1.12;
    const f = frame(areaEl, { x: [0, Math.max(bc * 1.12, 0.2)], y: [0, top], aspect: 0.4, minH: 160, maxH: 230 });
    let g = axes(f, { yl: `at time ${s.t.toFixed(2)}: cosh² y × cost`, xl: "evidence y", grid: true });
    g += area(f, xs, fs, 0, "wb-fill") + line(f, xs, pmv, "pm") + line(f, xs, fs, "wb");
    g += vline(f, bc, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(bc) - 4, f.t + 10, "b(t)", "tag-ex", "end");
    areaEl.innerHTML = svg(f, g, `At time ${s.t.toFixed(2)}, cosh squared times the expected cost at decision from 0 to the bound, shaded, beside cosh squared times the cost now`);
    const i = m.ts.findIndex((t) => Math.abs(t - s.t) < 1e-9);
    const w = worst(m, VIEW), wo = (() => { const o = res[grid === "fine" ? "coarse" : "fine"]; return o && o !== m ? worst(o, VIEW) : null; })();
    let pmw = 0; m.ts.forEach((t, k) => { if (t <= VIEW + 1e-9 && Number.isFinite(m.pm[k])) pmw = Math.max(pmw, Math.abs(m.pm[k] - 0.25)); });
    reads.innerHTML = `<div class="k-wb"><dt>Area at time ${s.t.toFixed(2)}</dt><dd>${fmt(m.lhs[i], 4)}<small>bound ${fmt(bc, 3)}</small></dd></div>
      <div><dt>Largest residual, 0 to 2.5</dt><dd>${S.sci(w.w)}<small>at time ${fmt(w.at, 2)}, on Δt ${m.dt}${wo ? `; ${S.sci(wo.w)} on Δt ${grid === "fine" ? 0.01 : 0.002}` : ""}</small></dd></div>
      <div class="k-pm"><dt>Cost now in its place</dt><dd>${fmt(pmw, 3)}<small>its largest miss of ¼</small></dd></div>`;
    say.textContent = S.liveSay({ label: labelOf(choice), dt: m.dt, w: w.w, at: w.at, wo: wo ? wo.w : NaN, dtOther: grid === "fine" ? 0.01 : 0.002, pm: pmw, far, tail: far ? tailMiss(m) : NaN, horizon: m.horizon, constant: choice.id === "constant" });
    liftReady(fig);
  };
  const tailMiss = (m) => { let w = 0; m.ts.forEach((t, i) => { if (t >= m.horizon - 1 && Number.isFinite(m.lhs[i])) w = Math.max(w, Math.abs(m.lhs[i] - 0.25)); }); return w; };
  const drawAll = () => { drawCost(); drawMain(); drawArea(); };
  const run = () => {
    res = { coarse: null, fine: null };
    pick.value = choice.id;
    const ok = standing(choice);
    note.textContent = S.standingNote(ok.why, labelOf(choice));
    $("#lv-legend", el).hidden = !ok.ok; $("#lv-time", el).hidden = !ok.ok;
    if (!ok.ok) { state.textContent = ""; reads.innerHTML = ""; say.textContent = ""; drawAll(); areaEl.innerHTML = ""; return; }
    const mine = choice;
    state.textContent = "Solving on the coarse grid…";
    drawAll();
    scheduleData(choice, COARSE).then((m) => {
      if (mine !== choice) return;
      res.coarse = m;
      if (!touched) { let w = -1; m.ts.forEach((t, i) => { if (t <= VIEW + 1e-9 && Number.isFinite(m.pm[i]) && Math.abs(m.pm[i] - 0.25) > w) { w = Math.abs(m.pm[i] - 0.25); tm = Math.round(t / 0.05) * 0.05; } }); tin.value = tm; }
      drawAll();
      state.textContent = "Solving on the paper's test grid (Δt 0.002, h 0.005)…";
      return scheduleData(choice, FINE, (p) => { if (mine === choice) state.textContent = `Solving on the paper's test grid (Δt 0.002, h 0.005)… ${Math.round(p * 100)}%`; });
    }).then((m) => {
      if (!m || mine !== choice) return;
      res.fine = m; drawAll();
      state.textContent = `Two grids: Δt 0.01 with h 0.02, and the paper's test grid, Δt 0.002 with h 0.005; a forced choice at time ${m.horizon}. The integral runs to the grid's bound moved out by 0.5826√Δt.`;
    }).catch((e) => { state.textContent = "The solver stopped: " + e.message; });
  };
  pick.addEventListener("change", () => { choice = choiceFromPick(pick.value); setChoice(choice); run(); });
  window.addEventListener("cc-schedule", () => { if (keyOf(getChoice()) !== keyOf(choice)) { choice = getChoice(); run(); } });
  onSeg(el, "lv-grid", (v) => { grid = v; drawAll(); });
  onSeg(el, "lv-far", (v) => { far = v === "1"; drawAll(); });
  tin.addEventListener("input", () => { stop(); touched = true; tm = +tin.value; drawCost(); drawMain(); drawArea(); });
  const loop = (now) => {
    raf = 0;
    if (!auto || !visible) return;
    if (now - last > 220) { last = now; tm = tm >= VIEW - 1e-9 ? 0 : +(tm + 0.05).toFixed(2); tin.value = tm; drawCost(); drawMain(); drawArea(); }
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { auto = false; play.textContent = "Play"; play.setAttribute("aria-pressed", "false"); };
  play.addEventListener("click", () => { if (auto) stop(); else { auto = true; play.textContent = "Pause"; play.setAttribute("aria-pressed", "true"); if (visible && !raf) raf = requestAnimationFrame(loop); } });
  if (calm.matches) stop();
  watchVisible(fig, (v) => { visible = v; if (v && auto && !raf) raf = requestAnimationFrame(loop); });
  keepDrawn(mainEl, drawAll);
  run();
}

// ---------------------------------------------------------------- plate: why cosh^2 (the remark on scale and speed)
function speedPlate() {
  const fig = plate("speed"), el = rootOf("speed");
  if (!el) return;
  let model = "y", lc = Math.log10(0.1);
  // the unknown-reliability bound U(kappa): int_0^U e^{v^2/2} dv = 1 / (2 sqrt(2 pi) kappa)
  const I = (U) => { const n = 400; let s = 0; for (let i = 0; i <= n; i++) { const v = (U * i) / n; s += (i === 0 || i === n ? 0.5 : 1) * Math.exp(v * v / 2); } return (s * U) / n; };
  const Ubound = (k) => { const rhs = 1 / (2 * Math.sqrt(2 * Math.PI) * k); let lo = 0, hi = 1; while (I(hi) < rhs) hi *= 2; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (I(mid) < rhs) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const M = {
    y: { name: "Y, the evidence's size", drift: "tanh y", sp: (y) => 1 / Math.cosh(y) ** 2, m: (y) => 2 * Math.cosh(y) ** 2, target: 0.5, bound: (c) => B(c), spText: "sech² y", mText: "2 cosh² y", tText: "½", costName: "c" },
    u: { name: "u, the belief with unknown reliability", drift: "u/2", sp: (u) => Math.exp(-u * u / 2), m: (u) => 2 * Math.exp(u * u / 2), target: 1 / Math.sqrt(2 * Math.PI), bound: Ubound, spText: "e^(−u²/2)", mText: "2e^(u²/2)", tText: "1/√(2π)", costName: "κ" },
  };
  el.innerHTML = `<div class="controls">${segHTML("sp-model", [["y", "This model"], ["u", "Unknown reliability"]], model, "Diffusion")}
      <label class="dial" style="flex:1 1 12rem"><span class="ctl-key" id="sp-ckey">Constant cost c</span><output id="sp-out"></output>
      <input type="range" id="sp-c" min="-2" max="0" step="0.01" value="${lc}" aria-label="Constant cost, on a log scale"></label></div>
    <p class="fine" id="sp-note"></p>
    <div class="chart-wrap" id="sp-chart"></div>
    <ul class="legend"><li><span class="key key-wb">Cost × speed density m, shaded to the bound</span></li><li><span class="key key-dim">Scale density s′ (right-hand numbers)</span></li></ul>
    <dl class="reads" id="sp-reads"></dl><p class="say" id="sp-say"></p>`;
  const chart = $("#sp-chart", el), reads = $("#sp-reads", el), say = $("#sp-say", el), out = $("#sp-out", el), inp = $("#sp-c", el), ckey = $("#sp-ckey", el), note = $("#sp-note", el);
  const draw = () => {
    const D = M[model], c = 10 ** lc, b = D.bound(c);
    out.textContent = fmt(c, 3);
    ckey.textContent = model === "y" ? "Constant cost c" : "Constant cost in information time κ";
    note.textContent = model === "y" ? "Proved for this model: the exact equation of Proposition 4." : "Carried over formally, not proved: the paper's section on unknown reliability writes this equation and computes with it, without analogs of Proposition 3 or Theorem 7.";
    const X = b * 1.15, ys = range(0, X, 160), cm = ys.map((y) => c * D.m(y));
    const inside = ys.filter((y) => y <= b), ins = inside.map((y) => c * D.m(y));
    const top = Math.max(...cm) * 1.08;
    const f = frame(chart, { x: [0, X], y: [0, top], aspect: 0.5, minH: 180, maxH: 260, r: 34 });
    let g = axes(f, { yl: `${D.costName} × m`, xl: model === "y" ? "evidence y" : "belief u", grid: true });
    g += area(f, [...inside, b], [...ins, c * D.m(b)], 0, "wb-fill") + line(f, ys, cm, "wb");
    // the scale density on its own 0-to-1 scale, at the right
    g += line(f, ys, ys.map((y) => D.sp(y) * top), "path-dim");
    g += text(f.W - f.r + 4, f.sy(top) + 4, "1", "tk") + text(f.W - f.r + 4, f.sy(0) + 4, "0", "tk");
    g += vline(f, b, "bound-line", 'stroke-dasharray="3 3"') + text(f.sx(b) - 4, f.t + 10, model === "y" ? "B(c)" : "U(κ)", "tag-ex", "end");
    chart.innerHTML = svg(f, g, `The cost times the speed density, shaded from 0 to the constant-cost bound, with the scale density`);
    // the shaded area by the trapezoid rule, against g'/s'
    const n = 400; let A = 0; for (let i = 0; i <= n; i++) { const y = (b * i) / n; A += (i === 0 || i === n ? 0.5 : 1) * c * D.m(y); } A *= b / n;
    const gs = model === "y" ? [0, 0.5, 1, 2].map((y) => (1 / (2 * Math.cosh(y) ** 2)) / D.sp(y)) : [0, 0.5, 1, 2].map((u) => (Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI)) / D.sp(u));
    reads.innerHTML = `<div><dt>Drift</dt><dd>${D.drift}</dd></div>
      <div><dt>s′ and m</dt><dd style="font-size:1.05rem">${D.spText}, ${D.mText}</dd></div>
      <div class="k-wb"><dt>Shaded area</dt><dd>${fmt(A, 4)}<small>reward slope ÷ s′ = ${D.tText} = ${fmt(D.target, 4)}, the same at every level: ${gs.map((v) => fmt(v, 3)).join(", ")} at 0, 0.5, 1, and 2</small></dd></div>
      <div><dt>Bound</dt><dd>${fmt(b, 3)}</dd></div>` + (model === "y" ? `
      <div class="k-wb"><dt>Mean decision time from m, normalized</dt><dd>${fmt(meanLookAhead(c), 3)}<small>chapter 6's look-ahead; ${fmt(meanDecisionTime(c), 2)} from 0</small></dd></div>` : "");
    say.textContent = S.speedSay(model, c, b, A, D.target);
    liftReady(fig);
  };
  onSeg(el, "sp-model", (v) => { model = v; draw(); });
  inp.addEventListener("input", () => { lc = +inp.value; draw(); });
  keepDrawn(chart, draw);
}

// ---------------------------------------------------------------- start
hero();
strips();
const lazy = [["frozen", frozenPlate], ["regular", regularPlate], ["band", bandPlate], ["area", areaPlate], ["live", livePlate], ["speed", speedPlate]];
for (const [id, fn] of lazy) { const f = plate(id); if (f) onVisible(f, () => { try { fn(); } catch (e) { fail(id, e); } }); }
