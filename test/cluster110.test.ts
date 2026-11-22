import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, cmdscale, cutree, dist, hclust, isoMDS, kmeans, type HclustFit, type KmeansFit, type CmdscaleResult, type IsoMDSResult } from "../src/entries/multivariate.js";
import { setSeed, runif } from "../src/entries/distributions.js";

const data = {"iris":[[5.1,3.5,1.4,0.2],[4.9,3,1.4,0.2],[4.7,3.2,1.3,0.2],[4.6,3.1,1.5,0.2],[5,3.6,1.4,0.2],[5.4,3.9,1.7,0.4],[4.6,3.4,1.4,0.3],[5,3.4,1.5,0.2],[4.4,2.9,1.4,0.2],[4.9,3.1,1.5,0.1],[5.4,3.7,1.5,0.2],[4.8,3.4,1.6,0.2],[4.8,3,1.4,0.1],[4.3,3,1.1,0.1],[5.8,4,1.2,0.2],[5.7,4.4,1.5,0.4],[5.4,3.9,1.3,0.4],[5.1,3.5,1.4,0.3],[5.7,3.8,1.7,0.3],[5.1,3.8,1.5,0.3],[5.4,3.4,1.7,0.2],[5.1,3.7,1.5,0.4],[4.6,3.6,1,0.2],[5.1,3.3,1.7,0.5],[4.8,3.4,1.9,0.2],[5,3,1.6,0.2],[5,3.4,1.6,0.4],[5.2,3.5,1.5,0.2],[5.2,3.4,1.4,0.2],[4.7,3.2,1.6,0.2],[4.8,3.1,1.6,0.2],[5.4,3.4,1.5,0.4],[5.2,4.1,1.5,0.1],[5.5,4.2,1.4,0.2],[4.9,3.1,1.5,0.2],[5,3.2,1.2,0.2],[5.5,3.5,1.3,0.2],[4.9,3.6,1.4,0.1],[4.4,3,1.3,0.2],[5.1,3.4,1.5,0.2],[5,3.5,1.3,0.3],[4.5,2.3,1.3,0.3],[4.4,3.2,1.3,0.2],[5,3.5,1.6,0.6],[5.1,3.8,1.9,0.4],[4.8,3,1.4,0.3],[5.1,3.8,1.6,0.2],[4.6,3.2,1.4,0.2],[5.3,3.7,1.5,0.2],[5,3.3,1.4,0.2],[7,3.2,4.7,1.4],[6.4,3.2,4.5,1.5],[6.9,3.1,4.9,1.5],[5.5,2.3,4,1.3],[6.5,2.8,4.6,1.5],[5.7,2.8,4.5,1.3],[6.3,3.3,4.7,1.6],[4.9,2.4,3.3,1],[6.6,2.9,4.6,1.3],[5.2,2.7,3.9,1.4],[5,2,3.5,1],[5.9,3,4.2,1.5],[6,2.2,4,1],[6.1,2.9,4.7,1.4],[5.6,2.9,3.6,1.3],[6.7,3.1,4.4,1.4],[5.6,3,4.5,1.5],[5.8,2.7,4.1,1],[6.2,2.2,4.5,1.5],[5.6,2.5,3.9,1.1],[5.9,3.2,4.8,1.8],[6.1,2.8,4,1.3],[6.3,2.5,4.9,1.5],[6.1,2.8,4.7,1.2],[6.4,2.9,4.3,1.3],[6.6,3,4.4,1.4],[6.8,2.8,4.8,1.4],[6.7,3,5,1.7],[6,2.9,4.5,1.5],[5.7,2.6,3.5,1],[5.5,2.4,3.8,1.1],[5.5,2.4,3.7,1],[5.8,2.7,3.9,1.2],[6,2.7,5.1,1.6],[5.4,3,4.5,1.5],[6,3.4,4.5,1.6],[6.7,3.1,4.7,1.5],[6.3,2.3,4.4,1.3],[5.6,3,4.1,1.3],[5.5,2.5,4,1.3],[5.5,2.6,4.4,1.2],[6.1,3,4.6,1.4],[5.8,2.6,4,1.2],[5,2.3,3.3,1],[5.6,2.7,4.2,1.3],[5.7,3,4.2,1.2],[5.7,2.9,4.2,1.3],[6.2,2.9,4.3,1.3],[5.1,2.5,3,1.1],[5.7,2.8,4.1,1.3],[6.3,3.3,6,2.5],[5.8,2.7,5.1,1.9],[7.1,3,5.9,2.1],[6.3,2.9,5.6,1.8],[6.5,3,5.8,2.2],[7.6,3,6.6,2.1],[4.9,2.5,4.5,1.7],[7.3,2.9,6.3,1.8],[6.7,2.5,5.8,1.8],[7.2,3.6,6.1,2.5],[6.5,3.2,5.1,2],[6.4,2.7,5.3,1.9],[6.8,3,5.5,2.1],[5.7,2.5,5,2],[5.8,2.8,5.1,2.4],[6.4,3.2,5.3,2.3],[6.5,3,5.5,1.8],[7.7,3.8,6.7,2.2],[7.7,2.6,6.9,2.3],[6,2.2,5,1.5],[6.9,3.2,5.7,2.3],[5.6,2.8,4.9,2],[7.7,2.8,6.7,2],[6.3,2.7,4.9,1.8],[6.7,3.3,5.7,2.1],[7.2,3.2,6,1.8],[6.2,2.8,4.8,1.8],[6.1,3,4.9,1.8],[6.4,2.8,5.6,2.1],[7.2,3,5.8,1.6],[7.4,2.8,6.1,1.9],[7.9,3.8,6.4,2],[6.4,2.8,5.6,2.2],[6.3,2.8,5.1,1.5],[6.1,2.6,5.6,1.4],[7.7,3,6.1,2.3],[6.3,3.4,5.6,2.4],[6.4,3.1,5.5,1.8],[6,3,4.8,1.8],[6.9,3.1,5.4,2.1],[6.7,3.1,5.6,2.4],[6.9,3.1,5.1,2.3],[5.8,2.7,5.1,1.9],[6.8,3.2,5.9,2.3],[6.7,3.3,5.7,2.5],[6.7,3,5.2,2.3],[6.3,2.5,5,1.9],[6.5,3,5.2,2],[6.2,3.4,5.4,2.3],[5.9,3,5.1,1.8]],"usarrests":[[13.2,236,58,21.2],[10,263,48,44.5],[8.1,294,80,31],[8.8,190,50,19.5],[9,276,91,40.6],[7.9,204,78,38.7],[3.3,110,77,11.1],[5.9,238,72,15.8],[15.4,335,80,31.9],[17.4,211,60,25.8],[5.3,46,83,20.2],[2.6,120,54,14.2],[10.4,249,83,24],[7.2,113,65,21],[2.2,56,57,11.3],[6,115,66,18],[9.7,109,52,16.3],[15.4,249,66,22.2],[2.1,83,51,7.8],[11.3,300,67,27.8],[4.4,149,85,16.3],[12.1,255,74,35.1],[2.7,72,66,14.9],[16.1,259,44,17.1],[9,178,70,28.2],[6,109,53,16.4],[4.3,102,62,16.5],[12.2,252,81,46],[2.1,57,56,9.5],[7.4,159,89,18.8],[11.4,285,70,32.1],[11.1,254,86,26.1],[13,337,45,16.1],[0.8,45,44,7.3],[7.3,120,75,21.4],[6.6,151,68,20],[4.9,159,67,29.3],[6.3,106,72,14.9],[3.4,174,87,8.3],[14.4,279,48,22.5],[3.8,86,45,12.8],[13.2,188,59,26.9],[12.7,201,80,25.5],[3.2,120,80,22.9],[2.2,48,32,11.2],[8.5,156,63,20.7],[4,145,73,26.2],[5.7,81,39,9.3],[2.6,53,66,10.8],[6.8,161,60,15.6]],"swiss":[[80.2,17,15,12,9.96,22.2],[83.1,45.1,6,9,84.84,22.2],[92.5,39.7,5,5,93.4,20.2],[85.8,36.5,12,7,33.77,20.3],[76.9,43.5,17,15,5.16,20.6],[76.1,35.3,9,7,90.57,26.6],[83.8,70.2,16,7,92.85,23.6],[92.4,67.8,14,8,97.16,24.9],[82.4,53.3,12,7,97.67,21],[82.9,45.2,16,13,91.38,24.4],[87.1,64.5,14,6,98.61,24.5],[64.1,62,21,12,8.52,16.5],[66.9,67.5,14,7,2.27,19.1],[68.9,60.7,19,12,4.43,22.7],[61.7,69.3,22,5,2.82,18.7],[68.3,72.6,18,2,24.2,21.2],[71.7,34,17,8,3.3,20],[55.7,19.4,26,28,12.11,20.2],[54.3,15.2,31,20,2.15,10.8],[65.1,73,19,9,2.84,20],[65.5,59.8,22,10,5.23,18],[65,55.1,14,3,4.52,22.4],[56.6,50.9,22,12,15.14,16.7],[57.4,54.1,20,6,4.2,15.3],[72.5,71.2,12,1,2.4,21],[74.2,58.1,14,8,5.23,23.8],[72,63.5,6,3,2.56,18],[60.5,60.8,16,10,7.72,16.3],[58.3,26.8,25,19,18.46,20.9],[65.4,49.5,15,8,6.1,22.5],[75.5,85.9,3,2,99.71,15.1],[69.3,84.9,7,6,99.68,19.8],[77.3,89.7,5,2,100,18.3],[70.5,78.2,12,6,98.96,19.4],[79.4,64.9,7,3,98.22,20.2],[65,75.9,9,9,99.06,17.8],[92.2,84.6,3,3,99.46,16.3],[79.3,63.1,13,13,96.83,18.1],[70.4,38.4,26,12,5.62,20.3],[65.7,7.7,29,11,13.79,20.5],[72.7,16.7,22,13,11.22,18.9],[64.4,17.6,35,32,16.92,23],[77.6,37.6,15,7,4.97,20],[67.6,18.7,25,7,8.65,19.5],[35,1.2,37,53,42.34,18],[44.7,46.6,16,29,50.43,18.2],[42.8,27.7,22,29,58.33,19.3]],"eurodist":[[0,3313,2963,3175,3339,2762,3276,2610,4485,2977,3030,4532,2753,3949,2865,2282,2179,3000,817,3927,1991],[3313,0,1318,1326,1294,1498,2218,803,1172,2018,1490,1305,645,636,521,1014,1365,1033,1460,2868,1802],[2963,1318,0,204,583,206,966,677,2256,597,172,2084,690,1558,1011,925,747,285,1511,1616,1175],[3175,1326,204,0,460,409,1136,747,2224,714,330,2052,739,1550,1059,1077,977,280,1662,1786,1381],[3339,1294,583,460,0,785,1545,853,2047,1115,731,1827,789,1347,1101,1209,1160,340,1794,2196,1588],[2762,1498,206,409,785,0,760,1662,2436,460,269,2290,714,1764,1035,911,583,465,1497,1403,937],[3276,2218,966,1136,1545,760,0,1418,3196,460,269,2971,1458,2498,1778,1537,1104,1176,2050,650,1455],[2610,803,677,747,853,1662,1418,0,1975,1118,895,1936,158,1439,425,328,591,513,995,2068,1019],[4485,1172,2256,2224,2047,2436,3196,1975,0,2897,2428,676,1817,698,1693,2185,2565,1971,2631,3886,2974],[2977,2018,597,714,1115,460,460,1118,2897,0,550,2671,1159,2198,1479,1238,805,877,1751,949,1155],[3030,1490,172,330,731,269,269,895,2428,550,0,2280,863,1730,1183,1098,851,457,1683,1500,1205],[4532,1305,2084,2052,1827,2290,2971,1936,676,2671,2280,0,1178,668,1762,2250,2507,1799,2700,3231,2937],[2753,645,690,739,789,714,1458,158,1817,1159,863,1178,0,1281,320,328,724,471,1048,2108,1157],[3949,636,1558,1550,1347,1764,2498,1439,698,2198,1730,668,1281,0,1157,1724,2010,1273,2097,3188,2409],[2865,521,1011,1059,1101,1035,1778,425,1693,1479,1183,1762,320,1157,0,618,1109,792,1011,2428,1363],[2282,1014,925,1077,1209,911,1537,328,2185,1238,1098,2250,328,1724,618,0,331,856,586,2187,898],[2179,1365,747,977,1160,583,1104,591,2565,805,851,2507,724,2010,1109,331,0,821,946,1754,428],[3000,1033,285,280,340,465,1176,513,1971,877,457,1799,471,1273,792,856,821,0,1476,1827,1249],[817,1460,1511,1662,1794,1497,2050,995,2631,1751,1683,2700,1048,2097,1011,586,946,1476,0,2707,1209],[3927,2868,1616,1786,2196,1403,650,2068,3886,949,1500,3231,2108,3188,2428,2187,1754,1827,2707,0,2105],[1991,1802,1175,1381,1588,937,1455,1019,2974,1155,1205,2937,1157,2409,1363,898,428,1249,1209,2105,0]]} as { iris: number[][]; usarrests: number[][]; swiss: number[][]; eurodist: number[][] };
const fixtures = {
  h: JSON.parse(readFileSync(new URL("./fixtures/hclust.json", import.meta.url), "utf8")) as Record<string, any>,
  k: JSON.parse(readFileSync(new URL("./fixtures/kmeans.json", import.meta.url), "utf8")) as Record<string, any>,
  c: JSON.parse(readFileSync(new URL("./fixtures/cmdscale.json", import.meta.url), "utf8")) as Record<string, any>,
  i: JSON.parse(readFileSync(new URL("./fixtures/isomds.json", import.meta.url), "utf8")) as Record<string, any>,
};
const mismatches: string[] = [];
let maxHHeightError = 0, maxKError = 0, maxCError = 0, maxIStressError = 0;
const algorithms = ["Hartigan-Wong", "Lloyd", "Forgy", "MacQueen"] as const;
const hMethods = ["ward.D", "ward.D2", "single", "complete", "average", "mcquitty", "median", "centroid"] as const;
const usNames = fixtures.h.hclust_usarrests_ward.D.value.labels as string[];
const swissNames = fixtures.i.isomds_swiss.value.points.rows as string[];
const euroNames = fixtures.c.cmdscale_eurodist_k3_all.value.points.rows as string[];
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const smallTable = { rows: ["a", "b", "c", "d", "e"], cols: ["x", "y", "z"], values: small };
const ds = dist(small, { labels: smallTable.rows });
const grid = Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)]);
const gridLabels = Array.from({ length: 9 }, (_, i) => "g" + (i + 1));
const tri = [[0, 0], [2, 0], [1, Math.sqrt(3)], [1, 0.6]];
const us = { rows: usNames, cols: ["Murder", "Assault", "UrbanPop", "Rape"], values: data.usarrests };
const irisCols = ["Sepal.Length", "Sepal.Width", "Petal.Length", "Petal.Width"];
const iris = { rows: null, cols: irisCols, values: data.iris };
const swissD = dist(data.swiss, { labels: swissNames });
const usD = dist(data.usarrests, { labels: usNames });
const euroD = asDist(data.eurodist, { labels: euroNames });
const nonE = [[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]];
const M3 = [[0, 3, 5], [1, 0, 6], [2, 4, 0]];
function distMatrix(d: { values: number[]; size: number }): number[][] {
  const n = d.size, out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) out[i]![j] = out[j]![i] = d.values[p++]!;
  return out;
}
function num(v: unknown): number { return v === "NA" || v === "NaN" ? NaN : v === "Inf" ? Infinity : v === "-Inf" ? -Infinity : Number(v); }
function close(label: string, a: number, e: number, tol: number, bucket: "h" | "k" | "c" | "i"): void {
  const err = e === 0 ? Math.abs(a - e) : Math.abs(a - e) / Math.abs(e);
  if (Number.isFinite(err)) {
    if (bucket === "h") maxHHeightError = Math.max(maxHHeightError, err);
    if (bucket === "k") maxKError = Math.max(maxKError, err);
    if (bucket === "c") maxCError = Math.max(maxCError, err);
    if (bucket === "i") maxIStressError = Math.max(maxIStressError, err);
  }
  if (!(Object.is(a, e) || (Number.isFinite(err) && err <= tol))) mismatches.push(label + ": actual=" + a + ", expected=" + e + ", rel=" + err);
}
function errorCase(key: string, action: () => unknown, group: "h" | "k" | "c" | "i"): void {
  if (!fixtures[group][key]?.error) { mismatches.push(key + ": fixture error missing"); return; }
  try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ }
}
function compareH(key: string, fit: HclustFit & { warnings: string[] }): void {
  const e = fixtures.h[key]?.value;
  if (!e) { mismatches.push(key + ": fixture missing"); return; }
  if (JSON.stringify(fit.merge) !== JSON.stringify(e.merge)) mismatches.push(key + ".merge");
  if (JSON.stringify(fit.order) !== JSON.stringify(e.order)) mismatches.push(key + ".order");
  if (JSON.stringify(fit.labels) !== JSON.stringify(e.labels)) mismatches.push(key + ".labels");
  if (fit.method !== e.method) mismatches.push(key + ".method");
  if (fit.distMethod !== e["dist.method"]) mismatches.push(key + ".dist.method");
  if (fit.height.length !== e.height.length) mismatches.push(key + ".height.length");
  for (let j = 0; j < Math.min(fit.height.length, e.height.length); j++) close(key + ".height[" + j + "]", fit.height[j]!, num(e.height[j]), 1e-14, "h");
  if (JSON.stringify(fit.warnings) !== JSON.stringify(fixtures.h[key].warnings ?? [])) mismatches.push(key + ".warnings");
}
function compareCutree(key: string, result: ReturnType<typeof cutree>): void {
  const e = fixtures.h[key]?.value;
  if (!e) { mismatches.push(key + ": fixture missing"); return; }
  if (JSON.stringify(result.values) !== JSON.stringify(e.values)) mismatches.push(key + ".values");
  if (JSON.stringify(result.names) !== JSON.stringify(e.names ?? null)) mismatches.push(key + ".names");
  if (e.rows !== undefined && JSON.stringify(result.rows ?? null) !== JSON.stringify(e.rows ?? null)) mismatches.push(key + ".rows");
  if (e.cols !== undefined && JSON.stringify(result.columns ?? null) !== JSON.stringify(e.cols ?? null)) mismatches.push(key + ".cols");
}
function compareK(key: string, fit: KmeansFit): void {
  const e = fixtures.k[key]?.value;
  if (!e) { mismatches.push(key + ": fixture missing"); return; }
  if (JSON.stringify(fit.cluster) !== JSON.stringify(e.cluster)) mismatches.push(key + ".cluster");
  if (e.cluster_names !== undefined && JSON.stringify(fit.names ?? null) !== JSON.stringify(e.cluster_names)) mismatches.push(key + ".cluster_names");
  if (JSON.stringify(fit.centers.rows) !== JSON.stringify(e.centers.rows)) mismatches.push(key + ".centers.rows");
  if (JSON.stringify(fit.centers.cols) !== JSON.stringify(e.centers.cols)) mismatches.push(key + ".centers.cols");
  for (let i = 0; i < Math.min(fit.centers.values.length, e.centers.values.length); i++) for (let j = 0; j < Math.min(fit.centers.values[i]!.length, e.centers.values[i]!.length); j++) close(key + ".centers[" + i + "," + j + "]", fit.centers.values[i]![j]!, num(e.centers.values[i]![j]), 1e-12, "k");
  for (const [field, actual, expected] of [["totss", fit.totss, e.totss], ["withinss", fit.withinss, e.withinss], ["tot.withinss", fit.totWithinss, e["tot.withinss"]], ["betweenss", fit.betweenss, e.betweenss]] as const) {
    if (expected === undefined) continue;
    if (Array.isArray(actual)) {
      if (actual.length !== expected.length) mismatches.push(key + "." + field + ".length");
      for (let i = 0; i < Math.min(actual.length, expected.length); i++) close(key + "." + field + "[" + i + "]", actual[i]!, num(expected[i]), 1e-12, "k");
    } else close(key + "." + field, actual, num(expected), 1e-12, "k");
  }
  if (JSON.stringify(fit.size) !== JSON.stringify(e.size)) mismatches.push(key + ".size");
  if (e.iter !== undefined && fit.iter !== e.iter) mismatches.push(key + ".iter: " + fit.iter + " != " + e.iter);
  if (e.ifault !== undefined && fit.ifault !== e.ifault) mismatches.push(key + ".ifault: " + fit.ifault + " != " + e.ifault);
  if (JSON.stringify(fit.warnings) !== JSON.stringify(fixtures.k[key].warnings ?? [])) mismatches.push(key + ".warnings");
}
function tableValues(x: any): number[][] { return Array.isArray(x) ? x : x?.values ?? []; }
function compareC(key: string, result: CmdscaleResult): void {
  const e = fixtures.c[key]?.value;
  if (!e) { mismatches.push(key + ": fixture missing"); return; }
  const pts = tableValues(e.points);
  if (JSON.stringify(result.points.rows) !== JSON.stringify(e.points.rows ?? null)) mismatches.push(key + ".points.rows");
  if (JSON.stringify(result.points.cols) !== JSON.stringify(e.points.cols ?? null)) mismatches.push(key + ".points.cols");
  for (let j = 0; j < (pts[0]?.length ?? 0); j++) {
    let dot = 0; for (let i = 0; i < Math.min(pts.length, result.points.values.length); i++) dot += result.points.values[i]![j]! * num(pts[i]![j]);
    if (dot < 0) for (const row of result.points.values) row[j] = -row[j]!;
  }
  for (let i = 0; i < Math.min(pts.length, result.points.values.length); i++) for (let j = 0; j < Math.min(pts[i]!.length, result.points.values[i]!.length); j++) close(key + ".points[" + i + "," + j + "]", result.points.values[i]![j]!, num(pts[i]![j]), 1e-12, "c");
  if (e.eig !== undefined && e.eig !== null) {
    if (result.eig.length !== e.eig.length) mismatches.push(key + ".eig.length");
    for (let i = 0; i < Math.min(result.eig.length, e.eig.length); i++) close(key + ".eig[" + i + "]", result.eig[i]!, num(e.eig[i]), 1e-12, "c");
  }
  if (e.ac !== undefined) close(key + ".ac", result.ac, num(e.ac), 1e-10, "c");
  if (e.GOF !== undefined) for (let i = 0; i < 2; i++) close(key + ".GOF[" + i + "]", result.GOF[i]!, num(e.GOF[i]), 1e-12, "c");
  if (e.x !== undefined) {
    if (e.x === null && result.x !== null) mismatches.push(key + ".x should be null");
    if (e.x !== null) {
      if (result.x === null) mismatches.push(key + ".x missing");
      else {
        if (JSON.stringify(result.x.rows) !== JSON.stringify(e.x.rows ?? null) || JSON.stringify(result.x.cols) !== JSON.stringify(e.x.cols ?? null)) mismatches.push(key + ".x labels");
        const xv = tableValues(e.x);
        for (let i = 0; i < xv.length; i++) for (let j = 0; j < xv[i]!.length; j++) close(key + ".x[" + i + "," + j + "]", result.x.values[i]![j]!, num(xv[i]![j]), 1e-12, "c");
      }
    }
  }
  if (JSON.stringify(result.warnings) !== JSON.stringify(fixtures.c[key].warnings ?? [])) mismatches.push(key + ".warnings");
}
function compareI(key: string, result: IsoMDSResult, stressTol = 1e-6): void {
  const e = fixtures.i[key]?.value;
  if (!e) { mismatches.push(key + ": fixture missing"); return; }
  const pts = tableValues(e.points);
  if (JSON.stringify(result.points.rows) !== JSON.stringify(e.points.rows ?? null)) mismatches.push(key + ".points.rows");
  for (let j = 0; j < (pts[0]?.length ?? 0); j++) {
    let dot = 0; for (let i = 0; i < Math.min(pts.length, result.points.values.length); i++) dot += result.points.values[i]![j]! * num(pts[i]![j]);
    if (dot < 0) for (const row of result.points.values) row[j] = -row[j]!;
  }
  for (let i = 0; i < Math.min(pts.length, result.points.values.length); i++) for (let j = 0; j < Math.min(pts[i]!.length, result.points.values[i]!.length); j++) close(key + ".points[" + i + "," + j + "]", result.points.values[i]![j]!, num(pts[i]![j]), 1e-7, "i");
  const stressError = Math.abs(result.stress - num(e.stress));
  maxIStressError = Math.max(maxIStressError, stressError);
  if (stressError > stressTol) mismatches.push(key + ".stress: " + result.stress + " != " + e.stress);
  if (Array.isArray(e.printed) && e.printed.length) {
    const expected = e.printed.map((line: string) => { const m = line.match(/value\s+([0-9.]+)/); return m ? Number(m[1]) : null; }).filter((v: number | null): v is number => v !== null);
    const actual = result.trace.map((v) => v.stress);
    if (actual.length !== expected.length) mismatches.push(key + ".trace.length " + actual.length + " != " + expected.length);
    for (let i = 0; i < Math.min(actual.length, expected.length); i++) if (Math.abs(actual[i]! - expected[i]!) > 5.1e-7) mismatches.push(key + ".trace[" + i + "] " + actual[i] + " != printed " + expected[i]);
  }
}

describe("cluster/MDS full R fixtures", () => {
  it("matches all hclust and cutree fixtures", () => {
    const du = usD;
    const du2 = { ...du, values: du.values.map((v) => v * v) };
    for (const method of hMethods) {
      compareH("hclust_usarrests_" + method, hclust(du, { method }));
      compareH("hclust_usarrests_sq_" + method, hclust(du2, { method }));
    }
    const hu = hclust(du, { method: "average" });
    compareCutree("cutree_k", cutree(hu, { k: 4 }));
    compareCutree("cutree_k_vector", cutree(hu, { k: [1, 3, 5, 50] }));
    compareCutree("cutree_h", cutree(hu, { h: 100 }));
    compareCutree("cutree_h_vector", cutree(hu, { h: [200, 50, 0] }));
    compareCutree("cutree_k_and_h", cutree(hu, { k: 3, h: 100 }));
    compareCutree("cutree_k_fraction", cutree(hu, { k: 2.5 }));
    compareCutree("cutree_h_exact", cutree(hu, { h: hu.height[39]! }));
    compareCutree("cutree_h_negative", cutree(hu, { h: -1 }));
    const hg = hclust(dist(grid, { labels: gridLabels }), { method: "single" });
    for (let k = 1; k <= 9; k++) compareCutree("cutree_grid_ties_k" + k, cutree(hg, { k }));
    compareCutree("cutree_grid_ties_h", cutree(hg, { h: 1 }));
    const hc = hclust(dist(tri), { method: "centroid" });
    compareCutree("cutree_inversion_k", cutree(hc, { k: 2 }));
    errorCase("cutree_inversion_h", () => cutree(hc, { h: 1 }), "h");
    compareCutree("cutree_no_labels", cutree(hclust(dist(small), { method: "complete" }), { k: 2 }));
    compareCutree("cutree_vector_labels", cutree(hclust(dist([3, 1, 4, 1, 5])), { k: 2 }));
    errorCase("cutree_k_zero", () => cutree(hu, { k: 0 }), "h");
    errorCase("cutree_k_too_big", () => cutree(hu, { k: 51 }), "h");
    errorCase("cutree_none", () => cutree(hu, {}), "h");
    expect(mismatches).toEqual([]);
  });

  it("matches all kmeans fixtures, including Hartigan-Wong, iteration limits and RNG tails", () => {
    const X = iris;
    const c3 = [0, 50, 100].map((i) => data.iris[i]!);
    const c3b = [0, 1, 2].map((i) => data.iris[i]!);
    const c4 = [0, 9, 19, 29].map((i) => data.usarrests[i]!);
    const k1 = [data.iris[4]!];
    const far = [small[0]!, small[1]!, [100, 100, 100]];
    const dup = [[1, 1], [1, 1], [1, 1], [2, 2]];
    const v = [1, 2, 3, 10, 11, 12, 30];
    const x03 = [[0], [1], [2], [3]];
    for (const a of algorithms) {
      compareK("kmeans_iris_" + a, kmeans(X, c3, { algorithm: a }));
      compareK("kmeans_iris_poor_start_" + a, kmeans(X, c3b, { algorithm: a }));
      compareK("kmeans_iris_iter1_" + a, kmeans(X, c3b, { algorithm: a, iterMax: 1 }));
      compareK("kmeans_usarrests_" + a, kmeans(us, c4, { algorithm: a }));
      compareK("kmeans_k1_" + a, kmeans(X, k1, { algorithm: a }));
      if (a === "Hartigan-Wong") errorCase("kmeans_k_equals_n_" + a, () => kmeans(smallTable, small, { algorithm: a }), "k");
      else compareK("kmeans_k_equals_n_" + a, kmeans(smallTable, small, { algorithm: a }));
      if (a === "Hartigan-Wong") errorCase("kmeans_empty_" + a, () => kmeans(smallTable, far, { algorithm: a }), "k");
      else compareK("kmeans_empty_" + a, kmeans(smallTable, far, { algorithm: a }));
      compareK("kmeans_duplicates_" + a, kmeans(dup, [dup[0]!, dup[3]!], { algorithm: a }));
      compareK("kmeans_vector_" + a, kmeans(v, [1, 10, 30], { algorithm: a }));
      compareK("kmeans_vector_center_matrix_" + a, kmeans(v, [[1], [30]], { algorithm: a }));
    }
    compareK("kmeans_data_frame", kmeans(us, c4));
    compareK("kmeans_scale", kmeans({ ...iris, values: data.iris.map((r) => r.map((v) => v * 1e150)) },
      c3.map((r) => r.map((v) => v * 1e150))));
    const smallu = small, starts3 = [smallu[0]!, smallu[2]!, smallu[4]!];
    for (const a of algorithms) for (let m = 1; m <= 5; m++) compareK("kmeans_iter_" + a + "_" + m, kmeans(smallu, starts3, { algorithm: a, iterMax: m }));
    for (const a of algorithms) compareK("kmeans_midpoint_" + a, kmeans([0, 2, 1], [0, 2], { algorithm: a, iterMax: 20 }));
    for (const a of algorithms) { setSeed(42); compareK("kmeans_seed_" + a, kmeans(X, 3, { algorithm: a })); }
    setSeed(1); compareK("kmeans_seed_nstart", kmeans(X, 3, { nstart: 10 }));
    setSeed(1); compareK("kmeans_seed_nstart_lloyd", kmeans(X, 4, { nstart: 5, algorithm: "Lloyd" }));
    setSeed(123); compareK("kmeans_seed_usarrests", kmeans(us, 4));
    errorCase("kmeans_seed_k_too_big", () => { setSeed(1); return kmeans(dup, 3); }, "k");
    setSeed(1); compareK("kmeans_seed_k_equals_distinct", kmeans(dup, 2));
    setSeed(7); compareK("kmeans_seed_vector", kmeans(v, 2));
    setSeed(7); compareK("kmeans_seed_nstart_vector", kmeans(v, 3, { nstart: 4 }));
    for (let seed = 1; seed <= 12; seed++) {
      setSeed(seed); const fit = kmeans(dup, 2); const tail = runif(3);
      compareK("kmeans_dup_start_seed_" + seed, fit);
      const expected = fixtures.k["kmeans_dup_start_seed_" + seed].value.tail;
      for (let i = 0; i < 3; i++) close("kmeans_dup_start_seed_" + seed + ".tail[" + i + "]", tail[i]!, num(expected[i]), 1e-12, "k");
    }
    for (let seed = 1; seed <= 8; seed++) {
      setSeed(seed); const fit = kmeans(x03, 2, { nstart: 8 }); const tail = runif(2);
      compareK("kmeans_equal_best_seed_" + seed, fit);
      const expected = fixtures.k["kmeans_equal_best_seed_" + seed].value.tail;
      for (let i = 0; i < 2; i++) close("kmeans_equal_best_seed_" + seed + ".tail[" + i + "]", tail[i]!, num(expected[i]), 1e-12, "k");
    }
    for (let seed = 1; seed <= 8; seed++) {
      setSeed(seed); const fit = kmeans(dup, 2, { nstart: 5 }); const tail = runif(2);
      compareK("kmeans_equal_best_dup_seed_" + seed, fit);
      const expected = fixtures.k["kmeans_equal_best_dup_seed_" + seed].value.tail;
      for (let i = 0; i < 2; i++) close("kmeans_equal_best_dup_seed_" + seed + ".tail[" + i + "]", tail[i]!, num(expected[i]), 1e-12, "k");
    }
    setSeed(42); const samples42 = sampleInt(150, { size: 3 }).map((v) => v + 1);
    if (JSON.stringify(samples42) !== JSON.stringify(fixtures.k.sample_int_150_3_seed42.value)) mismatches.push("sample_int_150_3_seed42");
    setSeed(1); const samples10 = Array.from({ length: 10 }, () => sampleInt(150, { size: 3 }).map((v) => v + 1));
    if (JSON.stringify(samples10) !== JSON.stringify(fixtures.k.sample_int_150_3_seed1_x10.value)) mismatches.push("sample_int_150_3_seed1_x10");
    setSeed(42); kmeans(X, 3); const tail1 = runif(3);
    for (let i = 0; i < 3; i++) close("kmeans_seed_state_after[" + i + "]", tail1[i]!, num(fixtures.k.kmeans_seed_state_after.value[i]), 1e-12, "k");
    setSeed(1); kmeans(X, 3, { nstart: 10 }); const tail2 = runif(3);
    for (let i = 0; i < 3; i++) close("kmeans_seed_state_after_nstart[" + i + "]", tail2[i]!, num(fixtures.k.kmeans_seed_state_after_nstart.value[i]), 1e-12, "k");
    setSeed(1); kmeans(X, c3); const tail3 = runif(3);
    for (let i = 0; i < 3; i++) close("kmeans_seed_state_after_matrix[" + i + "]", tail3[i]!, num(fixtures.k.kmeans_seed_state_after_matrix.value[i]), 1e-12, "k");
    errorCase("kmeans_duplicate_centers", () => kmeans(dup, [dup[0]!, dup[1]!]), "k");
    errorCase("kmeans_wrong_columns", () => kmeans(X, c3.map((r) => r.slice(0, 3))), "k");
    compareK("kmeans_partial_name", kmeans(X, c3, { algorithm: "Mac" }));
    errorCase("kmeans_bad_algorithm", () => kmeans(X, c3, { algorithm: "Elkan" }), "k");
    errorCase("kmeans_iter_zero", () => kmeans(X, c3, { iterMax: 0 }), "k");
    const nax = data.iris.map((r) => [...r]); nax[2]![1] = NaN;
    errorCase("kmeans_na", () => kmeans({ ...iris, values: nax }, c3), "k");
    expect(mismatches).toEqual([]);
  });

  it("matches all cmdscale fixtures, including Cailliez and asymmetric matrices", () => {
    const cSmall = dist(small, { labels: smallTable.rows });
    const line = dist([0, 1, 3, 6]);
    const simplex = asDist(Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 0 : 1)));
    const zero = dist([1, 1, 2, 5]);
    const dsNoNames = dist(small);
    const non = asDist(nonE);
    const asymMean = M3.map((r, i) => r.map((v, j) => (v + M3[j]![i]!) / 2));
    compareC("cmdscale_eurodist", cmdscale(euroD));
    compareC("cmdscale_eurodist_list", cmdscale(euroD, { k: 2 }));
    compareC("cmdscale_eurodist_k3_all", cmdscale(euroD, { k: 3, xRet: true }));
    compareC("cmdscale_eurodist_add", cmdscale(euroD, { k: 2, add: true }));
    compareC("cmdscale_eurodist_add_k1", cmdscale(euroD, { k: 1, add: true, xRet: true }));
    compareC("cmdscale_usarrests", cmdscale(usD, { k: 3 }));
    compareC("cmdscale_usarrests_add", cmdscale(usD, { k: 2, add: true }));
    compareC("cmdscale_list_only", cmdscale(euroD, { k: 2 }));
    for (let k = 1; k <= 4; k++) compareC("cmdscale_small_k" + k, cmdscale(cSmall, { k }));
    compareC("cmdscale_small_add", cmdscale(cSmall, { k: 2, add: true }));
    compareC("cmdscale_non_euclidean", cmdscale(non, { k: 2 }));
    compareC("cmdscale_non_euclidean_k3", cmdscale(non, { k: 3 }));
    compareC("cmdscale_non_euclidean_add", cmdscale(non, { k: 3, add: true }));
    compareC("cmdscale_line_k2", cmdscale(line, { k: 2 }));
    compareC("cmdscale_line_k1", cmdscale(line, { k: 1 }));
    compareC("cmdscale_line_add", cmdscale(line, { k: 1, add: true }));
    compareC("cmdscale_simplex", cmdscale(simplex, { k: 2 }));
    compareC("cmdscale_k_n_minus_1", cmdscale(cSmall, { k: 4 }));
    compareC("cmdscale_two", cmdscale(dist([1, 4]), { k: 1 }));
    compareC("cmdscale_zero_distances", cmdscale(zero, { k: 1 }));
    compareC("cmdscale_no_labels", cmdscale(dsNoNames, { k: 2 }));
    compareC("cmdscale_scale", cmdscale({ ...cSmall, values: cSmall.values.map((v) => v * 1e150) }, { k: 2 }));
    compareC("cmdscale_scale_small", cmdscale({ ...cSmall, values: cSmall.values.map((v) => v * 1e-150) }, { k: 2 }));
    compareC("cmdscale_asymmetric", cmdscale(M3, { k: 2 }));
    compareC("cmdscale_asym_matrix", cmdscale(M3, { k: 2, xRet: true }));
    compareC("cmdscale_asym_lower", cmdscale(asDist(M3), { k: 2, xRet: true }));
    compareC("cmdscale_asym_upper", cmdscale(asDist(M3[0]!.map((_, j) => M3.map((r) => r[j]!)),), { k: 2, xRet: true }));
    compareC("cmdscale_asym_mean", cmdscale(asDist(asymMean), { k: 2, xRet: true }));
    compareC("cmdscale_matrix", cmdscale({ rows: smallTable.rows, cols: smallTable.rows, values: distMatrix(cSmall) }, { k: 2 }));
    errorCase("cmdscale_k_too_big", () => cmdscale(cSmall, { k: 5 }), "c");
    errorCase("cmdscale_k_zero", () => cmdscale(cSmall, { k: 0 }), "c");
    errorCase("cmdscale_one", () => cmdscale(dist([1]), { k: 1 }), "c");
    errorCase("cmdscale_na", () => cmdscale(asDist([[0, 1, NaN], [1, 0, 2], [NaN, 2, 0]]), { k: 1 }), "c");
    expect(mismatches).toEqual([]);
  });

  it("matches isoMDS defaults, explicit starts, trace and scale-invariant behavior", () => {
    const smallD = dist(small, { labels: smallTable.rows });
    const gridD = dist(grid, { labels: gridLabels });
    const perturbed = grid.map((r, i) => [r[0]! + 0.1 * Math.sin(i + 1), r[1]! + 0.1 * Math.cos(i + 1)]);
    const small2D = dist(small.map((r) => r.slice(0, 2)));
    const line = dist([0, 1, 3, 6, 10]);
    const non = asDist(nonE);
    compareI("isomds_swiss", isoMDS(swissD));
    compareI("isomds_swiss_k3", isoMDS(swissD, { k: 3 }));
    compareI("isomds_swiss_maxit5", isoMDS(swissD, { maxit: 5 }));
    const maxit0 = isoMDS(swissD, { maxit: 0 });
    close("isomds_swiss_maxit0.stress", maxit0.stress, num(fixtures.i.isomds_swiss_maxit0.value.stress), 1e-8, "i");
    compareI("isomds_swiss_tol", isoMDS(swissD, { tol: 1e-8, maxit: 500 }), 1e-6);
    compareI("isomds_swiss_p1", isoMDS(swissD, { p: 1 }));
    compareI("isomds_swiss_p3", isoMDS(swissD, { p: 3 }));
    compareI("isomds_swiss_y", isoMDS(swissD, { y: data.swiss.map((r) => [r[1]!, r[2]!]) }));
    compareI("isomds_swiss_y_k1", isoMDS(swissD, { y: data.swiss.map((r) => [r[0]!]), k: 1 }));
    errorCase("isomds_swiss_y_wrong", () => isoMDS(swissD, { y: data.swiss.slice(0, 10).map((r) => r.slice(0, 2)) }), "i");
    compareI("isomds_swiss_trace", isoMDS(swissD, { maxit: 3 }));
    compareI("isomds_eurodist", isoMDS(euroD));
    compareI("isomds_usarrests", isoMDS(usD));
    compareI("isomds_small", isoMDS(smallD));
    compareI("isomds_small_k1", isoMDS(smallD, { k: 1 }), 1e-5);
    compareI("isomds_non_euclidean", isoMDS(non));
    compareI("isomds_grid_ties", isoMDS(gridD, { y: perturbed }), 1e-5);
    compareI("isomds_grid_ties_default", isoMDS(gridD));
    compareI("isomds_perfect", isoMDS(small2D));
    compareI("isomds_line", isoMDS(line, { k: 1 }));
    compareI("isomds_three", isoMDS(dist([0, 1, 3]), { k: 1 }));
    compareI("isomds_two", isoMDS(dist([0, 1]), { k: 1 }));
    errorCase("isomds_zero_distance", () => isoMDS(dist([1, 1, 2, 5]), { k: 1 }), "i");
    errorCase("isomds_negative", () => isoMDS(asDist([[0, -1, 2], [-1, 0, 3], [2, 3, 0]]), { k: 1 }), "i");
    errorCase("isomds_na", () => isoMDS(asDist([[0, 1, NaN, 1], [1, 0, 2, 3], [NaN, 2, 0, 1], [1, 3, 1, 0]]), { k: 1 }), "i");
    errorCase("isomds_matrix", () => isoMDS(distMatrix(smallD)), "i");
    errorCase("isomds_k_too_big", () => isoMDS(smallD, { k: 5 }), "i");
    const scaleD = { ...swissD, values: swissD.values.map((v) => v * 1e150) };
    const scaleFit = isoMDS(scaleD);
    close("isomds_scale.stress", scaleFit.stress, isoMDS(swissD).stress, 1e-8, "i");
    const y0 = cmdscale(swissD).points.values.map((r) => r.map((v) => v * 1e100));
    const scaledStart = isoMDS(swissD, { y: y0 });
    if (!Number.isFinite(scaledStart.stress)) mismatches.push("isomds_scale_y non-finite stress");
    expect(mismatches).toEqual([]);
  });

  it("records fixture comparison maxima", () => {
    console.info("hclust: 82 trees; max relative height error " + maxHHeightError.toExponential(3));
    console.info("kmeans: 114 cases; max relative numeric error " + maxKError.toExponential(3));
    console.info("cmdscale: 36 cases; max relative numeric error " + maxCError.toExponential(3));
    console.info("isoMDS: 29 cases; max relative numeric error " + maxIStressError.toExponential(3));
    expect(mismatches).toEqual([]);
  });
});
