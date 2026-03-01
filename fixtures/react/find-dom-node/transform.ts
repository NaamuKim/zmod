import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find all .getDOMNode() calls
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        property: { name: "getDOMNode" },
      },
    })
    .forEach((path) => {
      const callee = path.node.callee;
      const obj = callee.object;

      // Extract the object text (e.g., "this" or "this.refs.child")
      const objText = source.slice(obj.start, obj.end);

      // Replace getDOMNode() call with React.findDOMNode(obj)
      root.replace(path, `React.findDOMNode(${objText})`);
      isDirty = true;
    });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
