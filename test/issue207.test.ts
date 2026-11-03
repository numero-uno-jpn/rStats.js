// Issue #207: expm "Higham08" where the scaling before the Padé approximant loses an entry (review_fix_log_issue207.md).
import { describe, expect, it } from "vitest";
import { expm } from "../src/index.js";

describe('issue #207: expm(method = "Higham08") with an entry lost in the scaling', () => {
  it("gives exp(A) = cosh(1) I + sinh(1) A, as Higham08.b (was [[1, 1e308], [0, 1]], R too)", () => {
    const A = [
      [0, 1e308],
      [1e-308, 0],
    ];
    const e = expm(A, { method: "Higham08" });
    // R's expm(..., "Higham08.b") to the bit: 0x1.8b07551d9f55p+0, 0x1.4eb55a5e75e35p+1023, 0x1.0e6b5a119c032p-1023,
    // 0x1.8b07551d9f551p+0 (Rmpfr: cosh 1 = 0x1.8b07551d9f55p+0, the off-diagonal 0x1.4eb55a5e75e34p+1023 and
    // 0x1.0e6b5a119c032p-1023)
    expect(e).toEqual([
      [1.5430806348152437, 1.1752011936438017e308],
      [1.1752011936438015e-308, 1.543080634815244],
    ]);
    expect(e).toEqual(expm(A, { method: "Higham08.b" }));
  });

  it("also at 1e+-200 and in a larger matrix", () => {
    const A = [
      [0, 1e200],
      [1e-200, 0],
    ];
    const e = expm(A, { method: "Higham08" });
    // R's Higham08.b: 0x1.8909d9a1c7075p+664 and 0x1.cc92e9dfc90b4p-665 off the diagonal (Rmpfr agrees)
    expect(e).toEqual([
      [1.5430806348152437, 1.1752011936438014e200],
      [1.1752011936438015e-200, 1.543080634815244],
    ]);
    expect(e).toEqual(expm(A, { method: "Higham08.b" }));
    const B = [
      [0, 1e300, 0],
      [1e-300, 0, 0],
      [0, 0, 1000],
    ];
    expect(expm(B, { method: "Higham08" })).toEqual(expm(B, { method: "Higham08.b" }));
  });

  it("does not balance other matrices", () => {
    expect(expm([[1, 2], [3, 4]], { method: "Higham08" })).toEqual([
      [51.968956198705044, 74.73656456700327],
      [112.10484685050491, 164.07380304920997],
    ]);
    // 1e-290 / 2^31 stays in the normal range: not balanced
    expect(expm([[0, 1e10], [1e-290, 0]], { method: "Higham08" })).toEqual([
      [1, 1e10],
      [1e-290, 1],
    ]);
  });

  it("also balances where an entry would only become subnormal", () => {
    // 1e-300 / 2^31 and 1e-310 / 2^31 are subnormal: the lower-left entry (about 1e-300, 1e-310) was
    // 9.999999999999853e-301 and 9.999905164924e-311 before; now as Higham08.b
    for (const t of [1e-300, 1e-310]) {
      const A = [
        [0, 1e10],
        [t, 0],
      ];
      expect(expm(A, { method: "Higham08" })).toEqual(expm(A, { method: "Higham08.b" }));
    }
    expect(expm([[0, 1e10], [1e-310, 0]], { method: "Higham08" })[1]![0]).toBe(1e-310);
  });
});
