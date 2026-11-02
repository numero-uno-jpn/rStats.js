// Issue #106: log1pmx where x^2 is 0 (x = 0 included) returns +0 at once instead of after the 498 steps of its series,
// whose test |term| < eps |res| is then 0 < 0 (review_fix_log_issue106.md). The values are those before.
import { describe, expect, it } from "vitest";
import { log1pmx } from "../src/special/log1pmx.js";

describe("issue #106", () => {
  it("returns +0 where x^2 is 0", () => {
    for (const x of [0, -0, Number.MIN_VALUE, 1e-200, -1e-200]) expect(Object.is(log1pmx(x), 0), String(x)).toBe(true);
  });

  it("keeps the values elsewhere", () => {
    expect(log1pmx(1e-5)).toBe(-4.9999666669166655e-11);
    expect(log1pmx(-0.3)).toBe(-0.05667494393873237);
    expect(log1pmx(1e-150)).toBe(-5e-301);
  });
});
