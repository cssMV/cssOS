#!/usr/bin/env node
/**
 * P2-57c: English-as-Single-Source-of-Truth migration.
 *
 * Strips the second argument from every `loginCopy(en, zh)` call in the
 * frontend. The runtime shim already ignores the second argument, but
 * leaving hardcoded Chinese literals in source privileges one non-English
 * locale over the rest. After this pass every call site is `loginCopy(en)`.
 *
 * Usage:
 *   node scripts/migrate-loginCopy-drop-zh.mjs [--dry] [--only=PATTERN]
 *
 *   --dry         print rewrite counts but don't touch files
 *   --only=<sub>  restrict to files whose basename contains <sub>
 *
 * Safety:
 *   - AST-based via acorn (not regex) — respects template literals,
 *     nested calls, comments, and multi-line argument lists.
 *   - Only rewrites CallExpression where callee is the Identifier
 *     `loginCopy` with exactly 2 arguments. Function *declarations* like
 *     `function loginCopy(en, zh)` are left alone.
 *   - Skips this script itself plus anything outside /public.
 *   - Writes *.bak beside any file it modifies (one per run, timestamped).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");

const argv = new Set(process.argv.slice(2));
const DRY = argv.has("--dry");
const ONLY = [...argv]
  .map((a) => (a.startsWith("--only=") ? a.slice("--only=".length) : null))
  .filter(Boolean)[0];

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d+Z$/, "Z");

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip bundled third-party dirs and local caches
      if (
        entry.name === "node_modules" ||
        entry.name === "vendor" ||
        entry.name === "secure" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      out.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function findLoginCopyCalls(ast) {
  const hits = [];
  const stack = [ast];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "Identifier" &&
      node.callee.name === "loginCopy" &&
      Array.isArray(node.arguments) &&
      node.arguments.length === 2
    ) {
      hits.push(node);
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) if (item && typeof item === "object" && "type" in item) stack.push(item);
      } else if (typeof v === "object" && "type" in v) {
        stack.push(v);
      }
    }
  }
  return hits;
}

function rewriteOne(src) {
  let ast;
  try {
    ast = acorn.parse(src, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowReturnOutsideFunction: true,
      allowHashBang: true,
      locations: false,
      ranges: true,
    });
  } catch (e) {
    // fall back to module mode
    try {
      ast = acorn.parse(src, {
        ecmaVersion: "latest",
        sourceType: "module",
        allowReturnOutsideFunction: true,
        allowHashBang: true,
        locations: false,
        ranges: true,
      });
    } catch (e2) {
      throw new Error(`parse failed: ${e2.message}`);
    }
  }

  const calls = findLoginCopyCalls(ast);
  if (calls.length === 0) return { src, changes: 0 };

  // For each call, compute the delete range: from end of arg[0] to end of arg[1],
  // then extend to consume the trailing comma + whitespace between arg[0] and arg[1].
  // Simpler: delete from arg[0].end to arg[1].end.
  // Then, if there's a trailing comma right after arg[1] before `)`, we don't care —
  // acorn doesn't include the comma in arg[1].end, and we ARE including all chars
  // from arg[0].end (which is BEFORE the comma) through arg[1].end (which is AFTER
  // the arg2 literal). That deletes the `,<ws>arg2`. Perfect.
  //
  // Sort by end desc so earlier indexes stay valid.
  calls.sort((a, b) => b.range[0] - a.range[0]);

  let out = src;
  let changes = 0;
  for (const node of calls) {
    const a0 = node.arguments[0];
    const a1 = node.arguments[1];
    const delStart = a0.range[1]; // just after arg1
    const delEnd = a1.range[1]; // just after arg2
    // Sanity: the slice we delete must start with `,` (possibly preceded by WS).
    const slice = out.slice(delStart, delEnd);
    if (!/^\s*,/.test(slice)) {
      // Unexpected shape — skip to stay safe.
      continue;
    }
    out = out.slice(0, delStart) + out.slice(delEnd);
    changes += 1;
  }
  return { src: out, changes };
}

function shouldSkipFile(file) {
  const base = path.basename(file);
  if (base === "migrate-loginCopy-drop-zh.mjs") return true;
  if (base.startsWith("app.js.bak.")) return true;
  if (base.endsWith(".min.js")) return true;
  // runtime.js defines the i18n runtime itself — leave alone.
  if (file.endsWith(path.join("public", "i18n", "runtime.js"))) return true;
  return false;
}

function main() {
  const files = listJsFiles(publicDir).filter((f) => !shouldSkipFile(f));
  const filtered = ONLY ? files.filter((f) => path.basename(f).includes(ONLY)) : files;

  let totalChanges = 0;
  let touched = 0;
  const perFile = [];

  for (const file of filtered) {
    let src;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch (e) {
      console.error(`[skip read ${file}] ${e.message}`);
      continue;
    }
    if (!src.includes("loginCopy")) continue;

    let result;
    try {
      result = rewriteOne(src);
    } catch (e) {
      console.error(`[skip ${file}] ${e.message}`);
      continue;
    }
    if (result.changes === 0) continue;

    totalChanges += result.changes;
    touched += 1;
    perFile.push({ file, changes: result.changes });

    if (!DRY) {
      const bak = `${file}.bak.${stamp}`;
      fs.writeFileSync(bak, src);
      fs.writeFileSync(file, result.src);
    }
  }

  perFile.sort((a, b) => b.changes - a.changes);
  for (const row of perFile) {
    const rel = path.relative(repoRoot, row.file);
    console.log(`${row.changes.toString().padStart(4)}  ${rel}`);
  }
  console.log("---");
  console.log(`${totalChanges} rewrites across ${touched} files${DRY ? " (DRY — no writes)" : ""}`);
}

main();
