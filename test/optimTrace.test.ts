// optim's CG evaluates fn and gr at exactly R's points with R's values: the first 400 calls of rosenbrock (n = 4,
// type 1) with the analytic and the numerical gradient (oracle/optimtrace.R, x86_64 R), compared bit for bit
import { describe, expect, it } from "vitest";
import { optim } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { OPT_FNS, loadOptimFixture } from "./helpers/optim.js";

interface Call {
  kind: string;
  x: string[];
  v: string[];
}

describe("optim CG trace against R", () => {
  loadOptimFixture("optimTrace").forEach((c, k) => {
    const gradient = c.args.gradient === true;
    it(`${k}: ${gradient ? "analytic" : "numerical"} gradient`, () => {
      const F = OPT_FNS.rosenbrock!;
      const log: { kind: string; x: number[]; v: number[] }[] = [];
      const fn = (x: number[]) => {
        const v = F.fn(x);
        log.push({ kind: "fn", x: x.slice(), v: [v] });
        return v;
      };
      const gr = (x: number[]) => {
        const v = F.gr!(x);
        log.push({ kind: "gr", x: x.slice(), v });
        return v;
      };
      optim([-1.2, 1, -1.2, 1], fn, { method: "CG", control: { maxit: 5000 }, ...(gradient ? { gr } : {}) });
      const calls = (c.expected as unknown as { calls: Call[] }).calls;
      const firstDiff = calls.findIndex((e, i) => {
        const a = log[i];
        return (
          a === undefined ||
          a.kind !== e.kind ||
          e.x.some((v, j) => !Object.is(num(v), a.x[j])) ||
          e.v.some((v, j) => !Object.is(num(v), a.v[j]))
        );
      });
      expect(firstDiff).toBe(-1);
    });
  });
});
