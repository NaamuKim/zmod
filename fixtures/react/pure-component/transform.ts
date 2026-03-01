import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  root.find(j.ClassDeclaration).forEach((path) => {
    const sc = path.node.superClass;
    if (!sc) return;

    // Check if extends React.Component or Component
    const isReactComponent =
      (sc.type === "MemberExpression" &&
        sc.object?.name === "React" &&
        sc.property?.name === "Component") ||
      (sc.type === "Identifier" && sc.name === "Component");

    if (!isReactComponent) return;

    // Check if class only has a render method (simple component)
    const body = path.node.body?.body;
    if (!body) return;

    const methods = body.filter(
      (m: any) => m.type === "MethodDefinition" || m.type === "PropertyDefinition",
    );

    const isSimple =
      methods.length === 1 &&
      methods[0].type === "MethodDefinition" &&
      methods[0].key?.name === "render";

    if (!isSimple) return;

    // Replace "Component" with "PureComponent" in the superClass
    if (sc.type === "MemberExpression") {
      root._addPatch(sc.property.start, sc.property.end, "PureComponent");
    } else {
      root._addPatch(sc.start, sc.end, "PureComponent");
    }
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
