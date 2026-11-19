import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  __polrDerivativesForTest,
  polr,
  polrPredict,
  polrConfint,
  polrAnova,
  polrSummary,
  polrVcov,
  type PolrMethod,
  type PolrOptions,
  type PolrResult,
} from "../src/models/polr.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { design } from "../src/models/modelMatrix.js";
import { qnorm } from "../src/distributions/normal.js";
import { pchisq } from "../src/distributions/chisq.js";

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
  args?: { newdata?: RawNewData; type?: "class" | "probs"; level?: string; parm?: string | number };
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

function fitCase(id: string): { fixtureCase: FixtureCase; fit: PolrResult; expected: PublicFit; tight: PublicFit; data: DataFrame } {
  const fixtureCase = fixture.cases.find((item) => item.id === id);
  const main = fixtureCase?.fits.main;
  if (fixtureCase === undefined || main?.fitPublic === undefined || main.fitTight?.fitPublic === undefined) {
    throw new Error(`missing successful fixture fit: ${id}`);
  }
  const { data, options } = prepareFit(main.fit);
  const fit = polr(main.fit.formula, data, options);
  return { fixtureCase, fit, expected: main.fitPublic, tight: main.fitTight.fitPublic, data };
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


/**
 * Bound the probability displacement caused by the measured difference between the actual, R-default and tight
 * coefficient vectors. Every supported link density is at most 0.4; a category probability is a difference of at
 * most two CDF values, so the bound is 0.8 times the sum of the absolute changes in both cut and linear predictor.
 */
function predictionStoppingTolerance(
  fit: PolrResult, expected: PublicFit, tight: PublicFit, data: DataFrame, row: number,
): number {
  const designOptions: Parameters<typeof design>[2] = {
    levels: fit.model.factorLevels,
    contrasts: fit.model.contrasts,
  };
  if (fit.model.offsetColumn !== undefined) designOptions.extraVariables = [fit.model.offsetColumn];
  const d = design({ response: undefined, rhs: fit.model.rhs }, data, designOptions);
  const used = d.frame.rows.indexOf(row);
  if (used < 0) return 1e-12;
  const first = d.terms.intercept ? 1 : 0;
  const x = d.x[used]!.slice(first);
  const betaDisplacement = fit.model.columnNames.map((name) =>
    Math.abs(fit.coefficients[name]! - numeric(tight.coefficients[name]))
    + Math.abs(numeric(expected.coefficients[name]) - numeric(tight.coefficients[name])),
  );
  const etaDisplacement = x.reduce((sum, value, j) => sum + Math.abs(value) * betaDisplacement[j]!, 0);
  const cutDisplacement = Object.keys(tight.zeta).reduce((largest, name) => Math.max(
    largest,
    Math.abs(fit.zeta[name]! - numeric(tight.zeta[name]))
      + Math.abs(numeric(expected.zeta[name]) - numeric(tight.zeta[name])),
  ), 0);
  return 0.8 * (etaDisplacement + cutDisplacement) + 1e-12;
}

function tightPredictionTolerance(
  fit: PolrResult, tight: PublicFit, data: DataFrame, row: number,
): number {
  const designOptions: Parameters<typeof design>[2] = {
    levels: fit.model.factorLevels,
    contrasts: fit.model.contrasts,
  };
  if (fit.model.offsetColumn !== undefined) designOptions.extraVariables = [fit.model.offsetColumn];
  const d = design({ response: undefined, rhs: fit.model.rhs }, data, designOptions);
  const used = d.frame.rows.indexOf(row);
  if (used < 0) return 1e-12;
  const first = d.terms.intercept ? 1 : 0;
  const x = d.x[used]!.slice(first);
  const betaDisplacement = fit.model.columnNames.reduce((sum, name, j) =>
    sum + Math.abs(fit.coefficients[name]! - numeric(tight.coefficients[name])) * Math.abs(x[j]!), 0,
  );
  const cutDisplacement = Object.keys(tight.zeta).reduce((largest, name) => Math.max(
    largest, Math.abs(fit.zeta[name]! - numeric(tight.zeta[name])),
  ), 0);
  return 0.8 * (betaDisplacement + cutDisplacement) + 1e-12;
}

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
    it(`${fixtureCase.id === "mtcars-offset" ? "choices 13: mtcars-offset" : fixtureCase.id} predict #${index + 1} (${call.args?.type ?? "class"})`, () => {
      const args = call.args;
      if (args === undefined || args.newdata === undefined) throw new Error("fixture prediction has no newdata");
      const { fit, expected, tight } = fitCase(fixtureCase.id);
      const { data, rowNames } = prepareNewData(args.newdata);
      const actual = polrPredict(fit, {
        newdata: data,
        rowNames,
        ...(args.type === undefined ? {} : { type: args.type }),
      });
      if (args.type === "probs") {
        if (Array.isArray(actual)) throw new Error("expected a probability matrix");
        const expectedPrediction = call.result.value as { rows: string[]; cols: string[]; values: unknown[][] };
        if (fixtureCase.id === "mtcars-offset") {
          const wt = data.wt;
          const off = data.off;
          if (wt === undefined || off === undefined) throw new Error("mtcars-offset prediction data is incomplete");
          const tightBeta = numeric(tight.coefficients.wt);
          const cut1 = numeric(tight.zeta["3|4"]);
          const cut2 = numeric(tight.zeta["4|5"]);
          const logistic = (value: number): number => 1 / (1 + Math.exp(-value));
          const offsetValues = Array.from(off);
          const manual = Array.from(wt, (value, i) => {
            const eta = tightBeta * Number(value) + Number(offsetValues[i]);
            const lower = logistic(cut1 - eta);
            const upper = logistic(cut2 - eta);
            return [lower, upper - lower, 1 - upper];
          });
          expect(actual.rows).toEqual(["1", "2"]);
          expect(actual.columns).toEqual(["3", "4", "5"]);
          for (let i = 0; i < manual.length; i++) {
            for (let j = 0; j < 3; j++) {
              const actualValue = actual.values[i]?.[j];
              if (actualValue === null || actualValue === undefined) throw new Error(`missing rStats probability [${i},${j}]`);
              closeAbsolute(actualValue, manual[i]![j]!,
                tightPredictionTolerance(fit, tight, data, i), `choices 13: mtcars-offset hand probability [${i},${j}]`);
            }
          }

          const zeroOffsetData: DataFrame = { ...data, off: Array.from(off, () => 0) };
          const zeroOffset = polrPredict(fit, { newdata: zeroOffsetData, rowNames, type: "probs" });
          if (Array.isArray(zeroOffset)) throw new Error("expected zero-offset probability matrix");
          expect(zeroOffset.rows).toEqual(expectedPrediction.rows);
          expect(zeroOffset.columns).toEqual(expectedPrediction.cols);
          for (let i = 0; i < expectedPrediction.values.length; i++) {
            for (let j = 0; j < expectedPrediction.values[i]!.length; j++) {
              const actualValue = zeroOffset.values[i]?.[j];
              if (actualValue === null || actualValue === undefined) throw new Error(`missing zero-offset probability [${i},${j}]`);
              closeAbsolute(actualValue, expectedPrediction.values[i]![j]!,
                predictionStoppingTolerance(fit, expected, tight, zeroOffsetData, i),
                `choices 13: mtcars-offset zero offset vs R fixture [${i},${j}]`);
            }
          }
          return;
        }
        expect(actual.rows).toEqual(expectedPrediction.rows);
        expect(actual.columns).toEqual(expectedPrediction.cols);
        expect(actual.values).toHaveLength(expectedPrediction.values.length);
        for (let i = 0; i < expectedPrediction.values.length; i++) {
          const actualRow = actual.values[i];
          if (actualRow === null || actualRow === undefined) throw new Error(`unexpected missing prediction row ${i}`);
          expect(actualRow).toHaveLength(expectedPrediction.values[i]!.length);
          for (let j = 0; j < expectedPrediction.values[i]!.length; j++) {
            const target = numeric(expectedPrediction.values[i]![j]);
            const actualValue = actualRow[j];
            if (actualValue === null || actualValue === undefined) throw new Error(`unexpected missing probability [${i},${j}]`);
            closeAbsolute(actualValue, target, predictionStoppingTolerance(fit, expected, tight, data, i),
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
      const args = call.args;
      if (args === undefined || args.newdata === undefined || call.result.error === undefined) {
        throw new Error("invalid unknown-level fixture");
      }
      const { fit } = fitCase(fixtureCase.id);
      const { data, rowNames } = prepareNewData(args.newdata);
      expect(() => polrPredict(fit, {
        newdata: data,
        rowNames,
        ...(args.type === undefined ? {} : { type: args.type }),
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
    expect(polrPredict(fit, { newdata, rowNames })).toEqual(classes);
    const probs = polrPredict(fit, { newdata, rowNames, type: "probs" });
    if (Array.isArray(probs)) throw new Error("expected a probability matrix");
    expect(probs.rows).toEqual(rowNames);
    expect(probs.columns).toEqual(["Low", "Medium", "High"]);
    expect(probs.values[1]).toEqual([null, null, null]);
    expect(probs.values[0]).not.toBeNull();
    expect(probs.values[2]).not.toBeNull();
  });
});


type ConfidenceFixtureValue = { rows: string[] | null; cols: string[]; values: unknown[][] };
type ConfidenceCall = { fixtureCase: FixtureCase; call: FixtureCall; index: number };

const confidenceCalls: ConfidenceCall[] = fixture.cases.flatMap((fixtureCase) =>
  (fixtureCase.calls ?? [])
    .filter((call) => call.operation === "profile-ci" || call.operation === "wald-ci")
    .map((call, index) => ({ fixtureCase, call, index })),
);

type ExpandedPolrData = { data: DataFrame; formula: string; columns: string[] };

/** Expand factor predictors to treatment-coded numeric columns, preserving fitted row order. */
function expandPolrFactors(fit: PolrResult, data: DataFrame): ExpandedPolrData {
  const model = fit.model;
  const expanded: DataFrame = {};
  for (const [name, column] of Object.entries(data)) {
    expanded[name] = model.rows.map((row) => column[row] ?? null);
  }
  const columns: string[] = [];
  for (const predictor of model.predictorVariables) {
    const levels = model.factorLevels[predictor];
    const source = data[predictor];
    if (source === undefined) throw new Error(`missing predictor column: ${predictor}`);
    if (levels === undefined) {
      columns.push(predictor);
      continue;
    }
    for (const level of levels.slice(1)) {
      const name = predictor + level;
      columns.push(name);
      expanded[name] = model.rows.map((row) => String(source[row]) === level ? 1 : 0);
    }
  }
  if (columns.length !== model.columnNames.length
    || columns.some((name, index) => name !== model.columnNames[index])) {
    throw new Error(`expanded treatment columns do not match fitted coefficients: ${columns.join(", ")}`);
  }
  return {
    data: expanded,
    formula: `${model.response} ~ ${columns.length === 0 ? "1" : columns.join(" + ")}`,
    columns,
  };
}

const expandedPolrVerified = new WeakSet<PolrResult>();

/** Independently refit the numeric reduced model with the fixed slope represented as an offset. */
function independentProfileAt(
  fit: PolrResult, data: DataFrame, fixedIndex: number, fixedValue: number,
): number {
  const model = fit.model;
  const expanded = expandPolrFactors(fit, data);
  const options: PolrOptions = {
    method: model.method,
    weights: model.weights,
    levels: { [model.response]: model.responseLevels },
  };
  if (!expandedPolrVerified.has(fit)) {
    const full = polr(expanded.formula, expanded.data, options);
    closeAbsolute(full.deviance, fit.deviance, 1e-8 * Math.max(1, fit.nobs),
      `${model.formula} factor expansion preserves deviance`);
    expandedPolrVerified.add(fit);
  }
  const fixedTerm = expanded.columns[fixedIndex];
  if (fixedTerm === undefined) throw new Error(`missing expanded coefficient column: ${fixedIndex}`);
  const rawColumn = expanded.data[fixedTerm];
  if (rawColumn === undefined) throw new Error(`missing expanded predictor column: ${fixedTerm}`);
  const offset = rawColumn.map((value) => fixedValue * Number(value));
  const remaining = expanded.columns.filter((_, index) => index !== fixedIndex);
  const formula = `${model.response} ~ ${remaining.length === 0 ? "1" : remaining.join(" + ")}`;
  const reduced = polr(formula, expanded.data, {
    method: model.method,
    weights: model.weights,
    offset,
    levels: { [model.response]: model.responseLevels },
  });
  return reduced.deviance;
}

function expectProfileRoot(
  fit: PolrResult, data: DataFrame, parameterIndex: number, endpoint: number, target: number, label: string,
): void {
  const estimate = Object.values(fit.coefficients)[parameterIndex]!;
  const constrainedDeviance = independentProfileAt(fit, data, parameterIndex, endpoint);
  const signedRoot = Math.sign(endpoint - estimate) * Math.sqrt(Math.max(0, constrainedDeviance - fit.deviance));
  closeAbsolute(signedRoot, target, 1e-8, label);
}

describe("polrConfint: all profile and Wald fixtures", () => {
  for (const { fixtureCase, call, index } of confidenceCalls) {
    it(`${fixtureCase.id} ${call.operation} #${index + 1} matches every fixture cell`, () => {
      const expected = call.result.value as ConfidenceFixtureValue;
      const level = call.args?.level === undefined ? 0.95 : numeric(call.args.level);
      const method = call.operation === "wald-ci" ? "wald" : "profile";
      const parm = call.args?.parm;
      const { fit, expected: defaultFit, tight, data } = fitCase(fixtureCase.id);
      const actual = polrConfint(fit, {
        method,
        level,
        ...(parm === undefined ? {} : { parm }),
      });
      if (fixtureCase.id === "mtcars-cauchit") {
        // choices 12: MASS's cauchit fit is not the standard Cauchy cumulative-link model.
        // Neither profile nor Wald values from MASS are references for this model.
        const z = qnorm(1 - (1 - level) / 2) as number;
        const names = Object.keys(fit.coefficients);
        const covariance = polrVcov(fit).values;
        for (let i = 0; i < actual.rows.length; i++) {
          const parameterIndex = names.indexOf(actual.rows[i]!);
          if (method === "wald") {
            const estimate = Object.values(fit.coefficients)[parameterIndex]!;
            const se = Math.sqrt(covariance[parameterIndex]![parameterIndex]!);
            closeAbsolute(actual.values[i]![0]!, estimate - z * se, 1e-12, `choices 12 cauchit independent Wald lower ${actual.rows[i]}`);
            closeAbsolute(actual.values[i]![1]!, estimate + z * se, 1e-12, `choices 12 cauchit independent Wald upper ${actual.rows[i]}`);
          } else {
            expectProfileRoot(fit, data, parameterIndex, actual.values[i]![0]!, -z, `choices 12 cauchit lower root ${actual.rows[i]}`);
            expectProfileRoot(fit, data, parameterIndex, actual.values[i]![1]!, z, `choices 12 cauchit upper root ${actual.rows[i]}`);
          }
        }
        return;
      }
      expect(actual.rows).toEqual(expected.rows ?? []);
      expect(actual.columns).toEqual(expected.cols);
      expect(actual.values).toHaveLength(expected.values.length);
      const z = qnorm(1 - (1 - level) / 2) as number;
      for (let i = 0; i < expected.values.length; i++) {
        expect(actual.values[i]).toHaveLength(expected.values[i]!.length);
        for (let j = 0; j < expected.values[i]!.length; j++) {
          const target = numeric(expected.values[i]![j]);
          const actualValue = actual.values[i]![j]!;
          if (method === "profile") {
            const parameterIndex = Object.keys(fit.coefficients).indexOf(actual.rows[i]!);
            // A single independent constrained refit at the returned endpoint must reproduce the signed-root target.
            expectProfileRoot(fit, data, parameterIndex, actualValue, j === 0 ? -z : z,
              `${fixtureCase.id} independent profile root ${actual.rows[i]} [${j}]`);
            // MASS's profile search stops/interpolates on its own finite profile trace; this 1e-3 allowance
            // covers that endpoint-location resolution and the small displacement of its default fit.
            closeAbsolute(actualValue, target, 1e-3, `${fixtureCase.id} R profile endpoint ${actual.rows[i]} [${j}]`);
          } else {
            const rowName = actual.rows[i]!;
            const tightRow = tight.summary.rows.indexOf(rowName);
            const valueColumn = tight.summary.cols.indexOf("Value");
            const seColumn = tight.summary.cols.indexOf("Std. Error");
            const tightEstimate = numeric(tight.summary.values[tightRow]![valueColumn]);
            const tightSe = numeric(tight.summary.values[tightRow]![seColumn]);
            const tightEndpoint = tightEstimate + (j === 0 ? -1 : 1) * z * tightSe;
            // The largest observed difference between analytic and R's numerical-Hessian SEs is 1.2e-5.
            // Scale that bound by this interval's z; the tight-fit coefficient itself is compared at 1e-8.
            const seTolerance = z * 1.2e-5 + 1e-8;
            closeAbsolute(actualValue, tightEndpoint, seTolerance,
              `${fixtureCase.id} fitTight Wald endpoint ${rowName} [${j}]`);

            const defaultRow = defaultFit.summary.rows.indexOf(rowName);
            const defaultEstimate = numeric(defaultFit.summary.values[defaultRow]![valueColumn]);
            const defaultSe = numeric(defaultFit.summary.values[defaultRow]![seColumn]);
            const defaultEndpoint = defaultEstimate + (j === 0 ? -1 : 1) * z * defaultSe;
            // R's default stopping error is case-specific: allow exactly the endpoint displacement
            // between its default fit and fitTight, plus the numerical-Hessian SE allowance above.
            const defaultFitAllowance = Math.abs(defaultEndpoint - tightEndpoint) + seTolerance;
            closeAbsolute(actualValue, defaultEndpoint, defaultFitAllowance,
              `${fixtureCase.id} R default Wald endpoint ${rowName} [${j}]`);
          }
        }
      }
    });
  }
});

describe("polrConfint: parameter selection and empty slope sets", () => {
  it("accepts slope names and 1-based positions", () => {
    const { fit } = fitCase("housing-logistic");
    const byName = polrConfint(fit, { method: "wald", parm: "InflMedium" });
    const byPosition = polrConfint(fit, { method: "wald", parm: 1 });
    expect(byName.rows).toEqual(["InflMedium"]);
    expect(byName.values).toEqual(byPosition.values);
  });

  it("returns an empty table for an intercept-only fit", () => {
    const { fit } = fitCase("mtcars-intercept-only");
    const result = polrConfint(fit, { level: 0.9 });
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual(["5 %", "95 %"]);
    expect(result.values).toEqual([]);
  });

  it("rejects cut-points and invalid confidence levels", () => {
    const { fit } = fitCase("housing-logistic");
    expect(() => polrConfint(fit, { parm: "Low|Medium" })).toThrow("unknown slope parameter");
    expect(() => polrConfint(fit, { level: 1 })).toThrow("'level' must be between 0 and 1");
  });
});


type AnovaFixtureFit = {
  fit: FitSpec;
  fitPublic: PublicFit;
  fitTight: { fitPublic: PublicFit };
};

describe("polrAnova: nested housing models", () => {
  it("matches every row and column of the sequential likelihood-ratio table", () => {
    const fixtureCase = fixture.cases.find((item) => item.id === "housing-nested-anova");
    if (fixtureCase === undefined || fixtureCase.calls?.[0]?.result.value === undefined) {
      throw new Error("missing housing nested-anova fixture");
    }
    const fitSpecs = fixtureCase.fits as unknown as Record<string, AnovaFixtureFit>;
    const ids = ["infl", "full", "interaction"];
    const fitted = ids.map((id) => {
      const item = fitSpecs[id];
      if (item?.fitPublic === undefined || item.fitTight?.fitPublic === undefined) {
        throw new Error(`missing ANOVA fit fixture: ${id}`);
      }
      const { data, options } = prepareFit(item.fit);
      return { fit: polr(item.fit.formula, data, options), expected: item.fitPublic, tight: item.fitTight.fitPublic };
    });
    const actual = polrAnova(...fitted.map((item) => item.fit));
    const expected = (fixtureCase.calls[0]!.result.value as {
      table: Record<string, unknown[]>;
      rows: string[];
      heading: string[];
    });
    const table = expected.table;
    expect(actual.rows).toEqual(expected.rows);
    expect(actual.heading).toEqual(expected.heading);

    const columns = ["Model", "Resid. df", "Resid. Dev", "Test", "   Df", "LR stat.", "Pr(Chi)"] as const;
    for (const column of columns) {
      const values = actual.table[column];
      const targets = table[column];
      if (!Array.isArray(targets)) throw new Error(`missing fixture ANOVA column: ${column}`);
      expect(values).toHaveLength(targets.length);
      for (let row = 0; row < targets.length; row++) {
        const target = targets[row];
        if (column === "Model" || column === "Test") {
          expect(values[row]).toBe(target);
        } else if (target === "NA") {
          expect(values[row]).toBe("NA");
        } else if (column === "Resid. df" || column === "   Df") {
          expect(values[row]).toBe(numeric(target));
        } else if (column === "Resid. Dev") {
          const defaultValue = numeric(fitted[row]!.expected.deviance);
          const tightValue = numeric(fitted[row]!.tight.deviance);
          // R's default optimizer stops slightly before fitTight; use that measured deviance displacement,
          // plus 1e-7 for the independent rStats.js fit's numerical remainder.
          closeAbsolute(values[row] as number, target, Math.abs(defaultValue - tightValue) + 1e-7,
            `housing ANOVA ${column} row ${row + 1}`);
        } else if (column === "LR stat.") {
          if (row === 0) {
            expect(values[row]).toBe("NA");
          } else {
            const defaultStatistic = numeric(fitted[row - 1]!.expected.deviance)
              - numeric(fitted[row]!.expected.deviance);
            const tightStatistic = numeric(fitted[row - 1]!.tight.deviance)
              - numeric(fitted[row]!.tight.deviance);
            // The LR tolerance is the sum of the two models' measured default-to-tight deviance displacements.
            closeAbsolute(values[row] as number, target,
              Math.abs(defaultStatistic - tightStatistic) + 1e-7,
              `housing ANOVA ${column} row ${row + 1}`);
          }
        } else {
          if (row === 0) {
            expect(values[row]).toBe("NA");
          } else {
            const df = numeric(table["   Df"]![row]);
            const tightStatistic = numeric(fitted[row - 1]!.tight.deviance)
              - numeric(fitted[row]!.tight.deviance);
            const defaultP = numeric(target);
            const tightP = pchisq(tightStatistic, df, { lowerTail: false }) as number;
            // Propagate the observed default-vs-tight LR displacement through the chi-square tail probability.
            closeAbsolute(values[row] as number, target, Math.abs(defaultP - tightP) + 1e-12,
              `housing ANOVA ${column} row ${row + 1}`);
          }
        }
      }
    }
  });
});

describe("polrAnova: model validation and user choices", () => {
  it("rejects non-nested models (choice 8)", () => {
    const { fit: smaller, data, fixtureCase } = fitCase("housing-logistic");
    const source = fixtureCase.fits.main;
    if (source === undefined) throw new Error("missing housing fit specification");
    const { options } = prepareFit(source.fit);
    const differentPredictor = polr("Sat ~ Type", data, options);
    expect(() => polrAnova(smaller, differentPredictor)).toThrow("models are not nested");
  });

  it("rejects fits with different analysis rows", () => {
    const { fit, data, fixtureCase } = fitCase("housing-logistic");
    const source = fixtureCase.fits.main;
    if (source === undefined) throw new Error("missing housing fit specification");
    const { options } = prepareFit(source.fit);
    const shortened: DataFrame = Object.fromEntries(
      Object.entries(data).map(([name, values]) => [name, Array.from(values).slice(0, 71)]),
    );
    const other = polr(source.fit.formula, shortened, options);
    expect(() => polrAnova(fit, other)).toThrow("models were not all fitted to the same size of dataset");
  });

  it("rejects a single fit as R does", () => {
    const { fit } = fitCase("housing-logistic");
    expect(() => polrAnova(fit)).toThrow('anova is not implemented for a single "polr" object');
  });

  it("rejects a declared response level with no observations (choice 1)", () => {
    const data: DataFrame = {
      rating: ["low", "medium", "high", "low", "medium", "high"],
      dose: [0, 1, 2, 0, 1, 2],
    };
    expect(() => polr("rating ~ dose", data, {
      levels: { rating: ["low", "medium", "high", "unused"] },
    })).toThrow("response level 'unused' has no positive-weight observations");
  });
});
