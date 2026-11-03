// Issue #436: pivotLonger reads namesTransform from own properties only (review_fix_log_issue436.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

const col = (o: object, name: string) => Object.getOwnPropertyDescriptor(o, name)!.value as unknown[];

describe("issue #436", () => {
  it("does not take inherited properties as transforms", () => {
    // tidyr::pivot_longer(names_transform = list()) leaves the names: valueOf, toString and constructor are "score"
    for (const to of ["valueOf", "toString", "constructor"]) {
      const out = pivotLonger({ id: [1], score: [2] }, { cols: ["score"], namesTo: to, namesTransform: {} });
      expect(col(out, to)).toEqual(["score"]);
    }
  });

  it("uses own transforms as before", () => {
    // tidyr: names_transform = list(constructor = toupper) gives "SCORE"
    const out = pivotLonger(
      { id: [1], score: [2] },
      { cols: ["score"], namesTo: "constructor", namesTransform: { constructor: (p: string) => p.toUpperCase() } },
    );
    expect(col(out, "constructor")).toEqual(["SCORE"]);
  });
});
