/* W2120 验收: 演播厅映射。
 * 最硬的一条 —— 【没命中时必须逐字节等于今天的通用厅】, 否则就是在没人要求的地方改了观感。 */
const fs = require("fs"), vm = require("vm");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync("/Users/cssos/cssOS/public/app.actor-stage.js", "utf8"), ctx);
const S = ctx.cssosStageForActor, B = ctx.cssosStageBase;

let pass = 0, fail = 0;
const eq = (n, g, w) => {
  const a = JSON.stringify(g), b = JSON.stringify(w);
  if (a === b) { pass++; console.log("  ✅ " + n); }
  else { fail++; console.log("  ❌ " + n + "\n       得到 " + a + "\n       应为 " + b); }
};

// 今天那一组(直接抄自 app.actor-gallery.js 改动前的 CSS, 逐字节)
const TODAY = {
  key: "rgba(0,245,160,0.13)", left: "rgba(70,130,220,0.11)", right: "rgba(180,70,170,0.10)",
  bg: ["#0a1712", "#05100c", "#020906"], floor: "rgba(0,245,160,0.045)"
};

console.log("── 1. 零回归: 没有 civilization / 认不出来 → 必须等于今天 ──");
for (const [name, a] of [
  ["null", null], ["空对象", {}],
  ["原创演员(无 civ)", { actor_id: "act-user-xyz", archetypes: ["villain"] }],
  ["认不出的 civ", { actor_id: "x", civilization: "火星联邦", archetypes: ["sage"] }],
]) {
  const r = S(a);
  eq(name + " → 五个值与今天逐字节相同",
     { key: r.key, left: r.left, right: r.right, bg: r.bg, floor: r.floor }, TODAY);
}

console.log("── 2. 妲己: 按 actor_id 命中专门设计的厅, 且不被戏路二次调制 ──");
const daji = S({ actor_id: "act-legend-daji", civilization: "中华神话", archetypes: ["tragic", "enigma"] });
eq("厅 id", daji.id, "hall-chaoge");
eq("顶光=青铜火把琥珀", daji.key, "rgba(214,158,74,0.17)");
eq("左侧=远处焚城暗红", daji.left, "rgba(178,58,38,0.15)");
eq("右侧=冷玉青白的月", daji.right, "rgba(126,158,150,0.10)");
eq("不是通用厅", daji.key === TODAY.key, false);

console.log("── 3. 同文明不同戏路 → 同色系、不同强弱(颜色归文明, 气质归戏路) ──");
const sage = S({ actor_id: "a", civilization: "中华文明", archetypes: ["sage"] });
const trag = S({ actor_id: "b", civilization: "中华文明", archetypes: ["tragic"] });
const rgb = (c) => String(c).replace(/,[\d.]+\)$/, ")");
eq("顶光同色系", rgb(sage.key), rgb(trag.key));
eq("sage 顶光比 tragic 亮", parseFloat(/([\d.]+)\)$/.exec(sage.key)[1]) > parseFloat(/([\d.]+)\)$/.exec(trag.key)[1]), true);
eq("tragic 侧光比 sage 强", parseFloat(/([\d.]+)\)$/.exec(trag.left)[1]) > parseFloat(/([\d.]+)\)$/.exec(sage.left)[1]), true);

console.log("── 4. 子串匹配的顺序陷阱: 中华神话 ≠ 中华文明, 近现代欧洲 ≠ 近代欧洲 ──");
eq("中华神话 → 青铜厅", S({ actor_id: "x", civilization: "中华神话" }).id, "hall-shang-bronze");
eq("中华文明 → 墨色厅", S({ actor_id: "x", civilization: "中华文明" }).id, "hall-ink-court");
eq("日本神话 → 狐火", S({ actor_id: "x", civilization: "日本神话" }).id, "hall-foxfire");
eq("日本古典 → 障子", S({ actor_id: "x", civilization: "日本古典" }).id, "hall-shoji");
eq("近现代欧洲 → 黑板", S({ actor_id: "x", civilization: "近现代欧洲" }).id, "hall-chalkboard");
eq("近代欧洲 → 烛蜡", S({ actor_id: "x", civilization: "近代欧洲" }).id, "hall-candlewax");
eq("印度教神话 → 庙灯", S({ actor_id: "x", civilization: "印度教神话" }).id, "hall-temple-lamp");
eq("印度文明 → 檀香", S({ actor_id: "x", civilization: "印度文明" }).id, "hall-sandal");

console.log("── 5. alpha 永远合法, 不会被戏路乘爆 ──");
let bad = [];
const civs = ["中华神话","中华文明","日本神话","日本古典","朝鲜古典","北欧神话","古希腊神话","古罗马文明",
  "古埃及神话","美索不达米亚神话","波斯文明","阿拉伯文明","印度教神话","印度文明","希伯来文明","凯尔特文明",
  "斯拉夫神话","文艺复兴欧洲","启蒙欧洲","近现代欧洲","近代欧洲","葡萄牙文明","巴西文明","阿兹特克文明",
  "Cyberpunk","Neo-Futurist","Dark Fantasy","Dark Carnival","Noir","Cosmic"];
const arcs = ["tragic","villain","enigma","ruler","sage","charmer","action","comic"];
let n = 0;
for (const c of civs) for (const ar of arcs) {
  const r = S({ actor_id: "x", civilization: c, archetypes: [ar] }); n++;
  for (const k of ["key", "left", "right", "floor"]) {
    const m = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\)$/.exec(r[k]);
    if (!m) { bad.push(`${c}/${ar}.${k} 格式坏了: ${r[k]}`); continue; }
    const a = parseFloat(m[1]);
    if (!(a >= 0 && a <= 0.35)) bad.push(`${c}/${ar}.${k} alpha=${a} 越界`);
  }
  if (!Array.isArray(r.bg) || r.bg.length !== 3) bad.push(`${c}/${ar}.bg 不是三段`);
}
console.log(`  清单 ${civs.length}×${arcs.length}=${civs.length*arcs.length} 组, 实际查了 ${n} 组`);
eq("全部 alpha 合法且不刺眼(≤0.35)", bad.slice(0, 3), []);

console.log("── 6. 每个文明都真有一间自己的厅(没有偷偷落回通用) ──");
const fellBack = civs.filter((c) => S({ actor_id: "x", civilization: c }).id === "hall-default");
eq("没有落回通用厅的文明", fellBack, []);

console.log("\n" + (fail ? "❌ " + fail + " 条不过" : "✅ 全过") + `  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
