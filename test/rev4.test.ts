// Revision of review 4 (F-02): carAnova's "residual sum of squares is 0" is rss < 1e-24 times the weighted sum of
// squares of the response, residuals at the level of rounding; sqrt(eps) times the centred total rejected precise data
// that car computes (review_fix_log_20261031_4_rev.md).
import { describe, expect, it } from "vitest";
import { Anova, lm } from "../src/index.js";

const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const e = [3, -1, 4, -1, -5, 9, -2, 6, -5, 3];
const MSG = "residual sum of squares is 0 (within rounding error)";

/** A double from R's sprintf("%a") */
function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

describe("review 4 revision: carAnova's residual sum of squares 0", () => {
  it("computes y = 1000 x + e / 100 (rss / TSS 2.4e-10) as car", () => {
    const t = Anova(lm("y ~ x", { x, y: x.map((v, i) => 1000 * v + e[i]! / 100) }));
    // car 3.1 (R 4.5.2): Sum Sq 0x1.3ab65680003e8p+26 and 0x1.3f14b4b5e400ep-6, F 0x1.f8fd74f23d49ap+34 (the
    // residuals of this fit are only 12 digits good, in R and here)
    expect(t.table[0]![0]).toBeCloseTo(fromHex("0x1.3ab65680003e8p+26"), 6);
    expect(t.table[1]![0]! / fromHex("0x1.3f14b4b5e400ep-6")).toBeCloseTo(1, 10);
    expect(t.table[0]![2]! / fromHex("0x1.f8fd74f23d49ap+34")).toBeCloseTo(1, 10);
  });
  it("does not depend on the units (car is an error for y / 1e6)", () => {
    const a = Anova(lm("y ~ x", { x, y: x.map((v, i) => 1000 * v + e[i]! / 100) }));
    const b = Anova(lm("y ~ x", { x, y: x.map((v, i) => (1000 * v + e[i]! / 100) / 1e6) }));
    expect(b.table[0]![2]! / a.table[0]![2]!).toBeCloseTo(1, 10);
  });
  it("keeps the error for a model that fits exactly (car: the same error)", () => {
    expect(() => Anova(lm("y ~ x", { x, y: x.map((v) => 2 * v + 1) }))).toThrow(MSG);
    expect(() => Anova(lm("y ~ x", { x, y: x.map((v) => (2 * v + 1) * 1e-200) }))).toThrow(MSG);
  });
});
