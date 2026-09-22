/* W2141 回归测试 —— 视频必须被登记进资产坐标表(否则串台探测器看不见这条道)。
 *
 * 背景: 查串台时发现 video 这条道两层身份来源【全失效】——
 *   ① 从 URL 认: 实测 0/673 个视频 URL 含 work uuid(artifacts/mv/maya-p1-xkik.mp4 …)
 *   ② 从登记表认: 全库 cssosRegisterAsset 只登记过 audio, video 一处都没有
 * 探测器按"宁可漏报"的设计静默跳过 → 数据上只有 7 次 video 掉队, 读起来像"很少串台",
 * 真相是【基本没看见】。这个测试钉死"视频写入点必须登记", 别再瞎回去。
 */
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}`); if (!ok && d) console.log("     " + d); };

const ui = strip(read("app.watch-ui.js"));

check("视频有登记助手", /function __cssosRegisterWatchVideo/.test(ui));
check("登记走平台现成的 cssosRegisterAsset(不另造表)",
  /cssosRegisterAsset\("video", url/.test(ui));

// 两条分支都要登记 —— data: 那条最终挂的是 blob:, 登记原始 data: 等于没登记
const setter = ui.slice(ui.indexOf("function setWatchVideoFromArtifact"));
const body = setter.slice(0, setter.indexOf("\nfunction hasCurrentWatchPreviewMedia"));
check("普通 URL 分支登记了", /__cssosRegisterWatchVideo\(uri\)/.test(body));
/* ⚠ 判据第一版写错了(今天第二次): 我加了一条"__cssosRegisterWatchVideo(uri) 不得出现在
 *   createObjectURL 之前"。可【非-data 分支本来就排在前面】, 那条顺序判据纯属胡写。
 *   真正要钉的只有一件事: data: 分支登记的必须是 blob:(挂到元素上的那个), 不是原始 data: 串。 */
{
  const blobAt = body.indexOf("__cssosRegisterWatchVideo(watchVideoUrl)");
  const createAt = body.indexOf("URL.createObjectURL");
  check("data: 分支登记的是 blob:(挂到元素上的那个), 且在 createObjectURL 之后",
    blobAt > 0 && createAt > 0 && blobAt > createAt, true);
}
check("登记失败不得影响播放(包在 try 里)",
  /function __cssosRegisterWatchVideo[\s\S]{0,320}try \{/.test(read("app.watch-ui.js")));

// 那两句造成盲区的过期注释不许再出现
check("work-id-binding 不再声称视频能靠 URL 自证",
  !/视频是 artifacts\/mv\/canon-<workId前缀>-….mp4  → 看 URL 就能自证/.test(read("app.work-id-binding.js")));
/* ⚠ 判据第一版又被【自己的注释】骗了(今天第二次): 我断言"旧措辞不得出现",
 *   可订正注释里正好【引用了旧措辞】来说明它错在哪 —— 于是永远判失败。
 *   改成正面判据: 要求订正标记在场, 而不是要求某句话消失。 */
{
  // ⚠ 第二版正则又错: 文件里写的是 CSSOS_WAVE_2141(不含 "W2141" 子串),
  //   而 "W2141" 字面只出现在 "0/673" 之后 —— 顺序型正则再次自找麻烦。
  //   分别断言两个事实, 不去规定它们的先后。
  const probe = read("app.crosstalk-probe.js");
  check("crosstalk-probe 已写明视频【不能】靠 URL 自证(订正在场)",
    /2141/.test(probe) && /0\/673/.test(probe), true);
}

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
