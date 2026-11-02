// Issue #156: the power link's derivative eta^(1/lambda - 1)/lambda was NaN where 1/lambda overflows (0 * Infinity) and
// Infinity where eta^(1/lambda - 1) overflows against a tiny 1/lambda (review_fix_log_issue156.md). The inverse link
// was NaN at eta = 1 where 1/lambda overflows (1 ** Infinity is NaN in JavaScript; R gives 1).
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const power = (lambda: number) => makeFamily({ family: "quasi", link: { power: lambda } });

describe("issue #156", () => {
  it("keeps the derivative of the power link defined where 1/lambda is out of range", () => {
    // below the double range: the least double (R: NaN)
    expect(power(Number.MIN_VALUE).muEta(0.5)).toBe(Number.MIN_VALUE);
    // 1/lambda at eta = 1 (R: Inf), and the mean 1
    expect(power(Number.MIN_VALUE).muEta(1)).toBe(Infinity);
    expect(power(Number.MIN_VALUE).linkinv(1)).toBe(1);
    expect(power(1e-310).linkinv(1)).toBe(1);
    // eta^(1/lambda)/(lambda eta) = (1 - 4e-306)/(2^-50 (1 - 2^-53)) = 2^50 (1 + 2^-53) (R: Inf)
    expect(Math.abs(power(Number.MAX_VALUE).muEta(Number.MIN_VALUE) / 2 ** 50 - 1)).toBeLessThan(3e-16);
    // beyond the double range: Infinity
    expect(power(Number.MIN_VALUE).muEta(2)).toBe(Infinity);
  });

  it("keeps the other cases as before", () => {
    expect(power(0.5).muEta(2)).toBe(4);
    expect(power(3).muEta(1e-300)).toBe(3.3333333333335038e199);
    expect(power(Number.MAX_VALUE).muEta(0.5)).toBe(1.1125369292536007e-308);
    expect(power(1e-300).muEta(0.5)).toBe(Number.MIN_VALUE);
    expect(power(1e-300).linkinv(0.5)).toBe(Number.MIN_VALUE);
  });
});
