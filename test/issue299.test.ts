// Issue #299: aov with Error() and an infinite response (review_fix_log_issue299.md).
import { describe, expect, it } from "vitest";
import { aov } from "../src/index.js";

const d = { id: ["s1", "s1", "s2", "s2", "s3", "s3", "s4", "s4"], A: ["a", "b", "a", "b", "a", "b", "a", "b"] };

describe("issue #299: aov with Error() rejects a non-finite response", () => {
  it("throws NA/NaN/Inf in 'y' (was tables of NaN; R the same error)", () => {
    expect(() => aov("y ~ A + Error(id)", { ...d, y: [1, 2, 3, 4, 5, 6, Infinity, 8] })).toThrow("NA/NaN/Inf in 'y'");
    expect(() => aov("y ~ A + Error(id)", { ...d, y: [1, 2, 3, 4, 5, 6, -Infinity, 8] })).toThrow("NA/NaN/Inf in 'y'");
  });

  it("still fits a finite response", () => {
    const f = aov("y ~ A + Error(id)", { ...d, y: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect("strata" in f).toBe(true);
  });
});
