// Issue #219: r2dtable(0, ...) returns [] without building the table of log factorials (review_fix_log_issue219.md).
import { afterEach, describe, expect, it, vi } from "vitest";
import { r2dtable, runif, setSeed } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("issue #219", () => {
  it("returns [] for zero tables without a large allocation", () => {
    // the original call would allocate 2e9 + 1 doubles (16 GB) before the fix: any Float64Array beyond a million
    // entries throws here instead, so the test fails quickly with src stashed
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
    expect(r2dtable(0, [1_000_000_000, 1_000_000_000], [1_000_000_000, 1_000_000_000])).toEqual([]);
    expect(r2dtable(0.7, [1_000_000_000, 1_000_000_000], [1_000_000_000, 1_000_000_000])).toEqual([]);
  });

  it("still checks the margins and draws no uniforms, as R", () => {
    // R 4.5.2: r2dtable(0, c(3, 2), c(2, 4)) "arguments 'r' and 'c' must have the same sums";
    // r2dtable(0, 3, 3) "invalid argument 'r'"; set.seed(1); r2dtable(0, c(3, 2), c(2, 3)) is list() and the next
    // runif(1) is 0.26550866314209998 (the first uniform of seed 1)
    expect(() => r2dtable(0, [3, 2], [2, 4])).toThrow("arguments 'r' and 'c' must have the same sums");
    expect(() => r2dtable(0, [3], [3])).toThrow("invalid argument 'r'");
    setSeed(1);
    expect(r2dtable(0, [3, 2], [2, 3])).toEqual([]);
    expect(runif(1)[0]).toBe(0.26550866314209998);
  });
});
