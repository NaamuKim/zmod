import { describe, expect, it } from "vitest";
import { j, NodePath } from "../src/jscodeshift";

describe("j() parse + toSource round-trip", () => {
  it("preserves source exactly when no changes are made", () => {
    const source = `const x = 1;\nconst y = "hello";\n`;
    const root = j(source);
    expect(root.toSource()).toBe(source);
  });

  it("parses TSX", () => {
    const source = `const App = () => <div>hello</div>;\n`;
    const root = j(source);
    expect(root.toSource()).toBe(source);
  });
});

describe("find()", () => {
  it("finds nodes by type string", () => {
    const root = j(`const x = foo(); const y = bar();`);
    const calls = root.find("CallExpression");
    expect(calls.length).toBe(2);
  });

  it("finds nodes by namedTypes", () => {
    const root = j(`const x = foo(); const y = bar();`);
    const calls = root.find(j.CallExpression);
    expect(calls.length).toBe(2);
  });

  it("finds nodes with filter", () => {
    const root = j(`const x = foo(); const y = bar();`);
    const calls = root.find(j.CallExpression, {
      callee: { name: "foo" },
    });
    expect(calls.length).toBe(1);
  });

  it("finds nested nodes with deep filter", () => {
    const source = `React.forwardRef(() => {}); other.forwardRef(() => {});`;
    const root = j(source);
    const calls = root.find(j.CallExpression, {
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
    const root = j(source);
    root
      .find(j.CallExpression, {
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
    const root = j(source);
    root.find(j.Identifier, { name: "oldName" }).replaceWith(j.identifier("newName"));

    expect(root.toSource()).toBe(`const x = newName;`);
  });
});

describe("remove()", () => {
  it("removes matched nodes", () => {
    const source = `console.log("a");\nconsole.log("b");\nconst x = 1;\n`;
    const root = j(source);
    root
      .find(j.ExpressionStatement, {
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
    const root = j(source);
    root.find(j.VariableDeclaration).insertBefore("// comment\n");

    expect(root.toSource()).toBe(`// comment\nconst x = 1;`);
  });

  it("inserts text after a node", () => {
    const source = `const x = 1;`;
    const root = j(source);
    root.find(j.VariableDeclaration).insertAfter("\nconst y = 2;");

    expect(root.toSource()).toBe(`const x = 1;\nconst y = 2;`);
  });
});

describe("chained find()", () => {
  it("finds descendants of matched nodes", () => {
    const source = `function foo() { bar(); baz(); }\nfunction qux() { quux(); }`;
    const root = j(source);
    const fooCalls = root
      .find(j.FunctionDeclaration, { id: { name: "foo" } })
      .find(j.CallExpression);

    expect(fooCalls.length).toBe(2);
  });
});

describe("forEach()", () => {
  it("iterates over all matched paths", () => {
    const source = `foo(); bar(); baz();`;
    const root = j(source);
    const names: string[] = [];
    root.find(j.CallExpression).forEach((path) => {
      names.push(path.node.callee.name);
    });
    expect(names).toEqual(["foo", "bar", "baz"]);
  });
});

describe("filter()", () => {
  it("filters matched paths with a predicate", () => {
    const source = `foo(1); bar(2); foo(3);`;
    const root = j(source);
    const fooCalls = root.find(j.CallExpression).filter((path) => path.node.callee.name === "foo");

    expect(fooCalls.length).toBe(2);
  });
});

describe("NodePath aliases", () => {
  it("value is alias for node", () => {
    const root = j(`const x = 1;`);
    const path = root.find(j.VariableDeclaration).at(0)!;
    expect(path.value).toBe(path.node);
  });

  it("parentPath is alias for parent", () => {
    const root = j(`const x = 1;`);
    const path = root.find(j.VariableDeclarator).at(0)!;
    expect(path.parentPath).toBe(path.parent);
  });

  it("name is alias for parentKey", () => {
    const root = j(`const x = 1;`);
    const path = root.find(j.VariableDeclarator).at(0)!;
    expect(path.name).toBe(path.parentKey);
  });
});

describe("some() / every()", () => {
  it("some returns true if any path matches", () => {
    const root = j(`foo(); bar();`);
    const calls = root.find(j.CallExpression);
    expect(calls.some((p) => p.node.callee.name === "foo")).toBe(true);
    expect(calls.some((p) => p.node.callee.name === "baz")).toBe(false);
  });

  it("every returns true if all paths match", () => {
    const root = j(`foo(); foo();`);
    const calls = root.find(j.CallExpression);
    expect(calls.every((p) => p.node.callee.name === "foo")).toBe(true);
  });

  it("every returns false if any path doesn't match", () => {
    const root = j(`foo(); bar();`);
    const calls = root.find(j.CallExpression);
    expect(calls.every((p) => p.node.callee.name === "foo")).toBe(false);
  });
});

describe("size()", () => {
  it("returns the number of matched paths", () => {
    const root = j(`foo(); bar(); baz();`);
    expect(root.find(j.CallExpression).size()).toBe(3);
  });
});

describe("nodes()", () => {
  it("returns an array of AST nodes", () => {
    const root = j(`foo(); bar();`);
    const nodes = root.find(j.CallExpression).nodes();
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe("CallExpression");
    expect(nodes[0].callee.name).toBe("foo");
  });
});

describe("map()", () => {
  it("maps paths to a new FilteredCollection", () => {
    const root = j(`foo(); bar();`);
    const calleePaths = root.find(j.CallExpression).map((path) => {
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
    const root = j(`const x = 1;`);
    const ast = root.find(j.VariableDeclaration).getAST();
    expect(ast.length).toBeGreaterThan(0);
    expect(ast[0].node.type).toBe("Program");
  });
});

describe("getTypes()", () => {
  it("returns unique types in the collection", () => {
    const root = j(`foo(); bar();`);
    const types = root.find(j.CallExpression).getTypes();
    expect(types).toEqual(["CallExpression"]);
  });
});

describe("isOfType()", () => {
  it("returns true when all paths are the given type", () => {
    const root = j(`foo(); bar();`);
    expect(root.find(j.CallExpression).isOfType("CallExpression")).toBe(true);
  });

  it("returns false when not all paths are the given type", () => {
    const root = j(`foo(); bar();`);
    expect(root.find(j.CallExpression).isOfType("Identifier")).toBe(false);
  });
});

describe("get() variadic", () => {
  it("get() returns first path", () => {
    const root = j(`foo(); bar();`);
    const path = root.find(j.CallExpression).get();
    expect(path.node.type).toBe("CallExpression");
  });

  it("get(index) returns path at index", () => {
    const root = j(`foo(); bar();`);
    const path = root.find(j.CallExpression).get(1);
    expect(path.node.callee.name).toBe("bar");
  });

  it("get(field) traverses into first path node", () => {
    const root = j(`foo();`);
    const callee = root.find(j.CallExpression).get("callee");
    expect(callee.name).toBe("foo");
  });

  it("get(field, field) deep traversal", () => {
    const root = j(`a.b();`);
    const name = root.find(j.CallExpression).get("callee", "property", "name");
    expect(name).toBe("b");
  });
});

describe("toSource() with options", () => {
  it("accepts options parameter (ignored)", () => {
    const source = `const x = 1;`;
    const root = j(source);
    expect(root.toSource({ tabWidth: 4 })).toBe(source);
    expect(root.find(j.VariableDeclaration).toSource({ tabWidth: 4 })).toBe(source);
  });
});

describe("findVariableDeclarators()", () => {
  it("finds all variable declarators", () => {
    const root = j(`const x = 1; let y = 2; var z = 3;`);
    expect(root.findVariableDeclarators().length).toBe(3);
  });

  it("finds variable declarators by name", () => {
    const root = j(`const x = 1; let y = 2;`);
    const result = root.findVariableDeclarators("x");
    expect(result.length).toBe(1);
    expect(result.nodes()[0].id.name).toBe("x");
  });

  it("works on FilteredCollection too", () => {
    const root = j(`function foo() { const x = 1; } const y = 2;`);
    const result = root.find(j.FunctionDeclaration).findVariableDeclarators("x");
    expect(result.length).toBe(1);
  });
});

describe("findJSXElements()", () => {
  it("finds all JSX elements", () => {
    const root = j(`const a = <div>hello</div>; const b = <span />;`);
    expect(root.findJSXElements().length).toBe(2);
  });

  it("finds JSX elements by name", () => {
    const root = j(`const a = <div>hello</div>; const b = <span />;`);
    const divs = root.findJSXElements("div");
    expect(divs.length).toBe(1);
  });

  it("works on FilteredCollection too", () => {
    const root = j(`const a = <div><span /></div>;`);
    const spans = root.findJSXElements("div").findJSXElements("span");
    expect(spans.length).toBe(1);
  });
});

describe("childNodes()", () => {
  it("returns all child nodes of JSXElements", () => {
    const root = j(`const a = <div>text<span />{"expr"}</div>;`);
    const children = root.findJSXElements("div").childNodes();
    expect(children.length).toBe(3);
  });

  it("returns empty for non-JSX nodes", () => {
    const root = j(`const x = 1;`);
    const children = root.find(j.VariableDeclaration).childNodes();
    expect(children.length).toBe(0);
  });
});

describe("childElements()", () => {
  it("returns only JSXElement children", () => {
    const root = j(`const a = <div>text<span /><p /></div>;`);
    const children = root.findJSXElements("div").childElements();
    expect(children.length).toBe(2);
    expect(children.nodes().map((n) => n.openingElement.name.name)).toEqual(["span", "p"]);
  });

  it("returns empty when no JSXElement children", () => {
    const root = j(`const a = <div>text only</div>;`);
    const children = root.findJSXElements("div").childElements();
    expect(children.length).toBe(0);
  });
});

describe("closest()", () => {
  it("finds the closest ancestor of a given type", () => {
    const root = j(`function foo() { bar(); } function baz() { qux(); }`);
    const barCall = root.find(j.CallExpression, { callee: { name: "bar" } });
    const fn = barCall.closest(j.FunctionDeclaration);
    expect(fn.length).toBe(1);
    expect(fn.nodes()[0].id.name).toBe("foo");
  });

  it("finds closest with filter", () => {
    const root = j(`function foo() { function inner() { bar(); } }`);
    const barCall = root.find(j.CallExpression, { callee: { name: "bar" } });
    const fn = barCall.closest(j.FunctionDeclaration, { id: { name: "foo" } });
    expect(fn.length).toBe(1);
    expect(fn.nodes()[0].id.name).toBe("foo");
  });

  it("deduplicates results", () => {
    const root = j(`function foo() { bar(); baz(); }`);
    const calls = root.find(j.CallExpression);
    const fn = calls.closest(j.FunctionDeclaration);
    expect(fn.length).toBe(1);
  });

  it("returns empty when no ancestor matches", () => {
    const root = j(`bar();`);
    const calls = root.find(j.CallExpression);
    const fn = calls.closest(j.FunctionDeclaration);
    expect(fn.length).toBe(0);
  });
});

describe("closestScope()", () => {
  it("finds the enclosing function", () => {
    const root = j(`function foo() { const x = 1; }`);
    const decl = root.find(j.VariableDeclaration);
    const scope = decl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("FunctionDeclaration");
  });

  it("finds Program when at top level", () => {
    const root = j(`const x = 1;`);
    const decl = root.find(j.VariableDeclaration);
    const scope = decl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("Program");
  });

  it("finds ArrowFunctionExpression scope", () => {
    const root = j(`const fn = () => { const x = 1; };`);
    const innerDecl = root.find(j.VariableDeclarator, { id: { name: "x" } });
    const scope = innerDecl.closestScope();
    expect(scope.length).toBe(1);
    expect(scope.nodes()[0].type).toBe("ArrowFunctionExpression");
  });
});

describe("getVariableDeclarators()", () => {
  it("finds variable declarators by name from callback", () => {
    const root = j(`const foo = 1; const bar = 2; foo; bar;`);
    const refs = root.find(j.Identifier, { name: "foo" }).filter((p) => p.parentKey !== "id");
    const decls = refs.getVariableDeclarators((p) => p.node.name);
    expect(decls.length).toBe(1);
    expect(decls.nodes()[0].id.name).toBe("foo");
  });

  it("returns empty when callback returns falsy", () => {
    const root = j(`const foo = 1;`);
    const ids = root.find(j.Identifier);
    const decls = ids.getVariableDeclarators(() => null);
    expect(decls.length).toBe(0);
  });
});

// ── NodePath class methods ──

describe("NodePath.scope", () => {
  it("returns the enclosing scope", () => {
    const root = j(`function foo() { const x = 1; }`);
    const path = root.find(j.VariableDeclarator).at(0)!;
    expect(path.scope).not.toBeNull();
    expect(path.scope!.node.type).toBe("FunctionDeclaration");
    expect(path.scope!.isGlobal).toBe(false);
  });

  it("returns Program scope at top level", () => {
    const root = j(`const x = 1;`);
    const path = root.find(j.VariableDeclarator).at(0)!;
    expect(path.scope!.isGlobal).toBe(true);
  });
});

describe("NodePath.get()", () => {
  it("traverses into child node", () => {
    const root = j(`foo();`);
    const path = root.find(j.CallExpression).at(0)!;
    const callee = path.get("callee");
    expect(callee).toBeInstanceOf(NodePath);
    expect(callee.node.type).toBe("Identifier");
    expect(callee.node.name).toBe("foo");
  });

  it("returns {value} for non-node values", () => {
    const root = j(`foo();`);
    const path = root.find(j.CallExpression).at(0)!;
    const calleePath = path.get("callee");
    const name = calleePath.get("name");
    expect(name.value).toBe("foo");
  });
});

describe("NodePath.getValueProperty()", () => {
  it("returns node property value", () => {
    const root = j(`foo();`);
    const path = root.find(j.CallExpression).at(0)!;
    expect(path.getValueProperty("type")).toBe("CallExpression");
  });
});

describe("NodePath.replace()", () => {
  it("replaces node via patch", () => {
    const root = j(`foo();`);
    const path = root.find(j.Identifier, { name: "foo" }).at(0)!;
    path.replace(j.identifier("bar"));
    expect(root.toSource()).toBe(`bar();`);
  });
});

describe("NodePath.prune()", () => {
  it("removes the node", () => {
    const root = j(`foo();\nbar();\n`);
    const path = root.find(j.ExpressionStatement).at(0)!;
    path.prune();
    expect(root.toSource()).toBe(`\nbar();\n`);
  });
});

describe("NodePath.needsParens()", () => {
  it("returns true for ObjectExpression", () => {
    const root = j(`const x = {a: 1};`);
    const path = root.find(j.ObjectExpression).at(0)!;
    expect(path.needsParens()).toBe(true);
  });

  it("returns false for Identifier", () => {
    const root = j(`const x = 1;`);
    const path = root.find(j.VariableDeclarator).at(0)!;
    expect(path.needsParens()).toBe(false);
  });
});

describe("NodePath.firstInStatement()", () => {
  it("returns true for first statement in body", () => {
    const root = j(`foo();\nbar();`);
    const stmts = root.find(j.ExpressionStatement);
    expect(stmts.at(0)!.firstInStatement()).toBe(true);
    expect(stmts.at(1)!.firstInStatement()).toBe(false);
  });
});

// ── Core API ──

describe("j.match()", () => {
  it("matches node against filter object", () => {
    const root = j(`foo();`);
    const path = root.find(j.CallExpression).at(0)!;
    expect(j.match(path, { callee: { name: "foo" } })).toBe(true);
    expect(j.match(path, { callee: { name: "bar" } })).toBe(false);
  });

  it("matches node against filter function", () => {
    const root = j(`foo();`);
    const path = root.find(j.CallExpression).at(0)!;
    expect(j.match(path, (node) => node.type === "CallExpression")).toBe(true);
  });
});

describe("j.withParser()", () => {
  it("returns j itself", () => {
    const j2 = j.withParser("babel");
    expect(typeof j2).toBe("function");
  });
});

describe("j.types", () => {
  it("exposes namedTypes", () => {
    expect(j.types).toBeDefined();
    expect(j.types.Identifier).toBeDefined();
  });
});

describe("j.template", () => {
  it("template.expression parses an expression", () => {
    const node = j.template.expression`foo()`;
    expect(node.type).toBe("CallExpression");
  });

  it("template.statement parses a statement", () => {
    const node = j.template.statement`const x = 1;`;
    expect(node.type).toBe("VariableDeclaration");
  });

  it("template.statements parses multiple statements", () => {
    const nodes = j.template.statements`const x = 1; const y = 2;`;
    expect(nodes.length).toBe(2);
  });
});

describe("j.filters", () => {
  it("JSXElement.hasAttributes works", () => {
    const root = j(`const a = <div className="foo" />;`);
    const divs = root.findJSXElements("div");
    const filtered = divs.filter(j.filters.JSXElement.hasAttributes({ className: "foo" }));
    expect(filtered.length).toBe(1);
  });

  it("JSXElement.hasChildren works", () => {
    const root = j(`const a = <div><span /></div>;`);
    const divs = root.findJSXElements("div");
    const filtered = divs.filter(j.filters.JSXElement.hasChildren("span"));
    expect(filtered.length).toBe(1);
  });
});

describe("j.mappings", () => {
  it("JSXElement.getRootName returns element name", () => {
    const root = j(`const a = <Foo.Bar />;`);
    const path = root.find(j.JSXElement).at(0)!;
    expect(j.mappings.JSXElement.getRootName(path)).toBe("Foo");
  });
});

describe("findJSXElementsByModuleName()", () => {
  it("finds JSX elements imported from a module", () => {
    const source = `import Foo from 'my-module';\nconst a = <Foo />;`;
    const root = j(source);
    const els = root.findJSXElementsByModuleName("my-module");
    expect(els.length).toBe(1);
  });

  it("returns empty for unmatched module", () => {
    const source = `import Foo from 'other';\nconst a = <Foo />;`;
    const root = j(source);
    const els = root.findJSXElementsByModuleName("my-module");
    expect(els.length).toBe(0);
  });
});
