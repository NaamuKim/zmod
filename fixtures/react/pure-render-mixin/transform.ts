import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find createClass calls with PureRenderMixin
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "createClass" },
      },
    })
    .forEach((callPath) => {
      const arg = callPath.node.arguments?.[0];
      if (!arg || arg.type !== "ObjectExpression") return;

      const properties = arg.properties || [];

      // Find mixins property
      const mixinsProp = properties.find(
        (p: any) => p.key?.name === "mixins" || p.key?.value === "mixins",
      );
      if (!mixinsProp) return;

      // Check if mixins array contains PureRenderMixin
      const mixinsArray = mixinsProp.value?.elements;
      if (!Array.isArray(mixinsArray)) return;

      const hasPureRenderMixin = mixinsArray.some(
        (el: any) => el?.type === "Identifier" && el.name === "PureRenderMixin",
      );
      if (!hasPureRenderMixin) return;

      // Replace mixins: [PureRenderMixin] with shouldComponentUpdate
      const replacement = `shouldComponentUpdate: function (nextProps, nextState) {
    return (
      !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState)
    );
  }`;
      root._addPatch(mixinsProp.start, mixinsProp.end, replacement);

      // Remove PureRenderMixin require
      root
        .find(j.VariableDeclaration)
        .filter((path) => {
          const decl = path.node.declarations?.[0];
          return (
            decl?.id?.name === "PureRenderMixin" &&
            decl.init?.type === "CallExpression" &&
            decl.init.callee?.name === "require"
          );
        })
        .remove();

      isDirty = true;
    });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
