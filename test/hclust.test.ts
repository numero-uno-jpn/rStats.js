import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, cutree, dist, hclust, type HclustFit } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/hclust.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxHeightRelativeError = 0;
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function same(label: string, actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) mismatches.push(`${label}: actual=${String(actual)}, expected=${String(expected)}`);
}
function compareTree(key: string, actual: HclustFit): void {
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing R fixture`); return; }
  if (JSON.stringify(actual.merge) !== JSON.stringify(expected.merge)) {
    mismatches.push(`${key}.merge differs`);
  }
  if (JSON.stringify(actual.order) !== JSON.stringify(expected.order)) {
    mismatches.push(`${key}.order: actual=${JSON.stringify(actual.order)}, expected=${JSON.stringify(expected.order)}`);
  }
  same(key + ".method", actual.method, expected.method);
  same(key + ".distMethod", actual.distMethod, expected["dist.method"]);
  if (JSON.stringify(actual.labels) !== JSON.stringify(expected.labels)) mismatches.push(`${key}.labels differs`);
  if (actual.height.length !== expected.height.length) mismatches.push(`${key}.height length differs`);
  for (let i = 0; i < Math.min(actual.height.length, expected.height.length); i++) {
    const a = actual.height[i]!, e = num(expected.height[i]);
    const rel = e === 0 ? Math.abs(a - e) : Math.abs(a - e) / Math.abs(e);
    if (Number.isFinite(rel)) maxHeightRelativeError = Math.max(maxHeightRelativeError, rel);
    if (!(Object.is(a, e) || (Number.isFinite(rel) && rel <= 1e-14))) {
      mismatches.push(`${key}.height[${i}]: actual=${a}, expected=${e}, relativeError=${rel}`);
    }
  }
  if (JSON.stringify(actual.warnings) !== JSON.stringify(fixture[key].warnings ?? [])) mismatches.push(`${key}.warnings differs`);
}
function compareCutree(key: string, actual: ReturnType<typeof cutree>): void {
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing R fixture`); return; }
  const expectedValues = expected.values;
  if (JSON.stringify(actual.values) !== JSON.stringify(expectedValues)) {
    mismatches.push(`${key}.values differs`);
  }
  const expectedNames = expected.names ?? expected.rows ?? null;
  if (JSON.stringify(actual.names) !== JSON.stringify(expectedNames)) mismatches.push(`${key}.names differs`);
  const expectedColumns = expected.cols;
  if (JSON.stringify(actual.columns ?? null) !== JSON.stringify(expectedColumns ?? null)) mismatches.push(`${key}.columns differs`);
}
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const labels = ["a", "b", "c", "d", "e"];
const ds = dist(small, { labels });
const grid = Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)]);
const line = dist([0, 1, 2, 3, 4, 5]);
const shuffled = dist([5, 1, 3, 0, 4, 2]);
const equal = asDist(Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => i === j ? 0 : 1)));
const zero = dist([1, 1, 2, 2, 2]);
const triangle = dist([[0, 0], [2, 0], [1, Math.sqrt(3)], [1, 0.6]]);
const methods = ["ward.D", "ward.D2", "single", "complete", "average", "mcquitty", "median", "centroid"] as const;

describe("hclust and cutree", () => {
  it("matches R merge, order and height for the small and triangle inputs", () => {
    for (const method of methods) {
      compareTree("hclust_small_" + method, hclust(ds, { method }));
      compareTree("hclust_triangle_" + method, hclust(triangle, { method }));
    }
    for (const method of ["median", "centroid"] as const) {
      compareTree("hclust_triangle_sq_" + method, hclust({ ...triangle, values: triangle.values.map((v) => v * v) }, { method }));
    }
  });

  it("matches R's exact tie decisions, merge orientation and leaf order", () => {
    for (const method of methods) {
      compareTree("hclust_grid_" + method, hclust(dist(grid, { labels: Array.from({ length: 9 }, (_, i) => "g" + (i + 1)) }), { method }));
      compareTree("hclust_line_" + method, hclust(line, { method }));
      compareTree("hclust_line_shuffled_" + method, hclust(shuffled, { method }));
      compareTree("hclust_all_equal_" + method, hclust(equal, { method }));
      compareTree("hclust_zero_" + method, hclust(zero, { method }));
    }
  });

  it("uses initial member sizes and handles scale extremes without changing the tree", () => {
    for (const method of methods) compareTree("hclust_members_" + method, hclust(ds, { method, members: [2, 1, 3, 1, 1] }));
    const largeWard = { ...ds, values: ds.values.map((v) => v * 1e100) };
    const largeSingle = { ...ds, values: ds.values.map((v) => v * 1e200) };
    const base = hclust(ds, { method: "ward.D2" });
    const scaled = hclust(largeWard, { method: "ward.D2" });
    same("ward.D2 scaled merge", JSON.stringify(scaled.merge), JSON.stringify(base.merge));
    same("ward.D2 scaled order", JSON.stringify(scaled.order), JSON.stringify(base.order));
    for (let i = 0; i < base.height.length; i++) {
      const rel = Math.abs(scaled.height[i]! / 1e100 - base.height[i]!) / Math.max(1, Math.abs(base.height[i]!));
      if (rel > 1e-10) mismatches.push(`ward.D2 scale height[${i}] relativeError=${rel}`);
    }
    const extremeWard = hclust({ ...ds, values: ds.values.map((v) => v * 1e200) }, { method: "ward.D2" });
    same("ward.D2 1e200 merge", JSON.stringify(extremeWard.merge), JSON.stringify(base.merge));
    same("ward.D2 1e200 order", JSON.stringify(extremeWard.order), JSON.stringify(base.order));
    for (let i = 0; i < base.height.length; i++) {
      const rel = Math.abs(extremeWard.height[i]! / 1e200 - base.height[i]!) / Math.max(1, Math.abs(base.height[i]!));
      if (rel > 1e-10) mismatches.push(`ward.D2 1e200 height[${i}] relativeError=${rel}`);
    }
    const baseSingle = hclust(ds, { method: "single" });
    const scaledSingle = hclust(largeSingle, { method: "single" });
    same("single scaled merge", JSON.stringify(scaledSingle.merge), JSON.stringify(baseSingle.merge));
    same("single scaled order", JSON.stringify(scaledSingle.order), JSON.stringify(baseSingle.order));
    compareTree("hclust_scale", scaled);
    compareTree("hclust_scale_single", scaledSingle);
  });

  it("matches cutree vectors, heights, ties, labels and inversion behavior", () => {
    const raw = fixture.hclust_usarrests_average.value;
    const tree: HclustFit = { ...raw, distMethod: raw["dist.method"], warnings: [] };
    compareCutree("cutree_k", cutree(tree, { k: 4 }));
    compareCutree("cutree_k_vector", cutree(tree, { k: [1, 3, 5, 50] }));
    compareCutree("cutree_h", cutree(tree, { h: 100 }));
    compareCutree("cutree_h_vector", cutree(tree, { h: [200, 50, 0] }));
    compareCutree("cutree_k_and_h", cutree(tree, { k: 3, h: 100 }));
    compareCutree("cutree_k_fraction", cutree(tree, { k: 2.5 }));
    compareCutree("cutree_h_exact", cutree(tree, { h: tree.height[39]! }));
    compareCutree("cutree_h_negative", cutree(tree, { h: -1 }));
    const gTree = hclust(dist(grid, { labels: Array.from({ length: 9 }, (_, i) => "g" + (i + 1)) }), { method: "single" });
    for (let k = 1; k <= 9; k++) compareCutree("cutree_grid_ties_k" + k, cutree(gTree, { k }));
    compareCutree("cutree_grid_ties_h", cutree(gTree, { h: 1 }));
    const inv = hclust(triangle, { method: "centroid" });
    compareCutree("cutree_inversion_k", cutree(inv, { k: 2 }));
    compareCutree("cutree_no_labels", cutree(hclust(dist(small), { method: "average" }), { k: 2 }));
    compareCutree("cutree_vector_labels", cutree(hclust(dist([3, 1, 4, 1, 5])), { k: 2 }));
    try { cutree(inv, { h: 1 }); mismatches.push("cutree inversion h: expected error"); } catch { /* expected */ }
  });

  it("rejects invalid inputs and reports the complete fixture comparison", () => {
    const errors: Array<[string, () => unknown]> = [
      ["hclust_one", () => hclust(dist([1]))],
      ["hclust_members_wrong_length", () => hclust(ds, { members: [1, 2] })],
      ["hclust_bad_method", () => hclust(ds, { method: "flexible" })],
      ["hclust_matrix", () => hclust(small as unknown as any)],
      ["hclust_na", () => hclust({ ...ds, values: [NaN, ...ds.values.slice(1)] })],
      ["hclust_inf", () => hclust({ ...ds, values: [Infinity, ...ds.values.slice(1)] })],
      ["cutree_k_zero", () => cutree(hclust(line), { k: 0 })],
      ["cutree_k_too_big", () => cutree(hclust(line), { k: 7 })],
      ["cutree_none", () => cutree(hclust(line), {})],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) { mismatches.push(key + ": missing error fixture"); continue; }
      try { action(); mismatches.push(key + ": expected an error"); } catch { /* expected */ }
    }
    console.info(`hclust fixtures: 68 trees; maximum relative height error ${maxHeightRelativeError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });

  it("handles 5,000 observations without cubic pair scanning", () => {
    const n = 5000;
    const values = new Array<number>(n * (n - 1) / 2);
    let p = 0;
    for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) values[p++] = i - j;
    const start = performance.now();
    const result = hclust({ values, size: n, labels: null, method: "euclidean", diag: false, upper: false, warnings: [] });
    const elapsed = performance.now() - start;
    expect(result.merge).toHaveLength(n - 1);
    expect(result.order).toHaveLength(n);
    expect(result.height.every(Number.isFinite)).toBe(true);
    console.info(`hclust 5,000 observations (12.5 million distances): ${elapsed.toFixed(1)} ms`);
  });
});
