/* W2347 回归 — 库里只保留 21:9。
 *
 * Jing 2026-11-20:「库里存量作品的 aspect_ratio, 也请批量改成 21:9, 而且只保留 21:9 比例。」
 *
 * 「只保留」不是【此刻只有】。一次 UPDATE 只管当下, 下一次写入就破了。
 * 真正要守的是三扇门 —— 这份测试逐扇查:
 *
 *   ① 列默认值        user_works 有 18 条 INSERT 路径, 大多数不写这一列 → 落 NULL。
 *                     一条条改必漏, 所以靠 DEFAULT '21:9' 一次封住(含将来新增的)。
 *   ② 触发器          W1915 的 cssos_derive_frame_geometry 原来会把【实测标签】
 *                     (2.39:1 / 1:1 / 9:16)写进空的 aspect_ratio —— 下一次回填就放回来了。
 *   ③ API + 面板      PATCH 作品端点 + 作品编辑面板的下拉框, 用户能亲手破掉铁律的地方。
 *
 * 另有一条【反向】判据(第 ④ 组): 实测证据必须还在。
 * frame_width / frame_height / orientation 是 ffprobe 量出来的真信息,
 * 抹掉就再也量不回来 —— W2061 的教训是「记录留住了、字节没留住, 等于没留」。
 *
 * 判据取材只认【代码】: 迁移文件和源码的注释里到处是 "2.39:1"(它们是在解释
 * 为什么不用它)。不剥注释就会在正确的代码上报红 —— W2344/W2345/W2346 连栽三次。
 *
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => {
  if (CAL) {
    try { return execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); }
    catch { return ""; }   /* HEAD 里还没有这个文件 —— 空串让判据自然失败, 这正是校准要的 */
  }
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

const stripSql = (s) => s.replace(/^\s*--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const stripJs  = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\*).*$/gm, "");

const MIG = "migrations/129_aspect_ratio_21x9_only.sql";
const mig = stripSql(read(MIG));

console.log("\n① 列默认值 —— 封住 18 条 INSERT 路径");
ok("迁移把 aspect_ratio 的 DEFAULT 设成 '21:9'",
   /ALTER\s+TABLE\s+user_works\s+ALTER\s+COLUMN\s+aspect_ratio\s+SET\s+DEFAULT\s+'21:9'/i.test(mig),
   "大多数 INSERT 根本不写这一列(改之前 916 行是空的)。逐条去改必漏一条,\n" +
   "       列默认值是唯一一次性封住全部、且对将来新增路径也成立的办法。");

console.log("\n② 触发器 —— 不许再把实测标签写回画幅");
const fnBody = (() => {
  const i = mig.indexOf("FUNCTION cssos_derive_frame_geometry");
  if (i < 0) return "";
  const j = mig.indexOf("$$ LANGUAGE", i);
  return mig.slice(i, j > 0 ? j : mig.length);
})();
ok("触发器函数里再也没有画幅推导的 CASE",
   fnBody.length > 0 && !/NEW\.aspect_ratio\s*:=\s*CASE/i.test(fnBody),
   "原来那段 CASE 会按实测比值写出 '2.39:1' / '1:1' / '9:16' —— 它正是\n" +
   "       库里那 1481 个非 21:9 值的来源。留着它, 下一次回填就全放回来了。");
ok("空画幅一律补成 '21:9'",
   /NEW\.aspect_ratio\s*:=\s*'21:9'/i.test(fnBody));
ok("补画幅排在【尺寸判断之前】",
   (() => {
     const a = fnBody.search(/NEW\.aspect_ratio\s*:=\s*'21:9'/i);
     const b = fnBody.search(/NEW\.frame_width\s+IS\s+NULL/i);
     return a >= 0 && b >= 0 && a < b;
   })(),
   "尺寸判断里有 RETURN NEW —— 补画幅排在它后面, 没量到尺寸的行就拿不到 21:9,\n" +
   "       而那恰恰是最常见的一类行(改之前 916 个空值全都没有尺寸)。");
ok("触发器在 INSERT 上全量触发(不是只在 frame_* 变化时)",
   /BEFORE\s+INSERT\s+OR\s+UPDATE\s+OF\s+frame_width,\s*frame_height/i.test(mig),
   "原来是 UPDATE OF frame_* ... 对 INSERT 也只在带尺寸时才跑。不带尺寸的 INSERT\n" +
   "       要靠列默认值兜 —— 两道闸都要在。");

console.log("\n③ API 与面板 —— 用户能亲手破掉铁律的地方");
const srv = stripJs(read("src/index.ts"));
ok("PATCH 作品端点把任何画幅归一化成 21:9",
   /push\("aspect_ratio",\s*v\s*\?\s*"21:9"\s*:\s*null\)/.test(srv),
   "原来是 push(\"aspect_ratio\", v || null) —— 送什么存什么。");
ok("归一化时留痕(不是静默改值)",
   /\[画幅铁律\][^\n]*归一化/.test(read("src/index.ts")),
   "静默改用户送来的值最难查 —— 必须打一行日志说明改了什么。");
const wep = read("public/app.work-edit-panel.js");
const wepCode = stripJs(wep);
ok("编辑面板的画幅下拉只剩 21:9 一个选项",
   (wepCode.match(/<option value="[^"]*">/g) || [])
     .filter((o) => /value="[0-9.]+[:x][0-9.]+"/.test(o)).length === 1 &&
   /<option value="21:9">/.test(wepCode),
   "W2346 时这里还留着 2.39:1 / 16:9 / 1:1 / 9:16。存量归一之后, 留着它们\n" +
   "       只剩一个作用: 让用户亲手把一个作品改回非 21:9。");
ok("面板不再拿正则从 work 里挑画幅",
   !/\/\^\(21:9\|/.test(wepCode) && /asp\.value\s*=\s*"21:9"/.test(wepCode),
   "旧写法正则漏了 21:9, 一个 21:9 的作品打开就被静默改成 2.39:1(W2346 查出的旧 bug)。\n" +
   "       只有一个值时根本不该有「挑」这个动作。");

console.log("\n④ 反向判据 —— 实测证据必须还在");
ok("迁移没有动 frame_width / frame_height",
   mig.length > 0 &&   /* 否定式在空文件上天然成立 —— 必须先确认文件真的在 */
   !/(ALTER|UPDATE|DROP)[\s\S]{0,80}frame_(width|height)\s*(=|DROP|TYPE)/i.test(mig),
   "它们是 ffprobe 实测的真实尺寸 —— 抹掉就再也量不回来了。");
ok("orientation 仍然按实测派生(没被一起写死)",
   /NEW\.orientation\s*:=\s*CASE/i.test(fnBody) &&
   /'portrait'/.test(fnBody) && /'landscape'/.test(fnBody),
   "画幅是【声明】, 朝向是【实测】—— 两件事。把 orientation 也写死, 就再也找不出\n" +
   "       「标着 21:9 其实是竖的」那些旧文件了。");
ok("旧值另存了一份(w2347_aspect_pre_backup)",
   /w2347_aspect_pre_backup/.test(read(MIG)) || /w2347_aspect_pre_backup/.test(mig),
   "W2061 的教训: 记录留住了、字节没留住, 等于没留。");
ok("刻意不加 CHECK 约束(老客户端送旧值不该变成 500)",
   mig.length > 0 && !/CHECK\s*\(\s*aspect_ratio/i.test(mig),
   "CHECK 会把「老页面送了 2.39:1」变成用户面前的报错。归一化把值修对,\n" +
   "       比把请求打回去更符合铁律要的结果。");

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"}  ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
