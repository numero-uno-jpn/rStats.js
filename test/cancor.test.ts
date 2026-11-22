import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cancor } from "../src/entries/multivariate.js";

function cross(a: number[][]): number[][] {
  return a[0]!.map((_, i) => a[0]!.map((__, j) => a.reduce((s, r) => s + r[i]! * r[j]!, 0)));
}

const irisRows = JSON.parse(readFileSync(new URL("./fixtures/iris.json", import.meta.url), "utf8")) as [number, number, number, number, string][];
const cancorFixture = JSON.parse(readFileSync(new URL("./fixtures/cancor.json", import.meta.url), "utf8")) as Record<string, any>;
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
    const x = irisRows.map((r) => r.slice(0, 2));
    const y = irisRows.map((r) => r.slice(2, 4));
    const expected = cancorFixture.cancor_iris.value;
    const actual = cancor(x, y, {
      xNames: ["Sepal.Length", "Sepal.Width"],
      yNames: ["Petal.Length", "Petal.Width"],
    });
    const cor = Array.isArray(actual.cor) ? actual.cor : [actual.cor];
    expect(cor).toHaveLength(expected.cor.length);
    expected.cor.forEach((v: number, i: number) => expect(cor[i]).toBeCloseTo(v, 8));
    expect(actual.xcenter).toEqual(expected.xcenter);
    expect(actual.ycenter).toEqual(expected.ycenter);
    expect(actual.xcoef.rows).toEqual(expected.xcoef.rows);
    expect(actual.ycoef.rows).toEqual(expected.ycoef.rows);
    const signs = expected.cor.map((_: number, j: number) => {
      const dot = actual.xcoef.values.reduce((s, row, i) => s + row[j]! * expected.xcoef.values[i]![j]!, 0);
      return dot < 0 ? -1 : 1;
    });
    expectMatrixClose(actual.xcoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.xcoef.values, 1e-8);
    expectMatrixClose(actual.ycoef.values.map((row) => row.map((v, j) => v * signs[j]!)), expected.ycoef.values, 1e-8);
  });

  it("returns nonzero canonical pairs with cross-product normalisation", () => {
    const r = cancor(x, y, { xNames: ["a", "b"], yNames: ["c", "d"] });
    expect(r.cor).toHaveLength(2);
    expect(r.xcoef.rows).toEqual(["a", "b"]);
    expect(r.ycoef.rows).toEqual(["c", "d"]);
    const xc = x.map((row) => row.map((v, j) => v - r.xcenter[j]!));
    const yc = y.map((row) => row.map((v, j) => v - r.ycenter[j]!));
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
    expect(r.cor.every(Number.isFinite)).toBe(true);
    console.info(`cancor 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
