// The contents page's plate: the reader's schedule (a preset, its two settings, or a drawing) and, under it, the
// best bound for it from the dynamic program, beside the per-moment rule's bound.
import { PRESETS, DRAW, DRAW_TIMES, DRAW_MIN, DRAW_MAX, costOf, defaultDrawing, paramsOf, deadlineOf, VIEW, labelOf } from "./schedules-book.js";
import { getChoice, setChoice, solve, onVisible, liftReady } from "./book.js";
import { frame, line, axes, svg, tags, fmt, keepDrawn, dropAt } from "./chart.js";

const fig = document.getElementById("plate-schedule");
const rootEl = fig?.querySelector(".demo-root");

function build() {
  let choice = getChoice();
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  rootEl.innerHTML = `
<div class="controls">
  <label class="dial" style="flex:1 1 14rem"><span class="ctl-key">Schedule</span><span></span>
    <select class="pick" id="sch-pick">${groups.map((g) => `<optgroup label="${g}">${PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</optgroup>`).join("")}
    <optgroup label="Yours"><option value="draw">${DRAW.label}</option></optgroup></select></label>
  <div id="sch-dials" class="controls" style="flex:2 1 18rem;margin:0"></div>
</div>
<p class="fine" id="sch-note"></p>
<div class="chart-wrap pad" id="sch-cost"></div>
<div class="chart-wrap" id="sch-bound"></div>
<ul class="legend"><li><span class="key key-ex">Best bound</span></li><li><span class="key key-pm">Per-moment rule</span></li><li><span class="key key-cost">Cost of time</span></li></ul>
<dl class="reads" id="sch-reads"></dl>
<p class="fine" id="sch-state" aria-live="polite"></p>`;
  const pick = rootEl.querySelector("#sch-pick"), dials = rootEl.querySelector("#sch-dials"), note = rootEl.querySelector("#sch-note");
  const costEl = rootEl.querySelector("#sch-cost"), boundEl = rootEl.querySelector("#sch-bound");
  const reads = rootEl.querySelector("#sch-reads"), state = rootEl.querySelector("#sch-state");
  let result = null, timer = 0;

  const fmtParam = (q, v) => (q.unit === "%" ? `${Math.round(v * 100)}%` : `${+v.toFixed(3)}${q.unit && q.unit !== "%" ? q.unit : ""}`);
  function renderDials() {
    pick.value = choice.id;
    if (choice.id === "draw") {
      dials.innerHTML = `<button class="btn" type="button" id="sch-reset">Start the drawing over</button>`;
      dials.querySelector("#sch-reset").addEventListener("click", () => { choice = { id: "draw", points: defaultDrawing() }; commit(); });
      note.textContent = "Drag across the cost chart to draw. Your drawing holds its last value after time 2.5.";
      return;
    }
    const p = PRESETS.find((x) => x.id === choice.id);
    const vals = paramsOf(choice);
    dials.innerHTML = p.params.map((q) => `<label class="dial"><span class="ctl-key">${q.label}</span><output>${fmtParam(q, vals[q.id])}</output>
      <input type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${vals[q.id]}" data-k="${q.id}" aria-label="${q.label}"></label>`).join("");
    dials.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
      const q = p.params.find((x) => x.id === inp.dataset.k);
      choice = { id: p.id, params: { ...paramsOf(choice), [q.id]: +inp.value } };
      inp.previousElementSibling.textContent = fmtParam(q, +inp.value);
      drawCost(); commit(true);
    }));
    note.textContent = p.note;
  }

  function drawCost() {
    const cost = costOf(choice), dl = deadlineOf(choice);
    const view = dl ?? VIEW;
    const ts = Array.from({ length: 251 }, (_, i) => (i / 250) * view);
    const cs = ts.map((t) => cost(t));
    const finite = cs.filter(Number.isFinite);
    const lo = Math.max(0.005, Math.min(...finite) / 1.6), hi = Math.min(40, Math.max(...finite) * 1.6);
    const f = frame(costEl, { x: [0, view], y: [Math.min(lo, 0.05), Math.max(hi, 0.3)], ylog: true, aspect: 0.32, minH: 120, maxH: 190, b: 26 });
    let inner = axes(f, { yl: "cost of time", grid: true });
    inner += line(f, ts, cs, "cost");
    if (dl !== null) inner += `<path class="acc" stroke-dasharray="3 3" d="M${f.sx(dl).toFixed(1)} ${f.t}V${f.H - f.b}"/><text class="tag-acc" x="${(f.sx(dl) - 4).toFixed(1)}" y="${f.t + 10}" text-anchor="end">forced choice</text>`;
    if (choice.id === "draw") inner += choice.points.map((c, i) => `<circle class="acc-dot" cx="${f.sx(DRAW_TIMES[i]).toFixed(1)}" cy="${f.sy(c).toFixed(1)}" r="2.2"/>`).join("");
    inner += `<rect class="hit" x="${f.l}" y="${f.t}" width="${f.W - f.l - f.r}" height="${f.H - f.t - f.b}"/>`;
    costEl.innerHTML = svg(f, inner, `The cost of time for ${labelOf(choice)}, on a log scale, over time 0 to ${view}`);
    costEl._f = f;
    costEl.classList.toggle("is-draw", choice.id === "draw");
  }

  function drawBound() {
    if (!result) { boundEl.innerHTML = ""; return; }
    const { t, exact, pm } = result;
    const top = Math.max(...exact.filter(Number.isFinite), ...pm.filter(Number.isFinite)) * 1.12;
    const f = frame(boundEl, { x: [0, t[t.length - 1]], y: [0, Math.max(0.4, top)], aspect: 0.42, minH: 160, maxH: 260 });
    let inner = axes(f, { yl: "bound (evidence)", xl: "time", grid: true });
    const [tp, pmp] = dropAt(t, pm, result.deadline);   // the rule's bound holds until the forced choice, then drops
    inner += line(f, tp, pmp, "pm") + line(f, t, exact, "ex");
    boundEl.innerHTML = svg(f, inner, `The best bound and the per-moment rule's bound for ${labelOf(choice)}`);
    // readings: where the two bounds differ most, and the bound at the start
    let gi = 0, g = -1;
    for (let i = 0; i < t.length; i++) { const d = Math.abs(exact[i] - pm[i]); if (Number.isFinite(d) && d > g) { g = d; gi = i; } }
    reads.innerHTML = `<div><dt>Best bound at time 0</dt><dd>${fmt(exact[0])}</dd></div>
      <div class="k-pm"><dt>Per-moment at time 0</dt><dd>${fmt(pm[0])}</dd></div>
      <div><dt>Largest gap at the solver's times</dt><dd>${fmt(g)}<small>at time ${fmt(t[gi])}</small></dd></div>`;
    liftReady(fig);
  }

  function commit(soft = false) {
    if (!soft) renderDials();
    drawCost();
    setChoice(choice);
    clearTimeout(timer);
    state.textContent = "Solving the dynamic program…";
    timer = setTimeout(() => {
      solve({ job: "bounds", choice }, { key: "contents" }).then((m) => {
        result = m; state.textContent = ""; drawBound();
      }).catch((e) => { if (e.message !== "superseded") state.textContent = "The solver stopped: " + e.message; });
    }, soft ? 160 : 0);
  }

  pick.addEventListener("change", () => {
    if (pick.value === "draw") {
      const cost = costOf(choice);
      choice = { id: "draw", points: choice.id === "draw" ? choice.points : DRAW_TIMES.map((t) => Math.min(DRAW_MAX, Math.max(DRAW_MIN, cost(t)))) };
      if (choice.points.some((c) => !Number.isFinite(c))) choice.points = defaultDrawing();
    } else {
      choice = { id: pick.value, params: paramsOf({ id: pick.value }) };
    }
    commit();
  });

  // drawing: a drag across the cost chart sets the points it passes over
  let drawing = false, lastI = null;
  const setAt = (e) => {
    const f = costEl._f; if (!f) return;
    const r = costEl.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * f.W, py = ((e.clientY - r.top) / r.height) * f.H;
    const tv = f.ix(px), cv = Math.min(DRAW_MAX, Math.max(DRAW_MIN, f.iy(py)));
    const i = Math.max(0, Math.min(DRAW_TIMES.length - 1, Math.round(tv * 10)));
    const pts = choice.points.slice();
    if (lastI !== null && lastI !== i) {
      const a = Math.min(lastI, i), b = Math.max(lastI, i), la = Math.log(pts[lastI]), lb = Math.log(cv);
      for (let j = a; j <= b; j++) pts[j] = Math.exp(la + ((lb - la) * (j - lastI)) / (i - lastI));
    } else pts[i] = cv;
    pts[i] = cv; lastI = i;
    choice = { id: "draw", points: pts };
    drawCost();
  };
  costEl.addEventListener("pointerdown", (e) => {
    // a finger scrolls the page unless the reader picked Draw your own; a mouse can start a drawing anywhere
    if (choice.id !== "draw" && (e.pointerType !== "mouse" || !e.target.closest("rect.hit"))) return;
    if (choice.id !== "draw") {
      const cost = costOf(choice);
      choice = { id: "draw", points: DRAW_TIMES.map((t) => Math.min(DRAW_MAX, Math.max(DRAW_MIN, Number.isFinite(cost(t)) ? cost(t) : DRAW_MAX))) };
      renderDials();
    }
    drawing = true; lastI = null; costEl.setPointerCapture(e.pointerId); setAt(e); e.preventDefault();
  });
  costEl.addEventListener("pointermove", (e) => { if (drawing) setAt(e); });
  const end = () => { if (drawing) { drawing = false; commit(true); } };
  costEl.addEventListener("pointerup", end); costEl.addEventListener("pointercancel", end);

  keepDrawn(costEl, drawCost);
  keepDrawn(boundEl, drawBound);
  if (choice.id === "draw" && !Array.isArray(choice.points)) choice = { id: "draw", points: defaultDrawing() };
  commit();
}

if (rootEl) onVisible(fig, build, "600px");
