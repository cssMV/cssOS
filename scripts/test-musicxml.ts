/* CSSOS_WAVE_1697 — 歌谱解析冒烟测试。用法: npx tsx scripts/test-musicxml.ts <file.mxl|.musicxml> */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { parseMusicXml } from "../src/musicxml";

function readScore(p: string): string {
  if (!/\.mxl$/i.test(p)) return fs.readFileSync(p, "utf8");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mxl_"));
  execFileSync("unzip", ["-o", "-q", p, "-d", dir]);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const score = walk(dir).find((f) => /\.(musicxml|xml)$/i.test(f) && !/META-INF/i.test(f));
  if (!score) throw new Error("musicxml_not_found_in_mxl");
  const xml = fs.readFileSync(score, "utf8");
  fs.rmSync(dir, { recursive: true, force: true });
  return xml;
}

const r = parseMusicXml(readScore(process.argv[2]!));
console.log("ok=%s  exact_timing=%s", r.ok, r.ok);
console.log("title=%s   composer=%s", r.title, r.composer);
console.log("tempo=%dbpm  divisions=%d  duration=%ss", r.tempo_bpm, r.divisions, (r.duration_ms / 1000).toFixed(1));
console.log("verses:", r.verses.map((v) => `#${v.verse} ${v.words.length}词/${v.lines.length}行`).join("   "));
const v1 = r.verses[0]!;
console.log("\n── 第1段 · 逐字时间轴(前10) ──");
for (const w of v1.words.slice(0, 10)) console.log(`  ${String(w.ts_ms).padStart(6)} → ${String(w.end_ms).padStart(6)} ms   ${w.word}`);
console.log("\n── 第1段 · 断行 ──");
for (const l of v1.lines.slice(0, 5)) console.log(`  [${(l.ts_ms! / 1000).toFixed(2)}s] ${l.text}`);
console.log("\n── 第2段 · 独立成段(旧解析器会把两段混在一起) ──");
console.log("  " + (r.verses[1]?.lines[0]?.text ?? "(无第2段)"));
console.log("\n── 源谱质量告警 ──");
console.log(r.warnings.length ? r.warnings.map((w) => "  ⚠️  " + w).join("\n") : "  (无)");
