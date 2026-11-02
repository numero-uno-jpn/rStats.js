// Issue #54: logAddExp(Infinity, Infinity) is Infinity (review_fix_log_issue54.md).
import { describe, expect, it } from "vitest";
import { logAddExp } from "../src/internal/ddexp.js";

describe("issue #54", () => {
  it("is Infinity when either term is Infinity", () => {
    // Inf - Inf gave NaN
    expect(logAddExp(Infinity, Infinity)).toBe(Infinity);
    expect(logAddExp(Infinity, 3)).toBe(Infinity);
    expect(logAddExp(3, Infinity)).toBe(Infinity);
    expect(logAddExp(Infinity, -Infinity)).toBe(Infinity);
  });

  it("leaves other values as before", () => {
    expect(logAddExp(-Infinity, -Infinity)).toBe(-Infinity);
    expect(logAddExp(-Infinity, 2)).toBe(2);
    expect(logAddExp(NaN, 1)).toBeNaN();
    expect(Math.abs(logAddExp(Math.log(2), Math.log(3)) / Math.log(5) - 1)).toBeLessThan(1e-15);
  });
});
