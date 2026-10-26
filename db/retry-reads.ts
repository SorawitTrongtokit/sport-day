import type { Pool } from "pg";

const READ = /^\s*select\b/i;
const MAX_ATTEMPTS = 3;

/** The errors pg raises when the database or the network dropped the connection. */
export function isDroppedConnection(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (code === "ECONNRESET" || code === "EPIPE") return true;
  return typeof message === "string" && /Connection terminated|not queryable/.test(message);
}

function queryText(config: unknown): string {
  if (typeof config === "string") return config;
  const text = (config as { text?: unknown } | null)?.text;
  return typeof text === "string" ? text : "";
}

/**
 * Runs a SELECT again when it failed only because its connection had been dropped.
 * pg discards a connection after such an error, so the next try gets another one.
 * Writes are never retried, since one may have been applied before the drop, and
 * transactions take their own connection, so they never pass through here.
 */
export function retryDroppedReads(pool: Pool) {
  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  pool.query = (async (...args: unknown[]) => {
    // Callback-style calls and writes go through untouched.
    if (typeof args.at(-1) === "function" || !READ.test(queryText(args[0]))) {
      return query(...args);
    }
    for (let attempt = 1; ; attempt++) {
      try {
        return await query(...args);
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !isDroppedConnection(error)) throw error;
        console.warn(`Retrying a read on another database connection: ${(error as Error).message}`);
      }
    }
  }) as typeof pool.query;
}
