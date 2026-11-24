import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { glm, glmSummary, glmAnova, glmPredict } from "../src/entries/tests.js";

// R's glm with a formula and a data frame (oracle/glmformula.R): the formula's model matrix, the response forms, weights
// and offsets as columns, the rows dropped for missing values. R's own stopping (epsilon 1e-8) on both sides.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/glmformula.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

describe("glm with a formula against R's glm(formula, data)", () => {
  it("gives R's coefficients, deviances, AIC, degrees of freedom, iterations, fitted values and warnings", () => {
    const bad: string[] = [];
    for (const c of fixture.cases) {
      const options: Record<string, unknown> = { family: c.family };
      if (c.link) options.link = c.link;
      if (c.weights) options.weights = c.weights;
      if (c.offset) options.offset = c.offset;
      const fit = glm(c.formula, fixture.data[c.set], options);
      const tag = `${c.set} ${c.formula}`;
      if (JSON.stringify(fit.coefNames) !== JSON.stringify(asArray(c.coefNames))) bad.push(`${tag}: names ${fit.coefNames}`);
      asArray<number | null>(c.coefficients).forEach((b, j) => {
        const v = fit.coefficients[j]!;
        if (b === null ? !Number.isNaN(v) : !near(v, b, 1e-13)) bad.push(`${tag}: coef ${j} ${v} vs ${b}`);
      });
      for (const [k, v] of [["deviance", fit.deviance], ["nullDeviance", fit.nullDeviance], ["aic", fit.aic]] as const) {
        if (!near(v, c[k], 1e-13)) bad.push(`${tag}: ${k} ${v} vs ${c[k]}`);
      }
      for (const [k, v] of [["rank", fit.rank], ["dfResidual", fit.dfResidual], ["dfNull", fit.dfNull], ["iter", fit.iter], ["nUsed", fit.fittedValues.length]] as const) {
        if (v !== c[k]) bad.push(`${tag}: ${k} ${v} vs ${c[k]}`);
      }
      if (fit.converged !== c.converged) bad.push(`${tag}: converged`);
      asArray<number>(c.fittedValues).forEach((m, i) => {
        if (!near(fit.fittedValues[i]!, m, 1e-13)) bad.push(`${tag}: fitted ${i}`);
      });
      if (JSON.stringify(fit.warnings) !== JSON.stringify(asArray(c.warnings))) bad.push(`${tag}: warnings ${JSON.stringify(fit.warnings)} vs ${JSON.stringify(c.warnings)}`);
    }
    expect(bad).toEqual([]);
  });

  it("is the matrix form on the formula's model matrix", () => {
    const d = fixture.data.d;
    const f = glm("yb ~ x1 * f + g", d, { family: "binomial" });
    const x = f.model.x.map((r) => r.slice(1));
    const m = glm(x, d.yb, { family: "binomial" });
    expect(f.coefficients).toEqual(m.coefficients);
    expect(f.deviance).toBe(m.deviance);
    expect(glmSummary(f).stdError).toEqual(glmSummary(m).stdError);
    expect(f.termLabels).toEqual(["x1", "f", "g", "x1:f"]);
    expect(f.assign).toEqual([0, 1, 2, 2, 3, 4, 4]);
  });

  it("keeps the rows used, the methods working and the options for refits", () => {
    const dn = fixture.data.dn;
    const f = glm("yb ~ x1 + x2", dn, { family: "binomial", weights: "w" });
    expect(f.model.rows).toEqual(Array.from({ length: 60 }, (_, i) => i).filter((i) => ![3, 17, 32, 6, 49].includes(i)));
    expect(glmAnova(f).table.length).toBe(3);
    const p = glmPredict(f, { type: "response" });
    expect(p.fit.length).toBe(55);
  });

  it("rejects a factor response outside the binomial families and a formula without response", () => {
    const d = fixture.data.d;
    expect(() => glm("f ~ x1", d, { family: "poisson" })).toThrow("response must be numeric");
    expect(() => glm("~ x1", d)).toThrow("the formula has no response");
    expect(() => glm("cnt ~ x1", d, { offset: "nope" })).toThrow("object 'nope' not found");
  });
});
