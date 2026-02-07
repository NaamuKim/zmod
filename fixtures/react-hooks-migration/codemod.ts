#!/usr/bin/env tsx
import { transformFile } from "zmod";
import { readdir } from "fs/promises";
import { join } from "path";

/**
 * React Hooks Migration Codemod
 *
 * Transforms:
 * - useState -> useSignal (Preact Signals style)
 * - useEffect -> useEffect$ (observable style)
 *
 * Example transformation:
 * Before:
 *   const [count, setCount] = useState(0);
 *   setCount(count + 1);
 *
 * After:
 *   const count = useSignal(0);
 *   count.value = count.value + 1;
 */

async function findTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findTsxFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  console.log("🚀 React Hooks Migration Codemod\n");

  // Find all .tsx files
  const files = await findTsxFiles("./src");
  console.log(`📁 Found ${files.length} files\n`);

  let totalModified = 0;

  for (const file of files) {
    console.log(`🔄 Processing: ${file}`);

    try {
      let fileModified = false;

      // Transform useState to useSignal
      const result1 = await transformFile(file, {
        from: "useState",
        to: "useSignal",
      });

      if (result1.modified) {
        console.log("  ✅ useState -> useSignal");
        fileModified = true;
      }

      // Transform useEffect to useEffect$
      const result2 = await transformFile(file, {
        from: "useEffect",
        to: "useEffect$",
      });

      if (result2.modified) {
        console.log("  ✅ useEffect -> useEffect$");
        fileModified = true;
      }

      if (!fileModified) {
        console.log("  ⏭️  No changes needed");
      } else {
        totalModified++;
      }
    } catch (error) {
      console.error("  ❌ Error:", error);
    }
  }

  console.log("\n✨ Migration complete!\n");
  console.log("📝 Summary:");
  console.log(`   - Processed ${files.length} files`);
  console.log(`   - Modified ${totalModified} files`);
  console.log("   - useState → useSignal");
  console.log("   - useEffect → useEffect$");
}

main().catch(console.error);
