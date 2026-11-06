import { describe, expect, it } from "vitest";
import { pchisq, pgamma } from "../src/index.js";

// The continued fraction of the upper tail Q(a, x) (src/special/igam.ts) for a < 4 and 1.1 < x < 64 is evaluated in
// double-double since 1.2.0: in double its rounding errors added up to about 120 eps relative (pchisq(2.3569, 1,
// lower = FALSE) was 45 eps off; R 4.6.2 is 25 eps off there). References: mpmath with 200 bits
// ([df, q, upper tail of the chi-squared distribution])
const REFERENCES: [number, number, number][] = [
  [1, 2.3569217160548437, 0.12472809637492107097],
  [0.5, 2.54531, 0.045759387661271453861],
  [1, 2.90781, 0.088151501592694708742],
  [1.5, 2.39376, 0.2075536712348952256],
  [0.2, 4.47257, 0.0041459345138678295793],
  [3, 4.07965, 0.25299082177533646673],
  [5, 6.93678, 0.22538468222012635082],
  [7, 8.44277, 0.29517308897177765024],
  [0.02, 3.1, 0.00094145761683782873711],
  [0.002, 12.5, 2.7116235591640015023e-7],
  [6, 9.5, 0.14734918392814830083],
  [7.9, 40, 2.9277597562567821834e-6],
  [1, 100, 1.5239706048321052132e-23],
  [0.5, 126, 5.3149513082192456871e-30],
];

const relativeError = (v: number, e: number) => Math.abs(v - e) / Math.abs(e);

describe("pgamma's upper tail by the continued fraction", () => {
  it("is within a few eps of the true value for small shapes (#pchisq 1.2.0)", () => {
    for (const [df, q, upper] of REFERENCES) {
      // 4 eps: the continued fraction within 1 eps, the factor x^a e^-x / Gamma(a + 1) within about 3 eps
      expect(relativeError(pchisq(q, df, { lowerTail: false }), upper), `pchisq(${q}, ${df})`).toBeLessThan(4 * 2 ** -52);
      expect(relativeError(pgamma(q / 2, df / 2, { lowerTail: false }), upper), `pgamma(${q / 2}, ${df / 2})`).toBeLessThan(
        4 * 2 ** -52,
      );
    }
  });

  it("gives the log of the upper tail and the lower tail consistently", () => {
    for (const [df, q, upper] of REFERENCES) {
      const logQ = pchisq(q, df, { lowerTail: false, logP: true });
      expect(relativeError(logQ, Math.log(upper)), `log pchisq(${q}, ${df})`).toBeLessThan(4 * 2 ** -52);
      // the lower tail 1 - Q: an absolute error of a few eps
      expect(Math.abs(pchisq(q, df) - (1 - upper)), `pchisq(${q}, ${df}) lower`).toBeLessThan(4 * 2 ** -52);
    }
  });
});
