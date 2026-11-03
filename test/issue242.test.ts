// Issue #242: distSummary("triang") at a scale of 1e-200, where q = a^2 + b^2 + c^2 - ab - ac - bc underflows. Fixed by
// #144 (skewness from the scaled parameters) and #243 (q from differences).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #242", () => {
  it("the issue's symmetric example has skewness 0 and the sd sqrt(q / 18)", () => {
    const s = distSummary("triang", { a: 0, b: 1e-200, c: 5e-201 }) as { sd: number; skewness: number };
    expect(s.skewness).toBe(0);
    expect(s.sd).toBe(2.0412414523193148e-201); // 1e-200 / sqrt(24) to 1 ulp (the value before this judging)
  });

  it("an asymmetric example has the skewness of [0, 1] with mode 0.2", () => {
    const tiny = distSummary("triang", { a: 0, b: 1e-200, c: 2e-201 }) as { skewness: number };
    const unit = distSummary("triang", { a: 0, b: 1, c: 0.2 }) as { skewness: number };
    expect(tiny.skewness).toBe(unit.skewness);
  });
});
