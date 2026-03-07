import type { Transform } from "zmod";

const transform: Transform = ({ source }, { z }) => {
  const root = z(source);

  root
    .find(z.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "forwardRef" },
      },
    })
    .replaceWith((path) => path.node.arguments[0]);

  return root.toSource();
};

export default transform;
