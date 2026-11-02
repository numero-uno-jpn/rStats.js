// Issue #153: ptukey's far upper tail (w > 100) formed log(k (k - 1)), which overflows for nmeans above about 1.3e154
// (review_fix_log_issue153.md). Reference: log(k) + log(k - 1) + pnorm(w/√2, lower = FALSE, log = TRUE) in R
// (the asymptotic 1 - W = k (k - 1) Φc(w/√2), relative correction about k e^(-w^2/12) < e^-390 here).
import { describe, expect, it } from "vitest";
import { ptukey } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #153", () => {
  it("keeps the log of the upper tail finite for a huge nmeans", () => {
    const up = ptukey(101, 1e200, Infinity, { lowerTail: false, logP: true });
    expect(rel(up, -1634.4036442253516)).toBeLessThan(1e-15);
    expect(ptukey(101, 1e200, Infinity, { lowerTail: false })).toBe(0);
    expect(ptukey(101, 1e200, Infinity, { logP: true })).toBe(-0);
    expect(rel(ptukey(150, 1e308, Infinity, { lowerTail: false, logP: true }), -4212.1906718218324)).toBeLessThan(1e-15);
    // finite df: the outer integral over the same tail
    const f = ptukey(101, 1e200, 1e6, { lowerTail: false, logP: true });
    expect(f).toBeLessThan(up + 10);
    expect(f).toBeGreaterThan(up);
  });

  it("keeps the other cases as before", () => {
    expect(ptukey(101, 10, Infinity, { lowerTail: false, logP: true })).toBe(-2550.9378717526397);
    expect(ptukey(101, 1e6, Infinity, { lowerTail: false, logP: true })).toBe(-2527.806661307042);
  });
});
