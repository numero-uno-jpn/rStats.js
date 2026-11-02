// Issue #150: pchisq with ncp = 1e308 at a tiny q ends (the lower Poisson-mixture sum stops after two terms).
import { describe, expect, it } from "vitest";
import { pchisq } from "../src/index.js";

describe("issue #150", () => {
  it("the issue's example ends with the right values", () => {
    const q = 2 ** -1030;
    expect(pchisq(q, 2, { ncp: 1e308 })).toBe(0);
    // log P = -ncp/2 + log(q/2) to double precision (R: -Inf); 1 ulp below the correctly rounded -5e307 (issue #64)
    expect(pchisq(q, 2, { ncp: 1e308, logP: true })).toBe(-5.000000000000001e307);
    expect(pchisq(q, 2, { ncp: 1e308, lowerTail: false })).toBe(1);
  });
});
