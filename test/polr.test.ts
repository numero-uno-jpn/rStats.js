import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  __polrDerivativesForTest,
  polr,
  polrPredict,
  polrConfint,
  polrSummary,
  polrVcov,
  type PolrMethod,
  type PolrOptions,
  type PolrResult,
} from "../src/models/polr.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { design } from "../src/models/modelMatrix.js";
import { optim } from "../src/optim/optim.js";
import { chol, chol2inv } from "../src/linalg/chol.js";
import { qnorm } from "../src/distributions/normal.js";

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

/** Independent constrained refit: fix one slope, optimise every other slope and all cut-points. */
function independentProfileNll(fit: PolrResult, fixedIndex: number, fixedValue: number): number {
  const model = fit.model;
  const fullStart = Array.from(model.theta);
  fullStart[fixedIndex] = fixedValue;
  const free = fullStart.map((_, i) => i).filter((i) => i !== fixedIndex);
  const full = (point: number[]): number[] => {
    const theta = Array.from(fullStart);
    free.forEach((index, j) => { theta[index] = point[j]!; });
    return theta;
  };
  const evaluate = (point: number[]) => {
    const d = __polrDerivativesForTest(
      model.x, model.y, model.weights, model.offset, model.responseLevels.length, model.method, full(point),
    );
    return {
      value: d.value,
      gradient: free.map((i) => d.gradient[i]!),
      hessian: free.map((i) => free.map((j) => d.hessian[i]![j]!)),
    };
  };
  const start = free.map((i) => fullStart[i]!);
  const first = optim(start, (point) => evaluate(point).value, {
    method: "BFGS",
    gr: (point) => evaluate(point).gradient,
    control: { maxit: 2000, reltol: 1e-14 },
  });
  let point = first.par;
  let current = evaluate(point);
  for (let iteration = 0; iteration < 30; iteration++) {
    const score = Math.max(0, ...current.gradient.map(Math.abs));
    if (score <= 1e-10 * Math.max(1, fit.nobs)) break;
    let inverse: number[][];
    try {
      inverse = chol2inv(chol(current.hessian));
    } catch {
      break;
    }
    const direction = inverse.map((row) => -row.reduce((sum, value, j) => sum + value * current.gradient[j]!, 0));
    const slope = direction.reduce((sum, value, j) => sum + value * current.gradient[j]!, 0);
    if (!(slope < 0)) break;
    let step = 1;
    let accepted = false;
    for (let backtrack = 0; backtrack < 50; backtrack++, step *= 0.5) {
      const candidate = point.map((value, j) => value + step * direction[j]!);
      const trial = evaluate(candidate);
      if (Number.isFinite(trial.value) && trial.value <= current.value + 1e-4 * step * slope) {
        point = candidate;
        current = trial;
        accepted = true;
        break;
      }
    }
    if (!accepted) break;
  }
  return current.value;
}

function independentProfileEndpoint(fit: PolrResult, parameterIndex: number, target: number): number {
  const estimate = Object.values(fit.coefficients)[parameterIndex]!;
  const covariance = polrVcov(fit).values;
  const se = Math.sqrt(covariance[parameterIndex]![parameterIndex]!);
  const centre = -fit.logLik;
  const root = (value: number): number => {
    const deviance = Math.max(0, 2 * (independentProfileNll(fit, parameterIndex, value) - centre));
    return Math.sign(value - estimate) * Math.sqrt(deviance);
  };
  let inside = estimate;
  let outside = estimate + Math.sign(target) * Math.max(se, 1e-6);
  let value = root(outside);
  for (let i = 0; i < 60 && !(Number.isFinite(value) && (target < 0 ? value <= target : value >= target)); i++) {
    outside = estimate + 2 * (outside - estimate);
    value = root(outside);
  }
  if (!Number.isFinite(value) || (target < 0 ? value > target : value < target)) return NaN;
  let low = Math.min(inside, outside);
  let high = Math.max(inside, outside);
  for (let i = 0; i < 100; i++) {
    const mid = low + (high - low) / 2;
    if (mid === low || mid === high) return mid;
    const r = root(mid);
    if (!Number.isFinite(r)) return NaN;
    if (target < 0 ? r > target : r < target) {
      if (target < 0) high = mid;
      else low = mid;
    } else {
      if (target < 0) low = mid;
      else high = mid;
    }
    if (high - low <= 2e-12 * Math.max(1, Math.abs(mid))) return low + (high - low) / 2;
  }
  return low + (high - low) / 2;
}

describe("polrConfint: all profile and Wald fixtures", () => {
  for (const { fixtureCase, call, index } of confidenceCalls) {
    it(`${fixtureCase.id} ${call.operation} #${index + 1} matches every fixture cell`, () => {
      const expected = call.result.value as ConfidenceFixtureValue;
      const level = call.args?.level === undefined ? 0.95 : numeric(call.args.level);
      const method = call.operation === "wald-ci" ? "wald" : "profile";
      const parm = call.args?.parm;
      const { fit } = fitCase(fixtureCase.id);
      const actual = polrConfint(fit, {
        method,
        level,
        ...(parm === undefined ? {} : { parm }),
      });
      if (fixtureCase.id === "mtcars-cauchit") {
        // choices 12: MASS's cauchit fit is not the standard Cauchy cumulative-link model.
        // Its profile and Wald values are deliberately not used as references.
        if (method === "wald") return;
        const z = qnorm(1 - (1 - level) / 2) as number;
        for (let i = 0; i < actual.rows.length; i++) {
          const lower = independentProfileEndpoint(fit, Object.keys(fit.coefficients).indexOf(actual.rows[i]!), -z);
          const upper = independentProfileEndpoint(fit, Object.keys(fit.coefficients).indexOf(actual.rows[i]!), z);
          closeAbsolute(actual.values[i]![0]!, lower, 2e-9, `choices 12 cauchit independent lower ${actual.rows[i]}`);
          closeAbsolute(actual.values[i]![1]!, upper, 2e-9, `choices 12 cauchit independent upper ${actual.rows[i]}`);
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
            const independent = independentProfileEndpoint(fit, parameterIndex, j === 0 ? -z : z);
            // The independent constrained refit and bisection define the target to near machine precision.
            closeAbsolute(actualValue, independent, 2e-9, `${fixtureCase.id} independent profile root ${actual.rows[i]} [${j}]`);
            // MASS's profile search stops/interpolates on its own finite profile trace; this 1e-3 allowance
            // covers that endpoint-location resolution and the small displacement of its default fit.
            closeAbsolute(actualValue, target, 1e-3, `${fixtureCase.id} R profile endpoint ${actual.rows[i]} [${j}]`);
          } else {
            // MASS's covariance uses a numerical Hessian; the analytic observed information differs slightly.
            closeAbsolute(actualValue, target, 2e-5, `${fixtureCase.id} R Wald endpoint ${actual.rows[i]} [${j}]`);
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
