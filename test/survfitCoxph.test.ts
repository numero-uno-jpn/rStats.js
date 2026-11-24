import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { weightit } from "../src/entries/causal.js";
import { survfitCoxph } from "../src/entries/tests.js";
import { covariateColumns } from "../src/causal/weightit.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/weightit.json", import.meta.url), "utf8")) as Record<string, any>;
const psCovs: Record<string, string[]> = { sim: ["x1", "x2", "x3"], veteran: ["karno", "age", "prior", "celltype"] };
const num = (v: unknown): number => (v === "NA" || v === null || v === undefined ? NaN : Number(v));

function setup(set: string, wk: string) {
  const d = fixture.data[set];
  const cv = Object.fromEntries(psCovs[set]!.map((c) => [c, d[c]]));
  const weights = wk === "none" ? undefined : weightit(d.tr, cv, { estimand: "ATE" }).weights;
  const { columns, factors } = covariateColumns(cv, d.tr.length);
  const x = d.tr.map((t: number, i: number) => [t, ...columns.map((c) => c[i]!)]);
  return { d, cv, weights, x, factors };
}
/** A newdata row of R's: the treatment, numeric covariates as given, a factor's level as its indicator columns */
function profile(nd: Record<string, any>, k: number, set: string, factors: Record<string, string[]>): number[] {
  const row = [num(nd.tr[k])];
  for (const c of psCovs[set]!) {
    if (factors[c]) for (const lv of factors[c]!.slice(1)) row.push(nd[c][k] === lv ? 1 : 0);
    else row.push(num(nd[c][k]));
  }
  return row;
}

describe("survfitCoxph against survfit(coxph, newdata)", () => {
  it("gives R's adjusted curves, standard errors, limits, counts and medians", () => {
    const bad: string[] = [];
    const keys = Object.keys(fixture).filter((k) => /^survfit_(sim|veteran)_(ATE|none)_/.test(k) && !k.endsWith("default"));
    for (const key of keys) {
      const [, set, wk, ties, rob] = /^survfit_(sim|veteran)_(ATE|none)_(efron|breslow)_(robust|naive)$/.exec(key)!;
      const { d, weights, x, factors } = setup(set!, wk!);
      const r = fixture[key].value;
      const newdata = [0, 1].map((k) => profile(r.newdata, k, set!, factors));
      const s = survfitCoxph(d.time, d.status, x, { ties: ties as "efron", ...(weights ? { weights, robust: rob === "robust" } : {}), newdata, times: r.times });
      const m = r.time.length;
      const near = (a: number, b: number, tol: number): boolean => (Number.isNaN(b) ? Number.isNaN(a) : Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)));
      const cmp = (name: string, ours: number[][], theirs: unknown[], tol: number) => ours.forEach((curve, c) => curve.forEach((v, j) => {
        if (!near(v, num(theirs[c * m + j]), tol)) bad.push(`${key}.${name}[${c},${j}] ${v} vs ${theirs[c * m + j]}`);
      }));
      if (JSON.stringify(s.time) !== JSON.stringify(r.time)) { bad.push(`${key}.time`); continue; }
      for (const [name, a, b] of [["n.risk", s.nRisk, r["n.risk"]], ["n.event", s.nEvent, r["n.event"]], ["n.censor", s.nCensor, r["n.censor"]]] as const) {
        (b as number[]).forEach((v, j) => { if (!near(a[j]!, v, 1e-12)) bad.push(`${key}.${name}[${j}]`); });
      }
      cmp("surv", s.surv, r.surv, 1e-10);
      cmp("cumhaz", s.cumhaz, r.cumhaz, 1e-10);
      cmp("std.err", s.stdErr, r["std.err"], 1e-9);
      cmp("lower", s.lower, r.lower, 1e-9);
      cmp("upper", s.upper, r.upper, 1e-9);
      // table: rows = curves; columns records, n.max, n.start, events, rmean, se(rmean), median, LCL, UCL
      const tab = r.table.values.map(num);
      s.median.forEach((md, c) => {
        if (!near(s.records, tab[c]!, 0)) bad.push(`${key}.records`);
        if (!near(s.nStart, tab[2 * 2 + c]!, 1e-12)) bad.push(`${key}.n.start`);
        if (!near(s.events, tab[3 * 2 + c]!, 1e-12)) bad.push(`${key}.events`);
        md.forEach((v, q) => { if (!near(v, tab[(6 + q) * 2 + c]!, 1e-12)) bad.push(`${key}.median[${c},${q}] ${v} vs ${tab[(6 + q) * 2 + c]}`); });
      });
      const at = s.at!;
      if (JSON.stringify(at.time) !== JSON.stringify(([] as number[]).concat(r.atTime))) bad.push(`${key}.atTime ${at.time} ${r.atTime}`);
      const ma = at.time.length;
      at.surv.forEach((curve, c) => curve.forEach((v, j) => { if (!near(v, num(r.atSurv[c * ma + j]), 1e-10)) bad.push(`${key}.atSurv`); }));
      at.nRisk.forEach((v, j) => { if (!near(v, num(([] as unknown[]).concat(r.atNRisk)[j]), 1e-12)) bad.push(`${key}.atNRisk[${j}] ${v} ${r.atNRisk}`); });
      at.nEvent.forEach((v, j) => { if (!near(v, num(([] as unknown[]).concat(r.atNEvent)[j]), 1e-12)) bad.push(`${key}.atNEvent[${j}] ${v} ${r.atNEvent}`); });
    }
    const summary: Record<string, number> = {};
    for (const b of bad) { const k = b.split(" ")[0]!.replace(/\[.*/, ""); summary[k] = (summary[k] ?? 0) + 1; }
    expect(bad.filter((b) => b.includes("median")).slice(0, 4)).toEqual([]);
    expect(summary).toEqual({});
    expect(keys.length).toBe(12);
  });
});

describe("survfitCoxph: the default profile", () => {
  it("is one curve at the means of the fit, as R", () => {
    const { d, weights, x } = setup("sim", "ATE");
    const s = survfitCoxph(d.time, d.status, x, { weights, robust: true });
    const r = fixture.survfit_sim_ATE_efron_default.value;
    expect(s.surv.length).toBe(1);
    s.surv[0]!.forEach((v, j) => expect(Math.abs(v - r.surv[j])).toBeLessThan(1e-10));
    s.stdErr[0]!.forEach((v, j) => expect(Math.abs(v - r["std.err"][j]) / r["std.err"][j]).toBeLessThan(1e-9));
    expect(s.median[0]).toEqual(r.table.values.slice(6, 9).map(Number));
  });
});
