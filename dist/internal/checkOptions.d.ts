/**
 * Throws a RangeError if `options` has an enumerable key that is not in `keys`. `undefined` and `null` options, and
 * values that are not objects, are left to the function. A key whose value is `undefined` is still checked. `path` is
 * the key of a nested options object (such as `"control"`), written before the unknown key in the message.
 */
export declare function checkOptions(options: unknown, keys: ReadonlySet<string> | readonly string[], fnName: string, path?: string): void;
/**
 * The nested options object at `path` (keys joined by dots, as `"family.link"`) of `options`, or `undefined` where a
 * step is not an object (a family given by name): what checkOptions is called with for a nested object.
 */
export declare function nestedOptions(options: unknown, path: string): unknown;
