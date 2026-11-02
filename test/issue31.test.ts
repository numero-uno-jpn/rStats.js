// Issue #31: rbinom's inversion where q = 1 - p rounds to 1 (review_fix_log_issue31.md).
import { describe, expect, it } from "vitest";
import { rbinom, runif, setSeed } from "../src/index.js";

describe("issue #31", () => {
  it("draws a success with probability n p where 1 - p rounds to 1", () => {
    // q^n was 1 and every draw 0 (R 4.5.2 too): find a uniform above (1 - p)^n = 1 - 1.1e-7 in the stream and draw there
    const n = 2147483646; // (from INT_MAX on, rbinom inverts qbinom as R)
    const p = 5e-17; // (1 - p is 1; 1 - 1e-16 is not)
    const qn = Math.exp(n * Math.log1p(-p));
    setSeed(31);
    const u = runif(20_000_000);
    const k = u.findIndex((v) => v > qn);
    expect(k).toBeGreaterThan(-1);
    setSeed(31);
    if (k > 0) runif(k);
    expect(rbinom(1, n, p)).toEqual([1]);
    // and 0 at the uniform before it
    setSeed(31);
    if (k > 1) runif(k - 1);
    expect(rbinom(1, n, p)).toEqual([0]);
  });
});
