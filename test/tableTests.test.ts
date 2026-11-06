import { describe, expect, it } from "vitest";
import { chisqTest, goodmanKruskalGamma, gTest, lblTest, mcnemarTest, pchisq, stuartMaxwellTest } from "../src/index.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { num, relativeError } from "./helpers/fixture.js";

/** A matrix argument (array of rows) or a vector */
const counts = (a: HTestArg | undefined): number[] | number[][] =>
  Array.isArray(a) && Array.isArray(a[0]) ? arg.mat(a)! : arg.vec(a)!;

// ---- gTest ----

/**
 * DescTools::GTest. The p-value of a table is DescTools' 1 - pchisq, compared with the `reference` (the upper tail)
 * where they differ (0 for [[500, 300], [300, 500]], true 8.9e-24). G is summed here as a deviance (nonnegative terms)
 * with E in double-double, DescTools as the plain sum of x log(x / E), which loses a few 1e-15 relative to
 * cancellation (1e-14 for the statistic), and 1.1e-12 for c(50, 49), where G = 0.0101 (a known difference, checked
 * against mpmath below). The p-values: 1e-13, as pchisq's upper tail itself is off by up to 1e-14 here (R's and
 * rStats.js's alike: 0.12472809637492194 and 0.1247280963749198 for 2.3569217160548437 with 1 df, mpmath
 * 0.12472809637492107), and the references are the tails at DescTools' G, 4e-16 off for [[500, 300], [300, 500]].
 */
htestSuite({
  name: "gTest",
  call: (a) =>
    gTest(counts(a.x), defined({ correct: arg.str(a.correct), p: arg.vec(a.p), rescaleP: arg.bool(a.rescaleP) })),
  tolerance: 1e-14,
  fieldTolerance: { pValue: 1e-13 },
  knownDifference: (a, field) =>
    JSON.stringify(a.x) === JSON.stringify(["50", "49"]) && (field === "statistic" || field === "pValue")
      ? "c(50, 49): DescTools' plain sum of x log(x / E) cancels (1.1e-12; the deviance against mpmath below)"
      : undefined,
});

describe("gTest", () => {
  it("has the Freeman-Tukey deviates of the counts given (also with Yates' correction)", () => {
    const x = [[12, 5], [7, 9]];
    const ft = chisqTest(x).ftResiduals;
    expect(gTest(x).ftResiduals).toEqual(ft);
    expect(gTest(x, { correct: "yates" }).ftResiduals).toEqual(ft);
    expect(gTest([10, 20, 30]).ftResiduals).toEqual(chisqTest([10, 20, 30]).ftResiduals);
  });

  it("keeps its digits where G is small against the counts (mpmath, 50 digits)", () => {
    const cases: [number[] | number[][], string | undefined, number, number][] = [
      [[[1e6 + 1, 1e6], [1e6, 1e6 + 1]], undefined, 9.9999950000029166648e-7, NaN],
      [[50, 49], undefined, 0.010101181876379410354, 0.91994370240538033313],
      [[50, 49], "williams", 0.01005042216845790578, 0.92014442755099654592],
      [[[500, 300], [300, 500]], undefined, 101.06861568628239861, 8.8851603987378795078e-24],
      [[[500, 300], [300, 500]], "williams", 100.97395260571454122, 9.3201035331936456057e-24],
    ];
    for (const [x, correct, G, p] of cases) {
      const r = gTest(x, defined({ correct }));
      expect(relativeError(r.statistic, G)).toBeLessThan(1e-15);
      // pchisq's own error (1e-14) aside: p has about 50 times the relative error of G here
      if (!Number.isNaN(p)) expect(relativeError(r.pValue, p)).toBeLessThan(2e-14);
    }
  });

  it("gives NaN with R's warning where Yates' correction makes a cell negative", () => {
    const r = gTest([[0, 1], [0, 1]], { correct: "yates" });
    expect(r.observed).toEqual([[0.5, 0.5], [-0.5, 1.5]]);
    expect(r.statistic).toBeNaN();
    expect(r.warnings).toEqual(["NaNs produced"]);
  });

  it("scales counts whose total overflows", () => {
    const r = gTest([[1e308, 5e307], [6e307, 1e308]]);
    const s = gTest([[1e8, 5e7], [6e7, 1e8]]);
    expect(relativeError(r.statistic, s.statistic * 1e300)).toBeLessThan(1e-14);
    expect(r.parameter).toBe(1);
  });

  it("rejects options it does not know, and abbreviations that are ambiguous", () => {
    expect(() => gTest([1, 2], { correction: "yates" } as never)).toThrow(RangeError);
    expect(() => gTest([1, 2], { correct: "" })).toThrow(RangeError);
  });
});

// ---- stuartMaxwellTest ----

/** The categories with counts off the diagonal */
function keptCategories(x: number[][]): number {
  return x.filter((row, i) => row.some((v, j) => j !== i && v > 0) || x.some((r, j) => j !== i && r[i]! > 0)).length;
}

/**
 * DescTools::StuartMaxwellTest. Where categories are removed (no counts off the diagonal), the degrees of freedom are
 * those left less 1 (choice 11; DescTools keeps the original size less 1): parameter and p-value differ there and are
 * checked below. Closed form: 1e-14.
 */
htestSuite({
  name: "stuartMaxwellTest",
  call: (a) => stuartMaxwellTest(arg.mat(a.x)!),
  tolerance: 1e-14,
  knownDifference: (a, field) => {
    const x = arg.mat(a.x)!;
    return (field === "parameter" || field === "pValue") && keptCategories(x) < x.length
      ? "df = categories left - 1 (DescTools: original size - 1)"
      : undefined;
  },
});

describe("stuartMaxwellTest", () => {
  it("has K - 1 degrees of freedom after removing categories", () => {
    const fixture = loadHTestFixture("stuartMaxwellTest");
    let count = 0;
    for (const c of fixture.cases) {
      if (c.expected.error !== undefined) continue;
      const x = arg.mat(c.args.x)!;
      const K = keptCategories(x);
      if (K === x.length) continue;
      const r = stuartMaxwellTest(x);
      expect(relativeError(r.statistic, num(c.expected.statistic as string))).toBeLessThan(1e-14);
      expect(r.parameter).toBe(K - 1);
      expect(r.pValue).toBe(pchisq(r.statistic, K - 1, { lowerTail: false }));
      count++;
    }
    expect(count).toBe(2);
  });

  it("is McNemar's test without correction for 2 x 2", () => {
    const x = [[10, 5], [2, 8]];
    expect(stuartMaxwellTest(x).statistic).toBe(mcnemarTest(x, { correct: false }).statistic);
  });

  it("refuses categories that fall into unconnected groups", () => {
    expect(() => stuartMaxwellTest([[5, 2, 0, 0], [1, 5, 0, 0], [0, 0, 5, 3], [0, 0, 1, 5]])).toThrow(/singular/);
  });
});

// ---- goodmanKruskalGamma ----

/**
 * DescTools::GoodmanKruskalGamma. Levels 0 and 1 are errors (choice 16; DescTools gives the point and [-1, 1]).
 * Closed forms: 1e-14.
 */
htestSuite({
  name: "goodmanKruskalGamma",
  call: (a) => {
    const r = goodmanKruskalGamma(arg.mat(a.x)!, defined({ confLevel: arg.num(a.confLevel) }));
    return { gamma: r.estimate, "lwr.ci": r.confInt[0], "upr.ci": r.confInt[1], warnings: r.warnings };
  },
  tolerance: 1e-14,
  substitute: (c) => {
    const level = arg.num(c.args.confLevel);
    return level === 0 || level === 1
      ? { expected: { error: "level" }, reason: "a level of 0 or 1 is an error (DescTools: the point or [-1, 1])" }
      : undefined;
  },
});

describe("goodmanKruskalGamma", () => {
  it("gives the standard error ASE1 behind the interval", () => {
    const r = goodmanKruskalGamma([[10, 5, 2], [3, 8, 6], [1, 4, 9]]);
    // DescTools' interval 0.67032967032967028 -/+ qnorm(0.975) ase
    expect(relativeError(r.ase, (0.91652460604605612 - 0.42413473461328444) / 2 / 1.959963984540054)).toBeLessThan(1e-14);
    expect(r.confLevel).toBe(0.95);
  });
});

// ---- lblTest ----

/** Whether coin treats one factor as unordered (two levels) and so turns the sign of Z */
const coinFlips = (x: number[][]): boolean => (x.length === 2) !== (x[0]!.length === 2);

/**
 * coin::lbl_test (asymptotic). Where one factor has two levels, coin codes it by an indicator of its first level,
 * which turns the sign of Z (and swaps less and greater); scores 1, 2 are used here (choice 14). The 2 x 2 table,
 * which coin refuses, is computed (checked below against the 'N - 1' statistic). coin's Z is up to 2.3e-14 from the
 * true value ([[0, 0, 0], [1, 2, 3], [4, 5, 6]]) and its p-values about 1e-16 absolute (6e-5 relative at 1.3e-13), so
 * 1e-13 with the p-values measured against max(p, 1e-3); the true values (mpmath) are checked below at 1e-14.
 */
htestSuite({
  name: "lblTest",
  call: (a) => {
    const x = arg.mat(a.x)!;
    const r = lblTest(x);
    return {
      method: r.method,
      statistic: r.statistic,
      pValue: r.pValue,
      pValueLess: lblTest(x, { alternative: "less" }).pValue,
      pValueGreater: lblTest(x, { alternative: "greater" }).pValue,
      warnings: r.warnings,
    };
  },
  tolerance: 1e-13,
  floor: { pValue: 1e-3, pValueLess: 1e-3, pValueGreater: 1e-3 },
  substitute: (c) => {
    const x = arg.mat(c.args.x)!;
    if (c.expected.error !== undefined) {
      const z = Math.sqrt(chisqTest(x, { nMinus1: true }).statistic);
      return { expected: { statistic: String(z) }, reason: "2 x 2 computed (coin: an error); Z = sqrt of the 'N - 1' statistic" };
    }
    if (!coinFlips(x)) return undefined;
    const e = c.expected;
    return {
      expected: { ...e, statistic: String(-num(e.statistic as string)), pValueLess: e.pValueGreater!, pValueGreater: e.pValueLess! },
      reason: "a two-level factor scored 1, 2 (coin: an indicator of the first level, the opposite sign)",
    };
  },
});

describe("lblTest", () => {
  it("matches the true Z and p-values (mpmath, 50 digits)", () => {
    // Z, two-sided, less, greater
    const cases: [number[][], number[]][] = [
      [[[10, 5, 2], [3, 8, 6], [1, 4, 9]], [3.6016522140037939723, 0.00031620119680651722043, 0.99984189940159674139, 0.00015810059840325861022]],
      [[[10, 0, 2], [3, 0, 6], [1, 0, 9]], [3.4224020185694958081, 0.0006207046447800124502, 0.99968964767760999377, 0.0003103523223900062251]],
      [[[0, 0, 0], [1, 2, 3], [4, 5, 6]], [-0.50891335780798255979, 0.61081295650073284457, 0.30540647825036642228, 0.69459352174963357772]],
      [[[10, 0, 0], [0, 10, 0], [0, 0, 10]], [5.3851648071345040313, 7.2378298717400071676e-8, 0.9999999638108506413, 3.6189149358700035838e-8]],
      [
        [[20, 10, 5, 2], [15, 15, 8, 4], [10, 12, 12, 9], [5, 8, 14, 15], [2, 4, 9, 22]],
        [7.3133960825012215287, 2.6047376226822231482e-13, 0.99999999999986976312, 1.3023688113411115741e-13],
      ],
      [[[5, 3, 2, 1], [4, 6, 3, 2], [2, 3, 7, 4], [1, 2, 3, 8]], [3.4581926995685994959, 0.0005438122669321501089, 0.99972809386653392495, 0.00027190613346607505446]],
      [[[10, 5, 2], [3, 8, 6]], [2.4073544790513128744, 0.016068564623226801607, 0.9919657176883865992, 0.0080342823116134008037]],
      [[[10, 5], [2, 3]], [1.0274023338281627417, 0.3042310529998999935, 0.84788447350005000325, 0.15211552649994999675]],
    ];
    for (const [x, [z, p2, pl, pg]] of cases) {
      const r = lblTest(x);
      expect(relativeError(r.statistic, z!)).toBeLessThan(1e-14);
      // the normal tails multiply the error of Z by up to z^2 (53 for the 5 x 4 table)
      const tol = Math.max(1e-14, 2e-15 * z! * z!);
      expect(relativeError(r.pValue, p2!)).toBeLessThan(tol);
      expect(relativeError(lblTest(x, { alternative: "less" }).pValue, pl!)).toBeLessThan(tol);
      expect(relativeError(lblTest(x, { alternative: "greater" }).pValue, pg!)).toBeLessThan(tol);
    }
  });

  it("takes scores, and is invariant to their location and scale", () => {
    const x = [[10, 5, 2], [3, 8, 6], [1, 4, 9]];
    const r = lblTest(x, { rowScores: [0, 2, 4], colScores: [10, 20, 30] });
    expect(relativeError(r.statistic, lblTest(x).statistic)).toBeLessThan(1e-14);
    expect(relativeError(lblTest(x, { rowScores: [3, 2, 1] }).statistic, -lblTest(x).statistic)).toBeLessThan(1e-14);
    expect(() => lblTest(x, { rowScores: [1, 2] })).toThrow(RangeError);
    expect(() => lblTest([[1, 2, 3], [0, 0, 0]])).toThrow(RangeError);
  });
});

// ---- chisqTest(nMinus1) ----

/**
 * The 'N - 1' chi-squared test (Campbell 2007): chisq.test(x, correct = FALSE)$statistic (N - 1) / N, from the fixture
 * (no R package offers it; the fixture's oracle also tried mantelhaen.test on the 2 x 2 tables as a 2 x 2 x 1 array,
 * which R refuses for a single stratum, so it has no mantelhaen values; the 2 x 2 tables are checked against lblTest
 * below). The scaling is that of the fixture: 1e-14; the p-values 1e-13, as R's and rStats.js's pchisq differ by up
 * to 1.7e-14 here (see gTest).
 */
htestSuite({
  name: "chisqTestN1",
  call: (a) => {
    const x = arg.mat(a.x)!;
    const r = chisqTest(x, { nMinus1: true });
    return { ...r, pearson: chisqTest(x, { correct: false }).statistic };
  },
  tolerance: 1e-14,
  fieldTolerance: { pValue: 1e-13 },
});

describe("chisqTest(nMinus1)", () => {
  it("is Z^2 of the linear-by-linear test for 2 x 2 tables", () => {
    for (const x of [[[12, 5], [7, 9]], [[3, 1], [1, 3]], [[500, 300], [300, 500]], [[0, 5], [3, 0]]]) {
      expect(relativeError(chisqTest(x, { nMinus1: true }).statistic, lblTest(x).statistic ** 2)).toBeLessThan(1e-14);
    }
  });

  it("is not offered for goodness of fit, with the continuity correction or with simulation", () => {
    expect(() => chisqTest([10, 20, 30], { nMinus1: true })).toThrow(RangeError);
    expect(() => chisqTest([[10, 20, 30]], { nMinus1: true })).toThrow(RangeError);
    expect(() => chisqTest([[1, 2], [3, 4]], { nMinus1: true, correct: true })).toThrow(RangeError);
    expect(() => chisqTest([[1, 2], [3, 4]], { nMinus1: true, simulatePValue: true })).toThrow(RangeError);
    const r = chisqTest([[12, 5], [7, 9]], { nMinus1: true, correct: false });
    expect(r.method).toBe("Pearson's 'N-1' Chi-squared test");
  });
});

// ---- Freeman-Tukey deviates ----

/**
 * sqrt(O) + sqrt(O + 1) - sqrt(4E + 1) evaluated by R. rStats.js avoids the cancellation of that formula, whose error is
 * a few eps times the terms, so the deviates are compared relative to the terms sqrt(O) + sqrt(O + 1) + sqrt(4E + 1)
 * (1e-14) and the true values of the largest table are checked below. The statistic (their sum of squares, formed
 * here) relative to max(value, 1). The variant 2 (sqrt(O) - sqrt(E)) is not offered (choice 13).
 */
htestSuite({
  name: "freemanTukey",
  call: (a) => {
    const r = chisqTest(arg.mat(a.x)!, { correct: false });
    const ft = r.ftResiduals as number[][];
    return { expected: r.expected, residuals: ft, statistic: ft.flat().reduce((s, v) => s + v * v, 0), warnings: [] };
  },
  tolerance: 1e-14,
  floor: { statistic: 1 },
  scale: {
    residuals: (c) => {
      const O = arg.mat(c.args.x)!.flat();
      const E = (c.expected.expected as string[][]).flat().map((v) => num(v));
      return O.map((o, i) => Math.sqrt(o) + Math.sqrt(o + 1) + Math.sqrt(4 * E[i]! + 1));
    },
  },
  substitute: (c: HTestCase) => {
    const { residualsSimple: _r, statisticSimple: _s, ...expected } = c.expected;
    return { expected: { ...expected, warnings: [] }, reason: "the variant 2 (sqrt(O) - sqrt(E)) is not offered; R's warnings are chisq.test's" };
  },
});

describe("ftResiduals", () => {
  it("keeps the digits that sqrt(O) + sqrt(O + 1) - sqrt(4E + 1) loses (mpmath, 40 digits)", () => {
    const ft = chisqTest([[1e5, 2e5], [3e5, 4e5]]).ftResiduals as number[][];
    const truth = [-60.363931546458402475, 45.89958235320367391, 37.14503099917863874, -31.236670803616877292];
    ft.flat().forEach((v, i) => expect(relativeError(v, truth[i]!)).toBeLessThan(1e-15));
  });

  it("is 0 for an empty cell with E = 0, and 1 - sqrt(4E + 1) for an empty cell", () => {
    expect((chisqTest([[12, 7, 3], [0, 0, 0]]).ftResiduals as number[][])[1]).toEqual([0, 0, 0]);
    const r = chisqTest([[0, 5], [3, 0]], { correct: false });
    const E = (r.expected as number[][])[0]![0]!;
    expect(relativeError((r.ftResiduals as number[][])[0]![0]!, 1 - Math.sqrt(4 * E + 1))).toBeLessThan(1e-15);
  });
});
