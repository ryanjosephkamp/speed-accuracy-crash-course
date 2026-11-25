// The claim map: the paper's 50 claims and the 118 places one uses another, drawn seven ways, with a switcher
// whose choice the reader's browser keeps. Focus (the default) shows one claim with what it uses above it and
// what uses it below; Layers puts each claim below everything it uses; Outline lists the chapters with each
// claim's links written out; Book path lists the claims in the book's order with each use drawn as an arc. Cloud,
// Tower, and Pages draw the map in 3D (claim-map-3d.js, loaded only when a reader picks one). On a chapter's page,
// that chapter's claims are lit in every view and Focus opens on its main result.
//
//   mountMap(el, { data, chapter, focus, links })   data: book/content/map.json; links: { id: href } for built pages

const VIEWS = [["focus", "Focus"], ["layers", "Layers"], ["outline", "Outline"], ["path", "Book path"], ["cloud", "Cloud"], ["tower", "Tower"], ["pages", "Pages"]];
const VIEWS_3D = ["cloud", "tower", "pages"];
const KEY = "cc-map-view";
const store = {
  get() { try { const v = localStorage.getItem(KEY); return VIEWS.some(([k]) => k === v) ? v : "focus"; } catch (e) { return "focus"; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: the choice lasts this visit */ } },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// "Section 4.1" for a number, "Sections 1, 8" for several, and the words themselves otherwise ("Abstract, 1")
const secText = (x) => (/^[\d.]+$/.test(x) ? `Section ${x}` : /^[\d., ]+$/.test(x) ? `Sections ${x}` : String(x));
const curve = (x1, y1, x2, y2) => { const my = (y1 + y2) / 2; return `M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`; };
const rel = (el, box) => { const r = el.getBoundingClientRect(); return { x: r.left - box.left + r.width / 2, top: r.top - box.top, bot: r.bottom - box.top, mid: r.top - box.top + r.height / 2 }; };

export function mountMap(root, { data, chapter = null, focus = "thm:main", links = {} }) {
  const D = data, N = D.nodes;
  const deps = {}, uses = {}, pos = {};
  D.order.forEach((id, i) => { deps[id] = []; uses[id] = []; pos[id] = i; });
  D.edges.forEach(([a, b]) => { deps[b].push(a); uses[a].push(b); });
  const byOrder = (a, b) => pos[a] - pos[b];
  const closure = (id, next) => { const seen = {}; const stack = next[id].slice(); while (stack.length) { const x = stack.pop(); if (!seen[x]) { seen[x] = 1; stack.push(...next[x]); } } return seen; };
  const here = (id) => chapter !== null && N[id].ch === chapter;
  const chip = (id, cls = "") => `<button type="button" class="node${cls ? " " + cls : ""}${here(id) ? " here" : ""}" data-id="${id}" title="${esc(N[id].name)}"><span class="dot s-${N[id].status}"></span>${esc(N[id].label)}</button>`;
  const where = (id) => {
    const n = N[id];
    if (links[id]) return `<a href="${esc(links[id])}">Read it in chapter ${n.ch}</a>`;
    return `Chapter ${n.ch}, coming`;
  };
  const chTitle = (num) => D.chapters.find((c) => c.num === num)?.title ?? "";
  const uid = "cm" + Math.random().toString(36).slice(2, 7);

  root.classList.add("cmap");
  root.innerHTML = `
<div class="cm-top">
  <fieldset class="seg cm-switch"><legend>Map</legend><div class="cm-rows">${[VIEWS.filter(([k]) => !VIEWS_3D.includes(k)), VIEWS.filter(([k]) => VIEWS_3D.includes(k))].map((set, i) =>
    `<div class="seg-row"${i ? ' aria-label="In 3D"' : ""}>${i ? '<span class="cm-3d-tag" aria-hidden="true">3D</span>' : ""}${set.map(([k, l]) =>
    `<label><input type="radio" name="${uid}-view" value="${k}"><span>${l}</span></label>`).join("")}</div>`).join("")}</div></fieldset>
  <ul class="cm-key" aria-label="Key">
    <li><span class="dot s-definition"></span>definition</li><li><span class="dot s-proved"></span>proved</li>
    <li><span class="dot s-formal"></span>formal or conjectured</li><li><span class="dot s-numerical"></span>measured</li>
    <li><span class="dot s-cited"></span>cited or computed</li>${chapter !== null ? `<li><span class="cm-here-key"></span>this chapter</li>` : ""}
  </ul>
</div>
<div class="cm-view" data-view="focus">
  <p class="cm-how">One claim in the middle: above it, what it uses (slate); below it, what uses it (green); one more step each way in gray. Tap a claim to move to it.</p>
  <div class="cm-controls"><select class="pick cm-select" aria-label="Claim"></select><button type="button" class="btn cm-back" disabled>Back</button></div>
  <div class="cm-hood"></div>
</div>
<div class="cm-view" data-view="layers">
  <p class="cm-how">Each claim sits on a row below everything it uses, so the paper reads from the definitions down. Tap a claim to highlight what it uses, directly or through others (slate), and what uses it (green).</p>
  <div class="cm-layers"></div><p class="cm-info" aria-live="polite"></p>
</div>
<div class="cm-view" data-view="outline">
  <p class="cm-how">The chapters as a list, with each claim's links written out. Tap a link to jump to that claim.</p>
  <div class="cm-outline"></div>
</div>
<div class="cm-view" data-view="path">
  <p class="cm-how">The claims in the order the book teaches them, with each use drawn as an arc on the left. A dashed arc marks a use of something the book teaches later (rust until highlighted). Tap a claim to highlight its arcs.</p>
  <div class="cm-arcs"></div><p class="cm-info" aria-live="polite"></p>
</div>
<div class="cm-view" data-view="cloud">
  <p class="cm-how">The claims in 3D, pulled together by their uses, so claims that share many uses gather; where a claim sits means nothing else. Drag sideways to turn it, pinch to zoom, and tap a claim to read it below.</p>
  <div class="cm3"><p class="cm-info">Loading the 3D map…</p></div>
</div>
<div class="cm-view" data-view="tower">
  <p class="cm-how">Each claim sits below everything it uses, as in Layers, with the chapters standing around a ring. Drag sideways to turn it, or tap a chapter's number at the foot to bring that chapter to the front.</p>
  <div class="cm3"><p class="cm-info">Loading the 3D map…</p></div>
</div>
<div class="cm-view" data-view="pages">
  <p class="cm-how">One page per chapter, chapter 1 at the back, with each page's entries set by layer. On the page in hand, the outlines of the number badges of the pages it uses turn slate and of the pages that use it green (slate wins where links run both ways); tap a page's number to take it in hand.</p>
  <div class="cm3"><p class="cm-info">Loading the 3D map…</p></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const views = root.querySelectorAll(".cm-view");
  const radios = root.querySelectorAll(`input[name="${uid}-view"]`);
  let current = null;
  const drawn = {};

  // ---- Focus
  const hood = $(".cm-hood"), sel = $(".cm-select"), back = $(".cm-back");
  const hist = [];
  if (!N[focus]) focus = D.order[0];
  function initFocus() {
    sel.innerHTML = D.chapters.map((c) => `<optgroup label="${esc(`Chapter ${c.num} · ${c.title}`)}">${c.items.map((id) => `<option value="${id}">${esc(N[id].name)}</option>`).join("")}</optgroup>`).join("");
    sel.addEventListener("change", () => go(sel.value));
    back.addEventListener("click", () => { if (hist.length) { focus = hist.pop(); renderFocus(); } });
    hood.addEventListener("click", (e) => { const b = e.target.closest(".node"); if (b) go(b.dataset.id); });
    renderFocus();
  }
  function go(id) { if (id === focus) return; hist.push(focus); focus = id; renderFocus(); }
  function renderFocus() {
    sel.value = focus; back.disabled = !hist.length;
    const up = deps[focus], down = uses[focus], farUp = {}, farDown = {};
    up.forEach((d) => deps[d].forEach((x) => { if (!up.includes(x) && x !== focus) farUp[x] = 1; }));
    down.forEach((d) => uses[d].forEach((x) => { if (!down.includes(x) && x !== focus) farDown[x] = 1; }));
    const n = N[focus];
    const row = (ids, cls, tag) => `<div class="hood-row ${cls}"><div class="hood-tag"><span>${tag}</span></div>${ids.length ? ids.map((id) => chip(id, cls === "far" ? "far" : "")).join("") : `<span class="none">nothing in the map</span>`}</div>`;
    hood.innerHTML = `<svg aria-hidden="true"></svg>` +
      (Object.keys(farUp).length ? row(Object.keys(farUp).sort(byOrder), "far", "Two steps back") : "") +
      row(up.slice().sort(byOrder), "uses", "It uses") +
      `<div class="center-card${here(focus) ? " here" : ""}"><div class="k">${esc(n.kind)} · chapter ${n.ch} · ${esc(chTitle(n.ch))}</div><h3>${esc(n.name)}</h3>` +
      `<p>${esc(secText(n.sec))} · page ${n.page} · ${esc(n.statusLabel)} · ${where(focus)}</p></div>` +
      row(down.slice().sort(byOrder), "usedby", "Used by") +
      (Object.keys(farDown).length ? row(Object.keys(farDown).sort(byOrder), "far", "Two steps forward") : "");
    drawFocus();
  }
  function drawFocus() {
    const svg = hood.querySelector("svg"); if (!svg || !hood.offsetParent) return;
    const box = hood.getBoundingClientRect(), card = rel(hood.querySelector(".center-card"), box);
    let p = "";
    hood.querySelectorAll(".hood-row.uses .node").forEach((b) => { const r = rel(b, box); p += `<path class="up" d="${curve(r.x, r.bot, card.x, card.top)}"/>`; });
    hood.querySelectorAll(".hood-row.usedby .node").forEach((b) => { const r = rel(b, box); p += `<path class="down" d="${curve(card.x, card.bot, r.x, r.top)}"/>`; });
    svg.innerHTML = p;
  }

  // ---- Layers
  const layers = $(".cm-layers"), linfo = root.querySelector('[data-view="layers"] .cm-info');
  let lsel = null;
  function initLayers() {
    const byDepth = {};
    D.order.forEach((id) => { (byDepth[N[id].depth] = byDepth[N[id].depth] || []).push(id); });
    layers.innerHTML = `<svg aria-hidden="true"></svg>` + Object.keys(byDepth).map(Number).sort((a, b) => a - b).map((d) =>
      `<div class="layer"><span class="ln">${d}</span><div class="row">${byDepth[d].map((id) => chip(id)).join("")}</div></div>`).join("");
    layers.addEventListener("click", (e) => { const b = e.target.closest(".node"); if (b) selectLayer(b.dataset.id); });
    selectLayer(focus);
  }
  function selectLayer(id) {
    lsel = id;
    const up = closure(id, deps), down = closure(id, uses);
    layers.classList.add("sel");
    layers.querySelectorAll(".node").forEach((b) => { const x = b.dataset.id; b.classList.toggle("on", x === id); b.classList.toggle("up", !!up[x]); b.classList.toggle("down", !!down[x]); });
    linfo.innerHTML = `<strong>${esc(N[id].name)}</strong> (${esc(N[id].statusLabel.toLowerCase())}) uses ${Object.keys(up).length === 1 ? "1 entry" : Object.keys(up).length + " entries"}, directly or through others, and ${Object.keys(down).length === 1 ? "1 uses" : Object.keys(down).length + " use"} it. ${where(id)}.`;
    drawLayers();
  }
  function drawLayers() {
    const svg = layers.querySelector("svg"); if (!svg || !layers.offsetParent) return;
    const box = layers.getBoundingClientRect(), P = {};
    layers.querySelectorAll(".node").forEach((b) => { P[b.dataset.id] = rel(b, box); });
    const up = lsel ? closure(lsel, deps) : {}, down = lsel ? closure(lsel, uses) : {};
    let faint = "", hot = "";
    D.edges.forEach(([a0, b0]) => {
      const a = P[a0], b = P[b0]; if (!a || !b) return;
      const d = curve(a.x, a.bot, b.x, b.top);
      if ((up[a0] || a0 === lsel) && (up[b0] || b0 === lsel)) hot += `<path class="up" d="${d}"/>`;
      else if ((down[b0] || b0 === lsel) && (down[a0] || a0 === lsel)) hot += `<path class="down" d="${d}"/>`;
      else faint += `<path d="${d}"/>`;
    });
    svg.innerHTML = faint + hot;
  }

  // ---- Outline
  const outline = $(".cm-outline");
  const oid = (id) => `${uid}-o-${id.replace(/[^a-z0-9]/gi, "-")}`;
  function initOutline() {
    outline.innerHTML = D.chapters.map((c) => {
      const open = chapter === null ? c.num === N[focus].ch : c.num === chapter;
      return `<details${open ? " open" : ""}${chapter === c.num ? ' class="here"' : ""}><summary><span class="cn">${c.num}</span>${esc(c.title)}<span class="cc">${c.items.length === 1 ? "1 entry" : c.items.length + " entries"}${chapter === c.num ? " · this chapter" : ""}</span></summary>` +
        c.items.map((id) => {
          const n = N[id];
          const link = (x) => `<a href="#${oid(x)}" data-go="${x}">${esc(N[x].label)}${N[x].ch !== n.ch ? ` <span class="m">(ch. ${N[x].ch})</span>` : ""}</a>`;
          return `<div class="oitem" id="${oid(id)}"><div class="t"><span class="dot s-${n.status}"></span>${esc(n.name)}</div>` +
            `<div class="m">${esc(n.kind)} · ${esc(secText(n.sec).toLowerCase())} · page ${n.page} · ${esc(n.statusLabel)} · ${where(id)}</div>` +
            `<div class="ln2 uses"><span class="k">Uses</span>${deps[id].length ? deps[id].slice().sort(byOrder).map(link).join("") : `<span class="m">nothing in the map</span>`}</div>` +
            `<div class="ln2 usedby"><span class="k">Used by</span>${uses[id].length ? uses[id].slice().sort(byOrder).map(link).join("") : `<span class="m">nothing in the map</span>`}</div></div>`;
        }).join("") + `</details>`;
    }).join("");
    outline.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-go]"); if (!a) return;
      e.preventDefault();
      const el = document.getElementById(oid(a.dataset.go));
      el.closest("details").open = true;
      el.scrollIntoView({ block: "center" });
      el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
    });
  }

  // ---- Book path
  const arcs = $(".cm-arcs"), ainfo = root.querySelector('[data-view="path"] .cm-info');
  let asel = null;
  function initPath() {
    arcs.innerHTML = `<svg aria-hidden="true"></svg>` + D.chapters.map((c) =>
      `<div class="achap${chapter === c.num ? " here" : ""}">${c.num} · ${esc(c.title)}${chapter === c.num ? " · this chapter" : ""}</div>` +
      c.items.map((id) => `<div class="astop">${chip(id)}</div>`).join("")).join("");
    arcs.addEventListener("click", (e) => { const b = e.target.closest(".node"); if (b) selectArc(b.dataset.id); });
    selectArc(focus);
  }
  function selectArc(id) {
    asel = id;
    arcs.classList.add("sel");
    arcs.querySelectorAll(".node").forEach((b) => { const x = b.dataset.id; b.classList.toggle("on", x === id); b.classList.toggle("up", deps[id].includes(x)); b.classList.toggle("down", uses[id].includes(x)); });
    const fwd = deps[id].filter((x) => pos[x] > pos[id]).length;
    ainfo.innerHTML = `<strong>${esc(N[id].name)}</strong> (${esc(N[id].statusLabel.toLowerCase())}) uses ${deps[id].length === 1 ? "1 entry" : deps[id].length + " entries"}${fwd ? ` (${fwd} taught later in the book)` : ""}, and ${uses[id].length === 1 ? "1 uses" : uses[id].length + " use"} it. ${where(id)}.`;
    drawPath();
  }
  function drawPath() {
    const svg = arcs.querySelector("svg"); if (!svg || !arcs.offsetParent) return;
    const g = Math.max(64, Math.min(120, arcs.clientWidth * 0.26));
    arcs.style.setProperty("--g", g + "px");
    const box = arcs.getBoundingClientRect(), P = {};
    arcs.querySelectorAll(".astop .node").forEach((b) => { P[b.dataset.id] = rel(b, box); });
    svg.setAttribute("width", g); svg.setAttribute("height", arcs.scrollHeight);
    const x0 = g - 6;
    let faint = "", hot = "", dots = "";
    D.order.forEach((id) => { if (P[id]) dots += `<circle cx="${x0}" cy="${P[id].mid.toFixed(1)}" r="2.2"/>`; });
    D.edges.forEach(([a0, b0]) => {
      const a = P[a0], b = P[b0]; if (!a || !b) return;
      const y1 = a.mid, y2 = b.mid, bulge = Math.min(g - 10, 6 + Math.abs(y2 - y1) * 0.16);
      const d = `M${x0},${y1.toFixed(1)} C${(x0 - bulge).toFixed(1)},${y1.toFixed(1)} ${(x0 - bulge).toFixed(1)},${y2.toFixed(1)} ${x0},${y2.toFixed(1)}`;
      const fw = pos[a0] > pos[b0] ? " fwd-lit" : "";   // a forward use stays dashed when highlighted
      if (b0 === asel) hot += `<path class="up${fw}" d="${d}"/>`;
      else if (a0 === asel) hot += `<path class="down${fw}" d="${d}"/>`;
      else faint += `<path${pos[a0] > pos[b0] ? ' class="fwd"' : ""} d="${d}"/>`;
    });
    svg.innerHTML = faint + hot + dots;
  }

  // ---- Cloud, Tower, and Pages: the 3D module loads the first time a reader picks one of them
  const d3 = {};
  function init3d(name) {
    const box = root.querySelector(`[data-view="${name}"] .cm3`);
    import("./claim-map-3d.js?v=942da027e0").then(({ mount3d }) => {
      d3[name] = mount3d(box, { view: name, data: D, chapter, focus, where });
      if (current === name) d3[name]?.resize();
    }).catch((e) => { box.innerHTML = '<p class="plate-fail">The 3D map could not load. Focus, Layers, Outline, and Book path still work.</p>'; console.error(e); });
  }
  const INIT = { focus: initFocus, layers: initLayers, outline: initOutline, path: initPath };
  const REDRAW = { focus: drawFocus, layers: drawLayers, path: drawPath };
  VIEWS_3D.forEach((k) => { INIT[k] = () => init3d(k); REDRAW[k] = () => d3[k]?.resize(); });
  function show(name, remember) {
    current = name;
    radios.forEach((r) => { r.checked = r.value === name; });
    views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    if (!drawn[name]) { drawn[name] = 1; INIT[name](); } else REDRAW[name]?.();
    if (remember) store.set(name);
  }
  radios.forEach((r) => r.addEventListener("change", () => show(r.value, true)));
  let rt = 0, w = 0;
  const redraw = () => REDRAW[current]?.();
  if ("ResizeObserver" in window) new ResizeObserver(() => { const nw = root.clientWidth; if (nw !== w) { w = nw; clearTimeout(rt); rt = setTimeout(redraw, 100); } }).observe(root);
  else window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redraw, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  show(store.get(), false);
  // another page or tab changed the choice: follow it
  window.addEventListener("storage", (e) => { if (e.key === KEY) show(store.get(), false); });
  return { show, state: () => ({ view: current, focus }) };
}
