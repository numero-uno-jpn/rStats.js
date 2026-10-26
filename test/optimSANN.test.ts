// optim's SANN (simulated annealing with R's random numbers) against R (oracle/optimsann.R, x86_64 R; rules in
// oracle/optim-behaviour.md, "Accuracy")
import { describe, expect, it } from "vitest";
import { setSeed } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { compare, loadOptimFixture, runCase } from "./helpers/optim.js";

const cases = loadOptimFixture("optimSANN");

describe("optim SANN against R", () => {
  let maxErr = 0;
  cases.forEach((c, k) => {
    it(`${k}: ${c.args.fn as string} seed ${c.args.seed as string} ${JSON.stringify(c.args.control)}`, () => {
      setSeed(num(c.args.seed as string));
      const r = runCase({ ...c.args, method: "SANN" });
      const cmp = compare(c, r);
      maxErr = Math.max(maxErr, cmp.maxErr);
      expect(cmp.failures).toEqual([]);
    });
  });
  it("summary", () => {
    console.log(`optim SANN: ${cases.length} cases, max error ${maxErr.toExponential(2)}`);
  });
});
