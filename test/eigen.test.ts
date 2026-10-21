import { eigen } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { alignColumns, alignComplexColumns, maxAbsOf } from "./helpers/linalg.js";

const mat = (a: HTestArg | undefined) => arg.mat(a)!;

/** Eigenvector error is of order ε × max |eigenvalue| / eigenvalue gap. gap is the smallest relative gap supplied by the oracle. */
const vectorFloor = (field: string) => (c: HTestCase) => {
  const gap = c.args.gap === undefined ? 1 : num(c.args.gap as string);
  return (maxAbsOf(c.expected[field]) * Math.max(1e-13, (100 * Number.EPSILON) / gap)) / 1e-13;
};

htestSuite({
  name: "eigenSymmetric",
  call: (a) => {
    const e = eigen(mat(a.x), defined({ symmetric: arg.bool(a.symmetric), onlyValues: arg.bool(a.onlyValues) }));
    const out: Record<string, unknown> = { values: e.values };
    if (e.vectors) {
      alignColumns(e.vectors, arg.vec(a.mask) ?? []);
      out.vectors = e.vectors;
    }
    return out;
  },
  tolerance: 1e-13,
  floor: { values: (c) => maxAbsOf(c.expected.values), vectors: vectorFloor("vectors") },
});

/** Eigenvalue error of a nonsymmetric matrix can be proportional to the condition number (cond) of the eigenvector matrix */
const condOf = (c: HTestCase) => (c.args.cond === undefined ? 1 : num(c.args.cond as string));
const valueFloor = (c: HTestCase) =>
  (Math.max(maxAbsOf(c.expected.values), maxAbsOf(c.expected.valuesIm)) * Math.max(1e-13, 10 * Number.EPSILON * condOf(c))) / 1e-13;
const generalVectorFloor = (field: string) => (c: HTestCase) => {
  const gap = c.args.gap === undefined ? 1 : num(c.args.gap as string);
  return (Math.max(maxAbsOf(c.expected[field]), 1e-300) * Math.max(1e-13, (100 * Number.EPSILON * condOf(c)) / gap)) / 1e-13;
};

htestSuite({
  name: "eigenGeneral",
  call: (a) => {
    const e = eigen(mat(a.x), defined({ symmetric: arg.bool(a.symmetric), onlyValues: arg.bool(a.onlyValues) }));
    const out: Record<string, unknown> = { values: e.values };
    if (e.valuesIm) out.valuesIm = e.valuesIm;
    if (e.vectors) {
      const n = e.vectors.length;
      const im = e.vectorsIm ?? Array.from({ length: n }, () => new Array<number>(n).fill(0));
      alignComplexColumns(e.vectors, im, arg.vec(a.mask) ?? []);
      out.vectors = e.vectors;
      if (e.vectorsIm) out.vectorsIm = im;
    }
    return out;
  },
  tolerance: 1e-13,
  floor: {
    values: valueFloor,
    valuesIm: valueFloor,
    // Real and imaginary parts are measured on the same scale (unit vector length)
    vectors: (c) => generalVectorFloor("vectors")(c) || 1,
    vectorsIm: (c) => generalVectorFloor("vectors")(c) || 1,
  },
});
