import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Replace React.PropTypes.xxx with PropTypes.xxx
  root
    .find(j.MemberExpression, {
      object: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "PropTypes" },
      },
    })
    .forEach((path) => {
      // Replace "React.PropTypes" with "PropTypes"
      root._addPatch(path.node.object.start, path.node.object.end, "PropTypes");
      isDirty = true;
    });

  if (isDirty) {
    // Add PropTypes import at the top
    root.find(j.ImportDeclaration, { source: { value: "react" } }).forEach((path) => {
      root._addPatch(path.node.start, path.node.start, `import PropTypes from "prop-types";\n`);
    });
  }

  return isDirty ? root.toSource() : undefined;
};

export default transform;
