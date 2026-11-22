import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tamhaneT2Test } from "../src/entries/tests.js";

type FixtureValue = {
  method: string;
  statistic: { rows: string[]; cols: string[]; values: (number | string)[][] };
  "p.value": { rows: string[]; cols: string[]; values: (number | string)[][] };
  "p.adjust.method": string;
};
const fixture = JSON.parse(readFileSync(new URL("./fixtures/tamhane.json", import.meta.url), "utf8")) as Record<
  string,
  { value?: FixtureValue; error?: string }
>;

const plant = {
  x: [
    4.17, 5.58, 5.18, 6.11, 4.5, 4.61, 5.17, 4.53, 5.33, 5.14,
    4.81, 4.17, 4.41, 3.59, 5.87, 3.83, 6.03, 4.89, 4.32, 4.69,
    6.31, 5.12, 5.54, 5.5, 5.37, 5.29, 4.92, 6.15, 5.8, 5.26,
  ],
  g: [
    ..."ctrl ctrl ctrl ctrl ctrl ctrl ctrl ctrl ctrl ctrl trt1 trt1 trt1 trt1 trt1 trt1 trt1 trt1 trt1 trt1 trt2 trt2 trt2 trt2 trt2 trt2 trt2 trt2 trt2 trt2".split(" "),
  ],
};

function fixtureNumber(v: number | string): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}

function compareFixture(key: string, welch: boolean): void {
  const expected = fixture[key]!.value!;
  const actual = tamhaneT2Test(plant.x, plant.g, { welch });
  const mismatches: string[] = [];
  const checkString = (field: string, a: unknown, e: unknown): void => {
    if (JSON.stringify(a) !== JSON.stringify(e)) mismatches.push(`${field}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
  };
  const checkMatrix = (field: string, got: number[][], exp: (number | string)[][]): void => {
    checkString(`${field}.rows`, actual.rowNames, expected.statistic.rows);
    checkString(`${field}.cols`, actual.colNames, expected.statistic.cols);
    if (got.length !== exp.length) {
      mismatches.push(`${field}.rows length: expected ${exp.length}, got ${got.length}`);
      return;
    }
    for (let i = 0; i < exp.length; i++) {
      if (got[i]!.length !== exp[i]!.length) {
        mismatches.push(`${field}[${i}] length: expected ${exp[i]!.length}, got ${got[i]!.length}`);
        continue;
      }
      for (let j = 0; j < exp[i]!.length; j++) {
        const want = fixtureNumber(exp[i]![j]!);
        const value = got[i]![j]!;
        const ok = Number.isNaN(want) ? Number.isNaN(value) : want === value || (Number.isFinite(want) && Number.isFinite(value) && Math.abs(value - want) <= 1e-12 * Math.abs(want));
        if (!ok) mismatches.push(`${field}[${i},${j}]: expected ${want}, got ${value}`);
      }
    }
  };
  checkString("method", actual.method, expected.method);
  checkString("pAdjustMethod", actual.pAdjustMethod, expected["p.adjust.method"]);
  checkString("warnings", actual.warnings, []);
  checkMatrix("statistic", actual.statistic, expected.statistic.values);
  checkMatrix("pValue", actual.pValue, expected["p.value"].values);
  expect(mismatches, `${key}: ${mismatches.join("; ")}`).toEqual([]);
}

describe("tamhaneT2Test", () => {
  it("matches every element of the PlantGrowth T2 fixture", () => compareFixture("t2_PlantGrowth_welch", true));
  it("matches every element of the PlantGrowth T2' fixture", () => compareFixture("t2_PlantGrowth_T2prime", false));

  it("uses R factor level order and supports list input", () => {
    const r = tamhaneT2Test([[1, 2, 3], [5, 6, 7]]);
    expect(r.rowNames).toEqual(["2"]);
    expect(r.colNames).toEqual(["1"]);
    const q = tamhaneT2Test([1, 2, 3, 5, 6, 7], ["z", "z", "z", "a", "a", "a"]);
    expect(q.rowNames).toEqual(["z"]);
    expect(q.colNames).toEqual(["a"]);
  });

  it("uses a scale-normalised Welch df at 1e±100 and after translation", () => {
    const base = tamhaneT2Test(plant.x, plant.g);
    for (const scale of [1e100, 1e-100]) {
      const scaled = tamhaneT2Test(plant.x.map((v) => v * scale), plant.g);
      expect(scaled.statistic[0]![0]).toBeCloseTo(base.statistic[0]![0]!, 12);
      expect(scaled.pValue[0]![0]).toBeCloseTo(base.pValue[0]![0]!, 12);
    }
    const shifted = tamhaneT2Test(plant.x.map((v) => v + 1e8), plant.g);
    expect(shifted.statistic[0]![0]).toBeCloseTo(base.statistic[0]![0]!, 7);
  });

  it("returns NaN for comparisons with a singleton or two constant equal groups", () => {
    const singleton = tamhaneT2Test([1, 2, 3, 10, 11, 12, 5], [1, 1, 1, 2, 2, 2, 3]);
    expect(Number.isNaN(singleton.statistic[1]![0]!)).toBe(true);
    const constant = tamhaneT2Test([2, 2, 2, 2, 2, 2], [1, 1, 2, 2, 3, 3]);
    expect(Number.isNaN(constant.statistic[0]![0]!)).toBe(true);
    expect(Number.isNaN(constant.pValue[0]![0]!)).toBe(true);
  });

  it("handles 100,000 observations without argument spreading", () => {
    const x = Array.from({ length: 100_000 }, (_, i) => (i < 50_000 ? i % 17 : 10 + (i % 19)));
    const g = Array.from({ length: 100_000 }, (_, i) => (i < 50_000 ? "first" : "second"));
    const start = performance.now();
    const r = tamhaneT2Test(x, g);
    const elapsed = performance.now() - start;
    expect(Number.isFinite(r.statistic[0]![0]!)).toBe(true);
    expect(Number.isFinite(r.pValue[0]![0]!)).toBe(true);
    console.info(`tamhaneT2Test 100,000 rows: ${elapsed.toFixed(1)} ms`);
  });
});
