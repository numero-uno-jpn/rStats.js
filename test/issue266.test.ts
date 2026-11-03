// Issue #266: polychor where the total of the table overflows, or the log-likelihood does (review_fix_log_issue266.md).
import { describe, expect, it } from "vitest";
import { polychor } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);
const T = [
  [20, 10, 5],
  [8, 15, 12],
  [3, 9, 18],
];

describe("issue #266", () => {
  it("gives the thresholds and rho of the table in proportion where the total overflows", () => {
    // the issue's table: equal proportions, rho 0 as for [[1, 1], [1, 1]]; was 0.9998590004758731 (R 0.999859,
    // with "Inf replaced by maximum positive value")
    const same = polychor([[1, 1], [1, 1]]).rho;
    expect(polychor([[8e307, 8e307], [8e307, 8e307]]).rho).toBe(same);
    // the total 1.6e308 is finite, the log-likelihood about -2.2e308 is not
    expect(polychor([[4e307, 4e307], [4e307, 4e307]]).rho).toBe(same);
  });

  it("multiplies the variances, the chi-square and n back", () => {
    const big = polychor([[8e307, 8e307], [8e307, 8e307]], { ML: true, stdErr: true });
    const unit = polychor([[1, 1], [1, 1]], { ML: true, stdErr: true });
    expect(Math.abs(big.rho)).toBeLessThan(1e-15);
    expect(big.rowCuts[0]!).toBeCloseTo(0, 15);
    expect(big.colCuts[0]!).toBeCloseTo(0, 15);
    // the variances in 1 / n: those of the table of 1s times 4 / 3.2e308 (formed as 2 / 1.6e308)
    expect(rel(big.var[0]![0]!, (unit.var[0]![0]! * 2) / 1.6e308)).toBeLessThan(1e-12);
    expect(rel(big.var[1]![1]!, (unit.var[1]![1]! * 2) / 1.6e308)).toBeLessThan(1e-12);
    // a saturated table: only the four terms n log(1 + 1e-6 / n), about 2e-6 each in the chi-square
    expect(rel(big.chisq, 8e-6)).toBeLessThan(1e-9);
    expect(big.n).toBe(Infinity);
  });

  it("leaves the other cases as before", () => {
    expect(polychor(T).rho).toBe(0.5646836056792304);
    expect(polychor(T.map((r) => r.map((v) => v * 2 ** 990))).rho).toBe(0.5646836056792304);
    expect(polychor(T.map((r) => r.map((v) => v * 2 ** 1015))).rho).toBe(0.5646836056792304);
    expect(polychor([[3e307, 1e307], [1e307, 3e307]]).rho).toBe(0.7071100150710427);
    const se = polychor(T, { ML: true, stdErr: true });
    expect(se.rho).toBe(0.5652381231965001);
    expect(se.var[0]![0]!).toBe(0.008534270644865937);
    expect(se.chisq).toBe(0.5508583744892291);
    expect(se.n).toBe(100);
  });
});
