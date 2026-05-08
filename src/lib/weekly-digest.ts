/* CSSOS_PERSON_MV_WAVE78 20260508 — Jing
 * Weekly email digest: compose + send + log. Self-contained module so
 * the same-process scheduler in src/index.ts only has to call
 * `weeklyDigestTick()` once a week (Mon 09:00 UTC).
 *
 * Email transport: thin abstraction over either Resend (if RESEND_API_KEY
 * is set) or SMTP (if SMTP_URL is set). No new npm deps — Resend is
 * called via fetch(), SMTP is no-op'd in dev so local boots don't crash.
 */

import crypto from "node:crypto";
import { withClient } from "../db";

const DIGEST_KIND = "weekly";
const SEND_RATE_PER_SEC = 10;

/* ─── Email transport ──────────────────────────────────────────────── */

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
};

export type SendEmailResult = { ok: true; provider: string } | { ok: false; error: string };

function defaultFrom(): string {
  return (process.env.EMAIL_FROM || "CSS Studio <digest@cssos.app>").trim();
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (apiKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: args.from || defaultFrom(),
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        return { ok: false, error: `resend ${r.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true, provider: "resend" };
    } catch (err) {
      return { ok: false, error: `resend fetch: ${(err as Error)?.message || String(err)}` };
    }
  }
  // No SMTP fallback wired (avoids new deps). Stub for dev.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] would send to=${args.to} subject="${args.subject}"`);
    return { ok: true, provider: "dev-stub" };
  }
  return { ok: false, error: "no email transport configured" };
}

/* ─── Unsubscribe token (HMAC) ─────────────────────────────────────── */

function digestSecret(): string {
  return (
    process.env.EMAIL_DIGEST_SECRET ||
    process.env.SESSION_SECRET ||
    "cssos-digest-dev-secret"
  );
}

export function unsubscribeToken(userId: string): string {
  const mac = crypto
    .createHmac("sha256", digestSecret())
    .update(`unsub:${userId}`)
    .digest("hex")
    .slice(0, 32);
  return Buffer.from(`${userId}.${mac}`, "utf8").toString("base64url");
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const idx = decoded.indexOf(".");
    if (idx < 0) return null;
    const userId = decoded.slice(0, idx);
    const mac = decoded.slice(idx + 1);
    const expected = crypto
      .createHmac("sha256", digestSecret())
      .update(`unsub:${userId}`)
      .digest("hex")
      .slice(0, 32);
    if (mac.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}

/* ─── i18n strings ─────────────────────────────────────────────────── */

type Lang = "en" | "zh";
function pickLang(locale: string | null | undefined): Lang {
  const s = String(locale || "en").toLowerCase();
  if (s.startsWith("zh")) return "zh";
  return "en";
}

const STR: Record<Lang, Record<string, string>> = {
  en: {
    subject: "Your week on CSS Studio",
    header: "Your week on CSS Studio",
    stats_title: "Your stats this week",
    stat_mvs: "MVs created",
    stat_views: "Total views",
    stat_likes: "Total likes",
    stat_comments: "Comments received",
    trending_title: "Trending people this week",
    recs_title: "Recommended for you",
    footer_unsub: "Unsubscribe",
    footer_view: "View on web",
    no_activity: "No activity yet — try seeding a person to get started.",
  },
  zh: {
    subject: "你在 CSS Studio 的本周回顾",
    header: "你的 CSS Studio 本周回顾",
    stats_title: "你的本周数据",
    stat_mvs: "新建 MV",
    stat_views: "累计观看",
    stat_likes: "累计点赞",
    stat_comments: "收到评论",
    trending_title: "本周热门人物",
    recs_title: "为你推荐",
    footer_unsub: "退订",
    footer_view: "在网页查看",
    no_activity: "本周还没有动静——试着新建一个人物 MV 吧。",
  },
};

function t(lang: Lang, key: string): string {
  return STR[lang][key] || STR.en[key] || key;
}

/* ─── Compose digest ───────────────────────────────────────────────── */

type WeeklyStats = { mvs: number; views: number; likes: number; comments: number };
type TrendingPerson = { person_id: string; name_zh: string | null; name_en: string | null; portrait_url: string | null; total_views: number };
type RecPerson = { person_id: string; name_zh: string | null; name_en: string | null; portrait_url: string | null };

async function loadWeeklyStats(userId: string): Promise<WeeklyStats> {
  const r = await withClient((c) =>
    c.query<{ mvs: number; views: number; likes: number; comments: number }>(
      `WITH my_mvs AS (
         SELECT mv_id, view_count, like_count
           FROM person_mvs
          WHERE created_by_user_id = $1
            AND created_at > now() - interval '7 days'
       ),
       my_likes AS (
         SELECT pml.mv_id
           FROM person_mv_likes pml
           JOIN person_mvs pm2 ON pm2.mv_id = pml.mv_id
          WHERE pm2.created_by_user_id = $1
            AND pml.liked_at > now() - interval '7 days'
       ),
       my_comments AS (
         SELECT 1
           FROM person_mv_comments pmc
           JOIN person_mvs pm3 ON pm3.mv_id = pmc.mv_id
          WHERE pm3.created_by_user_id = $1
            AND pmc.created_at > now() - interval '7 days'
            AND pmc.deleted_at IS NULL
       )
       SELECT
         (SELECT COUNT(*)::int FROM my_mvs)               AS mvs,
         COALESCE((SELECT SUM(view_count)::int FROM my_mvs), 0) AS views,
         (SELECT COUNT(*)::int FROM my_likes)             AS likes,
         (SELECT COUNT(*)::int FROM my_comments)          AS comments`,
      [userId],
    ),
  );
  const row = r.rows[0] || { mvs: 0, views: 0, likes: 0, comments: 0 };
  return { mvs: Number(row.mvs) || 0, views: Number(row.views) || 0, likes: Number(row.likes) || 0, comments: Number(row.comments) || 0 };
}

async function loadFollowerCount(userId: string): Promise<number> {
  try {
    const r = await withClient((c) =>
      c.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM user_follows WHERE followee_id = $1`,
        [userId],
      ),
    );
    return Number(r.rows[0]?.n || 0);
  } catch {
    return 0;
  }
}

async function loadTrendingPersons(): Promise<TrendingPerson[]> {
  try {
    const r = await withClient((c) =>
      c.query<TrendingPerson>(
        `SELECT pp.person_id, pp.name_zh, pp.name_en, pp.portrait_url,
                COALESCE(SUM(pm.view_count), 0)::int AS total_views
           FROM person_profiles pp
           JOIN person_mvs pm ON pm.person_id = pp.person_id
          WHERE pm.created_at > now() - interval '7 days'
          GROUP BY pp.person_id, pp.name_zh, pp.name_en, pp.portrait_url
         HAVING COUNT(pm.mv_id) > 0
          ORDER BY total_views DESC
          LIMIT 5`,
      ),
    );
    return r.rows;
  } catch {
    return [];
  }
}

async function loadRecommendations(userId: string): Promise<RecPerson[]> {
  // Lightweight rec query: persons the user hasn't created an MV for
  // recently, ordered by global popularity. Mirrors the spirit of
  // /api/user/recommendations without coupling to its in-memory cache.
  try {
    const r = await withClient((c) =>
      c.query<RecPerson>(
        `SELECT pp.person_id, pp.name_zh, pp.name_en, pp.portrait_url
           FROM person_profiles pp
           LEFT JOIN person_mvs pm ON pm.person_id = pp.person_id
          WHERE pp.person_id NOT IN (
            SELECT DISTINCT person_id FROM person_mvs
             WHERE created_by_user_id = $1
               AND created_at > now() - interval '30 days'
          )
          GROUP BY pp.person_id, pp.name_zh, pp.name_en, pp.portrait_url
          ORDER BY COALESCE(SUM(pm.view_count), 0) DESC, pp.person_id
          LIMIT 3`,
        [userId],
      ),
    );
    return r.rows;
  } catch {
    return [];
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c] || c);
}

function personLabel(p: { name_zh: string | null; name_en: string | null }, lang: Lang): string {
  const primary = lang === "zh" ? (p.name_zh || p.name_en) : (p.name_en || p.name_zh);
  return String(primary || "—");
}

export type ComposedDigest = {
  subject: string;
  html: string;
  text: string;
  hadActivity: boolean;
};

export async function composeWeeklyDigest(
  user: { id: string; email: string; locale: string | null },
  appBase: string,
): Promise<ComposedDigest> {
  const lang = pickLang(user.locale);
  const [stats, trending, recs, followers] = await Promise.all([
    loadWeeklyStats(user.id),
    loadTrendingPersons(),
    loadRecommendations(user.id),
    loadFollowerCount(user.id),
  ]);
  const hadActivity = stats.mvs > 0 || stats.views > 0 || stats.likes > 0 || stats.comments > 0 || followers > 0;

  const unsub = `${appBase}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`;
  const viewWeb = `${appBase}/`;

  // Inline-CSS, dual-theme. Email clients strip <style>, so we use both
  // inline styles and a <style> block with prefers-color-scheme for
  // clients that respect it (Apple Mail, iOS Mail, etc.).
  const trendingHtml = trending.length
    ? trending.map((p) => `
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
          <span style="font-weight:600;">${escapeHtml(personLabel(p, lang))}</span>
          <span style="color:#888;font-size:13px;"> · ${p.total_views} views</span>
        </td></tr>`).join("")
    : `<tr><td style="padding:8px 0;color:#888;">—</td></tr>`;
  const recsHtml = recs.length
    ? recs.map((p) => `
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
          ${escapeHtml(personLabel(p, lang))}
        </td></tr>`).join("")
    : `<tr><td style="padding:8px 0;color:#888;">—</td></tr>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(t(lang, "subject"))}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .bg { background:#0c0c0d !important; color:#eaeaea !important; }
    .card { background:#16171a !important; color:#eaeaea !important; border-color:#2a2b2f !important; }
    .muted { color:#9aa0a6 !important; }
    a { color:#8ab4ff !important; }
    .border-row { border-color:#2a2b2f !important; }
  }
</style></head>
<body class="bg" style="margin:0;padding:24px;background:#f6f7f9;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div class="card" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px;">CSS Studio</div>
    <div class="muted" style="color:#666;font-size:14px;margin-bottom:20px;">${escapeHtml(t(lang, "header"))}</div>

    <div style="font-weight:600;margin:18px 0 8px;">${escapeHtml(t(lang, "stats_title"))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td style="padding:6px 0;" class="border-row">${escapeHtml(t(lang, "stat_mvs"))}</td><td align="right" style="padding:6px 0;font-weight:600;">${stats.mvs}</td></tr>
      <tr><td style="padding:6px 0;" class="border-row">${escapeHtml(t(lang, "stat_views"))}</td><td align="right" style="padding:6px 0;font-weight:600;">${stats.views}</td></tr>
      <tr><td style="padding:6px 0;" class="border-row">${escapeHtml(t(lang, "stat_likes"))}</td><td align="right" style="padding:6px 0;font-weight:600;">${stats.likes}</td></tr>
      <tr><td style="padding:6px 0;" class="border-row">${escapeHtml(t(lang, "stat_comments"))}</td><td align="right" style="padding:6px 0;font-weight:600;">${stats.comments}</td></tr>
    </table>

    <div style="font-weight:600;margin:24px 0 8px;">${escapeHtml(t(lang, "trending_title"))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${trendingHtml}
    </table>

    <div style="font-weight:600;margin:24px 0 8px;">${escapeHtml(t(lang, "recs_title"))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${recsHtml}
    </table>

    <div class="muted" style="margin-top:28px;color:#888;font-size:12px;text-align:center;">
      <a href="${escapeHtml(viewWeb)}" style="color:#3a6df0;">${escapeHtml(t(lang, "footer_view"))}</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsub)}" style="color:#888;">${escapeHtml(t(lang, "footer_unsub"))}</a>
    </div>
  </div>
</body></html>`;

  const textLines = [
    t(lang, "header"),
    "",
    `${t(lang, "stat_mvs")}: ${stats.mvs}`,
    `${t(lang, "stat_views")}: ${stats.views}`,
    `${t(lang, "stat_likes")}: ${stats.likes}`,
    `${t(lang, "stat_comments")}: ${stats.comments}`,
    "",
    `${t(lang, "trending_title")}:`,
    ...trending.map((p) => `- ${personLabel(p, lang)} (${p.total_views} views)`),
    "",
    `${t(lang, "recs_title")}:`,
    ...recs.map((p) => `- ${personLabel(p, lang)}`),
    "",
    `${t(lang, "footer_view")}: ${viewWeb}`,
    `${t(lang, "footer_unsub")}: ${unsub}`,
  ];

  return {
    subject: t(lang, "subject"),
    html,
    text: textLines.join("\n"),
    hadActivity,
  };
}

/* ─── Logging + send + tick ────────────────────────────────────────── */

async function logDigest(
  userId: string,
  status: "sent" | "failed" | "skipped_no_activity",
  subject: string | null,
  errorSnippet: string | null,
): Promise<void> {
  try {
    await withClient((c) =>
      c.query(
        `INSERT INTO email_digest_log (user_id, digest_kind, subject, status, error_snippet)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, DIGEST_KIND, subject, status, errorSnippet ? errorSnippet.slice(0, 500) : null],
      ),
    );
  } catch (err) {
    console.warn("[digest] log insert failed:", (err as Error)?.message || err);
  }
}

async function markUserSent(userId: string): Promise<void> {
  try {
    await withClient((c) =>
      c.query(`UPDATE users SET email_digest_last_sent_at = now() WHERE id = $1`, [userId]),
    );
  } catch (err) {
    console.warn("[digest] mark sent failed:", (err as Error)?.message || err);
  }
}

export async function sendDigestForUser(
  user: { id: string; email: string; locale: string | null },
  appBase: string,
): Promise<"sent" | "failed" | "skipped_no_activity"> {
  const composed = await composeWeeklyDigest(user, appBase);
  const followers = await loadFollowerCount(user.id);
  if (!composed.hadActivity && followers === 0) {
    await logDigest(user.id, "skipped_no_activity", composed.subject, null);
    await markUserSent(user.id);
    return "skipped_no_activity";
  }
  const r = await sendEmail({
    to: user.email,
    subject: composed.subject,
    html: composed.html,
    text: composed.text,
  });
  if (!r.ok) {
    await logDigest(user.id, "failed", composed.subject, r.error);
    return "failed";
  }
  await logDigest(user.id, "sent", composed.subject, null);
  await markUserSent(user.id);
  return "sent";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function weeklyDigestTick(appBase: string): Promise<{
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  let considered = 0, sent = 0, failed = 0, skipped = 0;
  let users: Array<{ id: string; email: string; locale: string | null }> = [];
  try {
    const r = await withClient((c) =>
      c.query<{ id: string; email: string; locale: string | null }>(
        `SELECT id::text, email, locale
           FROM users
          WHERE email IS NOT NULL
            AND email <> ''
            AND email_verified_at IS NOT NULL
            AND email_digest_enabled = true
            AND (email_digest_last_sent_at IS NULL OR email_digest_last_sent_at < now() - interval '6 days')
          ORDER BY id`,
      ),
    );
    users = r.rows;
  } catch (err) {
    console.warn("[digest] user query failed:", (err as Error)?.message || err);
    return { considered, sent, failed, skipped };
  }
  considered = users.length;
  const minSpacing = Math.ceil(1000 / SEND_RATE_PER_SEC);
  for (const u of users) {
    const t0 = Date.now();
    try {
      const out = await sendDigestForUser(u, appBase);
      if (out === "sent") sent++;
      else if (out === "failed") failed++;
      else skipped++;
    } catch (err) {
      failed++;
      await logDigest(u.id, "failed", null, (err as Error)?.message || String(err));
    }
    const elapsed = Date.now() - t0;
    if (elapsed < minSpacing) await sleep(minSpacing - elapsed);
  }
  return { considered, sent, failed, skipped };
}
