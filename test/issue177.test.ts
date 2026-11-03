// Issue #177: the gaussian AIC leaves out rows of prior weight 0 (review 65, user decision; R gives Inf).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

describe("issue #177", () => {
  it("the AIC with a row of weight 0 is that of the fit without the row", () => {
    const withZero = glm([[], [], []], [1, 2, 100], { family: "gaussian", weights: [1, 1, 0] });
    const without = glm([[], []], [1, 2], { family: "gaussian" });
    // R 4.5.2: Inf for the first; AIC(glm(c(1, 2) ~ 1)) = 0x1.b9cd764b54262p+2 for the second
    expect(withZero.aic).toBe(6.903165410578907);
    expect(without.aic).toBe(6.903165410578909);
    expect(withZero.aic).toBeCloseTo(without.aic, 12);
  });
});
