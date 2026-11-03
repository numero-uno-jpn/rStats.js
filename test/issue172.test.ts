// Issue #172: glmAnova's Rao statistic where v (r - centre)^2 overflows (a Poisson fit with fitted means below about
// 1e-154 at y = 1). The total is formed again from sqrt(v) (r - centre), as the residual sum of squares.
import { describe, expect, it } from "vitest";
import { glm, glmAnova } from "../src/index.js";

const rao = (o: number) => {
  const y = [1, 0, 0, 0];
  const offset = [o, o, o, o];
  const x = y.map(() => []);
  const f0 = glm(x, y, { family: "poisson", intercept: false, offset });
  const f1 = glm(x, y, { family: "poisson", intercept: true, offset });
  return glmAnova([f0, f1], { test: "Rao" }).table[1]!;
};

describe("issue #172", () => {
  it("the score statistic of an intercept added to an offset-only Poisson model is finite", () => {
    // (1 - 4 mu)^2 / (4 mu), mu = e^offset (Rmpfr)
    for (const [o, ref] of [
      [-460, 1.4907392428523152e199], // 0x1.8edac1ace3095p+661
      [-700, 2.5355801368375113e303], // 0x1.d945df4f8ec8ep+1007
    ] as const) {
      const t = rao(o);
      expect(Math.abs(t[4]! / ref - 1)).toBeLessThan(1e-14);
      expect(t[5]).toBe(0);
    }
  });

  it("a total that does not overflow keeps its value", () => {
    // the value before the change
    expect(rao(-40)[4]).toBe(58846316709254940);
  });
});
