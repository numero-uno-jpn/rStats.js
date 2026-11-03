// Issue #274: seq with an infinite `by` in the wrong direction (review_fix_log_issue274.md).
import { describe, expect, it } from "vitest";
import { seq } from "../src/index.js";

describe("issue #274", () => {
  it("rejects an infinite by that points away from `to`", () => {
    expect(() => seq(1, 10, { by: -Infinity })).toThrow("wrong sign in 'by' argument");
    expect(() => seq(10, 1, { by: Infinity })).toThrow("wrong sign in 'by' argument");
    expect(() => seq(-1e308, 1e308, { by: -Infinity })).toThrow("wrong sign in 'by' argument");
  });

  it("keeps [from] for an infinite by in the direction of `to` (the recorded decision)", () => {
    expect(seq(1, 10, { by: Infinity })).toEqual([1]);
    expect(seq(10, 1, { by: -Infinity })).toEqual([10]);
    expect(seq(1, 1, { by: -Infinity })).toEqual([1]);
    expect(seq(0, 0, { by: Infinity })).toEqual([0]);
  });

  it("leaves finite steps unchanged", () => {
    expect(seq(0, 1, { by: 0.25 })).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(seq(1, 1, { by: -1 })).toEqual([1]);
    expect(() => seq(1, 10, { by: -1 })).toThrow("wrong sign in 'by' argument");
  });
});
