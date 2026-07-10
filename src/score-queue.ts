/* CSSOS_WAVE_1700 20260710 — 乐谱忠实渲染的作业队列 + worker。
 *
 * Jing:「不管谁传多少谱子, 影院和面对面都不会卡一下。长久之计。」
 *
 * ── 为什么不是"换台服务器" ──────────────────────────────────────────────────
 * 实测: 一首 70s 曲子渲染 1.6s; 整本 600 首圣诗 ≈ 0.7 核·时。api-vm 有 4 核、
 * 负载 0.15 —— 算力根本不是瓶颈。真问题是【渲染跑在 HTTP 请求路径里】: 一首
 * 3 分钟圣诗阻塞 4 秒、占满一个核; 同时传 4 首就吃光 4 个核, 而这台机器还在跑
 * API / 影院 / 面对面。这与 f2f 和 MV 批渲染是同一类病:
 *
 *     延迟敏感的实时工作, 不能与吞吐导向的批处理共享同一个调度池。
 *
 * ── 两道闸(缺一不可)────────────────────────────────────────────────────────
 *   ① 队列 + 并发上限 1(可调) → "少占": 任何时刻最多一个渲染在跑。
 *   ② 子进程 nice -n 15      → "占了也让": CPU 争抢时几乎完全让位给实时进程。
 *
 * ── 什么留在请求里 ────────────────────────────────────────────────────────
 * 解析只要 ~50ms, 留在请求内 —— 用户上传即刻拿到【歌词 + 逐字时间轴】。
 * 只有渲染(秒级)进队列。上传体验一点不变慢。
 */
import fs from "fs";
import path from "path";
import { withClient } from "./db";
import { parseMusicXml } from "./musicxml";
import { renderScoreToAudio } from "./musicxml-audio";
import { buildFramePlanVerses, renderFramesToImages, assembleMv, extractPoster, renderCoverStill, scoreToSubtitleJson, type ImageGen } from "./score-visuals";

/** 任何时刻最多几个渲染在跑。默认 1 —— 宁可慢, 不可卡影院。 */
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.SCORE_RENDER_CONCURRENCY || 1)));
const POLL_MS = 2500;
const MAX_ATTEMPTS = 3;

export type ScoreRenderJob = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  title: string | null;
  audio_url: string | null;
  midi_url: string | null;
  mv_url: string | null;
  poster_url: string | null;
  subtitle_url: string | null;
  duration_secs: number | null;
  error: string | null;
  attempts: number;
};

export async function enqueueScoreRender(opts: {
  userId: string; xmlPath: string; outDir: string; urlPrefix: string; title: string | null;
  renderMv?: boolean; renderCover?: boolean; tradition?: string;
}): Promise<string> {
  const row = await withClient((c) => c.query<{ job_id: string }>(
    `INSERT INTO score_render_jobs (user_id, xml_path, out_dir, url_prefix, title, render_mv, render_cover, tradition)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING job_id`,
    [opts.userId, opts.xmlPath, opts.outDir, opts.urlPrefix, opts.title,
     opts.renderMv !== false, opts.renderCover === true, opts.tradition || "secular"],
  ));
  return row.rows[0]!.job_id;
}

export async function getScoreRenderJob(jobId: string, userId: string): Promise<ScoreRenderJob | null> {
  const r = await withClient((c) => c.query<ScoreRenderJob>(
    `SELECT job_id, status, title, audio_url, midi_url, mv_url, poster_url, subtitle_url, duration_secs, error, attempts
       FROM score_render_jobs WHERE job_id = $1::uuid AND user_id = $2::uuid`,
    [jobId, userId],
  ));
  return r.rows[0] || null;
}

/* ── worker ──────────────────────────────────────────────────────────────── */

let _running = 0;
let _timer: NodeJS.Timeout | null = null;
/* W1703 — 图像生成器由 index.ts 注入(它有 callImageGen)。worker 绝不 import index.ts ——
 * 那会触发服务器 listen(), 导致 EADDRINUSE。注入 = 单一来源, 又不引入模块副作用。 */
let _imageGen: ImageGen | null = null;
export function setScoreImageGen(gen: ImageGen) { _imageGen = gen; }

/** 原子取活: SKIP LOCKED 保证多进程/多实例下同一个 job 只被一个 worker 拿走。 */
async function claimNextJob(): Promise<{ job_id: string; xml_path: string; out_dir: string; url_prefix: string; attempts: number; render_mv: boolean; render_cover: boolean; tradition: string } | null> {
  const r = await withClient((c) => c.query(
    `UPDATE score_render_jobs SET status='running', started_at=now(), attempts=attempts+1
      WHERE job_id = (
        SELECT job_id FROM score_render_jobs
         WHERE status='queued' ORDER BY created_at
         FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING job_id, xml_path, out_dir, url_prefix, attempts, render_mv, render_cover, tradition`,
  ));
  return (r.rows[0] as any) || null;
}

async function finishJob(jobId: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await withClient((c) => c.query(
    `UPDATE score_render_jobs SET ${sets}, finished_at = now() WHERE job_id = $1::uuid`,
    [jobId, ...keys.map((k) => patch[k])],
  ));
}

async function runOne(job: { job_id: string; xml_path: string; out_dir: string; url_prefix: string; attempts: number; render_mv: boolean; render_cover?: boolean; tradition?: string }) {
  try {
    if (!fs.existsSync(job.xml_path)) throw new Error("xml_missing");
    const mx = parseMusicXml(fs.readFileSync(job.xml_path, "utf8"));
    if (!mx.ok || !mx.notes.length) throw new Error(mx.error || "no_notes");

    const r = await renderScoreToAudio(mx, job.out_dir);
    try { fs.unlinkSync(r.wavPath); } catch { /* 中间产物, 12MB, 不留 */ }

    const audioUrl = `${job.url_prefix}/${path.basename(r.mp3Path)}`;
    // W1712 — 一曲多段: 音频/字幕/画面的总时长 = 段数 × 单遍旋律时长。
    const verseCount = Math.max(1, mx.verses.length);
    const passMs = mx.duration_ms;
    const totalMs = verseCount * passMs;

    // W1706 — 圣诗字幕 JSON(逐字精确时间, 庄严档), 与音频同名。影院据此实时驱动情绪字幕。
    let subtitleUrl: string | null = null;
    try {
      const subJson = scoreToSubtitleJson(mx.verses, job.job_id, { passMs });
      const subName = `${path.basename(r.mp3Path, ".mp3")}.subtitles.json`;
      fs.writeFileSync(path.join(job.out_dir, subName), JSON.stringify(subJson));
      subtitleUrl = `${job.url_prefix}/${subName}`;
    } catch (e) {
      console.warn(`[score-render] subtitle json failed job=${job.job_id}:`, (e as Error)?.message || e);
    }

    /* W1703 — 忠实 MV: 逐行歌词一帧, 时间轴来自乐谱, 画面严格【忠于歌词、不加戏】(见 score-visuals.ts)。
     * 图像生成器没注入(或没帧)时, 只交付音频 —— 绝不因此卡住或去"发挥想象力"。 */
    let mvUrl: string | null = null;
    let posterUrl: string | null = null;
    const tradition = job.tradition || "secular";
    if (_imageGen && job.render_mv !== false && mx.verses[0]?.lines.length) {
      try {
        const frameDir = path.join(job.out_dir, `mv-${path.basename(r.mp3Path, ".mp3")}`);
        // W1721 — tradition 传入 → faithfulFramePrompt 施加本传统画面红线(伊斯兰不描绘先知/真主等)。
        const plan = buildFramePlanVerses(mx.verses, passMs, totalMs, undefined, tradition);
        const withImg = await renderFramesToImages(plan, _imageGen, frameDir);
        if (withImg.length) {
          const mp4 = path.join(job.out_dir, `${path.basename(r.mp3Path, ".mp3")}.mp4`);
          await assembleMv({ frames: withImg, audioPath: r.mp3Path, outPath: mp4, workDir: frameDir });
          mvUrl = `${job.url_prefix}/${path.basename(mp4)}`;
          // W1714 — 抽海报帧(分享 og:image)。
          const posterJpg = path.join(job.out_dir, `${path.basename(r.mp3Path, ".mp3")}.jpg`);
          if (await extractPoster(mp4, posterJpg)) posterUrl = `${job.url_prefix}/${path.basename(posterJpg)}`;
        }
        try { fs.rmSync(frameDir, { recursive: true, force: true }); } catch { /* 清中间帧 */ }
      } catch (e) {
        console.warn(`[score-render] mv failed (audio still delivered) job=${job.job_id}:`, (e as Error)?.message || e);
      }
    }

    /* W1721 — 音频-only 也要有【封面图】: 没跑 MV 但 render_cover=true 时, 出一张 2.39:1 影院封面
     * (第一句歌词, 忠实转换, 附本传统画面红线)。只一张图, 成本极低; 失败仍照常交付音频。 */
    if (!posterUrl && _imageGen && job.render_cover && mx.verses[0]?.lines.length) {
      try {
        const firstLine = mx.verses[0].lines.find((l) => String(l.text || "").trim())?.text || "";
        if (firstLine) {
          const coverJpg = path.join(job.out_dir, `${path.basename(r.mp3Path, ".mp3")}.cover.jpg`);
          if (await renderCoverStill(firstLine, tradition, _imageGen, coverJpg)) {
            posterUrl = `${job.url_prefix}/${path.basename(coverJpg)}`;
          }
        }
      } catch (e) {
        console.warn(`[score-render] cover failed (audio still delivered) job=${job.job_id}:`, (e as Error)?.message || e);
      }
    }

    await finishJob(job.job_id, {
      status: "done",
      audio_url: audioUrl,
      midi_url: `${job.url_prefix}/${path.basename(r.midiPath)}`,
      subtitle_url: subtitleUrl,
      mv_url: mvUrl,
      poster_url: posterUrl,
      duration_secs: Math.round(totalMs / 1000),   // W1712 — 全 N 遍总时长
      error: null,
    });
    console.log(`[score-render] done job=${job.job_id} notes=${mx.notes.length} mv=${mvUrl ? "yes" : "no"}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 还有重试余额 → 退回队列; 否则判死。绝不静默降级去"重新作曲"。
    const dead = job.attempts >= MAX_ATTEMPTS;
    await finishJob(job.job_id, dead ? { status: "failed", error: msg } : { status: "queued", error: msg });
    console.warn(`[score-render] ${dead ? "failed" : "retry"} job=${job.job_id}: ${msg}`);
  }
}

async function tick() {
  if (_running >= CONCURRENCY) return;
  try {
    while (_running < CONCURRENCY) {
      const job = await claimNextJob();
      if (!job) break;
      _running += 1;
      void runOne(job).finally(() => { _running -= 1; });
    }
  } catch (e) {
    console.warn("[score-render] tick error:", (e as Error)?.message || e);
  }
}

export function startScoreRenderWorker() {
  if (_timer) return;
  // 启动时把上次进程崩溃留下的 running 僵尸退回队列(否则永远卡在 running)。
  void withClient((c) => c.query(
    `UPDATE score_render_jobs SET status='queued'
      WHERE status='running' AND started_at < now() - interval '10 minutes'`,
  )).catch(() => {});
  _timer = setInterval(() => { void tick(); }, POLL_MS);
  if (typeof _timer.unref === "function") _timer.unref();
  console.log(`[score-render] worker armed (concurrency=${CONCURRENCY}, nice=15)`);
}
