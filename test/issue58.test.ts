// Issue #58: lmerContest with contrasts of extreme magnitude (review_fix_log_issue58.md).
import { describe, expect, it } from "vitest";
import { lmer, lmerContest } from "../src/entries/mixed.js";

const fit = lmer("y ~ x + (1 | g)", {
  y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
  x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
  g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
});
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const scale = (L: number[][], c: number) => L.map((row) => row.map((v) => v * c));

describe("issue #58", () => {
  it("t-tests a scaled contrast as the contrast itself (R 4.5.2: Inf, NaN)", () => {
    const base = lmerContest(fit, [0, 1], { joint: false });
    // a power of 2: the same bits; the scaled estimate, standard error and interval
    const p = lmerContest(fit, [0, 2 ** 600], { joint: false, rhs: 2 ** 599 });
    const q = lmerContest(fit, [0, 1], { joint: false, rhs: 0.5 });
    expect([p.tValue, p.df, p.pValue]).toEqual([q.tValue, q.df, q.pValue]);
    expect(p.estimate[0]).toBe(base.estimate[0]! * 2 ** 600);
    expect(p.lower![0]).toBe(q.lower![0]! * 2 ** 600);
    // 1e160 and 1e-200 (the standard error was Inf and 0, df NaN)
    for (const c of [1e160, 1e-200]) {
      const t = lmerContest(fit, [0, c], { joint: false });
      expect(rel(t.tValue[0]!, base.tValue[0]!)).toBeLessThan(1e-13);
      expect(rel(t.df[0]!, base.df[0]!)).toBeLessThan(1e-13);
      expect(rel(t.pValue[0]!, base.pValue[0]!)).toBeLessThan(1e-13);
      expect(rel(t.estimate[0]!, base.estimate[0]! * c)).toBeLessThan(1e-13);
      expect(rel(t.stdError[0]!, base.stdError[0]! * c)).toBeLessThan(1e-13);
    }
  });

  it("F-tests scaled rows as the rows themselves (R 4.5.2: an error, NaN or no rows)", () => {
    const I = [
      [1, 0],
      [0, 1],
    ];
    for (const [L, rhs] of [
      [I, [0, 0]],
      [[[0, 1]], [0]],
      [I, [1, 0]],
    ] as const) {
      const base = lmerContest(fit, L as number[][], { rhs: [...rhs] });
      for (const c of [2 ** 600, 1e160, 1e-200]) {
        const f = lmerContest(fit, scale(L as number[][], c), { rhs: rhs.map((v) => v * c) });
        for (const key of ["F", "denDF", "pValue", "sumSq"] as const) expect(rel(f[key][0]!, base[key][0]!)).toBeLessThan(1e-13);
        expect(f.numDF).toEqual(base.numDF);
      }
    }
  });
});
