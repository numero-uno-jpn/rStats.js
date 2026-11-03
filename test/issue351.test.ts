// Issue #351: contr.poly from the QR of the powers of the scores lost its high-degree columns for many levels
// (review_fix_log_issue351.md).
import { describe, expect, it } from "vitest";
import { contrastMatrix } from "../src/models/modelMatrix.js";

const poly = (k: number): number[][] => contrastMatrix(Array.from({ length: k }, (_, i) => `L${i + 1}`), "contr.poly").m;

/** The degree k - 1 column, exactly: proportional to (-1)^(k-1-i) choose(k - 1, i), with norm 1 */
function highestDegree(k: number): number[] {
  const c: number[] = [1];
  for (let i = 1; i < k; i++) c.push((c[i - 1]! * (k - i)) / i); // exact below 2^53
  const norm = Math.sqrt(c.reduce((s, v) => s + v * v, 0));
  return c.map((v, i) => ((k - 1 - i) % 2 === 0 ? v : -v) / norm);
}

describe("issue #351: contr.poly by the recurrence", () => {
  it("gives the highest-degree column for 23, 24 and 40 levels (was another vector: errors 0.89 to 0.96; R the same)", () => {
    for (const k of [16, 20, 23, 24, 40]) {
      const m = poly(k);
      const exact = highestDegree(k);
      m.forEach((row, i) => expect(Math.abs(row[k - 2]! - exact[i]!)).toBeLessThan(2e-15));
    }
  });

  it("keeps the columns orthonormal and orthogonal to the constant for 60 levels", () => {
    const k = 60;
    const m = poly(k);
    for (let a = 0; a < k - 1; a++) {
      expect(Math.abs(m.reduce((s, row) => s + row[a]!, 0))).toBeLessThan(1e-14);
      for (let b = a; b < k - 1; b++) {
        const d = m.reduce((s, row) => s + row[a]! * row[b]!, 0);
        expect(Math.abs(d - (a === b ? 1 : 0))).toBeLessThan(1e-14);
      }
    }
  });

  it("gives 15 levels and fewer by the recurrence too (the QR was off by up to 2.8e-13 at 14 levels)", () => {
    for (let k = 3; k <= 15; k++) {
      const m = poly(k);
      const exact = highestDegree(k);
      m.forEach((row, i) => expect(Math.abs(row[k - 2]! - exact[i]!)).toBeLessThan(2e-15));
    }
    expect(poly(3)).toEqual([
      [-0.7071067811865476, 0.408248290463863],
      [0, -0.8164965809277259],
      [0.7071067811865476, 0.408248290463863],
    ]);
  });
});
