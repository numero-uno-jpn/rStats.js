// Issue #487: lbfgsb is internal; optim's L-BFGS-B passes it n = par.length and lmm rounded to max(trunc, 0), so the
// negative dimensions of the issue never reach it (review_fix_log_issue487.md).
import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import { optim } from "../src/index.js";

describe("issue #487", () => {
  const fn = (p: number[]) => p.reduce((s, v) => s + v * v, 0);

  it("lbfgsb is not exported", () => {
    expect("lbfgsb" in api).toBe(false);
  });

  it("empty par and negative lmm give L-BFGS-B's messages as R", () => {
    // R 4.5.2: optim(numeric(0), fn, method = "L-BFGS-B") gives convergence 0, "NOTHING TO DO";
    // control = list(lmm = -5) gives par c(1, 2), value 0, convergence 52, "ERROR: M .LE. 0"
    const r0 = optim([], fn, { method: "L-BFGS-B" });
    expect([r0.par, r0.convergence, r0.message]).toEqual([[], 0, "NOTHING TO DO"]);
    for (const lmm of [-5, -1e9]) {
      const r = optim([1, 2], fn, { method: "L-BFGS-B", control: { lmm } });
      expect([r.par, r.value, r.convergence, r.message]).toEqual([[1, 2], 0, 52, "ERROR: M .LE. 0"]);
    }
  });
});
