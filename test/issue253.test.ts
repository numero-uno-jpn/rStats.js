// Issue #253: survfit's log-log interval where the survival is 1 (no events yet). survival 3.8.3 (R 4.5.2) gave NA
// there (rStats.js NaN); survival 3.8-12 (R 4.6.2) gives 1 and 1, as rStats.js now. The log and plain intervals are 1,
// as survival.
import { describe, expect, it } from "vitest";
import { survfit } from "../src/index.js";

describe("issue #253", () => {
  it("log-log at survival 1 is 1, as survival 3.8-12", () => {
    const f = survfit([1, 2], [0, 0], { confType: "log-log" });
    expect(f.surv).toEqual([1, 1]);
    expect(f.lower).toEqual([1, 1]);
    expect(f.upper).toEqual([1, 1]);
  });

  it("log and plain are 1 there, and log-log is defined after an event, as survival", () => {
    expect(survfit([1, 2], [0, 0], { confType: "log" }).lower).toEqual([1, 1]);
    expect(survfit([1, 2], [0, 0], { confType: "plain" }).upper).toEqual([1, 1]);
    const f = survfit([1, 2, 3], [0, 1, 0], { confType: "log-log" });
    // survival 3.8-12: lower 1 0.005983088 0.005983088, upper 1 0.9104101 0.9104101 (3.8.3: NA at the first time)
    expect(f.lower[0]).toBe(1);
    expect(f.lower[1]).toBeCloseTo(0.005983088, 9);
    expect(f.upper[1]).toBeCloseTo(0.9104101, 7);
  });
});
