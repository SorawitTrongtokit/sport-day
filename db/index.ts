import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const pool = new Pool({
    // pg treats sslmode=require as verify-full today; say so explicitly.
    connectionString: process.env.DATABASE_URL?.replace(
      "sslmode=require",
      "sslmode=verify-full",
    ),
    max: 5,
    idleTimeoutMillis: 5_000,
  });
  // A Vercel function can be suspended between requests. Its idle connections
  // would then be dropped by the database while pg still thinks they are open,
  // and the next query on one fails with "Connection terminated unexpectedly".
  // This keeps the instance alive until idle connections have been closed.
  attachDatabasePool(pool);
  // An idle connection dropped by the server is just removed from the pool;
  // without a listener the error would crash the process.
  pool.on("error", (error) => console.warn(`Idle database connection closed: ${error.message}`));
  return pool;
}

// Reuse one pool across hot reloads and warm serverless invocations.
const pool = globalForDb.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { pool };
