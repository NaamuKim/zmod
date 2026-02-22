import { readFile, writeFile } from "fs/promises";
import { glob } from "tinyglobby";
import { j, type Transform } from "./jscodeshift.js";

export interface RunOptions {
  /** Glob patterns to match files. */
  include: string | string[];
  /** Working directory for glob patterns. */
  cwd?: string;
  /** Dry run — don't write files. */
  dry?: boolean;
}

export interface RunResult {
  files: Array<{
    path: string;
    status: "modified" | "unchanged" | "error";
    error?: string;
  }>;
}

/**
 * Run a jscodeshift-style transform across files matching glob patterns.
 */
export async function run(transform: Transform, options: RunOptions): Promise<RunResult> {
  const patterns = Array.isArray(options.include) ? options.include : [options.include];
  const files = await glob(patterns, { cwd: options.cwd });

  const results: RunResult["files"] = [];

  for (const filePath of files) {
    try {
      const source = await readFile(filePath, "utf-8");
      const output = transform({ source, path: filePath }, { j, report: console.log });

      if (output != null && output !== source) {
        if (!options.dry) {
          await writeFile(filePath, output, "utf-8");
        }
        results.push({ path: filePath, status: "modified" });
      } else {
        results.push({ path: filePath, status: "unchanged" });
      }
    } catch (error) {
      results.push({
        path: filePath,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { files: results };
}
