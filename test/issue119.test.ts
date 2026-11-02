// Issue #119: pbvnorm with huge finite bounds, which overflowed h k and h^2 into NaN (review_fix_log_issue119.md). A
// bound beyond ±40 changes the probability by less than Φ(-40) = 3.7e-350, so the answer is that of the infinite
// bound. mvtnorm 1.x: NaN for these.
import { describe, expect, it } from "vitest";
import { pbvnorm } from "../src/index.js";

const I = Infinity;
const RHOS = [0.5, -0.5, 0, 0.95, -0.95, 0.999];

describe("issue #119", () => {
  it("gives 1 and 0 for the issue's rectangles", () => {
    for (const r of RHOS) {
      expect(pbvnorm([-1e200, -1e200], [I, I], r), String(r)).toBe(1);
      expect(pbvnorm([1e200, 1e200], [I, I], r), String(r)).toBe(0);
      expect(pbvnorm([-1e200, -1e200], [1e200, 1e200], r), String(r)).toBe(1);
      expect(pbvnorm([-40, -1e200], [I, I], r), String(r)).toBe(pbvnorm([-40, -I], [I, I], r));
      expect(pbvnorm([1e20, -3], [I, I], r), String(r)).toBe(0);
    }
  });

  it("agrees with the infinite bounds for huge finite ones", () => {
    let seed = 119;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const huge = (v: number): number => (v === I ? 1e300 : v === -I ? -1e300 : v);
    for (let i = 0; i < 300; i++) {
      const pick = (): number => (rnd() < 0.3 ? (rnd() < 0.5 ? -I : I) : (rnd() - 0.5) * 8);
      const lo = [pick(), pick()].map((v) => (v === I ? -I : v));
      const hi = [pick(), pick()].map((v) => (v === -I ? I : v));
      const r = 2 * rnd() - 1;
      expect(pbvnorm(lo.map(huge), hi.map(huge), r), `${lo} ${hi} ${r}`).toBe(pbvnorm(lo, hi, r));
    }
  });

  it("keeps bounds within ±40 as before", () => {
    expect(pbvnorm([-I, -I], [0, 0], 0.5)).toBe(0.3333333333333333);
    expect(pbvnorm([-39, 1], [I, I], 0.3)).toBe(0.15865525393145707);
  });
});
