import { tTest } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite } from "./helpers/htest.js";

htestSuite({
  name: "tTest",
  call: (a) =>
    tTest(
      arg.vec(a.x)!,
      arg.vec(a.y),
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        mu: arg.num(a.mu),
        paired: arg.bool(a.paired),
        varEqual: arg.bool(a.varEqual),
        confLevel: arg.num(a.confLevel),
      }),
    ),
  tolerance: 1e-12,
  // Interval endpoints are mu + (t ± q) * standard error. Large mu causes cancellation, so measure relative to |mu|
  floor: { confInt: (c) => Math.abs(num(c.expected.nullValue as string)) },
  // The interval does not depend on mu: R forms it as mu + (t ± q) stdErr, which is NaN for an infinite mu
  knownDifference: (args, field, expected) =>
    field === "confInt" && Number.isNaN(expected) && !Number.isFinite(arg.num(args.mu) ?? 0) ? "R's interval is NaN for an infinite mu" : undefined,
  // R's variances of data around 1e-200 underflow to 0 (it stops with "data are essentially constant"), and those of
  // widely spread data around 1e300 overflow to Inf (it reports a standard error of Inf). rStats.js scales the data by
  // a power of 2 first, so these cases are compared with its result for the data scaled by 2^600 or 2^-600 (exact),
  // with the values in units scaled back. For nearly constant data around 1e300 that is R's own "essentially constant"
  substitute: (c) => {
    const x = arg.vec(c.args.x)!;
    const y = arg.vec(c.args.y);
    const all = [...x, ...(y ?? [])];
    let e: number;
    if (c.expected.error === "data are essentially constant" && all.every((v) => Math.abs(v) < 1e-150)) e = 600;
    else if (c.expected.stdErr === "Inf" && all.some((v) => Math.abs(v) > 1e150)) e = -600;
    else return undefined;
    const f = 2 ** e;
    const mu = arg.num(c.args.mu);
    const reason = `R's variance ${e > 0 ? "underflows for data around 1e-200" : "overflows for data around 1e300"} (compared with the data scaled by 2^${e})`;
    let r: ReturnType<typeof tTest>;
    try {
      r = tTest(
        x.map((v) => v * f),
        y?.map((v) => v * f),
        defined({
          alternative: arg.str<"two.sided" | "less" | "greater">(c.args.alternative),
          mu: mu === undefined ? undefined : mu * f,
          paired: arg.bool(c.args.paired),
          varEqual: arg.bool(c.args.varEqual),
          confLevel: arg.num(c.args.confLevel),
        }),
      );
    } catch (err) {
      return { expected: { error: (err as Error).message }, reason };
    }
    const back = (v: number | number[]): string | string[] => (typeof v === "number" ? String(v / f) : v.map((w) => String(w / f)));
    return {
      expected: {
        ...r,
        statistic: String(r.statistic),
        parameter: String(r.parameter),
        pValue: String(r.pValue),
        confLevel: String(r.confLevel),
        confInt: back(r.confInt),
        estimate: back(r.estimate),
        nullValue: back(r.nullValue),
        stdErr: back(r.stdErr),
      },
      reason,
    };
  },
});
