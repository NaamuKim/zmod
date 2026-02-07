import { describe, expect, it } from "vitest";
import { transform, transformFile } from "../src/index";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";

describe("transform", () => {
  it("renames a matching identifier", () => {
    const result = transform("const foo = 1;", { from: "foo", to: "bar" });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.output).toContain("bar");
    expect(result.output).not.toContain("foo");
  });

  it("returns modified: false when no match", () => {
    const result = transform("const foo = 1;", { from: "baz", to: "qux" });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(false);
    expect(result.output).toBeUndefined();
  });

  it("does not rename partial matches inside longer identifiers", () => {
    const result = transform("const fooBar = 1;", { from: "foo", to: "baz" });

    // native: AST-level exact match. fallback: \bfoo\b won't match fooBar either.
    expect(result.modified).toBe(false);
  });

  it("renames multiple occurrences", () => {
    const code = "const x = foo + foo;";
    const result = transform(code, { from: "foo", to: "bar" });

    expect(result.modified).toBe(true);
    expect(result.output!.match(/bar/g)?.length).toBe(2);
    expect(result.output).not.toContain("foo");
  });
});

describe("transformFile", () => {
  const tmpFile = join(__dirname, "__tmp_test__.ts");

  it("writes transformed content to file", async () => {
    await writeFile(tmpFile, "const foo = 1;", "utf-8");

    const result = await transformFile(tmpFile, { from: "foo", to: "bar" });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toContain("bar");
    expect(content).not.toContain("foo");

    await unlink(tmpFile);
  });

  it("does not write when nothing changed", async () => {
    await writeFile(tmpFile, "const foo = 1;", "utf-8");

    const result = await transformFile(tmpFile, { from: "baz", to: "qux" });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(false);

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toBe("const foo = 1;");

    await unlink(tmpFile);
  });

  it("returns error for non-existent file", async () => {
    const result = await transformFile("/tmp/__does_not_exist__.ts", {
      from: "a",
      to: "b",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
