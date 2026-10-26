import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

// A Vercel preview has a new URL per deployment (plus one per branch), so it
// can't use a fixed BETTER_AUTH_URL: trust the URLs Vercel gives this deployment.
const previewOrigins =
  process.env.VERCEL_ENV === "preview"
    ? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
        .filter(Boolean)
        .map((host) => `https://${host}`)
    : [];

// Admin-only auth. Public sign-up is disabled; accounts are created with
// `npm run admin:create`, so every authenticated user is an administrator.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL ?? previewOrigins[0],
  trustedOrigins: previewOrigins,
  // Counters live in the database: in-memory counters are per serverless
  // instance, so they would not stop a brute-force across instances.
  rateLimit: { storage: "database" },
  // Every admin page checks the session before loading its data. A signed cookie
  // holds the session for 5 minutes, so most page loads skip that database round trip.
  // Sign-out clears it at once; a session revoked elsewhere lasts at most 5 more minutes.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  plugins: [nextCookies()],
});
