import { wilcoxTest } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

/** Scale of the data (the larger of the max absolute finite value and |mu|) */
function dataScale(c: HTestCase): number {
  const vals = [...(arg.vec(c.args.x) ?? []), ...(arg.vec(c.args.y) ?? [])];
  let m = Math.abs(num((c.args.mu as string | undefined) ?? "0"));
  for (const v of vals) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  return m;
}

htestSuite({
  name: "wilcoxTest",
  call: (a) =>
    wilcoxTest(
      arg.vec(a.x)!,
      arg.vec(a.y),
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        mu: arg.num(a.mu),
        paired: arg.bool(a.paired),
        exact: arg.bool(a.exact),
        correct: arg.bool(a.correct),
        confInt: arg.bool(a.confInt),
        confLevel: arg.num(a.confLevel),
        tolRoot: arg.num(a.tolRoot),
      }),
    ),
  tolerance: 1e-12,
  // With the normal approximation, interval endpoints and the estimate are roots of a step function. When the
  // true root (a Walsh average or difference) is 0, the root search stops at a small value around 1e-5 that
  // relative error cannot measure. Use the data scale as the floor
  floor: { confInt: dataScale, estimate: dataScale },
  knownDifference: (_a, field, expected, actual) => {
    // R's psignrank(0, 3) is 0.12500000000000003 (1 ulp above 1/8), so for a one-sided interval the
    // achievable confidence level rounded to 2 significant digits is 1 - 0.13 = 0.87. rStats.js uses the exact
    // 1/8 and gets 1 - 0.12 = 0.88 (ties round to even; R also gives 0.88 when it is exactly 1/8, as in the
    // two-sided n = 4 case)
    if (field === "confLevel" && expected === 0.87 && actual === 0.88) {
      return "confidence level of the one-sided exact interval for n = 3 (R's psignrank(0, 3) is 1 ulp above 1/8)";
    }
    return undefined;
  },
});
