// Issue #259: hist density where n times a finite cell width overflows (review_fix_log_issue259.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

/** A double from a hex float "0x1.<13 hex digits>p<e>" (as R's sprintf("%a")); both products are exact */
function fromHex(s: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(s)!;
  const v = (Number.parseInt(`1${m[2]}`, 16) * 2 ** -52) * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

describe("issue #259", () => {
  it("gives the density where n times the cell width overflows", () => {
    // R 4.5.2: hist(c(0, 1e308), breaks = c(0, 1e308), plot = FALSE)$density is 0; was 0 here.
    // Rmpfr (300 bits, the same doubles): 2 / (2 1e308) rounds to 0x1.cc359e067a348p-1024
    expect(hist([0, 1e308], { breaks: [0, 1e308] }).density).toEqual([fromHex("0x1.cc359e067a348p-1024")]);
    expect(hist([1, 2, 3, 4, 1e308], { breaks: [0, 1e308] }).density).toEqual([fromHex("0x1.cc359e067a348p-1024")]);
    // 10 / (10 3e307) (a normal result): 0x1.7f8203b010812p-1022 (Rmpfr)
    const x = Array.from({ length: 10 }, (_, i) => i * 3e306);
    expect(hist(x, { breaks: [0, 3e307] }).density).toEqual([fromHex("0x1.7f8203b010812p-1022")]);
    // 2 / (3 0.5e308) and 1 / (3 (0.9e308 - 0.5e308)): 0x1.32ce6959a6cdcp-1023, 0x1.7f8203b010810p-1024 (Rmpfr)
    expect(hist([0, 0.5e308, 0.8e308], { breaks: [0, 0.5e308, 0.9e308] }).density).toEqual([
      fromHex("0x1.32ce6959a6cdcp-1023"),
      fromHex("0x1.7f8203b010810p-1024"),
    ]);
    // a width that overflows itself (#228), with one value per cell (#258): 1 / (2 1e308) each
    expect(hist([-1e308, 1e308], { breaks: [-1e308, 0, 1e308] }).density).toEqual([
      fromHex("0x1.cc359e067a348p-1025"),
      fromHex("0x1.cc359e067a348p-1025"),
    ]);
  });

  it("keeps the densities where n times the width is finite", () => {
    // values before the fix
    expect(hist([0, 1e300], { breaks: [0, 1e300] }).density).toEqual([1e-300]);
    expect(hist([1, 2, 2, 3, 3, 3, 4]).density).toEqual([0.42857142857142855, 0.42857142857142855, 0.14285714285714285]);
  });
});
