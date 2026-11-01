// Issue #10: Satterthwaite's degrees of freedom and the units of the response and of x (review_fix_log_issue10.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";
import { lmerAnova } from "../src/models/lmerAnova.js";
import { lmerContest, lmerSummary } from "../src/models/lmerTest.js";
import { g69 as g, x69 as x, y69 as y } from "./helpers/issue69Data.js";

const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a / b - 1));

describe("issue #10", () => {
  it("df, t and p do not depend on the units of the response (REML and ML)", () => {
    // response x 1e6: the df of x was 7.4e8 for 31 (lmerTest's too), and at 1e200 the summary failed
    for (const REML of [true, false]) {
      const a = lmerSummary(lmer("y ~ x + (1 | g)", { y, x, g }, { REML }));
      const aa = lmerAnova(lmer("y ~ x + (1 | g)", { y, x, g }, { REML }));
      for (const c of [1e-200, 1e-6, 1e-3, 1e3, 1e6, 1e200]) {
        const fit = lmer("y ~ x + (1 | g)", { y: y.map((v) => v * c), x, g }, { REML });
        const b = lmerSummary(fit);
        b.df!.forEach((v, i) => expect(rel(v, a.df![i]!)).toBeLessThan(1e-8));
        b.tValue.forEach((v, i) => expect(rel(v, a.tValue[i]!)).toBeLessThan(1e-8));
        b.pValue!.forEach((v, i) => expect(rel(v, a.pValue![i]!)).toBeLessThan(1e-6));
        b.estimate.forEach((v, i) => expect(rel(v, a.estimate[i]! * c)).toBeLessThan(1e-8));
        b.stdError.forEach((v, i) => expect(rel(v, a.stdError[i]! * c)).toBeLessThan(1e-8));
        const ba = lmerAnova(fit);
        expect(rel(ba.F[0]!, aa.F[0]!)).toBeLessThan(1e-8);
        expect(rel(ba.denDF[0]!, aa.denDF[0]!)).toBeLessThan(1e-8);
        // a contrast with a right-hand side in the units of the response
        const t1 = lmerContest(lmer("y ~ x + (1 | g)", { y, x, g }, { REML }), [0, 1], { rhs: 1, joint: false }) as { tValue: number[]; df: number[] };
        const tc = lmerContest(fit, [0, 1], { rhs: c, joint: false }) as { tValue: number[]; df: number[] };
        expect(rel(tc.tValue[0]!, t1.tValue[0]!)).toBeLessThan(1e-8);
        expect(rel(tc.df[0]!, t1.df[0]!)).toBeLessThan(1e-8);
      }
    }
  });

  it("df do not depend on the units of x in a random slope", () => {
    const a = lmerSummary(lmer("y ~ x + (x | g)", { y, x, g }));
    for (const c of [1e-5, 1e6]) {
      const b = lmerSummary(lmer("y ~ x + (x | g)", { y, x: x.map((v) => v * c), g }));
      b.df!.forEach((v, i) => expect(rel(v, a.df![i]!)).toBeLessThan(1e-6));
      b.tValue.forEach((v, i) => expect(rel(v, a.tValue[i]!)).toBeLessThan(1e-6));
    }
  });
});
