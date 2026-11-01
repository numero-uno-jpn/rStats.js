// Issue #22: hist without finite observations is R's error (no change; review_fix_log_issue22.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

describe("issue #22 (no change: as R)", () => {
  it("throws R's error for no finite observations", () => {
    // R 4.5.2: hist(numeric(0)) and hist(c(NA, Inf, -Inf)) are "invalid number of 'breaks'"
    expect(() => hist([])).toThrow("invalid number of 'breaks'");
    expect(() => hist([NaN, Infinity, -Infinity])).toThrow("invalid number of 'breaks'");
  });
});
