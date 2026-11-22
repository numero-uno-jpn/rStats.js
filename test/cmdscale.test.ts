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
function distMatrix(d: { values: number[]; size: number }): number[][] {
  const n = d.size, out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) out[i]![j] = out[j]![i] = d.values[p++]!;
  return out;
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
  if (expected.eig !== undefined && expected.eig !== null) compareNumbers(key + ".eig", actual.eig, expected.eig);
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

describe("cmdscale: eurodist and USArrests R fixtures", () => {
  const euroData = [[0,3313,2963,3175,3339,2762,3276,2610,4485,2977,3030,4532,2753,3949,2865,2282,2179,3000,817,3927,1991],[3313,0,1318,1326,1294,1498,2218,803,1172,2018,1490,1305,645,636,521,1014,1365,1033,1460,2868,1802],[2963,1318,0,204,583,206,966,677,2256,597,172,2084,690,1558,1011,925,747,285,1511,1616,1175],[3175,1326,204,0,460,409,1136,747,2224,714,330,2052,739,1550,1059,1077,977,280,1662,1786,1381],[3339,1294,583,460,0,785,1545,853,2047,1115,731,1827,789,1347,1101,1209,1160,340,1794,2196,1588],[2762,1498,206,409,785,0,760,1662,2436,460,269,2290,714,1764,1035,911,583,465,1497,1403,937],[3276,2218,966,1136,1545,760,0,1418,3196,460,269,2971,1458,2498,1778,1537,1104,1176,2050,650,1455],[2610,803,677,747,853,1662,1418,0,1975,1118,895,1936,158,1439,425,328,591,513,995,2068,1019],[4485,1172,2256,2224,2047,2436,3196,1975,0,2897,2428,676,1817,698,1693,2185,2565,1971,2631,3886,2974],[2977,2018,597,714,1115,460,460,1118,2897,0,550,2671,1159,2198,1479,1238,805,877,1751,949,1155],[3030,1490,172,330,731,269,269,895,2428,550,0,2280,863,1730,1183,1098,851,457,1683,1500,1205],[4532,1305,2084,2052,1827,2290,2971,1936,676,2671,2280,0,1178,668,1762,2250,2507,1799,2700,3231,2937],[2753,645,690,739,789,714,1458,158,1817,1159,863,1178,0,1281,320,328,724,471,1048,2108,1157],[3949,636,1558,1550,1347,1764,2498,1439,698,2198,1730,668,1281,0,1157,1724,2010,1273,2097,3188,2409],[2865,521,1011,1059,1101,1035,1778,425,1693,1479,1183,1762,320,1157,0,618,1109,792,1011,2428,1363],[2282,1014,925,1077,1209,911,1537,328,2185,1238,1098,2250,328,1724,618,0,331,856,586,2187,898],[2179,1365,747,977,1160,583,1104,591,2565,805,851,2507,724,2010,1109,331,0,821,946,1754,428],[3000,1033,285,280,340,465,1176,513,1971,877,457,1799,471,1273,792,856,821,0,1476,1827,1249],[817,1460,1511,1662,1794,1497,2050,995,2631,1751,1683,2700,1048,2097,1011,586,946,1476,0,2707,1209],[3927,2868,1616,1786,2196,1403,650,2068,3886,949,1500,3231,2108,3188,2428,2187,1754,1827,2707,0,2105],[1991,1802,1175,1381,1588,937,1455,1019,2974,1155,1205,2937,1157,2409,1363,898,428,1249,1209,2105,0]];
  const usData = [[13.2,236,58,21.2],[10,263,48,44.5],[8.1,294,80,31],[8.8,190,50,19.5],[9,276,91,40.6],[7.9,204,78,38.7],[3.3,110,77,11.1],[5.9,238,72,15.8],[15.4,335,80,31.9],[17.4,211,60,25.8],[5.3,46,83,20.2],[2.6,120,54,14.2],[10.4,249,83,24],[7.2,113,65,21],[2.2,56,57,11.3],[6,115,66,18],[9.7,109,52,16.3],[15.4,249,66,22.2],[2.1,83,51,7.8],[11.3,300,67,27.8],[4.4,149,85,16.3],[12.1,255,74,35.1],[2.7,72,66,14.9],[16.1,259,44,17.1],[9,178,70,28.2],[6,109,53,16.4],[4.3,102,62,16.5],[12.2,252,81,46],[2.1,57,56,9.5],[7.4,159,89,18.8],[11.4,285,70,32.1],[11.1,254,86,26.1],[13,337,45,16.1],[0.8,45,44,7.3],[7.3,120,75,21.4],[6.6,151,68,20],[4.9,159,67,29.3],[6.3,106,72,14.9],[3.4,174,87,8.3],[14.4,279,48,22.5],[3.8,86,45,12.8],[13.2,188,59,26.9],[12.7,201,80,25.5],[3.2,120,80,22.9],[2.2,48,32,11.2],[8.5,156,63,20.7],[4,145,73,26.2],[5.7,81,39,9.3],[2.6,53,66,10.8],[6.8,161,60,15.6]];
  const euroLabels = fixture.cmdscale_eurodist_k3_all.value.points.rows as string[];
  const usLabels = fixture.cmdscale_usarrests.value.points.rows as string[];
  const euroD = asDist(euroData, { labels: euroLabels });
  const usD = dist(usData, { labels: usLabels });
  const M3 = [[0, 3, 5], [1, 0, 6], [2, 4, 0]];
  const asymMean = M3.map((r, i) => r.map((v, j) => (v + M3[j]![i]!) / 2));
  const smallRows = ["a", "b", "c", "d", "e"];
  const smallD = dist(small, { labels: smallRows });

  it("matches all public-data, additive-constant and full-return fixtures", () => {
    compare("cmdscale_eurodist", cmdscale(euroD));
    compare("cmdscale_eurodist_list", cmdscale(euroD, { k: 2 }));
    compare("cmdscale_eurodist_k3_all", cmdscale(euroD, { k: 3, xRet: true }));
    compare("cmdscale_eurodist_add", cmdscale(euroD, { k: 2, add: true }));
    compare("cmdscale_eurodist_add_k1", cmdscale(euroD, { k: 1, add: true, xRet: true }));
    compare("cmdscale_usarrests", cmdscale(usD, { k: 3 }));
    compare("cmdscale_usarrests_add", cmdscale(usD, { k: 2, add: true }));
    compare("cmdscale_list_only", cmdscale(euroD, { k: 2 }));
    compare("cmdscale_matrix", cmdscale({ rows: smallRows, cols: smallRows, values: distMatrix(smallD) }, { k: 2 }));
    compare("cmdscale_asymmetric", cmdscale(M3, { k: 2 }));
    compare("cmdscale_asym_matrix", cmdscale(M3, { k: 2, xRet: true }));
    compare("cmdscale_asym_lower", cmdscale(asDist(M3), { k: 2, xRet: true }));
    const transpose = M3[0]!.map((_, j) => M3.map((r) => r[j]!));
    compare("cmdscale_asym_upper", cmdscale(asDist(transpose), { k: 2, xRet: true }));
    compare("cmdscale_asym_mean", cmdscale(asDist(asymMean), { k: 2, xRet: true }));
    compare("cmdscale_scale", cmdscale({ ...smallD, values: smallD.values.map((v) => v * 1e150) }, { k: 2 }));
    compare("cmdscale_scale_small", cmdscale({ ...smallD, values: smallD.values.map((v) => v * 1e-150) }, { k: 2 }));
    expect(mismatches).toEqual([]);
  });

  it("matches all remaining edge and error fixtures", () => {
    const line = dist([0, 1, 3, 6]);
    const simplex = asDist(Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 0 : 1)));
    const zero = dist([1, 1, 2, 5]);
    compare("cmdscale_eurodist", cmdscale(euroD));
    compare("cmdscale_non_euclidean", cmdscale(asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]), { k: 2 }));
    compare("cmdscale_non_euclidean_k3", cmdscale(asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]), { k: 3 }));
    compare("cmdscale_non_euclidean_add", cmdscale(asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]), { k: 3, add: true }));
    compare("cmdscale_line_k2", cmdscale(line, { k: 2 }));
    compare("cmdscale_line_k1", cmdscale(line, { k: 1 }));
    compare("cmdscale_line_add", cmdscale(line, { k: 1, add: true }));
    compare("cmdscale_simplex", cmdscale(simplex, { k: 2 }));
    compare("cmdscale_k_n_minus_1", cmdscale(smallD, { k: 4 }));
    compare("cmdscale_two", cmdscale(dist([1, 4]), { k: 1 }));
    compare("cmdscale_zero_distances", cmdscale(zero, { k: 1 }));
    compare("cmdscale_no_labels", cmdscale(dist(small), { k: 2 }));
    for (const [key, action] of [
      ["cmdscale_k_too_big", () => cmdscale(smallD, { k: 5 })],
      ["cmdscale_k_zero", () => cmdscale(smallD, { k: 0 })],
      ["cmdscale_one", () => cmdscale(dist([1]), { k: 1 })],
      ["cmdscale_na", () => cmdscale(asDist([[0, 1, NaN], [1, 0, 2], [NaN, 2, 0]]), { k: 1 })],
    ] as const) {
      if (!fixture[key]?.error) mismatches.push(key + ": missing error fixture");
      else { try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ } }
    }
    expect(mismatches).toEqual([]);
  });
});
