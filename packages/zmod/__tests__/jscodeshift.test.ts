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
