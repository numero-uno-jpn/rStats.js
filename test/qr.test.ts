import { describe, expect, it } from "vitest";
import { qr, qrCoef, qrFitted, qrQ, qrQty, qrQy, qrR, qrResid, qrSolve, qrX } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestArg } from "./helpers/htest.js";
import { condScaled } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;
const vecOrMat = (a: HTestArg | undefined) => (Array.isArray(a) && Array.isArray(a[0]) ? mat(a) : arg.vec(a)!);
const decompose = (a: Record<string, HTestArg>) => qr(mat(a.x), defined({ tol: arg.num(a.tol), lapack: arg.bool(a.LAPACK) }));

/**
 * Whether dgeqp3's column choice (lapack: true) is a tie within the numerical rank: at some step, another column's
 * remaining norm equals the chosen one's in exact arithmetic (e.g. cbind(a, b, a + b, b): after a + b, the residuals
 * of a and b are opposite vectors). Rounding then decides the pivot, and with it everything after: R itself differs
 * between OpenBLAS 0.3.26 and 0.3.32 and between aarch64 and x86_64 builds (cases #41, #43, #51). rStats.js follows the
 * reference LAPACK 3.12.1 (dlarf1f) and gives its pivots on x86_64; the fixture is from aarch64 R. The remaining
 * norm of the column in pivoted position k at step j is that of R[j..k, k].
 */
const TIED = "tied pivot: rounding decides the column (judged by the invariants below)";
function tiedPivot(a: Record<string, HTestArg>): boolean {
  const r = arg.num(a.numRank);
  if (!arg.bool(a.LAPACK) || r === undefined || r === 0) return false;
  const R = qrR(decompose(a));
  for (let j = 0; j < Math.min(r, R.length); j++) {
    const chosen = Math.abs(R[j]![j]!);
    for (let k = j + 1; k < R[0]!.length; k++) {
      let s = 0;
      for (let i = j; i <= Math.min(k, R.length - 1); i++) s += R[i]![k]! ** 2;
      if (Math.abs(Math.sqrt(s) - chosen) <= 1e-12 * chosen) return true;
    }
  }
  return false;
}

htestSuite({
  name: "qr",
  call: (a) => {
    const q = decompose(a);
    // The oracle's NaN padding hides the length, so check it here: one Householder scalar per reflection for LAPACK
    const width = q.qr[0]?.length ?? 0;
    if (q.qraux.length !== (q.useLapack ? Math.min(q.qr.length, width) : width)) throw new Error(`qraux has ${q.qraux.length} elements`);
    // Householder vectors of linearly dependent columns are determined by rounding error alone, so they are not compared (set to NaN, as in oracle/qr.R)
    const r = arg.num(a.numRank);
    if (r !== undefined) {
      q.qr.forEach((row, i) => row.forEach((_, j) => j >= r && i > j && (row[j] = NaN)));
      // As in the oracle, this extends the shorter LAPACK qraux to ncol elements
      for (let j = r; j < width; j++) q.qraux[j] = NaN;
    }
    // pivot is 0-based; add 1 to compare with R
    return { qr: q.qr, qraux: q.qraux, rank: q.rank, pivot: q.pivot.map((v) => v + 1) };
  },
  tolerance: 1e-14,
  fieldTolerance: { rank: 0, pivot: 0 },
  floor: { qr: condScaled("qr", 1e-14, 1), qraux: condScaled("qraux", 1e-14, 1) },
  knownDifference: (a) => (tiedPivot(a) ? TIED : undefined),
});

// What does not depend on the choice among tied columns: the rank, |diag R| within the numerical rank (the norms of
// the successive residuals) and Q R P' = X. (A tie in double precision only, as cbind(1:3, 1:3 + 1e-8 c(1, -2, 1)),
// is detected too; R and rStats.js agree there.)
describe("qr with lapack: true where the pivot is a tie", () => {
  const cases = loadHTestFixture("qr").cases.flatMap((c, i) => (tiedPivot(c.args) ? [[i, c] as const] : []));
  it("has such cases in the fixture", () => expect(cases.length).toBeGreaterThan(0));
  it.each(cases)("#%i: rank, |diag R| and Q R P' = X agree with R", (_, c) => {
    const x = mat(c.args.x);
    const q = decompose(c.args);
    expect(q.rank).toBe(num(c.expected.rank as string));
    const rRank = num(c.args.numRank as string);
    const R = qrR(q);
    const expectedQr = c.expected.qr as string[][];
    // normwise, scaled by the condition number as the floor of the suite above
    const cond = c.args.cond === undefined ? 1 : num(c.args.cond as string);
    const tol = Math.max(1e-14, Number.EPSILON * cond) * Math.abs(num(expectedQr[0]![0]!));
    for (let j = 0; j < rRank; j++) expect(Math.abs(Math.abs(R[j]![j]!) - Math.abs(num(expectedQr[j]![j]!)))).toBeLessThanOrEqual(tol);
    const scale = Math.max(...x.flat().map(Math.abs));
    qrX(q).forEach((row, i) => row.forEach((v, j) => expect(Math.abs(v - x[i]![j]!)).toBeLessThanOrEqual(1e-14 * scale)));
  });
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
  // R of a tied pivot (the invariants are checked in the qr block above); X, fitted and resid do not depend on it
  knownDifference: (a) => (arg.str(a.fn) === "R" && tiedPivot(a) ? TIED : undefined),
});
