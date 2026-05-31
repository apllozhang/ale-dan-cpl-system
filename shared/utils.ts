/**
 * Collect unique spec parameter keys from an array of matched items.
 * Used by frontend preview, backend router, and tests.
 */

export function collectSpecKeys(matched: Array<{ specs: Record<string, string> | null }>): string[] {
  const keySet = new Set<string>();
  for (const item of matched) {
    if (item.specs) {
      for (const k of Object.keys(item.specs)) {
        keySet.add(k);
      }
    }
  }
  return Array.from(keySet);
}

/**
 * Escape SQL LIKE wildcards (% and _) in user input.
 */
export function escapeLikeWildcards(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
