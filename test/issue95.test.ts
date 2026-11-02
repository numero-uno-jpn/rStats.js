// Issue #95: dnbinom with mu where p = size / (size + mu) or q = mu / (size + mu) falls below the doubles
// (review_fix_log_issue95.md). The references are log P[X = x] from Rmpfr (3000 bits, the doubles passed as exact
// mantissas and exponents): lgamma(x + n) - lgamma(n) - lgamma(x + 1) + n log(n / (n + mu)) + x log(mu / (n + mu)).
import { describe, expect, it } from "vitest";
import { dnbinom } from "../src/index.js";

const MAX = Number.MAX_VALUE;
const MIN = Number.MIN_VALUE;

// [x, size, mu, log P]; the first block underflowed to 0 / -Inf (p or q was 0), the second was already right
const zeroRatio: [number, number, number, number][] = [
  [1, 1e-200, 1e200, -460.517018598809136821498],
  [0, 1e-200, 1e200, -9.210340371976182571085619e-198],
  [5, 1e-200, 1e200, -462.1264565112432371960988],
  [100000, 1e-200, 1e200, -472.029944063779365241588],
  [1, MAX, MIN, -744.4400719213812623141073], // R: the same
  [1, 1e300, 1e-300, -690.7755278982137051803383],
];
const others: [number, number, number, number][] = [
  [1, 1e-10, 1e300, -23.02585100132059468656314],
  [100, 1e-10, 1e300, -27.63102118679094830284333],
  [1, 1, MAX, -709.7827128933839967322234],
  [1e308, 1, 1e308, -710.1962086421660706885204],
  [3e307, 2, 1.7e308, -710.428084763967045055766],
  [1, 1e-160, 1e160, -368.413614879047309454242],
  [7, 0.00003, 2e299, -12.38113723812340874829723],
  [0, MAX, MIN, -4.940656458412465441765688e-324],
  [2, 1e300, 1e-10, -46.74484904054085891691267],
  [1e10, 1e300, 1e10, -12.43186399818323449520362],
  [1e10 + 3e5, 1e300, 1e10, -16.93183399863322659535287],
  [1, 1e-30, MIN, -744.4400719213812623141073],
  [0, 1e-30, MIN, -4.940656458412465441765688e-324],
  [3, 1e295, 50000, -49969.33242461599720566879],
];

function check([x, size, mu, ref]: [number, number, number, number]) {
  const label = `dnbinom(${x}, ${size}, { mu: ${mu} })`;
  const lg = dnbinom(x, size, { mu, log: true });
  // the log within 4e-15 relative (absolute below 1); the linear value within the rounding of exp(ref)
  expect(Math.abs(lg - ref) / Math.max(1, Math.abs(ref)), label).toBeLessThan(4e-15);
  const lin = dnbinom(x, size, { mu });
  const want = Math.exp(ref);
  if (want > 2.3e-308) expect(Math.abs(lin - want) / want, label).toBeLessThan(4e-15 + 2e-16 * Math.abs(ref));
}

describe("issue #95", () => {
  it("keeps the mass where p or q is below the doubles", () => zeroRatio.forEach(check));
  it("agrees with the references elsewhere", () => others.forEach(check));
  it("gives the subnormal mass mu itself (the log at MIN)", () => {
    expect(dnbinom(1, MAX, { mu: MIN })).toBe(MIN);
    expect(dnbinom(1, 1e-200, { mu: 1e200 })).toBeGreaterThan(0);
  });
});
