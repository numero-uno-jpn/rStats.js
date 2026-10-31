// Fixes of the 36th review round (review_fix_log_20261031_36.md): aov with Error() whose error model has a covariate
// of a small scale; a treatment covariate of a small scale (fixed in round 35, where R drops it).
import { describe, expect, it } from "vitest";
import { aov, aovSummary } from "../src/index.js";

const y = [5.1, 6.3, 5.8, 7.2, 6.9, 8.1, 7.4, 8.8, 6.0, 7.7, 6.5, 9.0, 5.5, 7.0, 6.2, 8.4, 7.9, 9.3];
const id = Array.from({ length: 18 }, (_, i) => String(Math.floor(i / 3) + 1));
const W = Array.from({ length: 18 }, (_, i) => ["a", "b", "c"][i % 3]!);
const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3];
const z = [2, 7, 1, 8, 2, 8, 1, 8, 2, 8, 4, 5, 9, 0, 4, 5, 2, 3];
type Summary = { strata: { stratum: string; rowNames: string[]; table: number[][] }[] };
const same = (a: Summary, b: Summary): void => {
  expect(a.strata.map((s) => [s.stratum, s.rowNames])).toEqual(b.strata.map((s) => [s.stratum, s.rowNames]));
  a.strata.forEach((st, i) =>
    st.table.flat().forEach((v, j) => {
      const e = b.strata[i]!.table.flat()[j]!;
      if (Number.isNaN(e)) expect(v).toBeNaN();
      else expect(Math.abs(v - e)).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(e)));
    }),
  );
};
const summary = (formula: string, data: Record<string, (string | number)[]>): Summary => aovSummary(aov(formula, data) as never) as unknown as Summary;

describe("review 36", () => {
  it("a covariate around 1e-200 in Error() gives the strata of other units (R 4.5.2 too)", () => {
    const s1 = summary("y ~ W + Error(z)", { y, W, z });
    // the z stratum's W was 0.2275 instead of 0.9865
    same(summary("y ~ W + Error(z)", { y, W, z: z.map((v) => v * 1e-200) }), s1);
    same(summary("y ~ W + Error(z)", { y, W, z: z.map((v) => v * 1e200) }), s1);
    expect(s1.strata[0]!.table[0]![1]).toBeCloseTo(0.9865, 4); // R 4.5.2
  });
  it("a treatment covariate around 1e-200 stays in its strata (R 4.5.2 drops it)", () => {
    same(summary("y ~ x + W + Error(id)", { y, id, W, x: x.map((v) => v * 1e-200) }), summary("y ~ x + W + Error(id)", { y, id, W, x }));
  });
});
