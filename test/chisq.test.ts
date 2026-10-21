import { chisqTest } from "../src/index.js";
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
});
