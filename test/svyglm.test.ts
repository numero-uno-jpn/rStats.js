import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { weightit, type WeightitEstimand } from "../src/entries/causal.js";
import { svyglm } from "../src/entries/tests.js";
import { covariateColumns } from "../src/causal/weightit.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/weightit.json", import.meta.url), "utf8")) as Record<string, any>;
const covs: Record<string, string[]> = {
  sim: ["x1", "x2", "x3"], lalonde: ["age", "educ", "race", "married", "nodegree", "re74", "re75"],
};

describe("svyglm against survey::svyglm (svydesign(ids = ~1, weights))", () => {
  it("gives R's coefficients, design-based variance, t tests, dispersion and deviance", () => {
    const bad: string[] = [];
    const keys = Object.keys(fixture).filter((k) => k.startsWith("svyglm_"));
    for (const key of keys) {
      const [, set, est, stab, y, family] = /^svyglm_(sim|lalonde)_ps_logit_(ATE|ATT|ATO)(_stab)?_(\w+?)_(gaussian|binomial|quasibinomial)$/.exec(key)!;
      const d = fixture.data[set!];
      const cv = Object.fromEntries(covs[set!]!.map((c) => [c, d[c]]));
      const w = weightit(d.tr, cv, { estimand: est as WeightitEstimand, stabilize: stab !== undefined }).weights;
      const { columns } = covariateColumns(cv, d.tr.length);
      const X = d.tr.map((t: number, i: number) => [t, ...columns.map((c) => c[i]!)]);
      const fit = svyglm(X, d[y!], { weights: w, family: family as "binomial" });
      const r = fixture[key].value;
      const p = r.coef.length;
      const near = (a: number, b: number, tol = 1e-10): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
      fit.coefficients.forEach((b, j) => { if (!near(b, r.coef[j])) bad.push(`${key}.coef[${j}] ${b} ${r.coef[j]}`); });
      fit.vcov.flat().forEach((v, k) => { const e = r.vcov[(k % p) * p + Math.floor(k / p)]; if (!near(v, e, 1e-8)) bad.push(`${key}.vcov[${k}]`); });
      // table: Estimate, Std. Error, t value, Pr(>|t|) by column
      fit.se.forEach((v, j) => { if (!near(v, r.table[p + j], 1e-8)) bad.push(`${key}.se[${j}]`); });
      fit.pValue.forEach((v, j) => { if (!near(v, r.table[3 * p + j], 1e-7)) bad.push(`${key}.p[${j}] ${v} ${r.table[3 * p + j]}`); });
      if (fit.dfResidual !== r["df.residual"]) bad.push(`${key}.df`);
      if (!near(fit.dispersion, r.dispersion, 1e-9)) bad.push(`${key}.dispersion ${fit.dispersion} ${r.dispersion}`);
      if (!near(fit.deviance, r.deviance, 1e-9)) bad.push(`${key}.deviance ${fit.deviance} ${r.deviance}`);
      if (!near(fit.nullDeviance, r["null.deviance"], 1e-9)) bad.push(`${key}.nullDeviance`);
      if (fit.iter !== r.iter) bad.push(`${key}.iter ${fit.iter} ${r.iter}`);
      const rw = ([] as string[]).concat(fixture[key].warnings ?? []);
      if (JSON.stringify(fit.warnings) !== JSON.stringify(rw)) bad.push(`${key}.warnings ${fit.warnings} | ${rw}`);
    }
    expect(bad).toEqual([]);
    expect(keys.length).toBe(20);
  });
});
