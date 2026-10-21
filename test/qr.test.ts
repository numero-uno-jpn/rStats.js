import { qr, qrCoef, qrFitted, qrQ, qrQty, qrQy, qrR, qrResid, qrSolve, qrX } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";
import { condScaled } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;
const vecOrMat = (a: HTestArg | undefined) => (Array.isArray(a) && Array.isArray(a[0]) ? mat(a) : arg.vec(a)!);
const decompose = (a: Record<string, HTestArg>) => qr(mat(a.x), defined({ tol: arg.num(a.tol), lapack: arg.bool(a.LAPACK) }));

htestSuite({
  name: "qr",
  call: (a) => {
    const q = decompose(a);
    // Householder vectors of linearly dependent columns are determined by rounding error alone, so they are not compared (set to NaN, as in oracle/qr.R)
    const r = arg.num(a.numRank);
    if (r !== undefined) {
      q.qr.forEach((row, i) => row.forEach((_, j) => j >= r && i > j && (row[j] = NaN)));
      q.qraux.forEach((_, j) => j >= r && (q.qraux[j] = NaN));
    }
    // pivot is 0-based; add 1 to compare with R
    return { qr: q.qr, qraux: q.qraux, rank: q.rank, pivot: q.pivot.map((v) => v + 1) };
  },
  tolerance: 1e-14,
  fieldTolerance: { rank: 0, pivot: 0 },
  floor: { qr: condScaled("qr", 1e-14, 1), qraux: condScaled("qraux", 1e-14, 1) },
});

htestSuite({
  name: "qrFunctions",
  call: (a) => {
    const fn = arg.str(a.fn);
    const y = a.y === undefined ? undefined : vecOrMat(a.y);
    if (fn === "solve") return { value: qrSolve(mat(a.x), y, defined({ tol: arg.num(a.tol) })) };
    const q = decompose(a);
    const value = (() => {
      switch (fn) {
        case "coef":
          return qrCoef(q, y!);
        case "qty":
          return qrQty(q, y!);
        case "qy":
          return qrQy(q, y!);
        case "fitted":
          return qrFitted(q, y!, defined({ k: arg.num(a.k) }));
        case "resid":
          return qrResid(q, y!);
        case "Q":
          return qrQ(q, defined({ complete: arg.bool(a.complete), dvec: arg.vec(a.dvec) }));
        case "R":
          return qrR(q, defined({ complete: arg.bool(a.complete) }));
        case "X":
          return qrX(q, defined({ complete: arg.bool(a.complete), ncol: arg.num(a.ncol) }));
      }
      throw new Error(`fn: ${fn}`);
    })();
    return { value };
  },
  tolerance: 1e-14,
  // Rounding differences grow in proportion to the condition number. With a nonzero residual, least-squares coefficients grow with its square
  floor: {
    value: (c) =>
      ["coef", "solve"].includes(arg.str(c.args.fn)!)
        ? condScaled("value", 1e-14, 2, 10)(c)
        : condScaled("value", 1e-14, 1, 10)(c),
  },
});
