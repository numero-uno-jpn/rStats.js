// Revision of reviews 47 and 52: bounds on the time of the Bessel functions at large orders and arguments
// (review_fix_log_20261031_47_rev.md). Only the rejections are run beyond the bounds (they come before the continued
// fraction or the recurrence); inside them the values are unchanged.
import { describe, expect, it } from "vitest";
import { besselI, besselJ, besselK, besselY } from "../src/index.js";

const scaled = { exponScaled: true };

const quick = (f: () => unknown, message: string) => {
  const t = performance.now();
  expect(f).toThrow(message);
  expect(performance.now() - t).toBeLessThan(100);
};

describe("review 47 (revision)", () => {
  it("rejects a continued fraction of more than 2^25 terms at once", () => {
    // about x - nu = 9.8e7 terms (the loop's limit of 1e8 terms, 20 to 40 s, before)
    quick(() => besselJ(1e8, 2e6), "besselJ: x = 100000000, nu = 2000000 needs a continued fraction of about 98000000 terms (at most 2^25)");
    quick(() => besselY(1e8, 2e6), "besselY: x = 100000000, nu = 2000000 needs a continued fraction of about");
    quick(() => besselJ(1e8, -2e6 - 0.5), "(at most 2^25)");
  });

  it("rejects recurrences beyond 2^31 steps (J) and 2^28 steps (Y) at once", () => {
    // near the turning point, where the bounds on the log do not decide
    quick(() => besselJ(3e9 - 10, 3e9), "besselJ: x = 2999999990, nu = 3000000000 needs a recurrence of about 3000000000 steps (at most 2^31)");
    quick(() => besselY(3e8 - 1, 3e8), "besselY: x = 299999999, nu = 300000000 needs a recurrence of about 300000000 steps (at most 2^28)");
    // a negative non-integer order of J needs Y
    quick(() => besselJ(3e8 - 1, -3e8 - 0.25), "besselJ: x = 299999999, nu = -300000000.25 needs a recurrence of about 300000000 steps (at most 2^28)");
  });

  it("I and K beyond 2^28 steps take Debye's expansion at once (issue 492)", () => {
    const t = performance.now();
    expect(besselI(3e9, 3e8, scaled)).toBe(0);
    expect(besselI(3e9, -3e8 - 0.25, scaled)).toBe(0);
    expect(besselK(3e9, 3e8, scaled)).toBe(Infinity);
    expect(performance.now() - t).toBeLessThan(100);
  });

  it("keeps the results decided by the bounds on the log", () => {
    expect(besselJ(1e7, 1e12)).toBe(0);
    expect(besselY(10, 1e12)).toBe(-Infinity);
    expect(besselK(1, 3e9)).toBe(Infinity);
    expect(besselI(1e9, 3e9)).toBe(0);
  });

  // the values before the revision
  it("keeps the values inside the bounds: J near the turning point", () => {
    expect(besselJ(1e8 - 1, 1e8)).toBe(0.0009617874113150171);
  });
  it("keeps the values inside the bounds: Y near the turning point", () => {
    expect(besselY(3e7 - 1, 3e7)).toBe(-0.0025007758459470357);
  });
  it("keeps the values inside the bounds: x above 2^25 with x - nu below it", () => {
    expect(besselJ(5e7, 4e7)).toBe(0.00010221005067009132);
  });
});
