// Issue #140: mcnemarTest formed n_ij + n_ji first, which overflows for cells such as 1e308 and 8e307; the term was 0
// (review_fix_log_issue140.md). R gives NaN. Reference: (a - b)^2 / (a + b) in Rmpfr (200 bits) for the doubles:
// 0x1.950ff5260674bp+1017 for 1e308 and 8e307, 0x1.b48954dc119b1p+1021 for the largest double and 8e307.
import { describe, expect, it } from "vitest";
import { mcnemarTest } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);
const ref1 = 0x1950ff5260674b * 2 ** (1017 - 52);
const ref2 = 0x1b48954dc119b1 * 2 ** (1021 - 52);

describe("issue #140", () => {
  it("keeps the term of a pair whose sum overflows", () => {
    expect(mcnemarTest([[0, 1e308], [8e307, 0]], { correct: false }).statistic).toBe(ref1);
    // the corrected numerator 2e307 - 1 rounds to 2e307
    expect(mcnemarTest([[0, 1e308], [8e307, 0]]).statistic).toBe(ref1);
    expect(mcnemarTest([[0, 1e308], [8e307, 0]]).pValue).toBe(0);
    // (MAX - 8e307 itself rounds in double, as the difference of the cells did before)
    expect(rel(mcnemarTest([[0, Number.MAX_VALUE], [8e307, 0]], { correct: false }).statistic, ref2)).toBeLessThan(1e-15);
    // r x r: the other pairs add 4/4 + 4/6, below the resolution
    expect(mcnemarTest([[0, 1e308, 1], [8e307, 0, 2], [3, 4, 0]]).statistic).toBe(ref1);
    expect(mcnemarTest([[0, Number.MAX_VALUE], [Number.MAX_VALUE, 0]], { correct: false }).statistic).toBe(0);
  });

  it("keeps the other cases as before", () => {
    expect(mcnemarTest([[794, 86], [150, 570]]).statistic).toBe(16.81779661016949);
    // sum finite: the value of the code before the fix
    expect(mcnemarTest([[0, 1e300], [8e299, 0]]).statistic).toBe(2.2222222222222223e298);
  });
});
