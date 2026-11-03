// Issue #405: setSeed(-2147483648) is rejected, as R's set.seed (-2147483648 is NA_integer_ in R: "supplied seed is
// not a valid integer"). -2147483647 is accepted and gives R's stream (R 4.5.2, review_fix_log_issue405.md).
import { describe, expect, it } from "vitest";
import { runif, setSeed } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

describe("issue #405: the lower end of setSeed", () => {
  it("rejects -2147483648, as R", () => {
    expect(() => setSeed(-2147483648)).toThrow("seed must be a 32-bit integer");
  });

  it("accepts -2147483647 with R's stream", () => {
    setSeed(-2147483647);
    // R: set.seed(-2147483647); sprintf("%a", runif(2))
    expect(runif(2)).toEqual([hex("0x1.1fc0a66ep-1"), hex("0x1.26b7601ap-1")]);
  });
});
