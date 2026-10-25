import { describe, expect, it } from "vitest";
import { getRandomSeed, rnorm, runif, setRandomSeed, setSeed } from "../src/index.js";
import { r2dtable } from "../src/random/r2dtable.js";
import { nums, randomSuite, summary } from "./helpers/random.js";
import { call, v, type Args } from "./helpers/randomCall.js";

/** Cases with large n compare summaries (summ in oracle/random.R) */
const isLong = (a: Args): boolean =>
  a.fn !== "sample.int" && !(["rhyper", "rsignrank", "rwilcox"].includes(a.fn as string) && a.nb === undefined) &&
  a.n !== undefined && v(a, "n") >= 10000;
const callOrSummary = (a: Args): number[] => (isLong(a) ? summary(call(a)) : call(a));

// Continuous distributions: the last digits of log, exp, tan, etc. differ between R (glibc) and V8, so compare
// with a relative tolerance. The number of uniforms consumed (next) and discrete values must match exactly
// (docs/differences-from-r.md)
const CONTINUOUS = 1e-12;
randomSuite([
  ...["rbasic", "rgamma", "rchisq", "rbeta", "rother"].map((name) => ({ name, call: callOrSummary, isSummary: isLong, tolerance: CONTINUOUS })),
  ...["rpois", "rbinom", "rnbinom", "rrank", "rsample", "rmultinom", "rhyper"].map((name) => ({ name, call: callOrSummary, isSummary: isLong })),
  // Mixes binomial and Poisson (integer) with gamma and beta (continuous)
  { name: "rextradist", call: callOrSummary, isSummary: isLong, tolerance: CONTINUOUS },
  { name: "rlong", call: callOrSummary, isSummary: isLong, tolerance: CONTINUOUS },
  { name: "rstate", call: callOrSummary, isSummary: isLong, tolerance: CONTINUOUS },
  // each table flattened column by column, as R's as.vector of the matrix
  {
    name: "r2dtable",
    call: (a: Args) =>
      r2dtable(v(a, "n"), nums(a.r), nums(a.c)).flatMap((t) => t[0]!.flatMap((_, j) => t.map((row) => row[j]!))),
  },
]);

describe("RNG state", () => {
  it("getRandomSeed / setRandomSeed restore the state", () => {
    setSeed(42);
    runif(3);
    const st = getRandomSeed();
    expect(st.length).toBe(626);
    const a = rnorm(5);
    setRandomSeed(st);
    expect(rnorm(5)).toEqual(a);
  });
  it("setSeed(42) gives the same .Random.seed as R", () => {
    setSeed(42);
    // R: set.seed(42); .Random.seed[1:4]
    expect(Array.from(getRandomSeed().slice(0, 4))).toEqual([10403, 624, 507561766, 1260545903]);
  });
});
