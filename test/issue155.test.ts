// Issue #155: pwr2p2nTest formed n1 n2, which overflows for finite sizes above about 1e154 (review_fix_log_issue155.md).
// pwr's pwr.2p2n.test gives power 1 there. Reference: with an effective size n1 n2 / (n1 + n2) = 5e199 and h = 1e-100
// the shift is sqrt(1/2); R: pnorm(qnorm(0.975) - sqrt(0.5), lower = FALSE) + pnorm(-qnorm(0.975) - sqrt(0.5))
// = 0.10895461755061557.
import { describe, expect, it } from "vitest";
import { pwr2p2nTest } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #155", () => {
  it("keeps the effective sample size finite", () => {
    expect(rel(pwr2p2nTest({ h: 1e-100, n1: 1e200, n2: 1e200 }).power, 0.10895461755061557)).toBeLessThan(1e-14);
    expect(rel(pwr2p2nTest({ h: 1e-150, n1: 1e300, n2: 1e300 }).power, 0.10895461755061557)).toBeLessThan(1e-14);
    // solving for the significance level goes through the same function
    expect(pwr2p2nTest({ h: 1e-100, n1: 1e200, n2: 3e200, sigLevel: null, power: 0.2 }).sigLevel).toBeLessThan(0.2);
  });

  it("keeps the other cases as before", () => {
    expect(pwr2p2nTest({ h: 0.3, n1: 80, n2: 120 }).power).toBe(0.5471899635264242);
    // pwr: 0.85083876832705627
    expect(pwr2p2nTest({ h: 0.3, n1: 1e300, n2: 100 }).power).toBe(0.8508387683270562);
    expect(pwr2p2nTest({ h: 0.3, n1: Infinity, n2: 100 }).power).toBeNaN(); // as pwr
  });
});
