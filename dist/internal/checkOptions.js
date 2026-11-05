// The check that an options object has no key the function does not know: a misspelt key ({ lowertail: false })
// would otherwise be ignored and give a wrong result without a sign. The key lists are generated from the option
// types by scripts/option-keys.mjs.
/**
 * Throws a RangeError if `options` has an enumerable key that is not in `keys`. `undefined` and `null` options, and
 * values that are not objects, are left to the function. A key whose value is `undefined` is still checked. `path` is
 * the key of a nested options object (such as `"control"`), written before the unknown key in the message.
 */
export function checkOptions(options, keys, fnName, path) {
    if (typeof options !== "object" || options === null)
        return;
    for (const key in options) {
        if (Array.isArray(keys) ? keys.includes(key) : keys.has(key))
            continue;
        const name = path === undefined ? key : `${path}.${key}`;
        throw new RangeError(`unknown option '${name}' for ${fnName} (known: ${[...keys].join(", ")})`);
    }
}
/**
 * The nested options object at `path` (keys joined by dots, as `"family.link"`) of `options`, or `undefined` where a
 * step is not an object (a family given by name): what checkOptions is called with for a nested object.
 */
export function nestedOptions(options, path) {
    let v = options;
    for (const key of path.split(".")) {
        if (typeof v !== "object" || v === null)
            return undefined;
        v = v[key];
    }
    return v;
}
