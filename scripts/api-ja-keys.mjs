// Shared by scripts/api-ja-extract.mjs (writes the translation skeleton docs/ja/api/*.json) and
// scripts/typedoc-ja-plugin.mjs (applies the translations while TypeDoc builds the Japanese reference): how a TSDoc
// comment gets its key, its English text and its hash. Both must agree, so the logic lives only here.
//
// - Key: "<qualified path>#<part>" (see the header of api-ja-extract.mjs for the format).
// - English text of an entry: the display parts of the comment joined back into TSDoc text ({@link X} and
//   {@link X | text} rebuilt from the target's name), trimmed, with every fenced code block replaced by a numbered
//   placeholder ⟦code1⟧, ⟦code2⟧, ...
// - Hash: first 12 hex characters of the SHA-256 of that text. A translation applies only while its hash equals the
//   hash of the English now being generated.
// - Inherited members (TypeDoc's inheritedFrom) are walked under the qualified name of the member they inherit from,
//   flagged inherited, so that the parent's key can fill them. They are never written to the JSON files.
//
// The functions take TypeDoc's JSON output (the result of --json, or app.serializer.projectToObject).

import { createHash } from "node:crypto";

export const FENCED_CODE = /```[\s\S]*?```/g;
export const PLACEHOLDER = /⟦code\d+⟧/g;

export function slugOf(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function hashOf(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

// Replaces each fenced code block with a numbered placeholder.
export function placeholderize(text) {
  let n = 0;
  const en = text.replace(FENCED_CODE, () => `⟦code${++n}⟧`);
  return { en, placeholders: n };
}

// Joins the display parts back into TSDoc text. {@link X} and {@link X | text} are rebuilt from the target's name.
export function render(parts, symbols) {
  return (parts ?? [])
    .map((p) => {
      if (p.kind !== "inline-tag") return p.text;
      const target = p.target !== undefined ? symbols[p.target]?.qualifiedName : undefined;
      if (p.tag === "@link" && target !== undefined) {
        return p.text === target ? `{@link ${target}}` : `{@link ${target} | ${p.text}}`;
      }
      return p.text ? `{${p.tag} ${p.text}}` : `{${p.tag}}`;
    })
    .join("")
    .trim();
}

// A reflection and its descendants. The comment of the reflection is keyed by its own path.
// ctx.symbols is the project's symbolIdMap; ctx.add(key, text, loc, inherited) is called for every comment, with
// loc = { id, tagIndex }: the id of the reflection that owns the comment, and the index in comment.blockTags
// (undefined for the summary).
export function walkNode(node, path, ctx, inherited = false) {
  if (node.inheritedFrom) {
    path = node.inheritedFrom.qualifiedName ?? node.inheritedFrom.name;
    inherited = true;
  }
  emitComment(ctx, node, path, "summary", inherited);
  walkMembers(node, path, ctx, inherited);
}

function walkMembers(node, path, ctx, inherited) {
  for (const child of node.children ?? []) walkNode(child, `${path}.${child.name}`, ctx, inherited);
  const sigs = node.signatures ?? [];
  sigs.forEach((sig, i) => walkSignature(sig, sigs.length > 1 ? `${path}(${i})` : path, ctx, inherited));
  for (const sig of [node.getSignature, node.setSignature]) if (sig) walkSignature(sig, path, ctx, inherited);
  if (node.type?.type === "reflection" && node.type.declaration) walkNode(node.type.declaration, path, ctx, inherited);
}

function walkSignature(sig, path, ctx, inherited) {
  emitComment(ctx, sig, path, "summary", inherited);
  for (const tp of sig.typeParameters ?? []) emitComment(ctx, tp, path, `@typeParam ${tp.name}`, inherited);
  for (const p of sig.parameters ?? []) {
    emitComment(ctx, p, path, `@param ${p.name}`, inherited);
    walkMembers(p, `${path}.${p.name}`, ctx, inherited);
  }
  if (sig.type?.type === "reflection" && sig.type.declaration) walkNode(sig.type.declaration, path, ctx, inherited);
}

function emitComment(ctx, owner, base, summaryPart, inherited) {
  const comment = owner.comment;
  if (!comment) return;
  const parts = [[summaryPart, render(comment.summary, ctx.symbols), undefined]];
  const tags = (comment.blockTags ?? []).map((t, index) => ({ t, index })).filter(({ t }) => t.tag !== "@category");
  const count = new Map();
  for (const { t } of tags) count.set(t.tag, (count.get(t.tag) ?? 0) + 1);
  const seen = new Map();
  for (const { t, index } of tags) {
    let part = t.tag;
    if (count.get(t.tag) > 1) {
      const n = seen.get(t.tag) ?? 0;
      seen.set(t.tag, n + 1);
      part = `${t.tag}[${n}]`;
    }
    parts.push([part, render(t.content, ctx.symbols), index]);
  }
  for (const [part, text, tagIndex] of parts) ctx.add(`${base}#${part}`, text, { id: owner.id, tagIndex }, inherited);
}
