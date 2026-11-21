import { describe, expect, it } from "vitest";
import { geeglm } from "../src/models/gee.js";
import { glmnet } from "../src/models/glmnet.js";
import { rq, rqSummary } from "../src/models/rq.js";

function close(actual: number, expected: number, tolerance = 1e-10): void {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(Math.abs(expected), Number.MIN_VALUE));
}
function rqScalar(value: number | number[]): number { return Array.isArray(value) ? value[0]! : value; }
function rqVector(values: Record<string, number | number[]>): number[] {
  return Object.values(values).flatMap(value => Array.isArray(value) ? value : [value]);
}
function closeCoefficient(actual: number, expected: number, scale: number, tolerance = 1e-10): void {
  const zeroCut = 1e-12 * scale;
  if (Math.abs(actual) <= zeroCut && Math.abs(expected) <= zeroCut) return;
  close(actual, expected, tolerance);
}
function closeCoefficientVector(actual: readonly number[], expected: readonly number[], tolerance = 1e-10): void {
  expect(actual.length).toBe(expected.length);
  let scale = 0;
  for (const value of actual) scale = Math.max(scale, Math.abs(value));
  for (const value of expected) scale = Math.max(scale, Math.abs(value));
  for (let i = 0; i < expected.length; i++) closeCoefficient(actual[i]!, expected[i]!, scale, tolerance);
}
function closeVector(actual: readonly number[], expected: readonly number[], tolerance = 1e-10): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) close(actual[i]!, expected[i]!, tolerance);
}
function finiteOrError(run: () => readonly number[]): void {
  let result: readonly number[] | undefined;
  let failed = false;
  try { result = run(); } catch { failed = true; }
  if (!failed) expect(result!.every(Number.isFinite)).toBe(true);
}
function dataSet(n = 120) {
  const x = Array.from({ length: n }, (_, i) => Math.sin((i + 1) * .71) + .1 * Math.cos((i + 1) * .19));
  const z = Array.from({ length: n }, (_, i) => Math.cos((i + 1) * .37) + .13 * Math.sin((i + 1) * .11));
  const y = x.map((v, i) => 1.3 + .75 * v - .42 * z[i]! + .18 * Math.sin((i + 1) * 1.13));
  return { x, z, y, id: Array.from({ length: n }, (_, i) => Math.floor(i / 2) + 1),
    wave: Array.from({ length: n }, (_, i) => i % 2 + 1) };
}
function reorder<T>(values: readonly T[], order: readonly number[]): T[] { return order.map(i => values[i]!); }

describe("regression 1.8.0: scale, weight, order, and edge-input audit", () => {
  const d = dataSet();
  const rqBase = rq("y ~ x + z", d, { tau: .5, method: "fn", eps: 1e-12 });
  const rqBaseSummary = rqSummary(rqBase, { se: "nid", covariance: true });
  const geeOptions = { id: "id", waves: "wave", corstr: "independence" as const, epsilon: 1e-10, maxit: 200 };
  const geeBase = geeglm("y ~ x + z", d, geeOptions);
  const glmX = d.x.map((v, i) => [v, d.z[i]!]);
  const glmBase = glmnet(glmX, d.y, { nlambda: 10, thresh: 1e-12, standardize: true });

  it("keeps rq coefficients and nid standard errors equivariant under x and y scales", () => {
    const baseXSe = rqBaseSummary.coefficients.find(v => v.term === "x")!.stdError;
    const baseZSe = rqBaseSummary.coefficients.find(v => v.term === "z")!.stdError;
    for (const scale of [1e100, 1e-100]) {
      const xFit = rq("y ~ x + z", { ...d, x: d.x.map(v => v * scale) }, { tau: .5, method: "fn", eps: 1e-12 });
      close(rqScalar(xFit.coefficients.x!) * scale, rqScalar(rqBase.coefficients.x!));
      close(rqScalar(xFit.coefficients.z!), rqScalar(rqBase.coefficients.z!));
      const xSummary = rqSummary(xFit, { se: "nid" });
      close(xSummary.coefficients.find(v => v.term === "x")!.stdError * scale, baseXSe, 1e-10);
      close(xSummary.coefficients.find(v => v.term === "z")!.stdError, baseZSe, 1e-10);

      const zFit = rq("y ~ x + z", { ...d, z: d.z.map(v => v * scale) }, { tau: .5, method: "fn", eps: 1e-12 });
      close(rqScalar(zFit.coefficients.z!) * scale, rqScalar(rqBase.coefficients.z!));
      close(rqScalar(zFit.coefficients.x!), rqScalar(rqBase.coefficients.x!));
      const zSummary = rqSummary(zFit, { se: "nid" });
      close(zSummary.coefficients.find(v => v.term === "z")!.stdError * scale, baseZSe, 1e-10);

      const yFit = rq("ys ~ x + z", { ...d, ys: d.y.map(v => v * scale) }, { tau: .5, method: "fn", eps: 1e-12 });
      for (const term of ["(Intercept)", "x", "z"]) close(rqScalar(yFit.coefficients[term]!) / scale, rqScalar(rqBase.coefficients[term]!));
      const ySummary = rqSummary(yFit, { se: "nid" });
      for (const term of ["(Intercept)", "x", "z"]) {
        const baseSe = rqBaseSummary.coefficients.find(v => v.term === term)!.stdError;
        close(ySummary.coefficients.find(v => v.term === term)!.stdError / scale, baseSe, 1e-10);
      }
    }
  });

  it("keeps GEE coefficients and robust standard errors equivariant under x and y scales", () => {
    const baseSe = geeBase.covariance.map((row, i) => Math.sqrt(row[i]!));
    for (const scale of [1e100, 1e-100]) {
      const xFit = geeglm("y ~ x + z", { ...d, x: d.x.map(v => v * scale) }, geeOptions);
      close(xFit.coefficients[1]! * scale, geeBase.coefficients[1]!);
      close(xFit.coefficients[2]!, geeBase.coefficients[2]!);
      close(Math.sqrt(xFit.covariance[1]![1]!) * scale, baseSe[1]!, 1e-10);
      const zFit = geeglm("y ~ x + z", { ...d, z: d.z.map(v => v * scale) }, geeOptions);
      close(zFit.coefficients[2]! * scale, geeBase.coefficients[2]!);
      close(zFit.coefficients[1]!, geeBase.coefficients[1]!);
      close(Math.sqrt(zFit.covariance[2]![2]!) * scale, baseSe[2]!, 1e-10);
      const yFit = geeglm("ys ~ x + z", { ...d, ys: d.y.map(v => v * scale) }, geeOptions);
      closeVector(yFit.coefficients.map(v => v / scale), geeBase.coefficients, 1e-10);
      closeVector(yFit.covariance.map((row, i) => Math.sqrt(row[i]!) / scale), baseSe, 1e-10);
    }
  });

  it("scales glmnet lambda and coefficients correctly with standardize on and off", () => {
    for (const standardize of [true, false]) {
      const base = glmnet(glmX, d.y, { nlambda: 10, thresh: 1e-12, standardize });
      for (const scale of [1e100, 1e-100]) {
        const xFit = glmnet(glmX.map(row => row.map(v => v * scale)), d.y,
          { nlambda: 10, thresh: 1e-12, standardize });
        expect(xFit.lambda.length).toBe(base.lambda.length);
        for (let k = 0; k < base.lambda.length; k++) {
          close(standardize ? xFit.lambda[k]! : xFit.lambda[k]! / scale, base.lambda[k]!, 1e-10);
          for (let j = 0; j < 2; j++) closeCoefficient(xFit.beta[k]![j]! * scale, base.beta[k]![j]!, base.beta.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0));
        }
        const yFit = glmnet(glmX, d.y.map(v => v * scale), { nlambda: 10, thresh: 1e-12, standardize });
        for (let k = 0; k < base.lambda.length; k++) {
          close(yFit.lambda[k]! / scale, base.lambda[k]!, 1e-10);
          close(yFit.a0[k]! / scale, base.a0[k]!, 1e-10);
          for (let j = 0; j < 2; j++) closeCoefficient(yFit.beta[k]![j]! / scale, base.beta[k]![j]!, base.beta.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0));
        }
      }
    }
  });

  it("makes coefficients invariant to constant weight multiples and zero-weight rows", () => {
    const unit = new Array<number>(d.y.length).fill(1);
    for (const scale of [1e-8, 3, 1e8]) {
      const rqFit = rq("y ~ x + z", d, { tau: .5, method: "fn", eps: 1e-12, weights: unit.map(v => v * scale) });
      closeVector(["(Intercept)", "x", "z"].map(k => rqScalar(rqFit.coefficients[k]!)), ["(Intercept)", "x", "z"].map(k => rqScalar(rqBase.coefficients[k]!)), 1e-12);
      const geeFit = geeglm("y ~ x + z", d, { ...geeOptions, weights: unit.map(v => v * scale) });
      closeVector(geeFit.coefficients, geeBase.coefficients, 1e-12);
      const glmFit = glmnet(glmX, d.y, { nlambda: 10, thresh: 1e-12, weights: unit.map(v => v * scale) });
      closeVector(glmFit.lambda, glmBase.lambda, 1e-12);
      closeCoefficientVector(glmFit.beta.flat(), glmBase.beta.flat(), 1e-12);
    }
    const keep = Array.from({ length: d.y.length }, (_, i) => i).filter(i => i >= 2);
    const zero = unit.slice(); zero[0] = 0; zero[1] = 0;
    const rqZero = rq("y ~ x + z", d, { tau: .5, method: "fn", eps: 1e-12, weights: zero });
    const rqDrop = rq("y ~ x + z", { x: reorder(d.x, keep), z: reorder(d.z, keep), y: reorder(d.y, keep) },
      { tau: .5, method: "fn", eps: 1e-12 });
    closeVector(["(Intercept)", "x", "z"].map(k => rqScalar(rqZero.coefficients[k]!)), ["(Intercept)", "x", "z"].map(k => rqScalar(rqDrop.coefficients[k]!)), 1e-12);
    const geeZero = geeglm("y ~ x + z", d, { ...geeOptions, weights: zero });
    const dDrop = { x: reorder(d.x, keep), z: reorder(d.z, keep), y: reorder(d.y, keep),
      id: reorder(d.id, keep), wave: reorder(d.wave, keep) };
    const geeDrop = geeglm("y ~ x + z", dDrop, { id: "id", waves: "wave", corstr: "independence", epsilon: 1e-10, maxit: 200 });
    closeVector(geeZero.coefficients, geeDrop.coefficients, 1e-10);
    const glmZero = glmnet(glmX, d.y, { nlambda: 10, thresh: 1e-12, weights: zero });
    const glmDrop = glmnet(reorder(glmX, keep), reorder(d.y, keep), { nlambda: 10, thresh: 1e-12 });
    closeVector(glmZero.lambda, glmDrop.lambda, 1e-10);
    closeVector(glmZero.beta.flat(), glmDrop.beta.flat(), 1e-10);
  });

  it("is invariant to row and predictor-column order", () => {
    const order = Array.from({ length: d.y.length }, (_, i) => (i * 37) % d.y.length);
    const shuffled = { x: reorder(d.x, order), z: reorder(d.z, order), y: reorder(d.y, order),
      id: reorder(d.id, order), wave: reorder(d.wave, order) };
    const rqRows = rq("y ~ x + z", shuffled, { tau: .5, method: "fn", eps: 1e-12 });
    closeVector(["(Intercept)", "x", "z"].map(k => rqScalar(rqRows.coefficients[k]!)), ["(Intercept)", "x", "z"].map(k => rqScalar(rqBase.coefficients[k]!)));
    const geeRows = geeglm("y ~ x + z", shuffled, geeOptions);
    closeVector(geeRows.coefficients, geeBase.coefficients, 1e-10);
    const glmRows = glmnet(reorder(glmX, order), reorder(d.y, order), { nlambda: 10, thresh: 1e-12 });
    closeVector(glmRows.lambda, glmBase.lambda, 1e-10);
    closeCoefficientVector(glmRows.beta.flat(), glmBase.beta.flat(), 1e-10);

    const rqCols = rq("y ~ z + x", d, { tau: .5, method: "fn", eps: 1e-12 });
    close(rqScalar(rqCols.coefficients.x!), rqScalar(rqBase.coefficients.x!));
    close(rqScalar(rqCols.coefficients.z!), rqScalar(rqBase.coefficients.z!));
    const geeCols = geeglm("y ~ z + x", d, geeOptions);
    close(geeCols.coefficients[1]!, geeBase.coefficients[2]!, 1e-10);
    close(geeCols.coefficients[2]!, geeBase.coefficients[1]!, 1e-10);
    const glmCols = glmnet(glmX.map(row => [row[1]!, row[0]!]), d.y, { nlambda: 10, thresh: 1e-12 });
    closeVector(glmCols.lambda, glmBase.lambda, 1e-10);
    for (let k = 0; k < glmBase.lambda.length; k++) {
      closeCoefficient(glmCols.beta[k]![0]!, glmBase.beta[k]![1]!, glmBase.beta.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0));
      closeCoefficient(glmCols.beta[k]![1]!, glmBase.beta[k]![0]!, glmBase.beta.flat().reduce((m, v) => Math.max(m, Math.abs(v)), 0));
    }
  });

  it("rejects or safely omits every non-finite response, predictor, weight, and offset", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const badY = d.y.slice(); badY[3] = bad;
      const badX = d.x.slice(); badX[3] = bad;
      finiteOrError(() => rqVector(rq("y ~ x + z", { ...d, y: badY }, { tau: .5, method: "fn" }).coefficients));
      finiteOrError(() => rqVector(rq("y ~ x + z", { ...d, x: badX }, { tau: .5, method: "fn" }).coefficients));
      const badW = new Array<number>(d.y.length).fill(1); badW[3] = bad;
      finiteOrError(() => rqVector(rq("y ~ x + z", d, { tau: .5, method: "fn", weights: badW }).coefficients));
      finiteOrError(() => {
        const fit = geeglm("y ~ x + z", { ...d, y: badY }, geeOptions);
        return fit.coefficients.concat(fit.covariance.flat());
      });
      finiteOrError(() => {
        const fit = geeglm("y ~ x + z", { ...d, x: badX }, geeOptions);
        return fit.coefficients.concat(fit.covariance.flat());
      });
      finiteOrError(() => {
        const fit = geeglm("y ~ x + z", d, { ...geeOptions, weights: badW });
        return fit.coefficients.concat(fit.covariance.flat());
      });
      finiteOrError(() => {
        const badOffset = new Array<number>(d.y.length).fill(0); badOffset[3] = bad;
        const fit = geeglm("y ~ x + z", d, { ...geeOptions, offset: badOffset });
        return fit.coefficients.concat(fit.covariance.flat());
      });
      const badMatrix = glmX.map(row => row.slice()); badMatrix[3]![0] = bad;
      expect(() => glmnet(badMatrix, d.y)).toThrow();
      expect(() => glmnet(glmX, badY)).toThrow();
      expect(() => glmnet(glmX, d.y, { weights: badW })).toThrow();
      const badOffset = new Array<number>(d.y.length).fill(0); badOffset[3] = bad;
      expect(() => glmnet(glmX, d.y, { offset: badOffset })).toThrow();
    }
    const negative = new Array<number>(d.y.length).fill(1); negative[3] = -1;
    expect(() => rq("y ~ x + z", d, { weights: negative })).toThrow();
    expect(() => geeglm("y ~ x + z", d, { ...geeOptions, weights: negative })).toThrow();
    expect(() => glmnet(glmX, d.y, { weights: negative })).toThrow();
  });

  it("handles rq tau near both boundaries and its degenerate design cases explicitly", () => {
    for (const tau of [.001, .999]) {
      const fit = rq("y ~ x + z", d, { tau, method: "fn", eps: 1e-12 });
      expect(rqVector(fit.coefficients).every(Number.isFinite)).toBe(true);
    }
    const constantY = rq("y ~ x", { x: d.x.slice(0, 20), y: new Array<number>(20).fill(3) }, { tau: .5, method: "fn" });
    expect(rqVector(constantY.coefficients).every(Number.isFinite)).toBe(true);
    expect(() => rq("y ~ x + z", { x: [1,2,3,4], z: [2,4,6,8], y: [1,2,3,4] })).toThrow();
    expect(() => rq("y ~ x + z", { x: [1,2,3], z: [1,2,3], y: [1,2,3] })).toThrow();
    const square = rq("y ~ x", { x: [0, 1], y: [2, 4] }, { tau: .5 });
    expect(rqVector(square.coefficients).every(Number.isFinite)).toBe(true);
  });

  it("covers GEE single-cluster, singleton, and unbalanced cluster structures", () => {
    const oneCluster = { ...d, id: new Array<number>(d.y.length).fill(1) };
    finiteOrError(() => geeglm("y ~ x", oneCluster, { id: "id", waves: "wave", corstr: "exchangeable" }).coefficients);
    const singletons = { ...d, id: d.y.map((_, i) => i + 1) };
    finiteOrError(() => geeglm("y ~ x", singletons, { id: "id", corstr: "independence" }).coefficients);
    const uneven = { x: d.x.slice(0, 9), y: d.y.slice(0, 9), id: [1,1,1,2,2,3,3,3,3], wave: [1,2,3,1,2,1,2,3,4] };
    finiteOrError(() => geeglm("y ~ x", uneven, { id: "id", waves: "wave", corstr: "exchangeable" }).coefficients);
  });

  it("covers glmnet p > n, separation, and invalid one-column or constant responses", () => {
    const smallX = Array.from({ length: 8 }, (_, i) => Array.from({ length: 20 }, (_, j) => Math.sin((i + 1) * (j + 1))));
    const smallY = smallX.map((row, i) => row[0]! - .4 * row[1]! + i * .01);
    const highDim = glmnet(smallX, smallY, { nlambda: 6, thresh: 1e-8 });
    expect(highDim.beta.flat().every(Number.isFinite)).toBe(true);
    expect(() => glmnet(glmX.map(row => [row[0]!]), d.y)).toThrow();
    expect(() => glmnet(glmX, new Array<number>(d.y.length).fill(1))).toThrow();
    const separatedY = d.x.map(v => v > 0 ? 1 : 0);
    const separated = glmnet(glmX, separatedY, { family: "binomial", nlambda: 8, thresh: 1e-8 });
    expect(separated.beta.flat().every(Number.isFinite)).toBe(true);
    const classes = d.x.map((v, i) => v > .45 ? "C" : v < -.45 ? "A" : (d.z[i]! > 0 ? "B" : "A"));
    const multi = glmnet(glmX, classes, { family: "multinomial", nlambda: 8, thresh: 1e-8 });
    expect(Object.values(multi.beta).flat(2).every(Number.isFinite)).toBe(true);
  });

  it("fits 10000 GEE clusters and 100000-row, 20-predictor glmnet models and records elapsed time", () => {
    const clusters = 10000, n = clusters * 2;
    const largeGee = {
      id: Array.from({ length: n }, (_, i) => Math.floor(i / 2) + 1),
      wave: Array.from({ length: n }, (_, i) => i % 2 + 1),
      x: Array.from({ length: n }, (_, i) => i % 2),
      y: Array.from({ length: n }, (_, i) => 1 + (i % 2) * .7 + (Math.floor(i / 2) % 97) * .003 + (i % 2 ? .04 : -.04)),
    };
    for (const corstr of ["independence", "exchangeable"] as const) {
      const start = Date.now();
      const fit = geeglm("y ~ x", largeGee, { id: "id", waves: "wave", corstr, epsilon: 1e-8, maxit: 100 });
      const elapsed = Date.now() - start;
      console.log(`[regression18-edge] geeglm ${corstr}, ${clusters} clusters: ${elapsed} ms`);
      expect(fit.coefficients.every(Number.isFinite)).toBe(true);
    }
    const rows = 100000, columns = 20;
    const largeX = Array.from({ length: rows }, (_, i) => Array.from({ length: columns }, (_, j) =>
      Math.sin((i + 1) * (j + 2) * .0007) + Math.cos((i + 3) * (j + 1) * .00031)));
    const largeY = largeX.map((row, i) => 1 + row[0]! - .5 * row[1]! + .2 * Math.sin(i * .17));
    const largeBinary = largeX.map((row, i) => ((i * 7919) % 1000) / 1000 < 1 / (1 + Math.exp(-(row[0]! - row[1]!))) ? 1 : 0);
    for (const family of ["gaussian", "binomial"] as const) {
      const start = Date.now();
      const fit = glmnet(largeX, family === "gaussian" ? largeY : largeBinary,
        { family, nlambda: 20, thresh: 1e-6 });
      const elapsed = Date.now() - start;
      console.log(`[regression18-edge] glmnet ${family}, n=${rows}, p=${columns}: ${elapsed} ms`);
      expect(fit.beta.flat().every(Number.isFinite)).toBe(true);
    }
  });
});
