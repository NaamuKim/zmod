import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  root.find(j.Identifier, { name: "unstable_handleError" }).forEach((path) => {
    const parent = path.parent;
    if (!parent) return;
    const pt = parent.node.type;
    // Only rename in method/property keys or member expression properties
    if (
      (path.parentKey === "key" && (pt === "MethodDefinition" || pt === "Property")) ||
      (path.parentKey === "property" && pt === "MemberExpression")
    ) {
      root.replace(path, "componentDidCatch");
      isDirty = true;
    }
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
