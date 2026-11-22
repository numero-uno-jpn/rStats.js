import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, cmdscale, dist, type CmdscaleResult } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/cmdscale.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxRelativeError = 0;
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function compareNumbers(label: string, actual: number[], expectedRaw: unknown, tol = 1e-12): void {
  const expected = Array.isArray(expectedRaw) ? expectedRaw.map(num) : [num(expectedRaw)];
  if (actual.length !== expected.length) mismatches.push(`${label}: length ${actual.length} != ${expected.length}`);
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
    const e = expected[i]!, a = actual[i]!;
    const rel = e === 0 ? Math.abs(a - e) : Math.abs(a - e) / Math.abs(e);
    if (Number.isFinite(rel)) maxRelativeError = Math.max(maxRelativeError, rel);
    if (!(Object.is(a, e) || (Number.isFinite(rel) && rel <= tol))) mismatches.push(`${label}[${i}]: actual=${a}, expected=${e}, relativeError=${rel}`);
  }
}
function tableValues(v: any): number[][] {
  return Array.isArray(v) ? v : v?.values ?? [];
}
function compare(key: string, actual: CmdscaleResult, scale = 1): void {
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing fixture`); return; }
  const points = tableValues(expected.points);
  if (actual.points.values.length !== points.length) mismatches.push(`${key}.points rows differ`);
  if (JSON.stringify(actual.points.rows) !== JSON.stringify(expected.points.rows ?? null)) mismatches.push(`${key}.points.rows differ`);
  if (JSON.stringify(actual.points.cols) !== JSON.stringify(expected.points.cols ?? null)) mismatches.push(`${key}.points.cols differ`);
  const cols = points[0]?.length ?? 0;
  for (let j = 0; j < cols; j++) {
    let dot = 0;
    for (let i = 0; i < Math.min(actual.points.values.length, points.length); i++) dot += actual.points.values[i]![j]! * num(points[i]![j]);
    if (dot < 0) for (const row of actual.points.values) row[j] = -row[j]!;
  }
  for (let i = 0; i < Math.min(actual.points.values.length, points.length); i++) {
    if (actual.points.values[i]!.length !== points[i]!.length) mismatches.push(`${key}.points[${i}] columns differ`);
    for (let j = 0; j < Math.min(actual.points.values[i]!.length, points[i]!.length); j++) {
      compareNumbers(`${key}.points[${i},${j}]`, [actual.points.values[i]![j]!], points[i]![j], 1e-12);
    }
  }
  if (expected.eig !== undefined) compareNumbers(key + ".eig", actual.eig, expected.eig);
  if (expected.ac !== undefined) compareNumbers(key + ".ac", [actual.ac], expected.ac, 1e-10);
  if (expected.GOF !== undefined) compareNumbers(key + ".GOF", actual.GOF, expected.GOF);
  if (expected.x !== undefined && expected.x !== null) {
    const x = tableValues(expected.x);
    if (actual.x === null) mismatches.push(`${key}.x unexpectedly null`);
    if (actual.x !== null && (JSON.stringify(actual.x.rows) !== JSON.stringify(expected.x.rows ?? null) || JSON.stringify(actual.x.cols) !== JSON.stringify(expected.x.cols ?? null))) mismatches.push(`${key}.x labels differ`);
    for (let i = 0; i < x.length; i++) for (let j = 0; j < x[i]!.length; j++) {
      compareNumbers(`${key}.x[${i},${j}]`, [actual.x?.values[i]?.[j] ?? NaN], x[i]![j], 1e-12);
    }
  }
  const warnings = expected.warnings === undefined ? [] : Array.isArray(expected.warnings) ? expected.warnings : [expected.warnings];
  if (JSON.stringify(actual.warnings) !== JSON.stringify(warnings)) mismatches.push(`${key}.warnings differs`);
}
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const ds = dist(small);
const nonE = [[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]];
const line = dist([0, 1, 3, 6]);
const simplex = asDist(Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 0 : 1)));
const zero = dist([1, 1, 2, 5]);
const asymmetric = [[0, 3, 5], [1, 0, 6], [2, 4, 0]];

describe("cmdscale", () => {
  it("matches R coordinates, eigenvalues and goodness-of-fit on Euclidean and non-Euclidean inputs", () => {
    for (let k = 1; k <= 4; k++) compare("cmdscale_small_k" + k, cmdscale(ds, { k }));
    compare("cmdscale_non_euclidean", cmdscale(asDist(nonE), { k: 2 }));
    compare("cmdscale_non_euclidean_k3", cmdscale(asDist(nonE), { k: 3 }));
    compare("cmdscale_line_k1", cmdscale(line, { k: 1 }));
    compare("cmdscale_line_k2", cmdscale(line, { k: 2 }));
    compare("cmdscale_simplex", cmdscale(simplex, { k: 2 }));
    compare("cmdscale_zero_distances", cmdscale(zero, { k: 1 }));
    compare("cmdscale_asymmetric", cmdscale(asymmetric, { k: 2 }));
  });

  it("computes Cailliez's constant and returns x only when requested", () => {
    compare("cmdscale_small_add", cmdscale(ds, { k: 2, add: true }));
    compare("cmdscale_non_euclidean_add", cmdscale(asDist(nonE), { k: 3, add: true }));
    compare("cmdscale_line_add", cmdscale(line, { k: 1, add: true }));
    const withX = cmdscale(ds, { k: 2, xRet: true });
    if (withX.x === null || withX.x.values.length !== 5 || withX.x.values[0]!.length !== 5) mismatches.push("xRet did not return the centered squared-distance matrix");
    if (cmdscale(ds, { k: 2 }).x !== null) mismatches.push("x should be null when xRet is false");
    expect(mismatches).toEqual([]);
  });

  it("matches scale equivariance, labels, warnings and input errors", () => {
    const base = cmdscale(ds, { k: 2 });
    const large = cmdscale({ ...ds, values: ds.values.map((v) => v * 1e150) }, { k: 2 });
    const tiny = cmdscale({ ...ds, values: ds.values.map((v) => v * 1e-150) }, { k: 2 });
    for (let i = 0; i < base.points.values.length; i++) for (let j = 0; j < base.points.values[i]!.length; j++) {
      const a = large.points.values[i]![j]! / 1e150, b = tiny.points.values[i]![j]! / 1e-150;
      const e = base.points.values[i]![j]!;
      if (Math.abs(a - e) / Math.max(1, Math.abs(e)) > 1e-10) mismatches.push(`large scale points[${i},${j}]`);
      if (Math.abs(b - e) / Math.max(1, Math.abs(e)) > 1e-10) mismatches.push(`small scale points[${i},${j}]`);
    }
    const fewer = cmdscale(asDist(nonE), { k: 3 });
    if (fewer.points.values[0]!.length !== 2 || fewer.warnings.length !== 1) mismatches.push("fewer positive eigenvalues warning");
    const errors: Array<[string, () => unknown]> = [
      ["cmdscale_k_zero", () => cmdscale(ds, { k: 0 })],
      ["cmdscale_k_too_big", () => cmdscale(ds, { k: 5 })],
      ["cmdscale_one", () => cmdscale(dist([1]), { k: 1 })],
      ["cmdscale_na", () => cmdscale([[0, 1, NaN], [1, 0, 2], [NaN, 2, 0]], { k: 1 })],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) { mismatches.push(key + ": missing error fixture"); continue; }
      try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ }
    }
    console.info(`cmdscale fixtures: 11 R cases; maximum relative error ${maxRelativeError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });

  it("handles 2,000 observations", () => {
    const n = 2000;
    const values = new Array<number>(n * (n - 1) / 2);
    let p = 0;
    for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) values[p++] = i - j;
    const start = performance.now();
    const result = cmdscale({ values, size: n, labels: null, method: "euclidean", diag: false, upper: false, warnings: [] }, { k: 2 });
    const elapsed = performance.now() - start;
    expect(result.points).toHaveLength(n);
    expect(result.points.values.every((r) => r.every(Number.isFinite))).toBe(true);
    console.info(`cmdscale 2,000 observations: ${elapsed.toFixed(1)} ms`);
  });
});
