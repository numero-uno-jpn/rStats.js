// Exactness of the ROC functions where the rounded computation cancels: McClish's correction on the diagonal and near
// 0, the difference of two AUCs in rocTest, DeLong's S of a near-perfect curve, and the predictive value at a
// subnormal prevalence. The references are exact fractions (BigInt), formed here independently of the code.
import { describe, expect, it } from "vitest";
import { auc, ciAuc, diagnosticTests, roc, rocTest, type RocResult } from "../src/index.js";

type Q = [bigint, bigint];
const norm = (a: Q): Q => (a[1] < 0n ? [-a[0], -a[1]] : a);
const add = (a: Q, b: Q): Q => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
const sub = (a: Q, b: Q): Q => [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
const mul = (a: Q, b: Q): Q => [a[0] * b[0], a[1] * b[1]];
const div = (a: Q, b: Q): Q => norm([a[0] * b[1], a[1] * b[0]]);
const cmp = (a: Q, b: Q): number => {
  const d = a[0] * b[1] - b[0] * a[1];
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};
const max = (a: Q, b: Q): Q => (cmp(a, b) >= 0 ? a : b);
const min = (a: Q, b: Q): Q => (cmp(a, b) <= 0 ? a : b);
const ONE: Q = [1n, 1n];
const HALF: Q = [1n, 2n];

/** A finite double as an exact fraction */
function exact(v: number): Q {
  if (v === 0) return [0n, 1n];
  let e = 0n;
  let m = v;
  while (!Number.isInteger(m)) {
    m *= 2;
    e++;
  }
  return [BigInt(m), 1n << e];
}

/** Whether the double v is the exact fraction r rounded to nearest: |v - r| at most half an ulp of v */
function isRounded(v: number, r: Q): boolean {
  const e = Math.floor(Math.log2(Math.abs(v)));
  const halfUlp: Q = [1n, 1n << BigInt(53 - e)];
  const d = sub(exact(v), r);
  return cmp(d[0] < 0n ? [-d[0], d[1]] : d, halfUlp) <= 0;
}

/** Whether the double v is within a relative 2^-50 (a few roundings) of the exact fraction r */
function isNear(v: number, r: Q): boolean {
  const d = sub(exact(v), r);
  const a: Q = norm([d[0] < 0n ? -d[0] : d[0], d[1]]);
  const b = norm(mul(r[0] < 0n ? [-r[0], r[1]] : r, [1n, 1n << 50n]));
  return cmp(a, b) <= 0;
}

/**
 * McClish's standardised partial AUC as an exact fraction: the integral of the curve through the exact points
 * (counts over n and m) between the limits, segment by segment, then (1 + (A - min)/(max - min))/2
 */
function mcClishExact(r: RocResult, lo: number, hi: number, focus: "specificity" | "sensitivity"): Q {
  const n = BigInt(r.controls.length);
  const m = BigInt(r.cases.length);
  const sp = r.specificities.map((v): Q => [BigInt(Math.round(v * r.controls.length)), n]);
  const se = r.sensitivities.map((v): Q => [BigInt(Math.round(v * r.cases.length)), m]);
  const [x, y] = focus === "specificity" ? [sp, se] : [[...se].reverse(), [...sp].reverse()];
  const L = exact(lo);
  const H = exact(hi);
  let area: Q = [0n, 1n];
  for (let k = 1; k < x.length; k++) {
    const [x0, x1, y0, y1] = [x[k - 1]!, x[k]!, y[k - 1]!, y[k]!];
    if (cmp(x0, x1) === 0) continue;
    const a = max(x0, L);
    const b = min(x1, H);
    if (cmp(a, b) >= 0) continue;
    const at = (v: Q): Q => add(y0, mul(div(sub(v, x0), sub(x1, x0)), sub(y1, y0)));
    area = add(area, mul(mul(sub(b, a), add(at(a), at(b))), HALF));
  }
  const lowest = mul(mul(add(sub(ONE, H), sub(ONE, L)), sub(H, L)), HALF);
  const highest = sub(H, L);
  return mul(add(ONE, div(sub(area, lowest), sub(highest, lowest))), HALF);
}

/** A deterministic stream of integers in [0, k) (a linear congruential generator) */
function lcg(seed: number): (k: number) => number {
  let s = seed;
  return (k) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return Math.floor((s / 2147483648) * k);
  };
}

describe("auc with McClish's correction, exactly", () => {
  it("gives 0.5 for curves exactly on the diagonal (a tie, not below it)", () => {
    // every point has se = 1 - sp exactly; the rounded areas made 860 of these 2940 calls an error
    for (const n of [3, 5, 7, 10, 13, 20, 50]) {
      const v = Array.from({ length: n }, (_, i) => i + 1);
      const r = roc({ controls: v, cases: v }, { direction: "<" });
      for (let a = 0; a < 20; a++) {
        for (let b = a + 1; b <= 20; b++) {
          for (const focus of ["specificity", "sensitivity"] as const) {
            expect(auc(r, { partialAuc: [a / 20, b / 20], focus, correct: true }).auc).toBe(0.5);
          }
        }
      }
    }
  });

  it("keeps its digits for limits near 0", () => {
    // the first segment is se = 1 - 0.8 sp: (1 + 0.1 h^2/(h^2/2))/2 = 3/5 for every h <= 1/4 (it was
    // 0.5999999992059066 at h = 1e-7 and 0.5999997415058833 at 1e-10)
    const r = roc({ controls: [1, 2, 3, 4], cases: [1, 5, 6, 7, 8] });
    for (const h of [0.25, 0.1, 1e-3, 1e-5, 1e-7, 1e-9, 1e-10, 1e-100, 1e-300, 5e-324]) {
      expect(auc(r, { partialAuc: [0, h], correct: true }).auc).toBe(0.6);
      expect(isRounded(0.6, mcClishExact(r, 0, h, "specificity"))).toBe(true);
    }
    // se = 1 on [0, 1/6]: exactly 1 (it was NaN at h = 1e-16 and 1e-20, where max - min and A - min were 0)
    const s = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
    for (const h of [1e-15, 1e-16, 1e-20, 1e-300]) expect(auc(s, { partialAuc: [0, h], correct: true }).auc).toBe(1);
  });

  it("is the exact fraction rounded once, for random curves and limits", () => {
    // the worst case of the audit: 0.5172413795757878 (5.1e-10 relative error) for the exact 15/29
    const w = roc({
      controls: [12, 5, 5, 11, 17, 8, 3, 10, 18, 6, 1, 11, 11, 14, 5, 9, 19, 5, 16, 1, 4, 10, 5, 19, 16, 8, 17, 5, 6],
      cases: [17, 19, 20, 4, 8, 18, 4, 5, 16, 4, 14, 1, 17, 20, 4, 7, 2, 12, 10, 8, 5, 1, 7, 14, 15, 13, 4, 4],
    });
    const lw = 1.115727424621582e-7;
    const hw = 3.450289070606231e-7;
    expect(isRounded(auc(w, { partialAuc: [lw, hw], focus: "sens", correct: true }).auc, mcClishExact(w, lw, hw, "sensitivity"))).toBe(true);
    const rnd = lcg(17);
    let checked = 0;
    for (let t = 0; t < 300; t++) {
      const controls = Array.from({ length: 3 + rnd(30) }, () => rnd(20));
      const cases = Array.from({ length: 3 + rnd(30) }, () => rnd(20) + rnd(6));
      const r = roc({ controls, cases });
      // wide limits, limits within 1e-6 of 0, and limits within 1e-6 of 1
      const u = (rnd(1000) + 1) / 1001;
      const v = (rnd(1000) + 1) / 1001;
      const pairs: [number, number][] = [
        [Math.min(u, v), Math.max(u, v) + (u === v ? 1e-3 : 0)],
        [u * 1e-7, (1 + v) * 1e-6],
        [1 - (1 + v) * 1e-6, 1 - u * 1e-7],
      ];
      for (const [lo, hi] of pairs) {
        for (const focus of ["specificity", "sensitivity"] as const) {
          const ref = mcClishExact(r, lo, hi, focus);
          // below the diagonal (A < min, so the standardised value < 1/2) the correction is an error
          if (cmp(ref, HALF) < 0) {
            expect(() => auc(r, { partialAuc: [lo, hi], focus, correct: true })).toThrow("below the diagonal");
          } else {
            expect(isRounded(auc(r, { partialAuc: [lo, hi], focus, correct: true }).auc, ref)).toBe(true);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("does not depend on the scale of the data (powers of 2)", () => {
    const controls = [1, 2, 2, 3, 5, 7];
    const cases = [2, 4, 5, 5, 8, 9, 10];
    const ref = auc(roc({ controls, cases }), { partialAuc: [0, 1e-9], correct: true }).auc;
    for (const k of [-1000, -500, 500, 1000]) {
      const s = 2 ** k;
      const r = roc({ controls: controls.map((v) => v * s), cases: cases.map((v) => v * s) });
      expect(auc(r, { partialAuc: [0, 1e-9], correct: true }).auc).toBe(ref);
    }
  });
});

describe("rocTest and ciAuc from the integer counts", () => {
  /** Twice U of the cases against the controls (direction "<"), as a BigInt */
  const twiceU = (controls: readonly number[], cases: readonly number[]): bigint => {
    let u = 0n;
    for (const x of cases) for (const y of controls) u += x > y ? 2n : x === y ? 1n : 0n;
    return u;
  };

  it("takes the paired difference of the AUCs from the counts", () => {
    // two predictors that differ in two of 30000 cases: the difference of the rounded AUCs gave Z with 6e-10
    // relative error
    const rnd = lcg(99);
    const n = 30000;
    const m = 30000;
    const y = [...Array<number>(n).fill(0), ...Array<number>(m).fill(1)];
    const p1 = [...Array.from({ length: n }, () => rnd(1000)), ...Array.from({ length: m }, () => rnd(1000) + 200)];
    const p2 = [...p1];
    p2[n + 5]! += 0.5;
    p2[n + 17]! += 0.5;
    const t = rocTest(y, p1, p2);
    // the difference changes only through cases 5 and 17: 2U1 - 2U2 from their counts against the controls
    const controls = p1.slice(0, n);
    const d = twiceU(controls, [p1[n + 5]!, p1[n + 17]!]) - twiceU(controls, [p2[n + 5]!, p2[n + 17]!]);
    const diff: Q = [d, BigInt(2 * n * m)];
    const mid = (t.confInt![0] + t.confInt![1]) / 2;
    // the midpoint of diff -+ half carries the rounding of the two limits (half is 14 times diff)
    expect(Math.abs(mid / (Number(d) / (2 * n * m)) - 1)).toBeLessThan(1e-13);
    expect(isRounded(Number(d) / (2 * n * m), diff)).toBe(true);
    // Z = diff/sigma; the exact sigma of this case (from BigInt variances of the integer placement differences)
    expect(Math.abs(t.statistic / -1.39415170110182 - 1)).toBeLessThan(1e-13);
  });

  it("takes the unpaired difference from the counts", () => {
    // AUCs 2395/3422 and 2234/3192 differ by 8.4e-6: the rounded AUCs gave 6.7e-12 relative error
    const curve = (n: number, m: number, u: number): RocResult => {
      let rem = u;
      const cases: number[] = [];
      for (let i = 0; i < m; i++) {
        const b = Math.min(n, Math.floor(rem / (m - i)));
        cases.push(b - 0.5);
        rem -= b;
      }
      return roc({ controls: Array.from({ length: n }, (_, i) => i), cases }, { direction: "<" });
    };
    const r1 = curve(58, 59, 2395);
    const r2 = curve(57, 56, 2234);
    const diff: Q = sub([2395n, 58n * 59n], [2234n, 57n * 56n]);
    const t = rocTest(r1, r2);
    const s = ciAuc(r1).variance + ciAuc(r2).variance;
    const want = Number(diff[0]) / Number(diff[1]) / Math.sqrt(s);
    expect(Math.abs(t.statistic / want - 1)).toBeLessThan(1e-14);
  });

  it("computes DeLong's S of a near-perfect curve from the integer placements", () => {
    // controls 0..99999, cases 99999..199998 (one tie): S = 5e-21 exactly (it was 5.000000000065512e-21, 1.3e-11 off)
    const n = 100000;
    const r = roc({ controls: Array.from({ length: n }, (_, i) => i), cases: Array.from({ length: n }, (_, i) => i + n - 1) });
    // the numerators of V10 (over 2n) are 2n except 2n - 1 for the tied case, and the same for V01 (over 2m = 2n)
    const N = BigInt(n);
    const varNum = (k: bigint[]): Q => {
      let s = 0n;
      let s2 = 0n;
      for (const v of k) {
        s += v;
        s2 += v * v;
      }
      return [N * s2 - s * s, N * (N - 1n)];
    };
    const k = [2n * N - 1n, ...Array<bigint>(n - 1).fill(2n * N)];
    const v = div(varNum(k), [4n * N * N * N, 1n]);
    const S = add(v, v);
    // (a few roundings: the variance, the divisions by (2n)^2 and m, and the sum)
    expect(isNear(ciAuc(r).variance, S)).toBe(true);
  });
});

describe("diagnosticTests at the ends of the prevalence", () => {
  it("gives PPV 1 without false positives at a subnormal prevalence", () => {
    // se p underflowed to 0 at p = 5e-324: 0/0
    for (const p of [5e-324, 1e-320, 2 ** -1000, 1e-300]) {
      expect(diagnosticTests([[3, 0], [7, 20]], { prevalence: p }).ppvAtPrevalence).toBe(1);
    }
    // with false positives: se p/(se p + (b/M0)(1 - p)) = (3/10) p/((3/10) p + (5/25)(1 - p))
    const p = 5e-324;
    const se: Q = [3n, 10n];
    const fpr: Q = [5n, 25n];
    const P = exact(p);
    const want = div(mul(se, P), add(mul(se, P), mul(fpr, sub(ONE, P))));
    const got = diagnosticTests([[3, 5], [7, 20]], { prevalence: p }).ppvAtPrevalence!;
    const d = norm(sub(exact(got), want));
    // (the value is subnormal, about 1.5 2^-1074: within one step of 2^-1074 of it)
    expect(cmp([d[0] < 0n ? -d[0] : d[0], d[1]], exact(5e-324))).toBeLessThanOrEqual(0);
  });

  it("rounds LR- once", () => {
    // (c/M1)/sp = (5/5)/(20/23) = 1.15 exactly (c / M1 / sp gave 1.1500000000000001)
    expect(diagnosticTests([[0, 3], [5, 20]]).lrNeg.estimate).toBe(1.15);
    expect(diagnosticTests([[670, 202], [74, 640]]).lrNeg.estimate).toBe((74 * 842) / (744 * 640));
  });
});
