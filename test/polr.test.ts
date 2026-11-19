import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  __polrDerivativesForTest,
  polr,
  polrPredict,
  polrSummary,
  polrVcov,
  type PolrMethod,
  type PolrOptions,
  type PolrResult,
} from "../src/models/polr.js";
import type { DataFrame } from "../src/models/modelFrame.js";

type Raw = Record<string, unknown>;
type PublicFit = {
  coefficients: Record<string, unknown>;
  zeta: Record<string, unknown>;
  deviance: unknown;
  summary: { rows: string[]; cols: string[]; values: unknown[][] };
  vcov: { rows: string[]; cols: string[]; values: unknown[][] };
};
type FitSpec = {
  formula: string;
  data: { columns: Record<string, unknown> };
  method?: PolrMethod;
  weights?: string;
  start?: Record<string, unknown>;
};
type RawNewData = { rowNames?: string[]; columns: Record<string, unknown> };
type FixtureCall = {
  operation: string;
  args?: { newdata?: RawNewData; type?: "class" | "probs" };
  result: { value?: unknown; error?: string };
};
type FixtureCase = {
  id: string;
  fits: {
    main?: {
      fit: FitSpec;
      fitPublic?: PublicFit;
      fitTight?: { fitPublic?: PublicFit };
    };
  };
  calls?: FixtureCall[];
};
type Fixture = { cases: FixtureCase[] };

const fixturePath = fileURLToPath(new URL("./fixtures/polr.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

function numeric(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function prepareFit(spec: FitSpec): { data: DataFrame; options: PolrOptions } {
  const data: DataFrame = {};
  const levels: Record<string, readonly string[]> = {};
  for (const [name, raw] of Object.entries(spec.data.columns)) {
    const objectColumn = Array.isArray(raw) ? undefined : raw as Raw;
    const values = (objectColumn === undefined ? raw : objectColumn.values) as (number | string | boolean | null)[];
    if (!Array.isArray(values)) throw new Error(`invalid fixture column: ${name}`);
    const declaredLevels = objectColumn?.levels;
    if (Array.isArray(declaredLevels)) levels[name] = declaredLevels as string[];
    const isNumeric = !Array.isArray(declaredLevels)
      && values.every((value) => value === null || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))));
    data[name] = isNumeric ? values.map((value) => value === null ? null : numeric(value)) : values;
  }
  const options: PolrOptions = { levels };
  if (spec.method !== undefined) options.method = spec.method;
  if (spec.weights !== undefined) options.weights = spec.weights;
  if (spec.start !== undefined) options.start = Object.values(spec.start).map(numeric);
  return { data, options };
}

function fitCase(id: string): { fixtureCase: FixtureCase; fit: PolrResult; expected: PublicFit; tight: PublicFit } {
  const fixtureCase = fixture.cases.find((item) => item.id === id);
  const main = fixtureCase?.fits.main;
  if (fixtureCase === undefined || main?.fitPublic === undefined || main.fitTight?.fitPublic === undefined) {
    throw new Error(`missing successful fixture fit: ${id}`);
  }
  const { data, options } = prepareFit(main.fit);
  const fit = polr(main.fit.formula, data, options);
  return { fixtureCase, fit, expected: main.fitPublic, tight: main.fitTight.fitPublic };
}

function closeAbsolute(actual: number, expected: unknown, tolerance: number, label: string): void {
  const target = numeric(expected);
  expect(Math.abs(actual - target), label).toBeLessThanOrEqual(tolerance);
}

function namedEstimates(fit: PolrResult): Record<string, number> {
  return { ...fit.coefficients, ...fit.zeta };
}

const tightCases = [
  "housing-logistic",
  "housing-probit",
  "housing-cloglog",
  "housing-loglog",
] as const;

describe("polr: fit, summary and covariance", () => {
  for (const id of tightCases) {
    it(`${id} agrees with the tight reference fit`, () => {
      const { fit, expected, tight } = fitCase(id);
      const actual = namedEstimates(fit);
      const tightEstimates = { ...tight.coefficients, ...tight.zeta };
      const rEstimates = { ...expected.coefficients, ...expected.zeta };
      expect(Object.keys(actual)).toEqual(Object.keys(tightEstimates));

      for (const name of Object.keys(actual)) {
        // The observed maximum discrepancy against fitTight was 8e-8; 1e-7
        // leaves a small rounding margin while remaining far below R's default
        // stopping differences. R's ordinary fit is checked with its measured
        // displacement from fitTight, rather than treating it as an exact root.
        closeAbsolute(actual[name]!, tightEstimates[name], 1e-7, `${id} ${name} vs fitTight`);
        const rStoppingDisplacement = Math.abs(numeric(rEstimates[name]) - numeric(tightEstimates[name]));
        closeAbsolute(actual[name]!, rEstimates[name], 1e-7 + 1.1 * rStoppingDisplacement, `${id} ${name} vs R default`);
      }

      closeAbsolute(fit.deviance, tight.deviance, 1e-7, `${id} deviance`);
      const summary = polrSummary(fit);
      expect(summary.rows).toEqual(tight.summary.rows);
      expect(summary.columns).toEqual(tight.summary.cols);
      const expectedSummary = tight.summary.values.map((row) => row.map(numeric));
      for (let i = 0; i < summary.values.length; i++) {
        closeAbsolute(summary.values[i]![0]!, expectedSummary[i]![0], 1e-7, `${id} summary estimate ${i}`);
        // MASS computes its Hessian numerically. A 1.5e-5 absolute bound
        // covers the observed ~1.2e-5 standard-error difference without
        // weakening the much tighter estimate checks above.
        closeAbsolute(summary.values[i]![1]!, expectedSummary[i]![1], 1.5e-5, `${id} summary SE ${i}`);
        closeAbsolute(summary.values[i]![2]!, summary.values[i]![0]! / summary.values[i]![1]!, 1e-12, `${id} summary t identity ${i}`);
      }

      const covariance = polrVcov(fit);
      expect(covariance.rows).toEqual(tight.vcov.rows);
      expect(covariance.columns).toEqual(tight.vcov.cols);
      const expectedCovariance = tight.vcov.values.map((row) => row.map(numeric));
      const scale = Math.max(1e-12, ...expectedCovariance.flat().map(Math.abs));
      for (let i = 0; i < covariance.values.length; i++) {
        for (let j = 0; j < covariance.values[i]!.length; j++) {
          // Compare the full matrix on a common scale: tiny off-diagonal
          // entries should not receive an unstable cell-relative tolerance.
          expect(Math.abs(covariance.values[i]![j]! - expectedCovariance[i]![j]!) / scale,
            `${id} vcov[${i},${j}]`).toBeLessThanOrEqual(5e-4);
        }
      }
    });
  }
});

function richardsonDerivative(fn: (theta: number[]) => number, theta: readonly number[], column: number): number {
  const h = 2e-4 * Math.max(1, Math.abs(theta[column]!));
  const at = (step: number): number => {
    const plus = Array.from(theta), minus = Array.from(theta);
    plus[column] = plus[column]! + step;
    minus[column] = minus[column]! - step;
    return (fn(plus) - fn(minus)) / (2 * step);
  };
  const coarse = at(h), fine = at(h / 2);
  return (4 * fine - coarse) / 3;
}

const derivativeCases = [
  ["housing-logistic", "logistic"],
  ["housing-probit", "probit"],
  ["housing-cloglog", "cloglog"],
  ["housing-loglog", "loglog"],
  ["housing-cauchit-start", "cauchit"],
] as const;

describe("polr: analytic score and observed Hessian", () => {
  for (const [id, method] of derivativeCases) {
    it(`${method} derivatives agree with Richardson differences (${id})`, () => {
      const { fit } = fitCase(id);
      const model = fit.model;
      const theta = model.theta;
      const evaluate = (point: number[]) => __polrDerivativesForTest(
        model.x, model.y, model.weights, model.offset, model.responseLevels.length, method, point,
      );
      const analytic = evaluate(theta);
      for (let j = 0; j < theta.length; j++) {
        const numericScore = richardsonDerivative((point) => evaluate(point).value, theta, j);
        expect(Math.abs(analytic.gradient[j]! - numericScore), `${id} score[${j}]`)
          .toBeLessThanOrEqual(2e-5 * Math.max(1, Math.abs(numericScore)));
        for (let i = 0; i < theta.length; i++) {
          const numericHessian = richardsonDerivative((point) => evaluate(point).gradient[i]!, theta, j);
          expect(Math.abs(analytic.hessian[i]![j]! - numericHessian), `${id} Hessian[${i},${j}]`)
            .toBeLessThanOrEqual(2e-5 * Math.max(1, Math.abs(numericHessian)));
        }
      }
    });
  }
});

function independentCauchyLogLikelihood(fit: PolrResult): number {
  const { x, y, weights, offset, responseLevels } = fit.model;
  const beta = Object.values(fit.coefficients);
  const cuts = Object.values(fit.zeta);
  const cdf = (value: number): number => 0.5 + Math.atan(value) / Math.PI;
  let logLikelihood = 0;
  for (let i = 0; i < y.length; i++) {
    if (weights[i] === 0) continue;
    let eta = offset[i]!;
    for (let j = 0; j < beta.length; j++) eta += x[i]![j]! * beta[j]!;
    const category = y[i]!;
    const probability = category === 0
      ? cdf(cuts[0]! - eta)
      : category === responseLevels.length - 1
        ? 1 - cdf(cuts[cuts.length - 1]! - eta)
        : cdf(cuts[category]! - eta) - cdf(cuts[category - 1]! - eta);
    logLikelihood += weights[i]! * Math.log(probability);
  }
  return logLikelihood;
}

describe("polr: standard cauchit reference", () => {
  for (const id of ["housing-cauchit-start", "mtcars-cauchit"]) {
    it(`${id} uses the standard Cauchy cumulative distribution`, () => {
      const { fit } = fitCase(id);
      expect(fit.model.method).toBe("cauchit");
      const independent = independentCauchyLogLikelihood(fit);
      closeAbsolute(fit.logLik, independent, 1e-10 * Math.max(1, fit.nobs), `${id} independent Cauchy log likelihood`);
    });
  }
});


function prepareNewData(raw: RawNewData): { data: DataFrame; rowNames: string[] } {
  const data: DataFrame = {};
  for (const [name, column] of Object.entries(raw.columns)) {
    const objectColumn = Array.isArray(column) ? undefined : column as Raw;
    const source = objectColumn !== undefined && Array.isArray(objectColumn.values)
      ? objectColumn.values
      : Array.isArray(column) ? column : [column];
    const declaredLevels = objectColumn?.levels;
    const numericColumn = !Array.isArray(declaredLevels)
      && source.every((value) => value === null || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))));
    data[name] = numericColumn
      ? source.map((value) => value === null ? null : numeric(value))
      : source as (number | string | boolean | null)[];
  }
  const rowNames = raw.rowNames ?? Array.from(
    { length: Object.values(data)[0]?.length ?? 0 }, (_, i) => String(i + 1),
  );
  return { data, rowNames };
}

const predictionCalls = fixture.cases.flatMap((fixtureCase) =>
  (fixtureCase.calls ?? [])
    .filter((call) => call.operation === "predict")
    .map((call, index) => ({ fixtureCase, call, index })),
);

describe("polrPredict: all prediction fixtures", () => {
  for (const { fixtureCase, call, index } of predictionCalls) {
    it(`${fixtureCase.id} predict #${index + 1} (${call.args?.type ?? "class"})`, () => {
      if (call.args?.newdata === undefined) throw new Error("fixture prediction has no newdata");
      const { fit } = fitCase(fixtureCase.id);
      const { data, rowNames } = prepareNewData(call.args.newdata);
      const actual = polrPredict(fit, {
        newdata: data,
        rowNames,
        ...(call.args.type === undefined ? {} : { type: call.args.type }),
      });
      if (call.args.type === "probs") {
        if (Array.isArray(actual)) throw new Error("expected a probability matrix");
        const expected = call.result.value as { rows: string[]; cols: string[]; values: unknown[][] };
        expect(actual.rows).toEqual(expected.rows);
        expect(actual.columns).toEqual(expected.cols);
        expect(actual.values).toHaveLength(expected.values.length);
        for (let i = 0; i < expected.values.length; i++) {
          expect(actual.values[i]).toHaveLength(expected.values[i]!.length);
          for (let j = 0; j < expected.values[i]!.length; j++) {
            const target = numeric(expected.values[i]![j]);
            closeAbsolute(actual.values[i]![j]!, target, 1e-12 * Math.max(1, Math.abs(target)),
              `${fixtureCase.id} predict probs [${i},${j}]`);
          }
        }
      } else {
        expect(actual).toEqual(call.result.value);
      }
    });
  }

  const unknownCalls = fixture.cases.flatMap((fixtureCase) =>
    (fixtureCase.calls ?? [])
      .filter((call) => call.operation === "predict-unknown-level")
      .map((call) => ({ fixtureCase, call })),
  );
  for (const { fixtureCase, call } of unknownCalls) {
    it(`${fixtureCase.id} rejects a new factor level`, () => {
      if (call.args?.newdata === undefined || call.result.error === undefined) {
        throw new Error("invalid unknown-level fixture");
      }
      const { fit } = fitCase(fixtureCase.id);
      const { data, rowNames } = prepareNewData(call.args.newdata);
      expect(() => polrPredict(fit, {
        newdata: data,
        rowNames,
        ...(call.args.type === undefined ? {} : { type: call.args.type }),
      })).toThrow(call.result.error);
    });
  }
});

describe("polrPredict: missing rows", () => {
  it("keeps missing observations as null rows in both prediction types", () => {
    const { fit } = fitCase("housing-logistic");
    const newdata: DataFrame = {
      Infl: ["Low", null, "High"],
      Type: ["Tower", "Tower", "Terrace"],
      Cont: ["Low", "Low", "High"],
    };
    const rowNames = ["first", "missing", "last"];
    const classes = polrPredict(fit, { newdata, rowNames, type: "class" });
    expect(classes).toEqual(["Low", null, "High"]);
    const probs = polrPredict(fit, { newdata, rowNames, type: "probs" });
    if (Array.isArray(probs)) throw new Error("expected a probability matrix");
    expect(probs.rows).toEqual(rowNames);
    expect(probs.columns).toEqual(["Low", "Medium", "High"]);
    expect(probs.values[1]).toBeNull();
    expect(probs.values[0]).not.toBeNull();
    expect(probs.values[2]).not.toBeNull();
  });
});
