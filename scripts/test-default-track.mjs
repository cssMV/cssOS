/* W2195/W2196 回归 —
 *   Jing:「设置《白鹤报恩》作为用户进入平台默认播放曲目, 取代之前的《李清照·声声慢》」
 *        「固定 For You 面板名称, 不要 Create for you 这个名字」
 *
 * 默认曲目的真源是【服务端市场接口的首位】, 不是前端任何一处写死的 id ——
 * 所以这份测试守的是"谁排第一"的规则, 不是某一首歌的名字:
 * 换默认曲目只改置顶时间, 这些断言不该因此失败。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

// ① 服务端: 置顶排在真视频【之前】
const api = read("src/index.ts");
const i = api.indexOf('app.get("/api/works/market"');
ok("找得到 market 路由(判据本身没瞎)", i > 0);
const blk = api.slice(i, i + 40000);
const pinIdx = blk.indexOf("w.admin_pinned_at DESC NULLS LAST");
const realIdx = blk.indexOf("CASE WHEN w.is_real_video_mv THEN 0 ELSE 1 END) ASC");
ok("两个排序键都在(判据本身没瞎)", pinIdx > 0 && realIdx > 0);
ok("置顶排在真视频之前", pinIdx > 0 && realIdx > 0 && pinIdx < realIdx,
   "反过来的话, 置顶再新也压不过任意一首真视频 —— 默认曲目就由 is_real_video_mv 决定了");
ok("真视频优先没有被删掉(只是降级, 未置顶的那片仍旧它最先)", realIdx > 0);

// ② 前端: 认 For You 的首位, 不认视频类型, 也不认"当前活动列表"
const feed = read("public/app.autoplay-feed.js");
const live = feed.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/|--)/.test(l)).join("\n");
ok("起播判据不再要求首位是真视频",
   !/var _firstIsReal = !!\(_first && _first\.is_real_video_mv === true\)/.test(live),
   "服务端已按置顶排好, 前端再加一道视频判据会把置顶那首挡掉");
ok("每轮都把列表钉回 for-you 再读",
   /setActive\("for-you"\);\s*\n\s*var _items = \(globalThis\.cssosPlaylists\.getActive\(\)/.test(live),
   "读 getActive() 会读到被别处切走的 mine —— 那段不走置顶提升, 首位永远是用户最新自有作品");
ok("等列表拼完再挑(不是有首位就算数)",
   /_stillLoading/.test(live) && /_lst && _lst\.loading/.test(live),
   "For You 分两段拼, 半成品阶段的首位是自己的作品, 不是置顶那首");

// ③ For You 的名字
const app = read("public/app.js");
ok('panel.foryou 是 "For You"', /"panel\.foryou": "For You",/.test(app));
ok('dock.foryou 是 "For You"', /"dock\.foryou": "For You",/.test(app));
ok("没有残留的 Create/Created For You",
   !/"Create For You"|"Created For You"/.test(app),
   "Jing: 太长, 绝大部分平台都用 For You 这个短名字");

console.log(`\n${fail ? "❌" : "✅"} ${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
