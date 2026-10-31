// Fixes of the 34th review round (review_fix_log_20261031_34.md): Hedges' J at large df; the ANOVA effect sizes
// do not depend on the units of the response; a model without residual degrees of freedom.
import { describe, expect, it } from "vitest";
import { anova, aov, aovEz, aovSummary, epsilonSquared, etaSquared, lm, omegaSquared } from "../src/index.js";
import { hedgesJ } from "../src/htest/effectSize.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const y = [5.1, 6.3, 5.8, 7.2, 6.9, 8.1, 7.4, 8.8, 6.0, 7.7, 6.5, 9.0, 5.5, 7.0, 6.2, 8.4, 7.9, 9.3];
const big = y.map((v) => v * 1e154);
const A = Array.from({ length: 18 }, (_, i) => (i % 2 ? "b" : "a"));
const B = Array.from({ length: 18 }, (_, i) => ["p", "q", "r"][Math.floor(i / 6)]!);
const tab = (t: { table: number[][] }): number[] => t.table.flat();
const close = (a: number[], b: number[]): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Number.isNaN(v) ? NaN : Math.abs(v - b[i]!)).toBeLessThanOrEqual(1e-14 * Math.max(1, Math.abs(b[i]!))));
};

describe("review 34", () => {
  it("Hedges' J at large df (effectsize's formula: 0.99997 at 1e10, 1.28 at 1e14)", () => {
    // 1 - 3/(4 df - 1) differs from J by about 1/(32 df^2): 3e-14 at 1e6
    expect(rel(hedgesJ(1e6), 1 - 3 / (4e6 - 1))).toBeLessThan(1e-13);
    for (const df of [1e10, 1e14, 1e16]) expect(rel(hedgesJ(df), 1 - 3 / (4 * df - 1))).toBeLessThan(1e-15);
    expect(hedgesJ(Infinity)).toBe(1);
    expect(hedgesJ(10)).toBeCloseTo(0.922745608053087, 15); // R 4.5.2 (effectsize's formula)
  });
  it("the effect sizes of lm and aov fits do not depend on the units (R 4.5.2: NaN for data around 1e154)", () => {
    const m1 = aov("y ~ A * B", { y, A, B }) as Parameters<typeof etaSquared>[0];
    const m2 = aov("y ~ A * B", { y: big, A, B }) as Parameters<typeof etaSquared>[0];
    close(tab(etaSquared(m2)), tab(etaSquared(m1)));
    close(tab(etaSquared(m2, { partial: false })), tab(etaSquared(m1, { partial: false })));
    close(tab(omegaSquared(m2)), tab(omegaSquared(m1)));
    close(tab(epsilonSquared(m2)), tab(epsilonSquared(m1)));
    close(tab(etaSquared(anova(lm("y ~ A * B", { y: big, A, B })))), tab(etaSquared(m1)));
    // R 4.5.2 (effectsize): A's partial eta squared 0.5153059974020243
    expect(etaSquared(m1).table[0]![0]).toBeCloseTo(0.5153059974020243, 14);
  });
  it("repeated measures: aov with Error(), its summary and aovEz", () => {
    const id = Array.from({ length: 18 }, (_, i) => Math.floor(i / 3) + 1);
    const W = Array.from({ length: 18 }, (_, i) => ["a", "b", "c"][i % 3]!);
    const fit = (v: number[]) => aov("y ~ W + Error(id)", { y: v, id, W }) as Parameters<typeof etaSquared>[0];
    close(tab(etaSquared(fit(big))), tab(etaSquared(fit(y))));
    close(tab(omegaSquared(aovSummary(fit(big) as never) as never)), tab(omegaSquared(aovSummary(fit(y) as never) as never)));
    const ez = (v: number[]) => aovEz({ y: v, id, W }, { id: "id", dv: "y", within: "W" });
    close(tab(etaSquared(ez(big))), tab(etaSquared(ez(y))));
  });
  it("sums of squares that are finite but whose sums overflow", () => {
    const t = { colNames: ["Df", "Sum Sq"], rowNames: ["A", "Residuals"], table: [[1, 1e308], [10, 1e308]], warnings: [] };
    expect(etaSquared(t, { ci: null }).table[0]![0]).toBe(0.5); // was 0
  });
  it("a model without residual degrees of freedom has no effect sizes (effectsize: \"No residuals data found\")", () => {
    const sat = aov("y ~ A * B", { y: [1, 2, 4, 3], A: ["a", "a", "b", "b"], B: ["p", "q", "p", "q"] }) as Parameters<typeof etaSquared>[0];
    // B's partial eta squared was 0.0889 (0 / 0 rounding noise)
    expect(() => etaSquared(sat)).toThrow("the model has no residual degrees of freedom");
    expect(() => omegaSquared(sat)).toThrow("the model has no residual degrees of freedom");
  });
});
