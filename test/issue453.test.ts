// Issue #453: modelMatrix takes a response of any type (review_fix_log_issue453.md).
import { describe, expect, it } from "vitest";
import { lm, modelMatrix } from "../src/index.js";

describe("issue #453", () => {
  it("gives the design matrix with a string or boolean response", () => {
    // R: model.matrix(group ~ x, data.frame(group = c("control", "case"), x = c(1, 2))) (and group = c(TRUE, FALSE)):
    // (Intercept) 1 1, x 1 2
    for (const group of [["control", "case"], [true, false]]) {
      const m = modelMatrix("group ~ x", { group, x: [1, 2] });
      expect(m.colNames).toEqual(["(Intercept)", "x"]);
      expect(m.x).toEqual([
        [1, 1],
        [1, 2],
      ]);
    }
  });

  it("drops the rows where the response is missing, with a factor predictor", () => {
    // R: model.matrix(group ~ A, data.frame(group = c("u", NA, "v", "u"), A = c("a", "b", "b", "a"))): rows 1 3 4,
    // (Intercept) 1 1 1, Ab 0 1 0
    const m = modelMatrix("group ~ A", { group: ["u", null, "v", "u"], A: ["a", "b", "b", "a"] });
    expect(m.colNames).toEqual(["(Intercept)", "Ab"]);
    expect(m.x).toEqual([
      [1, 0],
      [1, 1],
      [1, 0],
    ]);
    expect(m.rows).toEqual([0, 2, 3]);
  });

  it("keeps the error in lm", () => {
    expect(() => lm("group ~ x", { group: ["control", "case", "x"], x: [1, 2, 4] })).toThrow("the response must be numeric");
  });
});
