import { describe, expect, it } from "vitest";
import { asDist, cmdscale, dist, hclust, kmeans } from "../src/entries/multivariate.js";

describe("cluster and classical-scaling numerical extremes", () => {
  it("computes Canberra ratios without overflow for finite opposite-sign values", () => {
    // For x=-y, |x-y|/(|x|+|y|) is exactly 1; the direct numerator and denominator overflow.
    expect(dist([[2 ** 1023], [-(2 ** 1023)]], { method: "canberra" }).values).toEqual([1]);
  });
  it("keeps hclust heights homogeneous at very large and small scales", () => {
    const base = dist([[0, 0], [3, 0], [0, 4], [3, 4]]);
    for (const method of ["ward.D2", "median", "centroid"] as const) {
      const reference = hclust(base, { method });
      for (const scale of [2 ** 500, 2 ** -500]) {
        const scaled = hclust({ ...base, values: base.values.map((v) => v * scale) }, { method });
        expect(scaled.merge).toEqual(reference.merge);
        expect(scaled.order).toEqual(reference.order);
        for (let i = 0; i < reference.height.length; i++) expect(scaled.height[i]! / scale).toBeCloseTo(reference.height[i]!, 11);
      }
    }
  });
  it("keeps kmeans assignments and centers homogeneous at 2^±500", () => {
    const rows = [[0, 0], [1, 1], [10, 10], [11, 11]], centers = [[0, 0], [10, 10]];
    const reference = kmeans(rows, centers, { algorithm: "Lloyd" });
    for (const scale of [2 ** 500, 2 ** -500]) {
      const fit = kmeans(rows.map((r) => r.map((v) => v * scale)), centers.map((r) => r.map((v) => v * scale)), { algorithm: "Lloyd" });
      expect(fit.cluster).toEqual(reference.cluster);
      for (let g = 0; g < 2; g++) for (let j = 0; j < 2; j++) expect(fit.centers.values[g]![j]! / scale).toBeCloseTo(reference.centers.values[g]![j]!, 11);
      expect(fit.totWithinss / (scale * scale)).toBeCloseTo(reference.totWithinss, 10);
      expect(fit.totss / (scale * scale)).toBeCloseTo(reference.totss, 10);
    }
  });
  it("scales the Cailliez eigenproblem before squaring extreme dissimilarities", () => {
    const nonEuclidean = [[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]];
    const source = asDist(nonEuclidean), reference = cmdscale(source, { k: 2, add: true });
    expect(reference.ac).toBeGreaterThan(0);
    for (const scale of [2 ** 500, 2 ** -500]) {
      const scaled = cmdscale({ ...source, values: source.values.map((v) => v * scale) }, { k: 2, add: true });
      expect(scaled.ac / scale).toBeCloseTo(reference.ac, 8);
      for (let i = 0; i < reference.points.values.length; i++) for (let j = 0; j < 2; j++) expect(scaled.points.values[i]![j]! / scale).toBeCloseTo(reference.points.values[i]![j]!, 7);
      for (let i = 0; i < reference.eig.length; i++) expect(scaled.eig[i]! / (scale * scale)).toBeCloseTo(reference.eig[i]!, 7);
    }
  });
  it("keeps distances and clustering invariant under exactly representable translation", () => {
    const rows = [[0, 0], [2, 0], [0, 3], [2, 3]], shifted = rows.map((r) => r.map((v) => v + 1e12));
    expect(dist(shifted).values).toEqual(dist(rows).values);
    const a = hclust(dist(rows), { method: "average" }), b = hclust(dist(shifted), { method: "average" });
    expect(b.merge).toEqual(a.merge); expect(b.order).toEqual(a.order); expect(b.height).toEqual(a.height);
  });
});
