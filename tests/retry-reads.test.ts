import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDroppedConnection, retryDroppedReads } from "@/db/retry-reads";

const dropped = () => new Error("Connection terminated unexpectedly");
const reset = () => Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });

/** A pool whose query answers with each outcome in turn (an Error is thrown). */
function fakePool(...outcomes: unknown[]) {
  const query = vi.fn(async () => {
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const pool = { query } as unknown as Pool;
  retryDroppedReads(pool);
  return { pool, query };
}

describe("isDroppedConnection", () => {
  it("recognises dropped connections only", () => {
    expect(isDroppedConnection(dropped())).toBe(true);
    expect(isDroppedConnection(reset())).toBe(true);
    expect(isDroppedConnection(new Error("Client has encountered a connection error and is not queryable"))).toBe(true);
    expect(isDroppedConnection(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(false);
    expect(isDroppedConnection(undefined)).toBe(false);
  });
});

describe("retryDroppedReads", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs a SELECT again after a dropped connection", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pool, query } = fakePool(dropped(), reset(), { rows: [1] });
    await expect(pool.query({ text: 'select "id" from "site_config"' }, [1])).resolves.toEqual({ rows: [1] });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("gives up after three tries", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pool, query } = fakePool(dropped(), dropped(), dropped(), { rows: [] });
    await expect(pool.query("select 1")).rejects.toThrow("Connection terminated");
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("never retries a write", async () => {
    const { pool, query } = fakePool(dropped(), { rows: [] });
    await expect(pool.query({ text: 'insert into "matches" values ($1)' }, [1])).rejects.toThrow();
    await expect(fakePool(reset()).pool.query("update matches set status = 'completed'")).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not retry other errors", async () => {
    const { pool, query } = fakePool(new Error('relation "nope" does not exist'), { rows: [] });
    await expect(pool.query("select * from nope")).rejects.toThrow("does not exist");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
