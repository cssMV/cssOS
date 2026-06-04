#!/usr/bin/env node
/* CSSOS_WAVE_637 20260604 — 前端打包(让主界面"唰"一下显示).
 *
 * 问题: index.html 有 ~225 个【纯 eager <script src="app.*.js">】, 首屏 582 请求 / 16.7s。
 * 方案: 把【连续的纯 eager app.js 段】合并成几个 bundle, 请求数骤降。
 *
 * 铁律(安全第一, 整站一个包错了就崩):
 *   1. 只合并 `^<script src="app.X.js?v=...">` 这种【无任何其它属性】的标签。
 *      遇到 内联 / defer / async / type= / /i18n/ / 惰性 cssos-lazy / 注释 → 立即【断段】, 原位保留。
 *   2. 顺序绝对保持(按文档出现顺序拼接)。
 *   3. 压缩【只去空白+注释 + 安全语法化】, 【绝不重命名标识符】(--minify-identifiers 关), 否则
 *      跨文件全局名(funcA 在文件1声明、文件2调用)会对不上 → 崩。
 *   4. 每段拼完后 node 解析校验; 任何一段语法错 → 整个构建中止, 不产出。
 *
 * 用法: node scripts/bundle-frontend.mjs   → 生成 public/bundle.appNN.<ver>.js + 改写 public/index.html
 *      (会先把原 index.html 备份到 public/index.html.prebundle.bak)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PUB = path.resolve(process.cwd(), "public");
const HTML = path.join(PUB, "index.html");
const VER = "w637-" + new Date().toISOString().slice(0, 10).replace(/-/g, "");

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");

// 判定: 纯 eager app.js 标签(无其它属性)。
const PLAIN = /^\s*<script src="(app\.[^"?]+)(\?[^"]*)?"><\/script>\s*$/;

/** @type {{type:'bundle',files:string[],lineIdxs:number[]}|{type:'raw',line:string}[]} */
const out = [];
let seg = null; // 当前累积的 bundle 段

function flush() {
  if (seg && seg.files.length) out.push(seg);
  seg = null;
}

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(PLAIN);
  if (m) {
    const file = m[1]; // app.xxx.js
    const abs = path.join(PUB, file);
    if (fs.existsSync(abs)) {
      if (!seg) seg = { type: "bundle", files: [], firstLine: lines[i] };
      seg.files.push(file);
      continue;
    }
  }
  // 非纯 eager → 断段, 原样保留该行。
  flush();
  out.push({ type: "raw", line: lines[i] });
}
flush();

// 生成 bundle 文件 + 新行。
let bundleNo = 0;
const newLines = [];
let totalFiles = 0, totalSegs = 0;
for (const node of out) {
  if (node.type === "raw") { newLines.push(node.line); continue; }
  bundleNo++; totalSegs++; totalFiles += node.files.length;
  const concatParts = [];
  for (const f of node.files) {
    const src = fs.readFileSync(path.join(PUB, f), "utf8");
    // 每个文件用 ;\n 包裹边界, 防止上一文件末尾无分号导致 ASI 把两文件粘连出错。
    concatParts.push("\n;/* ==== " + f + " ==== */\n" + src + "\n;\n");
  }
  const concat = concatParts.join("");
  const rawPath = path.join(PUB, `bundle.app${bundleNo}.${VER}.raw.js`);
  const outPath = path.join(PUB, `bundle.app${bundleNo}.${VER}.js`);
  fs.writeFileSync(rawPath, concat);
  // 先校验拼接后的语法(node --check)。
  try {
    execFileSync(process.execPath, ["--check", rawPath], { stdio: "pipe" });
  } catch (e) {
    console.error(`\n❌ 段 ${bundleNo} 拼接后语法错误 (含文件: ${node.files.join(", ")}):\n`, String(e.stderr || e.message));
    process.exit(1);
  }
  // esbuild: 只压空白+语法, 关掉标识符重命名(保全局名)。
  execFileSync("npx", ["esbuild", rawPath,
    "--minify-whitespace", "--minify-syntax",
    "--legal-comments=none", "--charset=utf8",
    "--outfile=" + outPath], { stdio: "pipe" });
  // 再校验压缩产物。
  execFileSync(process.execPath, ["--check", outPath], { stdio: "pipe" });
  fs.unlinkSync(rawPath);
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`✓ bundle.app${bundleNo}.${VER}.js  ←  ${node.files.length} files  (${kb} KB)`);
  // 用首行的缩进 + 一个 bundle <script>。
  const indent = (node.firstLine.match(/^\s*/) || [""])[0];
  newLines.push(`${indent}<script src="bundle.app${bundleNo}.${VER}.js"></script>`);
}

// 备份 + 写回。
fs.copyFileSync(HTML, path.join(PUB, "index.html.prebundle.bak"));
fs.writeFileSync(HTML, newLines.join("\n"));
console.log(`\n✅ 完成: ${totalFiles} 个 app.js → ${totalSegs} 个 bundle。index.html 已改写(备份 index.html.prebundle.bak)。`);
