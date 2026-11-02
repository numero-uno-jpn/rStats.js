// Issue #147: for a subnormal x whose x/2 rounds (odd multiples of the least double), the noncentral χ² density was
// that at x2 = 2 (x/2) times (x/x2)^(df/2 - 1), which assumes the j = 0 component of the Poisson mixture dominates.
// For df = 0 there is no j = 0 term (the density tends to e^-λ/2 λ/4) and for a subnormal df the j = 1 term is
// comparable: dchisq(3 * 2^-1074, 0, ncp = 1) was 0.2022 for 0.1516 (review_fix_log_issue147.md). References: Rmpfr
// sums of the mixture, sum_j dpois(j, λ/2) dchisq(x, df + 2j), with x and df exact multiples of 2^-1074.
import { describe, expect, it } from "vitest";
import { dchisq } from "../src/index.js";

const M = Number.MIN_VALUE;
const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #147", () => {
  it("is the limit e^-1/2 / 4 for df = 0 at every subnormal x", () => {
    const lim = 0.15163266492815836;
    for (const k of [2, 3, 4, 5, 7, 1001, 2 ** 20 + 1]) {
      expect(rel(dchisq(k * M, 0, { ncp: 1 }), lim), `k = ${k}`).toBeLessThan(2e-15);
      expect(rel(dchisq(k * M, 0, { ncp: 1, log: true }), Math.log(lim)), `k = ${k}`).toBeLessThan(2e-15);
    }
  });

  it("mixes the j = 0 and j = 1 terms for a subnormal df", () => {
    // df = 4 * 2^-1074: e^-1/2 (df/(2x) + 1/4)
    const cases: [number, number][] = [
      [3, 0.55598643806991397],
      [5, 0.3942449288132117],
      [7, 0.3249271391317679],
      [1001, 0.15284451439811367],
    ];
    for (const [k, ref] of cases) {
      expect(rel(dchisq(k * M, 4 * M, { ncp: 1 }), ref), `k = ${k}`).toBeLessThan(2e-15);
      expect(rel(dchisq(k * M, 4 * M, { ncp: 1, log: true }), Math.log(ref)), `k = ${k}`).toBeLessThan(2e-15);
    }
  });

  it("keeps the bits where the j = 0 term dominates", () => {
    // values of the implementation before the fix
    expect(dchisq(3 * M, 1e-300, { ncp: 1 })).toBe(2.0460528704301105e22);
    expect(dchisq(3 * M, 1, { ncp: 1 })).toBe(6.285066382912649e160);
    expect(dchisq(3 * M, 3, { ncp: 1, log: true })).toBe(-373.0896683495612);
    expect(dchisq(1001 * M, 0.5, { ncp: 1 })).toBe(2.3853391396142893e239);
  });
});
