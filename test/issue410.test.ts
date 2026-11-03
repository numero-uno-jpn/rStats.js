// Issue #410: rhyper at the integer limit. R 4.5.2 switches to qhyper(runif) when one of m, n, k is at least
// .Machine$integer.max, as rStats.js. With m + n = 2^31 and both below it, R's integer arithmetic overflows ("afc(i),
// i=-2147483648 < 0 -- SHOULD NOT HAPPEN!") and returns 0; rStats.js returns 8, which is qhyper(u) for the uniform
// drawn. m = 2147483647, n = 0, k = 2 is 2 after one uniform in both (review_fix_log_issue410.md).
import { describe, expect, it } from "vitest";
import { qhyper, rhyper, runif, setSeed } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

setSeed(1);
const u = runif(2);

/** The value after setSeed(1) and the next uniform */
function run(f: () => number[]): [number[], number] {
  setSeed(1);
  const v = f();
  return [v, runif(1)[0]!];
}

describe("issue #410: rhyper near the integer limit", () => {
  it("m + n = 2^31 with m, n below INT_MAX: the quantile of the uniform drawn, one uniform", () => {
    expect(run(() => rhyper(1, 2 ** 30, 2 ** 30, 18))).toEqual([[8], u[1]]);
    expect(qhyper(u[0]!, 2 ** 30, 2 ** 30, 18)).toBe(8);
  });

  it("m + n = 2^31 - 2: R's 8 after one uniform", () => {
    expect(run(() => rhyper(1, 2 ** 30 - 1, 2 ** 30 - 1, 18))).toEqual([[8], u[1]]);
  });

  it("m = 2147483647, n = 0, k = 2: R's 2 after one uniform", () => {
    // R: set.seed(1); rhyper(1, 2147483647, 0, 2); sprintf("%a", runif(1)) is 2, 0x1.7d0e0c2cp-2 (the second uniform)
    expect(run(() => rhyper(1, 2147483647, 0, 2))).toEqual([[2], u[1]]);
    expect(u[1]).toBe(hex("0x1.7d0e0c2cp-2"));
  });
});
