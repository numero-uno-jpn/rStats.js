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
      for (const scale of [2 ** 500, 2 ** -500, 2 ** 1000, 2 ** -1000, 1e100, 1e-100, 1e200, 1e-200]) {
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
    for (const scale of [2 ** 500, 2 ** -500, 1e100, 1e-100]) {
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
    for (const scale of [2 ** 500, 2 ** -500, 1e100, 1e-100]) {
      const scaled = cmdscale({ ...source, values: source.values.map((v) => v * scale) }, { k: 2, add: true });
      expect(scaled.ac / scale).toBeCloseTo(reference.ac, 8);
      for (let i = 0; i < 2; i++) expect(scaled.GOF[i]!).toBeCloseTo(reference.GOF[i]!, 10);
      // Eigenvectors in a repeated eigenspace may rotate or flip sign across scales.
      // Compare the invariant Gram matrix rather than a platform-dependent basis.
      for (let i = 0; i < reference.points.values.length; i++) for (let j = 0; j < reference.points.values.length; j++) {
        let actual = 0, expected = 0;
        for (let q = 0; q < 2; q++) {
          actual += scaled.points.values[i]![q]! * scaled.points.values[j]![q]!;
          expected += reference.points.values[i]![q]! * reference.points.values[j]![q]!;
        }
        expect(actual / (scale * scale)).toBeCloseTo(expected, 7);
      }
      for (let i = 0; i < reference.eig.length; i++) expect(scaled.eig[i]! / (scale * scale)).toBeCloseTo(reference.eig[i]!, 7);
    }
  });
  it("keeps dist and hclust equivariant at 2^±500 and 2^±1000", () => {
    const rows = [[0, 0], [3, 0], [0, 4], [3, 4]];
    const base = dist(rows);
    const reference = hclust(base, { method: "ward.D2" });
    for (const scale of [2 ** 500, 2 ** -500, 2 ** 1000, 2 ** -1000, 1e100, 1e-100]) {
      const scaled = dist(rows.map((row) => row.map((v) => v * scale)));
      for (let i = 0; i < base.values.length; i++) expect(scaled.values[i]! / scale).toBeCloseTo(base.values[i]!, 11);
      const tree = hclust(scaled, { method: "ward.D2" });
      expect(tree.merge).toEqual(reference.merge);
      expect(tree.order).toEqual(reference.order);
      for (let i = 0; i < reference.height.length; i++) expect(tree.height[i]! / scale).toBeCloseTo(reference.height[i]!, 10);
    }
  });

  it("retains the nearest-neighbor path on a 5,000-object worst-case chain", () => {
    const n = 5000;
    const values = new Array<number>(n * (n - 1) / 2);
    let p = 0;
    const level = (i: number) => 1 + (n - i) / n;
    for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) values[p++] = level(j);
    const start = performance.now();
    const tree = hclust({ values, size: n, labels: null, method: "euclidean", diag: false, upper: false, warnings: [] }, { method: "complete" });
    const elapsed = performance.now() - start;
    const expectedMerge = Array.from({ length: n - 1 }, (_, step) => [-(n - step - 1), step === 0 ? -n : step]);
    const expectedHeight = Array.from({ length: n - 1 }, (_, step) => level(n - step - 2));
    expect(tree.merge).toEqual(expectedMerge);
    expect(tree.height).toEqual(expectedHeight);
    expect(tree.order).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    console.info(`hclust 5,000-object decreasing-ultrametric chain: ${elapsed.toFixed(1)} ms`);
  });

  it("keeps kmeans assignments at 2^±1000 even when squared sums are unrepresentable", () => {
    const rows = [[0, 0], [1, 1], [10, 10], [11, 11]], centers = [[0, 0], [10, 10]];
    const reference = kmeans(rows, centers, { algorithm: "Lloyd" });
    for (const scale of [2 ** 1000, 2 ** -1000]) {
      const fit = kmeans(rows.map((r) => r.map((v) => v * scale)), centers.map((r) => r.map((v) => v * scale)), { algorithm: "Lloyd" });
      expect(fit.cluster).toEqual(reference.cluster);
      expect(fit.iter).toBe(reference.iter);
      for (let g = 0; g < 2; g++) for (let j = 0; j < 2; j++) expect(fit.centers.values[g]![j]! / scale).toBeCloseTo(reference.centers.values[g]![j]!, 10);
    }
  });

  it("preserves distance and kmeans assignments at subnormal magnitudes", () => {
    const tiny = 1e-310;
    const points = [[0], [1], [3]].map((r) => r.map((v) => v * tiny));
    const baseD = dist([[0], [1], [3]]);
    const tinyD = dist(points);
    for (let i = 0; i < baseD.values.length; i++) expect(tinyD.values[i]! / tiny).toBeCloseTo(baseD.values[i]!, 10);
    const baseTree = hclust(baseD, { method: "ward.D2" });
    const tinyTree = hclust(tinyD, { method: "ward.D2" });
    expect(tinyTree.merge).toEqual(baseTree.merge);
    expect(tinyTree.order).toEqual(baseTree.order);
    for (let i = 0; i < baseTree.height.length; i++) expect(tinyTree.height[i]! / tiny).toBeCloseTo(baseTree.height[i]!, 10);

    const rows = [[0], [1], [10], [11]].map((r) => r.map((v) => v * tiny));
    const centers = [[0], [10]].map((r) => r.map((v) => v * tiny));
    const fit = kmeans(rows, centers, { algorithm: "Lloyd" });
    expect(fit.cluster).toEqual([1, 1, 2, 2]);
    expect(fit.iter).toBe(2);
    expect(fit.centers.values[0]![0]! / tiny).toBeCloseTo(0.5, 10);
    expect(fit.centers.values[1]![0]! / tiny).toBeCloseTo(10.5, 10);
    // The exact sums of squares are below the smallest representable double, so zero is correct.
    expect(fit.totss).toBe(0);
    expect(fit.totWithinss).toBe(0);
  });

  it("preserves cmdscale coordinates when large squared distances overflow", () => {
    const scale = 1e200;
    const matrix = [[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]];
    const reference = cmdscale(asDist(matrix), { k: 2, add: true });
    const scaled = cmdscale(asDist(matrix.map((row) => row.map((v) => v * scale))), { k: 2, add: true });
    expect(scaled.ac / scale).toBeCloseTo(reference.ac, 8);
    for (let i = 0; i < 2; i++) expect(scaled.GOF[i]!).toBeCloseTo(reference.GOF[i]!, 8);
    for (let i = 0; i < reference.points.values.length; i++) for (let j = i + 1; j < reference.points.values.length; j++) {
      const a = reference.points.values[i]!, b = reference.points.values[j]!;
      const x = scaled.points.values[i]!, y = scaled.points.values[j]!;
      const referenceDistance = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
      const scaledDistance = Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!) / scale;
      expect(scaledDistance).toBeCloseTo(referenceDistance, 7);
    }
  });

  it("preserves cmdscale coordinates and Cailliez constant when squared distances underflow", () => {
    const tiny = 1e-310;
    const matrix = [[0, 1, 1, 3], [1, 0, 1, 1], [1, 1, 0, 1], [3, 1, 1, 0]];
    const reference = cmdscale(asDist(matrix), { k: 2, add: true });
    const scaled = cmdscale(asDist(matrix.map((row) => row.map((v) => v * tiny))), { k: 2, add: true });
    expect(scaled.ac / tiny).toBeCloseTo(reference.ac, 8);
    for (let i = 0; i < 2; i++) expect(scaled.GOF[i]!).toBeCloseTo(reference.GOF[i]!, 8);
    expect(scaled.eig.every((value) => value === 0)).toBe(true);
    for (let i = 0; i < reference.points.values.length; i++) for (let j = i + 1; j < reference.points.values.length; j++) {
      const a = reference.points.values[i]!, b = reference.points.values[j]!;
      const x = scaled.points.values[i]!, y = scaled.points.values[j]!;
      const referenceDistance = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
      const scaledDistance = Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!) / tiny;
      expect(scaledDistance).toBeCloseTo(referenceDistance, 7);
    }
  });

  it("keeps distances and clustering invariant under exactly representable translation", () => {
    const rows = [[0, 0], [2, 0], [0, 3], [2, 3]];
    const kmRows = [[0, 0], [1, 1], [10, 10], [11, 11]];
    for (const shift of [1e8, 1e12]) {
      const shifted = rows.map((r) => r.map((v) => v + shift));
      expect(dist(shifted).values).toEqual(dist(rows).values);
      const a = hclust(dist(rows), { method: "average" }), b = hclust(dist(shifted), { method: "average" });
      expect(b.merge).toEqual(a.merge); expect(b.order).toEqual(a.order); expect(b.height).toEqual(a.height);

      const mdsA = cmdscale(dist(rows), { k: 2 }), mdsB = cmdscale(dist(shifted), { k: 2 });
      expect(mdsB.eig).toEqual(mdsA.eig);
      expect(mdsB.points.values).toEqual(mdsA.points.values);

      const kmShifted = kmRows.map((r) => r.map((v) => v + shift));
      const kmA = kmeans(kmRows, [[0, 0], [10, 10]], { algorithm: "Lloyd" });
      const kmB = kmeans(kmShifted, [[shift, shift], [shift + 10, shift + 10]], { algorithm: "Lloyd" });
      expect(kmB.cluster).toEqual(kmA.cluster);
      expect(kmB.iter).toBe(kmA.iter);
      expect(kmB.withinss).toEqual(kmA.withinss);
      expect(kmB.totss).toBe(kmA.totss);
      for (let g = 0; g < 2; g++) for (let j = 0; j < 2; j++) {
        expect(kmB.centers.values[g]![j]! - shift).toBeCloseTo(kmA.centers.values[g]![j]!, 10);
      }
    }
  });});
