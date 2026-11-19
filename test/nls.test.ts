import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  nls,
  nlsAnova,
  nlsConfint,
  nlsPredict,
  nlsSummary,
  nlsVcov,
} from "../src/entries/regression.js";
import type { DataFrame } from "../src/models/modelFrame.js";

interface PublicFit {
  coefficients: Record<string, number>;
  summary: { rows: string[]; cols: string[]; values: number[][] };
  sigma: number;
  deviance: number;
  dfResidual: number;
  fitted: number[];
  residuals: number[];
}
interface Case {
  id: string;
  formula: string;
  data: Record<string, number[]>;
  args: {
    start?: Record<string, number>;
    algorithm?: "plinear" | "port";
    lower?: number[];
    upper?: number[];
    weights?: string;
    control?: { maxiter?: number; tol?: number; minFactor?: number; warnOnly?: boolean; scaleOffset?: number };
  };
  fit: { value?: PublicFit; error?: string };
  fitTight?: { value?: PublicFit; error?: string };
  newdata?: Record<string, number[]>;
  predict?: { value?: number[] };
  confint?: Record<string, { value?: { rows?: string[]; cols?: string[] | null; values?: number[][] } }>;
}
interface Fixture {
  cases: Case[];
  anova?: { data: Record<string, number[]>; models: { formula: string; start: Record<string, number> }[]; result: { value: { table: Record<string, (string | number)[]> } } };
}

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../test/fixtures/nls.json", import.meta.url)), "utf8")) as Fixture;
const byId = (id: string): Case => {
  const found = fixture.cases.find(x => x.id === id);
  if (!found) throw new Error("missing nls fixture: " + id);
  return found;
};
const dataFrame = (data: Record<string, number[]>): DataFrame => data;

function fitCase(id: string) {
  const cs = byId(id);
  return nls(cs.formula, dataFrame(cs.data), {
    ...(cs.args.start === undefined ? {} : { start: cs.args.start }),
    ...(cs.args.algorithm === undefined ? {} : { algorithm: cs.args.algorithm }),
    ...(cs.args.lower === undefined ? {} : { lower: cs.args.lower }),
    ...(cs.args.upper === undefined ? {} : { upper: cs.args.upper }),
    ...(cs.args.weights === undefined ? {} : { weights: cs.args.weights }),
    ...(cs.args.control === undefined ? {} : { control: cs.args.control }),
  });
}

function compareCoefficients(actual: Record<string, number>, expected: Record<string, number>) {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const name of Object.keys(expected)) expect(actual[name]).toBeCloseTo(expected[name]!, 6);
}

describe("nonlinear least-squares regression", () => {
  it.each(["puromycin-default", "puromycin-port", "puromycin-weights"])("fits %s to the tight public reference", id => {
    const cs = byId(id);
    const fit = fitCase(id);
    const ref = cs.fitTight?.value ?? cs.fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
    expect(fit.deviance).toBeCloseTo(ref.deviance, 6);
    expect(fit.converged).toBe(true);
    expect(fit.dfResidual).toBe(ref.dfResidual);
    expect(fit.fitted.length).toBe(ref.fitted.length);
    for (let i = 0; i < ref.fitted.length; i++) expect(fit.fitted[i]).toBeCloseTo(ref.fitted[i]!, 6);
  });

  it("profiles the linear amplitude for the plinear algorithm", () => {
    const cs = byId("puromycin-plinear");
    const fit = fitCase(cs.id);
    const ref = cs.fitTight?.value ?? cs.fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
    expect(fit.deviance).toBeCloseTo(ref.deviance, 6);
    expect(fit.coefficients[".lin"]).toBeGreaterThan(0);
  });

  it("returns the complete summary and covariance dimensions", () => {
    const fit = fitCase("puromycin-default");
    const summary = nlsSummary(fit);
    expect(summary.coefficients.rows).toEqual(["Vm", "K"]);
    expect(summary.coefficients.cols).toEqual(["Estimate", "Std. Error", "t value", "Pr(>|t|)"]);
    expect(summary.coefficients.values).toHaveLength(2);
    expect(summary.coefficients.values[0]).toHaveLength(4);
    expect(nlsVcov(fit)).toHaveLength(2);
    expect(nlsVcov(fit)[0]).toHaveLength(2);
  });

  it("predicts new observations and applies the plinear coefficient", () => {
    const cs = byId("puromycin-default");
    const fit = fitCase(cs.id);
    const predicted = nlsPredict(fit, { newdata: cs.newdata! });
    const newConc = cs.newdata!.conc!;
    expect(predicted).toHaveLength(newConc.length);
    for (let i = 0; i < predicted.length; i++) {
      const expected = fit.coefficients.Vm! * newConc[i]! / (fit.coefficients.K! + newConc[i]!);
      expect(predicted[i]).toBeCloseTo(expected, 12);
    }

    const linear = fitCase("puromycin-plinear");
    const linearCase = byId("puromycin-plinear");
    const linearPredicted = nlsPredict(linear, { newdata: linearCase.newdata! });
    for (let i = 0; i < linearPredicted.length; i++) {
      const x = linearCase.newdata!.conc![i]!;
      const expected = linear.coefficients[".lin"]! * x / (linear.coefficients.K! + x);
      expect(linearPredicted[i]).toBeCloseTo(expected, 12);
    }
  });

  it("uses deterministic self-start values and converges for Michaelis-Menten", () => {
    const fit = fitCase("puromycin-SSmicmen");
    const ref = byId("puromycin-SSmicmen").fitTight?.value ?? byId("puromycin-SSmicmen").fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
  });


  it("fits every successful fixture case against the tight reference", () => {
    const cases = fixture.cases.filter(cs => cs.fitTight?.value !== undefined && cs.id !== "maxiter-warnOnly");
    const mismatches: string[] = [];
    for (const cs of cases) {
      try {
        const fit = fitCase(cs.id);
        const ref = cs.fitTight!.value!;
        for (const name of Object.keys(ref.coefficients)) {
          const actual = fit.coefficients[name];
          const expected = ref.coefficients[name]!;
          if (actual === undefined || Math.abs(actual - expected) > 5e-7) {
            mismatches.push(`${cs.id}: coefficient ${name} (${actual} vs ${expected})`);
          }
        }
        if (Math.abs(fit.deviance - ref.deviance) > 5e-7) mismatches.push(`${cs.id}: deviance (${fit.deviance} vs ${ref.deviance})`);
        if (Math.abs(fit.sigma - ref.sigma) > 5e-7) mismatches.push(`${cs.id}: sigma (${fit.sigma} vs ${ref.sigma})`);
        if (fit.dfResidual !== ref.dfResidual) mismatches.push(`${cs.id}: residual df`);
        if (fit.fitted.length !== ref.fitted.length) mismatches.push(`${cs.id}: fitted length`);
        for (let i = 0; i < ref.fitted.length; i++) {
          if (Math.abs(fit.fitted[i]! - ref.fitted[i]!) > 5e-7) mismatches.push(`${cs.id}: fitted[${i}]`);
        }
        const summary = nlsSummary(fit).coefficients;
        if (summary.rows.join("|") !== ref.summary.rows.join("|") || summary.cols.join("|") !== ref.summary.cols.join("|")) {
          mismatches.push(`${cs.id}: summary labels`);
        }
        for (let i = 0; i < ref.summary.values.length; i++) for (let j = 0; j < ref.summary.values[i]!.length; j++) {
          if (Math.abs(summary.values[i]![j]! - ref.summary.values[i]![j]!) > (j === 3 ? 1e-10 * Math.max(1e-4, Math.abs(ref.summary.values[i]![j]!)) : 5e-7)) mismatches.push(`${cs.id}: summary[${i},${j}]`);
        }
      } catch (error) {
        mismatches.push(`${cs.id}: threw ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("handles all documented error and exact-fit boundary cases", () => {
    const errorIds = [
      "error-no-start", "error-singular-start", "error-singular-gradient",
      "error-maxiter", "error-algorithm", "error-port-start-outside", "error-too-few-rows",
    ];
    for (const id of errorIds) {
      const cs = byId(id);
      expect(() => fitCase(id), id).toThrow();
    }
    const exact = fitCase("error-exact-fit");
    expect(exact.converged).toBe(true);
    expect(exact.exactFit).toBe(true);
    expect(exact.covariance.flat().every(Number.isNaN)).toBe(true);
    const warnOnly = fitCase("maxiter-warnOnly");
    expect(warnOnly.converged).toBe(false);
    expect(warnOnly.warnings.length).toBeGreaterThan(0);
    const na = fitCase("puromycin-na-row");
    expect(na.nobs).toBe(11);
  });

  it("matches all fixture profile endpoints, including plinear", () => {
    const cases = fixture.cases.filter(cs => cs.confint?.profile95?.value !== undefined);
    const mismatches: string[] = [];
    for (const cs of cases) {
      const fit = fitCase(cs.id);
      for (const level of ["profile95", "profile90"] as const) {
        const expected = cs.confint?.[level]?.value;
        if (!expected?.values) continue;
        const conf = nlsConfint(fit, { method: "profile", level: level === "profile95" ? 0.95 : 0.9 });
        if (cs.args.algorithm === "plinear") {
          const actual = conf.values[0]!;
          const lower = expected.values[0]![0]!;
          const upper = expected.values[1]![0]!;
          if (Math.abs(actual[0] - lower) > 2e-5 * Math.max(1, Math.abs(lower))) mismatches.push(`${cs.id} ${level} lower`);
          if (Math.abs(actual[1] - upper) > 2e-5 * Math.max(1, Math.abs(upper))) mismatches.push(`${cs.id} ${level} upper`);
        } else {
          for (let i = 0; i < expected.values.length; i++) {
            for (let j = 0; j < 2; j++) {
              const a = conf.values[i]?.[j] ?? Number.NaN;
              const e = expected.values[i]![j]!;
              if (Math.abs(a - e) > 2e-5 * Math.max(1, Math.abs(e))) mismatches.push(`${cs.id} ${level} [${i},${j}] ${a} vs ${e}`);
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches the nested-model ANOVA fixture", () => {
    const oracle = fixture.anova!;
    const fits = oracle.models.map(model => nls(model.formula, dataFrame(oracle.data), { start: model.start }));
    const result = nlsAnova(...fits);
    const expected = oracle.result.value.table;
    for (const key of Object.keys(expected)) {
      const actual = result.table[key as keyof typeof result.table];
      expect(actual.length).toBe(expected[key]!.length);
      for (let i = 0; i < actual.length; i++) {
        const e = expected[key]![i]!;
        if (typeof e === "number" && typeof actual[i] === "number") expect(actual[i]).toBeCloseTo(e, 6);
        else expect(actual[i]).toBe(e);
      }
    }
  });

  it("rejects missing starts for an ordinary formula and an invalid algorithm", () => {
    const cs = byId("error-no-start");
    expect(() => nls(cs.formula, dataFrame(cs.data))).toThrow(/start must be supplied/);
    const valid = byId("puromycin-default");
    expect(() => nls(valid.formula, dataFrame(valid.data), { start: valid.args.start!, algorithm: "bogus" as "default" })).toThrow(/unsupported algorithm/);
  });
});
