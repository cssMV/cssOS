#!/usr/bin/env node
/* W2273 — 证明【语言标签两半必须一起改】, 只改一半字幕当场哑掉。
 *
 * 两半是:
 *   ① 播放端问字幕要哪种语言 —— 来自轨的 lang。无语言轨时是伪轨,
 *      由 `String(w.language || "orig")` 兜出来(src/index.ts 的 language-tracks 端点)。
 *   ② 字幕文件自己 languages[].lang 的标签。
 * 两边对不上 → W1961 严格匹配返回 null, 整首哑掉, 不报错不降级。
 *
 * 判据不自己复述: 直接从 public/app.emotion-subtitle-engine.js 抽出
 * 【模块体到 subtitleJsonToCues 结束】那一整段原文来跑 —— 连它依赖的
 * EMO_MAP / mapEmotion 都是文件里那一份, 不打桩(抄一份就是造一份, W1960)。
 *
 * 四条用例里, 第 2 条「只改字幕文件」就是这份测试自己的校准:
 * 它必须判成【无字幕】。那一条过了, 才证明这份测试真能看出哑掉。
 *
 * 用法: node scripts/test-subtitle-label-match.mjs <workId> [<新标签, 默认 zh>]
 *   改前那份原件从 w2265 的 R2 备份取(artifacts/audit/w2265/<id>--<键>),
 *   所以只能用在 w2265-fix-language-labels.py 真的改过的作品上。
 */
import fs from "node:fs";
import path from "node:path";

const WORK = process.argv[2];
const NEWTAG = process.argv[3] || "zh";
if (!/^[0-9a-f-]{36}$/i.test(String(WORK || ""))) {
  console.log("用法: node scripts/test-subtitle-label-match.mjs <workId> [新标签, 默认 zh]");
  process.exit(2);
}

const REL = "public/app.emotion-subtitle-engine.js";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = fs.readFileSync(path.join(ROOT, REL), "utf8");

const head = src.indexOf("(function () {");
if (head < 0) { console.log("FAIL: 找不到模块 IIFE 开头"); process.exit(1); }
const end = src.indexOf("\n  function subtitleJsonToWordArray(", head);
if (end < 0) { console.log("FAIL: 找不到 subtitleJsonToCues 末尾锚点"); process.exit(1); }
const body = src.slice(head + "(function () {".length, end);
for (const need of ["CSSOS_WAVE_1961", "CSSOS_WAVE_1965", "function subtitleJsonToCues", "EMO_MAP"]) {
  if (!body.includes(need)) { console.log(`FAIL: 抽出来的片段里没有 ${need} —— 文件结构变了, 先去看它`); process.exit(1); }
}
const subtitleJsonToCues = new Function("globalThis", body + "\n  return subtitleJsonToCues;")(globalThis);

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit" };
const getJson = async (u) => {
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`http ${r.status} ${u}`);
  return r.json();
};

const key = `works/${WORK}/subtitle-take1.json`;
const live = `https://cdn.cssstudio.app/${key}?cb=${Date.now()}`;
const bak  = `https://cdn.cssstudio.app/artifacts/audit/w2265/${WORK}--${key.replace(/\//g, "_")}?cb=${Date.now()}`;

let newJ, oldJ;
try { newJ = await getJson(live); } catch (e) { console.log("FAIL: 取不到现在的字幕文件 — " + e.message); process.exit(1); }
try { oldJ = await getJson(bak); } catch (e) {
  console.log("FAIL: 取不到 w2265 的原件备份 — " + e.message);
  console.log("      (这份测试只能用在 w2265-fix-language-labels.py 真的改过的作品上)");
  process.exit(1);
}

const oldTag = String(oldJ.languages?.[0]?.lang ?? "");
const newTagActual = String(newJ.languages?.[0]?.lang ?? "");
if (newTagActual !== NEWTAG) {
  console.log(`FAIL: 现在的字幕文件标签是 "${newTagActual}", 不是预期的 "${NEWTAG}"`);
  process.exit(1);
}

const cuesOf = (j, lang) => { try { const c = subtitleJsonToCues(j, lang); return c ? c.length : 0; } catch (e) { return "throw:" + e.message; } };

const cases = [
  [`改后 · 两半都 ${NEWTAG}(现在的真实状态)`, newJ, NEWTAG, "有"],
  [`只改字幕文件 · 轨还是 ${oldTag}       `, newJ, oldTag, "无"],
  [`只改库 · 字幕文件还是 ${oldTag} 占位符`, oldJ, NEWTAG, "有"],
  [`改前 · 两半都 ${oldTag}(原来的状态)  `, oldJ, oldTag, "有"],
];

console.log(`=== ${WORK}  旧标签 ${oldTag} → 新标签 ${newTagActual}`);
let bad = 0;
for (const [name, j, lang, want] of cases) {
  const c = cuesOf(j, lang);
  const got = (typeof c === "number" && c > 0) ? "有" : "无";
  if (got !== want) bad++;
  console.log(`   ${got === want ? "PASS" : "FAIL"}  ${name}  → 字幕${got}(cues=${c})  期望${want}`);
}
console.log(bad === 0 ? "\n全部 PASS" : `\n${bad} 条 FAIL`);
process.exit(bad === 0 ? 0 : 1);
