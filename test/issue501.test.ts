// Issue #501: merge keeps y's numeric key when the result has only rows from y, as R 4.5.2 (#449;
// review_fix_log_issue501.md).
import { describe, expect, it } from "vitest";
import { merge } from "../src/index.js";

describe("issue #501", () => {
  it("rows only in y keep y's type, as R's merge", () => {
    // R 4.5.2: merge(data.frame(id = "unmatched-x"), data.frame(id = 1, value = "from-y"), by = "id", all.y = TRUE)
    // has id num 1; with all = TRUE, id chr "1" "unmatched-x"
    expect(merge({ id: ["unmatched-x"] }, { id: [1], value: ["from-y"] }, { by: "id", allY: true })).toEqual({
      id: [1],
      value: ["from-y"],
    });
    expect(merge({ id: ["unmatched-x"] }, { id: [1], value: ["from-y"] }, { by: "id", allX: true, allY: true })).toEqual({
      id: ["1", "unmatched-x"],
      value: ["from-y", null],
    });
  });
});
