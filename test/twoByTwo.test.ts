import { describe, expect, it } from "vitest";
import { binomDiffCI, binomRatioCI, fisherTest, oddsRatio } from "../src/index.js";
import { diffStatistic, oddsRatioStatistic, ratioStatistic } from "../src/htest/core/twoProportions.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestCase } from "./helpers/htest.js";
import { num, relativeError } from "./helpers/fixture.js";

type Sub = { expected: HTestCase["expected"]; reason: string } | undefined;

/** Successes and trials of both groups, when they are integers with 0 <= x <= n, n > 0 */
function validCounts(a: HTestCase["args"]): boolean {
  const v = [a.x1, a.n1, a.x2, a.n2].map((s) => arg.num(s)!);
  return v.every((x) => Number.isInteger(x)) && v[0]! <= v[1]! && v[2]! <= v[3]! && v[1]! > 0 && v[3]! > 0 && v[0]! >= 0 && v[2]! >= 0;
}

/** Input that is an error under design rule 1 (choice 16) where the packages give NaN or a number */
function invalidInput(c: HTestCase): Sub {
  if (!validCounts(c.args)) {
    return { expected: { error: "counts" }, reason: "x > n, a non-integer count or n = 0 is an error (DescTools: NaN, a number or an error)" };
  }
  const level = arg.num(c.args.confLevel);
  if (level !== undefined && !(level > 0 && level < 1)) {
    return { expected: { error: "level" }, reason: "a level outside (0, 1) is an error (DescTools: NaN)" };
  }
  return undefined;
}

function proportionCall(f: typeof binomDiffCI | typeof binomRatioCI) {
  return (a: HTestCase["args"]): object => {
    const r = f(
      arg.num(a.x1)!,
      arg.num(a.n1)!,
      arg.num(a.x2)!,
      arg.num(a.n2)!,
      defined({ method: arg.str(a.method), confLevel: arg.num(a.confLevel), sides: arg.str(a.sides) }) as never,
    );
    return { est: r.estimate, "lwr.ci": r.confInt[0], "upr.ci": r.confInt[1], warnings: r.warnings };
  };
}

htestSuite({
  name: "binomDiffCI",
  call: proportionCall(binomDiffCI),
  // closed forms; the mn and mee limits against the roots (`reference`): their cancellation est - delta against the
  // standard error leaves about 1e-15 absolute (hence the floor for limits near 0)
  tolerance: 1e-13,
  floor: { "lwr.ci": 1e-2, "upr.ci": 1e-2 },
  substitute: invalidInput,
  // Newcombe's limit est - kappa sqrt(l1(1 - l1)/n1 + u2(1 - u2)/n2) is exactly -1 where l1 = 0 and u2 = 1; DescTools'
  // Wilson limits are rounded there (an upper limit of 1 - 1e-16 for 10/10), which puts its lower limit below -1
  knownDifference: (a, field, e, v) =>
    arg.str(a.method) === "score" && field === "lwr.ci" && v === -1 && e < -1 && e > -1 - 1e-8
      ? "score: -1 where DescTools' rounded Wilson limits give a limit below -1"
      : undefined,
});

htestSuite({
  name: "binomRatioCI",
  call: proportionCall(binomRatioCI),
  tolerance: 1e-13,
  substitute: invalidInput,
  knownDifference: (a, field, e, v) => {
    const sides = arg.str(a.sides);
    // choice 6: the one-sided limit is applied (DescTools keeps both limits of the two-sided interval at 2c - 1)
    if (sides === "left" && field === "upr.ci" && v === Infinity) return "sides 'left': upper limit Inf (DescTools keeps the two-sided upper limit)";
    if (sides === "right" && field === "lwr.ci" && v === 0) return "sides 'right': lower limit 0 (DescTools keeps the two-sided lower limit)";
    // the case "koop" (an abbreviation) has no reference; the same case with "koopman" has it and passes
    if (arg.str(a.method) === "koop" && Math.abs(v - e) <= 1e-4 * e) return "koopman: DescTools' uniroot tolerance 1.22e-4 (no reference for the abbreviated method)";
    return undefined;
  },
});

/** The fisher method's estimate and limits are those of fisherTest (the roots); R's fisher.test stops at uniroot's tolerance */
htestSuite({
  name: "oddsRatio",
  call: (a) => {
    const r = oddsRatio(arg.mat(a.x)!, defined({ method: arg.str(a.method), confLevel: arg.num(a.confLevel) }));
    return {
      estimate: r.estimate,
      lower: r.confInt[0],
      upper: r.confInt[1],
      "midp.exact": r.pValue.midp,
      "fisher.exact": r.pValue.fisher,
      "chi.square": r.pValue.chiSquare,
      method: r.method,
      warnings: r.warnings,
    };
  },
  tolerance: 1e-13,
  // the mid-p references were solved in double on the log scale (oracle/contingency-behaviour.md, section 7): their
  // tail sums are accurate to a few ulps, which leaves the roots within a few 1e-13 of each other
  fieldTolerance: { estimate: 5e-13, lower: 5e-13, upper: 5e-13 },
  substitute: (c) => {
    const x = arg.mat(c.args.x)!;
    if (x.flat().some((v) => !(Number.isInteger(v) && v >= 0))) {
      return { expected: { error: "counts" }, reason: "negative or non-integer counts are errors (epitools rounds them for fisher.test)" };
    }
    if (c.expected.error === "f() values at end points not of opposite sign") {
      const r = fisherTest(x);
      // choice 7: exact2x2's conventions at the ends of the support; no reference was written for epitools' errors
      return { expected: {}, reason: `midp: epitools fails for a zero cell or an odds ratio beyond 1000 (here ${r.estimate}); checked below` };
    }
    return undefined;
  },
  knownDifference: (a, field, e, v) => {
    if (arg.str(a.method) === "fisher" && ["estimate", "lower", "upper"].includes(field)) {
      const r = fisherTest(arg.mat(a.x)!, defined({ confLevel: arg.num(a.confLevel) }));
      const mine = field === "estimate" ? r.estimate : r.confInt![field === "lower" ? 0 : 1];
      if (mine === v) return "fisher: fisherTest's roots (R's fisher.test stops at uniroot's tolerance; test/fisher.test.ts)";
    }
    // 2 min(m, 1 - m) with 1 - m formed from m underflows to 0; the upper tail here is summed directly
    if (field === "midp.exact" && e === 0 && v > 0 && v < 1e-15) return "midp.exact: epitools' 1 - m underflows to 0 (the tail is summed directly here)";
    return undefined;
  },
});

/** The numbers of epiR's epi.2by2 (one stratum, cohort.count) reached through the functions above (choices 1 and 3) */
describe("epi2by2 through binomRatioCI, oddsRatio and binomDiffCI", () => {
  const fixture = loadHTestFixture("epi2by2");
  it("matches epiR where the methods coincide", () => {
    const failures: string[] = [];
    let compared = 0;
    for (const c of fixture.cases) {
      const x = arg.mat(c.args.x)!;
      const confLevel = arg.num(c.args.confLevel);
      if (c.expected.error !== undefined) continue;
      if (x.flat().some((v) => !Number.isInteger(v))) continue; // non-integer counts are errors here
      const [[a, b], [cc, d]] = x as [[number, number], [number, number]];
      const opts = defined({ confLevel });
      const rr = (method: "katz.log" | "koopman") => binomRatioCI(a, a + b, cc, cc + d, { ...opts, method });
      const or = (method: "wald" | "score" | "fisher") => oddsRatio(x, { ...opts, method });
      const ar = (method: "wald" | "mee") => binomDiffCI(a, a + b, cc, cc + d, { ...opts, method });
      const triple = (r: { estimate: number; confInt: [number, number] }, scale = 1): number[] => [
        r.estimate * scale,
        r.confInt[0] * scale,
        r.confInt[1] * scale,
      ];
      const fields: Record<string, () => number[] | undefined> = {
        // Katz's log interval without a zero correction: the same where a, c > 0 and not both groups full
        "RR.strata.wald": () => (a > 0 && cc > 0 && !(b === 0 && d === 0) ? triple(rr("katz.log")) : undefined),
        "RR.strata.score": () => triple(rr("koopman")),
        "OR.strata.wald": () => triple(or("wald")),
        "OR.strata.score": () => triple(or("score")),
        "OR.strata.mle": () => triple(or("fisher")),
        // epiR does not clip the Wald interval of the attributable risk to [-1, 1] (x 100)
        "ARisk.strata.wald": () => {
          const r = ar("wald");
          return r.confInt[0] > -1 && r.confInt[1] < 1 ? triple(r, 100) : undefined;
        },
        "ARisk.strata.score": () => triple(ar("mee"), 100),
      };
      for (const [field, f] of Object.entries(fields)) {
        const mine = f();
        if (mine === undefined) continue;
        const expected = (c.expected[field] as string[]).map((s) => num(s));
        const ref = c.reference?.[field] as string[] | undefined;
        // the reference has the limits only (the roots); the estimate is compared with epiR
        const truth = ref === undefined ? expected : [expected[0]!, ...ref.map((s) => num(s))];
        // fisher.test (OR.strata.mle) stops at uniroot's tolerance, up to 0.7% off for [[3, 1], [1, 3]]: there the
        // conditional MLE and limits are fisherTest's roots (docs/differences-from-r.md), compared with R to 1e-2 (and
        // exactly with fisherTest in the oddsRatio suite)
        const tol = field === "OR.strata.mle" ? 1e-2 : 1e-13;
        mine.forEach((v, k) => {
          compared++;
          const t = truth[k]!;
          const err = Number.isFinite(t) && t !== 0 ? Math.abs(v - t) / Math.max(Math.abs(t), field.startsWith("ARisk") ? 1 : 0) : v === t || (Number.isNaN(v) && Number.isNaN(t)) ? 0 : Infinity;
          if (!(err <= tol)) failures.push(`${JSON.stringify(c.args)} ${field}[${k}]: epiR ${t} / TS ${v} (${err.toExponential(2)})`);
        });
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
    expect(compared).toBeGreaterThan(400);
  });
});

describe("binomDiffCI, binomRatioCI and oddsRatio: roots and boundaries", () => {
  it("returns limits where the score statistics equal the bound", () => {
    const z2 = 1.959963984540054 ** 2;
    const d = binomDiffCI(56, 70, 48, 80, { method: "mn" }).confInt;
    for (const v of d) expect(diffStatistic(56, 70, 48, 80, v, "mn") / z2).toBeCloseTo(1, 12);
    const m = binomDiffCI(1, 100, 3, 50, { method: "mee" }).confInt;
    for (const v of m) expect(diffStatistic(1, 100, 3, 50, v, "mee") / z2).toBeCloseTo(1, 12);
    const r = binomRatioCI(9, 10, 1, 10, { method: "koopman" }).confInt;
    for (const v of r) expect(ratioStatistic(9, 10, 1, 10, v) / z2).toBeCloseTo(1, 12);
    const o = oddsRatio([[7, 3], [2, 9]], { method: "score" }).confInt;
    for (const v of o) expect(oddsRatioStatistic(7, 10, 2, 11, v) / z2).toBeCloseTo(1, 12);
  });

  it("gives the mid-p odds ratio exact2x2's conventions at the ends of the support (choice 7)", () => {
    const zero = oddsRatio([[0, 10], [5, 5]]);
    expect(zero.estimate).toBe(0);
    expect(zero.confInt[0]).toBe(0);
    expect(zero.confInt[1]).toBeGreaterThan(0);
    expect(zero.confInt[1]).toBeLessThan(fisherTest([[0, 10], [5, 5]]).confInt![1]);
    const inf = oddsRatio([[10, 0], [5, 5]]);
    expect(inf.estimate).toBe(Infinity);
    expect(inf.confInt[1]).toBe(Infinity);
    // the mid-p limit of [[10, 0], [5, 5]] is the reciprocal of the upper limit of [[0, 10], [5, 5]] (symmetry)
    expect(inf.confInt[0] * zero.confInt[1]).toBeCloseTo(1, 13);
    // an odds ratio beyond epitools' bracket [0, 1000]: the median-unbiased estimate between the limits
    const big = oddsRatio([[100, 1], [1, 100]]);
    expect(big.estimate).toBeGreaterThan(big.confInt[0]);
    expect(big.estimate).toBeLessThan(big.confInt[1]);
    expect(Number.isFinite(big.confInt[1])).toBe(true);
    const none = oddsRatio([[0, 10], [0, 10]]);
    expect(none.confInt).toEqual([0, Infinity]);
  });

  it("applies the sides of binomRatioCI (choice 6)", () => {
    const two = binomRatioCI(56, 70, 48, 80, { confLevel: 0.9 }).confInt;
    expect(binomRatioCI(56, 70, 48, 80, { sides: "left" }).confInt).toEqual([two[0], Infinity]);
    expect(binomRatioCI(56, 70, 48, 80, { sides: "right" }).confInt).toEqual([0, two[1]]);
  });

  it("rejects input without a defined result", () => {
    expect(() => binomDiffCI(11, 10, 3, 10)).toThrow(RangeError);
    expect(() => binomDiffCI(1, 0, 3, 10)).toThrow(RangeError);
    expect(() => binomDiffCI(1, 10, 3, 10, { confLevel: 1 })).toThrow(RangeError);
    expect(() => binomDiffCI(1, 10, 3, 10, { method: "m" })).toThrow(RangeError);
    expect(() => binomRatioCI(2.5, 10, 3, 10)).toThrow(RangeError);
    expect(() => oddsRatio([[1, 2], [3, -1]])).toThrow(RangeError);
    expect(() => oddsRatio([[1, 2, 3], [3, 1, 2]])).toThrow(TypeError);
    expect(() => oddsRatio([[1, 2], [3, 4]], { method: "small" })).toThrow(RangeError);
  });

  it("keeps the limits exact where the statistic is symmetric", () => {
    const r = binomDiffCI(0, 10, 0, 10, { method: "mn" }).confInt;
    expect(r[0]).toBe(-r[1]);
    expect(relativeError(r[1], 0.28793394128201222)).toBeLessThan(1e-13);
  });

  it("keeps the digits of the mn and mee limits for small proportions and proportions near 1 (audit 1)", () => {
    // mpmath (250 digits): the restricted MLE by bisection of the score equation, the limits by bisection of the
    // statistic. Before, the closed form of the MLE gave [-2.6407478e-9, 1.0024815e-8] for the first, [-5.536e-12,
    // 6.976e-13] for the third and 4e-3 relative for the upper limit of 1/1e8 against 0/1e8. 1e-14: the terms of the
    // score equation and of the deviation p1 - p2 - delta cancel (within 10 ulps here)
    const cases: [number, number, number, number, "mn" | "mee", number, number][] = [
      [5, 1e9, 2, 1e9, "mn", -2.8362289455290099255e-9, 9.9306997866390918815e-9],
      [5, 1e9, 2, 1e9, "mee", -2.8362289435414481343e-9, 9.9306997842992819391e-9],
      [3, 1e15, 1, 1e15, "mn", -2.9104213746166196848e-15, 7.9248594586749542929e-15],
      [1e15, 1e15, 1e15 - 1, 1e15, "mn", -2.8414588206941135538e-15, 5.6649342657589510235e-15],
      [1, 1e4, 0, 1e4, "mn", -2.8403676778730927532e-4, 5.6628870485591529781e-4],
      [1, 1e8, 0, 1e8, "mn", -2.8414587115406578854e-8, 5.6649340609687023253e-8],
      [1, 1e8, 0, 1e8, "mee", -2.8414586923333650655e-8, 5.6649340411436428666e-8],
      [56, 70, 48, 80, "mn", 0.052829713245844630778, 0.33817294001586832613],
    ];
    for (const [x1, n1, x2, n2, method, lower, upper] of cases) {
      const r = binomDiffCI(x1, n1, x2, n2, { method }).confInt;
      expect(relativeError(r[0], lower)).toBeLessThan(1e-14);
      expect(relativeError(r[1], upper)).toBeLessThan(1e-14);
    }
  });

  it("returns +0, not -0, for counts of -0 (audit 16)", () => {
    expect(Object.is(oddsRatio([[-0, 5], [3, 4]], { method: "wald" }).estimate, 0)).toBe(true);
    expect(Object.is(binomDiffCI(-0, 5, 0, 5, { method: "wald" }).confInt[0], 0)).toBe(true);
    expect(Object.is(binomDiffCI(-0, 5, 0, 5).estimate, 0)).toBe(true);
  });
});
