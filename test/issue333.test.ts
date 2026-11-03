// Issue #333: hist's cell lookup (cellOf) took its midpoints as (a + b) >> 1 and (a + b + 1) >> 1, which wrap to a
// negative index once the sum reaches 2^31 (more than 2^31 breaks, 16 GB). Now Math.floor of the halved sum, the same
// index below 2^31. The large case is not allocated; the test checks the source and ordinary counts
// (review_fix_log_issue333.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

const source = readFileSync(new URL("../src/descriptive/hist.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("function cellOf("));

describe("issue #333", () => {
  it("has no 32-bit midpoint", () => {
    expect((2 ** 31 + 2) >> 1).toBeLessThan(0);
    expect(body.slice(0, body.indexOf("\n}\n"))).not.toMatch(/\)\s*>>/);
  });

  it("leaves ordinary counts unchanged", () => {
    const x = [0, 1, 1.5, 2, 2, 3, 4.5, 5];
    expect(hist(x, { breaks: [0, 1, 2, 3, 4, 5] }).counts).toEqual([2, 3, 1, 0, 2]);
    expect(hist(x, { breaks: [0, 1, 2, 3, 4, 5], right: false }).counts).toEqual([1, 2, 2, 1, 2]);
  });
});
