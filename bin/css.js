#!/usr/bin/env node

let buildCli;

try {
  ({ buildCli } = require("../dist/cli/index.js"));
} catch (_err) {
  try {
    require("ts-node/register/transpile-only");
    ({ buildCli } = require("../src/cli/index.ts"));
  } catch (err2) {
    console.error("Failed to load CLI entrypoint:", err2 && err2.message ? err2.message : err2);
    process.exit(1);
  }
}

buildCli().parse(process.argv);
