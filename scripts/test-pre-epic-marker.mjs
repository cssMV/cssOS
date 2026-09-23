#!/usr/bin/env node
/* W2145 回归 — 「epic 之前那一版」的标记从 lang 挪到 voice。
 *
 * 为什么必须挪: lang 是【语言】, 字幕引擎按它严格匹配字幕文件里的 languages[].lang,
 * 'orig-pre-epic' 永远匹配不上任何真语言 → 那条轨播放时永远没字幕。更贵的一次是
 * 它被当成语言喂给了 LLM, 换回一整段「这不是真语言」的拒绝文本存进了 lyrics 列。
 *
 * 校准: CALIBRATE=1 时从 git HEAD 读旧版文件, 期望【失败】—— 不能复现故障的测试不算数。
 * 用法: node scripts/test-pre-epic-marker.mjs   /   CALIBRATE=1 node scripts/...
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import vm from "node:vm";

const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL
  ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
  : readFileSync(f, "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, hint) => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + (hint ? "\n       " + hint : "")); }
};

const idx = read("src/index.ts");
const wc  = read("public/app.works-center.js");
const html = read("public/index.html");

console.log("— 后端: 双认 helper —");
ok("preEpicSql() 存在", /function preEpicSql\s*\(/.test(idx));
const helper = (idx.match(/function preEpicSql[\s\S]{0,400}?\n}/) || [""])[0];
ok("helper 同时认新形 voice='pre-epic'", /voice\s*=\s*'pre-epic'/.test(helper),
   "只认一形 = 迁移窗口内一半作品的 Epic 徽章会消失");
ok("helper 同时认旧形 lang='orig-pre-epic'", /lang\s*=\s*'orig-pre-epic'/.test(helper));
ok("helper 支持表别名", /alias/.test(helper), "旗舰墙的子查询用 t / t3 别名, 不支持别名就拼不出 SQL");

console.log("— 后端: 写入只写新形 —");
// 只看 INSERT 语句本身, 不看注释(注释里会提到旧形, 曾经两次被自己的注释骗过)
const ins = (idx.match(/INSERT INTO work_language_tracks \(work_id, lang, voice[\s\S]{0,260}?\)\`,[\s\S]{0,140}?\);/) || [""])[0];
// 必须盯【备份轨那一条】INSERT(track_order 90), 不能只 grep 表名 ——
// index.ts 里还有别的 INSERT INTO work_language_tracks, 泛匹配会在旧版上假通过。
ok("备份轨 INSERT 列含 voice",
   /INSERT INTO work_language_tracks \([^)]*\bvoice\b[^)]*\)\s*\n\s*VALUES \(\$1::uuid,\$4,'pre-epic',90/.test(idx),
   "不写 voice 列就还是落在 voice='auto' 上");
ok("INSERT 写 voice='pre-epic'", /VALUES \(\$1::uuid,\$4,'pre-epic',90/.test(ins || idx));
ok("INSERT 的 lang 是参数不是字面量", !/VALUES \(\$1::uuid,'orig-pre-epic'/.test(idx),
   "写死 'orig-pre-epic' = 新作品继续制造哑轨");
ok("INSERT 把 lang 参数传进去了", /\[workId, origAudio \|\| "", lyrics, lang\]/.test(idx));

console.log("— 后端: 读取处全部换成双认 —");
const live = idx.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
ok("旗舰墙 epic 标志用 preEpicSql", /work_id = w\.id AND \$\{preEpicSql\("t"\)\}\) AS epic/.test(live));
ok("旗舰墙用户级过滤用 preEpicSql", /t3\.work_id = w\.id AND \$\{preEpicSql\("t3"\)\}/.test(live));
ok("存在性检查用 preEpicSql", /work_id=\$1::uuid AND \$\{preEpicSql\(\)\}/.test(live));
ok("活代码里不再有硬编码的 lang='orig-pre-epic' 查询",
   !/lang\s*=\s*'orig-pre-epic'/.test(live.replace(/function preEpicSql[\s\S]{0,400}?\n}/, "")),
   "漏一处就是一处永远查不到已迁移的轨");

console.log("— 前端: 完成判据两形都认 —");
const wcLive = wc.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
ok("works-center 认 voice='pre-epic'", /String\(t && t\.voice\) === "pre-epic"/.test(wcLive),
   "只认旧形 → 新 Epic 重出轮询永远等不到完成, 熬满 8 分钟超时");
ok("works-center 仍认旧形", /String\(t && t\.lang\) === "orig-pre-epic"/.test(wcLive));

console.log("— 缓存链 —");
const v = (html.match(/app\.works-center\.js\?v=([^"']+)/) || [])[1] || "";
ok("works-center.js 的 ?v= 已 bump 到 w2145", /w2145/.test(v),
   `现在是 "${v}" —— 独立 <script src?v=> 不 bump, 浏览器照旧拿旧文件(平台老坑)`);

console.log("— 字幕回退闸(跑真代码, 不是 grep) —");
{
  const src = read("public/app.takes.js");
  const g = { console };
  vm.createContext(g);
  vm.runInContext(src, g);   // 沙箱有自己的 globalThis, 文件照常把 API 挂上去
  const T = g.cssosTakes;
  const work = { subtitle_take1_json_url: "WORKLEVEL.json" };
  const epic = { ...work, voice: "auto", audio_url: "a.mp3" };
  const pre  = { ...work, voice: "pre-epic", audio_url: "b.mp3" };
  ok("默认轨仍回退作品级字幕(改造前后一个像素不动)", T.subtitleUrl(epic, 1) === "WORKLEVEL.json");
  ok("pre-epic 无自带字幕 → 空白", T.subtitleUrl(pre, 1) === "",
     "借 epic 的时间轴配旧版歌声 = 字幕从头漂到尾, 比没字幕更糟且不报错");
  ok("pre-epic 有自带字幕 → 用自己的",
     T.subtitleUrl({ ...pre, subtitle_url: "OWN.json" }, 1) === "OWN.json");
  ok("♪2 老路不变",
     T.subtitleUrl({ ...epic, alt_audio_url: "c.mp3", subtitle_take2_json_url: "T2.json" }, 2) === "T2.json");
  const tv = (html.match(/app\.takes\.js\?v=([^"']+)/) || [])[1] || "";
  ok("app.takes.js 的 ?v= 已 bump", /w2145/.test(tv), `现在是 "${tv}"`);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 过 / ${fail} 败` + (CAL ? "  [校准模式: 期望有失败]" : ""));
process.exit(CAL ? 0 : (fail ? 1 : 0));
