#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { glob } from "tinyglobby";
import { execa } from "execa";
import * as p from "@clack/prompts";
import { defineCommand, runMain } from "citty";
import { transformFile } from "./transform.js";

function detectPackageManager(): string {
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  return "npm";
}

async function installZmod(): Promise<void> {
  const pm = detectPackageManager();
  const addCmd: Record<string, string[]> = {
    npm: ["npm", "install", "zmod"],
    yarn: ["yarn", "add", "zmod"],
    pnpm: ["pnpm", "add", "zmod"],
  };

  const s = p.spinner();
  s.start(`Installing zmod via ${pm}`);
  await execa(addCmd[pm][0], addCmd[pm].slice(1));
  s.stop("zmod installed");
}

const main = defineCommand({
  meta: {
    name: "@zmod/migrate",
    description: "Migrate jscodeshift codemods to zmod",
  },
  args: {
    pattern: {
      type: "positional",
      description: "Glob pattern of files to migrate",
      required: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would change without writing files",
      default: false,
    },
    "skip-install": {
      type: "boolean",
      description: "Skip installing zmod after migration",
      default: false,
    },
  },
  async run({ args }) {
    const dryRun = args["dry-run"];
    const skipInstall = args["skip-install"];

    p.intro("@zmod/migrate");

    let pattern = args.pattern as string | undefined;
    if (!pattern) {
      const input = await p.text({
        message: "Which files do you want to migrate?",
        placeholder: "codemods/**/*.ts",
        validate: (v) => (!v ? "Please enter a glob pattern" : undefined),
      });
      if (p.isCancel(input)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }
      pattern = input;
    }

    const files = await glob([pattern], { absolute: true });

    if (files.length === 0) {
      p.outro("No files matched the pattern.");
      process.exit(0);
    }

    if (dryRun) {
      p.note("No files will be written", "Dry run");
    }

    const s = p.spinner();
    s.start(`Scanning ${files.length} file(s)...`);

    const toTransform: { file: string; result: string }[] = [];
    let skipped = 0;

    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      const result = transformFile(source);
      if (result === null) {
        skipped++;
      } else {
        toTransform.push({ file, result });
      }
    }

    s.stop(`Found ${toTransform.length} file(s) to migrate, ${skipped} skipped`);

    if (toTransform.length === 0) {
      p.outro("Nothing to migrate. Are these already zmod codemods?");
      process.exit(0);
    }

    if (dryRun) {
      p.note(toTransform.map((t) => `  ${t.file}`).join("\n"), "Would transform");
      p.outro(`Dry run complete. ${toTransform.length} file(s) would be transformed.`);
      process.exit(0);
    }

    for (const { file, result } of toTransform) {
      writeFileSync(file, result, "utf-8");
      p.log.success(file);
    }

    if (!skipInstall) {
      await installZmod();
    }

    p.outro(`Done! ${toTransform.length} file(s) migrated.`);
  },
});

runMain(main);
