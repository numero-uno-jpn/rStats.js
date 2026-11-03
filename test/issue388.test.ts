import { describe, expect, it } from "vitest";
import { lm } from "../src/index.js";

// #388: with the weights divided by 2^kw for the sums of squares, a positive weight could underflow to 0 and its row
// left the residual sum of squares
describe("lm: rss and sigma with a weight that underflows on the common scale (#388)", () => {
  it("weights 1e308 and 5e-324: sigma 2^-537 (R 0x1p-537), rss 5e-324 (was 0)", () => {
    const m = lm([[1], [0]], [0, 1], { intercept: false, weights: [1e308, Number.MIN_VALUE] });
    expect(m.sigma).toBe(2 ** -537);
    const f = lm("y ~ 0 + x", { x: [1, 0], y: [0, 1] }, { weights: [1e308, Number.MIN_VALUE] });
    expect(f.sigma).toBe(2 ** -537);
    expect(f.rss).toBe(Number.MIN_VALUE);
  });

  it("two residual df: sigma sqrt(2^-1075) (R 0: rss / df underflows there)", () => {
    const f = lm("y ~ x", { x: [0, 1, 2, 3], y: [0, 1, 2, 4] }, { weights: [1e308, 1e308, 1e308, Number.MIN_VALUE] });
    expect(f.sigma).toBe(Math.SQRT1_2 * 2 ** -537);
  });

  it("a small weight whose term is negligible: unchanged", () => {
    const f = lm("y ~ 0 + x", { x: [1, 0, 1], y: [0, 1, 2] }, { weights: [1e308, 1e-300, 1] });
    expect(f.sigma).toBe(1.4142135623730951);
  });
});
