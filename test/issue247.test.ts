// Issue #247: uniroot checks extendInt as R's match.arg (review_fix_log_issue247.md).
import { describe, expect, it } from "vitest";
import { uniroot } from "../src/index.js";

const f = (x: number): number => x * x - 2;

describe("issue #247", () => {
  it("rejects an extendInt that is not one of the four values or a unique prefix, before evaluating f", () => {
    // R 4.5.2: "'arg' should be one of ..." for "bogus", "", "DOWNX" and NA, "must be NULL or a character vector" for 1
    for (const extendInt of ["bogus", "", "DOWNX", "no ", null, 1]) {
      let calls = 0;
      const g = (x: number): number => (calls++, f(x));
      expect(() => uniroot(g, 0, 2, { extendInt: extendInt as never })).toThrow(
        `'extendInt' should be one of "no", "yes", "downX", "upX"`,
      );
      expect(calls).toBe(0);
    }
  });

  it("accepts the four values and their unique prefixes, as R", () => {
    // R 4.5.2: uniroot(f, c(0, 2), extendInt = e)$root is 0x1.6a09e256f2c19p+0 for "n", "y" and "u"
    const r = parseInt("16a09e256f2c19", 16) * 2 ** -52; // 0x1.6a09e256f2c19p+0
    for (const extendInt of [undefined, "no", "n", "yes", "y", "upX", "u", "up"]) {
      expect(uniroot(f, 0, 2, { extendInt: extendInt as never }).root).toBe(r);
    }
    // a root outside the interval: "u" extends as "upX" (R: 1.414218)
    expect(uniroot(f, 2, 3, { extendInt: "u" as never })).toEqual(uniroot(f, 2, 3, { extendInt: "upX" }));
    expect(uniroot(f, 2, 3, { extendInt: "u" as never }).root).toBeCloseTo(1.414218, 5);
    // "d" is "downX": f increases, so R finds no sign change in 1000 iterations
    expect(() => uniroot(f, 0, 2, { extendInt: "d" as never })).toThrow("no sign change found");
  });
});
