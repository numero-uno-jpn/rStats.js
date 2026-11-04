// Issue #500: after a zero-width match of namesSep, pivotLonger went on one UTF-16 code unit later and split a
// surrogate pair. It now goes on one code point later, as stringr::str_split("A\u{1F600}B", "(?=.)") ("", "A",
// "\u{1F600}", "B"). tidyr 1.3.2 on R 4.5.2 (gregexpr, perl = TRUE) goes on inside the UTF-8 bytes and gives "", "A",
// "\u{1F600}", "", "", "", "B" (docs/differences-from-r.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

function split(name: string, sep: string, k: number): { parts: (string | null)[]; warnings: string[] } {
  const warnings: string[] = [];
  const namesTo = Array.from({ length: k }, (_, j) => `p${j + 1}`);
  const out = pivotLonger({ [name]: [1] }, {
    cols: [name],
    namesTo,
    namesSep: sep,
    onWarning: (m) => warnings.push(m),
  }) as Record<string, ArrayLike<unknown>>;
  return { parts: namesTo.map((c) => out[c]![0] as string | null), warnings };
}

describe("issue #500", () => {
  it("keeps a surrogate pair whole after a zero-width match", () => {
    expect(split("A\u{1F600}B", "(?=.)", 5)).toEqual({
      parts: ["", "A", "\u{1F600}", "B", null],
      warnings: ["Expected 5 pieces. Missing pieces filled with `NA` in 1 rows [1]."],
    });
    expect(split("\u{1F600}\u{1F601}", "", 3).parts).toEqual(["", "\u{1F600}", "\u{1F601}"]);
  });

  it("ASCII names as before (tidyr)", () => {
    expect(split("AxB", "(?=.)", 5).parts).toEqual(["", "A", "x", "B", null]);
  });
});
