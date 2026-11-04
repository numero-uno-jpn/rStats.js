// setWarningHandler: the warnings of a call go to the handler once the call has its result, each distinct one once,
// under the name of the function called (only the outer one when a public function calls another), and nowhere
// without a handler; the handler's errors propagate; the setting lives on globalThis.
import { afterEach, describe, expect, it, vi } from "vitest";
import { anova, etaSquared, jonckheereTest, lm, optim, pivotLonger, setWarningHandler, type WarningHandler } from "../src/index.js";
import { reportWarnings, unreported } from "../src/internal/warnings.js";

const KEY = Symbol.for("@numero-uno-jpn/rstats.warningHandler");
const PERFECT = "ANOVA F-tests on an essentially perfect fit are unreliable";
const PERFECT_FIT = "essentially perfect fit: summary may be unreliable";
const BOUNDS = "bounds can only be used with method L-BFGS-B (or Brent)";
const JT_TIES = "Sample size > 100 or data with ties \n p-value based on normal approximation. Specify nperm for permutation p-value";

/** A fit whose anova table warns (an exact fit) */
const perfectFit = () => lm("y ~ x", { x: [1, 2, 3, 4, 5], y: [2, 4, 6, 8, 10] });
const quadratic = (p: number[]) => (p[0]! - 2) ** 2 + (p[1]! - 3) ** 2;

afterEach(() => {
  setWarningHandler(null);
});

describe("setWarningHandler", () => {
  it("passes each warning of a call once, with the name of the function, after the call", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    const r = jonckheereTest([1, 2, 2, 3, 3, 4], [1, 1, 2, 2, 3, 3]);
    expect(r.warnings).toEqual([JT_TIES]);
    expect(handler.mock.calls).toEqual([[JT_TIES, "jonckheereTest"]]);
    handler.mockClear();
    const o = optim([1, 1], quadratic, { lower: [0, 0] });
    expect(o.warnings).toEqual([BOUNDS]);
    expect(handler.mock.calls).toEqual([[BOUNDS, "optim"]]);
  });

  it("passes the same text once in a call, in order", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    reportWarnings("someTest", ["a", "b", "a", "c", "b"]);
    expect(handler.mock.calls).toEqual([["a", "someTest"], ["b", "someTest"], ["c", "someTest"]]);
  });

  it("passes nothing for a call without warnings", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    jonckheereTest([1.1, 2.0, 2.4, 3.5, 3.1, 4.6], [1, 1, 2, 2, 3, 3]);
    optim([1, 1], quadratic);
    expect(handler).not.toHaveBeenCalled();
  });

  it("each call passes its own warnings: two calls, two times", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    optim([1, 1], quadratic, { lower: [0, 0] });
    optim([1, 1], quadratic, { lower: [0, 0] });
    expect(handler.mock.calls).toEqual([[BOUNDS, "optim"], [BOUNDS, "optim"]]);
  });

  it("a function that calls another passes the warnings once, under its own name", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    const fit = perfectFit();
    expect(handler.mock.calls).toEqual([[PERFECT_FIT, "lm"]]);
    handler.mockClear();
    // etaSquared computes anova(fit) inside, whose table has the fit's warning and its own; only etaSquared passes them
    const es = etaSquared(fit);
    expect(es.warnings).toEqual([PERFECT_FIT, PERFECT]);
    expect(handler.mock.calls).toEqual([[PERFECT_FIT, "etaSquared"], [PERFECT, "etaSquared"]]);
    handler.mockClear();
    expect(anova(fit).warnings).toEqual([PERFECT_FIT, PERFECT]);
    expect(handler.mock.calls).toEqual([[PERFECT_FIT, "anova"], [PERFECT, "anova"]]);
  });

  it("calls inside unreported pass nothing, also after one threw", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    unreported(() => optim([1, 1], quadratic, { lower: [0, 0] }));
    expect(handler).not.toHaveBeenCalled();
    expect(() =>
      unreported(() => {
        throw new Error("inner");
      }),
    ).toThrow("inner");
    optim([1, 1], quadratic, { lower: [0, 0] });
    expect(handler.mock.calls).toEqual([[BOUNDS, "optim"]]);
  });

  it("null stops passing the warnings; the result keeps them", () => {
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    expect(setWarningHandler(null)).toBe(handler);
    const o = optim([1, 1], quadratic, { lower: [0, 0] });
    expect(o.warnings).toEqual([BOUNDS]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("an error thrown by the handler propagates to the caller", () => {
    setWarningHandler((message) => {
      throw new Error(`warning: ${message}`);
    });
    expect(() => optim([1, 1], quadratic, { lower: [0, 0] })).toThrow(`warning: ${BOUNDS}`);
    // and the next call reports again (nothing is left half done)
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    optim([1, 1], quadratic, { lower: [0, 0] });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns the handler it replaces (null at first) and keeps it on globalThis", () => {
    const g = globalThis as unknown as Record<symbol, unknown>;
    expect(setWarningHandler(null)).toBeNull();
    const a: WarningHandler = () => {};
    const b: WarningHandler = () => {};
    expect(setWarningHandler(a)).toBeNull();
    expect(g[KEY]).toBe(a);
    expect(setWarningHandler(b)).toBe(a);
    expect(g[KEY]).toBe(b);
    expect(setWarningHandler(null)).toBe(b);
    expect(g[KEY]).toBeNull();
    // a handler set on globalThis directly (by another copy of the library) is the one used
    const handler = vi.fn<WarningHandler>();
    g[KEY] = handler;
    optim([1, 1], quadratic, { lower: [0, 0] });
    expect(handler.mock.calls).toEqual([[BOUNDS, "optim"]]);
    expect(setWarningHandler(null)).toBe(handler);
  });

  it("is a TypeError for a handler that is neither a function nor null", () => {
    expect(() => setWarningHandler(undefined as unknown as null)).toThrow(TypeError);
    expect(() => setWarningHandler("console.warn" as unknown as null)).toThrow("handler must be a function or null");
  });

  it("pivotLonger passes its warnings to the handler without onWarning, and only to onWarning with it", () => {
    const data = { id: [1], a_b_c: [1], a_b: [2] };
    const options = { cols: ["a_b_c", "a_b"], namesTo: ["x", "y"], namesSep: "_" };
    const handler = vi.fn<WarningHandler>();
    setWarningHandler(handler);
    pivotLonger(data, options);
    expect(handler.mock.calls.length).toBe(1);
    expect(handler.mock.calls[0]![1]).toBe("pivotLonger");
    const seen: string[] = [];
    handler.mockClear();
    pivotLonger(data, { ...options, onWarning: (m) => seen.push(m) });
    expect(handler).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });
});
