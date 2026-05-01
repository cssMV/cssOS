import type { MusicPlanDocument } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateMusicPlanDocument(plan: MusicPlanDocument): ValidationResult {
  const errors: string[] = [];

  if (!plan.sections.length) {
    errors.push("Music plan must contain at least one section.");
  }

  const sectionIds = new Set(plan.sections.map((section) => section.sectionId));
  const phraseIds = new Set(plan.phrases.map((phrase) => phrase.phraseId));

  plan.sections.forEach((section) => {
    if (section.durationSec <= 0) {
      errors.push(`Section ${section.sectionId} has non-positive duration.`);
    }
    if (section.bars <= 0) {
      errors.push(`Section ${section.sectionId} must have at least one bar.`);
    }
  });

  plan.phrases.forEach((phrase) => {
    if (!sectionIds.has(phrase.sectionId)) {
      errors.push(`Phrase ${phrase.phraseId} references missing section ${phrase.sectionId}.`);
    }
    if (phrase.durationSec <= 0 || phrase.bars <= 0) {
      errors.push(`Phrase ${phrase.phraseId} has invalid duration or bar count.`);
    }
    if (phrase.followsPhraseId && !phraseIds.has(phrase.followsPhraseId)) {
      errors.push(`Phrase ${phrase.phraseId} references missing predecessor ${phrase.followsPhraseId}.`);
    }
  });

  plan.harmony.forEach((entry) => {
    if (!phraseIds.has(entry.phraseId)) {
      errors.push(`Harmony plan references missing phrase ${entry.phraseId}.`);
    }
  });

  plan.rhythm.forEach((entry) => {
    if (!phraseIds.has(entry.phraseId)) {
      errors.push(`Rhythm plan references missing phrase ${entry.phraseId}.`);
    }
  });

  plan.expression.forEach((entry) => {
    if (!phraseIds.has(entry.phraseId)) {
      errors.push(`Expression plan references missing phrase ${entry.phraseId}.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors
  };
}
