import { parseSync } from "oxc-parser";
import type { Parser, ParseOptions } from "./parser.js";

class OxcParser implements Parser {
  parse(source: string, options?: ParseOptions): any {
    const result = parseSync("file.tsx", source, {
      sourceType: options?.sourceType ?? "module",
    });

    if (result.errors.length > 0) {
      const err = result.errors[0];
      throw new SyntaxError(`Parse error: ${err.message ?? err}`);
    }

    return result.program;
  }
}

export const oxcParser: Parser = new OxcParser();

/** @deprecated Use oxcParser.parse() directly. Kept for backward compat. */
export function parse(source: string, options?: ParseOptions): any {
  return oxcParser.parse(source, options);
}
