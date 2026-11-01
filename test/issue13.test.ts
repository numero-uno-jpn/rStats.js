// Issue #13: coxph and the columns dropped by the Cholesky factorisation (review_fix_log_issue13.md).
import { describe, expect, it } from "vitest";
import { coxph } from "../src/index.js";
import { e13 as e, status13 as status, time13 as time, x1_13 as x1, x3_13 as x3 } from "./helpers/issue13Data.js";

describe("issue #13", () => {
  it("a nearly aliased column dropped by the factorisation leaves the fit without it", () => {
    // its residual cross-products stayed in the factor: coefficients 4e-12 off that fit at d = 1e-6 (survival too)
    const ref = coxph(time, status, x1.map((v, i) => [v, x3[i]!]));
    for (const d of [1e-6, 3e-7, 1e-8, 0]) {
      const f = coxph(time, status, x1.map((v, i) => [v, v + d * e[i]!, x3[i]!]));
      expect(Number.isNaN(f.coefficients[1])).toBe(true);
      expect([f.coefficients[0], f.coefficients[2]]).toEqual(ref.coefficients);
      expect([f.var[0]![0], f.var[0]![2], f.var[2]![2]]).toEqual([ref.var[0]![0], ref.var[0]![1], ref.var[1]![1]]);
    }
  });
});
