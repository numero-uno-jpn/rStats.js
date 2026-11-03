// Issue #228: hist density where the width of a cell with finite ends overflows (review_fix_log_issue228.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

/** A double from a hex float "0x1.<13 hex digits>p<e>" (as R's sprintf("%a")); both products are exact */
function fromHex(s: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(s)!;
  const v = (Number.parseInt(`1${m[2]}`, 16) * 2 ** -52) * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

describe("issue #228", () => {
  it("gives the density of a cell whose width overflows", () => {
    // R 4.5.2: hist(c(-1e308, 1e308), breaks = c(-1e308, 1e308), plot = FALSE)$density is 0; was 0 here.
    // Rmpfr (300 bits, the same doubles): 2 / (2 (1e308 + 1e308)) rounds to 0x1.cc359e067a348p-1025
    expect(hist([-1e308, 1e308], { breaks: [-1e308, 1e308] }).density).toEqual([fromHex("0x1.cc359e067a348p-1025")]);
    // 2 / (3 (1.6e308 + 1.7e308)) rounds to 0x1.73e2ec4da366p-1026 (Rmpfr); the other cells unchanged
    const h = hist([-1.5e308, 1.5e308, 1.68e308], { breaks: [-1.7e308, 1.6e308, 1.65e308, 1.7e308] });
    expect(h.counts).toEqual([2, 0, 1]);
    expect(h.density).toEqual([fromHex("0x1.73e2ec4da3660p-1026"), 0, 6.666666666666683e-308]);
  });

  it("keeps the densities of widths that do not overflow", () => {
    // values before the fix
    expect(hist([1, 2, 2, 3, 3, 3, 4]).density).toEqual([0.42857142857142855, 0.42857142857142855, 0.14285714285714285]);
    expect(hist([-1e300, 0.5e300, 1e300], { breaks: [-1e300, 0, 1e300] }).density).toEqual([
      3.333333333333333e-301, 6.666666666666666e-301,
    ]);
  });
});
