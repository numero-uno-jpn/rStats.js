// Issue #462: modelMatrix with a one-level factor and no intercept is an error, as R (review_fix_log_issue462.md).
import { describe, expect, it } from "vitest";
import { lm, modelMatrix } from "../src/index.js";

describe("issue #462", () => {
  it("~ 0 + g with one level is R's error", () => {
    // R 4.5.2: model.matrix(~ 0 + g) and lm(y ~ 0 + g) stop with the same message (character or factor g)
    const msg = "contrasts can be applied only to factors with 2 or more levels";
    expect(() => modelMatrix("~ 0 + g", { g: ["a", "a", "a"] })).toThrow(msg);
    expect(() => lm("y ~ 0 + g", { y: [1, 2, 3], g: ["a", "a", "a"] })).toThrow(msg);
  });
});
