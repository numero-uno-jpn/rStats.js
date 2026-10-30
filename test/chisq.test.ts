import { chisqTest, runif, setSeed } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

/** x is a vector (array of strings) or a matrix (array of rows) */
function counts(a: HTestArg | undefined): number[] | number[][] {
  return Array.isArray(a) && Array.isArray(a[0]) ? arg.mat(a)! : arg.vec(a)!;
}

htestSuite({
  name: "chisqTest",
  call: (a) =>
    chisqTest(
      counts(a.x),
      defined({ p: arg.vec(a.p), rescaleP: arg.bool(a.rescaleP), correct: arg.bool(a.correct) }),
    ),
  tolerance: 1e-12,
  // An infinite probability is an error: R rescales it to NaN and returns NaN expected counts
  substitute: (c) =>
    Array.isArray(c.args.p) && (c.args.p as string[]).includes("Inf")
      ? { expected: { error: "probabilities must be finite" }, reason: "R rescales an infinite probability to NaN" }
      : undefined,
});

// Simulated p-values: set.seed(seed) right before the test; next is the runif(1) drawn afterwards (the number of
// uniforms consumed must match R's)
htestSuite({
  name: "chisqTestSim",
  call: (a) => {
    setSeed(arg.num(a.seed)!);
    const r = chisqTest(
      counts(a.x),
      defined({
        p: arg.vec(a.p),
        rescaleP: arg.bool(a.rescaleP),
        correct: arg.bool(a.correct),
        simulatePValue: arg.bool(a.simulatePValue),
        B: arg.num(a.B),
      }),
    );
    return { ...r, next: runif(1)[0] };
  },
  tolerance: 1e-12,
});

/** Factor vector: labels, with null for R's NA */
const factor = (a: HTestArg | undefined): (string | null)[] => a as unknown as (string | null)[];

htestSuite({
  name: "chisqTestFactors",
  call: (a) => chisqTest(factor(a.x), factor(a.y), defined({ correct: arg.bool(a.correct) })),
  tolerance: 1e-12,
  // R sorts the levels with the locale's collation ("a", "A", "b", "B" in the oracle's locale); rStats.js sorts them
  // by code point (the C locale), so the rows and columns of R's table are put in that order before comparing
  substitute: (c) => {
    const e = c.expected;
    if (e.error !== undefined) return undefined;
    const byCodePoint = (u: string, v: string): number => (u < v ? -1 : u > v ? 1 : 0);
    const order = (levels: string[]): number[] => levels.map((_, i) => i).sort((i, j) => byCodePoint(levels[i]!, levels[j]!));
    const ro = order(e.rowLevels as string[]);
    const co = order(e.colLevels as string[]);
    if (ro.every((v, i) => v === i) && co.every((v, i) => v === i)) return undefined;
    const permute = (m: string[][]): string[][] => ro.map((i) => co.map((j) => m[i]![j]!));
    return {
      expected: {
        ...e,
        rowLevels: ro.map((i) => (e.rowLevels as string[])[i]!),
        colLevels: co.map((j) => (e.colLevels as string[])[j]!),
        observed: permute(e.observed as string[][]),
        expected: permute(e.expected as string[][]),
        residuals: permute(e.residuals as string[][]),
        stdres: permute(e.stdres as string[][]),
      },
      reason: "levels sorted by code point (C locale), where R used the locale's collation: R's rows and columns reordered",
    };
  },
});
