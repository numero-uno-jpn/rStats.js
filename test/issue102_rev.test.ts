// Revision of issue 102: qbinom rounds a non-integer size half to even, as R (R_forceint) and as qhyper, qsignrank and
// qwilcox; dbinom and pbinom stay NaN for it, as R (review_fix_log_issue102_rev.md).
import { describe, expect, it } from "vitest";
import { dbinom, pbinom, qbinom } from "../src/index.js";

describe("issue 102 revision: qbinom with a non-integer size", () => {
  it("rounds the size half to even (R 4.5.2)", () => {
    expect(qbinom(0.5, 10.2, 0.3)).toBe(3);
    expect(qbinom(0.5, 10.5, 0.3)).toBe(3);
    expect(qbinom(0.5, 11.5, 0.3)).toBe(4);
    expect(qbinom(0.9, 2.5, 0.5)).toBe(2);
    expect(qbinom(1, 10.5, 0.3)).toBe(10);
    expect(qbinom(-1, 10.2, 0.3, { logP: true })).toBe(2);
    expect(qbinom(0.2, 10.2, 0.3, { lowerTail: false })).toBe(4);
  });
  it("a size that rounds to -0 is the point mass at 0, below that NaN (R 4.5.2)", () => {
    expect(qbinom(0.5, -0.1, 0.3)).toBe(0);
    expect(qbinom(1, -0.1, 0.3)).toBe(-0); // the upper end n = -0, as R (1 / qbinom(1, -0.1, 0.3) is -Inf)
    expect(qbinom(0.5, -0.5, 0.3)).toBe(0);
    expect(qbinom(0.5, -0.6, 0.3)).toBeNaN();
  });
  it("dbinom and pbinom stay NaN for a non-integer size, as R", () => {
    expect(dbinom(3, 10.2, 0.3)).toBeNaN();
    expect(pbinom(3, 10.2, 0.3)).toBeNaN();
  });
});
