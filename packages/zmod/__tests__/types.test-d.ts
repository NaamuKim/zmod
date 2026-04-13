import { expectTypeOf, test } from "vitest";
import type { namedTypes } from "ast-types";
import type { Type } from "ast-types/lib/types";
import { z } from "../src/jscodeshift.js";

test("z.ImportDeclaration is Type<namedTypes.ImportDeclaration>", () => {
  expectTypeOf(z.ImportDeclaration).toEqualTypeOf<Type<namedTypes.ImportDeclaration>>();
});
