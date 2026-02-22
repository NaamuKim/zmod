import type { Transform } from "zmod";

const DEPRECATED_APIS: Record<string, string> = {
  componentWillMount: "UNSAFE_componentWillMount",
  componentWillReceiveProps: "UNSAFE_componentWillReceiveProps",
  componentWillUpdate: "UNSAFE_componentWillUpdate",
};

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  for (const [oldName, newName] of Object.entries(DEPRECATED_APIS)) {
    root.find(j.Identifier, { name: oldName }).forEach((path) => {
      const parent = path.parent;
      if (!parent) return;
      const pt = parent.node.type;

      // Class methods (MethodDefinition), class properties (PropertyDefinition),
      // object properties (Property) — rename the key
      const isKey =
        path.parentKey === "key" &&
        (pt === "MethodDefinition" || pt === "PropertyDefinition" || pt === "Property");

      // Member expressions (this.componentWillMount()) — rename the property
      const isProp = path.parentKey === "property" && pt === "MemberExpression";

      if (isKey || isProp) {
        root.replace(path, newName);
        isDirty = true;
      }
    });
  }

  return isDirty ? root.toSource() : undefined;
};

export default transform;
