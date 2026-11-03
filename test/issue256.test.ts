// Issue #256: pivotLonger's colsVary and pivotWider's namesVary are checked as tidyr's arg_match
// (review_fix_log_issue256.md).
import { describe, expect, it } from "vitest";
import { pivotLonger, pivotWider } from "../src/index.js";

const d = { id: [1, 2], a: [10, 11], b: [20, 21] };
const w = { id: [1, 1], time: ["a", "b"], v1: [10, 20], v2: [30, 40] };

describe("issue #256", () => {
  it("rejects values other than fastest and slowest", () => {
    // tidyr 1.3.2: `cols_vary` must be one of "fastest" or "slowest", not "slwest". (also "slow", no prefixes), and
    // "must be a string or character vector." for a non-string (before the fix: all taken as fastest)
    for (const v of ["slwest", "slow", "Slowest", ""]) {
      expect(() => pivotLonger(d, { cols: ["a", "b"], colsVary: v as never })).toThrow(
        `\`cols_vary\` must be one of "fastest" or "slowest", not "${v}".`,
      );
      expect(() =>
        pivotWider(w, { namesFrom: "time", valuesFrom: ["v1", "v2"], namesVary: v as never }),
      ).toThrow(`\`names_vary\` must be one of "fastest" or "slowest", not "${v}".`);
    }
    expect(() => pivotLonger(d, { cols: ["a", "b"], colsVary: 1 as never })).toThrow(
      "`cols_vary` must be a string or character vector.",
    );
    expect(() => pivotWider(w, { namesFrom: "time", valuesFrom: ["v1", "v2"], namesVary: 1 as never })).toThrow(
      "`names_vary` must be a string or character vector.",
    );
  });

  it("keeps fastest, slowest and the default", () => {
    // tidyr 1.3.2
    const fastest = { id: [1, 1, 2, 2], name: ["a", "b", "a", "b"], value: [10, 20, 11, 21] };
    expect(pivotLonger(d, { cols: ["a", "b"] })).toEqual(fastest);
    expect(pivotLonger(d, { cols: ["a", "b"], colsVary: "fastest" })).toEqual(fastest);
    expect(pivotLonger(d, { cols: ["a", "b"], colsVary: "slowest" })).toEqual({
      id: [1, 2, 1, 2],
      name: ["a", "a", "b", "b"],
      value: [10, 11, 20, 21],
    });
    const names = (namesVary?: "fastest" | "slowest"): string[] =>
      Object.keys(pivotWider(w, { namesFrom: "time", valuesFrom: ["v1", "v2"], ...(namesVary && { namesVary }) }));
    expect(names()).toEqual(["id", "v1_a", "v1_b", "v2_a", "v2_b"]);
    expect(names("fastest")).toEqual(["id", "v1_a", "v1_b", "v2_a", "v2_b"]);
    expect(names("slowest")).toEqual(["id", "v1_a", "v2_a", "v1_b", "v2_b"]);
  });
});
