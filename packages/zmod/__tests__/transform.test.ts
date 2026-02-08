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
