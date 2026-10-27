import { describe, expect, it } from "vitest";
import {
  checkFixture,
  formatMismatches,
  loadFixture,
  writeMismatches,
  num,
  relativeError,
  type FixtureCase,
} from "./fixture.js";
import { precisionMode, summarize, writePrecision } from "./precision.js";
import { satisfiesDefinition as definitionHolds } from "./properties.js";

export interface FixtureSpec {
  /** Fixture name (test/fixtures/<name>.json) */
  name: string;
  /** Calls the implementation with the arguments of one fixture case */
  call: (args: FixtureCase["args"]) => number;
  /** Relative error tolerance */
  tolerance: number;
  /**
   * true for density functions. For log = true cases the error is measured as |diff| / max(|expected|, 1)
   * (a log density has no special meaning near 0, so absolute error is the appropriate measure)
   */
  density?: boolean;
  /**
   * For quantile functions: the distribution function (returning values on the same lowerTail/logP scale as p).
   * A result that disagrees with R still passes if its deviation from p when mapped back through this
   * distribution function (backward error) is no larger than that of R's answer.
   */
  backward?: (args: FixtureCase["args"], x: number) => number;
  /**
   * Cases that intentionally differ from R. Mismatching cases for which this returns a reason are excluded,
   * and the counts and reasons are printed. Reasons are also documented in docs/differences-from-r.md.
   */
  knownDifference?: (args: FixtureCase["args"], expected: number, actual: number) => string | undefined;
  /**
   * For discrete quantile functions: the distribution function (on the same scale as p). A result differing
   * from R by exactly 1 passes if the distribution function at the boundary point is within relative 1e-11
   * of p (a boundary where rounding decides the answer).
   */
  discreteCdf?: (args: FixtureCase["args"], y: number, logScale?: boolean) => number;
}

/** Backward error: relative deviation from p of the value mapped back through the distribution function */
function backwardError(spec: FixtureSpec, args: FixtureCase["args"], x: number): number {
  const p = num(args.p);
  const back = spec.backward!(args, x);
  if (back === p) return 0;
  return Math.abs(back - p) / Math.max(Math.abs(p), Number.MIN_VALUE);
}

/** The definition check of properties.ts on a fixture case (p, lowerTail and logP from its arguments) */
function satisfiesDefinition(
  args: FixtureCase["args"],
  y: number,
  cdf: (args: FixtureCase["args"], y: number, logScale?: boolean) => number,
): boolean {
  return definitionHolds(num(args.p), args.lowerTail === true, args.logP === true, y, (v, logScale) => cdf(args, v, logScale));
}

/**
 * Checks that a quantile legitimately rounds to 0 / ±Inf. The distribution function is evaluated at the
 * representable extreme just inside the answer (smallest positive / largest finite number); if it already
 * passes the target p, the true answer lies beyond it (not representable).
 */
function beyondRange(spec: FixtureSpec, args: FixtureCase["args"], actual: number): boolean {
  const p = num(args.p);
  const lower = args.lowerTail === true;
  const edge = actual === 0 ? Number.MIN_VALUE : actual > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
  const c = spec.backward!(args, edge);
  // The lower-tail probability increases in x; the upper tail decreases
  if (actual === 0) return lower ? c >= p : c <= p;
  if (actual > 0) return lower ? c <= p : c >= p;
  return lower ? c >= p : c <= p;
}

/** Whether all arguments are finite (no NaN parameters) */
function validArgs(args: FixtureCase["args"]): boolean {
  return Object.values(args).every((v) => typeof v === "boolean" || Number.isFinite(num(v)) || v === "-Inf");
}

export function fixtureSuite(spec: FixtureSpec): void {
  const fixture = loadFixture(spec.name);
  describe(spec.name, () => {
    it(`matches R (${fixture.r_version})`, () => {
      const t0 = performance.now();
      const floor = spec.density ? (a: FixtureCase["args"]) => (a.log === true ? 1 : 0) : undefined;
      const reasons = new Map<string, number>();
      const result = checkFixture(fixture, spec.call, spec.tolerance, floor);
      // Known differences: only mismatching cases are excluded, with a reason
      let mismatches = result.mismatches.filter((m) => {
        const r = spec.knownDifference?.(m.args, m.expected, m.actual);
        if (r !== undefined) reasons.set(r, (reasons.get(r) ?? 0) + 1);
        return r === undefined;
      });
      let acceptedByBackward = 0;
      let rFailed = 0;
      let borderline = 0;
      let byDefinition = 0;
      if (spec.discreteCdf) {
        mismatches = mismatches.filter((m) => {
          if (!Number.isFinite(m.actual)) return true;
          const p = num(m.args.p);
          if (Math.abs(m.actual - m.expected) === 1) {
            const c = spec.discreteCdf!(m.args, Math.min(m.actual, m.expected));
            if (Math.abs(c - p) <= 1e-11 * Math.abs(p)) {
              borderline++;
              return false;
            }
          }
          // Check with the distribution function that our answer satisfies the definition (the smallest integer meeting the condition)
          if (satisfiesDefinition(m.args, m.actual, spec.discreteCdf!)) {
            byDefinition++;
            return false;
          }
          return true;
        });
      }
      if (spec.backward) {
        mismatches = mismatches.filter((m) => {
          // We return 0 / ±Inf (answer not representable in double): pass if the distribution function at the extreme passes the target
          if ((m.actual === 0 || !Number.isFinite(m.actual)) && !Number.isNaN(m.actual) && validArgs(m.args)) {
            if (beyondRange(spec, m.args, m.actual)) {
              rFailed++;
              return false;
            }
          }
          // R returns NaN or ±Inf and we return a finite value: pass if mapping back through the distribution function recovers p
          if (Number.isFinite(m.actual) && !Number.isFinite(m.expected) && validArgs(m.args)) {
            const ok = backwardError(spec, m.args, m.actual) <= 1e-12;
            if (ok) rFailed++;
            return !ok;
          }
          if (!Number.isFinite(m.actual) || !Number.isFinite(m.expected)) return true;
          const ours = backwardError(spec, m.args, m.actual);
          const theirs = backwardError(spec, m.args, m.expected);
          const ok = ours <= theirs * (1 + 1e-9) + 4e-16;
          if (ok) acceptedByBackward++;
          return !ok;
        });
      }
      let note = spec.backward ? `, ${acceptedByBackward} passed by backward error` : "";
      if (rFailed > 0) note += `, ${rFailed} with edge handling different from R, verified with the distribution function`;
      if (borderline > 0) note += `, ${borderline} off by 1 at a boundary (distribution function within relative 1e-11 of p)`;
      if (byDefinition > 0) note += `, ${byDefinition} verified against the definition with the distribution function`;
      if (result.betterThanR > 0) note += `, ${result.betterThanR} more accurate than R (match the high-precision value)`;
      for (const [r, n] of reasons) note += `, ${n} excluded as known differences (${r})`;
      console.log(
        `${spec.name}: ${result.total} cases, max relative error ${result.maxRelError.toExponential(2)}${note}`,
      );
      if (process.env.RSTATS_WRITE_MISMATCH && mismatches.length > 0) {
        writeMismatches(spec.name, mismatches.map((m) => m.args));
      }
      if (precisionMode !== undefined) {
        writePrecision(summarize(spec.name, result.errors, mismatches.length, performance.now() - t0));
        return;
      }
      expect(mismatches, formatMismatches(mismatches)).toHaveLength(0);
    });
  });
}

export { num, relativeError };
