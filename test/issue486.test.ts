// Issue #486: rbinom with a non-integer size is NaN, as R 4.5.2 (review_fix_log_issue486.md).
import { describe, expect, it } from "vitest";
import { rbinom } from "../src/index.js";

describe("issue #486", () => {
  it("half-integer sizes give NaN as R", () => {
    // R 4.5.2: rbinom(1, 2.5, 1), rbinom(1, 4.5, 1) and rbinom(1, -2.5, 1) are NA with a warning
    expect([rbinom(1, 2.5, 1), rbinom(1, 4.5, 1), rbinom(1, -2.5, 1)]).toEqual([[NaN], [NaN], [NaN]]);
  });
});
