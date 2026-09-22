/* W2136 回归测试 —— 混排行的切分单位。
 *
 * ⚠ 这是源逻辑的【镜像】, 不是直接 import(src/index.ts 单文件 3MB, 没有导出这段)。
 *   镜像会漂移, 所以改 src/index.ts 里那段切分时必须同步改这里 ——
 *   它的价值在于把"纯中文行/纯拉丁行结果不变"这条钉死, 防止修混排时把老行为改坏。
 *
 * 病: 原来按【整行】判 hasCjk, 于是京典咒语行「拉丁文：Tempus fugit」整行被逐字母切,
 *     屏幕上是 `T e m p u s f u g i t`, 且单元数暴涨导致与 whisper 的词一一配对全错位。
 */
const isCjkChar = (c) => /[一-鿿぀-ヿ가-힯฀-๿ក-៿຀-໿က-႟]/.test(c);
const isJunk = (t) => !t || !t.trim();
const strip = (w) => w.replace(/^[*_`]+|[*_`]+$/g, "");

function split(line) {                       // 与 src/index.ts 的实现一一对应
  const units = [];
  const pushWord = (w) => { const c = strip(w); if (c && !isJunk(c)) units.push(c); };
  let buf = "";
  const flush = () => { if (buf.trim()) buf.split(/\s+/).forEach(pushWord); buf = ""; };
  for (const ch of line) {
    if (isCjkChar(ch)) { flush(); if (ch.trim() && !isJunk(ch)) units.push(ch); }
    else buf += ch;
  }
  flush();
  return units;
}

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) console.log(`     得到 ${JSON.stringify(got)}\n     期望 ${JSON.stringify(want)}`);
};

// ① 老行为不许变: 纯中文仍逐字
eq("纯中文逐字", split("风起渭水"), ["风", "起", "渭", "水"]);
// ② 老行为不许变: 纯拉丁仍逐词
eq("纯拉丁逐词", split("Tempus fugit sed veritas manet"),
   ["Tempus", "fugit", "sed", "veritas", "manet"]);
// ③ 真正要修的: 混排行 —— 中文逐字, 拉丁逐词(而不是整行逐字母)
eq("混排: 中文逐字 + 拉丁逐词", split("拉丁文 Tempus fugit"),
   ["拉", "丁", "文", "Tempus", "fugit"]);
// ④ 病症复现判据: 拉丁部分绝不能出现单字母 token
const m = split("拉丁文：Tempus fugit, sed veritas manet");
eq("混排: 拉丁部分无单字母 token",
   m.filter((t) => /^[A-Za-z]$/.test(t)), []);
// ⑤ 日文/韩文同样逐字, 且不吃掉同行的拉丁词
eq("日文混排", split("祇園 Gion の鐘"), ["祇", "園", "Gion", "の", "鐘"]);
eq("韩文混排", split("판소리 Pansori"), ["판", "소", "리", "Pansori"]);
// ⑥ 单元数量不再暴涨(这是鲁米/16首那类错位的根源)
const long = "拉丁文：Per aspera ad astra";
eq("混排单元数合理", split(long).length, 3 + 4);   // 拉丁文(3字) + 4 个拉丁词

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
