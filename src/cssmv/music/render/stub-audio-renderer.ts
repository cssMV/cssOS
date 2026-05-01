import fs from "node:fs";

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function frequencyForEnergy(energy: string) {
  const key = String(energy || "").toLowerCase();
  if (key.includes("peak-plus")) return 659.25;
  if (key.includes("peak")) return 587.33;
  if (key.includes("high")) return 523.25;
  if (key.includes("medium-high")) return 440;
  if (key.includes("medium")) return 392;
  if (key.includes("low")) return 329.63;
  return 349.23;
}

function resolveSectionProfile(section: string) {
  const key = String(section || "").toLowerCase();
  if (key.includes("chorus 4")) {
    return {
      scale: [0, 7, 12, 16, 19, 24],
      motif: [0, 4, 5, 4, 2, 4, 5, 4, 2, 0],
      leadBoost: 1.24,
      hook: [0, 7, 12, 7, 5, 4, 2, 0],
      cadence: [12, 7, 5, 4],
      anchor: [0, 7, 12, 7, 0, 7, 12, 5]
    };
  }
  if (key.includes("chorus 3") || key.includes("chorus 2") || key.includes("chorus")) {
    return {
      scale: [0, 4, 7, 11, 12, 16, 19],
      motif: [0, 2, 4, 2, 0, 2, 5, 4, 2, 0],
      leadBoost: 1.14,
      hook: [0, 4, 7, 4, 2, 4, 7, 4],
      cadence: [7, 4, 2, 0],
      anchor: [0, 4, 7, 4, 0, 4, 7, 2]
    };
  }
  if (key.includes("bridge")) {
    return {
      scale: [0, 2, 7, 9, 12, 14, 19],
      motif: [0, 3, 5, 6, 5, 3, 1, 0],
      leadBoost: 0.96,
      hook: [0, 3, 6, 5],
      cadence: [6, 5, 3, 0],
      anchor: [0, 3, 5, 6, 5, 3]
    };
  }
  if (key.includes("outro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 1, 2, 3, 2, 1, 0],
      leadBoost: 0.9,
      hook: [0, 2, 3, 2],
      cadence: [3, 2, 1, 0],
      anchor: [0, 2, 3, 2, 1, 0]
    };
  }
  if (key.includes("intro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 2, 3, 2, 0, 1],
      leadBoost: 0.82,
      hook: [0, 1, 2, 1],
      cadence: [2, 1, 0, 0],
      anchor: [0, 1, 2, 1, 0, 0]
    };
  }
  return {
    scale: [0, 3, 7, 10, 12, 15, 19],
    motif: [0, 1, 3, 1, 4, 3, 1, 0],
    leadBoost: 1,
    hook: [0, 3, 1, 0],
    cadence: [3, 1, 0, 0],
    anchor: [0, 1, 3, 1, 4, 3, 1, 0]
  };
}

function buildLeadDegrees(
  sectionProfile: ReturnType<typeof resolveSectionProfile>,
  noteCount: number,
  scale: number[]
) {
  const safeCount = Math.max(4, noteCount || 8);
  const degrees: number[] = [];
  const isChorusLike =
    Array.isArray(sectionProfile.anchor) &&
    sectionProfile.anchor.length >= 4 &&
    Array.isArray(sectionProfile.cadence) &&
    sectionProfile.cadence.length >= 3;

  if (isChorusLike && safeCount >= 8) {
    const anchor = sectionProfile.anchor;
    const cadence = sectionProfile.cadence;
    const phraseWindow = Math.max(0, safeCount - cadence.length);
    for (let i = 0; i < phraseWindow; i += 1) {
      if (i < Math.min(anchor.length, 8)) {
        degrees.push(anchor[i % anchor.length] || 0);
      } else {
        const motif = sectionProfile.motif[i % sectionProfile.motif.length] || 0;
        degrees.push(scale[motif % scale.length] || 0);
      }
    }
    cadence.forEach((degree) => {
      degrees.push(degree || 0);
    });
    return degrees.slice(0, safeCount);
  }

  for (let i = 0; i < safeCount; i += 1) {
    const motif = sectionProfile.motif[i % sectionProfile.motif.length] || 0;
    degrees.push(scale[motif % scale.length] || 0);
  }
  return degrees;
}

function buildMelodicPhrase(
  baseFreq: number,
  startSec: number,
  durationSec: number,
  bars: number,
  energy: string,
  section: string
) {
  const normalizedBars = Math.max(4, Math.min(16, bars || 8));
  const energyKey = String(energy || "").toLowerCase();
  const sectionProfile = resolveSectionProfile(section);
  const energyScale =
    energyKey.includes("peak") || energyKey.includes("high")
      ? [0, 4, 7, 11, 12, 16, 19]
      : sectionProfile.scale;
  const notes = Math.max(4, Math.min(12, normalizedBars));
  const noteDurationSec = durationSec / notes;
  const leadDegrees = buildLeadDegrees(sectionProfile, notes, energyScale);
  const phrase = [];
  for (let i = 0; i < notes; i += 1) {
    const hookWindow = i >= Math.max(0, notes - 4);
    const degree = leadDegrees[i % leadDegrees.length] || 0;
    const freq = baseFreq * Math.pow(2, degree / 12);
    phrase.push({
      freq,
      overtone: freq * (energyKey.includes("peak") ? 2 : 1.5) * sectionProfile.leadBoost,
      startSec: startSec + i * noteDurationSec,
      durationSec: noteDurationSec * (hookWindow ? 0.98 : i % 3 === 2 ? 0.92 : 0.78),
      accent: hookWindow ? 1.12 : i % Math.max(2, Math.round(notes / 4)) === 0 ? 1 : 0.72
    });
  }
  return phrase;
}

export function writeStubWav(
  targetPath: string,
  cues: Array<{ durationSec: number; energy?: string; section?: string }>
) {
  const sampleRate = 22050;
  const fallbackDurationSec = 24;
  const normalizedCues = cues.length
    ? cues
    : [{ durationSec: fallbackDurationSec, energy: "medium", section: "fallback" }];
  const totalDurationSec = Math.max(
    4,
    Math.min(
      420,
      normalizedCues.reduce((sum, cue) => sum + Math.max(4, Math.min(90, cue.durationSec || 0)), 0)
    )
  );
  const totalSamples = Math.max(1, Math.floor(totalDurationSec * sampleRate));
  const samples = new Int16Array(totalSamples);
  let runningSec = 0;
  normalizedCues.forEach((cue, index) => {
    const durationSec = Math.max(4, Math.min(90, cue.durationSec || 16));
    const bars = Math.max(8, Math.round(durationSec / 2));
    const freq = frequencyForEnergy(cue.energy || "medium");
    const section = cue.section || `section_${index + 1}`;
    const phrase = buildMelodicPhrase(
      freq,
      runningSec,
      durationSec,
      bars,
      cue.energy || "medium",
      section
    );
    phrase.forEach((note) => {
      const startSample = Math.max(0, Math.floor(note.startSec * sampleRate));
      const sampleCount = Math.min(
        totalSamples - startSample,
        Math.max(1, Math.floor(note.durationSec * sampleRate))
      );
      const attack = Math.max(1, Math.floor(sampleCount * 0.08));
      const release = Math.max(1, Math.floor(sampleCount * 0.18));
      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const env =
          i < attack
            ? i / attack
            : i > sampleCount - release
              ? Math.max(0, (sampleCount - i) / release)
              : 1;
        const pad = Math.sin(2 * Math.PI * note.freq * t) * 0.31;
        const lead = Math.sin(2 * Math.PI * note.overtone * t) * 0.12;
        const shimmer = Math.sin(2 * Math.PI * note.freq * 0.5 * t) * 0.09;
        const bass = Math.sin(2 * Math.PI * (note.freq / 2) * t) * 0.17;
        const pulse = ((Math.sin(2 * Math.PI * 2 * t) + 1) * 0.5) * 0.08;
        const value = clampSample((pad + lead + bass + pulse) * env * note.accent);
        const hookLift = note.accent > 1 ? shimmer * 0.9 : shimmer * 0.45;
        const harmonic = clampSample(value + hookLift);
        const mixed = clampSample((samples[startSample + i] || 0) / 32767 + harmonic * 0.72);
        samples[startSample + i] = Math.round(mixed * 32767);
      }
    });
    runningSec += durationSec;
    const beatStart = Math.max(0, Math.floor(runningSec * sampleRate) - Math.floor(0.08 * sampleRate));
    for (let i = 0; i < Math.floor(0.08 * sampleRate) && beatStart + i < totalSamples; i += 1) {
      const env = 1 - i / Math.floor(0.08 * sampleRate);
      const thump = Math.sin(2 * Math.PI * 80 * (i / sampleRate)) * 0.28 * env;
      const mixed = clampSample((samples[beatStart + i] || 0) / 32767 + thump);
      samples[beatStart + i] = Math.round(mixed * 32767);
    }
    void index;
  });

  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i] || 0, 44 + i * 2);
  }
  fs.writeFileSync(targetPath, buffer);
}
