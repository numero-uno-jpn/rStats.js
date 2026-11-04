// Issue #513: the swap in the Tukey quantile's Brent solver (a = b; b = c; c = a, likewise fa, fb, fc) is the
// sequential form of Brent (1973) and R's zeroin, not a broken rotation. Not reproduced: qtukey round-trips through
// ptukey.
import { describe, expect, it } from "vitest";
import { ptukey, qtukey } from "../src/index.js";

describe("issue 513", () => {
  it("qtukey(0.95, 3, 12) is R's value and round-trips exactly", () => {
    const q = qtukey(0.95, 3, 12);
    // R 4.5.2: 3.772929 (R uses a secant search, so only near agreement is expected)
    expect(q).toBeCloseTo(3.772929, 6);
    expect(ptukey(q, 3, 12)).toBe(0.95);
  });
  it("qtukey round-trips in the centre and the lower tail", () => {
    expect(ptukey(qtukey(0.5, 5, 7), 5, 7)).toBe(0.5);
    const p = 1e-10;
    expect(Math.abs(ptukey(qtukey(p, 3, 20), 3, 20) - p) / p).toBeLessThan(1e-14);
  });
});
