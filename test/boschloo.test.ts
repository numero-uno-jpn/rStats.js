import { describe, expect, it } from "vitest";
import { boschlooTest, fisherTest } from "../src/index.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { num, relativeError } from "./helpers/fixture.js";

function call(a: HTestCase["args"]) {
  const x1 = arg.num(a.x1)!;
  const n1 = arg.num(a.n1)!;
  const x2 = arg.num(a.x2)!;
  const n2 = arg.num(a.n2)!;
  return boschlooTest(
    [
      [x1, n1 - x1],
      [x2, n2 - x2],
    ],
    defined({ alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative), tsmethod: arg.str(a.tsmethod) }),
  );
}

/**
 * Exact::exact.test(method = "boschloo"). Exact's p-value maximises over 100 points refined by optimise and rounds to
 * 12 digits (up to 6.3e-9 relative below the supremum here); its two-sided "square" region contains tables that do not
 * belong to it for 20/60 vs 9/25 (1.1e-5 above the supremum): both are compared with the `reference`, the supremum over
 * the full region (999-point grid and Brent's method; oracle/contingency-behaviour.md section 4). Exact's statistic is
 * rounded to 12 significant digits (hence 5e-12).
 */
htestSuite({
  name: "boschloo",
  call,
  tolerance: 1e-8,
  fieldTolerance: { statistic: 5e-12, estimate: 1e-15 },
  substitute: (c) => {
    if (c.expected.error !== undefined) return undefined;
    // exact2x2's 98-point grid maximum is not reproduced (choice 8); Exact's np is where its grid search stopped
    const { np: _np, "exact2x2.pValue": _e, ...expected } = c.expected;
    return { expected, reason: "np (Exact's search) and exact2x2's grid maximum are not compared" };
  },
});

describe("boschlooTest", () => {
  const fixture = loadHTestFixture("boschloo");

  it("gives the supremum of the references to near full precision", () => {
    let worst = 0;
    let count = 0;
    for (const c of fixture.cases) {
      if (c.reference?.pValue === undefined) continue;
      const ref = num(c.reference.pValue as string);
      worst = Math.max(worst, relativeError(call(c.args).pValue, ref));
      count++;
    }
    expect(count).toBe(79);
    // the reference's sums were taken in double too (a few ulps)
    expect(worst).toBeLessThan(5e-15);
  });

  it("has the statistic and the estimate of the observed table", () => {
    const r = boschlooTest([[20, 40], [9, 16]]);
    expect(r.statistic).toBe(fisherTest([[20, 40], [9, 16]]).pValue);
    expect(r.estimate).toBe(20 / 60 - 9 / 25);
    expect(r.method).toBe("Boschloo's Exact Test");
    expect(r.nullValue).toBe(0);
    // central: twice the one-sided p-value in the direction of the data (x1/n1 > x2/n2: greater)
    const central = boschlooTest([[4, 3], [1, 12]], { tsmethod: "c" });
    expect(central.pValue).toBe(2 * boschlooTest([[4, 3], [1, 12]], { alternative: "g" }).pValue);
  });

  it("attains the p-value at the nuisance parameter it reports", () => {
    // 3/10 vs 8/10 (one-sided less): the region's probability is largest at pi = 1/2 (Exact: 0.50000014)
    const r = boschlooTest([[3, 7], [8, 2]], { alternative: "less" });
    expect(r.nuisanceParameter).toBeCloseTo(0.5, 6);
  });

  it("rejects input without a defined result and tables beyond the limits", () => {
    expect(() => boschlooTest([[1, 2, 3], [4, 5, 6]])).toThrow(TypeError);
    expect(() => boschlooTest([[1.5, 2], [4, 5]])).toThrow(RangeError);
    expect(() => boschlooTest([[-1, 2], [4, 5]])).toThrow(RangeError);
    expect(() => boschlooTest([[0, 0], [4, 5]])).toThrow(RangeError);
    expect(() => boschlooTest([[1, 2], [4, 5]], { tsmethod: "minlike" })).toThrow(RangeError);
    expect(() => boschlooTest([[1, 2], [4, 5]], { alternative: "x" as never })).toThrow(RangeError);
    // (n1 + 1)(n2 + 1) above 2^24 tables
    expect(() => boschlooTest([[2000, 2096], [2000, 2096]])).toThrow(/more than 2\^24/);
    // a grid of more than 2^32 steps (about 10 s): a small group against a very large one
    expect(() => boschlooTest([[1, 0], [50000, 150000]])).toThrow(/would take too long/);
  });
});
