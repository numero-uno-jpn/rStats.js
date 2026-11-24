// Optional arguments that a function takes either by position (R's order) or in an options object: the object in
// place of the first optional argument, or after the positional ones. A value given both ways is a RangeError.
import { checkOptions } from "./checkOptions.js";
/** An options object: a plain object, not an array, a typed array or a function */
export function isOptionsObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v);
}
/**
 * The optional arguments from `args` (the arguments from the first optional one on), each named by `names` in
 * order. An options object at a position ends the positional arguments; one may also follow all of them. A key given
 * both by position and in the options is a RangeError. Positional `undefined` counts as not given. With `fnName`, a key
 * of the options that is not in `names` is a RangeError (checkOptions), for a function whose options are not checked
 * by the generated code (the function splinefun returns).
 */
export function optionalArgs(names, args, fnName) {
    const out = {};
    let options;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (i <= names.length && isOptionsObject(a)) {
            options = a;
            break;
        }
        if (i < names.length && a !== undefined)
            out[names[i]] = a;
    }
    if (options !== undefined) {
        if (fnName !== undefined)
            checkOptions(options, names, fnName);
        for (const name of names) {
            if (options[name] === undefined)
                continue;
            if (Object.hasOwn(out, name))
                throw new RangeError(`'${name}' is given both as an argument and in the options`);
            out[name] = options[name];
        }
    }
    return out;
}
/** The first options object among `args` (the optional arguments of optionalArgs), for the check of its keys */
export function optionsIn(args) {
    for (const a of args)
        if (isOptionsObject(a))
            return a;
    return undefined;
}
