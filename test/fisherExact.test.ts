import { describe, expect, it } from "vitest";
import { fisherTest } from "../src/index.js";
import { OddsRatioDistribution } from "../src/htest/fisherTest.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

type Sub = { expected: HTestCase["expected"]; reason: string } | undefined;

/** The conditional MLE: the odds ratio at which the mean of the (1, 1) cell is the observed count */
function isConditionalMle(x: number[][], psi: number): boolean {
  const [[a, b], [c, d]] = x.map((r) => r.map(Math.round)) as [[number, number], [number, number]];
  const dist = new OddsRatioDistribution(a + c, b + d, a + b);
  return Math.abs(dist.mean(psi) - a) <= 1e-12 * Math.max(1, a);
}

/** A two-sided 95% mid-p limit: one of the mid-p tails is 0.025 there */
function isMidpLimit(x: number[][], psi: number): boolean {
  const [[a, b], [c, d]] = x.map((r) => r.map(Math.round)) as [[number, number], [number, number]];
  const dist = new OddsRatioDistribution(a + c, b + d, a + b);
  return [true, false].some((upper) => Math.abs(dist.midTail(a, psi, upper) - 0.025) <= 1e-14);
}

/** The same arguments with the alternative written out in full (for the case of an abbreviated "g") */
function sameArgs(c: HTestCase, other: HTestCase, alternative: string): boolean {
  const { alternative: _a, ...rest } = c.args;
  const { alternative: alt, ...otherRest } = other.args;
  return alt === alternative && JSON.stringify(rest) === JSON.stringify(otherRest);
}

/**
 * exact2x2's fisher.exact. Only the mid-p version is offered (`midp: true`, choice 2): the cases without mid-p (its
 * minlike test with the matching interval, and the central test) and the two-sided mid-p minlike/blaker errors are not
 * compared, except the one-sided p-values without mid-p, which are fisher.test's.
 */
function substitute(c: HTestCase, cases: HTestCase[]): Sub {
  const midp = arg.bool(c.args.midp) ?? false;
  const level = arg.num(c.args.confLevel);
  const alternative = arg.str(c.args.alternative) ?? "two.sided";
  if (!midp) {
    if (c.expected.error === undefined && alternative !== "two.sided") {
      return { expected: { pValue: c.expected.pValue! }, reason: "without mid-p: only the one-sided p-value (fisher.test's) is compared" };
    }
    return { expected: {}, reason: "without mid-p (exact2x2's minlike and central tests) not offered" };
  }
  if (arg.str(c.args.tsmethod) !== undefined && arg.str(c.args.tsmethod) !== "central") {
    if (c.expected.error !== undefined) return { expected: {}, reason: "tsmethod minlike/blaker (an error with mid-p) not offered" };
    return undefined; // one-sided: tsmethod plays no part
  }
  if (level === 0) return { expected: { error: "level" }, reason: "conf.level 0 is an error (choice 16; exact2x2 gives a point interval)" };
  if (c.reference === undefined && c.expected.confInt !== undefined && alternative === "g") {
    const full = cases.find((o) => sameArgs(c, o, "greater") && o.reference !== undefined);
    if (full !== undefined) {
      return { expected: { ...c.expected, confInt: full.reference!.confInt! }, reason: "alternative 'g': the reference of the same case with 'greater'" };
    }
  }
  return undefined;
}

htestSuite({
  name: "fisherExact",
  call: (a) =>
    fisherTest(
      arg.mat(a.x)!,
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        or: arg.num(a.or),
        confInt: arg.bool(a.confInt),
        confLevel: arg.num(a.confLevel),
        midp: arg.bool(a.midp),
      }),
    ),
  // the p-values are tail sums (a few ulps); the limits are compared with the references, which were solved in double
  // on the log scale (oracle/contingency-behaviour.md, section 7): their tail sums are accurate to a few ulps, which
  // leaves the roots of both within about 1e-13 of each other (as for oddsRatio in test/twoByTwo.test.ts)
  tolerance: 1e-13,
  fieldTolerance: { confInt: 2e-13 },
  substitute,
  knownDifference: (a, field, _e, v) => {
    // the estimate is fisher.test's (uniroot's tolerance on psi or 1/psi: 1e-6 to 1.3% off here); here the root
    if (field === "estimate" && isConditionalMle(arg.mat(a.x)!, v)) {
      return "estimate: the conditional MLE as a root (fisher.test stops at uniroot's tolerance)";
    }
    // the rounded table [[3.5, 1], [1, 3]] has no reference (exact2x2's upper limit is 1.1% off): the limit is checked
    // as a root of its mid-p tail
    if (field === "confInt" && arg.mat(a.x)!.flat().some((x) => !Number.isInteger(x)) && isMidpLimit(arg.mat(a.x)!, v)) {
      return "confInt of a rounded table: a root of the mid-p tail (no reference; exact2x2's uniroot tolerance)";
    }
    return undefined;
  },
});

describe("fisherTest(midp: true)", () => {
  it("has the mid-p tails at the limits and the conventions at the ends of the support", () => {
    const x = [[10, 3], [2, 15]];
    const r = fisherTest(x, { midp: true, confLevel: 0.9 });
    const dist = new OddsRatioDistribution(12, 18, 13);
    expect(dist.midTail(10, r.confInt![0], true)).toBeCloseTo(0.05, 14);
    expect(dist.midTail(10, r.confInt![1], false)).toBeCloseTo(0.05, 14);
    // a = lo: lower limit 0, the estimate 0; the p-value at or = 0 is 1 only at that end
    const z = fisherTest([[0, 5], [3, 4]], { midp: true });
    expect(z.confInt![0]).toBe(0);
    expect(z.estimate).toBe(0);
    expect(fisherTest([[0, 5], [3, 4]], { midp: true, or: 0 }).pValue).toBe(1);
    expect(fisherTest([[1, 5], [3, 4]], { midp: true, or: 0 }).pValue).toBe(0);
    // one-sided at a level of at most 1/2 with x at an end: the other limit is that end too
    expect(fisherTest([[0, 5], [3, 4]], { midp: true, alternative: "less", confLevel: 0.4 }).confInt).toEqual([0, 0]);
  });

  it("rejects an r x c table and a non-logical midp", () => {
    expect(() => fisherTest([[1, 2, 3], [4, 5, 6]], { midp: true })).toThrow(RangeError);
    expect(() => fisherTest([[1, 2], [4, 5]], { midp: 1 as never })).toThrow(TypeError);
    // midp: false leaves r x c tables alone
    expect(fisherTest([[1, 2, 3], [4, 5, 6]], { midp: false }).pValue).toBe(fisherTest([[1, 2, 3], [4, 5, 6]]).pValue);
  });
});
