import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("cssmv dev flow writes artifact manifest and links it from output package", () => {
  execFileSync(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", "src/cssmv/dev.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CSSMV_EXAMPLE_PATH: "examples/cssmv/mv_prompt.json"
      }
    }
  );

  const outDir = path.resolve(process.cwd(), "artifacts", "cssmv", "mv_neon_midnight");
  const manifestPath = path.join(outDir, "artifact.manifest.json");
  const outputPath = path.join(outDir, "output.package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  assert.equal(manifest.manifestVersion, "cssmv_artifact_manifest_v1");
  assert.equal(manifest.projectId, "mv_neon_midnight");
  assert.ok(Array.isArray(manifest.entries));
  assert.ok(manifest.entries.some((entry: { fileName: string }) => entry.fileName === "story.graph.json"));
  assert.equal(output.artifactManifest?.manifestVersion, "cssmv_artifact_manifest_v1");
});
