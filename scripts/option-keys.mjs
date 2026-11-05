// Lists the keys of the options objects that the public functions take, from their types, for the check of unknown
// keys (src/internal/checkOptions.ts):
//
//   node scripts/option-keys.mjs [--table table.json] [--excluded excluded.json] [--write | --dry-run]
//
// Without --table (and without --write) the table is printed on stdout. Reads the exports of src/entries/* with the
// compiler API of the typescript package in node_modules (TypeScript 7, typescript/unstable/sync); no build.
//
// --write puts the checks into the sources (see writeChecks at the end): a generated block of key lists after the
// imports of each file and a checkOptions line at the start of each function, both marked, and the marked code of an
// earlier run taken out first. Run it after adding an exported function or changing an options type; --dry-run only
// counts what would change. Functions with a check of their own (OWN_CHECK), a hand-written first statement that stays
// before the checks (BEFORE_GENERATED), positions where the options and a data frame can both come (CONDITIONS), names
// of positions in the message (POSITION_PATHS) and distSummary's keys per distribution (from the d functions) are set
// below.
//
// The table has one entry per exported function that takes an options object somewhere: for each signature (each
// overload), the parameters whose type is an object with fixed keys, with the keys (the members of a union, an
// intersection and the extended interfaces together) and the nested objects with fixed keys under their path
// ("control", "control.inner"), and flags for what a person should look at (a union with a primitive, an array or a
// function at the same position, several object types in one union). `kinds` gives the kind of every parameter of a
// signature (options, primitive, excluded:reason), to see where overloads put an options object and data at the same
// position. `byPosition` merges the overloads. `implementation` is the signature of the body of an overloaded
// function, flagged where it takes an options object at a position no overload has.
//
// A parameter or nested property is not an options object, and goes to the excluded list with its reason, when its
// type is (each member of a union on its own):
//   indexSignature  an object with an index signature: Record<string, ...>, DataFrame, contrasts; the keys are the
//                   user's data
//   array           an array, a tuple or ArrayLike (Sample, Counts, number[][])
//   typedArray      Float64Array and the other typed arrays, ArrayBuffer, DataView
//   function        anything callable (callbacks, SplineFunction)
//   builtin         another object type of the standard library (Map, Set, Date, RegExp, Promise)
//   result          a result of the library given back to it (a fitted model, a test result): an interface or alias
//                   whose name ends in Result, Fit, Summary or Table or is QR (qr's decomposition), or a parameter
//                   named fit, object or model
//   anyOrUnknown    any, unknown or object: no keys to check
//   typeParameter   a type parameter whose constraint has no object with fixed keys
// Parameters whose types are only primitives (number, string, boolean, literals) are counted but not listed. Of the
// nested properties, only those of the kinds indexSignature, result, builtin and anyOrUnknown are listed (arrays,
// functions and primitives inside an options object are the ordinary case).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { API, SignatureKind, SymbolFlags, TypeFlags } from "typescript/unstable/sync";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\\/g, "/");

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const tablePath = argValue("--table");
const excludedPath = argValue("--excluded");
const write = args.includes("--write") || args.includes("--dry-run");
const dryRun = args.includes("--dry-run");

const TYPED_ARRAY = /^(Float(16|32|64)|Int(8|16|32)|Uint(8|16|32)|Uint8Clamped|BigInt64|BigUint64)Array$|^(ArrayBuffer|SharedArrayBuffer|DataView)$/;
const RESULT_NAME = /(Result|Fit|Summary|Table)$|^QR$/;
const RESULT_PARAM = new Set(["fit", "object", "model"]);
const MAX_DEPTH = 6;

const api = new API({ cwd: root });
const snapshot = api.updateSnapshot({ openProjects: [`${root}tsconfig.json`] });
const project = snapshot.getProjects()[0];
const checker = project.checker;

const relPath = (p) => {
  const path = (p ?? "").replace(/\\/g, "/");
  return path.toLowerCase().startsWith(root.toLowerCase()) ? path.slice(root.length) : path;
};
const isLibPath = (p) => /node_modules|\/lib\.[\w.]*d\.ts$|bundled:/.test(p ?? "");
const typeText = (t) => checker.typeToString(t);

/** The name of a type for the messages and the result rule: its alias, else its symbol. */
function typeName(t) {
  const alias = t.getAliasSymbol();
  if (alias) return alias.name;
  const sym = t.getSymbol();
  return sym && !sym.name.startsWith("__") ? sym.name : undefined;
}

/** The members of a type without undefined, null and void. */
function members(t) {
  const list = t.isUnionType() ? t.getTypes() : [t];
  return list.filter((m) => !(m.flags & (TypeFlags.Undefined | TypeFlags.Null | TypeFlags.Void)));
}

/** The ids of the object members of a type, to stop at a recursive type. */
const objectIds = (t) =>
  members(t)
    .filter((m) => m.flags & TypeFlags.Object || (m.isIntersectionType() && !m.getTypes().some((x) => x.flags & TypeFlags.Primitive)))
    .filter((m) => !checker.isArrayType(m) && !checker.isTupleType(m))
    .map((m) => m.id);

/**
 * The kind of one member of a union: { kind: "primitive" }, { kind: "object", type } (fixed keys) or
 * { kind: "excluded", reason, name }. `aliasName` is the alias of the enclosing union (Sample), for the messages.
 */
function classifyMember(m, paramName, aliasName) {
  const name = typeName(m) ?? aliasName;
  if (m.flags & (TypeFlags.Any | TypeFlags.Unknown)) return { kind: "excluded", reason: "anyOrUnknown", name };
  if (m.flags & TypeFlags.Never) return { kind: "primitive" };
  if (m.flags & TypeFlags.Primitive || m.flags & TypeFlags.TemplateLiteral) return { kind: "primitive" };
  // A branded primitive such as string & {} (a string with completions for the known values)
  if (m.isIntersectionType() && m.getTypes().some((x) => x.flags & TypeFlags.Primitive)) return { kind: "primitive" };
  if (m.isTypeParameter()) {
    const c = checker.getBaseConstraintOfType(m);
    if (!c || c.id === m.id) return { kind: "excluded", reason: "typeParameter", name };
    const inner = members(c).map((x) => classifyMember(x, paramName, typeName(c)));
    const objects = inner.filter((x) => x.kind === "object");
    if (objects.length === 1) return objects[0];
    if (inner.every((x) => x.kind === "primitive")) return { kind: "primitive" };
    return { kind: "excluded", reason: "typeParameter", name, inner };
  }
  if (!(m.flags & (TypeFlags.Object | TypeFlags.Intersection))) return { kind: "excluded", reason: "anyOrUnknown", name };
  if (checker.isArrayType(m) || checker.isTupleType(m)) return { kind: "excluded", reason: "array", name };
  const sym = m.getSymbol();
  if (sym?.name === "ArrayLike") return { kind: "excluded", reason: "array", name: sym.name };
  if (sym && TYPED_ARRAY.test(sym.name)) return { kind: "excluded", reason: "typedArray", name: sym.name };
  if (checker.getSignaturesOfType(m, SignatureKind.Call).length > 0) return { kind: "excluded", reason: "function", name };
  if (checker.getIndexInfosOfType(m).length > 0) {
    const fixed = checker.getPropertiesOfType(m).map((p) => p.name).filter((k) => !k.startsWith("__@"));
    return { kind: "excluded", reason: "indexSignature", name, ...(fixed.length ? { fixedKeys: fixed } : {}) };
  }
  if (sym && !sym.name.startsWith("__") && sym.declarations?.length && sym.declarations.every((d) => isLibPath(d.path))) {
    return { kind: "excluded", reason: "builtin", name: sym.name };
  }
  if ((name && RESULT_NAME.test(name)) || RESULT_PARAM.has(paramName)) return { kind: "excluded", reason: "result", name };
  const props = checker.getPropertiesOfType(m).filter((p) => !p.name.startsWith("__@"));
  if (props.length === 0) return { kind: "excluded", reason: "anyOrUnknown", name: name ?? typeText(m) };
  return { kind: "object", type: m, name };
}

/**
 * The analysis of a type at a parameter or a property: the keys (merged over the object members), the nested objects
 * and the flags; or, when no member is an object with fixed keys, the reasons of the excluded members.
 */
function analyse(t, paramName, depth, seen) {
  const alias = t.getAliasSymbol()?.name;
  const parts = members(t).map((m) => classifyMember(m, paramName, alias));
  const objects = parts.filter((p) => p.kind === "object");
  const excluded = parts.filter((p) => p.kind === "excluded");
  const primitives = parts.filter((p) => p.kind === "primitive");
  if (objects.length === 0) {
    if (excluded.length === 0) return { kind: "primitive" };
    return { kind: "excluded", reasons: excluded.map(({ reason, name, fixedKeys }) => ({ reason, ...(name ? { name } : {}), ...(fixedKeys ? { fixedKeys } : {}) })) };
  }
  const keys = [];
  const nested = [];
  const nestedExcluded = [];
  const flags = [];
  if (objects.length > 1) flags.push(`union of ${objects.length} object types (${objects.map((o) => o.name ?? "anonymous").join(", ")})`);
  if (primitives.length) flags.push(`union with a primitive (${typeText(t)})`);
  for (const e of excluded) flags.push(`union with ${e.reason}${e.name ? ` (${e.name})` : ""}`);
  const propTypes = new Map();
  for (const o of objects) {
    for (const p of checker.getPropertiesOfType(o.type)) {
      if (p.name.startsWith("__@")) continue;
      if (!keys.includes(p.name)) keys.push(p.name);
      const pt = checker.getTypeOfSymbol(p);
      if (pt) (propTypes.get(p.name) ?? propTypes.set(p.name, []).get(p.name)).push(pt);
    }
  }
  if (depth < MAX_DEPTH) {
    for (const [key, types] of propTypes) {
      for (const pt of types) {
        const ids = objectIds(pt);
        if (ids.some((id) => seen.has(id))) {
          flags.push(`recursive type at ${key}`);
          continue;
        }
        const inner = analyse(pt, key, depth + 1, new Set([...seen, ...ids]));
        if (inner.kind === "options") {
          const prev = nested.find((n) => n.path === key);
          if (prev) {
            for (const k of inner.keys) if (!prev.keys.includes(k)) prev.keys.push(k);
          } else {
            nested.push({ path: key, keys: inner.keys, ...(inner.flags.length ? { flags: inner.flags } : {}), type: typeText(pt) });
          }
          for (const n of inner.nested) nested.push({ ...n, path: `${key}.${n.path}` });
          for (const n of inner.nestedExcluded) nestedExcluded.push({ ...n, path: `${key}.${n.path}` });
        } else if (inner.kind === "excluded") {
          const listed = inner.reasons.filter((r) => ["indexSignature", "result", "builtin", "anyOrUnknown"].includes(r.reason));
          if (listed.length) nestedExcluded.push({ path: key, reasons: listed, type: typeText(pt) });
        }
      }
    }
  }
  return { kind: "options", keys, nested, nestedExcluded, flags };
}

/** The kind of a parameter for the table: options, primitive, or excluded with the reasons. */
const kindOf = (a) => (a.kind === "excluded" ? `excluded:${[...new Set(a.reasons.map((r) => r.reason))].join("|")}` : a.kind);

function optionEntry(p, pt, index, rest, a) {
  const o = { index, param: p.name, ...(rest ? { rest: true } : {}), type: typeText(pt), keys: a.keys };
  if (a.nested.length) o.nested = a.nested;
  if (a.flags.length) o.flags = a.flags;
  return o;
}

/** The signature of the declaration with a body (the implementation of the overloads), if any. */
function implementationSignature(target) {
  for (const d of target.declarations ?? []) {
    const node = d.resolve(project);
    if (node?.body) return checker.getSignatureFromDeclaration(node);
  }
  return undefined;
}

/**
 * The first statement of a body that stays before the generated checks: lmer's and lmerTest's check of R's arguments
 * that are not supported (an Error naming the argument, before the RangeError of an unknown key)
 */
const BEFORE_GENERATED = /^checkLmerOptions\(/;

/**
 * The declaration with a body (the implementation): its file, its parameters and the offset just after its `{` (or
 * just after the `;` of a first statement matching BEFORE_GENERATED, written on one line)
 */
function bodyDeclaration(target) {
  for (const d of target.declarations ?? []) {
    const node = d.resolve(project);
    if (!node?.body) continue;
    const file = relPath(d.path);
    const text = readFileSync(`${root}${file}`, "utf8");
    let open = text.indexOf("{", node.body.pos);
    const first = node.body.statements?.[0];
    if (first && BEFORE_GENERATED.test(text.slice(first.pos, first.end).trim())) open = first.end - 1;
    const params = [...node.parameters].map((p) => ({ name: typeof p.name.text === "string" ? p.name.text : undefined, rest: !!p.dotDotDotToken }));
    return { file, open, params };
  }
  return undefined;
}

const table = [];
const excludedList = [];
const bodies = new Map();
let distNames;
const counts = { functions: 0, signatures: 0, parameters: 0, primitiveParameters: 0, optionParameters: 0, excludedParameters: 0 };
const skippedExports = [];
const byTarget = new Map();

const entries = readdirSync(`${root}src/entries`).filter((f) => f.endsWith(".ts")).sort();
for (const entryFile of entries) {
  const entry = entryFile.replace(/\.ts$/, "");
  const sf = project.program.getSourceFile(`${root}src/entries/${entryFile}`);
  const moduleSymbol = checker.getSymbolAtLocation(sf);
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const target = exp.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const type = checker.getTypeOfSymbol(target);
    const sigs = type ? checker.getSignaturesOfType(type, SignatureKind.Call) : [];
    if (sigs.length === 0) {
      if (target.valueDeclaration) skippedExports.push({ name: exp.name, entry, reason: "not callable" });
      continue;
    }
    const prev = byTarget.get(target.id);
    if (prev) {
      if (!prev.entries.includes(entry)) prev.entries.push(entry);
      continue;
    }
    const fn = { name: exp.name, entries: [entry], file: relPath(target.valueDeclaration?.path ?? target.declarations?.[0]?.path), overloads: sigs.length, signatures: [], byPosition: {} };
    byTarget.set(target.id, fn);
    counts.functions++;
    sigs.forEach((sig, overload) => {
      counts.signatures++;
      const params = sig.getParameters();
      const sigOut = { overload, params: params.map((p) => p.name), kinds: [], options: [] };
      params.forEach((p, index) => {
        counts.parameters++;
        const pt = checker.getTypeOfSymbol(p);
        const rest = sig.hasRestParameter && index === params.length - 1;
        const a = analyse(pt, p.name, 0, new Set(objectIds(pt)));
        sigOut.kinds.push(kindOf(a));
        if (a.kind === "primitive") {
          counts.primitiveParameters++;
        } else if (a.kind === "excluded") {
          counts.excludedParameters++;
          excludedList.push({ function: exp.name, entries: fn.entries, overload, index, param: p.name, ...(rest ? { rest: true } : {}), type: typeText(pt), reasons: a.reasons });
        } else {
          counts.optionParameters++;
          sigOut.options.push(optionEntry(p, pt, index, rest, a));
          const pos = (fn.byPosition[index] ??= { keys: [], nested: {} });
          for (const k of a.keys) if (!pos.keys.includes(k)) pos.keys.push(k);
          for (const n of a.nested) {
            const nk = (pos.nested[n.path] ??= []);
            for (const k of n.keys) if (!nk.includes(k)) nk.push(k);
          }
          for (const n of a.nestedExcluded) {
            excludedList.push({ function: exp.name, entries: fn.entries, overload, index, param: p.name, path: n.path, type: n.type, reasons: n.reasons });
          }
        }
      });
      fn.signatures.push(sigOut);
    });
    // The implementation of an overloaded function: the positions where it takes an options object that no overload
    // has there (an options object in place of an optional argument, read by the body before the check)
    const impl = sigs.length > 1 ? implementationSignature(target) : undefined;
    if (impl) {
      const params = impl.getParameters();
      const implOut = { params: params.map((p) => p.name), kinds: [], options: [] };
      params.forEach((p, index) => {
        const pt = checker.getTypeOfSymbol(p);
        const a = analyse(pt, p.name, 0, new Set(objectIds(pt)));
        implOut.kinds.push(kindOf(a));
        if (a.kind === "options") {
          const o = optionEntry(p, pt, index, impl.hasRestParameter && index === params.length - 1, a);
          if (!fn.byPosition[index]) o.flags = [...(o.flags ?? []), "options at a position no overload has"];
          implOut.options.push(o);
        }
      });
      fn.implementation = implOut;
    }
    if (write) {
      const body = bodyDeclaration(target);
      if (body) bodies.set(fn, body);
      if (exp.name === "distSummary") distNames = members(checker.getTypeOfSymbol(sigs[0].getParameters()[0])).map((m) => typeText(m).replace(/"/g, ""));
    }
    table.push(fn);
  }
}

api.close();

// ---------------------------------------------------------------------------------------------------------------------
// --write: the checks of unknown keys in the sources
//
// Each file with an exported function that takes options gets, after its imports, a generated block with the import
// of checkOptions and one constant per key list (PNORM_KEYS, OPTIM_CONTROL_KEYS), and each such function gets one
// line per options position (and per nested object) at the start of its body. The generated code is marked, and a
// new run takes out that of the last run first, so that the checks follow the types after every change.

const GENERATED_BEGIN = "// Generated by `node scripts/option-keys.mjs --write` from the option types; do not edit (begin)";
const GENERATED_END = "// Generated by `node scripts/option-keys.mjs --write` (end)";
const LINE_MARK = " // generated: option-keys.mjs";

/**
 * Functions with a check of their own: lmerAnova and glmerAnova, whose keys depend on the overload (a fit or an array
 * of fits), which the merged keys of its options position cannot tell (src/models/lmerAnova.ts,
 * src/models/glmerAnova.ts)
 */
const OWN_CHECK = new Set(["lmerAnova", "glmerAnova"]);

/**
 * Positions where an options object and the user's data with keys of its own (a data frame) can both come: the
 * condition, from the names of the parameters of the implementation, under which the value is the options.
 */
const formulaOrOptions = (p) => `typeof ${p[0]} !== "string" && isOptionsObject(${p[1]})`;
const CONDITIONS = {
  tTest: { 1: formulaOrOptions },
  wilcoxTest: { 1: formulaOrOptions },
  onewayTest: { 1: formulaOrOptions },
};

/**
 * Options positions shown in the message under a name, as R's argument it stands for: optimHess(par, fn, gr, control)
 * gives "unknown option 'control.maxitt' for optimHess", as optim's control does
 */
const POSITION_PATHS = {
  optimHess: { 3: "control" },
};

/** Reasons of a parameter's kind that a plain object test cannot tell from the options */
const NEEDS_CONDITION = new Set(["indexSignature", "result", "builtin", "anyOrUnknown", "typeParameter"]);

/**
 * The keys distSummary takes for a distribution: those of its d function (the parameters after x, then the keys of
 * the options without log and ncp), as distSummary("gamma", { shape, rate }) for dgamma(x, shape, { rate }). The
 * summaries are those of the central distributions: ncp (chisq, beta, t, f) is not read, so it is an unknown key.
 */
function distSummaryKeys(fns) {
  const keys = {};
  const missing = [];
  for (const name of distNames ?? []) {
    const d = fns.find((f) => f.name === `d${name}`);
    if (!d) {
      missing.push(name);
      continue;
    }
    const list = [];
    for (const sig of d.signatures) {
      const at = sig.kinds.indexOf("options");
      for (const p of sig.params.slice(1, at < 0 ? undefined : at)) if (!list.includes(p)) list.push(p);
      for (const o of sig.options) for (const k of o.keys) if (k !== "log" && k !== "ncp" && !list.includes(k)) list.push(k);
    }
    keys[name] = list;
  }
  return { keys, missing };
}

/** Takes out the generated code; returns the text and the removed ranges [start, end) of the original */
function stripGenerated(text) {
  const removed = [];
  let i = 0;
  while (i < text.length) {
    const end = text.indexOf("\n", i);
    const lineEnd = end < 0 ? text.length : end + 1;
    const line = text.slice(i, end < 0 ? text.length : end).replace(/\r$/, "");
    if (line === GENERATED_BEGIN) {
      const close = text.indexOf(GENERATED_END, i);
      if (close < 0) throw new Error("generated block without its end");
      const after = text.indexOf("\n", close);
      const blockEnd = after < 0 ? text.length : after + 1;
      removed.push([i, blockEnd]);
      i = blockEnd;
      continue;
    }
    if (line.endsWith(LINE_MARK)) removed.push([i, lineEnd]);
    i = lineEnd;
  }
  let out = "";
  let at = 0;
  for (const [s, e] of removed) {
    out += text.slice(at, s);
    at = e;
  }
  out += text.slice(at);
  const map = (offset) => offset - removed.filter(([, e]) => e <= offset).reduce((n, [s, e]) => n + e - s, 0);
  return { text: out, map };
}

const constName = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();

/** A key list as a constant: an array for a few keys, a Set (marked pure for tree shaking) for more */
function keyConstant(name, keys, maxWidth = 120) {
  const items = keys.map((k) => JSON.stringify(k));
  const [open, close] = keys.length <= 8 ? ["[", "] as const;"] : ["/* @__PURE__ */ new Set([", "]);"];
  const one = `const ${name} = ${open}${items.join(", ")}${close}`;
  if (one.length <= maxWidth) return [one];
  const lines = [`const ${name} = ${open}`];
  let line = "  ";
  for (const item of items) {
    if (line.length + item.length + 2 > maxWidth && line.trim()) {
      lines.push(line.trimEnd());
      line = "  ";
    }
    line += `${item}, `;
  }
  lines.push(line.trimEnd().replace(/,$/, ","));
  lines.push(close);
  return lines;
}

/** The reasons (array, indexSignature, ...) of the other types that can come at an options position */
function positionReasons(fn, p) {
  const reasons = new Set();
  for (const sig of [...fn.signatures, ...(fn.implementation ? [fn.implementation] : [])]) {
    const kind = sig.kinds[p];
    if (kind === undefined) continue;
    if (kind.startsWith("excluded:")) for (const r of kind.slice(9).split("|")) reasons.add(r);
    const o = sig.options.find((x) => x.index === p);
    for (const f of o?.flags ?? []) {
      const m = /^union with (\w+)/.exec(f);
      if (m && m[1] !== "a") reasons.add(m[1]);
    }
  }
  return reasons;
}

/** The plan of the checks of one function: its constants and the lines at the start of its body, or the problems */
function planFunction(fn, body, taken) {
  const problems = [];
  const params = body.params.map((p) => p.name);
  const restIndex = body.params.findIndex((p) => p.rest);
  const positions = new Map();
  for (const [p, pos] of Object.entries(fn.byPosition)) positions.set(Number(p), { keys: [...pos.keys], nested: { ...(pos.nested ?? {}) } });
  for (const o of fn.implementation?.options ?? []) {
    const pos = positions.get(o.index) ?? positions.set(o.index, { keys: [], nested: {} }).get(o.index);
    for (const k of o.keys) if (!pos.keys.includes(k)) pos.keys.push(k);
    for (const n of o.nested ?? []) {
      const nk = (pos.nested[n.path] ??= []);
      for (const k of n.keys) if (!nk.includes(k)) nk.push(k);
    }
  }
  const constants = [];
  const lines = [];
  const imports = new Set(["checkOptions"]);
  const base = constName(fn.name);
  const distinct = new Set([...positions.values()].map((v) => v.keys.join(","))).size;
  const constantFor = (name, keys) => {
    const same = constants.find((c) => c.keys.join(",") === keys.join(","));
    if (same) return same.name;
    let unique = name;
    for (let n = 2; taken.has(unique); n++) unique = `${name}_${n}`;
    taken.add(unique);
    constants.push({ name: unique, keys });
    return unique;
  };
  for (const [p, pos] of [...positions].sort((a, b) => a[0] - b[0])) {
    let expr;
    if (restIndex >= 0 && p >= restIndex) {
      expr = `optionsIn(${params[restIndex]})`;
      imports.add("optionsIn");
    } else if (p < params.length) {
      expr = params[p];
      if (expr === undefined) problems.push(`${fn.name}: the parameter at ${p} is destructured; give it a name`);
    } else {
      problems.push(`${fn.name}: the implementation has no parameter at ${p}`);
    }
    if (expr === undefined) continue;
    const reasons = positionReasons(fn, p);
    let condition;
    const custom = CONDITIONS[fn.name]?.[p];
    if (custom) {
      condition = custom(params);
      imports.add("isOptionsObject");
    } else if ([...reasons].some((r) => NEEDS_CONDITION.has(r))) {
      problems.push(`${fn.name}: at ${p} the options can be ${[...reasons].join(", ")}; add a condition to CONDITIONS`);
      continue;
    } else if ((reasons.has("array") || reasons.has("typedArray")) && !expr.startsWith("optionsIn(")) {
      condition = `isOptionsObject(${expr})`;
      imports.add("isOptionsObject");
    }
    const name = constantFor(distinct > 1 ? `${base}_KEYS_${p}` : `${base}_KEYS`, pos.keys);
    const guard = condition ? `if (${condition}) ` : "";
    const named = POSITION_PATHS[fn.name]?.[p];
    lines.push(`${guard}checkOptions(${expr}, ${name}, ${JSON.stringify(fn.name)}${named ? `, ${JSON.stringify(named)}` : ""});`);
    for (const [path, keys] of Object.entries(pos.nested)) {
      const nestedName = constantFor(`${base}_${constName(path.replace(/\./g, "_"))}_KEYS`, keys);
      imports.add("nestedOptions");
      const shown = named ? `${named}.${path}` : path;
      lines.push(`${guard}checkOptions(nestedOptions(${expr}, ${JSON.stringify(path)}), ${nestedName}, ${JSON.stringify(fn.name)}, ${JSON.stringify(shown)});`);
    }
  }
  return { constants, lines, imports, problems };
}

function writeChecks(fns) {
  const byFile = new Map();
  const problems = [];
  const skipped = [];
  const takenByFile = new Map();
  const taken = (file) => takenByFile.get(file) ?? takenByFile.set(file, new Set()).get(file);
  for (const fn of fns) {
    if (OWN_CHECK.has(fn.name)) {
      skipped.push(`${fn.name} (a check of its own)`);
      continue;
    }
    const body = bodies.get(fn);
    if (!body) {
      problems.push(`${fn.name}: no declaration with a body`);
      continue;
    }
    const plan = planFunction(fn, body, taken(body.file));
    problems.push(...plan.problems);
    const entry = byFile.get(body.file) ?? byFile.set(body.file, { constants: [], imports: new Set(), bodies: [] }).get(body.file);
    entry.constants.push(...plan.constants);
    for (const i of plan.imports) entry.imports.add(i);
    entry.bodies.push({ open: body.open, lines: plan.lines, name: fn.name });
  }
  // distSummary(distribution, params): params is a Record in the type; the keys depend on the distribution
  const ds = table.find((f) => f.name === "distSummary");
  const dsBody = ds && bodies.get(ds);
  if (dsBody) {
    const { keys, missing } = distSummaryKeys(fns);
    if (missing.length) skipped.push(`distSummary for ${missing.join(", ")} (no d function of that name)`);
    const entry = byFile.get(dsBody.file) ?? byFile.set(dsBody.file, { constants: [], imports: new Set(), bodies: [] }).get(dsBody.file);
    entry.imports.add("checkOptions");
    entry.constants.push({ name: "DIST_SUMMARY_KEYS", record: keys });
    const [dist, params] = dsBody.params.map((p) => p.name);
    entry.bodies.push({
      open: dsBody.open,
      name: "distSummary",
      lines: [`if (Object.hasOwn(DIST_SUMMARY_KEYS, ${dist})) checkOptions(${params}, DIST_SUMMARY_KEYS[${dist}] ?? [], "distSummary");`],
    });
  } else {
    problems.push("distSummary: not found");
  }
  if (problems.length) {
    process.stderr.write(`Not written; fix these first:\n${problems.map((p) => `  ${p}\n`).join("")}`);
    process.exitCode = 1;
    return;
  }
  // Files with generated code of an earlier run that now have none
  for (const file of sourceFiles(`${root}src`)) {
    const rel = relPath(file);
    if (byFile.has(rel.toLowerCase()) || byFile.has(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes(GENERATED_BEGIN)) byFile.set(rel, { constants: [], imports: new Set(), bodies: [] });
  }
  let changed = 0;
  let checks = 0;
  for (const [file, entry] of byFile) {
    const path = `${root}${file}`;
    const original = readFileSync(path, "utf8");
    const { text, map } = stripGenerated(original);
    let out = text;
    // The lines at the start of the bodies, from the last body on so that the offsets stay valid
    const inserts = entry.bodies.filter((b) => b.lines.length).map((b) => ({ ...b, at: map(b.open) + 1 }));
    inserts.sort((a, b) => b.at - a.at);
    for (const b of inserts) {
      const after = out[b.at - 1];
      if (after !== "{" && after !== ";") throw new Error(`${file}: no { or ; at the body of ${b.name}`);
      const lineStart = out.lastIndexOf("\n", b.at - 1) + 1;
      const indent = `${/^\s*/.exec(out.slice(lineStart))[0]}${after === "{" ? "  " : ""}`;
      out = out.slice(0, b.at) + b.lines.map((l) => `\n${indent}${l}${LINE_MARK}`).join("") + out.slice(b.at);
      checks += b.lines.length;
    }
    if (entry.constants.length) {
      const up = file.split("/").length - 2;
      const internal = `${up === 0 ? "./" : "../".repeat(up)}internal/`;
      const fromCheck = ["checkOptions", "nestedOptions"].filter((i) => entry.imports.has(i));
      const fromArgs = ["isOptionsObject", "optionsIn"].filter((i) => entry.imports.has(i));
      const block = [GENERATED_BEGIN, `import { ${fromCheck.join(", ")} } from "${internal}checkOptions.js";`];
      if (fromArgs.length) block.push(`import { ${fromArgs.join(", ")} } from "${internal}optionalArgs.js";`);
      for (const c of entry.constants) {
        if (c.record) {
          block.push(`const ${c.name}: Readonly<Record<string, readonly string[]>> = {`);
          for (const [k, v] of Object.entries(c.record)) block.push(`  ${k}: [${v.map((x) => JSON.stringify(x)).join(", ")}],`);
          block.push("};");
        } else {
          block.push(...keyConstant(c.name, c.keys));
        }
      }
      block.push(GENERATED_END);
      // After the imports, or (a file without imports) after the comment at the top of the file
      const imports = [...out.matchAll(/^import\b[\s\S]*?;[ \t]*$/gm)];
      const last = imports[imports.length - 1];
      const at = last ? last.index + last[0].length : /^(?:\/\/.*\n)*/.exec(out)[0].length - 1;
      if (at < 0) throw new Error(`${file}: neither imports nor a comment at the top to put the generated block after`);
      out = `${out.slice(0, at)}\n${block.join("\n")}${out.slice(at)}`;
    }
    if (out !== original) {
      changed++;
      if (!dryRun) writeFileSync(path, out);
    }
  }
  process.stderr.write(
    `${dryRun ? "Would write" : "Wrote"} ${checks} checks in ${changed} changed files` +
      (skipped.length ? `; not checked: ${skipped.join("; ")}` : "") +
      "\n",
  );
}

/** The .ts files under a directory */
function sourceFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const withOptions = table.filter((f) => Object.keys(f.byPosition).length > 0);
for (const f of withOptions) for (const pos of Object.values(f.byPosition)) if (Object.keys(pos.nested).length === 0) delete pos.nested;
const out = {
  generatedBy: "scripts/option-keys.mjs",
  counts: { ...counts, functionsWithOptions: withOptions.length },
  functions: withOptions,
  functionsWithoutOptions: table.filter((f) => Object.keys(f.byPosition).length === 0).map((f) => f.name),
  skippedExports,
};
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
if (tablePath) writeFileSync(tablePath, json(out));
else if (!write) process.stdout.write(json(out));
if (write) writeChecks(withOptions);
if (excludedPath) writeFileSync(excludedPath, json(excludedList));
process.stderr.write(`${withOptions.length} functions with options of ${counts.functions}; ${counts.optionParameters} option parameters, ${counts.excludedParameters} excluded\n`);
