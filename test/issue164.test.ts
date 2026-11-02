// Issue #164: the inverse Gaussian deviance contribution w (y - mu)²/(y mu²) overflowed or divided by an underflowed
// y mu² for finite results (Infinity, NaN; R's dev.resids too) (review_fix_log_issue164.md). It is now
// ((y - mu)/mu)²/y there. The same function serves quasi with variance "mu^3".
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #164", () => {
  const ig = makeFamily("inverse.gaussian");
  const dev = (y: number, mu: number, w = 1): number => ig.devContribution(y, mu, w);

  it("keeps finite deviance contributions finite", () => {
    // R: NaN, NaN, NaN, Inf, 2.500000000000747e103, NaN, NaN (dev.resids)
    expect(rel(dev(1e-308, 1e308), 1e308)).toBeLessThan(1e-15);
    expect(dev(1e-200, 1e-200)).toBe(0);
    expect(rel(dev(1e-200, 2e-200), 2.5e199)).toBeLessThan(1e-15);
    expect(rel(dev(1e-150, 2e-150), 2.5e149)).toBeLessThan(1e-15);
    // y mu² = 4e-312 is subnormal: 3e-13 off in the plain form
    expect(rel(dev(1e-104, 2e-104), 2.5e103)).toBeLessThan(1e-15);
    expect(rel(dev(1e200, 3e200), 4 / 9 / 1e200)).toBeLessThan(1e-15);
    expect(rel(dev(0.5, 1e300), 2)).toBeLessThan(1e-15);
    // a weight of 0 gives 0, not 0 × Infinity
    expect(dev(1e-308, 1e308, 0)).toBe(0);
    const quasi = makeFamily({ family: "quasi", variance: "mu^3" });
    expect(rel(quasi.devContribution(1e-308, 1e308, 1), 1e308)).toBeLessThan(1e-15);
  });

  it("keeps the other cases as before", () => {
    expect(dev(2, 3)).toBe(0.05555555555555555);
    expect(dev(2, 3, 7)).toBe((7 * 1) / 18);
  });
});
