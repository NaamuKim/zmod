import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find import from "react-dom/test-utils" and change source to "react"
  root.find(j.ImportDeclaration, { source: { value: "react-dom/test-utils" } }).forEach((path) => {
    // Replace the import source string (excluding quotes)
    const srcNode = path.node.source;
    root.replace(
      { node: srcNode, parent: path, parentKey: "source", parentIndex: null },
      `"react"`,
    );
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
