/* 乐谱 → MIDI 冒烟测试。用法: npx tsx scripts/score-to-midi.ts <file.mxl> <out.mid> */
import fs from "fs"; import os from "os"; import path from "path";
import { execFileSync } from "child_process";
import { parseMusicXml } from "../src/musicxml";
import { buildMidi } from "../src/musicxml-audio";

function readScore(p: string): string {
  if (!/\.mxl$/i.test(p)) return fs.readFileSync(p, "utf8");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "mxl_"));
  execFileSync("unzip", ["-o", "-q", p, "-d", d]);
  const walk = (x: string): string[] => fs.readdirSync(x, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? walk(path.join(x, e.name)) : [path.join(x, e.name)]);
  const f = walk(d).find((z) => /\.(musicxml|xml)$/i.test(z) && !/META-INF/i.test(z))!;
  const xml = fs.readFileSync(f, "utf8"); fs.rmSync(d, { recursive: true, force: true }); return xml;
}
(async () => {
  const mx = parseMusicXml(readScore(process.argv[2]!));
  console.log("title=%s  tempo=%d  duration=%ss", mx.title, mx.tempo_bpm, (mx.duration_ms/1000).toFixed(1));
  console.log("notes=%d  parts=%d  words(v1)=%d", mx.notes.length, new Set(mx.notes.map(n=>n.part)).size, mx.verses[0]?.words.length ?? 0);
  const ps = mx.notes.map(n=>n.midi);
  console.log("音高范围: MIDI %d..%d  (中央C=60)", Math.min(...ps), Math.max(...ps));
  console.log("前6个音符:", mx.notes.slice(0,6).map(n=>`${n.midi}@${n.ts_ms}ms×${n.end_ms-n.ts_ms}`).join("  "));
  console.log("告警:", mx.warnings.length ? mx.warnings.join(" | ") : "(无)");
  fs.writeFileSync(process.argv[3]!, await buildMidi(mx));
  console.log("✅ MIDI 写出:", process.argv[3], fs.statSync(process.argv[3]!).size, "bytes");
})();
