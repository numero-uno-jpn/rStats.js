import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loglin, loglm, loglmResiduals, loglmAnova, type ArrayTable } from "../src/models/loglin.js";

// R fixture from oracle/loglin.R (npm run oracle -- loglin): stats' loglin and MASS's loglm. rStats.js repeats R's
// iterations, so the fits agree to rounding even where IPF stopped early (eps = 0.1). R prints the deviation to 7
// digits; a deviation near 0 is rounding
const fixture = JSON.parse(readFileSync(new URL("./fixtures/loglin.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
const table = (name: string): ArrayTable => {
  const t = fixture.tables[name];
  const out: ArrayTable = { counts: arr(t.counts) as number[], dim: arr(t.dim) as number[] };
  if (t.names) { out.names = arr(t.names) as string[]; out.levels = (t.levels as unknown[]).map((l) => arr(l) as string[]); }
  return out;
};
// R's margin list: each element a vector (a scalar when of length 1)
const margins = (m: unknown): (string | number)[][] => (Array.isArray(m) ? m : m === null || m === undefined ? [] : [m]).map((x) => arr(x) as (string | number)[]);

describe("loglin against stats::loglin", () => {
  it("gives R's fits, statistics, df, parameters, iterations and deviations", () => {
    const bad: string[] = [];
    for (const c of fixture.loglin as Record<string, any>[]) {
      const key = `${c.table} ${JSON.stringify(c.margin)} eps ${c.eps} iter ${c.iter}${c.start ? " start" : ""}`;
      const opts: Record<string, unknown> = { eps: c.eps, iter: c.iter };
      if (c.start) opts.start = fixture[c.start];
      if (c.error) { expect(() => loglin(table(c.table), margins(c.margin), opts), key).toThrow(); continue; }
      const r = loglin(table(c.table), margins(c.margin), opts);
      if (!near(r.lrt, c.lrt, 1e-12) || !near(r.pearson, c.pearson, 1e-12) || r.df !== c.df) bad.push(`${key} stats ${r.lrt} ${c.lrt} ${r.pearson} ${c.pearson} ${r.df} ${c.df}`);
      (arr(c.fit) as number[]).forEach((v, i) => { if (!near(r.fit[i]!, v, 1e-12)) bad.push(`${key} fit[${i}] ${r.fit[i]} ${v}`); });
      if (r.iterations !== c.iterations) bad.push(`${key} iterations ${r.iterations} ${c.iterations}`);
      if (c.deviation !== null && c.deviation !== undefined && Math.abs(r.deviation - c.deviation) > 1e-12 + 1e-6 * c.deviation) bad.push(`${key} deviation ${r.deviation} ${c.deviation}`);
      if ((r.warnings.length > 0) !== (arr(c.warnings).length > 0)) bad.push(`${key} warnings`);
      if (JSON.stringify(r.paramNames) !== JSON.stringify(arr(c.param_names))) bad.push(`${key} param names ${r.paramNames}`);
      for (const [nm, v] of Object.entries(c.param as Record<string, unknown>)) {
        (arr(v) as (number | null)[]).forEach((x, i) => { if (x === null ? !Number.isNaN(r.param[nm]?.[i]) : !near(r.param[nm]?.[i] ?? NaN, x, 1e-10)) bad.push(`${key} param ${nm}[${i}] ${r.param[nm]?.[i]} ${x}`); });
      }
      if (JSON.stringify(r.margin) !== JSON.stringify(margins(c.margin_out))) bad.push(`${key} margin ${JSON.stringify(r.margin)} ${JSON.stringify(c.margin_out)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("loglm against MASS::loglm", () => {
  const check = (key: string, r: ReturnType<typeof loglm>, c: Record<string, any>, bad: string[], fitted = true) => {
    if (!near(r.lrt, c.lrt, 1e-12) || !near(r.pearson, c.pearson, 1e-12) || r.df !== c.df || !near(r.deviance, c.deviance, 1e-12)) bad.push(`${key} stats ${r.lrt} ${c.lrt} ${r.df} ${c.df}`);
    if (JSON.stringify(r.margin) !== JSON.stringify(margins(c.margin))) bad.push(`${key} margin ${JSON.stringify(r.margin)} ${JSON.stringify(c.margin)}`);
    if (JSON.stringify(r.paramNames) !== JSON.stringify(arr(c.param_names))) bad.push(`${key} param names`);
    if (r.nobs !== c.nobs) bad.push(`${key} nobs`);
    if (!fitted) return;
    (arr(c.fitted) as number[]).forEach((v, i) => { if (!near(r.fit[i]!, v, 1e-12)) bad.push(`${key} fitted[${i}]`); });
    for (const type of ["deviance", "pearson", "response"] as const) {
      const mine = loglmResiduals(r, { type });
      (arr(c.residuals[type]) as number[]).forEach((v, i) => { if (!near(mine[i]!, v, 1e-10)) bad.push(`${key} residuals ${type}[${i}] ${mine[i]} ${v}`); });
    }
  };
  it("gives R's fits on tables", () => {
    const bad: string[] = [];
    for (const c of fixture.loglm as Record<string, any>[]) check(c.formula, loglm(c.formula, table(c.table)), c, bad);
    expect(bad).toEqual([]);
  });
  it("gives R's fits on data frames with frequencies, missing cells as structural zeros", () => {
    const bad: string[] = [];
    const levels = { Hair: ["Black", "Brown", "Red", "Blond"], Eye: ["Brown", "Blue", "Hazel", "Green"], Sex: ["Male", "Female"] };
    for (const c of fixture.loglm_frame as Record<string, any>[]) {
      check(`${c.formula} ${c.data}`, loglm(c.formula, fixture.data[c.data], { levels }), c, bad, c.data === "df3");
    }
    expect(bad).toEqual([]);
  });
  it("gives R's anova", () => {
    const a = fixture.anova[0];
    const fits = (a.formulas as string[]).map((f) => loglm(f, table(a.table)));
    const r = loglmAnova(...fits), v = a.values as number[][];
    expect(r.rows).toEqual(a.rows);
    r.deviance.forEach((d, i) => {
      expect(d).toBeCloseTo(v[i]![0]!, 10);
      expect(r.df[i]).toBe(v[i]![1]);
      if (i > 0) { expect(r.deltaDeviance[i]).toBeCloseTo(v[i]![2]!, 10); expect(r.deltaDf[i]).toBe(v[i]![3]); expect(r.p[i]).toBeCloseTo(v[i]![4]!, 10); }
    });
  });
});
