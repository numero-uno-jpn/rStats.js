// Reads the doc comments of the exported functions straight from the source (no TypeDoc, no network), for
// test/docExamples.test.ts, test/rNames.test.ts and scripts/r-index.mjs. Plain, erasable TypeScript only, so that
// Node can load it without a build step (`node scripts/r-index.mjs`).

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** An exported function and its doc comments (one per documented overload, in source order). */
export interface FunctionDoc {
  /** The exported name. */
  name: string;
  /** The entry (area) it is exported from: the basename of the file in src/entries/, e.g. `"tests"`. */
  entry: string;
  /** The source file that defines it, relative to the repository root. */
  file: string;
  /** The text of each doc comment written directly above an `export function name` declaration. */
  comments: string[];
}

/** The order of the areas, as in src/index.ts. */
export const ENTRY_ORDER = ["special", "distributions", "tests", "linalg", "descriptive", "numerics"];

/** The text of a `/** ... *\/` block: the delimiters and the leading ` * ` of each line removed. */
function commentText(block: string): string {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();
}

/** The doc comments directly above each `export function name` declaration of a source file. */
function functionComments(source: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`^export function ${name.replace(/\$/g, "\\$")}\\s*[<(]`, "gm");
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    const before = source.slice(0, m.index).trimEnd();
    if (!before.endsWith("*/")) continue;
    const start = before.lastIndexOf("/**");
    if (start < 0) continue;
    out.push(commentText(before.slice(start)));
  }
  return out;
}

/** Every function exported from src/entries/*.ts, with its doc comments. Throws if a declaration is not found. */
export function collectFunctions(root: string): FunctionDoc[] {
  const entriesDir = join(root, "src", "entries");
  const out: FunctionDoc[] = [];
  const entries = readdirSync(entriesDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .sort((a, b) => ENTRY_ORDER.indexOf(a) - ENTRY_ORDER.indexOf(b));
  for (const entry of entries) {
    const text = readFileSync(join(entriesDir, `${entry}.ts`), "utf8");
    const re = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      if (m[1] !== undefined) continue; // export type { ... }
      const file = resolve(entriesDir, m[3]!.replace(/\.js$/, ".ts"));
      const source = readFileSync(file, "utf8");
      for (const raw of m[2]!.split(",")) {
        const name = raw.trim();
        if (name === "" || name.startsWith("type ")) continue;
        const comments = functionComments(source, name);
        if (!new RegExp(`^export function ${name}\\s*[<(]`, "m").test(source)) {
          throw new Error(`${entry}: no "export function ${name}" in ${file}`);
        }
        out.push({ name, entry, file: file.slice(resolve(root).length + 1), comments });
      }
    }
  }
  return out;
}

/** The code of each ```ts block in the `@example` sections of a doc comment. */
export function exampleBlocks(comment: string): string[] {
  const out: string[] = [];
  const sections = comment.split(/^@example\b/m).slice(1);
  for (const section of sections) {
    const body = section.split(/^@\w+/m)[0]!;
    const re = /```ts\n([\s\S]*?)```/g;
    for (let m = re.exec(body); m !== null; m = re.exec(body)) out.push(m[1]!);
  }
  return out;
}

/** One of the sentences naming R's counterpart. */
export interface RSentence {
  /** `"base"`: Equivalent to R's `f()`. `"package"`: Equivalent to `pkg::f()` in R. `"none"`: Not an R function. */
  kind: "base" | "package" | "none";
  /**
   * The R functions named, without their arguments: `["t.test()"]` for `t.test()` or `t.test(x, y)`,
   * `["car::Anova()"]`; an operator or variable as written (`%*%`, `.Random.seed`).
   */
  names: string[];
  /** The text inside the backquotes, as written. */
  codes: string[];
  /** The whole sentence. */
  text: string;
}

const CODE = "`[^`]+`";
const SEP = "(?:, (?:and |or )?| and | or )";
const BASE = new RegExp(`^Equivalent to R's (${CODE}(?:${SEP}${CODE})*)\\.(?=\\s|$)`);
const PKG_CODE = "`[A-Za-z][A-Za-z0-9.]*::[^`]+`";
const PACKAGE = new RegExp(`^Equivalent to (${PKG_CODE}(?:${SEP}${PKG_CODE})*) in R\\.(?=\\s|$)`);
const NONE = /^Not an R function\.(?=\s|$)/;
/** Where a sentence naming R's counterpart starts (each one must then have one of the three forms). */
const TRIGGER = /(?<=^|[.!?:)]\s+)(?:Equivalent to\b|Not an R function\b)/g;

/**
 * The sentences of the comments that name R's counterpart, and the ones that start like such a sentence but do
 * not have one of the fixed forms (`invalid`, the first 80 characters from where they start).
 */
export function rSentences(comments: string[]): { sentences: RSentence[]; invalid: string[] } {
  const sentences: RSentence[] = [];
  const invalid: string[] = [];
  for (const comment of comments) {
    const text = comment.replace(/\s*\n\s*/g, " ");
    for (const m of text.matchAll(TRIGGER)) {
      const rest = text.slice(m.index);
      const base = BASE.exec(rest);
      const pkg = PACKAGE.exec(rest);
      const none = NONE.exec(rest);
      const codes = (s: string): string[] => [...s.matchAll(/`([^`]+)`/g)].map((c) => c[1]!);
      const names = (cs: string[]): string[] => cs.map((c) => (/^[\w.:]+\(/.test(c) ? `${c.slice(0, c.indexOf("("))}()` : c));
      if (base !== null) {
        const cs = codes(base[1]!);
        sentences.push({ kind: "base", names: names(cs), codes: cs, text: base[0] });
      } else if (pkg !== null) {
        const cs = codes(pkg[1]!);
        sentences.push({ kind: "package", names: names(cs), codes: cs, text: pkg[0] });
      } else if (none !== null) sentences.push({ kind: "none", names: [], codes: [], text: none[0] });
      else invalid.push(rest.slice(0, 80));
    }
  }
  return { sentences, invalid };
}
