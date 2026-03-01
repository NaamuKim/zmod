import type { Transform } from "zmod";

// DOM methods that moved from React to ReactDOM
const DOM_METHODS = new Set([
  "render",
  "unmountComponentAtNode",
  "findDOMNode",
  "unstable_batchedUpdates",
  "unstable_renderSubtreeIntoContainer",
]);

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find React.xxx() calls where xxx is a DOM method
  root
    .find(j.MemberExpression, {
      object: { name: "React" },
    })
    .filter((path) => DOM_METHODS.has(path.node.property?.name))
    .forEach((path) => {
      // Replace "React" with "ReactDOM" in the object
      root._addPatch(path.node.object.start, path.node.object.end, "ReactDOM");
      isDirty = true;
    });

  // Add ReactDOM require after React require
  if (isDirty) {
    root
      .find(j.VariableDeclaration)
      .filter((path) => {
        const decl = path.node.declarations?.[0];
        return (
          decl?.init?.type === "CallExpression" &&
          decl.init.callee?.name === "require" &&
          decl.init.arguments?.[0]?.value === "react"
        );
      })
      .forEach((path) => {
        root._addPatch(path.node.end, path.node.end, `\nvar ReactDOM = require("react-dom");`);
      });
  }

  return isDirty ? root.toSource() : undefined;
};

export default transform;
