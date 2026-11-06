import { describe, expect, it } from "vitest";
import { pgamma } from "../src/index.js";

// pgamma near x = a (Temme's expansion in xsf's region) and with a tiny shape (1.2.0). In xsf's region the tail was
// formed from erfc and e^(-a η^2 / 2) of a rounded η, up to about 35 eps off (pgamma(256.71, 199, upper) 22 eps,
// R 0.2 eps); now the smaller tail comes from the double-double deviance as beyond that region. With a tiny shape the
// Poisson factor x^a e^-x / Gamma(a + 1) lost up to about 50 eps (pgamma(100, 1e-100, upper) 51 eps, R 52 eps).
// References: mpmath with 200 bits ([q, shape, lower tail, value])
const REFERENCES: [number, number, boolean, number][] = [
  [256.71, 199, false, 0.000080188098915125332528],
  [1138.0706295376563, 999, false, 0.000012140406796586293771],
  [376.21023553303064, 300, false, 0.000021262867258515619014],
  [19980322.601798, 20000000.0, true, 5.3784929661789062582e-6],
  [150, 160, true, 0.21735087037389576976],
  [1030, 1000, false, 0.17108809611760603914],
  [100, 1e-100, false, 3.6835977616820322539e-146],
  [30, 1e-08, false, 3.021552131845469815e-23],
  [2, 0.001, false, 0.000048976917830981479821],
];

const relativeError = (v: number, e: number) => Math.abs(v - e) / Math.abs(e);

describe("pgamma near x = a and with a tiny shape", () => {
  it("is within a few eps of the true value", () => {
    for (const [q, shape, lowerTail, value] of REFERENCES) {
      const ctx = `pgamma(${q}, ${shape}, lowerTail ${lowerTail})`;
      expect(relativeError(pgamma(q, shape, { lowerTail }), value), ctx).toBeLessThan(5 * 2 ** -52);
      const logValue = pgamma(q, shape, { lowerTail, logP: true });
      expect(relativeError(logValue, Math.log(value)), ctx).toBeLessThan(5 * 2 ** -52);
    }
  });
});
