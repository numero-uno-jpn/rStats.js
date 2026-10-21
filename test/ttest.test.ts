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
});
