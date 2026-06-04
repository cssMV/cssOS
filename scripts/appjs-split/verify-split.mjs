#!/usr/bin/env node
/* CSSOS app.js 拆分 — Phase 0 安全校验器(只读, 不改 app.js)。
 *
 * 设计初衷(Jing「循序渐进, 不可鲁莽」): app.js 是 34k 行经典脚本, 854 个全局函数被全仓裸调。
 * 拆分的唯一安全前提 = 能【数学证明】行为不变。本工具提供两道证明 + 一个清单:
 *
 *   1) 字节级一致(--verify): 把"拆出的若干 part 文件"按【加载顺序】拼接, 必须和冻结的基线
 *      app.js.baseline 字节级完全相同(同 sha256、同长度)。相同 = 代码与顺序都没变。
 *
 *   2) 边界安全扫描(--scan): 经典脚本的函数声明【提升不跨文件】。唯一会因拆分而坏的情形 =
 *      某个【更早加载的 part】在【顶层执行】(IIFE / 顶层裸调用)时引用了【更晚 part 才定义】的
 *      函数/常量。扫描每个 part 的"顶层可执行语句"(列 0 的 IIFE 或裸调用), 标出风险边界 —
 *      安全的切法 = 只在"靠前的 part 无依赖靠后的顶层执行"处下刀。
 *
 *   3) 每刀的人工闸门(见 README): 部署 → iPhone 模拟器冒烟 → 一行回退。
 *
 * 用法:
 *   node verify-split.mjs --freeze <app.js>                  # 冻结当前 app.js 为基线(拆分前做一次)
 *   node verify-split.mjs --verify <parts-manifest.json>     # 证明 parts 拼接 == 基线
 *   node verify-split.mjs --scan <part1.js> <part2.js> ...   # 边界安全扫描(下刀前做)
 *
 * parts-manifest.json 形如(顺序 = index.html 里 <script> 的加载顺序):
 *   { "baseline": "public/app.js.baseline",
 *     "parts": ["public/app.core.js", "public/app.watch-builders.js", "public/app.tail.js"] }
 *
 * 退出码: 0 = 通过; 1 = 失败/有风险(CI 与人都能据此卡住)。 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }
function die(msg) { console.error("✗ " + msg); process.exit(1); }
function ok(msg) { console.log("✓ " + msg); }

const [, , mode, ...rest] = process.argv;

if (mode === "--freeze") {
  const src = rest[0] || "public/app.js";
  if (!existsSync(src)) die(`找不到 ${src}`);
  const buf = readFileSync(src);
  const out = src + ".baseline";
  writeFileSync(out, buf);
  ok(`已冻结基线: ${out}`);
  console.log(`  长度=${buf.length} 字节  sha256=${sha256(buf)}`);
  process.exit(0);
}

if (mode === "--verify") {
  const manifestPath = rest[0];
  if (!manifestPath || !existsSync(manifestPath)) die(`找不到 manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const baseline = readFileSync(manifest.baseline);
  // 严格拼接: 不插入任何字节(连换行都不加)。part 文件必须是原 app.js 的连续切片。
  const parts = manifest.parts.map((p) => {
    if (!existsSync(p)) die(`缺少 part 文件: ${p}`);
    return readFileSync(p);
  });
  const concat = Buffer.concat(parts);
  const bH = sha256(baseline), cH = sha256(concat);
  console.log(`基线: 长度=${baseline.length}  sha256=${bH}`);
  console.log(`拼接: 长度=${concat.length}  sha256=${cH}  (${parts.length} 个 part)`);
  if (bH === cH) { ok("字节级一致 — 拆分对行为【证明中性】(代码与顺序均未变)。"); process.exit(0); }
  // 找首个差异位置, 给出上下文, 方便定位"拼接时多/少了哪个字节"。
  const n = Math.min(baseline.length, concat.length);
  let i = 0; while (i < n && baseline[i] === concat[i]) i++;
  const ctx = (buf) => JSON.stringify(buf.slice(Math.max(0, i - 40), i + 40).toString("utf8"));
  console.error(`✗ 首个差异在字节偏移 ${i}（基线长 ${baseline.length} / 拼接长 ${concat.length}）`);
  console.error(`  基线上下文: ${ctx(baseline)}`);
  console.error(`  拼接上下文: ${ctx(concat)}`);
  console.error("  常见原因: part 切片边界多/少了字符, 或顺序写错。拼接必须严格无缝。");
  process.exit(1);
}

if (mode === "--scan") {
  // 边界安全扫描: 找每个 part 里【顶层可执行语句】(列0 起的 IIFE / 裸调用 / 顶层 await)。
  // 这些会在该 part 加载时立即执行; 若它们引用了更晚 part 才定义的符号, 拆分就会坏。
  // 安全切法: 让"含顶层执行的代码"集中在【最后一个 part】(app.tail), 其余 part 只含
  // function/const/let/class 声明(声明不立即执行, 运行时才被调, 那时全部 part 已加载)。
  const files = rest;
  if (!files.length) die("用法: --scan <part1.js> [part2.js ...]");
  let risky = 0;
  const topLevelExec = /^(?:\(|;|void |await |[A-Za-z_$][\w$]*\s*\()/; // 列0 的 IIFE/裸调用/await
  const declStart = /^(?:function |const |let |var |class |\/\/|\/\*|\*|export |import |\}|\)|\]|`)/;
  for (const f of files) {
    if (!existsSync(f)) die(`找不到 ${f}`);
    const lines = readFileSync(f, "utf8").split("\n");
    const hits = [];
    for (let k = 0; k < lines.length; k++) {
      const ln = lines[k];
      if (!ln || ln[0] === " " || ln[0] === "\t") continue;   // 只看列 0(顶层)
      if (declStart.test(ln)) continue;                        // 声明/注释/续行 — 安全
      if (topLevelExec.test(ln)) hits.push([k + 1, ln.slice(0, 80)]);
    }
    if (hits.length) {
      console.log(`⚠ ${f} — ${hits.length} 处顶层执行(必须确保不引用更晚 part 的符号):`);
      for (const [n, t] of hits.slice(0, 12)) console.log(`    L${n}: ${t}`);
      if (hits.length > 12) console.log(`    …还有 ${hits.length - 12} 处`);
      risky += hits.length;
    } else {
      ok(`${f} — 无顶层执行(纯声明文件, 拆分最安全)。`);
    }
  }
  console.log(`\n扫描结论: 共 ${risky} 处顶层执行。建议: 把这些集中到【最后加载的 part】, 其余 part 做成纯声明文件。`);
  process.exit(0); // 扫描是提示性的, 不强制失败 — 由人判断边界
}

die("未知模式。用法: --freeze <app.js> | --verify <manifest.json> | --scan <parts...>");
