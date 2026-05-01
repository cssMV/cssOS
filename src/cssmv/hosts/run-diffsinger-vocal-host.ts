import { buildDiffSingerRenderContext, parseDiffSingerHostArgs, runDiffSingerTemplate, verifyDiffSingerOutputs } from "./diffsinger-render-runtime";

function main() {
  const args = parseDiffSingerHostArgs(process.argv.slice(2));
  const context = buildDiffSingerRenderContext(args);
  const template =
    process.env.CSSMV_DIFFSINGER_RENDER_CMD ||
    process.env.CSSMV_DIFFSINGER_GENERIC_RENDER_CMD ||
    "";

  if (!template) {
    process.stderr.write(
      `[cssmv-diffsinger-vocal] session prepared at ${context.sessionDir}, but CSSMV_DIFFSINGER_RENDER_CMD is not set.\n`
    );
    process.exit(51);
  }

  const result = runDiffSingerTemplate(template, context);
  const outputs = verifyDiffSingerOutputs(context);
  if (result.status === 0 && outputs.length > 0) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          command: result.command,
          outputs
        },
        null,
        2
      )
    );
    return;
  }

  process.stderr.write(
    `[cssmv-diffsinger-vocal] render command failed or produced no outputs.\ncommand=${result.command}\nstdout=${result.stdout}\nstderr=${result.stderr}\n`
  );
  process.exit(result.status || 52);
}

main();
