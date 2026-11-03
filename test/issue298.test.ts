// Issue #298: lmer with a non-finite variable only in a random-effects term (review_fix_log_issue298.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/entries/mixed.js";

const g = ["a", "a", "a", "a", "b", "b", "b", "b", "c", "c", "c", "c"];
const y = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 12];
const x = [1, 2, Infinity, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe("issue #298: lmer rejects a non-finite random-effects column", () => {
  it("throws for (x | g) (was 'not positive definite'; R 'objective in x0 returns NA')", () => {
    expect(() => lmer("y ~ 1 + (x | g)", { y, x, g })).toThrow("NA/NaN/Inf in the random-effects term (x | g)");
  });

  it("throws for (0 + x | g) (was a TypeError)", () => {
    expect(() => lmer("y ~ 1 + (0 + x | g)", { y, x, g })).toThrow("NA/NaN/Inf in the random-effects term (0 + x | g)");
  });

  it("keeps the earlier identifiability error of the issue's 6 rows (as R)", () => {
    expect(() => lmer("y ~ 1 + (x | g)", { y: [1, 2, 3, 4, 5, 6], x: [1, 2, Infinity, 4, 5, 6], g: ["a", "a", "b", "b", "c", "c"] })).toThrow(
      "number of observations (=6) <= number of random effects (=6)",
    );
  });
});
