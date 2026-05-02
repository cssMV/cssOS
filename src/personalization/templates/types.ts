// CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #269 — Jing
//
// Descriptor for a pre-rendered system-gift MV template. Every
// template lives on disk as a directory containing:
//
//   manifest.json       (this descriptor, serialised)
//   base.mp4            (the pre-rendered video — same for every recipient)
//   base.mp3            (audio track — same for every recipient)
//   cover.png           (static cover image)
//   lyrics.ass.tpl      (ASS subtitle template with {name} placeholder)
//   lyrics.txt.tpl      (plain text version with {name} placeholder)
//
// The render pipeline reads the descriptor, substitutes the
// recipient's name into the lyric/title templates, and writes a
// user_works row owned by the cssOS Curator. The base.mp4 / base.mp3
// / cover.png are NOT modified — they're shared across every
// recipient. Only the lyric/title text changes per render.

import type { GiftTriggerKey } from "../types.js";

/**
 * Aspect ratios we support. Matches the existing watch-frame source-
 * aspect set. Templates declare their aspect so the watch panel can
 * shape the frame correctly.
 */
export type TemplateAspectRatio =
  | "16:9"
  | "9:16"
  | "2.39:1"
  | "32:9"
  | "1:1"
  | "4:3";

/**
 * Emotional tone hint — feeds into the karaoke subtitle styling
 * (tied to the existing emotional-subtitles work, #251).
 */
export type TemplateEmotionalTone =
  | "warm"
  | "celebratory"
  | "tender"
  | "triumphant"
  | "melancholy"
  | "playful"
  | "majestic"
  | "intimate";

/**
 * The on-disk manifest shape. Validated at registry load time —
 * any manifest that fails validation is logged + skipped (we never
 * crash boot because of one bad template).
 */
export interface PersonalizationTemplateManifest {
  /** Unique id, conventionally `{trigger}.{language}.{vN}`. */
  id: string;
  /** Which trigger this template serves. */
  trigger_key: GiftTriggerKey;
  /** BCP-47 language tag, e.g. "en", "zh", "zh-Hant", "ja", "ar". */
  language: string;
  /** Template version. Bumping invalidates render-cache lookups. */
  version: number;
  /** Display label for admin tooling — not user-visible. */
  label: string;

  /** Pre-rendered base media. Paths relative to the manifest dir, OR absolute URLs. */
  base_video: string;
  base_audio: string;
  base_cover: string;

  duration_secs: number;
  aspect_ratio: TemplateAspectRatio;

  /** Title shown in the watch panel and inbox. May contain `{name}`. */
  title_template: string;
  /** Subtitle / kicker line under the title. May contain `{name}`. */
  subtitle_template?: string;

  /** ASS subtitle file template (placed next to manifest, optional). */
  ass_lyrics_file?: string;
  /** Plain-text lyric file template (placed next to manifest). */
  plain_lyrics_file: string;

  /** Emotional tone for subtitle styling. */
  emotional_tone: TemplateEmotionalTone;

  /**
   * Maximum length of the substituted name (in code points, not bytes).
   * Names longer than this are truncated with "…" before substitution
   * so the rendered overlay never overflows the safe-text region.
   * Defaults to 24 if omitted.
   */
  max_name_chars?: number;

  /**
   * Notes from the template author — when to use this template,
   * known limitations, attribution. Admin-facing only.
   */
  notes?: string;

  /**
   * Set true once the template is approved for live use. Templates
   * with active=false are loaded into the registry but never
   * selected by pickBestForTarget(). Lets us check in WIP templates.
   */
  active: boolean;
}

/**
 * Loaded template — manifest + resolved file contents (kept in
 * memory after boot for fast render-time substitution).
 */
export interface LoadedTemplate {
  manifest: PersonalizationTemplateManifest;
  /** Absolute path on disk to the manifest dir. */
  dir: string;
  /** Resolved (or absolute) URLs for serving the base assets. */
  base_video_url: string;
  base_audio_url: string;
  base_cover_url: string;
  /** Plain-text lyrics with `{name}` placeholders intact. */
  plain_lyrics_template: string;
  /** ASS lyrics with `{name}` placeholders, or null if no ASS file. */
  ass_lyrics_template: string | null;
  /** sha256 of the manifest JSON (cache-busting key). */
  manifest_sha256: string;
}

/**
 * Result of a successful render: the data the render() primitive
 * inserts into user_works + work_market_profiles (owned by Curator).
 */
export interface TemplateRenderResult {
  workId: string;
  templateId: string;
  manifestSha256: string;
  embeddedName: string;
  embeddedLanguage: string;
  costCents: number;
}
