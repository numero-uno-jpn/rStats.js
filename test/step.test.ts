import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lm, glm } from "../src/entries/tests.js";
import { step, stepAIC, drop1, add1, extractAIC, type StepModel } from "../src/entries/tests.js";

// R's step / stepAIC / drop1 / add1 / extractAIC (oracle/step.R, R 4.6.2 x86_64): the selected model, the path
// ($anova), the models visited (keep) and the order of the rows of each printed table
const fixture = JSON.parse(readFileSync(new URL("./fixtures/step.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number | null, tol: number): boolean =>
  b === null ? Number.isNaN(a) : Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function startOf(c: any): { fit: StepModel; data: any } {
  const data = fixture.data[c.set];
  const options: Record<string, unknown> = {};
  if (c.weights) options.weights = c.weights;
  if (c.offset) options.offset = c.offset;
  if (c.contrasts) options.contrasts = { f: c.contrasts };
  if (c.family === undefined) return { fit: lm(c.start, data, options), data };
  return { fit: glm(c.start, data, { ...options, family: c.family }), data };
}
function optionsOf(c: any, fit: StepModel): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (c.lower !== undefined || c.upper !== undefined) o.scope = c.lower === undefined ? c.upper : { lower: c.lower, ...(c.upper ? { upper: c.upper } : {}) };
  if (c.direction) o.direction = c.direction;
  if (c.k !== undefined) o.k = c.k === "log" ? Math.log("linearPredictors" in fit ? fit.priorWeights.filter((w) => w > 0).length : fit.nObs) : c.k;
  if (c.scale) o.scale = c.scale;
  if (c.steps !== undefined) o.steps = c.steps;
  return o;
}
/** The row labels of each table R printed (blocks after "Start:" / "Step:") */
function printedTables(lines: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] | undefined;
  let inTable = false;
  for (const line of lines) {
    if (/^(Start|Step):/.test(line)) {
      if (cur) out.push(cur);
      cur = [];
      inTable = false;
    } else if (/^\s+Df/.test(line)) inTable = true;
    else if (inTable && line.trim() === "") inTable = false;
    else if (inTable) cur!.push(/^(<none>|[-+] \S+)/.exec(line)![1]!);
  }
  if (cur) out.push(cur);
  return out;
}

describe("step and stepAIC against R", () => {
  for (const c of fixture.search) {
    it(c.name, () => {
      const { fit, data } = startOf(c);
      const fn = c.fn === "stepAIC" ? stepAIC : step;
      const opts = optionsOf(c, fit);
      const run = () => fn(fit, data, opts);
      if (c.name === "gaussian_weights0") {
        // R's gaussian AIC is Inf with weight-0 rows (their log 0), so R makes no move; rStats.js's glm leaves those rows
        // out of the likelihood (src/models/glmFamily.ts), so the search is that of the data without them
        const kept = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as unknown[]).filter((_, i) => data.w0[i] > 0)]));
        const a = run();
        const b = step(glm(c.start, kept as any, { family: "gaussian", weights: "w0" }), kept as any);
        expect(a.anova.step).toEqual(b.anova.step);
        a.anova.aic.forEach((v, i) => expect(near(v, b.anova.aic[i]!, 1e-12)).toBe(true));
        return;
      }
      if (c.error) {
        expect(run).toThrow(c.error);
        return;
      }
      const r = run();
      const bad: string[] = [];
      expect(r.fit.termLabels).toEqual(asArray(c.terms));
      expect(r.fit.coefNames).toEqual(asArray(c.coefNames));
      asArray<number | null>(c.coefficients).forEach((b, j) => {
        if (!near(r.fit.coefficients[j]!, b, 1e-9)) bad.push(`coef ${j}: ${r.fit.coefficients[j]} vs ${b}`);
      });
      const noise = c.name === "lm_perfect";
      const ex = extractAIC(r.fit, { k: (opts.k as number | undefined) ?? 2, ...(c.scale ? { scale: c.scale } : {}) });
      if (ex[0] !== c.extractAIC[0] || (!noise && !near(ex[1], c.extractAIC[1], 1e-11))) bad.push(`extractAIC ${ex} vs ${c.extractAIC}`);
      const a = c.anova;
      expect(r.anova.step).toEqual(asArray(a.Step));
      const crit = a.Cp !== undefined ? "Cp" : "AIC";
      expect(r.criterion).toBe(crit);
      // an essentially perfect fit: R's RSS (5e-30) is rounding noise, so the criterion n log(RSS / n) is too
      const cols: [string, number[], number][] = noise ? [["Df", r.anova.df, 0], ["Resid. Df", r.anova.residDf, 0]] : [["Df", r.anova.df, 0], ["Deviance", r.anova.deviance, 1e-9], ["Resid. Df", r.anova.residDf, 0], ["Resid. Dev", r.anova.residDeviance, 1e-11], [crit, r.anova.aic, 1e-11]];
      for (const [name, ours, tol] of cols) {
        asArray<number | null>(a[name]).forEach((v, i) => {
          if (!near(ours[i]!, v, tol)) bad.push(`anova ${name} ${i}: ${ours[i]} vs ${v}`);
        });
      }
      const keep = c.keep as any[];
      expect(r.visits.length).toBe(keep.length);
      keep.forEach((v, i) => {
        if (JSON.stringify(r.visits[i]!.termLabels) !== JSON.stringify(asArray(v.terms))) bad.push(`visit ${i} terms ${r.visits[i]!.termLabels}`);
        if (!noise && !near(r.visits[i]!.aic, v.aic, 1e-11)) bad.push(`visit ${i} aic ${r.visits[i]!.aic} vs ${v.aic}`);
      });
      // the tables: R prints one after each Start/Step line (empty for an aliased term removed)
      const printed = printedTables(asArray(c.printed));
      const ours = r.visits.map((v) => v.table?.move ?? []);
      expect(ours.slice(0, printed.length)).toEqual(printed);
      expect(r.warnings).toEqual([...new Set(asArray(c.warnings))]);
      expect(bad).toEqual([]);
    });
  }
});

describe("drop1, add1 and extractAIC against R", () => {
  const d = fixture.data.d;
  const e = fixture.data.e;
  const fits: Record<string, () => [any, any]> = {
    dlm: () => [lm("y ~ x1 + x2 + x3 + x4 + x5 + f", d), d],
    dnull: () => [lm("y ~ 1", d), d],
    ei: () => [lm("y ~ x1 * f + x2 + g", e), e],
    ew0: () => [lm("y ~ x1 + x2 + x3 + g", e, { weights: "w0" }), e],
    eNA: () => [lm("y ~ x1", e), e],
    ex1: () => [lm("y ~ x1", e), e],
    gb: () => [glm("yb ~ x1 + x2 + x3 + x4 + x5 + f", d, { family: "binomial" }), d],
    gbnull: () => [glm("yb ~ 1", d, { family: "binomial" }), d],
    gg: () => [glm("y ~ x1 + x2 + x3 + x4", d, { family: "gaussian" }), d],
    ggam: () => [glm("ygam ~ x1 + x2 + x3 + f", d, { family: "Gamma" }), d],
    ggam1: () => [glm("ygam ~ x1", d, { family: "Gamma" }), d],
    gp0: () => [glm("cnt ~ x1 + x2 + x3 + g", e, { family: "poisson", weights: "w0" }), e],
  };
  const full = "~ x1 + x2 + x3 + x4 + x5 + f";
  const tables: Record<string, [string, "drop1" | "add1", Record<string, unknown>]> = {
    drop1_lm: ["dlm", "drop1", {}], drop1_lm_bic: ["dlm", "drop1", { k: Math.log(60) }], drop1_lm_F: ["dlm", "drop1", { test: "F" }],
    drop1_lm_scale: ["dlm", "drop1", { scale: 1.2 }], drop1_lm_all: ["ei", "drop1", { scope: "~ x1 + f + x2 + g + x1:f" }],
    drop1_lm_marginal: ["ei", "drop1", {}], drop1_lm_w0: ["ew0", "drop1", {}], drop1_lm_w0_F: ["ew0", "drop1", { test: "F" }],
    add1_lm: ["dnull", "add1", { scope: full }], add1_lm_F: ["dnull", "add1", { scope: full, test: "F" }],
    add1_lm_marginal: ["ex1", "add1", { scope: "~ x1 * f + x2 + g" }], add1_lm_missing: ["eNA", "add1", { scope: "~ x1 + x2 + x3n" }],
    drop1_binomial: ["gb", "drop1", {}], drop1_binomial_LRT: ["gb", "drop1", { test: "LRT" }], drop1_binomial_Chisq: ["gb", "drop1", { test: "Chisq" }],
    add1_binomial_LRT: ["gbnull", "add1", { scope: full, test: "LRT" }],
    drop1_gaussian_LRT: ["gg", "drop1", { test: "LRT" }], drop1_gaussian_F: ["gg", "drop1", { test: "F" }],
    drop1_gamma_LRT: ["ggam", "drop1", { test: "LRT" }], drop1_gamma_F: ["ggam", "drop1", { test: "F" }],
    add1_gamma_F: ["ggam1", "add1", { scope: "~ x1 + x2 + x3 + f", test: "F" }], drop1_poisson_w0: ["gp0", "drop1", {}],
  };
  for (const [name, [fitName, fn, options]] of Object.entries(tables)) {
    it(name, () => {
      const want = fixture.tables[name];
      const [fit, data] = fits[fitName]!();
      const t = (fn === "drop1" ? drop1 : add1)(fit, data, options as any);
      const tab = want.table;
      expect(t.term).toEqual(asArray(tab.rownames));
      const bad: string[] = [];
      const check = (col: string, ours: number[] | undefined, tol: number) =>
        asArray<number | null>(tab[col]).forEach((v, i) => {
          if (ours === undefined || !near(ours[i]!, v, tol)) bad.push(`${col} ${i}: ${ours?.[i]} vs ${v}`);
        });
      check("Df", t.df, 0);
      if (tab["Sum of Sq"] !== undefined) check("Sum of Sq", t.sumOfSq, 1e-9);
      check(tab.RSS !== undefined ? "RSS" : "Deviance", t.deviance, 1e-11);
      check(tab.Cp !== undefined ? "Cp" : "AIC", t.aic, 1e-11);
      for (const [col, ours] of [["F value", t.statistic], ["LRT", t.statistic], ["scaled dev.", t.statistic], ["Pr(>F)", t.pValue], ["Pr(>Chi)", t.pValue]] as const) {
        if (tab[col] !== undefined) {
          check(col, ours, 1e-9);
          if (!col.startsWith("Pr") && t.statisticName !== col) bad.push(`statistic name ${t.statisticName} vs ${col}`);
        }
      }
      expect(t.warnings).toEqual([...new Set(asArray(want.warnings))]);
      expect(bad).toEqual([]);
    });
  }

  it("extractAIC", () => {
    const x = fixture.tables.extract;
    const cases: [string, any, Record<string, number>][] = [
      ["lm", fits.dlm!()[0], {}], ["lm_bic", fits.dlm!()[0], { k: Math.log(60) }], ["lm_scale", fits.dlm!()[0], { scale: 1.2 }],
      ["lm_w0", fits.ew0!()[0], {}], ["binomial", fits.gb!()[0], {}], ["gaussian", fits.gg!()[0], {}], ["gamma", fits.ggam!()[0], {}],
      ["poisson_w0", fits.gp0!()[0], {}], ["binomial_scale", fits.gb!()[0], { scale: 2 }],
    ];
    for (const [name, fit, o] of cases) {
      const [edf, v] = extractAIC(fit, o);
      expect(edf, name).toBe(x[name][0]);
      expect(near(v, x[name][1], 1e-12), `${name} ${v} vs ${x[name][1]}`).toBe(true);
    }
  });
});
