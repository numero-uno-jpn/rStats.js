// Issue #296: aovEz with a factor name repeated in between or within, or given in both (review_fix_log_issue296.md).
import { describe, expect, it } from "vitest";
import { aovEz } from "../src/index.js";

const ids = ["s1", "s2", "s3", "s4", "s5", "s6"];
const A = ["a", "a", "b", "b", "c", "c"];
const between = { id: ids, A, score: [1, 2, 3, 4, 5, 6] };
// 18 rows: each subject measured at w1, w2, w3
const long = {
  id: ids.flatMap((s) => [s, s, s]),
  A: A.flatMap((a) => [a, a, a]),
  W: ids.flatMap(() => ["w1", "w2", "w3"]),
  score: [1, 3, 2, 2, 5, 3, 3, 4, 6, 4, 7, 5, 5, 6, 9, 6, 8, 8],
};

describe("issue #296", () => {
  it("rejects a repeated name in between or within", () => {
    expect(() => aovEz(between, { id: "id", dv: "score", between: ["A", "A"] })).toThrow("duplicated factor names in 'between': A");
    expect(() => aovEz(long, { id: "id", dv: "score", within: ["W", "W"] })).toThrow("duplicated factor names in 'within': W");
    expect(() => aovEz(long, { id: "id", dv: "score", between: ["A"], within: ["W", "W"] })).toThrow(
      "duplicated factor names in 'within': W",
    );
  });

  it("rejects a name in both between and within", () => {
    expect(() => aovEz(long, { id: "id", dv: "score", between: ["A"], within: ["A"] })).toThrow(
      "factors in both 'between' and 'within': A",
    );
  });

  it("leaves distinct names unchanged", () => {
    const r = aovEz(between, { id: "id", dv: "score", between: ["A"] });
    expect(r.anova.rowNames).toEqual(["A"]);
    expect(r.anova.table[0]![r.anova.colNames.indexOf("F")]).toBeCloseTo(16, 12);
  });
});
