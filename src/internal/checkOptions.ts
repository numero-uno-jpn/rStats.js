// The check that an options object has no key the function does not know: a misspelt key ({ lowertail: false })
// would otherwise be ignored and give a wrong result without a sign. The key lists are generated from the option
// types by scripts/option-keys.mjs.

/**
 * Throws a RangeError if `options` has an enumerable key that is not in `keys`. `undefined` and `null` options, and
 * values that are not objects, are left to the function. A key whose value is `undefined` is still checked. `path` is
 * the key of a nested options object (such as `"control"`), written before the unknown key in the message.
 */
export function checkOptions(
  options: unknown,
  keys: ReadonlySet<string> | readonly string[],
  fnName: string,
  path?: string,
): void {
  if (typeof options !== "object" || options === null) return;
  for (const key in options) {
    if (Array.isArray(keys) ? (keys as readonly string[]).includes(key) : (keys as ReadonlySet<string>).has(key)) continue;
    const name = path === undefined ? key : `${path}.${key}`;
    throw new RangeError(`unknown option '${name}' for ${fnName} (known: ${[...keys].join(", ")})`);
  }
}
