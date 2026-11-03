// Issue #255: pivotLonger with one namesTo column requires exactly one capture group in namesPattern, as tidyr
// (review_fix_log_issue255.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

const d = { id: [1], x1: [10], x2: [20] };

describe("issue #255", () => {
  it("rejects a pattern with no capture group or more than one", () => {
    // tidyr 1.3.2: "`regex` should define 1 groups; 0 found." / "...; 2 found." (before the fix: time null, and the
    // first group only)
    expect(() => pivotLonger(d, { cols: ["x1", "x2"], namesTo: "time", namesPattern: "x[0-9]+" })).toThrow(
      "`regex` should define 1 groups; 0 found.",
    );
    expect(() => pivotLonger(d, { cols: ["x1", "x2"], namesTo: "time", namesPattern: "(x)([0-9]+)" })).toThrow(
      "`regex` should define 1 groups; 2 found.",
    );
  });

  it("keeps one capture group, a non-capturing group, and a name that does not match", () => {
    // tidyr 1.3.2: time "1" "2" for "x([0-9]+)" and "(?:x)([0-9]+)"; "1" NA for "x(1)"
    for (const namesPattern of ["x([0-9]+)", "(?:x)([0-9]+)"]) {
      expect(pivotLonger(d, { cols: ["x1", "x2"], namesTo: "time", namesPattern })).toEqual({
        id: [1, 1],
        time: ["1", "2"],
        value: [10, 20],
      });
    }
    expect(pivotLonger(d, { cols: ["x1", "x2"], namesTo: "time", namesPattern: "x(1)" }).time).toEqual(["1", null]);
  });
});
