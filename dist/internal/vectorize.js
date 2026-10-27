export function vectorize(x, f) {
    if (typeof x === "number")
        return f(x);
    if (x instanceof Float64Array)
        return x.map(f);
    return x.map((v) => f(v));
}
