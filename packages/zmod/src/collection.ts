// ── Types ──────────────────────────────────────────────────────────────

export interface ASTNode {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

interface Patch {
  start: number;
  end: number;
  replacement: string;
}

// ── NodePath ──────────────────────────────────────────────────────────

const SCOPE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "Program",
]);

export class NodePath {
  node: ASTNode;
  parent: NodePath | null;
  parentKey: string | null;
  parentIndex: number | null;
  private _root: any; // Collection — typed as any to avoid forward-ref

  constructor(
    node: ASTNode,
    parent: NodePath | null,
    parentKey: string | null,
    parentIndex: number | null,
    root?: any,
  ) {
    this.node = node;
    this.parent = parent;
    this.parentKey = parentKey;
    this.parentIndex = parentIndex;
    this._root = root ?? null;
  }

  // ── Aliases ──

  get value(): ASTNode {
    return this.node;
  }
  get parentPath(): NodePath | null {
    return this.parent;
  }
  get name(): string | null {
    return this.parentKey;
  }

  // ── Scope ──

  get scope(): { node: ASTNode; isGlobal: boolean; path: NodePath } | null {
    let current: NodePath | null = this as NodePath;
    while (current) {
      if (SCOPE_TYPES.has(current.node.type)) {
        return { node: current.node, isGlobal: current.node.type === "Program", path: current };
      }
      current = current.parent;
    }
    return null;
  }

  // ── Path traversal ──

  getValueProperty(name: string): any {
    return this.node[name];
  }

  get(...names: (string | number)[]): any {
    let current: any = this.node;
    for (const n of names) {
      if (current == null) return { value: undefined };
      current = current[n];
    }
    if (current && typeof current === "object" && typeof current.type === "string") {
      const key = names.length > 0 ? String(names[0]) : null;
      const idx =
        names.length > 0 && typeof names[names.length - 1] === "number"
          ? (names[names.length - 1] as number)
          : null;
      return new NodePath(current as ASTNode, this, key, idx, this._root);
    }
    return { value: current };
  }

  // ── Array iteration (Path base class compat) ──

  each(callback: (path: NodePath, index: number) => void, _context?: any): void {
    // Path.each iterates when the value is an array — not applicable for node paths
  }

  map(callback: (path: NodePath, index: number) => any, _context?: any): any[] {
    return [];
  }

  filter(callback: (path: NodePath, index: number) => boolean, _context?: any): any[] {
    return [];
  }

  // ── Array mutation (Path base class compat) ──

  shift(): any {
    return undefined;
  }
  unshift(..._args: any[]): void {}
  push(..._args: any[]): void {}
  pop(): any {
    return undefined;
  }
  insertAt(_index: number, ..._args: any[]): void {}

  // ── Node mutation ──

  insertBefore(...args: any[]): void {
    if (!this._root) return;
    for (const arg of args) {
      const text = typeof arg === "string" ? arg : printNode(arg);
      this._root._addPatch(this.node.start, this.node.start, text);
    }
  }

  insertAfter(...args: any[]): void {
    if (!this._root) return;
    for (const arg of args) {
      const text = typeof arg === "string" ? arg : printNode(arg);
      this._root._addPatch(this.node.end, this.node.end, text);
    }
  }

  replace(...args: any[]): void {
    if (!this._root) return;
    if (args.length === 0) {
      this._root._addPatch(this.node.start, this.node.end, "");
    } else {
      const text = args.map((a: any) => (typeof a === "string" ? a : printNode(a))).join("");
      this._root._addPatch(this.node.start, this.node.end, text);
    }
  }

  prune(): NodePath {
    if (this._root) {
      this._root._addPatch(this.node.start, this.node.end, "");
    }
    return this;
  }

  // ── Statement helpers ──

  needsParens(_assumeExpressionContext?: boolean): boolean {
    const t = this.node.type;
    return t === "ObjectExpression" || t === "FunctionExpression";
  }

  canBeFirstInStatement(): boolean {
    return !this.needsParens();
  }

  firstInStatement(): boolean {
    if (this.parent == null) return false;
    return this.parentKey === "body" && this.parentIndex === 0;
  }
}

// ── AST traversal helpers ──────────────────────────────────────────────

function buildPaths(
  node: ASTNode,
  parent: NodePath | null,
  parentKey: string | null,
  parentIndex: number | null,
  root: any,
): NodePath[] {
  const self = new NodePath(node, parent, parentKey, parentIndex, root);
  const result: NodePath[] = [self];

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const child = val[i];
          if (child && typeof child.type === "string") {
            result.push(...buildPaths(child as ASTNode, self, key, i, root));
          }
        }
      } else if (typeof val.type === "string") {
        result.push(...buildPaths(val as ASTNode, self, key, null, root));
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
    this._patches = [];
    this._paths = buildPaths(program, null, null, null, this);
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

  /** Find VariableDeclarator nodes, optionally filtered by name. */
  findVariableDeclarators(name?: string): FilteredCollection {
    const result = this.find("VariableDeclarator");
    if (name) return result.filter((p) => p.node.id?.name === name);
    return result;
  }

  /** Find JSXElement nodes, optionally filtered by element name. */
  findJSXElements(name?: string): FilteredCollection {
    if (!name) return this.find("JSXElement");
    return this.find("JSXElement").filter((p) => {
      const el = p.node.openingElement?.name;
      if (!el) return false;
      if (el.type === "JSXIdentifier") return el.name === name;
      return false;
    });
  }

  /** Find JSXElements by the module name they were imported from. */
  findJSXElementsByModuleName(moduleName: string): FilteredCollection {
    // Build map: local variable name → imported module source
    const localToModule = new Map<string, string>();
    for (const p of this._paths) {
      if (p.node.type !== "ImportDeclaration") continue;
      const src = p.node.source?.value;
      if (!src) continue;
      for (const spec of p.node.specifiers || []) {
        if (spec.local?.name) localToModule.set(spec.local.name, src);
      }
    }

    return this.find("JSXElement").filter((p) => {
      const el = p.node.openingElement?.name;
      if (!el) return false;
      let rootName: string | null = null;
      if (el.type === "JSXIdentifier") rootName = el.name;
      else if (el.type === "JSXMemberExpression") {
        let obj = el.object;
        while (obj?.type === "JSXMemberExpression") obj = obj.object;
        if (obj?.type === "JSXIdentifier") rootName = obj.name;
      }
      if (!rootName) return false;
      return localToModule.get(rootName) === moduleName;
    });
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
  toSource(_options?: Record<string, any>): string {
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

  /**
   * Get a path by index, or traverse into the first path's node by field names.
   * - get() → first path
   * - get(0) → path at index 0
   * - get("callee") → first path's node.callee
   * - get("callee", "name") → first path's node.callee.name
   */
  get(...fields: (string | number)[]): any {
    if (fields.length === 0) return this._paths[0];
    if (fields.length === 1 && typeof fields[0] === "number") return this._paths[fields[0]];
    let current: any = this._paths[0]?.node;
    for (const f of fields) current = current?.[f];
    return current;
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
      const descendantPaths = buildPaths(
        path.node,
        path.parent,
        path.parentKey,
        path.parentIndex,
        this._root,
      );
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

  /** Find VariableDeclarator nodes, optionally filtered by name. */
  findVariableDeclarators(name?: string): FilteredCollection {
    const result = this.find("VariableDeclarator");
    if (name) return result.filter((p) => p.node.id?.name === name);
    return result;
  }

  /** Find JSXElement nodes, optionally filtered by element name. */
  findJSXElements(name?: string): FilteredCollection {
    if (!name) return this.find("JSXElement");
    return this.find("JSXElement").filter((p) => {
      const el = p.node.openingElement?.name;
      if (!el) return false;
      if (el.type === "JSXIdentifier") return el.name === name;
      return false;
    });
  }

  /** Return all child nodes (JSXElement children) of matched paths. */
  childNodes(): FilteredCollection {
    const results: NodePath[] = [];
    for (const path of this._paths) {
      const children: any[] = path.node.children;
      if (!Array.isArray(children)) continue;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child && typeof child === "object" && child.type) {
          results.push(new NodePath(child, path, "children", i, this._root));
        }
      }
    }
    return new FilteredCollection(this._root, results);
  }

  /** Return only JSXElement children of matched paths. */
  childElements(): FilteredCollection {
    return this.childNodes().filter((p) => p.node.type === "JSXElement");
  }

  /** Traverse up and find the closest ancestor of the given type. */
  closest(
    type: string | { toString(): string; check(node: any): boolean },
    filter?: Record<string, any>,
  ): FilteredCollection {
    const typeName = typeof type === "string" ? type : type.toString();
    const results: NodePath[] = [];
    const seen = new Set<ASTNode>();

    for (const path of this._paths) {
      let current = path.parent;
      while (current) {
        if (current.node.type === typeName) {
          if (!filter || matchesFilter(current.node, filter)) {
            if (!seen.has(current.node)) {
              seen.add(current.node);
              results.push(current);
            }
            break;
          }
        }
        current = current.parent;
      }
    }

    return new FilteredCollection(this._root, results);
  }

  /** Find the closest enclosing scope node (Function or Program). */
  closestScope(): FilteredCollection {
    const results: NodePath[] = [];
    const seen = new Set<ASTNode>();

    for (const path of this._paths) {
      let current = path.parent;
      while (current) {
        if (SCOPE_TYPES.has(current.node.type)) {
          if (!seen.has(current.node)) {
            seen.add(current.node);
            results.push(current);
          }
          break;
        }
        current = current.parent;
      }
    }

    return new FilteredCollection(this._root, results);
  }

  /** Find variable declarators by name extracted via nameGetter callback. */
  getVariableDeclarators(
    nameGetter: (path: NodePath) => string | null | undefined,
  ): FilteredCollection {
    const names = new Set<string>();
    for (const path of this._paths) {
      const name = nameGetter(path);
      if (name) names.add(name);
    }
    if (names.size === 0) return new FilteredCollection(this._root, []);
    return this._root.find("VariableDeclarator").filter((p) => {
      const id = p.node.id;
      return id && names.has(id.name);
    });
  }

  /** Test whether at least one path satisfies the predicate. */
  some(callback: (path: NodePath, index: number) => boolean): boolean {
    return this._paths.some(callback);
  }

  /** Test whether all paths satisfy the predicate. */
  every(callback: (path: NodePath, index: number) => boolean): boolean {
    return this._paths.every(callback);
  }

  /** Return the number of matched paths (same as length). */
  size(): number {
    return this._paths.length;
  }

  /** Return the AST nodes of all matched paths. */
  nodes(): ASTNode[] {
    return this._paths.map((p) => p.node);
  }

  /** Map over matched paths, returning a new FilteredCollection from non-null results. */
  map(callback: (path: NodePath, index: number) => NodePath | null): FilteredCollection {
    const results: NodePath[] = [];
    for (let i = 0; i < this._paths.length; i++) {
      const result = callback(this._paths[i], i);
      if (result != null) results.push(result);
    }
    return new FilteredCollection(this._root, results);
  }

  /** Return the root AST paths. */
  getAST(): NodePath[] {
    return this._root.paths;
  }

  /** Return an array of unique node types in this collection. */
  getTypes(): string[] {
    return [...new Set(this._paths.map((p) => p.node.type))];
  }

  /** Check if all paths in this collection are of the given type. */
  isOfType(type: string): boolean {
    return this._paths.every((p) => p.node.type === type);
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
  toSource(_options?: Record<string, any>): string {
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
