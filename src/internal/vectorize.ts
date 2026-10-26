/**
 * Input accepted as the vectorized first argument of the distribution functions
 * (the counterpart of R's automatic vectorization).
 * A number gives a number, a `number[]` gives a `number[]`, and a `Float64Array` gives a `Float64Array`.
 *
 * @category Distributions
 */
export type Vectorizable = number | readonly number[] | Float64Array;

/**
 * Result type matching the shape of a {@link Vectorizable} input:
 * `number` for a number, `Float64Array` for a `Float64Array`, and `number[]` for an array.
 *
 * @category Distributions
 */
export type VectorResult<T extends Vectorizable> = T extends number
  ? number
  : T extends Float64Array
    ? Float64Array
    : number[];

export function vectorize<T extends Vectorizable>(x: T, f: (v: number) => number): VectorResult<T> {
  if (typeof x === "number") return f(x) as VectorResult<T>;
  if (x instanceof Float64Array) return x.map(f) as VectorResult<T>;
  return (x as readonly number[]).map((v) => f(v)) as VectorResult<T>;
}
