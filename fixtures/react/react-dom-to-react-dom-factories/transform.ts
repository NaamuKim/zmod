import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find React.DOM.xxx(...) calls
  root
    .find(j.CallExpression)
    .filter((path) => {
      const callee = path.node.callee;
      return (
        callee.type === "MemberExpression" &&
        callee.object?.type === "MemberExpression" &&
        callee.object.object?.name === "React" &&
        callee.object.property?.name === "DOM"
      );
    })
    .forEach((path) => {
      const callee = path.node.callee;
      const tagName = callee.property.name;

      // Replace the callee "React.DOM.xxx" with "React.createElement"
      root._addPatch(callee.start, callee.end, `React.createElement`);

      // Insert "tagName", as the first argument
      const args = path.node.arguments;
      if (args.length > 0) {
        root._addPatch(args[0].start, args[0].start, `"${tagName}", `);
      }

      isDirty = true;
    });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
