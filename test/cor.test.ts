import { cor, corTest } from "../src/index.js";
import { arg, defined, htestSuite } from "./helpers/htest.js";

htestSuite({
  name: "cor",
  call: (a) => ({ value: cor(arg.vec(a.x)!, arg.vec(a.y)!, defined({ method: arg.str(a.method) })) }),
  tolerance: 1e-15,
});

htestSuite({
  name: "corTest",
  call: (a) =>
    corTest(
      arg.vec(a.x)!,
      arg.vec(a.y)!,
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        method: arg.str(a.method),
        exact: arg.bool(a.exact),
        confLevel: arg.num(a.confLevel),
        continuity: arg.bool(a.continuity),
      }),
    ),
  tolerance: 1e-12,
  knownDifference: (a, field, expected) =>
    a.method === "kendall" &&
    arg.vec(a.x)!.length === 2 &&
    Number.isNaN(expected) &&
    (field === "statistic" || field === "pValue")
      ? "R's Kendall variance for n = 2 takes 0/0 in the second tie term, which is 0 (issue #134)"
      : undefined,
  // Data of size 1e-200: R's sums of squares underflow to 0, so its cor is NaN with "the standard deviation is zero";
  // the correlation here is computed (it agrees with the reference values), without that warning
  substitute: (c) => {
    const w = c.expected.warnings as string[] | undefined;
    const pearson = (arg.str(c.args.method) ?? "pearson") === "pearson";
    const varies = (v: number[]): boolean => v.some((e) => e !== v[0]);
    if (!pearson || w?.[0] !== "the standard deviation is zero" || !varies(arg.vec(c.args.x)!) || !varies(arg.vec(c.args.y)!)) {
      return undefined;
    }
    return { expected: { ...c.expected, warnings: w.slice(1) }, reason: "R's sums of squares underflow (cor NaN, sd 0): no warning here" };
  },
});
