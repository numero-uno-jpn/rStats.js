// Issue #253: survfit's log-log interval where the survival is 1 (no events yet). survival 3.8.3 (R 4.5.2) gives NA
// there; rStats.js gives NaN. The log and plain intervals are 1, as survival.
import { describe, expect, it } from "vitest";
import { survfit } from "../src/index.js";

describe("issue #253", () => {
  it("log-log at survival 1 is NaN, as survival's NA", () => {
    const f = survfit([1, 2], [0, 0], { confType: "log-log" });
    expect(f.surv).toEqual([1, 1]);
    expect(f.lower.every(Number.isNaN)).toBe(true);
    expect(f.upper.every(Number.isNaN)).toBe(true);
  });

  it("log and plain are 1 there, and log-log is defined after an event, as survival", () => {
    expect(survfit([1, 2], [0, 0], { confType: "log" }).lower).toEqual([1, 1]);
    expect(survfit([1, 2], [0, 0], { confType: "plain" }).upper).toEqual([1, 1]);
    const f = survfit([1, 2, 3], [0, 1, 0], { confType: "log-log" });
    // survival 3.8.3: lower NA 0.005983088 0.005983088, upper NA 0.9104101 0.9104101
    expect(f.lower[0]).toBeNaN();
    expect(f.lower[1]).toBeCloseTo(0.005983088, 9);
    expect(f.upper[1]).toBeCloseTo(0.9104101, 7);
  });
});
