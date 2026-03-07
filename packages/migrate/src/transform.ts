import { z, type NodePath } from "zmod";

/**
 * Transform a jscodeshift codemod to use the zmod API.
 *
 * Handles:
 * 1. Remove `import j from 'jscodeshift'`
 * 2. Add `import type { Transform } from 'zmod'`
 * 3. Remove `const j = api.jscodeshift`
 * 4. Rename `{ j }` → `{ z }` in transform params
 * 5. Rename all `j.` → `z.` and `j(` → `z(`
 */
export function transformFile(source: string): string | null {
  const root = z(source);
  let dirty = false;

  // 1. Find jscodeshift import and remove it
  const jImport = root
    .find(z.ImportDeclaration)
    .filter((p: NodePath) => p.node.source?.value === "jscodeshift");

  if (jImport.length === 0) return null; // not a jscodeshift file

  jImport.remove();
  dirty = true;

  // 2. Add `import type { Transform } from 'zmod'` at top
  const hasZmodImport =
    root.find(z.ImportDeclaration).filter((p: NodePath) => p.node.source?.value === "zmod").length >
    0;

  if (!hasZmodImport) {
    root.insertAt(0, `import type { Transform } from "zmod";\n`);
  }

  // 3. Remove `const j = api.jscodeshift` or `const { jscodeshift: j } = api`
  root
    .find(z.VariableDeclaration)
    .filter((p: NodePath) => {
      const decl = p.node.declarations?.[0];
      if (!decl) return false;
      const init = decl.init;
      // const j = api.jscodeshift
      if (
        init?.type === "MemberExpression" &&
        init.object?.name === "api" &&
        init.property?.name === "jscodeshift"
      )
        return true;
      return false;
    })
    .remove();

  // 4. Rename `j` → `z` in destructured transform params: ({ j }) → ({ z })
  //    Find ObjectPattern params that contain `j`
  root.find(z.ObjectPattern).forEach((p: NodePath) => {
    const props = p.node.properties || [];
    for (const prop of props) {
      if (prop.key?.name === "j" || prop.value?.name === "j") {
        if (prop.key?.name === "j") {
          root._addPatch(prop.key.start, prop.key.end, "z");
          dirty = true;
        }
        if (prop.value?.name === "j" && prop.value !== prop.key) {
          root._addPatch(prop.value.start, prop.value.end, "z");
          dirty = true;
        }
      }
    }
  });

  // 5. Rename all remaining `j.` member expressions and `j(` calls
  //    Find Identifier nodes named `j` that are in MemberExpression or CallExpression
  root.find(z.Identifier, { name: "j" }).forEach((p: NodePath) => {
    const parent = p.parent;
    if (!parent) return;
    const pt = parent.node.type;

    // j.something or j(...)
    if (
      (pt === "MemberExpression" && parent.node.object === p.node) ||
      (pt === "CallExpression" && parent.node.callee === p.node)
    ) {
      root._addPatch(p.node.start, p.node.end, "z");
      dirty = true;
    }
  });

  return dirty ? root.toSource() : null;
}
