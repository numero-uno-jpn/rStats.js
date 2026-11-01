// Issue #18: table rejects an unknown useNA (review_fix_log_issue18.md).
import { describe, expect, it } from "vitest";
import { table } from "../src/index.js";

describe("issue #18", () => {
  it("rejects a value of useNA other than no, ifany and always, as R's match.arg", () => {
    // "sometimes" was taken as "no" (R: 'arg' should be one of "no", "ifany", "always")
    expect(() => table([1, NaN, 2], { useNA: "sometimes" as "no" })).toThrow("'arg' should be one of “no”, “ifany”, “always”");
    expect(table([1, NaN, 2])).toEqual({ values: [1, 2], counts: [1, 1] });
    expect(table([1, NaN, 2], { useNA: "ifany" })).toEqual({ values: [1, 2, NaN], counts: [1, 1, 1] });
    expect(table([1, 2], { useNA: "always" })).toEqual({ values: [1, 2, NaN], counts: [1, 1, 0] });
  });
});
