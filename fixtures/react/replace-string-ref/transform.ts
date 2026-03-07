import type { Transform } from "zmod";

const SUPERCLASS_NAMES = ["PureComponent", "Component"];

const transform: Transform = ({ source }, { z }) => {
  const root = z(source);
  let isDirty = false;

  // 1. Collect React import info
  const namedImportLocals = new Set<string>();
  let reactDefaultName: string | null = null;

  root.find(z.ImportDeclaration, { source: { value: "react" } }).forEach((path) => {
    for (const spec of path.node.specifiers || []) {
      if (spec.type === "ImportSpecifier" && SUPERCLASS_NAMES.includes(spec.imported?.name)) {
        namedImportLocals.add(spec.local?.name ?? spec.imported?.name);
      }
      if (spec.type === "ImportDefaultSpecifier" || spec.type === "ImportNamespaceSpecifier") {
        reactDefaultName = spec.local?.name ?? null;
      }
    }
  });

  // 2. Find class components extending Component/PureComponent
  const classDecls = root.find(z.ClassDeclaration).filter((path) => {
    const sc = path.node.superClass;
    if (!sc) return false;

    // extends Component / extends PureComponent
    if (sc.type === "Identifier" && namedImportLocals.has(sc.name)) return true;

    // extends React.Component / extends React.PureComponent
    if (
      sc.type === "MemberExpression" &&
      sc.object?.name === reactDefaultName &&
      SUPERCLASS_NAMES.includes(sc.property?.name)
    ) {
      return true;
    }

    return false;
  });

  // 3. Within class components, find ref="string" JSX attributes
  classDecls
    .find(z.JSXAttribute, { name: { type: "JSXIdentifier", name: "ref" } })
    .forEach((path) => {
      const val = path.node.value;
      if (!val || val.type !== "Literal" || typeof val.value !== "string") return;

      isDirty = true;
      const refName = val.value;

      // Build: ref={(ref) => { this.refs.refName = ref; }}
      const callbackRef = z.jsxAttribute(
        z.jsxIdentifier("ref"),
        z.jsxExpressionContainer(
          z.arrowFunctionExpression(
            [z.identifier("ref")],
            z.blockStatement([
              z.expressionStatement(
                z.assignmentExpression(
                  "=",
                  z.memberExpression(
                    z.memberExpression(z.thisExpression(), z.identifier("refs")),
                    z.identifier(refName),
                  ),
                  z.identifier("ref"),
                ),
              ),
            ]),
          ),
        ),
      );

      root.replace(path, callbackRef);
    });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
