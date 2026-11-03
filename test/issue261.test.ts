// Issue #261: omega rejects a single variable, as psych::omega does (review_fix_log_issue261.md).
import { describe, expect, it } from "vitest";
import { omega } from "../src/index.js";

describe("issue #261", () => {
  it("rejects one variable (data or covmat)", () => {
    // psych 2.x on R 4.5.2: "'x' must be an array of at least two dimensions" for both (before the fix: omegaLim
    // Infinity, alpha NaN)
    expect(() => omega([[1], [2], [3]], { nfactors: 1 })).toThrow("omega needs at least 2 variables (got 1)");
    expect(() => omega(null, { covmat: [[1]], nfactors: 1 })).toThrow("omega needs at least 2 variables (got 1)");
    expect(() => omega([[1], [2], [3]])).toThrow("omega needs at least 2 variables (got 1)");
  });

  it("keeps two variables", () => {
    // values before the fix; psych: omega_h 0x1.5555555555554p-1, omega.lim 0x1.ffffffffffffep-1,
    // alpha 0x1.5555555555555p-1, omega.tot 0x1.5555555555555p-1
    const r = omega(null, { covmat: [[1, 0.5], [0.5, 1]], nfactors: 1 });
    expect(r.omegaH).toBe(0.6666666666666664);
    expect(r.omegaLim).toBe(0.9999999999999998);
    expect(r.alpha).toBe(0.6666666666666666);
    expect(r.omegaTot).toBe(0.6666666666666665);
  });
});
