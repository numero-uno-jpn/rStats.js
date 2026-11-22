import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, dist, type DistResult } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/dist.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxRelativeError = 0;
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const na = small.map((r) => [...r]); na[1]![0] = NaN; na[3]![2] = NaN;
const allna = small.map((r) => [...r]); allna[1] = [NaN, NaN, NaN];
const nan = small.map((r) => [...r]); nan[2]![1] = NaN;
const inf = small.map((r) => [...r]); inf[0]![0] = Infinity; inf[2]![0] = -Infinity;
const infBoth = small.map((r) => [...r]); infBoth[0]![0] = Infinity; infBoth[1]![0] = Infinity;
const canberraZeros = [[0, 0, 1], [0, 0, 2], [1, -1, 3], [-1, 1, 0]];
// Exact R input: [[0,0,0,1],[0,2,0,0],[0,3,3,0],[0,0,0,0]]
const binaryZeros = [[0, 0, 0, 1], [0, 2, 0, 0], [0, 3, 3, 0], [0, 0, 0, 0]];
const us = {
  Murder: [13.2, 10.0, 8.1, 8.8, 9.0, 7.9],
  Assault: [236, 263, 294, 190, 276, 204],
  UrbanPop: [58, 48, 80, 50, 91, 78],
  Rape: [21.2, 44.5, 31.0, 19.5, 40.6, 38.7],
};
const labels = ["a", "b", "c", "d", "e"];
const POW_CASES = new Set(["dist_minkowski_p3", "dist_minkowski_p05"]);
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function mismatch(label: string, actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) mismatches.push(`${label}: actual=${String(actual)}, expected=${String(expected)}`);
}
function compare(key: string, actual: DistResult): void {
  const expected = fixture[key];
  if (!expected || !expected.value) { mismatches.push(`${key}: fixture value missing`); return; }
  mismatch(key + ".size", actual.size, expected.value.size);
  const expectedLabels = expected.value.labels === null ? null :
    Array.isArray(expected.value.labels) ? expected.value.labels : [expected.value.labels];
  if (JSON.stringify(actual.labels) !== JSON.stringify(expectedLabels)) {
    mismatches.push(`${key}.labels: actual=${JSON.stringify(actual.labels)}, expected=${JSON.stringify(expectedLabels)}`);
  }
  mismatch(key + ".method", actual.method, expected.value.method);
  mismatch(key + ".diag", actual.diag, expected.value.diag);
  mismatch(key + ".upper", actual.upper, expected.value.upper);
  const values = Array.isArray(expected.value.values) ? expected.value.values : [expected.value.values];
  if (actual.values.length !== values.length) mismatches.push(`${key}.length: actual=${actual.values.length}, expected=${values.length}`);
  for (let i = 0; i < Math.min(actual.values.length, values.length); i++) {
    const e = num(values[i]), a = actual.values[i]!;
    if (!Object.is(a, e)) {
      const rel = Number.isFinite(a) && Number.isFinite(e) ? Math.abs(a - e) / Math.max(Math.abs(e), 1e-300) : NaN;
      if (Number.isFinite(rel)) maxRelativeError = Math.max(maxRelativeError, rel);
      // Minkowski with p other than 1 and 2 uses pow, which is not correctly rounded in R's C library nor in JS, and
      // its last bit differs between platforms (CI's x86_64 Linux and arm64 macOS): 4 ulps allowed there only
      if (POW_CASES.has(key) && rel <= 4 * Number.EPSILON) continue;
      mismatches.push(`${key}[${i}]: actual=${String(a)}, expected=${String(e)}, relativeError=${String(rel)}`);
    }
  }
  const warnings = expected.warnings === undefined ? [] : Array.isArray(expected.warnings) ? expected.warnings : [expected.warnings];
  if (JSON.stringify(actual.warnings) !== JSON.stringify(warnings)) {
    mismatches.push(`${key}.warnings: actual=${JSON.stringify(actual.warnings)}, expected=${JSON.stringify(warnings)}`);
  }
}
function compareError(key: string, action: () => unknown): void {
  const expected = fixture[key]?.error;
  try { action(); mismatches.push(`${key}: expected error ${String(expected)}`); }
  catch { if (!expected) mismatches.push(`${key}: unexpected error`); }
}

describe("dist and asDist", () => {
  it("matches every ordinary R distance fixture bit-for-bit", () => {
    const methods = ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"] as const;
    for (const method of methods) compare("dist_" + method, dist(small, { method, labels }));
    compare("dist_minkowski_p3", dist(small, { method: "minkowski", p: 3, labels }));
    compare("dist_minkowski_p05", dist(small, { method: "minkowski", p: 0.5, labels }));
    compare("dist_minkowski_p1", dist(small, { method: "minkowski", p: 1, labels }));
    compareError("dist_minkowski_pInf", () => dist(small, { method: "minkowski", p: Infinity }));
    compareError("dist_minkowski_p0", () => dist(small, { method: "minkowski", p: 0 }));
    compare("dist_partial_name", dist(small, { method: "max", labels }));
    compareError("dist_bad_method", () => dist(small, { method: "cosine" }));
    compare("dist_diag_upper", dist(small, { diag: true, upper: true, labels }));
    compare("dist_no_names", dist(small));
    compare("dist_one_row", dist([small[0]!], { labels: ["a"] }));
    compare("dist_vector", dist([3, 1, 4, 1, 5]));
    compare("dist_data_frame", dist(us, { labels: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado"] }));
  });

  it("matches every missing, non-finite, Canberra and binary R fixture bit-for-bit", () => {
    for (const method of ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"] as const) {
      compare("dist_na_" + method, dist(na, { method, labels }));
      compare("dist_all_na_row_" + method, dist(allna, { method, labels }));
      compare("dist_inf_" + method, dist(inf, { method, labels }));
      compare("dist_inf_both_" + method, dist(infBoth, { method, labels }));
    }
    compare("dist_nan", dist(nan, { labels }));
    compare("dist_canberra_zeros", dist(canberraZeros, { method: "canberra" }));
    compare("dist_canberra_all_zero", dist([[0, 0], [0, 0], [0, 0]], { method: "canberra" }));
    compare("dist_binary_zero_rows", dist(binaryZeros, { method: "binary" }));
    compare("dist_binary_both_zero", dist([[0, 0, 0], [0, 0, 0], [1, 0, 0]], { method: "binary" }));
    compare("dist_binary_logical", dist([[true, true], [false, false], [true, false]], { method: "binary" }));
    compare("dist_character", dist([["a", "c"], ["b", "d"]]));
  });

  it("matches as.dist conversion and identity semantics", () => {
    const lower = [[0, 9, 9], [1, 0, 9], [2, 3, 0]];
    const upper = [[0, 1, 2], [9, 0, 3], [9, 9, 0]];
    compare("as_dist", asDist(lower));
    compare("as_dist_upper_used", asDist(upper));
    const d = dist(small);
    if (asDist(d) !== d) mismatches.push("asDist identity did not preserve the input object");
    if (JSON.stringify(asDist(lower, { labels: ["a", "b", "c"] }).labels) !== JSON.stringify(["a", "b", "c"])) {
      mismatches.push("asDist explicit labels");
    }
    // not an R case (R has no such fixture): a ragged matrix is rejected
    try { asDist([[0, 1], [2]]); mismatches.push("asDist ragged matrix: expected an error"); } catch { /* expected */ }
  });

  it("uses R's arithmetic for ordinary values and a scaled fallback only at extremes", () => {
    const base = dist(small);
    const large100 = dist(small.map((r) => r.map((v) => v * 1e100)));
    const tiny100 = dist(small.map((r) => r.map((v) => v * 1e-100)));
    const shifted = dist(small.map((r) => r.map((v) => v + 1e8)));
    for (let i = 0; i < base.values.length; i++) {
      expect(large100.values[i]! / 1e100).toBeCloseTo(base.values[i]!, 12);
      expect(tiny100.values[i]! / 1e-100).toBeCloseTo(base.values[i]!, 12);
      expect(shifted.values[i]).toBe(base.values[i]);
    }
    const large = dist(small.map((r) => r.map((v) => v * 1e200)));
    const tiny = dist(small.map((r) => r.map((v) => v * 1e-200)));
    for (let i = 0; i < base.values.length; i++) {
      expect(large.values[i]! / 1e200).toBeCloseTo(base.values[i]!, 12);
      expect(tiny.values[i]! / 1e-200).toBeCloseTo(base.values[i]!, 12);
    }
  });

  it("handles 5,000 observations and reports the quadratic workload time", () => {
    const n = 5_000;
    const rows = Array.from({ length: n }, (_, i) => [i % 127, Math.sin(i * 0.01)]);
    const start = performance.now();
    const result = dist(rows);
    const elapsed = performance.now() - start;
    expect(result.values).toHaveLength(n * (n - 1) / 2);
    expect(result.values.every(Number.isFinite)).toBe(true);
    console.info(`dist 5,000 rows (12.5 million distances): ${elapsed.toFixed(1)} ms`);
  });

  it("checks every comparable fixture and requires bitwise identity", () => {
    const compared = new Set([
      "dist_euclidean","dist_maximum","dist_manhattan","dist_canberra","dist_binary","dist_minkowski",
      "dist_minkowski_p3","dist_minkowski_p05","dist_minkowski_p1","dist_minkowski_pInf","dist_minkowski_p0",
      "dist_partial_name","dist_bad_method","dist_diag_upper","dist_no_names","dist_one_row","dist_vector","dist_data_frame",
      ...["euclidean","maximum","manhattan","canberra","binary","minkowski"].flatMap((m) =>
        ["dist_na_","dist_all_na_row_","dist_inf_","dist_inf_both_"].map((p) => p + m)),
      "dist_nan","dist_canberra_zeros","dist_canberra_all_zero","dist_binary_zero_rows","dist_binary_both_zero",
      "dist_binary_logical","dist_character","as_dist","as_dist_upper_used",
    ]);
    const expectedCount = Object.keys(fixture).length;
    if (compared.size !== expectedCount - 2) mismatches.push(`fixture coverage: compared ${compared.size} of ${expectedCount - 2} comparable cases`);
    console.info(`dist fixtures: ${compared.size} comparable cases; maximum relative error among mismatches ${maxRelativeError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });
});
