// CSSOS_PERSON_MV_WAVE96 20260508 — Jing — Meilisearch primary search.
// PG full-text (Wave 25 + Wave 70 bigram) stays as the fallback path.
// `getMeili()` returns null when env is unset, which is the signal the
// caller uses to fall back to PG. All write helpers are fire-and-forget
// safe: they swallow errors so a meili outage never breaks a write path.

import { MeiliSearch, type Index } from "meilisearch";

let __client: MeiliSearch | null | undefined; // undefined = not initialized, null = unavailable

export type MeiliSearchHit = {
  type: "person" | "mv" | "comment";
  id: string;
  title: string;
  snippet: string;
  score: number;
  person_id?: string | null;
  mv_url?: string | null;
};

const INDEX_PERSONS = "persons";
const INDEX_MVS = "mvs";
const INDEX_COMMENTS = "comments";

export function getMeili(): MeiliSearch | null {
  if (__client !== undefined) return __client;
  const host = (process.env.MEILISEARCH_HOST || "").trim();
  const apiKey = (process.env.MEILISEARCH_API_KEY || "").trim();
  if (!host) {
    __client = null;
    return null;
  }
  try {
    __client = apiKey
      ? new MeiliSearch({ host, apiKey })
      : new MeiliSearch({ host });
  } catch {
    __client = null;
  }
  return __client;
}

export function isMeiliEnabled(): boolean {
  return getMeili() !== null;
}

function idxPersons(c: MeiliSearch): Index { return c.index(INDEX_PERSONS); }
function idxMvs(c: MeiliSearch): Index { return c.index(INDEX_MVS); }
function idxComments(c: MeiliSearch): Index { return c.index(INDEX_COMMENTS); }

export async function indexPerson(person: {
  person_id: string;
  name_zh?: string | null;
  name_en?: string | null;
  name_native?: string | null;
  civilization?: string | null;
  era?: string | null;
  core_theme?: string | null;
  tone?: string | null;
  lore_bio?: string | null;
}): Promise<void> {
  const c = getMeili(); if (!c) return;
  try {
    await idxPersons(c).addDocuments([{
      id: person.person_id,
      person_id: person.person_id,
      name_zh: person.name_zh || "",
      name_en: person.name_en || "",
      name_native: person.name_native || "",
      civilization: person.civilization || "",
      era: person.era || "",
      core_theme: person.core_theme || "",
      tone: person.tone || "",
      "lore.bio": person.lore_bio || "",
    }]);
  } catch (err) {
    console.warn("[meili] indexPerson failed:", (err as Error)?.message || err);
  }
}

export async function indexMv(args: {
  mv_id: string;
  person_id: string;
  scenario_seed?: string | null;
  title?: string | null;
  mv_url?: string | null;
  person_name?: string | null;
  civilization?: string | null;
}): Promise<void> {
  const c = getMeili(); if (!c) return;
  try {
    await idxMvs(c).addDocuments([{
      id: args.mv_id,
      mv_id: args.mv_id,
      person_id: args.person_id,
      title: args.title || "",
      scenario_seed: args.scenario_seed || "",
      person_name: args.person_name || "",
      civilization: args.civilization || "",
      mv_url: args.mv_url || "",
    }]);
  } catch (err) {
    console.warn("[meili] indexMv failed:", (err as Error)?.message || err);
  }
}

export async function indexComment(args: {
  id: string;
  mv_id: string;
  person_id?: string | null;
  body: string;
  author_name?: string | null;
  mv_title?: string | null;
}): Promise<void> {
  const c = getMeili(); if (!c) return;
  try {
    await idxComments(c).addDocuments([{
      id: args.id,
      mv_id: args.mv_id,
      person_id: args.person_id || null,
      body: args.body || "",
      author_name: args.author_name || "",
      mv_title: args.mv_title || "",
    }]);
  } catch (err) {
    console.warn("[meili] indexComment failed:", (err as Error)?.message || err);
  }
}

export async function deleteFromIndex(kind: "person" | "mv" | "comment", id: string): Promise<void> {
  const c = getMeili(); if (!c) return;
  try {
    if (kind === "person") await idxPersons(c).deleteDocument(id);
    else if (kind === "mv") await idxMvs(c).deleteDocument(id);
    else if (kind === "comment") await idxComments(c).deleteDocument(id);
  } catch {
    /* swallow */
  }
}

/** Run a unified query against the relevant Meilisearch index(es).
 * Throws on connection error so the caller can fall back to PG. */
export async function searchAll(
  query: string,
  type: "person" | "mv" | "comment" | "all",
  limit: number,
): Promise<MeiliSearchHit[]> {
  const c = getMeili();
  if (!c) throw new Error("MEILI_UNAVAILABLE");
  const results: MeiliSearchHit[] = [];
  const wantPerson = type === "all" || type === "person";
  const wantMv = type === "all" || type === "mv";
  const wantComment = type === "all" || type === "comment";

  const tasks: Promise<void>[] = [];

  if (wantPerson) tasks.push((async () => {
    const r = await idxPersons(c).search(query, { limit, attributesToHighlight: [] });
    for (const h of r.hits) {
      const hit = h as Record<string, unknown>;
      results.push({
        type: "person",
        id: String(hit.person_id || hit.id || ""),
        title: String(hit.name_zh || hit.name_en || hit.person_id || ""),
        snippet: String(hit.core_theme || hit.civilization || "").slice(0, 240),
        score: 1,
        person_id: String(hit.person_id || hit.id || ""),
      });
    }
  })());

  if (wantMv) tasks.push((async () => {
    const r = await idxMvs(c).search(query, { limit, attributesToHighlight: [] });
    for (const h of r.hits) {
      const hit = h as Record<string, unknown>;
      const seed = String(hit.scenario_seed || "");
      results.push({
        type: "mv",
        id: String(hit.mv_id || hit.id || ""),
        title: String(hit.title || seed.slice(0, 80) || hit.mv_id || ""),
        snippet: seed.slice(0, 240),
        score: 1,
        person_id: hit.person_id ? String(hit.person_id) : null,
        mv_url: hit.mv_url ? String(hit.mv_url) : null,
      });
    }
  })());

  if (wantComment) tasks.push((async () => {
    const r = await idxComments(c).search(query, { limit, attributesToHighlight: [] });
    for (const h of r.hits) {
      const hit = h as Record<string, unknown>;
      const body = String(hit.body || "");
      results.push({
        type: "comment",
        id: String(hit.id || ""),
        title: body.slice(0, 80),
        snippet: body.slice(0, 240),
        score: 1,
        person_id: hit.person_id ? String(hit.person_id) : null,
        mv_url: null,
      });
    }
  })());

  await Promise.all(tasks);
  // Meili returns per-index ranked already; preserve insertion order roughly
  // by score (1 each). Trim to limit.
  return results.slice(0, limit);
}

/** Configure indexes with searchable / filterable / sortable attrs and
 * Chinese stop-words + typo tolerance. Idempotent — safe to re-run. */
export async function configureIndexes(): Promise<void> {
  const c = getMeili();
  if (!c) throw new Error("MEILI_UNAVAILABLE");

  // persons
  await idxPersons(c).updateSettings({
    searchableAttributes: [
      "name_zh", "name_en", "name_native",
      "civilization", "era", "core_theme", "tone", "lore.bio",
    ],
    filterableAttributes: ["civilization", "era"],
    sortableAttributes: ["person_id"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    stopWords: CHINESE_STOPWORDS,
  });

  // mvs
  await idxMvs(c).updateSettings({
    searchableAttributes: ["title", "scenario_seed", "person_name", "civilization"],
    filterableAttributes: ["person_id", "civilization"],
    sortableAttributes: ["mv_id"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    stopWords: CHINESE_STOPWORDS,
  });

  // comments
  await idxComments(c).updateSettings({
    searchableAttributes: ["body", "author_name", "mv_title"],
    filterableAttributes: ["mv_id", "person_id"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    stopWords: CHINESE_STOPWORDS,
  });
}

export const CHINESE_STOPWORDS = [
  "的", "了", "是", "在", "和", "也", "就", "都", "而", "及", "与", "或",
  "一个", "一", "我", "你", "他", "她", "它", "我们", "你们", "他们",
  "这", "那", "这个", "那个", "什么", "怎么", "为什么",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "is", "are", "was", "were",
];
