// CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #269 — Jing
//
// Boot-time scan of the on-disk personalization template directory.
// Each template directory contains a manifest.json + the base media.
// We parse, validate, and cache them so render-time is purely
// in-memory string substitution + a DB insert (no filesystem I/O).
//
// The directory root defaults to the value of
// CSSOS_PERSONALIZATION_TEMPLATES_DIR (env), then falls back to
// /srv/cssos/shared/personalization-templates/ on the VM, then to
// the in-repo `personalization-templates/` directory for local dev.
//
// Layout:
//   <root>/welcome/en.v1/manifest.json
//   <root>/welcome/en.v1/base.mp4
//   <root>/welcome/en.v1/base.mp3
//   <root>/welcome/en.v1/cover.png
//   <root>/welcome/en.v1/lyrics.txt.tpl
//   <root>/welcome/en.v1/lyrics.ass.tpl   (optional)

import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { GiftTargetSnapshot, GiftTriggerKey } from "../types.js";
import {
  languageMatchScore,
  pickLanguageFromTarget,
} from "./name-safety.js";
import type {
  LoadedTemplate,
  PersonalizationTemplateManifest,
  TemplateAspectRatio,
  TemplateEmotionalTone,
} from "./types.js";

const VALID_ASPECTS: TemplateAspectRatio[] = [
  "16:9",
  "9:16",
  "2.39:1",
  "32:9",
  "1:1",
  "4:3",
];

const VALID_TONES: TemplateEmotionalTone[] = [
  "warm",
  "celebratory",
  "tender",
  "triumphant",
  "melancholy",
  "playful",
  "majestic",
  "intimate",
];

const REGISTRY: Map<string, LoadedTemplate> = new Map();
let LOADED = false;

/**
 * Resolve the templates root. Env override wins; otherwise check the
 * production VM path; otherwise fall back to the in-repo dir. Returns
 * null if nothing exists yet (first-boot case before templates ship).
 */
async function resolveTemplatesRoot(): Promise<string | null> {
  const candidates: string[] = [];
  if (process.env.CSSOS_PERSONALIZATION_TEMPLATES_DIR) {
    candidates.push(process.env.CSSOS_PERSONALIZATION_TEMPLATES_DIR);
  }
  candidates.push("/srv/cssos/shared/personalization-templates");
  candidates.push(
    path.join(process.cwd(), "personalization-templates"),
  );
  for (const c of candidates) {
    try {
      const stat = await fs.stat(c);
      if (stat.isDirectory()) return c;
    } catch (_e) {
      // not present, try next
    }
  }
  return null;
}

/**
 * Validate a parsed manifest object. Returns null if valid, or a
 * human-readable error string otherwise (logged + skipped).
 */
function validateManifest(m: unknown): string | null {
  if (!m || typeof m !== "object") return "manifest must be an object";
  const o = m as Record<string, unknown>;
  const required: Array<[string, "string" | "number" | "boolean"]> = [
    ["id", "string"],
    ["trigger_key", "string"],
    ["language", "string"],
    ["version", "number"],
    ["label", "string"],
    ["base_video", "string"],
    ["base_audio", "string"],
    ["base_cover", "string"],
    ["duration_secs", "number"],
    ["aspect_ratio", "string"],
    ["title_template", "string"],
    ["plain_lyrics_file", "string"],
    ["emotional_tone", "string"],
    ["active", "boolean"],
  ];
  for (const [k, t] of required) {
    if (typeof o[k] !== t) return `field ${k} must be ${t}`;
  }
  if (!VALID_ASPECTS.includes(o.aspect_ratio as TemplateAspectRatio)) {
    return `aspect_ratio "${o.aspect_ratio}" not in [${VALID_ASPECTS.join(",")}]`;
  }
  if (!VALID_TONES.includes(o.emotional_tone as TemplateEmotionalTone)) {
    return `emotional_tone "${o.emotional_tone}" not in [${VALID_TONES.join(",")}]`;
  }
  if ((o.duration_secs as number) <= 0) {
    return "duration_secs must be > 0";
  }
  return null;
}

/**
 * Resolve a path that's either absolute (URL or starts with "/") or
 * relative to the manifest dir. URLs are returned as-is so templates
 * can point at CDN assets.
 */
function resolveAssetUrl(
  ref: string,
  manifestDir: string,
  rootDir: string,
): string {
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith("/")) return ref; // already an absolute path / URL
  // Relative to manifest dir. Compute the URL the frontend can fetch
  // by stripping the templates-root prefix and prepending the public
  // mount point. Express serves /personalization-templates/<...>
  // (configured at app boot — Stage B step 2).
  const abs = path.resolve(manifestDir, ref);
  const rel = path.relative(rootDir, abs);
  return "/personalization-templates/" + rel.split(path.sep).join("/");
}

/**
 * Load a single template directory. Returns null on any error so the
 * registry scan can keep going.
 */
async function loadOneTemplate(
  manifestDir: string,
  rootDir: string,
): Promise<LoadedTemplate | null> {
  const manifestPath = path.join(manifestDir, "manifest.json");
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf8");
  } catch (_e) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(
      "[personalization-templates] %s: invalid JSON: %s",
      manifestPath,
      e,
    );
    return null;
  }
  const validationError = validateManifest(parsed);
  if (validationError) {
    console.warn(
      "[personalization-templates] %s: invalid manifest: %s",
      manifestPath,
      validationError,
    );
    return null;
  }
  const manifest = parsed as PersonalizationTemplateManifest;

  // Read the lyric templates from disk.
  let plainLyricsTemplate = "";
  try {
    plainLyricsTemplate = await fs.readFile(
      path.join(manifestDir, manifest.plain_lyrics_file),
      "utf8",
    );
  } catch (e) {
    console.warn(
      "[personalization-templates] %s: missing plain_lyrics_file %s — %s",
      manifest.id,
      manifest.plain_lyrics_file,
      e,
    );
    return null;
  }
  let assLyricsTemplate: string | null = null;
  if (manifest.ass_lyrics_file) {
    try {
      assLyricsTemplate = await fs.readFile(
        path.join(manifestDir, manifest.ass_lyrics_file),
        "utf8",
      );
    } catch (_e) {
      // ASS file is optional; missing is logged but not fatal.
      console.warn(
        "[personalization-templates] %s: declared ass_lyrics_file %s missing — falling back to plain",
        manifest.id,
        manifest.ass_lyrics_file,
      );
    }
  }

  return {
    manifest,
    dir: manifestDir,
    base_video_url: resolveAssetUrl(manifest.base_video, manifestDir, rootDir),
    base_audio_url: resolveAssetUrl(manifest.base_audio, manifestDir, rootDir),
    base_cover_url: resolveAssetUrl(manifest.base_cover, manifestDir, rootDir),
    plain_lyrics_template: plainLyricsTemplate,
    ass_lyrics_template: assLyricsTemplate,
    manifest_sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  };
}

/**
 * Recursively walk the templates root looking for manifest.json
 * files. Each found manifest defines one template directory.
 */
async function scanForTemplates(rootDir: string): Promise<LoadedTemplate[] > {
  const found: LoadedTemplate[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > 6) return; // sanity limit
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    const hasManifest = entries.some(
      (e) => e.isFile() && e.name === "manifest.json",
    );
    if (hasManifest) {
      const t = await loadOneTemplate(dir, rootDir);
      if (t) found.push(t);
      // Don't descend further — once we found a template dir we
      // assume its children are assets, not nested templates.
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), depth + 1);
      }
    }
  }
  await walk(rootDir, 0);
  return found;
}

/**
 * Boot the registry. Idempotent — repeated calls re-scan and
 * replace the cache (useful for hot-reload during dev).
 */
export async function loadPersonalizationTemplates(): Promise<void> {
  REGISTRY.clear();
  const root = await resolveTemplatesRoot();
  if (!root) {
    LOADED = true;
    console.log(
      "[personalization-templates] no templates root found — registry is empty (this is expected before any templates ship)",
    );
    return;
  }
  const templates = await scanForTemplates(root);
  for (const t of templates) {
    if (REGISTRY.has(t.manifest.id)) {
      console.warn(
        "[personalization-templates] duplicate id %s; later wins (dir=%s)",
        t.manifest.id,
        t.dir,
      );
    }
    REGISTRY.set(t.manifest.id, t);
  }
  LOADED = true;
  console.log(
    "[personalization-templates] loaded %d templates from %s",
    templates.length,
    root,
  );
}

export function listLoadedTemplates(): LoadedTemplate[] {
  return [...REGISTRY.values()];
}

export function getTemplateById(id: string): LoadedTemplate | undefined {
  return REGISTRY.get(id);
}

/**
 * Pick the best-matching template for a (trigger, recipient) pair.
 * Prefers active templates, then highest language-match score, then
 * highest version. Returns undefined if no template applies.
 */
export function pickBestTemplateForTarget(
  triggerKey: GiftTriggerKey,
  target: GiftTargetSnapshot,
): LoadedTemplate | undefined {
  const desired = pickLanguageFromTarget(target);
  type Scored = { t: LoadedTemplate; score: number };
  const candidates: Scored[] = [];
  for (const t of REGISTRY.values()) {
    if (t.manifest.trigger_key !== triggerKey) continue;
    if (!t.manifest.active) continue;
    const score = languageMatchScore(t.manifest.language, desired);
    if (score > 0) candidates.push({ t, score });
  }
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.t.manifest.version || 0) - (a.t.manifest.version || 0);
  });
  return candidates[0]?.t;
}

export function isLoaded(): boolean {
  return LOADED;
}

/** Test helper. */
export function _resetRegistryForTests(): void {
  REGISTRY.clear();
  LOADED = false;
}
