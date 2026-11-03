// Issue #297: lmer with a non-finite response (review_fix_log_issue297.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/entries/mixed.js";

const g = ["a", "a", "b", "b", "c", "c", "d", "d"];

describe("issue #297: lmer rejects a non-finite response", () => {
  it("throws NA/NaN/Inf in 'y' without fixed columns (was the exact-fit error; R the same error)", () => {
    expect(() => lmer("y ~ 0 + (1 | g)", { y: [Infinity, 1, 2, 3, 4, 5, 6, 7], g })).toThrow("NA/NaN/Inf in 'y'");
  });

  it("throws NA/NaN/Inf in 'y' with an intercept (was a TypeError from the QR)", () => {
    expect(() => lmer("y ~ 1 + (1 | g)", { y: [Infinity, 1, 2, 3, 4, 5, 6, 7], g })).toThrow("NA/NaN/Inf in 'y'");
    expect(() => lmer("y ~ 1 + (1 | g)", { y: [1, 2, 3, -Infinity, 4, 5, 6, 7], g })).toThrow("NA/NaN/Inf in 'y'");
  });
});
