// Issue #502: R 4.5 formed the signed rank interval from (x - mu) + mu, which loses the observations where mu dwarfs
// the data (R 4.5.2: interval NaN NaN, estimate 0), and rStats.js took the observations themselves there. R 4.6
// searches the observations themselves, so these are now R's values.
// R values: R 4.6.2's wilcox.test(..., conf.int = TRUE), printed with sprintf("%a").
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
  it("mu = 1e17: the interval of the observations (R 4.5.2: NaN NaN, estimate 0)", () => {
    // the differences all round to -mu (tied); the normal interval does not depend on mu (as with mu = 0)
    expect(ciEst([1, 2, 3, 4.5], 1e17, false)).toEqual(["0x1.00044fa0e3e36p+0", "0x1.1ffeec17c7072p+2", "0x1.45f00c09478c2p+1"].map(fromHex));
    expect(wilcoxTest([1, 2, 3, 4.5], { mu: 1e17, confInt: true, exact: false }).estimateNames).toBe("(pseudo)median");
  });

  it("mu = 1e16: the interval of the observations (R 4.5.2: [0, 8], estimate 3.9999)", () => {
    expect(ciEst([1, 2, 3, 4.5, 7], 1e16, false)).toEqual(["0x1.fffc30332a83dp+0", "0x1.4000288f033fep+2", "0x1.a000cf2984b6fp+1"].map(fromHex));
  });

  it("the issue's example: the Walsh averages of the observations", () => {
    // R 4.6.2: (-Inf, Inf) (n = 2 reaches no level), estimate 0x1.f699d3249b3dcp+52
    expect(ciEst([8841848152503256, 8841848152503264], -5054035322351469, true)).toEqual([-Infinity, Infinity, 8841848152503260]);
  });

  it("ordinary data: R's values", () => {
    // (the estimate's root is 1 ulp from R's, for every mu, mu = 0 included: uniroot's last step)
    const r = ["0x1.665dd2c2b24bcp-1", "0x1.1999fc2389cd6p+1", "0x1.733636f83fcdep+0"].map(fromHex);
    ciEst([0.1, 0.7, 1.3, 2.2, 3.1], 0.4, false).forEach((v, i) => expect(Math.abs(v - r[i]!)).toBeLessThanOrEqual(2 ** -51 * r[i]!));
    expect(ciEst([0.1, 0.7, 1.3, 2.2, 3.1], 0.4, true)).toEqual([-Infinity, Infinity, fromHex("0x1.7333333333334p+0")]);
  });
});
