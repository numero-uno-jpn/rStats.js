import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cancor } from "../src/entries/multivariate.js";

function cross(a: number[][]): number[][] {
  return a[0]!.map((_, i) => a[0]!.map((__, j) => a.reduce((s, r) => s + r[i]! * r[j]!, 0)));
}

const irisRows = JSON.parse(readFileSync(new URL("./fixtures/iris.json", import.meta.url), "utf8")) as [number, number, number, number, string][];
const cancorFixture = JSON.parse(readFileSync(new URL("./fixtures/cancor.json", import.meta.url), "utf8")) as Record<string, any>;
const mtRows = JSON.parse(readFileSync(new URL("./fixtures/mtcars.json", import.meta.url), "utf8")) as number[][];
function compareCancor(actual: ReturnType<typeof cancor>, expected: any): void {
  const cor = Array.isArray(actual.cor) ? actual.cor : [actual.cor];
  const expectedCor = Array.isArray(expected.cor) ? expected.cor : [expected.cor];
  expect(cor.length).toBe(expectedCor.length);
  expectedCor.forEach((v: number, i: number) => expect(cor[i]).toBeCloseTo(v, 8));
  const xc = Array.isArray(actual.xcenter) ? actual.xcenter : [actual.xcenter];
  const yc = Array.isArray(actual.ycenter) ? actual.ycenter : [actual.ycenter];
  const xce = Array.isArray(expected.xcenter) ? expected.xcenter : [expected.xcenter];
  const yce = Array.isArray(expected.ycenter) ? expected.ycenter : [expected.ycenter];
  xce.forEach((v: number, i: number) => expect(xc[i]).toBeCloseTo(v, 9));
  yce.forEach((v: number, i: number) => expect(yc[i]).toBeCloseTo(v, 9));
  expect(actual.xcoef.rows).toEqual(expected.xcoef.rows);
  expect(actual.ycoef.rows).toEqual(expected.ycoef.rows);
  expect(actual.xcoef.cols).toBe(expected.xcoef.cols);
  expect(actual.ycoef.cols).toBe(expected.ycoef.cols);
  const sx = expected.xcoef.values[0]!.map((_: number, j: number) => {
    const dot = actual.xcoef.values.reduce((s, row, i) => s + row[j]! * expected.xcoef.values[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  const sy = expected.ycoef.values[0]!.map((_: number, j: number) => {
    if (j < cor.length) return sx[j]!;
    const dot = actual.ycoef.values.reduce((s, row, i) => s + row[j]! * expected.ycoef.values[i]![j]!, 0);
    return dot < 0 ? -1 : 1;
  });
  expectMatrixClose(actual.xcoef.values.map((row) => row.map((v, j) => v * sx[j]!)), expected.xcoef.values, 1e-8);
  expectMatrixClose(actual.ycoef.values.map((row) => row.map((v, j) => v * sy[j]!)), expected.ycoef.values, 1e-8);
}

function expectMatrixClose(actual: number[][], expected: number[][], tol = 1e-8): void {
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
    const cor = Array.isArray(actual.cor) ? actual.cor : [actual.cor];
    expect(cor).toHaveLength(expected.cor.length);
    expected.cor.forEach((v: number, i: number) => expect(cor[i]).toBeCloseTo(v, 8));
    const xc = Array.isArray(actual.xcenter) ? actual.xcenter : [actual.xcenter];
    const yc = Array.isArray(actual.ycenter) ? actual.ycenter : [actual.ycenter];
    expected.xcenter.forEach((v: number, i: number) => expect(xc[i]).toBeCloseTo(v, 10));
    expected.ycenter.forEach((v: number, i: number) => expect(yc[i]).toBeCloseTo(v, 10));
    expect(actual.xcoef.rows).toEqual(expected.xcoef.rows);
    expect(actual.ycoef.rows).toEqual(expected.ycoef.rows);
    const signs = expected.cor.map((_: number, j: number) => {
      const dot = actual.xcoef.values.reduce((s, row, i) => s + row[j]! * expected.xcoef.values[i]![j]!, 0);
      return dot < 0 ? -1 : 1;
    });
    expectMatrixClose(actual.xcoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.xcoef.values, 1e-8);
    expectMatrixClose(actual.ycoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.ycoef.values, 1e-8);
  });

  it("matches the remaining mtcars canonical-correlation fixtures", () => {
    const col = (j: number) => mtRows.map((r) => r[j]!);
    const cases = [
      ["cancor_one_x", col(5).map((v) => [v]), [col(0), col(3), col(6)], ["wt"], ["mpg", "hp", "qsec"]],
      ["cancor_more_x_than_y", mtRows.map((r) => [r[5]!, r[2]!, r[4]!, r[6]!]), mtRows.map((r) => [r[0]!, r[3]!]), ["wt", "disp", "drat", "qsec"], ["mpg", "hp"]],
      ["cancor_collinear", mtRows.map((r) => [r[5]!, r[2]!, r[5]! + r[2]!]), mtRows.map((r) => [r[0]!, r[3]!]), ["a", "b", "c"], ["mpg", "hp"]],
      ["cancor_n_small", mtRows.slice(0, 4).map((r) => [r[5]!, r[2]!, r[4]!]), mtRows.slice(0, 4).map((r) => [r[0]!, r[3]!]), ["wt", "disp", "drat"], ["mpg", "hp"]],
    ] as const;
    for (const [key, x, y, xNames, yNames] of cases) {
      compareCancor(cancor(x, y, { xNames, yNames }), cancorFixture[key].value);
    }
    compareCancor(cancor(col(5), col(0)), cancorFixture.cancor_vectors.value);
  });

  it("returns nonzero canonical pairs with cross-product normalisation", () => {
    const r = cancor(x, y, { xNames: ["a", "b"], yNames: ["c", "d"] });
    expect(Array.isArray(r.cor) ? r.cor : [r.cor]).toHaveLength(2);
    expect(r.xcoef.rows).toEqual(["a", "b"]);
    expect(r.ycoef.rows).toEqual(["c", "d"]);
    const xcenter = Array.isArray(r.xcenter) ? r.xcenter : [r.xcenter];
    const ycenter = Array.isArray(r.ycenter) ? r.ycenter : [r.ycenter];
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
    expect(Number.isFinite(r.cor)).toBe(true);
  });
  it("reduces collinear columns and is invariant to response scaling", () => {
    const xx = x.map((r) => [r[0]!, r[1]!, r[0]! + r[1]!]);
    const r = cancor(xx, y);
    expect(r.xcoef.rows).toHaveLength(2);
    const scaled = cancor(x.map((r) => r.map((v) => v * 1e100)), y.map((r) => r.map((v) => v * 1e-100)));
    const scaledFirst = Array.isArray(scaled.cor) ? scaled.cor[0]! : scaled.cor;
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
    expect((Array.isArray(r.cor) ? r.cor : [r.cor]).every(Number.isFinite)).toBe(true);
    console.info(`cancor 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
