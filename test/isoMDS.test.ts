import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { asDist, dist, isoMDS, type IsoMDSResult } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/isomds.json", import.meta.url), "utf8")) as Record<string, any>;
const mismatches: string[] = [];
let maxStressError = 0;
function num(v: unknown): number {
  if (v === "NA" || v === "NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  return Number(v);
}
function compare(key: string, actual: IsoMDSResult, stressTol = 1e-8): void {
  const expected = fixture[key]?.value;
  if (!expected) { mismatches.push(`${key}: missing fixture`); return; }
  const points = expected.points.values;
  if (JSON.stringify(actual.points.rows) !== JSON.stringify(expected.points.rows ?? null)) mismatches.push(`${key}.points.rows differ`);
  if (JSON.stringify(actual.points.cols) !== JSON.stringify(expected.points.cols ?? null)) mismatches.push(`${key}.points.cols differ`);
  if (actual.points.values.length !== points.length) mismatches.push(`${key}.points row count differs`);
  const k = points[0]?.length ?? 0;
  for (let j = 0; j < k; j++) {
    let dot = 0;
    for (let i = 0; i < Math.min(points.length, actual.points.values.length); i++) dot += actual.points.values[i]![j]! * num(points[i]![j]);
    if (dot < 0) for (const row of actual.points.values) row[j] = -row[j]!;
  }
  for (let i = 0; i < Math.min(points.length, actual.points.values.length); i++) {
    for (let j = 0; j < Math.min(points[i]!.length, actual.points.values[i]!.length); j++) {
      const a = actual.points.values[i]![j]!, e = num(points[i]![j]);
      const rel = Math.abs(a - e) / Math.max(1, Math.abs(e));
      if (rel > 1e-7) mismatches.push(`${key}.points[${i},${j}] relativeError=${rel}`);
    }
  }
  const e = num(expected.stress);
  const error = Math.abs(actual.stress - e);
  maxStressError = Math.max(maxStressError, error);
  if (error > stressTol) mismatches.push(`${key}.stress: actual=${actual.stress}, expected=${e}, absError=${error}`);
}
const small = [[1, 2, 0], [4, 0, 3], [-1, 5, 2], [2, 7, 0], [0, 0, 1]];
const ds = dist(small);
const grid = Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)]);
const perturbed = grid.map((r, i) => [r[0]! + 0.1 * Math.sin(i + 1), r[1]! + 0.1 * Math.cos(i + 1)]);
const nonE = asDist([[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]]);

describe("isoMDS", () => {
  it("matches Kruskal stress on exact Euclidean and low-dimensional fixtures", () => {
    compare("isomds_small", isoMDS(ds));
    compare("isomds_small_k1", isoMDS(ds, { k: 1 }), 1e-5);
    compare("isomds_perfect", isoMDS(dist(small.map((r) => r.slice(0, 2)))));
    compare("isomds_line", isoMDS(dist([0, 1, 3, 6, 10]), { k: 1 }));
    compare("isomds_three", isoMDS(dist([0, 1, 3]), { k: 1 }));
    compare("isomds_two", isoMDS(dist([0, 1]), { k: 1 }));
    compare("isomds_non_euclidean", isoMDS(nonE));
    compare("isomds_grid_ties_default", isoMDS(dist(grid)), 1e-7);
  });

  it("uses primary tie blocks, explicit starts, progress and zero-iteration behavior", () => {
    const tied = isoMDS(dist(grid), { y: perturbed });
    compare("isomds_grid_ties", tied, 1e-5);
    const stopped = isoMDS(ds, { maxit: 0 });
    if (stopped.trace.length !== 1 || stopped.trace[0]!.iteration !== 0 || !stopped.trace[0]!.converged) {
      mismatches.push("maxit=0 trace does not report the initial configuration");
    }
    const limited = isoMDS(ds, { maxit: 5 });
    if (!limited.trace.some((v) => v.iteration === 5)) mismatches.push("trace omitted iteration 5");
    expect(mismatches).toEqual([]);
  });

  it("is scale invariant and validates missing, nonpositive and malformed inputs", () => {
    const base = isoMDS(ds);
    const scaledD = { ...ds, values: ds.values.map((v) => v * 1e150) };
    const scaled = isoMDS(scaledD);
    if (Math.abs(base.stress - scaled.stress) > 1e-8) mismatches.push("stress changed under dissimilarity scaling");
    for (let i = 0; i < base.points.values.length; i++) for (let j = 0; j < base.points.values[i]!.length; j++) {
      const rel = Math.abs(scaled.points.values[i]![j]! / 1e150 - base.points.values[i]![j]!) / Math.max(1, Math.abs(base.points.values[i]![j]!));
      if (rel > 1e-8) mismatches.push(`coordinate scale equivariance [${i},${j}]`);
    }
    const errors: Array<[string, () => unknown]> = [
      ["isomds_zero_distance", () => isoMDS(dist([1, 1, 2, 5]), { k: 1 })],
      ["isomds_negative", () => isoMDS(asDist([[0, -1, 2], [-1, 0, 3], [2, 3, 0]]), { k: 1 })],
      ["isomds_na", () => isoMDS(asDist([[0, 1, NaN, 1], [1, 0, 2, 3], [NaN, 2, 0, 1], [1, 3, 1, 0]]), { k: 1 })],
      ["isomds_matrix", () => isoMDS([[0, 1], [1, 0]], { k: 1 })],
      ["isomds_k_too_big", () => isoMDS(ds, { k: 5 })],
      ["isomds_swiss_y_wrong", () => isoMDS(ds, { y: [[1, 2], [3, 4]] })],
    ];
    for (const [key, action] of errors) {
      if (!fixture[key]?.error) { mismatches.push(key + ": missing error fixture"); continue; }
      try { action(); mismatches.push(key + ": expected error"); } catch { /* expected */ }
    }
    console.info(`isoMDS direct R cases: 8; maximum absolute stress error ${maxStressError.toExponential(3)}`);
    expect(mismatches).toEqual([]);
  });
});
