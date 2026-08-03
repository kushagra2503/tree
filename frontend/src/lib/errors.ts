/** Normalizes an unknown thrown value into a message safe to display. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
