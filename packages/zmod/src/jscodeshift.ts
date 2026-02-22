import { builders, namedTypes } from "ast-types";
import { parse } from "./oxc-parser-adapter.js";
import { Collection, type ASTNode } from "./collection.js";

export type { ASTNode, NodePath } from "./collection.js";
export { Collection, FilteredCollection } from "./collection.js";

/**
 * The `j` function: parse source code and return a Collection for querying/transforming.
 *
 * Usage:
 *   const root = j(source);
 *   root.find(j.CallExpression, { callee: { name: "foo" } })
 *       .replaceWith(path => path.node.arguments[0])
 *   return root.toSource();
 *
 * Also exposes ast-types builders and namedTypes as properties:
 *   j.identifier("foo")
 *   j.CallExpression  // type checker for find()
 */
export interface JFunction {
  (source: string): Collection;

  // ast-types namedTypes (for find)
  [key: string]: any;
}

function createJ(): JFunction {
  const jFn = (source: string): Collection => {
    const program = parse(source);
    return new Collection(source, program);
  };

  // Attach ast-types namedTypes (e.g., j.CallExpression, j.Identifier, etc.)
  for (const [name, type] of Object.entries(namedTypes)) {
    (jFn as any)[name] = type;
  }

  // Attach ast-types builders (e.g., j.identifier(), j.callExpression(), etc.)
  for (const [name, builder] of Object.entries(builders)) {
    (jFn as any)[name] = builder;
  }

  return jFn as JFunction;
}

export const j = createJ();
export type JSCodeshift = typeof j;

export type Transform = (
  fileInfo: { source: string; path: string },
  api: { j: JSCodeshift; report: (msg: string) => void },
  options?: Record<string, unknown>,
) => string | null | undefined;
