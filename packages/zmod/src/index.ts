import { readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { glob } from "tinyglobby";

// jscodeshift-compatible API (oxc-powered)
export { z, type JSCodeshift, type Transform, type ASTNode, type NodePath } from "./jscodeshift.js";
export { Collection, FilteredCollection } from "./collection.js";
export { run, type RunOptions, type RunResult, type TransformModule } from "./run.js";
export type { Parser, ParseOptions } from "./parser.js";
export { oxcParser } from "./oxc-parser-adapter.js";

export interface ImportTransforms {
  /** Import source replacement: { "react-dom/test-utils": "react" } */
  replaceSource?: Record<string, string>;
  /** Import specifier rename: { useFormState: "useActionState" } */
  renameSpecifier?: Record<string, string>;
  /** Import specifier removal: ["act"] */
  removeSpecifier?: string[];
  /** Add new import statements */
  addImport?: Array<{ from: string; names?: string[]; defaultName?: string }>;
}

export interface ReplaceTextRule {
  matchText: string;
  replace: string;
  context?: "import-source" | "string-literal" | "member-expression";
}

export interface TransformOptions {
  /** Batch rename identifiers */
  renames?: Record<string, string>;
  /** Import manipulation */
  imports?: ImportTransforms;
  /** Remove JSX member expression suffixes: ["Provider"] makes <Ctx.Provider> → <Ctx> */
  removeJsxMemberSuffix?: string[];
  /** Text replacement rules (escape hatch) */
  replaceText?: ReplaceTextRule[];
}

export interface TransformResult {
  success: boolean;
  modified: boolean;
  output?: string;
  error?: string;
}

export interface ZmodOptions extends TransformOptions {
  include: string | string[];
}

export interface ZmodResult {
  files: Array<{ path: string } & TransformResult>;
}

// Try to load native NAPI binding
let nativeTransformCode: ((code: string, options: TransformOptions) => TransformResult) | null =
  null;

try {
  const _require = createRequire(import.meta.url ?? __filename);
  const _tryLoad = (name: string) => {
    try {
      return _require(name);
    } catch {
      return null;
    }
  };
  const native =
    _tryLoad("../zmod.darwin-arm64.node") ??
    _tryLoad("../zmod.darwin-x64.node") ??
    _tryLoad("../zmod.linux-x64-gnu.node") ??
    _tryLoad("../zmod.linux-x64-musl.node") ??
    _tryLoad("../zmod.linux-arm64-gnu.node") ??
    _tryLoad("../zmod.win32-x64-msvc.node");
  if (native) nativeTransformCode = native.transformCode;
} catch {
  // Native binding not available, will use JS fallback
}

/**
 * JS fallback: apply renames via regex word-boundary matching.
 * Only handles renames and replaceText (no import/JSX transforms in fallback).
 */
function jsFallback(code: string, options: TransformOptions): TransformResult {
  try {
    let transformed = code;

    // Handle renames
    if (options.renames) {
      for (const [from, to] of Object.entries(options.renames)) {
        const regex = new RegExp(`\\b${from}\\b`, "g");
        transformed = transformed.replace(regex, to);
      }
    }

    // Handle replaceText (simple string replacement)
    if (options.replaceText) {
      for (const rule of options.replaceText) {
        const regex = new RegExp(rule.matchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        transformed = transformed.replace(regex, rule.replace);
      }
    }

    const modified = code !== transformed;
    return {
      success: true,
      modified,
      output: modified ? transformed : undefined,
    };
  } catch (error) {
    return {
      success: false,
      modified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Transform a code string using the configured options.
 * Uses native Rust/oxc binding when available, falls back to JS regex.
 */
export function transform(code: string, options: TransformOptions): TransformResult {
  if (nativeTransformCode) {
    return nativeTransformCode(code, options);
  }
  return jsFallback(code, options);
}

/**
 * Transform a file using the configured options.
 */
export async function transformFile(
  filePath: string,
  options: TransformOptions,
): Promise<TransformResult> {
  try {
    const code = await readFile(filePath, "utf-8");
    const result = transform(code, options);

    if (result.modified && result.output) {
      await writeFile(filePath, result.output, "utf-8");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      modified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Top-level API: glob files and apply transforms across all matches.
 */
export async function zmod(options: ZmodOptions): Promise<ZmodResult> {
  const { include, ...transformOptions } = options;
  const patterns = Array.isArray(include) ? include : [include];
  const files = await glob(patterns);

  const results: ZmodResult["files"] = [];

  for (const file of files) {
    const result = await transformFile(file, transformOptions);
    results.push({ path: file, ...result });
  }

  return { files: results };
}
