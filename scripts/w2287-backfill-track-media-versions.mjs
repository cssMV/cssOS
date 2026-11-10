#!/usr/bin/env node
/* W2287 —— 给【语言轨/声线轨】补上 work_media_versions 里缺的音频版本行。
 *
 * 为什么会缺: renderLanguageTrack(每条语言轨/声线轨的必经之路)从来没调过
 * registerMediaVersion。代码侧已在 W2287 补上闸门, 这个脚本补存量。
 * 实测后果: 贝多芬 2026-11-09 那条 293s 真音轨能播、字幕也挂上了,
 * 但版本胶囊里查不到它 —— 对用户等于不存在。
 *
 * ── 三条写死的自保 ────────────────────────────────────────────────────────
 * 1. 【只增不改】。只 INSERT 缺的行; 已存在的行一个字节都不动(版本铁律)。
 * 2. 【不抢 is_current】。只有当 (work,lang,kind=audio) 一条 current 都没有时,
 *    才把这一批里的 ♪1 设成 current。已经有 current 的, 新增行一律 is_current=false,
 *    并把「轨在播的音频 ≠ 版本表的 current」这种不一致【报出来, 不私自改】——
 *    改它会改变用户在胶囊里看到的默认版, 那是另一件事, 要先问 Jing。
 * 3. 【时长各测各的, 绝不互借】。♪1 用 duration_secs, ♪2 用 alt_duration_secs;
 *    为空就 ffprobe 自己那条 URL。拿 ♪1 的时长顶 ♪2 正是 W2267 那个 207 秒幽灵尾奏。
 *
 * 默认干跑, 真写必须 --apply。每条回写后【回读核对】——
 * 唯一可信的判据是回读(psql 的命令标签会被 -q 吞掉, W2282 栽过)。
 *
 * 用法(api-vm, 要 DATABASE_URL + ffprobe):
 *   node scripts/w2287-backfill-track-media-versions.mjs
 *   node scripts/w2287-backfill-track-media-versions.mjs --work=<id,...>
 *   node scripts/w2287-backfill-track-media-versions.mjs --apply
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
    setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* already gone */ } }, 120000);
  });
}

const c = new pg.Client({ connectionString: DB });
await c.connect();

const where = ONLY ? `AND t.work_id = ANY($1::uuid[])` : ``;
const args = ONLY ? [ONLY.split(",").map((s) => s.trim()).filter(Boolean)] : [];

/* 清单: 已就绪且有音频的轨, 展开成「每颗 ♪ 一行」, 只留【版本表里没有这条 url】的。 */
const { rows } = await c.query(
  `WITH takes AS (
     SELECT t.work_id::text AS work_id, t.lang, t.voice, 1 AS take,
            t.audio_url AS url, t.duration_secs AS dur, t.is_default
       FROM work_language_tracks t
      WHERE t.status='ready' AND coalesce(t.audio_url,'') <> '' ${where}
     UNION ALL
     SELECT t.work_id::text, t.lang, t.voice, 2,
            t.alt_audio_url, t.alt_duration_secs, t.is_default
       FROM work_language_tracks t
      WHERE t.status='ready' AND coalesce(t.alt_audio_url,'') <> '' ${where}
   )
   SELECT k.*, left(coalesce(w.title,''),24) AS title,
          EXISTS (SELECT 1 FROM work_media_versions v
                   WHERE v.work_id=k.work_id::uuid AND v.kind='audio' AND v.is_current
                     AND coalesce(v.lang,'')=coalesce(k.lang,'')) AS has_current
     FROM takes k LEFT JOIN user_works w ON w.id = k.work_id::uuid
    WHERE NOT EXISTS (SELECT 1 FROM work_media_versions v
                       WHERE v.work_id=k.work_id::uuid AND v.kind='audio' AND v.url=k.url)
    /* 【默认轨排最前】—— 首跑没排, 结果同语言有多条轨时 current 被先遇到的那条抢走,
     * 于是「版本表的 current」与「默认轨真在播的音频」对不上(实测当场多出 2 个:
     * 两首 Dog walker 的 current 落到昨天新做的版本上, 而默认轨播的还是旧版)。
     * current 必须跟着【真在播的那条】走 —— 它才是用户听到的东西。 */
    ORDER BY k.work_id, k.lang, k.is_default DESC, k.voice, k.take`, args);

console.log(`版本表里缺行的 ♪ : ${rows.length} 条${APPLY ? "  [--apply 真写]" : "  [干跑]"}`);

let done = 0, bad = 0, probed = 0, madeCurrent = 0;
/* 同一个 (work,lang) 在这一批里只许有一颗 ♪ 成为 current —— 否则后一条会把前一条抢掉。 */
const currentClaimed = new Set();

for (const r of rows) {
  const vl = r.voice && r.voice !== "auto" ? `${r.voice} ` : "";
  const label = `${vl}♪${r.take}`;
  let dur = Number(r.dur) > 1 ? Math.round(Number(r.dur)) : null;
  if (!dur) {                                   // 为空就实测【自己这条 URL】, 不借别的 ♪ 的
    dur = await ffprobe(r.url);
    if (dur) probed++;
  }
  const key = `${r.work_id}|${r.lang || ""}`;
  /* 只有【默认轨的 ♪1】才配当 current —— current 要跟着真在播的那条走(见上面 ORDER BY)。
   * 非默认轨即便这条语言一条 current 都没有, 也不许自己立; 宁可留空让人去查,
   * 也不要立一个与播放不一致的 current。 */
  const makeCurrent = r.take === 1 && r.is_default && !r.has_current && !currentClaimed.has(key);

  const tag = `${r.work_id.slice(0, 8)} ${r.lang}/${r.voice} ♪${r.take} ${label}`;
  console.log(`  ${tag}  ${dur ? dur + "s" : "时长测不到(写 NULL, 不猜)"}`
            + `${makeCurrent ? "  → 设为 current(这条轨本来一条 current 都没有)" : ""}`
            + `  ${r.title}`);

  if (!APPLY) { done++; continue; }

  try {
    await c.query("BEGIN");
    if (makeCurrent) {
      await c.query(
        `UPDATE work_media_versions SET is_current=false
          WHERE work_id=$1::uuid AND kind='audio'
            AND coalesce(lang,'')=coalesce($2,'') AND is_current`,
        [r.work_id, r.lang]);
    }
    await c.query(
      `INSERT INTO work_media_versions
         (work_id, kind, lang, version_no, label, url, duration_secs, is_current)
       SELECT $1::uuid, 'audio', $2,
              COALESCE((SELECT max(version_no) FROM work_media_versions
                         WHERE work_id=$1::uuid AND kind='audio'
                           AND coalesce(lang,'')=coalesce($2,'')), 0) + 1,
              $3, $4, $5, $6
       ON CONFLICT DO NOTHING`,
      [r.work_id, r.lang, label, r.url, dur, makeCurrent]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.log(`    FAIL 写库: ${String(e?.message || e).slice(0, 140)}`);
    bad++; continue;
  }

  /* 回读 —— 写了不等于写进去了。ON CONFLICT DO NOTHING 会把失败吞成「什么也没发生」。 */
  const { rows: back } = await c.query(
    `SELECT id, coalesce(label,'') AS label, coalesce(duration_secs,0) AS dur, is_current
       FROM work_media_versions
      WHERE work_id=$1::uuid AND kind='audio' AND url=$2`, [r.work_id, r.url]);
  if (!back.length) { console.log("    FAIL 回读查不到这一行 —— 没写进去"); bad++; continue; }
  if (back[0].label !== label) { console.log(`    FAIL 回读 label 是 '${back[0].label}'`); bad++; continue; }
  if (makeCurrent) {
    if (!back[0].is_current) { console.log("    FAIL 回读 is_current 没立起来"); bad++; continue; }
    madeCurrent++;
  }
  currentClaimed.add(key);
  done++;
}

console.log(`\n汇总: 清单 ${rows.length} · 写好 ${done} · 不过 ${bad}`
          + ` · 实测补时长 ${probed} · 新立 current ${madeCurrent}${APPLY ? "" : "  [干跑]"}`);

/* 另报(不改): 轨在播的音频 ≠ 版本表 current。改它会改变用户看到的默认版, 要先问 Jing。 */
const { rows: mism } = await c.query(
  `SELECT count(*)::int AS n FROM work_language_tracks t
    WHERE t.status='ready' AND coalesce(t.audio_url,'') <> '' AND t.is_default
      AND EXISTS (SELECT 1 FROM work_media_versions v
                   WHERE v.work_id=t.work_id AND v.kind='audio' AND v.is_current
                     AND coalesce(v.lang,'')=coalesce(t.lang,'') AND v.url <> t.audio_url)`);
console.log(`另报(本脚本不改): 默认轨在播的音频 ≠ 版本表 current 的作品 ${mism[0].n} 个`);

if (done + bad !== rows.length) { console.error("FAIL: 账对不上"); await c.end(); process.exit(1); }
await c.end();
process.exit(bad ? 1 : 0);
