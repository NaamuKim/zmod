import { describe, expect, it } from "vitest";
import { z, NodePath } from "../src/jscodeshift";

describe("z() parse + toSource round-trip", () => {
  it("preserves source exactly when no changes are made", () => {
    const source = `const x = 1;\nconst y = "hello";\n`;
    const root = z(source);
    expect(root.toSource()).toBe(source);
  });

  it("parses TSX", () => {
    const source = `const App = () => <div>hello</div>;\n`;
    const root = z(source);
    expect(root.toSource()).toBe(source);
  });
});

describe("find()", () => {
  it("finds nodes by type string", () => {
    const root = z(`const x = foo(); const y = bar();`);
    const calls = root.find("CallExpression");
    expect(calls.length).toBe(2);
  });

  it("finds nodes by namedTypes", () => {
    const root = z(`const x = foo(); const y = bar();`);
    const calls = root.find(z.CallExpression);
    expect(calls.length).toBe(2);
  });

  it("finds nodes with filter", () => {
    const root = z(`const x = foo(); const y = bar();`);
    const calls = root.find(z.CallExpression, {
      callee: { name: "foo" },
    });
    expect(calls.length).toBe(1);
  });

  it("finds nested nodes with deep filter", () => {
    const source = `React.forwardRef(() => {}); other.forwardRef(() => {});`;
    const root = z(source);
    const calls = root.find(z.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "React" },
        property: { name: "forwardRef" },
      },
    });
    expect(calls.length).toBe(1);
  });
});

describe("replaceWith()", () => {
  it("replaces a node with another node from the same AST", () => {
    const source = `const x = React.forwardRef(myFunc);`;
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

    expect(root.toSource()).toBe(`const x = myFunc;`);
  });

  it("replaces with a builder-created node", () => {
    const source = `const x = oldName;`;
    const root = z(source);
    root.find(z.Identifier, { name: "oldName" }).replaceWith(z.identifier("newName"));

    expect(root.toSource()).toBe(`const x = newName;`);
  });
});

describe("remove()", () => {
  it("removes matched nodes", () => {
    const source = `console.log("a");\nconsole.log("b");\nconst x = 1;\n`;
    const root = z(source);
    root
      .find(z.ExpressionStatement, {
        expression: {
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: { name: "console" },
            property: { name: "log" },
          },
        },
      })
      .remove();

    expect(root.toSource()).toBe(`const x = 1;\n`);
  });
});

describe("insertBefore() / insertAfter()", () => {
  it("inserts text before a node", () => {
    const source = `const x = 1;`;
    const root = z(source);
    root.find(z.VariableDeclaration).insertBefore("// comment\n");

    expect(root.toSource()).toBe(`// comment\nconst x = 1;`);
  });

  it("inserts text after a node", () => {
    const source = `const x = 1;`;
    const root = z(source);
    root.find(z.VariableDeclaration).insertAfter("\nconst y = 2;");

    expect(root.toSource()).toBe(`const x = 1;\nconst y = 2;`);
  });
});

describe("chained find()", () => {
  it("finds descendants of matched nodes", () => {
    const source = `function foo() { bar(); baz(); }\nfunction qux() { quux(); }`;
    const root = z(source);
    const fooCalls = root
      .find(z.FunctionDeclaration, { id: { name: "foo" } })
      .find(z.CallExpression);

    expect(fooCalls.length).toBe(2);
  });
});

describe("forEach()", () => {
  it("iterates over all matched paths", () => {
    const source = `foo(); bar(); baz();`;
    const root = z(source);
    const names: string[] = [];
    root.find(z.CallExpression).forEach((path) => {
      names.push(path.node.callee.name);
    });
    expect(names).toEqual(["foo", "bar", "baz"]);
  });
});

describe("filter()", () => {
  it("filters matched paths with a predicate", () => {
    const source = `foo(1); bar(2); foo(3);`;
    const root = z(source);
    const fooCalls = root.find(z.CallExpression).filter((path) => path.node.callee.name === "foo");

    expect(fooCalls.length).toBe(2);
  });
});

describe("NodePath aliases", () => {
  it("value is alias for node", () => {
    const root = z(`const x = 1;`);
    const path = root.find(z.VariableDeclaration).at(0)!;
    expect(path.value).toBe(path.node);
  });

  it("parentPath is alias for parent", () => {
    const root = z(`const x = 1;`);
    const path = root.find(z.VariableDeclarator).at(0)!;
    expect(path.parentPath).toBe(path.parent);
  });

  it("name is alias for parentKey", () => {
    const root = z(`const x = 1;`);
    const path = root.find(z.VariableDeclarator).at(0)!;
    expect(path.name).toBe(path.parentKey);
  });
});

describe("some() / every()", () => {
  it("some returns true if any path matches", () => {
    const root = z(`foo(); bar();`);
    const calls = root.find(z.CallExpression);
    expect(calls.some((p) => p.node.callee.name === "foo")).toBe(true);
    expect(calls.some((p) => p.node.callee.name === "baz")).toBe(false);
  });

  it("every returns true if all paths match", () => {
    const root = z(`foo(); foo();`);
    const calls = root.find(z.CallExpression);
    expect(calls.every((p) => p.node.callee.name === "foo")).toBe(true);
  });

  it("every returns false if any path doesn't match", () => {
    const root = z(`foo(); bar();`);
    const calls = root.find(z.CallExpression);
    expect(calls.every((p) => p.node.callee.name === "foo")).toBe(false);
  });
});

describe("size()", () => {
  it("returns the number of matched paths", () => {
    const root = z(`foo(); bar(); baz();`);
    expect(root.find(z.CallExpression).size()).toBe(3);
  });
});

describe("nodes()", () => {
  it("returns an array of AST nodes", () => {
    const root = z(`foo(); bar();`);
    const nodes = root.find(z.CallExpression).nodes();
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe("CallExpression");
    expect(nodes[0].callee.name).toBe("foo");
  });
});

describe("map()", () => {
  it("maps paths to a new FilteredCollection", () => {
    const root = z(`foo(); bar();`);
    const calleePaths = root.find(z.CallExpression).map((path) => {
      // Return the callee identifier path as a NodePath
      const callee = path.node.callee;
      return new NodePath(callee, path, "callee", null);
    });
    expect(calleePaths.length).toBe(2);
    expect(calleePaths.nodes()[0].name).toBe("foo");
  });
});

describe("getAST()", () => {
  it("returns the root paths", () => {
    const root = z(`const x = 1;`);
    const ast = root.find(z.VariableDeclaration).getAST();
    expect(ast.length).toBeGreaterThan(0);
    expect(ast[0].node.type).toBe("Program");
  });
});

describe("getTypes()", () => {
  it("returns unique types in the collection", () => {
    const root = z(`foo(); bar();`);
    const types = root.find(z.CallExpression).getTypes();
    expect(types).toEqual(["CallExpression"]);
  });
});

describe("isOfType()", () => {
  it("returns true when all paths are the given type", () => {
    const root = z(`foo(); bar();`);
    expect(root.find(z.CallExpression).isOfType("CallExpression")).toBe(true);
  });

  it("returns false when not all paths are the given type", () => {
    const root = z(`foo(); bar();`);
    expect(root.find(z.CallExpression).isOfType("Identifier")).toBe(false);
  });
});

describe("get() variadic", () => {
  it("get() returns first path", () => {
    const root = z(`foo(); bar();`);
    const path = root.find(z.CallExpression).get();
    expect(path.node.type).toBe("CallExpression");
  });

  it("get(index) returns path at index", () => {
    const root = z(`foo(); bar();`);
    const path = root.find(z.CallExpression).get(1);
    expect(path.node.callee.name).toBe("bar");
  });

  it("get(field) traverses into first path node", () => {
    const root = z(`foo();`);
    const callee = root.find(z.CallExpression).get("callee");
    expect(callee.name).toBe("foo");
  });

  it("get(field, field) deep traversal", () => {
    const root = z(`a.b();`);
    const name = root.find(z.CallExpression).get("callee", "property", "name");
    expect(name).toBe("b");
  });
});

describe("toSource() with options", () => {
  it("accepts options parameter (ignored)", () => {
    const source = `const x = 1;`;
    const root = z(source);
    expect(root.toSource({ tabWidth: 4 })).toBe(source);
    expect(root.find(z.VariableDeclaration).toSource({ tabWidth: 4 })).toBe(source);
  });
});

describe("findVariableDeclarators()", () => {
  it("finds all variable declarators", () => {
    const root = z(`const x = 1; let y = 2; var z = 3;`);
    expect(root.findVariableDeclarators().length).toBe(3);
  });

  it("finds variable declarators by name", () => {
    const root = z(`const x = 1; let y = 2;`);
    const result = root.findVariableDeclarators("x");
    expect(result.length).toBe(1);
    expect(result.nodes()[0].id.name).toBe("x");
  });

  it("works on FilteredCollection too", () => {
    const root = z(`function foo() { const x = 1; } const y = 2;`);
    const result = root.find(z.FunctionDeclaration).findVariableDeclarators("x");
    expect(result.length).toBe(1);
  });
});

describe("findJSXElements()", () => {
  it("finds all JSX elements", () => {
    const root = z(`const a = <div>hello</div>; const b = <span />;`);
    expect(root.findJSXElements().length).toBe(2);
  });

  it("finds JSX elements by name", () => {
    const root = z(`const a = <div>hello</div>; const b = <span />;`);
    const divs = root.findJSXElements("div");
    expect(divs.length).toBe(1);
  });

  it("works on FilteredCollection too", () => {
    const root = z(`const a = <div><span /></div>;`);
    const spans = root.findJSXElements("div").findJSXElements("span");
    expect(spans.length).toBe(1);
  });
});

describe("childNodes()", () => {
  it("returns all child nodes of JSXElements", () => {
    const root = z(`const a = <div>text<span />{"expr"}</div>;`);
    const children = root.findJSXElements("div").childNodes();
    expect(children.length).toBe(3);
  });

  it("returns empty for non-JSX nodes", () => {
    const root = z(`const x = 1;`);
    const children = root.find(z.VariableDeclaration).childNodes();
    expect(children.length).toBe(0);
  });
});

describe("childElements()", () => {
  it("returns only JSXElement children", () => {
    const root = z(`const a = <div>text<span /><p /></div>;`);
    const children = root.findJSXElements("div").childElements();
    expect(children.length).toBe(2);
    expect(children.nodes().map((n) => n.openingElement.name.name)).toEqual(["span", "p"]);
  });

  it("returns empty when no JSXElement children", () => {
    const root = z(`const a = <div>text only</div>;`);
    const children = root.findJSXElements("div").childElements();
    expect(children.length).toBe(0);
  });
});

describe("closest()", () => {
  it("finds the closest ancestor of a given type", () => {
    const root = z(`function foo() { bar(); } function baz() { qux(); }`);
    const barCall = root.find(z.CallExpression, { callee: { name: "bar" } });
    const fn = barCall.closest(z.FunctionDeclaration);
    expect(fn.length).toBe(1);
    expect(fn.nodes()[0].id.name).toBe("foo");
  });

  it("finds closest with filter", () => {
    const root = z(`function foo() { function inner() { bar(); } }`);
    const barCall = root.find(z.CallExpression, { callee: { name: "bar" } });
    const fn = barCall.closest(z.FunctionDeclaration, { id: { name: "foo" } });
    expect(fn.length).toBe(1);
    expect(fn.nodes()[0].id.name).toBe("foo");
  });

  it("deduplicates results", () => {
    const root = z(`function foo() { bar(); baz(); }`);
    const calls = root.find(z.CallExpression);
    const fn = calls.closest(z.FunctionDeclaration);
    expect(fn.length).toBe(1);
  });

  it("returns empty when no ancestor matches", () => {
    const root = z(`bar();`);
    const calls = root.find(z.CallExpression);
    const fn = calls.closest(z.FunctionDeclaration);
    expect(fn.length).toBe(0);
  });
});

describe("closestScope()", () => {
  it("finds the enclosing function", () => {
    const root = z(`function foo() { const x = 1; }`);
    const decl = root.find(z.VariableDeclaration);
    const scope = decl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("FunctionDeclaration");
  });

  it("finds Program when at top level", () => {
    const root = z(`const x = 1;`);
    const decl = root.find(z.VariableDeclaration);
    const scope = decl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("Program");
  });

  it("finds ArrowFunctionExpression scope", () => {
    const root = z(`const fn = () => { const x = 1; };`);
    const innerDecl = root.find(z.VariableDeclarator, { id: { name: "x" } });
    const scope = innerDecl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("ArrowFunctionExpression");
  });
});

describe("getVariableDeclarators()", () => {
  it("finds variable declarators by name from callback", () => {
    const root = z(`const foo = 1; const bar = 2; foo; bar;`);
    const refs = root.find(z.Identifier, { name: "foo" }).filter((p) => p.parentKey !== "id");
    const decls = refs.getVariableDeclarators((p) => p.node.name);
    expect(decls.length).toBe(1);
    expect(decls.nodes()[0].id.name).toBe("foo");
  });

  it("returns empty when callback returns falsy", () => {
    const root = z(`const foo = 1;`);
    const ids = root.find(z.Identifier);
    const decls = ids.getVariableDeclarators(() => null);
    expect(decls.length).toBe(0);
  });
});

// ── NodePath class methods ──

describe("NodePath.scope", () => {
  it("returns the enclosing scope", () => {
    const root = z(`function foo() { const x = 1; }`);
    const path = root.find(z.VariableDeclarator).at(0)!;
    expect(path.scope).not.toBeNull();
    expect(path.scope!.node.type).toBe("FunctionDeclaration");
    expect(path.scope!.isGlobal).toBe(false);
  });

  it("returns Program scope at top level", () => {
    const root = z(`const x = 1;`);
    const path = root.find(z.VariableDeclarator).at(0)!;
    expect(path.scope!.isGlobal).toBe(true);
  });
});

describe("NodePath.get()", () => {
  it("traverses into child node", () => {
    const root = z(`foo();`);
    const path = root.find(z.CallExpression).at(0)!;
    const callee = path.get("callee");
    expect(callee).toBeInstanceOf(NodePath);
    expect(callee.node.type).toBe("Identifier");
    expect(callee.node.name).toBe("foo");
  });

  it("returns {value} for non-node values", () => {
    const root = z(`foo();`);
    const path = root.find(z.CallExpression).at(0)!;
    const calleePath = path.get("callee");
    const name = calleePath.get("name");
    expect(name.value).toBe("foo");
  });
});

describe("NodePath.getValueProperty()", () => {
  it("returns node property value", () => {
    const root = z(`foo();`);
    const path = root.find(z.CallExpression).at(0)!;
    expect(path.getValueProperty("type")).toBe("CallExpression");
  });
});

describe("NodePath.replace()", () => {
  it("replaces node via patch", () => {
    const root = z(`foo();`);
    const path = root.find(z.Identifier, { name: "foo" }).at(0)!;
    path.replace(z.identifier("bar"));
    expect(root.toSource()).toBe(`bar();`);
  });
});

describe("NodePath.prune()", () => {
  it("removes the node", () => {
    const root = z(`foo();\nbar();\n`);
    const path = root.find(z.ExpressionStatement).at(0)!;
    path.prune();
    expect(root.toSource()).toBe(`\nbar();\n`);
  });
});

describe("NodePath.needsParens()", () => {
  it("returns true for ObjectExpression", () => {
    const root = z(`const x = {a: 1};`);
    const path = root.find(z.ObjectExpression).at(0)!;
    expect(path.needsParens()).toBe(true);
  });

  it("returns false for Identifier", () => {
    const root = z(`const x = 1;`);
    const path = root.find(z.VariableDeclarator).at(0)!;
    expect(path.needsParens()).toBe(false);
  });
});

describe("NodePath.firstInStatement()", () => {
  it("returns true for first statement in body", () => {
    const root = z(`foo();\nbar();`);
    const stmts = root.find(z.ExpressionStatement);
    expect(stmts.at(0)!.firstInStatement()).toBe(true);
    expect(stmts.at(1)!.firstInStatement()).toBe(false);
  });
});

// ── Core API ──

describe("z.match()", () => {
  it("matches node against filter object", () => {
    const root = z(`foo();`);
    const path = root.find(z.CallExpression).at(0)!;
    expect(z.match(path, { callee: { name: "foo" } })).toBe(true);
    expect(z.match(path, { callee: { name: "bar" } })).toBe(false);
  });

  it("matches node against filter function", () => {
    const root = z(`foo();`);
    const path = root.find(z.CallExpression).at(0)!;
    expect(z.match(path, (node) => node.type === "CallExpression")).toBe(true);
  });
});

describe("z.withParser()", () => {
  it("returns j itself", () => {
    const j2 = z.withParser("babel");
    expect(typeof j2).toBe("function");
  });
});

describe("z.types", () => {
  it("exposes namedTypes", () => {
    expect(z.types).toBeDefined();
    expect(z.types.Identifier).toBeDefined();
  });
});

describe("z.template", () => {
  it("template.expression parses an expression", () => {
    const node = z.template.expression`foo()`;
    expect(node.type).toBe("CallExpression");
  });

  it("template.statement parses a statement", () => {
    const node = z.template.statement`const x = 1;`;
    expect(node.type).toBe("VariableDeclaration");
  });

  it("template.statements parses multiple statements", () => {
    const nodes = z.template.statements`const x = 1; const y = 2;`;
    expect(nodes.length).toBe(2);
  });
});

describe("z.filters", () => {
  it("JSXElement.hasAttributes works", () => {
    const root = z(`const a = <div className="foo" />;`);
    const divs = root.findJSXElements("div");
    const filtered = divs.filter(z.filters.JSXElement.hasAttributes({ className: "foo" }));
    expect(filtered.length).toBe(1);
  });

  it("JSXElement.hasChildren works", () => {
    const root = z(`const a = <div><span /></div>;`);
    const divs = root.findJSXElements("div");
    const filtered = divs.filter(z.filters.JSXElement.hasChildren("span"));
    expect(filtered.length).toBe(1);
  });
});

describe("z.mappings", () => {
  it("JSXElement.getRootName returns element name", () => {
    const root = z(`const a = <Foo.Bar />;`);
    const path = root.find(z.JSXElement).at(0)!;
    expect(z.mappings.JSXElement.getRootName(path)).toBe("Foo");
  });
});

describe("findJSXElementsByModuleName()", () => {
  it("finds JSX elements imported from a module", () => {
    const source = `import Foo from 'my-module';\nconst a = <Foo />;`;
    const root = z(source);
    const els = root.findJSXElementsByModuleName("my-module");
    expect(els.length).toBe(1);
  });

  it("returns empty for unmatched module", () => {
    const source = `import Foo from 'other';\nconst a = <Foo />;`;
    const root = z(source);
    const els = root.findJSXElementsByModuleName("my-module");
    expect(els.length).toBe(0);
  });
});
