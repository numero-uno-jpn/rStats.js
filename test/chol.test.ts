import { chol, chol2inv } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";
import { condScaled, normwise } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;

htestSuite({
  name: "chol",
  call: (a) => {
    const opts = defined({ tol: arg.num(a.tol) });
    if (arg.bool(a.pivot)) {
      const { r, pivot, rank } = chol(mat(a.x), { ...opts, pivot: true });
      // pivot is 0-based, so add 1 to compare with R
      return { value: r, pivot: pivot.map((v) => v + 1), rank };
    }
    return { value: chol(mat(a.x), opts) };
  },
  tolerance: 1e-14,
  fieldTolerance: { pivot: 0, rank: 0 },
  // The forward error of the Cholesky factor is typically proportional to the square root of the condition number.
  // Factor 2: that is an estimate, not a bound. In case #12 (cond 1e8; R 4.6.2 with OpenBLAS 0.3.32) R is 8.1e-13
  // and rStats.js 5.3e-13 from the exact factor (Rmpfr), so the two differ by 1.1 eps sqrt(cond) times the maximum.
  floor: { value: condScaled("value", 1e-14, 0.5, 2) },
});

htestSuite({
  name: "chol2inv",
  call: (a) => {
    const x = Array.isArray(a.x) && Array.isArray(a.x[0]) ? mat(a.x) : arg.vec(a.x)!;
    return { value: chol2inv(x, defined({ size: arg.num(a.size) })) };
  },
  tolerance: 1e-14,
  floor: { value: normwise("value") },
});
