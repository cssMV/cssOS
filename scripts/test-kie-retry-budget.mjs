/* W2277 回归 — Jing 2026-11-08:「先修重试预算，根治。」
 *
 * 病: `[llm-router] kie retry budget 45000ms spent (110525ms) — falling through`
 * 预算写 45s、实际花 110.5s。根因一句话: **预算只约束"要不要再来一次", 从不约束
 * "正在飞的这一次"** —— 单次 fetch 的超时来自 makeTimeoutFetch(歌词链 120s),
 * 预算无权打断它。原设计是照着【8-11 秒的廉价失败】做的(3×10s=30s < 45s, 从没绑住过),
 * 而 2026-11 这个通道改成了【挂住 ~70 秒】, 于是次数闸和预算闸同时失效。
 *
 * 为什么不能把 45s 做成硬超时: 会掐断【正在正常产字的慢流】(1400 token 的希腊文/天城文
 * 实测成功均 34s), 而本分支里「有部分文本 + 有错误」会被整段丢弃 —— 掐一次等于白烧一次成功。
 * 所以闸门装在【首字节】上: 预算内一个 delta 都没来才掐; 已经在产字就不动它。
 *
 * 本测试两段: ① 把这套计时器逻辑【单独跑一遍】, 证明行为对;
 *            ② 结构检查, 证明它真的接在 src/index.ts 那个重试循环里(只对不接 = 改了等于没改)。
 * 校准: CALIBRATE=1 读 git HEAD, 期望失败。 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const CAL = process.env.CALIBRATE === "1";
const read = (f) => CAL ? execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 })
                        : readFileSync(f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, h) => { if (c) { pass++; console.log("  ✅ " + n); }
                          else { fail++; console.log("  ❌ " + n + (h ? "\n       " + h : "")); } };

/* ── ① 行为: 两个计时器挂一个 controller, 只在【没产出内容】时掐 ─────────── */
console.log("行为(真计时器, 不是读代码):");
const BUDGET = 300, HARD = 3000;   // 等比缩小: 45s → 300ms, 120s → 3000ms

/** 复刻路由里那套闸门。firstByteAtMs=null 表示这条流一个字都不产出。 */
function race({ firstByteAtMs, endAtMs }) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const ac = new AbortController();
    let gotContent = false, reason = "";
    const tStall = setTimeout(() => {
      if (!gotContent) { reason = `no_content_in_${BUDGET}ms`; ac.abort(); }
    }, BUDGET);
    const tHard = setTimeout(() => { reason = reason || `per_call_timeout_${HARD}ms`; ac.abort(); }, HARD);
    const done = (how) => { clearTimeout(tStall); clearTimeout(tHard); resolve({ how, reason, ms: Date.now() - t0 }); };
    ac.signal.addEventListener("abort", () => done("aborted"));
    if (firstByteAtMs !== null) setTimeout(() => { gotContent = true; }, firstByteAtMs);
    setTimeout(() => { if (!ac.signal.aborted) done("completed"); }, endAtMs);
  });
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

let r = await race({ firstByteAtMs: null, endAtMs: 2500 });   // 挂住、一个字不产出
ok("死通道(一个 delta 都没有) → 在预算处掐掉, 不等到单次超时",
   r.how === "aborted" && /no_content_in/.test(r.reason) && near(r.ms, BUDGET, 150),
   `实际: ${r.how} ${r.reason} ${r.ms}ms, 期望 aborted@~${BUDGET}ms`);

r = await race({ firstByteAtMs: 100, endAtMs: 1200 });        // 产字了, 但比预算慢得多
ok("慢但在产字的流 → 首字节闸不动它, 让它跑完(这是不能做成硬超时的理由)",
   r.how === "completed" && near(r.ms, 1200, 250),
   `实际: ${r.how} ${r.reason} ${r.ms}ms, 期望 completed@~1200ms`);

r = await race({ firstByteAtMs: 100, endAtMs: 9999 });        // 产字了但永远不结束
ok("产字之后又卡死 → 仍有单次超时兜底(没把那层兜底丢掉)",
   r.how === "aborted" && /per_call_timeout/.test(r.reason) && near(r.ms, HARD, 300),
   `实际: ${r.how} ${r.reason} ${r.ms}ms, 期望 aborted@~${HARD}ms`);

r = await race({ firstByteAtMs: 50, endAtMs: 120 });          // 正常快流
ok("正常快流 → 什么都不掐", r.how === "completed" && r.ms < BUDGET);

/* ── ② 结构: 真的接在那个循环里 ───────────────────────────────────────── */
console.log("接线(src/index.ts 的 kie 重试循环):");
const ts = read("src/index.ts");

ok("预算在【开打之前】先查一次",
   /const kieLeft = KIE_RETRY_BUDGET_MS - \(Date\.now\(\) - kieT0\);[\s\S]{0,400}?if \(kieLeft <= 0\) \{/.test(ts),
   "原来只在打完之后查 → 最后一次尝试总是免费超支");
ok("每次的闸限是【剩余预算】, 不是整份预算",
   /setTimeout\(\(\) => \{\s*\n?\s*if \(!kieGotContent\) \{ kieAbortReason = `kie_no_content_in_\$\{kieLeft\}ms`; kieAc\.abort\(\); \}\s*\n?\s*\}, kieLeft\);/.test(ts),
   "否则三次尝试的总和仍可达 3 倍预算 —— 那就不叫预算");
ok("单次调用硬超时仍在(tHard), 没把兜底丢掉",
   /const tHard = setTimeout\([\s\S]{0,260}?\}, KIE_PER_CALL_TIMEOUT_MS\);/.test(ts));
ok("首字节闸的判据是【真的产出了 delta】, 不是 message_start 到了",
   /if \(ev\?\.type === "content_block_delta" && typeof dt === "string"\) \{[\s\S]{0,400}?kieGotContent = true;/.test(ts),
   "失败形态恰恰是 message_start 正常、一个 delta 都没有");
ok("fetch 显式传 signal(makeTimeoutFetch 才会原样放行, 由 tHard 接管硬超时)",
   /signal: kieAc\.signal,/.test(ts));
ok("abort 被就地收住, 转成 kieStreamErr 走同一条降级判断",
   /\} catch \(e\) \{[\s\S]{0,700}?kieStreamErr = kieAbortReason \|\| String\(\(e as Error\)\?\.message \|\| e\);/.test(ts),
   "不收住 → 一次主动掐断变成整条 callLlm 异常, 连降级到下一家的机会都没有");
ok("两个计时器在 finally 里一起清掉",
   /\} finally \{\s*\n?\s*clearTimeout\(tStall\); clearTimeout\(tHard\);\s*\n?\s*\}/.test(ts));
const respGuards = (ts.match(/if \(!resp\) resp = new Response\(null, \{ status: 504/g) || []).length;
ok("resp 的 undefined 兜底在【两条】提前退出的路上都有", respGuards === 2,
   `找到 ${respGuards} 处, 期望 2(budget-exhausted 与 catch)—— 循环外要读 resp.ok, 拿 undefined 会当场崩`);
ok("预算与次数都可用 env 覆盖(批量时压低, 不用再发一次版)",
   /Number\(process\.env\.KIE_RETRY_BUDGET_MS \|\| 45_000\)/.test(ts)
   && /Number\(process\.env\.KIE_MAX_ATTEMPTS \|\| 3\)/.test(ts));
ok("默认值没变(45s / 3 次), 不改既有行为",
   /\|\| 45_000\)\)/.test(ts) && /\|\| 3\)\)/.test(ts));
ok("no_available_account 立刻跳下一家那条(W2053)没被动坏",
   /if \(\/no_available_account\/i\.test\(kieStreamErr \|\| ""\)\) \{/.test(ts));

console.log(`\n${fail === 0 ? "全部通过" : "有不通过项"}: ${pass} 过 / ${fail} 不过`);
process.exit(fail === 0 ? 0 : 1);
