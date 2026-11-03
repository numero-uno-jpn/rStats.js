// Issue #461: formula names in Unicode letters, letter numbers, non-ASCII digits and marks (review_fix_log_issue461.md).
import { describe, expect, it } from "vitest";
import { lm, modelMatrix } from "../src/index.js";

describe("issue #461", () => {
  it("fits a formula with Japanese names", () => {
    // R: lm(転帰 ~ 年齢, data.frame(転帰 = c(0, 1, 0, 1), 年齢 = c(20, 30, 40, 50))): -0x1.99999999999a4p-3 0x1.47ae147ae147dp-6
    const fit = lm("転帰 ~ 年齢", { 転帰: [0, 1, 0, 1], 年齢: [20, 30, 40, 50] });
    expect(fit.coefficients[0]).toBeCloseTo(-0.2, 14);
    expect(fit.coefficients[1]).toBeCloseTo(0.02, 14);
  });

  it("takes a non-ASCII digit or a letter number first", () => {
    // R: lm(y ~ ١a + Ⅰb, ...): 0x1.cp-1 0x1.9fffffffffffep+0 -0x1.bfffffffffffdp-1
    const fit = lm("y ~ ١a + Ⅰb", { y: [1, 3, 2, 5], "١a": [1, 2, 3, 4], Ⅰb: [2, 1, 4, 3] });
    expect(fit.coefficients[0]).toBeCloseTo(0.875, 13);
    expect(fit.coefficients[1]).toBeCloseTo(1.625, 13);
    expect(fit.coefficients[2]).toBeCloseTo(-0.875, 13);
  });

  it("takes combining marks and characters outside the BMP (wider than R on Windows)", () => {
    const data = { "नमस्ते": [1, 2, 3], "𝐀𠀀": [2, 5, 4], y: [1, 2, 4] };
    expect(modelMatrix("y ~ नमस्ते + 𝐀𠀀", data).colNames).toEqual(["(Intercept)", "नमस्ते", "𝐀𠀀"]);
  });

  it("keeps the rules for _, ASCII digits and symbols", () => {
    const data = { _a: [1, 2], x: [1, 2] };
    expect(() => lm("_a ~ x", data)).toThrow("invalid formula: unexpected '_'");
    // R: y ~ ・x is a parse error (・ U+30FB is not a name character); ² is not either
    expect(() => lm("x ~ ・x", data)).toThrow("invalid formula");
    expect(() => lm("x ~ x²", data)).toThrow("invalid formula");
  });
});
