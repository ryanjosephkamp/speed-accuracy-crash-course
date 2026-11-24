// Prints the book's schedules as tools/validity/paper_code.py reads them (see schedules.mjs).
import { CHOICES, spec, DT, H, CAP, HORIZON } from "./schedules.mjs";
import { VIEW } from "../../book/assets/js/schedules-book.js";

process.stdout.write(JSON.stringify({ dt: DT, h: H, cap: CAP, horizon: HORIZON, view: VIEW, schedules: CHOICES.map(spec) }));
