import { readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { glob } from "tinyglobby";

export interface TransformOptions {
  renames: Record<string, string>;
}

export interface TransformResult {
  success: boolean;
  modified: boolean;
  output?: string;
  error?: string;
}

export interface ZmodOptions {
  include: string | string[];
  renames: Record<string, string>;
}

export interface ZmodResult {
  files: Array<{ path: string } & TransformResult>;
}

// Try to load native NAPI binding
let nativeTransformCode: ((code: string, options: TransformOptions) => TransformResult) | null =
  null;

try {
  const require = createRequire(import.meta.url ?? __filename);
  const native = require("../zmod.darwin-arm64.node");
  nativeTransformCode = native.transformCode;
} catch {
  // Native binding not available, will use JS fallback
}

/**
 * Transform a code string by batch-renaming identifiers.
 * Uses native Rust/SWC binding when available, falls back to JS regex.
 */
export function transform(code: string, options: TransformOptions): TransformResult {
  if (nativeTransformCode) {
    return nativeTransformCode(code, options);
  }

  try {
    let transformed = code;
    for (const [from, to] of Object.entries(options.renames)) {
      const regex = new RegExp(`\\b${from}\\b`, "g");
      transformed = transformed.replace(regex, to);
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
 * Transform a file by batch-renaming identifiers.
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
 * Top-level API: glob files and batch-rename identifiers across all matches.
 */
export async function zmod(options: ZmodOptions): Promise<ZmodResult> {
  const patterns = Array.isArray(options.include) ? options.include : [options.include];
  const files = await glob(patterns);

  const results: ZmodResult["files"] = [];

  for (const file of files) {
    const result = await transformFile(file, { renames: options.renames });
    results.push({ path: file, ...result });
  }

  return { files: results };
}
