import { fisherTest, runif, setSeed } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { arg, defined, htestSuite } from "./helpers/htest.js";

htestSuite({
  name: "fisherTest",
  call: (a) =>
    fisherTest(
      arg.mat(a.x)!,
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        or: arg.num(a.or),
        confInt: arg.bool(a.confInt),
        confLevel: arg.num(a.confLevel),
      }),
    ),
  tolerance: 1e-12,
  // R's FEXACT (r×c) p-values carry rounding errors of about 1e-11 (the value changes with workspace).
  // Two-row tables can be checked against the oracle's exact enumeration (gmp) reference values, but for
  // 3×3 and larger, enumeration in R is too slow, so differences within relative 1e-10 are treated as known
  // (the "internal consistency" tests below check against enumeration)
  knownDifference: (a, field, expected, actual) => {
    const x = arg.mat(a.x)!;
    if (field !== "pValue" || x.length < 3 || x[0]!.length < 3) return undefined;
    return Math.abs(actual - expected) <= 1e-10 * expected ? "rounding error of R's FEXACT for 3x3 or larger tables (within relative 1e-10)" : undefined;
  },
});

// Simulated p-values: set.seed(seed) right before the test; next is the runif(1) drawn afterwards (2 x 2 tables
// ignore simulatePValue and draw nothing)
htestSuite({
  name: "fisherTestSim",
  call: (a) => {
    setSeed(arg.num(a.seed)!);
    const r = fisherTest(
      arg.mat(a.x)!,
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        simulatePValue: arg.bool(a.simulatePValue),
        B: arg.num(a.B),
      }),
    );
    return { ...r, next: runif(1)[0] };
  },
  tolerance: 1e-12,
});

/** Computes the p-value by enumerating all tables with fixed margins (checks the network pruning; small tables only) */
function bruteForce(t: number[][]): number {
  const rs = t.map((r) => r.reduce((a, b) => a + b, 0));
  const cs = t[0]!.map((_, j) => t.reduce((a, r) => a + r[j]!, 0));
  const lf = (k: number): number => {
    let s = 0;
    for (let i = 2; i <= k; i++) s += Math.log(i);
    return s;
  };
  const n = rs.reduce((a, b) => a + b, 0);
  const K = rs.reduce((a, r) => a + lf(r), 0) + cs.reduce((a, c) => a + lf(c), 0) - lf(n);
  const logP = (cells: number[]): number => K - cells.reduce((a, v) => a + lf(v), 0);
  const obs = logP(t.flat());
  let p = 0;
  const nr = rs.length;
  const nc = cs.length;
  const cells: number[] = [];
  const rec = (R: number[], j: number): void => {
    if (j === nc - 1) {
      const all = [...cells, ...R];
      const lp = logP(all);
      if (lp <= obs + Math.log1p(1e-7)) p += Math.exp(lp);
      return;
    }
    const col = (i: number, rest: number, R2: number[]): void => {
      if (i === nr - 1) {
        if (rest > R[i]!) return;
        cells.push(rest);
        rec([...R2, R[i]! - rest], j + 1);
        cells.pop();
        return;
      }
      for (let v = 0; v <= Math.min(R[i]!, rest); v++) {
        cells.push(v);
        col(i + 1, rest - v, [...R2, R[i]! - v]);
        cells.pop();
      }
    };
    col(0, cs[j]!, []);
  };
  rec(rs, 0);
  return p;
}

describe("fisherTest r×c internal consistency", () => {
  const tables = [
    [[1, 2, 5], [3, 4, 6]],
    [[3, 1, 2], [1, 3, 2], [2, 2, 3]],
    [[2, 0, 1, 4], [1, 3, 0, 2], [0, 2, 3, 1]],
    [[5, 1], [2, 4], [0, 3], [1, 1]],
    [[4, 0, 0], [0, 4, 0], [0, 0, 4]],
  ];
  it("matches enumeration of all tables", () => {
    for (const t of tables) expect(fisherTest(t).pValue).toBeCloseTo(bruteForce(t), 12);
  });
  it("is invariant under row/column permutation and transposition", () => {
    for (const t of tables) {
      const p = fisherTest(t).pValue;
      const tr = t[0]!.map((_, j) => t.map((r) => r[j]!));
      const rev = [...t].reverse().map((r) => [...r].reverse());
      expect(Math.abs(fisherTest(tr).pValue - p) / p).toBeLessThan(1e-13);
      expect(Math.abs(fisherTest(rev).pValue - p) / p).toBeLessThan(1e-13);
    }
  });
  it("matches the 2×2 two-sided test after dropping a zero column", () => {
    const p2 = fisherTest([[1, 2], [3, 4]], { confInt: false }).pValue;
    expect(fisherTest([[1, 2, 0], [3, 4, 0]]).pValue).toBeCloseTo(p2, 14);
  });
  it("finishes in reasonable time on a table too large for R's default workspace", () => {
    const t0 = Date.now();
    const p = fisherTest([[10, 15, 12, 8, 20], [14, 9, 11, 16, 10], [8, 12, 15, 10, 9]]).pValue;
    // R (workspace = 2e8) gives 0.202372672067
    expect(p).toBeCloseTo(0.2023726720670, 10);
    expect(Date.now() - t0).toBeLessThan(20_000);
  });
});
