import fs from "fs"; import os from "os"; import path from "path";
import { execFileSync } from "child_process";
import { parseMusicXml } from "../src/musicxml";
import { buildFramePlan, faithfulFramePrompt, framesToSrt } from "../src/score-visuals";
function readScore(p: string): string {
  if (!/\.mxl$/i.test(p)) return fs.readFileSync(p, "utf8");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "mxl_"));
  execFileSync("unzip", ["-o", "-q", p, "-d", d]);
  const walk = (x: string): string[] => fs.readdirSync(x, {withFileTypes:true}).flatMap(e => e.isDirectory()?walk(path.join(x,e.name)):[path.join(x,e.name)]);
  return fs.readFileSync(walk(d).find(z=>/\.(musicxml|xml)$/i.test(z)&&!/META-INF/i.test(z))!, "utf8");
}
const mx = parseMusicXml(readScore(process.argv[2]!));
const v1 = mx.verses[0]!;
const frames = buildFramePlan(v1.lines, mx.duration_ms);
console.log("帧数 =", frames.length, " (= 第1段行数", v1.lines.length, ")");
console.log("\n── 帧时间轴(全部来自乐谱, 零估算) ──");
for (const f of frames.slice(0,4)) console.log(`  [${(f.ts_ms/1000).toFixed(2)}s → ${(f.end_ms/1000).toFixed(2)}s]  ${f.text}`);
console.log("\n── 第1帧的完整提示词 ──\n" + frames[0]!.prompt.split(". ").map(x=>"  "+x).join(".\n"));
console.log("\n── 纪律自检 ──");
const p = frames[0]!.prompt;
const checks: [string, boolean][] = [
  ["含歌词原文", p.includes(frames[0]!.text)],
  ["禁止添加人物/事件", /Do NOT add people, objects, animals, events/.test(p)],
  ["禁止延续叙事", /Do NOT continue or anticipate the narrative/.test(p)],
  ["抽象句也不许编", /invent nothing/.test(p)],
  ["禁止文字水印", /No text, no lettering/.test(p)],
  ["全曲同一风格锚点", frames.every(f => f.prompt.includes("the same artistic hand"))],
];
for (const [n, ok] of checks) console.log((ok ? "  ✅ " : "  ❌ ") + n);
console.log("\n── SRT 前 2 条(时间来自乐谱) ──");
console.log(framesToSrt(frames).split("\n\n").slice(0,2).map(b=>b.split("\n").map(x=>"  "+x).join("\n")).join("\n"));
