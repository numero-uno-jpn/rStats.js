import { describe, expect, it } from "vitest";
import { lda, predictLda } from "../src/entries/multivariate.js";

const x = [
  [1, 2], [1.2, 2.1], [0.8, 1.8], [1.1, 2.2], [0.9, 1.9], [1.3, 2.0],
  [4, 5], [4.2, 5.1], [3.8, 4.8], [4.1, 5.2], [3.9, 4.9], [4.3, 5.0],
];
const g = ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b"];

describe("lda", () => {
  it("fits moment LDA with metric-normalised directions and deterministic signs", () => {
    const fit = lda(x, g);
    expect(fit.lev).toEqual(["a", "b"]);
    expect(fit.counts).toEqual([6, 6]);
    expect(fit.scaling.cols).toBe("LD1");
    const v = fit.scaling.values.map((r) => r[0]!);
    const maxIndex = v.reduce((m, z, i) => Math.abs(z) > Math.abs(v[m]!) ? i : m, 0);
    expect(v[maxIndex]).toBeGreaterThan(0);
    expect(Number.isFinite(fit.svd)).toBe(true);
  });
  it("predicts classes, posterior probabilities and discriminant scores", () => {
    const fit = lda(x, g) as ReturnType<typeof lda> & { prior: number[] };
    const p = predictLda(fit as any, { newdata: [[1, 2], [4, 5]] });
    expect(p.class).toEqual(["a", "b"]);
    expect(p.posterior.values[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p.x.values).toHaveLength(2);
    const prior = predictLda(fit as any, { newdata: [[1, 2]], prior: [0.2, 0.8] });
    expect(prior.posterior.values[0]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("supports formula input and leave-one-out CV", () => {
    const data = { a: x.map((r) => r[0]!), b: x.map((r) => r[1]!), group: g };
    const fit = lda("group ~ a + b", data);
    expect(fit.lev).toEqual(["a", "b"]);
    const cv = lda("group ~ a + b", data, { CV: true }) as any;
    expect(cv.class).toHaveLength(12);
    expect(cv.posterior.values).toHaveLength(12);
  });
  it("accepts a singleton class and rejects constant within-class predictors", () => {
    const singleton = lda([...x, [8, 8]], [...g, "c"]);
    expect(singleton.counts).toEqual([6, 6, 1]);
    expect(() => lda([[1], [1], [2], [2]], ["a", "a", "b", "b"])).toThrow(/constant within groups/);
  });
  it("warns for exact collinearity and rejects variables lost only to a loose tolerance", () => {
    const xx = x.map((r) => [r[0]!, r[1]!, r[0]! + r[1]!]);
    const fit = lda(xx, g);
    expect(fit.warnings).toEqual(["variables are collinear"]);
    expect(fit.scaling.rows).toHaveLength(3);
    const nearly = x.map((r) => [r[0]!, r[0]! + 1e-6 * r[1]!]);
    expect(() => lda(nearly, g, { tol: 0.5 })).toThrow(/constant within groups/);
  });
  it("handles extreme scales and 100,000 observations", () => {
    const scaled = lda(x.map((r) => [r[0]! * 1e100, r[1]! * 1e-100]), g);
    expect((Array.isArray(scaled.svd) ? scaled.svd.every(Number.isFinite) : Number.isFinite(scaled.svd))).toBe(true);
    const xx = Array.from({ length: 100_000 }, (_, i) => [Math.sin(i * 0.01), Math.cos(i * 0.013)]);
    const gg = xx.map((_, i) => i % 2 ? "b" : "a");
    const start = performance.now();
    const fit = lda(xx, gg);
    expect(fit.N).toBe(100_000);
    console.info(`lda 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
