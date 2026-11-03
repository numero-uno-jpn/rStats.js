import { describe, expect, it } from "vitest";
import { jonckheereTest } from "../src/index.js";

// #280: the normal approximation took the upper tail as 1 - pnorm(z), which is 0 beyond z ~ 8.3 (clinfun and DescTools
// also give 0). Below 1e-8 it is now pnorm(z, upper tail); elsewhere the same bits as before.
// References: Rmpfr's pnorm(-z) with z = (JT - mean) / sd at 200 bits (review_fix_log_issue280.md).
const ordered = (sizes: number[]): [number[], number[]] => {
  const x: number[] = [];
  const g: number[] = [];
  sizes.forEach((s, k) => {
    for (let i = 0; i < s; i++) {
      x.push(x.length + 1);
      g.push(k + 1);
    }
  });
  return [x, g];
};

describe("jonckheereTest small upper tail (#280)", () => {
  it("1:101 in groups of 34, 34, 33 (the issue)", () => {
    const [x, g] = ordered([34, 34, 33]);
    const ref = 1.4902389037944002e-26;
    for (const variant of ["DescTools", "clinfun"] as const) {
      const inc = jonckheereTest(x, g, { alternative: "increasing", variant }).pValue;
      expect(Math.abs(inc / ref - 1)).toBeLessThan(1e-13);
      expect(jonckheereTest(x, g, { variant }).pValue).toBe(2 * inc);
      expect(jonckheereTest(x, g, { alternative: "decreasing", variant }).pValue).toBe(1);
    }
  });

  it("1:102 in two groups of 51 (the issue's comment)", () => {
    const [x, g] = ordered([51, 51]);
    const inc = jonckheereTest(x, g, { alternative: "increasing" }).pValue;
    expect(Math.abs(inc / 1.6038302269514695e-18 - 1)).toBeLessThan(1e-13);
  });
});
