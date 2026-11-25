// The results whose proofs Appendix A collects, in the paper's order (the order of the appendix's sections), with
// where the paper proves each one, and what the claim map's edges say about them. Pure: no page, so the checks can
// import it (tools/checks/appA.mjs holds NODES to the content module's sections and the tags to main.tex).
export const NODES = [
  { id: "def:reflected", where: "§2" },
  { id: "eq:constant-bound", where: "§2" },
  { id: "eq:Bprime", where: "§2" },
  { id: "sf:strong", where: "A" },
  { id: "sf:stopping", where: "A" },
  { id: "lem:structure", where: "A.1" },
  { id: "lem:envelope", where: "A.2" },
  { id: "prop:regularity", where: "A.3" },
  { id: "prop:exact", where: "A.4" },
  { id: "lem:kernel", where: "A.5" },
  { id: "thm:main", where: "A.6" },
  { id: "cor:transfer", where: "A.7" },
  { id: "cor:limits", where: "A.7" },
  { id: "prop:rule", where: "A.8" },
  { id: "def:avg-cost", where: "A.8" },
  { id: "prop:loss", where: "A.9" },
  { id: "ext:lopsided", where: "B" },
];

/** For the claim map's data ({ nodes, edges }, an edge [a, b] meaning b uses a): each of NODES with its label, name,
 * and status from the map, the indices of the NODES it uses directly (up) and that use it directly (down), every
 * index it rests on through any chain of uses (rests), and every edge between two of NODES as [user index, used index]
 * pairs (arcs). Edges to entries outside NODES are left out. */
export function chain(map) {
  const ids = NODES.map((n) => n.id);
  const at = new Map(ids.map((id, i) => [id, i]));
  const usesOf = (id) => map.edges.filter(([, b]) => b === id).map(([a]) => a);
  const restsOn = (id) => {
    const seen = new Set(), todo = [id];
    while (todo.length) for (const a of usesOf(todo.pop())) if (!seen.has(a)) { seen.add(a); todo.push(a); }
    return seen;
  };
  const nodes = NODES.map((n, i) => {
    const m = map.nodes[n.id];
    if (!m) throw new Error(`the claim map has no entry ${n.id}`);
    const rest = restsOn(n.id);
    return {
      ...n, i, label: m.label, name: m.name, status: m.status,
      up: usesOf(n.id).filter((a) => at.has(a)).map((a) => at.get(a)),
      down: map.edges.filter(([a, b]) => a === n.id && at.has(b)).map(([, b]) => at.get(b)),
      rests: ids.map((x, j) => (rest.has(x) ? j : -1)).filter((j) => j >= 0),
    };
  });
  const arcs = map.edges.filter(([a, b]) => at.has(a) && at.has(b)).map(([a, b]) => [at.get(b), at.get(a)]);
  return { nodes, arcs };
}
