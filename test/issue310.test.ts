import { describe, expect, it } from "vitest";
import { cronbachAlpha } from "../src/index.js";

// #310: with one subject the sample covariances and correlations divide by n - 1 = 0, and every value was NaN (psych's
// alpha stops with an error). At least two subjects are now required.
describe("cronbachAlpha needs at least two subjects (#310)", () => {
  it("rejects a single row", () => {
    expect(() => cronbachAlpha([[1, 2]])).toThrow("'x' needs at least two subjects");
    expect(() => cronbachAlpha([[1, 2, 3]])).toThrow("'x' needs at least two subjects");
  });

  it("still reports too few items first", () => {
    expect(() => cronbachAlpha([[1]])).toThrow("'x' needs at least two items");
  });
});
