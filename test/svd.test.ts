import { ginv, kappa, norm, svd, type NormType } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { alignColumns, condScaled, maxAbsOf } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;

/** Singular vector error is on the order of ε × largest singular value / singular value gap. gap is the smallest relative gap recorded by the oracle */
const vectorFloor = (field: string) => (c: HTestCase) => {
  const gap = c.args.gap === undefined ? 1 : num(c.args.gap as string);
  return (maxAbsOf(c.expected[field]) * Math.max(1e-13, (100 * Number.EPSILON) / gap)) / 1e-13;
};

htestSuite({
  name: "svd",
  call: (a) => {
    const s = svd(mat(a.x), defined({ nu: arg.num(a.nu), nv: arg.num(a.nv) }));
    const k = s.d.length;
    // Columns beyond min(rows, cols) (a basis of the orthogonal complement) and non-unique columns are not compared
    const extra = (m?: number[][]) => Array.from({ length: Math.max(0, (m?.[0]?.length ?? 0) - k) }, (_, i) => k + i + 1);
    const mask = [...(arg.vec(a.mask) ?? []), ...extra(s.u), ...extra(s.v)];
    const out: Record<string, unknown> = { d: s.d };
    if (s.u && s.u[0]!.length > 0) {
      alignColumns(s.u, mask, s.v);
      out.u = s.u;
      if (s.v) out.v = s.v;
    } else if (s.v) {
      alignColumns(s.v, mask);
      out.v = s.v;
    }
    return out;
  },
  tolerance: 1e-13,
  floor: { d: (c) => maxAbsOf(c.expected.d), u: vectorFloor("u"), v: vectorFloor("v") },
});

htestSuite({
  name: "norm2",
  call: (a) => ({ value: norm(mat(a.x), { type: "2" }) }),
  tolerance: 1e-14,
});

htestSuite({
  name: "kappa",
  call: (a) => ({
    value: kappa(
      mat(a.z),
      defined({
        exact: arg.bool(a.exact),
        norm: arg.str<NormType>(a.norm),
        method: arg.str<"qr" | "direct">(a.method),
        triangular: arg.bool(a.triangular),
        uplo: arg.str<"U" | "L">(a.uplo),
      }),
    ),
  }),
  tolerance: 1e-13,
  // The estimate is derived from the decomposition, so rounding differences in the decomposition (proportional to the condition number) carry over directly
  floor: { value: condScaled("value", 1e-13, 1, 10) },
});

htestSuite({
  name: "ginv",
  call: (a) => ({ value: ginv(mat(a.x), defined({ tol: arg.num(a.tol) })) }),
  tolerance: 1e-13,
  // The error of the pseudoinverse is proportional to the condition number over the singular values used
  floor: { value: condScaled("value", 1e-13, 1, 10) },
});
