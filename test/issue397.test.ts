// Issue #397: the monoH.FC limiter where the slope ratios overflow (review_fix_log_issue397.md).
import { describe, expect, it } from "vitest";
import { splinefun, splinefunH } from "../src/index.js";

describe("issue #397", () => {
  it("applies the limiter where the ratios overflow", () => {
    // R 4.5.2: -0x1.4e718d7d7625dp+660 (-6.25e198) and 4.375e199, as it was here. In exact arithmetic the limited
    // slopes are 3 S_0 / sqrt(1 + beta^2) (about 6e-600, 0 in doubles) and 3 S_0 beta / sqrt(1 + beta^2) (3e-200 to
    // within 1e-800 relative), beta = 5e399: the Hermite spline with slopes (0, 3e-200, 1e200)
    const f = splinefun([0, 1, 2], [0, 1e-200, 1e200], { method: "monoH.FC" });
    const u = [0.25, 0.5, 0.75, 1.5];
    expect(f(u)).toEqual(splinefunH([0, 1, 2], [0, 1e-200, 1e200], [0, 3 * 1e-200, 1e200])(u));
    expect(f([0.5])).toEqual([1.25e-201]);
    const v = f([0, 0.25, 0.5, 0.75, 1]);
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThan(v[i - 1]!);
  });

  it("keeps values in the ordinary range", () => {
    expect(splinefun([0, 1, 2], [0, 1, 10], { method: "monoH.FC" })([0.5, 1.5])).toEqual([0.205825797292724, 4.742717753384095]);
  });
});
