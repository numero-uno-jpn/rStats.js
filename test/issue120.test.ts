// Issue #120: distSummary("lnorm") where sdlog^2 underflows: the sd, sigma e^mu to first order, and the skewness, 3 sigma,
// are representable but were 0 or off (review_fix_log_issue120.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #120", () => {
  it("keeps the sd and skewness of a tiny sdlog", () => {
    for (const sdlog of [1e-200, 1e-160, 1e-150]) {
      for (const meanlog of [0, 2]) {
        const s = distSummary("lnorm", { meanlog, sdlog });
        expect(rel(s.sd, sdlog * Math.exp(meanlog)), `${sdlog}, ${meanlog}`).toBeLessThan(1e-15);
        expect(rel(s.skewness, 3 * sdlog), `${sdlog}, ${meanlog}`).toBeLessThan(1e-15);
      }
    }
    expect(distSummary("lnorm", { meanlog: 0, sdlog: 1e-200 }).variance).toBe(0);
  });

  it("keeps the ordinary sdlog as before", () => {
    const s = distSummary("lnorm", { meanlog: 0, sdlog: 0.5 });
    expect(s.sd).toBe(0.6039005332108812);
    expect(s.skewness).toBe(1.7501896550697182);
    expect(distSummary("lnorm", { meanlog: 0, sdlog: 1e-8 }).sd).toBe(1e-8);
  });
});
