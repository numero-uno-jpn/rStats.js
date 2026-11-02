// Issue #105: ddDiv and ddDivNum with a tiny numerator over a divisor below 1, where the remainders of the division
// fell below the subnormals and the low part of the quotient was lost (review_fix_log_issue105.md). The quotient does
// not change when both operands are multiplied by the same power of 2, so the reference is the division of the
// operands brought into the normal range.
import { describe, expect, it } from "vitest";
import { ddDiv, ddDivNum } from "../src/special/dd.js";

const MIN = Number.MIN_VALUE;
const scale = (x: number, k: number): number => x * 2 ** Math.trunc(k / 2) * 2 ** (k - Math.trunc(k / 2));

describe("issue #105", () => {
  it("keeps the low part of the quotient for subnormal operands", () => {
    const third = ddDiv([1, 0], [3, 0]);
    expect(third).toEqual([0.3333333333333333, 1.850371707708594e-17]);
    expect(ddDiv([MIN, 0], [3 * MIN, 0])).toEqual(third);
    expect(ddDivNum([MIN, 0], 3 * MIN)).toEqual(third);
    // normal but tiny operands: the second remainder fell below the subnormals (low part 8.3614e-20 before)
    expect(ddDiv([1e-300, 0], [3e-300, 0])).toEqual(ddDiv([scale(1e-300, 1000), 0], [scale(3e-300, 1000), 0]));
  });

  it("gives the quotient of the operands scaled into the normal range", () => {
    let seed = 105;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 2000; i++) {
      const ea = -1074 + Math.floor(rnd() * 200);
      const a = (1 + rnd()) * 2 ** ea;
      const b = (rnd() < 0.5 ? -1 : 1) * (1 + rnd()) * 2 ** (ea + Math.floor(rnd() * 120) - 60);
      if (!(a > 0) || b === 0 || !(Math.abs(b) < 1)) continue;
      const ref = ddDiv([scale(a, 1100), 0], [scale(b, 1100), 0]);
      expect(ddDiv([a, 0], [b, 0]), `${a} / ${b}`).toEqual(ref);
      expect(ddDivNum([a, 0], b), `${a} / ${b}`).toEqual(ref);
    }
  });

  it("leaves larger numerators as before", () => {
    expect(ddDiv([1e-200, 0], [3e-200, 0])).toEqual(ddDiv([scale(1e-200, 600), 0], [scale(3e-200, 600), 0]));
    expect(ddDiv([2, 1e-17], [3, 0])).toEqual(ddDiv([2, 1e-17], [3, 0]));
  });
});
