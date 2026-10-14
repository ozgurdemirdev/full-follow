import type { DocFragment, McpDef } from "@fullfollow/core";

/**
 * Builds a generic tool's description from core's fragments plus the ones the installed modules contribute for that tool.
 * Fragments are sorted by `at` and joined as they are, so a module text sits exactly where its feature belongs.
 */
export function describer(defs: McpDef[]) {
  return (tool: string, base: [number, string][]): string =>
    [...base.map(([at, text]): DocFragment => ({ at, text })), ...defs.flatMap((d) => d.docs?.[tool] ?? [])]
      .sort((a, b) => a.at - b.at)
      .map((f) => f.text)
      .join("")
      .trimEnd();
}
