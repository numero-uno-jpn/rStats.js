// Runs the `@example` blocks of the doc comments of every exported function (read from the source by
// test/helpers/docComments.ts) and checks the values they show.
//
// Each ```ts block runs on its own, with every export of the areas in scope (those of src/index.ts and of the areas
// not in it, src/entries/mixed.ts; the TypeScript is stripped by esbuild). A statement followed by a value comment
// (`expr; // 0.0052`, or the comment alone on the next line) is checked against it:
// - a number equals the actual value rounded to the significant digits written (`0.0052` for 0.00520162..., `10`
//   has two significant digits), or, written to 13 or more digits, is within a relative 1e-12 of it (the last bits
//   may differ between platforms); `0` must be exactly 0; `NaN`, `Infinity` and `-Infinity` are exact;
// - strings, booleans, `null` and `undefined` must be equal;
// - arrays (`[...]`, or `Float64Array [...]` for a typed array) element by element, with the same length;
// - objects (`{ a: 1, b: [2, 3] }`) key by key for the keys shown (others may be left out, or marked `...`);
// - maps (`Map { "a" => [2] }`) entry by entry, in order.
// A remark may follow the value in parentheses: `// 2.25 (type 7)`. A comment that starts like a value (a digit, a
// minus sign, a quote, `[`, `{`, ...) but cannot be read is an error; other comments (`// R: set.seed(1)`) are
// remarks. `const name = expr; // value` checks `name`. Statements without a value comment must not throw.
//
//   DOC_EXAMPLES=dnorm,tTest npx vitest run test/docExamples.test.ts   only these functions

import { transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as Mixed from "../src/entries/mixed.js";
import * as R from "../src/index.js";
import { collectFunctions, exampleBlocks } from "./helpers/docComments.js";

const root = fileURLToPath(new URL("..", import.meta.url));

// ---- Statements and their value comments ----

interface Statement {
  code: string;
  /** The value comment (trailing, or alone on the next line), without the slashes. */
  comment?: string;
}

/** Splits example code into statements at top-level semicolons and attaches the value comments. */
export function splitStatements(code: string): Statement[] {
  const out: Statement[] = [];
  let cur = "";
  let depth = 0;
  // The statement that ended last, and the number of line breaks since (while no other code followed)
  let last: Statement | undefined;
  let breaks = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === "\\" ? 2 : 1;
      cur += code.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      let j = code.indexOf("\n", i);
      if (j < 0) j = code.length;
      const text = code.slice(i + 2, j).trim();
      if (cur.trim() === "" && last !== undefined && last.comment === undefined) {
        if (breaks === 0 || (breaks === 1 && looksLikeValue(text))) last.comment = text;
      }
      i = j - 1;
      continue;
    }
    if (c === "\n") breaks++;
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === ";" && depth === 0) {
      last = { code: cur.trim() };
      out.push(last);
      cur = "";
      breaks = 0;
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "") out.push({ code: cur.trim() });
  return out;
}

// ---- Values written in comments ----

type Expected =
  | { t: "num"; text: string; value: number }
  | { t: "str"; value: string }
  | { t: "lit"; value: boolean | null | undefined }
  | { t: "arr"; items: Expected[]; typed?: string }
  | { t: "obj"; entries: [string, Expected][] }
  | { t: "map"; entries: [Expected, Expected][] };

const TYPED = "Float64Array|Float32Array|Int32Array|Int16Array|Int8Array|Uint32Array|Uint16Array|Uint8Array";
const VALUE_START = new RegExp(`^(?:-?\\.?\\d|-?Infinity\\b|NaN\\b|true\\b|false\\b|null\\b|undefined\\b|["'\\[{]|Map \\{|(?:${TYPED}) \\[)`);

export function looksLikeValue(text: string): boolean {
  return VALUE_START.test(text);
}

/** Reads a value from the start of `text`; returns it and the rest of the text. Throws if it cannot be read. */
export function parseValue(text: string): { value: Expected; rest: string } {
  let pos = 0;
  const ws = (): void => {
    while (pos < text.length && /\s/.test(text[pos]!)) pos++;
  };
  const fail = (what: string): never => {
    throw new Error(`cannot read ${what} at "${text.slice(pos, pos + 20)}" in "${text}"`);
  };
  const eat = (s: string): boolean => {
    ws();
    if (text.startsWith(s, pos)) {
      pos += s.length;
      return true;
    }
    return false;
  };
  const value = (): Expected => {
    ws();
    const rest = text.slice(pos);
    let m = /^-?(?:Infinity|NaN)\b/.exec(rest) ?? /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (m !== null) {
      pos += m[0].length;
      return { t: "num", text: m[0], value: Number(m[0]) };
    }
    m = /^(?:true|false|null|undefined)\b/.exec(rest);
    if (m !== null) {
      pos += m[0].length;
      return { t: "lit", value: m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : undefined };
    }
    if (rest[0] === '"' || rest[0] === "'") {
      const q = rest[0];
      let j = 1;
      while (j < rest.length && rest[j] !== q) j += rest[j] === "\\" ? 2 : 1;
      if (j >= rest.length) fail("a string");
      const body = rest.slice(1, j);
      pos += j + 1;
      return { t: "str", value: q === '"' ? (JSON.parse(`"${body}"`) as string) : body.replace(/\\(.)/g, "$1") };
    }
    m = new RegExp(`^(${TYPED}) (?=\\[)`).exec(rest);
    if (m !== null) {
      pos += m[0].length;
      const arr = value();
      if (arr.t !== "arr") fail("a typed array");
      return { ...arr, typed: m[1]! } as Expected;
    }
    if (eat("[")) {
      const items: Expected[] = [];
      if (!eat("]")) {
        do items.push(value());
        while (eat(","));
        if (!eat("]")) fail("an array");
      }
      return { t: "arr", items };
    }
    if (eat("Map {")) {
      const entries: [Expected, Expected][] = [];
      if (!eat("}")) {
        do {
          const k = value();
          if (!eat("=>")) fail("a map entry");
          entries.push([k, value()]);
        } while (eat(","));
        if (!eat("}")) fail("a map");
      }
      return { t: "map", entries };
    }
    if (eat("{")) {
      const entries: [string, Expected][] = [];
      if (!eat("}")) {
        do {
          if (eat("...")) continue;
          ws();
          const km = /^(?:[A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*")/.exec(text.slice(pos));
          if (km === null) fail("an object key");
          pos += km![0].length;
          const key = km![0].startsWith('"') ? (JSON.parse(km![0]) as string) : km![0];
          if (!eat(":")) fail("an object entry");
          entries.push([key, value()]);
        } while (eat(","));
        if (!eat("}")) fail("an object");
      }
      return { t: "obj", entries };
    }
    return fail("a value");
  };
  const v = value();
  return { value: v, rest: text.slice(pos).trim() };
}

/** The number of significant digits written in a number literal (`0.0052`: 2, `10`: 2, `1.50e-3`: 3). */
export function significantDigits(text: string): number {
  const mantissa = text.replace(/^-/, "").replace(/e.*$/i, "").replace(".", "");
  return mantissa.replace(/^0+/, "").length;
}

function show(x: unknown): string {
  if (typeof x === "number") return Object.is(x, -0) ? "-0" : String(x);
  if (typeof x === "string") return JSON.stringify(x);
  if (x instanceof Map) return `Map { ${[...x].map(([k, v]) => `${show(k)} => ${show(v)}`).join(", ")} }`;
  if (ArrayBuffer.isView(x)) return `${x.constructor.name} [${Array.from(x as unknown as ArrayLike<unknown>, show).join(", ")}]`;
  if (Array.isArray(x)) return `[${x.map(show).join(", ")}]`;
  if (typeof x === "function") return "[function]";
  if (x !== null && typeof x === "object") {
    return `{ ${Object.entries(x).map(([k, v]) => `${k}: ${show(v)}`).join(", ")} }`;
  }
  return String(x);
}

/** The differences between an expected value and the actual one (empty if they agree). */
export function compare(e: Expected, a: unknown, path = ""): string[] {
  const at = path === "" ? "" : ` at ${path}`;
  const bad = (what: string): string[] => [`${what}${at}: got ${show(a)}`];
  switch (e.t) {
    case "num": {
      if (typeof a !== "number") return bad(`expected the number ${e.text}`);
      if (Number.isNaN(e.value)) return Number.isNaN(a) ? [] : bad(`expected NaN`);
      if (!Number.isFinite(e.value) || e.value === 0) return a === e.value ? [] : bad(`expected ${e.text}`);
      const digits = significantDigits(e.text);
      // A value written to 13 or more digits is compared within a relative 1e-12 (the library's accuracy against R):
      // the last bits may differ between platforms (x64 and arm64 builds of V8)
      if (digits >= 13) return Math.abs(a - e.value) <= 1e-12 * Math.abs(e.value) ? [] : bad(`expected ${e.text}`);
      return Number(a.toPrecision(Math.min(digits, 100))) === e.value ? [] : bad(`expected ${e.text}`);
    }
    case "str":
      return a === e.value ? [] : bad(`expected ${JSON.stringify(e.value)}`);
    case "lit":
      return a === e.value ? [] : bad(`expected ${String(e.value)}`);
    case "arr": {
      if (e.typed !== undefined) {
        if (!ArrayBuffer.isView(a) || a.constructor.name !== e.typed) return bad(`expected a ${e.typed}`);
      } else if (!Array.isArray(a)) return bad("expected an array");
      const arr = Array.from(a as ArrayLike<unknown>);
      if (arr.length !== e.items.length) return bad(`expected ${e.items.length} elements`);
      return e.items.flatMap((item, i) => compare(item, arr[i], `${path}[${i}]`));
    }
    case "obj": {
      if (a === null || typeof a !== "object" || Array.isArray(a)) return bad("expected an object");
      return e.entries.flatMap(([k, v]) => compare(v, (a as Record<string, unknown>)[k], `${path}.${k}`));
    }
    case "map": {
      if (!(a instanceof Map)) return bad("expected a Map");
      if (a.size !== e.entries.length) return bad(`expected ${e.entries.length} entries`);
      const entries = [...a];
      return e.entries.flatMap(([k, v], i) => [
        ...compare(k, entries[i]![0], `${path} key ${i}`),
        ...compare(v, entries[i]![1], `${path} => ${show(entries[i]![0])}`),
      ]);
    }
  }
}

/** The expected value of a value comment; throws if the comment starts like a value but cannot be read. */
export function expectedValue(comment: string): Expected {
  const { value, rest } = parseValue(comment);
  if (rest !== "" && !rest.startsWith("(")) {
    throw new Error(`"${comment}": after the value only a remark in parentheses may follow, not "${rest}"`);
  }
  return value;
}

// ---- Running a block ----

/** Every export of the areas: src/index.ts and the areas that are not in it (src/entries/mixed.ts) */
const scope: Record<string, unknown> = { ...R, ...Mixed };
const names = Object.keys(scope);
const values = names.map((n) => scope[n]);

/** Runs an example block and returns the problems found (empty if it is right). */
export function runExample(block: string): string[] {
  const statements = splitStatements(block);
  const expected: (Expected | undefined)[] = [];
  let js = "";
  statements.forEach((s, i) => {
    let e: Expected | undefined;
    if (s.comment !== undefined && looksLikeValue(s.comment)) e = expectedValue(s.comment);
    expected.push(e);
    js += `__at(${i});\n`;
    if (e === undefined) js += `${s.code};\n`;
    else {
      const decl = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/.exec(s.code);
      if (decl !== null) js += `${s.code};\n__check(${i}, ${decl[1]});\n`;
      else if (/^(?:const|let|var)\b/.test(s.code)) throw new Error(`a value comment on a declaration: ${s.code}`);
      else js += `__check(${i}, (${s.code}));\n`;
    }
  });
  const compiled = transformSync(js, { loader: "ts" }).code;
  const actual = new Map<number, unknown>();
  let current = -1;
  const fn = new Function(...names, "__at", "__check", `{\n${compiled}\n}`) as (...args: unknown[]) => void;
  try {
    fn(...values, (i: number) => (current = i), (i: number, v: unknown) => actual.set(i, v));
  } catch (err) {
    return [`\`${statements[current]?.code}\` threw ${String(err)}`];
  }
  const problems: string[] = [];
  expected.forEach((e, i) => {
    if (e === undefined) return;
    for (const p of compare(e, actual.get(i))) problems.push(`\`${statements[i]!.code}\`: ${p}`);
  });
  return problems;
}

// ---- The tests ----

const only = process.env.DOC_EXAMPLES?.split(",");
const functions = collectFunctions(root).filter((f) => only === undefined || only.includes(f.name));

function resetRandom(): void {
  R.RNGkind({ kind: "default", sampleKind: "default" });
  R.setSeed(1);
}

describe("doc examples", () => {
  for (const f of functions) {
    // Blocks repeated over overloads are run once
    const blocks = [...new Set(f.comments.flatMap(exampleBlocks))];
    blocks.forEach((block, k) => {
      it(`${f.name}${blocks.length > 1 ? ` #${k + 1}` : ""}`, () => {
        resetRandom();
        const problems = runExample(block);
        resetRandom();
        expect(problems, `${f.file}: ${f.name}\n${problems.join("\n")}`).toEqual([]);
      });
    });
  }
});

describe("doc example checker", () => {
  it("reads values", () => {
    expect(significantDigits("0.0052")).toBe(2);
    expect(significantDigits("10")).toBe(2);
    expect(significantDigits("-1.50e-3")).toBe(3);
    expect(expectedValue('{ a: [1, "x"], ..., b: Map { "k" => null } } (remark)')).toEqual({
      t: "obj",
      entries: [
        ["a", { t: "arr", items: [{ t: "num", text: "1", value: 1 }, { t: "str", value: "x" }] }],
        ["b", { t: "map", entries: [[{ t: "str", value: "k" }, { t: "lit", value: null }]] }],
      ],
    });
    expect(() => expectedValue("2 x 2 matrix")).toThrow();
    expect(() => expectedValue("[intercept, slope]")).toThrow();
  });

  it("finds wrong values", () => {
    expect(runExample("dnorm(0); // 0.3989")).toEqual([]);
    expect(runExample("dnorm(0); // 0.3988")).toHaveLength(1);
    expect(runExample("dnorm(0); // 0.39894228040143268")).toEqual([]);
    expect(runExample("dnorm([0, 1]);\n// [0.3989, 0.242]")).toEqual([]);
    expect(runExample("dnorm([0, 1]); // [0.3989]")).toHaveLength(1);
    expect(runExample('const r = tTest([1, 2, 3, 4], { mu: 1 });\nr.method; // "One Sample t-test"')).toEqual([]);
    expect(runExample('tTest([1, 2, 3, 4]).method; // "Welch"')).toHaveLength(1);
    expect(runExample("const x = 1 + 1; // 3")).toHaveLength(1);
    expect(runExample("split([1, 2, 3], [\"b\", \"a\", \"b\"]); // Map { \"a\" => [2], \"b\" => [1, 3] }")).toEqual([]);
    expect(runExample("undefinedName(1);")[0]).toMatch(/threw/);
    // A remark is not checked; a statement may span lines
    expect(runExample("// a remark\nconst t = 2; // R: t <- 2\nmatMul(\n  [[1, 2]],\n  [[t], [3]],\n); // [[8]]")).toEqual([]);
  });
});
