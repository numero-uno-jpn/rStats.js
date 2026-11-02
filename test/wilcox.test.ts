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
  knownDifference: (a, field, expected, actual) => {
    // two samples with every value tied: W always equals its expectation, p = 1 (R 4.5.2: 0 / 0 = NaN; issue #49)
    if (field === "pValue" && Number.isNaN(expected) && actual === 1 && !(arg.bool(a.paired) ?? false)) {
      const mu = arg.num(a.mu) ?? 0;
      const all = [...(arg.vec(a.x) ?? []).map((v) => v - mu), ...(arg.vec(a.y) ?? [])].filter((v) => !Number.isNaN(v));
      if (arg.vec(a.y) !== undefined && all.every((v) => v === all[0])) return "two samples with every value tied: p = 1 (R gives NaN)";
    }
    // R's psignrank(0, 3) is 0.12500000000000003 (1 ulp above 1/8), so for a one-sided interval the
    // achievable confidence level rounded to 2 significant digits is 1 - 0.13 = 0.87. rStats.js uses the exact
    // 1/8 and gets 1 - 0.12 = 0.88 (ties round to even; R also gives 0.88 when it is exactly 1/8, as in the
    // two-sided n = 4 case)
    if (field === "confLevel" && expected === 0.87 && actual === 0.88) {
      return "confidence level of the one-sided exact interval for n = 3 (R's psignrank(0, 3) is 1 ulp above 1/8)";
    }
    return undefined;
  },
  // a signed rank test with only zero differences ranks nothing: an error (R returns a p-value of NaN; review 59)
  substitute: (c) => {
    const x = arg.vec(c.args.x) ?? [];
    const y = arg.vec(c.args.y);
    const mu = arg.num(c.args.mu) ?? 0;
    const paired = arg.bool(c.args.paired) ?? false;
    if (y !== undefined && !paired) return undefined;
    const d = x.map((v, i) => (y === undefined ? v : v - y[i]!) - mu).filter((v) => !Number.isNaN(v));
    return d.length > 0 && d.every((v) => v === 0)
      ? { expected: { error: "no non-zero differences for the signed rank test" }, reason: "signed rank test with only zero differences: R returns NaN" }
      : undefined;
  },
});
