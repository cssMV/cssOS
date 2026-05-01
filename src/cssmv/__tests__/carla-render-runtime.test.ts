import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCarlaRenderContext, expandTemplate, parseCarlaHostArgs } from "../hosts/carla-render-runtime";

test("parseCarlaHostArgs recognizes instrument host arguments", () => {
  const args = parseCarlaHostArgs([
    "--project", "demo",
    "--stack", "free-community-stack",
    "--plan", "/tmp/demo/render.host-plan.json",
    "--execution", "/tmp/demo/render.execution.json"
  ]);
  assert.equal(args.project, "demo");
  assert.equal(args.stackOrChain, "free-community-stack");
  assert.equal(args.mode, "instrument");
});

test("parseCarlaHostArgs recognizes vocal FX host arguments", () => {
  const args = parseCarlaHostArgs([
    "--project", "demo",
    "--mode", "fx",
    "--chain", "free-vocal-chain",
    "--input-stem", "/tmp/demo/vocal.lead.mp3",
    "--plan", "/tmp/demo/render.host-plan.json",
    "--execution", "/tmp/demo/render.execution.json"
  ]);
  assert.equal(args.stackOrChain, "free-vocal-chain");
  assert.equal(args.mode, "fx");
  assert.match(String(args.inputStemPath || ""), /vocal\.lead\.mp3$/);
});

test("parseCarlaHostArgs recognizes mix host arguments", () => {
  const args = parseCarlaHostArgs([
    "--project", "demo",
    "--mode", "mix",
    "--chain", "free-mix-bus",
    "--input-stem", "/tmp/demo/mix.wav",
    "--plan", "/tmp/demo/render.host-plan.json",
    "--execution", "/tmp/demo/render.execution.json"
  ]);
  assert.equal(args.stackOrChain, "free-mix-bus");
  assert.equal(args.mode, "mix");
  assert.match(String(args.inputStemPath || ""), /mix\.wav$/);
});

test("buildCarlaRenderContext writes session manifests", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cssmv-carla-"));
  const planPath = path.join(tempDir, "render.host-plan.json");
  const executionPath = path.join(tempDir, "render.execution.json");
  const runbookPath = path.join(tempDir, "render.host-runbook.json");
  const musicPlanPath = path.join(tempDir, "music.plan.json");
  fs.writeFileSync(planPath, JSON.stringify({ ok: true }));
  fs.writeFileSync(executionPath, JSON.stringify({ ok: true }));
  fs.writeFileSync(
    runbookPath,
    JSON.stringify({
      stages: [{ stage: "instrument_host", outputArtifacts: ["audio.preview.wav", "mix.wav"] }]
    })
  );
  fs.writeFileSync(
    musicPlanPath,
    JSON.stringify({ previewSegments: [{ section: "Intro", durationSec: 8 }] })
  );

  const context = buildCarlaRenderContext({
    project: "demo",
    stackOrChain: "free-community-stack",
    planPath,
    executionPath,
    mode: "instrument"
  });
  assert.ok(fs.existsSync(context.sessionManifestPath));
  assert.ok(fs.existsSync(context.cueManifestPath));
  assert.ok(fs.existsSync(context.outputManifestPath));
});

test("expandTemplate replaces Carla runtime placeholders", () => {
  const context = {
    artifactDir: "/tmp/artifacts",
    sessionDir: "/tmp/artifacts/hosts/carla/instrument",
    sessionManifestPath: "/tmp/artifacts/hosts/carla/instrument/session.manifest.json",
    cueManifestPath: "/tmp/artifacts/hosts/carla/instrument/cues.manifest.json",
    outputManifestPath: "/tmp/artifacts/hosts/carla/instrument/outputs.manifest.json",
    project: "demo",
    stackOrChain: "free-community-stack",
    mode: "instrument" as const,
    inputStemPath: "",
    outputArtifacts: []
  };
  const command = expandTemplate("render --session {{SESSION_MANIFEST}} --project {{PROJECT}}", context);
  assert.match(command, /session\.manifest\.json/);
  assert.match(command, /demo/);
});
