// Revision of review 13: qr with tol = Inf is an error, as R's "NA/NaN/Inf in foreign function call"
// (review_fix_log_20261031_13_rev.md).
import { describe, expect, it } from "vitest";
import { qr, qrSolve } from "../src/index.js";

describe("review 13 revision: qr tol = Inf", () => {
  const m = [[1, 3], [2, 4]];
  it("rejects tol = Infinity in qr and qrSolve (R 4.5.2 stops for both)", () => {
    expect(() => qr(m, { tol: Infinity })).toThrow("'tol' must be a non-negative finite number");
    expect(() => qrSolve(m, [1, 2], { tol: Infinity })).toThrow("'tol' must be a non-negative finite number");
  });
  it("keeps finite tolerances (R 4.5.2: rank 0 for 1e300, 2 for 0)", () => {
    expect(qr(m, { tol: 1e300 }).rank).toBe(0);
    expect(qr(m, { tol: 0 }).rank).toBe(2);
  });
});
