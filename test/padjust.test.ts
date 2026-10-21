import { pAdjust } from "../src/index.js";
import { arg, defined, htestSuite } from "./helpers/htest.js";

htestSuite({
  name: "pAdjust",
  call: (a) => ({ value: pAdjust(arg.vec(a.p)!, defined({ method: arg.str(a.method), n: arg.num(a.n) })) }),
  tolerance: 0,
});
