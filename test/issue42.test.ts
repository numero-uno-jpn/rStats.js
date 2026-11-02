// Issue #42: chisqTest sorts factor levels by code point, not by UTF-16 code unit (review_fix_log_issue42.md).
import { describe, expect, it } from "vitest";
import { chisqTest } from "../src/index.js";

describe("issue #42", () => {
  it("puts U+E000 before U+10000", () => {
    // U+10000 is the surrogate pair D800 DC00, which sorted before E000 by code unit
    const r = chisqTest(["\u{10000}", "", "\u{10000}", "", ""], ["a", "a", "b", "b", "b"]);
    expect(r.rowLevels).toEqual(["", "\u{10000}"]);
    expect(r.colLevels).toEqual(["a", "b"]);
    expect(r.observed).toEqual([
      [1, 2],
      [1, 1],
    ]);
    const t = chisqTest(["a", "a", "b", "b", "b"], ["\u{10000}", "�", "\u{10000}", "�", "�"]);
    expect(t.colLevels).toEqual(["�", "\u{10000}"]);
  });

  it("leaves ASCII levels and the statistic as before", () => {
    const x = ["b", "a", "B", "a", "b", "B", "a"];
    const y = ["u", "v", "u", "u", "v", "v", "u"];
    const r = chisqTest(x, y);
    expect(r.rowLevels).toEqual(["B", "a", "b"]);
    expect(r.colLevels).toEqual(["u", "v"]);
    const s = chisqTest([...x].reverse(), [...y].reverse());
    expect(s.statistic).toBe(r.statistic);
  });
});
