#!/usr/bin/env node
// CSSOS_PHASE2_I18N_MVP 20260418 — migration scanner.
//
// Scans public/*.js for `loginCopy("English", "中文")` call sites and emits a
// report that lists every occurrence plus a suggested `tr("English")`
// replacement. This is NOT a code-rewriter — it is a triage tool so humans
// can review each call before flipping it to the new runtime i18n path.
//
// Output: JSON on stdout, plus a human-readable summary on stderr. Usage:
//   node scripts/scan_login_copy_for_i18n_migration.mjs [--root=public]
//
// The output JSON shape:
//   { totals: { files, calls, uniqueEnglish, withZh, withoutZh },
//     duplicates: { "English text": [ "file:line", ... ] },
//     byFile: { "public/app.watch-ui.js": [ {line, en, zh, suggestion}, ... ] }
//   }
//
// Why separate from auto-rewrite: some callers pre-compute `en`/`zh` from
// variables (`loginCopy(nickname, nickname_zh)`) — those must NOT be rewritten
// blindly. The scanner flags `dynamic: true` for those and the human chooses.

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const rootArg = args.find((a) => a.startsWith("--root="));
const root = rootArg
  ? rootArg.slice("--root=".length)
  : path.resolve(process.cwd(), "public");

async function walkJs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "generated") continue;
      out.push(...(await walkJs(full)));
    } else if (entry.isFile() && full.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

// Parse a single `loginCopy(...)` call. We handle single and double quoted
// string literals and tolerate escaped quotes and backslashes. If we hit a
// non-string argument we mark the call as `dynamic`.
function parseCall(source, startIdx) {
  // startIdx points at the '(' just after `loginCopy`.
  let i = startIdx + 1;
  const args = [];
  let depth = 0;
  let currentDynamic = false;
  let currentString = null;
  let currentQuote = null;
  let readingArg = true;

  while (i < source.length) {
    const ch = source[i];
    if (currentString != null && currentQuote != null) {
      if (ch === "\\") {
        currentString += source[i + 1] || "";
        i += 2;
        continue;
      }
      if (ch === currentQuote) {
        args.push({ value: currentString, dynamic: false });
        currentString = null;
        currentQuote = null;
        readingArg = false;
        i++;
        continue;
      }
      currentString += ch;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      currentString = "";
      currentQuote = ch;
      readingArg = true;
      i++;
      continue;
    }
    if (ch === "(") { depth++; i++; continue; }
    if (ch === ")") {
      if (depth === 0) {
        if (readingArg && currentDynamic) {
          args.push({ value: null, dynamic: true });
        }
        return { args, end: i + 1 };
      }
      depth--;
      i++;
      continue;
    }
    if (ch === "," && depth === 0) {
      if (readingArg && currentDynamic && currentString == null) {
        args.push({ value: null, dynamic: true });
      }
      readingArg = true;
      currentDynamic = false;
      i++;
      continue;
    }
    if (/\S/.test(ch)) {
      currentDynamic = true;
    }
    i++;
  }
  return { args, end: i };
}

function lineColFromIndex(source, idx) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx && i < source.length; i++) {
    if (source[i] === "\n") { line++; col = 1; } else { col++; }
  }
  return { line, col };
}

function scanFile(source) {
  const calls = [];
  const re = /\bloginCopy\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    const parenIdx = m.index + m[0].length - 1;
    const parsed = parseCall(source, parenIdx);
    const { line } = lineColFromIndex(source, m.index);
    const en = parsed.args[0];
    const zh = parsed.args[1];
    calls.push({
      line,
      raw: source.slice(m.index, Math.min(parsed.end, m.index + 160)),
      en: en && !en.dynamic ? en.value : null,
      zh: zh && !zh.dynamic ? zh.value : null,
      dynamic: (en && en.dynamic) || (zh && zh.dynamic) || false
    });
    re.lastIndex = parsed.end;
  }
  return calls;
}

function suggestionFor(call) {
  if (call.dynamic) return null;
  if (!call.en) return null;
  const englishQuoted = JSON.stringify(call.en);
  return "tr(" + englishQuoted + ")";
}

async function main() {
  const stats = await fs.stat(root).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    process.stderr.write("scan root not found: " + root + "\n");
    process.exit(1);
  }
  const files = await walkJs(root);
  files.sort();

  const byFile = {};
  const dedup = new Map();
  let totalCalls = 0;
  let totalWithZh = 0;
  let totalWithoutZh = 0;
  let totalDynamic = 0;

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    if (!source.includes("loginCopy")) continue;
    const calls = scanFile(source);
    if (!calls.length) continue;
    const rel = path.relative(process.cwd(), file);
    const entries = [];
    for (const call of calls) {
      const suggestion = suggestionFor(call);
      entries.push({
        line: call.line,
        en: call.en,
        zh: call.zh,
        dynamic: call.dynamic,
        suggestion
      });
      totalCalls++;
      if (call.dynamic) totalDynamic++;
      else if (call.zh) totalWithZh++;
      else totalWithoutZh++;
      if (call.en && !call.dynamic) {
        if (!dedup.has(call.en)) dedup.set(call.en, []);
        dedup.get(call.en).push(rel + ":" + call.line);
      }
    }
    byFile[rel] = entries;
  }

  const duplicates = {};
  for (const [en, sites] of dedup.entries()) {
    if (sites.length > 1) duplicates[en] = sites;
  }

  const report = {
    totals: {
      files: Object.keys(byFile).length,
      calls: totalCalls,
      uniqueEnglish: dedup.size,
      withZh: totalWithZh,
      withoutZh: totalWithoutZh,
      dynamic: totalDynamic
    },
    duplicates,
    byFile
  };

  process.stderr.write(
    "[loginCopy scan] files=" + report.totals.files +
    " calls=" + report.totals.calls +
    " uniqueEnglish=" + report.totals.uniqueEnglish +
    " withZh=" + report.totals.withZh +
    " withoutZh=" + report.totals.withoutZh +
    " dynamic=" + report.totals.dynamic + "\n"
  );
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write("scan failed: " + e.message + "\n");
  process.exit(2);
});
