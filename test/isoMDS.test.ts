import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, cmdscale, dist, isoMDS, type IsoMDSResult } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/isomds.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxTightStressRelativeError = 0;
let maxTightStressAbsoluteError = 0;
let maxTightCoordinateError = 0;
let tightCompared = 0;
const comparedFixtures = new Set<string>();
const progressCompared = new Set<string>();
function close(label: string, actual: number, expected: number, tol: number): void {
  const error = Math.abs(actual - expected);
  if (error > tol) mismatches.push(label + ": " + actual + " != " + expected + " (abs=" + error + ")");
}
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function centerPoints(points:number[][]):number[][] {
  const dim=points[0]?.length??0;
  const means=Array.from({length:dim},(_,j)=>points.reduce((s,row)=>s+row[j]!,0)/points.length);
  return points.map(row=>row.map((v,j)=>v-means[j]!));
}
function compare(key: string, actual: IsoMDSResult): void {
  comparedFixtures.add(key);
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing fixture`); return; }
  const points = expected.points.values;
  if (JSON.stringify(actual.points.rows) !== JSON.stringify(expected.points.rows ?? null)) mismatches.push(`${key}.points.rows differ`);
  if (JSON.stringify(actual.points.cols) !== JSON.stringify(expected.points.cols ?? null)) mismatches.push(`${key}.points.cols differ`);
  const e = num(expected.stress);
  const error = Math.abs(actual.stress - e);

  const tight = key.startsWith("isomds_tight_");
  const expectedMax = points.reduce((m: number, row: unknown[]) => row.reduce<number>((v, x) => Math.max(v, Math.abs(num(x))), m), 0);
  const dim = points[0]?.length ?? 0;
  let coordinateError = 0;
  {
    let actualPoints = centerPoints(actual.points.values.map((row) => [...row]));
    const expectedPoints = centerPoints(points.map((row: unknown[]) => row.map(num)));
    if (actualPoints.length !== expectedPoints.length ||
        actualPoints.some((row) => row.length !== dim) ||
        expectedPoints.some((row) => row.length !== dim)) {
      mismatches.push(`${key}.points.values dimensions differ`);
      return;
    }
    // BFGS starts at cmdscale and is equivariant under independent column
    // reflections; choice 12 requires this alignment, not a fitted rotation.
    for (let j = 0; j < dim; j++) {
      let dot = 0;
      for (let i = 0; i < points.length; i++) dot += actualPoints[i]![j]! * expectedPoints[i]![j]!;
      if (dot < 0) actualPoints = actualPoints.map((row) => row.map((v, q) => q === j ? -v : v));
    }
    for (let i = 0; i < Math.min(points.length, actualPoints.length); i++) {
      for (let j = 0; j < dim; j++) coordinateError = Math.max(coordinateError, Math.abs(actualPoints[i]![j]! - expectedPoints[i]![j]!));
    }
    const coordinateLimit = 1e-7 * expectedMax;
    if (tight) {
      if (!actual.trace[actual.trace.length - 1]?.converged) mismatches.push(key + ".trace did not converge");
      maxTightCoordinateError = Math.max(maxTightCoordinateError, coordinateError);
      tightCompared++;
    }
    if (coordinateError > coordinateLimit) mismatches.push(`${key}.coordinate max error=${coordinateError} (limit ${coordinateLimit})`);
  }
  {
    const printedRaw = expected.printed === undefined ? [] : Array.isArray(expected.printed) ? expected.printed : [expected.printed];
    if (printedRaw.length > 0) {
      const initialLine = printedRaw.find((line: string) => /initial\s+value/.test(line));
      const finalLine = printedRaw.find((line: string) => /final\s+value/.test(line));
      const initialValue = initialLine === undefined ? null : Number(/initial\s+value\s+([0-9.eE+-]+)/.exec(initialLine)?.[1]);
      const finalValue = finalLine === undefined ? null : Number(/final\s+value\s+([0-9.eE+-]+)/.exec(finalLine)?.[1]);
      const expectedProgress = printedRaw.map((line: string) => /iter\s+(\d+)\s+value\s+([0-9.eE+-]+)/.exec(line))
        .filter(Boolean).map((match: RegExpExecArray) => ({ iteration: Number(match[1]), stress: Number(match[2]) }));
      const collapsedProgress = expectedProgress.filter((value: { iteration: number; stress: number }, index: number, values: { iteration: number; stress: number }[]) =>
        index === 0 || value.iteration !== values[index - 1]!.iteration || value.stress !== values[index - 1]!.stress);
      const actualProgress = actual.trace.slice(1, -1);
      if (initialValue !== null && actual.trace.length > 0 && Number(actual.trace[0]!.stress.toFixed(6)) !== initialValue) {
        mismatches.push(key + ".printed initial stress differs");
      }
      if (collapsedProgress.length !== actualProgress.length) {
        mismatches.push(key + ".printed progress count " + actualProgress.length + " vs R " + collapsedProgress.length);
      }
      for (let i = 0; i < Math.min(collapsedProgress.length, actualProgress.length); i++) {
        if (Number(actualProgress[i]!.stress.toFixed(6)) !== collapsedProgress[i]!.stress) mismatches.push(key + ".printed progress[" + i + "] differs");
      }
      if (finalValue !== null && actual.trace.length > 0 && Number(actual.trace[actual.trace.length - 1]!.stress.toFixed(6)) !== finalValue) {
        mismatches.push(key + ".printed final stress differs");
      }
      const stopped = printedRaw.map((line: string) => /stopped after\s+(\d+) iterations/.exec(line)?.[1]).find((v: string | undefined) => v !== undefined);
      if (stopped !== undefined && actual.trace[actual.trace.length - 1]!.iteration !== Number(stopped)) {
        mismatches.push(key + ".iteration count " + actual.trace[actual.trace.length - 1]!.iteration + " vs R " + stopped);
      }
      if (printedRaw.some((line: string) => line.trim() === "converged") && !actual.trace[actual.trace.length - 1]?.converged) {
        mismatches.push(key + ".R converged but trace did not");
      }
      progressCompared.add(key);
    }
    const relativeStressError = error / Math.max(Math.abs(e), 1e-300);
    const useAbsoluteStress = Math.abs(e) < 1e-10;
    if (tight) {
      if (!useAbsoluteStress) maxTightStressRelativeError = Math.max(maxTightStressRelativeError, relativeStressError);
      maxTightStressAbsoluteError = Math.max(maxTightStressAbsoluteError, error);
    }
    if (useAbsoluteStress ? error > 1e-12 : relativeStressError > 1e-9) {
      mismatches.push(`${key}.stress ${useAbsoluteStress ? "absolute" : "relative"} error=${useAbsoluteStress ? error : relativeStressError}`);
    }
  }

  // Progress is checked separately against the public R print strings.
}
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const smallLabels = ["a", "b", "c", "d", "e"];
const gridLabels = Array.from({ length: 9 }, (_, i) => "g" + (i + 1));
const ds = dist(small, { labels: smallLabels });
const grid = Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)]);
const perturbed = grid.map((r, i) => [r[0]! + 0.1 * Math.sin(i + 1), r[1]! + 0.1 * Math.cos(i + 1)]);
const nonE = asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]);

describe("isoMDS", () => {
  it("matches Kruskal stress on exact Euclidean and low-dimensional fixtures", () => {
    compare("isomds_small", isoMDS(ds));
    compare("isomds_small_k1", isoMDS(ds, { k: 1 }));
    compare("isomds_perfect", isoMDS(dist(small.map((r) => r.slice(0, 2)), { labels: smallLabels })));
    const smallDistanceMatrix=small.map((a)=>small.map((b)=>Math.sqrt(a.reduce((sum,v,j)=>sum+(v-b[j]!)**2,0))));
    compare("isomds_matrix",isoMDS(asDist(smallDistanceMatrix,{labels:smallLabels})));
    compare("isomds_line", isoMDS(dist([0, 1, 3, 6, 10]), { k: 1 }));
    compare("isomds_three", isoMDS(dist([0, 1, 3]), { k: 1 }));
    compare("isomds_two", isoMDS(dist([0, 1]), { k: 1 }));
    compare("isomds_non_euclidean", isoMDS(nonE));
    compare("isomds_grid_ties_default", isoMDS(dist(grid, { labels: gridLabels })));
  });

  it("uses the fixed tie order, explicit starts, progress and zero-iteration behavior", () => {
    const tied = isoMDS(dist(grid, { labels: gridLabels }), { y: perturbed });
    compare("isomds_grid_ties", tied);
    const stopped = isoMDS(ds, { maxit: 0 });
    if (stopped.trace.length !== 1 || stopped.trace[0]!.iteration !== 0 || !stopped.trace[0]!.converged) {
      mismatches.push("maxit=0 trace does not report the initial configuration");
    }
    const limited = isoMDS(ds, { maxit: 5 });
    if (!limited.trace.some((v) => v.iteration === 5)) mismatches.push("trace omitted iteration 5");
    expect(mismatches).toEqual([]);
  });

  it("follows R's scale-dependent paths and validates missing, nonpositive and malformed inputs", () => {
    const errors: Array<[string, () => unknown]> = [
      ["isomds_zero_distance", () => isoMDS(dist([1, 1, 2, 5]), { k: 1 })],
      ["isomds_negative", () => isoMDS(asDist([[0, -1, 2], [-1, 0, 3], [2, 3, 0]]), { k: 1 })],
      ["isomds_na", () => isoMDS(asDist([[0, 1, NaN, 1], [1, 0, 2, 3], [NaN, 2, 0, 1], [1, 3, 1, 0]]), { k: 1 })],
      ["isomds_k_too_big", () => isoMDS(ds, { k: 5 })],
      ["isomds_swiss_y_wrong", () => isoMDS(ds, { y: [[1, 2], [3, 4]] })],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) { mismatches.push(key + ": missing error fixture"); continue; }
      try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ }
      comparedFixtures.add(key);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("isoMDS: swiss, eurodist and USArrests R fixtures", () => {
  const swissData = [[80.2,17,15,12,9.96,22.2],[83.1,45.1,6,9,84.84,22.2],[92.5,39.7,5,5,93.4,20.2],[85.8,36.5,12,7,33.77,20.3],[76.9,43.5,17,15,5.16,20.6],[76.1,35.3,9,7,90.57,26.6],[83.8,70.2,16,7,92.85,23.6],[92.4,67.8,14,8,97.16,24.9],[82.4,53.3,12,7,97.67,21],[82.9,45.2,16,13,91.38,24.4],[87.1,64.5,14,6,98.61,24.5],[64.1,62,21,12,8.52,16.5],[66.9,67.5,14,7,2.27,19.1],[68.9,60.7,19,12,4.43,22.7],[61.7,69.3,22,5,2.82,18.7],[68.3,72.6,18,2,24.2,21.2],[71.7,34,17,8,3.3,20],[55.7,19.4,26,28,12.11,20.2],[54.3,15.2,31,20,2.15,10.8],[65.1,73,19,9,2.84,20],[65.5,59.8,22,10,5.23,18],[65,55.1,14,3,4.52,22.4],[56.6,50.9,22,12,15.14,16.7],[57.4,54.1,20,6,4.2,15.3],[72.5,71.2,12,1,2.4,21],[74.2,58.1,14,8,5.23,23.8],[72,63.5,6,3,2.56,18],[60.5,60.8,16,10,7.72,16.3],[58.3,26.8,25,19,18.46,20.9],[65.4,49.5,15,8,6.1,22.5],[75.5,85.9,3,2,99.71,15.1],[69.3,84.9,7,6,99.68,19.8],[77.3,89.7,5,2,100,18.3],[70.5,78.2,12,6,98.96,19.4],[79.4,64.9,7,3,98.22,20.2],[65,75.9,9,9,99.06,17.8],[92.2,84.6,3,3,99.46,16.3],[79.3,63.1,13,13,96.83,18.1],[70.4,38.4,26,12,5.62,20.3],[65.7,7.7,29,11,13.79,20.5],[72.7,16.7,22,13,11.22,18.9],[64.4,17.6,35,32,16.92,23],[77.6,37.6,15,7,4.97,20],[67.6,18.7,25,7,8.65,19.5],[35,1.2,37,53,42.34,18],[44.7,46.6,16,29,50.43,18.2],[42.8,27.7,22,29,58.33,19.3]];
  const euroData = [[0,3313,2963,3175,3339,2762,3276,2610,4485,2977,3030,4532,2753,3949,2865,2282,2179,3000,817,3927,1991],[3313,0,1318,1326,1294,1498,2218,803,1172,2018,1490,1305,645,636,521,1014,1365,1033,1460,2868,1802],[2963,1318,0,204,583,206,966,677,2256,597,172,2084,690,1558,1011,925,747,285,1511,1616,1175],[3175,1326,204,0,460,409,1136,747,2224,714,330,2052,739,1550,1059,1077,977,280,1662,1786,1381],[3339,1294,583,460,0,785,1545,853,2047,1115,731,1827,789,1347,1101,1209,1160,340,1794,2196,1588],[2762,1498,206,409,785,0,760,1662,2436,460,269,2290,714,1764,1035,911,583,465,1497,1403,937],[3276,2218,966,1136,1545,760,0,1418,3196,460,269,2971,1458,2498,1778,1537,1104,1176,2050,650,1455],[2610,803,677,747,853,1662,1418,0,1975,1118,895,1936,158,1439,425,328,591,513,995,2068,1019],[4485,1172,2256,2224,2047,2436,3196,1975,0,2897,2428,676,1817,698,1693,2185,2565,1971,2631,3886,2974],[2977,2018,597,714,1115,460,460,1118,2897,0,550,2671,1159,2198,1479,1238,805,877,1751,949,1155],[3030,1490,172,330,731,269,269,895,2428,550,0,2280,863,1730,1183,1098,851,457,1683,1500,1205],[4532,1305,2084,2052,1827,2290,2971,1936,676,2671,2280,0,1178,668,1762,2250,2507,1799,2700,3231,2937],[2753,645,690,739,789,714,1458,158,1817,1159,863,1178,0,1281,320,328,724,471,1048,2108,1157],[3949,636,1558,1550,1347,1764,2498,1439,698,2198,1730,668,1281,0,1157,1724,2010,1273,2097,3188,2409],[2865,521,1011,1059,1101,1035,1778,425,1693,1479,1183,1762,320,1157,0,618,1109,792,1011,2428,1363],[2282,1014,925,1077,1209,911,1537,328,2185,1238,1098,2250,328,1724,618,0,331,856,586,2187,898],[2179,1365,747,977,1160,583,1104,591,2565,805,851,2507,724,2010,1109,331,0,821,946,1754,428],[3000,1033,285,280,340,465,1176,513,1971,877,457,1799,471,1273,792,856,821,0,1476,1827,1249],[817,1460,1511,1662,1794,1497,2050,995,2631,1751,1683,2700,1048,2097,1011,586,946,1476,0,2707,1209],[3927,2868,1616,1786,2196,1403,650,2068,3886,949,1500,3231,2108,3188,2428,2187,1754,1827,2707,0,2105],[1991,1802,1175,1381,1588,937,1455,1019,2974,1155,1205,2937,1157,2409,1363,898,428,1249,1209,2105,0]];
  const usData = [[13.2,236,58,21.2],[10,263,48,44.5],[8.1,294,80,31],[8.8,190,50,19.5],[9,276,91,40.6],[7.9,204,78,38.7],[3.3,110,77,11.1],[5.9,238,72,15.8],[15.4,335,80,31.9],[17.4,211,60,25.8],[5.3,46,83,20.2],[2.6,120,54,14.2],[10.4,249,83,24],[7.2,113,65,21],[2.2,56,57,11.3],[6,115,66,18],[9.7,109,52,16.3],[15.4,249,66,22.2],[2.1,83,51,7.8],[11.3,300,67,27.8],[4.4,149,85,16.3],[12.1,255,74,35.1],[2.7,72,66,14.9],[16.1,259,44,17.1],[9,178,70,28.2],[6,109,53,16.4],[4.3,102,62,16.5],[12.2,252,81,46],[2.1,57,56,9.5],[7.4,159,89,18.8],[11.4,285,70,32.1],[11.1,254,86,26.1],[13,337,45,16.1],[0.8,45,44,7.3],[7.3,120,75,21.4],[6.6,151,68,20],[4.9,159,67,29.3],[6.3,106,72,14.9],[3.4,174,87,8.3],[14.4,279,48,22.5],[3.8,86,45,12.8],[13.2,188,59,26.9],[12.7,201,80,25.5],[3.2,120,80,22.9],[2.2,48,32,11.2],[8.5,156,63,20.7],[4,145,73,26.2],[5.7,81,39,9.3],[2.6,53,66,10.8],[6.8,161,60,15.6]];
  const swissNames = fixture.isomds_swiss.value.points.rows as string[];
  const euroNames = fixture.isomds_eurodist.value.points.rows as string[];
  const usNames = fixture.isomds_usarrests.value.points.rows as string[];
  const swissD = dist(swissData, { labels: swissNames });
  const euroD = asDist(euroData, { labels: euroNames });
  const usD = dist(usData, { labels: usNames });

  it("preserves labels and scales for the large-coordinate fixtures", () => {
    const scaledSwissD = { ...swissD, values: swissD.values.map((v) => v * 1e150) };
    compare("isomds_scale", isoMDS(scaledSwissD));
    const scaledStart = cmdscale(swissD).points.values.map((row) => row.map((v) => v * 1e100));
    compare("isomds_scale_y", isoMDS(swissD, { y: scaledStart }));
  });

  it("matches all public-data starts, dimensions, tolerances, Minkowski powers and printed progress", () => {
    compare("isomds_swiss", isoMDS(swissD));
    compare("isomds_swiss_k3", isoMDS(swissD, { k: 3 }));
    compare("isomds_swiss_maxit5", isoMDS(swissD, { maxit: 5 }));
    compare("isomds_swiss_maxit0", isoMDS(swissD, { maxit: 0 }));
    compare("isomds_swiss_tol", isoMDS(swissD, { tol: 1e-8, maxit: 500 }));
    compare("isomds_swiss_p1", isoMDS(swissD, { p: 1 }));
    compare("isomds_swiss_p3", isoMDS(swissD, { p: 3 }));
    compare("isomds_swiss_y", isoMDS(swissD, { y: swissData.map((r) => [r[1]!, r[2]!]) }));
    compare("isomds_swiss_y_k1", isoMDS(swissD, { y: swissData.map((r) => [r[0]!]), k: 1 }));
    try { isoMDS(swissD, { y: swissData.slice(0, 10).map((r) => r.slice(0, 2)) }); mismatches.push("isomds_swiss_y_wrong: expected error"); } catch { /* expected */ }
    comparedFixtures.add("isomds_swiss_y_wrong");
    compare("isomds_swiss_trace", isoMDS(swissD, { maxit: 3 }));
    compare("isomds_eurodist", isoMDS(euroD));
    compare("isomds_usarrests", isoMDS(usD));
    // Tight R references use tol=1e-10/maxit=5000. Relative stress tolerance
    // is 1e-6; coordinate scale tolerance is 1e-5 after removing orthogonal freedom.
    compare("isomds_tight_swiss", isoMDS(swissD, { tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_swiss_k3", isoMDS(swissD, { k: 3, tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_swiss_p1", isoMDS(swissD, { p: 1, tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_swiss_p3", isoMDS(swissD, { p: 3, tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_eurodist", isoMDS(euroD, { tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_usarrests", isoMDS(usD, { tol: 1e-10, maxit: 5000 }));
    expect(mismatches).toEqual([]);
  });

  it("matches the small, non-Euclidean, tied and degenerate fixtures", () => {
    const smallD = dist(small, { labels: smallLabels });
    const grid = Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)]);
    const gridD = dist(grid, { labels: gridLabels });
    const perturbed = grid.map((r, i) => [r[0]! + 0.1 * Math.sin(i + 1), r[1]! + 0.1 * Math.cos(i + 1)]);
    const nonE = asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]);
    compare("isomds_small", isoMDS(smallD));
    compare("isomds_small_k1", isoMDS(smallD, { k: 1 }));
    compare("isomds_non_euclidean", isoMDS(nonE));
    compare("isomds_grid_ties", isoMDS(gridD, { y: perturbed }));
    compare("isomds_grid_ties_default", isoMDS(gridD));
    compare("isomds_tight_small", isoMDS(smallD, { tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_small_k1", isoMDS(smallD, { k: 1, tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_non_euclidean", isoMDS(nonE, { tol: 1e-10, maxit: 5000 }));
    compare("isomds_tight_grid_ties", isoMDS(gridD, { y: perturbed, tol: 1e-10, maxit: 5000 }));
    compare("isomds_perfect", isoMDS(dist(small.map((r) => r.slice(0, 2)), { labels: smallLabels })));
    compare("isomds_line", isoMDS(dist([0, 1, 3, 6, 10]), { k: 1 }));
    compare("isomds_three", isoMDS(dist([0, 1, 3]), { k: 1 }));
    compare("isomds_two", isoMDS(dist([0, 1]), { k: 1 }));
    expect(mismatches).toEqual([]);
  });

  it("tests all invalid-input cases", () => {
    const errors: Array<[string, () => unknown]> = [
      ["isomds_zero_distance", () => isoMDS(dist([1, 1, 2, 5]), { k: 1 })],
      ["isomds_negative", () => isoMDS(asDist([[0, -1, 2], [-1, 0, 3], [2, 3, 0]]), { k: 1 })],
      ["isomds_na", () => isoMDS(asDist([[0, 1, NaN, 1], [1, 0, 2, 3], [NaN, 2, 0, 1], [1, 3, 1, 0]]), { k: 1 })],
      ["isomds_k_too_big", () => isoMDS(dist(small), { k: 5 })],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) mismatches.push(key + ": missing error fixture");
      else { try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ } }
    }
    console.info(`isoMDS fixture comparisons: ${comparedFixtures.size}/${Object.keys(fixture).length}; printed progress: ${progressCompared.size}; tight choice-12: ${tightCompared}/10; max tight absolute stress error=${maxTightStressAbsoluteError.toExponential(3)}; max tight relative stress error=${maxTightStressRelativeError.toExponential(3)}; max sign-aligned coordinate error=${maxTightCoordinateError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });

});
