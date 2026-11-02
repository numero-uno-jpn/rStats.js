// Issue #94: sampleInt's and sample's size truncated before it is checked, as R (review_fix_log_issue94.md).
// R 4.5.2: sample.int(5, -0.5) is integer(0) without a draw (also with prob, replace, and for sample); -1 and -1.1
// are "invalid 'size' argument".
import { describe, expect, it } from "vitest";
import { runif, sample, sampleInt, setSeed, type SampleOptions } from "../src/index.js";

setSeed(1);
const u = runif(3);

/** The result and the number of uniforms drawn */
function run<T>(f: () => T[]): { values: T[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #94", () => {
  it("takes a size in (-1, 0) as 0", () => {
    const ones = [1, 1, 1, 1, 1];
    const cases: SampleOptions[] = [
      { size: -0.5 },
      { size: -0.9 },
      { size: -0.5, prob: ones },
      { size: -0.5, replace: true },
      { size: -0.5, replace: true, prob: ones },
    ];
    for (const o of cases) expect(run(() => sampleInt(5, o)), JSON.stringify(o)).toEqual({ values: [], drawn: 0 });
    expect(run(() => sampleInt(1e6, { size: -0.5 }))).toEqual({ values: [], drawn: 0 });
    expect(run(() => sample([3, 7, 9], { size: -0.5 }))).toEqual({ values: [], drawn: 0 });
  });

  it("truncates a fractional size", () => {
    expect(run(() => sampleInt(5, { size: 2.7 }))).toEqual(run(() => sampleInt(5, { size: 2 })));
    const prob = [1, 2, 3, 4, 5];
    expect(run(() => sampleInt(5, { size: 2.7, prob }))).toEqual(run(() => sampleInt(5, { size: 2, prob })));
  });

  it("rejects sizes that truncate to a negative number, and NaN", () => {
    for (const size of [-1, -1.1, NaN]) expect(() => sampleInt(5, { size }), String(size)).toThrow(RangeError);
  });
});
