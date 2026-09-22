/* W2137 回归测试 —— MV 面板的胶囊数与执行顺序。
 *
 * 为什么另写一个: 现成的 scripts/smoke-mv-pipeline-full.js 在【我动手之前就已经坏了】
 * (PASS 4 / FAIL 14, 崩在 HTMLTextAreaElement is not defined —— DOM 垫片过时),
 * 改动前后结果完全一致, 所以它既证明不了正确也拦不住回归。
 *
 * 这个测试不搭 DOM, 直接从源文件里把 STAGES / HIDDEN_STAGES / UI_STAGES 三段【真正求值】,
 * 钉死这一波最容易踩死的两条:
 *   ① 用户看见的胶囊必须是 4 颗(lyrics/music/video/subtitles)
 *   ② STAGE_ORDER 必须仍然【含 cover】—— 每个阶段开头都有
 *      `if (STAGE_ORDER.indexOf("cover") < resumeStartIdx) return null;`
 *      一旦 cover 不在里面, indexOf 返回 -1, 而 -1 < 0 恒真 →
 *      全新一次运行里定妆照会被整个跳过, 画面直接没了。
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../public/app.mv-pipeline-panel.js", import.meta.url), "utf8");

function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) throw new Error("找不到源码片段: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b < 0) throw new Error("找不到片段结尾: " + endMarker);
  return src.slice(a, b + endMarker.length);
}

const stagesSrc = slice("const STAGES = [", "];");
const orderSrc  = "const STAGE_ORDER = STAGES.map(function (s) { return s.id; });";
const hiddenSrc = slice("const HIDDEN_STAGES = {", "};");
const uiSrc     = slice("const UI_STAGES = STAGES.filter", ");");

const evaluated = new Function(
  stagesSrc + "\n" + orderSrc + "\n" + hiddenSrc + "\n" + uiSrc +
  "\nreturn { STAGES, STAGE_ORDER, UI_STAGES };"
)();

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) console.log(`     得到 ${JSON.stringify(got)}\n     期望 ${JSON.stringify(want)}`);
};

check("用户看见 4 颗胶囊",
  evaluated.UI_STAGES.map((s) => s.id),
  ["lyrics", "music", "video", "subtitles"]);

check("STAGE_ORDER 仍含 cover(定妆照是 video 的内部第一步, 删了画面就没了)",
  evaluated.STAGE_ORDER.indexOf("cover") >= 0, true);

check("STAGE_ORDER 索引未变(断点续跑靠它定位)",
  evaluated.STAGE_ORDER,
  ["lyrics", "cover", "music", "video", "subtitles", "compose"]);

check("cover / compose 都不是用户可见胶囊",
  evaluated.UI_STAGES.filter((s) => s.id === "cover" || s.id === "compose").length, 0);

// ③ compose 不得再被接进 DAG —— 「永不烧录·四轨分离」
check("DAG 里没有 compose 节点", /\.stage\(\s*"compose"/.test(src), false);

// ④ 出图必须走定妆照口, 且带 work_id(不带就进不了幻灯素材池)
check("出图走 /api/mv/plate", /"\/api\/mv\/plate"/.test(src), true);
check("不再调 /api/mv/cover", /"\/api\/mv\/cover"/.test(src), false);
check("定妆照随 pipeline-assets 落库", /slideshow_frames:/.test(src), true);

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
