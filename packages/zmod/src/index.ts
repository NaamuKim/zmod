import { readFile, writeFile } from "fs/promises";
import { createRequire } from "module";

export interface TransformOptions {
  from: string;
  to: string;
}

export interface TransformResult {
  success: boolean;
  modified: boolean;
  output?: string;
  error?: string;
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
 * Transform a file by renaming identifiers.
 * Uses native Rust/SWC binding when available, falls back to JS regex.
 */
export async function transformFile(
  filePath: string,
  options: TransformOptions,
): Promise<TransformResult> {
  try {
    const code = await readFile(filePath, "utf-8");

    let result: TransformResult;

    if (nativeTransformCode) {
      result = nativeTransformCode(code, options);
    } else {
      const regex = new RegExp(`\\b${options.from}\\b`, "g");
      const transformed = code.replace(regex, options.to);
      const modified = code !== transformed;
      result = {
        success: true,
        modified,
        output: modified ? transformed : undefined,
      };
    }

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
 * Transform code string
 */
export function transform(code: string, options: TransformOptions): TransformResult {
  if (nativeTransformCode) {
    return nativeTransformCode(code, options);
  }

  try {
    const regex = new RegExp(`\\b${options.from}\\b`, "g");
    const transformed = code.replace(regex, options.to);
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
 * Fluent API for chaining transformations
 */
export class CodeMod {
  private files: string[] = [];
  private transforms: TransformOptions[] = [];

  static from(pattern: string): CodeMod {
    const mod = new CodeMod();
    mod.files = [pattern];
    return mod;
  }

  find(from: string): this {
    this.transforms.push({ from, to: "" });
    return this;
  }

  replace(to: string): this {
    if (this.transforms.length > 0) {
      this.transforms[this.transforms.length - 1].to = to;
    }
    return this;
  }

  async execute(): Promise<TransformResult[]> {
    const results: TransformResult[] = [];

    for (const file of this.files) {
      for (const transform of this.transforms) {
        const result = await transformFile(file, transform);
        results.push(result);
      }
    }

    return results;
  }
}
