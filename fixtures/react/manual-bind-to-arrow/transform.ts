import type { Transform } from "zmod";

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Track which methods are bound in constructor: this.x = this.x.bind(this)
  const boundMethods = new Set<string>();

  root.find(j.ClassDeclaration).forEach((classPath) => {
    // Find constructor
    const constructorBody = classPath.node.body?.body;
    if (!constructorBody) return;

    const constructor = constructorBody.find(
      (m: any) => m.type === "MethodDefinition" && m.kind === "constructor",
    );
    if (!constructor) return;

    const stmts = constructor.value?.body?.body;
    if (!stmts) return;

    // Find bind statements: this.x = this.x.bind(this)
    const bindStmts: any[] = [];
    for (const stmt of stmts) {
      if (stmt.type !== "ExpressionStatement") continue;
      const expr = stmt.expression;
      if (expr.type !== "AssignmentExpression" || expr.operator !== "=") continue;

      const left = expr.left;
      const right = expr.right;

      // left: this.methodName
      if (left.type !== "MemberExpression" || left.object?.type !== "ThisExpression") continue;
      const methodName = left.property?.name;
      if (!methodName) continue;

      // right: this.methodName.bind(this)
      if (right.type !== "CallExpression") continue;
      if (right.callee?.type !== "MemberExpression") continue;
      if (right.callee.property?.name !== "bind") continue;
      if (right.callee.object?.type !== "MemberExpression") continue;
      if (right.callee.object.object?.type !== "ThisExpression") continue;
      if (right.callee.object.property?.name !== methodName) continue;

      bindStmts.push(stmt);
      boundMethods.add(methodName);
    }

    // Remove bind statements from constructor (including leading indent and trailing newline)
    for (const stmt of bindStmts) {
      let start = stmt.start;
      // Extend backward to include leading whitespace on the same line
      while (start > 0 && (source[start - 1] === " " || source[start - 1] === "\t")) start--;
      let end = stmt.end;
      while (end < source.length && (source[end] === " " || source[end] === "\t")) end++;
      if (end < source.length && source[end] === "\n") end++;
      root._addPatch(start, end, "");
      isDirty = true;
    }

    // Convert bound methods from method definitions to arrow function class properties
    for (const member of constructorBody) {
      if (member.type !== "MethodDefinition" || member.kind !== "method") continue;
      const name = member.key?.name;
      if (!name || !boundMethods.has(name)) continue;

      const fn = member.value;
      if (!fn) continue;

      const params = fn.params || [];
      const paramsText =
        params.length > 0 ? source.slice(params[0].start, params[params.length - 1].end) : "";
      const bodyText = source.slice(fn.body.start, fn.body.end);

      root._addPatch(member.start, member.end, `${name} = (${paramsText}) => ${bodyText};`);
    }
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
