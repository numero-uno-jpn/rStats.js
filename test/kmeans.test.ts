import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kmeans, type KmeansFit } from "../src/entries/multivariate.js";
import { setSeed, runif, sampleInt } from "../src/entries/distributions.js";

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
  ] as const) if (expectedValue !== undefined) close(`${key}.${field}`, actualValue, num(expectedValue));
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
function compareTail(key: string, actual: number[], expected: unknown): void {
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
    compareTail("kmeans_dup_start_seed_3.tail", runif(3), fixture.kmeans_dup_start_seed_3.value.tail);
    setSeed(1);
    compare("kmeans_equal_best_seed_1", kmeans(x03, 2, { nstart: 8 }));
    compareTail("kmeans_equal_best_seed_1.tail", runif(2), fixture.kmeans_equal_best_seed_1.value.tail);
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

describe("kmeans: complete R fixtures", () => {
  const irisData = [[5.1,3.5,1.4,0.2],[4.9,3,1.4,0.2],[4.7,3.2,1.3,0.2],[4.6,3.1,1.5,0.2],[5,3.6,1.4,0.2],[5.4,3.9,1.7,0.4],[4.6,3.4,1.4,0.3],[5,3.4,1.5,0.2],[4.4,2.9,1.4,0.2],[4.9,3.1,1.5,0.1],[5.4,3.7,1.5,0.2],[4.8,3.4,1.6,0.2],[4.8,3,1.4,0.1],[4.3,3,1.1,0.1],[5.8,4,1.2,0.2],[5.7,4.4,1.5,0.4],[5.4,3.9,1.3,0.4],[5.1,3.5,1.4,0.3],[5.7,3.8,1.7,0.3],[5.1,3.8,1.5,0.3],[5.4,3.4,1.7,0.2],[5.1,3.7,1.5,0.4],[4.6,3.6,1,0.2],[5.1,3.3,1.7,0.5],[4.8,3.4,1.9,0.2],[5,3,1.6,0.2],[5,3.4,1.6,0.4],[5.2,3.5,1.5,0.2],[5.2,3.4,1.4,0.2],[4.7,3.2,1.6,0.2],[4.8,3.1,1.6,0.2],[5.4,3.4,1.5,0.4],[5.2,4.1,1.5,0.1],[5.5,4.2,1.4,0.2],[4.9,3.1,1.5,0.2],[5,3.2,1.2,0.2],[5.5,3.5,1.3,0.2],[4.9,3.6,1.4,0.1],[4.4,3,1.3,0.2],[5.1,3.4,1.5,0.2],[5,3.5,1.3,0.3],[4.5,2.3,1.3,0.3],[4.4,3.2,1.3,0.2],[5,3.5,1.6,0.6],[5.1,3.8,1.9,0.4],[4.8,3,1.4,0.3],[5.1,3.8,1.6,0.2],[4.6,3.2,1.4,0.2],[5.3,3.7,1.5,0.2],[5,3.3,1.4,0.2],[7,3.2,4.7,1.4],[6.4,3.2,4.5,1.5],[6.9,3.1,4.9,1.5],[5.5,2.3,4,1.3],[6.5,2.8,4.6,1.5],[5.7,2.8,4.5,1.3],[6.3,3.3,4.7,1.6],[4.9,2.4,3.3,1],[6.6,2.9,4.6,1.3],[5.2,2.7,3.9,1.4],[5,2,3.5,1],[5.9,3,4.2,1.5],[6,2.2,4,1],[6.1,2.9,4.7,1.4],[5.6,2.9,3.6,1.3],[6.7,3.1,4.4,1.4],[5.6,3,4.5,1.5],[5.8,2.7,4.1,1],[6.2,2.2,4.5,1.5],[5.6,2.5,3.9,1.1],[5.9,3.2,4.8,1.8],[6.1,2.8,4,1.3],[6.3,2.5,4.9,1.5],[6.1,2.8,4.7,1.2],[6.4,2.9,4.3,1.3],[6.6,3,4.4,1.4],[6.8,2.8,4.8,1.4],[6.7,3,5,1.7],[6,2.9,4.5,1.5],[5.7,2.6,3.5,1],[5.5,2.4,3.8,1.1],[5.5,2.4,3.7,1],[5.8,2.7,3.9,1.2],[6,2.7,5.1,1.6],[5.4,3,4.5,1.5],[6,3.4,4.5,1.6],[6.7,3.1,4.7,1.5],[6.3,2.3,4.4,1.3],[5.6,3,4.1,1.3],[5.5,2.5,4,1.3],[5.5,2.6,4.4,1.2],[6.1,3,4.6,1.4],[5.8,2.6,4,1.2],[5,2.3,3.3,1],[5.6,2.7,4.2,1.3],[5.7,3,4.2,1.2],[5.7,2.9,4.2,1.3],[6.2,2.9,4.3,1.3],[5.1,2.5,3,1.1],[5.7,2.8,4.1,1.3],[6.3,3.3,6,2.5],[5.8,2.7,5.1,1.9],[7.1,3,5.9,2.1],[6.3,2.9,5.6,1.8],[6.5,3,5.8,2.2],[7.6,3,6.6,2.1],[4.9,2.5,4.5,1.7],[7.3,2.9,6.3,1.8],[6.7,2.5,5.8,1.8],[7.2,3.6,6.1,2.5],[6.5,3.2,5.1,2],[6.4,2.7,5.3,1.9],[6.8,3,5.5,2.1],[5.7,2.5,5,2],[5.8,2.8,5.1,2.4],[6.4,3.2,5.3,2.3],[6.5,3,5.5,1.8],[7.7,3.8,6.7,2.2],[7.7,2.6,6.9,2.3],[6,2.2,5,1.5],[6.9,3.2,5.7,2.3],[5.6,2.8,4.9,2],[7.7,2.8,6.7,2],[6.3,2.7,4.9,1.8],[6.7,3.3,5.7,2.1],[7.2,3.2,6,1.8],[6.2,2.8,4.8,1.8],[6.1,3,4.9,1.8],[6.4,2.8,5.6,2.1],[7.2,3,5.8,1.6],[7.4,2.8,6.1,1.9],[7.9,3.8,6.4,2],[6.4,2.8,5.6,2.2],[6.3,2.8,5.1,1.5],[6.1,2.6,5.6,1.4],[7.7,3,6.1,2.3],[6.3,3.4,5.6,2.4],[6.4,3.1,5.5,1.8],[6,3,4.8,1.8],[6.9,3.1,5.4,2.1],[6.7,3.1,5.6,2.4],[6.9,3.1,5.1,2.3],[5.8,2.7,5.1,1.9],[6.8,3.2,5.9,2.3],[6.7,3.3,5.7,2.5],[6.7,3,5.2,2.3],[6.3,2.5,5,1.9],[6.5,3,5.2,2],[6.2,3.4,5.4,2.3],[5.9,3,5.1,1.8]];
  const usData = [[13.2,236,58,21.2],[10,263,48,44.5],[8.1,294,80,31],[8.8,190,50,19.5],[9,276,91,40.6],[7.9,204,78,38.7],[3.3,110,77,11.1],[5.9,238,72,15.8],[15.4,335,80,31.9],[17.4,211,60,25.8],[5.3,46,83,20.2],[2.6,120,54,14.2],[10.4,249,83,24],[7.2,113,65,21],[2.2,56,57,11.3],[6,115,66,18],[9.7,109,52,16.3],[15.4,249,66,22.2],[2.1,83,51,7.8],[11.3,300,67,27.8],[4.4,149,85,16.3],[12.1,255,74,35.1],[2.7,72,66,14.9],[16.1,259,44,17.1],[9,178,70,28.2],[6,109,53,16.4],[4.3,102,62,16.5],[12.2,252,81,46],[2.1,57,56,9.5],[7.4,159,89,18.8],[11.4,285,70,32.1],[11.1,254,86,26.1],[13,337,45,16.1],[0.8,45,44,7.3],[7.3,120,75,21.4],[6.6,151,68,20],[4.9,159,67,29.3],[6.3,106,72,14.9],[3.4,174,87,8.3],[14.4,279,48,22.5],[3.8,86,45,12.8],[13.2,188,59,26.9],[12.7,201,80,25.5],[3.2,120,80,22.9],[2.2,48,32,11.2],[8.5,156,63,20.7],[4,145,73,26.2],[5.7,81,39,9.3],[2.6,53,66,10.8],[6.8,161,60,15.6]];
  const usNames = fixture.kmeans_usarrests.value.cluster_names as string[];
  const irisTable = { rows: null, cols: ["Sepal.Length", "Sepal.Width", "Petal.Length", "Petal.Width"], values: irisData };
  const usTable = { rows: usNames, cols: ["Murder", "Assault", "UrbanPop", "Rape"], values: usData };
  const c3 = [irisData[0]!, irisData[50]!, irisData[100]!];
  const c3b = [irisData[0]!, irisData[1]!, irisData[2]!];
  const c4 = [usData[0]!, usData[9]!, usData[19]!, usData[29]!];
  const k1 = [irisData[4]!];
  const smallTable = { rows: ["a", "b", "c", "d", "e"], cols: ["x", "y", "z"], values: small };
  const far = [small[0]!, small[1]!, [100, 100, 100]];
  const dup = [[1, 1], [1, 1], [1, 1], [2, 2]];
  const v = [1, 2, 3, 10, 11, 12, 30];
  const x03 = [[0], [1], [2], [3]];
  const algorithms = ["Hartigan-Wong", "Lloyd", "Forgy", "MacQueen"] as const;

  it("compares all fixed-center data sets, edge cases and algorithm variants", () => {
    for (const algorithm of algorithms) {
      compare("kmeans_iris_" + algorithm, kmeans(irisTable, c3, { algorithm }));
      compare("kmeans_iris_poor_start_" + algorithm, kmeans(irisTable, c3b, { algorithm }));
      compare("kmeans_iris_iter1_" + algorithm, kmeans(irisTable, c3b, { algorithm, iterMax: 1 }));
      compare("kmeans_usarrests_" + algorithm, kmeans(usTable, c4, { algorithm }));
      compare("kmeans_k1_" + algorithm, kmeans(irisTable, k1, { algorithm }));
      if (algorithm === "Hartigan-Wong") {
        try { kmeans(smallTable, small, { algorithm }); mismatches.push("kmeans_k_equals_n_Hartigan-Wong: expected error"); } catch { /* expected */ }
        try { kmeans(smallTable, far, { algorithm }); mismatches.push("kmeans_empty_Hartigan-Wong: expected error"); } catch { /* expected */ }
      } else {
        compare("kmeans_k_equals_n_" + algorithm, kmeans(smallTable, small, { algorithm }));
        compare("kmeans_empty_" + algorithm, kmeans(smallTable, far, { algorithm }));
      }
      compare("kmeans_duplicates_" + algorithm, kmeans(dup, [dup[0]!, dup[3]!], { algorithm }));
      compare("kmeans_vector_" + algorithm, kmeans(v, [1, 10, 30], { algorithm }));
      compare("kmeans_vector_center_matrix_" + algorithm, kmeans(v, [[1], [30]], { algorithm }));
      compare("kmeans_midpoint_" + algorithm, kmeans([0, 2, 1], [0, 2], { algorithm }));
    }
    compare("kmeans_data_frame", kmeans(usTable, c4));
    compare("kmeans_scale", kmeans({ ...irisTable, values: irisData.map((r) => r.map((v) => v * 1e150)) },
      c3.map((r) => r.map((v) => v * 1e150))));
    const smallu = small, starts3 = [smallu[0]!, smallu[2]!, smallu[4]!];
    for (const algorithm of algorithms) for (let m = 1; m <= 5; m++) {
      compare("kmeans_iter_" + algorithm + "_" + m, kmeans(smallu, starts3, { algorithm, iterMax: m }));
    }
    compare("kmeans_partial_name", kmeans(irisTable, c3, { algorithm: "Mac" }));
    const nax = irisData.map((r) => [...r]); nax[2]![1] = NaN;
    try { kmeans({ ...irisTable, values: nax }, c3); mismatches.push("kmeans_na: expected error"); } catch { /* expected */ }
    for (const action of [
      () => kmeans(dup, [dup[0]!, dup[1]!]),
      () => kmeans(irisTable, c3.map((r) => r.slice(0, 3))),
      () => kmeans(irisTable, c3, { algorithm: "Elkan" }),
      () => kmeans(irisTable, c3, { iterMax: 0 }),
    ]) { try { action(); mismatches.push("kmeans input validation: expected error"); } catch { /* expected */ } }
    expect(mismatches).toEqual([]);
  });

  it("matches every seeded sample, start retry, best-start tie and RNG tail", () => {
    for (const algorithm of algorithms) {
      setSeed(42); compare("kmeans_seed_" + algorithm, kmeans(irisTable, 3, { algorithm }));
    }
    setSeed(1); compare("kmeans_seed_nstart", kmeans(irisTable, 3, { nstart: 10 }));
    setSeed(1); compare("kmeans_seed_nstart_lloyd", kmeans(irisTable, 4, { nstart: 5, algorithm: "Lloyd" }));
    setSeed(123); compare("kmeans_seed_usarrests", kmeans(usTable, 4));
    setSeed(1); compare("kmeans_seed_k_equals_distinct", kmeans(dup, 2));
    setSeed(7); compare("kmeans_seed_vector", kmeans(v, 2));
    setSeed(7); compare("kmeans_seed_nstart_vector", kmeans(v, 3, { nstart: 4 }));
    try { setSeed(1); kmeans(dup, 3); mismatches.push("kmeans_seed_k_too_big: expected error"); } catch { /* expected */ }
    for (let seed = 1; seed <= 12; seed++) {
      setSeed(seed); const fit = kmeans(dup, 2); const tail = runif(3);
      compare("kmeans_dup_start_seed_" + seed, fit);
      compareTail("kmeans_dup_start_seed_" + seed, tail, fixture["kmeans_dup_start_seed_" + seed].value.tail);
    }
    for (let seed = 1; seed <= 8; seed++) {
      setSeed(seed); const fit = kmeans(x03, 2, { nstart: 8 }); const tail = runif(2);
      compare("kmeans_equal_best_seed_" + seed, fit);
      compareTail("kmeans_equal_best_seed_" + seed, tail, fixture["kmeans_equal_best_seed_" + seed].value.tail);
    }
    for (let seed = 1; seed <= 8; seed++) {
      setSeed(seed); const fit = kmeans(dup, 2, { nstart: 5 }); const tail = runif(2);
      compare("kmeans_equal_best_dup_seed_" + seed, fit);
      compareTail("kmeans_equal_best_dup_seed_" + seed, tail, fixture["kmeans_equal_best_dup_seed_" + seed].value.tail);
    }
    setSeed(42);
    if (JSON.stringify(sampleInt(150, { size: 3 }).map((v) => v + 1)) !== JSON.stringify(fixture.sample_int_150_3_seed42.value)) mismatches.push("sample_int_150_3_seed42");
    setSeed(1);
    const samples = Array.from({ length: 10 }, () => sampleInt(150, { size: 3 }).map((v) => v + 1));
    if (JSON.stringify(samples) !== JSON.stringify(fixture.sample_int_150_3_seed1_x10.value)) mismatches.push("sample_int_150_3_seed1_x10");
    setSeed(42); kmeans(irisTable, 3);
    compareTail("kmeans_seed_state_after", runif(3), fixture.kmeans_seed_state_after.value);
    setSeed(1); kmeans(irisTable, 3, { nstart: 10 });
    compareTail("kmeans_seed_state_after_nstart", runif(3), fixture.kmeans_seed_state_after_nstart.value);
    setSeed(1); kmeans(irisTable, c3);
    compareTail("kmeans_seed_state_after_matrix", runif(3), fixture.kmeans_seed_state_after_matrix.value);
    expect(mismatches).toEqual([]);
  });
});
