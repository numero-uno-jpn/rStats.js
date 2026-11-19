import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  psiBisquare, psiHampel, psiHuber, rlm, rlmSummary, rlmVcov,
  type RlmOptions,
} from "../src/entries/regression.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { pnorm } from "../src/distributions/normal.js";
import { num } from "./helpers/fixture.js";

interface FitPublic {
  coefficients: Record<string, string | number>;
  s: number | string;
  stddev: number | string;
  summary: { rows: string[]; cols: string[]; values: (string | number)[][] };
  "cov.unscaled": { rows: string[]; cols: string[]; values: (string | number)[][] };
  vcov: { rows: string[]; cols: string[]; values: (string | number)[][] };
}
interface FitRecord {
  fit: Record<string, unknown>;
  fitResult: { error?: string; warnings: string[] };
  fitPublic?: FitPublic;
  fitTight?: { fit: Record<string, unknown>; fitPublic?: FitPublic; fitResult: { error?: string; warnings: string[] } };
}
interface RobustReference {
  reference: { crit: number | string; scale?: number | string };
}
interface ExactReference {
  kind: "S" | "lts";
  reference: { crit?: number | string; scale?: number | string; coefficients?: Record<string, string | number> };
}
interface RlmCase {
  id: string;
  fits: { main: FitRecord };
  ltsReferences?: RobustReference[];
  sReferences?: RobustReference[];
  exactReferences?: ExactReference[];
}
interface Fixture {
  cases: RlmCase[];
}
interface PsiGrid {
  u: number[];
  psiHuber: { w: number[]; d: boolean[] };
  psiHampel: { w: number[]; d: number[] };
  psiBisquare: { w: number[]; d: number[] };
}
interface Experiment {
  psi_grid: PsiGrid;
}

const path = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const fixture = JSON.parse(readFileSync(path("test/fixtures/rlm.json"), "utf8")) as Fixture;
const experiment = JSON.parse(readFileSync(path("experiments/regression-rlm.json"), "utf8")) as Experiment;

function numericData(raw: Record<string, unknown>): DataFrame {
  const out: Record<string, readonly (number | string | boolean | null)[]> = {};
  for (const [name, values] of Object.entries(raw)) {
    if (!Array.isArray(values)) throw new TypeError(`invalid column ${name}`);
    out[name] = values.map((v) => {
      if (typeof v !== "string") return v as number | string | boolean | null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    });
  }
  return out;
}

function optionsFrom(raw: Record<string, unknown>): RlmOptions {
  const options: RlmOptions = {};
  const psi = raw.psi;
  if (psi === "psi.hampel") options.psi = "hampel";
  else if (psi === "psi.bisquare") options.psi = "bisquare";
  else if (psi === "psi.huber") options.psi = "huber";
  if (typeof raw.init === "string") options.init = raw.init as "ls" | "lts";
  else if (Array.isArray(raw.init)) options.init = raw.init.map((v) => num(v as string | number));
  if (Array.isArray(raw.weights)) options.weights = raw.weights.map((v) => num(v as string | number));
  if (raw["wt.method"] === "inv" || raw["wt.method"] === "case") options.wtMethod = raw["wt.method"];
  if (raw["scale.est"] === "MAD" || raw["scale.est"] === "Huber" || raw["scale.est"] === "proposal 2") options.scaleEst = raw["scale.est"];
  if (raw.method === "M" || raw.method === "MM") options.method = raw.method;
  for (const key of ["k", "a", "b", "c", "k2", "maxit", "acc"] as const) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number") options[key] = num(value);
  }
  return options;
}

function fitFrom(raw: Record<string, unknown>) {
  const formulaValue = raw.formula;
  const data = raw.data;
  if (typeof formulaValue !== "string" || typeof data !== "object" || data === null) throw new TypeError("invalid fit arguments");
  let formula: string = formulaValue;
  const record = data as Record<string, unknown>;
  const columns = (record.columns !== undefined ? record.columns : record) as Record<string, unknown>;
  const normalized = numericData(columns);
  // The model-matrix API treats string columns as categorical predictors. The oracle's
  // factor(cyl) is represented by the equivalent string column and bare variable.
  if (formula.includes("factor(cyl)")) {
    formula = formula.replaceAll("factor(cyl)", "cyl");
    const cyl = normalized.cyl;
    if (Array.isArray(cyl)) normalized.cyl = cyl.map(String);
  }
  return rlm(formula, normalized, optionsFrom(raw));
}

function vector(value: number | boolean | (number | boolean)[]): number[] {
  return (Array.isArray(value) ? value : [value]).map(Number);
}

function numericMatrix(actual: number[][], expected: (string | number)[][], label: string, tolerance: number, tight?: (string | number)[][]): void {
  expect(actual.length, label + " rows").toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]?.length, label + " columns " + i).toBe(expected[i]?.length);
    for (let j = 0; j < expected[i]!.length; j++) {
      const e = num(expected[i]![j]!);
      const a = actual[i]![j]!;
      // The default-stop comparisons use 3e-3 only because the observed R default-vs-fitTight scale
      // difference reaches 0.25% (phones Huber). Tight refits are checked separately at 1e-8;
      // cov.unscaled is checked at 1e-10 because it does not depend on the iterative scale estimate.
      const scale = Math.max(Math.abs(e), 1e-300);
      const allowance = tight === undefined ? tolerance : Math.max(tolerance, Math.abs(e - num(tight[i]![j]!)) / scale + 1e-8);
      expect(Math.abs(a - e) / scale, `${label}[${i},${j}]`).toBeLessThanOrEqual(allowance);
    }
  }
}

function tightReferenceIsStationary(args: Record<string, unknown>, expected: FitPublic): boolean {
  // fitFrom supplies only the design matrix and effective observation-weight conventions.
  // The candidate coefficients and scale below are the independently recorded R public values.
  const designFit = fitFrom(args);
  const model = designFit.model;
  const scale = num(expected.s);
  if (!(scale > 0) || !Number.isFinite(scale)) return false;
  const rename = (name: string) => name.replace(/^factor\(cyl\)([0-9]+)$/, "cyl$1");
  const sourceNames = Object.keys(expected.coefficients);
  const beta = model.columnNames.map((name) => {
    const source = sourceNames.find((candidate) => rename(candidate) === name);
    return source === undefined ? NaN : num(expected.coefficients[source]!);
  });
  if (beta.some((v) => !Number.isFinite(v))) return false;
  const residuals = model.y.map((value, i) =>
    value - model.x[i]!.reduce((sum, x, j) => sum + x * beta[j]!, 0));
  const weights = model.observationWeights;
  const inv = model.wtMethod === "inv";
  const effectiveN = inv ? residuals.length : weights.reduce((sum, w) => sum + w, 0);
  const p = beta.length;
  let scoreResidual = 0;
  for (let j = 0; j < p; j++) {
    let score = 0;
    let magnitude = 0;
    for (let i = 0; i < residuals.length; i++) {
      const rootWeight = inv ? Math.sqrt(weights[i]!) : weights[i]!;
      const u = (inv ? Math.sqrt(weights[i]!) * residuals[i]! : residuals[i]!) / scale;
      const weight = model.psi === "huber"
        ? Number(psiHuber(u, { k: model.k }))
        : model.psi === "hampel"
          ? Number(psiHampel(u, { a: model.a, b: model.b, c: model.c }))
          : Number(psiBisquare(u, { c: model.c }));
      const contribution = rootWeight * model.x[i]![j]! * u * weight;
      score += contribution;
      magnitude += Math.abs(contribution);
    }
    scoreResidual = Math.max(scoreResidual, magnitude === 0 ? Math.abs(score) : Math.abs(score) / magnitude);
  }

  let scaleResidual: number;
  if (model.scaleEst === "Huber" || model.scaleEst === "proposal 2") {
    const k2 = model.k2;
    const upper = pnorm(k2) as number;
    const density = Math.exp(-0.5 * k2 * k2) / Math.sqrt(2 * Math.PI);
    const target = 2 * upper - 1 - 2 * k2 * density + 2 * k2 * k2 * (1 - upper);
    let sum = 0;
    for (let i = 0; i < residuals.length; i++) {
      const u = (inv ? Math.sqrt(weights[i]!) * residuals[i]! : residuals[i]!) / scale;
      sum += (inv ? 1 : weights[i]!) * Math.min(u * u, k2 * k2);
    }
    const denominator = effectiveN - p;
    if (!(denominator > 0)) return false;
    scaleResidual = Math.abs(sum / denominator - target);
  } else {
    const absolute = residuals.map((r, i) => Math.abs((inv ? Math.sqrt(weights[i]!) * r : r)));
    const pairs = absolute.map((value, i) => ({ value, weight: inv ? 1 : weights[i]! }))
      .filter((pair) => pair.weight > 0)
      .sort((a, b) => a.value - b.value);
    const total = pairs.reduce((sum, pair) => sum + pair.weight, 0);
    let cumulative = 0;
    let med = NaN;
    for (let i = 0; i < pairs.length; i++) {
      cumulative += pairs[i]!.weight;
      if (cumulative > total / 2) { med = pairs[i]!.value; break; }
      if (cumulative === total / 2) {
        med = (pairs[i]!.value + (pairs[i + 1]?.value ?? pairs[i]!.value)) / 2;
        break;
      }
    }
    scaleResidual = Math.abs(med / 0.6745 - scale) / Math.max(scale, 1e-300);
  }
  // A false convergence flag alone is not disqualifying: use the estimating-equation
  // and scale-equation residuals. This rejects genuinely oscillating reference fits.
  return scoreResidual <= 1e-8 && scaleResidual <= 1e-8;
}


function estimatingEquationResidual(fit: ReturnType<typeof fitFrom>): number {
  const model = fit.model;
  const p = model.x[0]?.length ?? 0;
  let maximum = 0;
  for (let j = 0; j < p; j++) {
    let score = 0;
    let magnitude = 0;
    for (let i = 0; i < fit.residuals.length; i++) {
      const weight = model.observationWeights[i]!;
      const rootWeight = model.wtMethod === "inv" ? Math.sqrt(weight) : weight;
      const residual = model.wtMethod === "inv" ? Math.sqrt(weight) * fit.residuals[i]! : fit.residuals[i]!;
      const u = residual / fit.scale;
      const psiWeight = model.psi === "huber"
        ? Number(psiHuber(u, { k: model.k }))
        : model.psi === "hampel"
          ? Number(psiHampel(u, { a: model.a, b: model.b, c: model.c }))
          : Number(psiBisquare(u, { c: model.c }));
      const contribution = rootWeight * model.x[i]![j]! * u * psiWeight;
      score += contribution;
      magnitude += Math.abs(contribution);
    }
    maximum = Math.max(maximum, magnitude === 0 ? Math.abs(score) : Math.abs(score) / magnitude);
  }
  return maximum;
}

const LTS_CASES = fixture.cases.filter((c) => (c.ltsReferences?.length ?? 0) > 0);
const MM_CASES = fixture.cases.filter((c) => (c.sReferences?.length ?? 0) > 0);

describe("deterministic LTS starts", () => {
  for (const c of LTS_CASES) {
    it(c.id, () => {
      const fit = fitFrom(c.fits.main.fit);
      const exact = c.exactReferences?.find((entry) => entry.kind === "lts");
      expect(exact, c.id + " exact LTS reference").toBeDefined();
      expect(fit.initialization?.method).toBe("LTS");
      const objective = fit.initialization?.objective;
      expect(objective, c.id + " LTS crit").toBeDefined();
      expect(objective!, c.id + " LTS crit").toBeGreaterThanOrEqual(0);
      const n = fit.residuals.length;
      const p = fit.model.x[0]?.length ?? 0;
      const h = Math.floor(n / 2) + Math.floor((p + 1) / 2);
      const exactCoefficients = exact!.reference.coefficients!;
      const exactBeta = fit.model.columnNames.map((name) => {
        const value = exactCoefficients[name];
        expect(value, c.id + " R exact coefficient " + name).toBeDefined();
        return num(value!);
      });
      const exactResiduals = fit.model.y.map((value, i) =>
        value - fit.model.x[i]!.reduce((sum, x, j) => sum + x * exactBeta[j]!, 0));
      const exactSquares = exactResiduals.map((r, i) => {
        const working = fit.model.wtMethod === "inv" ? Math.sqrt(fit.model.observationWeights[i]!) * r : r;
        return working * working;
      }).sort((a, b) => a - b);
      const exactObjective = exactSquares.slice(0, h).reduce((sum, value) => sum + value, 0);
      const reportedCrit = num(exact!.reference.crit!);
      expect(Math.abs(exactObjective - reportedCrit) / Math.max(1, Math.abs(reportedCrit)), c.id + " R exact coefficients reproduce crit")
        .toBeLessThanOrEqual(1e-10);
      expect(objective!, c.id + " rStats LTS objective no worse than R exact")
        .toBeLessThanOrEqual(exactObjective + 1e-10 * Math.max(1, exactObjective));
      expect(fit.initialization?.exhaustive, c.id + " exhaustive subset search").toBe(true);
      expect(estimatingEquationResidual(fit), c.id + " M estimating equations").toBeLessThanOrEqual(1e-8);
      const total = binomialForTest(n, p);
      if (total > 10_000n) {
        expect(fit.warnings.some((warning) => warning.includes("high-breakdown start is not certified"))).toBe(true);
      }
    });
  }
});

describe("LTS trimming count when n is even and p is odd", () => {
  it("stackloss[-1, ]: n=20, p=3 uses h=12", () => {
    const source = fixture.cases.find((entry) => entry.id === "stackloss-hampel-lts");
    expect(source, "stackloss source fixture").toBeDefined();
    const raw = source!.fits.main.fit;
    const data = raw.data as { columns: Record<string, unknown[]> };
    const reduced = {
      ...raw,
      formula: "stack.loss ~ Air.Flow + Water.Temp",
      data: { columns: Object.fromEntries(Object.entries(data.columns).map(([name, values]) => [name, values.slice(1)])) },
    };
    const fit = fitFrom(reduced);
    const n = fit.residuals.length;
    const p = fit.model.x[0]?.length ?? 0;
    const h = Math.floor(n / 2) + Math.floor((p + 1) / 2);
    expect(n).toBe(20);
    expect(p).toBe(3);
    expect(h).toBe(12);
    const objective = fit.initialization?.objective;
    expect(objective, "LTS objective with h=12").toBeDefined();
    const initial = fit.initialization!.coefficients;
    const initialResiduals = fit.model.y.map((value, i) =>
      value - fit.model.x[i]!.reduce((sum, x, j) => sum + x * initial[fit.model.columnNames[j]!]!, 0));
    const squares = initialResiduals.map((r, i) => {
      const working = fit.model.wtMethod === "inv" ? Math.sqrt(fit.model.observationWeights[i]!) * r : r;
      return working * working;
    }).sort((a, b) => a - b);
    const recomputed = squares.slice(0, h).reduce((sum, value) => sum + value, 0);
    expect(Math.abs(recomputed - objective!), "reported LTS objective uses h=12").toBeLessThanOrEqual(1e-10);
    expect(objective!, "rStats LTS criterion no worse than R exact crit")
      .toBeLessThanOrEqual(1.65740740740738 + 1e-10);
  });
});

describe("deterministic S initialization for MM", () => {
  for (const c of MM_CASES) {
    it(c.id, () => {
      const fit = fitFrom(c.fits.main.fit);
      const exact = c.exactReferences?.find((entry) => entry.kind === "S");
      expect(exact, c.id + " exact S reference").toBeDefined();
      expect(fit.initialization?.method).toBe("S");
      expect(fit.initialization?.objective, c.id + " S scale").toBeDefined();
      expect(fit.initialization!.objective, c.id + " S scale").toBeGreaterThanOrEqual(0);
      const exactScale = num(exact!.reference.scale!);
      const exactCoefficients = exact!.reference.coefficients!;
      const exactBeta = fit.model.columnNames.map((name) => {
        const value = exactCoefficients[name];
        expect(value, c.id + " R exact coefficient " + name).toBeDefined();
        return num(value!);
      });
      const exactResiduals = fit.model.y.map((value, i) =>
        value - fit.model.x[i]!.reduce((sum, x, j) => sum + x * exactBeta[j]!, 0));
      const absolute = exactResiduals.map((r, i) =>
        Math.abs(fit.model.wtMethod === "inv" ? Math.sqrt(fit.model.observationWeights[i]!) * r : r));
      const exactDivisor = absolute.length - exactBeta.length;
      const rhoMean = (scale: number): number => absolute.reduce((sum, value) => {
        const u = value / (1.548 * scale);
        if (u >= 1) return sum + 1;
        const square = u * u;
        return sum + 1 - (1 - square) ** 3;
      }, 0) / exactDivisor;
      let lo = 0;
      let hi = Math.max(1, ...absolute);
      while (rhoMean(hi) > 0.5) hi *= 2;
      for (let iteration = 0; iteration < 100; iteration++) {
        const mid = lo + (hi - lo) / 2;
        if (rhoMean(mid) > 0.5) lo = mid;
        else hi = mid;
      }
      const exactCoefficientScale = (lo + hi) / 2;
      expect(Math.abs(exactScale - exactCoefficientScale) / exactCoefficientScale, c.id + " R reported S scale at exact coefficients")
        .toBeLessThanOrEqual(1e-4);
      expect(fit.initialization!.objective, c.id + " rStats S scale no worse than R exact coefficients")
        .toBeLessThanOrEqual(exactCoefficientScale + 1e-10 * Math.max(1, exactCoefficientScale));
      const sResiduals = fit.model.y.map((value, i) =>
        value - fit.model.x[i]!.reduce((sum, x, j) => sum + x * fit.initialization!.coefficients[fit.model.columnNames[j]!]!, 0));
      const divisor = sResiduals.length - (fit.model.x[0]?.length ?? 0);
      let rhoSum = 0;
      for (let i = 0; i < sResiduals.length; i++) {
        const weightedResidual = fit.model.wtMethod === "inv"
          ? Math.sqrt(fit.model.observationWeights[i]!) * sResiduals[i]!
          : sResiduals[i]!;
        const u = weightedResidual / (1.548 * fit.initialization!.objective);
        const square = u * u;
        rhoSum += Math.abs(u) >= 1 ? 1 : 1 - (1 - square) ** 3;
      }
      expect(Math.abs(rhoSum / divisor - 0.5), c.id + " exact S scale equation (n-p divisor)")
        .toBeLessThanOrEqual(2e-12);
      expect(fit.initialization?.exhaustive, c.id + " exhaustive subset search").toBe(true);
      expect(fit.scale).toBe(fit.initialization!.objective);
      expect(estimatingEquationResidual(fit), c.id + " MM estimating equations").toBeLessThanOrEqual(1e-8);
      expect(fit.model.psi).toBe("bisquare");
      expect(fit.converged).toBe(true);
      const independentlyCalculatedStddev = independentMmStddev(fit);
      expect(fit.stddev, c.id + " independently calculated MM covariance scale")
        .toBeCloseTo(independentlyCalculatedStddev, 10);
      for (let i = 0; i < fit.covariance.length; i++) {
        for (let j = 0; j < fit.covariance[i]!.length; j++) {
          expect(fit.covariance[i]![j], c.id + " covariance[" + i + "," + j + "]")
            .toBeCloseTo(independentlyCalculatedStddev ** 2 * fit.covarianceUnscaled[i]![j]!, 10);
        }
      }
      const n = fit.residuals.length;
      const p = fit.model.x[0]?.length ?? 0;
      const total = binomialForTest(n, p);
      if (total > 10_000n) {
        expect(fit.warnings.some((warning) => warning.includes("high-breakdown start is not certified"))).toBe(true);
      }
    });
  }
});

function independentMmStddev(fit: ReturnType<typeof fitFrom>): number {
  const { model, residuals, scale } = fit;
  const n = residuals.length;
  const p = model.x[0]?.length ?? 0;
  const q = model.wtMethod === "case" ? model.observationWeights : model.observationWeights.map(() => 1);
  const u = residuals.map((r, i) =>
    (model.wtMethod === "inv" ? Math.sqrt(model.observationWeights[i]!) * r : r) / scale);
  const psi = u.map((v) => v * (model.psi === "huber"
    ? Number(psiHuber(v, { k: model.k }))
    : model.psi === "hampel"
      ? Number(psiHampel(v, { a: model.a, b: model.b, c: model.c }))
      : Number(psiBisquare(v, { c: model.c }))));
  const derivative = u.map((v) => model.psi === "huber"
    ? Number(psiHuber(v, { k: model.k, deriv: 1 }))
    : model.psi === "hampel"
      ? Number(psiHampel(v, { a: model.a, b: model.b, c: model.c, deriv: 1 }))
      : Number(psiBisquare(v, { c: model.c, deriv: 1 })));
  const N = q.reduce((sum, value) => sum + value, 0);
  const meanD = q.reduce((sum, value, i) => sum + value * derivative[i]!, 0) / N;
  const varianceD = q.reduce((sum, value, i) => sum + value * (derivative[i]! - meanD) ** 2, 0) / (N - 1);
  const correction = 1 + (p / N) * varianceD / (meanD * meanD);
  const scoreSquares = q.reduce((sum, value, i) => sum + value * psi[i]! ** 2, 0);
  return scale * correction * Math.sqrt(scoreSquares / (N - p)) / meanD;
}

function binomialForTest(n: number, k: number): bigint {
  let value = 1n;
  for (let i = 1; i <= Math.min(k, n - k); i++) value = value * BigInt(n - Math.min(k, n - k) + i) / BigInt(i);
  return value;
}

describe("robust regression psi functions", () => {
  it("matches every point of the recorded signed psi grid", () => {
    const { u, psiHuber: h, psiHampel: a, psiBisquare: b } = experiment.psi_grid;
    const compare = (actual: number[], expected: number[], label: string) => {
      expect(actual.length, label + " length").toBe(expected.length);
      actual.forEach((v, i) => expect(Math.abs(v - expected[i]!), `${label}[${i}]`).toBeLessThanOrEqual(3e-15));
    };
    compare(vector(psiHuber(u)), h.w, "Huber weights");
    compare(vector(psiHuber(u, { deriv: 1 })), h.d.map(Number), "Huber derivative");
    compare(vector(psiHampel(u)), a.w, "Hampel weights");
    compare(vector(psiHampel(u, { deriv: 1 })), a.d, "Hampel derivative");
    compare(vector(psiBisquare(u)), b.w, "bisquare weights");
    compare(vector(psiBisquare(u, { deriv: 1 })), b.d, "bisquare derivative");
  });
});

const M_CASES = fixture.cases.filter((c) => {
  const args = c.fits.main.fit;
  return args.method !== "MM" && args.init !== "lts" && c.fits.main.fitPublic !== undefined;
});

describe("robust M regression against the R fixture", () => {
  for (const c of M_CASES) {
    it(c.id, () => {
      const args = c.fits.main.fit;
      const fit = fitFrom(args);
      const expected = c.fits.main.fitPublic!;
      const rename = (name: string) => name.replace(/^factor\(cyl\)([0-9]+)$/, "cyl$1");
      const expectedNames = Object.keys(expected.coefficients).map(rename);
      expect(Object.keys(fit.coefficients)).toEqual(expectedNames);
      const tightArgs = c.fits.main.fitTight?.fit;
      const tightCandidate = c.fits.main.fitTight?.fitPublic;
      const tightExpected = tightArgs !== undefined && tightCandidate !== undefined
        && tightReferenceIsStationary(tightArgs, tightCandidate) ? tightCandidate : undefined;
      // maxit=2 tests the early-stop status only: IRLS update details need not reproduce
      // another implementation's intermediate point when the stopping algorithm differs.
      if (c.id === "phones-maxit-2") {
        expect(fit.converged).toBe(false);
        expect(fit.warnings).toContain("'rlm' failed to converge in 2 steps");
        return;
      }
      for (const name of expectedNames) {
        const sourceName = Object.keys(expected.coefficients).find((key) => rename(key) === name)!;
        const r = num(expected.coefficients[sourceName]!);
        const actual = fit.coefficients[name]!;
        const tight = tightExpected === undefined ? undefined : num(tightExpected.coefficients[sourceName]!);
        const allowance = tight === undefined ? 3e-3 : Math.max(3e-3, Math.abs(r - tight) / Math.max(Math.abs(r), 1e-300) + 1e-8);
        expect(Math.abs(actual - r) / Math.max(1, Math.abs(r)), name).toBeLessThanOrEqual(allowance);
      }
      const tightScale = tightExpected?.s;
      const scaleExpected = num(expected.s);
      const scaleAllowance = tightScale === undefined ? 3e-3 : Math.max(3e-3, Math.abs(scaleExpected - num(tightScale)) / Math.max(Math.abs(scaleExpected), 1e-300) + 1e-8);
      expect(Math.abs(fit.scale - scaleExpected) / Math.max(1, Math.abs(scaleExpected))).toBeLessThanOrEqual(scaleAllowance);
      const expectedRows = expected.summary.rows.map(rename);
      expect(fit.model.columnNames).toEqual(expectedRows);
      const summary = rlmSummary(fit);
      expect(summary.rows).toEqual(expectedRows);
      expect(summary.columns).toEqual(expected.summary.cols);
      numericMatrix(summary.values, expected.summary.values, c.id + " summary", 3e-3, tightExpected?.summary.values);
      const vcov = rlmVcov(fit);
      expect(vcov.rows).toEqual(expectedRows);
      expect(vcov.columns).toEqual(expected.vcov.cols.map(rename));
      numericMatrix(vcov.values, expected.vcov.values, c.id + " vcov", 3e-3, tightExpected?.vcov.values);
      const unscaled = fit.covarianceUnscaled;
      numericMatrix(unscaled, expected["cov.unscaled"].values, c.id + " cov.unscaled", 1e-10);
      const tightStddev = tightExpected?.stddev;
      const stddevExpected = num(expected.stddev);
      const stddevAllowance = tightStddev === undefined ? 3e-3 : Math.max(3e-3,
        Math.abs(stddevExpected - num(tightStddev)) / Math.max(Math.abs(stddevExpected), 1e-300) + 1e-8);
      expect(Math.abs(fit.stddev - stddevExpected) / Math.max(1, Math.abs(stddevExpected)), c.id + " stddev")
        .toBeLessThanOrEqual(stddevAllowance);

      if (tightArgs !== undefined && tightExpected !== undefined) {
        const tightFit = fitFrom(tightArgs);
        for (const name of Object.keys(tightExpected.coefficients)) {
          const actualName = rename(name);
          const r = num(tightExpected.coefficients[name]!);
          expect(Math.abs(tightFit.coefficients[actualName]! - r) / Math.max(1, Math.abs(r)), c.id + " tight " + name)
            .toBeLessThanOrEqual(1e-8);
        }
        expect(Math.abs(tightFit.scale - num(tightExpected.s)) / Math.max(1, Math.abs(num(tightExpected.s))), c.id + " tight scale")
          .toBeLessThanOrEqual(1e-8);
      }
    });
  }

  it("retains the iteration-limit status for maxit=2", () => {
    const c = fixture.cases.find((v) => v.id === "phones-maxit-2");
    expect(c).toBeDefined();
    const fit = fitFrom(c!.fits.main.fit);
    expect(fit.converged).toBe(false);
    expect(fit.warnings).toContain("'rlm' failed to converge in 2 steps");
  });
});

describe("rlm errors and numerical boundaries", () => {
  it("rejects a rank-deficient design before robust initialization", () => {
    expect(() => rlm("y ~ x + z", {
      y: [2, 4, 6, 8, 10],
      x: [1, 2, 3, 4, 5],
      z: [2, 4, 6, 8, 10],
    })).toThrow(/'x' is singular/);
  });

  it("rejects MM with case weights", () => {
    const c = fixture.cases.find((value) => value.id === "mm-case-weights");
    expect(c).toBeDefined();
    expect(() => fitFrom(c!.fits.main.fit)).toThrow(/MM estimation does not support case weights/);
  });

  it("reports a non-converged fit and its warning at the iteration limit", () => {
    const c = fixture.cases.find((value) => value.id === "phones-maxit-2");
    expect(c).toBeDefined();
    const fit = fitFrom(c!.fits.main.fit);
    expect(fit.converged).toBe(false);
    expect(fit.warnings).toContain("'rlm' failed to converge in 2 steps");
  });

  it("returns finite zero-scale diagnostics for an exact fit", () => {
    const fit = rlm("y ~ 1", { y: [5, 5, 5, 5] });
    expect(fit.scale).toBe(0);
    expect(fit.converged).toBe(true);
    expect(fit.robustWeights).toEqual([1, 1, 1, 1]);
    expect(fit.workingWeights).toEqual([1, 1, 1, 1]);
    expect(fit.stddev).toBe(0);
    expect(fit.covariance.flat().every(Number.isFinite)).toBe(true);
    expect(fit.covariance.flat().every((value) => value === 0)).toBe(true);
  });
});
