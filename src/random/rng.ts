// RNG state and the basic generators underlying each distribution's variates.
//
// As in R, there is a single state (set by setSeed), corresponding to R's default
// RNGkind("Mersenne-Twister", "Inversion", "Rejection").
// The procedures were verified against R's ?RNG and ?Random documentation and observed output. R's source was not consulted.

import { MersenneTwister } from "./mt.js";
import { ppnd16 } from "./as241.js";

/** Value of .Random.seed[1]: uniform 3 (Mersenne-Twister) + 100 × normal 4 (Inversion) + 10000 × sample 1 (Rejection) */
const KIND = 10403;

const mt = new MersenneTwister();
let seeded = false;

function ensureSeeded(): void {
  if (seeded) return;
  // As in R, if no seed has been set, derive one from the time etc.
  let s = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    s = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  mt.setSeed(s);
  seeded = true;
}

/**
 * Seeds the random number generator. Equivalent to R's `set.seed()`.
 *
 * Reproduces R's default generator, `RNGkind("Mersenne-Twister", "Inversion", "Rejection")`,
 * so every `r*` function and `sample`/`sampleInt` produce the same numbers as in R after
 * the same seed. As in R there is a single global stream shared by all functions; if no
 * seed is set, one is chosen from the clock or `crypto.getRandomValues`.
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
  mt.setSeed(s | 0);
  seeded = true;
}

/**
 * Returns a copy of the current generator state. Equivalent to reading R's `.Random.seed`.
 *
 * @returns 626 integers in the same layout as R's `.Random.seed` (the first element is the
 *   RNG kind code `10403`). Pass it to {@link setRandomSeed} to restore the state.
 */
export function getRandomSeed(): Int32Array {
  ensureSeeded();
  return mt.getRandomSeed(KIND);
}

/**
 * Restores a generator state. Equivalent to assigning R's `.Random.seed`.
 *
 * @param state 626 integers as returned by {@link getRandomSeed}, or copied from R's
 *   `.Random.seed`.
 * @throws RangeError if the state is not for the default RNG kind (`state[0]` must be `10403`).
 */
export function setRandomSeed(state: ArrayLike<number>): void {
  if (state[0] !== KIND) throw new RangeError(`only the default RNG kind (${KIND}) is supported`);
  mt.setRandomSeed(state);
  seeded = true;
}

/** One uniform on (0, 1) (R's unif_rand) */
export function unifRand(): number {
  ensureSeeded();
  return mt.nextDouble();
}

/** Build a bits-bit integer from uniforms (taking 16 bits at a time) */
function rbits(bits: number): number {
  let v = 0;
  for (let n = 0; n <= bits; n += 16) {
    const v1 = Math.floor(unifRand() * 65536);
    v = 65536 * v + v1;
  }
  // Keep only the low bits bits (v is below 2^53, so take the remainder modulo 2^bits)
  return v % 2 ** bits;
}

/** Uniform integer in [0, dn) (R's sample.kind = "Rejection") */
export function unifIndex(dn: number): number {
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
