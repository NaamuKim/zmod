import { parseSync } from "oxc-parser";

export interface ParseOptions {
  sourceType?: "module" | "script";
}

/**
 * Parse source code using oxc-parser and return an ESTree-compatible AST.
 * Nodes have `start` and `end` offset properties (no loc needed for span-based patching).
 */
export function parse(source: string, options?: ParseOptions): any {
  const result = parseSync("file.tsx", source, {
    sourceType: options?.sourceType ?? "module",
  });

  if (result.errors.length > 0) {
    const err = result.errors[0];
    throw new SyntaxError(`Parse error: ${err.message ?? err}`);
  }

  return result.program;
}
