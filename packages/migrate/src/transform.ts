import { z, type NodePath } from "zmod";

/**
 * Babel plugin sets for each jscodeshift string parser alias.
 * Used when converting `export const parser = 'ts'` to a Parser object.
 */
const PARSER_PLUGINS: Record<string, string[]> = {
  babel: ["jsx"],
  babylon: ["jsx"],
  flow: ["jsx", "flow"],
  ts: ["typescript"],
  tsx: ["typescript", "jsx"],
};

/**
 * Transform a jscodeshift codemod to use the zmod API.
 *
 * Handles:
 * 1. Remove `import j from 'jscodeshift'`
 * 2. Add `import type { Transform } from 'zmod'`
 * 3. Remove `const j = api.jscodeshift`
 * 4. Rename `{ j }` → `{ z }` in transform params
 * 5. Rename all `j.` → `z.` and `j(` → `z(`
 * 6. Convert `export const parser = 'alias'` → Parser object with @babel/parser
 */
export function transformFile(source: string): string | null {
  const root = z(source);
  let dirty = false;
  let needsParserType = false;
  let needsBabelImport = false;

  // 1. Find jscodeshift import and remove it
  const jImport = root
    .find(z.ImportDeclaration)
    .filter((p: NodePath) => p.node.source?.value === "jscodeshift");

  if (jImport.length === 0) return null; // not a jscodeshift file

  jImport.remove();
  dirty = true;

  // 6. Convert string parser alias BEFORE building imports, so we know which
  //    types are needed.
  //    Handles: export const parser = 'babel' | 'babylon' | 'flow' | 'ts' | 'tsx'
  root.find(z.VariableDeclaration).forEach((p: NodePath) => {
    const decl = p.node.declarations?.[0];
    if (!decl || decl.id?.name !== "parser") return;

    const alias = decl.init?.value;
    if (typeof alias !== "string" || !PARSER_PLUGINS[alias]) return;

    // Must be a direct named export: `export const parser = '...'`
    if (p.parent?.node.type !== "ExportNamedDeclaration") return;

    const plugins = PARSER_PLUGINS[alias];
    const pluginsStr = plugins.map((pl: string) => `"${pl}"`).join(", ");

    root._addPatch(
      p.parent.node.start,
      p.parent.node.end,
      `export const parser: Parser = {\n` +
        `  parse(source, options) {\n` +
        `    return parse(source, { plugins: [${pluginsStr}], sourceType: "module", ...options }).program;\n` +
        `  },\n` +
        `};`,
    );

    needsParserType = true;
    needsBabelImport = true;
    dirty = true;
  });

  // 2. Prepend imports: zmod types + optional @babel/parser
  const hasZmodImport =
    root.find(z.ImportDeclaration).filter((p: NodePath) => p.node.source?.value === "zmod").length >
    0;

  const lines: string[] = [];

  if (!hasZmodImport) {
    const zmodTypes = needsParserType ? ["Transform", "Parser"] : ["Transform"];
    lines.push(`import type { ${zmodTypes.join(", ")} } from "zmod";`);
  }

  if (needsBabelImport) {
    lines.push(`import { parse } from "@babel/parser";`);
  }

  if (lines.length > 0) {
    root.insertAt(0, lines.join("\n") + "\n");
  }

  // 3. Remove `const j = api.jscodeshift`
  root
    .find(z.VariableDeclaration)
    .filter((p: NodePath) => {
      const decl = p.node.declarations?.[0];
      if (!decl) return false;
      const init = decl.init;
      return (
        init?.type === "MemberExpression" &&
        init.object?.name === "api" &&
        init.property?.name === "jscodeshift"
      );
    })
    .remove();

  // Track patched spans to avoid double-patching the same byte range.
  // oxc may produce distinct node objects that share the same span (e.g. shorthand
  // property keys/values), which causes "Overlapping patches" errors.
  const patchedSpans = new Set<string>();

  const addPatch = (start: number, end: number, text: string) => {
    const key = `${start}:${end}`;
    if (patchedSpans.has(key)) return;
    patchedSpans.add(key);
    root._addPatch(start, end, text);
    dirty = true;
  };

  // 4. Rename `{ j }` → `{ z }` in destructured transform params
  root.find(z.ObjectPattern).forEach((p: NodePath) => {
    const props = p.node.properties || [];
    for (const prop of props) {
      if (prop.key?.name === "j") {
        addPatch(prop.key.start, prop.key.end, "z");
      }
      if (prop.value?.name === "j" && prop.value !== prop.key) {
        addPatch(prop.value.start, prop.value.end, "z");
      }
    }
  });

  // 5. Rename all remaining `j.` member expressions and `j(` calls
  root.find(z.Identifier, { name: "j" }).forEach((p: NodePath) => {
    const parent = p.parent;
    if (!parent) return;
    const pt = parent.node.type;

    if (
      (pt === "MemberExpression" && parent.node.object === p.node) ||
      (pt === "CallExpression" && parent.node.callee === p.node)
    ) {
      addPatch(p.node.start, p.node.end, "z");
    }
  });

  return dirty ? root.toSource() : null;
}
