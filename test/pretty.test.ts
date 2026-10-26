// pretty against R (oracle/pretty.R). hist exercises pretty only through its default breaks; these cases cover the
// options, zero and tiny ranges, min.n widening, the biases, non-finite input and extreme magnitudes.
import { describe, expect, it } from "vitest";
import { pretty } from "../src/index.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestArg } from "./helpers/htest.js";
import { num } from "./helpers/fixture.js";

type A = Record<string, HTestArg>;
const call = (a: A): number[] =>
  pretty(
    arg.vec(a.x) ?? [],
    defined({ n: arg.num(a.n), minN: arg.num(a.minN), highUBias: arg.num(a.highUBias), u5Bias: arg.num(a.u5Bias) }),
  );

htestSuite({ name: "pretty", call: (a) => ({ value: call(a) }), tolerance: 1e-14 });

describe("pretty (bit for bit)", () => {
  // Every value R returns here is reproduced exactly (same operations in the same order), not just within 1e-14
  it("reproduces R's doubles exactly", () => {
    for (const c of loadHTestFixture("pretty").cases) {
      // (the errors are checked by the suite above)
      if (c.expected.error !== undefined) continue;
      const expected = (c.expected.value as string[]).map((v) => num(v));
      expect(call(c.args), JSON.stringify(c.args)).toEqual(expected);
    }
  });
});
