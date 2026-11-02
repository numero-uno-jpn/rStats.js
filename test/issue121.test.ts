// Issue #121: qtriang with the mode at an end and a log probability whose exp underflows (review_fix_log_issue121.md).
// Near the mode the distance from it is w e^p / (1 + sqrt(t)), t = 1 here: w e^p / 2. extraDistr: -Inf and 0.
import { describe, expect, it } from "vitest";
import { ptriang, qtriang } from "../src/index.js";

// w e^-1000 / 2 for w = 1e308: 2.5379794487747283826e-127 (the issue's 80-digit value)
const want = 2.5379794487747284e-127;

describe("issue #121", () => {
  it("keeps the distance from a mode at an end", () => {
    const x = qtriang(-1000, { a: 0, b: 1e308, c: 0, logP: true });
    expect(Math.abs(x / want - 1)).toBeLessThan(4e-16);
    const y = qtriang(-1000, { a: -1e308, b: 0, c: 0, lowerTail: false, logP: true });
    expect(Math.abs(y / -want - 1)).toBeLessThan(4e-16);
    // and back
    expect(Math.abs(ptriang(x, { a: 0, b: 1e308, c: 0, logP: true }) / -1000 - 1)).toBeLessThan(1e-12);
  });

  it("keeps the other cases as before", () => {
    expect(qtriang(-700, { a: 0, b: 1e308, c: 0, logP: true })).toBe(4929.838271879886);
    expect(qtriang(-1000, { a: 0, b: 1, c: 0, logP: true })).toBe(0);
    expect(qtriang(0.3, { a: 0, b: 2, c: 0.5 })).toBe(0.5508623253810562);
  });
});
