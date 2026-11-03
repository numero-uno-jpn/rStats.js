import { describe, expect, it } from "vitest";
import { parseFormula, termsOf } from "../src/models/formula.js";

const labels = (f: string): string[] => termsOf(parseFormula(f), ["y", "a", "b", "c", "d"]).termLabels;

// #294: the power of ^ was not checked against the int range, and the expansion ran p - 1 steps: ^1e999 did not end
// and large finite powers took as long. R's asInteger makes powers beyond the int range NA ("invalid power in formula").
describe("formula ^ with huge powers (#294)", () => {
  // These calls did not end before the fix
  it("rejects powers beyond the int range, as R", () => {
    for (const p of ["1e999", "2147483648", "3e9"]) {
      expect(() => labels(`y ~ (a + b)^${p}`)).toThrow("invalid power in formula");
    }
  });

  it("ends large powers at the fixed point with R's terms", () => {
    // R: a b c d a:b a:c a:d b:c b:d c:d a:b:c a:b:d a:c:d b:c:d a:b:c:d
    expect(labels("y ~ (a + b + c + d)^100000")).toEqual(labels("y ~ (a + b + c + d)^4"));
    expect(labels("y ~ (a + b + c + d)^100000")).toEqual(
      "a b c d a:b a:c a:d b:c b:d c:d a:b:c a:b:d a:c:d b:c:d a:b:c:d".split(" "),
    );
    expect(labels("y ~ (a + b)^2147483647")).toEqual(["a", "b", "a:b"]);
  });

  it("keeps ordinary powers (R's terms)", () => {
    expect(labels("y ~ (a + b:c + c*d - a:d)^7")).toEqual(
      "a c d a:c a:d b:c c:d a:b:c a:c:d b:c:d a:b:c:d".split(" "),
    );
    expect(labels("y ~ (a + b + c)^2")).toEqual(["a", "b", "c", "a:b", "a:c", "b:c"]);
    expect(() => labels("y ~ (a + b)^-3e9")).toThrow("invalid power in formula");
  });
});
