// binomTest, poissonTest, varTest, bartlettTest and mcnemarTest against SciPy references
// (scripts/mpmath/htest_scipy.py writes test/fixtures/htest_<name>.scipy.json), and against R once the R fixtures
// (oracle/<name>.R) exist.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bartlettTest } from "../src/htest/varTest.js";
import { binomTest } from "../src/htest/binomTest.js";
import { mcnemarTest } from "../src/htest/mcnemarTest.js";
import { poissonTest } from "../src/htest/poissonTest.js";
import { varTest } from "../src/htest/varTest.js";
import { onewayTest, shapiroTest } from "../src/htest/onewayTest.js";
import { propTest } from "../src/htest/propTest.js";
import { mantelhaenTest } from "../src/htest/mantelhaenTest.js";
import { ansariTest } from "../src/htest/ansariTest.js";
import { brunnerMunzelTest } from "../src/htest/brunnerMunzelTest.js";
import { ksTest } from "../src/htest/ksTest.js";
import { pairwisePropTest, pairwiseTTest, pairwiseWilcoxTest } from "../src/htest/pairwise.js";
import { pexp, pf, pnorm, punif } from "../src/index.js";
import { mean, variance } from "../src/internal/summary.js";
import { flignerTest, friedmanTest, kruskalTest, moodTest, quadeTest } from "../src/htest/rankTests.js";
import type { Alternative } from "../src/htest/types.js";
import { hasFixture, num, relativeError } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

type Args = Record<string, unknown>;
interface RefCase {
  args: Args;
  expected: Record<string, string | string[]>;
}

const nums = (v: unknown): number[] => (v as (string | number)[]).map((e) => (typeof e === "number" ? e : num(e)));
const opt = (a: Args) => ({ alternative: a.alternative as Alternative, confLevel: num(a.confLevel as string) });

const calls: Record<string, [number, (a: Args) => Record<string, unknown>]> = {
  binomTest: [1e-12, (a) => ({ ...binomTest(a.x as number, a.n as number, { p: num(a.p as string), ...opt(a) }) })],
  poissonTest: [
    1e-12,
    (a) => ({ ...poissonTest(a.x as number[], { T: nums(a.T), r: num(a.r as string), ...opt(a) }) }),
  ],
  varTest: [1e-12, (a) => ({ ...varTest(nums(a.x), nums(a.y), { ratio: num(a.ratio as string), ...opt(a) }) })],
  bartlettTest: [1e-12, (a) => ({ ...bartlettTest((a.groups as string[][]).map(nums)) })],
  mcnemarTest: [1e-13, (a) => ({ ...mcnemarTest((a.x as string[][]).map(nums), { correct: a.correct as boolean }) })],
  kruskalTest: [1e-12, (a) => ({ ...kruskalTest((a.groups as string[][]).map(nums)) })],
  friedmanTest: [1e-12, (a) => ({ ...friedmanTest((a.y as string[][]).map(nums)) })],
  quadeTest: [1e-12, (a) => ({ ...quadeTest((a.y as string[][]).map(nums)) })],
  flignerTest: [1e-12, (a) => ({ ...flignerTest((a.groups as string[][]).map(nums)) })],
  moodTest: [1e-12, (a) => ({ ...moodTest(nums(a.x), nums(a.y), { alternative: a.alternative as Alternative }) })],
  onewayTest: [1e-12, (a) => ({ ...onewayTest((a.groups as string[][]).map(nums), { varEqual: a.varEqual as boolean }) })],
  propTest: [
    1e-12,
    (a) => ({
      ...propTest(nums(a.x), nums(a.n), {
        ...(a.p === undefined ? {} : { p: nums(a.p) }),
        correct: a.correct as boolean,
        ...opt(a),
      }),
    }),
  ],
  mantelhaenTest: [
    1e-12,
    (a) => ({
      ...mantelhaenTest((a.x as string[][][]).map((t) => t.map(nums)), {
        ...(a.alternative === undefined ? {} : opt(a)),
        ...(a.exact === undefined ? {} : { exact: a.exact as boolean }),
        ...(a.correct === undefined ? {} : { correct: a.correct as boolean }),
      }),
    }),
  ],
  ansariTest: [
    1e-12,
    (a) => ({
      ...ansariTest(nums(a.x), nums(a.y), { alternative: a.alternative as Alternative, exact: a.exact as boolean }),
    }),
  ],
  ksTest: [
    1e-12,
    (a) => ({
      ...ksTest(
        nums(a.x),
        a.y !== undefined ? nums(a.y) : a.cdf === "norm" ? (q: number) => pnorm(q) : (q: number) => pexp(q),
        { alternative: a.alternative as Alternative },
      ),
    }),
  ],
  pairwise: [
    1e-12,
    (a) => {
      const method = a.pAdjustMethod as string;
      const r =
        a.kind === "prop"
          ? pairwisePropTest(nums(a.x), nums(a.n), { pAdjustMethod: method })
          : pairwiseTTest(nums(a.x), a.g as string[], {
              pAdjustMethod: method,
              alternative: a.alternative as Alternative,
              paired: a.kind === "paired",
              poolSd: a.kind === "pooled",
            });
      return { pValue: r.pValue.flat() };
    },
  ],
  // SciPy evaluates the Shapiro-Wilk p-value less precisely (agreement about 1e-11), hence the wider tolerance
  shapiroTest: [1e-9, (a) => ({ ...shapiroTest(nums(a.x)) })],
};

// Absolute floors per field: the error is measured relative to max(|expected|, floor)
const floors: Record<string, Record<string, number>> = {
  // the exact two-sided one-sample p-value is 1 - P(D < d), as in R, so it has absolute accuracy only (SciPy's kstwo
  // computes the upper tail directly); its sensitivity to the last bit of D also reaches 1e-14 absolute at n near 100
  ksTest: { pValue: 1e-2 },
};

for (const [name, [tolerance, call]] of Object.entries(calls)) {
  const path = fileURLToPath(new URL(`./fixtures/htest_${name}.scipy.json`, import.meta.url));
  const fixture = JSON.parse(readFileSync(path, "utf8")) as { generator: string; cases: RefCase[] };
  describe(name, () => {
    it(`matches the SciPy references (${fixture.generator})`, () => {
      const bad: string[] = [];
      let worst = 0;
      for (const c of fixture.cases) {
        const actual = call(c.args);
        for (const [field, exp] of Object.entries(c.expected)) {
          const e = Array.isArray(exp) ? exp.map(num) : [num(exp)];
          const v = actual[field];
          const av = Array.isArray(v) ? (v as number[]) : [v as number];
          e.forEach((ev, i) => {
            // probabilities near the underflow threshold are compared absolutely
            const fl = floors[name]?.[field] ?? 0;
            const err =
              Math.abs(ev) < 1e-300
                ? Math.abs(av[i]! - ev) / 1e-300
                : fl > 0
                  ? Math.abs(av[i]! - ev) / Math.max(Math.abs(ev), fl)
                  : relativeError(av[i]!, ev);
            if (Number.isFinite(err)) worst = Math.max(worst, err);
            if (!(err <= tolerance)) bad.push(`${JSON.stringify(c.args)} ${field}[${i}]: expected ${ev} actual ${av[i]}`);
          });
        }
      }
      console.log(`${name}: ${fixture.cases.length} cases, max relative error ${worst.toExponential(2)}`);
      expect(bad.slice(0, 10), bad.join("\n")).toHaveLength(0);
    });
  });
}

describe("input handling", () => {
  it("binomTest takes [successes, failures]", () => {
    expect(binomTest([7, 3])).toEqual(binomTest(7, 10));
    expect(binomTest([7, 3], { p: 0.3 }).pValue).toBe(binomTest(7, 10, { p: 0.3 }).pValue);
  });
  it("binomTest rejects invalid counts", () => {
    expect(() => binomTest(11, 10)).toThrow();
    expect(() => binomTest(2.5, 10)).toThrow();
    expect(() => binomTest(3, 10, { p: 1.5 })).toThrow();
  });
  it("mcnemarTest cross-tabulates paired codes", () => {
    const x = ["a", "a", "b", "b", "a", "b", "a", "b", "b"];
    const y = ["a", "b", "b", "a", "b", "b", "b", "a", "b"];
    expect(mcnemarTest(x, y)).toEqual(mcnemarTest([[1, 3], [2, 3]]));
  });
  it("tests without an alternative report none", () => {
    expect("alternative" in mcnemarTest([[3, 5], [2, 4]])).toBe(false);
    expect("alternative" in bartlettTest([[1, 2, 4], [2, 5, 9]])).toBe(false);
  });
});

// R fixtures (generated on the R side from oracle/<name>.R)
const vecOrNum = (a: HTestArg | undefined): number | number[] | undefined => {
  const v = arg.vec(a);
  return v === undefined ? undefined : v.length === 1 ? v[0] : v;
};
const rAlt = (a: Record<string, HTestArg>) =>
  defined({ alternative: arg.str<Alternative>(a.alternative), confLevel: arg.num(a.confLevel) });

if (hasFixture("binomTest"))
  htestSuite({
    name: "binomTest",
    call: (a) => {
      const x = vecOrNum(a.x)!;
      const o = defined({ p: arg.num(a.p), ...rAlt(a) });
      return typeof x === "number" ? binomTest(x, arg.num(a.n)!, o) : binomTest(x as [number, number], o);
    },
    tolerance: 1e-12,
  });
if (hasFixture("poissonTest"))
  htestSuite({
    name: "poissonTest",
    call: (a) => poissonTest(arg.vec(a.x)!, defined({ T: arg.vec(a.T), r: arg.num(a.r), ...rAlt(a) })),
    tolerance: 1e-12,
  });
if (hasFixture("varTest"))
  htestSuite({
    name: "varTest",
    call: (a) => varTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ ratio: arg.num(a.ratio), ...rAlt(a) })),
    tolerance: 1e-12,
    knownDifference: (a, field, expected, actual) => {
      // data with a large mean and a small spread (1e8 + 1e-3 noise): R's var is off by about 1e-11 there, where
      // the variances here agree with 50-digit values
      const x = arg.vec(a.x)!.filter(Number.isFinite);
      const cv = Math.sqrt(variance(x)) / Math.abs(mean(x));
      if (cv < 1e-6 && Math.abs(actual - expected) <= 1e-9 * Math.abs(expected))
        return "R's variance of data with a large mean and a small spread is off by about 1e-11";
      if (field !== "pValue") return undefined;
      // R forms the upper tail as 1 - pf(F): reproduce that and accept R's value when it is what R computed
      const r = varTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ ratio: arg.num(a.ratio), ...rAlt(a) }));
      const [d1, d2] = r.parameter;
      const lower = pf(r.statistic, d1, d2);
      const alt = r.alternative;
      const rway = alt === "less" ? lower : alt === "greater" ? 1 - lower : 2 * Math.min(lower, 1 - lower);
      // 1 - P with P near 1 has an absolute error of about 1e-16 in R as in the reproduction
      return Math.abs(rway - expected) <= 1e-15
        ? "R takes the upper tail as 1 - P, losing small p-values"
        : undefined;
    },
  });
if (hasFixture("bartlettTest"))
  htestSuite({
    name: "bartlettTest",
    call: (a) => bartlettTest((a.groups as unknown as string[][]).map((g) => (Array.isArray(g) ? g : [g]).map(num))),
    tolerance: 1e-12,
  });
if (hasFixture("mcnemarTest"))
  htestSuite({
    name: "mcnemarTest",
    call: (a) =>
      a.y === undefined
        ? mcnemarTest(arg.mat(a.x)!, defined({ correct: arg.bool(a.correct) }))
        : mcnemarTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ correct: arg.bool(a.correct) })),
    tolerance: 1e-13,
  });

const rGroups = (a: Record<string, HTestArg>): number[][] =>
  (a.groups as unknown as (string | string[])[]).map((g) => (Array.isArray(g) ? g : [g]).map(num));
const rSuites: [string, (a: Record<string, HTestArg>) => object, number][] = [
  ["kruskalTest", (a) => kruskalTest(rGroups(a)), 1e-12],
  ["onewayTest", (a) => onewayTest(rGroups(a), defined({ varEqual: arg.bool(a.varEqual) })), 1e-12],
  ["friedmanTest", (a) => friedmanTest(arg.mat(a.y)!), 1e-12],
  ["quadeTest", (a) => quadeTest(arg.mat(a.y)!), 1e-12],
];
for (const [name, call, tolerance] of rSuites) if (hasFixture(name)) htestSuite({ name, call, tolerance });
if (hasFixture("shapiroTest"))
  htestSuite({
    name: "shapiroTest",
    call: (a) => shapiroTest(arg.vec(a.x)!),
    tolerance: 1e-12,
    // at n = 5000 the p-value follows log(1 - W) with 1 - W near 3e-4, which the rounding of the sums of 5000 terms
    // leaves good to about 1e-12 (in R as here)
    fieldTolerance: { pValue: 3e-12 },
  });
if (hasFixture("flignerTest"))
  htestSuite({
    name: "flignerTest",
    call: (a) => flignerTest(rGroups(a)),
    tolerance: 1e-12,
    // a statistic that is exactly 0 here is rounding residue (1e-31) in R, which subtracts sum S^2 / n - n mean(a)^2
    floor: { statistic: 1e-10 },
  });
if (hasFixture("propTest"))
  htestSuite({
    name: "propTest",
    call: (a) =>
      propTest(arg.vec(a.x)!, arg.vec(a.n)!, defined({ p: arg.vec(a.p), correct: arg.bool(a.correct), ...rAlt(a) })),
    tolerance: 1e-12,
    // a continuity correction reduced to |O - E| gives exactly 0 here and rounding residue in R
    floor: { statistic: 1e-3 },
  });
if (hasFixture("mantelhaenTest"))
  htestSuite({
    name: "mantelhaenTest",
    call: (a) =>
      mantelhaenTest(
        (a.x as unknown as string[][][]).map((t) => t.map((r) => (Array.isArray(r) ? r : [r]).map(num))),
        defined({ correct: arg.bool(a.correct), exact: arg.bool(a.exact), ...rAlt(a) }),
      ),
    tolerance: 1e-12,
    // the exact test's estimate and limits are roots found by uniroot, in R as here
    fieldTolerance: { estimate: 1e-4, confInt: 1e-4 },
  });
/** A p-value R forms as 1 - P (P near 1) is good to about 1e-16 absolutely; within 1e-15 the difference is R's */
const oneMinusP = (_a: unknown, field: string, expected: number, actual: number): string | undefined =>
  field === "pValue" && Math.abs(actual - expected) <= 1e-15 ? "R forms the p-value as 1 - P, losing small values" : undefined;

if (hasFixture("ansariTest"))
  htestSuite({
    knownDifference: (a, field, expected, actual) => {
      const r = oneMinusP(a, field, expected, actual);
      if (r !== undefined || field !== "pValue") return r;
      // the exact distribution here agrees with exact subset counts (htest_ansariTest.scipy.json); R's sums of
      // probabilities carry rounding of up to about 1e-9 relative in small p-values
      const x = arg.vec(a.x) ?? [];
      const y = arg.vec(a.y)!;
      const z = [...x, ...y];
      const exact = (arg.bool(a.exact) ?? (x.length < 50 && y.length < 50)) && new Set(z).size === z.length;
      return exact && Math.abs(actual - expected) <= 1e-9 * expected
        ? "R's exact Ansari-Bradley probabilities carry rounding (the values here agree with exact counts)"
        : undefined;
    },
    name: "ansariTest",
    call: (a) =>
      ansariTest(
        arg.vec(a.x) ?? [],
        arg.vec(a.y)!,
        defined({ alternative: arg.str<Alternative>(a.alternative), exact: arg.bool(a.exact) }),
      ),
    tolerance: 1e-12,
  });
// against lawstat::brunner.munzel.test (oracle/brunnermunzel.R); small p-values, which lawstat forms as 1 - pt,
// are compared with the upper tail computed directly (the reference)
if (hasFixture("brunnerMunzelTest"))
  htestSuite({
    name: "brunnerMunzelTest",
    call: (a) =>
      brunnerMunzelTest(
        arg.vec(a.x)!,
        arg.vec(a.y)!,
        defined({ alternative: arg.str<Alternative>(a.alternative), confLevel: arg.num(a.confLevel) }),
      ),
    tolerance: 1e-12,
  });
/** Arguments without the empty lists that R's NULL becomes in the repeated cases of oracle/ansariconf.R */
const present = (args: Record<string, HTestArg>): Record<string, HTestArg> =>
  Object.fromEntries(Object.entries(args).filter(([, v]) => !(Array.isArray(v) && v.length === 0)));
if (hasFixture("ansariTestConfInt"))
  htestSuite({
    name: "ansariTestConfInt",
    call: (args) => {
      const a = present(args);
      return ansariTest(
        arg.vec(a.x) ?? [],
        arg.vec(a.y)!,
        defined({
          alternative: arg.str<Alternative>(a.alternative),
          exact: arg.bool(a.exact),
          confInt: arg.bool(a.confInt),
          confLevel: arg.num(a.confLevel),
        }),
      );
    },
    tolerance: 1e-12,
    // the normal-approximation limits and estimate are roots found by uniroot (tolerance 1e-4), in R as here
    fieldTolerance: { estimate: 1e-4, confInt: 1e-4 },
    knownDifference: (a, field, expected, actual) => {
      const r = oneMinusP(a, field, expected, actual);
      if (r !== undefined || field !== "pValue") return r;
      const x = arg.vec(a.x) ?? [];
      const y = arg.vec(a.y)!;
      const z = [...x, ...y].filter((v) => !Number.isNaN(v));
      const exact = (arg.bool(a.exact) ?? (x.length < 50 && y.length < 50)) && new Set(z).size === z.length;
      // up to 8.8e-9 for m = 60, n = 70 with exact = TRUE (exact count: 1.7603147168435401e-6; R 1.7603147013e-6)
      return exact && Math.abs(actual - expected) <= 1e-8 * expected
        ? "R's exact Ansari-Bradley probabilities carry rounding (the values here agree with exact counts)"
        : undefined;
    },
    // R fails with "object 'cint' not found" when exact is left at its default and there are ties (it falls back to
    // the normal approximation but skips its interval); the oracle repeats each such case with exact = FALSE
    substitute: (c, cases) => {
      if (c.expected.error !== "object 'cint' not found") return undefined;
      const key = (args: Record<string, HTestArg>): string => {
        const a = present(args);
        return JSON.stringify(Object.keys(a).filter((k) => k !== "exact").sort().map((k) => [k, a[k]]));
      };
      const twin = cases.find((d) => d.args.exact === false && key(d.args) === key(c.args));
      if (twin === undefined) throw new Error("no exact = FALSE case for an R 'cint' error");
      return { expected: twin.expected, reason: "R's 'cint' error with ties: compared with exact = FALSE (docs/differences-from-r.md)" };
    },
  });
const ksCall = (a: Record<string, HTestArg>) => {
  const cdf = arg.str(a.cdf);
  const y =
    cdf === undefined
      ? (arg.vec(a.y) ?? [])
      : cdf === "pnorm"
        ? (q: number) => pnorm(q)
        : cdf === "pexp"
          ? (q: number) => pexp(q)
          : (q: number) => punif(q);
  return ksTest(arg.vec(a.x) ?? [], y, defined({ alternative: arg.str<Alternative>(a.alternative), exact: arg.bool(a.exact) }));
};
if (hasFixture("ksTest"))
  htestSuite({
    name: "ksTest",
    call: ksCall,
    tolerance: 1e-12,
    // p-values formed as 1 - P(D < d), in R as here, have absolute accuracy only: the asymptotic ones and the exact
    // two-sided one-sample ones (off by 1e-15 absolute at n = 80 and 90). The other exact p-values are compared
    // relatively. Statistics near 0 are rounding residue of R's cumulative sums of 1/m and -1/n (here the
    // differences of the empirical distribution functions are formed directly)
    floor: {
      pValue: (c) => {
        const method = String(c.expected.method ?? "");
        const oneSampleTwoSided = method === "Exact one-sample Kolmogorov-Smirnov test" && c.expected.alternative === "two-sided";
        return method.startsWith("Asymptotic") || oneSampleTwoSided ? 1e-2 : 0;
      },
      statistic: 1e-3,
    },
    knownDifference: (a, field, expected, actual) => {
      // R sums Kolmogorov's limiting series to a tolerance of 1e-6 (the values here agree with
      // scipy.special.kolmogorov, htest_ksTest.scipy.json); the exact p-values are not exempted
      const two = (arg.str(a.alternative) ?? "two.sided") === "two.sided";
      return field === "pValue" &&
        two &&
        Math.abs(actual - expected) <= 1e-4 &&
        ksCall(a).method.startsWith("Asymptotic")
        ? "R sums the limiting Kolmogorov series only to a tolerance of 1e-6"
        : undefined;
    },
  });
if (hasFixture("pairwise"))
  htestSuite({
    name: "pairwise",
    call: (a) => {
      const kind = arg.str(a.kind);
      const o = defined({ pAdjustMethod: arg.str(a.pAdjustMethod), alternative: arg.str<Alternative>(a.alternative) });
      if (kind === "prop") return pairwisePropTest(arg.vec(a.x)!, arg.vec(a.n)!, defined({ pAdjustMethod: o.pAdjustMethod }));
      const x = arg.vec(a.x)!;
      const g = a.g as string[];
      if (kind === "wilcox" || kind === "wilcoxPaired") return pairwiseWilcoxTest(x, g, { ...o, paired: kind === "wilcoxPaired" });
      return pairwiseTTest(x, g, { ...o, paired: kind === "paired", poolSd: kind === "pooled" });
    },
    tolerance: 1e-12,
  });
if (hasFixture("moodTest"))
  htestSuite({
    name: "moodTest",
    call: (a) => moodTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ alternative: arg.str<Alternative>(a.alternative) })),
    tolerance: 1e-12,
    // R 4.5.2's variance correction for ties has (N - t)^2 where Mielke's formula has (N - 2 cumsum(t) + t)^2
    // (corrected in R-devel); the variance here is the exact permutation variance of the averaged scores
    knownDifference: (a) => {
      const z = [...arg.vec(a.x)!, ...arg.vec(a.y)!].filter(Number.isFinite);
      return new Set(z).size < z.length ? "R 4.5.2's tie correction of the variance is wrong (fixed in R-devel)" : undefined;
    },
  });

// With ties the R fixture cannot be the reference (above), so the statistic is checked against its definition: the
// sum of the averaged scores over the first sample, standardised with the mean and variance of that sum over all
// C(N, m) ways of choosing the first sample from the pooled values (enumerated here)
describe("moodTest with ties", () => {
  /** Scores (i - (N + 1) / 2)^2 by sorted position i, averaged over the positions of each tied value */
  const scores = (z: number[]): number[] => {
    const N = z.length;
    const sorted = [...z].sort((a, b) => a - b);
    return z.map((v) => {
      let s = 0;
      let c = 0;
      sorted.forEach((w, i) => {
        if (w === v) {
          s += (i + 1 - (N + 1) / 2) ** 2;
          c++;
        }
      });
      return s / c;
    });
  };
  const permutationZ = (x: number[], y: number[]): number => {
    const z = [...x, ...y];
    const a = scores(z);
    const N = z.length;
    const m = x.length;
    const sums: number[] = [];
    const choose = (start: number, left: number, acc: number): void => {
      if (left === 0) {
        sums.push(acc);
        return;
      }
      for (let i = start; i <= N - left; i++) choose(i + 1, left - 1, acc + a[i]!);
    };
    choose(0, m, 0);
    const E = sums.reduce((s, v) => s + v, 0) / sums.length;
    const V = sums.reduce((s, v) => s + (v - E) ** 2, 0) / sums.length;
    let T = 0;
    for (let i = 0; i < m; i++) T += a[i]!;
    return (T - E) / Math.sqrt(V);
  };
  // small samples of small integers (many ties) from a fixed linear congruential sequence
  let seed = 20261024;
  const next = (k: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return Math.floor((seed / 2147483648) * k);
  };
  const cases: [number[], number[]][] = [
    [[1, 2, 2, 3], [2, 3, 3, 4, 5]],
    [[0, 0, 1, 1, 1], [1, 2, 2]],
    [[5, 5, 5, 1], [5, 2, 2, 9, 9, 9]],
    [[1, 1, 1], [1, 1, 2, 2]],
  ];
  for (let i = 0; i < 30; i++) {
    const m = 2 + next(5);
    const n = 2 + next(6);
    const k = 2 + next(5);
    cases.push([Array.from({ length: m }, () => next(k)), Array.from({ length: n }, () => next(k))]);
  }
  it("agrees with the exact permutation mean and variance of the averaged scores", () => {
    let checked = 0;
    for (const [x, y] of cases) {
      const z = [...x, ...y];
      // ties needed; with all scores equal (e.g. two values in mirrored positions) the variance is 0
      if (new Set(z).size === z.length || new Set(scores(z)).size === 1) continue;
      const expected = permutationZ(x, y);
      for (const alternative of ["two.sided", "less", "greater"] as const) {
        const r = moodTest(x, y, { alternative });
        // (relative to max(|z|, 1): a z of exactly 0 here is rounding residue in the enumeration)
        expect(Math.abs(r.statistic - expected) / Math.max(Math.abs(expected), 1), `${JSON.stringify([x, y])}`).toBeLessThanOrEqual(1e-12);
        const p =
          alternative === "less"
            ? pnorm(expected)
            : alternative === "greater"
              ? pnorm(expected, { lowerTail: false })
              : 2 * pnorm(-Math.abs(expected));
        expect(relativeError(r.pValue, p), `${JSON.stringify([x, y])} ${alternative}`).toBeLessThanOrEqual(1e-12);
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(25);
  });
});
