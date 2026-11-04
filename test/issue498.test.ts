// Issue #498: an analytic gradient was scaled as (v · parscale) / fnscale, which overflows where the scaled gradient is
// finite (1e200 · 1e200 / 1e300 = 1e100); optimHess then took Inf − Inf. R 4.5.2's optimHess gives NaN here as well.
import { describe, expect, it } from "vitest";
import { optimHess } from "../src/index.js";

describe("issue #498", () => {
  it("a constant gradient whose product with parscale overflows", () => {
    expect(optimHess([0], (x) => 1e200 * x[0]!, () => [1e200], { parscale: [1e200], fnscale: 1e300 })).toEqual([[0]]);
  });

  it("ordinary scales are unchanged", () => {
    const h = optimHess(
      [1, 2],
      (x) => x[0]! ** 2 + 3 * x[0]! * x[1]! + x[1]! ** 4,
      (x) => [2 * x[0]! + 3 * x[1]!, 3 * x[0]! + 4 * x[1]! ** 3],
      { parscale: [2, 3], fnscale: 5 },
    );
    expect(h).toEqual([
      [1.9999999999992246, 2.9999999999995772],
      [2.9999999999995772, 48.00000399999208],
    ]);
  });
});
