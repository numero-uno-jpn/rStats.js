import { describe, expect, it } from "vitest";
import { cvGlmnet, glmnet, glmnetCoef, glmnetPredict } from "../src/models/glmnet.js";
import glmnetFixture from "./fixtures/glmnet.json" with { type: "json" };

const x = [
  [-2,1,2],[1,0,-1],[0,2,1],[2,-1,0],[-1,3,-2],[3,-2,3],
  [1,2,-3],[-3,1,2],[2,-3,1],[0,4,-1],[4,0,4],[-2,-1,0],
];
const y = [4,2,5,1,7,0,6,3,8,2,9,1];

function solveDense(matrix: number[][], rhs: number[]): number[] {
  const a = matrix.map((row, i) => { const copy = row.slice(); copy.push(rhs[i]!); return copy; });
  for (let col = 0; col < rhs.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < rhs.length; row++)
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    const temp = a[col]!; a[col] = a[pivot]!; a[pivot] = temp;
    const divisor = a[col]![col]!;
    for (let j = col; j <= rhs.length; j++) a[col]![j] = a[col]![j]! / divisor;
    for (let row = 0; row < rhs.length; row++) if (row !== col) {
      const factor = a[row]![col]!;
      for (let j = col; j <= rhs.length; j++) a[row]![j] = a[row]![j]! - factor * a[col]![j]!;
    }
  }
  return a.map(row => row[rhs.length]!);
}

function gaussianLassoKktReference(
  x: number[][], y: number[], lambda: number, active: number[],
): { intercept: number; beta: number[]; kkt: number } {
  const n = y.length, p = x[0]!.length;
  const scales = new Array<number>(p).fill(0);
  for (let j = 0; j < p; j++) {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += x[i]![j]!;
    mean /= n;
    for (let i = 0; i < n; i++) scales[j] = scales[j]! + (x[i]![j]! - mean) ** 2;
    scales[j] = Math.sqrt(scales[j]! / n);
  }
  const columns: number[][] = [new Array<number>(n).fill(1)];
  for (const j of active) columns.push(x.map(row => row[j]!));
  const q = columns.length, matrix = Array.from({ length: q }, () => new Array<number>(q).fill(0));
  const rhs = new Array<number>(q).fill(0);
  for (let a = 0; a < q; a++) {
    for (let i = 0; i < n; i++) rhs[a] = rhs[a]! + columns[a]![i]! * y[i]!;
    rhs[a] = rhs[a]! / n;
    for (let b = 0; b < q; b++) {
      for (let i = 0; i < n; i++) matrix[a]![b] = matrix[a]![b]! + columns[a]![i]! * columns[b]![i]!;
      matrix[a]![b] = matrix[a]![b]! / n;
    }
    if (a > 0) rhs[a] = rhs[a]! - lambda * scales[active[a - 1]!]!;
  }
  const solution = solveDense(matrix, rhs), beta = new Array<number>(p).fill(0);
  for (let a = 1; a < q; a++) beta[active[a - 1]!] = solution[a]!;
  let kkt = 0;
  for (let j = 0; j < p; j++) {
    let gradient = 0;
    for (let i = 0; i < n; i++) {
      let residual = y[i]! - solution[0]!;
      for (let h = 0; h < p; h++) residual -= x[i]![h]! * beta[h]!;
      gradient += x[i]![j]! * residual / n;
    }
    const bound = lambda * scales[j]!;
    const violation = active.includes(j) ? Math.abs(gradient - bound) : Math.max(0, Math.abs(gradient) - bound);
    kkt = Math.max(kkt, violation);
  }
  return { intercept: solution[0]!, beta, kkt };
}

describe("elastic-net generalized linear models", () => {
  it("matches the tight Gaussian lasso path and returns original-scale coefficients", () => {
    const fit = glmnet(x, y, { nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-14 });
    const expectedLambda = [
      0.647290715250188,0.335262586973981,0.173648408012529,0.0899407532389702,
      0.0465845854032229,0.0241283680538477,0.0124972271386075,0.00647290715250188,
    ];
    const tight = (glmnetFixture as unknown as {
      gaussian_alpha1: { value: { tightA0: number[]; tightBeta: { values: number[][] } } };
    }).gaussian_alpha1.value;
    const expectedA0 = tight.tightA0;
    const expectedBeta = tight.tightBeta.values;
    let maxTightOracleRelativeDifference = 0;
    expect(fit.converged.every(Boolean)).toBe(true);
    expect(fit.kktResidual.every(v => v < 1e-10)).toBe(true);
    for (let k = 0; k < expectedLambda.length; k++) {
      expect(fit.lambda[k]).toBeCloseTo(expectedLambda[k]!, 11);
      const active = k === 0 ? [] : k <= 2 ? [0, 1] : [0, 1, 2];
      const exact = gaussianLassoKktReference(x, y, fit.lambda[k]!, active);
      expect(exact.kkt).toBeLessThan(1e-12);
      expect(fit.a0[k]).toBeCloseTo(exact.intercept, 10);
      for (let j = 0; j < 3; j++) {
        expect(fit.beta[k]![j]).toBeCloseTo(exact.beta[j]!, 10);
        const oracle = expectedBeta[j]![k]!;
        const oracleError = oracle === 0 ? Math.abs(exact.beta[j]!) :
          Math.abs(exact.beta[j]! - oracle) / Math.abs(oracle);
        maxTightOracleRelativeDifference = Math.max(maxTightOracleRelativeDifference, oracleError);
      }
      const interceptError = Math.abs(exact.intercept - expectedA0[k]!) / Math.abs(expectedA0[k]!);
      maxTightOracleRelativeDifference = Math.max(maxTightOracleRelativeDifference, interceptError);
    }
    // The independent KKT optimum is more accurate than the pinned R tight output by up to 4.1e-8 relatively.
    expect(maxTightOracleRelativeDifference).toBeLessThan(5e-8);
    expect(fit.converged.every(Boolean)).toBe(true);
    expect(fit.kktResidual.every(v => v < 1e-8)).toBe(true);
    expect(glmnetCoef(fit, fit.lambda[2])[0]![0]).toBeCloseTo(fit.a0[2]!, 12);
  });

  it("predicts on the response scale and interpolates coefficients linearly in lambda", () => {
    const fit = glmnet(x, y, { nlambda: 8, lambdaMinRatio: 0.01 });
    const s = fit.lambda[2]!;
    const link = glmnetPredict(fit, x.slice(0, 3), { s, type: "link" });
    const response = glmnetPredict(fit, x.slice(0, 3), { s, type: "response" });
    expect(response).toEqual(link);
    const left = glmnetCoef(fit, fit.lambda[1]!)[0]!;
    const right = glmnetCoef(fit, fit.lambda[2]!)[0]!;
    const sOff = 0.3;
    const t = (sOff - fit.lambda[1]!) / (fit.lambda[2]! - fit.lambda[1]!);
    const offPath = glmnetCoef(fit, sOff)[0]!;
    for (let j = 0; j < offPath.length; j++)
      expect(offPath[j]).toBeCloseTo(left[j]! * (1 - t) + right[j]! * t, 12);
    expect(glmnetCoef(fit, [0.75, sOff])).toHaveLength(2);
    expect(link[0]).toHaveLength(3);
  });

  it("fits binomial and Poisson paths with finite coefficients", () => {
    const binomial = glmnet(x, [0,0,1,0,1,0,1,0,1,1,1,1], { family: "binomial", nlambda: 6 });
    const poisson = glmnet(x, [1,2,1,3,2,4,1,3,2,5,4,6], {
      family: "poisson", offset: Array.from({length: 12}, (_, i) => Math.log(1 + i / 11)), nlambda: 6,
    });
    expect(binomial.beta.flat().every(Number.isFinite)).toBe(true);
    expect(poisson.beta.flat().every(Number.isFinite)).toBe(true);
  });

  it("uses fixed folds for cross-validation and returns both lambda selections", () => {
    const cv = cvGlmnet(x, y, { foldid: [1,2,3,1,2,3,1,2,3,1,2,3], nlambda: 6, keep: true });
    expect(cv.lambdaMin).toBeGreaterThan(0);
    expect(cv.lambda1se).toBeGreaterThan(0);
    expect(cv.cvm.every(Number.isFinite)).toBe(true);
    expect(cv.cvsd.every(Number.isFinite)).toBe(true);
    expect(cv.fitPreval).toHaveLength(12);
  });

  it("matches elastic-net and ridge lambda maxima and constrained penalty factors", () => {
    const fixture = glmnetFixture as unknown as {
      X: { values: number[][] };
      y: number[];
      "gaussian_alpha0.5": { value: { lambda: number[]; a0: number[]; beta: { values: number[][] } } };
      gaussian_alpha0: { value: { lambda: number[]; a0: number[]; beta: { values: number[][] } } };
      penaltyFactor: { value: { lambda: number[]; a0: number[]; beta: { values: number[][] } } };
    };
    for (const [alpha, key] of [[0.5, "gaussian_alpha0.5"], [0, "gaussian_alpha0"]] as const) {
      const fit = glmnet(fixture.X.values, fixture.y, { alpha, nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-12 });
      const expected = fixture[key].value;
      expect(fit.lambda[0]).toBeCloseTo(expected.lambda[0]!, 10);
      expect(fit.beta[0]![0]).toBeCloseTo(expected.beta.values[0]![0]!, 7);
      expect(fit.a0[0]).toBeCloseTo(expected.a0[0]!, 7);
    }
    const constrained = glmnet(fixture.X.values, fixture.y, {
      penaltyFactor: [0, 1, 4], lowerLimits: [-0.5, 0, -1], upperLimits: [0.5, 0, 1],
      dfmax: 2, pmax: 3, nlambda: 8,
    });
    const expected = fixture.penaltyFactor.value;
    expect(constrained.lambda[0]).toBeCloseTo(expected.lambda[0]!, 10);
    expect(constrained.beta[0]![0]).toBeCloseTo(expected.beta.values[0]![0]!, 7);
    expect(constrained.beta.every(row => row[1] === 0)).toBe(true);
  });

  it("solves the grouped and ungrouped multinomial paths to the optimum that R's strict refits approach", () => {
    // R's default fit (thresh = 1e-7) is up to 2.3 away from its strict refits on this path (iris is close to
    // separation), and even R's refits at thresh 1e-14 and 1e-16 differ by up to 3e-3 at the smallest lambda. So the
    // reference is R's 1e-16 refit, within the change between R's two refits (how far R itself still is from the
    // optimum) and a small margin; and the KKT conditions at every lambda. rStats.js is closer to R's 1e-16 refit than
    // R's 1e-14 refit is, at every lambda (experiment in the commit that added this test).
    const fixture = glmnetFixture as unknown as {
      multinomialData: { X: { values: number[][] }; y: string[] };
    } & Record<string, { value: { lambda: number[]; class: string[][];
      fitTight: Record<"t14" | "t16", { lambda: number[]; a0: { values: number[][] }; beta: Record<string, { values: number[][] }> }> } }>;
    const multiX = fixture.multinomialData.X.values, multiY = fixture.multinomialData.y;
    const mismatches: string[] = [];
    for (const typeMultinomial of ["ungrouped", "grouped"] as const) {
      const fit = glmnet(multiX, multiY, { family: "multinomial", typeMultinomial, nlambda: 6, thresh: 1e-12 });
      const { t14, t16 } = fixture[`multinomial_${typeMultinomial}`]!.value.fitTight;
      expect(fit.lambda).toHaveLength(6);
      fit.lambda.forEach((v, l) => { if (Math.abs(v - t16.lambda[l]!) > 1e-13 * t16.lambda[l]!) mismatches.push(`${typeMultinomial} lambda ${l}`); });
      expect(fit.converged.every(Boolean)).toBe(true);
      expect(Math.max(...fit.kktResidual)).toBeLessThan(1e-10);
      for (const k of ["setosa", "versicolor", "virginica"]) for (let j = 0; j < 4; j++) for (let l = 0; l < 6; l++) {
        const want = t16.beta[k]!.values[j]![l]!, gap = Math.abs(t14.beta[k]!.values[j]![l]! - want);
        const got = fit.beta[k]![j]![l]!;
        if (Math.abs(got - want) > gap + 1e-6 * (1 + Math.abs(want))) mismatches.push(`${typeMultinomial} ${k} beta[${j}] lambda ${l}: ${got} vs R ${want} (R's own gap ${gap})`);
      }
      const rows = [multiX[0]!, multiX[50]!, multiX[100]!];
      expect(glmnetPredict(fit, rows, { s: fit.lambda[2]!, type: "class" })[0]).toEqual(fixture[`multinomial_${typeMultinomial}`]!.value.class.map(row => row[0]));
      expect(glmnetCoef(fit, fit.lambda[2]!)).toHaveProperty("setosa");
    }
    expect(mismatches).toEqual([]);
  });

  it("matches Gaussian cross-validation summaries against the tight fixed-fold oracle", () => {
    const fixture = glmnetFixture as unknown as {
      X: { values: number[][] };
      y: number[];
      cv: { value: {
        lambda: number[]; lambdaTight: number[]; cvm: number[]; cvsd: number[];
        cvmTight: number[]; cvsdTight: number[];
        groupedFalse: { cvm: number[]; cvsd: number[]; preval: { values: number[][] } };
      } };
    };
    const foldid = Array.from({ length: fixture.y.length }, (_, i) => i % 3 + 1);
    const expected = fixture.cv.value;
    const grouped = cvGlmnet(fixture.X.values, fixture.y, { foldid, nlambda: 8, keep: true, thresh: 1e-15 });
    const groupedLength = Math.min(grouped.lambda.length, expected.lambdaTight.length);
    for (let k = 0; k < groupedLength; k++) {
      expect(grouped.lambda[k]).toBeCloseTo(expected.lambdaTight[k]!, 11);
      expect(grouped.cvm[k]).toBeCloseTo(expected.cvmTight[k]!, 7);
      expect(grouped.cvsd[k]).toBeCloseTo(expected.cvsdTight[k]!, 7);
    }
    expect(grouped.lambdaMin).toBeGreaterThan(0);
    expect(grouped.lambda1se).toBeGreaterThanOrEqual(grouped.lambdaMin);
    expect(grouped.lambda).toContain(grouped.lambdaMin);
    expect(grouped.lambda).toContain(grouped.lambda1se);
    const ungrouped = cvGlmnet(fixture.X.values, fixture.y, {
      foldid, nlambda: 8, grouped: false, keep: true, thresh: 1e-15,
    });
    const ungroupedLength = Math.min(ungrouped.lambda.length, expected.lambda.length);
    for (let k = 0; k < ungroupedLength; k++) {
      expect(ungrouped.lambda[k]).toBeCloseTo(expected.lambda[k]!, 11);
      expect(ungrouped.cvm[k]).toBeCloseTo(expected.groupedFalse.cvm[k]!, 7);
      expect(ungrouped.cvsd[k]).toBeCloseTo(expected.groupedFalse.cvsd[k]!, 7);
    }
    const prevalence = ungrouped.fitPreval as number[][];
    const expectedPrevalence = expected.groupedFalse.preval.values;
    expect(prevalence).toHaveLength(expectedPrevalence.length);
    for (let i = 0; i < prevalence.length; i++) for (let k = 0; k < expectedPrevalence[i]!.length; k++)
      expect(prevalence[i]![k]).toBeCloseTo(expectedPrevalence[i]![k]!, 7);
  });

  it("cross-validates multinomial probabilities on fixed folds", () => {
    const fixture = glmnetFixture as unknown as { multinomialData: { X: { values: number[][] }; y: string[] } };
    const multiX = fixture.multinomialData.X.values, multiY = fixture.multinomialData.y;
    const foldid = Array.from({ length: multiY.length }, (_, i) => i % 5 + 1);
    const cv = cvGlmnet(multiX, multiY, { family: "multinomial", foldid, nlambda: 4, keep: true, maxit: 5000, thresh: 1e-7 });
    expect(cv.cvm.every(Number.isFinite)).toBe(true);
    expect(cv.fitPreval).toHaveLength(multiY.length);
  });

  it("rejects non-finite designs and one-column predictors", () => {
    expect(() => glmnet([[1],[2],[3]], [1,2,3])).toThrow();
    expect(() => glmnet([[1,2],[2,3],[NaN,4]], [1,2,3])).toThrow();
  });

  it("standardizes y for gaussian, as R does, so that the ridge part acts at lambda / sd(y)", () => {
    // R (experiments/regression18-glmnet-ystd.R): glmnet(x, y, alpha = 0.5, lambda = c(0.4, 0.1), control = list(thresh = 1e-16))
    const n = 24, x = Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return [Math.sin(a), Math.cos(a) + 0.3 * Math.sin(2 * a)]; });
    const y = x.map((v, i) => 2.5 + 1.1 * v[0]! - 0.6 * v[1]! + 0.04 * Math.sin(6 * Math.PI * i / n));
    const weights = Array.from({ length: n }, (_, i) => (i % 2 ? 3 : 1));
    const cases: Array<[string, Record<string, unknown>, number[]]> = [
      ["default", {}, [2.5, 2.5, 0.66797899904517111, -0.26900869261322863, 0.97486093208094127, -0.50412516149875330]],
      ["standardize = FALSE", { standardize: false }, [2.5, 2.5, 0.48387466108245036, -0.16529402941883314, 0.89955245870081757, -0.46102741139024189]],
      ["weights", { weights }, [2.5, 2.5, 0.66797899904517111, -0.26900869261322841, 0.97486093208094138, -0.50412516149875308]],
      ["intercept = FALSE", { intercept: false }, [0, 0, 0.75992457457310092, -0.30603704095905249, 1.01026758065101463, -0.52243483197699958]],
      ["alpha = 0", { alpha: 0 }, [2.5, 2.5, 0.76037446741527914, -0.41474970949924328, 0.98950770457089932, -0.53973147522049059]],
    ];
    const mismatches: string[] = [];
    for (const [label, options, want] of cases) {
      const fit = glmnet(x, y, { alpha: 0.5, lambda: [0.4, 0.1], thresh: 1e-15, ...options });
      const got = [...fit.a0, ...fit.beta.flat()];
      got.forEach((v, k) => { if (Math.abs(v - want[k]!) > 1e-12 * Math.max(1, Math.abs(want[k]!))) mismatches.push(`${label} [${k}]: ${v} vs R ${want[k]}`); });
    }
    expect(mismatches).toEqual([]);
  });
});
