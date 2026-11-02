// eigen of a matrix beyond 2^256 with entries far below the largest (found while checking #129; review log
// docs/review-logs/review_fix_log_eigen_scaling.md). Brought down to 2^256 (#131), 1e-200 in [1, 1e200; 1e-200, 2] was
// subnormal before the balancing (2.609, 0.391; and 2, 1 when brought down to 1); eigen now brings a large matrix down
// only to 2^459, as LAPACK's dgeev. The eigenvectors of [0, 1e200; 1e-200, 0] were zero: gebak scales a component to
// 6e199 and the sum of squares overflowed in the normalisation. R 4.5.2 gives the same values as below.
import { describe, expect, it } from "vitest";
import { eigen } from "../src/index.js";

const rel = (x: number, y: number) => Math.abs(x - y) / Math.abs(y);

describe("eigen of graded matrices beyond 2^256", () => {
  it("gives the eigenvalues and eigenvectors of [1, 1e200; 1e-200, 2]", () => {
    const e = eigen([[1, 1e200], [1e-200, 2]]);
    expect(e.values).toEqual([2.618033988749895, 0.3819660112501051]);
    const v = e.vectors!;
    expect(Math.abs(v[0]![0]!)).toBe(1);
    expect(rel(Math.abs(v[1]![0]!), 1.618033988749895e-200)).toBeLessThan(1e-14);
    expect(rel(Math.abs(v[1]![1]!), 6.180339887498949e-201)).toBeLessThan(1e-14);
  });

  it("gives unit eigenvectors of [0, 1e200; 1e-200, 0]", () => {
    const e = eigen([[0, 1e200], [1e-200, 0]]);
    expect(e.values).toEqual([1, -1]);
    const v = e.vectors!;
    for (const j of [0, 1]) {
      expect(Math.abs(v[0]![j]!)).toBe(1);
      expect(rel(Math.abs(v[1]![j]!), 1e-200)).toBeLessThan(1e-15);
    }
  });

  it("keeps 2, 1 for [1, 1e300; 1e-300, 2], as R (the ratio 1e-600 is beyond one scale)", () => {
    expect(eigen([[1, 1e300], [1e-300, 2]]).values).toEqual([2, 1]);
  });

  it("keeps the bits of other matrices", () => {
    // values of the implementation before the change
    expect(eigen([[1, 2], [3, 4]])).toEqual({
      values: [5.372281323269014, -0.3722813232690143],
      vectors: [[0.4159735579192843, 0.8245648401323937], [0.9093767091321242, -0.5657674649689923]],
    });
    expect(eigen([[1, 1e100], [1e-100, 2]]).vectors).toEqual([[1, 1], [1.618033988749895e-100, -6.180339887498949e-101]]);
    expect(eigen([[1e300, 2e299, -5e298], [3e299, -4e300, 1e299], [7e298, 2e299, 6e299]]).vectors).toEqual([
      [-0.0402259938027181, 0.9775607462874927, 0.11361044074612714],
      [0.9982803836472217, 0.06264442341651617, 0.028911681077895247],
      [-0.04263971209728827, 0.20112350318312544, 0.9931046180794452],
    ]);
  });
});
