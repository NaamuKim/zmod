import { builders, namedTypes } from "ast-types";
import { parse } from "./oxc-parser-adapter.js";
import { Collection, NodePath, type ASTNode } from "./collection.js";

export type { ASTNode } from "./collection.js";
export { Collection, FilteredCollection, NodePath } from "./collection.js";

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

  // Core API
  match(
    path: ASTNode | NodePath,
    filter: Record<string, any> | ((node: ASTNode) => boolean),
  ): boolean;
  use(plugin: (core: any) => void): void;
  withParser(parser: any): JFunction;
  registerMethods(methods: Record<string, Function>, type?: any): void;
  types: typeof namedTypes;
  template: { statement: Function; statements: Function; expression: Function };
  filters: {
    JSXElement: {
      hasAttributes(filter: Record<string, any>): (path: NodePath) => boolean;
      hasChildren(name: string): (path: NodePath) => boolean;
    };
    VariableDeclarator: {
      requiresModule(names: string | string[]): (path: NodePath) => boolean;
    };
  };
  mappings: {
    JSXElement: {
      getRootName(path: NodePath): string;
    };
  };

  // ast-types namedTypes (for find)
  [key: string]: any;
}

function matchesFilter(node: ASTNode, filter: Record<string, any>): boolean {
  for (const key of Object.keys(filter)) {
    const expected = filter[key];
    const actual = node[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if (!actual || typeof actual !== "object") return false;
      if (!matchesFilter(actual, expected)) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

function createJ(): JFunction {
  const jFn = (source: string): Collection => {
    const program = parse(source);
    return new Collection(source, program);
  };

  // ── Core API ──

  (jFn as any).match = (
    pathOrNode: ASTNode | NodePath,
    filter: Record<string, any> | ((node: ASTNode) => boolean),
  ): boolean => {
    const node =
      pathOrNode && typeof (pathOrNode as NodePath).node === "object"
        ? (pathOrNode as NodePath).node
        : (pathOrNode as ASTNode);
    if (typeof filter === "function") return filter(node);
    return matchesFilter(node, filter);
  };

  (jFn as any).use = (_plugin: any): void => {
    // Plugin system — stub for compat
  };

  (jFn as any).withParser = (_parser: any): JFunction => {
    // Parser override — return self (we always use oxc)
    return jFn as JFunction;
  };

  (jFn as any).registerMethods = (_methods: any, _type?: any): void => {
    // Method registration — stub for compat
  };

  (jFn as any).types = namedTypes;

  (jFn as any).template = {
    statement(strings: TemplateStringsArray, ...args: any[]) {
      const src = String.raw({ raw: strings }, ...args);
      const program = parse(src);
      return program.body?.[0] ?? program;
    },
    statements(strings: TemplateStringsArray, ...args: any[]) {
      const src = String.raw({ raw: strings }, ...args);
      const program = parse(src);
      return program.body ?? [];
    },
    expression(strings: TemplateStringsArray, ...args: any[]) {
      const src = String.raw({ raw: strings }, ...args);
      const program = parse(src);
      const stmt = program.body?.[0];
      return stmt?.type === "ExpressionStatement" ? stmt.expression : stmt;
    },
  };

  (jFn as any).filters = {
    JSXElement: {
      hasAttributes(filter: Record<string, any>) {
        return (path: NodePath): boolean => {
          const attrs = path.node.openingElement?.attributes;
          if (!Array.isArray(attrs)) return false;
          return Object.keys(filter).every((name) => {
            const attr = attrs.find((a: any) => a.name?.name === name);
            if (!attr) return false;
            if (filter[name] === true) return true;
            const val = attr.value;
            if (!val) return filter[name] == null;
            if (val.type === "StringLiteral" || val.type === "Literal")
              return val.value === filter[name];
            return true;
          });
        };
      },
      hasChildren(name: string) {
        return (path: NodePath): boolean => {
          const children = path.node.children;
          if (!Array.isArray(children)) return false;
          return children.some((c: any) => {
            if (c.type === "JSXElement") {
              const el = c.openingElement?.name;
              return el?.type === "JSXIdentifier" && el.name === name;
            }
            return false;
          });
        };
      },
    },
    VariableDeclarator: {
      requiresModule(names: string | string[]) {
        const moduleNames = Array.isArray(names) ? names : [names];
        return (path: NodePath): boolean => {
          const init = path.node.init;
          if (!init || init.type !== "CallExpression") return false;
          if (init.callee?.name !== "require") return false;
          const arg = init.arguments?.[0];
          if (!arg) return false;
          const val = arg.value;
          return moduleNames.includes(val);
        };
      },
    },
  };

  (jFn as any).mappings = {
    JSXElement: {
      getRootName(path: NodePath): string {
        const el = path.node.openingElement?.name;
        if (!el) return "";
        if (el.type === "JSXIdentifier") return el.name;
        if (el.type === "JSXMemberExpression") {
          let obj = el.object;
          while (obj?.type === "JSXMemberExpression") obj = obj.object;
          return obj?.type === "JSXIdentifier" ? obj.name : "";
        }
        return "";
      },
    },
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
