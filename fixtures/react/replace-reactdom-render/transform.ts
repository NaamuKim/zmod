import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // 1. Detect react-dom import names
  let renderNamedLocal: string | null = null;
  let reactDomDefault: string | null = null;

  root.find(j.ImportDeclaration, { source: { value: "react-dom" } }).forEach((path) => {
    for (const spec of path.node.specifiers || []) {
      if (spec.type === "ImportSpecifier" && spec.imported?.name === "render") {
        renderNamedLocal = spec.local?.name ?? null;
      }
      if (spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
        reactDomDefault = spec.local?.name ?? null;
      }
    }
  });

  // 2. Find render() calls
  root
    .find(j.CallExpression)
    .filter((path) => {
      const callee = path.node.callee;
      // render(...)
      if (callee.type === "Identifier" && callee.name === renderNamedLocal) return true;
      // ReactDom.render(...)
      if (
        callee.type === "MemberExpression" &&
        callee.object?.name === reactDomDefault &&
        callee.property?.name === "render"
      ) {
        return true;
      }
      return false;
    })
    .forEach((path) => {
      const args = path.node.arguments;
      if (args.length < 2) return;

      // Extract original source text for args
      const element = source.slice(args[0].start, args[0].end);
      const container = source.slice(args[1].start, args[1].end);

      // Replace the parent ExpressionStatement with the two new statements
      const parent = path.parent;
      if (!parent) return;

      const replacement = `const root = createRoot(${container});\nroot.render(${element});`;

      root.replace(parent, replacement);

      isDirty = true;
    });

  // 3. Prepend createRoot import
  if (isDirty) {
    root.insertAt(0, `import { createRoot } from "react-dom/client";\n`);
  }

  return isDirty ? root.toSource() : undefined;
};

export default transform;
