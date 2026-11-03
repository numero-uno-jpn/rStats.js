// Issue #265: esW2 where the independence cell probability r c is below the normal range (review_fix_log_issue265.md).
import { describe, expect, it } from "vitest";
import { esW2 } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #265", () => {
  it("forms (p / sqrt(r c) - sqrt(r c))^2 where r c underflows or is subnormal", () => {
    // w^2 = (1 - 1e-200)^2 + 2e-200 in exact arithmetic, 1 in doubles; was NaN (0 / 0), R too
    expect(esW2([[1e-200, 0], [0, 1]])).toBe(1);
    // r c about 1e-320 (subnormal): Rmpfr from the double row and column sums 0.99999999989999997281; was 1
    expect(rel(esW2([[1e-160, 1e-170], [1e-170, 1]]), 0.99999999989999997281)).toBeLessThan(1e-15);
  });

  it("leaves the other cases as before", () => {
    expect(esW2([[0.3, 0.2], [0.1, 0.4]])).toBe(0.40824829046386296);
    expect(esW2([[0.1, 0.2, 0.05], [0.15, 0.25, 0.25]])).toBe(0.254387626886735);
    // an empty row adds nothing (the intentional difference from R of #204)
    expect(esW2([[0, 0], [0.5, 0.5]])).toBe(0);
  });
});
