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
});
