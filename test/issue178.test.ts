// Issue #178: glmAnova of a glm fitted with start (review_fix_log_issue178.md).
import { describe, expect, it } from "vitest";
import { glm, glmAnova } from "../src/index.js";

const X = [[0, 0], [1, 0], [0, 1], [1, 1]];
const y = [1, 2, 3, 4];

describe("issue #178", () => {
  it("refits the smaller models without the fit's start, as R", () => {
    // was a RangeError (the start of 3 values for a model of 2 columns)
    const fit = glm(X, y, { family: "poisson", start: [0, 0, 0] });
    const plain = glm(X, y, { family: "poisson" });
    for (const test of ["Chisq", "Rao", "Cp"] as const) {
      const a = glmAnova(fit, { test });
      const b = glmAnova(plain, { test });
      // the row of x1 is a refit without start in both: the same bits
      expect(a.table[1]).toEqual(b.table[1]);
    }
    // R 4.5.2: anova(glm(y ~ x1 + x2, poisson, start = c(0, 0, 0)), test = "Chisq") (object$start is NULL)
    const t = glmAnova(fit, { test: "Chisq" }).table;
    const r = [
      [2.128802705724463, 0, 0, 0], // NULL: Resid. Dev only
      [0.4027102710137773, 2, 1.7260924347106863, 0.5256928691118514],
      [1.6456575701010379, 1, 0.08043486460964855, 0.1995509909936604],
    ];
    expect(t[0]![3]).toBeCloseTo(r[0]![0]!, 14);
    for (const i of [1, 2]) {
      expect(t[i]![1]).toBeCloseTo(r[i]![0]!, 14);
      expect(t[i]![2]).toBe(r[i]![1]);
      expect(t[i]![3]).toBeCloseTo(r[i]![2]!, 14);
      expect(t[i]![4]).toBeCloseTo(r[i]![3]!, 14);
    }
  });
});
