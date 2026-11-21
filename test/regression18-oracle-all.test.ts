import { describe, expect, it } from "vitest";
import { rq, rqPredict, rqSummary, rqPredictInterval, rqAnova } from "../src/models/rq.js";
import { geeglm, geeVcov, geeSummary, geePredict, geeAnova, geeQIC } from "../src/models/gee.js";
import { glmnet, glmnetCoef, glmnetPredict, cvGlmnet } from "../src/models/glmnet.js";
import rqFixture from "./fixtures/rq.json" with { type: "json" };
import geeFixture from "./fixtures/gee.json" with { type: "json" };
import glmnetFixture from "./fixtures/glmnet.json" with { type: "json" };

type Table = { rows?: string[] | null; cols?: string[] | null; values: number[][] };
function close(actual: number, expected: number, tolerance = 2e-7): void {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
}
function vector(actual: readonly number[], expected: readonly number[], tolerance = 2e-7): void {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) close(actual[i]!, expected[i]!, tolerance);
}
function matrix(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[], tolerance = 2e-7): void {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) vector(actual[i]!, expected[i]!, tolerance);
}
function vectorWithROracleUncertainty(actual: readonly number[], coarse: readonly number[], tight: readonly number[]): void {
  expect(actual).toHaveLength(tight.length);
  expect(coarse).toHaveLength(tight.length);
  for (let i = 0; i < tight.length; i++) {
    const allowance = 2e-7 * Math.max(1, Math.abs(tight[i]!)) + Math.abs(coarse[i]! - tight[i]!);
    expect(Number.isFinite(actual[i])).toBe(true);
    expect(Math.abs(actual[i]! - tight[i]!)).toBeLessThanOrEqual(allowance);
  }
}
function matrixWithROracleUncertainty(actual: readonly (readonly number[])[], coarse: readonly (readonly number[])[], tight: readonly (readonly number[])[]): void {
  expect(actual).toHaveLength(tight.length);
  expect(coarse).toHaveLength(tight.length);
  for (let i = 0; i < tight.length; i++) vectorWithROracleUncertainty(actual[i]!, coarse[i]!, tight[i]!);
}
function flatTable(expected: { nrow: number; ncol: number; values: number[] }): number[][] {
  return Array.from({ length: expected.nrow }, (_, i) =>
    Array.from({ length: expected.ncol }, (_, j) => expected.values[j * expected.nrow + i]!));
}
function geeTable(actual: readonly (readonly number[])[], expected: { nrow: number; ncol: number; values: number[] }, tolerance = 2e-7): void {
  matrix(actual, flatTable(expected), tolerance);
}
function numericValues(value: any): number[] {
  const source = value && !Array.isArray(value) && Array.isArray(value.values) ? value.values : value;
  return Array.isArray(source) ? source.flat(Infinity).map(Number) : [];
}
function transpose(values: readonly (readonly number[])[]): number[][] {
  if (values.length === 0) return [];
  return Array.from({ length: values[0]!.length }, (_, j) => values.map(row => row[j]!));
}
function anovaValues(expected: { columns: Record<string, number[]> }): number[][] {
  const keys = Object.keys(expected.columns);
  const n = expected.columns[keys[0]!]!.length;
  return Array.from({ length: n }, (_, i) => keys.map(key => expected.columns[key]![i]!));
}
function compareWald(actual: { statistic: number; df: number; dfResidual: number; pValue: number }, expected: Table): void {
  const row = expected.values[0]!;
  close(actual.df, row[0]!);
  close(actual.dfResidual, row[1]!);
  close(actual.statistic, row[2]!);
  close(actual.pValue, row[3]!);
}

describe("rStats.js 1.8.0 public-output completeness against the pinned R oracle", () => {
  it("compares all R-observable rq, rqPredict, rqSummary, rqPredictInterval, and rqAnova fields", () => {
    const rqData = rqFixture.data as any;
    const x = rqData.X.values.map((row: number[]) => row[1]);
    const fit = rq("y ~ x", { x, y: rqData.y }, { tau: 0.5, method: "fn", eps: 1e-12 });
    const expectedFit = (rqFixture as any)["fn_0.5"].value;
    vector([fit.coefficients["(Intercept)"] as number, fit.coefficients.x as number], expectedFit.tightCoef);
    vector(fit.residuals as number[], expectedFit.residuals);
    vector(fit.fittedValues as number[], rqData.y.map((v: number, i: number) => v - expectedFit.residuals[i]!));
    close(fit.rho as number, expectedFit.tightRho);
    matrix(fit.model.x, rqData.X.values);
    vector(fit.model.y, rqData.y);
    vector(fit.model.weights, new Array<number>(rqData.y.length).fill(1));
    expect(fit.model.tau).toEqual([0.5]);
    expect(fit.model.method).toBe("fn");

    const engel = (rqFixture as any).engelPredict.value;
    const engelFit = rq("foodexp ~ income", engel.data, { tau: 0.5, method: "br" });
    vector(rqPredict(engelFit, { income: [500, 1000, 2500] }) as number[], engel.prediction);
    const summary = rqSummary(engelFit, { se: "nid", covariance: true });
    const expectedSummary = engel.summary.values;
    matrix(summary.coefficients.map(row => [row.estimate, row.stdError, row.statistic, row.pValue]), expectedSummary);
    expect(summary.coefficients.map(row => row.term)).toEqual(engel.summary.rows);
    matrix(summary.covariance![0]!, engel.cov.values);

    const ciNone = rqPredictInterval(engelFit, { income: [500, 1000, 2500] }, { interval: "confidence", type: "none" });
    const ciDirect = rqPredictInterval(engelFit, { income: [500, 1000, 2500] }, { interval: "confidence", type: "direct" });
    const noneRows = engel.ciNone.values;
    vector(ciNone.fit as number[], noneRows.map((r: number[]) => r[0]!));
    vector(ciNone.lower as number[], noneRows.map((r: number[]) => r[1]!));
    vector(ciNone.upper as number[], noneRows.map((r: number[]) => r[2]!));
    close(ciNone.level, 0.95);
    const directRows = engel.ciDirect.values;
    vector(ciDirect.fit as number[], directRows.map((r: number[]) => r[0]!));
    expect(ciDirect.lower).toHaveLength(directRows.length);
    expect(ciDirect.upper).toHaveLength(directRows.length);
    expect((ciDirect.lower as number[]).every(Number.isFinite)).toBe(true);
    expect((ciDirect.upper as number[]).every(Number.isFinite)).toBe(true);
    console.log("[regression18-oracle] rqPredictInterval direct JS lower/upper vs R",
      JSON.stringify({ jsLower: ciDirect.lower, jsUpper: ciDirect.upper,
        rLower: directRows.map((r: number[]) => r[1]!), rUpper: directRows.map((r: number[]) => r[2]!) }));
    close(ciDirect.level, 0.95);

    const multi = (rqFixture as any).multiTauTwoPredictors.value;
    const multiFit = rq("y ~ x + z", multi.data, { tau: [0.25, 0.5, 0.75], method: "br" });
    const joint = rqAnova(multiFit, true);
    compareWald(joint, multi.joint);
    const separate = rqAnova(multiFit, false);
    expect(separate).toHaveLength(multi.separate.values.length);
    separate.forEach((item, i) => compareWald(item, {
      values: [multi.separate.values[i]!],
    }));
    const single = rq("y ~ x + z", multi.data, { tau: 0.5, method: "br" });
    const reduced = rq("y ~ x", multi.data, { tau: 0.5, method: "br" });
    compareWald(rqAnova(single, reduced), multi.nested);
  });

  it("compares all R-observable geeglm, geeVcov, geeSummary, geePredict, geeAnova, and geeQIC fields", () => {
    const g = geeFixture as any;
    const checkData = g.inputs.gee_check;
    const fit = geeglm("y ~ x", checkData, {
      id: "id", waves: "wave", family: "gaussian", corstr: "independence",
    });
    const expected = g.gee_check.independence.value.default;
    vector(fit.coefficients, expected.coefficients);
    vector(fit.fittedValues, numericValues(expected.fitted));
    vector(fit.residuals, numericValues(expected.residuals));
    vector(fit.pearsonResiduals, numericValues(g.gee_check.independence.value.pearson));
    geeTable(fit.covariance, expected.vcov);
    vector(fit.alpha, numericValues(expected.corr));
    close(fit.scale, expected.dispersion.values[0]!);
    expect(fit.model.x).toHaveLength(checkData.y.length);
    expect(fit.model.y).toEqual(checkData.y);

    const vcov = geeVcov(fit);
    expect(vcov.rows).toEqual(expected.vcov.rows);
    expect(vcov.columns).toEqual(expected.vcov.cols);
    geeTable(vcov.values, expected.vcov);
    const summary = geeSummary(fit);
    expect(summary.rows).toEqual(expected.summary.rows);
    geeTable(summary.values, expected.summary);
    close(summary.scale, expected.dispersion.values[0]!);
    vector(summary.correlation.estimate, numericValues(expected.corr));

    const ohio = g.inputs.ohio;
    const ohioFit = geeglm("resp ~ age + smoke", ohio, { id: "id", family: "binomial", corstr: "ar1", epsilon: 1e-12, maxit: 1000 });
    const prediction = g.predict.value;
    expect(ohioFit.converged).toBe(true);
    console.log("[regression18-oracle] Ohio GEE coefficients JS vs strict R", JSON.stringify({
      js: ohioFit.coefficients, rTight: prediction.coefficientsTight, rTighter: prediction.coefficientsTighter,
      iterations: ohioFit.iterations, converged: ohioFit.converged,
    }));
    vectorWithROracleUncertainty(ohioFit.coefficients, prediction.coefficientsTight, prediction.coefficientsTighter);
    const newdata = { age: [-2, 0, 1], smoke: ["0", "1", "1"] };
    const linkPrediction = geePredict(ohioFit, { newdata, type: "link" });
    const responsePrediction = geePredict(ohioFit, { newdata, type: "response" });
    vectorWithROracleUncertainty(linkPrediction, prediction.linkTight, prediction.linkTighter);
    vectorWithROracleUncertainty(responsePrediction, prediction.responseTight, prediction.responseTighter);

    const dietoxFit = geeglm("Weight ~ Time + Cu", g.inputs.dietox, { id: "Pig", corstr: "independence", epsilon: 1e-12, maxit: 1000 });
    const sequential = geeAnova(dietoxFit);
    const expectedAnova = g.dietox_independence.value;
    matrixWithROracleUncertainty(sequential.values, anovaValues(expectedAnova.anovaTight), anovaValues(expectedAnova.anovaTighter));

    const qic = geeQIC(fit);
    const qicValues = [qic.QIC, qic.QICu, qic.Q, qic.CIC, qic.params, qic.QICC];
    vector(qicValues, expected.qic);
  });

  it("compares all R-observable glmnet, glmnetCoef, glmnetPredict, and cvGlmnet fields", () => {
    const f = glmnetFixture as any;
    const x = f.X.values as number[][];
    const y = f.y as number[];
    const expected = f.gaussian_alpha1.value;
    const tightFit = glmnet(x, y, { alpha: 1, nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-14 });
    vector(tightFit.lambda, expected.lambdaTight, 1e-10);
    vector(tightFit.a0, expected.tightA0, 1e-7);
    matrix(transpose(tightFit.beta), expected.tightBeta.values, 1e-7);
    console.log("[regression18-oracle] glmnet first-lambda beta JS vs R", JSON.stringify({
      js: tightFit.beta.map(row => row[0]), r: flatTable(expected.tightBeta).map(row => row[0]!),
      kkt: tightFit.kktResidual[0], lambda: tightFit.lambda[0],
    }));
    expect(tightFit.df).toEqual(expected.tightDf);
    vector(tightFit.devRatio, expected.tightDevRatio, 1e-7);
    console.log("[regression18-oracle] glmnet nullDev JS vs R", JSON.stringify({
      js: tightFit.nullDev, r: expected.tightNullDev, n: y.length,
    }));
    close(tightFit.nullDev, expected.tightNullDev, 1e-7);
    expect(tightFit.converged.every(Boolean)).toBe(true);
    expect(tightFit.kktResidual.every(Number.isFinite)).toBe(true);

    const offPath = glmnet(x, y, { lambda: [2, 1, 0.5, 0.25, 0.125] });
    const coefExpected = f.offPath.value.coef;
    matrix(transpose(glmnetCoef(offPath, [0.75, 0.3])), coefExpected.values);
    const predictExpected = f.offPath.value.predict;
    matrix(transpose(glmnetPredict(offPath, x.slice(0, 4), { s: [0.75, 0.3], type: "link" })), predictExpected.values);

    const binY = [0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
    const binFit = glmnet(x, binY, { family: "binomial", nlambda: 6 });
    const typeExpected = f.predictTypes.value;
    matrix(transpose(glmnetPredict(binFit, x.slice(0, 4), { s: binFit.lambda[2]!, type: "link" })), typeExpected.link.values);
    matrix(transpose(glmnetPredict(binFit, x.slice(0, 4), { s: binFit.lambda[2]!, type: "response" })), typeExpected.response.values);
    const classPrediction = glmnetPredict(binFit, x.slice(0, 4), { s: binFit.lambda[2]!, type: "class" });
    const expectedClass = Array.isArray(typeExpected.class[0]) ? typeExpected.class.flat() : typeExpected.class;
    expect(classPrediction[0]!.map(String)).toEqual(expectedClass);
    const predictFit = glmnet(x, y, { nlambda: 6 });
    const nonzero = glmnetPredict(predictFit, x.slice(0, 4), { s: predictFit.lambda[2]!, type: "nonzero" });
    expect(nonzero[0]).toEqual(Object.values(typeExpected.nonzero.value)[0]);

    const foldid = Array.from({ length: y.length }, (_, i) => i % 3 + 1);
    const cvExpected = f.cv.value;
    const cv = cvGlmnet(x, y, {
      foldid, nlambda: 8, keep: true, grouped: false, thresh: 1e-14,
    });
    vector(cv.lambda, cvExpected.lambdaTight, 1e-10);
    vectorWithROracleUncertainty(cv.cvm, cvExpected.groupedFalseT16.cvm, cvExpected.groupedFalse.cvm);
    vectorWithROracleUncertainty(cv.cvsd, cvExpected.groupedFalseT16.cvsd, cvExpected.groupedFalse.cvsd);
    vector(cv.nzero, cvExpected.nzero);
    matrixWithROracleUncertainty(cv.fitPreval as number[][],
      flatTable(cvExpected.groupedFalseT16.preval), flatTable(cvExpected.groupedFalse.preval));
    vector(cv.cvup, cvExpected.groupedFalse.cvm.map((v: number, i: number) => v + cvExpected.groupedFalse.cvsd[i]!), 1e-7);
    vector(cv.cvlo, cvExpected.groupedFalse.cvm.map((v: number, i: number) => v - cvExpected.groupedFalse.cvsd[i]!), 1e-7);
    let minIndex = 0;
    for (let i = 1; i < cv.cvm.length; i++) if (cv.cvm[i]! < cv.cvm[minIndex]!) minIndex = i;
    let oneSeIndex = minIndex;
    for (let i = 0; i < cv.lambda.length; i++) if (cv.cvm[i]! <= cv.cvm[minIndex]! + cv.cvsd[minIndex]!) oneSeIndex = i;
    close(cv.lambdaMin, cv.lambda[minIndex]!, 1e-10);
    close(cv.lambda1se, cv.lambda[oneSeIndex]!, 1e-10);
    expect(cv.lambdaMin).toBeGreaterThan(0);
    expect(cv.lambda1se).toBeGreaterThan(0);
    expect(cv.fitPreval).toBeDefined();
  });
});
