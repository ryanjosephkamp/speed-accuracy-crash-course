// Prints the book's schedules as tools/validity/paper_code.py reads them (see schedules.mjs), with the comparator's
// edge cases.
import { CHOICES, spec, DT, H, CAP, HORIZON, EDGE_CONSTANT, EDGE_HORIZON, EDGE_CHOICES } from "./schedules.mjs";
import { VIEW } from "../../book/assets/js/schedules-book.js";

const edge = { constant: EDGE_CONSTANT, horizon: EDGE_HORIZON, schedules: Object.entries(EDGE_CHOICES).map(([name, choice]) => ({ name, choice, ...spec(choice) })) };
process.stdout.write(JSON.stringify({ dt: DT, h: H, cap: CAP, horizon: HORIZON, view: VIEW, schedules: CHOICES.map(spec), edge }));
