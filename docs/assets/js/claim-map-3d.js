// The claim map in 3D: Cloud, Tower, and Pages, three more views for the switcher in claim-map.js, loaded only when
// a reader picks one. They draw with the 2D canvas (no WebGL, no library): a perspective camera that turns about a
// target, fog with distance, and the map's chips as labels. Each has a flat drawing of itself (the same claims in
// 2D), where it starts when the reader's device asks for reduced motion.
//
//   mount3d(el, { view, data, chapter, focus, where })   view: "cloud" | "tower" | "pages"; data: book/content/map.json;
//                                                        where(id): the "Read it in chapter N" line for a claim

let D = null, N, IDS, deps, uses, pos, NCH, MAXD;
function init(data) {
  if (D === data) return;
  D = data; N = D.nodes; IDS = D.order; deps = {}; uses = {}; pos = {};
  IDS.forEach((id, i) => { deps[id] = []; uses[id] = []; pos[id] = i; });
  D.edges.forEach(([a, b]) => { deps[b].push(a); uses[a].push(b); });
  NCH = D.chapters.length; MAXD = Math.max(...IDS.map((id) => N[id].depth));
}
const byOrder = (a, b) => pos[a] - pos[b];
const closure = (id, next) => { const seen = {}; const st = next[id].slice(); while (st.length) { const x = st.pop(); if (!seen[x]) { seen[x] = 1; st.push(...next[x]); } } return seen; };
const chTitle = (n) => (D.chapters.find((c) => c.num === n) || {}).title || "";
const chItems = (n) => (D.chapters.find((c) => c.num === n) || { items: [] }).items;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ---------------------------------------------------------------- layouts (world units, centered on 0)
const ROW = 0.2; // one dependency layer
const yOf = (d) => (MAXD / 2 - d) * ROW; // what a claim uses sits above it, as in the book's views
function cells(key) { const c = {}; IDS.forEach((id) => { const k = key(id); (c[k] = c[k] || []).push(id); }); return c; }

// Tower: layers as height, chapters around a ring (it opens with the reader's chapter in front)
const R_T = 1;
const thetaOf = (ch) => ((ch - 1) / NCH) * TAU;
function towerLayout() {
  const P = {};
  Object.values(cells((id) => N[id].depth + ":" + N[id].ch)).forEach((list) => list.sort(byOrder).forEach((id, i) => {
    const th = thetaOf(N[id].ch) + (i - (list.length - 1) / 2) * 0.13;
    P[id] = [R_T * Math.sin(th), yOf(N[id].depth), -R_T * Math.cos(th)];
  }));
  return P;
}
// Pages: one upright page per chapter in book order, chapter 1 at the back; on each page, its claims by layer
const GAP = 0.46, PW = 1.15; // page spacing and half-width
const zOfCh = (ch) => ((NCH + 1) / 2 - ch) * GAP; // chapter 1 at the back, so what a page builds on lies behind it
function pagesLayout() {
  const P = {};
  D.chapters.forEach((c) => {
    const items = c.items.slice().sort(byOrder), n = items.length, sp = Math.min(0.42, (2 * PW - 0.5) / Math.max(1, n - 1));
    items.forEach((id, i) => { P[id] = [(i - (n - 1) / 2) * sp, yOf(N[id].depth), zOfCh(c.num)]; });
  });
  return P;
}
// Flat for Tower and Pages: chapters across, layers down (both unroll to this grid)
const COLW = 0.17;
function gridLayout() {
  const P = {};
  Object.values(cells((id) => N[id].depth + ":" + N[id].ch)).forEach((list) => list.sort(byOrder).forEach((id, i) => {
    const k = list.length, dx = k === 1 ? 0 : (i % 2 ? 0.25 : -0.25) * COLW, dy = k > 2 ? (i < 2 ? 0.22 : -0.22) * ROW : 0;
    P[id] = [(N[id].ch - (NCH + 1) / 2) * COLW + dx, yOf(N[id].depth) + dy, 0];
  }));
  return P;
}
// Cloud: a force layout (claims push apart, each use pulls its two ends together), seeded so it is the same every time
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function forceLayout(dim, seed) {
  const rnd = mulberry32(seed), n = IDS.length, ix = {};
  IDS.forEach((id, i) => { ix[id] = i; });
  const X = IDS.map(() => [rnd() * 2 - 1, rnd() * 2 - 1, dim === 3 ? rnd() * 2 - 1 : 0]);
  const V = X.map(() => [0, 0, 0]);
  const E = D.edges.map(([a, b]) => [ix[a], ix[b]]);
  const F = X.map(() => [0, 0, 0]);
  for (let it = 0; it < 420; it++) {
    for (let i = 0; i < n; i++) { F[i][0] = -X[i][0] * 0.012; F[i][1] = -X[i][1] * 0.012; F[i][2] = -X[i][2] * 0.012; }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], dz = X[i][2] - X[j][2];
      const r2 = dx * dx + dy * dy + dz * dz + 0.004, r = Math.sqrt(r2), f = 0.0042 / r2 / r;
      F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f; F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f;
    }
    for (const [a, b] of E) {
      const dx = X[b][0] - X[a][0], dy = X[b][1] - X[a][1], dz = X[b][2] - X[a][2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = ((r - 0.32) * 0.05) / r;
      F[a][0] += dx * f; F[a][1] += dy * f; F[a][2] += dz * f; F[b][0] -= dx * f; F[b][1] -= dy * f; F[b][2] -= dz * f;
    }
    const cool = 0.4 + 0.6 * (1 - it / 420);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { V[i][k] = (V[i][k] + F[i][k]) * 0.82 * cool; X[i][k] += V[i][k]; }
  }
  const c = [0, 0, 0]; X.forEach((p) => { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; });
  let rms = 0; X.forEach((p) => { rms += (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; }); rms = Math.sqrt(rms / n);
  const Y = X.map((p) => [(p[0] - c[0]) / rms, (p[1] - c[1]) / rms, dim === 3 ? (p[2] - c[2]) / rms : 0]);
  // pull the few far claims in (distance to the power 0.35), so the crowded middle gets the room
  const rMax = Math.max(...Y.map((p) => Math.hypot(p[0], p[1], p[2])));
  Y.forEach((p) => { const r = Math.hypot(p[0], p[1], p[2]) || 1, f = (rMax * Math.pow(r / rMax, 0.35)) / r; p[0] *= f; p[1] *= f; p[2] *= f; });
  // stand the cloud on its longest axis, so it fills a tall phone screen
  const cov = (v) => { const out = [0, 0, 0]; for (const p of Y) { const d = p[0] * v[0] + p[1] * v[1] + p[2] * v[2]; out[0] += p[0] * d; out[1] += p[1] * d; out[2] += p[2] * d; } return out; };
  const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let v1 = [0.3, 1, 0.2]; for (let k = 0; k < 60; k++) v1 = unit(cov(v1));
  let v2 = dim === 3 ? [1, 0.1, 0.3] : [1, 0.1, 0];
  for (let k = 0; k < 60; k++) { v2 = cov(v2); const d = dot(v2, v1); v2 = unit([v2[0] - d * v1[0], v2[1] - d * v1[1], v2[2] - d * v1[2]]); }
  const v3 = [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
  const P = {}; IDS.forEach((id, i) => { const p = Y[i]; P[id] = [dot(p, v2), 1.2 * dot(p, v1), dim === 3 ? dot(p, v3) : 0]; }); // a little taller, for a phone
  return P;
}
function bounds(P) {
  let r = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const id of IDS) { const p = P[id]; r = Math.max(r, Math.hypot(p[0], p[1], p[2])); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { r, x0, x1, y0, y1 };
}

// ---------------------------------------------------------------- theme
let TK = null;
function readTokens() {
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim();
  TK = { print: g("--print"), print2: g("--print-2"), line: g("--print-line"), ink: g("--print-ink"), dim: g("--print-dim"), rule: g("--rule"), ink3: g("--ink-3"), wb: g("--wb"), pm: g("--pm"), accent: g("--accent"), onAccent: g("--on-accent"), hot: g("--hot") };
}
const STATUS = { definition: "ring", proved: "ink", numerical: "wb", formal: "accent", conjecture: "accent", cited: "pm", computed: "pm" };
const statusColor = (s) => ({ ring: TK.dim, ink: TK.ink, wb: TK.wb, accent: TK.accent, pm: TK.pm })[STATUS[s] || "ring"];

// ---------------------------------------------------------------- the engine
const FONT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const stages = [];
class Stage {
  constructor(el, o) {
    this.el = el; this.o = o; this.name = o.name; this.book = o.bookChapter || null;
    this.cv = el.querySelector("canvas"); this.ctx = this.cv.getContext("2d");
    this.P3 = o.p3; this.PF = o.pf; this.B3 = bounds(o.p3); this.BF = bounds(o.pf);
    this.m = RM.matches ? 0 : 1; this.mTo = this.m;            // 1 = 3D, 0 = flat
    this.inset = { t: 56, r: 56, b: 58, l: 10 }; // the bands the stage's buttons sit in
    this.home = Object.assign({ yaw: 0, pitch: 0.2, zoom: 1, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0 }, o.cam);
    this.cam = Object.assign({}, this.home);
    this.fitF = { hh: 1, ox: 0, oy: 0 }; this.fit3 = { hh: 1 };
    this.flatZoom = 1; this.ftx = 0; this.fty = 0;
    this.sel = null; this.up = {}; this.down = {}; this.hover = null;
    this.vel = 0; this.anim = null; this.morph = null; this.spin = o.spin && !RM.matches ? o.spin : 0;
    this.pointers = new Map(); this.hits = []; this.raf = 0; this.last = 0;
    this.stats = { firstDraw: null, draws: 0, drawMs: [], gaps: [] };
    this.textW = {};
    this.bind();
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
  }
  // camera ------------------------------------------------------
  eff() {
    const k = ease(this.m), d3 = this.o.dist || 6, dF = 60;
    const zf = this.flatZoom, fz = zf > 1;
    return {
      yaw: this.cam.yaw * k, pitch: this.cam.pitch * k,
      dist: lerp(dF, d3, k), hh: lerp(this.fitF.hh / zf, this.fit3.hh / this.cam.zoom, k),
      ox: lerp(fz ? 0 : this.fitF.ox, this.cam.ox, k), oy: lerp(fz ? 0 : this.fitF.oy, this.cam.oy, k),
      tx: lerp(this.ftx, this.cam.tx, k), ty: lerp(this.fty, this.cam.ty, k), tz: this.cam.tz * k,
      rFog: this.B3.r, fog: k,
    };
  }
  // the scale and screen offset that fit these points inside the stage, clear of its buttons
  fitPoints(points, cam, dist) {
    const proj = this.projector(Object.assign({ tx: 0, ty: 0, tz: 0 }, cam, { hh: 1, ox: 0, oy: 0, dist }));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) { const q = proj(p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const I = this.o.fitInset || this.inset, aw = this.W - I.l - I.r, ah = this.H - I.t - I.b;
    x0 -= this.W / 2; x1 -= this.W / 2; y0 -= this.H / 2; y1 -= this.H / 2;
    const hh = Math.max((x1 - x0) / aw, (y1 - y0) / ah) * 1.04;
    return { hh, ox: I.l + aw / 2 - this.W / 2 - (x0 + x1) / 2 / hh, oy: I.t + ah / 2 - this.H / 2 - (y0 + y1) / 2 / hh };
  }
  refit() {
    const pts3 = IDS.map((id) => this.P3[id]).concat(this.o.fitExtra ? this.o.fitExtra() : []);
    const f3 = this.fitPoints(pts3, this.home, this.o.dist || 6);
    this.fit3 = { hh: f3.hh };
    this.home.ox = f3.ox; this.home.oy = f3.oy;
    if (!this.fitted) { this.cam.ox = f3.ox; this.cam.oy = f3.oy; this.fitted = true; if (this.o.chapter && this.o.pageCam) Object.assign(this.cam, this.o.pageCam(this, this.o.chapter)); }
    const ptsF = IDS.map((id) => this.PF[id]).concat(this.o.flatExtra ? this.o.flatExtra() : []);
    this.fitF = this.fitPoints(ptsF, { yaw: 0, pitch: 0 }, 60);
  }
  // project a world point: [x, y, depth, scale]
  projector(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const k = this.H / 2 / c.hh, W2 = this.W / 2 + (c.ox || 0), H2 = this.H / 2 + (c.oy || 0);
    return (p) => {
      const x = p[0] - c.tx, y = p[1] - c.ty, z = p[2] - c.tz;
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
      const zc = z2 + c.dist, s = (k * c.dist) / Math.max(0.05, zc);
      return [W2 + x1 * s, H2 - y2 * s, zc, s / k];
    };
  }
  positions() {
    const k = ease(this.m);
    if (k >= 1) return this.P3;
    if (k <= 0) return this.PF;
    const P = {}; for (const id of IDS) { const a = this.PF[id], b = this.P3[id]; P[id] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
    return P;
  }
  resize() {
    const r = this.el.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.refit();
    this.draw();
  }
  request() { if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t)); }
  frame(t) {
    this.raf = 0;
    if (this.el.offsetParent === null) { this.last = 0; return; } // hidden: wait for resize() to start it again
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 1 / 60;
    if (this.last && this.measuring) this.stats.gaps.push(t - this.last);
    this.last = t;
    let more = false;
    if (this.anim) {
      const a = this.anim, u = clamp((t - a.t0) / a.ms, 0, 1), e = ease(u);
      for (const key in a.to) this.cam[key] = lerp(a.from[key], a.to[key], e);
      if (u >= 1) this.anim = null; else more = true;
    }
    if (this.morph) {
      const a = this.morph, u = clamp((t - a.t0) / a.ms, 0, 1);
      this.m = lerp(a.from, a.to, u);
      if (u >= 1) { this.morph = null; this.m = a.to; } else more = true;
    }
    if (this.vel && !this.pointers.size) {
      this.cam.yaw += this.vel * dt; this.vel *= Math.exp(-dt * 4.5);
      if (Math.abs(this.vel) < 0.03) this.vel = 0; else more = true;
    }
    if (this.spin && this.m === 1 && !this.pointers.size) { this.cam.yaw += this.spin * dt; more = true; }
    if (this.testSpin) { this.cam.yaw += this.testSpin * dt; more = true; }
    this.draw();
    if (more) this.request(); else this.last = 0;
  }
  stopMotion() { this.spin = 0; this.vel = 0; this.anim = null; }
  animateTo(to, ms = 650) {
    if (RM.matches || this.m < 1) { Object.assign(this.cam, to); this.draw(); return; }
    const from = {}; for (const key in to) from[key] = this.cam[key];
    if (to.yaw !== undefined) to.yaw = this.cam.yaw + angDiff(this.cam.yaw, to.yaw);
    this.anim = { from, to, t0: performance.now(), ms }; this.request();
  }
  setMode(flat) {
    const to = flat ? 0 : 1; if (this.mTo === to) return;
    this.mTo = to; this.stopMotion();
    if (RM.matches) { this.m = to; this.draw(); } else { this.morph = { from: this.m, to, t0: performance.now(), ms: 750 }; this.request(); }
    this.o.onMode && this.o.onMode(flat);
  }
  zoomBy(f) {
    if (this.mTo === 0) { this.flatZoom = clamp(this.flatZoom * f, 1, 4); if (this.flatZoom === 1) { this.ftx = 0; this.fty = 0; } else this.centerFlat(); }
    else this.cam.zoom = clamp(this.cam.zoom * f, 0.6, 4);
    this.draw();
  }
  centerFlat() { if (this.sel && this.flatZoom > 1) { const p = this.PF[this.sel]; this.ftx = p[0]; this.fty = p[1]; } }
  reset() { this.stopMotion(); this.flatZoom = 1; this.ftx = 0; this.fty = 0; this.animateTo(Object.assign({}, this.home, this.o.homeFor ? this.o.homeFor(this) : {})); }
  // selection ---------------------------------------------------
  select(id, move = true) {
    if (!N[id]) return;
    this.sel = id; this.up = closure(id, deps); this.down = closure(id, uses);
    if (move && this.o.focus) { const to = this.o.focus(this, id); if (to) this.animateTo(to); }
    this.centerFlat();
    this.draw();
    this.o.onSelect && this.o.onSelect(id);
  }
  // input -------------------------------------------------------
  bind() {
    const cv = this.cv;
    cv.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      this.stopMotion();
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY, t0: e.timeStamp, type: e.pointerType });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom, my: (a.y + b.y) / 2, pitch: this.cam.pitch };
      }
      this.vt = []; this.moved = false;
    });
    cv.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === "mouse") this.hoverAt(e.offsetX, e.offsetY); return; }
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      p.x = e.offsetX; p.y = e.offsetY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) this.moved = true;
      if (!this.moved || this.mTo === 0) return;
      if (this.pointers.size === 1) {
        if (!cv.hasPointerCapture(e.pointerId)) try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        const w = 3.4 / this.W; // a drag across the whole stage turns it a little over half a turn
        this.cam.yaw -= dx * w;
        if (p.type === "mouse") this.cam.pitch = clamp(this.cam.pitch + dy * 0.006, -0.25, 1.4);
        this.vt.push([e.timeStamp, -dx * w]); if (this.vt.length > 6) this.vt.shift();
        this.request();
      } else if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        this.cam.zoom = clamp(this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, this.pinch.d), 0.6, 4);
        this.cam.pitch = clamp(this.pinch.pitch + ((a.y + b.y) / 2 - this.pinch.my) * 0.006, -0.25, 1.4);
        this.request();
      }
    });
    const end = (e, cancel) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (cancel) return;
      if (!this.moved && e.timeStamp - p.t0 < 600 && !this.pointers.size) { this.tap(e.offsetX, e.offsetY); return; }
      if (this.vt && this.vt.length > 1 && !RM.matches && !this.pointers.size && this.mTo === 1) {
        const v = this.vt, span = (v[v.length - 1][0] - v[0][0]) / 1000;
        if (span > 0) { this.vel = clamp(v.reduce((s, q) => s + q[1], 0) / span, -5, 5); this.request(); }
      }
    };
    cv.addEventListener("pointerup", (e) => end(e, false));
    cv.addEventListener("pointercancel", (e) => end(e, true));
    cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && this.hover) { this.hover = null; this.draw(); } });
    cv.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.01)); }, { passive: false });
    cv.addEventListener("keydown", (e) => {
      const k = e.key; let used = true;
      if (k === "ArrowLeft" && this.mTo) this.animateTo({ yaw: this.cam.yaw - 0.4 }, 250);
      else if (k === "ArrowRight" && this.mTo) this.animateTo({ yaw: this.cam.yaw + 0.4 }, 250);
      else if (k === "ArrowUp" && this.mTo) this.animateTo({ pitch: clamp(this.cam.pitch + 0.2, -0.25, 1.4) }, 250);
      else if (k === "ArrowDown" && this.mTo) this.animateTo({ pitch: clamp(this.cam.pitch - 0.2, -0.25, 1.4) }, 250);
      else if (k === "+" || k === "=") this.zoomBy(1.25);
      else if (k === "-" || k === "_") this.zoomBy(0.8);
      else used = false;
      if (used) { e.preventDefault(); this.stopMotion(); }
    });
  }
  hitAt(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (h.r && h.id && x >= h.r[0] && x <= h.r[0] + h.r[2] && y >= h.r[1] && y <= h.r[1] + h.r[3]) return h; }
    const rs = this.hits.filter((h) => h.r && !h.id && x >= h.r[0] && x <= h.r[0] + h.r[2] && y >= h.r[1] && y <= h.r[1] + h.r[3]).sort((p, q) => (p.z ?? 0) - (q.z ?? 0));
    if (rs.length) return rs[0];
    let best = null, bd = 22;
    for (const h of this.hits) { if (!h.p) continue; const d = Math.hypot(h.p[0] - x, h.p[1] - y) - (h.near || 0); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  tap(x, y) {
    const h = this.hitAt(x, y); if (!h) return;
    if (h.id) this.select(h.id); else if (h.act) h.act();
  }
  hoverAt(x, y) {
    const h = this.hitAt(x, y), id = h && h.id && !h.r ? h.id : null;
    if (id !== this.hover) { this.hover = id; this.draw(); }
  }
  // drawing -----------------------------------------------------
  tw(ctx, s) { const key = ctx.font + "|" + s; return this.textW[key] ?? (this.textW[key] = ctx.measureText(s).width); }
  draw() {
    if (!this.W || this.el.offsetParent === null) return;
    if (!TK) readTokens();
    const t0 = performance.now();
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const c = this.eff(), proj = this.projector(c), P = this.positions();
    const zN = c.dist - c.rFog, zF = c.dist + c.rFog;
    const fogA = (z) => (c.fog > 0 ? lerp(1, 1 - 0.68 * clamp((z - zN) / (zF - zN), 0, 1), c.fog) : 1);
    const S = {};
    const na = this.o.nodeAlpha;
    for (const id of IDS) { const q = proj(P[id]); S[id] = { x: q[0], y: q[1], z: q[2], s: q[3], a: fogA(q[2]) * (na ? na(this, id, c.fog) : 1) }; }
    this.hits = [];
    const env = { ctx, W, H, c, proj, fogA, S, P, stage: this, tk: TK };
    if (this.o.under) this.o.under(env);
    // the uses: faint, then the selected claim's chains, then its direct links
    const sel = this.sel, up = this.up, down = this.down, has = !!sel;
    const bow = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; return [(a.x + b.x) / 2 - dy * 0.12, (a.y + b.y) / 2 + dx * 0.12]; };
    const line = (a, b) => { const q = bow(a, b); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(q[0], q[1], b.x, b.y); ctx.stroke(); };
    const fwdDash = this.o.markForward;
    const tiers = [[], [], [], [], []]; // faint, chain up, chain down, direct up, direct down
    for (const e of D.edges) {
      const [a0, b0] = e;
      let t = 0;
      if (has) {
        if (b0 === sel) t = 3; else if (a0 === sel) t = 4;
        else if ((up[a0]) && (up[b0])) t = 1; else if (down[a0] && down[b0]) t = 2;
      }
      tiers[t].push(e);
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = TK.ink3; ctx.lineWidth = 1;
    for (const [a0, b0] of tiers[0]) {
      const a = S[a0], b = S[b0];
      const fwd = fwdDash && pos[a0] > pos[b0];
      ctx.globalAlpha = (has ? 0.16 : 0.34) * Math.min(a.a, b.a) * (fwd ? 2 : 1);
      if (fwd) { ctx.strokeStyle = TK.hot; ctx.setLineDash([3, 3]); line(a, b); ctx.setLineDash([]); ctx.strokeStyle = TK.ink3; } else line(a, b);
    }
    const hot = (list, color, w, alpha) => { ctx.strokeStyle = color; ctx.lineWidth = w; for (const [a0, b0] of list) { const a = S[a0], b = S[b0]; ctx.globalAlpha = alpha * Math.max(0.55, Math.min(a.a, b.a)); line(a, b); } };
    hot(tiers[1], TK.pm, 1.1, 0.6); hot(tiers[2], TK.wb, 1.1, 0.6); hot(tiers[3], TK.pm, 2, 1); hot(tiers[4], TK.wb, 2, 1);
    ctx.globalAlpha = 1;
    // the claims, far to near
    const order = IDS.slice().sort((p, q) => S[q].z - S[p].z);
    for (const id of order) {
      const n = S[id], st = STATUS[N[id].status] || "ring";
      const mine = this.book && N[id].ch === this.book;
      const lit = !has || id === sel || up[id] || down[id] || mine;
      const r = clamp(3.4 * n.s, 2.2, 7) * (id === sel ? 1.35 : 1);
      ctx.globalAlpha = n.a * (lit ? 1 : 0.28);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU);
      if (st === "ring") { ctx.fillStyle = TK.print; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = TK.dim; ctx.stroke(); }
      else { ctx.fillStyle = statusColor(N[id].status); ctx.fill(); }
      if (mine) { ctx.lineWidth = 1.4; ctx.strokeStyle = TK.ink; ctx.beginPath(); ctx.arc(n.x, n.y, r + 2.6, 0, TAU); ctx.stroke(); }
      this.hits.push({ id, p: [n.x, n.y], near: -n.z * 0.001 });
    }
    ctx.globalAlpha = 1;
    if (this.o.over) this.o.over(env);
    // labels as the book's chips: the claim in hand, then what it uses, then what uses it
    const chips = [];
    if (has) {
      chips.push([sel, "on"]);
      (this.o.here ? this.o.here(this, c.fog) : this.book ? chItems(this.book) : []).filter((x) => x !== sel && !deps[sel].includes(x) && !uses[sel].includes(x)).forEach((x) => chips.push([x, "here"]));
      deps[sel].slice().sort((p, q) => S[p].z - S[q].z).forEach((x) => chips.push([x, "up"]));
      uses[sel].slice().sort((p, q) => S[p].z - S[q].z).forEach((x) => chips.push([x, "down"]));
    }
    if (this.hover && this.hover !== sel && !chips.some((q) => q[0] === this.hover)) chips.unshift([this.hover, "hover"]);
    this.placeChips(ctx, chips, S, env);
    const ms = performance.now() - t0;
    this.stats.draws++;
    if (this.measuring) this.stats.drawMs.push(ms);
    if (this.stats.firstDraw === null) { this.stats.firstDraw = performance.now(); requestAnimationFrame(() => { this.stats.firstFrame = performance.now(); }); }
  }
  uiRects() { const I = this.inset, W = this.W, H = this.H; return [[0, 0, 150, I.t - 4], [W - I.r + 4, 0, I.r, 150], [0, H - I.b + 4, W - I.r, I.b]]; }
  placeChips(ctx, chips, S, env) {
    ctx.font = `600 11.5px ${FONT}`;
    if ("fontStretch" in ctx) ctx.fontStretch = "semi-condensed";
    const W = this.W, Hh = this.H;
    const placed = (env.reserved || []).concat(this.uiRects()), H = 22, PAD = 7;
    const hitsRect = (r) => placed.some((q) => r[0] < q[0] + q[2] + 2 && r[0] + r[2] + 2 > q[0] && r[1] < q[1] + q[3] + 2 && r[1] + r[3] + 2 > q[1]);
    let shown = 0;
    for (const [id, kind] of chips) {
      const n = S[id], label = N[id].label;
      ctx.font = `${kind === "here" || kind === "on" ? 720 : 600} 11.5px ${FONT}`;
      const w = Math.ceil(this.tw(ctx, label)) + PAD * 2 + 11;
      const tries = [[-w / 2, -H - 9], [-w / 2, 9], [10, -H / 2], [-w - 10, -H / 2], [-w / 2, -2 * H - 12], [-w / 2, H + 12], [12, -H - 6], [-w - 12, -H - 6], [12, 6], [-w - 12, 6]];
      let r = null;
      for (const [ox, oy] of tries) {
        const cand = [clamp(n.x + ox, 4, W - w - 4), clamp(n.y + oy, 4, Hh - H - 4), w, H];
        if (!hitsRect(cand)) { r = cand; break; }
      }
      if (!r) continue;
      placed.push(r); shown++;
      const a = kind === "on" ? 1 : Math.max(0.78, n.a);
      ctx.globalAlpha = a;
      // a leader from the dot to the chip
      const cx = clamp(n.x, r[0], r[0] + r[2]), cy = clamp(n.y, r[1], r[1] + r[3]);
      if (Math.hypot(cx - n.x, cy - n.y) > 4) { ctx.strokeStyle = kind === "up" ? TK.pm : kind === "down" ? TK.wb : TK.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(cx, cy); ctx.stroke(); }
      ctx.fillStyle = kind === "on" ? TK.accent : kind === "here" ? TK.print2 : TK.print; ctx.fillRect(r[0], r[1], r[2], r[3]);
      ctx.lineWidth = 1; ctx.strokeStyle = kind === "on" ? TK.accent : kind === "up" ? TK.pm : kind === "down" ? TK.wb : kind === "here" ? TK.ink : TK.line;
      ctx.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1);
      if (kind === "up" || kind === "down") { ctx.fillStyle = kind === "up" ? TK.pm : TK.wb; ctx.fillRect(r[0], r[1], 3, r[3]); }
      // the status dot, as on the book's chips
      const st = STATUS[N[id].status] || "ring", dx = r[0] + PAD + 3, dy = r[1] + H / 2;
      ctx.beginPath(); ctx.arc(dx, dy, 3.2, 0, TAU);
      if (kind === "on") { ctx.fillStyle = TK.onAccent; ctx.fill(); }
      else if (st === "ring") { ctx.lineWidth = 1.3; ctx.strokeStyle = TK.dim; ctx.stroke(); }
      else { ctx.fillStyle = statusColor(N[id].status); ctx.fill(); }
      ctx.fillStyle = kind === "on" ? TK.onAccent : TK.ink; ctx.textBaseline = "middle";
      ctx.fillText(label, r[0] + PAD + 11, r[1] + H / 2 + 0.5);
      this.hits.push({ id, r });
    }
    ctx.globalAlpha = 1;
    this.chipsShown = shown; this.chipsWanted = chips.length;
  }
  // measurement: turn the view steadily for a while and keep each frame's cost
  measure(seconds, rate = 1.2) {
    return new Promise((res) => {
      this.stopMotion(); this.stats.drawMs = []; this.stats.gaps = []; this.measuring = true; this.testSpin = rate; this.last = 0; this.request();
      setTimeout(() => {
        this.testSpin = 0; this.measuring = false;
        const g = this.stats.gaps.slice().sort((a, b) => a - b), d = this.stats.drawMs.slice().sort((a, b) => a - b);
        const q = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : null);
        const total = this.stats.gaps.reduce((s, x) => s + x, 0);
        res({ frames: g.length, fps: total ? (g.length * 1000) / total : null, gapP50: q(g, 0.5), gapP95: q(g, 0.95), drawP50: q(d, 0.5), drawP95: q(d, 0.95), chips: [this.chipsShown, this.chipsWanted] });
      }, seconds * 1000);
    });
  }
}

// ---------------------------------------------------------------- the three views
function polyline(env, pts, close) {
  const { ctx, proj } = env; ctx.beginPath();
  pts.forEach((p, i) => { const q = proj(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  if (close) ctx.closePath();
}
function smallText(ctx, s, x, y, color, align = "center", weight = 650, size = 10.5) {
  ctx.font = `${weight} ${size}px ${FONT}`; if ("fontStretch" in ctx) ctx.fontStretch = "semi-condensed";
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y); ctx.textAlign = "left";
}
// the grid's own guides, shown as the view flattens
function gridGuides(env, alpha) {
  if (alpha <= 0.02) return;
  const { ctx, proj, tk, stage } = env, top = yOf(0) + ROW * 0.9, bot = yOf(MAXD) - ROW * 0.4;
  ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = tk.line; ctx.lineWidth = 1;
  for (let ch = 1; ch <= NCH; ch++) { const x = (ch - (NCH + 1) / 2) * COLW; polyline(env, [[x, top - ROW * 0.4, 0], [x, bot, 0]]); ctx.stroke(); }
  ctx.globalAlpha = alpha;
  const cur = stage.o.current ? stage.o.current(stage) : 0;
  for (let ch = 1; ch <= NCH; ch++) {
    const q = proj([(ch - (NCH + 1) / 2) * COLW, top, 0]);
    smallText(ctx, String(ch), q[0], q[1], ch === cur ? tk.accent : tk.dim, "center", ch === cur ? 800 : 650);
  }
  for (let d = 0; d <= MAXD; d += 5) { const q = proj([-(NCH / 2) * COLW - 0.02, yOf(d), 0]); smallText(ctx, String(d), q[0], q[1], tk.dim, "right", 600, 9.5); }
  ctx.globalAlpha = 1;
}

const andList = (xs) => (xs.length < 2 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
function chapterLinks(ch) {
  const usesCh = new Set(), usedBy = new Set();
  D.edges.forEach(([a, b]) => { if (N[b].ch === ch && N[a].ch !== ch) usesCh.add(N[a].ch); if (N[a].ch === ch && N[b].ch !== ch) usedBy.add(N[b].ch); });
  const s = (set) => [...set].sort((x, y) => x - y);
  return { uses: s(usesCh), usedBy: s(usedBy) };
}
function chapterSay(ch) {
  const L = chapterLinks(ch), back = L.uses.filter((x) => x < ch), ahead = L.uses.filter((x) => x > ch);
  const n = D.chapters.find((c) => c.num === ch).items.length;
  const chs = (xs) => (xs.length === 1 ? `chapter ${xs[0]}` : `chapters ${andList(xs.map(String))}`);
  let t = `Chapter ${ch}, ${chTitle(ch)}: its ${n} claims `;
  if (back.length) t += `use claims from ${chs(back)}`;
  if (ahead.length) t += back.length ? `, and from ${chs(ahead)}, taught later` : `use claims taught later, in ${chs(ahead)}`;
  if (!back.length && !ahead.length) t += "use no other chapter's claims";
  t += L.usedBy.length ? `. ${chs(L.usedBy).replace(/^c/, "C")} use${L.usedBy.length === 1 ? "s" : ""} them.` : ". No other chapter uses them.";
  return t;
}
function makeOptions(start) {
const TOP = yOf(0) + ROW * 0.85, BOT = yOf(MAXD) - ROW * 0.6;
const gridExtra = () => [[-(NCH / 2) * COLW - 0.1, yOf(0), 0], [0, TOP, 0], [0, BOT, 0], [(NCH / 2) * COLW, 0, 0]];
const pageCorners = (ch) => { const z = zOfCh(ch); return [[-PW, TOP + ROW * 0.6, z], [PW, TOP + ROW * 0.6, z], [PW, BOT, z], [-PW, BOT, z]]; };
const OPTIONS = {
  tower: {
    make: () => ({ p3: towerLayout(), pf: gridLayout() }), cam: { yaw: thetaOf(start), pitch: 0.34 }, dist: 5.2,
    fitExtra: () => { const pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; pts.push([1.16 * R_T * Math.sin(t), BOT - ROW * 0.7, -1.16 * R_T * Math.cos(t)], [R_T * Math.sin(t), TOP, -R_T * Math.cos(t)]); } return pts; },
    flatExtra: gridExtra,
    focus: (st, id) => ({ yaw: Math.atan2(st.P3[id][0], -st.P3[id][2]), ty: st.cam.zoom > 1.3 ? st.P3[id][1] : 0 }),
    current: (st) => (st.sel ? N[st.sel].ch : 0),
    under(env) {
      const { ctx, tk, c, stage } = env, k = c.fog;
      gridGuides(env, 1 - k);
      if (k <= 0.02) return;
      const top = yOf(0) + ROW * 0.6, bot = BOT;
      ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = tk.line; ctx.lineWidth = 1;
      const ring = (y) => { const pts = []; for (let i = 0; i <= 64; i++) { const t = (i / 64) * TAU; pts.push([R_T * Math.sin(t), y, -R_T * Math.cos(t)]); } polyline(env, pts); ctx.stroke(); };
      ring(top); ring(bot);
      polyline(env, [[0, top, 0], [0, bot, 0]]); ctx.stroke();
      for (let d = 0; d <= MAXD; d++) { const y = yOf(d), w = d % 5 ? 0.03 : 0.07; polyline(env, [[-w, y, 0], [w, y, 0]]); ctx.stroke(); }
      // chapter columns and their numbers at the foot, near ones over far ones; a tap turns that chapter to the front
      const cur = stage.sel ? N[stage.sel].ch : 0;
      const foot = [];
      for (let ch = 1; ch <= NCH; ch++) {
        const th = thetaOf(ch), x = R_T * Math.sin(th), z = -R_T * Math.cos(th);
        ctx.globalAlpha = 0.45 * env.fogA(env.proj([x, 0, z])[2]) * k; polyline(env, [[x, top, z], [x, bot, z]]); ctx.stroke();
        foot.push([ch, env.proj([x * 1.16, bot - ROW * 0.7, z * 1.16])]);
      }
      foot.sort((a, b) => b[1][2] - a[1][2]);
      for (const [ch, qb] of foot) {
        const facing = Math.cos(angDiff(c.yaw, thetaOf(ch)));
        if (facing < -0.05 && ch !== cur) continue;
        const a = env.fogA(qb[2]) * k * clamp(0.35 + facing, 0.35, 1), sz = clamp(Math.round(22 * qb[3]), 15, 24), rx = qb[0] - sz / 2, ry = qb[1] - sz / 2;
        ctx.globalAlpha = a;
        ctx.fillStyle = ch === cur ? tk.accent : tk.print; ctx.fillRect(rx, ry, sz, sz);
        ctx.strokeStyle = ch === cur ? tk.accent : tk.line; ctx.strokeRect(rx + 0.5, ry + 0.5, sz - 1, sz - 1);
        smallText(ctx, String(ch), qb[0], qb[1] + 0.5, ch === cur ? tk.onAccent : tk.ink, "center", 750, sz > 19 ? 11 : 9.5);
        stage.hits.push({ r: [rx - 4, ry - 4, sz + 8, sz + 8], z: qb[2], act: () => { stage.stopMotion(); stage.animateTo({ yaw: thetaOf(ch) }); } });
        (env.reserved = env.reserved || []).push([rx, ry, sz, sz]);
      }
      { const q = env.proj([0, top + ROW * 0.55, 0]); ctx.globalAlpha = 0.9 * k; smallText(ctx, "layer 0", q[0], q[1], tk.dim, "center", 600, 9.5); }
      ctx.globalAlpha = 1;
    },
  },
  pages: {
    make: () => ({ p3: pagesLayout(), pf: gridLayout() }), cam: { yaw: 0.78, pitch: 0.42 }, dist: 7, markForward: true,
    chapter: 0,
    fitExtra: () => D.chapters.flatMap((c) => pageCorners(c.num)),
    flatExtra: gridExtra,
    current: (st) => st.o.chapter || 0,
    here: (st, k) => (st.o.chapter && k > 0.5 ? D.chapters.find((c) => c.num === st.o.chapter).items : []),
    nodeAlpha: (st, id, k) => (st.o.chapter && N[id].ch > st.o.chapter ? lerp(1, 0.4, k) : 1),
    focus: (st, id) => { const ch = N[id].ch; if (!st.o.chapter) return null; st.o.chapter = ch; st.o.onChapter && st.o.onChapter(ch); return st.o.pageCam(st, ch); },
    // the page in hand, a little turned, with the pages it builds on fanned out behind it
    pageCam: (st, ch) => {
      const cam = { yaw: 0.55, pitch: 0.12, tx: 0, ty: 0, tz: zOfCh(ch) };
      const back = D.chapters.filter((c) => c.num < ch && c.num >= ch - 3).flatMap((c) => pageCorners(c.num));
      const f = st.fitPoints(pageCorners(ch).concat(back), cam, st.o.dist);
      return Object.assign(cam, { zoom: st.fit3.hh / f.hh, ox: f.ox, oy: f.oy });
    },
    homeFor: (st) => { st.o.chapter = 0; st.o.onChapter && st.o.onChapter(0); return {}; },
    under(env) {
      const { ctx, tk, c, stage } = env, k = c.fog, cur = stage.o.chapter;
      gridGuides(env, 1 - k);
      if (k <= 0.02) return;
      const L = cur ? chapterLinks(cur) : { uses: [], usedBy: [] };
      // the pages, back to front; pages after the one in hand are turned away (faint)
      const pages = D.chapters.map((ch) => ch.num).sort((a, b) => env.proj([0, 0, zOfCh(b)])[2] - env.proj([0, 0, zOfCh(a)])[2]);
      for (const ch of pages) {
        const z = zOfCh(ch), q = env.proj([0, 0, z]), a = (ch === cur ? 1 : env.fogA(q[2])) * k * (cur && ch > cur ? 0.35 : 1);
        const isCur = ch === cur;
        polyline(env, pageCorners(ch), true);
        ctx.globalAlpha = (isCur ? 0.94 : cur ? 0.4 : 0.55) * a; ctx.fillStyle = isCur ? tk.print2 : tk.print; ctx.fill();
        ctx.globalAlpha = (isCur ? 1 : 0.75) * a; ctx.lineWidth = isCur ? 1.4 : 1; ctx.strokeStyle = isCur ? tk.ink : tk.line; ctx.stroke();
        if (isCur) {
          ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = tk.line; ctx.lineWidth = 1;
          for (let d = 0; d <= MAXD; d++) { polyline(env, [[-PW, yOf(d), z], [PW, yOf(d), z]]); ctx.stroke(); }
        }
        // the page's number and, for the page in hand, its title, on the top edge
        const right = cur && ch < cur; // pages behind the one in hand fan out to the right: label their right corner
        const qt = env.proj([right ? PW : -PW, TOP + ROW * 0.6, z]);
        ctx.globalAlpha = a;
        const label = isCur ? `${ch} · ${chTitle(ch)}` : String(ch);
        ctx.font = `${isCur ? 760 : 700} ${isCur ? 12 : 11}px ${FONT}`; if ("fontStretch" in ctx) ctx.fontStretch = "semi-condensed";
        const w = Math.max(20, ctx.measureText(label).width + 10), h = 20;
        let rx = right ? qt[0] - w : qt[0], ry = qt[1] - h;
        if (isCur) rx = clamp(rx, 2, env.W - w - 2);
        else {
          const off = rx < 2 || rx + w > env.W - 2 || ry < 2 || ry + h > env.H - 2;
          const ui = stage.uiRects().some((q) => rx < q[0] + q[2] && rx + w > q[0] && ry < q[1] + q[3] && ry + h > q[1]);
          const busy = (env.reserved || []).some((q) => rx < q[0] + q[2] && rx + w > q[0] && ry < q[1] + q[3] && ry + h > q[1]);
          if (off || ui || busy) { ctx.globalAlpha = 1; continue; }
        }
        const linkC = L.uses.includes(ch) ? tk.pm : L.usedBy.includes(ch) ? tk.wb : null;
        if (linkC) ctx.globalAlpha = Math.max(a, 0.9);
        ctx.fillStyle = isCur ? tk.ink : tk.print; ctx.fillRect(rx, ry, w, h);
        ctx.strokeStyle = isCur ? tk.ink : linkC || tk.line; ctx.lineWidth = linkC ? 2 : 1; ctx.strokeRect(rx + (linkC ? 1 : 0.5), ry + (linkC ? 1 : 0.5), w - (linkC ? 2 : 1), h - (linkC ? 2 : 1));
        ctx.fillStyle = isCur ? tk.print : tk.ink; ctx.textBaseline = "middle"; ctx.textAlign = isCur ? "left" : "center";
        ctx.fillText(label, isCur ? rx + 5 : rx + w / 2, ry + h / 2 + 0.5); ctx.textAlign = "left";
        stage.hits.push({ r: [rx - 3, ry - 6, w + 6, h + 12], z: qt[2], act: () => stage.o.goChapter(stage, ch) });
        (env.reserved = env.reserved || []).push([rx, ry, w, h]);
      }
      ctx.globalAlpha = 1;
    },
    goChapter(st, ch) {
      st.stopMotion(); st.o.chapter = ch;
      if (!st.sel || N[st.sel].ch !== ch) {
        const items = D.chapters.find((c) => c.num === ch).items;
        st.select(items.reduce((b, x) => (deps[x].length + uses[x].length > deps[b].length + uses[b].length ? x : b)), false);
      }
      st.animateTo(st.o.pageCam(st, ch), 700);
      st.o.onChapter && st.o.onChapter(ch);
      st.draw();
    },
  },
  cloud: {
    make: () => ({ p3: forceLayout(3, 2026), pf: forceLayout(2, 2026) }), cam: { yaw: 0.5, pitch: 0.22 }, dist: 5, spin: 0.16, fitInset: { t: 52, r: 14, b: 56, l: 14 },
    // fit the cylinder the cloud sweeps as it turns, so it never leaves the stage
    fitExtra() { let r = 0, y0 = 0, y1 = 0; for (const id of IDS) { const p = this.p3[id]; r = Math.max(r, Math.hypot(p[0], p[2])); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } const pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; pts.push([r * Math.cos(t), y0, r * Math.sin(t)], [r * Math.cos(t), y1, r * Math.sin(t)]); } return pts; },
    focus: (st, id) => { const p = st.P3[id]; return st.cam.zoom > 1.3 ? { tx: p[0] * 0.8, ty: p[1] * 0.8, tz: p[2] * 0.8 } : null; },
  },
};
return OPTIONS;
}

// ---------------------------------------------------------------- in the book
const CSS = `
.cm3-stage { position: relative; height: clamp(360px, 62vh, 560px); background: var(--print); border: 1px solid var(--print-line); }
.cm3-stage canvas { display: block; width: 100%; height: 100%; touch-action: pan-y; cursor: grab; -webkit-tap-highlight-color: transparent; }
.cm3-stage canvas:active { cursor: grabbing; }
.cm3-stage canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.cm3-mode { position: absolute; top: 8px; left: 8px; display: flex; border: 1px solid var(--print-line); background: var(--print); }
.cm3-mode button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 0; background: transparent; color: var(--print-dim); font: 650 0.8rem/1 var(--sans); font-stretch: 84%; cursor: pointer; }
.cm3-mode button + button { border-left: 1px solid var(--print-line); }
.cm3-mode button[aria-pressed="true"] { background: var(--print-ink); color: var(--print); }
.cm3-tools { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px; }
.cm3-tools-l { position: absolute; left: 8px; bottom: 8px; display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 16px); }
.cm3-tb { display: grid; place-items: center; min-width: 40px; height: 40px; padding: 0 10px; background: var(--print); color: var(--print-ink); border: 1px solid var(--print-line); border-radius: 0; cursor: pointer; font: 650 0.78rem/1 var(--sans); font-stretch: 82%; -webkit-tap-highlight-color: transparent; }
.cm3-tb:hover { border-color: var(--print-dim); }
.cm3-tb:active { transform: translateY(1px); }
.cm3-tb:disabled { opacity: 0.4; cursor: default; }
.cm3-tb svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
.cm3-note { margin: 0 0 8px; padding: 8px 10px; background: var(--paper-2); color: var(--ink-2); font: 500 0.82rem/1.4 var(--sans); }
.cm3-say { margin: 10px 0 0; font: 500 0.9rem/1.45 var(--sans); color: var(--ink); }
.cmap .cm3 .cm-controls { margin: 12px 0 0; }
.cmap .cm3-card { margin: 10px 0 0; max-width: none; }
.cm3-links { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.cm3-links .lk { min-width: 4.4rem; font: 650 0.76rem/1.2 var(--sans); font-stretch: 86%; color: var(--print-dim); }
.cm3-links .none { font: 500 0.8rem var(--sans); color: var(--print-dim); }
`;
const ICON = {
  in: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
  out: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3"/><path d="M3 2.5v3h3"/></svg>',
};
const LEFT = {
  cloud: '<button type="button" class="cm3-tb" data-view="side" data-3d-only>Quarter turn</button>',
  tower: '<button type="button" class="cm3-tb" data-view="front" data-3d-only>Front</button><button type="button" class="cm3-tb" data-view="above" data-3d-only>Above</button>',
  pages: '<button type="button" class="cm3-tb" data-act="prev" data-3d-only aria-label="Previous chapter">‹</button><button type="button" class="cm3-tb" data-act="whole" data-3d-only><span data-chapter-label>Whole book</span></button><button type="button" class="cm3-tb" data-act="next" data-3d-only aria-label="Next chapter">›</button>',
};
const NAME = { cloud: "Cloud", tower: "Tower", pages: "Pages" };
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  const style = document.createElement("style"); style.id = "cm3-style"; style.textContent = CSS; document.head.append(style);
  const redrawAll = () => { readTokens(); stages.forEach((s) => s.draw()); };
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
  window.addEventListener("cc-theme", redrawAll);
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => stages.forEach((s) => { s.textW = {}; s.draw(); }));
}
const dotClass = (s) => (s === "conjecture" ? "formal" : s === "computed" ? "cited" : s);
export function mount3d(el, { view, data, chapter = null, focus = "thm:main", where = () => "" }) {
  init(data);
  listen();
  readTokens();
  if (!N[focus]) focus = IDS[0];
  const book = chapter && chItems(chapter).length ? chapter : null;
  const o = makeOptions(book || N[focus].ch)[view]; o.name = view; o.bookChapter = book;
  const tl = performance.now(); Object.assign(o, o.make()); const layoutMs = performance.now() - tl;
  el.innerHTML = `<p class="cm3-note" hidden>Your device asks for less motion, so this starts flat. Tap 3D to turn it; it moves only while you drag it.</p>
<div class="cm3-stage">
  <canvas tabindex="0" aria-label="${NAME[view]}: the claim map in 3D. Arrow keys turn and tilt it, plus and minus zoom. Choose a claim in the list below it to read it."></canvas>
  <div class="cm3-mode" role="group" aria-label="Drawing"><button type="button" data-mode="3d" aria-pressed="true">3D</button><button type="button" data-mode="flat" aria-pressed="false">Flat</button></div>
  <div class="cm3-tools"><button type="button" class="cm3-tb" data-act="in" aria-label="Zoom in">${ICON.in}</button><button type="button" class="cm3-tb" data-act="out" aria-label="Zoom out">${ICON.out}</button><button type="button" class="cm3-tb" data-act="reset" aria-label="Reset the view">${ICON.reset}</button></div>
  <div class="cm3-tools-l">${LEFT[view]}</div>
</div>${view === "pages" ? '\n<p class="cm3-say" aria-live="polite"></p>' : ""}
<div class="cm-controls"><select class="pick cm-select" aria-label="Claim"></select></div>
<div class="center-card cm3-card" aria-live="polite"></div>`;
  const stageEl = el.querySelector(".cm3-stage"), cv = stageEl.querySelector("canvas");
  if (!cv.getContext || !cv.getContext("2d")) { el.innerHTML = '<p class="plate-fail">This view needs a canvas, which this browser does not offer. Focus, Layers, Outline, and Book path still work.</p>'; return null; }
  const card = el.querySelector(".cm3-card"), sel = el.querySelector("select");
  const flatBtn = el.querySelector('[data-mode="flat"]'), d3Btn = el.querySelector('[data-mode="3d"]'), note = el.querySelector(".cm3-note");
  const chapLabel = el.querySelector("[data-chapter-label]"), say = el.querySelector(".cm3-say");
  sel.innerHTML = D.chapters.map((c) => `<optgroup label="${esc(`Chapter ${c.num} · ${c.title}`)}">${c.items.map((id) => `<option value="${id}">${esc(N[id].name)}</option>`).join("")}</optgroup>`).join("");
  const chip = (id, cls) => `<button type="button" class="node ${cls}${book && N[id].ch === book ? " here" : ""}" data-id="${id}" title="${esc(N[id].name)}"><span class="dot s-${dotClass(N[id].status)}"></span>${esc(N[id].label)}</button>`;
  const row = (ids, cls, k) => `<div class="cm3-links"><span class="lk">${k}</span>${ids.length ? ids.slice().sort(byOrder).map((x) => chip(x, cls)).join("") : '<span class="none">nothing in the map</span>'}</div>`;
  o.onSelect = (id) => {
    sel.value = id;
    const n = N[id];
    card.classList.toggle("here", !!book && n.ch === book);
    card.innerHTML = `<div class="k">${esc(n.kind)} · chapter ${n.ch} · ${esc(chTitle(n.ch))}</div><h3>${esc(n.name)}</h3>` +
      `<p>Section ${esc(n.sec)} · page ${n.page} · ${esc(n.statusLabel)} · ${where(id)}</p>` + row(deps[id], "up", "It uses") + row(uses[id], "down", "Used by");
  };
  o.onMode = (flat) => {
    flatBtn.setAttribute("aria-pressed", String(flat)); d3Btn.setAttribute("aria-pressed", String(!flat));
    note.hidden = !(flat && RM.matches);
    el.querySelectorAll("[data-3d-only]").forEach((b) => { b.disabled = flat; });
  };
  o.onChapter = (ch) => {
    if (chapLabel) chapLabel.textContent = ch ? `Chapter ${ch}` : "Whole book";
    if (say) say.textContent = ch ? chapterSay(ch) : "The whole book: chapter 1 at the back, chapter 12 at the front. Tap a page's number, or use the arrows, to take one page in hand.";
  };
  const st = new Stage(stageEl, o);
  st.layoutMs = layoutMs; st.mountAt = tl;
  stages.push(st);
  o.onMode(st.mTo === 0);
  sel.addEventListener("change", () => { st.stopMotion(); st.select(sel.value); });
  card.addEventListener("click", (e) => { const b = e.target.closest(".node[data-id]"); if (b) { st.stopMotion(); st.select(b.dataset.id); } });
  flatBtn.addEventListener("click", () => st.setMode(true));
  d3Btn.addEventListener("click", () => st.setMode(false));
  el.querySelector('[data-act="in"]').addEventListener("click", () => { st.stopMotion(); st.zoomBy(1.3); });
  el.querySelector('[data-act="out"]').addEventListener("click", () => { st.stopMotion(); st.zoomBy(1 / 1.3); });
  el.querySelector('[data-act="reset"]').addEventListener("click", () => st.reset());
  el.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    st.stopMotion(); const v = b.dataset.view;
    if (v === "front") st.animateTo({ pitch: 0.05 }); else if (v === "above") st.animateTo({ pitch: 1.25 }); else if (v === "side") st.animateTo({ yaw: st.cam.yaw + Math.PI / 2 });
  }));
  const prev = el.querySelector('[data-act="prev"]'), next = el.querySelector('[data-act="next"]'), whole = el.querySelector('[data-act="whole"]');
  if (prev) prev.addEventListener("click", () => o.goChapter(st, Math.max(1, (o.chapter || 1) - (o.chapter ? 1 : 0))));
  if (next) next.addEventListener("click", () => o.goChapter(st, Math.min(NCH, (o.chapter || 0) + 1)));
  if (whole) whole.addEventListener("click", () => st.reset());
  st.select(focus, false);
  if (view === "pages") { const ch = book || N[focus].ch; o.chapter = ch; o.onChapter(ch); if (st.fitted) Object.assign(st.cam, o.pageCam(st, ch)); st.draw(); }
  return { stage: st, resize() { st.resize(); if (st.spin) st.request(); } };
}
