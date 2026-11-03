// Issue #232: the exact tests of mantelhaenTest (2 x 2 x K) and fisherTest (2 x 2) check the size of the support
// before allocating it (review_fix_log_issue232.md).
import { afterEach, describe, expect, it, vi } from "vitest";
import { fisherTest, mantelhaenTest } from "../src/entries/tests.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Any Float64Array beyond a million entries throws, so the original calls (16 GB) fail quickly with src stashed */
function stubLargeArrays(): void {
  const Real = Float64Array;
  vi.stubGlobal(
    "Float64Array",
    new Proxy(Real, {
      construct(target, args: unknown[]) {
        if (typeof args[0] === "number" && args[0] > 1e6) throw new Error(`Float64Array of ${args[0]} entries`);
        return Reflect.construct(target, args);
      },
    }),
  );
}

describe("issue #232", () => {
  it("mantelhaenTest rejects an exact support beyond 2^24 before allocating it", () => {
    stubLargeArrays();
    const tab = [
      [1_000_000_000, 1_000_000_000],
      [1_000_000_000, 1_000_000_000],
    ];
    expect(() => mantelhaenTest([tab, tab], { exact: true })).toThrow(
      "the exact distribution of S has 4000000001 values, more than 2^24: use exact: false",
    );
    // 1 + 2^23 + 2^23 values: one beyond the bound
    const big = [
      [2 ** 23, 0],
      [0, 2 ** 23],
    ];
    expect(() => mantelhaenTest([big, big], { exact: true })).toThrow("16777217 values, more than 2^24");
    // exactly 2^24 values pass the check (the stub then stops the allocation)
    const smaller = [
      [2 ** 23 - 1, 0],
      [0, 2 ** 23 - 1],
    ];
    expect(() => mantelhaenTest([big, smaller], { exact: true })).toThrow("Float64Array of 8388609 entries");
    // the asymptotic test still answers
    expect(mantelhaenTest([tab, tab]).pValue).toBe(1);
  });

  it("fisherTest rejects a 2 x 2 support beyond 2^24 before allocating it", () => {
    stubLargeArrays();
    expect(() =>
      fisherTest([
        [1_000_000_000, 1_000_000_000],
        [1_000_000_000, 1_000_000_000],
      ]),
    ).toThrow("the exact distribution of the 2 x 2 table has 2000000001 values, more than 2^24");
    expect(() =>
      fisherTest([
        [2 ** 24, 0],
        [0, 2 ** 24],
      ]),
    ).toThrow("16777217 values, more than 2^24");
    expect(() =>
      fisherTest([
        [2 ** 24 - 1, 0],
        [0, 2 ** 24 - 1],
      ]),
    ).toThrow("Float64Array of 16777216 entries");
  });
});
