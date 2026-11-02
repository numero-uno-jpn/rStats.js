// Issue #148: with both shapes below 1e-300, I_x(a, b) is b/(a + b) to double precision for every x in (0, 1) (the
// distribution is two point masses at 0 and 1 in the limit, corrections of relative order 1e-297). The series overflowed
// in 1/a and the prefactor a b/(a + b) underflowed to 0: pbeta(0.5, 2^-1074, 2^-1074) was NaN, and for two subnormal
// shapes the linear values were -Infinity (review_fix_log_issue148.md). References: Rmpfr b/(a + b) and a/(a + b) of
// the exact shapes (R 4.5.2 takes the same limit; its two roundings are off by an ulp in some cases).
import { describe, expect, it } from "vitest";
import { pbeta } from "../src/index.js";

const M = Number.MIN_VALUE;
const rel = (x: number, y: number): number => Math.abs(x / y - 1);

type Four = [number, number, number, number];
const both = (x: number, a: number, b: number): Four => [
  pbeta(x, a, b),
  pbeta(x, a, b, { lowerTail: false }),
  pbeta(x, a, b, { logP: true }),
  pbeta(x, a, b, { lowerTail: false, logP: true }),
];

describe("issue #148", () => {
  it("is exactly 1/2 for equal subnormal shapes", () => {
    for (const x of [M, 1e-300, 0.1, 0.5, 0.9, 1 - 2 ** -53]) {
      expect(both(x, M, M), `x = ${x}`).toEqual([0.5, 0.5, -Math.LN2, -Math.LN2]);
      expect(both(x, 3e-310, 3e-310), `x = ${x}`).toEqual([0.5, 0.5, -Math.LN2, -Math.LN2]);
    }
  });

  it("is b/(a + b) for unequal tiny shapes", () => {
    const cases: [number, number, number, Four][] = [
      [0.5, 20 * M, M, [1 / 21, 20 / 21, -3.044522437723423, -0.048790164169432]],
      [9.999999999999994e-301, 9.4e-323, 7.956823e-318, [0.9999882024069574, 1.179759304264892e-5, -1.1797662634797067e-5, -11.347615026735822]],
      [1e-10, 3.47572e-317, 1.99595109e-315, [0.9828841975338354, 0.01711580246616457, -0.017263970928321458, -4.067753121381954]],
      [0.1, 4.66059593340102e-303, 2.0177428756171453e-304, [0.041497104990447196, 0.9585028950095528, -3.1821316134451076, -0.04238269614674477]],
      [0.9, 1.94834e-318, 1.2482200878498873e-302, [0.9999999999999999, 1.5608929963770527e-16, -1.560892996377053e-16, -36.39610339684585]],
      [1 - 2 ** -53, 7.577688240022e-310, 5.332933081924714e-307, [0.9985810929766576, 0.0014189070233423097, -0.001419914625154399, -6.557868405613155]],
    ];
    for (const [x, a, b, ref] of cases) {
      const v = both(x, a, b);
      expect(v[0], `${x} ${a} ${b}`).toBe(ref[0]);
      expect(v[1], `${x} ${a} ${b}`).toBe(ref[1]);
      expect(rel(v[2], ref[2]), `${x} ${a} ${b}`).toBeLessThan(3e-16);
      expect(rel(v[3], ref[3]), `${x} ${a} ${b}`).toBeLessThan(3e-16);
    }
  });
});
