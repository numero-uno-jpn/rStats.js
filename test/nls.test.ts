import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  nls,
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
  };
  fit: { value?: PublicFit; error?: string };
  fitTight?: { value?: PublicFit; error?: string };
  newdata?: Record<string, number[]>;
  predict?: { value?: number[] };
}
interface Fixture {
  cases: Case[];
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
    expect(predicted).toHaveLength(cs.predict!.value!.length);
    for (let i = 0; i < predicted.length; i++) expect(predicted[i]).toBeCloseTo(cs.predict!.value![i]!, 5);

    const linear = fitCase("puromycin-plinear");
    const linearCase = byId("puromycin-plinear");
    const linearPredicted = nlsPredict(linear, { newdata: linearCase.newdata! });
    for (let i = 0; i < linearPredicted.length; i++) expect(linearPredicted[i]).toBeCloseTo(linearCase.predict!.value![i]!, 5);
  });

  it("uses deterministic self-start values and converges for Michaelis-Menten", () => {
    const fit = fitCase("puromycin-SSmicmen");
    const ref = byId("puromycin-SSmicmen").fitTight?.value ?? byId("puromycin-SSmicmen").fit.value!;
    compareCoefficients(fit.coefficients, ref.coefficients);
  });

  it("rejects missing starts for an ordinary formula and an invalid algorithm", () => {
    const cs = byId("error-no-start");
    expect(() => nls(cs.formula, dataFrame(cs.data))).toThrow(/start must be supplied/);
    const valid = byId("puromycin-default");
    expect(() => nls(valid.formula, dataFrame(valid.data), { start: valid.args.start!, algorithm: "bogus" as "default" })).toThrow(/unsupported algorithm/);
  });
});
