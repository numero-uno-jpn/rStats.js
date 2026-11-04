// Issue #502: the signed rank interval is formed from (x - mu) + mu, as in R. Where mu dwarfs the data that loses the
// observations (R: interval NaN NaN, estimate 0); the observations themselves are now taken there, when some
// observation is off by more than 2^-26 of the largest. The issue's example (1 ulp) keeps R's bits.
// R values: wilcox.test(..., conf.int = TRUE), printed with sprintf("%a").
import { describe, expect, it } from "vitest";
import { wilcoxTest } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

const ciEst = (x: number[], mu: number, exact?: boolean): number[] => {
  const r = wilcoxTest(x, { mu, confInt: true, ...(exact === undefined ? {} : { exact }) });
  return [r.confInt![0], r.confInt![1], r.estimate as number];
};

describe("issue #502: wilcoxTest's interval where mu dwarfs the data", () => {
  it("mu = 1e17: the interval of the observations (R: NaN NaN, estimate 0)", () => {
    // the differences all round to -mu (tied), so the normal approximation; the interval does not depend on mu:
    // R's wilcox.test(c(1, 2, 3, 4.5), conf.int = TRUE, exact = FALSE)
    expect(ciEst([1, 2, 3, 4.5], 1e17)).toEqual(["0x1.00044fa0e3e36p+0", "0x1.1ffeec17c7072p+2", "0x1.45f00c09478c2p+1"].map(fromHex));
    expect(wilcoxTest([1, 2, 3, 4.5], { mu: 1e17, confInt: true }).estimateNames).toBe("(pseudo)median");
  });

  it("mu = 1e16: the interval of the observations (R: [0, 8], estimate 3.9999)", () => {
    // R's wilcox.test(c(1, 2, 3, 4.5, 7), conf.int = TRUE, exact = FALSE)
    expect(ciEst([1, 2, 3, 4.5, 7], 1e16)).toEqual(["0x1.fffc30332a83dp+0", "0x1.4000288f033fep+2", "0x1.a000cf2984b6fp+1"].map(fromHex));
  });

  it("the issue's example keeps R's bits (the reconstruction is off by 1 ulp, as with ordinary data)", () => {
    // R: 0x1.f699d3249b3d7p+52 0x1.f699d3249b3dfp+52, estimate 0x1.f699d3249b3dbp+52
    expect(ciEst([8841848152503256, 8841848152503264], -5054035322351469, true)).toEqual([8841848152503255, 8841848152503263, 8841848152503259]);
  });

  it("ordinary data keep R's bits", () => {
    // (0.1 - 0.4) + 0.4 is 0.09999999999999998; R: 0x1.9999999999998p-4 0x1.8cccccccccccdp+1, 0x1.7333333333334p+0
    expect(ciEst([0.1, 0.7, 1.3, 2.2, 3.1], 0.4)).toEqual(["0x1.9999999999998p-4", "0x1.8cccccccccccdp+1", "0x1.7333333333334p+0"].map(fromHex));
  });
});
