/**
 * Options passed to the parser on each parse call.
 * Parsers may support additional options beyond these via index signature.
 */
export interface ParseOptions {
  sourceType?: "module" | "script";
  [key: string]: any; // allow parser-specific options (e.g. babel plugins)
}

/**
 * Interface for pluggable parsers.
 *
 * Any parser implementation must:
 * - Return an ESTree-compatible Program node
 * - Include `start` and `end` numeric byte-offset properties on every node
 *   (required for zmod's span-based patching)
 *
 * ESTree-compatible parsers that satisfy this constraint include:
 * Babel, acorn, oxc (ESTree mode), SWC (ESTree mode)
 */
export interface Parser {
  parse(source: string, options?: ParseOptions): any;
}
