#!/usr/bin/env node
/* W2281 —— 把 work_language_tracks.duration_secs 那些【空着的格子】用 ffprobe 实测填上。
 *
 * 为什么必须填: 时长为空不报错、不降级, 胶囊上只是不显示长度 —— 但可巡检的
 * 「唱词末尾超出音频」(OVERRUN)与「幽灵尾奏」(OUTRO_OVER)两项【根本判不了】,
 * 看不见的漏判比看得见的错难查(W2270 全库实测 54 处「判不了」多半是这个原因)。
 *
 * 由来: W2279 这一批 18 首做成的里有 2 首(Napoleon 524bab57 / Descartes 18fc4522)
 * 的 ♪1 duration_secs 是 NULL, 而 ♪2 的 alt_duration_secs 有值。
 * 成因是 renderLanguageTrack 里 `music.duration_s` 没回, 而紧跟的 ffprobe 兜底也没成。
 *
 * 为什么只能实测, 不能推算(照抄 backfill-version-duration.mjs 的三条, 不另立):
 *   · 不许拿同一条轨别的 ♪ 的时长顶 —— 那正是 W2267 那个 207 秒幽灵尾奏的做法。
 *   · 不许拿生成时传给引擎的 duration_secs 顶 —— 那是【要求】, 不是【结果】。
 *   · 不许拿 alt_duration_secs 顶 ♪1 —— 两颗 ♪ 是两段不同的音频。
 *
 * 安全性(写库, 三条写死):
 *   · 只 UPDATE `duration_secs IS NULL` 的行 —— 实测再准也不覆盖已有值。
 *   · 一行一条 UPDATE, 带 audio_url 二次匹配(URL 变了说明轨已被换, 不写)。
 *   · 默认【干跑】, 真写必须显式 --apply。
 *
 * 用法(api-vm, 要 DATABASE_URL + ffprobe):
 *   node scripts/w2281-fill-null-track-duration.mjs                  # 干跑, 全库
 *   node scripts/w2281-fill-null-track-duration.mjs --work=<id,...>  # 只看这几首
 *   node scripts/w2281-fill-null-track-duration.mjs --apply
 */
import { spawn } from "node:child_process";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--work=")) || "").split("=")[1] || "";
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("FAIL: 没有 DATABASE_URL —— 别继续, 否则下面每条结论都是空的"); process.exit(1); }

function ffprobe(url) {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration",
                                "-of", "default=noprint_wrappers=1:nokey=1", url]);
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.on("error", () => resolve(null));
    p.on("close", () => {
      const n = Number(String(out).trim());
      resolve(Number.isFinite(n) && n > 1 ? Math.round(n) : null);
    });
    setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 120000);
  });
}

const c = new pg.Client({ connectionString: DB });
await c.connect();
const where = ONLY
  ? `AND work_id = ANY($1::uuid[])`
  : ``;
const args = ONLY ? [ONLY.split(",").map((s) => s.trim()).filter(Boolean)] : [];
const { rows } = await c.query(
  `SELECT work_id::text AS work_id, lang, voice, audio_url, alt_duration_secs
     FROM work_language_tracks
    WHERE duration_secs IS NULL AND audio_url IS NOT NULL ${where}
    ORDER BY work_id, lang, voice`, args);
console.log(`duration_secs 为空且有音频的轨: ${rows.length} 条${APPLY ? "  [--apply 真写]" : "  [干跑]"}`);
let filled = 0, unknown = 0, changed = 0;
for (const r of rows) {
  const d = await ffprobe(r.audio_url);
  if (!d) {
    unknown++;
    console.log(`  ${r.work_id.slice(0, 8)} ${r.lang}/${r.voice}  实测不到 —— 跳过(【测不到】不等于【没有】, 不猜)`);
    continue;
  }
  console.log(`  ${r.work_id.slice(0, 8)} ${r.lang}/${r.voice}  ♪1 实测 ${d}s`
            + (r.alt_duration_secs ? `  (♪2 库里是 ${r.alt_duration_secs}s, 不拿它顶)` : ""));
  if (!APPLY) { filled++; continue; }
  const up = await c.query(
    `UPDATE work_language_tracks SET duration_secs=$4, updated_at=now()
      WHERE work_id=$1::uuid AND lang=$2 AND voice=$3
        AND duration_secs IS NULL AND audio_url=$5`,
    [r.work_id, r.lang, r.voice, d, r.audio_url]);
  if (up.rowCount === 1) { filled++; changed++; }
  else console.log(`    ⚠ 影响 ${up.rowCount} 行 —— 这一行在我读它之后变了, 没写`);
}
// 回读核对 —— 写了不等于写进去了(work_id 只能查不能想)
if (APPLY && changed) {
  const { rows: back } = await c.query(
    `SELECT count(*)::int AS n FROM work_language_tracks
      WHERE duration_secs IS NULL AND audio_url IS NOT NULL ${where}`, args);
  console.log(`回读: 仍为空的还有 ${back[0].n} 条`);
}
console.log(`汇总: 可填 ${filled} · 实测不到 ${unknown} · 真写 ${changed} / 清单 ${rows.length}`
          + (filled + unknown === rows.length ? "  OK" : "  ⚠ 对不上"));
await c.end();
