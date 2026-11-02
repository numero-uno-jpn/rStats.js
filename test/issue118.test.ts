// Issue #118: the hypergeometric distribution where m + n rounds in double precision (beyond 2^53): k = 1e16 was taken
// for the whole population of 1 + 1e16, and dhyper(0, 1, 1e16, 1e16) was 1 for 1e-16 (review_fix_log_issue118.md).
// Inside the support the answer is NaN there, as for the other integers beyond 2^53. R 4.5.2: 1, 0, 0.
import { describe, expect, it } from "vitest";
import { dhyper, phyper, qhyper } from "../src/index.js";

describe("issue #118", () => {
  it("is NaN inside the support where m + n is not exact", () => {
    expect(dhyper(0, 1, 1e16, 1e16)).toBeNaN();
    expect(dhyper(1, 1, 1e16, 1e16)).toBeNaN();
    expect(phyper(0, 1, 1e16, 1e16)).toBeNaN();
    expect(qhyper(0.5, 1, 1e16, 1e16)).toBeNaN();
    // outside it, and at the ends, the values are exact
    expect(dhyper(2, 1, 1e16, 1e16)).toBe(0);
    expect(phyper(1, 1, 1e16, 1e16)).toBe(1);
    expect(phyper(-1, 1, 1e16, 1e16)).toBe(0);
    expect(dhyper(0, 1, 1e16, 0)).toBe(1);
  });

  it("keeps an exact m + n and the binomial limit as before", () => {
    expect(dhyper(1, 1, 2 ** 52, 2 ** 52)).toBe(0.9999999999999998);
    expect(dhyper(0, 1, 2 ** 52, 2 ** 52)).toBe(2.220446049250316e-16);
    expect(dhyper(1, 1e300, 1e300, 5)).toBe(0.15624999999999997); // (as before)
  });
});
