// The shared check of the keys of an options object (src/internal/checkOptions.ts): an unknown key is a RangeError
// naming the key, its path in a nested object, the function and the known keys.
import { describe, expect, it } from "vitest";
import { checkOptions } from "../src/internal/checkOptions.js";

const PNORM_KEYS: ReadonlySet<string> = new Set(["mean", "sd", "lowerTail", "logP"]);

describe("checkOptions", () => {
  it("accepts known keys, an empty object, undefined and null", () => {
    expect(() => checkOptions({ mean: 1, lowerTail: false }, PNORM_KEYS, "pnorm")).not.toThrow();
    expect(() => checkOptions({}, PNORM_KEYS, "pnorm")).not.toThrow();
    expect(() => checkOptions(undefined, PNORM_KEYS, "pnorm")).not.toThrow();
    expect(() => checkOptions(null, PNORM_KEYS, "pnorm")).not.toThrow();
  });

  it("throws a RangeError for an unknown key, with the known keys", () => {
    expect(() => checkOptions({ lowertail: false }, PNORM_KEYS, "pnorm")).toThrow(RangeError);
    expect(() => checkOptions({ mean: 0, lowertail: false }, PNORM_KEYS, "pnorm")).toThrow(
      "unknown option 'lowertail' for pnorm (known: mean, sd, lowerTail, logP)",
    );
  });

  it("checks a key whose value is undefined", () => {
    expect(() => checkOptions({ lowertail: undefined }, PNORM_KEYS, "pnorm")).toThrow(RangeError);
  });

  it("writes the path of a nested object", () => {
    expect(() => checkOptions({ maxitt: 10 }, ["maxit", "reltol"], "optim", "control")).toThrow(
      "unknown option 'control.maxitt' for optim (known: maxit, reltol)",
    );
  });

  it("takes the keys as an array or a set, and an empty list", () => {
    expect(() => checkOptions({ maxit: 10 }, ["maxit", "reltol"], "optim", "control")).not.toThrow();
    expect(() => checkOptions({}, [], "f")).not.toThrow();
    expect(() => checkOptions({ a: 1 }, [], "f")).toThrow("unknown option 'a' for f (known: )");
    expect(() => checkOptions({ a: 1 }, new Set<string>(), "f")).toThrow(RangeError);
  });

  it("leaves values that are not objects to the function", () => {
    expect(() => checkOptions(1, PNORM_KEYS, "pnorm")).not.toThrow();
    expect(() => checkOptions("lowertail", PNORM_KEYS, "pnorm")).not.toThrow();
  });
});
