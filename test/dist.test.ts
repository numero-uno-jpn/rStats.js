import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, dist, type DistObject } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/dist.json", import.meta.url), "utf8")) as Record<string, any>;
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const na = small.map((r) => [...r]); na[1]![0] = NaN; na[3]![2] = NaN;
const allna = small.map((r) => [...r]); allna[1] = [NaN, NaN, NaN];
const nan = small.map((r) => [...r]); nan[2]![1] = NaN;
const inf = small.map((r) => [...r]); inf[0]![0] = Infinity; inf[2]![0] = -Infinity;
const infBoth = small.map((r) => [...r]); infBoth[0]![0] = Infinity; infBoth[1]![0] = Infinity;
const canberraZeros = [[0, 0, 1], [0, 0, 2], [1, -1, 3], [-1, 1, 0]];
const binaryZeros = [[0, 0, 0, 1], [0, 2, 0, 0], [0, 0, 0, 3], [3, 0, 0, 0]];
const us = {
  Murder: [13.2, 10.0, 8.1, 8.8, 9.0, 7.9],
  Assault: [236, 263, 294, 190, 276, 204],
  UrbanPop: [58, 48, 80, 50, 91, 78],
  Rape: [21.2, 44.5, 31.0, 19.5, 40.6, 38.7],
};
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function compare(key: string, actual: DistObject): void {
  const expected = fixture[key];
  expect(actual.size, key + ".size").toBe(expected.value.size);
  expect(actual.labels, key + ".labels").toEqual(expected.value.labels === null ? null :
    Array.isArray(expected.value.labels) ? expected.value.labels : [expected.value.labels]);
  expect(actual.method, key + ".method").toBe(expected.value.method);
  expect(actual.diag, key + ".diag").toBe(expected.value.diag);
  expect(actual.upper, key + ".upper").toBe(expected.value.upper);
  const values = Array.isArray(expected.value.values) ? expected.value.values : [expected.value.values];
  expect(actual.values.length, key + ".length").toBe(values.length);
  for (let i = 0; i < values.length; i++) {
    const e = num(values[i]), a = actual.values[i]!;
    if (!Number.isFinite(e)) expect(Object.is(a, e) || (Number.isNaN(a) && Number.isNaN(e)), key + "[" + i + "]").toBe(true);
    else expect(Math.abs(a - e), key + "[" + i + "]").toBeLessThanOrEqual(1e-12 * Math.max(Math.abs(e), 1e-300));
  }
  const warnings = expected.warnings === undefined ? [] : Array.isArray(expected.warnings) ? expected.warnings : [expected.warnings];
  expect(actual.warnings, key + ".warnings").toEqual(warnings);
}

describe("dist and asDist", () => {
  it("matches every ordinary distance method and option fixture", () => {
    const methods = ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"] as const;
    for (const method of methods) compare("dist_" + method, dist(small, { method, labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_minkowski_p3", dist(small, { method: "minkowski", p: 3, labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_minkowski_p05", dist(small, { method: "minkowski", p: 0.5, labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_minkowski_p1", dist(small, { method: "minkowski", p: 1, labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_partial_name", dist(small, { method: "max", labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_diag_upper", dist(small, { diag: true, upper: true, labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_no_names", dist(small));
    compare("dist_one_row", dist([small[0]!], { labels: ["a"] }));
    compare("dist_vector", dist([3, 1, 4, 1, 5]));
    compare("dist_data_frame", dist(us, { labels: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado"] }));
  });

  it("matches all missing, NaN, infinite, Canberra and binary fixtures", () => {
    for (const method of ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"] as const) {
      compare("dist_na_" + method, dist(na, { method, labels: ["a", "b", "c", "d", "e"] }));
      compare("dist_all_na_row_" + method, dist(allna, { method, labels: ["a", "b", "c", "d", "e"] }));
      compare("dist_inf_" + method, dist(inf, { method, labels: ["a", "b", "c", "d", "e"] }));
      compare("dist_inf_both_" + method, dist(infBoth, { method, labels: ["a", "b", "c", "d", "e"] }));
    }
    compare("dist_nan", dist(nan, { labels: ["a", "b", "c", "d", "e"] }));
    compare("dist_canberra_zeros", dist(canberraZeros, { method: "canberra" }));
    compare("dist_canberra_all_zero", dist([[0, 0], [0, 0], [0, 0]], { method: "canberra" }));
    compare("dist_binary_zero_rows", dist(binaryZeros, { method: "binary" }));
    compare("dist_binary_both_zero", dist([[0, 0, 0], [0, 0, 0], [1, 0, 0]], { method: "binary" }));
    compare("dist_binary_logical", dist([[true, true], [false, false], [true, false]], { method: "binary" }));
    compare("dist_character", dist([["a", "c"], ["b", "d"]]));
  });

  it("uses R's ordinary arithmetic order and rescales only extreme pairs", () => {
    const base = dist(small);
    const large = dist(small.map((r) => r.map((v) => v * 1e200)));
    const tiny = dist(small.map((r) => r.map((v) => v * 1e-200)));
    for (let i = 0; i < base.values.length; i++) {
      expect(large.values[i]! / 1e200).toBeCloseTo(base.values[i]!, 12);
      expect(tiny.values[i]! / 1e-200).toBeCloseTo(base.values[i]!, 12);
    }
    expect(() => dist(small, { method: "minkowski", p: 0 })).toThrow("distance(): invalid p");
    expect(() => dist(small, { method: "minkowski", p: Infinity })).toThrow("distance(): invalid p");
    expect(() => dist(small, { method: "cosine" })).toThrow("invalid distance method");
  });

  it("matches as.dist lower-triangle conversion and identity input", () => {
    const lower = [[0, 9, 9], [1, 0, 9], [2, 3, 0]];
    const upper = [[0, 1, 2], [9, 0, 3], [9, 9, 0]];
    compare("as_dist", asDist(lower));
    compare("as_dist_upper_used", asDist(upper));
    const d = dist(small);
    expect(asDist(d)).toBe(d);
    expect(asDist(lower, { labels: ["a", "b", "c"] }).labels).toEqual(["a", "b", "c"]);
    expect(() => asDist([[0, 1], [2]])).toThrow("matrix must be square");
  });
});
