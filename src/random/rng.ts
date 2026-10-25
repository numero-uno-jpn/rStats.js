// RNG state and the basic generators underlying each distribution's variates.
//
// As in R, there is a single state (set by setSeed). The default is R's
// RNGkind("Mersenne-Twister", "Inversion", "Rejection"); the uniform generator can be switched to
// "L'Ecuyer-CMRG" and the sample kind to "Rounding" (R before 3.6.0).
// The procedures were verified against R's ?RNG and ?Random documentation and observed output.

import { MersenneTwister } from "./mt.js";
import { Mrg32k3a, checkState } from "./lecuyer.js";
import { ppnd16 } from "./as241.js";

/** A uniform random number generator, R's `RNGkind(kind)`. */
export type RNGKindName = "Mersenne-Twister" | "L'Ecuyer-CMRG";
/** How `sample` turns uniforms into indices, R's `RNGkind(sample.kind)`. */
export type SampleKindName = "Rejection" | "Rounding";

/** Options for {@link RNGkind}. Omitted entries keep the current setting, as in R. */
export interface RNGKindOptions {
  /** Uniform generator: `"Mersenne-Twister"` (R's default), `"L'Ecuyer-CMRG"`, or `"default"`. */
  kind?: RNGKindName | "default" | undefined;
  /**
   * `"Rejection"` (R's default since 3.6.0), `"Rounding"` (the `sample` of R before 3.6.0, to
   * reproduce older results), or `"default"`.
   */
  sampleKind?: SampleKindName | "default" | undefined;
}

/** The kinds in effect, as returned by {@link RNGkind}. */
export interface RNGKinds {
  /** The uniform generator. */
  kind: RNGKindName;
  /** Always `"Inversion"` (the only normal kind supported). */
  normalKind: "Inversion";
  /** How `sample` draws indices. */
  sampleKind: SampleKindName;
}

const mt = new MersenneTwister();
/** The current uniform generator: mt, or an L'Ecuyer-CMRG generator */
let gen: { setSeed(seed: number): void; nextDouble(): number } = mt;
let rounding = false;
let seeded = false;

/** Seeds the current generator (seed taken as an unsigned 32-bit integer, as R's RNG_Init) */
function initSeed(seed: number): void {
  gen.setSeed(seed);
  seeded = true;
}

function ensureSeeded(): void {
  if (seeded) return;
  // As in R, if no seed has been set, derive one from the time etc.
  let s = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    s = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  initSeed(s);
}

/**
 * Seeds the random number generator. Equivalent to R's `set.seed()`.
 *
 * Seeds the current generator, R's default `RNGkind("Mersenne-Twister", "Inversion", "Rejection")`
 * unless {@link RNGkind} chose another, so every `r*` function and `sample`/`sampleInt` produce the
 * same numbers as in R after the same seed. R's `set.seed(seed, kind, sample.kind = ...)` is
 * `RNGkind({ kind, sampleKind })` followed by `setSeed(seed)` (R itself does the same). As in R
 * there is a single global stream shared by all functions; if no seed is set, one is chosen from
 * the clock or `crypto.getRandomValues`.
 *
 * @param seed A 32-bit integer. Fractions are truncated toward zero.
 * @throws RangeError if `seed` is not finite or does not fit in a 32-bit integer.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rnorm(3); // [-0.6264538107423324, 0.18364332422208224, -0.8356286124100472]
 * // R: set.seed(1); rnorm(3)
 * ```
 */
export function setSeed(seed: number): void {
  if (!Number.isFinite(seed)) throw new RangeError("seed must be a finite number");
  const s = Math.trunc(seed);
  if (Math.abs(s) > 2147483647) throw new RangeError("seed must be a 32-bit integer");
  initSeed(s);
}

/** R's names of the kinds: true for L'Ecuyer-CMRG and for Rounding */
const KINDS: Record<string, boolean> = { default: false, "Mersenne-Twister": false, "L'Ecuyer-CMRG": true };
const SAMPLE_KINDS: Record<string, boolean> = { default: false, Rejection: false, Rounding: true };

/** The value of an option in its table (undefined if omitted) */
function lookup(table: Record<string, boolean>, name: string | undefined, what: string): boolean | undefined {
  if (name === undefined) return undefined;
  const v = table[name];
  if (typeof v !== "boolean") throw new RangeError(`unsupported ${what} "${name}"`);
  return v;
}

/**
 * Reads or changes the kinds of random number generation. Equivalent to R's `RNGkind()`.
 *
 * - `kind: "Mersenne-Twister"` (or `"default"`): R's default generator.
 * - `kind: "L'Ecuyer-CMRG"`: L'Ecuyer's MRG32k3a, with independent streams for parallel work
 *   ({@link nextRNGStream}, {@link nextRNGSubStream}).
 * - `sampleKind: "Rounding"`: indices drawn as `floor(n * u)`, as `sample`, `sampleInt` and
 *   `rwilcox` did in R before 3.6.0 (slightly non-uniform for large n; R warns about it, rStats.js
 *   does not). `"Rejection"` (or `"default"`) is R's default since 3.6.0. Other functions are not
 *   affected.
 *
 * As in R, changing `kind` seeds the new generator from the next uniform of the current one (also
 * when the kind does not change), so a stream stays reproducible from the last {@link setSeed};
 * changing only `sampleKind` keeps the stream. Call {@link setSeed} afterwards to seed the new
 * generator directly: `RNGkind({ kind }); setSeed(seed)` is R's `set.seed(seed, kind)`.
 *
 * @param options The kinds to change; omitted entries are kept. Default: change nothing.
 * @returns The kinds in effect before the call (the current ones when called without options), as R.
 * @throws RangeError for an unsupported kind (nothing is changed then).
 *
 * @example
 * ```ts
 * RNGkind(); // { kind: "Mersenne-Twister", normalKind: "Inversion", sampleKind: "Rejection" }
 * RNGkind({ kind: "L'Ecuyer-CMRG" });
 * setSeed(1);
 * runif(2); // [0.6775328286287442, 0.4273457228876442]
 * // R: set.seed(1, kind = "L'Ecuyer-CMRG"); runif(2)
 * RNGkind({ kind: "default", sampleKind: "Rounding" });
 * setSeed(1);
 * sampleInt(10, { size: 3 }); // [2, 3, 4]
 * // R: set.seed(1, kind = "default", sample.kind = "Rounding"); sample.int(10, 3) - 1
 * ```
 */
export function RNGkind(options: RNGKindOptions = {}): RNGKinds {
  const previous: RNGKinds = {
    kind: gen === mt ? "Mersenne-Twister" : "L'Ecuyer-CMRG",
    normalKind: "Inversion",
    sampleKind: rounding ? "Rounding" : "Rejection",
  };
  const useLec = lookup(KINDS, options.kind, "RNG kind");
  const useRounding = lookup(SAMPLE_KINDS, options.sampleKind, "sample kind");
  if (useLec !== undefined) {
    // The new generator is seeded with the next uniform u (0 < u < 1) times 2^32 - 1, truncated to an unsigned integer
    const seed = Math.trunc(unifRand() * 4294967295);
    gen = useLec ? (gen === mt ? new Mrg32k3a() : gen) : mt;
    initSeed(seed);
  }
  if (useRounding !== undefined) rounding = useRounding;
  return previous;
}

/** Value of .Random.seed[1]: uniform kind (3 Mersenne-Twister, 7 L'Ecuyer-CMRG) + 100 × normal 4 (Inversion) + 10000 × sample kind (0 Rounding, 1 Rejection) */
const kindCode = (): number => (gen === mt ? 3 : 7) + 400 + (rounding ? 0 : 10000);

/**
 * Returns a copy of the current generator state. Equivalent to reading R's `.Random.seed`.
 *
 * @returns The same integers as R's `.Random.seed`: the kind code (`10403` for R's default,
 *   `403` with `sampleKind: "Rounding"`, `10407` for L'Ecuyer-CMRG), followed by 625 integers
 *   for Mersenne-Twister or 6 for L'Ecuyer-CMRG (unsigned seeds of 2^31 or more appear as
 *   negative numbers, as in R). Pass it to {@link setRandomSeed} to restore the state.
 */
export function getRandomSeed(): Int32Array {
  ensureSeeded();
  if (gen === mt) return mt.getRandomSeed(kindCode());
  // The six seeds of L'Ecuyer-CMRG, as signed 32-bit integers
  return Int32Array.of(kindCode(), ...(gen as Mrg32k3a).s);
}

/**
 * Restores a generator state, including its kinds. Equivalent to assigning R's `.Random.seed`.
 *
 * @param state The integers returned by {@link getRandomSeed}, or copied from R's `.Random.seed`.
 * @throws RangeError for a kind code other than those of Mersenne-Twister or L'Ecuyer-CMRG with
 *   Inversion and Rejection or Rounding (`10403`, `403`, `10407`, `407`), a state of the wrong
 *   length, or an invalid L'Ecuyer-CMRG state (R reseeds from the clock in these cases).
 */
export function setRandomSeed(state: ArrayLike<number>): void {
  const code = state[0]!;
  const uniform = code % 100;
  if (!Number.isInteger(code) || code < 0 || code > 10407 || (uniform !== 3 && uniform !== 7) || Math.floor(code / 100) % 100 !== 4) {
    throw new RangeError(`unsupported RNG kind code ${String(code)} (supported: 10403, 403, 10407, 407)`);
  }
  if (uniform === 7) {
    const g = new Mrg32k3a();
    g.s.set(checkState(state));
    gen = g;
  } else {
    mt.setRandomSeed(state);
    gen = mt;
  }
  rounding = code < 10000;
  seeded = true;
}

/** One uniform on (0, 1) (R's unif_rand) */
export function unifRand(): number {
  ensureSeeded();
  return gen.nextDouble();
}

/** Whether sample.kind is "Rounding" (for weighted sampling by Walker's alias method) */
export const isRounding = (): boolean => rounding;

/** Build a bits-bit integer from uniforms (taking 16 bits at a time) */
function rbits(bits: number): number {
  // Only the low bits bits are kept. Reducing v modulo 2^(bits - 16) before each shift keeps it below 2^53
  // (exact in doubles) without changing those bits
  const mask = 2 ** Math.max(bits - 16, 0);
  let v = 0;
  for (let n = 0; n <= bits; n += 16) {
    const v1 = Math.floor(unifRand() * 65536);
    v = 65536 * (v % mask) + v1;
  }
  return v % 2 ** bits;
}

/** 2^25 */
const U25 = 33554432;

/**
 * Uniform integer in [0, dn) (R's R_unif_index): rejection sampling from random bits (sample.kind = "Rejection"),
 * or floor(dn * u) (sample.kind = "Rounding"), with u made of two uniforms above 2^31 - 1
 */
export function unifIndex(dn: number): number {
  if (rounding) return Math.floor(dn * (dn > 2147483647 ? (Math.floor(U25 * unifRand()) + unifRand()) / U25 : unifRand()));
  if (dn <= 0) return 0;
  const bits = Math.ceil(Math.log2(dn));
  let dv: number;
  do {
    dv = rbits(bits);
  } while (dn <= dv);
  return dv;
}

/** 2^27 */
const BIG = 134217728;

/** One standard normal variate (R's norm_rand; inversion, using two uniforms for resolution finer than 2^-27) */
export function normRand(): number {
  let u = unifRand();
  u = Math.trunc(BIG * u) + unifRand();
  return ppnd16(u / BIG);
}

// q[k] = Σ_{i=1}^{k+1} (ln 2)^i / i! (table of algorithm SA, Ahrens & Dieter 1972)
const Q: number[] = (() => {
  const q: number[] = [];
  let term = 1;
  let sum = 0;
  for (let i = 1; i <= 16; i++) {
    term *= Math.LN2 / i;
    sum += term;
    q.push(sum);
  }
  return q;
})();

/**
 * One standard exponential variate (R's exp_rand).
 * Ahrens & Dieter (1972) "Computer methods for sampling from the exponential and
 * normal distributions" (Comm. ACM 15): algorithm SA.
 */
export function expRand(): number {
  let a = 0;
  let u = unifRand();
  while (u <= 0 || u >= 1) u = unifRand();
  for (;;) {
    u += u;
    if (u > 1) break;
    a += Q[0]!;
  }
  u -= 1;
  if (u <= Q[0]!) return a + u;
  let i = 0;
  let ustar = unifRand();
  let umin = ustar;
  do {
    ustar = unifRand();
    if (umin > ustar) umin = ustar;
    i++;
  } while (u > Q[i]!);
  return a + umin * Q[0]!;
}
