// ── Types ──────────────────────────────────────────────────────────────

export interface ASTNode {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

export interface NodePath {
  node: ASTNode;
  parent: NodePath | null;
  parentKey: string | null;
  parentIndex: number | null;
}

interface Patch {
  start: number;
  end: number;
  replacement: string;
}

// ── AST traversal helpers ──────────────────────────────────────────────

function buildPaths(
  node: ASTNode,
  parent: NodePath | null,
  parentKey: string | null,
  parentIndex: number | null,
): NodePath[] {
  const self: NodePath = { node, parent, parentKey, parentIndex };
  const result: NodePath[] = [self];

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const child = val[i];
          if (child && typeof child.type === "string") {
            result.push(...buildPaths(child as ASTNode, self, key, i));
          }
        }
      } else if (typeof val.type === "string") {
        result.push(...buildPaths(val as ASTNode, self, key, null));
      }
    }
  }

  return result;
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

/**
 * Serialize an AST node back to source code.
 * This is used when a node is created via builders (no original source span).
 */
function printNode(node: any): string {
  if (!node || typeof node !== "object") return String(node ?? "");

  switch (node.type) {
    case "Identifier":
      return node.name;

    case "Literal":
    case "StringLiteral":
      return node.raw ?? JSON.stringify(node.value);

    case "NumericLiteral":
      return node.raw ?? String(node.value);

    case "BooleanLiteral":
      return String(node.value);

    case "NullLiteral":
      return "null";

    case "ThisExpression":
      return "this";

    case "TemplateLiteral": {
      let s = "`";
      for (let i = 0; i < node.quasis.length; i++) {
        s += node.quasis[i].value?.raw ?? node.quasis[i].raw ?? "";
        if (i < node.expressions.length) {
          s += "${" + printNode(node.expressions[i]) + "}";
        }
      }
      return s + "`";
    }

    case "MemberExpression": {
      const obj = printNode(node.object);
      if (node.computed) return `${obj}[${printNode(node.property)}]`;
      return `${obj}.${printNode(node.property)}`;
    }

    case "CallExpression":
    case "OptionalCallExpression": {
      const callee = printNode(node.callee);
      const args = (node.arguments || []).map(printNode).join(", ");
      const opt = node.type === "OptionalCallExpression" ? "?." : "";
      return `${callee}${opt}(${args})`;
    }

    case "ArrowFunctionExpression": {
      const params = (node.params || []).map(printNode).join(", ");
      const body = printNode(node.body);
      const async = node.async ? "async " : "";
      return `${async}(${params}) => ${body}`;
    }

    case "FunctionExpression": {
      const name = node.id ? printNode(node.id) : "";
      const params = (node.params || []).map(printNode).join(", ");
      const body = printNode(node.body);
      const async = node.async ? "async " : "";
      const gen = node.generator ? "*" : "";
      return `${async}function${gen} ${name}(${params}) ${body}`;
    }

    case "BlockStatement": {
      const stmts = (node.body || []).map(printNode).join("\n");
      return `{\n${stmts}\n}`;
    }

    case "ReturnStatement":
      return node.argument ? `return ${printNode(node.argument)};` : "return;";

    case "ExpressionStatement":
      return printNode(node.expression) + ";";

    case "VariableDeclaration": {
      const decls = (node.declarations || []).map(printNode).join(", ");
      return `${node.kind} ${decls};`;
    }

    case "VariableDeclarator": {
      const id = printNode(node.id);
      return node.init ? `${id} = ${printNode(node.init)}` : id;
    }

    case "AssignmentExpression":
      return `${printNode(node.left)} ${node.operator} ${printNode(node.right)}`;

    case "BinaryExpression":
    case "LogicalExpression":
      return `${printNode(node.left)} ${node.operator} ${printNode(node.right)}`;

    case "UnaryExpression":
      return node.prefix
        ? `${node.operator}${printNode(node.argument)}`
        : `${printNode(node.argument)}${node.operator}`;

    case "ConditionalExpression":
      return `${printNode(node.test)} ? ${printNode(node.consequent)} : ${printNode(node.alternate)}`;

    case "ObjectExpression": {
      const props = (node.properties || []).map(printNode).join(", ");
      return `{ ${props} }`;
    }

    case "Property": {
      const key = printNode(node.key);
      const val = printNode(node.value);
      if (node.shorthand) return key;
      if (node.method) return `${key}${val.replace(/^function\s*/, "")}`;
      return `${key}: ${val}`;
    }

    case "ArrayExpression": {
      const elts = (node.elements || []).map((e: any) => (e ? printNode(e) : "")).join(", ");
      return `[${elts}]`;
    }

    case "SpreadElement":
      return `...${printNode(node.argument)}`;

    case "RestElement":
      return `...${printNode(node.argument)}`;

    case "ImportDeclaration": {
      const specs = (node.specifiers || []).map(printNode);
      const src = printNode(node.source);
      if (specs.length === 0) return `import ${src};`;
      const defaultSpec = specs.find(
        (_: any, i: number) => node.specifiers[i].type === "ImportDefaultSpecifier",
      );
      const namedSpecs = node.specifiers
        .filter((s: any) => s.type === "ImportSpecifier")
        .map(printNode);
      const parts: string[] = [];
      if (defaultSpec) parts.push(defaultSpec);
      if (namedSpecs.length > 0) parts.push(`{ ${namedSpecs.join(", ")} }`);
      return `import ${parts.join(", ")} from ${src};`;
    }

    case "ImportDefaultSpecifier":
      return printNode(node.local);

    case "ImportSpecifier": {
      const imported = printNode(node.imported);
      const local = printNode(node.local);
      return imported === local ? imported : `${imported} as ${local}`;
    }

    case "JSXElement": {
      const open = printNode(node.openingElement);
      if (node.selfClosing || node.openingElement?.selfClosing) return open;
      const children = (node.children || []).map(printNode).join("");
      const close = printNode(node.closingElement);
      return `${open}${children}${close}`;
    }

    case "JSXOpeningElement": {
      const name = printNode(node.name);
      const attrs = (node.attributes || []).map(printNode).join(" ");
      const attrStr = attrs ? ` ${attrs}` : "";
      return node.selfClosing ? `<${name}${attrStr} />` : `<${name}${attrStr}>`;
    }

    case "JSXClosingElement":
      return `</${printNode(node.name)}>`;

    case "JSXIdentifier":
      return node.name;

    case "JSXMemberExpression":
      return `${printNode(node.object)}.${printNode(node.property)}`;

    case "JSXAttribute": {
      const name = printNode(node.name);
      if (!node.value) return name;
      return `${name}=${printNode(node.value)}`;
    }

    case "JSXExpressionContainer":
      return `{${printNode(node.expression)}}`;

    case "JSXText":
      return node.value ?? node.raw ?? "";

    case "JSXNamespacedName":
      return `${printNode(node.namespace)}:${printNode(node.name)}`;

    default:
      // Fallback: if node has start/end (original source node), this shouldn't
      // be reached during printing of builder-created nodes.
      // For unhandled types, try to reconstruct from children
      return `/* unhandled: ${node.type} */`;
  }
}

// ── Collection ─────────────────────────────────────────────────────────

export class Collection {
  private _source: string;
  private _program: ASTNode;
  private _paths: NodePath[];
  private _patches: Patch[];

  constructor(source: string, program: ASTNode) {
    this._source = source;
    this._program = program;
    this._paths = buildPaths(program, null, null, null);
    this._patches = [];
  }

  /**
   * Find all nodes of a given type, with optional filter.
   * `type` can be a string or a namedTypes type checker (e.g. namedTypes.CallExpression).
   */
  find(
    type: string | { toString(): string; check(node: any): boolean },
    filter?: Record<string, any>,
  ): FilteredCollection {
    const typeName = typeof type === "string" ? type : type.toString();

    const matched = this._paths.filter((p) => {
      if (p.node.type !== typeName) return false;
      if (filter && !matchesFilter(p.node, filter)) return false;
      return true;
    });

    return new FilteredCollection(this, matched);
  }

  /** Get the root program paths. */
  get paths(): NodePath[] {
    return this._paths;
  }

  get source(): string {
    return this._source;
  }

  get program(): ASTNode {
    return this._program;
  }

  /** Register a span replacement. */
  _addPatch(start: number, end: number, replacement: string): void {
    this._patches.push({ start, end, replacement });
  }

  /**
   * Replace a single node's span with a new AST node or string.
   * Use this inside forEach() when you need conditional per-path replacement.
   */
  replace(path: NodePath, replacement: ASTNode | string): void {
    const text = typeof replacement === "string" ? replacement : this._nodeToSource(replacement);
    this._addPatch(path.node.start, path.node.end, text);
  }

  /**
   * Insert text at a specific offset in the source.
   * Useful for prepending imports at position 0.
   */
  insertAt(offset: number, text: string): void {
    this._addPatch(offset, offset, text);
  }

  /**
   * Insert text/node after a specific path's span.
   */
  insertAfter(path: NodePath, content: ASTNode | string): void {
    const text = typeof content === "string" ? content : this._nodeToSource(content);
    this._addPatch(path.node.end, path.node.end, text);
  }

  private _nodeToSource(node: ASTNode): string {
    if (
      typeof node.start === "number" &&
      typeof node.end === "number" &&
      node.start >= 0 &&
      node.end <= this._source.length &&
      node.end > node.start
    ) {
      return this._source.slice(node.start, node.end);
    }
    return printNode(node);
  }

  /**
   * Apply all patches and return the modified source code.
   */
  toSource(): string {
    if (this._patches.length === 0) return this._source;

    // Sort patches by start offset descending so we can apply from end to start.
    // For same start, sort by end descending (wider patches first) so insertions
    // (start===end) at the same offset are applied in FIFO order.
    const sorted = [...this._patches].sort((a, b) => b.start - a.start || b.end - a.end);

    // Validate no overlapping non-insertion patches
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]; // higher start
      const curr = sorted[i]; // lower start
      // curr.end > prev.start means curr's range bleeds into prev's range
      if (curr.start !== curr.end && prev.start !== prev.end && curr.end > prev.start) {
        throw new Error(
          `Overlapping patches: [${curr.start},${curr.end}) and [${prev.start},${prev.end}). ` +
            `Avoid modifying both a parent and child node in the same transform.`,
        );
      }
    }

    let result = this._source;
    for (const patch of sorted) {
      result = result.slice(0, patch.start) + patch.replacement + result.slice(patch.end);
    }

    return result;
  }
}

export class FilteredCollection {
  private _root: Collection;
  private _paths: NodePath[];

  constructor(root: Collection, paths: NodePath[]) {
    this._root = root;
    this._paths = paths;
  }

  /** Number of matched paths. */
  get length(): number {
    return this._paths.length;
  }

  /** Get matched paths. */
  get paths(): NodePath[] {
    return this._paths;
  }

  /** Iterate over matched paths. */
  forEach(callback: (path: NodePath, index: number) => void): this {
    this._paths.forEach(callback);
    return this;
  }

  /** Filter matched paths further. */
  filter(predicate: (path: NodePath) => boolean): FilteredCollection {
    return new FilteredCollection(this._root, this._paths.filter(predicate));
  }

  /** Get a single path by index. */
  at(index: number): NodePath | undefined {
    return this._paths[index];
  }

  /** Get the first matched path, or undefined. */
  get(index: number = 0): NodePath | undefined {
    return this._paths[index];
  }

  /**
   * Find descendants of matched nodes.
   */
  find(
    type: string | { toString(): string; check(node: any): boolean },
    filter?: Record<string, any>,
  ): FilteredCollection {
    const typeName = typeof type === "string" ? type : type.toString();
    const results: NodePath[] = [];

    for (const path of this._paths) {
      const descendantPaths = buildPaths(path.node, path.parent, path.parentKey, path.parentIndex);
      // skip the first one (self)
      for (let i = 1; i < descendantPaths.length; i++) {
        const dp = descendantPaths[i];
        if (dp.node.type !== typeName) continue;
        if (filter && !matchesFilter(dp.node, filter)) continue;
        results.push(dp);
      }
    }

    return new FilteredCollection(this._root, results);
  }

  /**
   * Replace each matched node with a new node or the result of a callback.
   * The replacement can be:
   * - An AST node (builder-created or parsed)
   * - A callback (path) => node
   */
  replaceWith(replacementOrFn: ASTNode | ((path: NodePath) => ASTNode)): this {
    for (const path of this._paths) {
      const replacement =
        typeof replacementOrFn === "function" ? replacementOrFn(path) : replacementOrFn;
      const text = this._nodeToSource(replacement);
      this._root._addPatch(path.node.start, path.node.end, text);
    }
    return this;
  }

  /**
   * Remove each matched node from the source.
   * Tries to remove the entire statement if the node is a direct child of a body array.
   */
  remove(): this {
    for (const path of this._paths) {
      const { start, end } = this._removalSpan(path);
      this._root._addPatch(start, end, "");
    }
    return this;
  }

  /**
   * Insert source text before each matched node.
   */
  insertBefore(nodeOrSource: ASTNode | string): this {
    for (const path of this._paths) {
      const text =
        typeof nodeOrSource === "string" ? nodeOrSource : this._nodeToSource(nodeOrSource);
      this._root._addPatch(path.node.start, path.node.start, text);
    }
    return this;
  }

  /**
   * Insert source text after each matched node.
   */
  insertAfter(nodeOrSource: ASTNode | string): this {
    for (const path of this._paths) {
      const text =
        typeof nodeOrSource === "string" ? nodeOrSource : this._nodeToSource(nodeOrSource);
      this._root._addPatch(path.node.end, path.node.end, text);
    }
    return this;
  }

  /**
   * Rename all identifiers within matched nodes.
   */
  renameTo(newName: string): this {
    // Find all Identifier/BindingIdentifier nodes within matched paths and rename
    for (const path of this._paths) {
      if (path.node.type === "Identifier") {
        this._root._addPatch(path.node.start, path.node.end, newName);
      }
    }
    return this;
  }

  /** Convert the full modified source to string. */
  toSource(): string {
    return this._root.toSource();
  }

  private _nodeToSource(node: ASTNode): string {
    // If the node has start/end from the original source, use the original text
    if (
      typeof node.start === "number" &&
      typeof node.end === "number" &&
      node.start >= 0 &&
      node.end <= this._root.source.length &&
      node.end > node.start
    ) {
      return this._root.source.slice(node.start, node.end);
    }
    // Otherwise, print the node
    return printNode(node);
  }

  /**
   * Calculate the span to remove for a node, cleaning up surrounding whitespace/newlines.
   */
  private _removalSpan(path: NodePath): { start: number; end: number } {
    const src = this._root.source;
    let { start, end } = path.node;

    // If this is a statement in a body array, remove trailing newline too
    if (path.parent && path.parentKey === "body" && path.parentIndex !== null) {
      // Extend to consume the trailing newline
      while (end < src.length && (src[end] === " " || src[end] === "\t")) end++;
      if (end < src.length && src[end] === "\n") end++;
      // If statement ends with semicolon that's part of the statement span, it's already included
    }

    return { start, end };
  }
}
