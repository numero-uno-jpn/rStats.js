// Issue #352: mergeTiedTimes took its binary-search midpoint as (lo + hi + 1) >> 1, which wraps to a negative index once
// the sum reaches 2^31 (more than 2^31 distinct times, 16 GB). Now Math.floor((lo + hi + 1) / 2), the same index below
// 2^31. The large case is not allocated; the test checks the source and ordinary values (review_fix_log_issue352.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeTiedTimes } from "../src/models/tiedTimes.js";

const source = readFileSync(new URL("../src/models/tiedTimes.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("export function mergeTiedTimes("));

describe("issue #352", () => {
  it("has no 32-bit midpoint", () => {
    expect((2 ** 31 + 1) >> 1).toBeLessThan(0);
    expect(body.slice(0, body.indexOf("\n}\n"))).not.toMatch(/\)\s*>>/);
  });

  it("leaves ordinary values unchanged", () => {
    expect(mergeTiedTimes([3, 1 + 1e-10, 1, 2, Infinity, 3, 5])).toEqual([3, 1, 1, 2, Infinity, 3, 5]);
  });
});
