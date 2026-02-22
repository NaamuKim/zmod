import type { Transform } from "zmod";

const SUPERCLASS_NAMES = ["PureComponent", "Component"];

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // 1. Collect React import info
  const namedImportLocals = new Set<string>();
  let reactDefaultName: string | null = null;

  root.find(j.ImportDeclaration, { source: { value: "react" } }).forEach((path) => {
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
  const classDecls = root.find(j.ClassDeclaration).filter((path) => {
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
    .find(j.JSXAttribute, { name: { type: "JSXIdentifier", name: "ref" } })
    .forEach((path) => {
      const val = path.node.value;
      if (!val || val.type !== "Literal" || typeof val.value !== "string") return;

      isDirty = true;
      const refName = val.value;

      // Build: ref={(ref) => { this.refs.refName = ref; }}
      const callbackRef = j.jsxAttribute(
        j.jsxIdentifier("ref"),
        j.jsxExpressionContainer(
          j.arrowFunctionExpression(
            [j.identifier("ref")],
            j.blockStatement([
              j.expressionStatement(
                j.assignmentExpression(
                  "=",
                  j.memberExpression(
                    j.memberExpression(j.thisExpression(), j.identifier("refs")),
                    j.identifier(refName),
                  ),
                  j.identifier("ref"),
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
