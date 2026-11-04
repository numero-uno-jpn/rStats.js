// Issue #475: rweibull with shape 0 and a positive scale is NaN and draws no uniform, as R 4.5.2
// (review_fix_log_issue475.md).
import { describe, expect, it } from "vitest";
import { rweibull, runif, setSeed } from "../src/index.js";

describe("issue #475", () => {
  it("shape 0 gives NaN without a draw", () => {
    // R 4.5.2: set.seed(1); rweibull(1, 0, 1) is NaN (warning), the next runif(1) is the first uniform 0x1.0fe180c4p-2
    setSeed(1);
    expect(rweibull(1, 0, { scale: 1 })).toEqual([NaN]);
    expect(runif(1)).toEqual([0x10fe180c4 * 2 ** -34]);
  });
});
