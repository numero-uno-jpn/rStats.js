import { describe, expect, it } from "vitest";
import { aovEz } from "../src/index.js";

// #295: with between factors "y" and "y_" (no within factors), the internal response name "y_" replaced the factor
// y_, and the fit failed ("contrasts can be applied only to factors with 2 or more levels").

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

describe("aovEz: the response name avoids the between factors (#295)", () => {
  const id = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  const f1 = ["a", "a", "a", "a", "b", "b", "b", "b"];
  const f2 = ["a", "a", "b", "b", "a", "a", "b", "b"];
  const score = [1, 2, 3, 4, 5, 6, 7, 9];

  it("fits factors named y and y_ (afex's values)", () => {
    const r = aovEz({ id, y: f1, y_: f2, score }, { id: "id", dv: "score", between: ["y", "y_"], es: ["ges"] });
    expect(r.anova.rowNames).toEqual(["y", "y_", "y:y_"]);
    expect(r.anova.colNames).toEqual(["num Df", "den Df", "MSE", "F", "ges", "Pr(>F)"]);
    // afex 1.x on R 4.5.2: aov_ez("id", "score", d, between = c("y", "y_"), anova_table = list(es = "ges"))
    const R = [
      [1, 4, hex("0x1.c00000000000cp-1"), hex("0x1.4a4924924923fp+5"), hex("0x1.d2c6a99704099p-1"), hex("0x1.8b5d041426a7cp-9")],
      [1, 4, hex("0x1.c00000000000cp-1"), hex("0x1.724924924924p+3"), hex("0x1.7c7a20e177c78p-1"), hex("0x1.be387490d4f46p-6")],
      [1, 4, hex("0x1.c00000000000cp-1"), hex("0x1.249249249248ap-3"), hex("0x1.1a7b9611a7b8fp-5"), hex("0x1.730674f107849p-1")],
    ];
    r.anova.table.forEach((row, i) => row.forEach((v, j) => expect(Math.abs(v - R[i]![j]!)).toBeLessThanOrEqual(1e-12 * Math.abs(R[i]![j]!))));
    // the same table as with other factor names
    const other = aovEz({ id, A: f1, B: f2, score }, { id: "id", dv: "score", between: ["A", "B"], es: ["ges"] });
    expect(r.anova.table).toEqual(other.anova.table);
  });

  it("also with factors y, y_ and y__", () => {
    const f3 = ["a", "b", "a", "b", "a", "b", "a", "b"];
    const ids = [...id, ...id.map((s) => `${s}x`)];
    const twice = (v: string[]): string[] => [...v, ...v];
    const r = aovEz(
      { id: ids, y: twice(f1), y_: twice(f2), y__: twice(f3), score: [...score, ...score.map((v) => v * v)] },
      { id: "id", dv: "score", between: ["y", "y_", "y__"] },
    );
    const other = aovEz(
      { id: ids, A: twice(f1), B: twice(f2), C: twice(f3), score: [...score, ...score.map((v) => v * v)] },
      { id: "id", dv: "score", between: ["A", "B", "C"] },
    );
    expect(r.anova.table).toEqual(other.anova.table);
  });
});
