/* W2337 回归 — Jing 2026-11-16:「可以是真视频吗?」
 *   → 选了【4 镜/场 @ seedance-2-fast】+【真视频做默认, 余额不够才降幻灯】。
 *
 * 改之前的事实: 唱段(歌剧/三部曲/单曲)这条路的画面层只到 6 张静态图,
 * 全平台没有一处为唱段调过 callVideoGen; video_mode(none/slideshow/hybrid/full)
 * 只活在 /api/mv/estimate-total 的【报价】里 —— 能报价, 不能生成。
 *
 * 本测试守住四件最容易写错、而且错了会【花钱】或【撒谎】的事:
 *   ① 顺序 = 那句话本身: 先真视频, 它拒了才幻灯。反了就等于没做。
 *   ② 闸在花钱之前: 先按 4 镜总价预检, 不够一镜都不打(半途没钱 = 残片 + 已花的钱)。
 *   ③ 自动路只碰新作品: 没有年龄闸, 对账器会把【整个存量库】一路计费
 *      —— Jing 说的「默认」是新作品一次性完整, 不是把历史重花一遍。
 *   ④ 不撒谎 + 不烧录: is_real_video_mv 要真打(我们真付过钱), 成片 -an 不出声。
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

const src = read("src/index.ts");

/* ── 渲染器本体 ──────────────────────────────────────────────── */
/* 切到【下一个函数定义】为界, 不用写死字节数 —— 第一版写 9000, 后来往函数里又塞了
 * 一道厂商余额闸, 窗口就够不到尾巴了, 于是最后一条判据在没改坏的代码上报红。 */
const i0 = src.indexOf("async function ensureRealVideoMV");
const iNext = src.indexOf("\nasync function ffprobeDurationSecs", i0);
const seg = i0 > 0 && iNext > i0 ? src.slice(i0, iNext) : "";
ok("真视频渲染器存在", i0 > 0,
   "改之前唱段这条路根本不碰 callVideoGen —— 画面只有 6 张静态图");

ok("引擎 = seedance-2-fast(Jing 定)",
   /REAL_MV_ENGINE = "bytedance\/seedance-2-fast"/.test(src),
   "选它不是因为便宜: W1968 实测只确认了 2-fast 在【锁脸/多镜头一致】上与标准版一致, mini 未确认");
ok("4 镜 × 8 秒(Jing 定; seedance 时长只能 4/6/8, 取最长)",
   /REAL_MV_SHOTS = 4\b/.test(src) && /REAL_MV_SHOT_SECS = 8\b/.test(src));

/* ① 顺序 —— 先真视频, 拒了才幻灯 */
const iRec = src.indexOf("const canonReconcile = async () =>");
const rec = iRec > 0 ? src.slice(iRec, iRec + 3000) : "";
/* ⚠ 判据必须认【调用】, 不能认函数名 —— 本波的注释里就提到了 ensureCanonicalMV 这个名字,
 * 第一版用 indexOf(名字) 比先后, 命中的是注释(1036)而不是调用(1312), 于是在顺序
 * 完全正确的代码上报红。今晚第五次栽在判据范围上, 这次记在测试里。 */
const iReal = rec.indexOf("ensureRealVideoMV(row.id");
const iCanon = rec.indexOf("ensureCanonicalMV(row.id");
ok("对账器里【真视频的调用在幻灯的调用之前】",
   iReal > 0 && iCanon > 0 && iReal < iCanon,
   "Jing 的原话是「真视频做默认, 余额不够才降幻灯」—— 顺序就是那句话本身");
ok("真视频成了就不再跑幻灯(continue)",
   /ensureRealVideoMV\(row\.id[\s\S]{0,400}?\bcontinue;/.test(rec),
   "两条都跑 = 为同一个画面付两次工(而且后跑的那条会被 has_video 挡住, 白绕一圈)");
ok("对账器是【定时必经】的, 不是某条创作路径上的一次性调用",
   /setInterval\(canonReconcile/.test(src) && /setTimeout\(canonReconcile/.test(src),
   "装在各调用点必漏 —— 平台教训: 闸要装在必经之处");
ok("对账器有单飞闸: 上一跳没完, 下一跳不进来",
   /if \(_canonReconcileBusy\) return;/.test(rec) && /finally \{ _canonReconcileBusy = false; \}/.test(rec),
   "它本来秒级完事所以不需要闸; 接上真视频后变十几分钟 → 3 分钟一跳会叠起来几路并发烧钱");

/* ② 闸在花钱之前 */
ok("先按【4 镜总价】预检余额, 不够一镜都不打",
   /const total = perShot \* REAL_MV_SHOTS;/.test(seg)
     && /bal < total/.test(seg) && /skipped: "insufficient_credits"/.test(seg),
   "半途没钱 = 留下两三镜的残片 + 已经花掉的钱, 比不做更糟");
ok("余额不够是【skip】不是 error —— 它要让位给幻灯",
   /余额不够才降幻灯|降幻灯/.test(seg),
   "报成 error 的话上层会当失败处理, 而 Jing 要的是降级");
ok("admin 豁免也走 isCreditExempt, 不会被误降成幻灯",
   /isCreditExempt\(w\.owner\)/.test(seg),
   "官方账号余额本来就是 0(走豁免)—— 不认豁免就等于自己的作品永远升不了真视频");
ok("取不到【视频档】真实价时放弃真视频, 绝不按错价扣",
   /videoShotCostCents/.test(seg) && /skipped: "no_price"/.test(seg),
   "宁可没有, 不要错的");
ok("价钱只在 video 段按 id 精确找, 找不到返回 0",
   /async function videoShotCostCents[\s\S]{0,500}?cat\?\.stages\?\.video[\s\S]{0,300}?: 0;/.test(src),
   "不复用 generationCostCents: 它找不到会回落到【音乐】默认引擎的价 —— 拿唱歌的价扣视频的钱, 错得极难发现");
ok("一镜落地才扣一镜的钱(没出来的镜头不收费)",
   /debitCredits\(w\.owner, perShot, "real_video_mv_shot"/.test(seg),
   "先检总额、再按镜实扣");

/* ②b 厂商侧余额 —— 对【豁免账号】来说这才是唯一一道真闸 */
ok("另有一道【KIE 厂商积分】闸, 不只看我们自己的钱包",
   /kieCreditBalance\(\)/.test(seg) && /insufficient_kie_credits/.test(seg),
   "官方/staff 走 isCreditExempt 跳过钱包闸 → 对 Jing 自己的作品, 钱包那道闸等于没装;"
   + " 真预算是 KIE 账上的积分, 两者是两件东西");
ok("按【镜数 × 秒 × 实测费率】算所需积分",
   /REAL_MV_CREDITS_PER_SEC = 24\.8/.test(src)
     && /REAL_MV_SHOTS \* REAL_MV_SHOT_SECS \* REAL_MV_CREDITS_PER_SEC/.test(seg),
   "4 × 8 × 24.8 = 794 积分/场; 一部三幕六场 = 4,762 —— 2026-11-16 他账上一共 4,855");
ok("留 reserve 给词/曲/封面, 不把余额清空",
   /REAL_MV_KIE_RESERVE/.test(seg) && /needCredits \+ REAL_MV_KIE_RESERVE/.test(seg),
   "清空之后连 Suno 和封面都点不动了 —— 那比画面是幻灯糟得多");
ok("余额【查不到】当作不够(偏保守那侧错)",
   /kie < 0 \|\| kie < needCredits/.test(seg) && /kie_balance_unknown/.test(seg),
   "保守侧错的代价是这一首降幻灯; 激进侧错的代价是余额被清空");
ok("认 KIE 体里的 code, 不只看 HTTP 200",
   /Number\(j\.code\) !== 200/.test(src),
   "KIE 一律回 200, 真状态在体里的 code(余额耗尽 = 200 + 402)");

/* ③ 年龄闸 —— 自动路只碰新作品 */
ok("自动路有年龄闸(24h), 显式路不看年龄",
   /\(created_at > now\(\) - interval '24 hours'\) AS fresh/.test(seg)
     && /opts\.auto && !w\.fresh/.test(seg) && /skipped: "not_fresh"/.test(seg),
   "没有它, 对账器的选取条件(有活音频+没视频)在整个存量库上都成立 → 一路计费");
ok("对账器确实传了 auto:true",
   /ensureRealVideoMV\(row\.id, \{ auto: true \}\)/.test(rec),
   "不传等于年龄闸没装");

/* ④ 不撒谎 + 不烧录 */
ok("厂商侧 native_audio:false(四轨分离)",
   /native_audio: false/.test(seg),
   "让厂商出声 = 音画分家: 那不是我们的歌");
ok("成片 -an, 画面不带声",
   /"-an"/.test(seg),
   "永不烧录: 歌声仍是独立音轨, 播放端两轨对齐播");
ok("exclusive:true, 不许掉成 16:9 的 veo",
   /exclusive: true/.test(seg),
   "W1468 的教训: 超时掉引擎会把 21:9 变成 16:9");
ok("画幅走 2.39:1 别名(铁律重映射到 21:9)",
   /aspect_ratio: "2\.39:1"/.test(seg));
ok("真打了 is_real_video_mv 标",
   /is_real_video_mv = true/.test(seg),
   "W1880 判据 = 有没有真的付过视频引擎的钱。我们真付了, 不打标 = 把真视频标成幻灯 = 在 UI 上撒谎");
ok("记下 engines.video_cents(多画面胶囊的另一个判据源)",
   /engines: \{ video_cents:/.test(seg));

/* 其余不许退步的几件 */
ok("内容哈希命名 vid-<sha>, 不用写死名",
   /artifacts\/mv\/vid-\$\{sha\}\.mp4/.test(seg),
   "固定名 = 重新生成必然原地覆盖");
ok("4 镜共用封面当 image_url 锚点(锁脸/锁世界)",
   /req\.image_url = w\.cover/.test(seg),
   "不锚点就是 4 个互不相干的镜头");
ok("逐镜给【这一镜要什么】, 且是正面表述",
   /UNINHABITED/.test(seg) && /const beats = \[/.test(seg),
   "同一个错栽过四次: 只给上限会被读成「放一个」, 否定式无效");
ok("画面时长 = 歌声时长, 用 -stream_loop 铺满",
   /"-stream_loop", "-1"/.test(seg) && /"-t", String\(durSecs\)/.test(seg),
   "4 镜 32 秒覆盖 120 秒 = 循环 3.75 次; 画面秒数 < 歌声秒数是设计, 不是缺陷");
ok("时长是【解码量出来的】, 不是读文件头",
   /-count_packets/.test(src) && /async function ffprobeDurationSecs/.test(src),
   "format/stream 读的是同一个会撒谎的头(实测有头里写 514s、真身 383.6s 的文件)");

/* ── 存量升级端点 ──────────────────────────────────────────── */
const iEp = src.indexOf('app.post("/api/admin/real-mv/:workId"');
const ep = iEp > 0 ? src.slice(iEp, iEp + 3000) : "";
ok("存量显式升级端点在", iEp > 0,
   "老作品要花钱, 必须一部一部由 Jing 点 —— 自动路碰不到它们");
ok("端点要 admin token", /ADMIN_TOKEN_REQUIRED/.test(ep));
ok("?dry=1 只报价不生成(先看要花多少再决定)",
   /if \(dry\) return res\.json/.test(ep) && /worst_case_usd/.test(ep));
ok("报价连【厂商积分】一起给(对豁免账号, cents 那个数与他无关)",
   /kie_credits_needed/.test(ep) && /kie_credits_now/.test(ep) && /kie_affordable/.test(ep),
   "只报 cents = 报了个恒等于 0 的数");
ok("整部串行, 不并发", /for \(const id of targets\)/.test(ep),
   "铁律: 不要几路并发");
ok("整部只取【有音频、没视频】的叶子",
   /preview_audio_url IS NOT NULL[\s\S]{0,80}?preview_video_url IS NULL/.test(ep),
   "已有视频的不碰 —— 不覆盖");
ok("take2 不在默认目标里(♪2 与 ♪1 同场同词, 画面共用)",
   !/'take2'/.test(ep),
   "给 ♪2 再买 4 镜 = 为同一个画面付两次钱");

console.log(`\nW2337  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
