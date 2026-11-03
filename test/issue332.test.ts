// Issue #332: ecdf's binary search took its midpoint as (lo + hi) >> 1, which wraps to a negative index once lo + hi
// reaches 2^31 (an input of more than 2^31 values, 16 GB). Now Math.floor((lo + hi) / 2), the same index below 2^31.
// The large case is not allocated; the test checks the source and ordinary values (review_fix_log_issue332.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ecdf } from "../src/index.js";

const source = readFileSync(new URL("../src/descriptive/hist.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("export function ecdf("));

describe("issue #332", () => {
  it("has no 32-bit midpoint", () => {
    expect((2 ** 31 + 1) >> 1).toBeLessThan(0); // the old midpoint at lo = 0, hi = 2^31 + 1
    expect(body.slice(0, body.indexOf("\n}\n"))).not.toMatch(/\)\s*>>/);
  });

  it("leaves ordinary values unchanged", () => {
    const F = ecdf([3, 1, 2, 2, 5]);
    expect([0, 1, 2, 2.5, 5, 6].map(F)).toEqual([0, 0.2, 0.6, 0.6, 1, 1]);
  });
});
