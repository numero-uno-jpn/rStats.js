import { wilcoxTest } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

/** Scale of the data (the larger of the max absolute finite value and |mu|) */
function dataScale(c: HTestCase): number {
  const vals = [...(arg.vec(c.args.x) ?? []), ...(arg.vec(c.args.y) ?? [])];
  let m = Math.abs(num((c.args.mu as string | undefined) ?? "0"));
  for (const v of vals) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  return m;
}

/** Mid-ranks of v, written out (O(n^2)) */
function midRanks(v: readonly number[]): number[] {
  return v.map((a) => {
    let below = 0;
    let equal = 0;
    for (const b of v) {
      if (b < a) below++;
      else if (b === a) equal++;
    }
    return below + (equal + 1) / 2;
  });
}

/** Number of sign choices of the integer scores a with each sum s (exact below 2^53, n <= 52) */
function signCounts(a: readonly number[]): number[] {
  let c = [1];
  for (const v of a) {
    const next = new Array<number>(c.length + v).fill(0);
    c.forEach((k, s) => {
      next[s]! += k;
      next[s + v]! += k;
    });
    c = next;
  }
  return c;
}

type Reference = { r: Record<"confInt" | "confLevel", number[]>; correct: Record<"confInt" | "confLevel", number[]>; twoSample: boolean };
const conditionalRefs = new Map<string, Reference | undefined>();

/** Number of m-subsets of the integer scores a with each sum s (exact while C(N, m) < 2^53) */
function subsetCounts(a: readonly number[], m: number): number[] {
  let total = 0;
  for (const v of a) total += v;
  const c = Array.from({ length: m + 1 }, () => new Array<number>(total + 1).fill(0));
  c[0]![0] = 1;
  for (const v of a) {
    for (let j = m; j >= 1; j--) for (let s = total; s >= v; s--) c[j]![s]! += c[j - 1]![s - v]!;
  }
  return c[m]!;
}

/**
 * Test inversion over the midpoints of the sorted values A (Walsh averages or differences), with tails(t) =
 * [upper tail, lower tail] of the statistic at the shift t. R 4.6.2 reports an end at A_1 or A_K with the tail 0
 * (rRule); the tail rejected there is the one at A_1 - 1 (A_K + 1)
 */
function invert(A: readonly number[], tails: (t: number) => [number, number], alternative: string, alpha: number, rRule: boolean): Record<"confInt" | "confLevel", number[]> {
  const K = A.length;
  let lower = -Infinity;
  let lowerTail = 0;
  if (alternative !== "less") {
    const p0 = tails(A[0]! - 1)[0];
    if (p0 <= alpha) {
      let prev = rRule ? 0 : p0;
      let k = 1;
      for (; k < K; k++) {
        const p = tails((A[k - 1]! + A[k]!) / 2)[0];
        if (p > alpha) break;
        prev = p;
      }
      lower = A[k - 1]!;
      lowerTail = prev;
    }
  }
  let upper = Infinity;
  let upperTail = 0;
  if (alternative !== "greater") {
    const p0 = tails(A[K - 1]! + 1)[1];
    if (p0 <= alpha) {
      let prev = rRule ? 0 : p0;
      let k = K - 1;
      for (; k >= 1; k--) {
        const p = tails((A[k - 1]! + A[k]!) / 2)[1];
        if (p > alpha) break;
        prev = p;
      }
      upper = A[k]!;
      upperTail = prev;
    }
  }
  return { confInt: [lower, upper], confLevel: [1 - lowerTail - upperTail] };
}

/**
 * The exact conditional interval (ties, or zeros for one sample; exact test chosen) by R 4.6.2's rule and by the
 * correct one, from exact counts (signs, or subsets for two samples) at each midpoint of the sorted Walsh averages
 * or differences; undefined for other cases
 */
function conditionalReference(a: HTestCase["args"]): Reference | undefined {
  const key = JSON.stringify(a);
  if (conditionalRefs.has(key)) return conditionalRefs.get(key);
  const compute = (): Reference | undefined => {
    if (!(arg.bool(a.confInt) ?? false)) return undefined;
    const y0 = arg.vec(a.y);
    const paired = arg.bool(a.paired) ?? false;
    const x0 = arg.vec(a.x)!;
    const mu = arg.num(a.mu) ?? 0;
    const alternative = arg.str(a.alternative) ?? "two.sided";
    const level = arg.num(a.confLevel) ?? 0.95;
    const alpha = (alternative === "two.sided" ? (1 - level) / 2 : 1 - level) + 10 * Number.EPSILON;
    if (y0 !== undefined && !paired) {
      const x = x0.filter((v) => !Number.isNaN(v));
      const y = y0.filter((v) => !Number.isNaN(v));
      const m = x.length;
      const N = m + y.length;
      if (!(arg.bool(a.exact) ?? (m < 50 && y.length < 50)) || N > 54 || [...x, ...y].some((v) => !Number.isFinite(v))) return undefined;
      if (new Set(midRanks([...x.map((v) => v - mu), ...y])).size === N) return undefined;
      const diffs = x.flatMap((xi) => y.map((yj) => xi - yj)).sort((p, q) => p - q);
      // P(W >= w) and P(W <= w) at the shift t
      const tails = (t: number): [number, number] => {
        const r = midRanks([...x.map((v) => v - t), ...y]);
        const f = r.every(Number.isInteger) ? 1 : 2;
        const c = subsetCounts(r.map((v) => v * f), m);
        let w = 0;
        for (let i = 0; i < m; i++) w += r[i]! * f;
        let up = 0;
        let lo = 0;
        let all = 0;
        c.forEach((k, s) => {
          if (s >= w) up += k;
          if (s <= w) lo += k;
          all += k;
        });
        return [up / all, lo / all];
      };
      return { r: invert(diffs, tails, alternative, alpha, true), correct: invert(diffs, tails, alternative, alpha, false), twoSample: true };
    }
    const x = (y0 === undefined ? x0 : x0.map((v, i) => v - y0[i]!)).filter((v) => !Number.isNaN(v));
    const n = x.length;
    if (!(arg.bool(a.exact) ?? n < 50) || n > 52 || x.some((v) => !Number.isFinite(v))) return undefined;
    const d = x.map((v) => v - mu);
    const r0 = midRanks(d.map(Math.abs));
    if (!d.includes(0) && new Set(r0).size === n) return undefined;
    const walsh: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) walsh.push((x[i]! + x[j]!) / 2);
    walsh.sort((p, q) => p - q);
    // P(V >= v) (strict, R 4.6.2: P(V > v)) and P(V <= v) at the shift t
    const tails = (strict: boolean) => (t: number): [number, number] => {
      const e = x.map((v) => v - t);
      const r = midRanks(e.map(Math.abs));
      const f = r.every(Number.isInteger) ? 1 : 2;
      const c = signCounts(r.map((v) => v * f));
      let v = 0;
      e.forEach((ei, i) => (v += ei > 0 ? r[i]! * f : 0));
      let up = 0;
      let lo = 0;
      c.forEach((k, s) => {
        if (strict ? s > v : s >= v) up += k;
        if (s <= v) lo += k;
      });
      return [up / 2 ** n, lo / 2 ** n];
    };
    return { r: invert(walsh, tails(true), alternative, alpha, true), correct: invert(walsh, tails(false), alternative, alpha, false), twoSample: false };
  };
  const ref = compute();
  conditionalRefs.set(key, ref);
  return ref;
}

htestSuite({
  name: "wilcoxTest",
  call: (a) =>
    wilcoxTest(
      arg.vec(a.x)!,
      arg.vec(a.y),
      defined({
        alternative: arg.str<"two.sided" | "less" | "greater">(a.alternative),
        mu: arg.num(a.mu),
        paired: arg.bool(a.paired),
        exact: arg.bool(a.exact),
        // R 4.6's correct: a logical, or a number 0..3 (the fixture writes numbers as strings)
        correct: typeof a.correct === "string" ? (arg.num(a.correct) as 0 | 1 | 2 | 3) : arg.bool(a.correct),
        confInt: arg.bool(a.confInt),
        confLevel: arg.num(a.confLevel),
        tolRoot: arg.num(a.tolRoot),
      }),
    ),
  tolerance: 1e-12,
  // With the normal approximation, interval endpoints and the estimate are roots of a step function. When the
  // true root (a Walsh average or difference) is 0, the root search stops at a small value around 1e-5 that
  // relative error cannot measure. Use the data scale as the floor
  // The achieved confidence level 1 - alpha of an interval at a tiny requested level cancels (alpha near 1): its
  // error is that of alpha, absolute
  floor: { confInt: dataScale, estimate: dataScale, confLevel: 1 },
  knownDifference: (a, field, expected, actual) => {
    // two samples with every value tied, normal approximation: W always equals its expectation, p = 1 (R, also 4.6:
    // 0 / 0 = NaN; its exact conditional test gives 1; issue #49)
    if (field === "pValue" && Number.isNaN(expected) && actual === 1 && !(arg.bool(a.paired) ?? false)) {
      const mu = arg.num(a.mu) ?? 0;
      const all = [...(arg.vec(a.x) ?? []).map((v) => v - mu), ...(arg.vec(a.y) ?? [])].filter((v) => !Number.isNaN(v));
      if (arg.vec(a.y) !== undefined && all.every((v) => v === all[0])) return "two samples with every value tied: p = 1 (R gives NaN)";
    }
    // R 4.6.2's conditional intervals (ties, or zeros for one sample) report an end at the first or last Walsh average
    // (difference) with the tail 0, and the one-sample one rejects its lower end where P(V > v) <= a' (a strict tail;
    // the two-sample one uses P(W >= w)); rStats.js uses P(V >= v) and the tail rejected there. Both rules are
    // recomputed here with exact counts: R's value must be that of R's rule, rStats.js's that of the correct one
    if (field === "confInt" || field === "confLevel") {
      const ref = conditionalReference(a);
      const near = (u: number, v: number): boolean => u === v || Math.abs(u - v) <= 1e-12 * Math.max(Math.abs(v), 1);
      if (ref !== undefined && ref.r[field].some((v) => near(expected, v)) && ref.correct[field].some((v) => near(actual, v))) {
        if (ref.twoSample) return "two-sample conditional exact interval: R 4.6.2 reports the tail 0 for an end at the first or last difference (both rules checked by exact counts)";
        return "one-sample conditional exact interval: R 4.6.2's lower end from P(V > v), here P(V >= v) (both checked by exact counts)";
      }
    }
    // R 4.6.2's two-sided normal p-value 2 (1 - F) loses the digits of a small upper tail; here the tail itself. R's
    // value is off by the rounding of 1 - F (a few eps, absolute)
    if (field === "pValue" && actual < 1e-4 && Math.abs(expected - actual) <= 4 * Number.EPSILON && (arg.str(a.alternative) ?? "two.sided") === "two.sided") {
      return "two-sided normal p-value below 1e-4: R 4.6.2's 2 (1 - F) loses its digits";
    }
    return undefined;
  },
  // a signed rank test with only zero differences ranks nothing: an error (R returns a p-value of NaN; review 59)
  substitute: (c) => {
    const x = arg.vec(c.args.x) ?? [];
    const y = arg.vec(c.args.y);
    const mu = arg.num(c.args.mu) ?? 0;
    const paired = arg.bool(c.args.paired) ?? false;
    if (y !== undefined && !paired) return undefined;
    // (the exact test, R 4.6's default for n < 50, gives V = 0 and p = 1 there, as here)
    const exact = arg.bool(c.args.exact) ?? (y === undefined ? x : x.filter((_, i) => !Number.isNaN(y[i]!))).filter((v) => !Number.isNaN(v)).length < 50;
    const d = x.map((v, i) => (y === undefined ? v : v - y[i]!) - mu).filter((v) => !Number.isNaN(v));
    if (!exact && d.length > 0 && d.every((v) => v === 0)) {
      return { expected: { error: "no non-zero differences for the signed rank test" }, reason: "signed rank test with only zero differences: R returns NaN" };
    }
    return undefined;
  },
});
