import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find JSXMemberExpression nodes like <Ctx.Provider>
  root.find("JSXMemberExpression", { property: { name: "Provider" } }).forEach((path) => {
    const objectName: string = path.node.object?.name ?? "";
    if (objectName.toLowerCase().includes("context")) {
      // Replace <Ctx.Provider> with <Ctx>
      root.replace(path, source.slice(path.node.object.start, path.node.object.end));
      isDirty = true;
    }
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
