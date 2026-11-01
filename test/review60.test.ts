// External review of multiple comparisons and anova (HTEST-031, HTEST-032, MOD-004, review_fix_log_20261031_60.md).
import { describe, expect, it } from "vitest";
import { anova, dunnettTest, dunnTest, glhtDunnett, lm, tukeyTest, type DunnTestMethod } from "../src/index.js";

describe("review 60", () => {
  it("HTEST-031: dunnTest gives equal p-values the same adjusted value", () => {
    // dunn.test ranked ties in the order of the comparisons: holm gave 1, 0.828, 0.414 for the same 0.414
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const g = ["a", "a", "b", "b", "c", "c", "d", "d"];
    // R's p.adjust of the same p-values (the stopping rule decides on the first of a run)
    const want: Record<string, number[]> = {
      holm: [1, 0.5123521743, 1, 0.08583527, 0.5123521743, 1],
      hochberg: [0.4142162, 0.4098817, 0.4142162, 0.08583527, 0.4098817, 0.4142162],
      bh: [0.4142162, 0.2049409, 0.4142162, 0.08583527, 0.2049409, 0.4142162],
      by: [1, 0.5021051, 1, 0.2102964, 0.5021051, 1],
    };
    for (const [method, w] of Object.entries(want)) {
      const r = dunnTest(x, g, { method: method as DunnTestMethod, altp: true });
      r.PAdjusted.forEach((v, i) => expect(v).toBeCloseTo(w[i]!, 6));
    }
    // the same comparison whatever the order of the groups
    const relabel: Record<string, string> = { a: "d", b: "c", c: "b", d: "a" };
    for (const method of ["holm", "hs", "hochberg", "bh", "by"] as DunnTestMethod[]) {
      const r1 = dunnTest(x, g, { method, altp: true });
      const r2 = dunnTest(x, g.map((v) => relabel[v]!), { method, altp: true });
      const byPair = (r: typeof r1, map: (s: string) => string) =>
        new Map(r.comparisons.map((c, i) => [c.split(" - ").map(map).sort().join(","), r.PAdjusted[i]!]));
      const m1 = byPair(r1, (s) => s);
      const m2 = byPair(r2, (s) => Object.keys(relabel).find((k) => relabel[k] === s)!);
      for (const [k, v] of m1) expect(m2.get(k)).toBe(v);
    }
    // without ties as dunn.test (R's values)
    const r = dunnTest([1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2, 0.7], ["a", "a", "a", "b", "b", "b", "c", "c", "c", "a"], { method: "holm" });
    const order = [...r.P].sort((a, b) => a - b);
    expect(new Set(order).size).toBe(order.length);
    r.P.forEach((p, i) => expect(r.PAdjusted[i]).toBe(Math.min(1, (r.P.length - order.indexOf(p)) * p)));
  });

  it("HTEST-032: dunnettTest, tukeyTest and glhtDunnett need a positive pooled variance", () => {
    // statistics +-Infinity with p-values 0, or NaN (R: p 0 in TukeyHSD and PMCMRplus, 1 in glht)
    const x = [1, 1, 2, 2, 3, 3];
    const g = ["a", "a", "b", "b", "c", "c"];
    expect(() => dunnettTest(x, g)).toThrow(/within-group variance is 0/);
    expect(() => tukeyTest(x, g)).toThrow(/within-group variance is 0/);
    expect(() => glhtDunnett(x, g)).toThrow(/within-group variance is 0/);
    expect(() => tukeyTest([1, 2, 3], ["a", "b", "c"])).toThrow(/no residual degrees of freedom/);
    // a tiny positive variance as before
    const y = [1, 1 + 2 ** -52, 2, 2, 3, 3];
    expect(dunnettTest(y, g).pValue.flat().every((p) => p >= 0 && p < 1e-10)).toBe(true);
  });

  it("MOD-004: anova of nested fits warns when the larger model fits essentially perfectly", () => {
    // F 8.4e62 from a residual sum of squares 2.4e-64, without the warning of the sequential table (R too)
    const d = { y: [1, 2, 4, 5], x: [0, 1, 2, 3], z: [0, 0, 1, 1] };
    expect(anova(lm("y ~ x", d), lm("y ~ x + z", d)).warnings).toContain("ANOVA F-tests on an essentially perfect fit are unreliable");
    const e = { y: [1, 2.5, 3.7, 5.4, 4.9], x: [0, 1, 2, 3, 4], z: [0, 0, 1, 1, 1] };
    expect(anova(lm("y ~ x", e), lm("y ~ x + z", e)).warnings).toEqual([]);
  });
});
