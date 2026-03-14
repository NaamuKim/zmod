import { parse } from "@babel/parser";
import type { Parser, Transform } from "zmod";

/**
 * Custom parser using @babel/parser with the `decorators` plugin.
 * oxc (zmod's default parser) supports decorators, but this demonstrates
 * how to plug in any parser when you need specific Babel plugin behavior.
 */
export const parser: Parser = {
  parse(source: string) {
    const file = parse(source, {
      plugins: [["decorators", { version: "legacy" }], "typescript"],
      sourceType: "module",
    });
    return file.program;
  },
};

/**
 * Rename `@injectable()` decorator to `@singleton()`.
 * Matches the Identifier inside decorator call expressions.
 */
const transform: Transform = ({ source }, { z }) => {
  const root = z(source);
  const replaced = new Set<string>();
  let isDirty = false;

  root.find(z.Identifier, { name: "injectable" }).forEach((path) => {
    const key = `${path.node.start}:${path.node.end}`;
    if (replaced.has(key)) return;
    replaced.add(key);
    root.replace(path, "singleton");
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
