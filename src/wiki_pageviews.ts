/* CSSOS_PERSON_MV_WAVE58 20260508 — Jing
 * Wikipedia pageview helper. Hits the Wikimedia REST metrics endpoint to
 * fetch per-article monthly views, then averages over the requested
 * window. Used by the bulk seed pipeline to compute influence_score.
 *
 * Etiquette: 1s gap between calls (fetchPageviews is self-throttling
 * via a module-level promise chain). Provide a descriptive User-Agent
 * per Wikimedia API policy.
 */

const UA =
  "cssOS-PersonMV-BulkSeed/1.0 (https://cssos.dev; person-mv@cssos.dev)";

let __wikiChain: Promise<unknown> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>, gapMs = 1000): Promise<T> {
  const next = __wikiChain.then(async () => {
    const out = await fn();
    await new Promise((r) => setTimeout(r, gapMs));
    return out;
  });
  __wikiChain = next.catch(() => undefined);
  return next as Promise<T>;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

export type PageviewResult = {
  monthly_avg: number;
  months_sampled: number;
  title: string;
  lang: string;
};

/**
 * Fetch monthly average pageviews for an article. Tries `name_en` on the
 * given lang wiki first; falls back to `name_zh` on zh.wikipedia if the
 * first request returns no data. Returns 0 for both averages on failure.
 */
export async function fetchPageviews(
  name_zh: string,
  name_en: string,
  lang: string = "en",
  months: number = 3,
): Promise<PageviewResult> {
  const tryOne = async (
    title: string,
    wikiLang: string,
  ): Promise<PageviewResult | null> => {
    if (!title) return null;
    const end = new Date();
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - months);
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
      `${encodeURIComponent(wikiLang)}.wikipedia/all-access/all-agents/` +
      `${encodeURIComponent(title.replace(/\s+/g, "_"))}/monthly/` +
      `${ymd(start)}/${ymd(end)}`;
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { items?: Array<{ views: number }> };
      const items = Array.isArray(j.items) ? j.items : [];
      if (!items.length) return null;
      const total = items.reduce((s, it) => s + (Number(it.views) || 0), 0);
      return {
        monthly_avg: Math.round(total / items.length),
        months_sampled: items.length,
        title,
        lang: wikiLang,
      };
    } catch {
      return null;
    }
  };

  // Throttle each network call.
  const primary = await throttle(() => tryOne(name_en, lang));
  if (primary && primary.monthly_avg > 0) return primary;
  const zh = await throttle(() => tryOne(name_zh, "zh"));
  if (zh && zh.monthly_avg > 0) return zh;
  return { monthly_avg: 0, months_sampled: 0, title: name_en || name_zh, lang };
}

/** Compute influence_score from pageviews + curation tier bonus. */
export function influenceFromPageviews(
  monthly_avg: number,
  tier: "S" | "A" | "B",
): number {
  const base = monthly_avg > 0 ? Math.log10(monthly_avg) * 12 : 0;
  const bonus = tier === "S" ? 30 : tier === "A" ? 15 : 5;
  return Math.max(0, Math.min(100, Math.round(base + bonus)));
}
