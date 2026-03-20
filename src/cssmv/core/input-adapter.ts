import type { ProjectContext, ProjectSpec } from "./project-spec";

function estimateTokens(value: string): number {
  if (!value.trim()) return 0;
  return Math.ceil(value.trim().split(/\s+/).length * 1.3);
}

export class InputAdapter {
  normalize(project: ProjectSpec): ProjectContext {
    const originalText = project.sourceText ?? "";
    const trimmedText = originalText.trim();

    return {
      project,
      normalizedInput: {
        originalText,
        trimmedText,
        tokensEstimate: estimateTokens(trimmedText)
      }
    };
  }
}

