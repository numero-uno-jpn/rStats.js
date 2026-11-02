// Issue #101: roundR forms 10^k by squaring, as R's round, so that large digit counts round as in R
// (review_fix_log_issue101.md). Expected: R 4.5.2's round (inputs as hexadecimal float literals, results by
// sprintf("%a"), so that Windows R's decimal conversions do not enter).
import { describe, expect, it } from "vitest";
import { roundR } from "../src/internal/fround.js";

// [x, digits, R's round(x, digits)]; repeated multiplication by 10 gave other values for each of these
const cases: [number, number, number][] = [
  [4.202163187357369e-87, 100, 4.202163187357399e-87], // the issue's
  [3.720925911927848e25, -25, 4e25], // the issue's comment
  [-3.720925911927848e25, -25, -4e25],
  [-4.002467634492424e-281, 294, -4.002467634492398e-281],
  [3.031032394839535e-166, 179, 3.031032394839499e-166],
  [3.2303265402619228e-173, 183, 3.230326540299999e-173],
  [-2.9741199079075182e-255, 267, -2.9741199079079986e-255],
  [-7.772704381683428e-45, 57, -7.772704381682999e-45],
  [1.017336103196581e-139, 150, 1.0173361031999996e-139],
  [6.73543146686443e-205, 218, 6.735431466864397e-205],
  [4.55567521172121e-229, 242, 4.5556752117211976e-229],
  [4.7960991307718236e-219, 228, 4.796099130999998e-219],
  [2.4657298010048905e-129, 139, 2.4657298009999994e-129],
  [-2.0614542289889665e-87, 96, -2.0614542289999995e-87],
  [-1.5913555357636767e-297, 311, -1.5913555357636788e-297],
  [1.7487325677572569e-22, 34, 1.748732567757e-22],
  [1.939476570355031e-51, 60, 1.93947657e-51],
  [-1.092869822281451e-306, 320, -1.0928698222814493e-306],
];

describe("issue #101", () => {
  it("rounds large digit counts as R", () => {
    for (const [x, d, want] of cases) expect(roundR(x, d), `round(${x}, ${d})`).toBe(want);
  });

  it("keeps the small digit counts (exact powers of 10)", () => {
    expect(roundR(2.5)).toBe(2);
    expect(roundR(1.005, 2)).toBe(1);
    expect(roundR(123.456, -1)).toBe(120);
    expect(roundR(0.125, 2)).toBe(0.12);
  });
});
