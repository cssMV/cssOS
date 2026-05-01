import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface DiffSingerHostArgs {
  project: string;
  stack: string;
  lyricsPath: string;
  planPath: string;
}

export interface DiffSingerRenderContext {
  artifactDir: string;
  sessionDir: string;
  requestManifestPath: string;
  lyricsInputPath: string;
  outputManifestPath: string;
  submitRequestPath: string;
  outputArtifacts: string[];
  project: string;
  stack: string;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonIfExists(filePath: string): any {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseLyricsTokens(lyricsText: string): string[] {
  return String(lyricsText || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = String(line || "").trim();
      if (!trimmed || /^\[.*\]$/.test(trimmed)) return [];
      if (/[\u4e00-\u9fff]/.test(trimmed)) {
        return Array.from(trimmed).filter((char) => /[\u4e00-\u9fff]/.test(char));
      }
      return trimmed
        .split(/\s+/)
        .map((token) => token.replace(/[^a-zA-Z0-9'-]+/g, "").trim())
        .filter(Boolean);
    });
}

const DIFFSINGER_FINALS = [
  "a", "ai", "an", "ang", "ao", "e", "ei", "en", "eng", "er",
  "i", "ia", "ian", "iang", "iao", "ie", "in", "ing", "iong", "iu",
  "o", "ong", "ou", "u", "ua", "uai", "uan", "uang", "ui", "un", "uo",
  "v", "van", "ve", "vn"
];

const DIFFSINGER_INITIALS = [
  "b", "c", "ch", "d", "f", "g", "h", "j", "k", "l", "m", "n",
  "p", "q", "r", "s", "sh", "t", "w", "x", "y", "z", "zh"
];

function hashTokenSeed(token: string) {
  return Array.from(String(token || "")).reduce((seed, char) => seed + char.codePointAt(0)!, 0);
}

function pickHashed<T>(items: T[], seed: number, offset = 0): T {
  return items[Math.abs(seed + offset) % items.length] as T;
}

function normalizeLatinVowelCluster(cluster: string) {
  const value = String(cluster || "").toLowerCase();
  if (!value) return "a";
  if (/iong/.test(value)) return "iong";
  if (/iang/.test(value)) return "iang";
  if (/uang/.test(value)) return "uang";
  if (/iao/.test(value)) return "iao";
  if (/ian/.test(value)) return "ian";
  if (/uan/.test(value)) return "uan";
  if (/uai/.test(value)) return "uai";
  if (/van|uen|ven/.test(value)) return "van";
  if (/ve|ue/.test(value)) return "ve";
  if (/vn|un/.test(value)) return "un";
  if (/ing/.test(value)) return "ing";
  if (/ang/.test(value)) return "ang";
  if (/eng/.test(value)) return "eng";
  if (/ong/.test(value)) return "ong";
  if (/iao/.test(value)) return "iao";
  if (/iou|iu/.test(value)) return "iu";
  if (/ian/.test(value)) return "ian";
  if (/iao/.test(value)) return "iao";
  if (/ai/.test(value)) return "ai";
  if (/ei/.test(value)) return "ei";
  if (/ao/.test(value)) return "ao";
  if (/ou/.test(value)) return "ou";
  if (/ia/.test(value)) return "ia";
  if (/ie|ye/.test(value)) return "ie";
  if (/io/.test(value)) return "iong";
  if (/ua/.test(value)) return "ua";
  if (/uo|wo/.test(value)) return "uo";
  if (/ui/.test(value)) return "ui";
  if (/oo|u/.test(value)) return "u";
  if (/ee|ii|y/.test(value)) return "i";
  if (/o/.test(value)) return "o";
  if (/e/.test(value)) return "e";
  return "a";
}

function normalizeLatinInitialCluster(cluster: string) {
  const value = String(cluster || "").toLowerCase();
  if (!value) return "";
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("ch")) return "ch";
  if (value.startsWith("sh")) return "sh";
  if (value.startsWith("ng")) return "n";
  if (value.startsWith("qu")) return "q";
  if (value.startsWith("ju")) return "j";
  if (value.startsWith("xu")) return "x";
  if (value.startsWith("ph")) return "f";
  const first = value[0] || "";
  if (DIFFSINGER_INITIALS.includes(first)) return first;
  if (first === "v") return "w";
  return "";
}

function phonemizeToken(token: string, index: number): string[] {
  const safeToken = String(token || "").trim();
  if (!safeToken) return [];
  if (/^[A-Za-z0-9'-]+$/.test(safeToken)) {
    const lowered = safeToken.toLowerCase();
    if (lowered === "ap") return ["AP"];
    if (lowered === "sp" || lowered === "rest") return ["SP"];
    const initialMatch = lowered.match(/^[^aeiouy]+/);
    const vowelMatch = lowered.match(/[aeiouy]+/g);
    const initial = normalizeLatinInitialCluster(initialMatch?.[0] || "");
    const vowel = normalizeLatinVowelCluster(vowelMatch?.join("") || lowered);
    return [initial, vowel].filter(Boolean);
  }
  if (/^[\u4e00-\u9fff]$/.test(safeToken)) {
    const seed = hashTokenSeed(safeToken) + index;
    const initial = pickHashed(["", ...DIFFSINGER_INITIALS], seed);
    const vowel = pickHashed(DIFFSINGER_FINALS, seed, 3);
    return [initial, vowel].filter(Boolean);
  }
  return [pickHashed(DIFFSINGER_FINALS, hashTokenSeed(safeToken) + index)];
}

function degreeToSemitoneOffset(degree: number) {
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const safeDegree = Math.max(1, Math.round(Number(degree || 1)));
  const octave = Math.floor((safeDegree - 1) / 7);
  const index = (safeDegree - 1) % 7;
  return octave * 12 + (majorScale[index] ?? 0);
}

function registerAnchorMidiBase(anchor: string) {
  const key = String(anchor || "").trim().toLowerCase();
  if (key === "low") return 50;
  if (key === "mid_high") return 62;
  if (key === "high") return 67;
  return 57;
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildSubmitRequest(lyricsText: string, musicPlan: any) {
  const tokens = parseLyricsTokens(lyricsText);
  const phrases = Array.isArray(musicPlan?.phrases) ? musicPlan.phrases : [];
  const previewSegments = Array.isArray(musicPlan?.previewSegments) ? musicPlan.previewSegments : [];
  const totalDurationSec = Math.max(
    4,
    phrases.reduce((sum: number, phrase: any) => sum + Math.max(0.8, Number(phrase?.durationSec || 0)), 0) ||
      previewSegments.reduce((sum: number, segment: any) => sum + Math.max(0.8, Number(segment?.durationSec || 0)), 0) ||
      Math.max(4, tokens.length * 0.45)
  );
  const tokenGroups = (tokens.length ? tokens : ["la"]).map((token, index) => ({
    token,
    phonemes: phonemizeToken(token, index)
  }));
  const voicedCount = Math.max(
    1,
    tokenGroups.reduce((sum, entry) => sum + Math.max(1, entry.phonemes.length), 0)
  );
  const stepDurationSec = Math.max(0.12, totalDurationSec / voicedCount);
  const phraseTemplates = phrases.length
    ? phrases
    : previewSegments.map((segment: any, index: number) => ({
        phraseId: `preview_phrase_${index + 1}`,
        durationSec: Math.max(0.8, Number(segment?.durationSec || 0)),
        melody: {
          targetDegrees: [1, 3, 5, 6],
          registerAnchor: segment?.energy === "peak" ? "high" : segment?.energy === "high" ? "mid_high" : "mid"
        }
      }));

  const submitPhonemes: Array<{ name: string; duration: number }> = [];
  const f0Values: number[] = [];
  const timestep = 0.01;

  let tokenCursor = 0;
  tokenGroups.forEach((entry) => {
    const safePhonemes = entry.phonemes.length ? entry.phonemes : ["a"];
    const phrase =
      phraseTemplates[Math.min(phraseTemplates.length - 1, Math.floor((tokenCursor / voicedCount) * phraseTemplates.length))] || {};
    const degrees =
      Array.isArray(phrase?.melody?.targetDegrees) && phrase.melody.targetDegrees.length
        ? phrase.melody.targetDegrees
        : [1, 3, 5, 6];
    const registerBase = registerAnchorMidiBase(phrase?.melody?.registerAnchor || "");
    safePhonemes.forEach((name, phonemeIndex) => {
      const degree = Number(degrees[(tokenCursor + phonemeIndex) % degrees.length] || 1);
      const freq = midiToFreq(registerBase + degreeToSemitoneOffset(degree));
      const duration = stepDurationSec * (phonemeIndex === safePhonemes.length - 1 ? 1.25 : 0.8);
      submitPhonemes.push({ name, duration: Number(duration.toFixed(3)) });
      const frameCount = Math.max(1, Math.round(duration / timestep));
      for (let frame = 0; frame < frameCount; frame += 1) {
        const wobble = 1 + 0.008 * Math.sin((frame / Math.max(1, frameCount - 1)) * Math.PI * 2);
        f0Values.push(Number((freq * wobble).toFixed(3)));
      }
    });
    tokenCursor += safePhonemes.length;
    submitPhonemes.push({ name: "SP", duration: 0.06 });
    for (let frame = 0; frame < Math.max(1, Math.round(0.06 / timestep)); frame += 1) {
      f0Values.push(0);
    }
  });

  while (submitPhonemes.length > 1 && submitPhonemes[submitPhonemes.length - 1]?.name === "SP") {
    submitPhonemes.pop();
  }

  return {
    model: String(process.env.CSSMV_DIFFSINGER_MODEL || "1215_opencpop_ds1000_fix_label_nomidi").trim(),
    phonemes: submitPhonemes.length ? submitPhonemes : [{ name: "a", duration: totalDurationSec }],
    f0: {
      timestep,
      values: f0Values.length ? f0Values : [220]
    },
    speedup: Math.max(1, Number(process.env.CSSMV_DIFFSINGER_SPEEDUP || 10) || 10)
  };
}

export function parseDiffSingerHostArgs(argv: string[]): DiffSingerHostArgs {
  const readFlag = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? String(argv[index + 1] || "").trim() : "";
  };
  return {
    project: readFlag("--project"),
    stack: readFlag("--stack"),
    lyricsPath: path.resolve(readFlag("--lyrics") || ""),
    planPath: path.resolve(readFlag("--plan") || "")
  };
}

export function buildDiffSingerRenderContext(args: DiffSingerHostArgs): DiffSingerRenderContext {
  const artifactDir = path.dirname(args.planPath);
  const sessionDir = path.join(artifactDir, "hosts", "diffsinger", "vocal_source");
  ensureDir(sessionDir);
  const runbook = readJsonIfExists(path.join(artifactDir, "render.host-runbook.json"));
  const musicPlan = readJsonIfExists(path.join(artifactDir, "music.plan.json"));
  const stage = Array.isArray(runbook?.stages)
    ? runbook.stages.find((entry: any) => entry?.stage === "vocal_source_host")
    : null;
  const outputArtifacts = Array.isArray(stage?.outputArtifacts) ? stage.outputArtifacts : [];
  const requestManifestPath = path.join(sessionDir, "request.manifest.json");
  const lyricsInputPath = path.join(sessionDir, "lyrics.input.txt");
  const outputManifestPath = path.join(sessionDir, "outputs.manifest.json");
  const submitRequestPath = path.join(sessionDir, "submit.request.json");
  const lyricsText = args.lyricsPath && fs.existsSync(args.lyricsPath)
    ? fs.readFileSync(args.lyricsPath, "utf8")
    : "";
  fs.writeFileSync(lyricsInputPath, lyricsText);
  fs.writeFileSync(
    requestManifestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.diffsinger_render_runtime",
        project: args.project,
        stack: args.stack,
        artifactDir,
        lyricsPath: args.lyricsPath,
        planPath: args.planPath
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    outputManifestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.diffsinger_render_runtime",
        outputArtifacts
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    submitRequestPath,
    JSON.stringify(
      {
        generatedBy: "cssmv.diffsinger_render_runtime",
        request: buildSubmitRequest(lyricsText, musicPlan),
        phonemeStrategy: "fallback_lyric_phoneme_bridge",
        lyricTokenCount: parseLyricsTokens(lyricsText).length
      },
      null,
      2
    )
  );
  return {
    artifactDir,
    sessionDir,
    requestManifestPath,
    lyricsInputPath,
    outputManifestPath,
    submitRequestPath,
    outputArtifacts,
    project: args.project,
    stack: args.stack
  };
}

export function expandDiffSingerTemplate(template: string, context: DiffSingerRenderContext): string {
  const replacements: Record<string, string> = {
    "{{PROJECT}}": context.project,
    "{{STACK}}": context.stack,
    "{{ARTIFACT_DIR}}": context.artifactDir,
    "{{SESSION_DIR}}": context.sessionDir,
    "{{REQUEST_MANIFEST}}": context.requestManifestPath,
    "{{LYRICS_INPUT}}": context.lyricsInputPath,
    "{{OUTPUT_MANIFEST}}": context.outputManifestPath,
    "{{SUBMIT_REQUEST}}": context.submitRequestPath
  };
  return Object.entries(replacements).reduce(
    (acc, [key, value]) => acc.split(key).join(value),
    String(template || "")
  );
}

export function runDiffSingerTemplate(
  template: string,
  context: DiffSingerRenderContext
): { status: number | null; stdout: string; stderr: string; command: string } {
  const command = expandDiffSingerTemplate(template, context);
  const result = spawnSync(command, {
    cwd: context.sessionDir,
    shell: true,
    env: process.env,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    command
  };
}

export function verifyDiffSingerOutputs(context: DiffSingerRenderContext): string[] {
  return context.outputArtifacts
    .map((artifact) => path.join(context.artifactDir, artifact))
    .filter((targetPath) => fs.existsSync(targetPath));
}
