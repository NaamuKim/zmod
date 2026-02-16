/**
 * Benchmark: zmod vs jscodeshift — rename-unsafe-lifecycles
 *
 * Uses vitest bench (tinybench) for statistically rigorous measurement.
 * Each task transforms 500 in-memory TSX files.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { bench, describe, beforeAll } from "vitest";
import { parseSync, Visitor } from "oxc-parser";

// ── Fixtures ───────────────────────────────────────────────────────
const DIR = join(import.meta.dirname, "fixtures");
let sources: string[] = [];

beforeAll(() => {
  if (!existsSync(DIR)) {
    throw new Error('Fixtures not generated. Run "pnpm generate" first.');
  }
  sources = readdirSync(DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(DIR, f), "utf-8"));
});

// ── Renames config ─────────────────────────────────────────────────
const renames: Record<string, string> = {
  componentWillMount: "UNSAFE_componentWillMount",
  componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
  componentWillUpdate: "UNSAFE_componentWillUpdate",
};

// ── zmod native (oxc) ──────────────────────────────────────────────
const require = createRequire(import.meta.url);
let nativeTransformCode: (
  code: string,
  opts: { renames: Record<string, string> },
) => { success: boolean; modified: boolean; output?: string };

try {
  const native = require("../packages/zmod/zmod.darwin-arm64.node");
  nativeTransformCode = native.transformCode;
} catch {
  // skip native benchmarks if binding unavailable
}

// ── jscodeshift ────────────────────────────────────────────────────
const jscodeshift = require("jscodeshift");
const j = jscodeshift.withParser("tsx");

function jscodeshiftTransform(source: string): string | null {
  const root = j(source);
  let modified = false;

  const renameApis = (path: any) => {
    if (renames[path.node.key.name]) {
      path.value.key.name = renames[path.node.key.name];
      modified = true;
    }
  };
  const renameCallExprs = (path: any) => {
    if (path.node.property?.name && renames[path.node.property.name]) {
      path.node.property.name = renames[path.node.property.name];
      modified = true;
    }
  };

  root.find(j.MethodDefinition).forEach(renameApis);
  root.find(j.ClassMethod).forEach(renameApis);
  root.find(j.ClassProperty).forEach(renameApis);
  root.find(j.Property).forEach(renameApis);
  root.find(j.MemberExpression).forEach(renameCallExprs);

  return modified ? root.toSource() : null;
}

// ── oxc-parser (NAPI parse + JS visitor + string patch) ────────────
function oxcTransform(source: string): string {
  const result = parseSync("file.tsx", source);
  const patches: Array<{ start: number; end: number; text: string }> = [];

  const visitor = new Visitor({
    Identifier(node: any) {
      if (renames[node.name]) {
        patches.push({ start: node.start, end: node.end, text: renames[node.name] });
      }
    },
  });
  visitor.visit(result.program);

  if (patches.length === 0) return source;

  patches.sort((a, b) => b.start - a.start);
  let output = source;
  for (const p of patches) {
    output = output.slice(0, p.start) + p.text + output.slice(p.end);
  }
  return output;
}

// ── Benchmarks ─────────────────────────────────────────────────────
describe("rename-unsafe-lifecycles (500 files)", () => {
  if (nativeTransformCode) {
    bench("zmod (native oxc)", () => {
      for (const source of sources) {
        nativeTransformCode(source, { renames });
      }
    });
  }

  bench("oxc-parser (NAPI + JS visitor)", () => {
    for (const source of sources) {
      oxcTransform(source);
    }
  });

  bench("zmod (JS regex fallback)", () => {
    for (const source of sources) {
      let result = source;
      for (const [from, to] of Object.entries(renames)) {
        result = result.replace(new RegExp(`\\b${from}\\b`, "g"), to);
      }
    }
  });

  bench("jscodeshift", () => {
    for (const source of sources) {
      jscodeshiftTransform(source);
    }
  });
});
