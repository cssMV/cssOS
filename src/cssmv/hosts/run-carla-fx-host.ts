import { buildCarlaRenderContext, parseCarlaHostArgs, runCarlaRenderTemplate, verifyExpectedOutputs } from "./carla-render-runtime";

function main() {
  const args = parseCarlaHostArgs(process.argv.slice(2));
  const context = buildCarlaRenderContext(args);
  const template =
    process.env.CSSMV_CARLA_VOCAL_FX_RENDER_CMD ||
    process.env.CSSMV_CARLA_GENERIC_RENDER_CMD ||
    "";

  if (!template) {
    process.stderr.write(
      `[cssmv-carla-fx] session prepared at ${context.sessionDir}, but CSSMV_CARLA_VOCAL_FX_RENDER_CMD is not set.\n`
    );
    process.exit(61);
  }

  const result = runCarlaRenderTemplate(template, context);
  const outputs = verifyExpectedOutputs(context);
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
    `[cssmv-carla-fx] render command failed or produced no outputs.\ncommand=${result.command}\nstdout=${result.stdout}\nstderr=${result.stderr}\n`
  );
  process.exit(result.status || 62);
}

main();
