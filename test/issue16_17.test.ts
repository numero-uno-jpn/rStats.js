// Issues #16 and #17: cor's diagonal (changed in #78) and quantile's missing probabilities (review_fix_log_issue16_17.md).
import { describe, expect, it } from "vitest";
import { cor, quantile } from "../src/index.js";

describe("issues #16 and #17", () => {
  it("#16: cor of a matrix has NaN on the diagonal for a constant column or one with NaN (issue #78; R gives 1)", () => {
    // R 4.5.2: cor(cbind(c(1, 1, 1), c(1, 2, 3))) and cor(cbind(c(1, NA, 3), c(2, 3, 4)), use = "everything") are
    // [[1, NA], [NA, 1]]; the correlation of such a column with itself is undefined (0/0, NA), and the decision of #16
    // to keep R's 1 was reversed in #78
    expect(cor([[1, 1], [1, 2], [1, 3]])).toEqual([[NaN, NaN], [NaN, 1]]);
    expect(cor([[1, 2], [NaN, 3], [3, 4]], undefined, { use: "everything" })).toEqual([[NaN, NaN], [NaN, 1]]);
    expect(cor([[1, 1], [1, 2], [1, 3]], undefined, { method: "spearman" })).toEqual([[NaN, NaN], [NaN, 1]]);
  });

  it("#17: quantile gives NaN for a missing probability, as R (no error)", () => {
    // R 4.5.2: quantile(c(1, 2, 3), probs = c(0.25, NA, 0.75)) is 1.5, NA, 2.5
    expect(quantile([1, 2, 3], [0.25, NaN, 0.75])).toEqual([1.5, NaN, 2.5]);
  });
});
