import { describe, expect, it } from "vitest";
import { Anova, lm } from "../src/index.js";

// #347: car's Anova formed the sum of the weights and the weighted sums of squares in the units of the weights, which
// overflowed for five weights of 1e308; the weights are now divided by an even power of 2 there
describe("Anova where a sum over the weights overflows (#347)", () => {
  const d = { x: [0, 1, 2, 3, 4], y: [1e-154, 2e-154, 1e-154, 3e-154, 1e-154] };
  const fit = lm("y ~ x", d, { weights: [1e308, 1e308, 1e308, 1e308, 1e308] });
  const rel = (a: number, b: number): number => Math.abs(a / b - 1);

  // exact rational values (Python Fraction on the doubles): SS x 0.10000000000000006, RSS 3.1000000000000005,
  // F 0.09677419354838714, SS (Intercept) 3.2666666666666666
  it("type II: SS 0.1, F 0.0968 (was 'residual sum of squares is 0'; car 'computationally singular')", () => {
    const t = Anova(fit, { type: 2 }).table;
    expect(rel(t[0]![0]!, 0.10000000000000006)).toBeLessThan(1e-14);
    expect(rel(t[0]![2]!, 0.09677419354838714)).toBeLessThan(1e-14);
    expect(rel(t[1]![0]!, 3.1000000000000005)).toBeLessThan(1e-14);
  });

  it("type III: the intercept SS 3.27", () => {
    const t = Anova(fit, { type: 3 }).table;
    expect(rel(t[0]![0]!, 3.2666666666666666)).toBeLessThan(1e-14);
    expect(rel(t[1]![0]!, 0.10000000000000006)).toBeLessThan(1e-14);
  });

  it("F and p equal those of the unweighted fit", () => {
    const u = Anova(lm("y ~ x", d), { type: 2 }).table;
    const t = Anova(fit, { type: 2 }).table;
    expect(rel(t[0]![3]!, u[0]![3]!)).toBeLessThan(1e-14);
  });
});
