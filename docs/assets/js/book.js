// What every page of the book shares: the theme and depth switches, the contents menu, the reading line, the
// reader's schedule (kept in this browser), the solver's worker, plates that wake when they reach the screen,
// and lifting a live plate into the figure viewer.
import { defaultChoice } from "./schedules-book.js?v=0487a934ff";

const root = document.documentElement;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: the page still works */ } },
};

export const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
export const params = new URLSearchParams(location.search);
export const seedParam = (fallback) => { const s = parseInt(params.get("seed"), 10); return Number.isFinite(s) ? s : fallback; };

// ---- the schedule the reader chose -----------------------------------------------------------------------
const KEY = "cc-schedule";
export function getChoice() {
  try { const c = JSON.parse(store.get(KEY)); if (c && typeof c.id === "string") return c; } catch (e) { /* fall through */ }
  return defaultChoice();
}
export function setChoice(c) {
  store.set(KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent("cc-schedule", { detail: c }));
}

// ---- the solver ------------------------------------------------------------------------------------------
// One worker per script: dp-worker.js by default, or a chapter's own (pass its URL, made with
// new URL("./chNN-worker.js?v=0487a934ff", import.meta.url)). A worker answers { id, ok, ... } or { id, progress }.
let nextId = 1;
const workers = new Map();
const pending = new Map();
function getWorker(url) {
  const k = String(url);
  if (workers.has(k)) return workers.get(k);
  const w = new Worker(url, { type: "module" });
  w.onmessage = (e) => {
    const m = e.data, p = pending.get(m.id);
    if (!p) return;
    if (m.progress !== undefined) { p.progress?.(m.progress); return; }
    pending.delete(m.id);
    if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
  };
  workers.set(k, w);
  return w;
}
const DP_WORKER = new URL("./dp-worker.js?v=0487a934ff", import.meta.url);
/** Run a job in a worker; a newer job with the same key makes the older one's answer be ignored. */
const latest = new Map();
export function solve(job, { key = null, progress = null, worker = DP_WORKER } = {}) {
  const id = nextId++;
  if (key) latest.set(key, id);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress });
    getWorker(worker).postMessage({ ...job, id });
  }).then((m) => { if (key && latest.get(key) !== id) throw new Error("superseded"); return m; });
}

// ---- proof strips: each .strip drives its plate, which hears "strip-step" with the step number --------------
export function wireStrips() {
  document.querySelectorAll(".strip").forEach((st) => {
    if (st.dataset.wired) return;
    st.dataset.wired = "1";
    const n = +st.dataset.steps, inp = st.querySelector("input[type=range]");
    const cards = [...st.querySelectorAll(".strip-step")], btns = [...st.querySelectorAll(".strip-steps button")];
    const fig = document.getElementById("plate-" + st.dataset.plate);
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

// ---- plates wake on screen -----------------------------------------------------------------------------------
export function onVisible(el, fn, margin = "300px") {
  if (!("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}
/** Track whether an element is on screen (for animations that pause off screen). */
export function watchVisible(el, cb) {
  if (!("IntersectionObserver" in window)) { cb(true); return; }
  new IntersectionObserver((es) => cb(es[es.length - 1].isIntersecting), { threshold: 0.05 }).observe(el);
}

// ---- lifting a live plate --------------------------------------------------------------------------------
const STYLE_PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
  "fill-opacity", "stroke-opacity", "font-size", "font-weight", "font-family", "letter-spacing", "paint-order", "text-anchor"];
function inlineStyles(src, dst) {
  const a = [src, ...src.querySelectorAll("*")], b = [dst, ...dst.querySelectorAll("*")];
  a.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const style = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    b[i].setAttribute("style", style);
    if (el.tagName.toLowerCase() === "text" && cs.textTransform === "uppercase") b[i].textContent = el.textContent.toUpperCase();
    b[i].removeAttribute("class");
  });
}
/** The plate's charts as one picture, in the colors on screen, for the figure viewer. */
export function plateImage(stage) {
  const charts = [...stage.querySelectorAll("svg.chart")].filter((s) => s.getClientRects().length);
  if (!charts.length) return null;
  const bg = getComputedStyle(stage).backgroundColor;
  const W = Math.max(...charts.map((c) => c.viewBox.baseVal.width));
  let y = 12, inner = "";
  for (const c of charts) {
    const clone = c.cloneNode(true);
    inlineStyles(c, clone);
    const w = c.viewBox.baseVal.width, h = c.viewBox.baseVal.height;
    clone.setAttribute("x", String((W - w) / 2)); clone.setAttribute("y", String(y));
    clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
    inner += new XMLSerializer().serializeToString(clone);
    y += h + 14;
  }
  const H = y - 2;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${(W + 24) * 2}" height="${H * 2}" viewBox="-12 0 ${W + 24} ${H}"><rect x="-12" y="0" width="${W + 24}" height="${H}" fill="${bg}"/>${inner}</svg>`;
  return URL.createObjectURL(new Blob([doc], { type: "image/svg+xml" }));
}
function wireLift(btn) {
  const fig = btn.closest("figure");
  const stage = btn.closest(".plate-live-stage");
  btn.hidden = false;
  btn.addEventListener("click", () => {
    const url = plateImage(stage);
    if (!url || !window.FigurePopOut) return;
    const night = getComputedStyle(root).colorScheme === "dark";
    const title = fig.querySelector("h3")?.textContent || "Plate";
    window.FigurePopOut.open(fig, { src: url, alt: fig.getAttribute("aria-label") || title, opener: btn, night, title,
      pageWidth: stage.getBoundingClientRect().width });
  });
}

// ---- the bar ---------------------------------------------------------------------------------------------
function menus() {
  const pairs = [["toc-btn", "toc-menu"], ["theme-btn", "theme-menu"]].map(([b, m]) => [document.getElementById(b), document.getElementById(m)]).filter(([b, m]) => b && m);
  const close = (except) => pairs.forEach(([b, m]) => { if (m !== except) { m.hidden = true; b.setAttribute("aria-expanded", "false"); } });
  pairs.forEach(([b, m]) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); const open = m.hidden; close(m); m.hidden = !open; b.setAttribute("aria-expanded", String(open)); });
    m.addEventListener("click", (e) => e.stopPropagation());
  });
  document.addEventListener("click", () => close(null));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(null); });
  document.querySelectorAll("#toc-menu a").forEach((a) => a.addEventListener("click", () => close(null)));
}
function theme() {
  const saved = store.get("cc-theme");
  const radios = document.querySelectorAll("#theme-menu input[name=theme]");
  radios.forEach((r) => {
    r.checked = r.value === (saved === "light" || saved === "dark" ? saved : "system");
    r.addEventListener("change", () => {
      if (r.value === "system") { root.removeAttribute("data-theme"); store.set("cc-theme", "system"); }
      else { root.setAttribute("data-theme", r.value); store.set("cc-theme", r.value); }
      window.dispatchEvent(new Event("cc-theme"));
    });
  });
}
function depth() {
  const btns = document.querySelectorAll(".depth button");
  const mark = () => btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.depth === root.dataset.depth)));
  btns.forEach((b) => b.addEventListener("click", () => {
    // keep the reader's place: the first visible block stays where it is
    const anchor = [...document.querySelectorAll("main p, main h2, main figure")].find((el) => el.getBoundingClientRect().top > 56);
    const before = anchor?.getBoundingClientRect().top;
    root.dataset.depth = b.dataset.depth; store.set("cc-depth", b.dataset.depth); mark();
    if (anchor && anchor.getClientRects().length) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  }));
  mark();
}
function readingLine() {
  const bar = document.querySelector(".bar-scale span");
  if (!bar) return;
  let raf = 0;
  const set = () => { raf = 0; const h = document.documentElement.scrollHeight - innerHeight; bar.style.width = (h > 0 ? Math.min(1, scrollY / h) * 100 : 0) + "%"; };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(set); }, { passive: true });
  set();
}

menus(); theme(); depth(); readingLine();
// live plates get a lift button once their charts are drawn
export function liftReady(fig) { const b = fig.querySelector(".btn-lift"); if (b && b.hidden) wireLift(b); }

// ---- the claim map: mounted when it nears the screen, from the data the page carries ----------------------------
document.querySelectorAll("[data-claim-map]").forEach((el) => onVisible(el, async () => {
  try {
    const data = JSON.parse(document.getElementById("map-data").textContent);
    const { mountMap } = await import("./claim-map.js?v=0487a934ff");
    mountMap(el, { data, chapter: el.dataset.chapter ? +el.dataset.chapter : null, focus: el.dataset.focus || "thm:main", links: JSON.parse(el.dataset.links || "{}") });
  } catch (e) {
    el.innerHTML = '<p class="plate-fail">The claim map could not load.</p>';
    console.error(e);
  }
}, "400px"));
