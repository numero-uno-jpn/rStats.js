// Builds a side-by-side table from reports/precision/{dd,double}/*.json (test/helpers/precision.ts).
// Called from scripts/precision.sh. The table goes to stdout and to reports/precision/report.md.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../reports/precision/", import.meta.url);

function load(mode) {
  const dir = new URL(`${mode}/`, root);
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const r = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    out.set(r.name, r);
  }
  return out;
}

const dd = load("dd");
const db = load("double");
const names = [...new Set([...dd.keys(), ...db.keys()])].sort();

const e = (v) => (v === 0 ? "0" : v.toExponential(1));
const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);

const rows = names.map((n) => {
  const a = dd.get(n);
  const b = db.get(n);
  // No record = the test timed out or threw
  const ddCols = a ? [a.failing, a.over1e14, a.nonFinite, ms(a.ms)] : ["no record", "", "", ""];
  const dbCols = b
    ? [b.failing, e(b.max), e(b.median), b.over1e14, b.over1e10, b.over1e6, b.nonFinite, ms(b.ms)]
    : ["no record (timeout or exception)", "", "", "", "", "", "", ""];
  const values = (a ?? b).values;
  return [n, values, ...ddCols, ...dbCols];
});

const header = [
  "fixture",
  "values",
  "dd: failing",
  "dd: > 1e-14",
  "dd: non-finite",
  "dd: time",
  "double: failing",
  "double: max error",
  "double: median",
  "> 1e-14",
  "> 1e-10",
  "> 1e-6",
  "non-finite",
  "double: time",
];
const line = (cells) => `| ${cells.join(" | ")} |`;
const worse = rows.filter((r) => typeof r[6] !== "number" || r[6] > 0).length;
const md = [
  `# Accuracy: double-double vs double precision (${new Date().toISOString().slice(0, 10)})`,
  "",
  "Errors are relative to the better of R and the reference value. \"failing\" counts the cases that fail under the current pass/fail rules (for tests and random numbers, the number of values).",
  "Quantile functions pass on backward error or by definition, so some cases have a large relative error against R even with dd (read the > 1e-14 and non-finite counts against the dd columns).",
  "Time is the time of one test file. Some functions get slower in double precision because their iterations converge less readily.",
  `fixtures with failures in double precision: ${worse} / ${rows.length}`,
  "",
  line(header),
  line(header.map(() => "---")),
  ...rows.map(line),
  "",
].join("\n");

writeFileSync(new URL("report.md", root), md);
console.log(md);
