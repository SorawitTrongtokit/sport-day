import { expect, it } from "vitest";
import { announcements } from "@/db/schema";
import { saveAnnouncement } from "@/lib/actions/announcements";
import { getPublishedAnnouncements } from "@/lib/queries/announcements";
import { db } from "./client";
import { EMPTY, form } from "./fixtures";

it("applies admin display order before limiting published announcements", async () => {
  const published = { content: "รายละเอียด", isPublished: true };
  const editable = { title: "ประกาศเก่า", content: "รายละเอียด", publishedAt: "2026-10-01" };
  const [older, newer, latest] = await db
    .insert(announcements)
    .values([
      { ...editable, isPublished: true },
      { ...published, title: "ประกาศใหม่", publishedAt: "2026-10-02", displayOrder: 1 },
      { ...published, title: "ประกาศล่าสุด", publishedAt: "2026-10-03" },
      { title: "ฉบับร่าง", content: "รายละเอียด", publishedAt: "2026-10-04", displayOrder: 1 },
    ])
    .returning({ id: announcements.id });

  const edit = { ...editable, id: older.id, isPublished: "on" };
  expect((await saveAnnouncement(EMPTY, form({ ...edit, displayOrder: "1" }))).ok).toBe(true);
  expect((await getPublishedAnnouncements(2)).map(({ id }) => id)).toEqual([newer.id, older.id]);

  expect((await saveAnnouncement(EMPTY, form({ ...edit, displayOrder: "" }))).ok).toBe(true);
  expect((await getPublishedAnnouncements(2)).map(({ id }) => id)).toEqual([newer.id, latest.id]);
});
