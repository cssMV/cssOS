#!/usr/bin/env node
// CSSOS_PERSON_MV_WAVE96 20260508 — Jing
// Bootstrap Meilisearch indexes for cssOS.
//   MEILISEARCH_HOST=https://meili.example MEILISEARCH_API_KEY=xxx \
//     node scripts/setup-meilisearch.mjs
// Configures persons / mvs / comments indexes with Chinese stop words +
// typo tolerance, then triggers an initial reindex via the admin API.

import { MeiliSearch } from "meilisearch";

const HOST = (process.env.MEILISEARCH_HOST || "").trim();
const KEY = (process.env.MEILISEARCH_API_KEY || "").trim();
const APP = (process.env.CSSOS_APP_HOST || "https://cssstudio.app").trim();
const ADMIN_COOKIE = (process.env.CSSOS_ADMIN_COOKIE || "").trim();

if (!HOST) {
  console.error("MEILISEARCH_HOST is required");
  process.exit(1);
}

const CHINESE_STOPWORDS = [
  "的", "了", "是", "在", "和", "也", "就", "都", "而", "及", "与", "或",
  "一个", "一", "我", "你", "他", "她", "它", "我们", "你们", "他们",
  "这", "那", "这个", "那个", "什么", "怎么", "为什么",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "is", "are", "was", "were",
];

const TYPO = {
  enabled: true,
  minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
};

const client = KEY ? new MeiliSearch({ host: HOST, apiKey: KEY }) : new MeiliSearch({ host: HOST });

async function setupIndex(uid, settings) {
  console.log(`[setup] index=${uid}`);
  await client.createIndex(uid, { primaryKey: "id" }).catch((err) => {
    if (!String(err.message || "").includes("already exists")) throw err;
  });
  const task = await client.index(uid).updateSettings(settings);
  console.log(`[setup]   task=${task.taskUid}`);
}

await setupIndex("persons", {
  searchableAttributes: [
    "name_zh", "name_en", "name_native",
    "civilization", "era", "core_theme", "tone", "lore.bio",
  ],
  filterableAttributes: ["civilization", "era"],
  sortableAttributes: ["person_id"],
  typoTolerance: TYPO,
  stopWords: CHINESE_STOPWORDS,
});

await setupIndex("mvs", {
  searchableAttributes: ["title", "scenario_seed", "person_name", "civilization"],
  filterableAttributes: ["person_id", "civilization"],
  sortableAttributes: ["mv_id"],
  typoTolerance: TYPO,
  stopWords: CHINESE_STOPWORDS,
});

await setupIndex("comments", {
  searchableAttributes: ["body", "author_name", "mv_title"],
  filterableAttributes: ["mv_id", "person_id"],
  typoTolerance: TYPO,
  stopWords: CHINESE_STOPWORDS,
});

console.log("[setup] indexes configured");

if (ADMIN_COOKIE) {
  console.log("[setup] triggering reindex via", APP);
  const r = await fetch(`${APP}/api/admin/search/reindex?kind=all`, {
    method: "POST",
    headers: { cookie: ADMIN_COOKIE },
  });
  console.log("[setup] reindex status:", r.status, await r.text());
} else {
  console.log("[setup] skip auto-reindex (set CSSOS_ADMIN_COOKIE to enable).");
  console.log("[setup] then POST /api/admin/search/reindex?kind=all as admin.");
}

console.log("[setup] done.");
