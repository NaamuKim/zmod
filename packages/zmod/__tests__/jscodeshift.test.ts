import { describe, expect, it } from "vitest";
import { j } from "../src/jscodeshift";

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
      // Return the callee identifier path-like object
      const callee = path.node.callee;
      return {
        node: callee,
        parent: path,
        parentKey: "callee",
        parentIndex: null,
        value: callee,
        parentPath: path,
        name: "callee",
      };
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
