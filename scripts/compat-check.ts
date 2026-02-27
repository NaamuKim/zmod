import { Project, type InterfaceDeclaration, type ClassDeclaration } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// ── Config ────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const JSCS_TYPES = path.join(ROOT, "node_modules/@types/jscodeshift/src");
// ast-types is a transitive dep of @types/jscodeshift — resolve via realpath to follow pnpm symlinks
// realpath gives .../node_modules/@types/jscodeshift, go up 2 to reach .../node_modules/
const AST_TYPES_LIB = path.join(
  fs.realpathSync(path.join(ROOT, "node_modules/@types/jscodeshift")),
  "../..",
  "ast-types",
  "lib",
);
const ZMOD_SRC = path.join(ROOT, "packages/zmod/src");

// ── Types ─────────────────────────────────────────────────────────────

interface APIEntry {
  category: string;
  name: string;
  displayName: string;
  status: "supported" | "not-supported" | "partial";
  note?: string;
}

// category:name → note for known partial implementations
const PARTIAL_OVERRIDES: Record<string, string> = {};

// ── ts-morph setup ────────────────────────────────────────────────────

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});

for (const f of [
  path.join(JSCS_TYPES, "core.d.ts"),
  path.join(JSCS_TYPES, "Collection.d.ts"),
  path.join(JSCS_TYPES, "collections/Node.d.ts"),
  path.join(JSCS_TYPES, "collections/JSXElement.d.ts"),
  path.join(JSCS_TYPES, "collections/VariableDeclarator.d.ts"),
  path.join(AST_TYPES_LIB, "node-path.d.ts"),
  path.join(AST_TYPES_LIB, "path.d.ts"),
  path.join(ZMOD_SRC, "collection.ts"),
  path.join(ZMOD_SRC, "jscodeshift.ts"),
]) {
  project.addSourceFileAtPath(f);
}

// ── Helpers ───────────────────────────────────────────────────────────

function resolveInterface(filePath: string, name: string): InterfaceDeclaration {
  const sf = project.getSourceFileOrThrow(filePath);
  for (const mod of sf.getModules()) {
    const iface = mod.getInterface(name);
    if (iface) return iface;
  }
  const iface = sf.getInterface(name);
  if (!iface) throw new Error(`Interface "${name}" not found in ${filePath}`);
  return iface;
}

function resolveClass(filePath: string, name: string): ClassDeclaration {
  const sf = project.getSourceFileOrThrow(filePath);
  const cls = sf.getClass(name);
  if (!cls) throw new Error(`Class "${name}" not found in ${filePath}`);
  return cls;
}

/** Extract public methods and properties from a TypeScript interface declaration. */
function extractInterfaceAPI(
  iface: InterfaceDeclaration,
  category: string,
): Array<{ category: string; name: string; displayName: string }> {
  const result: Array<{ category: string; name: string; displayName: string }> = [];
  const seen = new Set<string>();

  for (const m of iface.getMethods()) {
    const name = m.getName();
    if (name.startsWith("_") || seen.has(name)) continue;
    seen.add(name);
    const params = m.getParameters().map((p) => {
      const pName = p.getName();
      if (p.isRestParameter()) return `...${pName}`;
      return p.isOptional() ? `${pName}?` : pName;
    });
    result.push({ category, name, displayName: `${name}(${params.join(", ")})` });
  }

  for (const p of iface.getProperties()) {
    const name = p.getName();
    if (name.startsWith("_") || seen.has(name)) continue;
    seen.add(name);
    result.push({ category, name, displayName: name });
  }

  return result;
}

/** Extract public member names from a TypeScript class. */
function extractClassMemberNames(cls: ClassDeclaration): Set<string> {
  const names = new Set<string>();
  for (const m of cls.getMethods()) {
    if (!m.getName().startsWith("_")) names.add(m.getName());
  }
  for (const p of cls.getProperties()) {
    if (!p.getName().startsWith("_")) names.add(p.getName());
  }
  for (const g of cls.getGetAccessors()) {
    if (!g.getName().startsWith("_")) names.add(g.getName());
  }
  return names;
}

/** Extract property/method names from a TypeScript interface. */
function extractInterfaceNames(iface: InterfaceDeclaration): Set<string> {
  const names = new Set<string>();
  for (const m of iface.getMethods()) {
    if (!m.getName().startsWith("_")) names.add(m.getName());
  }
  for (const p of iface.getProperties()) {
    if (!p.getName().startsWith("_")) names.add(p.getName());
  }
  return names;
}

// ── Extract jscodeshift full API (from type definitions) ──────────────

const jscsAPI: Array<{ category: string; name: string; displayName: string }> = [];
const dedup = new Set<string>();

function addEntries(entries: Array<{ category: string; name: string; displayName: string }>) {
  for (const e of entries) {
    const key = `${e.category}:${e.name}`;
    if (!dedup.has(key)) {
      dedup.add(key);
      jscsAPI.push(e);
    }
  }
}

// Core — call signature + namedTypes/builders (dynamic) + Core interface members
addEntries([
  { category: "Core", name: "j(source)", displayName: "j(source)" },
  { category: "Core", name: "namedTypes", displayName: "namedTypes (j.Identifier etc)" },
  { category: "Core", name: "builders", displayName: "builders (j.identifier() etc)" },
]);
addEntries(
  extractInterfaceAPI(resolveInterface(path.join(JSCS_TYPES, "core.d.ts"), "Core"), "Core"),
);

// Collection (own members from Collection<N> interface)
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "Collection.d.ts"), "Collection"),
    "Collection",
  ),
);

// Traversal (Node.TraversalMethods — mixed into Collection via extends)
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "collections/Node.d.ts"), "TraversalMethods"),
    "Traversal",
  ),
);

// Mutation (Node.MutationMethods — mixed into Collection via extends)
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "collections/Node.d.ts"), "MutationMethods"),
    "Mutation",
  ),
);

// JSX (JSXElement.GlobalMethods + TraversalMethods)
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "collections/JSXElement.d.ts"), "GlobalMethods"),
    "JSX",
  ),
);
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "collections/JSXElement.d.ts"), "TraversalMethods"),
    "JSX",
  ),
);

// VariableDeclarator (GlobalMethods + TransformMethods)
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(JSCS_TYPES, "collections/VariableDeclarator.d.ts"), "GlobalMethods"),
    "VariableDeclarator",
  ),
);
addEntries(
  extractInterfaceAPI(
    resolveInterface(
      path.join(JSCS_TYPES, "collections/VariableDeclarator.d.ts"),
      "TransformMethods",
    ),
    "VariableDeclarator",
  ),
);

// NodePath (ast-types Path base first for method sigs, then NodePath for unique members)
addEntries(
  extractInterfaceAPI(resolveInterface(path.join(AST_TYPES_LIB, "path.d.ts"), "Path"), "NodePath"),
);
addEntries(
  extractInterfaceAPI(
    resolveInterface(path.join(AST_TYPES_LIB, "node-path.d.ts"), "NodePath"),
    "NodePath",
  ),
);

// ── Extract zmod implementation (from source code) ────────────────────

// Core: j(source) call + namedTypes/builders dynamically attached in createJ()
const zmodCoreAPI = new Set(["j(source)", "namedTypes", "builders"]);

// Collection: merge Collection + FilteredCollection public members
const zmodCollectionAPI = new Set([
  ...extractClassMemberNames(resolveClass(path.join(ZMOD_SRC, "collection.ts"), "Collection")),
  ...extractClassMemberNames(
    resolveClass(path.join(ZMOD_SRC, "collection.ts"), "FilteredCollection"),
  ),
]);

// NodePath: from NodePath interface
const zmodNodePathAPI = extractInterfaceNames(
  resolveInterface(path.join(ZMOD_SRC, "collection.ts"), "NodePath"),
);

// ── Compare ───────────────────────────────────────────────────────────

function getZmodSet(category: string): Set<string> {
  if (category === "Core") return zmodCoreAPI;
  if (category === "NodePath") return zmodNodePathAPI;
  return zmodCollectionAPI; // Collection, Traversal, Mutation, JSX, VariableDeclarator
}

const entries: APIEntry[] = jscsAPI.map(({ category, name, displayName }) => {
  const key = `${category}:${name}`;
  if (PARTIAL_OVERRIDES[key]) {
    return {
      category,
      name,
      displayName,
      status: "partial" as const,
      note: PARTIAL_OVERRIDES[key],
    };
  }
  const supported = getZmodSet(category).has(name);
  return {
    category,
    name,
    displayName,
    status: supported ? ("supported" as const) : ("not-supported" as const),
  };
});

// ── Report generation ─────────────────────────────────────────────────

function computeSummary(items: APIEntry[]) {
  const total = items.length;
  const supported = items.filter((e) => e.status === "supported").length;
  const partial = items.filter((e) => e.status === "partial").length;
  const notSupported = items.filter((e) => e.status === "not-supported").length;
  const percent = ((supported + partial * 0.5) / total) * 100;
  return { total, supported, partial, notSupported, percent };
}

function groupByCategory(items: APIEntry[]): Map<string, APIEntry[]> {
  const map = new Map<string, APIEntry[]>();
  for (const e of items) {
    const list = map.get(e.category) ?? [];
    list.push(e);
    map.set(e.category, list);
  }
  return map;
}

function statusIcon(status: APIEntry["status"]): string {
  return status === "supported" ? "✅" : status === "partial" ? "🔶" : "❌";
}

function generateMarkdown(): string {
  const summary = computeSummary(entries);
  const categories = groupByCategory(entries);

  const lines: string[] = [];
  lines.push("# jscodeshift API Compatibility Report");
  lines.push("");
  lines.push(
    `Overall: ${summary.supported + summary.partial}/${summary.total} (${summary.percent.toFixed(1)}%)`,
  );
  lines.push(
    `- supported: ${summary.supported}, partial: ${summary.partial}, not-supported: ${summary.notSupported}`,
  );

  for (const [cat, items] of categories) {
    const s = computeSummary(items);
    lines.push("");
    lines.push(`## ${cat} (${s.supported + s.partial}/${s.total})`);
    lines.push("");
    lines.push("| API | Status | Note |");
    lines.push("|-----|--------|------|");
    for (const item of items) {
      lines.push(
        `| ${item.displayName} | ${statusIcon(item.status)} ${item.status} | ${item.note ?? ""} |`,
      );
    }
  }

  return lines.join("\n");
}

function generateJSON() {
  const summary = computeSummary(entries);
  const categories = groupByCategory(entries);

  return {
    summary: {
      total: summary.total,
      supported: summary.supported,
      partial: summary.partial,
      notSupported: summary.notSupported,
      percent: Number(summary.percent.toFixed(1)),
    },
    categories: Array.from(categories.entries()).map(([name, items]) => ({
      name,
      ...computeSummary(items),
      apis: items,
    })),
    markdown: generateMarkdown(),
  };
}

function generateBadge(): string {
  const { percent } = computeSummary(entries);
  const pct = percent.toFixed(1);
  const color = percent >= 80 ? "brightgreen" : percent >= 50 ? "yellow" : "red";
  return `https://img.shields.io/badge/jscodeshift_compat-${encodeURIComponent(pct)}%25-${color}`;
}

// ── CLI ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--json")) {
  console.log(JSON.stringify(generateJSON(), null, 2));
} else if (args.includes("--badge")) {
  console.log(generateBadge());
} else {
  console.log(generateMarkdown());
}
