import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDiffSingerRenderContext, expandDiffSingerTemplate, parseDiffSingerHostArgs } from "../hosts/diffsinger-render-runtime";

test("parseDiffSingerHostArgs recognizes singer host arguments", () => {
  const args = parseDiffSingerHostArgs([
    "--project", "demo",
    "--stack", "free-ai-singer",
    "--lyrics", "/tmp/demo/preview.script.txt",
    "--plan", "/tmp/demo/render.host-plan.json"
  ]);
  assert.equal(args.project, "demo");
  assert.equal(args.stack, "free-ai-singer");
});

test("buildDiffSingerRenderContext writes request manifests", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cssmv-diffsinger-"));
  const planPath = path.join(tempDir, "render.host-plan.json");
  const lyricsPath = path.join(tempDir, "preview.script.txt");
  const runbookPath = path.join(tempDir, "render.host-runbook.json");
  fs.writeFileSync(planPath, JSON.stringify({ ok: true }));
  fs.writeFileSync(lyricsPath, "hello world");
  fs.writeFileSync(
    runbookPath,
    JSON.stringify({
      stages: [{ stage: "vocal_source_host", outputArtifacts: ["vocal.lead.mp3", "vocal.harmony.mp3"] }]
    })
  );
  const context = buildDiffSingerRenderContext({
    project: "demo",
    stack: "free-ai-singer",
    lyricsPath,
    planPath
  });
  assert.ok(fs.existsSync(context.requestManifestPath));
  assert.ok(fs.existsSync(context.lyricsInputPath));
  assert.ok(fs.existsSync(context.outputManifestPath));
  assert.ok(fs.existsSync(context.submitRequestPath));
  const submitPayload = JSON.parse(fs.readFileSync(context.submitRequestPath, "utf8"));
  assert.equal(submitPayload.request.model, "1215_opencpop_ds1000_fix_label_nomidi");
  assert.ok(Array.isArray(submitPayload.request.phonemes));
  assert.ok(submitPayload.request.phonemes.length > 0);
  assert.equal(submitPayload.phonemeStrategy, "fallback_lyric_phoneme_bridge");
  assert.ok(
    submitPayload.request.phonemes.some((entry: { name?: string }) => {
      const name = String(entry?.name || "");
      return name && name !== "a" && name !== "SP";
    })
  );
});

test("expandDiffSingerTemplate replaces singer runtime placeholders", () => {
  const context = {
    artifactDir: "/tmp/artifacts",
    sessionDir: "/tmp/artifacts/hosts/diffsinger/vocal_source",
    requestManifestPath: "/tmp/artifacts/hosts/diffsinger/vocal_source/request.manifest.json",
    lyricsInputPath: "/tmp/artifacts/hosts/diffsinger/vocal_source/lyrics.input.txt",
    outputManifestPath: "/tmp/artifacts/hosts/diffsinger/vocal_source/outputs.manifest.json",
    submitRequestPath: "/tmp/artifacts/hosts/diffsinger/vocal_source/submit.request.json",
    outputArtifacts: [],
    project: "demo",
    stack: "free-ai-singer"
  };
  const command = expandDiffSingerTemplate(
    "render --req {{REQUEST_MANIFEST}} --lyrics {{LYRICS_INPUT}} --submit {{SUBMIT_REQUEST}}",
    context
  );
  assert.match(command, /request\.manifest\.json/);
  assert.match(command, /lyrics\.input\.txt/);
  assert.match(command, /submit\.request\.json/);
});
