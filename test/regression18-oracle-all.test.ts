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
function closeWithROracleUncertainty(actual: number, coarse: number, tight: number): void {
  const allowance = 2e-7 * Math.max(1, Math.abs(tight)) + Math.abs(coarse - tight);
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - tight)).toBeLessThanOrEqual(allowance);
}
function vectorWithROracleUncertainty(actual: readonly number[], coarse: readonly number[], tight: readonly number[]): void {
  expect(actual).toHaveLength(tight.length);
  expect(coarse).toHaveLength(tight.length);
  for (let i = 0; i < tight.length; i++) closeWithROracleUncertainty(actual[i]!, coarse[i]!, tight[i]!);
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
function numericValues(value: any): number[] {
  const source = value && !Array.isArray(value) && Array.isArray(value.values) ? value.values : value;
  return Array.isArray(source) ? source.flat(Infinity).map(Number) : [];
}
function correlationEstimates(value: { nrow: number; values: number[] }): number[] {
  return value.values.slice(0, value.nrow);
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
    for (const corstr of ["independence", "exchangeable", "ar1", "unstructured"] as const) {
      const fit = geeglm("y ~ x", checkData, {
        id: "id", waves: "wave", family: "gaussian", corstr,
      });
      const reference = g.gee_check[corstr].value;
      const expected = reference.default;
      const expectedTight = reference.tight;
      vectorWithROracleUncertainty(fit.coefficients, expected.coefficients, expectedTight.coefficients);
      vectorWithROracleUncertainty(fit.fittedValues, numericValues(expected.fitted), numericValues(expectedTight.fitted));
      vectorWithROracleUncertainty(fit.residuals, numericValues(expected.residuals), numericValues(expectedTight.residuals));
      vectorWithROracleUncertainty(fit.pearsonResiduals,
        numericValues(reference.pearson), numericValues(reference.pearsonTight));
      matrixWithROracleUncertainty(fit.covariance, flatTable(expected.vcov), flatTable(expectedTight.vcov));
      vectorWithROracleUncertainty(fit.alpha, correlationEstimates(expected.corr), correlationEstimates(expectedTight.corr));
      closeWithROracleUncertainty(fit.scale, expected.dispersion.values[0]!, expectedTight.dispersion.values[0]!);
      if (corstr === "independence") {
        expect(fit.model.x).toHaveLength(checkData.y.length);
        expect(fit.model.y).toEqual(checkData.y);
      }

      const vcov = geeVcov(fit);
      expect(vcov.rows).toEqual(expected.vcov.rows);
      expect(vcov.columns).toEqual(expected.vcov.cols);
      matrixWithROracleUncertainty(vcov.values, flatTable(expected.vcov), flatTable(expectedTight.vcov));
      const summary = geeSummary(fit);
      expect(summary.rows).toEqual(expected.summary.rows);
      matrixWithROracleUncertainty(summary.values, flatTable(expected.summary), flatTable(expectedTight.summary));
      closeWithROracleUncertainty(summary.scale, expected.dispersion.values[0]!, expectedTight.dispersion.values[0]!);
      vectorWithROracleUncertainty(summary.correlation.estimate,
        correlationEstimates(expected.corr), correlationEstimates(expectedTight.corr));
      const qic = geeQIC(fit);
      vectorWithROracleUncertainty([qic.QIC, qic.QICu, qic.Q, qic.CIC, qic.params, qic.QICC],
        expected.qic, reference.qicTight);
    }

    const ohio = g.inputs.ohio;
    for (const corstr of ["independence", "exchangeable"] as const) {
      const fit = geeglm("resp ~ age + smoke", ohio, { id: "id", family: "binomial", corstr, epsilon: 1e-12, maxit: 1000 });
      const reference = g[`ohio_${corstr}`].value;
      vectorWithROracleUncertainty(fit.coefficients, reference.default.coefficients, reference.tight.coefficients);
    }
    const ohioFit = geeglm("resp ~ age + smoke", ohio, { id: "id", family: "binomial", corstr: "ar1", epsilon: 1e-12, maxit: 1000 });
    const prediction = g.predict.value;
    expect(ohioFit.converged).toBe(true);
    console.log("[regression18-oracle] Ohio GEE coefficients JS vs strict R", JSON.stringify({
      js: ohioFit.coefficients, rTight: prediction.coefficientsTight, rTighter: prediction.coefficientsTighter,
      jsAlpha: ohioFit.alpha, rAlphaTight: prediction.corrTight.values[0], rAlphaTighter: prediction.corrTighter.values[0],
      jsScale: ohioFit.scale, rScaleTight: prediction.dispersionTight.values[0], rScaleTighter: prediction.dispersionTighter.values[0],
      iterations: ohioFit.iterations, converged: ohioFit.converged,
    }));
    vectorWithROracleUncertainty(ohioFit.coefficients, prediction.coefficientsTight, prediction.coefficientsTighter);
    vectorWithROracleUncertainty(ohioFit.alpha, [prediction.corrTight.values[0]], [prediction.corrTighter.values[0]]);
    closeWithROracleUncertainty(ohioFit.scale, prediction.dispersionTight.values[0], prediction.dispersionTighter.values[0]);
    const newdata = { age: [-2, 0, 1], smoke: ["0", "1", "1"] };
    const linkPrediction = geePredict(ohioFit, { newdata, type: "link" });
    const responsePrediction = geePredict(ohioFit, { newdata, type: "response" });
    vectorWithROracleUncertainty(linkPrediction, prediction.linkTight, prediction.linkTighter);
    vectorWithROracleUncertainty(responsePrediction, prediction.responseTight, prediction.responseTighter);

    const dietoxFit = geeglm("Weight ~ Time + Cu", g.inputs.dietox, { id: "Pig", corstr: "independence", epsilon: 1e-12, maxit: 1000 });
    const sequential = geeAnova(dietoxFit);
    const expectedAnova = g.dietox_independence.value;
    matrixWithROracleUncertainty(sequential.values, anovaValues(expectedAnova.anovaTight), anovaValues(expectedAnova.anovaTighter));


  });

  it("compares all R-observable glmnet, glmnetCoef, glmnetPredict, and cvGlmnet fields", () => {
    const f = glmnetFixture as any;
    const x = f.X.values as number[][];
    const y = f.y as number[];
    const expected = f.gaussian_alpha1.value;
    const defaultFit = glmnet(x, y, { alpha: 1, nlambda: 8, lambdaMinRatio: 0.01 });
    console.log("[regression18-oracle] glmnet default first-lambda beta", JSON.stringify({
      beta: defaultFit.beta[0], df: defaultFit.df[0], kkt: defaultFit.kktResidual[0],
    }));
    vectorWithROracleUncertainty(defaultFit.lambda, expected.lambda, expected.lambdaTight);
    vectorWithROracleUncertainty(defaultFit.a0, expected.a0, expected.tightA0);
    matrixWithROracleUncertainty(transpose(defaultFit.beta), expected.beta.values, expected.tightBeta.values);
    vectorWithROracleUncertainty(defaultFit.df, expected.df, expected.tightDf);
    vectorWithROracleUncertainty(defaultFit.devRatio, expected.devRatio, expected.tightDevRatio);
    closeWithROracleUncertainty(defaultFit.nullDev, expected.nullDev, expected.tightNullDev);
    expect(defaultFit.converged.every(Boolean)).toBe(true);
    expect(defaultFit.kktResidual.every(Number.isFinite)).toBe(true);

    const tightFit = glmnet(x, y, { alpha: 1, nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-14 });
    vector(tightFit.lambda, expected.lambdaTight, 1e-10);
    vector(tightFit.a0, expected.tightA0, 1e-7);
    matrix(transpose(tightFit.beta), expected.tightBeta.values, 1e-7);
    console.log("[regression18-oracle] glmnet first-lambda beta JS vs R", JSON.stringify({
      js: tightFit.beta[0], r: expected.tightBeta.values.map((row: number[]) => row[0]!),
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
    vector(offPath.lambda, f.offPath.value.lambda, 1e-10);
    const offPathCoef = transpose(glmnetCoef(offPath, [0.75, 0.3]));
    const offPathPredict = transpose(glmnetPredict(offPath, x.slice(0, 4), { s: [0.75, 0.3], type: "link" }));
    console.log("[regression18-oracle] glmnet off-path JS vs strict R", JSON.stringify({
      jsCoef: offPathCoef, r16Coef: f.offPath.value.coefT16.values, r20Coef: f.offPath.value.coefT20.values,
      jsPredict: offPathPredict, r16Predict: f.offPath.value.predictT16.values, r20Predict: f.offPath.value.predictT20.values,
    }));
    matrixWithROracleUncertainty(offPathCoef, f.offPath.value.coefT16.values, f.offPath.value.coefT20.values);
    matrixWithROracleUncertainty(offPathPredict, f.offPath.value.predictT16.values, f.offPath.value.predictT20.values);

    const binY = [0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
    const binFit = glmnet(x, binY, { family: "binomial", nlambda: 6 });
    close(binFit.nullDev, f.binomial.value.nullDev, 1e-7);
    const poissonY = [1, 2, 1, 3, 2, 4, 1, 3, 2, 5, 4, 6];
    const poissonOffset = Array.from({ length: 12 }, (_, i) => Math.log(1 + i / 11));
    const poissonFit = glmnet(x, poissonY, { family: "poisson", offset: poissonOffset, nlambda: 6 });
    close(poissonFit.nullDev, f.poisson.value.nullDev, 1e-7);
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

it("compares Ohio AR1 fit coefficients and correlation with R", () => {
  const g = geeFixture as any;
  const ohioFit = geeglm("resp ~ age + smoke", g.inputs.ohio, {
    id: "id", family: "binomial", corstr: "ar1", epsilon: 1e-12, maxit: 1000,
  });
  const reference = g.ohio_ar1.value;
  console.log("[regression18-oracle] Ohio AR1 diagnostic", JSON.stringify({
    jsCoefficients: ohioFit.coefficients,
    rCoefficients: reference.tight.coefficients,
    jsAlpha: ohioFit.alpha,
    rAlpha: correlationEstimates(reference.tight.corr),
    jsScale: ohioFit.scale,
    rScale: reference.tight.dispersion.values[0],
    iterations: ohioFit.iterations,
    converged: ohioFit.converged,
  }));
  vectorWithROracleUncertainty(ohioFit.coefficients, reference.default.coefficients, reference.tight.coefficients);
  vectorWithROracleUncertainty(ohioFit.alpha, correlationEstimates(reference.default.corr), correlationEstimates(reference.tight.corr));
  closeWithROracleUncertainty(ohioFit.scale, reference.default.dispersion.values[0], reference.tight.dispersion.values[0]);
});

it("checks Gaussian glmnet lambda-max degrees of freedom", () => {
  const f = glmnetFixture as any;
  const x = f.inputs.gaussian_alpha1.x;
  const y = f.inputs.gaussian_alpha1.y;
  const expected = f.gaussian_alpha1.value;
  const fit = glmnet(x, y, { alpha: 1, nlambda: 8, lambdaMinRatio: 0.01 });
  console.log("[regression18-oracle] glmnet lambda-max diagnostic", JSON.stringify({
    beta: fit.beta[0],
    df: fit.df[0],
    rDf: expected.df[0],
    nullDev: fit.nullDev,
    rNullDev: expected.nullDev,
    kkt: fit.kktResidual[0],
  }));
  expect(fit.df).toEqual(expected.df);
  close(fit.nullDev, expected.nullDev, 1e-7);
  const tightFit = glmnet(x, y, { alpha: 1, nlambda: 8, lambdaMinRatio: 0.01, thresh: 1e-14 });
  expect(tightFit.df).toEqual(expected.tightDf);
  close(tightFit.nullDev, expected.tightNullDev, 1e-7);
});

it("diagnoses all synthetic GEE correlation structures against strict R fits", () => {
  const g = geeFixture as any;
  const data = g.inputs.gee_check;
  for (const corstr of ["independence", "exchangeable", "ar1", "unstructured"] as const) {
    const fit = geeglm("y ~ x", data, { id: "id", waves: "wave", family: "gaussian", corstr, epsilon: 1e-12, maxit: 1000 });
    const reference = g.gee_check[corstr].value;
    console.log("[regression18-oracle] synthetic GEE diagnostic", corstr, JSON.stringify({
      js: fit.coefficients, r: reference.tight.coefficients,
      jsAlpha: fit.alpha, rAlpha: correlationEstimates(reference.tight.corr),
    }));
    vectorWithROracleUncertainty(fit.coefficients, reference.default.coefficients, reference.tight.coefficients);
    vectorWithROracleUncertainty(fit.alpha, correlationEstimates(reference.default.corr), correlationEstimates(reference.tight.corr));
    matrixWithROracleUncertainty(fit.covariance, flatTable(reference.default.vcov), flatTable(reference.tight.vcov));
    closeWithROracleUncertainty(fit.scale, reference.default.dispersion.values[0], reference.tight.dispersion.values[0]);
  }
});

it("diagnoses strict JS convergence for off-path glmnet interpolation", () => {
  const f = glmnetFixture as any;
  const x = f.inputs.gaussian_alpha1.x;
  const y = f.inputs.gaussian_alpha1.y;
  const lambda = [2, 1, 0.5, 0.25, 0.125];
  const defaultFit = glmnet(x, y, { lambda });
  const strictFit = glmnet(x, y, { lambda, thresh: 1e-14 });
  const defaultCoef = transpose(glmnetCoef(defaultFit, [0.75, 0.3]));
  const strictCoef = transpose(glmnetCoef(strictFit, [0.75, 0.3]));
  console.log("[regression18-oracle] off-path default vs strict JS", JSON.stringify({
    defaultCoef, strictCoef, r16: f.offPath.value.coefT16?.values, r20: f.offPath.value.coefT20?.values,
  }));
  if (f.offPath.value.coefT16 && f.offPath.value.coefT20) {
    matrixWithROracleUncertainty(strictCoef, f.offPath.value.coefT16.values, f.offPath.value.coefT20.values);
  }
});
