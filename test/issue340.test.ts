// Issue #340: cut (binCode) and findInterval took their binary-search midpoints as (lo + hi) >> 1, which wraps to a
// negative index once lo + hi reaches 2^31 (more than 2^31 breaks, 16 GB). Now Math.floor((lo + hi) / 2), the same
// index below 2^31. The large case is not allocated; the test checks the source and ordinary values
// (review_fix_log_issue340.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cut, findInterval } from "../src/index.js";

const source = readFileSync(new URL("../src/descriptive/table.ts", import.meta.url), "utf8");
const bodyOf = (head: string) => {
  const rest = source.slice(source.indexOf(head));
  return rest.slice(0, rest.indexOf("\n}\n"));
};

describe("issue #340", () => {
  it("has no 32-bit midpoint", () => {
    expect((2 ** 31 + 1) >> 1).toBeLessThan(0);
    expect(bodyOf("function binCode(")).not.toMatch(/\)\s*>>/);
    expect(bodyOf("export function findInterval(")).not.toMatch(/\)\s*>>/);
  });

  it("leaves ordinary values unchanged", () => {
    expect(findInterval([0, 1.5, 3, 5], [1, 2, 3])).toEqual([0, 1, 3, 3]);
    expect(findInterval([1, 2, 2.5], [1, 2, 3], { leftOpen: true })).toEqual([0, 1, 2]);
    expect(cut([1, 2.5, 4, 6], [0, 2, 4, 6])).toEqual([1, 2, 2, 3]);
    expect(cut([0, 2, 4], [0, 2, 4, 6], { right: false })).toEqual([1, 2, 3]);
  });
});
