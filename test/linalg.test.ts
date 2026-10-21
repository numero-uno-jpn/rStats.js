import { backsolve, crossprod, forwardsolve, norm, tcrossprod } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";
import { columnNorms, finiteMax, normwise, rowNorms } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;
/** Vector or matrix argument */
const vecOrMat = (a: HTestArg | undefined) => (Array.isArray(a) && Array.isArray(a[0]) ? mat(a) : arg.vec(a)!);

// Rounding error of an inner product scales with |x| |y|. Use the maximum product of column (row) 2-norms as the floor

/** If an inner product overflows midway, whether the result is Inf or NaN (Inf - Inf) depends on summation order (R uses OpenBLAS) */
const overflow = (_a: unknown, _f: string, expected: number, actual: number) =>
  !Number.isFinite(expected) && !Number.isFinite(actual) ? "sum of products overflows (Inf vs NaN depends on summation order)" : undefined;

htestSuite({
  name: "crossprod",
  call: (a) => ({ value: crossprod(vecOrMat(a.x), a.y === undefined ? undefined : vecOrMat(a.y)) }),
  tolerance: 1e-14,
  knownDifference: overflow,
  floor: {
    value: (c) => {
      const nx = columnNorms(c.args.x);
      return finiteMax(nx) * finiteMax(c.args.y === undefined ? nx : columnNorms(c.args.y));
    },
  },
});

htestSuite({
  name: "tcrossprod",
  call: (a) => ({ value: tcrossprod(vecOrMat(a.x), a.y === undefined ? undefined : vecOrMat(a.y)) }),
  tolerance: 1e-14,
  knownDifference: overflow,
  floor: {
    value: (c) => {
      const nx = rowNorms(c.args.x);
      return finiteMax(nx) * finiteMax(c.args.y === undefined ? nx : rowNorms(c.args.y));
    },
  },
});

htestSuite({
  name: "norm",
  call: (a) => ({ value: norm(mat(a.x), defined({ type: arg.str(a.type) })) }),
  tolerance: 1e-14,
});

htestSuite({
  name: "backsolve",
  call: (a) => {
    const f = arg.str(a.fn) === "backsolve" ? backsolve : forwardsolve;
    const opts = defined({ k: arg.num(a.k), upperTri: arg.bool(a.upperTri), transpose: arg.bool(a.transpose) });
    return { value: f(mat(a.r), vecOrMat(a.x), opts) };
  },
  tolerance: 1e-14,
  floor: { value: normwise("value") },
});
