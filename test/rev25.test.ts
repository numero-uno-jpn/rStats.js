// Revision of review 25: bounds on the time of phyper and qhyper (review_fix_log_20261031_25_rev.md).
// Only the rejections are run beyond the bounds (they come before any sum); inside them the values are unchanged.
import { describe, expect, it } from "vitest";
import { phyper, qhyper } from "../src/index.js";

const quick = (f: () => unknown, message: string) => {
  const t = performance.now();
  expect(f).toThrow(message);
  expect(performance.now() - t).toBeLessThan(100);
};

describe("review 25 (revision)", () => {
  it("rejects phyper beyond about 2^26 terms at once", () => {
    // sigma 1.1e7: about 1.0e8 terms at the center (both tails), 6.7e7 at z = -2.8 (about 40 s before)
    const M = 1e15;
    quick(() => phyper(5e14, M, M, M), "phyper: m = 1000000000000000, n = 1000000000000000, k = 1000000000000000 needs about");
    quick(() => phyper(5e14, M, M, M, { lowerTail: false, logP: true }), "(at most 2^26)");
    quick(() => phyper(5e14 - 3e7, M, M, M), "(at most 2^26)");
    quick(() => phyper(5e14 + 3e7, M, M, M), "(at most 2^26)");
    // the other values of a vector are not returned either
    quick(() => phyper([0, 5e14, M], M, M, M), "(at most 2^26)");
  });

  it("rejects qhyper with a standard deviation beyond 2^21 at once", () => {
    // m = n = k = M: sigma^2 = M / 8; 2^21 at M = 2^45 = 3.5e13
    quick(() => qhyper(0.5, 1e15, 1e15, 1e15), "qhyper: m = 1000000000000000, n = 1000000000000000, k = 1000000000000000 has a standard deviation of about 1.12e+7 (at most 2^21)");
    quick(() => qhyper(-1e-3, 4e13, 4e13, 4e13, { logP: true, lowerTail: false }), "(at most 2^21)");
  });

  // (the one case run with src stashed: about 5 s there, the others longer)
  it("rejects qhyper just beyond 2^21 at once", () => {
    quick(() => qhyper(0.3, 4e13, 4e13, 4e13), "has a standard deviation of about 2.24e+6 (at most 2^21)");
  });

  it("keeps the answers that need no sum, and the values inside the bounds", () => {
    const M = 1e15;
    // the ends of the support, the binomial limit, p = 0 and 1 answer before the bounds
    expect(phyper(-1, M, M, M)).toBe(0);
    expect(phyper(M, M, M, M)).toBe(1);
    expect(qhyper(0, M, M, M)).toBe(0);
    expect(qhyper(1, M, M, M)).toBe(M);
    expect(phyper(50, M, M, 100)).toBe(0.5397946186935914);
    // a far tail of the same distribution sums few terms (z = -1000: about 5e5 terms, 0.1 s)
    expect(phyper(5e14 - 1000 * Math.sqrt(M / 8), M, M, M)).toBe(0);
    // the values before the revision (sigma 3.5e4)
    const N = 1e10;
    expect(phyper(N / 2 - Math.sqrt(N), N, N, N)).toBe(0.0023389708269143236);
    expect(phyper(N / 2, N, N, N)).toBe(0.5000056418958319);
    expect(qhyper(0.3, N, N, N)).toBe(4999981460);
  });
});
