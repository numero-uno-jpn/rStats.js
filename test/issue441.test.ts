// Issue #441: pivotLonger's namesSep splits at zero-width matches as tidyr (review_fix_log_issue441.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

/** The name columns p1..pk of one column `name` split by `sep`, and the warnings */
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

const extra = "Expected 2 pieces. Additional pieces discarded in 1 rows [1].";

describe("issue #441", () => {
  it("splits at zero-width matches as tidyr", () => {
    // tidyr 1.3.2: pivot_longer(setNames(data.frame(1), name), all_of(name), names_to = paste0("p", 1:k),
    // names_sep = sep) (prep script b5.R)
    const cases: [string, string, (string | null)[], string[]][] = [
      ["fooBar", "(?=[A-Z])", ["foo", "Bar"], []],
      ["fooBarBaz", "(?=[A-Z])", ["foo", "Bar", "Baz"], []],
      ["FooBar", "(?=[A-Z])", ["", "Foo"], [extra]],
      ["FooBar", "(?=[A-Z])", ["", "Foo", "Bar"], []],
      ["abc", "", ["", "a", "b", "c"], []],
      ["ab", "$", ["ab", ""], []],
      ["ab", "^", ["", "ab"], []],
      ["ab", "(?<=b)", ["ab", ""], []],
      ["ab", "(?<=a)", ["a", "b"], []],
      ["ab", "(?=a)", ["", "ab"], []],
      ["ab", "x*", ["", "a", "b"], []],
      ["a_b", "_?", ["", "a"], [extra]],
      ["a_b", "_*", ["", "a"], [extra]],
      ["a1", "(?<=[a-z])(?=[0-9])", ["a", "1"], []],
      ["score_preX", "_|(?=[A-Z])", ["score", "pre", "X"], []],
      ["ab", "\\b", ["", "ab"], [extra]],
      ["a b", "\\b", ["", "a", " ", "b"], []],
    ];
    for (const [name, sep, parts, warnings] of cases) {
      expect(split(name, sep, parts.length), `${name} / ${sep}`).toEqual({ parts, warnings });
    }
  });

  it("keeps the split at separators with a width", () => {
    // tidyr: a__b with "_" (3 pieces) a, "", b; _ab: "", ab; ab_: ab, ""
    expect(split("a__b", "_", 3).parts).toEqual(["a", "", "b"]);
    expect(split("_ab", "_", 2).parts).toEqual(["", "ab"]);
    expect(split("ab_", "_", 2).parts).toEqual(["ab", ""]);
  });
});
