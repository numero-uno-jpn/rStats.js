// binomTest, poissonTest, varTest, bartlettTest and mcnemarTest against SciPy references
// (scripts/mpmath/htest_scipy.py writes test/fixtures/htest_<name>.scipy.json), and against R once the R fixtures
// (oracle/<name>.R) exist.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bartlettTest } from "../src/htest/varTest.js";
import { binomTest } from "../src/htest/binomTest.js";
import { mcnemarTest } from "../src/htest/mcnemarTest.js";
import { poissonTest } from "../src/htest/poissonTest.js";
import { varTest } from "../src/htest/varTest.js";
import { onewayTest, shapiroTest } from "../src/htest/onewayTest.js";
import { propTest } from "../src/htest/propTest.js";
import { flignerTest, friedmanTest, kruskalTest, moodTest, quadeTest } from "../src/htest/rankTests.js";
import type { Alternative } from "../src/htest/types.js";
import { hasFixture, num, relativeError } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

type Args = Record<string, unknown>;
interface RefCase {
  args: Args;
  expected: Record<string, string | string[]>;
}

const nums = (v: unknown): number[] => (v as (string | number)[]).map((e) => (typeof e === "number" ? e : num(e)));
const opt = (a: Args) => ({ alternative: a.alternative as Alternative, confLevel: num(a.confLevel as string) });

const calls: Record<string, [number, (a: Args) => Record<string, unknown>]> = {
  binomTest: [1e-12, (a) => ({ ...binomTest(a.x as number, a.n as number, { p: num(a.p as string), ...opt(a) }) })],
  poissonTest: [
    1e-12,
    (a) => ({ ...poissonTest(a.x as number[], { T: nums(a.T), r: num(a.r as string), ...opt(a) }) }),
  ],
  varTest: [1e-12, (a) => ({ ...varTest(nums(a.x), nums(a.y), { ratio: num(a.ratio as string), ...opt(a) }) })],
  bartlettTest: [1e-12, (a) => ({ ...bartlettTest((a.groups as string[][]).map(nums)) })],
  mcnemarTest: [1e-13, (a) => ({ ...mcnemarTest((a.x as string[][]).map(nums), { correct: a.correct as boolean }) })],
  kruskalTest: [1e-12, (a) => ({ ...kruskalTest((a.groups as string[][]).map(nums)) })],
  friedmanTest: [1e-12, (a) => ({ ...friedmanTest((a.y as string[][]).map(nums)) })],
  quadeTest: [1e-12, (a) => ({ ...quadeTest((a.y as string[][]).map(nums)) })],
  flignerTest: [1e-12, (a) => ({ ...flignerTest((a.groups as string[][]).map(nums)) })],
  moodTest: [1e-12, (a) => ({ ...moodTest(nums(a.x), nums(a.y), { alternative: a.alternative as Alternative }) })],
  onewayTest: [1e-12, (a) => ({ ...onewayTest((a.groups as string[][]).map(nums), { varEqual: a.varEqual as boolean }) })],
  propTest: [
    1e-12,
    (a) => ({
      ...propTest(nums(a.x), nums(a.n), {
        ...(a.p === undefined ? {} : { p: nums(a.p) }),
        correct: a.correct as boolean,
        ...opt(a),
      }),
    }),
  ],
  // SciPy evaluates the Shapiro-Wilk p-value less precisely (agreement about 1e-11), hence the wider tolerance
  shapiroTest: [1e-9, (a) => ({ ...shapiroTest(nums(a.x)) })],
};

for (const [name, [tolerance, call]] of Object.entries(calls)) {
  const path = fileURLToPath(new URL(`./fixtures/htest_${name}.scipy.json`, import.meta.url));
  const fixture = JSON.parse(readFileSync(path, "utf8")) as { generator: string; cases: RefCase[] };
  describe(name, () => {
    it(`matches the SciPy references (${fixture.generator})`, () => {
      const bad: string[] = [];
      let worst = 0;
      for (const c of fixture.cases) {
        const actual = call(c.args);
        for (const [field, exp] of Object.entries(c.expected)) {
          const e = Array.isArray(exp) ? exp.map(num) : [num(exp)];
          const v = actual[field];
          const av = Array.isArray(v) ? (v as number[]) : [v as number];
          e.forEach((ev, i) => {
            // probabilities near the underflow threshold are compared absolutely
            const err = Math.abs(ev) < 1e-300 ? Math.abs(av[i]! - ev) / 1e-300 : relativeError(av[i]!, ev);
            if (Number.isFinite(err)) worst = Math.max(worst, err);
            if (!(err <= tolerance)) bad.push(`${JSON.stringify(c.args)} ${field}[${i}]: expected ${ev} actual ${av[i]}`);
          });
        }
      }
      console.log(`${name}: ${fixture.cases.length} cases, max relative error ${worst.toExponential(2)}`);
      expect(bad.slice(0, 10), bad.join("\n")).toHaveLength(0);
    });
  });
}

describe("input handling", () => {
  it("binomTest takes [successes, failures]", () => {
    expect(binomTest([7, 3])).toEqual(binomTest(7, 10));
    expect(binomTest([7, 3], { p: 0.3 }).pValue).toBe(binomTest(7, 10, { p: 0.3 }).pValue);
  });
  it("binomTest rejects invalid counts", () => {
    expect(() => binomTest(11, 10)).toThrow();
    expect(() => binomTest(2.5, 10)).toThrow();
    expect(() => binomTest(3, 10, { p: 1.5 })).toThrow();
  });
  it("mcnemarTest cross-tabulates paired codes", () => {
    const x = ["a", "a", "b", "b", "a", "b", "a", "b", "b"];
    const y = ["a", "b", "b", "a", "b", "b", "b", "a", "b"];
    expect(mcnemarTest(x, y)).toEqual(mcnemarTest([[1, 3], [2, 3]]));
  });
  it("tests without an alternative report none", () => {
    expect("alternative" in mcnemarTest([[3, 5], [2, 4]])).toBe(false);
    expect("alternative" in bartlettTest([[1, 2, 4], [2, 5, 9]])).toBe(false);
  });
});

// R fixtures (generated on the R side from oracle/<name>.R)
const vecOrNum = (a: HTestArg | undefined): number | number[] | undefined => {
  const v = arg.vec(a);
  return v === undefined ? undefined : v.length === 1 ? v[0] : v;
};
const rAlt = (a: Record<string, HTestArg>) =>
  defined({ alternative: arg.str<Alternative>(a.alternative), confLevel: arg.num(a.confLevel) });

if (hasFixture("binomTest"))
  htestSuite({
    name: "binomTest",
    call: (a) => {
      const x = vecOrNum(a.x)!;
      const o = defined({ p: arg.num(a.p), ...rAlt(a) });
      return typeof x === "number" ? binomTest(x, arg.num(a.n)!, o) : binomTest(x as [number, number], o);
    },
    tolerance: 1e-12,
  });
if (hasFixture("poissonTest"))
  htestSuite({
    name: "poissonTest",
    call: (a) => poissonTest(arg.vec(a.x)!, defined({ T: arg.vec(a.T), r: arg.num(a.r), ...rAlt(a) })),
    tolerance: 1e-12,
  });
if (hasFixture("varTest"))
  htestSuite({
    name: "varTest",
    call: (a) => varTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ ratio: arg.num(a.ratio), ...rAlt(a) })),
    tolerance: 1e-12,
  });
if (hasFixture("bartlettTest"))
  htestSuite({
    name: "bartlettTest",
    call: (a) => bartlettTest((a.groups as unknown as string[][]).map((g) => (Array.isArray(g) ? g : [g]).map(num))),
    tolerance: 1e-12,
  });
if (hasFixture("mcnemarTest"))
  htestSuite({
    name: "mcnemarTest",
    call: (a) => mcnemarTest(arg.mat(a.x)!, defined({ correct: arg.bool(a.correct) })),
    tolerance: 1e-13,
  });

const rGroups = (a: Record<string, HTestArg>): number[][] =>
  (a.groups as unknown as (string | string[])[]).map((g) => (Array.isArray(g) ? g : [g]).map(num));
const rSuites: [string, (a: Record<string, HTestArg>) => object, number][] = [
  ["kruskalTest", (a) => kruskalTest(rGroups(a)), 1e-12],
  ["flignerTest", (a) => flignerTest(rGroups(a)), 1e-12],
  ["onewayTest", (a) => onewayTest(rGroups(a), defined({ varEqual: arg.bool(a.varEqual) })), 1e-12],
  ["friedmanTest", (a) => friedmanTest(arg.mat(a.y)!), 1e-12],
  ["quadeTest", (a) => quadeTest(arg.mat(a.y)!), 1e-12],
  ["moodTest", (a) => moodTest(arg.vec(a.x)!, arg.vec(a.y)!, defined({ alternative: arg.str<Alternative>(a.alternative) })), 1e-12],
  ["shapiroTest", (a) => shapiroTest(arg.vec(a.x)!), 1e-12],
];
for (const [name, call, tolerance] of rSuites) if (hasFixture(name)) htestSuite({ name, call, tolerance });
if (hasFixture("propTest"))
  htestSuite({
    name: "propTest",
    call: (a) =>
      propTest(arg.vec(a.x)!, arg.vec(a.n)!, defined({ p: arg.vec(a.p), correct: arg.bool(a.correct), ...rAlt(a) })),
    tolerance: 1e-12,
    // a continuity correction reduced to |O - E| gives exactly 0 here and rounding residue in R
    floor: { statistic: 1e-3 },
  });
