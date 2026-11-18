import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { cached, TAGS } from "./cache";

export type Announcement = typeof announcements.$inferSelect;

// PostgreSQL sorts nulls last when ordering ascending.
const announcementOrder = [
  asc(announcements.displayOrder),
  desc(announcements.publishedAt),
  desc(announcements.id),
];

export async function fetchAnnouncements(): Promise<Announcement[]> {
  return db
    .select()
    .from(announcements)
    .orderBy(...announcementOrder);
}

async function fetchPublishedAnnouncements(limit: number): Promise<Announcement[]> {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.isPublished, true))
    .orderBy(...announcementOrder)
    .limit(limit);
}

export const getPublishedAnnouncements = cached(
  fetchPublishedAnnouncements,
  "published-announcements",
  [TAGS.announcements],
);
