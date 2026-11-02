// Issue #51: integrate where the midpoint a + b overflows (review_fix_log_issue51.md).
import { describe, expect, it } from "vitest";
import { integrate } from "../src/index.js";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("issue #51", () => {
  it("integrates over large same-sign finite limits (R 4.5.2: 0)", () => {
    // every node was at Inf: 0 with error 0 and "OK"
    const r = integrate((x) => 1 / x, 1e308, 1.1e308);
    expect(rel(r.value, 0.09531017980432482)).toBeLessThan(1e-13);
    expect(r.message).toBe("OK");
    expect(rel(integrate((x) => 1 / x, -1.1e308, -1e308).value, -0.09531017980432482)).toBeLessThan(1e-13);
    // a + b is finite here, but the midpoints of the upper subintervals were not: 7.5 for the step, and
    // "non-finite function value" for the exponential (both integrals are 1)
    expect(rel(integrate((x) => (x > 1.4e308 ? 1 / 1e307 : 0), 0, 1.5e308).value, 1)).toBeLessThan(1e-12);
    expect(rel(integrate((x) => Math.exp((x - 1.5e308) / 1e306) / 1e306, 0, 1.5e308).value, 1)).toBeLessThan(1e-12);
  });

  it("leaves other intervals as before", () => {
    const d = (x: number) => Math.exp(-0.5 * (x / 1e307) ** 2) / (Math.sqrt(2 * Math.PI) * 1e307);
    expect(integrate(d, -1.5e308, 1.5e308).value).toBe(1.0000000000000402);
    expect(integrate(Math.exp, 0, 1).value).toBe(1.7182818284590453);
    expect(integrate((x) => 1 / x, 1e307, 1.1e307).value).toBe(0.09531017980432484);
    expect(integrate((x) => 1 / x, 1e307, 8.9e307).value).toBe(2.1860512767496867);
  });
});
