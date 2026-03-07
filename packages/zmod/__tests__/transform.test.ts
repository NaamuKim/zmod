import { describe, expect, it } from "vitest";
import { transform, transformFile, zmod } from "../src/index";
import { writeFile, readFile, unlink, mkdir, rm } from "fs/promises";
import { join } from "path";

describe("transform", () => {
  it("renames a matching identifier", () => {
    const result = transform("const foo = 1;", { renames: { foo: "bar" } });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("bar");
    expect(result.output).not.toContain("foo");
  });

  it("returns modified: false when no match", () => {
    const result = transform("const foo = 1;", { renames: { baz: "qux" } });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(false);
    expect(result.output).toBeUndefined();
  });

  it("does not rename partial matches inside longer identifiers", () => {
    const result = transform("const fooBar = 1;", { renames: { foo: "baz" } });

    // native: AST-level exact match. fallback: \bfoo\b won't match fooBar either.
    expect(result.modified).toBe(false);
  });

  it("renames multiple occurrences", () => {
    const code = "const x = foo + foo;";
    const result = transform(code, { renames: { foo: "bar" } });

    expect(result.modified).toBe(true);
    expect(result.output!.match(/bar/g)?.length).toBe(2);
    expect(result.output).not.toContain("foo");
  });

  it("batch renames multiple identifiers in one call", () => {
    const code = "const x = foo + bar;";
    const result = transform(code, { renames: { foo: "aaa", bar: "bbb" } });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("aaa");
    expect(result.output).toContain("bbb");
    expect(result.output).not.toContain("foo");
    expect(result.output).not.toContain("bar");
  });
});

describe("imports.replaceSource", () => {
  it("replaces import source string", () => {
    const code = `import { act } from "react-dom/test-utils";`;
    const result = transform(code, {
      imports: { replaceSource: { "react-dom/test-utils": "react" } },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain('"react"');
    expect(result.output).not.toContain("react-dom/test-utils");
    expect(result.output).toContain("act");
  });

  it("does not touch non-matching import sources", () => {
    const code = `import { useState } from "react";`;
    const result = transform(code, {
      imports: { replaceSource: { "react-dom/test-utils": "react" } },
    });

    expect(result.modified).toBe(false);
  });
});

describe("imports.renameSpecifier", () => {
  it("renames a named import specifier", () => {
    const code = `import { useFormState } from "react-dom";`;
    const result = transform(code, {
      imports: { renameSpecifier: { useFormState: "useActionState" } },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("useActionState");
    expect(result.output).not.toContain("useFormState");
  });

  it("renames only the local part of an aliased import", () => {
    const code = `import { foo as bar } from "x";`;
    const result = transform(code, {
      imports: { renameSpecifier: { bar: "baz" } },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("foo as baz");
  });

  it("renames combined with replaceSource", () => {
    const code = `import { act } from "react-dom/test-utils";`;
    const result = transform(code, {
      imports: {
        replaceSource: { "react-dom/test-utils": "react" },
        renameSpecifier: { act: "act" },
      },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain('"react"');
    expect(result.output).toContain("act");
  });
});

describe("imports.removeSpecifier", () => {
  it("removes a named import specifier from multi-specifier import", () => {
    const code = `import { useState, act, useEffect } from "react";`;
    const result = transform(code, {
      imports: { removeSpecifier: ["act"] },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("useState");
    expect(result.output).toContain("useEffect");
    // Check that "act" is not present as a specifier (but "react" still contains "act" substring)
    expect(result.output).toMatch(/\{[^}]*useState[^}]*useEffect[^}]*\}/);
    expect(result.output).not.toMatch(/\bact\b\s*[,}]/);
  });

  it("removes entire import when all specifiers removed", () => {
    const code = `import { act } from "react";\nconst x = 1;`;
    const result = transform(code, {
      imports: { removeSpecifier: ["act"] },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).not.toContain("import");
    expect(result.output).toContain("const x = 1;");
  });
});

describe("imports.addImport", () => {
  it("adds a named import at top of file", () => {
    const code = `const x = 1;`;
    const result = transform(code, {
      imports: { addImport: [{ from: "react", names: ["useState"] }] },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain('import { useState } from "react"');
    expect(result.output).toContain("const x = 1;");
  });

  it("adds a default import", () => {
    const code = `const x = 1;`;
    const result = transform(code, {
      imports: { addImport: [{ from: "prop-types", defaultName: "PropTypes" }] },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain('import PropTypes from "prop-types"');
  });

  it("adds a default + named import", () => {
    const code = `const x = 1;`;
    const result = transform(code, {
      imports: {
        addImport: [{ from: "react", defaultName: "React", names: ["useState"] }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain('import React, { useState } from "react"');
  });
});

describe("removeJsxMemberSuffix", () => {
  it("removes .Provider from JSX member expression", () => {
    const code = `const el = <Context.Provider value={1}><Child /></Context.Provider>;`;
    const result = transform(code, {
      removeJsxMemberSuffix: ["Provider"],
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("<Context value={1}>");
    expect(result.output).toContain("</Context>");
    expect(result.output).not.toContain("Provider");
  });

  it("does not touch non-matching suffixes", () => {
    const code = `const el = <Ctx.Consumer />;`;
    const result = transform(code, {
      removeJsxMemberSuffix: ["Provider"],
    });

    expect(result.modified).toBe(false);
  });
});

describe("replaceText", () => {
  it("replaces static member expression (React.PropTypes → PropTypes)", () => {
    const code = `const types = React.PropTypes.string;`;
    const result = transform(code, {
      replaceText: [{ matchText: "React.PropTypes", replace: "PropTypes" }],
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("PropTypes.string");
    expect(result.output).not.toContain("React.PropTypes");
  });
});

describe("combined transforms", () => {
  it("renames + imports.renameSpecifier in one call", () => {
    const code = `import { useFormState } from "react-dom";\nconst [state] = useFormState(action);`;
    const result = transform(code, {
      renames: { useFormState: "useActionState" },
      imports: { renameSpecifier: { useFormState: "useActionState" } },
    });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).not.toContain("useFormState");
    expect(result.output).toContain("useActionState");
    // Should have renamed both import specifier and usage
    expect(result.output).toContain('import { useActionState } from "react-dom"');
  });
});

describe("transformFile", () => {
  const tmpFile = join(__dirname, "__tmp_test__.ts");

  it("writes transformed content to file", async () => {
    await writeFile(tmpFile, "const foo = 1;", "utf-8");

    const result = await transformFile(tmpFile, { renames: { foo: "bar" } });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toContain("bar");
    expect(content).not.toContain("foo");

    await unlink(tmpFile);
  });

  it("does not write when nothing changed", async () => {
    await writeFile(tmpFile, "const foo = 1;", "utf-8");

    const result = await transformFile(tmpFile, { renames: { baz: "qux" } });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(false);

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toBe("const foo = 1;");

    await unlink(tmpFile);
  });

  it("returns error for non-existent file", async () => {
    const result = await transformFile("/tmp/__does_not_exist__.ts", {
      renames: { a: "b" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("zmod", () => {
  const tmpDir = join(__dirname, "__tmp_zmod__");

  it("globs files and batch-renames identifiers", async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, "a.tsx"), "const foo = bar;", "utf-8");
    await writeFile(join(tmpDir, "b.tsx"), "const foo = 1;", "utf-8");

    const result = await zmod({
      include: join(tmpDir, "*.tsx"),
      renames: { foo: "renamed" },
    });

    expect(result.files.length).toBe(2);
    for (const f of result.files) {
      expect(f.success).toBe(true);
      expect(f.modified).toBe(true);
    }

    const contentA = await readFile(join(tmpDir, "a.tsx"), "utf-8");
    expect(contentA).toContain("renamed");
    expect(contentA).not.toContain("foo");

    const contentB = await readFile(join(tmpDir, "b.tsx"), "utf-8");
    expect(contentB).toContain("renamed");
    expect(contentB).not.toContain("foo");

    await rm(tmpDir, { recursive: true });
  });
});
