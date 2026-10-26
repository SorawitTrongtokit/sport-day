import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auditLog, highlights, matches, practiceSessions, sports } from "@/db/schema";
import { saveHighlight } from "@/lib/actions/highlights";
import { saveMatch } from "@/lib/actions/matches";
import { savePractice } from "@/lib/actions/practice";
import { saveResult } from "@/lib/actions/results";
import { saveSport } from "@/lib/actions/sports";
import { db, pool } from "./client";
import { createMatch, EMPTY, form, resultRows, seedTeams } from "./fixtures";

let sportId: number;

beforeEach(async () => {
  ({ sportId } = await seedTeams());
});

const matchFields = (id: number) => ({
  id,
  sportId,
  date: "2026-10-06",
  startTime: "10:00",
  round: "semi",
  format: "versus",
  teamAId: 3,
  teamBId: 4,
  status: "scheduled",
});

// Each edit targets a row that another admin deleted after the form was opened.
describe("editing a deleted row", () => {
  it("reports a deleted match instead of saving nothing", async () => {
    const id = await createMatch(sportId, { format: "versus", teamAId: 1, teamBId: 2 });
    await db.delete(matches).where(eq(matches.id, id));

    const state = await saveMatch(EMPTY, form(matchFields(id)));

    expect(state).toMatchObject({ ok: false, message: expect.stringContaining("ไม่พบการแข่งขัน") });
    expect(await db.select().from(auditLog)).toEqual([]);
  });

  it("reports a deleted sport", async () => {
    const [sport] = await db.insert(sports).values({ name: "chess" }).returning();
    await db.delete(sports).where(eq(sports.id, sport.id));

    const state = await saveSport(EMPTY, form({ id: sport.id, name: "chess 2", isActive: "on" }));

    expect(state).toMatchObject({ ok: false, message: expect.stringContaining("ไม่พบกีฬา") });
  });

  it("reports a deleted practice slot", async () => {
    const [slot] = await db
      .insert(practiceSessions)
      .values({ sportId, teamId: 1, days: "จันทร์", startTime: "16:00", endTime: "17:00", location: "สนาม" })
      .returning();
    await db.delete(practiceSessions).where(eq(practiceSessions.id, slot.id));

    const state = await savePractice(
      EMPTY,
      form({ id: slot.id, sportId, teamId: 1, days: "อังคาร", startTime: "16:00", endTime: "17:00", location: "สนาม" }),
    );

    expect(state).toMatchObject({ ok: false, message: expect.stringContaining("ไม่พบตารางซ้อม") });
  });

  it("reports a deleted highlight", async () => {
    const [highlight] = await db
      .insert(highlights)
      .values({ date: "2026-10-05", title: "MVP" })
      .returning();
    await db.delete(highlights).where(eq(highlights.id, highlight.id));

    const state = await saveHighlight(
      EMPTY,
      form({ id: highlight.id, date: "2026-10-05", title: "MVP 2" }),
    );

    expect(state).toMatchObject({ ok: false, message: expect.stringContaining("ไม่พบHighlight") });
    expect(await db.select().from(highlights)).toEqual([]);
  });
});

describe("saveMatch", () => {
  it("keeps the teams of a match that already has a result", async () => {
    const id = await createMatch(sportId, { format: "versus", teamAId: 1, teamBId: 2 });
    await saveResult(EMPTY, form({ matchId: id, score_1: 2, score_2: 0, points_1: 10, points_2: 5 }));

    const state = await saveMatch(EMPTY, form(matchFields(id)));

    expect(state.ok).toBe(true);
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    expect(match).toMatchObject({ teamAId: 1, teamBId: 2, round: "semi", status: "completed" });
  });
});

describe("saveResult", () => {
  it("waits for a team change in progress and then validates against the new teams", async () => {
    const id = await createMatch(sportId, { format: "versus", teamAId: 1, teamBId: 2 });
    const other = await pool.connect();
    try {
      // Another admin's saveMatch holds the match lock while it changes the teams.
      await other.query("begin");
      await other.query("select id from matches where id = $1 for update", [id]);
      let settled = false;
      const saving = saveResult(
        EMPTY,
        form({ matchId: id, score_1: 2, score_2: 0, points_1: 10, points_2: 5 }),
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      await other.query("update matches set team_a_id = 3, team_b_id = 4 where id = $1", [id]);
      await other.query("commit");

      // The form was for teams 1 and 2, which no longer play this match.
      const state = await saving;
      expect(state.ok).toBe(false);
      expect(await resultRows(id)).toEqual([]);
    } finally {
      other.release();
    }
  });
});
