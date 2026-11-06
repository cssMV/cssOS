#!/usr/bin/env node
/* W2272 存量回填 —— 用 ffprobe 实测, 把 `work_media_versions.duration_secs`
 * 那些【空着的格子】填上。
 *
 * 为什么要填: 时长为空不报错、不降级, 胶囊上只是不显示长度 —— 可巡检的
 * 「唱词末尾超出音频」(OVERRUN)与「幽灵尾奏」(OUTRO_OVER)两项【根本判不了】。
 * W2270 全库实测 54 处「判不了」, 绝大多数就是这一个原因。看不见的漏判比看得见的错难查。
 *
 * 为什么只能实测, 不能推算:
 *   · 不许拿同一条轨别的 ♪ 的时长顶 —— 那正是 W2267 那个 207 秒幽灵尾奏的做法。
 *   · 不许拿生成时传给引擎的 duration_secs 顶 —— 那是【要求】, 不是【结果】。
 *
 * 安全性(这是写库, 所以三条都写死在 SQL 里):
 *   · 只 UPDATE `duration_secs IS NULL` 的行 —— 实测出来的数再准也不覆盖已有值。
 *   · 一行一条 UPDATE, 带 url 二次匹配; 不批量、不用 CTE 连写。
 *   · 默认【干跑】, 只打印会写什么。真写必须显式 --apply。
 * 一个字节都不删: duration_secs 是个数字列, 填空格子不动任何媒体。
 *
 * 在 api-vm 上跑(要 DATABASE_URL + ffprobe):
 *   set -a; . /etc/cssos.env; set +a
 *   node scripts/backfill-version-duration.mjs            # 干跑
 *   node scripts/backfill-version-duration.mjs --apply    # 真写
 *   node scripts/backfill-version-duration.mjs --apply --limit=20
 */
import { spawn } from "node:child_process";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0) || 0;
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("没有 DATABASE_URL —— 先 `set -a; . /etc/cssos.env; set +a`"); process.exit(2); }

/** 与 src/index.ts 的 probeRemoteDurationSecs 同一条命令。拿不到就 null —— 绝不猜。 */
function probe(url) {
  return new Promise((resolve) => {
    let out = "", done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const ff = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration",
                                   "-of", "default=noprint_wrappers=1:nokey=1", url]);
      const t = setTimeout(() => { try { ff.kill("SIGKILL"); } catch {} fin(null); }, 60000);
      ff.stdout.on("data", (b) => { out += b.toString(); });
      ff.on("error", () => { clearTimeout(t); fin(null); });
      ff.on("close", () => {
        clearTimeout(t);
        const n = Math.round(parseFloat(out.trim()));
        fin(Number.isFinite(n) && n > 0 ? n : null);
      });
    } catch { fin(null); }
  });
}

const pool = new pg.Pool({ connectionString: DB, max: 2 });
const { rows } = await pool.query(
  `SELECT id, work_id, lang, version_no, label, url
     FROM work_media_versions
    WHERE kind = 'audio' AND url IS NOT NULL AND url <> '' AND duration_secs IS NULL
    ORDER BY work_id, COALESCE(lang,''), version_no`
  + (LIMIT ? ` LIMIT ${LIMIT}` : ""));

console.log(`${APPLY ? "真写" : "干跑"} —— 空着时长的音频版本行: ${rows.length} 条\n`);

let wrote = 0, unprobed = 0, raced = 0;
/* 12 条的 url 存的是【相对路径】(如 /personalization-templates/welcome/en.v1/base.mp3),
 * ffprobe 当然读不到。实测这些文件在应用域名上(cssstudio.app 返回 206), 不在 CDN 上
 * (cdn.cssstudio.app 返回 404)—— 和前端按同源相对路径取它是一回事。
 * 只用来【读】: 库里那一列原样不动, 不顺手把它改成绝对地址(那是另一件事, 要先问)。 */
const ORIGIN = process.env.CSSOS_ORIGIN || "https://cssstudio.app";
const probeUrl = (u) => (/^https?:\/\//i.test(u) ? u : ORIGIN + (u.startsWith("/") ? u : "/" + u));

for (const [i, r] of rows.entries()) {
  const d = await probe(probeUrl(r.url));
  const tag = `[${i + 1}/${rows.length}] id=${r.id} ${String(r.lang || "-")}#${r.version_no} …${r.url.slice(-26)}`;
  if (!d) { unprobed++; console.log(`${tag}  ✗ 量不到(保持为空, 不猜)`); continue; }
  if (!APPLY) { console.log(`${tag}  → 会写 ${d}s`); continue; }
  /* `AND duration_secs IS NULL` 是第二道闸: 干跑到真写之间若有别的路径填了值, 让它赢。 */
  const up = await pool.query(
    `UPDATE work_media_versions SET duration_secs = $3
      WHERE id = $1 AND url = $2 AND duration_secs IS NULL`, [r.id, r.url, d]);
  if (up.rowCount) { wrote++; console.log(`${tag}  ✓ ${d}s`); }
  else { raced++; console.log(`${tag}  ⟲ 期间已被填上, 不动`); }
}

const { rows: [left] } = await pool.query(
  `SELECT count(*)::int AS n FROM work_media_versions
    WHERE kind='audio' AND url IS NOT NULL AND url <> '' AND duration_secs IS NULL`);
console.log(`\n清单 ${rows.length} 条 · ${APPLY ? `写了 ${wrote}` : "干跑没写"}`
          + ` · 量不到 ${unprobed}(不是「对」, 是没量到)`
          + (raced ? ` · 期间已被填 ${raced}` : "")
          + `\n库里现在仍为空: ${left.n} 条`);
await pool.end();
