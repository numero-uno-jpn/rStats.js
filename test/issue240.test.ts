// Issue #240: distSummary("weibull") integrated the central moments in x, where X lies within O(1/k) of the scale:
// k = 1e4 gave the skewness -3.03 (true -1.139), k = 1e6 and above sd 0 and NaN. For shapes above 100 the moments now
// come from T = k expm1(log(e) / k) = k (X - 1), e ~ Exp(1) (review_fix_log_issue240.md). References: Rmpfr (4000 to
// 12000 bits) from the raw moments Gamma(1 + r/k).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const W = (shape: number, scale = 1) => distSummary("weibull", { shape, scale });
const rel = (x: number, y: number): number => Math.abs(x / y - 1);
/** Each field within 4e-15 relative of the reference: the last bits differ between Node versions and libms */
const expectClose = (got: object, want: Record<string, number>): void => {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const [k, v] of Object.entries(want)) expect(rel((got as Record<string, number>)[k]!, v), k).toBeLessThan(4e-15);
};

// shape, sd, skewness, excess kurtosis
const REF: [number, number, number, number][] = [
  [101, 0.012537378201057177, -1.0816413429186746, 2.128026843421789],
  [1000, 0.0012808757478713504, -1.1335927306601352, 2.371234264109682],
  [1e4, 0.00012823821100913089, -1.1389505609250348, 2.3971097566600896],
  [1e5, 1.2825330550312333e-5, -1.1394874345084645, 2.399710838377529],
  [1e6, 1.28254815261756e-6, -1.1395411328045157, 2.3999710824642744],
  [1e10, 1.2825498299941094e-10, -1.1395470988079874, 2.3999999971082313],
  [1e154, 1.282549830161865e-154, -1.1395470994046486, 2.4],
  [1e308, 1.282549830161865e-308, -1.1395470994046486, 2.4],
];

describe("issue #240", () => {
  it("gives the subnormal sd and the limiting skewness and kurtosis for shape 1e308", () => {
    const s = W(1e308);
    expect(s.mean).toBe(1);
    expect(s.variance).toBe(0);
    expect(rel(s.sd, 1.282549830161865e-308)).toBeLessThan(1e-14);
    expect(rel(s.skewness, -1.1395470994046486)).toBeLessThan(1e-14);
    expect(rel(s.kurtosis, 2.4)).toBeLessThan(1e-14);
  });

  it("agrees with Rmpfr for shapes above 100", () => {
    for (const [k, sd, sk, ku] of REF) {
      const s = W(k);
      expect(rel(s.sd, sd), `sd ${k}`).toBeLessThan(5e-15);
      expect(rel(s.skewness, sk), `skewness ${k}`).toBeLessThan(5e-14);
      expect(rel(s.kurtosis, ku), `kurtosis ${k}`).toBeLessThan(5e-14);
    }
  });

  it("scales the sd and variance with the scale", () => {
    const s = W(1e10, 1e160);
    expect(rel(s.sd, 1.2825498299941094e150)).toBeLessThan(5e-15);
    expect(rel(s.variance, 1.2825498299941094e150 ** 2)).toBeLessThan(1e-14);
    expect(rel(W(1e4, 2.5).sd, 2.5 * 0.00012823821100913089)).toBeLessThan(5e-15);
  });

  it("keeps the values for shapes up to 100", () => {
    expectClose(W(100), {
      mean: 0.994325851191506, variance: 0.00016030491620026098, sd: 0.012661157774874341, median: 0.9963415791820257,
      mode: 0.9998995016917583, skewness: -1.081073759807247, kurtosis: 2.1254458865865518,
    });
    expect(rel(W(50).skewness, -1.02485299116763)).toBeLessThan(4e-15);
    expect(rel(W(3.7, 2.5).kurtosis, -0.2775243017556308)).toBeLessThan(4e-15);
  });
});
