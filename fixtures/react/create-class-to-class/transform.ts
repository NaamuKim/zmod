import type { Transform } from "zmod";

const STATIC_PROPS = new Set(["propTypes", "contextTypes", "childContextTypes", "displayName"]);

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find: var X = React.createClass({...})
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

      // Get the variable name
      const varDeclarator = callPath.parent;
      if (!varDeclarator || varDeclarator.node.type !== "VariableDeclarator") return;
      const className = varDeclarator.node.id?.name;
      if (!className) return;

      // Get the VariableDeclaration (grandparent)
      const varDecl = varDeclarator.parent;
      if (!varDecl) return;

      const properties = arg.properties || [];
      const classMembers: string[] = [];

      for (const prop of properties) {
        const key = prop.key?.name ?? prop.key?.value;
        if (!key) continue;

        if (STATIC_PROPS.has(key)) {
          // Static property: static propTypes = {...};
          const valText = source.slice(prop.value.start, prop.value.end);
          classMembers.push(`  static ${key} = ${valText};`);
        } else if (key === "getDefaultProps") {
          // getDefaultProps → static defaultProps = <return value>
          const body = prop.value?.body?.body;
          if (body?.length === 1 && body[0].type === "ReturnStatement" && body[0].argument) {
            const retText = source.slice(body[0].argument.start, body[0].argument.end);
            classMembers.push(`  static defaultProps = ${retText};`);
          }
        } else if (key === "getInitialState") {
          // getInitialState → state = <return value>
          const body = prop.value?.body?.body;
          if (body?.length === 1 && body[0].type === "ReturnStatement" && body[0].argument) {
            const retText = source.slice(body[0].argument.start, body[0].argument.end);
            classMembers.push(`  state = ${retText};`);
          }
        } else if (key === "mixins") {
          // Skip mixins (not supported in ES6 classes)
          continue;
        } else {
          // Regular method: convert function expression to method
          const fn = prop.value;
          if (!fn || fn.type !== "FunctionExpression") {
            // Non-function property — keep as class field
            const valText = source.slice(prop.value.start, prop.value.end);
            classMembers.push(`  ${key} = ${valText};`);
            continue;
          }
          const params = fn.params || [];
          const paramsText =
            params.length > 0 ? source.slice(params[0].start, params[params.length - 1].end) : "";
          const bodyText = source.slice(fn.body.start, fn.body.end);
          classMembers.push(`  ${key}(${paramsText}) ${bodyText}`);
        }
      }

      // Build the class declaration
      const classDecl = `class ${className} extends React.Component {\n${classMembers.join("\n\n")}\n}`;

      // Replace the entire VariableDeclaration with the class declaration
      root._addPatch(varDecl.node.start, varDecl.node.end, classDecl);
      isDirty = true;
    });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
