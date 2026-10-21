// Handling of integer parameters and arguments (matched to observed R output).
//
// - "Not an integer" means |x - round(x)| > 1e-9 max(1, |x|)
//   (e.g. R's dhyper(2 + 2e-9, ...) is 0, while dhyper(2 + 1.1e-9, ...) is treated as an integer)
// - Parameters are rounded half to even (R's nearbyint: 4.5 -> 4, 5.5 -> 6)
/** Whether x is not an integer (relative slack 1e-9) */
export function nonInt(x) {
    return Math.abs(x - roundHalfEven(x)) > 1e-9 * Math.max(1, Math.abs(x));
}
/** Round half to even (0.5 goes to the nearest even number) */
export function roundHalfEven(x) {
    if (!Number.isFinite(x))
        return x;
    const r = Math.round(x);
    // Math.round rounds 0.5 towards +∞. Only for exact halves, move back to the even side
    return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
