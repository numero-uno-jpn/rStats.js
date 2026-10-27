// R's round(x, digits) and zapsmall(x).
//
// Written for rStats.js (no ported code) from the description in oracle/lmertest-behaviour.md ("Rounding") and R's
// documentation of round (?Round: the candidates on either side of x at the given number of decimal digits, the one
// closer to x chosen, a tie to the even last digit; digits = 0 is rounding to the nearest integer, ties to even).
const LOG10_2 = Math.log10(2);
/** The binary exponent of |x| (finite, nonzero): the exponent of its leading bit, as C's logb */
function binaryExponent(x) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    const biased = (view.getUint16(0) >> 4) & 0x7ff;
    if (biased > 0)
        return biased - 1023;
    // subnormal: the position of the leading bit of the significand
    const hi = view.getUint32(0) & 0xfffff;
    const lo = view.getUint32(4);
    const bits = hi !== 0 ? 32 + (31 - Math.clz32(hi)) : 31 - Math.clz32(lo);
    return bits - 1074;
}
/** 10^k for an integer k >= 0, by repeated multiplication in double arithmetic */
function powerOf10(k) {
    let p = 1;
    for (let i = 0; i < k; i++)
        p *= 10;
    return p;
}
/** The nearest integer, ties to even (C's nearbyint in the default rounding mode); the sign of x is kept */
function roundHalfEven(x) {
    const f = Math.floor(x);
    const d = x - f;
    const r = d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1;
    return r === 0 ? (x < 0 ? -0 : 0) : r;
}
/**
 * R's `round(x, digits)`: x rounded to `digits` decimal places (negative: to a power of ten), choosing between the
 * two neighbouring candidates the one closer to x in double arithmetic, a tie to the even one. Values that already
 * have at most about 15 significant digits at that position are returned unchanged.
 */
export function roundR(x, digits = 0) {
    if (Number.isNaN(x) || Number.isNaN(digits))
        return NaN;
    if (!Number.isFinite(x) || x === 0 || digits > 323)
        return x;
    if (digits < -308)
        return 0;
    if (digits === 0)
        return roundHalfEven(x);
    const dig = Math.floor(digits + 0.5);
    const ax = Math.abs(x);
    const l = LOG10_2 * (0.5 + binaryExponent(ax));
    if (l + dig > 15)
        return x;
    let xd;
    let xu;
    let i10;
    if (dig <= 308) {
        const p = dig >= 0 ? powerOf10(dig) : 1 / powerOf10(-dig);
        const x10 = ax * p;
        i10 = Math.floor(x10);
        xd = i10 / p;
        xu = Math.ceil(x10) / p;
    }
    else {
        const p308 = powerOf10(308);
        const pRest = powerOf10(dig - 308);
        const x10 = ax * p308 * pRest;
        i10 = Math.floor(x10);
        xd = i10 / p308 / pRest;
        xu = Math.ceil(x10) / p308 / pRest;
    }
    const du = xu - ax;
    const dd = ax - xd;
    const r = du < dd || (du === dd && i10 % 2 === 1) ? xu : xd;
    return x < 0 ? -r : r;
}
/**
 * R's `zapsmall(x, digits = 7)` of the entries of a matrix (array of rows) taken together: every entry rounded by
 * {@link roundR} to `max(0, digits - log10(mx))` decimal places, mx the largest absolute entry (NaN left out), or
 * to `digits` places when mx is 0.
 */
export function zapsmall(m, digits = 7) {
    let mx = 0;
    for (const row of m)
        for (const v of row)
            if (Math.abs(v) > mx)
                mx = Math.abs(v);
    const d = mx > 0 ? Math.max(0, digits - Math.log10(mx)) : digits;
    return m.map((row) => row.map((v) => roundR(v, d)));
}
