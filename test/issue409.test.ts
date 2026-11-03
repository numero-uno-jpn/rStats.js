// Issue #409: rgamma with shape < 1 where the unit variate p^(1/a) underflows although a large scale brings the
// variate back into range, and rinvgamma = 1 / rgamma1(alpha, 1 / beta) built on it. R 4.5.2 (extraDistr 1.10),
// set.seed(1): rgamma(1, 0.001, scale = 2^1023) is 0 and rinvgamma(1, 0.001, 2^-1023) Inf (2 uniforms drawn). With
// p = 0x1.0ffb1ba2ca906p-2 (the GS step), Rmpfr: 2^1023 p^1000 = 1.5563963702389774598e-268 (0x1.48e4ef4a2813ap-890),
// its reciprocal 6.4250985103907343855e+267 (0x1.8e85f08bec418p+889); 2^900 p^1000 = 0x1.48e4ef4a2813ap-1013
// (review_fix_log_issue409.md).
import { describe, expect, it } from "vitest";
import { rgamma, rinvgamma, runif, setSeed } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

setSeed(1);
const u = runif(10);

/** The result and the number of uniforms drawn */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #409", () => {
  it("gives the variate in range where p^(1/a) underflows, with R's draws", () => {
    expect(run(() => rgamma(1, 0.001, { scale: 2 ** 1023 }))).toEqual({
      values: [hex("0x1.48e4ef4a2813ap-890")],
      drawn: 2,
    });
    expect(run(() => rgamma(1, 0.001, { scale: 2 ** 900 }))).toEqual({
      values: [hex("0x1.48e4ef4a2813ap-1013")],
      drawn: 2,
    });
    expect(run(() => rinvgamma(1, 0.001, { beta: 2 ** -1023 }))).toEqual({
      values: [hex("0x1.8e85f08bec418p+889")],
      drawn: 2,
    });
  });

  it("keeps a true underflow and values in range", () => {
    expect(run(() => rgamma(1, 0.001, { scale: 2 ** 500 }))).toEqual({ values: [0], drawn: 2 });
    expect(run(() => rgamma(1, 0.001))).toEqual({ values: [0], drawn: 2 });
    expect(run(() => rinvgamma(1, 0.001))).toEqual({ values: [Infinity], drawn: 2 });
    const r = run(() => rgamma(3, 0.01));
    expect(r.drawn).toBe(8);
    expect(r.values[0]! / 1e-58).toBeCloseTo(3.692704, 6);
  });
});
