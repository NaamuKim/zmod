import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  root.find(j.ImportDeclaration, { source: { value: "react" } }).forEach((path) => {
    const specifiers = path.node.specifiers || [];
    const defaultSpec = specifiers.find(
      (s: any) => s.type === "ImportDefaultSpecifier" || s.type === "ImportNamespaceSpecifier",
    );
    if (!defaultSpec) return;

    const defaultName = defaultSpec.local?.name;
    if (!defaultName) return;

    // Check if the default import is actually used (beyond JSX which auto-imports)
    const usages = root.find(j.Identifier, { name: defaultName }).filter((p) => {
      // Exclude the import specifier itself
      if (p.parent?.node.type === "ImportDefaultSpecifier") return false;
      if (p.parent?.node.type === "ImportNamespaceSpecifier") return false;
      return true;
    });

    if (usages.length > 0) return; // React is still used explicitly

    const namedSpecs = specifiers.filter((s: any) => s.type === "ImportSpecifier");

    if (namedSpecs.length === 0) {
      // No named imports — remove the entire import
      root._addPatch(path.node.start, path.node.end, "");
    } else {
      // Has named imports — remove just the default specifier
      // Rebuild: import { useState, useEffect } from "react";
      const names = namedSpecs.map((s: any) => {
        const imported = s.imported?.name;
        const local = s.local?.name;
        return imported === local ? imported : `${imported} as ${local}`;
      });
      const src = path.node.source;
      const quote = source[src.start]; // preserve original quote
      root._addPatch(
        path.node.start,
        path.node.end,
        `import { ${names.join(", ")} } from ${quote}react${quote};`,
      );
    }

    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
