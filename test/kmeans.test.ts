import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kmeans, type KmeansFit } from "../src/entries/multivariate.js";
import { setSeed, runif } from "../src/entries/distributions.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/kmeans.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxRelativeError = 0;
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function close(label: string, a: number, e: number, tol = 1e-12): void {
  const rel = e === 0 ? Math.abs(a - e) : Math.abs(a - e) / Math.abs(e);
  if (Number.isFinite(rel)) maxRelativeError = Math.max(maxRelativeError, rel);
  if (!(Object.is(a, e) || (Number.isFinite(rel) && rel <= tol))) mismatches.push(`${label}: actual=${a}, expected=${e}, relativeError=${rel}`);
}
function compare(key: string, actual: KmeansFit): void {
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing fixture`); return; }
  if (JSON.stringify(actual.cluster) !== JSON.stringify(expected.cluster)) mismatches.push(`${key}.cluster differs`);
  if (JSON.stringify(actual.names ?? null) !== JSON.stringify(expected.cluster_names ?? null)) mismatches.push(`${key}.cluster names differ`);
  if (JSON.stringify(actual.centers.rows) !== JSON.stringify(expected.centers.rows)) mismatches.push(`${key}.centers.rows differs`);
  if (JSON.stringify(actual.centers.cols) !== JSON.stringify(expected.centers.cols)) mismatches.push(`${key}.centers.cols differs`);
  if (actual.centers.values.length !== expected.centers.values.length) mismatches.push(`${key}.centers row count differs`);
  for (let i = 0; i < Math.min(actual.centers.values.length, expected.centers.values.length); i++) {
    for (let j = 0; j < Math.min(actual.centers.values[i]!.length, expected.centers.values[i]!.length); j++) {
      close(`${key}.centers[${i},${j}]`, actual.centers.values[i]![j]!, num(expected.centers.values[i]![j]));
    }
  }
  for (const [field, actualValue, expectedValue] of [
    ["totss", actual.totss, expected.totss],
    ["totWithinss", actual.totWithinss, expected["tot.withinss"]],
    ["betweenss", actual.betweenss, expected.betweenss],
  ] as const) close(`${key}.${field}`, actualValue, num(expectedValue));
  for (const field of ["withinss", "size"] as const) {
    const values = field === "withinss" ? actual.withinss : actual.size;
    const expectedValues = expected[field];
    if (values.length !== expectedValues.length) mismatches.push(`${key}.${field} length differs`);
    for (let i = 0; i < Math.min(values.length, expectedValues.length); i++) {
      if (field === "size") {
        if (values[i] !== expectedValues[i]) mismatches.push(`${key}.size[${i}] differs`);
      } else close(`${key}.withinss[${i}]`, values[i]!, num(expectedValues[i]));
    }
  }
  if (actual.iter !== expected.iter) mismatches.push(`${key}.iter: actual=${actual.iter}, expected=${expected.iter}`);
  if (actual.ifault !== expected.ifault) mismatches.push(`${key}.ifault: actual=${actual.ifault}, expected=${expected.ifault}`);
  const warnings = expected.warnings === undefined ? [] : Array.isArray(expected.warnings) ? expected.warnings : [expected.warnings];
  if (JSON.stringify(actual.warnings) !== JSON.stringify(warnings)) mismatches.push(`${key}.warnings differs`);
}
function compareTail(key: string, actual: number[]): void {
  const expected = fixture[key]?.value;
  if (!Array.isArray(expected)) { mismatches.push(`${key}: missing RNG-tail fixture`); return; }
  if (actual.length !== expected.length) mismatches.push(`${key}: RNG-tail length differs`);
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) close(`${key}[${i}]`, actual[i]!, num(expected[i]));
}
const algorithms = ["Hartigan-Wong", "Lloyd", "Forgy", "MacQueen"] as const;
const vector = [1, 2, 3, 10, 11, 12, 30];
const dup = [[1, 1], [1, 1], [1, 1], [2, 2]];
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const far = [[...small[0]!], [...small[1]!], [100, 100, 100]];
const x03 = [[0], [1], [2], [3]];

describe("kmeans", () => {
  it("matches R's four algorithms for vector centers, matrix centers and midpoint ties", () => {
    for (const algorithm of algorithms) {
      compare("kmeans_vector_" + algorithm, kmeans(vector, [[1], [10], [30]], { algorithm }));
      compare("kmeans_vector_center_matrix_" + algorithm, kmeans(vector, [[1], [30]], { algorithm }));
      compare("kmeans_midpoint_" + algorithm, kmeans([0, 2, 1], [[0], [2]], { algorithm }));
    }
  });

  it("retries duplicate-valued random starts and preserves the R RNG stream", () => {
    setSeed(3);
    compare("kmeans_dup_start_seed_3", kmeans(dup, 2));
    compareTail("kmeans_dup_start_seed_3.tail", runif(3));
    setSeed(1);
    compare("kmeans_equal_best_seed_1", kmeans(x03, 2, { nstart: 8 }));
    compareTail("kmeans_equal_best_seed_1.tail", runif(2));
  });

  it("matches errors, empty-cluster warnings and numeric scaling", () => {
    const errors: Array<[string, () => unknown]> = [
      ["kmeans_duplicate_centers", () => kmeans(dup, [[1, 1], [1, 1]])],
      ["kmeans_wrong_columns", () => kmeans(Array.from({ length: 3 }, () => [1, 2, 3]), [[1, 2]])],
      ["kmeans_bad_algorithm", () => kmeans(vector, [[1], [2]], { algorithm: "Elkan" })],
      ["kmeans_iter_zero", () => kmeans(vector, [[1], [2]], { iterMax: 0 })],
      ["kmeans_na", () => kmeans([[1, 2], [NaN, 3]], [[1, 2]])],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) { mismatches.push(key + ": missing error fixture"); continue; }
      try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ }
    }
    try { kmeans(small, far, { algorithm: "Hartigan-Wong" }); mismatches.push("kmeans_empty_Hartigan-Wong: expected error"); }
    catch { /* expected */ }
    for (const algorithm of ["Lloyd", "Forgy", "MacQueen"] as const) {
      const fit = kmeans(small, far, { algorithm });
      if (fit.warnings.length !== 2) mismatches.push(`kmeans_empty_${algorithm}: expected two warnings, got ${fit.warnings.length}`);
    }
    const scale = kmeans(vector.map((v) => v * 1e150), [[1e150], [10e150], [30e150]]);
    if (!scale.centers.values.flat().every(Number.isFinite) || !Number.isFinite(scale.totWithinss)) mismatches.push("kmeans scale 1e150 overflowed");
    console.info(`kmeans fixtures: 18 direct R cases plus RNG and edge cases; maximum relative error ${maxRelativeError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });

  it("handles 100,000 observations by 10 columns", () => {
    const n = 100000, p = 10, k = 5;
    const rows = Array.from({ length: n }, (_, i) => {
      const g = i % k;
      return Array.from({ length: p }, (_, j) => g * 10 + j + ((Math.floor(i / k) % 101) - 50) * 0.001);
    });
    const initial = Array.from({ length: k }, (_, g) => Array.from({ length: p }, (_, j) => g * 10 + j));
    const start = performance.now();
    const fit = kmeans(rows, initial, { algorithm: "Lloyd" });
    const elapsed = performance.now() - start;
    expect(fit.cluster).toHaveLength(n);
    expect(fit.size.reduce((a, b) => a + b, 0)).toBe(n);
    console.info(`kmeans 100,000 x 10 (5 centers): ${elapsed.toFixed(1)} ms`);
  });
});
