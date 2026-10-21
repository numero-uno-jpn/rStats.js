import { det, determinant, rcond, solve } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";
import { num } from "./helpers/fixture.js";
import { condScaled } from "./helpers/linalg.js";

/** Condition number × ε (the condition number the oracle put in args; 0 if absent) */
const condEps = (c: { args: Record<string, HTestArg> }) => (c.args.cond === undefined ? 0 : 10 * Number.EPSILON * num(c.args.cond as string));

const mat = (a: HTestArg | undefined) => arg.mat(a)!;
const vecOrMat = (a: HTestArg | undefined) => (Array.isArray(a) && Array.isArray(a[0]) ? mat(a) : arg.vec(a));

htestSuite({
  name: "solve",
  call: (a) => ({ value: solve(mat(a.a), vecOrMat(a.b), defined({ tol: arg.num(a.tol) })) }),
  tolerance: 1e-13,
  // The forward error of the solution is proportional to the condition number
  floor: { value: condScaled("value", 1e-13, 1, 10) },
});

htestSuite({
  name: "determinant",
  call: (a) => {
    const d = determinant(mat(a.x), defined({ logarithm: arg.bool(a.logarithm) }));
    return { modulus: d.modulus, sign: d.sign, det: det(mat(a.x)) };
  },
  tolerance: 1e-13,
  fieldTolerance: { sign: 0 },
  // The relative error of the determinant is proportional to the condition number (absolute error on the log scale; logs near 0 use 1 as the scale)
  floor: {
    modulus: (c) => {
      const m = Math.abs(num(c.expected.modulus as string));
      const scale = arg.bool(c.args.logarithm) === false ? m : Math.max(m, 1);
      return (scale * Math.max(1e-13, condEps(c))) / 1e-13;
    },
    det: (c) => (Math.abs(num(c.expected.det as string)) * Math.max(1e-13, condEps(c))) / 1e-13,
  },
  knownDifference: (a, field) =>
    field === "sign" && mat(a.x).flat().some(Number.isNaN)
      ? "the sign for a matrix containing NaN depends on pivot selection (NaN handling)"
      : undefined,
});

htestSuite({
  name: "rcond",
  call: (a) =>
    ({
      value: rcond(
        mat(a.x),
        defined({
          norm: arg.str<"O" | "1" | "I">(a.norm),
          triangular: arg.bool(a.triangular),
          uplo: arg.str<"U" | "L">(a.uplo),
        }),
      ),
    }),
  tolerance: 1e-13,
  // The estimate is derived from the LU factors, so rounding differences in the factorization (proportional to the condition number) carry over directly
  floor: { value: condScaled("value", 1e-13, 1, 10) },
});
