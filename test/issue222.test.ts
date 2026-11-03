// Issue #222: rate and scale given together are accepted where abs(rate * scale - 1) < 1e-15 and the scale is used,
// as R's dgamma, pgamma, qgamma and rgamma (R warns "specify 'rate' or 'scale' but not both"); beyond that an error.
import { describe, expect, it } from "vitest";
import { dgamma, pgamma } from "../src/index.js";

describe("issue #222", () => {
  it("the issue's pair (product 1 + 8.9e-16) uses the scale, as R", () => {
    const s = 1 + 4 * Number.EPSILON;
    // R 4.5.2: dgamma(2, 3, rate = 1, scale = s) = dgamma(2, 3, scale = s) = 0x1.152aaa3bf81c8p-2, with the warning
    expect(dgamma(2, 3, { rate: 1, scale: s })).toBe(dgamma(2, 3, { scale: s }));
    expect(dgamma(2, 3, { rate: 1, scale: s })).toBe(0.2706705664732252);
    expect(pgamma(2, 3, { rate: 1, scale: s })).toBe(pgamma(2, 3, { scale: s }));
  });

  it("a product 1 + 1.8e-15 is an error, as R", () => {
    expect(() => dgamma(2, 3, { rate: 1, scale: 1 + 8 * Number.EPSILON })).toThrow("rate and scale can both be given only when scale = 1 / rate");
  });
});
