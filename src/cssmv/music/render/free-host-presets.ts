export interface FreeHostPreset {
  id: string;
  stage: "instrument_host" | "vocal_source_host" | "vocal_fx_host" | "mix_host";
  displayName: string;
  hostFamily: string;
  pluginFormat: string;
  exampleProducts: string[];
  requiredAssets: string[];
  notes: string[];
}

export interface FreeHostLaunchTemplate {
  commandTemplate: string;
  fallbackCommandTemplate: string;
  cwdHint: string;
  envKeys: string[];
  inputArtifacts: string[];
  outputArtifacts: string[];
}

const FREE_HOST_PRESETS: FreeHostPreset[] = [
  {
    id: "free-instrument-host-v1",
    stage: "instrument_host",
    displayName: "Free Instrument Host Stack",
    hostFamily: "licensed_plugin_host",
    pluginFormat: "VST3/AU",
    exampleProducts: [
      "Vital",
      "Surge XT",
      "Spitfire LABS",
      "BBC Symphony Orchestra Discover",
      "MT Power Drum Kit 2",
      "Dexed",
      "OB-Xd",
      "Helm",
      "Yoshimi",
      "ZynAddSubFX",
      "SINEfactory",
      "sfizz",
      "FluidSynth"
    ],
    requiredAssets: ["free-synth-suite", "free-orchestra-suite", "free-drums-suite"],
    notes: [
      "Use a lawful local plugin host with pinned freeware plugin versions.",
      "Prefer per-project preset snapshots so free stacks remain reproducible."
    ]
  },
  {
    id: "free-ai-singer-host-v1",
    stage: "vocal_source_host",
    displayName: "Free AI Singer Host Stack",
    hostFamily: "voicebank_host",
    pluginFormat: "standalone/VST3",
    exampleProducts: [
      "Synthesizer V Basic",
      "DiffSinger",
      "UTAU",
      "OpenUtau",
      "ENUNU",
      "NNSVS",
      "DiffSinger MiniEngine",
      "DiffSinger + NSF-HiFiGAN",
      "WORLD vocoder bridge"
    ],
    requiredAssets: ["free-ai-singer-engine", "phoneme-dictionary", "voice-profile"],
    notes: [
      "Run only with voicebanks and singer models whose licenses permit the intended use.",
      "Export dry vocal stems first, then hand off to the vocal FX host.",
      "The host adapter can stay on the existing chain and switch backend by env template: DiffSinger by default, OpenUtau, ENUNU/NNSVS, or a generic/WORLD vocoder bridge when configured."
    ]
  },
  {
    id: "free-vocal-fx-host-v1",
    stage: "vocal_fx_host",
    displayName: "Free Vocal FX Host Stack",
    hostFamily: "licensed_plugin_host",
    pluginFormat: "VST3/AU",
    exampleProducts: [
      "MAutoPitch",
      "TDR Nova",
      "T-De-Esser",
      "Fresh Air",
      "Valhalla Supermassive",
      "Graillon 2"
    ],
    requiredAssets: ["pitch-correction", "eq", "compressor", "de-esser", "air", "reverb", "delay"],
    notes: [
      "Default free chain order is pitch correction -> EQ -> compressor -> de-esser -> air -> reverb -> delay.",
      "Keep send FX and dry vocal stems separated for later paid-chain upgrades."
    ]
  },
  {
    id: "free-mix-host-v1",
    stage: "mix_host",
    displayName: "Free Mix Bus Host Stack",
    hostFamily: "licensed_plugin_host",
    pluginFormat: "VST3/AU",
    exampleProducts: [
      "TDR Kotelnikov",
      "Limiter No6",
      "LoudMax",
      "Youlean Loudness Meter",
      "TDR Nova",
      "Valhalla Supermassive"
    ],
    requiredAssets: ["bus-compressor", "eq", "limiter", "loudness-meter", "space-fx"],
    notes: [
      "Use a lawful free mix bus chain with pinned plugin versions and reproducible presets.",
      "Keep the final mix render separate from vocal-FX stems so mastering can be swapped later."
    ]
  }
];

export function resolveFreeHostPresetForResource(
  resourceId?: string | null,
  stage?: FreeHostPreset["stage"] | null
): FreeHostPreset | null {
  const resourceKey = String(resourceId || "").trim().toLowerCase();
  const stageKey = String(stage || "").trim().toLowerCase();
  switch (resourceKey) {
    case "free-community-stack":
      return FREE_HOST_PRESETS.find((preset) => preset.id === "free-instrument-host-v1") || null;
    case "free-ai-singer":
      return FREE_HOST_PRESETS.find((preset) => preset.id === "free-ai-singer-host-v1") || null;
    case "free-vocal-chain":
      if (stageKey === "mix_host") {
        return FREE_HOST_PRESETS.find((preset) => preset.id === "free-mix-host-v1") || null;
      }
      return FREE_HOST_PRESETS.find((preset) => preset.id === "free-vocal-fx-host-v1") || null;
    default:
      return null;
  }
}

export function listFreeHostPresets(): FreeHostPreset[] {
  return FREE_HOST_PRESETS.slice();
}

export function buildFreeHostLaunchTemplate(
  presetId: string,
  projectId: string
): FreeHostLaunchTemplate | null {
  switch (presetId) {
    case "free-instrument-host-v1":
      return {
        commandTemplate:
          `free-plugin-host --project "${projectId}" --stack free-community-stack ` +
          `--plan artifacts/cssmv/${projectId}/render.host-plan.json ` +
          `--execution artifacts/cssmv/${projectId}/render.execution.json`,
        fallbackCommandTemplate:
          `node dist/cssmv/music/render/free-host-cli.js --out-dir artifacts/cssmv/${projectId} ` +
          `--stage instrument_host --host-preset free-instrument-host-v1 ` +
          `--output audio.preview.wav --output mix.wav --output stems/music_bed.wav ` +
          `--output stems/drums.wav --output stems/bass.wav --output stems/hooks.wav`,
        cwdHint: "artifacts/cssmv",
        envKeys: ["CSSMV_FREE_PLUGIN_HOST", "CSSMV_PLUGIN_SCAN_PATHS"],
        inputArtifacts: ["music.plan.json", "render.host-plan.json", "render.execution.json"],
        outputArtifacts: [
          "audio.preview.wav",
          "mix.wav",
          "stems/music_bed.wav",
          "stems/drums.wav",
          "stems/bass.wav",
          "stems/hooks.wav"
        ]
      };
    case "free-ai-singer-host-v1":
      return {
        commandTemplate:
          `free-singer-host --project "${projectId}" --stack free-ai-singer ` +
          `--lyrics artifacts/cssmv/${projectId}/preview.script.txt ` +
          `--plan artifacts/cssmv/${projectId}/render.host-plan.json`,
        fallbackCommandTemplate:
          `node dist/cssmv/music/render/free-host-cli.js --out-dir artifacts/cssmv/${projectId} ` +
          `--stage vocal_source_host --host-preset free-ai-singer-host-v1 ` +
          `--output vocal.lead.mp3 --output vocal.harmony.mp3`,
        cwdHint: "artifacts/cssmv",
        envKeys: [
          "CSSMV_FREE_SINGER_HOST",
          "CSSMV_VOICEBANK_PATHS",
          "CSSMV_SINGER_BACKEND",
          "CSSMV_OPENUTAU_RENDER_CMD",
          "CSSMV_ENUNU_RENDER_CMD",
          "CSSMV_NNSVS_RENDER_CMD",
          "CSSMV_WORLD_RENDER_CMD",
          "CSSMV_SINGER_GENERIC_RENDER_CMD",
          "CSSMV_DIFFSINGER_LEGACY_VOCODER_CMD"
        ],
        inputArtifacts: ["preview.script.txt", "render.host-plan.json", "render.execution.json"],
        outputArtifacts: ["vocal.lead.mp3", "vocal.harmony.mp3"]
      };
    case "free-vocal-fx-host-v1":
      return {
        commandTemplate:
          `free-vocal-fx-host --project "${projectId}" --mode fx --chain free-vocal-chain ` +
          `--input-stem artifacts/cssmv/${projectId}/vocal.lead.mp3 ` +
          `--plan artifacts/cssmv/${projectId}/render.host-plan.json ` +
          `--execution artifacts/cssmv/${projectId}/render.execution.json`,
        fallbackCommandTemplate:
          `node dist/cssmv/music/render/free-host-cli.js --out-dir artifacts/cssmv/${projectId} ` +
          `--stage vocal_fx_host --host-preset free-vocal-fx-host-v1 ` +
          `--output vocal.lead.fx.mp3`,
        cwdHint: "artifacts/cssmv",
        envKeys: ["CSSMV_FREE_FX_HOST", "CSSMV_PLUGIN_SCAN_PATHS"],
        inputArtifacts: ["vocal.lead.mp3", "render.host-plan.json", "render.execution.json"],
        outputArtifacts: ["vocal.lead.fx.mp3"]
      };
    case "free-mix-host-v1":
      return {
        commandTemplate:
          `free-mix-host --project "${projectId}" --mode mix --chain free-mix-bus ` +
          `--input-stem artifacts/cssmv/${projectId}/mix.wav ` +
          `--plan artifacts/cssmv/${projectId}/render.host-plan.json ` +
          `--execution artifacts/cssmv/${projectId}/render.execution.json`,
        fallbackCommandTemplate:
          `node dist/cssmv/music/render/free-host-cli.js --out-dir artifacts/cssmv/${projectId} ` +
          `--stage mix_host --host-preset free-mix-host-v1 ` +
          `--output mix.wav --output mastering.report.json`,
        cwdHint: "artifacts/cssmv",
        envKeys: ["CSSMV_FREE_MIX_HOST", "CSSMV_PLUGIN_SCAN_PATHS"],
        inputArtifacts: ["mix.wav", "render.host-plan.json", "render.execution.json"],
        outputArtifacts: ["mix.wav", "mastering.report.json"]
      };
    default:
      return null;
  }
}
