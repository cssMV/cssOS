#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/cssos/current";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function hasHumanText(s) {
  const t = s.trim();
  if (!t) return false;
  if (/^[0-9\s.,:%+$()_\-/*|]+$/.test(t)) return false;
  return /[A-Za-z\u4e00-\u9fff]/.test(t);
}

function extractLines(block, baseLine) {
  return block.split(/\r?\n/).map((line, idx) => ({ line, no: baseLine + idx }));
}

function findBlock(content, startMark, endMark) {
  const start = content.indexOf(startMark);
  if (start < 0) return null;
  const end = content.indexOf(endMark, start);
  if (end < 0) return null;
  return { start, end: end + endMark.length, text: content.slice(start, end + endMark.length) };
}

function lineNoFromIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const findings = [];

const indexHtml = read("public/index.html");
const worksPanel = findBlock(
  indexHtml,
  '<section class="panel flow hidden" id="works-panel">',
  '<div class="resize-handle"></div>\n      </section>'
);
if (!worksPanel) {
  findings.push({ file: "public/index.html", line: 1, msg: "works-panel block not found" });
} else {
  const baseLine = lineNoFromIndex(indexHtml, worksPanel.start);
  const allowText = ["Neon Aria", "Pulse Runner", "Echo District", "2/4", "12.6k/20k", "5/8"];

  for (const { line, no } of extractLines(worksPanel.text, baseLine)) {
    if (line.includes("data-i18n") || line.includes("data-i18n-placeholder")) continue;
    const chunks = line.match(/>([^<]+)</g) || [];
    for (const chunk of chunks) {
      const text = chunk.slice(1, -1).trim();
      if (!hasHumanText(text)) continue;
      if (allowText.includes(text)) continue;
      findings.push({ file: "public/index.html", line: no, msg: text });
    }
  }
}

const appJs = read("public/app.js");
const forceFn = findBlock(appJs, "function forceWorksPanelNeo()", "}\n\nforceWorksPanelNeo();");
if (!forceFn) {
  findings.push({ file: "public/app.js", line: 1, msg: "forceWorksPanelNeo block not found" });
} else {
  const baseLine = lineNoFromIndex(appJs, forceFn.start);
  const allowText = ["Neon Aria", "Pulse Runner", "Echo District", "2/4", "12.6k/20k", "5/8"];

  for (const { line, no } of extractLines(forceFn.text, baseLine)) {
    if (line.includes("data-i18n") || line.includes("data-i18n-placeholder")) continue;
    const chunks = line.match(/>([^<]+)</g) || [];
    for (const chunk of chunks) {
      const text = chunk.slice(1, -1).trim();
      if (!hasHumanText(text)) continue;
      if (allowText.includes(text)) continue;
      findings.push({ file: "public/app.js", line: no, msg: text });
    }
  }
}

if (findings.length) {
  console.error("i18n check failed for works panel. Non-i18n strings found:");
  for (const f of findings) console.error(`- ${f.file}:${f.line} ${f.msg}`);
  process.exit(1);
}

console.log("i18n check passed for works panel.");
