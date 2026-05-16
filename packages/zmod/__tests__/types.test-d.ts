import { describe, expectTypeOf, test } from "vitest";
import type { namedTypes } from "ast-types";
import type { Type } from "ast-types/lib/types";
import {
  z,
  Collection,
  FilteredCollection,
  NodePath,
  type ZFunction,
  type JSCodeshift,
  type ASTNode,
  type Transform,
} from "../src/jscodeshift.js";
import type { ParseOptions } from "../src/parser.js";

// ── z callable ─────────────────────────────────────────────────────────

describe("z callable", () => {
  test("z(source) returns Collection", () => {
    expectTypeOf(z).parameter(0).toBeString();
    expectTypeOf(z("")).toEqualTypeOf<Collection>();
  });

  test("z(source, options) accepts ParseOptions", () => {
    expectTypeOf(z).parameter(1).toEqualTypeOf<ParseOptions | undefined>();
  });
});

// ── NamedTypes on z ────────────────────────────────────────────────────

describe("namedTypes on z", () => {
  test("z.ImportDeclaration is Type<namedTypes.ImportDeclaration>", () => {
    expectTypeOf(z.ImportDeclaration).toEqualTypeOf<Type<namedTypes.ImportDeclaration>>();
  });

  test("z.CallExpression is Type<namedTypes.CallExpression>", () => {
    expectTypeOf(z.CallExpression).toEqualTypeOf<Type<namedTypes.CallExpression>>();
  });

  test("z.Identifier is Type<namedTypes.Identifier>", () => {
    expectTypeOf(z.Identifier).toEqualTypeOf<Type<namedTypes.Identifier>>();
  });

  test("z.VariableDeclaration is Type<namedTypes.VariableDeclaration>", () => {
    expectTypeOf(z.VariableDeclaration).toEqualTypeOf<Type<namedTypes.VariableDeclaration>>();
  });

  test("z.ArrowFunctionExpression is Type<namedTypes.ArrowFunctionExpression>", () => {
    expectTypeOf(z.ArrowFunctionExpression).toEqualTypeOf<
      Type<namedTypes.ArrowFunctionExpression>
    >();
  });
});

// ── Builders on z ──────────────────────────────────────────────────────

describe("builders on z", () => {
  test("z.identifier returns namedTypes.Identifier", () => {
    expectTypeOf(z.identifier).returns.toEqualTypeOf<namedTypes.Identifier>();
  });

  test("z.callExpression returns namedTypes.CallExpression", () => {
    expectTypeOf(z.callExpression).returns.toEqualTypeOf<namedTypes.CallExpression>();
  });

  test("z.memberExpression returns namedTypes.MemberExpression", () => {
    expectTypeOf(z.memberExpression).returns.toEqualTypeOf<namedTypes.MemberExpression>();
  });

  test("z.variableDeclaration returns namedTypes.VariableDeclaration", () => {
    expectTypeOf(z.variableDeclaration).returns.toEqualTypeOf<namedTypes.VariableDeclaration>();
  });

  test("z.importDeclaration returns namedTypes.ImportDeclaration", () => {
    expectTypeOf(z.importDeclaration).returns.toEqualTypeOf<namedTypes.ImportDeclaration>();
  });
});

// ── Core API methods ───────────────────────────────────────────────────

describe("core API methods", () => {
  test("z.withParser returns ZFunction", () => {
    expectTypeOf(z.withParser).returns.toEqualTypeOf<ZFunction>();
  });

  test("z.match returns boolean", () => {
    expectTypeOf(z.match).returns.toBeBoolean();
  });

  test("z.print returns string", () => {
    expectTypeOf(z.print).returns.toBeString();
  });

  test("z.types is typeof namedTypes", () => {
    expectTypeOf(z.types).toEqualTypeOf<typeof namedTypes>();
  });
});

// ── Collection ─────────────────────────────────────────────────────────

describe("Collection", () => {
  test("toSource returns string", () => {
    expectTypeOf<Collection["toSource"]>().returns.toBeString();
  });

  test("find returns FilteredCollection", () => {
    expectTypeOf<Collection["find"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("findVariableDeclarators returns FilteredCollection", () => {
    expectTypeOf<
      Collection["findVariableDeclarators"]
    >().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("findJSXElements returns FilteredCollection", () => {
    expectTypeOf<Collection["findJSXElements"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("paths is NodePath[]", () => {
    expectTypeOf<Collection["paths"]>().toEqualTypeOf<NodePath[]>();
  });

  test("source is string", () => {
    expectTypeOf<Collection["source"]>().toBeString();
  });

  test("program is ASTNode", () => {
    expectTypeOf<Collection["program"]>().toEqualTypeOf<ASTNode>();
  });
});

// ── FilteredCollection ─────────────────────────────────────────────────

describe("FilteredCollection", () => {
  test("length is number", () => {
    expectTypeOf<FilteredCollection["length"]>().toBeNumber();
  });

  test("forEach returns this", () => {
    expectTypeOf<FilteredCollection["forEach"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("filter returns FilteredCollection", () => {
    expectTypeOf<FilteredCollection["filter"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("find returns FilteredCollection", () => {
    expectTypeOf<FilteredCollection["find"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("replaceWith returns this", () => {
    expectTypeOf<FilteredCollection["replaceWith"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("remove returns this", () => {
    expectTypeOf<FilteredCollection["remove"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("insertBefore returns this", () => {
    expectTypeOf<FilteredCollection["insertBefore"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("insertAfter returns this", () => {
    expectTypeOf<FilteredCollection["insertAfter"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("closest returns FilteredCollection", () => {
    expectTypeOf<FilteredCollection["closest"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("closestScope returns FilteredCollection", () => {
    expectTypeOf<FilteredCollection["closestScope"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("at returns NodePath | undefined", () => {
    expectTypeOf<FilteredCollection["at"]>().returns.toEqualTypeOf<NodePath | undefined>();
  });

  test("nodes returns ASTNode[]", () => {
    expectTypeOf<FilteredCollection["nodes"]>().returns.toEqualTypeOf<ASTNode[]>();
  });

  test("size returns number", () => {
    expectTypeOf<FilteredCollection["size"]>().returns.toBeNumber();
  });

  test("some returns boolean", () => {
    expectTypeOf<FilteredCollection["some"]>().returns.toBeBoolean();
  });

  test("every returns boolean", () => {
    expectTypeOf<FilteredCollection["every"]>().returns.toBeBoolean();
  });

  test("toSource returns string", () => {
    expectTypeOf<FilteredCollection["toSource"]>().returns.toBeString();
  });

  test("renameTo returns this", () => {
    expectTypeOf<FilteredCollection["renameTo"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("map returns FilteredCollection", () => {
    expectTypeOf<FilteredCollection["map"]>().returns.toEqualTypeOf<FilteredCollection>();
  });

  test("getTypes returns string[]", () => {
    expectTypeOf<FilteredCollection["getTypes"]>().returns.toEqualTypeOf<string[]>();
  });

  test("isOfType returns boolean", () => {
    expectTypeOf<FilteredCollection["isOfType"]>().returns.toBeBoolean();
  });
});

// ── NodePath ───────────────────────────────────────────────────────────

describe("NodePath", () => {
  test("node is ASTNode", () => {
    expectTypeOf<NodePath["node"]>().toEqualTypeOf<ASTNode>();
  });

  test("parent is NodePath | null", () => {
    expectTypeOf<NodePath["parent"]>().toEqualTypeOf<NodePath | null>();
  });

  test("value aliases node", () => {
    expectTypeOf<NodePath["value"]>().toEqualTypeOf<ASTNode>();
  });

  test("parentPath aliases parent", () => {
    expectTypeOf<NodePath["parentPath"]>().toEqualTypeOf<NodePath | null>();
  });

  test("name is string | null", () => {
    expectTypeOf<NodePath["name"]>().toEqualTypeOf<string | null>();
  });
});

// ── JSCodeshift is ZFunction ───────────────────────────────────────────

describe("JSCodeshift alias", () => {
  test("JSCodeshift equals ZFunction", () => {
    expectTypeOf<JSCodeshift>().toEqualTypeOf<ZFunction>();
  });
});

// ── Transform ──────────────────────────────────────────────────────────

describe("Transform", () => {
  test("Transform returns string | null | undefined", () => {
    expectTypeOf<Transform>().returns.toEqualTypeOf<string | null | undefined>();
  });

  test("Transform receives fileInfo and api", () => {
    expectTypeOf<Transform>().parameter(0).toEqualTypeOf<{
      source: string;
      path: string;
    }>();
  });
});
