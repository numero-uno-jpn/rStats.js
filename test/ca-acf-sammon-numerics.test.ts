import { describe, expect, it } from "vitest";
import { acf, pacf, ccf } from "../src/entries/timeseries.js";
import { ca, caSummary, caCoord, mjca, sammon, isoMDS, type DistResult } from "../src/entries/multivariate.js";

function close(a: number, b: number, tolerance = 1e-11): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(b)));
}
function maxDifference(a: readonly number[], b: readonly number[]): number {
  let maximum = 0;
  for (let i = 0; i < a.length; i++) maximum = Math.max(maximum, Math.abs(a[i]! - b[i]!));
  return maximum;
}
function distFromPoints(points: readonly (readonly number[])[]): DistResult {
  const values: number[] = [];
  for (let j = 0; j < points.length - 1; j++) for (let i = j + 1; i < points.length; i++) {
    let scale = 0, sum = 1;
    for (let q = 0; q < points[i]!.length; q++) {
      const v = Math.abs(points[i]![q]! - points[j]![q]!);
      if (v === 0) continue;
      if (scale < v) { sum = 1 + sum * (scale / v) ** 2; scale = v; }
      else sum += (v / scale) ** 2;
    }
    values.push(scale === 0 ? 0 : scale * Math.sqrt(sum));
  }
  return { values, size: points.length, labels: null, method: "euclidean", diag: false, upper: false, warnings: [] };
}

// Exact integer sums, then a 220-bit fixed-point ratio: this is independent of
// the floating-point centering and summation used by acf().
function exactRhoFixed(values: readonly number[], lag: number, q: bigint): bigint {
  const x = values.map(BigInt), n = BigInt(x.length);
  let sx = 0n, sxx = 0n;
  for (const v of x) { sx += v; sxx += v * v; }
  let product = 0n, left = 0n, right = 0n;
  for (let t = 0; t < x.length - lag; t++) {
    product += x[t + lag]! * x[t]!;
    left += x[t + lag]!;
    right += x[t]!;
  }
  const numerator = n * n * product - n * sx * (left + right) + BigInt(x.length - lag) * sx * sx;
  const denominator = n * (n * sxx - sx * sx);
  return numerator * q / denominator;
}
function exactPacfFixed(values: readonly number[], lagMax: number): number[] {
  const q = 1n << 220n;
  const rho = Array.from({ length: lagMax + 1 }, (_, lag) => exactRhoFixed(values, lag, q));
  const previous: bigint[] = [], result: number[] = [];
  for (let k = 1; k <= lagMax; k++) {
    let numerator = rho[k]!, denominator = q;
    for (let j = 1; j < k; j++) {
      numerator -= previous[j - 1]! * rho[k - j]! / q;
      denominator -= previous[j - 1]! * rho[j]! / q;
    }
    const phi = numerator * q / denominator;
    const next = new Array<bigint>(k);
    for (let j = 1; j < k; j++) next[j - 1] = previous[j - 1]! - phi * previous[k - j - 1]! / q;
    next[k - 1] = phi;
    previous.splice(0, previous.length, ...next);
    result.push(Number(phi) / Number(q));
  }
  return result;
}
function exactRho(values: readonly number[], lag: number): number {
  const q = 1n << 220n;
  return Number(exactRhoFixed(values, lag, q)) / Number(q);
}

describe("A: acf / pacf / ccf numeric stability", () => {
  it("keeps correlations invariant and covariance on its squared scale at 2^±500 and 2^±1000", () => {
    const x = [2, -1, 4, 0, 3, 7, -2, 5, 1, 6];
    const y = [1, 3, -2, 5, 0, 2, 7, -1, 4, 6];
    const base = acf(x, { lagMax: 6 });
    const baseCov = acf(x, { type: "covariance", lagMax: 6 });
    const baseCross = ccf(x, y, { lagMax: 4 });
    const baseCrossCov = ccf(x, y, { type: "covariance", lagMax: 4 });
    for (const exponent of [-1000, -500, 500, 1000]) {
      const scale = 2 ** exponent;
      const scaled = x.map((v) => v * scale), scaledY = y.map((v) => v * scale);
      const corr = acf(scaled, { lagMax: 6 });
      const cross = ccf(scaled, scaledY, { lagMax: 4 });
      for (let i = 0; i < base.acf.length; i++) close(corr.acf[i]!, base.acf[i]!, 1e-12);
      for (let i = 0; i < baseCross.acf.length; i++) close(cross.acf[i]!, baseCross.acf[i]!, 1e-12);
      const cov = acf(scaled, { type: "covariance", lagMax: 6 });
      const crossCov = ccf(scaled, scaledY, { type: "covariance", lagMax: 4 });
      if (Math.abs(exponent) === 1000) {
        if (exponent > 0) {
          expect(cov.acf.some((v) => !Number.isFinite(v))).toBe(true);
          expect(crossCov.acf.some((v) => !Number.isFinite(v))).toBe(true);
        } else {
          expect(cov.acf.every((v) => v === 0)).toBe(true);
          expect(crossCov.acf.every((v) => v === 0)).toBe(true);
        }
      } else {
        const square = scale * scale;
        for (let i = 0; i < cov.acf.length; i++) close(cov.acf[i]!, baseCov.acf[i]! * square, 1e-11);
        for (let i = 0; i < crossCov.acf.length; i++) close(crossCov.acf[i]!, baseCrossCov.acf[i]! * square, 1e-11);
      }
    }
  });

  it("is invariant to offsets of 1e8 and 1e12 for acf and ccf", () => {
    const x = Array.from({ length: 257 }, (_, i) => Math.sin(i * 0.17) + (i % 11) / 7);
    const y = Array.from({ length: 257 }, (_, i) => Math.cos(i * 0.13) - (i % 7) / 9);
    for (const offset of [1e8, 1e12]) {
      const a = acf(x, { lagMax: 40 }), b = acf(x.map((v) => v + offset), { lagMax: 40 });
      const c = ccf(x, y, { lagMax: 40 }), d = ccf(x.map((v) => v + offset), y.map((v) => v - offset), { lagMax: 40 });
      expect(maxDifference(a.acf, b.acf)).toBeLessThan(2e-12);
      expect(maxDifference(c.acf, d.acf)).toBeLessThan(2e-12);
    }
  });

  it("matches exact integer autocorrelations for a 100,000-point series and lag 0, 1, 100", () => {
    const x = Array.from({ length: 100000 }, (_, i) => ((i * 48271) % 997) - 498);
    const result = acf(x, { lagMax: 100 });
    for (const lag of [0, 1, 100]) close(result.acf[lag]!, exactRho(x, lag), 2e-13);
    expect(result.acf).toHaveLength(101);
  });

  it("matches a 220-bit Durbin-Levinson reference when rho(1) is close to one", () => {
    const x = Array.from({ length: 5000 }, (_, i) => i * 1000000 + ((i * 17) % 13));
    const expected = exactPacfFixed(x, 40), actual = pacf(x, { lagMax: 40 }).acf;
    expect(acf(x, { lagMax: 1 }).acf[1]).toBeGreaterThan(0.99999);
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) close(actual[i]!, expected[i]!, 2e-11);
  });

  it("handles constant series, N=1/2, lagMax=0, NaN pass and Infinity", () => {
    expect(acf([5, 5, 5]).acf.every(Number.isNaN)).toBe(true);
    expect(acf([7]).acf).toEqual([1]);
    expect(pacf([7]).acf).toEqual([]);
    expect(acf([1, 2], { lagMax: 0 }).acf).toHaveLength(1);
    expect(pacf([1, 2], { lagMax: 1 }).acf).toHaveLength(1);
    expect(acf([1, NaN, 3], { naAction: "pass", lagMax: 1 }).acf).toHaveLength(2);
    expect(acf([1, Infinity, 3], { lagMax: 1 }).acf.every(Number.isNaN)).toBe(true);
  });
});

describe("A: ca / mjca / Sammon / isoMDS numeric stability", () => {
  it("keeps CA masses, singular values and coordinates invariant under 2^±500 and 2^±1000 table scaling", () => {
    const values = [[3, 2, 5, 4], [1, 6, 4, 3], [7, 2, 3, 8], [4, 5, 2, 6]];
    const base = ca(values);
    for (const exponent of [-1000, -500, 500, 1000]) {
      const scale = 2 ** exponent, scaled = ca(values.map((row) => row.map((v) => v * scale)));
      expect(maxDifference(scaled.sv, base.sv)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.rowmass, base.rowmass)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.colmass, base.colmass)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.rowdist, base.rowdist)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.coldist, base.coldist)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.rowinertia, base.rowinertia)).toBeLessThan(2e-12);
      expect(maxDifference(scaled.colinertia, base.colinertia)).toBeLessThan(2e-12);
      for (let i = 0; i < base.rowcoord.values.length; i++) expect(maxDifference(scaled.rowcoord.values[i]!, base.rowcoord.values[i]!)).toBeLessThan(2e-10);
      for (let i = 0; i < base.colcoord.values.length; i++) expect(maxDifference(scaled.colcoord.values[i]!, base.colcoord.values[i]!)).toBeLessThan(2e-10);
      const baseSummary = caSummary(base), scaledSummary = caSummary(scaled);
      expect(maxDifference(baseSummary.scree.values.map((r) => r[1]!), scaledSummary.scree.values.map((r) => r[1]!))).toBeLessThan(2e-12);
      const baseMap = caCoord(base), scaledMap = caCoord(scaled);
      if ("columns" in baseMap && "columns" in scaledMap) {
        expect(maxDifference(baseMap.rows.values[0]!, scaledMap.rows.values[0]!)).toBeLessThan(2e-10);
        expect(maxDifference(baseMap.columns.values[0]!, scaledMap.columns.values[0]!)).toBeLessThan(2e-10);
      } else throw new Error("caCoord did not return row and column maps");
    }
  });

  it("handles 2x2, independent and one-dimensional CA tables", () => {
    expect(ca([[2, 1], [1, 3]]).sv.length).toBe(1);
    expect(ca([[1, 1], [1, 1]]).sv[0]).toBeLessThan(1e-12);
    expect(ca([[1, 2, 3]]).sv).toEqual([0]);
    expect(ca([[1], [2], [3]]).sv).toEqual([0]);
    expect(caSummary(ca([[1, 2, 3]])).scree.values.length).toBe(1);
    expect(caSummary(ca([[1, 1], [1, 1]])).scree.values.length).toBe(1);
    expect(() => ca([[1, Infinity], [2, 3]])).toThrow();
    expect(() => ca([[1, NaN], [2, 3]])).toThrow();
  });

  it("keeps Sammon and isoMDS stress invariant and coordinates proportional at 2^±500 and 2^±1000", () => {
    const points = [[0, 0, 0], [1, 0, 0], [0, 2, 0], [1, 1, 1], [2, 0, 2], [2, 2, 1]];
    const d = distFromPoints(points);
    const samBase = sammon(d, { niter: 12 });
    const isoBase = isoMDS(d, { maxit: 5000, tol: 1e-10 });
    for (const exponent of [-1000, -500, 500, 1000]) {
      const scale = 2 ** exponent;
      const scaledD: DistResult = { ...d, values: d.values.map((v) => v * scale) };
      const samScaled = sammon(scaledD, { niter: 12 });
      const isoScaled = isoMDS(scaledD, { maxit: 5000, tol: 1e-10 });
      close(samScaled.stress, samBase.stress, 2e-10);
      close(isoScaled.stress, isoBase.stress, 2e-10);
      for (let i = 0; i < samBase.points.values.length; i++) for (let q = 0; q < samBase.points.values[i]!.length; q++) {
        close(samScaled.points.values[i]![q]! / scale, samBase.points.values[i]![q]!, 2e-9);
      }
      for (let i = 0; i < isoBase.points.values.length; i++) for (let q = 0; q < isoBase.points.values[i]!.length; q++) {
        close(isoScaled.points.values[i]![q]! / scale, isoBase.points.values[i]![q]!, 2e-9);
      }
    }
  });

  it("keeps Sammon updates finite for close but distinct points", () => {
    const d: DistResult = { values: [1e-12, 1, 1 + 1e-12, 1, 1 + 2e-12, 1e-12], size: 4, labels: null, method: null, diag: false, upper: false, warnings: [] };
    const y = [[0, 0], [1e-12, 0], [0, 1], [1, 1]];
    const result = sammon(d, { y, niter: 5 });
    expect(Number.isFinite(result.stress)).toBe(true);
    expect(result.points.values.every((row) => row.every(Number.isFinite))).toBe(true);
  });
});

describe("A: requested large-input timings (also logged by CI)", () => {
  it("runs acf N=100,000 lagMax=100, ca 1000x50, mjca 10,000x10, Sammon and isoMDS n=500", () => {
    const timings: Record<string, number> = {};
    const timed = <T>(name: string, action: () => T): T => {
      const start = performance.now(), result = action();
      timings[name] = performance.now() - start;
      return result;
    };
    const long = Array.from({ length: 100000 }, (_, i) => Math.sin(i * 0.01) + Math.cos(i * 0.003));
    expect(timed("acf_100k_lag100", () => acf(long, { lagMax: 100 })).acf).toHaveLength(101);

    const caTable = Array.from({ length: 1000 }, (_, i) => Array.from({ length: 50 }, (_, j) => 1 + ((i * 17 + j * 31) % 97)));
    expect(timed("ca_1000x50", () => ca(caTable)).sv.length).toBeGreaterThan(0);

    const cols = Array.from({ length: 10 }, (_, j) => "V" + (j + 1));
    const categorical = Array.from({ length: 10000 }, (_, i) => Array.from({ length: 10 }, (_, j) => "L" + ((i * 7 + j * 3 + i * j) % 5)));
    expect(timed("mjca_10000x10", () => mjca({ rows: null, cols, values: categorical })).sv.length).toBeGreaterThan(0);

    const coordinates = Array.from({ length: 500 }, (_, i) => [
      Math.sin(i * 0.17), Math.cos(i * 0.13), Math.sin(i * 0.07) * Math.cos(i * 0.11),
    ]);
    const d = distFromPoints(coordinates);
    expect(Number.isFinite(timed("sammon_n500_10it", () => sammon(d, { niter: 10 })).stress)).toBe(true);
    expect(Number.isFinite(timed("isoMDS_n500_10it", () => isoMDS(d, { maxit: 10 })).stress)).toBe(true);
    console.info("1.11 numerics timings (ms): " + JSON.stringify(timings));
  });
});
