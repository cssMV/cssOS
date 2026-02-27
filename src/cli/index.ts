import { Command } from "commander";
import { registerPipelineCommands } from "./pipeline";

export function buildCli(): Command {
  const program = new Command();
  program.name("css");
  registerPipelineCommands(program);
  return program;
}

if (require.main === module) {
  buildCli().parse(process.argv);
}
