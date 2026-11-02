// Issue #63: a subnormal ncp whose half underflows to 0 in the noncentral beta (review_fix_log_issue63.md).
import { describe, expect, it } from "vitest";
import { pbeta, pf, qbeta, qf } from "../src/index.js";

const TINY = Number.MIN_VALUE;

/** The noncentral path goes through log I_x(a, b) and may differ from the central pbeta in the last bit */
function expectNear(actual: number, expected: number): void {
  expect(Number.isNaN(actual)).toBe(false);
  if (actual === expected) return;
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-15 * Math.abs(expected));
}

describe("issue #63", () => {
  it("gives the central pbeta when ncp / 2 underflows", () => {
    for (const lowerTail of [true, false]) {
      for (const logP of [false, true]) {
        for (const q of [0.5, 1 - 1e-13]) {
          const v = pbeta(q, 1e14, 2, { ncp: TINY, lowerTail, logP });
          expectNear(v, pbeta(q, 1e14, 2, { lowerTail, logP }));
        }
      }
    }
  });

  it("gives the central pf when ncp / 2 underflows", () => {
    expectNear(pf(1, 2e14, 4, { ncp: TINY }), pf(1, 2e14, 4));
    expectNear(pf(1, 2e14, 4, { ncp: TINY, lowerTail: false, logP: true }), pf(1, 2e14, 4, { lowerTail: false, logP: true }));
  });

  it("gives the central quantiles when ncp / 2 underflows", () => {
    expect(qbeta(0.5, 1e14, 2, { ncp: TINY })).toBeCloseTo(qbeta(0.5, 1e14, 2), 14);
    expect(qf(0.5, 2e14, 4, { ncp: TINY }) / qf(0.5, 2e14, 4)).toBeCloseTo(1, 13);
  });

  it("agrees with the series for the smallest positive ncp / 2", () => {
    expect(pbeta(1 - 1e-13, 1e14, 2, { ncp: TINY })).toBe(pbeta(1 - 1e-13, 1e14, 2, { ncp: 2 * TINY }));
  });
});
