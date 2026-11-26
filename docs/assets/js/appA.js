// Appendix A's page: the hero, which draws the results proved here in the paper's order with an arc for each use the
// claim map records and lights one result at a time, and the proof strips, which stand without plates on this page.
// The hero reads the map from the data the page carries (#map-data); its words come from say-appA.js.
import { chain } from "./appA-chain.js?v=d73958033e";
import { wireStrips } from "./book.js?v=d73958033e";
import * as S from "./say-appA.js?v=d73958033e";

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

// ---------------------------------------------------------------- the hero: the chain of results
function hero() {
  const fig = document.getElementById("hero-proof"), el = document.getElementById("hero-svg");
  if (!fig || !el) return;
  const { nodes, arcs } = chain(JSON.parse(document.getElementById("map-data").textContent));
  const n = nodes.length;
  const gapMax = Math.max(...arcs.map(([a, b]) => Math.abs(a - b)));
  let cur = Math.max(0, Math.min(n - 1, +fig.dataset.still || 0));
  const draw = (k) => {
    cur = k;
    const W = Math.max(280, Math.round(el.parentElement.clientWidth || 340));
    const top = 34, row = 18.5, bottom = 12;
    const H = Math.round(top + (n - 1) * row + bottom);
    el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
    // the arcs bulge left of the dots, wider for uses that skip more results; the dots sit at x0
    const x0 = Math.round(Math.min(132, Math.max(92, W * 0.27)));
    const y = (i) => top + i * row;
    const bulge = (g) => (6 + ((x0 - 22) * (g - 1)) / Math.max(1, gapMax - 1)) / 0.75;
    const path = ([a, b]) => { const d = bulge(Math.abs(a - b)); return `M${x0} ${y(a).toFixed(1)}C${(x0 - d).toFixed(1)} ${y(a).toFixed(1)} ${(x0 - d).toFixed(1)} ${y(b).toFixed(1)} ${x0} ${y(b).toFixed(1)}`; };
    const me = nodes[k], rests = new Set(me.rests), users = new Set(me.down);
    let s = `<text class="lab" x="12" y="13"><tspan class="k-up">what it rests on</tspan> · <tspan class="k-down">what uses it</tspan></text>`;
    const faint = [], lit = [];
    for (const a of arcs) {
      const [user, used] = a;
      if (user === k) lit.push(`<path class="arc-up" d="${path(a)}"/>`);
      else if (used === k) lit.push(`<path class="arc-down" d="${path(a)}"/>`);
      else faint.push(`<path class="arc" d="${path(a)}"/>`);
    }
    s += faint.join("") + lit.join("");
    nodes.forEach((m, i) => {
      const role = i === k ? " on" : rests.has(i) ? " up" : users.has(i) ? " down" : "";
      s += `<circle class="nd-dot s-${m.status}${i === k ? " on" : ""}" cx="${x0}" cy="${y(i).toFixed(1)}" r="${i === k ? 4.8 : 3.3}"/>`;
      s += `<text class="nd${role}" x="${x0 + 9}" y="${(y(i) + 3.8).toFixed(1)}">${esc(m.label)}</text>`;
      s += `<text class="tk" x="${W - 8}" y="${(y(i) + 3.8).toFixed(1)}" text-anchor="end">${esc(m.where)}</text>`;
    });
    el.innerHTML = s;
  };
  draw(cur);
  new ResizeObserver(() => draw(cur)).observe(el.parentElement);
  if (window.ChapterHero) {
    window.ChapterHero.live(fig, { steps: n, draw, label: (k) => S.heroLabel(nodes[k].label, nodes[k].rests.length, nodes[k].down.length) });
  }
}

// ---------------------------------------------------------------- start
try { hero(); } catch (e) {
  const el = document.getElementById("hero-svg");
  if (el) el.innerHTML = `<text class="lab" x="12" y="20">The picture could not load: ${esc(e.message)}</text>`;
  console.error(e);
}
wireStrips();
