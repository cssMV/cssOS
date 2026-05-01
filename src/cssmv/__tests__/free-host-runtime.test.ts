import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectFreeHostFallbackCommand, resolveHostExecutable } from "../music/render/free-host-runtime";

test("resolveHostExecutable prefers configured env executable", () => {
  const resolved = resolveHostExecutable({
    commandTemplate: "free-plugin-host --project demo",
    envKeys: ["CSSMV_FREE_PLUGIN_HOST"],
    env: {
      CSSMV_FREE_PLUGIN_HOST: "/opt/free-host/bin/free-plugin-host"
    }
  });

  assert.equal(resolved.source, "env");
  assert.equal(resolved.envKey, "CSSMV_FREE_PLUGIN_HOST");
  assert.equal(resolved.executablePath, "/opt/free-host/bin/free-plugin-host");
});

test("resolveHostExecutable falls back to PATH lookup when env is missing", () => {
  const resolved = resolveHostExecutable({
    commandTemplate: "free-plugin-host --project demo",
    envKeys: ["CSSMV_FREE_PLUGIN_HOST"],
    env: {},
    lookupCommand: (commandName) => (commandName === "free-plugin-host" ? "/usr/local/bin/free-plugin-host" : "")
  });

  assert.equal(resolved.source, "path");
  assert.equal(resolved.envKey, "CSSMV_FREE_PLUGIN_HOST");
  assert.equal(resolved.executablePath, "/usr/local/bin/free-plugin-host");
});

test("buildProjectFreeHostFallbackCommand keeps stage outputs in the generated CLI command", () => {
  const command = buildProjectFreeHostFallbackCommand("/tmp/cssmv/demo_project", {
    stage: "instrument_host",
    hostPresetId: "free-instrument-host-v1",
    outputArtifacts: ["audio.preview.wav", "mix.wav", "stems/drums.wav"]
  });

  assert.match(command, /--out-dir '\/*tmp\/cssmv\/demo_project'/);
  assert.match(command, /--stage 'instrument_host'/);
  assert.match(command, /--host-preset 'free-instrument-host-v1'/);
  assert.match(command, /--output 'audio\.preview\.wav'/);
  assert.match(command, /--output 'mix\.wav'/);
  assert.match(command, /--output 'stems\/drums\.wav'/);
});
