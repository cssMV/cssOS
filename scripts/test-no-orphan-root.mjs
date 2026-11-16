/* W2326 回归 — Jing:「请修复孤儿根。」
 *
 * 现象: 公开库里挂着一个【没有任何子部的根】—— 库里那条 7504229f《西施问月》
 * (11-15 01:15, triptych root, 零子部)就是。点进去什么都没有, 而用户那一次
 * 【什么都没生成成功】。
 *
 * 真因是【顺序】, 不是闸漏了: root 行先插, 双闸(生成权 ⊥ 钱包)后查。闸一拦就 return,
 * 而 root 已经落库、market profile 还是 visibility='public'。
 * W1456 当年把闸装在"建子行之前"是对的(避免建空场景行), 只是没再往前挪一步 ——
 * root 本身也是一行, 它同样该在闸后面。
 *
 * 本测试判的是【顺序】这件事本身, 不是"有没有写过这个字符串":
 *   ① create_work 里, 双闸的 return 必须排在第一条 INSERT INTO user_works 【之前】
 *   ② 闸只许有一处(两处查闸, 下一个人必定只改对一处)
 *   ③ root 之后每一个失败出口都带回滚, 且回滚自己先查"有没有子部"
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

/* 把 create_work 这一段切出来再判 —— 全文件搜 "INSERT INTO user_works" 会撞上
 * 别的端点(resubtitle / 礼物 / 迁移脚本都有), 判出来的"第一条"根本不是这里的。
 * 起点: 本段独有的 root 注释; 终点: 树型那条路返回 work_cards 之后的扁平插入段末尾。 */
const segStart = src.indexOf("以树结构入库 — root + 子节点");
const segEnd = src.indexOf("`  After the tool returns work_cards");
ok("能切出 create_work 的建行段", segStart > 0 && segEnd > segStart,
   `segStart=${segStart} segEnd=${segEnd} —— 切不出就不要假通过, 全文件搜会撞上别的端点`);
const seg = (segStart > 0 && segEnd > segStart) ? src.slice(segStart, segEnd) : "";

// ① 顺序: 闸的 return 必须在第一条 INSERT INTO user_works 之前
const firstInsert = seg.indexOf("INSERT INTO user_works");
const gateReturn = seg.search(/checkGenerationGatesOrError\(String\(ctx\.userId\), _gateLeafCount\)/);
ok("双闸出现在 create_work 建行段里", gateReturn >= 0,
   "找不到前移后的那道闸(_gateLeafCount)");
ok("第一条 INSERT INTO user_works 存在", firstInsert >= 0);
ok("【闸排在第一条 INSERT 之前】—— 被拦时一行都不插",
   gateReturn >= 0 && firstInsert >= 0 && gateReturn < firstInsert,
   `闸在 ${gateReturn}, 第一条 INSERT 在 ${firstInsert}。` +
   "闸在后面 = root 已落库才发现没权限 = 公开库里留一个空壳");

// 顺序要靠得住: 闸和 root 插入之间不许再插进别的 user_works 写入
const between = firstInsert > gateReturn && gateReturn >= 0
  ? seg.slice(gateReturn, firstInsert) : "";
ok("闸与第一条 INSERT 之间没有别的建行语句",
   !/INSERT INTO (user_works|work_market_profiles)/.test(between));

// ② 闸只许一处
const gateCount = (seg.match(/checkGenerationGatesOrError/g) || []).length;
ok("create_work 里只有【一处】查闸", gateCount === 1,
   `实得 ${gateCount} 处 —— 两处查闸, 下一个人必定只改对一处`);

// ③ root 之后每一个失败出口都带回滚
ok("有回滚 helper dropOrphanRoot", /const dropOrphanRoot = async \(\)/.test(seg));
ok("回滚【先查有没有子部】, 有就一个字不动",
   /SELECT 1 FROM user_works WHERE root_work_id = \$1::uuid AND id <> \$1::uuid LIMIT 1/.test(seg)
     && /if \(kids\.rowCount\) return;/.test(seg),
   "半部作品有内容, 归「不删不覆盖」铁律管 —— 回滚只许删【从未有过内容的空壳】");
ok("DELETE 带 structure_role='root' 条件, 不可能误伤叶子",
   /DELETE FROM user_works WHERE id = \$1::uuid AND structure_role = 'root'/.test(seg));
ok("回滚失败不吞掉原本的错误(只记一笔)",
   /orphan-root cleanup failed/.test(seg));

// root 之后的每个 work_insert_failed 出口都要先回滚
const exits = [...seg.matchAll(/return \{ error: "work_insert_failed"/g)].map((m) => m.index);
const rootInsertExit = seg.indexOf('detail: "root_insert:');
let guarded = 0, unguarded = [];
for (const at of exits) {
  // root 自己那条出口跳过: 它的事务已 ROLLBACK, 没有行可删。
  // 判据是「这条 return 的紧后面就是 root_insert: 那个 detail」, 不是反过来 ——
  // detail 在 return 之后, 我第一版把大小关系写反了, 于是把它当成了"漏回滚"。
  if (rootInsertExit > at && rootInsertExit < at + 200) continue;
  const before = seg.slice(Math.max(0, at - 400), at);
  if (/await dropOrphanRoot\(\);/.test(before)) guarded += 1;
  else unguarded.push(seg.slice(at, at + 90).split("\n")[0]);
}
ok(`root 之后的失败出口全部带回滚(${guarded} 个)`,
   unguarded.length === 0 && guarded >= 4,
   unguarded.length ? "没带回滚的: " + unguarded.join(" | ")
                    : `只找到 ${guarded} 个, 预期 ≥4(幕/场/扁平 shell-only/扁平旧路)`);

console.log(`\nW2326  ✅ ${pass}  ❌ ${fail}` + (CAL ? "   (CALIBRATE: 期望有 ❌)" : ""));
process.exit(fail ? 1 : 0);
