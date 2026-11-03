// Issue #257: quantile accepts probabilities within 100 eps outside [0, 1] and clamps them, as R's quantile
// (quantile(1:3, c(-1e-14, 1 + 1e-14)) is 1 3 in R 4.5.2 for every type); beyond that it is an error, as R.
import { describe, expect, it } from "vitest";
import { quantile } from "../src/index.js";

describe("issue #257", () => {
  it("probabilities within 100 eps of [0, 1] give the ends, as R", () => {
    for (let type = 1; type <= 9; type++) {
      expect(quantile([1, 2, 3], [-1e-14, 1 + 1e-14], { type: type as 1 })).toEqual([1, 3]);
    }
  });

  it("beyond 100 eps is an error, as R", () => {
    const eps = 100 * Number.EPSILON;
    expect(() => quantile([1, 2, 3], -eps * 1.01)).toThrow("'probs' outside [0,1]");
    expect(() => quantile([1, 2, 3], 1 + eps * 1.01)).toThrow("'probs' outside [0,1]");
    expect(() => quantile([1, 2, 3], -1e-13)).toThrow("'probs' outside [0,1]");
  });
});
