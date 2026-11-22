import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cancor } from "../src/entries/multivariate.js";

/** R's JSON (jsonlite, auto_unbox) has a scalar for a vector of one; rStats.js always returns arrays */
const boxed = <T>(v: T | T[] | null): T[] | null => (v === null ? null : Array.isArray(v) ? v : [v]);

function cross(a: number[][]): number[][] {
  return a[0]!.map((_, i) => a[0]!.map((__, j) => a.reduce((s, r) => s + r[i]! * r[j]!, 0)));
}

const irisRows = JSON.parse(readFileSync(new URL("./fixtures/iris.json", import.meta.url), "utf8")) as [number, number, number, number, string][];
const cancorFixture = JSON.parse(readFileSync(new URL("./fixtures/cancor.json", import.meta.url), "utf8")) as Record<string, any>;
const mtRows = JSON.parse(readFileSync(new URL("./fixtures/mtcars.json", import.meta.url), "utf8")) as number[][];
function scoreProjector(scores: number[][]): number[][] {
  const gram = cross(scores), n = gram.length;
  const aug = gram.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(aug[i]![k]!) > Math.abs(aug[pivot]![k]!)) pivot = i;
    [aug[k], aug[pivot]] = [aug[pivot]!, aug[k]!];
    const d = aug[k]![k]!;
    for (let j = 0; j < 2 * n; j++) aug[k]![j]! /= d;
    for (let i = 0; i < n; i++) if (i !== k) {
      const f = aug[i]![k]!;
      for (let j = 0; j < 2 * n; j++) aug[i]![j]! -= f * aug[k]![j]!;
    }
  }
  const inv = aug.map((row) => row.slice(n));
  return scores.map((a) => scores.map((b) => {
    let value = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) value += a[i]! * inv[i]![j]! * b[j]!;
    return value;
  }));
}

function compareCancor(actual: ReturnType<typeof cancor>, expected: any, x?: number[][], y?: number[][]): void {
  const cor = actual.cor;
  const expectedCor = Array.isArray(expected.cor) ? expected.cor : [expected.cor];
  expect(cor.length).toBe(expectedCor.length);
  expectedCor.forEach((v: number, i: number) => expect(cor[i]).toBeCloseTo(v, 8));
  const xc = actual.xcenter;
  const yc = actual.ycenter;
  const xce = Array.isArray(expected.xcenter) ? expected.xcenter : [expected.xcenter];
  const yce = Array.isArray(expected.ycenter) ? expected.ycenter : [expected.ycenter];
  xce.forEach((v: number, i: number) => expect(xc[i]).toBeCloseTo(v, 9));
  yce.forEach((v: number, i: number) => expect(yc[i]).toBeCloseTo(v, 9));
  expect(actual.xcoef.rows).toEqual(boxed(expected.xcoef.rows));
  expect(actual.ycoef.rows).toEqual(boxed(expected.ycoef.rows));
  expect(actual.xcoef.cols).toBe(expected.xcoef.cols);
  expect(actual.ycoef.cols).toBe(expected.ycoef.cols);
  const ncan = expectedCor.length;
  const expectedX = expected.xcoef.values.map((row: number[]) => row.slice(0, ncan));
  const expectedY = expected.ycoef.values.map((row: number[]) => row.slice(0, ncan));
  expect(actual.xcoef.values[0]!.length).toBe(ncan);
  expect(actual.ycoef.values[0]!.length).toBe(ncan);
  const repeated = expectedCor.some((v: number, i: number) => i > 0 && Math.abs(v - expectedCor[i - 1]!) <= 1e-12);
  if (repeated && x !== undefined && y !== undefined) {
    const centeredScores = (data: number[][], center: number[], coef: number[][]) => {
      const centered = data.map((row) => row.map((v, j) => v - center[j]!));
      return centered.map((row) => Array.from({ length: ncan }, (_, k) =>
        row.reduce((s, v, j) => s + v * coef[j]![k]!, 0)));
    };
    const actualX = centeredScores(x, xc, actual.xcoef.values);
    const expectedXScores = centeredScores(x, xce, expectedX);
    const actualY = centeredScores(y, yc, actual.ycoef.values);
    const expectedYScores = centeredScores(y, yce, expectedY);
    expectMatrixClose(scoreProjector(actualX), scoreProjector(expectedXScores), 1e-12);
    expectMatrixClose(scoreProjector(actualY), scoreProjector(expectedYScores), 1e-12);
    return;
  }
  const sx = expectedX[0]!.map((_: number, j: number) => {
    const dot = actual.xcoef.values.reduce((s, row, i) => s + row[j]! * expectedX[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  const sy = expectedY[0]!.map((_: number, j: number) => {
    const dot = actual.ycoef.values.reduce((s, row, i) => s + row[j]! * expectedY[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  expectMatrixClose(actual.xcoef.values.map((row) => row.map((v, j) => v * sx[j]!)), expectedX, 1e-12);
  expectMatrixClose(actual.ycoef.values.map((row) => row.map((v, j) => v * sy[j]!)), expectedY, 1e-12);
}

function expectMatrixClose(actual: number[][], expected: number[][], tol = 1e-12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]!.length).toBe(expected[i]!.length);
    for (let j = 0; j < expected[i]!.length; j++) {
      const e = expected[i]![j]!;
      expect(Math.abs(actual[i]![j]! - e)).toBeLessThanOrEqual(tol * Math.max(Math.abs(e), 1e-300));
    }
  }
}

describe("cancor", () => {
  const x = Array.from({ length: 30 }, (_, i) => [i / 7 + Math.sin(i), (i % 5) - i / 13]);
  const y = Array.from({ length: 30 }, (_, i) => [2 * x[i]![0]! + x[i]![1]! + Math.cos(i), x[i]![0]! - 3 * x[i]![1]! + Math.sin(i * 0.3)]);
  it("matches the complete Iris canonical correlation fixture after paired sign alignment", () => {
    const x = irisRows.map((r) => [r[0], r[1]]);
    const y = irisRows.map((r) => [r[2], r[3]]);
    const expected = cancorFixture.cancor_iris.value;
    const actual = cancor(x, y, {
      xNames: ["Sepal.Length", "Sepal.Width"],
      yNames: ["Petal.Length", "Petal.Width"],
    });
    const cor = actual.cor;
    expect(cor).toHaveLength(expected.cor.length);
    expected.cor.forEach((v: number, i: number) => expect(cor[i]).toBeCloseTo(v, 8));
    const xc = actual.xcenter;
    const yc = actual.ycenter;
    expected.xcenter.forEach((v: number, i: number) => expect(xc[i]).toBeCloseTo(v, 10));
    expected.ycenter.forEach((v: number, i: number) => expect(yc[i]).toBeCloseTo(v, 10));
    expect(actual.xcoef.rows).toEqual(boxed(expected.xcoef.rows));
    expect(actual.ycoef.rows).toEqual(boxed(expected.ycoef.rows));
    const signs = expected.cor.map((_: number, j: number) => {
      const dot = actual.xcoef.values.reduce((s, row, i) => s + row[j]! * expected.xcoef.values[i]![j]!, 0);
      return dot < 0 ? -1 : 1;
    });
    expectMatrixClose(actual.xcoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.xcoef.values, 1e-12);
    expectMatrixClose(actual.ycoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.ycoef.values, 1e-12);
  });

  it("matches the remaining mtcars canonical-correlation fixtures", () => {
    const col = (j: number) => mtRows.map((r) => r[j]!);
    const cases = [
      ["cancor_one_x", col(5).map((v) => [v]), mtRows.map((r) => [r[0]!, r[3]!, r[6]!]), ["wt"], ["mpg", "hp", "qsec"]],
      ["cancor_more_x_than_y", mtRows.map((r) => [r[5]!, r[2]!, r[4]!, r[6]!]), mtRows.map((r) => [r[0]!, r[3]!]), ["wt", "disp", "drat", "qsec"], ["mpg", "hp"]],
      ["cancor_collinear", mtRows.map((r) => [r[5]!, r[2]!, r[5]! + r[2]!]), mtRows.map((r) => [r[0]!, r[3]!]), ["a", "b", "c"], ["mpg", "hp"]],
      ["cancor_n_small", mtRows.slice(0, 4).map((r) => [r[5]!, r[2]!, r[4]!]), mtRows.slice(0, 4).map((r) => [r[0]!, r[3]!]), ["wt", "disp", "drat"], ["mpg", "hp"]],
    ] as const;
    for (const [key, x, y, xNames, yNames] of cases) {
      compareCancor(cancor(x, y, { xNames, yNames }), cancorFixture[key].value, x, y);
    }
    compareCancor(cancor(col(5), col(0)), cancorFixture.cancor_vectors.value);
  });

  it("returns nonzero canonical pairs with cross-product normalisation", () => {
    const r = cancor(x, y, { xNames: ["a", "b"], yNames: ["c", "d"] });
    expect(r.cor).toHaveLength(2);
    expect(r.xcoef.rows).toEqual(["a", "b"]);
    expect(r.ycoef.rows).toEqual(["c", "d"]);
    const xcenter = r.xcenter;
    const ycenter = r.ycenter;
    const xc = x.map((row) => row.map((v, j) => v - xcenter[j]!));
    const yc = y.map((row) => row.map((v, j) => v - ycenter[j]!));
    const sx = cross(xc), sy = cross(yc);
    const a0 = r.xcoef.values.map((row) => row[0]!);
    const b0 = r.ycoef.values.map((row) => row[0]!);
    const nx = a0.reduce((s, v, i) => s + v * sx[i]!.reduce((t, z, j) => t + z * a0[j]!, 0), 0);
    const ny = b0.reduce((s, v, i) => s + v * sy[i]!.reduce((t, z, j) => t + z * b0[j]!, 0), 0);
    expect(nx).toBeCloseTo(1, 10);
    expect(ny).toBeCloseTo(1, 10);
  });
  it("supports uncentered and explicitly centered vectors", () => {
    const r = cancor([1, 2, 4, 8, 9], [2, 4, 5, 7, 12], { xcenter: false, ycenter: [1] });
    expect(r.xcenter).toEqual([0]);
    expect(r.ycenter).toEqual([1]);
    const cor = r.cor;
    expect(cor.every(Number.isFinite)).toBe(true);
  });
  it("reduces collinear columns and is invariant to response scaling", () => {
    const xx = x.map((r) => [r[0]!, r[1]!, r[0]! + r[1]!]);
    const r = cancor(xx, y, { xNames: ["x1", "x2", "x3"] });
    expect(r.xcoef.rows).toHaveLength(2);
    const scaled = cancor(x.map((r) => r.map((v) => v * 1e100)), y.map((r) => r.map((v) => v * 1e-100)));
    const scaledFirst = scaled.cor[0]!;
    const baseCor = cancor(x, y).cor;
    const baseFirst = Array.isArray(baseCor) ? baseCor[0]! : baseCor;
    expect(scaledFirst).toBeCloseTo(baseFirst, 10);
  });
  it("rejects non-finite inputs", () => {
    expect(() => cancor([[1], [NaN]], [[2], [3]])).toThrow(/NA\/NaN\/Inf/);
  });
  it("handles 100,000 rows", () => {
    const xx = Array.from({ length: 100_000 }, (_, i) => [Math.sin(i * 0.01), Math.cos(i * 0.013)]);
    const yy = xx.map((r, i) => [r[0]! + 0.2 * r[1]! + Math.sin(i * 0.07), r[1]! - 0.1 * r[0]! + Math.cos(i * 0.05)]);
    const start = performance.now();
    const r = cancor(xx, yy);
    expect((r.cor).every(Number.isFinite)).toBe(true);
    console.info(`cancor 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
