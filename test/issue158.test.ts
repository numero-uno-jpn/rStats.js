// Issue #158: the noncentral F's beta coordinate x = m q/(n + m q) took 1 - x = n/(m q) wherever m q >= 1e290, also
// where n is comparable to m q (n/(m q) = 1 gave x = 0 for 1/2). It is now 1 - x = r/(1 + r), r = n/(m q), unless
// r is below the double-double precision (review_fix_log_issue158.md). References: with a small ncp against tails
// of order e^-1e289, the log tails and log density are those of the central F to far below double precision.
import { describe, expect, it } from "vitest";
import { df, pf } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #158", () => {
  it("takes x from n/(m q) where n is comparable to m q", () => {
    // x = 1/2, 2/3, 1/2, 1/4
    const cases: [number, number, number, number][] = [
      [1e290, 1, 1e290, 1],
      [2e290, 1, 1e290, 5],
      [1e289, 10, 1e290, 3],
      [1e295, 1, 3e295, 2],
    ];
    for (const [q, m, n, ncp] of cases) {
      const label = `${q}, ${m}, ${n}, ${ncp}`;
      const upper = pf(q, m, n, { ncp, lowerTail: false, logP: true });
      expect(rel(upper, pf(q, m, n, { lowerTail: false, logP: true })), label).toBeLessThan(1e-14);
      expect(rel(df(q, m, n, { ncp, log: true }), df(q, m, n, { log: true })), label).toBeLessThan(1e-14);
      expect(pf(q, m, n, { ncp }), label).toBe(1);
    }
    // x = 1/2: the upper tail is e^(-n log(2)/2) to leading order
    expect(rel(pf(1e290, 1, 1e290, { ncp: 1, lowerTail: false, logP: true }), -0.5e290 * Math.LN2)).toBeLessThan(1e-14);
  });
});
