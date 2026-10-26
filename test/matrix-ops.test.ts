// Matrix arithmetic and construction, lu and prcomp against R (oracle/matrix.R; Matrix::lu for lu)
import {
  add, cbind, diag, divide, kronecker, lu, matMul, matrix, multiply, outer, prcomp, rbind, seq, subtract, t,
} from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";
import { alignColumns, vectorMask } from "./helpers/linalg.js";

type A = Record<string, HTestArg>;
type M = number[][];
/** A matrix (array of rows), a vector, or a number, as written in the fixture */
const v = (x: HTestArg | undefined): number | number[] | M => {
  if (x === undefined) throw new Error("missing argument");
  if (typeof x === "string") return arg.num(x)!;
  if (typeof x === "boolean") throw new Error("not a number");
  return Array.isArray(x[0]) ? arg.mat(x)! : arg.vec(x)!;
};
const val = (value: unknown) => ({ value });
const OPS = { "+": add, "-": subtract, "*": multiply, "/": divide } as const;

const suites: [string, (a: A) => object][] = [
  ["matMul", (a) => val(matMul(v(a.x), v(a.y)))],
  ["arith", (a) => val(OPS[arg.str<"+">(a.op)!](v(a.x), v(a.y)))],
  ["outer", (a) => val(outer(arg.vec(a.x)!, arg.vec(a.y)!, arg.str<"*">(a.fun)))],
  ["transpose", (a) => val(t(v(a.x)))],
  ["diag", (a) => val(diag(v(a.x), defined({ nrow: arg.num(a.nrow), ncol: arg.num(a.ncol) })))],
  ["cbind", (a) => val(cbind(v(a.x), v(a.y)))],
  ["rbind", (a) => val(rbind(v(a.x), v(a.y)))],
  ["matrix", (a) => val(matrix(v(a.data) as number[], defined({ nrow: arg.num(a.nrow), ncol: arg.num(a.ncol), byrow: arg.bool(a.byrow) })))],
  ["kronecker", (a) => val(kronecker(v(a.x), v(a.y)))],
  ["seq", (a) => val(seq(arg.num(a.from), arg.num(a.to), defined({ by: arg.num(a.by), lengthOut: arg.num(a.lengthOut) })))],
  ["lu", (a) => lu(arg.mat(a.x)!)],
];
for (const [name, call] of suites) htestSuite({ name, call, tolerance: 1e-14, floor: { value: 1e-15, L: 1, U: 1 } });

// prcomp: signs of components are arbitrary; align them as the fixture does (largest entry of each column positive)
htestSuite({
  name: "prcomp",
  call: (a) => {
    const opt = (x: HTestArg | undefined) => (typeof x === "boolean" ? x : arg.vec(x));
    const r = prcomp(arg.mat(a.x)!, defined({ center: opt(a.center), scale: opt(a.scale), rank: arg.num(a.rank), tol: arg.num(a.tol) }));
    // components with a standard deviation of (nearly) 0 or equal to another's are not determined (NaN, as in the oracle)
    alignColumns(r.rotation, vectorMask(r.sdev), r.x);
    return r;
  },
  tolerance: 1e-12,
  floor: { rotation: 1, x: 1 },
  // the small components of an ill-conditioned matrix are determined only to eps times the condition number
  // d_max / d_min (case 10, uncentred: 1.5e6 / 0.6; R and rStats.js are both 2e-11 from 50-digit values there)
  knownDifference: (a, _field, expected, actual) => {
    const opt = (x: HTestArg | undefined) => (typeof x === "boolean" ? x : arg.vec(x));
    const { sdev } = prcomp(arg.mat(a.x)!, defined({ center: opt(a.center), scale: opt(a.scale) }));
    const kappa = sdev[0]! / sdev[sdev.length - 1]!;
    return Math.abs(actual - expected) <= 1e-14 * kappa * Math.max(1, Math.abs(expected))
      ? "ill-conditioned: agreement to eps times the condition number"
      : undefined;
  },
});
