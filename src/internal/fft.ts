// A radix-2 complex fast Fourier transform (in place), for density's convolution. Written for rStats.js (the
// textbook Cooley-Tukey algorithm with bit-reversal ordering; the twiddle factors are computed directly by cos and sin
// for each index, not by recurrence, to keep the round-off at the level of a few ulps).

/** Transforms (re, im) in place; the length must be a power of 2. The inverse is not divided by the length. */
export function fftInPlace(re: number[], im: number[], inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (sign * 2 * Math.PI) / len;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
      for (let i = k; i < n; i += len) {
        const j = i + half;
        const vr = re[j]! * wr - im[j]! * wi;
        const vi = re[j]! * wi + im[j]! * wr;
        re[j] = re[i]! - vr;
        im[j] = im[i]! - vi;
        re[i] = re[i]! + vr;
        im[i] = im[i]! + vi;
      }
    }
  }
}
