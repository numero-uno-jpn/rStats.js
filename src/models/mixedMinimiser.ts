// The minimiser of the mixed models (lmer's criterion over θ, glmer's Laplace deviance over θ or (θ, β)): a
// trust-region Newton method with lmer's treatment of the lower bounds of the diagonal elements of θ (the bounds are
// not enforced; columns of a block T_k whose diagonal element ends negative change sign; diagonal elements that reach
// 0 are held at exactly 0 and released when the derivative or a direction of negative curvature says so), and the
// comparison with the boundary points of whole terms. The method and its constants are described at the top of
// src/models/lmer.ts; this file only makes them independent of the criterion, so that glmer uses them as they are.
//
// Written for rStats.js (no ported code); moved from src/models/lmer.ts without changing lmer's computation.

import { ldexp, norm2 } from "../internal/summary.js";
import { maxOf, minOf } from "../internal/extremes.js";

/** The tolerances and steps of the minimiser (relative to max(1, max |x|) unless said otherwise). */
export interface MinimiserSettings {
  /** Step of the central differences that give the Hessian, relative to |x_j| ... */
  hessianStep: number;
  /** ... and at least this (relative to max(1, max |x|)), for elements at or near 0 */
  hessianStepFloor: number;
  /** Converged when the Newton step is below this ... */
  stepTolerance: number;
  /** ... or when the steps stop decreasing (rounding level) below this; steps this small are always accepted */
  stepFloor: number;
  /** The gradient on the free elements at convergence must be below this times max(1, |criterion|) */
  gradientTolerance: number;
  /** An element held at 0 is released when its derivative is above this times max(1, |criterion|) */
  releaseTolerance: number;
}

/** lmer's settings (an analytic gradient) */
export const LMER_SETTINGS: MinimiserSettings = {
  hessianStep: 1e-4,
  hessianStepFloor: 1e-6,
  stepTolerance: 1e-13,
  stepFloor: 1e-10,
  gradientTolerance: 1e-9,
  releaseTolerance: 1e-12,
};

/** Initial trust-region radius, relative to max(1, max |x|) */
const INITIAL_RADIUS = 0.25;
/** Eigenvalues of the Hessian below this times the largest are treated as 0 (the Hessian's own accuracy) */
const EIGENVALUE_TOLERANCE = 1e-6;
/** Diagonal elements below this (relative to max(1, max |x|)) at convergence are candidates for the boundary */
const BOUNDARY_CANDIDATE = 1e-4;
/** The move along a direction of negative curvature that leaves the boundary (relative to max(1, max |x|)) */
const NEGATIVE_CURVATURE_MOVE = 1e-3;
const MAX_ITERATIONS = 500;
/** The Hessian is used again after a Newton step whose actual reduction is within this ratio of the predicted one */
const HESSIAN_REUSE_RATIO = 0.75;

/** A restart from a boundary point must lower the criterion by more than this times max(1, |criterion|) ... */
const RESTART_THRESHOLD = 1e-8;
/** ... and there are at most this many restarts */
const MAX_RESTARTS = 50;

/**
 * A criterion to minimise (internal): its value and gradient at x, which elements are diagonal elements of θ (lower
 * bound 0, held at exactly 0 on the boundary), and the columns of the blocks T_k (lists of indices of x, the diagonal
 * element first) whose sign may change without changing the criterion. Elements that are neither (off-diagonal
 * elements of θ, fixed effects) are free.
 */
export interface MinimiserProblem {
  /** The criterion and its gradient at x (all elements) */
  evaluate: (x: readonly number[]) => { f: number; g: number[] };
  /**
   * The Hessian on the elements `set` at x (optional; default: central differences of `evaluate`'s gradient with
   * the settings' steps). `scale` is max(1, max |x|).
   */
  hessian?: (x: readonly number[], set: readonly number[], scale: number) => number[][];
  diagonal: readonly boolean[];
  columns: readonly (readonly number[])[];
  settings: MinimiserSettings;
  /**
   * What a non-finite criterion at a trial point means: false, an error (lmer, whose criterion is finite wherever
   * defined); true, a rejected step (glmer, whose evaluations can fail far from the optimum)
   */
  rejectNonFinite: boolean;
  /** The message of the Error thrown when the minimisation does not converge */
  failure: string;
  /**
   * glmer's safeguards (lmer's minimisation is unchanged without them): a boundary sub-problem of
   * {@link minimiseWithRestarts} that fails is left out of the comparison instead of failing the minimisation; a
   * gradient that fails at a point of the differences of the Hessian is replaced by the one-sided difference; and
   * steps rejected again and again at the smallest radius (the criterion cannot tell the trial from the point to
   * rounding) end the minimisation there, converged if the gradient is below the tolerance (see localMinimum)
   */
  robust?: boolean;
}

/** The result of a local minimisation: the point, its criterion and whether it converged */
export interface MinimiserResult {
  theta: number[];
  f: number;
  /** false only with `bestOnFailure`: the best point reached before the minimisation failed */
  converged: boolean;
}

/** The failure of a local minimisation, with the best point reached (internal) */
class MinimisationFailure extends Error {
  constructor(
    message: string,
    readonly best: { theta: number[]; f: number } | undefined,
  ) {
    super(message);
  }
}

/** Rejected steps in a row at the smallest radius after which a robust minimisation stops (see localMinimum) */
const MAX_STALLS = 3;

/** Eigenvalues and eigenvectors of a small symmetric matrix by cyclic Jacobi rotations; vectors[k] is the k-th vector */
export function symmetricEigen(a0: readonly (readonly number[])[]): { values: number[]; vectors: number[][] } {
  // entries of extreme magnitude are scaled by a power of 2 (exact) first and the eigenvalues scaled back: the sums of
  // squares below overflowed for entries around 1e200 (Infinity <= 1e-32 Infinity ended the sweeps at once)
  let mx = 0;
  for (const row of a0) for (const v of row) mx = Math.max(mx, Math.abs(v));
  const k = mx === 0 || !Number.isFinite(mx) || (mx >= 2 ** -256 && mx <= 2 ** 256) ? 0 : Math.floor(Math.log2(mx));
  if (k !== 0) {
    const r = symmetricEigen(a0.map((row) => row.map((v) => ldexp(v, -k))));
    return { values: r.values.map((v) => ldexp(v, k)), vectors: r.vectors };
  }
  const m = a0.length;
  const a = a0.map((row) => row.slice());
  const v = a.map((_, i) => a.map((_, j): number => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    let total = 0;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        total += a[i]![j]! ** 2;
        if (i !== j) off += a[i]![j]! ** 2;
      }
    }
    if (off <= 1e-32 * total) break;
    for (let p = 0; p < m - 1; p++) {
      for (let q = p + 1; q < m; q++) {
        const apq = a[p]![q]!;
        if (apq === 0) continue;
        const tau = (a[q]![q]! - a[p]![p]!) / (2 * apq);
        const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const sn = t * c;
        for (let k = 0; k < m; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - sn * akq;
          a[k]![q] = sn * akp + c * akq;
        }
        for (let k = 0; k < m; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - sn * aqk;
          a[q]![k] = sn * apk + c * aqk;
        }
        for (let k = 0; k < m; k++) {
          const vkp = v[k]![p]!;
          const vkq = v[k]![q]!;
          v[k]![p] = c * vkp - sn * vkq;
          v[k]![q] = sn * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]!), vectors: a.map((_, k) => v.map((row) => row[k]!)) };
}

// without overflow of the squares (src/internal/summary.ts)
const norm = norm2;
const dot = (x: readonly number[], y: readonly number[]): number => x.reduce((sum, v, i) => sum + v * y[i]!, 0);

/**
 * The step p that minimises g'p + p'Hp/2 subject to ‖p‖ ≤ radius (H = V diag(λ) V'), and whether it is the Newton
 * step. Eigenvalues within `zero` of 0 are treated as 0: along their eigenvectors the criterion is flat to the
 * accuracy of the Hessian (as along a set of equivalent minimisers), and the Newton step leaves them out when the
 * gradient's component there is below `gradientZero`.
 */
function trustRegionStep(
  g: readonly number[],
  eig: { values: number[]; vectors: number[][] },
  radius: number,
  zero: number,
  gradientZero: number,
): { step: number[]; newton: boolean } {
  const m = g.length;
  const { values, vectors } = eig;
  const gt = vectors.map((v) => dot(v, g));
  const combine = (coef: number[]): number[] => {
    const p = new Array<number>(m).fill(0);
    coef.forEach((c, k) => vectors[k]!.forEach((vi, i) => (p[i]! += c * vi)));
    return p;
  };
  const minValue = minOf(values);
  // the Newton step, if the Hessian is positive semidefinite, the gradient has no component along its null
  // directions, and the step is inside the region (≥: a Hessian of zeros, where zero is 0, is semidefinite; a flat
  // criterion with a zero gradient, as glmer's in β where θ = 0 and the aic term is constant, is at a minimiser)
  if (minValue >= -zero && values.every((l, k) => l > zero || Math.abs(gt[k]!) <= gradientZero)) {
    const p = combine(values.map((l, k) => (l > zero ? -gt[k]! / l : 0)));
    if (norm(p) <= radius) return { step: p, newton: true };
  }
  // on the boundary: p(μ) = −Σ gt_k / (λ_k + μ) v_k with ‖p(μ)‖ = radius, μ > max(0, −λ_min), by bisection
  const lowest = Math.max(0, -minValue);
  const lengthAt = (mu: number): number => norm2(values.map((l, k) => gt[k]! / (l + mu)));
  const tiny = Math.max(zero, 1e-12 * Math.max(maxOf(values.map(Math.abs)), 1));
  if (lengthAt(lowest + tiny) >= radius) {
    let lo = lowest + tiny;
    let hi = lowest + norm(g) / radius + maxOf(values.map(Math.abs)) + tiny;
    for (let k = 0; k < 200 && hi - lo > 1e-15 * hi; k++) {
      const mid = (lo + hi) / 2;
      if (lengthAt(mid) > radius) lo = mid;
      else hi = mid;
    }
    return { step: combine(values.map((l, k) => -gt[k]! / (l + hi))), newton: false };
  }
  // the "hard case": the gradient has (almost) no component along the eigenvectors of the lowest eigenvalue; the
  // step at μ = −λ_min is completed to the boundary along such an eigenvector
  const low = values.map((l) => l + lowest <= tiny);
  const p = combine(values.map((l, k) => (low[k] ? 0 : -gt[k]! / (l + lowest))));
  const k0 = values.indexOf(minValue);
  const rest = Math.sqrt(Math.max(0, radius * radius - dot(p, p)));
  const direction = -Math.sign(gt[k0]!) || 1;
  return { step: p.map((pi, i) => pi + direction * rest * vectors[k0]![i]!), newton: false };
}

/**
 * A local minimiser of the criterion, subject to the lower bounds of the diagonal elements (see src/models/lmer.ts),
 * started at `start`, with the elements in `held` kept at exactly 0 throughout (never free, never released); with its
 * criterion
 */
export function localMinimum(problem: MinimiserProblem, start: readonly number[], held: ReadonlySet<number> = new Set()): { theta: number[]; f: number } {
  const { diagonal, settings } = problem;
  const robust = problem.robust === true;

  let theta = start.map((v, j) => (held.has(j) ? 0 : v));
  /** The lowest point evaluated with a finite criterion and gradient (robust: reported with a failure) */
  let best: { theta: number[]; f: number } | undefined;
  const evaluate = (x: readonly number[]): { f: number; g: number[] } => {
    const r = problem.evaluate(x);
    if (robust && Number.isFinite(r.f) && r.g.every(Number.isFinite) && (best === undefined || r.f < best.f)) {
      best = { theta: x.map((v) => (v === 0 ? 0 : v)), f: r.f };
    }
    return r;
  };
  const fail = (): never => {
    throw robust ? new MinimisationFailure(problem.failure, best) : new Error(problem.failure);
  };
  let { f, g } = evaluate(theta);
  // (glmer: an evaluation that fails where the search must go on is an error)
  const check = (): void => {
    if (problem.rejectNonFinite && !Number.isFinite(f)) fail();
  };
  check();
  /** Diagonal elements held at exactly 0 */
  const fixed = new Set<number>();
  /** Diagonal elements released from 0 (not set to 0 again: their minimiser is near 0 but not at it) */
  const released = new Set<number>();
  const scaleOf = (): number => Math.max(1, ...theta.map(Math.abs));
  const gradientTolerance = (): number => settings.gradientTolerance * Math.max(1, Math.abs(f));
  let radius = INITIAL_RADIUS * scaleOf();
  let previousNewton = Infinity;
  /** The Hessian of the last iteration, when it may be used again (see iterate) */
  let reusable: { free: number[]; h: number[][] } | undefined;

  /** The Hessian on the elements `set`, from central differences of the gradient (or the problem's own) */
  const hessian = (set: number[]): number[][] => {
    if (problem.hessian !== undefined) {
      const h = problem.hessian(theta, set, scaleOf());
      if (h.some((row) => row.some((v) => !Number.isFinite(v)))) fail();
      return h;
    }
    const floor = settings.hessianStepFloor * scaleOf();
    const cols = set.map((j) => {
      const h = Math.max(settings.hessianStep * Math.abs(theta[j]!), floor);
      const plus = theta.slice();
      plus[j] = theta[j]! + h;
      const minus = theta.slice();
      minus[j] = theta[j]! - h;
      const gp = evaluate(plus).g;
      const gm = evaluate(minus).g;
      if (robust) {
        // (glmer: where the gradient fails on one side, the one-sided difference with the gradient at θ)
        const okP = set.every((i) => Number.isFinite(gp[i]!));
        const okM = set.every((i) => Number.isFinite(gm[i]!));
        if (!okP && !okM) fail();
        if (!okP || !okM) return set.map((i) => (okP ? gp[i]! - g[i]! : g[i]! - gm[i]!) / h);
      }
      return set.map((i) => (gp[i]! - gm[i]!) / (2 * h));
    });
    return set.map((_, a) => set.map((_, b) => (cols[a]![b]! + cols[b]![a]!) / 2));
  };

  /** Rejected steps in a row taken at the smallest radius (robust) */
  let stalls = 0;
  /** One trust-region iteration on the free elements; returns whether it converged */
  const iterate = (free: number[]): boolean => {
    const radiusFloor = settings.stepTolerance * scaleOf();
    const atFloor = radius <= radiusFloor;
    // (robust: at the smallest radius with a small gradient, the point is the minimiser to the accuracy of the
    // criterion: the steps there are at the level of the gradient's rounding and need not become Newton steps)
    if (robust && atFloor && free.every((j) => Math.abs(g[j]!) <= gradientTolerance())) return true;
    const fresh = reusable === undefined || reusable.free.length !== free.length || reusable.free.some((j, a) => j !== free[a]);
    const h = fresh ? hessian(free) : reusable!.h;
    reusable = undefined;
    const eig = symmetricEigen(h);
    // (a Hessian with NaN, from a criterion whose products overflowed, has no step: the minimisation's failure, not
    // the TypeError of an eigenvalue that is never the smallest)
    if (!eig.values.every(Number.isFinite)) fail();
    const zero = EIGENVALUE_TOLERANCE * maxOf(eig.values.map(Math.abs));
    const gFree = free.map((j) => g[j]!);
    const { step, newton } = trustRegionStep(gFree, eig, radius, zero, gradientTolerance());
    const trial = theta.slice();
    free.forEach((j, a) => (trial[j] = theta[j]! + step[a]!));
    const size = maxOf(step.map(Math.abs)) / scaleOf();
    const next = evaluate(trial);
    const length = norm(step);
    const stalled = (): boolean => {
      // (robust: a step rejected at the smallest radius cannot become smaller; after MAX_STALLS of them the point
      // is the minimiser to the accuracy of the criterion if the gradient is small, and a failure otherwise)
      if (!robust || !atFloor) return false;
      stalls++;
      if (stalls < MAX_STALLS) return false;
      if (free.every((j) => Math.abs(g[j]!) <= gradientTolerance())) return true;
      return fail();
    };
    if (!Number.isFinite(next.f)) {
      if (!problem.rejectNonFinite) throw new Error(problem.failure);
      // (a failed evaluation counts as +Infinity: the step is rejected and the region shrinks)
      radius = Math.max(length / 4, settings.stepTolerance * scaleOf());
      previousNewton = Infinity;
      return stalled();
    }
    const predicted = -(dot(gFree, step) + dot(step, h.map((row) => dot(row, step))) / 2);
    // the actual reduction from the values, or, where they are equal to rounding, from the gradients (trapezoid);
    // robust (glmer): within 1e-8 max(1, |f|), as glmer's deviance is a sum of terms of order 1 where it is near 0
    // and can be noisy at 1e-10 of its value (the aic term of a Gamma fit with a dispersion of 1e-16), while its
    // analytic gradient is smooth
    const roundingLevel = robust ? 1e-8 * Math.max(1, Math.abs(f)) : 1e-10 * Math.abs(f);
    const actual = Math.abs(f - next.f) > roundingLevel ? f - next.f : -(dot(gFree, step) + dot(free.map((j) => next.g[j]!), step)) / 2;
    const ratio = predicted > 0 ? actual / predicted : actual >= 0 ? 1 : -1;
    const accepted = ratio > 0.1 || size <= settings.stepFloor;
    if (accepted) {
      theta = trial;
      f = next.f;
      g = next.g;
      stalls = 0;
    } else if (stalled()) return true;
    if (ratio < 0.25) radius = Math.max(length / 4, settings.stepTolerance * scaleOf());
    else if (ratio > 0.75 && length >= 0.99 * radius) radius *= 2;
    if (!newton) {
      previousNewton = Infinity;
      return false;
    }
    const gradientSmall = free.every((j) => Math.abs(g[j]!) <= gradientTolerance());
    // (the steps stopping decreasing is taken as rounding level only with a fresh Hessian)
    const done = gradientSmall && (size <= settings.stepTolerance || (fresh && size <= settings.stepFloor && size >= 0.5 * previousNewton));
    // the Hessian is kept for the next iteration after a Newton step that was accepted, predicted well and at most
    // half the previous one (the model is still good; convergence stays fast)
    if (ratio > HESSIAN_REUSE_RATIO && ratio < 1 / HESSIAN_REUSE_RATIO && size < 0.5 * previousNewton) reusable = { free, h };
    previousNewton = size;
    return done;
  };

  /**
   * At a converged point with elements held at 0: a direction of negative curvature of the elements held there
   * whose derivative vanishes, together with the free ones, is a way down (in a block whose leading diagonal element
   * is 0, the criterion depends on it and the element below through their product, so neither alone shows the
   * descent; for a single even element it is its own curvature at 0). If there is one, the elements held at 0 along
   * it are released and θ is moved a little along it; returns whether it did.
   */
  const leaveAlongNegativeCurvature = (): boolean => {
    if (fixed.size === 0) return false;
    const set = theta.map((_, j) => j).filter((j) => !held.has(j));
    const eig = symmetricEigen(hessian(set));
    const zero = EIGENVALUE_TOLERANCE * maxOf(eig.values.map(Math.abs));
    const k = eig.values.indexOf(minOf(eig.values));
    if (!(eig.values[k]! < -zero)) return false;
    const v = eig.vectors[k]!;
    const leaving = set.filter((j, a) => fixed.has(j) && Math.abs(v[a]!) > 1e-8);
    if (leaving.length === 0) return false;
    for (const j of leaving) {
      fixed.delete(j);
      released.add(j);
    }
    const move = NEGATIVE_CURVATURE_MOVE * scaleOf();
    set.forEach((j, a) => (theta[j] = theta[j]! + move * v[a]!));
    ({ f, g } = evaluate(theta));
    check();
    return true;
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const free = theta.map((_, j) => j).filter((j) => !fixed.has(j) && !held.has(j));
    if (free.length > 0 && !iterate(free)) continue;
    // converged on the free elements. Diagonal elements that reached 0 (to rounding) are held at exactly 0
    const toZero = free.filter((j) => diagonal[j] && !released.has(j) && Math.abs(theta[j]!) < BOUNDARY_CANDIDATE * scaleOf());
    if (toZero.length > 0) {
      for (const j of toZero) {
        theta[j] = 0;
        fixed.add(j);
      }
      ({ f, g } = evaluate(theta));
      check();
      previousNewton = Infinity;
      reusable = undefined;
      continue;
    }
    // elements held at 0 with a derivative, or with a direction of negative curvature, are released
    const tolerance = settings.releaseTolerance * Math.max(1, Math.abs(f));
    const release = [...fixed].filter((j) => Math.abs(g[j]!) > tolerance);
    if (release.length > 0) {
      for (const j of release) {
        fixed.delete(j);
        released.add(j);
      }
    } else if (!leaveAlongNegativeCurvature()) {
      // the minimiser: each column of T_k with a negative diagonal element changes sign (an equivalent θ)
      for (const column of problem.columns) {
        if (theta[column[0]!]! < 0) for (const j of column) theta[j] = -theta[j]!;
      }
      return { theta: theta.map((v) => (v === 0 ? 0 : v)), f }; // no -0
    }
    radius = Math.max(radius, INITIAL_RADIUS * BOUNDARY_CANDIDATE * scaleOf());
    previousNewton = Infinity;
    reusable = undefined;
  }
  return fail();
}

/**
 * The minimiser: the local minimum reached from `start`, then compared with the local minima reached from its
 * boundary points with one whole term removed (`blocks`: the indices of each term's block); a clearly better one is
 * the start of a new local minimisation, until none is (see src/models/lmer.ts). Returns the minimiser and its
 * criterion.
 */
export function minimiseWithRestarts(
  problem: MinimiserProblem,
  start: readonly number[],
  blocks: readonly (readonly number[])[],
  options: { bestOnFailure?: boolean } = {},
): MinimiserResult {
  /** A local minimisation; robust: a failure as undefined (with the best point reached in `lastBest`) */
  let lastBest: { theta: number[]; f: number } | undefined;
  const local = (from: readonly number[], held?: ReadonlySet<number>): { theta: number[]; f: number } | undefined => {
    if (problem.robust !== true) return localMinimum(problem, from, held);
    try {
      return localMinimum(problem, from, held);
    } catch (e) {
      if (!(e instanceof MinimisationFailure)) throw e;
      lastBest = e.best;
      return undefined;
    }
  };
  const failed = (): MinimiserResult => {
    if (options.bestOnFailure === true && lastBest !== undefined) return { ...lastBest, converged: false };
    throw new Error(problem.failure);
  };
  const first = local(start);
  if (first === undefined) return failed();
  let best = first;
  for (let round = 0; round < MAX_RESTARTS; round++) {
    let candidate: { theta: number[]; f: number } | undefined;
    for (const block of blocks) {
      if (block.every((j) => best.theta[j] === 0)) continue;
      // (robust: a boundary sub-problem that fails is left out; the comparison is with those that converge)
      const removed = local(best.theta, new Set(block));
      if (removed !== undefined && (candidate === undefined || removed.f < candidate.f)) candidate = removed;
    }
    if (candidate === undefined || !(candidate.f < best.f - RESTART_THRESHOLD * Math.max(1, Math.abs(best.f)))) return { ...best, converged: true };
    const next = local(candidate.theta);
    if (next === undefined) return failed();
    best = next;
  }
  throw new Error(problem.failure);
}
