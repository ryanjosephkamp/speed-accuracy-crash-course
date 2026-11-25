// The sentences Appendix A's page prints, as functions of the numbers they show. Pure: no page, no model.

/** The hero's label for one result: how many of the results drawn it rests on, and how many use it directly. */
export function heroLabel(label, rests, users) {
  const r = rests === 0 ? "rests on none of these" : `rests on ${rests} of these`;
  const u = users === 0 ? "none of these uses it" : users === 1 ? "1 of these uses it" : `${users} of these use it`;
  return `${label}: ${r}, and ${u}.`;
}
