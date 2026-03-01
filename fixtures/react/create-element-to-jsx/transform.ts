import type { Transform } from "zmod";

function propsToJSXAttrs(source: string, propsNode: any): string {
  if (
    !propsNode ||
    propsNode.type === "NullLiteral" ||
    (propsNode.type === "Literal" && propsNode.value === null)
  ) {
    return "";
  }
  if (propsNode.type !== "ObjectExpression") {
    return ` {...${source.slice(propsNode.start, propsNode.end)}}`;
  }
  const attrs: string[] = [];
  for (const prop of propsNode.properties || []) {
    if (prop.type === "SpreadElement" || prop.type === "SpreadProperty") {
      attrs.push(`{...${source.slice(prop.argument.start, prop.argument.end)}}`);
      continue;
    }
    const key = prop.key?.name ?? prop.key?.value;
    if (!key) continue;
    const val = prop.value;
    if (val.type === "StringLiteral" || (val.type === "Literal" && typeof val.value === "string")) {
      attrs.push(`${key}=${source.slice(val.start, val.end)}`);
    } else {
      attrs.push(`${key}={${source.slice(val.start, val.end)}}`);
    }
  }
  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

function childToJSX(source: string, child: any, indent: string): string {
  if (
    child.type === "StringLiteral" ||
    (child.type === "Literal" && typeof child.value === "string")
  ) {
    return child.value;
  }
  if (
    child.type === "CallExpression" &&
    child.callee?.type === "MemberExpression" &&
    child.callee.object?.name === "React" &&
    child.callee.property?.name === "createElement"
  ) {
    return createElementToJSX(source, child, indent);
  }
  return `{${source.slice(child.start, child.end)}}`;
}

function createElementToJSX(source: string, node: any, indent: string = ""): string {
  const args = node.arguments || [];
  if (args.length === 0) return source.slice(node.start, node.end);

  const tagNode = args[0];
  let tag: string;
  if (
    tagNode.type === "StringLiteral" ||
    (tagNode.type === "Literal" && typeof tagNode.value === "string")
  ) {
    tag = tagNode.value;
  } else {
    tag = source.slice(tagNode.start, tagNode.end);
  }

  const propsNode = args.length > 1 ? args[1] : null;
  const attrs = propsToJSXAttrs(source, propsNode);

  const children = args.slice(2);
  if (children.length === 0) {
    return `<${tag}${attrs} />`;
  }

  if (children.length === 1) {
    const childStr = childToJSX(source, children[0], indent);
    return `<${tag}${attrs}>${childStr}</${tag}>`;
  }

  const childIndent = indent + "  ";
  const childStrs = children.map((c: any) => childIndent + childToJSX(source, c, childIndent));
  return `<${tag}${attrs}>\n${childStrs.join("\n")}\n${indent}</${tag}>`;
}

const transform: Transform = ({ source }, { j }) => {
  const root = j(source);
  let isDirty = false;

  // Find only top-level createElement calls (not nested ones)
  // We handle nesting recursively in createElementToJSX
  const calls = root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "createElement" },
      },
    })
    .filter((path) => {
      // Exclude calls whose parent is also a createElement call (they're nested children)
      let p = path.parent;
      while (p) {
        if (
          p.node.type === "CallExpression" &&
          p.node.callee?.type === "MemberExpression" &&
          p.node.callee.object?.name === "React" &&
          p.node.callee.property?.name === "createElement"
        ) {
          return false;
        }
        p = p.parent;
      }
      return true;
    });

  calls.forEach((path) => {
    const jsx = createElementToJSX(source, path.node);
    root._addPatch(path.node.start, path.node.end, jsx);
    isDirty = true;
  });

  return isDirty ? root.toSource() : undefined;
};

export default transform;
