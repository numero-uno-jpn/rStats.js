// Issue #220: localMin with tol NaN or Infinity. localMin is internal; its only caller, optimize, rejects a tol that is
// not positive and finite before the search (#74), as R's optimize ("invalid 'tol' value").
import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import { optimize } from "../src/index.js";

describe("issue #220", () => {
  it("localMin is not part of the public API", () => {
    expect("localMin" in api).toBe(false);
  });

  it("optimize rejects NaN, infinite, zero and negative tol before searching", () => {
    for (const tol of [NaN, Infinity, 0, -1]) {
      let calls = 0;
      expect(() => optimize((x) => (calls++, x * x), -1, 1, { tol })).toThrow("'tol' must be a positive finite number");
      expect(calls).toBe(0);
    }
  });
});
