/* W2116 第3步验收: cssosTakes 的行为。
 * 最硬的一条 —— N=2 时必须与改造前【逐字段一致】, 屏幕上一个像素都不许动。 */
const fs = require("fs");
const vm = require("vm");
const ctx = { globalThis: null, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("/Users/cssos/cssOS/public/app.takes.js", "utf8"), ctx);
const T = ctx.cssosTakes;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "\n       得到 " + g + "\n       应为 " + w); }
}

console.log("── 1. 老字段两首(改造前的常态): 必须正好 2 版, 顺序 ♪1=主 ♪2=备 ──");
const legacy2 = {
  status: "ready", lang: "zh",
  audio_url: "https://cdn/a/aud-111.mp3", duration_secs: 210,
  alt_audio_url: "https://cdn/a/aud-222.mp3", alt_duration_secs: 205,
  subtitle_take1_json_url: "https://cdn/s/t1.json",
  subtitle_take2_json_url: "https://cdn/s/t2.json",
};
eq("版本数 = 2", T.count(legacy2), 2);
eq("♪1 URL = audio_url", T.url(legacy2, 1), "https://cdn/a/aud-111.mp3");
eq("♪2 URL = alt_audio_url", T.url(legacy2, 2), "https://cdn/a/aud-222.mp3");
eq("♪1 时长", T.at(legacy2, 1).duration_secs, 210);
eq("♪2 时长", T.at(legacy2, 2).duration_secs, 205);
eq("♪1 字幕 = take1 列", T.subtitleUrl(legacy2, 1), "https://cdn/s/t1.json");
eq("♪2 字幕 = take2 列", T.subtitleUrl(legacy2, 2), "https://cdn/s/t2.json");
eq("标签默认 ♪1/♪2", [T.at(legacy2,1).label, T.at(legacy2,2).label], ["♪1", "♪2"]);

console.log("── 2. 只有一首: 不许假装有第二首 ──");
const one = { status: "ready", audio_url: "https://cdn/a/x.mp3", subtitle_take1_json_url: "https://cdn/s/t1.json" };
eq("版本数 = 1", T.count(one), 1);
eq("要 ♪2 时钳回 ♪1(绝不静默无声)", T.url(one, 2), "https://cdn/a/x.mp3");
eq("钳回后 take 号也是 1", T.at(one, 2).take, 1);

console.log("── 3. 后端下发 takes(♪3/♪4 才有的路径) ──");
const four = {
  status: "ready", lang: "zh",
  audio_url: "https://cdn/a/v1.mp3", alt_audio_url: "https://cdn/a/v2.mp3",
  takes: [
    { take: 1, label: "", url: "https://cdn/a/v1.mp3", duration_secs: 200, subtitle_url: null, source: "track" },
    { take: 2, label: "", url: "https://cdn/a/v2.mp3", duration_secs: 201, subtitle_url: null, source: "track" },
    { take: 3, label: "Suno V6 新版 #1", url: "https://cdn/a/v3.mp3", duration_secs: 202, subtitle_url: "https://cdn/s/v3.json", source: "versions" },
    { take: 4, label: "Suno V6 新版 #2", url: "https://cdn/a/v4.mp3", duration_secs: 203, subtitle_url: null, source: "versions" },
  ],
  subtitle_take1_json_url: "https://cdn/s/t1.json",
  subtitle_take2_json_url: "https://cdn/s/t2.json",
};
eq("版本数 = 4", T.count(four), 4);
eq("♪4 URL", T.url(four, 4), "https://cdn/a/v4.mp3");
eq("♪3 标签用版本自己的名字", T.at(four, 3).label, "Suno V6 新版 #1");
eq("♪3 字幕用版本自带的", T.subtitleUrl(four, 3), "https://cdn/s/v3.json");
eq("♪4 无自带字幕 → 回退 take2 列(不给第一版的字幕)", T.subtitleUrl(four, 4), "https://cdn/s/t2.json");
eq("要 ♪9 时钳回最后一版", T.at(four, 9).take, 4);

console.log("── 4. 去重: 同一个文件签两次不算两版 ──");
const dup = {
  status: "ready",
  audio_url: "https://cdn/a/same.mp3?sig=AAA",
  alt_audio_url: "https://cdn/a/same.mp3?sig=BBB",
};
eq("版本数 = 1(只比路径, 忽略签名)", T.count(dup), 1);

console.log("── 5. 队列卡片形态(字段名不一样, 也要认) ──");
const card = { id: "w1", audio_track_1_url: "https://cdn/a/c1.mp3", audio_track_2_url: "https://cdn/a/c2.mp3" };
eq("卡片也数得出 2 版", T.count(card), 2);
eq("卡片 ♪2 URL", T.url(card, 2), "https://cdn/a/c2.mp3");

console.log("── 6. 空/脏输入不炸 ──");
eq("null", T.count(null), 0);
eq("空对象", T.count({}), 0);
eq("takes 是脏数据 → 回退老字段", T.count({ takes: [{}, { url: "" }], audio_url: "https://cdn/a/z.mp3" }), 1);

console.log("\n" + (fail ? "❌ " + fail + " 条不过" : "✅ 全过") + "  (" + pass + "/" + (pass + fail) + ")");
process.exit(fail ? 1 : 0);
