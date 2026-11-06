import { describe, expect, it } from "vitest";
import { binomCI, dbinom, pbinom, qnorm } from "../src/index.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

/** The result in DescTools' field names */
function call(a: HTestCase["args"]): object {
  const r = binomCI(
    arg.num(a.x)!,
    arg.num(a.n)!,
    defined({ method: arg.str(a.method), confLevel: arg.num(a.confLevel), sides: arg.str(a.sides) }),
  );
  return { est: r.estimate, "lwr.ci": r.confInt[0], "upr.ci": r.confInt[1], warnings: r.warnings };
}

/** Cases where DescTools gives a number (or NaN) for input that is an error under design rule 1 (choice 16) */
function substitute(c: HTestCase): { expected: HTestCase["expected"]; reason: string } | undefined {
  const x = arg.num(c.args.x)!;
  const n = arg.num(c.args.n)!;
  const level = arg.num(c.args.confLevel);
  if (!(Number.isInteger(x) && Number.isInteger(n) && x >= 0 && x <= n && n > 0 && n < Infinity)) {
    return { expected: { error: "counts" }, reason: "x > n, a negative or non-integer x, n = 0 or Inf are errors (DescTools: NaN or a number)" };
  }
  if (level === 1) return { expected: { error: "level" }, reason: "confLevel = 1 is an error (DescTools: NaN or [0, 1])" };
  if (level !== undefined && level < 0.5 && c.expected.error !== undefined) {
    return { expected: {}, reason: "a two-sided level below 0.5 is accepted (DescTools: an error); checked below" };
  }
  if (c.expected.error === "f() values at end points not of opposite sign") {
    return { expected: {}, reason: "midp at the one-sided level 0.5 (two-sided 0): DescTools' bracket excludes the root; checked below" };
  }
  // the lower formula at x = 0 (the upper at x = n) takes the square root of a negative number where kappa^2 < 2 + 1/n;
  // DescTools then replaces the limit by 0 (1) but keeps R's warning. Here the limit is set without the NaN
  const k = c.expected.warnings;
  if (arg.str(c.args.method) === "wilsoncc" && Array.isArray(k) && k.length > 0 && (x === 0 || x === n)) {
    return { expected: { ...c.expected, warnings: [] }, reason: "wilsoncc at x = 0 or n: no 'NaNs produced' for a limit that is replaced by 0 or 1" };
  }
  return undefined;
}

htestSuite({
  name: "binomCI",
  call,
  // closed forms of qnorm and qbeta; the midp limits against the roots (`reference`) to 1e-13, as they were solved
  tolerance: 1e-13,
  substitute,
  // x = 1, n = 1000 at 0.999999: the lower limit 1e-5 is the difference of terms near 25 (2x + kappa^2 - 1 and
  // kappa sqrt(...)), which turns the rounding of kappa into 1.7e-13 relative
  knownDifference: (a, field, e, v) =>
    arg.str(a.method) === "wilsoncc" && field === "lwr.ci" && Math.abs(v - e) <= 1e-12 * Math.abs(e)
      ? "wilsoncc: cancellation in DescTools' formula for a small lower limit (within 1e-12)"
      : undefined,
});

describe("binomCI", () => {
  it("accepts a two-sided level below 0.5", () => {
    const r = binomCI(3, 10, { confLevel: 0.4 });
    const k = qnorm(0.7);
    const centre = (3 + (k * k) / 2) / (10 + k * k);
    const half = ((k * Math.sqrt(10)) / (10 + k * k)) * Math.sqrt(0.21 + (k * k) / 40);
    expect(r.confInt[0]).toBeCloseTo(centre - half, 15);
    expect(r.confInt[1]).toBeCloseTo(centre + half, 15);
  });

  it("solves the midp limit at the two-sided level 0 (alpha/2 = 0.5)", () => {
    for (const [x, n] of [[3, 10], [37, 100], [1, 1000]] as const) {
      const u = binomCI(x, n, { method: "midp", confLevel: 0.5, sides: "right" }).confInt[1];
      const f = 0.5 * dbinom(x, n, u) + pbinom(x - 1, n, u);
      expect(Math.abs(f - 0.5)).toBeLessThan(1e-14);
      expect(u).toBeGreaterThan(x / n - 0.5 / n);
    }
  });

  it("gives the closed forms of the midp limits at x = 0 and x = n", () => {
    expect(binomCI(0, 10, { method: "midp" }).confInt[1]).toBeCloseTo(1 - 0.05 ** 0.1, 15);
    expect(binomCI(10, 10, { method: "midp" }).confInt[0]).toBeCloseTo(0.05 ** 0.1, 15);
  });

  it("rejects input without a defined result", () => {
    expect(() => binomCI(11, 10)).toThrow(RangeError);
    expect(() => binomCI(-1, 10)).toThrow(RangeError);
    expect(() => binomCI(2.5, 10)).toThrow(RangeError);
    expect(() => binomCI(0, 0)).toThrow(RangeError);
    expect(() => binomCI(NaN, 10)).toThrow(RangeError);
    expect(() => binomCI(3, 10, { confLevel: 1 })).toThrow(RangeError);
    expect(() => binomCI(3, 10, { confLevel: 0 })).toThrow(RangeError);
    expect(() => binomCI(3, 10, { confLevel: 0.4, sides: "left" })).toThrow(RangeError);
    expect(() => binomCI(3, 10, { method: "wil" })).toThrow(RangeError);
    expect(() => binomCI(3, 10, { sides: "less" })).toThrow(RangeError);
    // @ts-expect-error unknown option
    expect(() => binomCI(3, 10, { conf: 0.9 })).toThrow(RangeError);
  });

  it("returns the level, method and sides in full", () => {
    const r = binomCI(3, 10, { method: "clopper", sides: "l", confLevel: 0.9 });
    expect(r.method).toBe("clopper-pearson");
    expect(r.sides).toBe("left");
    expect(r.confLevel).toBe(0.9);
    expect(r.confInt[1]).toBe(1);
  });
});
