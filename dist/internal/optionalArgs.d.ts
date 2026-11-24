/** An options object: a plain object, not an array, a typed array or a function */
export declare function isOptionsObject(v: unknown): v is Record<string, unknown>;
/**
 * The optional arguments from `args` (the arguments from the first optional one on), each named by `names` in
 * order. An options object at a position ends the positional arguments; one may also follow all of them. A key given
 * both by position and in the options is a RangeError. Positional `undefined` counts as not given. With `fnName`, a key
 * of the options that is not in `names` is a RangeError (checkOptions), for a function whose options are not checked
 * by the generated code (the function splinefun returns).
 */
export declare function optionalArgs<O extends object>(names: readonly (keyof O & string)[], args: readonly unknown[], fnName?: string): Partial<O>;
/** The first options object among `args` (the optional arguments of optionalArgs), for the check of its keys */
export declare function optionsIn(args: readonly unknown[]): Record<string, unknown> | undefined;
