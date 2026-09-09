/**
 * Formats an error into a standardized error message.
 *
 * Handles three categories of values that node-quickbooks and intuit-oauth
 * can pass to callbacks:
 *   1. Error instances (intuit-oauth errors, Node.js network errors) — use .message
 *   2. Strings — pass through
 *   3. Plain objects — may be Intuit Fault JSON bodies or other plain objects.
 *      We extract the Intuit Fault detail when present, then fall back to
 *      safe serialization.  We NEVER call JSON.stringify on an unknown object
 *      without guarding against circular references, because the request/http
 *      client libraries attach circular ClientRequest/IncomingMessage objects
 *      to their error objects.
 *
 * @param error Any error value to format
 * @returns A human-readable error string (never throws)
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  if (typeof error === 'string') {
    return `Error: ${error}`;
  }

  if (error !== null && typeof error === 'object') {
    // Intuit Fault body: { Fault: { Error: [{ Message, Detail, code }], type } }
    const obj = error as Record<string, any>;
    if (obj['Fault'] && Array.isArray(obj['Fault']['Error'])) {
      const faultErrors: string[] = obj['Fault']['Error'].map(
        (e: any) => `${e.Message || ''}${e.Detail ? `: ${e.Detail}` : ''}${e.code ? ` (code ${e.code})` : ''}`
      );
      const faultType: string = obj['Fault']['type'] || 'Fault';
      return `QBO ${faultType}: ${faultErrors.join('; ')}`;
    }

    // Generic plain object — serialize safely, skipping circular refs
    try {
      const seen = new WeakSet();
      const safe = JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
      return `Unknown error: ${safe}`;
    } catch {
      // Last resort — should not normally reach here after the circular guard above
      return `Unknown error: [non-serializable object: ${Object.prototype.toString.call(error)}]`;
    }
  }

  return `Unknown error: ${String(error)}`;
}
