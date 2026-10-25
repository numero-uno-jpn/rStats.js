import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getRandomSeed, nextRNGStream, nextRNGSubStream, RNGkind, rnorm, runif, sample, sampleInt, setRandomSeed, setSeed,
  type RNGKindName, type SampleKindName,
} from "../src/index.js";
import { num, relativeError } from "./helpers/fixture.js";
import { nums, summary } from "./helpers/random.js";
import { call, type Args } from "./helpers/randomCall.js";

/** One case of oracle/rngkind.R (see its header) */
interface KindCase {
  seed?: string;
  kind?: RNGKindName;
  sampleKind?: SampleKindName;
  args: Args;
  expected: string[];
  /** .Random.seed afterwards: all 7 integers for L'Ecuyer-CMRG, only the kind code for Mersenne-Twister */
  randomSeed: string[];
  next: string;
}

function load(name: string): { r_version: string; platform: string; cases: KindCase[] } {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8"));
}

const plus1 = (v: number[]): number[] => v.map((i) => i + 1);

/** Runs a case after set.seed(seed, kind, sample.kind), as kcase in oracle/rngkind.R */
function run(c: KindCase): number[] {
  const a = c.args;
  switch (a.script) {
    case undefined:
      // n = 20000 cases are summaries
      return a.n === "20000" ? summary(call(a)) : call(a);
    case "switch-sample-kind": {
      const first = plus1(sampleInt(10));
      RNGkind({ sampleKind: a.to as SampleKindName });
      return [...first, ...plus1(sampleInt(10))];
    }
    case "switch-kind": {
      const first = runif(2);
      RNGkind({ kind: a.to as RNGKindName });
      return [...first, ...runif(3)];
    }
    case "assign-seed":
      setRandomSeed(nums(a.randomSeed));
      return runif(5);
    case "streams": {
      let x = getRandomSeed();
      const out: number[] = [];
      for (const step of (a.steps as string).split(" ")) {
        x = step === "stream" ? nextRNGStream(x) : nextRNGSubStream(x);
        out.push(...x);
      }
      setRandomSeed(x);
      return [...out, ...runif(5)];
    }
  }
  throw new Error(`unknown case ${JSON.stringify(a)}`);
}

// Continuous variates differ from R in the last bits of log and exp (docs/differences-from-r.md); everything else,
// runif included, must match exactly
const CONTINUOUS = new Set(["rnorm", "rexp", "rgamma"]);

for (const name of ["rngRounding", "rngLecuyer", "rngStreams"]) {
  const fixture = load(name);
  describe(name, () => {
    it(`produces the same random sequence and .Random.seed as R (${fixture.r_version}, ${fixture.platform})`, () => {
      const failures: string[] = [];
      for (const c of fixture.cases) {
        // R's set.seed(seed, kind, sample.kind) after RNGkind("default", "default", "default")
        RNGkind({ kind: c.kind ?? "default", sampleKind: c.sampleKind ?? "default" });
        if (c.seed !== undefined) setSeed(num(c.seed));
        const actual = run(c);
        const seed = Array.from(getRandomSeed());
        const next = runif(1)[0]!;
        const expected = c.expected.map(num);
        const summarized = c.args.script === undefined && c.args.n === "20000";
        const tol = CONTINUOUS.has(c.args.fn as string) ? 1e-12 : 0;
        let ok = actual.length === expected.length && expected.every((e, i) => relativeError(actual[i]!, e) <= (summarized && i < 2 ? 1e-13 : tol));
        const expectedSeed = c.randomSeed.map(num);
        if (expectedSeed.some((s, i) => s !== seed[i]) || (expectedSeed.length > 1 && seed.length !== expectedSeed.length)) ok = false;
        if (num(c.next) !== next) ok = false;
        if (!ok) {
          failures.push(`${JSON.stringify({ seed: c.seed, kind: c.kind, sampleKind: c.sampleKind, args: c.args })}
    expected ${c.expected.slice(0, 8).join(" ")} seed ${c.randomSeed.join(" ")} next ${c.next}
    actual   ${actual.slice(0, 8).join(" ")} seed ${seed.slice(0, 7).join(" ")} next ${next}`);
        }
      }
      expect(failures, `${failures.length} case(s) differ from R:\n${failures.slice(0, 15).join("\n")}`).toHaveLength(0);
    });
  });
}

describe("RNG kinds", () => {
  const reset = (): void => void RNGkind({ kind: "default", sampleKind: "default" });

  it("RNGkind returns the kinds in effect before the call", () => {
    reset();
    expect(RNGkind()).toEqual({ kind: "Mersenne-Twister", normalKind: "Inversion", sampleKind: "Rejection" });
    expect(RNGkind({ kind: "L'Ecuyer-CMRG", sampleKind: "Rounding" }).kind).toBe("Mersenne-Twister");
    expect(RNGkind()).toEqual({ kind: "L'Ecuyer-CMRG", normalKind: "Inversion", sampleKind: "Rounding" });
    reset();
  });

  it("setSeed seeds the current kind and keeps the sample kind, as set.seed without kind", () => {
    reset();
    RNGkind({ kind: "L'Ecuyer-CMRG", sampleKind: "Rounding" });
    setSeed(1);
    const a = sampleInt(10);
    runif(3);
    setSeed(1);
    expect(RNGkind()).toEqual({ kind: "L'Ecuyer-CMRG", normalKind: "Inversion", sampleKind: "Rounding" });
    expect(sampleInt(10)).toEqual(a);
    expect(getRandomSeed()[0]).toBe(407);
    RNGkind({ kind: "default" });
    expect(getRandomSeed()[0]).toBe(403);
    RNGkind({ sampleKind: "default" });
    expect(getRandomSeed()[0]).toBe(10403);
    reset();
  });

  it("getRandomSeed / setRandomSeed restore an L'Ecuyer-CMRG state and the sample kind", () => {
    RNGkind({ kind: "L'Ecuyer-CMRG", sampleKind: "Rounding" });
    setSeed(42);
    runif(3);
    const st = getRandomSeed();
    expect(st.length).toBe(7);
    const a = [...rnorm(3), ...sample([1, 2, 3, 4, 5])];
    reset();
    setRandomSeed(st);
    expect(RNGkind().sampleKind).toBe("Rounding");
    expect([...rnorm(3), ...sample([1, 2, 3, 4, 5])]).toEqual(a);
    reset();
  });

  it("rejects unsupported kinds and invalid states", () => {
    reset();
    expect(() => RNGkind({ kind: "Wichmann-Hill" as RNGKindName })).toThrow(RangeError);
    expect(() => RNGkind({ kind: "L'Ecuyer-CMRG", sampleKind: "Rounded" as SampleKindName })).toThrow(RangeError);
    expect(() => RNGkind({ kind: "toString" as RNGKindName })).toThrow(RangeError);
    expect(RNGkind()).toEqual({ kind: "Mersenne-Twister", normalKind: "Inversion", sampleKind: "Rejection" });
    // An invalid kind code; all-zero seeds; a seed of 2^32 - 1 (R reseeds from the clock)
    expect(() => setRandomSeed([410407, 1, 2, 3, 4, 5, 6])).toThrow(RangeError);
    expect(() => setRandomSeed([10401, ...new Array<number>(625).fill(1)])).toThrow(RangeError);
    expect(() => setRandomSeed([10407, 0, 0, 0, 0, 0, 0])).toThrow(RangeError);
    expect(() => setRandomSeed([10407, -1, 2, 3, 4, 5, 6])).toThrow(RangeError);
    expect(() => setRandomSeed([10407, 1, 2, 3])).toThrow(RangeError);
    expect(RNGkind().kind).toBe("Mersenne-Twister");
    setSeed(1);
    expect(() => nextRNGStream(getRandomSeed())).toThrow(RangeError);
    expect(() => nextRNGSubStream([10407, 0, 0, 0, 1, 2, 3])).toThrow(RangeError);
  });

  it("sampleInt accepts n up to 4.5e15 where R does", () => {
    reset();
    setSeed(3);
    const v = sampleInt(4e15, { size: 3 });
    expect(v.every((x) => Number.isInteger(x) && x >= 0 && x < 4e15)).toBe(true);
    expect(() => sampleInt(4.6e15, { size: 1 })).toThrow(RangeError);
    expect(() => sampleInt(2 ** 31, { size: 2 ** 30 + 1 })).toThrow(RangeError);
    expect(() => sampleInt(2 ** 31, { size: 2, prob: [] })).toThrow(RangeError);
  });

  it("the jump-ahead matrices are the 2^76th and 2^127th powers of the MRG32k3a transition matrices", () => {
    // Recompute from L'Ecuyer (1999): s_n = 1403580 s_{n-2} - 810728 s_{n-3} mod m1, 527612 s_{n-1} - 1370589 s_{n-3} mod m2
    const m1 = 4294967087n;
    const m2 = 4294944443n;
    type M = bigint[][];
    const mul = (a: M, b: M, m: bigint): M =>
      a.map((r) => b[0]!.map((_, j) => (((r[0]! * b[0]![j]! + r[1]! * b[1]![j]! + r[2]! * b[2]![j]!) % m) + m) % m));
    const pow2 = (a: M, e: number, m: bigint): M => {
      for (let i = 0; i < e; i++) a = mul(a, a, m);
      return a;
    };
    const A1: M = [[0n, 1n, 0n], [0n, 0n, 1n], [-810728n, 1403580n, 0n]];
    const A2: M = [[0n, 1n, 0n], [0n, 0n, 1n], [-1370589n, 0n, 527612n]];
    const state = [10407, 12345, 67890, 13579, 24680, 11111, 22222];
    for (const [e, f] of [[76, nextRNGSubStream], [127, nextRNGStream]] as const) {
      const p1 = pow2(A1, e, m1);
      const p2 = pow2(A2, e, m2);
      const s = state.slice(1).map(BigInt);
      const want = [
        ...p1.map((r) => (r[0]! * s[0]! + r[1]! * s[1]! + r[2]! * s[2]!) % m1),
        ...p2.map((r) => (r[0]! * s[3]! + r[1]! * s[4]! + r[2]! * s[5]!) % m2),
      ].map((x) => Number(BigInt.asIntN(32, x)));
      expect(Array.from(f(state))).toEqual([10407, ...want]);
    }
  });
});
