// Issue #396: rnorm where sd·Z overflows although mean + sd·Z is in range. R 4.5.2: set.seed(7);
// rnorm(1, -2^1023, 2^1023) is Inf (Z = 0x1.24c483d5e9c7p+1, 2 uniforms drawn); the value is 2^1023 (Z - 1), exact.
// The issue's rnorm(1, -1e308, 1e308) is 0x1.6e9ec2dfbf524p+1023 = 1.2872471613405238e308 (the issue's correctly
// rounded value). A true overflow stays Inf (review_fix_log_issue396.md).
import { describe, expect, it } from "vitest";
import { rnorm, runif, setSeed } from "../src/index.js";

describe("issue #396", () => {
  it("gives the finite mean + sd Z when only the product overflows, with R's draws", () => {
    setSeed(7);
    const z = rnorm(1)[0]!;
    const next = runif(1)[0];
    expect(z).toBe(0x124c483d5e9c7 * 2 ** -47);
    setSeed(7);
    expect(rnorm(1, { mean: -(2 ** 1023), sd: 2 ** 1023 })).toEqual([2 ** 1023 * (z - 1)]);
    expect(runif(1)[0]).toBe(next);
    setSeed(7);
    expect(rnorm(1, { mean: -1e308, sd: 1e308 })).toEqual([1.2872471613405238e308]);
  });

  it("keeps a true overflow and values in range", () => {
    setSeed(7);
    expect(rnorm(1, { mean: 0, sd: 2 ** 1023 })).toEqual([Infinity]);
    setSeed(1);
    expect(rnorm(1, { mean: 2 ** 1023, sd: 2 ** 1023 })).toEqual([0x17e82e469a0e12 * 2 ** (1021 - 52)]);
  });
});
